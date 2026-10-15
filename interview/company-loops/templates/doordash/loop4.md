# DoorDash · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of a local
commerce marketplace: restaurant menus, convenience and grocery catalogues, item
availability and substitutions, store hours, order accuracy, a membership
subscription, consumer promotions, ratings and merchant tools. Every workload,
number and schema is hypothetical; membership, fee, promotion and refund rules
are this exercise's rules (check current docs), and nothing here describes how
the company's own systems, merchants or partners work. Courier data appear only
in aggregate and never rank or score an individual courier; consumer and
merchant data appear in aggregate, except a merchant's own data shown to that
merchant.

## DSH-L4-01: Item availability for convenience and grocery: pick outcomes, merchant feeds and honest freshness

| | |
|---|---|
| **Template ID** | DSH-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Availability state / signal fusion, a given score, freshness decay, calibration |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer |

```params
{
  "stores": {"2": ["8,000", "15,000"], "3": ["40,000", "70,000"]},
  "listings": ["20,000", "50,000", "120,000"],
  "feed_hours": [2, 6, 24],
  "peak_picks": {"2": ["2,000", "5,000"], "3": ["15,000", "30,000"]}
}
```

**Business Scenario.** A local commerce marketplace lists {{stores}} convenience and grocery stores next to its restaurants, each store listing about {{listings}} items. What the marketplace knows about whether an item is on the shelf comes from several places: inventory feeds from merchants (a full file every {{feed_hours}} hours, and from some merchants small updates in between), pick outcomes recorded while an order is shopped (found, found with fewer units, substituted, not found) at up to {{peak_picks}} per second at peak, the merchant marking an item out of stock in its tools, and consumers reporting a missing item after delivery. You are given a scoring function that takes recent evidence for one store-item and returns the probability that the item is on the shelf now. Consumers browse store pages and search results that show each item as in stock, likely limited, or out of stock. Showing an item as in stock that is then not found leads to substitutions, refunds and a disappointed consumer; hiding an item that is there loses the sale.

**Problem Statement.** Design the system that turns these signals into the availability state consumers see. Cover ingestion of each kind of signal; the evidence kept per store-item; when the scoring function is called, with what inputs, and how its output becomes a displayed state; what the page says about how recent the evidence is; how the state reaches store pages and search; how a merchant's explicit out-of-stock mark overrides everything else; and how you measure whether the states you show are honest.

**Constraints.** An item the merchant marks out of stock must leave consumer view within 60 seconds. A not-found pick must be reflected in that store's displayed state within 2 minutes. Store page reads p99 under 30 ms. The displayed state never claims more certainty than the evidence supports: an item with no evidence for days is shown as unconfirmed, not as in stock. Pick outcomes are store-item evidence only; they are never attributed to, reported by, or used to evaluate the person who shopped the order.

**Assumptions.** All volumes, timings, thresholds and rules are hypothetical. The scoring function is given and is not yours to design: its inputs are the time since the item was last found and last not found, the latest feed quantity and its age, the item's typical sales rate in that store, and the store's local hour; its output is a probability. Merchants differ greatly in how reliable their feeds are.

**Clarifications.**
- Q: Do I design the scoring model? | A: No. It is a function you are given. You decide when it is called, with which evidence, how its output is cached, and how it maps to what consumers see.
- Q: How reliable are merchant feeds? | A: Some are accurate, some are hours stale, and a few report every item as in stock. Treat each merchant's feed as having a measured reliability.
- Q: Is an out-of-stock item hidden or shown greyed? | A: Your call. Say what each choice does to search, to substitutions and to consumers who come back later.
- Q: Can a consumer order an item shown as likely limited? | A: Yes; checkout asks for a substitution preference for it.
- Q: Who can see pick outcomes? | A: Only as aggregated store-item evidence. There is no view of them by shopper or courier.

**Hints.**
1. Keep an append-only log of evidence per store-item and treat the displayed state as a projection of it plus the clock; then a state can always be recomputed and explained.
2. Evidence goes stale even when nothing happens. Instead of rescoring every item every minute, compute when each item's state would next change if no new evidence arrives, and schedule a re-evaluation for that moment.
3. Honesty is measurable: of the items shown as in stock when an order was placed, what share were found at pick time? Track it per store and per state.

**Follow-ups.**
1. Walk one not-found pick from the shopping app to the item changing state on the next consumer's page. Where is the time spent?
2. The merchant feed says 40 units on hand, and the item was not found on three orders in the last hour. What does the consumer see, and why?
3. How do you keep {{stores}} stores of about {{listings}} listings each up to date as evidence ages, without rescoring everything every minute?
4. The shown-in-stock-but-not-found rate differs widely between stores. How do you measure it fairly and act on it, without it becoming a judgement of any person?
5. You are given a new version of the scoring function. How do you roll it out and prove the states it produces are at least as honest?

**Follow-up rules.**
- when: cache, redis, cdn → ask: A merchant marks an item out of stock. How long do your cached store pages and search results keep showing it, and what invalidates them?
- when: batch, nightly, hourly, daily → ask: A popular item sells out at 18:00. How long until consumers stop seeing it as in stock in your design, and how many orders meet a not-found pick in the meantime?
- when: shopper, dasher, courier, picker → ask: How do you guarantee that pick outcomes stay store-item evidence and never become a view of one person's performance?
- when: threshold, cutoff, cut-off → ask: Who chooses the thresholds between in stock, likely limited and out of stock, and which metric tells you they are wrong?
- when: kafka, stream, streaming, partition → ask: The partition for one large chain's stores falls 20 minutes behind at peak. What do consumers of those stores see, and does the page say so?

**Production Reality Check.**
- After a chain changes its point-of-sale export, its feed reports every listing in all its stores as in stock with a quantity of 999. Within a day, not-found picks for that chain triple.
- At the evening peak, pick outcomes reach {{peak_picks}} per second, the scoring function's p99 rises to 2 seconds, the evidence queue backs up, and displayed states for evening orders are 25 minutes old.
- Over a holiday weekend, the feeds of several stores, normally sent every {{feed_hours}} hours, stop arriving for 30 hours. Their items keep showing as in stock with no new evidence.

**Evaluation Criteria.** Separates the evidence log from derived state, with idempotent ingestion per signal type and store-item ordering; the given score called with explicit evidence and cached with the time it is valid until, plus scheduled re-evaluation as evidence ages; a stated mapping from score to displayed state, with an honest unconfirmed state and freshness shown; merchant out-of-stock marks as a fast override path with cache invalidation; per-merchant feed reliability measured and used; calibration and shown-in-stock-but-not-found metrics in aggregate per store, never per person; safe rollout of a new score version (shadow scoring, comparing calibration); adapts to each incident with diagnosis, recovery and prevention.

## DSH-L4-02: Consumer promotions: eligibility, real-time budgets, redemption caps and reconciled accounting

| | |
|---|---|
| **Template ID** | DSH-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Promotions platform / rule evaluation, budget counters, caps, redemption ledger |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "campaigns": {"2": ["5,000", "20,000"], "3": ["100,000", "250,000"]},
  "peak_checkouts": {"2": ["1,500", "4,000"], "3": ["12,000", "30,000"]},
  "per_consumer_cap": [2, 3, 5],
  "budget": ["$50,000", "$250,000", "$1,000,000"]
}
```

**Business Scenario.** A local commerce marketplace runs {{campaigns}} active consumer promotions at any time: percentage and fixed discounts on an order, free delivery, and item-level offers. Some are funded by the marketplace, some by merchants for their own stores. Each has eligibility rules (new consumers only, members only, certain stores or cities, a minimum subtotal, certain hours), a total budget, and a cap on redemptions per consumer. Promotions combine by this exercise's stacking rule: at most one marketplace-funded and one merchant-funded promotion on an order, and the membership delivery-fee benefit is applied separately. A flagship campaign this weekend is funded with {{budget}}, allows at most {{per_consumer_cap}} redemptions per consumer, and checkouts peak at {{peak_checkouts}} per second.

**Problem Statement.** Design the promotions platform. Cover how campaigns and their rules are defined, versioned and validated; how eligible promotions are found and evaluated for a cart quickly; how the best allowed combination is chosen under the stacking rule; how budgets and per-consumer caps are enforced as redemptions happen; what happens when an order is cancelled, refunded or changed after a promotion was applied; and the redemption accounting that finance and merchants reconcile against completed orders.

**Constraints.** Cart pricing including promotions p99 under 150 ms. A campaign's spend may exceed its budget by at most 1%, and a consumer may never exceed the per-consumer cap. The discount a consumer was shown at checkout is the discount charged, unless the consumer is told before placing the order. Every discount on every order must be traceable to a campaign version and a funder. Merchants see only redemptions for their own stores.

**Assumptions.** All volumes, budgets, rules and timings are hypothetical; stacking, eligibility and refund rules are this exercise's rules (check current docs). Orders are priced by a separate cart service that calls you; payment is authorised after pricing and can fail.

**Clarifications.**
- Q: When does a redemption count against the budget, at pricing or at order placement? | A: Your call. Say what happens to the budget when a priced cart is abandoned, and when a placed order is cancelled.
- Q: Is the budget measured in redemptions or in money? | A: In money: the sum of discounts given. Discounts vary by order.
- Q: Does a cancelled order give the redemption back? | A: By this exercise's rule, a full cancellation before the store accepts returns both the budget and the consumer's redemption; later cancellations return neither.
- Q: Can a merchant change a running campaign? | A: It can raise the budget or end the campaign early; other changes create a new version for future orders only.
- Q: Who decides which combination a consumer gets? | A: The best combination for the consumer that the stacking rule allows, with ties broken by a stated rule.

**Hints.**
1. Precompile campaigns into an index by store, city and audience so a cart is evaluated against a few dozen candidates, not {{campaigns}}.
2. A budget is a counter decremented by thousands of checkouts. Split it into allotments with a reserve, or let it be slightly approximate within the allowed 1%, and say which.
3. Treat redemptions as a ledger of reserve, commit and release entries keyed by order; budgets, caps and finance reports are projections of it.

**Follow-ups.**
1. Walk one checkout for the flagship campaign: which records change, in what order, and what keeps the consumer's {{per_consumer_cap}}-redemption cap exact when the same consumer checks out from two devices at once?
2. The budget has 2% left and checkouts run at {{peak_checkouts}} per second. How do you stop at the budget without making consumers who saw the discount lose it at payment?
3. An order is partly refunded after delivery because one item was missing. What happens to the discount, the budget, and the merchant's statement?
4. Finance finds that the redemption ledger and the discounts on completed orders differ by 0.3% for last month. How do you find which orders explain it?
5. A merchant-funded campaign and a marketplace campaign both apply. How do you prove to the merchant exactly what its campaign cost and why?

**Follow-up rules.**
- when: redis, counter, in-memory → ask: The node holding the flagship budget counter fails at peak. What does the replacement start from, and how do you know the campaign has not overspent?
- when: lock, select for update, transaction → ask: Every checkout for the flagship campaign takes the same budget row lock. What is the p99 pricing latency at {{peak_checkouts}} per second?
- when: eventual, eventually consistent, async → ask: Which of your numbers may be eventually consistent, the budget, the per-consumer cap or the ledger, and which must be exact?
- when: rules engine, dsl, json rules → ask: A campaign manager writes a rule that makes every order in a city eligible by mistake. What catches it before it goes live?
- when: refund, cancel, cancellation → ask: The refund arrives three weeks after the campaign ended and its budget was closed. Where does that entry go?

**Production Reality Check.**
- The flagship campaign's {{budget}} budget is overspent by 18% in the first hour: carts priced before the budget ran out kept being placed for several minutes afterwards, and each was honoured.
- A promotion code is shared widely; redemptions for it jump 40-fold in an hour, mostly from accounts created that day. The per-consumer cap of {{per_consumer_cap}} holds, but the budget drains before regular consumers can use it.
- Month-end reconciliation shows redemptions committed for orders cancelled before the store accepted them were never released; the ledger is 0.7% above the discounts on completed orders.

**Evaluation Criteria.** Campaigns as versioned, validated rule definitions with dry runs; a precompiled eligibility index so a cart meets few candidates; combination selection under the stacking rule with deterministic ties; budget enforcement with an explicit tolerance (allotments, reserve-then-commit, or a single writer per campaign) and exact per-consumer caps keyed by consumer and campaign; a redemption ledger of reserve, commit and release entries keyed by order and campaign version, with idempotent retries; post-order changes (cancellation, partial refund, edits) mapped to ledger entries by rule; reconciliation against completed orders and per-merchant statements; abuse handled in general terms (velocity limits per campaign, budget pacing guards) without evasion detail; adapts to each incident with diagnosis, recovery and prevention.

## DSH-L4-03: Merchant analytics portal: hourly store results, each merchant seeing only its own

| | |
|---|---|
| **Template ID** | DSH-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Multi-tenant analytics / hourly refresh, row-level access, restatement, aggregation thresholds |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "merchants": {"1": ["50,000"], "2": ["200,000", "400,000"], "3": ["800,000", "1.2 million"]},
  "daily_orders": {"1": ["2 million"], "2": ["8 million", "12 million"], "3": ["20 million", "35 million"]},
  "chain_stores": ["3,000", "9,000", "20,000"],
  "history_months": [13, 25, 37]
}
```

**Business Scenario.** {{merchants}} merchants use a web portal to see how their stores are doing on a local commerce marketplace that handles about {{daily_orders}} orders a day. For each store they see sales, orders and average order value; item performance (top items, items often reported missing, items often unavailable); order accuracy (orders with a missing or incorrect item reported); ratings and reviews; and the results of promotions they funded (redemptions, sales on promoted orders, what the promotion cost them). Numbers are shown by hour and day in each store's local time, with {{history_months}} months of history. Merchants range from a single restaurant to a chain of {{chain_stores}} stores, some run by franchise owners who should see only the stores they own.

**Problem Statement.** Design the data system behind the portal. Cover the sources and how they arrive; the models and aggregates; the hourly refresh; how late corrections (refunds, accuracy reports and ratings that arrive days later) change past numbers and how merchants are told; access control so that every user sees exactly the stores they are allowed to; and the serving layer that makes the portal fast.

**Constraints.** Data at most 90 minutes old during the day. Dashboard queries p95 under 2 seconds, including for the largest chains over a year. No merchant may ever see another merchant's data, and a franchise owner or store manager sees only the stores assigned to them. Consumers appear only in aggregate; reviews are shown as consumers published them, without identifiers. Courier-related issues appear only as store-level aggregates and never identify a courier. Promotion results are reported as observed, with no claim of incremental lift.

**Assumptions.** All volumes and timings are hypothetical. Order, item, refund, rating and promotion events arrive in a central log within minutes; some corrections arrive days later. A merchant's organisation, its stores and its users' roles are kept in a separate account service that changes during the day.

**Clarifications.**
- Q: Which time zone are the numbers in? | A: Each store's local time. A chain's total across time zones is the sum of each store's local days.
- Q: Can past numbers change? | A: Yes; refunds, missing-item reports and ratings arrive late. Say how merchants learn that a number they saw has changed.
- Q: What can a store manager see? | A: Only their assigned stores, and only some metrics; owners see everything for the stores they own.
- Q: Are reviews shown with names? | A: As the consumer published them, with no identifiers beyond that; filtering and aggregates only above a minimum count.
- Q: Do merchants export data? | A: Yes, as files of their own stores' daily results.

**Hints.**
1. Pre-aggregate per store and local hour; chains read many small aggregates, so think about rollups per merchant and per day as well.
2. Put the access rule in one place that every query passes through, keyed by the user's current store assignments, not in each dashboard.
3. Decide a restatement policy: which windows may change, how a changed number is labelled, and how long numbers stay open.

**Follow-ups.**
1. Walk one order from placement to appearing in its store's hourly sales. Where is the time spent, and what is the hour it belongs to?
2. A chain of {{chain_stores}} stores opens a year-long view. What is precomputed and what is computed at query time to stay under 2 seconds?
3. A store moves from one franchise owner to another at noon. Who sees which hours of that day, and what enforces it?
4. A missing-item report arrives four days after the order and changes last week's order accuracy. What does the merchant see?
5. How would you prove to an auditor that no merchant saw another merchant's data last quarter?

**Follow-up rules.**
- when: row-level security, rls, row level → ask: The account service changes a user's store assignments. How quickly does your row-level rule pick it up, and what does the user see in between?
- when: materialized view, materialised view, rollup, pre-aggregate → ask: A refund for an order from five weeks ago arrives. Which rollups change, and how much do you recompute?
- when: utc, timezone, time zone → ask: A store closes at 02:00 local time. Which day do its last orders belong to, and on the night clocks change?
- when: cache, caching → ask: A cached chain-level result includes a store the user lost access to an hour ago. What stops it from being served?
- when: export, csv, download → ask: An export includes reviews. What stops it from carrying consumer identifiers the portal never shows?

**Production Reality Check.**
- A store transfers between franchise owners in a chain of {{chain_stores}} stores; for two days the previous owner can still see the store's sales because a cached permission list was not refreshed.
- A schema change requires backfilling {{history_months}} months of item performance. The backfill competes with the hourly refresh, and by 18:00 dashboards show data as of 13:00.
- A merchant notices that last week's order accuracy changed between Monday and Thursday with no notice; late missing-item reports were applied silently.

**Evaluation Criteria.** Event log to modelled facts (orders, items, refunds, accuracy reports, ratings, redemptions) keyed by order and store, with each store's local day and hour computed at ingestion; incremental hourly aggregates per store and local hour, with merchant and day rollups for chains; one central access rule driven by current assignments (row-level security or an access-checked query layer) applied to caches and exports alike; a restatement policy with versioned numbers, labelled changes and a closing window; aggregation thresholds and no consumer or courier identifiers; promotion results as observed without lift claims; backfills isolated from the hourly path; an access audit log; adapts to each incident with diagnosis, recovery and prevention.

## DSH-L4-04: Dish search in a delivery area: open now, menu hours and fresh menus

| | |
|---|---|
| **Template ID** | DSH-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Search / geo filtering, time-dependent eligibility, incremental indexing |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "stores_in_index": {"2": ["400,000", "700,000"], "3": ["1.5 million", "2.5 million"]},
  "items_indexed": {"2": ["60 million", "120 million"], "3": ["300 million", "500 million"]},
  "qps": {"2": ["3,000", "8,000"], "3": ["25,000", "50,000"]},
  "freshness_minutes": [2, 5, 10]
}
```

**Business Scenario.** Consumers on a local commerce marketplace search for a dish ("pad thai", "gluten-free pizza", "oat milk latte") and expect stores and items that can actually be delivered to them now. The index holds {{stores_in_index}} stores and {{items_indexed}} menu items. Each store delivers to an area that is not a simple circle, keeps weekly hours that may cross midnight plus holiday hours and temporary pauses, and may have menus that apply only at certain hours (breakfast until 11:00, a late-night menu). Items can be unavailable. Merchants change menus all day and expect a change to be searchable within {{freshness_minutes}} minutes. Search traffic peaks at {{qps}} queries per second around meal times. Ordering of the results is done by a relevance scoring function you are given.

**Problem Statement.** Design dish search. Cover how stores, menus and items are indexed (and how dish words are matched, including synonyms and spelling variations); how the delivery area filter works for a consumer's location; how open-now, menu hours, holiday hours, pauses and item availability are applied at query time; how menu, hours and availability changes flow into the index within {{freshness_minutes}} minutes; the serving path at {{qps}} queries per second; and how you know the results are correct (no closed stores, no unavailable items, no menus outside their hours).

**Constraints.** Search p99 under 200 ms. A store that is closed or paused, or an item that is unavailable or outside its menu hours, must not appear as orderable. Hours are in each store's local time, including on the days clocks change and across midnight. A merchant's pause must take effect in search within 60 seconds.

**Assumptions.** All volumes and timings are hypothetical. Menus, hours and availability come from other services as change events; the relevance scoring function is given and needs only the candidate set and a few features. Delivery areas are polygons that change a few times a week.

**Clarifications.**
- Q: Do I design the ranking? | A: No. You produce the set of eligible candidates and their features; the given function orders them.
- Q: Can a closed store appear at all? | A: It can appear as "opens at 17:00" if you choose, but never as orderable now.
- Q: Is "open now" evaluated at index time or query time? | A: Your choice. Say what each costs at the moment a store opens or closes.
- Q: How are delivery areas defined? | A: Polygons per store, which can be large in suburbs and small in dense cities.
- Q: Do scheduled orders search for a future time? | A: Yes, sometimes. The same filters then apply at the chosen time.

**Hints.**
1. Hours change state at known moments. Either evaluate a compact weekly schedule at query time in the store's time zone, or update a small "orderable now" field at each transition; avoid reindexing whole menus.
2. Map delivery-area polygons to a grid of cells at index time, so a consumer's location becomes one cell lookup plus an exact check for edge cells.
3. Separate slow-changing documents (item names, descriptions) from fast-changing fields (availability, pause, hours) so the fast ones can be updated in place.

**Follow-ups.**
1. Walk one merchant menu change, a new item, from the merchant's tool to the first search that returns it. Where is the time spent?
2. A consumer searches at 10:59 for an item on a breakfast menu that ends at 11:00, and places the order at 11:02. What happens?
3. How do you shard {{items_indexed}} items so a query for one location touches only a few shards, and what is hot at meal times?
4. A large chain replaces its whole menu in 3,000 stores at 11:30, just before lunch. How does the index keep up, and what do searchers see meanwhile?
5. How do you continuously measure that no closed store, unavailable item or out-of-hours menu is shown as orderable?

**Follow-up rules.**
- when: geohash, h3, s2, grid, cell → ask: A store's delivery area covers part of a cell. How do you avoid showing it to a consumer just outside the area?
- when: elasticsearch, opensearch, lucene, inverted index → ask: A store toggles 200 items' availability in a minute. How do you update them without reindexing whole documents?
- when: utc, timezone, time zone → ask: A store's hours are 18:00 to 02:00. On the night clocks go back, when is it open in your design?
- when: cache, cached, caching → ask: Search results are cached for popular queries. A store pauses; how long do cached results show it as orderable?
- when: synonym, synonyms, spelling, typo → ask: "Pop" and "soda" mean the same thing in some regions and not others. Where do synonyms live, and who can change them?

**Production Reality Check.**
- On the night clocks go back, stores whose hours cross midnight show as closed in search for an hour while their tablets accept orders.
- A large chain replaces its whole menu in 3,000 stores at 11:30. The index update backlog grows, and menu changes take 40 minutes to become searchable instead of {{freshness_minutes}}.
- Breakfast items keep appearing until 11:15 after the breakfast menu ends at 11:00; orders placed for them are cancelled by the store.

**Evaluation Criteria.** An index of stores and items with dish matching (analysers, synonyms by locale, spelling tolerance) and a separation between slow document fields and fast fields (availability, pause, hours) updated in place; delivery areas precomputed to grid cells with an exact edge check; open-now and menu hours evaluated correctly in local time (a compact weekly schedule at query time, or transition-driven field updates) including midnight crossings, holidays, pauses and DST; change events into the index with priority for pauses and availability, and backpressure for bulk menu replaces; sharding by geography with replicas for meal-time peaks; checkout re-validation as the final guard; continuous correctness probes (synthetic searches against the source of truth); adapts to each incident with diagnosis, recovery and prevention.

## DSH-L4-05: Scheduled and group orders: days ahead, many participants, re-checked at fulfilment

| | |
|---|---|
| **Template ID** | DSH-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Order workflows / deferred execution, shared carts, re-validation, payment splits |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "days_ahead": [3, 7, 14],
  "group_size": {"2": [10, 25], "3": [50, 150]},
  "peak_scheduled": {"2": ["40,000", "90,000"], "3": ["250,000", "400,000"]},
  "join_deadline_minutes": [15, 30, 60]
}
```

**Business Scenario.** On a local commerce marketplace, consumers can schedule an order up to {{days_ahead}} days ahead for a chosen delivery time, and can start a group order: the host shares a link, up to {{group_size}} participants add their own items to one cart until a deadline {{join_deadline_minutes}} minutes after it opens, and then the host places the order. The host either pays for everything or each participant pays for their own items (this exercise's rule). At 12:00 on a weekday, {{peak_scheduled}} scheduled orders are due across the marketplace. Between placement and fulfilment, things change: a store edits its hours or adds a holiday closure, items become unavailable, prices and promotions change, and payment authorisations can expire.

**Problem Statement.** Design scheduled and group orders. Cover how a scheduled order is stored and when it is released to the store (and what is re-checked at release: store hours, pauses, item availability, prices, promotions, payment); how a group cart handles many participants editing at once and the deadline; who is charged for what, including fees, promotions, the membership fee benefit and taxes, under this exercise's rules; what consumers are told when something changes before fulfilment; and how the release path survives {{peak_scheduled}} orders due at the same minute.

**Constraints.** A scheduled order must reach the store early enough for its preparation time and never after the store has closed. Consumers are never charged more than the amount they confirmed without being asked first. In a group order paid per participant, no participant pays for another's items. Release-time checks must complete for all orders due at a peak minute within 2 minutes. Courier assignment is out of scope; treat it as a service that receives a released order.

**Assumptions.** All volumes, timings and rules are hypothetical; fee, promotion, membership and refund rules are this exercise's rules (check current docs). By this exercise's rule an authorisation is valid for 7 days, so orders scheduled further ahead are authorised again near release. Each store states a preparation time per order size.

**Clarifications.**
- Q: Is the price fixed when a scheduled order is placed? | A: By this exercise's rule, the consumer pays the price shown when they placed it, unless an item's price went up by more than 10%, in which case they are asked.
- Q: What if an item is unavailable at release? | A: The consumer's substitution preference applies; with none, the item is removed and refunded, and the consumer is told.
- Q: Can participants edit after the host places the group order? | A: No. Until the deadline they can edit their own items only.
- Q: Who gets the membership fee benefit in a group order? | A: By this exercise's rule, the host's membership applies to the whole order when the host pays; when each pays their own share, delivery fees are split equally and each member's share is waived.
- Q: Can a store refuse scheduled orders? | A: It can limit how many it accepts per hour; say how that limit is honoured.

**Hints.**
1. A scheduled order is a state machine with a release time (due time minus preparation time minus a margin); a durable timer index by release minute turns the 12:00 peak into a planned batch you can start early.
2. Re-check at release against the same sources checkout uses; anything that changed becomes an explicit decision recorded on the order.
3. A group cart is many writers on one document. Give each participant their own sub-cart and lock them all at the deadline, rather than letting everyone edit one list.

**Follow-ups.**
1. Walk one order scheduled {{days_ahead}} days ahead from placement to release. Which records change, and what is re-checked when?
2. {{peak_scheduled}} scheduled orders are due at 12:00. How do you release them on time without a thundering herd on store hours, availability and payments?
3. In a group order paid per participant, one participant's card declines after the deadline. What happens to the order and to everyone else?
4. A store adds a holiday closure for tomorrow after hundreds of orders were scheduled into it. What does the system do, and what do consumers see?
5. How do you prove, for any order, exactly what each person was charged and why, months later?

**Follow-up rules.**
- when: cron, scheduler, timer, delay queue → ask: The scheduler node handling the 11:30 releases restarts at 11:29. How do you guarantee each order is released exactly once and on time?
- when: lock, locking, optimistic → ask: Forty participants add items in the last minute before the deadline. What do they experience under your concurrency control?
- when: authorize, authorise, authorization, authorisation, hold → ask: An order is scheduled {{days_ahead}} days ahead. When is the payment authorised, and what happens if the second authorisation fails at release?
- when: event sourcing, event log, state machine → ask: Which states can an order move back from, and who can trigger each transition?
- when: split, splitting, share → ask: A promotion of $10 off applies to a group order paid per participant. Who gets how much of it, and how is the remainder cent assigned?

**Production Reality Check.**
- A store enters a holiday closure the evening before; the next day 300 scheduled orders due during the closure are released to it and are cancelled by the store at release.
- The release job for 12:00 starts late at 11:52; {{peak_scheduled}} orders are re-checked at once, the availability service throttles, and a quarter of the orders reach stores after their preparation time began.
- In a group order of {{group_size}} participants paid per participant, an item became unavailable after a participant added it; the participant is charged for it and the item is refunded a day later.

**Evaluation Criteria.** Scheduled orders as a durable state machine with a computed release time, a timer index, and exactly-once release (leases and idempotent transitions); release-time re-validation of hours, holiday closures, pauses, availability, prices, promotions and payment with each change recorded as a decision and communicated; early detection when hours change after scheduling (re-checking affected orders when a store edits its hours, not only at release); peak release planned ahead with pre-checks and smoothing; group carts as per-participant sub-carts locked at the deadline, with clear payment split rules for fees, promotions, the membership benefit, taxes and remainder cents; never charging more than confirmed without consent; an auditable charge breakdown per person; no dispatch design; adapts to each incident with diagnosis, recovery and prevention.
