/* Result comparison shared by the page (app.js) and CI (interview/company-loops/validate.mjs).
   Cells are compared by meaning, not by text: numbers numerically (to 6 places),
   dates and timestamps as instants, booleans as t/f, NULL as null. */
export function normCell(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? "t" : "f";
  if (typeof v === "bigint") return "n:" + String(v);
  if (typeof v === "number") return "n:" + (Math.round(v * 1e6) / 1e6);
  if (v instanceof Date) return "ts:" + v.getTime();
  const s = String(v).trim();
  if (/^-?\d+(\.\d+)?$/.test(s)) return "n:" + (Math.round(Number(s) * 1e6) / 1e6);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?))?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/);
  if (m) {
    let tz = m[3] || "Z";
    if (/^[+-]\d{2}$/.test(tz)) tz += ":00";
    else if (/^[+-]\d{4}$/.test(tz)) tz = tz.slice(0, 3) + ":" + tz.slice(3);
    const ms = Date.parse(m[1] + "T" + (m[2] || "00:00:00") + tz);
    if (!Number.isNaN(ms)) return "ts:" + ms;
  }
  if (s === "true" || s === "t") return "t";
  if (s === "false" || s === "f") return "f";
  return s;
}
export const rowKey = (r) => JSON.stringify(r.map(normCell));

/* "exact" (same rows, same order), "order" (same rows, different order) or "". */
export function compareRows(got, want) {
  if (got.length === want.length && got.every((r, i) => rowKey(r) === rowKey(want[i]))) return "exact";
  const a = got.map(rowKey).sort(), b = want.map(rowKey).sort();
  if (a.length === b.length && a.every((k, i) => k === b[i])) return "order";
  return "";
}

/* Fill {{name}} placeholders. Values are plain text with `code` spans. */
export function fill(html, vars, escape) {
  return html.replace(/\{\{(\w+)\}\}/g, (all, k) => (k in vars ? inlineVar(String(vars[k]), escape) : all));
}
function inlineVar(s, escape) {
  return escape(s).replace(/`([^`]+)`/g, "<code>$1</code>");
}

/* Does the answer mention a follow-up rule's keyword? Whole words only, so
   "ttl" never fires on "settle" or "set" on "settlement"; a keyword may take
   a common ending ("partition" matches "partitions" and "partitioned").
   `text` is already lower-case. */
export function mentions(text, keyword) {
  const k = keyword.trim().toLowerCase();
  if (!k) return false;
  const kw = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  // Word boundaries apply only where the keyword itself starts or ends with a word character.
  const head = /^[a-z0-9_]/.test(k) ? "(?:^|[^a-z0-9_])" : "";
  const tail = /[a-z0-9_]$/.test(k) ? "(?:s|es|ed|d|ing|er|ers|ly)?(?![a-z0-9_])" : "";
  return new RegExp(head + kw + tail).test(text);
}
