'use client';

import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Settings,
  Smartphone,
  Wrench
} from 'lucide-react';

type ReportType = 'hoja-trabajo' | 'informe-tecnico' | 'informe-revision' | 'informe-simplificado';

export default function InspectionHub({ 
  onSelectInspectionType,
  onInstall,
  canInstall,
  isStandalone,
  hasPin
}: { 
  onSelectInspectionType: (type: ReportType, data?: any) => void;
  onInstall?: () => void;
  canInstall?: boolean;
  isStandalone?: boolean;
  hasPin?: boolean;
}) {
  const reportTypes = [
    { id: 'hoja-trabajo' as ReportType, title: 'Hoja de Trabajo', subtitle: 'Materiales y Servicios', icon: FileText, theme: 'forest' },
    { id: 'informe-tecnico' as ReportType, title: 'Informe Técnico', subtitle: 'Reporte Detallado', icon: Settings, theme: 'aqua' },
    { id: 'informe-revision' as ReportType, title: 'Inf. de Revisión', subtitle: 'Checklist Completo', icon: ClipboardCheck, theme: 'lime' },
    { id: 'informe-simplificado' as ReportType, title: 'Simplificado', subtitle: 'Equipos sin Checklist', icon: Wrench, theme: 'silver' },
  ];

  const themes: Record<string, string> = {
    forest: "from-[#102d1d] via-[#1a442c] to-[#0d2518] text-white border-[#276340]",
    aqua: "from-[#419d94] via-[#5dd4c9] to-[#36857d] text-white border-[#7ae3da]",
    lime: "from-[#7ba64f] via-[#9ad462] to-[#688c42] text-white border-[#b1eb77]",
    silver: "from-[#e2e8f0] via-[#ffffff] to-[#cbd5e1] text-[#0f172a] border-white shadow-slate-300",
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
      
      {/* Sección para crear un nuevo informe */}
      <section className="space-y-6">
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 text-center">Selecciona tipo de informe</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8">
          {reportTypes.map(type => {
            const currentTheme = themes[type.theme];
            const isSilver = type.theme === 'silver';
            const textShadowWhite = "0px 2px 4px rgba(0,0,0,0.3), 0px 4px 10px rgba(0,0,0,0.15)";
            const textShadowSilver = "0px 1px 1px rgba(255,255,255,1), 0px 3px 6px rgba(0,0,0,0.1)";
            const currentTextShadow = isSilver ? textShadowSilver : textShadowWhite;

            return (
              <button 
                key={type.id}
                onClick={() => onSelectInspectionType(type.id)}
                className={`group relative w-full flex flex-col p-6 rounded-[2.2rem] bg-gradient-to-br ${currentTheme} border-t border-l shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 overflow-hidden min-h-[140px] justify-center`}
              >
                <div className="absolute top-0 left-0 w-full h-[40%] bg-gradient-to-b from-white/20 to-transparent pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-full h-[40%] bg-gradient-to-t from-black/10 to-transparent pointer-events-none"></div>

                <div className="flex items-center gap-5 z-10 w-full">
                  <div className={`shrink-0 w-16 h-16 rounded-[1.4rem] flex items-center justify-center backdrop-blur-xl border border-white/25 shadow-inner group-hover:rotate-3 transition-transform ${isSilver ? 'bg-[#1a2e25]/5 shadow-black/5' : 'bg-white/10 shadow-black/20'}`}>
                    <type.icon 
                      size={34} 
                      strokeWidth={2.5}
                      className={`drop-shadow-xl ${isSilver ? 'text-[#0f172a]' : 'text-white'}`} 
                    />
                  </div>

                  <div className="text-left flex-grow min-w-0">
                    <h3 className="font-black leading-none tracking-tighter truncate" style={{ textShadow: currentTextShadow }}>
                      <span className="opacity-80 text-[11px] block mb-0.5 font-black tracking-[0.15em] uppercase">TIPO INFORME</span>
                      <span className="text-[20px] xs:text-[24px] sm:text-[20px] md:text-[26px] block uppercase truncate">{type.title}</span>
                    </h3>
                    <p className="text-[11px] font-black tracking-[0.25em] opacity-90 uppercase drop-shadow-md truncate mt-1">
                      {type.subtitle}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* INSTALAR COMO APP */}
      <section className="pt-2">
        {isStandalone ? (
          <div className="w-full h-20 bg-[#165a30]/10 border border-[#165a30]/30 text-[#165a30] rounded-[2rem] font-black uppercase tracking-widest flex items-center justify-center gap-4 shadow-sm">
            <CheckCircle2 size={24} />
            <div className="text-left">
              <p className="text-sm font-black text-[#165a30]">APP INSTALADA ✓</p>
              <p className="text-[9px] text-[#165a30]/70 font-bold uppercase tracking-widest">Estás usando la versión nativa</p>
            </div>
          </div>
        ) : (
          <button 
            onClick={onInstall}
            disabled={!hasPin || !canInstall}
            className={cn(
               "w-full h-20 rounded-[2rem] font-black uppercase tracking-widest flex items-center justify-center gap-4 transition-all shadow-xl active:scale-95",
               !hasPin || !canInstall 
                 ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed" 
                 : "bg-slate-900 text-white hover:bg-slate-800"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              !hasPin || !canInstall ? "bg-slate-200 text-slate-400" : "bg-primary/20 text-primary"
            )}>
              <Smartphone size={20} />
            </div>
            <div className="text-left text-xs">
              <p className="font-black uppercase tracking-tighter">
                {!hasPin ? 'Configura PIN para instalar' : !canInstall ? 'Instalación no disponible' : 'Instalar energy engine'}
              </p>
              <p className={cn(
                "text-[9px] font-bold uppercase tracking-widest",
                !hasPin || !canInstall ? "text-slate-400" : "text-white/50"
              )}>
                {!hasPin ? 'Paso de seguridad obligatorio' : !canInstall ? 'Usa Chrome/Edge para instalar' : 'Para informes offline'}
              </p>
            </div>
          </button>
        )}
      </section>
    </div>
  );
}
