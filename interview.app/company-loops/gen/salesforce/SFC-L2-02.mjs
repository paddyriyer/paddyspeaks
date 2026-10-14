/* SFC-L2-02 — Matching new leads to accounts by email domain (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, written independently of the evaluator's
   reference: for every lead it compares the lead's domain with every account
   domain and every public domain (the O(leads · domains) method the timing test
   rules out). The reference looks up each suffix of the lead's domain, label by
   label, in a dict.
   level: 1 Medium (parent domains and subdomains, one public domain list)
          · 2 Hard (+ nested account subdomains, mixed case and spaces, look-alike
            domains that share letters but not a label boundary)
          · 3 Very Hard (+ domains claimed by two accounts, malformed emails,
            several @ signs, subdomains of public domains) */
export const kind = "python";
export const entry = "match_leads";
export const signature = "def match_leads(accounts: list[tuple[str, list[str]]], leads: list[str], public_domains: list[str]) -> list[str | None]:";
export const starter = `def match_leads(accounts, leads, public_domains):
    """accounts: [(account_id, [domains])]. leads: [email]. public_domains: [domain].
    Return, per lead, the id of the account owning the longest matching domain,
    or None (no match, public domain, ambiguous, or malformed email)."""
    ...
`;

export const prelude = `
def _gen_domains(n_accounts, n_leads, seed):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    tlds = ['com', 'io', 'co.uk', 'de', 'com.au', 'net', 'fr']
    accounts = []
    for i in range(n_accounts):
        base = 'org%d.%s' % (i, tlds[rnd(len(tlds))])
        doms = [base]
        for s in range(rnd(3)):
            doms.append('%s.%s' % (('emea', 'apac', 'sales', 'us', 'eng')[rnd(5)], base))
        accounts.append(('001A%011d' % i, doms))
    for k in range(n_accounts // 50):               # some domains claimed twice
        j = rnd(n_accounts)
        accounts.append(('001B%011d' % k, [accounts[j][1][-1]]))
    public = ['gmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'proton.me', 'hotmail.co.uk']
    leads = []
    for i in range(n_leads):
        k = rnd(10)
        if k == 0:
            leads.append('person%d@%s' % (i, public[rnd(len(public))]))
        elif k == 1:
            leads.append('person%d@unknown%d.com' % (i, rnd(1000000)))
        else:
            a = accounts[rnd(n_accounts)][1]
            d = a[rnd(len(a))]
            pre = ('', 'mail.', 'eu.west.', 'hq.')[rnd(4)]
            leads.append('Person%d@%s%s' % (i, pre, d.upper() if rnd(5) == 0 else d))
    return accounts, leads, public
`.trim() + "\n";

// The specification, implemented independently of the Python reference.
const under = (d, root) => d === root || d.endsWith("." + root);
export function oracle(accounts, leads, publicDomains) {
  const claims = [];                         // [domain, account id]
  for (const [id, doms] of accounts) for (const d of doms) claims.push([d.trim().toLowerCase(), id]);
  const pubs = publicDomains.map((d) => d.trim().toLowerCase());
  return leads.map((email) => {
    const e = email.trim();
    const at = e.lastIndexOf("@");
    if (at < 0) return null;
    const d = e.slice(at + 1).toLowerCase();
    if (!d) return null;
    if (pubs.some((p) => under(d, p))) return null;
    let best = "";
    for (const [cd] of claims) if (under(d, cd) && cd.length > best.length) best = cd;
    if (!best) return null;
    const owners = new Set(claims.filter(([cd]) => cd === best).map(([, id]) => id));
    return owners.size === 1 ? [...owners][0] : null;
  });
}

const q = (s) => "'" + s.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
const pyArgs = (accounts, leads, pubs) =>
  "([" + accounts.map(([id, ds]) => `(${q(id)}, [${ds.map(q).join(", ")}])`).join(", ") + "], [" +
  leads.map(q).join(", ") + "], [" + pubs.map(q).join(", ") + "])";
const pyOut = (xs) => "[" + xs.map((x) => (x === null ? "None" : q(x))).join(", ") + "]";

const COMPANIES = ["acme", "globex", "initech", "umbrella", "hooli", "vandelay", "wonka", "stark-industries",
  "wayne-ent", "tyrell", "cyberdyne", "soylent", "massive-dynamic", "aperture", "oscorp", "gringotts"];
const TLDS = ["com", "io", "co.uk", "de", "com.au", "fr", "net"];
const SUBS = ["emea", "apac", "us", "sales", "eng", "support", "fr", "latam"];
const PUBLIC = ["gmail.com", "outlook.com", "yahoo.com", "icloud.com", "proton.me", "hotmail.co.uk", "gmx.de"];
const PEOPLE = ["ana", "bo.chen", "carla", "dev", "eli", "fatima", "gus", "hana", "ivo", "jun", "kemi", "lars"];
const ALNUM = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789".split("");
const acctId = (r) => "001" + Array.from({ length: 12 }, () => r.pick(ALNUM)).join("");

function randomCase(r, level) {
  const names = r.sample(COMPANIES, level === 1 ? 4 : 6);
  const accounts = names.map((n) => {
    const base = n + "." + r.pick(TLDS);
    const doms = [base];
    if (r.chance(0.6)) doms.push(r.pick(SUBS) + "." + base);
    return [acctId(r), doms];
  });
  if (level >= 2) {                               // a regional account owns a subdomain of another's domain
    const parent = accounts[0][1][0];
    accounts.push([acctId(r), [r.pick(SUBS) + "." + parent]]);
  }
  if (level === 3) {                              // a domain claimed by two accounts
    accounts.push([acctId(r), [accounts[1][1][accounts[1][1].length - 1]]]);
  }
  const pubs = r.sample(PUBLIC, 3);
  const leads = [];
  const n = level === 1 ? r.int(5, 6) : r.int(7, 9);
  for (let i = 0; i < n; i++) {
    const who = r.pick(PEOPLE);
    const roll = r.next();
    if (roll < 0.15) leads.push(`${who}@${r.pick(pubs)}`);
    else if (roll < 0.25) leads.push(`${who}@${r.pick(["lumon", "dunder", "nakatomi", "prestige"])}.${r.pick(TLDS)}`);
    else if (level >= 2 && roll < 0.33) leads.push(`${who}@my${r.pick(names)}.com`);     // look-alike, no label boundary
    else if (level === 3 && roll < 0.38) leads.push(r.pick([`${who}.example`, `${who}@`, `"${who}@x"@${r.pick(accounts)[1][0]}`]));
    else {
      const acc = r.pick(accounts);
      let d = r.pick(acc[1]);
      if (r.chance(0.35)) d = r.pick(SUBS) + "." + d;
      let email = `${who}@${d}`;
      if (level >= 2 && r.chance(0.25)) email = " " + who[0].toUpperCase() + who.slice(1) + "@" + d.toUpperCase() + " ";
      leads.push(email);
    }
  }
  return { accounts, leads, pubs };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    let c, got;
    for (let t = 0; t < 50; t++) {
      c = randomCase(r, level);
      got = oracle(c.accounts, c.leads, c.pubs);
      if (got.filter((x) => x !== null).length >= 2 && got.some((x) => x === null)) break;
    }
    samples.push({ args: pyArgs(c.accounts, c.leads, c.pubs), expect: pyOut(got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [A, B, C] = [acctId(r), acctId(r), acctId(r)];
  const co = r.pick(COMPANIES), tld = r.pick(TLDS), sub = r.pick(SUBS);
  const dom = co + "." + tld;
  const pub = r.pick(PUBLIC);
  const edges = [
    ["a subdomain matches the account that owns its parent domain", [[A, [dom]]], [`x@${sub}.${dom}`, `y@${dom}`], [pub]],
    ["the longest matching domain wins", [[A, [dom]], [B, [`${sub}.${dom}`]]], [`x@hq.${sub}.${dom}`, `y@${sub}.${dom}`, `z@other.${dom}`], [pub]],
    ["a suffix must start at a label boundary", [[A, [dom]]], [`x@not${dom}`, `y@${dom}.evil.net`], [pub]],
    ["a public email domain never matches, even when an account lists it", [[A, [pub, dom]]], [`x@${pub}`, `y@${dom}`], [pub]],
    ["a domain listed twice by the same account is not ambiguous", [[A, [dom, dom]]], [`x@${dom}`], [pub]],
    ["case and surrounding spaces do not matter", [[A, [" " + dom.toUpperCase()]]], [`  Pat@${sub.toUpperCase()}.${dom} `], [pub]],
    ["an email with no domain does not match", [[A, [dom]]], [`pat.${dom}`, "pat@", dom], [pub]],
    ["no public domains at all", [[A, [dom]]], [`x@${dom}`], []],
  ];
  if (level >= 2) {
    edges.push(["the longest match is not always the first or the last listed", [[B, [`${sub}.${dom}`]], [A, [dom]], [C, [`deep.${sub}.${dom}`]]], [`a@deep.${sub}.${dom}`, `b@x.${sub}.${dom}`, `c@${dom}`], [pub]]);
    edges.push(["a public domain is matched case-insensitively too", [[A, [dom]]], [`x@${pub.toUpperCase()}`], [" " + pub.toUpperCase()]]);
  }
  if (level === 3) {
    edges.push(["two accounts claiming the longest domain make the lead ambiguous, with no fallback",
      [[A, [dom]], [B, [`${sub}.${dom}`]], [C, [`${sub}.${dom}`]]], [`x@eu.${sub}.${dom}`, `y@${dom}`], [pub]]);
    edges.push(["the domain is the text after the last @", [[A, [dom]], [B, ["gmail-relay.net"]]], [`"pat@gmail-relay.net"@${dom}`], [pub]]);
    edges.push(["a subdomain of a public domain is public too", [[A, [`uk.${pub}`]]], [`x@uk.${pub}`], [pub]]);
  }
  for (const [name, a, l, p] of edges) tests.push({ name, args: pyArgs(a, l, p), expect: pyOut(oracle(a, l, p)) });

  // Timing: 40,000 accounts (about 80,000 domains) and 150,000 leads. Suffix lookups
  // cost O(labels) per lead; comparing every lead with every domain is O(leads · domains).
  tests.push({
    name: "40,000 accounts and 150,000 leads (suffix lookups, not a scan of every domain)",
    args: `_gen_domains(40000, 150000, ${r.int(1, 1_000_000)})`,
    limit_s: 8,
  });

  return {
    vars: {
      data_rule: level === 1
        ? "In this exercise's samples each account lists a domain and perhaps one subdomain of it."
        : level === 2
          ? "Regional accounts can own a subdomain of another account's domain, emails arrive in mixed case with stray spaces, and some domains only look like an account's domain."
          : "Regional accounts can own subdomains of other accounts' domains, two accounts can claim the same domain, and the feed carries malformed emails and addresses with more than one @.",
    },
    samples,
    tests,
  };
}
