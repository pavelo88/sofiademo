'use client';

import { format } from 'date-fns';
import { resolveInitials } from '@/lib/technician-utils';

const cleanText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const getFallbackInitials = (email?: string | null, name?: string | null) => {
  const emailInitials = cleanText(resolveInitials(email || '')).toUpperCase();
  if (emailInitials && email) return emailInitials;

  const firstName = cleanText(name || '')
    .replace(/[^a-zA-ZÀ-ÿ\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)[0] || '';

  return firstName.substring(0, 2).toUpperCase() || 'EE';
};

export const buildVisitId = (
  inspectorEmail?: string | null,
  inspectorName?: string | null,
  dateValue?: Date | string | number | null
) => {
  const date = dateValue instanceof Date ? dateValue : dateValue ? new Date(dateValue) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const initials = getFallbackInitials(inspectorEmail, inspectorName);
  const datePart = format(safeDate, 'yyyyMMdd');
  const timePart = format(safeDate, 'HHmmss');
  // If time is midnight (likely a date-only value), use a unique suffix from timestamp
  const uniqueSuffix = timePart !== '000000' ? timePart : String(Date.now()).slice(-6);

  return `VIS-${initials}-${datePart}-${uniqueSuffix}`;
};
