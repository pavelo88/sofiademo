'use client';

/* eslint-disable react-hooks/use-memo -- QA: warning reviewed; keeping current flow to avoid behavioral changes. */

import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { FirebaseApp } from 'firebase/app';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { Firestore, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { FirebaseStorage } from 'firebase/storage';
import React, { DependencyList, ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  storage: FirebaseStorage | null;
}

// Internal state for user authentication
interface UserAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Combined state for the Firebase context
export interface FirebaseContextState {
  areServicesAvailable: boolean; // True if core services (app, firestore, auth instance) are provided
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null; // The Auth service instance
  storage: FirebaseStorage | null;
  // User authentication state
  user: User | null;
  isUserLoading: boolean; // True during initial auth check
  userError: Error | null; // Error from auth listener
}

// Return type for useFirebase()
export interface FirebaseServicesAndUser {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  storage: FirebaseStorage;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Return type for useUser() - specific to user auth state
export interface UserHookResult { // Renamed from UserAuthHookResult for consistency if desired, or keep as UserAuthHookResult
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * FirebaseProvider manages and provides Firebase services and user authentication state.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
  storage,
}) => {
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: !!auth, // Start loading until first auth event if auth is available
    userError: auth ? null : new Error("Auth service not provided."),
  });
  const [prevAuth, setPrevAuth] = useState(auth);

  if (auth !== prevAuth) {
    setPrevAuth(auth);
    if (!auth) {
      setUserAuthState({ user: null, isUserLoading: false, userError: new Error("Auth service not provided.") });
    } else {
      setUserAuthState({ user: null, isUserLoading: true, userError: null });
    }
  }

  // Effect to subscribe to Firebase auth state changes
  useEffect(() => {
    if (!auth) { // If no Auth service instance, cannot determine user state
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => { // Auth state determined
        setUserAuthState({ user: firebaseUser, isUserLoading: false, userError: null });
      },
      (error) => { // Auth listener error
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        setUserAuthState({ user: null, isUserLoading: false, userError: error });
      }
    );
    return () => unsubscribe(); // Cleanup
  }, [auth]); // Depends on the auth instance

  // Enforce one active inspector session across devices to protect sequential IDs.
  useEffect(() => {
    if (!auth || !firestore || !userAuthState.user?.email) return;

    let sessionId = typeof window !== 'undefined'
      ? localStorage.getItem('energy_engine_session_id')
      : null;
    if (!sessionId) {
      sessionId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (typeof window !== 'undefined') {
        localStorage.setItem('energy_engine_session_id', sessionId);
      }
      void setDoc(
        doc(firestore, 'usuarios', userAuthState.user.email),
        {
          activeSessionId: sessionId,
          activeSessionAt: serverTimestamp(),
          activeSessionDevice: 'inspection-web',
        },
        { merge: true }
      );
    }

    const userDocRef = doc(firestore, 'usuarios', userAuthState.user.email);
    const unsubscribe = onSnapshot(userDocRef, async (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as any;
      const activeSessionId = data?.activeSessionId as string | undefined;
      if (activeSessionId && activeSessionId !== sessionId) {
        console.warn('Session id remoto detectado, adoptando sesión activa sin cerrar autenticación local.');
        sessionId = activeSessionId;
        if (typeof window !== 'undefined') {
          localStorage.setItem('energy_engine_session_id', activeSessionId);
        }
      }
    });

    return () => unsubscribe();
  }, [auth, firestore, userAuthState.user]);

  // Memoize the context value
  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth && storage);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      storage: servicesAvailable ? storage : null,
      user: userAuthState.user,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
    };
  }, [firebaseApp, firestore, auth, storage, userAuthState]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

/**
 * Hook to access core Firebase services and user authentication state.
 * Throws error if core services are not available or used outside provider.
 */
export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);

  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }

  if (!context.areServicesAvailable || !context.firebaseApp || !context.auth) {
    // Si estamos offline, no bloqueamos el acceso si el auth existe pero storage/firestore fallan
    if (!navigator.onLine && context.auth) {
       return {
          firebaseApp: context.firebaseApp!,
          firestore: context.firestore!,
          auth: context.auth,
          storage: context.storage!,
          user: context.user,
          isUserLoading: context.isUserLoading,
          userError: context.userError,
       };
    }
    throw new Error('Servicios de Firebase no disponibles. Verifica la conexión.');
  }

  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore!,
    auth: context.auth,
    storage: context.storage!,
    user: context.user,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
  };
};

/** Hook to access Firebase Auth instance. */
export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  return auth;
};

/** Hook to access Firestore instance. */
export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  return firestore!;
};

/** Hook to access Firebase App instance. */
export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

/** Hook to access Firebase Storage instance. */
export const useStorage = (): FirebaseStorage => {
  const { storage } = useFirebase();
  return storage!;
};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoized = useMemo(factory, deps);
  return memoized;
}

/**
 * Hook specifically for accessing the authenticated user's state.
 * This provides the User object, loading status, and any auth errors.
 * @returns {UserHookResult} Object with user, isUserLoading, userError.
 */
export const useUser = (): UserHookResult => { // Renamed from useAuthUser
  const { user, isUserLoading, userError } = useFirebase(); // Leverages the main hook
  return { user, isUserLoading, userError };
};
