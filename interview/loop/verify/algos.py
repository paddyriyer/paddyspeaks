"""Reference solutions for the coding questions, with brute-force cross-checks."""
from collections import deque, Counter
from functools import lru_cache
import random, itertools

# ---------- R1-Q1: FareWindow ----------
class FareWindow:
    def __init__(self, window_seconds):
        if not isinstance(window_seconds, int) or window_seconds <= 0:
            raise ValueError("window_seconds must be a positive int")
        self.w = window_seconds
        self.events = deque()          # (ts, rider, fare) in arrival order
        self.maxq = deque()            # (ts, seq, fare), fares strictly decreasing
        self.total = 0
        self.riders = Counter()
        self.last_ts = None
        self.seq = 0

    def add(self, ts, rider_id, fare_cents):
        if fare_cents < 0:
            raise ValueError("fare must be >= 0")
        if self.last_ts is not None and ts < self.last_ts:
            raise ValueError("timestamps must be non-decreasing")
        self.last_ts = ts
        self.seq += 1
        self.events.append((ts, rider_id, fare_cents, self.seq))
        self.total += fare_cents
        self.riders[rider_id] += 1
        while self.maxq and self.maxq[-1][2] <= fare_cents:
            self.maxq.pop()
        self.maxq.append((ts, self.seq, fare_cents))
        cutoff = ts - self.w           # window is (ts - W, ts]
        while self.events and self.events[0][0] <= cutoff:
            ots, orider, ofare, oseq = self.events.popleft()
            self.total -= ofare
            self.riders[orider] -= 1
            if self.riders[orider] == 0:
                del self.riders[orider]
            if self.maxq and self.maxq[0][1] == oseq:
                self.maxq.popleft()
        n = len(self.events)
        return (self.maxq[0][2], round(self.total / n, 2), len(self.riders))

def farewindow_brute(w, evs):
    out = []
    for i, (ts, r, f) in enumerate(evs):
        win = [e for e in evs[: i + 1] if ts - w < e[0] <= ts]
        out.append((max(e[2] for e in win), round(sum(e[2] for e in win) / len(win), 2), len({e[1] for e in win})))
    return out

# ---------- R1-Q2: shortest burst (sum >= T, negatives allowed) ----------
def shortest_burst(amounts, threshold):
    if threshold <= 0:
        raise ValueError("threshold must be positive")
    prefix = [0]
    for a in amounts:
        prefix.append(prefix[-1] + a)
    best = None
    dq = deque()  # indices into prefix, prefix values increasing
    for j in range(len(prefix)):
        while dq and prefix[j] - prefix[dq[0]] >= threshold:
            i = dq.popleft()
            if best is None or (j - i) < (best[1] - best[0] + 1):
                best = (i, j - 1)
        while dq and prefix[dq[-1]] >= prefix[j]:
            dq.pop()
        dq.append(j)
    return best

def shortest_burst_brute(amounts, T):
    best = None
    for L in range(1, len(amounts) + 1):
        for s in range(len(amounts) - L + 1):
            if sum(amounts[s:s + L]) >= T:
                return (s, s + L - 1)
    return best

# ---------- R2-Q1: van capacity game ----------
def first_player_wins(seats, capacity):
    n = len(seats)
    full = (1 << n) - 1
    @lru_cache(maxsize=None)
    def wins(mask, remaining):
        for i in range(n):
            if not (mask >> i) & 1 and seats[i] <= remaining:
                if not wins(mask | (1 << i), remaining - seats[i]):
                    return True
        return False
    return wins(0, capacity)

def winning_moves(seats, capacity):
    n = len(seats)
    @lru_cache(maxsize=None)
    def wins(mask, remaining):
        return any(not (mask >> i) & 1 and seats[i] <= remaining and not wins(mask | 1 << i, remaining - seats[i]) for i in range(n))
    return [i for i in range(n) if seats[i] <= capacity and not wins(1 << i, capacity - seats[i])]

def first_player_wins_multiset(seats, capacity):
    """Optimised: state = (remaining capacity, sorted tuple of counts per seat size)."""
    sizes = sorted(set(seats))
    counts = tuple(seats.count(s) for s in sizes)
    @lru_cache(maxsize=None)
    def wins(remaining, counts):
        for k, s in enumerate(sizes):
            if counts[k] and s <= remaining:
                nxt = counts[:k] + (counts[k] - 1,) + counts[k + 1:]
                if not wins(remaining - s, nxt):
                    return True
        return False
    return wins(capacity, counts)

def game_brute(seats, cap, used=()):
    moves = [i for i in range(len(seats)) if i not in used and seats[i] <= cap]
    return any(not game_brute(seats, cap - seats[i], used + (i,)) for i in moves)

# ---------- R2-Q2: compaction planning ----------
def plan_compaction(sizes, max_size, file_overhead):
    n = len(sizes)
    INF = float("inf")
    dp = [INF] * (n + 1)
    choice = [-1] * (n + 1)
    dp[0] = 0
    for j in range(1, n + 1):
        if sizes[j - 1] > max_size:           # oversized: must stand alone, no slack penalty
            dp[j] = dp[j - 1] + file_overhead
            choice[j] = j - 1
            continue
        s = 0
        for i in range(j - 1, -1, -1):        # file = sizes[i:j]
            if sizes[i] > max_size:
                break
            s += sizes[i]
            if s > max_size:
                break
            c = dp[i] + file_overhead + (max_size - s) ** 2
            if c < dp[j]:
                dp[j], choice[j] = c, i
    plan, j = [], n
    while j > 0:
        i = choice[j]
        plan.append((i, j - 1))
        j = i
    return dp[n], plan[::-1]

def compaction_brute(sizes, M, F):
    n = len(sizes); best = None
    for cuts in itertools.product([0, 1], repeat=max(n - 1, 0)):
        groups, cur = [], [0]
        for k, c in enumerate(cuts):
            if c: groups.append(cur); cur = [k + 1]
            else: cur.append(k + 1)
        groups.append(cur)
        cost = 0; ok = True
        for g in groups:
            s = sum(sizes[k] for k in g)
            if any(sizes[k] > M for k in g):
                if len(g) > 1: ok = False; break
                cost += F
            elif s > M: ok = False; break
            else: cost += F + (M - s) ** 2
        if ok and (best is None or cost < best): best = cost
    return best

if __name__ == "__main__":
    rnd = random.Random(7)
    # R1-Q1
    sample = [(0, "r1", 1200), (10, "r2", 900), (30, "r1", 1500), (65, "r3", 700), (70, "r2", 800), (70, "r1", 600), (130, "r3", 1000)]
    fw = FareWindow(60)
    got = [fw.add(*e) for e in sample]
    assert got == farewindow_brute(60, sample), (got, farewindow_brute(60, sample))
    print("R1-Q1 sample:", got)
    for _ in range(3000):
        w = rnd.randint(1, 20); ts = 0; evs = []
        for _ in range(rnd.randint(1, 30)):
            ts += rnd.choice([0, 0, 1, 2, 5, 9, 25])
            evs.append((ts, "r%d" % rnd.randint(1, 5), rnd.randint(0, 50)))
        fw = FareWindow(w)
        assert [fw.add(*e) for e in evs] == farewindow_brute(w, evs)
    print("R1-Q1 random: ok")
    # R1-Q2
    for amts, T in [([200, -150, 300, -50, 400, 100], 450), ([100, -300, 250, 250], 500), ([50, 60], 200), ([500], 500), ([], 10), ([300, -100, 300, 400], 600)]:
        r = shortest_burst(amts, T); assert r == shortest_burst_brute(amts, T); print("R1-Q2", amts, T, "->", r)
    for _ in range(5000):
        a = [rnd.randint(-50, 60) for _ in range(rnd.randint(0, 25))]; T = rnd.randint(1, 120)
        assert shortest_burst(a, T) == shortest_burst_brute(a, T), (a, T)
    print("R1-Q2 random: ok")
    # R2-Q1
    for seats, cap in [([1, 2, 3], 4), ([2, 2, 3], 6), ([1, 2, 3, 4], 6), ([4, 4, 4, 4], 15), ([5], 4), ([1, 1, 2, 3, 5], 7)]:
        r = first_player_wins(seats, cap); assert r == game_brute(seats, cap) == first_player_wins_multiset(seats, cap)
        print("R2-Q1", seats, cap, "->", r, "winning first moves (idx):", winning_moves(seats, cap))
    for _ in range(1500):
        s = [rnd.randint(1, 6) for _ in range(rnd.randint(0, 7))]; c = rnd.randint(0, 20)
        assert first_player_wins(s, c) == game_brute(s, c) == first_player_wins_multiset(s, c)
    print("R2-Q1 random: ok")
    import time; t = time.time(); s = list(range(1, 19)); first_player_wins(s, 60); print("R2-Q1 n=18 cap=60 bitmask secs", round(time.time() - t, 2))
    t = time.time(); s = [rnd.randint(1, 8) for _ in range(40)]; first_player_wins_multiset(s, 100); print("R2-Q1 multiset n=40 secs", round(time.time() - t, 2))
    # R2-Q2
    for sizes, M, F in [([300, 200, 600, 100, 900, 50, 1500, 400], 1024, 10000), ([100] * 5, 512, 0), ([2000], 1024, 7)]:
        r = plan_compaction(sizes, M, F); assert r[0] == compaction_brute(sizes, M, F); print("R2-Q2", sizes, M, F, "->", r)
    for _ in range(2000):
        sz = [rnd.randint(1, 140) for _ in range(rnd.randint(1, 10))]; M = rnd.randint(50, 200); F = rnd.randint(0, 3000)
        assert plan_compaction(sz, M, F)[0] == compaction_brute(sz, M, F)
    print("R2-Q2 random: ok")
