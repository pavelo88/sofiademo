'use client';

/* eslint-disable react-hooks/set-state-in-effect -- QA: warning reviewed; keeping current flow to avoid behavioral changes. */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { STANDARD_OT_STATUSES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Check, Loader2, Search, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

// ────────── AUTOCOMPLETE COMBOBOX INTERNO ──────────
function Combobox({ label, placeholder, items, value, onSelect, disabled }: {
  label: string;
  placeholder: string;
  items: { id: string; label: string }[];
  value: string;
  onSelect: (id: string) => void;
  disabled?: boolean;

}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const found = items.find(i => i.id === value);
    setDisplay(found?.label || '');
  }, [value, items]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query === '' ? items : items.filter(i => i.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className={cn("space-y-2 relative", disabled && "opacity-50")} ref={ref}>
      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</Label>
      <div
        onClick={() => !disabled && setOpen(!open)}
        className={cn(
          "h-14 w-full rounded-2xl bg-slate-50 border border-transparent transition-all px-4 flex items-center justify-between",
          disabled ? "cursor-not-allowed" : "hover:border-slate-200 cursor-pointer"
        )}
      >
        <span className={cn("text-sm font-bold", !display ? "text-slate-400" : "text-slate-900")}>
          {display || placeholder}
        </span>
        <Search size={16} className="text-slate-300" />
      </div>

      {open && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[60] overflow-hidden animate-in slide-in-from-top-2">
          <div className="p-3 border-b border-slate-50">
            <input
              autoFocus
              className="w-full bg-slate-50 rounded-xl px-3 py-2 text-xs font-bold outline-none border border-transparent focus:border-primary/20"
              placeholder="Escribe para filtrar..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.map(item => (
              <div
                key={item.id}
                onClick={() => { onSelect(item.id); setOpen(false); setQuery(''); }}
                className={cn(
                  "p-3 rounded-xl cursor-pointer text-xs font-bold uppercase transition-all flex items-center justify-between",
                  value === item.id ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {item.label}
                {value === item.id && <Check size={14} />}
              </div>
            ))}
            {filtered.length === 0 && <p className="p-4 text-center text-[10px] font-black text-slate-300 uppercase">Sin resultados</p>}
          </div>
        </div>
      )}
    </div>
  );
}

interface JobFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingJob: any;
  clients: { id: string; nombre: string }[];
  inspectors: { id: string; nombre: string }[];
  onSubmit: (data: any) => Promise<void>;
  formLoading: boolean;
  isReadOnly?: boolean;
}

export default function JobFormModal({
  isOpen,
  onClose,
  editingJob,
  clients,
  inspectors,
  onSubmit,
  formLoading,
  isReadOnly: isReadOnlyProp
}: JobFormModalProps) {
  const isReadOnly = isReadOnlyProp || editingJob?.estado === 'Completada';
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedInspectorIds, setSelectedInspectorIds] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState('Registrada');
  const [selectedPriority, setSelectedPriority] = useState('Media');
  const [selectedFormLabel, setSelectedFormLabel] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');

  useEffect(() => {
    if (editingJob) {
      setSelectedClientId(editingJob.clienteId || '');
      setSelectedInspectorIds(editingJob.inspectorIds || []);
      setSelectedStatus(editingJob.estado || 'Registrada');
      setSelectedPriority(editingJob.prioridad || 'Media');
      setSelectedFormLabel(editingJob.descripcion || '');
      setSelectedLocation(editingJob.instalacion || '');
    } else {
      setSelectedClientId('');
      setSelectedInspectorIds([]);
      setSelectedStatus('Registrada');
      setSelectedPriority('Media');
      setSelectedFormLabel('');
      setSelectedLocation('');
    }
  }, [editingJob, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find(c => c.id === selectedClientId);
    onSubmit({
      clienteId: selectedClientId,
      clienteNombre: client?.nombre || '',
      inspectorIds: selectedInspectorIds,
      estado: selectedStatus,
      prioridad: selectedPriority,
      descripcion: selectedFormLabel,
      instalacion: selectedLocation
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 md:p-8 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
            {isReadOnly ? 'Detalles de Orden (Lectura)' : (editingJob ? 'Editar Orden' : 'Nueva Orden de Trabajo')}
          </h2>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-5 custom-scroll">
          <div className="space-y-2">
            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Título / Descripción de la Orden</Label>
            <textarea
              placeholder="Ej: Mantenimiento Preventivo Grupo Electrógeno..."
              value={selectedFormLabel}
              onChange={e => setSelectedFormLabel(e.target.value)}
              disabled={isReadOnly}
              className="w-full min-h-[56px] h-14 focus:h-40 rounded-2xl bg-slate-50 border-2 border-slate-50 focus:border-primary/20 font-bold text-slate-900 p-4 transition-all duration-300 outline-none resize-none custom-scroll disabled:opacity-50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ubicación / Instalación (Opcional)</Label>
            <Input
              placeholder="Ej: Planta Principal, Madrid..."
              value={selectedLocation}
              onChange={e => setSelectedLocation(e.target.value)}
              disabled={isReadOnly}
              className="h-14 rounded-2xl bg-slate-50 border-transparent font-bold text-slate-900 disabled:opacity-50"
            />
          </div>

          <Combobox
            label="Vincular a Cliente"
            placeholder="Buscar cliente..."
            items={clients.map(c => ({ id: c.id, label: c.nombre }))}
            value={selectedClientId}
            onSelect={id => setSelectedClientId(id)}
            disabled={isReadOnly}
          />

          <div className="space-y-2">
            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asignar Inspectores</Label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 bg-slate-50 rounded-2xl border border-slate-100">
              {inspectors.map(i => (
                <label key={i.id} className={cn(
                  "flex items-center gap-2 p-2 rounded-xl cursor-pointer transition-all",
                  isReadOnly ? "opacity-50 cursor-default" : (selectedInspectorIds.includes(i.id) ? 'bg-primary/10 border-primary/20' : 'hover:bg-white')
                )}>
                  <input
                    type="checkbox"
                    disabled={isReadOnly}
                    checked={selectedInspectorIds.includes(i.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedInspectorIds(prev => [...prev, i.id]);
                      else setSelectedInspectorIds(prev => prev.filter(id => id !== i.id));
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span className="text-xs font-bold text-slate-700 truncate">{i.nombre}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado de la Orden</Label>
            <div className="flex gap-2">
              {STANDARD_OT_STATUSES.map(s => (
                <button
                  key={s}
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => setSelectedStatus(s)}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                    isReadOnly ? "opacity-50 cursor-default" : "",
                    selectedStatus === s ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prioridad</Label>
            <div className="flex gap-2">
              {['Baja', 'Media', 'Alta'].map(p => (
                <button
                  key={p}
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => setSelectedPriority(p)}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                    isReadOnly ? "opacity-50 cursor-default" : "",
                    selectedPriority === p
                      ? (p === 'Alta' ? 'bg-red-500 border-red-500 text-white' : p === 'Media' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-[#165a30] border-[#165a30] text-white')
                      : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-6 py-3 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">
              {isReadOnly ? 'Cerrar' : 'Cancelar'}
            </button>
            {!isReadOnly && (
              <Button
                type="submit"
                disabled={formLoading || !selectedClientId || selectedInspectorIds.length === 0}
                className="rounded-xl font-black uppercase text-xs tracking-widest bg-primary px-8 py-3 text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {formLoading ? <><Loader2 size={14} className="animate-spin mr-2" />Procesando...</> : 'Confirmar'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
