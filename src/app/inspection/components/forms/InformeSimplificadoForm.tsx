'use client';
import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, Timestamp, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { Loader2, Save, FileSearch, Printer, CheckCircle2, User, Users, MapPin, Settings, Type, Hash, Calendar, Clock, Wind, Gauge, Thermometer, Droplets, Battery, Zap, Wrench, Camera, ClipboardList, FileText, Image as ImageIcon, Mic, MicOff, Wand2, X } from 'lucide-react';
import { ProcessDictationOutput, processDictation } from '@/ai/flows/process-dictation-flow';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import SignaturePad from '../SignaturePad';
import { INITIAL_FORM_DATA } from '../../lib/form-constants';
import { getStorage, ref, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { db as dbLocal } from '@/lib/db-local';
import { drawPdfHeader, drawPdfFooter } from '../../lib/pdf-helpers';
import { useToast } from '@/hooks/use-toast';
import { useGpsRequired } from '@/hooks/use-gps-required';
import ClientSelector from '../ClientSelector';
import StableInput from '../StableInput';
import { resolveInspectorEmail } from '@/lib/inspection-mode';
import { resolveInitials, saveTechnicianInfo, getTechnicianName } from '@/lib/technician-utils';
import { getNextSequenceForUser, pushCounterToCloud } from '@/lib/sequence-manager';
import { addImageSafely, getPdfFileName, normalizeReportForPdf, renderImageGallery } from '@/lib/pdf-utils';
import { MAX_IMAGES_PER_REPORT } from '@/lib/report-limits';
import { getCreationReportId, getLinkedOrderId, getSafeReportId } from '../../lib/report-record';
import { clearLegacyStoredSignature, clearStoredSignatureForEmail, getStoredSignatureForEmail, setStoredSignatureForEmail } from '@/lib/signature-storage';
import { fileToBase64 } from '@/lib/offline-utils';
import ObservationQuickPhrases from './ObservationQuickPhrases';

const SIMPLIFIED_CHECKLIST_ITEMS = [
  "Filtro de aceite",
  "Filtro de combustible",
  "Filtro de agua",
  "Filtro de aire",
  "Prefiltro de aceite",
  "Prefiltro de combustible",
  "Filtro de aceite bypass",
  "Otros"
];



const LoadTestInput = React.memo(({ label, value, onChange }: any) => (
  <div className="flex flex-col items-center gap-1">
    <label className="text-[8px] font-black text-slate-500 w-full text-center">{label}</label>
    <input
      type="text" value={value || ''} onChange={e => onChange(e.target.value)}
      className="w-full bg-slate-100 border border-slate-200 rounded-lg p-1.5 outline-none focus:border-primary focus:bg-white transition-all font-bold text-black shadow-sm text-xs text-center"
    />
  </div>
));

export const generatePDF = async (reportRaw: any, inspectorName: string, reportId: string | null) => {
  const report = await normalizeReportForPdf(reportRaw);
  const doc = new jsPDF();
  const finalID = getSafeReportId(reportId) || 'BORRADOR';
  const darkColor = '#165a30';
  const bodyColor = '#111111';
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  const leftMargin = 25.4;
  const rightMargin = 25.4;
  const topMargin = 40;
  const bottomMargin = 25.4;
  const contentWidth = pageWidth - leftMargin - rightMargin;
  const globalMargin = { top: topMargin, bottom: bottomMargin, left: leftMargin, right: rightMargin };

  let currentY = topMargin;

  try {
    doc.setTextColor(darkColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const individualID = getSafeReportId(report.numero_informe) || report.individualId || '';
    const displayID = (individualID && individualID !== finalID && finalID !== 'BORRADOR') 
      ? `${finalID} (${individualID})` 
      : finalID;
    doc.text("INFORME SIMPLIFICADO", leftMargin, currentY);
    doc.setFontSize(12);
    doc.text(`Nº: ${displayID}`, pageWidth - rightMargin, currentY, { align: 'right' });
    currentY += 6;

    autoTable(doc, {
      startY: currentY,
      body: [
        [{ content: 'CLIENTE:', styles: { fontStyle: 'bold', cellWidth: 35 } }, { content: report.clienteNombre || report.cliente || '', colSpan: 3 }],
        [{ content: 'INSTALACIÓN:', styles: { fontStyle: 'bold' } }, { content: report.instalacion || '', colSpan: 3 }],
        [{ content: 'DIRECCIÓN:', styles: { fontStyle: 'bold' } }, { content: report.direccion || '', colSpan: 3 }],
        [{ content: 'UBICACIÓN (LAT/LON):', styles: { fontStyle: 'bold' } }, { content: report.location ? `${report.location.lat.toFixed(6)}, ${report.location.lon.toFixed(6)}` : 'No registrada', colSpan: 3 }],
        [{ content: 'FECHA REVISIÓN:', styles: { fontStyle: 'bold' } }, report.fecha_revision || '', { content: 'POTENCIA:', styles: { fontStyle: 'bold', cellWidth: 30 } }, report.potencia || ''],
        [{ content: 'MOTOR:', styles: { fontStyle: 'bold' } }, report.motor || '', { content: 'Nº MOTOR:', styles: { fontStyle: 'bold' } }, report.n_motor || ''],
        [{ content: 'MODELO:', styles: { fontStyle: 'bold' } }, report.modelo || '', { content: 'Nº GRUPO:', styles: { fontStyle: 'bold' } }, report.n_grupo || ''],
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2, textColor: bodyColor },
      margin: globalMargin
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;

    autoTable(doc, {
      startY: currentY,
      head: [['RECAMBIOS Y MATERIALES', 'OK', 'DEFECT', 'CAMBIO']],
      body: SIMPLIFIED_CHECKLIST_ITEMS.map(item => [
        item,
        report.recambios_checklist?.[item] === 'OK' ? 'X' : '',
        report.recambios_checklist?.[item] === 'DEFECT' ? 'X' : '',
        report.recambios_checklist?.[item] === 'CAMBIO' ? 'X' : '',
      ]),
      theme: 'grid',
      didParseCell: function (data) {
        const item = (data.row.raw as any[])[0] as string;
        const status = report.recambios_checklist?.[item];
        if (status === 'DEFECT') data.cell.styles.fillColor = '#fee2e2';
        if (status === 'CAMBIO') data.cell.styles.fillColor = '#dcfce7';
      },
      styles: { fontSize: 8, cellPadding: 1.5, halign: 'center', textColor: bodyColor },
      headStyles: { fillColor: darkColor, textColor: '#fff', halign: 'center' },
      columnStyles: { 0: { halign: 'left' }, 1: { cellWidth: 28 }, 2: { cellWidth: 28 }, 3: { cellWidth: 28 } },
      margin: globalMargin
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;

    autoTable(doc, {
      startY: currentY,
      body: [
        [{ content: 'DATOS DE PRUEBAS', styles: { fontStyle: 'bold', fillColor: darkColor, textColor: '#fff' } }, { content: 'VALORES', styles: { fontStyle: 'bold', fillColor: darkColor, textColor: '#fff' } }],
        // PROTECCIÓN 1
        ['Horas de funcionamiento', report.datos_pruebas?.horas || ''],
        ['Presión aceite', report.datos_pruebas?.presion || ''],
        ['Temperatura en bloque motor', report.datos_pruebas?.temperatura || ''],
        ['Nivel de deposito de combustible', report.datos_pruebas?.nivel_combustible || ''],
        ['Tensión en el alternador', report.datos_pruebas?.tension_alternador || ''],
        ['Frecuencia', report.datos_pruebas?.frecuencia || ''],
        ['Carga de baterías', report.datos_pruebas?.carga_baterias || ''],
        [{ content: 'PRUEBAS CON CARGA', colSpan: 2, styles: { fontStyle: 'bold', fillColor: '#f1f5f9' } }],
        // PROTECCIÓN 2
        [{ content: `Tensión: RS: ${report.pruebas_carga?.tension_rs || ''}   ST: ${report.pruebas_carga?.tension_st || ''}   RT: ${report.pruebas_carga?.tension_rt || ''}`, colSpan: 2 }],
        [{ content: `Intensidad: R: ${report.pruebas_carga?.intensidad_r || ''}   S: ${report.pruebas_carga?.intensidad_s || ''}   T: ${report.pruebas_carga?.intensidad_t || ''}`, colSpan: 2 }],
        [{ content: `Potencia: ${report.pruebas_carga?.potencia_kw || ''} kW`, colSpan: 2 }],
      ],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, textColor: bodyColor },
      margin: globalMargin
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;

    const observationsText = String(report.observaciones || '').trim();
    if (observationsText) {
      if (currentY + 15 > pageHeight - bottomMargin) {
        doc.addPage();
        currentY = topMargin;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(bodyColor);
      doc.text("OBSERVACIONES", leftMargin, currentY);
      currentY += 7;

      autoTable(doc, {
        startY: currentY,
        body: observationsText.split('\n').map((line: string) => [line.trim() || ' ']),
        theme: 'plain',
        styles: { font: 'helvetica', fontStyle: 'normal', fontSize: 11, cellPadding: 0, halign: 'justify', textColor: bodyColor },
        columnStyles: { 0: { cellWidth: contentWidth } },
        margin: globalMargin
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    const signatureBlockHeight = 48;
    if (currentY + signatureBlockHeight > pageHeight - bottomMargin) { doc.addPage(); currentY = topMargin; }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(bodyColor);
    doc.text("Atentamente,", leftMargin, currentY);
    addImageSafely(doc, report.inspectorSignatureUrl, leftMargin, currentY + 6, 50, 18);
    doc.line(leftMargin, currentY + 25, leftMargin + 50, currentY + 25);
    doc.text(report.tecnicos || inspectorName || '', leftMargin, currentY + 32);
    doc.text("Inspector Técnico", leftMargin, currentY + 38);

    if (report.includeClientSignature) {
      const clientSignatureX = pageWidth - rightMargin - 50;
      addImageSafely(doc, report.clientSignatureUrl, clientSignatureX, currentY + 6, 50, 18);
      doc.line(clientSignatureX, currentY + 25, clientSignatureX + 50, currentY + 25);
      doc.text("Conforme cliente:", clientSignatureX, currentY + 32);
      doc.text(report.recibidoPor || '', clientSignatureX, currentY + 38);
    }

    // --- REGISTRO FOTOGRÁFICO ---
    if (report.imageUrls && report.imageUrls.length > 0) {
      renderImageGallery(doc, report.imageUrls);
    }

    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i); drawPdfHeader(doc); drawPdfFooter(doc, i, totalPages, report.individualId);
    }
  } catch (err) {
    console.error("Fallo al generar PDF Simplificado:", err);
  }
  return doc;
};


export default function InformeSimplificadoForm({ 
  initialData, aiData, onSuccess, isAdmin = false, userFullName, effectiveEmail 
}: { 
  initialData: any, aiData: ProcessDictationOutput | null, onSuccess: () => void, isAdmin?: boolean, userFullName?: string, effectiveEmail?: string | null 
}) {
  const { user } = useUser();
  const firestore = useFirestore();
  const isOnline = useOnlineStatus();
  const inspectorEmail = resolveInspectorEmail(user?.email || '');
  const currentEmail = effectiveEmail || inspectorEmail;
  const canUseCloud = isOnline && !!firestore && !!user?.email;
  const { toast } = useToast();
  const [inspectorName, setInspectorName] = useState('');
  const [inspectorInitials, setInspectorInitials] = useState('');
  const [images, setImages] = useState<any[]>([]);

  const [formData, setFormData] = useState<any>({
    ...INITIAL_FORM_DATA,
    formType: 'informe-simplificado',
    recambios_checklist: {},
  });

  const [inspectorSignature, setInspectorSignature] = useState<string | null>(null);
  const [clientSignature, setClientSignature] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedDocId, setSavedDocId] = useState('');
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isListening, setIsListening] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [includeClientSignature, setIncludeClientSignature] = useState(false);
  const gpsRequired = useGpsRequired();

  const creationReportId = getCreationReportId(initialData);
  const linkedOrderId = getLinkedOrderId(initialData) || getLinkedOrderId(formData);

  // Detect if we're editing an existing completed/preapproved report
  const isEditingExisting = !!(initialData?.estado && ['Registrado', 'Aprobado'].includes(initialData.estado) && creationReportId);

  useEffect(() => {
    const currentEmail = effectiveEmail || inspectorEmail;
    clearLegacyStoredSignature();

    if (currentEmail) {
      const initials = resolveInitials(currentEmail);
      setInspectorInitials(initials);

      // --- LOGICA DE AUTORIA BLINDADA ---
      if (!isEditingExisting) {
        const localSig = getStoredSignatureForEmail(currentEmail);
        setInspectorSignature(localSig);

        if (canUseCloud && firestore) {
          getDoc(doc(firestore, 'usuarios', currentEmail)).then(snap => {
            if (snap.exists()) {
              const data = snap.data();
              setInspectorName(data.nombre || '');
              if (data.firmaUrl) {
                setInspectorSignature(data.firmaUrl);
                setStoredSignatureForEmail(currentEmail, data.firmaUrl);
              } else {
                setInspectorSignature(null);
                clearStoredSignatureForEmail(currentEmail);
              }
            }
          }).catch((e: any) => console.error(e));
        } else {
          dbLocal.table('seguridad').get(currentEmail).then(cached => {
            if (cached?.nombre) setInspectorName(cached.nombre);
            if (cached?.signatureBase64 && !localSig) setInspectorSignature(cached.signatureBase64);
          });
        }
      }
    }
  }, [canUseCloud, effectiveEmail, firestore, inspectorEmail, isEditingExisting]);

  useEffect(() => {
    if (initialData) {
      if (initialData.estado && ['Registrado', 'Aprobado'].includes(initialData.estado)) {
        // Al editar un informe existente, preservamos EL NOMBRE DEL AUTOR ORIGINAL
        const originalAuthor = initialData.inspectorNombre || initialData.tecnicos || initialData.tecnicoNombre || '';
        if (originalAuthor) {
          setInspectorName(originalAuthor);
        }

        setFormData((prev: any) => ({
          ...prev,
          ...initialData,
          clienteId: initialData.clienteId || prev.clienteId,
          cliente: initialData.clienteNombre || initialData.cliente || prev.cliente,
          clienteNombre: initialData.clienteNombre || initialData.cliente || prev.clienteNombre,
          numero_informe: creationReportId || prev.numero_informe,
          datos_pruebas: {
            ...initialData.datos_pruebas,
            horas: initialData.datos_pruebas?.horas != null ? String(initialData.datos_pruebas.horas) : '',
          }
        }));
        if (initialData.inspectorSignatureUrl) setInspectorSignature(initialData.inspectorSignatureUrl);
        if (initialData.clientSignatureUrl) setClientSignature(initialData.clientSignatureUrl);
        setSavedDocId(creationReportId || '');
      } else {
        setFormData((prev: any) => ({
          ...prev,
          clienteId: initialData.clienteId || prev.clienteId,
          cliente: initialData.clienteNombre || initialData.cliente || prev.cliente,
          clienteNombre: initialData.clienteNombre || initialData.cliente || prev.clienteNombre,
          instalacion: initialData.instalacion || prev.instalacion,
          direccion: initialData.direccion || prev.direccion,
          motor: initialData.modelo || prev.motor || '',
          modelo: initialData.n_motor || prev.modelo || '',
          n_motor: initialData.n_motor || prev.n_motor || '',
          potencia: initialData.potencia || prev.potencia || '',
          observaciones: initialData.descripcion || prev.observaciones || '',
          orderId: linkedOrderId || prev.orderId,
          originalJobId: linkedOrderId || prev.originalJobId,
          estado: 'Registrado',
        }));
      }
    }
  }, [initialData]);

  useEffect(() => {
    if (aiData) {
      setFormData((prev: any) => {
        const newCheck = { ...prev.recambios_checklist, ...aiData.checklist_updates };
        if (aiData.all_ok) { SIMPLIFIED_CHECKLIST_ITEMS.forEach(it => { if (!newCheck[it]) newCheck[it] = 'OK'; }); }
        return {
          ...prev,
          cliente: aiData.identidad.cliente || prev.cliente,
          instalacion: aiData.identidad.instalacion || prev.instalacion,
          direccion: aiData.identidad.direccion || prev.direccion,
          motor: aiData.identidad.modelo || prev.motor,
          modelo: aiData.identidad.marca || prev.modelo,
          n_motor: aiData.identidad.sn || prev.n_motor,
          n_grupo: aiData.identidad.n_grupo || prev.n_grupo,
          potencia: aiData.identidad.potencia_kva || prev.potencia,
          recibidoPor: aiData.identidad.recibe || prev.recibidoPor,
          observaciones: aiData.observations_summary || prev.observaciones,
          recambios_checklist: newCheck,
          // PROTECCIÓN 3 IA
          datos_pruebas: {
            horas: aiData.mediciones_generales?.horas || prev.datos_pruebas.horas,
            presion: aiData.mediciones_generales?.presion || prev.datos_pruebas.presion,
            temperatura: aiData.mediciones_generales?.temp || prev.datos_pruebas.temperatura,
            nivel_combustible: aiData.mediciones_generales?.combustible || prev.datos_pruebas.nivel_combustible,
            tension_alternador: aiData.mediciones_generales?.tensionAlt || prev.datos_pruebas.tension_alternador,
            frecuencia: aiData.mediciones_generales?.frecuencia || prev.datos_pruebas.frecuencia,
            carga_baterias: aiData.mediciones_generales?.cargaBat || prev.datos_pruebas.carga_baterias,
          },
          pruebas_carga: {
            tension_rs: aiData.pruebas_carga?.rs || prev.pruebas_carga.tension_rs,
            tension_st: aiData.pruebas_carga?.st || prev.pruebas_carga.tension_st,
            tension_rt: aiData.pruebas_carga?.rt || prev.pruebas_carga.tension_rt,
            intensidad_r: aiData.pruebas_carga?.r || prev.pruebas_carga.intensidad_r,
            intensidad_s: aiData.pruebas_carga?.s || prev.pruebas_carga.intensidad_s,
            intensidad_t: aiData.pruebas_carga?.t || prev.pruebas_carga.intensidad_t,
            potencia_kw: aiData.pruebas_carga?.kw || prev.pruebas_carga.potencia_kw,
          }
        };
      });
    }
  }, [aiData]);

  const handleInputChange = (f: string, v: any) => setFormData((p: any) => ({ ...p, [f]: v }));
  const handleNestedChange = (s: string, f: string, v: string) => setFormData((p: any) => ({ ...p, [s]: { ...p[s], [f]: v } }));
  const handleChecklistChange = (it: string, st: string) => setFormData((p: any) => ({ ...p, recambios_checklist: { ...p.recambios_checklist, [it]: st } }));
  const handleClientSelect = (client: any) => {
    setFormData((p: any) => ({
      ...p,
      clienteId: client.id,
      cliente: client.nombre,
      clienteNombre: client.nombre
    }));
  };

  const handleCaptureLocation = () => {
    if (!navigator.geolocation) return setLocationStatus('error');
    setLocationStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handleInputChange('location', { lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocationStatus('success');
        toast({ title: 'GPS OK', description: 'Ubicación registrada.' });
      },
      (error) => {
        setLocationStatus('error');
        let msg = 'Active permisos de ubicación.';
        if (error.code === error.TIMEOUT) msg = 'Tiempo de espera agotado buscando GPS.';
        toast({ variant: 'destructive', title: 'GPS Fallido', description: msg });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, source: 'camera' | 'gallery') => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files).map(file => ({ file, source }));
    if (images.length + selected.length > MAX_IMAGES_PER_REPORT) {
      toast({
        variant: 'destructive',
        title: 'Limite de imagenes',
        description: `Maximo ${MAX_IMAGES_PER_REPORT} imagenes por informe.`,
      });
      return;
    }
    setImages((prev) => [...prev, ...selected]);
  };

  const handlePdfAction = (forceDownload = false, docIdOverride?: string) => {
    if (!formData.cliente || !formData.instalacion) {
      toast({ variant: 'destructive', title: 'Faltan Datos', description: 'Complete campos principales para previsualizar.' });
      return;
    }
    setPdfLoading(true);
    try {
      const reportData = {
        ...formData,
        includeClientSignature,
        inspectorSignatureUrl: inspectorSignature,
        clientSignatureUrl: includeClientSignature ? clientSignature : null,
        imageUrls: [
          ...(formData.imageUrls || []),
          ...images.map(img => img.file)
        ],
      };
      const finalId = getSafeReportId(formData.numero_informe) || getSafeReportId(docIdOverride) || (isSaved ? getSafeReportId(savedDocId) : '') || 'BORRADOR';
      generatePDF(reportData, inspectorName, finalId).then(docPdf => {
        if (isSaved || forceDownload) {
          // SOLUCIÓN: FORZAR .pdf
          docPdf.save(`${finalId}.pdf`);
        } else {
          const blob = docPdf.output('blob');
          const url = URL.createObjectURL(blob);
          setPreviewPdfUrl(url);
        }
      }).catch(err => {
        console.error("Error PDF:", err);
        toast({ variant: 'destructive', title: 'Error PDF', description: 'Fallo al generar el documento' });
      }).finally(() => {
        setPdfLoading(false);
      });
    } catch (e) {
      console.error("Fallo PDF:", e);
      toast({ variant: 'destructive', title: 'Error PDF' });
      setPdfLoading(false);
    }
  };

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
        toast({ variant: 'destructive', title: 'Error', description: 'Tu navegador no soporta dictado por voz.' });
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
            observaciones: prev.observaciones ? `${prev.observaciones}\n${finalTranscript}` : finalTranscript,
          }));
        }
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      
      recognitionRef.current = recognition;
      recognition.start();
    }
  };


  const handleEnhanceReport = async () => {
    if (!formData.observaciones) return;
    setAiLoading(true);
    try {
      const res = await processDictation({ dictation: formData.observaciones });
      setFormData((prev: any) => {
        const newCheck = { ...prev.recambios_checklist, ...res.checklist_updates };
        if (res.all_ok) {
          SIMPLIFIED_CHECKLIST_ITEMS.forEach(it => {
            if (!newCheck[it]) newCheck[it] = 'OK';
          });
        }
        return {
          ...prev,
          cliente: res.identidad.cliente || prev.cliente,
          instalacion: res.identidad.instalacion || prev.instalacion,
          direccion: res.identidad.direccion || prev.direccion,
          motor: res.identidad.marca || prev.motor,
          modelo: res.identidad.modelo || prev.modelo,
          n_motor: res.identidad.sn || prev.n_motor,
          n_grupo: res.identidad.n_grupo || prev.n_grupo,
          potencia: res.identidad.potencia_kva || prev.potencia,
          recibidoPor: res.identidad.recibe || prev.recibidoPor,
          observaciones: res.observations_summary || prev.observaciones,
          recambios_checklist: newCheck,
          datos_pruebas: {
            ...prev.datos_pruebas,
            horas: res.mediciones_generales?.horas || prev.datos_pruebas.horas,
            presion: res.mediciones_generales?.presion || prev.datos_pruebas.presion,
            temperatura: res.mediciones_generales?.temp || prev.datos_pruebas.temperatura,
            nivel_combustible: res.mediciones_generales?.combustible || prev.datos_pruebas.nivel_combustible,
            tension_alternador: res.mediciones_generales?.tensionAlt || prev.datos_pruebas.tension_alternador,
            frecuencia: res.mediciones_generales?.frecuencia || prev.datos_pruebas.frecuencia,
            carga_baterias: res.mediciones_generales?.cargaBat || prev.datos_pruebas.carga_baterias,
          },
          pruebas_carga: {
            ...prev.pruebas_carga,
            tension_rs: res.pruebas_carga?.rs || prev.pruebas_carga.tension_rs,
            tension_st: res.pruebas_carga?.st || prev.pruebas_carga.tension_st,
            tension_rt: res.pruebas_carga?.rt || prev.pruebas_carga.tension_rt,
            intensidad_r: res.pruebas_carga?.r || prev.pruebas_carga.intensidad_r,
            intensidad_s: res.pruebas_carga?.s || prev.pruebas_carga.intensidad_s,
            intensidad_t: res.pruebas_carga?.t || prev.pruebas_carga.intensidad_t,
            potencia_kw: res.pruebas_carga?.kw || prev.pruebas_carga.potencia_kw,
          }
        };
      });
      toast({ title: '¡Reporte Mejorado!', description: 'La IA ha estructurado el texto y extraído los campos.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error de IA', description: 'No se pudo procesar con IA. Use texto manual.' });
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    if (!inspectorEmail) {
      toast({ variant: 'destructive', title: 'Inspector no identificado', description: 'Inicia online una vez para habilitar el modo offline.' });
      return;
    }
    if (isSaved && !isEditingExisting) return;

    const missing = [];
    if (!formData.cliente) missing.push('Cliente');
    if (!formData.instalacion) missing.push('Instalacion');

    // VALIDACIÓN (Relajamos para Admin si es edición)
    if (!isAdmin && gpsRequired && !formData.location) missing.push('Ubicacion GPS');
    if (!isAdmin && (!inspectorSignature || inspectorSignature.length < 100)) missing.push('Firma Inspector');
    if (!isAdmin && includeClientSignature && (!clientSignature || clientSignature.length < 100)) missing.push('Firma Cliente');

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
          tecnicos: initialData.tecnicos || initialData.tecnicoNombre || initialData.inspectorNombre || formData.tecnicos,
          inspectorNombre: initialData.inspectorNombre || initialData.tecnicos || initialData.tecnicoNombre || (formData as any).inspectorNombre,
          inspectorId: initialData.inspectorId || (formData as any).inspectorId,
          datos_pruebas: {
            ...formData.datos_pruebas,
            horas: formData.datos_pruebas.horas || ''
          },
          estado: finalEstado,
          ultimaModificacion: Timestamp.now(),
          modificadoPorId: effectiveEmail || inspectorEmail,
          modificadoPorNombre: userFullName || 'Técnico Energy Engine',
          ...(isAdmin && finalEstado === 'Aprobado' ? { aprobadoPor: 'Admin', fecha_aprobacion: Timestamp.now() } : {})
        };

        if (canUseCloud && firestore) {
          const storage = getStorage();

          // Subir nuevas imágenes al Storage
          const getExtension = (filename: string) => {
            const parts = filename.split('.');
            return parts.length > 1 ? `.${parts.pop()}` : '.jpg';
          };
          const limitedImages = images.slice(0, MAX_IMAGES_PER_REPORT);
          const newImageUrls = await Promise.all(limitedImages.map(async (image, index) => {
            const fileName = image.source === 'camera'
              ? `camara_${Date.now()}_${index}${getExtension(image.file.name)}`
              : `galeria_${image.file.name}`;
            const imgRef = ref(storage, `informes/${existingDocId}/${fileName}`);
            await uploadBytes(imgRef, image.file);
            return getDownloadURL(imgRef);
          }));

          const finalImageUrls = [...(formData.imageUrls || []), ...newImageUrls];
          updatePayload.imageUrls = finalImageUrls;

          let inspectorSignatureUrl = (formData as any).inspectorSignatureUrl || inspectorSignature;
          if (inspectorSignature && inspectorSignature.startsWith('data:')) {
            const sRef = ref(storage, `firmas/${existingDocId}/inspector.png`);
            await uploadString(sRef, inspectorSignature, 'data_url');
            inspectorSignatureUrl = await getDownloadURL(sRef);
          }
          let clientSignatureUrl = (formData as any).clientSignatureUrl || clientSignature;
          if (clientSignature && clientSignature.startsWith('data:')) {
            const cRef = ref(storage, `firmas/${existingDocId}/cliente.png`);
            await uploadString(cRef, clientSignature, 'data_url');
            clientSignatureUrl = await getDownloadURL(cRef);
          }

          updatePayload.inspectorSignatureUrl = inspectorSignatureUrl;
          updatePayload.clientSignatureUrl = clientSignatureUrl;

          await updateDoc(doc(firestore, 'informes', existingDocId), updatePayload);
          setIsSaved(true);
          toast({ title: '¡Documento Actualizado!', description: `Informe ${existingDocId} guardado como ${finalEstado}.` });
        } else {
          // --- MODO OFFLINE: GUARDAR EN INDEXEDDB Y COLA DE SYNC ---
          const limitedImages = images.slice(0, MAX_IMAGES_PER_REPORT);
          const getExtension = (filename: string) => {
            const parts = filename.split('.');
            return parts.length > 1 ? `.${parts.pop()}` : '.jpg';
          };
          const base64Promises = limitedImages.map(async (image, index) => {
            const base64 = await fileToBase64(image.file);
            const name = image.source === 'camera'
              ? `camara_${Date.now()}_${index}${getExtension(image.file.name)}`
              : `galeria_${image.file.name}`;
            return { name, base64 };
          });
          const imagesBase64 = await Promise.all(base64Promises);

          const localData = {
            ...updatePayload,
            inspectorSignatureUrl: inspectorSignature,
            clientSignatureUrl: clientSignature,
            imagesBase64,
            isOfflineUpdate: true
          };

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
        type: 'informe-simplificado',
        userEmail: currentEmail || '',
        firestore: canUseCloud ? firestore : null,
        isOnline: canUseCloud,
      });
      const year = new Date().getFullYear();
      const docId = `IS-${inspectorInitials}-${year}-${sequence.toString().padStart(4, '0')}`;
      const limitedImages = images.slice(0, MAX_IMAGES_PER_REPORT);



      const saveDataToLocal = async (
        synced: boolean,
        firebaseId: string,
        customImageUrls?: string[],
        customInspectorSigUrl?: string | null,
        customClientSigUrl?: string | null
      ) => {
        const localData: any = {
          ...formData,
          orderId: linkedOrderId || null,
          numero_ot: linkedOrderId || null,
          procedencia: linkedOrderId ? 'OT' : 'INDEPENDIENTE',
          numero_informe: firebaseId,
          imageUrls: customImageUrls || formData.imageUrls || [],
          inspectorSignatureUrl: customInspectorSigUrl || inspectorSignature || null,
          clientSignatureUrl: customClientSigUrl || clientSignature || null,
          id: firebaseId,
          tecnicos: inspectorName,
          inspectorId: currentEmail || '',
          inspectorNombre: inspectorName,
          inspectorInitials,
          inspectorIds: currentEmail ? [currentEmail] : [],
          inspectorNombres: [inspectorName],
          fecha_creacion: new Date().toISOString(),
        };

        if (!synced) {
          const getExtension = (filename: string) => {
            const parts = filename.split('.');
            return parts.length > 1 ? `.${parts.pop()}` : '.jpg';
          };
          const base64Promises = limitedImages.map(async (image, index) => {
            const base64 = await fileToBase64(image.file);
            const name = image.source === 'camera'
              ? `camara_${Date.now()}_${index}${getExtension(image.file.name)}`
              : `galeria_${image.file.name}`;
            return { name, base64 };
          });
          localData.imagesBase64 = await Promise.all(base64Promises);
          localData.inspectorSignature = inspectorSignature;
          localData.clientSignature = clientSignature;

          // Añadir a la cola de sincronización si no está ya
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

        if (!synced) {
          await dbLocal.hojas_trabajo.add({ firebaseId: firebaseId || '', synced, data: localData, createdAt: new Date() });
        }

        setSavedDocId(firebaseId || '');
        setIsSaved(true);

        if (synced) toast({ title: 'Guardado', description: `Documento ID: ${firebaseId}` });
        else toast({ title: 'Guardado local', description: 'Se sincronizara al recuperar red.' });

        handlePdfAction(true, firebaseId);
        setTimeout(() => {
          if (onSuccess) onSuccess();
        }, 1500);
      };

      if (canUseCloud && firestore && user.email) {
        try {
          const storage = getStorage();

          const getExtension = (filename: string) => {
            const parts = filename.split('.');
            return parts.length > 1 ? `.${parts.pop()}` : '.jpg';
          };
          const imageUrls = await Promise.all(limitedImages.map(async (img, index) => {
            const fileName = img.source === 'camera'
              ? `camara_${Date.now()}_${index}${getExtension(img.file.name)}`
              : `galeria_${img.file.name}`;
            const r = ref(storage, `informes/${docId}/${fileName}`);
            await uploadBytes(r, img.file);
            return getDownloadURL(r);
          }));

          let inspectorSignatureUrl = (formData as any).inspectorSignatureUrl || null;
          if (inspectorSignature) {
            if (inspectorSignature.startsWith('data:')) {
              const inspRef = ref(storage, `firmas/${docId}/inspector.png`);
              await uploadString(inspRef, inspectorSignature, 'data_url');
              inspectorSignatureUrl = await getDownloadURL(inspRef);
            } else {
              inspectorSignatureUrl = inspectorSignature;
            }
          }

          let clientSignatureUrl = (formData as any).clientSignatureUrl || null;
          if (includeClientSignature && clientSignature && clientSignature.startsWith('data:')) {
            const cliRef = ref(storage, `firmas/${docId}/cliente.png`);
            await uploadString(cliRef, clientSignature, 'data_url');
            clientSignatureUrl = await getDownloadURL(cliRef);
          }

          const docData = {
            ...formData,
            tecnicos: inspectorName, // Solo el técnico responsable
            includeClientSignature,
            datos_pruebas: {
              ...formData.datos_pruebas,
              horas: formData.datos_pruebas.horas || ''
            },
            imageUrls,
            inspectorSignatureUrl,
            clientSignatureUrl: includeClientSignature ? clientSignatureUrl : null,
            inspectorId: currentEmail || '',
            inspectorNombre: inspectorName,
            inspectorInitials,
            inspectorIds: currentEmail ? [currentEmail] : [],
            inspectorNombres: [inspectorName],
            fecha_creacion: Timestamp.now(),
            formType: formData.formType || 'informe-simplificado',
            id: docId,
            numero_informe: docId,
            orderId: linkedOrderId || null,
            numero_ot: linkedOrderId || null,
            procedencia: linkedOrderId ? 'OT' : 'INDEPENDIENTE',
            estado: 'Registrado'
          };
          await setDoc(doc(firestore, 'informes', docId), docData);

          // Actualizar estado de la OT a 'En Proceso'
          if (docData.orderId) {
            await updateDoc(doc(firestore, 'ordenes_trabajo', docData.orderId), { estado: 'En Proceso' });
          }

          await saveDataToLocal(true, docId, imageUrls, inspectorSignatureUrl, clientSignatureUrl);

          // Empujar contador a Firebase (garantizado tras guardado exitoso online)
          pushCounterToCloud('informe-simplificado', currentEmail || '', firestore, sequence).catch(() => {});

        } catch (error) {
          console.error('Error Firebase:', error);
          await saveDataToLocal(false, docId);
          // Intentar empujar el contador aunque el documento falló (el ID ya fue consumido)
          pushCounterToCloud('informe-simplificado', currentEmail || '', firestore, sequence).catch(() => {});
        }
      } else {
        await saveDataToLocal(false, docId);
        // Offline: intentar empuje si hay firestore disponible
        if (firestore && currentEmail) {
          pushCounterToCloud('informe-simplificado', currentEmail, firestore, sequence).catch(() => {});
        }
      }
    } catch (error) {
      console.error('Error en guardado de informe simplificado:', error);
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
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full bg-white min-h-screen pb-20">
      <Dialog open={!!previewPdfUrl} onOpenChange={(isOpen) => {
        if (!isOpen && previewPdfUrl) {
          URL.revokeObjectURL(previewPdfUrl);
          setPreviewPdfUrl(null);
        }
      }}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 rounded-[2.5rem] overflow-hidden border border-slate-200 bg-white text-slate-950 light">
          {/* SOLUCIÓN: Botón en cabecera */}
          <DialogHeader className="p-6 border-b border-slate-100 bg-white flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="font-black uppercase tracking-tighter text-black">Vista Previa Informe Simplificado</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">Revise la información antes del cierre técnico.</DialogDescription>
            </div>
            <button
              onClick={() => handlePdfAction(true)}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-primary/90 transition-all shadow-sm active:scale-95"
            >
              Descargar PDF
            </button>
          </DialogHeader>
          <div className="flex-1 bg-slate-100">
            {previewPdfUrl && <iframe src={`${previewPdfUrl}#toolbar=0`} className="w-full h-full border-none" title="PDF Preview" />}
          </div>
        </DialogContent>
      </Dialog>

      <main className="space-y-6 px-4 pt-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-xl font-black text-black border-l-4 border-primary pl-4 uppercase tracking-tighter">
            {isEditingExisting && creationReportId
              ? <span className="text-primary">Modificando <span className="text-emerald-700">{creationReportId}</span></span>
              : 'Informe Simplificado (Grupos Pequeños)'}
          </h2>

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="md:col-span-2 space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Cliente Base</label>
              <div className="bg-white border border-slate-100 rounded-2xl">
                <ClientSelector onSelect={handleClientSelect} selectedClientId={formData.clienteId} />
              </div>
            </div>
            <StableInput label="Instalación" icon={MapPin} value={formData.instalacion} onChange={(v: string) => handleInputChange('instalacion', v)} />
            <StableInput label="Dirección" icon={MapPin} value={formData.direccion} onChange={(v: string) => handleInputChange('direccion', v)} />
            <StableInput label="Fecha Revisión" icon={Calendar} type="date" value={formData.fecha_revision} onChange={(v: string) => handleInputChange('fecha_revision', v)} />
            <StableInput label="Motor" icon={Settings} value={formData.motor} onChange={(v: string) => handleInputChange('motor', v)} />
            <StableInput label="Modelo" icon={Type} value={formData.modelo} onChange={(v: string) => handleInputChange('modelo', v)} />
            <StableInput label="Nº Motor" icon={Hash} value={formData.n_motor} onChange={(v: string) => handleInputChange('n_motor', v)} />
            <StableInput label="Nº Grupo" icon={Hash} value={formData.n_grupo} onChange={(v: string) => handleInputChange('n_grupo', v)} />
            <StableInput label="Potencia (KVA)" icon={Zap} value={formData.potencia} onChange={(v: string) => handleInputChange('potencia', v)} />
            <button
              onClick={handleCaptureLocation}
              disabled={locationStatus === 'loading'}
              className={`w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-center gap-2 font-black shadow-sm text-xs transition-all active:scale-95 disabled:opacity-50 ${formData.location ? 'border-emerald-500/50 text-emerald-500 bg-emerald-500/10' : 'border-slate-100 text-slate-400 hover:border-primary'}`}
            >
              {locationStatus === 'loading' ? <Loader2 className="animate-spin text-primary" size={14} /> : formData.location ? <CheckCircle2 size={14} className="text-emerald-500" /> : <MapPin size={14} />}
              <span>{formData.location ? `UBICACIÓN CAPTURADA` : (gpsRequired ? 'CAPTURAR GPS (REQUERIDO)' : 'CAPTURAR GPS (OPCIONAL)')}</span>
            </button>
          </div>
        </section>

        <section className="bg-white p-5 md:p-8 rounded-[2rem] shadow-sm space-y-3 border border-slate-100">
          <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-1.5">Recambios y Materiales Utilizados</h3>
          <div className="grid grid-cols-1 gap-y-3">
            {SIMPLIFIED_CHECKLIST_ITEMS.map(it => (
              <div key={it} className={`p-3 rounded-xl flex justify-between items-center transition-all border ${formData.recambios_checklist[it] ? 'bg-primary/5 border-primary/20' : 'bg-slate-50/50 border-slate-100'}`}>
                <span className="text-[11px] font-bold text-slate-700">{it}</span>
                <div className="flex gap-1">
                  {["OK", "DEFECT", "CAMBIO"].map(st => (
                    <button
                      key={st}
                      onClick={() => handleChecklistChange(it, st)}
                      className={`w-14 h-7 rounded-lg text-[8px] font-black border transition-all active:scale-90 ${formData.recambios_checklist[it] === st ? 'bg-primary border-primary text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-primary/50'}`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white p-5 md:p-8 rounded-[2rem] shadow-sm space-y-4 border border-slate-100">
          <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-1.5">Mediciones y Pruebas</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StableInput icon={Clock} label="Horas" value={formData.datos_pruebas.horas} onChange={(v: string) => handleNestedChange('datos_pruebas', 'horas', v)} />
            <StableInput icon={Gauge} label="Presión Aceite" value={formData.datos_pruebas.presion} onChange={(v: string) => handleNestedChange('datos_pruebas', 'presion', v)} />
            <StableInput icon={Thermometer} label="Temperatura" value={formData.datos_pruebas.temperatura} onChange={(v: string) => handleNestedChange('datos_pruebas', 'temperatura', v)} />
            <StableInput icon={Droplets} label="Nivel Combustible" value={formData.datos_pruebas.nivel_combustible} onChange={(v: string) => handleNestedChange('datos_pruebas', 'nivel_combustible', v)} />
            <StableInput icon={Zap} label="Tensión Alternador" value={formData.datos_pruebas.tension_alternador} onChange={(v: string) => handleNestedChange('datos_pruebas', 'tension_alternador', v)} />
            <StableInput icon={Wind} label="Frecuencia" value={formData.datos_pruebas.frecuencia} onChange={(v: any) => handleNestedChange('datos_pruebas', 'frecuencia', v)} />
            <StableInput icon={Battery} label="Carga Baterías" value={formData.datos_pruebas.carga_baterias} onChange={(v: any) => handleNestedChange('datos_pruebas', 'carga_baterias', v)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100 mt-3">
            <LoadTestInput label="Tensión RS" value={formData.pruebas_carga.tension_rs} onChange={(v: string) => handleNestedChange('pruebas_carga', 'tension_rs', v)} />
            <LoadTestInput label="Tensión ST" value={formData.pruebas_carga.tension_st} onChange={(v: string) => handleNestedChange('pruebas_carga', 'tension_st', v)} />
            <LoadTestInput label="Tensión RT" value={formData.pruebas_carga.tension_rt} onChange={(v: string) => handleNestedChange('pruebas_carga', 'tension_rt', v)} />
            <LoadTestInput label="Potencia kW" value={formData.pruebas_carga.potencia_kw} onChange={(v: string) => handleNestedChange('pruebas_carga', 'potencia_kw', v)} />
          </div>
        </section>

        <section className="bg-white p-5 md:p-8 rounded-[2rem] shadow-sm space-y-4 border border-slate-100">
          <h2 className="text-lg font-black text-black flex items-center gap-2 uppercase tracking-tighter"><Camera className="text-primary" size={18} /> Evidencia Multimedia</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="image-upload-camera" className="w-full cursor-pointer bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:bg-white hover:border-primary transition-all group active:scale-[0.99]">
                <Camera size={28} className="text-slate-300 mb-1.5 group-hover:text-primary transition-colors" />
                <span className="font-black text-slate-400 uppercase text-[10px] tracking-widest">Cámara</span>
              </label>
              <input id="image-upload-camera" type="file" multiple accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageChange(e, 'camera')} />
            </div>
            <div>
              <label htmlFor="image-upload-gallery" className="w-full cursor-pointer bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:bg-white hover:border-primary transition-all group active:scale-[0.99]">
                <ImageIcon size={28} className="text-slate-300 mb-1.5 group-hover:text-primary transition-colors" />
                <span className="font-black text-slate-400 uppercase text-[10px] tracking-widest">Galería</span>
              </label>
              <input id="image-upload-gallery" type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleImageChange(e, 'gallery')} />
            </div>
          </div>
          {(images.length > 0 || (formData.imageUrls && formData.imageUrls.length > 0)) && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-2">
              {/* Guardadas */}
              {(formData.imageUrls || []).map((url: string, i: number) => (
                <div key={`existing-${i}`} className="aspect-square relative group overflow-hidden rounded-xl border border-slate-100 shadow-sm bg-slate-50">
                  <img src={url} alt={`saved-preview ${i}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                  <button
                    type="button"
                    onClick={() => setFormData((prev: any) => ({ ...prev, imageUrls: (prev.imageUrls || []).filter((_: any, idx: number) => idx !== i) }))}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-600 text-white flex items-center justify-center transition-all active:scale-95 shadow-md z-10"
                    title="Eliminar foto"
                  >
                    <X size={12} />
                  </button>
                  <span className="absolute bottom-1 left-1 bg-slate-900/60 text-white text-[8px] font-black uppercase px-1 py-0.5 rounded">Guardada</span>
                </div>
              ))}
              {/* Nuevas */}
              {images.map((img, i) => (
                <div key={`new-${i}`} className="aspect-square relative group overflow-hidden rounded-xl border border-slate-100 shadow-sm bg-slate-50">
                  <img src={URL.createObjectURL(img.file)} alt={`new-preview ${i}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
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

        <section className="bg-white p-5 md:p-8 rounded-[2rem] shadow-sm space-y-4 border border-slate-100">
          <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6">
            <div className="flex items-center gap-3 text-left">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${includeClientSignature ? 'bg-primary text-white' : 'bg-slate-200 text-slate-400'}`}>
                <Users size={20} />
              </div>
              <div>
                <p className="text-xs font-black text-slate-700 uppercase tracking-tighter">¿Incluir Firma del Cliente?</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Activar solo si el cliente validará el informe</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={includeClientSignature} onChange={(e) => setIncludeClientSignature(e.target.checked)} className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-inner"></div>
            </label>
          </div>

          <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
            <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Observaciones Finales</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={toggleDictation}
                className={`flex items-center gap-2 text-[8px] font-black px-3 py-1.5 rounded-xl transition-colors active:scale-95 ${
                  isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {isListening ? <MicOff size={12} className="animate-bounce" /> : <Mic size={12} />}
                {isListening ? 'DETENER DICTADO' : 'DICTADO'}
              </button>
              <button
                onClick={handleEnhanceReport}
                disabled={aiLoading}
                className="flex items-center gap-2 text-[8px] font-black bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition-colors active:scale-95 disabled:opacity-50"
              >
                {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                {aiLoading ? 'PROCESANDO...' : 'ESTRUCTURAR CON IA'}
              </button>
            </div>
          </div>
          <ObservationQuickPhrases
            value={formData.observaciones}
            onChange={(next) => handleInputChange('observaciones', next)}
          />
          <textarea className="w-full min-h-[220px] bg-slate-50 border border-slate-200 rounded-xl p-4 resize-y outline-none focus:border-primary focus:bg-white transition-all shadow-inner text-sm font-medium text-black leading-relaxed whitespace-pre-wrap" placeholder="Anote cualquier detalle relevante..." value={formData.observaciones} onChange={e => handleInputChange('observaciones', e.target.value)} spellCheck="true" lang="es" autoCorrect="on" autoCapitalize="sentences" />
          <div className="grid md:grid-cols-2 gap-6 items-start pt-4">
            <div className="text-left">
              <SignaturePad title="Firma del Inspector" signature={inspectorSignature} onSignatureEnd={setInspectorSignature} showSavedSignature={true} />
              <p className="text-center font-black mt-2 text-slate-400 text-[8px] uppercase">{inspectorName}</p>
            </div>
            {includeClientSignature && (
              <div className="animate-in zoom-in duration-300 text-left">
                <SignaturePad title="Conforme Cliente" signature={clientSignature} onSignatureEnd={setClientSignature} />
                <div className="mt-2 text-left">
                  <StableInput label="Nombre receptor" icon={User} value={formData.recibidoPor} onChange={(v: string) => handleInputChange('recibidoPor', v)} placeholder="Nombre receptor" />
                </div>
              </div>
            )}
          </div>
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
            {saving ? <Loader2 className="animate-spin text-white" size={16} /> : isSaved && !isEditingExisting ? <CheckCircle2 className="text-emerald-400" size={16} /> : <Save className="text-white" size={16} />}
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
    </div>
  );
}
