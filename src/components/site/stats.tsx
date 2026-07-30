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
    transition: { type: "spring", stiffness: 100, damping: 15 }
  }
};

export default function Stats() {
  const stats = [
    { label: 'Años', value: '20+', desc: 'Experiencia Tecnológica', icon: <History className="w-4 h-4 md:w-5 md:h-5" /> },
    { label: 'Días', value: '365', desc: 'Soporte Global Inmediato', icon: <Clock className="w-4 h-4 md:w-5 md:h-5" /> },
    { label: 'Total', value: 'Global', desc: 'Presencia en Todo el Mundo', icon: <Globe className="w-4 h-4 md:w-5 md:h-5" /> },
    { label: 'Soporte', value: '24/7', desc: 'Respuesta ante Emergencias', icon: <Zap className="w-4 h-4 md:w-5 md:h-5" /> },
  ];

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      className="grid grid-cols-2 gap-2 md:gap-3 w-full max-w-[240px] sm:max-w-[280px] md:max-w-xs lg:max-w-sm mx-auto p-1"
    >
      {stats.map((stat, idx) => (
        <motion.div
          key={idx}
          variants={itemVariants}
          whileHover={{ scale: 1.05, y: -5, boxShadow: "0 20px 40px -10px rgba(0,255,255,0.2)" }}
          className={cn(
            "p-3 md:p-4 rounded-[1rem] md:rounded-[1.2rem] border border-white/60 dark:border-white/10 shadow-lg shadow-cyan-900/5 dark:shadow-cyan-900/20 flex flex-col items-center justify-center text-center bg-white/30 dark:bg-black/30 backdrop-blur-lg hover:bg-white/50 dark:hover:bg-black/50 transition-colors duration-300 group"
          )}
        >
          {/* Icono pequeño y centrado */}
          <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/10 dark:from-cyan-500/30 dark:to-blue-500/10 p-2 rounded-xl text-cyan-600 dark:text-cyan-400 mb-2 border border-white/50 dark:border-white/10 shadow-inner group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300">
            {stat.icon}
          </div>

          <div className="flex flex-col items-center w-full">
            <span className={cn(
              "font-headline font-black tracking-tighter leading-none text-slate-900 dark:text-white drop-shadow-sm",
              stat.value.length > 5 ? "text-lg md:text-xl" : "text-xl md:text-2xl"
            )}>
              {stat.value}
            </span>
            <span className="text-[8px] md:text-[9px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-[0.2em] mt-1 md:mt-1.5">
              {stat.label}
            </span>
          </div>

          <p className="text-[9px] md:text-[10px] text-slate-600 dark:text-slate-400 font-bold mt-1.5 leading-tight max-w-[100px] md:max-w-[120px]">
            {stat.desc}
          </p>
        </motion.div>
      ))}
    </motion.div>
  );
}