'use client';

/* eslint-disable react-hooks/set-state-in-effect -- QA: warning reviewed; keeping current flow to avoid behavioral changes. */

import { useFirebase } from '@/firebase';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { db as dbLocal } from '@/lib/db-local';
import { getInspectionMode, getStoredOfflineEmail, setStoredOfflineEmail, type InspectionMode } from '@/lib/inspection-mode';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

export function useInspectionIdentity() {
  const { user, firestore, isUserLoading } = useFirebase();
  const isOnline = useOnlineStatus();
  
  const [accessMode, setAccessMode] = useState<InspectionMode>('online');
  const [offlineEmail, setOfflineEmail] = useState<string | null>(null);
  const [userFullName, setUserFullName] = useState<string>('');
  const [isIdentityLoaded, setIsIdentityLoaded] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setAccessMode(getInspectionMode());

    const handleModeChange = () => {
      setAccessMode(getInspectionMode());
    };
    window.addEventListener('inspection-mode-changed', handleModeChange as EventListener);

    // Detectar PWA
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
    };
    checkStandalone();

    // Cargar identidad offline
    const cachedOfflineEmail = getStoredOfflineEmail();
    if (cachedOfflineEmail) {
      setOfflineEmail(cachedOfflineEmail);
      setIsIdentityLoaded(true);
    } else {
      dbLocal.table('seguridad').orderBy('createdAt').reverse().toArray().then(rows => {
        if (rows.length > 0) {
          const email = rows[0].email;
          setOfflineEmail(email);
          setStoredOfflineEmail(email);
          if (rows[0].nombre) setUserFullName(rows[0].nombre);
        }
        setIsIdentityLoaded(true);
      }).catch(() => { 
        setIsIdentityLoaded(true);
      });
    }

    return () => {
      window.removeEventListener('inspection-mode-changed', handleModeChange as EventListener);
    };
  }, []);

  // Sincronizar modo basado en conexión
  useEffect(() => {
    if (isOnline && user?.email && accessMode !== 'online') {
      setAccessMode('online');
      localStorage.setItem('energy_engine_inspection_mode', 'online');
    }
  }, [isOnline, user, accessMode]);

  // Sincronizar perfil (Nombre)
  useEffect(() => {
    if (!isOnline || !firestore || !user?.email) return;

    const syncProfile = async () => {
      try {
        const email = user.email!;
        const userDocSnap = await getDoc(doc(firestore, 'usuarios', email));
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          await dbLocal.table('seguridad').update(email, {
            nombre: userData.nombre
          });
          setUserFullName(userData.nombre);
        }
      } catch (err) {
        console.error("Error al sincronizar perfil:", err);
      }
    };
    syncProfile();
  }, [isOnline, firestore, user]);

  const effectiveEmail = user?.email || offlineEmail;

  return {
    user,
    firestore,
    isUserLoading,
    isOnline,
    accessMode,
    offlineEmail,
    userFullName,
    isIdentityLoaded,
    isStandalone,
    effectiveEmail
  };
}
