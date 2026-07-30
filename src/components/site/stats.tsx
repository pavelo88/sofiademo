'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Clock, Globe, History, Zap } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.8, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring" as any, stiffness: 100, damping: 15 }
  }
};

export default function Stats() {
  const stats = [
    { label: 'Años', value: '20+', desc: 'Experiencia Tecnológica', icon: <History className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" /> },
    { label: 'Días', value: '365', desc: 'Soporte Global', icon: <Clock className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" /> },
    { label: 'Total', value: 'Global', desc: 'Presencia Mundial', icon: <Globe className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" /> },
    { label: 'Soporte', value: '24/7', desc: 'Respuesta Inmediata', icon: <Zap className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" /> },
  ];

  return (
    /* 
      ===================================================================
      📌 DÓNDE SEPARAR LOS CUADROS Y AJUSTAR TAMAÑO:
      - gap-4 (móvil) / sm:gap-5 (tablet) / md:gap-6 (desktop)  --> SEPARACIÓN
      - max-w-[310px] / sm:max-w-[360px] / md:max-w-[420px]     --> ANCHO TOTAL DEL GRID
      ===================================================================
    */
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      className="grid grid-cols-2 gap-4 sm:gap-5 md:gap-6 w-full max-w-[310px] sm:max-w-[360px] md:max-w-[420px] mx-auto p-2"
    >
      {stats.map((stat, idx) => (
        <motion.div
          key={idx}
          variants={itemVariants}
          whileHover={{ scale: 1.05, y: -5, boxShadow: "0 20px 40px -10px rgba(0,255,255,0.25)" }}
          /* 📌 aspect-square hace que los cuadros sean 100% CUADRADOS perfectos */
          className={cn(
            "aspect-square p-3 sm:p-4 md:p-5 rounded-2xl md:rounded-3xl border border-white/60 dark:border-white/10 shadow-lg shadow-cyan-900/10 dark:shadow-cyan-900/30 flex flex-col items-center justify-center text-center bg-white/40 dark:bg-black/40 backdrop-blur-xl hover:bg-white/60 dark:hover:bg-black/60 transition-all duration-300 group relative overflow-hidden"
          )}
        >
          {/* Icono centrado y proporcional */}
          <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/10 dark:from-cyan-500/30 dark:to-blue-500/10 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl text-cyan-600 dark:text-cyan-400 mb-1.5 sm:mb-2 border border-white/50 dark:border-white/10 shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shrink-0">
            {stat.icon}
          </div>

          <div className="flex flex-col items-center w-full">
            <span className={cn(
              "font-headline font-black tracking-tighter leading-none text-slate-900 dark:text-white drop-shadow-sm",
              stat.value.length > 5 ? "text-lg sm:text-xl md:text-2xl" : "text-xl sm:text-2xl md:text-3xl"
            )}>
              {stat.value}
            </span>
            <span className="text-[9px] sm:text-[10px] md:text-xs font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-[0.2em] mt-1">
              {stat.label}
            </span>
          </div>

          <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 font-bold mt-1.5 leading-tight max-w-[110px] sm:max-w-[130px]">
            {stat.desc}
          </p>
        </motion.div>
      ))}
    </motion.div>
  );
}