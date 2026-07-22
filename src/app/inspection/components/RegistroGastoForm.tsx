'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Save, Loader2, Euro, Trash2, Plus, FileText, Camera, Calendar as CalendarIcon, Check, Pencil, AlertTriangle, ArrowRight, Image as ImageIcon, X
} from 'lucide-react';
import { useFirestore, useUser } from '@/firebase';
import { collection, serverTimestamp, doc, getDoc, setDoc, updateDoc, getDocs, deleteDoc, query, where, Timestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';
import { format, subDays, isAfter, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { useToast } from '@/hooks/use-toast';
import { OT_STATUS } from '@/lib/constants';
import { fileToBase64 } from '@/lib/offline-utils';
import { resolveInspectorEmail } from '@/lib/inspection-mode';
import { db as dbLocal } from '@/lib/db-local';

// --- TIPOS DE DATOS ---
type GastoItem = {
  id: string; rubro: string; monto: number; descripcion: string; forma_pago: string; hora: string;
  comprobanteUrl?: string; fecha: string | Date; estado: 'Registrado' | 'Aprobado';
  clienteId?: string; clienteNombre?: string; orderId?: string; localId?: number; synced?: boolean;
  fechaStr?: string; comprobanteBase64?: string | null; inspectorId?: string | null; inspectorNombre?: string | null;
};

const initialGastoState = { rubro: 'Combustible', monto: '', descripcion: '', forma_pago: 'Tarjeta Empresa', hora: format(new Date(), 'HH:mm'), comprobanteFile: undefined, clienteId: '', clienteNombre: '', orderId: '' };

const getInspectorInitials = (email: string | null, name?: string | null): string => {
  if (name) {
    const parts = name.trim().replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter(Boolean);
    if (parts.length > 0) {
      return parts.map(p => p.charAt(0).toUpperCase()).join('').substring(0, 4);
    }
  }
  if (email) {
    const prefix = email.split('@')[0];
    return prefix.substring(0, 4).toUpperCase();
  }
  return 'INSP';
};

export default function RegistroGastoForm({ otFilter }: { otFilter?: string | null }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = firestore ? getStorage(firestore.app) : null;
  const isOnline = useOnlineStatus();
  const inspectorEmail = resolveInspectorEmail(user?.email || '');
  const canUseCloud = isOnline && !!firestore && !!storage && !!user?.email;
  const { toast } = useToast();

  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [gastos, setGastos] = useState<GastoItem[]>([]);
  const [currentGasto, setCurrentGasto] = useState<any>(initialGastoState);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (currentGasto.comprobanteFile) {
      const url = URL.createObjectURL(currentGasto.comprobanteFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [currentGasto.comprobanteFile]);
  const [clients, setClients] = useState<any[]>([]);
  const [activeOTs, setActiveOTs] = useState<any[]>([]);

  // 1. CARGAR DATOS (Offline-First)
  useEffect(() => {
    const load = async () => {
      setInitialLoading(true);
      try {
        const dateStr = format(reportDate, 'yyyy-MM-dd');
        
        // CARGAR CLIENTES Y OTs (Offline-First Real)
        const [cachedClients, cachedOts] = await Promise.all([
          dbLocal.clientes_cache.toArray(),
          dbLocal.ordenes_cache.toArray()
        ]);
        
        setClients(cachedClients.sort((a, b) => a.nombre.localeCompare(b.nombre)));
        setActiveOTs(cachedOts.map(c => ({ id: c.id, ...c.data })));

        // Cargar Gastos Locales del día
        const localRecords = await dbLocal.gastos
          .filter(g => g.data.fechaStr === dateStr)
          .toArray();
        const formattedLocal = localRecords.map(r => ({ ...r.data, localId: r.id, synced: r.synced }));

        if (isOnline && firestore && inspectorEmail) {
          // Intentar refrescar desde la nube si hay internet
          try {
            const [gastosSnap, otsSnap] = await Promise.all([
              getDocs(query(
                collection(firestore, "gastos_detalle"), 
                where("inspectorId", "==", inspectorEmail), 
                where("fechaStr", "==", dateStr)
              )),
              getDocs(query(
                collection(firestore, 'ordenes_trabajo'), 
                where('inspectorIds', 'array-contains', inspectorEmail), 
                where('estado', 'in', [OT_STATUS.EN_PROCESO, OT_STATUS.REGISTRADA, 'Abierta', 'En Proceso', 'Registrada'])
              ))
            ]);

            const cloudGastos = gastosSnap.docs.map(d => ({ id: d.id, ...d.data(), synced: true } as GastoItem));
            const cloudOts = otsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Actualizar OTs con datos frescos de la nube
            if (cloudOts.length > 0) setActiveOTs(cloudOts);

            // Unir nube + local (priorizando nube para los ya sincronizados)
            const combined = [...cloudGastos];
            formattedLocal.forEach(l => {
              if (!combined.find(c => c.id === l.id)) combined.push(l);
            });
            setGastos(combined);

            if (otFilter && currentGasto.orderId === '') {
                const targetOT: any = (cloudOts.length > 0 ? cloudOts : cachedOts.map(c => ({ id: c.id, ...c.data }))).find(o => o.id === otFilter);
                if (targetOT) {
                  setCurrentGasto((prev: any) => ({
                    ...prev,
                    clienteId: targetOT.clienteId || '',
                    clienteNombre: targetOT.clienteNombre || targetOT.cliente || '',
                    orderId: targetOT.id
                  }));
                }
            }
          } catch (cloudErr) {
            console.warn("Cloud load failed, using local only", cloudErr);
            setGastos(formattedLocal);
          }
        } else {
          setGastos(formattedLocal);
        }
      } catch (e) { console.error(e); }
      setInitialLoading(false);
    };
    load();
  }, [reportDate, canUseCloud, firestore, inspectorEmail, otFilter]);

  const handleSave = async () => {
    if (!currentGasto.descripcion || !currentGasto.monto) {
      return toast({ variant: 'destructive', title: 'Faltan datos', description: 'Introduce descripción y monto.' });
    }
    
    setLoading(true);
    try {
      const initials = getInspectorInitials(inspectorEmail, user?.displayName);
      const rubroClean = currentGasto.rubro.trim().toUpperCase().replace(/[^A-Z]/g, '');
      const clienteClean = (currentGasto.clienteNombre || 'general').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'GENERAL';
      const dateClean = format(reportDate, 'yyyyMMdd');
      const timeClean = currentGasto.hora.replace(':', '');
      const id = `GASTO-${initials}-${rubroClean}-${clienteClean}-${dateClean}-${timeClean}`;
      
      let base64Image = null;
      if (currentGasto.comprobanteFile) {
        base64Image = await fileToBase64(currentGasto.comprobanteFile);
      }

      const payload: GastoItem = {
        id,
        rubro: currentGasto.rubro,
        monto: parseFloat(currentGasto.monto),
        descripcion: currentGasto.descripcion,
        forma_pago: currentGasto.forma_pago,
        hora: currentGasto.hora,
        fechaStr: format(reportDate, 'yyyy-MM-dd'),
        fecha: reportDate,
        estado: 'Registrado' as const,
        clienteId: currentGasto.clienteId || null,
        clienteNombre: currentGasto.clienteNombre || null,
        orderId: currentGasto.orderId || null,
        inspectorId: inspectorEmail,
        inspectorNombre: user?.displayName || inspectorEmail,
        comprobanteBase64: base64Image,
      };

      // 1. GUARDAR EN LOCAL (SIEMPRE PRIMERO) - Prevenir duplicados locales
      const existing = await dbLocal.gastos.where('firebaseId').equals(id).first();
      let localId;
      if (existing) {
        localId = existing.id!;
        await dbLocal.gastos.update(localId, {
          data: payload,
          synced: false,
          createdAt: new Date()
        });
      } else {
        localId = await dbLocal.gastos.add({
          firebaseId: id,
          synced: false,
          data: payload,
          createdAt: new Date()
        });
      }

      // 2. INTENTAR GUARDAR EN NUBE (CON TIMEOUT)
      let successfullySynced = false;
      let cloudComprobanteUrl = '';
      if (canUseCloud) {
        try {
          const cloudPromise = (async () => {
             if (currentGasto.comprobanteFile) {
               const fRef = ref(storage!, `comprobantes_gastos/${id}_img.png`);
               await uploadBytes(fRef, currentGasto.comprobanteFile);
               cloudComprobanteUrl = await getDownloadURL(fRef);
             }

             const { comprobanteBase64, ...cleanPayload } = payload;
             await setDoc(doc(firestore!, "gastos_detalle", id), {
               ...cleanPayload,
               comprobanteUrl: cloudComprobanteUrl || null,
               createdAt: serverTimestamp(),
               fecha: Timestamp.fromDate(reportDate)
             });

             if (currentGasto.orderId) {
               await updateDoc(doc(firestore!, 'ordenes_trabajo', currentGasto.orderId), { estado: OT_STATUS.EN_PROCESO });
             }

             await dbLocal.gastos.update(localId, { 
               synced: true,
               data: {
                 ...payload,
                 comprobanteUrl: cloudComprobanteUrl || null
               }
             });
             return true;
          })();

          // Timeout de 5 segundos para no colgar la UI
          const result = await Promise.race([
            cloudPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
          ]);

          if (result) {
            successfullySynced = true;
            toast({ title: 'GASTO SINCRONIZADO ✅' });
          }
        } catch (err) {
          console.warn("Fallo sync inmediato, queda pendiente localmente", err);
          toast({ title: 'Guardado Local 💾', description: 'Se subirá al recuperar conexión.' });
        }
      } else {
        toast({ title: 'Guardado Local 💾', description: 'Modo Offline activo.' });
      }

      // Actualizar la lista en memoria previniendo duplicados
      const finalPayload = { 
        ...payload, 
        comprobanteUrl: cloudComprobanteUrl || undefined 
      };
      if (existing) {
        setGastos(gastos.map(g => g.id === id ? { ...finalPayload, localId, synced: successfullySynced || canUseCloud } : g));
      } else {
        setGastos([...gastos, { ...finalPayload, localId, synced: successfullySynced || canUseCloud }]);
      }
      
      setCurrentGasto(initialGastoState);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    } catch (e) { 
        console.error(e);
        toast({ variant: 'destructive', title: 'Error al registrar' }); 
    } finally { 
        setLoading(false); 
    }
  };

  const handleDelete = async (item: GastoItem) => {
    if (!window.confirm("¿Eliminar este gasto?")) return;
    try {
      if (item.localId) await dbLocal.gastos.delete(item.localId);
      if (canUseCloud && item.id) await deleteDoc(doc(firestore!, "gastos_detalle", item.id));
      setGastos(gastos.filter(x => x.id !== item.id));
      toast({ title: 'Gasto eliminado' });
    } catch (e) { toast({ variant: 'destructive', title: 'Error' }); }
  };

  const totalDia = useMemo(() => gastos.reduce((s, g) => s + (Number(g.monto) || 0), 0), [gastos]);

  if (initialLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" size={40} /></div>;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 pb-20">
      {/* HEADER */}
      <section className="bg-[#062113] p-6 rounded-[2.5rem] shadow-xl text-white flex justify-between items-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
            <Euro size={28} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter leading-none">Gastos de Ruta</h2>
            <p className="text-[10px] font-black text-emerald-400/70 uppercase tracking-widest mt-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
              Total Día: {totalDia.toFixed(2)}€
            </p>
          </div>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="h-14 rounded-2xl font-black bg-white/10 border border-white/10 hover:bg-white/20 text-white gap-2 px-6">
              <CalendarIcon size={18} />
              {format(reportDate, "d MMM yyyy", { locale: es }).toUpperCase()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-[150] bg-white rounded-3xl overflow-hidden border-none shadow-2xl">
            <Calendar mode="single" selected={reportDate} onSelect={(d) => d && setReportDate(d)} disabled={(d) => isAfter(d, new Date()) || isBefore(d, subDays(new Date(), 60))} initialFocus />
          </PopoverContent>
        </Popover>
      </section>

      {/* FORM */}
      <section className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Monto (€)</label>
            <Input type="number" placeholder="0.00" value={currentGasto.monto} onChange={e => setCurrentGasto({ ...currentGasto, monto: e.target.value })} className="h-16 rounded-[1.5rem] bg-emerald-50 border-transparent font-black text-emerald-700 text-2xl px-6" />
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Rubro / Categoría</label>
            <Select value={currentGasto.rubro} onValueChange={v => setCurrentGasto({ ...currentGasto, rubro: v })}>
              <SelectTrigger className="h-16 rounded-[1.5rem] bg-slate-50 border-transparent font-bold text-slate-900 px-6">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[150] bg-white rounded-2xl">{['Combustible', 'Peajes', 'Parking', 'Manutención', 'Obras', 'Otros'].map(r => <SelectItem key={r} value={r} className="font-bold">{r.toUpperCase()}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="col-span-full space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Vincular a OT (Opcional)</label>
            <Select value={currentGasto.orderId || 'none'} onValueChange={(val) => {
                const ot = activeOTs.find(o => o.id === val);
                if (ot) {
                  setCurrentGasto({ ...currentGasto, orderId: ot.id, clienteId: ot.clienteId || '', clienteNombre: ot.clienteNombre || ot.cliente || '' });
                } else {
                  setCurrentGasto({ ...currentGasto, orderId: '', clienteId: '', clienteNombre: '' });
                }
            }}>
              <SelectTrigger className="h-16 rounded-[1.5rem] bg-slate-50 border-transparent font-bold text-slate-900 px-6">
                <SelectValue placeholder="NINGUNA (GASTO GENERAL)" />
              </SelectTrigger>
              <SelectContent className="z-[150] bg-white rounded-2xl">
                <SelectItem value="none">NINGUNA (GASTO GENERAL)</SelectItem>
                {activeOTs.map(ot => <SelectItem key={ot.id} value={ot.id} className="font-bold">{ot.id} - {(ot.clienteNombre || ot.cliente || '').toUpperCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-full space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Cliente / Proyecto</label>
            <Select value={currentGasto.clienteId} disabled={!!currentGasto.orderId} onValueChange={(val) => setCurrentGasto({ ...currentGasto, clienteId: val, clienteNombre: clients.find(c => c.id === val)?.nombre })}>
              <SelectTrigger className="h-16 rounded-[1.5rem] bg-slate-50 border-transparent font-bold text-slate-900 px-6">
                <SelectValue placeholder="SELECCIONAR CLIENTE..." />
              </SelectTrigger>
              <SelectContent className="z-[150] bg-white rounded-2xl">
                {clients.map(c => <SelectItem key={c.id} value={c.id} className="font-bold">{c.nombre.toUpperCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-full space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Descripción / Concepto</label>
            <Input placeholder="Ej: Ticket Gasolinera, Peaje A-6..." value={currentGasto.descripcion} onChange={e => setCurrentGasto({ ...currentGasto, descripcion: e.target.value })} className="h-16 rounded-[1.5rem] bg-slate-50 border-transparent font-bold text-slate-800 px-6" />
          </div>

          <div className="flex gap-3 col-span-full">
            <Button variant="outline" onClick={() => { if(cameraInputRef.current) cameraInputRef.current.value = ''; cameraInputRef.current?.click(); }} className="flex-1 h-16 rounded-2xl border-2 border-slate-100 font-bold gap-2 px-1">
              <Camera size={20} />
              CÁMARA
            </Button>
            <Button variant="outline" onClick={() => { if(galleryInputRef.current) galleryInputRef.current.value = ''; galleryInputRef.current?.click(); }} className="flex-1 h-16 rounded-2xl border-2 border-slate-100 font-bold gap-2 px-1">
              <ImageIcon size={20} />
              GALERÍA
            </Button>
            
            <input type="file" ref={cameraInputRef} hidden accept="image/*" capture="environment" onChange={e => setCurrentGasto({ ...currentGasto, comprobanteFile: e.target.files?.[0] })} />
            <input type="file" ref={galleryInputRef} hidden accept="image/*" onChange={e => setCurrentGasto({ ...currentGasto, comprobanteFile: e.target.files?.[0] })} />
            
            <Button onClick={handleSave} disabled={loading} className="flex-[2] h-16 bg-slate-900 text-emerald-400 rounded-2xl font-black gap-2 hover:bg-[#062113]">
              {loading ? <Loader2 className="animate-spin" /> : <>GUARDAR GASTO <ArrowRight size={18} /></>}
            </Button>
          </div>

          {previewUrl && (
            <div className="col-span-full flex flex-col items-center mt-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Comprobante Adjunto</p>
              <div 
                className="w-20 h-20 rounded-2xl border-2 border-emerald-500 overflow-hidden cursor-pointer shadow-md transition-transform hover:scale-105"
                onClick={() => setIsPreviewOpen(true)}
                title="Haz clic para ampliar"
              >
                <img src={previewUrl} alt="Vista Previa" className="w-full h-full object-cover" />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* LISTA */}
      <div className="space-y-4">
        {gastos.map((g, i) => (
          <div key={i} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                {g.synced ? <Check size={20} className="text-emerald-500" /> : <Loader2 size={20} className="animate-spin" />}
              </div>
              <div>
                <p className="font-black text-slate-900 text-sm uppercase">{g.rubro} - {g.monto}€</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">{g.clienteNombre || 'Gasto General'}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(g)} className="text-slate-300 hover:text-red-500"><Trash2 size={18} /></Button>
          </div>
        ))}
      </div>

      {isPreviewOpen && previewUrl && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsPreviewOpen(false)}>
          <div className="relative w-full max-w-2xl max-h-[90vh] flex items-center justify-center">
            <button 
              className="absolute -top-12 right-0 text-white hover:text-emerald-400 bg-white/10 p-2 rounded-full backdrop-blur-md transition-colors"
              onClick={() => setIsPreviewOpen(false)}
            >
              <X size={24} />
            </button>
            <img 
              src={previewUrl} 
              alt="Comprobante Completo" 
              className="max-w-full max-h-[85vh] object-contain rounded-xl"
              onClick={(e) => e.stopPropagation()} 
            />
          </div>
        </div>
      )}
    </div>
  );
}