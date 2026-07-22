'use client';

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFirestore, useUser } from '@/firebase';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { useToast } from '@/hooks/use-toast';
import { OT_STATUS } from '@/lib/constants';
import { db as dbLocal } from '@/lib/db-local';
import { calculateHoursBreakdown } from '@/lib/hours-utils';
import { resolveInspectorEmail } from '@/lib/inspection-mode';
import { buildVisitId } from '../lib/visit-record';
import { format, isAfter, isBefore, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore';
import {
  ArrowRight,
  Calendar as CalendarIcon,
  ClipboardList,
  Clock,
  Loader2
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface WorkOrder {
  id: string;
  clienteId?: string;
  clienteNombre?: string;
  cliente?: string;
  [key: string]: any;
}

export default function RegistroJornadaForm({ otId }: { otId?: string | null }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const inspectorEmail = resolveInspectorEmail(user?.email || '');
  const canUseCloud = isOnline && !!firestore && !!user?.email;

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [clients, setClients] = useState<any[]>([]);
  const [activeOTs, setActiveOTs] = useState<WorkOrder[]>([]);
  const [localRecords, setLocalRecords] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    clienteId: '',
    clienteNombre: '',
    orderId: '',
    actividad: 'Inspección',
    totalHoras: '',
    horasNormales: 0,
    horasExtras: 0,
    horasEspeciales: 0,
    horaLlegada: '08:00',
    horaSalida: '17:00'
  });

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = async () => {
      setInitialLoading(true);
      try {
        // Cargar clientes desde caché local
        const cachedClients = await dbLocal.clientes_cache.toArray();
        setClients(cachedClients.sort((a, b) => a.nombre.localeCompare(b.nombre)));

        // Cargar registros locales del día
        const dateStr = format(reportDate, 'yyyy-MM-dd');
        const local = await dbLocal.registros_jornada
          .filter(r => r.data.fechaStr === dateStr)
          .toArray();
        setLocalRecords(local.map(r => ({ ...r.data, localId: r.id, synced: r.synced })));

        if (canUseCloud) {
          // Cargar OTs activas de la nube
          const otsSnap = await getDocs(query(
            collection(firestore!, 'ordenes_trabajo'), 
            where('inspectorIds', 'array-contains', inspectorEmail),
            where('estado', 'in', [OT_STATUS.REGISTRADA, OT_STATUS.EN_PROCESO])
          ));
          const ots = otsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as WorkOrder[];
          setActiveOTs(ots);

          if (otId) {
            const target = ots.find(o => o.id === otId);
            if (target) {
              setFormData(prev => ({
                ...prev,
                orderId: target.id,
                clienteId: target.clienteId || '',
                clienteNombre: target.clienteNombre || target.cliente || ''
              }));
            }
          }
        }
      } catch (e) {
        console.error("Error loading data:", e);
      } finally {
        setInitialLoading(false);
      }
    };
    loadData();
  }, [reportDate, canUseCloud, firestore, inspectorEmail, otId]);

  const handleAutoSplit = (total: number) => {
    const breakdown = calculateHoursBreakdown(total, format(reportDate, 'yyyy-MM-dd'));
    setFormData(prev => ({
      ...prev,
      totalHoras: String(total),
      horasNormales: breakdown.normal,
      horasExtras: breakdown.extra,
      horasEspeciales: breakdown.special
    }));
  };

  const handleSave = async () => {
    if (!(formData.clienteId || formData.clienteNombre)) {
      return toast({ variant: 'destructive', title: 'Faltan datos', description: 'Debes seleccionar un cliente o proyecto.' });
    }

    if (!formData.totalHoras || parseFloat(formData.totalHoras) <= 0) {
      return toast({ variant: 'destructive', title: 'Faltan datos', description: 'Introduce un total de horas válido (mayor a 0).' });
    }

    if (!inspectorEmail) {
      return toast({ variant: 'destructive', title: 'Error de Identidad', description: 'No se pudo determinar el ID del inspector.' });
    }

    setLoading(true);
    try {
      const id = buildVisitId(inspectorEmail, user?.displayName, reportDate);

      const payload = {
        ...formData,
        id,
        inspectorId: inspectorEmail,
        inspectorNombre: user?.displayName || inspectorEmail,
        fecha: reportDate,
        fechaStr: format(reportDate, 'yyyy-MM-dd'),
        estado: 'Registrado',
        createdAt: new Date()
      };

      // 1. Guardar en Dexie (Local) - Prevenir duplicados locales
      const existing = await dbLocal.registros_jornada.where('firebaseId').equals(id).first();
      let localId;
      if (existing) {
        localId = existing.id!;
        await dbLocal.registros_jornada.update(localId, {
          data: payload,
          synced: false,
          createdAt: new Date()
        });
      } else {
        localId = await dbLocal.registros_jornada.add({
          firebaseId: id,
          synced: false,
          data: payload,
          createdAt: new Date()
        });
      }

      // 2. Intentar guardar en Firestore si hay nube
      let successfullySynced = false;
      if (canUseCloud) {
        try {
          const cloudPayload = { ...(payload as any) };
          delete cloudPayload.localId;
          await setDoc(doc(firestore!, 'bitacora_visitas', id), {
            ...cloudPayload,
            createdAt: serverTimestamp(),
            fecha: Timestamp.fromDate(reportDate)
          });
          await dbLocal.registros_jornada.update(localId, { synced: true });
          successfullySynced = true;
          toast({ title: 'Jornada Sincronizada ✅' });
        } catch {
          console.warn("Nube no disponible, guardado solo en local.");
          toast({ title: 'Guardado Local (Pendiente Sync) 💾' });
        }
      } else {
        toast({ title: 'Guardado Local (Modo Offline) 💾' });
      }

      // Actualizar la lista en memoria previniendo duplicados
      if (existing) {
        setLocalRecords(localRecords.map(r => r.id === id ? { ...payload, localId, synced: successfullySynced || canUseCloud } : r));
      } else {
        setLocalRecords([...localRecords, { ...payload, localId, synced: successfullySynced || canUseCloud }]);
      }

      setFormData({
        ...formData,
        totalHoras: '',
        horasNormales: 0,
        horasExtras: 0,
        horasEspeciales: 0
      });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error al guardar' });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" size={40} /></div>;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 pb-20">
      {/* HEADER CARD */}
      <section className="bg-[#062113] p-6 rounded-[2.5rem] shadow-xl text-white flex justify-between items-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
            <Clock size={28} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter leading-none">Bitácora de Horas</h2>
            <p className="text-[10px] font-black text-emerald-400/70 uppercase tracking-widest mt-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
              Registro de Producción Diaria
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
          <PopoverContent className="w-auto p-0 z-[150] bg-white border shadow-2xl rounded-3xl overflow-hidden">
            <Calendar 
              mode="single" 
              selected={reportDate} 
              onSelect={(d) => d && setReportDate(d)} 
              disabled={(d) => isAfter(d, new Date()) || isBefore(d, subDays(new Date(), 30))} 
              initialFocus 
            />
          </PopoverContent>
        </Popover>
      </section>

      {/* FORM CARD */}
      <section className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="space-y-2 col-span-1 md:col-span-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Vincular Orden de Trabajo (Opcional)</label>
            <Select 
              value={formData.orderId || 'none'} 
              onValueChange={(val) => {
                if (val === 'none') {
                  setFormData({ ...formData, orderId: '', clienteId: '', clienteNombre: '' });
                } else {
                  const ot = activeOTs.find(o => o.id === val);
                  if (ot) {
                    setFormData({ ...formData, orderId: ot.id, clienteId: ot.clienteId || '', clienteNombre: ot.clienteNombre || ot.cliente || '' });
                  }
                }
              }}
            >
              <SelectTrigger className="h-16 rounded-[1.5rem] bg-slate-50 border-transparent font-bold text-slate-900 px-6">
                <SelectValue placeholder="SIN VÍNCULO (TRABAJO GENERAL)" />
              </SelectTrigger>
              <SelectContent className="z-[150] bg-white rounded-2xl border-slate-100 shadow-2xl">
                <SelectItem value="none">SIN VÍNCULO (TRABAJO GENERAL)</SelectItem>
                {activeOTs.map(ot => (
                  <SelectItem key={ot.id} value={ot.id} className="font-bold">
                    {ot.id} - {(ot.clienteNombre || ot.cliente || '').toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Cliente / Proyecto</label>
            <Select 
              value={formData.clienteId} 
              disabled={!!formData.orderId}
              onValueChange={(val) => setFormData({ ...formData, clienteId: val, clienteNombre: clients.find(c => c.id === val)?.nombre || '' })}
            >
              <SelectTrigger className="h-16 rounded-[1.5rem] bg-slate-50 border-transparent font-bold text-slate-900 px-6">
                <SelectValue placeholder="SELECCIONAR CLIENTE..." />
              </SelectTrigger>
              <SelectContent className="z-[150] bg-white rounded-2xl border-slate-100 shadow-2xl">
                {clients.map(c => <SelectItem key={c.id} value={c.id} className="font-bold">{c.nombre.toUpperCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Total Horas</label>
            <div className="relative">
              <Input 
                type="number" 
                placeholder="0.00" 
                value={formData.totalHoras} 
                onChange={e => handleAutoSplit(Number(e.target.value))} 
                className="h-16 rounded-[1.5rem] bg-emerald-50 border-transparent font-black text-emerald-700 text-2xl pl-6" 
              />
              <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-emerald-300 uppercase text-xs">Horas</span>
            </div>
          </div>

          <div className="col-span-1 md:col-span-2 grid grid-cols-3 gap-3">
             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase">Normales</p>
                <p className="text-lg font-black text-slate-800">{formData.horasNormales.toFixed(2)}</p>
             </div>
             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase">Extras</p>
                <p className="text-lg font-black text-slate-800">{formData.horasExtras.toFixed(2)}</p>
             </div>
             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase">Especiales</p>
                <p className="text-lg font-black text-slate-800">{formData.horasEspeciales.toFixed(2)}</p>
             </div>
          </div>

          <div className="col-span-1 md:col-span-2 space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Actividad / Observaciones</label>
            <Input 
              placeholder="Descripción breve del trabajo realizado..." 
              value={formData.actividad} 
              onChange={e => setFormData({ ...formData, actividad: e.target.value })} 
              className="h-16 rounded-[1.5rem] bg-slate-50 border-transparent font-bold text-slate-800 px-6" 
            />
          </div>

        </div>

        <Button 
          onClick={handleSave} 
          disabled={loading} 
          className="w-full h-20 bg-slate-900 text-emerald-400 rounded-[2rem] font-black text-lg border-2 border-emerald-400/20 hover:bg-[#062113] hover:border-emerald-400 transition-all shadow-2xl flex items-center justify-center gap-4 group"
        >
          {loading ? <Loader2 className="animate-spin" /> : (
            <>
              REGISTRAR MI JORNADA
              <ArrowRight className="group-hover:translate-x-2 transition-transform" />
            </>
          )}
        </Button>
      </section>

      {/* LIST OF RECENT RECORDS */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">Registros de hoy ({localRecords.length})</h3>
        {localRecords.map((r, i) => (
          <div key={i} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-4">
               <div className={r.synced ? "w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center" : "w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center"}>
                  <Clock size={20} />
               </div>
               <div>
                  <div className="flex items-center gap-2">
                    <p className="font-black text-slate-900 uppercase text-sm">{r.clienteNombre}</p>
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${r.synced ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      {r.synced ? 'SINCRONIZADO' : 'PENDIENTE'}
                    </span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{r.actividad}</p>
               </div>
            </div>
            <div className="text-right">
               <p className="text-xl font-black text-slate-900">{(r.horasNormales + r.horasExtras + r.horasEspeciales).toFixed(2)}<span className="text-xs text-slate-400 ml-1">h</span></p>
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{r.horaLlegada} - {r.horaSalida}</p>
            </div>
          </div>
        ))}
        {localRecords.length === 0 && (
          <div className="py-12 text-center text-slate-300">
             <ClipboardList size={40} className="mx-auto mb-3 opacity-20" />
             <p className="font-black text-xs uppercase tracking-widest">Sin registros para esta fecha</p>
          </div>
        )}
      </div>
    </div>
  );
}
