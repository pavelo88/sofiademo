'use client';

import { Loader2 } from 'lucide-react';

export default function SyncStatusOverlay({ isSyncing }: { isSyncing: boolean }) {
  if (!isSyncing) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-slate-900/90 backdrop-blur-md text-white rounded-full px-6 py-3 shadow-2xl shadow-emerald-500/20 border border-white/10 flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90">
          Sincronizando con la nube...
        </span>
      </div>
    </div>
  );
}
