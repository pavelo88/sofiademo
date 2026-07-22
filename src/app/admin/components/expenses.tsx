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
import { AlignJustify, CalendarDays, CalendarIcon, CheckCircle2, Download, ExternalLink, FileText, Image as ImageIcon, Layers, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAdminHeader } from './AdminHeaderContext';
import ReportGeneratorModal from './ReportGeneratorModal';

import GastoModal from './GastoModal';

// --- DATE PICKER SEGURO CON CALENDARIO OSCURO ---
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

import { GastoItem } from '@/types/models';

export default function ExpensesPage() {
  const db = useFirestore();
  const { setHeaderProps } = useAdminHeader();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const otIdParam = searchParams.get('otId');

  const [records, setRecords] = useState<GastoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroInspector, setFiltroInspector] = useState('todos');
  const [fechaDesde, setFechaDesde] = useState<Date | undefined>(undefined);
  const [fechaHasta, setFechaHasta] = useState<Date | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState(otIdParam || '');
  const [viewMode, setViewMode] = useState<'tabla' | 'rubro' | 'fecha'>('tabla'); // Toggle de vistas

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [currentEditingRecord, setCurrentEditingRecord] = useState<GastoItem | null>(null);
  const [inspectors, setInspectors] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [allOTs, setAllOTs] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    if (!db) return;
    try {
      setLoading(true);
      const [gastosSnap, clientsSnap, usersSnap, otsSnap] = await Promise.all([
        getDocs(query(collection(db, 'gastos_detalle'), orderBy('createdAt', 'desc'), limit(1000))),
        getDocs(collection(db, 'clientes')),
        getDocs(collection(db, 'usuarios')),
        getDocs(collection(db, 'ordenes_trabajo'))
      ]);

      const data = gastosSnap.docs.map(d => ({ id: d.id, ...d.data() } as GastoItem));
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
    const result = records.filter(r => {
      const d = r.fecha?.toDate ? r.fecha.toDate() : new Date(r.fecha);
      const matchInspector = filtroInspector === 'todos' || r.inspectorNombre === filtroInspector;
      let matchFecha = true;
      if (fechaDesde && fechaHasta) matchFecha = isWithinInterval(d, { start: startOfDay(fechaDesde), end: endOfDay(fechaHasta) });
      const matchSearch = searchTerm === '' ||
        r.inspectorNombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.rubro?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r as any).orderId?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchInspector && matchFecha && matchSearch;
    });
    return result.sort((a, b) => {
      const da = a.fecha?.toDate ? a.fecha.toDate().getTime() : new Date(a.fecha || 0).getTime();
      const db = b.fecha?.toDate ? b.fecha.toDate().getTime() : new Date(b.fecha || 0).getTime();
      return db - da;
    });
  }, [records, filtroInspector, fechaDesde, fechaHasta, searchTerm]);

  // Totales
  const totalMonto = filteredRecords.reduce((sum, r) => sum + (Number(r.monto) || 0), 0);

  // Agrupaciones para Vistas de Tarjetas
  const groupedByRubro = useMemo(() => {
    return filteredRecords.reduce((acc: Record<string, any[]>, g) => {
      const key = g.rubro || 'Otros';
      if (!acc[key]) acc[key] = [];
      acc[key].push(g);
      return acc;
    }, {});
  }, [filteredRecords]);

  const groupedByFecha = useMemo(() => {
    return filteredRecords.reduce((acc: Record<string, any[]>, g) => {
      const d = g.fecha?.toDate ? g.fecha.toDate() : new Date(g.fecha);
      const key = isNaN(d.getTime()) ? 'Sin Fecha' : format(d, 'dd/MM/yyyy');
      if (!acc[key]) acc[key] = [];
      acc[key].push(g);
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

  // 5. Handlers
  const handleExportExcel = useCallback(() => {
    if (filteredRecords.length === 0) {
      return toast({ variant: "destructive", title: "Sin datos", description: "No hay gastos registrados para exportar." });
    }
    const dataToExport = filteredRecords.map(r => {
      const parentOT = allOTs.find(ot => ot.id === (r as any).orderId);
      return {
        Inspector: getDisplayName(r.inspectorNombre || ''),
        Fecha: format(r.fecha?.toDate ? r.fecha.toDate() : new Date(r.fecha), 'dd/MM/yyyy'),
        OT: (r as any).orderId || 'N/A',
        Cliente: (r as any).cliente || parentOT?.clienteNombre || parentOT?.cliente || 'N/A',
        Rubro: r.rubro,
        Concepto: r.descripcion,
        'Tipo de Pago': (r as any).metodoPago || 'Efectivo',
        Monto: r.monto || 0,
        Estado: r.estado
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gastos");
    XLSX.writeFile(wb, `Reporte_Gastos_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
    toast({ title: "Excel Generado", description: "El reporte se ha descargado correctamente." });
  }, [filteredRecords, toast, allOTs, getDisplayName]);

  useEffect(() => {
    const headerAction = (
      <div className="flex flex-col md:flex-row items-center gap-4">
        {/* Toggle de Vistas */}
        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner shrink-0">
          <button onClick={() => setViewMode('tabla')} className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase flex items-center gap-2 ${viewMode === 'tabla' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}><AlignJustify size={14} /> Tabla</button>
          <button onClick={() => setViewMode('rubro')} className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase flex items-center gap-2 ${viewMode === 'rubro' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}><Layers size={14} /> Categoría</button>
          <button onClick={() => setViewMode('fecha')} className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase flex items-center gap-2 ${viewMode === 'fecha' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}><CalendarDays size={14} /> Fecha</button>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-2">
          <Button onClick={handleExportExcel} variant="outline" className="h-10 rounded-xl border-slate-200 bg-white text-slate-600 font-black text-[10px] gap-2 px-4 uppercase hover:bg-[#165a30] hover:text-white hover:border-transparent transition-all active:scale-95 shadow-sm group"><Download size={14} className="text-[#165a30] group-hover:text-white transition-colors" /> Excel</Button>
          <Button onClick={() => setIsReportModalOpen(true)} variant="outline" className="h-10 rounded-xl border-slate-200 bg-white text-slate-600 font-black text-[10px] gap-2 px-4 uppercase hover:bg-[#165a30] hover:text-white hover:border-transparent transition-all active:scale-95 shadow-sm group"><FileText size={14} className="text-[#165a30] group-hover:text-white transition-colors" /> PDF</Button>
          <Button onClick={() => setIsCreateModalOpen(true)} className="h-10 rounded-xl bg-primary text-white font-black text-[10px] gap-2 px-4 uppercase shadow-lg shadow-primary/20 hover:bg-white hover:text-primary hover:border-primary border border-transparent transition-all active:scale-95 group"><Plus size={14} className="group-hover:text-primary transition-colors" /> Crear Gasto</Button>
        </div>
      </div>
    );

    setHeaderProps({
      title: 'Gastos Individuales y Viáticos',
      action: headerAction
    });
  }, [setHeaderProps, viewMode, handleExportExcel]);
  const handleApprove = async (id: string, currentStatus: string) => {
    if (currentStatus === 'Aprobado') return;

    // Verificar OT
    const record = records.find(r => r.id === id);
    const parentOT = allOTs.find(ot => ot.id === (record as any)?.orderId);
    if (parentOT && parentOT.estado === 'Completada') {
      return toast({ variant: "destructive", title: "Acción Bloqueada", description: "No se pueden aprobar gastos de una OT ya completada." });
    }

    if (!window.confirm("¿Validar y aprobar este gasto definitivamente?")) return;
    try {
      setLoading(true);
      await updateDoc(doc(db, 'gastos_detalle', id), {
        estado: 'Aprobado',
        fecha_aprobacion: serverTimestamp(),
        aprobado_por: 'Admin'
      });
      toast({ title: "¡Gasto Aprobado!", description: "El viático ha sido validado correctamente." });
      await fetchData();
    } catch (e) {
      console.error("Error approving expense:", e);
      toast({ title: "Error", description: "No se pudo aprobar el gasto.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const record = records.find(r => r.id === id);
    if (record?.estado === 'Aprobado') {
      return toast({ variant: "destructive", title: "Acción Bloqueada", description: "No se puede eliminar un gasto ya aprobado." });
    }

    const parentOT = allOTs.find(ot => ot.id === (record as any)?.orderId);
    if (parentOT && parentOT.estado === 'Completada') {
      return toast({ variant: "destructive", title: "Acción Bloqueada", description: "No se pueden eliminar gastos de una OT ya completada." });
    }

    if (!window.confirm("¿Eliminar este gasto permanentemente?")) return;
    try {
      await deleteDoc(doc(db, 'gastos_detalle', id));
      fetchData();
      toast({ title: "Gasto eliminado" });
    } catch (e) {
      console.error("Error deleting expense:", e);
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el gasto." });
    }
  };

  if (loading) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" size={40} /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* FILTROS Y TOGGLE DE VISTAS */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-wrap gap-4 items-end">
        <div className="space-y-1 w-full md:w-1/3">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Buscar</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <Input placeholder="Inspector, concepto, rubro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-12 pl-10 rounded-xl border-slate-200 bg-slate-50 text-slate-900 font-bold" />
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

      {/* VISTA 1: TABLA GENERAL */}
      {viewMode === 'tabla' && (
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden animate-in fade-in duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#062113] text-white">
                  <th className="px-6 py-4 text-[10px] font-black uppercase border-r border-white/10">Fecha</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase border-r border-white/10">Inspector</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase border-r border-white/10">Rubro / Concepto</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-center border-r border-white/10">Monto</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-center border-r border-white/10">Comprobante</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-center border-r border-white/10">Estado</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-center">Acciones</th>
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
                    </td>
                    <td className="px-6 py-4 font-black text-slate-800 text-xs uppercase">{getDisplayName(r.inspectorNombre || '')}</td>
                    <td className="px-6 py-4"><p className="font-black text-slate-900 text-xs uppercase">{r.rubro}</p><p className="text-[10px] text-slate-500 font-medium truncate max-w-xs">{r.descripcion}</p></td>
                    <td className="px-6 py-4 text-center font-black text-emerald-600 text-lg">{r.monto?.toFixed(2)}€</td>
                    <td className="px-6 py-4 text-center">
                      {(r as any).comprobanteUrl ? (
                        <Button asChild variant="outline" size="sm" className="h-9 rounded-xl bg-slate-50 text-slate-600 font-black text-[9px] uppercase gap-2 hover:bg-[#165a30] hover:text-white">
                          <a href={(r as any).comprobanteUrl} target="_blank" rel="noopener noreferrer">
                            <ImageIcon size={14} />
                            Ver
                          </a>
                        </Button>
                      ) : (
                        <span className="text-[9px] font-black uppercase text-slate-300">Sin foto</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center"><span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${r.estado === 'Aprobado' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600 animate-pulse'}`}>{r.estado}</span></td>
                    <td className="px-6 py-4 text-right"><div className="flex justify-end gap-2"><Button variant="outline" size="icon" onClick={() => { setCurrentEditingRecord(r); setIsEditModalOpen(true); }} className="h-10 w-10 rounded-xl bg-slate-50 hover:bg-[#165a30] hover:text-white"><Pencil size={18} /></Button>{r.estado !== 'Aprobado' && r.id && <Button variant="outline" size="icon" onClick={() => handleApprove(r.id!, r.estado || '')} className="text-emerald-600 h-10 w-10 rounded-xl bg-emerald-50 hover:bg-[#165a30] hover:text-white"><CheckCircle2 size={20} /></Button>}{r.id && <Button variant="outline" size="icon" onClick={() => handleDelete(r.id!)} className="text-red-500 h-10 w-10 rounded-xl bg-red-50 hover:bg-[#165a30] hover:text-white"><Trash2 size={20} /></Button>}</div></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-right font-black uppercase text-[10px] tracking-widest text-slate-500">Total Viáticos Filtrados:</td>
                  <td className="px-6 py-4 text-center font-black text-emerald-700 text-xl bg-emerald-50">{totalMonto.toFixed(2)}€</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
            {filteredRecords.length === 0 && <div className="py-20 text-center text-slate-300 font-bold uppercase italic">No hay gastos</div>}
          </div>
        </div>
      )}

      {/* VISTAS AGRUPADAS (Rubro o Fecha) */}
      {viewMode !== 'tabla' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-emerald-100 flex justify-between items-center bg-emerald-50/30">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Total en esta vista</span>
            <span className="text-2xl font-black text-emerald-600">{totalMonto.toFixed(2)}€</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(viewMode === 'rubro' ? groupedByRubro : groupedByFecha).map(([key, items]: [string, any[]]) => {
              const subtotal = items.reduce((s, g) => s + (Number(g.monto) || 0), 0);
              return (
                <div key={key} className="bg-white rounded-[2rem] shadow-md border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-300">
                  <div className={`px-5 py-4 border-b border-slate-100 flex justify-between items-center ${viewMode === 'fecha' ? 'bg-slate-900 text-white' : 'bg-slate-50'}`}>
                    <h3 className={`font-black uppercase tracking-widest flex items-center gap-2 ${viewMode === 'fecha' ? 'text-white' : 'text-slate-700'}`}>
                      {viewMode === 'fecha' ? <CalendarDays size={16} /> : <Layers size={16} />} {key}
                    </h3>
                    <span className={`text-sm font-black ${viewMode === 'fecha' ? 'text-emerald-400' : 'text-emerald-600'}`}>{subtotal.toFixed(2)}€</span>
                  </div>
                  <div className="p-3 divide-y divide-slate-50">
                    {items.map((g, i) => (
                      <div key={i} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors">
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="font-bold text-slate-800 text-xs truncate uppercase">{viewMode === 'fecha' ? g.rubro : g.inspectorNombre?.split('@')[0]}</p>
                          <p className="text-[10px] font-medium text-slate-500 mt-1 truncate">{g.descripcion}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-slate-900">{Number(g.monto).toFixed(2)}€</p>
                          <div className="flex items-center justify-end gap-2 mt-1">
                            {g.comprobanteUrl && (
                              <a href={g.comprobanteUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-emerald-600" aria-label="Ver comprobante">
                                <ExternalLink size={12} />
                              </a>
                            )}
                            <p className="text-[8px] font-black text-slate-400 uppercase">{g.estado}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ReportGeneratorModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} reportes={records} fixedModule="gastos" inspectorsList={inspectors} />

      {/* MODALES */}
      {isCreateModalOpen && <GastoModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSaved={fetchData} db={db} clients={clients} inspectors={inspectors} />}
      {isEditModalOpen && currentEditingRecord && <GastoModal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setCurrentEditingRecord(null); }} record={currentEditingRecord} onSaved={fetchData} db={db} clients={clients} inspectors={inspectors} />}
    </div>
  );
}
