"""Deterministic SYNTHETIC data for the Reaction Problem's SQL.

Nothing here is a measurement of any real platform. It fabricates one short
match (two overs), a few thousand viewing sessions in three regions, one
six, one wicket, a coordinated cluster of scripted sessions, client retries,
and 1% render receipts, so every query on the page runs against data with
known shape. Output: CSV files for COPY, plus batches.jsonl (the payloads
the ingest function receives, retries included).

    python3 seed.py OUT_DIR
"""
import csv
import json
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

RNG = random.Random(20261117)
MATCH_ID = 1
START = datetime(2026, 11, 17, 14, 0, tzinfo=timezone.utc)
REGIONS = [("north", 0.4), ("south", 0.35), ("west", 0.25)]
EMOJI = ["fire", "clap", "pray", "shock", "sad", "angry"]
# Two overs, a ball every 15 media seconds. Over 2, ball 3 is a six; over 2, ball 5 a wicket.
OUTCOMES = ["dot", "run", "four", "dot", "run", "dot",
            "run", "dot", "six", "run", "wicket", "dot"]
MEDIA_SECONDS = 12 * 15 + 15

# What a crowd feels after each outcome (weights over EMOJI), synthetic.
FEEL = {
    "dot": [1, 2, 1, 0, 1, 0], "run": [2, 3, 1, 0, 0, 0], "wide": [0, 1, 0, 1, 0, 2],
    "four": [6, 4, 1, 1, 0, 0], "six": [12, 5, 1, 2, 0, 0], "wicket": [0, 1, 3, 4, 6, 3],
}
REACT_P = {"dot": 0.02, "run": 0.04, "wide": 0.03, "four": 0.25, "six": 0.45, "wicket": 0.40}


def uid() -> str:
    return str(uuid.UUID(int=RNG.getrandbits(128), version=4))


def pick(weights):
    return RNG.choices(EMOJI, weights=weights)[0]


def main(out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    deliveries = []
    for i, outcome in enumerate(OUTCOMES):
        deliveries.append((MATCH_ID, i // 6 + 1, i % 6 + 1, 5 + i * 15, outcome))

    accounts, sessions = [], []
    for n in range(3000):                                   # genuine viewers
        acct = 100000 + n if RNG.random() > 0.08 else None  # 8% anonymous
        if acct:
            age = timedelta(days=RNG.uniform(2, 2000))
            accounts.append((acct, (START - age).isoformat()))
        region = RNG.choices([r for r, _ in REGIONS], weights=[w for _, w in REGIONS])[0]
        sessions.append({"id": uid(), "acct": acct, "fp": f"fp-{RNG.getrandbits(40):010x}",
                         "asn": RNG.choice([9829, 24560, 45609, 55836, 45271, 38266]),
                         "region": region, "bot": False,
                         "stream_delay_ms": int(RNG.uniform(4000, 30000))})
    for n in range(180):                                    # one scripted cluster
        acct = 900000 + n
        accounts.append((acct, (START - timedelta(hours=RNG.uniform(1, 20))).isoformat()))
        sessions.append({"id": uid(), "acct": acct, "fp": "fp-00c0ffee00",
                         "asn": 64512, "region": "west", "bot": True, "stream_delay_ms": 8000})

    batches = []          # payloads in arrival order, retries included
    receipts = []
    by_sec = {d[3]: d[4] for d in deliveries}
    for s in sessions:
        seq = 0
        for sec in range(MEDIA_SECONDS):
            ball_sec = max((d for d in by_sec if d <= sec), default=None)
            since = sec - ball_sec if ball_sec is not None else 99
            outcome = by_sec[ball_sec] if ball_sec is not None else "dot"
            # the moment of watching: wall time = start + media + this viewer's stream delay
            watched_at = START + timedelta(seconds=sec, milliseconds=s["stream_delay_ms"])
            if s["bot"]:
                # scripted: every second from media 60 to 119, angry, perfectly periodic
                if not (60 <= sec < 120):
                    continue
                taps = {"angry": 9}
                sent = START + timedelta(seconds=sec + 9)          # exactly on the second
            else:
                p = REACT_P[outcome] if since < 8 else 0.01
                if RNG.random() > p:
                    continue
                taps = {}
                for _ in range(RNG.randint(1, 3)):
                    e = pick(FEEL[outcome] if since < 8 else FEEL["run"])
                    taps[e] = taps.get(e, 0) + RNG.randint(1, 6)
                sent = watched_at + timedelta(milliseconds=RNG.randint(200, 1100))
            seq += 1
            recv = sent + timedelta(milliseconds=RNG.randint(20, 400))
            payload = {
                "session_id": s["id"], "batch_seq": seq, "account_id": s["acct"],
                "device_fp": s["fp"], "asn": s["asn"], "region": s["region"],
                "match_id": MATCH_ID, "media_sec": sec,
                "client_sent_at": sent.isoformat(), "edge_received_at": recv.isoformat(),
                "admission": "admitted" if s["acct"] else "unauthenticated",
                "taps": taps,
            }
            batches.append(payload)
            if not s["bot"] and RNG.random() < 0.03:       # client retried: same seq
                batches.append(dict(payload, edge_received_at=(recv + timedelta(seconds=1)).isoformat()))
        # 1% of genuine sessions report renders: the mood for second M shown at player position P
        if not s["bot"] and RNG.random() < 0.1:
            for sec in range(10, MEDIA_SECONDS, 5):
                pipeline_ms = RNG.lognormvariate(7.0, 0.35)          # ~1.1 s median
                if RNG.random() < 0.02:
                    pipeline_ms += RNG.uniform(1500, 4000)             # a slow tail
                snapshot_sec = sec
                player_ms = (snapshot_sec + 1) * 1000 + int(pipeline_ms)
                rendered = START + timedelta(milliseconds=player_ms + s["stream_delay_ms"])
                receipts.append((s["id"], MATCH_ID, snapshot_sec, player_ms, rendered.isoformat()))
    # one viewer whose player is BEHIND the snapshot it was shown: a spoiler
    spoiled = sessions[7]["id"]
    receipts.append((spoiled, MATCH_ID, 125, 123400, (START + timedelta(seconds=140)).isoformat()))

    # a handful of genuine sessions get throttled by the edge for tapping too fast
    bots = {s["id"] for s in sessions if s["bot"]}
    for b in batches:
        if b["session_id"] not in bots and sum(b["taps"].values()) > 16:
            b["admission"] = "throttled"

    def write(name, rows):
        with open(out / name, "w", newline="") as f:
            csv.writer(f).writerows(rows)

    write("dim_match.csv", [(MATCH_ID, "Synthetic XI v Synthetic XI", START.isoformat())])
    write("dim_delivery.csv", deliveries)
    write("dim_account.csv", accounts)
    write("render_receipt.csv", receipts)
    with open(out / "batches.jsonl", "w") as f:
        for b in batches:
            f.write(json.dumps(b) + "\n")
    print(f"{len(sessions)} sessions, {len(batches)} payloads, {len(receipts)} receipts")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
