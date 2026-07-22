'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore } from '@/firebase';
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { CheckCircle2, Loader2, Mail, MapPin, Pencil, Phone, PlusCircle, Search, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdminHeader } from './AdminHeaderContext';

type Client = {
  id: string;
  nombre: string;
  direccion: string;
  email: string;
  telefono: string;
  status: 'approved' | 'preaprobado';
  cif?: string;
  contacto?: string;
  cp?: string;
  ciudad?: string;
  direccion_facturacion?: string;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [updatingClientId, setUpdatingClientId] = useState<string | null>(null);
  const db = useFirestore();

  const openModalForAdd = useCallback(() => {
    setEditingClient(null);
    setIsModalOpen(true);
  }, []);

  const headerAction = useMemo(() => (
    <Button onClick={openModalForAdd} className="rounded-xl font-bold uppercase text-xs tracking-widest bg-primary text-white">
        <PlusCircle className="mr-2" size={16}/>
        Añadir Cliente
    </Button>
  ), [openModalForAdd]);

  useAdminHeader('Gestión de Clientes', headerAction);

  useEffect(() => {
    if (!db) return;
    const unsubscribe = onSnapshot(collection(db, 'clientes'), (snapshot) => {
      const clientsList = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Client, 'id'>) }));
      setClients(clientsList);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [db]);

  const filteredClients = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return clients;
    return clients.filter(c => 
      c.nombre.toLowerCase().includes(term) ||
      (c.cif && c.cif.toLowerCase().includes(term)) ||
      (c.ciudad && c.ciudad.toLowerCase().includes(term)) ||
      (c.direccion && c.direccion.toLowerCase().includes(term)) ||
      (c.contacto && c.contacto.toLowerCase().includes(term))
    );
  }, [clients, searchTerm]);

  const syncClientReferences = useCallback(async (oldId: string, newId: string, clientData: { nombre: string; direccion: string }) => {
    if (!db) return;
    
    const collectionsToSync = [
      { name: 'informes', idField: 'clienteId' },
      { name: 'ordenes_trabajo', idField: 'clienteId' },
      { name: 'gastos_detalle', idField: 'clienteId' },
      { name: 'bitacora_visitas', idField: 'clienteId' }
    ];

    for (const colInfo of collectionsToSync) {
      const q = query(collection(db, colInfo.name), where(colInfo.idField, '==', oldId));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((docSnap) => {
          const updateData: any = {
            [colInfo.idField]: newId,
            clienteNombre: clientData.nombre,
          };
          // Campos adicionales específicos para informes
          if (colInfo.name === 'informes') {
            updateData.cliente = clientData.nombre;
            updateData.instalacion = clientData.direccion || '';
          }
          batch.update(docSnap.ref, updateData);
        });
        await batch.commit();
      }
    }
  }, [db]);

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const clientData = {
        nombre: (formData.get('nombre') as string).trim(),
        direccion: (formData.get('direccion') as string).trim(),
        email: (formData.get('email') as string).trim(),
        telefono: (formData.get('telefono') as string).trim(),
        cif: (formData.get('cif') as string || '').trim(),
        contacto: (formData.get('contacto') as string || '').trim(),
        cp: (formData.get('cp') as string || '').trim(),
        ciudad: (formData.get('ciudad') as string || '').trim(),
        direccion_facturacion: (formData.get('direccion_facturacion') as string || '').trim(),
        status: 'approved' as const,
    };

    if (!clientData.nombre) return;

    setIsSavingClient(true);
    try {
      const newId = clientData.nombre.toUpperCase();
      
      if (editingClient) {
        if (editingClient.id !== newId) {
          // CAMBIO DE ID (RE-NOMBRAR): Crear nuevo, actualizar referencias y borrar viejo
          await setDoc(doc(db, "clientes", newId), clientData);
          await syncClientReferences(editingClient.id, newId, clientData);
          await deleteDoc(doc(db, 'clientes', editingClient.id));
        } else {
          // MISMO ID: Solo actualizar datos
          const clientRef = doc(db, 'clientes', editingClient.id);
          await updateDoc(clientRef, clientData);
          await syncClientReferences(editingClient.id, newId, clientData);
        }
      } else {
        // NUEVO CLIENTE: Usar el nombre en mayúsculas como ID
        await setDoc(doc(db, "clientes", newId), clientData);
      }
      closeModal();
    } catch (error) {
      console.error("Error al guardar cliente: ", error);
    } finally {
      setIsSavingClient(false);
    }
  };

  const handleDeleteClient = useCallback(async (client: Client) => {
    if (window.confirm(`¿Seguro que quieres eliminar a ${client.nombre}?`)) {
      try {
        await deleteDoc(doc(db, 'clientes', client.id));
      } catch (error) {
        console.error("Error al eliminar cliente: ", error);
      }
    }
  }, [db]);

  const handleApproveClient = useCallback(async (client: Client) => {
    try {
      setUpdatingClientId(client.id);
      await updateDoc(doc(db, 'clientes', client.id), { status: 'approved' });
      await syncClientReferences(client.id, client.id, { nombre: client.nombre, direccion: client.direccion });
    } catch (error) {
      console.error("Error al aprobar cliente: ", error);
    } finally {
      setUpdatingClientId(null);
    }
  }, [db, syncClientReferences]);

  const openModalForEdit = useCallback((client: Client) => {
    setEditingClient(client);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingClient(null);
  }, []);

  return (
    <div className="animate-in fade-in duration-500">
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full max-w-md">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <Input 
                      placeholder="BUSCAR POR NOMBRE, CIF, CIUDAD..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-11 pr-11 h-12 rounded-2xl border-slate-100 bg-slate-50 focus:bg-white transition-all font-bold text-xs uppercase tracking-widest text-slate-900"
                  />
                  {searchTerm && (
                      <button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-slate-600">
                          <X className="h-4 w-4" />
                      </button>
                  )}
              </div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {filteredClients.length} Clientes encontrados
              </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40">
                <Loader2 className="animate-spin text-primary h-10 w-10" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:hidden">
                {filteredClients.map(client => (
                  <Card key={client.id} className="rounded-3xl p-6 space-y-4 flex flex-col border-slate-100 shadow-none bg-slate-50">
                    <div className="flex-grow space-y-3">
                      <h3 className="font-black text-lg text-slate-800 tracking-tight">{client.nombre}</h3>
                      <div className="space-y-2 text-xs font-bold text-slate-400">
                        {client.direccion && <p className="flex items-center gap-2 uppercase tracking-widest"><MapPin size={14} className="text-primary" /> {client.direccion}</p>}
                        {client.email && <p className="flex items-center gap-2 uppercase tracking-widest"><Mail size={14} className="text-primary" /> {client.email}</p>}
                        {client.telefono && <p className="flex items-center gap-2 uppercase tracking-widest"><Phone size={14} className="text-primary" /> {client.telefono}</p>}
                        {client.status === 'preaprobado' && (
                          <div className="pt-2">
                             <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-200">Pre-aprobado</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                        {client.status === 'preaprobado' && (
                          <Button variant="default" size="sm" onClick={() => handleApproveClient(client)} disabled={updatingClientId === client.id} className="bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest h-8 px-4 disabled:opacity-60">
                            {updatingClientId === client.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Aprobar'}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => openModalForEdit(client)} className="hover:bg-white"><Pencil size={18}/></Button>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteClient(client)}><Trash2 size={18}/></Button>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                      <th className="pb-4">Nombre Comercial</th>
                      <th className="pb-4">Ubicación</th>
                      <th className="pb-4">Contacto</th>
                      <th className="pb-4">Estado</th>
                      <th className="pb-4 text-center">Gestión</th>
                    </tr>
                  </thead>
                  <tbody>
                      {filteredClients.map(client => (
                      <tr key={client.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                          <td className="py-4 font-black text-slate-700">{client.nombre}</td>
                          <td className="py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">{client.direccion || 'No registrada'}</td>
                          <td className="py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
                            <div className="flex flex-col gap-1">
                              <span>{client.email || '-'}</span>
                              <span>{client.telefono || '-'}</span>
                            </div>
                          </td>
                          <td className="py-4">
                             {client.status === 'preaprobado' ? (
                               <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-200">Pendiente</span>
                             ) : (
                               <span className="bg-slate-100 text-slate-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200">Aprobado</span>
                             )}
                          </td>
                          <td className="py-4 text-center">
                              <div className="flex justify-center gap-2 items-center">
                                {client.status === 'preaprobado' && (
                                  <button onClick={() => handleApproveClient(client)} disabled={updatingClientId === client.id} className="p-2 bg-emerald-50 text-emerald-500 rounded-lg hover:bg-emerald-500 hover:text-white transition-all shadow-sm disabled:opacity-50">
                                    {updatingClientId === client.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                  </button>
                                )}
                                <button onClick={() => openModalForEdit(client)} className="p-2 text-slate-300 hover:text-primary transition-colors"><Pencil size={18}/></button>
                                <button onClick={() => handleDeleteClient(client)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                              </div>
                          </td>
                      </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {isModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-lg animate-in zoom-in duration-200">
                    <h2 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tighter">{editingClient ? 'Editar Ficha Cliente' : 'Nuevo Registro de Cliente'}</h2>
                    <form onSubmit={handleFormSubmit} className="grid grid-cols-1 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="nombre" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Empresa Completo</Label>
                            <Input required id="nombre" name="nombre" placeholder="Nombre completo..." defaultValue={editingClient?.nombre || ''} className="rounded-xl border-slate-100 bg-slate-50 focus:bg-white transition-all font-bold text-slate-900" />
                        </div>

                        <div className="space-y-2">
                             <Label htmlFor="contacto" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Persona de Contacto</Label>
                            <Input id="contacto" name="contacto" placeholder="Nombre contacto..." defaultValue={editingClient?.contacto || ''} className="rounded-xl border-slate-100 bg-slate-50 focus:bg-white transition-all font-bold text-slate-900" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                               <Label htmlFor="telefono" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</Label>
                              <Input id="telefono" name="telefono" placeholder="+34..." defaultValue={editingClient?.telefono || ''} className="rounded-xl border-slate-100 bg-slate-50 focus:bg-white transition-all font-bold text-slate-900" />
                          </div>
                          <div className="space-y-2">
                              <Label htmlFor="email" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail</Label>
                              <Input id="email" name="email" type="email" placeholder="correo@empresa.com" defaultValue={editingClient?.email || ''} className="rounded-xl border-slate-100 bg-slate-50 focus:bg-white transition-all font-bold text-slate-900" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                              <Label htmlFor="direccion" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dirección Fiscal</Label>
                              <Input id="direccion" name="direccion" placeholder="Calle..." defaultValue={editingClient?.direccion || ''} className="rounded-xl border-slate-100 bg-slate-50 focus:bg-white transition-all font-bold text-slate-900" />
                          </div>
                          <div className="space-y-2">
                               <Label htmlFor="ciudad" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ciudad (Provincia)</Label>
                              <Input id="ciudad" name="ciudad" placeholder="Madrid" defaultValue={editingClient?.ciudad || ''} className="rounded-xl border-slate-100 bg-slate-50 focus:bg-white transition-all font-bold text-slate-900" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                              <Label htmlFor="cp" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Código Postal</Label>
                              <Input id="cp" name="cp" placeholder="28001" defaultValue={editingClient?.cp || ''} className="rounded-xl border-slate-100 bg-slate-50 focus:bg-white transition-all font-bold text-slate-900" />
                          </div>
                          <div className="space-y-2">
                              <Label htmlFor="cif" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CIF</Label>
                              <Input id="cif" name="cif" placeholder="CIF..." defaultValue={editingClient?.cif || ''} className="rounded-xl border-slate-100 bg-slate-50 focus:bg-white transition-all font-bold text-slate-900" />
                          </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-4">
                            <Button type="button" variant="ghost" onClick={closeModal} className="rounded-xl font-bold uppercase text-xs tracking-widest">Cancelar</Button>
                            <Button type="submit" disabled={isSavingClient} className="rounded-xl font-black uppercase text-xs tracking-widest bg-primary hover:bg-primary/90 px-8">
                              {isSavingClient ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar Ficha'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
}
