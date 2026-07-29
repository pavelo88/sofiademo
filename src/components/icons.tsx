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
    <div className={cn("flex items-center justify-center transition-all duration-500 h-10 md:h-12", className)}>
      <img
        src={showText ? "/logo.png" : "/icon-512.png"}
        alt="Logo Empresa"
        className="h-full w-auto object-contain transition-opacity duration-300"
        onError={(e) => {
          (e.target as HTMLImageElement).src = logoBase64;
        }}
      />
    </div>
  );
};
