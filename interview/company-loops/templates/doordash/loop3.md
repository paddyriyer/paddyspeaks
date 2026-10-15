# DoorDash · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of a local commerce
marketplace: restaurant menus, convenience and grocery catalogues, store hours,
item availability and substitutions, a membership subscription with delivery-fee
benefits, and merchant tools. Every workload, number, schema and incident is
hypothetical; menu, hours, pause, substitution, membership, fee and refund rules are
this exercise's rules (check current docs), and nothing here describes how the
company's own systems work. Consumer and courier data appear only in aggregate; a
merchant sees only its own stores. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## DSH-L3-01: Menus as data — categories, items, modifier groups with minimum and maximum selections, prices per channel, menu hours, and the menu as it stood on a date

| | |
|---|---|
| **Template ID** | DSH-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / menu trees with shared and nested modifier groups, selection rules, channel prices, versioning, order lines frozen at order time |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "stores": {"1": ["150,000"], "2": ["400,000"], "3": ["700,000", "900,000"]},
  "items_per_menu": [80, 200, 450],
  "menu_changes": ["2 million", "8 million"],
  "channel_list": ["the marketplace app and the merchant's own ordering site", "the marketplace app, pickup orders and the merchant's own ordering site"]
}
```

**Business Scenario.** Restaurants list their menus on a local commerce marketplace: about {{stores}} store locations, with a typical menu of about {{items_per_menu}} items, and about {{menu_changes}} menu changes a day arriving from merchant tools and point-of-sale integrations. A menu has categories and items. Items have modifier groups such as "Choose a size" or "Add toppings", each with a minimum and a maximum number of selections, and an option can carry its own nested group (a combo's drink choice, then that drink's size). Many items share one group: a "Choose a sauce" group can sit on forty items. In this exercise one item can carry a different price on each channel ({{channel_list}}), and menus have hours: a breakfast menu until 11:00, a late-night menu after 22:00 (this exercise's rules; check current docs). Consumers, merchants and support all ask the same question in different words: what was on the menu, at what price, when this order was placed?

**Problem Statement.** Design the data model for menus. Cover menus and their hours; categories; items; modifier groups and options, including shared groups and nested groups; prices per channel and per menu; and the link from an order line to the exact item, options and prices the consumer chose. Show how you answer "the menu as it stood at store S on channel C at time T", how you validate a cart line against the minimum and maximum selection rules, and how a merchant's change is recorded so that nothing a consumer saw is lost.

**Constraints.** Money is stored in integer cents. A shared modifier group is one object: changing it changes every item that uses it from that moment, and never retroactively. Nested groups go at most three levels deep in this exercise. Nothing is overwritten: an order placed yesterday must still show the names, options and prices the consumer chose, even after an item is renamed or deleted. Item ids from a merchant's point-of-sale can change when the merchant re-syncs a whole menu (this exercise's model). Menu hours are in the store's local time.

**Assumptions.** Store counts, menu sizes, change volumes and channels are hypothetical. Whether an item is in stock is a single flag here (availability is a Loop 4 topic). Tax, promotions and dish search are out of scope.

**Clarifications.**
- Q: Is the price on the item or on the menu? | A: Your choice. In this exercise one item can sit on a lunch menu and a dinner menu at different prices, so say where that difference lives.
- Q: Can an option change the price? | A: Yes, by a delta ("Large" adds 150 cents); a nested option can add its own delta on top.
- Q: Does a full menu sync from the point-of-sale replace everything? | A: It sends the whole menu. Items that did not change must keep their identity, so sales history and ratings stay continuous.
- Q: Two menus are open at 10:30 and both list the same item at different prices. What does the consumer see? | A: The item once. In this exercise the price of the menu that opened later wins; say where that rule is recorded.
- Q: Does a required group stay required when its parent option is not chosen? | A: No. A nested group applies only when its parent option is selected.

**Hints.**
1. Separate the structure (menu → category → item → modifier group → option → nested group) from the versions of each node. A shared group is one node that many items reference.
2. Choose between effective-dated rows per node and an immutable published version of the whole menu per change, and cost both at {{menu_changes}} changes a day.
3. The order line should point at immutable versions (or carry a frozen copy) of the item and of every option chosen, with the prices applied.

**Follow-ups.**
1. Write the validation of a cart line against its modifier groups: minimum and maximum selections, and a nested group that is required only when its parent option is chosen.
2. A shared "Choose a sauce" group gains an option with a price. Which rows change, and what does an order placed an hour earlier show on its receipt?
3. A merchant re-syncs from its point-of-sale and every item id changes. How do you keep item history continuous for sales reports?
4. Compare a full published-menu snapshot per change with per-node effective-dated rows at {{stores}} stores and {{menu_changes}} changes a day. Estimate storage and the cost of "the menu as of T".
5. The same item is on the breakfast menu and the all-day menu at different prices, both open at 10:30, on {{channel_list}}. Which price does each channel show, and where is that decided?

**Follow-up rules.**
- when: json, jsonb, document, blob → ask: With the whole menu stored as one document per store, how do you answer "which items used the sauce group last month" and "the price of item X on channel C at T" without reading every version?
- when: overwrite, update the price, price column → ask: A price changed at 14:00 and an order from 13:55 is refunded at 15:00. Which price does the refund use, and where does your model keep it?
- when: nested, recursive, parent_id → ask: How do you read one item with all its nested groups in a single query, and what stops a group from containing itself?
- when: snapshot, published version → ask: A merchant changes one price. How many rows does a new snapshot write at {{items_per_menu}} items, and how do you diff two versions for the merchant's change log?
- when: pos id, external id, merchant item id → ask: The point-of-sale re-issues every item id after a re-sync. What is your stable key, and how do you match the new ids to the old items?

**Production Reality Check.**
- After a large chain re-synced its menus from its point-of-sale, every item looked new: item-level sales history and ratings reset in all its stores, because the item key was the point-of-sale id.
- A shared modifier group was edited to remove an option. Receipts for the previous week lost that option's name, and the refund tool computed lower refunds, because order lines referenced the live group rather than a version.
- With {{menu_changes}} changes a day, a job that rebuilt each store's whole published menu for every change fell behind at lunchtime, and consumers saw prices up to 20 minutes old.

**Evaluation Criteria.** A menu tree with shared and nested modifier groups and their selection rules; versioning chosen and costed (node-level effective dating or immutable published versions); channel and menu prices with a stated precedence; menu hours in local time; order lines frozen against immutable versions with the prices applied; stable item identity across point-of-sale re-syncs; cart validation written correctly for nested required groups; incidents explained and repaired without rewriting history.

## DSH-L3-02: Store hours as data — weekly hours across midnight, holiday hours, temporary pauses, local time zones, and whether a store was open at a given moment

| | |
|---|---|
| **Template ID** | DSH-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / schedule versions, date overrides, pauses, wall-clock rules versus UTC instants, daylight-saving transitions, derived open intervals |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "stores": ["300,000", "600,000", "900,000"],
  "time_zones": [4, 9, 20],
  "pauses_per_day": ["50,000", "200,000"],
  "open_checks": {"1": ["5,000"], "2": ["20,000"], "3": ["80,000", "150,000"]}
}
```

**Business Scenario.** About {{stores}} restaurants and stores across {{time_zones}} time zones list their hours on a local commerce marketplace. Regular weekly hours can be split into lunch and dinner, and late-night stores close after midnight. Merchants add holiday hours for particular dates, and pause a store temporarily from a tablet or portal when the kitchen is overwhelmed, with or without a planned end; in this exercise the system also pauses a store when its order tablet stops responding. There are about {{pauses_per_day}} pauses a day. The consumer app asks "is this store open now, and when does it next open?" about {{open_checks}} times a second; scheduled orders ask the same about a future moment; support and merchant reports ask whether a store was open at a moment in the past.

**Problem Statement.** Design the data model for store hours. Cover weekly hours with intervals that cross midnight; holiday hours for a date; temporary pauses, planned or open-ended, with who or what started and ended them; each store's time zone; daylight-saving transitions; and history, so that "was store S open at instant T" has the same answer today as it would have had then. Define precisely the rule that resolves weekly hours, holiday hours and pauses into open or closed at an instant, and design the derived structure that serves "open now" and "next open" at scale.

**Constraints.** Hours are stated in the store's local wall-clock time; instants are stored in UTC. A merchant's edit applies from the moment it is saved and never changes the past. In this exercise a date's holiday hours replace that date's weekly hours, and an interval that opens before midnight belongs to the date it opens on, so a holiday never shortens the previous night's late shift. On a night when the clocks change, a store listed 22:00 to 02:00 is open for 3 or 5 hours of elapsed time, not 4 (this exercise's rule: wall-clock hours are honoured). Pauses carry no individual staff identifiers in analytics.

**Assumptions.** Store counts, time zones, pause volumes and request rates are hypothetical. Menu hours (DSH-L3-01) and item availability are out of scope. Hours and pause behaviour are this exercise's model; check current docs for how real merchant tools work.

**Clarifications.**
- Q: Does a holiday entry affect the previous night's late shift? | A: No. In this exercise hours belong to the date they open on.
- Q: How is "open 24 hours" written? | A: Your choice; say how you keep it apart from an interval whose open and close times are equal by mistake.
- Q: Can a store's time zone change? | A: Rarely, and usually as a data correction. Say whether past answers move when it is corrected.
- Q: What should "next open" return during a pause with no planned end? | A: Unknown. The app shows "temporarily closed"; model that state explicitly.
- Q: Who can end an automatic pause? | A: In this exercise the system ends it when the tablet responds again, unless the merchant has paused the store as well.

**Hints.**
1. Keep three sources apart: versions of the weekly schedule, date overrides, and pauses. Derive open intervals in UTC from them; never store only a computed flag.
2. Version the schedule itself (valid from, valid to) so a past instant is answered with the schedule in force then.
3. Materialise each store's open intervals in UTC for the next few weeks, recomputed on every edit and across daylight-saving changes; "open now" becomes an interval lookup minus active pauses.

**Follow-ups.**
1. Write the resolution as pseudocode: input (store, instant); output open or closed and the reason (weekly hours, holiday hours, paused, outside hours).
2. A store listed 22:00 to 02:00 on the night the clocks go forward, and on the night they go back. What UTC intervals do you store each night?
3. A merchant edits Saturday's hours on Friday evening. Which derived rows change, and what does "was it open last Saturday at 23:00" return afterwards?
4. At {{open_checks}} checks a second across {{stores}} stores, where does the derived interval table live, and how quickly must a new pause reach it?
5. Scheduled orders were placed a week ahead for a date the store later marks as closed for a holiday. Which tables tell you, and what should happen to those orders?

**Follow-up rules.**
- when: utc → ask: A store lists 22:00 to 02:00 local. On the night the clocks go back, what UTC interval do you store, and how long is the store open?
- when: is_open, open flag, boolean → ask: A boolean "open now" is refreshed by a job. How do you answer whether the store was open last Tuesday at 21:30, and what happens when the job runs late?
- when: midnight, overnight, 24:00 → ask: Tuesday's hours are 17:00 to 01:30, and Wednesday is a holiday with the store closed all day. Is it open at 00:45 on Wednesday in your model?
- when: cache, redis → ask: A merchant pauses the store. How quickly must every cached "open now" answer change, and what invalidates it?
- when: offset, utc_offset → ask: You stored an offset per store. What happens to a late-night store's intervals on the night the clocks change?

**Production Reality Check.**
- On the night the clocks went back, late-night stores across {{time_zones}} time zones showed as closed for their last hour: open intervals had been computed from local times with a fixed UTC offset per store.
- A batch of holiday hours was saved as changes to the weekly schedule instead of date overrides, so the change applied to every following week, and hundreds of stores showed as closed every Thursday.
- During a network outage, automatic pauses fired for thousands of stores. With {{pauses_per_day}} pauses a day normally, the spike was not noticed, and many stores stayed closed for an hour after their tablets reconnected because the automatic pauses had been recorded as merchant pauses with no end.

**Evaluation Criteria.** Weekly schedule versions, date overrides and pauses kept apart, with a precise resolution rule and its reason codes; intervals across midnight belonging to the date they open; wall-clock hours converted to UTC with time zone rules, never fixed offsets; history reproducible for past instants; a derived interval table sized and refreshed on edit, pause and daylight-saving change; pause source and open-ended pauses modelled; incidents explained and corrected.

## DSH-L3-03: Convenience and grocery catalogue as data — master items, store listings, availability signals, substitution preferences per line, and what was found, substituted or refunded

| | |
|---|---|
| **Template ID** | DSH-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / master catalogue and store listings, item matching with confidence and corrections, signals as events, preferences frozen on the line, outcomes that reconcile |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "stores": ["20,000", "60,000", "120,000"],
  "master_items": {"1": ["2 million"], "2": ["5 million"], "3": ["10 million", "15 million"]},
  "listings": ["400 million", "1.2 billion"],
  "feed_updates": ["300 million", "1 billion"]
}
```

**Business Scenario.** A local commerce marketplace sells from {{stores}} convenience and grocery stores. Each merchant sends its catalogue as feeds, with its own item ids, names, sizes and prices, about {{feed_updates}} updates a day. The marketplace keeps one master catalogue of about {{master_items}} products, identified by barcode where one exists, and about {{listings}} store listings link a store's item to a master item. Availability evidence arrives from merchant feeds, from shoppers' pick outcomes (found or not found) and from recent sales. When ordering, the consumer sets a substitution preference per line: a specific replacement they chose, "best match", or "refund if unavailable" (this exercise's choices; check current docs). After the order, each line ends found, substituted (with what), or refunded (for how much), possibly in part.

**Problem Statement.** Design the data model for the catalogue and its order outcomes. Cover master items and product families (a single can and a 6-pack); store listings and their versions; the mapping from a merchant's item to a master item, including uncertain matches and corrections; availability signals per listing over time; the substitution preference captured on the order line; and per-line outcomes with quantities and amounts. Show the queries for: the found rate per master item, region and week; which substitutes were given for a master item and how often the consumer had named them; and, for one order, what the consumer asked for and what they received.

**Constraints.** Money is stored in integer cents. Sold-by-weight items are ordered as an estimate and charged by the picked weight (this exercise's rule). Merchant feeds rename items, change barcodes, and sometimes reuse an item id for a different product. Listings and mappings are effective-dated and never overwritten. The quantities on a line's outcomes must add up to the ordered quantity. Consumer data appears in analytics only in aggregate; the order's own record is visible to that consumer and to support. A merchant sees only its own stores.

**Assumptions.** Store counts, catalogue size, listing count and feed volume are hypothetical. Deciding the availability state shown to consumers is a Loop 4 topic; here you model the evidence. The "best match" ranking is a function you are given.

**Clarifications.**
- Q: Is a barcode unique? | A: Mostly. Produce and deli use store-generated codes, and a manufacturer can reuse a barcode for a new product years later.
- Q: What does "best match" record? | A: The ranked candidates returned by the function you are given, its version, and which candidate was used.
- Q: Partial fulfilment? | A: Of 4 units, 3 can be found and 1 substituted or refunded according to the preference. The outcome rows must reconcile to 4.
- Q: Can a merchant item map to two master items? | A: Not at the same time. A wrong mapping is corrected, and history keeps both the wrong one and the correction.
- Q: The consumer's named replacement is also unavailable. | A: In this exercise the line is refunded; record that the named replacement was tried.

**Hints.**
1. Three layers: the master item (product identity), the listing (store × merchant item, versioned), and the mapping between them with its source (barcode, manual review, a model's match) and confidence.
2. Availability signals are append-only events per listing with an observed time and a source; never a single mutable flag.
3. The order line freezes the listing version and the preference; outcomes are rows (found, substituted, refunded) with quantities and amounts.

**Follow-ups.**
1. A merchant reuses item id 4411 for a different product. What happens to its listings, mappings and last month's found rate for the old product?
2. Define the found rate for a master item per region and week precisely. What is the denominator when a line was found in part?
3. Two stores of one merchant describe the same product as "12 oz" and "355 ml". How does your matching normalise units, and when does a person review a match?
4. With {{listings}} listings and {{feed_updates}} feed updates a day, how do you store listing versions without rewriting rows that did not change?
5. A wrong mapping is discovered after a month. Which reports change when you correct it, and how do you restate them?

**Follow-up rules.**
- when: upc, barcode, gtin → ask: A manufacturer reuses a barcode for a new product, and produce uses store codes. What is your master key, and what role does the barcode play?
- when: in_stock, available flag, availability column → ask: A feed says in stock at 09:00 and a pick says not found at 09:20. What does your model store, and how would a later reader see both?
- when: substitute_item_id, replace the item → ask: If the substitute replaces the ordered item on the line, how do you report what the consumer asked for, and the found rate of the original item?
- when: weight, per kg, per lb, by weight → ask: Ordered as "about 4 bananas", picked as 0.83 kg. What is stored, what is charged, and which quantity does the found rate use?
- when: match, matching, entity resolution → ask: A match was wrong for a month before anyone noticed. Which rows does the correction write, and which historical numbers move?

**Production Reality Check.**
- One merchant's feed put sizes in the name field for a day. The matcher created thousands of new master items, and the found rates of the real products dropped because their listings had been remapped.
- The found rate for produce in one region halved overnight: pick outcomes for sold-by-weight items were recorded as not found whenever the picked weight was below the estimate.
- With {{listings}} listings, a nightly job that wrote a new version of every listing whether it had changed or not doubled storage each month, and "listing as of a date" queries scanned every version.

**Evaluation Criteria.** Master items, product families, versioned listings and an explicit mapping with source, confidence and correction history; signals as append-only events; preferences and listing versions frozen on the order line; outcome rows that reconcile to the ordered quantity, with weighted items handled; precise found-rate definitions; incremental listing versions sized against volume; consumer data aggregated and merchants scoped to their stores; incidents explained and repaired by restating from stored history.

## DSH-L3-04: Membership as data — plans, trials, monthly and annual billing, pauses and cancellations, and the benefit applied to each order

| | |
|---|---|
| **Template ID** | DSH-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / memberships and their periods, plan versions, billing attempts, grace, benefit decisions per order with reproducible inputs, revenue spread over months |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "members": {"1": ["5 million"], "2": ["15 million"], "3": ["25 million", "40 million"]},
  "monthly_price": ["$7.99", "$9.99", "$11.99"],
  "min_subtotal": ["$12", "$15", "$35"],
  "trial_days": [7, 14, 30]
}
```

**Business Scenario.** A local commerce marketplace sells a membership with monthly and annual plans. In this exercise members get a $0 delivery fee and a reduced service fee on orders from eligible stores whose subtotal is at least {{min_subtotal}} (this exercise's rule; check current docs). There are about {{members}} members, the monthly price is {{monthly_price}} (hypothetical), and new members can start with a free trial of {{trial_days}} days. Members can pause, cancel (effective at the end of the paid period), switch between monthly and annual, or have a renewal payment fail and enter a grace period while it is retried. Every order must record whether a membership benefit applied, which membership period it came from, and what it saved the consumer. Finance, product and support ask how many members are active, what memberships earn and cost, and why an order did or did not get the benefit.

**Problem Statement.** Design the data model for the membership. Cover plans and plan versions (price changes); memberships and their periods (trial, paid, grace, paused); billing attempts and charges; cancellations, switches and refunds (this exercise's rules); and the benefit decision per order, with its inputs and the fees it waived. Show the queries for: members on a date by state; benefit cost and revenue per member-month, with annual plans spread across months; and "why didn't order O get free delivery".

**Constraints.** Money is stored in integer cents. A membership's periods never overlap. A price change applies from a member's next renewal (this exercise's rule). The benefit decision must be reproducible from stored inputs: in this exercise the subtotal is measured on items before promotions and before fees. Benefits continue during the grace period and after a cancellation until the paid period ends (this exercise's rules). Analytics see members in aggregate; support sees one member's own record.

**Assumptions.** Member counts, prices, the minimum subtotal and the trial length are hypothetical. Payment processing itself, and how a store becomes eligible, are out of scope; eligibility is an input recorded at order time.

**Clarifications.**
- Q: Is the trial a period with price 0? | A: Yes, in this exercise. It converts to a paid period at its end unless the member cancels first.
- Q: What happens when a renewal payment fails? | A: A grace period of a few days while retries run; benefits continue during grace in this exercise, and the membership ends if every retry fails.
- Q: Is there a refund on cancellation? | A: In this exercise, only if no benefit was used in the current period; otherwise benefits continue to the period's end with no refund.
- Q: How does an annual plan appear in monthly reports? | A: Its charge is spread evenly across the twelve months it covers; a refund reverses the months not yet used.
- Q: An order is edited after it was placed. | A: The benefit is decided again on the edited order; say how you keep one decision of record per order.

**Hints.**
1. Separate the membership (the relationship), its periods (time slices with a state and a plan version) and the money (charges, refunds). Never rely on a single status column.
2. A benefit decision per order stores its inputs (subtotal, store eligibility, the membership period in force) and its outputs (fees waived), so it can be reproduced.
3. Store period boundaries as UTC instants, and decide which time zone defines a member's "day" for trials and renewals.

**Follow-ups.**
1. Write the query for members on a date by state: trial, paid, grace, paused.
2. A member switches from monthly to annual halfway through a month. Which rows are written, and how is the unused half month handled in this exercise?
3. The price rises from {{monthly_price}} for new periods from next month. What changes for an existing member at renewal, and how does monthly revenue report it?
4. Support asks why order O did not get free delivery. Produce the evidence from your tables.
5. At {{members}} members, how would you compute monthly benefit cost against revenue, and what is recomputed when a refund arrives late?

**Follow-up rules.**
- when: status, is_member, active flag → ask: A single status column says "active". How do you answer how many members were in grace on the 3rd of last month, and why an order from that day got the benefit?
- when: end_date, expires_at → ask: A member cancels on the 10th with the period paid to the 25th. What does your expiry say on the 12th, and does an order on the 20th get the benefit?
- when: subtotal → ask: The subtotal was {{min_subtotal}} before a promotion and below it after. Which number does your benefit decision store, and could you reproduce the decision a year later?
- when: annual → ask: An annual plan was paid in March. How does monthly revenue report it, and what happens when it is refunded in May?
- when: prorate, proration → ask: Which events in this exercise prorate, and where is the prorated amount stored so finance can reconcile it with the charges?

**Production Reality Check.**
- After a payment provider outage, thousands of renewals failed at once. A version that ended memberships on the first failed attempt removed benefits from members who were still inside this exercise's grace period, and support received complaints about delivery fees.
- The monthly benefit cost doubled for one week: orders that were edited after placement recorded a second benefit decision, and the report summed both.
- Members who started a {{trial_days}}-day trial late in the evening were charged a day early: the trial end was computed in UTC days while the member had been shown a local date.

**Evaluation Criteria.** Plans with versions; memberships with non-overlapping periods carrying state and plan version; billing attempts, charges and refunds as money records; this exercise's rules for trials, grace, cancellation and price changes applied by period; one benefit decision of record per order with reproducible inputs; annual revenue spread across months; members-by-state on a date answered from periods; aggregates for analytics and member-scoped support views; incidents explained and repaired by correcting periods and decisions, not by editing totals.

## DSH-L3-05: Ordered while closed — orders accepted while a store was paused or outside its listed hours, and open minutes lost to pauses, per store and week

| | |
|---|---|
| **Template ID** | DSH-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / holiday overrides of weekly hours, intervals across midnight, half-open boundaries, three-way interval intersection, store-week calendars |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer |
| **Generator** | DSH-L3-05.mjs |

**Business Scenario.** A local commerce marketplace lists each store's hours, and a merchant can pause a store from its tablet or portal when the kitchen is overwhelmed or the tablet is offline (this exercise's model; check current docs for how real merchant tools behave). An order should not be accepted while a store is paused or outside its listed hours, yet some are: an app showing a stale menu, a clock out of step, a scheduled order. Merchant operations want a weekly view per store: how many orders were accepted while the store was closed, how many of those during a pause, and how many open minutes each store lost to pauses. {{sample_note}} The sample covers {{weeks}} weeks, from Monday {{first_day}} to Sunday {{last_day}}, for {{store_count}} stores.

**Problem Statement.** Write one PostgreSQL query that returns `store_id, week_start, orders_accepted, orders_while_closed, orders_while_paused, minutes_paused`: one row for every store and every week of the sample, zeros included, ordered by `store_id, week_start`.
- `week_start` is the Monday of the week; a week runs from Monday 00:00 to the next Monday 00:00. An order belongs to the week of its `accepted_at`.
- **Listed hours for a date.** If the store has any `holiday_hours` rows for that date, they replace the date's weekly hours entirely, and a row with NULL times means closed all day. Otherwise the store's `weekly_hours` rows for the date's ISO weekday (1 = Monday … 7 = Sunday) apply; a weekday with no rows is closed.
- Each listed row is the interval [date + `open_time`, date + `close_time`). When `close_time` is earlier than `open_time`, the interval ends at `close_time` on the next date. Hours belong to the date they open on: an interval that opened the evening before still applies after midnight, even when the new date is a holiday or the first day of the sample.
- A pause is [`paused_at`, `resumed_at`). A NULL `resumed_at` means the store was still paused at {{sample_end}}, the end of the sample.
- `orders_while_closed` counts orders accepted while the store was paused or outside its listed hours, each order once. `orders_while_paused` counts orders accepted while it was paused.
- `minutes_paused` is the number of minutes in the week during which the store was both paused and inside its listed hours, as an integer. A pause that crosses Monday 00:00 is split between the two weeks, and minutes before {{first_day}} are outside the sample.

**Constraints.** One SQL statement (CTEs allowed). Every timestamp is a `TIMESTAMP` (without time zone) in the stores' local time; the stores share one time zone and the sample has no daylight-saving change, so no conversion is needed. A store's listed intervals never overlap each other, and neither do its pauses. Pause boundaries fall on whole minutes. You may use `{{first_day}}`, `{{last_day}}` and `{{sample_end}}` as literals. The sample has {{order_rows}} orders; production has hundreds of thousands of stores and runs this report every Monday morning.

**Assumptions.** Hypothetical schema, stores, hours, pauses and orders. The hours, holiday and pause rules are this exercise's model. An order that was accepted and later cancelled still counts as accepted here.

**Clarifications.**
- Q: An order accepted exactly at `close_time`? | A: The store was closed. Intervals are half-open: open from `open_time`, closed from `close_time`.
- Q: A late-night store is open 17:00 to 01:30, and Wednesday is a holiday when it is closed all day. Is it open at 00:45 on Wednesday? | A: Yes. Tuesday's interval opened on Tuesday and runs to 01:30 on Wednesday; Wednesday's holiday replaces only the hours that open on Wednesday.
- Q: Does a pause outside listed hours count towards `minutes_paused`? | A: No, only the minutes when the store would otherwise have been open. An order accepted during such a pause still counts as accepted while paused.
- Q: A store had no orders in a week. | A: It still gets a row, with zero orders and whatever paused minutes it had.
- Q: An order is accepted during a pause and after closing time. | A: It counts once in `orders_while_closed` and once in `orders_while_paused`.

**Hints.**
1. Build the listed intervals first: one row per store and date from {{first_day}} − 1 through {{last_day}} (`generate_series`), joined to that date's holiday rows when it has any (dropping the NULL ones) and otherwise to the weekly rows (`NOT EXISTS`). `date + time` gives a timestamp; add a day to the close when it is earlier than the open.
2. Flag each order with `EXISTS` (a pause contains it) and `NOT EXISTS` (a listed interval contains it), then count with `FILTER`.
3. For the minutes, intersect three intervals — the pause, the listed interval and the week — with `GREATEST` of the starts and `LEAST` of the ends, keep the positive pieces, and sum `EXTRACT(EPOCH FROM …) / 60`.
4. Start the final `SELECT` from stores crossed with weeks and `LEFT JOIN` both aggregates.

**Follow-ups.**
1. Stores sit in several time zones and the sample crosses a daylight-saving change. What changes in the schema and in the query, and which "minutes" are right on the night the clocks go back?
2. Two pauses of one store overlap (the tablet and the portal both paused it). What does your query report, and how would you make it correct?
3. Merchants want orders while closed split by cause: paused, outside weekly hours, closed for a holiday. How do you attribute an order with more than one cause?
4. At production scale, rebuilding every store's intervals for every date each week is wasteful. What would you materialise, at what grain, and what invalidates it?

**Follow-up rules.**
- when: between → ask: BETWEEN includes both ends. What does your query say about an order accepted exactly at `close_time`, or exactly at `resumed_at`?
- when: from orders, join orders, inner join → ask: Which store-weeks disappear when you start from the orders, and what about a week that had paused minutes but no orders?
- when: midnight, close_time < open_time, close_time > open_time → ask: Tuesday's interval opens at 17:00 and closes at 01:30, and Wednesday is a holiday closed all day. Is the store open at 00:45 on Wednesday in your query?
- when: sum(case, paused + outside → ask: An order accepted during a pause after closing time. How many times does your `orders_while_closed` count it?
- when: epoch, extract(epoch → ask: How do you keep a pause's minutes before {{first_day}}, or beyond the end of the week, out of the sum?
- when: now(), current_timestamp → ask: A pause with no `resumed_at`: why end it at the end of the sample rather than now, and what would rerunning last month's report give otherwise?

**Production Reality Check.**
- A late-night store showed about a third of its orders as accepted outside its hours every week: a version of this query cut every interval at midnight, so each order after 00:00 looked closed.
- Merchants who set holiday hours for a date saw their previous night's late orders flagged as closed: holiday rows were applied from midnight and cut short the evening before.
- A few stores showed thousands of paused minutes: automatic pauses from tablets that never reconnected had no `resumed_at`, and the report counted them to the end of the period without anyone checking.

**Evaluation Criteria.** Listed intervals built per store and date, with holiday rows replacing weekly rows and NULL rows meaning closed; intervals across midnight kept whole and taken from the day before the sample; half-open boundaries for hours and pauses; an open pause ended at the end of the sample; orders while closed counted once; paused minutes from a three-way intersection clipped to each week; every store-week present with zeros; deterministic order; can discuss time zones and daylight saving, overlapping pauses, cause attribution and materialisation.
