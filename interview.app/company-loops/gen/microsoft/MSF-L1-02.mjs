/* MSF-L1-02 — Update ring compliance: offered devices that installed within N days (SQL).
   Simulated practice scenario. All data is generated from the seed; update ids, rings,
   OS build numbers and the compliance rule are hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (one offer per device; the window [first offer, + N days] is inclusive;
                    devices never online in the window are excluded from the denominator)
          2 Hard (+ re-offers: the window starts at the FIRST offer; an install proves the device
                  was online; installs one second past the window; a group whose devices were
                  all offline reports a NULL rate)
          3 Very Hard (+ the OS build is the one in effect at the first offer, from the build
                       history, not the device's current build) */
import { insertSQL, pad2 } from "../../js/rng.js";

export const kind = "sql";

const RINGS = ["broad", "early", "pilot", "preview"];
const BUILDS = ["22631.5039", "22631.5189", "26100.4061", "26100.4202", "26100.4349"];
const RARE_BUILD = "26100.3915";
const UPDATES = ["qu-2026-08b", "qu-2026-09b", "qu-2026-10b"];
const DAY = 86400;
const BASE = Date.UTC(2026, 8, 1);                   // 2026-09-01 00:00:00 UTC

const fmt = (sec) => {
  const d = new Date(BASE + sec * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}+00`;
};

export function generate(r, level) {
  const [target, other] = r.sample(UPDATES, 2);
  const days = level === 1 ? r.pick([5, 7]) : r.pick([3, 5, 7, 10]);
  const W = days * DAY;
  const rings = r.sample(RINGS, 3).sort();
  const builds = r.sample(BUILDS, level === 1 ? 2 : 3).sort();
  const nDev = 14 + 4 * level;
  const devices = [];                   // {id, ring, history: [{build, at}], offers: [sec], checkins: [sec], installs: [{u, sec}]}
  const used = new Set();
  const newId = () => { let s; do s = "dev-" + String(r.int(10000, 99999)); while (used.has(s)); used.add(s); return s; };

  const make = (shape) => {
    const first = 2 * DAY + r.int(0, 3 * DAY);
    const d = { id: newId(), ring: shape.ring || r.pick(rings), history: [], offers: [first], checkins: [], installs: [] };
    // Build history: one row well before the offer; Very Hard adds changes around the offer.
    const b0 = shape.build || r.pick(builds);
    d.history.push({ build: b0, at: r.int(0, DAY) });
    if (level === 3 && !shape.build && !shape.plain) {
      if (r.chance(0.35)) d.history.push({ build: r.pick(builds), at: first + r.int(1, W) });             // upgraded after the offer
      if (r.chance(0.2)) d.history.push({ build: r.pick(builds), at: r.chance(0.5) ? first : first - r.int(60, DAY - 1) }); // changed at/before the offer
    }
    if (level >= 2 && (shape.reoffer || r.chance(0.3))) d.offers.push(first + r.int(DAY, 4 * DAY));
    const online = shape.online ?? r.chance(0.8);
    if (online) for (let k = r.int(1, 3); k > 0; k--) d.checkins.push(first + r.int(0, W));
    else if (r.chance(0.5)) d.checkins.push(first - r.int(60, DAY));                                   // seen only before the offer
    else if (r.chance(0.5)) d.checkins.push(first + W + r.int(1, DAY));                                // seen only after the window
    const inst = shape.install ?? r.pick(["in", "in", "in", "late", "none"]);
    if (inst === "in") d.installs.push({ u: target, sec: first + r.int(0, W - 1) });
    else if (inst === "late") d.installs.push({ u: target, sec: first + W + r.int(1, DAY) });
    else if (inst === "edge") d.installs.push({ u: target, sec: first + W });
    else if (inst === "edge+1") d.installs.push({ u: target, sec: first + W + 1 });
    else if (inst === "between") d.installs.push({ u: target, sec: first + W + r.int(1, d.offers[d.offers.length - 1] - first - 1) });
    if (r.chance(0.3)) d.installs.push({ u: other, sec: first + r.int(0, W) });                       // another update: ignored
    if (shape.installOnly) d.checkins = [];
    devices.push(d);
    return d;
  };
  for (let i = 0; i < nDev; i++) make({});
  make({ install: "edge", online: true });                     // installed exactly N days after the first offer: compliant
  make({ install: "in", online: true });
  make({ install: r.pick(["none", "late"]), online: false });  // never online in the window: excluded
  if (level >= 2) {
    make({ install: "edge+1", online: true });                 // one second late
    make({ install: "between", reoffer: true, online: true }); // inside the window of the re-offer only
    make({ install: "in", online: false, installOnly: true }); // no check-in, but the install proves it was online
    make({ ring: r.pick(rings), build: RARE_BUILD, online: false, install: "late" }); // a group with nobody online
  }
  if (level === 3) {
    // The build changed exactly at the offer, and one device was upgraded after the offer.
    const d1 = make({ install: "in", online: true, plain: true });
    d1.history.push({ build: builds.find((b) => b !== d1.history[0].build), at: d1.offers[0] });
    const d2 = make({ install: "in", online: true, plain: true });
    d2.history.push({ build: builds.find((b) => b !== d2.history[0].build), at: d2.offers[0] + r.int(60, W) });
  }
  // Devices that were never offered this update (noise).
  for (let i = 0; i < 3; i++) {
    const d = make({});
    d.offers = [];
    if (r.chance(0.6)) d.offers.push(-1);                      // marker: offered the other update instead
  }

  const buildAt = (d, sec) => {
    let best = null;
    for (const h of d.history) if (h.at <= sec && (!best || h.at >= best.at)) best = h;
    return best.build;
  };
  const current = (d) => d.history.reduce((a, b) => (b.at >= a.at ? b : a)).build;

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const share = (n, d) => (d === 0 ? null : Math.floor((n * 20000 + d) / (2 * d)) / 10000);
  const solve = (o = {}) => {
    const g = new Map();
    for (const d of devices) {
      const offers = d.offers.filter((s) => s >= 0);
      if (!offers.length) continue;
      const start = o.latestOffer ? Math.max(...offers) : Math.min(...offers);
      const end = start + W;
      const inWin = (s) => s >= start && (o.exclusiveEnd ? s < end : s <= end);
      const compliant = d.installs.some((i) => i.u === target && inWin(i.sec));
      const online = d.checkins.some(inWin) || (!o.installNotOnline && compliant);
      const build = o.currentBuild ? current(d) : buildAt(d, Math.min(...offers));
      const k = d.ring + "|" + build;
      if (!g.has(k)) g.set(k, { off: 0, on: 0, ok: 0 });
      const s = g.get(k);
      s.off++;
      if (online || o.allOnline) s.on++;
      if (compliant) s.ok++;
    }
    return [...g.entries()].sort((x, y) => cmp(x[0], y[0])).map(([k, s]) => {
      const [ring, build] = k.split("|");
      return [ring, build, s.off, s.on, s.ok, share(s.ok, s.on)];
    });
  };
  const rows = solve();

  const diagnostics = [
    { message: "Devices that were never online in the window were kept in the denominator. They could not have installed, so they are excluded.", rows: solve({ allOnline: true }) },
    { message: "The window's end was exclusive. An install exactly N days after the first offer is within N days.", rows: solve({ exclusiveEnd: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "The window started at the latest offer. A re-offer does not restart the clock: the window starts at the first offer.", rows: solve({ latestOffer: true }) });
    diagnostics.push({ message: "An install was not taken as proof that the device was online. A device that installed in the window was online, even with no check-in row.", rows: solve({ installNotOnline: true }) });
  }
  if (level === 3) diagnostics.push({ message: "Devices were grouped by their current build. The build is the one in effect at the first offer (latest build row at or before it).", rows: solve({ currentBuild: true }) });

  // Tables.
  const dSorted = devices.slice().sort((x, y) => cmp(x.id, y.id));
  const devCols = ["device_id", "ring", "current_build"];
  const devRows = dSorted.map((d) => [d.id, d.ring, current(d)]);
  const bCols = ["device_id", "os_build", "effective_at"];
  const bRows = [];
  for (const d of dSorted) for (const h of d.history.slice().sort((x, y) => x.at - y.at)) bRows.push([d.id, h.build, fmt(h.at)]);
  const offers = [];
  for (const d of devices) {
    for (const s of d.offers) {
      if (s >= 0) offers.push([d.id, target, s]);
      else offers.push([d.id, other, 2 * DAY + r.int(0, 3 * DAY)]);
    }
    for (const i of d.installs) if (i.u === other) offers.push([d.id, other, Math.max(0, i.sec - r.int(60, DAY))]);
  }
  offers.sort((x, y) => x[2] - y[2] || cmp(x[0], y[0]));
  let oid = 7000 + r.int(0, 2000);
  const oCols = ["offer_id", "device_id", "update_id", "offered_at"];
  const oRows = offers.map(([d, u, s]) => [oid += r.int(1, 9), d, u, fmt(s)]);
  const inst = [];
  for (const d of devices) for (const i of d.installs) inst.push([d.id, i.u, i.sec]);
  inst.sort((x, y) => x[2] - y[2] || cmp(x[0], y[0]));
  let iid = 30000 + r.int(0, 5000);
  const iCols = ["install_id", "device_id", "update_id", "installed_at"];
  const iRows = inst.map(([d, u, s]) => [iid += r.int(1, 9), d, u, fmt(s)]);
  const cRows = [];
  for (const d of devices) for (const s of d.checkins) cRows.push([d.id, s]);
  cRows.sort((x, y) => x[1] - y[1] || cmp(x[0], y[0]));
  const ckCols = ["device_id", "checkin_at"];
  const ckRows = cRows.map(([d, s]) => [d, fmt(s)]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE devices (\n  device_id TEXT PRIMARY KEY,\n  ring TEXT NOT NULL,\n  current_build TEXT NOT NULL\n);\n" +
    "CREATE TABLE device_builds (\n  device_id TEXT NOT NULL REFERENCES devices(device_id),\n  os_build TEXT NOT NULL,\n  effective_at TIMESTAMPTZ NOT NULL,\n  PRIMARY KEY (device_id, effective_at)\n);\n" +
    "CREATE TABLE update_offers (\n  offer_id BIGINT PRIMARY KEY,\n  device_id TEXT NOT NULL REFERENCES devices(device_id),\n  update_id TEXT NOT NULL,\n  offered_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE update_installs (\n  install_id BIGINT PRIMARY KEY,\n  device_id TEXT NOT NULL REFERENCES devices(device_id),\n  update_id TEXT NOT NULL,\n  installed_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE device_checkins (\n  device_id TEXT NOT NULL REFERENCES devices(device_id),\n  checkin_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("devices", devCols, devRows) + insertSQL("device_builds", bCols, bRows) +
    insertSQL("update_offers", oCols, oRows) + insertSQL("update_installs", iCols, iRows) + insertSQL("device_checkins", ckCols, ckRows);

  return {
    vars: {
      update_id: target,
      days,
      devices: devices.length,
      offer_rule: level === 1
        ? "In this sample each device was offered the update at most once."
        : "A device can be offered the same update more than once (a re-offer after a failed or postponed attempt). The window always starts at the device's **first** offer of the update.",
      build_rule: level === 3
        ? "Builds change: group each device by the build in effect at its first offer, which is the `device_builds` row with the latest `effective_at` at or before that offer (a change at exactly the offer time counts). `devices.current_build` is the build today and is not the one to report."
        : "In this sample each device has a single `device_builds` row, dated before any offer.",
    },
    setup,
    tables: [
      { name: "devices", columns: devCols, rows: devRows },
      { name: "device_builds", columns: bCols, rows: bRows },
      { name: "update_offers", columns: oCols, rows: oRows },
      { name: "update_installs", columns: iCols, rows: iRows },
      { name: "device_checkins", columns: ckCols, rows: ckRows },
    ],
    expected: { columns: ["ring", "os_build", "offered_devices", "online_devices", "compliant_devices", "compliance_rate"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
