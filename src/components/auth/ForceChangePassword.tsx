'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore, useUser } from '@/firebase';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

interface ForceChangePasswordProps {
  onPasswordChanged: () => void;
}

export default function ForceChangePassword({ onPasswordChanged }: ForceChangePasswordProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);

    if (!user || !user.email || !firestore) {
      setError('Error de autenticación o de conexión a la base de datos. Por favor, inicia sesión de nuevo.');
      setLoading(false);
      return;
    }

    try {
      await updatePassword(user, newPassword);

      // After successfully updating in Auth, update the flag in Firestore.
      const userDocRef = doc(firestore, 'usuarios', user.email);
      await updateDoc(userDocRef, {
        forcePasswordChange: false,
      });
      
      alert('¡Contraseña actualizada con éxito!');
      onPasswordChanged(); // Notify layout to re-render content

    } catch (error: any) {
      console.error("Error updating password: ", error);
      if (error.code === 'auth/requires-recent-login') {
        setError('Esta operación es sensible y requiere un inicio de sesión reciente. Por favor, vuelve a iniciar sesión.');
      } else {
        setError('No se pudo actualizar la contraseña. Contacta a soporte.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-2xl rounded-2xl shadow-xl">
        <CardHeader className="text-center space-y-4 p-6">
           <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
             <ShieldCheck size={32}/>
           </div>
          <CardTitle className="text-2xl font-bold text-slate-800">Crea tu Contraseña</CardTitle>
          <CardDescription>Por seguridad, establece una nueva contraseña para tu cuenta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nueva Contraseña</Label>
              <Input 
                id="newPassword"
                required 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nueva Contraseña</Label>
              <Input 
                id="confirmPassword"
                required 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center pt-2">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full font-bold !mt-6">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Establecer y Continuar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
