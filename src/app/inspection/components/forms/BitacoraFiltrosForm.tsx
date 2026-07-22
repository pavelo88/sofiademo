'use client';

/* eslint-disable @next/next/no-img-element -- QA: warning reviewed; keeping current flow to avoid behavioral changes. */

import { drawPdfFooter, drawPdfHeader } from '@/app/inspection/lib/pdf-helpers';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useFirestore, useUser } from '@/firebase';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { useToast } from '@/hooks/use-toast';
import { renderImageGallery } from '@/lib/pdf-utils';
import { formatTechnicianName } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { collection, doc, getDocs, orderBy, query, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadString } from 'firebase/storage';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Calendar as CalendarIcon,
  Camera,
  ChevronRight,
  Clock,
  Download,
  Droplets,
  FileText,
  Filter,
  Fuel,
  Loader2,
  Mic,
  MicOff,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  User as UserIcon,
  X,
  Zap
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

type FiltroLine = {
  tipo: string;
  cantidad: number | '';
  referencia: string;
};

export default function BitacoraFiltrosForm({ initialData }: { initialData?: any }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [filtroTipos, setFiltroTipos] = useState<string[]>([
    'Filtro de aceite',
    'Filtro de combustible',
    'Filtro de agua',
    'Filtro de aire',
    'Prefiltro de aceite',
    'Prefiltro de combustible',
    'Filtro de aceite bypass'
  ]);

  const [formData, setFormData] = useState({
    hora: format(new Date(), 'HH:mm'),
    tecnico: user?.displayName || '',
    instalacion: initialData?.instalacion || '',
    clienteId: initialData?.clienteId || '',
    clienteNombre: initialData?.clienteNombre || '',
    bateria: '',
    resistenciaCaldeo: '',
    litrosAceite: '' as number | '',
    litrosAnticongelante: '' as number | '',
    litrosCombustible: '' as number | '',
  });

  const [filtros, setFiltros] = useState<FiltroLine[]>(
    initialData?.filtros || [{ tipo: '', cantidad: '', referencia: '' }]
  );

  const [images, setImages] = useState<string[]>([]);

  const [activeView, setActiveView] = useState<'registro' | 'revision'>('registro');
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchTermHistory, setSearchTermHistory] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [isListening, setIsListening] = useState(false);

  const processIntelligentDictation = (transcript: string) => {
    const text = transcript.toLowerCase();
    const newFormData = { ...formData };
    let newFiltros = [...filtros];

    // Parsing fields
    if (text.includes('batería')) {
      const match = text.match(/batería\s+([^,.]+)/);
      if (match) newFormData.bateria = match[1].trim();
    }
    if (text.includes('resistencia')) {
      const match = text.match(/resistencia\s+([^,.]+)/);
      if (match) newFormData.resistenciaCaldeo = match[1].trim();
    }
    if (text.includes('aceite')) {
      const match = text.match(/aceite\s+(\d+)/);
      if (match) newFormData.litrosAceite = Number(match[1]);
    }
    if (text.includes('anticongelante')) {
      const match = text.match(/anticongelante\s+(\d+)/);
      if (match) newFormData.litrosAnticongelante = Number(match[1]);
    }
    if (text.includes('combustible')) {
      const match = text.match(/combustible\s+(\d+)/);
      if (match) newFormData.litrosCombustible = Number(match[1]);
    }

    // Parsing filters: "filtro [tipo] [cantidad] [referencia]"
    // Example: "agregar filtro de aceite 5 unidades referencia x20"
    if (text.includes('filtro')) {
      const filterMatches = text.split('filtro').slice(1);
      filterMatches.forEach(f => {
        const typeMatch = f.match(/(.*?)\s+(\d+)\s+unidades\s+referencia\s+(.*)/) || f.match(/(.*?)\s+(\d+)\s+(.*)/);
        if (typeMatch) {
          const tipo = typeMatch[1].trim();
          const cantidad = Number(typeMatch[2].trim()) || '';
          const referencia = typeMatch[3].trim();

          // Add or update
          if (newFiltros.length === 1 && !newFiltros[0].tipo) {
            newFiltros = [{ tipo, cantidad, referencia }];
          } else {
            newFiltros.push({ tipo, cantidad, referencia });
          }
        }
      });
    }

    setFormData(newFormData);
    setFiltros(newFiltros);
    toast({ title: "Dictado Procesado", description: "El formulario se ha actualizado con tu voz." });
  };

  const startGlobalDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "No soportado", description: "Tu navegador no soporta dictado por voz.", variant: "destructive" });
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      processIntelligentDictation(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  // Cargar Clientes, Tipos de Filtros y Nombre del Inspector
  useEffect(() => {
    const fetchData = async () => {
      if (!firestore) return;
      try {
        const clientsSnap = await getDocs(query(collection(firestore, 'clientes'), orderBy('nombre')));
        setClients(clientsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        const configSnap = await getDocs(collection(firestore, 'config_filtros_tipos'));
        if (!configSnap.empty) {
          setFiltroTipos(configSnap.docs.map(d => d.data().nombre));
        }

        // Resolver nombre del inspector
        if (user?.email) {
          const userDoc = await getDocs(query(collection(firestore, 'usuarios'), where('email', '==', user.email)));
          if (!userDoc.empty) {
            const userData = userDoc.docs[0].data();
            setFormData(prev => ({ ...prev, tecnico: String(userData.nombre || userData.displayName || user.displayName || user.email?.split('@')[0] || '') }));
          } else if (user.displayName) {
            setFormData(prev => ({ ...prev, tecnico: user.displayName || '' }));
          }
        }
      } catch (e) {
        console.error("Error fetching data:", e);
      }
    };
    fetchData();
  }, [firestore, user]);

  useEffect(() => {
    if (activeView === 'revision' && firestore && user?.email) {
      const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
          // Eliminamos el orderBy para evitar el error de índice de Firebase
          const q = query(
            collection(firestore, 'bitacora_filtros'),
            where('tecnicoEmail', '==', user.email)
          );
          const snap = await getDocs(q);
          const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

          // Ordenamos localmente por fecha descendente
          data.sort((a: any, b: any) => {
            const dateA = a.fecha?.toMillis?.() || 0;
            const dateB = b.fecha?.toMillis?.() || 0;
            return dateB - dateA;
          });

          setHistory(data);
        } catch (e) {
          console.error("Error loading history:", e);
        } finally {
          setLoadingHistory(false);
        }
      };
      fetchHistory();
    }
  }, [activeView, firestore, user]);

  const filteredHistory = history.filter(h =>
    (h.instalacion?.toLowerCase().includes(searchTermHistory.toLowerCase())) ||
    (h.clienteNombre?.toLowerCase().includes(searchTermHistory.toLowerCase()))
  );

  const generatePDF = (entry: any) => {
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.width;

    // Header Estándar
    drawPdfHeader(doc);

    // Título del Informe (Abajo del header)
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORME TÉCNICO - BITÁCORA DE FILTROS', pageWidth / 2, 45, { align: 'center' });

    // Info Block
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.text('DATOS GENERALES', margin, 60);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, 62, 190, 62);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Cliente: ${entry.clienteNombre}`, margin, 70);
    doc.text(`Instalación: ${entry.instalacion}`, margin, 75);
    doc.text(`Fecha: ${format(entry.fecha?.toDate(), "PPP", { locale: es })}`, margin, 80);
    doc.text(`Inspector: ${formatTechnicianName(entry.tecnico)}`, margin, 85);

    // Parameters
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PARÁMETROS TÉCNICOS', margin, 100);
    doc.line(margin, 103, 190, 103);

    const params = [
      ['Batería', entry.bateria],
      ['Resistencia Caldeo', entry.resistenciaCaldeo],
      ['Litros Aceite', `${entry.litrosAceite} L`],
      ['Litros Anticongelante', `${entry.litrosAnticongelante} L`],
    ];

    if (entry.litrosCombustible) {
      params.push(['Litros Combustible', `${entry.litrosCombustible} L`]);
    }

    autoTable(doc, {
      startY: 108,
      head: [['Parámetro', 'Valor']],
      body: params,
      theme: 'striped',
      headStyles: { fillColor: [22, 90, 48] }
    });

    // Filters Table
    const filtersY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(11);
    doc.text('DETALLE DE FILTROS SUSTITUIDOS', margin, filtersY);
    doc.line(margin, filtersY + 3, 190, filtersY + 3);

    const filtersBody = (entry.filtros || []).map((f: any) => [f.tipo, f.cantidad, f.referencia]);

    autoTable(doc, {
      startY: filtersY + 8,
      head: [['Tipo de Filtro', 'Cant.', 'Referencia']],
      body: filtersBody,
      theme: 'grid',
      headStyles: { fillColor: [22, 90, 48] }
    });

    // --- REGISTRO FOTOGRÁFICO ---
    if (entry.imageUrls && entry.imageUrls.length > 0) {
      renderImageGallery(doc, entry.imageUrls);
    }

    // Header and Footer loop
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawPdfHeader(doc);
      drawPdfFooter(doc, i, totalPages);
    }

    doc.save(`${entry.instalacion}-${entry.clienteNombre}.pdf`);
    toast({ title: "PDF Generado", description: "El informe se ha descargado correctamente." });
  };

  const handleAddFiltro = () => {
    setFiltros([...filtros, { tipo: '', cantidad: '', referencia: '' }]);
  };

  const handleRemoveFiltro = (index: number) => {
    if (filtros.length === 1) {
      setFiltros([{ tipo: '', cantidad: '', referencia: '' }]);
    } else {
      setFiltros(filtros.filter((_, i) => i !== index));
    }
  };

  const handleFiltroChange = (index: number, field: keyof FiltroLine, value: any) => {
    const newFiltros = [...filtros];
    newFiltros[index] = { ...newFiltros[index], [field]: value };
    setFiltros(newFiltros);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const validate = () => {
    const missing = [];
    if (!formData.instalacion) missing.push("INSTALACIÓN");
    if (!formData.clienteId) missing.push("CLIENTE");
    if (!formData.bateria) missing.push("BATERÍA");
    if (!formData.resistenciaCaldeo) missing.push("RESISTENCIA DE CALDEO");
    if (formData.litrosAceite === '') missing.push("LITROS DE ACEITE");
    if (formData.litrosAnticongelante === '') missing.push("LITROS DE ANTICONGELANTE");
    if (images.length === 0) missing.push("EVIDENCIA FOTOGRÁFICA");

    if (missing.length === 1) {
      return `Falta el campo obligatorio: ${missing[0]}`;
    } else if (missing.length > 1) {
      return "Los campos señalados con (*) son obligatorios.";
    }

    // Validar líneas de filtros
    for (const f of filtros) {
      if (f.tipo && (!f.cantidad || !f.referencia)) {
        return "Si selecciona un tipo de filtro, la cantidad y referencia son obligatorias.";
      }
    }

    return null;
  };

  const handleSubmit = async () => {
    const errorMsg = validate();
    if (errorMsg) {
      toast({ title: "Atención", description: errorMsg, variant: "destructive" });
      return;
    }

    if (!firestore || !isOnline) {
      toast({ title: "Error", description: "Debes estar en línea para registrar esta bitácora.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const storage = getStorage();
      const timestamp = Date.now();

      // 1. Subir Imágenes
      const imageUrls = await Promise.all(images.map(async (base64, index) => {
        const imageRef = ref(storage, `bitacora_filtros/${timestamp}_${index}.jpg`);
        await uploadString(imageRef, base64, 'data_url');
        return getDownloadURL(imageRef);
      }));

      // 2. Buscar/Crear Instalación
      // En una implementación real, buscaríamos si la instalación ya existe para actualizar sus "filtros fijos".
      // Por ahora, simplemente guardamos el nombre.

      const docData = {
        ...formData,
        tecnicoEmail: user?.email,
        filtros: filtros.filter(f => f.tipo), // Solo los que tienen tipo
        imageUrls,
        fecha: Timestamp.now(),
        fechaStr: format(new Date(), 'yyyy-MM-dd'),
        estado: 'Registrado'
      };

      // Generar ID manejable: Instalación-Cliente-Fecha
      const docId = `${formData.instalacion.replace(/\s+/g, '_')}-${formData.clienteNombre.replace(/\s+/g, '_')}-${format(new Date(), 'yyyyMMdd_HHmm')}`;
      const docRef = doc(firestore, 'bitacora_filtros', docId);
      await setDoc(docRef, docData);

      // 3. (Opcional) Actualizar o Crear registro de instalación para consulta administrativa
      const instRef = doc(firestore, 'instalaciones', formData.instalacion.toUpperCase().replace(/\s+/g, '_'));
      await setDoc(instRef, {
        nombre: formData.instalacion,
        clienteId: formData.clienteId,
        clienteNombre: formData.clienteNombre,
        filtrosFijos: filtros.filter(f => f.tipo),
        ultimaActualizacion: serverTimestamp()
      }, { merge: true });

      toast({ title: "¡Éxito!", description: "Bitácora de filtros registrada correctamente." });

      // Resetear
      setImages([]);
      setFiltros([{ tipo: '', cantidad: '', referencia: '' }]);
      setFormData(prev => ({
        ...prev,
        instalacion: '',
        bateria: '',
        resistenciaCaldeo: '',
        litrosAceite: '',
        litrosAnticongelante: '',
        litrosCombustible: '',
      }));

    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo guardar la bitácora.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32">

      {/* SELECTOR DE VISTA */}
      <section className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-900 text-primary rounded-2xl flex items-center justify-center shadow-lg">
              <Filter size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter leading-none">Bitácora de Filtros</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Registro Técnico de Insumos</p>
            </div>
          </div>

          <Button
            onClick={startGlobalDictation}
            className={`h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] gap-3 transition-all ${isListening ? 'bg-red-500 hover:bg-red-600 animate-pulse text-white' : 'bg-[#165a30] hover:bg-[#0f4022] text-white shadow-xl shadow-[#165a30]/20'}`}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            {isListening ? 'Escuchando...' : 'Dictado'}
          </Button>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setActiveView('registro')}
            className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex-1 md:flex-none ${activeView === 'registro' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Registro
          </button>
          <button
            onClick={() => setActiveView('revision')}
            className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex-1 md:flex-none ${activeView === 'revision' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Revisión
          </button>
        </div>
      </section>

      {activeView === 'registro' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* SECCIÓN 1: ENCABEZADO */}
          <section className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                  <Clock size={12} className="text-[#165a30]" /> HORA
                </label>
                <Input
                  value={formData.hora}
                  readOnly
                  className="bg-slate-50 border-none font-bold h-12 rounded-2xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                  <UserIcon size={12} className="text-[#165a30]" /> INSPECTOR
                </label>
                <Input
                  value={formData.tecnico}
                  readOnly
                  disabled
                  placeholder="Usuario en sesión"
                  className="bg-slate-100 border-none font-bold h-12 rounded-2xl text-slate-500"
                />
              </div>
            </div>
          </section>

          {/* SECCIÓN 2: DATOS PRINCIPALES */}
          <section className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 bg-[#165a30]/10 rounded-xl flex items-center justify-center text-[#165a30]">
                <FileText size={20} />
              </div>
              <h3 className="font-black text-slate-900 uppercase tracking-tighter">Datos de la Instalación</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center">
                  INSTALACIÓN <span className="text-red-500 font-black ml-1 text-sm">*</span>
                </label>
                <Input
                  placeholder="Nombre o Código de la Planta..."
                  value={formData.instalacion}
                  onChange={(e) => setFormData({ ...formData, instalacion: e.target.value })}
                  className="bg-slate-50 border-none font-bold h-14 rounded-2xl placeholder:text-slate-300"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center">
                  CLIENTE <span className="text-red-500 font-black ml-1 text-sm">*</span>
                </label>
                <Select
                  value={formData.clienteId}
                  onValueChange={(val) => {
                    const c = clients.find(cl => cl.id === val);
                    setFormData({ ...formData, clienteId: val, clienteNombre: c?.nombre || '' });
                  }}
                >
                  <SelectTrigger className="bg-slate-50 border-none font-bold h-14 rounded-2xl">
                    <SelectValue placeholder="Seleccionar cliente..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-100">
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id} className="font-bold py-3">{c.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* SECCIÓN 3: DETALLE DE FILTROS */}
          <section className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#165a30]/10 rounded-xl flex items-center justify-center text-[#165a30]">
                  <Filter size={20} />
                </div>
                <h3 className="font-black text-slate-900 uppercase tracking-tighter flex items-center">
                  Detalle de Filtros <span className="text-red-500 font-black ml-1 text-base">*</span>
                </h3>
              </div>
              <span className="text-[9px] font-black text-[#165a30] bg-[#165a30]/5 px-3 py-1 rounded-full uppercase tracking-widest">
                {filtros.length} Líneas
              </span>
            </div>

            <div className="space-y-4">
              {filtros.map((item, index) => (
                <div key={index} className="flex flex-col md:flex-row gap-3 items-end md:items-center bg-slate-50/50 p-4 rounded-3xl border border-slate-50 relative animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex-1 w-full space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">TIPO</label>
                    <Select value={item.tipo} onValueChange={(val) => handleFiltroChange(index, 'tipo', val)}>
                      <SelectTrigger className="bg-white border-slate-100 font-bold h-12 rounded-xl">
                        <SelectValue placeholder="Elegir filtro..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {filtroTipos.map(t => (
                          <SelectItem key={t} value={t} className="font-bold">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-full md:w-24 space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">CANT.</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={item.cantidad}
                      onChange={(e) => handleFiltroChange(index, 'cantidad', e.target.value)}
                      className="bg-white border-slate-100 font-bold h-12 rounded-xl text-center"
                    />
                  </div>
                  <div className="flex-[2] w-full space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">REFERENCIA</label>
                    <Input
                      placeholder="Ref. o código..."
                      value={item.referencia}
                      onChange={(e) => handleFiltroChange(index, 'referencia', e.target.value)}
                      className="bg-white border-slate-100 font-bold h-12 rounded-xl"
                    />
                  </div>
                  <button
                    onClick={() => handleRemoveFiltro(index)}
                    className="p-3 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              onClick={handleAddFiltro}
              className="w-full md:w-auto h-12 rounded-2xl border-[#165a30]/20 text-[#165a30] font-black uppercase text-[10px] tracking-widest hover:bg-[#165a30]/5 gap-2 px-6"
            >
              <Plus size={16} /> Añadir otra línea de filtro
            </Button>
          </section>

          {/* SECCIÓN 4: REVISIONES */}
          <section className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 bg-[#165a30]/10 rounded-xl flex items-center justify-center text-[#165a30]">
                <Zap size={20} />
              </div>
              <h3 className="font-black text-slate-900 uppercase tracking-tighter">Revisiones Técnicas</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center">
                  BATERÍA <span className="text-red-500 font-black ml-1 text-sm">*</span>
                </label>
                <Input
                  placeholder="Estado / Voltaje..."
                  value={formData.bateria}
                  onChange={(e) => setFormData({ ...formData, bateria: e.target.value })}
                  className="bg-slate-50 border-none font-bold h-14 rounded-2xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center">
                  RESISTENCIA DE CALDEO <span className="text-red-500 font-black ml-1 text-sm">*</span>
                </label>
                <Input
                  placeholder="Observaciones..."
                  value={formData.resistenciaCaldeo}
                  onChange={(e) => setFormData({ ...formData, resistenciaCaldeo: e.target.value })}
                  className="bg-slate-50 border-none font-bold h-14 rounded-2xl"
                />
              </div>
            </div>
          </section>

          {/* SECCIÓN 5: FLUIDOS */}
          <section className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 bg-[#165a30]/10 rounded-xl flex items-center justify-center text-[#165a30]">
                <Droplets size={20} />
              </div>
              <h3 className="font-black text-slate-900 uppercase tracking-tighter">Control de Fluidos</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center">
                  LITROS DE ACEITE <span className="text-red-500 font-black ml-1 text-sm">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.litrosAceite}
                    onChange={(e) => setFormData({ ...formData, litrosAceite: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="bg-slate-50 border-none font-bold h-14 rounded-2xl pr-10"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-300">L</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center">
                  LITROS DE ANTICONGELANTE <span className="text-red-500 font-black ml-1 text-sm">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.litrosAnticongelante}
                    onChange={(e) => setFormData({ ...formData, litrosAnticongelante: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="bg-slate-50 border-none font-bold h-14 rounded-2xl pr-10"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-300">L</span>
                </div>
              </div>
            </div>
          </section>

          {/* SECCIÓN 6: COMBUSTIBLE */}
          <section className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 bg-[#165a30]/10 rounded-xl flex items-center justify-center text-[#165a30]">
                <Fuel size={20} />
              </div>
              <h3 className="font-black text-slate-900 uppercase tracking-tighter">Combustible</h3>
            </div>

            <div className="space-y-2 max-w-md">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">LITROS DEPÓSITO COMBUSTIBLE (OPCIONAL)</label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="Opcional"
                  value={formData.litrosCombustible}
                  onChange={(e) => setFormData({ ...formData, litrosCombustible: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="bg-slate-50 border-none font-bold h-14 rounded-2xl pr-10"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-300">L</span>
              </div>
            </div>
          </section>

          {/* SECCIÓN 7: EVIDENCIA FOTOGRÁFICA */}
          <section className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#165a30]/10 rounded-xl flex items-center justify-center text-[#165a30]">
                  <Camera size={20} />
                </div>
                <h3 className="font-black text-slate-900 uppercase tracking-tighter flex items-center">
                  Evidencia Fotográfica <span className="text-red-500 font-black ml-1 text-base">*</span>
                </h3>
              </div>
              <span className="text-[9px] font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-full uppercase tracking-widest">
                Mínimo 1 Foto
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {images.map((img, i) => (
                <div key={i} className="group relative aspect-square bg-slate-100 rounded-[1.5rem] overflow-hidden shadow-sm border border-slate-100 animate-in fade-in zoom-in-95 duration-300">
                  <img src={img} alt="Evidencia" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/50 backdrop-blur-md text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-[1.5rem] flex flex-col items-center justify-center gap-2 text-slate-400 hover:bg-slate-100 hover:border-[#165a30]/50 hover:text-[#165a30] transition-all group"
              >
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <Plus size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Agregar Foto</span>
              </button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              accept="image/*"
              onChange={handleImageUpload}
            />
          </section>

          {/* ACCIÓN FINAL */}
          <div className="pt-8">
            <Button
              disabled={loading}
              onClick={handleSubmit}
              className="w-full h-20 rounded-[2.5rem] bg-[#165a30] hover:bg-[#0f4022] text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                <>
                  <Save size={24} /> Guardar / Finalizar
                </>
              )}
            </Button>
          </div>

        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
          {/* FILTRO DE BÚSQUEDA */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <Input
              placeholder="Buscar por instalación o cliente..."
              value={searchTermHistory}
              onChange={(e) => setSearchTermHistory(e.target.value)}
              className="w-full h-14 pl-12 rounded-2xl bg-white border-slate-100 font-bold shadow-sm"
            />
          </div>

          {loadingHistory ? (
            <div className="py-20 flex justify-center items-center"><Loader2 className="h-10 w-10 animate-spin text-[#165a30]" /></div>
          ) : filteredHistory.length === 0 ? (
            <div className="bg-white p-16 rounded-[2.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                <FileText size={40} />
              </div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No se encontraron registros</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredHistory.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:border-[#165a30]/40 hover:shadow-xl hover:shadow-[#165a30]/5 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-slate-50 rounded-[1.25rem] flex items-center justify-center text-slate-400 group-hover:bg-[#165a30]/10 group-hover:text-[#165a30] transition-all duration-300">
                      <FileText size={28} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">{entry.instalacion}</h4>
                        <Badge variant="secondary" className={`text-[8px] font-black uppercase ${entry.estado === 'Aprobado' ? 'bg-[#165a30]/10 text-[#165a30]' : 'bg-blue-100 text-blue-700'}`}>
                          {entry.estado}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                        <span className="flex items-center gap-1.5"><UserIcon size={14} className="text-slate-300" /> {entry.clienteNombre}</span>
                        <span className="flex items-center gap-1.5"><CalendarIcon size={14} className="text-slate-300" /> {format(entry.fecha?.toDate(), "d MMM yyyy", { locale: es })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="hidden md:flex flex-col items-end">
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Filtros</span>
                      <span className="text-base font-black text-slate-700">{(entry.filtros || []).length}</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-[#165a30] group-hover:text-white transition-all shadow-inner">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL DE DETALLES (REDISEÑADO COMO INFORME) */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-4xl bg-white rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden outline-none">
          {selectedEntry && (
            <div className="flex flex-col h-[90vh]">
              {/* HEADER TIPO INFORME */}
              <div className="bg-slate-900 p-8 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative">
                <div className="space-y-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-[#165a30] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#165a30]/20">
                      <ShieldCheck size={24} />
                    </div>
                    <span className="text-[10px] font-black tracking-[0.3em] uppercase text-[#165a30]">Energy Engine • Technical Report</span>
                  </div>
                  <DialogTitle className="text-4xl font-black uppercase tracking-tighter leading-none">
                    {selectedEntry.instalacion}
                  </DialogTitle>
                  <p className="text-slate-400 font-bold text-sm uppercase tracking-wide">
                    {selectedEntry.clienteNombre} • {format(selectedEntry.fecha?.toDate(), "d 'de' MMMM, yyyy", { locale: es })}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => generatePDF(selectedEntry)}
                    className="bg-white/10 hover:bg-white/20 text-white border-none h-12 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 px-6"
                  >
                    <Download size={16} /> Descargar PDF
                  </Button>
                  <button onClick={() => setSelectedEntry(null)} className="w-12 h-12 bg-white/5 text-white/40 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
                    <X size={24} />
                  </button>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-8 space-y-12">

                  {/* SECCIÓN 1: RESUMEN DE PARÁMETROS */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                        <Zap size={16} />
                      </div>
                      <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Parámetros de Inspección</h3>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="bg-slate-50 p-5 rounded-3xl space-y-1 border border-slate-100/50">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Batería</p>
                        <p className="text-base font-black text-slate-900">{selectedEntry.bateria}</p>
                      </div>
                      <div className="bg-slate-50 p-5 rounded-3xl space-y-1 border border-slate-100/50">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Resistencia</p>
                        <p className="text-base font-black text-slate-900">{selectedEntry.resistenciaCaldeo}</p>
                      </div>
                      <div className="bg-[#165a30]/10 p-5 rounded-3xl space-y-1 border border-[#165a30]/20">
                        <p className="text-[9px] font-black text-[#165a30] uppercase tracking-widest">Aceite</p>
                        <p className="text-xl font-black text-[#165a30]">{selectedEntry.litrosAceite} L</p>
                      </div>
                      <div className="bg-[#165a30]/10 p-5 rounded-3xl space-y-1 border border-[#165a30]/20">
                        <p className="text-[9px] font-black text-[#165a30] uppercase tracking-widest">Anticongelante</p>
                        <p className="text-xl font-black text-[#165a30]">{selectedEntry.litrosAnticongelante} L</p>
                      </div>
                      <div className="bg-amber-50/50 p-5 rounded-3xl space-y-1 border border-amber-100/50">
                        <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Combustible</p>
                        <p className="text-xl font-black text-amber-700">{selectedEntry.litrosCombustible || '-'} L</p>
                      </div>
                    </div>
                  </div>

                  {/* SECCIÓN 2: TABLA DE INSUMOS */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                        <Filter size={16} />
                      </div>
                      <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Filtros Sustituidos</h3>
                    </div>

                    <div className="border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50">
                          <tr className="text-[10px] font-black text-slate-500 uppercase tracking-[0.1em]">
                            <th className="p-5">Descripción del Insumo</th>
                            <th className="p-5 text-center">Cantidad</th>
                            <th className="p-5">Referencia Técnica</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {(selectedEntry.filtros || []).map((f: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                              <td className="p-5 font-bold text-slate-800">{f.tipo}</td>
                              <td className="p-5 text-center">
                                <span className="bg-[#165a30]/10 text-[#165a30] font-black px-3 py-1 rounded-lg text-sm">{f.cantidad}</span>
                              </td>
                              <td className="p-5 font-mono text-slate-500 text-sm">{f.referencia}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* SECCIÓN 3: EVIDENCIA VISUAL */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                        <Camera size={16} />
                      </div>
                      <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Evidencia Fotográfica de Campo</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                      {(selectedEntry.imageUrls || []).map((url: string, i: number) => (
                        <div key={i} className="group relative aspect-[4/3] rounded-[2rem] overflow-hidden border border-slate-200 shadow-xl">
                          <img
                            src={url}
                            alt={`Registro ${i}`}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button
                              variant="outline"
                              className="bg-white text-slate-900 border-none font-black uppercase text-[10px] tracking-widest rounded-xl"
                              onClick={() => window.open(url, '_blank')}
                            >
                              Ampliar Imagen
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator className="bg-slate-100" />

                  {/* FOOTER DEL INFORME */}
                  <div className="flex flex-col md:flex-row justify-between items-center gap-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                        <UserIcon size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inspector Responsable</p>
                        <p className="text-sm font-black text-slate-800">{selectedEntry.tecnico}</p>
                      </div>
                    </div>
                    <div className="text-center md:text-right">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">ID Registro Digital</p>
                      <p className="text-[10px] font-mono text-slate-400">{selectedEntry.id}</p>
                    </div>
                  </div>
                </div>
              </ScrollArea>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck size={14} className="text-[#165a30]" /> Documento Verificado por Energy Engine Cloud
                </p>
                <Button
                  onClick={() => setSelectedEntry(null)}
                  className="h-14 rounded-2xl bg-[#165a30] hover:bg-[#0f4022] text-white font-black uppercase tracking-widest px-10 shadow-xl active:scale-95 transition-all"
                >
                  Cerrar Informe
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
