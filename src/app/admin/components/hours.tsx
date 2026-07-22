'use client';

/* eslint-disable react-hooks/set-state-in-effect -- QA: warning reviewed; keeping current flow to avoid behavioral changes. */

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { formatTechnicianName } from '@/lib/utils';
import { endOfDay, format, isWithinInterval, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { CalendarIcon, CheckCircle2, Download, FileText, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAdminHeader } from './AdminHeaderContext';
import ReportGeneratorModal from './ReportGeneratorModal';

import HoraModal from './HoraModal';

function AdminDatePicker({ date, setDate, placeholder }: { date: Date | undefined; setDate: (d: Date | undefined) => void; placeholder: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={`w-full h-12 justify-start font-bold rounded-xl border-slate-200 bg-slate-50 hover:bg-slate-100 ${date ? 'text-slate-900' : 'text-slate-400'}`}>
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

import { HoraItem } from '@/types/models';

export default function HoursPage() {
  const db = useFirestore();
  const { setHeaderProps } = useAdminHeader();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const otIdParam = searchParams.get('otId');

  const [records, setRecords] = useState<HoraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroInspector, setFiltroInspector] = useState('todos');
  const [fechaDesde, setFechaDesde] = useState<Date | undefined>(undefined);
  const [fechaHasta, setFechaHasta] = useState<Date | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState(otIdParam || '');
  const [viewMode, setViewMode] = useState<'tabla' | 'cliente' | 'fecha'>('tabla');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [currentEditingRecord, setCurrentEditingRecord] = useState<HoraItem | null>(null);
  const [inspectors, setInspectors] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [allOTs, setAllOTs] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    if (!db) return;
    try {
      setLoading(true);
      const [visitasSnap, clientsSnap, usersSnap, otsSnap] = await Promise.all([
        getDocs(query(collection(db, 'bitacora_visitas'), orderBy('createdAt', 'desc'), limit(1000))),
        getDocs(collection(db, 'clientes')),
        getDocs(collection(db, 'usuarios')),
        getDocs(collection(db, 'ordenes_trabajo'))
      ]);

      const data = visitasSnap.docs.map(d => ({ id: d.id, ...d.data() } as HoraItem));
      setRecords(data);
      setClients(clientsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).sort((a, b) => a.nombre > b.nombre ? 1 : -1));
      setAllOTs(otsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const userList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setInspectors(userList.sort((a: any, b: any) => (a.nombre || '').localeCompare(b.nombre || '')));

    } catch { toast({ title: "Error al cargar datos", variant: "destructive" }); }
    finally { setLoading(false); }
  }, [db, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredRecords = useMemo(() => {
    const list = records.filter(r => {
      const d = r.fecha?.toDate ? r.fecha.toDate() : new Date(r.fecha);
      const matchInspector = filtroInspector === 'todos' || r.inspectorNombre === filtroInspector;
      let matchFecha = true;
      if (fechaDesde && fechaHasta) matchFecha = isWithinInterval(d, { start: startOfDay(fechaDesde), end: endOfDay(fechaHasta) });
      const matchSearch = searchTerm === '' ||
        r.inspectorNombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.actividad?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.clienteNombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r as any).orderId?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchInspector && matchFecha && matchSearch;
    });

    // Ordenar de más reciente a más antiguo (primero por fecha, luego por hora de llegada)
    list.sort((a, b) => {
      const dateA = a.fecha?.toDate ? a.fecha.toDate().getTime() : new Date(a.fecha).getTime();
      const dateB = b.fecha?.toDate ? b.fecha.toDate().getTime() : new Date(b.fecha).getTime();
      
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      
      const timeA = a.horaLlegada || '00:00';
      const timeB = b.horaLlegada || '00:00';
      return timeB.localeCompare(timeA);
    });

    return list;
  }, [records, filtroInspector, fechaDesde, fechaHasta, searchTerm]);

  // --- LÓGICA DE AGRUPACIÓN (CORREGIDA: AHORA DENTRO DEL COMPONENTE) ---
  const groupedByCliente = useMemo(() => {
    return filteredRecords.reduce((acc: Record<string, any[]>, r) => {
      const key = r.clienteNombre || 'Sin Cliente';
      if (!acc[key]) acc[key] = [];
      acc[key].push(r);
      return acc;
    }, {});
  }, [filteredRecords]);

  const groupedByFecha = useMemo(() => {
    return filteredRecords.reduce((acc: Record<string, any[]>, r) => {
      const d = r.fecha?.toDate ? r.fecha.toDate() : new Date(r.fecha);
      const key = isNaN(d.getTime()) ? 'Sin Fecha' : format(d, 'dd/MM/yyyy');
      if (!acc[key]) acc[key] = [];
      acc[key].push(r);
      return acc;
    }, {});
  }, [filteredRecords]);

  // Mapa de nombres para lookup rápido
  const nameMap = useMemo(() => {
    const map = new Map();
    inspectors.forEach(i => {
      if (i.email) map.set(i.email.toLowerCase().trim(), i.nombre);
      if (i.id) map.set(i.id.toLowerCase().trim(), i.nombre);
    });
    return map;
  }, [inspectors]);

  const getDisplayName = useCallback((raw: string) => {
    if (!raw) return 'S/N';
    const clean = raw.toLowerCase().trim();
    if (nameMap.has(clean)) return nameMap.get(clean).toUpperCase();
    const prefix = raw.split('@')[0].toLowerCase();
    if (nameMap.has(prefix)) return nameMap.get(prefix).toUpperCase();
    return formatTechnicianName(raw).toUpperCase();
  }, [nameMap]);

  const totalN = filteredRecords.reduce((sum, r) => sum + (Number(r.horasNormales) || 0), 0);
  const totalE = filteredRecords.reduce((sum, r) => sum + (Number(r.horasExtras) || 0), 0);
  const totalS = filteredRecords.reduce((sum, r) => sum + (Number(r.horasEspeciales) || 0), 0);

  // 5. Handlers
  const handleExportExcel = useCallback(() => {
    if (filteredRecords.length === 0) {
      return toast({ variant: "destructive", title: "Sin datos", description: "No hay horas registradas para exportar." });
    }
    const dataToExport = filteredRecords.map(r => ({
      Inspector: getDisplayName(r.inspectorNombre || r.inspectorEmail || ''),
      Fecha: format(r.fecha?.toDate ? r.fecha.toDate() : new Date(r.fecha), 'dd/MM/yyyy'),
      OT: (r as any).orderId || 'N/A',
      Cliente: r.clienteNombre || 'N/A',
      Actividad: r.actividad,
      'H. Normales': r.horasNormales || 0,
      'H. Extras': r.horasExtras || 0,
      'H. Especiales': r.horasEspeciales || 0,
      Total: (Number(r.horasNormales) || 0) + (Number(r.horasExtras) || 0) + (Number(r.horasEspeciales) || 0),
      'Ubicación (GPS)': r.ubicacionLlegada ? `${r.ubicacionLlegada.lat}, ${r.ubicacionLlegada.lon}` : (r.ubicacion ? `${r.ubicacion.lat}, ${r.ubicacion.lon}` : 'No registrada'),
      Estado: r.estado
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Horas");
    XLSX.writeFile(wb, `Reporte_Horas_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
    toast({ title: "Excel Generado", description: "El reporte se ha descargado correctamente." });
  }, [filteredRecords, toast, getDisplayName]);

  useEffect(() => {
    const headerAction = (
      <div className="flex flex-col md:flex-row items-center gap-4">
        {/* Selector de Vistas */}
        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner shrink-0 border border-slate-200">
          <button onClick={() => setViewMode('tabla')} className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase transition-all ${viewMode === 'tabla' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Tabla</button>
          <button onClick={() => setViewMode('cliente')} className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase transition-all ${viewMode === 'cliente' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Cliente</button>
          <button onClick={() => setViewMode('fecha')} className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase transition-all ${viewMode === 'fecha' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Fecha</button>
        </div>

        {/* Botones de acción */}
        <div className="flex items-center gap-2">
          <Button onClick={handleExportExcel} variant="outline" className="h-10 rounded-xl border-slate-200 bg-white text-slate-600 font-black text-[10px] gap-2 px-4 uppercase hover:bg-[#165a30] hover:text-white hover:border-transparent transition-all active:scale-95 shadow-sm group"><Download size={14} className="text-[#165a30] group-hover:text-white transition-colors" /> Excel</Button>
          <Button onClick={() => setIsReportModalOpen(true)} variant="outline" className="h-10 rounded-xl border-slate-200 bg-white text-slate-600 font-black text-[10px] gap-2 px-4 uppercase hover:bg-[#165a30] hover:text-white hover:border-transparent transition-all active:scale-95 shadow-sm group"><FileText size={14} className="text-[#165a30] group-hover:text-white transition-colors" /> PDF</Button>
          <Button onClick={() => setIsCreateModalOpen(true)} className="h-10 rounded-xl bg-primary text-white font-black text-[10px] gap-2 px-4 uppercase shadow-lg shadow-primary/20 hover:bg-white hover:text-primary hover:border-primary border border-transparent transition-all active:scale-95 group"><Plus size={14} className="group-hover:text-primary transition-colors" /> Registrar Horas</Button>
        </div>
      </div>
    );

    setHeaderProps({
      title: 'Control de Horas de Producción',
      action: headerAction
    });
  }, [setHeaderProps, viewMode, handleExportExcel]);
  const handleApprove = async (id: string, currentStatus: string) => {
    if (currentStatus === 'Aprobado') return;

    // Verificar OT
    const record = records.find(r => r.id === id);
    const parentOT = allOTs.find(ot => ot.id === (record as any)?.orderId);
    if (parentOT && parentOT.estado === 'Completada') {
      return toast({ variant: "destructive", title: "Acción Bloqueada", description: "No se pueden aprobar horas de una OT ya completada." });
    }

    if (!window.confirm("¿Aprobar definitivamente este registro de horas?")) return;
    try {
      setLoading(true);
      await updateDoc(doc(db, 'bitacora_visitas', id), {
        estado: 'Aprobado',
        fecha_aprobacion: serverTimestamp(),
        aprobado_por: 'Admin'
      });
      toast({ title: "¡Horas Aprobadas!", description: "El registro ha sido validado correctamente." });
      await fetchData();
    } catch (e) {
      console.error("Error approving:", e);
      toast({ title: "Error", description: "No se pudo aprobar el registro.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const record = records.find(r => r.id === id);
    if (record?.estado === 'Aprobado') {
      return toast({ variant: "destructive", title: "Acción Bloqueada", description: "No se puede eliminar un registro ya aprobado." });
    }

    const parentOT = allOTs.find(ot => ot.id === (record as any)?.orderId);
    if (parentOT && parentOT.estado === 'Completada') {
      return toast({ variant: "destructive", title: "Acción Bloqueada", description: "No se pueden eliminar horas de una OT ya completada." });
    }

    if (!window.confirm("¿Seguro que quieres eliminar este registro de horas?")) return;
    try {
      await deleteDoc(doc(db, 'bitacora_visitas', id));
      fetchData();
      toast({ title: "Registro eliminado" });
    } catch (e) {
      console.error("Error deleting:", e);
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el registro." });
    }
  };

  if (loading) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" size={40} /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* FILTROS */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-wrap gap-4 items-end">
        <div className="space-y-1 w-full md:w-1/3">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Buscar</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <Input placeholder="Inspector, cliente, actividad..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-12 pl-10 rounded-xl border-slate-200 bg-slate-50 text-slate-900 font-bold" />
          </div>
        </div>
        <div className="space-y-1 w-48">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Inspector</label>
          <Select value={filtroInspector} onValueChange={setFiltroInspector}>
            <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-slate-50 text-slate-900 font-bold"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="todos">TODOS</SelectItem>
              {inspectors.map((i: any) => (
                <SelectItem key={i.id} value={i.nombre || i.email}>{i.nombre?.toUpperCase() || i.email?.split('@')[0].toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 w-40">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Desde</label>
          <AdminDatePicker date={fechaDesde} setDate={setFechaDesde} placeholder="Inicio..." />
        </div>
        <div className="space-y-1 w-40">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Hasta</label>
          <AdminDatePicker date={fechaHasta} setDate={setFechaHasta} placeholder="Fin..." />
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
          <Button variant="ghost" onClick={() => { setFiltroInspector('todos'); setFechaDesde(undefined); setFechaHasta(undefined); setSearchTerm(''); }} className="h-12 rounded-xl text-slate-400 font-bold text-[10px] uppercase px-4 hover:bg-slate-50">LIMPIAR FILTROS</Button>
        </div>
      </div>

      {/* CONTENIDO DINÁMICO */}
      {viewMode === 'tabla' ? (
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#062113] text-white">
                  <th className="px-6 py-4 text-[10px] font-black uppercase border-r border-white/10">Fecha</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase border-r border-white/10">Inspector</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase border-r border-white/10">Cliente / Actividad</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase text-center border-r border-white/10">Norm.</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase text-center border-r border-white/10">Extra</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase text-center border-r border-white/10">Esp.</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase text-center border-r border-white/10 bg-white/5">Total</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-center border-r border-white/10">Estado</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-700 text-sm">
                        {(() => {
                          try {
                            const d = r.fecha?.toDate ? r.fecha.toDate() : (r.fecha ? new Date(r.fecha) : new Date());
                            return isNaN(d.getTime()) ? 'Sin Fecha' : format(d, 'dd/MM/yyyy');
                          } catch { return 'Error Fecha'; }
                        })()}
                      </p>
                      <p className="text-[9px] font-black text-slate-400 uppercase">{r.horaLlegada || '--:--'}</p>
                    </td>
                    <td className="px-6 py-4 font-black text-slate-800 text-xs uppercase whitespace-normal max-w-[140px] leading-tight break-words">{getDisplayName(r.inspectorNombre || r.inspectorEmail || '')}</td>
                    <td className="px-6 py-4"><p className="font-black text-slate-900 text-xs uppercase">{r.clienteNombre}</p><p className="text-[10px] text-slate-500 font-medium truncate max-w-xs">{r.actividad}</p></td>
                    <td className="px-4 py-4 text-center font-bold text-slate-700 text-xs">{(r.horasNormales || 0).toFixed(2)}</td>
                    <td className="px-4 py-4 text-center font-bold text-amber-600 text-xs">{(r.horasExtras || 0).toFixed(2)}</td>
                    <td className="px-4 py-4 text-center font-bold text-blue-600 text-xs">{(r.horasEspeciales || 0).toFixed(2)}</td>
                    <td className="px-4 py-4 text-center font-black text-slate-900 text-sm bg-slate-50/50">{((r.horasNormales || 0) + (r.horasExtras || 0) + (r.horasEspeciales || 0)).toFixed(2)}</td>
                    <td className="px-6 py-4 text-center"><span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${r.estado === 'Aprobado' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600 animate-pulse'}`}>{r.estado}</span></td>
                    <td className="px-6 py-4 text-right"><div className="flex justify-end gap-2"><Button variant="outline" size="icon" onClick={() => { setCurrentEditingRecord(r); setIsEditModalOpen(true); }} className="h-10 w-10 rounded-xl bg-slate-50 hover:bg-slate-100"><Pencil size={18} /></Button>{r.estado !== 'Aprobado' && r.id && <Button variant="outline" size="icon" onClick={() => handleApprove(r.id!, r.estado || '')} className="text-emerald-600 h-10 w-10 rounded-xl bg-emerald-50 hover:bg-emerald-100"><CheckCircle2 size={20} /></Button>}{r.id && <Button variant="outline" size="icon" onClick={() => handleDelete(r.id!)} className="text-red-500 h-10 w-10 rounded-xl bg-red-50 hover:bg-red-100"><Trash2 size={20} /></Button>}</div></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-4 border-slate-200">
                <tr className="font-black text-slate-900">
                  <td colSpan={3} className="px-6 py-5 text-right uppercase text-[10px] tracking-widest text-slate-500 bg-slate-100/50">Total Producción:</td>
                  <td className="px-4 py-5 text-right text-[#062113] border-l border-slate-200">{totalN.toFixed(2)}</td>
                  <td className="px-4 py-5 text-right text-[#062113] border-l border-slate-200">{totalE.toFixed(2)}</td>
                  <td className="px-4 py-5 text-right text-[#062113] border-l border-slate-200">{totalS.toFixed(2)}</td>
                  <td className="px-4 py-5 text-right bg-[#f1f5f9] text-[#062113] border-l-2 border-slate-300">{(totalN + totalE + totalS).toFixed(2)}</td>
                  <td colSpan={2} className="bg-slate-50"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in zoom-in-95 duration-300">
          {Object.entries(viewMode === 'cliente' ? groupedByCliente : groupedByFecha).map(([key, items]: [string, any[]]) => {
            const sN = items.reduce((s, r) => s + (Number(r.horasNormales) || 0), 0);
            const sE = items.reduce((s, r) => s + (Number(r.horasExtras) || 0), 0);
            const sS = items.reduce((s, r) => s + (Number(r.horasEspeciales) || 0), 0);
            return (
              <div key={key} className="bg-white rounded-[2rem] shadow-md border border-slate-100 overflow-hidden">
                <div className={`px-5 py-4 border-b flex justify-between items-center ${viewMode === 'fecha' ? 'bg-[#062113] text-white' : 'bg-slate-50'}`}>
                  <h3 className="font-black uppercase tracking-widest text-[10px]">{key}</h3>
                  <span className="text-sm font-black">Total: {(sN + sE + sS).toFixed(2)}h</span>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-3 gap-2 mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase">Norm.</p><p className="font-bold text-emerald-600">{sN.toFixed(2)}</p></div>
                    <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase">Ext.</p><p className="font-bold text-amber-600">{sE.toFixed(2)}</p></div>
                    <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase">Esp.</p><p className="font-bold text-blue-600">{sS.toFixed(2)}</p></div>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-40 overflow-y-auto custom-scroll pr-2">
                    {items.map((r, i) => (
                      <div key={i} className="py-2 flex justify-between items-center text-[10px]">
                        <span className="font-bold text-slate-500">{viewMode === 'fecha' ? r.clienteNombre : format(r.fecha?.toDate ? r.fecha.toDate() : new Date(r.fecha), 'dd/MM')}</span>
                        <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">{(Number(r.horasNormales) + Number(r.horasExtras) + Number(r.horasEspeciales)).toFixed(2)}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ReportGeneratorModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} reportes={records} fixedModule="horas" inspectorsList={inspectors} />

      {/* MODALES CREAR/EDITAR */}
      {isCreateModalOpen && <HoraModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSaved={fetchData} db={db} clients={clients} inspectors={inspectors} />}
      {isEditModalOpen && currentEditingRecord && <HoraModal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setCurrentEditingRecord(null); }} record={currentEditingRecord} onSaved={fetchData} db={db} clients={clients} inspectors={inspectors} />}
    </div>
  );
}
