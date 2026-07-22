'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn, formatSafeDate } from '@/lib/utils';
import {
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  Info,
  Mail, MapPin,
  Phone,
  Printer,
  Settings,
  User,
  Wrench
} from 'lucide-react';
import { getReportDisplayId } from '@/app/inspection/lib/report-record';

interface Task {
  id: string;
  clienteNombre?: string;
  cliente?: string;
  instalacion?: string;
  estado: string;
  fecha_creacion?: any;
  descripcion?: string;
  prioridad?: string;
  ciudad?: string;
  pais?: string;
  telefono?: string;
  email?: string;
  inspectorNombres?: string[];
  tecnicoNombres?: string[];
  tecnicoNombre?: string;
  [key: string]: any;
}

interface OTDetailModalProps {
  ot: Task;
  reports: Task[];
  currentEmail?: string;
  onClose: () => void;
  onStartAction: (type: string, ot: Task) => void;
  onEditReport?: (report: Task) => void;
  onDownloadPdf?: (report: Task) => void;
  onDownloadMultiplePdfs?: (reports: Task[]) => Promise<void>;
}

export default function OTDetailModal({ ot, reports, currentEmail, onClose, onStartAction, onEditReport, onDownloadPdf, onDownloadMultiplePdfs }: OTDetailModalProps) {
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedReportIds(reports.map(r => r.id));
    } else {
      setSelectedReportIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedReportIds(prev => [...prev, id]);
    } else {
      setSelectedReportIds(prev => prev.filter(item => item !== id));
    }
  };

  const handleDownloadBulk = () => {
    const selected = reports.filter(r => selectedReportIds.includes(r.id));
    if (onDownloadMultiplePdfs) {
      onDownloadMultiplePdfs(selected);
    }
  };

  const getEstadoColor = (estado: string) => {
    if (estado === 'Completada' || estado === 'Aprobado') return 'bg-[#165a30] text-white';
    if (estado === 'Registrada' || estado === 'Abierta' || estado === 'En Proceso' || estado === 'En Progreso') return 'bg-[#165a30] text-white';
    return 'bg-orange-400 text-white';
  };

  const actionButtons = [
    { id: 'hoja-trabajo', label: 'Hoja de Trabajo', icon: FileText, color: 'bg-[#165a30]' },
    { id: 'informe-tecnico', label: 'Informe Técnico (uso administrativo)', icon: Settings, color: 'bg-[#165a30]' },
    { id: 'informe-revision', label: 'Informe de Revisión', icon: ClipboardCheck, color: 'bg-amber-500' },
    { id: 'informe-simplificado', label: 'Informe Simplificado (grupos pequeños', icon: Wrench, color: 'bg-slate-700' },
  ];

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl bg-slate-50 rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden max-h-[95vh] flex flex-col">
        {/* Header con ID y Estado */}
        <div className="bg-white p-6 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <ClipboardList size={24} />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                {ot.id} - {ot.descripcion}
              </DialogTitle>
              <span className={`px-3 py-1 text-[9px] font-black rounded-full uppercase ${getEstadoColor(ot.estado)}`}>
                {ot.estado}
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto p-6 space-y-6 flex-1 custom-scroll">
          {/* Grid de Información */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Info General */}
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Info size={12} className="text-primary" /> Información General
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <User size={14} className="text-slate-300 mt-0.5" />
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase">Cliente</p>
                    <p className="text-xs font-bold text-slate-800 uppercase">{ot.clienteNombre || ot.cliente || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <Clock size={12} className="mr-2" /> {formatSafeDate(ot.fecha_creacion || ot.fecha, 'dd/MM/yyyy')}
                </div>
                <div className="flex items-start gap-3">
                  <Phone size={14} className="text-slate-300 mt-0.5" />
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase">Teléfono</p>
                    <p className="text-xs font-bold text-slate-800">{ot.telefono || 'No registrado'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail size={14} className="text-slate-300 mt-0.5" />
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase">Email</p>
                    <p className="text-xs font-bold text-slate-800 lowercase">{ot.email || 'No registrado'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Ubicación */}
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <MapPin size={12} className="text-primary" /> Ubicación
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase">Dirección</p>
                  <p className="text-xs font-bold text-slate-800 uppercase">{ot.instalacion || ot.direccion || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase">Ciudad / País</p>
                  <p className="text-xs font-bold text-slate-800 uppercase">{ot.ciudad || '—'}, {ot.pais || 'España'}</p>
                </div>
              </div>
            </div>

            {/* Detalles OT */}
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Settings size={12} className="text-primary" /> Detalles de la OT
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Fecha Creación</p>
                  <p className="text-xs font-bold text-slate-800">{formatSafeDate(ot.fecha_creacion, 'dd/MM/yyyy')}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Prioridad</p>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${ot.prioridad === 'Alta' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                    {ot.prioridad || 'Media'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Inspectores Asignados */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <User size={12} className="text-primary" /> Inspectores Asignados
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(ot.inspectorNombres || ot.tecnicoNombres || [ot.tecnicoNombre]).filter(Boolean).map((nombre: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-[10px] font-black uppercase">
                    {nombre ? nombre.charAt(0) : 'T'}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-800 uppercase">{nombre}</p>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Especialista</p>
                  </div>
                </div>
              ))}
              {(!ot.inspectorNombres && !ot.tecnicoNombres && !ot.tecnicoNombre) && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-8 h-8 bg-slate-200 text-slate-400 rounded-full flex items-center justify-center text-[10px] font-black uppercase">
                    T
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400">Sin Inspectores</p>
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Especialista</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ACCIONES RÁPIDAS (Botones de Informes) - Solo visibles si la OT NO está completada */}
          {ot.estado !== 'Completada' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {actionButtons.map(action => (
                <button
                  key={action.id}
                  onClick={() => onStartAction(action.id, ot)}
                  className="flex flex-col items-center justify-center gap-3 p-6 bg-white rounded-[2rem] border border-slate-100 hover:border-primary hover:shadow-xl transition-all group active:scale-95"
                >
                  <div className={`w-12 h-12 ${action.color} text-white rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110`}>
                    <action.icon size={20} />
                  </div>
                  <p className="text-[10px] font-black text-slate-800 uppercase tracking-tighter text-center">{action.label}</p>
                </button>
              ))}
            </div>
          )}

          {/* Partes de Trabajo Realizados */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 space-y-4 overflow-hidden">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <ClipboardCheck size={12} className="text-primary" /> Partes de Trabajo Realizados
              </h3>
              {selectedReportIds.length > 0 && onDownloadMultiplePdfs && (
                <button
                  onClick={handleDownloadBulk}
                  className="bg-primary text-white text-[9px] font-black px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                >
                  <Printer size={12} />
                  Descargar ({selectedReportIds.length})
                </button>
              )}
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={reports.length > 0 && selectedReportIds.length === reports.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3">Nº Parte</th>
                    <th className="px-4 py-3">Inspector</th>
                    <th className="px-4 py-3 text-center">Fecha</th>
                    <th className="px-4 py-3">Descripción</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report, i) => {
                    const reportOwner = report.inspectorId || report.email;
                    const isOther = reportOwner && currentEmail && reportOwner !== currentEmail;
                    const isEditable = report.estado !== 'Aprobado'; 

                    return (
                      <tr
                        key={i}
                        onClick={() => {
                          if (isEditable && onEditReport) {
                            onEditReport(report);
                          } else if (onDownloadPdf) {
                            onDownloadPdf(report);
                          }
                        }}
                        className={cn(
                          "transition-colors cursor-pointer border-b border-slate-50 last:border-0",
                          isEditable 
                            ? "hover:bg-emerald-50/50" 
                            : "opacity-70 hover:bg-slate-50"
                        )}
                      >
                        <td className="px-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedReportIds.includes(report.id)}
                            onChange={(e) => handleSelectOne(report.id, e.target.checked)}
                            className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-[10px] font-black">
                          <div className="flex items-center gap-2">
                            {isEditable ? (
                              <div className="w-5 h-5 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                                <FileText size={10} />
                              </div>
                            ) : (
                              <Printer size={10} className="text-slate-400" />
                            )}
                            {getReportDisplayId(report) || report.id}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[10px] font-bold text-slate-600">
                          <div className="flex flex-col">
                            <span>{report.inspectorNombre || report.tecnicoNombre || '—'}</span>
                            {isOther && (
                              <span className="text-[7px] text-amber-600 uppercase font-black tracking-tighter flex items-center gap-1">
                                <User size={8} /> Informe de Compañero
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-[10px] font-bold text-slate-500">
                          {formatSafeDate(report.fecha || report.fecha_creacion, 'dd/MM/yyyy')}
                        </td>
                        <td className="px-4 py-3 text-[10px] max-w-[150px] truncate uppercase text-slate-500 font-medium">
                          {report.formType || 'Informe'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[8px] font-black uppercase",
                              report.estado === 'Aprobado' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                            )}>
                              {report.estado}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {reports.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[10px] font-black text-slate-300 uppercase">No se han registrado partes para esta OT</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
