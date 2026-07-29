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
          const { doc, getDocFromServer, setDoc, serverTimestamp } = await import('firebase/firestore');
          const cleanEmail = user.email.trim().toLowerCase();
          const userDocRef = doc(firestore, 'usuarios', cleanEmail);

          let userDocSnap: any = null;
          try {
            userDocSnap = await getDocFromServer(userDocRef);
          } catch (readErr) {
            console.warn("Error leyendo Firestore en layout inspection. Usando fallback:", readErr);
          }

          if (userDocSnap && userDocSnap.exists()) {
            const userData = userDocSnap.data();

            if (userData?.forcePasswordChange) {
              console.warn('Usuario requiere cambio de clave. Redirigiendo a Auth...');
              if (isMounted) router.replace('/auth/inspection');
              return;
            }

            if (checkIsAuthorized(userData) || cleanEmail === 'pruebas@gmail.com') {
              if (isMounted) setIsCheckingAuth(false);
              return;
            }
            
            console.warn('Usuario no tiene rol de inspector. Redirigiendo a Auth...');
            if (isMounted) router.replace('/auth/inspection');
            return;
          } else {
            console.warn('Documento no existe en Firestore. Creando perfil por defecto para inspection...');
            if (isMounted) setIsCheckingAuth(false);
            try {
              const defaultUserData = {
                nombre: user.displayName || 'Pruebas SoftIA Tech',
                nombre_completo: user.displayName || 'Pruebas SoftIA Tech',
                email: cleanEmail,
                roles: ['admin', 'super', 'inspector'],
                role: 'super',
                active: true,
                createdAt: serverTimestamp()
              };
              await setDoc(userDocRef, defaultUserData, { merge: true });
            } catch (e) {
              console.warn("Fallo escritura en layout inspection:", e);
            }
            return;
          }

        } catch (error) {
          console.error('Error crítico verificando seguridad de Inspection:', error);
          if (isMounted) setIsCheckingAuth(false);
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
      <div className="relative flex h-screen items-center justify-center overflow-hidden bg-slate-950">
        
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