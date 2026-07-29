'use client';

/* eslint-disable @next/next/no-img-element -- QA: warning reviewed; keeping current flow to avoid behavioral changes. */

import { drawPdfFooter, drawPdfHeader } from '@/app/inspection/lib/pdf-helpers';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent,
  DialogTitle
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { formatTechnicianName } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { doc, increment, runTransaction } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Camera,
  CheckCircle2,
  Download,
  Edit2,
  Filter,
  Loader2,
  ShieldCheck,
  User as UserIcon,
  X,
  Zap
} from 'lucide-react';
import React from 'react';

interface LogDetailModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLog: any;
  onEdit: () => void;
  onRefresh?: () => void;
}

export default function LogDetailModal({ 
  isOpen, 
  onOpenChange, 
  selectedLog, 
  onEdit,
  onRefresh
}: LogDetailModalProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const [isApproving, setIsApproving] = React.useState(false);

  if (!selectedLog) return null;

  const handleApprove = async () => {
    if (!db) return;
    setIsApproving(true);
    try {
      const currentYear = new Date().getFullYear().toString();
      const counterRef = doc(db, 'config', 'report_counters');
      const logRef = doc(db, 'bitacora_filtros', selectedLog.id);

      await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        if (!counterSnap.exists()) {
          throw new Error("El documento de contadores no existe.");
        }

        const data = counterSnap.data();
        const currentFolio = (data.sequences?.[currentYear]?.bitacora_filtros || 0) + 1;

        // Actualizar contador
        transaction.update(counterRef, {
          [`sequences.${currentYear}.bitacora_filtros`]: increment(1)
        });

        // Actualizar Log
        transaction.update(logRef, {
          estado: 'Aprobado',
          folio: currentFolio,
          fechaAprobacion: new Date()
        });
      });

      toast({ title: "Registro Aprobado", description: "Se ha asignado un folio secuencial correctamente." });
      if (onRefresh) onRefresh();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo aprobar el registro." });
    } finally {
      setIsApproving(false);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.width;
    
    // Header Estándar
    drawPdfHeader(doc);
    
    // Título del Informe (Abajo del header)
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ADMINISTRACIÓN - INFORME TÉCNICO DE FILTROS', pageWidth / 2, 45, { align: 'center' });
    
    if (selectedLog.folio) {
      doc.setTextColor(22, 90, 48);
      doc.setFontSize(10);
      doc.text(`FOLIO OFICIAL: #${selectedLog.folio}`, pageWidth - margin, 45, { align: 'right' });
    }

    // Info Block
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.text('DATOS DEL REGISTRO', margin, 60);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, 62, 190, 62);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Cliente: ${selectedLog.clienteNombre}`, margin, 70);
    doc.text(`Instalación: ${selectedLog.instalacion}`, margin, 75);
    doc.text(`Fecha: ${format(selectedLog.fecha?.toDate ? selectedLog.fecha.toDate() : new Date(), "PPP", { locale: es })}`, margin, 80);
    doc.text(`Inspector: ${formatTechnicianName(selectedLog.tecnico)}`, margin, 85);
    doc.text(`Email: ${selectedLog.tecnicoEmail}`, margin, 90);
    
    // Parameters
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PARÁMETROS TÉCNICOS', margin, 105);
    doc.line(margin, 108, 190, 108);
    
    const params = [
      ['Batería', selectedLog.bateria],
      ['Resistencia Caldeo', selectedLog.resistenciaCaldeo],
      ['Litros Aceite', `${selectedLog.litrosAceite} L`],
      ['Litros Anticongelante', `${selectedLog.litrosAnticongelante} L`],
    ];

    if (selectedLog.litrosCombustible) {
      params.push(['Litros Combustible', `${selectedLog.litrosCombustible} L`]);
    }
    
    autoTable(doc, {
      startY: 113,
      head: [['Parámetro', 'Valor']],
      body: params,
      theme: 'striped',
      headStyles: { fillColor: [22, 90, 48] }
    });
    
    // Filters Table
    const filtersY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(11);
    doc.text('DETALLE DE FILTROS SUSTITUIDOS', margin, filtersY);
    doc.line(margin, filtersY + 3, 190, filtersY + 3);
    
    const filtersBody = (selectedLog.filtros || []).map((f: any) => [f.tipo, f.cantidad, f.referencia]);
    
    autoTable(doc, {
      startY: filtersY + 8,
      head: [['Tipo de Filtro', 'Cant.', 'Referencia']],
      body: filtersBody,
      theme: 'grid',
      headStyles: { fillColor: [22, 90, 48] }
    });

    // Footer
    drawPdfFooter(doc, 1, 1);
    
    doc.save(`${selectedLog.instalacion}-${selectedLog.clienteNombre}.pdf`);
    toast({ title: "PDF Generado", description: "El informe administrativo se ha descargado correctamente." });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl bg-white rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden outline-none">
        <div className="flex flex-col h-[90vh]">
          {/* HEADER TIPO INFORME (ADMIN STYLE) */}
          <div className="bg-slate-900 p-8 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative">
            <div className="space-y-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-[#165a30] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#165a30]/20">
                  <ShieldCheck size={24} />
                </div>
                <span className="text-[10px] font-black tracking-[0.3em] uppercase text-cyan-600">SoftIA Tech • Admin Hub</span>
              </div>
              <DialogTitle className="text-4xl font-black uppercase tracking-tighter leading-none">
                {selectedLog.instalacion}
              </DialogTitle>
              <p className="text-slate-400 font-bold text-sm uppercase tracking-wide">
                {selectedLog.clienteNombre} • {format(selectedLog.fecha?.toDate ? selectedLog.fecha.toDate() : new Date(), "d 'de' MMMM, yyyy", { locale: es })}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button 
                onClick={generatePDF}
                className="bg-white/10 hover:bg-white/20 text-white border-none h-12 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 px-6"
              >
                <Download size={16} /> PDF
              </Button>
              <Button 
                onClick={onEdit}
                className="bg-[#165a30] hover:bg-[#0f4022] text-white border-none h-12 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 px-6 shadow-lg shadow-[#165a30]/20"
              >
                <Edit2 size={16} /> Editar Registro
              </Button>
              <button onClick={() => onOpenChange(false)} className="w-12 h-12 bg-white/5 text-white/40 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
                <X size={24} />
              </button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-8 space-y-12">
              
              {/* SECCIÓN 1: RESUMEN DE PARÁMETROS */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                    <Zap size={16} />
                  </div>
                  <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Parámetros Técnicos Registrados</h3>
                  {selectedLog.folio && (
                    <span className="ml-auto bg-[#165a30] text-white text-[10px] font-black px-4 py-1.5 rounded-full tracking-widest">
                      FOLIO: #{selectedLog.folio}
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-slate-50 p-5 rounded-3xl space-y-1 border border-slate-100/50">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Batería</p>
                    <p className="text-base font-black text-slate-900">{selectedLog.bateria || 'N/A'}</p>
                  </div>
                  <div className="bg-slate-50 p-5 rounded-3xl space-y-1 border border-slate-100/50">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Resistencia</p>
                    <p className="text-base font-black text-slate-900">{selectedLog.resistenciaCaldeo || 'N/A'}</p>
                  </div>
                  <div className="bg-[#165a30]/10 p-5 rounded-3xl space-y-1 border border-[#165a30]/20">
                    <p className="text-[9px] font-black text-[#165a30] uppercase tracking-widest">Aceite</p>
                    <p className="text-xl font-black text-[#165a30]">{selectedLog.litrosAceite || '0'} L</p>
                  </div>
                  <div className="bg-blue-50/50 p-5 rounded-3xl space-y-1 border border-blue-100/50">
                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Anticongelante</p>
                    <p className="text-xl font-black text-blue-700">{selectedLog.litrosAnticongelante || '0'} L</p>
                  </div>
                  <div className="bg-amber-50/50 p-5 rounded-3xl space-y-1 border border-amber-100/50">
                    <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Combustible</p>
                    <p className="text-xl font-black text-amber-700">{selectedLog.litrosCombustible || '-'} L</p>
                  </div>
                </div>
              </div>

              {/* SECCIÓN 2: TABLA DE INSUMOS */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                    <Filter size={16} />
                  </div>
                  <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Filtros Instalados</h3>
                </div>

                <div className="border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50">
                      <tr className="text-[10px] font-black text-slate-500 uppercase tracking-[0.1em]">
                        <th className="p-5">Descripción del Insumo</th>
                        <th className="p-5 text-center">Cantidad</th>
                        <th className="p-5">Referencia Técnica</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(selectedLog.filtros || []).map((f: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                          <td className="p-5 font-bold text-slate-800">{f.tipo}</td>
                          <td className="p-5 text-center">
                            <span className="bg-[#165a30]/10 text-[#165a30] font-black px-3 py-1 rounded-lg text-sm">{f.cantidad}</span>
                          </td>
                          <td className="p-5 font-mono text-slate-500 text-sm">{f.referencia}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(!selectedLog.filtros || selectedLog.filtros.length === 0) && (
                    <div className="p-10 text-center text-slate-300 font-bold uppercase text-[10px] tracking-widest">
                       No se registraron cambios de filtros
                    </div>
                  )}
                </div>
              </div>

              {/* SECCIÓN 3: EVIDENCIA VISUAL */}
              {selectedLog.imageUrls && selectedLog.imageUrls.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                      <Camera size={16} />
                    </div>
                    <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Evidencia Fotográfica de Campo</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                    {selectedLog.imageUrls.map((url: string, i: number) => (
                      <div key={i} className="group relative aspect-[4/3] rounded-[2rem] overflow-hidden border border-slate-200 shadow-xl">
                        <img 
                          src={url} 
                          alt={`Registro ${i}`} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <Button 
                              variant="outline" 
                              className="bg-white text-slate-900 border-none font-black uppercase text-[10px] tracking-widest rounded-xl"
                              onClick={() => window.open(url, '_blank')}
                           >
                             Ampliar
                           </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator className="bg-slate-100" />

              {/* FOOTER DEL INFORME */}
              <div className="flex flex-col md:flex-row justify-between items-center gap-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                    <UserIcon size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inspector Responsable</p>
                    <p className="text-sm font-black text-slate-800">{formatTechnicianName(selectedLog.tecnico)}</p>
                    <p className="text-[9px] font-bold text-slate-400">{selectedLog.tecnicoEmail}</p>
                  </div>
                </div>
                <div className="text-center md:text-right">
                   <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">ID Registro Admin</p>
                   <p className="text-[10px] font-mono text-slate-400">{selectedLog.id}</p>
                </div>
              </div>
            </div>
          </ScrollArea>
          
          <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
               <ShieldCheck size={14} className="text-[#165a30]" /> Registro Verificado por Sistema de Administración
            </p>
            <div className="flex gap-3">
              {selectedLog.estado !== 'Aprobado' && (
                <Button 
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="h-14 rounded-2xl bg-[#165a30] hover:bg-[#0f4022] text-white font-black uppercase tracking-widest px-10 shadow-xl shadow-[#165a30]/20 gap-3 active:scale-95 transition-all"
                >
                  {isApproving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                  Aprobar Bitácora
                </Button>
              )}
              <Button 
                onClick={() => onOpenChange(false)}
                className="h-14 rounded-2xl bg-slate-900 hover:bg-black text-white font-black uppercase tracking-widest px-10 shadow-xl active:scale-95 transition-all"
              >
                Cerrar Detalle
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
