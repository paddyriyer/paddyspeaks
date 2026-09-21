/**
 * JobSignal — query understanding and gated ranking.
 *
 * Replaces a similarity score over shared tokens. The old engine returned
 * 3,139 results for "data engineer" with 3.6% precision, because the score was
 * a max() over terms: any title containing "engineer" scored the same as a
 * real match, so Sales Engineer and Director of Field Engineering ranked
 * alongside Senior Data Engineer.
 *
 * The fix is a HARD GATE, not better weights. A query resolves to one role
 * family; a job outside that family is not a candidate at all. Adjacency
 * (Backend Engineer, Data Platform) costs a penalty AND must evidence the
 * skills. Below threshold, a result is excluded rather than shown at the
 * bottom — zero results with an explanation beats 500 junk ones.
 *
 * `role_family` is assigned at ingest by jobsignal/pipeline/taxonomy.py, so
 * classification has one implementation, in Python, under test. This file
 * parses the query and scores candidates; it classifies nothing.
 *
 * Runs in the browser AND in node (jobs/tests/relevance.mjs) so the relevance
 * tests exercise the code that actually ships.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSSearch = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ── role families a query can resolve to ───────────────────────────── */
  var FAMILY_QUERY = [
    ['data_engineering', /\b(data engineer(?:ing)?|analytics engineer|data platform|data infrastructure|data warehouse|etl|elt|data pipeline|\bde\b)\b/i],
    ['ml_engineering',   /\b(machine learning engineer|ml engineer|ml platform|mlops|ai engineer|\bml\b|llm engineer)\b/i],
    ['data_science',     /\b(data scientist|data science|applied scientist|research scientist|\bds\b)\b/i],
    ['analytics',        /\b(data analyst|business analyst|analytics|business intelligence|\bbi\b|\bba\b)\b/i],
    ['product_management', /\b(product manager|product management|product owner|technical program manager|program manager|\bpm\b|\btpm\b|product lead)\b/i],
    ['design_ux',        /\b(ux designer|ui designer|product designer|ux researcher|user research|user experience|\bux\b|\bui\b|designer|design)\b/i],
    ['security',         /\b(security engineer|cybersecurity|cyber security|cyber|infosec|appsec|application security|security analyst|threat|penetration test)\b/i],
    ['infrastructure',   /\b(site reliability|\bsre\b|devops|platform engineer|infrastructure engineer|infrastructure|cloud engineer|kubernetes)\b/i],
    ['software_engineering', /\b(software engineer(?:ing)?|software development|\bswe\b|backend|back[- ]end|frontend|front[- ]end|full[- ]?stack|mobile engineer|ios|android|developer|programmer|engineering manager|technical lead)\b/i]
  ];

  var FAMILY_LABEL = {
    data_engineering: 'Data Engineering', data_science: 'Data Science',
    ml_engineering: 'ML Engineering', analytics: 'Analytics',
    software_engineering: 'Software Engineering', infrastructure: 'Infrastructure & SRE',
    security: 'Security', product_management: 'Product Management', design_ux: 'Design & UX'
  };

  /* Adjacency: family -> [adjacent, penalty, evidenceSkills, minHits].
     design_ux, security and product_management have none, deliberately —
     a UX query must never surface engineering. */
  var DE_SKILLS = ['spark','kafka','airflow','dbt','snowflake','bigquery','redshift','etl','elt','databricks','flink','data modeling'];
  var ML_SKILLS = ['pytorch','tensorflow','llm','nlp','machine learning','deep learning','computer vision'];
  var ADJACENCY = {
    data_engineering: [
      ['software_engineering', 0.55, DE_SKILLS, 2],
      ['analytics', 0.65, DE_SKILLS, 1],
      ['ml_engineering', 0.65, DE_SKILLS, 1]
    ],
    ml_engineering: [
      ['data_science', 0.70, ML_SKILLS, 1],
      ['software_engineering', 0.55, ML_SKILLS, 2]
    ],
    data_science: [['ml_engineering', 0.70, ML_SKILLS, 1]],
    analytics: [['data_engineering', 0.65, DE_SKILLS, 1]],
    infrastructure: [['software_engineering', 0.55, [], 0]],
    software_engineering: [['infrastructure', 0.60, [], 0]]
  };

  /* ── query parsing ──────────────────────────────────────────────────── */
  var LEVELS = [
    ['internship', /\b(intern|internship|co-?op)\b/i],
    ['entry', /\b(entry[- ]level|new grad|new graduate|university graduate|junior|jr\.?|early career|graduate)\b/i],
    ['director_plus', /\b(director|vp|vice president|head of|chief)\b/i],
    ['manager', /\b(manager|engineering manager|people manager)\b/i],
    ['senior', /\b(senior|sr\.?|staff|principal|lead)\b/i],
    ['mid', /\b(mid[- ]level|intermediate)\b/i]
  ];
  var REMOTE_RE = /\b(remote|work from home|wfh|distributed)\b/i;
  var HYBRID_RE = /\bhybrid\b/i;
  var ONSITE_RE = /\b(onsite|on[- ]site|in[- ]office)\b/i;
  var SALARY_RE = /(?:\$\s*)?(\d{2,3})\s*k\b|\$\s*(\d{3},\d{3}|\d{6})/i;

  var SKILL_VOCAB = ['python','sql','java','scala','go','rust','typescript','javascript','c++','c#',
    'ruby','kotlin','swift','spark','airflow','dbt','kafka','flink','snowflake','databricks','redshift',
    'bigquery','postgres','mysql','mongodb','dynamodb','kubernetes','docker','terraform','aws','gcp',
    'azure','pytorch','tensorflow','langchain','llm','nlp','tableau','looker','power bi','figma','react',
    'node.js','graphql','etl','elt','ci/cd'];

  /** Role words too broad to be a search on their own. */
  var GENERIC_QUERY = /^(engineer|engineering|manager|analyst|analytics|designer|design|developer|scientist|architect|lead|director|intern)$/i;

  var INDUSTRY_RE = /\b(fintech|healthtech|healthcare|gaming|ecommerce|e-commerce|devtools|cybersecurity|biotech|edtech)\b/i;

  /** Longest-match-first location gazetteer; each match is consumed. */
  var PLACES = [
    ['remote us', {remote: true, country: 'US'}],
    ['san francisco bay area', {city: 'San Francisco', region: 'CA', country: 'US'}],
    ['bay area', {city: 'San Francisco', region: 'CA', country: 'US'}],
    ['san francisco', {city: 'San Francisco', region: 'CA', country: 'US'}],
    ['new york city', {city: 'New York', region: 'NY', country: 'US'}],
    ['new york', {city: 'New York', region: 'NY', country: 'US'}],
    ['nyc', {city: 'New York', region: 'NY', country: 'US'}],
    ['pittsburgh', {city: 'Pittsburgh', region: 'PA', country: 'US'}],
    ['seattle', {city: 'Seattle', region: 'WA', country: 'US'}],
    ['austin', {city: 'Austin', region: 'TX', country: 'US'}],
    ['boston', {city: 'Boston', region: 'MA', country: 'US'}],
    ['chicago', {city: 'Chicago', region: 'IL', country: 'US'}],
    ['los angeles', {city: 'Los Angeles', region: 'CA', country: 'US'}],
    ['denver', {city: 'Denver', region: 'CO', country: 'US'}],
    ['sunnyvale', {city: 'Sunnyvale', region: 'CA', country: 'US'}],
    ['london', {city: 'London', country: 'GB'}],
    ['dublin', {city: 'Dublin', country: 'IE'}],
    ['berlin', {city: 'Berlin', country: 'DE'}],
    ['bengaluru', {city: 'Bengaluru', country: 'IN'}],
    ['bangalore', {city: 'Bengaluru', country: 'IN'}],
    ['united states', {country: 'US'}]
  ];

  function parse(query) {
    var q = String(query || '').toLowerCase().trim();
    var intent = {
      raw: q, family: '', level: '', remote: '', location: null,
      minSalary: 0, industry: '', skills: [], residual: q
    };
    if (!q) return intent;

    // Typo correction runs BEFORE anything is consumed. Otherwise the level
    // parser eats "manager" out of "prodcut manager", the product-manager
    // exception never fires on the misspelling, and the family is lost.
    var fixed = correct(q);
    if (fixed !== q) intent.corrected = fixed;

    var rest = ' ' + fixed + ' ';

    for (var i = 0; i < PLACES.length; i++) {
      var idx = rest.indexOf(' ' + PLACES[i][0] + ' ');
      if (idx !== -1) {
        var loc = PLACES[i][1];
        if (loc.remote) intent.remote = 'remote';
        intent.location = loc.city || loc.region || loc.country ? loc : null;
        rest = rest.slice(0, idx + 1) + rest.slice(idx + 1 + PLACES[i][0].length);
        break;
      }
    }

    if (!intent.remote) {
      if (HYBRID_RE.test(rest)) { intent.remote = 'hybrid'; rest = rest.replace(HYBRID_RE, ' '); }
      else if (ONSITE_RE.test(rest)) { intent.remote = 'onsite'; rest = rest.replace(ONSITE_RE, ' '); }
      else if (REMOTE_RE.test(rest)) { intent.remote = 'remote'; rest = rest.replace(REMOTE_RE, ' '); }
    }

    var sal = SALARY_RE.exec(rest);
    if (sal) {
      intent.minSalary = sal[1] ? parseInt(sal[1], 10) * 1000
                                : parseInt(String(sal[2]).replace(/,/g, ''), 10);
      rest = rest.replace(SALARY_RE, ' ');
    }

    var ind = INDUSTRY_RE.exec(rest);
    if (ind) { intent.industry = ind[1]; rest = rest.replace(INDUSTRY_RE, ' '); }

    for (var L = 0; L < LEVELS.length; L++) {
      if (LEVELS[L][1].test(rest)) {
        // "lead" and "manager" inside "Product Manager" are the role, not a level.
        if (LEVELS[L][0] === 'manager' && /\b(product|program|project)\s+manager\b/i.test(rest)) continue;
        intent.level = LEVELS[L][0];
        rest = rest.replace(LEVELS[L][1], ' ');
        break;
      }
    }

    SKILL_VOCAB.forEach(function (sk) {
      var re = new RegExp('(?:^|[^a-z0-9])' + sk.replace(/[.+*?^${}()|[\]\\]/g, '\\$&') + '(?![a-z0-9])', 'i');
      if (re.test(rest)) intent.skills.push(sk);
    });

    intent.residual = rest.replace(/\s+/g, ' ').trim();

    for (var f = 0; f < FAMILY_QUERY.length; f++) {
      if (FAMILY_QUERY[f][1].test(intent.residual || fixed)) { intent.family = FAMILY_QUERY[f][0]; break; }
    }
    // "engineer" on its own is not a search, it is a question. Rather than
    // returning the whole board, flag it so the UI can ask which kind.
    if (!intent.family && GENERIC_QUERY.test(intent.residual)) intent.ambiguous = intent.residual;
    // A level word can BE the role ("Engineering Manager"). If consuming it
    // left nothing to resolve a family from, put it back and try again.
    if (!intent.family && intent.level && fixed !== intent.residual) {
      for (var h = 0; h < FAMILY_QUERY.length; h++) {
        if (FAMILY_QUERY[h][1].test(fixed)) { intent.family = FAMILY_QUERY[h][0]; intent.level = ''; break; }
      }
    }
    return intent;
  }

  /* Typo tolerance, applied ONLY to role words against known role vocabulary.
     Never to free tokens, and never under 5 characters — that is what turns
     "designer" into "engineer". */
  var ROLE_WORDS = ['product','manager','engineer','engineering','designer','design','scientist',
    'analyst','security','developer','architect','research','researcher','platform','software',
    'machine','learning','infrastructure','reliability','cybersecurity','analytics'];

  /** Damerau-Levenshtein <= 1: substitution, insertion, deletion AND
      transposition. Transposition matters more than the rest for typing —
      "prodcut" is a swapped pair, not a substitution, and plain Levenshtein
      scores it 2 and misses it. */
  function editDistance1(a, b) {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    if (a.length === b.length) {
      var diff = [];
      for (var k = 0; k < a.length; k++) if (a[k] !== b[k]) diff.push(k);
      if (diff.length === 2 && diff[1] === diff[0] + 1 &&
          a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]]) return true;
    }
    var i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length > b.length) i++;
      else if (b.length > a.length) j++;
      else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  }

  function correct(text) {
    return String(text).split(/\s+/).map(function (w) {
      if (w.length < 5) return w;
      for (var i = 0; i < ROLE_WORDS.length; i++) {
        if (editDistance1(w, ROLE_WORDS[i])) return ROLE_WORDS[i];
      }
      return w;
    }).join(' ');
  }

  /* ── scoring components ─────────────────────────────────────────────── */
  function titleMatch(job, intent) {
    if (!intent.family) return 0.5;
    var head = String(job.role_head || '').toLowerCase();
    var title = String(job.job_title || '').toLowerCase();
    var needle = (intent.residual || intent.raw).replace(/\s+/g, ' ').trim();
    if (!needle) return 0.6;
    if (head === needle) return 1.0;
    if (head.indexOf(needle) !== -1) return 0.85;
    if (title.indexOf(needle) !== -1) return 0.70;
    var words = needle.split(' ').filter(function (w) { return w.length > 2; });
    if (!words.length) return 0.45;
    var hit = words.filter(function (w) { return head.indexOf(w) !== -1; }).length;
    if (hit === words.length) return 0.65;
    if (hit > 0) return 0.45 * (hit / words.length);
    return 0.30;
  }

  function roleMatch(job, intent, penalty) {
    var prov = job.role_family_confidence;
    var base = prov === 'head' ? 1.0 : prov === 'title' ? 0.85 : 0.60;
    return base * penalty;
  }

  function skillsMatch(job, intent) {
    if (!intent.skills.length) return 0.5;
    var have = (job.skills || []).map(function (s) { return String(s).toLowerCase(); });
    var hits = intent.skills.filter(function (s) { return have.indexOf(s) !== -1; }).length;
    return hits / intent.skills.length;
  }

  function hoursSince(iso) {
    var t = Date.parse(iso || '');
    return isNaN(t) ? Infinity : (Date.now() - t) / 3600000;
  }

  function freshness(job) {
    var h = hoursSince(job.posted_at_original || job.first_seen_at);
    if (h <= 72) return 1.0;
    if (h <= 168) return 0.8;
    if (h <= 720) return 0.6;
    if (h <= 1440) return 0.35;
    return 0.15;
  }

  function verification(job) {
    var h = hoursSince(job.last_verified_at);
    if (h === Infinity) return 0;
    if (h <= 6) return 1.0;
    if (h <= 24) return 0.7;
    return 0.4;
  }

  function locationMatch(job, intent) {
    if (!intent.location && !intent.remote) return 0.5;
    if (intent.remote === 'remote' && job.remote_status === 'remote') return 1.0;
    if (!intent.location) return job.remote_status === intent.remote ? 1.0 : 0.3;
    var l = intent.location;
    if (l.city && String(job.location_city || '').toLowerCase() === l.city.toLowerCase()) return 1.0;
    if (l.region && job.location_region === l.region) return 0.7;
    if (l.country && job.location_country === l.country) return 0.4;
    return 0;
  }

  var WEIGHTS = { title: 0.40, role: 0.25, skills: 0.15, fresh: 0.08, verify: 0.07, loc: 0.05 };
  var THRESHOLD = 0.35;

  /* ── the gate ───────────────────────────────────────────────────────── */
  function candidacy(job, intent) {
    if (!intent.family) return { ok: true, penalty: 1.0, adjacent: false };
    if (job.role_family === intent.family) return { ok: true, penalty: 1.0, adjacent: false };
    var adj = ADJACENCY[intent.family] || [];
    for (var i = 0; i < adj.length; i++) {
      if (adj[i][0] !== job.role_family) continue;
      var need = adj[i][3];
      if (need > 0) {
        var have = (job.skills || []).map(function (s) { return String(s).toLowerCase(); });
        var hits = adj[i][2].filter(function (s) { return have.indexOf(s) !== -1; }).length;
        if (hits < need) return { ok: false };
      }
      return { ok: true, penalty: adj[i][1], adjacent: true };
    }
    return { ok: false };
  }

  /** Structured predicates. A stated level or location FILTERS; it never
      merely penalises — "entry level product manager" must not return a VP. */
  function passesFilters(job, intent, f) {
    if (job.status === 'closed') return false;
    if (job.status === 'unverified' && !f.includeUnverified) return false;
    if (intent.level && job.experience_level !== intent.level) return false;
    if (intent.remote && intent.remote !== 'remote' && job.remote_status !== intent.remote) return false;
    if (intent.remote === 'remote' && !f.includeNonRemote && job.remote_status !== 'remote') return false;
    if (intent.minSalary && !(job.salary_max && job.salary_max >= intent.minSalary)) return false;
    if (intent.industry && String(job.industry || '').toLowerCase().indexOf(intent.industry) === -1) return false;
    if (intent.location && !intent.remote) {
      // "Include Remote" must ADD remote roles to the named place, not throw
      // the location away — otherwise the broadening quietly becomes a
      // nationwide search, which is exactly the silent widening §17 forbids.
      if (f.includeRemote && job.remote_status === 'remote') return true;
      // A query naming a city means that city. locationMatch() scores a
      // same-country job 0.4, which is not nothing — so testing "> 0" let
      // every US role through for "data engineer pittsburgh". Radius is an
      // explicit broadening (§17), never a silent one.
      var L = intent.location;
      if (L.city) {
        if (String(job.location_city || '').toLowerCase() !== L.city.toLowerCase()) return false;
      } else if (L.region) {
        if (job.location_region !== L.region) return false;
      } else if (L.country) {
        if (job.location_country !== L.country) return false;
      }
    }
    if (f.level && job.experience_level !== f.level) return false;
    if (f.remote && job.remote_status !== f.remote) return false;
    if (f.company && job.company_slug !== f.company) return false;
    if (f.employment && job.employment_type !== f.employment) return false;
    if (f.family && job.role_family !== f.family) return false;
    if (f.verified6h && hoursSince(job.last_verified_at) > 6) return false;
    if (f.fresh72 && hoursSince(job.posted_at_original || job.first_seen_at) > 72) return false;
    if (f.postedDays && hoursSince(job.posted_at_original || job.first_seen_at) > f.postedDays * 24) return false;
    if (f.salaryOnly && !(job.salary_min && job.salary_max)) return false;
    if (f.minSalary && !(job.salary_max && job.salary_max >= f.minSalary)) return false;
    if (f.directOnly && (job.apply_hops || 0) > 0) return false;
    if (f.hideStaffing && job.is_staffing_firm) return false;
    if (f.hideReposted && (job.repost_count || 0) > 0) return false;
    if (f.visa && job.visa_sponsorship !== 'mentioned') return false;
    if (f.clearanceFree && job.security_clearance === 'mentioned') return false;
    return true;
  }

  function run(jobs, filters) {
    var f = filters || {};
    var intent = parse(f.q);
    var out = [];
    for (var i = 0; i < jobs.length; i++) {
      var job = jobs[i];
      var cand = candidacy(job, intent);
      if (!cand.ok) continue;
      if (!passesFilters(job, intent, f)) continue;
      // No family resolved: fall back to a real lexical match on the title,
      // so free text still works without the gate letting everything through.
      if (!intent.family && intent.residual) {
        var hay = (job.job_title + ' ' + job.company_name + ' ' + (job.skills || []).join(' ')).toLowerCase();
        if (hay.indexOf(intent.residual) === -1) continue;
      }

      var parts = {
        title: titleMatch(job, intent),
        role: roleMatch(job, intent, cand.penalty),
        skills: skillsMatch(job, intent),
        fresh: freshness(job),
        verify: verification(job),
        loc: locationMatch(job, intent)
      };
      var score = parts.title * WEIGHTS.title + parts.role * WEIGHTS.role +
                  parts.skills * WEIGHTS.skills + parts.fresh * WEIGHTS.fresh +
                  parts.verify * WEIGHTS.verify + parts.loc * WEIGHTS.loc;
        if (score < THRESHOLD) continue;
      job._score = Math.round(score * 1000) / 1000;
      job._parts = parts;
      job._adjacent = !!cand.adjacent;
      out.push(job);
    }

    var sort = f.sort;
    if (sort === 'newest') out.sort(function (a, b) { return anchor(b) - anchor(a); });
    else if (sort === 'verified') out.sort(function (a, b) { return Date.parse(b.last_verified_at || 0) - Date.parse(a.last_verified_at || 0); });
    else if (sort === 'salary') out.sort(function (a, b) { return (b.salary_max || 0) - (a.salary_max || 0); });
    else out.sort(function (a, b) { return b._score - a._score || anchor(b) - anchor(a); });

    out._intent = intent;
    if (intent.ambiguous) {
      // Report which families the word spans so the UI can offer them, then
      // cap: an ambiguous word must never dump the board on the page.
      var counts = {};
      out.forEach(function (j) { counts[j.role_family] = (counts[j.role_family] || 0) + 1; });
      out._families = counts;
      out._truncated = out.length > 200;
      if (out._truncated) out.length = 200;
    }
    return out;
  }

  function anchor(job) {
    var t = Date.parse(job.posted_at_original || job.first_seen_at || '');
    return isNaN(t) ? 0 : t;
  }

  return {
    run: run, parse: parse, correct: correct,
    FAMILY_LABEL: FAMILY_LABEL, ADJACENCY: ADJACENCY,
    THRESHOLD: THRESHOLD, WEIGHTS: WEIGHTS
  };
});
