/* ============================================================
   Career Prep — engine (pure; no DOM, no storage).
   Curriculum order, question choice for a mock loop, and the arithmetic
   of the candidate's OWN self-assessment. Nothing here grades free text
   and nothing here predicts a hiring outcome.
   Loaded as a classic script (window.PSCareersEngine) and with require()
   by interview.app/careers/tests/engine.mjs.
   ============================================================ */
(function (root) {
  "use strict";

  var LEVELS = ["entry", "associate", "mid", "senior", "staff_principal", "director"];

  /* Deterministic PRNG so a loop can be re-created from its seed. */
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  /* The track's categories, the role's emphasis first, each with its count. */
  function curriculum(role, track, categoriesById, questions) {
    var focus = role.focus || [];
    var order = focus.concat(track.categories.filter(function (c) { return focus.indexOf(c) === -1; }));
    return order.filter(function (c) { return categoriesById[c]; }).map(function (c) {
      return {
        id: c,
        category: categoriesById[c],
        emphasis: focus.indexOf(c) !== -1,
        questions: questions.filter(function (q) { return q.category === c; })
      };
    });
  }

  /* A question suits a level when it lists it, or lists a neighbouring level. */
  function levelFit(q, level) {
    if (!level) return 1;
    if (q.levels.indexOf(level) !== -1) return 2;
    var i = LEVELS.indexOf(level);
    for (var k = 0; k < q.levels.length; k++) {
      if (Math.abs(LEVELS.indexOf(q.levels[k]) - i) === 1) return 1;
    }
    return 0;
  }

  function pickQuestion(pool, byId, level, rand, exclude) {
    var cands = pool.filter(function (id) { return byId[id] && (!exclude || exclude.indexOf(id) === -1); });
    if (!cands.length) cands = pool.filter(function (id) { return byId[id]; });
    if (!cands.length) return null;
    var best = Math.max.apply(null, cands.map(function (id) { return levelFit(byId[id], level); }));
    var top = cands.filter(function (id) { return levelFit(byId[id], level) === best; });
    return top[Math.floor(rand() * top.length)];
  }

  /* Five rounds: one question per round from that round's pool. */
  function roundPlan(track, questions, level, seed) {
    var byId = {};
    questions.forEach(function (q) { byId[q.id] = q; });
    var rand = rng(seed);
    var used = [];
    return track.rounds.map(function (r) {
      var qid = pickQuestion(r.pool, byId, level, rand, used);
      used.push(qid);
      return { n: r.n, title: r.title, minutes: r.minutes, focus: r.focus, qid: qid };
    });
  }

  /* Another question for the same round, never one already in this loop. */
  function swapQuestion(track, plan, roundIndex, questions, level, seed) {
    var byId = {};
    questions.forEach(function (q) { byId[q.id] = q; });
    var used = plan.map(function (r) { return r.qid; });
    var pool = track.rounds[roundIndex].pool;
    var others = pool.filter(function (id) { return used.indexOf(id) === -1; });
    if (!others.length) return plan[roundIndex].qid;
    return pickQuestion(others, byId, level, rng(seed), used);
  }

  /* ── self-assessment arithmetic ── */
  function mean(xs) {
    return xs.length ? xs.reduce(function (a, b) { return a + b; }, 0) / xs.length : null;
  }

  function dimAverages(attempt) {
    var acc = {};
    (attempt.rounds || []).forEach(function (r) {
      Object.keys(r.scores || {}).forEach(function (d) {
        var v = r.scores[d];
        if (typeof v === "number" && v >= 1 && v <= 4) (acc[d] = acc[d] || []).push(v);
      });
    });
    var out = {};
    Object.keys(acc).forEach(function (d) { out[d] = mean(acc[d]); });
    return out;
  }

  function overall(attempt) {
    var all = [];
    (attempt.rounds || []).forEach(function (r) {
      Object.keys(r.scores || {}).forEach(function (d) {
        var v = r.scores[d];
        if (typeof v === "number" && v >= 1 && v <= 4) all.push(v);
      });
    });
    return mean(all);
  }

  function roundAverage(r) {
    return mean(Object.keys(r.scores || {}).map(function (d) { return r.scores[d]; })
      .filter(function (v) { return typeof v === "number" && v >= 1 && v <= 4; }));
  }

  /* Lowest-scored dimensions first; ties keep rubric order. Only scored dims. */
  function weakest(avgs, n, order) {
    var ids = Object.keys(avgs);
    ids.sort(function (a, b) {
      return avgs[a] - avgs[b] || (order ? order.indexOf(a) - order.indexOf(b) : a.localeCompare(b));
    });
    return ids.filter(function (d) { return avgs[d] < 3; }).slice(0, n);
  }

  /* Questions in this track that exercise the weak dimensions, unpractised first. */
  function recommend(questions, weakDims, practised, limit) {
    var scored = questions.map(function (q) {
      var hits = q.dimensions.filter(function (d) { return weakDims.indexOf(d) !== -1; }).length;
      return { q: q, hits: hits, done: practised && practised[q.id] ? 1 : 0 };
    }).filter(function (x) { return x.hits > 0; });
    scored.sort(function (a, b) { return a.done - b.done || b.hits - a.hits || a.q.id.localeCompare(b.q.id); });
    return scored.slice(0, limit || 4).map(function (x) { return x.q.id; });
  }

  /* Publicly reported questions whose reported roles match this role. */
  function reportedForRole(reported, role) {
    var names = [role.title].concat(role.aliases || []).map(function (s) { return s.toLowerCase(); });
    return (reported || []).filter(function (q) {
      return (q.roles_reported || []).some(function (r) {
        var n = String(r.name || r).toLowerCase();
        return names.some(function (a) { return a.length > 3 && (n === a || n.indexOf(a) !== -1 || a.indexOf(n) !== -1 && n.length > 6); });
      });
    });
  }

  var api = {
    LEVELS: LEVELS, rng: rng, curriculum: curriculum, levelFit: levelFit, roundPlan: roundPlan,
    swapQuestion: swapQuestion, dimAverages: dimAverages, overall: overall, roundAverage: roundAverage,
    weakest: weakest, recommend: recommend, reportedForRole: reportedForRole
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PSCareersEngine = api;
})(typeof self !== "undefined" ? self : this);
