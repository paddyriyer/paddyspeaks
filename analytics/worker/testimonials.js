/**
 * PaddySpeaks — Testimonials routes. Mounted by worker.js on /api/testimonials.
 *
 * Public:
 *   POST /api/testimonials            — submit (enters 'pending'; never auto-published)
 *   GET  /api/testimonials            — approved only; email never returned; display
 *                                       preference respected server-side
 * Owner (Bearer sha256(password) === env.ADMIN_PASSWORD_HASH):
 *   GET  /api/testimonials/admin?status=pending|approved|rejected|all
 *   POST /api/testimonials/admin      — { id, action, ...fields }
 *                                       action ∈ approve|reject|unpublish|edit|delete|feature
 *
 * Moderation guarantees: every submission starts 'pending'; only 'approved'
 * rows are ever returned by the public GET; emails are stored (for reply/verify)
 * but NEVER exposed.
 */

import {
  validateTestimonial, toPublicTestimonial, deriveDisplayName, escapeHtml, LIMITS,
} from '../lib/forms.js';
import { json, ipHash, rateLimit, pruneRateLimits, sendEmail, emailShell } from './forms-util.js';

const REL_LABELS = {
  reader: 'PaddySpeaks reader',
  studio_user: 'Interview Studio user',
  collaborator: 'Professional collaborator',
  attendee: 'Event or presentation attendee',
  community: 'Friend or community member',
  other: 'Other',
};

const CFG = { rlMax: 3, rlWindowSec: 3600, publicLimit: 50 };

function authOk(request, env) {
  const auth = request.headers.get('Authorization') || '';
  return !!env.ADMIN_PASSWORD_HASH && auth.startsWith('Bearer ') && auth.slice(7) === env.ADMIN_PASSWORD_HASH;
}

/* ── public submit ── */
async function handleSubmit(request, env, ch) {
  let d;
  try { d = await request.json(); } catch { return json({ error: 'bad_request' }, 400, ch); }

  // Honeypot
  if (d && typeof d.company_website === 'string' && d.company_website.trim() !== '') {
    return json({ ok: true }, 200, ch);
  }

  const { valid, errors, data } = validateTestimonial(d || {});
  if (!valid) return json({ error: 'validation', errors }, 422, ch);

  const rl = await rateLimit(env, request, 'testimonial', CFG.rlMax, CFG.rlWindowSec);
  if (!rl.ok) {
    return json({ error: 'rate_limited', message: 'Too many submissions. Please try again later.' },
      429, { ...ch, 'Retry-After': String(rl.retryAfter || 3600) });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const iph = await ipHash(env, request);
  try {
    await env.FORMS.prepare(
      `INSERT INTO testimonials
         (id, full_name, email, role, organization, relationship, body, verify_url,
          display_pref, status, featured, ip_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)`
    ).bind(id, data.name, data.email, data.role || null, data.organization || null,
      data.relationship, data.body, data.verifyUrl || null, data.displayPref,
      iph, now, now).run();
  } catch (e) {
    return json({ error: 'not_configured' }, 503, ch);
  }

  // Notify the owner (best-effort)
  if (env.CONTACT_TO_EMAIL) {
    const relLabel = REL_LABELS[data.relationship] || data.relationship;
    const previewName = deriveDisplayName(data.name, data.displayPref);
    const ownerHtml = emailShell('New testimonial awaiting review', `
      <p style="margin:0 0 6px;"><strong>From:</strong> ${escapeHtml(data.name)} &lt;${escapeHtml(data.email)}&gt;</p>
      <p style="margin:0 0 6px;"><strong>Relationship:</strong> ${escapeHtml(relLabel)}</p>
      ${data.role ? `<p style="margin:0 0 6px;"><strong>Role:</strong> ${escapeHtml(data.role)}</p>` : ''}
      ${data.organization ? `<p style="margin:0 0 6px;"><strong>Organization:</strong> ${escapeHtml(data.organization)}</p>` : ''}
      <p style="margin:0 0 6px;"><strong>Will display as:</strong> ${escapeHtml(previewName)} (${escapeHtml(data.displayPref)})</p>
      ${data.verifyUrl ? `<p style="margin:0 0 12px;"><strong>Verify:</strong> ${escapeHtml(data.verifyUrl)}</p>` : ''}
      <div style="padding:16px 18px;background:#f4f8fc;border-left:3px solid #2563a8;white-space:pre-wrap;">${escapeHtml(data.body)}</div>
      <p style="margin:16px 0 0;font-size:13px;color:#556677;">Review it in the moderation console — nothing is published until you approve it.</p>
    `);
    await sendEmail(env, {
      to: env.CONTACT_TO_EMAIL,
      subject: `[Testimonial · pending] ${previewName}`,
      html: ownerHtml,
      text: `New testimonial from ${data.name} <${data.email}> (${relLabel}).\n\n${data.body}\n\nReview in the moderation console.`,
      replyTo: data.email,
    });
  }

  // Acknowledge the contributor
  const ackHtml = emailShell('Thank you for sharing your experience', `
    <p style="margin:0 0 14px;">Hello ${escapeHtml(data.name.split(/\s+/)[0] || 'there')},</p>
    <p style="margin:0 0 14px;">Your testimonial has been received. Before anything appears on PaddySpeaks, I review each submission personally — and, with your permission, may lightly edit for grammar without changing your meaning. It will then be published according to the display preference you chose.</p>
    <p style="margin:0 0 14px;">Thank you for taking the time. It genuinely helps.</p>
    <p style="margin:18px 0 0;">— Paddy</p>
  `);
  await sendEmail(env, {
    to: data.email,
    subject: 'Your testimonial has been received — PaddySpeaks',
    html: ackHtml,
    text: `Hello ${data.name.split(/\s+/)[0] || 'there'},\n\nYour testimonial has been received and will be reviewed before it appears on PaddySpeaks.\n\n— Paddy`,
  });

  pruneRateLimits(env);
  return json({ ok: true, id }, 200, ch);
}

/* ── public list (approved only) ── */
async function handleList(request, env, url, ch) {
  const featuredOnly = url.searchParams.get('featured') === '1';
  const limit = Math.min(CFG.publicLimit, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
  try {
    const where = featuredOnly ? `status = 'approved' AND featured = 1` : `status = 'approved'`;
    const rows = await env.FORMS.prepare(
      `SELECT id, full_name, role, organization, relationship, body, edited_body,
              display_pref, display_name, featured, created_at
         FROM testimonials WHERE ${where}
         ORDER BY featured DESC, created_at DESC LIMIT ?`
    ).bind(limit).all();
    const entries = (rows.results || []).map(toPublicTestimonial);
    return json({ count: entries.length, testimonials: entries }, 200,
      { ...ch, 'Cache-Control': 'public, max-age=120' });
  } catch (e) {
    // Table not provisioned yet → behave as "no approved testimonials".
    return json({ count: 0, testimonials: [] }, 200, ch);
  }
}

/* ── owner: list with full detail ── */
async function handleAdminList(request, env, url, ch) {
  if (!authOk(request, env)) return json({ error: 'unauthorized' }, 401, ch);
  const status = (url.searchParams.get('status') || 'pending').toLowerCase();
  const valid = ['pending', 'approved', 'rejected', 'all'];
  const s = valid.includes(status) ? status : 'pending';
  const where = s === 'all' ? '1=1' : 'status = ?';
  const binds = s === 'all' ? [] : [s];
  const rows = await env.FORMS.prepare(
    `SELECT id, full_name, email, role, organization, relationship, body, edited_body,
            verify_url, display_pref, display_name, status, featured, created_at, updated_at
       FROM testimonials WHERE ${where} ORDER BY created_at DESC LIMIT 500`
  ).bind(...binds).all();
  const items = (rows.results || []).map(r => ({
    ...r,
    featured: !!r.featured,
    preview_name: deriveDisplayName(r.full_name, r.display_pref, r.display_name),
    relationship_label: REL_LABELS[r.relationship] || r.relationship,
  }));
  return json({ status: s, count: items.length, items }, 200, ch);
}

/* ── owner: moderation actions ── */
async function handleAdminAction(request, env, ch) {
  if (!authOk(request, env)) return json({ error: 'unauthorized' }, 401, ch);
  let d;
  try { d = await request.json(); } catch { return json({ error: 'bad_request' }, 400, ch); }
  const id = String(d.id || '');
  const action = String(d.action || '');
  if (!id) return json({ error: 'id_required' }, 400, ch);
  const now = new Date().toISOString();

  if (action === 'delete') {
    const res = await env.FORMS.prepare(`DELETE FROM testimonials WHERE id = ?`).bind(id).run();
    return json({ ok: (res.meta && res.meta.changes) > 0 }, 200, ch);
  }

  if (action === 'approve' || action === 'reject' || action === 'unpublish') {
    const status = action === 'approve' ? 'approved' : (action === 'reject' ? 'rejected' : 'pending');
    const res = await env.FORMS.prepare(
      `UPDATE testimonials SET status = ?, updated_at = ? WHERE id = ?`
    ).bind(status, now, id).run();
    return json({ ok: (res.meta && res.meta.changes) > 0, status }, 200, ch);
  }

  if (action === 'feature') {
    const val = d.featured ? 1 : 0;
    const res = await env.FORMS.prepare(
      `UPDATE testimonials SET featured = ?, updated_at = ? WHERE id = ?`
    ).bind(val, now, id).run();
    return json({ ok: (res.meta && res.meta.changes) > 0, featured: !!val }, 200, ch);
  }

  if (action === 'edit') {
    // Light edits only. edited_body published in preference to body; empty clears it.
    const editedBody = d.edited_body != null ? String(d.edited_body).slice(0, LIMITS.testimonial.max + 100) : null;
    const displayName = d.display_name != null ? String(d.display_name).slice(0, 160) : null;
    const role = d.role != null ? String(d.role).slice(0, LIMITS.role.max) : null;
    const organization = d.organization != null ? String(d.organization).slice(0, LIMITS.organization.max) : null;
    const res = await env.FORMS.prepare(
      `UPDATE testimonials
         SET edited_body = ?, display_name = ?, role = COALESCE(?, role),
             organization = COALESCE(?, organization), updated_at = ?
       WHERE id = ?`
    ).bind(editedBody && editedBody.trim() ? editedBody : null,
      displayName && displayName.trim() ? displayName : null,
      role, organization, now, id).run();
    return json({ ok: (res.meta && res.meta.changes) > 0 }, 200, ch);
  }

  return json({ error: 'unknown_action' }, 400, ch);
}

export async function routeTestimonials(request, env, url, ch) {
  const p = url.pathname;
  const m = request.method;
  if (!p.startsWith('/api/testimonials')) return null;
  if (!env.FORMS) return json({ error: 'not_configured' }, 503, ch);
  if (p === '/api/testimonials/admin' && m === 'GET') return handleAdminList(request, env, url, ch);
  if (p === '/api/testimonials/admin' && m === 'POST') return handleAdminAction(request, env, ch);
  if (p === '/api/testimonials' && m === 'POST') return handleSubmit(request, env, ch);
  if (p === '/api/testimonials' && m === 'GET') return handleList(request, env, url, ch);
  return json({ error: 'not_found' }, 404, ch);
}
