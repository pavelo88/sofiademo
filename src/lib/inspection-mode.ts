'use client';

export type InspectionMode = 'online' | 'offline';

const MODE_KEY = 'energy_engine_inspection_mode';
const OFFLINE_EMAIL_KEY = 'energy_engine_offline_email';

export const normalizeInspectionEmail = (value: string) => {
  if (!value) return '';
  return value.trim().toLowerCase()
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F-\u009F\u00A0\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, '');
};

export const getInspectionMode = (): InspectionMode => {
  if (typeof window === 'undefined') return 'online';
  const raw = localStorage.getItem(MODE_KEY);
  return raw === 'offline' ? 'offline' : 'online';
};

export const setInspectionMode = (mode: InspectionMode) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MODE_KEY, mode);
  window.dispatchEvent(new CustomEvent('inspection-mode-changed', { detail: mode }));
};

export const getStoredOfflineEmail = (): string | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(OFFLINE_EMAIL_KEY);
  if (!raw) return null;
  return normalizeInspectionEmail(raw);
};

export const setStoredOfflineEmail = (email: string) => {
  if (typeof window === 'undefined') return;
  const normalized = normalizeInspectionEmail(email);
  if (!normalized) return;
  localStorage.setItem(OFFLINE_EMAIL_KEY, normalized);
};

// MEJORADO: Ahora prioriza el email real de Firebase y no bloquea si no hay offline
export const resolveInspectorEmail = (firebaseEmail?: string | null): string | null => {
  if (firebaseEmail) return normalizeInspectionEmail(firebaseEmail);
  
  const offline = getStoredOfflineEmail();
  if (offline) return offline;

  return null;
};

// MEJORADO: Ya no es tan estricto. Si hay email de Firebase, DEJA PASAR.
export const canUseCloudSync = (isOnline: boolean, firestoreReady: boolean, firebaseEmail?: string | null) => {
  // Si no hay internet o firestore no carga, directo a offline
  if (!isOnline || !firestoreReady) return false;
  
  // Si hay un email de Firebase, permitimos el uso de la nube
  const email = resolveInspectorEmail(firebaseEmail);
  if (!email) return false;

  // Si el usuario eligió manualmente "modo offline", respetamos su decisión
  return getInspectionMode() !== 'offline';
};