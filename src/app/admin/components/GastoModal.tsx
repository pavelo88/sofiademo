'use client';

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { ACTIVE_OT_STATUSES } from '@/lib/constants';
import { getImageExtension } from '@/lib/offline-utils';
import { Client, GastoItem, User } from '@/types/models';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from 'firebase/storage';
import { Camera, ExternalLink, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface GastoModalProps {
  isOpen: boolean;
  onClose: () => void;
  record?: GastoItem | null;
  onSaved: () => void;
  db: any;
  clients: Client[];
  inspectors: User[];
}

export default function GastoModal({ isOpen, onClose, record, onSaved, db, clients, inspectors }: GastoModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<any>(() => {
    if (record) {
      let fechaStr = '';
      try {
        const d = record.fecha?.toDate ? record.fecha.toDate() : (record.fecha ? new Date(record.fecha) : new Date());
        fechaStr = isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
      } catch { fechaStr = new Date().toISOString().split('T')[0]; }
      return { ...record, fecha: fechaStr };
    }
    return { inspectorId: '', inspectorNombre: '', fecha: new Date().toISOString().split('T')[0], rubro: 'Otros', monto: '', descripcion: '', forma_pago: 'Empresa', clienteId: '', clienteNombre: '' };
  });

  const [activeOTs, setActiveOTs] = useState<any[]>([]);

  const handleComprobanteSelected = (file?: File) => {
    if (!file) return;
    setComprobanteFile(file);
  };

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

  const handleSave = async () => {
    if (!formData.monto || isNaN(parseFloat(formData.monto))) {
      toast({ title: "Monto inválido", variant: "destructive" });
      return;
    }
    if (!formData.inspectorId) {
      toast({ title: "Selecciona un inspector", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const targetDocRef = record?.id ? doc(db, 'gastos_detalle', record.id) : doc(collection(db, 'gastos_detalle'));
      let comprobanteUrl = formData.comprobanteUrl || null;

      if (comprobanteFile) {
        // Admin puede añadir o reemplazar el comprobante sin alterar el resto del gasto.
        const mimeType = comprobanteFile.type || 'image/jpeg';
        const ext = getImageExtension(mimeType);
        const storage = getStorage(db.app);
        const imageRef = storageRef(storage, `comprobantes_gastos/${targetDocRef.id}_img.${ext}`);
        await uploadBytes(imageRef, comprobanteFile, { contentType: mimeType });
        comprobanteUrl = await getDownloadURL(imageRef);
      }

      const payload = { 
        ...formData, 
        monto: parseFloat(parseFloat(String(formData.monto)).toFixed(2)), 
        fecha: new Date(formData.fecha + 'T12:00:00'),
        comprobanteUrl,
        comprobanteMimeType: comprobanteFile?.type || formData.comprobanteMimeType || null,
        comprobanteFileName: comprobanteFile?.name || formData.comprobanteFileName || null,
      };
      const cleanPayload = { ...payload };
      delete cleanPayload.id;
      if (record && record.id) await updateDoc(targetDocRef, cleanPayload as any);
      else await setDoc(targetDocRef, { ...cleanPayload, estado: 'Registrado', createdAt: serverTimestamp() });
      onSaved(); onClose();
    } catch (e) { 
      console.error(e); 
      toast({ variant: 'destructive', title: 'Error al registrar el gasto', description: 'Revisa tu conexión a internet y vuelve a intentarlo.' });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-[2rem] p-8 border-none shadow-2xl">
        <DialogHeader><DialogTitle className="text-xl font-black uppercase text-slate-900">{record ? 'Editar' : 'Crear'} Gasto</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="col-span-2 space-y-1">
            <label className="text-[10px] font-black uppercase ml-1 text-slate-900 tracking-widest">Inspector Responsable</label>
            <Select 
              value={formData.inspectorId} 
              onValueChange={(val) => {
                const insp = inspectors.find((i: any) => i.id === val);
                setFormData({ ...formData, inspectorId: val, inspectorNombre: insp?.nombre || val });
              }}
            >
              <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold text-slate-900">
                <SelectValue placeholder="Seleccionar inspector..." />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {inspectors.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.nombre?.toUpperCase() || i.email?.toUpperCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-[10px] font-black uppercase ml-1 text-slate-900 tracking-widest">Fecha del Gasto</label>
            <input 
              type="date" 
              value={formData.fecha} 
              onChange={e => setFormData({ ...formData, fecha: e.target.value })} 
              className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 font-black outline-none focus:border-emerald-500 focus:bg-white transition-all text-slate-900" 
            />
          </div>
          <div className="col-span-2 space-y-1">
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
          <div className="col-span-2 space-y-1">
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
          <div className="col-span-2 space-y-1">
            <label className="text-[10px] font-black uppercase ml-1 text-slate-900 tracking-widest">Concepto / Descripción</label>
            <Input value={formData.descripcion} onChange={e => setFormData({ ...formData, descripcion: e.target.value })} className="h-12 rounded-xl bg-slate-50 font-black text-slate-900 border-slate-200 shadow-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase ml-1 text-slate-900 tracking-widest">Monto (€)</label>
            <Input type="number" step="0.01" value={formData.monto} onChange={e => setFormData({ ...formData, monto: e.target.value })} className="h-12 rounded-xl bg-slate-50 border-slate-200 font-black text-slate-900 shadow-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase ml-1 text-slate-900 tracking-widest">Categoría / Rubro</label>
            <Select value={formData.rubro} onValueChange={v => setFormData({ ...formData, rubro: v })}>
              <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold text-slate-900"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">{['Combustible', 'Peajes', 'Parking', 'Manutención', 'Obras', 'Otros'].map(r => <SelectItem key={r} value={r}>{r.toUpperCase()}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-2">
            <label className="text-[10px] font-black uppercase ml-1 text-slate-900 tracking-widest">Comprobante</label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => cameraInputRef.current?.click()} className="h-12 rounded-xl border-slate-200 bg-slate-50 text-slate-700 font-black uppercase text-[10px] gap-2">
                <Camera size={16} />
                Cámara
              </Button>
              <input type="file" ref={cameraInputRef} hidden accept="image/*" capture="environment" onChange={e => handleComprobanteSelected(e.target.files?.[0])} />
              <Button type="button" variant="outline" onClick={() => galleryInputRef.current?.click()} className="h-12 rounded-xl border-slate-200 bg-slate-50 text-slate-700 font-black uppercase text-[10px] gap-2">
                <ImageIcon size={16} />
                Galería
              </Button>
              <input type="file" ref={galleryInputRef} hidden accept="image/*" onChange={e => handleComprobanteSelected(e.target.files?.[0])} />
            </div>
            <div className="min-h-10 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-[10px] font-black uppercase text-slate-500 truncate">
                {comprobanteFile?.name || (formData.comprobanteUrl ? 'Comprobante guardado' : 'Sin comprobante adjunto')}
              </span>
              {formData.comprobanteUrl && (
                <a href={formData.comprobanteUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black uppercase text-emerald-700 inline-flex items-center gap-1 shrink-0">
                  <ExternalLink size={13} />
                  Ver
                </a>
              )}
            </div>
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
            {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : (record ? 'Actualizar' : 'Confirmar Gasto')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
