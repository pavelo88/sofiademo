'use client';
import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, Timestamp, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { Wand2, Loader2, Save, FileSearch, Printer, CheckCircle2, User, Users, MapPin, Settings, Type, Hash, Calendar, Clock, Car, Euro, Zap, Thermometer, Battery, Droplets, Wind, Gauge, Camera, ClipboardList, FileText, Image as ImageIcon, Mic, MicOff, X } from 'lucide-react';
import { enhanceTechnicalRequest } from '@/ai/flows/enhance-technical-request-flow';
import { processDictation } from '@/ai/flows/process-dictation-flow';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import SignaturePad from '../SignaturePad';
import { getStorage, ref, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { db as dbLocal } from '@/lib/db-local';
import { drawPdfHeader, drawPdfFooter } from '../../lib/pdf-helpers';
import { useToast } from '@/hooks/use-toast';
import { useGpsRequired } from '@/hooks/use-gps-required';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ClientSelector from '../ClientSelector';
import StableInput from '../StableInput';
import { resolveInspectorEmail } from '@/lib/inspection-mode';
import { resolveInitials, saveTechnicianInfo } from '@/lib/technician-utils';
import { getNextSequenceForUser, pushCounterToCloud } from '@/lib/sequence-manager';
import { getCreationReportId, getLinkedOrderId, getSafeReportId } from '../../lib/report-record';
import { addImageSafely, getPdfFileName, normalizeReportForPdf, renderImageGallery } from '@/lib/pdf-utils';
import { MAX_IMAGES_PER_REPORT } from '@/lib/report-limits';
import { generateReportId, fileToBase64 } from '@/lib/offline-utils';
import { clearLegacyStoredSignature, clearStoredSignatureForEmail, getStoredSignatureForEmail, setStoredSignatureForEmail } from '@/lib/signature-storage';
import ObservationQuickPhrases from './ObservationQuickPhrases';

const LoadTestInput = React.memo(({ label, value, onChange }: any) => (
  <div className="flex flex-col items-center gap-1">
    <label className="text-[8px] font-black text-slate-500 w-full text-center">{label}</label>
    <input
      type="text"
      value={value || ''}
      onChange={(e: any) => onChange(e.target.value)}
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

  let currentY = topMargin + 6;

  try {
    doc.setTextColor(darkColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("HOJA DE TRABAJO", leftMargin, currentY);

    doc.setFontSize(12);
    const individualID = getSafeReportId(report.numero_informe) || report.individualId || '';
    const displayID = (individualID && individualID !== finalID && finalID !== 'BORRADOR') 
      ? `${finalID} (${individualID})` 
      : finalID;
    doc.text(`Nº: ${displayID}`, pageWidth - rightMargin, currentY, { align: 'right' });
    currentY += 6;

    // TABLA 1: CLIENTE (5x2)
    autoTable(doc, {
      startY: currentY,
      body: [
        [{ content: 'CLIENTE:', styles: { fontStyle: 'bold' } }, report.clienteNombre || report.cliente],
        [{ content: 'FECHA:', styles: { fontStyle: 'bold' } }, report.fecha],
        [{ content: 'INSTALACIÓN:', styles: { fontStyle: 'bold' } }, report.instalacion],
        [{ content: 'INSPECTOR:', styles: { fontStyle: 'bold' } }, report.tecnicos],
        [{ content: 'UBICACIÓN (LAT/LON):', styles: { fontStyle: 'bold' } }, report.location ? `${report.location.lat.toFixed(6)}, ${report.location.lon.toFixed(6)}` : 'No registrada'],
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2, textColor: bodyColor, fontStyle: 'normal' },
      columnStyles: { 
        0: { cellWidth: 45, fontStyle: 'bold' }, 
        1: { cellWidth: contentWidth - 45, fontStyle: 'normal' } 
      },
      margin: { left: leftMargin, right: rightMargin }
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;

    // TABLA 2: MOTOR / SERVICIO (5x4)
    autoTable(doc, {
      startY: currentY,
      body: [
        [
          { content: 'MOTOR:', styles: { fontStyle: 'bold' } }, 
          report.motor,
          { content: 'H. ASISTENCIA:', styles: { fontStyle: 'bold' } }, 
          report.h_asistencia
        ],
        [
          { content: 'Nº MOTOR:', styles: { fontStyle: 'bold' } }, 
          report.n_motor,
          { content: 'TIPO DE SERVICIO:', styles: { fontStyle: 'bold' } }, 
          report.tipo_servicio
        ],
        [
          { content: 'GRUPO:', styles: { fontStyle: 'bold' } }, 
          report.grupo,
          { content: 'KMS.:', styles: { fontStyle: 'bold' } }, 
          report.kms || ''
        ],
        [
          { content: 'Nº GRUPO:', styles: { fontStyle: 'bold' } }, 
          report.n_grupo,
          { content: 'DIETA:', styles: { fontStyle: 'bold' } }, 
          `${report.dieta || ''} €`
        ],
        [
          { content: 'Nº DE PEDIDO:', styles: { fontStyle: 'bold' } }, 
          report.n_pedido || '',
          '',
          ''
        ]
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2, textColor: bodyColor, fontStyle: 'normal' },
      columnStyles: { 
        0: { cellWidth: (contentWidth - 4) / 4, fontStyle: 'bold' }, 
        1: { cellWidth: (contentWidth - 4) / 4, fontStyle: 'normal' },
        2: { cellWidth: (contentWidth - 4) / 4, fontStyle: 'bold' }, 
        3: { cellWidth: (contentWidth - 4) / 4, fontStyle: 'normal' }
      },
      margin: { left: leftMargin, right: rightMargin }
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;

    currentY = (doc as any).lastAutoTable.finalY + 12;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(bodyColor);
    doc.text("TRABAJOS REALIZADOS", leftMargin, currentY);
    currentY += 8;

    const rawText = report.trabajos_realizados || '';
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
        currentY = (doc as any).lastAutoTable.finalY + 4;
      }
    });

    currentY += 10;

    if (currentY + 40 > pageHeight - bottomMargin) {
      doc.addPage();
      currentY = topMargin;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(bodyColor);
    doc.text("PARÁMETROS TÉCNICOS", leftMargin, currentY);
    currentY += 7;

    const parameterRows = [
      [
        { label: 'Horas', value: report.parametrosTecnicos?.horas || '' },
        { label: 'Presión Aceite', value: report.parametrosTecnicos?.presionAceite || '' },
      ],
      [
        { label: 'Tensión', value: report.parametrosTecnicos?.tension || '' },
        { label: 'Tª (°C)', value: report.parametrosTecnicos?.temperatura || '' },
      ],
      [
        { label: 'Nivel Combustible (%)', value: report.parametrosTecnicos?.nivelCombustible || '' },
        { label: 'Frecuencia (Hz)', value: report.parametrosTecnicos?.frecuencia || '' },
      ],
      [
        { label: 'Tensión de baterías (V)', value: report.parametrosTecnicos?.tensionBaterias || '' },
        { label: '', value: '' },
      ],
    ];

    autoTable(doc, {
      startY: currentY,
      body: parameterRows.map((row) => row.map((cell) => ({ content: `${cell.label}: ${cell.value}`, raw: cell }))),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 1.5, minCellHeight: 8, textColor: bodyColor, fontStyle: 'normal' },
      margin: { left: leftMargin, right: rightMargin },
      didParseCell(data) {
        data.cell.text = [''];
      },
      didDrawCell(data) {
        const cell = parameterRows[data.row.index]?.[data.column.index];
        if (!cell?.label) return;

        const x = data.cell.x + 2;
        const y = data.cell.y + 5.2;
        const labelText = `${cell.label}: `;
        doc.setTextColor(bodyColor);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(labelText, x, y);
        doc.setFont('helvetica', 'normal');
        doc.text(String(cell.value || ''), x + doc.getTextWidth(labelText) + 1.8, y);
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;

    doc.addPage();
    currentY = topMargin;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(bodyColor);
    doc.text(`Potencia con carga: ${report.potenciaConCarga?.potencia || ''}`, leftMargin, currentY);
    currentY += 7;

    autoTable(doc, {
      startY: currentY,
      head: [['Tensión', 'Intensidad', 'Potencia (kW)']],
      body: [
        [`RS: ${report.potenciaConCarga?.tensionRS || ''}`, `R: ${report.potenciaConCarga?.intensidadR || ''}`, { rowSpan: 3, content: report.potenciaConCarga?.potenciaKW || '', styles: { valign: 'middle', halign: 'center' } }],
        [`ST: ${report.potenciaConCarga?.tensionST || ''}`, `S: ${report.potenciaConCarga?.intensidadS || ''}`],
        [`RT: ${report.potenciaConCarga?.tensionRT || ''}`, `T: ${report.potenciaConCarga?.intensidadT || ''}`],
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 1.5, minCellHeight: 8, textColor: bodyColor },
      headStyles: { fillColor: darkColor, textColor: '#fff' },
      bodyStyles: { fontStyle: 'bold' },
      margin: { left: leftMargin, right: rightMargin }
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;
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
    doc.text("Inspector EnergyEngine", leftMargin, currentY + 38);

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
      doc.setPage(i);
      drawPdfHeader(doc);
      drawPdfFooter(doc, i, totalPages, report.individualId);
    }
  } catch (err) {
    console.error("Error al generar PDF:", err);
  }

  return doc;
};

export default function HojaTrabajoForm({ 
  initialData, aiData, onSuccess, isAdmin = false, userFullName, effectiveEmail 
}: { 
  initialData: any, aiData: any, onSuccess: () => void, isAdmin?: boolean, userFullName?: string, effectiveEmail?: string | null 
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

  const [formData, setFormData] = useState({
    formType: 'hoja-trabajo',
    clienteId: '',
    clienteNombre: '',
    cliente: '',
    instalacion: '',
    motor: '',
    n_motor: '',
    grupo: '',
    n_grupo: '',
    potencia: '',
    n_pedido: '',
    location: null as { lat: number, lon: number } | null,
    fecha: new Date().toISOString().split('T')[0],
    tecnicos: '',
    h_asistencia: '',
    tipo_servicio: 'MANTENIMIENTO CORRECTIVO',
    kms: '',
    dieta: '',
    media_dieta: false,
    media_dieta_cantidad: '',
    imageUrls: [] as string[],
    trabajos_realizados: '',
    recibidoPor: '',
    parametrosTecnicos: {
      horas: '',
      presionAceite: '',
      tension: '',
      temperatura: '',
      nivelCombustible: '',
      frecuencia: '',
      tensionBaterias: '',
    },
    potenciaConCarga: {
      potencia: '',
      tensionRS: '',
      tensionST: '',
      tensionRT: '',
      intensidadR: '',
      intensidadS: '',
      intensidadT: '',
      potenciaKW: '',
    }
  });

  const [inspectorSignature, setInspectorSignature] = useState<string | null>(null);
  const [clientSignature, setClientSignature] = useState<string | null>(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedDocId, setSavedDocId] = useState('');
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isListening, setIsListening] = useState(false);
  const [includeClientSignature, setIncludeClientSignature] = useState(false);
  const gpsRequired = useGpsRequired();

  // Detect if we're editing an existing completed/preapproved report
  const creationReportId = getCreationReportId(initialData);
  const linkedOrderId = getLinkedOrderId(initialData) || getLinkedOrderId(formData);
  const isEditingExisting = !!(initialData?.estado && ['Registrado', 'Aprobado'].includes(initialData.estado) && creationReportId);

  useEffect(() => {
    const fetchData = async () => {
      const currentEmail = effectiveEmail || inspectorEmail;
      clearLegacyStoredSignature();

      if (currentEmail) {
        const cachedSecurity = await dbLocal.table('seguridad').get(currentEmail);
        
        // --- LOGICA DE AUTORIA BLINDADA ---
        // Si NO estamos editando, el inspector es el usuario actual
        if (!isEditingExisting) {
          const localSig = getStoredSignatureForEmail(currentEmail);
          setInspectorSignature(localSig);

          if (cachedSecurity && cachedSecurity.nombre) {
            setInspectorName(cachedSecurity.nombre);
            if (!localSig && cachedSecurity.signatureBase64) setInspectorSignature(cachedSecurity.signatureBase64);
            setFormData(p => ({ ...p, tecnicos: cachedSecurity.nombre }));
          } else if (userFullName) {
            setInspectorName(userFullName);
            setFormData(p => ({ ...p, tecnicos: userFullName }));
          }
        } 
        // Si ESTAMOS editando, el inspectorNombre se sacará del initialData en el otro useEffect
        
        const initials = resolveInitials(currentEmail);
        setInspectorInitials(initials);
      }
    };
    fetchData();
  }, [effectiveEmail, inspectorEmail, isEditingExisting, userFullName]);

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
          // Mantener tecnicos como el original
          tecnicos: originalAuthor || prev.tecnicos,
          h_asistencia: initialData.h_asistencia != null ? String(initialData.h_asistencia) : '',
          parametrosTecnicos: {
            ...initialData.parametrosTecnicos,
            horas: initialData.parametrosTecnicos?.horas != null ? String(initialData.parametrosTecnicos.horas) : '',
          }
        }));
        if (initialData.inspectorSignatureUrl) setInspectorSignature(initialData.inspectorSignatureUrl);
        if (initialData.clientSignatureUrl) setClientSignature(initialData.clientSignatureUrl);
        setSavedDocId(creationReportId || '');
      } else {
        // ... (resto igual)
        setFormData((prev: any) => ({
          ...prev,
          clienteId: initialData.clienteId || prev.clienteId,
          clienteNombre: initialData.clienteNombre || initialData.cliente || prev.clienteNombre,
          cliente: initialData.clienteNombre || initialData.cliente || prev.cliente,
          motor: initialData.modelo || prev.motor || '',
          modelo: initialData.n_motor || prev.modelo || '',
          n_motor: initialData.n_motor || prev.n_motor || '',
          n_grupo: initialData.n_grupo || prev.n_grupo || '',
          potencia: initialData.potencia || prev.potencia || '',
          observaciones: initialData.descripcion || prev.observaciones || '',
          h_asistencia: initialData.h_asistencia != null ? String(initialData.h_asistencia) : prev.h_asistencia || '',
          estado: 'Registrado',
        }));
      }
    }
  }, [initialData]);

  useEffect(() => {
    if (aiData) {
      setFormData(prev => ({
        ...prev,
        cliente: aiData.identidad.cliente || prev.cliente,
        motor: aiData.identidad.marca || prev.motor,
        n_motor: aiData.identidad.sn || prev.n_motor,
        instalacion: aiData.identidad.instalacion || prev.instalacion,
        trabajos_realizados: aiData.observations_summary || prev.trabajos_realizados,
      }));
    }
  }, [aiData]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleClientSelect = (client: any) => {
    setFormData(p => ({
      ...p,
      clienteId: client.id,
      clienteNombre: client.nombre,
      cliente: client.nombre
    }));
  };

  const handleNestedInputChange = (section: 'parametrosTecnicos' | 'potenciaConCarga', field: string, value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      [section]: {
        ...(prev[section] as any),
        [field]: value
      }
    }));
  };

  const handleCaptureLocation = () => {
    if (!navigator.geolocation) {
      toast({ variant: 'destructive', title: 'Error de GPS', description: 'Tu dispositivo no soporta geolocalización.' });
      setLocationStatus('error');
      return;
    }
    setLocationStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        handleInputChange('location', { lat: latitude, lon: longitude });
        setLocationStatus('success');
        toast({ title: 'GPS Capturado', description: 'Ubicación registrada correctamente.' });
      },
      (error) => {
        let msg = 'Por favor, activa los permisos de ubicación.';
        if (error.code === error.TIMEOUT) msg = 'Tiempo de espera agotado buscando GPS.';
        toast({ variant: 'destructive', title: 'Error de GPS', description: msg });
        setLocationStatus('error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
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
            trabajos_realizados: prev.trabajos_realizados ? `${prev.trabajos_realizados}\n${finalTranscript}` : finalTranscript,
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
    if (!formData.trabajos_realizados) return;
    setAiLoading(true);
    try {
      const res = await processDictation({ dictation: formData.trabajos_realizados });
      setFormData((p: any) => ({
        ...p,
        cliente: res.identidad.cliente || p.cliente,
        motor: res.identidad.marca || p.motor,
        modelo: res.identidad.modelo || p.modelo,
        n_motor: res.identidad.sn || p.n_motor,
        n_grupo: res.identidad.n_grupo || p.n_grupo,
        instalacion: res.identidad.instalacion || p.instalacion,
        potencia: res.identidad.potencia_kva || p.potencia,
        trabajos_realizados: res.observations_summary || p.trabajos_realizados,
        parametrosTecnicos: {
          ...p.parametrosTecnicos,
          horas: res.mediciones_generales?.horas || p.parametrosTecnicos.horas,
          presionAceite: res.mediciones_generales?.presion || p.parametrosTecnicos.presionAceite,
          tension: res.mediciones_generales?.tensionAlt || p.parametrosTecnicos.tension,
          temperatura: res.mediciones_generales?.temp || p.parametrosTecnicos.temperatura,
          nivelCombustible: res.mediciones_generales?.combustible || p.parametrosTecnicos.nivelCombustible,
          frecuencia: res.mediciones_generales?.frecuencia || p.parametrosTecnicos.frecuencia,
          tensionBaterias: res.mediciones_generales?.cargaBat || p.parametrosTecnicos.tensionBaterias,
        },
        potenciaConCarga: {
          ...p.potenciaConCarga,
          potencia: res.identidad.potencia_kva || p.potenciaConCarga.potencia,
          tensionRS: res.pruebas_carga?.rs || p.potenciaConCarga.tensionRS,
          tensionST: res.pruebas_carga?.st || p.potenciaConCarga.tensionST,
          tensionRT: res.pruebas_carga?.rt || p.potenciaConCarga.tensionRT,
          intensidadR: res.pruebas_carga?.r || p.potenciaConCarga.intensidadR,
          intensidadS: res.pruebas_carga?.s || p.potenciaConCarga.intensidadS,
          intensidadT: res.pruebas_carga?.t || p.potenciaConCarga.intensidadT,
          potenciaKW: res.pruebas_carga?.kw || p.potenciaConCarga.potenciaKW,
        }
      }));
      toast({ title: '¡Reporte Mejorado!', description: 'La IA ha estructurado el texto y extraído los campos.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error de IA', description: 'No se pudo procesar con IA. Use texto manual.' });
    } finally {
      setAiLoading(false);
    }
  };

  // ########## FUNCIÓN CORREGIDA ##########
  const handlePdfAction = (forceDownload = false, docIdOverride?: string) => {
    // Verificación básica para evitar PDFs vacíos
    if (!formData.clienteId) {
      toast({
        variant: 'destructive',
        title: 'Faltan Datos',
        description: 'Seleccione un Cliente para poder generar el archivo.'
      });
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

      // 1. Determinamos el ID (Si no hay uno oficial, usamos 'BORRADOR')
      const rawId = getSafeReportId((formData as any).numero_informe) || getSafeReportId(docIdOverride) || (isSaved ? getSafeReportId(savedDocId) : '') || 'BORRADOR';

      // 2. Limpiamos el nombre para que el sistema operativo lo acepte (quitamos espacios y puntos)
      const safeFileName = rawId.replace(/[^a-z0-9]/gi, '_').toUpperCase();

      // 3. Generamos el documento base
      generatePDF(reportData, inspectorName, rawId).then(docPdf => {

        if (isSaved || forceDownload) {
          docPdf.save(`${safeFileName}.pdf`);
          toast({ title: "Descarga iniciada", description: `Archivo: ${safeFileName}.pdf` });
        } else {
          const blob = docPdf.output('blob');
          const url = URL.createObjectURL(blob);
          setPreviewPdfUrl(url);
        }
      }).catch(err => {
        console.error("Error PDF:", err);
        toast({ variant: "destructive", title: "Error", description: "Fallo al generar PDF" });
      }).finally(() => {
        setPdfLoading(false);
      });
    } catch (e) {
      console.error("Fallo crítico al generar PDF:", e);
      setPdfLoading(false);
    }
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

  const handleSave = async () => {
    if (!inspectorInitials) {
      toast({ variant: 'destructive', title: 'Identificación Requerida', description: 'No se han detectado sus iniciales de inspector. Por favor, asegúrese de que su perfil esté cargado correctamente.' });
      return;
    }

    if (!inspectorEmail) {
      toast({ variant: 'destructive', title: 'Inspector no identificado', description: 'Inicia online una vez para habilitar el modo offline.' });
      return;
    }

    // VALIDACIÓN ESTRICTA DE CAMPOS Y FIRMAS (Relajamos para Admin si es edición)
    const missing = [];
    if (!formData.clienteId) missing.push('Cliente');
    if (!isAdmin && gpsRequired && !formData.location) missing.push('Ubicacion GPS');
    if (!isAdmin && (!inspectorSignature || inspectorSignature.length < 100)) missing.push('Firma Inspector');
    if (!isAdmin && includeClientSignature && (!clientSignature || clientSignature.length < 100)) missing.push('Firma Cliente');

    if (missing.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Faltan Datos',
        description: `No se puede guardar: ${missing.join(', ')}`
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
      setSaving(true);
      didStartSave = true;

      // --- PREPARAR PAYLOAD DE ACTUALIZACION/CREACION ---
      const finalEstado = (formData as any).estado || (isAdmin ? 'Aprobado' : 'Registrado');
      const updatePayload: any = {
        ...formData,
        // ASEGURAR QUE NO SE SOBRESCRIBAN LOS CAMPOS DE AUTORIA ORIGINAL
        tecnicos: initialData?.tecnicos || initialData?.tecnicoNombre || initialData?.inspectorNombre || formData.tecnicos,
        inspectorNombre: initialData?.inspectorNombre || initialData?.tecnicos || initialData?.tecnicoNombre || (formData as any).inspectorNombre,
        inspectorId: initialData?.inspectorId || (formData as any).inspectorId,
        
        h_asistencia: formData.h_asistencia || '',
        parametrosTecnicos: {
          ...formData.parametrosTecnicos,
          horas: formData.parametrosTecnicos.horas || ''
        },
        estado: finalEstado,
        ultimaModificacion: Timestamp.now(),
        modificadoPorId: effectiveEmail || inspectorEmail,
        modificadoPorNombre: userFullName || 'Técnico Energy Engine',
      };

      if (isAdmin && finalEstado === 'Aprobado') {
        updatePayload.fecha_aprobacion = Timestamp.now();
        updatePayload.aprobadoPor = 'Admin';
      }

      // --- EDITING AN EXISTING COMPLETED/PRE-APPROVED REPORT ---
      if (isEditingExisting && savedDocId) {
        const existingDocId = savedDocId;
        
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
            const inspRef = ref(storage, `firmas/${existingDocId}/inspector.png`);
            await uploadString(inspRef, inspectorSignature, 'data_url');
            inspectorSignatureUrl = await getDownloadURL(inspRef);
          }
          let clientSignatureUrl = (formData as any).clientSignatureUrl || clientSignature;
          if (clientSignature && clientSignature.startsWith('data:')) {
            const cliRef = ref(storage, `firmas/${existingDocId}/cliente.png`);
            await uploadString(cliRef, clientSignature, 'data_url');
            clientSignatureUrl = await getDownloadURL(cliRef);
          }

          updatePayload.inspectorSignatureUrl = inspectorSignatureUrl;
          updatePayload.clientSignatureUrl = clientSignatureUrl;

          await updateDoc(doc(firestore, 'informes', existingDocId), updatePayload);
          setIsSaved(true);
          toast({ title: '¡Documento Actualizado!', description: `Hoja ${existingDocId} guardada como ${finalEstado}.` });
        } else {
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

          // Buscar si ya existe en local para actualizar, o añadir nuevo
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

          // Añadir a la cola de sincronización si no está ya
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
        setTimeout(() => { if (onSuccess) onSuccess(); }, 1500);
        return;
      }

      // --- CREATING A NEW REPORT ---
      const sequence = await getNextSequenceForUser({
        type: 'hoja-trabajo',
        userEmail: currentEmail || '',
        firestore: canUseCloud ? firestore : null,
        isOnline: canUseCloud,
      });
      const initials = resolveInitials(inspectorEmail);
      const year = new Date().getFullYear();
      const sequentialId = `HT-${initials}-${year}-${sequence.toString().padStart(4, '0')}`;
      const limitedImages = images.slice(0, MAX_IMAGES_PER_REPORT);
      const internalFirebaseId = generateReportId('HT');

      const saveDataToLocal = async (
        synced: boolean,
        firebaseId: string,
        displayId: string,
        customImageUrls?: string[],
        customInspectorSigUrl?: string | null,
        customClientSigUrl?: string | null
      ) => {
        const localData: any = {
          ...formData,
          formType: 'hoja-trabajo',
          orderId: linkedOrderId || null,
          numero_ot: linkedOrderId || null,
          procedencia: linkedOrderId ? 'OT' : 'INDEPENDIENTE',
          displayId,
          numero_informe: displayId,
          imageUrls: customImageUrls || formData.imageUrls || [],
          inspectorSignatureUrl: customInspectorSigUrl || inspectorSignature || null,
          clientSignatureUrl: customClientSigUrl || clientSignature || null,
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
          await dbLocal.hojas_trabajo.add({
            firebaseId,
            synced,
            data: localData,
            createdAt: new Date(),
          });
        }

        setSavedDocId(firebaseId);
        setIsSaved(true);

        if (synced) toast({ title: 'Sincronizado', description: `Informe guardado con ID: ${displayId}` });
        else toast({ title: 'Guardado localmente', description: `Informe registrado como ${displayId}. Se subira al reconectar.` });

        // SOLUCIÓN: Descargar y cerrar automáticamente
        handlePdfAction(true, displayId);
        
        setTimeout(() => {
          if (onSuccess) onSuccess();
        }, 1500);
      };

      if (canUseCloud && typeof navigator !== 'undefined' && navigator.onLine && firestore && user?.email) {
        try {
          const storage = getStorage();

          const getExtension = (filename: string) => {
            const parts = filename.split('.');
            return parts.length > 1 ? `.${parts.pop()}` : '.jpg';
          };
          const imageUrls = await Promise.all(limitedImages.map(async (image, index) => {
            const fileName = image.source === 'camera'
              ? `camara_${Date.now()}_${index}${getExtension(image.file.name)}`
              : `galeria_${image.file.name}`;
            const imgRef = ref(storage, `informes/${internalFirebaseId}/${fileName}`);
            await uploadBytes(imgRef, image.file);
            return getDownloadURL(imgRef);
          }));

          let inspectorSignatureUrl = (formData as any).inspectorSignatureUrl || '';
          if (inspectorSignature) {
            if (inspectorSignature.startsWith('data:')) {
              const inspRef = ref(storage, `firmas/${internalFirebaseId}/inspector.png`);
              await uploadString(inspRef, inspectorSignature, 'data_url');
              inspectorSignatureUrl = await getDownloadURL(inspRef);
            } else {
              inspectorSignatureUrl = inspectorSignature;
            }
          }

          let clientSignatureUrl = '';
          if (includeClientSignature && clientSignature && clientSignature.startsWith('data:')) {
            const cliRef = ref(storage, `firmas/${internalFirebaseId}/cliente.png`);
            await uploadString(cliRef, clientSignature, 'data_url');
            clientSignatureUrl = await getDownloadURL(cliRef);
          }

          const docData = {
            ...formData,
            tecnicos: inspectorName, // Solo el técnico responsable del informe
            includeClientSignature,
            h_asistencia: formData.h_asistencia || '',
            parametrosTecnicos: {
              ...formData.parametrosTecnicos,
              horas: formData.parametrosTecnicos.horas || ''
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
            formType: formData.formType || 'hoja-trabajo',
            id: sequentialId,
            numero_informe: sequentialId,
            orderId: linkedOrderId || null,
            numero_ot: linkedOrderId || null,
            procedencia: linkedOrderId ? 'OT' : 'INDEPENDIENTE',
            internalId: internalFirebaseId,
            estado: 'Registrado',
          };

          await setDoc(doc(firestore, 'informes', sequentialId), docData);

          // Actualizar estado de la OT a 'En Proceso'
          if (docData.orderId) {
            await updateDoc(doc(firestore, 'ordenes_trabajo', docData.orderId), { estado: 'En Proceso' });
          }


          await saveDataToLocal(true, sequentialId, sequentialId, imageUrls, inspectorSignatureUrl, clientSignatureUrl);

          // Empujar contador a Firebase (garantizado tras guardado exitoso online)
          pushCounterToCloud('hoja-trabajo', currentEmail || '', firestore, sequence).catch(() => {});

        } catch (error) {
          console.error('[CLOUD ERROR] Fallo al guardar en Firebase:', error);
          // Fallback a ID local
          const year = new Date().getFullYear();
          const sequence = await dbLocal.getNextSequence('hoja-trabajo', currentEmail || 'global', year);
          const localId = `HT-${inspectorInitials}-${year}-${sequence.toString().padStart(4, '0')}`;
          await saveDataToLocal(false, localId, localId);
          // Intentar empujar el contador aunque el documento falló (el ID ya fue consumido)
          pushCounterToCloud('hoja-trabajo', currentEmail || '', firestore, sequence).catch(() => {});
        }
      } else {
        const year = new Date().getFullYear();
        const sequence = await dbLocal.getNextSequence('hoja-trabajo', inspectorEmail || 'global', year);
        const localId = `HT-${inspectorInitials}-${year}-${sequence.toString().padStart(4, '0')}`;
        await saveDataToLocal(false, localId, localId);
        // Offline: intentar empuje si hay firestore disponible
        if (firestore && currentEmail) {
          pushCounterToCloud('hoja-trabajo', currentEmail, firestore, sequence).catch(() => {});
        }
      }
    } catch (error) {
      console.error('Error en guardado de hoja de trabajo:', error);
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
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full bg-white">
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
              <DialogTitle className="font-black uppercase tracking-tighter text-black">Borrador de Hoja de Trabajo</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">Previsualice el documento antes de realizar el guardado final.</DialogDescription>
            </div>
            <button
              onClick={() => handlePdfAction(true)}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-primary/90 transition-all shadow-sm active:scale-95"
            >
              Descargar PDF
            </button>
          </DialogHeader>
          <div className="flex-1 bg-slate-100">
            {previewPdfUrl && <iframe src={previewPdfUrl} className="w-full h-full object-contain border-none" title="PDF Preview" />}
          </div>
        </DialogContent>
      </Dialog>

      <main className="space-y-6 pb-20 px-4 pt-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-xl font-black text-black border-l-4 border-primary pl-4 uppercase tracking-tighter">
            {isEditingExisting && creationReportId
              ? <span className="text-primary">Modificando <span className="text-emerald-700">{creationReportId}</span></span>
              : 'Hoja de Trabajo'}
          </h2>

          {linkedOrderId ? (
            <div className="bg-primary/5 border border-primary/10 px-4 py-2 rounded-2xl flex items-center gap-3 animate-in fade-in zoom-in duration-500">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <ClipboardList size={16} className="text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-primary/60 uppercase tracking-widest leading-none">Vinculado a OT</span>
                <span className="text-xs font-black text-primary uppercase tracking-tight">
                  {linkedOrderId}
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

        <section className="bg-white p-5 md:p-8 rounded-[2.5rem] shadow-sm space-y-4 border border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2 space-y-2 text-left">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Cliente Base</label>
              <div className="bg-white border border-slate-100 rounded-2xl text-slate-900">
                <ClientSelector onSelect={handleClientSelect} selectedClientId={formData.clienteId} />
              </div>

              <StableInput label="Instalación / Sede" icon={MapPin} value={formData.instalacion} onChange={(v: any) => handleInputChange('instalacion', v)} />
              <StableInput label="Motor / Equipo" icon={Settings} value={formData.motor} onChange={(v: any) => handleInputChange('motor', v)} />
              <StableInput label="N' Motor" icon={Hash} value={formData.n_motor} onChange={(v: any) => handleInputChange('n_motor', v)} />
              <StableInput label="Grupo Electrógeno" icon={Settings} value={formData.grupo} onChange={(v: any) => handleInputChange('grupo', v)} />
              <StableInput label="N' Grupo" icon={Hash} value={formData.n_grupo} onChange={(v: any) => handleInputChange('n_grupo', v)} />
              <StableInput label="Potencia (KVA)" icon={Zap} value={formData.potencia} onChange={(v: any) => handleInputChange('potencia', v)} />
              <StableInput label="N' de Pedido / OC" icon={Hash} value={formData.n_pedido} onChange={(v: any) => handleInputChange('n_pedido', v)} />
            </div>
            <div className="lg:col-span-2 space-y-2">
              <StableInput label="Fecha" icon={Calendar} type="date" value={formData.fecha} onChange={(v: any) => handleInputChange('fecha', v)} />
              <StableInput label="Técnicos Intervinientes" icon={User} value={formData.tecnicos} onChange={(v: any) => handleInputChange('tecnicos', v)} />
              <StableInput label="H. Asistencia" icon={Clock} value={formData.h_asistencia} onChange={(v: any) => handleInputChange('h_asistencia', v)} />
              <StableInput label="Tipo de Servicio" icon={Type} value={formData.tipo_servicio} onChange={(v: any) => handleInputChange('tipo_servicio', v)} />
              <StableInput label="Kilómetros" icon={Car} type="number" value={formData.kms} onChange={(v: any) => handleInputChange('kms', v)} />
              <StableInput label="Dieta (€)" icon={Euro} type="number" value={formData.dieta} onChange={(v: any) => handleInputChange('dieta', v)} />
              <div className="flex items-center gap-2 pt-1.5">
                <label className="flex items-center gap-2 text-xs font-black text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={formData.media_dieta} onChange={(e: any) => handleInputChange('media_dieta', e.target.checked)} className="form-checkbox h-4 w-4 text-primary rounded border border-slate-200" />
                  1/2 DIETA
                </label>
                {formData.media_dieta && <StableInput label="Cantidad" type="number" value={formData.media_dieta_cantidad} onChange={(v: any) => handleInputChange('media_dieta_cantidad', v)} />}
              </div>
            </div>
            <div className="lg:col-span-4 pt-2">
              <button
                onClick={handleCaptureLocation}
                disabled={locationStatus === 'loading'}
                className={`w-full p-4 border rounded-xl font-black transition-all flex items-center justify-center gap-2 active:scale-95 text-xs ${formData.location ? 'border-emerald-500/50 text-emerald-500 bg-emerald-500/10' : 'border-slate-100 hover:border-primary text-slate-400'}`}
              >
                {locationStatus === 'loading' ? <Loader2 className="animate-spin text-primary" size={14} /> : formData.location ? <CheckCircle2 size={14} className="text-emerald-500" /> : <MapPin size={14} />}
                {formData.location ? `COORDENADAS: ${formData.location.lat.toFixed(4)}, ${formData.location.lon.toFixed(4)}` : (gpsRequired ? 'VINCULAR UBICACIÓN GPS (REQUERIDO)' : 'VINCULAR UBICACIÓN GPS (OPCIONAL)')}
              </button>
            </div>
          </div>
        </section>

        <section className="bg-white p-5 md:p-8 rounded-[2.5rem] shadow-sm space-y-4 border border-slate-100">
          <h2 className="text-lg font-black flex items-center gap-2 uppercase tracking-tighter text-black"><Settings className="text-primary" size={18} /> PARÁMETROS TÉCNICOS</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StableInput icon={Clock} label="Horas" value={formData.parametrosTecnicos.horas} onChange={(v: any) => handleNestedInputChange('parametrosTecnicos', 'horas', v)} />
            <StableInput icon={Gauge} label="Presión Aceite" value={formData.parametrosTecnicos.presionAceite} onChange={(v: any) => handleNestedInputChange('parametrosTecnicos', 'presionAceite', v)} />
            <StableInput icon={Zap} label="Tensión" value={formData.parametrosTecnicos.tension} onChange={(v: any) => handleNestedInputChange('parametrosTecnicos', 'tension', v)} />
            <StableInput icon={Thermometer} label="Tª (°C):" value={formData.parametrosTecnicos.temperatura} onChange={(v: any) => handleNestedInputChange('parametrosTecnicos', 'temperatura', v)} />
            <StableInput icon={Droplets} label="Nivel Combustible (%):" value={formData.parametrosTecnicos.nivelCombustible} onChange={(v: any) => handleNestedInputChange('parametrosTecnicos', 'nivelCombustible', v)} />
            <StableInput icon={Wind} label="Frecuencia (Hz):" value={formData.parametrosTecnicos.frecuencia} onChange={(v: any) => handleNestedInputChange('parametrosTecnicos', 'frecuencia', v)} />
            <div className="col-span-2">
              <StableInput icon={Battery} label="Tensión baterías (V):" value={formData.parametrosTecnicos.tensionBaterias} onChange={(v: any) => handleNestedInputChange('parametrosTecnicos', 'tensionBaterias', v)} />
            </div>
          </div>
        </section>

        <section className="bg-white p-5 md:p-8 rounded-[2.5rem] shadow-sm space-y-4 border border-slate-100">
          <h2 className="text-lg font-black flex items-center gap-2 uppercase tracking-tighter text-black"><Zap className="text-primary" size={18} /> Potencia con carga</h2>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-3 items-end">
            <div className="md:col-span-3">
              <StableInput label="Potencia con carga" value={formData.potenciaConCarga.potencia} onChange={(v: any) => handleNestedInputChange('potenciaConCarga', 'potencia', v)} />
            </div>
            <div className="md:col-span-3 space-y-2">
              <h4 className="text-[8px] font-black text-center text-slate-400 uppercase tracking-widest">Tensión</h4>
              <div className="grid grid-cols-3 gap-1.5">
                <LoadTestInput label="RS" value={formData.potenciaConCarga.tensionRS} onChange={(v: any) => handleNestedInputChange('potenciaConCarga', 'tensionRS', v)} />
                <LoadTestInput label="ST" value={formData.potenciaConCarga.tensionST} onChange={(v: any) => handleNestedInputChange('potenciaConCarga', 'tensionST', v)} />
                <LoadTestInput label="RT" value={formData.potenciaConCarga.tensionRT} onChange={(v: any) => handleNestedInputChange('potenciaConCarga', 'tensionRT', v)} />
              </div>
            </div>
            <div className="md:col-span-3 space-y-2">
              <h4 className="text-[8px] font-black text-center text-slate-400 uppercase tracking-widest">Intensidad</h4>
              <div className="grid grid-cols-3 gap-1.5">
                <LoadTestInput label="R" value={formData.potenciaConCarga.intensidadR} onChange={(v: any) => handleNestedInputChange('potenciaConCarga', 'intensidadR', v)} />
                <LoadTestInput label="S" value={formData.potenciaConCarga.intensidadS} onChange={(v: any) => handleNestedInputChange('potenciaConCarga', 'intensidadS', v)} />
                <LoadTestInput label="T" value={formData.potenciaConCarga.intensidadT} onChange={(v: any) => handleNestedInputChange('potenciaConCarga', 'intensidadT', v)} />
              </div>
            </div>
            <div className="md:col-span-3 space-y-2">
              <h4 className="text-[8px] font-black text-center text-slate-400 uppercase tracking-widest">Potencia (kW)</h4>
              <LoadTestInput label="kW" value={formData.potenciaConCarga.potenciaKW} onChange={(v: any) => handleNestedInputChange('potenciaConCarga', 'potenciaKW', v)} />
            </div>
          </div>
        </section>

        <section className="bg-white p-5 md:p-8 rounded-[2.5rem] shadow-sm space-y-4 border border-slate-100">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-black uppercase tracking-tighter text-black">Trabajos Realizados</h2>
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
            value={formData.trabajos_realizados}
            onChange={(next) => handleInputChange('trabajos_realizados', next)}
          />
          <textarea
            className="w-full h-40 bg-slate-50 border border-slate-200 rounded-xl p-4 resize-none font-medium text-black outline-none focus:border-primary focus:bg-white transition-all shadow-inner text-sm"
            value={formData.trabajos_realizados}
            onChange={(e: any) => handleInputChange('trabajos_realizados', e.target.value)}
            placeholder="Describa aquí detalladamente las intervenciones realizadas..."
            spellCheck="true"
            lang="es"
            autoCorrect="on"
            autoCapitalize="sentences"
          />

        </section>

        <section className="bg-white p-5 md:p-8 rounded-[2.5rem] shadow-sm space-y-4 border border-slate-100">
          <h2 className="text-lg font-black flex items-center gap-2 uppercase tracking-tighter text-black"><Camera className="text-primary" size={18} /> Evidencia Fotográfica</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="image-upload-camera" className="w-full cursor-pointer bg-slate-50 border border-dashed border-slate-200 rounded-[2rem] p-6 flex flex-col items-center justify-center text-center hover:bg-white hover:border-primary transition-all group active:scale-[0.99]">
                <Camera size={32} className="text-slate-300 mb-1.5 group-hover:text-primary transition-colors" />
                <span className="font-black text-slate-400 uppercase text-[10px] tracking-widest">Cámara</span>
              </label>
              <input id="image-upload-camera" type="file" multiple accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageChange(e, 'camera')} />
            </div>
            <div>
              <label htmlFor="image-upload-gallery" className="w-full cursor-pointer bg-slate-50 border border-dashed border-slate-200 rounded-[2rem] p-6 flex flex-col items-center justify-center text-center hover:bg-white hover:border-primary transition-all group active:scale-[0.99]">
                <ImageIcon size={32} className="text-slate-300 mb-1.5 group-hover:text-primary transition-colors" />
                <span className="font-black text-slate-400 uppercase text-[10px] tracking-widest">Galería</span>
              </label>
              <input id="image-upload-gallery" type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleImageChange(e, 'gallery')} />
            </div>
          </div>
          {(images.length > 0 || (formData.imageUrls && formData.imageUrls.length > 0)) && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-2">
              {/* Guardadas */}
              {(formData.imageUrls || []).map((url, i) => (
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

        <section className="bg-white p-5 md:p-8 rounded-[2.5rem] shadow-sm space-y-6 border border-slate-100">
          <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-3 text-left">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${includeClientSignature ? 'bg-primary text-white' : 'bg-slate-200 text-slate-400'}`}>
                <Users size={20} />
              </div>
              <div>
                <p className="text-xs font-black text-slate-700 uppercase tracking-tighter">¿Incluir Firma del Cliente?</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Activar solo si el cliente firmará en persona</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={includeClientSignature}
                onChange={(e) => setIncludeClientSignature(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-inner"></div>
            </label>
          </div>

          <h2 className="text-lg font-black uppercase tracking-tighter text-black">Validación y Firmas</h2>
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="space-y-4 text-left">
              <SignaturePad title="Firma del Técnico Inspector" signature={inspectorSignature} onSignatureEnd={setInspectorSignature} showSavedSignature={true} />
              <p className="text-center font-black text-slate-400 text-[8px] uppercase tracking-widest">{inspectorName}</p>
            </div>
            {includeClientSignature && (
              <div className="space-y-4 text-left animate-in zoom-in duration-300">
                <SignaturePad title="Conforme Cliente / Receptor" signature={clientSignature} onSignatureEnd={setClientSignature} />
                <div className="mt-4">
                  <StableInput label="Nombre de la persona que recibe" icon={User} value={formData.recibidoPor} onChange={(v: any) => handleInputChange('recibidoPor', v)} placeholder="Nombre completo" />
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
