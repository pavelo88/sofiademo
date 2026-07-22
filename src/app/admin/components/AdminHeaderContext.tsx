'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface AdminHeaderState {
  title: string;
  action: ReactNode | null;
}

interface AdminHeaderSetters {
  setTitle: (title: string) => void;
  setAction: (action: ReactNode | null) => void;
}

const AdminHeaderStateContext = createContext<AdminHeaderState | undefined>(undefined);
const AdminHeaderSettersContext = createContext<AdminHeaderSetters | undefined>(undefined);

export function AdminHeaderProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState('Administración');
  const [action, setAction] = useState<ReactNode | null>(null);

  const stateValue = useMemo(() => ({ title, action }), [title, action]);
  const settersValue = useMemo(() => ({ setTitle, setAction }), []);

  return (
    <AdminHeaderSettersContext.Provider value={settersValue}>
      <AdminHeaderStateContext.Provider value={stateValue}>
        {children}
      </AdminHeaderStateContext.Provider>
    </AdminHeaderSettersContext.Provider>
  );
}

export function useAdminHeaderState() {
  const context = useContext(AdminHeaderStateContext);
  if (!context) throw new Error('useAdminHeaderState must be used within AdminHeaderProvider');
  return context;
}

export function useAdminHeaderSetters() {
  const context = useContext(AdminHeaderSettersContext);
  if (!context) throw new Error('useAdminHeaderSetters must be used within AdminHeaderProvider');
  return context;
}

export function useAdminHeaderRaw() {
  const state = useAdminHeaderState();
  const setters = useAdminHeaderSetters();
  return { ...state, ...setters };
}

export function useAdminHeader(newTitle?: string, newAction: ReactNode | null = null) {
  const { setTitle, setAction } = useAdminHeaderSetters();

  useEffect(() => {
    if (newTitle) setTitle(newTitle);
  }, [newTitle, setTitle]);

  useEffect(() => {
    setAction(newAction);
  }, [newAction, setAction]);

  const setHeaderProps = useCallback(({ title, action = null }: { title: string, action?: ReactNode | null }) => {
    setTitle(title);
    setAction(action);
  }, [setTitle, setAction]);

  return { setHeaderProps };
}