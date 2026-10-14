/* MSF-L1-05 — Spreadsheet selections: distinct cells covered by overlapping ranges (Python).
   Simulated practice scenario. All data is generated from the seed. The grid size
   (1,048,576 rows x 16,384 columns, A to XFD) and the A1 reference forms are the public
   spreadsheet conventions; everything else is hypothetical.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which works from the generated rectangles themselves
   (never parsing the strings), compresses both axes and tests every compressed cell
   against every rectangle (O(n^3), small inputs only). The evaluator's reference parses the
   references and sweeps the columns with a segment tree over compressed rows, written
   independently.
   level: 1 Medium (single cells and ranges written top-left first)
          2 Hard (+ whole columns "C:E", whole rows "3:7", corners in any order, the full sheet)
          3 Very Hard (+ "$" absolute markers, several areas in one selection separated by commas,
                       and -1 when any reference is outside the grid) */
export const kind = "python";
export const entry = "cells_selected";
export const signature = "def cells_selected(selections: list[str]) -> int:";
export const starter = `def cells_selected(selections):
    """selections: A1-style references such as "B2:D10" or "C3".
    Return how many distinct cells of the 1,048,576 x 16,384 sheet they cover."""
    ...
`;

export const prelude = `
def _col_name(c):
    s = ''
    while c:
        c, m = divmod(c - 1, 26)
        s = chr(65 + m) + s
    return s


def _gen_selections(n, seed, level):
    x, out = seed, []
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 8) % m
    for _ in range(n):
        areas = []
        for _ in range(1 + (rnd(3) == 0 if level == 3 else 0)):
            kind = rnd(20) if level >= 2 else 5
            if kind == 0:
                a = 1 + rnd(16384); b = min(16384, a + rnd(40))
                areas.append('%s:%s' % ((_col_name(a), _col_name(b)) if rnd(2) else (_col_name(b), _col_name(a))))
            elif kind == 1:
                a = 1 + rnd(1048576); b = min(1048576, a + rnd(5000))
                areas.append('%d:%d' % ((a, b) if rnd(2) else (b, a)))
            else:
                c1 = 1 + rnd(16384); r1 = 1 + rnd(1048576)
                c2 = min(16384, c1 + rnd(400)); r2 = min(1048576, r1 + rnd(20000))
                d = '$' if level == 3 and rnd(2) else ''
                if level >= 2 and rnd(2):
                    c1, c2 = c2, c1
                areas.append('%s%s%s%d:%s%s%s%d' % (d, _col_name(c1), d, r1, d, _col_name(c2), d, r2))
        out.append(','.join(areas))
    return (out,)
`.trim() + "\n";

const MAXR = 1048576;
const MAXC = 16384;

export const colName = (c) => {
  let s = "";
  while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); }
  return s;
};

// Union area of rectangles {c1, c2, r1, r2} (inclusive), by compressing both axes.
export function oracle(rects) {
  if (rects.some((q) => q.bad)) return -1;
  if (!rects.length) return 0;
  const xs = [...new Set(rects.flatMap((q) => [q.c1, q.c2 + 1]))].sort((a, b) => a - b);
  const ys = [...new Set(rects.flatMap((q) => [q.r1, q.r2 + 1]))].sort((a, b) => a - b);
  let total = 0;
  for (let i = 0; i + 1 < xs.length; i++) {
    for (let j = 0; j + 1 < ys.length; j++) {
      if (rects.some((q) => q.c1 <= xs[i] && xs[i] <= q.c2 && q.r1 <= ys[j] && ys[j] <= q.r2)) total += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]);
    }
  }
  return total;
}

// How a rectangle is written. style: "cell" | "range" | "cols" | "rows"; corner: 0..3; dollar: bool.
function write(q, r, level) {
  const d = () => (level === 3 && r.chance(0.4) ? "$" : "");
  const cell = (c, row) => d() + colName(c) + d() + row;
  if (q.style === "cols") return level >= 2 && r.chance(0.3) ? `${d()}${colName(q.c2)}:${d()}${colName(q.c1)}` : `${d()}${colName(q.c1)}:${d()}${colName(q.c2)}`;
  if (q.style === "rows") return level >= 2 && r.chance(0.3) ? `${d()}${q.r2}:${d()}${q.r1}` : `${d()}${q.r1}:${d()}${q.r2}`;
  if (q.style === "cell") return cell(q.c1, q.r1);
  const corner = level >= 2 ? r.int(0, 3) : 0;
  if (corner === 0) return `${cell(q.c1, q.r1)}:${cell(q.c2, q.r2)}`;      // top-left : bottom-right
  if (corner === 1) return `${cell(q.c2, q.r2)}:${cell(q.c1, q.r1)}`;      // bottom-right : top-left
  if (corner === 2) return `${cell(q.c2, q.r1)}:${cell(q.c1, q.r2)}`;      // top-right : bottom-left
  return `${cell(q.c1, q.r2)}:${cell(q.c2, q.r1)}`;                        // bottom-left : top-right
}
const R = (c1, r1, c2, r2, style = "range") => ({ c1, r1, c2, r2, style: style === "range" && c1 === c2 && r1 === r2 ? "cell" : style });
const cols = (a, b) => ({ c1: Math.min(a, b), c2: Math.max(a, b), r1: 1, r2: MAXR, style: "cols" });
const rows = (a, b) => ({ r1: Math.min(a, b), r2: Math.max(a, b), c1: 1, c2: MAXC, style: "rows" });

const pyArgs = (sels) => `([${sels.map((s) => `'${s}'`).join(", ")}],)`;

export function generate(r, level) {
  // A selection is a list of areas (several only at Very Hard), written as one string.
  const render = (sel) => sel.map((q) => (q.text ? q.text : write(q, r, level))).join(",");
  const randomArea = (ox, oy) => {
    const roll = r.next();
    if (level >= 2 && roll < 0.12) { const a = ox + r.int(0, 25); return cols(a, a + r.int(0, 3)); }
    if (level >= 2 && roll < 0.24) { const a = oy + r.int(0, 80); return rows(a, a + r.int(0, 5)); }
    if (roll < 0.35) { const c = ox + r.int(0, 25), y = oy + r.int(0, 80); return R(c, y, c, y); }
    const c1 = ox + r.int(0, 20), y1 = oy + r.int(0, 60);
    return R(c1, y1, c1 + r.int(0, 8), y1 + r.int(0, 30));
  };
  const randomCase = () => {
    const ox = r.pick([1, 3, 26, 700, 16300]), oy = r.pick([1, 40, 5000, 1048400]);
    const n = level === 1 ? r.int(4, 6) : r.int(5, 8);
    const sels = [];
    for (let k = 0; k < n; k++) {
      const sel = [randomArea(ox, oy)];
      if (level === 3 && r.chance(0.35)) sel.push(randomArea(ox, oy));
      sels.push(sel);
    }
    if (sels.length > 1) sels.push(sels[r.int(0, sels.length - 1)].map((q) => ({ ...q })));   // the same range selected twice
    const clamp = (q) => { q.c2 = Math.min(q.c2, MAXC); q.r2 = Math.min(q.r2, MAXR); return q; };
    sels.forEach((sel) => sel.forEach(clamp));
    return sels;
  };
  const instance = (sels) => ({ args: pyArgs(sels.map(render)), expect: String(oracle(sels.flat())) });

  const samples = [];
  for (let i = 0; i < 3; i++) samples.push(instance(randomCase()));
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), ...s }));

  const c = r.int(2, 20), y = r.int(2, 50), w = r.int(2, 6), h = r.int(2, 9);
  const edges = [
    ["no selections: no cells", []],
    ["a single cell is one cell", [[R(c, y, c, y)]]],
    ["the same range twice counts once", [[R(c, y, c + w, y + h)], [R(c, y, c + w, y + h)]]],
    ["overlapping ranges: the shared cells count once", [[R(c, y, c + w, y + h)], [R(c + 1, y + 1, c + w + 2, y + h + 3)]]],
    ["ranges that touch but do not overlap", [[R(c, y, c, y + h)], [R(c + 1, y, c + 1, y + h)]]],
    ["a range inside another adds nothing", [[R(c, y, c + w + 2, y + h + 2)], [R(c + 1, y + 1, c + w, y + h)]]],
    ["AA comes after Z", [[R(26, y, 27, y)]]],
    ["AZ:BA spans two columns, ZZ:AAA two more", [[R(52, 1, 53, 1)], [R(702, 1, 703, 1)]]],
    ["the last cell of the sheet, XFD1048576", [[R(MAXC - 1, MAXR - 2, MAXC, MAXR)], [R(MAXC, MAXR, MAXC, MAXR)]]],
  ];
  if (level >= 2) {
    edges.push(["a whole column is 1,048,576 cells", [[cols(c, c)]]]);
    edges.push(["a whole row and a whole column cross at one cell", [[cols(c, c)], [rows(y, y)]]]);
    edges.push(["the corners can be written in any order", [[R(c, y, c + w, y + h)], [{ ...R(c + w + 1, y, c + w + 3, y + h), text: `${colName(c + w + 3)}${y}:${colName(c + w + 1)}${y + h}` }]]]);
    edges.push(["the full sheet, A:XFD, overlapped by everything else", [[cols(1, MAXC)], [rows(y, y + h)], [R(c, y, c + w, y + h)]]]);
    edges.push(["a column range written right to left", [[{ ...cols(c, c + w), text: `${colName(c + w)}:${colName(c)}` }]]]);
  }
  if (level === 3) {
    edges.push(["$ marks change nothing", [[{ ...R(c, y, c + w, y + h), text: `$${colName(c)}$${y}:${colName(c + w)}$${y + h}` }], [R(c, y, c + w, y + h)]]]);
    edges.push(["two areas in one selection, overlapping each other", [[R(c, y, c + w, y + h), R(c + 1, y + 1, c + w + 1, y + h + 1)]]]);
    edges.push(["column XFE is outside the grid: -1", [[R(c, y, c + w, y + h)], [{ c1: MAXC, c2: MAXC + 1, r1: 1, r2: 1, bad: true, text: `XFD1:XFE1` }]]]);
    edges.push(["row 0 is outside the grid: -1", [[{ c1: 1, c2: 1, r1: 0, r2: 0, bad: true, text: "A0" }]]]);
    edges.push(["row 1,048,577 is outside the grid: -1", [[R(c, y, c, y)], [{ c1: 2, c2: 2, r1: MAXR + 1, r2: MAXR + 1, bad: true, text: `B${MAXR + 1}` }]]]);
    edges.push(["one bad area inside a multi-area selection: -1", [[R(c, y, c + w, y + h), { c1: 1, c2: 1, r1: 0, r2: 3, bad: true, text: `A0:A3` }]]]);
    edges.push(["row 1,048,576 and column XFD are inside the grid", [[R(MAXC, MAXR, MAXC, MAXR)], [{ ...R(1, MAXR, 1, MAXR), text: `$A$${MAXR}` }]]]);
  }
  for (const [name, sels] of edges) tests.push({ name, ...instance(sels) });

  tests.push({
    name: "2,000 selections spanning millions of cells each (compress the coordinates; never touch cells)",
    args: `_gen_selections(2000, ${r.int(1, 1_000_000)}, ${level})`,
    limit_s: 8,
  });

  return {
    vars: {
      forms_rule: level === 1
        ? "In this file every reference is a single cell (`C3`) or a range written top-left first (`B2:D10`)."
        : "A reference is a single cell (`C3`), a range given by any two opposite corners in either order (`B2:D10`, `D10:B2`, `D2:B10`), a run of whole columns (`C:E`, also `E:C`) or a run of whole rows (`3:7`, also `7:3`).",
      extra_rule: level === 3
        ? "References may carry `$` absolute markers (`$B$2:D$10`), which change nothing here, and one selection may hold several areas separated by commas (`A1:B2,D4`). If any reference anywhere is outside the grid (a column after XFD, row 0, or a row after 1,048,576), return `-1`."
        : "Every reference in this file is inside the grid, and each selection is one area.",
    },
    samples,
    tests,
  };
}
