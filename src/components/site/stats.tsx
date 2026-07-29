'use client';

import { cn } from '@/lib/utils';
import { Clock, Globe, History, Zap } from 'lucide-react';

export default function Stats() {
  const stats = [
    { label: 'Años', value: '20+', desc: 'Experiencia en el Sector', icon: <History className="w-5 h-5" /> },
    { label: 'Días', value: '365', desc: 'Asistencia SAT Inmediata', icon: <Clock className="w-5 h-5" /> },
    { label: 'Total', value: 'Cobertura', desc: 'Península, Islas y Portugal', icon: <Globe className="w-5 h-5" /> },
    { label: 'Soporte', value: '24/7', desc: 'Servicio de Emergencia', icon: <Zap className="w-5 h-5" /> },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-6 w-full max-w-5xl mx-auto p-2">
      {stats.map((stat, idx) => (
        <div
          key={idx}
          className={cn(
            "p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-white/60 dark:border-white/10 shadow-xl shadow-cyan-900/5 dark:shadow-cyan-900/20 flex flex-col items-center justify-center text-center bg-white/40 dark:bg-black/40 backdrop-blur-md hover:bg-white/60 dark:hover:bg-black/60 transition-all duration-300 group"
          )}
        >
          {/* Icono pequeño y centrado */}
          <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/10 dark:from-cyan-500/30 dark:to-blue-500/10 p-3 md:p-4 rounded-2xl text-cyan-600 dark:text-cyan-400 mb-3 md:mb-5 border border-white/50 dark:border-white/10 shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
            {stat.icon}
          </div>

          <div className="flex flex-col items-center w-full">
            <span className={cn(
              "font-headline font-black tracking-tighter leading-none text-slate-900 dark:text-white drop-shadow-sm",
              stat.value.length > 5 ? "text-xl md:text-3xl" : "text-3xl md:text-5xl"
            )}>
              {stat.value}
            </span>
            <span className="text-[9px] md:text-xs font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-[0.2em] mt-2">
              {stat.label}
            </span>
          </div>

          <p className="text-[10px] md:text-sm text-slate-600 dark:text-slate-400 font-bold mt-2 leading-tight max-w-[140px] md:max-w-full">
            {stat.desc}
          </p>
        </div>
      ))}
    </div>
  );
}