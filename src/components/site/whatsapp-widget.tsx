'use client';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { MessageCircle, Phone, User } from 'lucide-react';

const Delegations = [
  {
    title: 'Delegación Norte',
    name: 'Álvaro Madroñal',
    phone: '34683775208',
  },
  {
    title: 'Delegación Sur',
    name: 'José María López',
    phone: '34635120510',
  },
];

export default function WhatsAppWidget() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {/* BOTÓN PRINCIPAL: Ahora usa 'bg-primary' para el verde oficial */}
        <Button
          size="icon"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-primary hover:bg-primary/90 shadow-lg z-[100] transition-transform hover:scale-110"
        >
          <MessageCircle className="h-8 w-8 text-white" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-4 mb-4 mr-2">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Contactar Delegación</h4>
            <p className="text-sm text-muted-foreground">
              Seleccione para iniciar una conversación.
            </p>
          </div>
          <div className="grid gap-2">
            {Delegations.map((delegation) => {
              const whatsappUrl = `https://wa.me/${delegation.phone}?text=Hola%20${encodeURIComponent(delegation.name)}`;
              return (
                <a
                  key={delegation.name}
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-accent"
                >
                  <div>
                    <p className="font-semibold">{delegation.title}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{delegation.name}</span>
                    </div>
                  </div>
                  {/* ICONO DE TELÉFONO: Ahora cambia al verde 'text-primary' al pasar el mouse */}
                  <Phone className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                </a>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}