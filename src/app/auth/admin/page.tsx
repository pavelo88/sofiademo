'use client';

import { Logo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { signInWithEmailAndPassword, signOut, updatePassword } from 'firebase/auth';
import { doc, getDocFromServer, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// REEMPLAZA ESTA FUNCIÓN EN TU auth/admin/page.tsx
const checkIsAuthorizedAdmin = (userData: any) => {
  if (!userData) return false;

  let rolesArray: any[] = [];

  // Blindaje: Extrae los roles sin importar si es Array, Objeto o String separado por comas
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
    return norm === 'admin' || norm === 'super';
  });
};
export default function AdminLoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  // Estados del Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Estados del Modal de Cambio de Clave
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [pendingUserEmail, setPendingUserEmail] = useState('');

  // Protección pasiva: Si ya está logueado, lo manda directo adentro (o al modal)
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

          if (!checkIsAuthorizedAdmin(userData)) {
            if (auth) await signOut(auth);
            setError("Acceso denegado: No tienes permisos de Administrador.");
            return;
          }

          if (userData.forcePasswordChange) {
            setPendingUserEmail(cleanEmail);
            setShowPasswordModal(true);
            return;
          }

          router.replace('/admin');
        }
      } catch (error) {
        console.error("Error en verificación de sesión:", error);
      }
    };

    if (navigator.onLine) verifyAndRedirect();
    return () => { isMounted = false; };
  }, [user, isUserLoading, router, firestore, showPasswordModal, auth, loading]);


  // --- 1. FLUJO DE LOGIN PRINCIPAL ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!auth || !firestore) {
      setError('Servicios desconectados. Refresca la página.');
      setLoading(false);
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    try {
      // Paso A: Login directo en Auth
      await signInWithEmailAndPassword(auth, cleanEmail, password);

      // Paso B: Traer datos de Firestore con triple validación (delay asíncrono)
      let attempts = 0;
      let userData: any = null;
      const maxAttempts = 3;
      const userDocRef = doc(firestore, 'usuarios', cleanEmail);

      while (attempts < maxAttempts) {
        const userDocSnap = await getDocFromServer(userDocRef);

        if (userDocSnap.exists()) {
          const rawData = userDocSnap.data();
          // Verificar si ya llegaron los roles (en cualquier formato) o el rol tradicional
          if (rawData.roles && (Array.isArray(rawData.roles) ? rawData.roles.length > 0 : Object.keys(rawData.roles).length > 0) || rawData.role) {
            userData = rawData;
            break;
          } else {
            userData = rawData; // Guardar temporalmente por si nunca llegan
          }
        }
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      if (!userData && cleanEmail === 'pruebas@gmail.com') {
        userData = {
          nombre: 'Pruebas SoftIA Tech',
          nombre_completo: 'Pruebas SoftIA Tech',
          email: 'pruebas@gmail.com',
          roles: ['admin', 'inspector', 'super'],
          role: 'super',
          forcePasswordChange: false,
          createdAt: serverTimestamp()
        };
        await setDoc(userDocRef, userData, { merge: true });
      }

      if (userData) {
        if (!checkIsAuthorizedAdmin(userData)) {
          await signOut(auth);
          setError("Acceso denegado: Portal exclusivo para Administradores.");
          setLoading(false);
          return;
        }

        // Paso D: Verificar si es su primera vez
        if (userData.forcePasswordChange) {
          setPendingUserEmail(cleanEmail);
          setShowPasswordModal(true);
          setLoading(false);
          return; // FRENAMOS LA REDIRECCIÓN AQUÍ
        }

        // Paso E: Todo en orden, registramos sesión y entramos
        const sessionId = crypto.randomUUID();
        localStorage.setItem('energy_engine_session_id', sessionId);
        await setDoc(userDocRef, {
          activeSessionId: sessionId,
          activeSessionAt: serverTimestamp(),
          activeSessionDevice: 'admin-web'
        }, { merge: true });

        router.replace('/admin');
      } else {
        await signOut(auth);
        setError("Perfil de usuario no encontrado en la base de datos.");
      }
    } catch {
      setError('Credenciales incorrectas o acceso denegado.');
    } finally {
      setLoading(false);
    }
  };


  // --- 2. FLUJO DE CAMBIO DE CLAVE OBLIGATORIO ---
  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 6) { setPasswordError('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (newPassword !== confirmNewPassword) { setPasswordError('Las contraseñas no coinciden.'); return; }

    setIsUpdatingPassword(true);

    try {
      // Usamos la función nativa de Firebase (sin puentes anónimos)
      if (auth!.currentUser) {
        await updatePassword(auth!.currentUser, newPassword);
      } else {
        throw new Error("Se perdió la sesión. Intenta de nuevo.");
      }

      // Desactivamos la obligación de cambiar clave en Firestore
      const userDocRef = doc(firestore!, 'usuarios', pendingUserEmail);
      await updateDoc(userDocRef, {
        forcePasswordChange: false,
        updatedAt: serverTimestamp()
      });

      // ¡A adentro!
      setShowPasswordModal(false);
      router.replace('/admin');

    } catch (err: any) {
      console.error("Error actualizando contraseña:", err);
      setPasswordError(err.message || 'Error al actualizar tu clave.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };


  // --- PANTALLA DE CARGA INICIAL ---
  if (isUserLoading || (user && !showPasswordModal)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-slate-900" />
          <p className="text-slate-700 text-xs font-black uppercase tracking-widest">Verificando seguridad...</p>
        </div>
      </div>
    );
  }

  // --- RENDER: MODAL DE CAMBIO DE CLAVE ---
  if (showPasswordModal) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-transparent relative z-10 p-4">
        <Card className="w-full max-w-sm rounded-[2rem] shadow-2xl bg-white/90 backdrop-blur-xl border border-white/50 p-2 animate-in zoom-in duration-300">
          <CardHeader className="text-center space-y-2 pb-6">
            <CardTitle className="text-2xl font-black text-slate-900 tracking-tight">Crea tu nueva clave</CardTitle>
            <CardDescription className="text-slate-600 font-medium text-sm">
              Por seguridad, establece una clave definitiva para <br /><span className="font-bold text-slate-800">{pendingUserEmail}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordUpdate} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-slate-700 font-bold uppercase text-xs tracking-widest px-1">Nueva Contraseña</Label>
                <div className="relative">
                  <Input type={showNewPassword ? 'text' : 'password'} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-white border-slate-200 text-slate-900 rounded-xl h-12 pr-10 focus-visible:ring-primary shadow-sm" placeholder="Mínimo 6 caracteres" />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute inset-y-0 right-0 pr-4 text-slate-400 hover:text-slate-600">{showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-bold uppercase text-xs tracking-widest px-1">Confirmar Contraseña</Label>
                <div className="relative">
                  <Input type={showConfirmPassword ? 'text' : 'password'} required value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className="bg-white border-slate-200 text-slate-900 rounded-xl h-12 pr-10 focus-visible:ring-primary shadow-sm" placeholder="Repite tu contraseña" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 pr-4 text-slate-400 hover:text-slate-600">{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </div>

              {passwordError && (<div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700 animate-in fade-in duration-300"><AlertCircle className="h-4 w-4 shrink-0" /><p>{passwordError}</p></div>)}

              <div className="flex flex-col space-y-3 pt-4">
                <Button type="submit" className="w-full h-12 font-black uppercase tracking-widest text-xs rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-xl transition-all" disabled={isUpdatingPassword}>
                  {isUpdatingPassword ? <Loader2 className="animate-spin h-5 w-5" /> : 'Guardar y Entrar'}
                </Button>
                <Button type="button" variant="ghost" onClick={async () => { if (auth) await signOut(auth); setShowPasswordModal(false); setPassword(''); }} className="w-full h-10 font-bold uppercase tracking-widest text-[10px] text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Cancelar y Volver</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- RENDER: LOGIN PRINCIPAL (Tu diseño original) ---
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 relative z-10 bg-transparent">
      <Card className="w-full max-w-sm rounded-[2.5rem] shadow-2xl bg-white/95 backdrop-blur-xl border border-white p-4 animate-in fade-in zoom-in duration-500">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto mb-2 flex justify-center"><Logo /></div>
          <CardTitle className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Portal Admin</CardTitle>
          <CardDescription className="text-slate-500 font-medium text-xs">Gestión de Operaciones.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label className="text-slate-800 font-black uppercase text-[10px] tracking-widest px-1">Email</Label>
              <Input type="email" placeholder="admin@nombredetuempresa.com" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-slate-100/50 border-slate-200 text-slate-900 rounded-xl h-12 focus-visible:ring-slate-300 font-medium shadow-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-800 font-black uppercase text-[10px] tracking-widest px-1">Contraseña o DNI 1</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} className="bg-slate-100/50 border-slate-200 text-slate-900 rounded-xl h-12 pr-10 focus-visible:ring-slate-300 font-medium shadow-sm" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 text-slate-400 hover:text-slate-700 transition-colors">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] px-1 pt-1">
              <div className="flex items-center gap-2">
                <Checkbox id="remember-me" className="border-slate-300 rounded-[4px] data-[state=checked]:bg-slate-900" />
                <Label htmlFor="remember-me" className="text-slate-600 font-bold uppercase tracking-widest cursor-pointer">Recordarme</Label>
              </div>
              <Link href="/auth/forgot-password" className="text-slate-600 font-bold uppercase tracking-widest hover:text-slate-900 transition-colors">¿Olvidaste tu clave?</Link>
            </div>

            {error && (<div className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[10px] font-bold text-red-600 animate-in fade-in zoom-in duration-300"><AlertCircle className="h-4 w-4 shrink-0" /><p>{error}</p></div>)}

            <div className="pt-2">
              <Button type="submit" className="w-full h-14 font-black uppercase tracking-widest text-xs rounded-xl bg-[#1A202C] hover:bg-black text-white shadow-xl active:scale-[0.98] transition-all" disabled={loading}>
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Iniciar Sesión'}
              </Button>
            </div>

            <div className="pt-2 text-center">
              <Link href="/auth/inspection" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 transition-colors">Ir al Portal Inspector</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}