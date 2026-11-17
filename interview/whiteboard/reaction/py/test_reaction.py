"""Tests for every Python block on the Reaction Problem page.  python3 -m unittest -v"""
import asyncio
import unittest

from admission import Admission
from coalescer import Coalescer
from fanout import Connection, Hub, Snapshot, renderable
from guardrail import Context, Guardrail, Proposal
from preagg import PreAggregator, merge


class CoalescerTest(unittest.TestCase):
    def test_groups_by_media_second_and_retries_keep_seq(self):
        c = Coalescer("s1")
        for _ in range(11):
            c.tap("fire", player_media_ms=125_400)      # eleven taps, one media second
        c.tap("pray", player_media_ms=126_100)
        first = c.flush()
        self.assertEqual([(b.batch_seq, b.media_sec, b.taps) for b in first],
                         [(1, 125, {"fire": 11}), (2, 126, {"pray": 1})])
        c.ack(1)
        retry = c.flush()                                # seq 2 was not acked
        self.assertEqual([(b.batch_seq, b.attempts) for b in retry], [(2, 2)])

    def test_gives_up_after_five_attempts(self):
        c = Coalescer("s1")
        c.tap("fire", 1000)
        sent = [len(c.flush()) for _ in range(7)]
        self.assertEqual(sent, [1, 1, 1, 1, 1, 0, 0])


class AdmissionTest(unittest.TestCase):
    def test_buckets(self):
        t = [0.0]
        a = Admission(clock=lambda: t[0])
        self.assertEqual(a.decide(None, "d", {"fire": 1}), "unauthenticated")
        self.assertEqual(a.decide(1, "d", {"fire": 17}), "throttled")
        burst = [a.decide(1, "d", {"fire": 1}) for _ in range(6)]
        self.assertEqual(burst, ["admitted"] * 4 + ["throttled"] * 2)   # burst 4
        t[0] = 1.0                                                     # refill 2/s
        self.assertEqual([a.decide(1, "d", {"fire": 1}) for _ in range(3)],
                         ["admitted", "admitted", "throttled"])

    def test_many_accounts_one_device_share_a_bucket(self):
        a = Admission(clock=lambda: 0.0)
        verdicts = [a.decide(1000 + n, "farm", {"angry": 9}) for n in range(20)]
        self.assertEqual(verdicts.count("admitted"), 12)              # device burst 12

    def test_throttled_account_does_not_drain_its_device(self):
        a = Admission(clock=lambda: 0.0)
        for _ in range(10):
            a.decide(1, "shared", {"fire": 1})          # account 1: 4 admitted, 6 throttled
        self.assertEqual(a.devices["shared"].tokens, 12 - 4)


class PreAggTest(unittest.TestCase):
    def batch(self, sid, seq, sec, taps, adm="admitted", region="north"):
        return dict(session_id=sid, batch_seq=seq, match_id=1, region=region,
                    media_sec=sec, taps=taps, admission=adm)

    def test_dedup_one_voice_dominant_emoji_and_lateness(self):
        p = PreAggregator()
        p.accept(self.batch("a", 1, 125, {"fire": 9, "pray": 2}))
        p.accept(self.batch("a", 1, 125, {"fire": 9, "pray": 2}))   # retry
        p.accept(self.batch("a", 2, 125, {"sad": 1}))               # second batch, same second
        p.accept(self.batch("b", 1, 125, {"clap": 2, "fire": 2}))   # tie -> 'clap' by name
        p.accept(self.batch("c", 1, 125, {"fire": 1}, adm="throttled"))
        p.accept(self.batch("d", 1, 300, {"fire": 1}))
        p.accept(self.batch("e", 1, 200, {"fire": 1}))              # 100 s behind newest
        out = {(d.media_sec, d.emoji): d.voices for d in p.flush()}
        self.assertEqual(out, {(125, "fire"): 1, (125, "clap"): 1, (300, "fire"): 1})
        self.assertEqual(p.stats, {"voiced": 3, "duplicate": 1, "second_voice": 1,
                                   "throttled": 1, "too_late": 1})
        self.assertEqual(p.flush(), [])                             # deltas, not totals

    def test_merge_is_order_independent(self):
        n1, n2 = PreAggregator(), PreAggregator()
        n1.accept(self.batch("a", 1, 125, {"fire": 3}))
        n2.accept(self.batch("b", 1, 125, {"fire": 1}, region="south"))
        n2.accept(self.batch("c", 1, 125, {"fire": 1}))
        d1, d2 = n1.flush(), n2.flush()
        self.assertEqual(merge(d1, d2), merge(d2, d1))
        self.assertEqual(merge(d1, d2)[(1, "north", 125, "fire")], 2)

    def test_lru_bound(self):
        p = PreAggregator(seen_capacity=2)
        for seq in (1, 2, 3):
            p.accept(self.batch("a", seq, 100 + seq, {"fire": 1}))
        self.assertEqual(len(p.seen_batches), 2)


class FanoutTest(unittest.TestCase):
    def test_slow_client_skips_revisions_fast_client_gets_all(self):
        async def run():
            got_fast, got_slow = [], []

            async def fast(s):
                got_fast.append(s.revision)

            async def slow(s):
                got_slow.append(s.revision)
                await asyncio.sleep(0.05)

            hub = Hub()
            cf, cs = Connection(fast), Connection(slow)
            hub.connections |= {cf, cs}
            tasks = [asyncio.create_task(c.pump()) for c in (cf, cs)]
            for rev in range(1, 6):
                hub.publish(Snapshot(1, 129, rev, {"fire": 0.6}))
                await asyncio.sleep(0.01)
            await asyncio.sleep(0.1)
            for t in tasks:
                t.cancel()
            return got_fast, got_slow, cs.skipped

        fast, slow, skipped = asyncio.run(run())
        self.assertEqual(fast, [1, 2, 3, 4, 5])
        self.assertEqual(slow[0], 1)
        self.assertEqual(slow[-1], 5)          # always ends on the newest
        self.assertLess(len(slow), 5)
        self.assertEqual(len(slow) + skipped, 5)

    def test_renderable(self):
        s = Snapshot(1, 129, 3, {})
        self.assertEqual(renderable(s, 129_500), "hold")     # viewer still inside second 129
        self.assertEqual(renderable(s, 131_200), "show")
        self.assertEqual(renderable(s, 136_000), "stale")


class GuardrailTest(unittest.TestCase):
    def test_a_six_is_not_a_bot_attack(self):
        g = Guardrail()
        surge = Proposal("throttle_ingest", {"region": "ALL", "pct": 60},
                         "Synchronised 40x surge from every region: likely bot attack.")
        after_six = Context(media_sec=128, last_match_event=("six", 125),
                            integrity_signals=frozenset())
        self.assertEqual(g.decide(surge, after_six), "needs_human")
        self.assertIn("six", g.audit[-1]["reason"])
        quiet = Context(160, ("run", 140), frozenset({"metronomic", "shared_device"}))
        self.assertEqual(g.decide(surge, quiet), "execute")
        one_signal = Context(160, ("run", 140), frozenset({"metronomic"}))
        self.assertEqual(g.decide(surge, one_signal), "needs_human")

    def test_bounds_and_audit(self):
        g = Guardrail()
        ctx = Context(10, None, frozenset())
        self.assertEqual(g.decide(Proposal("scale_fanout", {"pct": 40}, ""), ctx), "execute")
        self.assertEqual(g.decide(Proposal("scale_fanout", {"pct": 300}, ""), ctx), "needs_human")
        self.assertEqual(g.decide(Proposal("degrade", {"level": 3}, ""), ctx), "needs_human")
        self.assertEqual(g.decide(Proposal("drop_table", {}, ""), ctx), "reject")
        self.assertEqual(len(g.audit), 4)
        self.assertEqual(len(g.audit[0]["evidence_sha256"]), 64)


if __name__ == "__main__":
    unittest.main()
