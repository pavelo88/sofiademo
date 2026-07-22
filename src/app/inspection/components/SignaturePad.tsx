'use client';

/* eslint-disable @next/next/no-img-element -- QA: warning reviewed; keeping current flow to avoid behavioral changes. */

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Check, Pen, Trash2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface SignaturePadProps {
  title: string;
  onSignatureEnd: (signature: string | null) => void;
  signature: string | null;
  showSavedSignature?: boolean;
}

export default function SignaturePad({ title, onSignatureEnd, signature, showSavedSignature = false }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [hasContent, setHasContent] = useState(!!signature);
  const [wasEdited, setWasEdited] = useState(false);

  // Al abrir el diálogo, si no hay firma previa, permitimos la carga automática una vez.
  // Pero si el usuario limpia, bloqueamos la recarga.
  useEffect(() => {
    if (isFullScreen) {
      // La firma existente se conserva desde el prop hasta que el usuario edite.
    }
  }, [isFullScreen, signature]);

  // Inicialización del lienzo con suavizado extremo y fijación de fondo sólido
  useEffect(() => {
    if (!isFullScreen) return;

    const initCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;
      contextRef.current = ctx;

      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;

      canvas.width = rect.width * scale;
      canvas.height = rect.height * scale;

      ctx.scale(scale, scale);

      // Configuración para trazo suave y redondeado (Etapa 1)
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#165a30'; // Slate-900 para máxima legibilidad
      ctx.strokeStyle = '#165a30'; 
      ctx.lineWidth = 2.5; 
      ctx.fillStyle = '#ffffff'; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Cargar firma previa o firma del sistema si existe (solo si NO se ha limpiado explícitamente)
      const finalInitial = signature;

      if (finalInitial) {
        const img = new Image();
        if (finalInitial.startsWith('http')) {
          img.crossOrigin = 'anonymous';
          img.src = finalInitial + (finalInitial.includes('?') ? '&' : '?') + 't=' + Date.now();
        } else {
          img.src = finalInitial;
        }
        
        img.onload = () => {
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
          setHasContent(true);
          setWasEdited(false); // Es la firma original, no editada
        };
      }
    };

    const timer = setTimeout(initCanvas, 150);
    return () => clearTimeout(timer);
  }, [isFullScreen, signature]);

  const getPos = (e: React.PointerEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const lastPosRef = useRef<{ x: number, y: number } | null>(null);

  const startDrawing = (e: React.PointerEvent) => {
    if (!contextRef.current) return;
    const pos = getPos(e);
    lastPosRef.current = pos;
    
    contextRef.current.beginPath();
    contextRef.current.moveTo(pos.x, pos.y);
    setIsDrawing(true);
    setHasContent(true);
    setWasEdited(true); // El usuario empezó a dibujar
  };

  const draw = (e: React.PointerEvent) => {
    if (!isDrawing || !contextRef.current || !lastPosRef.current) return;

    const pos = getPos(e);
    const ctx = contextRef.current;
    const lastPos = lastPosRef.current;

    const midPoint = {
      x: lastPos.x + (pos.x - lastPos.x) / 2,
      y: lastPos.y + (pos.y - lastPos.y) / 2
    };

    ctx.quadraticCurveTo(lastPos.x, lastPos.y, midPoint.x, midPoint.y);
    ctx.stroke();

    lastPosRef.current = pos;
    setWasEdited(true);
  };

  const stopDrawing = () => {
    if (isDrawing && contextRef.current) {
      contextRef.current.closePath();
      setIsDrawing(false);
      lastPosRef.current = null;
    }
  };

  const handleSave = () => {
    if (canvasRef.current && hasContent) {
      if (wasEdited) {
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.5);
        onSignatureEnd(dataUrl);
      } else {
        onSignatureEnd(signature);
      }
    }
    setIsFullScreen(false);
  };

  const handleClear = () => {
    if (contextRef.current && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      contextRef.current.fillStyle = '#ffffff';
      contextRef.current.fillRect(0, 0, rect.width, rect.height);
      setHasContent(false);
      setWasEdited(true); // Se limpió, cuenta como edición
      onSignatureEnd(null);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{title}</label>

      <div
        onClick={() => setIsFullScreen(true)}
        className={cn(
          "w-full h-32 bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl flex items-center justify-center cursor-pointer hover:border-primary transition-all overflow-hidden relative group",
          signature ? "bg-white dark:bg-white border-solid border-primary/20 shadow-inner" : ""
        )}
        style={{ touchAction: 'none' }}
      >
        {signature ? (
          <img src={signature} alt="Firma guardada" className="max-h-full max-w-full object-contain p-3 transition-transform group-hover:scale-105" />
        ) : (
          <div className="text-center text-slate-400 dark:text-slate-600">
            <Pen size={20} className="mx-auto mb-1.5 opacity-20" />
            <span className="text-[8px] font-black uppercase tracking-tighter">PULSAR PARA FIRMAR</span>
          </div>
        )}
      </div>

      <Dialog open={isFullScreen} onOpenChange={setIsFullScreen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-4 bg-white border border-slate-200 shadow-2xl rounded-[2.5rem] overflow-hidden light">
          <DialogHeader className="text-slate-900 mb-2">
            <DialogTitle className="font-black uppercase tracking-tighter text-base">{title}</DialogTitle>
            <DialogDescription className="text-slate-500 text-[10px]">
              Dibuje su firma. El trazo se guardará en alta resolución.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 bg-white rounded-[1.5rem] relative overflow-hidden touch-none border-2 border-slate-800 shadow-inner">
            <canvas
              ref={canvasRef}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerLeave={stopDrawing}
              className="w-full h-full cursor-crosshair touch-none"
              style={{ touchAction: 'none' }}
            />
            {!hasContent && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-200 font-black text-2xl md:text-4xl uppercase tracking-[0.2em] opacity-50">
                FIRMAR AQUÍ
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <Button
              variant="outline"
              className="flex-1 h-12 min-w-[120px] rounded-xl border-2 border-slate-200 bg-white text-slate-500 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all"
              onClick={handleClear}
            >
              <Trash2 size={16} className="mr-2" /> LIMPIAR
            </Button>
            
            {showSavedSignature && (
              <Button
                variant="outline"
                className="flex-1 h-12 min-w-[120px] rounded-xl border-2 border-primary/20 bg-primary/5 text-primary font-black uppercase text-[10px] tracking-widest hover:bg-primary/10 transition-all"
                onClick={() => {
                  const saved = signature;
                  if (saved && contextRef.current && canvasRef.current) {
                    const rect = canvasRef.current.getBoundingClientRect();
                    const img = new Image();
                    if (saved.startsWith('http')) {
                      img.crossOrigin = 'anonymous';
                      img.src = saved + (saved.includes('?') ? '&' : '?') + 't=' + Date.now();
                    } else {
                      img.src = saved;
                    }
                    img.onload = () => {
                      contextRef.current?.drawImage(img, 0, 0, rect.width, rect.height);
                      setHasContent(true);
                      setWasEdited(true);
                    };
                  }
                }}
              >
                <Check size={16} className="mr-2" /> USAR GUARDADA
              </Button>
            )}

            <Button
              className="flex-[1.5] h-12 min-w-[140px] rounded-xl border-2 border-[#165a30] bg-[#165a30] text-white font-black uppercase text-[10px] tracking-widest hover:bg-white hover:text-[#165a30] transition-all duration-300 shadow-lg"
              onClick={handleSave}
            >
              <Check size={18} className="mr-2" /> ACEPTAR FIRMA
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
