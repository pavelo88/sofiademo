'use client';

/* eslint-disable react-hooks/set-state-in-effect -- QA: warning reviewed; keeping current flow to avoid behavioral changes. */

import { drawPdfFooter, drawPdfHeader } from '@/app/inspection/lib/pdf-helpers';
import { Button } from '@/components/ui/button';
import { Calendar } from "@/components/ui/calendar";
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { formatTechnicianName } from '@/lib/utils';
import { endOfDay, format, isWithinInterval, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { collection, doc, getDocs, limit, orderBy, query, startAfter, Timestamp, updateDoc } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ArrowRight,
  CalendarIcon,
  Database,
  Droplets,
  FileText,
  Fuel,
  History,
  Loader2,
  Plus,
  Search
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAdminHeader } from './AdminHeaderContext';

function AdminDatePicker({ date, setDate, placeholder }: { date: Date | undefined; setDate: (d: Date | undefined) => void; placeholder: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={`w-full h-14 justify-start font-bold rounded-2xl border-slate-100 bg-slate-50 hover:bg-slate-100 ${date ? 'text-slate-900' : 'text-slate-400'}`}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "dd/MM/yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-none bg-transparent shadow-2xl" align="start">
        <Calendar mode="single" selected={date} onSelect={(d) => { setDate(d); setIsOpen(false); }} locale={es} initialFocus />
      </PopoverContent>
    </Popover>
  );
}

// SUB-COMPONENTES MODULARES
import LogDetailModal from './filters/LogDetailModal';
import LogEditModal from './filters/LogEditModal';

interface FiltroItem {
  tipo: string;
  cantidad: string;
  referencia: string;
}

interface LogEntry {
  id: string;
  bateria: string;
  clienteId: string;
  clienteNombre: string;
  estado: string;
  fecha: any;
  filtros: FiltroItem[];
  imageUrls: string[];
  instalacion: string;
  litrosAceite: string;
  litrosAnticongelante: string;
  litrosCombustible: string;
  resistenciaCaldeo: string;
  tecnico: string;
  tecnicoEmail: string;
}

export default function FiltersLogPage() {
  const db = useFirestore();
  const { setHeaderProps } = useAdminHeader();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [fechaDesde, setFechaDesde] = useState<Date | undefined>(undefined);
  const [fechaHasta, setFechaHasta] = useState<Date | undefined>(undefined);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // MODALES
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [isViewLogModalOpen, setIsViewLogModalOpen] = useState(false);
  const [isEditLogModalOpen, setIsEditLogModalOpen] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // 3. Logic: Filters
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const d = log.fecha?.toDate ? log.fecha.toDate() : new Date(log.fecha);
      const matchesSearch = (log.clienteNombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.instalacion || '').toLowerCase().includes(searchTerm.toLowerCase());
      let matchesFecha = true;
      if (fechaDesde && fechaHasta) {
        matchesFecha = isWithinInterval(d, { start: startOfDay(fechaDesde), end: endOfDay(fechaHasta) });
      } else if (fechaDesde) {
        matchesFecha = d >= startOfDay(fechaDesde);
      } else if (fechaHasta) {
        matchesFecha = d <= endOfDay(fechaHasta);
      }

      return matchesSearch && matchesFecha;
    });
  }, [logs, searchTerm, fechaDesde, fechaHasta]);

  // 5. Handlers (Exports)
  const handleExportExcel = useCallback(() => {
    if (filteredLogs.length === 0) {
      return toast({ variant: "destructive", title: "Sin datos", description: "No hay registros filtrados para exportar." });
    }
    const dataToExport = filteredLogs.map(log => ({
      Fecha: format(log.fecha?.toDate ? log.fecha.toDate() : new Date(), "dd/MM/yyyy"),
      Inspector: formatTechnicianName(log.tecnico || log.tecnicoEmail || ''),
      Email: log.tecnicoEmail,
      Cliente: log.clienteNombre,
      Instalación: log.instalacion,
      Batería: log.bateria,
      Resistencia: log.resistenciaCaldeo,
      'Aceite (L)': log.litrosAceite || 0,
      'Anticongelante (L)': log.litrosAnticongelante || 0,
      'Combustible (L)': log.litrosCombustible || '-',
      Filtros: (log.filtros || []).map(f => `${f.cantidad}x ${f.tipo} (${f.referencia})`).join(' | ')
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bitácora Filtros");
    XLSX.writeFile(wb, `Reporte_Bitacora_Filtros_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
    toast({ title: "Excel Generado", description: "El reporte se ha descargado correctamente." });
  }, [filteredLogs, toast]);

  const handleExportPDF = useCallback(() => {
    if (filteredLogs.length === 0) {
      return toast({ variant: "destructive", title: "Sin datos", description: "No hay registros filtrados para exportar." });
    }
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;

    // Título General
    drawPdfHeader(doc);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('BITÁCORA GENERAL DE FILTROS & FLUIDOS', pageWidth / 2, 45, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Periodo seleccionado: ${fechaDesde ? format(fechaDesde, 'dd/MM/yyyy') : 'Inicio'} al ${fechaHasta ? format(fechaHasta, 'dd/MM/yyyy') : 'Hoy'}`, margin, 52);

    const tableBody = filteredLogs.map((log: any) => [
      format(log.fecha?.toDate ? log.fecha.toDate() : new Date(), "dd/MM/yyyy"),
      (log.clienteNombre || 'S/C').toUpperCase(),
      log.instalacion,
      formatTechnicianName(log.tecnico || log.tecnicoEmail || ''),
      log.resistenciaCaldeo || '-',
      `${log.litrosAceite || '0'}L`,
      `${log.litrosAnticongelante || '0'}L`,
      (log.filtros || []).map((f: any) => `${f.cantidad}x ${f.tipo} (${f.referencia || 'S/R'})`).join(', ')
    ]);

    autoTable(doc, {
      startY: 58,
      margin: { top: 55, left: margin, right: margin },
      head: [['Fecha', 'Cliente', 'Instalación', 'Inspector', 'Caldeo', 'Aceite', 'Anticong.', 'Filtros Sustituidos']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [22, 90, 48], fontSize: 8, halign: 'center', fontStyle: 'bold' },
      styles: { fontSize: 7, cellPadding: 3, valign: 'middle', overflow: 'linebreak' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 18 },
        1: { fontStyle: 'bold', cellWidth: 35 },
        4: { halign: 'center', cellWidth: 12 },
        5: { halign: 'center', cellWidth: 15 },
        6: { halign: 'center', cellWidth: 15 },
        7: { cellWidth: 60 }
      },
      didDrawPage: () => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setPage(pageCount);
        drawPdfHeader(doc);
        drawPdfFooter(doc, pageCount, pageCount); // Esto se corregirá al final en el loop global si es necesario, pero autoTable maneja páginas nuevas
      }
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      drawPdfHeader(doc);
      drawPdfFooter(doc, i, pageCount);
    }

    doc.save(`Bitacora_Filtros_General_${format(new Date(), 'yyyyMMdd')}.pdf`);
    toast({ title: "PDF Generado", description: "El reporte general de bitácora se ha descargado correctamente." });
  }, [filteredLogs, fechaDesde, fechaHasta, toast]);

  // 2. Dynamic Header
  useEffect(() => {
    const headerAction = (
      <div className="flex items-center gap-3">
        <Button
          onClick={handleExportExcel}
          variant="outline"
          className="h-10 rounded-xl border-slate-200 bg-white text-slate-600 font-black text-[10px] gap-2 px-4 uppercase hover:bg-[#165a30] hover:text-white hover:border-transparent transition-all active:scale-95 shadow-sm group"
        >
          <Database size={14} className="text-[#165a30] group-hover:text-white transition-colors" /> Excel
        </Button>
        <Button
          onClick={handleExportPDF}
          variant="outline"
          className="h-10 rounded-xl border-slate-200 bg-white text-slate-600 font-black text-[10px] gap-2 px-4 uppercase hover:bg-[#165a30] hover:text-white hover:border-transparent transition-all active:scale-95 shadow-sm group"
        >
          <FileText size={14} className="text-[#165a30] group-hover:text-white transition-colors" /> PDF
        </Button>
        <Button
          onClick={() => { setSelectedLog(null); setIsEditLogModalOpen(true); }}
          className="h-10 rounded-xl bg-[#165a30] text-white font-black text-[10px] gap-2 px-4 uppercase shadow-lg shadow-[#165a30]/20 hover:bg-white hover:text-[#165a30] hover:border-[#165a30] border border-transparent transition-all active:scale-95"
        >
          <Plus size={14} /> Nueva Bitácora
        </Button>
      </div>
    );
    setHeaderProps({ title: 'Bitácora de Filtros & Fluidos', action: headerAction });
  }, [setHeaderProps, handleExportExcel, handleExportPDF]);

  const loadInitialLogs = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    setLastDoc(null);
    setHasMore(true);

    try {
      const qLogs = query(collection(db, 'bitacora_filtros'), orderBy('fecha', 'desc'), limit(15));
      const snapLogs = await getDocs(qLogs);
      const logsData = snapLogs.docs.map(d => ({ id: d.id, ...d.data() } as LogEntry));
      setLogs(logsData);
      setLastDoc(snapLogs.docs[snapLogs.docs.length - 1]);
      setHasMore(snapLogs.docs.length === 15);
    } catch (error) {
      console.error("Error al cargar datos de bitácora:", error);
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  }, [db]);

  useEffect(() => {
    loadInitialLogs();
  }, [loadInitialLogs]);

  const fetchData = async (isLoadMore = false) => {
    if (!db) return;
    if (!isLoadMore) {
      setLoading(true);
      setLastDoc(null);
      setHasMore(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      let qLogs = query(collection(db, 'bitacora_filtros'), orderBy('fecha', 'desc'), limit(15));

      if (isLoadMore && lastDoc) {
        qLogs = query(collection(db, 'bitacora_filtros'), orderBy('fecha', 'desc'), startAfter(lastDoc), limit(15));
      }

      const snapLogs = await getDocs(qLogs);
      const logsData = snapLogs.docs.map(d => ({ id: d.id, ...d.data() } as LogEntry));

      if (isLoadMore) {
        setLogs(prev => [...prev, ...logsData]);
      } else {
        setLogs(logsData);
      }

      setLastDoc(snapLogs.docs[snapLogs.docs.length - 1]);
      setHasMore(snapLogs.docs.length === 15);

    } catch (error) {
      console.error("Error al cargar datos de bitácora:", error);
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleOpenViewLog = (log: LogEntry) => {
    setSelectedLog(log);
    setIsViewLogModalOpen(true);
  };

  const handleOpenEditLog = () => {
    setIsViewLogModalOpen(false);
    setIsEditLogModalOpen(true);
  };

  const handleSaveLogEdit = async (updatedData: any, updatedFilters: any[]) => {
    if (!db || !selectedLog) return;
    setIsSaving(true);
    try {
      const logRef = doc(db, 'bitacora_filtros', selectedLog.id);
      await updateDoc(logRef, {
        ...updatedData,
        filtros: updatedFilters,
        ultimaEdicionAdmin: Timestamp.now()
      });
      toast({ title: 'Éxito', description: 'Registro actualizado correctamente.' });
      setIsEditLogModalOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el registro.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
      <Loader2 className="animate-spin text-primary" size={48} />
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sincronizando Historial...</p>
    </div>
  );

  return (
    <div className="animate-in fade-in duration-700 space-y-10 pb-20">

      {/* CABECERA Y FILTROS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm items-center">
        <div className="relative md:col-span-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            placeholder="Buscar por cliente o instalación..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 h-14 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 focus:ring-2 ring-primary/20"
          />
        </div>
        <div className="flex gap-3 md:col-span-2 justify-end items-center">
          <div className="w-40">
            <AdminDatePicker date={fechaDesde} setDate={setFechaDesde} placeholder="Desde..." />
          </div>
          <div className="w-40">
            <AdminDatePicker date={fechaHasta} setDate={setFechaHasta} placeholder="Hasta..." />
          </div>

        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-1 gap-10">

        {/* TABLA PRINCIPAL: HISTORIAL DE CAMBIOS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <History size={14} /> HISTORIAL DE CAMBIOS DE FILTROS
            </h3>
            <span className="text-[10px] font-black text-[#165a30] bg-[#165a30]/10 px-3 py-1 rounded-full uppercase tracking-tighter">
              {filteredLogs.length} Registros Encontrados
            </span>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                  <th className="p-6">Fecha / Inspector</th>
                  <th className="p-6">Cliente / Instalación</th>
                  <th className="p-6">Resumen Filtros</th>
                  <th className="p-6">Fluidos</th>
                  <th className="p-6 text-right">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#165a30]/5 transition-colors group cursor-pointer" onClick={() => handleOpenViewLog(log)}>
                    <td className="p-6">
                      <div className="text-xs font-black text-slate-900 uppercase leading-none mb-1">
                        {format(log.fecha?.toDate ? log.fecha.toDate() : new Date(), "dd 'de' MMMM", { locale: es })}
                      </div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{formatTechnicianName(log.tecnico || log.tecnicoEmail || '')}</div>
                    </td>
                    <td className="p-6">
                      <div className="text-xs font-black text-slate-700 uppercase tracking-tighter">{log.clienteNombre}</div>
                      <div className="text-[10px] font-bold text-[#165a30] uppercase">{log.instalacion}</div>
                    </td>
                    <td className="p-6">
                      <div className="flex gap-1 flex-wrap">
                        {log.filtros && log.filtros.length > 0 ? (
                          log.filtros.slice(0, 2).map((f, i) => (
                            <span key={i} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase">
                              {f.cantidad}x {f.tipo}
                            </span>
                          ))
                        ) : <span className="text-[8px] text-slate-300 font-bold uppercase">Sin filtros registrados</span>}
                        {log.filtros && log.filtros.length > 2 && <span className="text-[8px] font-black text-slate-400">+{log.filtros.length - 2} más</span>}
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex gap-3">
                        <div className="flex items-center gap-1">
                          <Droplets size={10} className="text-[#165a30]" />
                          <span className="text-[10px] font-black text-slate-700">{log.litrosAceite || '0'}L</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Fuel size={10} className="text-[#165a30]" />
                          <span className="text-[10px] font-black text-slate-700">{log.litrosCombustible || '0'}L</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-6 text-right">
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 text-slate-300 group-hover:bg-[#165a30] transition-all">
                        <ArrowRight size={18} className="group-hover:text-white" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredLogs.length === 0 && (
              <div className="p-20 text-center space-y-3">
                <Database className="mx-auto text-slate-200" size={48} />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No hay registros que coincidan con la búsqueda</p>
              </div>
            )}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-12 mb-20">
              <Button
                onClick={() => fetchData(true)}
                disabled={isLoadingMore}
                variant="outline"
                className="h-14 px-12 rounded-2xl border-slate-200 font-black uppercase tracking-widest text-[10px] gap-2 hover:bg-[#165a30] hover:text-white transition-all shadow-sm"
              >
                {isLoadingMore ? <Loader2 className="animate-spin" size={16} /> : <History size={16} />}
                {isLoadingMore ? 'Cargando...' : 'Cargar más registros inspectores'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* MODALES MODULARIZADOS */}
      <LogDetailModal
        isOpen={isViewLogModalOpen}
        onOpenChange={setIsViewLogModalOpen}
        selectedLog={selectedLog}
        onEdit={handleOpenEditLog}
        onRefresh={fetchData}
      />

      <LogEditModal
        isOpen={isEditLogModalOpen}
        onOpenChange={setIsEditLogModalOpen}
        logData={selectedLog}
        onSave={handleSaveLogEdit}
        isSaving={isSaving}
      />

    </div>
  );
}
