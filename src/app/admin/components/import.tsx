'use client';

import { useFirestore } from '@/firebase';
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { AlertTriangle, Briefcase, CheckCircle, FileUp, Info, Loader2, Users } from 'lucide-react';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { useAdminHeader } from './AdminHeaderContext';

type ProcessState = 'idle' | 'loading' | 'success' | 'error';
type ImportType = 'jobs' | 'clients';

export default function ImportPage() {
  const [importType, setImportType] = useState<ImportType>('jobs');
  const [processState, setProcessState] = useState<ProcessState>('idle');
  const [message, setMessage] = useState('');
  const db = useFirestore();

  useAdminHeader('Importar Datos Excel');

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !db) return;

    setProcessState('loading');
    setMessage('Procesando archivo...');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const json: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

          if (json.length === 0) throw new Error("Archivo vacío.");

          // Función para buscar valores de forma robusta (insensible a mayúsculas y espacios)
          const findValue = (row: any, possibleNames: string[]) => {
            const rowKeys = Object.keys(row);
            const foundKey = rowKeys.find(k => 
              possibleNames.some(name => k.trim().toUpperCase() === name.toUpperCase())
            );
            return foundKey ? row[foundKey] : '';
          };

          const batch = writeBatch(db);
          let processedCount = 0;
          
          if (importType === 'jobs') {
            const jobsCollection = collection(db, 'ordenes_trabajo');
            json.forEach((row: any) => {
              const newJob = {
                descripcion: findValue(row, ['Descripcion', 'DESCRIPCION']) || 'Sin descripción',
                clienteNombre: findValue(row, ['Cliente', 'CLIENTE']) || 'Cliente no especificado',
                inspectorNombres: findValue(row, ['Inspectores', 'INSPECTORES']) ? findValue(row, ['Inspectores', 'INSPECTORES']).toString().split(',').map((name: string) => name.trim()) : [],
                estado: findValue(row, ['Estado', 'ESTADO']) || 'Pendiente',
                clienteId: '', 
                inspectorIds: [],
                fechaCreacion: findValue(row, ['Fecha', 'FECHA']) ? new Date(findValue(row, ['Fecha', 'FECHA'])) : serverTimestamp(),
              };
              batch.set(doc(jobsCollection), newJob);
              processedCount++;
            });
          } else {
            json.forEach((row: any) => {
              const newClient = {
                nombre: (findValue(row, ['NOMBRE EMPRESA COMPLETO', 'Nombre']) || '').toString().trim(),
                contacto: (findValue(row, ['PERSONA DE CONTACTO', 'Contacto']) || '').toString().trim(),
                telefono: (findValue(row, ['TELEFONO', 'Teléfono']) || '').toString().trim(),
                email: (findValue(row, ['E-MAIL', 'Email', 'Correo']) || '').toString().trim(),
                direccion: (findValue(row, ['DIRECCION FISCAL', 'Direccion']) || '').toString().trim(),
                ciudad: (findValue(row, ['CIUDAD (PROVINCIA)', 'Ciudad', 'Provincia']) || '').toString().trim(),
                cp: (findValue(row, ['CODIGO POSTAL', 'CP']) || '').toString().trim(),
                cif: (findValue(row, ['CIF', 'NIF']) || '').toString().trim(),
                status: 'approved',
                fecha_creacion: serverTimestamp(),
              };
              
              if (newClient.nombre) {
                // Usar el nombre en mayúsculas como ID del documento para consistencia con clients.tsx
                const clientDocId = newClient.nombre.toUpperCase();
                const docRef = doc(db, 'clientes', clientDocId);
                batch.set(docRef, newClient);
                processedCount++;
              }
            });
          }

          if (processedCount === 0) {
            throw new Error("No se pudo procesar ningún registro. Verifique que los nombres de las columnas coincidan con lo requerido.");
          }

          await batch.commit();
          setProcessState('success');
          setMessage(`Importación completada: ${processedCount} registros cargados con éxito.`);
        } catch (error: any) {
          console.error("Error en importación:", error);
          setProcessState('error');
          setMessage(error.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error: any) {
      setProcessState('error');
      setMessage(error.message);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      {/* Selector de Tipo de Importación */}
      <div className="flex justify-center gap-4">
        <button 
          onClick={() => setImportType('jobs')}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs tracking-widest transition-all ${importType === 'jobs' ? 'bg-primary text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}
        >
          <Briefcase size={16} />
          ORDENES DE TRABAJO
        </button>
        <button 
          onClick={() => setImportType('clients')}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs tracking-widest transition-all ${importType === 'clients' ? 'bg-primary text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}
        >
          <Users size={16} />
          BASE DE CLIENTES
        </button>
      </div>

      <div className="bg-white p-12 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
        {processState === 'idle' ? (
          <div className="border-2 border-dashed border-slate-200 hover:border-primary transition-all rounded-[2rem] p-12 group cursor-pointer relative">
            <FileUp className="mx-auto h-16 w-16 text-slate-300 group-hover:text-primary transition-colors" />
            <h3 className="mt-4 text-lg font-black text-slate-800 uppercase tracking-tighter">
              Subir Excel de {importType === 'jobs' ? 'OTs' : 'Clientes'}
            </h3>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Formatos: .XLSX, .XLS, .CSV</p>
            <input id="file-upload" type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} accept=".xlsx, .xls, .csv" />
          </div>
        ) : (
          <div className="py-10 animate-in zoom-in duration-300">
            {processState === 'loading' ? <Loader2 className="mx-auto h-16 w-16 animate-spin text-primary" /> : processState === 'success' ? <CheckCircle className="mx-auto h-16 w-16 text-emerald-500" /> : <AlertTriangle className="mx-auto h-16 w-16 text-red-500" />}
            <h3 className="mt-6 text-2xl font-black text-slate-800 uppercase tracking-tighter">{processState === 'loading' ? 'Procesando...' : processState === 'success' ? 'Éxito' : 'Error'}</h3>
            <p className="mt-2 text-slate-500 font-bold uppercase text-xs tracking-widest px-10">{message}</p>
            {processState !== 'loading' && (
                 <button onClick={() => setProcessState('idle')} className="mt-8 bg-slate-900 text-white font-black px-8 py-3 rounded-xl uppercase text-xs tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all">Nueva Carga</button>
            )}
          </div>
        )}
      </div>

      <div className="bg-primary/5 border border-primary/10 p-6 rounded-2xl flex gap-4 items-start">
        <Info className="h-6 w-6 text-primary flex-shrink-0" />
        <div>
          <h4 className="font-black text-primary uppercase text-xs tracking-widest mb-1">Estructura requerida ({importType === 'jobs' ? 'OT' : 'Clientes'})</h4>
          <p className="text-sm text-slate-600 font-medium leading-relaxed">
            {importType === 'jobs' ? (
              <>Columnas requeridas: <span className="font-bold text-slate-800">Cliente, Descripcion, Estado, Fecha, Inspectores</span>.</>
            ) : (
              <>Columnas requeridas (según tu Excel): <span className="font-bold text-slate-800">NOMBRE EMPRESA COMPLETO, PERSONA DE CONTACTO, TELEFONO, E-MAIL, DIRECCION FISCAL, CIUDAD (PROVINCIA), CODIGO POSTAL, CIF</span>.</>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
