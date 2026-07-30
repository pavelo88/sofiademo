'use client';

import { cn } from '@/lib/utils';
import {
  ClipboardCheck,
  FileText,
  Settings,
  Wrench
} from 'lucide-react';

type ReportType = 'hoja-trabajo' | 'informe-tecnico' | 'informe-revision' | 'informe-simplificado';

export default function InspectionHub({ 
  onSelectInspectionType
}: { 
  onSelectInspectionType: (type: ReportType, data?: any) => void;
  onInstall?: () => void;
  canInstall?: boolean;
  isStandalone?: boolean;
  hasPin?: boolean;
}) {
  const reportTypes = [
    { id: 'hoja-trabajo' as ReportType, title: 'Hoja de Trabajo', subtitle: 'Materiales y Servicios', icon: FileText, theme: 'cianOceano' },
    { id: 'informe-tecnico' as ReportType, title: 'Informe Técnico', subtitle: 'Reporte Detallado', icon: Settings, theme: 'cianClaro' },
    { id: 'informe-revision' as ReportType, title: 'Informe de Revisión', subtitle: 'Checklist Completo', icon: ClipboardCheck, theme: 'verdeAgua' },
    { id: 'informe-simplificado' as ReportType, title: 'Informe Simplificado', subtitle: 'Equipos sin Checklist', icon: Wrench, theme: 'silver' },
  ];

  // 3 primeros botones con letras totalmente blancas
  const themes: Record<string, { bg: string; text: string; subtext: string; iconBg: string; iconColor: string }> = {
    cianOceano: {
      bg: "from-[#0e7490] via-[#0891b2] to-[#155e75] border-cyan-300/40 shadow-cyan-500/25",
      text: "text-white",
      subtext: "text-white/90",
      iconBg: "bg-white/20 border-white/30",
      iconColor: "text-white"
    },
    cianClaro: {
      bg: "from-[#22d3ee] via-[#06b6d4] to-[#0891b2] border-cyan-200/50 shadow-cyan-400/30",
      text: "text-white",
      subtext: "text-white/90",
      iconBg: "bg-white/20 border-white/30",
      iconColor: "text-white"
    },
    verdeAgua: {
      bg: "from-[#419d94] via-[#5dd4c9] to-[#36857d] border-[#7ae3da] shadow-teal-500/25",
      text: "text-white",
      subtext: "text-white/90",
      iconBg: "bg-white/20 border-white/30",
      iconColor: "text-white"
    },
    silver: {
      bg: "from-[#e2e8f0] via-[#ffffff] to-[#cbd5e1] border-white shadow-slate-300",
      text: "text-[#0f172a] font-black",
      subtext: "text-[#334155] font-bold",
      iconBg: "bg-[#0f172a]/10 border-[#0f172a]/20",
      iconColor: "text-[#0f172a]"
    },
  };

  return (
    /* 📌 ESPACIO SUPERIOR (pt-4 sm:pt-8) Y LATERAL (px-6 sm:px-10 md:px-14) PARA QUE RESPIRE */
    <div className="space-y-5 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-4xl lg:max-w-5xl mx-auto px-6 sm:px-10 md:px-14 pt-4 sm:pt-8 pb-8">
      
      {/* Sección para crear un nuevo informe */}
      <section className="space-y-4 sm:space-y-6">
        {/* 📌 TÍTULO: Espacio superior para respirar y letras legibles */}
        <h2 className="text-[14px] sm:text-[16px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-[0.25em] px-2 text-center drop-shadow-sm">
          Selecciona tipo de informe
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5 md:gap-6">
          {reportTypes.map(type => {
            const currentTheme = themes[type.theme];
            const isSilver = type.theme === 'silver';
            const textShadow = isSilver 
              ? "0px 1px 2px rgba(255,255,255,0.8)" 
              : "0px 2px 8px rgba(0,0,0,0.5), 0px 1px 3px rgba(0,0,0,0.3)";

            return (
              <button 
                key={type.id}
                onClick={() => onSelectInspectionType(type.id)}
                /* 
                  ========================================================================================
                  📌 DÓNDE AJUSTAR EL ALTO DE LOS CUADROS MANUAMENTE:
                  - min-h-[102px]  --> Alto mínimo en celulares
                  - sm:min-h-[142px] --> Alto mínimo en tablets
                  - md:min-h-[160px] --> Alto mínimo en computadoras / laptops
                  ========================================================================================
                */
                className={`group relative w-full flex flex-col p-4 sm:p-5.5 md:p-6.5 rounded-2xl sm:rounded-[2rem] bg-gradient-to-br ${currentTheme.bg} border-t border-l shadow-lg sm:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 overflow-hidden min-h-[102px] sm:min-h-[142px] md:min-h-[160px] justify-center text-left`}
              >
                {/* Resplandores superiores e inferiores */}
                <div className="absolute top-0 left-0 w-full h-[40%] bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-full h-[40%] bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />

                <div className="flex items-center gap-3.5 sm:gap-5 z-10 w-full">
                  <div className={`shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-[1.4rem] flex items-center justify-center backdrop-blur-xl border ${currentTheme.iconBg} shadow-inner group-hover:rotate-6 group-hover:scale-105 transition-transform duration-300`}>
                    <type.icon 
                      className={`w-6 h-6 sm:w-8 sm:h-8 drop-shadow-md ${currentTheme.iconColor}`} 
                      strokeWidth={2.3}
                    />
                  </div>

                  <div className="text-left flex-grow min-w-0">
                    <h3 className={`font-black leading-tight tracking-tighter ${currentTheme.text}`} style={{ textShadow }}>
                      {/* 📌 SALTO DE LÍNEA FLUIDO SI NO QUEPEN LAS LETRAS (sin entrecortar ni usar ...) */}
                      <span className="text-[17px] sm:text-[21px] md:text-[25px] block uppercase break-words leading-tight">{type.title}</span>
                    </h3>
                    <p className={`text-[10px] sm:text-[12px] font-black tracking-[0.18em] uppercase drop-shadow-sm break-words mt-1 ${currentTheme.subtext}`}>
                      {type.subtitle}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
