/* NVD-L2-01 — GPU memory caching allocator: best fit, splitting and coalescing (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: a literal block-list simulation that scans every
   cached block for the best fit and scans again for neighbours to merge. The
   evaluator's reference keeps a sorted (size, address) list searched with bisect and
   two address maps for neighbours, written independently.
   level: 1 Medium (blocks always split, no cache release)
          · 2 Hard (+ a minimum split size, requests larger than a segment)
          · 3 Very Hard (+ empty_cache releases, double frees, address high-water mark) */
export const kind = "python";
export const entry = "simulate_allocator";
export const signature = "def simulate_allocator(events: list[tuple], segment_bytes: int, min_split: int) -> dict:";
export const starter = `def simulate_allocator(events, segment_bytes, min_split):
    """events: ("alloc", id, nbytes) | ("free", id) | ("empty_cache",), in order.
    Return {"addresses": [...], "peak_reserved": int, "reserved": int,
            "allocated": int, "free_blocks": int, "largest_free": int}."""
    ...
`;

export const prelude = `
def _gen_trace(n, seed, live_target=15000, with_empty=False):
    x, ev, live, nid = seed, [], [], 0
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    for i in range(n):
        if live and (len(live) >= live_target or rnd(100) < 40 * len(live) // live_target):
            j = rnd(len(live))
            live[j], live[-1] = live[-1], live[j]
            ev.append(('free', live.pop()))
        else:
            k = rnd(100)
            if k < 30:
                size = 1 + rnd(4096)
            elif k < 97:
                size = (1 + rnd(512)) * 512
            else:
                size = (1 + rnd(6)) * 1048576 - rnd(4096)
            nid += 1
            ev.append(('alloc', 't%d' % nid, size))
            live.append('t%d' % nid)
        if with_empty and i % 20000 == 19999:
            ev.append(('empty_cache',))
    return ev, 2097152, 512
`.trim() + "\n";

// The specification, simulated literally on a list of blocks.
export function oracle(events, S, minSplit) {
  let blocks = [];                       // {addr, size, base, end, owner|null}
  const live = new Map();                // id -> block
  const addresses = [];
  let nextBase = 0, reserved = 0, peak = 0;
  for (const ev of events) {
    if (ev[0] === "alloc") {
      const need = Math.ceil(ev[2] / 512) * 512;
      let best = null;
      for (const b of blocks) {
        if (b.owner !== null || b.size < need) continue;
        if (!best || b.size < best.size || (b.size === best.size && b.addr < best.addr)) best = b;
      }
      if (!best) {
        const seg = Math.ceil(need / S) * S;
        best = { addr: nextBase, size: seg, base: nextBase, end: nextBase + seg, owner: null };
        blocks.push(best);
        nextBase += seg;
        reserved += seg;
        if (reserved > peak) peak = reserved;
      }
      if (best.size - need >= minSplit) {
        blocks.push({ addr: best.addr + need, size: best.size - need, base: best.base, end: best.end, owner: null });
        best.size = need;
      }
      best.owner = ev[1];
      live.set(ev[1], best);
      addresses.push(best.addr);
    } else if (ev[0] === "free") {
      const b = live.get(ev[1]);
      if (!b) continue;
      live.delete(ev[1]);
      b.owner = null;
      for (;;) {                          // merge with free neighbours in the same segment
        const next = blocks.find((o) => o.owner === null && o.base === b.base && o.addr === b.addr + b.size);
        if (next) { b.size += next.size; blocks = blocks.filter((o) => o !== next); continue; }
        const prev = blocks.find((o) => o.owner === null && o.base === b.base && o.addr + o.size === b.addr);
        if (prev) { b.addr = prev.addr; b.size += prev.size; blocks = blocks.filter((o) => o !== prev); continue; }
        break;
      }
    } else {
      const keep = [];
      for (const b of blocks) {
        if (b.owner === null && b.addr === b.base && b.size === b.end - b.base) reserved -= b.size;
        else keep.push(b);
      }
      blocks = keep;
    }
  }
  const free = blocks.filter((b) => b.owner === null);
  let allocated = 0;
  for (const b of live.values()) allocated += b.size;
  return {
    addresses, peak_reserved: peak, reserved, allocated,
    free_blocks: free.length, largest_free: free.reduce((m, b) => Math.max(m, b.size), 0),
  };
}

const pyEv = (e) => (e.length === 1 ? `('${e[0]}',)` : e.length === 2 ? `('${e[0]}', '${e[1]}')` : `('${e[0]}', '${e[1]}', ${e[2]})`);
const pyArgs = (events, S, m) => `([${events.map(pyEv).join(", ")}], ${S}, ${m})`;
const pyOut = (o) =>
  `{'addresses': [${o.addresses.join(", ")}], 'peak_reserved': ${o.peak_reserved}, 'reserved': ${o.reserved}, ` +
  `'allocated': ${o.allocated}, 'free_blocks': ${o.free_blocks}, 'largest_free': ${o.largest_free}}`;

const PREFIX = ["act", "grad", "kv", "ws", "tmp", "opt"];

function randomCase(r, level) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const S = r.pick([8192, 16384]);
    const m = level === 1 ? 512 : r.pick([512, 1024, 2048]);
    const n = level === 1 ? r.int(10, 14) : level === 2 ? r.int(14, 20) : r.int(18, 26);
    const pre = r.pick(PREFIX);
    const ev = [], live = [];
    let nid = 0, frees = 0;
    for (let i = 0; i < n; i++) {
      const roll = r.next();
      if (level === 3 && roll < 0.08 && i > 4) { ev.push(["empty_cache"]); continue; }
      if (live.length && roll < 0.45) {
        const j = r.int(0, live.length - 1);
        const id = live.splice(j, 1)[0];
        ev.push(["free", id]);
        frees++;
        if (level === 3 && r.chance(0.2)) ev.push(["free", id]);         // a double free
        continue;
      }
      let size = r.chance(0.5) ? r.int(1, 12) * 512 : r.int(1, S / 2);
      if (level >= 2 && r.chance(0.1)) size = S + r.int(1, S);         // larger than one segment
      const id = pre + "_" + ++nid;
      ev.push(["alloc", id, size]);
      live.push(id);
    }
    if (frees < 2) continue;
    const got = oracle(ev, S, m);
    if (got.free_blocks > 1 || level === 1) return { ev, S, m, got };
  }
  throw new Error("NVD-L2-01: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.ev, c.S, c.m), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const S = r.pick([16384, 32768]);
  const A = (id, n) => ["alloc", id, n];
  const F = (id) => ["free", id];
  const k = r.int(2, 4) * 512;                    // a size several tests use
  const edges = [
    ["best fit takes the smallest cached block that fits, not the first one",
      [A("a", 4096), A("b", 512), A("c", 2048), A("d", 512), F("a"), F("c"), A("e", 1536), A("f", 4096)], S, 512],
    ["equal-size cached blocks: the lowest address wins, not the most recently freed",
      [A("a", k), A("b", 512), A("c", k), A("d", 512), F("c"), F("a"), A("e", k)], S, 512],
    ["requests round up to 512 bytes: 1, 512 and 513 bytes", [A("a", 1), A("b", 512), A("c", 513)], S, 512],
    ["freeing the middle block merges it with free blocks on both sides",
      [A("a", k), A("b", k), A("c", k), A("d", 512), F("a"), F("c"), F("b"), A("e", 3 * k)], S, 512],
    ["blocks in two different segments never merge, even at adjacent addresses",
      [A("a", S), A("b", S), F("a"), F("b"), A("c", 2 * S)], S, 512],
    ["a free of an unknown id, or a second free, changes nothing",
      [A("a", k), F("a"), F("a"), F("zz"), A("b", k)], S, 512],
    ["an empty trace", [], S, 512],
  ];
  if (level >= 2) {
    edges.push(["a remainder of exactly min_split bytes is split off",
      [A("a", 3072), A("b", 512), F("a"), A("c", 2048)], S, 1024]);
    edges.push(["a remainder below min_split stays with the block, and counts as allocated",
      [A("a", 3072), A("b", 512), F("a"), A("c", 2560)], S, 1024]);
    edges.push(["a request larger than a segment reserves whole segments",
      [A("a", S + 1), A("b", S - 512)], S, 512]);
  }
  if (level === 3) {
    edges.push(["empty_cache releases only fully free segments; addresses are never reused; the peak stays",
      [A("a", S / 2), A("b", S), F("b"), ["empty_cache"], A("c", S)], S, 512]);
    edges.push(["after empty_cache, a cached block in a partly used segment is still reused",
      [A("a", S / 2), A("b", 1024), F("b"), ["empty_cache"], A("c", 1024)], S, 512]);
  }
  for (const [name, ev, s, m] of edges) tests.push({ name, args: pyArgs(ev, s, m), expect: pyOut(oracle(ev, s, m)) });

  // Timing: 150 000 events with about 15 000 live blocks and several thousand cached
  // free blocks. A sorted list with bisect is O(log F) per search; scanning every
  // free block per request is O(F) and takes minutes.
  tests.push({
    name: "150,000 events, thousands of cached free blocks (bisect, not scans)",
    args: `_gen_trace(150000, ${r.int(1, 1_000_000)}, 15000, ${level === 3 ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      trace_rule: level === 1
        ? "The traces you are given use `min_split = 512`, so every block with room to spare is split, and contain no `empty_cache`; your code must still follow every rule below."
        : level === 2
          ? "The traces you are given use different minimum split sizes and include requests larger than one segment, but no `empty_cache`; your code must still follow every rule below."
          : "The traces you are given include `empty_cache` events, double frees and requests larger than one segment.",
    },
    samples,
    tests,
  };
}
