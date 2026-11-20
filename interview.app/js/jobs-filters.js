/* ============================================================
   Interview Studio — Jobs board filter engine (pure; no DOM).
   Every judgement about a posting (role, family, seniority, workplace,
   employment, status) was made in Python by interview/scripts/build_jobs.py.
   This file only filters, counts and serialises what is already there.
   Loaded as a classic script in the page (window.PSJobFilters) and with
   require() by interview.app/jobs/tests/filters.mjs.
   ============================================================ */
(function (root) {
  "use strict";

  /* Facets, in display order. `field` is the job property; `multi` facets
     are arrays on the job (a job matches when any value is selected). */
  var FACETS = [
    { key: "family", param: "family", field: "families", multi: true },
    { key: "role", param: "role", field: "role_id" },
    { key: "seniority", param: "level", field: "seniority" },
    { key: "company", param: "company", field: "company" },
    { key: "country", param: "country", field: "country" },
    { key: "workplace", param: "work", field: "workplace" },
    { key: "employment", param: "type", field: "employment" }
  ];
  /* Salary floors in USD. Postings in other currencies are not converted —
     choosing a floor shows only USD postings that state a salary. */
  var SALARY = [
    { id: "listed", label: "Salary stated" },
    { id: "100000", label: "US$100k+" },
    { id: "150000", label: "US$150k+" },
    { id: "200000", label: "US$200k+" },
    { id: "250000", label: "US$250k+" }
  ];
  var SORTS = ["new", "salary", "company"];

  function emptyState() {
    var s = { q: "", salary: "", expired: false, sort: "new" };
    FACETS.forEach(function (f) { s[f.key] = []; });
    return s;
  }

  function norm(s) {
    return String(s == null ? "" : s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
  }

  function haystack(j) {
    if (!j._hay) {
      j._hay = norm([j.role, j.company, j.location, (j.locations_extra || []).join(" "), j.summary].join(" "));
    }
    return j._hay;
  }

  function valueOf(j, f) {
    var v = j[f.field];
    if (f.multi) return v || [];
    return v == null || v === "" ? (f.key === "employment" || f.key === "workplace" ? "unknown" : "") : v;
  }

  function matchFacet(j, f, selected) {
    if (!selected || !selected.length) return true;
    var v = valueOf(j, f);
    if (f.multi) {
      for (var i = 0; i < v.length; i++) if (selected.indexOf(v[i]) !== -1) return true;
      return false;
    }
    return selected.indexOf(v) !== -1;
  }

  function matchSalary(j, salary) {
    if (!salary) return true;
    var s = j.salary;
    if (!s) return false;
    if (salary === "listed") return true;
    if (s.currency !== "USD") return false;
    return Math.max(s.min || 0, s.max || 0) >= Number(salary);
  }

  function matchQuery(j, q) {
    if (!q) return true;
    var hay = haystack(j);
    var words = norm(q).split(/\s+/).filter(Boolean);
    for (var i = 0; i < words.length; i++) if (hay.indexOf(words[i]) === -1) return false;
    return true;
  }

  /* skip: a facet key to ignore (used to count that facet's options). */
  function matches(j, state, skip) {
    if (!state.expired && j.status === "expired") return false;
    if (!matchQuery(j, state.q)) return false;
    if (skip !== "salary" && !matchSalary(j, state.salary)) return false;
    for (var i = 0; i < FACETS.length; i++) {
      var f = FACETS[i];
      if (f.key === skip) continue;
      if (!matchFacet(j, f, state[f.key])) return false;
    }
    return true;
  }

  function sortJobs(rows, sort) {
    var out = rows.slice();
    if (sort === "salary") {
      out.sort(function (a, b) {
        var av = a.salary && a.salary.currency === "USD" ? a.salary.max || a.salary.min : -1;
        var bv = b.salary && b.salary.currency === "USD" ? b.salary.max || b.salary.min : -1;
        return bv - av || a.company.localeCompare(b.company);
      });
    } else if (sort === "company") {
      out.sort(function (a, b) { return a.company.localeCompare(b.company) || a.role.localeCompare(b.role); });
    } else {
      out.sort(function (a, b) {
        var ad = a.posted || a.first_seen || "", bd = b.posted || b.first_seen || "";
        return (a.status === "expired") - (b.status === "expired") || (ad < bd ? 1 : ad > bd ? -1 : 0) ||
          a.company.localeCompare(b.company);
      });
    }
    return out;
  }

  function filterJobs(jobs, state) {
    return sortJobs(jobs.filter(function (j) { return matches(j, state); }), state.sort);
  }

  /* Counts for each option of a facet, with every OTHER filter applied —
     so the numbers say what you would get by ticking that option. */
  function facetCounts(jobs, state, key) {
    var f = FACETS.filter(function (x) { return x.key === key; })[0];
    var out = {};
    jobs.forEach(function (j) {
      if (!matches(j, state, key)) return;
      var v = valueOf(j, f);
      (f.multi ? v : [v]).forEach(function (x) { out[x] = (out[x] || 0) + 1; });
    });
    return out;
  }

  function salaryCounts(jobs, state) {
    var out = {};
    var base = jobs.filter(function (j) { return matches(j, state, "salary"); });
    SALARY.forEach(function (s) {
      out[s.id] = base.filter(function (j) { return matchSalary(j, s.id); }).length;
    });
    return out;
  }

  function activeCount(state) {
    var n = (state.q ? 1 : 0) + (state.salary ? 1 : 0) + (state.expired ? 1 : 0);
    FACETS.forEach(function (f) { n += state[f.key].length; });
    return n;
  }

  /* URL <-> state. Multi-values are comma-separated; unknown params are kept
     out of the state and ignored. `?company=Name` (the old link) still works. */
  function parseState(search) {
    var s = emptyState();
    var p = new URLSearchParams(search || "");
    s.q = (p.get("q") || "").slice(0, 120);
    FACETS.forEach(function (f) {
      var v = p.get(f.param);
      if (v) s[f.key] = v.split(",").map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 40);
    });
    var sal = p.get("salary") || "";
    if (SALARY.some(function (x) { return x.id === sal; })) s.salary = sal;
    s.expired = p.get("expired") === "1";
    var sort = p.get("sort") || "new";
    s.sort = SORTS.indexOf(sort) !== -1 ? sort : "new";
    return s;
  }

  function serializeState(s) {
    var p = new URLSearchParams();
    if (s.q) p.set("q", s.q);
    FACETS.forEach(function (f) { if (s[f.key].length) p.set(f.param, s[f.key].join(",")); });
    if (s.salary) p.set("salary", s.salary);
    if (s.expired) p.set("expired", "1");
    if (s.sort && s.sort !== "new") p.set("sort", s.sort);
    var out = p.toString();
    return out ? "?" + out : "";
  }

  /* Deep link into Career Prep, carrying role, company and seniority. */
  function prepUrl(job, start) {
    var p = new URLSearchParams();
    p.set("role", job.role_id);
    if (job.company && !job.sample) p.set("company", job.company);
    if (job.seniority) p.set("level", job.seniority);
    if (job.id && !job.sample) p.set("job", job.id);
    if (start) p.set("start", start);
    return "../careers/?" + p.toString();
  }

  var api = {
    FACETS: FACETS, SALARY: SALARY, emptyState: emptyState, matches: matches,
    filterJobs: filterJobs, facetCounts: facetCounts, salaryCounts: salaryCounts,
    activeCount: activeCount, parseState: parseState, serializeState: serializeState,
    prepUrl: prepUrl, sortJobs: sortJobs
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PSJobFilters = api;
})(typeof self !== "undefined" ? self : this);
