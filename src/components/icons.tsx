'use client';

/* eslint-disable @next/next/no-img-element, react-hooks/set-state-in-effect -- QA: warning reviewed; keeping current flow to avoid behavioral changes. */

import { logoBase64 } from '@/lib/logo-base64';
import { cn } from '@/lib/utils';
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
    <div className={cn("flex items-center gap-2 md:gap-4 transition-all duration-500", className)}>
      <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
        <img
          src={logoSrc}
          alt="energy engine logo"
          width={56}
          height={56}
          className="object-contain transition-opacity duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).src = logoBase64;
          }}
        />
      </div>
      {showText && (
        <div className="flex flex-col justify-center leading-none mt-1 font-headline">
          <span className="text-xl md:text-3xl font-bold tracking-tight text-primary lowercase italic">
            energy engine
          </span>
          <span className="text-[11px] font-black text-slate-500 dark:text-white tracking-[0.2em] uppercase mt-0.5 whitespace-nowrap">
            grupos electrógenos
          </span>
        </div>
      )}
    </div>
  );
};
