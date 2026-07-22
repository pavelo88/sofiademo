'use client';

/* eslint-disable react-hooks/set-state-in-effect -- QA: warning reviewed; keeping current flow to avoid behavioral changes. */

import { Logo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { db as dbLocal } from '@/lib/db-local';
import {
  normalizeInspectionEmail,
  setInspectionMode,
  setStoredOfflineEmail
} from '@/lib/inspection-mode';
import {
  createOfflinePasswordRecord,
  isOfflinePasswordExpired,
  verifyOfflinePassword,
} from '@/lib/offline-password';
import {
  signInWithEmailAndPassword,
  signOut,
  updatePassword
} from 'firebase/auth';
import { doc, getDocFromServer, serverTimestamp, updateDoc } from 'firebase/firestore';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// 2. SEGURIDAD: Validación de roles BLINDADA (Soporta Arrays y Objetos)
const checkIsAuthorizedInspector = (userData: any) => {
  if (!userData) return false;

  let rolesArray: any[] = [];

  if (Array.isArray(userData.roles)) {
    rolesArray = userData.roles;
  } else if (userData.roles && typeof userData.roles === 'object') {
    rolesArray = Object.values(userData.roles);
  } else if (typeof userData.roles === 'string') {
    rolesArray = userData.roles.split(',');
  }

  if (userData.role) rolesArray.push(userData.role);

  return rolesArray.some((r: any) => {
    const val = typeof r === 'string' ? r : (r?.value || r?.id || '');
    const norm = String(val).toLowerCase().trim();
    // ✅ Permite tanto inspectores normales como la llave maestra 'super'
    return norm === 'inspector' || norm === 'super';
  });
};

export default function InspectionLoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [pendingUserEmail, setPendingUserEmail] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [hasSavedUser, setHasSavedUser] = useState(false);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  useEffect(() => {
    const loadSavedEmail = async () => {
      try {
        const allSecurity = await dbLocal.table('seguridad').toArray();
        if (allSecurity.length > 0) {
          const firstValid = allSecurity
            .map((row: any) => normalizeInspectionEmail(String(row.email || '')))
            .find((mail: string) => isValidEmail(mail));
          if (firstValid) {
            setEmail(firstValid);
            setHasSavedUser(true);
          }
        }
      } catch { }
    };
    loadSavedEmail();
  }, []);

  useEffect(() => {
    if (loading || isUserLoading || showPasswordModal) return;
    if (!user || !user.email) return;

    let isMounted = true;
    const verifyAndRedirect = async () => {
      try {
        const cleanEmail = user.email!.trim().toLowerCase();
        const userDocRef = doc(firestore!, 'usuarios', cleanEmail);
        const userDocSnap = await getDocFromServer(userDocRef);

        if (userDocSnap.exists() && isMounted) {
          const userData = userDocSnap.data();

          if (!checkIsAuthorizedInspector(userData)) {
            if (auth) await signOut(auth);
            setError("No tienes permisos de inspector.");
            return;
          }

          if (userData.forcePasswordChange) {
            setPendingUserEmail(cleanEmail);
            setShowPasswordModal(true);
            return;
          }

          router.replace('/inspection');
        }
      } catch (error) {
        console.error("Error en verificación pasiva:", error);
      }
    };

    if (navigator.onLine) verifyAndRedirect();
    return () => { isMounted = false; };
  }, [user, isUserLoading, router, firestore, showPasswordModal, auth, loading]);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 8) { setPasswordError('Mínimo 8 caracteres.'); return; }
    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordError('Usa letras y números para una clave más segura.');
      return;
    }
    if (newPassword !== confirmNewPassword) { setPasswordError('Las claves no coinciden.'); return; }

    setIsUpdatingPassword(true);

    try {
      if (auth!.currentUser) {
        await updatePassword(auth!.currentUser, newPassword);
      }

      const userDocRef = doc(firestore!, 'usuarios', pendingUserEmail);
      await updateDoc(userDocRef, { forcePasswordChange: false, updatedAt: serverTimestamp() });

      await dbLocal.table('seguridad').put(
        await createOfflinePasswordRecord(pendingUserEmail, newPassword)
      );

      setStoredOfflineEmail(pendingUserEmail);
      setInspectionMode('online');
      setShowPasswordModal(false);
      router.replace('/inspection');
    } catch (err: any) {
      setPasswordError(err.message || 'Error al actualizar contraseña.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    // --- 1. MODO OFFLINE ---
    if (!navigator.onLine) {
      try {
        const security = await dbLocal.table('seguridad').get(cleanEmail);
        if (!security) { setError('Inicia sesión con internet primero.'); return; }
        if (isOfflinePasswordExpired(security)) {
          setError('Tu acceso offline caducó. Conéctate a internet para renovarlo.');
          return;
        }

        const verification = await verifyOfflinePassword(security, password);
        if (verification.ok) {
          if (verification.shouldUpgrade) {
            await dbLocal.table('seguridad').put(
              await createOfflinePasswordRecord(cleanEmail, password)
            );
          }
          setStoredOfflineEmail(cleanEmail);
          setInspectionMode('offline');
          router.replace('/inspection');
        } else { setError('Contraseña incorrecta (Offline).'); }
      } catch { setError('Error en datos locales.'); }
      return;
    }

    // --- 2. MODO ONLINE CON REINTENTOS ---
    setLoading(true);
    setError(null);

    try {
      // A. Autenticación inicial
      await signInWithEmailAndPassword(auth!, cleanEmail, password);

      let userData: any = null;
      let attempts = 0;
      const maxAttempts = 3;

      // B. Bucle de extracción: Buscamos específicamente el campo 'roles'
      while (attempts < maxAttempts) {
        attempts++;
        console.log(`Intento de extracción ${attempts} para: ${cleanEmail}`);

        const userDocRef = doc(firestore!, 'usuarios', cleanEmail);
        const userDocSnap = await getDocFromServer(userDocRef);

        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          // Si tiene roles, tenemos el documento completo
          if (data.roles && data.roles.length > 0) {
            userData = data;
            break;
          }
        }

        // Si no los encontró, esperamos 1 segundo antes de reintentar
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // C. Verificación Final de los datos extraídos
      if (!userData) {
        await signOut(auth!);
        setError("Error: El servidor no entregó tus roles de acceso después de 3 intentos.");
        setLoading(false);
        return;
      }

      console.log("Datos finales extraídos con éxito:", userData);

      // D. Lógica de Negocio: Validar Rol
      if (!checkIsAuthorizedInspector(userData)) {
        await signOut(auth!);
        setError(`Acceso denegado. No tienes rol de inspector o super.`);
        setLoading(false);
        return;
      }

      // E. Lógica de Negocio: Cambio de Clave (ForcePasswordChange)
      if (userData.forcePasswordChange === true) {
        setPendingUserEmail(cleanEmail);
        setShowPasswordModal(true);
        setLoading(false);
        return;
      }

      // F. Éxito: Guardar sesión local y entrar
      await dbLocal.table('seguridad').put(
        await createOfflinePasswordRecord(cleanEmail, password)
      );

      setStoredOfflineEmail(cleanEmail);
      setInspectionMode('online');
      router.replace('/inspection');

    } catch (err: any) {
      console.error("Fallo en login:", err);
      setError('Correo o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  };

  if (isUserLoading || (user && !showPasswordModal)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-transparent">
        <Loader2 className="h-10 w-10 animate-spin text-slate-900" />
      </div>
    );
  }

  if (showPasswordModal) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-transparent relative z-10 p-4">
        <Card className="w-full max-w-sm rounded-[2rem] shadow-2xl bg-white border border-slate-200 p-2">
          <CardHeader className="text-center space-y-2 pb-6">
            <CardTitle className="text-2xl font-black text-black uppercase">Nueva clave</CardTitle>
            <CardDescription className="text-slate-900 font-bold text-xs">Para: {pendingUserEmail}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div className="space-y-1">
                <Label className="text-[10px] text-black font-black uppercase tracking-widest px-1">Nueva Contraseña</Label>
                <div className="relative">
                  <Input type={showNewPassword ? 'text' : 'password'} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="rounded-xl h-12 border-slate-200 text-black font-bold" />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute inset-y-0 right-0 pr-3 text-slate-400">{showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-black font-black uppercase tracking-widest px-1">Confirmar</Label>
                <div className="relative">
                  <Input type={showConfirmPassword ? 'text' : 'password'} required value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className="rounded-xl h-12 border-slate-200 text-black font-bold" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 pr-3 text-slate-400">{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </div>
              {passwordError && <div className="text-[10px] font-bold text-red-600 p-2 bg-red-50 rounded-lg">{passwordError}</div>}
              <Button type="submit" className="w-full h-12 font-black uppercase tracking-widest text-xs rounded-xl bg-slate-900 text-white" disabled={isUpdatingPassword}>
                {isUpdatingPassword ? <Loader2 className="animate-spin" /> : 'Guardar y Entrar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 relative z-10 bg-transparent">
      <Card className="w-full max-w-sm rounded-[2.5rem] shadow-2xl bg-white/95 backdrop-blur-xl border border-white p-4 animate-in fade-in zoom-in duration-500">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto mb-2 flex justify-center"><Logo /></div>
          <CardTitle className="text-2xl font-black text-slate-950 tracking-tighter uppercase font-headline">Portal Inspector</CardTitle>
          <CardDescription className="text-slate-600 font-bold text-xs">Inspección Técnica Operativa</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <Label className="text-slate-950 font-black uppercase text-[10px] tracking-widest">Email</Label>
                {!isOnline && hasSavedUser && (
                  <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full animate-pulse">
                    MODO OFFLINE
                  </span>
                )}
              </div>
              <Input 
                type="email" 
                placeholder="inspector@energyengine.es" 
                required 
                value={email} 
                disabled={!isOnline && hasSavedUser}
                onChange={(e) => setEmail(e.target.value)} 
                className="bg-slate-50 border-slate-200 text-slate-900 rounded-xl h-12 font-bold disabled:opacity-75 disabled:bg-slate-100 disabled:text-slate-500" 
              />
              {!isOnline && hasSavedUser && (
                <p className="text-[8px] text-amber-700 font-bold px-1 mt-1 leading-normal uppercase">
                  Acceso restringido al inspector activo en este dispositivo.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-950 font-black uppercase text-[10px] tracking-widest px-1">Contraseña o DNI 2</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} className="bg-slate-50 border-slate-200 text-slate-900 rounded-xl h-12 pr-10 font-bold" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 text-slate-400">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] px-1 pt-1">
              <div className="flex items-center gap-2">
                <Checkbox id="remember-me" className="border-slate-300 rounded-[4px] data-[state=checked]:bg-slate-900" />
                <Label htmlFor="remember-me" className="text-slate-950 font-black uppercase tracking-wider cursor-pointer">Recordarme</Label>
              </div>
              <Link href="/auth/forgot-password" title="Recuperar cuenta" className="text-slate-950 font-black uppercase tracking-wider hover:text-primary transition-colors text-right">¿Olvidaste tu clave?</Link>
            </div>

            {error && (<div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[10px] font-bold text-red-600 animate-in fade-in zoom-in duration-300"><AlertCircle className="h-4 w-4 shrink-0" /><p>{error}</p></div>)}

            <Button type="submit" className="w-full h-14 font-black uppercase tracking-widest text-xs rounded-xl bg-slate-900 text-white shadow-xl active:scale-[0.98] transition-all" disabled={loading}>
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Iniciar Sesión'}
            </Button>

            <div className="pt-2 text-center">
              <Link href="/auth/admin" title="Panel Admin" className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors">Ir al Panel de Administración</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
