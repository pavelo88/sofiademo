'use client';

/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- QA: warning reviewed; keeping current flow to avoid behavioral changes. */

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore, useUser } from '@/firebase';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { useToast } from '@/hooks/use-toast';
import { db as dbLocal } from '@/lib/db-local';
import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { Check, Loader2, Mail, MapPin, Plus, Save, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface Client {
  id: string;
  nombre: string;
  direccion?: string;
  email?: string;
  telefono?: string;
  status?: string;
}

interface ClientSelectorProps {
  onSelect: (client: Client) => void;
  selectedClientId?: string;
}

export default function ClientSelector({ onSelect, selectedClientId }: ClientSelectorProps) {
  const db = useFirestore();
  const { user } = useUser();
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const hasShownPermissionToastRef = useRef(false);
  const canUseCloudClients = isOnline && !!db && !!user?.email;

  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New client form state
  const [newClient, setNewClient] = useState({
    nombre: '',
    direccion: '',
    email: '',
    telefono: ''
  });

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    // Load from cache (incluye posibles clientes creados offline)
    Promise.all([
      dbLocal.clientes_cache.toArray(),
      dbLocal.clientes_pendientes.filter(c => !c.synced).toArray()
    ]).then(([cached, pending]) => {
      // Crear mapa para deduplicar y evitar claves duplicadas
      const clientMap = new Map<string, Client>();

      // Primero: cached clients
      cached.forEach(c => {
        clientMap.set(c.id, c as Client);
      });

      // Segundo: pending clients (sobrescriben si existen)
      pending.forEach(p => {
        const uniqueId = p.firebaseId ? p.firebaseId : `offline-${p.id}`;
        clientMap.set(uniqueId, {
          id: uniqueId,
          ...p.data
        } as Client);
      });

      const merged = Array.from(clientMap.values());
      setClients(merged);
      if (merged.length > 0 || !canUseCloudClients) {
        setLoading(false);
      }
    });

    // Cuando hay conexión, mantenemos la lista actualizada desde Firestore
    if (!canUseCloudClients) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'clientes'), where('status', 'in', ['approved', 'preaprobado']));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      setClients(clientList);
      setLoading(false);
      dbLocal.clientes_cache.bulkPut(clientList);
    }, (error) => {
      const errorCode = (error as any)?.code || '';
      if (errorCode === 'permission-denied' && !hasShownPermissionToastRef.current) {
        hasShownPermissionToastRef.current = true;
        toast({
          variant: 'destructive',
          title: 'Sin permisos de nube',
          description: 'Seguiremos trabajando con clientes en caché local.',
        });
      }
      console.error("Error fetching clients:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, canUseCloudClients, toast]);

  const selectedClient = useMemo(() => {
    return clients.find(c => c.id === selectedClientId);
  }, [clients, selectedClientId]);

  // Si hay un cliente seleccionado, usamos su nombre como valor inicial del buscador si está vacío
  useEffect(() => {
    if (selectedClient && searchTerm === '') {
      setSearchTerm(selectedClient.nombre);
    }
  }, [selectedClient]);

  const handleSelect = (client: Client) => {
    onSelect(client);
    setSearchTerm(client.nombre);
  };

  const filteredClients = useMemo(() => {
    // Si el término de búsqueda coincide exactamente con el nombre del cliente seleccionado, no mostramos la lista (ya se seleccionó)
    if (selectedClient && searchTerm === selectedClient.nombre) return [];

    return clients.filter(c =>
      c.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [clients, searchTerm, selectedClient]);

  const handleCreateClient = async () => {
    if (!db) return;
    if (!newClient.nombre) {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'El nombre es obligatorio.' });
      return;
    }

    setIsSaving(true);

    const clientData = {
      ...newClient,
      status: 'preaprobado',
      createdAt: new Date()
    };

    // Use email as ID if present, otherwise generate one
    const docId = newClient.email ? newClient.email : doc(collection(db, 'clientes')).id;
    const createdClient = { id: docId, ...clientData };

    const persistLocally = async () => {
      await dbLocal.clientes_cache.put(createdClient);
      await dbLocal.clientes_pendientes.add({
        firebaseId: docId,
        synced: false,
        data: clientData,
        createdAt: new Date(),
      });
    };

    try {
      if (canUseCloudClients) {
        await setDoc(doc(db, 'clientes', docId), clientData);
        await dbLocal.clientes_cache.put(createdClient);
        toast({ title: 'Cliente registrado', description: 'Registrado como preaprobado.' });
      } else {
        await persistLocally();
        toast({ title: 'Cliente guardado offline', description: 'Se sincronizará al reconectar.' });
      }

      // Actualizamos la lista local para que el cliente aparezca inmediatamente en el selector
      setClients((prev) => {
        const exists = prev.some(c => c.id === createdClient.id);
        if (exists) return prev;
        return [...prev, createdClient];
      });

      onSelect(createdClient);
      setSearchTerm(createdClient.nombre);
      setIsDialogOpen(false);
      setNewClient({ nombre: '', direccion: '', email: '', telefono: '' });
    } catch (error) {
      console.error("Error creating client:", error);
      await persistLocally();
      toast({ variant: 'destructive', title: 'Offline', description: 'Se guardó localmente. Se sincronizará al reconectar.' });

      setClients((prev) => {
        const exists = prev.some(c => c.id === createdClient.id);
        if (exists) return prev;
        return [...prev, createdClient];
      });

      onSelect(createdClient);
      setSearchTerm(createdClient.nombre);
      setIsDialogOpen(false);
      setNewClient({ nombre: '', direccion: '', email: '', telefono: '' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <Input
            placeholder="BUSCAR CLIENTE..."
            value={searchTerm || selectedClient?.nombre || ''}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`pl-10 h-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-all font-bold text-xs !text-black ${selectedClient ? 'border-primary ring-1 ring-primary/10' : ''}`}
          />
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-10 px-3 rounded-xl bg-primary text-white hover:bg-white hover:text-primary border border-primary transition-colors font-black text-[10px] uppercase tracking-widest">
              <Plus size={14} className="mr-1" /> Nuevo
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] max-w-sm bg-white text-slate-950 border border-slate-200 light">
            <DialogHeader>
              <DialogTitle className="font-black uppercase tracking-tighter">Nuevo Cliente Pre-aprobado</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label htmlFor="name" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Comercial</Label>
                <Input id="name" value={newClient.nombre} onChange={e => setNewClient({ ...newClient, nombre: e.target.value })} placeholder="Empresa S.L." className="rounded-xl font-bold text-slate-900" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="address" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dirección</Label>
                <Input id="address" value={newClient.direccion} onChange={e => setNewClient({ ...newClient, direccion: e.target.value })} placeholder="Calle Referencial 123" className="rounded-xl font-bold text-slate-900" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email (Usado como ID)</Label>
                <Input id="email" type="email" value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })} placeholder="cliente@correo.com" className="rounded-xl font-bold text-slate-900" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</Label>
                <Input id="phone" value={newClient.telefono} onChange={e => setNewClient({ ...newClient, telefono: e.target.value })} placeholder="+34..." className="rounded-xl font-bold text-slate-900" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateClient} disabled={isSaving} className="w-full rounded-xl font-black uppercase text-xs tracking-widest bg-primary">
                {isSaving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}
                Cargar como Pre-aprobado
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {(loading || filteredClients.length > 0) && (
        <div className="max-h-60 overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-inner divide-y divide-slate-50">
          {loading ? (
            <div className="p-10 flex flex-col items-center justify-center text-slate-400 italic text-xs gap-2">
              <Loader2 className="animate-spin text-primary" size={20} />
              <span>Buscando...</span>
            </div>
          ) : filteredClients.length > 0 ? (
            filteredClients.map(client => (
              <button
                key={client.id}
                type="button"
                onClick={() => handleSelect(client)}
                className={`w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group ${selectedClientId === client.id ? 'bg-primary/5' : ''}`}
              >
                <div className="space-y-1">
                  <div className="font-black text-slate-700 text-sm group-hover:text-primary transition-colors flex items-center gap-2">
                    {client.nombre}
                    {selectedClientId === client.id && <Check className="text-primary" size={14} />}
                  </div>
                  <div className="flex gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                    {client.direccion && <span className="flex items-center gap-1"><MapPin size={10} /> {client.direccion}</span>}
                    {client.email && <span className="flex items-center gap-1"><Mail size={10} /> {client.email}</span>}
                  </div>
                </div>
              </button>
            ))
          ) : null}
        </div>
      )}
    </div>
  );
}
