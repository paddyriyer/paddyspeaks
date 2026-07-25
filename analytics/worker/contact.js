/**
 * PaddySpeaks — Contact routes. Mounted by worker.js on /api/contact.
 * Uses env.FORMS (D1) for rate-limiting + duplicate suppression, and Resend
 * for delivery. The owner's address lives ONLY in env.CONTACT_TO_EMAIL — it is
 * never sent to the browser and never appears in frontend code.
 *
 * Privacy: the visitor's name, email, subject and message are emailed and then
 * discarded. contact_log stores only the reason + salted one-way hashes.
 */

import { validateContact, escapeHtml, CONTACT_REASONS } from '../lib/forms.js';
import { json, sha256Hex, ipHash, rateLimit, pruneRateLimits, sendEmail, emailShell } from './forms-util.js';

const REASON_LABELS = {
  article_feedback: 'Article feedback',
  interview_studio: 'Interview Studio',
  technical_consulting: 'Technical consulting',
  collaboration: 'Collaboration or speaking',
  spiritual_cultural: 'Spiritual or cultural content',
  website_issue: 'Website issue',
  other: 'Something else',
};

const CFG = {
  rlMax: 5,            // max submissions
  rlWindowSec: 3600,   // per hour, per IP
  dedupWindowSec: 600, // ignore identical (ip+subject+message) within 10 min
};

async function handleSubmit(request, env, ch) {
  let d;
  try { d = await request.json(); } catch { return json({ error: 'bad_request' }, 400, ch); }

  // 1) Honeypot — a real user never fills a hidden field. Pretend success.
  if (d && typeof d.company === 'string' && d.company.trim() !== '') {
    return json({ ok: true }, 200, ch);
  }

  // 2) Validate + sanitize (same rules as the client)
  const { valid, errors, data } = validateContact(d || {});
  if (!valid) return json({ error: 'validation', errors }, 422, ch);

  // 3) Rate limit per IP
  const rl = await rateLimit(env, request, 'contact', CFG.rlMax, CFG.rlWindowSec);
  if (!rl.ok) {
    return json({ error: 'rate_limited', message: 'Too many messages. Please try again later.' },
      429, { ...ch, 'Retry-After': String(rl.retryAfter || 3600) });
  }

  // 4) Duplicate-submission suppression (defends against repeated clicks even if
  //    the button guard is bypassed). Content hash is salted + one-way.
  const iph = await ipHash(env, request);
  const contentHash = await sha256Hex(iph + '|' + data.subject + '|' + data.message);
  try {
    const cutoff = new Date(Date.now() - CFG.dedupWindowSec * 1000).toISOString();
    const dup = await env.FORMS.prepare(
      `SELECT 1 FROM contact_log WHERE content_hash = ? AND created_at >= ? LIMIT 1`
    ).bind(contentHash, cutoff).first();
    if (dup) return json({ ok: true, duplicate: true }, 200, ch); // idempotent
  } catch (e) { /* table missing → skip dedup */ }

  // 5) Deliver to the owner (address from env only)
  if (!env.CONTACT_TO_EMAIL) return json({ error: 'not_configured' }, 503, ch);
  const reasonLabel = REASON_LABELS[data.reason] || data.reason;
  const ownerHtml = emailShell('New message via Contact', `
    <p style="margin:0 0 6px;"><strong>From:</strong> ${escapeHtml(data.name)} &lt;${escapeHtml(data.email)}&gt;</p>
    <p style="margin:0 0 6px;"><strong>Reason:</strong> ${escapeHtml(reasonLabel)}</p>
    <p style="margin:0 0 14px;"><strong>Subject:</strong> ${escapeHtml(data.subject)}</p>
    <div style="padding:16px 18px;background:#f4f8fc;border-left:3px solid #2563a8;white-space:pre-wrap;">${escapeHtml(data.message)}</div>
    <p style="margin:16px 0 0;font-size:13px;color:#556677;">Reply directly to this email to respond to ${escapeHtml(data.name)}.</p>
  `);
  const owner = await sendEmail(env, {
    to: env.CONTACT_TO_EMAIL,
    subject: `[Contact · ${reasonLabel}] ${data.subject}`,
    html: ownerHtml,
    text: `From: ${data.name} <${data.email}>\nReason: ${reasonLabel}\nSubject: ${data.subject}\n\n${data.message}`,
    replyTo: data.email,
  });
  if (!owner.ok) {
    // Do not log or return message content. `reason` is the provider's status
    // code only (e.g. "resend-401") — enough to tell a bad key from a rejected
    // sender without leaking anything about the visitor or their message.
    return json({
      error: 'delivery_failed',
      message: 'We could not send your message right now. Please try again shortly.',
      reason: owner.error,
    }, 502, ch);
  }

  // 6) Acknowledge the visitor (best-effort; owner already has the message)
  const copyBlock = data.sendCopy ? `
    <p style="margin:18px 0 6px;font-size:13px;color:#556677;">Here is a copy of what you sent:</p>
    <p style="margin:0 0 4px;"><strong>Subject:</strong> ${escapeHtml(data.subject)}</p>
    <div style="padding:14px 16px;background:#f4f8fc;border-left:3px solid #c8d6e5;white-space:pre-wrap;">${escapeHtml(data.message)}</div>` : '';
  const ackHtml = emailShell('Your message has reached PaddySpeaks', `
    <p style="margin:0 0 14px;">Hello ${escapeHtml(data.name.split(/\s+/)[0] || 'there')},</p>
    <p style="margin:0 0 14px;">Thank you for writing. Your note has arrived. If a reply is needed, I&rsquo;ll get back to you as soon as I can — thoughtful replies occasionally take longer than impatient algorithms prefer.</p>
    ${copyBlock}
    <p style="margin:18px 0 0;">— Paddy</p>
  `);
  await sendEmail(env, {
    to: data.email,
    subject: 'Thanks for reaching out — PaddySpeaks',
    html: ackHtml,
    text: `Hello ${data.name.split(/\s+/)[0] || 'there'},\n\nThank you for writing. Your note has arrived at PaddySpeaks. If a reply is needed, I'll get back to you as soon as I can.\n\n— Paddy`,
  });

  // 7) Record a non-identifying log row (reason + hashes only)
  try {
    await env.FORMS.prepare(
      `INSERT INTO contact_log (id, reason, ip_hash, content_hash, created_at) VALUES (?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), CONTACT_REASONS.includes(data.reason) ? data.reason : 'other',
      iph, contentHash, new Date().toISOString()).run();
  } catch (e) { /* best-effort */ }
  pruneRateLimits(env);

  return json({ ok: true }, 200, ch);
}

export async function routeContact(request, env, url, ch) {
  const p = url.pathname;
  if (!p.startsWith('/api/contact')) return null;
  if (!env.FORMS) return json({ error: 'not_configured' }, 503, ch);
  if (p === '/api/contact' && request.method === 'POST') return handleSubmit(request, env, ch);
  if (p === '/api/contact/submit' && request.method === 'POST') return handleSubmit(request, env, ch);
  return json({ error: 'not_found' }, 404, ch);
}
