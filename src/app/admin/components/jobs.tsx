'use client';

/* eslint-disable react-hooks/set-state-in-effect -- QA: warning reviewed; keeping current flow to avoid behavioral changes. */

import { suggestCorrections } from '@/ai/flows/suggest-corrections-flow';
import { generatePDF as generateHojaTrabajoPDF } from '@/app/inspection/components/forms/HojaTrabajoForm';
import { generatePDF as generateInformeRevisionPDF } from '@/app/inspection/components/forms/InformeRevisionForm';
import { generatePDF as generateInformeSimplificadoPDF } from '@/app/inspection/components/forms/InformeSimplificadoForm';
import { generatePDF as generateInformeTecnicoPDF } from '@/app/inspection/components/forms/InformeTecnicoForm';
import { generatePDF as generateRevisionBasicaPDF } from '@/app/inspection/components/forms/RevisionBasicaForm';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { decrementOTCounterIfLast, getNextGlobalReportId, getNextOTId } from '@/lib/ot-utils';
import { getPdfFileName, normalizeReportForPdf } from '@/lib/pdf-utils';
import { format } from 'date-fns';
import { collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAdminHeader } from './AdminHeaderContext';
import { getCreationReportId, getReportDisplayId } from '@/app/inspection/lib/report-record';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Database, Link2, Plus, Search } from 'lucide-react';

// Auxiliares Refactorizados
import JobDetailView from './jobs/JobDetailView';
import JobFormModal from './jobs/JobFormModal';
import JobsTable from './jobs/JobsTable';
import ReportEditorDialog from './jobs/ReportEditorDialog';
import ReportsTable from './jobs/ReportsTable';

const FORM_TYPES = [
  { id: 'hoja-trabajo', label: 'Hoja de Trabajo', sub: 'Registro de materiales y servicios' },
  { id: 'informe-tecnico', label: 'Informe Técnico', sub: 'Reporte detallado de intervenciones' },
  { id: 'informe-revision', label: 'Informe de Revisión', sub: 'Checklist completo de mantenimiento' },
  { id: 'informe-simplificado', label: 'Informe Simplificado', sub: 'Para equipos sin checklist (ej. motobombas)' },
  { id: 'revision-basica', label: 'Revisión Básica', sub: 'Checklist básico de inspección' },
];

const isUnlinkedReport = (report: any) => (
  report?.formType !== 'job'
  && (
    report?.procedencia === 'INDEPENDIENTE'
    || (!report?.orderId && !report?.originalJobId && !report?.numero_ot)
  )
);

export default function JobsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { setHeaderProps } = useAdminHeader();

  // Data States
  const [jobs, setJobs] = useState<any[]>([]);
  const [allInformes, setAllInformes] = useState<any[]>([]);
  const [inspectors, setInspectors] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // View/Navigation States
  const [activeView, setActiveView] = useState<'ots' | 'reports'>('ots');
  const [selectedOT, setSelectedOT] = useState<any>(null);
  const [relatedReports, setRelatedReports] = useState<any[]>([]);
  const [reportsFilterMode, setReportsFilterMode] = useState<'all' | 'unlinked' | 'linked' | 'deleted'>('all');

  // Modal/Editor States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [isReportEditorOpen, setIsReportEditorOpen] = useState(false);
  const [selectedReportForEdit, setSelectedReportForEdit] = useState<any>(null);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Filter States
  const [filterQuery, setFilterQuery] = useState('');
  const [filterInspectorId, setFilterInspectorId] = useState('all');
  const [filterReportType, setFilterReportType] = useState('all');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'completed' | 'all'>('active');

  // 1. Fetching
  useEffect(() => {
    if (!db) return;
    setLoading(true);

    const unsubJobs = onSnapshot(query(collection(db, 'ordenes_trabajo'), orderBy('fecha_creacion', 'desc'), limit(500)), (snap) => {
      setJobs(snap.docs.map(d => ({ id: d.id, sourceCollection: 'ordenes_trabajo', ...d.data() })));
    });

    const unsubInspectors = onSnapshot(query(collection(db, 'usuarios'), where("roles", "array-contains-any", ["inspector", "super", "admin"])), (snap) => {
      setInspectors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubClients = onSnapshot(collection(db, 'clientes'), (snap) => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubReports = onSnapshot(query(collection(db, 'informes'), orderBy('fecha_creacion', 'desc'), limit(500)), (snap) => {
      setAllInformes(snap.docs
        .map(d => {
          const data = d.data();
          // Firestore document id is the real report id. Some recovered/legacy
          // reports still carry an internal "id" field with the OT number.
          return {
            ...data,
            id: d.id,
            firestoreId: d.id,
            dataId: (data as any).id,
            sourceCollection: 'informes',
          };
        }));
    });

    setLoading(false);
    return () => { unsubJobs(); unsubInspectors(); unsubClients(); unsubReports(); };
  }, [db]);


  // 3. Logic: Filters
  const filteredData = useMemo(() => {
    const source = activeView === 'ots' ? jobs : allInformes;
    return source.map(j => {
      // Si es una OT, enriquecer con datos frescos del cliente si faltan
      if (activeView === 'ots') {
        const client = clients.find(c => c.id === j.clienteId || c.nombre === j.clienteNombre);
        if (client) {
          return {
            ...j,
            contacto: j.contacto || client.contacto || '—',
            telefono: j.telefono || client.telefono || '—',
            email: j.email || client.email || '—',
            direccion: j.direccion || client.direccion || '—',
            ciudad: j.ciudad || client.ciudad || '—',
            codigo_postal: j.codigo_postal || client.cp || client.codigo_postal || '—',
          };
        }
      }
      return j;
    }).filter(j => {
      if (activeView === 'reports') {
        if (reportsFilterMode === 'unlinked' && (!isUnlinkedReport(j) || j.eliminado === true)) return false;
        if (reportsFilterMode === 'linked' && (isUnlinkedReport(j) || j.eliminado === true)) return false;
        if (reportsFilterMode === 'deleted' && j.eliminado !== true) return false;
        if (reportsFilterMode === 'all' && j.eliminado === true) return false;
      }

      const matchQuery = !filterQuery ||
        (j.numero_informe || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
        (j.numero_final || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
        (j.clienteNombre || j.cliente || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
        (j.descripcion || '').toLowerCase().includes(filterQuery.toLowerCase());

      const matchInspector = filterInspectorId === 'all' || (j.inspectorIds || []).includes(filterInspectorId);
      const matchType = filterReportType === 'all' || j.formType === filterReportType;

      let matchDate = true;
      if (filterDateStart || filterDateEnd) {
        const d = j.fecha_creacion?.toDate ? j.fecha_creacion.toDate() : (j.fecha_creacion ? new Date(j.fecha_creacion) : null);
        if (d) {
          if (filterDateStart && d < new Date(filterDateStart)) matchDate = false;
          if (filterDateEnd && d > new Date(filterDateEnd + 'T23:59:59')) matchDate = false;
        }
      }

      // Filtro de estado para OTs
      let matchStatus = true;
      if (activeView === 'ots') {
        if (statusFilter === 'active') matchStatus = ['Registrada', 'En Proceso'].includes(j.estado || 'Registrada');
        if (statusFilter === 'completed') matchStatus = j.estado === 'Completada';
      }

      return matchQuery && matchInspector && matchType && matchDate && matchStatus;
    });
  }, [activeView, jobs, allInformes, filterQuery, filterInspectorId, filterReportType, filterDateStart, filterDateEnd, statusFilter, clients, reportsFilterMode]);

  // 4. Logic: Related Reports
  useEffect(() => {
    if (selectedOT) {
      setRelatedReports(allInformes.filter(inf => (inf.originalJobId === selectedOT.id || inf.orderId === selectedOT.id) && inf.eliminado !== true));
    }
  }, [selectedOT, allInformes]);

  // 5. Handlers
  const handleExportExcel = useCallback(async () => {
    toast({ title: 'Generando Excel', description: 'Procesando datos, por favor espera...' });

    // ------------------------------------------------------------------
    // MODO 1: EXCEL DE INFORMES MAESTROS (Una fila por informe, todo aplanado)
    // ------------------------------------------------------------------
    if (activeView === 'reports') {
      const flattenObject = (obj: any, prefix = ''): any => {
        if (!obj) return {};
        return Object.keys(obj).reduce((acc: any, k: string) => {
          const pre = prefix.length ? prefix + '_' : '';
          const val = obj[k];
          
          if (typeof val === 'object' && val !== null && !Array.isArray(val) && !(val instanceof Date) && !val.toDate) {
            Object.assign(acc, flattenObject(val, pre + k));
          } else if (Array.isArray(val)) {
            acc[pre + k] = JSON.stringify(val);
          } else if (val && typeof val.toDate === 'function') {
            try { acc[pre + k] = format(val.toDate(), 'dd/MM/yyyy HH:mm:ss'); } catch { acc[pre + k] = String(val); }
          } else if (val instanceof Date) {
            try { acc[pre + k] = format(val, 'dd/MM/yyyy HH:mm:ss'); } catch { acc[pre + k] = String(val); }
          } else {
            acc[pre + k] = val;
          }
          return acc;
        }, {});
      };

      const groupedReports: Record<string, any[]> = {};
      
      filteredData.forEach((report) => {
        const type = report.formType || 'general';
        if (!groupedReports[type]) groupedReports[type] = [];
        
        const flattened = flattenObject(report);
        let fecha = '—';
        try {
          if (report.fecha_creacion?.toDate) fecha = format(report.fecha_creacion.toDate(), 'dd/MM/yyyy HH:mm:ss');
          else if (report.fecha_creacion) fecha = format(new Date(report.fecha_creacion), 'dd/MM/yyyy HH:mm:ss');
        } catch {}
        
        const finalReport = {
          DOCUMENT_ID: report.id,
          FECHA_REGISTRO: fecha,
          ...flattened
        };
        groupedReports[type].push(finalReport);
      });
      
      const workbook = XLSX.utils.book_new();
      
      Object.keys(groupedReports).forEach((type) => {
        const titleMatch = FORM_TYPES.find(f => f.id === type)?.label || type;
        const sheetName = titleMatch.replace(/[\[\]\/\?\*\\:]/g, '').substring(0, 31);
        const worksheet = XLSX.utils.json_to_sheet(groupedReports[type]);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      });
      
      XLSX.writeFile(workbook, `Reporte_Maestro_Informes_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
      toast({ title: 'Excel Generado', description: 'El reporte de informes se ha descargado correctamente.' });
      return; // Detenemos la ejecución para que no haga el Excel de OTs
    }

    // ------------------------------------------------------------------
    // MODO 2: EXCEL DE ÓRDENES DE TRABAJO (Resumen OTs, Horas, Gastos)
    // ------------------------------------------------------------------
    const targetOTs: any[] = filteredData;

    // 2. Enriquecer OTs con datos frescos del cliente (asegura que no haya campos vacíos)
    const enrichedOTs = targetOTs.map(j => {
      const client = clients.find(c => c.id === j.clienteId || c.nombre === j.clienteNombre);
      if (client) {
        return {
          ...j,
          contacto: j.contacto || client.contacto || '—',
          telefono: j.telefono || client.telefono || '—',
          email: j.email || client.email || '—',
          direccion: j.direccion || client.direccion || '—',
          ciudad: j.ciudad || client.ciudad || '—',
          codigo_postal: j.codigo_postal || client.cp || client.codigo_postal || '—',
          pais: j.pais || client.pais || '—'
        };
      }
      return j;
    });

    const otIds = new Set(enrichedOTs.map(j => String(j.id)));

    // 3. Preparar datos para "Resumen OTs" (Primera Hoja)
    const otData = enrichedOTs.map(j => ({
      'ID OT': j.numero_informe || j.id,
      Estado: j.estado,
      Descripción: j.descripcion || '—',
      Cliente: j.clienteNombre || j.cliente || '—',
      Contacto: j.contacto || '—',
      Teléfono: j.telefono || '—',
      Email: j.email || '—',
      Dirección: j.direccion || '—',
      Ciudad: j.ciudad || '—',
      'Código Postal': j.codigo_postal || '—',
      País: j.pais || '—',
      Instalación: j.instalacion || '—',
      'Fecha Creación': j.fecha_creacion?.toDate ? format(j.fecha_creacion.toDate(), 'dd/MM/yyyy') : '—',
      Prioridad: j.prioridad || '—',
      Inspectores: (j.inspectorNombres || []).join(', '),
      Motor: j.motor || '—',
      Modelo: j.modelo || '—',
      'Nº Motor': j.n_motor || '—'
    }));

    let horasList: any[] = [];
    let gastosList: any[] = [];

    try {
      const [horasSnap, gastosSnap] = await Promise.all([
        getDocs(collection(db, 'bitacora_visitas')),
        getDocs(collection(db, 'gastos_detalle'))
      ]);

      horasList = horasSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((h: any) => otIds.has(String(h.orderId)));
      gastosList = gastosSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((g: any) => otIds.has(String(g.orderId)));
    } catch (error) {
      console.error("Error al obtener detalles para Excel:", error);
    }

    // 4. Mapear datos vinculados usando las OTs enriquecidas como referencia
    const horasData = horasList.map(h => {
      const parentOT = enrichedOTs.find(ot => String(ot.id) === String(h.orderId));
      return {
        'ID OT': parentOT?.numero_informe || h.orderId || '—',
        ID: h.id,
        Fecha: h.fechaStr || (h.fecha?.toDate ? format(h.fecha.toDate(), 'dd/MM/yyyy') : '—'),
        Inspector: h.inspectorNombre || h.inspectorId || '—',
        Actividad: h.actividad || '—',
        'Hora Llegada': h.horaLlegada || '—',
        'Hora Salida': h.horaSalida || '—',
        'H. Normales': h.hNormalesStr || '0',
        'H. Extras': h.hExtrasStr || '0',
        'H. Especiales': h.hEspecialesStr || '0',
        Estado: h.estado || '—'
      };
    });

    const gastosData = gastosList.map(g => {
      const parentOT = enrichedOTs.find(ot => String(ot.id) === String(g.orderId));
      return {
        'ID OT': parentOT?.numero_informe || g.orderId || '—',
        ID: g.id,
        Fecha: g.fechaStr || (g.fecha?.toDate ? format(g.fecha.toDate(), 'dd/MM/yyyy') : '—'),
        Inspector: g.inspectorNombre || g.inspectorId || '—',
        Rubro: g.rubro || '—',
        Concepto: g.descripcion || '—',
        Monto: g.monto || 0,
        'Forma Pago': g.forma_pago || '—',
        Estado: g.estado || '—'
      };
    });

    const informesData = allInformes
      .filter(inf => (otIds.has(String(inf.originalJobId)) || otIds.has(String(inf.orderId))) && inf.eliminado !== true)
      .map(r => {
        const parentOT = enrichedOTs.find(ot => String(ot.id) === String(r.originalJobId || r.orderId));
        return {
          'ID OT': parentOT?.numero_informe || r.originalJobId || r.orderId || '—',
          ID: getReportDisplayId(r) || r.id,
          Tipo: r.formType || '—',
          Fecha: r.fecha_creacion?.toDate ? format(r.fecha_creacion.toDate(), 'dd/MM/yyyy') : '—',
          Estado: r.estado || '—',
          Inspector: (r.inspectorNombres || []).join(', ')
        };
      });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(otData.length > 0 ? otData : [{ 'Sin datos': 'No hay OTs' }]), "Resumen OTs");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(horasData.length > 0 ? horasData : [{ 'Sin datos': 'No hay horas registradas' }]), "Horas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gastosData.length > 0 ? gastosData : [{ 'Sin datos': 'No hay gastos registrados' }]), "Gastos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(informesData.length > 0 ? informesData : [{ 'Sin datos': 'No hay informes' }]), "Informes");

    XLSX.writeFile(wb, `Reporte_Masivo_OTs_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
    toast({ title: 'Excel Generado', description: 'El reporte masivo se ha descargado correctamente.' });
  }, [activeView, filteredData, clients, allInformes, db, toast]);

  // 2. Dynamic Header
  useEffect(() => {
    const headerAction = (
      <div className="flex flex-col sm:flex-row items-center justify-end gap-2 sm:gap-3 md:gap-4 w-full sm:w-auto">
        {/* Selector de Vistas */}
        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner shrink-0 border border-slate-200 order-1 sm:order-1">
          <button
            onClick={() => { setActiveView('ots'); setSelectedOT(null); }}
            className={`px-3 sm:px-4 py-2 rounded-lg font-black text-[9px] sm:text-[10px] uppercase transition-all whitespace-nowrap ${activeView === 'ots' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Órdenes
          </button>
          <button
            onClick={() => { setActiveView('reports'); setSelectedOT(null); }}
            className={`px-3 sm:px-4 py-2 rounded-lg font-black text-[9px] sm:text-[10px] uppercase transition-all whitespace-nowrap ${activeView === 'reports' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Informes
          </button>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-2 order-2 sm:order-2">
          <Button onClick={handleExportExcel} variant="outline" className="h-10 rounded-xl border-slate-200 bg-white text-slate-600 font-black text-[9px] sm:text-[10px] gap-2 px-3 sm:px-4 uppercase hover:bg-[#165a30] hover:text-white hover:border-transparent transition-all active:scale-95 shadow-sm group shrink-0"><Database size={14} className="text-[#165a30] group-hover:text-white transition-colors" /> <span className="hidden sm:inline">Excel</span><span className="sm:hidden">XLS</span></Button>
          <Button onClick={() => { setEditingJob(null); setIsModalOpen(true); }} className="h-10 rounded-xl bg-primary text-white font-black text-[9px] sm:text-[10px] gap-2 px-4 sm:px-6 uppercase shadow-lg shadow-primary/20 hover:bg-white hover:text-primary hover:border-primary border border-transparent transition-all active:scale-95 group shrink-0"><Plus size={14} className="group-hover:text-primary transition-colors" /> <span className="hidden sm:inline">Nueva OT</span><span className="sm:hidden">Nuevo</span></Button>
        </div>
      </div>
    );

    setHeaderProps({
      title: activeView === 'ots' ? 'Gestión de Operaciones (OT)' : 'Control de Calidad e Informes',
      action: headerAction
    });
  }, [setHeaderProps, activeView, handleExportExcel]);


  const handleFormSubmit = async (data: any) => {
    setFormLoading(true);
    try {
      const client = clients.find(c => c.id === data.clienteId);
      const inspectorNombres = data.inspectorIds.map((id: string) => inspectors.find(i => i.id === id)?.nombre || 'Inspector');

      const payload = {
        ...data,
        clienteNombre: client?.nombre || '',
        contacto: client?.contacto || '—',
        telefono: client?.telefono || '—',
        email: client?.email || '—',
        direccion: client?.direccion || '—',
        ciudad: client?.ciudad || '—',
        codigo_postal: client?.cp || client?.codigo_postal || '—',
        inspectorNombres,
        updatedAt: serverTimestamp()
      };

      if (editingJob) {
        await updateDoc(doc(db, 'ordenes_trabajo', editingJob.id), payload);
        toast({ title: "OT Actualizada", description: "Cambios guardados correctamente." });
      } else {
        const nextId = await getNextOTId(db);
        await setDoc(doc(db, 'ordenes_trabajo', nextId), {
          ...payload,
          id: nextId,
          numero_informe: nextId,
          fecha_creacion: serverTimestamp(),
          formType: 'job'
        });
        toast({ title: "Nueva OT Creada", description: `Orden ${nextId} registrada.` });
      }
      setIsModalOpen(false);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la orden." });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteJob = async (job: any) => {
    // 1. Validaciones de estado
    const isOT = job.sourceCollection === 'ordenes_trabajo';
    if (isOT && job.estado === 'Completada') {
      return toast({ variant: "destructive", title: "Acción Bloqueada", description: "No se puede eliminar una OT que ya está completada." });
    }

    if (!isOT && job.estado === 'Aprobado') {
      return toast({ variant: "destructive", title: "Acción Bloqueada", description: "No se puede eliminar un informe que ya ha sido aprobado." });
    }

    // 2. Si es un informe, verificar si la OT padre está completada
    if (!isOT) {
      const parentOT = jobs.find(ot => ot.id === (job.originalJobId || job.orderId));
      if (parentOT && parentOT.estado === 'Completada') {
        return toast({ variant: "destructive", title: "Acción Bloqueada", description: "No se puede eliminar informes de una OT que ya ha sido cerrada/completada." });
      }
    }

    const confirmMessage = isOT
      ? "¿Confirmas la eliminación definitiva? Esta acción no se puede deshacer."
      : "¿Confirmas marcar este informe como eliminado? El documento se conservará en Firestore.";
    if (!window.confirm(confirmMessage)) return;
    try {
      // Los informes no se borran físicamente: se marcan como eliminados para conservar trazabilidad.
      if (!isOT) {
        await updateDoc(doc(db, 'informes', job.id), {
          eliminado: true,
          eliminadoAt: serverTimestamp(),
          eliminadoPor: 'Admin',
          estadoAnterior: job.estado || null,
          motivoEliminacion: 'eliminado_desde_admin',
        });
      } else {
        await deleteDoc(doc(db, job.sourceCollection || 'ordenes_trabajo', job.id));
      }
      if (isOT) await decrementOTCounterIfLast(db, job.id);
      if (selectedOT?.id === job.id) setSelectedOT(null);
      toast({ title: "Eliminado", description: isOT ? "El registro ha sido borrado correctamente." : "El informe quedó marcado como eliminado." });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el registro." });
    }
  };

  const handleApproveJob = async (id: string, status: string, customCollection?: string) => {
    const collectionName = customCollection || (activeView === 'reports' ? 'informes' : 'ordenes_trabajo');
    const isOT = collectionName === 'ordenes_trabajo';
    const targetStatus = isOT ? 'Completada' : 'Aprobado';

    if (status === targetStatus) return;

    // Si es un informe, validar que la OT no esté completada antes de aprobar
    if (!isOT) {
      const report = allInformes.find(r => r.id === id);
      const parentOT = jobs.find(ot => ot.id === (report?.originalJobId || report?.orderId));
      if (parentOT && parentOT.estado === 'Completada') {
        return toast({ variant: "destructive", title: "Acción Bloqueada", description: "No puedes modificar estados de informes en una OT ya cerrada." });
      }
    }

    if (!window.confirm(`¿Marcar como ${targetStatus} definitivamente?`)) return;
    try {
      const payload: any = { estado: targetStatus, fecha_aprobacion: serverTimestamp() };

      // Si es un informe que se está aprobando por primera vez y no tiene ID final
      if (!isOT && targetStatus === 'Aprobado') {
        const report = allInformes.find(r => r.id === id);
        if (report && !report.numero_final) {
          const finalId = await getNextGlobalReportId(db, report.formType);
          payload.numero_final = finalId;
        }
      }

      await updateDoc(doc(db, collectionName, id), payload);
      toast({ title: isOT ? "OT Finalizada" : "Informe Aprobado", description: `El registro ha sido marcado como ${targetStatus}.` });
    } catch (e) {
      console.error("Error al aprobar:", e);
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el estado." });
    }
  };

  const handleToggleFacturada = async (job: any) => {
    if (!db) return;
    const isFacturada = !job.facturada;
    try {
      await updateDoc(doc(db, job.sourceCollection || 'ordenes_trabajo', job.id), {
        facturada: isFacturada,
        fecha_facturacion: isFacturada ? serverTimestamp() : null
      });
      toast({
        title: isFacturada ? "OT Facturada" : "Facturación Desmarcada",
        description: `La orden ${job.numero_final || job.numero_informe || job.id} ha sido ${isFacturada ? 'marcada como facturada' : 'desmarcada'}.`
      });
    } catch (error) {
      console.error("Error al actualizar estado de facturación:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el estado de facturación." });
    }
  };

  const handleReprintSavedPdf = async (job: any) => {
    const finalId = getReportDisplayId(job) || job.numero_informe || job.id;
    const individualId = job.numero_final ? (getCreationReportId(job) || null) : null;
    const inspectorName = job.tecnicoNombre || job.inspectorNombres?.join(', ') || 'inspector técnico';
    const reportForPdf = {
      ...await normalizeReportForPdf(job),
      individualId // Para referencia en pie de página si existe numero_final
    };
    let docPdf: any = null;

    try {
      switch (job.formType) {
        case 'hoja-trabajo': docPdf = await generateHojaTrabajoPDF(reportForPdf, inspectorName, finalId); break;
        case 'informe-revision': docPdf = await generateInformeRevisionPDF(reportForPdf, inspectorName, finalId); break;
        case 'informe-tecnico': docPdf = await generateInformeTecnicoPDF(reportForPdf, inspectorName, finalId); break;
        case 'informe-simplificado': docPdf = await generateInformeSimplificadoPDF(reportForPdf, inspectorName, finalId); break;
        case 'revision-basica': docPdf = await generateRevisionBasicaPDF(reportForPdf, inspectorName, finalId); break;
        default: alert('No se soporta reimpresión para este tipo.'); return;
      }
      if (docPdf) docPdf.save(getPdfFileName(finalId));
    } catch {
      toast({ variant: "destructive", title: "Error PDF", description: "No se pudo generar el archivo." });
    }
  };

  const handleLinkReportToOT = async (report: any) => {
    const rawOT = window.prompt('Número de OT para vincular este informe:', '')?.trim();
    if (!rawOT) return;

    const targetOT = jobs.find((ot) => String(ot.id).toUpperCase() === rawOT.toUpperCase() || String(ot.numero_informe || '').toUpperCase() === rawOT.toUpperCase());
    if (!targetOT) {
      toast({ variant: "destructive", title: "OT no encontrada", description: "Verifica el número de OT antes de vincular." });
      return;
    }

    if (!window.confirm(`¿Vincular ${report.numero_informe || report.id} a ${targetOT.id}?`)) return;

    try {
      await updateDoc(doc(db, 'informes', report.id), {
        orderId: targetOT.id,
        originalJobId: targetOT.id,
        numero_ot: targetOT.id,
        procedencia: 'OT',
        vinculadoAt: serverTimestamp(),
        vinculadoPor: 'Admin',
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Informe vinculado", description: `${report.numero_informe || report.id} quedó asociado a ${targetOT.id}.` });
    } catch (error) {
      console.error('Error vinculando informe a OT:', error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo vincular el informe a la OT." });
    }
  };

  // UI Helpers
  const getJobTitle = (job: any) => {
    if (job.formType === 'job') return job.descripcion;
    return FORM_TYPES.find(f => f.id === job.formType)?.label || 'INFORME';
  };

  const handleDownloadSelectedPdfs = async (reportsToDownload: any[], zipNamePrefix = 'informes') => {
    if (reportsToDownload.length === 0) return;
    toast({ title: 'Preparando ZIP...', description: `Generando ${reportsToDownload.length} documentos.` });
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const usedNames = new Map<string, number>();

      for (const report of reportsToDownload) {
        const finalId = report.numero_final || report.numero_informe || report.id;
        const individualId = report.numero_final ? report.numero_informe : null;
        const inspectorName = report.tecnicoNombre || report.inspectorNombres?.join(', ') || 'inspector técnico';
        const reportForPdf = {
          ...await normalizeReportForPdf(report),
          individualId
        };
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
      const zipName = `${zipNamePrefix}_${stamp}.zip`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = zipName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Descarga exitosa", description: `Archivo: ${zipName}` });
    } catch (e: any) {
      console.error("Error generating ZIP:", e);
      toast({ variant: "destructive", title: "Error ZIP", description: e?.message || "No se pudo generar el ZIP." });
    }
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      {/* FILTROS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm items-end">
        <div className="lg:col-span-2 space-y-1">
          <Label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Buscador Inteligente</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <Input placeholder="Nº OT, Cliente, Proyecto..." value={filterQuery} onChange={e => setFilterQuery(e.target.value)} className="pl-9 h-10 rounded-xl border-slate-200 bg-white text-slate-900 text-xs font-bold" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Inspector</Label>
          <Select value={filterInspectorId} onValueChange={setFilterInspectorId}>
            <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-slate-900 text-xs font-bold"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white border-slate-200 rounded-xl text-slate-900">
              <SelectItem value="all">TODOS</SelectItem>
              {inspectors.map(i => <SelectItem key={i.id} value={i.id}>{i.nombre.toUpperCase()}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Tipo Reporte</Label>
          <Select value={filterReportType} onValueChange={setFilterReportType}>
            <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-slate-900 text-xs font-bold"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white border-slate-200 rounded-xl text-slate-900">
              <SelectItem value="all">TODOS</SelectItem>
              {FORM_TYPES.map(ft => <SelectItem key={ft.id} value={ft.id}>{ft.label.toUpperCase()}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Desde</Label>
          <Input type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} className="h-10 rounded-xl border-slate-200 bg-white text-slate-900 text-xs font-bold" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Hasta</Label>
          <Input type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} className="h-10 rounded-xl border-slate-200 bg-white text-slate-900 text-xs font-bold" />
        </div>
      </div>

      {activeView === 'ots' ? (
        <JobsTable
          jobs={filteredData}
          loading={loading}
          selectedOT={selectedOT}
          setSelectedOT={setSelectedOT}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          handleDeleteJob={handleDeleteJob}
          handleApproveJob={handleApproveJob}
          handleToggleFacturada={handleToggleFacturada}
          getJobTitle={getJobTitle}
        />
      ) : (
        <ReportsTable
          reports={filteredData}
          loading={loading}
          handleEditJob={(job) => { setSelectedReportForEdit(job); setIsReportEditorOpen(true); }}
          handleDeleteJob={handleDeleteJob}
          handleApproveJob={handleApproveJob}
          handleReprintSavedPdf={handleReprintSavedPdf}
          handleLinkReportToOT={handleLinkReportToOT}
          getJobTitle={getJobTitle}
          reportsFilterMode={reportsFilterMode}
          setReportsFilterMode={setReportsFilterMode}
          onDownloadSelectedPdfs={handleDownloadSelectedPdfs}
          inspectors={inspectors}
        />
      )}

      {/* MODALES */}
      <JobFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingJob={editingJob}
        clients={clients}
        inspectors={inspectors}
        onSubmit={handleFormSubmit}
        formLoading={formLoading}
      />

      {selectedOT && (
        <JobDetailView
          selectedOT={selectedOT}
          setSelectedOT={setSelectedOT}
          handleEditJob={(job) => { setEditingJob(job); setIsModalOpen(true); }}
          handleEditReport={(report) => { setSelectedReportForEdit(report); setIsReportEditorOpen(true); }}
          handleDeleteJob={handleDeleteJob}
          handleApproveJob={handleApproveJob}
          handleReprintSavedPdf={handleReprintSavedPdf}
          relatedReports={relatedReports}
          getJobTitle={getJobTitle}
          onDownloadSelectedPdfs={handleDownloadSelectedPdfs}
        />
      )}

      <ReportEditorDialog
        isOpen={isReportEditorOpen}
        onOpenChange={setIsReportEditorOpen}
        selectedReport={selectedReportForEdit}
        aiSuggestions={aiSuggestions}
        isAiLoading={isAiLoading}
        onAnalyzeAi={async () => {
          if (!selectedReportForEdit) return;
          setIsAiLoading(true);
          try {
            const res = await suggestCorrections({ reportData: selectedReportForEdit });
            setAiSuggestions(res);
            toast({ title: "Sugerencias IA", description: "Análisis completado." });
          } catch {
            toast({ variant: "destructive", title: "Error IA", description: "No se pudo conectar." });
          } finally { setIsAiLoading(false); }
        }}
        onSuccess={() => { setIsReportEditorOpen(false); setSelectedReportForEdit(null); setAiSuggestions(null); }}
      />
    </div>
  );
}
