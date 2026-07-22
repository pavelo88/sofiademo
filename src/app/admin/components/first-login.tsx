'use client';

import { getAuth, updatePassword } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useState } from 'react';
// Se corrigió la ruta de importación para evitar el error de Vercel 
import { useFirestore } from '@/firebase';
import { AlertTriangle, CheckCircle, Loader2, Lock, Mail, Shield } from 'lucide-react';

// Estados del proceso
type ProcessStep = 'verify' | 'setPassword' | 'loading' | 'success' | 'error';

export default function FirstLoginPage() {
  const db = useFirestore(); // Se inicializa db correctamente desde el hook 
  const [step, setStep] = useState<ProcessStep>('verify');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [dni, setDni] = useState('');

  // --- 1. Verificación de Identidad ---
  const handleVerifyIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep('loading');

    try {
      // Se utiliza db ya definido 
      const q = query(
        collection(db, 'usuarios'),
        where('email', '==', email),
        where('dni', '==', dni),
        where('rol', '==', 'admin')
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error('No se encontró un administrador con esas credenciales. Por favor, verifica tus datos.');
      }
      setMessage('Verificación exitosa. Ahora puedes establecer tu nueva contraseña.');
      setStep('setPassword');

    } catch (error: any) {
      setMessage(error.message);
      setStep('error');
    }
  };

  // --- 2. Establecer Nueva Contraseña ---
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = e.target as any;
    const password = target.password.value;
    const confirmPassword = target.confirmPassword.value;

    if (password !== confirmPassword) {
      setMessage('Las contraseñas no coinciden.');
      setStep('error');
      setTimeout(() => setStep('setPassword'), 2000);
      return;
    }
    if (password.length < 6) {
        setMessage('La contraseña debe tener al menos 6 caracteres.');
        setStep('error');
        setTimeout(() => setStep('setPassword'), 2000);
        return;
    }

    setStep('loading');

    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        throw new Error('No hay un usuario autenticado. Por favor, inicia sesión de nuevo.');
      }
      
      await updatePassword(user, password);
      setMessage('¡Contraseña actualizada con éxito! Ya puedes iniciar sesión con tu nueva clave.');
      setStep('success');

    } catch (error: any) {
        console.error("Error al actualizar contraseña: ", error);
        if (error.code === 'auth/requires-recent-login') {
            setMessage('Esta operación requiere una autenticación reciente. Inicia sesión de nuevo antes de cambiar la contraseña.');
        } else {
            setMessage('No se pudo actualizar la contraseña. Inténtalo de nuevo.');
        }
        setStep('error');
    }
  };

  // --- Renderizado Condicional ---
  const renderStep = () => {
    switch (step) {
      case 'loading': return <Loader2 className="h-12 w-12 text-primary animate-spin" />;
      case 'success': return <CheckCircle className="h-12 w-12 text-green-500" />;
      case 'error': return <AlertTriangle className="h-12 w-12 text-red-500" />;
      
      case 'setPassword':
        return (
          <form onSubmit={handleSetPassword} className="w-full space-y-4">
             <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input required type="password" name="password" placeholder="Nueva Contraseña" className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
             <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input required type="password" name="confirmPassword" placeholder="Confirmar Nueva Contraseña" className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-4 rounded-lg transition-colors">Establecer Contraseña</button>
          </form>
        );

      case 'verify':
      default:
        return (
            <form onSubmit={handleVerifyIdentity} className="w-full space-y-4">
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo Electrónico" className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input required value={dni} onChange={(e) => setDni(e.target.value)} placeholder="DNI / NIE" className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-4 rounded-lg transition-colors">Verificar Identidad</button>
            </form>
        );
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl text-center space-y-4">
            <h1 className="text-3xl font-bold text-slate-800">Acceso de Administrador</h1>
            <p className="text-slate-500">
                {step === 'verify' && 'Por favor, verifica tu identidad para establecer tu contraseña.'}
                {message && message}
            </p>
            <div className="flex justify-center items-center min-h-[150px]">
                {renderStep()}
            </div>
        </div>
    </div>
  );
}
