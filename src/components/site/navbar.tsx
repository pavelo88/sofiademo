'use client';

/* eslint-disable @next/next/no-img-element -- QA: warning reviewed; keeping current flow to avoid behavioral changes. */

import { Logo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { navLinks } from '@/lib/data';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Menu, UserCircle, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ThemeToggle } from './theme-toggle';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={cn(
      "fixed top-0 inset-x-0 z-50 flex justify-center transition-all duration-700 pointer-events-none",
      !isScrolled ? "px-4 pt-4 sm:pt-6" : "px-0 pt-0"
    )}>
      <header
        className={cn(
          "w-full transition-all duration-500 pointer-events-auto",
          !isScrolled
            ? "max-w-7xl mx-auto rounded-2xl sm:rounded-[2rem] bg-white/40 dark:bg-black/10 backdrop-blur-lg py-3 sm:py-5 border border-white/40 dark:border-white/5 shadow-xl"
            : "max-w-none rounded-none bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl py-3 border-b border-slate-200/50 dark:border-white/10 shadow-2xl"
        )}
      >
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 flex items-center justify-between gap-2">

          <Link
            href="/"
            className="block w-auto transition-transform hover:scale-[1.02] active:scale-95 relative group shrink-0"
          >
            <div className="absolute inset-0 bg-primary/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10 transform sm:scale-[1.15] origin-left">
              <Logo />
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div
            className={cn(
              "hidden lg:flex items-center gap-1 p-1.5 rounded-2xl",
              !isScrolled
                ? "bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10"
                : "bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5"
            )}
          >
            {navLinks.map((link) => (
              <Button
                key={link.href}
                variant="ghost"
                asChild
                className={cn(
                  "font-bold text-sm tracking-widest uppercase transition-all px-4 py-2.5 h-auto rounded-xl",
                  !isScrolled
                    ? "text-slate-800 dark:text-white hover:text-primary dark:hover:text-primary hover:bg-primary/10"
                    : "text-slate-800 dark:text-slate-300 hover:text-primary dark:hover:text-primary hover:bg-primary/10"
                )}
              >
                <Link href={link.href}>{link.label}</Link>
              </Button>
            ))}
          </div>

          {/* Desktop Auth */}
          <div className="hidden lg:flex items-center gap-4 shrink-0">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-slate-900/90 dark:bg-white/90 hover:bg-slate-900 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl px-6 h-12 text-sm font-black uppercase tracking-widest shadow-lg transition-transform hover:scale-105 active:scale-95 group border border-slate-700 dark:border-white/20">
                  <UserCircle className="w-5 h-5 mr-2 opacity-70 group-hover:opacity-100 transition-opacity" />
                  Acceso
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-2xl rounded-2xl p-2 mt-2">
                <DropdownMenuItem asChild className="focus:bg-primary/10 rounded-xl cursor-pointer p-0 group">
                  <Link href="/admin" className="flex items-center w-full px-4 py-4">
                    <div className="bg-blue-500/10 p-2 rounded-lg mr-3 group-hover:bg-blue-500/20 transition-colors">
                      <LayoutDashboard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="block font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">Gestión Administrativa</span>
                  </Link>
                </DropdownMenuItem>
                <div className="h-px bg-slate-200 dark:bg-white/10 my-1 mx-2" />
                <DropdownMenuItem asChild className="focus:bg-primary/10 rounded-xl cursor-pointer p-0 group">
                  <Link href="/inspection" className="flex items-center w-full px-4 py-4">
                    <div className="bg-primary/10 p-2 rounded-lg mr-3 group-hover:bg-primary/20 transition-colors">
                      <Wrench className="w-4 h-4 text-primary" />
                    </div>
                    <span className="block font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">Despliegue Técnico</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Navigation - DEFINITIVO */}
          <div className="lg:hidden flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl border-slate-300 dark:border-white/10 bg-white/60 dark:bg-black/20 backdrop-blur-md text-slate-900 dark:text-white shrink-0">
                  <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] sm:max-w-md bg-white/95 dark:bg-[#0d1117] border-l-[3px] border-l-transparent p-0 flex flex-col"
                style={{ borderImage: 'linear-gradient(to bottom, #22d3ee, #d946ef) 1' }}>

                {/* Cambio clave: overflow-y-auto para que nada se corte */}
                <div className="flex flex-col h-full p-6 relative overflow-y-auto">
                  <SheetHeader className="text-left mb-6 mt-4">
                    <SheetTitle className="font-black text-slate-900 dark:text-white text-3xl uppercase tracking-tighter">Menú</SheetTitle>
                    <SheetDescription className='text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px] tracking-widest'>Navegación principal.</SheetDescription>
                  </SheetHeader>

                  <div className="flex flex-col">
                    <div className="h-[2px] w-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 opacity-50 mb-4" />
                    {navLinks.map((link) => (
                      <div key={link.href} className="flex flex-col">
                        <SheetClose asChild>
                          <Link href={link.href} className="group flex items-center py-4 rounded-xl transition-all">
                            <span className="font-black text-slate-900 dark:text-slate-200 text-xl uppercase tracking-wider group-hover:text-cyan-500">{link.label}</span>
                          </Link>
                        </SheetClose>
                        <div className="h-[1px] w-full bg-gradient-to-r from-cyan-400/50 via-fuchsia-500/50 to-transparent mb-1" />
                      </div>
                    ))}
                  </div>

                  {/* Imagen reducida para dar espacio a los botones */}
                  <div className="relative w-full flex-shrink-0 flex items-center justify-center my-4 h-40">
                    <img src="/hamburguesa.png" alt="Energy Engine" className="max-h-full object-contain drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]" />
                  </div>

                  <div className="mt-auto space-y-4 pt-6 pb-4">
                    <SheetClose asChild>
                      <Button asChild className="w-full h-14 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl border border-cyan-500/30">
                        <Link href="/admin" className="flex items-center justify-center gap-3">
                          <LayoutDashboard className="w-5 h-5 text-cyan-400" />
                          <span className="text-[11px] font-black uppercase tracking-widest">Gestión Administrativa</span>
                        </Link>
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button asChild className="w-full h-14 bg-[#0a2e1f] text-emerald-400 border border-emerald-500/50 rounded-2xl">
                        <Link href="/inspection" className="flex items-center justify-center gap-3">
                          <Wrench className="w-5 h-5" />
                          <span className="text-[11px] font-black uppercase tracking-widest">Despliegue Técnico</span>
                        </Link>
                      </Button>
                    </SheetClose>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

        </div>
      </header>
    </div>
  );
}
