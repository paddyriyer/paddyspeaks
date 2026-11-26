"""Seeded synthetic personas, emitted in the SOURCE formats a real import sees.

Nothing here is a real person or a real measurement. Each persona is produced
from a documented seed as a set of source files, exactly as an importer would
receive them:

  apple_export.xml   Apple Health "Export All Health Data" shape (export.xml)
  ring.csv           a third-party ring's CSV (HRV as RMSSD, not SDNN)
  cuff.csv           a validated upper-arm blood-pressure cuff's CSV export
  scale.csv          a connected scale's CSV (some in lb)
  cgm.csv            a 14-day continuous glucose monitor wear (mg/dL)
  records.json       a patient-authorized FHIR R4 Bundle (labs, conditions,
                     medication statements, a clinician-set goal)
  entries.json       things the person typed in (goals, symptoms, reports)

Data problems are injected on purpose, because the importer must survive them:
a month imported twice, a week in another time zone, pounds and kilograms,
an HbA1c reported in IFCC units, two devices disagreeing about resting heart
rate, implausible values, gaps when the watch was not worn, a medication the
record calls active that the person says they stopped, and a lab result old
enough to be stale.
"""
from __future__ import annotations

import datetime as dt
import json
import math
import random
from dataclasses import dataclass, field
from xml.sax.saxutils import quoteattr
from zoneinfo import ZoneInfo

AS_OF = dt.date(2026, 11, 15)          # the demo's "today"; fixed for reproducibility
DAYS = 730                              # two years of history
START = AS_OF - dt.timedelta(days=DAYS - 1)
EXPORTED_AT = "2026-11-15 08:00:00"


@dataclass
class Persona:
    id: str
    name: str
    age: int
    sex_category: str          # the reference category a clinician would use; "female" | "male"
    home_tz: str
    seed: int
    headline: str
    story: str
    goals: list = field(default_factory=list)


PERSONAS = [
    Persona("a", "Alex", 41, "female", "America/Los_Angeles", 1101,
            "Generally healthy, moderately active",
            "Wants better cardio fitness and a steadier routine. Walks a hill loop most mornings and started running in March 2026.",
            ["cardio_fitness", "activity_adherence", "sleep_consistency"]),
    Persona("b", "Ben", 56, "male", "America/New_York", 2202,
            "Managing hypertension",
            "Diagnosed with hypertension in 2024. Measures at home with a validated upper-arm cuff and follows a walking plan his clinician set.",
            ["blood_pressure", "weight_management", "activity_adherence"]),
    Persona("c", "Carmen", 49, "female", "America/Chicago", 3303,
            "Managing prediabetes",
            "Told she has prediabetes in January 2025. Has periodic HbA1c tests, wore a glucose sensor for two weeks, and is building an activity habit.",
            ["glucose", "weight_management", "activity_adherence"]),
    Persona("d", "Dorothy", 74, "female", "America/Phoenix", 4404,
            "Older adult focused on mobility",
            "Wants to keep walking independently. Her watch and phone track walking speed and steadiness; she did not wear the watch for three weeks in February.",
            ["mobility", "activity_adherence", "sleep_consistency"]),
    Persona("e", "Eli", 33, "male", "America/Los_Angeles", 5505,
            "Too little data to interpret",
            "Started wearing a watch in late September 2026 and often forgets it. No labs, no other devices. The honest answer to most questions is 'not enough data yet'.",
            ["sleep_consistency", "activity_adherence"]),
]


def days():
    for i in range(DAYS):
        yield START + dt.timedelta(days=i)


def frac(d: dt.date) -> float:
    return (d - START).days / (DAYS - 1)


def smooth(t: float) -> float:
    return t * t * (3 - 2 * t)


class AR1:
    """Autocorrelated noise: today's wobble resembles yesterday's."""

    def __init__(self, rng: random.Random, sd: float, rho: float = 0.7):
        self.rng, self.sd, self.rho, self.x = rng, sd, rho, 0.0

    def __call__(self) -> float:
        self.x = self.rho * self.x + math.sqrt(1 - self.rho ** 2) * self.rng.gauss(0, self.sd)
        return self.x


def stamp(local: dt.datetime) -> str:
    """Apple export timestamp: local wall time plus that moment's UTC offset."""
    off = local.utcoffset()
    sign = "-" if off < dt.timedelta(0) else "+"
    mins = abs(int(off.total_seconds() // 60))
    return local.strftime("%Y-%m-%d %H:%M:%S") + f" {sign}{mins // 60:02d}{mins % 60:02d}"


def iso(local: dt.datetime) -> str:
    return local.isoformat(timespec="seconds")


# ---------------------------------------------------------------- per persona

def generate(p: Persona) -> dict:
    """Return {filename: text} for one persona's source files."""
    rng = random.Random(p.seed)
    home = ZoneInfo(p.home_tz)
    tokyo = ZoneInfo("Asia/Tokyo")
    rec: list[str] = []          # <Record> / <Workout> lines for export.xml
    ring, cuff, scale, cgm = [], [], [], []
    fhir: list[dict] = []
    entries: list[dict] = []

    n = {k: AR1(rng, s) for k, s in
         [("rhr", 1.3), ("hrv", 4.0), ("steps", 1500), ("ex", 7), ("sleep", 0.35),
          ("ws", 0.025), ("sys", 4.5), ("dia", 3.0), ("wt", 0.35), ("vo2", 0.5)]}

    def zone_for(d: dt.date) -> ZoneInfo:
        if p.id == "a" and dt.date(2026, 4, 6) <= d <= dt.date(2026, 4, 13):
            return tokyo            # a week in Tokyo: the day as lived, not as in California
        return home

    def worn(d: dt.date) -> bool:
        if p.id == "d" and dt.date(2026, 2, 2) <= d <= dt.date(2026, 2, 22):
            return False            # three weeks without the watch
        if p.id == "e":
            if d < dt.date(2026, 9, 25):
                return False
            return rng.random() < 0.45
        return rng.random() < 0.96

    def q(type_, unit, value, local, minutes=1, source="Apple Watch", device="Watch"):
        end = local + dt.timedelta(minutes=minutes)
        rec.append(
            f'<Record type="{type_}" sourceName={quoteattr(source)} sourceVersion="27.1" '
            f'device={quoteattr(device)} unit={quoteattr(unit)} creationDate="{stamp(end)}" '
            f'startDate="{stamp(local)}" endDate="{stamp(end)}" value="{value}"/>')

    vo2_last = None
    for d in days():
        t = frac(d)
        s = smooth(t)
        z = zone_for(d)
        wd = d.weekday()
        morning = dt.datetime.combine(d, dt.time(6, 40), z)
        if not worn(d):
            continue

        # --- trajectories (fictional) -----------------------------------
        if p.id == "a":
            rhr = 62 - 4 * s; hrv = 38 + 6 * s; steps = 7600 + 1500 * s; ex = 24 + 12 * s
            sleep = 6.75 + 0.35 * s; vo2 = 33.4 + 2.7 * s; ws = 1.36
            if dt.date(2026, 9, 8) <= d <= dt.date(2026, 9, 21):   # a cold: context for a signal
                rhr += 5; hrv -= 7; steps -= 2500; ex -= 15
        elif p.id == "b":
            rhr = 71 - 4 * s; hrv = 29 + 3 * s; steps = 5400 + 2100 * s; ex = 14 + 16 * s
            sleep = 6.6 + 0.2 * s; vo2 = 30.0 + 1.4 * s; ws = 1.27
        elif p.id == "c":
            rhr = 68 - 3 * s; hrv = 33 + 3 * s; steps = 6000 + 2600 * s; ex = 15 + 17 * s
            sleep = 6.4 + 0.5 * s; vo2 = 28.5 + 1.8 * s; ws = 1.30
        elif p.id == "d":
            rhr = 66 + 1 * s; hrv = 24 - 1 * s; steps = 4600 - 700 * s; ex = 12 - 3 * s
            sleep = 7.3 - 0.1 * s; vo2 = None; ws = 1.06 - 0.09 * s
        else:
            rhr = 64; hrv = 41; steps = 6200; ex = 18; sleep = 6.2; vo2 = None; ws = 1.38
        weekend = wd >= 5

        # resting HR, HRV (SDNN), walking speed, steps, exercise minutes
        q("HKQuantityTypeIdentifierRestingHeartRate", "count/min", round(rhr + n["rhr"]()), morning)
        q("HKQuantityTypeIdentifierHeartRateVariabilitySDNN", "ms",
          round(max(8, hrv + n["hrv"]()), 1), morning - dt.timedelta(hours=3))
        if rng.random() < 0.85:
            q("HKQuantityTypeIdentifierWalkingSpeed", "km/hr",
              round(max(0.4, ws + n["ws"]()) * 3.6, 2),
              morning + dt.timedelta(hours=5), source="iPhone", device="iPhone")
        total = max(300, steps + n["steps"]() * steps / 7500 + (900 if weekend and p.id in "ac" else 0))
        for k, share in enumerate((0.3, 0.45, 0.25)):
            q("HKQuantityTypeIdentifierStepCount", "count", int(total * share),
              morning + dt.timedelta(hours=2 + 4 * k), minutes=50)
        q("HKQuantityTypeIdentifierAppleExerciseTime", "min",
          max(0, round(ex + n["ex"]())), morning + dt.timedelta(hours=11), minutes=1)

        # sleep: one "asleep" interval ending this morning
        sl = max(3.5, sleep + n["sleep"]() + (0.4 if weekend else 0))
        if p.id == "e":
            sl += rng.choice((-1.2, -0.6, 0, 0.5, 1.1))   # irregular
        wake = dt.datetime.combine(d, dt.time(6, 30), z) + dt.timedelta(minutes=rng.randint(-25, 35))
        rec.append(
            f'<Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" '
            f'sourceVersion="27.1" device="Watch" creationDate="{stamp(wake)}" '
            f'startDate="{stamp(wake - dt.timedelta(hours=sl))}" endDate="{stamp(wake)}" '
            f'value="HKCategoryValueSleepAnalysisAsleepUnspecified"/>')

        # implausible values the validator must reject
        if p.id == "b" and d in (dt.date(2025, 7, 4), dt.date(2026, 1, 19)):
            q("HKQuantityTypeIdentifierRestingHeartRate", "count/min", 0, morning + dt.timedelta(minutes=5))

        # walking steadiness for Dorothy, weekly
        if p.id == "d" and wd == 0:
            st = 62 - 18 * s + n["ws"]() * 200
            q("HKQuantityTypeIdentifierAppleWalkingSteadiness", "%", round(max(5, min(99, st)), 0),
              morning + dt.timedelta(hours=3), source="iPhone", device="iPhone")

        # workouts
        did = []
        if p.id == "a":
            if wd in (0, 2, 4, 5) and rng.random() < 0.82:
                did.append(("Walking", "hill"))
            if d >= dt.date(2026, 3, 2) and wd == 6 and rng.random() < 0.85:
                did.append(("Running", "flat"))
        elif p.id == "b":
            if wd in (0, 1, 3, 4, 6) and rng.random() < 0.35 + 0.45 * s:
                did.append(("Walking", "flat"))
        elif p.id == "c":
            if wd in (1, 3, 5) and rng.random() < 0.4 + 0.45 * s:
                did.append(("Walking", "flat"))
            if wd == 0 and t > 0.4 and rng.random() < 0.6:
                did.append(("Cycling", "flat"))
        elif p.id == "d":
            if wd in (1, 4) and rng.random() < 0.55 - 0.15 * s:
                did.append(("Walking", "flat"))
        elif p.id == "e":
            if rng.random() < 0.15:
                did.append(("Walking", "flat"))
        for kind, route in did:
            start = dt.datetime.combine(d, dt.time(7, 5), z) + dt.timedelta(minutes=rng.randint(-20, 40))
            if kind == "Walking":
                dist = (5.2 if route == "hill" else 4.0) * (1 if rng.random() < 0.8 else 0.6)
                base_speed = {"a": 5.5 + 0.5 * s, "b": 5.0 + 0.4 * s, "c": 5.1 + 0.4 * s,
                              "d": 3.9 - 0.3 * s, "e": 5.3}[p.id]
                speed = max(2.5, base_speed + rng.gauss(0, 0.18))
                hr = 92 + 9 * (speed - 5) + (rhr - 60) * 0.6 - (5 * s if p.id in "abc" else 0) + rng.gauss(0, 3)
                elev = 38 if route == "hill" else 8
            elif kind == "Running":
                dist = round(rng.choice((4.0, 5.0, 5.0, 6.0)), 1)
                speed = 9.2 + 0.6 * s + rng.gauss(0, 0.3)
                hr = 150 + 6 * (speed - 9.5) - 4 * s + rng.gauss(0, 3)
                elev = 12
            else:
                dist = round(rng.uniform(12, 18), 1)
                speed = 17.5 + rng.gauss(0, 1)
                hr = 124 + rng.gauss(0, 4)
                elev = 20
            dur = dist / speed * 60
            effort = max(1, min(10, round((hr - 70) / 12 + rng.gauss(0, 0.6))))
            end = start + dt.timedelta(minutes=dur)
            unit_dist = "HKQuantityTypeIdentifierDistanceCycling" if kind == "Cycling" else "HKQuantityTypeIdentifierDistanceWalkingRunning"
            rec.append(
                f'<Workout workoutActivityType="HKWorkoutActivityType{kind}" duration="{dur:.2f}" '
                f'durationUnit="min" sourceName="Apple Watch" sourceVersion="27.1" device="Watch" '
                f'creationDate="{stamp(end)}" startDate="{stamp(start)}" endDate="{stamp(end)}">'
                f'<MetadataEntry key="HKElevationAscended" value="{elev * 100} cm"/>'
                f'<MetadataEntry key="HKIndoorWorkout" value="0"/>'
                f'<MetadataEntry key="EffortRating" value="{effort}"/>'
                f'<WorkoutStatistics type="{unit_dist}" startDate="{stamp(start)}" endDate="{stamp(end)}" sum="{dist:.2f}" unit="km"/>'
                f'<WorkoutStatistics type="HKQuantityTypeIdentifierHeartRate" startDate="{stamp(start)}" endDate="{stamp(end)}" average="{hr:.0f}" unit="count/min"/>'
                f'</Workout>')
            # cardio fitness estimates follow outdoor walks and runs, not every one
            if vo2 is not None and kind in ("Walking", "Running") and (vo2_last is None or (d - vo2_last).days >= 5):
                vo2_last = d
                q("HKQuantityTypeIdentifierVO2Max", "mL/min·kg", round(vo2 + n["vo2"]() * 1.4, 2), end)

        # --- other devices ------------------------------------------------
        if p.id == "a" and dt.date(2026, 3, 1) <= d <= dt.date(2026, 5, 31):
            # a ring, worn for three months: RMSSD (not SDNN) and its own resting HR
            ring.append(f"{d.isoformat()},{max(10, hrv * 1.35 + rng.gauss(0, 6)):.0f},"
                        f"{rhr + n['rhr']() - 2 + rng.choice((0, 0, 0, 7)):.0f}")
        if p.id == "b" and wd in (0, 2, 3, 5) and rng.random() < 0.9:
            # morning home readings, validated cuff; recent drift upward over the last 3 weeks
            drift = 8 if d >= AS_OF - dt.timedelta(days=21) else 0
            sy = 143 - 13 * s + drift + n["sys"]()
            di = 89 - 7 * s + drift * 0.5 + n["dia"]()
            when = dt.datetime.combine(d, dt.time(7, 10), z)
            cuff.append(f"{iso(when)},{sy:.0f},{di:.0f},{rhr + 4 + rng.gauss(0, 3):.0f},Upper-arm cuff (validated, synthetic)")
        if p.id == "d" and wd == 3 and rng.random() < 0.6:
            when = dt.datetime.combine(d, dt.time(9, 0), z)
            cuff.append(f"{iso(when)},{128 + rng.gauss(0, 6):.0f},{74 + rng.gauss(0, 4):.0f},{rhr + rng.gauss(0, 3):.0f},Upper-arm cuff (validated, synthetic)")
        if p.id in "bc" and wd in (0, 4) and rng.random() < 0.85:
            when = dt.datetime.combine(d, dt.time(6, 55), z)
            if p.id == "b":
                lb = 214 - 10 * s + n["wt"]() * 2.2
                scale.append(f"{iso(when)},{lb:.1f},lb")
            else:
                kg = 82 - 4 * s + n["wt"]()
                scale.append(f"{iso(when)},{kg:.1f},kg")

    # Alex re-imported February 2026: every record of that month arrives twice
    if p.id == "a":
        feb = [r for r in rec if 'startDate="2026-02-' in r]
        rec.extend(feb)

    # Carmen's two-week CGM wear, every 15 minutes, mg/dL
    if p.id == "c":
        z = ZoneInfo(p.home_tz)
        cur = dt.datetime(2026, 6, 1, 0, 0, tzinfo=z)
        g = 102.0
        while cur < dt.datetime(2026, 6, 15, 0, 0, tzinfo=z):
            h = cur.hour + cur.minute / 60
            meal = sum(38 * math.exp(-((h - m) ** 2) / 0.9) for m in (8, 13, 19.5))
            g = 0.8 * g + 0.2 * (98 + meal) + rng.gauss(0, 3)
            cgm.append(f"{iso(cur)},{g:.0f}")
            cur += dt.timedelta(minutes=15)

    # --- patient-authorized clinical records (FHIR R4) ---------------------
    def obs(code, display, value, unit, ucum, when, system="http://loinc.org", status="final", org="Synthetic Clinic Lab"):
        return {"resourceType": "Observation", "status": status,
                "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "laboratory"}]}],
                "code": {"coding": [{"system": system, "code": code, "display": display}], "text": display},
                "effectiveDateTime": when, "issued": when,
                "performer": [{"display": org}],
                "valueQuantity": {"value": value, "unit": unit, "system": "http://unitsofmeasure.org", "code": ucum}}

    if p.id == "b":
        fhir += [
            {"resourceType": "Condition", "clinicalStatus": {"coding": [{"code": "active"}]},
             "verificationStatus": {"coding": [{"code": "confirmed"}]},
             "code": {"text": "Essential hypertension", "coding": [{"system": "http://snomed.info/sct", "code": "59621000", "display": "Essential hypertension"}]},
             "onsetDateTime": "2024-06-12"},
            {"resourceType": "MedicationStatement", "status": "active",
             "medicationCodeableConcept": {"text": "Lisinopril 10 mg tablet"},
             "effectivePeriod": {"start": "2024-06-12"}, "dateAsserted": "2025-09-30"},
            {"resourceType": "Goal", "lifecycleStatus": "active",
             "description": {"text": "Home blood pressure below 130/80 mmHg (set by clinician)"},
             "target": [{"measure": {"text": "Systolic"}, "detailQuantity": {"value": 130, "unit": "mmHg"}},
                        {"measure": {"text": "Diastolic"}, "detailQuantity": {"value": 80, "unit": "mmHg"}}],
             "expressedBy": {"display": "Synthetic Clinic, primary care"}, "startDate": "2025-09-30"},
            {"resourceType": "CarePlan", "status": "active", "intent": "plan",
             "title": "Activity plan: brisk walking about 30 minutes, 5 days a week (set by clinician)",
             "period": {"start": "2025-09-30"}},
        ]
        entries.append({"type": "medication_report", "date": "2026-08-20",
                        "text": "I stopped taking lisinopril in August because it made me cough.",
                        "medication": "Lisinopril 10 mg tablet", "reported_status": "stopped"})
        entries.append({"type": "symptom", "date": "2026-10-30", "text": "Mild headache in the morning", "severity": "mild"})
    if p.id == "c":
        fhir += [
            {"resourceType": "Condition", "clinicalStatus": {"coding": [{"code": "active"}]},
             "verificationStatus": {"coding": [{"code": "confirmed"}]},
             "code": {"text": "Prediabetes", "coding": [{"system": "http://snomed.info/sct", "code": "714628002", "display": "Prediabetes"}]},
             "onsetDateTime": "2025-01-10"},
            obs("4548-4", "Hemoglobin A1c/Hemoglobin.total in Blood", 6.1, "%", "%", "2025-01-10"),
            obs("4548-4", "Hemoglobin A1c/Hemoglobin.total in Blood", 6.0, "%", "%", "2025-06-04"),
            obs("4548-4", "Hemoglobin A1c/Hemoglobin.total in Blood", 5.9, "%", "%", "2025-11-20"),
            obs("59261-8", "Hemoglobin A1c/Hemoglobin.total in Blood by IFCC protocol", 41, "mmol/mol", "mmol/mol", "2026-04-14", org="Synthetic Regional Lab"),
            obs("4548-4", "Hemoglobin A1c/Hemoglobin.total in Blood", 5.8, "%", "%", "2026-09-22"),
            obs("13457-7", "Cholesterol in LDL [Mass/volume] in Serum or Plasma by calculation", 131, "mg/dL", "mg/dL", "2024-09-03"),
            {"resourceType": "Goal", "lifecycleStatus": "active",
             "description": {"text": "Discuss HbA1c at each visit; aim to stay below the diabetes range (target to be set with clinician)"},
             "expressedBy": {"display": "Synthetic Clinic, primary care"}, "startDate": "2025-01-10"},
        ]
        entries.append({"type": "program", "date": "2025-02-01", "text": "Joined a year-long lifestyle-change program (self-reported)."})
    if p.id == "d":
        entries.append({"type": "history", "date": "2026-03-02", "text": "Tripped on a curb in February; no injury (self-reported)."})
        entries.append({"type": "restriction", "date": "2025-05-10", "text": "Physical therapist suggested walking on even ground (self-reported)."})
    if p.id == "a":
        entries.append({"type": "symptom", "date": "2026-09-08", "text": "Cold: sore throat, tired", "severity": "mild"})
        entries.append({"type": "symptom", "date": "2026-09-19", "text": "Cold mostly gone", "severity": "mild"})
        entries.append({"type": "travel", "date": "2026-04-06", "text": "Trip to Tokyo until April 13"})

    for g in p.goals:
        entries.append({"type": "goal", "date": "2025-01-01" if p.id != "e" else "2026-09-25", "goal": g})

    files = {}
    head = (f'<?xml version="1.0" encoding="UTF-8"?>\n<HealthData locale="en_US">\n'
            f' <ExportDate value="{EXPORTED_AT} -0800"/>\n'
            f' <Me HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSex{p.sex_category.capitalize()}"/>\n')
    files["apple_export.xml"] = head + "\n".join(" " + r for r in rec) + "\n</HealthData>\n"
    if ring:
        files["ring.csv"] = "date,hrv_rmssd_ms,resting_hr_bpm\n" + "\n".join(ring) + "\n"
    if cuff:
        files["cuff.csv"] = "measured_at,systolic_mmHg,diastolic_mmHg,pulse_bpm,device\n" + "\n".join(cuff) + "\n"
    if scale:
        files["scale.csv"] = "measured_at,weight,unit\n" + "\n".join(scale) + "\n"
    if cgm:
        files["cgm.csv"] = "timestamp,glucose_mg_dl\n" + "\n".join(cgm) + "\n"
    if fhir:
        files["records.json"] = json.dumps({"resourceType": "Bundle", "type": "collection",
                                            "entry": [{"resource": r} for r in fhir]}, indent=1)
    files["entries.json"] = json.dumps(entries, indent=1)
    return files
