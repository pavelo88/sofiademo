'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Service, services } from '@/lib/data';
import { cn } from '@/lib/utils';
import Autoplay from 'embla-carousel-autoplay';
import { ArrowRight, Zap } from 'lucide-react';
import Image from 'next/image';
import React, { useEffect, useMemo, useState } from 'react';
import ServiceLeadChat from './ServiceLeadChat';

export default function Services() {
  const autoplayPlugin = useMemo(
    () => Autoplay({ delay: 3500, stopOnInteraction: false, stopOnMouseEnter: false }),
    []
  );
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  return (
    <section id="servicios" className="py-16 sm:py-24 relative z-10 overflow-hidden bg-slate-50/95 dark:bg-slate-950/95 text-slate-900 dark:text-white transition-colors duration-500">

      {/* CAPA 1: FONDO VECTORIAL ESTRUCTURADO */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40 dark:opacity-30">
        <svg className="w-full h-full stroke-slate-300 dark:stroke-cyan-500/20" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="terra-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" strokeWidth="0.8" />
              <circle cx="60" cy="60" r="1.5" className="fill-cyan-600/40 dark:fill-cyan-400/40" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#terra-grid)" />
        </svg>
        <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-cyan-400/10 dark:bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-[140px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 relative z-10">
        
        {/* ENCABEZADO Y CONTROLES DEL CARRUSEL CONTINUO */}
        <Carousel
          setApi={setApi}
          opts={{ loop: true, align: "center" }}
          plugins={[autoplayPlugin]}
          className="w-full"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 sm:mb-12 gap-6">
            <div className="space-y-2.5 max-w-2xl text-left">
              <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-700 dark:text-cyan-400 text-[10px] font-black uppercase tracking-[0.25em]">
                <Zap size={12} className="animate-pulse text-cyan-600 dark:text-cyan-400" />
                <span>Ingeniería Electromecánica High-Tech</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-headline font-black tracking-tight uppercase leading-[1.08] text-slate-950 dark:text-white">
                Nuestros <span className="text-cyan-600 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-cyan-400 dark:via-teal-300 dark:to-cyan-200">Servicios</span>
              </h2>
              <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed font-semibold">
                Suministro, mantenimiento y monitoreo especializado. Disponibilidad técnica <span className="text-cyan-700 dark:text-cyan-300 font-black">24/7/365</span>.
              </p>
            </div>

            {/* Navegación del Carrusel con Botones Flotantes de Cristal */}
            <div className="flex items-center gap-2.5 shrink-0 self-start md:self-end">
              <CarouselPrevious className="static transform-none h-10 w-10 rounded-xl bg-white dark:bg-white/10 hover:bg-cyan-500/10 border border-slate-200 dark:border-white/20 text-slate-800 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-300 transition-all backdrop-blur-md shadow-md" />
              <CarouselNext className="static transform-none h-10 w-10 rounded-xl bg-white dark:bg-white/10 hover:bg-cyan-500/10 border border-slate-200 dark:border-white/20 text-slate-800 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-300 transition-all backdrop-blur-md shadow-md" />
            </div>
          </div>

          {/* CONTENIDO DEL CARRUSEL — 3 completas en desktop, 1 en móvil, loop infinito limpio */}
          <div className="py-4">
            <CarouselContent className="-ml-4 sm:-ml-5">
              {services.map((service, index) => {
                const isActive = index === current;
                return (
                  <CarouselItem
                    key={service.id}
                    className="pl-4 sm:pl-5 basis-full sm:basis-1/2 lg:basis-1/3"
                  >
                    <div
                      className={cn(
                        "h-full transition-all duration-500 transform-gpu",
                        isActive ? "scale-100 opacity-100" : "scale-95 opacity-70"
                      )}
                    >
                      <ServiceCard service={service} index={index} isActive={isActive} />
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
          </div>
        </Carousel>
      </div>
    </section>
  );
}

function ServiceCard({ service, index, isActive }: { service: Service; index: number; isActive: boolean }) {
  const IconComponent = service.icon;
  const [open, setOpen] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) setShowChat(false);
  };

  const badges = [
    '● DISPONIBILIDAD 24/7',
    '● COBERTURA NACIONAL',
    '● TELEMETRÍA EN TIEMPO REAL',
    '● REPUESTOS ORIGINALES',
  ];
  const currentBadge = badges[index % badges.length];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <div className="group block w-full h-full outline-none">
        <DialogTrigger asChild>
          <button type="button" className="block w-full h-full text-left" onClick={() => setOpen(true)}>
            <Card className={cn(
              /* 📌 TARJETAS SLIM COMPACTAS CON ESQUINAS CURVAS (rounded-[2.2rem]) */
              "relative overflow-hidden flex flex-col rounded-[2.2rem] transition-all duration-500 border w-full",
              isActive 
                ? "h-[20.5rem] sm:h-[21.5rem] lg:h-[22.5rem]" 
                : "h-[17.5rem] sm:h-[18.5rem] lg:h-[19.5rem]",
              /* MODO CLARO: Cristal fino transparente */
              "bg-white/25 border-white/70 text-slate-900 group-hover:border-cyan-500/60 shadow-lg group-hover:shadow-xl",
              /* MODO OSCURO: Cristal oscuro */
              "dark:bg-slate-900/80 dark:border-cyan-500/30 dark:text-white dark:group-hover:border-cyan-400/60 dark:group-hover:shadow-[0_0_25px_rgba(6,182,212,0.25)]",
              isActive && "ring-2 ring-cyan-500/50 shadow-xl shadow-cyan-500/10"
            )}>
              {/* Imagen de fondo nítida */}
              <Image
                src={service.image}
                alt={service.title}
                fill
                className="object-cover object-center z-0 transition-all duration-500 opacity-90 dark:opacity-80 group-hover:opacity-100 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />

              {/* Degradado protector en la parte inferior */}
              <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-white via-white/85 to-transparent dark:from-slate-950 dark:via-slate-950/85 dark:to-transparent z-10" />

              {/* Píldora Flotante Cápsula */}
              <div className="absolute top-4 left-4 z-20">
                <span className="px-2.5 py-1 rounded-full bg-white/90 text-slate-900 dark:bg-slate-950/90 dark:text-cyan-300 backdrop-blur-md border border-slate-200/80 dark:border-cyan-500/30 text-[9px] font-black uppercase tracking-wider shadow-md flex items-center gap-1">
                  {currentBadge}
                </span>
              </div>

              {/* Contenido mini-compacto */}
              <div className="absolute inset-x-0 bottom-0 p-4.5 sm:p-5 z-20 flex flex-col justify-end">
                {IconComponent && (
                  <div className="mb-2.5 w-9 h-9 flex items-center justify-center rounded-xl bg-cyan-600/10 dark:bg-cyan-500/15 backdrop-blur-md border border-cyan-600/25 dark:border-cyan-500/30 text-cyan-700 dark:text-cyan-400 transition-all group-hover:scale-110 shadow-sm">
                    <IconComponent className="w-4 h-4" />
                  </div>
                )}

                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-headline font-black text-slate-950 dark:text-white tracking-tight uppercase leading-snug group-hover:text-cyan-700 dark:group-hover:text-cyan-300 transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-slate-700 dark:text-slate-300 text-[11px] sm:text-xs leading-relaxed font-semibold">
                    {service.desc ?? service.description}
                  </p>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-slate-300/70 dark:border-white/10 flex items-center justify-between text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-cyan-700 dark:text-cyan-400 group-hover:text-cyan-900 dark:group-hover:text-cyan-200">
                  <span>Ver Detalles</span>
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Card>
          </button>
        </DialogTrigger>
      </div>

      {/* POPUP MODAL MANTENIDO INTACTO */}
      <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl bg-white dark:bg-slate-950/90 backdrop-blur-3xl">
        {!showChat ? (
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="relative h-64 md:h-full w-full overflow-hidden min-h-[320px]">
              <Image
                src={service.image}
                alt={service.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent dark:from-slate-950 dark:via-slate-950/20 md:bg-gradient-to-r md:from-transparent md:to-white dark:md:to-slate-950" />
              <div className="absolute bottom-0 left-0 p-6 md:hidden">
                <DialogTitle className="text-2xl font-headline font-black tracking-tight uppercase text-slate-950 dark:text-white drop-shadow-md">
                  {service.title}
                </DialogTitle>
              </div>
            </div>

            <div className="p-8 md:p-10 flex flex-col gap-6 justify-center bg-transparent text-slate-900 dark:text-white">
              <div className="hidden md:block">
                <DialogTitle className="text-3xl font-headline font-black tracking-tight uppercase text-slate-950 dark:text-white drop-shadow-sm">
                  {service.title}
                </DialogTitle>
              </div>
              <DialogDescription className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
                {service.description}
              </DialogDescription>
              <CardContent className="p-0">
                <p className="text-base leading-relaxed text-slate-800 dark:text-slate-200">
                  {service.fullDescription}
                </p>
              </CardContent>

              <button
                onClick={() => setShowChat(true)}
                className="mt-4 w-full h-14 rounded-xl bg-cyan-600 dark:bg-cyan-500/20 hover:bg-cyan-700 dark:hover:bg-cyan-500/30 border border-cyan-500/40 text-white dark:text-cyan-200 font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all duration-300 backdrop-blur-md shadow-lg"
              >
                <span className="text-lg">💬</span>
                Solicitar este servicio
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr]">
             <div className="hidden md:block relative h-full w-full overflow-hidden border-r border-slate-200 dark:border-white/10">
                <Image
                  src={service.image}
                  alt={service.title}
                  fill
                  className="object-cover opacity-50"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-white/90 dark:bg-slate-950/80 backdrop-blur-sm flex flex-col justify-end p-8">
                   <h3 className="text-xl font-headline font-black text-slate-950 dark:text-white uppercase mb-2">{service.title}</h3>
                   <p className="text-sm text-cyan-700 dark:text-cyan-400 font-bold">Asistente Técnico Especializado</p>
                </div>
             </div>
            <div className="p-6 md:p-8 bg-transparent">
              <div className="mb-6">
                <button
                  onClick={() => setShowChat(false)}
                  className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-2"
                >
                  ← Volver a {service.title}
                </button>
              </div>
              <ServiceLeadChat
                serviceName={service.title}
                onClose={() => handleOpenChange(false)}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
