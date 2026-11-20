"""Generate the SYNTHETIC data behind the Boardroom Problem mock.

The same fictional company as the Revenue Problem (Nº 42), four weeks later.
Product's Gross Order Value dashboard sums purchase EVENTS. Over the last two
weeks three things leaked into it, none of them on purpose:

  1. checkout_v2 (an A/B test) — from 10 Nov the treatment arm's new
     confirmation page re-fires order_completed for some orders: duplicate
     events, same order id.
  2. A load test run against production on 12 Nov with synthetic accounts.
  3. A pipeline backfill that replayed every event of 14 Nov a second time.

and one thing that is real and must NOT be filtered out:

  4. pricing_t (another A/B test) — arm B pays 10% less and buys a little more.

The generator works at order level, then aggregates to a small cube the page
filters in the browser. Every figure the mock states is computed here and
written to `expected`; the page's engine is tested against it.

    python3 gen.py           # write interview.app/design/boardroom/data.json
    python3 gen.py --check   # exit 1 if data.json is stale
"""
import json
import random
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "interview.app" / "design" / "boardroom" / "data.json"

SEED = 20261119
START, DAYS = date(2026, 10, 22), 28            # 22 Oct .. 18 Nov
PRIOR = [START + timedelta(d) for d in range(14)]          # 22 Oct .. 4 Nov
LAST = [START + timedelta(d) for d in range(14, 28)]       # 5 Nov .. 18 Nov
CHECKOUT_START, BUG_START = date(2026, 10, 29), date(2026, 11, 10)
PRICING_START = date(2026, 11, 3)
LOADTEST_DAY, REPLAY_DAY = date(2026, 11, 12), date(2026, 11, 14)
DUP_RATE = 0.28                                  # treatment orders re-fired after the bug


def generate(rng: random.Random):
    """Yield one event per row: (day, checkout_arm, pricing_arm, account, source, cents, is_dup)."""
    events = []
    for i in range(DAYS):
        day = START + timedelta(i)
        weekend = day.weekday() >= 5
        base = 4300 * (1 + 0.002 * i) * (1.12 if weekend else 1.0)
        n = int(rng.gauss(base, 60))
        live_today = []
        for _ in range(n):
            u = rng.random()
            co = "none"
            if day >= CHECKOUT_START:
                co = "control" if u < 0.20 else "treatment" if u < 0.40 else "none"
            v = rng.random()
            pr = "none"
            if day >= PRICING_START:
                pr = "A" if v < 0.10 else "B" if v < 0.20 else "none"
            cents = int(rng.lognormvariate(3.35, 0.45) * 100)      # ~ $31 median
            if pr == "B":
                cents = int(cents * 0.90)                           # the real discount
            live_today.append((co, pr, cents))
            # real effects: treatment +1% orders, pricing B +4% orders
            extra = (co == "treatment" and rng.random() < 0.01) or (pr == "B" and rng.random() < 0.04)
            if extra:
                live_today.append((co, pr, int(rng.lognormvariate(3.35, 0.45) * 100 * (0.9 if pr == "B" else 1))))
        for co, pr, cents in live_today:
            events.append((day, co, pr, "customer", "live", cents, False))
            if co == "treatment" and day >= BUG_START and rng.random() < DUP_RATE:
                events.append((day, co, pr, "customer", "live", cents, True))     # re-fired
        if day == LOADTEST_DAY:
            for _ in range(2400):
                co = rng.choice(["control", "treatment", "none", "none", "none"])
                events.append((day, co, "none", "loadtest", "live", rng.randint(2000, 6000), False))
        if day == REPLAY_DAY:
            for e in [e for e in events if e[0] == day and e[4] == "live"]:
                events.append((day, e[1], e[2], e[3], "replay", e[5], True))     # same ids again
    return events


def build():
    rng = random.Random(SEED)
    events = generate(rng)
    cube = defaultdict(lambda: [0, 0, 0, 0])          # events, dup_events, cents, dup_cents
    for day, co, pr, acct, src, cents, dup in events:
        c = cube[(day.isoformat(), co, pr, acct, src)]
        c[0] += 1
        c[2] += cents
        if dup:
            c[1] += 1
            c[3] += cents
    rows = [[k[0], k[1], k[2], k[3], k[4], *v] for k, v in sorted(cube.items())]

    # ---- expected figures, computed from the same rows the browser gets ----
    def total(pred, dedup=False):
        return sum((r[7] - r[8]) if dedup else r[7] for r in rows if pred(r))

    last = {d.isoformat() for d in LAST}
    prior = {d.isoformat() for d in PRIOR}
    in_last = lambda r: r[0] in last
    in_prior = lambda r: r[0] in prior
    clean = lambda r: r[3] == "customer" and r[4] == "live"

    prod_last, prod_prior = total(in_last), total(in_prior)
    clean_last = total(lambda r: in_last(r) and clean(r), dedup=True)
    clean_prior = total(lambda r: in_prior(r) and clean(r), dedup=True)
    dup_bug = sum(r[8] for r in rows if in_last(r) and clean(r))
    loadtest = total(lambda r: in_last(r) and r[3] == "loadtest" and r[4] == "live")
    replay = total(lambda r: in_last(r) and r[4] == "replay")
    no_experiments = total(lambda r: in_last(r) and clean(r) and r[1] == "none" and r[2] == "none", dedup=True)

    def arm(co, dedup, since=CHECKOUT_START):
        days = {(since + timedelta(d)).isoformat() for d in range((START + timedelta(DAYS) - since).days)}
        sel = [r for r in rows if r[0] in days and clean(r) and r[1] == co]
        return sum((r[7] - r[8]) if dedup else r[7] for r in sel), sum(r[5] - (r[6] if dedup else 0) for r in sel)

    def epo(co):
        days = {(BUG_START + timedelta(d)).isoformat() for d in range((START + timedelta(DAYS) - BUG_START).days)}
        sel = [r for r in rows if r[0] in days and clean(r) and r[1] == co]
        return round(sum(r[5] for r in sel) / sum(r[5] - r[6] for r in sel), 2)

    t_raw, c_raw = arm("treatment", False)[0], arm("control", False)[0]
    t_clean, c_clean = arm("treatment", True)[0], arm("control", True)[0]

    def aov(p):
        sel = [r for r in rows if in_last(r) and clean(r) and r[2] == p]
        return round(sum(r[7] - r[8] for r in sel) / sum(r[5] - r[6] for r in sel) / 100, 2)

    pct = lambda a, b: round(100.0 * (a - b) / b, 1)
    expected = {
        "prod_last": prod_last, "prod_prior": prod_prior, "prod_lift_pct": pct(prod_last, prod_prior),
        "clean_last": clean_last, "clean_prior": clean_prior, "clean_lift_pct": pct(clean_last, clean_prior),
        "dup_bug": dup_bug, "loadtest": loadtest, "replay": replay,
        "unexplained": prod_last - dup_bug - loadtest - replay - clean_last,
        "no_experiments_last": no_experiments,
        "events_per_order_control": epo("control"), "events_per_order_treatment": epo("treatment"),
        "checkout_lift_raw_pct": pct(t_raw, c_raw), "checkout_lift_clean_pct": pct(t_clean, c_clean),
        "aov_pricing_A": aov("A"), "aov_pricing_B": aov("B"),
    }
    assert expected["unexplained"] == 0
    return {
        "$comment": "SYNTHETIC. Generated by interview/whiteboard/boardroom/gen.py; do not edit.",
        "columns": ["day", "checkout_arm", "pricing_arm", "account", "source",
                    "events", "dup_events", "cents", "dup_cents"],
        "windows": {"prior": [PRIOR[0].isoformat(), PRIOR[-1].isoformat()],
                    "last": [LAST[0].isoformat(), LAST[-1].isoformat()]},
        "dates": {"checkout_start": CHECKOUT_START.isoformat(), "bug_start": BUG_START.isoformat(),
                  "pricing_start": PRICING_START.isoformat(), "loadtest_day": LOADTEST_DAY.isoformat(),
                  "replay_day": REPLAY_DAY.isoformat()},
        # Continuity with Nº 42 (The Revenue Problem), whose verified bridge closed
        # October at this figure; November is not closed until 4 December.
        "finance": {"october_recognized_cents": 420000000, "november_close": "2026-12-04"},
        "rows": rows,
        "expected": expected,
    }


def main() -> int:
    text = json.dumps(build(), separators=(",", ":"), sort_keys=False) + "\n"
    if "--check" in sys.argv:
        if not OUT.exists() or OUT.read_text() != text:
            print(f"{OUT.relative_to(ROOT)} is stale: run python3 interview/whiteboard/boardroom/gen.py")
            return 1
        print(f"{OUT.relative_to(ROOT)}: current")
        return 0
    OUT.write_text(text)
    print(f"wrote {OUT.relative_to(ROOT)} ({len(text) // 1024} KB)")
    print(json.dumps(build()["expected"], indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
