'use client';

import { db as dbLocal } from '@/lib/db-local';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useRef } from 'react';

export function useInspectionCache(isOnline: boolean, firestore: any, userEmail: string | null | undefined) {
  const isCachingRef = useRef(false);

  const toSafeDate = (value: any): Date => {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    }
    return new Date();
  };

  const urlToBase64 = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Error convirtiendo imagen a Base64:", e);
      return null;
    }
  };

  const refreshCache = useCallback(async () => {
    if (isCachingRef.current || !isOnline || !firestore || !userEmail) return;

    isCachingRef.current = true;
    console.log("📥 Iniciando descarga completa de datos offline...");

    try {
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

      // 1. Cachear CLIENTES (Fundamental para formularios independientes)
      try {
        const qClientes = query(collection(firestore, 'clientes'), limit(200));
        const clientSnap = await getDocs(qClientes);
        const clientes = clientSnap.docs.map(d => ({
          id: d.id,
          nombre: d.data().nombre || d.data().clienteNombre || 'Sin Nombre',
          direccion: d.data().direccion || ''
        }));
        if (clientes.length > 0) {
          await dbLocal.clientes_cache.bulkPut(clientes);
        }
      } catch (err) {
        console.warn("Error cacheando clientes:", err);
      }

      // 2. Cachear Órdenes de Trabajo (Solo ACTIVAS / EN PROCESO)
      let ots: any[] = [];
      try {
        const qOts = query(
          collection(firestore, 'ordenes_trabajo'),
          where('inspectorIds', 'array-contains', userEmail),
          where('estado', 'in', ['Abierta', 'En Proceso', 'Registrada', 'en proceso', 'registrada']),
          limit(50)
        );
        const otSnap = await getDocs(qOts);
        ots = otSnap.docs.map(d => ({
          id: d.id,
          data: d.data(),
          estado: d.data().estado || 'Abierta',
          inspectorIds: d.data().inspectorIds || [],
          createdAt: new Date()
        }));

        if (ots.length > 0) {
          await dbLocal.ordenes_cache.bulkPut(ots);
        }
      } catch (err) {
        console.warn("Error cacheando OTs activas:", err);
      }
        
      // 3. Cachear Informes Recientes (Solo los últimos 5 días y NO APROBADOS)
      try {
        const qInformes = query(
          collection(firestore, 'informes'),
          where('inspectorId', '==', userEmail),
          where('estado', '==', 'Registrado'), // El inspector solo necesita los que aún no han sido aprobados/cerrados
          limit(50)
        );
        
        const infoSnap = await getDocs(qInformes);
        const informes = infoSnap.docs.map(d => {
          const data = d.data();
          if (data.eliminado === true) return null;
          const imageCount = Array.isArray(data.imagenes) ? data.imagenes.length : 0;
          
          const cleanData = { ...data };
          delete cleanData.imagenes;
          delete cleanData.fotos;

          return {
            id: d.id,
            orderId: data.orderId || null,
            data: cleanData,
            imageCount,
            createdAt: data.createdAt?.toDate() || new Date()
          };
        }).filter((inf): inf is NonNullable<typeof inf> => !!inf && inf.createdAt >= fifteenDaysAgo);

        if (informes.length > 0) {
          await dbLocal.informes_cache.bulkPut(informes);
        }
      } catch (err) {
        console.warn("Error cacheando Informes recientes:", err);
      }

      // 4. Cachear GASTOS_DETALLE y JORNADAS (Historial completo offline)
      try {
        const qGastos = query(collection(firestore, 'gastos_detalle'), where('inspectorId', '==', userEmail));
        const gastoSnap = await getDocs(qGastos);
        const gastos = gastoSnap.docs.map(d => ({
          firebaseId: d.id,
          synced: true,
          data: d.data(),
          createdAt: toSafeDate(d.data().createdAt)
        }));
        if (gastos.length > 0) await dbLocal.gastos.bulkPut(gastos);

        const qJornadas = query(collection(firestore, 'bitacora_visitas'), where('inspectorId', '==', userEmail));
        const jornadaSnap = await getDocs(qJornadas);
        const jornadas = jornadaSnap.docs.map(d => ({
          firebaseId: d.id,
          synced: true,
          data: d.data(),
          createdAt: toSafeDate(d.data().createdAt)
        }));
        if (jornadas.length > 0) await dbLocal.registros_jornada.bulkPut(jornadas);
      } catch (err) {
        console.warn("Error cacheando Historial completo:", err);
      }

      // 5. Cachear informes de OTROS INSPECTORES relacionados a OTs del inspector actual
      try {
        // Primero obtener las OTs asignadas al inspector
        const otIds = ots.map(ot => ot.id);
        if (otIds.length > 0) {
          const qInformesOtros = query(
            collection(firestore, 'informes'),
            where('orderId', 'in', otIds.slice(0, 10)), // Limitar a 10 OTs para evitar límites de Firestore
            limit(100)
          );
          const informesOtrosSnap = await getDocs(qInformesOtros);
          const informesOtros = informesOtrosSnap.docs.map(d => {
            const data = d.data();
            if (data.eliminado === true) return null;
            const imageCount = Array.isArray(data.imagenes) ? data.imagenes.length : 0;

            const cleanData = { ...data };
            delete cleanData.imagenes;
            delete cleanData.fotos;

            return {
              id: d.id,
              orderId: data.orderId || null,
              data: cleanData,
              imageCount,
              createdAt: data.createdAt?.toDate() || new Date()
            };
          }).filter((inf): inf is NonNullable<typeof inf> => !!inf);

          if (informesOtros.length > 0) {
            await dbLocal.informes_cache.bulkPut(informesOtros);
          }
        }
      } catch (err) {
        console.warn("Error cacheando informes de otros inspectores:", err);
      }

      // 6. Cachear Bitácora de FILTROS del inspector
      try {
        const qFiltros = query(collection(firestore, 'bitacora_filtros'), where('inspectorId', '==', userEmail));
        const filtrosSnap = await getDocs(qFiltros);
        const filtros = filtrosSnap.docs.map(d => ({
          id: d.id,
          data: d.data(),
          createdAt: d.data().createdAt?.toDate() || new Date()
        }));
        if (filtros.length > 0) {
          await dbLocal.filtros_cache.bulkPut(filtros);
        }
      } catch (err) {
        console.warn("Error cacheando bitácora de filtros:", err);
      }

      // 7. Guardar identidad local codificada para uso offline. Esto no es cifrado.
      try {
        // Importar auth desde firebase
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const currentUser = auth.currentUser;
        if (currentUser) {
          const uid = currentUser.uid;
          const email = currentUser.email;
          if (uid && email) {
            await dbLocal.configuracion.put({ key: 'user_uid', value: btoa(uid) });
            await dbLocal.configuracion.put({ key: 'user_email', value: btoa(email) });
          }
        }
      } catch (err) {
        console.warn("Error guardando identidad offline:", err);
      }

      // 8. Cachear Firma del Inspector (Base64)
      try {
        const qProfile = query(collection(firestore, 'usuarios'), where('email', '==', userEmail));
        const profileSnap = await getDocs(qProfile);
        if (!profileSnap.empty) {
          const userData = profileSnap.docs[0].data();
          if (userData.firmaUrl) {
            const b64 = await urlToBase64(userData.firmaUrl);
            if (b64) {
              await dbLocal.seguridad.put({ email: userEmail, signatureBase64: b64, createdAt: new Date() });
            }
          }
        }
      } catch (err) {
        console.warn("Error cacheando Firma:", err);
      }

      console.log("✅ Descarga completa de datos offline.");
    } catch (err) {
      console.error("Error crítico en el proceso general de caché offline:", err);
    } finally {
      isCachingRef.current = false;
    }
  }, [isOnline, firestore, userEmail]);

  useEffect(() => {
    if (isOnline && userEmail) {
      refreshCache();
      // Refrescar cada 15 minutos mientras esté online
      const interval = setInterval(refreshCache, 15 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [isOnline, userEmail, refreshCache]);

  return { refreshCache };
}
