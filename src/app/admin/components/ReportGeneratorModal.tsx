'use client';

/* eslint-disable react-hooks/set-state-in-effect -- QA: warning reviewed; keeping current flow to avoid behavioral changes. */

import { drawPdfFooter, drawPdfHeader } from '@/app/inspection/lib/pdf-helpers';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { addImageSafely } from '@/lib/pdf-utils';
import { formatTechnicianName } from '@/lib/utils';
import { endOfDay, format, isWithinInterval, startOfDay } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Clock, Download, FileText, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

// ────────── SELECTOR DE FECHA NATIVO ──────────
function SelectDate({ date, setDate }: { date: Date | undefined; setDate: (d: Date | undefined) => void }) {
  return (
    <input
      type="date"
      value={date ? format(date, 'yyyy-MM-dd') : ''}
      onChange={(e) => {
        if (!e.target.value) setDate(undefined);
        else setDate(new Date(e.target.value + 'T12:00:00'));
      }}
      className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-bold focus:ring-2 focus:ring-[#10b981] outline-none shadow-inner uppercase cursor-pointer"
    />
  );
}

interface ReportGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  reportes: any[];
  fixedInspectorName?: string;
  fixedModule?: 'horas' | 'gastos';
  inspectorsList?: any[];
}

export default function ReportGeneratorModal({ isOpen, onClose, reportes, fixedInspectorName, fixedModule, inspectorsList }: ReportGeneratorProps) {
  const safeReportes = useMemo(() => reportes || [], [reportes]);
  const isProfileMode = !!fixedInspectorName;

  const nameMap = useMemo(() => {
    const map = new Map();
    if (inspectorsList) {
      inspectorsList.forEach(i => {
        if (i.email) map.set(i.email.toLowerCase().trim(), i.nombre);
        if (i.id) map.set(i.id.toLowerCase().trim(), i.nombre);
      });
    }
    return map;
  }, [inspectorsList]);

  const getFullTechnicianName = useCallback((rawName: string | undefined) => formatTechnicianName(rawName, nameMap), [nameMap]);

  const inspectorLimpio = fixedInspectorName ? getFullTechnicianName(fixedInspectorName) : '';

  const [moduleType, setModuleType] = useState<'horas' | 'gastos'>(fixedModule || 'horas');
  const [reportFormat, setReportFormat] = useState<'consolidado' | 'individual'>(isProfileMode ? 'individual' : 'consolidado');
  const [grouping, setGrouping] = useState<'inspector' | 'cliente'>('inspector');
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [fechaDesde, setFechaDesde] = useState<Date | undefined>(undefined);
  const [fechaHasta, setFechaHasta] = useState<Date | undefined>(undefined);
  const { toast } = useToast();

  useEffect(() => {
    if (fixedModule) setModuleType(fixedModule);
    if (isProfileMode) { setReportFormat('individual'); setGrouping('inspector'); }
  }, [fixedModule, isProfileMode, isOpen]);

  const inspectors = useMemo(() => Array.from(new Set(safeReportes.filter(r => r.inspectorNombre || r.tecnico || r.inspectorEmail).map(r => getFullTechnicianName(r.inspectorNombre || r.tecnico || r.inspectorEmail)))).sort(), [safeReportes, getFullTechnicianName]);
  const clients = useMemo(() => Array.from(new Set(safeReportes.filter(r => r.clienteNombre).map(r => r.clienteNombre?.toUpperCase()))).sort(), [safeReportes]);

  const getFormattedDate = (fecha: any) => {
    if (!fecha) return '—';
    const d = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return isNaN(d.getTime()) ? '—' : format(d, 'dd/MM/yyyy');
  };

  const handleGeneratePDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const darkColor = '#062113';
    const stripeGrey = '#f1f5f9';

    const filtered = safeReportes.filter(r => {
      const isHoraRecord = r.horasNormales !== undefined || r.horaLlegada !== undefined;
      if (moduleType === 'horas' && !isHoraRecord) return false;
      if (moduleType === 'gastos' && r.monto === undefined) return false;

      const d = r.fecha?.toDate ? r.fecha.toDate() : new Date(r.fecha);
      if (fechaDesde && fechaHasta && !isWithinInterval(d, { start: startOfDay(fechaDesde), end: endOfDay(fechaHasta) })) return false;

      if (reportFormat === 'individual' || isProfileMode) {
        const target = isProfileMode ? inspectorLimpio : selectedTarget;
        if (!target) return false;
        if (grouping === 'inspector') return getFullTechnicianName(r.inspectorNombre || r.tecnico || r.inspectorEmail) === target;
        else return r.clienteNombre?.toUpperCase() === target;
      }
      return true;
    });

    if (filtered.length === 0) return alert("No hay datos para los filtros seleccionados.");

    filtered.sort((a, b) => {
      const da: any = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
      const db: any = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha);
      return da - db;
    });

    const groupedData: Record<string, any[]> = {};
    if (reportFormat === 'individual' || isProfileMode) {
      const target = isProfileMode ? inspectorLimpio : selectedTarget;
      groupedData[target] = filtered;
    } else {
      filtered.forEach(r => {
        const key = grouping === 'inspector' 
          ? getFullTechnicianName(r.inspectorNombre || r.tecnico || r.inspectorEmail || 'S/N')
          : (r.clienteNombre?.toUpperCase() || 'S/C');
        if (!groupedData[key]) groupedData[key] = [];
        groupedData[key].push(r);
      });
    }

    let currentY = 45;
    doc.setTextColor(darkColor); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    const mainTitle = moduleType === 'horas'
      ? (reportFormat === 'consolidado' ? `REPORTE GRUPAL DE HORAS (POR ${grouping.toUpperCase()})` : 'REPORTE INDIVIDUAL DE HORAS')
      : (reportFormat === 'consolidado' ? 'REPORTE GRUPAL DE GASTOS' : 'REPORTE INDIVIDUAL DE GASTOS');
    doc.text(mainTitle, 15, currentY);

    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor('#64748b');
    const periodo = (fechaDesde && fechaHasta) ? `${format(fechaDesde, 'dd/MM/yyyy')} al ${format(fechaHasta, 'dd/MM/yyyy')}` : 'PERIODO COMPLETO';
    doc.text(`Periodo: ${periodo}`, 15, currentY + 6);
    currentY += 15;

    const summaryRows: any[] = [];
    let grandN = 0, grandE = 0, grandS = 0, grandMonto = 0;
    const categoryTotals: Record<string, number> = {};

    Object.keys(groupedData).sort().forEach((groupName) => {
      const groupRecords = groupedData[groupName];
      let subN = 0, subE = 0, subS = 0, subMonto = 0;

      groupRecords.forEach(r => {
        if (moduleType === 'horas') {
          subN += Number(r.horasNormales) || 0; subE += Number(r.horasExtras) || 0; subS += Number(r.horasEspeciales) || 0;
        } else {
          subMonto += Number(r.monto) || 0;
          const cat = r.rubro || 'Otros';
          categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(r.monto) || 0);
        }
      });

      grandN += subN; grandE += subE; grandS += subS; grandMonto += subMonto;
      summaryRows.push([groupName, subN.toFixed(2), subE.toFixed(2), subS.toFixed(2), (subN + subE + subS).toFixed(2), `${subMonto.toFixed(2)}€`]);

      autoTable(doc, {
        startY: currentY,
        margin: { top: 55 },
        body: [[(grouping === 'inspector' ? 'Inspector: ' : 'Cliente: ') + groupName]],
        theme: 'plain', styles: { fontSize: 10, fontStyle: 'bold', textColor: darkColor }
      });
      currentY = (doc as any).lastAutoTable.finalY + 2;

      autoTable(doc, {
        startY: currentY,
        margin: { top: 55 },
        theme: 'grid',
        headStyles: { fillColor: darkColor, textColor: '#ffffff', halign: 'center' },
        styles: { fontSize: 8, cellPadding: 2, lineWidth: 0.1, lineColor: '#e2e8f0', halign: 'center' },
        head: moduleType === 'horas'
          ? [['Fecha', (grouping === 'inspector' ? 'Cliente' : 'Inspector'), 'Actividad', 'Llegada', 'Salida', 'Norm.', 'Ext.', 'Esp.', 'Total']]
          : [['Fecha', 'Rubro', 'Concepto', 'Pago', 'Monto', 'Ticket']],
        body: groupRecords.map(r => moduleType === 'horas' ? [
          getFormattedDate(r.fecha), (grouping === 'inspector' ? r.clienteNombre : getFullTechnicianName(r.inspectorNombre || r.tecnico || r.inspectorEmail)), r.actividad || '–', r.horaLlegada || '–', r.horaSalida || '–',
          { content: Number(r.horasNormales).toFixed(2), styles: { halign: 'right' as const } },
          { content: Number(r.horasExtras).toFixed(2), styles: { halign: 'right' as const } },
          { content: Number(r.horasEspeciales).toFixed(2), styles: { halign: 'right' as const } },
          { content: (Number(r.horasNormales) + Number(r.horasExtras) + Number(r.horasEspeciales)).toFixed(2), styles: { halign: 'right' as const, fontStyle: 'bold' } }
        ] : [
          getFormattedDate(r.fecha), r.rubro || '–', r.descripcion || '–', r.forma_pago || '–',
          { content: `${Number(r.monto).toFixed(2)}€`, styles: { halign: 'right' as const, fontStyle: 'bold' } },
          r.comprobanteUrl ? { content: 'Ver 🔗', styles: { textColor: [37, 99, 235], halign: 'center' as const } } : { content: '–', styles: { halign: 'center' as const } }
        ]),
        foot: [[
          { content: `TOTAL ${groupName}`, colSpan: (moduleType === 'horas' ? 5 : 4), styles: { halign: 'right' as const, fontStyle: 'bold' } },
          ...(moduleType === 'horas' ? [
            { content: subN.toFixed(2), styles: { halign: 'right' as const } },
            { content: subE.toFixed(2), styles: { halign: 'right' as const } },
            { content: subS.toFixed(2), styles: { halign: 'right' as const } },
            { content: (subN + subE + subS).toFixed(2), styles: { halign: 'right' as const } }
          ] : [
            { content: `${subMonto.toFixed(2)}€`, styles: { halign: 'right' as const } },
            ''
          ])
        ]],
        footStyles: { fillColor: stripeGrey, textColor: darkColor, fontStyle: 'bold' },
        columnStyles: moduleType === 'horas' ? {
          8: { fillColor: '#f0fdf4' }
        } : {},
        didDrawCell: (data: any) => {
          if (moduleType === 'gastos' && data.section === 'body' && data.column.index === 5) {
            const record = groupRecords[data.row.index];
            if (record && record.comprobanteUrl) {
              doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: record.comprobanteUrl });
            }
          }
        }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    });

    if (reportFormat === 'consolidado') {
      if (currentY > 180) { doc.addPage(); currentY = 45; }
      const pageWidth = 297;
      doc.setFontSize(11); doc.setTextColor(darkColor); doc.setFont('helvetica', 'bold');

      if (moduleType === 'horas') {
        const marginX = pageWidth * 0.15;
        doc.text(`CONSOLIDADO DE PRODUCCIÓN POR ${grouping.toUpperCase()}`, pageWidth / 2, currentY, { align: 'center' });
        currentY += 6;

        autoTable(doc, {
          startY: currentY,
          margin: { top: 55, left: marginX, right: marginX },
          theme: 'grid',
          headStyles: { fillColor: darkColor, textColor: '#ffffff', halign: 'center' },
          styles: { fontSize: 9, halign: 'center', lineWidth: 0.1, lineColor: '#e2e8f0' },
          head: [[(grouping === 'inspector' ? 'Inspector' : 'Cliente'), 'Total Norm.', 'Total Ext.', 'Total Esp.', 'Total General']],
          body: summaryRows.map(r => [r[0], r[1], r[2], r[3], r[4]]),
          foot: [[
            { content: 'GRAN TOTAL DEL PERIODO  ', styles: { halign: 'right' as const } }, 
            { content: grandN.toFixed(2), styles: { halign: 'right' as const } }, 
            { content: grandE.toFixed(2), styles: { halign: 'right' as const } }, 
            { content: grandS.toFixed(2), styles: { halign: 'right' as const } }, 
            { content: (grandN + grandE + grandS).toFixed(2), styles: { halign: 'right' as const } }
          ]],
          footStyles: { fillColor: stripeGrey, textColor: darkColor, fontStyle: 'bold' },
          columnStyles: {
            0: { cellWidth: pageWidth * 0.40, halign: 'left' as const },
            1: { halign: 'right' as const, cellWidth: (pageWidth * 0.30) / 4 },
            2: { halign: 'right' as const, cellWidth: (pageWidth * 0.30) / 4 },
            3: { halign: 'right' as const, cellWidth: (pageWidth * 0.30) / 4 },
            4: { halign: 'right' as const, cellWidth: (pageWidth * 0.30) / 4, fontStyle: 'bold' as const }
          }
        });
      } else {
        const marginX = pageWidth * 0.15;
        const col0W = pageWidth * 0.50;
        const col1W = pageWidth * 0.20;

        // Resumen Gastos x Inspector
        doc.text(`CONSOLIDADO DE LIQUIDACIÓN POR ${grouping.toUpperCase()}`, pageWidth / 2, currentY, { align: 'center' });
        currentY += 6;

        autoTable(doc, {
          startY: currentY,
          theme: 'grid',
          margin: { left: marginX, right: marginX },
          headStyles: { fillColor: darkColor, textColor: '#ffffff', halign: 'center' as const },
          styles: { fontSize: 9, halign: 'center' as const },
          head: [['Inspector', 'Total Liquidado']],
          body: summaryRows.map(r => [r[0], { content: r[5], styles: { halign: 'right' as const } }]),
          foot: [[{ content: 'TOTAL GENERAL', styles: { halign: 'right' as const } }, { content: `${grandMonto.toFixed(2)}€`, styles: { halign: 'right' as const } }]],
          footStyles: { fillColor: stripeGrey, textColor: darkColor },
          columnStyles: {
            0: { cellWidth: col0W },
            1: { cellWidth: col1W, fontStyle: 'bold' as const }
          }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;
        if (currentY > 180) { doc.addPage(); currentY = 45; }

        // Resumen Gastos x Categoría
        doc.text("CONSOLIDADO DE LIQUIDACIÓN POR CATEGORÍA", pageWidth / 2, currentY, { align: 'center' });
        currentY += 6;

        autoTable(doc, {
          startY: currentY,
          theme: 'grid',
          margin: { left: marginX, right: marginX },
          headStyles: { fillColor: darkColor, textColor: '#ffffff', halign: 'center' as const },
          styles: { fontSize: 9, halign: 'center' as const },
          head: [['Rubro / Categoría', 'Total por Rubro']],
          body: Object.entries(categoryTotals).map(([k, v]) => [k, { content: `${v.toFixed(2)}€`, styles: { halign: 'right' as const } }]),
          foot: [[{ content: 'TOTAL GENERAL', styles: { halign: 'right' as const } }, { content: `${grandMonto.toFixed(2)}€`, styles: { halign: 'right' as const } }]],
          footStyles: { fillColor: stripeGrey, textColor: darkColor },
          columnStyles: {
            0: { cellWidth: col0W },
            1: { cellWidth: col1W, fontStyle: 'bold' as const }
          }
        });
      }
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // ─── FIRMA DEL INSPECTOR (Solo en reportes individuales/perfil) ───
    if (reportFormat === 'individual' || isProfileMode) {
      const signature = localStorage.getItem('energy_engine_signature');
      if (signature) {
        let finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 15 : currentY + 15;
        const pageHeight = doc.internal.pageSize.getHeight();
        
        // Si no hay espacio (necesitamos ~40mm), saltamos de página
        if (finalY + 40 > pageHeight - 20) {
          doc.addPage();
          finalY = 40;
        }

        const inspectorNameText = isProfileMode ? getFullTechnicianName(fixedInspectorName || '') : selectedTarget;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(darkColor);
        
        // Dibujar línea y firma
        const sigWidth = 50;
        const sigHeight = 20;
        const marginX = 15;
        
        addImageSafely(doc, signature, marginX, finalY, sigWidth, sigHeight);
        doc.line(marginX, finalY + sigHeight + 1, marginX + sigWidth + 10, finalY + sigHeight + 1);
        doc.setFontSize(8);
        doc.text("FIRMA DEL INSPECTOR:", marginX, finalY + sigHeight + 5);
        doc.text(inspectorNameText, marginX, finalY + sigHeight + 9);
      }
    }

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) { doc.setPage(i); drawPdfHeader(doc); drawPdfFooter(doc, i, pageCount); }

    const scope = isProfileMode ? 'Mis_Registros' : (reportFormat === 'consolidado' ? `Grupal_x_${grouping}` : `Indiv_${selectedTarget.replace(/\s+/g, '_')}`);
    const fechaStr = (fechaDesde && fechaHasta) ? `${format(fechaDesde, 'ddMM')}al${format(fechaHasta, 'ddMM')}` : 'Completo';
    doc.save(`Reporte_${moduleType.toUpperCase()}_${scope}_${fechaStr}.pdf`);

    toast({
      title: "Descarga completada",
      description: "El reporte se ha generado y descargado con éxito.",
      variant: "default",
      className: "bg-emerald-50 border-emerald-200 text-emerald-900 rounded-2xl",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl border-none">
        <DialogTitle className="text-xl font-black uppercase tracking-tighter mb-4 text-slate-900 flex items-center gap-2 border-b pb-4 border-slate-100">
          <FileText size={20} className="text-[#10b981]" /> Descargar Reporte de {moduleType.toUpperCase()}
        </DialogTitle>

        <div className="space-y-6">
          {!fixedModule && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase ml-2 text-slate-400">Módulo</label>
              <div className="flex gap-2">
                <Button onClick={() => setModuleType('horas')} className={`flex-1 h-10 rounded-xl font-black text-[10px] uppercase ${moduleType === 'horas' ? 'bg-[#10b981] text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}><Clock size={14} className="mr-2" /> Horas</Button>
                <Button onClick={() => setModuleType('gastos')} className={`flex-1 h-10 rounded-xl font-black text-[10px] uppercase ${moduleType === 'gastos' ? 'bg-[#10b981] text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}><TrendingUp size={14} className="mr-2" /> Gastos</Button>
              </div>
            </div>
          )}

          {!isProfileMode && (
            <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase ml-2 text-slate-400">Formato</label>
                <div className="flex gap-2">
                  <Button onClick={() => { setReportFormat('consolidado'); setSelectedTarget(''); }} className={`flex-1 h-10 rounded-lg text-[10px] font-black uppercase ${reportFormat === 'consolidado' ? 'bg-slate-900 text-white shadow-md' : 'bg-white border text-slate-400'}`}>Grupal</Button>
                  <Button onClick={() => { setReportFormat('individual'); setSelectedTarget(''); }} className={`flex-1 h-10 rounded-lg text-[10px] font-black uppercase ${reportFormat === 'individual' ? 'bg-slate-900 text-white shadow-md' : 'bg-white border text-slate-400'}`}>Individual</Button>
                </div>
              </div>

              {reportFormat === 'consolidado' && moduleType === 'horas' && (
                <div className="flex gap-2 pt-2 border-t border-slate-200">
                  <Button onClick={() => setGrouping('inspector')} className={`flex-1 h-8 rounded-lg text-[9px] font-bold uppercase ${grouping === 'inspector' ? 'bg-slate-200 text-slate-900' : 'bg-white border text-slate-400'}`}>Por Inspector</Button>
                  <Button onClick={() => setGrouping('cliente')} className={`flex-1 h-8 rounded-lg text-[9px] font-bold uppercase ${grouping === 'cliente' ? 'bg-slate-200 text-slate-900' : 'bg-white border text-slate-400'}`}>Por Cliente</Button>
                </div>
              )}

              {reportFormat === 'individual' && (
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  {moduleType === 'horas' && (
                    <div className="flex gap-2 mb-2">
                      <Button onClick={() => { setGrouping('inspector'); setSelectedTarget(''); }} className={`flex-1 h-8 rounded-lg text-[9px] font-bold uppercase ${grouping === 'inspector' ? 'bg-slate-200 text-slate-900' : 'bg-white border text-slate-400'}`}>Inspector</Button>
                      <Button onClick={() => { setGrouping('cliente'); setSelectedTarget(''); }} className={`flex-1 h-8 rounded-lg text-[9px] font-bold uppercase ${grouping === 'cliente' ? 'bg-slate-200 text-slate-900' : 'bg-white border text-slate-400'}`}>Cliente</Button>
                    </div>
                  )}
                  <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                    <SelectTrigger className="h-12 rounded-xl bg-white border border-slate-200 font-bold uppercase text-xs text-slate-900 shadow-inner">
                      <SelectValue placeholder={`👉 Elegir ${grouping === 'inspector' ? 'Inspector' : 'Cliente'}...`} />
                    </SelectTrigger>
                    <SelectContent className="bg-white rounded-2xl shadow-2xl">
                      {(grouping === 'inspector' ? inspectors : clients).map(n => <SelectItem key={n} value={n} className="uppercase font-bold text-xs">{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Desde</label><SelectDate date={fechaDesde} setDate={setFechaDesde} /></div>
            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Hasta</label><SelectDate date={fechaHasta} setDate={setFechaHasta} /></div>
          </div>

          <div className="pt-4 flex justify-between gap-3 border-t border-slate-100">
            <Button onClick={onClose} variant="ghost" className="h-12 px-6 rounded-xl font-black text-[10px] uppercase text-slate-400">Cancelar</Button>
            <Button onClick={handleGeneratePDF} disabled={(!isProfileMode && reportFormat === 'individual' && !selectedTarget)} className="h-12 flex-1 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase shadow-xl hover:bg-black disabled:bg-slate-200 transition-all">
              <Download size={14} className="mr-2" /> Descargar PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
