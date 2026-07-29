'use client';

/* eslint-disable react-hooks/exhaustive-deps -- QA: warning reviewed; keeping current flow to avoid behavioral changes. */

import { processDictation, ProcessDictationOutput } from '@/ai/flows/process-dictation-flow';
import { useScreenSize } from '@/hooks/use-screen-size';
import { useToast } from '@/hooks/use-toast';
import { db as dbLocal } from '@/lib/db-local';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import TABS from './constants';

// Hooks personalizados
import { useInspectionCache } from './hooks/useInspectionCache';
import { useInspectionIdentity } from './hooks/useInspectionIdentity';
import { useInspectionSync } from './hooks/useInspectionSync';

// Componentes
import { getPdfFileName, normalizeReportForPdf } from '@/lib/pdf-utils';
import Footer from './components/Footer';
import Header from './components/Header';
import InspectionViewManager from './components/InspectionViewManager';
import OTDetailModal from './components/OTDetailModal';
import SyncStatusOverlay from './components/SyncStatusOverlay';
import WorkSessionMonitor from './components/WorkSessionMonitor';
import { generatePDF as generateHojaTrabajoPDF } from './components/forms/HojaTrabajoForm';
import { generatePDF as generateInformeRevisionPDF } from './components/forms/InformeRevisionForm';
import { generatePDF as generateInformeSimplificadoPDF } from './components/forms/InformeSimplificadoForm';
import { generatePDF as generateInformeTecnicoPDF } from './components/forms/InformeTecnicoForm';
import { generatePDF as generateRevisionBasicaPDF } from './components/forms/RevisionBasicaForm';
import { getCreationReportId, getReportDisplayId } from './lib/report-record';

const normalizeInspectionFormType = (record: any, fallback = 'hoja-trabajo') => {
  const raw = String(record?.formType || record?.tipo || '').toLowerCase().trim();
  const reportId = getCreationReportId(record).toUpperCase();

  // Al abrir informes ya creados, el tipo manda. Si vino incompleto,
  // usamos el prefijo del número de informe para no caer siempre en hoja de trabajo.
  if (raw.includes('hoja-trabajo') || raw.includes('hoja de trabajo')) return 'hoja-trabajo';
  if (raw.includes('informe-revision') || raw.includes('informe de revision') || raw.includes('informe de revisión')) return 'informe-revision';
  if (raw.includes('informe-tecnico') || raw.includes('informe tecnico') || raw.includes('informe técnico')) return 'informe-tecnico';
  if (raw.includes('informe-simplificado') || raw.includes('informe simplificado')) return 'informe-simplificado';
  if (raw.includes('revision-basica') || raw.includes('revisión básica')) return 'revision-basica';

  if (reportId.startsWith('HT-')) return 'hoja-trabajo';
  if (reportId.startsWith('IR-')) return 'informe-revision';
  if (reportId.startsWith('IT-')) return 'informe-tecnico';
  if (reportId.startsWith('IS-')) return 'informe-simplificado';
  if (reportId.startsWith('RB-')) return 'revision-basica';

  return fallback;
};

const InspectionPageContent = () => {
  const { toast } = useToast();
  const screenSize = useScreenSize();
  
  // Identidad y Modo
  const { 
    user, firestore, isUserLoading, isOnline, accessMode, 
    offlineEmail, userFullName, isIdentityLoaded, isStandalone, effectiveEmail 
  } = useInspectionIdentity();

  // Sincronización y Caché
  const { isSyncing, syncOfflineData } = useInspectionSync(
    isOnline && !!firestore && !!user?.email, 
    user, firestore, offlineEmail
  );
  
  useInspectionCache(isOnline, firestore, effectiveEmail);

  // Estados de Navegación
  const [activeTab, setActiveTab] = useState<string>(TABS.MENU);
  const [previousTab, setPreviousTab] = useState<string>(TABS.MENU);
  const [previousOT, setPreviousOT] = useState<any | null>(null);
  const [activeInspectionForm, setActiveInspectionForm] = useState<any>(null);
  const [otFilter, setOtFilter] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [recentOTs, setRecentOTs] = useState<any[]>([]);
  const [otStatusFilter, setOtStatusFilter] = useState<'activas' | 'completadas'>('activas');
  const [selectedOTFromMenu, setSelectedOTFromMenu] = useState<any | null>(null);
  const [allInformesForModal, setAllInformesForModal] = useState<any[]>([]);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const configStatus = { hasSignature: false, hasPin: true };

  // Estados de IA/Voz
  const [aiLoading, setAiLoading] = useState(false);
  const [aiData, setAiData] = useState<ProcessDictationOutput | null>(null);
  const [dictationNotebook, setDictationNotebook] = useState<string>('');

  // Efecto para capturar el prompt de instalación PWA
  useEffect(() => {
    const handleInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
  }, []);

  // Siempre hacer scroll al tope al cambiar de pantalla o abrir formulario
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeTab, activeInspectionForm]);

  // Sincronización de OTs asignadas (en tiempo real si hay red)
  useEffect(() => {
    if (isOnline && firestore && user?.email) {
      const email = user.email;
      const qAssigned = query(
        collection(firestore, 'ordenes_trabajo'),
        where('inspectorIds', 'array-contains', email)
      );

      const unsubscribe = onSnapshot(qAssigned, (snapshot) => {
        const allOts = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
          _timestamp: d.data().fecha_creacion?.seconds || 0
        }));

        allOts.sort((a, b) => b._timestamp - a._timestamp);
        
        const filtered = otStatusFilter === 'completadas' 
          ? allOts.filter((ot: any) => ot.estado?.toLowerCase() === 'completada')
          : allOts.filter((ot: any) => ['registrada', 'en proceso'].includes(ot.estado?.toLowerCase()));

        setRecentOTs(filtered.slice(0, 10));
      });

      return () => unsubscribe();
    } else if (!isOnline) {
      // FALLBACK OFFLINE: Cargar OTs desde el caché de 30 días
      dbLocal.ordenes_cache.where('inspectorIds').equals(effectiveEmail || '').toArray().then((cached: any[]) => {
        const allOts = cached.map((c: any) => ({
          id: c.id,
          ...c.data,
          _timestamp: c.data.fecha_creacion?.seconds || 0
        }));
        
        allOts.sort((a: any, b: any) => b._timestamp - a._timestamp);
        const filtered = otStatusFilter === 'completadas' 
          ? allOts.filter((ot: any) => ot.estado?.toLowerCase() === 'completada')
          : allOts.filter((ot: any) => ['registrada', 'en proceso'].includes(ot.estado?.toLowerCase()));

        setRecentOTs(filtered.slice(0, 10));
      });
    }
  }, [isOnline, firestore, user, otStatusFilter]);

  // Cargar informes para el modal cuando se selecciona una OT
  useEffect(() => {
    if (selectedOTFromMenu) {
      if (isOnline && firestore) {
        const q = query(collection(firestore, 'informes'), where('orderId', '==', selectedOTFromMenu.id));
        getDocs(q).then(snap => {
          setAllInformesForModal(snap.docs
            .map(d => {
              const data = d.data();
              return {
                ...data,
                id: d.id,
                firestoreId: d.id,
                dataId: (data as any).id,
                formType: normalizeInspectionFormType({ ...data, id: d.id, firestoreId: d.id }),
              };
            })
            .filter((report: any) => report.eliminado !== true));
        });
      } else {
        // FALLBACK OFFLINE: Buscar en la caché de 30 días
        dbLocal.informes_cache.where('orderId').equals(selectedOTFromMenu.id).toArray().then((cached: any[]) => {
          setAllInformesForModal(cached.map((c: any) => {
            const data = c.data || {};
            return {
              ...data,
              id: c.id,
              firestoreId: c.id,
              dataId: data.id,
              formType: normalizeInspectionFormType({ ...data, id: c.id, firestoreId: c.id }),
              isFromCache: true,
              imageCount: c.imageCount
            };
          }).filter((report: any) => report.eliminado !== true));
        });
      }
    }
  }, [selectedOTFromMenu, firestore, isOnline]);

  // Manejadores de eventos
  const handleNavigate = (tab: string, otId?: string) => {
    setActiveTab(tab);
    setOtFilter(otId || null);
  };

  const handleSelectInspectionType = (formType: any, data: any) => {
    const normalizedFormType = normalizeInspectionFormType({ ...data, formType }, formType || data?.formType || 'hoja-trabajo');
    setSelectedTask({ ...data, formType: normalizedFormType });
    setActiveInspectionForm(normalizedFormType);
    setPreviousTab(activeTab);
    // Capture the current OT so we can re-open the modal after save
    setPreviousOT(selectedOTFromMenu);
    // Close the modal while the form is open
    setSelectedOTFromMenu(null);
    setActiveTab(TABS.NEW_INSPECTION);
  };

  const handleFormSuccess = () => {
    const savedPreviousOT = previousOT;
    setActiveTab(previousTab);
    setActiveInspectionForm(null);
    setPreviousTab(TABS.MENU);
    setPreviousOT(null);
    // Re-open the OT modal if we came from one
    if (savedPreviousOT) {
      setSelectedOTFromMenu(savedPreviousOT);
    }
    syncOfflineData();
  };


  const handleInstallClick = () => {
    if (installPrompt) {
      installPrompt.prompt();
    } else {
      toast({ title: "Preparando Instalación...", description: "Usa el menú de Chrome si el botón no aparece." });
    }
  };

  const handleAiAnalyze = async () => {
    if (!dictationNotebook.trim()) return;
    setAiLoading(true);
    try {
      const res = await processDictation({ dictation: dictationNotebook });
      setAiData(res);
      toast({ title: "IA: Análisis Completado", description: "Formulario autocompletado." });
    } catch {
      setAiData({ observations_summary: dictationNotebook } as any);
      toast({ variant: "destructive", title: "Error IA", description: "Texto volcado manual." });
    } finally { setAiLoading(false); }
  };

  const handleStartInspectionFromTask = (task: any) => {
     handleSelectInspectionType(normalizeInspectionFormType(task), task);
  };

  const handleDownloadPdf = async (job: any) => {
    const finalId = getReportDisplayId(job) || 'BORRADOR';
    const inspectorName = job.tecnicoNombre || job.inspectorNombre || job.inspectorNombres?.join(', ') || 'Inspector Técnico';
    const reportForPdf = await normalizeReportForPdf(job);
    const formType = normalizeInspectionFormType(job, job.formType);
    let docPdf: any = null;

    try {
      toast({ title: "Generando PDF...", description: "Espere un momento." });
      switch (formType) {
        case 'hoja-trabajo': docPdf = await generateHojaTrabajoPDF(reportForPdf, inspectorName, finalId); break;
        case 'informe-revision': docPdf = await generateInformeRevisionPDF(reportForPdf, inspectorName, finalId); break;
        case 'informe-tecnico': docPdf = await generateInformeTecnicoPDF(reportForPdf, inspectorName, finalId); break;
        case 'informe-simplificado': docPdf = await generateInformeSimplificadoPDF(reportForPdf, inspectorName, finalId); break;
        case 'revision-basica': docPdf = await generateRevisionBasicaPDF(reportForPdf, inspectorName, finalId); break;
        default: 
          toast({ variant: "destructive", title: "Error", description: "Tipo de formulario no soportado para PDF." });
          return;
      }
      if (docPdf) {
        docPdf.save(getPdfFileName(finalId));
        toast({ title: "Descarga exitosa", description: `Archivo: ${getPdfFileName(finalId)}` });
      }
    } catch (e) {
      console.error("Error generating PDF:", e);
      toast({ variant: "destructive", title: "Error", description: "No se pudo generar el PDF." });
    }
  };

  const handleDownloadMultiplePdfs = async (reportsToDownload: any[]) => {
    if (reportsToDownload.length === 0) return;
    toast({ title: 'Preparando ZIP...', description: `Generando ${reportsToDownload.length} documentos.` });
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const usedNames = new Map<string, number>();

      for (const report of reportsToDownload) {
        const finalId = getReportDisplayId(report) || report.id;
        const inspectorName = report.tecnicoNombre || report.inspectorNombre || report.inspectorNombres?.join(', ') || 'Inspector Técnico';
        const reportForPdf = await normalizeReportForPdf(report);
        const formType = normalizeInspectionFormType(report, report.formType);
        let docPdf: any = null;

        switch (formType) {
          case 'hoja-trabajo': docPdf = await generateHojaTrabajoPDF(reportForPdf, inspectorName, finalId); break;
          case 'informe-revision': docPdf = await generateInformeRevisionPDF(reportForPdf, inspectorName, finalId); break;
          case 'informe-tecnico': docPdf = await generateInformeTecnicoPDF(reportForPdf, inspectorName, finalId); break;
          case 'informe-simplificado': docPdf = await generateInformeSimplificadoPDF(reportForPdf, inspectorName, finalId); break;
          case 'revision-basica': docPdf = await generateRevisionBasicaPDF(reportForPdf, inspectorName, finalId); break;
          default: continue;
        }
        if (docPdf) {
          const baseName = getPdfFileName(finalId);
          const count = usedNames.get(baseName) || 0;
          usedNames.set(baseName, count + 1);
          const safeName = count === 0 ? baseName : baseName.replace(/\.pdf$/i, `_${count + 1}.pdf`);
          zip.file(safeName, docPdf.output('blob'));
        }
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const date = new Date();
      const stamp = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
      const zipName = `informes_${stamp}.zip`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = zipName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Descarga exitosa", description: `Archivo: ${zipName}` });
    } catch (e: any) {
      console.error("Error generating ZIP:", e);
      toast({ variant: "destructive", title: "Error ZIP", description: e?.message || "No se pudo generar el ZIP." });
    }
  };

  // Pantalla de carga premium con fondo_app.jpg
  if (isUserLoading || !isIdentityLoaded) {
    return (
      <div className="relative flex h-screen items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/fondo_app.jpg')" }} />
        
        {/* Contenedor inferior con Glassmorphism */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-xs">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2.5rem] p-6 shadow-2xl flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400 drop-shadow-lg" />
            <p className="text-white font-black uppercase tracking-[0.4em] text-[9px] opacity-90 drop-shadow-md text-center">
              Verificando Seguridad
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-[#080c14] overflow-x-hidden">
      <Header
        activeTab={activeTab}
        isSubNavActive={!!activeInspectionForm}
        onBack={() => {
          if (activeInspectionForm) {
            setActiveTab(previousTab);
            setActiveInspectionForm(null);
            if (previousOT) {
              setSelectedOTFromMenu(previousOT);
            }
            setPreviousTab(TABS.MENU);
            setPreviousOT(null);
          } else if (activeTab !== TABS.MENU) {
            handleNavigate(TABS.MENU);
          }
        }}
        isOnline={isOnline}
        onInstall={handleInstallClick}
        canInstall={!!installPrompt}
        isStandalone={isStandalone}
      />

      <WorkSessionMonitor inspectorEmail={effectiveEmail} />

      {accessMode === 'offline' && !user?.email && (
        <div className="mt-20 w-full px-4 animate-in slide-in-from-top-4 duration-500">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 backdrop-blur-md px-5 py-3 text-[10px] font-black uppercase tracking-widest text-amber-700 shadow-lg shadow-amber-500/10">
             ⚠️ Modo offline activo: los datos se guardan en el dispositivo.
          </div>
        </div>
      )}

      <main className="flex-grow w-full pt-20 pb-32 md:pb-40">
        <InspectionViewManager
          activeTab={activeTab}
          activeInspectionForm={activeInspectionForm}
          effectiveEmail={effectiveEmail}
          user={user}
          offlineEmail={offlineEmail}
          userFullName={userFullName}
          recentOTs={recentOTs}
          otStatusFilter={otStatusFilter}
          setOtStatusFilter={setOtStatusFilter}
          setSelectedOTFromMenu={setSelectedOTFromMenu}
          handleNavigate={handleNavigate}
          handleInstallClick={handleInstallClick}
          installPrompt={installPrompt}
          configStatus={configStatus}
          isOnline={isOnline}
          isStandalone={isStandalone}
          screenSize={screenSize || 'mobile'}
          handleSelectInspectionType={handleSelectInspectionType}
          selectedTask={selectedTask}
          aiData={aiData}
          handleFormSuccess={handleFormSuccess}
          handleStartInspectionFromTask={handleStartInspectionFromTask}
          otFilter={otFilter}
          dictationNotebook={dictationNotebook}
          setDictationNotebook={setDictationNotebook}
          handleAiAnalyze={handleAiAnalyze}
          aiLoading={aiLoading}
        />
      </main>

      <Footer activeTab={activeTab} onNavigate={handleNavigate} />
      
      <SyncStatusOverlay isSyncing={isSyncing} />

      {selectedOTFromMenu && (
        <OTDetailModal
          ot={selectedOTFromMenu}
          reports={allInformesForModal}
          currentEmail={effectiveEmail || undefined}
          onClose={() => setSelectedOTFromMenu(null)}
          onStartAction={(type, ot) => {
            handleSelectInspectionType(type, ot);
            // Keep selectedOTFromMenu so handleFormSuccess can re-open the modal
          }}
          onEditReport={(report) => {
            handleSelectInspectionType(normalizeInspectionFormType(report), report);
            // Keep selectedOTFromMenu so handleFormSuccess can re-open the modal
          }}
          onDownloadPdf={handleDownloadPdf}
          onDownloadMultiplePdfs={handleDownloadMultiplePdfs}
        />
      )}
    </div>
  );
};

export default function InspectionPage() {
  return (
    <Suspense fallback={
      <div className="relative flex h-screen items-center justify-center overflow-hidden bg-slate-900">
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-xs">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2.5rem] p-6 shadow-2xl flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400 drop-shadow-lg" />
            <p className="text-white font-black uppercase tracking-[0.4em] text-[9px] opacity-90 drop-shadow-md text-center">
              Cargando Sistema
            </p>
          </div>
        </div>
      </div>
    }>
      <InspectionPageContent />
    </Suspense>
  );
}
