'use client';

import {
  Activity,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  Filter,
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
    <button onClick={onClick} className={`group relative w-full flex flex-col p-6 rounded-[2.2rem] bg-gradient-to-br ${themes[theme]} border-t border-l shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 overflow-hidden min-h-[140px] justify-center`}>
      <div className="absolute top-0 left-0 w-full h-[40%] bg-gradient-to-b from-white/20 to-transparent pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-full h-[40%] bg-gradient-to-t from-black/10 to-transparent pointer-events-none"></div>

      <div className="flex items-center gap-5 z-10 w-full">
        <div className={`shrink-0 w-16 h-16 rounded-[1.4rem] flex items-center justify-center backdrop-blur-xl border border-white/25 shadow-inner group-hover:rotate-3 transition-transform ${theme === 'silver' ? 'bg-[#1a2e25]/5 shadow-black/5' : 'bg-white/10 shadow-black/20'}`}>
          {React.cloneElement(icon, { 
            size: 34, 
            strokeWidth: 2.5,
            className: `drop-shadow-xl ${theme === 'silver' ? 'text-[#0f172a]' : 'text-white'}` 
          })}
        </div>

        <div className="text-left flex-grow min-w-0">
          <h3 className="font-black leading-none tracking-tighter truncate" style={{ textShadow: currentTextShadow }}>
            {!isHistorial && (
              <span className="opacity-80 text-[11px] block mb-0.5 font-black tracking-[0.15em] uppercase">BITÁCORA</span>
            )}
            <span className="text-[30px] block uppercase truncate">{title}</span>
          </h3>
          <p className="text-[11px] font-black tracking-[0.25em] opacity-90 uppercase drop-shadow-md truncate mt-1">
            {subtitle}
          </p>
        </div>
      </div>
    </button>
  );
}

export default function MainMenuMobile({
  onNavigate,
  recentOTs,
  otStatusFilter,
  onStatusFilterChange,
  onSelectOT,
  userName,
}: MainMenuProps) {
  return (
    <div className="w-full font-sans pb-32 min-h-screen bg-[#f0f4f3] overflow-x-hidden border-t border-gray-100">
      
      {/* BIENVENIDA */}
      <section className="px-6 pt-8 pb-4">
        <div className="flex items-center gap-5">
          <div className="relative group">
            <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-tr from-emerald-100 to-white border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-sm overflow-hidden flex-shrink-0">
              <User size={32} strokeWidth={2} />
              <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow-sm"></div>
          </div>
          <div>
            <p className="text-[10px] font-black text-emerald-600/60 tracking-[0.25em] uppercase mb-1">Engineering Management</p>
            <h1 className="text-[28px] font-black text-[#0f172a] tracking-tight leading-none">Hola, {userName}</h1>
          </div>
        </div>
      </section>

      {/* GESTIÓN ESTRATÉGICA (BOTONES LARGOS 1x4) */}
      <section className="px-6 py-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={16} className="text-emerald-500" />
          <h2 className="text-[11px] font-black tracking-[0.2em] text-gray-400 uppercase">Gestión Estratégica</h2>
        </div>

        <div className="flex flex-col gap-4">
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

      {/* ÚLTIMAS OT ASIGNADAS */}
      <section className="px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-yellow-500 fill-yellow-500" />
            <h2 className="text-[11px] font-black tracking-[0.2em] text-gray-400 uppercase">Últimas OT Asignadas</h2>
          </div>
          <div className="flex bg-gray-200/50 p-1 rounded-xl self-start sm:self-auto">
            <button onClick={() => onStatusFilterChange('activas')} className={`px-5 py-2 rounded-lg text-[10px] font-bold transition-all ${otStatusFilter === 'activas' ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}>ACTIVAS</button>
            <button onClick={() => onStatusFilterChange('completadas')} className={`px-5 py-2 rounded-lg text-[10px] font-bold transition-all ${otStatusFilter === 'completadas' ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}>HISTORIAL</button>
          </div>
        </div>

        <div className="space-y-3">
          {recentOTs.map((ot) => (
            <button
              key={ot.id}
              onClick={() => onSelectOT(ot)}
              className="group w-full flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-100 transition-all text-left"
            >
              <div className="flex items-center gap-4 flex-grow min-w-0">
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${ot.estado === 'Completada' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                  <FileText size={20} />
                </div>
                <div className="flex-grow min-w-0 pr-4">
                  <h4 className="text-[15px] font-black text-[#0f172a] leading-tight truncate uppercase">{ot.clienteNombre || ot.cliente || 'CLIENTE SIN NOMBRE'}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">{ot.id}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0"></span>
                    <span className={`text-[9px] font-black uppercase tracking-wider ${ot.estado === 'Completada' ? 'text-emerald-500' : 'text-blue-500'}`}>{ot.estado}</span>
                  </div>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-300 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
            </button>
          ))}
          
          {recentOTs.length === 0 && (
            <div className="border-2 border-dashed border-gray-200 bg-gray-50/50 rounded-2xl p-8 flex items-center justify-center">
              <p className="text-[11px] font-bold text-gray-400 tracking-widest uppercase italic text-center">
                No tienes órdenes de trabajo recientes asignadas
              </p>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
