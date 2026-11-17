"""Edge admission: decide before anything is counted.

Token buckets per account AND per device fingerprint (a farm of fresh
accounts on one device still shares one bucket). In production the buckets
live in the edge node's memory, keyed so a session always lands on the same
node; nothing here needs a network round-trip on the hot path.
"""
from dataclasses import dataclass
from typing import Callable

MAX_TAPS_PER_BATCH = 16          # more than this in one second is not a thumb


@dataclass
class TokenBucket:
    rate: float                  # tokens per second
    burst: float
    tokens: float = -1.0
    updated: float = 0.0

    def take(self, now: float) -> bool:
        if self.tokens < 0:
            self.tokens, self.updated = self.burst, now
        self.tokens = min(self.burst, self.tokens + (now - self.updated) * self.rate)
        self.updated = now
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False


class Admission:
    def __init__(self, clock: Callable[[], float],
                 per_account=(2.0, 4.0), per_device=(6.0, 12.0)):
        self.clock = clock
        self.per_account, self.per_device = per_account, per_device
        self.accounts: dict[int, TokenBucket] = {}
        self.devices: dict[str, TokenBucket] = {}

    def decide(self, account_id: int | None, device_fp: str, taps: dict[str, int]) -> str:
        if account_id is None:
            return "unauthenticated"     # stored for analysis, never counted in the mood
        if sum(taps.values()) > MAX_TAPS_PER_BATCH:
            return "throttled"
        now = self.clock()
        acct = self.accounts.setdefault(account_id, TokenBucket(*self.per_account))
        dev = self.devices.setdefault(device_fp, TokenBucket(*self.per_device))
        # both must have a token. Account first: an account that is already
        # throttled must not spend the tokens its device shares with others.
        if not acct.take(now) or not dev.take(now):
            return "throttled"
        return "admitted"
