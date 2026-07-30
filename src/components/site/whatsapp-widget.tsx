'use client';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { MessageCircle, Phone, User, Bot } from 'lucide-react';
import { useState } from 'react';
import ServiceLeadChat from './ServiceLeadChat';

const contacts = [
  {
    title: 'Desarrollo',
    name: 'Pablo García',
    phone: '593983992549',
  },
  {
    title: 'Seguridad',
    name: 'Sofía Acosta',
    phone: '593980169684',
  },
];

export default function WhatsAppWidget() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-cyan-500 hover:bg-cyan-600 shadow-lg shadow-cyan-500/30 z-[100] transition-transform hover:scale-110"
          >
            <MessageCircle className="h-8 w-8 text-white" />
          </Button>
        </PopoverTrigger>

        <PopoverContent align="end" className="w-80 p-4 mb-4 mr-2 rounded-2xl border-cyan-500/20 shadow-2xl z-[101]">
          <div className="grid gap-4">
            <div className="space-y-1">
              <h4 className="font-bold leading-none text-slate-900 dark:text-white uppercase text-sm">Contactar por WhatsApp</h4>
              <p className="text-xs text-muted-foreground">
                Seleccione un canal para iniciar chat directo.
              </p>
            </div>
            <div className="grid gap-2">
              
              {/* IA Virtual Agent Option */}
              <button
                onClick={() => setChatOpen(true)}
                className="group flex items-center justify-between rounded-xl border border-primary/30 p-3 transition-colors hover:bg-primary/10 hover:border-primary/50 text-left bg-gradient-to-r from-primary/5 to-transparent"
              >
                <div>
                  <p className="font-bold text-xs uppercase text-primary">Agente Virtual (IA)</p>
                  <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 mt-0.5">
                    <Bot className="h-3 w-3 text-primary" />
                    <span className="font-medium">Respuesta inmediata 24/7</span>
                  </div>
                </div>
                <Bot className="h-5 w-5 text-primary transition-transform group-hover:scale-110 group-hover:rotate-12" />
              </button>

              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

              {/* Human Contacts */}
              {contacts.map((c) => {
                const whatsappUrl = `https://wa.me/${c.phone}?text=Hola%20${encodeURIComponent(c.name)}`;
                return (
                  <a
                    key={c.name}
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between rounded-xl border p-3 transition-colors hover:bg-cyan-500/10 hover:border-cyan-500/50"
                  >
                    <div>
                      <p className="font-bold text-xs uppercase text-cyan-600 dark:text-cyan-400">{c.title}</p>
                      <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 mt-0.5">
                        <User className="h-3 w-3 text-cyan-500" />
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </div>
                    <Phone className="h-4 w-4 text-cyan-500 transition-transform group-hover:scale-110 group-hover:rotate-12" />
                  </a>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="sm:max-w-[425px] p-0 border-none bg-transparent shadow-none" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Agente Virtual SoftIA Tech</DialogTitle>
          <div className="bg-white dark:bg-[#0b1120] rounded-3xl overflow-hidden shadow-[0_0_50px_-12px_rgba(0,255,255,0.25)] border border-slate-200 dark:border-white/10 flex flex-col w-full h-[85vh] max-h-[600px] p-4 relative z-50">
            <ServiceLeadChat serviceName="Asesoría General" onClose={() => setChatOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}