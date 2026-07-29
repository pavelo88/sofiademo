'use client';

import { cn } from '@/lib/utils';
import { Check, ChevronLeft, Download, RotateCw } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  isOnline: boolean;
  onBack: () => void;
  isSubNavActive: boolean;
  onInstall: () => void;
  canInstall: boolean;
  isStandalone?: boolean;
}

export default function Header({ isOnline, onBack, onInstall, isStandalone }: HeaderProps) {
  // El usuario solicitó que el botón de la flechita (atrás) esté siempre visible.
  const showBackButton = true;

  return (
    <header className="fixed top-0 left-0 w-full px-4 sm:px-6 bg-[#0a2e1f] flex justify-between items-center z-50 h-16 sm:h-20 border-b border-white/10 shadow-2xl">
      <div className="flex items-center gap-2 sm:gap-4">
        {showBackButton && (
          <button 
            onClick={onBack} 
            className="w-10 h-10 sm:w-12 sm:h-12 bg-white/10 rounded-xl flex items-center justify-center text-white border border-white/10 hover:bg-white/20 transition-all active:scale-95 shadow-md shrink-0"
            aria-label="Volver"
          >
            <ChevronLeft size={24} className="sm:w-7 sm:h-7" />
          </button>
        )}
        <div className="flex flex-col leading-none">
          <div className="font-headline italic tracking-tighter text-xl sm:text-3xl font-black">
            <span className="text-white">soft<span className="text-cyan-400">IA</span></span>
            <span className="text-cyan-400 sm:text-cyan-300 ml-1">tech</span>
          </div>
          <span className="text-[8px] sm:text-[10px] font-black text-white/70 tracking-[0.1em] sm:tracking-[0.3em] uppercase mt-1">INTRANET TÉCNICA</span>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-3">
        <div className={cn(
            "flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full text-[9px] sm:text-[10px] font-black border transition-all duration-500 shadow-inner",
            isOnline 
                ? "border-emerald-400/30 text-emerald-50 bg-emerald-400/10" 
                : "border-red-400/50 text-red-100 bg-red-500/20"
        )}>
            <div className={cn(
                "w-2 h-2 rounded-full",
                isOnline ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" : "bg-red-400 shadow-[0_0_8px_#f87171]"
            )} />
            <span className="hidden sm:inline">{isOnline ? 'CONECTADO' : 'SIN RED'}</span>
            <span className="sm:hidden">{isOnline ? 'ON' : 'OFF'}</span>
        </div>
        <button 
          onClick={() => window.location.reload()} 
          className="w-10 h-10 sm:w-12 sm:h-12 bg-white/5 rounded-xl sm:rounded-2xl flex items-center justify-center text-slate-300 border border-white/10 hover:bg-white/10 transition-all active:scale-95 shadow-lg shrink-0" 
          title="Actualizar Aplicación"
        >
          <RotateCw size={18} className="sm:w-5 sm:h-5" />
        </button>
        {isStandalone ? (
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-500/30 shadow-lg shrink-0" title="App Descargada">
            <Check size={18} className="sm:w-5 sm:h-5" />
          </div>
        ) : (
          <button 
            onClick={onInstall} 
            className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all active:scale-95 shadow-lg shrink-0" 
            title="Instalar App (PWA)"
          >
            <Download size={18} className="sm:w-5 sm:h-5" />
          </button>
        )}
      </div>
    </header>
  );
}
