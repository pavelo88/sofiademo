'use client';

import ReportGeneratorModal from '@/app/admin/components/ReportGeneratorModal';
import { Button } from "@/components/ui/button";
import { useAuth, useFirestore as useFirebase } from '@/firebase';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { useToast } from '@/hooks/use-toast';
import { decimalToTime } from '@/lib/utils';
import { addMonths, format, isSameMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadString } from 'firebase/storage';
import {
  CalendarDays,
  CalendarIcon,
  ChevronLeft, ChevronRight,
  Clock,
  Download,
  FileText,
  Fingerprint,
  Layers, Loader2,
  LogOut,
  Save,
  TrendingUp,
  User
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import SignaturePad from './SignaturePad';

export default function ProfileTab() {
  const { toast } = useToast();
  const auth = useAuth();
  const db = useFirebase();
  const isOnline = useOnlineStatus();

  // Estados de Datos
  const [allReportes, setAllReportes] = useState<any[]>([]);
  const [allGastos, setAllGastos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de Interfaz
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'horas' | 'gastos'>('horas');
  const [gastosGrouping, setGastosGrouping] = useState<'rubro' | 'fecha'>('rubro');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [moduleToReport, setModuleToReport] = useState<'horas' | 'gastos'>('horas');

  // Firma Maestra
  const [masterSignature, setMasterSignature] = useState<string | null>(null);
  const [isSavingSignature, setIsSavingSignature] = useState(false);

  // ── FUNCIÓN BLINDADA PARA FECHAS DE FIREBASE ──
  // Esta función evita el 100% de los pantallazos blancos por fechas corruptas
  const getSafeDate = (fecha: any): Date => {
    if (!fecha) return new Date(2000, 0, 1); // Fecha por defecto si viene vacío
    try {
      if (typeof fecha === 'object') {
        if (typeof fecha.toDate === 'function') return fecha.toDate();
        if (fecha instanceof Date) return fecha;
        if ('seconds' in fecha) return new Date(fecha.seconds * 1000);
      }
      if (typeof fecha === 'string' || typeof fecha === 'number') {
        const d = new Date(fecha);
        if (!isNaN(d.getTime())) return d;
      }
      return new Date(2000, 0, 1);
    } catch {
      return new Date(2000, 0, 1);
    }
  };

  const getFormattedDate = (fecha: any) => {
    const d = getSafeDate(fecha);
    return d.getFullYear() === 2000 ? '–' : format(d, 'dd/MM/yyyy');
  };

  // 1. Cargar TODOS los datos del inspector
  useEffect(() => {
    if (!auth.currentUser?.email || !db || !isOnline) {
      const timeout = setTimeout(() => { if (!auth.currentUser) setLoading(false); }, 2000);
      return () => clearTimeout(timeout);
    }

    const fetchAllData = async () => {
      setLoading(true);
      try {
        const email = auth.currentUser!.email!;

        // Carga de Visitas
        const qVisitas = query(collection(db, "bitacora_visitas"), where("inspectorId", "==", email));
        const vSnap = await getDocs(qVisitas);
        const dataV = vSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        setAllReportes(dataV.sort((a, b) => getSafeDate(b.fecha).getTime() - getSafeDate(a.fecha).getTime()));

        // Carga de Gastos
        const qGastos = query(collection(db, "gastos_detalle"), where("inspectorId", "==", email));
        const gSnap = await getDocs(qGastos);
        const dataG = gSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        setAllGastos(dataG.sort((a, b) => getSafeDate(b.fecha).getTime() - getSafeDate(a.fecha).getTime()));

        // Cargar Firma Maestra desde Firestore (campo firmaUrl)
        const userRef = doc(db, 'usuarios', email);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const sigUrl = userDoc.data().firmaUrl;
          if (sigUrl) {
            setMasterSignature(sigUrl);
            // También mantenemos en localStorage para acceso offline/rápido en formularios
            localStorage.setItem('energy_engine_signature', sigUrl);
          }
        } else {
          const localSig = localStorage.getItem('energy_engine_signature');
          if (localSig) setMasterSignature(localSig);
        }

      } catch (e) {
        console.error("Error fetching data:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [auth.currentUser, db, isOnline]);

  const handleSaveMasterSignature = async (newSig: string | null) => {
    if (!newSig || !auth.currentUser?.email || !db) return;
    
    setIsSavingSignature(true);
    try {
      const storage = getStorage();
      const email = auth.currentUser.email;
      const safeEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
      
      // 1. Subir a Firebase Storage
      const signatureRef = ref(storage, `firmas_maestras/${safeEmail}_signature.jpg`);
      await uploadString(signatureRef, newSig, 'data_url');
      const downloadUrl = await getDownloadURL(signatureRef);

      // 2. Guardar URL en Firestore (campo firmaUrl)
      await setDoc(doc(db, 'usuarios', email), { 
        firmaUrl: downloadUrl,
        updatedAt: new Date()
      }, { merge: true });
      
      // 3. Actualizar estado local y localStorage
      setMasterSignature(newSig);
      localStorage.setItem('energy_engine_signature', newSig);
      
      toast({ title: "Firma guardada correctamente ✅", description: "Se ha sincronizado con tu perfil." });
    } catch (e) {
      console.error(e);
      toast({ title: "Error al guardar firma", variant: "destructive" });
    } finally {
      setIsSavingSignature(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('¿Cerrar sesión ahora? Asegúrate de haber guardado tus trabajos.')) return;
    try {
      localStorage.removeItem('energy_engine_session_id');
      localStorage.removeItem('energy_engine_offline_email');
      localStorage.removeItem('energy_engine_inspection_mode');
      if (auth) await signOut(auth);
      window.location.href = '/auth/inspection';
    } catch (e) {
      console.error(e);
      window.location.href = '/auth/inspection';
    }
  };


  // 2. Filtrar los datos en memoria según el mes seleccionado (Try-Catch para evitar crash)
  const displayedReportes = useMemo(() => {
    return allReportes.filter(r => {
      try { return isSameMonth(getSafeDate(r.fecha), currentMonth); }
      catch { return false; }
    });
  }, [allReportes, currentMonth]);

  const displayedGastos = useMemo(() => {
    return allGastos.filter(r => {
      try { return isSameMonth(getSafeDate(r.fecha), currentMonth); }
      catch { return false; }
    });
  }, [allGastos, currentMonth]);

  // 3. Cálculos Seguros de Totales (Number() evita errores si guardaron letras por accidente)
  const totalN = displayedReportes.reduce((s, p) => s + (Number(p.horasNormales) || 0), 0);
  const totalE = displayedReportes.reduce((s, p) => s + (Number(p.horasExtras) || 0), 0);
  const totalS = displayedReportes.reduce((s, p) => s + (Number(p.horasEspeciales) || 0), 0);
  const totalHoras = totalN + totalE + totalS;

  const totalGastos = displayedGastos.reduce((s, g) => s + (Number(g.monto) || 0), 0);

  const gastosByRubro = displayedGastos.reduce((acc: Record<string, any[]>, g: any) => {
    const rubro = g.rubro || 'Otros';
    if (!acc[rubro]) acc[rubro] = [];
    acc[rubro].push(g);
    return acc;
  }, {});

  const gastosByFecha = displayedGastos.reduce((acc: Record<string, any[]>, g: any) => {
    const fecha = getFormattedDate(g.fecha);
    if (!acc[fecha]) acc[fecha] = [];
    acc[fecha].push(g);
    return acc;
  }, {});

  const handleOpenReport = (type: 'horas' | 'gastos') => {
    setModuleToReport(type);
    setIsReportModalOpen(true);
  };

  // ── PANTALLA DE CARGA (Evita el pantallazo blanco inicial) ──
  if (loading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-700">
        <div className="w-24 h-24 bg-slate-900 rounded-[2.5rem] flex items-center justify-center shadow-2xl relative">
          <div className="absolute inset-0 bg-emerald-500 rounded-[2.5rem] animate-ping opacity-20"></div>
          <User size={48} className="text-emerald-400 relative z-10" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Tu Bitácora</h2>
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center justify-center gap-2 bg-emerald-50 py-2 px-4 rounded-full">
            <Loader2 size={14} className="animate-spin" /> Sincronizando registros...
          </p>
        </div>
      </div>
    );
  }

  // ── PANTALLA PRINCIPAL ──
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">

      {/* TARJETA DE USUARIO */}
      <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
        <div className="w-16 h-16 bg-[#062113]/10 text-[#062113] rounded-2xl flex items-center justify-center shadow-inner">
          <User size={32} />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Panel de Autogestión</p>
          <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
            {auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'INSPECTOR ENERGY'}
          </h2>
        </div>
        <div className="flex flex-col items-end">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tu Firma</p>
          {masterSignature ? (
             <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center">
                <Fingerprint size={24} className="text-emerald-500" />
             </div>
          ) : (
             <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center">
                <Fingerprint size={24} className="text-slate-300" />
             </div>
          )}
        </div>
      </section>

      {/* SECCIÓN DE FIRMA MAESTRA */}
      <section className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-4 px-2">
            <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                    <Save size={16} className="text-emerald-500" /> Firma Permanente del Inspector
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Se insertará automáticamente en todos tus documentos</p>
            </div>
        </div>
        <SignaturePad 
          title="Dibuje su firma aquí" 
          signature={masterSignature} 
          onSignatureEnd={handleSaveMasterSignature} 
        />
        {isSavingSignature && <p className="text-center text-[9px] font-black text-emerald-500 uppercase mt-2 animate-pulse">Guardando en la nube...</p>}
      </section>

      {/* NAVEGADOR DE MESES */}
      <section className="bg-[#062113] p-4 rounded-3xl text-white shadow-xl flex items-center justify-between">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center transition-all active:scale-95"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="text-center">
          <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center justify-center gap-1">
            <CalendarIcon size={10} /> Consultando Mes
          </p>
          <h3 className="text-xl font-black uppercase tracking-widest mt-1">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </h3>
        </div>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          disabled={isSameMonth(currentMonth, new Date())}
          className="w-12 h-12 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent rounded-2xl flex items-center justify-center transition-all active:scale-95"
        >
          <ChevronRight size={24} />
        </button>
      </section>

      {/* TABS */}
      <div className="bg-slate-200 p-1.5 rounded-full flex gap-1 shadow-inner">
        <button
          onClick={() => setActiveTab('horas')}
          className={`flex-1 h-12 rounded-full font-black text-xs uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'horas' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Clock size={16} className={activeTab === 'horas' ? 'text-emerald-500' : ''} /> Mis Horas
        </button>
        <button
          onClick={() => setActiveTab('gastos')}
          className={`flex-1 h-12 rounded-full font-black text-xs uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'gastos' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <TrendingUp size={16} className={activeTab === 'gastos' ? 'text-blue-500' : ''} /> Mis Gastos
        </button>
      </div>

      {/* CONTENIDO: HORAS */}
      {activeTab === 'horas' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm text-center col-span-4 flex justify-between items-center px-8">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Producción</span>
              <span className="text-3xl font-black text-slate-900">{decimalToTime(totalHoras)}<span className="text-sm text-slate-400">h</span></span>
            </div>
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center">
              <p className="text-[9px] font-black text-emerald-600 uppercase">Norm.</p>
              <p className="text-lg font-black text-emerald-700">{decimalToTime(totalN)}</p>
            </div>
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 text-center">
              <p className="text-[9px] font-black text-amber-600 uppercase">Extra</p>
              <p className="text-lg font-black text-amber-700">{decimalToTime(totalE)}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-center">
              <p className="text-[9px] font-black text-blue-600 uppercase">Esp.</p>
              <p className="text-lg font-black text-blue-700">{decimalToTime(totalS)}</p>
            </div>
            <div className="col-span-1 flex items-end">
              <Button 
                onClick={() => handleOpenReport('horas')} 
                className="w-full h-full rounded-2xl border-2 border-[#165a30] bg-[#165a30] text-white font-black uppercase text-[10px] tracking-widest hover:bg-white hover:text-[#165a30] transition-all duration-300 shadow-lg p-0"
              >
                <Download size={20} className="text-white group-hover:text-[#165a30]" />
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            {displayedReportes.length === 0 ? (
              <div className="py-12 text-center text-slate-300">
                <Clock size={40} className="mx-auto mb-3" />
                <p className="font-black text-sm uppercase text-slate-400">Sin registros en este mes</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 border-b border-slate-100">
                      <th className="px-4 py-3 font-black uppercase text-[9px] tracking-widest whitespace-nowrap">Fecha</th>
                      <th className="px-4 py-3 font-black uppercase text-[9px] tracking-widest whitespace-nowrap">Cliente</th>
                      <th className="px-3 py-3 font-black uppercase text-[9px] tracking-widest text-center text-emerald-600">N</th>
                      <th className="px-3 py-3 font-black uppercase text-[9px] tracking-widest text-center text-amber-600">E</th>
                      <th className="px-3 py-3 font-black uppercase text-[9px] tracking-widest text-center text-blue-600">S</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {displayedReportes.map((stop, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-500 whitespace-nowrap">{getFormattedDate(stop.fecha)}</td>
                        <td className="px-4 py-3 font-bold text-slate-800 whitespace-nowrap max-w-[140px] truncate">{stop.clienteNombre || '–'}</td>
                        <td className="px-3 py-3 text-center font-black text-emerald-600 bg-emerald-50/30">{decimalToTime(Number(stop.horasNormales) || 0)}</td>
                        <td className="px-3 py-3 text-center font-black text-amber-600 bg-amber-50/30">{decimalToTime(Number(stop.horasExtras) || 0)}</td>
                        <td className="px-3 py-3 text-center font-black text-blue-600 bg-blue-50/30">{decimalToTime(Number(stop.horasEspeciales) || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-100">
                    <tr>
                      <td colSpan={2} className="px-4 py-4 text-right font-black uppercase text-[10px] tracking-widest text-slate-400">Total Mensual</td>
                      <td className="px-3 py-4 text-center font-black text-emerald-600 bg-emerald-50">{decimalToTime(totalN)}</td>
                      <td className="px-3 py-4 text-center font-black text-amber-600 bg-amber-50">{decimalToTime(totalE)}</td>
                      <td className="px-3 py-4 text-center font-black text-blue-600 bg-blue-50">{decimalToTime(totalS)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTENIDO: GASTOS */}
      {activeTab === 'gastos' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex justify-between items-center">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Liquidado</span>
              <p className="text-3xl font-black text-slate-900 mt-1">{totalGastos.toFixed(2)}€</p>
            </div>
            <Button 
              onClick={() => handleOpenReport('gastos')} 
              className="h-14 px-6 rounded-2x border-2 border-[#165a30] bg-[#165a30] text-white font-black uppercase text-[10px] tracking-widest hover:bg-white hover:text-[#165a30] transition-all duration-300 shadow-xl flex items-center gap-2"
            >
              <Download size={16} /> PDF
            </Button>
          </div>

          {displayedGastos.length > 0 && (
            <div className="flex bg-slate-100 p-1 rounded-xl w-full max-w-sm mx-auto shadow-inner">
              <button
                onClick={() => setGastosGrouping('rubro')}
                className={`flex-1 py-2 rounded-lg font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2 ${gastosGrouping === 'rubro' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Layers size={14} /> Por Categoría
              </button>
              <button
                onClick={() => setGastosGrouping('fecha')}
                className={`flex-1 py-2 rounded-lg font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2 ${gastosGrouping === 'fecha' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <CalendarDays size={14} /> Por Día
              </button>
            </div>
          )}

          <div className="space-y-4">
            {displayedGastos.length === 0 ? (
              <div className="bg-white rounded-[2rem] border border-slate-100 py-12 text-center text-slate-300">
                <TrendingUp size={40} className="mx-auto mb-3" />
                <p className="font-black text-sm uppercase text-slate-400">Sin gastos registrados este mes</p>
              </div>
            ) : (
              Object.entries(gastosGrouping === 'rubro' ? gastosByRubro : gastosByFecha).map(([groupKey, items]: [string, any[]]) => {
                const subtotal = items.reduce((s, g) => s + (Number(g.monto) || 0), 0);

                return (
                  <div key={groupKey} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden animate-in fade-in duration-300">
                    <div className={`px-5 py-3 border-b border-slate-100 flex items-center justify-between ${gastosGrouping === 'fecha' ? 'bg-slate-900 text-white' : 'bg-slate-50'}`}>
                      <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${gastosGrouping === 'fecha' ? 'text-white' : 'text-slate-500'}`}>
                        {gastosGrouping === 'fecha' ? <CalendarDays size={12} /> : <FileText size={12} />}
                        {groupKey}
                      </span>
                      <span className={`text-xs font-black ${gastosGrouping === 'fecha' ? 'text-emerald-400' : 'text-slate-900'}`}>
                        {subtotal.toFixed(2)}€
                      </span>
                    </div>
                    <div className="p-2">
                      {items.map((g: any, i: number) => (
                        <div key={i} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors">
                          <div className="min-w-0 flex-1 pr-4">
                            <p className="font-bold text-slate-800 text-xs truncate">
                              {gastosGrouping === 'fecha' ? g.rubro : (g.descripcion || g.concepto || '–')}
                            </p>
                            <p className="text-[9px] font-black text-slate-400 uppercase mt-0.5">
                              {gastosGrouping === 'fecha' ? (g.descripcion || g.concepto || '–') : getFormattedDate(g.fecha)} • {g.forma_pago || 'Empresa'}
                            </p>
                          </div>
                          <span className="font-black text-slate-900">{Number(g.monto || 0).toFixed(2)}€</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <ReportGeneratorModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        reportes={moduleToReport === 'horas' ? allReportes : allGastos}
        fixedInspectorName={auth.currentUser?.email || ''}
        fixedModule={moduleToReport}
      />

      {/* BOTÓN DE CERRAR SESIÓN */}
      <section className="pt-10">
        <Button 
          variant="ghost" 
          onClick={handleLogout}
          className="w-full h-16 rounded-[2rem] border-2 border-red-100 text-red-500 font-black uppercase tracking-widest hover:bg-red-500 hover:text-white hover:border-red-500 transition-all gap-3"
        >
          <LogOut size={20} /> Cerrar Sesión Segura
        </Button>
        <p className="text-center text-[9px] font-black text-slate-400 uppercase tracking-widest mt-4">Energy Engine v2.5 • Madrid, ES</p>
      </section>
    </div>
  );
}