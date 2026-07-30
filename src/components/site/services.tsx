'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
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
import Image from 'next/image';
import React, { useMemo, useState } from 'react';
import ServiceLeadChat from './ServiceLeadChat';

export default function Services() {
  const autoplayPlugin = useMemo(() => Autoplay({ delay: 2500, stopOnInteraction: true }), []);

  return (
    <section id="servicios" className="py-24 relative z-10 overflow-hidden">

      {/* CAPA 2: EL CRISTAL / PELÍCULA (Encima de la imagen, debajo de las cards) */}
      <div className={cn(
        "absolute inset-0 z-[-1] pointer-events-none transition-all duration-500",
        // MODO CLARO: Vidrio blanco ultra transparente
        "bg-white/5 backdrop-blur-[2px]",
        // MODO OSCURO: Película negra ligerísima
        "dark:bg-black/20 dark:backdrop-blur-none"
      )} />

      <div className="max-w-[1260px] mx-auto px-6 md:px-12 relative z-10">
        {/* Cabecera con tipografía cuadrada técnica */}
        <div className="text-center mb-20">
          <h2 className="text-center text-[2.2rem] md:text-5xl font-display font-black mb-8 text-slate-950 dark:text-white leading-[1.1] tracking-tighter uppercase">
            Nuestros <span className="text-primary">Servicios</span>
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-base md:text-lg leading-relaxed font-bold">
            Soluciones electromecánicas de alta precisión. Disponibilidad <span className="text-slate-900 dark:text-white font-black">24/7/365</span>.
          </p>
        </div>

        {/* Desktop View: Grid */}
        <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>

        {/* Mobile View: Carousel */}
        <div className="md:hidden">
          <Carousel
            opts={{ loop: true, align: "start" }}
            plugins={[autoplayPlugin]}
            className="w-full"
          >
            <CarouselContent>
              {services.map((service) => (
                <CarouselItem key={service.id} className="basis-full px-1">
                  <div className="h-full py-2">
                    <ServiceCard service={service} />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>
      </div>
    </section>
  );
}

function ServiceCard({ service }: { service: Service }) {
  const IconComponent = service.icon;
  const [open, setOpen] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) setShowChat(false); // Reset chat when dialog closes
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <div className="group block w-full outline-none">
        <DialogTrigger asChild>
          <button type="button" className="block w-full text-left" onClick={() => setOpen(true)}>
            <Card className={cn(
              "relative overflow-hidden flex flex-col rounded-[2.5rem] transition-all duration-700 shadow-2xl border-none",
              "h-[32rem] md:h-[26rem] lg:h-[27rem] md:group-hover:h-[30rem]",
              "bg-white/10 backdrop-blur-sm border border-white/10",
              "dark:bg-slate-900/40"
            )}>
              <Image
                src={service.image}
                alt={service.title}
                fill
                className="object-cover object-center z-0 transition-all duration-1000 opacity-80 group-hover:opacity-100 md:group-hover:scale-110"
                sizes="(max-width: 768px) 100vw, 33vw"
              />

              <div className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-black/95 via-black/40 to-transparent z-10" />

              <div className="absolute inset-x-0 bottom-0 p-8 z-20 flex flex-col justify-end">
                {IconComponent && (
                  <div className="mb-4 w-12 h-12 flex items-center justify-center rounded-2xl bg-white/10 backdrop-blur-2xl border border-white/20 text-white transition-all group-hover:bg-white/20 group-hover:scale-110 shadow-lg">
                    <IconComponent className="w-6 h-6" />
                  </div>
                )}

                <div className="space-y-3">
                  <h3 className="text-xl md:text-2xl font-display font-black text-white tracking-tighter uppercase leading-none transition-all group-hover:translate-x-2 drop-shadow-sm">
                    {service.title}
                  </h3>
                  <p className="text-white/90 text-sm leading-relaxed font-medium">
                    {service.desc ?? service.description}
                  </p>
                </div>
              </div>
            </Card>
          </button>
        </DialogTrigger>
      </div>

      <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl bg-slate-950/80 backdrop-blur-3xl">
        {!showChat ? (
          /* ── Vista de detalle del servicio (Imagen Izquierda, Texto Derecha) ── */
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Lado Izquierdo: Imagen */}
            <div className="relative h-64 md:h-full w-full overflow-hidden min-h-[300px]">
              <Image
                src={service.image}
                alt={service.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent md:bg-gradient-to-r md:from-transparent md:to-slate-950/80" />
              <div className="absolute bottom-0 left-0 p-6 md:hidden">
                <DialogTitle className="text-2xl font-display font-black tracking-tight uppercase text-white drop-shadow-md">
                  {service.title}
                </DialogTitle>
              </div>
            </div>

            {/* Lado Derecho: Texto y CTA */}
            <div className="p-8 md:p-10 flex flex-col gap-6 justify-center bg-transparent">
              <div className="hidden md:block">
                <DialogTitle className="text-3xl font-display font-black tracking-tight uppercase text-white drop-shadow-sm">
                  {service.title}
                </DialogTitle>
              </div>
              <DialogDescription className="text-base leading-relaxed text-slate-300">
                {service.description}
              </DialogDescription>
              <CardContent className="p-0">
                <p className="text-base leading-relaxed text-slate-200">
                  {service.fullDescription}
                </p>
              </CardContent>

              {/* CTA → Abre el chat */}
              <button
                onClick={() => setShowChat(true)}
                className="mt-4 w-full h-14 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_4px_15px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_25px_rgba(255,255,255,0.1)] backdrop-blur-md"
              >
                <span className="text-lg">💬</span>
                Solicitar este servicio
              </button>
            </div>
          </div>
        ) : (
          /* ── Chat de IA ── */
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr]">
             {/* Info Panel en Chat */}
             <div className="hidden md:block relative h-full w-full overflow-hidden border-r border-white/10">
                <Image
                  src={service.image}
                  alt={service.title}
                  fill
                  className="object-cover opacity-50"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col justify-end p-8">
                   <h3 className="text-xl font-display font-black text-white uppercase mb-2">{service.title}</h3>
                   <p className="text-sm text-slate-400">Asistente Técnico Especializado</p>
                </div>
             </div>
            <div className="p-6 md:p-8 bg-transparent">
              <div className="mb-6">
                <button
                  onClick={() => setShowChat(false)}
                  className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors flex items-center gap-2"
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
