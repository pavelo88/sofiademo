'use client';

import { useToast } from '@/hooks/use-toast';
import { db as dbLocal } from '@/lib/db-local';
import { differenceInMinutes, parse } from 'date-fns';
import React, { useEffect, useRef } from 'react';

/**
 * @fileOverview Monitor de sesión de trabajo activa para Energy Engine.
 * Notifica al inspector si lleva más de 8 horas con una visita abierta.
 */

interface WorkSessionMonitorProps {
  inspectorEmail: string | null;
}

const WorkSessionMonitor: React.FC<WorkSessionMonitorProps> = ({ inspectorEmail }) => {
  const { toast } = useToast();
  const lastNotifiedHourRef = useRef<number | null>(null);

  useEffect(() => {
    if (!inspectorEmail) return;

    const checkSession = async () => {
      try {
        const savedRow = await dbLocal.configuracion.get(`activeVisit_draft_${inspectorEmail}`);
        
        if (savedRow?.value && (savedRow.value.arrivalTimestamp || savedRow.value.horaLlegada)) {
          const now = new Date();
          let arrivalDate: Date;

          if (savedRow.value.arrivalTimestamp) {
            arrivalDate = new Date(savedRow.value.arrivalTimestamp);
          } else {
            // Fallback para sesiones antiguas que solo tienen HH:mm
            arrivalDate = parse(savedRow.value.horaLlegada, 'HH:mm', now);
          }
          
          let diffMinutes = differenceInMinutes(now, arrivalDate);
          // Solo aplicamos el cruce de medianoche si NO tenemos timestamp completo
          if (!savedRow.value.arrivalTimestamp && diffMinutes < 0) diffMinutes += 1440; 
          
          const diffHours = diffMinutes / 60;
          const currentHourFloor = Math.floor(diffHours);

          // Notificar cada hora a partir de la 6ta hora (6h, 7h, 8h...)
          if (currentHourFloor >= 6 && lastNotifiedHourRef.current !== currentHourFloor) {
            
            const message = `Sesión prolongada: Llevas ${currentHourFloor} horas de trabajo registradas. No olvides fichar la salida.`;
            
            // 1. Notificación Visual (Toast) - 15 segundos con botón de cierre
            toast({
              variant: "destructive",
              title: "⏰ RECORDATORIO DE SESIÓN",
              description: message,
              duration: 15000,
            });

            // 2. Notificación de Sistema (Panel de Notificaciones en Celulares/Tablets)
            if ("Notification" in window) {
              if (Notification.permission === "granted") {
                // USAMOS EL REGISTRO DEL SERVICE WORKER (Es lo que hace que aparezca arriba en la barra de Android/iOS)
                navigator.serviceWorker.ready.then((registration) => {
                  registration.showNotification("Energy Engine", {
                    body: message,
                    icon: "/icon-192.png",      // Icono grande en la notificación
                    badge: "/icon-192.png",     // ICONO PEQUEÑO EN LA BARRA SUPERIOR (Bandeja)
                    tag: 'session-reminder',    // Evita que se amontonen, la reemplaza
                    renotify: true,
                    vibrate: [200, 100, 200],
                    requireInteraction: true,
                    silent: false,
                    dir: 'ltr'
                  } as any);
                }).catch(() => {
                  // Si el SW falla, usamos la notificación normal como respaldo
                  new Notification("Energy Engine", { body: message, icon: "/icon-192.png" });
                });
              } else if (Notification.permission === "default") {
                // Solicitar permiso si aún no se ha decidido
                Notification.requestPermission().then(permission => {
                  if (permission === "granted") {
                    console.log("Permiso de notificaciones concedido");
                  }
                });
              }
            }

            lastNotifiedHourRef.current = currentHourFloor;
          }
        } else {
            // Si no hay sesión activa, reseteamos el monitor
            lastNotifiedHourRef.current = null;
        }
      } catch (err) {
        console.error("Error en WorkSessionMonitor:", err);
      }
    };

    // Verificar cada minuto
    const interval = setInterval(checkSession, 60000);
    checkSession(); // Verificación inicial

    return () => clearInterval(interval);
  }, [inspectorEmail, toast]);

  return null; // Este componente no renderiza nada visualmente por sí mismo
};

export default WorkSessionMonitor;
