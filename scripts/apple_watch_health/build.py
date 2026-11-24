#!/usr/bin/env python3
"""Build the generated parts of the Apple Watch health guide.

    python3 scripts/apple_watch_health/build.py           # write
    python3 scripts/apple_watch_health/build.py --check   # CI: fail if anything is stale

Nothing numeric in the guide's audit, charts or sample output is typed by hand.
This script:

  1. runs the two teaching scripts (articles/apple-watch-health/code/) on the
     synthetic sample export and records their real output;
  2. generates a SYNTHETIC year of daily data (seeded, so it never changes) and
     writes it as a downloadable CSV;
  3. audits that year with the rules the guide describes (valid-day rule,
     non-overlapping quarters, a baseline chosen by a stated rule, bootstrap
     intervals, sustained-change test) and writes the findings and charts;
  4. computes the 1,000-person sensitivity example from Apple's published
     hypertension-notification figures;
  5. embeds the AI analyst prompt from its single source file and checks it has
     all fifteen steps.

Generated HTML sits between <!-- awh:NAME --> and <!-- /awh:NAME --> markers.
Standard library only.
"""
import csv
import hashlib
import html
import io
import math
import random
import re
import shutil
import statistics as st
import subprocess
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "articles/your-apple-watch-knows-more-about-your-health.html"
REF = ROOT / "articles/apple-watch-health/reference.html"
BASE = ROOT / "articles/apple-watch-health"
CODE = BASE / "code"
SAMPLE = CODE / "sample"
DATA = BASE / "data/synthetic-year.csv"
PROMPT = BASE / "health-analyst-prompt.txt"

E = html.escape
INK, INK2, INK3, RULE = "#1B1A18", "#45413B", "#5C5750", "#D8CFC1"
S1, S2, S3 = "#2a78d6", "#eb6834", "#eda100"          # validated categorical slots
GREY = "#E5DFD4"
FONT = "IBM Plex Sans, system-ui, sans-serif"

START = date(2025, 11, 23)
DAYS = 365
QUARTERS = [("Q1", date(2025, 11, 23), date(2026, 2, 21)),
            ("Q2", date(2026, 2, 22), date(2026, 5, 23)),
            ("Q3", date(2026, 5, 24), date(2026, 8, 22)),
            ("Q4", date(2026, 8, 23), date(2026, 11, 22))]
ILLNESS = (date(2026, 2, 2), date(2026, 2, 8))
TRAVEL = (date(2026, 3, 9), date(2026, 3, 20))
NO_WEAR = (date(2026, 8, 3), date(2026, 8, 12))
NEW_JOB = date(2026, 6, 1)
EASE = date(2026, 9, 1)
DEVICE_CHANGE = date(2026, 9, 18)
VALID_WEAR_HOURS = 12            # a day counts for resting HR only with >= 12 worn hours
ROLL = 28                        # rolling window, days
ROLL_MIN = 14                    # a window needs at least this many valid days
OUTLIER_BPM = 6                  # a day this far above its own trailing median is an outlier


def inside(d, span):
    return span[0] <= d <= span[1]


def fmt(x, nd=0):
    if x is None:
        return "–"
    return f"{x:,.{nd}f}".replace("-", "−")


def hm(minutes):
    """Minutes after 21:00 → clock time."""
    t = (21 * 60 + round(minutes)) % (24 * 60)
    return f"{t // 60:02d}:{t % 60:02d}"


def hours(minutes):
    h, m = divmod(round(minutes), 60)
    return f"{h} h {m:02d} min"


# ───────────────────────────── 1. sample run ─────────────────────────────
def sample_run():
    tmp = Path(tempfile.mkdtemp(prefix="awh-"))
    try:
        shutil.copy(SAMPLE / "export.xml", tmp / "export.xml")
        logs = []
        for cmd in (["health_to_csv.py", "export.xml", "records.csv"],
                    ["daily_summary.py", "records.csv", "daily.csv",
                     "--priority", "Sample Apple Watch,Sample iPhone"]):
            run = subprocess.run([sys.executable, "-I", str(CODE / cmd[0]), *cmd[1:]],
                                 cwd=tmp, capture_output=True, text=True)
            if run.returncode != 0:
                raise SystemExit(f"{cmd[0]} failed on the sample:\n{run.stderr}")
            shown = " ".join(f'"{a}"' if " " in a else a for a in cmd)
            logs.append(f"$ python3 {shown}\n{run.stdout}{run.stderr}")
        errors = []
        for args, label in ((["missing.xml", "x.csv"], "a file that is not there"),):
            run = subprocess.run([sys.executable, "-I", str(CODE / "health_to_csv.py"), *args],
                                 cwd=tmp, capture_output=True, text=True)
            errors.append((label, run.returncode, run.stderr.strip()))
        return ((tmp / "records.csv").read_text(), (tmp / "daily.csv").read_text(),
                "\n".join(logs).rstrip(), errors)
    finally:
        shutil.rmtree(tmp)


def sample_fragment(daily_csv, log, errors):
    rows = list(csv.reader(io.StringIO(daily_csv)))
    head = "".join(f"<th scope=\"col\">{E(h)}</th>" for h in rows[0])
    body = "".join("<tr>" + "".join(f"<td>{E(c) or '<span class=\"nil\">blank</span>'}</td>" for c in r) + "</tr>"
                   for r in rows[1:])
    err = "".join(f"<li>For {E(l)}, it stops with exit code {c} and says: <code>{E(m)}</code></li>"
                  for l, c, m in errors)
    return (f'<pre tabindex="0" aria-label="Terminal output from the sample run"><code>{E(log)}</code></pre>\n'
            f'<div class="tablewrap" tabindex="0" role="region" aria-label="Scrollable table"><table class="mono"><caption>daily.csv from the sample, '
            f'exactly as the script wrote it</caption><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>\n'
            f'<ul class="defs">{err}</ul>')


# ─────────────────────────── 2. synthetic year ───────────────────────────
def offset_for(d):
    if inside(d, TRAVEL):
        return "+0000"                      # London, before UK summer time
    if date(2026, 3, 8) <= d < date(2026, 11, 1):
        return "-0400"                      # New York, daylight time
    return "-0500"


def stress(d):
    """0 → 1 load from the (fictional) new job; eases from September."""
    if d < NEW_JOB:
        return 0.0
    up = min(1.0, (d - NEW_JOB).days / 21)
    if d < EASE:
        return up
    return max(0.45, 1.0 - 0.55 * min(1.0, (d - EASE).days / 30))


def lagged(d, days):
    return st.mean(stress(d - timedelta(k)) for k in range(days))


def synthesize():
    rng = random.Random(20261124)
    rows = []
    for i in range(DAYS):
        d = START + timedelta(i)
        s, s_rhr = stress(d), lagged(d, 42)
        ill, travel = inside(d, ILLNESS), inside(d, TRAVEL)
        jet = travel and (d - TRAVEL[0]).days < 3
        device = "Apple Watch Series 9" if d < DEVICE_CHANGE else "Apple Watch Series 12"
        partial = i in (0, DAYS - 1)
        charging = rng.random() < 0.06
        if inside(d, NO_WEAR):
            wear = 0
        elif partial:
            wear = 9 if i == 0 else 11
        elif charging:
            wear = rng.randint(13, 16)
        else:
            wear = rng.randint(20, 23)
        if rng.random() < 0.03 and wear:
            wear = rng.randint(5, 10)                       # a forgotten morning
        note = []
        if ill: note.append("illness (cold), logged")
        if travel: note.append("travel: London")
        if inside(d, NO_WEAR): note.append("watch left at home")
        if d == NEW_JOB: note.append("new job starts")
        if d == DEVICE_CHANGE: note.append("new watch: Series 12")
        if d == date(2026, 9, 15): note.append("watchOS 27 installed")
        if partial: note.append("partial day (export edge)")
        # sleep
        asleep = bedtime = ""
        if wear and not charging and not partial:
            mean = 432 - 48 * s + (35 if ill else 0) - (60 if jet else 0)
            asleep = round(min(600, max(240, rng.gauss(mean, 30 + 18 * s))))
            weekend = d.weekday() >= 4
            bt = rng.gauss(85 + 45 * s + (25 if weekend else 0) + (95 if jet else 0), 20 + 25 * s)
            bedtime = hm(bt)
        # resting heart rate
        rhr = ""
        if wear >= 5:
            mean = 58.0 + 5.5 * s_rhr + (7 if ill else 0) + (3 if jet else 0)
            rhr = round(rng.gauss(mean, 1.6))
        # HRV (SDNN): sampled irregularly; the Series 12 samples far more often,
        # across the day, which lowers the typical value (a synthetic assumption)
        hrv, n = "", 0
        if wear:
            n = rng.choice([0, 1, 2, 2, 3, 3, 4, 5]) if device.endswith("9") else rng.randint(30, 60)
            if n:
                level = 43 - 6 * s - (12 if ill else 0) - (0 if device.endswith("9") else 6)
                hrv = round(rng.gauss(level, 9 / math.sqrt(n) + 4), 1)
        # steps: one source per day, never summed
        weekend = d.weekday() >= 5
        if wear:
            steps, src = round(max(1500, rng.gauss(7600 - 900 * s + (1200 if weekend else 0), 1900))), "watch"
        else:
            steps, src = round(max(800, rng.gauss(5200, 1500))), "iPhone"
        # cardio fitness estimate: only after some brisk outdoor walks
        vo2 = ""
        winter = d.month in (12, 1, 2)
        if wear and rng.random() < (0.08 if winter else 0.15):
            vo2 = round(rng.gauss(34.0 - 1.6 * lagged(d, 60), 1.1), 1)
        rows.append({"date": d.isoformat(), "partial_day": int(partial), "device": device,
                     "utc_offset": offset_for(d), "wear_hours": wear, "resting_hr_bpm": rhr,
                     "hrv_sdnn_ms": hrv, "hrv_samples": n, "asleep_min": asleep,
                     "bedtime": bedtime, "steps": steps, "steps_source": src,
                     "vo2max_est": vo2, "note": "; ".join(note)})
    out = io.StringIO()
    w = csv.DictWriter(out, fieldnames=list(rows[0]), lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
    header = ("# SYNTHETIC DATA. Invented by scripts/apple_watch_health/build.py (seed 20261124)\n"
              "# for the PaddySpeaks Apple Watch guide. Not a real person, not a medical record.\n")
    return header + out.getvalue()


def load(text):
    lines = [l for l in text.splitlines() if not l.startswith("#")]
    rows = list(csv.DictReader(lines))
    for r in rows:
        r["d"] = date.fromisoformat(r["date"])
        for k in ("wear_hours", "hrv_samples", "steps", "partial_day"):
            r[k] = int(r[k])
        for k in ("resting_hr_bpm", "hrv_sdnn_ms", "asleep_min", "vo2max_est"):
            r[k] = float(r[k]) if r[k] != "" else None
        if r["bedtime"]:
            h, m = map(int, r["bedtime"].split(":"))
            r["bed_min"] = ((h * 60 + m) - 21 * 60) % (24 * 60)
        else:
            r["bed_min"] = None
    return rows


# ───────────────────────────── 3. the audit ──────────────────────────────
def quartiles(xs):
    q = st.quantiles(xs, n=4, method="inclusive")
    return q[0], st.median(xs), q[2]


def boot_diff(a, b, rng, reps=2000):
    diffs = sorted(st.median(rng.choices(b, k=len(b))) - st.median(rng.choices(a, k=len(a)))
                   for _ in range(reps))
    return diffs[int(0.025 * reps)], diffs[int(0.975 * reps) - 1]


def excluded(r):
    return inside(r["d"], ILLNESS) or inside(r["d"], TRAVEL) or r["partial_day"]


def valid_rhr(r):
    return r["resting_hr_bpm"] is not None and r["wear_hours"] >= VALID_WEAR_HOURS and not r["partial_day"]


def quarter_of(d):
    for name, a, b in QUARTERS:
        if a <= d <= b:
            return name


def rolling(rows, pick):
    out = []
    for i, r in enumerate(rows):
        window = [pick(x) for x in rows[max(0, i - ROLL + 1): i + 1]]
        window = [v for v in window if v is not None]
        if len(window) >= ROLL_MIN:
            lo, md, hi = quartiles(window)
            out.append((r["d"], lo, md, hi, len(window)))
        else:
            out.append((r["d"], None, None, None, len(window)))
    return out


def longest_run(flags):
    best = cur = (0, None, None)
    for d, f in flags:
        if f:
            cur = (cur[0] + 1, cur[1] or d, d)
            if cur[0] > best[0]:
                best = cur
        else:
            cur = (0, None, None)
    return best


def audit(rows):
    rng = random.Random(7)
    A = {}
    # coverage
    def cov(pick, rule=None):
        have = [r for r in rows if pick(r) is not None]
        ok = [r for r in have if (rule or (lambda r: True))(r)]
        gap, run, last = 0, 0, None
        for r in rows:
            run = 0 if pick(r) is not None else run + 1
            gap = max(gap, run)
        return len(have), len(ok), gap
    A["cov"] = [
        ("Resting heart rate", "bpm", *cov(lambda r: r["resting_hr_bpm"], valid_rhr),
         f"worn ≥ {VALID_WEAR_HOURS} h, not a partial day"),
        ("Sleep, time asleep", "min", *cov(lambda r: r["asleep_min"]), "a sleep record exists"),
        ("HRV (SDNN)", "ms", *cov(lambda r: r["hrv_sdnn_ms"]), "at least one HRV sample"),
        ("Cardio fitness (VO₂ max estimate)", "mL/kg/min", *cov(lambda r: r["vo2max_est"]),
         "an estimate was made that day"),
        ("Steps", "count", *cov(lambda r: r["steps"]), "one source per day"),
    ]
    A["no_wear_days"] = sum(1 for r in rows if r["wear_hours"] == 0)
    A["low_wear_rhr"] = sum(1 for r in rows if r["resting_hr_bpm"] is not None
                            and r["wear_hours"] < VALID_WEAR_HOURS and not r["partial_day"])
    A["travel_days"] = (TRAVEL[1] - TRAVEL[0]).days + 1
    A["offsets"] = sorted({r["utc_offset"] for r in rows})
    # quarters (non-overlapping) and baseline by a stated rule
    per_q = {q: [r for r in rows if quarter_of(r["d"]) == q] for q, _, _ in QUARTERS}
    base_rhr = [r["resting_hr_bpm"] for r in per_q["Q1"] if valid_rhr(r) and not excluded(r)]
    base_sleep = [r["asleep_min"] for r in per_q["Q1"] if r["asleep_min"] is not None and not excluded(r)]
    A["base_n"] = len(base_rhr)
    A["base_rhr"] = quartiles(base_rhr)
    A["base_sleep"] = quartiles(base_sleep)
    qt = []
    for q, a, b in QUARTERS:
        rr = [r["resting_hr_bpm"] for r in per_q[q] if valid_rhr(r) and not excluded(r)]
        sl = [r["asleep_min"] for r in per_q[q] if r["asleep_min"] is not None and not excluded(r)]
        bt = [r["bed_min"] for r in per_q[q] if r["bed_min"] is not None and not excluded(r)]
        vo = [r["vo2max_est"] for r in per_q[q] if r["vo2max_est"] is not None]
        days = (b - a).days + 1
        qt.append({"q": q, "a": a, "b": b, "days": days,
                   "rhr_n": len(rr), "rhr": quartiles(rr),
                   "rhr_diff": boot_diff(base_rhr, rr, rng) if q != "Q1" else None,
                   "rhr_dmed": st.median(rr) - st.median(base_rhr),
                   "sleep_n": len(sl), "sleep": quartiles(sl),
                   "sleep_diff": boot_diff(base_sleep, sl, rng) if q != "Q1" else None,
                   "sleep_dmed": st.median(sl) - st.median(base_sleep),
                   "bed_sd": st.pstdev(bt), "bed_med": st.median(bt), "bed_n": len(bt),
                   "vo_n": len(vo), "vo": st.median(vo) if vo else None})
    A["q"] = qt
    # sustained change: 28-day rolling median above the baseline's upper quartile
    roll = rolling(rows, lambda r: r["resting_hr_bpm"] if valid_rhr(r) and not excluded(r) else None)
    A["roll_rhr"] = roll
    upper = A["base_rhr"][2]
    run = longest_run([(d, md is not None and md > upper) for d, lo, md, hi, n in roll])
    A["rhr_run"] = run
    A["roll_sleep"] = rolling(rows, lambda r: r["asleep_min"] if not excluded(r) else None)
    # outliers: a day at least OUTLIER_BPM above its own trailing 28-day median
    med_at = {d: md for d, lo, md, hi, n in roll}
    out = [r for r in rows if r["resting_hr_bpm"] is not None and not r["partial_day"]
           and med_at.get(r["d"] - timedelta(1)) is not None
           and r["resting_hr_bpm"] - med_at[r["d"] - timedelta(1)] >= OUTLIER_BPM]
    A["outliers"] = out
    A["outliers_ill"] = sum(1 for r in out if inside(r["d"], ILLNESS) or inside(r["d"], TRAVEL))
    # HRV: within device only
    s9 = [r for r in rows if r["device"].endswith("9") and r["hrv_sdnn_ms"] is not None and not excluded(r)]
    s12 = [r for r in rows if r["device"].endswith("12") and r["hrv_sdnn_ms"] is not None and not excluded(r)]
    A["hrv9"] = (len(s9), quartiles([r["hrv_sdnn_ms"] for r in s9]),
                 st.median([r["hrv_samples"] for r in s9]))
    A["hrv12"] = (len(s12), quartiles([r["hrv_sdnn_ms"] for r in s12]),
                  st.median([r["hrv_samples"] for r in s12]))
    A["hrv9_q1"] = quartiles([r["hrv_sdnn_ms"] for r in s9 if quarter_of(r["d"]) == "Q1"])
    A["hrv9_q3"] = quartiles([r["hrv_sdnn_ms"] for r in s9 if quarter_of(r["d"]) == "Q3"])
    A["rows"] = rows
    return A


def findings(A):
    q = {x["q"]: x for x in A["q"]}
    q1, q3, q4 = q["Q1"], q["Q3"], q["Q4"]
    n_run, a_run, b_run = A["rhr_run"]
    lo3, hi3 = q3["rhr_diff"]
    slo3, shi3 = q3["sleep_diff"]
    out = []
    out.append(dict(
        title="Coverage comes first",
        obs=(f"Resting heart rate exists on {A['cov'][0][2]} of {DAYS} days; {A['cov'][0][3]} pass the "
             f"valid-day rule (worn at least {VALID_WEAR_HOURS} hours, not a partial day). The watch was "
             f"not worn for {A['no_wear_days']} days in August, and {A['low_wear_rhr']} days carry a "
             f"resting value despite less than {VALID_WEAR_HOURS} hours of wear."),
        why="Holiday, charging overnight, forgotten mornings. None of it is physiology.",
        quality="High: wear hours and sample dates are recorded directly.",
        nxt="Report the denominator with every number. Treat the August gap as missing, never as normal."))
    out.append(dict(
        title="Resting heart rate rose in summer, and stayed up",
        obs=(f"Median resting heart rate was {fmt(q1['rhr'][1])} bpm in the baseline quarter "
             f"({q1['a']:%d %b %Y}–{q1['b']:%d %b %Y}, {A['base_n']} valid days, illness week excluded) and "
             f"{fmt(q3['rhr'][1])} bpm in {q3['a']:%d %b}–{q3['b']:%d %b %Y} ({q3['rhr_n']} valid days): a difference "
             f"of +{fmt(q3['rhr_dmed'], 1)} bpm, with a resampling interval of +{fmt(lo3, 1)} to +{fmt(hi3, 1)} bpm. "
             f"In {q4['a']:%d %b}–{q4['b']:%d %b} it was {fmt(q4['rhr'][1])} bpm ({q4['rhr_n']} valid days). "
             f"Resting values are whole numbers, so medians move in steps of 1 bpm. "
             f"The 28-day rolling median stayed above the baseline's upper quartile for {n_run} consecutive "
             f"days ({a_run:%d %b}–{b_run:%d %b %Y})."),
        why=("Sleep fell in the same months (next finding) and the notes record a new job from "
             f"{NEW_JOB:%d %b}. Heat, less exercise, alcohol or a medication change could do the same."),
        quality=("Moderate: enough valid days and a sustained run, but one person's data cannot "
                 "separate the explanations."),
        nxt="Compare with sleep and context first. If it persists, or comes with symptoms, take it to a clinician with the chart."))
    out.append(dict(
        title="Sleep got shorter and less regular",
        obs=(f"Median time asleep fell from {hours(q1['sleep'][1])} (baseline) to {hours(q3['sleep'][1])} "
             f"in Q3 ({fmt(q3['sleep_dmed'])} min; interval {fmt(slo3)} to {fmt(shi3)} min). The spread of "
             f"bedtimes (standard deviation) widened from {fmt(q1['bed_sd'])} to {fmt(q3['bed_sd'])} minutes, "
             f"and the median bedtime moved from {hm(q1['bed_med'])} to {hm(q3['bed_med'])}."),
        why="A later, more irregular schedule. Sleep stages are not used: they are estimates.",
        quality="Moderate: duration from the watch is reasonable for trends; bedtime is reliable.",
        nxt="A fixed wake time is the first experiment. Recheck the 28-day medians after a month."))
    out.append(dict(
        title="The illness week is an outlier, not a trend",
        obs=(f"{len(A['outliers'])} days sat at least {OUTLIER_BPM} bpm above the previous day's 28-day "
             f"median; {A['outliers_ill']} of them fall in the logged illness or travel days."),
        why="A cold, and jet lag on the first days in London.",
        quality="High for 'something happened'; it says nothing about what.",
        nxt="Keep the days, annotate them, and leave them out of the baseline. Nothing to act on now."))
    n9, h9, s9 = A["hrv9"]
    n12, h12, s12 = A["hrv12"]
    out.append(dict(
        title="HRV cannot be compared across the watch change",
        obs=(f"On the Series 9, median HRV (SDNN) was {fmt(h9[1], 1)} ms over {n9} days with a median of "
             f"{fmt(s9)} readings a day; on the Series 12 from {DEVICE_CHANGE:%d %b}, {fmt(h12[1], 1)} ms "
             f"over {n12} days with {fmt(s12)} readings a day. Within the Series 9 alone, the median fell "
             f"from {fmt(A['hrv9_q1'][1], 1)} ms (Q1) to {fmt(A['hrv9_q3'][1], 1)} ms (Q3)."),
        why=("Across devices: a different sensor sampling far more often, across the whole day, so the drop "
             "is mostly measurement. Within the Series 9: consistent with the shorter, later sleep."),
        quality="Low for any cross-device comparison.",
        nxt="Start a new HRV baseline on the new watch. Compare a device only with itself."))
    vq = [x for x in A["q"] if x["vo"] is not None]
    spread = max(x["vo"] for x in vq) - min(x["vo"] for x in vq)
    err = 0.13 * q1["vo"]
    out.append(dict(
        title="Cardio fitness: a small dip, inside the estimate's error",
        obs=("Estimates per quarter: " + ", ".join(f"{x['q']} {x['vo_n']}" for x in A['q']) +
             ". Quarterly medians: " + ", ".join(f"{x['q']} {fmt(x['vo'], 1)}" for x in A['q']) +
             f" mL/kg/min: a range of {fmt(spread, 1)}."),
        why="Possibly less fitness in a busy year; possibly just which walks were brisk enough to count.",
        quality=(f"Low: the quarterly medians differ by less than the estimate's typical error "
                 f"(about 13%, roughly {fmt(err, 1)} mL/kg/min at this level), and winter produced few estimates."),
        nxt="Keep up brisk outdoor walks so estimates keep coming; judge the direction over two or more quarters."))
    out.append(dict(
        title="What this year cannot tell you",
        obs=("There is no earlier year, so there is no same-season comparison: that needs at least two "
             "years (730 days) of coverage. There is no blood pressure, no laboratory data, no symptoms log "
             "and no medication list in this dataset."),
        why="The data were never collected.",
        quality="Not applicable: absence is a finding, not a normal result.",
        nxt="Note it on the clinician summary. Add a validated cuff if blood pressure matters to you."))
    return out


def findings_html(fs, only=None):
    items = []
    for i, f in enumerate(fs):
        if only is not None and i not in only:
            continue
        items.append(
            f'<div class="finding"><h4>{E(f["title"])}</h4><dl>'
            f'<dt>Observation</dt><dd>{E(f["obs"])}</dd>'
            f'<dt>Possible explanation</dt><dd>{E(f["why"])}</dd>'
            f'<dt>Evidence quality</dt><dd>{E(f["quality"])}</dd>'
            f'<dt>Next step</dt><dd>{E(f["nxt"])}</dd></dl></div>')
    return '<div class="findings">' + "".join(items) + "</div>"


def coverage_html(A):
    rows = "".join(
        f"<tr><th scope=\"row\">{E(n)}</th><td>{E(u)}</td><td>{h} / {DAYS}</td>"
        f"<td>{ok} / {DAYS} ({ok / DAYS:.0%})</td><td>{gap}</td><td>{E(rule)}</td></tr>"
        for n, u, h, ok, gap, rule in A["cov"])
    return ('<div class="tablewrap" tabindex="0" role="region" aria-label="Scrollable table"><table><caption>Coverage, synthetic year '
            f'{START:%d %b %Y} – {(START + timedelta(DAYS - 1)):%d %b %Y}</caption>'
            '<thead><tr><th scope="col">Measure</th><th scope="col">Unit</th>'
            '<th scope="col">Days with data</th><th scope="col">Days usable</th>'
            '<th scope="col">Longest gap (days)</th><th scope="col">Rule for "usable"</th></tr></thead>'
            f"<tbody>{rows}</tbody></table></div>")


def quarters_html(A):
    body = ""
    for x in A["q"]:
        d = x["rhr_diff"]
        sd = x["sleep_diff"]
        body += (f"<tr><th scope=\"row\">{x['q']}<br><span class=\"small\">{x['a']:%d %b %Y} – "
                 f"{x['b']:%d %b %Y} · {x['days']} days</span></th>"
                 f"<td>{fmt(x['rhr'][1])} <span class=\"small\">({fmt(x['rhr'][0])}–{fmt(x['rhr'][2])}) · n = {x['rhr_n']}</span></td>"
                 f"<td>{'baseline' if d is None else fmt(x['rhr_dmed'], 1) + ' <span class=\"small\">(' + fmt(d[0], 1) + ' to ' + fmt(d[1], 1) + ')</span>'}</td>"
                 f"<td>{fmt(x['sleep'][1])} <span class=\"small\">({fmt(x['sleep'][0])}–{fmt(x['sleep'][2])}) · n = {x['sleep_n']}</span></td>"
                 f"<td>{'baseline' if sd is None else fmt(x['sleep_dmed']) + ' <span class=\"small\">(' + fmt(sd[0]) + ' to ' + fmt(sd[1]) + ')</span>'}</td>"
                 f"<td>{fmt(x['bed_sd'])}</td><td>{x['vo_n']}</td></tr>")
    return ('<div class="tablewrap" tabindex="0" role="region" aria-label="Scrollable table"><table><caption>Four non-overlapping quarters of one synthetic year. '
            'Median (interquartile range) · number of usable days. Differences are against the baseline '
            '(Q1, illness week excluded), with a 95% bootstrap interval for the difference in medians.</caption>'
            '<thead><tr><th scope="col">Quarter</th><th scope="col">Resting HR, bpm</th>'
            '<th scope="col">Δ vs baseline, bpm</th><th scope="col">Asleep, min</th>'
            '<th scope="col">Δ vs baseline, min</th><th scope="col">Bedtime spread (SD), min</th>'
            '<th scope="col">VO₂ estimates</th></tr></thead>'
            f"<tbody>{body}</tbody></table></div>")


# ─────────────────────────────── charts ──────────────────────────────────
W, H = 760, 330
L, R, T, B = 52, 16, 40, 86


def xpos(d):
    return L + (W - L - R) * (d - START).days / (DAYS - 1)


def month_ticks():
    out, d = [], date(START.year, START.month, 1)
    while d <= START + timedelta(DAYS - 1):
        if d >= START:
            out.append(d)
        d = date(d.year + (d.month == 12), d.month % 12 + 1, 1)
    return out


def axes(ylo, yhi, step, unit, title, sub):
    def y(v):
        return T + (H - T - B) * (1 - (v - ylo) / (yhi - ylo))
    g = [f'<text x="{L}" y="16" font-size="13.5" font-weight="600" fill="{INK}">{E(title)}</text>',
         f'<text x="{L}" y="32" font-size="12" fill="{INK3}">{E(sub)}</text>']
    v = ylo
    while v <= yhi + 1e-9:
        yy = y(v)
        g.append(f'<line x1="{L}" x2="{W - R}" y1="{yy:.1f}" y2="{yy:.1f}" stroke="{RULE}" stroke-width="1"/>')
        g.append(f'<text x="{L - 6}" y="{yy + 4:.1f}" font-size="11.5" text-anchor="end" fill="{INK3}">{v:g}</text>')
        v += step
    g.append(f'<text x="12" y="{(T + H - B) / 2:.0f}" font-size="11.5" fill="{INK3}" '
             f'transform="rotate(-90 12 {(T + H - B) / 2:.0f})" text-anchor="middle">{E(unit)}</text>')
    for d in month_ticks():
        x = xpos(d)
        g.append(f'<line x1="{x:.1f}" x2="{x:.1f}" y1="{H - B}" y2="{H - B + 4}" stroke="{INK3}"/>')
        lab = d.strftime("%b") + (f" {d.year}" if d.month == 1 or d == month_ticks()[0] else "")
        g.append(f'<text x="{x + 2:.1f}" y="{H - B + 16}" font-size="11" fill="{INK3}">{E(lab)}</text>')
    return y, g


def coverage_strip(rows, pick, y0, label):
    """Per-month usable days as a strip: the denominator under every chart."""
    g = [f'<text x="{L}" y="{y0 - 6}" font-size="11" fill="{INK3}">{E(label)}</text>']
    months = {}
    for r in rows:
        k = (r["d"].year, r["d"].month)
        months.setdefault(k, [0, 0])
        months[k][1] += 1
        months[k][0] += pick(r)
    for (yy, mm), (ok, tot) in months.items():
        a = max(START, date(yy, mm, 1))
        days_in = tot
        x0, x1 = xpos(a), xpos(a + timedelta(days_in - 1)) + (W - L - R) / (DAYS - 1)
        frac = ok / tot
        g.append(f'<rect x="{x0:.1f}" y="{y0}" width="{x1 - x0 - 2:.1f}" height="16" rx="3" fill="{GREY}"/>')
        g.append(f'<rect x="{x0:.1f}" y="{y0}" width="{(x1 - x0 - 2) * frac:.1f}" height="16" rx="3" fill="{INK3}" opacity="0.55">'
                 f'<title>{date(yy, mm, 1):%B %Y}: {ok} of {tot} days usable</title></rect>')
        if x1 - x0 > 30:
            g.append(f'<text x="{(x0 + x1) / 2 - 1:.1f}" y="{y0 + 12}" font-size="10" text-anchor="middle" fill="{INK}">{ok}/{tot}</text>')
    return g


def band_path(pts, y):
    top = [(xpos(d), y(hi)) for d, lo, md, hi, n in pts]
    bot = [(xpos(d), y(lo)) for d, lo, md, hi, n in reversed(pts)]
    return "M" + " L".join(f"{a:.1f},{b:.1f}" for a, b in top + bot) + " Z"


def segments(roll):
    seg, cur = [], []
    for p in roll:
        if p[2] is None:
            if cur:
                seg.append(cur)
            cur = []
        else:
            cur.append(p)
    if cur:
        seg.append(cur)
    return seg


def marker(d, text, y, g, dy=0):
    x = xpos(d)
    g.append(f'<line x1="{x:.1f}" x2="{x:.1f}" y1="{T}" y2="{H - B}" stroke="{INK3}" stroke-dasharray="3 3"/>')
    g.append(f'<text x="{x + 3:.1f}" y="{T + 10 + dy}" font-size="10.5" fill="{INK2}">{E(text)}</text>')


def span_shade(span, text, g, dy=0):
    x0, x1 = xpos(span[0]), xpos(span[1])
    g.append(f'<rect x="{x0:.1f}" y="{T}" width="{max(2, x1 - x0):.1f}" height="{H - T - B}" fill="{INK3}" opacity="0.08"/>')
    g.append(f'<text x="{x0 + 2:.1f}" y="{T + 10 + dy}" font-size="10.5" fill="{INK2}">{E(text)}</text>')


def svg_wrap(g, title, desc, ident):
    return (f'<svg viewBox="0 0 {W} {H}" role="img" aria-labelledby="{ident}-t {ident}-d" '
            f'xmlns="http://www.w3.org/2000/svg" font-family="{FONT}">'
            f'<title id="{ident}-t">{E(title)}</title><desc id="{ident}-d">{E(desc)}</desc>'
            + "".join(g) + "</svg>")


def chart_rhr(A):
    rows, roll = A["rows"], A["roll_rhr"]
    y, g = axes(50, 75, 5, "bpm", "Resting heart rate, one synthetic year",
                "Dots: each usable day · line: 28-day rolling median · blue band: its middle half (IQR) · "
                "dashed lines: baseline IQR")
    lo, md, hi = A["base_rhr"]
    g.append(f'<rect x="{L}" y="{y(hi):.1f}" width="{W - L - R}" height="{y(lo) - y(hi):.1f}" fill="{S3}" opacity="0.12"/>')
    for v in (lo, hi):
        g.append(f'<line x1="{L}" x2="{W - R}" y1="{y(v):.1f}" y2="{y(v):.1f}" stroke="{INK3}" stroke-dasharray="5 4"/>')
    span_shade(ILLNESS, "ill", g)
    span_shade(TRAVEL, "travel", g, 12)
    span_shade(NO_WEAR, "not worn", g)
    marker(NEW_JOB, "new job", y, g, 24)
    marker(DEVICE_CHANGE, "new watch", y, g, 24)
    for r in rows:
        v = r["resting_hr_bpm"]
        if v is None:
            continue
        ok = valid_rhr(r) and not excluded(r)
        g.append(f'<circle cx="{xpos(r["d"]):.1f}" cy="{y(min(75, v)):.1f}" r="1.9" '
                 f'fill="{INK3 if ok else "none"}" stroke="{INK3}" stroke-width="0.8" opacity="{0.55 if ok else 0.6}">'
                 f'<title>{r["d"]:%a %d %b %Y}: {v:g} bpm · worn {r["wear_hours"]} h'
                 f'{"" if ok else " · not used (" + ("low wear" if r["wear_hours"] < VALID_WEAR_HOURS else "illness/travel/partial") + ")"}</title></circle>')
    for seg in segments(roll):
        g.append(f'<path d="{band_path(seg, y)}" fill="{S1}" opacity="0.18"/>')
        g.append('<path d="M' + " L".join(f"{xpos(d):.1f},{y(m):.1f}" for d, l, m, h, n in seg)
                 + f'" fill="none" stroke="{S1}" stroke-width="2"/>')
    for d, l, m, h, n in roll[::7]:
        if m is not None:
            g.append(f'<circle cx="{xpos(d):.1f}" cy="{y(m):.1f}" r="7" fill="transparent">'
                     f'<title>28 days to {d:%d %b %Y}: median {m:g} bpm (IQR {l:g}–{h:g}) from {n} usable days</title></circle>')
    g += coverage_strip(rows, lambda r: int(valid_rhr(r)), H - B + 40,
                        f"Usable days per month (worn ≥ {VALID_WEAR_HOURS} h)")
    n_run, a, b = A["rhr_run"]
    return svg_wrap(g, "Resting heart rate across one synthetic year",
                    f"Synthetic data from {START:%d %B %Y} to {(START + timedelta(DAYS - 1)):%d %B %Y}. "
                    f"The baseline middle half is {lo:g} to {hi:g} bpm. The 28-day median rises from June and "
                    f"stays above the baseline's upper quartile for {n_run} days, {a:%d %B} to {b:%d %B %Y}. "
                    f"Gaps: illness week in February, travel in March, ten days not worn in August. "
                    f"A coverage strip below shows usable days per month.", "rhr")


def chart_sleep(A):
    rows, roll = A["rows"], A["roll_sleep"]
    y, g = axes(5, 9, 1, "hours asleep", "Time asleep per night, one synthetic year",
                "Line: 28-day rolling median · band: its middle half (IQR) · stages are not shown")
    span_shade(TRAVEL, "travel", g)
    span_shade(NO_WEAR, "not worn", g)
    marker(NEW_JOB, "new job", y, g, 12)
    for r in rows:
        if r["asleep_min"] is not None:
            h = r["asleep_min"] / 60
            g.append(f'<circle cx="{xpos(r["d"]):.1f}" cy="{y(max(5, min(9, h))):.1f}" r="1.7" fill="{INK3}" opacity="0.4">'
                     f'<title>Night of {r["d"]:%a %d %b %Y}: {hours(r["asleep_min"])}, bedtime {r["bedtime"]}</title></circle>')
    for seg in segments(roll):
        hs = [(d, l / 60, m / 60, h / 60, n) for d, l, m, h, n in seg]
        g.append(f'<path d="{band_path(hs, y)}" fill="{S1}" opacity="0.18"/>')
        g.append('<path d="M' + " L".join(f"{xpos(d):.1f},{y(m):.1f}" for d, l, m, h, n in hs)
                 + f'" fill="none" stroke="{S1}" stroke-width="2"/>')
    g += coverage_strip(rows, lambda r: int(r["asleep_min"] is not None), H - B + 40,
                        "Nights with a sleep record per month")
    q = {x["q"]: x for x in A["q"]}
    return svg_wrap(g, "Time asleep across one synthetic year",
                    f"Synthetic data. Median time asleep is {hours(q['Q1']['sleep'][1])} in the baseline quarter "
                    f"and {hours(q['Q3']['sleep'][1])} in June to August. A coverage strip shows nights with a "
                    "sleep record per month.", "sleep")


def chart_hrv(A):
    rows = A["rows"]
    y, g = axes(10, 70, 10, "ms (SDNN)", "HRV (SDNN) before and after a new watch, synthetic",
                "Each dot: one day's mean · the sampling rate changes with the device")
    marker(DEVICE_CHANGE, "Series 9 → Series 12", y, g)
    for r in rows:
        v = r["hrv_sdnn_ms"]
        if v is None or excluded(r):
            continue
        new = r["device"].endswith("12")
        x, yy = xpos(r["d"]), y(max(10, min(70, v)))
        tip = f'<title>{r["d"]:%d %b %Y} · {r["device"]}: {v:g} ms from {r["hrv_samples"]} readings</title>'
        if new:
            g.append(f'<rect x="{x - 2.6:.1f}" y="{yy - 2.6:.1f}" width="5.2" height="5.2" fill="{S2}" '
                     f'stroke="#FAF8F4" stroke-width="1">{tip}</rect>')
        else:
            g.append(f'<circle cx="{x:.1f}" cy="{yy:.1f}" r="2.6" fill="{S1}" stroke="#FAF8F4" stroke-width="1">{tip}</circle>')
    n9, h9, s9 = A["hrv9"]
    n12, h12, s12 = A["hrv12"]
    ly = H - B + 40
    g.append(f'<circle cx="{L + 6}" cy="{ly + 6}" r="4" fill="{S1}"/>'
             f'<text x="{L + 16}" y="{ly + 10}" font-size="11.5" fill="{INK}">Series 9: median {h9[1]:g} ms · {n9} days · ~{s9:g} readings a day</text>')
    g.append(f'<rect x="{L + 2}" y="{ly + 20}" width="8" height="8" fill="{S2}"/>'
             f'<text x="{L + 16}" y="{ly + 28}" font-size="11.5" fill="{INK}">Series 12: median {h12[1]:g} ms · {n12} days · ~{s12:g} readings a day</text>')
    return svg_wrap(g, "HRV before and after changing watches, synthetic",
                    f"Synthetic data. Series 9 days have a median of {h9[1]:g} milliseconds from about {s9:g} "
                    f"readings a day; Series 12 days have {h12[1]:g} milliseconds from about {s12:g}. The two "
                    "series are not comparable.", "hrv")


def chart_table(A):
    body = ""
    for d, l, m, h, n in A["roll_rhr"][27::28]:
        body += (f"<tr><td>{d:%d %b %Y}</td><td>{fmt(m, 1)}</td><td>{fmt(l, 1)}–{fmt(h, 1)}</td><td>{n}</td></tr>"
                 if m is not None else f"<tr><td>{d:%d %b %Y}</td><td colspan=\"2\">too few usable days</td><td>{n}</td></tr>")
    return ('<details class="datatable"><summary>Chart data: the 28-day median every four weeks</summary>'
            '<div class="tablewrap" tabindex="0" role="region" aria-label="Scrollable table"><table><thead><tr><th scope="col">Window ending</th>'
            '<th scope="col">Median, bpm</th><th scope="col">IQR, bpm</th><th scope="col">Usable days in window</th>'
            f"</tr></thead><tbody>{body}</tbody></table></div></details>")


def figure(svg, cap, extra=""):
    return f'<figure class="chart">{svg}<figcaption>{cap}</figcaption>{extra}</figure>'


# ─────────────────────────── 4. 1,000 people ─────────────────────────────
SENS, SPEC, PREV = 0.412, 0.923, 0.30


def icon_array():
    n = 1000
    pos = round(n * PREV)
    tp = round(pos * SENS)
    fn = pos - tp
    neg = n - pos
    fp = round(neg * (1 - SPEC))
    tn = neg - fp
    ppv = tp / (tp + fp)
    npv = tn / (tn + fn)
    cols, size, gap = 40, 15, 3
    cats = [(tp, S1, "Notified, and has high blood pressure"),
            (fn, S2, "Not notified, but has high blood pressure"),
            (fp, S3, "Notified, but does not have it"),
            (tn, GREY, "Not notified, and does not have it")]
    g, k = [], 0
    for count, colour, label in cats:
        for _ in range(count):
            r, c = divmod(k, cols)
            g.append(f'<rect x="{c * (size + gap)}" y="{r * (size + gap)}" width="{size}" height="{size}" rx="2" fill="{colour}"/>')
            k += 1
    wgrid = cols * (size + gap) - gap
    hgrid = (n // cols) * (size + gap) - gap
    legend, ly = [], hgrid + 26
    for i, (count, colour, label) in enumerate(cats):
        yy = ly + i * 22
        legend.append(f'<rect x="0" y="{yy - 11}" width="14" height="14" rx="2" fill="{colour}" stroke="{INK3}" stroke-width="0.5"/>'
                      f'<text x="22" y="{yy}" font-size="13" fill="{INK}"><tspan font-weight="600">{count}</tspan> {E(label)}</text>')
    total_h = ly + 4 * 22
    svg = (f'<svg viewBox="0 0 {wgrid} {total_h}" role="img" aria-labelledby="ia-t ia-d" '
           f'xmlns="http://www.w3.org/2000/svg" font-family="{FONT}">'
           f'<title id="ia-t">1,000 adults and a notification that is {SENS:.1%} sensitive and {SPEC:.1%} specific</title>'
           f'<desc id="ia-d">Of 1,000 adults, {pos} have undiagnosed high blood pressure (an illustrative assumption). '
           f'{tp} of them are notified and {fn} are not. Of the {neg} without it, {fp} are notified anyway and {tn} are not.</desc>'
           + "".join(g) + "".join(legend) + "</svg>")
    text = (f'<p class="iafacts">Of the <strong>{tp + fp}</strong> people notified, {tp} have high blood pressure: '
            f'a notification is right about <strong>{ppv:.0%}</strong> of the time here. Of the <strong>{fn + tn}</strong> '
            f'who hear nothing, <strong>{fn}</strong> ({fn / (fn + tn):.0%}) have it anyway. Silence is not a clean bill of health.</p>')
    return figure(svg, f"Sensitivity {SENS:.1%} and specificity {SPEC:.1%} are Apple's published validation figures "
                  f"for hypertension notifications. The share of people with undiagnosed high blood pressure "
                  f"({PREV:.0%}) is an <em>illustrative assumption</em>; with a different share, every count changes. "
                  f"Computed by <code>scripts/apple_watch_health/build.py</code>.", text)


# ─────────────────────────────── prompt ──────────────────────────────────
def prompt_fragment():
    text = PROMPT.read_text(encoding="utf-8").rstrip()
    steps = re.findall(r"^STEP (\d+) ", text, flags=re.M)
    if steps != [str(i) for i in range(1, 16)]:
        raise SystemExit(f"health-analyst-prompt.txt must have STEP 1 … STEP 15 in order; found {steps}")
    return (f'<pre id="ai-prompt" class="prompttext" tabindex="0" aria-label="The AI health analyst prompt">'
            f"{E(text)}</pre>")


# ─────────────────────────────── stitching ───────────────────────────────
def version(name):
    return hashlib.sha1((BASE / name).read_bytes()).hexdigest()[:10]


def stitch(path, frags, check):
    text = path.read_text(encoding="utf-8")
    new = text
    for name in ("guide.css", "guide.js"):           # cache-busting, like build.py assets
        new = re.sub(rf'((?:href|src)="(?:apple-watch-health/)?{re.escape(name)})(\?v=\w+)?"',
                     lambda m: f'{m.group(1)}?v={version(name)}"', new)
    for name, body in frags.items():
        pat = re.compile(rf"(<!-- awh:{name} -->)(.*?)(<!-- /awh:{name} -->)", re.S)
        if not pat.search(new):
            continue
        new = pat.sub(lambda m: m.group(1) + "\n" + body + "\n" + m.group(3), new)
    missing = [n for n in re.findall(r"<!-- awh:([\w-]+) -->", new) if n not in frags]
    if missing:
        raise SystemExit(f"{path.name}: unknown marker(s) {missing}")
    if new != text:
        if check:
            return [str(path.relative_to(ROOT))]
        path.write_text(new, encoding="utf-8")
    return []


def write(path, content, check):
    old = path.read_text(encoding="utf-8") if path.exists() else None
    if old != content:
        if check:
            return [str(path.relative_to(ROOT))]
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    return []


def main():
    check = "--check" in sys.argv
    stale = []
    records, daily, log, errors = sample_run()
    stale += write(SAMPLE / "expected-records.csv", records, check)
    stale += write(SAMPLE / "expected-daily.csv", daily, check)
    data = synthesize()
    stale += write(DATA, data, check)
    A = audit(load(data))
    fs = findings(A)
    rhr = figure(chart_rhr(A), "Synthetic data, labeled as such. Every number is computed from "
                 "<a href=\"apple-watch-health/data/synthetic-year.csv\">the published CSV</a>.", chart_table(A))
    rhr_ref = rhr.replace('href="apple-watch-health/data/', 'href="data/')
    frags = {
        "chart-rhr": rhr,
        "main-findings": findings_html(fs, only={1}),
        "icon-array": icon_array(),
        "prompt": prompt_fragment(),
    }
    ref_frags = {
        "chart-rhr": rhr_ref,
        "chart-sleep": figure(chart_sleep(A), "Synthetic data. Nights, not calendar days: a night belongs to the evening it began."),
        "chart-hrv": figure(chart_hrv(A), "Synthetic data. The level drops at the watch change because the sampling changed, not the person."),
        "coverage": coverage_html(A),
        "quarters": quarters_html(A),
        "findings": findings_html(fs),
        "sample-run": sample_fragment(daily, log, errors),
        "icon-array": icon_array(),
    }
    stale += stitch(ART, frags, check)
    stale += stitch(REF, ref_frags, check)
    if check and stale:
        print("stale (run python3 scripts/apple_watch_health/build.py):\n  " + "\n  ".join(stale))
        sys.exit(1)
    print("apple-watch-health: " + ("up to date" if check else "built"))


if __name__ == "__main__":
    main()
