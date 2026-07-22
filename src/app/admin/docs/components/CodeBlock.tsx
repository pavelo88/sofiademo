'use client';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Copy } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
}

export function CodeBlock({ code, language = 'typescript', title }: CodeBlockProps) {
  const { toast } = useToast();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copiado",
      description: "Código copiado al portapapeles",
    });
  };

  return (
    <div className="rounded-lg overflow-hidden bg-slate-950 border border-slate-800 my-4 shadow-2xl">
      {(title || language) && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{language}</span>
            {title && <span className="text-xs font-medium text-slate-400">— {title}</span>}
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-slate-500 hover:text-white"
            onClick={copyToClipboard}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      )}
      <div className="p-4 overflow-x-auto custom-scrollbar">
        <pre className="text-sm font-mono text-slate-300 leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
