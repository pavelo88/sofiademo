'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  getLeadCooldownRemainingMs,
  leadCooldownMessage,
  markLeadSubmitted,
  normalizeLeadPayload,
  validateLeadPayload,
} from '@/lib/lead-protection';
import { submitWebLead } from '@/lib/submit-web-lead';
import { Bot, CheckCircle2, Loader2, Send, Sparkles, User } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface Message {
  role: 'bot' | 'user';
  text: string;
}

interface LeadData {
  name?: string;
  contact?: string;
  request?: string;
}

type Step = 'name' | 'contact' | 'request' | 'confirm' | 'done';

const BOT_STEPS: Record<Step, string> = {
  name: '¡Hola! Soy el asistente de Energy Engine 👋 Estoy aquí para ayudarte a gestionar tu consulta sobre este servicio.\n\n¿Cuál es tu nombre o el nombre de tu empresa?',
  contact: '¡Perfecto! ¿Cómo podemos contactarte? Puedes dejarnos tu correo electrónico y/o número de teléfono.',
  request: '¡Genial! Y ahora cuéntame: ¿qué necesitas exactamente? Puedes ser todo lo detallado que quieras — nuestro equipo de inspectores leerá tu mensaje personalmente.',
  confirm: '',
  done: '✅ ¡Tu consulta ha sido enviada con éxito!\n\nNuestro equipo revisará tu solicitud y se pondrá en contacto contigo en la mayor brevedad posible. ¡Gracias por confiar en Energy Engine!',
};

interface ServiceLeadChatProps {
  serviceName: string;
  onClose?: () => void;
}

export default function ServiceLeadChat({ serviceName, onClose }: ServiceLeadChatProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [step, setStep] = useState<Step>('name');
  const [lead, setLead] = useState<LeadData>({});
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Init with bot greeting
  useEffect(() => {
    setTimeout(() => {
      setMessages([{ role: 'bot', text: BOT_STEPS.name }]);
    }, 300);
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus input
  useEffect(() => {
    if (step !== 'done') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [step, messages]);

  const addBotMessage = (text: string) => {
    setMessages(prev => [...prev, { role: 'bot', text }]);
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || step === 'done') return;

    setMessages(prev => [...prev, { role: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);

    await new Promise(r => setTimeout(r, 600));

    if (step === 'name') {
      setLead(prev => ({ ...prev, name: trimmed }));
      setStep('contact');
      addBotMessage(BOT_STEPS.contact);

    } else if (step === 'contact') {
      setLead(prev => ({ ...prev, contact: trimmed }));
      setStep('request');
      addBotMessage(BOT_STEPS.request);

    } else if (step === 'request') {
      const updatedLead = { ...lead, request: trimmed };
      setLead(updatedLead);
      setStep('confirm');
      addBotMessage(
        `He recogido toda tu información. Esto es lo que voy a enviar al equipo de Energy Engine:\n\n` +
        `👤 **Nombre:** ${updatedLead.name}\n` +
        `📞 **Contacto:** ${updatedLead.contact}\n` +
        `💬 **Consulta:** ${trimmed}\n` +
        `🔧 **Servicio:** ${serviceName}\n\n` +
        `¿Confirmas el envío? Escribe **"Sí"** para enviar o **"No"** para corregir algo.`
      );

    } else if (step === 'confirm') {
      if (/^s(i|í)?$/i.test(trimmed) || trimmed.toLowerCase().includes('sí') || trimmed.toLowerCase().includes('si') || trimmed.toLowerCase() === 'ok' || trimmed.toLowerCase() === 'enviar') {
        await submitLead();
      } else {
        setStep('name');
        setLead({});
        setMessages([]);
        setTimeout(() => addBotMessage('Sin problema, empecemos de nuevo. 😊\n\n' + BOT_STEPS.name), 100);
      }
    }

    setLoading(false);
  };

  const submitLead = async () => {
    setLoading(true);
    try {
      const remainingMs = getLeadCooldownRemainingMs();
      if (remainingMs > 0) {
        toast({ variant: 'destructive', title: 'Espera un momento', description: leadCooldownMessage(remainingMs) });
        return;
      }

      const validationError = validateLeadPayload({
        name: lead.name || '',
        contact: lead.contact || '',
        request: lead.request || '',
        service: serviceName,
      });
      if (validationError) {
        toast({ variant: 'destructive', title: 'Solicitud no enviada', description: 'Revisa los datos de contacto y el mensaje.' });
        return;
      }

      const normalizedLead = normalizeLeadPayload({
        name: lead.name || '',
        contact: lead.contact || '',
        request: lead.request || '',
        service: serviceName,
      });

      await submitWebLead({
        name: normalizedLead.name,
        contact: normalizedLead.contact,
        request: normalizedLead.technicalRequest,
        service: normalizedLead.service,
        source: 'chat-ia-servicios',
      });

      markLeadSubmitted();
      setStep('done');
      addBotMessage(BOT_STEPS.done);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error al enviar', description: 'Por favor intenta de nuevo o llámanos directamente.' });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Format bold markdown-style text
  const formatText = (text: string) => {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <span key={i}>
          {parts.map((part, j) =>
            j % 2 === 1 ? <strong key={j} className="font-black text-primary">{part}</strong> : part
          )}
          {i < text.split('\n').length - 1 && <br />}
        </span>
      );
    });
  };

  return (
    <div className="flex flex-col h-full min-h-[420px] max-h-[520px] text-slate-900 dark:text-white">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-700">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="text-primary w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Asistente Energy Engine</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Responde en segundos · Tu consulta es confidencial</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-500 uppercase">En línea</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1 scroll-smooth">
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
              msg.role === 'bot'
                ? 'bg-primary/10 text-primary'
                : 'bg-slate-900 text-white'
            }`}>
              {msg.role === 'bot' ? <Bot size={14} /> : <User size={14} />}
            </div>
            {/* Bubble */}
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'bot'
                ? 'bg-slate-50 border border-slate-100 text-slate-800 rounded-tl-none'
                : 'bg-slate-900 text-white rounded-tr-none'
            }`}>
              {formatText(msg.text)}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex items-end gap-2">
            <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Bot size={14} className="text-primary" />
            </div>
            <div className="bg-slate-50 border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-none">
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
      {step !== 'done' ? (
        <div className="flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
          <Input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              step === 'name' ? 'Tu nombre o empresa...' :
              step === 'contact' ? 'Email y/o teléfono...' :
              step === 'request' ? 'Describe tu necesidad...' :
              'Escribe "Sí" para confirmar...'
            }
            disabled={loading}
            className="flex-1 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-primary/40"
          />
          <Button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="h-12 w-12 rounded-2xl bg-slate-900 hover:bg-primary transition-all shrink-0 p-0"
          >
            {loading ? <Loader2 size={16} className="animate-spin text-white" /> : <Send size={16} className="text-white" />}
          </Button>
        </div>
      ) : (
        <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
          <Button
            onClick={onClose}
            className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-xs flex items-center gap-2"
          >
            <CheckCircle2 size={16} />
            Cerrar — Nos pondremos en contacto
          </Button>
        </div>
      )}
    </div>
  );
}
