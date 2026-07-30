'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ArrowRight, Zap } from 'lucide-react';
import Link from 'next/link';
import Stats from './stats';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 50, damping: 20 }
  },
};

export default function Hero() {
  return (
    <section className="relative min-h-[95vh] flex flex-col justify-center pt-32 pb-16 sm:pb-20 px-4 md:px-6 z-10 overflow-hidden">
      
      {/* Decorative Blobs con Motion */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.5, scale: 1 }}
        transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/30 rounded-full mix-blend-screen filter blur-[100px] pointer-events-none" 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.5, scale: 1 }}
        transition={{ duration: 3, delay: 1, repeat: Infinity, repeatType: 'reverse' }}
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full mix-blend-screen filter blur-[100px] pointer-events-none" 
      />

      {/* FONDO EXCLUSIVO DEL HERO */}
      <div className="absolute inset-0 -z-20">
        <img src="/hero.jpg" alt="Fondo Tech" className="w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/60 to-transparent dark:from-[#030014]/95 dark:via-[#030014]/70 dark:to-transparent" />
      </div>

      {/* CONTENEDOR PRINCIPAL ANIMADO */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-7xl w-full mx-auto p-5 sm:p-8 md:p-12 lg:p-16 relative z-10"
      >
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-20 items-center relative z-20">

          {/* LADO IZQUIERDO: TEXTOS */}
          <div className="flex flex-col items-start text-left font-body">
            <motion.h1 variants={itemVariants} className="text-[2.5rem] sm:text-4xl md:text-5xl lg:text-[4.5rem] font-headline font-black mb-4 sm:mb-6 tracking-tighter leading-[1.05] text-slate-900 dark:text-white drop-shadow-sm">
              <span className="block opacity-90">Nombre de</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary block mt-1 drop-shadow-lg">
                Tu Empresa
              </span>
            </motion.h1>

            <motion.h2 variants={itemVariants} className="text-lg sm:text-2xl lg:text-3xl block font-bold text-slate-800 dark:text-slate-200 leading-snug mb-4 sm:mb-8 max-w-xl">
              Este es un <span className="text-primary glow-text">texto de demostración</span> que puedes reemplazar.
            </motion.h2>

            <motion.p variants={itemVariants} className="text-sm sm:text-lg max-w-xl mb-8 sm:mb-12 leading-relaxed font-semibold text-slate-600 dark:text-slate-400">
              [PÁGINA DE PRUEBA] Toda la información, textos, imágenes y colores de este sitio web son de prueba. Puedes reemplazarlos fácilmente con la información real de tu empresa, tus servicios y tu imagen corporativa.
            </motion.p>

            {/* BOTONES */}
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-3 sm:gap-6 w-full sm:w-auto">
              <Button asChild size="lg" className="w-full sm:w-auto h-14 sm:h-16 px-6 sm:px-10 text-sm sm:text-base font-black uppercase tracking-widest rounded-2xl shadow-[0_0_40px_-10px_rgba(0,255,255,0.4)] hover:shadow-[0_0_60px_-10px_rgba(0,255,255,0.6)] hover:scale-105 active:scale-95 transition-all group bg-primary hover:bg-primary/90 text-white border-none relative overflow-hidden">
                <Link href="#servicios" className="flex items-center justify-center gap-3">
                  <span className="relative z-10 flex items-center gap-2">Explorar Servicios <ArrowRight size={18} className="transition-transform group-hover:translate-x-2" /></span>
                </Link>
              </Button>

              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto h-14 sm:h-16 px-6 sm:px-10 text-sm sm:text-base font-black uppercase tracking-widest rounded-2xl border-white/20 hover:bg-white/10 dark:hover:bg-white/5 transition-all bg-white/40 dark:bg-black/20 backdrop-blur-xl text-slate-900 dark:text-white hover:scale-105 active:scale-95 group">
                <Link href="#contacto" className="flex items-center justify-center gap-2">
                  <Zap size={18} className="text-secondary group-hover:scale-110 group-hover:drop-shadow-[0_0_10px_rgba(255,0,255,0.8)] transition-all" /> Contactar
                </Link>
              </Button>
            </motion.div>
          </div>

          {/* LADO DERECHO: STATS */}
          <motion.div variants={itemVariants} className="w-full relative mt-8 lg:mt-0 perspective-1000">
            <motion.div whileHover={{ scale: 1.02, rotateY: -5 }} transition={{ type: "spring", stiffness: 100 }}>
              <Stats />
            </motion.div>
          </motion.div>

        </div>
      </motion.div>
    </section>
  );
}