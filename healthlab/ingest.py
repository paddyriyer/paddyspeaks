"""Import adapters: source files in, canonical observations out.

Every canonical observation keeps where it came from and what was done to it:

  id            stable hash of (source system, source type, start, value) — a
                re-import of the same record gets the same id and is dropped
  code          canonical metric code; `loinc` only where the mapping is sure
  value, unit   standard unit (UCUM); `orig_value`, `orig_unit` as received
  start         ISO 8601 with the offset the device recorded
  utc           the same instant in UTC
  local_date    the calendar day as lived (in the offset recorded), used for
                daily aggregation — a walk in Tokyo belongs to Tokyo's day
  tz            the recorded UTC offset
  source        {system, name, device, file}
  kind          measured | estimated | device | clinician_verified | patient_reported
  method        e.g. SDNN vs RMSSD: different methods are different codes and
                are never averaged together
  flags         quality notes (converted unit, other time zone, conflict, …)

Rejections (implausible values, unknown units) are logged with a reason, never
silently dropped. Patient-entered text is never promoted to a confirmed
diagnosis or an active prescription.
"""
from __future__ import annotations

import csv
import datetime as dt
import hashlib
import io
import json
import xml.etree.ElementTree as ET

# canonical metric registry: code -> (label, unit, kind, loinc or None, plausible range)
METRICS = {
    "steps":           ("Steps", "count/d", "measured", "41950-7", (0, 100000)),
    "exercise_min":    ("Exercise minutes", "min/d", "measured", None, (0, 600)),
    "resting_hr":      ("Resting heart rate", "/min", "measured", "40443-4", (25, 160)),
    "hrv_sdnn":        ("Heart rate variability (SDNN)", "ms", "measured", "80404-7", (3, 300)),
    "hrv_rmssd":       ("Heart rate variability (RMSSD)", "ms", "measured", None, (3, 300)),
    "vo2max":          ("Cardio fitness (estimated VO₂ max)", "mL/kg/min", "estimated", None, (10, 90)),
    "sleep_hours":     ("Sleep duration", "h", "estimated", None, (0.5, 16)),
    "walking_speed":   ("Walking speed", "m/s", "estimated", None, (0.1, 3.0)),
    "steadiness":      ("Walking steadiness", "%", "estimated", None, (0, 100)),
    "weight":          ("Body weight", "kg", "device", "29463-7", (20, 350)),
    "systolic":        ("Systolic blood pressure", "mm[Hg]", "device", "8480-6", (60, 260)),
    "diastolic":       ("Diastolic blood pressure", "mm[Hg]", "device", "8462-4", (30, 160)),
    "pulse_cuff":      ("Pulse (cuff)", "/min", "device", "8867-4", (25, 220)),
    "glucose_cgm":     ("Glucose, interstitial (CGM)", "mg/dL", "device", None, (30, 450)),
    "hba1c":           ("HbA1c", "%", "clinician_verified", "4548-4", (3, 20)),
    "ldl":             ("LDL cholesterol (calculated)", "mg/dL", "clinician_verified", "13457-7", (10, 400)),
}

APPLE_TYPES = {
    "HKQuantityTypeIdentifierStepCount": "steps",
    "HKQuantityTypeIdentifierAppleExerciseTime": "exercise_min",
    "HKQuantityTypeIdentifierRestingHeartRate": "resting_hr",
    "HKQuantityTypeIdentifierHeartRateVariabilitySDNN": "hrv_sdnn",
    "HKQuantityTypeIdentifierVO2Max": "vo2max",
    "HKQuantityTypeIdentifierWalkingSpeed": "walking_speed",
    "HKQuantityTypeIdentifierAppleWalkingSteadiness": "steadiness",
    "HKQuantityTypeIdentifierBodyMass": "weight",
}

# unit conversions: (from, to) -> function. Exact factors only.
CONVERT = {
    ("count/min", "/min"): lambda v: v,
    ("count", "count/d"): lambda v: v,
    ("min", "min/d"): lambda v: v,
    ("mL/min·kg", "mL/kg/min"): lambda v: v,
    ("km/hr", "m/s"): lambda v: v / 3.6,
    ("lb", "kg"): lambda v: v * 0.45359237,
    ("kg", "kg"): lambda v: v,
    ("mmHg", "mm[Hg]"): lambda v: v,
    ("ms", "ms"): lambda v: v,
    ("%", "%"): lambda v: v,
    ("mg/dL", "mg/dL"): lambda v: v,
    ("mmol/L", "mg/dL"): lambda v: v * 18.0182,   # glucose molar mass 180.16 g/mol
    # HbA1c IFCC (mmol/mol) -> NGSP (%), the IFCC–NGSP master equation
    ("mmol/mol", "%"): lambda v: 0.09148 * v + 2.152,
}

SOURCE_PRIORITY = {"resting_hr": ["apple_health_export", "ring_csv"]}


class Ingest:
    def __init__(self, subject: str, imported_at: str):
        self.subject = subject
        self.imported_at = imported_at
        self.obs: dict[str, dict] = {}
        self.workouts: dict[str, dict] = {}
        self.clinical: list[dict] = []        # conditions, medications, goals, plans
        self.entries: list[dict] = []         # patient-reported
        self.log: list[dict] = []             # one row per (file, outcome)
        self._counts: dict[tuple, int] = {}

    # ------------------------------------------------------------ helpers
    def _count(self, file, outcome, reason=""):
        k = (file, outcome, reason)
        self._counts[k] = self._counts.get(k, 0) + 1

    @staticmethod
    def _id(*parts) -> str:
        return hashlib.sha1("|".join(map(str, parts)).encode()).hexdigest()[:16]

    @staticmethod
    def parse_apple_time(s: str) -> dt.datetime:
        return dt.datetime.strptime(s, "%Y-%m-%d %H:%M:%S %z")

    def add(self, code, value, unit, when: dt.datetime, *, system, name, device, file,
            kind=None, method=None, flags=(), raw_key=None, date_only=False):
        label, std_unit, default_kind, loinc, (lo, hi) = METRICS[code]
        conv = CONVERT.get((unit, std_unit))
        if conv is None:
            self._count(file, "rejected", f"unknown unit {unit!r} for {code}")
            return None
        v = conv(float(value))
        flags = list(flags)
        if unit != std_unit and (unit, std_unit) not in {("count/min", "/min"), ("count", "count/d"), ("min", "min/d"),
                                                         ("mL/min·kg", "mL/kg/min"), ("mmHg", "mm[Hg]")}:
            flags.append(f"converted {unit}→{std_unit}")
        if not (lo <= v <= hi):
            self._count(file, "rejected", f"implausible {label.lower()} {value} {unit}")
            return None
        oid = self._id(system, raw_key or code, when.isoformat(), value)
        if oid in self.obs:
            self._count(file, "duplicate", "same record imported again")
            return None
        off = when.utcoffset()
        tz = "date-only" if date_only else "UTC" if off is None else f"{'+' if off >= dt.timedelta(0) else '-'}{abs(int(off.total_seconds()))//3600:02d}:{abs(int(off.total_seconds()))//60%60:02d}"
        self.obs[oid] = {
            "id": oid, "subject": self.subject, "code": code, "loinc": loinc,
            "value": round(v, 4), "unit": std_unit, "orig_value": value, "orig_unit": unit,
            "start": when.isoformat(), "utc": when.astimezone(dt.UTC).isoformat().replace("+00:00", "Z"),
            "local_date": when.date().isoformat(), "tz": tz,
            "source": {"system": system, "name": name, "device": device, "file": file},
            "kind": kind or default_kind, "method": method, "flags": flags,
            "imported_at": self.imported_at, "consent_scope": ["self"],
        }
        self._count(file, "kept")
        return oid

    # ------------------------------------------------------------ adapters
    def apple_export(self, text: str, file="apple_export.xml"):
        root = ET.fromstring(text)
        for el in root:
            if el.tag == "Record":
                t = el.get("type")
                start = self.parse_apple_time(el.get("startDate"))
                end = self.parse_apple_time(el.get("endDate"))
                if t == "HKCategoryTypeIdentifierSleepAnalysis":
                    if "Asleep" not in el.get("value", ""):
                        self._count(file, "skipped", "in-bed, not asleep")
                        continue
                    hours = (end - start).total_seconds() / 3600
                    self._sleep(hours, end, el, file)      # a night belongs to the morning it ends on
                    continue
                code = APPLE_TYPES.get(t)
                if code is None:
                    self._count(file, "skipped", f"type not used in this demo: {t}")
                    continue
                method = "SDNN" if code == "hrv_sdnn" else None
                self.add(code, el.get("value"), el.get("unit"), start, system="apple_health_export",
                         name=el.get("sourceName"), device=el.get("device"), file=file, method=method, raw_key=t)
            elif el.tag == "Workout":
                self._workout(el, file)

    def _sleep(self, hours, end, el, file):
        oid = self._id("apple_health_export", "sleep", end.isoformat(), round(hours, 4))
        if oid in self.obs:
            self._count(file, "duplicate", "same record imported again")
            return
        lo, hi = METRICS["sleep_hours"][4]
        if not lo <= hours <= hi:
            self._count(file, "rejected", f"implausible sleep {hours:.1f} h")
            return
        off = end.utcoffset()
        self.obs[oid] = {
            "id": oid, "subject": self.subject, "code": "sleep_hours", "loinc": None,
            "value": round(hours, 4), "unit": "h", "orig_value": f"{el.get('startDate')} → {el.get('endDate')}",
            "orig_unit": "interval", "start": end.isoformat(),
            "utc": end.astimezone(dt.UTC).isoformat().replace("+00:00", "Z"),
            "local_date": end.date().isoformat(),
            "tz": f"{'+' if off >= dt.timedelta(0) else '-'}{abs(int(off.total_seconds()))//3600:02d}:{abs(int(off.total_seconds()))//60%60:02d}",
            "source": {"system": "apple_health_export", "name": el.get("sourceName"), "device": el.get("device"), "file": file},
            "kind": "estimated", "method": "asleep interval (stages estimated)", "flags": [],
            "imported_at": self.imported_at, "consent_scope": ["self"],
        }
        self._count(file, "kept")

    def _workout(self, el, file):
        start = self.parse_apple_time(el.get("startDate"))
        kind = el.get("workoutActivityType").replace("HKWorkoutActivityType", "")
        wid = self._id("apple_health_export", "workout", start.isoformat(), el.get("duration"))
        if wid in self.workouts:
            self._count(file, "duplicate", "same workout imported again")
            return
        w = {"id": wid, "type": kind, "start": start.isoformat(), "local_date": start.date().isoformat(),
             "duration_min": round(float(el.get("duration")), 2), "distance_km": None, "avg_hr": None,
             "elevation_m": None, "effort": None, "indoor": False,
             "source": {"system": "apple_health_export", "name": el.get("sourceName"), "file": file}}
        for ch in el:
            if ch.tag == "MetadataEntry":
                k, v = ch.get("key"), ch.get("value")
                if k == "HKElevationAscended":
                    w["elevation_m"] = round(float(v.split()[0]) / 100, 1)
                elif k == "EffortRating":
                    w["effort"] = int(v)
                elif k == "HKIndoorWorkout":
                    w["indoor"] = v == "1"
            elif ch.tag == "WorkoutStatistics":
                if "Distance" in ch.get("type"):
                    w["distance_km"] = round(float(ch.get("sum")), 3)
                elif ch.get("type") == "HKQuantityTypeIdentifierHeartRate":
                    w["avg_hr"] = round(float(ch.get("average")), 1)
        if w["distance_km"] and w["duration_min"]:
            w["speed_kmh"] = round(w["distance_km"] / (w["duration_min"] / 60), 3)
        self.workouts[wid] = w
        self._count(file, "kept")

    def ring_csv(self, text: str, tz: str, file="ring.csv"):
        from zoneinfo import ZoneInfo
        for row in csv.DictReader(io.StringIO(text)):
            # the ring reports a date only; anchor it at local 07:00 and say so
            when = dt.datetime.combine(dt.date.fromisoformat(row["date"]), dt.time(7, 0), ZoneInfo(tz))
            self.add("hrv_rmssd", row["hrv_rmssd_ms"], "ms", when, system="ring_csv", name="Smart ring",
                     device="Ring", file=file, method="RMSSD", flags=["date-only source; time assumed 07:00 local"], raw_key="rmssd")
            self.add("resting_hr", row["resting_hr_bpm"], "count/min", when, system="ring_csv", name="Smart ring",
                     device="Ring", file=file, flags=["date-only source; time assumed 07:00 local"], raw_key="rhr")

    def cuff_csv(self, text: str, file="cuff.csv"):
        for row in csv.DictReader(io.StringIO(text)):
            when = dt.datetime.fromisoformat(row["measured_at"])
            dev = row["device"]
            for code, col in (("systolic", "systolic_mmHg"), ("diastolic", "diastolic_mmHg"), ("pulse_cuff", "pulse_bpm")):
                self.add(code, row[col], "mmHg" if code != "pulse_cuff" else "count/min", when,
                         system="bp_cuff_csv", name="Blood-pressure cuff", device=dev, file=file, raw_key=code)

    def scale_csv(self, text: str, file="scale.csv"):
        for row in csv.DictReader(io.StringIO(text)):
            self.add("weight", row["weight"], row["unit"], dt.datetime.fromisoformat(row["measured_at"]),
                     system="scale_csv", name="Connected scale", device="Scale", file=file)

    def cgm_csv(self, text: str, file="cgm.csv"):
        for row in csv.DictReader(io.StringIO(text)):
            self.add("glucose_cgm", row["glucose_mg_dl"], "mg/dL", dt.datetime.fromisoformat(row["timestamp"]),
                     system="cgm_csv", name="Continuous glucose monitor", device="CGM sensor", file=file)

    def fhir_bundle(self, text: str, file="records.json"):
        b = json.loads(text)
        loinc_map = {"4548-4": ("hba1c", "%"), "59261-8": ("hba1c", "mmol/mol"), "13457-7": ("ldl", "mg/dL")}
        for e in b.get("entry", []):
            r = e["resource"]
            rt = r["resourceType"]
            if rt == "Observation":
                coding = r["code"]["coding"][0]
                m = loinc_map.get(coding.get("code"))
                if m is None:
                    self._count(file, "skipped", f"unmapped code {coding.get('code')}")
                    continue
                code, unit = m
                vq = r["valueQuantity"]
                when = dt.datetime.fromisoformat(r["effectiveDateTime"] + "T08:00:00+00:00") if len(r["effectiveDateTime"]) == 10 \
                    else dt.datetime.fromisoformat(r["effectiveDateTime"])
                flags = ["date-only result; time not reported"]
                self.add(code, vq["value"], vq["code"], when, system="fhir_r4", name=r.get("performer", [{}])[0].get("display", "Lab"),
                         device=None, file=file, kind="clinician_verified", flags=flags, raw_key=coding.get("code"),
                         date_only=len(r["effectiveDateTime"]) == 10)
            elif rt in ("Condition", "MedicationStatement", "Goal", "CarePlan"):
                self.clinical.append(self._clinical(r))
                self._count(file, "kept")
            else:
                self._count(file, "skipped", f"resource type {rt}")

    @staticmethod
    def _clinical(r: dict) -> dict:
        rt = r["resourceType"]
        if rt == "Condition":
            return {"type": "condition", "text": r["code"]["text"],
                    "clinical_status": r["clinicalStatus"]["coding"][0]["code"],
                    "verification": r["verificationStatus"]["coding"][0]["code"],
                    "onset": r.get("onsetDateTime"), "kind": "clinician_verified",
                    "snomed": r["code"]["coding"][0]["code"]}
        if rt == "MedicationStatement":
            return {"type": "medication", "text": r["medicationCodeableConcept"]["text"],
                    "record_status": r["status"], "start": r["effectivePeriod"]["start"],
                    "asserted": r.get("dateAsserted"), "kind": "clinician_verified"}
        if rt == "Goal":
            return {"type": "clinical_goal", "text": r["description"]["text"],
                    "targets": [{"measure": t["measure"]["text"], "value": t["detailQuantity"]["value"],
                                 "unit": t["detailQuantity"]["unit"]} for t in r.get("target", [])],
                    "by": r.get("expressedBy", {}).get("display"), "start": r.get("startDate"),
                    "kind": "clinician_verified"}
        return {"type": "care_plan", "text": r["title"], "start": r["period"]["start"], "kind": "clinician_verified"}

    def user_entries(self, text: str, file="entries.json"):
        for e in json.loads(text):
            e = dict(e)
            e["kind"] = "patient_reported"
            self.entries.append(e)
            self._count(file, "kept")

    # ------------------------------------------------------------ outputs
    def reconcile(self):
        """Cross-source checks that need everything loaded."""
        notes = []
        # medication status conflict: the record says active, the person says stopped
        for m in [c for c in self.clinical if c["type"] == "medication"]:
            for e in self.entries:
                if e["type"] == "medication_report" and e.get("medication") == m["text"] and e.get("reported_status") != m["record_status"]:
                    m["conflict"] = {"reported_status": e["reported_status"], "reported_on": e["date"], "note": e["text"]}
                    notes.append({"what": "medication status conflict", "detail":
                                  f"Record lists {m['text']} as {m['record_status']} (asserted {m['asserted']}); "
                                  f"you reported it {e['reported_status']} on {e['date']}. Neither is overwritten; confirm with your clinician."})
        # resting HR: two devices on the same day
        by_day: dict[str, dict[str, float]] = {}
        for o in self.obs.values():
            if o["code"] == "resting_hr":
                by_day.setdefault(o["local_date"], {})[o["source"]["system"]] = o["value"]
        conflicts = [(d, s) for d, s in by_day.items() if len(s) > 1 and max(s.values()) - min(s.values()) >= 5]
        for d, s in conflicts:
            for o in self.obs.values():
                if o["code"] == "resting_hr" and o["local_date"] == d:
                    o["flags"].append("devices disagree by ≥5 /min this day")
        if conflicts:
            notes.append({"what": "resting heart rate: two devices disagree",
                          "detail": f"{len(conflicts)} days where the watch and the ring differ by 5 /min or more. "
                                    "Both are kept; daily trends use the watch (the source with the longest history) and say so."})
        # other time zones: home offsets are the ones most records use (two with daylight saving)
        counts: dict[str, int] = {}
        for o in self.obs.values():
            if o["tz"] != "date-only":
                counts[o["tz"]] = counts.get(o["tz"], 0) + 1
        total = sum(counts.values()) or 1
        home = {z for z, c in counts.items() if c / total >= 0.1}
        away = sorted({o["local_date"] for o in self.obs.values() if o["tz"] not in home and o["tz"] != "date-only"})
        for o in self.obs.values():
            if o["tz"] not in home and o["tz"] != "date-only":
                o["flags"].append(f"recorded in UTC{o['tz']} (away from home)")
        tzs = sorted(counts)
        # stale labs
        for o in self.obs.values():
            if o["kind"] == "clinician_verified":
                age = (dt.date(2026, 11, 15) - dt.date.fromisoformat(o["local_date"])).days
                if age > 365:
                    o["flags"].append(f"result is {age // 30} months old")
        log = [{"file": f, "outcome": oc, "reason": r, "count": c} for (f, oc, r), c in sorted(self._counts.items())]
        return {"notes": notes, "log": log, "timezones": tzs, "away_days": away}
