'use client';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  getLeadCooldownRemainingMs,
  leadCooldownMessage,
  markLeadSubmitted,
  validateLeadPayload,
} from '@/lib/lead-protection';
import { submitWebLead } from '@/lib/submit-web-lead';
import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpen, Linkedin, Loader2, Mail, MapPin, MessageCircle, Phone, PlayCircle, Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const phoneDigits = (value: string) => value.replace(/\D/g, '');

const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: 'Mínimo 2 caracteres.' })
    .max(80, { message: 'Máximo 80 caracteres.' })
    .regex(/^[\p{L}\p{N}\s.'&/-]+$/u, { message: 'Solo letras, números y signos habituales.' }),
  phone: z
    .string()
    .trim()
    .refine((value) => {
      const digits = phoneDigits(value);
      return digits.length >= 9 && digits.length <= 15;
    }, { message: 'Introduce un teléfono válido (9-15 dígitos).' }),
  email: z
    .string()
    .trim()
    .max(160, { message: 'Email demasiado largo.' })
    .email({ message: 'Introduce un email válido.' }),
  technicalRequest: z
    .string()
    .trim()
    .min(10, { message: 'Mínimo 10 caracteres.' })
    .max(300, { message: 'Máximo 300 caracteres.' }),
  website: z.string().optional(),
});

export default function Contact() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: 'onBlur',
    defaultValues: { name: '', phone: '', email: '', technicalRequest: '', website: '' },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const remainingMs = getLeadCooldownRemainingMs();
      if (remainingMs > 0) {
        toast({ variant: 'destructive', title: 'Espera un momento', description: leadCooldownMessage(remainingMs) });
        return;
      }

      const validationError = validateLeadPayload(values);
      if (validationError) {
        toast({ variant: 'destructive', title: 'Solicitud no enviada', description: 'Revisa los datos de contacto y el mensaje.' });
        return;
      }

      await submitWebLead({
        ...values,
        service: 'Formulario contacto',
        source: 'formulario-contacto',
      });

      markLeadSubmitted();
      toast({ title: '¡Solicitud Enviada!', description: 'Nuestro equipo de inspectores se pondrá en contacto pronto.' });
      form.reset();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error de Envío', description: 'Intenta llamar directamente o envíanos un mensaje.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section id="contacto" className="pt-12 pb-20 relative z-10 px-4 md:px-6 scroll-mt-14">
      {/* CONTENEDOR MAESTRO CON EFECTO VIDRIO (GLASS) */}
      <div className="max-w-7xl mx-auto bg-white/50 dark:bg-black/20 backdrop-blur-2xl border border-white/50 dark:border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] rounded-[2.5rem] md:rounded-[3rem] p-4 sm:p-8 md:p-12 flex flex-col gap-10">

        <div className="text-center px-2">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-headline font-black text-slate-900 dark:text-white tracking-tighter leading-[1.1] uppercase">
            ¿Necesitas <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-500">asistencia técnica?</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-stretch">

          {/* ======================================================== */}
          {/* COLUMNA IZQUIERDA: CANALES DE ATENCIÓN Y MAPA            */}
          {/* ======================================================== */}
          <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-[2rem] p-5 sm:p-8 shadow-xl flex flex-col gap-6 h-full">

            <div className="flex items-center justify-center w-full px-4 py-3 bg-white/90 dark:bg-black/40 border border-white/60 dark:border-white/5 rounded-2xl shadow-sm">
              <h3 className="text-lg font-black font-headline text-slate-900 dark:text-white uppercase tracking-wider">
                Canales de Comunicación
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1.3fr_1fr] gap-4 items-stretch flex-grow">

              {/* Lado Correos y Redes */}
              <div className="flex flex-col gap-3">
                <a href="mailto:contacto@nombredetuempresa.com" className="flex-1 flex items-center gap-3 p-3 rounded-2xl bg-white/90 dark:bg-black/40 border border-white/60 hover:border-cyan-500 hover:shadow-lg hover:-translate-y-1 transition-all group overflow-hidden">
                  <Mail size={16} className="text-cyan-500 shrink-0" />
                  <p className="text-[10px] sm:text-[11.5px] font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                    contacto@nombredetuempresa.com
                  </p>
                </a>

                <a href="mailto:soporte@nombredetuempresa.com" className="flex-1 flex items-center gap-3 p-3 rounded-2xl bg-white/90 dark:bg-black/40 border border-white/60 hover:border-cyan-500 hover:shadow-lg hover:-translate-y-1 transition-all group overflow-hidden">
                  <Mail size={16} className="text-cyan-500 shrink-0" />
                  <p className="text-[10px] sm:text-[11.5px] font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                    soporte@nombredetuempresa.com
                  </p>
                </a>

                <div className="flex-1 flex items-center justify-center gap-6 p-3 rounded-2xl bg-white/90 dark:bg-black/40 border border-white/60 shadow-inner">

                  <Link href="https://heyzine.com/flip-book/9c1719c192.html" target="_blank" title="Ver Catálogo" className="text-slate-600 dark:text-slate-400 hover:text-primary transition-all duration-300 hover:scale-110">
                    <BookOpen size={20} />
                  </Link>
                  <Link href="/presentacion.mp4" target="_blank" title="Ver Video Presentación" className="text-slate-600 dark:text-slate-400 hover:text-primary transition-all duration-300 hover:scale-110">
                    <PlayCircle size={20} />
                  </Link>


                  <Link href="https://www.linkedin.com/in/energy-engine-grupos-electrogenos-74529270" target="_blank" className="text-slate-600 dark:text-slate-400 hover:text-primary transition-all duration-300 hover:scale-110">
                    <Linkedin size={20} />
                  </Link>
                </div>
              </div>

              {/* Lado Teléfonos */}
              <div className="flex flex-col gap-3">
                <a href="tel:+593983992549" className="flex-1 flex items-center justify-between p-3 rounded-2xl bg-white/90 dark:bg-black/40 border border-white/60 hover:border-cyan-500/50 hover:shadow-lg hover:-translate-y-1 transition-all group overflow-hidden">
                  <div className="flex flex-col min-w-0 pr-2">
                    <p className="text-[9px] font-black uppercase text-cyan-600 dark:text-cyan-400 tracking-tighter">Desarrollo · Pablo García</p>
                    <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white group-hover:text-cyan-500 transition-colors whitespace-nowrap">+593 98 399 2549</p>
                  </div>
                  <Phone size={16} className="text-cyan-500 shrink-0" />
                </a>

                <a href="tel:+593980169684" className="flex-1 flex items-center justify-between p-3 rounded-2xl bg-white/90 dark:bg-black/40 border border-white/60 hover:border-cyan-500/50 hover:shadow-lg hover:-translate-y-1 transition-all group overflow-hidden">
                  <div className="flex flex-col min-w-0 pr-2">
                    <p className="text-[9px] font-black uppercase text-cyan-600 dark:text-cyan-400 tracking-tighter">Seguridad · Sofía Acosta</p>
                    <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white group-hover:text-cyan-500 transition-colors whitespace-nowrap">+593 98 016 9684</p>
                  </div>
                  <Phone size={16} className="text-cyan-500 shrink-0" />
                </a>
              </div>
            </div>

            {/* MAPA */}
            <div className="flex flex-col gap-3 mt-auto pt-4 border-t border-white/40 dark:border-white/10">
              <div className="w-full h-[180px] sm:h-[220px] rounded-2xl overflow-hidden relative bg-slate-200 dark:bg-muted/20 border border-white/60 dark:border-white/10 shadow-inner group">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d127677.83478950893!2d-78.55836854179688!3d-0.18065319999999998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x91d59a4002427c9f%3A0x44b991e158ef516a!2sQuito!5e0!3m2!1ses!2sec"
                  className="w-full h-full border-0 transition-all [transition-duration:1500ms] filter grayscale-[0.8] contrast-125 sepia-[0.3] hue-rotate-[130deg] dark:invert dark:hue-rotate-180 group-hover:grayscale-0 group-hover:sepia-0 group-hover:dark:invert-0"
                  allowFullScreen
                  loading="lazy"
                  title="Ubicación SoftIA Tech"
                ></iframe>
              </div>
              <div className="flex items-center justify-center gap-3 px-3">
                <MapPin className="text-primary shrink-0" size={18} />
                <p className="text-[10px] sm:text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Quito, Ecuador
                </p>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* COLUMNA DERECHA: FORMULARIO                              */}
          {/* ======================================================== */}
          <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-[2rem] p-6 sm:p-10 shadow-xl h-full flex flex-col gap-6 relative overflow-hidden">

            {/* TÍTULO DERECHO EN RECUADRO GLASS */}
            <div className="flex items-center justify-center w-full px-4 py-3 bg-white/90 dark:bg-black/40 border border-white/60 dark:border-white/5 rounded-2xl shadow-sm">
              <h3 className="text-xl sm:text-2xl font-black font-headline text-slate-900 dark:text-white uppercase tracking-tighter text-center">
                DÉJANOS TU CONSULTA
              </h3>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-grow flex flex-col">
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      className="hidden"
                      aria-hidden="true"
                    />
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-300 tracking-widest">Nombre / Empresa</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej. Juan Pérez"
                            maxLength={80}
                            autoComplete="name"
                            {...field}
                            className="h-12 rounded-2xl bg-white/80 dark:bg-black/40 border-white/60 dark:border-white/10 focus-visible:ring-primary/50 text-slate-900 dark:text-white shadow-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-300 tracking-widest">Teléfono</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="Ej. 600 123 456"
                            maxLength={20}
                            {...field}
                            onChange={(event) => {
                              field.onChange(event.target.value.replace(/[^\d+\s()-]/g, ''));
                            }}
                            className="h-12 rounded-2xl bg-white/80 dark:bg-black/40 border-white/60 dark:border-white/10 focus-visible:ring-primary/50 text-slate-900 dark:text-white shadow-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-300 tracking-widest">Correo Electrónico</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          placeholder="tu@empresa.com"
                          maxLength={160}
                          {...field}
                          className="h-12 rounded-2xl bg-white/80 dark:bg-black/40 border-white/60 dark:border-white/10 focus-visible:ring-primary/50 text-slate-900 dark:text-white shadow-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="technicalRequest"
                  render={({ field }) => (
                    <FormItem className="flex-grow flex flex-col">
                      <FormLabel className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-300 tracking-widest">Detalle su requerimiento</FormLabel>
                      <FormControl className="flex-grow">
                        <Textarea
                          placeholder="Ej. Mantenimiento preventivo para motor diésel..."
                          maxLength={300}
                          rows={3}
                          {...field}
                          className="flex-grow min-h-[72px] sm:min-h-[84px] rounded-2xl bg-white/80 dark:bg-black/40 border-white/60 dark:border-white/10 focus-visible:ring-primary/50 resize-none p-4 text-slate-900 dark:text-white leading-relaxed shadow-sm"
                        />
                      </FormControl>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 text-right">
                        {field.value.length}/300
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={isSubmitting} className="w-full h-14 sm:h-16 text-sm sm:text-base font-black uppercase tracking-widest rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all bg-[#0f5b3a] hover:bg-[#0c4a2e] text-white border-none mt-2">
                  {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  {isSubmitting ? 'Procesando...' : 'Enviar Solicitud'}
                </Button>
              </form>
            </Form>
          </div>

        </div>
      </div>
    </section>
  );
}
