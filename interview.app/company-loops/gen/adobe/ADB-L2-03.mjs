/* ADB-L2-03 — Debug the monthly font usage report (debug, Python).
   Simulated practice scenario. All data is generated from the seed. Font families,
   accounts and projects are fictional.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template.
   Planted bugs (see the evaluator notes): the month is read from the local time
   string instead of UTC; a variable-font instance's axis settings are kept in the
   style, so every instance counts as a new style; desktop accounts are counted per
   style instead of per family; web-project additions are counted as desktop
   activations; deactivation events are counted as activations.
   level: 1 Medium (desktop and web, fixed styles, mid-month times)
          · 2 Hard (+ variable-font instances, several styles per account, deactivations)
          · 3 Very Hard (+ times near month ends in many UTC offsets) */
export const kind = "debug";
export const entry = "font_usage_report";
export const signature = "def font_usage_report(events: list[dict]) -> dict:";
export const starter = `def _month(ts):
    return ts[:7]                      # "2026-04-30T21:15:00-05:00" -> "2026-04"


def font_usage_report(events):
    report = {}
    for ev in events:
        family, style = ev["font"].split("/", 1)
        row = report.setdefault(_month(ev["ts"]), {}).setdefault(family, {
            "desktop_activations": 0,
            "desktop_accounts": set(),
            "styles": set(),
            "web_projects": set(),
        })
        if ev["surface"] == "web":
            row["web_projects"].add(ev["project"])
        row["desktop_activations"] += 1
        row["desktop_accounts"].add((ev["account"], style))
        row["styles"].add(style)
    return {
        month: {
            family: {
                "desktop_activations": row["desktop_activations"],
                "desktop_accounts": len(row["desktop_accounts"]),
                "styles": len(row["styles"]),
                "web_projects": len(row["web_projects"]),
            }
            for family, row in families.items()
        }
        for month, families in report.items()
    }
`;

export const prelude = `
def _gen_font_events(n, seed):
    x, out = seed, []
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    fams = ['Harbor Serif', 'Lumen Sans', 'Quarry Grotesk', 'Atlas Mono', 'Fennel Display', 'Orchid Script']
    styles = ['Regular', 'Italic', 'Bold', 'Light', 'Black Italic']
    offs = ['+00:00', '-05:00', '-08:00', '+05:30', '+09:00', '+01:00']
    for i in range(n):
        fam = fams[rnd(6)]
        st = styles[rnd(5)]
        if rnd(4) == 0:
            st = 'Roman@wght=%d,wdth=%d' % (100 + 50 * rnd(16), 75 + 5 * rnd(6))
        ts = '2026-%02d-%02dT%02d:%02d:00%s' % (1 + rnd(12), 1 + rnd(28), rnd(24), rnd(60), offs[rnd(6)])
        web = rnd(3) == 0
        out.append({'type': 'deactivate' if rnd(5) == 0 else 'activate',
                    'surface': 'web' if web else 'desktop',
                    'account': 'acct-%d' % rnd(5000),
                    'project': ('kit-%d' % rnd(800)) if web else None,
                    'font': fam + '/' + st, 'ts': ts})
    return out
`.trim() + "\n";

// The specification, implemented independently of the Python reference.
function utcMonth(ts) {
  const m = ts.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})([+-])(\d{2}):(\d{2})$/);
  if (!m) throw new Error("bad ts " + ts);
  const sign = m[7] === "+" ? 1 : -1;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - sign * (+m[8] * 60 + +m[9]) * 60000;
  const d = new Date(ms);
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
}
export function oracle(events) {
  const rows = new Map();     // month -> family -> sets
  for (const e of events) {
    if (e.type !== "activate") continue;
    const slash = e.font.indexOf("/");
    const family = e.font.slice(0, slash);
    const style = e.font.slice(slash + 1).split("@")[0];
    const month = utcMonth(e.ts);
    if (!rows.has(month)) rows.set(month, new Map());
    const fams = rows.get(month);
    if (!fams.has(family)) fams.set(family, { acts: 0, accounts: new Set(), styles: new Set(), projects: new Set() });
    const row = fams.get(family);
    row.styles.add(style);
    if (e.surface === "desktop") { row.acts++; row.accounts.add(e.account); } else row.projects.add(e.project);
  }
  const out = {};
  for (const [month, fams] of rows) {
    out[month] = {};
    for (const [f, x] of fams) out[month][f] = { desktop_activations: x.acts, desktop_accounts: x.accounts.size, styles: x.styles.size, web_projects: x.projects.size };
  }
  return out;
}

function py(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v + "'";
  if (Array.isArray(v)) return "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `'${k}': ${py(x)}`).join(", ") + "}";
}
const pyArgs = (events) => "(" + py(events) + ",)";

const FAMS = ["Harbor Serif", "Lumen Sans", "Quarry Grotesk", "Atlas Mono", "Fennel Display", "Orchid Script", "Tidewater Slab"];
const STYLES = ["Regular", "Italic", "Bold", "Bold Italic", "Light", "Semibold"];
const OFFS = ["+00:00", "-05:00", "-07:00", "-08:00", "+05:30", "+09:00", "+01:00", "+10:00"];
const p2 = (n) => String(n).padStart(2, "0");
const acct = (r) => "acct-" + r.int(1000, 9999);
const kit = (r) => "kit-" + r.int(100, 999).toString(16);
const variable = (r) => `Roman@wght=${r.pick([300, 400, 450, 600, 650, 700, 800])},wdth=${r.pick([75, 85, 100, 110])}`;

function stamp(r, level, month) {
  if (level === 3 && r.chance(0.4)) {
    // near a month boundary, in an offset that may move it into the next or previous UTC month
    const days = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
    return r.chance(0.5)
      ? `2026-${p2(month)}-${p2(days)}T${p2(r.int(17, 23))}:${p2(r.int(0, 59))}:00${r.pick(["-05:00", "-07:00", "-08:00"])}`
      : `2026-${p2(month)}-01T0${r.int(0, 5)}:${p2(r.int(0, 59))}:00${r.pick(["+05:30", "+09:00", "+10:00"])}`;
  }
  return `2026-${p2(month)}-${p2(r.int(5, 24))}T${p2(r.int(0, 23))}:${p2(r.int(0, 59))}:00${level === 1 ? "+00:00" : r.pick(OFFS)}`;
}

function replay(r, level) {
  const fams = r.sample(FAMS, level === 1 ? 2 : 3);
  const months = level === 1 ? [r.int(2, 11)] : (() => { const m = r.int(2, 10); return [m, m + 1]; })();
  const accounts = Array.from({ length: level === 1 ? 3 : 4 }, () => acct(r));
  const kits = [kit(r), kit(r)];
  const evs = [];
  const n = level === 1 ? r.int(7, 10) : r.int(10, 14);
  for (let i = 0; i < n; i++) {
    const fam = r.pick(fams);
    const style = level >= 2 && r.chance(0.3) ? variable(r) : r.pick(STYLES.slice(0, level === 1 ? 3 : 6));
    const web = r.chance(0.3);
    const type = level >= 2 && r.chance(0.2) ? "deactivate" : "activate";
    evs.push({ type, surface: web ? "web" : "desktop", account: r.pick(accounts), project: web ? r.pick(kits) : null, font: fam + "/" + style, ts: stamp(r, level, r.pick(months)) });
  }
  return evs;
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const ev = replay(r, level);
    samples.push({ args: pyArgs(ev), expect: py(oracle(ev)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [F, G] = r.sample(FAMS, 2);
  const [S1, S2] = r.sample(STYLES, 2);
  const [A, B] = [acct(r), acct(r)];
  const K = kit(r);
  const mo = r.int(3, 10);
  const mid = (h = 12) => `2026-${p2(mo)}-${p2(r.int(10, 20))}T${p2(h)}:${p2(r.int(0, 59))}:00+00:00`;
  const ev = (type, surface, account, font, ts, project = null) => ({ type, surface, account, project, font, ts });
  const lastDay = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo];
  const edges = [
    ["an evening activation in the Americas belongs to the next UTC month",
      [ev("activate", "desktop", A, `${F}/${S1}`, `2026-${p2(mo)}-${p2(lastDay)}T${p2(r.int(20, 23))}:15:00-05:00`)]],
    ["an early-morning activation east of UTC belongs to the previous UTC month",
      [ev("activate", "desktop", A, `${F}/${S1}`, `2026-${p2(mo)}-01T0${r.int(1, 4)}:30:00+05:30`)]],
    ["two instances of one variable style are one style",
      [ev("activate", "desktop", A, `${F}/Roman@wght=400,wdth=100`, mid(9)), ev("activate", "desktop", B, `${F}/Roman@wght=700,wdth=85`, mid(10))]],
    ["one account with two styles of a family is one account",
      [ev("activate", "desktop", A, `${F}/${S1}`, mid(9)), ev("activate", "desktop", A, `${F}/${S2}`, mid(11))]],
    ["a font added to a web project is not a desktop activation",
      [ev("activate", "desktop", A, `${F}/${S1}`, mid(9)), ev("activate", "web", B, `${F}/${S1}`, mid(14), K)]],
    ["a deactivation is not an activation",
      [ev("activate", "desktop", A, `${F}/${S1}`, mid(9)), ev("deactivate", "desktop", A, `${F}/${S1}`, mid(15))]],
    ["a family that was only deactivated this month gets no row",
      [ev("activate", "desktop", A, `${G}/${S2}`, mid(8)), ev("deactivate", "desktop", B, `${F}/${S1}`, mid(15))]],
    ["the same account activating the same style twice is two activations and one account",
      [ev("activate", "desktop", A, `${F}/${S1}`, mid(9)), ev("activate", "desktop", A, `${F}/${S1}`, mid(16))]],
    ["families are reported separately",
      [ev("activate", "desktop", A, `${F}/${S1}`, mid(9)), ev("activate", "desktop", A, `${G}/${S1}`, mid(10))]],
  ];
  for (const [name, evs] of edges) tests.push({ name, args: pyArgs(evs), expect: py(oracle(evs)) });

  const n = level === 1 ? 100000 : 200000;
  tests.push({ name: `${n.toLocaleString("en-US")} events in time`, args: `(_gen_font_events(${n}, ${r.int(1, 1_000_000)}),)`, limit_s: 8 });

  return {
    vars: {
      replay_rule: level === 1
        ? "This replay covers desktop activations and web-project additions with fixed styles; the checks also include variable fonts, deactivations and times near month ends."
        : level === 2
          ? "This replay adds variable-font instances, accounts that activate several styles, and deactivations, in several UTC offsets."
          : "This replay adds activations near month ends in offsets from UTC−08:00 to UTC+10:00, so some land in a different UTC month from their local date.",
    },
    samples,
    tests,
  };
}
