/**
 * The agent loop.
 *
 * This is the "privacy operations centre" the brief asks for: discover the
 * footprint, verify it, remove what can be removed, track what cannot, and keep
 * checking that removed things stay removed.
 *
 * Two modes (spec items 40, 41):
 *
 *   MISSION  — the user approves the mission once. Routine confirmed removals
 *              proceed without further prompting. The agent interrupts only for
 *              the things that genuinely need a person: identity ambiguity,
 *              sensitive-document requests, payment, CAPTCHA, MFA, irreversible
 *              account deletion.
 *   REVIEW   — discover everything first, then let the user approve each
 *              removal before anything is submitted.
 *
 * Discovery is recursive and terminates on convergence, not on a page count
 * (spec item 43): it keeps going while new identifiers or new exposures are
 * still appearing, and stops when several rounds in a row produce neither.
 *
 * Interruption discipline (spec item 30) is the thing most likely to be eroded
 * by a later change: every `ask*` hook call in here is at a decision that
 * carries real consequence. Adding a prompt for a routine click would break the
 * product's core promise, which is that the user answers questions about their
 * *identity*, not about their *browser*.
 */

import { buildProfile, parseAddress } from './core/identity.js';
import { IdentityGraph } from './core/graph.js';
import { scoreMatch, CLASSIFICATION } from './core/match.js';
import { buildQueries, queriesForNode, recheckQueries, hasConverged } from './core/queries.js';
import { riskOf, exposureScore, prioritize } from './core/risk.js';
import { groupDuplicates, detectReappearance } from './core/dedupe.js';
import { classifyRemovability, siteKindFor, CATEGORY } from './core/removability.js';
import { detectJurisdiction, preferredChoices } from './core/jurisdiction.js';
import { STATE, transition, summarize, TERMINAL } from './core/states.js';
import { createRedactor } from './core/redact.js';
import { fnv1a, registrableDomain, uniq } from './core/text.js';

import { search, RateLimiter, detectProvider, sleep } from './discover/providers.js';
import { extractFromPage } from './discover/extract.js';
import { BrowserSession } from './browser/session.js';
import { discoverRemovalMethod, WORKFLOW_TYPE } from './removal/discover-method.js';
import { executeRemoval, OUTCOME } from './removal/execute.js';
import { getTemplate, recordOutcome } from './removal/workflows.js';
import { MailConnector, followVerificationLink } from './removal/email.js';

export const MODE = {
  MISSION: 'remove_everything_possible',
  REVIEW: 'review_before_removal',
  DISCOVER_ONLY: 'discover_only',
};

export class PrivacyAgent {
  constructor({ vault, hooks = {}, options = {} } = {}) {
    this.vault = vault;
    this.hooks = hooks;
    this.options = {
      mode: MODE.REVIEW,
      maxRounds: 8,
      queriesPerRound: 25,
      maxPageFetches: 400,
      searchProvider: detectProvider(),
      headless: false,
      ...options,
    };

    // The search backend is injected rather than imported directly, so a
    // custom provider (or a test harness) can supply its own without patching
    // the module. Defaults to the built-in provider dispatch.
    this.searchFn = options.searchFn
      || ((query, opts = {}) => search(query, { provider: this.options.searchProvider, ...opts }));

    this.profile = null;
    this.graph = null;
    this.run = null;
    this.session = null;
    this.mail = options.mailConnector || new MailConnector({});
    this.limiter = new RateLimiter({
      perMinute: options.searchesPerMinute ?? 20,
      minGapMs: options.minGapMs ?? 600,
    });
    this.redact = createRedactor(null);
    this.fetchCount = 0;
    this.cancelled = false;
  }

  log(message, data = {}) {
    const entry = { at: new Date().toISOString(), message, ...this.redact(data) };
    this.hooks.onLog?.(entry);
    return entry;
  }

  emit(event, payload = {}) {
    this.hooks.onEvent?.(event, this.redact(payload));
  }

  /* ------------------------------------------------------------ setup */

  /** Turn onboarding answers into a profile + seeded graph, and persist them. */
  async initIdentity(answers) {
    this.profile = buildProfile(answers);
    this.redact = createRedactor(this.profile);
    this.graph = new IdentityGraph({
      maxDepth: this.options.maxDepth ?? 3,
      minConfidence: this.options.minConfidence ?? 0.45,
    }).seed(this.profile);

    this.vault.save('vault', { profile: this.profile, graph: this.graph.toJSON() });
    this.log('identity profile built', {
      names: this.profile.names.length,
      identifiers: this.graph.size(),
    });
    return this.profile;
  }

  load() {
    const stored = this.vault.load('vault');
    if (stored?.profile) {
      this.profile = stored.profile;
      this.redact = createRedactor(this.profile);
      this.graph = stored.graph
        ? IdentityGraph.fromJSON(stored.graph)
        : new IdentityGraph().seed(this.profile);
    }
    this.run = this.vault.load('run');
    return this;
  }

  save() {
    this.vault.save('vault', { profile: this.profile, graph: this.graph.toJSON() });
    this.vault.save('run', this.run);
  }

  cancel() {
    this.cancelled = true;
  }

  /* -------------------------------------------------------------- run */

  async start(mode = this.options.mode) {
    if (!this.profile) throw new Error('no identity profile — run onboarding first');

    this.options.mode = mode;
    this.run = this.run || this.vault.load('run');
    this.run.startedAt = this.run.startedAt || new Date().toISOString();
    this.run.mode = mode;
    this.run.exposures = this.run.exposures || [];
    this.run.rounds = this.run.rounds || [];
    this.run.searchedQueries = this.run.searchedQueries || [];

    this.session = new BrowserSession({
      headless: this.options.headless,
      log: (m, d) => this.log(m, d),
    });

    try {
      await this.discoveryLoop();

      if (mode !== MODE.DISCOVER_ONLY) {
        await this.removalPhase();
      }

      const summary = this.buildSummary();
      this.run.stats = summary;
      this.save();
      this.emit('run:complete', summary);
      return summary;
    } finally {
      await this.session.close();
      this.vault.prune();
    }
  }

  /* -------------------------------------------------- discovery (4–9) */

  async discoveryLoop() {
    for (let round = 0; round < this.options.maxRounds; round++) {
      if (this.cancelled) break;

      const before = {
        exposures: this.run.exposures.length,
        identifiers: this.graph.size(),
      };

      const queries = round === 0
        ? buildQueries(this.graph, this.profile, { budget: this.options.queriesPerRound })
        : this.incrementalQueries();

      const fresh = queries.filter((q) => !this.run.searchedQueries.includes(q.id));
      if (!fresh.length) {
        this.log('no new queries to run', { round });
        break;
      }

      this.emit('round:start', { round, queries: fresh.length });
      this.log('discovery round', { round, queries: fresh.length });

      for (const query of fresh) {
        if (this.cancelled) break;
        await this.runQuery(query, round);
        this.run.searchedQueries.push(query.id);
      }

      // Mark the identifiers we searched this round so they don't recur.
      for (const node of this.graph.pendingSearchNodes()) {
        if (fresh.some((q) => q.sourceNodeKey === node.key)) {
          this.graph.markSearched(node.type, node.value);
        }
      }

      const roundResult = {
        round,
        queries: fresh.length,
        newExposures: this.run.exposures.length - before.exposures,
        newIdentifiers: this.graph.size() - before.identifiers,
        at: new Date().toISOString(),
      };
      this.run.rounds.push(roundResult);
      this.emit('round:end', roundResult);
      this.save();

      const convergence = hasConverged(this.run.rounds);
      if (convergence.converged) {
        this.log('discovery converged', { reason: convergence.reason });
        this.emit('discovery:converged', convergence);
        break;
      }
      if (this.fetchCount >= this.options.maxPageFetches) {
        this.log('page budget reached', { fetched: this.fetchCount });
        break;
      }
    }
  }

  /** Queries generated by identifiers discovered since the last round. */
  incrementalQueries() {
    const pending = this.graph.pendingSearchNodes().slice(0, 12);
    const out = [];
    for (const node of pending) {
      out.push(...queriesForNode(node, this.graph, this.profile, { budget: 4 }));
    }
    return out.slice(0, this.options.queriesPerRound);
  }

  async runQuery(query, round) {
    await this.limiter.take();
    const { results = [], error, manual } = await this.searchFn(query);

    if (manual) {
      const pasted = await this.hooks.askManualResults?.(query);
      if (Array.isArray(pasted)) {
        for (const url of pasted) await this.considerResult({ url, title: '', snippet: '' }, query, round);
      }
      return;
    }
    if (error) {
      this.log('search failed', { query: query.text, error });
      return;
    }

    this.emit('search:done', { query: query.text, kind: query.kind, hits: results.length });
    for (const result of results) {
      if (this.cancelled) break;
      await this.considerResult(result, query, round);
    }
  }

  /**
   * Decide whether a search hit is worth opening, then score it.
   *
   * The cheap snippet-level pre-filter matters: opening every result of every
   * query would blow the page budget on obvious noise long before the
   * interesting long-tail results get a look.
   */
  async considerResult(result, query, round) {
    const url = result.url;
    if (!url || !/^https?:/i.test(url)) return;
    if (this.run.exposures.some((e) => e.url === url)) return;
    if (this.fetchCount >= this.options.maxPageFetches) return;

    // Pre-filter on the snippet. A result whose snippet contains none of our
    // identifiers and no personal-data shape is very unlikely to repay a fetch.
    const snippetText = `${result.title} ${result.snippet}`;
    const snippetHit = this.snippetLooksRelevant(snippetText, query);
    if (!snippetHit) return;

    this.fetchCount += 1;
    const page = await this.session.readPage(url);
    if (!page.ok) {
      this.log('could not read page', { url, error: page.error });
      return;
    }

    const extracted = extractFromPage(page);
    const match = scoreMatch(extracted.record, this.profile);

    if (match.classification === CLASSIFICATION.FALSE) {
      this.run.exposures.push(this.makeExposure({
        url: page.url, page, extracted, match, query, round,
        status: STATE.FALSE_MATCH,
      }));
      return;
    }

    const removability = classifyRemovability(
      { url: page.url, title: page.title, text: page.text, fields: extracted.fields },
      this.profile,
    );

    const exposure = this.makeExposure({
      url: page.url, page, extracted, match, query, round, removability,
      status: STATE.DISCOVERED,
    });

    // Ambiguous results get a single, concise "is this you?" — the user should
    // never have to go and read the page themselves (spec item 7).
    if (match.classification === CLASSIFICATION.AMBIGUOUS) {
      transition(exposure, STATE.MATCH_PENDING, 'ambiguous match — asking the user');
      this.run.exposures.push(exposure);
      this.run.questions.push({
        exposureId: exposure.id,
        kind: 'is_this_you',
        askedAt: new Date().toISOString(),
      });
      this.emit('exposure:ambiguous', this.exposureSummary(exposure));

      const answer = await this.hooks.askIsThisYou?.({
        url: exposure.url,
        domain: exposure.domain,
        evidence: match.signals,
        conflicts: match.conflicts,
        explanation: match.explanation,
        whatIsExposed: extracted.fields,
        risk: exposure.risk,
      });

      if (answer === true || answer === 'yes') {
        transition(exposure, STATE.CONFIRMED_EXPOSURE, 'confirmed by the user');
        exposure.matchScore = Math.max(exposure.matchScore, 0.95);
        exposure.classification = CLASSIFICATION.CONFIRMED;
      } else if (answer === false || answer === 'no') {
        transition(exposure, STATE.FALSE_MATCH, 'rejected by the user');
        return;
      } else {
        // No answer yet — leave it pending; the dashboard will surface it.
        return;
      }
    } else {
      transition(exposure, STATE.CONFIRMED_EXPOSURE, `matched at ${Math.round(match.score * 100)}%`);
      this.run.exposures.push(exposure);
    }

    this.emit('exposure:found', this.exposureSummary(exposure));

    // Spec item 8: everything this page told us becomes a new search input.
    const discovered = this.graph.ingest(
      this.extractedToNodes(extracted),
      exposure.matchScore,
      page.url,
      query.sourceDepth ?? round,
    );
    if (discovered.length) {
      this.log('new identifiers discovered', {
        count: discovered.length,
        types: uniq(discovered.map((n) => n.type)),
      });
      this.emit('graph:grew', { added: discovered.length, total: this.graph.size() });
    }
  }

  snippetLooksRelevant(text, query) {
    const t = String(text || '').toLowerCase();
    if (!t.trim()) return true; // no snippet: judge by fetching
    // The quoted identifier from the query appearing in the snippet is the
    // strongest cheap signal we have.
    const quoted = [...String(query.text).matchAll(/"([^"]{3,})"/g)].map((m) => m[1].toLowerCase());
    if (quoted.some((q) => t.includes(q))) return true;
    // Otherwise require at least one personal-data shape.
    return /\b(age \d{1,3}|\d{1,3} years old|lives in|related to|phone|address|background|public record|profile)\b/.test(t);
  }

  extractedToNodes(extracted) {
    const out = [];
    const r = extracted.record;
    for (const v of r.names || []) out.push({ type: 'name', value: v, strength: 0.8 });
    for (const v of r.emails || []) out.push({ type: 'email', value: v, strength: 1 });
    for (const v of r.phones || []) out.push({ type: 'phone', value: v, strength: 1 });
    for (const v of r.addresses || []) out.push({ type: 'address', value: v, strength: 0.9 });
    for (const v of r.usernames || []) out.push({ type: 'username', value: v, strength: 0.7 });
    for (const v of r.relatives || []) out.push({ type: 'relative', value: v, strength: 0.9 });
    for (const v of r.employers || []) out.push({ type: 'employer', value: v, strength: 0.7 });
    for (const v of r.schools || []) out.push({ type: 'school', value: v, strength: 0.6 });
    for (const v of r.profileUrls || []) out.push({ type: 'profile', value: v, strength: 0.85 });
    return out;
  }

  makeExposure({ url, page, extracted, match, query, round, removability, status }) {
    const domain = registrableDomain(url);
    const base = {
      id: `exp_${fnv1a(url)}`,
      url,
      domain,
      title: page.title,
      discoveredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      discoveredVia: { query: query.text, kind: query.kind, round },
      record: extracted.record,
      fields: extracted.fields,
      matchScore: match.score,
      classification: match.classification,
      evidenceOfMatch: match.signals,
      conflicts: match.conflicts,
      explanation: match.explanation,
      paywalled: extracted.paywalled,
      removability: removability || null,
      status: STATE.DISCOVERED,
      history: [],
      evidence: [],
    };
    base.risk = riskOf({
      fields: base.fields,
      siteKind: removability ? siteKindFor(removability.category) : 'unknown',
      matchScore: base.matchScore,
      status: base.status,
    });
    if (status && status !== STATE.DISCOVERED) {
      transition(base, status, 'initial classification');
    }
    return base;
  }

  /* ------------------------------------------------- removal (10–26) */

  async removalPhase() {
    const workable = prioritize(
      this.run.exposures.filter((e) => e.status === STATE.CONFIRMED_EXPOSURE),
    );

    this.emit('removal:start', { count: workable.length });

    for (const exposure of workable) {
      if (this.cancelled) break;
      await this.processRemoval(exposure);
      this.save();
    }

    await this.verificationSweep();
  }

  async processRemoval(exposure) {
    /* --- can this even be removed? (spec item 39) --- */
    const r = exposure.removability;
    if (r && !r.removable) {
      transition(exposure, STATE.NOT_REMOVABLE, r.userMessage, { category: r.category });
      this.emit('exposure:not-removable', this.exposureSummary(exposure));
      return;
    }
    if (r?.category === CATEGORY.USER_CONTROLLED || r?.category === CATEGORY.SOCIAL) {
      transition(exposure, STATE.NOT_REMOVABLE, r.userMessage, { category: r.category });
      return;
    }

    /* --- review mode: ask before doing anything (spec item 41) --- */
    if (this.options.mode === MODE.REVIEW) {
      const approved = await this.hooks.askApproveRemoval?.({
        url: exposure.url,
        domain: exposure.domain,
        whatIsExposed: exposure.fields,
        why: exposure.explanation,
        risk: exposure.risk,
      });
      if (!approved) {
        this.log('removal declined by user', { domain: exposure.domain });
        return;
      }
    }

    /* --- find the removal path (10–12, 35) --- */
    const workflows = this.vault.loadWorkflows();
    const known = getTemplate(workflows, exposure.domain);

    const method = await discoverRemovalMethod(this.session, exposure.url, {
      knownWorkflow: known,
      searchFn: (q, o) => this.searchFn(q, o),
      log: (m, d) => this.log(m, d),
    });

    if (!method.entryUrl) {
      transition(exposure, STATE.NOT_REMOVABLE, method.note || 'No removal mechanism found.');
      this.emit('exposure:not-removable', this.exposureSummary(exposure));
      return;
    }

    transition(exposure, STATE.REMOVAL_METHOD_FOUND,
      `${method.workflowType} at ${method.entryUrl}`, { removalUrl: method.entryUrl });
    exposure.removalMethod = {
      url: method.entryUrl,
      type: method.workflowType,
      kind: method.kind,
      source: method.source,
    };

    /* --- jurisdiction + which choices to take (23, 24) --- */
    const jurisdiction = detectJurisdiction(this.profile.residence, method.policyText || '');
    exposure.jurisdiction = jurisdiction;
    exposure.privacyChoices = preferredChoices(jurisdiction.documentedProcesses);

    /* --- irreversible account deletion needs consent even in mission mode --- */
    if (method.workflowType === WORKFLOW_TYPE.ACCOUNT_DELETION) {
      const ok = await this.hooks.askConfirmDestructive?.({
        domain: exposure.domain,
        url: method.entryUrl,
        what: 'delete an account',
        why: 'This closes the account permanently. It cannot be undone, and anything else attached to it goes too.',
      });
      if (!ok) {
        transition(exposure, STATE.MANUAL_ACTION_REQUIRED,
          'Account deletion needs your explicit go-ahead — nothing was submitted.');
        return;
      }
    }

    /* --- execute (13–22) --- */
    transition(exposure, STATE.FORM_IN_PROGRESS, 'filling the removal form');
    this.emit('exposure:submitting', this.exposureSummary(exposure));

    const result = await executeRemoval(this.session, method, {
      profile: this.profile,
      values: this.formValues(exposure),
      exposure,
      vault: this.vault,
      mode: this.options.mode,
      hooks: {
        ...this.hooks,
        cancelled: () => this.cancelled,
      },
      log: (m, d) => this.log(m, d),
    });

    exposure.evidence.push(...(result.evidence || []));
    this.vault.saveWorkflows(recordOutcome(workflows, method, result));

    await this.applyExecutionResult(exposure, result, method);
  }

  async applyExecutionResult(exposure, result, method) {
    switch (result.outcome) {
      case OUTCOME.SUBMITTED: {
        transition(exposure, STATE.REQUEST_SUBMITTED, 'request submitted', {
          caseNumber: result.confirmation?.caseNumber || null,
          submittedAt: result.submittedAt,
        });
        exposure.submission = {
          submittedAt: result.submittedAt,
          caseNumber: result.confirmation?.caseNumber || null,
          expectedTimeframe: result.confirmation?.expectedTimeframe || null,
          confirmationExcerpt: result.confirmation?.excerpt || null,
          weak: Boolean(result.confirmation?.weak),
        };
        // "Submitted" is not "removed" — schedule the check that decides.
        transition(exposure, STATE.PENDING_REMOVAL,
          `Waiting out the stated processing time${result.confirmation?.expectedTimeframe ? ` (${result.confirmation.expectedTimeframe})` : ''}.`);
        exposure.recheckAfter = recheckDate(result.confirmation?.expectedTimeframe);
        this.emit('exposure:submitted', this.exposureSummary(exposure));
        break;
      }

      case OUTCOME.VERIFICATION_REQUIRED: {
        transition(exposure, STATE.VERIFICATION_REQUIRED, result.note || 'verification needed');
        exposure.submission = { submittedAt: result.submittedAt, channel: result.channel };
        this.emit('exposure:verification', this.exposureSummary(exposure));

        if (result.channel === 'email') {
          await this.handleEmailVerification(exposure, method, result);
        }
        break;
      }

      case OUTCOME.PAYMENT_DEMANDED: {
        transition(exposure, STATE.PAYMENT_DEMANDED, result.note, { paywall: result.paywall });
        exposure.paymentDemand = result.paywall || { detected: true };
        this.emit('exposure:payment', this.exposureSummary(exposure));
        // Spec item 22: look for a free alternative rather than giving up.
        await this.findFreeAlternative(exposure);
        break;
      }

      case OUTCOME.NEEDS_HUMAN: {
        transition(exposure, STATE.MANUAL_ACTION_REQUIRED, result.note || 'needs you', {
          needs: result.needs,
        });
        exposure.manualAction = {
          needs: result.needs,
          note: result.note,
          url: method.entryUrl,
          contact: result.contact || null,
        };
        this.emit('exposure:needs-human', this.exposureSummary(exposure));
        break;
      }

      case OUTCOME.NO_FORM:
      case OUTCOME.FAILED:
      default: {
        transition(exposure, STATE.FAILED, result.note || result.error || 'submission failed', {
          errors: result.errors,
        });
        exposure.retryCount = (exposure.retryCount || 0) + 1;
        this.emit('exposure:failed', this.exposureSummary(exposure));
        break;
      }
    }
  }

  /** Spec items 16–18: find the confirmation email and complete the loop. */
  async handleEmailVerification(exposure, method, result) {
    if (!this.mail.available) {
      transition(exposure, STATE.MANUAL_ACTION_REQUIRED,
        'This site emailed you a confirmation link. Connect a mailbox, or click it yourself and the agent will pick up from there.',
        { needs: 'email_confirmation' });
      return;
    }

    const consent = await this.hooks.askEmailAccess?.({ domain: exposure.domain });
    if (consent === false) {
      transition(exposure, STATE.MANUAL_ACTION_REQUIRED,
        'Waiting on the confirmation email — you declined mailbox access, so you will need to click the link.',
        { needs: 'email_confirmation' });
      return;
    }

    // Confirmations are not instant. A few spaced attempts beats one immediate
    // look that always misses.
    let found = null;
    for (const waitMs of [8000, 20_000, 45_000]) {
      await sleep(waitMs);
      found = await this.mail.findConfirmation({
        domain: exposure.domain,
        companyName: exposure.domain.split('.')[0],
        submittedAt: result.submittedAt,
      });
      if (found) break;
    }

    if (!found) {
      transition(exposure, STATE.MANUAL_ACTION_REQUIRED,
        'We could not find the confirmation email. It may be slow, or filtered — check your spam folder.',
        { needs: 'email_confirmation' });
      return;
    }

    this.log('confirmation email found', {
      domain: exposure.domain,
      confidence: found.confidence,
    });

    if (found.verification.link) {
      const followed = await followVerificationLink(this.session, found.verification.link, {
        vault: this.vault, exposureId: exposure.id,
      });
      if (followed.ok) {
        if (followed.screenshot) {
          exposure.evidence.push({
            label: 'email-verified', path: followed.screenshot,
            url: followed.finalUrl, capturedAt: new Date().toISOString(),
          });
        }
        transition(exposure, STATE.REQUEST_SUBMITTED, 'verification link followed', {
          caseNumber: followed.caseNumber || found.verification.caseNumber,
        });
        exposure.submission = {
          ...(exposure.submission || {}),
          verifiedAt: new Date().toISOString(),
          caseNumber: followed.caseNumber || found.verification.caseNumber || null,
          expectedTimeframe: followed.expectedTimeframe || found.verification.expectedTimeframe || null,
        };
        transition(exposure, STATE.PENDING_REMOVAL, 'verified — waiting for the site to process it');
        exposure.recheckAfter = recheckDate(exposure.submission.expectedTimeframe);
        this.emit('exposure:verified', this.exposureSummary(exposure));
        return;
      }
    }

    if (found.verification.code) {
      // Spec item 18 — the code goes back into the still-open form.
      exposure.pendingCode = found.verification.code;
      transition(exposure, STATE.MANUAL_ACTION_REQUIRED,
        `The site emailed the code ${found.verification.code}. The form is open in the browser — we will enter it if the page is still live.`,
        { needs: 'verification_code' });
      return;
    }

    transition(exposure, STATE.MANUAL_ACTION_REQUIRED,
      'Found what looks like the confirmation email, but it had no link or code we could use.',
      { needs: 'email_confirmation' });
  }

  /** Spec item 22 — a paid site often has a free statutory route as well. */
  async findFreeAlternative(exposure) {
    const results = await this.searchFn(
      `site:${exposure.domain} ("do not sell" OR "california" OR "ccpa" OR "privacy request" OR "free")`,
    );
    const candidate = (results.results || []).find(
      (r) => registrableDomain(r.url) === exposure.domain && !/premium|upgrade|pricing/i.test(r.url),
    );
    if (candidate) {
      exposure.freeAlternative = candidate.url;
      this.log('possible free removal route found', { domain: exposure.domain });
    }
  }

  /* -------------------------------------- verification & recheck (31–33) */

  /**
   * Spec item 31: "request submitted" is not "removed". This revisits pending
   * sites after their stated processing period and checks whether the page has
   * actually gone.
   */
  async verificationSweep(options = {}) {
    const now = Date.now();
    const due = this.run.exposures.filter(
      (e) => e.status === STATE.PENDING_REMOVAL
        && (options.force || !e.recheckAfter || Date.parse(e.recheckAfter) <= now),
    );

    if (!due.length) return { checked: 0 };
    this.emit('verify:start', { count: due.length });

    let removed = 0;
    for (const exposure of due) {
      if (this.cancelled) break;
      const page = await this.session.readPage(exposure.url);
      this.fetchCount += 1;

      const gone = !page.ok
        || page.status === 404 || page.status === 410
        || /\b(not found|no longer available|no results|record (has been )?removed|page (has been )?(removed|deleted))\b/i.test(page.text || '');

      if (gone) {
        transition(exposure, STATE.SUCCESSFULLY_REMOVED,
          'Re-checked the page — the listing is gone.', { verifiedAt: new Date().toISOString() });
        exposure.risk = riskOf({ ...exposure, status: STATE.SUCCESSFULLY_REMOVED });
        removed += 1;
        this.emit('exposure:removed', this.exposureSummary(exposure));
        continue;
      }

      // Still there — is our data still on it, or just the shell of the page?
      const extracted = extractFromPage(page);
      const match = scoreMatch(extracted.record, this.profile);
      if (match.score < 0.4) {
        transition(exposure, STATE.SUCCESSFULLY_REMOVED,
          'The page still exists, but your details are no longer on it.',
          { verifiedAt: new Date().toISOString() });
        removed += 1;
        this.emit('exposure:removed', this.exposureSummary(exposure));
        continue;
      }

      const overdue = exposure.recheckAfter && Date.parse(exposure.recheckAfter) < now;
      if (overdue) {
        transition(exposure, STATE.REMOVAL_METHOD_FOUND,
          'The stated processing time has passed and the listing is still up. Refiling.');
        exposure.refiles = (exposure.refiles || 0) + 1;
      }
    }

    return { checked: due.length, removed };
  }

  /**
   * Spec items 32–33: re-run the sharpest original searches after removals, to
   * catch mirrors, republished copies and caches — and to notice when a record
   * we removed has resurfaced through an upstream feed.
   */
  async recheckForReappearance() {
    const removed = this.run.exposures.filter((e) => e.status === STATE.SUCCESSFULLY_REMOVED);
    if (!removed.length) return { reappeared: [] };

    const queries = recheckQueries(this.graph, this.profile, { budget: 20 });
    const found = [];

    for (const query of queries) {
      if (this.cancelled) break;
      await this.limiter.take();
      const { results = [] } = await this.searchFn(query);

      for (const result of results) {
        const known = this.run.exposures.find((e) => e.url === result.url);
        if (known && !TERMINAL.has(known.status)) continue;
        if (known?.status === STATE.SUCCESSFULLY_REMOVED) {
          // The exact URL we had removed is back in the index.
          found.push({ url: result.url, kind: 'relisted' });
          continue;
        }
        if (!known) {
          this.fetchCount += 1;
          const page = await this.session.readPage(result.url);
          if (!page.ok) continue;
          const extracted = extractFromPage(page);
          const match = scoreMatch(extracted.record, this.profile);
          if (match.classification === CLASSIFICATION.FALSE) continue;

          const exposure = this.makeExposure({
            url: page.url, page, extracted, match, query, round: -1,
            removability: classifyRemovability(
              { url: page.url, title: page.title, text: page.text, fields: extracted.fields },
              this.profile,
            ),
            status: STATE.CONFIRMED_EXPOSURE,
          });
          this.run.exposures.push(exposure);
          found.push({ url: page.url, kind: 'new' });
        }
      }
    }

    const reappearances = detectReappearance(
      removed,
      this.run.exposures.filter((e) => found.some((f) => f.url === e.url)),
    );

    for (const r of reappearances) {
      this.log('record has reappeared', { kind: r.kind, url: r.reappeared.url });
      r.reappeared.reappearance = {
        kind: r.kind,
        originalUrl: r.original.url,
        note: r.note,
        investigateUpstream: r.investigateUpstream,
      };
      this.emit('exposure:reappeared', { ...this.exposureSummary(r.reappeared), note: r.note });
    }

    this.save();
    return { reappeared: reappearances, newlyFound: found.length };
  }

  /* --------------------------------------------------------- reporting */

  formValues(exposure) {
    const p = this.profile;
    const primaryName = p.names[0]?.value || '';
    const parts = primaryName.split(/\s+/);
    const addr = p.addresses.find((a) => a.kind === 'address.full') || p.addresses[0];
    const parsed = addr ? parseAddress(addr.value) : {};

    return {
      name: {
        full: primaryName,
        first: parts[0] || '',
        middle: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
        last: parts.length > 1 ? parts[parts.length - 1] : '',
      },
      email: { primary: p.emails[0]?.value || '' },
      phone: { primary: p.phones.find((x) => x.kind === 'phone.formatted')?.value || p.phones[0]?.value || '' },
      address: {
        line1: parsed.line1 || '',
        unit: parsed.unit || '',
        city: parsed.city || p.residence.city || '',
        state: parsed.state || p.residence.state || '',
        zip: parsed.zip || p.residence.zip || '',
        country: p.residence.country || 'United States',
      },
      age: p.birthYear ? String(new Date().getUTCFullYear() - p.birthYear.value) : '',
      birthYear: p.birthYear ? String(p.birthYear.value) : '',
      record: { url: exposure.url },
      request: {
        message: this.requestMessage(exposure),
        reason: 'Removal of my personal information',
      },
      verification: { code: exposure.pendingCode || '' },
    };
  }

  /**
   * The text we put in a free-form "tell us more" box. Deliberately plain: a
   * polite, specific request works better than a legal threat, and the
   * jurisdiction module has already decided whether a statute can honestly be
   * named (spec item 23).
   */
  requestMessage(exposure) {
    const citable = (exposure.jurisdiction?.recommended || [])
      .find((r) => r.approach === 'statutory');
    const lead = `I am requesting the removal of my personal information from ${exposure.domain}.`;
    const which = `The listing is at ${exposure.url}.`;
    const legal = citable ? ` I am a resident of ${citable.law ? exposure.jurisdiction.applicable[0]?.code : ''} and am exercising my rights under ${citable.law}.` : '';
    return `${lead} ${which}${legal} Please confirm once the record has been removed.`.replace(/\s+/g, ' ');
  }

  exposureSummary(e) {
    return {
      id: e.id,
      url: e.url,
      domain: e.domain,
      status: e.status,
      matchScore: e.matchScore,
      classification: e.classification,
      risk: e.risk,
      fields: e.fields,
      explanation: e.explanation,
    };
  }

  /** The end-of-run report (spec item 42). */
  buildSummary() {
    const exposures = this.run.exposures || [];
    const states = summarize(exposures);
    const overall = exposureScore(exposures);
    const groups = groupDuplicates(exposures.filter((e) => e.status !== STATE.FALSE_MATCH));

    const newIdentifiers = this.graph.all().filter((n) => n.origin === 'discovered');

    return {
      mode: this.options.mode,
      startedAt: this.run.startedAt,
      finishedAt: new Date().toISOString(),
      sourcesSearched: this.run.searchedQueries.length,
      pagesFetched: this.fetchCount,
      rounds: this.run.rounds.length,
      converged: hasConverged(this.run.rounds),

      exposuresDiscovered: exposures.length,
      confirmedRecords: states.confirmed,
      falsePositivesRejected: states.falseMatches,
      duplicateGroups: groups.filter((g) => g.count > 1).length,

      removalsSubmitted: states.submitted,
      removalsCompleted: states.completed,
      pendingRequests: states.byState[STATE.PENDING_REMOVAL] + states.byState[STATE.REQUEST_SUBMITTED],
      verificationsPending: states.verificationPending,
      humanActionsRequired: states.manualRequired,
      nonRemovableRecords: states.notRemovable,
      failed: states.failed,

      newIdentifiersDiscovered: {
        count: newIdentifiers.length,
        byType: countBy(newIdentifiers, (n) => n.type),
      },

      exposureScore: overall,
      topRisks: prioritize(exposures.filter((e) => !TERMINAL.has(e.status)))
        .slice(0, 5)
        .map((e) => ({ domain: e.domain, url: e.url, risk: e.risk.score, band: e.risk.band })),

      byState: states.byState,
    };
  }
}

/* --------------------------------------------------------------- utils */

function countBy(list, fn) {
  const out = {};
  for (const item of list) {
    const k = fn(item);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

/**
 * Turn a site's stated timeframe into a date to come back on.
 * Defaults to two weeks, which covers most published windows, and never
 * shorter than 48 hours — checking the next morning just produces a false
 * "still listed" and an unnecessary refile.
 */
export function recheckDate(timeframe, from = Date.now()) {
  const t = String(timeframe || '').toLowerCase();
  const n = Number((t.match(/\d{1,3}/) || [])[0]);
  let days = 14;

  if (t.includes('hour')) days = 1;
  else if (t.includes('day')) days = Number.isFinite(n) ? n : 7;
  else if (t.includes('week')) days = (Number.isFinite(n) ? n : 2) * 7;
  else if (t.includes('month')) days = (Number.isFinite(n) ? n : 1) * 30;

  // Business days run long; give the site a little grace before refiling.
  if (t.includes('business')) days = Math.ceil(days * 1.4);

  const ms = Math.max(2, days) * 86400_000;
  return new Date(from + ms).toISOString();
}
