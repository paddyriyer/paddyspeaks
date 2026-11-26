"""Deterministic analytics over canonical observations.

Four kinds of output, never confused with one another:

  descriptive   medians, ranges, counts, coverage — what the data say
  inference     a comparison with stated uncertainty (e.g. heart rate at the
                same walking speed, with a 95% interval)
  rules         product rules that sort a change into Improving / Stable /
                Declining / Insufficient evidence, or a signal into a tier.
                Every threshold is written down with its basis; most are
                PRODUCT CHOICES, labelled as such, not clinical cut-offs
  not here      diagnosis, prediction of an individual's health events,
                medication advice, or certification that exercise is safe

All of this runs on synthetic data. See docs/HEALTH-INTELLIGENCE-LAB.md.
"""
from __future__ import annotations

import datetime as dt
import math
import random
import statistics as st
from collections import defaultdict

from .ingest import METRICS
from .synth import AS_OF, DAYS, START

WINDOWS = (30, 90, 180, 365)

# better: higher | lower | range | goal-lower | none
# threshold: the smallest change the product calls a change. basis: why.
CFG = {
    "steps":         dict(agg="sum", cadence="daily", better="higher", thr=1000, basis="product threshold: 1,000 steps a day"),
    "exercise_min":  dict(agg="sum", cadence="daily", better="higher", thr=5, basis="product threshold: 5 minutes a day"),
    "resting_hr":    dict(agg="mean", cadence="daily", better="lower", thr=3, basis="product threshold: 3 beats a minute", prefer="apple_health_export"),
    "hrv_sdnn":      dict(agg="mean", cadence="daily", better="higher", thr=0.10, rel=True, basis="product threshold: 10% of the earlier median; HRV varies widely between people, so only your own trend is used"),
    "vo2max":        dict(agg="mean", cadence="sparse", min_n=3, better="higher", thr=1.0, basis="product threshold: 1 mL/kg/min. Watch estimates can be off by more than this for an individual; the direction over months matters more than any one change"),
    "sleep_hours":   dict(agg="sum", cadence="daily", better="range", rng=(7, 9), thr=0.33, basis="20 minutes, measured as distance from 7–9 hours (adult consensus: 7 hours or more)"),
    "walking_speed": dict(agg="mean", cadence="daily", better="higher", thr=0.05, basis="0.05 m/s, a small meaningful change in older adults (Perera et al., 2006)"),
    "steadiness":    dict(agg="mean", cadence="sparse", min_n=3, better="higher", thr=10, basis="product threshold: 10 points"),
    "weight":        dict(agg="mean", cadence="sparse", min_n=4, better="goal-lower", thr=0.015, rel=True, basis="product threshold: 1.5% of body weight; direction only counts when weight is one of your goals"),
    "systolic":      dict(agg="mean", cadence="sparse", min_n=8, better="lower", thr=5, basis="product threshold: 5 mmHg in averaged home readings; targets come from your clinician"),
    "diastolic":     dict(agg="mean", cadence="sparse", min_n=8, better="lower", thr=3, basis="product threshold: 3 mmHg in averaged home readings; targets come from your clinician"),
    "hrv_rmssd":     dict(agg="mean", cadence="daily", better="higher", thr=0.10, rel=True, basis="product threshold: 10%. RMSSD is a different method from SDNN and is never combined with it"),
    "glucose_cgm":   dict(agg="mean", cadence="episode", better="none", thr=None, basis="one 14-day sensor wear: descriptive only"),
    "hba1c":         dict(agg="lab", cadence="lab", better="lower", thr=0.3, basis="product threshold: 0.3 percentage points between lab results; lab-to-lab variation exists, so discuss with your clinician"),
    "ldl":           dict(agg="lab", cadence="lab", better="lower", thr=10, basis="product threshold: 10 mg/dL"),
}
ORDER = ["steps", "exercise_min", "resting_hr", "hrv_sdnn", "vo2max", "sleep_hours", "walking_speed",
         "steadiness", "weight", "systolic", "diastolic", "hrv_rmssd", "glucose_cgm", "hba1c", "ldl"]
DEC = {"steps": 0, "exercise_min": 0, "resting_hr": 1, "hrv_sdnn": 1, "vo2max": 1, "sleep_hours": 2,
       "walking_speed": 2, "steadiness": 0, "weight": 1, "systolic": 0, "diastolic": 0, "hrv_rmssd": 0,
       "glucose_cgm": 0, "hba1c": 1, "ldl": 0}


def d2i(d: dt.date) -> int:
    return (d - START).days


def i2d(i: int) -> dt.date:
    return START + dt.timedelta(days=i)


def r(x, n):
    return None if x is None else round(x, n) if n else int(round(x))


def pct(vals, q):
    """Linear-interpolated percentile (q in 0..100)."""
    v = sorted(vals)
    if not v:
        return None
    k = (len(v) - 1) * q / 100
    f, c = math.floor(k), math.ceil(k)
    return v[f] if f == c else v[f] + (v[c] - v[f]) * (k - f)


def theil_sen(points):
    """Median of pairwise slopes. points: [(x, y)]. Robust to outliers."""
    s = [(y2 - y1) / (x2 - x1) for i, (x1, y1) in enumerate(points) for (x2, y2) in points[i + 1:] if x2 != x1]
    return st.median(s) if s else None


class Profile:
    def __init__(self, persona, ing, recon):
        self.p = persona
        self.ing = ing
        self.recon = recon
        self.obs = list(ing.obs.values())
        self.daily = self._daily()

    # ------------------------------------------------------------ series
    def _daily(self):
        """{code: {day_index: value}} using the preferred source where two exist."""
        by = defaultdict(lambda: defaultdict(list))
        for o in self.obs:
            c = CFG[o["code"]] if o["code"] in CFG else None
            if c is None:
                continue
            if c.get("prefer") and o["source"]["system"] != c["prefer"]:
                continue
            i = d2i(dt.date.fromisoformat(o["local_date"]))
            if 0 <= i < DAYS or c["cadence"] == "lab":
                by[o["code"]][i].append(o["value"])
        out = {}
        for code, days in by.items():
            agg = CFG[code]["agg"]
            out[code] = {i: (sum(v) if agg == "sum" else st.fmean(v)) for i, v in days.items()}
        return out

    def values(self, code, a: dt.date, b: dt.date):
        """Daily values with a <= day <= b."""
        s = self.daily.get(code, {})
        return [v for i, v in s.items() if a <= i2d(i) <= b]

    # ------------------------------------------------------------ comparisons
    def has_goal(self, g):
        return g in self.p.goals

    def classify(self, code, prev, cur, span):
        c = CFG[code]
        if c["cadence"] in ("lab", "episode"):
            return None
        need = (lambda v: len(v) >= max(5, 0.5 * span)) if c["cadence"] == "daily" else (lambda v: len(v) >= c["min_n"])
        res = {"n_prev": len(prev), "n_cur": len(cur),
               "cov_prev": r(len(prev) / span, 2) if c["cadence"] == "daily" else None,
               "cov_cur": r(len(cur) / span, 2) if c["cadence"] == "daily" else None,
               "prev": r(st.median(prev), DEC[code]) if prev else None,
               "cur": r(st.median(cur), DEC[code]) if cur else None}
        if not need(prev) or not need(cur):
            short = []
            if not need(prev):
                short.append("the earlier period")
            if not need(cur):
                short.append("the recent period")
            want = "at least half the days" if c["cadence"] == "daily" else f"at least {c['min_n']} readings"
            res.update(status="insufficient", reason=f"Not enough data in {' and '.join(short)} (needs {want}).")
            return res
        mp, mc = st.median(prev), st.median(cur)
        delta = mc - mp
        res["delta"] = r(delta, DEC[code])
        thr = c["thr"] * (abs(mp) if c.get("rel") else 1)
        better = c["better"]
        if better == "goal-lower" and not self.has_goal("weight_management"):
            res.update(status="stable" if abs(delta) < thr else "changed",
                       reason="Weight is not one of your goals, so the product does not call a change better or worse.")
            return res
        if better == "range":
            lo, hi = c["rng"]
            dist = lambda x: max(lo - x, 0, x - hi)
            imp = dist(mp) - dist(mc)
            status = "improving" if imp >= thr else "declining" if imp <= -thr else "stable"
        else:
            sign = 1 if better == "higher" else -1
            if abs(delta) < thr:
                status = "stable"
            else:
                status = "improving" if sign * delta > 0 else "declining"
        res.update(status=status, reason=f"Median moved {fmt_delta(code, delta)} ({c['basis']}).")
        return res

    def window(self, code, w, as_of=AS_OF):
        cur = self.values(code, as_of - dt.timedelta(days=w - 1), as_of)
        prev = self.values(code, as_of - dt.timedelta(days=2 * w - 1), as_of - dt.timedelta(days=w))
        return self.classify(code, prev, cur, w)

    def labs(self, code):
        pts = sorted((o["local_date"], o["value"], o["orig_value"], o["orig_unit"], o["flags"], o["source"]["name"])
                     for o in self.obs if o["code"] == code)
        out = [{"date": d, "value": r(v, DEC[code]), "orig": f"{ov} {ou}", "flags": f, "source": s} for d, v, ov, ou, f, s in pts]
        res = {"results": out}
        if len(out) >= 2:
            a, b = out[-2], out[-1]
            delta = b["value"] - a["value"]
            thr = CFG[code]["thr"]
            res.update(prev=a["value"], cur=b["value"], delta=r(delta, DEC[code]),
                       status="stable" if abs(delta) < thr else ("improving" if delta < 0 else "declining"),
                       reason=f"Latest result ({b['date']}) against the previous one ({a['date']}). {CFG[code]['basis']}.")
        elif out:
            res.update(status="insufficient", reason="Only one result: a trend needs at least two.")
        return res

    # ------------------------------------------------------------ chart series
    def chart(self, code):
        s = self.daily.get(code, {})
        dec = DEC[code]
        vals = [r(s.get(i), dec) if i in s else None for i in range(DAYS)]
        med, lo, hi = [], [], []
        for i in range(DAYS):
            win = [s[j] for j in range(max(0, i - 27), i + 1) if j in s]
            if len(win) >= (7 if CFG[code]["cadence"] == "daily" else 3):
                med.append(r(st.median(win), dec)); lo.append(r(pct(win, 25), dec)); hi.append(r(pct(win, 75), dec))
            else:
                med.append(None); lo.append(None); hi.append(None)
        return {"v": vals, "med": med, "p25": lo, "p75": hi}

    def monthly(self, code):
        s = self.daily.get(code, {})
        m = defaultdict(list)
        for i, v in s.items():
            if 0 <= i < DAYS:
                d = i2d(i)
                m[f"{d.year}-{d.month:02d}"].append(v)
        return {k: {"med": r(st.median(v), DEC[code]), "n": len(v)} for k, v in sorted(m.items())}


def fmt_delta(code, d):
    unit = METRICS[code][1].replace("mm[Hg]", "mmHg").replace("/min", " /min").replace("count/d", "steps/day").replace("min/d", "min/day")
    sign = "+" if d > 0 else "−" if d < 0 else "±"
    return f"{sign}{abs(r(d, DEC[code]))} {unit}".replace(" %", "%")


# ======================================================================= signals

BAD = {"resting_hr": "up", "hrv_sdnn": "down", "sleep_hours": "down", "walking_speed": "down",
       "systolic": "up", "steps": "down"}
LIMITS = {
    "resting_hr": "Resting heart rate rises with illness, poor sleep, alcohol, heat, stress and some medicines. The watch cannot tell these apart.",
    "hrv_sdnn": "HRV is noisy and varies widely between people; only your own trend is meaningful, and a single low night means little.",
    "sleep_hours": "Sleep duration is estimated from movement and heart rate; it cannot diagnose a sleep disorder.",
    "walking_speed": "Walking speed is estimated by the phone during everyday walking, not measured on a test course.",
    "systolic": "Home readings depend on technique (seated, rested, arm supported, same time of day). Targets come from your clinician.",
    "steps": "Steps depend on wearing the watch and carrying the phone; days without them are gaps, not zeros.",
}
CONTEXT_TERMS = ["cold", "flu", "fever", "sore throat", "virus", "covid", "infection", "jet lag"]
URGENT_TERMS = ["chest pain", "chest pressure", "fainted", "fainting", "passed out", "severe shortness of breath",
                "can't breathe", "face drooping", "slurred speech", "arm weakness", "stroke"]
URGENT_GUIDANCE = ("Call emergency services (911 in the US) now. Symptoms like these need immediate care "
                   "whatever the watch shows; a normal-looking chart is not reassurance.")


def signals(P: Profile):
    out = []
    # only things that plausibly explain a change count as context: travel and short illnesses.
    # Any other symptom is shown alongside, but never used to explain a change away.
    ctx_entries = [e for e in P.ing.entries if e["type"] == "travel"
                   or (e["type"] == "symptom" and any(t in e["text"].lower() for t in CONTEXT_TERMS))]
    away = set(P.recon["away_days"])
    for code, bad in BAD.items():
        s = P.daily.get(code)
        if not s:
            continue
        c = CFG[code]
        sparse = c["cadence"] == "sparse"
        rw, rmin, bmin = (14, 5, 20) if sparse else (7, 4, 45)
        unit = METRICS[code][1].replace("mm[Hg]", "mmHg").replace("count/d", "steps/day").replace("min/d", "min/day")
        flagged, cache = [], {}
        for i in range(120, DAYS):
            base = [s[j] for j in range(i - 90 - rw - 7, i - rw - 7) if j in s]
            recent = [s[j] for j in range(i - rw + 1, i + 1) if j in s]
            if len(base) < bmin or len(recent) < rmin:
                continue
            p10, p50, p90 = pct(base, 10), pct(base, 50), pct(base, 90)
            m = st.median(recent)
            thr = c["thr"] * (abs(p50) if c.get("rel") else 1)
            if (bad == "up" and m > p90 and m - p50 >= thr) or (bad == "down" and m < p10 and p50 - m >= thr):
                flagged.append(i)
                cache[i] = (p10, p50, p90, m)
        eps, cur = [], []
        for i in flagged:
            if cur and i != cur[-1] + 1:
                eps.append(cur); cur = []
            cur.append(i)
        if cur:
            eps.append(cur)
        for e in eps:
            if len(e) < 7:
                continue
            a, b = i2d(e[0] - rw + 1), i2d(e[-1])
            ongoing = e[-1] == DAYS - 1
            p10, p50, p90, _ = cache[e[0]]
            peak = max(e, key=lambda i: abs(cache[i][3] - cache[i][1]))
            during = [s[j] for j in range(e[0] - rw + 1, e[-1] + 1) if j in s]
            span = (b - a).days + 1
            ctx = [x for x in ctx_entries if a - dt.timedelta(days=3) <= dt.date.fromisoformat(x["date"]) <= b]
            if any(i2d(i).isoformat() in away for i in range(e[0] - rw + 1, e[-1] + 1)):
                ctx.append({"type": "travel", "date": a.isoformat(), "text": "Recorded in another time zone"})
            dec = DEC[code]
            what = (f"{METRICS[code][0]}: {rw}-day median {r(cache[peak][3], dec)} {unit} against your usual {r(p50, dec)} "
                    f"(your 10th–90th percentile: {r(p10, dec)}–{r(p90, dec)}), {span} days")
            if ctx:
                tier = "context"
                why = what + ". It overlaps something you recorded: " + "; ".join(f"{x['text']} ({x['date']})" for x in ctx) + "."
            elif (ongoing and span >= 14) or (span >= 21 and code in ("systolic", "walking_speed", "resting_hr")):
                tier = "discuss"
                why = what + (", still going" if ongoing else "") + ", with nothing recorded that explains it."
            else:
                tier = "observed"
                why = what + "."
            out.append({
                "metric": code, "label": METRICS[code][0], "tier": tier, "start": a.isoformat(), "end": b.isoformat(),
                "ongoing": ongoing, "days": span,
                "baseline": {"p10": r(p10, dec), "median": r(p50, dec), "p90": r(p90, dec),
                             "window": f"the 90 days ending a week before the change"},
                "recent_median": r(cache[peak][3], dec),
                "completeness": r(len(during) / span, 2), "n": len(during),
                "why": why, "context": ctx, "related": related(P, a, b),
                "rule": f"{rw}-day median outside your own 10th–90th percentile of the previous 90 days AND at least the product threshold "
                        f"({c['basis']}) away from your usual, for 7 days in a row or more.",
                "limits": LIMITS[code],
                "next": next_step(code, tier),
            })
    # gradual change: the year-over-year comparison declines for a clinically relevant measure
    for code in ("walking_speed", "resting_hr", "systolic"):
        w = P.window(code, 365)
        if w and w.get("status") == "declining":
            out.append({
                "metric": code, "label": METRICS[code][0], "tier": "discuss", "gradual": True,
                "start": (AS_OF - dt.timedelta(days=729)).isoformat(), "end": AS_OF.isoformat(), "ongoing": True,
                "days": 730, "baseline": {"median": w["prev"], "window": "the previous 365 days"},
                "recent_median": w["cur"], "completeness": w.get("cov_cur"), "n": w["n_cur"],
                "why": f"{METRICS[code][0]}: a gradual change over a year, median {w['prev']} → {w['cur']} {METRICS[code][1].replace('mm[Hg]','mmHg')}. "
                       "Slow drifts never look unusual week to week, so the year-over-year view catches them.",
                "context": [], "rule": f"Last 365 days against the previous 365: {CFG[code]['basis']}.",
                "limits": LIMITS[code], "next": next_step(code, "discuss"),
            })
    # record conflicts are signals about the data, not the body
    for m in P.ing.clinical:
        if m.get("conflict"):
            out.append({"metric": "record", "label": "Medication record", "tier": "context", "start": m["conflict"]["reported_on"],
                        "end": AS_OF.isoformat(), "ongoing": True, "days": None,
                        "why": f"Your record lists {m['text']} as {m['record_status']}; you reported it {m['conflict']['reported_status']} on {m['conflict']['reported_on']}.",
                        "context": [], "rule": "Clinical record and your own report disagree.",
                        "limits": "The app cannot know which is current. It changes neither record.",
                        "next": "Tell your clinician you stopped, and why. Do not restart or stop a medicine because of an app."})
    for e in P.ing.entries:
        if e["type"] == "symptom" and any(t in e["text"].lower() for t in URGENT_TERMS):
            out.append({"metric": "symptom", "label": "Reported symptom", "tier": "urgent", "start": e["date"], "end": e["date"],
                        "why": f"You reported: {e['text']}", "next": URGENT_GUIDANCE, "rule": "Urgent-symptom terms", "limits": ""})
    order = {"urgent": 0, "discuss": 1, "context": 2, "observed": 3}
    out.sort(key=lambda x: (order[x["tier"]], x.get("end", "")), reverse=False)
    return out


def related(P, a, b):
    """Records near a signal that do NOT explain it but a clinician would want beside it."""
    out = []
    for e in P.ing.entries:
        d = dt.date.fromisoformat(e["date"])
        if e["type"] in ("symptom", "medication_report") and a - dt.timedelta(days=90) <= d <= b \
                and not any(t in e["text"].lower() for t in CONTEXT_TERMS):
            out.append({"date": e["date"], "text": e["text"], "kind": "patient_reported"})
    return out


def next_step(code, tier):
    if tier == "context":
        return "Keep watching. If it does not settle once the explanation has passed, treat it as worth discussing."
    if tier == "observed":
        return "Nothing to do yet. Note how you feel; the trend matters more than a single stretch."
    return {
        "systolic": "Measure with good technique for a week (two readings, morning and evening) and bring the averages to your clinician.",
        "walking_speed": "Mention it at your next visit; ask whether a balance or strength assessment would help.",
        "resting_hr": "If it persists, bring the chart to your next appointment and mention any symptoms, sleep or medicine changes.",
    }.get(code, "Bring the chart to your next appointment.")


# ======================================================================= workouts

def workouts(P: Profile):
    ws = sorted(P.ing.workouts.values(), key=lambda w: w["start"])
    compact = [{"d": w["local_date"], "t": w["type"], "min": round(w["duration_min"], 1),
                "km": w["distance_km"], "hr": w["avg_hr"], "elev": w["elevation_m"], "eff": w["effort"],
                "kmh": w.get("speed_kmh")} for w in ws]
    # weekly exercise minutes (watch "exercise minutes", which count brisk-or-harder movement)
    weeks = defaultdict(lambda: {"min": 0, "days": 0, "n": 0})
    for i, v in P.daily.get("exercise_min", {}).items():
        d = i2d(i)
        wk = (d - dt.timedelta(days=d.weekday())).isoformat()
        weeks[wk]["min"] += v; weeks[wk]["days"] += 1
    for w in ws:
        d = dt.date.fromisoformat(w["local_date"])
        weeks[(d - dt.timedelta(days=d.weekday())).isoformat()]["n"] += 1
    weekly = [{"wk": k, "min": int(v["min"]), "days": v["days"], "n": v["n"]} for k, v in sorted(weeks.items())]
    return compact, weekly


def same_speed_hr(ws):
    """Regress average HR on speed and time over comparable walks: HR change per 180 days at equal speed."""
    walks = [w for w in ws if w["type"] == "Walking" and w["distance_km"] and w["avg_hr"]]
    if len(walks) < 20:
        return None
    dists = [round(w["distance_km"], 0) for w in walks]
    mode = max(set(dists), key=dists.count)
    sim = [w for w in walks if abs(w["distance_km"] - mode) <= 0.15 * mode and w["elevation_m"] is not None]
    if len(sim) < 20:
        return None
    elev_mode = max({w["elevation_m"] for w in sim}, key=lambda e: sum(1 for w in sim if w["elevation_m"] == e))
    sim = [w for w in sim if w["elevation_m"] == elev_mode]
    t0 = dt.date.fromisoformat(sim[0]["local_date"])
    X = [(1.0, w["speed_kmh"], (dt.date.fromisoformat(w["local_date"]) - t0).days / 180) for w in sim]
    y = [w["avg_hr"] for w in sim]
    beta, se = ols(X, y)
    if beta is None:
        return None
    return {"n": len(sim), "route": f"{mode:.0f} km walks with {elev_mode:.0f} m of climb",
            "per_180d": round(beta[2], 1), "ci95": [round(beta[2] - 1.96 * se[2], 1), round(beta[2] + 1.96 * se[2], 1)],
            "per_kmh": round(beta[1], 1), "first": sim[0]["local_date"], "last": sim[-1]["local_date"],
            "points": [[w["local_date"], w["speed_kmh"] and round(w["speed_kmh"], 2), w["avg_hr"]] for w in sim],
            "method": "Ordinary least squares: average heart rate ~ walking speed + time, on walks of the same distance and climb. "
                      "The time coefficient is the change in heart rate at the same speed. It is an association in your own data, "
                      "not proof that the walks caused it."}


def ols(X, y):
    k = len(X[0])
    XtX = [[sum(x[i] * x[j] for x in X) for j in range(k)] for i in range(k)]
    Xty = [sum(x[i] * yy for x, yy in zip(X, y)) for i in range(k)]
    inv = invert(XtX)
    if inv is None:
        return None, None
    b = [sum(inv[i][j] * Xty[j] for j in range(k)) for i in range(k)]
    res = [yy - sum(bi * xi for bi, xi in zip(b, x)) for x, yy in zip(X, y)]
    s2 = sum(e * e for e in res) / (len(y) - k)
    se = [math.sqrt(max(inv[i][i] * s2, 0)) for i in range(k)]
    return b, se


def invert(m):
    n = len(m)
    a = [row[:] + [1.0 if i == j else 0.0 for j in range(n)] for i, row in enumerate(m)]
    for c in range(n):
        p = max(range(c, n), key=lambda r_: abs(a[r_][c]))
        if abs(a[p][c]) < 1e-12:
            return None
        a[c], a[p] = a[p], a[c]
        pv = a[c][c]
        a[c] = [v / pv for v in a[c]]
        for r_ in range(n):
            if r_ != c:
                f = a[r_][c]
                a[r_] = [v - f * w for v, w in zip(a[r_], a[c])]
    return [row[n:] for row in a]


def slope_per_year(P, code, days=365):
    s = P.daily.get(code, {})
    pts = [(i / 365, v) for i, v in s.items() if i >= DAYS - days]
    if len(pts) < 6:
        return None
    return round(theil_sen(pts), 2), len(pts)


def effectiveness(P: Profile, weekly):
    """Per goal: the evidence chain Activity → short-term → long-term → outcome."""
    last12 = weekly[-12:]
    prev12 = weekly[-24:-12]
    met = lambda ws: sum(1 for w in ws if w["min"] >= 150)
    act = {"stage": "Activity performed", "status": "observed",
           "text": f"{met(last12)} of the last 12 weeks reached 150 exercise minutes ({met(prev12)} of the 12 before).",
           "basis": "US Physical Activity Guidelines: 150–300 minutes of moderate activity a week. Watch exercise minutes count brisk-or-harder movement."}
    ws = list(P.ing.workouts.values())
    ssh = same_speed_hr(ws)
    vo2 = slope_per_year(P, "vo2max")
    rhr = P.window("resting_hr", 365)
    goals = {}

    def stage(name, status, text, basis=""):
        return {"stage": name, "status": status, "text": text, "basis": basis}

    # aerobic fitness
    chain = [act]
    chain.append(stage("Short-term physiology", "inferred" if ssh else "not available",
                       (f"At the same walking speed, average heart rate changed {ssh['per_180d']:+} /min every 6 months "
                        f"(95% interval {ssh['ci95'][0]} to {ssh['ci95'][1]}), from {ssh['n']} {ssh['route']}.") if ssh
                       else "Not enough comparable walks (same distance and climb) to compare like with like.",
                       ssh["method"] if ssh else ""))
    chain.append(stage("Long-term trend", "estimated" if vo2 else "not available",
                       (f"Estimated VO₂ max trend: {vo2[0]:+} mL/kg/min a year over {vo2[1]} estimates. "
                        f"Resting heart rate, last year against the year before: {rhr['status'] if rhr else 'n/a'}"
                        + (f" ({rhr['prev']} → {rhr['cur']} /min)." if rhr and rhr.get('cur') is not None else ".")) if vo2
                       else "No cardio fitness estimates (they need outdoor walks or runs with the watch).",
                       "Theil–Sen slope (robust to outliers) over the last 365 days."))
    chain.append(stage("Outcome evidence", "not available",
                       "A laboratory exercise test is the outcome measure for fitness. None is on record, so the chain stops at an estimate."))
    goals["cardio_fitness"] = {"label": "Improve aerobic fitness", "chain": chain}

    # consistency
    streak = 0
    for w in reversed(weekly[:-1] if weekly and weekly[-1]["days"] < 7 else weekly):
        if w["min"] >= 150:
            streak += 1
        else:
            break
    goals["activity_adherence"] = {"label": "Build consistent activity", "chain": [
        act,
        stage("Short-term physiology", "not needed", "Consistency is about the habit itself; no physiological measure is required."),
        stage("Long-term trend", "observed", f"Current run of weeks at 150 minutes or more: {streak}. Active days in the last 12 weeks: "
              f"{sum(w['days'] for w in last12)} with data."),
        stage("Outcome evidence", "observed", "For this goal the behavior is the outcome."),
    ]}
    # weight
    wt = P.window("weight", 180)
    goals["weight_management"] = {"label": "Support weight management", "chain": [
        act,
        stage("Short-term physiology", "not applicable", "Calories burned are estimates and do not translate one-to-one into weight change."),
        stage("Long-term trend", "observed" if wt and wt.get("status") not in (None, "insufficient") else "not available",
              (f"Weight, last 180 days against the 180 before: {wt['prev']} → {wt['cur']} kg ({wt['status']}).")
              if wt and wt.get("cur") is not None and wt.get("prev") is not None else "No weight measurements from a scale or your own entries."),
        stage("Outcome evidence", "association only",
              "Activity and weight moved together or they did not; diet, sleep, medicines and illness also change weight. This is not proof either way."),
    ]}
    # glucose
    a1c = P.labs("hba1c")
    cg = P.values("glucose_cgm", dt.date(2026, 6, 1), dt.date(2026, 6, 14))
    goals["glucose"] = {"label": "Discuss an activity plan for glucose management", "chain": [
        act,
        stage("Short-term physiology", "observed" if cg else "not available",
              f"One 14-day glucose sensor wear (June 2026): daily averages from {min(cg):.0f} to {max(cg):.0f} mg/dL. "
              "One wear describes those two weeks only." if cg else "No glucose sensor data."),
        stage("Long-term trend", "clinician-verified" if a1c.get("results") else "not available",
              ("HbA1c results: " + ", ".join(f"{x['value']}% ({x['date']})" for x in a1c["results"]) + ".") if a1c.get("results")
              else "No HbA1c results. The watch cannot measure HbA1c or glucose; only a lab test can."),
        stage("Outcome evidence", "association only" if a1c.get("results") else "not available",
              "HbA1c moved while activity rose. Diet, weight, sleep, medicines and lab variation also move it. Only your clinician can interpret it."
              if a1c.get("results") else "Needs periodic lab results, ordered by your clinician."),
    ]}
    sy = P.window("systolic", 180)
    goals["blood_pressure"] = {"label": "Support a clinician's blood-pressure plan", "chain": [
        act,
        stage("Short-term physiology", "not available", "Single readings after a walk say little; morning home averages are more useful."),
        stage("Long-term trend", "observed" if sy and sy.get("cur") is not None else "not available",
              (f"Home systolic median, last 180 days against the 180 before: {sy['prev']} → {sy['cur']} mmHg ({sy['status']}).")
              if sy and sy.get("cur") is not None and sy.get("prev") is not None else "No home readings from a validated cuff."),
        stage("Outcome evidence", "association only" if sy and sy.get("cur") is not None else "not available",
              "Blood pressure changed alongside activity, weight and medicines. Your clinician judges what drove it."),
    ]}
    wsp = P.window("walking_speed", 365)
    goals["mobility"] = {"label": "Keep walking independently", "chain": [
        act,
        stage("Short-term physiology", "estimated" if P.daily.get("steadiness") else "not available",
              "Walking steadiness is estimated by the phone from everyday walking." if P.daily.get("steadiness") else "No steadiness estimates."),
        stage("Long-term trend", "estimated" if wsp and wsp.get("cur") is not None else "not available",
              (f"Walking speed, last year against the year before: {wsp['prev']} → {wsp['cur']} m/s ({wsp['status']}).")
              if wsp and wsp.get("cur") is not None and wsp.get("prev") is not None else "Not enough walking speed estimates."),
        stage("Outcome evidence", "not available", "A clinician's gait or balance assessment would be the outcome measure."),
    ]}
    return goals, ssh


# ======================================================================= cohorts (illustrative)

COHORT_METRICS = {
    # metric: (mean at 30–39 by sex, change per decade, sd, more by activity level)
    "vo2max":        ({"female": 35.0, "male": 41.0}, -3.2, 5.5, 2.5),
    "resting_hr":    ({"female": 64.0, "male": 61.0}, 0.4, 8.0, -2.0),
    "steps":         ({"female": 7200, "male": 7600}, -450, 2400, None),
    "walking_speed": ({"female": 1.33, "male": 1.37}, -0.04, 0.14, 0.03),
    "sleep_hours":   ({"female": 7.0, "male": 6.8}, 0.03, 0.8, 0.05),
    "systolic":      ({"female": 114.0, "male": 120.0}, 5.0, 13.0, -1.5),
}
AGE_BANDS = ["30–39", "40–49", "50–59", "60–69", "70–79"]
ACTIVITY = [("Under 5,000 steps", 0, 5000), ("5,000–7,499", 5000, 7500), ("7,500–9,999", 7500, 10000), ("10,000 or more", 10000, 10 ** 9)]
CONDITIONS = ["None recorded", "Hypertension (confirmed)", "Prediabetes (confirmed)"]
PCTS = (5, 10, 25, 50, 75, 90, 95)


def cohort_tables(seed=9090):
    rng = random.Random(seed)
    strata = {}
    for m, (base, decade, sd, act_shift) in COHORT_METRICS.items():
        for ai, band in enumerate(AGE_BANDS):
            for sex in ("female", "male"):
                for ki, (alabel, lo, hi) in enumerate(ACTIVITY):
                    for ci, cond in enumerate(CONDITIONS):
                        n = rng.randint(140, 1400) // (3 if ci else 1)
                        mu = base[sex] + decade * ai + (act_shift or 0) * (ki - 1.5)
                        if m == "steps":
                            vals = [rng.uniform(lo, min(hi, 16000)) for _ in range(n)]
                        else:
                            if ci == 1 and m == "systolic":
                                mu += 9
                            if ci and m == "vo2max":
                                mu -= 1.5
                            vals = [rng.gauss(mu, sd) for _ in range(n)]
                        key = f"{m}|{ai}|{sex}|{ki}|{ci}"
                        strata[key] = {"n": n, "p": [round(pct(vals, q), 2 if m in ("walking_speed", "sleep_hours") else 1) for q in PCTS]}
    return strata


REFERENCES = [
    {"metric": "vo2max", "name": "FRIEND registry (Fitness Registry and the Importance of Exercise National Database)",
     "what": "Laboratory cardiopulmonary exercise tests, by age and sex, treadmill and cycle reported separately.",
     "match": "Method mismatch: the watch estimates VO₂ max from heart rate and movement; FRIEND measures it with a gas analyzer. Comparing the two needs a stated correction or a caveat.",
     "cite": "Kaminsky et al., Mayo Clinic Proceedings, 2022", "loaded": False},
    {"metric": "walking_speed", "name": "Normal walking speed: a descriptive meta-analysis",
     "what": "Comfortable gait speed measured over short courses, by age decade and sex.",
     "match": "Method mismatch: course-measured speed versus the phone's passive estimate during everyday walking.",
     "cite": "Bohannon & Andrews, Physiotherapy, 2011", "loaded": False},
    {"metric": "steps", "name": "Step-count activity categories",
     "what": "Graduated categories from under 5,000 to 10,000 or more steps a day.",
     "match": "Used here only to name activity levels, not as a health benchmark.",
     "cite": "Tudor-Locke & Bassett, Sports Medicine, 2004", "loaded": True},
    {"metric": "systolic", "name": "National Health and Nutrition Examination Survey (NHANES)",
     "what": "Standardized, examiner-measured blood pressure in a nationally representative US sample.",
     "match": "Method mismatch: examiner-measured office readings versus home cuff readings.",
     "cite": "CDC National Center for Health Statistics", "loaded": False},
]


def cohort_for(P: Profile, strata):
    age_i = max(0, min(len(AGE_BANDS) - 1, (P.p.age - 30) // 10))
    cur = {}
    for m in COHORT_METRICS:
        v = P.values(m, AS_OF - dt.timedelta(days=89), AS_OF)
        need = 3 if CFG[m]["cadence"] == "sparse" else 30
        if m == "systolic":
            need = 8
        cur[m] = {"value": r(st.median(v), DEC[m]) if len(v) >= need else None, "n": len(v),
                  "reason": None if len(v) >= need else f"Fewer than {need} readings in the last 90 days."}
    steps = cur["steps"]["value"]
    act_i = next((i for i, (_, lo, hi) in enumerate(ACTIVITY) if steps is not None and lo <= steps < hi), None)
    confirmed = [c["text"] for c in P.ing.clinical if c["type"] == "condition" and c["verification"] == "confirmed"]
    cond_ok = [0] + [1 if "hypertension" in t.lower() else 2 for t in confirmed if "hypertension" in t.lower() or "prediabetes" in t.lower()]
    ranks = {}
    for key, s in strata.items():
        m = key.split("|")[0]
        v = cur[m]["value"]
        if v is None:
            continue
        p = s["p"]
        if v <= p[0]:
            rank = "below 5th"
        elif v >= p[-1]:
            rank = "above 95th"
        else:
            for (q1, v1), (q2, v2) in zip(zip(PCTS, p), zip(PCTS[1:], p[1:])):
                if v1 <= v <= v2:
                    rank = round(q1 + (q2 - q1) * ((v - v1) / (v2 - v1) if v2 > v1 else 0))
                    break
        ranks[key] = rank
    return {"age_band": age_i, "sex": P.p.sex_category, "activity": act_i, "conditions_allowed": sorted(set(cond_ok)),
            "confirmed_conditions": confirmed, "current": cur, "ranks": ranks}


# ======================================================================= goals

GOALS = {
    "cardio_fitness": {
        "label": "Cardio fitness", "definition": "Improve aerobic fitness, judged by the direction of estimated VO₂ max and heart rate at the same effort over months.",
        "measures": [("vo2max", "Watch estimate"), ("resting_hr", "Watch"), ("exercise_min", "Watch")],
        "needs_external": "Optional: a laboratory exercise test, if your clinician thinks it is useful.",
        "period": "Quarterly; single estimates are noisy.",
        "options": ["Build toward 150–300 minutes of moderate activity a week, adding vigorous sessions gradually (US Physical Activity Guidelines).",
                    "Repeat a familiar route so comparisons are like for like."],
        "questions": ["Is there any reason I should not increase my exercise intensity?", "Would an exercise test add anything for me?"],
        "guardrail": "The watch estimate is not a laboratory measurement and cannot clear you for vigorous exercise."},
    "weight_management": {
        "label": "Weight management", "definition": "Move body weight in the direction you and your clinician agree on, judged by weekly averages.",
        "measures": [("weight", "Scale or your entries"), ("exercise_min", "Watch"), ("steps", "Watch and phone")],
        "needs_external": "A scale, or regular entries. The watch does not measure weight.",
        "period": "Monthly direction of weekly averages; daily weight swings by a kilogram or more.",
        "options": ["Combine activity with eating changes; activity alone usually moves weight slowly.", "Weigh at the same time of day."],
        "questions": ["What weight change would be meaningful for my health?", "Are any of my medicines affecting my weight?"],
        "guardrail": "Calories burned are estimates; the product never converts them into predicted weight loss."},
    "blood_pressure": {
        "label": "Blood-pressure management", "definition": "Keep averaged home blood pressure within the target your clinician sets.",
        "measures": [("systolic", "Validated home cuff"), ("diastolic", "Validated home cuff")],
        "needs_external": "A validated upper-arm cuff (see validatebp.org), used with good technique. The watch does not measure blood pressure values.",
        "period": "Weekly averages; your clinician decides on changes.",
        "options": ["Measure seated after 5 minutes of rest, arm supported, twice, morning and evening, for a week before a visit.",
                    "Follow the activity plan your clinician set."],
        "questions": ["What is my target, and what should I do if my averages are above it?", "Should I bring my cuff to check it against yours?"],
        "guardrail": "No medication advice. The product never suggests starting, stopping or changing a medicine."},
    "glucose": {
        "label": "Glucose-related goals", "definition": "Work with your clinician on HbA1c and glucose; use activity as one supporting behavior.",
        "measures": [("hba1c", "Laboratory (clinician-ordered)"), ("glucose_cgm", "Glucose sensor, if prescribed or worn"), ("exercise_min", "Watch")],
        "needs_external": "Periodic HbA1c lab results. The watch cannot measure HbA1c or glucose.",
        "period": "HbA1c reflects about three months; results are usually months apart.",
        "options": ["A recognized lifestyle-change program (such as the National Diabetes Prevention Program) for people with prediabetes.",
                    "Regular activity spread across the week."],
        "questions": ["When should my HbA1c be checked again?", "Would a lifestyle-change program be covered for me?"],
        "guardrail": "No claim that the watch measures or predicts glucose, and no medication advice."},
    "sleep_consistency": {
        "label": "Sleep consistency", "definition": "Sleep 7 hours or more on a regular schedule.",
        "measures": [("sleep_hours", "Watch estimate")],
        "needs_external": "Your own notes on how rested you feel.",
        "period": "Two-week regularity.",
        "options": ["Keep a regular wake time, including weekends."],
        "questions": ["Could snoring, insomnia or a medicine be affecting my sleep?"],
        "guardrail": "Sleep estimates cannot diagnose a sleep disorder."},
    "mobility": {
        "label": "Mobility", "definition": "Keep walking speed and steadiness so you can walk independently.",
        "measures": [("walking_speed", "Phone estimate"), ("steadiness", "Phone estimate"), ("steps", "Watch and phone")],
        "needs_external": "A clinician's gait or balance assessment if things change.",
        "period": "Every 3–6 months against your own last year.",
        "options": ["Strength and balance exercise (the US guidelines recommend it for older adults)."],
        "questions": ["Would a balance or strength assessment help me?", "Is anything I take affecting my balance?"],
        "guardrail": "No fall-risk prediction for an individual."},
    "activity_adherence": {
        "label": "Activity adherence", "definition": "Reach 150 minutes of brisk-or-harder activity in most weeks.",
        "measures": [("exercise_min", "Watch"), ("steps", "Watch and phone")],
        "needs_external": "Nothing else.",
        "period": "Rolling 12 weeks.",
        "options": ["Short bouts count; spread activity across the week."],
        "questions": ["Is there any activity I should avoid?"],
        "guardrail": "Rings and streaks reward effort; they say nothing about safety."},
    "mental_wellbeing": {
        "label": "Mental well-being", "definition": "Notice patterns in mood alongside sleep and activity.",
        "measures": [],
        "needs_external": "Your own mood logs and validated questionnaires. Not collected in this demo.",
        "period": "Monthly, gently.",
        "options": ["Talk to someone. In the US, call or text 988 if you are in crisis."],
        "questions": ["Would a screening questionnaire be useful for me?"],
        "guardrail": "Mood is never inferred from heart rate or sleep."},
}


def goal_state(P: Profile, gid):
    g = GOALS[gid]
    avail, missing = [], []
    for code, src in g["measures"]:
        n = len(P.daily.get(code, {})) if CFG[code]["cadence"] != "lab" else sum(1 for o in P.obs if o["code"] == code)
        (avail if n else missing).append({"code": code, "label": METRICS[code][0], "source": src, "n": n})
    main = next((m for m in g["measures"] if P.daily.get(m[0]) or any(o["code"] == m[0] for o in P.obs)), None)
    prog = None
    if main:
        code = main[0]
        if CFG[code]["cadence"] == "lab":
            L = P.labs(code)
            if L.get("results"):
                prog = {"code": code, "baseline": L["results"][0]["value"], "baseline_date": L["results"][0]["date"],
                        "current": L["results"][-1]["value"], "current_date": L["results"][-1]["date"],
                        "status": L.get("status", "insufficient"), "how": "First and latest laboratory results."}
        elif CFG[code]["cadence"] != "episode":
            w = P.window(code, 365) if gid != "activity_adherence" else P.window(code, 90)
            if w:
                prog = {"code": code, "baseline": w["prev"], "current": w["cur"], "status": w["status"], "reason": w["reason"],
                        "how": "Median of the most recent period against the period before it."}
    chosen = gid in P.p.goals
    clinical = [c for c in P.ing.clinical if c["type"] in ("clinical_goal", "care_plan")]
    return {"id": gid, "chosen": chosen, "available": avail, "missing": missing, "progress": prog,
            "clinician": [c["text"] for c in clinical] if gid in ("blood_pressure", "glucose", "activity_adherence") else []}


# ======================================================================= annual review + narrative

PRESETS = {"m": ("Last 30 days vs the same 30 days a year earlier", 30, 365),
           "q": ("Last 90 days vs the same 90 days a year earlier", 90, 365),
           "y": ("Last 365 days vs the 365 before", 365, 365)}


def annual(P: Profile):
    out = {}
    for k, (label, span, lag) in PRESETS.items():
        rows = {}
        for code in ORDER:
            c = CFG[code]
            if code not in P.daily or c["cadence"] in ("lab", "episode"):
                continue
            cur = P.values(code, AS_OF - dt.timedelta(days=span - 1), AS_OF)
            a = AS_OF - dt.timedelta(days=lag)
            prev = P.values(code, a - dt.timedelta(days=span - 1), a)
            res = P.classify(code, prev, cur, span)
            if res:
                rows[code] = res
        out[k] = {"label": label, "rows": rows, "narrative": narrative(P, rows, label)}
    return out


def narrative(P: Profile, rows, label):
    def lab(c):
        t = METRICS[c][0]
        return t if t.split()[0] in ("HbA1c", "LDL") else t[0].lower() + t[1:]
    cap = lambda t: t[:1].upper() + t[1:]
    imp = [c for c, x in rows.items() if x["status"] == "improving"]
    dec = [c for c, x in rows.items() if x["status"] == "declining"]
    sta = [c for c, x in rows.items() if x["status"] in ("stable", "changed")]
    ins = [c for c, x in rows.items() if x["status"] == "insufficient"]
    goal_needs = {m for g in P.p.goals for m, _ in GOALS[g]["measures"]}
    absent = [c for c in goal_needs if c not in P.daily and not any(o["code"] == c for o in P.obs)]
    paras = []
    have = [c for c in rows]
    paras.append(("What we know", f"{label}. Comparable data exist for {len(have)} measures"
                  + (f"; {len(ins)} of them have too little data in one of the two periods to compare." if ins else ".")))
    ch = []
    for c in imp:
        x = rows[c]; ch.append(f"{lab(c)} improved ({x['prev']} → {x['cur']})")
    for c in dec:
        x = rows[c]; ch.append(f"{lab(c)} declined ({x['prev']} → {x['cur']})")
    paras.append(("What changed", (cap("; ".join(ch)) + ".") if ch else "Nothing changed by more than the product's thresholds."))
    if sta:
        paras.append(("What held steady", cap(", ".join(lab(c) for c in sta)) + "."))
    miss = [lab(c) for c in ins] + [METRICS[c][0].lower() + " (never recorded)" for c in absent]
    paras.append(("What is missing", ("Not enough data for: " + ", ".join(miss) + ". Absence is not a normal result.") if miss
                  else "Nothing your goals depend on is missing."))
    paras.append(("What we cannot conclude", "These are associations in your own data. They do not show that any activity caused a change, "
                  "and estimates (cardio fitness, sleep, walking speed) can be off for an individual. Nothing here is a diagnosis."))
    return [{"h": h, "p": p} for h, p in paras]


# ======================================================================= provider handoff

def provider(P: Profile):
    out = {}
    for code in ORDER:
        if code not in P.daily and not any(o["code"] == code for o in P.obs):
            continue
        c = CFG[code]
        ent = {"label": METRICS[code][0], "unit": METRICS[code][1].replace("mm[Hg]", "mmHg"), "kind": METRICS[code][2],
               "loinc": METRICS[code][3], "ranges": {}}
        srcs = sorted({o["source"]["name"] for o in P.obs if o["code"] == code})
        ent["sources"] = srcs
        if c["cadence"] == "lab":
            ent["labs"] = P.labs(code)["results"]
        else:
            for w in (90, 180, 365):
                v = P.values(code, AS_OF - dt.timedelta(days=w - 1), AS_OF)
                if not v:
                    continue
                cmp_ = P.window(code, w) if c["cadence"] != "episode" else None
                ent["ranges"][str(w)] = {"median": r(st.median(v), DEC[code]), "p10": r(pct(v, 10), DEC[code]),
                                         "p90": r(pct(v, 90), DEC[code]), "n": len(v),
                                         "coverage": r(len(v) / w, 2) if c["cadence"] == "daily" else None,
                                         "status": cmp_["status"] if cmp_ else None,
                                         "from": (AS_OF - dt.timedelta(days=w - 1)).isoformat(), "to": AS_OF.isoformat()}
        out[code] = ent
    return out


# ======================================================================= overview

def overview(P: Profile):
    avail = []
    for code in ORDER:
        obs = [o for o in P.obs if o["code"] == code]
        if not obs:
            continue
        last = max(o["local_date"] for o in obs)
        avail.append({"code": code, "label": METRICS[code][0], "kind": METRICS[code][2], "n": len(obs),
                      "first": min(o["local_date"] for o in obs), "last": last,
                      "fresh_days": (AS_OF - dt.date.fromisoformat(last)).days,
                      "sources": sorted({o["source"]["name"] for o in obs})})
    windows = {str(w): {c: P.window(c, w) for c in ORDER if c in P.daily and CFG[c]["cadence"] not in ("lab", "episode")} for w in WINDOWS}
    prev_review = AS_OF - dt.timedelta(days=30)
    then = {c: P.window(c, 90, prev_review) for c in ORDER if c in P.daily and CFG[c]["cadence"] not in ("lab", "episode")}
    changes = [{"code": c, "label": METRICS[c][0], "was": then[c]["status"], "now": windows["90"][c]["status"]}
               for c in then if then[c] and windows["90"][c] and then[c]["status"] != windows["90"][c]["status"]]
    goal_needs = {m: GOALS[g]["label"] for g in P.p.goals for m, _ in GOALS[g]["measures"]}
    missing = [{"code": c, "label": METRICS[c][0], "for": goal_needs[c]} for c in goal_needs
               if not any(o["code"] == c for o in P.obs)]
    labs = {c: P.labs(c) for c in ("hba1c", "ldl") if any(o["code"] == c for o in P.obs)}
    return {"available": avail, "missing": missing, "windows": windows, "labs": labs,
            "changes_since_review": {"date": prev_review.isoformat(), "items": changes}}
