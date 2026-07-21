// ════════════════════════════════════════════════════════════
// Community Leaderboard — page controller
// Reads the anonymous board via ../js/lb-client.js and renders it.
// No PII is ever handled here: rows carry only a random alias + score.
// ════════════════════════════════════════════════════════════
import { lbList, myEntries, lbDelete } from "../js/lb-client.js";

const state = { cat: "", period: "week" };

const el = {
  status: document.getElementById("lb-status"),
  demo: document.getElementById("lb-demo"),
  table: document.getElementById("lb-table"),
  body: document.getElementById("lb-body"),
  mysec: document.getElementById("lb-mysec"),
  mylist: document.getElementById("lb-mylist"),
  catGroup: document.getElementById("lb-cat"),
  periodGroup: document.getElementById("lb-period"),
};

// Illustrative "sample preview" rows. Shown ONLY when the live board has nothing
// to display (backend not yet provisioned, or fewer than the k-anon minimum of
// real entries). A visible banner marks them as samples — they are never passed
// off as real participants, and any genuine entry immediately replaces them.
const SAMPLE = [
  { alias: "Recursive Monk #300",   category: "python", difficulty: "expert", percentage: 98 },
  { alias: "Query Falcon #238",     category: "sql",    difficulty: "hard",   percentage: 97 },
  { alias: "Cobalt Sage #071",      category: "sql",    difficulty: "expert", percentage: 95 },
  { alias: "Indexed Kestrel #512",  category: "python", difficulty: "hard",   percentage: 94 },
  { alias: "Nimble Otter #442",     category: "sql",    difficulty: "medium", percentage: 92 },
  { alias: "Streaming Heron #188",  category: "python", difficulty: "medium", percentage: 91 },
  { alias: "Amber Analyst #925",    category: "sql",    difficulty: "hard",   percentage: 90 },
  { alias: "Lambda Warden #337",    category: "python", difficulty: "expert", percentage: 89 },
  { alias: "Verdant Lynx #613",     category: "sql",    difficulty: "medium", percentage: 88 },
  { alias: "Windowed Scout #204",   category: "python", difficulty: "hard",   percentage: 87 },
  { alias: "Sharded Badger #756",   category: "sql",    difficulty: "easy",   percentage: 85 },
  { alias: "Atomic Navigator #049", category: "python", difficulty: "medium", percentage: 84 },
];

const CAT_LABEL = { sql: "SQL", python: "Python" };
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function setStatus(msg) {
  el.status.textContent = msg;
  el.status.hidden = !msg;
}
function showTable(show) {
  el.table.hidden = !show;
}

// aliases the current browser owns, keyed by "category|alias" for own-row highlight
function myAliasKeys() {
  const keys = new Set();
  for (const e of myEntries()) {
    if (e.alias) keys.add(`${e.category || ""}|${e.alias}`);
  }
  return keys;
}

function renderRows(entries, sample = false) {
  const mine = sample ? new Set() : myAliasKeys();
  el.body.innerHTML = entries
    .map((r) => {
      const isMine = mine.has(`${r.category || ""}|${r.alias}`);
      const catLabel = CAT_LABEL[r.category] || "—";
      const diff = r.difficulty ? esc(r.difficulty) : "—";
      const cls = [isMine ? "lb-mine" : "", sample ? "lb-sample" : ""].filter(Boolean).join(" ");
      return `<tr class="${cls}">
        <td class="num lb-rank">${r.rank}</td>
        <td class="lb-alias">${esc(r.alias)}${isMine ? '<span class="lb-mine-tag">YOU</span>' : ""}</td>
        <td class="hide-sm"><span class="lb-pill">${esc(catLabel)}</span></td>
        <td class="hide-sm"><span class="lb-pill">${diff}</span></td>
        <td class="num"><span class="lb-pct">${r.percentage}%</span></td>
      </tr>`;
    })
    .join("");
}

// Fill the board with clearly-labelled sample rows for the current tab.
function renderSample() {
  const rows = SAMPLE
    .filter((r) => !state.cat || r.category === state.cat)
    .sort((a, b) => b.percentage - a.percentage)
    .map((r, i) => ({ ...r, rank: i + 1 }));
  renderRows(rows, true);
  setStatus("");
  el.demo.hidden = false;
  showTable(true);
}

async function load() {
  setStatus("Loading…");
  showTable(false);
  el.demo.hidden = true;
  try {
    const data = await lbList({ category: state.cat, period: state.period, limit: 25 });
    const entries = data.entries || [];
    // Real entries take precedence. Otherwise (suppressed / empty / dormant
    // backend) fall back to the labelled sample preview so the board is never bare.
    if (!data.suppressed && entries.length) {
      renderRows(entries);
      setStatus("");
      showTable(true);
      return;
    }
    renderSample();
  } catch (err) {
    // backend unreachable / not provisioned → sample preview
    renderSample();
  }
}

function wireTabs(group, key) {
  if (!group) return;
  group.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[role='tab']");
    if (!btn) return;
    const val = key === "cat" ? btn.dataset.cat : btn.dataset.period;
    if (state[key] === val) return;
    state[key] = val;
    for (const b of group.querySelectorAll("button[role='tab']")) {
      b.setAttribute("aria-selected", b === btn ? "true" : "false");
    }
    load();
  });
}

function renderMine() {
  const entries = myEntries();
  if (!entries.length) {
    el.mysec.hidden = true;
    el.mylist.innerHTML = "";
    return;
  }
  el.mysec.hidden = false;
  el.mylist.innerHTML = entries
    .slice()
    .reverse()
    .map((e) => {
      const cat = CAT_LABEL[e.category] || e.category || "—";
      return `<div class="lb-myrow" data-id="${esc(e.id)}">
        <span class="lb-alias">${esc(e.alias || "—")}</span>
        <span class="lb-pill">${esc(cat)}</span>
        <span>${e.raw != null ? e.raw + "%" : "—"}</span>
        <button class="lb-del" type="button" data-del="${esc(e.id)}">Delete</button>
      </div>`;
    })
    .join("");
}

el.mylist?.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("button[data-del]");
  if (!btn) return;
  const id = btn.dataset.del;
  btn.disabled = true;
  btn.textContent = "Deleting…";
  try {
    await lbDelete(id);
    renderMine();
    load(); // refresh the public board too
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Delete failed — retry";
  }
});

wireTabs(el.catGroup, "cat");
wireTabs(el.periodGroup, "period");
renderMine();
load();
