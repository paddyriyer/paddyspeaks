/* HGF-L1-03 — Derivative models through declared base-model metadata (SQL, recursive CTE).
   Simulated practice scenario. All data is generated from the seed. Model cards are user
   content: the base-model declarations here are hypothetical and may be wrong (pointing at
   repos that are not on the hub, at the model itself, or round in a cycle).

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   The oracle runs a breadth-first search from every model in JavaScript; the evaluator's
   reference is a recursive CTE.
   level: 1 Medium (a forest: every derivative declares one base; no merges)
          2 Hard (+ merges with several bases, so one descendant is reachable by several paths;
            bases that are not on the hub; a model that lists itself)
          3 Very Hard (+ declarations that form cycles) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const ORGS = ["acme-labs", "riverbank", "northwind", "quill", "fjord", "lumen", "orbit", "kestrel"];
const BASES = ["foundation-1b", "coder-3b", "vision-small", "speech-base", "embed-base", "tiny-2b"];
const TAG = { finetune: "ft", adapter: "lora", quantized: "q4" };
const RELS = ["finetune", "adapter", "quantized", "merge"];

export function generate(r, level) {
  const models = [];            // {id, rel}
  const links = [];             // [child, base]
  const ids = new Set();
  const uniq = (s) => { let x = s, k = 2; while (ids.has(x)) x = s + "-" + k++; ids.add(x); return x; };
  const stem = (id) => id.split("/")[1].split("-").slice(0, 2).join("-");

  const nOrig = level === 1 ? 2 : 3;
  for (const b of r.sample(BASES, nOrig)) models.push({ id: uniq(r.pick(ORGS) + "/" + b), rel: null });
  const nDer = level === 1 ? r.int(7, 9) : level === 2 ? r.int(9, 11) : r.int(10, 12);
  for (let i = 0; i < nDer; i++) {
    const merge = level >= 2 && i >= 2 && r.chance(0.25);
    if (merge) {
      const bases = r.sample(models, r.int(2, 3));
      const m = { id: uniq(r.pick(ORGS) + "/merge-" + stem(bases[0].id)), rel: "merge" };
      models.push(m);
      for (const b of bases) links.push([m.id, b.id]);
    } else {
      // Prefer recent models as bases so chains get deep.
      const base = r.chance(0.5) ? models[models.length - 1 - r.int(0, Math.min(2, models.length - 1))] : r.pick(models);
      const rel = r.pick(["finetune", "adapter", "quantized"]);
      const m = { id: uniq(r.pick(ORGS) + "/" + stem(base.id) + "-" + TAG[rel]), rel };
      models.push(m);
      links.push([m.id, base.id]);
    }
  }
  const ders = models.filter((m) => m.rel);
  if (level >= 2) {
    // A guaranteed diamond: a merge of two derivatives of the same model.
    const root = models[0];
    const a = { id: uniq(r.pick(ORGS) + "/" + stem(root.id) + "-ft"), rel: "finetune" };
    const b = { id: uniq(r.pick(ORGS) + "/" + stem(root.id) + "-lora"), rel: "adapter" };
    const m = { id: uniq(r.pick(ORGS) + "/merge-" + stem(root.id)), rel: "merge" };
    models.push(a, b, m);
    links.push([a.id, root.id], [b.id, root.id], [m.id, a.id], [m.id, b.id]);
    // A base that is not on the hub (deleted, private or mistyped).
    const ext = r.pick(ders);
    links.push([ext.id, r.pick(["external", "someone-else", "old-org"]) + "/" + r.pick(["base-model", "llm-7b", "unknown"])]);
    // A model that lists itself among its bases.
    const self = r.pick(ders);
    links.push([self.id, self.id]);
  }
  const children = () => {
    const ch = new Map();
    for (const [c, b] of links) {
      if (c === b) continue;
      if (!ch.has(b)) ch.set(b, new Set());
      ch.get(b).add(c);
    }
    return ch;
  };
  const reachFrom = (x, ch) => {
    const seen = new Set([x]), out = new Set(), stack = [x];
    while (stack.length) {
      const y = stack.pop();
      for (const z of ch.get(y) || []) {
        if (z !== x) out.add(z);
        if (!seen.has(z)) { seen.add(z); stack.push(z); }
      }
    }
    return out;
  };
  if (level === 3) {
    // Mistaken declarations that close cycles: a model declares one of its own descendants as a base.
    let made = 0;
    for (const x of r.shuffle(models.filter((m) => m.rel))) {
      if (made >= 2) break;
      const desc = [...reachFrom(x.id, children())].sort().filter((d) => !links.some(([c, b]) => c === x.id && b === d));
      if (!desc.length) continue;
      links.push([x.id, r.pick(desc)]);
      made++;
    }
    if (!made) throw new Error("HGF-L1-03: could not build a cycle");
  }

  const relOf = new Map(models.map((m) => [m.id, m.rel]));
  const onHub = new Set(models.map((m) => m.id));
  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const solve = (o = {}) => {
    const ch = children();
    const cands = o.external ? [...new Set([...onHub, ...links.map((l) => l[1])])] : [...onHub];
    const out = [];
    for (const x of cands) {
      const direct = ch.get(x) || new Set();
      let desc;
      if (o.directOnly) desc = [...direct];
      else if (o.paths) {
        desc = [];
        const walk = (y) => { for (const z of ch.get(y) || []) { desc.push(z); walk(z); } };
        walk(x);
      } else {
        desc = [...reachFrom(x, ch)];
        if (o.self) {
          // Wrongly counted: the model itself, when a self-declaration or a cycle leads back to it.
          const back = [...direct].some((z) => reachFrom(z, ch).has(x));
          const selfLoop = links.some(([c, b]) => c === x && b === x);
          if (back || selfLoop) desc.push(x);
        }
      }
      if (!desc.length) continue;
      const cnt = (rel) => desc.filter((d) => relOf.get(d) === rel).length;
      out.push([x, direct.size, desc.length, cnt("finetune"), cnt("adapter"), cnt("quantized"), cnt("merge")]);
    }
    return out.sort((a, b) => b[2] - a[2] || cmp(a[0], b[0]));
  };
  const rows = solve();

  const diagnostics = [
    { message: "Only direct derivatives were counted. A descendant is anything reachable through base-model declarations, at any depth.", rows: solve({ directOnly: true }) },
  ];
  if (level === 2) diagnostics.push({ message: "Paths were counted, not models. A merge reachable through two of its bases is still one descendant.", rows: solve({ paths: true }) });
  if (level >= 2) {
    diagnostics.push({ message: "A model was counted as its own descendant. A self-declaration or a cycle never makes a model its own derivative.", rows: solve({ self: true }) });
    diagnostics.push({ message: "Bases that are not in `models` were reported. Report only models on the hub; a declared base that is not there has no row.", rows: solve({ external: true }) });
  }

  models.sort((a, b) => cmp(a.id, b.id));
  links.sort((a, b) => cmp(a[0], b[0]) || cmp(a[1], b[1]));
  const mCols = ["model_id", "base_relation"];
  const mRows = models.map((m) => [m.id, m.rel]);
  const lCols = ["model_id", "base_model_id"];
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE models (\n  model_id TEXT PRIMARY KEY,\n  base_relation TEXT CHECK (base_relation IN ('finetune', 'adapter', 'quantized', 'merge'))\n);\n" +
    "CREATE TABLE model_bases (\n  model_id TEXT NOT NULL REFERENCES models(model_id),\n  base_model_id TEXT NOT NULL,\n  PRIMARY KEY (model_id, base_model_id)\n);\n" +
    insertSQL("models", mCols, mRows) + insertSQL("model_bases", lCols, links);

  return {
    vars: {
      models: models.length,
      links: links.length,
      data_rule: level === 1
        ? "In this sample every derivative declares exactly one base, and no declaration loops back."
        : level === 2
          ? "A merge declares several bases, so a model can be reachable from one ancestor by more than one path. Some declared bases are not in `models` (deleted, private or mistyped), and one model lists itself."
          : "Declarations are user content and can be wrong: some declared bases are not in `models`, a model can list itself, and some declarations form cycles. Your query must terminate and must never count a model as its own descendant.",
    },
    setup,
    tables: [
      { name: "models", columns: mCols, rows: mRows },
      { name: "model_bases", columns: lCols, rows: links },
    ],
    expected: { columns: ["model_id", "direct_derivatives", "descendants", "finetunes", "adapters", "quantized", "merges"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
