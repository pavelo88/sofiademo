'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { OT_STATUS } from '@/lib/constants';
import { calculateHoursBreakdown, formatTechnicianName } from '@/lib/hours-utils';
import { buildVisitId } from '@/app/inspection/lib/visit-record';
import { differenceInMinutes, format, parse } from 'date-fns';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';

type RowData = {
  id: string;
  orderId: string;
  clienteId: string;
  clienteNombre: string;
  actividad: string;
  horaLlegada: string;
  horaSalida: string;
  omitirAlmuerzo?: boolean;
};

interface Props {
  reportDate: Date;
  clients: any[];
  activeOTs: any[];
  inspectorEmail: string;
  user: any;
  onSuccess: (nuevasVisitas: any[]) => void;
  existingVisitas: any[];
}

export default function BitacoraMultiRowForm({ reportDate, clients, activeOTs, inspectorEmail, user, onSuccess, existingVisitas }: Props) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [rows, setRows] = useState<RowData[]>([{
    id: Date.now().toString(),
    orderId: '',
    clienteId: '',
    clienteNombre: '',
    actividad: 'Inspección',
    horaLlegada: '',
    horaSalida: '',
    omitirAlmuerzo: false
  }]);
  const [loading, setLoading] = useState(false);

  const addRow = () => {
    setRows([...rows, {
      id: Date.now().toString(),
      orderId: '',
      clienteId: '',
      clienteNombre: '',
      actividad: 'Inspección',
      horaLlegada: '',
      horaSalida: '',
      omitirAlmuerzo: false
    }]);
  };

  const removeRow = (id: string) => {
    setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: string, field: keyof RowData, value: any) => {
    setRows(rows.map(r => {
      if (r.id === id) {
        const newRow = { ...r, [field]: value };
        // Si seleccionan una OT, autocompletamos el cliente
        if (field === 'orderId' && value !== 'none' && value !== '') {
          const ot = activeOTs.find(o => o.id === value);
          if (ot) {
            newRow.clienteId = ot.clienteId || '';
            newRow.clienteNombre = ot.clienteNombre || ot.cliente || '';
          }
        } else if (field === 'orderId' && value === 'none') {
          newRow.orderId = '';
        }

        if (field === 'clienteId') {
          newRow.clienteNombre = value === 'OFICINA' ? 'OFICINA' : clients.find(c => c.id === value)?.nombre || '';
        }
        return newRow;
      }
      return r;
    }));
  };

  const handleSave = async () => {
    // Validaciones
    const validRows = rows.filter(r => r.clienteId && r.actividad && r.horaLlegada && r.horaSalida);
    if (validRows.length === 0) {
      return toast({ variant: 'destructive', title: 'Error', description: 'No hay filas válidas para guardar. Completa todos los campos.' });
    }

    setLoading(true);
    try {
      const batch = writeBatch(firestore!);
      const nuevasVisitas: any[] = [];
      let currentAccumulatedNormal = existingVisitas.reduce((sum, v) => sum + (v.horasNormales || 0), 0);

      let didCrossDay = false;

      // Ordenar las filas por horaLlegada para procesar secuencialmente (cronológicamente)
      const sortedRows = [...validRows].sort((a, b) => a.horaLlegada.localeCompare(b.horaLlegada));

      for (const row of sortedRows) {
        const arrivalDate = parse(row.horaLlegada, 'HH:mm', reportDate);
        const stopDate = parse(row.horaSalida, 'HH:mm', reportDate);

        let totalRealDiff = differenceInMinutes(stopDate, arrivalDate);
        if (totalRealDiff < 0) totalRealDiff += 1440;
        const isCrossDay = differenceInMinutes(stopDate, arrivalDate) < 0;

        const shouldDeductAlmuerzo = totalRealDiff >= 480 && !row.omitirAlmuerzo && row.actividad !== 'ALIMENTACION';

        if (isCrossDay) {
          didCrossDay = true;
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
          
          const total1 = diff1 > 0 ? (row.actividad === 'ALMUERZO' ? 0 : diff1 / 60) : 0;
          const breakdown1 = calculateHoursBreakdown(total1, reportDate, currentAccumulatedNormal);
          currentAccumulatedNormal += breakdown1.normal;

          const id1 = buildVisitId(inspectorEmail, user?.displayName, reportDate) + `_${Math.floor(Math.random() * 10000)}_P1`;
          const docData1 = {
            id: id1, clienteId: row.clienteId, clienteNombre: row.clienteNombre, actividad: row.actividad,
            horaLlegada: row.horaLlegada, horaSalida: '23:59',
            horasNormales: breakdown1.normal, horasExtras: breakdown1.extra, horasEspeciales: breakdown1.special,
            hNormalesStr: breakdown1.normal.toFixed(2), hExtrasStr: breakdown1.extra.toFixed(2), hEspecialesStr: breakdown1.special.toFixed(2),
            estado: 'Registrado', fecha: reportDate, inspectorId: inspectorEmail,
            inspectorNombre: formatTechnicianName(user?.displayName || inspectorEmail || ''),
            fechaStr: format(reportDate, 'yyyy-MM-dd'), orderId: row.orderId || null, createdAt: serverTimestamp(),
            descuentoAlimentacion: descuento1 > 0 ? descuento1 / 60 : 0
          };
          batch.set(doc(firestore!, "bitacora_visitas", id1), docData1);
          nuevasVisitas.push(docData1);

          const nextDay = new Date(reportDate);
          nextDay.setDate(nextDay.getDate() + 1);
          const startOfDay = parse('00:00', 'HH:mm', reportDate);
          let diff2 = differenceInMinutes(stopDate, startOfDay);
          if (descuento2 > 0) diff2 -= descuento2;
          
          const total2 = diff2 > 0 ? (row.actividad === 'ALMUERZO' ? 0 : diff2 / 60) : 0;
          const breakdown2 = {
            normal: 0,
            extra: 0,
            special: Number(total2.toFixed(2))
          };

          const id2 = buildVisitId(inspectorEmail, user?.displayName, nextDay) + `_${Math.floor(Math.random() * 10000)}_P2`;
          const docData2 = {
            id: id2, clienteId: row.clienteId, clienteNombre: row.clienteNombre, actividad: row.actividad,
            horaLlegada: '00:00', horaSalida: row.horaSalida,
            horasNormales: breakdown2.normal, horasExtras: breakdown2.extra, horasEspeciales: breakdown2.special,
            hNormalesStr: breakdown2.normal.toFixed(2), hExtrasStr: breakdown2.extra.toFixed(2), hEspecialesStr: breakdown2.special.toFixed(2),
            estado: 'Registrado', fecha: nextDay, inspectorId: inspectorEmail,
            inspectorNombre: formatTechnicianName(user?.displayName || inspectorEmail || ''),
            fechaStr: format(nextDay, 'yyyy-MM-dd'), orderId: row.orderId || null, createdAt: serverTimestamp(),
            descuentoAlimentacion: descuento2 > 0 ? descuento2 / 60 : 0
          };
          batch.set(doc(firestore!, "bitacora_visitas", id2), docData2);
        } else {
          let finalDiff = totalRealDiff;
          if (shouldDeductAlmuerzo) finalDiff -= 60;
          let total = finalDiff > 0 ? (row.actividad === 'ALMUERZO' ? 0 : finalDiff / 60) : 0;
          const breakdown = calculateHoursBreakdown(total, reportDate, currentAccumulatedNormal);
          currentAccumulatedNormal += breakdown.normal;

          const docId = buildVisitId(inspectorEmail, user?.displayName, reportDate) + `_${Math.floor(Math.random() * 10000)}`;
          const docData = {
            id: docId, clienteId: row.clienteId, clienteNombre: row.clienteNombre, actividad: row.actividad,
            horaLlegada: row.horaLlegada, horaSalida: row.horaSalida,
            horasNormales: breakdown.normal, horasExtras: breakdown.extra, horasEspeciales: breakdown.special,
            hNormalesStr: breakdown.normal.toFixed(2), hExtrasStr: breakdown.extra.toFixed(2), hEspecialesStr: breakdown.special.toFixed(2),
            estado: 'Registrado', fecha: reportDate, inspectorId: inspectorEmail,
            inspectorNombre: formatTechnicianName(user?.displayName || inspectorEmail || ''),
            fechaStr: format(reportDate, 'yyyy-MM-dd'), orderId: row.orderId || null, createdAt: serverTimestamp(),
            descuentoAlimentacion: shouldDeductAlmuerzo ? 1 : 0
          };

          batch.set(doc(firestore!, "bitacora_visitas", docId), docData);
          nuevasVisitas.push(docData);
        }

        if (shouldDeductAlmuerzo) {
           const idAlm = buildVisitId(inspectorEmail, user?.displayName, reportDate) + '_ALM' + Date.now() + Math.floor(Math.random() * 1000);
           const docDataAlm = {
             id: idAlm, clienteId: row.clienteId, clienteNombre: row.clienteNombre, actividad: 'ALIMENTACION',
             horaLlegada: '13:00', horaSalida: '14:00',
             horasNormales: 0, horasExtras: 0, horasEspeciales: 0,
             hNormalesStr: '0.00', hExtrasStr: '0.00', hEspecialesStr: '0.00',
             estado: 'Registrado', fecha: reportDate,
             inspectorId: inspectorEmail, inspectorNombre: formatTechnicianName(user?.displayName || inspectorEmail || ''),
             fechaStr: format(reportDate, 'yyyy-MM-dd'), orderId: row.orderId || null, createdAt: serverTimestamp()
           };
           batch.set(doc(firestore!, "bitacora_visitas", idAlm), docDataAlm);
           nuevasVisitas.push(docDataAlm);
        }

        if (row.orderId && row.orderId !== 'none') {
          batch.update(doc(firestore!, 'ordenes_trabajo', row.orderId), { estado: OT_STATUS.EN_PROCESO });
        }
      }

      await batch.commit();
      if (didCrossDay) {
        toast({ title: 'VISITAS GUARDADAS ✅', description: 'Se generaron registros automáticos para el día siguiente por cruce de medianoche.' });
      } else {
        toast({ title: '¡Jornada Guardada!', description: `Se han registrado ${validRows.length} actividades.` });
      }
      onSuccess(nuevasVisitas);
      setRows([{
        id: Date.now().toString(),
        orderId: '',
        clienteId: '',
        clienteNombre: '',
        actividad: 'Inspección',
        horaLlegada: '',
        horaSalida: ''
      }]);

    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error al guardar', description: 'Revisa tu conexión e intenta de nuevo.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border-2 border-slate-100 animate-in zoom-in-95 duration-300">
      <div className="mb-4">
        <h3 className="font-black text-slate-900 uppercase text-sm tracking-widest flex items-center gap-2">
          Registro Múltiple
        </h3>
        <p className="text-xs text-slate-500">Añade varias tareas de tu día y guárdalas juntas.</p>
      </div>

      <div className="overflow-x-auto custom-scroll pb-4">
        <table className="w-full text-left min-w-[800px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b-2 border-slate-100">
              <th className="p-3 w-[25%]">OT (Opcional)</th>
              <th className="p-3 w-[25%]">Cliente</th>
              <th className="p-3 w-[20%]">Actividad</th>
              <th className="p-3 w-[12%] text-center">Inicio</th>
              <th className="p-3 w-[12%] text-center">Fin</th>
              <th className="p-3 w-[6%] text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-2">
                  <Select value={row.orderId || 'none'} onValueChange={(v) => updateRow(row.id, 'orderId', v)}>
                    <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs"><SelectValue placeholder="Libre" /></SelectTrigger>
                    <SelectContent className="z-[150] bg-white">
                      <SelectItem value="none">LIBRE</SelectItem>
                      {activeOTs.map(ot => (
                        <SelectItem key={ot.id} value={ot.id}>{ot.id} - {ot.clienteNombre || ot.cliente}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-2">
                  <Select value={row.clienteId} disabled={!!row.orderId} onValueChange={(v) => updateRow(row.id, 'clienteId', v)}>
                    <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent className="z-[150] bg-white">
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-2">
                  <Select value={row.actividad} onValueChange={(v) => updateRow(row.id, 'actividad', v)}>
                    <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[150] bg-white">
                      {['Inspección', 'Avería', 'Mantenimiento', 'Viaje', 'Oficina', 'Obra', 'ALMUERZO'].map(a => <SelectItem key={a} value={a}>{a.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-2">
                  <Input type="time" value={row.horaLlegada} onChange={(e) => updateRow(row.id, 'horaLlegada', e.target.value)} className="h-12 rounded-xl bg-slate-50 border-slate-200 font-black text-center" />
                </td>
                <td className="p-2">
                  <Input type="time" value={row.horaSalida} onChange={(e) => updateRow(row.id, 'horaSalida', e.target.value)} className="h-12 rounded-xl bg-slate-50 border-slate-200 font-black text-center" />
                  {row.horaLlegada && row.horaSalida && (() => {
                    try {
                      const d1 = parse(row.horaLlegada, 'HH:mm', new Date());
                      const d2 = parse(row.horaSalida, 'HH:mm', new Date());
                      let diff = differenceInMinutes(d2, d1);
                      if (diff < 0) diff += 1440;
                      if (diff >= 480 && row.actividad !== 'ALMUERZO' && row.actividad !== 'ALIMENTACION') {
                        return (
                          <div className="mt-2 flex items-center justify-center gap-1 cursor-pointer bg-amber-50 p-1.5 rounded-lg border border-amber-200" onClick={() => updateRow(row.id, 'omitirAlmuerzo', !row.omitirAlmuerzo)}>
                            <input type="checkbox" checked={row.omitirAlmuerzo || false} onChange={(e) => updateRow(row.id, 'omitirAlmuerzo', e.target.checked)} onClick={(e) => e.stopPropagation()} className="w-3 h-3 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer" />
                            <span className="text-[8px] text-amber-700 font-black uppercase leading-none cursor-pointer">Sin almuerzo</span>
                          </div>
                        );
                      }
                    } catch(e) {}
                    return null;
                  })()}
                </td>
                <td className="p-2 text-center">
                  <Button variant="ghost" size="icon" onClick={() => removeRow(row.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 size={16} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-4 pt-4 border-t-2 border-slate-100">
        <Button onClick={addRow} variant="outline" className="h-12 rounded-xl border-dashed border-2 border-emerald-500/50 text-emerald-600 hover:bg-emerald-50 font-black text-xs uppercase tracking-widest px-6 w-full sm:w-auto">
          <Plus size={16} className="mr-2" /> Agregar Fila
        </Button>
        <Button onClick={handleSave} disabled={loading} className="h-14 rounded-2xl bg-[#165a30] text-white hover:bg-[#062113] font-black text-xs uppercase tracking-widest px-8 shadow-xl shadow-[#165a30]/20 w-full sm:w-auto transition-all active:scale-95">
          {loading ? <Loader2 className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
          Guardar Jornada
        </Button>
      </div>
    </div>
  );
}
