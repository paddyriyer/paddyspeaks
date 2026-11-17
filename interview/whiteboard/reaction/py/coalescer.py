"""Client side (shown in Python; the app runs the same logic natively).

Taps are grouped by the MEDIA second the viewer was watching, not by wall
time, and leave the phone at most once per second. A batch keeps its
batch_seq through every retry, so the server can drop duplicates.
"""
from dataclasses import dataclass, field

MAX_TAPS_PER_EMOJI = 50


@dataclass
class Batch:
    batch_seq: int
    media_sec: int
    taps: dict[str, int]
    attempts: int = 0


@dataclass
class Coalescer:
    session_id: str
    _seq: int = 0
    _open: dict[int, dict[str, int]] = field(default_factory=dict)   # media_sec -> taps
    _unacked: dict[int, Batch] = field(default_factory=dict)          # batch_seq -> batch

    def tap(self, emoji: str, player_media_ms: int) -> None:
        sec = player_media_ms // 1000            # where the viewer IS, not what time it is
        bucket = self._open.setdefault(sec, {})
        bucket[emoji] = min(bucket.get(emoji, 0) + 1, MAX_TAPS_PER_EMOJI)

    def flush(self) -> list[Batch]:
        """Called once per wall-clock second. New batches, then any still unacked."""
        for sec in sorted(self._open):
            self._seq += 1
            self._unacked[self._seq] = Batch(self._seq, sec, self._open[sec])
        self._open.clear()
        due = sorted(self._unacked.values(), key=lambda b: b.batch_seq)
        for b in due:
            b.attempts += 1
        return [b for b in due if b.attempts <= 5]   # give up quietly: it is a mood, not money

    def ack(self, batch_seq: int) -> None:
        self._unacked.pop(batch_seq, None)
