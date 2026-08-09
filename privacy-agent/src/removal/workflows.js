/**
 * Learned site workflows (spec items 34, 35).
 *
 * When a removal succeeds, remember *how* — so the next run (and, if the user
 * chooses to share the file, the next person) skips rediscovery.
 *
 * The whole design turns on one constraint from spec item 34: "the next user
 * should benefit from this knowledge, but never share one user's personal data
 * with another." So a template records the **shape** of a workflow and never a
 * value:
 *
 *      stored:      { kind: 'email', selector: '#contact_email', required: true }
 *      never:       { value: 'someone@example.com' }
 *
 * `sanitizeTemplate` enforces that by construction — it builds the template
 * from an allowlist of structural keys rather than deleting known-bad ones,
 * because a denylist silently leaks whatever field someone adds next year.
 * `Vault.saveWorkflows` then re-checks the serialised file for PII patterns
 * before it hits disk. Two independent guards, because this is the one file
 * intended to leave the machine.
 */

import { registrableDomain } from '../core/text.js';
import { assertNoPii } from '../store/vault.js';

const TEMPLATE_VERSION = 2;

/** The only keys that may be persisted for a field. Structure, never content. */
const FIELD_KEYS = ['kind', 'selector', 'tag', 'type', 'required', 'labelHash'];

/**
 * Build a shareable template from a completed run.
 *
 * `outcome` is the executor's result; `method` is what discovery found.
 */
export function buildTemplate(method, executionResult, fieldPlan = []) {
  const domain = registrableDomain(method?.domain || method?.entryUrl || '');
  if (!domain) return null;

  return sanitizeTemplate({
    version: TEMPLATE_VERSION,
    domain,
    entryUrl: stripQuery(method.entryUrl),
    kind: method.kind || null,
    workflowType: method.workflowType || null,
    navigationPath: (method.trail || [])
      .filter((t) => t.url)
      .map((t) => ({ step: t.step, url: stripQuery(t.url) }))
      .slice(0, 8),
    fields: fieldPlan.map((f) => ({
      kind: f.classification?.kind || 'unknown',
      selector: f.field?.selector || null,
      tag: f.field?.tag || null,
      type: f.field?.type || null,
      required: Boolean(f.field?.required),
      // A hash of the label, not the label: lets us notice the form changed
      // without storing text that could conceivably echo a value.
      labelHash: hashLabel(f.field?.label),
    })),
    confirmation: {
      pattern: executionResult?.confirmation?.confirmed ? 'explicit' : 'implicit',
      providesCaseNumber: Boolean(executionResult?.confirmation?.caseNumber),
      expectedTimeframe: executionResult?.confirmation?.expectedTimeframe || null,
    },
    verification: {
      channel: executionResult?.channel || null,
      required: executionResult?.outcome === 'verification_required',
    },
    failureModes: [],
    stats: { successes: 0, failures: 0 },
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Rebuild an object containing only allowlisted structural keys.
 * Anything not explicitly named here cannot reach the file.
 */
export function sanitizeTemplate(t) {
  if (!t) return null;
  const clean = {
    version: TEMPLATE_VERSION,
    domain: String(t.domain || ''),
    entryUrl: stripQuery(t.entryUrl),
    kind: t.kind ? String(t.kind) : null,
    workflowType: t.workflowType ? String(t.workflowType) : null,
    navigationPath: (t.navigationPath || []).slice(0, 8).map((s) => ({
      step: String(s.step || ''),
      url: stripQuery(s.url),
    })),
    fields: (t.fields || []).slice(0, 40).map((f) => {
      const out = {};
      for (const k of FIELD_KEYS) if (f[k] !== undefined) out[k] = f[k];
      return out;
    }),
    confirmation: {
      pattern: t.confirmation?.pattern || null,
      providesCaseNumber: Boolean(t.confirmation?.providesCaseNumber),
      expectedTimeframe: t.confirmation?.expectedTimeframe || null,
    },
    verification: {
      channel: t.verification?.channel || null,
      required: Boolean(t.verification?.required),
    },
    failureModes: (t.failureModes || []).slice(0, 10).map(String),
    stats: {
      successes: Number(t.stats?.successes || 0),
      failures: Number(t.stats?.failures || 0),
    },
    updatedAt: t.updatedAt || new Date().toISOString(),
  };
  assertNoPii(clean);
  return clean;
}

export function getTemplate(workflows, domain) {
  const d = registrableDomain(domain);
  return workflows?.sites?.[d] || null;
}

/**
 * Record an outcome against a domain's template.
 *
 * A template that keeps failing is *demoted*, not kept forever: once failures
 * outnumber successes and there have been at least three attempts, the stored
 * entry URL is dropped so the next run rediscovers from scratch (spec item 35).
 */
export function recordOutcome(workflows, method, executionResult, fieldPlan = []) {
  const wf = workflows || { version: 1, sites: {} };
  wf.sites = wf.sites || {};
  const domain = registrableDomain(method?.domain || method?.entryUrl || '');
  if (!domain) return wf;

  const succeeded = executionResult?.outcome === 'submitted'
    || executionResult?.outcome === 'verification_required';

  const existing = wf.sites[domain];
  const fresh = buildTemplate(method, executionResult, fieldPlan);
  if (!fresh) return wf;

  if (existing) {
    fresh.stats = {
      successes: (existing.stats?.successes || 0) + (succeeded ? 1 : 0),
      failures: (existing.stats?.failures || 0) + (succeeded ? 0 : 1),
    };
    fresh.failureModes = [...new Set([
      ...(existing.failureModes || []),
      ...(succeeded ? [] : [failureModeOf(executionResult)]),
    ].filter(Boolean))].slice(0, 10);
  } else {
    fresh.stats = { successes: succeeded ? 1 : 0, failures: succeeded ? 0 : 1 };
    if (!succeeded) fresh.failureModes = [failureModeOf(executionResult)].filter(Boolean);
  }

  const attempts = fresh.stats.successes + fresh.stats.failures;
  if (attempts >= 3 && fresh.stats.failures > fresh.stats.successes) {
    // Stop trusting the stored path — force rediscovery next time.
    fresh.entryUrl = null;
    fresh.fields = [];
    fresh.failureModes = [...new Set([...fresh.failureModes, 'template_demoted_after_repeated_failures'])];
  }

  wf.sites[domain] = sanitizeTemplate(fresh);
  return wf;
}

function failureModeOf(result) {
  if (!result) return 'unknown';
  return {
    no_form: 'entry_url_had_no_form',
    payment_demanded: 'site_charges_for_removal',
    needs_human: `blocked_on_${result.needs || 'human_step'}`,
    failed: result.errors?.length ? 'form_validation_rejected' : 'execution_error',
  }[result.outcome] || result.outcome;
}

/**
 * Has the form changed since we learned it? (spec item 35)
 *
 * Compares the live field set against the template. A missing *required* field
 * means the form moved on and the template should not be trusted.
 */
export function templateStillFits(template, liveFields) {
  if (!template?.fields?.length) return { fits: false, reason: 'no stored field layout' };

  const liveSelectors = new Set(liveFields.map((f) => f.selector));
  const missing = template.fields.filter((f) => f.selector && !liveSelectors.has(f.selector));
  const missingRequired = missing.filter((f) => f.required);

  if (missingRequired.length) {
    return {
      fits: false,
      reason: `${missingRequired.length} required field(s) from the stored layout are gone — the form has changed`,
      missing: missingRequired.map((f) => f.kind),
    };
  }
  if (missing.length > template.fields.length / 2) {
    return { fits: false, reason: 'most of the stored layout no longer matches the page' };
  }
  return { fits: true, missing: missing.map((f) => f.kind) };
}

/** Stable, non-reversible label marker. Not a security hash — a change detector. */
function hashLabel(label) {
  const s = String(label || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!s) return null;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Query strings routinely carry session ids, search terms and occasionally the
 * subject's own name. Templates keep the path only.
 */
function stripQuery(url) {
  if (!url) return null;
  try {
    const u = new URL(String(url));
    return `${u.origin}${u.pathname}`;
  } catch {
    return null;
  }
}

export { TEMPLATE_VERSION };
