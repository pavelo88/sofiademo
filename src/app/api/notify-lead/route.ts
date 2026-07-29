import {
  normalizeLeadPayload,
  validateLeadPayload,
  type LeadPayload,
} from '@/lib/lead-protection';
import { NextRequest, NextResponse } from 'next/server';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 3;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getRequesterKey = (req: NextRequest) => {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = req.headers.get('x-real-ip')?.trim();
  return forwardedFor || realIp || 'unknown';
};

const isRateLimited = (key: string) => {
  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > RATE_LIMIT_MAX_REQUESTS;
};

export async function POST(req: NextRequest) {
  try {
    const requesterKey = getRequesterKey(req);
    if (isRateLimited(requesterKey)) {
      return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
    }

    const payload = (await req.json()) as LeadPayload;
    const validationError = validateLeadPayload(payload);
    if (validationError) {
      return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
    }

    const { name, contact, technicalRequest, service } = normalizeLeadPayload(payload);
    const safe = {
      name: escapeHtml(name),
      contact: escapeHtml(contact),
      request: escapeHtml(technicalRequest),
      service: escapeHtml(service),
    };

    const resendKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_EMAIL || 'contacto@nombredetuempresa.com';

    if (!resendKey) {
      console.log('[notify-lead] No RESEND_API_KEY configured. Lead saved to Firestore only.');
      return NextResponse.json({ ok: true, note: 'no_email_configured' });
    }

    const htmlBody = `
          </p>
        </div>

        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 24px;">
          Nombre de tu Empresa · Sistema de gestión de leads
        </p>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Web <noreply@nombredetuempresa.com>',
        to: [adminEmail],
        subject: `Nuevo Lead: ${name} - ${service}`,
        html: htmlBody,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[notify-lead] Resend error:', err);
      // Don't throw - the lead is already in Firestore
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[notify-lead] Error:', error);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}
