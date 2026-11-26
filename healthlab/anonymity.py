"""How identifying is a "de-identified" health profile? A synthetic demonstration.

Twenty thousand fictional people with ordinary attributes (birth date, sex, ZIP code,
conditions, where their morning walks start, workout dates). For each combination
of attributes we count how many people are unique (k = 1) or nearly so (k < 5).
The numbers describe THIS synthetic population only; they illustrate the mechanism
(re-identification by combination), not real-world rates.
"""
from __future__ import annotations

import datetime as dt
import random
from collections import Counter

N = 20000


def population(seed=7070):
    rng = random.Random(seed)
    zip3s = [f"{rng.randint(100, 999)}" for _ in range(60)]
    weights = [rng.paretovariate(1.2) for _ in zip3s]
    people = []
    for _ in range(N):
        z3 = rng.choices(zip3s, weights)[0]
        z5 = z3 + f"{rng.randint(0, 11):02d}"
        birth = dt.date(1940, 1, 1) + dt.timedelta(days=rng.randint(0, 65 * 365))
        cell = (z5, rng.randint(0, 39))                           # ~500 m grid cell near home
        workouts = tuple(sorted(rng.sample(range(730), 5)))      # dates of five longest workouts
        people.append({"birth": birth, "sex": rng.choice("FM"), "z5": z5, "z3": z3,
                       "region": str(int(z3) // 100), "rare": rng.random() < 0.01,
                       "pre": rng.random() < 0.3, "cell": cell, "workouts": workouts})
    return people


LEVELS = [
    ("Name removed; birth date, sex and 5-digit ZIP kept", lambda p: (p["birth"], p["sex"], p["z5"])),
    ("Birth year, sex and 3-digit ZIP", lambda p: (p["birth"].year, p["sex"], p["z3"])),
    ("…plus one rare condition", lambda p: (p["birth"].year, p["sex"], p["z3"], p["rare"])),
    ("…plus where morning walks start (about 500 m)", lambda p: (p["birth"].year, p["sex"], p["z3"], p["cell"])),
    ("Only the dates of five long workouts", lambda p: p["workouts"]),
    ("Generalized: 10-year age band, sex, broad region", lambda p: ((2026 - p["birth"].year) // 10, p["sex"], p["region"])),
]


def demo():
    people = population()
    rows = []
    for label, key in LEVELS:
        c = Counter(key(p) for p in people)
        ks = [c[key(p)] for p in people]
        rare = [k for p, k in zip(people, ks) if p["rare"]]
        rows.append({"label": label, "unique_pct": round(100 * sum(1 for k in ks if k == 1) / N, 1),
                     "rare_unique_pct": round(100 * sum(1 for k in rare if k == 1) / len(rare), 1),
                     "k_lt5_pct": round(100 * sum(1 for k in ks if k < 5) / N, 1),
                     "median_k": sorted(ks)[N // 2]})
    rare_in_region = Counter(p["region"] for p in people if p["rare"])
    return {"population": N, "seed": 7070, "levels": rows,
            "dp_example": {"label": "People with the rare condition in one region", "true_count": max(rare_in_region.values())},
            "note": "Synthetic population. These percentages describe this demonstration only and illustrate the mechanism, "
                    "not real-world re-identification rates."}
