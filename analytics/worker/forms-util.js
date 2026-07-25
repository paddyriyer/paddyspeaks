/**
 * PaddySpeaks — Contact + Testimonials Worker runtime helpers.
 * Crypto hashing, D1-backed fixed-window rate limiting, and email delivery
 * (Resend). Kept separate from the pure logic in ../lib/forms.js.
 */

const te = new TextEncoder();

export function json(obj, status, ch) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { ...ch, 'Content-Type': 'application/json' },
  });
}

export async function sha256Hex(str) {
  const d = await crypto.subtle.digest('SHA-256', te.encode(String(str)));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Best-effort client IP (Cloudflare). Never stored raw — always hashed. */
export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For') || '0.0.0.0';
}

/** Salt for one-way hashes. Falls back to a constant so it works pre-config. */
function salt(env) { return env.FORMS_SALT || 'paddyspeaks-forms-v1'; }

export async function ipHash(env, request) {
  return sha256Hex(salt(env) + '|' + clientIp(request));
}

/**
 * Fixed-window rate limit backed by D1 `rate_limits`. Returns { ok, retryAfter }.
 * Fails OPEN (ok:true) if the table/binding is unavailable — never blocks a
 * legitimate user because of an infra hiccup; the honeypot + email still apply.
 */
export async function rateLimit(env, request, endpoint, max, windowSec) {
  try {
    const now = Date.now();
    const win = Math.floor(now / (windowSec * 1000));
    const windowStart = new Date(win * windowSec * 1000).toISOString();
    const ip = clientIp(request);
    const bucket = await sha256Hex(salt(env) + '|' + endpoint + '|' + win + '|' + ip);
    const expiresAt = new Date((win + 1) * windowSec * 1000).toISOString();

    await env.FORMS.prepare(
      `INSERT INTO rate_limits (bucket, hits, window_start, expires_at)
       VALUES (?, 1, ?, ?)
       ON CONFLICT(bucket) DO UPDATE SET hits = hits + 1`
    ).bind(bucket, windowStart, expiresAt).run();

    const row = await env.FORMS.prepare(`SELECT hits FROM rate_limits WHERE bucket = ?`).bind(bucket).first();
    const hits = (row && row.hits) || 1;
    if (hits > max) {
      return { ok: false, retryAfter: Math.ceil(((win + 1) * windowSec * 1000 - now) / 1000) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: true }; // fail open
  }
}

/** Opportunistic cleanup of expired rate-limit rows (cheap, best-effort). */
export async function pruneRateLimits(env) {
  try {
    await env.FORMS.prepare(`DELETE FROM rate_limits WHERE expires_at < ?`)
      .bind(new Date().toISOString()).run();
  } catch (e) { /* ignore */ }
}

/**
 * Send an email through Resend (https://resend.com). One lightweight HTTPS call,
 * no SDK. Returns { ok, error }. Requires env.RESEND_API_KEY + env.CONTACT_FROM_EMAIL.
 *   from : env.CONTACT_FROM_EMAIL, e.g. "PaddySpeaks <hello@paddyspeaks.com>"
 */
export async function sendEmail(env, { to, subject, html, text, replyTo }) {
  if (!env.RESEND_API_KEY || !env.CONTACT_FROM_EMAIL) {
    return { ok: false, error: 'email-not-configured' };
  }
  try {
    const body = {
      from: env.CONTACT_FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      // Collapse newlines: a subject is a single header line. Resend takes JSON
      // (so it is not header-injectable), but keep the invariant at the source.
      subject: String(subject || '').replace(/[\r\n]+/g, ' ').slice(0, 200),
      html, text,
    };
    if (replyTo) body.reply_to = replyTo;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      // Log the provider's own diagnostic so a failure is debuggable from
      // `wrangler tail` / the Observability tab. Email addresses are redacted
      // first: Resend echoes them in some errors, and the house rule is that no
      // address ever reaches a log. Nothing here comes from the message body.
      console.error('[email] send rejected:', res.status, redactEmails(detail).slice(0, 300));
      return { ok: false, error: 'resend-' + res.status, detail: detail.slice(0, 200) };
    }
    return { ok: true };
  } catch (e) {
    console.error('[email] transport exception:', e && e.message ? e.message : 'unknown');
    return { ok: false, error: 'resend-exception' };
  }
}

/** Replace anything address-shaped with a placeholder before logging. */
export function redactEmails(s) {
  return String(s == null ? '' : s).replace(/[^\s"'<>@]+@[^\s"'<>@]+\.[^\s"'<>@]+/g, '[redacted-email]');
}

/** Minimal, on-brand HTML email shell (inline styles — email clients need them). */
export function emailShell(title, innerHtml) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#eef3f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f9;padding:28px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #c8d6e5;">
        <tr><td style="padding:26px 34px;border-bottom:1px solid #d8e4ef;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#1a2332;">Paddy<span style="color:#2563a8;">Speaks</span></div>
        </td></tr>
        <tr><td style="padding:30px 34px;font-family:Georgia,'Times New Roman',serif;color:#1a2332;font-size:15px;line-height:1.65;">
          <h1 style="font-family:Georgia,serif;font-size:19px;font-weight:600;color:#1a2332;margin:0 0 16px;">${title}</h1>
          ${innerHtml}
        </td></tr>
        <tr><td style="padding:20px 34px;border-top:1px solid #d8e4ef;font-family:'Courier New',monospace;font-size:11px;letter-spacing:.06em;color:#556677;">
          PADDYSPEAKS.COM · Philosophy · Technology · Wisdom
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
