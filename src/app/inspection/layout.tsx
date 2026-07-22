'use client';

import { FirebaseClientProvider } from '@/firebase/client-provider';
import { useFirebase } from '@/firebase';
import { getStoredOfflineEmail } from '@/lib/inspection-mode';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const checkIsAuthorized = (userData: any) => {
  if (!userData) return false;
  let authorized = false;

  if (userData.roles) {
    const rolesArray = Array.isArray(userData.roles) ? userData.roles : Object.values(userData.roles);
    authorized = rolesArray.some((r: any) => {
      const val = typeof r === 'string' ? r : (r?.value || r?.id || '');
      const norm = String(val).toLowerCase().trim();
      // ✅ AHORA PERMITE AMBOS
      return norm === 'inspector' || norm === 'super';
    });
  }

  if (!authorized && userData.role) {
    const norm = String(userData.role).toLowerCase().trim();
    if (norm === 'inspector' || norm === 'super') authorized = true;
  }
  return authorized;
};

export default function InspectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseClientProvider>
      <InspectionLayoutContent>{children}</InspectionLayoutContent>
    </FirebaseClientProvider>
  );
}

function InspectionLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading, firestore } = useFirebase();
  const router = useRouter();
  const [hasOfflineAccess, setHasOfflineAccess] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const verifyAccess = async () => {
      if (isUserLoading) return;

      const offlineEmail = typeof window !== 'undefined' ? getStoredOfflineEmail() : null;

      if (!user && !offlineEmail) {
        if (isMounted) router.replace('/auth/inspection');
        return;
      }

      if (!user && offlineEmail) {
        if (isMounted) {
          setHasOfflineAccess(true);
          setIsCheckingAuth(false);
        }
        return;
      }

      if (user && user.email && firestore) {
        // SI ESTAMOS OFFLINE: Confiamos en la sesión local de Firebase o en el email guardado
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          if (isMounted) setIsCheckingAuth(false);
          return;
        }

        try {
          const { doc, getDocFromServer } = await import('firebase/firestore');
          const cleanEmail = user.email.trim().toLowerCase();
          const userDocRef = doc(firestore, 'usuarios', cleanEmail);

          // Intentamos verificar online con un timeout o catch
          const userDocSnap = await getDocFromServer(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();

            if (userData?.forcePasswordChange) {
              console.warn('Usuario requiere cambio de clave. Redirigiendo a Auth...');
              if (isMounted) router.replace('/auth/inspection');
              return;
            }

            if (!checkIsAuthorized(userData)) {
              console.warn('Usuario no tiene rol de inspector. Redirigiendo a Auth...');
              if (isMounted) router.replace('/auth/inspection');
              return;
            }
          } else {
            // Si el documento no existe en Firestore, expulsamos.
            if (isMounted) router.replace('/auth/inspection');
            return;
          }

        } catch (error) {
          console.error('Error verificando seguridad de Inspection:', error);
          // Opcional: Si falla la red al verificar, podríamos confiar en la sesión de Auth y dejarlo pasar,
          // pero por seguridad estricta, si no podemos verificar, lo mandamos al login.
          if (isMounted) router.replace('/auth/inspection');
          return;
        }
      }

      if (isMounted) setIsCheckingAuth(false);
    };

    void verifyAccess();

    return () => {
      isMounted = false;
    };
  }, [user, isUserLoading, router, firestore]);

  if (isUserLoading || isCheckingAuth) {
    return (
      <div className="relative flex h-screen items-center justify-center overflow-hidden bg-slate-900">
        <div 
          className="absolute inset-0 bg-cover bg-top bg-no-repeat transition-opacity duration-500"
          style={{ backgroundImage: "url('/fondo_app.jpg')" }}
        />
        
        {/* Contenedor inferior con Glassmorphism */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-xs">
          <div className="bg-black/40 backdrop-blur-2xl border border-white/20 rounded-[2.5rem] p-6 shadow-2xl flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="relative">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              <div className="absolute inset-0 blur-xl bg-emerald-400/20 animate-pulse rounded-full" />
            </div>
            <p className="text-white font-black uppercase tracking-[0.4em] text-[9px] opacity-90 drop-shadow-md text-center">
              Verificando Seguridad
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user && !hasOfflineAccess) return null;

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="flex flex-col min-h-screen">
        {children}
      </div>
    </div>
  );
}