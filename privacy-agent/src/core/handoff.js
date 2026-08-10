/**
 * Carrying work from the web console into the agent that can actually submit.
 *
 * The division of labour in this project is not a design preference, it is a
 * browser security rule. A page on paddyspeaks.com cannot fill in and submit a
 * form on someone else's site — the same-origin policy forbids it, and that
 * rule is the reason a random site cannot post from your bank tab. So the
 * console does everything up to the submit button: it builds the identity
 * profile, runs the searches, decides which records are really you, works out
 * what can be removed and drafts the request. Then it stops, because it must.
 *
 * The CLI has no such limit. It drives a real Chromium, fills the forms,
 * submits them, pauses for CAPTCHAs and MFA, reads the confirmation, and
 * re-checks weeks later that the record stayed gone. That is the removal
 * engine, and it runs on the user's own machine because the alternative —
 * a service holding thousands of identity dossiers and acting as everyone's
 * agent — is the thing this tool exists to argue against.
 *
 * What was missing was the bridge. Someone would spend twenty minutes in the
 * console building a verified list of their own exposures, and then have to
 * start again from an empty vault to get anything removed. This module is that
 * bridge, and it is deliberately one-directional: browser → vault.
 *
 * Pure module — no I/O. The CLI reads the file; this decides what is in it.
 * Unit-tested in tests/run.mjs.
 */

import { STATE } from './states.js';
import { riskOf } from './risk.js';
import { siteKindFor } from './removability.js';

/** Shape guard. A wrong file should say so, not half-import and corrupt a vault. */
export function looksLikeConsoleExport(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const hasAnswers = data.answers && typeof data.answers === 'object';
  const hasExposures = Array.isArray(data.exposures);
  return Boolean(hasAnswers || hasExposures);
}

/**
 * Read a console export into the pieces the agent needs.
 *
 * The identity profile is NOT taken from the file's `profile` field, even
 * though one is there. It is rebuilt from the raw answers, so the vault always
 * holds a profile produced by the current version of `buildProfile` rather
 * than a snapshot from whatever the browser was running — an old export must
 * not smuggle stale name or address variants past the current parser.
 *
 * @param data parsed JSON from the console's "Export as JSON"
 * @returns { ok, answers, exposures, skipped, warnings, summary }
 */
export function readConsoleExport(data) {
  if (!looksLikeConsoleExport(data)) {
    return {
      ok: false,
      answers: null,
      exposures: [],
      skipped: [],
      warnings: ['That file does not look like a Privacy Console export. Use the "Export as JSON" button on the Your data card.'],
      summary: '',
    };
  }

  const warnings = [];
  const answers = data.answers && Object.keys(data.answers).length ? data.answers : null;
  if (!answers) {
    warnings.push('The export carries no identity answers, so the agent will keep the profile it already has. If this vault has none, run `privacy-agent onboard` first.');
  }

  const skipped = [];
  const exposures = [];

  for (const raw of data.exposures || []) {
    const check = admissible(raw);
    if (!check.ok) {
      skipped.push({ url: raw?.url || '(no URL)', why: check.why });
      continue;
    }
    exposures.push(normalizeExposure(raw));
  }

  // Anything the user rejected in the browser stays rejected. Re-importing a
  // known false match would send the agent to file a removal against a stranger
  // — the single worst thing this software could do.
  const rejected = (data.exposures || []).filter((e) => e?.status === STATE.FALSE_MATCH).length;
  if (rejected) {
    warnings.push(`${rejected} record${rejected === 1 ? '' : 's'} you marked as somebody else ${rejected === 1 ? 'was' : 'were'} left out, and will not be filed against.`);
  }

  const actionable = exposures.filter((e) => e.status === STATE.CONFIRMED_EXPOSURE).length;

  return {
    ok: true,
    answers,
    exposures,
    skipped,
    warnings,
    summary: exposures.length
      ? `${exposures.length} exposure${exposures.length === 1 ? '' : 's'} imported, ${actionable} ready for the agent to act on.`
      : 'No exposures in the export — the agent will start from discovery.',
  };
}

/**
 * Should this record cross the bridge?
 *
 * Conservative on purpose. The agent submits real forms to real companies
 * naming a real person, so a malformed or unverified record is not worth the
 * convenience of importing it.
 */
function admissible(e) {
  if (!e || typeof e !== 'object') return { ok: false, why: 'not a record' };
  if (typeof e.url !== 'string' || !/^https?:\/\//i.test(e.url)) {
    return { ok: false, why: 'no usable URL' };
  }
  if (e.status === STATE.FALSE_MATCH) {
    return { ok: false, why: 'you marked this as somebody else' };
  }
  if (typeof e.matchScore !== 'number' || Number.isNaN(e.matchScore)) {
    return { ok: false, why: 'no match score — the agent will not act on an unscored record' };
  }
  return { ok: true };
}

/**
 * Bring one exposure into the agent's shape.
 *
 * Status is deliberately clamped. The console can mark something as submitted
 * or removed on the user's word; the agent's own state machine must not inherit
 * a claim it did not witness, because "submitted" and "removed" are exactly the
 * two states this project refuses to take on trust. Anything past confirmation
 * comes in as a confirmed exposure with its history intact, and the agent
 * re-establishes the rest by looking.
 */
function normalizeExposure(e) {
  const witnessed = e.status === STATE.NOT_REMOVABLE ? STATE.NOT_REMOVABLE : STATE.CONFIRMED_EXPOSURE;

  return {
    ...e,
    // The agent orders its work by risk, so a record arriving without one would
    // sink to the bottom of the queue on a technicality rather than on merit.
    risk: e.risk?.score != null ? e.risk : riskOf({
      fields: e.fields || [],
      siteKind: siteKindFor(e.removability?.category),
      matchScore: e.matchScore,
    }),
    status: witnessed,
    importedFrom: 'web-console',
    importedAt: new Date().toISOString(),
    // The browser could only ever read a search snippet or a pasted page, so
    // the agent should treat this as a lead to verify rather than a page it
    // has seen for itself.
    fromSnippet: e.fromSnippet !== false,
    history: Array.isArray(e.history) ? e.history : [],
  };
}

/**
 * Merge imported exposures into whatever the vault already holds.
 *
 * The vault wins on any record it has genuinely worked: if the agent has
 * already filed here and is waiting, an import must not reset that to
 * "confirmed" and file a second time.
 */
export function mergeExposures(existing = [], incoming = []) {
  const byUrl = new Map();
  for (const e of existing) byUrl.set(String(e.url).toLowerCase(), e);

  let added = 0;
  let kept = 0;

  for (const e of incoming) {
    const key = String(e.url).toLowerCase();
    const have = byUrl.get(key);
    if (!have) {
      byUrl.set(key, e);
      added += 1;
      continue;
    }
    // Already known. Keep the agent's own record — it has been further through
    // the process than anything the browser could have observed.
    kept += 1;
  }

  return { exposures: [...byUrl.values()], added, kept };
}
