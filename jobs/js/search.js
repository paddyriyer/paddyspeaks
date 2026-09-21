/**
 * JobSignal — query parsing, matching, filtering and ranking.
 *
 * Runs entirely in the browser over the committed index. Fast enough at MVP
 * scale (a few thousand roles) that a keystroke re-ranks without a spinner;
 * docs/JOBSIGNAL.md records the threshold at which this moves behind a Worker.
 *
 * Ranking order is fixed in code and takes no input that a payment could touch:
 * verified first, then the strongest query match, then the newest ORIGINAL
 * posting. There is no bid, no boost and no sponsored parameter to pass.
 */
(function (global) {
  'use strict';

  /* ── synonyms: what people type -> what employers title it ────────── */
  var SYNONYMS = {
    pm: ['product manager', 'product owner', 'technical product manager', 'program manager'],
    'product manager': ['product owner', 'technical product manager'],
    tpm: ['technical program manager', 'technical product manager'],
    ux: ['ux designer', 'product designer', 'ux researcher', 'user experience'],
    'ui': ['ux designer', 'product designer', 'interface designer'],
    designer: ['product designer', 'ux designer', 'visual designer'],
    de: ['data engineer'],
    'data engineer': ['analytics engineer', 'data platform engineer', 'data infrastructure'],
    ds: ['data scientist'],
    'data scientist': ['research scientist', 'applied scientist', 'machine learning'],
    ml: ['machine learning engineer', 'ml engineer', 'mlops'],
    ai: ['machine learning', 'artificial intelligence', 'ai engineer', 'llm'],
    swe: ['software engineer', 'software development engineer'],
    'software engineer': ['software development engineer', 'backend engineer', 'full stack'],
    sre: ['site reliability engineer', 'infrastructure engineer', 'platform engineer'],
    devops: ['site reliability engineer', 'platform engineer', 'infrastructure'],
    ba: ['business analyst', 'data analyst'],
    analyst: ['data analyst', 'business analyst', 'analytics'],
    sec: ['security engineer', 'cybersecurity', 'application security'],
    infosec: ['security engineer', 'cybersecurity', 'security analyst'],
    qa: ['quality engineer', 'test engineer', 'sdet'],
    em: ['engineering manager'],
    'new grad': ['university graduate', 'early career', 'entry level', 'graduate'],
    grad: ['university graduate', 'early career', 'entry level'],
  };

  var STOP = { the: 1, a: 1, an: 1, of: 1, for: 1, and: 1, in: 1, at: 1, to: 1, with: 1, jobs: 1, job: 1, role: 1, roles: 1 };

  function tokenise(text) {
    return String(text || '').toLowerCase()
      .replace(/[^a-z0-9+#./ -]+/g, ' ')
      .split(/[\s\-]+/)
      .filter(function (t) { return t && !STOP[t]; });
  }

  /** Expand a query into the terms an employer might actually have used. */
  function expand(query) {
    var raw = String(query || '').toLowerCase().trim();
    var terms = {};
    function add(t, weight) {
      if (!t) return;
      terms[t] = Math.max(terms[t] || 0, weight);
    }
    if (SYNONYMS[raw]) SYNONYMS[raw].forEach(function (s) { add(s, 0.75); });
    add(raw, 1);
    tokenise(raw).forEach(function (t) {
      add(t, 0.9);
      (SYNONYMS[t] || []).forEach(function (s) { add(s, 0.6); });
    });
    return terms;
  }

  /**
   * Damerau-ish edit distance, bounded at 1. Enough to forgive "enginer" or
   * "manger"; deliberately not enough to turn "designer" into "engineer".
   */
  function near(a, b) {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    if (a.length < 5 || b.length < 5) return false;
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

  function haystack(job) {
    if (job._hay) return job._hay;
    job._hay = [
      job.job_title, job.company_name, job.department,
      (job.skills || []).join(' '), job.location,
    ].join(' ').toLowerCase();
    job._titleTokens = tokenise(job.job_title);
    return job._hay;
  }

  /** Query relevance in [0,1]. 0 means "did not match and must be dropped". */
  function relevance(job, terms) {
    var keys = Object.keys(terms);
    if (!keys.length) return 1;
    var hay = haystack(job);
    var title = String(job.job_title || '').toLowerCase();
    var best = 0, any = false;
    keys.forEach(function (term) {
      var weight = terms[term], hit = 0;
      if (title.indexOf(term) !== -1) hit = 1.0 * weight;
      else if (hay.indexOf(term) !== -1) hit = 0.6 * weight;
      else if (term.length >= 5 && job._titleTokens.some(function (t) { return near(t, term); })) hit = 0.5 * weight;
      if (hit > 0) { any = true; best = Math.max(best, hit); }
    });
    return any ? best : 0;
  }

  /* ── filters ───────────────────────────────────────────────────────── */
  function inLocation(job, wanted) {
    if (!wanted) return true;
    var w = wanted.toLowerCase().trim();
    if (!w) return true;
    if (/^remote/.test(w)) return job.remote_status === 'remote';
    var blob = [job.location, job.location_city, job.location_region, job.location_country]
      .join(' ').toLowerCase();
    return tokenise(w).every(function (t) { return blob.indexOf(t) !== -1; });
  }

  function hoursSince(iso) {
    var t = Date.parse(iso || '');
    return isNaN(t) ? Infinity : (Date.now() - t) / 3600000;
  }

  function passes(job, f) {
    // An unverified role is never shown by default. The toggle that reveals
    // them is explicit, and the cards stay badged as unverified.
    if (job.status === 'unverified' && !f.includeUnverified) return false;
    if (job.status === 'closed') return false;

    if (!inLocation(job, f.location)) return false;
    if (f.company && job.company_slug !== f.company) return false;
    if (f.remote && job.remote_status !== f.remote) return false;
    if (f.level && job.experience_level !== f.level) return false;
    if (f.employment && job.employment_type !== f.employment) return false;
    if (f.industry && job.industry !== f.industry) return false;
    if (f.size && job.company_size !== f.size) return false;
    if (f.education && job.education_requirement !== f.education) return false;

    if (f.verified6h && hoursSince(job.last_verified_at) > 6) return false;
    if (f.postedDays) {
      var anchor = job.posted_at_original || job.first_seen_at;
      if (hoursSince(anchor) > f.postedDays * 24) return false;
    }
    if (f.salaryOnly && !(job.salary_min && job.salary_max)) return false;
    if (f.minSalary && !(job.salary_max && job.salary_max >= f.minSalary)) return false;
    if (f.directOnly && (job.apply_hops || 0) > 0) return false;
    if (f.hideStaffing && job.is_staffing_firm) return false;
    if (f.hideReposted && (job.repost_count || 0) > 0) return false;
    if (f.visa && job.visa_sponsorship !== 'mentioned') return false;
    if (f.clearanceFree && job.security_clearance === 'mentioned') return false;
    return true;
  }

  var STATUS_RANK = { live: 0, recent: 1, unverified: 2, closed: 3 };

  function anchorTime(job) {
    var t = Date.parse(job.posted_at_original || job.first_seen_at || '');
    return isNaN(t) ? 0 : t;
  }

  function comparator(sort) {
    if (sort === 'newest') {
      return function (a, b) { return anchorTime(b) - anchorTime(a); };
    }
    if (sort === 'verified') {
      return function (a, b) {
        return Date.parse(b.last_verified_at || 0) - Date.parse(a.last_verified_at || 0);
      };
    }
    if (sort === 'salary') {
      return function (a, b) { return (b.salary_max || 0) - (a.salary_max || 0); };
    }
    // Default relevance order, and the product's ranking promise:
    // verified first, then match strength, then the newest ORIGINAL posting.
    return function (a, b) {
      var s = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      if (s) return s;
      if (b._score !== a._score) return b._score - a._score;
      return anchorTime(b) - anchorTime(a);
    };
  }

  function run(jobs, filters) {
    var f = filters || {};
    var terms = expand(f.q);
    var out = [];
    for (var i = 0; i < jobs.length; i++) {
      var job = jobs[i];
      if (!passes(job, f)) continue;
      var score = relevance(job, terms);
      if (score <= 0) continue;
      job._score = score;
      out.push(job);
    }
    out.sort(comparator(f.sort));
    return out;
  }

  global.JSSearch = {
    run: run, expand: expand, tokenise: tokenise, relevance: relevance,
    passes: passes, SYNONYMS: SYNONYMS,
  };
})(window);
