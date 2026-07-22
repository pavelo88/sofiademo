'use client';

import {
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  Filter,
  LayoutGrid,
  Receipt, User,
  Zap
} from 'lucide-react';
import React from 'react';
import TABS from '../constants';

interface MainMenuProps {
  onNavigate: (tab: string) => void;
  recentOTs: any[];
  otStatusFilter: 'activas' | 'completadas';
  onStatusFilterChange: (status: 'activas' | 'completadas') => void;
  onSelectOT: (ot: any) => void;
  userName: string;
}

function PremiumCard({ title, isHistorial, subtitle, icon, theme, onClick }: any) {
  const themes: any = {
    forest: "from-[#102d1d] via-[#1a442c] to-[#0d2518] text-white border-[#276340]",
    aqua: "from-[#419d94] via-[#5dd4c9] to-[#36857d] text-white border-[#7ae3da]",
    lime: "from-[#7ba64f] via-[#9ad462] to-[#688c42] text-white border-[#b1eb77]",
    silver: "from-[#e2e8f0] via-[#ffffff] to-[#cbd5e1] text-[#0f172a] border-white shadow-slate-300",
  };

  const textShadowWhite = "0px 2px 4px rgba(0,0,0,0.3), 0px 4px 10px rgba(0,0,0,0.15)";
  const textShadowSilver = "0px 1px 1px rgba(255,255,255,1), 0px 3px 6px rgba(0,0,0,0.1)";
  const currentTextShadow = theme === 'silver' ? textShadowSilver : textShadowWhite;

  return (
    <button onClick={onClick} className={`group relative w-full flex flex-col p-8 rounded-[2.2rem] bg-gradient-to-br ${themes[theme]} border-t-2 border-l-2 shadow-[0_30px_60px_-12px_rgba(0,0,0,0.25)] hover:scale-[1.03] active:scale-[0.97] transition-all duration-400 overflow-hidden min-h-[160px] justify-center`}>
      <div className="absolute top-0 left-0 w-full h-[40%] bg-gradient-to-b from-white/20 to-transparent pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-full h-[40%] bg-gradient-to-t from-black/10 to-transparent pointer-events-none"></div>

      <div className="flex items-center gap-6 z-10 w-full">
        <div className={`shrink-0 w-16 h-16 rounded-[1.5rem] flex items-center justify-center backdrop-blur-2xl border border-white/20 shadow-inner group-hover:rotate-6 transition-transform ${theme === 'silver' ? 'bg-[#1a2e25]/5 shadow-black/5' : 'bg-white/10 shadow-black/20'}`}>
          {React.cloneElement(icon, { 
            size: 32, 
            strokeWidth: 2.5,
            className: `drop-shadow-2xl ${theme === 'silver' ? 'text-[#0f172a]' : 'text-white'}` 
          })}
        </div>

        <div className="flex flex-col text-left min-w-0 flex-grow">
          <h3 className="font-black leading-none tracking-tighter" style={{ textShadow: currentTextShadow }}>
            {!isHistorial && (
              <span className="opacity-80 text-[11px] block mb-0.5 font-black tracking-[0.2em] uppercase">BITÁCORA</span>
            )}
            <span className="text-[32px] block uppercase leading-tight truncate">{title}</span>
          </h3>
          <p className="text-[11px] font-black tracking-[0.15em] opacity-80 uppercase drop-shadow-md mt-1 truncate">
             {subtitle}
          </p>
        </div>
      </div>
    </button>
  );
}

export default function MainMenuTablet({
  onNavigate,
  recentOTs,
  otStatusFilter,
  onStatusFilterChange,
  onSelectOT,
  userName,
}: MainMenuProps) {
  return (
    <div className="w-full font-sans pb-32 min-h-screen bg-[#f1f5f4] overflow-x-hidden border-t border-gray-100 px-8">
      
      <div className="w-full py-10 space-y-12">
        
        {/* 1. SECCIÓN BIENVENIDA */}
        <section className="flex items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-[1.8rem] bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center text-emerald-700 shadow-inner flex-shrink-0">
              <User size={40} strokeWidth={2} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-white shadow-sm"></div>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-emerald-600/60 tracking-[0.2em] uppercase mb-1 truncate">Engineering Management</p>
            <h1 className="text-4xl font-black text-[#0f172a] tracking-tight leading-none truncate">Hola, {userName}</h1>
          </div>
        </section>

        {/* 2. GESTIÓN ESTRATÉGICA (CUADRÍCULA 2x2) */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <LayoutGrid size={24} className="text-emerald-500" />
            <h2 className="text-sm font-black tracking-[0.2em] text-gray-400 uppercase">Gestión Estratégica</h2>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <PremiumCard 
              title="HISTORIAL" 
              isHistorial={true}
              subtitle="REPORTES GENERADOS" 
              icon={<ClipboardList />} 
              theme="forest" 
              onClick={() => onNavigate(TABS.TASKS)}
            />
            <PremiumCard 
              title="HORAS" 
              subtitle="ITINERARIO DIARIO" 
              icon={<Clock />} 
              theme="aqua" 
              onClick={() => onNavigate(TABS.HOURS)}
            />
            <PremiumCard 
              title="GASTOS" 
              subtitle="CONTROL FINANCIERO" 
              icon={<Receipt />} 
              theme="lime" 
              onClick={() => onNavigate(TABS.EXPENSES)}
            />
            <PremiumCard 
              title="FILTROS" 
              subtitle="SEGUIMIENTO TÉCNICO" 
              icon={<Filter />} 
              theme="silver" 
              onClick={() => onNavigate(TABS.FILTERS)}
            />
          </div>
        </section>

        {/* 3. OT ASIGNADAS (DEBAJO DE LOS BOTONES) */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Zap size={24} className="text-yellow-500 fill-yellow-500" />
              <h2 className="text-sm font-black tracking-[0.2em] text-gray-400 uppercase">Últimas OT Asignadas</h2>
            </div>
            <div className="flex bg-gray-200/50 p-1.5 rounded-2xl border border-gray-100 shadow-inner">
              <button onClick={() => onStatusFilterChange('activas')} className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${otStatusFilter === 'activas' ? 'bg-white text-[#162a21] shadow-sm' : 'text-gray-500'}`}>ACTIVAS</button>
              <button onClick={() => onStatusFilterChange('completadas')} className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${otStatusFilter === 'completadas' ? 'bg-white text-[#162a21] shadow-sm' : 'text-gray-500'}`}>HISTORIAL</button>
            </div>
          </div>

          <div className="space-y-4">
            {recentOTs.map((ot) => (
              <button key={ot.id} onClick={() => onSelectOT(ot)} className="group w-full flex items-center justify-between p-6 bg-white border border-gray-100 rounded-[2rem] shadow-sm hover:shadow-md transition-all text-left">
                <div className="flex items-center gap-6 flex-grow min-w-0">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner ${ot.estado === 'Completada' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                    <FileText size={28} />
                  </div>
                  <div className="flex-grow min-w-0 pr-4">
                    <h4 className="text-[18px] font-black text-[#0f172a] leading-tight truncate uppercase">{ot.clienteNombre || ot.cliente || 'CLIENTE SIN NOMBRE'}</h4>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs font-bold text-gray-400 uppercase">{ot.id}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${ot.estado === 'Completada' ? 'text-emerald-500' : 'text-blue-500'}`}>{ot.estado}</span>
                    </div>
                  </div>
                </div>
                <ChevronRight size={24} className="text-gray-300 group-hover:text-emerald-500 group-hover:translate-x-2 transition-all flex-shrink-0" />
              </button>
            ))}
            
            {recentOTs.length === 0 && (
              <div className="border-2 border-dashed border-gray-200 bg-gray-50/50 rounded-[2rem] p-12 flex items-center justify-center">
                <p className="text-sm font-bold text-gray-400 tracking-widest uppercase italic text-center">
                  No tienes órdenes de trabajo recientes asignadas
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
