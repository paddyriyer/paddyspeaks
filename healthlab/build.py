#!/usr/bin/env python3
"""Build the Health Intelligence Lab's data: synthetic sources → ingest → analyze → JSON.

    python3 -m healthlab.build            # write health-lab/data/*.json
    python3 -m healthlab.build --check    # fail if the committed files are stale (CI)

Deterministic: same seeds, same output, byte for byte.
"""
from __future__ import annotations

import json
import pathlib
import sys

from . import analyze as A
from . import explain, synth
from .ingest import METRICS, Ingest

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "health-lab" / "data"
IMPORTED_AT = "2026-11-15T16:00:00Z"


def ingest(p, files):
    I = Ingest(p.id, IMPORTED_AT)
    I.apple_export(files["apple_export.xml"])
    if "ring.csv" in files:
        I.ring_csv(files["ring.csv"], p.home_tz)
    if "cuff.csv" in files:
        I.cuff_csv(files["cuff.csv"])
    if "scale.csv" in files:
        I.scale_csv(files["scale.csv"])
    if "cgm.csv" in files:
        I.cgm_csv(files["cgm.csv"])
    if "records.json" in files:
        I.fhir_bundle(files["records.json"])
    I.user_entries(files["entries.json"])
    return I, I.reconcile()


def sources(I, recon, files):
    by = {}
    for o in I.obs.values():
        f = o["source"]["file"]
        s = by.setdefault(f, {"file": f, "system": o["source"]["system"], "name": o["source"]["name"],
                              "codes": set(), "first": o["local_date"], "last": o["local_date"], "kinds": set()})
        s["codes"].add(o["code"]); s["kinds"].add(o["kind"])
        s["first"] = min(s["first"], o["local_date"]); s["last"] = max(s["last"], o["local_date"])
    for w in I.workouts.values():
        s = by.setdefault(w["source"]["file"], {"file": w["source"]["file"], "system": "apple_health_export",
                                                "name": "Apple Watch", "codes": set(), "first": w["local_date"],
                                                "last": w["local_date"], "kinds": set()})
        s["codes"].add("workouts")
    if I.clinical or I.entries:
        for f, sys_, name in (("records.json", "fhir_r4", "Patient-authorized clinical records"), ("entries.json", "user_entry", "Your own entries")):
            if f in files:
                by.setdefault(f, {"file": f, "system": sys_, "name": name, "codes": set(), "first": None, "last": None,
                                  "kinds": {"clinician_verified" if f == "records.json" else "patient_reported"}})
    log = {}
    for row in recon["log"]:
        log.setdefault(row["file"], []).append(row)
    out = []
    for f, s in sorted(by.items()):
        rows = log.get(f, [])
        cnt = lambda oc: sum(x["count"] for x in rows if x["outcome"] == oc)
        out.append({"file": f, "system": s["system"], "name": s["name"],
                    "measures": sorted(METRICS[c][0] if c in METRICS else c.capitalize() for c in s["codes"]),
                    "kinds": sorted(s["kinds"]), "first": s["first"], "last": s["last"],
                    "fresh_days": (synth.AS_OF - __import__("datetime").date.fromisoformat(s["last"])).days if s["last"] else None,
                    "kept": cnt("kept"), "duplicates": cnt("duplicate"), "rejected": cnt("rejected"), "skipped": cnt("skipped"),
                    "log": rows, "bytes": len(files.get(f, "")),
                    "sample": "\n".join(files[f].splitlines()[:6])[:900] if f in files else ""})
    return out


def provenance_samples(I):
    """A handful of canonical records showing each kind and each flag type."""
    picks, seen = [], set()
    for o in sorted(I.obs.values(), key=lambda o: o["start"]):
        key = (o["kind"], o["source"]["system"], bool(o["flags"]), o["flags"][0][:12] if o["flags"] else "")
        if key in seen:
            continue
        seen.add(key)
        picks.append(o)
    return picks[:12]


def build_profile(p, strata):
    files = synth.generate(p)
    I, recon = ingest(p, files)
    P = A.Profile(p, I, recon)
    ov = A.overview(P)
    sigs = A.signals(P)
    compact, weekly = A.workouts(P)
    eff, ssh = A.effectiveness(P, weekly)
    gs = [A.goal_state(P, g) for g in A.GOALS]
    data = {
        "profile": {"id": p.id, "name": p.name, "age": p.age, "sex_category": p.sex_category, "home_tz": p.home_tz,
                    "headline": p.headline, "story": p.story, "goals": p.goals, "seed": p.seed, "synthetic": True},
        "as_of": synth.AS_OF.isoformat(), "start": synth.START.isoformat(), "days": synth.DAYS,
        "clinical": I.clinical, "entries": I.entries,
        "sources": sources(I, recon, files), "notes": recon["notes"], "timezones": recon["timezones"],
        "away_days": recon["away_days"], "provenance": provenance_samples(I),
        "overview": ov,
        "series": {c: P.chart(c) for c in A.ORDER if c in P.daily and A.CFG[c]["cadence"] in ("daily", "sparse")},
        "monthly": {c: P.monthly(c) for c in A.ORDER if c in P.daily and A.CFG[c]["cadence"] in ("daily", "sparse")},
        "labs": {c: P.labs(c) for c in ("hba1c", "ldl") if any(o["code"] == c for o in P.obs)},
        "cgm": cgm_summary(P),
        "workouts": compact, "weekly": weekly, "effectiveness": eff, "same_speed": ssh,
        "signals": sigs, "goals": gs, "cohort": A.cohort_for(P, strata),
        "annual": A.annual(P), "provider": A.provider(P),
        "explain": explain.answers(P, ov, sigs, gs, eff),
    }
    return data


def cgm_summary(P):
    pts = [o for o in P.obs if o["code"] == "glucose_cgm"]
    if not pts:
        return None
    v = [o["value"] for o in pts]
    tir = sum(1 for x in v if 70 <= x <= 180) / len(v)
    days = {}
    for o in pts:
        days.setdefault(o["local_date"], []).append(o["value"])
    import statistics as st
    return {"from": min(days), "to": max(days), "readings": len(v), "mean": round(st.fmean(v)),
            "tir_70_180": round(tir * 100, 1), "below_70": round(sum(1 for x in v if x < 70) / len(v) * 100, 1),
            "above_180": round(sum(1 for x in v if x > 180) / len(v) * 100, 1),
            "daily": [[d, round(st.fmean(x)), round(min(x)), round(max(x))] for d, x in sorted(days.items())],
            "note": "Time-in-range targets (70–180 mg/dL) come from an international consensus for people with diabetes "
                    "(Battelino et al., Diabetes Care, 2019). Their meaning in prediabetes is less established; shown descriptively only."}


def meta(strata):
    return {
        "as_of": synth.AS_OF.isoformat(), "start": synth.START.isoformat(), "days": synth.DAYS,
        "profiles": [{"id": p.id, "name": p.name, "age": p.age, "headline": p.headline} for p in synth.PERSONAS],
        "metrics": {c: {"label": m[0], "unit": m[1].replace("mm[Hg]", "mmHg"), "kind": m[2], "loinc": m[3],
                        **({k: v for k, v in A.CFG[c].items() if k in ("better", "thr", "rel", "basis", "cadence", "rng")} if c in A.CFG else {})}
                    for c, m in METRICS.items()},
        "goals": A.GOALS,
        "cohorts": {"metrics": list(A.COHORT_METRICS), "age_bands": A.AGE_BANDS, "activity": [a[0] for a in A.ACTIVITY],
                    "conditions": A.CONDITIONS, "pcts": A.PCTS, "strata": strata, "references": A.REFERENCES,
                    "label": "Illustrative synthetic cohort: generated for this demo from a documented seed (9090). Not a published reference."},
        "urgent_terms": A.URGENT_TERMS, "urgent_guidance": A.URGENT_GUIDANCE,
    }


def dumps(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"), sort_keys=False) + "\n"


def main(argv):
    check = "--check" in argv
    strata = A.cohort_tables()
    outputs = {"meta.json": dumps(meta(strata))}
    for p in synth.PERSONAS:
        outputs[f"profile-{p.id}.json"] = dumps(build_profile(p, strata))
    stale = []
    for name, text in outputs.items():
        f = OUT / name
        if check:
            if not f.exists() or f.read_text() != text:
                stale.append(name)
        else:
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_text(text)
    if check:
        if stale:
            print("health-lab data is stale: " + ", ".join(stale) + "\nRun: python3 -m healthlab.build")
            return 1
        print("✓ health-lab data up to date")
        return 0
    for name, text in outputs.items():
        print(f"  wrote health-lab/data/{name} ({len(text) // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
