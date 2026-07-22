const LEGACY_SIGNATURE_KEY = 'energy_engine_signature';
const SIGNATURE_KEY_PREFIX = 'energy_engine_signature:';

const normalizeEmail = (email?: string | null) => (email || '').trim().toLowerCase();

const canUseStorage = () => typeof window !== 'undefined' && !!window.localStorage;

export function getSignatureStorageKey(email?: string | null) {
  const normalizedEmail = normalizeEmail(email);
  return normalizedEmail ? `${SIGNATURE_KEY_PREFIX}${normalizedEmail}` : null;
}

export function getStoredSignatureForEmail(email?: string | null) {
  if (!canUseStorage()) return null;
  const key = getSignatureStorageKey(email);
  return key ? window.localStorage.getItem(key) : null;
}

export function setStoredSignatureForEmail(email: string | null | undefined, signature: string) {
  if (!canUseStorage()) return;
  const key = getSignatureStorageKey(email);
  if (key) window.localStorage.setItem(key, signature);
}

export function clearStoredSignatureForEmail(email?: string | null) {
  if (!canUseStorage()) return;
  const key = getSignatureStorageKey(email);
  if (key) window.localStorage.removeItem(key);
}

export function clearLegacyStoredSignature() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(LEGACY_SIGNATURE_KEY);
}
