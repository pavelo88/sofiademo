'use client';

import { cn } from '@/lib/utils';
import { ClipboardList, Clock, FilePlus2, Receipt, User } from 'lucide-react';
import TABS from '../constants';

interface FooterProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
}

export default function Footer({ activeTab, onNavigate }: FooterProps) {
  // BOTÓN "SALIR" MOVIDO AL CENTRO (Índice 2 del arreglo)
  const navItems = [
    { id: TABS.NEW_INSPECTION, icon: FilePlus2, label: 'Crear' },
    { id: TABS.TASKS, icon: ClipboardList, label: 'Historial' },
    { id: TABS.HOURS, icon: Clock, label: 'Horas' },
    { id: TABS.EXPENSES, icon: Receipt, label: 'Gastos' },
    { id: TABS.PROFILE, icon: User, label: 'Perfil' },
  ];

  return (
    <footer className="fixed bottom-0 left-0 w-full z-40 pb-[env(safe-area-inset-bottom)] px-0">
      {/* Fondo corporativo Deep Forest con alto contraste para asegurar visibilidad */}
      <div className="bg-[#062113] rounded-t-[2.5rem] border-t border-[#10b981]/20 shadow-[0_-10px_40px_rgba(16,185,129,0.15)]">
        <div className="w-full flex justify-around items-center h-20 px-2 relative">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;


            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 w-14 transition-all duration-300',
                  // El texto inactivo ahora tiene más contraste para no ser "invisible"
                  isActive ? 'text-[#10b981]' : 'text-slate-300 hover:text-white transition-colors'
                )}
              >
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[9px] font-black uppercase tracking-tighter">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </footer>
  );
}
