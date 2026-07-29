'use client';

/* eslint-disable @next/next/no-img-element, react-hooks/set-state-in-effect -- QA: warning reviewed; keeping current flow to avoid behavioral changes. */

import { logoBase64 } from '@/lib/logo-base64';
import { cn } from '@/lib/utils';
import { Cpu } from 'lucide-react';
import { useEffect, useState } from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export const Logo = ({ className, showText = true }: LogoProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={cn("flex items-center gap-4", className)}>
        <div className="w-14 h-14 bg-slate-200/20 rounded-md animate-pulse" />
        {showText && (
          <div className="flex flex-col leading-none">
            <div className="h-6 w-36 bg-slate-200/20 animate-pulse rounded" />
            <div className="h-3 w-24 bg-slate-200/20 animate-pulse rounded mt-1" />
          </div>
        )}
      </div>
    );
  }

  const logoSrc = '/logo.png';

  return (
    <div className={cn("flex items-center gap-3 transition-all duration-500", className)}>
      <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-600 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20 border border-cyan-300/30">
        <Cpu className="w-6 h-6 text-white animate-pulse" />
      </div>
      {showText && (
        <div className="flex flex-col justify-center leading-none font-headline">
          <span className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            soft<span className="text-cyan-500">IA</span>
          </span>
          <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 tracking-[0.25em] uppercase mt-0.5 whitespace-nowrap">
            Tecnología & IA
          </span>
        </div>
      )}
    </div>
  );
};
