/* SPT-L3-05 — Device handoffs: playback that continued on another device (SQL).
   Simulated practice scenario. All listeners, devices, items, times and positions are
   generated from the seed and are hypothetical. The handoff definition is this
   exercise's rule, not a description of how any product measures handoffs.

   A segment is continuous playback of one item (track or episode) on one device.
   For each segment A, its listener's NEXT segment B (order: started_at, segment_id) is a
   handoff when
     B is on a different device_id (two phones are two devices),
     B plays the same item_id,
     A.ended_at <= B.started_at <= A.ended_at + 10 seconds (both ends inclusive),
     |B.start_position_ms - A.end_position_ms| <= tolerance (inclusive),
     neither A nor B was played in a private session.
   Private segments still take part in "next" (a private segment can be A's next).
   Output per (month of B.started_at in UTC, from_device_type, to_device_type):
     handoffs, listeners (distinct listeners with at least one handoff there).
   level: 1 Medium (boundaries on gap and position, two devices of one type, a handoff
                    across a month boundary, a different item near the same position,
                    a same-device resume, a private handoff)
          2 Hard (+ a short resume on the same device between A and the other device:
                  only the NEXT segment counts, not any later one; larger data)
          3 Very Hard (+ a private segment in the middle of a chain: private segments are
                       excluded from the report but still decide which segment is next) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const H = 3600;
const SLOT = 4 * H;
const TYPES = ["phone", "desktop", "tablet", "speaker", "car", "tv", "web_player", "watch"];

function stamp(sec) {
  const d = new Date(sec * 1000).toISOString();
  return ts(d.slice(0, 10), ((sec % 86400) + 86400) % 86400);
}
const monthOf = (sec) => new Date(sec * 1000).toISOString().slice(0, 7);

export function generate(r, level) {
  const tolS = level === 1 ? r.pick([5, 10]) : r.pick([5, 8, 10]);
  const tol = tolS * 1000;
  const GAP = 10;
  const year = 2026;
  const m0 = r.int(0, 8);                                    // first month index (0 = January)
  const nMonths = level === 1 ? 2 : 3;
  const start = Date.UTC(year, m0, 1) / 1000;
  const end = Date.UTC(year, m0 + nMonths, 1) / 1000;
  const boundary = Date.UTC(year, m0 + 1, 1) / 1000;          // first month boundary
  const nSlots = Math.floor((end - start) / SLOT);
  const bSlot = (boundary - start) / SLOT;

  // Listeners and their devices.
  const nListeners = level === 1 ? 4 : level === 2 ? 6 : 8;
  let lid = 100 + r.int(0, 800), did = 0x2a0 + r.int(0, 0x500);
  const listeners = [];
  for (let i = 0; i < nListeners; i++) {
    const types = r.sample(TYPES, r.int(2, 3));
    const devs = types.map((t) => ({ id: "dev_" + (did += r.int(1, 9)).toString(16), type: t }));
    listeners.push({ id: "lst_" + (lid += r.int(1, 23)), devs, segs: [], used: new Set() });
  }
  const twin = r.pick(listeners);                             // two devices of the same type
  const twinType = r.pick(["phone", "speaker"]);
  twin.devs = twin.devs.filter((d) => d.type !== twinType);
  twin.devs.push({ id: "dev_" + (did += r.int(1, 9)).toString(16), type: twinType },
                 { id: "dev_" + (did += r.int(1, 9)).toString(16), type: twinType });
  const devices = listeners.flatMap((l) => l.devs);

  let itemN = 3000 + r.int(0, 4000);
  const newItem = () => (r.chance(0.6) ? "trk_" : "ep_") + (itemN += r.int(1, 97));
  const other = (l, d) => r.pick(l.devs.filter((x) => x.id !== d.id));
  const freeSlot = (l) => {
    for (;;) {
      const s = r.int(0, nSlots - 1);
      if (l.used.has(s) || s === bSlot || s === bSlot - 1) continue;
      l.used.add(s);
      return start + s * SLOT + r.int(0, 1800);
    }
  };

  // A chain cursor: plays segments back to back with chosen links.
  const chain = (l, t0, dev, item, sp, dur, priv = false) => {
    const c = { l, t: t0, dev, item, pos: sp };
    c.play = (d, it, p, du, pv = false) => {
      const s = { l: l.id, dev: d, item: it, at: c.t, end: c.t + du, sp: p, ep: p + du * 1000, priv: pv };
      l.segs.push(s);
      c.t = s.end; c.dev = d; c.item = it; c.pos = s.ep;
      return s;
    };
    c.play(dev, item, sp, dur, priv);
    c.wait = (g) => { c.t += g; return c; };
    return c;
  };
  const randLinks = (c, k) => {
    for (let i = 0; i < k; i++) {
      const roll = r.next();
      const pv = level >= 2 && r.chance(0.06);
      if (roll < 0.35) {                                      // handoff
        c.wait(r.int(0, GAP)).play(other(c.l, c.dev), c.item, Math.max(0, c.pos + r.int(-tol, tol)), r.int(20, 240), pv);
      } else if (roll < 0.5) {                                // too late
        c.wait(r.int(GAP + 1, 300)).play(other(c.l, c.dev), c.item, Math.max(0, c.pos + r.int(-tol, tol)), r.int(20, 240), pv);
      } else if (roll < 0.6) {                                // position far away
        const d = (tol + r.int(1, 60000)) * (r.chance(0.5) ? 1 : -1);
        c.wait(r.int(0, GAP)).play(other(c.l, c.dev), c.item, Math.max(0, c.pos + d), r.int(20, 240), pv);
      } else if (roll < 0.75) {                               // resume on the same device
        c.wait(r.int(0, 60)).play(c.dev, c.item, Math.max(0, c.pos + r.int(-2000, 2000)), r.int(20, 240), pv);
      } else {                                                // next item on the same device
        c.wait(r.int(0, 2)).play(c.dev, newItem(), 0, r.int(30, 240), pv);
      }
    }
  };
  const begin = (l, t0 = freeSlot(l), dev = r.pick(l.devs)) =>
    chain(l, t0, dev, newItem(), r.chance(0.3) ? 0 : r.int(0, 120) * 1000, r.int(40, 300));

  // Random traffic.
  for (const l of listeners) {
    const k = level === 1 ? r.int(3, 4) : level === 2 ? r.int(4, 6) : r.int(5, 7);
    for (let i = 0; i < k; i++) randLinks(begin(l), r.int(1, 4));
  }

  // Forced edge cases.
  {                                                           // gap exactly 10 s: counts
    const c = begin(r.pick(listeners));
    c.wait(GAP).play(other(c.l, c.dev), c.item, c.pos + r.int(-tol, tol), r.int(30, 400));
  }
  {                                                           // gap exactly 11 s: not a handoff
    const c = begin(r.pick(listeners));
    c.wait(GAP + 1).play(other(c.l, c.dev), c.item, c.pos + r.int(-1000, 1000), r.int(30, 400));
  }
  {                                                           // position exactly at tolerance: counts
    const c = begin(r.pick(listeners));
    c.wait(r.int(0, GAP)).play(other(c.l, c.dev), c.item, c.pos + (r.chance(0.5) ? tol : -tol), r.int(30, 400));
  }
  {                                                           // 1 ms beyond tolerance (ahead): not a handoff
    const c = begin(r.pick(listeners));
    c.wait(r.int(0, GAP)).play(other(c.l, c.dev), c.item, c.pos + tol + 1, r.int(30, 400));
  }
  {                                                           // far behind: only abs() rejects it
    const c = begin(r.pick(listeners));
    c.wait(r.int(0, GAP)).play(other(c.l, c.dev), c.item, c.pos - tol - r.int(1000, 30000), r.int(30, 400));
  }
  {                                                           // two devices of one type
    const pair = twin.devs.filter((d) => d.type === twinType);
    const c = begin(twin, freeSlot(twin), pair[0]);
    c.wait(r.int(0, GAP)).play(pair[1], c.item, c.pos + r.int(-tol, tol), r.int(30, 400));
  }
  {                                                           // across the month boundary
    const l = r.pick(listeners);
    const a = r.int(1, 5), b = r.int(0, GAP - a);
    const dur = r.int(60, 600);
    const dev = r.pick(l.devs);
    const c = chain(l, boundary - a - dur, dev, newItem(), r.int(0, 60) * 1000, dur);
    c.wait(a + b).play(other(l, dev), c.item, c.pos + r.int(-tol, tol), r.int(30, 400));
  }
  {                                                           // different item near the same position
    const l = r.pick(listeners);
    const c = chain(l, freeSlot(l), r.pick(l.devs), newItem(), 0, r.int(2, tolS));
    c.wait(r.int(0, GAP)).play(other(l, c.dev), newItem(), 0, r.int(30, 400));
  }
  {                                                           // same-device resume near the same position
    const c = begin(r.pick(listeners));
    c.wait(r.int(0, GAP)).play(c.dev, c.item, c.pos + r.int(-1000, 1000), r.int(30, 400));
  }
  {                                                           // a handoff into a private session
    const c = begin(r.pick(listeners));
    c.wait(r.int(0, GAP)).play(other(c.l, c.dev), c.item, c.pos + r.int(-tol, tol), r.int(30, 400), true);
  }
  if (level >= 2) {                                           // short same-device resume, then another device
    const c = begin(r.pick(listeners));
    const x = c.dev;
    c.wait(r.int(1, 2)).play(x, c.item, c.pos, r.int(2, 3));
    c.wait(r.int(1, 3)).play(other(c.l, x), c.item, c.pos + r.int(-500, 500), r.int(30, 400));
  }
  if (level === 3) {                                          // private segment in the middle of a chain
    const l = r.pick(listeners.filter((x) => x.devs.length >= 3));   // the twin listener always has 3+
    const c = begin(l);
    const d0 = c.dev;
    const d1 = other(l, d0);
    c.wait(r.int(1, 3)).play(d1, c.item, c.pos + r.int(-500, 500), r.int(2, 3), true);
    const d2 = r.pick(l.devs.filter((d) => d.id !== d0.id && d.id !== d1.id));
    c.wait(r.int(1, 2)).play(d2, c.item, c.pos + r.int(-500, 500), r.int(30, 400));
  }

  // Ids in order of started_at.
  const segs = listeners.flatMap((l) => l.segs).map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.at - b.s.at || a.i - b.i).map((x) => x.s);
  let sid = 70000 + r.int(0, 20000);
  for (const s of segs) s.id = "seg_" + (sid += r.int(1, 5));
  const typeOf = new Map(devices.map((d) => [d.id, d.type]));

  // The oracle. opts break one rule each, for diagnostics.
  const compute = (opts = {}) => {
    const by = new Map();
    for (const s of segs) {
      if (opts.filterPrivateFirst && s.priv) continue;
      if (!by.has(s.l)) by.set(s.l, []);
      by.get(s.l).push(s);
    }
    const groups = new Map();
    const ok = (a, b) => {
      const gap = b.at - a.end;
      const d = b.sp - a.ep;
      if (gap < 0 || (opts.strictGap ? gap >= GAP : gap > GAP)) return false;
      if (!opts.sameDevice && !opts.byType && b.dev.id === a.dev.id) return false;
      if (opts.byType && b.dev.type === a.dev.type) return false;
      if (!opts.noItem && b.item !== a.item) return false;
      if (!opts.noPos) {
        const dd = opts.noAbs ? d : Math.abs(d);
        if (opts.strictPos ? dd >= tol : dd > tol) return false;
      }
      if (!opts.privateIncluded && (a.priv || b.priv)) return false;
      return true;
    };
    for (const [, list] of by) {
      list.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
      for (let i = 0; i < list.length; i++) {
        const cands = opts.anyLater ? list.slice(i + 1) : list.slice(i + 1, i + 2);
        for (const b of cands) {
          const a = list[i];
          if (!ok(a, b)) continue;
          const key = [monthOf(opts.monthA ? a.end : b.at), a.dev.type, b.dev.type].join("|");
          if (!groups.has(key)) groups.set(key, { n: 0, ls: new Set() });
          const g = groups.get(key);
          g.n++; g.ls.add(a.l);
        }
      }
    }
    const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
    return [...groups.keys()].map((k) => {
      const [m, f, t] = k.split("|");
      const g = groups.get(k);
      return [m, f, t, g.n, g.ls.size];
    }).sort((x, y) => cmp(x[0], y[0]) || cmp(x[1], y[1]) || cmp(x[2], y[2]));
  };
  const expected = compute();

  const diagnostics = [
    { message: "The 10-second window was treated as exclusive. A segment that starts exactly 10 seconds after the previous one ended is still a handoff.", rows: compute({ strictGap: true }) },
    { message: `The position tolerance was treated as exclusive. A difference of exactly ${tol} ms is near enough.`, rows: compute({ strictPos: true }) },
    { message: "Playback that resumed on the same device was counted as a handoff. A handoff needs a different device_id.", rows: compute({ sameDevice: true }) },
    { message: "Device types were compared instead of devices. Moving from one phone to another phone (two device_ids of one type) is a handoff, reported as the pair phone → phone.", rows: compute({ byType: true }) },
    { message: "The item was not compared. Starting a different track or episode on another device is not a continuation, even near the same position.", rows: compute({ noItem: true }) },
    { message: "Handoffs were dated by the segment that ended. The month is the UTC month in which playback continued (the next segment's started_at), so a handoff around midnight on the first of the month belongs to the new month.", rows: compute({ monthA: true }) },
    { message: "The position check was missing. Playback that restarted far from where it stopped is not a handoff.", rows: compute({ noPos: true }) },
    { message: "The position check had no absolute value. A segment that restarted far behind the previous end position passed the check; compare ABS(start_position_ms - end_position_ms) with the tolerance.", rows: compute({ noAbs: true }) },
    { message: "Private-session segments were included. A handoff into or out of a private session is never reported in this exercise.", rows: compute({ privateIncluded: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Any later segment within 10 seconds was matched, not only the listener's next one. When playback resumed briefly on the same device and then moved, only that last step is the handoff; a self-join without 'next' counts it twice.", rows: compute({ anyLater: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Private-session segments were removed before finding each segment's next one. They are excluded from the report but still happened: a private segment between two public ones means neither public step is a handoff.", rows: compute({ filterPrivateFirst: true }) });
  }

  const dCols = ["device_id", "device_type"];
  const dRows = devices.map((d) => [d.id, d.type]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const sCols = ["segment_id", "listener_id", "device_id", "item_id", "started_at", "ended_at", "start_position_ms", "end_position_ms", "private_session"];
  const sRows = segs.map((s) => [s.id, s.l, s.dev.id, s.item, stamp(s.at), stamp(s.end), s.sp, s.ep, s.priv]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE devices (\n  device_id TEXT PRIMARY KEY,\n  device_type TEXT NOT NULL\n);\n" +
    "CREATE TABLE playback_segments (\n  segment_id TEXT PRIMARY KEY,\n  listener_id TEXT NOT NULL,\n  device_id TEXT NOT NULL REFERENCES devices (device_id),\n  item_id TEXT NOT NULL,\n  started_at TIMESTAMPTZ NOT NULL,\n  ended_at TIMESTAMPTZ NOT NULL CHECK (ended_at > started_at),\n  start_position_ms INT NOT NULL CHECK (start_position_ms >= 0),\n  end_position_ms INT NOT NULL,\n  private_session BOOLEAN NOT NULL\n);\n" +
    insertSQL("devices", dCols, dRows) + insertSQL("playback_segments", sCols, sRows);

  const mName = (i) => new Date(Date.UTC(year, i, 1)).toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
  return {
    vars: {
      tol_s: tolS,
      tol_ms: tol,
      months: `${mName(m0)} to ${mName(m0 + nMonths - 1)} ${year}`,
      segments: sRows.length,
      devices: dRows.length,
      listeners: nListeners,
    },
    setup,
    tables: [
      { name: "devices", columns: dCols, rows: dRows },
      { name: "playback_segments", columns: sCols, rows: sRows },
    ],
    expected: { columns: ["month", "from_device_type", "to_device_type", "handoffs", "listeners"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
