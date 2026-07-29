
'use client';

import { Logo } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/firebase';
import { cn } from '@/lib/utils';
import { signOut, User } from 'firebase/auth';
import { Building, ChevronRight, Clock, Code2, DollarSign, Filter, LayoutDashboard, LogOut, Mail, Upload, Users, Wrench, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  user: User | null;
}

const navLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Usuarios', icon: Users },
  { href: '/admin/clients', label: 'Clientes', icon: Building },
  { href: '/admin/jobs', label: 'Trabajos', icon: Wrench },
  { href: '/admin/hours', label: 'Bitácora Horas', icon: Clock },
  { href: '/admin/expenses', label: 'Bitácora Gastos', icon: DollarSign },
  { href: '/admin/filters', label: 'Bitácora Filtros', icon: Filter },
  { href: '/admin/web-requests', label: 'Solicitudes Web', icon: Mail },
  { href: '/admin/import', label: 'Importar', icon: Upload },
  { href: '/admin/docs', label: 'Arquitectura', icon: Code2 },
];

export default function Sidebar({ isOpen, onClose, onOpen, user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();

  const handleLogout = async () => {
    try {
      if (auth) await signOut(auth);
      router.push('/auth/admin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 bg-black/80 backdrop-blur-md z-40 md:hidden',
          isOpen ? 'block' : 'hidden'
        )}
        onClick={onClose}
      />

      <div
        onClick={() => { if (!isOpen) onOpen(); }}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-full transform flex-col bg-slate-950 backdrop-blur-xl border-r border-white/5 text-slate-100 shadow-2xl transition-all duration-500 ease-in-out md:relative group/sidebar',
          isOpen ? 'translate-x-0 w-[85%] md:w-64' : '-translate-x-full md:translate-x-0 md:w-20',
          !isOpen && 'cursor-pointer hover:bg-slate-900'
        )}
      >
        <div className={cn("flex h-24 items-center border-b border-white/5", isOpen ? "px-6" : "justify-center px-0")}>
          <Link href="/admin" className={cn("flex items-center", isOpen ? "gap-3" : "justify-center w-full")}>
            <div className="flex items-center justify-center w-12 h-12 shrink-0">
              {/* bg-white rounded-full eliminado por petición visual */}
              <Logo showText={false} className="w-full h-full" />
            </div>
            <div className={cn("transition-all duration-500 overflow-hidden", isOpen ? "w-auto opacity-100" : "w-0 opacity-0 md:hidden")}>
              <h1 className="text-sm font-black tracking-tighter leading-none text-white whitespace-nowrap uppercase ml-2">EMPRESA <span className="text-cyan-400">DEMO</span></h1>
              <p className="text-[10px] font-bold tracking-[0.2em] text-cyan-400 whitespace-nowrap uppercase ml-2">Tu Eslogan</p>
            </div>
          </Link>
          {isOpen && (
            <button onClick={onClose} className="absolute right-4 md:hidden p-2 rounded-xl bg-transparent hover:bg-white/5 transition-colors">
              <X className="h-6 w-6 text-slate-400" />
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-2 px-4 py-8 flex flex-col items-stretch overflow-y-auto no-scrollbar">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (pathname.startsWith(link.href) && link.href !== '/admin');
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => { onClose(); }}
                className={cn(
                  'relative group py-3 rounded-2xl transition-all duration-300 flex items-center',
                  isOpen ? 'px-4 gap-4' : 'justify-center',
                  isActive
                    ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                )}
              >
                <link.icon className={cn("h-5 w-5 transition-transform duration-300 shrink-0", isActive ? "scale-110" : "group-hover:scale-110")} />
                <span className={cn("text-xs font-black uppercase tracking-widest transition-all duration-500 overflow-hidden", isOpen ? "w-auto opacity-100" : "w-0 opacity-0 md:hidden")}>
                  {link.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 flex flex-col gap-4 border-t border-white/5 py-8">
          {user && (
            <div className={cn("flex items-center", isOpen ? "gap-4 px-2" : "justify-center")}>
              <Avatar className="h-10 w-10 border-2 border-white/10 shadow-xl shrink-0">
                <AvatarImage src={user.photoURL || ''} alt={user.displayName || 'Avatar'} />
                <AvatarFallback className='font-black bg-white/5 text-slate-400 text-xs text-shor'>{getInitials(user.displayName)}</AvatarFallback>
              </Avatar>
              <div className={cn("transition-all duration-500 overflow-hidden whitespace-nowrap", isOpen ? "w-auto opacity-100" : "w-0 opacity-0 md:hidden")}>
                <p className="text-[10px] font-black uppercase tracking-tighter text-white truncate">{user.displayName || 'Admin'}</p>
                <p className="text-[8px] text-slate-500 font-bold truncate">{user.email}</p>
              </div>
            </div>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); if (isOpen) onClose(); else onOpen(); }}
            className={cn(
              "flex items-center py-3 rounded-2xl transition-all duration-300",
              isOpen ? "px-4 gap-4 text-slate-400 hover:text-white hover:bg-white/5" : "justify-center text-cyan-500 hover:bg-cyan-500/10"
            )}
          >
            <ChevronRight size={20} className={cn("transition-transform duration-500 shrink-0", isOpen ? "rotate-180" : "rotate-0")} />
            <span className={cn("text-xs font-black uppercase tracking-widest transition-all duration-500 overflow-hidden whitespace-nowrap", isOpen ? "w-auto opacity-100" : "w-0 opacity-0 md:hidden")}>
              {isOpen ? "Contraer Menú" : ""}
            </span>
          </button>

          <button
            onClick={handleLogout}
            className={cn(
              "py-3 rounded-2xl text-red-500/70 transition-all duration-300 hover:bg-red-500/10 hover:text-red-500 flex items-center group",
              isOpen ? "px-4 gap-4" : "justify-center"
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className={cn("text-xs font-black uppercase tracking-widest transition-all duration-500 whitespace-nowrap overflow-hidden", isOpen ? "w-auto opacity-100" : "w-0 opacity-0 md:hidden")}>
              Cerrar Sesión
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
