# Walmart Global Tech · Loop 2 — evaluator notes (hidden from candidates)

## WMT-L2-01

**Reference solution**

```python reference
from itertools import combinations


def frequent_pairs(baskets, s, max_items=None):
    counts = {}
    for basket in baskets:
        items = sorted(set(basket))                 # repeats removed, name order
        if max_items is not None and len(items) > max_items:
            continue                                 # a bulk basket: no pair is generated
        for pair in combinations(items, 2):
            counts[pair] = counts.get(pair, 0) + 1
    out = [(a, b, c) for (a, b), c in counts.items() if c >= s]
    out.sort(key=lambda t: (-t[2], t[0], t[1]))
    return out
```

**Explanation.** The pairs that can ever reach the threshold are the pairs that occur inside some basket, so count exactly those. Each basket is reduced to its sorted set of distinct items. That removes repeated scans, makes sure an item never pairs with itself, and makes `combinations` emit every pair already in name order `a < b`. A dictionary keyed by the pair counts baskets. The threshold is inclusive. The final sort uses `(-count, a, b)`. Under the bulk rule, the distinct-item count is checked before any pair is produced: a basket of 4 000 items holds about eight million pairs, so a filter applied after counting is far too late.

**Complexity.** O(Σ b²) pair increments, where b is the number of distinct items in each counted basket, plus O(Σ |basket| log b) to deduplicate and sort, plus O(P log P) to sort the P qualifying pairs. Memory is O(distinct pairs seen). The timing tests (40 000 to 50 000 baskets over 4 000 to 5 000 items, about 650 000 pairs; Very Hard adds 30 bulk baskets of 4 000 items) run in about 0.3 to 0.4 s in CPython. The likely "middle" approach is Apriori-style: keep a set of basket ids per item, prune items with support below `s`, then intersect the sets for every pair of remaining items. At these sizes almost every item survives the pruning (each appears in about 45 baskets, against `s` of 15 or 20), so it is 8 to 12 million intersections. It takes 11 to 18 s, over the 8 s limit and 30 to 45 times slower than counting in baskets. Scanning every basket for every pair of catalogue items is O(I²·n), about 10¹² checks. Counting pairs before applying `max_items` spends about 240 million increments on the bulk baskets alone.

**Dialect notes.** In SQL this is a self-join of distinct basket lines on the basket id with `a.item < b.item`, then `GROUP BY a.item, b.item HAVING COUNT(*) >= s`. Deduplicate lines first (`SELECT DISTINCT basket_id, item`), and filter bulk baskets with a `HAVING COUNT(DISTINCT item) <= max_items` subquery before the join, or the join explodes in the same way. In Spark, `flatMap` each basket to its pairs and `reduceByKey`; skew comes from very popular items, not from the pair count. In Java or C++, pack two item indices into one 64-bit key rather than allocating a pair object for each increment. Not executed here.

**Edge cases built into the tests.** A pair in exactly `s` baskets (included) and in `s − 1` (excluded); items scanned in reverse name order; ties in count ordered by `a` then `b`; `s = 1`; an item listed twice (counted once, never paired with itself); empty and one-item baskets; no qualifying pair (empty list); at Very Hard, a basket with exactly `max_items` distinct items (counted), one more (skipped), and repeats that do not push a basket over the limit.

**Common mistakes.** Counting a pair twice when an item is listed twice; pairing an item with itself; emitting `(b, a)` for a basket scanned in reverse order, so one pair is counted under two keys; `>` instead of `>=`; sorting by count only, so the output order depends on dictionary order; checking `max_items` against `len(basket)` instead of distinct items; generating every pair and then discarding bulk baskets; looping over all catalogue pairs.

**Follow-up guidance.** (1) Lift = P(a and b) / (P(a) · P(b)), or confidence = P(b | a). Both correct for popularity, but they are noisy for rare items, so keep a minimum support or use a shrunk estimate. (2) Map each basket to its pairs and reduce by pair key. The shuffle carries Σ b² records, so combine locally before shuffling, and drop bulk baskets first. Very popular items make some pair keys hot, so a two-stage aggregation helps. (3) Triples grow as Σ b³. Apriori pruning applies: a triple can only be frequent if all three of its pairs are, so generate candidate triples from frequent pairs inside each basket. (4) Compare with the same week last year and with nearby regions, join promotion and planogram calendars, and check basket counts and data completeness for that region before believing it.

**Rubric anchors.** 2: an all-pairs or set-intersection approach that times out, or misses deduplication or the tie order. 3: all tests pass by counting inside baskets, with distinct items and the bulk rule applied first. 4: also gives the O(Σ b²) argument with numbers, explains why the intersection approach does not scale here, and handles lift, distributed counting and triples well.

**Strong signals.** Asks whether repeats count before coding; estimates the pair count of a bulk basket; sorts each basket once so pair keys are canonical. **Red flags.** Builds every catalogue pair "to be safe"; defends raw counts as the final measure when popular items dominate.

## WMT-L2-02

**Reference solution**

```python reference
def area_sales(grid, queries):
    R, C = len(grid), len(grid[0])
    P = [[0] * (C + 1)]                    # P[i][j] = total of rows < i and columns < j
    for row in grid:
        above = P[-1]
        cur = [0] * (C + 1)
        run = 0
        for j, v in enumerate(row):
            run += v
            cur[j + 1] = above[j + 1] + run
        P.append(cur)
    out = []
    for r1, c1, r2, c2 in queries:
        if r1 > r2:
            r1, r2 = r2, r1
        if c1 > c2:
            c1, c2 = c2, c1
        r1, c1 = max(r1, 0), max(c1, 0)
        r2, c2 = min(r2, R - 1), min(c2, C - 1)
        if r1 > r2 or c1 > c2:
            out.append(0)                  # no cell of the rectangle is on the floor
            continue
        out.append(P[r2 + 1][c2 + 1] - P[r1][c2 + 1] - P[r2 + 1][c1] + P[r1][c1])
    return out
```

**Explanation.** A prefix-sum table with one extra row and column of zeros removes every boundary case: `P[i][j]` is the total of all cells in rows below `i` and columns below `j`. A row's running sum plus the row above builds it in one pass. A rectangle is then the large prefix, minus the prefix above it, minus the prefix to its left, plus the corner removed twice. Before the lookup, the corners are put in order, because staff draw from either corner, and clipped to the floor. A rectangle that has no cell on the floor after clipping returns 0 rather than a meaningless lookup.

**Complexity.** O(R·C) to build and O(1) per rectangle, so O(R·C + q) time and O(R·C) memory. The timing test (600 × 800 cells, 80 000 rectangles, most covering about two thirds of the rows) runs in about 0.15 s in CPython. The "middle" approach a strong candidate may write first is a prefix sum per row (or `itertools.accumulate` per row) with a loop over the rectangle's rows. That is O(q·rows), about 32 million Python-level steps, and it takes about 13 s, over the 8 s limit and nearly 90 times slower. Summing row slices with `sum(grid[r][c1:c2 + 1])` runs each slice at C speed, but it is still one slice per row of every rectangle, about 190 s. NumPy slicing of a 2D array is O(area) per rectangle too. Only the 2D prefix table, in NumPy or not, makes each rectangle O(1).

**Dialect notes.** In SQL, a summed-area table can be built with window functions (`SUM(v) OVER (PARTITION BY col ORDER BY row)` and then over columns), and the four-corner lookup is four joins. A plain `SUM(...) WHERE row BETWEEN ... AND col BETWEEN ...` per rectangle is the per-rectangle scan. In Java or C++, use `long` for the table: 480 000 cells of up to 10 000 each fit easily, but larger grids or cents can overflow 32 bits. In NumPy, `arr.cumsum(0).cumsum(1)` padded with zeros builds the same table. Not executed here.

**Edge cases built into the tests.** A single cell; the whole floor, including the last row and column; one full row and one full column; no queries; a one-cell floor; the same rectangle twice; at Hard, corners given in any order and a negative cell; at Very Hard, rectangles that run off the floor (clipped), rectangles entirely off it (0), and a rectangle larger than the floor on every side.

**Common mistakes.** A table without the extra row and column, with `r1 - 1` read as index -1 (Python silently wraps to the last row); off-by-one on the inclusive corners; assuming `r1 <= r2`; clipping only one side; returning a lookup for an empty clipped rectangle (it can be non-zero garbage); summing each rectangle and calling it fast because slices run in C.

**Follow-up guidance.** (1) A 2D Fenwick tree gives O(log R · log C) for both updates and queries. Alternatively, keep the prefix table and a small list of pending updates added to each query, rebuilding the table every so often. (2) Slide a 3 × 4 window using the prefix table: every position is O(1), so O(R·C) in total. (3) Store a prefix table per store and week only if queries are frequent. Otherwise store the cell grid in a columnar format by store and week, and build tables on demand and cache them. Different floor sizes are just different shapes. (4) Normalise by area, linear feet of shelf or fixture type, or compare each cell with the same fixture type across stores, and say which comparison is fair.

**Rubric anchors.** 2: per-rectangle summing, or a prefix table with boundary errors. 3: all tests pass with a padded prefix table, ordered corners and clipping. 4: also explains why per-row prefixes and C-speed slices still lose, and answers the update and sliding-window follow-ups with the right structures and costs.

**Strong signals.** Pads the table to avoid boundary cases; asks whether rectangles can leave the floor; states the q·rows cost of the row-by-row approach with numbers. **Red flags.** "Python slices are fast, so this is fine" without counting slices; ignoring Python's negative-index wrap-around.

## WMT-L2-03

**Reference solution** (the fixed calculator)

```python reference
from datetime import datetime, timedelta


def _units_on_order(orders, case_pack):
    return sum(o["cases"] * case_pack for o in orders if o["status"] == "open")   # only orders still to come


def replenishment_orders(positions, forecast, stores, start, end):
    need = {}                                   # (store, item) -> forecast units
    for f in forecast:
        local = datetime.fromisoformat(f["utc"]) + timedelta(hours=stores[f["store"]])
        day = local.date().isoformat()          # the store-local date of the hour
        if start <= day <= end:
            key = (f["store"], f["item"])
            need[key] = need.get(key, 0) + f["units"]
    orders = {}
    for p in positions:
        key = (p["store"], p["item"])
        available = max(p["on_hand"], 0) + p["backroom"]          # the field is "backroom"; negative on-hand is 0
        available += _units_on_order(p["open_orders"], p["case_pack"])
        short = need.get(key, 0) + p["safety"] - available
        if short > 0:
            orders[p["store"] + "/" + p["item"]] = -(-short // p["case_pack"])   # whole cases, rounded up
    return orders
```

**The planted bugs, their symptoms and their fixes.**
1. **Rounded down to whole cases.** `short // case_pack` orders the cases that fit inside the shortfall, not the cases that cover it. Symptom: orders arrive one case short, and shelves run out a day early. Fix: round up, `-(-short // case_pack)` (or `(short + case_pack - 1) // case_pack`).
2. **Backroom read from a renamed field.** `p.get("back_room", 0)` never finds the `backroom` key, so backroom stock is always 0, and `.get` with a default hides the error. Symptom: stores with full backrooms keep receiving more. Fix: read `p["backroom"]`, and prefer indexing to `.get` with a default for required fields.
3. **Negative on-hand not treated as 0.** `on_hand + backroom` lets a count of −6 cancel six units of backroom or open orders. Symptom: a store whose count went negative after a late receipt over-ordered. Fix: `max(on_hand, 0)` for the floor count alone.
4. **Received orders counted as still on order.** The filter `status != "cancelled"` keeps `"received"` orders, which are already in the counts. Symptom: delivered items treated as still on the way, so stores under-order. Fix: count only `status == "open"`.
5. **Forecast bucketed by UTC date.** `f["utc"][:10]` is the UTC date. For a store at UTC−7, the hours from 17:00 local time onwards fall on the next UTC date, so the window takes the previous evening's hours and loses the last evening's. Symptom: stores in the west order for the wrong days. Fix: add the store's offset before taking the date.

Each bug has its own check, built so the other bugs do not change its result: a shortfall of 14 with a case pack of 6 (bug 1); backroom stock with a shortfall that is a whole number of cases (bug 2); a negative on-hand (bug 3); a received and an open order (bug 4); forecast hours either side of local midnight (bug 5). The cancelled-order check passes on the original code; it is there to catch an over-correction such as counting every status except `"received"`. The "exact cover orders nothing" and "no forecast" checks also catch bugs 2 and 1 in a second setting.

**Explanation.** Replenishment is a position calculation: need (forecast plus safety) against what is or will be in the store (floor, backroom, open orders), turned into whole cases. Each input has a definition that a small code change can break silently: the field name, the meaning of a negative count, which order statuses add future stock, and which local day an hour belongs to.

**Complexity.** O(F + P) for F forecast rows and P positions, with O(store-items) memory. The timing test (40 000 positions and 200 000 forecast hours) runs in about 0.5 s in CPython. `datetime.fromisoformat` is the main cost.

**Dialect notes.** In SQL the forecast step is `GROUP BY store, item` over `(utc_ts + offset_hours * INTERVAL '1 hour')::date BETWEEN :start AND :end`, or `AT TIME ZONE` with a zone name where daylight saving matters. Rounding up is `CEIL(short::numeric / case_pack)`, or the integer form `(short + case_pack - 1) / case_pack`. Integer division in SQL truncates toward zero, which is the same bug as bug 1. A `COALESCE(back_room, 0)` on a renamed column is bug 2 in another form. Not executed here.

**Edge cases built into the tests.** Rounding a part case up; backroom stock; a negative on-hand; received, open and cancelled orders; forecast hours either side of local midnight at both ends of the window; two stores in different time zones at the same UTC hour; stock that exactly covers need plus safety; a position with no forecast that orders up to safety stock; forecast rows for an item the store does not stock.

**Common mistakes.** Fixing rounding with `round()` (rounds a shortfall of 1.4 cases down); clamping `on_hand + backroom` at 0 instead of `on_hand` alone; using `!= "received"`, which counts cancelled orders; subtracting the offset instead of adding it; keeping `.get("back_room", 0)` and adding `.get("backroom", 0)` beside it; rewriting the function instead of making minimal fixes. (`math.ceil(short / case_pack)` is acceptable at these sizes; it goes through a float, which is worth one question.)

**Follow-up guidance.** (1) Safety stock from forecast error: for example a multiple of the standard deviation of forecast error over the lead time, per item and store, with a service-level target. Use the history of forecasts against sales, not just sales. (2) Store the pack size on each open order, so old orders convert with the pack they were placed in. Version the item's pack with effective dates. (3) Repeated negatives for the same items point to receiving or scanning process problems. Rank store-items by how often and how far they go negative, and schedule cycle counts there. (4) Schedule each store's run after its local close, in time-zone waves. Treat late forecasts or receipts as inputs to the next run, and alert when a run uses stale inputs.

**Rubric anchors.** 2: finds two or three bugs, and checks still fail. 3: all five fixed, every check passes, each explained. 4: also names each bug's store-level symptom, adds a regression test per bug, explains why `.get` with a default hid bug 2, and answers the daylight-saving and late-receipt follow-ups concretely.

**Strong signals.** Works one position by hand before editing; checks field names against the data; reasons about a western store at local midnight. **Red flags.** Clamps the whole availability at 0 "to be safe"; treats the negative count as an error to raise; changes the output format.

## WMT-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Events, keyed and deduplicated.** `order_placed` and `line_edited` (order id, line id, item, quantity, estimated weight, unit price per kg or per pack, estimate in cents, price version). `line_picked` (line id, pick id, measured grams or label price and grams, scale or label source, device id, store). `line_substituted` (original line id, substitute line id, rule used). `line_short` (quantity not found). `handed_over` (order id, final total, captured amount). `line_returned` (line id, returned grams or quantity, refund in cents). Every event carries an event id generated on the device. The pipeline deduplicates on it, so a resend after reconnecting is a no-op.
- **Line model.** `order_line` keeps the estimate and never changes after the order is placed (edits create a new version). `fulfilment_line` holds what was picked: one or more picks per ordered line, a substitute linked to the original, and the short quantity. `charge_line` holds the final price inputs (grams, price per kg, price version, rule version) and the rounded amount, computed once with this exercise's rule (half up to the cent). Returns link to the charge line.
- **Final charge.** final per line = round_half_up(grams × price_per_kg / 1000) in integer arithmetic (for example `(grams * price_cents_per_kg + 500) // 1000`). The price version is the one in force at the pick, or the lower of the order-time and pick-time prices, stated as this exercise's rule and recorded on the line. The order total is the sum of line totals, so it reconciles exactly.
- **Over-buffer handling.** If the final total exceeds the authorised amount, the options are a re-authorisation for the difference, capping the charge at the authorised amount and absorbing the difference, or asking the customer at handover. Record which happened (`capture_mode`). The analytics track the rate and the amount absorbed.
- **Receipts.** The customer receipt is rendered from the charge lines and their recorded inputs, so it can be rebuilt exactly months later. Nothing is recomputed from the current price file.
- **Analytics (aggregate).** Estimate accuracy per item, store and week (final over estimated, distribution of the ratio); the share of orders above the buffer, and the amount; estimated, authorised and captured revenue per day; substitution and short rates for weighed lines. No customer-level reporting.

**Competing designs to accept.** One wide line table with an estimate snapshot and actual columns (fine if the estimate is never overwritten and picks are not limited to one per line); event-sourced line state with a materialised current view; streaming computation of final charges at handover with a nightly batch for analytics. Any is acceptable if the inputs to each charge are stored and the rounding rule is stated.

**Bottlenecks and failure modes.** Overwriting the estimate with the actual; floats for weights or prices; recomputing old receipts from today's prices; a substitution that loses the link to the original line; double-counted picks after a device resend; per-unit rounding summed into a line total that does not match the receipt.

**Incident guidance.**
- *Deli prices ten times too high for three hours*: find the affected lines by price version and store (the price version on each charge line makes this a query). Refund the difference per line in cents. Correct the price file with a new version, and add a guard that rejects a price change above a set ratio without approval. Report the impact in aggregate.
- *3% of orders exceed the buffer on a holiday, and captured revenue exceeds authorised*: confirm whether re-authorisations or absorbed differences explain it, by `capture_mode`. A report showing captured above authorised with no re-authorisation recorded is a data bug, so check the join. Use the distribution of final over estimated per item to set the buffer for peak days.
- *Pick events sent twice after reconnecting*: deduplication on the device's event id makes the second copy a no-op. Monitor the duplicate rate per device. If two different weights arrive for one pick id, keep both, flag the line, and use the rule (for example, the latest by device sequence) recorded on the charge line.

**Follow-up guidance.** (1) Query the picks by scale id and date range, estimate the error from the calibration result, refund overcharged lines (and decide on undercharges as a policy), and add calibration status to the scale reference data. (2) Re-authorise, cap and absorb, or confirm with the customer. Choose the buffer from the distribution of final over estimated per item and order mix, weighed against failed re-authorisations. (3) Refund = round_half_up(returned grams × charged price per kg). The charge line gains a return row, and the original stays unchanged. (4) Monitor final over estimated per item and region weekly. A persistent bias goes to merchandising to update the average weight, versioned with an effective date.

**Rubric anchors.** 2: one price column overwritten at pick; floats; no answer for the over-buffer case. 3: estimate and actual kept separately, integer cents and grams with one stated rounding rule, deduplicated device events, substitutions and returns linked. 4: also reproducible receipts from recorded inputs and rule versions, a designed over-buffer flow with its own metrics, aggregate analytics for each audience, and a credible response to each incident.

**Strong signals.** Asks which price applies if it changes between order and pick; writes the integer rounding formula; separates the ordered line from what was picked. **Red flags.** "Store the final price only"; recomputing historical charges from the current price file.

## WMT-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Transaction identity.** `(store, register, register_sequence, register_boot_id)`, created on the register. The boot id (or an epoch counter) separates a sequence that restarts after a reinstall. A resend carries the same identity, and the ingestion layer upserts by it, so a transaction counts once.
- **Store-and-forward.** Each register keeps a local journal and forwards it in sequence order when connected. The store's gateway acknowledges by sequence. A per-register high-water mark plus a set of gaps shows exactly what is missing. Ingestion lands raw journal batches immutably, with arrival time, before parsing.
- **Record shape.** Header (identity, status complete or voided, register timestamp, store-local business date, cashier lane type), lines (item, quantity, price in cents, department, line void linking to the voided line with a negative quantity), tenders (type, amount), and returns (lines with negative quantity, the original transaction identity when the receipt is known, the return store).
- **Business date.** The store-local date of the transaction's completion, by this exercise's rule, with stores' zones from reference data. A transaction that crosses midnight belongs to its completion date. Clock checks compare the register timestamp with arrival time and with neighbouring sequence numbers. A register whose clock disagrees beyond a threshold is flagged, and its transactions are dated by the sequence position between trusted neighbours, or by the arrival date, recorded as a correction.
- **Daily tables, versioned.** `sales_daily (store, business_date, department, item, units, net_cents, version)` is rebuilt per store and date when new transactions arrive for it. Each rebuild is a new version, with a change log (`store, date, old_total, new_total, transactions added`). Analysts see the latest version, and finance can see what was published when.
- **Reconciliation.** Per store, date, register and tender: analytics totals against the till close. States: matched, pending (sequence gaps not yet filled), explained difference (late transactions after close, returns of online orders recorded elsewhere) and unexplained, with the registers and transaction ids listed. A store and day is final only when the gaps are closed and the totals match or the difference is explained.
- **Fast path.** Item-level sales stream within minutes for replenishment and price analytics, labelled provisional. The nightly reconciled tables are the record.

**Competing designs to accept.** Streaming ingestion with a lakehouse table merged by transaction identity and nightly partition rebuilds; a batch-only design with hourly loads (fine if late data and versions are handled); event-sourced daily totals with corrections as delta rows. Any is acceptable if a transaction counts once, late data is explainable, and the reconciliation names the transactions behind a difference.

**Bottlenecks and failure modes.** Deduplicating on the register timestamp instead of a register-generated identity; a sequence restart read as a huge gap or as duplicates; business dates from UTC or from arrival time; line voids dropped or double-negated; returns credited to the original store; silently overwriting published days; reconciliation only at store level, which hides a single register's problem.

**Incident guidance.**
- *Region offline for {{offline_hours}}, backlog forwarded with resends*: deduplication on the transaction identity absorbs the resends. Watch ingestion lag and the duplicate rate. The affected stores stay pending until sequence gaps close, then their days are rebuilt as new versions. Reconciliation runs again after the till close, which may come before the backlog lands.
- *Register clock in the wrong time zone after a repair*: clock checks flag it, because register time disagrees with arrival time and with neighbouring registers. Re-date its transactions with the documented rule, rebuild the two affected days for that store, record the correction, and add a clock check to the repair checklist.
- *30 stores below the till close after a software update changed line voids*: reconciliation shows unexplained differences concentrated on registers running the new version. Find the new void representation in the raw journals (they are kept), fix the parser, reprocess the affected days from raw data, and add a contract test on void lines for future updates.

**Follow-up guidance.** (1) During the outage, the fast path shows a drop for those stores and labels it. After reconnection, the backlog lands, days are rebuilt as new versions, and the change log shows the additions. After the till close, reconciliation matches or names the gaps. (2) Detect it with register time against arrival time and with neighbouring registers. Date the transactions by sequence position or arrival, and record the correction. (3) Compare per register and tender, list missing sequence numbers and transactions after close, check returns and voids. Finance signs off on explained differences. (4) A streaming path labelled provisional, and the reconciled nightly path as the record, with the difference between them monitored.

**Rubric anchors.** 2: sales loaded by timestamp and appended; no transaction identity; reconciliation as a single number. 3: register-generated identity with deduplication, sequence-gap completeness, explicit voids and returns, store-local business dates, versioned rebuilds of late days, per-register reconciliation. 4: also clock-drift detection and correction, a provisional fast path separated from the reconciled record, raw journals kept for reprocessing, and a credible response to each incident.

**Strong signals.** Uses register sequence numbers to prove completeness; asks how a sequence restart is told apart from a gap; treats the till close as an input to reconcile against, not something to overwrite. **Red flags.** "Use the register timestamp as the key"; adjusting analytics totals to match the tills without explaining the difference.
