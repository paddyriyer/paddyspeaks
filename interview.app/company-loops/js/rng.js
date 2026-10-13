/* Seeded random numbers for question generators (Company Interview Loops).
   The same seed gives the same question in every browser and in CI
   (interview/company-loops/validate.mjs imports this file). Never use Math.random
   in a generator. */
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  const next = () => {                       // mulberry32
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    seed,
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),          // inclusive
    pick: (xs) => xs[Math.floor(next() * xs.length)],
    chance: (p) => next() < p,
    shuffle: (xs) => { const a2 = xs.slice(); for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; },
    sample: (xs, k) => r.shuffle(xs).slice(0, k),
  };
  return r;
}

/* Fixed-width formatting helpers generators share. */
export const pad2 = (n) => String(n).padStart(2, "0");
export function ts(day, secondsOfDay) {          // "2026-09-14", 3725 -> "2026-09-14 01:02:05+00"
  const h = Math.floor(secondsOfDay / 3600), m = Math.floor((secondsOfDay % 3600) / 60), s = secondsOfDay % 60;
  return `${day} ${pad2(h)}:${pad2(m)}:${pad2(s)}+00`;
}
export function sqlLit(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return "'" + String(v).replace(/'/g, "''") + "'";
}
export function insertSQL(table, cols, rows) {
  if (!rows.length) return "";
  return `INSERT INTO ${table} (${cols.join(", ")}) VALUES\n` + rows.map((r) => "  (" + r.map(sqlLit).join(", ") + ")").join(",\n") + ";\n";
}
