'use client';

/* eslint-disable react-hooks/exhaustive-deps -- QA: warning reviewed; keeping current flow to avoid behavioral changes. */

import { useFirestore, useUser } from '@/firebase';
import { resolveInspectorEmail } from '@/lib/inspection-mode';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import {
  Calendar,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  Loader2,
  MapPin,
  Search,
  Star,
  TrendingUp,
  User
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getReportDisplayId } from '@/app/inspection/lib/report-record';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { db as localDb } from '@/lib/db-local';
import { getPdfFileName, normalizeReportForPdf } from '@/lib/pdf-utils';
import { cn, formatSafeDate } from '@/lib/utils';
import { Printer } from 'lucide-react';
import { generatePDF as generateHojaTrabajoPDF } from './forms/HojaTrabajoForm';
import { generatePDF as generateInformeRevisionPDF } from './forms/InformeRevisionForm';
import { generatePDF as generateInformeSimplificadoPDF } from './forms/InformeSimplificadoForm';
import { generatePDF as generateInformeTecnicoPDF } from './forms/InformeTecnicoForm';
import { generatePDF as generateRevisionBasicaPDF } from './forms/RevisionBasicaForm';

const getInitials = (name?: string) => {
  if (!name) return '';
  return name
    .split(' ')
    .map(n => n.charAt(0))
    .join('')
    .toUpperCase();
};

interface Task {
  id: string;
  clienteNombre?: string;
  cliente?: string;
  instalacion?: string;
  estado: string;
  fecha_creacion?: any;
  firebaseId?: string;
  synced?: boolean;
  createdAt?: Date;
  itinerario?: any[];
  gastos?: any[];
  [key: string]: any;
}

type FilterType = 'asignado' | 'registrado' | 'aprobado';

import OTDetailModal from './OTDetailModal';

// ────────── LEGACY/HOURS DETAIL MODAL ──────────
function LegacyDetailModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const isBitacora = task.type === 'bitacora' || task.formType === 'bitacora';

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl bg-slate-50 rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
        <div className="bg-white p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-[#165a30]/10 rounded-2xl flex items-center justify-center text-[#165a30]">
            {isBitacora ? <Clock size={24} /> : <TrendingUp size={24} />}
          </div>
          <div>
            <DialogTitle className="text-xl font-black text-slate-900 uppercase tracking-tighter">
              {isBitacora ? 'Detalle de Horas' : 'Detalle de Gastos'}
            </DialogTitle>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {task.fechaStr || formatSafeDate(task.fecha || task.fecha_creacion, 'dd/MM/yyyy')}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {isBitacora ? (
            <div className="bg-white p-6 rounded-3xl border border-slate-100 space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-slate-50">
                <span className="text-[10px] font-black text-slate-400 uppercase">Cliente</span>
                <span className="font-bold text-slate-800 uppercase">{task.clienteNombre || 'N/A'}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Llegada</p>
                  <p className="font-black text-slate-900">{task.horaLlegada || '--:--'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Salida</p>
                  <p className="font-black text-slate-900">{task.horaSalida || '--:--'}</p>
                </div>
              </div>
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex justify-between items-center">
                <p className="text-[10px] font-black text-emerald-600 uppercase">Total Horas</p>
                <p className="text-xl font-black text-emerald-700">{task.hNormalesStr || '0.00'}h</p>
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-3xl border border-slate-100 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase">Concepto</span>
                <span className="font-bold text-slate-800 uppercase">{task.rubro || 'N/A'}</span>
              </div>
              <p className="text-sm font-medium text-slate-600">{task.descripcion || 'Sin descripción'}</p>
              <div className="flex justify-between items-center p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <p className="text-[10px] font-black text-blue-600 uppercase">Monto</p>
                <p className="text-xl font-black text-blue-700">{task.monto ? task.monto.toFixed(2) : '0.00'}€</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ────────── MAIN COMPONENT ──────────
export default function HistoryTab({ onStartInspection, onSelectOT }: { onStartInspection: (task: Task) => void; onSelectOT?: (ot: Task) => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('asignado');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { user } = useUser();
  const db = useFirestore();
  const isOnline = useOnlineStatus();
  const currentEmail = resolveInspectorEmail(user?.email || '');

  const normalizeDate = (task: any): number => {
    if (task.createdAt instanceof Date) return task.createdAt.getTime();
    if (task.fecha_creacion?.toDate) return task.fecha_creacion.toDate().getTime();
    if (task.fecha_creacion?.seconds) return task.fecha_creacion.seconds * 1000;
    if (task.fecha?.toDate) return task.fecha.toDate().getTime(); // Daily reports use 'fecha'
    if (task.fecha?.seconds) return task.fecha.seconds * 1000;
    if (typeof task.fecha_creacion === 'string') return new Date(task.fecha_creacion).getTime();
    if (typeof task.fecha === 'string') return new Date(task.fecha).getTime();
    return 0;
  };

  useEffect(() => {
    if (!user || !db || !user.email) return;

    const fetchTasks = async () => {
      setLoading(true);
      try {
        const firestoreTaskMap = new Map<string, Task>();

        if (isOnline) {
          const email = resolveInspectorEmail(user.email);
          const qAssigned = query(collection(db, "ordenes_trabajo"), where("inspectorIds", "array-contains", email));
          const qCreated = query(collection(db, "ordenes_trabajo"), where("tecnicoId", "==", email));

          // Limitamos a los últimos 150 informes para evitar saturar dispositivos antiguos como la tablet,
          // manteniendo la visibilidad de los trabajos recientes de compañeros.
          const qInformes = query(
            collection(db, "informes"),
            orderBy("fecha_creacion", "desc"),
            limit(50)
          );

          const [assignedSnap, createdSnap, informesSnap] = await Promise.all([
            getDocs(qAssigned),
            getDocs(qCreated),
            getDocs(qInformes)
          ]);

          assignedSnap.docs.forEach(doc => firestoreTaskMap.set(doc.id, { ...doc.data(), id: doc.id, synced: true, type: 'ot', estado: doc.data().estado || 'Asignado' } as Task));
          createdSnap.docs.forEach(doc => firestoreTaskMap.set(doc.id, { ...doc.data(), id: doc.id, synced: true, type: 'ot', estado: doc.data().estado || 'Asignado' } as Task));
          informesSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.eliminado === true) return;
            firestoreTaskMap.set(doc.id, { ...data, id: doc.id, synced: true, type: 'informe', estado: data.estado || 'Registrado' } as Task);
          });
        }

        const localTasksRaw = await localDb.hojas_trabajo.toArray();
        const localTaskMap = new Map<string, Task>();
        localTasksRaw.forEach(t => {
          if (t.data.eliminado === true) return;

          // Filtrar por inspector si no es admin (aunque en HistoryTab siempre es perfil inspector)
          const itemInspector = t.data.inspectorId || t.data.tecnicoId;
          if (itemInspector && itemInspector !== currentEmail) return;

          const taskData = {
            ...t.data,
            id: t.id!.toString(),
            synced: t.synced,
            firebaseId: t.firebaseId,
            createdAt: t.createdAt,
            type: t.data.type || 'informe' // Forzar tipo informe si es de hojas_trabajo
          };
          const key = t.firebaseId || `local_${t.id}`;
          localTaskMap.set(key, taskData);
        });

        const finalTaskMap = new Map<string, Task>(localTaskMap);
        firestoreTaskMap.forEach((task, id) => { finalTaskMap.set(id, task); });

        const combinedTasks = Array.from(finalTaskMap.values());
        combinedTasks.sort((a, b) => normalizeDate(b) - normalizeDate(a));
        setTasks(combinedTasks);

      } catch (error) {
        console.error("Error al cargar el historial:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [user, db, isOnline]);

  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    if (filter === 'asignado') {
      // Solo OTs en la pestaña de asignados
      filtered = filtered.filter(t => t.type === 'ot' && (t.estado === 'Registrada' || t.estado === 'En Proceso'));
    } else if (filter === 'registrado') {
      // Solo informes en la pestaña de registrados
      filtered = filtered.filter(t => t.type === 'informe' && t.estado === 'Registrado');
    } else {
      // Solo informes en la pestaña de aprobados
      filtered = filtered.filter(t => t.type === 'informe' && t.estado === 'Aprobado');
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        (t.clienteNombre && t.clienteNombre.toLowerCase().includes(term)) ||
        (t.cliente && t.cliente.toLowerCase().includes(term)) ||
        t.id.toLowerCase().includes(term) ||
        (t.numero_informe && t.numero_informe.toLowerCase().includes(term)) ||
        (t.numero_final && t.numero_final.toLowerCase().includes(term)) ||
        (t.firebaseId && t.firebaseId.toLowerCase().includes(term)) ||
        (t.descripcion && t.descripcion.toLowerCase().includes(term))
      );
    }

    return filtered;
  }, [tasks, filter, searchTerm]);

  const handleDownloadPdf = async (job: any) => {
    const finalId = getReportDisplayId(job) || job.numero_informe || job.id;
    const inspectorName = job.tecnicoNombre || job.inspectorNombres?.join(', ') || 'Inspector Energy Engine';
    const reportForPdf = await normalizeReportForPdf(job);
    let docPdf: any = null;

    try {
      switch (job.formType) {
        case 'hoja-trabajo': docPdf = await generateHojaTrabajoPDF(reportForPdf, inspectorName, finalId); break;
        case 'informe-revision': docPdf = await generateInformeRevisionPDF(reportForPdf, inspectorName, finalId); break;
        case 'informe-tecnico': docPdf = await generateInformeTecnicoPDF(reportForPdf, inspectorName, finalId); break;
        case 'informe-simplificado': docPdf = await generateInformeSimplificadoPDF(reportForPdf, inspectorName, finalId); break;
        case 'revision-basica': docPdf = await generateRevisionBasicaPDF(reportForPdf, inspectorName, finalId); break;
        default: return;
      }
      if (docPdf) docPdf.save(getPdfFileName(finalId));
    } catch (e) {
      console.error("Error generating PDF:", e);
    }
  };

  const handleDownloadMultiplePdfs = async (reportsToDownload: any[]) => {
    if (reportsToDownload.length === 0) return;
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const usedNames = new Map<string, number>();

      for (const report of reportsToDownload) {
        const finalId = getReportDisplayId(report) || report.id;
        const inspectorName = report.tecnicoNombre || report.inspectorNombres?.join(', ') || 'Inspector Energy Engine';
        const reportForPdf = await normalizeReportForPdf(report);
        let docPdf: any = null;

        switch (report.formType) {
          case 'hoja-trabajo': docPdf = await generateHojaTrabajoPDF(reportForPdf, inspectorName, finalId); break;
          case 'informe-revision': docPdf = await generateInformeRevisionPDF(reportForPdf, inspectorName, finalId); break;
          case 'informe-tecnico': docPdf = await generateInformeTecnicoPDF(reportForPdf, inspectorName, finalId); break;
          case 'informe-simplificado': docPdf = await generateInformeSimplificadoPDF(reportForPdf, inspectorName, finalId); break;
          case 'revision-basica': docPdf = await generateRevisionBasicaPDF(reportForPdf, inspectorName, finalId); break;
          default: continue;
        }
        if (docPdf) {
          const baseName = getPdfFileName(finalId);
          const count = usedNames.get(baseName) || 0;
          usedNames.set(baseName, count + 1);
          const safeName = count === 0 ? baseName : baseName.replace(/\.pdf$/i, `_${count + 1}.pdf`);
          zip.file(safeName, docPdf.output('blob'));
        }
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const date = new Date();
      const stamp = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
      const zipName = `informes_${stamp}.zip`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = zipName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Error generating ZIP:", e);
    }
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'Aprobado': return 'bg-emerald-50 text-emerald-600';
      case 'Registrado': return 'bg-blue-50 text-blue-600';
      case 'Asignado': return 'bg-orange-50 text-orange-600';
      default: return 'bg-slate-50 text-slate-600';
    }
  };

  const getReportTitle = (formType: any) => {
    switch (formType) {
      case 'hoja-trabajo': return 'Hoja de Trabajo';
      case 'informe-revision': return 'Inf. Revisión';
      case 'revision-basica': return 'Rev. Básica';
      case 'informe-tecnico': return 'Inf. Técnico';
      case 'informe-simplificado': return 'Inf. Simplificado';
      case 'gastos': return 'Gasto';
      case 'bitacora': return 'Horas / Visita';
      case 'job': return 'Orden de Trabajo';
      default: return 'Documento';
    }
  };

  const TABS: { key: FilterType; label: string; icon: React.ReactNode }[] = [
    { key: 'asignado', label: 'Asignado', icon: <MapPin size={12} /> },
    { key: 'registrado', label: 'Registrado', icon: <ClipboardCheck size={12} /> },
    { key: 'aprobado', label: 'Aprobado', icon: <Star size={12} /> },
  ];

  return (
    <>
      {selectedTask && selectedTask.type === 'ot' ? (
        <OTDetailModal
          ot={selectedTask}
          reports={tasks.filter(t => t.orderId === selectedTask.id)}
          currentEmail={currentEmail || undefined}
          onClose={() => setSelectedTask(null)}
          onStartAction={(type, ot) => {
            onStartInspection({ ...ot, formType: type, orderId: ot.id, originalJobId: ot.id });
            setSelectedTask(null);
          }}
          onEditReport={(report) => {
            onStartInspection(report);
            setSelectedTask(null);
          }}
          onDownloadPdf={handleDownloadPdf}
          onDownloadMultiplePdfs={handleDownloadMultiplePdfs}
        />
      ) : selectedTask && selectedTask.type === 'informe' ? null : selectedTask && (
        <LegacyDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500 w-full max-w-4xl mx-auto">

        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Bandeja de Trabajos</h2>
          <div className="w-full md:w-auto flex items-center gap-1 bg-slate-200 p-1 rounded-full">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all flex-1 justify-center ${filter === tab.key
                  ? 'bg-slate-900 text-white shadow'
                  : 'text-slate-500 hover:text-slate-800'
                  }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <Input
            type="text"
            placeholder="Buscar por cliente o ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-6 pl-12 rounded-2xl bg-white shadow-sm border-slate-100 text-lg font-bold"
          />
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="py-20 flex justify-center items-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
          ) : filteredTasks.length > 0 ? (
            filteredTasks.map((task) => {
              const reportOwner = task.inspectorId || task.tecnicoId || task.email;
              const isOtherTechnicianReport = task.type === 'informe' && reportOwner && currentEmail && reportOwner !== currentEmail;

              // Si el informe fue editado por otro (Mario's requirement)
              const lastEditorName = task.modificadoPorNombre || task.lastEditedByName || '';
              const lastEditorEmail = task.modificadoPorId || task.lastEditedByEmail || '';
              const showInitials = lastEditorEmail && lastEditorEmail !== reportOwner;
              const initials = showInitials ? ` (${getInitials(lastEditorName)})` : '';

              return (
                <button
                  key={task.id}
                  onClick={() => {
                    if (task.type === 'informe') {
                      onStartInspection(task);
                    } else if (task.type === 'ot') {
                      // Use centralized OT modal in page.tsx if callback provided
                      if (onSelectOT) {
                        onSelectOT(task);
                      } else {
                        setSelectedTask(task);
                      }
                    } else {
                      setSelectedTask(task);
                    }
                  }}
                  className={cn(
                    "w-full p-6 rounded-[2.5rem] shadow-sm border flex items-center justify-between group active:scale-[0.98] transition-all text-left hover:shadow-md",
                    isOtherTechnicianReport
                      ? "bg-[#0b3d2e] border-[#0b3d2e] text-white"
                      : "bg-white border-slate-100 text-slate-900"
                  )}
                >
                  <div className="flex items-center gap-5 flex-1 min-w-0">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors",
                      isOtherTechnicianReport ? "bg-white/10 text-white" :
                        task.type === 'ot' ? 'bg-primary/10 text-primary' :
                          task.type === 'bitacora' ? 'bg-emerald-100 text-emerald-600' :
                            task.type === 'gasto' ? 'bg-blue-100 text-blue-600' :
                              'bg-slate-100 text-slate-400'
                    )}>
                      {task.type === 'ot' ? <ClipboardList size={28} /> :
                        task.type === 'bitacora' ? <Clock size={28} /> :
                          task.type === 'gasto' ? <TrendingUp size={28} /> :
                            <FileText size={28} />}
                    </div>
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-3 py-1 text-[9px] font-black rounded-full uppercase ${task.type === 'ot' ? 'bg-indigo-50 text-indigo-600' : 'bg-green-50 text-green-600'}`}>
                          {task.type === 'ot'
                            ? (task.numero_informe || task.id)
                            : task.numero_final
                              ? `${task.numero_final} (${getReportDisplayId(task) || task.id})`
                              : (getReportDisplayId(task) || task.id)}
                        </span>
                        {task.estado && (
                          <span className={`px-3 py-1 text-[9px] font-black rounded-full uppercase ${getEstadoBadge(task.estado)}`}>
                            {task.estado}
                          </span>
                        )}
                        {task.prioridad === 'Alta' && (
                          <span className="px-3 py-1 text-[9px] font-black rounded-full uppercase bg-red-50 text-red-600">Alta Prioridad</span>
                        )}
                      </div>

                      {task.type === 'ot' ? (
                        <div className="space-y-1">
                          <h3 className="text-xl font-black text-primary tracking-tight leading-none uppercase truncate">
                            {task.clienteNombre || task.cliente || 'CLIENTE'}
                          </h3>
                          <p className={cn(
                            "text-sm font-bold uppercase truncate",
                            isOtherTechnicianReport ? "text-emerald-100" : "text-slate-600"
                          )}>
                            {task.descripcion || 'Sin título'}
                          </p>
                          <div className="flex flex-col gap-1 mt-2">
                            {(task.direccion || task.ciudad) && (
                              <div className="flex items-center gap-1.5 text-slate-400">
                                <MapPin size={10} className="text-primary/40" />
                                <span className="text-[9px] font-black uppercase truncate">
                                  {task.direccion}{task.ciudad ? ` • ${task.ciudad}` : ''}
                                </span>
                              </div>
                            )}
                            <div className={cn(
                              "flex items-center gap-1.5",
                              isOtherTechnicianReport ? "text-white/40" : "text-slate-300"
                            )}>
                              <Calendar size={10} />
                              <span className="text-[8px] font-black uppercase">
                                Asignación: {formatSafeDate(task.fecha_creacion || task.fecha, 'dd/MM/yyyy')}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase truncate">
                            {getReportTitle(task.formType)}
                          </h3>
                          <div className={cn(
                            "flex items-center gap-4 text-[10px] font-bold uppercase",
                            isOtherTechnicianReport ? "text-white/60" : "text-slate-400"
                          )}>
                            <div className="flex items-center gap-1.5">
                              <User size={12} /> {task.tecnicoNombre || task.inspectorNombre || task.clienteNombre || task.cliente || 'Inspector'}
                              {initials && <span className="ml-1 opacity-70">{initials}</span>}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock size={12} /> {formatSafeDate(task.fecha_creacion || task.fecha, 'dd/MM/yyyy')}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Botón de acción: Flecha para edición o Printer para descarga en Aprobados */}
                  {task.type === 'informe' && task.estado === 'Aprobado' ? (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadPdf(task);
                      }}
                      className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#165a30]/10 text-[#165a30] hover:bg-[#165a30] hover:text-white transition-all shadow-inner flex-shrink-0 ml-4 cursor-pointer"
                    >
                      <Printer size={20} />
                    </div>
                  ) : (
                    !(task.type === 'informe' && task.estado === 'Aprobado') && (
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-inner flex-shrink-0 ml-4",
                        isOtherTechnicianReport ? "bg-white/10 text-white" :
                          filter === 'aprobado' ? 'bg-[#165a30]/10 text-[#165a30] group-hover:bg-[#165a30] group-hover:text-white' :
                            filter === 'registrado' ? 'bg-[#165a30]/10 text-[#165a30] group-hover:bg-[#165a30] group-hover:text-white' :
                              'bg-slate-50 text-slate-300 group-hover:bg-primary group-hover:text-white'
                      )}>
                        {isOtherTechnicianReport ? <Printer size={20} /> : <ChevronRight size={20} />}
                      </div>
                    )
                  )}
                </button>
              );
            })
          ) : (
            <div className="bg-white p-12 rounded-[3rem] border-2 border-dashed border-slate-100 text-center space-y-4 shadow-inner">
              <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto text-slate-300">
                <Search size={32} />
              </div>
              <div>
                <p className="text-slate-900 font-black uppercase text-sm tracking-widest">Sin resultados</p>
                <p className="text-slate-400 text-[10px] font-bold leading-relaxed px-4 mt-1 uppercase tracking-widest">
                  {searchTerm ? 'Prueba con otro término.' : `No hay trabajos en estado "${filter}".`}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
