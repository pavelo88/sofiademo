'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useFirestore } from '@/firebase';
import { cn, formatSafeDate } from '@/lib/utils';
import { getReportDisplayId } from '@/app/inspection/lib/report-record';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  MapPin,
  Pencil,
  Receipt,
  Settings,
  Sparkles,
  Trash2,
  User,
  Users,
  X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';

interface Job {
  id: string;
  numero_informe?: string;
  estado: string;
  descripcion: string;
  clienteNombre?: string;
  cliente?: string;
  contacto?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  instalacion?: string;
  ciudad?: string;
  codigo_postal?: string;
  pais?: string;
  fecha_creacion: any;
  prioridad: string;
  inspectorNombres?: string[];
  inspectorIds?: string[];
  clienteId?: string;
  motor?: string;
  modelo?: string;
  n_motor?: string;
  formType?: string;
}

interface JobDetailViewProps {
  selectedOT: Job;
  setSelectedOT: (job: Job | null) => void;
  handleEditJob: (job: Job) => void;
  handleDeleteJob: (job: Job) => void;
  handleApproveJob: (id: string, status: string, customCollection?: string) => void;
  handleEditReport: (report: Job) => void;
  handleReprintSavedPdf: (job: Job) => void;
  relatedReports: Job[];
  getJobTitle: (job: Job) => string;
  onDownloadSelectedPdfs: (reports: Job[], zipNamePrefix?: string) => Promise<void>;
}

export default function JobDetailView({
  selectedOT,
  setSelectedOT,
  handleEditJob,
  handleDeleteJob,
  handleApproveJob,
  handleEditReport,
  handleReprintSavedPdf,
  relatedReports,
  getJobTitle,
  onDownloadSelectedPdfs
}: JobDetailViewProps) {
  const db = useFirestore();
  const router = useRouter();
  const [totalHoras, setTotalHoras] = useState(0);
  const [totalGastos, setTotalGastos] = useState(0);
  const [relatedHoras, setRelatedHoras] = useState<any[]>([]);
  const [relatedGastos, setRelatedGastos] = useState<any[]>([]);
  const [showHorasModal, setShowHorasModal] = useState(false);
  const [showGastosModal, setShowGastosModal] = useState(false);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedReportIds([]);
  }, [selectedOT]);

  const handleSelectAllReports = (checked: boolean) => {
    if (checked) {
      setSelectedReportIds(relatedReports.map(r => r.id));
    } else {
      setSelectedReportIds([]);
    }
  };

  const handleSelectOneReport = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedReportIds(prev => [...prev, id]);
    } else {
      setSelectedReportIds(prev => prev.filter(item => item !== id));
    }
  };

  const handleDownloadSelectedReports = () => {
    const selectedReports = relatedReports.filter(r => selectedReportIds.includes(r.id));
    onDownloadSelectedPdfs(selectedReports, `OT_${selectedOT.numero_informe || selectedOT.id}_informes`);
  };

  useEffect(() => {
    const fetchTotals = async () => {
      if (!db || !selectedOT) return;
      try {
        const qHoras = query(collection(db, 'bitacora_visitas'), where('orderId', '==', selectedOT.id));
        const qGastos = query(collection(db, 'gastos_detalle'), where('orderId', '==', selectedOT.id));
        const [horasSnap, gastosSnap] = await Promise.all([getDocs(qHoras), getDocs(qGastos)]);
        
        const horasList = horasSnap.docs.map(d => ({id: d.id, ...d.data()}));
        const gastosList = gastosSnap.docs.map(d => ({id: d.id, ...d.data()}));
        
        setRelatedHoras(horasList);
        setRelatedGastos(gastosList);
        setTotalHoras(horasList.reduce((sum, h: any) => sum + (parseFloat(h.hNormalesStr) || 0) + (parseFloat(h.hExtrasStr) || 0) + (parseFloat(h.hEspecialesStr) || 0), 0));
        setTotalGastos(gastosList.reduce((sum, g: any) => sum + (parseFloat(g.monto) || 0), 0));
      } catch (error) {
        console.error("Error fetching related items:", error);
      }
    };
    fetchTotals();
  }, [db, selectedOT]);

  const handleExportFullOT = () => {
    // 1. Resumen OT
    const otData = [{
      ID: selectedOT.numero_informe || selectedOT.id,
      Estado: selectedOT.estado,
      Descripción: selectedOT.descripcion,
      Cliente: selectedOT.clienteNombre || selectedOT.cliente || '—',
      Contacto: selectedOT.contacto || '—',
      Teléfono: selectedOT.telefono || '—',
      Email: selectedOT.email || '—',
      Dirección: selectedOT.direccion || '—',
      Ciudad: selectedOT.ciudad || '—',
      'Código Postal': selectedOT.codigo_postal || '—',
      País: selectedOT.pais || '—',
      Instalación: selectedOT.instalacion || '—',
      'Fecha Creación': selectedOT.fecha_creacion?.toDate ? formatSafeDate(selectedOT.fecha_creacion.toDate()) : '—',
      Prioridad: selectedOT.prioridad || '—',
      Inspectores: (selectedOT.inspectorNombres || []).join(', '),
      Motor: selectedOT.motor || '—',
      Modelo: selectedOT.modelo || '—',
      'Nº Motor': selectedOT.n_motor || '—'
    }];
    const wsOT = XLSX.utils.json_to_sheet(otData);

    // 2. Horas
    const horasData = relatedHoras.map(h => ({
      ID: h.id,
      Fecha: h.fechaStr || (h.fecha?.toDate ? formatSafeDate(h.fecha.toDate()) : '—'),
      Inspector: h.inspectorNombre || h.inspectorId || '—',
      Actividad: h.actividad || '—',
      'Hora Llegada': h.horaLlegada || '—',
      'Hora Salida': h.horaSalida || '—',
      'H. Normales': h.hNormalesStr || '0',
      'H. Extras': h.hExtrasStr || '0',
      'H. Especiales': h.hEspecialesStr || '0',
      Estado: h.estado || '—'
    }));
    const wsHoras = XLSX.utils.json_to_sheet(horasData.length > 0 ? horasData : [{ 'Sin datos': 'No hay horas registradas' }]);

    // 3. Gastos
    const gastosData = relatedGastos.map(g => ({
      ID: g.id,
      Fecha: g.fechaStr || (g.fecha?.toDate ? formatSafeDate(g.fecha.toDate()) : '—'),
      Inspector: g.inspectorNombre || g.inspectorId || '—',
      Rubro: g.rubro || '—',
      Concepto: g.descripcion || '—',
      Monto: g.monto || 0,
      'Forma Pago': g.forma_pago || '—',
      Estado: g.estado || '—'
    }));
    const wsGastos = XLSX.utils.json_to_sheet(gastosData.length > 0 ? gastosData : [{ 'Sin datos': 'No hay gastos registrados' }]);

    // 4. Informes
    const informesData = relatedReports.map(r => ({
      ID: getReportDisplayId(r) || r.id,
      Tipo: r.formType || '—',
      Fecha: r.fecha_creacion?.toDate ? formatSafeDate(r.fecha_creacion.toDate()) : '—',
      Estado: r.estado || '—',
      Inspector: (r.inspectorNombres || []).join(', ')
    }));
    const wsInformes = XLSX.utils.json_to_sheet(informesData.length > 0 ? informesData : [{ 'Sin datos': 'No hay informes generados' }]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsOT, "Resumen OT");
    XLSX.utils.book_append_sheet(wb, wsHoras, "Horas");
    XLSX.utils.book_append_sheet(wb, wsGastos, "Gastos");
    XLSX.utils.book_append_sheet(wb, wsInformes, "Informes");

    XLSX.writeFile(wb, `OT_${selectedOT.numero_informe || selectedOT.id}_DetalleCompleto.xlsx`);
  };

  return (
    <Dialog open={!!selectedOT} onOpenChange={(open) => { if (!open) setSelectedOT(null); }}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-hidden p-0 rounded-[2.5rem] bg-slate-50 text-slate-950 border-none shadow-2xl flex flex-col">
        {/* Header Detalle */}
        <div className="bg-slate-50/50 p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-shrink-0">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-primary text-white rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-primary/20">
              <ClipboardList size={32} />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <DialogTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{selectedOT.numero_informe || selectedOT.id}</DialogTitle>
              <span className={`px-3 py-1 text-[10px] font-black rounded-full uppercase bg-blue-100 text-blue-600`}>{selectedOT.estado}</span>
            </div>
            <p className="text-lg font-bold text-slate-500 uppercase">{selectedOT.descripcion}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleExportFullOT}
            className="rounded-xl font-black bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100"
          >
            <Download size={16} className="mr-2" /> Excel OT
          </Button>
          <Button
            onClick={() => handleEditJob(selectedOT)}
            disabled={selectedOT.estado === 'Completada'}
            className={cn(
              "rounded-xl font-black bg-white border border-slate-200 text-slate-700 hover:bg-slate-50",
              selectedOT.estado === 'Completada' && "opacity-40 cursor-not-allowed"
            )}
          >
            <Pencil size={16} className="mr-2" /> Editar
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleDeleteJob(selectedOT)}
            disabled={selectedOT.estado === 'Completada'}
            className={cn(
              "rounded-xl font-black",
              selectedOT.estado === 'Completada' && "opacity-40 cursor-not-allowed"
            )}
          >
            <Trash2 size={16} className="mr-2" /> Eliminar
          </Button>
          <button
            onClick={() => setSelectedOT(null)}
            className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-grow overflow-y-auto p-8 custom-scroll bg-slate-50">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 1. Información General */}
        <div className="space-y-6">
          <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <User size={14} className="text-primary" /> Información General
          </h4>
          <div className="grid gap-3">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Cliente</p>
              <p className="text-sm font-bold text-slate-800 uppercase">{selectedOT.clienteNombre || selectedOT.cliente || '—'}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Contacto</p>
              <p className="text-sm font-bold text-slate-800 uppercase">{selectedOT.contacto || 'No especificado'}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Teléfono</p>
              <p className="text-sm font-bold text-slate-800 uppercase">{selectedOT.telefono || '—'}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Email</p>
              <p className="text-sm font-bold text-slate-600 truncate">{selectedOT.email || '—'}</p>
            </div>
          </div>
        </div>

        {/* 2. Ubicación */}
        <div className="space-y-6">
          <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <MapPin size={14} className="text-primary" /> Ubicación
          </h4>
          <div className="grid gap-3">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Dirección</p>
              <p className="text-sm font-bold text-slate-800 uppercase">{selectedOT.direccion || selectedOT.instalacion || '—'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Ciudad</p>
                <p className="text-sm font-bold text-slate-800 uppercase">{selectedOT.ciudad || '—'}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">C.P.</p>
                <p className="text-sm font-bold text-slate-800 uppercase">{selectedOT.codigo_postal || '—'}</p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">País</p>
              <p className="text-sm font-bold text-slate-800 uppercase">{selectedOT.pais || 'España'}</p>
            </div>
          </div>
        </div>

        {/* 3. Detalles de la OT */}
        <div className="space-y-6">
          <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <Settings size={14} className="text-primary" /> Detalles de la OT
          </h4>
          <div className="grid gap-3">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Fecha Creación</p>
              <p className="text-sm font-bold text-slate-800 uppercase">{formatSafeDate(selectedOT.fecha_creacion, 'dd/MM/yyyy HH:mm')}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Prioridad</p>
                <span className={`text-[10px] font-black uppercase ${selectedOT.prioridad === 'Alta' ? 'text-red-500' : selectedOT.prioridad === 'Media' ? 'text-amber-500' : 'text-blue-500'}`}>{selectedOT.prioridad || 'Media'}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Estado</p>
                <span className="text-[10px] font-black text-primary uppercase">{selectedOT.estado}</span>
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Descripción</p>
              <p className="text-sm font-bold text-slate-800 uppercase">{selectedOT.descripcion}</p>
            </div>
          </div>
        </div>

        {/* 4. Inspectores Asignados */}
        <div className="lg:col-span-3 border-t border-slate-100 pt-8">
          <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-6">
            <Users size={14} className="text-primary" /> Personal Operativo Asignado
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(selectedOT.inspectorNombres || []).map((nombre, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-[11px] font-black text-slate-400 uppercase">{nombre.charAt(0)}</div>
                <div>
                  <p className="text-sm font-black text-slate-800 uppercase leading-none mb-1">{nombre}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Inspector Asignado</p>
                </div>
              </div>
            ))}
          </div>
        </div>


        {/* Listado de Partes Relacionados */}
        <div className="lg:col-span-3 space-y-4 pt-4 border-t border-slate-100 mt-8">
          <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex justify-between items-center">
            <span>Partes de Trabajo Realizados</span>
            <div className="flex items-center gap-3">
              {selectedReportIds.length > 0 && (
                <Button
                  onClick={handleDownloadSelectedReports}
                  className="h-8 rounded-xl bg-primary text-white font-black text-[10px] gap-2 px-4 uppercase shadow-lg shadow-primary/20 hover:bg-white hover:text-primary hover:border-primary border border-transparent transition-all active:scale-95 group"
                >
                  <Download size={12} />
                  Descargar ({selectedReportIds.length})
                </Button>
              )}
              <span className="bg-slate-100 px-3 py-1 rounded-full text-slate-500 font-bold">{relatedReports.length} Documentos</span>
            </div>
          </h4>

          <div className="bg-slate-50 rounded-3xl overflow-hidden border border-slate-100">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200/50">
                  <th className="px-6 py-4 w-12">
                    <input 
                      type="checkbox" 
                      checked={relatedReports.length > 0 && selectedReportIds.length === relatedReports.length}
                      onChange={e => handleSelectAllReports(e.target.checked)}
                      className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4">Nº Informe</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4 text-center">Gestión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/50">
                {relatedReports.map(report => (
                  <tr key={report.id} className="hover:bg-white transition-colors group">
                    <td className="px-6 py-4 w-12">
                      <input 
                        type="checkbox" 
                        checked={selectedReportIds.includes(report.id)}
                        onChange={e => handleSelectOneReport(report.id, e.target.checked)}
                        className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-800 leading-none">
                          {getReportDisplayId(report) || report.id}
                        </span>
                        {(report as any).numero_final && getReportDisplayId(report) && (report as any).numero_final !== getReportDisplayId(report) && (
                          <span className="text-[9px] font-bold text-slate-400 mt-1 italic">
                            ({getReportDisplayId(report)})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="px-2 py-1 bg-slate-200 text-slate-600 rounded-lg text-[9px] font-black uppercase inline-block">
                        {getJobTitle(report)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${report.estado === 'Aprobado' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                        {report.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-500">
                      {formatSafeDate(report.fecha_creacion, 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => handleReprintSavedPdf(report)} className="h-8 w-8 text-slate-400 hover:text-primary"><Download size={14} /></Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditReport(report)}
                          disabled={report.estado === 'Aprobado'}
                          className="h-8 w-8 text-slate-400 hover:text-blue-600 disabled:opacity-20"
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleApproveJob(report.id, report.estado, 'informes')} className="h-8 w-8 text-slate-400 hover:text-emerald-600"><CheckCircle2 size={14} /></Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteJob(report)}
                          disabled={report.estado === 'Aprobado'}
                          className={cn(
                            "h-8 w-8 text-slate-400 hover:text-red-500",
                            report.estado === 'Aprobado' && "opacity-20 cursor-not-allowed"
                          )}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {relatedReports.length === 0 && (
              <div className="py-12 text-center text-xs font-bold text-slate-400 uppercase italic">Aún no se han generado informes vinculados a esta OT</div>
            )}
          </div>
        </div>
        
        {/* Resumen Operativo (Final) */}
        <div className="lg:col-span-3 space-y-4 pt-4 border-t border-slate-100 mt-8">
          <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <Sparkles size={14} className="text-primary" /> Resumen Operativo de la Orden
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div 
              className="p-6 bg-slate-50 rounded-3xl border border-slate-100 group relative overflow-hidden"
            >
              <div className="flex justify-between items-center mb-2 relative z-10">
                <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 tracking-widest"><Clock size={14} /> Total Horas Registradas</p>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowHorasModal(true)}
                    className="text-[9px] font-bold text-slate-500 uppercase bg-white px-2 py-1 rounded-md shadow-sm h-7"
                  >
                    Resumen
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => router.push(`/admin/hours?otId=${selectedOT.id}`)}
                    className="text-[9px] font-bold text-emerald-600 uppercase bg-white px-2 py-1 rounded-md shadow-sm h-7 border border-emerald-100"
                  >
                    Ver Detalle
                  </Button>
                </div>
              </div>
              <p className="text-4xl font-black text-slate-900 relative z-10">{totalHoras.toFixed(2)}<span className="text-lg text-slate-400 ml-1">h</span></p>
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-[#10b981]/5 rounded-full blur-2xl group-hover:bg-[#10b981]/20 transition-all"></div>
            </div>
            
            <div 
              className="p-6 bg-slate-50 rounded-3xl border border-slate-100 group relative overflow-hidden"
            >
              <div className="flex justify-between items-center mb-2 relative z-10">
                <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 tracking-widest"><Receipt size={14} /> Total Gastos Operativos</p>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowGastosModal(true)}
                    className="text-[9px] font-bold text-slate-500 uppercase bg-white px-2 py-1 rounded-md shadow-sm h-7"
                  >
                    Resumen
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => router.push(`/admin/expenses?otId=${selectedOT.id}`)}
                    className="text-[9px] font-bold text-emerald-600 uppercase bg-white px-2 py-1 rounded-md shadow-sm h-7 border border-emerald-100"
                  >
                    Ver Detalle
                  </Button>
                </div>
              </div>
              <p className="text-4xl font-black text-emerald-600 relative z-10">{totalGastos.toFixed(2)}<span className="text-lg ml-1">€</span></p>
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-emerald-600/5 rounded-full blur-2xl group-hover:bg-emerald-600/20 transition-all"></div>
            </div>
          </div>
        </div>
      </div>

      </div>

      <Dialog open={showHorasModal} onOpenChange={setShowHorasModal}>
        <DialogContent className="max-w-2xl bg-white rounded-[3rem] p-8 border-none shadow-2xl overflow-hidden [&>button]:hidden">
          <div className="absolute right-8 top-8 z-50">
            <button 
              onClick={() => setShowHorasModal(false)}
              className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
            >
              <X size={20} />
            </button>
          </div>
          <DialogTitle className="font-black text-xl text-slate-900 uppercase tracking-tighter flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center"><Clock size={20} /></div>
            Detalle de Horas
          </DialogTitle>
          <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scroll">
            {Object.entries(
              relatedHoras.reduce((acc, h) => {
                const name = h.inspectorNombre || 'Inspector';
                if (!acc[name]) acc[name] = { norm: 0, ext: 0, esp: 0, total: 0 };
                const n = parseFloat(h.hNormalesStr) || 0;
                const e = parseFloat(h.hExtrasStr) || 0;
                const s = parseFloat(h.hEspecialesStr) || 0;
                acc[name].norm += n; acc[name].ext += e; acc[name].esp += s; acc[name].total += n+e+s;
                return acc;
              }, {} as Record<string, any>)
            ).map(([inspector, data]: [string, any], i) => (
              <div key={i} className="p-4 bg-slate-50 border border-slate-100 rounded-3xl">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-black text-slate-800 uppercase flex items-center gap-2"><User size={14} className="text-emerald-500"/> {inspector}</p>
                  <p className="text-xl font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl">{data.total.toFixed(2)}h</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Normales</p>
                    <p className="font-bold text-slate-700">{data.norm.toFixed(2)}h</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Extras</p>
                    <p className="font-bold text-amber-600">{data.ext.toFixed(2)}h</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Especiales</p>
                    <p className="font-bold text-blue-600">{data.esp.toFixed(2)}h</p>
                  </div>
                </div>
              </div>
            ))}
            {relatedHoras.length === 0 && <p className="text-center text-xs font-bold text-slate-400 py-8 uppercase">No hay horas vinculadas</p>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showGastosModal} onOpenChange={setShowGastosModal}>
        <DialogContent className="max-w-2xl bg-white rounded-[3rem] p-8 border-none shadow-2xl overflow-hidden [&>button]:hidden">
          <div className="absolute right-8 top-8 z-50">
            <button 
              onClick={() => setShowGastosModal(false)}
              className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
            >
              <X size={20} />
            </button>
          </div>
          <DialogTitle className="font-black text-xl text-slate-900 uppercase tracking-tighter flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><Receipt size={20} /></div>
            Detalle de Gastos
          </DialogTitle>
          <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scroll">
            {Object.entries(
              relatedGastos.reduce((acc, g) => {
                const name = g.inspectorNombre || 'Inspector';
                if (!acc[name]) acc[name] = { total: 0, rubros: {} as Record<string, number> };
                const m = parseFloat(g.monto) || 0;
                acc[name].total += m;
                if (!acc[name].rubros[g.rubro]) acc[name].rubros[g.rubro] = 0;
                acc[name].rubros[g.rubro] += m;
                return acc;
              }, {} as Record<string, any>)
            ).map(([inspector, data]: [string, any], i) => (
              <div key={i} className="p-4 bg-slate-50 border border-slate-100 rounded-3xl">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-black text-slate-800 uppercase flex items-center gap-2"><User size={14} className="text-emerald-600"/> {inspector}</p>
                  <p className="text-xl font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl">{data.total.toFixed(2)}€</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(data.rubros).map(([rubro, monto]: [string, any], idx) => (
                    <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col items-center">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{rubro}</p>
                      <p className="font-bold text-slate-700">{monto.toFixed(2)}€</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {relatedGastos.length === 0 && <p className="text-center text-xs font-bold text-slate-400 py-8 uppercase">No hay gastos vinculados</p>}
          </div>
        </DialogContent>
      </Dialog>
      </DialogContent>
    </Dialog>
  );
}
