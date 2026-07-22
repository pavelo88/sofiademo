'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useFirestore } from '@/firebase';
import { format } from 'date-fns';
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import {
  AlertCircle,
  Clock,
  Download,
  Loader2,
  Mail,
  MessageSquare,
  Pencil,
  PhoneCall // Añadido para el icono
  ,



  Search
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAdminHeader } from './AdminHeaderContext';

type ContactRequest = {
  id: string;
  name: string;
  phone: string; // CORREGIDO: Ahora acepta el teléfono
  email: string;
  technicalRequest: string;
  status: 'Pendiente' | 'En Gestión' | 'Atendido';
  observations?: string;
  createdAt: any;
};

export default function WebRequests() {
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRequest, setEditingRequest] = useState<ContactRequest | null>(null);
  const db = useFirestore();

  const handleExport = useCallback(() => {
    const dataToExport = requests.map(r => ({
      Fecha: r.createdAt?.toDate().toLocaleString('es-ES') || 'N/A',
      Nombre: r.name,
      Telefono: r.phone || 'No provisto', // CORREGIDO: Exporta el teléfono
      Email: r.email,
      Requerimiento: r.technicalRequest,
      Estado: r.status,
      Observaciones: r.observations || 'Sin notas'
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Solicitudes Web");
    XLSX.writeFile(workbook, `EnergyEngine_Solicitudes_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  }, [requests]);

  const headerAction = useMemo(() => (
    <Button onClick={handleExport} variant="outline" className="rounded-xl font-bold uppercase text-xs tracking-widest border-slate-200 hover:bg-slate-50 text-slate-800 dark:text-white">
      <Download className="mr-2" size={16} />
      Exportar Historial
    </Button>
  ), [handleExport]);

  useAdminHeader('Solicitudes de Contacto', headerAction);

  useEffect(() => {
    if (!db) return;
    // CORREGIDO: 'contact_requests' para que coincida con el formulario
    const q = query(collection(db, 'contact_requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContactRequest));
      setRequests(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [db]);

  const filteredRequests = requests.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.phone?.includes(searchTerm) || // Ahora también puedes buscar por teléfono
    r.technicalRequest.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdateStatus = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingRequest || !db) return;

    const formData = new FormData(e.currentTarget);
    const status = formData.get('status') as ContactRequest['status'];
    const observations = formData.get('observations') as string;

    try {
      // CORREGIDO: 'contact_requests' aquí también
      await updateDoc(doc(db, 'contact_requests', editingRequest.id), {
        status,
        observations
      });
      setEditingRequest(null);
    } catch (error) {
      console.error("Error updating request:", error);
    }
  };

  const getStatusBadge = (status: ContactRequest['status']) => {
    switch (status) {
      case 'Pendiente': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'En Gestión': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'Atendido': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="relative group">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={20} />
        <Input
          placeholder="Buscar por nombre, teléfono, email o mensaje..."
          className="pl-14 h-16 rounded-[1.5rem] bg-white border-slate-100 shadow-sm font-bold text-slate-700 placeholder:text-slate-300 outline-none focus-visible:ring-primary focus-visible:ring-2"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col justify-center items-center h-80 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sincronizando Base de Datos...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50 bg-slate-50/30">
                  <th className="p-6">Registro Temporal</th>
                  <th className="p-6">Información Cliente</th>
                  <th className="p-6">Detalle del Requerimiento</th>
                  <th className="p-6">Estado Gestión</th>
                  <th className="p-6 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="p-6">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock size={12} className="text-slate-300" />
                        <span className="text-xs font-black text-slate-700">{req.createdAt?.toDate().toLocaleDateString('es-ES') || 'N/A'}</span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase ml-5">
                        {req.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="font-black text-slate-800 leading-tight text-sm uppercase tracking-tight">{req.name}</div>

                      {/* CORREGIDO: Muestra el teléfono debajo del nombre */}
                      <div className="text-[11px] font-bold text-primary flex items-center gap-1.5 mt-1">
                        <PhoneCall size={10} /> {req.phone || 'Sin teléfono'}
                      </div>

                      <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5 mt-1">
                        <Mail size={12} className="text-primary/60" /> {req.email}
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="text-xs font-medium text-slate-500 line-clamp-2 max-w-sm bg-slate-50/50 p-3 rounded-2xl border border-slate-100 group-hover:bg-white transition-colors">
                        <span className="text-primary font-black mr-1">“</span>{req.technicalRequest}<span className="text-primary font-black ml-1">”</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className={`px-4 py-1.5 text-[9px] font-black rounded-full uppercase tracking-tighter border ${getStatusBadge(req.status)}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="p-6 text-right">
                      <button
                        onClick={() => setEditingRequest(req)}
                        className="bg-white border border-slate-200 p-3 rounded-2xl text-slate-400 hover:text-primary hover:border-primary/30 hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95"
                        title="Gestionar Solicitud"
                      >
                        <Pencil size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingRequest && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex justify-center items-center z-50 p-4">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-2xl animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                  <MessageSquare className="text-primary" />
                  Actualizar Gestión
                </h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2 border-l-2 border-primary pl-3">REQUERIMIENTO ID: {editingRequest.id}</p>
              </div>
              <button
                onClick={() => setEditingRequest(null)}
                className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all active:scale-90"
              >
                <AlertCircle size={24} />
              </button>
            </div>

            <div className="space-y-8">
              <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Datos del Cliente</span>
                  <div className="flex gap-2">
                    <span className="text-[9px] font-black bg-white px-3 py-1 rounded-full text-slate-500 border border-slate-100">{editingRequest.name}</span>
                    <span className="text-[9px] font-black bg-primary/10 px-3 py-1 rounded-full text-primary border border-primary/20">{editingRequest.phone}</span>
                  </div>
                </div>
                <p className="text-sm text-slate-700 font-medium leading-relaxed italic border-l-4 border-slate-200 pl-4">&quot;{editingRequest.technicalRequest}&quot;</p>
              </div>

              <form onSubmit={handleUpdateStatus} className="space-y-8">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado de la Solicitud</Label>
                  <Select name="status" defaultValue={editingRequest.status}>
                    <SelectTrigger className="h-14 rounded-2xl border-slate-100 bg-slate-50 font-black text-slate-700 shadow-sm focus:ring-primary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl shadow-2xl border-none">
                      <SelectItem value="Pendiente" className="font-bold">🔴 Pendiente de Revisión</SelectItem>
                      <SelectItem value="En Gestión" className="font-bold">🔵 En Gestión / Contactado</SelectItem>
                      <SelectItem value="Atendido" className="font-bold">🟢 Finalizado / Atendido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observaciones de Gestión (Notas de Ingeniería)</Label>
                  <Textarea
                    name="observations"
                    defaultValue={editingRequest.observations || ''}
                    placeholder="Escriba aquí los pasos realizados (ej. se llamó al cliente, se envió presupuesto, pendiente de piezas)..."
                    className="min-h-[160px] rounded-[1.5rem] border-slate-100 bg-slate-50 focus:bg-white font-medium text-slate-700 p-6 shadow-inner transition-all focus:ring-primary"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="button" variant="ghost" onClick={() => setEditingRequest(null)} className="flex-1 h-14 rounded-2xl font-bold uppercase text-xs tracking-widest">Descartar</Button>
                  <Button type="submit" className="flex-1 h-14 rounded-2xl font-black uppercase text-xs tracking-widest bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 active:scale-95 transition-all">Guardar Bitácora</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
