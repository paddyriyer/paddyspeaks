// ════════════════════════════════════════════════════════════
// Community Leaderboard — page controller
// Reads the anonymous board via ../js/lb-client.js and renders it.
// No PII is ever handled here: rows carry only a random alias + score.
// ════════════════════════════════════════════════════════════
import { lbList, myEntries, lbDelete } from "../js/lb-client.js";

const state = { cat: "", period: "week" };

const el = {
  status: document.getElementById("lb-status"),
  table: document.getElementById("lb-table"),
  body: document.getElementById("lb-body"),
  mysec: document.getElementById("lb-mysec"),
  mylist: document.getElementById("lb-mylist"),
  catGroup: document.getElementById("lb-cat"),
  periodGroup: document.getElementById("lb-period"),
};

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

function renderRows(entries) {
  const mine = myAliasKeys();
  el.body.innerHTML = entries
    .map((r) => {
      const isMine = mine.has(`${r.category || ""}|${r.alias}`);
      const catLabel = CAT_LABEL[r.category] || "—";
      const diff = r.difficulty ? esc(r.difficulty) : "—";
      return `<tr class="${isMine ? "lb-mine" : ""}">
        <td class="num lb-rank">${r.rank}</td>
        <td class="lb-alias">${esc(r.alias)}${isMine ? '<span class="lb-mine-tag">YOU</span>' : ""}</td>
        <td class="hide-sm"><span class="lb-pill">${esc(catLabel)}</span></td>
        <td class="hide-sm"><span class="lb-pill">${diff}</span></td>
        <td class="num"><span class="lb-pct">${r.percentage}%</span></td>
      </tr>`;
    })
    .join("");
}

async function load() {
  setStatus("Loading…");
  showTable(false);
  try {
    const data = await lbList({ category: state.cat, period: state.period, limit: 25 });
    if (data.suppressed) {
      const min = data.min || 5;
      setStatus(
        `The leaderboard for this view will appear once at least ${min} candidates have taken part. Be one of the first — take a Skill Check and add your score.`
      );
      return;
    }
    const entries = data.entries || [];
    if (!entries.length) {
      setStatus("No scores here yet. Take a Skill Check and be the first to appear.");
      return;
    }
    renderRows(entries);
    setStatus("");
    showTable(true);
  } catch (err) {
    setStatus("Couldn’t load the leaderboard right now. Please try again in a moment.");
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
