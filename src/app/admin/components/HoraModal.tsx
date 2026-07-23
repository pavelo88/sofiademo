'use client';

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACTIVE_OT_STATUSES } from '@/lib/constants';
import { calculateHoursBreakdown, formatTechnicianName } from '@/lib/hours-utils';
import { Client, HoraItem, User } from '@/types/models';
import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface HoraModalProps {
  isOpen: boolean;
  onClose: () => void;
  record?: HoraItem | null;
  onSaved: () => void;
  db: any;
  clients: Client[];
  inspectors: User[];
}

export default function HoraModal({ isOpen, onClose, record, onSaved, db, clients, inspectors }: HoraModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>(() => {
    if (record) {
      let fechaStr = '';
      try {
        const d = record.fecha?.toDate ? record.fecha.toDate() : (record.fecha ? new Date(record.fecha) : new Date());
        fechaStr = isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
      } catch { fechaStr = new Date().toISOString().split('T')[0]; }
      return { ...record, fecha: fechaStr };
    }
    return { inspectorId: '', inspectorNombre: '', fecha: new Date().toISOString().split('T')[0], clienteId: '', clienteNombre: '', actividad: 'Inspección', horaLlegada: '08:00', horaSalida: '10:00', horasNormales: '0.00', horasExtras: '0.00', horasEspeciales: '0.00' };
  });

  const [activeOTs, setActiveOTs] = useState<any[]>([]);

  useEffect(() => {
    const fetchOTs = async () => {
      try {
        const otsSnap = await getDocs(query(collection(db, 'ordenes_trabajo'), where('estado', 'in', ACTIVE_OT_STATUSES)));
        setActiveOTs(otsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Error fetching OTs", e);
      }
    };
    if (db) fetchOTs();
  }, [db]);

  // Auto-calcular desglose al cambiar fecha o total
  const handleAutoSplit = (total: number) => {
    const breakdown = calculateHoursBreakdown(total, formData.fecha);
    setFormData({
      ...formData,
      horasNormales: breakdown.normal,
      horasExtras: breakdown.extra,
      horasEspeciales: breakdown.special
    });
  };

  const handleSave = async () => {
    if (!formData.inspectorId || !formData.clienteId) {
        alert("Por favor selecciona inspector y cliente");
        return;
    }
    setLoading(true);
    try {
      const payload = { 
        ...formData, 
        horasNormales: parseFloat(parseFloat(String(formData.horasNormales || 0)).toFixed(2)), 
        horasExtras: parseFloat(parseFloat(String(formData.horasExtras || 0)).toFixed(2)), 
        horasEspeciales: parseFloat(parseFloat(String(formData.horasEspeciales || 0)).toFixed(2)), 
        fecha: new Date(formData.fecha + 'T12:00:00') 
      };
      const cleanPayload = { ...payload };
      delete cleanPayload.id;
      if (record && record.id) await updateDoc(doc(db, 'bitacora_visitas', record.id), cleanPayload as any);
      else await addDoc(collection(db, 'bitacora_visitas'), { ...cleanPayload, estado: 'Registrado', createdAt: serverTimestamp() });
      onSaved(); onClose();
    } catch (e) { 
      console.error(e); 
      toast({ variant: 'destructive', title: 'Error al procesar la hora', description: 'Por favor, revisa tu conexión e inténtalo de nuevo.' });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-white rounded-[2rem] p-8 border-none shadow-2xl">
        <DialogHeader><DialogTitle className="text-xl font-black uppercase text-slate-900">{record ? 'Editar' : 'Registrar'} Horas</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="col-span-3 space-y-1">
            <label className="text-[10px] font-black uppercase ml-1 text-slate-900 tracking-widest">Inspector Asignado</label>
            <Select 
              value={formData.inspectorId} 
              onValueChange={(val) => {
                const insp = inspectors.find((i: any) => i.id === val);
                setFormData({ ...formData, inspectorId: val, inspectorNombre: formatTechnicianName(insp?.nombre || val) });
              }}
            >
              <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold text-slate-900">
                <SelectValue placeholder="Seleccionar inspector..." />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {inspectors.map((i: any) => <SelectItem key={i.id} value={i.id}>{formatTechnicianName(i.nombre || i.email).toUpperCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-[10px] font-black uppercase ml-1 text-slate-900 tracking-widest">Fecha de Registro</label>
            <input 
              type="date" 
              value={formData.fecha} 
              onChange={e => setFormData({ ...formData, fecha: e.target.value })} 
              className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 font-black outline-none focus:border-emerald-500 focus:bg-white transition-all text-slate-900" 
            />
          </div>
          <div className="col-span-1 space-y-1">
            <label className="text-[10px] font-black uppercase ml-1 text-emerald-600 tracking-widest">Total Horas</label>
            <Input 
              type="number" 
              placeholder="Ej: 12"
              className="h-12 rounded-xl bg-emerald-50 border-emerald-200 font-black text-emerald-700"
              onChange={(e) => handleAutoSplit(Number(e.target.value))}
            />
          </div>
          <div className="col-span-3 space-y-1">
            <label className="text-[10px] font-black uppercase ml-1 text-slate-900 tracking-widest">Vincular a OT (Opcional)</label>
            <Select 
              value={formData.orderId || 'none'} 
              onValueChange={(val) => {
                if (val === 'none') {
                  setFormData({ ...formData, orderId: null });
                } else {
                  const ot = activeOTs.find(o => o.id === val);
                  if (ot) {
                    setFormData({ ...formData, orderId: ot.id, clienteId: ot.clienteId || '', clienteNombre: ot.clienteNombre || ot.cliente || '' });
                  }
                }
              }}
            >
              <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold text-slate-900">
                <SelectValue placeholder="Sin Vínculo" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="none">SIN VÍNCULO</SelectItem>
                {activeOTs.map((ot: any) => (
                  <SelectItem key={ot.id} value={ot.id}>
                    {ot.id} - {(ot.clienteNombre || ot.cliente || '').toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-3 space-y-1">
            <label className="text-[10px] font-black uppercase ml-1 text-slate-900 tracking-widest">Cliente / Proyecto</label>
            <Select 
              value={formData.clienteId} 
              onValueChange={(val) => {
                const client = clients.find((c: any) => c.id === val);
                setFormData({ ...formData, clienteId: val, clienteNombre: client?.nombre || '' });
              }}
            >
              <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold text-slate-900">
                <SelectValue placeholder="Seleccionar cliente..." />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nombre.toUpperCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-3 space-y-1">
            <label className="text-[10px] font-black uppercase ml-1 text-slate-900 tracking-widest">Actividad</label>
            <Input value={formData.actividad} onChange={e => setFormData({ ...formData, actividad: e.target.value })} className="h-12 rounded-xl bg-slate-50 font-black text-slate-900 border-slate-200" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase ml-1 text-slate-900 tracking-widest">Normales</label>
            <Input type="number" step="0.01" value={formData.horasNormales} onChange={e => setFormData({ ...formData, horasNormales: Number(e.target.value) || 0 })} className="h-12 rounded-xl bg-slate-50 border-slate-200 font-black text-slate-900" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase ml-1 text-slate-900 tracking-widest">Extras</label>
            <Input type="number" step="0.01" value={formData.horasExtras} onChange={e => setFormData({ ...formData, horasExtras: Number(e.target.value) || 0 })} className="h-12 rounded-xl bg-slate-50 border-slate-200 font-black text-slate-900" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase ml-1 text-slate-900 tracking-widest">Especiales</label>
            <Input type="number" step="0.01" value={formData.horasEspeciales} onChange={e => setFormData({ ...formData, horasEspeciales: Number(e.target.value) || 0 })} className="h-12 rounded-xl bg-slate-50 border-slate-200 font-black text-slate-900" />
          </div>
        </div>
        <DialogFooter className="mt-8 flex gap-3">
          <Button 
            variant="outline" 
            onClick={onClose} 
            className="flex-1 h-12 rounded-xl border-2 border-[#165a30] bg-white text-[#165a30] font-black uppercase text-[10px] tracking-widest hover:bg-[#165a30] hover:text-white transition-all duration-300"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading} 
            className="flex-1 h-12 rounded-xl border-2 border-[#165a30] bg-[#165a30] text-white font-black uppercase text-[10px] tracking-widest hover:bg-white hover:text-[#165a30] transition-all duration-300 shadow-md"
          >
            {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : (record ? 'Actualizar' : 'Guardar Registro')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
