"""Fan-out: millions of open connections, one tiny snapshot each.

Each connection holds ONE slot, not a queue. A new snapshot overwrites
whatever the connection has not sent yet, so a slow phone skips revisions
instead of falling further and further behind: backpressure that drops
the past rather than delaying the present. (Right for a mood meter; it
would be wrong for anything where each message matters.)
"""
import asyncio
from dataclasses import dataclass


@dataclass(frozen=True)
class Snapshot:
    match_id: int
    media_sec: int
    revision: int
    shares: dict


class Connection:
    def __init__(self, send):
        self._send = send                      # async callable: the socket write
        self._latest: Snapshot | None = None
        self._ready = asyncio.Event()
        self.sent = 0
        self.skipped = 0

    def offer(self, snap: Snapshot) -> None:
        if self._latest is not None:
            self.skipped += 1                  # overwritten before it could be sent
        self._latest = snap
        self._ready.set()

    async def pump(self) -> None:
        while True:
            await self._ready.wait()
            snap, self._latest = self._latest, None
            self._ready.clear()
            await self._send(snap)             # a slow client blocks only itself
            self.sent += 1


class Hub:
    """One per edge process, per match. Region hubs subscribe to the merged feed."""

    def __init__(self):
        self.connections: set[Connection] = set()

    def publish(self, snap: Snapshot) -> None:
        for c in self.connections:             # O(connections), no awaits: never blocks
            c.offer(snap)


def renderable(snap: Snapshot, player_media_ms: int, max_age_ms: int = 5000) -> str:
    """The client's rule: never spoil, never pass stale off as live."""
    ends_ms = (snap.media_sec + 1) * 1000
    if ends_ms > player_media_ms:
        return "hold"        # describes a moment this viewer has not seen yet
    if player_media_ms - ends_ms > max_age_ms:
        return "stale"       # show 'catching up', not old excitement as live
    return "show"
