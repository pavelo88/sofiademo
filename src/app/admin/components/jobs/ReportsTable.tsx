'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { getCreationReportId, getReportDisplayId } from '@/app/inspection/lib/report-record';
import { cn, formatSafeDate } from '@/lib/utils';
import type { Dispatch, SetStateAction } from 'react';
import { CheckCircle2, Download, Link2, Pencil, Printer, Trash2 } from 'lucide-react';

interface Job {
  id: string;
  numero_informe?: string;
  numero_final?: string;
  estado: string;
  descripcion: string;
  clienteNombre?: string;
  cliente?: string;
  instalacion?: string;
  fecha_creacion: any;
  formType?: string;
  tecnicoNombre?: string;
  inspectorNombres?: string[];
  orderId?: string;
  numero_ot?: string;
}

interface ReportsTableProps {
  reports: Job[];
  loading: boolean;
  handleEditJob: (job: Job) => void;
  handleDeleteJob: (job: Job) => void;
  handleApproveJob: (id: string, status: string) => void;
  handleReprintSavedPdf: (job: Job) => void;
  handleLinkReportToOT?: (job: Job) => void;
  reportsFilterMode?: 'all' | 'unlinked' | 'linked' | 'deleted';
  setReportsFilterMode?: Dispatch<SetStateAction<'all' | 'unlinked' | 'linked' | 'deleted'>>;
  onDownloadSelectedPdfs?: (reportsToDownload: Job[], zipNamePrefix?: string) => Promise<void>;
  inspectors?: any[];
  getJobTitle: (job: Job) => string;
}

export default function ReportsTable({
  reports,
  loading,
  handleEditJob,
  handleDeleteJob,
  handleApproveJob,
  handleReprintSavedPdf,
  handleLinkReportToOT,
  reportsFilterMode,
  setReportsFilterMode,
  onDownloadSelectedPdfs,
  inspectors = [],
  getJobTitle
}: ReportsTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [localFilter, setLocalFilter] = useState<'Todos' | 'Independientes' | 'En Proceso' | 'Aprobados'>('Todos');

  const getInspectorName = (report: any) => {
    const id = report.inspectorId || report.tecnicoId;
    if (id) {
      const inspector = inspectors.find(ins => ins.id?.toLowerCase() === id.toLowerCase());
      if (inspector?.nombre) return inspector.nombre;
    }
    const ids = report.inspectorIds || [];
    if (ids.length > 0) {
      const resolvedNames = ids.map((email: string) => {
        const inspector = inspectors.find(ins => ins.id?.toLowerCase() === email.toLowerCase());
        return inspector?.nombre || email.split('@')[0];
      });
      return resolvedNames.join(', ');
    }
    return report.tecnicoNombre || report.inspectorNombres?.join(', ') || '—';
  };

  const displayedReports = reports.filter(r => {
    if (localFilter === 'Todos') return true;
    if (localFilter === 'Independientes') return !r.orderId && !r.numero_ot;
    if (localFilter === 'En Proceso') return r.estado === 'En Proceso' || r.estado === 'Registrado';
    if (localFilter === 'Aprobados') return r.estado === 'Aprobado';
    return true;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(displayedReports.map(r => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  const handleDownloadBulk = () => {
    const selected = reports.filter(r => selectedIds.includes(r.id));
    if (onDownloadSelectedPdfs) {
      onDownloadSelectedPdfs(selected);
    }
  };

  if (loading) return <p className="text-center font-black uppercase text-slate-200 py-20">Cargando Historial...</p>;

  return (
    <div className="bg-white p-0 rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden transition-all">
      <div className="p-6 border-b border-slate-50 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Historial Maestro de Informes</h3>
          <select
            value={localFilter}
            onChange={(e) => setLocalFilter(e.target.value as any)}
            className="text-[10px] font-black uppercase text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-primary"
          >
            <option value="Todos">Todos</option>
            <option value="Independientes">Independientes (Sin OT)</option>
            <option value="En Proceso">Pendientes / En Proceso</option>
            <option value="Aprobados">Aprobados</option>
          </select>
        </div>
        {selectedIds.length > 0 && onDownloadSelectedPdfs && (
          <button
            onClick={handleDownloadBulk}
            className="bg-primary text-white text-[9px] font-black px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <Printer size={12} />
            Descargar ({selectedIds.length})
          </button>
        )}
      </div>
      <div className="overflow-x-auto custom-scroll">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50/50">
            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <th className="px-4 py-4 w-10">
                <input
                  type="checkbox"
                  checked={displayedReports.length > 0 && selectedIds.length === displayedReports.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
              </th>
              <th className="px-6 py-4">Nº Informe</th>
              <th className="px-6 py-4">Cliente / Instalación</th>
              <th className="px-6 py-4">Inspector</th>
              <th className="px-6 py-4">Tipo de Informe</th>
              <th className="px-6 py-4 text-center">Estado</th>
              <th className="px-6 py-4">Fecha</th>
              <th className="px-6 py-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {displayedReports.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-20 text-center text-xs font-black text-slate-300 uppercase italic tracking-widest">
                  No se encontraron informes para el filtro seleccionado
                </td>
              </tr>
            ) : (
              displayedReports.map(report => (
                <tr key={report.id} className="group hover:bg-slate-50 transition-all">
                  <td className="px-4 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(report.id)}
                      onChange={(e) => handleSelectOne(report.id, e.target.checked)}
                      className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      {(() => {
                        const displayId = getReportDisplayId(report) || report.id;
                        const creationId = getCreationReportId(report);
                        return (
                          <>
                            <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-1 rounded-md inline-block w-fit">
                              {displayId}
                            </span>
                            {report.numero_final && creationId && report.numero_final !== creationId && (
                              <span className="text-[9px] font-bold text-slate-400 mt-1 ml-1 italic">
                                ({creationId})
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs font-black text-slate-800 uppercase leading-none mb-1">{report.clienteNombre || report.cliente || '—'}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase truncate max-w-[200px]">{report.instalacion || '—'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs font-bold text-slate-600 uppercase">{getInspectorName(report)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase inline-block">
                      {getJobTitle(report)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[9px] font-black uppercase",
                      report.estado === 'Aprobado' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                    )}>
                      {report.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-500">
                    {formatSafeDate(report.fecha_creacion, 'dd/MM/yyyy')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1 opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleReprintSavedPdf(report)}
                        className="h-8 w-8 text-slate-400 hover:text-primary"
                        title="Descargar PDF"
                      >
                        <Download size={14} />
                      </Button>
                      {handleLinkReportToOT && !report.orderId && !report.numero_ot && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleLinkReportToOT(report)}
                          className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                          title="Vincular a OT"
                        >
                          <Link2 size={14} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditJob(report)}
                        disabled={report.estado === 'Aprobado'}
                        className={cn(
                          "h-8 w-8 text-slate-400 hover:text-blue-600",
                          report.estado === 'Aprobado' && "opacity-20 cursor-not-allowed"
                        )}
                        title="Editar Informe"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleApproveJob(report.id, report.estado)}
                        disabled={report.estado === 'Aprobado'}
                        className={cn(
                          "h-8 w-8 text-slate-400 hover:text-emerald-600",
                          report.estado === 'Aprobado' && "opacity-20 cursor-not-allowed"
                        )}
                        title="Aprobar Informe"
                      >
                        <CheckCircle2 size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteJob(report)}
                        disabled={report.estado === 'Aprobado'}
                        className={cn(
                          "h-8 w-8 text-slate-400 hover:text-red-500",
                          report.estado === 'Aprobado' && "opacity-20 cursor-not-allowed"
                        )}
                        title="Eliminar Informe"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
