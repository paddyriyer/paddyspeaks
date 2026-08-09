/**
 * The local dashboard (spec items 28, 29).
 *
 * Spec item 28 asks for "a live dashboard rather than raw browser activity",
 * and that framing drives the whole design. The user should see *what is
 * happening to their exposure*, not a scrolling log of clicks. So the API
 * serves counters, exposures and questions — never the browser's internals.
 *
 * It binds to 127.0.0.1 only. This is not configurable, and the reason is
 * blunt: the payload includes a person's home address, phone number and
 * relatives. A `--host 0.0.0.0` flag would be one careless invocation away from
 * publishing all of it to the local network.
 *
 * There is no authentication because there is no remote access; the security
 * boundary is the loopback interface plus a random port. Anything reachable
 * over the network would need real auth, which is precisely why it isn't.
 */

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

import { summarize, STATE, STATE_LABELS } from '../core/states.js';
import { exposureScore, riskOf, prioritize } from '../core/risk.js';
import { groupDuplicates } from '../core/dedupe.js';
import { maskEmail, maskPhone } from '../core/match.js';

const HERE = dirname(fileURLToPath(import.meta.url));

export class Dashboard {
  constructor(agent, options = {}) {
    this.agent = agent;
    this.port = options.port || 0; // 0 = let the OS pick a free port
    this.server = null;
    this.clients = new Set();
    // A per-session token in the URL, so another local process that guesses
    // the port still cannot read the data by drive-by request.
    this.token = randomBytes(16).toString('hex');
    this.pendingQuestions = new Map();
  }

  async start() {
    this.server = createServer((req, res) => this.handle(req, res));
    await new Promise((resolve) => this.server.listen(this.port, '127.0.0.1', resolve));
    this.port = this.server.address().port;
    return this.url;
  }

  get url() {
    return `http://127.0.0.1:${this.port}/?t=${this.token}`;
  }

  async stop() {
    for (const client of this.clients) client.end();
    this.clients.clear();
    await new Promise((resolve) => this.server?.close(resolve));
  }

  authorized(url) {
    return url.searchParams.get('t') === this.token;
  }

  handle(req, res) {
    const url = new URL(req.url, `http://127.0.0.1:${this.port}`);

    if (url.pathname === '/' ) {
      if (!this.authorized(url)) return this.send(res, 403, 'text/plain', 'Forbidden');
      const html = readFileSync(join(HERE, 'dashboard.html'), 'utf8')
        .replace('__TOKEN__', this.token);
      return this.send(res, 200, 'text/html; charset=utf-8', html);
    }

    if (!this.authorized(url)) return this.json(res, 403, { error: 'forbidden' });

    switch (url.pathname) {
      case '/api/state':
        return this.json(res, 200, this.state());
      case '/api/exposure':
        return this.json(res, 200, this.exposureDetail(url.searchParams.get('id')));
      case '/api/events':
        return this.stream(req, res);
      case '/api/answer':
        return this.answer(req, res);
      default:
        return this.json(res, 404, { error: 'not found' });
    }
  }

  /** The dashboard payload (spec item 28). */
  state() {
    const exposures = this.agent.run?.exposures || [];
    const counts = summarize(exposures);
    const live = exposures.filter((e) => e.status !== STATE.FALSE_MATCH);
    const groups = groupDuplicates(live);

    return {
      mode: this.agent.options.mode,
      running: Boolean(this.agent.session),
      startedAt: this.agent.run?.startedAt || null,

      // The headline counters, in the order spec item 28 lists them.
      counters: {
        exposuresDiscovered: exposures.length,
        confirmedMatches: counts.confirmed,
        removalsSubmitted: counts.submitted,
        removalsCompleted: counts.completed,
        verificationsPending: counts.verificationPending,
        manualActionsRequired: counts.manualRequired,
        stillInvestigating: counts.investigating,
      },

      exposureScore: exposureScore(exposures),
      rounds: this.agent.run?.rounds || [],
      searchesRun: (this.agent.run?.searchedQueries || []).length,
      identifiersKnown: this.agent.graph?.size() || 0,

      duplicateGroups: groups
        .filter((g) => g.count > 1)
        .map((g) => ({ id: g.id, label: g.label, count: g.count, domains: g.domains, summary: g.summary })),

      openQuestions: [...this.pendingQuestions.values()].map((q) => q.prompt),

      exposures: prioritize(live).map((e) => ({
        id: e.id,
        domain: e.domain,
        url: e.url,
        status: e.status,
        statusLabel: STATE_LABELS[e.status]?.[0] || e.status,
        statusHelp: STATE_LABELS[e.status]?.[1] || '',
        matchScore: e.matchScore,
        classification: e.classification,
        risk: e.risk || riskOf(e),
        fields: e.fields,
        removable: e.removability?.removable ?? null,
        category: e.removability?.category || null,
      })),
    };
  }

  /**
   * Spec item 29: exactly what is visible there, why we think it is them, and
   * what is being done about it.
   *
   * The record values are masked. The user already knows their own phone
   * number; printing it in full into a browser tab adds nothing and puts it in
   * the page cache.
   */
  exposureDetail(id) {
    const e = (this.agent.run?.exposures || []).find((x) => x.id === id);
    if (!e) return { error: 'not found' };

    return {
      id: e.id,
      url: e.url,
      domain: e.domain,
      title: e.title,
      discoveredAt: e.discoveredAt,
      discoveredVia: e.discoveredVia,

      // What is exposed
      whatIsVisible: {
        fields: e.fields,
        record: maskRecord(e.record),
      },

      // Why we believe it is them
      whyWeThinkItsYou: {
        score: e.matchScore,
        classification: e.classification,
        explanation: e.explanation,
        matches: e.evidenceOfMatch,
        mismatches: e.conflicts,
      },

      // What is being done
      whatWeAreDoing: {
        status: e.status,
        label: STATE_LABELS[e.status]?.[0] || e.status,
        help: STATE_LABELS[e.status]?.[1] || '',
        removability: e.removability,
        removalMethod: e.removalMethod || null,
        jurisdiction: e.jurisdiction?.recommended || [],
        privacyChoices: e.privacyChoices || null,
        submission: e.submission || null,
        manualAction: e.manualAction || null,
        paymentDemand: e.paymentDemand || null,
        freeAlternative: e.freeAlternative || null,
        reappearance: e.reappearance || null,
        recheckAfter: e.recheckAfter || null,
      },

      risk: e.risk,
      history: e.history || [],
      evidence: (e.evidence || []).map((ev) => ({
        label: ev.label, capturedAt: ev.capturedAt, url: ev.url,
      })),
    };
  }

  /** Server-sent events, so the page updates without polling. */
  stream(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('retry: 2000\n\n');
    this.clients.add(res);
    req.on('close', () => this.clients.delete(res));
  }

  push(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try { client.write(payload); } catch { this.clients.delete(client); }
    }
  }

  /**
   * Register a question and return a promise that resolves when the user
   * answers it in the UI. This is how askIsThisYou and friends get answered
   * from the dashboard rather than the terminal.
   */
  ask(prompt) {
    const id = `q_${randomBytes(6).toString('hex')}`;
    return new Promise((resolve) => {
      this.pendingQuestions.set(id, { prompt: { ...prompt, id }, resolve });
      this.push('question', { ...prompt, id });
    });
  }

  answer(req, res) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        const { id, answer } = JSON.parse(body || '{}');
        const pending = this.pendingQuestions.get(id);
        if (pending) {
          this.pendingQuestions.delete(id);
          pending.resolve(answer);
          this.push('question:answered', { id });
          return this.json(res, 200, { ok: true });
        }
        return this.json(res, 404, { error: 'no such question' });
      } catch {
        return this.json(res, 400, { error: 'bad request' });
      }
    });
  }

  send(res, status, type, body) {
    res.writeHead(status, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      // The page is entirely self-contained; nothing should ever load or
      // phone out, and a CSP is the cheapest way to guarantee it.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(body);
  }

  json(res, status, data) {
    this.send(res, status, 'application/json', JSON.stringify(data));
  }
}

/** Mask the record before it reaches a browser tab. */
function maskRecord(record = {}) {
  return {
    names: record.names || [],
    addresses: (record.addresses || []).map(maskAddress),
    phones: (record.phones || []).map(maskPhone),
    emails: (record.emails || []).map(maskEmail),
    relatives: record.relatives || [],
    ages: record.ages || [],
    employers: record.employers || [],
    schools: record.schools || [],
    usernames: record.usernames || [],
    profileUrls: record.profileUrls || [],
  };
}

function maskAddress(a) {
  // Keep the street and town legible — the user needs to recognise it — but
  // drop the house number, which is the part that makes it actionable.
  return String(a).replace(/^\s*\d+\s*/, '••• ');
}
