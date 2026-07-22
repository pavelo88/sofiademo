'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import React from 'react';

interface ConfirmDialogProps {
  title: string;
  description: string;
  onConfirm: () => void;
  children: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive' | 'outline';
}

export function ConfirmDialog({
  title,
  description,
  onConfirm,
  children,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = 'default'
}: ConfirmDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl bg-white p-8">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-500 font-bold text-sm">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 gap-3">
          <AlertDialogCancel className="rounded-xl border-2 border-slate-100 bg-slate-50 text-slate-600 font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 h-12 flex-1">
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
            className={`rounded-xl font-black uppercase text-[10px] tracking-widest h-12 flex-1 shadow-lg transition-all active:scale-95 ${
              variant === 'destructive' 
                ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-200' 
                : 'bg-[#165a30] text-white hover:bg-[#0f4022] shadow-emerald-200'
            }`}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
