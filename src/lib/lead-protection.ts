export type LeadPayload = {
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  request?: string;
  technicalRequest?: string;
  service?: string;
  website?: string;
};

export type NormalizedLeadPayload = {
  name: string;
  contact: string;
  phone: string;
  email: string;
  technicalRequest: string;
  service: string;
};

const LEAD_COOLDOWN_MS = 60_000;
const LEAD_LAST_SUBMIT_KEY = 'energy_engine_last_lead_submit_at';

const cleanText = (value: unknown, maxLength: number) =>
  String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

const hasUrlSpam = (value: string) => {
  const matches = value.match(/https?:\/\/|www\.|\.ru\b|\.cn\b|bit\.ly|t\.me\//gi);
  return (matches?.length || 0) > 1;
};

export const normalizeLeadPayload = (payload: LeadPayload): NormalizedLeadPayload => {
  const name = cleanText(payload.name, 120);
  const contact = cleanText(payload.contact || `${payload.email || ''} ${payload.phone || ''}`, 180);
  const phone = cleanText(payload.phone || contact.replace(/[^\d+\s()-]/g, ''), 60);
  const email = cleanText(payload.email || contact.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0] || '', 160).toLowerCase();
  const technicalRequest = cleanText(payload.technicalRequest || payload.request, 300);
  const service = cleanText(payload.service || 'Formulario web', 160);

  return { name, contact, phone, email, technicalRequest, service };
};

export const validateLeadPayload = (payload: LeadPayload): string | null => {
  if (payload.website && cleanText(payload.website, 100)) return 'spam_detected';

  const normalized = normalizeLeadPayload(payload);
  const contactValue = `${normalized.contact} ${normalized.phone} ${normalized.email}`.trim();
  const emailLooksValid = !normalized.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email);
  const hasPhoneLikeContact = /(?:\+?\d[\d\s().-]{5,})/.test(contactValue);

  if (normalized.name.length < 2) return 'invalid_name';
  if (normalized.technicalRequest.length < 10) return 'invalid_request';
  if (!contactValue || (!normalized.email && !hasPhoneLikeContact)) return 'invalid_contact';
  if (!emailLooksValid) return 'invalid_email';
  if (hasUrlSpam(`${normalized.name} ${contactValue} ${normalized.technicalRequest}`)) return 'spam_detected';

  return null;
};

export const getLeadCooldownRemainingMs = () => {
  if (typeof window === 'undefined') return 0;
  const lastSubmitAt = Number(window.localStorage.getItem(LEAD_LAST_SUBMIT_KEY) || 0);
  const remaining = LEAD_COOLDOWN_MS - (Date.now() - lastSubmitAt);
  return Math.max(0, remaining);
};

export const markLeadSubmitted = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LEAD_LAST_SUBMIT_KEY, String(Date.now()));
};

export const leadCooldownMessage = (remainingMs: number) =>
  `Espera ${Math.ceil(remainingMs / 1000)} segundos antes de enviar otra solicitud.`;
