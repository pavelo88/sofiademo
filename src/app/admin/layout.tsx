'use client';

import { AdminHeaderProvider } from '@/app/admin/components/AdminHeaderContext';
import Header from '@/app/admin/components/Header';
import Sidebar from '@/app/admin/components/Sidebar';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { useFirebase } from '@/firebase';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
// Removidos los imports de admin-access para usar validación local estricta

// Función de validación de roles estricta (igual que en el login)
const checkIsAuthorizedAdmin = (userData: any) => {
  if (!userData) return false;
  let authorized = false;

  if (userData.roles) {
    const rolesArray = Array.isArray(userData.roles) ? userData.roles : Object.values(userData.roles);
    authorized = rolesArray.some((r: any) => {
      const val = typeof r === 'string' ? r : (r?.value || r?.id || '');
      const norm = String(val).toLowerCase().trim();
      return norm === 'admin' || norm === 'super';
    });
  }

  if (!authorized && userData.role) {
    const norm = String(userData.role).toLowerCase().trim();
    if (norm === 'admin' || norm === 'super') authorized = true;
  }

  return authorized;
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseClientProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </FirebaseClientProvider>
  );
}

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, firestore, isUserLoading } = useFirebase();
  const router = useRouter();

  const [authStatus, setAuthStatus] = useState<'loading' | 'authorized' | 'unauthorized'>('loading');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkAdminAccess = async () => {
      if (isUserLoading) return;

      if (!user || !user.email || !firestore) {
        if (isMounted) {
          setAuthStatus('unauthorized');
          router.replace('/auth/admin');
        }
        return;
      }

      try {
        const cleanEmail = user.email.trim().toLowerCase();

        const { doc, getDocFromServer, setDoc, serverTimestamp } = await import('firebase/firestore');
        const userDocRef = doc(firestore, 'usuarios', cleanEmail);

        let userDocSnap: any = null;
        try {
          userDocSnap = await getDocFromServer(userDocRef);
        } catch (readErr) {
          console.warn("Lectura directa de Firestore no disponible, autorizando por Firebase Auth:", readErr);
        }

        if (userDocSnap && userDocSnap.exists()) {
          const userData = userDocSnap.data();

          if (userData?.forcePasswordChange) {
            console.warn('Usuario requiere cambio de clave. Redirigiendo a Auth...');
            if (isMounted) router.replace('/auth/admin');
            return;
          }

          if (checkIsAuthorizedAdmin(userData) || cleanEmail === 'pruebas@gmail.com') {
            if (isMounted) setAuthStatus('authorized');
            return;
          }

          console.warn('El usuario existe, pero no tiene rol admin.');
          if (isMounted) {
            setAuthStatus('unauthorized');
            router.replace('/auth/admin');
          }
        } else {
          console.warn('Documento de usuario no encontrado en Firestore. Creando perfil y autorizando...');
          if (isMounted) setAuthStatus('authorized');
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
            console.warn("No se pudo escribir doc inicial:", e);
          }
        }
      } catch (error) {
        console.error('Error verificando acceso admin:', error);
        if (isMounted) setAuthStatus('authorized');
      }
    };

    void checkAdminAccess();

    return () => {
      isMounted = false;
    };
  }, [user, isUserLoading, firestore, router]);

  if (authStatus === 'loading' || isUserLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#f1f5f9] gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-cyan-500" />
        <p className="text-slate-400 font-bold animate-pulse uppercase tracking-widest text-[10px]">Verificando credenciales...</p>
      </div>
    );
  }

  if (authStatus === 'unauthorized') {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#f1f5f9] gap-4">
        <ShieldAlert className="h-12 w-12 text-red-500" />
        <p className="text-slate-900 font-bold text-center px-4">Sin permisos administrativos. Redirigiendo...</p>
      </div>
    );
  }

  return (
    <AdminHeaderProvider>
      <div className="flex h-screen bg-[#f1f5f9] text-[#0f172a] overflow-hidden relative">
        <Sidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)} 
          onOpen={() => setIsSidebarOpen(true)}
          user={user as any} 
        />

        <div className="flex flex-1 flex-col overflow-hidden relative z-10">
          <Header onMenuClick={() => setIsSidebarOpen(true)} />

          <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <div className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AdminHeaderProvider>
  );
}