import { isFirebaseConfigured } from '@/firebase/config';
import {
  normalizeLeadPayload,
  validateLeadPayload,
  type LeadPayload,
} from '@/lib/lead-protection';

type SubmitWebLeadInput = LeadPayload & {
  source: string;
  service?: string;
};

export async function submitWebLead(payload: SubmitWebLeadInput): Promise<void> {
  const validationError = validateLeadPayload(payload);
  if (validationError) {
    throw new Error(validationError);
  }

  const normalized = normalizeLeadPayload(payload);

  if (isFirebaseConfigured()) {
    const { initializeFirebase } = await import('@/firebase');
    const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
    const { firestore } = initializeFirebase();

    await addDoc(collection(firestore, 'contact_requests'), {
      name: normalized.name,
      phone: normalized.phone || normalized.contact,
      email: normalized.email,
      technicalRequest: payload.service
        ? `[${normalized.service}] ${normalized.technicalRequest}`
        : normalized.technicalRequest,
      serviceOrigin: normalized.service,
      createdAt: serverTimestamp(),
      status: 'Pendiente',
      source: payload.source,
    });
  }

  const response = await fetch('/api/notify-lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: normalized.name,
      contact: normalized.contact,
      phone: normalized.phone,
      email: normalized.email,
      technicalRequest: normalized.technicalRequest,
      request: normalized.technicalRequest,
      service: normalized.service,
      website: payload.website,
    }),
  });

  if (!response.ok) {
    throw new Error('notify_failed');
  }
}
