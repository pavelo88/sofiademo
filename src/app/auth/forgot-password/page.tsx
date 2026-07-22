'use client';

import { Logo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function ForgotPasswordPage() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("El correo no puede estar vacío.");
      setLoading(false);
      return;
    }

    if (!auth) {
      setError("Servicio de conexión no disponible.");
      setLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setSuccess("Si el correo existe, te hemos enviado un enlace. Revisa tu bandeja de entrada o spam.");
    } catch (authError: any) {
      console.error("Password reset error:", authError);

      // Manejo de errores de Firebase
      if (authError.code === 'auth/invalid-email') {
        setError('El formato del correo electrónico no es válido.');
      } else if (authError.code === 'auth/user-not-found') {
        setError('No se encontró ningún usuario con este correo electrónico.');
      } else {
        setError('Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 relative z-10 bg-transparent">
      <Card className="w-full max-w-sm rounded-[2rem] shadow-2xl bg-white/80 backdrop-blur-xl border border-white/50 p-2">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto mb-2 flex justify-center">
            <Logo />
          </div>
          <CardTitle className="text-2xl font-black text-slate-900 tracking-tighter uppercase font-headline">
            Recuperar Clave
          </CardTitle>
          <CardDescription className="text-slate-600 font-medium text-sm">
            Introduce tu email y te enviaremos un enlace seguro para restablecerla.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordReset} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 font-bold uppercase text-xs tracking-widest px-1">
                Email registrado
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/60 border-slate-300 text-slate-900 placeholder:text-slate-400 rounded-xl h-12 focus-visible:ring-slate-400 pl-10"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700 animate-in fade-in zoom-in duration-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {success && (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-700 animate-in fade-in zoom-in duration-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{success}</p>
              </div>
            )}

            <Button type="submit" className="w-full h-12 font-bold uppercase tracking-widest text-xs rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-lg active:scale-[0.98] transition-all" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Enviando enlace...' : 'Enviar Enlace'}
            </Button>

            <div className="pt-4 flex flex-col items-center gap-3">
              <Link href="/auth/inspection" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors">
                <ArrowLeft size={14} />
                Volver a Portal Inspector
              </Link>
              <Link href="/auth/admin" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 transition-colors">
                Volver a Panel de Admin
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}