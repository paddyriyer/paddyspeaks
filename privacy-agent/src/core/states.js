/**
 * Execution state per exposure (spec item 25).
 *
 * The state machine exists to stop two specific failure modes:
 *
 *   - Reporting "submitted" as if it meant "removed". These are different
 *     states with a verification step between them, and the whole product is
 *     dishonest if they get collapsed. `REQUEST_SUBMITTED` can only become
 *     `SUCCESSFULLY_REMOVED` by way of an actual recheck.
 *
 *   - Duplicate submissions. Once a request is in flight, the only way back to
 *     the form is through an explicit failure or expiry transition, so a retry
 *     loop cannot quietly file the same request five times (spec item 36).
 *
 * Pure module — no I/O. Unit-tested in tests/run.mjs.
 */

export const STATE = {
  DISCOVERED: 'discovered',
  MATCH_PENDING: 'match_pending',
  CONFIRMED_EXPOSURE: 'confirmed_exposure',
  REMOVAL_METHOD_FOUND: 'removal_method_found',
  FORM_IN_PROGRESS: 'form_in_progress',
  VERIFICATION_REQUIRED: 'verification_required',
  REQUEST_SUBMITTED: 'request_submitted',
  PENDING_REMOVAL: 'pending_removal',
  SUCCESSFULLY_REMOVED: 'successfully_removed',
  FAILED: 'failed',
  MANUAL_ACTION_REQUIRED: 'manual_action_required',
  NOT_REMOVABLE: 'not_removable',
  // Terminal bucket for records the matcher rejected. Kept rather than deleted
  // so the same page is not rediscovered and re-scored on every run.
  FALSE_MATCH: 'false_match',
  // Spec item 22: a site that demands money is tracked separately and never paid.
  PAYMENT_DEMANDED: 'payment_demanded',
};

export const TERMINAL = new Set([
  STATE.SUCCESSFULLY_REMOVED,
  STATE.NOT_REMOVABLE,
  STATE.FALSE_MATCH,
]);

/** States where the agent is blocked and the user has to do something. */
export const NEEDS_HUMAN = new Set([
  STATE.MANUAL_ACTION_REQUIRED,
  STATE.PAYMENT_DEMANDED,
]);

/** States that are still work-in-flight, for the dashboard's "in progress". */
export const IN_FLIGHT = new Set([
  STATE.MATCH_PENDING,
  STATE.CONFIRMED_EXPOSURE,
  STATE.REMOVAL_METHOD_FOUND,
  STATE.FORM_IN_PROGRESS,
  STATE.VERIFICATION_REQUIRED,
  STATE.REQUEST_SUBMITTED,
  STATE.PENDING_REMOVAL,
]);

const TRANSITIONS = {
  [STATE.DISCOVERED]: [STATE.MATCH_PENDING, STATE.CONFIRMED_EXPOSURE, STATE.FALSE_MATCH],
  [STATE.MATCH_PENDING]: [STATE.CONFIRMED_EXPOSURE, STATE.FALSE_MATCH, STATE.MANUAL_ACTION_REQUIRED],
  [STATE.CONFIRMED_EXPOSURE]: [
    STATE.REMOVAL_METHOD_FOUND, STATE.NOT_REMOVABLE, STATE.MANUAL_ACTION_REQUIRED,
    STATE.PAYMENT_DEMANDED, STATE.FAILED,
  ],
  [STATE.REMOVAL_METHOD_FOUND]: [
    STATE.FORM_IN_PROGRESS, STATE.MANUAL_ACTION_REQUIRED, STATE.PAYMENT_DEMANDED,
    STATE.NOT_REMOVABLE, STATE.FAILED,
  ],
  [STATE.FORM_IN_PROGRESS]: [
    STATE.VERIFICATION_REQUIRED, STATE.REQUEST_SUBMITTED, STATE.MANUAL_ACTION_REQUIRED,
    STATE.PAYMENT_DEMANDED, STATE.FAILED,
  ],
  [STATE.VERIFICATION_REQUIRED]: [
    STATE.REQUEST_SUBMITTED, STATE.MANUAL_ACTION_REQUIRED, STATE.FAILED,
    // An expired verification link drops back to the form for one clean retry.
    STATE.FORM_IN_PROGRESS,
  ],
  [STATE.REQUEST_SUBMITTED]: [STATE.PENDING_REMOVAL, STATE.SUCCESSFULLY_REMOVED, STATE.FAILED],
  [STATE.PENDING_REMOVAL]: [
    STATE.SUCCESSFULLY_REMOVED, STATE.FAILED, STATE.MANUAL_ACTION_REQUIRED,
    // Still listed after the stated window — refile from the top.
    STATE.REMOVAL_METHOD_FOUND,
  ],
  [STATE.FAILED]: [
    STATE.REMOVAL_METHOD_FOUND, STATE.FORM_IN_PROGRESS, STATE.MANUAL_ACTION_REQUIRED,
    STATE.NOT_REMOVABLE,
  ],
  [STATE.MANUAL_ACTION_REQUIRED]: [
    STATE.FORM_IN_PROGRESS, STATE.VERIFICATION_REQUIRED, STATE.REQUEST_SUBMITTED,
    STATE.NOT_REMOVABLE, STATE.FAILED,
  ],
  [STATE.PAYMENT_DEMANDED]: [
    // Never by paying — only by finding a free path, or accepting there isn't one.
    STATE.REMOVAL_METHOD_FOUND, STATE.NOT_REMOVABLE, STATE.MANUAL_ACTION_REQUIRED,
  ],
  // A removed record that reappears is not reopened here: it becomes a *new*
  // exposure with a link back to this one (see dedupe.detectReappearance), so
  // the history of the original removal stays intact.
  [STATE.SUCCESSFULLY_REMOVED]: [],
  [STATE.NOT_REMOVABLE]: [],
  [STATE.FALSE_MATCH]: [],
};

export function canTransition(from, to) {
  if (from === to) return true;
  return (TRANSITIONS[from] || []).includes(to);
}

export function nextStates(from) {
  return [...(TRANSITIONS[from] || [])];
}

/**
 * Apply a transition, appending to the exposure's history.
 *
 * Throws on an illegal move rather than silently coercing — an unexpected
 * transition is a bug in the orchestrator, and hiding it would let a record
 * jump from "discovered" straight to "removed" without anything happening.
 */
export function transition(exposure, to, note = '', meta = {}) {
  const from = exposure.status || STATE.DISCOVERED;
  if (!Object.values(STATE).includes(to)) {
    throw new Error(`unknown state: ${to}`);
  }
  if (!canTransition(from, to)) {
    throw new Error(`illegal transition: ${from} -> ${to}`);
  }
  const entry = {
    from,
    to,
    note,
    at: new Date().toISOString(),
    ...meta,
  };
  exposure.status = to;
  exposure.history = [...(exposure.history || []), entry];
  exposure.updatedAt = entry.at;
  return exposure;
}

/** Human-readable label + a one-line explanation for the dashboard. */
export const STATE_LABELS = {
  [STATE.DISCOVERED]: ['Discovered', 'Found in search, not yet checked against your identity.'],
  [STATE.MATCH_PENDING]: ['Checking', 'Working out whether this record is actually you.'],
  [STATE.CONFIRMED_EXPOSURE]: ['Confirmed exposure', 'This is you, and the information is public.'],
  [STATE.REMOVAL_METHOD_FOUND]: ['Removal path found', 'We located the opt-out process for this site.'],
  [STATE.FORM_IN_PROGRESS]: ['Submitting', 'Filling in the removal request now.'],
  [STATE.VERIFICATION_REQUIRED]: ['Verifying', 'The site needs a confirmation step before it accepts the request.'],
  [STATE.REQUEST_SUBMITTED]: ['Request submitted', 'Sent, and acknowledged by the site. Not removed yet.'],
  [STATE.PENDING_REMOVAL]: ['Awaiting removal', 'Accepted; waiting out the site’s stated processing time.'],
  [STATE.SUCCESSFULLY_REMOVED]: ['Removed', 'We re-checked the page and your information is gone.'],
  [STATE.FAILED]: ['Failed', 'The request did not go through. It will be retried.'],
  [STATE.MANUAL_ACTION_REQUIRED]: ['Needs you', 'Blocked on something only you can do.'],
  [STATE.NOT_REMOVABLE]: ['Not removable', 'No deletion route exists for this record.'],
  [STATE.FALSE_MATCH]: ['Not you', 'Checked and rejected — a different person.'],
  [STATE.PAYMENT_DEMANDED]: ['Wants payment', 'This site charges for removal. We never pay; looking for a free route.'],
};

/** Roll the whole set up into the dashboard counters (spec item 28). */
export function summarize(exposures = []) {
  const counts = Object.fromEntries(Object.values(STATE).map((s) => [s, 0]));
  for (const e of exposures) {
    const s = e?.status || STATE.DISCOVERED;
    if (counts[s] === undefined) counts[s] = 0;
    counts[s] += 1;
  }

  const confirmedStates = [
    STATE.CONFIRMED_EXPOSURE, STATE.REMOVAL_METHOD_FOUND, STATE.FORM_IN_PROGRESS,
    STATE.VERIFICATION_REQUIRED, STATE.REQUEST_SUBMITTED, STATE.PENDING_REMOVAL,
    STATE.SUCCESSFULLY_REMOVED, STATE.FAILED, STATE.MANUAL_ACTION_REQUIRED,
    STATE.NOT_REMOVABLE, STATE.PAYMENT_DEMANDED,
  ];

  return {
    discovered: exposures.length,
    confirmed: confirmedStates.reduce((n, s) => n + counts[s], 0),
    investigating: counts[STATE.DISCOVERED] + counts[STATE.MATCH_PENDING],
    submitted: counts[STATE.REQUEST_SUBMITTED] + counts[STATE.PENDING_REMOVAL]
      + counts[STATE.SUCCESSFULLY_REMOVED],
    completed: counts[STATE.SUCCESSFULLY_REMOVED],
    verificationPending: counts[STATE.VERIFICATION_REQUIRED],
    manualRequired: counts[STATE.MANUAL_ACTION_REQUIRED] + counts[STATE.PAYMENT_DEMANDED],
    notRemovable: counts[STATE.NOT_REMOVABLE],
    failed: counts[STATE.FAILED],
    falseMatches: counts[STATE.FALSE_MATCH],
    byState: counts,
  };
}
