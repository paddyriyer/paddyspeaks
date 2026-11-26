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
from . import anonymity, explain, synth
from . import ingest as IG
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


def build_profile(p, strata, files=None):
    files = files or synth.generate(p)
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
        "clinical": [c for c in I.clinical if c["type"] != "dispense"], "entries": I.entries,
        "medications": I.medications, "notifications": I.notifications,
        "coverage": A.coverage(P), "coverage_matrix": A.coverage_matrix(P),
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
        "min_cell": A.MIN_CELL, "anonymity": anonymity.demo(),
        "import_spec": import_spec(),
    }


def import_spec():
    """Everything the browser engine needs to import and judge exactly as this pipeline does."""
    return {
        "metrics": {c: {"label": m[0], "unit": m[1], "kind": m[2], "loinc": m[3], "range": list(m[4])} for c, m in METRICS.items()},
        "apple_types": IG.APPLE_TYPES, "apple_events": IG.APPLE_EVENTS,
        "linear": [[a, b, f, o] for (a, b), (f, o) in IG.LINEAR.items()], "same_unit": [list(x) for x in sorted(IG.SAME_UNIT)],
        "loinc_map": {k: list(v) for k, v in IG.LOINC_MAP.items()},
        "cfg": A.CFG, "dec": A.DEC, "order": A.ORDER,
        "bad": A.BAD, "limits": A.LIMITS, "context_terms": A.CONTEXT_TERMS, "next": A.NEXT,
        "coverage": [list(c[:3]) + [c[3], c[4]] for c in A.COVERAGE],
        "synthetic_mark": synth.SYNTHETIC_MARK,
    }


PARITY_BUNDLES = {   # what the browser engine must reproduce from the published sample files
    "alex": ["alex-apple-health-export.zip"],
    "ben": ["ben-apple-health-export.zip", "ben-blood-pressure-cuff.csv", "ben-scale.csv", "ben-clinical-records.json"],
    "carmen": ["carmen-clinical-records.json", "carmen-glucose-sensor.csv"],
    "dorothy": ["dorothy-apple-health-export.zip"],
    "malformed": ["malformed-export.xml"],
}


def sample_text(name, data):
    import io as _io
    import zipfile
    if name.endswith(".zip"):
        with zipfile.ZipFile(_io.BytesIO(data)) as z:
            return z.read("apple_health_export/export.xml").decode()
    return data.decode()


def ingest_samples(names, samples):
    """Ingest published sample files exactly as a person would provide them (no persona extras)."""
    I = Ingest("local", IMPORTED_AT)
    for n in names:
        text = sample_text(n, samples[n])
        if n.endswith((".zip", ".xml")):
            I.apple_export(text, file=n)
        elif "cuff" in n:
            I.cuff_csv(text, file=n)
        elif "scale" in n:
            I.scale_csv(text, file=n)
        elif "glucose-sensor" in n:
            I.cgm_csv(text, file=n)
        else:
            I.fhir_bundle(text, file=n)
    return I, I.reconcile()


def parity(samples):
    import statistics as st
    local = synth.Persona("local", "Imported", 0, "female", "UTC", 0, "", "", [])
    out = {}
    for bundle, names in PARITY_BUNDLES.items():
        I, recon = ingest_samples(names, samples)
        P = A.Profile(local, I, recon)
        files = {}
        for row in recon["log"]:
            files.setdefault(row["file"], {"kept": 0, "duplicate": 0, "rejected": 0, "skipped": 0})[row["outcome"]] += row["count"]
        wins = {}
        for w in (90, 365):
            wins[str(w)] = {}
            for c in A.ORDER:
                if c in P.daily and A.CFG[c]["cadence"] in ("daily", "sparse"):
                    x = P.window(c, w)
                    wins[str(w)][c] = {"status": x["status"], "prev": x["prev"], "cur": x["cur"], "n_prev": x["n_prev"], "n_cur": x["n_cur"]}
        out[bundle] = {
            "files": files, "observations": len(I.obs), "workouts": len(I.workouts), "notifications": len(I.notifications),
            "windows": wins,
            "coverage": {c["id"]: c["status"] for c in A.coverage(P)},
            "medications": {m["name"]: m["status"] for m in I.medications},
            "signals": [[x["kind"], x["tier"], x["start"], x["end"]] for x in A.signals(P)],
            "away_days": len(recon["away_days"]),
        }
    return out


SAMPLES = ROOT / "health-lab" / "samples"
SAMPLE_FILES = {   # published name -> (persona id, source file)
    "alex-apple-health-export.zip": ("a", "apple_export.xml"),
    "ben-apple-health-export.zip": ("b", "apple_export.xml"),
    "ben-blood-pressure-cuff.csv": ("b", "cuff.csv"),
    "ben-scale.csv": ("b", "scale.csv"),
    "ben-clinical-records.json": ("b", "records.json"),
    "carmen-clinical-records.json": ("c", "records.json"),
    "carmen-glucose-sensor.csv": ("c", "cgm.csv"),
    "dorothy-apple-health-export.zip": ("d", "apple_export.xml"),
}
MALFORMED = """<?xml version="1.0" encoding="UTF-8"?>
<!-- PADDYSPEAKS-SYNTHETIC-DATA: a deliberately broken export for testing the importer. Not a real person. -->
<HealthData locale="en_US">
 <ExportDate value="2026-11-15 08:00:00 -0800"/>
 <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Apple Watch" unit="count/min" startDate="2026-11-10 06:40:00 -0800" endDate="2026-11-10 06:41:00 -0800" value="61"/>
 <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Apple Watch" unit="count/min" startDate="2026-11-10 06:40:00 -0800" endDate="2026-11-10 06:41:00 -0800" value="61"/>
 <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Apple Watch" unit="count/min" startDate="2026-11-11 06:40:00 -0800" endDate="2026-11-11 06:41:00 -0800" value="0"/>
 <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Scale" unit="stone" startDate="2026-11-11 07:00:00 -0800" endDate="2026-11-11 07:00:00 -0800" value="12"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="not a date" endDate="2026-11-12 09:00:00 -0800" value="4000"/>
 <Record type="HKQuantityTypeIdentifierFutureSensorReading" sourceName="Apple Watch" unit="x" startDate="2026-11-12 06:40:00 -0800" endDate="2026-11-12 06:41:00 -0800" value="1"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="2026-11-12 08:00:00 -0800" endDate="2026-11-12 09:00:00 -0800" value="4200"/>
</HealthData>
"""


def sample_outputs(all_files):
    import io as _io
    import zipfile
    out = {}
    for name, (pid, src) in SAMPLE_FILES.items():
        text = all_files[pid][src]
        if name.endswith(".zip"):
            buf = _io.BytesIO()
            with zipfile.ZipFile(buf, "w") as z:
                info = zipfile.ZipInfo("apple_health_export/export.xml", date_time=(2026, 11, 15, 8, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                z.writestr(info, text, compresslevel=6)
            out[name] = buf.getvalue()
        else:
            out[name] = text.encode()
    out["malformed-export.xml"] = MALFORMED.encode()
    return out


def sample_content(data: bytes, name: str) -> bytes:
    """Compare zips by their contents: compressed bytes can differ between zlib versions."""
    if not name.endswith(".zip"):
        return data
    import io as _io
    import zipfile
    with zipfile.ZipFile(_io.BytesIO(data)) as z:
        return b"".join(n.encode() + z.read(n) for n in sorted(z.namelist()))


def dumps(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"), sort_keys=False) + "\n"


def main(argv):
    check = "--check" in argv
    strata = A.cohort_tables()
    outputs = {"meta.json": dumps(meta(strata))}
    all_files = {}
    for p in synth.PERSONAS:
        all_files[p.id] = synth.generate(p)
        outputs[f"profile-{p.id}.json"] = dumps(build_profile(p, strata, all_files[p.id]))
    samples = sample_outputs(all_files)
    outputs["../tests/parity.json"] = json.dumps(parity(samples), ensure_ascii=False, indent=1) + "\n"
    stale = []
    for name, text in outputs.items():
        f = OUT / name
        if check:
            if not f.exists() or f.read_text() != text:
                stale.append(name)
        else:
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_text(text)
    for name, data in samples.items():
        f = SAMPLES / name
        if check:
            if not f.exists() or sample_content(f.read_bytes(), name) != sample_content(data, name):
                stale.append("samples/" + name)
        else:
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_bytes(data)
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
