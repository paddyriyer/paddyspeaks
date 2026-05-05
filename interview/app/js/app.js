// ════════════════════════════════════════════════════════════
// Interview Question Bank — browse, filter, pick
// Static, no build step. Loads ../data/*.json relative to app/.
// ════════════════════════════════════════════════════════════

const DATA_BASE = "../data";
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
function applyFilters() {
  const f = state.filters;
  const needle = f.search.trim().toLowerCase();
  state.filtered = state.questions.filter((q) => {
    if (f.languages.size && !f.languages.has(q.language)) return false;
    if (f.difficulties.size && !f.difficulties.has(q.difficulty)) return false;
    if (f.batches.size && !f.batches.has(q.batch)) return false;
    if (f.companies.size && !f.companies.has(q.company)) return false;
    if (f.types.size && !f.types.has(q.type)) return false;
    if (needle) {
      const hay = [q.title, q.company, q.type, q.subtopic, q.schema, q.solution]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const diffOrder = { Easy: 0, Medium: 1, Hard: 2 };
  if (state.sort === "title") state.filtered.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  else if (state.sort === "company") state.filtered.sort((a, b) => (a.company || "~").localeCompare(b.company || "~"));
  else if (state.sort === "difficulty") state.filtered.sort(
    (a, b) => (diffOrder[a.difficulty] ?? 9) - (diffOrder[b.difficulty] ?? 9)
  );

  state.page = 1;
  saveFilters();
  renderResults();
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
        applyFilters();
        renderChipFacet(containerSel, key, items);
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

async function renderFacets() {
  const [companies, topics, difficulties, languages] = await Promise.all([
    fetch(`${DATA_BASE}/companies.json`).then((r) => r.json()),
    fetch(`${DATA_BASE}/topics.json`).then((r) => r.json()),
    fetch(`${DATA_BASE}/difficulties.json`).then((r) => r.json()),
    fetch(`${DATA_BASE}/languages.json`).then((r) => r.json()),
  ]);

  renderChipFacet("#qb-lang-facet", "languages", languages);
  renderChipFacet("#qb-diff-facet", "difficulties", difficulties);

  const batches = state.manifest.batches.map((b) => ({ name: b.id, count: b.count, label: b.label }));
  // Render batches with custom labels
  const batchEl = $("#qb-batch-facet");
  batchEl.innerHTML = "";
  for (const b of batches) {
    const active = state.filters.batches;
    const chip = el("button", {
      type: "button",
      class: "qb-chip" + (active.has(b.name) ? " is-active" : ""),
      title: b.name,
      onclick: () => {
        if (active.has(b.name)) active.delete(b.name); else active.add(b.name);
        chip.classList.toggle("is-active");
        applyFilters();
      },
    },
      document.createTextNode(b.label),
      el("span", { class: "qb-chip-count" }, ` ${b.count}`)
    );
    batchEl.appendChild(chip);
  }

  state._companies = companies;
  state._types = topics.types;

  const renderCo = () => renderCheckboxFacet("#qb-company-facet", "companies", state._companies, "#qb-company-search");
  const renderTy = () => renderCheckboxFacet("#qb-type-facet", "types", state._types, "#qb-type-search");
  renderCo();
  renderTy();
  $("#qb-company-search").addEventListener("input", renderCo);
  $("#qb-type-search").addEventListener("input", renderTy);
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
    init().catch(console.error);
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
  loadSet();
  if (!state.questions.length) await loadData();
  await renderFacets();
  applyFilters();
  renderSet();
}

wire();
init().catch((err) => {
  console.error(err);
  $("#qb-list").appendChild(
    el("div", { class: "qb-set-empty" },
      `Failed to load data: ${err.message}. Run interview/scripts/xlsx_to_json.py first.`)
  );
});
