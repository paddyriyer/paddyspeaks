"""Deterministic SYNTHETIC orders for the Revenue Problem.

No real company, customer or ledger. The data is built so that the two
dashboards in the interview prompt reproduce exactly — Product's query
returns $4,600,000.00 and Finance's $4,200,000.00 for October 2026 — and
so that every dollar of the gap comes from a rule someone can name:

    sales tax inside Product's total ............. 230,000.00
    test orders inside Product's total ............ 15,000.00
    refunds issued in October (Finance nets them) .. 95,000.00
    October orders fulfilled in November .......... 180,000.00
    September orders fulfilled in October ......... 120,000.00 (other way)

Boundary cases are deliberate: orders placed late on 30 September in New
York are 1 October in UTC, and fulfilments late on 31 October in New York
are 1 November in UTC. Amounts are integer cents.

    python3 seed.py OUT_DIR
"""
import csv
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

RNG = random.Random(400000)
ET = ZoneInfo("America/New_York")
UTC = timezone.utc


def split(total_cents: int, n: int) -> list[int]:
    """n positive integer amounts that sum to total_cents exactly."""
    weights = [RNG.lognormvariate(0, 0.6) for _ in range(n)]
    scale = total_cents / sum(weights)
    parts = [max(1, int(w * scale)) for w in weights]
    parts[-1] += total_cents - sum(parts)
    assert parts[-1] > 0 and sum(parts) == total_cents
    return parts


def utc(y, m, d, h=0, mi=0) -> datetime:
    return datetime(y, m, d, h, mi, tzinfo=UTC)


def et(y, m, d, h=0, mi=0) -> datetime:
    return datetime(y, m, d, h, mi, tzinfo=ET)


def rand_between(a: datetime, b: datetime) -> datetime:
    return a + timedelta(seconds=RNG.randint(0, int((b - a).total_seconds())))


def main(out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    orders, refunds = [], []
    oid = 100000

    def add(group, n, subtotal_total, placed_range, fulfil, is_test=False, boundary=None):
        nonlocal oid
        rows = []
        for i, sub in enumerate(split(subtotal_total, n)):
            oid += 1
            placed = rand_between(*placed_range)
            if boundary and i < len(boundary):
                placed, f_at = boundary[i]
            else:
                f_at = fulfil(placed)
            rows.append({"order_id": oid, "customer_id": 5000 + RNG.randint(1, 1800),
                         "is_test": is_test, "ordered_at": placed, "fulfilled_at": f_at,
                         "subtotal": sub, "tax": 0, "group": group})
        orders.extend(rows)
        return rows

    oct_utc = (utc(2026, 10, 1), utc(2026, 10, 31, 23, 59))

    def same_month_et(placed):
        # fulfilled 0-3 days later, but never past the end of October in New York
        f = placed + timedelta(hours=RNG.randint(2, 72))
        return min(max(f, et(2026, 10, 1, 6, 0)), et(2026, 10, 31, 19, 0))

    # G1: placed in October (UTC), fulfilled in October (New York). Includes
    # orders placed on the evening of 30 Sep in New York (already October in UTC)
    # and fulfilments late on 31 Oct in New York (already November in UTC).
    g1_boundary = [(et(2026, 9, 30, 21, 15), et(2026, 10, 2, 9, 0)),
                   (et(2026, 9, 30, 22, 40), et(2026, 10, 1, 14, 0)),
                   (et(2026, 10, 30, 11, 0), et(2026, 10, 31, 22, 30)),
                   (et(2026, 10, 30, 16, 5), et(2026, 10, 31, 23, 10))]
    g1 = add("G1", 2400, 417_500_000, oct_utc, same_month_et, boundary=g1_boundary)
    # G2: placed in October (UTC), fulfilled in November (New York)
    g2 = add("G2", 90, 18_000_000, (utc(2026, 10, 20), utc(2026, 10, 31, 23, 0)),
             lambda p: et(2026, 11, 1, 8) + timedelta(hours=RNG.randint(0, 120)))
    # G3: test orders placed in October
    g3 = add("G3", 40, 1_500_000, oct_utc, same_month_et, is_test=True)
    # G4: placed in September (UTC), fulfilled in October (New York)
    g4 = add("G4", 70, 12_000_000, (utc(2026, 9, 22), utc(2026, 9, 30, 20, 0)),
             lambda p: et(2026, 10, 1, 9) + timedelta(hours=RNG.randint(0, 96)))
    # G5: placed and fulfilled in September — context, and the target of some refunds.
    # Two of them are fulfilled late on 30 Sep in New York (1 Oct in UTC).
    g5 = add("G5", 600, 98_000_000, (utc(2026, 9, 1), utc(2026, 9, 27)),
             lambda p: p + timedelta(hours=RNG.randint(2, 60)),
             boundary=[(utc(2026, 9, 29, 12), et(2026, 9, 30, 21, 45)),
                       (utc(2026, 9, 29, 18), et(2026, 9, 30, 23, 20))])

    # Sales tax: Product's total for October-placed orders carries 230,000.00 of it.
    in_product = g1 + g2 + g3
    raw = [o["subtotal"] * RNG.choice([0.04, 0.06, 0.0625, 0.0725, 0.0875]) for o in in_product]
    scale = 23_000_000 / sum(raw)
    for o, r in zip(in_product, raw):
        o["tax"] = int(r * scale)
    in_product[-1]["tax"] += 23_000_000 - sum(o["tax"] for o in in_product)
    for o in g4 + g5:
        o["tax"] = round(o["subtotal"] * RNG.choice([0, 0.04, 0.06, 0.0725, 0.0875]))

    # Refunds issued in October (New York): 95,000.00 on real orders from Sep and Oct.
    # Twelve orders get two partial refunds, which matters for the bug in § 05.
    refundable = [o for o in g1[4:] if o["fulfilled_at"] < et(2026, 10, 30)]
    targets = RNG.sample(refundable, 110) + RNG.sample(g5, 60)
    amounts = split(9_500_000, len(targets) + 12)
    rid = 900000
    for i, o in enumerate(targets + targets[:12]):
        amt = min(amounts[i], o["subtotal"] // 2)
        rid += 1
        start = max(o["fulfilled_at"], et(2026, 10, 1, 9))
        refunds.append({"refund_id": rid, "order_id": o["order_id"],
                        "refunded_at": rand_between(start, et(2026, 10, 31, 18)), "amount": amt})
    # caps can leave the total short: hand the rest to refunds with headroom
    shortfall = 9_500_000 - sum(r["amount"] for r in refunds)
    by_id = {o["order_id"]: o for o in orders}
    for r in refunds:
        if shortfall == 0:
            break
        room = by_id[r["order_id"]]["subtotal"] // 2 - r["amount"]
        add_c = min(room, shortfall)
        r["amount"] += add_c
        shortfall -= add_c
    assert shortfall == 0 and sum(r["amount"] for r in refunds) == 9_500_000

    def money(c):
        return f"{c // 100}.{c % 100:02d}"

    with open(out / "orders.csv", "w", newline="") as f:
        w = csv.writer(f)
        for o in sorted(orders, key=lambda o: o["order_id"]):
            w.writerow([o["order_id"], o["customer_id"], o["is_test"],
                        o["ordered_at"].astimezone(UTC).isoformat(),
                        o["fulfilled_at"].astimezone(UTC).isoformat(),
                        money(o["subtotal"]), money(o["tax"])])
    with open(out / "refunds.csv", "w", newline="") as f:
        w = csv.writer(f)
        for r in refunds:
            w.writerow([r["refund_id"], r["order_id"],
                        r["refunded_at"].astimezone(UTC).isoformat(), money(r["amount"])])
    print(f"{len(orders)} orders, {len(refunds)} refunds")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
