'use client';

import { cn } from '@/lib/utils';

export default function Footer() {
  return (
    <footer className={cn(
      "relative z-10 py-12 border-t transition-all duration-500",
      // Mismos colores y efectos que el Navbar scrolleado
      "bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-slate-200 dark:border-white/10"
    )}>
      <div className="max-w-7xl mx-auto px-6 flex flex-col items-center text-center">

        {/* Línea decorativa superior opcional */}
        <div className="w-12 h-1 bg-primary rounded-full mb-8 opacity-50" />

        <div className="space-y-4">
          <p className="text-[10px] md:text-xs font-headline font-bold uppercase tracking-[0.4em] text-slate-900 dark:text-slate-300">
            Engineering Mastery & Energy Solutions
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 text-xs font-medium text-slate-600 dark:text-slate-400">
            <p>© {new Date().getFullYear()} Energy Engine</p>
            <span className="hidden md:inline text-slate-300 dark:text-white/10">|</span>
            <p className="uppercase tracking-widest text-[10px]">Todos los derechos reservados</p>
          </div>
        </div>

      </div>
    </footer>
  );
}