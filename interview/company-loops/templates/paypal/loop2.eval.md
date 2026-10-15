# PayPal · Loop 2 — evaluator notes (hidden from candidates)

## PYP-L2-01

**Reference solution**

```python reference
import heapq


def settle_group(members, expenses, repaid, currencies, home, remainder):
    joined = {m: i for i, m in enumerate(members)}
    bal = dict.fromkeys(members, 0)
    e_home = currencies[home][0]
    for payer, amount, code, parts in expenses:
        if code != home:
            e, num, den = currencies[code]
            top = amount * num * 10 ** e_home
            bottom = den * 10 ** e
            amount = (2 * top + bottom) // (2 * bottom)       # half up, once, before the split
        bal[payer] += amount
        share, left = divmod(amount, len(parts))
        order = parts if remainder == "listed" else sorted(parts, key=joined.__getitem__)
        for i, m in enumerate(order):
            bal[m] -= share + (1 if i < left else 0)
    for a, b, x in repaid:
        bal[a] += x
        bal[b] -= x

    creditors = [(-v, joined[m], m) for m, v in bal.items() if v > 0]   # largest first, then joined first
    debtors = [(v, joined[m], m) for m, v in bal.items() if v < 0]      # most negative first
    heapq.heapify(creditors)
    heapq.heapify(debtors)
    out = []
    while creditors and debtors:
        c, ci, cm = heapq.heappop(creditors)
        d, di, dm = heapq.heappop(debtors)
        x = min(-c, -d)
        out.append((dm, cm, x))
        if -c > x:
            heapq.heappush(creditors, (c + x, ci, cm))
        if -d > x:
            heapq.heappush(debtors, (d + x, di, dm))
    return out
```

**Explanation.** Two independent parts. Balances are one pass: convert an expense once (Very Hard), split it with `divmod` so the shares add up exactly, and give the leftover units to the first participants by the stated order; repayments move both balances. Settlement then repeats one step: the largest creditor and the most negative debtor, ties to the earlier join index, transfer the smaller of the two magnitudes. The heap keys `(−balance, join index)` and `(balance, join index)` encode the rule and the tie exactly. After a transfer at least one of the two is at zero and is dropped; the other is pushed back with its new balance, so each step is O(log n). Because balances sum to zero, the creditors and debtors run out together.

**Complexity.** O(Σ participants + n log n) time, O(n) memory. At most n − 1 transfers, since each one clears a member. The timing test (40 000 members, 64 000 expenses, 2 to 6 participants each) runs in about 0.2 to 0.3 s in CPython. Scanning every member for the largest creditor and debtor before each transfer takes about 13 s at 10 000 members and grows with n²; on the timing test itself it was still running when stopped at 120 s.

**The middle approach.** The likely middle answer keeps one list of non-zero balances and calls `sort` after every transfer. Timsort is fast on a nearly sorted list (close to O(n) with C comparisons), but it still touches every member per transfer, so it is O(n²) overall: about 16 s at 10 000 members and 83 s at 20 000 in CPython, and on the timing test itself it was still running when stopped at 120 s, far over the 8 s limit. It fails. Two sorted lists maintained with `bisect.insort` (remove the two, reinsert the survivor) are O(log n) comparisons and O(n) memory moves in C per transfer; at 40 000 members that passes and is an acceptable answer if the candidate states the memmove cost. A balanced tree or a sorted container is also fine.

**Dialect notes.** In SQL the balances are a `GROUP BY` over expense shares (the remainder needs `ROW_NUMBER()` over the participant order) plus repayments; the settlement rule is inherently sequential and is not a natural set-based query (a recursive CTE can do it one transfer per step, which is O(n²)). In Java use two `PriorityQueue<long[]>` with comparators on balance then join index, and `long` amounts; the conversion `amount × num × 10^e` should use `long` or `BigInteger` and be checked for overflow. Not executed here.

**Edge cases built into the tests.** A split with leftover units where listed and join order differ; a payer outside the participants; everyone already even (`[]`); an expense for the payer alone; equal creditors and equal debtors (join-order ties); one transfer clearing both sides; a group where largest-first makes four transfers although three would do; a member in no expense. Hard adds a repayment, a repayment that overshoots (a debtor becomes a creditor) and leftover units over several expenses. Very Hard adds a conversion landing on exactly half a minor unit (rounds up), three-decimal and zero-decimal currencies, and a conversion that must be rounded once before the split rather than per share.

**Common mistakes.** Floats for shares (`amount / k`), so shares do not add up; giving the remainder to the payer or to the last participant; forgetting the payer's own share; ties by member id instead of join order; "optimising" to fewer transfers, which breaks the stated rule; converting per share; using an exponent of 2 for every currency; a min-heap of creditors keyed on `+balance`; pushing back both members after a transfer, including one at zero.

**Follow-up guidance.** (1) Each transfer sets at least one balance to zero and never makes a zero non-zero, so the number of non-zero balances drops every step: at most n − 1 transfers. (2) The example in the tests: balances +4, +3, +2, −5, −4. Largest-first makes four transfers; {+3, +2, −5} and {+4, −4} make three. The fewest transfers equals n minus the largest number of disjoint zero-sum groups, which is NP-hard in general (it contains subset sum). (3) It becomes a flow problem on the allowed edges: feasibility via max flow, and the fixed largest-first rule may get stuck. (4) Recompute balances incrementally (each expense touches only its participants); keep paid transfers as repayments; a stable plan matters to users, so present a new plan as a delta and recompute only on request.

**Rubric anchors.** 2: floats or a remainder rule that drops a cent, or a linear scan per transfer. 3: all tests pass with two heaps or an equivalent O(log n) structure. 4: also proves termination and the n − 1 bound, explains why largest-first is not minimal, and handles conversion rounding precisely.

**Strong signals.** Asks who receives the leftover cents and how ties break before coding; checks that shares sum to the expense. **Red flags.** "Round each share to the nearest cent"; claims the greedy is optimal.

## PYP-L2-02

**Reference solution**

```python reference
def lowest_balance(opening, arrivals):
    # Every event's final place in history: by t, then by its first arrival.
    first = {}
    for i, (eid, t, _) in enumerate(arrivals):
        if eid not in first:
            first[eid] = (t, i)
    order = sorted(first, key=first.__getitem__)
    slot = {eid: p for p, eid in enumerate(order)}
    when = [first[eid][0] for eid in order]

    size = 1
    while size < len(order):
        size *= 2
    INF = float("inf")
    total = [0] * (2 * size)         # sum of a node's filled slots
    low = [INF] * (2 * size)         # lowest prefix sum inside the node (INF when empty)
    pos = [-1] * (2 * size)          # slot where that lowest prefix is first reached
    out = []
    for eid, t, amount in arrivals:
        i = size + slot[eid]
        total[i] = low[i] = amount   # a correction simply rewrites the slot
        pos[i] = i - size
        i >>= 1
        while i:
            l = 2 * i
            r = l + 1
            right = total[l] + low[r]
            total[i] = total[l] + total[r]
            if low[l] <= right:      # ties: the earlier (left) event wins
                low[i] = low[l]
                pos[i] = pos[l]
            else:
                low[i] = right
                pos[i] = pos[r]
            i >>= 1
        out.append((opening + low[1], when[pos[1]]))
    return out
```

**Explanation.** Running balances are `opening` plus prefix sums in history order, so the answer is the minimum prefix sum over the filled history. The whole arrival list is known, so every event's final slot is known: sort events by `(t, first arrival)`. A segment tree over the slots keeps, per node, the total of its filled slots and the lowest prefix sum within it; combining left and right gives `min(L.low, L.total + R.low)`. Empty slots have total 0 and low +∞, so they neither move later balances nor become the answer. Each arrival fills or rewrites one leaf and updates log n ancestors; the root holds the answer, and the stored position (left preferred on ties) gives the earliest event with that balance.

**Complexity.** O(n log n) for the sort plus O(log n) per arrival; O(n) memory. The timing test (80 000 arrivals, 40% back-dated to a random earlier minute) runs in about 0.7 to 0.85 s in CPython with flat lists. Re-sorting and recomputing all balances per arrival takes about 13 s at 20 000 arrivals and grows with n².

**The middle approach.** The likely middle answer keeps the history in a list (`bisect.insort` by `(t, arrival)`), keeps the running balances, and after each arrival recomputes balances only from the inserted position on, then takes `min` over the list. With C-speed `itertools.accumulate` and `min` it is still O(n) per arrival because back-dated events land early: measured at about 5.8 s for 20 000 arrivals, 27 s for 40 000, and about 150 s on the 80 000-arrival timing test (more than 150 s at Very Hard, where corrections add work). It fails by a factor of more than 100. Keeping a prefix-minimum array as well does not help, since every prefix minimum after the insertion point also changes. Square-root decomposition (blocks of about √n events with a total and lowest prefix per block) is O(√n) per arrival and lands near the limit in CPython; accept it with a correct argument, but probe its constant. An online balanced tree (treap) with the same augmentation is a fully acceptable answer and handles follow-up 1.

**Dialect notes.** In SQL the lowest balance at the end is `MIN(SUM(amount) OVER (ORDER BY t, arrival_seq ROWS UNBOUNDED PRECEDING))`; the answer "after each arrival" needs one window per arrival, which is the O(n²) recompute. Streaming engines compute it incrementally only for in-order data; back-dated events force a recomputation of the affected range or a tree-like state. In Java the same segment tree with `long[]` arrays and `Long.MAX_VALUE` as the empty low (careful: `total + Long.MAX_VALUE` overflows, so test emptiness explicitly). Not executed here.

**Edge cases built into the tests.** One event (its balance, not the opening balance); events in time order; a back-dated debit making a new low; a back-dated credit moving the low; an event dated before everything arriving last; equal lows (the earlier event wins), including equal lows created by a late event between them; a balance below zero. Hard adds same-minute events ordered by arrival, and a later arrival at the same minute that is lower. Very Hard adds corrections that rewrite an amount in place, a correction to zero that cancels the low, and a correction of the first event that shifts every later balance.

**Common mistakes.** Including the opening balance as a candidate; ordering same-minute events by amount or id; inserting a correction as a new event; reporting the latest event on a tie; using 0 instead of +∞ for an empty slot, which makes the low 0 too early; recomputing from the insertion point and calling it O(log n) because of `bisect`; a recursive tree that rebuilds per arrival.

**Follow-up guidance.** (1) An order-statistic balanced tree (treap, AVL, skip list) keyed by `(t, arrival)` with subtree total and lowest prefix; insertion and rotation update the augmentation in O(log n). (2) A range query on the same tree: combine the O(log n) nodes covering the range, carrying the total before the range so prefixes start from the right balance. (3) Keep a tree per account, persisted with checkpoints per period (period total and lowest prefix), so a back-dated event updates one period and the path above it; show the user that a past low changed and why. (4) Balances in several currencies have no single running total without choosing rates and a time; refuse to sum across currencies, report a low per currency, or convert with a stated rule and say so.

**Rubric anchors.** 2: recomputes per arrival, or wrong ordering or tie rule. 3: all tests pass with a segment tree or an equivalent O(log n) structure. 4: also derives the combine rule and the tie argument cleanly and answers the online and range follow-ups concretely.

**Strong signals.** Writes the two-number block summary before coding; asks how same-minute events are ordered. **Red flags.** "Just sort and recompute, it's only 80 000"; treats `insort` as making the whole update logarithmic.

## PYP-L2-03

**Reference solution** (the fixed statement)

```python reference
from datetime import datetime, timedelta, timezone


def _round_half_up(n, d):
    return (2 * n + d) // (2 * d)


def _to_home(amount, code, home, currencies, rates):
    """Minor units of code -> minor units of home, at one cross rate, rounded once."""
    num, den = rates[code]
    hnum, hden = rates[home]
    top = amount * num * hden * 10 ** currencies[home]
    bottom = den * hnum * 10 ** currencies[code]            # the currency's own exponent
    return _round_half_up(top, bottom)


def _local_month(ts, offset_minutes):
    when = datetime.fromisoformat(ts).astimezone(timezone(timedelta(minutes=offset_minutes)))
    return when.strftime("%Y-%m")


def monthly_statement(entries, month, offset_minutes, home, currencies, rates):
    out = {"sent": 0, "received": 0, "net": 0, "from_balance": 0, "from_linked": 0, "reversed": 0}
    reversed_ids = {e["reverses"] for e in entries if e["kind"] == "reversal"}
    for e in entries:
        if e["kind"] == "reversal":
            continue                                          # never counted itself
        if _local_month(e["ts"], offset_minutes) != month:
            continue
        if e["id"] in reversed_ids:
            out["reversed"] += 1                              # in neither total
            continue
        amount = _to_home(e["amount"], e["currency"], home, currencies, rates)
        if e["kind"] == "sent":
            out["sent"] += amount
            for source, outcome in e["funding"]:
                if outcome != "used":
                    continue                                  # a declined attempt moved no money
                if source == "balance":
                    out["from_balance"] += amount
                else:
                    out["from_linked"] += amount
        else:
            out["received"] += amount
    out["net"] = out["received"] - out["sent"]
    return out
```

**The planted bugs, their symptoms and their fixes.**
1. **Every currency assumed to have two decimals.** `_to_home` divides by `10 ** 2` instead of `10 ** currencies[code]`. Symptom: yen amounts (0 decimals) come out a hundred times too small, dinar amounts (3 decimals) ten times too large; dollar, euro and pound amounts are right, so it hides in most data. Fix: use the source currency's exponent.
2. **Rounded twice.** The amount is first rounded to US cents, then converted to the home currency and rounded again. Symptom: when neither currency is the US dollar, some amounts are a minor unit off the one-step conversion shown to the user. Fix: one cross-rate expression, rounded once.
3. **Reversals counted as payments.** Every non-sent entry, reversals included, is added to `received`, reversed payments are kept, and `reversed` stays 0. Symptom: a reversed payment inflates both totals (the net hides it); a payment reversed next month still counts. Fix: collect reversed ids over all entries, skip reversal entries, skip and count reversed payments.
4. **The month relabels UTC.** `replace(tzinfo=…)` attaches the offset to the UTC wall-clock time instead of converting, so the month is always the UTC month. Symptom: a California user's evening payment on 30 September appears in October; a Sydney user's morning payment on 1 November appears in October. Fix: `astimezone`.
5. **Funding fallbacks counted twice.** The funding loop adds the amount for every attempt, declined ones included. Symptom: a payment that fell back from the balance to a card is counted in both `from_balance` and `from_linked`, which then exceed `sent`. Fix: count only the used attempt.

Each bug has its own checks, and fixing one bug turns exactly its checks green (verified by fixing each alone): a yen and a dinar entry with home US dollars (bug 1); euros into pounds at an amount where the two roundings differ (bug 2); a payment reversed in the same month and one reversed next month (bug 3); 02:00 UTC on the 1st for a user west of UTC and 22:00 UTC on the last day for a user east of UTC (bug 4); a balance declined then a card used (bug 5). The plain US-dollar check and the other-month check pass on the original code and stay as regression checks. Random samples can hit several bugs at once.

**Explanation.** A statement is three decisions per entry: does it belong to this month (converted to the user's offset, and not reversed), how much is it in the home currency (one exact conversion with each currency's exponent), and where does it go (sent or received, and the used funding source). Each bug breaks one of them.

**Complexity.** O(n) time and memory for the reversed-id set. The timing test (50 000 or 100 000 entries in five currencies) runs in about 0.25 to 0.5 s in CPython, most of it parsing timestamps.

**Dialect notes.** In SQL the local month is `date_trunc('month', ts AT TIME ZONE 'UTC' + offset)` with a numeric offset, or `AT TIME ZONE tz_name` in PostgreSQL, `CONVERT_TIMEZONE` in Snowflake, `DATETIME(ts, tz)` in BigQuery. Integer conversion with half-up rounding is `(2 * top + bottom) / (2 * bottom)` with integer division (`DIV` in BigQuery and MySQL; PostgreSQL `/` on integers truncates, which is correct for non-negative values). Avoid `ROUND(numeric)` unless you know its tie rule in that engine, and never `FLOAT`. Not executed here.

**Edge cases built into the tests.** A plain month in US dollars; month edges for users west and east of UTC; a balance declined then a card used; a reversal in the same month and one in the next month; yen and dinar amounts into US dollars; euros into pounds where double rounding differs; an entry from another month.

**Common mistakes.** Fixing the yen case with a special case for JPY instead of reading the exponent; switching to floats or `Decimal` with `ROUND_HALF_EVEN` for the conversion; excluding the reversal entry but keeping the reversed payment; counting reversals only when both are in the same month; flipping the offset sign while fixing the month; dropping the funding fallback entirely instead of keeping the used attempt; rewriting the function.

**Follow-up guidance.** (1) The rate shown at the time of the payment, stored on the entry with its quote id (see PYP-L2-05); the statement never looks up a rate later. (2) Either restate with a visible correction or show the reversal in the month it happened; this specification restates totals, so the previous statement must be versioned and the user told what changed. (3) Store the offset or time zone in force with each entry; months near the move can change if the statement uses the current offset. (4) Notifications rounded differently, rates looked up at different times, reversals after the notification, a different month boundary; rules 2, 4 and 5 prevent each.

**Rubric anchors.** 2: finds two or three bugs; some checks still fail. 3: all five fixed, each explained with its symptom. 4: also shows a concrete double-rounding amount, explains relabelling versus converting, and answers the rate-at-time and restatement follow-ups well.

**Strong signals.** Works a yen amount by hand first; asks whether the reversal can be in another month. **Red flags.** "Use floats and round at the end"; treating a reversal as a refund received.

## PYP-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Events.** Server: `payment_started (payment_id, user_ref, amount_minor, currency, client, started_at)`, `funding_attempt (payment_id, attempt_no, source_ref, source_kind balance|bank|card, outcome used|declined, decline_category, risk_hold bool, decided_at, latency_ms)`, `payment_finished (payment_id, status completed|cancelled|failed, finished_at)`. Client: `funding_screen (client_event_id, payment_id, screen source_chosen|fallback_notice|choose_another|cancelled, shown_at_client, received_at)`. `source_ref` is an opaque per-linked-source token, never a card or account number.
- **Ids.** The server mints `payment_id` before the first attempt and returns it to the client, so every screen carries it. `attempt_no` gives the order, bounded by {{max_attempts}}. Client events carry a random `client_event_id` for deduplication.
- **Authority.** Money outcomes come only from server attempts and `payment_finished`; what the user saw comes only from client screens. Silent fallbacks are attempts with no matching screen.
- **Pipeline.** Server events are produced transactionally with the payment write (an outbox) so none are lost. Client events go through the collection endpoint, deduplicated on `client_event_id`. A stream job builds `fact_funding_attempt` and `fact_payment_funding (payment_id, attempts, first_source_kind, used_source_kind, fallback bool, silent_fallback bool, user_cancelled bool, total_latency_ms, status, day)` and joins screens with an allowed lateness of {{late_hours}} hours; daily partitions are rewritten when late screens arrive, and a day is marked final after the lateness window.
- **Reconciliation.** Daily completed counts and amounts per currency in `fact_payment_funding` must equal the payment system of record; differences are listed by payment id and block publication.
- **Reports.** Decline rate per source kind and category (denominator: attempts), fallback success (denominator: payments with a fallback), user-visible fallback rate, time to complete, cancellations at the prompt; all aggregates by client, country and day.

**Competing designs to accept.** One wide "payment" event with an attempts array emitted at the end (accept if they handle payments that never finish and late client screens); CDC from the payments database instead of emitted events (accept if they still capture declined attempts and screens); a lambda-style daily batch plus a provisional stream. All fine if order, authority, deduplication, lateness and reconciliation are explicit.

**Bottlenecks and failure modes.** Card details leaking through error payloads; client retries doubling screens; attempts without a payment id; clock skew between client and server; changing decline categories; denominators mixed between attempts and payments; late events rewriting old partitions forever.

**Incident guidance.**
- *Screen events resent on resume*: deduplication on `client_event_id` should already absorb it; if the client minted new ids, deduplicate on `(payment_id, screen, shown_at_client)`, rewrite the two days' partitions, and add a monitor on screens per payment against attempts per payment by client version.
- *Masked card numbers in the decline detail*: stop the field at ingestion (schema allow-list of decline categories, no free text), delete the six hours of raw and derived data and verify, tell the privacy owner, and add a scanner for card-number patterns on every analytics field.

**Follow-up guidance.** (1) As above: dedup rate, category mapping, schema changes per client version, denominators, reconciliation. (2) `source_kind` is an enum with an "other" default and a version; reports group unknown kinds visibly; dashboards and tests updated before launch. (3) Per-user tips need user-level history, which is the user's own data shown to that user only; compute it in a separate store with its own access and retention, never in the aggregate tables. (4) Close days after {{late_hours}} hours, route later events to a corrections table applied in a weekly restatement, and show "provisional" on open days.

**Rubric anchors.** 2: one event per payment with no attempts, or card numbers in analytics, or no deduplication. 3: attempt-level and payment-level facts, server authority, client screens joined with lateness, deduplication, reconciliation. 4: also silent fallbacks, explicit denominators, outbox-style delivery, finality rules and the per-user data kept apart.

**Strong signals.** Separates "what happened to the money" from "what the user saw" early; names denominators. **Red flags.** Logging masked card numbers "for debugging"; computing success from client events.

## PYP-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Quote record (immutable).** `quote (quote_id, user_ref, pair, send_currency, receive_currency, send_amount_minor, receive_amount_minor, base_rate, fee_bps or margin, quoted_rate, rate_set_version, rounding_rule_version, send_exponent, receive_exponent, issued_at, expires_at)`. Rates are stored as exact decimals or integer ratios, never floats. `receive_amount_minor` is computed once with the stated rule (half up, receive currency's exponent from data).
- **Acceptance.** `quote_state (quote_id, state open|accepted|expired, accepted_at, conversion_id)`. Acceptance is one conditional write: `UPDATE … SET state='accepted' WHERE quote_id=? AND state='open' AND now() < expires_at`, using server time; zero rows updated means expired or already used, and the client is shown a fresh quote. Client retries carry the same quote id, so a second acceptance is a no-op that returns the first result.
- **Conversion record.** `conversion (conversion_id, quote_id, payment_id, send_amount_minor, receive_amount_minor, applied_rate, created_at)`, written in the same transaction as the acceptance, with `applied_rate` and amounts copied from the quote; a check constraint or validation recomputes the amount from the stored inputs.
- **Proof and reconciliation.** A daily job joins every conversion to its quote and verifies: quote exists, accepted before expiry, single use, applied rate and amounts equal, recomputation from inputs matches. Exceptions go to a queue with the payment id. Quote and conversion tables are append-only with change history; the audit set (accepted quotes and their conversions) is kept {{audit_years}} years, with hashes or signed daily manifests for tamper evidence.
- **Unaccepted quotes.** At {{daily_quotes}} a day most are never used: keep them in full for a short window (for disputes about what was shown), then aggregate to pair, hour, shown, accepted, expired, mean margin, and drop the rows.
- **Rate sets.** The upstream feed is ingested as versioned rate sets; each quote references its version, so a bad set can be traced to every quote and conversion that used it.

**Competing designs to accept.** A signed quote token held by the client and verified on acceptance (accept if single use is enforced server-side); an event-sourced quote log; storing only accepted quotes plus aggregates (accept if the "what was shown" question can still be answered for the dispute window).

**Bottlenecks and failure modes.** Floats for rates; rounding twice or with the wrong exponent; client clocks deciding expiry; quotes in a cache without a durable record; double acceptance from two devices; bad upstream rates; unbounded growth of unaccepted quotes.

**Incident guidance.**
- *A rate off by a factor of 100*: stop quoting from that rate-set version, find every quote issued from it (by `rate_set_version` and pair) and every conversion accepted from those quotes, measure the money impact per currency, decide remediation by policy, and add a jump-limit check per pair before a rate set reaches quoting.
- *Client time used for expiry*: revert to server time, list acceptances where server receive time was after `expires_at`, quantify the market difference the business carried, and add a reconciliation rule that flags any conversion accepted after its quote's expiry.

**Follow-up guidance.** (1) Query by `rate_set_version` and pair; conversions join through `quote_id`; measure the money impact per currency. (2) Produce the quote as shown (rate, amounts, expiry), the acceptance time against expiry, the conversion record, and a recomputation from stored inputs; show that the applied rate equals the quoted rate. (3) The business carries the market move between issue and acceptance; build a table of quoted rate versus market rate at acceptance per pair and hour, and set the lifetime per pair from it. (4) Tier unaccepted quotes to aggregates after the dispute window; keep accepted quotes and conversions in compressed, partitioned storage for {{audit_years}} years.

**Rubric anchors.** 2: rates in a cache only, client-side expiry, or floats. 3: immutable quotes, atomic single-use acceptance on server time, conversions linked to quotes, one rounding with exponents from data. 4: also rate-set versioning, recomputation-based proof, differentiated retention and a clear plan for a bad upstream rate.

**Strong signals.** Asks whose clock decides expiry and where rounding happens; stores inputs, not only outputs. **Red flags.** "We recompute the rate at settlement"; storing quotes only in a cache.
