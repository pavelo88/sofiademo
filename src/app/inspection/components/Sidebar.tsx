
'use client';

import { useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Activity, ClipboardList, LayoutDashboard, LogOut, Receipt, User as UserIcon } from 'lucide-react';
import { TABS } from '../constants';

interface SidebarProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
}

// Mapeo de ítems del menú con el nuevo estilo visual
const menuItems = [
  { id: TABS.MENU, label: 'Inicio / Dashboard', icon: LayoutDashboard, color: 'text-blue-600' },
  { id: TABS.TASKS, label: 'Tareas Pendientes', icon: ClipboardList, color: 'text-green-600' },
  { id: TABS.NEW_INSPECTION, label: 'Nueva Inspección', icon: Activity, color: 'text-primary' },
  { id: TABS.EXPENSES, label: 'Gastos y Viáticos', icon: Receipt, color: 'text-purple-600' },
  { id: TABS.PROFILE, label: 'Perfil de Usuario', icon: UserIcon, color: 'text-slate-500' },
];

export default function Sidebar({ activeTab, onNavigate }: SidebarProps) {
  const auth = useAuth();

  const handleLogout = async () => {
    if (confirm("¿Cerrar sesión ahora?")) {
      try {
        localStorage.removeItem('softia_session_id');
        localStorage.removeItem('softia_offline_email');
        if (auth) {
          await signOut(auth);
        }
      } catch (err) {
        console.warn("Error formal al cerrar sesión en Firebase (posiblemente offline):", err);
      } finally {
        window.location.href = '/auth/inspection';
      }
    }
  };

  return (
    // Barra lateral con estilo Glassmorphism: fondo translúcido y bordes sutiles
    <aside className="hidden xl:flex w-80 bg-white/60 backdrop-blur-xl flex-col p-8 sticky top-0 h-screen border-r border-white/80 shadow-lg">
      
      {/* Logo de la compañía */}
      <div className="mb-12 border-l-4 border-cyan-500 pl-6">
        <span className="font-black italic text-3xl tracking-tighter block leading-none text-slate-900">soft<span className="text-cyan-500">IA</span></span>
        <span className="font-black italic text-2xl tracking-tighter block leading-none text-cyan-600">tech</span>
        <p className="text-[9px] text-slate-500 font-black tracking-[0.4em] uppercase mt-2">Professional Suite</p>
      </div>

      {/* Navegación principal */}
      <nav className="flex-1 space-y-3">
        {menuItems.map(item => (
          <button 
            key={item.id} 
            onClick={() => onNavigate(item.id)} 
            className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all duration-300 ease-in-out ${activeTab === item.id ? 'bg-cyan-600/10 text-cyan-600 shadow-md' : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'}`}>
            <item.icon size={22} className={activeTab === item.id ? item.color : ''} /> {item.label}
          </button>
        ))}
      </nav>

      {/* Botón para cerrar sesión */}
      <button onClick={handleLogout} className="flex items-center gap-4 p-4 text-red-500/80 font-bold hover:bg-red-500/10 hover:text-red-600 rounded-2xl transition-all duration-300 ease-in-out">
        <LogOut size={22} /> Cerrar Sesión
      </button>
    </aside>
  );
}
