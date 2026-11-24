#!/usr/bin/env python3
"""Tests for the Apple Watch guide's teaching scripts, prompt and template.

    python3 scripts/apple_watch_health/test_scripts.py

Standard library only, no network. Each claim the guide makes about the
scripts is checked here: they never sum step sources, they merge overlapping
sleep, they flag partial days, they refuse mixed units, they explain every
failure, and the converter's memory stays flat on a large export.
"""
import csv
import re
import resource
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "articles/apple-watch-health"
CODE = BASE / "code"
SAMPLE = CODE / "sample/export.xml"
FAILS = []


def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        FAILS.append(msg)


def run(script, *args, cwd):
    return subprocess.run([sys.executable, "-I", str(CODE / script), *map(str, args)],
                          cwd=cwd, capture_output=True, text=True)


def rows(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def minutes_union(intervals):
    """Independent check: count distinct minutes covered (not the script's method)."""
    covered = set()
    for a, b in intervals:
        t = a
        while t < b:
            covered.add(t)
            t += timedelta(minutes=1)
    return len(covered)


def main():
    tmp = Path(tempfile.mkdtemp(prefix="awh-test-"))
    # converter on the sample
    r = run("health_to_csv.py", SAMPLE, tmp / "records.csv", cwd=tmp)
    check(r.returncode == 0, "health_to_csv: sample converts")
    recs = rows(tmp / "records.csv")
    check(len(recs) == SAMPLE.read_text().count("<Record ") - 1, "health_to_csv: every valid record written, the damaged one skipped")
    check("skipped 1 sample(s)" in r.stderr and "not a time" in r.stderr, "health_to_csv: names the damaged record")
    check(all(x["unit"] or x["type"].startswith("HKCategory") for x in recs), "health_to_csv: units preserved")
    check(all(x["start"][:10] == x["local_date"] for x in recs), "health_to_csv: local date taken from the original timestamp")
    check({x["utc_offset"] for x in recs} == {"-0500", "+0000"}, "health_to_csv: time-zone offsets preserved")
    # converter errors
    r = run("health_to_csv.py", "missing.xml", "x.csv", cwd=tmp)
    check(r.returncode == 2 and "cannot find" in r.stderr, "health_to_csv: missing file → exit 2 with a hint")
    (tmp / "other.xml").write_text("<ClinicalDocument/>")
    r = run("health_to_csv.py", tmp / "other.xml", tmp / "x.csv", cwd=tmp)
    check(r.returncode == 1 and "does not look like an Apple Health export" in r.stderr, "health_to_csv: wrong root → explained")
    (tmp / "cut.xml").write_text(SAMPLE.read_text()[:1500])
    r = run("health_to_csv.py", tmp / "cut.xml", tmp / "x.csv", cwd=tmp)
    check(r.returncode == 1 and "damaged near line" in r.stderr, "health_to_csv: truncated file → line and column given")
    r = run("health_to_csv.py", cwd=tmp)
    check(r.returncode == 2 and "usage" in r.stderr, "health_to_csv: no arguments → usage")

    # daily summary on the sample
    r = run("daily_summary.py", tmp / "records.csv", tmp / "daily.csv", cwd=tmp)
    check(r.returncode == 0, "daily_summary: sample summarises")
    daily = {x["local_date"]: x for x in rows(tmp / "daily.csv")}
    steps = {}
    for x in recs:
        if x["type"] == "HKQuantityTypeIdentifierStepCount":
            steps.setdefault(x["local_date"], {}).setdefault(x["source"], 0)
            steps[x["local_date"]][x["source"]] += float(x["value"])
    for day, by_src in steps.items():
        got = float(daily[day]["steps"])
        check(got == max(by_src.values()) and got < sum(by_src.values()) or len(by_src) == 1,
              f"daily_summary: {day} steps = one source, never the sum")
    asleep = {"HKCategoryValueSleepAnalysisAsleepCore", "HKCategoryValueSleepAnalysisAsleepDeep",
              "HKCategoryValueSleepAnalysisAsleepREM", "HKCategoryValueSleepAnalysisAsleepUnspecified"}
    nights = {}
    for x in recs:
        if x["type"] == "HKCategoryTypeIdentifierSleepAnalysis" and x["value"] in asleep:
            local = datetime.strptime(x["start"][:19], "%Y-%m-%d %H:%M:%S")
            night = (local - timedelta(hours=12)).date().isoformat()
            nights.setdefault(night, []).append((datetime.strptime(x["start_utc"], "%Y-%m-%dT%H:%M:%SZ"),
                                                 datetime.strptime(x["end_utc"], "%Y-%m-%dT%H:%M:%SZ")))
    for night, iv in nights.items():
        added = sum((b - a).total_seconds() / 60 for a, b in iv)
        got = int(daily[night]["asleep_min_night_of"])
        check(got == minutes_union(iv), f"daily_summary: night of {night} = merged minutes ({got})")
        overlaps = any(a2 < b1 and a1 < b2 for i, (a1, b1) in enumerate(iv) for (a2, b2) in iv[i + 1:])
        if overlaps:
            check(got < added, f"daily_summary: night of {night} overlapping sources not added ({added:.0f} if summed)")
    check(daily[min(daily)]["partial_day"] == "1" and daily[max(daily)]["partial_day"] == "1", "daily_summary: first and last days flagged partial")
    r = run("daily_summary.py", tmp / "records.csv", tmp / "d2.csv", "--priority", "Sample iPhone,Sample Apple Watch", cwd=tmp)
    d2 = {x["local_date"]: x for x in rows(tmp / "d2.csv")}
    check(d2["2026-03-11"]["steps_source"] == "Sample iPhone", "daily_summary: --priority is honoured")
    # daily summary errors
    bad = [dict(x) for x in recs]
    for x in bad:
        if x["type"] == "HKQuantityTypeIdentifierRestingHeartRate":
            x["unit"] = "count/s"
            break
    with open(tmp / "mixed.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(bad[0]))
        w.writeheader(); w.writerows(bad)
    r = run("daily_summary.py", tmp / "mixed.csv", tmp / "x.csv", cwd=tmp)
    check(r.returncode == 1 and "unit(s)" in r.stderr, "daily_summary: mixed units → refused with an explanation")
    (tmp / "cols.csv").write_text("type,value\nx,1\n")
    r = run("daily_summary.py", tmp / "cols.csv", tmp / "x.csv", cwd=tmp)
    check(r.returncode == 1 and "missing column" in r.stderr, "daily_summary: wrong input → names the missing columns")
    r = run("daily_summary.py", tmp / "nope.csv", tmp / "x.csv", cwd=tmp)
    check(r.returncode == 2 and "health_to_csv.py first" in r.stderr, "daily_summary: missing file → exit 2 with a hint")

    # memory: a large generated export must not grow the converter's memory with its size
    def big(n, path):
        rec = ('<Record type="HKQuantityTypeIdentifierHeartRate" sourceName="W" sourceVersion="1" unit="count/min" '
               'creationDate="2026-01-01 00:00:00 +0000" startDate="2026-01-01 00:00:00 +0000" '
               'endDate="2026-01-01 00:00:00 +0000" value="60"><MetadataEntry key="k" value="v"/></Record>\n')
        with open(path, "w") as f:
            f.write('<?xml version="1.0"?>\n<HealthData locale="en_US">\n')
            for _ in range(n):
                f.write(rec)
            f.write("</HealthData>\n")

    def peak_kb(n):
        big(n, tmp / f"big{n}.xml")
        probe = ("import resource,runpy,sys;sys.argv=['x',sys.argv[1],sys.argv[2]];"
                 "runpy.run_path(sys.argv[3],run_name='__main__');"
                 "print(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,file=sys.stderr)")
        r = subprocess.run([sys.executable, "-I", "-c", probe.replace("sys.argv[3]", repr(str(CODE / "health_to_csv.py"))),
                            str(tmp / f"big{n}.xml"), str(tmp / f"big{n}.csv")], capture_output=True, text=True)
        return int(r.stderr.strip().splitlines()[-1])

    small, large = peak_kb(20000), peak_kb(200000)
    check(large < small * 1.5, f"health_to_csv: memory flat as the export grows ten-fold ({small} kB → {large} kB peak)")

    # prompt and clinician template
    prompt = (BASE / "health-analyst-prompt.txt").read_text()
    check(re.findall(r"^STEP (\d+) ", prompt, flags=re.M) == [str(i) for i in range(1, 16)], "prompt: STEP 1 … STEP 15, in order")
    for need in ("SAFETY CHECK", "OUTPUT FORMAT A", "OUTPUT FORMAT B", "CITATIONS", "never invent"):
        check(need.lower() in prompt.lower(), f"prompt: contains {need!r}")
    md = (BASE / "clinician-summary.md").read_text()
    htm = (BASE / "clinician-summary.html").read_text()
    md_heads = [re.sub(r"^\d+\. ", "", h).strip() for h in re.findall(r"^## (.+)$", md, flags=re.M)]
    htm_heads = [re.sub(r"^\d+ · ", "", h).strip() for h in re.findall(r"<h2>(.+?)</h2>", htm)]
    check(md_heads == htm_heads and len(md_heads) == 10, "template: Markdown and printable page have the same ten sections")
    check("not a diagnosis" in md and "not a diagnosis" in htm, "template: says it is not a diagnosis")

    print(f"\n{'FAILED: ' + str(len(FAILS)) if FAILS else 'all passed'}")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
