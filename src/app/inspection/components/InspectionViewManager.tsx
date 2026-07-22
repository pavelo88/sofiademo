'use client';

import { Loader2 } from 'lucide-react';
import { Suspense } from 'react';
import TABS from '../constants';
import {
  BitacoraFiltrosForm,
  HojaTrabajoFormLazy,
  InformeRevisionFormLazy,
  InformeSimplificadoFormLazy,
  InformeTecnicoFormLazy,
  ProfileTabLazy,
  RegistroGastoForm,
  RevisionBasicaFormLazy,
  TasksTabLazy
} from '../lazy-tabs';
import BitacoraVisitasForm from './BitacoraVisitasForm';
import InspectionHub from './InspectionHub';
import MainMenuDesktop from './MainMenuDesktop';
import MainMenuMobile from './MainMenuMobile';
import MainMenuTablet from './MainMenuTablet';

interface ViewManagerProps {
  activeTab: string;
  activeInspectionForm: any;
  effectiveEmail: string | null;
  user: any;
  offlineEmail: string | null;
  userFullName: string;
  recentOTs: any[];
  otStatusFilter: 'activas' | 'completadas';
  setOtStatusFilter: (status: 'activas' | 'completadas') => void;
  setSelectedOTFromMenu: (ot: any) => void;
  handleNavigate: (tab: string, otId?: string) => void;
  handleInstallClick: () => void;
  installPrompt: any;
  configStatus: any;
  isOnline: boolean;
  isStandalone: boolean;
  screenSize: string;
  handleSelectInspectionType: (formType: any, data: any) => void;
  selectedTask: any;
  aiData: any;
  handleFormSuccess: () => void;
  handleStartInspectionFromTask: (task: any) => void;
  otFilter: string | null;
  dictationNotebook: string;
  setDictationNotebook: (val: string) => void;
  handleAiAnalyze: () => void;
  aiLoading: boolean;
}

export default function InspectionViewManager(props: ViewManagerProps) {
  const {
    activeTab, activeInspectionForm, effectiveEmail, user, offlineEmail,
    userFullName, recentOTs, otStatusFilter, setOtStatusFilter,
    setSelectedOTFromMenu, handleNavigate, handleInstallClick,
    installPrompt, configStatus, isOnline, isStandalone, screenSize,
    handleSelectInspectionType, selectedTask, aiData, handleFormSuccess,
    handleStartInspectionFromTask, otFilter, dictationNotebook,
    setDictationNotebook, handleAiAnalyze, aiLoading
  } = props;

  if (activeTab === TABS.MENU) {
    const fallbackName = (user?.email || offlineEmail || 'Inspector').split('@')[0];
    const capitalizedFallback = fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1);
    const nameToDisplay = userFullName || user?.displayName || capitalizedFallback;
    
    const menuProps = {
      onNavigate: handleNavigate,
      recentOTs: recentOTs,
      otStatusFilter: otStatusFilter,
      onStatusFilterChange: setOtStatusFilter,
      onSelectOT: (ot: any) => setSelectedOTFromMenu(ot),
      userName: nameToDisplay,
      onInstall: handleInstallClick,
      onConfigure: () => handleNavigate(TABS.PROFILE),
      canInstall: !!installPrompt,
      configStatus,
      isOnline: isOnline,
      isStandalone: isStandalone
    };

    return (
      <div className="w-full">
        {screenSize === 'desktop' ? (
          <MainMenuDesktop {...menuProps} />
        ) : screenSize === 'tablet' ? (
          <MainMenuTablet {...menuProps} />
        ) : (
          <MainMenuMobile {...menuProps} />
        )}
      </div>
    );
  }

  let Component: any;
  let componentProps: any = {};

  if (activeTab === TABS.NEW_INSPECTION) {
    if (!activeInspectionForm) return (
      <div className="w-full">
        <InspectionHub
          onSelectInspectionType={handleSelectInspectionType}
          onInstall={handleInstallClick}
          canInstall={!!installPrompt}
          isStandalone={isStandalone}
          hasPin={configStatus.hasPin}
        />
      </div>
    );

    switch (activeInspectionForm) {
      case 'hoja-trabajo': Component = HojaTrabajoFormLazy; break;
      case 'informe-tecnico': Component = InformeTecnicoFormLazy; break;
      case 'informe-revision': Component = InformeRevisionFormLazy; break;
      case 'informe-simplificado': Component = InformeSimplificadoFormLazy; break;
      case 'revision-basica': Component = RevisionBasicaFormLazy; break;
      default: Component = InformeTecnicoFormLazy;
    }
    componentProps = { 
      initialData: selectedTask, 
      aiData: aiData, 
      onSuccess: handleFormSuccess,
      userFullName: userFullName,
      effectiveEmail: effectiveEmail
    };
  } else {
    switch (activeTab) {
      case TABS.TASKS: Component = TasksTabLazy; componentProps = { onStartInspection: handleStartInspectionFromTask, onSelectOT: setSelectedOTFromMenu }; break;
      case TABS.HOURS: Component = BitacoraVisitasForm; componentProps = { otFilter, userFullName }; break;
      case TABS.EXPENSES: Component = RegistroGastoForm; componentProps = { otFilter }; break;
      case TABS.FILTERS: Component = BitacoraFiltrosForm; componentProps = { otFilter }; break;
      case TABS.PROFILE: Component = ProfileTabLazy; break;
      default: return <p className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest animate-pulse">Componente no encontrado</p>;
    }
  }

  return (
    <Suspense fallback={
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-xs">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2.5rem] p-6 shadow-2xl flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400 drop-shadow-lg" />
          <p className="text-white font-black uppercase tracking-[0.4em] text-[9px] opacity-90 drop-shadow-md text-center">
            Cargando Interfaz
          </p>
        </div>
      </div>
    }>
      <div className="w-full h-full">
        {activeInspectionForm && dictationNotebook && (
          <div className="mx-4 mb-6 p-5 bg-indigo-600 rounded-[2rem] flex justify-between items-center shadow-xl shadow-indigo-500/20 border border-white/10 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex-1">
              <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">Nota de Voz Pendiente</p>
              <p className="text-xs text-white line-clamp-1 italic font-medium">&quot;{dictationNotebook}&quot;</p>
            </div>
            <div className="flex gap-3 ml-4">
              <button onClick={() => setDictationNotebook('')} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[9px] font-black uppercase transition-all active:scale-95">Borrar</button>
              <button onClick={handleAiAnalyze} disabled={aiLoading} className="px-4 py-2 bg-white text-indigo-600 rounded-xl text-[9px] font-black uppercase shadow-lg flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <span>Procesar</span>}
              </button>
            </div>
          </div>
        )}
        <Component {...componentProps} />
      </div>
    </Suspense>
  );
}
