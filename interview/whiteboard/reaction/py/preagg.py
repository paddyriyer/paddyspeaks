"""Edge pre-aggregation: millions of batches in, thousands of tiny records out.

Sessions are routed to edge nodes by hash(session_id), so the per-session
state (dedup and one-voice-per-second) is local. Every 250 ms the node
flushes DELTAS — counts since the last flush — keyed by
(match, region, media_sec, emoji). Deltas are additive, so any number of
nodes merge by summing, in any order, and a media second can keep receiving
revisions while viewers who are further behind reach it.
"""
from collections import Counter, OrderedDict
from dataclasses import dataclass

ALLOWED_LATENESS_S = 90          # the slowest stream we serve, plus margin
SEEN_CAPACITY = 2_000_000        # (session, batch_seq) pairs remembered for dedup


@dataclass(frozen=True)
class Delta:
    match_id: int
    region: str
    media_sec: int
    emoji: str
    voices: int


class PreAggregator:
    def __init__(self, seen_capacity: int = SEEN_CAPACITY):
        self.counts: Counter = Counter()
        self.seen_batches: OrderedDict = OrderedDict()   # bounded LRU
        self.voiced: OrderedDict = OrderedDict()         # (session, match, media_sec)
        self.capacity = seen_capacity
        self.newest_sec: dict[int, int] = {}
        self.stats = Counter()

    def _remember(self, lru: OrderedDict, key) -> bool:
        """True if key was new. Oldest keys fall out when the LRU is full."""
        if key in lru:
            lru.move_to_end(key)
            return False
        lru[key] = None
        if len(lru) > self.capacity:
            lru.popitem(last=False)
        return True

    def accept(self, b: dict) -> None:
        if b["admission"] != "admitted":
            self.stats[b["admission"]] += 1
            return
        if not self._remember(self.seen_batches, (b["session_id"], b["batch_seq"])):
            self.stats["duplicate"] += 1                  # a retry: already counted
            return
        m, sec = b["match_id"], b["media_sec"]
        newest = self.newest_sec[m] = max(self.newest_sec.get(m, sec), sec)
        if sec < newest - ALLOWED_LATENESS_S:
            self.stats["too_late"] += 1                   # counted in stats, not in the mood
            return
        if not self._remember(self.voiced, (b["session_id"], m, sec)):
            self.stats["second_voice"] += 1               # one voice per person per second
            return
        emoji = max(sorted(b["taps"]), key=lambda e: b["taps"][e])   # dominant, ties by name
        self.counts[(m, b["region"], sec, emoji)] += 1
        self.stats["voiced"] += 1

    def flush(self) -> list[Delta]:
        out = [Delta(m, r, s, e, n) for (m, r, s, e), n in sorted(self.counts.items())]
        self.counts.clear()
        return out


def merge(*node_deltas: list[Delta]) -> Counter:
    """The aggregator's whole job, given deltas: add them up."""
    total: Counter = Counter()
    for deltas in node_deltas:
        for d in deltas:
            total[(d.match_id, d.region, d.media_sec, d.emoji)] += d.voices
    return total
