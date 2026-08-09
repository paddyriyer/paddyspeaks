/**
 * The identity graph.
 *
 * Nodes are identifiers (a name, a phone, an address, a username, an employer,
 * a domain, a profile URL). Edges record *why* we think two identifiers belong
 * to the same person, and which page told us so.
 *
 * Two properties matter and both are easy to get wrong:
 *
 * 1. Confidence propagates but never grows. An identifier discovered on a page
 *    can be at most as trustworthy as our belief that the page is about the
 *    user. A relative's name found on a 0.6-confidence listing enters at 0.6
 *    or lower — never at 1.0 just because it was printed in bold.
 *
 * 2. Discovery is recursive but must terminate. Each node carries a `depth`,
 *    and nodes past `maxDepth`, or below `minConfidence`, stop generating new
 *    searches. Without that, one shared surname turns into an endless crawl of
 *    strangers.
 *
 * Pure module — no I/O. Unit-tested in tests/run.mjs.
 */

import { norm, uniq, clamp, round, fnv1a, registrableDomain } from './text.js';
import { phoneKey, addressKey, parseName } from './identity.js';

export const NODE_TYPES = [
  'name', 'email', 'phone', 'address', 'username', 'employer', 'school',
  'relative', 'domain', 'profile', 'organization', 'birth_year',
];

/** How much of a page's match confidence a newly discovered node inherits. */
const INHERIT = {
  // Strong identifiers: if a confirmed page prints them, they are probably ours.
  phone: 0.95, email: 0.95, address: 0.9, username: 0.85, profile: 0.9,
  // Weaker: shared by many people, or contextual.
  name: 0.8, employer: 0.75, school: 0.7, relative: 0.85,
  domain: 0.6, organization: 0.6, birth_year: 0.8,
};

/** The canonical comparison key for a node — this is what dedupes the graph. */
export function nodeKey(type, value) {
  const v = String(value == null ? '' : value);
  switch (type) {
    case 'phone': return `phone:${phoneKey(v)}`;
    case 'address': return `address:${addressKey(v) || norm(v)}`;
    case 'email': return `email:${norm(v).replace(/\s+/g, '')}`;
    case 'domain': return `domain:${registrableDomain(v)}`;
    case 'profile': return `profile:${norm(v)}`;
    case 'name': {
      const p = parseName(v);
      // Middle names come and go between records; first+last is the identity.
      return `name:${norm(`${p.first} ${p.last}`.trim()) || norm(v)}`;
    }
    default: return `${type}:${norm(v)}`;
  }
}

export class IdentityGraph {
  constructor(options = {}) {
    this.nodes = new Map(); // key -> node
    this.edges = [];        // { from, to, reason, sourceUrl, weight }
    this.maxDepth = options.maxDepth ?? 3;
    this.minConfidence = options.minConfidence ?? 0.45;
    this.seedProfileId = options.seedProfileId || null;
  }

  /**
   * Insert or strengthen a node.
   *
   * Re-observing an identifier does not simply overwrite the old confidence:
   * we keep the *highest* confidence seen, and record every corroborating
   * source. Ten weak sightings of the same phone number are meaningfully
   * better evidence than one, so we apply a small corroboration bonus that
   * saturates quickly.
   */
  add(type, value, opts = {}) {
    if (!type || value == null || value === '') return null;
    if (!NODE_TYPES.includes(type)) throw new Error(`unknown node type: ${type}`);

    const key = nodeKey(type, value);
    if (!key || key.endsWith(':')) return null;

    const confidence = clamp(opts.confidence ?? 0.5);
    const depth = opts.depth ?? 0;
    const existing = this.nodes.get(key);

    if (existing) {
      existing.sources = uniq([...existing.sources, opts.sourceUrl].filter(Boolean));
      existing.observations += 1;
      existing.depth = Math.min(existing.depth, depth);
      // Corroboration bonus: +0.03 per independent source, capped at +0.1, and
      // never enough on its own to promote a guess into a confirmed fact.
      //
      // The bonus is applied to `baseConfidence` — the best *single-sighting*
      // confidence — and never to the already-bonused value. Compounding it
      // would let a node climb to 1.0 through sheer repetition, which is
      // exactly the certainty we must not manufacture: a hundred sites copying
      // one wrong record is still one wrong record.
      existing.baseConfidence = Math.max(existing.baseConfidence ?? existing.confidence, confidence);
      const bonus = Math.min(0.1, Math.max(0, existing.sources.length - 1) * 0.03);
      existing.confidence = round(clamp(existing.baseConfidence + bonus), 3);
      if (opts.label && !existing.labels.includes(opts.label)) existing.labels.push(opts.label);
      return existing;
    }

    const node = {
      id: fnv1a(key),
      key,
      type,
      value: typeof value === 'string' ? value.trim() : value,
      confidence: round(confidence, 3),
      baseConfidence: round(confidence, 3),
      depth,
      origin: opts.origin || 'seed',
      sources: uniq([opts.sourceUrl].filter(Boolean)),
      labels: opts.label ? [opts.label] : [],
      observations: 1,
      searched: false,
      addedAt: new Date().toISOString(),
    };
    this.nodes.set(key, node);
    return node;
  }

  link(fromType, fromValue, toType, toValue, reason, sourceUrl, weight = 0.5) {
    const from = nodeKey(fromType, fromValue);
    const to = nodeKey(toType, toValue);
    if (!from || !to || from === to) return;
    const dup = this.edges.find(
      (e) => e.from === from && e.to === to && e.reason === reason && e.sourceUrl === sourceUrl,
    );
    if (dup) return;
    this.edges.push({ from, to, reason, sourceUrl: sourceUrl || null, weight: clamp(weight) });
  }

  get(type, value) { return this.nodes.get(nodeKey(type, value)) || null; }
  has(type, value) { return this.nodes.has(nodeKey(type, value)); }
  all() { return [...this.nodes.values()]; }
  byType(type) { return this.all().filter((n) => n.type === type); }
  size() { return this.nodes.size; }

  /**
   * Seed the graph from a structured profile. Seed nodes sit at depth 0 and
   * keep the confidence the user's own answers earned them.
   */
  seed(profile) {
    if (!profile) return this;
    this.seedProfileId = profile.id;

    const feed = (list, type) => {
      for (const v of list || []) {
        this.add(type, v.value, {
          confidence: v.confidence,
          depth: 0,
          origin: 'seed',
          label: v.kind,
        });
      }
    };

    feed(profile.names, 'name');
    feed(profile.emails, 'email');
    feed(profile.phones, 'phone');
    feed(profile.addresses, 'address');
    feed(profile.usernames, 'username');
    feed(profile.employers, 'employer');
    feed(profile.schools, 'school');
    feed(profile.relatives, 'relative');
    feed(profile.profiles, 'profile');

    if (profile.birthYear?.value) {
      this.add('birth_year', String(profile.birthYear.value), {
        confidence: profile.birthYear.confidence,
        depth: 0,
        origin: 'seed',
      });
    }

    // Email domains are worth knowing about (personal domains are a strong
    // identifier; gmail.com is not, so we mark the free hosts as low value).
    for (const e of profile.emails || []) {
      const domain = String(e.value).split('@')[1];
      if (domain && !FREE_EMAIL_HOSTS.has(domain)) {
        this.add('domain', domain, { confidence: e.confidence * 0.9, depth: 0, origin: 'seed' });
        this.link('email', e.value, 'domain', domain, 'email_domain', null, 0.9);
      }
    }

    // Link every seed identifier to the primary name so the graph is connected.
    const primary = profile.names?.[0]?.value;
    if (primary) {
      for (const n of this.all()) {
        if (n.key !== nodeKey('name', primary)) {
          this.link('name', primary, n.type, n.value, 'seed_association', null, 0.8);
        }
      }
    }
    return this;
  }

  /**
   * Absorb identifiers extracted from a page we believe is about the user.
   *
   * `pageConfidence` is the match score for that page. This is the single most
   * important guard in the whole crawl: it is what stops a page about a
   * different John Smith from injecting his address into our graph as fact.
   */
  ingest(extracted, pageConfidence, sourceUrl, parentDepth = 0) {
    const added = [];
    const conf = clamp(pageConfidence);
    if (conf < this.minConfidence) return added;

    const depth = parentDepth + 1;
    for (const item of extracted || []) {
      if (!item || !item.type || !item.value) continue;
      if (!NODE_TYPES.includes(item.type)) continue;

      const inherit = INHERIT[item.type] ?? 0.7;
      // A node can never be more confident than the page that produced it.
      const nodeConfidence = clamp(conf * inherit * clamp(item.strength ?? 1));
      if (nodeConfidence < this.minConfidence * 0.8) continue;

      const before = this.has(item.type, item.value);
      const node = this.add(item.type, item.value, {
        confidence: nodeConfidence,
        depth,
        origin: 'discovered',
        sourceUrl,
        label: item.label,
      });
      if (node && !before) added.push(node);
      if (node) this.link('domain', registrableDomain(sourceUrl || ''), item.type, item.value,
        'found_on_page', sourceUrl, nodeConfidence);
    }
    return added;
  }

  /**
   * Nodes that should still generate searches.
   *
   * The three stopping conditions together are what make discovery terminate:
   * already searched, too deep, or too weak to be worth the request budget.
   */
  pendingSearchNodes() {
    return this.all()
      .filter((n) => !n.searched)
      .filter((n) => n.depth <= this.maxDepth)
      .filter((n) => n.confidence >= this.minConfidence)
      .filter((n) => SEARCHABLE.has(n.type))
      .sort((a, b) => (b.confidence - a.confidence) || (a.depth - b.depth));
  }

  markSearched(type, value) {
    const n = this.get(type, value);
    if (n) n.searched = true;
    return n;
  }

  /** JSON-safe snapshot for the store and the dashboard. */
  toJSON() {
    return {
      seedProfileId: this.seedProfileId,
      maxDepth: this.maxDepth,
      minConfidence: this.minConfidence,
      nodes: this.all(),
      edges: this.edges,
    };
  }

  static fromJSON(data) {
    const g = new IdentityGraph({
      maxDepth: data?.maxDepth,
      minConfidence: data?.minConfidence,
      seedProfileId: data?.seedProfileId,
    });
    for (const n of data?.nodes || []) g.nodes.set(n.key, { ...n });
    g.edges = [...(data?.edges || [])];
    return g;
  }
}

/** Node types worth issuing searches for. Birth year alone is not. */
const SEARCHABLE = new Set([
  'name', 'email', 'phone', 'address', 'username', 'employer', 'relative',
  'domain', 'profile',
]);

export const FREE_EMAIL_HOSTS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'hotmail.com',
  'outlook.com', 'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com',
  'mac.com', 'protonmail.com', 'proton.me', 'gmx.com', 'mail.com', 'zoho.com',
  'yandex.com', 'fastmail.com', 'hey.com',
]);
