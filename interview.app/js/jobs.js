/* ============================================================
   Interview Studio — Jobs board
   Renders interview.app/jobs/data/jobs.json with the career taxonomy from
   interview.app/careers/data/careers.json. Every judgement about a posting
   was made in Python (interview/scripts/build_jobs.py); this file formats,
   filters (jobs-filters.js) and links:
     · Practice interview      → Career Prep mock, with role/company/level
     · View role preparation   → Career Prep topics for that role
     · Apply                   → the employer's own posting (never invented)
   Filter state lives in the URL, so a filtered board can be bookmarked.
   ============================================================ */
(function () {
  "use strict";

  var F = window.PSJobFilters;
  var $ = function (sel) { return document.querySelector(sel); };
  var listEl = $("#jobs-list");
  var countEl = $("#jobs-count");
  var noteEl = $("#jobs-note");
  var moreEl = $("#jobs-more");
  var famEl = $("#jobs-families");
  var facetsEl = $("#jobs-facets");
  var activeEl = $("#jobs-active");
  var activeN = $("#jobs-active-n");
  var qEl = $("#jobs-q");
  var sortEl = $("#jobs-sort");
  var panel = $("#jobs-filter-panel");
  var provEl = $("#jobs-prov");

  var PAGE = 25;
  var jobs = [], tax = null, bank = {}, mode = "live";
  var state = F.parseState(location.search);
  var shown = PAGE;

  var COUNTRY = { US: "United States", CA: "Canada", GB: "United Kingdom", IN: "India", DE: "Germany",
    FR: "France", IE: "Ireland", NL: "Netherlands", ES: "Spain", JP: "Japan", SG: "Singapore",
    AU: "Australia", BR: "Brazil", CN: "China", IL: "Israel", PL: "Poland", HR: "Croatia",
    SA: "Saudi Arabia", KR: "South Korea", CH: "Switzerland", SE: "Sweden", MX: "Mexico", "": "Not stated" };
  var WORK = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site", unknown: "Not stated" };
  var EMP = { full_time: "Full-time", part_time: "Part-time", contract: "Contract", internship: "Internship", unknown: "Not stated" };
  var CUR = { USD: "US$", GBP: "£", EUR: "€", CAD: "CA$", AUD: "A$", INR: "₹", SGD: "S$", JPY: "¥" };
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DAY = 86400000;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtDate(iso) {
    var d = new Date(String(iso).slice(0, 10) + "T00:00:00Z");
    return isNaN(d) ? "" : d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
  }
  function relDays(iso) {
    var d = new Date(String(iso).slice(0, 10) + "T00:00:00Z");
    if (isNaN(d)) return null;
    return Math.floor((Date.now() - d.getTime()) / DAY);
  }
  function money(n) {
    return n >= 1000 ? Math.round(n / 1000) + "k" : String(n);
  }
  function salaryText(s) {
    if (!s) return "";
    var c = CUR[s.currency] || s.currency + " ";
    return s.min === s.max ? c + money(s.min) : c + money(s.min) + "–" + money(s.max);
  }

  /* ── labels from the taxonomy ── */
  function famLabel(id) { var f = tax.famById[id]; return f ? f.label : id; }
  function roleTitle(id) { var r = tax.roleById[id]; return r ? r.title : id; }
  function levelLabel(id) { var s = tax.senById[id]; return s ? s.label : id; }

  function label(key, v) {
    if (key === "family") return famLabel(v);
    if (key === "role") return roleTitle(v);
    if (key === "seniority") return levelLabel(v);
    if (key === "country") return COUNTRY[v] || v;
    if (key === "workplace") return WORK[v] || v;
    if (key === "employment") return EMP[v] || v;
    return v;
  }
  var FACET_TITLE = { role: "Job title", seniority: "Seniority", company: "Company", country: "Location",
    workplace: "Remote / hybrid / on-site", employment: "Employment type" };

  /* Option order: taxonomy order where one exists, else by count. */
  function optionOrder(key, counts) {
    var keys = Object.keys(counts);
    if (key === "seniority") return tax.data.seniority.map(function (s) { return s.id; });
    if (key === "role") {
      var famOrder = tax.data.families.map(function (f) { return f.id; });
      return tax.data.roles.slice().sort(function (a, b) {
        return famOrder.indexOf(a.family) - famOrder.indexOf(b.family);
      }).map(function (r) { return r.id; });
    }
    if (key === "workplace") return ["remote", "hybrid", "onsite", "unknown"];
    if (key === "employment") return ["full_time", "part_time", "contract", "internship", "unknown"];
    return keys.sort(function (a, b) {
      return (counts[b] - counts[a]) || label(key, a).localeCompare(label(key, b));
    });
  }

  /* ── career-family selector ── */
  function renderFamilies() {
    var counts = F.facetCounts(jobs, state, "family");
    var total = F.filterJobs(jobs, Object.assign({}, state, { family: [] })).length;
    var html = '<button type="button" class="jf-fam' + (state.family.length ? "" : " is-on") +
      '" data-fam="" aria-pressed="' + (!state.family.length) + '">All <span>' + total + "</span></button>";
    tax.data.families.forEach(function (f) {
      var on = state.family.indexOf(f.id) !== -1;
      html += '<button type="button" class="jf-fam' + (on ? " is-on" : "") + '" data-fam="' + esc(f.id) +
        '" aria-pressed="' + on + '">' + esc(f.label) + " <span>" + (counts[f.id] || 0) + "</span></button>";
    });
    famEl.innerHTML = html;
  }

  /* ── facet checkboxes ── */
  function renderFacets() {
    var html = "";
    ["role", "seniority", "company", "country", "workplace", "employment"].forEach(function (key) {
      var counts = F.facetCounts(jobs, state, key);
      var opts = optionOrder(key, counts).filter(function (v) {
        return counts[v] || state[key].indexOf(v) !== -1;
      });
      if (!opts.length) return;
      var long = opts.length > 8;
      html += '<fieldset class="jf-group" data-facet="' + key + '"><legend>' + FACET_TITLE[key] +
        (state[key].length ? ' <span class="jf-n">' + state[key].length + " selected</span>" : "") + "</legend>";
      if (key === "company" && opts.length > 8) {
        html += '<label class="sr-only" for="jf-co-find">Find a company</label>' +
          '<input type="search" id="jf-co-find" class="jf-find" placeholder="Find a company…" autocomplete="off">';
      }
      html += '<div class="jf-opts' + (long ? " is-long" : "") + '">';
      opts.forEach(function (v) {
        var id = "jf-" + key + "-" + String(v || "none").replace(/[^a-z0-9]/gi, "_");
        var on = state[key].indexOf(v) !== -1;
        html += '<div class="jf-opt"><input type="checkbox" id="' + id + '" data-key="' + key +
          '" value="' + esc(v) + '"' + (on ? " checked" : "") + '><label for="' + id + '">' +
          esc(label(key, v)) + ' <span class="jf-c">' + (counts[v] || 0) + "</span></label></div>";
      });
      html += "</div></fieldset>";
    });
    var sc = F.salaryCounts(jobs, state);
    html += '<fieldset class="jf-group"><legend>Salary</legend><div class="jf-opts">' +
      '<div class="jf-opt"><input type="radio" name="jf-salary" id="jf-sal-any" value=""' +
      (state.salary ? "" : " checked") + '><label for="jf-sal-any">Any</label></div>';
    F.SALARY.forEach(function (s) {
      var id = "jf-sal-" + s.id;
      html += '<div class="jf-opt"><input type="radio" name="jf-salary" id="' + id + '" value="' + s.id + '"' +
        (state.salary === s.id ? " checked" : "") + '><label for="' + id + '">' + esc(s.label) +
        ' <span class="jf-c">' + sc[s.id] + "</span></label></div>";
    });
    html += '</div><p class="jf-hint">Salaries are shown only when the posting states one. Floors compare US-dollar postings; other currencies are not converted.</p></fieldset>';
    var nExpired = jobs.filter(function (j) { return j.status === "expired"; }).length;
    if (nExpired) {
      html += '<div class="jf-opt jf-expired"><input type="checkbox" id="jf-expired"' + (state.expired ? " checked" : "") +
        '><label for="jf-expired">Include listings no longer open <span class="jf-c">' + nExpired + "</span></label></div>";
    }
    var focusId = document.activeElement && document.activeElement.id;
    var coFind = $("#jf-co-find") ? $("#jf-co-find").value : "";
    facetsEl.innerHTML = html;
    if (coFind && $("#jf-co-find")) { $("#jf-co-find").value = coFind; filterCompanyList(coFind); }
    if (focusId && document.getElementById(focusId)) document.getElementById(focusId).focus();
  }

  function filterCompanyList(q) {
    var box = facetsEl.querySelector('[data-facet="company"] .jf-opts');
    if (!box) return;
    q = q.toLowerCase();
    Array.prototype.forEach.call(box.children, function (el) {
      el.hidden = q && el.textContent.toLowerCase().indexOf(q) === -1;
    });
  }

  /* ── active filter chips ── */
  function renderActive() {
    var chips = [];
    if (state.q) chips.push(["q", "", "“" + state.q + "”"]);
    F.FACETS.forEach(function (f) {
      state[f.key].forEach(function (v) { chips.push([f.key, v, label(f.key, v)]); });
    });
    if (state.salary) {
      chips.push(["salary", "", F.SALARY.filter(function (s) { return s.id === state.salary; })[0].label]);
    }
    if (state.expired) chips.push(["expired", "", "Including closed listings"]);
    var n = F.activeCount(state);
    activeN.textContent = n ? "(" + n + " active)" : "";
    if (!chips.length) { activeEl.innerHTML = ""; activeEl.hidden = true; return; }
    activeEl.hidden = false;
    activeEl.innerHTML = '<span class="ja-h">Filtered by</span>' + chips.map(function (c) {
      return '<button type="button" class="ja-chip" data-key="' + c[0] + '" data-val="' + esc(c[1]) +
        '" aria-label="Remove filter: ' + esc(c[2]) + '">' + esc(c[2]) + ' <span aria-hidden="true">×</span></button>';
    }).join("") + '<button type="button" class="ja-clear" id="ja-clear">Clear all</button>';
  }

  /* ── cards ── */
  function cardHTML(j) {
    var role = tax.roleById[j.role_id] || {};
    var expired = j.status === "expired";
    var facts = [];
    if (j.location) {
      var extra = j.locations_extra || [];
      facts.push('<li title="' + esc([j.location].concat(extra).join(" · ")) + '">' + esc(j.location) +
        (extra.length ? ' <span class="job-more">+' + extra.length + " more</span>" : "") + "</li>");
    }
    if (j.workplace && j.workplace !== "unknown") facts.push("<li>" + WORK[j.workplace] + "</li>");
    if (j.employment && j.employment !== "unknown") facts.push("<li>" + EMP[j.employment] + "</li>");
    facts.push("<li>" + esc(levelLabel(j.seniority)) + "</li>");

    var prov = [];
    var srcName = j.source === "jobsignal" ? (j.source_detail ? j.source_detail + " posting, verified by JobSignal" : "Verified by JobSignal")
      : j.source === "ats" ? "Company careers board" : j.source === "adzuna" ? "Adzuna" : "Illustrative sample";
    prov.push(esc(srcName));
    if (j.posted) prov.push("Posted " + fmtDate(j.posted));
    var added = j.first_seen ? relDays(j.first_seen) : null;
    if (added !== null && !j.sample) {
      prov.push('<span class="' + (added <= 7 ? "job-new" : "") + '" title="First appeared on this board on ' +
        fmtDate(j.first_seen) + '. The employer may have posted it earlier.">' +
        (added <= 0 ? "Added today" : added === 1 ? "Added yesterday" : "Added " + added + " days ago") + "</span>");
    }
    if (j.verified_at && !expired) prov.push("Last checked " + fmtDate(j.verified_at));

    var tags = "";
    if (j.sample) tags += '<span class="job-tag">Sample · not a real opening</span>';
    if (expired) tags += '<span class="job-tag is-closed">No longer listed' + (j.expired_on ? " since " + fmtDate(j.expired_on) : "") + "</span>";

    var acts = '<a class="job-btn is-primary" href="' + esc(F.prepUrl(j, "mock")) + '">Practice interview</a>' +
      '<a class="job-btn" href="' + esc(F.prepUrl(j)) + '">View role preparation</a>';
    if (!expired && j.apply_url) {
      acts += '<a class="job-apply" href="' + esc(j.apply_url) + '" target="_blank" rel="noopener nofollow">' +
        (j.sample ? "Search openings" : "Apply on the employer’s site") + ' <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>';
    }
    /* Engineering and analyst roles also link to that company's executable SQL/Python
       questions. Product and program roles never do: SQL is not their interview. */
    var b = j.bank && bank[j.bank];
    if (b && role.prep === "studio") {
      acts += '<a class="job-bank" href="' + esc(b.url) + '">' + b.total + " " + esc(j.bank) +
        " SQL &amp; Python question" + (b.total === 1 ? "" : "s") + "</a>";
    }
    if (j.details_url && !j.sample) {
      acts += '<a class="job-detail" href="' + esc(j.details_url) + '">Posting history</a>';
    }

    return '<li class="job-card' + (expired ? " is-expired" : "") + (j.sample ? " is-sample" : "") + '">' +
      '<article aria-labelledby="jt-' + esc(j.id) + '">' +
      '<div class="job-main">' +
      '<p class="job-co">' + esc(j.company) + tags + "</p>" +
      '<h2 class="job-role" id="jt-' + esc(j.id) + '">' + esc(j.role) + "</h2>" +
      '<p class="job-track">' + esc(famLabel(j.family)) + " · " + esc(roleTitle(j.role_id)) + "</p>" +
      '<ul class="job-facts">' + facts.join("") + "</ul>" +
      (j.salary ? '<p class="job-salary">' + esc(salaryText(j.salary)) + ' <span>a year, as stated in the posting</span></p>' : "") +
      (j.summary ? '<p class="job-summary">' + esc(j.summary) + ' <span class="job-src">— from the posting</span></p>' : "") +
      '<p class="job-prov">' + prov.join(" · ") + "</p>" +
      "</div>" +
      '<div class="job-actions">' + acts + "</div>" +
      "</article></li>";
  }

  function emptyHTML() {
    var fam = state.family.length === 1 ? state.family[0] : null;
    var prep = fam ? '<a href="../careers/?family=' + encodeURIComponent(fam) + '">Prepare for ' + esc(famLabel(fam)) +
      " roles anyway</a> — Career Prep does not need an open listing." : '<a href="../careers/">Browse Career Prep</a> — practice does not need an open listing.';
    return '<li class="jobs-empty"><p><strong>No open roles match these filters.</strong></p>' +
      "<p>Try removing a filter" + (F.activeCount(state) ? ' or <button type="button" class="ja-clear" id="je-clear">clear them all</button>' : "") +
      ".</p><p>" + prep + "</p></li>";
  }

  /* ── render ── */
  function render(opts) {
    var rows = F.filterJobs(jobs, state);
    renderFamilies();
    renderFacets();
    renderActive();
    if (!(opts && opts.keepPage)) shown = PAGE;
    listEl.innerHTML = rows.length ? rows.slice(0, shown).map(cardHTML).join("") : emptyHTML();
    var nLive = rows.filter(function (j) { return j.status !== "expired"; }).length;
    countEl.innerHTML = "<strong>" + nLive + "</strong> " + (mode === "sample" ? "sample role" : "open role") + (nLive === 1 ? "" : "s") +
      (rows.length > nLive ? " · " + (rows.length - nLive) + " closed" : "") +
      (rows.length > shown ? ' <span class="jobs-showing">· showing ' + shown + "</span>" : "");
    moreEl.hidden = rows.length <= shown;
    if (!moreEl.hidden) moreEl.textContent = "Show " + Math.min(PAGE, rows.length - shown) + " more of " + (rows.length - shown);
    var url = location.pathname + F.serializeState(state) + location.hash;
    if (url !== location.pathname + location.search + location.hash) history.replaceState(null, "", url);
  }

  function setFacet(key, value, on) {
    var arr = state[key];
    var i = arr.indexOf(value);
    if (on && i === -1) arr.push(value);
    if (!on && i !== -1) arr.splice(i, 1);
  }

  function bind() {
    famEl.addEventListener("click", function (e) {
      var b = e.target.closest(".jf-fam");
      if (!b) return;
      var id = b.getAttribute("data-fam");
      if (!id) state.family = [];
      else setFacet("family", id, state.family.indexOf(id) === -1);
      render();
      var again = famEl.querySelector('[data-fam="' + id + '"]');
      if (again) again.focus();
    });
    facetsEl.addEventListener("change", function (e) {
      var t = e.target;
      if (t.id === "jf-expired") state.expired = t.checked;
      else if (t.name === "jf-salary") state.salary = t.value;
      else if (t.getAttribute("data-key")) setFacet(t.getAttribute("data-key"), t.value, t.checked);
      else return;
      render();
    });
    facetsEl.addEventListener("input", function (e) {
      if (e.target.id === "jf-co-find") filterCompanyList(e.target.value);
    });
    var tq;
    qEl.value = state.q;
    qEl.addEventListener("input", function () {
      clearTimeout(tq);
      tq = setTimeout(function () { state.q = qEl.value.trim(); render(); }, 150);
    });
    sortEl.value = state.sort;
    sortEl.addEventListener("change", function () { state.sort = sortEl.value; render(); });
    document.addEventListener("click", function (e) {
      var chip = e.target.closest(".ja-chip");
      if (chip) {
        var k = chip.getAttribute("data-key"), v = chip.getAttribute("data-val");
        if (k === "q") { state.q = ""; qEl.value = ""; }
        else if (k === "salary") state.salary = "";
        else if (k === "expired") state.expired = false;
        else setFacet(k, v, false);
        render();
        countEl.focus();
        return;
      }
      if (e.target.id === "ja-clear" || e.target.id === "je-clear") {
        var sort = state.sort;
        state = F.emptyState();
        state.sort = sort;
        qEl.value = "";
        render();
        countEl.focus();
      }
    });
    moreEl.addEventListener("click", function () {
      var first = shown;
      shown += PAGE;
      render({ keepPage: true });
      var next = listEl.children[first];
      var h = next && next.querySelector("h2");
      if (h) { h.setAttribute("tabindex", "-1"); h.focus(); }
    });
    /* Filters start open on wide screens, folded on phones. */
    if (window.matchMedia && window.matchMedia("(max-width: 860px)").matches && !F.activeCount(state)) panel.open = false;
  }

  function provenance(data) {
    var bits = (data.sources || []).map(function (s) {
      return esc(s.label) + " (" + s.jobs + (s.refreshed_at ? ", refreshed " + fmtDate(s.refreshed_at) : "") + ")";
    });
    provEl.innerHTML = (mode === "sample"
      ? "These openings are illustrative. "
      : "Every listing links to the employer’s own posting; nothing here is invented. ") +
      (bits.length ? "Sources: " + bits.join("; ") + ". " : "") +
      "Board built " + fmtDate(data.generated_at) + ". Roles are sorted into careers by job title using the " +
      'same taxonomy as <a href="../careers/">Career Prep</a>. ' +
      'How listings are verified: <a href="/jobs/methodology/">JobSignal methodology</a>.';
  }

  function indexTaxonomy(c) {
    var t = { data: c, famById: {}, roleById: {}, senById: {} };
    c.families.forEach(function (f) { t.famById[f.id] = f; });
    c.roles.forEach(function (r) { t.roleById[r.id] = r; });
    c.seniority.forEach(function (s) { t.senById[s.id] = s; });
    return t;
  }

  function fail(err) {
    listEl.innerHTML = '<li class="jobs-error"><p>Couldn’t load the jobs board (' + esc(err.message) +
      ').</p><p>Meanwhile, <a href="../careers/">Career Prep</a> and the <a href="../">question bank</a> work without it.</p></li>';
    countEl.textContent = "";
  }

  function getJSON(u) {
    return fetch(u, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status + " for " + u);
      return r.json();
    });
  }

  Promise.all([getJSON("./data/jobs.json"), getJSON("../careers/data/careers.json")]).then(function (res) {
    var data = res[0];
    tax = indexTaxonomy(res[1]);
    jobs = (data.jobs || []).filter(function (j) { return tax.roleById[j.role_id]; });
    bank = data.bank || {};
    mode = data.mode || "live";
    if (noteEl) noteEl.hidden = mode !== "sample";
    provenance(data);
    bind();
    render();
  }).catch(fail);
})();
