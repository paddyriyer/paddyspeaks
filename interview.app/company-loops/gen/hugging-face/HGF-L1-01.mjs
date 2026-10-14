/* HGF-L1-01 — Weekly downloads per model under this exercise's counting rule (SQL).
   Simulated practice scenario. All data is generated from the seed. The counting rule
   (one download per client per model per UTC day, designated files only, listed mirror
   clients excluded) is this exercise's rule, not a statement of how any hub counts.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   The oracle walks the request log in JavaScript; the evaluator's reference is SQL.
   level: 1 Medium (one designated file per library; repeats in a day; error statuses;
            mirrors listed for the whole period)
          2 Hard (+ several designated files per library, look-alike paths in sub-folders,
            requests either side of UTC midnight and of the Sunday/Monday week boundary)
          3 Very Hard (+ mirror listings that start and end inside the period) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const MONDAYS = ["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"];
const MODELS = [
  ["acme-labs/summarizer-base", "transformers"],
  ["riverbank/ner-tagger-small", "transformers"],
  ["northwind/pixel-diffusion", "diffusers"],
  ["quill/embed-small-v2", "sentence-transformers"],
  ["fjord/leaf-classifier", "timm"],
  ["lumen/speech-de-tiny", "transformers"],
];
const COUNTED = {
  transformers: [["config.json"], ["model.safetensors"]],
  diffusers: [["model_index.json"], ["unet/diffusion_pytorch_model.safetensors"]],
  "sentence-transformers": [["modules.json"], ["config_sentence_transformers.json"]],
  timm: [["config.json"], ["model.safetensors"]],
};
const OTHER = ["README.md", "tokenizer.json", ".gitattributes", "generation_config.json"];
const DECOYS = ["onnx/config.json", "onnx/model.safetensors"];
const HEX = "0123456789abcdef".split("");

function addDays(day, n) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function generate(r, level) {
  const monday = r.pick(MONDAYS);
  const day = (d) => addDays(monday, d);
  const models = r.sample(MODELS, level === 1 ? 4 : 5).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const libOf = new Map(models);
  const libs = [...new Set(models.map((m) => m[1]))].sort();
  const counted = new Map();
  for (const lib of libs) counted.set(lib, level === 1 ? COUNTED[lib][0] : COUNTED[lib].flat());
  const isCounted = (model, path) => counted.get(libOf.get(model)).includes(path);

  const nClients = level === 1 ? 6 : 8;
  const clients = new Set();
  while (clients.size < nClients) clients.add("c_" + Array.from({ length: 4 }, () => r.pick(HEX)).join(""));
  const clientList = [...clients].sort();
  const mirrors = r.sample(clientList, level === 1 ? 1 : 2).sort();
  const people = clientList.filter((c) => !mirrors.includes(c));
  // Mirror listings as day indexes: excluded on days lf <= d < lu (lu null = still listed).
  const listing = new Map();
  for (const [i, m] of mirrors.entries()) {
    if (level < 3) listing.set(m, { lf: -200 + r.int(0, 100), lu: null });
    else if (i === 0) listing.set(m, { lf: r.int(3, 5), lu: r.int(9, 11) });
    else listing.set(m, { lf: r.int(5, 8), lu: null });
  }
  const excluded = (client, d, always) => {
    const l = listing.get(client);
    if (!l) return false;
    return always || (d >= l.lf && (l.lu === null || d < l.lu));
  };

  const reqs = [];
  const counts = (m) => counted.get(libOf.get(m));
  const add = (model, client, d, sec, path, status) => reqs.push({ model, client, d, sec, path, status });
  const randomPath = (m) => {
    const x = r.next();
    if (x < 0.62) return r.pick(counts(m));
    if (level >= 2 && x < 0.72) return r.pick(DECOYS);
    return r.pick(OTHER);
  };
  const randomStatus = () => {
    const x = r.next();
    return x < 0.78 ? 200 : x < 0.88 ? 304 : r.pick([403, 404, 500]);
  };
  const n = level === 1 ? 36 : level === 2 ? 52 : 64;
  for (let i = 0; i < n; i++) {
    const m = r.pick(models)[0];
    const c = r.chance(0.2) ? r.pick(mirrors) : r.pick(people);
    add(m, c, r.int(0, 13), r.int(0, 86399), randomPath(m), randomStatus());
  }
  // Every level: one client fetches the designated file of a model several times in one day.
  {
    const m = r.pick(models)[0], c = r.pick(people), d = r.int(0, 13);
    add(m, c, d, r.int(0, 30000), counts(m)[0], 200);
    add(m, c, d, r.int(30001, 60000), counts(m)[0], 304);
    add(m, c, d, r.int(60001, 86399), counts(m)[level === 1 ? 0 : 1], 200);
  }
  // Every level: a mirror pulls designated files of every model every day it is seen.
  {
    const mirror = mirrors[0];
    for (const [m] of models) add(m, mirror, r.int(0, 13), r.int(0, 86399), counts(m)[0], 200);
  }
  // Every level: a failed fetch of a designated file, and a non-designated file, from a fresh client-day.
  {
    const m = r.pick(models)[0], c = r.pick(people);
    add(m, c, r.int(0, 13), r.int(0, 86399), counts(m)[0], r.pick([403, 404, 500]));
    add(m, c, r.int(0, 13), r.int(0, 86399), r.pick(OTHER), 200);
  }
  if (level >= 2) {
    // The same client either side of UTC midnight inside a week, and across Sunday -> Monday.
    const m = r.pick(models)[0], c = r.pick(people);
    const d = r.int(0, 5);
    add(m, c, d, 86399, counts(m)[0], 200);
    add(m, c, d + 1, 0, counts(m)[1], 200);
    const m2 = r.pick(models)[0], c2 = r.pick(people);
    add(m2, c2, 6, 86399, counts(m2)[0], 200);
    add(m2, c2, 7, 0, counts(m2)[0], 200);
    // A look-alike path in a sub-folder is not a designated file.
    const m3 = r.pick(models)[0];
    add(m3, r.pick(people), r.int(0, 13), r.int(0, 86399), "onnx/config.json", 200);
  }
  if (level === 3) {
    // Requests on the days either side of each listing boundary.
    for (const mirror of mirrors) {
      const l = listing.get(mirror);
      const m = r.pick(models)[0];
      for (const d of [l.lf - 1, l.lf, ...(l.lu === null ? [] : [l.lu - 1, l.lu])]) {
        if (d >= 0 && d <= 13) add(m, mirror, d, r.int(0, 86399), counts(m)[0], 200);
      }
    }
  }

  // Deterministic ids in time order.
  reqs.sort((a, b) => a.d - b.d || a.sec - b.sec || (a.model < b.model ? -1 : a.model > b.model ? 1 : 0) || (a.client < b.client ? -1 : a.client > b.client ? 1 : 0) || (a.path < b.path ? -1 : 1));
  let rid = 700000 + r.int(0, 90000);
  for (const q of reqs) q.id = rid += r.int(1, 9);

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const solve = (o = {}) => {
    const per = new Map();
    for (const q of reqs) {
      if (!o.errors && q.status >= 400) continue;
      if (!o.allFiles && !isCounted(q.model, q.path)) continue;
      if (!o.keepMirrors && excluded(q.client, q.d, o.always)) continue;
      const k = day(q.d < 7 ? 0 : 7) + "|" + q.model;
      if (!per.has(k)) per.set(k, { dl: new Set(), cl: new Set() });
      const s = per.get(k);
      s.dl.add(o.noDedup ? String(q.id) : o.perWeek ? q.client : q.client + "|" + q.d);
      s.cl.add(q.client);
    }
    return [...per.entries()].sort((a, b) => cmp(a[0], b[0])).map(([k, s]) => {
      const [w, m] = k.split("|");
      return [w, m, s.dl.size, s.cl.size];
    });
  };
  const rows = solve();

  const diagnostics = [
    { message: "Every request was counted. Under this exercise's rule a client counts at most once per model per UTC day.", rows: solve({ noDedup: true }) },
    { message: "Every file was counted. Only the designated files of the model's library count; README, tokenizer and other files do not.", rows: solve({ allFiles: true }) },
    { message: "Listed mirror clients were counted. A client on the mirror list is excluded on the days it is listed.", rows: solve({ keepMirrors: true }) },
    { message: "Failed requests were counted. Only requests with http_status below 400 count.", rows: solve({ errors: true }) },
    { message: "A client was counted once per week. The rule is once per client per model per UTC day, so the same client on two days of a week is two downloads.", rows: solve({ perWeek: true }) },
  ];
  if (level === 3) diagnostics.push({ message: "Mirrors were excluded on every day. A listing applies from listed_from (inclusive) until listed_until (exclusive) only.", rows: solve({ always: true }) });

  const mCols = ["model_id", "library"];
  const mRows = models.map(([m, l]) => [m, l]);
  const fCols = ["library", "path"];
  const fRows = libs.flatMap((l) => counted.get(l).map((p) => [l, p]));
  const cCols = ["client_id", "listed_from", "listed_until"];
  const cRows = mirrors.map((m) => { const l = listing.get(m); return [m, day(l.lf), l.lu === null ? null : day(l.lu)]; });
  const rCols = ["request_id", "model_id", "path", "client_id", "requested_at", "http_status"];
  const rRows = reqs.map((q) => [q.id, q.model, q.path, q.client, ts(day(q.d), q.sec), q.status]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE models (\n  model_id TEXT PRIMARY KEY,\n  library TEXT NOT NULL\n);\n" +
    "CREATE TABLE counted_files (\n  library TEXT NOT NULL,\n  path TEXT NOT NULL,\n  PRIMARY KEY (library, path)\n);\n" +
    "CREATE TABLE mirror_clients (\n  client_id TEXT PRIMARY KEY,\n  listed_from DATE NOT NULL,\n  listed_until DATE\n);\n" +
    "CREATE TABLE file_requests (\n  request_id BIGINT PRIMARY KEY,\n  model_id TEXT NOT NULL REFERENCES models(model_id),\n  path TEXT NOT NULL,\n  client_id TEXT NOT NULL,\n  requested_at TIMESTAMPTZ NOT NULL,\n  http_status INT NOT NULL\n);\n" +
    insertSQL("models", mCols, mRows) + insertSQL("counted_files", fCols, fRows) +
    insertSQL("mirror_clients", cCols, cRows) + insertSQL("file_requests", rCols, rRows);

  return {
    vars: {
      requests: reqs.length,
      first_day: day(0),
      last_day: day(13),
      files_rule: level === 1
        ? "In this sample each library has exactly one designated file."
        : "A library can have several designated files; fetching two of them on one day is still one download. Paths must match exactly: `onnx/config.json` is not `config.json`.",
      mirror_rule: level === 3
        ? "Listings change during this period: some mirrors were listed, or unlisted, part-way through it."
        : "In this sample every mirror was listed before the period began and is still listed.",
    },
    setup,
    tables: [
      { name: "models", columns: mCols, rows: mRows },
      { name: "counted_files", columns: fCols, rows: fRows },
      { name: "mirror_clients", columns: cCols, rows: cRows },
      { name: "file_requests", columns: rCols, rows: rRows },
    ],
    expected: { columns: ["week_start", "model_id", "downloads", "distinct_clients"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
