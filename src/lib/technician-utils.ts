'use client';


const TECH_NAME_KEY = 'energy_engine_tech_name';
const TECH_INITIALS_KEY = 'energy_engine_tech_initials';

/**
 * Persiste el nombre del inspector en localStorage para uso offline.
 */
export const saveTechnicianInfo = (name: string, initials: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TECH_NAME_KEY, name);
  localStorage.setItem(TECH_INITIALS_KEY, initials.toUpperCase());
};

/**
 * Recupera el nombre del inspector guardado.
 */
export const getTechnicianName = (): string => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(TECH_NAME_KEY) || '';
};

/**
 * Recupera las iniciales del inspector guardadas.
 */
export const getTechnicianInitials = (): string => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(TECH_INITIALS_KEY) || '';
};

/**
 * Resuelve las dos primeras letras del nombre del inspector.
 * Mantiene compatibilidad con el caché y, como último recurso, con el email.
 */
export const resolveInitials = (nameOrEmail?: string | null, fallbackEmail?: string | null): string => {
  const extractFromText = (value?: string | null): string => {
    if (!value) return '';

    const normalized = value.trim();
    if (!normalized) return '';

    if (normalized.includes('@')) {
      const part = normalized.split('@')[0].trim();
      return part.substring(0, 2).toUpperCase();
    }

    const firstWord = normalized.split(/\s+/)[0] || '';
    const cleaned = firstWord.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return cleaned.substring(0, 2).toUpperCase();
  };

  const hasExplicitName = Boolean(nameOrEmail && !String(nameOrEmail).includes('@'));
  if (hasExplicitName) {
    const fromName = extractFromText(nameOrEmail);
    if (fromName) return fromName;
  }

  const cached = getTechnicianInitials();
  if (cached) return cached;

  return extractFromText(nameOrEmail) || extractFromText(fallbackEmail) || 'EE';
};
