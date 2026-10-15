# CoreWeave · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of a GPU cloud for
AI workloads: capacity reservations and contracts, on-demand GPU instances,
Kubernetes-based customer clusters, GPU-hour metering and billing, regions and
data centres with power constraints, storage and networking services. Every
contract, price, capacity, power figure, volume and schema is hypothetical and
"this exercise's rule; check current docs"; nothing here describes a real
customer, contract, data centre, supplier or internal system.
Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## CRW-L3-01: Contracts and reservations as data — ramps, amendments and committed capacity as of a date

| | |
|---|---|
| **Template ID** | CRW-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / contract versions, ramp schedules, valid time versus knowledge time, capacity holds |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ai-infra-engineer |

```params
{
  "active_contracts": {"1": ["150"], "2": ["800", "2,000"], "3": ["6,000", "15,000"]},
  "max_ramp_steps": [4, 8, 12],
  "amendments_per_year": [2, 4, 6],
  "term_years": [2, 3, 5]
}
```

**Business Scenario.** A GPU cloud sells capacity two ways: on-demand instances by the hour, and reserved capacity under contracts. In this exercise's model, a contract has one or more lines; each line commits a number of GPUs of one GPU type in one region for a term of up to {{term_years}} years, at a price per GPU-hour, and usually ramps up in steps (up to {{max_ramp_steps}} steps per line) as the provider brings capacity online and the customer grows into it. Contracts change: a contract is amended about {{amendments_per_year}} times a year on average, to add GPUs, move a ramp step earlier or later, add a region, or change the price from a future month. Behind each line, the provider holds physical capacity for the customer (a capacity reservation) in a region or availability zone, which may be in place before the line starts. There are about {{active_contracts}} active contracts. Sales, finance, capacity planning and provisioning all ask "how many GPUs are committed on this date?", and they do not always mean the same thing. All prices, terms and counts are hypothetical.

**Problem Statement.** Design the data model for contracts and reservations. Cover: the contract, its lines and its amendments, and what an amendment stores (the whole restated terms, or only the changes); ramp steps and prices per line, with money as integer minor units and a currency; the capacity reservations that hold supply for each line and how they relate to the commitment; and the two times every question needs, when a term applies (the day it commits GPUs) and when it was agreed (the amendment's signing). Show how to answer: "committed GPUs by GPU type, region and day for next quarter, as the contracts stand today"; "what did this contract commit for last March, as it stood when March was invoiced"; and "lines whose reservations hold fewer GPUs than they commit".

**Constraints.** An amendment never overwrites earlier terms; any past state of a contract can be reconstructed. A line's GPU type and region are fixed; moving GPUs to another region ends part of one line and starts another. Prices are integer minor units per GPU-hour with a currency, and a price change applies only from its stated effective date. A customer sees only its own contracts.

**Assumptions.** Contract counts, steps, amendment rates, terms, prices and GPU types are hypothetical; check current docs for how any real offering is contracted. On-demand usage is out of scope except where a contract states a rate for use above its commitment (this exercise's rule).

**Clarifications.**
- Q: Can an amendment change a date in the past? | A: Yes. By agreement a ramp step can be back-dated, for example to the day capacity was actually handed over. Finance still needs to see what was agreed before the amendment.
- Q: Does a contract have one GPU type? | A: Not necessarily. A contract can have several lines, each with its own GPU type, region, ramp and price.
- Q: Is a capacity reservation the same thing as the commitment? | A: No. The commitment is what the customer bought; the reservation is supply the provider holds for it. A reservation can start before the line, cover only part of it, or move between zones.
- Q: What does a renewal look like? | A: Your choice: a new contract or an amendment extending the term. State the choice and what it does to the commitment in the overlap month.
- Q: How precise must prices be? | A: Exact. Integer minor units per GPU-hour, with the currency; no floating point.

**Hints.**
1. Separate identity (contract, line) from versions (amendment, signed on a date) from terms (ramp steps and prices that each amendment restates).
2. Two time axes: the effective date of a step says when it applies; the amendment's signing date says when it became known. A question "as it stood on date K" filters amendments by signing date first.
3. Derive a daily committed-capacity table from the terms instead of storing counters that amendments must keep in sync.

**Follow-ups.**
1. Write the query shape for committed GPUs by GPU type, region and day next quarter as the contracts stand today, and the same as they stood on the first of last month. What changes between the two?
2. A customer moves 64 GPUs from one region to another in month 7 of a {{term_years}}-year term. Model it, and show both regions' committed GPUs for months 6 to 8.
3. An amendment back-dates a ramp step by two weeks. Which reports change, which must not, and how does an invoice already sent stay explainable?
4. With {{active_contracts}} contracts, up to {{max_ramp_steps}} steps per line and about {{amendments_per_year}} amendments per contract a year, estimate a daily committed-capacity table over the whole horizon. Do you materialise it, and what triggers a rebuild?

**Follow-up rules.**
- when: update the contract, overwrite, current terms → ask: Finance asks what the contract committed for March as it stood when March was invoiced, before last week's amendment. Can your model answer that?
- when: json, jsonb, document → ask: Capacity planning needs committed GPUs by type, region and day across every contract. How do they query terms stored inside documents, and what validates them?
- when: valid_from, scd, type 2 → ask: Does your validity range say when a term applies or when it was agreed? Walk through a back-dated ramp step with it.
- when: price, rate, discount → ask: A price changes with a ramp step, and an amendment changes it again from a future month. Where does the price live, and how does an invoice pick the right one?
- when: reservation, reserved, allocation → ask: The provider holds capacity in a zone for a line that starts next month. Is that a commitment, a reservation or both, and how does capacity planning avoid counting it twice?

**Production Reality Check.**
- An amendment that moved a ramp step two weeks earlier was entered by editing the step's date in place. The quarter's committed-capacity report changed silently, and last month's invoice for that contract no longer matches the terms shown to the customer.
- A renewal was loaded as a new contract while the old contract's last month was still running. With about {{amendments_per_year}} amendments per contract a year already flowing through the same pipeline, nobody noticed that the capacity forecast counted the renewing customers' GPUs twice for the overlap month.
- A region's GPUs were moved to another zone, but the capacity reservations still pointed at the old zone. The report of lines held below their commitment listed dozens of healthy lines for a week.

**Evaluation Criteria.** Contract and line identity separated from immutable amendments and the terms they restate; ramp steps and prices per line with effective dates and integer minor units; valid time and knowledge time both modelled, with "as it stood on a date" answerable; region moves and renewals modelled without double counting; reservations distinct from commitments, with a reconciliation between them; a derived daily committed-capacity table with a stated rebuild trigger; customer-level access; each incident contained, corrected and guarded.

## CRW-L3-02: Customer clusters as data — node pools, node lifecycle and the reservation each node counts against

| | |
|---|---|
| **Template ID** | CRW-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / declared versus observed state, lifecycle events, interval attribution to reservations |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ai-infra-engineer, ml-platform-engineer |

```params
{
  "clusters": {"1": ["400"], "2": ["3,000", "8,000"], "3": ["25,000", "60,000"]},
  "max_pool_nodes": [64, 512, 2048],
  "lifecycle_events": {"1": ["50,000"], "2": ["400,000"], "3": ["3 million", "8 million"]},
  "replacement_share": ["1%", "3%"]
}
```

**Business Scenario.** Customers of a GPU cloud run managed, Kubernetes-based clusters (described generally here). A cluster has node pools; each pool declares an instance type (a GPU type and node size) and a target node count up to {{max_pool_nodes}}, and the service works to bring the running count to the declared count. A node goes through requested, provisioning, ready, draining and released; a node that fails a health check is replaced by a new node. Each ready node counts against one of the customer's capacity reservations for that GPU type and region, or, when none has room, is billed on demand (this exercise's rule). There are about {{clusters}} clusters, about {{lifecycle_events}} lifecycle events a day, and about {{replacement_share}} of nodes are replaced each week. Customers see their own clusters' state and history; finance needs node-hours by reservation and by on-demand use.

**Problem Statement.** Design the data model. Cover: clusters, node pools and their declared settings over time (instance type, target count, labels); nodes and their lifecycle as events, and how the current state and any past state are derived; replacements, and how a replacement is linked to the node it replaced; the attribution of each ready node to a reservation or to on-demand use as time intervals; and the tables that answer "nodes ready per pool at a given minute", "minutes from request to ready by GPU type and region", "the gap between declared and ready nodes per pool over a day" and "node-hours per reservation and on-demand per customer and day".

**Constraints.** Lifecycle events are immutable, can arrive late and out of order, and come from more than one source. A node id is never reused. At any instant a ready node counts against at most one reservation or is on demand, and a reservation never has more GPUs counted against it than it holds. A customer sees only its own clusters.

**Assumptions.** Cluster counts, pool sizes, event volumes and replacement rates are hypothetical. In this exercise a node is billed from ready until released, and draining counts as billed time; check current docs for real billing rules. Reservation terms come from the contracts model and are given.

**Clarifications.**
- Q: Is a replacement the same node? | A: No. It is a new node id that records which node it replaced. Both may be ready for a few minutes at once.
- Q: Who decides which reservation a node counts against? | A: An attribution step, by this exercise's rule: the reservation of the matching GPU type and region with room, oldest first; otherwise on demand. When a reservation ends, its nodes move to another reservation or to on demand without being restarted.
- Q: Can a pool's declared count change while nodes are provisioning? | A: Yes. Declared settings are versioned, and nodes being provisioned for an older target may be released before they become ready.
- Q: Which time do events carry? | A: The time of the transition at the source, and the time it was received. They can differ by minutes.
- Q: Does a customer see other customers' nodes in shared zones? | A: Never. Only their own.

**Hints.**
1. Keep declared state (pool settings, versioned) apart from observed state (node lifecycle events). The gap between them is a derived measure, not a stored counter.
2. Model node state as intervals derived from events ordered by source time, not by arrival.
3. Attribution is itself a set of intervals per node: (node, reservation or on demand, from, to). Billing and reservation use read those intervals.

**Follow-ups.**
1. Walk one node through requested, provisioning, ready, a failed health check, draining and released, with its replacement. Which rows exist in your model at the end?
2. A ready event arrives before the provisioning event for the same node. How does your derived state stay right, and what does the customer see in the meantime?
3. A reservation ends at midnight while 40 of its nodes are running. Show the attribution intervals before and after, and how node-hours for that day split.
4. At {{lifecycle_events}} events a day across {{clusters}} clusters, what do you store at full grain, what do you derive, and how fast can "ready nodes per pool at a past minute" be answered?

**Follow-up rules.**
- when: status column, current_state, update the node → ask: The customer asks how many nodes were ready in a pool at 03:00 yesterday. With a status column updated in place, how do you answer?
- when: received_at, arrival order, ingestion time → ask: Two sources report the same node's transitions, and one is minutes behind. Which time orders your events, and what happens to a state derived by arrival?
- when: node name, hostname → ask: A replacement comes up with the same hostname as the node it replaced. What identifies a node in your model, and how are node-hours kept from overlapping?
- when: reservation_id on the node, reservation column → ask: A node outlives the reservation it started under. With one reservation column on the node, how do you split its node-hours?
- when: declared, desired, target count → ask: The target count drops while nodes are still provisioning. Which nodes are released, and how does your gap measure treat nodes that never became ready?

**Production Reality Check.**
- A replacement node came up with the same hostname as the node it replaced. With about {{replacement_share}} of nodes replaced each week, node-hours were counted twice for the overlapping minutes and several customers' usage exports disagreed with their clusters' history.
- At {{lifecycle_events}} lifecycle events a day, one source began delivering events minutes late. A current-state table updated in arrival order showed thousands of nodes as provisioning hours after they were ready, and the customer status page agreed with it.
- A reservation ended at midnight UTC and the attribution step ran only hourly, so an hour of node time across many clusters was attributed to an expired reservation and never billed on demand.

**Evaluation Criteria.** Declared pool settings versioned and kept apart from observed lifecycle events; node state as intervals derived from immutable events ordered by source time; replacements as new nodes linked to the one they replaced; attribution to reservations or on demand as intervals with the capacity invariant; measures (ready nodes at a minute, time to ready, declared-versus-ready gap, node-hours by basis) defined on stated grains; storage and query cost reasoned at the stated volumes; customer-level access; each incident contained, corrected and guarded.

## CRW-L3-03: Sites as data — regions, halls, power contracts, rack positions and sellable capacity as of a date

| | |
|---|---|
| **Template ID** | CRW-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / physical hierarchy, phased power, capacity states, as-of derivations |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ai-infra-engineer |

```params
{
  "halls": {"1": ["40"], "2": ["150", "300"], "3": ["800", "1,500"]},
  "hall_power": ["6 MW", "12 MW", "30 MW"],
  "rack_power": ["40 kW", "80 kW", "130 kW"],
  "spare_share": ["2%", "5%"]
}
```

**Business Scenario.** A GPU cloud operates in several regions; each region has availability zones, each zone has one or more data centres (some owned, some leased), and each data centre has halls with rack positions. In this exercise's model every number is hypothetical: there are about {{halls}} halls, a hall's power contract allows up to about {{hall_power}} for IT load and is often energised in phases, a dense GPU rack draws about {{rack_power}}, and about {{spare_share}} of installed GPUs are held back as spares for replacements. Racks move through states: planned, delivered, installed, burned in and sellable, held, and out of service. Sales asks how many GPUs of each type can be sold in a region on a date; finance asks what was sellable last quarter; site teams ask which halls are short of power for the racks planned in them.

**Problem Statement.** Design the data model for sites and their capacity. Cover: the hierarchy (region, zone, data centre, hall, rack position) and how it changes over time (halls added, zones re-drawn, positions re-numbered); power contracts and their phases with energisation dates, planned and actual; rack positions with their power and cooling limits; racks, their node type and GPU count, and their state history; spares and held capacity; and the derivation of sellable GPUs by GPU type, region and date, both as planned and as it actually stood. Show how to answer "sellable GPUs by type and region on any past date", "halls where planned rack power exceeds energised power next quarter", and "racks installed but not yet sellable, by age".

**Constraints.** History is never overwritten: last quarter's sellable capacity must reproduce exactly. A rack occupies at most one position at a time, and the power of the racks in a hall never exceeds that hall's energised power. Spares are never counted as sellable. Location details are internal to the provider; customers see only region and zone availability.

**Assumptions.** Halls, power figures, rack draws, spare shares and state names are hypothetical; check current docs for any real region or zone. Power is modelled at the hall level; electrical design within a hall is out of scope. The GPU count of a node type is fixed.

**Clarifications.**
- Q: Is a power contract energised all at once? | A: Not here. It is energised in phases, each with a planned and an actual date, and a phase can slip.
- Q: When does a rack become sellable? | A: After it is installed and passes burn-in, if the hall's energised power covers it. Some sellable racks are then held for a customer's reservation; held racks are still capacity, but not free to sell.
- Q: Can a zone be re-drawn? | A: Yes, rarely. A data centre can move to another zone in the provider's model, and past reports must still show the zone as it was then.
- Q: Are spares fixed racks? | A: Your choice: designated spare racks, or a share of each hall's GPUs. State it, because it changes how a failed node's replacement is counted.
- Q: Does sellable capacity depend on power or on installed racks? | A: Both. The lower of what is installed and burned in, and what the energised power can run, by this exercise's rule.

**Hints.**
1. Treat the hierarchy as slowly changing: positions belong to halls, halls to data centres, data centres to zones, each with validity ranges.
2. Keep plan and actual apart for power phases and racks; sellable capacity "as planned" and "as it stood" are different derivations from the same tables.
3. Derive sellable GPUs per day from state intervals and power limits; never store a running total that later corrections must patch.

**Follow-ups.**
1. Write the derivation of sellable GPUs for one hall on one date, from rack state intervals, the energised power phases and the spare rule.
2. A power phase slips by a quarter. Which reports change, which must not, and how does sales see the new date?
3. A data centre moves to another zone. Show how last quarter's report by zone still reproduces exactly.
4. At {{halls}} halls with daily state history for every rack, how large is the daily sellable-capacity table, and what do you materialise for sales to query in under a second?

**Follow-up rules.**
- when: capacity column, sellable column, total gpus → ask: A rack fails burn-in after its hall's capacity number was updated. How do you correct the number, and how do you reproduce last quarter's figure afterwards?
- when: contracted power, contract mw, power contract → ask: The contract allows more power than is energised today. Which of the two limits sellable capacity, and where does each live in your model?
- when: rack_id, position, slot → ask: A rack is moved to another position in another hall. Does it keep its identity, and which hall's history shows its GPUs for the move day?
- when: spare, spares → ask: A spare node replaces a failed one in a customer's cluster. Does sellable capacity change, and which state records the swap?
- when: zone, availability zone → ask: The zone boundaries changed last month. Which zone does a report for last quarter use, and how does your model know?

**Production Reality Check.**
- A hall's second power phase slipped by a quarter, but sellable capacity was computed from the contracted total of about {{hall_power}}. Sales committed racks drawing about {{rack_power}} each that the hall could not yet run.
- A re-numbering of rack positions in one data centre was loaded as new positions without closing the old ones. For a month the same GPUs appeared in two halls, and regional sellable capacity was overstated.
- One report treated the {{spare_share}} spare holdback as sellable and another did not. Two dashboards disagreed by exactly that share and both were presented in the same planning meeting.

**Evaluation Criteria.** A hierarchy with validity ranges so past reports reproduce; power contracts in phases with planned and actual dates; rack positions with limits and racks with state intervals; spares and held capacity defined; sellable capacity derived as the lower of installed-and-burned-in and power-supported, as planned and as it stood; location detail kept internal; materialisation reasoned at the stated scale; each incident contained, corrected and guarded.

## CRW-L3-04: Storage and networking services as data — volumes, buckets, networks, addresses and billable units per day

| | |
|---|---|
| **Template ID** | CRW-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / resource lifecycles, attachments over time, unit definitions, state-based daily billing |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "resources": {"1": ["200,000"], "2": ["2 million", "6 million"], "3": ["25 million", "80 million"]},
  "metering_step": ["per minute", "per hour"],
  "retention_days": [1, 7, 14],
  "reassign_minutes": [1, 10, 60]
}
```

**Business Scenario.** Besides GPU instances, a GPU cloud sells storage and networking as services: block and shared-file volumes attached to clusters, object storage buckets with storage classes, private networks joining a customer's clusters, and public IP addresses. In this exercise's model, which is hypothetical throughout: a volume is billed on its provisioned size and tier; a bucket on the bytes stored per class each day; a public address while it is allocated to a customer, whether or not it is attached; a private network is free but its attachments are tracked. Billing measures resources {{metering_step}}; a deleted volume is kept recoverable for {{retention_days}} days before it is purged (whether retention is billed is a decision for this design); a released public address can return to the pool and be reassigned to another customer after {{reassign_minutes}} minutes. There are about {{resources}} resources. Customers see their resources and daily billable units; finance needs billable units per customer, service, unit and day.

**Problem Statement.** Design the data model. Cover: each resource type, its identity and lifecycle (created, resized or reclassed, attached and detached, deleted, retained, purged); attachments of volumes, networks and addresses to clusters as time intervals; how stored bytes per bucket and class are captured (state snapshots versus change events) and corrected; the definition of each billable unit (GB-days, GB-month equivalents, address-hours) and the rule for partial intervals; and the fact table of billable units per customer, resource, unit and day that invoices are built from. Show how a customer can trace one day's charge for one volume back to the lifecycle rows that produced it.

**Constraints.** Lifecycle history is immutable and every billable quantity is derived from it. Two customers never hold the same address at the same instant, and an address's charges go to the customer who held it at that instant. Units are exact: integers in a stated base unit (bytes, minutes), converted once when invoiced. A customer sees only its own resources.

**Assumptions.** Resource counts, metering step, retention and reassignment times, tiers and storage classes are hypothetical; check current docs for any real price or rule. Prices are out of scope; the design stops at billable units. Object request logs and network transfer metering are covered elsewhere and are out of scope here.

**Clarifications.**
- Q: A volume is resized from 10 TB to 20 TB at 14:20. How is that day billed? | A: By time-weighted size at the metering step: the minutes or hours at each size. State the partial-step rule.
- Q: How do we know bytes stored in a bucket? | A: From a daily inventory snapshot per bucket and class, and from change events in between. They can disagree; say which is authoritative.
- Q: Is a detached volume billed? | A: Yes, in this exercise. A volume is billed while it exists; attachment only matters for reporting and for deleting clusters safely.
- Q: Can a bucket move between storage classes? | A: Objects can, through lifecycle rules. A bucket can hold several classes at once, so the unit is bytes per class.
- Q: What happens when a cluster is deleted? | A: Its attachments end. Volumes and addresses stay with the customer until deleted or released, and keep billing.

**Hints.**
1. Model each resource as an entity plus an append-only history of state intervals (size, tier, class, owner, attachment); daily units are an integral over those intervals.
2. Keep attachments as their own intervals; never put a cluster_id column on the volume.
3. Define every unit in base units with the rounding step stated once, and derive daily facts from intervals clipped to the day.

**Follow-ups.**
1. Compute one volume's GB-days for a day in which it was created at 09:00, resized at 14:20 and deleted at 22:00, under the {{metering_step}} rule. Show the rows that produce it.
2. A daily bucket inventory disagrees with the sum of change events by 3%. Which wins for billing, how is the difference corrected, and what does the customer see?
3. A public address is released and reassigned to another customer {{reassign_minutes}} minutes later. Show the intervals and each customer's address-hours for that day.
4. At {{resources}} resources with minute-level history, what do you keep at full grain, for how long, and what does the daily fact cost to rebuild for one corrected day?

**Follow-up rules.**
- when: cluster_id on the volume, attached_to → ask: A volume is detached from one cluster and attached to another at 11:00. With one column on the volume, which cluster held it at 10:59, and how do you report it?
- when: snapshot, daily inventory → ask: A bucket grows from 1 TB to 100 TB at 23:00 and is emptied at 01:00. What does a once-a-day snapshot bill, and is that the rule you want?
- when: deleted_at, soft delete, retention → ask: Is retained-but-deleted storage billed in your model? Where is that decision recorded, and how does the customer see it?
- when: float, floating point, decimal gigabytes → ask: Your daily GB-days are summed over a month across millions of resources. Where can rounding drift appear, and which base unit avoids it?
- when: ip address, public address → ask: An address is released and reassigned within {{reassign_minutes}} minutes. What makes it impossible, in your model, for two customers to be charged for the same instant?

**Production Reality Check.**
- A volume resized twice in an hour was billed at the smaller size for the whole hour. With metering {{metering_step}}, the customer's daily export disagreed with the size history the console showed.
- A release renamed a lifecycle state, and deleted volumes in their {{retention_days}}-day retention period were billed for some customers and not others for two weeks.
- A public address was reassigned to a second customer {{reassign_minutes}} minutes after release, but the first customer's release event arrived late. Both customers were charged for the same address-hours.

**Evaluation Criteria.** Resource identity separated from append-only state intervals; attachments as their own intervals; snapshot versus event capture reasoned, with one authoritative source and a correction path; units defined in base units with one partial-interval rule; exclusive address ownership enforced; a daily billable-units fact traceable to lifecycle rows; retention billing decided and recorded; scale and rebuild cost reasoned; each incident contained, corrected and guarded.

## CRW-L3-05: Delivered versus committed — GPUs ready against a contract's ramp, and shortfall GPU-days per month

| | |
|---|---|
| **Template ID** | CRW-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / calendar expansion, as-of joins over versioned schedules, interval snapshots, per-day floors |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, ai-infra-engineer |
| **Generator** | CRW-L3-05.mjs |

**Business Scenario.** A GPU cloud sells reserved capacity under contracts (this exercise's model; every contract, GPU type and number is hypothetical). A contract commits GPUs of one `gpu_type` from `start_date` through `end_date` (both inclusive), ramping up in steps. Contracts are amended: `contract_amendments` lists each contract's amendments with `signed_on` (amendment 0 is the original signing, on or before `start_date`), and every amendment restates the whole ramp in `ramp_steps`: from a step's `effective_date`, `committed_gpus` GPUs are committed until that amendment's next step. {{amend_note}} Nodes are provisioned into the customer's cluster against the contract; `nodes` records each node's GPU type, its GPU count, when it was requested, when it became ready (NULL if it never did) and when it was released (NULL if it is still running). Account teams want to see, for {{window_label}}, how delivery tracked each contract's ramp.

**Problem Statement.** Write one PostgreSQL query that returns `contract_id, month, committed_gpu_days, ready_gpu_days, shortfall_gpu_days, short_days`: one row per contract and calendar month that has at least one contract day between `{{from_date}}` and `{{to_date}}` (inclusive), ordered by `contract_id, month`. `month` is text in the form `YYYY-MM`.
- The contract days are the dates from `start_date` through `end_date` that fall inside the window. Days are UTC calendar dates.
- **Committed** on day d: the amendment in force on d is the contract's highest `amendment_no` with `signed_on` on or before d. The commitment is the `committed_gpus` of that amendment's step with the latest `effective_date` on or before d. Steps of any other amendment never apply on d.
- **Ready** on day d (this exercise's rule: one measurement a day, at 00:00 UTC): the sum of `gpus` over the contract's nodes whose `gpu_type` is the contract's and that were ready at the start of d: `ready_at` at or before d 00:00, and `released_at` NULL or after d 00:00.
- `committed_gpu_days` is the sum of the daily commitment over the month's contract days and `ready_gpu_days` the sum of the daily ready GPUs (more than committed counts in full). `shortfall_gpu_days` is the sum over those days of max(committed − ready, 0): a day with more GPUs ready never makes up for a short day. `short_days` is the number of days with ready below committed.

**Constraints.** One SQL statement (CTEs allowed). The sample has {{contracts}} contracts, {{step_rows}} ramp-step rows and {{node_rows}} node rows; production has thousands of contracts, years of ramps and millions of node rows.

**Assumptions.** Hypothetical schema, contracts, GPU types, regions and counts; check current docs for how any real contract measures delivery. `requested_at` and `region` are context and play no part in the calculation. Each amendment's ramp starts at the contract's `start_date`, so a commitment exists on every contract day.

**Clarifications.**
- Q: A node became ready at 14:00 on the 3rd. Does it count on the 3rd? | A: No. Each day is measured at 00:00 UTC, so it counts from the 4th. A node ready at exactly 00:00 on the 3rd counts on the 3rd.
- Q: And a node released at exactly 00:00? | A: It does not count that day: it must still be running after 00:00.
- Q: An amendment signed on the 15th has a step effective on the 1st. Does it change the 1st to the 14th? | A: No. Until the 15th the earlier amendment is in force. From the 15th, the new amendment's latest step on or before the day applies, which may be that back-dated step.
- Q: Do nodes of another GPU type assigned to the contract count? | A: No. Only nodes of the contract's `gpu_type` deliver against it.
- Q: Should days after `end_date` appear, if nodes are still running? | A: No. Only contract days count, and a month with no contract day in the window has no row.

**Hints.**
1. Expand each contract into its days with `generate_series`, clipped to both the term and the window.
2. For each contract day, find the amendment in force, then that amendment's latest step on or before the day (a correlated subquery with `ORDER BY … LIMIT 1`, or `LATERAL`).
3. LEFT JOIN the nodes on the snapshot condition, sum `gpus` with `COALESCE` per day, floor each day's shortfall at 0, and only then aggregate by month.

**Follow-ups.**
1. In production this expands thousands of contracts into days and joins each day to millions of nodes. How would you compute ready GPUs per day without the day × node join?
2. The customer measures delivery by the minute, not at midnight. How would you compute GPU-minutes short, and which nodes change the answer most?
3. Finance wants this month's shortfall as it stood on the 1st, before an amendment signed on the 10th. What changes in the query, and what does the data model need to make that answer reproducible?
4. Over-delivery is not a credit against shortfall here. Make the case for and against netting within a week, and say who should decide.

**Follow-up rules.**
- when: join ramp_steps, sum(committed_gpus) → ask: One contract has three steps in each of two amendments. How many ramp rows does each day join to, and what does a SUM over that join give?
- when: max(amendment_no) → ask: Is the contract's highest amendment in force on every day of the term, including days before it was signed?
- when: count(*) * 8, count(node_id) → ask: Does every node carry the same number of GPUs? Which column says how many?
- when: date_trunc, ready_at::date, cast(ready_at as date) → ask: A node became ready at 14:00 on the 3rd. Which day does your condition count it on, and what does the rule say?
- when: lateral, correlated subquery → ask: This runs once per contract-day. At production scale, how would you make the commitment lookup set-based?

**Production Reality Check.**
- An account review showed no shortfall for a month in which a customer had waited two weeks for nodes. An earlier version of this report netted over-delivered days against short ones.
- An amendment signed mid-month back-dated a ramp step to the 1st. The report re-run after signing moved commitment into days before the amendment existed, and a conversation with the customer started from numbers that neither side had agreed for those days.

**Evaluation Criteria.** Contract days generated from the term and clipped to the window, not taken from node rows; the amendment in force chosen by `signed_on` per day and the latest step of that amendment only; the snapshot condition at 00:00 with the stated boundaries; nodes filtered by GPU type and summed by `gpus`; shortfall floored per day before aggregating; `month` formatted and ordered deterministically; can discuss an interval sweep for scale, minute-level delivery, as-known-on reporting and netting policy.
