// ════════════════════════════════════════════════════════════
// Interview Question Bank — browse, filter, pick
// Static, no build step. Page lives at /interview.app/, data at /interview/data/.
// ════════════════════════════════════════════════════════════

const DATA_BASE = "../interview/data";
const LS_SET = "qb.set.v1";
const LS_FILTERS = "qb.filters.v1";
const PAGE_SIZE = 25;

const state = {
  questions: [],
  filtered: [],
  page: 1,
  filters: {
    search: "",
    languages: new Set(),
    difficulties: new Set(),
    batches: new Set(),
    companies: new Set(),
    types: new Set(),
  },
  sort: "default",
  set: new Map(), // id -> minimal record
};

// ─── DOM helpers ───
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

// ─── Persistence ───
function loadSet() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_SET) || "[]");
    state.set = new Map(raw.map((q) => [q.id, q]));
  } catch { state.set = new Map(); }
}
function saveSet() {
  localStorage.setItem(LS_SET, JSON.stringify(Array.from(state.set.values())));
}
function loadFilters() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_FILTERS) || "{}");
    state.filters.search = raw.search || "";
    state.filters.languages = new Set(raw.languages || []);
    state.filters.difficulties = new Set(raw.difficulties || []);
    state.filters.batches = new Set(raw.batches || []);
    state.filters.companies = new Set(raw.companies || []);
    state.filters.types = new Set(raw.types || []);
    state.sort = raw.sort || "default";
  } catch { /* ignore */ }
}
function saveFilters() {
  localStorage.setItem(LS_FILTERS, JSON.stringify({
    search: state.filters.search,
    languages: [...state.filters.languages],
    difficulties: [...state.filters.difficulties],
    batches: [...state.filters.batches],
    companies: [...state.filters.companies],
    types: [...state.filters.types],
    sort: state.sort,
  }));
}

// ─── Data load ───
async function loadData() {
  const [questions, manifest] = await Promise.all([
    fetch(`${DATA_BASE}/questions.json`).then((r) => r.json()),
    fetch(`${DATA_BASE}/manifest.json`).then((r) => r.json()),
  ]);
  state.questions = questions;
  state.manifest = manifest;
  $("#qb-total").textContent = manifest.total;
  $("#qb-companies").textContent = manifest.companies;
}

// ─── Filtering ───
// Returns true if a question passes every active filter EXCEPT the named one.
// Used to cascade facet counts: when computing "what languages are available
// given the user's current company / difficulty / type picks", we exclude
// the languages filter itself — otherwise picking a language would shrink
// its own facet to just that one item.
function passesFiltersExcept(q, exceptKey) {
  const f = state.filters;
  if (exceptKey !== "languages"    && f.languages.size    && !f.languages.has(q.language))       return false;
  if (exceptKey !== "difficulties" && f.difficulties.size && !f.difficulties.has(q.difficulty)) return false;
  if (exceptKey !== "batches"      && f.batches.size      && !f.batches.has(q.batch))            return false;
  if (exceptKey !== "companies"    && f.companies.size    && !f.companies.has(q.company))        return false;
  if (exceptKey !== "types"        && f.types.size        && !f.types.has(q.type))               return false;
  if (exceptKey !== "search") {
    const needle = f.search.trim().toLowerCase();
    if (needle) {
      const hay = [
        q.title, q.company, q.type, q.subtopic, q.schema, q.solution,
        // Include auto-detected SQL technique tags so searches like
        // "analytical" or "recursive" actually surface matching questions.
        Array.isArray(q.tags) ? q.tags.join(" ") : "",
      ].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(needle)) return false;
    }
  }
  return true;
}

function applyFilters() {
  // Pass null so all filters apply — this is the "real" filtered result set.
  state.filtered = state.questions.filter((q) => passesFiltersExcept(q, null));

  const diffOrder = { Easy: 0, Medium: 1, Hard: 2 };
  if (state.sort === "title") state.filtered.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  else if (state.sort === "company") state.filtered.sort((a, b) => (a.company || "~").localeCompare(b.company || "~"));
  else if (state.sort === "difficulty") state.filtered.sort(
    (a, b) => (diffOrder[a.difficulty] ?? 9) - (diffOrder[b.difficulty] ?? 9)
  );

  state.page = 1;
  saveFilters();
  refreshFacetCounts();
  renderResults();
  syncUrlAndMetadata();
}

// ─── URL ↔ filter sync + dynamic metadata ───
// Each filter combo gets its own canonical URL (e.g. ?company=Google&topic=SQL)
// + its own <title> / meta-description / canonical so Google can index the
// filtered view as a distinct landing page. The state.filters Sets are the
// source of truth; we serialize → URL on every change and deserialize URL →
// Sets exactly once on init.

const URL_KEYS = [
  ["companies",    "company"],
  ["types",        "topic"],
  ["languages",    "language"],
  ["difficulties", "difficulty"],
  ["batches",      "batch"],
];

function readFiltersFromUrl() {
  const p = new URLSearchParams(location.search);
  for (const [setKey, urlKey] of URL_KEYS) {
    const values = p.getAll(urlKey);
    if (values.length) {
      state.filters[setKey] = new Set(values);
    }
  }
  const q = p.get("q");
  if (q) state.filters.search = q;
}

function buildUrlFromFilters() {
  const p = new URLSearchParams();
  for (const [setKey, urlKey] of URL_KEYS) {
    for (const v of state.filters[setKey]) p.append(urlKey, v);
  }
  if (state.filters.search) p.set("q", state.filters.search);
  const qs = p.toString();
  return location.pathname + (qs ? "?" + qs : "");
}

function pluralize(n, one, many) { return n === 1 ? one : many; }

function buildMetadataFromFilters() {
  const f = state.filters;
  const companies    = [...f.companies];
  const types        = [...f.types];
  const languages    = [...f.languages].map((s) => s.toUpperCase());
  const difficulties = [...f.difficulties];

  const count = state.filtered.length;
  const base  = "PaddySpeaks Interview Studio";
  const fragments = [];

  if (languages.length)    fragments.push(languages.join(" / "));
  if (difficulties.length) fragments.push(difficulties.join(" / "));
  if (types.length)        fragments.push(types.slice(0, 2).join(" + ") + (types.length > 2 ? ` +${types.length - 2}` : ""));
  if (companies.length)    fragments.push(`for ${companies.slice(0, 3).join(", ")}${companies.length > 3 ? ` +${companies.length - 3}` : ""}`);

  let title, desc;
  if (!fragments.length && !f.search) {
    const total = state.manifest?.total || state.questions.length || "1400+";
    title = `Data Engineer Interview Prep — ${total} SQL, Python & Snowflake Questions | PaddySpeaks`;
    desc  = `Free data engineer interview prep: ${total} real SQL, Python and Snowflake questions from Google, Amazon, Meta and 100+ companies. In-browser SQL & Python playground, no sign-up.`;
  } else {
    const head = f.search ? `"${f.search}"` : fragments.join(" · ");
    title = `${head} Interview Questions${count ? ` · ${count} ${pluralize(count, "question", "questions")}` : ""} | ${base}`;
    const parts = [];
    if (companies.length)    parts.push(`real interview questions from ${companies.slice(0, 5).join(", ")}${companies.length > 5 ? ` and ${companies.length - 5} more companies` : ""}`);
    else                     parts.push("real interview questions");
    if (types.length)        parts.push(`on ${types.slice(0, 3).join(", ")}`);
    if (languages.length)    parts.push(`in ${languages.join(" / ")}`);
    if (difficulties.length) parts.push(`at ${difficulties.join(" / ")} difficulty`);
    desc = `${count} ${parts.join(" ")}. Filter, save your set, and run answers in the in-browser ${languages.includes("PYTHON") ? "Pyodide" : "sql.js"} playground — no backend, no sign-up.`;
    if (desc.length > 300) desc = desc.slice(0, 297) + "…";
  }
  return { title, desc };
}

let _urlSyncRaf = 0;
function syncUrlAndMetadata() {
  // Throttle to once per animation frame — typing in the search box fires
  // an input event per keystroke, and we don't want to thrash pushState.
  if (_urlSyncRaf) return;
  _urlSyncRaf = requestAnimationFrame(() => {
    _urlSyncRaf = 0;
    try {
      const url = buildUrlFromFilters();
      // Replace state on initial render or no-filter snapshot, push otherwise,
      // so the back button takes the user to the previous filter combo.
      const isInitial = !history.state || history.state._qb !== true;
      const method = isInitial ? "replaceState" : "pushState";
      history[method]({ _qb: true, ts: Date.now() }, "", url);
    } catch (e) { /* ignore — privacy mode etc. */ }

    const { title, desc } = buildMetadataFromFilters();
    document.title = title;

    const set = (id, attr, value) => {
      const el = document.getElementById(id);
      if (el) el.setAttribute(attr, value);
    };
    set("qb-meta-description",   "content", desc);
    set("qb-og-title",            "content", title);
    set("qb-og-description",      "content", desc);
    set("qb-og-url",              "content", location.origin + buildUrlFromFilters());
    set("qb-twitter-title",       "content", title);
    set("qb-twitter-description", "content", desc);
    set("qb-canonical",           "href",    location.origin + buildUrlFromFilters());
  });
}

// Walk the question set with all-but-one filter active and tally a field.
// Returns Map<value, count>.
function cascadedCounts(facetKey, fieldOf) {
  const counts = new Map();
  for (const q of state.questions) {
    if (!passesFiltersExcept(q, facetKey)) continue;
    const v = fieldOf(q);
    if (v == null || v === "") continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return counts;
}

// Update facet item counts based on the OTHER active filters. Items that
// would yield zero results are dropped from the list (UX: don't tempt the
// user with dead-end picks). A currently-selected item is always kept so
// the user can deselect it.
function withCascadedCounts(items, counts, activeSet) {
  return items
    .map((it) => ({ ...it, count: counts.get(it.name) || 0 }))
    .filter((it) => it.count > 0 || activeSet.has(it.name));
}

function refreshFacetCounts() {
  const f = state._facets;
  if (!f) return;   // facets not loaded yet (initial render)

  const langC  = cascadedCounts("languages",    (q) => q.language);
  const diffC  = cascadedCounts("difficulties", (q) => q.difficulty);
  const batchC = cascadedCounts("batches",      (q) => q.batch);
  const coC    = cascadedCounts("companies",    (q) => q.company);
  const tyC    = cascadedCounts("types",        (q) => q.type);

  renderChipFacet ("#qb-lang-facet",    "languages",    withCascadedCounts(f.languages,    langC,  state.filters.languages));
  renderChipFacet ("#qb-diff-facet",    "difficulties", withCascadedCounts(f.difficulties, diffC,  state.filters.difficulties));
  renderBatchFacet(                                     withCascadedCounts(f.batches,      batchC, state.filters.batches));
  renderCheckboxFacet("#qb-company-facet", "companies", withCascadedCounts(f.companies,    coC,    state.filters.companies), "#qb-company-search");
  renderCheckboxFacet("#qb-type-facet",    "types",     withCascadedCounts(f.types,        tyC,    state.filters.types),     "#qb-type-search");
}

// ─── Render: facets ───
function renderChipFacet(containerSel, key, items) {
  const container = $(containerSel);
  container.innerHTML = "";
  const active = state.filters[key];
  for (const item of items) {
    const chip = el("button", {
      type: "button",
      class: "qb-chip" + (active.has(item.name) ? " is-active" : ""),
      onclick: () => {
        if (active.has(item.name)) active.delete(item.name);
        else active.add(item.name);
        applyFilters();   // applyFilters → refreshFacetCounts re-renders this facet with cascaded counts
      },
    });
    chip.append(
      document.createTextNode(item.name),
      el("span", { class: "qb-chip-count" }, ` ${item.count}`)
    );
    container.appendChild(chip);
  }
}

function renderCheckboxFacet(containerSel, key, items, searchSel) {
  const container = $(containerSel);
  const search = $(searchSel);
  const needle = (search.value || "").trim().toLowerCase();
  const active = state.filters[key];
  container.innerHTML = "";
  const visible = items.filter((it) => !needle || it.name.toLowerCase().includes(needle));
  if (!visible.length) {
    container.appendChild(el("div", { class: "qb-set-empty" }, "No matches"));
    return;
  }
  for (const item of visible) {
    const id = `f-${key}-${btoa(unescape(encodeURIComponent(item.name))).replace(/=/g, "")}`;
    const cb = el("input", {
      type: "checkbox",
      id,
      onchange: (e) => {
        if (e.target.checked) active.add(item.name);
        else active.delete(item.name);
        applyFilters();
      },
    });
    if (active.has(item.name)) cb.checked = true;
    const label = el("label", { for: id },
      cb,
      document.createTextNode(item.name),
      el("span", { class: "qb-fcount" }, String(item.count))
    );
    container.appendChild(label);
  }
}

// Custom render path for batches — they have a label distinct from their id,
// so the standard chip renderer (which uses item.name as both filter key and
// display text) doesn't fit. Extracted so refreshFacetCounts can reuse it.
function renderBatchFacet(items) {
  const batchEl = $("#qb-batch-facet");
  batchEl.innerHTML = "";
  const active = state.filters.batches;
  for (const b of items) {
    const chip = el("button", {
      type: "button",
      class: "qb-chip" + (active.has(b.name) ? " is-active" : ""),
      title: b.name,
      onclick: () => {
        if (active.has(b.name)) active.delete(b.name); else active.add(b.name);
        applyFilters();
      },
    },
      document.createTextNode(b.label || b.name),
      el("span", { class: "qb-chip-count" }, ` ${b.count}`)
    );
    batchEl.appendChild(chip);
  }
}

async function renderFacets() {
  const [companies, topics, difficulties, languages] = await Promise.all([
    fetch(`${DATA_BASE}/companies.json`).then((r) => r.json()),
    fetch(`${DATA_BASE}/topics.json`).then((r) => r.json()),
    fetch(`${DATA_BASE}/difficulties.json`).then((r) => r.json()),
    fetch(`${DATA_BASE}/languages.json`).then((r) => r.json()),
  ]);

  // Companies sort alphabetically (easier to find a specific one); types
  // keep frequency order so the most common topics surface first.
  const companiesSorted = [...companies].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
  const batches = state.manifest.batches.map((b) =>
    ({ name: b.id, count: b.count, label: b.label })
  );

  // Stash master lists so refreshFacetCounts can re-render any facet on
  // demand with updated counts. Source-of-truth for what's selectable.
  state._facets = {
    languages,
    difficulties,
    batches,
    companies: companiesSorted,
    types: topics.types,
  };

  // Initial render uses the global counts shipped in the data files. The
  // first applyFilters() call (kicked off from init) immediately refreshes
  // these with cascaded counts.
  renderChipFacet("#qb-lang-facet", "languages", languages);
  renderChipFacet("#qb-diff-facet", "difficulties", difficulties);
  renderBatchFacet(batches);
  renderCheckboxFacet("#qb-company-facet", "companies", companiesSorted, "#qb-company-search");
  renderCheckboxFacet("#qb-type-facet", "types", topics.types, "#qb-type-search");

  // The two text-search boxes filter the visible options inside the
  // company/type facets locally. They re-trigger refreshFacetCounts so
  // the cascade logic still applies — typing a search just narrows the
  // "what's visible" pass at the very end of that pipeline.
  $("#qb-company-search").addEventListener("input", refreshFacetCounts);
  $("#qb-type-search").addEventListener("input", refreshFacetCounts);
}

// ─── Render: results ───
function diffClass(d) {
  const k = (d || "").toLowerCase();
  if (k === "easy") return "diff-easy";
  if (k === "medium") return "diff-medium";
  if (k === "hard") return "diff-hard";
  return "diff-other";
}

function renderResults() {
  const list = $("#qb-list");
  list.innerHTML = "";
  $("#qb-count").textContent = state.filtered.length;
  $("#qb-count-total").textContent = state.questions.length;

  const total = state.filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (state.page > totalPages) state.page = totalPages;
  const start = (state.page - 1) * PAGE_SIZE;
  const slice = state.filtered.slice(start, start + PAGE_SIZE);

  if (!slice.length) {
    list.appendChild(el("div", { class: "qb-set-empty" }, "No questions match your filters."));
  } else {
    const tpl = $("#qb-card-tpl");
    for (const q of slice) list.appendChild(buildCard(q, tpl));
  }

  $("#qb-page-info").textContent = `Page ${state.page} of ${totalPages}`;
  $("#qb-prev").disabled = state.page <= 1;
  $("#qb-next").disabled = state.page >= totalPages;
}

function buildCard(q, tpl) {
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.id = q.id;
  if (state.set.has(q.id)) node.classList.add("is-selected");
  const cb = node.querySelector(".qb-check input");
  cb.checked = state.set.has(q.id);
  cb.addEventListener("change", (e) => toggleSet(q, e.target.checked, node));

  node.querySelector(".qb-card-title").textContent = q.title || "(untitled)";
  const diff = node.querySelector(".qb-card-diff");
  diff.textContent = q.difficulty || "—";
  diff.classList.add(diffClass(q.difficulty));

  node.querySelector(".qb-meta-co").textContent = q.company || "—";
  node.querySelector(".qb-meta-type").textContent = [q.type, q.subtopic].filter(Boolean).join(" · ") || "—";
  node.querySelector(".qb-meta-lang").textContent = q.language || "—";

  // Auto-detected technique tags (analytical-functions, joins, cte, …).
  // Renders a chip strip below the meta-row when q.tags is non-empty.
  // The chips are clickable and toggle the tag filter.
  if (Array.isArray(q.tags) && q.tags.length) {
    const head = node.querySelector(".qb-card-head");
    if (head) {
      const strip = document.createElement("div");
      strip.className = "qb-card-tagchips";
      for (const t of q.tags) {
        const chip = document.createElement("span");
        chip.className = "qb-card-tagchip qb-tag-" + t;
        chip.textContent = t;
        chip.title = "Click to filter by " + t;
        chip.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          $("#qb-search").value = t;
          state.filters.search = t;
          render();
        });
        strip.appendChild(chip);
      }
      head.parentNode.insertBefore(strip, head.nextSibling);
    }
  }

  const schemaEl = node.querySelector(".qb-schema-text");
  const solEl = node.querySelector(".qb-solution-text");
  if (q.schema) schemaEl.textContent = q.schema;
  else node.querySelector(".qb-schema").style.display = "none";
  solEl.textContent = q.solution || "(no reference solution provided)";

  const copyBtn = node.querySelector(".qb-copy");
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(q.solution || "");
      copyBtn.textContent = "Copied ✓";
      setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
    } catch {
      copyBtn.textContent = "Copy failed";
    }
  });

  const link = node.querySelector(".qb-open-playground");
  const target = q.language === "python" ? "python.html" : "sql.html";
  link.href = `./${target}?q=${encodeURIComponent(q.id)}`;
  if (q.language === "shell") {
    link.textContent = "Shell answer (no playground)";
    link.removeAttribute("href");
    link.style.opacity = "0.55";
    link.style.cursor = "default";
  }

  return node;
}

function toggleSet(q, isOn, cardNode) {
  if (isOn) {
    state.set.set(q.id, {
      id: q.id, title: q.title, company: q.company,
      type: q.type, difficulty: q.difficulty, language: q.language,
      batch: q.batch,
    });
    cardNode?.classList.add("is-selected");
  } else {
    state.set.delete(q.id);
    cardNode?.classList.remove("is-selected");
  }
  saveSet();
  renderSet();
}

// ─── My set ───
function renderSet() {
  const list = $("#qb-set-list");
  list.innerHTML = "";
  $("#qb-set-count").textContent = state.set.size;
  if (!state.set.size) {
    list.appendChild(el("div", { class: "qb-set-empty" }, "Pick questions to build your set"));
    return;
  }
  for (const q of state.set.values()) {
    const li = el("li", {},
      el("div", { class: "qb-set-title" },
        document.createTextNode(q.title || q.id),
        el("span", { class: "qb-set-meta" },
          [q.company, q.difficulty, q.language].filter(Boolean).join(" · ")
        )
      ),
      el("button", {
        type: "button",
        class: "qb-set-remove",
        title: "Remove",
        "aria-label": "Remove",
        onclick: () => {
          state.set.delete(q.id);
          saveSet();
          renderSet();
          renderResults();
        },
      }, "×")
    );
    list.appendChild(li);
  }
}

function exportJSON() {
  const blob = new Blob(
    [JSON.stringify(Array.from(state.set.values()), null, 2)],
    { type: "application/json" }
  );
  download(blob, "interview-set.json");
}
function exportMarkdown() {
  const items = state.questions.filter((q) => state.set.has(q.id));
  const lines = ["# My Interview Set", ""];
  items.forEach((q, i) => {
    lines.push(`## ${i + 1}. ${q.title}`);
    lines.push("");
    const meta = [q.company, q.type, q.difficulty, q.language].filter(Boolean).join(" · ");
    if (meta) lines.push(`*${meta}*`, "");
    if (q.schema) lines.push("**Schema:**", "", "```", q.schema, "```", "");
    if (q.solution) lines.push("**Solution:**", "", "```" + (q.language || ""), q.solution, "```", "");
  });
  download(new Blob([lines.join("\n")], { type: "text/markdown" }), "interview-set.md");
}
function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function printable() {
  // Open every detail in current view, then print
  $$(".qb-card-detail").forEach((d) => (d.open = true));
  // For "My Set" print, render only selected
  const printOnlySelected = state.set.size > 0;
  if (printOnlySelected) {
    state.filters.search = "";
    document.querySelectorAll(".qb-card").forEach((c) => {
      if (!state.set.has(c.dataset.id)) c.style.display = "none";
    });
  }
  window.print();
  setTimeout(() => document.querySelectorAll(".qb-card").forEach((c) => (c.style.display = "")), 500);
}

// ─── Wire up ───
function wire() {
  $("#qb-search").addEventListener("input", (e) => {
    state.filters.search = e.target.value;
    applyFilters();
  });
  $("#qb-search").value = state.filters.search;

  $("#qb-sort").value = state.sort;
  $("#qb-sort").addEventListener("change", (e) => {
    state.sort = e.target.value;
    applyFilters();
  });

  $("#qb-prev").addEventListener("click", () => {
    if (state.page > 1) { state.page--; renderResults(); }
  });
  $("#qb-next").addEventListener("click", () => {
    state.page++; renderResults();
  });

  $("#qb-add-page").addEventListener("click", () => {
    const start = (state.page - 1) * PAGE_SIZE;
    const slice = state.filtered.slice(start, start + PAGE_SIZE);
    for (const q of slice) {
      if (!state.set.has(q.id)) toggleSet(q, true, document.querySelector(`.qb-card[data-id="${q.id}"]`));
    }
    renderResults();
  });

  $("#qb-clear").addEventListener("click", () => {
    state.filters.search = "";
    state.filters.languages.clear();
    state.filters.difficulties.clear();
    state.filters.batches.clear();
    state.filters.companies.clear();
    state.filters.types.clear();
    $("#qb-search").value = "";
    $("#qb-company-search").value = "";
    $("#qb-type-search").value = "";
    saveFilters();
    // Cascaded counts re-render every facet — no need to re-fetch data files.
    applyFilters();
  });

  $("#qb-set-clear").addEventListener("click", () => {
    if (!state.set.size) return;
    if (!confirm(`Clear all ${state.set.size} selected questions?`)) return;
    state.set.clear();
    saveSet();
    renderSet();
    renderResults();
  });
  $("#qb-set-export-json").addEventListener("click", exportJSON);
  $("#qb-set-export-md").addEventListener("click", exportMarkdown);
  $("#qb-set-print").addEventListener("click", printable);
}

// ─── Init ───
async function init() {
  loadFilters();
  // URL params override the persisted filter set when present. This is what
  // makes the "Browse by company" cloud + the dynamic filter-share URLs work
  // as deep links — landing on /?company=Google&topic=SQL applies those
  // filters on first paint, not whatever happened to be in localStorage.
  if (location.search) readFiltersFromUrl();
  loadSet();
  if (!state.questions.length) await loadData();
  await renderFacets();
  applyFilters();
  renderSet();
}

// Back / forward should re-apply whichever filter combo lived at that URL —
// otherwise the address bar lies and the question list goes stale.
window.addEventListener("popstate", () => {
  state.filters.search = "";
  state.filters.languages.clear();
  state.filters.difficulties.clear();
  state.filters.batches.clear();
  state.filters.companies.clear();
  state.filters.types.clear();
  readFiltersFromUrl();
  // Re-sync the visible search boxes so they match the URL.
  const searchEl = document.getElementById("qb-search");
  if (searchEl) searchEl.value = state.filters.search;
  applyFilters();
});

wire();
init().then(() => {
  document.documentElement.classList.add("js-ready");
}).catch((err) => {
  console.error(err);
  $("#qb-list").appendChild(
    el("div", { class: "qb-set-empty" },
      `Failed to load data: ${err.message}. Run interview/scripts/xlsx_to_json.py first.`)
  );
});
