#!/usr/bin/env python3
"""health_to_csv.py: turn Apple Health's export.xml into one tidy CSV of samples.

A TEACHING TOOL from PaddySpeaks ("Your Apple Watch Knows More About Your Health
Than You Do"). It copies what the export contains; it does not clean, merge or
judge anything. Results are a starting point for your own analysis, not a
validated clinical dataset.

Usage:
    python3 health_to_csv.py export.xml records.csv

Needs only Python 3.8+ (standard library). Memory stays flat even for a
multi-gigabyte export: the file is streamed, and every finished element is
discarded as soon as it has been written.

Output columns
    type          the HealthKit identifier, e.g. HKQuantityTypeIdentifierRestingHeartRate
    source        the device or app that wrote the sample (sourceName)
    source_version
    unit          exactly as exported (count/min, ms, count, …); empty for categories
    value         exactly as exported: a number, or a category such as
                  HKCategoryValueSleepAnalysisAsleepCore
    start, end    the original local timestamps, untouched (e.g. 2026-03-14 07:22:10 -0700)
    utc_offset    the offset in force when the sample was recorded (-0700)
    local_date    the calendar day as you lived it (taken from `start`)
    start_utc, end_utc   ISO 8601 in UTC, for exact ordering and overlap checks
"""
import csv
import os
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

FIELDS = ["type", "source", "source_version", "unit", "value", "start", "end",
          "utc_offset", "local_date", "start_utc", "end_utc"]
STAMP = "%Y-%m-%d %H:%M:%S %z"   # the format Apple Health uses in export.xml
# Elements that can hold many children; we discard each one once it has ended.
BULKY = {"Record", "Workout", "ActivitySummary", "ClinicalRecord", "Correlation"}


def fail(message, code=1):
    print(f"health_to_csv: {message}", file=sys.stderr)
    sys.exit(code)


def parse_stamp(text):
    """Return an aware datetime, or None if the text is not an Apple Health timestamp."""
    try:
        return datetime.strptime(text, STAMP)
    except (TypeError, ValueError):
        return None


def utc_iso(moment):
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def convert(src, out):
    if not os.path.isfile(src):
        fail(f"cannot find '{src}'. Unzip the export first; the file is "
             "apple_health_export/export.xml.", 2)
    written = skipped = 0
    examples = []
    try:
        events = ET.iterparse(src, events=("start", "end"))
        _, root = next(events)                      # the first start event is the root
        if root.tag != "HealthData":
            fail(f"'{src}' does not look like an Apple Health export: the root "
                 f"element is <{root.tag}>, expected <HealthData>. Did you pick "
                 "export_cda.xml by mistake?")
        with open(out, "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=FIELDS)
            writer.writeheader()
            for event, el in events:
                if event != "end":
                    continue
                if el.tag == "Record":
                    start, end = parse_stamp(el.get("startDate")), parse_stamp(el.get("endDate"))
                    kind = el.get("type", "")
                    if not kind or start is None or end is None or end < start:
                        skipped += 1
                        if len(examples) < 3:
                            examples.append(f"type={kind or '?'} start={el.get('startDate')!r} "
                                            f"end={el.get('endDate')!r}")
                    else:
                        raw_start = el.get("startDate")
                        writer.writerow({
                            "type": kind,
                            "source": el.get("sourceName", ""),
                            "source_version": el.get("sourceVersion", ""),
                            "unit": el.get("unit", ""),
                            "value": el.get("value", ""),
                            "start": raw_start,
                            "end": el.get("endDate"),
                            "utc_offset": raw_start[-5:],
                            "local_date": raw_start[:10],
                            "start_utc": utc_iso(start),
                            "end_utc": utc_iso(end),
                        })
                        written += 1
                if el.tag in BULKY:
                    root.clear()                    # drop everything already processed
    except ET.ParseError as err:
        line, col = err.position
        fail(f"the XML is damaged near line {line}, column {col} ({err}). The "
             "export may have been cut short; export it again from the Health app.")
    except StopIteration:
        fail(f"'{src}' is empty.")
    print(f"wrote {written} samples to {out}")
    if skipped:
        print(f"skipped {skipped} sample(s) with a missing type or an unreadable or "
              f"reversed timestamp, e.g. {examples[0]}", file=sys.stderr)
    return written, skipped


if __name__ == "__main__":
    if len(sys.argv) != 3:
        fail("usage: python3 health_to_csv.py export.xml records.csv", 2)
    convert(sys.argv[1], sys.argv[2])
