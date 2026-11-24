#!/usr/bin/env python3
"""daily_summary.py: one row per day from records.csv (made by health_to_csv.py).

A TEACHING APPROXIMATION from PaddySpeaks. It shows the decisions a careful
analysis has to make; it is not a validated analytical result. Where Apple's
own HealthKit statistics are available (the Health app's charts, or an app that
uses HKStatisticsCollectionQuery), they merge sources minute by minute and are
the better number for steps and energy.

Usage:
    python3 daily_summary.py records.csv daily.csv
    python3 daily_summary.py records.csv daily.csv --priority "My Apple Watch,My iPhone"

Rules it applies (each one is a choice; change it if your situation differs)
  * Steps are never summed across sources (iPhone and Watch count the same steps).
    With --priority, each day uses the first listed source that has data; without
    it, the single source with the largest total that day.
  * Resting heart rate and HRV (SDNN) are averaged per local day; the number of
    HRV samples is reported because HRV is sampled irregularly.
  * Sleep belongs to the night it began: anything starting between noon on day D
    and noon on day D+1 counts towards "the night of D". Overlapping asleep
    intervals from several sources are merged, never added. "In bed" is not sleep.
  * wear_hours counts the hours of each day with at least one heart-rate sample: a
    rough proxy for how long the watch was worn.
  * The first and last day of the export are flagged partial_day=1; leave them out
    of averages.
  * A measure that arrives in more than one unit stops the run with an error rather
    than mixing, say, kilograms and pounds.
"""
import csv
import sys
from collections import defaultdict
from datetime import datetime, timedelta

STEPS = "HKQuantityTypeIdentifierStepCount"
RESTING = "HKQuantityTypeIdentifierRestingHeartRate"
HRV = "HKQuantityTypeIdentifierHeartRateVariabilitySDNN"
HEART = "HKQuantityTypeIdentifierHeartRate"
SLEEP = "HKCategoryTypeIdentifierSleepAnalysis"
ASLEEP = {"HKCategoryValueSleepAnalysisAsleep",            # older exports
          "HKCategoryValueSleepAnalysisAsleepUnspecified",
          "HKCategoryValueSleepAnalysisAsleepCore",
          "HKCategoryValueSleepAnalysisAsleepDeep",
          "HKCategoryValueSleepAnalysisAsleepREM"}
EXPECTED_UNIT = {STEPS: "count", RESTING: "count/min", HRV: "ms", HEART: "count/min"}
NEEDED = {"type", "source", "unit", "value", "start", "local_date", "start_utc", "end_utc"}
OUT = ["local_date", "partial_day", "wear_hours", "steps", "steps_source",
       "resting_hr_bpm", "hrv_sdnn_ms", "hrv_samples", "asleep_min_night_of", "sleep_sources"]


def fail(message, code=1):
    print(f"daily_summary: {message}", file=sys.stderr)
    sys.exit(code)


def utc(text):
    return datetime.strptime(text, "%Y-%m-%dT%H:%M:%SZ")


def merged_minutes(intervals):
    """Length of the union of [start, end) intervals, in minutes."""
    total, cur_start, cur_end = timedelta(0), None, None
    for start, end in sorted(intervals):
        if cur_end is None or start > cur_end:
            if cur_end is not None:
                total += cur_end - cur_start
            cur_start, cur_end = start, end
        else:
            cur_end = max(cur_end, end)
    if cur_end is not None:
        total += cur_end - cur_start
    return round(total.total_seconds() / 60)


def summarize(src, out, priority):
    steps = defaultdict(lambda: defaultdict(float))       # day -> source -> steps
    resting, hrv = defaultdict(list), defaultdict(list)
    wear = defaultdict(set)                               # day -> hours with a heart-rate sample
    sleep, sleep_src = defaultdict(list), defaultdict(set)
    units, days, ignored = defaultdict(set), set(), 0
    try:
        handle = open(src, newline="", encoding="utf-8")
    except OSError as err:
        fail(f"cannot open '{src}': {err.strerror}. Run health_to_csv.py first.", 2)
    with handle:
        reader = csv.DictReader(handle)
        missing = NEEDED - set(reader.fieldnames or [])
        if missing:
            fail(f"'{src}' is missing column(s) {', '.join(sorted(missing))}; "
                 "make it with health_to_csv.py from this article.")
        for n, row in enumerate(reader, start=2):
            kind, day = row["type"], row["local_date"]
            days.add(day)
            if kind in EXPECTED_UNIT:
                units[kind].add(row["unit"])
            try:
                if kind == STEPS:
                    steps[day][row["source"]] += float(row["value"])
                elif kind == RESTING:
                    resting[day].append(float(row["value"]))
                elif kind == HRV:
                    hrv[day].append(float(row["value"]))
                elif kind == HEART:
                    wear[day].add(row["start"][11:13])
                elif kind == SLEEP and row["value"] in ASLEEP:
                    local_start = datetime.strptime(row["start"][:19], "%Y-%m-%d %H:%M:%S")
                    night = (local_start - timedelta(hours=12)).date().isoformat()
                    sleep[night].append((utc(row["start_utc"]), utc(row["end_utc"])))
                    sleep_src[night].add(row["source"])
                else:
                    ignored += 1
            except ValueError:
                fail(f"line {n} of '{src}': value {row['value']!r} for {kind} is not a number.")
    for kind, seen in units.items():
        if seen != {EXPECTED_UNIT[kind]}:
            fail(f"{kind} arrives in unit(s) {sorted(seen)}; expected only "
                 f"'{EXPECTED_UNIT[kind]}'. Convert before summarizing.")
    if not days:
        fail(f"'{src}' has no samples.")
    first, last = min(days), max(days)
    rank = {name: i for i, name in enumerate(priority)}
    with open(out, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUT)
        writer.writeheader()
        for day in sorted(days | set(sleep)):
            by_source = steps.get(day, {})
            pick = ""
            if by_source:
                listed = [s for s in by_source if s in rank]
                pick = (min(listed, key=rank.get) if listed
                        else max(by_source, key=by_source.get))
            writer.writerow({
                "local_date": day,
                "partial_day": int(day in (first, last)),
                "wear_hours": len(wear.get(day, ())),
                "steps": round(by_source[pick]) if pick else "",
                "steps_source": pick,
                "resting_hr_bpm": round(sum(resting[day]) / len(resting[day]), 1) if resting.get(day) else "",
                "hrv_sdnn_ms": round(sum(hrv[day]) / len(hrv[day]), 1) if hrv.get(day) else "",
                "hrv_samples": len(hrv.get(day, ())),
                "asleep_min_night_of": merged_minutes(sleep[day]) if sleep.get(day) else "",
                "sleep_sources": len(sleep_src.get(day, ())),
            })
    print(f"wrote {len(days | set(sleep))} days to {out} "
          f"({ignored} sample(s) of other types, and \"in bed\" sleep, left out)")


if __name__ == "__main__":
    args = sys.argv[1:]
    prio = []
    if "--priority" in args:
        i = args.index("--priority")
        if i + 1 >= len(args):
            fail("--priority needs a comma-separated list of source names", 2)
        prio = [p.strip() for p in args[i + 1].split(",") if p.strip()]
        del args[i:i + 2]
    if len(args) != 2:
        fail("usage: python3 daily_summary.py records.csv daily.csv [--priority \"A,B\"]", 2)
    summarize(args[0], args[1], prio)
