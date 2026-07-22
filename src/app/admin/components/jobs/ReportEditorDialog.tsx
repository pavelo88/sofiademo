'use client';

import HojaTrabajoForm from '@/app/inspection/components/forms/HojaTrabajoForm';
import InformeRevisionForm from '@/app/inspection/components/forms/InformeRevisionForm';
import InformeSimplificadoForm from '@/app/inspection/components/forms/InformeSimplificadoForm';
import InformeTecnicoForm from '@/app/inspection/components/forms/InformeTecnicoForm';
import RevisionBasicaForm from '@/app/inspection/components/forms/RevisionBasicaForm';
import { getCreationReportId, getReportDisplayId } from '@/app/inspection/lib/report-record';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { FileText, Loader2, Sparkles } from 'lucide-react';

interface ReportEditorDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedReport: any;
  aiSuggestions: any;
  isAiLoading: boolean;
  onAnalyzeAi: () => Promise<void>;
  onSuccess: () => void;
}

const FORM_TYPES = [
  { id: 'hoja-trabajo', label: 'Hoja de Trabajo' },
  { id: 'informe-revision', label: 'Informe de Revisión' },
  { id: 'informe-tecnico', label: 'Informe Técnico' },
  { id: 'informe-simplificado', label: 'Informe Simplificado' },
  { id: 'revision-basica', label: 'Revisión Básica' },
];

const normalizeReportFormType = (report: any): string => {
  const raw = String(report?.formType || report?.tipo || '').toLowerCase().trim();
  const idText = String(getCreationReportId(report) || getReportDisplayId(report) || '').toUpperCase();

  if (raw.includes('revision-basica') || raw.includes('revisión básica')) return 'revision-basica';
  if (raw.includes('informe-revision') || raw.includes('informe de revision') || raw.includes('informe de revisión')) return 'informe-revision';
  if (raw.includes('informe-tecnico') || raw.includes('informe técnico') || raw.includes('informe tecnico')) return 'informe-tecnico';
  if (raw.includes('informe-simplificado') || raw.includes('informe simplificado')) return 'informe-simplificado';
  if (raw.includes('hoja-trabajo') || raw.includes('hoja de trabajo')) return 'hoja-trabajo';

  if (idText.startsWith('RB-')) return 'revision-basica';
  if (idText.startsWith('IR-')) return 'informe-revision';
  if (idText.startsWith('IT-')) return 'informe-tecnico';
  if (idText.startsWith('IS-')) return 'informe-simplificado';
  if (idText.startsWith('HT-')) return 'hoja-trabajo';

  return raw;
};

export default function ReportEditorDialog({
  isOpen,
  onOpenChange,
  selectedReport,
  aiSuggestions,
  isAiLoading,
  onAnalyzeAi,
  onSuccess
}: ReportEditorDialogProps) {
  if (!selectedReport) return null;

  const normalizedFormType = normalizeReportFormType(selectedReport);
  const normalizedReport = { ...selectedReport, formType: normalizedFormType };
  const creationReportId = getCreationReportId(selectedReport);
  const displayReportId = getReportDisplayId(selectedReport) || creationReportId;

  const formProps = {
    initialData: normalizedReport,
    aiData: aiSuggestions,
    onSuccess: onSuccess,
    isAdmin: true
  };

  const renderForm = () => {
    switch (normalizedFormType) {
      case 'hoja-trabajo': return <HojaTrabajoForm {...formProps} />;
      case 'informe-revision': return <InformeRevisionForm {...formProps} />;
      case 'informe-tecnico': return <InformeTecnicoForm {...formProps} />;
      case 'informe-simplificado': return <InformeSimplificadoForm {...formProps} />;
      case 'revision-basica': return <RevisionBasicaForm {...formProps} />;
      default: return <p className="p-20 text-center font-black text-slate-300 uppercase">Tipo de formulario no soportado</p>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-y-auto p-0 rounded-[2.5rem] bg-white text-slate-950 border-none shadow-2xl">
        <DialogHeader className="p-8 border-b border-slate-50 sticky top-0 bg-white/80 backdrop-blur-md z-10">
          <DialogTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3 text-left">
            <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              {selectedReport.id && !selectedReport.orderId ? <FileText size={20} /> : <Sparkles size={20} />}
            </div>
            {displayReportId
              ? `Revisión Administrativa: ${displayReportId}`
              : `Nuevo ${FORM_TYPES.find(f => f.id === normalizedFormType)?.label || 'Informe'}`
            }
          </DialogTitle>
          <div className="flex gap-2">
            <Button
              onClick={onAnalyzeAi}
              disabled={isAiLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all"
            >
              {isAiLoading ? <Loader2 size={14} className="animate-spin mr-2" /> : <Sparkles size={14} className="mr-2" />}
              {isAiLoading ? 'Analizando...' : 'Analizar con IA'}
            </Button>
          </div>
        </DialogHeader>
        <div className="p-4 md:p-8" key={`${creationReportId || displayReportId || 'report'}-${normalizedFormType}`}>
          {renderForm()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
