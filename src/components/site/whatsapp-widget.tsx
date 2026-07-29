'use client';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { MessageCircle, Phone, User } from 'lucide-react';

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
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-cyan-500 hover:bg-cyan-600 shadow-lg shadow-cyan-500/30 z-[100] transition-transform hover:scale-110"
        >
          <MessageCircle className="h-8 w-8 text-white" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-4 mb-4 mr-2 rounded-2xl border-cyan-500/20 shadow-2xl">
        <div className="grid gap-4">
          <div className="space-y-1">
            <h4 className="font-bold leading-none text-slate-900 dark:text-white uppercase text-sm">Contactar por WhatsApp</h4>
            <p className="text-xs text-muted-foreground">
              Seleccione un canal para iniciar chat directo.
            </p>
          </div>
          <div className="grid gap-2">
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
                    <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200">
                      <User className="h-3 w-3 text-cyan-500" />
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </div>
                  <Phone className="h-4 w-4 text-cyan-500 transition-colors group-hover:scale-110" />
                </a>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}