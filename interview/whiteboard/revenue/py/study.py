"""SYNTHETIC usability-study responses, to demonstrate the analysis in § 06.

This is not a study and not evidence that any design works. It fabricates
plausible answers so that the comprehension query has rows to run on. In a
real study these rows come from moderated sessions.

    python3 study.py OUT_DIR
"""
import csv
import random
import sys
from pathlib import Path

RNG = random.Random(4242)
ROLES = ["finance analyst", "product manager", "executive", "data engineer"]
TASKS = {
    "T1": "Which number goes in the board deck for October?",
    "T2": "Why do the two numbers differ by $400K?",
    "T3": "Is October's number final?",
    "T4": "Which number should judge the checkout experiment?",
}
# probability of a correct answer, and of answering with high confidence, per design
P_CORRECT = {"today": {"T1": 0.55, "T2": 0.15, "T3": 0.30, "T4": 0.45},
             "redesign": {"T1": 0.90, "T2": 0.75, "T3": 0.85, "T4": 0.80}}
P_CONFIDENT = {"today": 0.70, "redesign": 0.55}


def main(out: Path) -> None:
    rows = []
    pid = 0
    for variant in ("today", "redesign"):
        for role in ROLES:
            for _ in range(5):
                pid += 1
                for task in TASKS:
                    correct = RNG.random() < P_CORRECT[variant][task]
                    confident = RNG.random() < P_CONFIDENT[variant] + (0.15 if correct else 0)
                    confidence = RNG.choice([4, 5]) if confident else RNG.choice([1, 2, 3])
                    seconds = int(RNG.lognormvariate(4.3 if variant == "today" else 3.8, 0.5))
                    rows.append((f"P{pid:02d}", role, variant, task, correct, confidence, seconds))
    with open(out / "study_response.csv", "w", newline="") as f:
        csv.writer(f).writerows(rows)
    print(f"{pid} participants, {len(rows)} responses")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
