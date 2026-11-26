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

AS_OF = dt.date(2026, 11, 15)   # the demo's 'today' (synth.AS_OF); local imports pass their own

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
    "chol_total":      ("Total cholesterol", "mg/dL", "clinician_verified", "2093-3", (50, 600)),
    "hdl":             ("HDL cholesterol", "mg/dL", "clinician_verified", "2085-9", (5, 200)),
    "triglycerides":   ("Triglycerides", "mg/dL", "clinician_verified", "2571-8", (10, 3000)),
    "glucose_fasting": ("Fasting glucose", "mg/dL", "clinician_verified", "1558-6", (20, 600)),
    "creatinine":      ("Creatinine", "mg/dL", "clinician_verified", "2160-0", (0.1, 20)),
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
# unit conversions: (from, to) -> (factor, offset), value_to = value_from * factor + offset.
# Exact or documented factors only. Shipped to the browser engine (meta.json) so both use one table.
LINEAR = {
    ("count/min", "/min"): (1, 0), ("count", "count/d"): (1, 0), ("min", "min/d"): (1, 0),
    ("mL/min·kg", "mL/kg/min"): (1, 0),
    ("km/hr", "m/s"): (1 / 3.6, 0),
    ("lb", "kg"): (0.45359237, 0),
    ("kg", "kg"): (1, 0), ("mmHg", "mm[Hg]"): (1, 0), ("ms", "ms"): (1, 0), ("%", "%"): (1, 0),
    ("mg/dL", "mg/dL"): (1, 0),
    ("mmol/L", "mg/dL"): (18.0182, 0),          # glucose, molar mass 180.16 g/mol
    ("mmol/mol", "%"): (0.09148, 2.152),        # HbA1c IFCC -> NGSP, the IFCC–NGSP master equation
}
SAME_UNIT = {("count/min", "/min"), ("count", "count/d"), ("min", "min/d"), ("mL/min·kg", "mL/kg/min"), ("mmHg", "mm[Hg]")}

SOURCE_PRIORITY = {"resting_hr": ["apple_health_export", "ring_csv"]}

LOINC_MAP = {"4548-4": ("hba1c", "%"), "59261-8": ("hba1c", "mmol/mol"), "13457-7": ("ldl", "mg/dL"),
             "2093-3": ("chol_total", "mg/dL"), "2085-9": ("hdl", "mg/dL"), "2571-8": ("triglycerides", "mg/dL"),
             "1558-6": ("glucose_fasting", "mg/dL"), "2160-0": ("creatinine", "mg/dL")}

APPLE_EVENTS = {
    "HKCategoryTypeIdentifierIrregularHeartRhythmEvent": "Irregular rhythm notification",
    "HKCategoryTypeIdentifierHighHeartRateEvent": "High heart rate notification",
    "HKCategoryTypeIdentifierLowHeartRateEvent": "Low heart rate notification",
}


def _rows(text: str):
    """CSV rows, ignoring comment lines (the synthetic marker is one)."""
    return csv.DictReader(io.StringIO("\n".join(l for l in text.splitlines() if not l.startswith("#"))))


class Ingest:
    def __init__(self, subject: str, imported_at: str):
        self.subject = subject
        self.imported_at = imported_at
        self.obs: dict[str, dict] = {}
        self.workouts: dict[str, dict] = {}
        self.clinical: list[dict] = []        # conditions, medications, goals, plans
        self.entries: list[dict] = []         # patient-reported
        self.log: list[dict] = []             # one row per (file, outcome)
        self.notifications: list[dict] = []   # device notifications (validated features), as recorded
        self.medications: list[dict] = []     # reconciled medication list (see reconcile)
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
        conv = LINEAR.get((unit, std_unit))
        if conv is None:
            self._count(file, "rejected", f"unknown unit {unit!r} for {code}")
            return None
        try:
            v = float(value) * conv[0] + conv[1]
        except (TypeError, ValueError):
            self._count(file, "rejected", f"unreadable value {value!r} for {code}")
            return None
        flags = list(flags)
        if unit != std_unit and (unit, std_unit) not in SAME_UNIT:
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
                try:
                    start = self.parse_apple_time(el.get("startDate"))
                    end = self.parse_apple_time(el.get("endDate"))
                except (TypeError, ValueError):
                    self._count(file, "rejected", "malformed record (unreadable date)")
                    continue
                if t == "HKCategoryTypeIdentifierSleepAnalysis":
                    if "Asleep" not in el.get("value", ""):
                        self._count(file, "skipped", "in-bed, not asleep")
                        continue
                    hours = (end - start).total_seconds() / 3600
                    self._sleep(hours, end, el, file)      # a night belongs to the morning it ends on
                    continue
                if t in APPLE_EVENTS:
                    key = (t, el.get("startDate"))
                    if any((n["type_id"], n["raw_start"]) == key for n in self.notifications):
                        self._count(file, "duplicate", "same record imported again")
                        continue
                    self.notifications.append({"type_id": t, "label": APPLE_EVENTS[t], "raw_start": el.get("startDate"),
                                               "start": start.isoformat(), "end": end.isoformat(),
                                               "local_date": end.date().isoformat(), "source": el.get("sourceName"),
                                               "kind": "device_notification"})
                    self._count(file, "kept")
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
        for row in _rows(text):
            # the ring reports a date only; anchor it at local 07:00 and say so
            when = dt.datetime.combine(dt.date.fromisoformat(row["date"]), dt.time(7, 0), ZoneInfo(tz))
            self.add("hrv_rmssd", row["hrv_rmssd_ms"], "ms", when, system="ring_csv", name="Smart ring",
                     device="Ring", file=file, method="RMSSD", flags=["date-only source; time assumed 07:00 local"], raw_key="rmssd")
            self.add("resting_hr", row["resting_hr_bpm"], "count/min", when, system="ring_csv", name="Smart ring",
                     device="Ring", file=file, flags=["date-only source; time assumed 07:00 local"], raw_key="rhr")

    def cuff_csv(self, text: str, file="cuff.csv"):
        for row in _rows(text):
            when = dt.datetime.fromisoformat(row["measured_at"])
            dev = row["device"]
            for code, col in (("systolic", "systolic_mmHg"), ("diastolic", "diastolic_mmHg"), ("pulse_cuff", "pulse_bpm")):
                self.add(code, row[col], "mmHg" if code != "pulse_cuff" else "count/min", when,
                         system="bp_cuff_csv", name="Blood-pressure cuff", device=dev, file=file, raw_key=code)

    def scale_csv(self, text: str, file="scale.csv"):
        for row in _rows(text):
            self.add("weight", row["weight"], row["unit"], dt.datetime.fromisoformat(row["measured_at"]),
                     system="scale_csv", name="Connected scale", device="Scale", file=file)

    def cgm_csv(self, text: str, file="cgm.csv"):
        for row in _rows(text):
            self.add("glucose_cgm", row["glucose_mg_dl"], "mg/dL", dt.datetime.fromisoformat(row["timestamp"]),
                     system="cgm_csv", name="Continuous glucose monitor", device="CGM sensor", file=file)

    def fhir_bundle(self, text: str, file="records.json"):
        b = json.loads(text)
        loinc_map = LOINC_MAP
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
            elif rt in ("Condition", "MedicationStatement", "MedicationRequest", "MedicationDispense", "Goal", "CarePlan"):
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
        if rt == "MedicationRequest":
            vp = r.get("dispenseRequest", {}).get("validityPeriod", {})
            return {"type": "prescription", "text": r["medicationCodeableConcept"]["text"], "record_status": r["status"],
                    "authored": r.get("authoredOn"), "valid_until": vp.get("end"),
                    "by": r.get("requester", {}).get("display"), "kind": "clinician_verified"}
        if rt == "MedicationDispense":
            return {"type": "dispense", "text": r["medicationCodeableConcept"]["text"], "record_status": r["status"],
                    "when": r.get("whenHandedOver"), "days_supply": r.get("daysSupply", {}).get("value"),
                    "kind": "clinician_verified"}
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
                age = (AS_OF - dt.date.fromisoformat(o["local_date"])).days
                if age > 365:
                    o["flags"].append(f"result is {age // 30} months old")
        self.medications = reconcile_medications(self.clinical, self.entries, AS_OF)
        for m in self.medications:
            if m["status"] == "needs review":
                notes.append({"what": "medication needs review", "detail": f"{m['name']}: " + " ".join(m["reasons"])})
        log = [{"file": f, "outcome": oc, "reason": r, "count": c} for (f, oc, r), c in sorted(self._counts.items())]
        return {"notes": notes, "log": log, "timezones": tzs, "away_days": away}


def reconcile_medications(clinical, entries, as_of):
    """One row per medicine, with every source kept and a status that never guesses.

    Status: active · historical · discontinued · needs review. A historical prescription
    never makes a medicine current; a patient report never overwrites the record; a gap
    in pharmacy fills is shown, not interpreted.
    """
    names = {}
    for c in clinical:
        if c["type"] in ("medication", "prescription", "dispense"):
            names.setdefault(c["text"], []).append(c)
    for e in entries:
        if e["type"] == "medication_report":
            names.setdefault(e["medication"], []).append({**e, "type": "report"})
    out = []
    for name, recs in sorted(names.items()):
        st = [r for r in recs if r["type"] == "medication"]
        rq = [r for r in recs if r["type"] == "prescription"]
        dp = sorted((r for r in recs if r["type"] == "dispense"), key=lambda r: r["when"])
        rp = [r for r in recs if r["type"] == "report"]
        sources, reasons = [], []
        for r in rq:
            sources.append({"kind": "prescribed", "text": f"Prescription {r['record_status']}, written {r['authored']}"
                            + (f", valid until {r['valid_until']}" if r.get("valid_until") else ""), "by": r.get("by")})
        if dp:
            last = dp[-1]
            sources.append({"kind": "dispensed", "text": f"{len(dp)} pharmacy fills, last {last['when']} ({last['days_supply']} days)"})
        for r in st:
            sources.append({"kind": "listed", "text": f"Medication list says {r['record_status']} (as of {r.get('asserted')})"})
        for r in rp:
            sources.append({"kind": "patient_reported", "text": f"You reported: {r['reported_status']} on {r['date']}"})
        record_active = any(r["record_status"] == "active" for r in st + rq)
        record_ended = [r for r in st + rq if r["record_status"] in ("completed", "stopped", "cancelled")]
        if record_ended and not record_active:
            status = "discontinued" if any(r["record_status"] == "stopped" for r in record_ended) else "historical"
            reasons.append("The record marks it as no longer current; an old prescription does not make it current.")
        else:
            status = "active" if record_active else "needs review"
            if any(r["reported_status"] in ("stopped", "not taking") for r in rp):
                status = "needs review"
                reasons.append("The record lists it as active, but you reported stopping it.")
            if dp:
                supply_end = dt.date.fromisoformat(dp[-1]["when"]) + dt.timedelta(days=dp[-1]["days_supply"] or 30)
                if (as_of - supply_end).days > 30:
                    status = "needs review"
                    reasons.append(f"The last fill would have run out around {supply_end.isoformat()}; no fill since.")
        out.append({"name": name, "status": status, "sources": sources, "reasons": reasons,
                    "note": "Confirm with your clinician or pharmacist. The app never suggests starting, stopping or changing a medicine."})
    return out
