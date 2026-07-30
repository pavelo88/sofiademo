'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useChat } from '@ai-sdk/react';
import { motion } from 'framer-motion';
import { Bot, CheckCircle2, Loader2, Send, Sparkles, User } from 'lucide-react';
import React, { useEffect, useRef } from 'react';

interface ServiceLeadChatProps {
  serviceName: string;
  onClose?: () => void;
}

export default function ServiceLeadChat({ serviceName, onClose }: ServiceLeadChatProps) {
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    initialMessages: [
      {
        id: '1',
        role: 'system',
        content: `El usuario está preguntando desde la sección de servicios, específicamente sobre: ${serviceName}. Ten esto en cuenta para tu primera respuesta.`
      },
      {
        id: '2',
        role: 'assistant',
        content: `¡Hola! Soy el Gerente de Tecnología de SoftIA Tech. Veo que estás interesado en nuestro servicio de **${serviceName}**.\n\n¿En qué te puedo ayudar hoy? Estoy a tu entera disposición para resolver cualquier duda técnica o guiarte en tu proyecto.`
      }
    ],
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error de conexión', description: 'No pudimos conectar con la IA. Inténtalo de nuevo más tarde.' });
    }
  });

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Format markdown-like text to basic HTML (bold and links)
  const formatMessageText = (text: string) => {
    // Reemplaza **texto** por <strong>texto</strong>
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-primary">$1</strong>');
    
    // Reemplaza [texto](url) por un enlace clickeable
    formatted = formatted.replace(
      /\[(.*?)\]\((.*?)\)/g, 
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-cyan-500 font-bold underline hover:text-cyan-400 transition-colors">$1</a>'
    );
    
    // Saltos de línea
    formatted = formatted.replace(/\n/g, '<br/>');

    return <div dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  const visibleMessages = messages.filter(m => m.role !== 'system');

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col h-full min-h-[420px] max-h-[520px] text-slate-900 dark:text-white"
    >
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-700">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="text-primary w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Gerente SoftIA Tech (IA)</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Asesoría Tecnológica Avanzada</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-500 uppercase">En línea</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 scroll-smooth">
        {visibleMessages.map((msg, i) => (
          <div key={msg.id || i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
              msg.role === 'assistant'
                ? 'bg-primary/10 text-primary'
                : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
            }`}>
              {msg.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
            </div>
            {/* Bubble */}
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
              msg.role === 'assistant'
                ? 'bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none'
                : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-tr-none'
            }`}>
              {formatMessageText(msg.content)}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && visibleMessages[visibleMessages.length - 1]?.role === 'user' && (
          <div className="flex items-end gap-2">
            <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Bot size={14} className="text-primary" />
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm">
              <div className="flex gap-1 items-center h-4">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            value={input || ''}
            onChange={handleInputChange}
            placeholder="Escribe tu consulta tecnológica..."
            disabled={isLoading}
            className="flex-1 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-primary/40"
          />
          <Button
            type="submit"
            disabled={isLoading || !(input || '').trim()}
            className="h-12 w-12 rounded-2xl bg-slate-900 dark:bg-white hover:bg-primary dark:hover:bg-primary transition-all shrink-0 p-0 group"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin text-white dark:text-slate-900" /> : <Send size={18} className="text-white dark:text-slate-900 group-hover:text-white transition-colors" />}
          </Button>
        </form>
        {onClose && (
          <Button
            onClick={onClose}
            variant="ghost"
            className="w-full mt-2 h-10 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
          >
            Cerrar Chat
          </Button>
        )}
      </div>
    </motion.div>
  );
}
