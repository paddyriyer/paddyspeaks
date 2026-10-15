/* PIN-L3-05 — Creator weekly metrics, each pin credited by the domain claim in force at the
   event time (SQL). Simulated practice scenario. Every creator, domain, pin and event is
   generated from the seed and is hypothetical; domains use the reserved `.example` suffix.

   One deterministic result set: one row per (creator_id, week_start) with at least one
   credited impression, save or outbound click, carrying
     impressions, saves, outbound_clicks   counts of credited events of each type.
   An event is credited to the creator whose claim on the pin's link host is in force at the
   event's occurred_at: claimed_at <= occurred_at < released_at (released_at NULL = open).
   week_start is the Monday of the event's UTC week. Closeups are never counted.
   level: 1 Medium (exact host match on normalised hosts; claims starting late, a domain
                    transferred at one instant, pins created before their domain's claim,
                    boundary events at claimed_at / released_at and at week edges,
                    a creator whose only events in a week are closeups, pins with no link)
          2 Hard (+ raw hosts: capitals and a leading www., a claim that lapses and is
                  re-verified by the same creator with a gap, a claim released for good)
          3 Very Hard (+ claims cover subdomains, the most specific claim in force wins,
                       a subdomain claimed by another creator, a look-alike host that only
                       ends with the claimed name) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const H = 3600, D = 86400, W = 7 * D;
const BASE = Date.UTC(2026, 8, 14) / 1000;                      // Monday 2026-09-14 00:00 UTC
const SITES = ["maplecrafts", "tidekitchen", "linenloom", "slowgarden", "paperfox", "hearthbakes", "copperkettle",
  "wildfernhome", "bluepinedesign", "quietroomdecor", "saltandsage", "pebblepaths", "fernandfig", "loomandlinen"];
const SUBS = ["shop", "blog", "recipes", "patterns"];
const TYPES = ["impression", "impression", "impression", "impression", "closeup", "closeup", "save", "save", "outbound_click", "outbound_click"];

const iso = (sec) => new Date((BASE + sec) * 1000).toISOString().slice(0, 10);
const stamp = (sec) => ts(iso(sec), ((sec % D) + D) % D);
const norm = (h) => h.toLowerCase().replace(/^www\./, "");

export function generate(r, level) {
  const weeks = r.int(3, 4);
  const END = weeks * W;                                         // events lie in [0, END)
  const kinds = ["stable", "late", "transfer", "quiet"];
  if (level >= 2) kinds.push("lapse");
  if (level === 3 && r.chance(0.5)) kinds.push(r.pick(["released", "stable2"]));
  if (level === 2 && r.chance(0.5)) kinds.push("released");
  const order = r.shuffle(kinds);
  const sites = r.sample(SITES, order.length + 1);
  const unclaimed = sites[order.length] + ".example";

  // Creators: a pool for the ordinary domains, and one creator of their own for "quiet".
  const ids = r.sample(Array.from({ length: 900 }, (_, i) => i + 100), 8).map((n) => "cr_" + n);
  const quietCreator = ids[7];
  const pool = ids.slice(0, Math.max(3, order.length - 2));

  const claims = [], pins = [], events = [];
  const doms = {};
  const claim = (creator, domain, from, to = null) => { const c = { creator, domain, from, to }; claims.push(c); return c; };
  const early = () => -r.int(5, 60) * D - r.int(0, D - 1);
  const pin = (host, created) => { const p = { host, created, ev: [] }; pins.push(p); return p; };
  const ev = (p, type, at) => { const e = { p, type, at }; events.push(e); p.ev.push(e); return e; };
  const creditable = () => r.pick(["impression", "save", "outbound_click"]);

  order.forEach((kind, i) => {
    const domain = sites[i] + ".example";
    const d = { kind, domain, pins: [] };
    doms[kind] = d;
    const A = kind === "quiet" ? quietCreator : r.pick(pool);
    if (kind === "stable" || kind === "stable2") claim(A, domain, early());
    else if (kind === "late") d.t = r.int(D, END - 2 * D), claim(A, domain, d.t);
    else if (kind === "transfer") {
      d.t = r.int(2 * D, END - 2 * D);
      const B = r.pick(pool.filter((x) => x !== A));
      claim(A, domain, early(), d.t);
      claim(B, domain, d.t);                                     // the new owner from the same instant
    } else if (kind === "lapse") {
      d.t = r.int(D, END - 4 * D);
      d.t2 = d.t + r.int(2 * H, 2 * D);
      claim(A, domain, early(), d.t);
      claim(A, domain, d.t2);                                    // re-verified after a gap
    } else if (kind === "released") {
      d.t = r.int(D, END - D);
      claim(A, domain, early(), d.t);
    } else if (kind === "quiet") {
      d.t = (weeks - 1) * W + r.int(D, 3 * D);                   // claimed in the last week
      claim(A, domain, d.t);
    }
    const nPins = level === 1 ? 2 : r.int(2, 3);
    for (let k = 0; k < nPins; k++) d.pins.push(pin(domain, r.int(-30 * D, END - 3 * D)));
  });

  // Forced shapes.
  const st = doms.stable, lt = doms.late, tr = doms.transfer, q = doms.quiet;
  q.pins[0].created = Math.min(q.pins[0].created, q.t - r.int(H, 3 * D));   // live before its claim
  st.pins[0].created = -r.int(D, 20 * D);                         // live before the first week
  lt.pins[0].created = lt.t - r.int(D, 10 * D);                    // created before its domain was claimed
  if (lt.pins[0].created < -30 * D) lt.pins[0].created = -30 * D;
  tr.pins[0].created = Math.min(tr.pins[0].created, tr.t - r.int(H, 5 * D));

  // Pins with no link, and a pin on a domain nobody claims.
  pin(null, r.int(-10 * D, END - 3 * D));
  pin(null, r.int(-10 * D, END - 3 * D));
  pin(unclaimed, r.int(-10 * D, END - 3 * D));

  // Level 3: a subdomain claimed by someone else, an unclaimed subdomain, and a look-alike host.
  let sub = null, subPin = null, blogPin = null, lookPin = null;
  if (level === 3) {
    const [s1, s2] = r.sample(SUBS, 2);
    sub = { domain: s1 + "." + st.domain };
    sub.from = r.int(D, Math.floor(END / 2));
    sub.to = r.chance(0.5) ? r.int(sub.from + 2 * D, END - D) : null;
    claim(r.pick(pool.filter((x) => x !== claims.find((c) => c.domain === st.domain).creator)), sub.domain, sub.from, sub.to);
    subPin = pin(sub.domain, r.int(-10 * D, sub.from - H));
    pin(sub.domain, r.int(-10 * D, END - 3 * D));
    blogPin = pin(s2 + "." + st.domain, r.int(-10 * D, END - 3 * D));
    lookPin = pin(r.pick(["the", "my", "new"]) + st.domain, r.int(-10 * D, END - 3 * D));
  }

  // Ordinary traffic: every pin gets events after it was created.
  const perPin = level === 1 ? [3, 6] : [3, 7];
  for (const p of pins) {
    const lo = Math.max(p.created + 1, 0);
    const n = r.int(perPin[0], perPin[1]);
    for (let k = 0; k < n; k++) {
      const at = r.int(lo, END - 1);
      let type = r.pick(TYPES);
      if (p.host === q.domain && at >= q.t) type = "closeup";    // the quiet creator's week holds only closeups
      ev(p, type, at);
    }
  }

  // Edge events.
  ev(lt.pins[0], creditable(), lt.t);                             // exactly at claimed_at: credited
  ev(lt.pins[0], creditable(), r.int(Math.max(lt.pins[0].created + 1, 0), lt.t - 1)); // before the claim: nobody
  ev(lt.pins[0], creditable(), r.int(lt.t + 1, END - 1));          // after the claim, pin older than it
  ev(tr.pins[0], creditable(), tr.t);                             // at the transfer instant: the new owner only
  ev(tr.pins[0], creditable(), r.int(tr.t + 1, END - 1));          // after the transfer on an older pin
  ev(tr.pins[0], creditable(), r.int(Math.max(tr.pins[0].created + 1, 0), tr.t - 1));
  const k = r.int(1, weeks - 1);
  ev(st.pins[0], creditable(), k * W);                            // Monday 00:00:00 UTC: the new week
  ev(st.pins[0], creditable(), k * W - 1);                        // Sunday 23:59:59 UTC: the old week
  ev(q.pins[0], "closeup", r.int(q.t, END - 1));                  // a closeup the quiet creator gets no row for
  ev(q.pins[0], creditable(), r.int(Math.max(q.pins[0].created + 1, 0), q.t - 1)); // before the quiet claim
  if (level >= 2) {
    const lp = doms.lapse;
    const p = lp.pins.find((x) => x.created < lp.t) || lp.pins[0];
    p.created = Math.min(p.created, lp.t - H);
    ev(p, creditable(), r.int(lp.t, lp.t2 - 1));                   // inside the gap: nobody
    ev(p, creditable(), lp.t2);                                    // at the re-verification: credited again
  }
  if (level === 3) {
    ev(subPin, creditable(), r.int(sub.from, (sub.to ?? END) - 1)); // both claims in force: the subdomain's wins
    ev(subPin, creditable(), r.int(Math.max(subPin.created + 1, 0), sub.from - 1)); // before it: the parent's
    ev(blogPin, creditable(), r.int(Math.max(blogPin.created + 1, 0), END - 1));     // unclaimed subdomain: parent
    ev(lookPin, creditable(), r.int(Math.max(lookPin.created + 1, 0), END - 1));     // look-alike: nobody
  }

  // Raw hosts (level 2+): capitals and a leading www. on some links, forced on credited pins.
  for (const p of pins) p.raw = p.host;
  if (level >= 2) {
    const cap = (h) => h.split(".").map((x, i) => (i === 0 || r.chance(0.3) ? x[0].toUpperCase() + x.slice(1) : x)).join(".");
    for (const p of pins) {
      if (p.host === null) continue;
      if (r.chance(0.35)) p.raw = "www." + p.raw;
      if (r.chance(0.3)) p.raw = cap(p.raw);
    }
    st.pins[0].raw = "www." + st.pins[0].host;
    tr.pins[0].raw = r.chance(0.5) ? "WWW." + tr.pins[0].host.toUpperCase() : cap(tr.pins[0].host);
    if (tr.pins[0].raw === tr.pins[0].host) tr.pins[0].raw = tr.pins[0].host.toUpperCase();
  }

  // Ids: claims by start, pins by creation, events by time.
  const cs = claims.map((c, i) => ({ c, i })).sort((a, b) => a.c.from - b.c.from || a.i - b.i).map((x) => x.c);
  let cn = 10 + r.int(0, 80);
  for (const c of cs) c.id = "clm_" + cn++;
  for (const c of cs) c.latest = !cs.some((o) => o.domain === c.domain && o.from > c.from);
  const ps = pins.map((p, i) => ({ p, i })).sort((a, b) => a.p.created - b.p.created || a.i - b.i).map((x) => x.p);
  let pn = 7000 + r.int(0, 2000);
  for (const p of ps) p.id = "pin_" + (pn += r.int(1, 40));
  const es = events.map((e, i) => ({ e, i })).sort((a, b) => a.e.at - b.e.at || a.i - b.i).map((x) => x.e);
  let en = 50000 + r.int(0, 30000);
  for (const e of es) e.id = "ev_" + en++;

  // The oracle. Each option breaks one rule, for diagnostics.
  const compute = (o = {}) => {
    const agg = new Map();
    for (const e of es) {
      if (e.type === "closeup" && !o.zeroRows) continue;
      let who = [];
      if (e.p.raw !== null) {
        const h = o.noNorm ? e.p.raw : norm(e.p.raw);
        const t = o.atCreation ? e.p.created : e.at;
        const inForce = (c) => {
          if (o.latest) return c.latest;
          const start = o.strictStart ? c.from < t : c.from <= t;
          const end = c.to === null || (o.inclEnd ? t <= c.to : t < c.to);
          return start && end;
        };
        const match = (c) => c.domain === h ||
          (level === 3 && !o.exactOnly && (o.noDot ? h.endsWith(c.domain) : h.endsWith("." + c.domain)));
        let ms = cs.filter((c) => match(c) && inForce(c));
        if (ms.length && !o.allMatches) {
          const lens = ms.map((c) => c.domain.length);
          const best = o.leastSpecific ? Math.min(...lens) : Math.max(...lens);
          ms = ms.filter((c) => c.domain.length === best);
        }
        who = ms.map((c) => c.creator);
      }
      if (!who.length) {
        if (!o.nullRows) continue;
        who = [null];
      }
      const wk = o.sunday ? iso(Math.floor((e.at + D) / W) * W - D) : iso(Math.floor(e.at / W) * W);
      for (const cr of who) {
        const key = JSON.stringify([cr, wk]);
        if (!agg.has(key)) agg.set(key, [0, 0, 0]);
        const a = agg.get(key);
        if (e.type === "impression") a[0]++;
        else if (e.type === "save") a[1]++;
        else if (e.type === "outbound_click") a[2]++;
      }
    }
    return [...agg.entries()].map(([k, a]) => [...JSON.parse(k), ...a]).sort((x, y) => {
      if (x[0] !== y[0]) return x[0] === null ? 1 : y[0] === null ? -1 : x[0] < y[0] ? -1 : 1;
      return x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0;
    });
  };
  const expected = compute();

  const diagnostics = [
    { message: "Pins were credited by the claim in force when the pin was created. Credit is decided per event: a pin created before its domain was claimed earns credit from the moment the claim starts, and a pin's later events follow the domain to its new owner.", rows: compute({ atCreation: true }) },
    { message: "Every event was credited to the domain's latest claim. A domain can change hands or lapse; each event goes to the claim in force at its occurred_at, so the previous owner keeps the events from their own time.", rows: compute({ latest: true }) },
    { message: "An event exactly at released_at was credited to the claim that had just ended. A claim is in force while occurred_at < released_at; when a new claim starts at that instant, only the new one is credited.", rows: compute({ inclEnd: true }) },
    { message: "An event exactly at claimed_at was not credited. A claim is in force from claimed_at inclusive.", rows: compute({ strictStart: true }) },
    { message: "Weeks were started on Sunday. week_start is the Monday of the event's UTC week (date_trunc('week', …) in PostgreSQL): Sunday 23:59:59 belongs to the week that began six days earlier, Monday 00:00:00 to the new week.", rows: compute({ sunday: true }) },
    { message: "Rows with all three counts at 0 appeared: closeup events (or uncounted event types) still created a creator-week row. Filter the event types before grouping; a creator-week with only closeups has no row.", rows: compute({ zeroRows: true }) },
    { message: "Uncredited events produced rows with a NULL creator_id. Events on pins without a link, or with no claim in force, are credited to nobody; an outer join that keeps them adds a row per week for no creator.", rows: compute({ nullRows: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Link hosts were compared as stored. Hosts carry capitals and a leading www.; compare lower(link_host) with one leading 'www.' removed, or those pins earn nothing.", rows: compute({ noNorm: true }) });
  }
  if (level === 3) {
    diagnostics.push(
      { message: "Only exact host matches were credited. A claim covers its subdomains: a host that ends with '.' followed by the claimed domain is covered when no more specific claim is in force.", rows: compute({ exactOnly: true }) },
      { message: "An event on a subdomain was credited to both the subdomain's claim and the parent domain's claim. Pick one claim per event, the most specific (longest) domain in force, before aggregating.", rows: compute({ allMatches: true }) },
      { message: "The parent domain's claim won over a more specific subdomain claim. When both are in force, the longest claimed domain wins.", rows: compute({ leastSpecific: true }) },
      { message: "A look-alike host was credited: a suffix test without the dot (LIKE '%' || domain) lets a host that merely ends with the claimed name match. Require host = domain or a suffix of '.' || domain.", rows: compute({ noDot: true }) },
    );
  }

  const cCols = ["claim_id", "creator_id", "domain", "claimed_at", "released_at"];
  const pCols = ["pin_id", "link_host", "created_at"];
  const eCols = ["event_id", "pin_id", "event_type", "occurred_at"];
  const cRows = cs.map((c) => [c.id, c.creator, c.domain, stamp(c.from), c.to === null ? null : stamp(c.to)]);
  const pRows = ps.map((p) => [p.id, p.raw, stamp(p.created)]);
  const eRows = es.map((e) => [e.id, e.p.id, e.type, stamp(e.at)]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE domain_claims (\n  claim_id TEXT PRIMARY KEY,\n  creator_id TEXT NOT NULL,\n  domain TEXT NOT NULL,\n  claimed_at TIMESTAMPTZ NOT NULL,\n  released_at TIMESTAMPTZ,\n  CHECK (released_at IS NULL OR released_at > claimed_at)\n);\n" +
    "CREATE TABLE pins (\n  pin_id TEXT PRIMARY KEY,\n  link_host TEXT,\n  created_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE pin_events (\n  event_id TEXT PRIMARY KEY,\n  pin_id TEXT NOT NULL REFERENCES pins (pin_id),\n  event_type TEXT NOT NULL CHECK (event_type IN ('impression','closeup','save','outbound_click')),\n  occurred_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("domain_claims", cCols, cRows) + insertSQL("pins", pCols, pRows) + insertSQL("pin_events", eCols, eRows);

  return {
    vars: {
      weeks,
      first_monday: iso(0),
      claims: cRows.length,
      pins: pRows.length,
      events: eRows.length,
      host_rule: level === 1
        ? "`pins.link_host` is the host of the pin's link (NULL when the pin has no link), stored lower-case without a leading `www.`, exactly as `domain_claims.domain` is."
        : "`pins.link_host` is the host as it appears in the pin's link (NULL when the pin has no link), so it can carry capital letters and a leading `www.`: compare it in lower case with one leading `www.` removed. `domain_claims.domain` is already stored that way.",
      match_rule: level === 3
        ? "A claim also covers the domain's subdomains: a host is covered by a claim when it equals the claimed domain or ends with `.` followed by it (`shop.loomworks.example` is covered by a claim on `loomworks.example`; `myloomworks.example` is not). When claims on a domain and on one of its subdomains are both in force, only the most specific claim (the longest claimed domain) is credited."
        : "A host is covered by a claim only when it equals the claimed domain; in this exercise subdomains are not covered.",
    },
    setup,
    tables: [
      { name: "domain_claims", columns: cCols, rows: cRows },
      { name: "pins", columns: pCols, rows: pRows },
      { name: "pin_events", columns: eCols, rows: eRows },
    ],
    expected: { columns: ["creator_id", "week_start", "impressions", "saves", "outbound_clicks"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
