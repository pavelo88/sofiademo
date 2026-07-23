'use client';

/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- QA: warning reviewed; keeping current flow to avoid behavioral changes. */

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useFirestore, useUser } from '@/firebase';
import { differenceInMinutes, format, isAfter, isBefore, parse, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadString } from 'firebase/storage';
import {
  Calendar as CalendarIcon,
  Camera,
  CheckCircle2,
  Clock,
  Loader2,
  MapPinned,
  Pencil,
  Play,
  RotateCcw, Save,
  StopCircle,
  Trash2,
  X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOnlineStatus } from '@/hooks/use-online-status';
import { useToast } from '@/hooks/use-toast';
import { OT_STATUS } from '@/lib/constants';
import { db as dbLocal } from '@/lib/db-local';
import { calculateHoursBreakdown, formatTechnicianName } from '@/lib/hours-utils';
import { resolveInspectorEmail } from '@/lib/inspection-mode';
import { fileToBase64 } from '@/lib/offline-utils';
import { buildVisitId } from '../lib/visit-record';
import BitacoraMultiRowForm from './forms/BitacoraMultiRowForm';

// --- TIPOS DE DATOS ---
type VisitaItem = {
  id: string; clienteId: string; clienteNombre: string; actividad: string;
  horaLlegada: string; horaSalida: string; ubicacionLlegada: any;
  horasNormales: number; horasExtras: number; horasEspeciales: number;
  hNormalesStr: string; hExtrasStr: string; hEspecialesStr: string;
  motorUrl?: string;
  estado: 'Registrado' | 'Aprobado';
  fecha: Date | string;
};

type ActiveStop = {
  clienteId: string; clienteNombre: string; actividad: string;
  horaLlegada: string; arrivalTimestamp?: string; ubicacionLlegada: any;
  orderId: string | null;
};

const cleanData = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (Array.isArray(obj)) return obj.map(cleanData);
  if (typeof obj === 'object') {
    if (obj instanceof Date || obj instanceof Timestamp) return obj;
    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = cleanData(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
};

export default function BitacoraVisitasForm({ otFilter }: { otFilter?: string | null }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = firestore ? getStorage(firestore.app) : null;
  const isOnline = useOnlineStatus();
  const inspectorEmail = resolveInspectorEmail(user?.email || '');
  const canUseCloud = isOnline && !!firestore && !!storage && !!user?.email;
  const { toast } = useToast();

  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [visitas, setVisitas] = useState<VisitaItem[]>([]);
  const [activeStop, setActiveStop] = useState<ActiveStop | null>(null);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [stopTimeManual, setStopTimeManual] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'individual' | 'tabla'>('individual');
  const [omitirAlmuerzo, setOmitirAlmuerzo] = useState(false);

  // Estado temporal para marcar salida
  const [tempHours, setTempHours] = useState({ normales: '', extras: '', especiales: '', motorFile: undefined as File | undefined });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentEditVisit, setCurrentEditVisit] = useState<any>(null);
  const [startConfig, setStartConfig] = useState({ clienteId: '', clienteNombre: '', actividad: 'Inspección', orderId: '' });
  const [activeOTs, setActiveOTs] = useState<any[]>([]);
  const stopFileInputRef = useRef<HTMLInputElement>(null);

  // --- RECUPERAR PARADA ACTIVA ---
  useEffect(() => {
    const loadState = async () => {
      if (!inspectorEmail) return;
      const savedRow = await dbLocal.configuracion.get(`activeVisit_draft_${inspectorEmail}`);
      const pausedRow = await dbLocal.configuracion.get(`activeVisit_paused_${inspectorEmail}`);
      const stopTimeRow = await dbLocal.configuracion.get(`activeVisit_stopTime_${inspectorEmail}`);

      if (savedRow?.value) {
        setActiveStop(savedRow.value);
        toast({
          title: 'CRONÓMETRO ACTIVO',
          description: 'Tienes un registro de visita en curso.',
          duration: 5000,
        });
      }
      if (pausedRow?.value === 'true') setIsTimerPaused(true);
      if (stopTimeRow?.value) setStopTimeManual(stopTimeRow.value);
    };
    if (inspectorEmail) loadState();
  }, [inspectorEmail, toast]);

  useEffect(() => {
    const saveState = async () => {
      if (inspectorEmail) {
        if (activeStop) {
          await dbLocal.configuracion.put({ key: `activeVisit_draft_${inspectorEmail}`, value: activeStop });
          await dbLocal.configuracion.put({ key: `activeVisit_paused_${inspectorEmail}`, value: String(isTimerPaused) });
          if (stopTimeManual) {
            await dbLocal.configuracion.put({ key: `activeVisit_stopTime_${inspectorEmail}`, value: stopTimeManual });
          } else {
            await dbLocal.configuracion.delete(`activeVisit_stopTime_${inspectorEmail}`);
          }
        } else {
          await dbLocal.configuracion.delete(`activeVisit_draft_${inspectorEmail}`);
          await dbLocal.configuracion.delete(`activeVisit_paused_${inspectorEmail}`);
          await dbLocal.configuracion.delete(`activeVisit_stopTime_${inspectorEmail}`);
        }
      }
    };
    saveState();
  }, [activeStop, isTimerPaused, stopTimeManual, inspectorEmail]);

  // --- CRONÓMETRO ---
  useEffect(() => {
    let interval: any;
    if (activeStop && !isTimerPaused) {
      const calculate = () => {
        const arrival = parse(activeStop.horaLlegada, 'HH:mm', new Date());
        const now = new Date();
        let diff = differenceInMinutes(now, arrival);
        if (diff < 0) diff += 1440; // Cruce de medianoche
        setElapsedTime(`${String(Math.floor(diff / 60)).padStart(2, '0')}:${String(diff % 60).padStart(2, '0')}`);
      };
      calculate();
      interval = setInterval(calculate, 60000);
    } else if (activeStop && isTimerPaused && stopTimeManual) {
      const arrival = parse(activeStop.horaLlegada, 'HH:mm', new Date());
      const stop = parse(stopTimeManual, 'HH:mm', new Date());
      let diff = differenceInMinutes(stop, arrival);
      if (diff < 0) diff += 1440; // Cruce de medianoche
      setElapsedTime(`${String(Math.floor(diff / 60)).padStart(2, '0')}:${String(diff % 60).padStart(2, '0')}`);
    } else if (!activeStop) {
      setElapsedTime('00:00');
    }
    return () => clearInterval(interval);
  }, [activeStop, isTimerPaused, stopTimeManual]);

  useEffect(() => {
    const fetch = async () => {
      if (!firestore) return setClients(await dbLocal.clientes_cache.toArray());

      const [clientsSnap, otsSnap] = await Promise.all([
        getDocs(collection(firestore, 'clientes')),
        getDocs(query(collection(firestore, 'ordenes_trabajo'), where('inspectorIds', 'array-contains', inspectorEmail), where('estado', 'in', [OT_STATUS.EN_PROCESO, OT_STATUS.REGISTRADA])))
      ]);

      const list = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setClients(list.sort((a: any, b: any) => (a.nombre > b.nombre ? 1 : -1)));

      const ots = otsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setActiveOTs(ots);

      // Si hay un filtro de OT, pre-seleccionamos
      if (otFilter && !activeStop) {
        const targetOT: any = ots.find(o => o.id === otFilter);
        if (targetOT) {
          setStartConfig({
            clienteId: targetOT.clienteId || '',
            clienteNombre: targetOT.clienteNombre || targetOT.cliente || '',
            actividad: 'Inspección',
            orderId: targetOT.id
          });
        }
      }
    };
    fetch();
  }, [firestore, inspectorEmail, otFilter]);

  // --- CARGAR VISITAS DEL DÍA ---
  useEffect(() => {
    const load = async () => {
      if (!canUseCloud || !inspectorEmail) { setInitialLoading(false); return; }
      setInitialLoading(true);
      try {
        const q = query(
          collection(firestore, "bitacora_visitas"),
          where("inspectorId", "==", inspectorEmail),
          where("fechaStr", "==", format(reportDate, 'yyyy-MM-dd'))
        );
        const snap = await getDocs(q);
        setVisitas(snap.docs.map(d => ({ id: d.id, ...d.data() } as VisitaItem)));
      } catch (e) { console.error(e); }
      setInitialLoading(false);
    };
    load();
  }, [reportDate, inspectorEmail, canUseCloud, firestore]);

  const handleMarcarLlegada = () => {
    if (!startConfig.clienteId) return toast({ variant: 'destructive', title: 'Selecciona cliente' });
    const setArrival = (ubicacion: any) => {
      const now = new Date();
      // Solicitar permiso de notificaciones al interactuar con el botón
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
      setActiveStop({ 
        ...startConfig, 
        horaLlegada: format(now, 'HH:mm'), 
        arrivalTimestamp: now.toISOString(),
        ubicacionLlegada: ubicacion 
      });
      setTempHours({ normales: '', extras: '', especiales: '', motorFile: undefined });
      setIsTimerPaused(false);
      setStopTimeManual(null);
      toast({ title: 'LLEGADA REGISTRADA ✅' });
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(p => setArrival({ lat: p.coords.latitude, lon: p.coords.longitude }), () => setArrival(null));
    } else setArrival(null);
  };

  const handleDetenerCronometro = () => {
    setStopTimeManual(format(new Date(), 'HH:mm'));
    setIsTimerPaused(true);
  };

  const handleGuardarSalida = async () => {
    if (!activeStop || !stopTimeManual) return;
    const horaSalida = stopTimeManual;

    const arrivalDate = activeStop.arrivalTimestamp ? new Date(activeStop.arrivalTimestamp) : parse(activeStop.horaLlegada, 'HH:mm', reportDate);
    const stopDate = activeStop.arrivalTimestamp ? new Date() : parse(stopTimeManual, 'HH:mm', reportDate);
    
    // Si usamos HH:mm (fallback), verificamos si cruza medianoche
    const isCrossDayFallback = !activeStop.arrivalTimestamp && differenceInMinutes(stopDate, arrivalDate) < 0;
    // Si usamos Date, verificamos si cambió de día (y no es un retroceso en el tiempo)
    const isCrossDayTimestamp = activeStop.arrivalTimestamp && (arrivalDate.getDate() !== stopDate.getDate());
    
    const isCrossDay = isCrossDayFallback || isCrossDayTimestamp;
    
    let totalRealDiff = differenceInMinutes(stopDate, arrivalDate);
    if (totalRealDiff < 0) totalRealDiff += 1440;
    
    const shouldDeductAlmuerzo = totalRealDiff >= 480 && !omitirAlmuerzo && activeStop.actividad !== 'ALIMENTACION';

    let mUrl = '';
    
    if (isCrossDay) {
      if (!window.confirm(`¿Guardar visita de ${activeStop.clienteNombre}? IMPORTANTE: La jornada cruzó la medianoche, se generarán DOS registros (uno para hoy y otro para mañana como horas extras).`)) return;
      setLoading(true);
      try {
        if (tempHours.motorFile && canUseCloud) {
          const base64 = await fileToBase64(tempHours.motorFile);
          const fRef = ref(storage!, `visitas/${inspectorEmail}/${Date.now()}_img.png`);
          await uploadString(fRef, base64, 'data_url');
          mUrl = await getDownloadURL(fRef);
        }

        // --- REGISTRO 1: Día Actual (hasta las 23:59) ---
        const eodDate = new Date(arrivalDate);
        eodDate.setHours(23, 59, 0, 0);
        let diff1 = differenceInMinutes(eodDate, arrivalDate);
        
        let descuento1 = 0;
        let descuento2 = 0;
        if (shouldDeductAlmuerzo) {
          if (diff1 >= 60) {
            descuento1 = 60;
            diff1 -= 60;
          } else {
            descuento1 = diff1;
            descuento2 = 60 - diff1;
            diff1 = 0;
          }
        }
        
        const total1 = diff1 > 0 ? diff1 / 60 : 0;
        const accumulatedNormalHours = visitas.reduce((sum, v) => sum + (v.horasNormales || 0), 0);
        const breakdown1 = calculateHoursBreakdown(total1, reportDate, accumulatedNormalHours);
        
        const id1 = buildVisitId(inspectorEmail, user?.displayName, reportDate) + '_P1';
        const docData1: VisitaItem & { descuentoAlimentacion?: number } = {
          id: id1, clienteId: activeStop.clienteId, clienteNombre: activeStop.clienteNombre, actividad: activeStop.actividad,
          horaLlegada: activeStop.horaLlegada, horaSalida: '23:59', ubicacionLlegada: activeStop.ubicacionLlegada,
          horasNormales: breakdown1.normal, horasExtras: breakdown1.extra, horasEspeciales: breakdown1.special,
          hNormalesStr: breakdown1.normal.toFixed(2), hExtrasStr: breakdown1.extra.toFixed(2), hEspecialesStr: breakdown1.special.toFixed(2),
          motorUrl: mUrl || undefined, estado: 'Registrado', fecha: reportDate,
          descuentoAlimentacion: descuento1 > 0 ? descuento1 / 60 : 0
        };

        // --- REGISTRO 2: Día Siguiente (desde las 00:00) ---
        const nextDay = new Date(reportDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        let diff2 = 0;
        if (activeStop.arrivalTimestamp) {
          const startOfDay = new Date(stopDate);
          startOfDay.setHours(0, 0, 0, 0);
          diff2 = differenceInMinutes(stopDate, startOfDay);
        } else {
          const startOfDay = parse('00:00', 'HH:mm', reportDate);
          diff2 = differenceInMinutes(stopDate, startOfDay);
        }
        
        if (descuento2 > 0) diff2 -= descuento2;
        const total2 = diff2 > 0 ? diff2 / 60 : 0;
        
        const breakdown2 = {
          normal: 0,
          extra: 0,
          special: Number(total2.toFixed(2))
        };

        const id2 = buildVisitId(inspectorEmail, user?.displayName, nextDay) + '_P2';
        const docData2: VisitaItem & { descuentoAlimentacion?: number } = {
          id: id2, clienteId: activeStop.clienteId, clienteNombre: activeStop.clienteNombre, actividad: activeStop.actividad,
          horaLlegada: '00:00', horaSalida, ubicacionLlegada: activeStop.ubicacionLlegada,
          horasNormales: breakdown2.normal, horasExtras: breakdown2.extra, horasEspeciales: breakdown2.special,
          hNormalesStr: breakdown2.normal.toFixed(2), hExtrasStr: breakdown2.extra.toFixed(2), hEspecialesStr: breakdown2.special.toFixed(2),
          motorUrl: mUrl || undefined, estado: 'Registrado', fecha: nextDay,
          descuentoAlimentacion: descuento2 > 0 ? descuento2 / 60 : 0
        };

        await setDoc(doc(firestore!, "bitacora_visitas", id1), cleanData({
          ...docData1, inspectorId: inspectorEmail, inspectorNombre: formatTechnicianName(user?.displayName || inspectorEmail || ''),
          fechaStr: format(reportDate, 'yyyy-MM-dd'), orderId: activeStop.orderId || null, createdAt: serverTimestamp()
        }));

        await setDoc(doc(firestore!, "bitacora_visitas", id2), cleanData({
          ...docData2, inspectorId: inspectorEmail, inspectorNombre: formatTechnicianName(user?.displayName || inspectorEmail || ''),
          fechaStr: format(nextDay, 'yyyy-MM-dd'), orderId: activeStop.orderId || null, createdAt: serverTimestamp()
        }));
        
        if (shouldDeductAlmuerzo) {
           const idAlm = buildVisitId(inspectorEmail, user?.displayName, reportDate) + '_ALM' + Date.now();
           await setDoc(doc(firestore!, "bitacora_visitas", idAlm), cleanData({
             id: idAlm, clienteId: activeStop.clienteId, clienteNombre: activeStop.clienteNombre, actividad: 'ALIMENTACION',
             horaLlegada: '13:00', horaSalida: '14:00',
             horasNormales: 0, horasExtras: 0, horasEspeciales: 0,
             hNormalesStr: '0.00', hExtrasStr: '0.00', hEspecialesStr: '0.00',
             estado: 'Registrado', fecha: reportDate,
             inspectorId: inspectorEmail, inspectorNombre: formatTechnicianName(user?.displayName || inspectorEmail || ''),
             fechaStr: format(reportDate, 'yyyy-MM-dd'), orderId: activeStop.orderId || null, createdAt: serverTimestamp()
           }));
        }

        if (activeStop.orderId) {
          try { await updateDoc(doc(firestore!, 'ordenes_trabajo', activeStop.orderId), { estado: OT_STATUS.EN_PROCESO }); } catch (e) {}
        }

        setVisitas([...visitas, docData1]); // el doc2 no se muestra hoy
        setActiveStop(null);
        setIsTimerPaused(false);
        setStopTimeManual(null);
        setOmitirAlmuerzo(false);
        toast({ title: 'JORNADA DIVIDIDA ✅', description: 'Se generó un registro extra para el día de mañana.' });
      } catch (err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Error al guardar', description: 'Revisa tu conexión e inténtalo de nuevo.' });
      } finally { setLoading(false); }
      return;
    }

    // --- LÓGICA NORMAL (MISMO DÍA) ---
    let diffMinutes = totalRealDiff;
    if (shouldDeductAlmuerzo) diffMinutes -= 60;
    const totalCalculado = diffMinutes > 0 ? diffMinutes / 60 : 0;

    if (totalCalculado <= 0) {
      return toast({ variant: 'destructive', title: 'Error', description: 'El tiempo de permanencia debe ser mayor a 0.' });
    }

    if (!window.confirm(`¿Guardar visita de ${activeStop.clienteNombre}? Tiempo total: ${totalCalculado.toFixed(2)}h${shouldDeductAlmuerzo ? ' (Se descontó 1h de almuerzo)' : ''}`)) return;

    setLoading(true);
    try {
      if (tempHours.motorFile && canUseCloud) {
        const base64 = await fileToBase64(tempHours.motorFile);
        const fRef = ref(storage!, `visitas/${inspectorEmail}/${Date.now()}_img.png`);
        await uploadString(fRef, base64, 'data_url');
        mUrl = await getDownloadURL(fRef);
      }

      const accumulatedNormalHours = visitas.reduce((sum, v) => sum + (v.horasNormales || 0), 0);
      const breakdown = calculateHoursBreakdown(totalCalculado, reportDate, accumulatedNormalHours);

      const id = buildVisitId(inspectorEmail, user?.displayName, reportDate);
      const docData: VisitaItem & { descuentoAlimentacion?: number } = {
        id, clienteId: activeStop.clienteId, clienteNombre: activeStop.clienteNombre, actividad: activeStop.actividad,
        horaLlegada: activeStop.horaLlegada, horaSalida, ubicacionLlegada: activeStop.ubicacionLlegada,
        horasNormales: breakdown.normal, horasExtras: breakdown.extra, horasEspeciales: breakdown.special,
        hNormalesStr: breakdown.normal.toFixed(2), hExtrasStr: breakdown.extra.toFixed(2), hEspecialesStr: breakdown.special.toFixed(2),
        motorUrl: mUrl || undefined, estado: 'Registrado', fecha: reportDate,
        descuentoAlimentacion: shouldDeductAlmuerzo ? 1 : 0
      };

      await setDoc(doc(firestore!, "bitacora_visitas", id), cleanData({
        ...docData, inspectorId: inspectorEmail, inspectorNombre: formatTechnicianName(user?.displayName || inspectorEmail || ''),
        fechaStr: format(reportDate, 'yyyy-MM-dd'), orderId: activeStop.orderId || null, createdAt: serverTimestamp()
      }));
      
      if (shouldDeductAlmuerzo) {
         const idAlm = buildVisitId(inspectorEmail, user?.displayName, reportDate) + '_ALM' + Date.now();
         const docDataAlm = {
           id: idAlm, clienteId: activeStop.clienteId, clienteNombre: activeStop.clienteNombre, actividad: 'ALIMENTACION',
           horaLlegada: '13:00', horaSalida: '14:00',
           horasNormales: 0, horasExtras: 0, horasEspeciales: 0,
           hNormalesStr: '0.00', hExtrasStr: '0.00', hEspecialesStr: '0.00',
           estado: 'Registrado', fecha: reportDate
         };
         await setDoc(doc(firestore!, "bitacora_visitas", idAlm), cleanData({
           ...docDataAlm, inspectorId: inspectorEmail, inspectorNombre: formatTechnicianName(user?.displayName || inspectorEmail || ''),
           fechaStr: format(reportDate, 'yyyy-MM-dd'), orderId: activeStop.orderId || null, createdAt: serverTimestamp()
         }));
         setVisitas(prev => [...prev, docData as VisitaItem, docDataAlm as VisitaItem]);
      } else {
         setVisitas(prev => [...prev, docData as VisitaItem]);
      }

      if (activeStop.orderId) {
        try { await updateDoc(doc(firestore!, 'ordenes_trabajo', activeStop.orderId), { estado: OT_STATUS.EN_PROCESO }); } catch (e) {}
      }

      setActiveStop(null);
      setIsTimerPaused(false);
      setStopTimeManual(null);
      setOmitirAlmuerzo(false);
      toast({ title: 'VISITA REGISTRADA ✅' });
    } catch (err) { 
      console.error(err);
      toast({ variant: 'destructive', title: 'Error al guardar', description: 'Revisa tu conexión e inténtalo de nuevo.' }); 
    }
    finally { setLoading(false); }
  };

  if (initialLoading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-emerald-500" size={40} /></div>;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 text-left pb-24">
      <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-900 text-emerald-400 rounded-2xl flex items-center justify-center shadow-lg"><Clock size={24} /></div>
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter leading-none">Bitácora de Horas</h2>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Horas de Atención y Visitas</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => setViewMode(prev => prev === 'individual' ? 'tabla' : 'individual')}
            className="h-12 rounded-2xl font-black text-[10px] tracking-widest border-2 text-slate-600 uppercase hover:bg-slate-50 transition-all"
          >
            {viewMode === 'individual' ? 'REGISTRO EN TABLA' : 'REGISTRO INDIVIDUAL'}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-12 rounded-2xl font-bold border-2"><CalendarIcon size={18} className="mr-2" />{format(reportDate, "d MMM yyyy", { locale: es }).toUpperCase()}</Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-[150] bg-white border-none shadow-2xl rounded-2xl overflow-hidden"><Calendar mode="single" selected={reportDate} onSelect={(d) => d && setReportDate(d)} disabled={(d) => isAfter(d, new Date()) || isBefore(d, subDays(new Date(), 7))} className="rounded-2xl" /></PopoverContent>
          </Popover>
        </div>
      </section>

      {viewMode === 'tabla' ? (
        <BitacoraMultiRowForm 
          reportDate={reportDate} 
          clients={clients} 
          activeOTs={activeOTs} 
          inspectorEmail={inspectorEmail || ""}
          user={user}
          onSuccess={(nuevasVisitas) => {
            setVisitas([...visitas, ...nuevasVisitas]);
            setViewMode('individual'); // Vuelve a la vista normal para ver el historial
          }}
          existingVisitas={visitas}
        />
      ) : (
        <>
          {!activeStop ? (
            <section className="bg-white p-6 rounded-[2rem] shadow-sm border-2 border-slate-100 grid gap-4 animate-in zoom-in-95 duration-300">
          <div className="flex items-center gap-2 mb-2">
            <MapPinned size={18} className="text-emerald-500" />
            <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">Nueva Llegada</h3>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Vincular a OT (Opcional)</label>
            <Select
              value={startConfig.orderId}
              onValueChange={(val) => {
                const ot = activeOTs.find(o => o.id === val);
                if (ot) {
                  setStartConfig({
                    ...startConfig,
                    orderId: ot.id,
                    clienteId: ot.clienteId || '',
                    clienteNombre: ot.clienteNombre || ot.cliente || ''
                  });
                } else {
                  setStartConfig({ ...startConfig, orderId: '' });
                }
              }}
            >
              <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-transparent font-bold">
                <SelectValue placeholder="NINGUNA (LLEGADA LIBRE)" />
              </SelectTrigger>
              <SelectContent className="z-[150] bg-white">
                <SelectItem value="none">NINGUNA (LLEGADA LIBRE)</SelectItem>
                {activeOTs.map(ot => (
                  <SelectItem key={ot.id} value={ot.id}>
                    <span className="font-black text-primary">{ot.id}</span>
                    <span className="mx-2 text-slate-300">•</span>
                    <span className="font-bold">{(ot.clienteNombre || ot.cliente || 'CLIENTE').toUpperCase()}</span>
                    <span className="mx-2 text-slate-300">•</span>
                    <span className="text-slate-500 truncate">{ot.descripcion}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Cliente</label>
            <Select
              value={startConfig.clienteId}
              disabled={!!startConfig.orderId}
              onValueChange={(val) => setStartConfig({ ...startConfig, clienteId: val, clienteNombre: val === "OFICINA" ? 'OFICINA' : clients.find(c => c.id === val)?.nombre })}
            >
              <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-transparent font-bold">
                <SelectValue placeholder="SELECCIONAR CLIENTE..." />
              </SelectTrigger>
              <SelectContent className="z-[150] bg-white">
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre.toUpperCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Actividad</label>
            <Select value={startConfig.actividad} onValueChange={(v) => setStartConfig({ ...startConfig, actividad: v })}>
              <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-transparent font-bold"><SelectValue /></SelectTrigger>
              <SelectContent className="z-[150] bg-white">{['Inspección', 'Avería', 'Mantenimiento', 'Viaje', 'Oficina', 'Obra', 'ALMUERZO'].map(a => <SelectItem key={a} value={a}>{a.toUpperCase()}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={handleMarcarLlegada} className="h-14 bg-slate-900 text-[#165a30] rounded-2xl font-black border-2 border-[#165a30]/30 hover:bg-[#165a30] hover:text-white transition-all shadow-xl shadow-[#165a30]/10"><Play size={20} className="mr-2" /> INICIAR JORNADA</Button>
        </section>
      ) : (
        <section className="bg-emerald-50 p-6 rounded-[2.5rem] border-2 border-emerald-500/20 shadow-xl space-y-4 animate-in slide-in-from-top-4 duration-300 relative overflow-hidden">
          <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-emerald-100 relative z-10 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#165a30] text-white rounded-xl flex items-center justify-center animate-pulse"><Clock size={20} /></div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-black text-emerald-600 uppercase">En curso</p>
                  <ConfirmDialog
                    title="¿Descartar Registro?"
                    description="¿Estás seguro de que deseas DESCARTAR este registro en curso? No se guardará ningún dato y la sesión se cerrará definitivamente."
                    confirmText="SÍ, DESCARTAR"
                    variant="destructive"
                    onConfirm={() => setActiveStop(null)}
                  >
                    <button className="text-red-400 hover:text-red-600 p-1 bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                  </ConfirmDialog>
                </div>
                <p className="font-black text-slate-800 uppercase text-lg leading-tight">{activeStop.clienteNombre}</p>
              </div>
            </div>
            <div className="text-right"><p className="text-3xl font-black text-emerald-600 tabular-nums tracking-tighter">{elapsedTime}h</p></div>
          </div>

          {!isTimerPaused ? (
            <Button onClick={handleDetenerCronometro} className="w-full h-16 bg-red-500 text-white rounded-2xl font-black text-lg gap-3 shadow-xl hover:bg-red-600 transition-all border-b-4 border-red-700 active:border-b-0 active:translate-y-1"><StopCircle size={24} /> DETENER CRONÓMETRO</Button>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-500">
              <div className="p-3 bg-white/50 rounded-2xl flex justify-between px-6">
                <p className="text-[10px] font-black text-slate-400 uppercase">LLEGADA: <span className="text-slate-900">{activeStop.horaLlegada}</span></p>
                <p className="text-[10px] font-black text-slate-400 uppercase">SALIDA: <span className="text-emerald-600">{stopTimeManual}</span></p>
              </div>

              <div className="bg-white p-6 rounded-3xl border-2 border-emerald-100 shadow-inner flex flex-col items-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total a Registrar</p>
                <p className="text-4xl font-black text-slate-900">{elapsedTime}<span className="text-lg ml-1 text-emerald-500">hrs</span></p>
              </div>

              {parseFloat(elapsedTime) >= 8 && activeStop.actividad !== 'ALIMENTACION' && (
                <div className="flex items-center justify-center gap-2 mb-2 bg-amber-50 p-3 rounded-xl border border-amber-200 cursor-pointer" onClick={() => setOmitirAlmuerzo(!omitirAlmuerzo)}>
                  <input type="checkbox" id="omitirAlmuerzo" checked={omitirAlmuerzo} onChange={(e) => setOmitirAlmuerzo(e.target.checked)} onClick={(e) => e.stopPropagation()} className="w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer" />
                  <label htmlFor="omitirAlmuerzo" className="text-[10px] font-black text-amber-800 uppercase tracking-widest cursor-pointer">Sin almuerzo por emergencia</label>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsTimerPaused(false)}
                  className="flex-1 h-14 rounded-2xl font-black text-[10px] tracking-widest bg-white border-2 border-[#165a30] text-[#165a30] hover:bg-[#165a30] hover:text-white transition-all duration-300 gap-2"
                >
                  <RotateCcw size={18} /> REANUDAR
                </Button>
                <ConfirmDialog
                  title="¿Confirmar Descarte?"
                  description="Esta acción es irreversible y limpiará la sesión activa del dispositivo. ¿Estás seguro de que deseas descartar este registro?"
                  confirmText="ELIMINAR SESIÓN"
                  variant="destructive"
                  onConfirm={() => {
                    setActiveStop(null);
                    setIsTimerPaused(false);
                    setStopTimeManual(null);
                  }}
                >
                  <Button
                    variant="ghost"
                    className="flex-1 h-14 rounded-2xl font-black text-[10px] tracking-widest bg-red-50 border-2 border-red-100 text-red-600 hover:bg-red-600 hover:text-white transition-all duration-300 gap-2"
                  >
                    <Trash2 size={18} /> DESCARTAR
                  </Button>
                </ConfirmDialog>
                <Button
                  onClick={handleGuardarSalida}
                  disabled={loading}
                  className="flex-[2] h-14 rounded-2xl font-black text-[10px] tracking-widest bg-[#165a30] text-white border-2 border-[#165a30] hover:bg-white hover:text-[#165a30] transition-all duration-300 shadow-xl shadow-[#165a30]/10 gap-2"
                >
                  <Save size={18} /> {loading ? 'GUARDANDO...' : 'GUARDAR VISITA'}
                </Button>
              </div>

              <Button variant="outline" onClick={() => stopFileInputRef.current?.click()} className={`w-full h-12 rounded-xl border-2 transition-all ${tempHours.motorFile ? 'bg-emerald-100 border-emerald-500 text-emerald-600' : 'bg-white/50 text-slate-400 border-transparent'}`}><Camera size={18} className="mr-2" /> {tempHours.motorFile ? 'EVIDENCIA ARCHIVADA' : 'ADJUNTAR FOTO (OPCIONAL)'}<input type="file" ref={stopFileInputRef} className="hidden" onChange={e => setTempHours({ ...tempHours, motorFile: e.target.files?.[0] })} /></Button>
            </div>
          )}
        </section>
      )}
        </>
      )}

      <div className="space-y-3">
        <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest ml-1">Jornada Actual</h3>
        {visitas.map((v) => (
          <div key={v.id} className="flex items-center justify-between p-5 bg-white border-2 border-slate-100 rounded-[2rem] shadow-sm animate-in slide-in-from-right-4 duration-300">
            <div className="text-left">
              <div className="flex gap-2 items-center mb-1">
                <span className="text-[9px] font-black bg-slate-100 text-slate-400 px-2 py-0.5 rounded uppercase">{v.actividad}</span>
                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${v.estado === 'Aprobado' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>{v.estado}</span>
              </div>
              <p className="font-bold text-slate-800 uppercase text-sm">{v.clienteNombre}</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{v.horaLlegada} - {v.horaSalida}</p>
              <div className="flex flex-col gap-1 mt-2">
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-black border border-slate-100">
                    {v.hNormalesStr} Norm. | {v.hExtrasStr} Ext. | {v.hEspecialesStr} Esp.
                  </span>
                </div>
                {(v as any).descuentoAlimentacion > 0 && (
                  <p className="text-[9px] font-black text-amber-600 mt-1 uppercase">
                    * Observación: se descontó {(v as any).descuentoAlimentacion}h de alimentación
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {v.estado !== 'Aprobado' && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => { setCurrentEditVisit(v); setIsEditModalOpen(true); }}
                  className="h-10 w-10 rounded-xl bg-slate-50 border-slate-200 text-slate-400 hover:bg-[#165a30] hover:text-white transition-all"
                >
                  <Pencil size={18} />
                </Button>
              )}
              <CheckCircle2 size={24} className={v.estado === 'Aprobado' ? 'text-emerald-500' : 'text-slate-200'} />
            </div>
          </div>
        ))}
        {visitas.length === 0 && <div className="py-12 text-center text-slate-300 font-bold uppercase text-[10px] tracking-[0.3em]">Sin registros hoy</div>}
      </div>

      {/* EDIT MODAL */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-[2.5rem] p-8 border-none shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <DialogTitle className="font-black text-xl text-slate-900 uppercase tracking-tighter">Editar Registro</DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsEditModalOpen(false)} className="rounded-full"><X size={20} /></Button>
          </div>
          {currentEditVisit && (
            <div className="space-y-6">
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</p>
                <p className="font-bold text-slate-800">{currentEditVisit.clienteNombre}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-900 uppercase ml-2 tracking-widest">Hora Llegada</label>
                  <Input value={currentEditVisit.horaLlegada} onChange={e => setCurrentEditVisit({ ...currentEditVisit, horaLlegada: e.target.value })} className="h-14 rounded-2xl text-center font-black text-slate-900 bg-slate-50 border-slate-200" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-900 uppercase ml-2 tracking-widest">Hora Salida</label>
                  <Input value={currentEditVisit.horaSalida} onChange={e => setCurrentEditVisit({ ...currentEditVisit, horaSalida: e.target.value })} className="h-14 rounded-2xl text-center font-black text-slate-900 bg-slate-50 border-slate-200" />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 h-14 rounded-2xl font-black text-[10px] tracking-widest bg-white border-2 border-[#165a30] text-[#165a30] hover:bg-[#165a30] hover:text-white transition-all duration-300"
                >
                  CANCELAR
                </Button>
                <Button
                  onClick={async () => {
                    if (!canUseCloud) return toast({ variant: 'destructive', title: 'Sin conexión' });
                    setLoading(true);
                    try {
                      const arrivalDate = parse(currentEditVisit.horaLlegada, 'HH:mm', new Date());
                      const stopDate = parse(currentEditVisit.horaSalida, 'HH:mm', new Date());
                      let diffMinutes = differenceInMinutes(stopDate, arrivalDate);
                      if (diffMinutes < 0) diffMinutes += 1440; // Soporte básico para cruce de medianoche en edición
                      const total = diffMinutes > 0 ? diffMinutes / 60 : 0;
                      
                      // Para calcular el accumulated de forma justa en edición, restamos el valor de la visita actual de la suma
                      const accumulatedNormalHours = visitas.filter(v => v.id !== currentEditVisit.id).reduce((sum, v) => sum + (v.horasNormales || 0), 0);
                      const breakdown = calculateHoursBreakdown(total, reportDate, accumulatedNormalHours);

                      const docRef = doc(firestore!, "bitacora_visitas", currentEditVisit.id);
                      await updateDoc(docRef, {
                        horaLlegada: currentEditVisit.horaLlegada,
                        horaSalida: currentEditVisit.horaSalida,
                        horasNormales: breakdown.normal,
                        horasExtras: breakdown.extra,
                        horasEspeciales: breakdown.special,
                        hNormalesStr: breakdown.normal.toFixed(2),
                        hExtrasStr: breakdown.extra.toFixed(2),
                        hEspecialesStr: breakdown.special.toFixed(2)
                      });

                      setVisitas(prev => prev.map(v => v.id === currentEditVisit.id ? {
                        ...v,
                        ...currentEditVisit,
                        horasNormales: breakdown.normal,
                        horasExtras: breakdown.extra,
                        horasEspeciales: breakdown.special,
                        hNormalesStr: breakdown.normal.toFixed(2),
                        hExtrasStr: breakdown.extra.toFixed(2),
                        hEspecialesStr: breakdown.special.toFixed(2)
                      } : v));

                      setIsEditModalOpen(false);
                      toast({ title: 'Actualizado correctamente ✅' });
                    } catch (e) {
                      console.error(e);
                      toast({ variant: 'destructive', title: 'Error al actualizar' });
                    } finally { setLoading(false); }
                  }}
                  disabled={loading}
                  className="flex-[2] h-14 rounded-2xl font-black text-[10px] tracking-widest bg-[#165a30] text-white border-2 border-[#165a30] hover:bg-white hover:text-[#165a30] transition-all duration-300 shadow-lg shadow-[#165a30]/10"
                >
                  {loading ? <Loader2 className="animate-spin" /> : 'GUARDAR CAMBIOS'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
