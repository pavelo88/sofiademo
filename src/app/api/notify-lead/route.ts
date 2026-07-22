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

    // Use Resend if RESEND_API_KEY is set, otherwise log and succeed silently
    const resendKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_EMAIL || 'administracion@energyengine.es';

    if (!resendKey) {
      // No email configured - lead is already saved in Firestore, just return OK
      console.log('[notify-lead] No RESEND_API_KEY configured. Lead saved to Firestore only.');
      return NextResponse.json({ ok: true, note: 'no_email_configured' });
    }

    const htmlBody = `
	      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
	        <div style="background: #0f5b3a; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
	          <h1 style="color: white; margin: 0; font-size: 20px; letter-spacing: 2px; text-transform: uppercase;">⚡ Nuevo Lead — Energy Engine</h1>
	        </div>
        
        <p style="color: #6b7280; font-size: 14px;">Se ha recibido una nueva consulta a través del chat de la web:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
	          <tr style="background: #f9fafb;">
	            <td style="padding: 12px 16px; font-weight: bold; color: #374151; font-size: 13px; width: 30%; border-radius: 6px;">🔧 Servicio</td>
	            <td style="padding: 12px 16px; color: #0f5b3a; font-weight: bold; font-size: 13px;">${safe.service}</td>
	          </tr>
	          <tr>
	            <td style="padding: 12px 16px; font-weight: bold; color: #374151; font-size: 13px;">👤 Nombre</td>
	            <td style="padding: 12px 16px; color: #1f2937; font-size: 13px;">${safe.name}</td>
	          </tr>
	          <tr style="background: #f9fafb;">
	            <td style="padding: 12px 16px; font-weight: bold; color: #374151; font-size: 13px;">📞 Contacto</td>
	            <td style="padding: 12px 16px; color: #1f2937; font-size: 13px;">${safe.contact}</td>
	          </tr>
	          <tr>
	            <td style="padding: 12px 16px; font-weight: bold; color: #374151; font-size: 13px; vertical-align: top;">💬 Consulta</td>
	            <td style="padding: 12px 16px; color: #1f2937; font-size: 13px; white-space: pre-wrap;">${safe.request}</td>
	          </tr>
	        </table>

        <div style="background: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 8px; padding: 16px; margin-top: 20px;">
          <p style="margin: 0; color: #065f46; font-size: 13px; font-weight: bold;">
            ✅ Este lead ha sido guardado automáticamente en el panel de administración bajo "Solicitudes Web".
          </p>
        </div>

        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 24px;">
          Energy Engine · Sistema de gestión de leads · energyengine.es
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
        from: 'Energy Engine Web <noreply@energyengine.es>',
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
