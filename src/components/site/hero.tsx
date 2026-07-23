'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowRight, Zap } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import Stats from './stats';

export default function Hero() {
  return (
    <section className="relative min-h-[95vh] flex flex-col justify-center pt-32 pb-16 sm:pb-20 px-4 md:px-6 z-10 overflow-hidden">

      {/* Decorative Blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob dark:hidden" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000 dark:hidden" />
      <div className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-primary/20 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000 dark:hidden" />

      {/* FONDO EXCLUSIVO DEL HERO (hero.png) */}
      <div className="absolute inset-0 -z-20">
        <Image src="/hero.png" alt="Fondo Hero Energy Engine" fill className="object-cover object-center" priority />
        {/* Un degradado sutil que oscurece/aclara SOLO la parte del texto (izquierda) para legibilidad, dejando el lado derecho libre para ver el motor */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/40 to-transparent dark:from-slate-950/95 dark:via-slate-950/60 dark:to-transparent" />
      </div>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="max-w-7xl w-full mx-auto p-5 sm:p-8 md:p-12 lg:p-16 relative z-10">

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-20 items-center relative z-20">

          {/* LADO IZQUIERDO: TEXTOS */}
          <div className="flex flex-col items-start text-left font-body">

            <h1 className="text-[2.5rem] sm:text-4xl md:text-5xl lg:text-[4rem] font-headline font-black mb-4 sm:mb-6 tracking-tighter leading-[1.05] text-slate-900 dark:text-white drop-shadow-sm">
              <span className="block opacity-90">Energía que</span>
              <span className="text-primary block mt-1">
                nunca se detiene
              </span>
            </h1>

            {/* CONTRASTE ALTO AQUÍ: Cambiado de text-slate-600 a text-slate-800 */}
            <h2 className="text-lg sm:text-2xl lg:text-3xl block font-bold text-slate-800 dark:text-slate-200 leading-snug mb-4 sm:mb-8 max-w-xl">
              Especialistas en la ingeniería y <span className="text-slate-950 dark:text-white">reparación industrial</span> de grupos electrógenos.
            </h2>

            {/* CONTRASTE ALTO AQUÍ: Cambiado a text-slate-900 y font-semibold para lectura impecable */}
            <p className="text-sm sm:text-lg max-w-xl mb-8 sm:mb-12 leading-relaxed font-semibold text-slate-900 dark:text-slate-300">
              Más de 20 años asegurando la continuidad operativa del sector industrial, marítimo y energético. Optimizamos su infraestructura bajo los más estrictos estándares.
            </p>

            {/* BOTONES: Ahora son flex-col en móviles para no salirse de la pantalla */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 w-full sm:w-auto">
              <Button asChild size="lg" className="w-full sm:w-auto h-14 sm:h-16 px-6 sm:px-10 text-sm sm:text-base font-black uppercase tracking-widest rounded-2xl shadow-[0_4px_15px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_25px_rgba(0,0,0,0.15)] hover:scale-105 active:scale-95 transition-all group bg-primary hover:bg-primary/90 text-white border-none relative overflow-hidden">
                <Link href="#servicios" className="flex items-center justify-center gap-3">
                  <span className="relative z-10 flex items-center gap-2">Explorar Servicios <ArrowRight size={18} className="transition-transform group-hover:translate-x-2" /></span>
                </Link>
              </Button>

              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto h-14 sm:h-16 px-6 sm:px-10 text-sm sm:text-base font-black uppercase tracking-widest rounded-2xl border-slate-400/50 dark:border-white/10 hover:bg-white/50 dark:hover:bg-white/5 transition-all bg-white/60 dark:bg-black/10 backdrop-blur-md text-slate-900 dark:text-white hover:scale-105 active:scale-95 group">
                <Link href="#contacto" className="flex items-center justify-center gap-2">
                  <Zap size={18} className="text-amber-500 group-hover:scale-110 transition-transform" /> Contactar
                </Link>
              </Button>
            </div>
          </div>

          <div className="w-full relative mt-8 lg:mt-0">
            <Stats />
          </div>

        </div>
      </div>
    </section>
  );
}