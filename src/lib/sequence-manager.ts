'use client';

import { db as dbLocal } from '@/lib/db-local';
import { normalizeInspectionEmail } from '@/lib/inspection-mode';
import { doc, getDoc, runTransaction, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';

type SequenceRequest = {
  type: string;
  userEmail: string;
  firestore: Firestore | null;
  isOnline: boolean;
  year?: number;
};

const getYear = (year?: number) => year || new Date().getFullYear();
const PROJECTION_TIMEOUT_MS = 1500;


export const COUNTER_RESET_DONE_KEY = 'ee_counter_cloud_reset_v2';


export const forceResetLocalCountersFromCloud = async (
  firestore: Firestore,
  userEmail: string,
  year?: number
): Promise<void> => {
  const normalizedEmail = normalizeInspectionEmail(userEmail);
  if (!normalizedEmail) return;

  const activeYear = getYear(year);
  const userRef = doc(firestore, 'usuarios', normalizedEmail);

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;

    const countersByYear = (snap.data()?.inspectionCounters || {}) as Record<string, Record<string, number>>;
    const cloudYearCounters = countersByYear[String(activeYear)] || {};

    // Cloud wins unconditionally — set local = cloud for every type
    for (const [type, rawValue] of Object.entries(cloudYearCounters)) {
      const cloudValue = Number(rawValue);
      if (!Number.isFinite(cloudValue) || cloudValue < 0) continue;
      await dbLocal.setSequence(type, normalizedEmail, cloudValue, activeYear);
    }

    console.info('[CounterReset] Contadores locales reseteados desde Firebase para:', normalizedEmail);
  } catch (err) {
    console.warn('[CounterReset] No se pudo ejecutar el reset one-time:', err);
  }
};

export const syncLocalCountersFromCloud = async (
  firestore: Firestore,
  userEmail: string,
  year?: number
) => {
  const normalizedEmail = normalizeInspectionEmail(userEmail);
  if (!normalizedEmail) return;

  const activeYear = getYear(year);
  const userRef = doc(firestore, 'usuarios', normalizedEmail);

  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const data = snap.data();
  const countersByYear = (data?.inspectionCounters || {}) as Record<string, Record<string, number>>;
  const yearKey = String(activeYear);
  const cloudYearCounters = countersByYear[yearKey] || {};

  let needsCloudUpdate = false;
  const updatedCloudCounters = { ...cloudYearCounters };

  const allTypes = new Set([...Object.keys(cloudYearCounters), 'IT', 'IR', 'IS', 'HT', 'Bfiltros', 'informe-tecnico', 'informe-revision', 'informe-simplificado', 'hoja-trabajo']);

  for (const type of allTypes) {
    const cloudValue = Number(cloudYearCounters[type] || 0);
    const localValue = await dbLocal.getSequence(type, normalizedEmail, activeYear);
    
    if (localValue < cloudValue) {
      // Force local to equal cloud
      await dbLocal.setSequence(type, normalizedEmail, cloudValue, activeYear);
    } else if (localValue > cloudValue) {
      // Prepare to update cloud
      updatedCloudCounters[type] = localValue;
      needsCloudUpdate = true;
    }
  }

  if (needsCloudUpdate) {
    await setDoc(userRef, {
      inspectionCounters: {
        [yearKey]: updatedCloudCounters,
      },
      countersUpdatedAt: serverTimestamp(),
    }, { merge: true });
  }
};

/**
 * Empuja el valor máximo (local vs nube) del contador hacia Firebase.
 * Se llama SIEMPRE después de crear un informe, sin importar si fue online u offline.
 * Es fire-and-forget: no bloquea el flujo de guardado.
 */
export const pushCounterToCloud = async (
  type: string,
  userEmail: string,
  firestore: Firestore,
  explicitSequence: number,
  year?: number
): Promise<void> => {
  const normalizedEmail = normalizeInspectionEmail(userEmail);
  if (!normalizedEmail || !firestore || !Number.isFinite(explicitSequence)) return;

  const activeYear = getYear(year);
  const yearKey = String(activeYear);

  try {
    const userRef = doc(firestore, 'usuarios', normalizedEmail);
    const updatePath = `inspectionCounters.${yearKey}.${type}`;
    
    try {
      await updateDoc(userRef, { [updatePath]: explicitSequence });
    } catch (updateErr) {
      await setDoc(userRef, {
        inspectionCounters: {
          [yearKey]: { [type]: explicitSequence }
        }
      }, { merge: true });
    }
  } catch (err) {
    console.warn(`[pushCounterToCloud] Error:`, err);
  }
};

export const getNextSequenceForUser = async ({
  type,
  userEmail,
  firestore,
  isOnline,
  year,
}: SequenceRequest): Promise<number> => {
  const normalizedEmail = normalizeInspectionEmail(userEmail);
  const activeYear = getYear(year);

  if (!normalizedEmail) {
    return dbLocal.getNextSequence(type, 'global', activeYear);
  }

  const getLocalFallback = async () => dbLocal.getNextSequence(type, normalizedEmail, activeYear);

  if (!isOnline || !firestore) {
    // Offline: incrementamos el contador local. pushCounterToCloud lo sincronizará al reconectar.
    const next = await getLocalFallback();
    return next;
  }

  try {
    const userRef = doc(firestore, 'usuarios', normalizedEmail);
    const snap = await getDoc(userRef);
    const exists = snap.exists();
    const data = (exists ? snap.data() : {}) as any;
    const countersByYear = (data?.inspectionCounters || {}) as Record<string, Record<string, number>>;
    const yearKey = String(activeYear);

    // Leer el valor actual
    const cloudCurrent = Number(countersByYear?.[yearKey]?.[type] || 0);
    const nextValue = cloudCurrent + 1;

    // Actualizar directamente usando updateDoc como comprobamos en fix-counter
    const updatePath = `inspectionCounters.${yearKey}.${type}`;
    if (exists) {
      await updateDoc(userRef, { [updatePath]: nextValue });
    } else {
      await setDoc(userRef, {
        inspectionCounters: {
          [yearKey]: {
            [type]: nextValue
          }
        }
      }, { merge: true });
    }

    // Alinear contador local
    await dbLocal.setSequence(type, normalizedEmail, nextValue, activeYear);
    return nextValue;
  } catch (error) {
    console.warn(`Falling back to local sequence for ${type}:`, error);
    return getLocalFallback();
  }
};

export const getProjectedSequenceForUser = async ({
  type,
  userEmail,
  firestore,
  isOnline,
  year,
}: SequenceRequest): Promise<number> => {
  const normalizedEmail = normalizeInspectionEmail(userEmail);
  const activeYear = getYear(year);

  if (!normalizedEmail) {
    const current = await dbLocal.getSequence(type, 'global', activeYear);
    return current + 1;
  }

  const getLocalProjected = async () => {
    const localCurrent = await dbLocal.getSequence(type, normalizedEmail, activeYear);
    return localCurrent + 1;
  };

  if (!isOnline || !firestore) {
    return getLocalProjected();
  }

  try {
    const userRef = doc(firestore, 'usuarios', normalizedEmail);
    const snap = await Promise.race([
      getDoc(userRef),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Projected sequence timeout')), PROJECTION_TIMEOUT_MS);
      }),
    ]);
    const countersByYear = ((snap.exists() ? snap.data()?.inspectionCounters : {}) || {}) as Record<string, Record<string, number>>;
    const yearKey = String(activeYear);
    const cloudCurrent = Number(countersByYear?.[yearKey]?.[type] || 0);
    return cloudCurrent + 1;
  } catch (error) {
    console.warn(`Falling back to local projected sequence for ${type}:`, error);
    return getLocalProjected();
  }
};
