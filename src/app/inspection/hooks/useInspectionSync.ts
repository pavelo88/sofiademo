'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, doc, setDoc, updateDoc, serverTimestamp, Timestamp, runTransaction, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadString, uploadBytes } from 'firebase/storage';
import { db as dbLocal } from '@/lib/db-local';
import { getBackoffDelay, isRetryableError, base64ToBlob } from '@/lib/offline-utils';
import { useToast } from '@/hooks/use-toast';
import { syncLocalCountersFromCloud, forceResetLocalCountersFromCloud, COUNTER_RESET_DONE_KEY } from '@/lib/sequence-manager';
import { normalizeInspectionEmail } from '@/lib/inspection-mode';
import { buildVisitId } from '../lib/visit-record';
import { getCreationReportId } from '../lib/report-record';

export function useInspectionSync(canUseCloud: boolean, user: any, firestore: any, offlineEmail: string | null) {
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const syncInFlightRef = useRef(false);

  const cleanupSyncedData = useCallback(async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      await dbLocal.gastos.filter(g => g.synced && g.createdAt < thirtyDaysAgo).delete();
      await dbLocal.registros_jornada.filter(r => r.synced && r.createdAt < thirtyDaysAgo).delete();
      console.log('Caché antiguo limpiado.');
    } catch (err) {
      console.error('Error en limpieza de caché:', err);
    }
  }, []);

  const ensureCloudCounterAtLeast = useCallback(async (localSequence: number) => {
    if (!firestore || !user?.email) return;
    try {
      const counterRef = doc(firestore, 'configuracion', 'secuencias_informes');
      const sfDoc = await getDoc(counterRef);
      if (!sfDoc.exists()) {
        await setDoc(counterRef, { current: localSequence });
      } else {
        const cloudCurrent = sfDoc.data().current || 0;
        if (localSequence > cloudCurrent) {
          await updateDoc(counterRef, { current: localSequence });
        }
      }
    } catch (e) {
      console.error("Error actualizando contador en nube:", e);
    }
  }, [firestore, user]);

  const ensureInspectorCounterAtLeast = useCallback(async (reportId: string, reportData: any) => {
    if (!firestore) return;

    const match = String(reportId || '').match(/^([A-Z]+)-[A-Z]{2}-(\d{4})-(\d{4})$/i);
    if (!match) return;

    const yearKey = String(Number(match[2]) || new Date().getFullYear());
    const sequence = Number(match[3]);
    const formType = String(reportData?.formType || '').trim();
    if (!formType || !Number.isFinite(sequence) || sequence <= 0) return;

    const ownerEmail = normalizeInspectionEmail(
      reportData?.inspectorId ||
      (Array.isArray(reportData?.inspectorIds) ? reportData.inspectorIds[0] : '') ||
      reportData?.modificadoPorId ||
      offlineEmail ||
      user?.email ||
      ''
    );

    if (!ownerEmail) return;

    try {
      const userRef = doc(firestore, 'usuarios', ownerEmail);
      const snap = await getDoc(userRef);
      const exists = snap.exists();
      const data = (exists ? snap.data() : {}) as any;
      const countersByYear = (data?.inspectionCounters || {}) as Record<string, Record<string, number>>;
      const currentValue = Number(countersByYear?.[yearKey]?.[formType] || 0);

      if (sequence > currentValue) {
        const updatePath = `inspectionCounters.${yearKey}.${formType}`;
        if (exists) {
          await updateDoc(userRef, { [updatePath]: sequence });
        } else {
          await setDoc(userRef, {
            inspectionCounters: { [yearKey]: { [formType]: sequence } }
          }, { merge: true });
        }
      }
    } catch (err) {
      console.warn('No se pudo alinear el contador del inspector con Firestore:', err);
    }
  }, [firestore, offlineEmail, user?.email]);

  const syncOfflineData = useCallback(async () => {
    if (syncInFlightRef.current || !canUseCloud || !firestore) return;

    // Use the effective email: authenticated user first, then offline fallback
    const effectiveEmail = user?.email || offlineEmail;
    if (effectiveEmail) {
      // ── ONE-TIME RESET ──────────────────────────────────────────────────────
      // Si el dispositivo nunca hizo el reset (o la clave cambió de versión),
      // forzamos local = cloud antes de cualquier sync bidireccional.
      // Esto corrige contadores locales inflados por bugs anteriores.
      const resetDone = typeof window !== 'undefined' && window.localStorage.getItem(COUNTER_RESET_DONE_KEY);
      if (!resetDone) {
        try {
          await forceResetLocalCountersFromCloud(firestore, effectiveEmail);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(COUNTER_RESET_DONE_KEY, '1');
          }
        } catch (err) {
          console.warn('[CounterReset] Fallo en reset one-time, se intentará bidireccional:', err);
        }
      }
      // ── SYNC BIDIRECCIONAL NORMAL ────────────────────────────────────────────
      try {
        await syncLocalCountersFromCloud(firestore, effectiveEmail);
      } catch (err) {
        console.warn('No se pudieron alinear los contadores locales al inicio de la sincronización:', err);
      }
    }

    const pendingCount = await dbLocal.sync_queue.count();
    const pendingGastos = await dbLocal.gastos.filter(g => !g.synced).count();
    const pendingJornadas = await dbLocal.registros_jornada.filter(r => !r.synced).count();

    if (pendingCount === 0 && pendingGastos === 0 && pendingJornadas === 0) return;

    syncInFlightRef.current = true;
    setIsSyncing(true);

    try {
      let errorCount = 0;
      const maxRetries = 5;

      // 1. Sincronizar Informes (usando la cola de sincronización)
      const queueItems = await dbLocal.sync_queue
        .filter(item => ['pending', 'retrying', 'failed'].includes(item.status) && (item.retryCount || 0) < maxRetries)
        .toArray();
      for (const item of queueItems) {
        let retryCount = item.retryCount || 0;
        let synced = false;
        
        // Buscar el dato real en la tabla local compartida.
        const reportRecord = await dbLocal.hojas_trabajo.where('firebaseId').equals(item.recordId).first();
        if (!reportRecord) {
          await dbLocal.sync_queue.delete(item.id!);
          continue;
        }

        while (retryCount < maxRetries && !synced) {
          try {
            const reportData = reportRecord.data;
            const reportId = getCreationReportId({
              ...reportData,
              firebaseId: reportRecord.firebaseId,
              id: reportRecord.id,
            });

            if (!reportId) {
              throw Object.assign(
                new Error(`ID de informe inválido para sincronizar: ${item.recordId}`),
                { code: 'INVALID_REPORT_ID' }
              );
            }

            await dbLocal.sync_queue.update(item.id!, {
              status: retryCount > 0 ? 'retrying' : 'pending',
              lastRetry: new Date(),
              retryCount
            });

            if (item.recordType === 'bitacora-filtros') {
              const { imagesBase64, ...cleanPayload } = reportData;
              const imageUrls = await Promise.all((imagesBase64 || []).map(async (base64: string, index: number) => {
                const imageRef = ref(getStorage(firestore.app), `bitacora_filtros/${reportId}_${index}.jpg`);
                await uploadString(imageRef, base64, 'data_url');
                const { getDownloadURL } = await import('firebase/storage');
                return getDownloadURL(imageRef);
              }));

              await setDoc(doc(firestore, 'bitacora_filtros', reportId), {
                ...cleanPayload,
                imageUrls,
                synced: true,
                fecha: Timestamp.fromDate(new Date(cleanPayload.fecha || cleanPayload.fechaStr || Date.now())),
                updatedAt: serverTimestamp()
              });

              await dbLocal.sync_queue.delete(item.id!);
              await dbLocal.hojas_trabajo.update(reportRecord.id!, { synced: true });
              synced = true;
              continue;
            }
            
            let cleanData = { ...reportData };
            const storageInstance = getStorage(firestore.app);

            // 1. Sincronizar fotos offline de Cámara / Galería
            if (cleanData.imagesBase64 && cleanData.imagesBase64.length > 0) {
              const { getDownloadURL } = await import('firebase/storage');
              const syncedImageUrls = await Promise.all(
                cleanData.imagesBase64.map(async (imgObj: { name: string; base64: string }) => {
                  const imageRef = ref(storageInstance, `informes/${reportId}/${imgObj.name}`);
                  await uploadString(imageRef, imgObj.base64, 'data_url');
                  return getDownloadURL(imageRef);
                })
              );
              cleanData.imageUrls = [
                ...(cleanData.imageUrls || []),
                ...syncedImageUrls
              ];
            }

            // 2. Sincronizar firma del inspector offline si es base64
            if (cleanData.inspectorSignature && cleanData.inspectorSignature.startsWith('data:')) {
              try {
                const { getDownloadURL } = await import('firebase/storage');
                const sigRef = ref(storageInstance, `firmas/${reportId}/inspector.png`);
                await uploadString(sigRef, cleanData.inspectorSignature, 'data_url');
                cleanData.inspectorSignatureUrl = await getDownloadURL(sigRef);
              } catch (sigErr) {
                console.error("Error syncing inspector signature:", sigErr);
              }
            }

            // 3. Sincronizar firma del cliente offline si es base64
            if (cleanData.clientSignature && cleanData.clientSignature.startsWith('data:')) {
              try {
                const { getDownloadURL } = await import('firebase/storage');
                const cliRef = ref(storageInstance, `firmas/${reportId}/cliente.png`);
                await uploadString(cliRef, cleanData.clientSignature, 'data_url');
                cleanData.clientSignatureUrl = await getDownloadURL(cliRef);
              } catch (cliErr) {
                console.error("Error syncing client signature:", cliErr);
              }
            }

            // 4. Limpiar los campos base64 y temporales para no saturar Firestore
            delete cleanData.imagesBase64;
            delete cleanData.inspectorSignature;
            delete cleanData.clientSignature;
            delete cleanData.images;

            // 5. Guardar en Firestore
            await setDoc(doc(firestore, 'informes', reportId), {
              ...cleanData,
              synced: true,
              updatedAt: serverTimestamp()
            });

            // Al sincronizar, borramos de la cola y marcamos el registro original
            await dbLocal.sync_queue.delete(item.id!);
            await dbLocal.hojas_trabajo.update(reportRecord.id!, { 
              synced: true,
              data: cleanData
            });
            synced = true;

            const seqMatch = reportId.match(/-(\d{4})$/);
            if (seqMatch) {
              await ensureCloudCounterAtLeast(parseInt(seqMatch[1]));
              await ensureInspectorCounterAtLeast(reportId, reportData);
            }

          } catch (err: any) {
            if (err?.code === 'INVALID_REPORT_ID') {
              errorCount++;
              await dbLocal.sync_queue.update(item.id!, {
                status: 'failed',
                retryCount,
                lastRetry: new Date(),
                lastError: err.message || 'ID de informe inválido'
              });
              break;
            }

            retryCount++;
            if (isRetryableError(err) && retryCount < maxRetries) {
              await dbLocal.sync_queue.update(item.id!, {
                status: 'retrying',
                retryCount,
                lastRetry: new Date(),
                lastError: err.message || 'Error temporal de sincronización'
              });
              await new Promise(r => setTimeout(r, getBackoffDelay(retryCount)));
            } else {
              errorCount++;
              await dbLocal.sync_queue.update(item.id!, {
                status: 'failed',
                retryCount,
                lastRetry: new Date(),
                lastError: err.message || 'Error de sincronización'
              });
              break;
            }
          }
        }
      }

      // 2. Sincronizar Gastos
      const unsyncedGastos = await dbLocal.gastos.filter(g => !g.synced).toArray();
      const storage = getStorage(firestore.app);
      for (const gasto of unsyncedGastos) {
        try {
          const cloudId = gasto.firebaseId;
          let cUrl = '';
          
          if (gasto.data.comprobanteBase64) {
            try {
              const blob = base64ToBlob(gasto.data.comprobanteBase64, 'image/png');
              const fRef = ref(storage, `comprobantes_gastos/${cloudId}_img.png`);
              await uploadBytes(fRef, blob);
              const { getDownloadURL } = await import('firebase/storage');
              cUrl = await getDownloadURL(fRef);
            } catch (storageErr) {
              console.warn("Storage upload failed, syncing without receipt image", storageErr);
            }
          }
          
          const { comprobanteBase64, ...cleanPayload } = gasto.data;
          
          await setDoc(doc(firestore, 'gastos_detalle', cloudId), {
            ...cleanPayload,
            comprobanteUrl: cUrl || gasto.data.comprobanteUrl || null,
            synced: true,
            createdAt: serverTimestamp(),
            fecha: Timestamp.fromDate(new Date(gasto.data.fecha))
          });
          await dbLocal.gastos.update(gasto.id!, { synced: true });
        } catch (e) {
          errorCount++;
        }
      }

      // 3. Sincronizar Horas (Jornadas)
      const unsyncedJornadas = await dbLocal.registros_jornada.filter(r => !r.synced).toArray();
      for (const record of unsyncedJornadas) {
        try {
          const reportId = record.firebaseId || buildVisitId(
            record?.data?.inspectorId || record?.data?.inspectorEmail || offlineEmail || user?.email || null,
            record?.data?.inspectorNombre || user?.displayName || null,
            record?.data?.fecha || record?.data?.fechaStr || Date.now()
          );
          await setDoc(doc(firestore, 'bitacora_visitas', reportId), {
            ...record.data,
            synced: true,
            createdAt: serverTimestamp()
          });
          await dbLocal.registros_jornada.update(record.id!, { synced: true, firebaseId: reportId });
        } catch (e) {
          errorCount++;
        }
      }

      const effectiveEmailAfterSync = user?.email || offlineEmail;
      if (effectiveEmailAfterSync) {
        try {
          await syncLocalCountersFromCloud(firestore, effectiveEmailAfterSync);
        } catch (err) {
          console.warn('No se pudieron alinear los contadores locales al final de la sincronización:', err);
        }
      }

      if (errorCount === 0 && (pendingCount > 0 || pendingGastos > 0 || pendingJornadas > 0)) {
        toast({ title: 'Sincronización Exitosa ✅', description: 'Todos los datos están en la nube.' });
        await cleanupSyncedData();
      }

    } finally {
      setIsSyncing(false);
      syncInFlightRef.current = false;
    }
  }, [canUseCloud, firestore, user, toast, ensureCloudCounterAtLeast, cleanupSyncedData, offlineEmail]);

  useEffect(() => {
    if (canUseCloud) {
      const interval = setInterval(syncOfflineData, 30000);
      syncOfflineData();
      return () => clearInterval(interval);
    }
  }, [canUseCloud, syncOfflineData]);

  return { isSyncing, syncOfflineData };
}
