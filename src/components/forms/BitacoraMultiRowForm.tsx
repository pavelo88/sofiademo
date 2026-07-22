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
    horaSalida: ''
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
      horaSalida: ''
    }]);
  };

  const removeRow = (id: string) => {
    setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: string, field: keyof RowData, value: string) => {
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

      // Ordenar las filas por horaLlegada para procesar secuencialmente (cronológicamente)
      const sortedRows = [...validRows].sort((a, b) => a.horaLlegada.localeCompare(b.horaLlegada));

      for (const row of sortedRows) {
        const arrivalDate = parse(row.horaLlegada, 'HH:mm', new Date());
        const stopDate = parse(row.horaSalida, 'HH:mm', new Date());
        let diffMinutes = differenceInMinutes(stopDate, arrivalDate);
        if (diffMinutes < 0) diffMinutes += 1440; // Cruce de medianoche
        
        let total = diffMinutes > 0 ? diffMinutes / 60 : 0;
        
        // Si es ALMUERZO, no suma tiempo a la producción.
        if (row.actividad === 'ALMUERZO') {
            total = 0;
        }

        const breakdown = calculateHoursBreakdown(total, reportDate, currentAccumulatedNormal);
        
        // Actualizamos el acumulado con las horas normales de esta fila
        currentAccumulatedNormal += breakdown.normal;

        // Utilizamos Date.now() + index para asegurar IDs únicos en el batch de un mismo día
        const uniqueSuffix = Math.floor(Math.random() * 10000).toString();
        const docId = buildVisitId(inspectorEmail, user?.displayName, reportDate) + `_${uniqueSuffix}`;

        const docData = {
          id: docId,
          clienteId: row.clienteId,
          clienteNombre: row.clienteNombre,
          actividad: row.actividad,
          horaLlegada: row.horaLlegada,
          horaSalida: row.horaSalida,
          horasNormales: breakdown.normal,
          horasExtras: breakdown.extra,
          horasEspeciales: breakdown.special,
          hNormalesStr: breakdown.normal.toFixed(2),
          hExtrasStr: breakdown.extra.toFixed(2),
          hEspecialesStr: breakdown.special.toFixed(2),
          estado: 'Registrado',
          fecha: reportDate,
          inspectorId: inspectorEmail,
          inspectorNombre: formatTechnicianName(user?.displayName || inspectorEmail || ''),
          fechaStr: format(reportDate, 'yyyy-MM-dd'),
          orderId: row.orderId || null,
          createdAt: serverTimestamp()
        };

        const docRef = doc(firestore!, "bitacora_visitas", docId);
        batch.set(docRef, docData);
        
        if (row.orderId && row.orderId !== 'none') {
           const otRef = doc(firestore!, "ordenes_trabajo", row.orderId);
           batch.update(otRef, { estado: OT_STATUS.EN_PROCESO });
        }

        nuevasVisitas.push(docData);
      }

      await batch.commit();
      toast({ title: '¡Jornada Guardada!', description: `Se han registrado ${validRows.length} actividades.` });
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
          Registro Múltiple (Batch)
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
          Guardar Jornada en Batch
        </Button>
      </div>
    </div>
  );
}
