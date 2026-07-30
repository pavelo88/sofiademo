'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useChat } from '@ai-sdk/react';
import { motion } from 'framer-motion';
import { Bot, CheckCircle2, Loader2, Send, Sparkles, User } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface ServiceLeadChatProps {
  serviceName: string;
  onClose?: () => void;
}

export default function ServiceLeadChat({ serviceName, onClose }: ServiceLeadChatProps) {
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const { messages, status, sendMessage } = useChat({
    messages: [
      {
        id: '1',
        role: 'system' as const,
        parts: [{ type: 'text', text: `El usuario está preguntando desde la sección de servicios, específicamente sobre: ${serviceName}. Ten esto en cuenta para tu primera respuesta.` }]
      },
      {
        id: '2',
        role: 'assistant' as const,
        parts: [{ type: 'text', text: `¡Hola! Soy el Gerente de Tecnología de SoftIA Tech. Veo que estás interesado en nuestro servicio de **${serviceName}**.\n\n¿En qué te puedo ayudar hoy? Estoy a tu entera disposición para resolver cualquier duda técnica o guiarte en tu proyecto.` }]
      }
    ],
    onError: () => {
      setErrorMsg('Esto es un demo. Está pendiente configurar la IA según el giro de tu negocio. ¡Saludos!');
    }
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Format markdown-like text to basic HTML (bold and links)
  const formatMessageText = (text: string) => {
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-primary">$1</strong>');
    
    formatted = formatted.replace(
      /\[(.*?)\]\((.*?)\)/g, 
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-cyan-500 font-bold underline hover:text-cyan-400 transition-colors">$1</a>'
    );
    
    formatted = formatted.replace(/\n/g, '<br/>');

    return <div dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  const visibleMessages = messages.filter(m => m.role !== 'system');
  const isLoading = status === 'submitted' || status === 'streaming';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    sendMessage({
      parts: [{ type: 'text', text: input }]
    });
    
    setInput('');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col h-full min-h-[420px] max-h-[520px] text-slate-900 dark:text-white"
    >
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-700 relative">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Bot className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-sm leading-tight text-slate-900 dark:text-white flex items-center gap-1.5">
            Gerente SoftIA <Sparkles className="h-3 w-3 text-amber-400 fill-amber-400" />
          </h3>
          <p className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium uppercase tracking-wider">Online</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
        {visibleMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-50">
            <Bot size={32} className="text-slate-400" />
            <p className="text-xs font-medium text-slate-500">¿En qué te puedo ayudar hoy?</p>
          </div>
        ) : (
          visibleMessages.map((msg) => {
            const isUser = (msg.role as string) === 'user';
            const messageText = msg.parts?.filter(p => p.type === 'text').map((p: any) => p.text).join('') || '';

            return (
              <div key={msg.id} className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                  isUser ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-primary/10 text-primary'
                }`}>
                  {isUser ? <User size={14} /> : <Bot size={14} />}
                </div>
                
                <div className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
                  <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                    isUser 
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-tr-sm' 
                      : 'bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 rounded-tl-sm border border-slate-100 dark:border-slate-700/50'
                  }`}>
                    {formatMessageText(messageText)}
                  </div>
                  
                  {!isUser && msg.id === visibleMessages[visibleMessages.length - 1].id && !isLoading && (
                    <div className="flex items-center gap-1 text-[9px] text-slate-400 font-medium ml-1">
                      <CheckCircle2 size={10} className="text-primary" /> Recibido
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        
        {isLoading && status === 'submitted' && (
          <div className="flex gap-3 max-w-[80%]">
             <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Bot size={14} />
             </div>
             <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 rounded-tl-sm border border-slate-100 dark:border-slate-700/50">
               <Loader2 size={14} className="animate-spin text-primary" />
             </div>
          </div>
        )}
        
        <div ref={bottomRef} />
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="mx-1 mb-2 p-3 rounded-2xl bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 text-center">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">
            {errorMsg}
          </p>
          <button 
            onClick={() => setErrorMsg('')}
            type="button"
            className="mt-1.5 text-[10px] font-bold text-primary hover:text-primary/80 uppercase tracking-wider transition-colors"
          >
            Entendido
          </button>
        </div>
      )}

      {/* Input */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Escribe tu consulta tecnológica..."
            disabled={isLoading}
            className="flex-1 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-primary/40"
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="h-12 w-12 rounded-2xl bg-slate-900 dark:bg-white hover:bg-primary dark:hover:bg-primary transition-all shrink-0 p-0 group"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin text-white dark:text-slate-900" /> : <Send size={18} className="text-white dark:text-slate-900 group-hover:text-white transition-colors" />}
          </Button>
        </form>
      </div>
    </motion.div>
  );
}
