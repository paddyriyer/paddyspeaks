/* WMT-L2-02 — Store floor heat map: sales over many rectangular floor areas (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which normalises and clips each rectangle and
   adds up its cells one by one. The evaluator's reference uses 2D prefix sums,
   written independently.
   level: 1 Medium (rectangles given top-left to bottom-right, on the floor) ·
          2 Hard (+ corners in either order, cells with negative net sales) ·
          3 Very Hard (+ rectangles that run off the floor, clipped, or miss it) */
export const kind = "python";
export const entry = "area_sales";
export const signature = "def area_sales(grid: list[list[int]], queries: list[tuple[int, int, int, int]]) -> list[int]:";
export const starter = `def area_sales(grid, queries):
    """grid[r][c]: net sales of floor cell (r, c) for the week, in whole dollars.
    Every row has the same length, and the grid has at least one cell.
    queries: (r1, c1, r2, c2) — two opposite corners of a rectangle of cells,
    both corners included.
    Return the total sales inside each rectangle, in query order."""
    ...
`;

export const prelude = `
def _gen_floor(rows, cols, q, seed, level):
    x = seed
    grid = []
    for i in range(rows):
        row = []
        for j in range(cols):
            x = (1103515245 * x + 12345) % 2147483648
            v = (x >> 16) % 5000
            row.append(v - 400 if level >= 2 else v)
        grid.append(row)
    qs = []
    for k in range(q):
        x = (1103515245 * x + 12345) % 2147483648
        r1 = (x >> 8) % (rows // 3)
        x = (1103515245 * x + 12345) % 2147483648
        r2 = rows - 1 - (x >> 8) % (rows // 3)
        x = (1103515245 * x + 12345) % 2147483648
        c1 = (x >> 8) % (cols // 2)
        x = (1103515245 * x + 12345) % 2147483648
        c2 = c1 + (x >> 8) % (cols - c1)
        if level >= 2 and k % 3 == 1:
            r1, r2 = r2, r1
        if level >= 2 and k % 5 == 2:
            c1, c2 = c2, c1
        if level == 3 and k % 7 == 3:
            r1, c2 = r1 - 25, c2 + 40
        qs.append((r1, c1, r2, c2))
    return grid, qs
`.trim() + "\n";

// Cell by cell, after putting the corners in order and clipping to the floor.
export function oracle(grid, queries) {
  const R = grid.length, C = grid[0].length;
  return queries.map(([a, b, c, d]) => {
    const r1 = Math.max(0, Math.min(a, c)), r2 = Math.min(R - 1, Math.max(a, c));
    const c1 = Math.max(0, Math.min(b, d)), c2 = Math.min(C - 1, Math.max(b, d));
    let s = 0;
    for (let i = r1; i <= r2; i++) for (let j = c1; j <= c2; j++) s += grid[i][j];
    return s;
  });
}

const pyList = (xs) => "[" + xs.join(", ") + "]";
const pyArgs = (grid, qs) => `([${grid.map(pyList).join(", ")}], [${qs.map((t) => "(" + t.join(", ") + ")").join(", ")}])`;

function makeGrid(r, R, C, level) {
  const hot = [r.int(0, R - 1), r.int(0, C - 1)];        // the entrance or an end cap sells more
  return Array.from({ length: R }, (_, i) => Array.from({ length: C }, (_, j) => {
    let v = r.int(0, 60) + (Math.abs(i - hot[0]) + Math.abs(j - hot[1]) <= 1 ? r.int(150, 400) : 0);
    if (level >= 2 && r.chance(0.12)) v = -r.int(5, 80);   // returns outweigh sales in this cell
    return v;
  }));
}

function makeQuery(r, R, C, level) {
  let r1 = r.int(0, R - 1), r2 = r.int(r1, R - 1), c1 = r.int(0, C - 1), c2 = r.int(c1, C - 1);
  if (level >= 2 && r.chance(0.4)) [r1, r2] = [r2, r1];
  if (level >= 2 && r.chance(0.4)) [c1, c2] = [c2, c1];
  if (level === 3 && r.chance(0.35)) {
    if (r.chance(0.5)) r1 = -r.int(1, 3); else c2 = C - 1 + r.int(1, 4);
  }
  return [r1, c1, r2, c2];
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const R = r.int(3, level === 1 ? 5 : 7), C = r.int(4, level === 1 ? 6 : 8);
    const grid = makeGrid(r, R, C, level);
    const qs = Array.from({ length: r.int(3, 6) }, () => makeQuery(r, R, C, level));
    samples.push({ args: pyArgs(grid, qs), expect: pyList(oracle(grid, qs)) });
  }
  const tests = samples.map((t, i) => ({ name: "sample " + (i + 1), args: t.args, expect: t.expect }));

  const R = r.int(4, 6), C = r.int(5, 7);
  const g = makeGrid(r, R, C, 1);
  const edges = [
    ["one cell is its own rectangle", g, [[1, 2, 1, 2], [0, 0, 0, 0]]],
    ["the whole floor, last row and last column included", g, [[0, 0, R - 1, C - 1]]],
    ["one full row and one full column", g, [[R - 1, 0, R - 1, C - 1], [0, C - 1, R - 1, C - 1]]],
    ["no queries: an empty list", g, []],
    ["a floor of a single cell", [[r.int(1, 90)]], [[0, 0, 0, 0]]],
    ["the same rectangle asked twice gives the same total", g, [[1, 1, R - 2, C - 2], [1, 1, R - 2, C - 2]]],
  ];
  if (level >= 2) {
    const gn = makeGrid(r, R, C, 2);
    gn[0][0] = -r.int(10, 50);
    edges.push(["corners given bottom-right first, or bottom-left and top-right", gn, [[R - 1, C - 1, 0, 0], [R - 2, 0, 1, C - 2]]]);
    edges.push(["a cell with negative net sales lowers the total", gn, [[0, 0, 0, 0], [0, 0, 1, 1]]]);
  }
  if (level === 3) {
    edges.push(["a rectangle that runs off the floor is clipped to it", g, [[-2, -3, 1, 2], [R - 2, C - 2, R + 5, C + 5]]]);
    edges.push(["a rectangle entirely off the floor totals 0", g, [[R, 0, R + 3, 2], [0, -6, 2, -1]]]);
    edges.push(["a rectangle larger than the floor on every side is the whole floor", g, [[R + 4, C + 4, -4, -4]]]);
  }
  for (const [name, grid, qs] of edges) tests.push({ name, args: pyArgs(grid, qs), expect: pyList(oracle(grid, qs)) });

  // Timing: 600 x 800 cells and 80 000 tall rectangles. Prefix sums answer each in O(1);
  // summing each rectangle row by row is about 30 million row steps.
  tests.push({
    name: "600 x 800 floor cells, 80,000 rectangles (2D prefix sums)",
    args: `_gen_floor(600, 800, 80000, ${r.int(1, 1_000_000)}, ${level})`,
    limit_s: 8,
  });

  return {
    vars: {
      corner_rule: level === 1
        ? "In this replay every rectangle is given top-left corner first (`r1 <= r2` and `c1 <= c2`) and lies on the floor."
        : level === 2
          ? "Rectangles are drawn by staff from either corner, so `(r1, c1)` may be any corner and `(r2, c2)` the opposite one. Net sales in a cell can be negative when returns credited to that display outweigh its sales. Every rectangle lies on the floor."
          : "Rectangles are drawn by staff from either corner, so `(r1, c1)` may be any corner and `(r2, c2)` the opposite one. Net sales in a cell can be negative when returns credited to that display outweigh its sales. A rectangle may run off the edge of the floor: count only the cells on the floor, and return 0 for a rectangle with no cell on it.",
    },
    samples,
    tests,
  };
}
