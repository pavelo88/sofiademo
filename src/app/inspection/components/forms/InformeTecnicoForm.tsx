'use client';

/* eslint-disable @next/next/no-img-element, react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- QA: warning reviewed; keeping current flow to avoid behavioral changes. */
import { processDictation } from '@/ai/flows/process-dictation-flow';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useFirestore, useUser } from '@/firebase';
import { useGpsRequired } from '@/hooks/use-gps-required';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { useToast } from '@/hooks/use-toast';
import { db as dbLocal } from '@/lib/db-local';
import { resolveInspectorEmail } from '@/lib/inspection-mode';
import { queueOfflineReportUpdate } from '../../lib/offline-report-update';
import { addImageSafely, normalizeReportForPdf, renderImageGallery } from '@/lib/pdf-utils';
import { MAX_IMAGES_PER_REPORT } from '@/lib/report-limits';
import { getNextSequenceForUser, pushCounterToCloud } from '@/lib/sequence-manager';
import { getTechnicianName, resolveInitials, saveTechnicianInfo } from '@/lib/technician-utils';
import { decimalToTime, timeToDecimal } from '@/lib/utils';
import { doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadString } from 'firebase/storage';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Camera, CheckCircle2, ClipboardList, FileSearch, FileText, Loader2, MapPin, Mic, MicOff, Printer, Save, Settings, Type, Wand2, Zap, X } from 'lucide-react';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { fileToBase64 } from '@/lib/offline-utils';
import { drawPdfFooter, drawPdfHeader } from '../../lib/pdf-helpers';
import { getExistingReportId, isExistingReportSeed } from '../../lib/report-record';
import ClientSelector from '../ClientSelector';
import ObservationQuickPhrases from './ObservationQuickPhrases';
import SignaturePad from '../SignaturePad';
import StableInput from '../StableInput';

export const generatePDF = async (reportRaw: any, inspectorName: string, reportId: string | null) => {
  const report = await normalizeReportForPdf(reportRaw);
  const doc = new jsPDF();
  const finalID = reportId || 'BORRADOR';
  const darkColor = '#165a30';
  const bodyColor = '#111111';
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;

  const leftMargin = 25.4;
  const rightMargin = 25.4;
  const bottomMargin = 25.4;
  const topMargin = 40;
  const contentWidth = pageWidth - leftMargin - rightMargin;

  let currentY = topMargin;

  try {
    const individualID = report.numero_informe || report.individualId || '';
    const displayID = (individualID && individualID !== finalID && finalID !== 'BORRADOR')
      ? `${finalID} (${individualID})`
      : finalID;
    doc.setTextColor(darkColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("INFORME TÉCNICO", leftMargin, currentY);
    doc.setFontSize(12);
    doc.text(`Nº: ${displayID}`, pageWidth - rightMargin, currentY, { align: 'right' });
    currentY += 10;

    autoTable(doc, {
      startY: currentY,
      body: [
        ['Fecha:', new Date(report.fecha).toLocaleDateString('es-ES'), 'Inspector:', inspectorName],
        [{ content: 'Cliente:', styles: { fontStyle: 'bold' } }, { content: report.clienteNombre || report.cliente || 'N/A', colSpan: 3 }],
        [{ content: 'Instalación:', styles: { fontStyle: 'bold' } }, { content: report.instalacion || 'N/A', colSpan: 3 }],
        [{ content: 'UBICACIÓN:', styles: { fontStyle: 'bold' } }, { content: report.location ? `${report.location.lat.toFixed(6)}, ${report.location.lon.toFixed(6)}` : 'No registrada', colSpan: 3 }],
        ['Motor:', report.motor || '-', 'Modelo:', report.modelo || '-'],
        ['Nº de motor:', report.n_motor || '-', 'Grupo:', report.n_grupo || report.grupo || '-'],
        ['Potencia (KVA):', report.potencia || '-', '', ''],
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2, lineColor: '#ccc', lineWidth: 0.1, textColor: bodyColor },
      columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } },
      margin: { left: leftMargin, right: rightMargin },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    doc.setTextColor(bodyColor);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("Descripción de la incidencia", leftMargin, currentY);
    currentY += 8;

    const rawText = report.reportContent || '';
    const blocks = rawText.split('\n\n');

    blocks.forEach((block: string) => {
      const text = block.replace(/\n/g, ' ').trim();
      if (!text) return;
      const isTitle = text.endsWith(':') && text.toUpperCase() === text;
      if (isTitle) {
        if (currentY + 15 > pageHeight - bottomMargin) {
          doc.addPage();
          currentY = topMargin;
        }
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(bodyColor);
        doc.text(text, leftMargin, currentY);
        currentY += 6;
      } else {
        autoTable(doc, {
          startY: currentY,
          margin: { top: topMargin, bottom: bottomMargin, left: leftMargin, right: rightMargin },
          body: [[text]],
          theme: 'plain',
          styles: { font: 'helvetica', fontStyle: 'normal', fontSize: 11, cellPadding: 0, halign: 'justify', textColor: bodyColor },
          columnStyles: { 0: { cellWidth: contentWidth } }
        });
        currentY = (doc as any).lastAutoTable.finalY + 2;
      }
    });

    currentY += 10;

    const signatureBlockHeight = 48;
    if (currentY + signatureBlockHeight > pageHeight - bottomMargin) {
      doc.addPage();
      currentY = topMargin;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(bodyColor);
    doc.text("Atentamente,", leftMargin, currentY);
    addImageSafely(doc, report.inspectorSignatureUrl, leftMargin, currentY + 6, 50, 18);
    doc.line(leftMargin, currentY + 25, leftMargin + 50, currentY + 25);
    doc.text(report.tecnicos || inspectorName || '', leftMargin, currentY + 32);
    doc.text("Inspector Técnico", leftMargin, currentY + 38);

    // --- REGISTRO FOTOGRÁFICO ---
    if (report.imageUrls && report.imageUrls.length > 0) {
      renderImageGallery(doc, report.imageUrls);
    }

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      try { drawPdfHeader(doc); } catch (e) { console.error("Header fail:", e); }
      drawPdfFooter(doc, i, pageCount, report.individualId);
    }
  } catch (error) {
    console.error("PDF Final Generation failed:", error);
  }
  return doc;
};


export default function InformeTecnicoForm({ initialData, aiData, onSuccess, isAdmin = false }: { initialData: any, aiData: any, onSuccess: () => void, isAdmin?: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const isOnline = useOnlineStatus();
  const inspectorEmail = resolveInspectorEmail(user?.email || '');
  const currentEmail = inspectorEmail;
  const canUseCloud = isOnline && !!firestore && !!user?.email;
  const { toast } = useToast();
  const [inspectorName, setInspectorName] = useState('');
  const [images, setImages] = useState<File[]>([]);

  const [formData, setFormData] = useState({
    formType: 'informe-tecnico',
    clienteId: '',
    clienteNombre: '',
    cliente: '',
    motor: '',
    modelo: '',
    n_motor: '',
    n_grupo: '',
    potencia: '',
    instalacion: '',
    location: null as { lat: number, lon: number } | null,
    fecha: new Date().toISOString().split('T')[0],
    imageUrls: [] as string[],
    reportContent: '',
    observaciones: '',
    parametrosTecnicos: { horas: '' },
  });
  const existingImageUrls = Array.isArray(formData.imageUrls) ? formData.imageUrls : [];
  const previewImages = [...images, ...existingImageUrls];

  const [inspectorSignature, setInspectorSignature] = useState<string | null>(null);
  const [clientSignature, setClientSignature] = useState<string | null>(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedDocId, setSavedDocId] = useState('');
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const gpsRequired = useGpsRequired();

  // Detect if we're editing an existing completed/preapproved report
  const existingReportId = getExistingReportId(initialData);
  const isEditingExisting = isExistingReportSeed(initialData);

  useEffect(() => {
    // 1. Cargar desde LocalStorage inmediatamente para velocidad
    const localSig = localStorage.getItem('energy_engine_signature');
    if (localSig) setInspectorSignature(localSig);

    if (canUseCloud && user?.email && firestore) {
      getDoc(doc(firestore, 'usuarios', user.email)).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          const name = data.nombre || user.displayName || user.email || 'Inspector Especialista';
          // Solo establecer inspectorName si no estamos editando un informe con autor ya definido
          if (!isEditingExisting) {
            setInspectorName(name);
          }
          if (data.firmaUrl && !localSig) {
            setInspectorSignature(data.firmaUrl);
            localStorage.setItem('energy_engine_signature', data.firmaUrl);
          }
          if (!isEditingExisting && name) {
            saveTechnicianInfo(name, resolveInitials(user.email));
          }
        }
      });
      return;
    }
    if (inspectorEmail) {
      dbLocal.table('seguridad').get(inspectorEmail).then(cached => {
        if (cached?.signatureBase64 && !localSig) {
          setInspectorSignature(cached.signatureBase64);
        }
        if (cached?.nombre && !isEditingExisting) {
          setInspectorName(cached.nombre);
        }
      });

      if (!isEditingExisting) {
        // Never use the email as inspector name — use cached name or wait for Firestore fetch
        const cachedName = getTechnicianName();
        if (cachedName) setInspectorName(cachedName);
      }
    }
  }, [canUseCloud, inspectorEmail, user, firestore, isEditingExisting]);

  useEffect(() => {
    if (initialData) {
      if (isEditingExisting) {
        // Editing existing completed report - populate ALL fields
        setFormData((prev: any) => ({
          ...prev,
          ...initialData,
          clienteId: initialData.clienteId || prev.clienteId,
          cliente: initialData.clienteNombre || initialData.cliente || prev.cliente,
          clienteNombre: initialData.clienteNombre || initialData.cliente || prev.clienteNombre,
          numero_informe: existingReportId || prev.numero_informe,
          parametrosTecnicos: {
            ...initialData.parametrosTecnicos,
            horas: typeof initialData.parametrosTecnicos?.horas === 'number' ? decimalToTime(initialData.parametrosTecnicos.horas) : initialData.parametrosTecnicos?.horas || '',
          }
        }));
        if (initialData.inspectorSignatureUrl) setInspectorSignature(initialData.inspectorSignatureUrl);
        if (initialData.clientSignatureUrl) setClientSignature(initialData.clientSignatureUrl);
        if (initialData.tecnicos || initialData.inspectorNombre) {
          setInspectorName(initialData.tecnicos || initialData.inspectorNombre);
        }
        setSavedDocId(existingReportId);
      } else {
        setFormData((prev: any) => ({
          ...prev,
          clienteId: initialData.clienteId || prev.clienteId,
          cliente: initialData.clienteNombre || initialData.cliente || prev.cliente,
          clienteNombre: initialData.clienteNombre || initialData.cliente || prev.clienteNombre,
          instalacion: initialData.instalacion || prev.instalacion,
          motor: initialData.modelo || prev.motor,
          n_motor: initialData.n_motor || prev.n_motor,
          n_grupo: initialData.n_grupo || prev.n_grupo,
          potencia: initialData.potencia || prev.potencia,
          observaciones: initialData.descripcion || prev.observaciones,
          estado: 'Registrado',
        }));
      }
    }
  }, [initialData]);

  useEffect(() => {
    if (aiData) {
      setFormData((prev: any) => ({
        ...prev,
        cliente: aiData.identidad.cliente || prev.cliente,
        motor: aiData.identidad.marca || prev.motor,
        modelo: aiData.identidad.modelo || prev.modelo,
        n_motor: aiData.identidad.sn || prev.n_motor,
        n_grupo: aiData.identidad.n_grupo || prev.n_grupo,
        instalacion: aiData.identidad.instalacion || prev.instalacion,
        reportContent: aiData.observations_summary || prev.reportContent,
        observaciones: aiData.observations_summary || prev.observaciones
      }));
    }
  }, [aiData]);




  const recognitionRef = useRef<any>(null);

  const toggleDictation = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        toast({ title: 'No soportado', description: 'Tu navegador no soporta dictado por voz.', variant: 'destructive' });
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.interimResults = true;
      recognition.continuous = true;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        }
        if (finalTranscript) {
          setFormData((prev: any) => ({
            ...prev,
            reportContent: prev.reportContent ? `${prev.reportContent.trim()} ${finalTranscript}` : finalTranscript,
          }));
        }
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      
      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  const handleClientSelect = (client: any) => {
    setFormData((prev: any) => ({
      ...prev,
      clienteId: client.id,
      cliente: client.nombre,
      clienteNombre: client.nombre
    }));
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleCaptureLocation = () => {
    if (!navigator.geolocation) {
      toast({ variant: 'destructive', title: 'Error GPS', description: 'Tu dispositivo no soporta geolocalización.' });
      setLocationStatus('error');
      return;
    }
    setLocationStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        handleInputChange('location', { lat: latitude, lon: longitude });
        setLocationStatus('success');
        toast({ title: 'GPS OK', description: 'Ubicación registrada con éxito.' });
      },
      (error) => {
        let msg = 'Active permisos de ubicación.';
        if (error.code === error.TIMEOUT) msg = 'Tiempo de espera agotado buscando GPS.';
        toast({ variant: 'destructive', title: 'GPS Fallido', description: msg });
        setLocationStatus('error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleEnhanceReport = async () => {
    if (!formData.reportContent) return;
    setAiLoading(true);
    try {
      const res = await processDictation({ dictation: formData.reportContent });
      setFormData((p: any) => ({
        ...p,
        cliente: res.identidad.cliente || p.cliente,
        motor: res.identidad.marca || p.motor,
        modelo: res.identidad.modelo || p.modelo,
        n_motor: res.identidad.sn || p.n_motor,
        n_grupo: res.identidad.n_grupo || p.n_grupo,
        instalacion: res.identidad.instalacion || p.instalacion,
        potencia: res.identidad.potencia_kva || p.potencia,
        reportContent: res.observations_summary || p.reportContent,
        observaciones: res.observations_summary || p.observaciones,
      }));
      toast({ title: '¡Pulido por IA!', description: 'El reporte ha sido estructurado y los campos han sido extraídos.' });
    } catch (e: any) {
      console.error("AI Error:", e);
      toast({
        variant: 'destructive',
        title: 'IA no disponible',
        description: 'Error de servidor. El informe se mantendrá como texto manual.'
      });
    } finally { setAiLoading(false); }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files);
    const existingCount = existingImageUrls.length;
    if (existingCount + images.length + selected.length > MAX_IMAGES_PER_REPORT) {
      toast({
        variant: 'destructive',
        title: 'Limite de imagenes',
        description: `Maximo ${MAX_IMAGES_PER_REPORT} imagenes por informe.`,
      });
      return;
    }
    setImages((prev) => [...prev, ...selected]);
  };

  const handlePdfAction = useCallback((forceDownload = false, docIdOverride?: string) => {
    if (!formData.cliente || !formData.instalacion) {
      toast({ variant: 'destructive', title: 'Faltan Datos', description: 'Cliente e Instalación son obligatorios para generar PDF.' });
      return;
    }
    setPdfLoading(true);

    setTimeout(() => {
      try {
        const existingImageUrls = Array.isArray(formData.imageUrls) ? formData.imageUrls : [];
        const reportData = {
          ...formData,
          inspectorSignatureUrl: inspectorSignature,
          imageUrls: [...existingImageUrls, ...images],
        };
        const finalId = docIdOverride || (isSaved ? savedDocId : 'BORRADOR');
        generatePDF(reportData, inspectorName, finalId).then(docPdf => {
          if (isSaved || forceDownload) {
            docPdf.save(`${finalId}.pdf`);
          } else {
            const blob = docPdf.output('blob');
            const url = URL.createObjectURL(blob);
            setPreviewPdfUrl(url);
          }
        }).catch(err => {
          console.error("Error PDF:", err);
          toast({ variant: 'destructive', title: 'Error', description: 'Fallo al generar PDF' });
        }).finally(() => {
          setPdfLoading(false);
        });
      } catch (e) {
        console.error("Error al generar PDF:", e);
        setPdfLoading(false);
      }
    }, 300);
  }, [formData, inspectorSignature, inspectorName, isSaved, savedDocId]);

  const handleSave = async () => {
    if (!inspectorEmail) {
      toast({ variant: 'destructive', title: 'Inspector no identificado', description: 'Inicia online una vez para habilitar el modo offline.' });
      return;
    }

    const missing = [];
    if (!formData.cliente) missing.push('Cliente');
    if (!formData.instalacion) missing.push('Instalacion');

    // VALIDACIÓN (Relajamos para Admin si es edición)
    if (!isAdmin && gpsRequired && !formData.location) missing.push('Ubicacion GPS');
    if (!isAdmin && (!inspectorSignature || inspectorSignature.length < 100)) missing.push('Firma Inspector');

    if (missing.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Faltan Datos',
        description: `No se puede guardar sin: ${missing.join(', ')}`
      });
      return;
    }

    if (images.length > MAX_IMAGES_PER_REPORT) {
      toast({
        variant: 'destructive',
        title: 'Limite de imagenes',
        description: `Maximo ${MAX_IMAGES_PER_REPORT} imagenes por informe.`,
      });
      return;
    }

    let didStartSave = false;
    try {
      const inspectorInitials = resolveInitials(inspectorEmail);

      if (!inspectorInitials) {
        toast({ variant: 'destructive', title: 'Identificación Requerida', description: 'No se han detectado sus iniciales. Por favor, revise su perfil.' });
        return;
      }
      setSaving(true);
      didStartSave = true;

      // --- EDITING AN EXISTING COMPLETED/PRE-APPROVED REPORT ---
      if (isEditingExisting && savedDocId) {
        const existingDocId = savedDocId;
        const finalEstado = (formData as any).estado || (isAdmin ? 'Aprobado' : 'Registrado');
        const updatePayload: any = {
          ...formData,
          // ASEGURAR QUE NO SE SOBRESCRIBAN LOS CAMPOS DE AUTORIA ORIGINAL
          tecnicos: (initialData as any)?.tecnicos || (initialData as any)?.tecnicoNombre || (initialData as any)?.inspectorNombre || inspectorName,
          inspectorNombre: (initialData as any)?.inspectorNombre || (initialData as any)?.tecnicos || (initialData as any)?.tecnicoNombre || inspectorName,
          inspectorId: (initialData as any)?.inspectorId || (formData as any).inspectorId || inspectorEmail,

          parametrosTecnicos: {
            ...formData.parametrosTecnicos,
            horas: timeToDecimal(formData.parametrosTecnicos.horas)
          },
          estado: finalEstado,
          ultimaModificacion: Timestamp.now(),
          modificadoPorId: user?.email || inspectorEmail,
          modificadoPorNombre: inspectorName || user?.displayName || 'Inspector Energy Engine',
          ...(isAdmin && finalEstado === 'Aprobado' ? { aprobadoPor: 'Admin', fecha_aprobacion: Timestamp.now() } : {})
        };

        if (canUseCloud && firestore) {
          const storage = getStorage();
          const existingImageUrls = Array.isArray(formData.imageUrls) ? formData.imageUrls : [];
          const newImageUrls = images.length > 0
            ? await Promise.all(images.map(async (image, index) => {
              const extension = image.name.split('.').pop() || 'jpg';
              const fileName = `${existingDocId}_img_${existingImageUrls.length + index}.${extension}`;
              const imageRef = ref(storage, `informes/${existingDocId}/${fileName}`);
              const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(image);
              });
              await uploadString(imageRef, base64, 'data_url');
              return getDownloadURL(imageRef);
            }))
            : [];
          const mergedImageUrls = [...existingImageUrls, ...newImageUrls];
          updatePayload.imageUrls = mergedImageUrls;

          let inspectorSignatureUrl = (formData as any).inspectorSignatureUrl || inspectorSignature;
          if (inspectorSignature && inspectorSignature.startsWith('data:')) {
            const signatureRef = ref(storage, `firmas/${existingDocId}/inspector.png`);
            await uploadString(signatureRef, inspectorSignature, 'data_url');
            inspectorSignatureUrl = await getDownloadURL(signatureRef);
          }

          updatePayload.inspectorSignatureUrl = inspectorSignatureUrl;
          updatePayload.clientSignatureUrl = clientSignature || null;

          await updateDoc(doc(firestore, 'informes', existingDocId), updatePayload);



          setIsSaved(true);
          toast({ title: '¡Documento Actualizado!', description: `Informe ${existingDocId} guardado como ${finalEstado}.` });
        } else {
          // --- MODO OFFLINE: GUARDAR EN INDEXEDDB Y COLA DE SYNC ---
          const localData = {
            ...updatePayload,
            inspectorSignatureUrl: inspectorSignature,
            clientSignatureUrl: clientSignature,
            isOfflineUpdate: true,
            formType: 'informe-tecnico',
            numero_informe: existingDocId
          };

          // Guardar las nuevas imágenes offline en la tabla de imágenes vinculadas al informe
          const imageIds: number[] = [];
          for (const image of images) {
            const base64 = await fileToBase64(image);
            const imgId = await dbLocal.imagenes.add({
              reportId: existingDocId,
              base64Data: base64,
              fileName: image.name,
              mimeType: image.type,
              synced: false,
              createdAt: new Date(),
            });
            imageIds.push(imgId);
          }
          localData.imageIds = imageIds;

          const existingLocal = await dbLocal.hojas_trabajo.where('firebaseId').equals(existingDocId).first();
          if (existingLocal) {
            await dbLocal.hojas_trabajo.update(existingLocal.id!, { data: localData, synced: false });
          } else {
            await dbLocal.hojas_trabajo.add({
              firebaseId: existingDocId,
              synced: false,
              data: localData,
              createdAt: new Date(),
            });
          }

          const inQueue = await dbLocal.sync_queue.where('recordId').equals(existingDocId).first();
          if (!inQueue) {
            await dbLocal.sync_queue.add({
              recordId: existingDocId,
              recordType: 'hoja-trabajo',
              status: 'pending',
              retryCount: 0,
              lastError: '',
              createdAt: new Date(),
              lastRetry: new Date()
            });
          }

          setIsSaved(true);
          toast({ title: 'Cambios guardados (Offline)', description: 'Se sincronizarán al recuperar conexión.' });
        }

        handlePdfAction(true, existingDocId);
        setTimeout(() => {
          if (onSuccess) onSuccess();
        }, 1500);
        return;
      }

      const sequence = await getNextSequenceForUser({
        type: 'informe-tecnico',
        userEmail: currentEmail || '',
        firestore: canUseCloud ? firestore : null,
        isOnline: canUseCloud,
      });
      const year = new Date().getFullYear();
      const docId = `IT-${inspectorInitials}-${year}-${sequence.toString().padStart(4, '0')}`;
      const limitedImages = images.slice(0, MAX_IMAGES_PER_REPORT);

      const saveDataToLocal = async (
        synced: boolean,
        firebaseId: string,
        syncedImageUrls?: string[],
        syncedInspectorSignatureUrl?: string | null,
        syncedClientSignatureUrl?: string | null
      ) => {
        const localData: any = {
          ...formData,
          formType: 'informe-tecnico',
          orderId: initialData?.orderId || initialData?.id || null,
          numero_ot: initialData?.numero_ot || initialData?.id || null,
          originalJobId: initialData?.originalJobId || initialData?.orderId || initialData?.id || null,
          procedencia: (initialData?.numero_ot || initialData?.id?.startsWith('OT-')) ? 'OT' : 'INDEPENDIENTE',
          numero_informe: firebaseId,
          id: firebaseId,
          tecnicos: inspectorName,
          inspectorId: currentEmail || '',
          inspectorNombre: inspectorName,
          inspectorInitials,
          inspectorIds: currentEmail ? [currentEmail] : [],
          inspectorNombres: [inspectorName],
          fecha_creacion: new Date().toISOString(),
        };
        if (synced) {
          localData.imageUrls = syncedImageUrls || [];
          localData.inspectorSignatureUrl = syncedInspectorSignatureUrl || null;
          localData.clientSignatureUrl = syncedClientSignatureUrl || null;
        } else {
          localData.images = limitedImages;
          localData.inspectorSignature = inspectorSignature;
          localData.clientSignature = clientSignature;
        }
        if (!synced) {
          await dbLocal.hojas_trabajo.add({ firebaseId: firebaseId || '', synced, data: localData, createdAt: new Date() });
        }

        if (!synced) {
          const inQueue = await dbLocal.sync_queue.where('recordId').equals(firebaseId).first();
          if (!inQueue) {
            await dbLocal.sync_queue.add({
              recordId: firebaseId,
              recordType: 'hoja-trabajo',
              status: 'pending',
              retryCount: 0,
              lastError: '',
              createdAt: new Date(),
              lastRetry: new Date()
            });
          }
        }

        setSavedDocId(firebaseId || '');
        setIsSaved(true);

        if (synced) {
          toast({ title: 'Informe sincronizado', description: `Guardado con exito. ID: ${firebaseId}` });
        } else {
          toast({
            title: 'Guardado localmente',
            description: 'Error de red. Se sincronizara automaticamente despues.'
          });
        }

        handlePdfAction(true, firebaseId);

        setTimeout(() => {
          if (onSuccess) onSuccess();
        }, 1500);
      };

      if (canUseCloud && firestore && user?.email) {
        try {
          const storage = getStorage();

          const imageUrls = images.length > 0
            ? await Promise.all(limitedImages.map(async (image, index) => {
              const extension = image.name.split('.').pop() || 'jpg';
              const fileName = `${docId}_img_${index}.${extension}`;
              const imageRef = ref(storage, `informes/${docId}/${fileName}`);
              const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(image);
              });
              await uploadString(imageRef, base64, 'data_url');
              return getDownloadURL(imageRef);
            }))
            : Array.isArray(formData.imageUrls)
              ? formData.imageUrls
              : [];

          let inspectorSignatureUrl = (formData as any).inspectorSignatureUrl || null;
          if (inspectorSignature) {
            if (inspectorSignature.startsWith('data:')) {
              const signatureRef = ref(storage, `firmas/${docId}/inspector.png`);
              await uploadString(signatureRef, inspectorSignature, 'data_url');
              inspectorSignatureUrl = await getDownloadURL(signatureRef);
            } else {
              inspectorSignatureUrl = inspectorSignature;
            }
          }

          let clientSignatureUrl = (formData as any).clientSignatureUrl || null;
          if (clientSignature && clientSignature.startsWith('data:')) {
            const clientSignatureRef = ref(storage, `firmas/${docId}/cliente.png`);
            await uploadString(clientSignatureRef, clientSignature, 'data_url');
            clientSignatureUrl = await getDownloadURL(clientSignatureRef);
          }

          const docData = {
            ...formData,
            tecnicos: inspectorName, // Solo el inspector responsable
            parametrosTecnicos: {
              ...formData.parametrosTecnicos,
              horas: timeToDecimal(formData.parametrosTecnicos.horas)
            },
            imageUrls,
            inspectorSignatureUrl,
            clientSignatureUrl: clientSignatureUrl || null,
            inspectorId: inspectorEmail || '',
            inspectorNombre: inspectorName,
            inspectorInitials,
            inspectorIds: [inspectorEmail],
            inspectorNombres: [inspectorName],
            fecha_creacion: Timestamp.now(),
            formType: formData.formType || 'informe-tecnico',
            id: docId,
            numero_informe: docId,
            orderId: initialData?.orderId || initialData?.id || null,
            numero_ot: initialData?.numero_ot || initialData?.id || null,
            originalJobId: initialData?.originalJobId || initialData?.orderId || initialData?.id || null,
            procedencia: (initialData?.numero_ot || initialData?.id?.startsWith('OT-')) ? 'OT' : 'INDEPENDIENTE',
            estado: 'Registrado'
          };

          await setDoc(doc(firestore, 'informes', docId), docData);

          // Actualizar estado de la OT a 'En Proceso'
          if (docData.orderId) {
            await updateDoc(doc(firestore, 'ordenes_trabajo', docData.orderId), { estado: 'En Proceso' });
          }
          await saveDataToLocal(true, docId, imageUrls, inspectorSignatureUrl, clientSignatureUrl);
          pushCounterToCloud('informe-tecnico', currentEmail || '', firestore, sequence).catch(() => { });
        } catch (e) {
          console.error('Cloud save failed:', e);
          await saveDataToLocal(false, docId);
          pushCounterToCloud('informe-tecnico', currentEmail || '', firestore, sequence).catch(() => { });
        }
      } else {
        await saveDataToLocal(false, docId);
        if (firestore && currentEmail) {
          pushCounterToCloud('informe-tecnico', currentEmail, firestore, sequence).catch(() => { });
        }
      }
    } catch (error) {
      console.error('Error en guardado de informe tecnico:', error);
      if (isEditingExisting && savedDocId) {
        await queueOfflineReportUpdate({
          existingDocId: savedDocId,
          updatePayload: {
            ...formData,
            ultimaModificacion: Timestamp.now(),
            modificadoPorId: user?.email || inspectorEmail,
            modificadoPorNombre: inspectorName || user?.displayName || 'Inspector Energy Engine',
          },
          images,
          formType: 'informe-tecnico',
          inspectorSignature,
          clientSignature,
        });
        setIsSaved(true);
        toast({
          title: 'Cambios guardados localmente',
          description: 'No se pudo sincronizar ahora. Se subiran al recuperar conexion.',
        });
        handlePdfAction(true, savedDocId);
        return;
      }
      toast({
        variant: 'destructive',
        title: 'No se pudo guardar',
        description: 'Intente nuevamente. Si continua, revise conexion y permisos.',
      });
    } finally {
      if (didStartSave) setSaving(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto space-y-6 animate-in fade-in pb-20 bg-white min-h-screen px-4 pt-4">
      <Dialog open={!!previewPdfUrl} onOpenChange={(isOpen) => {
        if (!isOpen && previewPdfUrl) {
          URL.revokeObjectURL(previewPdfUrl);
          setPreviewPdfUrl(null);
        }
      }}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 rounded-[2.5rem] overflow-hidden border border-slate-200 bg-white text-slate-950 light">
          {/* SOLUCIÓN: Botón en cabecera */}
          <DialogHeader className="p-6 border-b border-slate-100 bg-white flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="font-black uppercase tracking-tighter text-black">Borrador Informe Técnico</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">Documento profesional para validación de intervenciones.</DialogDescription>
            </div>
            <button
              onClick={() => handlePdfAction(true)}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-primary/90 transition-all shadow-sm active:scale-95"
            >
              Descargar PDF
            </button>
          </DialogHeader>
          <div className="flex-1 bg-slate-100">
            {previewPdfUrl ? (
              <iframe src={previewPdfUrl} className="w-full h-full border-none" title="PDF Preview" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-100">
                <Loader2 className="animate-spin text-primary" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-black text-black border-l-4 border-primary pl-4 uppercase tracking-tighter">
            {isEditingExisting && savedDocId
              ? <span className="text-primary">Modificando <span className="text-emerald-700">{savedDocId}</span></span>
              : 'Informe Técnico'}
          </h2>
          <button
            type="button"
            onClick={toggleDictation}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${
              isListening ? 'bg-red-500 border-red-500 text-white animate-pulse' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-primary hover:text-black'
            }`}
          >
            {isListening ? <MicOff size={16} className="animate-bounce" /> : <Mic size={16} />}
            {isListening ? 'Detener' : 'Dictado'}
          </button>
        </div>

        {(initialData?.numero_ot || (initialData?.id && initialData.id.startsWith('OT-'))) ? (
          <div className="bg-primary/5 border border-primary/10 px-4 py-2 rounded-2xl flex items-center gap-3 animate-in fade-in zoom-in duration-500">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <ClipboardList size={16} className="text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-primary/60 uppercase tracking-widest leading-none">Vinculado a OT</span>
              <span className="text-xs font-black text-primary uppercase tracking-tight">
                {initialData.numero_ot || initialData.id}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-100 px-4 py-2 rounded-2xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
              <FileText size={16} className="text-slate-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Tipo de Informe</span>
              <span className="text-xs font-black text-slate-500 uppercase tracking-tight">
                INFORME INDEPENDIENTE
              </span>
            </div>
          </div>
        )}
      </div>

      <section className="bg-white p-5 md:p-8 rounded-[2rem] shadow-sm space-y-4 border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-2 text-left">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Cliente Base</label>
            <div className="bg-white border border-slate-100 rounded-2xl">
              <ClientSelector onSelect={handleClientSelect} selectedClientId={formData.clienteId} />
            </div>
          </div>
          <StableInput label="Motor" icon={Settings} value={formData.motor} onChange={(v: string) => handleInputChange('motor', v)} />
          <StableInput label="Modelo" icon={Type} value={formData.modelo} onChange={(v: string) => handleInputChange('modelo', v)} />
          <StableInput label="Nº de motor" icon={Type} value={formData.n_motor} onChange={(v: string) => handleInputChange('n_motor', v)} />
          <StableInput label="Nº Grupo" icon={Settings} value={formData.n_grupo} onChange={(v: string) => handleInputChange('n_grupo', v)} />
          <StableInput label="Potencia (KVA)" icon={Zap} value={formData.potencia} onChange={(v: string) => handleInputChange('potencia', v)} />
          <div className="md:col-span-2">
            <StableInput label="Instalación / Ubicación Específica" icon={MapPin} value={formData.instalacion} onChange={(v: string) => handleInputChange('instalacion', v)} />
          </div>
          <div className="md:col-span-2">
            <button
              onClick={handleCaptureLocation}
              disabled={locationStatus === 'loading'}
              className={`w-full p-4 border rounded-xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 text-xs 
                    ${formData.location ? 'border-emerald-500/50 text-emerald-500 bg-emerald-500/10' : 'border-slate-100 text-slate-400 hover:border-primary'}`}
            >
              {locationStatus === 'loading' ? <Loader2 className="animate-spin text-primary" size={14} /> : <MapPin size={14} />}
              <span>{formData.location ? `${formData.location.lat.toFixed(4)}, ${formData.location.lon.toFixed(4)}` : (gpsRequired ? 'CAPTURAR UBICACION GPS (REQUERIDO)' : 'CAPTURAR UBICACION GPS (OPCIONAL)')}</span>
            </button>
          </div>
        </div>
      </section>

      <section className="bg-white p-5 md:p-8 rounded-[2rem] shadow-sm space-y-4 border border-slate-100">
        <div className="flex justify-between items-center">
          <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Detalles de la Incidencia</h3>
          <button onClick={handleEnhanceReport} disabled={aiLoading} className="flex items-center gap-2 text-[8px] font-black bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors active:scale-95">
            {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
            {aiLoading ? 'ESTRUCTURANDO...' : 'IA ESTRUCTURAR'}
          </button>
        </div>
        <ObservationQuickPhrases
          value={formData.reportContent}
          onChange={(next) => handleInputChange('reportContent', next)}
        />
        <textarea
            className="w-full h-96 bg-slate-50 border border-slate-200 rounded-xl p-6 resize-none font-medium text-black outline-none focus:border-primary focus:bg-white transition-all shadow-inner leading-relaxed whitespace-pre-wrap"
            value={formData.reportContent}
            onChange={(e: any) => handleInputChange('reportContent', e.target.value)}
            placeholder="Describa los antecedentes, la intervención y la situación actual..."
            spellCheck="true"
            lang="es"
            autoCorrect="on"
            autoCapitalize="sentences"
          />
      </section>

      <section className="bg-white p-5 md:p-8 rounded-[2rem] shadow-sm space-y-4 border border-slate-100">
        <h2 className="text-lg font-black text-black flex items-center gap-2 uppercase tracking-tighter"><Camera className="text-primary" size={18} /> Registro Fotográfico</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="w-full cursor-pointer bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:bg-white hover:border-primary transition-all group active:scale-[0.99]">
            <Camera size={28} className="text-slate-300 mb-1.5 group-hover:text-primary transition-colors" />
            <span className="font-black text-slate-400 uppercase text-[10px] tracking-widest">Tomar Foto</span>
            <input type="file" multiple accept="image/*" capture="environment" className="hidden" onChange={handleImageChange} />
          </label>
          <label className="w-full cursor-pointer bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:bg-white hover:border-primary transition-all group active:scale-[0.99]">
            <FileSearch size={28} className="text-slate-300 mb-1.5 group-hover:text-primary transition-colors" />
            <span className="font-black text-slate-400 uppercase text-[10px] tracking-widest">Seleccionar Galería</span>
            <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
          </label>
        </div>
        {(images.length > 0 || existingImageUrls.length > 0) && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-2">
            {/* Guardadas */}
            {existingImageUrls.map((url, i) => (
              <div key={`existing-${i}`} className="aspect-square relative group overflow-hidden rounded-xl border border-slate-100 shadow-sm bg-slate-50">
                <img src={url} alt={`saved-preview ${i}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, imageUrls: (prev.imageUrls || []).filter((_, idx) => idx !== i) }))}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-600 text-white flex items-center justify-center transition-all active:scale-95 shadow-md z-10"
                  title="Eliminar foto"
                >
                  <X size={12} />
                </button>
                <span className="absolute bottom-1 left-1 bg-slate-900/60 text-white text-[8px] font-black uppercase px-1 py-0.5 rounded">Guardada</span>
              </div>
            ))}
            {/* Nuevas */}
            {images.map((file, i) => (
              <div key={`new-${i}`} className="aspect-square relative group overflow-hidden rounded-xl border border-slate-100 shadow-sm bg-slate-50">
                <img src={URL.createObjectURL(file)} alt={`new-preview ${i}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                <button
                  type="button"
                  onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-600 text-white flex items-center justify-center transition-all active:scale-95 shadow-md z-10"
                  title="Eliminar foto"
                >
                  <X size={12} />
                </button>
                <span className="absolute bottom-1 left-1 bg-primary/80 text-white text-[8px] font-black uppercase px-1 py-0.5 rounded">Nueva</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white p-5 md:p-8 rounded-[2rem] shadow-sm border border-slate-100">
        <SignaturePad title="Firma del Inspector" signature={inspectorSignature} onSignatureEnd={setInspectorSignature} showSavedSignature={true} />
        <p className="text-center font-black text-slate-400 text-[8px] uppercase tracking-widest mt-2">{inspectorName}</p>
      </section>

      {/* SOLUCIÓN: Botones Directos */}
      <div className="flex flex-col md:flex-row gap-3 pt-4">
        <button
          onClick={() => handlePdfAction(false)}
          disabled={pdfLoading}
          className="w-full p-4 bg-white border border-slate-200 rounded-[1.5rem] font-bold flex items-center justify-center gap-2 hover:border-primary transition-all text-slate-600 shadow-sm active:scale-95 disabled:opacity-50 text-xs"
        >
          {pdfLoading ? <Loader2 className="animate-spin text-primary" size={16} /> : <FileSearch size={16} className="text-primary" />}
          VISTA PREVIA
        </button>

        <button
          onClick={() => handlePdfAction(true)}
          disabled={pdfLoading}
          className="w-full p-4 bg-white border border-slate-200 rounded-[1.5rem] font-bold flex items-center justify-center gap-2 hover:border-primary transition-all text-black shadow-md active:scale-95 disabled:opacity-50 text-xs"
        >
          {pdfLoading ? <Loader2 className="animate-spin text-primary" size={16} /> : <Printer size={16} className="text-primary" />}
          {isSaved ? 'DESCARGAR PDF FINAL' : 'DESCARGAR BORRADOR'}
        </button>

        <button
          onClick={handleSave}
          disabled={saving || (isSaved && !isEditingExisting)}
          className="w-full p-4 bg-slate-900 text-white rounded-[1.5rem] font-black text-xs flex items-center justify-center gap-2 disabled:bg-slate-700 shadow-xl active:scale-95 transition-all"
        >
          {saving ? 'GUARDANDO DATOS...' : isSaved && !isEditingExisting ? <CheckCircle2 className="text-emerald-400" size={16} /> : <Save className="text-white" size={16} />}
          {saving ? 'GUARDANDO DATOS...' : isSaved && !isEditingExisting ? 'GUARDADO' : isEditingExisting ? 'GUARDAR CAMBIOS' : 'REGISTRAR TRABAJO'}
        </button>
      </div>

      {/* Botón flotante de dictado por voz */}
      <button
        type="button"
        onClick={toggleDictation}
        className={`fixed bottom-24 right-6 z-50 p-4 rounded-full shadow-2xl transition-all duration-300 active:scale-95 flex items-center justify-center ${
          isListening 
            ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse ring-4 ring-red-500/30' 
            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 hover:shadow-emerald-700/40 ring-4 ring-emerald-500/10'
        }`}
        title={isListening ? 'Detener dictado' : 'Iniciar dictado'}
      >
        {isListening ? (
          <MicOff className="h-6 w-6 animate-bounce" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
      </button>
    </main>
  );
}
