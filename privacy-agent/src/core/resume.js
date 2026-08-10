/**
 * "The site stopped and wants you. Here is exactly what to do."
 *
 * Every removal path eventually hands back to the user. That is not a defect in
 * the automation, it is how the law works: a broker is entitled to satisfy
 * itself that the person asking is the person in the record, and the strongest
 * verification sits on exactly the sites worth removing from. Any design that
 * promises press-go-and-forget is promising something the high-value half of
 * the web will not honour.
 *
 * So the handback is the main path, not the failure path, and it has to survive
 * time. That is the specific problem this module fixes. The agent's blocked
 * notes were written at the moment of blocking, by whichever call site hit the
 * wall, and several of them describe a live browser: "the form is open, we will
 * enter the code if the page is still live". True for about ninety seconds.
 * A user who closes the laptop and comes back on Sunday is then reading an
 * instruction that cannot be followed — the window is gone, the session cookie
 * is gone, and often the code has expired too. Being told to do an impossible
 * thing is worse than being told nothing, because it reads as the tool's
 * failure rather than as a step the user still owns.
 *
 * `resumeFor` therefore takes the blocked exposure and the time you are asking,
 * and produces an instruction that is correct *at the time of asking*: the same
 * exposure yields "enter the code in the open window" now, and "request a fresh
 * code, the one you were sent has expired" tomorrow. Nothing here invents a
 * step. Where the route genuinely is not known, it says so, in keeping with the
 * rule that a guessed opt-out URL is a confident 404.
 *
 * Pure module — no I/O, no clock of its own (the caller passes `now`, which is
 * what makes staleness testable). Unit-tested in tests/run.mjs.
 */

import { STATE, NEEDS_HUMAN } from './states.js';

/**
 * How long a blocked step stays actionable as-written.
 *
 * These are deliberately conservative. Claiming a code is still good when it is
 * not sends the user to a dead end and costs them the trip; claiming it is
 * stale when it might still work costs them one extra click on "resend". The
 * asymmetry is the whole reason for the table.
 */
export const FRESHNESS_MS = {
  // Anything that depends on a browser window we opened.
  live_session: 15 * 60 * 1000,
  // One-time codes. Most issuers expire these between 5 and 15 minutes.
  code: 10 * 60 * 1000,
  // Emailed confirmation links usually last hours to days; 48h is the safe floor.
  link: 48 * 60 * 60 * 1000,
  // Steps that are just "go to this page and do a thing" never go stale.
  durable: Infinity,
};

/**
 * What each block actually needs, in the user's terms.
 *
 * `kind` drives staleness. `steps` are written to be followed without the
 * console open, because someone reading this on a phone, three days later, is
 * the normal case rather than the edge one.
 */
const NEEDS = {
  captcha: {
    kind: 'live_session',
    title: 'The site asked for a CAPTCHA',
    why: 'A CAPTCHA is there to prove a person is filling the form in. The agent will not defeat one — that would be both an arms race and a lie about who is asking.',
    haveReady: [],
    fresh: [
      'Switch to the browser window the agent opened — the form is filled in and waiting.',
      'Solve the CAPTCHA and submit.',
    ],
    stale: [
      'The window the agent opened has closed, so the filled-in form is gone.',
      'Open the opt-out page again and re-enter the request; the agent can refill it if you re-run this exposure.',
    ],
    thenWhat: 'Once submitted, mark this exposure as submitted and the agent will take over the re-check.',
  },

  verification_code: {
    kind: 'code',
    title: 'The site sent you a one-time code',
    why: 'The site will not accept the request until the code comes back. The agent found the code but cannot always type it in for you.',
    haveReady: ['The code from the email or message'],
    fresh: [
      'Switch to the open browser window, enter the code, and submit.',
    ],
    stale: [
      'That code has almost certainly expired — one-time codes are usually good for about ten minutes.',
      'Start the opt-out again and ask for a fresh code, then enter it straight away.',
    ],
    thenWhat: 'The site should show a confirmation or case number — save it, it is your proof of filing.',
  },

  sms: {
    kind: 'code',
    title: 'The site wants a code sent to your phone',
    why: 'It is verifying the phone number in the record. The agent has no access to your messages, by design.',
    haveReady: ['Your phone'],
    fresh: ['Switch to the open browser window, enter the code from the text, and submit.'],
    stale: [
      'The code you were sent will have expired.',
      'Re-open the opt-out page, request a new code, and enter it while it is fresh.',
    ],
    thenWhat: 'Save any confirmation or case number the site shows.',
  },

  mfa: {
    kind: 'live_session',
    title: 'The site wants a multi-factor confirmation',
    why: 'This is an account you hold, and the site is checking it is really you signing in. The agent never handles your second factor.',
    haveReady: ['Your authenticator app or security key'],
    fresh: ['Approve the prompt, then return to the open browser window — the form is waiting.'],
    stale: [
      'The sign-in attempt has timed out.',
      'Sign in yourself, then go to the opt-out page; the agent can refill the form on the next run.',
    ],
    thenWhat: 'Once the request is in, mark this exposure as submitted.',
  },

  email_confirmation: {
    kind: 'link',
    title: 'The site emailed you a confirmation link',
    why: 'Most brokers only start processing once the link is clicked. Until then the request exists but is doing nothing.',
    haveReady: ['Access to the inbox you used'],
    fresh: [
      'Find the email from this site and click the confirmation link.',
      'If it is not in your inbox, check spam — these are filtered often.',
    ],
    stale: [
      'The link may have expired, and the email is old enough to be buried.',
      'Search your inbox and spam for the site name; if the link is dead or missing, submit the opt-out again to trigger a new one.',
    ],
    thenWhat: 'After clicking, the site usually shows a case number. Save it — it is what you quote if the record is still there in a month.',
  },

  email_request: {
    kind: 'durable',
    title: 'This one goes by email',
    why: 'There is no removal form — the route is a written request, which is legally valid and leaves you a paper trail the site cannot quietly discard.',
    haveReady: ['The draft the agent prepared'],
    fresh: [
      'Send the drafted request from the address you want them to reply to.',
      'Keep the sent copy — the timestamp is what starts the statutory clock.',
    ],
    thenWhat: 'Most jurisdictions give the company a fixed window to respond. The agent will re-check once it is up.',
  },

  postal_request: {
    kind: 'durable',
    title: 'This one has to go by post',
    why: 'Some record-holders — courts and certain government registries especially — accept nothing else. A web form does not exist to be automated.',
    haveReady: ['A printer', 'A stamp', 'Any ID the notice asks for'],
    fresh: [
      'Print the drafted letter and send it to the address shown.',
      'Send it tracked if the value is high — proof of delivery matters if you have to escalate.',
    ],
    thenWhat: 'Note the date you posted it; that is the date the response window runs from.',
  },

  record_selection: {
    kind: 'live_session',
    title: 'The site is showing several records and wants you to pick',
    why: 'More than one record matched, and the agent will not choose on your behalf. Picking wrong files a removal against a stranger — the single worst thing this tool could do.',
    haveReady: [],
    fresh: [
      'Look at the listed records in the open window and select the one that is you.',
      'If none of them is you, close it and mark this exposure as "not me".',
    ],
    stale: [
      'The results page has expired.',
      'Search the site again from the opt-out page and pick your record there.',
    ],
    thenWhat: 'If two of them are you, remove them one at a time — brokers commonly hold duplicates under name variants.',
  },

  sensitive_data: {
    kind: 'durable',
    title: 'The site is asking for sensitive identification',
    why: 'It wants something like an ID number or a document scan. The agent never fills these in and never stores them, so the decision is yours alone.',
    haveReady: ['Whatever the site is asking for, if you choose to provide it'],
    fresh: [
      'Read what is being demanded before you decide — some sites ask for far more than they need.',
      'If you do proceed, redact everything on a document scan except the fields the notice actually requires.',
    ],
    thenWhat: 'It is entirely reasonable to stop here. Handing a broker your passport to make it forget you is a trade worth refusing.',
  },

  payment: {
    kind: 'durable',
    title: 'This site wants money to remove you',
    why: 'The agent never pays. Paying a broker rewards the business model and does nothing about the upstream feed that will restock the record.',
    haveReady: [],
    fresh: [
      'Check whether a free statutory route exists — in many jurisdictions a paid "removal" sits alongside a legal right to deletion that costs nothing.',
      'The agent looks for that route automatically; if it found one it will be listed under this exposure.',
    ],
    thenWhat: 'If there is genuinely no free path, leaving this one in place is a legitimate choice.',
  },
};

/** Blocks the agent can hit that have no specific playbook. */
const GENERIC = {
  kind: 'durable',
  title: 'This one needs you',
  why: 'The agent stopped rather than guess at a step it could not complete.',
  haveReady: [],
  fresh: ['Open the opt-out page for this site and complete the request by hand.'],
  thenWhat: 'Mark the exposure as submitted once it is in, and the agent will handle the re-check.',
};

/** Which exposures are waiting on the user at all. */
export function isBlocked(exposure) {
  const status = exposure?.status;
  return NEEDS_HUMAN.has(status) || status === STATE.VERIFICATION_REQUIRED;
}

/**
 * When did this exposure become blocked?
 *
 * Read from history rather than `updatedAt`, because an unrelated later edit
 * (a note, a re-score) would otherwise make a three-day-old block look fresh
 * and send the user to a window that closed on Thursday.
 */
export function blockedAt(exposure) {
  const history = Array.isArray(exposure?.history) ? exposure.history : [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    if (NEEDS_HUMAN.has(entry?.to) || entry?.to === STATE.VERIFICATION_REQUIRED) {
      const t = Date.parse(entry.at);
      if (!Number.isNaN(t)) return t;
    }
  }
  const fallback = Date.parse(exposure?.updatedAt);
  return Number.isNaN(fallback) ? null : fallback;
}

/**
 * Build the instruction for one blocked exposure.
 *
 * @param exposure the blocked record
 * @param now      milliseconds; injected so staleness is testable
 * @returns null when nothing is being asked of the user
 */
export function resumeFor(exposure, now = Date.now()) {
  if (!isBlocked(exposure)) return null;

  const needs = exposure.status === STATE.PAYMENT_DEMANDED
    ? 'payment'
    : exposure?.manualAction?.needs || null;

  const play = NEEDS[needs] || GENERIC;
  const since = blockedAt(exposure);
  const age = since == null ? null : Math.max(0, now - since);
  const limit = FRESHNESS_MS[play.kind];

  // Unknown age is treated as stale. If we cannot tell how long someone has
  // been away, sending them to a browser window we cannot see is a worse bet
  // than asking them to start cleanly.
  const stale = play.stale ? (age == null || age > limit) : false;

  const steps = stale ? play.stale : play.fresh;

  return {
    exposureId: exposure.id ?? null,
    domain: exposure.domain || null,
    needs: needs || 'unknown',
    title: play.title,
    why: play.why,
    haveReady: [...play.haveReady],
    steps: [...steps],
    thenWhat: play.thenWhat,
    stale,
    blockedAt: since == null ? null : new Date(since).toISOString(),
    ageMs: age,
    // The route back. The agent's own note is kept as context but never as the
    // instruction, because it was written for the moment it happened.
    url: exposure?.manualAction?.url || exposure?.removalMethod?.entryUrl || exposure?.url || null,
    contact: exposure?.manualAction?.contact || null,
    reference: referenceFor(exposure),
    agentNote: exposure?.manualAction?.note || null,
  };
}

/**
 * What the user should quote when they get there.
 *
 * A case number is the difference between "I asked you to delete this" and a
 * conversation the company has to honour, so it is surfaced separately rather
 * than buried in prose.
 */
function referenceFor(exposure) {
  const submission = exposure?.submission || {};
  const ref = {
    caseNumber: submission.caseNumber || null,
    submittedAt: submission.submittedAt || null,
    expectedTimeframe: submission.expectedTimeframe || null,
  };
  return Object.values(ref).some(Boolean) ? ref : null;
}

/**
 * Everything waiting on the user, worst first.
 *
 * Ordered by risk rather than by age: if someone only has the patience for one
 * of these today, it should be the exposure that actually matters, not the one
 * that happened to block first.
 */
export function resumeQueue(exposures = [], now = Date.now()) {
  return exposures
    .filter(isBlocked)
    .map((e) => ({ exposure: e, resume: resumeFor(e, now) }))
    .sort((a, b) => (b.exposure?.risk?.score || 0) - (a.exposure?.risk?.score || 0))
    .map(({ resume }) => resume);
}

/** One honest line for the dashboard. Never cheerful about a backlog. */
export function resumeSummary(exposures = [], now = Date.now()) {
  const queue = resumeQueue(exposures, now);
  if (!queue.length) return 'Nothing is waiting on you.';

  const staleCount = queue.filter((r) => r.stale).length;
  const n = queue.length;
  const head = `${n} exposure${n === 1 ? '' : 's'} need${n === 1 ? 's' : ''} something from you.`;
  if (!staleCount) return head;
  return `${head} ${staleCount} of them ${staleCount === 1 ? 'has' : 'have'} been waiting long enough that you will need to start that step again.`;
}
