'use client';

/* eslint-disable @next/next/no-img-element, react-hooks/set-state-in-effect -- QA: warning reviewed; keeping current flow to avoid behavioral changes. */

import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent,
  DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Camera,
  Droplets,
  Edit2,
  Eye,
  Filter,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
  Zap
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface LogEditModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  logData: any;
  onSave: (updatedData: any, updatedFilters: any[]) => Promise<void>;
  isSaving: boolean;
}

export default function LogEditModal({ 
  isOpen, 
  onOpenChange, 
  logData, 
  onSave, 
  isSaving 
}: LogEditModalProps) {
  const [editingData, setEditingData] = useState<any>(null);
  const [editingFilters, setEditingFilters] = useState<any[]>([]);

  const FILTRO_TIPOS = [
    'Filtro de aceite',
    'Filtro de combustible',
    'Filtro de agua',
    'Filtro de aire',
    'Prefiltro de aceite',
    'Prefiltro de combustible',
    'Filtro de aceite bypass'
  ];

  useEffect(() => {
    if (logData) {
      setEditingData({ ...logData });
      setEditingFilters(logData.filtros || []);
    }
  }, [logData, isOpen]);

  const updateField = (field: string, value: any) => {
    setEditingData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleFiltroChange = (index: number, field: string, value: any) => {
    const newFilters = [...editingFilters];
    newFilters[index] = { ...newFilters[index], [field]: value };
    setEditingFilters(newFilters);
  };

  const handleAddFiltro = () => {
    setEditingFilters([...editingFilters, { tipo: '', cantidad: '', referencia: '' }]);
  };

  const handleRemoveFiltro = (index: number) => {
    if (editingFilters.length === 1) {
        setEditingFilters([{ tipo: '', cantidad: '', referencia: '' }]);
    } else {
        setEditingFilters(editingFilters.filter((_, i) => i !== index));
    }
  };

  if (!editingData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-slate-50 [&>button]:hidden">
        <DialogHeader className="p-10 bg-white border-b border-slate-100 flex flex-row justify-between items-center">
          <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-lg shadow-primary/5">
                  <Edit2 size={28} />
              </div>
              <div>
                  <DialogTitle className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Editar Registro de Bitácora</DialogTitle>
                  <DialogDescription className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
                    Corregir datos del inspector o mediciones operativas
                  </DialogDescription>
              </div>
          </div>
          <Button 
              variant="ghost" 
              onClick={() => onOpenChange(false)}
              className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-600"
          >
              <X size={24} />
          </Button>
        </DialogHeader>

        <div className="p-10 max-h-[75vh] overflow-y-auto space-y-10 no-scrollbar pb-32">
           
           {/* SECCIÓN 1: REVISIONES TÉCNICAS */}
           <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <Zap size={24} />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Revisiones Técnicas</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Batería <span className="text-primary font-black">*</span></label>
                  <Input 
                    placeholder="Estado / Voltaje..."
                    value={editingData.bateria || ''} 
                    onChange={(e) => updateField('bateria', e.target.value)}
                    className="bg-slate-50 border-none font-bold h-14 rounded-2xl text-slate-950 focus:ring-2 ring-primary/20"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Resistencia de Caldeo <span className="text-primary font-black">*</span></label>
                  <Input 
                    placeholder="Observaciones..."
                    value={editingData.resistenciaCaldeo || ''} 
                    onChange={(e) => updateField('resistenciaCaldeo', e.target.value)}
                    className="bg-slate-50 border-none font-bold h-14 rounded-2xl text-slate-950 focus:ring-2 ring-primary/20"
                  />
                </div>
              </div>
           </section>

           {/* SECCIÓN 2: CONTROL DE FLUIDOS */}
           <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <Droplets size={24} />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Control de Fluidos</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Aceite (L) <span className="text-primary font-black">*</span></label>
                  <div className="relative">
                    <Input 
                      type="number"
                      placeholder="0"
                      value={editingData.litrosAceite || ''} 
                      onChange={(e) => updateField('litrosAceite', e.target.value)}
                      className="bg-slate-50 border-none font-bold h-14 rounded-2xl text-slate-950 pr-12"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-300">L</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Anticongelante (L) <span className="text-primary font-black">*</span></label>
                  <div className="relative">
                    <Input 
                      type="number"
                      placeholder="0"
                      value={editingData.litrosAnticongelante || ''} 
                      onChange={(e) => updateField('litrosAnticongelante', e.target.value)}
                      className="bg-slate-50 border-none font-bold h-14 rounded-2xl text-slate-950 pr-12"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-300">L</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Combustible (L)</label>
                  <div className="relative">
                    <Input 
                      type="number"
                      placeholder="Opcional"
                      value={editingData.litrosCombustible || ''} 
                      onChange={(e) => updateField('litrosCombustible', e.target.value)}
                      className="bg-slate-50 border-none font-bold h-14 rounded-2xl text-slate-950 pr-12"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-300">L</span>
                  </div>
                </div>
              </div>
           </section>

           {/* SECCIÓN 3: DETALLE DE FILTROS (DYNAMICO) */}
           <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                    <Filter size={24} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Detalle de Filtros</h3>
                </div>
                <Button 
                  variant="outline" 
                  onClick={handleAddFiltro}
                  className="h-10 rounded-xl border-primary/20 text-primary font-black uppercase text-[10px] tracking-widest hover:bg-primary/5 gap-2 px-4"
                >
                  <Plus size={14} /> Añadir Filtro
                </Button>
              </div>

              <div className="space-y-4">
                 {editingFilters.map((item, index) => (
                  <div key={index} className="flex flex-col md:flex-row gap-4 items-end md:items-center bg-slate-50/50 p-6 rounded-[2rem] border border-slate-50 relative animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex-1 w-full space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">TIPO</label>
                      <Select value={item.tipo} onValueChange={(val) => handleFiltroChange(index, 'tipo', val)}>
                        <SelectTrigger className="bg-white border-slate-100 font-bold h-12 rounded-xl shadow-sm">
                          <SelectValue placeholder="Elegir filtro..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {FILTRO_TIPOS.map(t => (
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
                        className="bg-white border-slate-100 font-bold h-12 rounded-xl text-center shadow-sm" 
                      />
                    </div>
                    <div className="flex-[2] w-full space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">REFERENCIA</label>
                      <Input 
                        placeholder="Ref. o código..."
                        value={item.referencia}
                        onChange={(e) => handleFiltroChange(index, 'referencia', e.target.value)}
                        className="bg-white border-slate-100 font-bold h-12 rounded-xl shadow-sm" 
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
           </section>

           {/* SECCIÓN 4: EVIDENCIA */}
           {editingData.imageUrls && editingData.imageUrls.length > 0 && (
             <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                    <Camera size={24} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Evidencia Fotográfica</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {editingData.imageUrls.map((url: string, i: number) => (
                    <div key={i} className="aspect-square rounded-[2rem] overflow-hidden border border-slate-100 shadow-md group relative">
                      <img src={url} alt="Evidencia" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                         <Eye size={24} className="text-white cursor-pointer" onClick={() => window.open(url, '_blank')} />
                      </div>
                    </div>
                  ))}
                </div>
             </section>
           )}
        </div>

        <DialogFooter className="p-10 bg-white border-t border-slate-100 gap-4 flex-row justify-end items-center">
          <Button 
              variant="ghost" 
              onClick={() => onOpenChange(false)} 
              className="rounded-2xl font-black uppercase text-xs tracking-widest h-16 px-10 text-slate-400"
          >
              Cancelar
          </Button>
          <Button 
              onClick={() => onSave(editingData, editingFilters)} 
              disabled={isSaving} 
              className="bg-[#165a30] hover:bg-[#0f4022] text-white font-black uppercase tracking-[0.2em] text-xs h-16 px-12 rounded-[2rem] shadow-xl shadow-[#165a30]/20 gap-3 transition-all active:scale-[0.98]"
          >
            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} 
            Guardar Cambios del Registro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
