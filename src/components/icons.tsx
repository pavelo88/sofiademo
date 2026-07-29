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

  return (
    <div className={cn("flex items-center gap-2 md:gap-3 transition-all duration-500", className)}>
      <div className="relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center shrink-0">
        <img
          src="/icon-512.png"
          alt="Icono Empresa"
          className="w-full h-full object-contain transition-opacity duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).src = logoBase64;
          }}
        />
      </div>
      {showText && (
        <div className="flex flex-col justify-center leading-none font-headline mt-1">
          <span className="text-lg md:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Tu <span className="text-cyan-500">Empresa</span>
          </span>
          <span className="text-[9px] md:text-[10px] font-black text-slate-500 dark:text-slate-400 tracking-[0.2em] uppercase mt-0.5 whitespace-nowrap">
            Tu Eslogan Corporativo
          </span>
        </div>
      )}
    </div>
  );
};
