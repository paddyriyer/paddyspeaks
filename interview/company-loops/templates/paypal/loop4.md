# PayPal · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of a consumer wallet and peer-to-peer payments service. They are not questions from any company's interviews, and they describe no company's internal systems. All numbers are hypothetical.

## PYP-L4-01: A social payments feed with privacy — audiences, retroactive changes, blocks and hidden payments that never resurface

| | |
|---|---|
| **Template ID** | PYP-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Privacy-aware fan-out / audience rules, retroactive visibility changes, read-time enforcement |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "users": {"2": ["40 million", "60 million"], "3": ["90 million", "150 million"]},
  "payments_per_day": {"2": ["8 million", "15 million"], "3": ["30 million", "60 million"]},
  "friends": [80, 250, 600],
  "propagation": ["1 minute", "5 minutes", "15 minutes"]
}
```

**Business Scenario.** A peer-to-peer payments app with about {{users}} active users shows a social feed: when two people pay each other, the payment can appear to others with the participants' names, the note they wrote and the time, but never the amount (this exercise's rule). About {{payments_per_day}} payments a day are made, and a typical user has around {{friends}} friends, with some accounts far above that. Each payment is posted with an audience: public, friends or private. Under this exercise's rule (check current docs), a user has a default audience that applies to new payments unless they override it on the payment; a payment is shown with the most restrictive audience chosen by any of its participants; a participant can later make a past payment more private, one at a time or all at once, but never less private. A user can block another, after which neither sees the other's payments anywhere, including ones made before the block. A participant can hide a payment from the feed, and a note can be removed after a report; neither may ever be seen again by anyone it was hidden from.

**Problem Statement.** Design the feed. Cover the write path from a completed payment to feed entries; how the effective audience is computed and stored; fan-out to friends' feeds versus assembling feeds on read, and what you do for accounts with very large friend lists; the read path and where privacy is enforced; how a retroactive change (one payment made private, or all past payments at once), a block, or a hide takes effect everywhere within {{propagation}}; caches, search, notifications and rebuilds; and how you would prove continuously that nothing hidden is being served.

**Constraints.** A feed page loads in under 300 ms at p99. A privacy change, a block or a hide takes effect on every surface within {{propagation}}, and a stale copy must fail closed: if the system is unsure whether a viewer may see an entry, it does not show it. The amount of a payment never enters the feed path. People see only what their audience allows; no analytics on the feed identifies an individual's payments outside that person's own view.

**Assumptions.** All volumes, times and rules are hypothetical. The payments system is given: it emits a completed-payment event with the payment id, participants, note, time and each participant's chosen audience. The friend graph is a given service with friend lists and a change stream. A trust and safety team decides note removals; you receive the decisions.

**Clarifications.**
- Q: If I pay a friend and my default is public but theirs is friends-only, what does the feed show? | A: Friends-only, under this exercise's rule: the most restrictive participant choice wins. Whose friends see it is yours to define; say what you chose.
- Q: Can a payment ever become more public later? | A: No. Past payments can only become more private in this exercise.
- Q: Does a new friendship show the new friend old friends-only payments? | A: Your call; say what you choose and why. Ending a friendship must remove them from view within {{propagation}}.
- Q: Are there other surfaces besides the home feed? | A: Yes: each user's profile list, search over notes, notifications, and a data export of a user's own activity.
- Q: Does the feed have to be in exact time order? | A: Newest first by payment time; a few seconds of disorder between entries is acceptable.

**Hints.**
1. Separate what a payment is (immutable facts) from who may see it (a small, mutable visibility record). Fan-out copies can carry the first; the second must be checked on read.
2. Fan-out on write is cheap to read and expensive to change; fan-out on read is the opposite. A hybrid, with a different path for accounts with very large friend lists, is common.
3. Treat every privacy change as an event with a version. A copy of an entry is servable only if it has been checked against a visibility version at least as new as the latest change.

**Follow-ups.**
1. Walk through one payment from completion to appearing in a friend's feed. Which records are written, and which of them change when a participant later makes it private?
2. A user with 40,000 past payments makes them all private at once. How does that take effect within {{propagation}} without rewriting 40,000 times their friend count feed entries?
3. A block is applied. Which surfaces must change, in what order, and what does the blocked person's next feed request see?
4. A region fails over and feed caches are rebuilt from a snapshot taken two hours earlier. How do you guarantee that nothing hidden in those two hours comes back?
5. How would you detect, continuously and in production, that an entry is being shown to someone its audience excludes?

**Follow-up rules.**
- when: fan-out on write, push model, precompute → ask: An account with 5,000 friends sets all past payments to private. How many feed entries are now wrong, and what is served in the meantime?
- when: fan-out on read, pull model, read time → ask: A feed request now needs a few hundred friends' recent payments and a visibility check for each. What is the p99, and what do you cache?
- when: cache, caching, redis, cdn → ask: The cache holds a rendered page that includes a payment hidden a minute ago. What makes that page unservable?
- when: tombstone, soft delete, deleted flag → ask: A rebuild job reads the payments table, which still has the hidden payment. What stops the job from putting it back into feeds?
- when: eventual consistency, eventually consistent, async → ask: Which privacy changes are you willing to make eventual, and how does the read path fail closed while they propagate?

**Production Reality Check.**
- A user makes all 30,000 of their past payments private. The change queue processes it in batches behind other work, and six hours later some of those payments are still in friends' feeds, far beyond the {{propagation}} target.
- After a regional failover, feed caches are rebuilt from a snapshot taken two hours before. Payments that were hidden, and notes that were removed, during those two hours reappear for about 20 minutes.
- A new release of the feed service computes the audience from the payer's setting only. For three hours, payments whose recipient had chosen friends-only are shown publicly.
- A block is applied correctly to the home feed, but the blocked person still finds the blocker's past payments through note search, which is served by a separate index refreshed hourly.

**Evaluation Criteria.** Separates immutable payment facts from a versioned visibility record (effective audience as the most restrictive participant choice, hides, removals, blocks); a fan-out strategy justified with numbers for {{payments_per_day}} payments and about {{friends}} friends, with a different path for very large friend lists; privacy enforced at read time on every surface (feed, profile, search, notifications, exports), failing closed when the visibility version is uncertain, so retroactive changes take effect within {{propagation}} without rewriting every copy; tombstones and visibility versions that rebuilds, snapshots and replays must honour; continuous verification (sampled re-checks of served entries against the visibility store, canary viewers) and audit; amounts kept out of the feed path; adapts to each incident with diagnosis, recovery and prevention.

## PYP-L4-02: Pay-later reminders and autopay for consumers — notices, attempts across funding sources, retries and a schedule people can trust

| | |
|---|---|
| **Template ID** | PYP-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Durable scheduling / local due dates, idempotent payment attempts, notifications, no credit conclusions |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "plans": {"2": ["3 million", "6 million"], "3": ["12 million", "25 million"]},
  "markets": [4, 9, 20],
  "reminder_days": [3, 5, 7],
  "retries": [2, 3]
}
```

**Business Scenario.** A wallet offers consumers a pay-later option at checkout: a purchase is split into instalments due on set dates (for example four instalments two weeks apart; this exercise's rule, check current docs). About {{plans}} plans are active across {{markets}} markets and many time zones. Each instalment is due on a date in the consumer's own time zone. Autopay is on unless the consumer turns it off: on the due date the instalment is charged to the funding source the consumer chose for the plan; under this exercise's rule, another of their funding sources is tried only if they opted in to a fallback. A reminder goes out {{reminder_days}} days before each due date. A declined attempt is retried up to {{retries}} times on later days (this exercise's rule). Consumers can pay early in the app, pay part of an instalment, change the funding source, or turn autopay off at any moment, including minutes before it runs. Some funding sources, such as bank transfers, report success only days later and can be returned after that.

**Problem Statement.** Design the reminder and autopay system. Cover the schedule store and how due dates are computed and kept in local time; the scheduler that finds what is due and runs it exactly once; the attempt workflow with fallbacks and retries; how a manual payment, a funding change or an autopay switch-off that arrives at the same moment as an autopay attempt is resolved; notifications (reminders, receipts, failure notices) that are timely, not duplicated and sent at sensible local hours; pending and returned bank payments; and the analytics that show whether reminders and autopay are working. The system draws no conclusion about any person's credit-worthiness or eligibility; it schedules, attempts, notifies and records.

**Constraints.** No instalment is ever charged twice, and no instalment that was already paid is charged at all. A consumer is never told an instalment is paid until it is, and never told it failed when it is still pending. Reminders and failure notices are sent between 08:00 and 21:00 local time. Every attempt, its funding source, the response and every notice is recorded with a reason. Analytics are aggregates (by market, funding type, attempt number); only a consumer sees their own schedule and history.

**Assumptions.** All volumes and rules are hypothetical. The payment service that charges a funding source is given and accepts a caller-supplied attempt id, so a repeated request with the same id returns the first outcome. Late-fee and hardship rules, if any, are decided by a separate service you call; you do not design them. A notification service is given and delivers push, email and text.

**Clarifications.**
- Q: At what time on the due date does autopay run? | A: Your call, in the consumer's local time; say why. The instalment counts as on time if paid by the end of the due date locally.
- Q: What if the consumer moves to another time zone? | A: Due dates stay the same calendar dates; decide which zone governs when autopay runs, and say how you record the change.
- Q: Are retries on the same funding source? | A: First the plan's source; the fallback only if the consumer opted in, and only in the order they set. Retries happen on later days under this exercise's rule.
- Q: Does the consumer see a failed attempt immediately? | A: Yes, with what happens next. Pending bank transfers must be shown as pending, not as paid.
- Q: Can analytics label consumers as risky or likely to miss payments? | A: No. Report what happened to schedules and attempts in aggregate; no labels about people.

**Hints.**
1. Store due dates as local calendar dates plus the consumer's time zone; compute the run instant from them when scheduling, not once at plan creation.
2. Each instalment is a small state machine with a version. An attempt is allowed only if it wins a conditional transition (due → attempting) against the version it read; a manual payment uses the same transition.
3. An attempt id derived from (instalment, attempt number) makes a retried request harmless, because the payment service returns the first outcome.

**Follow-ups.**
1. Walk through one instalment: reminder, due date, a declined first attempt, a successful retry on the fallback source. Which records and notices exist at the end?
2. A consumer pays the instalment manually at 08:59 and autopay is scheduled for 09:00. Show why your design cannot charge twice.
3. A bank transfer used by autopay is reported as returned three days after it was shown as pending. What changes in the schedule, and what is the consumer told?
4. How does the scheduler find a day's due instalments across {{markets}} markets without one huge scan, and what happens if it is down for six hours?
5. How do you measure whether reminders help, in aggregate, without drawing conclusions about individual consumers?

**Follow-up rules.**
- when: cron, nightly batch, batch job → ask: Your nightly job runs at one moment for every time zone. Whose due date is it at that moment, and who is charged on the wrong day?
- when: queue, kafka, message queue → ask: The attempt message is delivered twice, two minutes apart, to two workers. What stops the second charge?
- when: utc, timestamp → ask: The due date is a local calendar date. What happens to a consumer's 09:00 autopay on the night clocks change?
- when: retry, retries, backoff → ask: A bank outage declines 200,000 attempts on one morning and every retry is scheduled for the same time tomorrow. What happens then?
- when: lock, mutex, distributed lock → ask: The lock holder pauses for 40 seconds while holding the lock on an instalment. What does the manual payment path do meanwhile, and how do you avoid acting on an expired lock?

**Production Reality Check.**
- On the night clocks change in two of the {{markets}} markets, the scheduler computes run times from a fixed UTC offset stored at plan creation. Autopay runs a day early for about 60,000 instalments, and some consumers' accounts are overdrawn by a charge they expected the next day.
- About 1,400 consumers who paid manually in the minutes before autopay were charged again, because the autopay worker read the schedule from a replica that was a few seconds behind.
- A bank-transfer outage declines a large share of one morning's attempts. Every retry is queued for the same hour the next day, the payment service throttles, and failure notices go out to consumers whose transfers were in fact still pending.
- A notification change ignores local time, and {{reminder_days}}-day reminders reach consumers in one market at 03:00.

**Evaluation Criteria.** Due dates as local calendar dates with the zone kept and run instants computed at scheduling time (daylight saving handled); a durable, partitioned schedule index (by due date and market) with catch-up after downtime; instalments as versioned state machines with conditional transitions shared by autopay and manual payment, reading from the primary; attempt ids for idempotency with the payment service; fallback only with consent and in the consumer's order; retries spread over time with jitter and capped at {{retries}}; pending and returned bank payments modelled explicitly, with honest notices; notifications deduplicated by (instalment, notice type) and held to local hours; aggregate analytics of reminder and attempt outcomes with no labels about people and no credit or eligibility conclusions; adapts to each incident with diagnosis, recovery and prevention.

## PYP-L4-03: Checkout buttons on merchant sites, at the consumer-experience level — shown, clicked, signed in, funding chosen, completed, with no card details in analytics

| | |
|---|---|
| **Template ID** | PYP-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Client telemetry from third-party pages / funnel joins, SDK versions, data minimisation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "merchants": {"2": ["200,000", "500,000"], "3": ["2 million", "5 million"]},
  "renders": {"2": ["300 million", "600 million"], "3": ["2 billion", "4 billion"]},
  "sdk_versions": [6, 15, 40],
  "freshness": ["15 minutes", "1 hour"]
}
```

**Business Scenario.** About {{merchants}} merchant websites and apps show a wallet checkout button. They integrate it in several ways: a hosted JavaScript SDK, mobile SDKs, server-side integrations that redirect the shopper, and plugins for e-commerce platforms; {{sdk_versions}} SDK versions are in use at once. Buttons are rendered about {{renders}} times a day. From the shopper's side the journey is: the button is shown, the shopper clicks it, signs in (or continues as a guest where allowed), chooses how to pay (wallet balance, bank, card or pay later), reviews and completes, or abandons, cancels or hits an error. Product teams want this funnel per integration type, SDK version, button configuration, platform and country, refreshed within {{freshness}}; each merchant should see its own funnel and no one else's. The payment itself and its outcome are recorded by the payments platform, which is given.

**Problem Statement.** Design the telemetry and analytics: what the button and the checkout pages emit, how events from third-party pages are collected and validated, how client events are joined with server-side outcomes into one funnel per checkout session, how SDK versions and integration types are handled, the models and serving for internal teams and for each merchant, and how you guarantee that no card number, security code, bank account number or other payment credential ever reaches analytics.

**Constraints.** Analytics carry the funding category (balance, bank, card, pay later), never a card number, security code, expiry, bank account number or shopper contact detail. Merchants see only their own aggregates, with small counts suppressed. A shopper's checkout must never be slowed or broken by telemetry. Funnel numbers within {{freshness}} for dashboards; daily numbers final after 48 hours.

**Assumptions.** All volumes are hypothetical. Each checkout session has a session id issued when the button is clicked and recorded by the payments platform with the outcome; impressions happen before any session exists. Some shoppers block third-party scripts or telemetry endpoints, and some merchant pages restrict where scripts may send data. Bots load merchant pages.

**Clarifications.**
- Q: What counts as "shown"? | A: Define it. Rendered in the page and rendered in the visible part of the screen are different numbers; say which you report and how you measure it.
- Q: Can we use the shopper's email to join events? | A: No. Use the session id and identifiers issued for telemetry only.
- Q: Are server-side outcomes complete? | A: Yes for completed, cancelled and declined sessions, minutes after they happen. Client events are lossy.
- Q: Do merchants get raw events? | A: No, aggregates of their own traffic only.
- Q: Can a new SDK version change the events? | A: Yes; event schemas are versioned and old SDKs stay in the wild for years.

**Hints.**
1. Trust the server for outcomes and the client for what happened before them. A funnel that divides server completions by client clicks needs a rule for sessions whose client events never arrived.
2. Allowlist fields at the collector, per schema version, and drop anything else; free text is where credentials leak.
3. Impressions are the largest stream and the least important per event: aggregate them early (or sample with a known rate) and keep clicks and sessions exact.

**Follow-ups.**
1. Walk through one checkout from button shown to completed. Which events exist, which ids join them, and which record is authoritative for each step?
2. An SDK version starts sending "shown" twice whenever the cart updates. How do you detect it and correct the history?
3. On one merchant's site, completions appear with no clicks at all. What is happening, and how does your funnel avoid a conversion above 100%?
4. A scanner finds something shaped like a card number in raw event storage. Walk through the first hour and the following week.
5. How would you compare conversion between two button configurations fairly when merchants choose their own configuration?

**Follow-up rules.**
- when: sample, sampling → ask: A small merchant gets 300 renders a day. What does sampling do to its own funnel, and what do you show it?
- when: user id, email, cookie → ask: Which identifier joins a shopper's events across sessions in your design, and do you need it at all for this funnel?
- when: free text, error message, payload → ask: An SDK sends the browser's error message text as-is. What could be in it, and where do you stop it?
- when: dedupe, deduplicate, deduplication, event id → ask: The same click arrives twice with different event ids because the SDK retried after a page reload. What is your dedupe key?
- when: real time, real-time, streaming, flink → ask: Which numbers truly need {{freshness}} freshness, and what do you lose by computing the rest daily?

**Production Reality Check.**
- An SDK release among the {{sdk_versions}} versions in use fires the "shown" event again on every cart update. The overall click rate drops by a fifth overnight and a product team starts rolling back an unrelated button change.
- A large merchant tightens the rules on where its pages may send data, blocking the telemetry endpoint. Its dashboard shows thousands of completed checkouts a day with almost no clicks.
- A security scan finds strings that pass a card-number checksum in raw events from one SDK version's error field, collected over nine days.
- On the busiest shopping day, the funnel pipeline falls six hours behind, well outside {{freshness}}, and dashboards show conversion collapsing.

**Evaluation Criteria.** Clear event definitions (rendered versus visible, click, sign-in, funding category, outcome) with schema versions per SDK; collection that never blocks checkout (async, batched, sendBeacon-style), with an allowlist per schema version, no free text, and credential detection (checksum and pattern scanners) with quarantine and purge; impressions aggregated or sampled with known rates, clicks and sessions exact; a session-level funnel joining client events to authoritative server outcomes by session id, with explicit handling of missing client events; dedupe keys that survive retries and reloads; per-merchant aggregates with suppression and access scoped to the merchant; freshness within {{freshness}} for dashboards with late-data correction and final daily numbers; fair comparison of configurations; adapts to each incident with diagnosis, recovery and prevention.

## PYP-L4-04: Linking banks and cards — verification, expiries and replacements, failed links, and analytics on where linking fails

| | |
|---|---|
| **Template ID** | PYP-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Funding instrument lifecycle / external providers, state machines, failure taxonomy analytics |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "links_per_day": {"2": ["300,000", "800,000"], "3": ["2 million", "4 million"]},
  "institutions": ["2,000", "6,000", "12,000"],
  "providers": [2, 3, 5],
  "confirm_days": [5, 10, 30]
}
```

**Business Scenario.** Wallet users add banks and cards as funding sources: about {{links_per_day}} link attempts a day across {{institutions}} banks and card issuers. Verification is done in a few general ways (this exercise's options; check current docs): for banks, an instant check through one of {{providers}} verification providers where the user signs in to their bank, or two small test deposits the user confirms within {{confirm_days}} days; for cards, a small authorization that is reversed. A risk score you are given decides whether a link needs an extra step. After linking, cards expire and are replaced, sometimes with an update from the card network and sometimes only when a payment fails; bank links can break when the bank changes something. Product teams want to know where linking fails (by step, method, institution, provider, platform and app version) and to steer users to a method that works when one is failing.

**Problem Statement.** Design the linking system and its analytics. Cover the instrument model and its lifecycle (started, pending verification, verified, failed, expired, replaced, removed); the integration with verification providers and the payment network, including timeouts and late answers; test-deposit links that wait for days; card expiries and replacements, and what happens to plans and defaults that point at a replaced card; a failure-reason taxonomy that stays useful as providers and app versions change; the analytics on where linking fails; and the health signal that steers users away from a failing method.

**Constraints.** Card numbers, security codes and bank account numbers are held only by a given token vault; your systems and analytics see a vault token, the instrument type, the institution and, for the user's own screens, the last four digits. A link is never shown as verified unless it is. A user sees their own instruments and failure messages; analytics are aggregates. How someone might get around verification is out of scope; you record what happened.

**Assumptions.** All volumes and rules are hypothetical. Providers answer through an API and, for some outcomes, a later callback; answers can arrive after your timeout. Card network updates, where available, arrive as a daily file. The payment service reports declines with a reason code.

**Clarifications.**
- Q: Can the same card be linked to two accounts? | A: Under this exercise's rule it can, subject to the given risk score. Say how you recognise it is the same card without seeing the number.
- Q: What happens to a pay-later plan or a default funding source when a card is replaced? | A: If the network sends an update, the replacement takes over; otherwise the user is asked. Decide what is shown meanwhile.
- Q: Are provider failure codes consistent? | A: No. Each provider has its own codes and they change.
- Q: How quickly do teams need linking health? | A: Within five minutes for steering users to another method; daily for product analysis.
- Q: What if a provider answers after the user gave up? | A: It happens. The late answer must be recorded and must not leave the instrument in a contradictory state.

**Hints.**
1. Model each instrument as a state machine whose transitions are events with the provider's raw answer, your normalised reason, and the attempt id; the current state is a projection.
2. Keep two layers of failure reason: the provider's raw code, versioned, and your stable taxonomy (user abandoned, credentials rejected, provider unavailable, institution unavailable, verification mismatch, declined, timed out). Map with a table that can change without losing history.
3. Measure linking health as a rate per (institution, method, provider) over a short window with a minimum count, so a small bank with three attempts does not trip it.

**Follow-ups.**
1. Walk through a bank link by test deposits that the user confirms on day four. Which records exist, and in which states, along the way?
2. A provider answers "verified" two minutes after your timeout marked the attempt failed and the user started a second attempt. What is the final state, and what does the user see?
3. A large issuer replaces several hundred thousand cards over a week. How do plans, defaults and scheduled payments follow the replacements?
4. How do you decide that a method is failing for one institution and steer users to another, without flapping or hiding a method for everyone?
5. The share of failures reported as "other" doubles after an app release. How would your design have prevented that from going unnoticed?

**Follow-up rules.**
- when: card number, account number, pan → ask: Where exactly in your pipeline could a full number appear, and what proves it never does?
- when: fingerprint, hash, token → ask: Two users link the same card. What does your identifier let analytics see, and what must it never let anyone reconstruct?
- when: timeout, time out → ask: The answer arrives after the timeout. Which state wins, and how do you avoid telling the user two different things?
- when: circuit breaker, failover, fallback provider → ask: You switch an institution's links to a second provider. How do you know the second provider is actually better for that institution and not just less observed?
- when: funnel, conversion → ask: The rate of successful links rises after you steer users away from instant checks. Is linking better, or did you just move failures into test deposits that are never confirmed?

**Production Reality Check.**
- One of the {{providers}} verification providers degrades for a large bank. Instant checks for that bank fail for 45% of attempts instead of 8%, users retry repeatedly, and each retry leaves another pending instrument behind.
- A large card issuer replaces several hundred thousand cards after a security event. Network updates arrive over a week, and in the meantime scheduled payments and pay-later instalments fail with "expired card".
- An app release introduces new provider error codes that the mapping table does not know. They are all counted as "other", which grows to 40% of failures, and the linking-health signal goes quiet.
- Test-deposit links that users never confirm pile up; after {{confirm_days}} days the expiry job removes them, but the users' screens still show them as "pending".

**Evaluation Criteria.** Instruments as state machines driven by events (attempt id, provider raw answer, normalised reason) with the current state as a projection; vault tokens and a keyed fingerprint instead of numbers, with analytics on types, institutions and reasons only; timeouts and late provider answers reconciled deterministically, with retries that reuse the pending attempt rather than creating new instruments; test-deposit waits with expiry after {{confirm_days}} days reflected on every screen; card replacements applied from network updates to plans, defaults and scheduled payments, with the user asked when no update arrives; a two-layer failure taxonomy with versioned mappings and an alert on unmapped codes; linking health per (institution, method, provider) with minimum counts and hysteresis to steer users without flapping; the given risk score used without describing how verification could be avoided; adapts to each incident with diagnosis, recovery and prevention.

## PYP-L4-05: Consumer rewards and cash back — earning rules, pending until the return window passes, redemption, expiry and a balance users can trust

| | |
|---|---|
| **Template ID** | PYP-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Rewards accounting / earn lots with states, return windows, clawback, expiry in local time |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "members": {"2": ["10 million", "25 million"], "3": ["50 million", "90 million"]},
  "return_days": [30, 60, 90],
  "expiry_months": [12, 24, 36],
  "offers": ["500", "5,000", "20,000"]
}
```

**Business Scenario.** A wallet runs a rewards programme for about {{members}} members. Members earn cash back on eligible purchases paid with the wallet: a base rate by purchase category plus about {{offers}} time-limited merchant offers active at once (this exercise's rules; check current docs). Rewards are held in integer minor units of the member's currency. Under this exercise's rules, a reward stays pending until {{return_days}} days after the purchase, because a return or refund in that time reduces or cancels it; then it becomes available. Available rewards can be redeemed to the wallet balance or at checkout, and each reward expires {{expiry_months}} months after it became available, at the end of that day in the member's time zone. Redemptions use the rewards that expire soonest first. A refund after a reward is available claws it back from the available balance; under this exercise's rule the balance never goes below zero, and any remainder is offset against future rewards. Members see pending, available, soon-to-expire and history in the app, and finance needs the outstanding rewards liability every day.

**Problem Statement.** Design the rewards system: how purchases and refunds arrive and which rule versions apply; how a reward is computed and rounded; the record of each reward and its states (pending, available, redeemed in part or whole, expired, clawed back); redemption and expiry; the balance and history the member sees; reconciliation with purchases, refunds and redemptions; the daily liability for finance; and how a wrong rule is corrected after the fact.

**Constraints.** Every reward amount is an integer in minor units, computed by one stated rounding rule at one step. The member's available balance, history and statement always agree, and every change to a balance is traceable to a purchase, refund, redemption, expiry or correction. A member sees only their own rewards; analytics and finance use aggregates. Purchases and refunds can arrive days late.

**Assumptions.** All volumes, rates and periods are hypothetical. Purchase and refund events come from the payments platform with a purchase id, amount in minor units, currency, merchant category and time; refunds reference the purchase. Merchant offers are configured by a given offers tool with start and end times and a funding share paid by the merchant.

**Clarifications.**
- Q: How is a partial refund handled? | A: The reward is reduced in proportion to the refunded amount, rounded by your stated rule; say which way and why.
- Q: Do base rate and offer stack? | A: Under this exercise's rule, yes, up to a cap per purchase; the cap is part of the rule version.
- Q: Which time zone governs expiry? | A: The member's at the moment of expiry; record it with the expiry.
- Q: Can a rule change apply to past purchases? | A: Only as a correction of an error, never silently, and the member sees a dated correction entry.
- Q: Is the rewards balance money the member owns? | A: Treat it as a liability the programme owes until redeemed or expired; finance needs it exact.

**Hints.**
1. Make each reward a lot with its own amount, rule version, state and dates; the balance is a sum over lots, and every change is an entry against a lot.
2. Late refunds are normal. The refund's purchase id finds the lot wherever it is; what happens depends on the lot's state at that moment.
3. Expiry is a date in the member's zone; compute "expires today" from the zone, and make an available lot past its expiry count as expired on read, even if the job that marks it has not run.

**Follow-ups.**
1. Walk through one purchase with a base reward and an offer, a partial refund on day 20, and a redemption on day {{return_days}} plus one. Which entries exist at the end?
2. A merchant's refunds arrive 12 days late, after the rewards became available and some were redeemed. What happens to each member's balance?
3. How do you compute the daily liability for finance, and how do you prove it equals the sum of members' balances?
4. A rule error doubled cash back on one category for nine hours. How do you correct it, and what do members see?
5. How would you change the design to let members redeem at checkout with a sub-second answer that can never spend the same reward twice?

**Follow-up rules.**
- when: float, floating point, decimal → ask: A 3% reward on a purchase of 1,999 minor units. What is the amount, where is it rounded, and does the partial refund round the same way?
- when: balance column, update balance, counter → ask: The balance and the history disagree for one member. Which one is right, and how would you know?
- when: nightly job, cron, batch → ask: The job that moves pending rewards to available stops for two days. What do members see, and is anything lost?
- when: cache, caching, redis → ask: The cached balance shows a reward that a refund clawed back a minute ago, and the member redeems it. What happens?
- when: retroactive, recompute, restate → ask: You recompute every reward under the corrected rule. Which members see a change, and how is each change shown to them?

**Production Reality Check.**
- A large merchant's refund feed arrives 12 days late. The rewards on those purchases are already available, and some members have redeemed them; about 8,000 members would go below zero without this exercise's offset rule.
- The expiry job runs at midnight UTC for everyone. Members in the Americas see rewards expire on the evening before the date shown in the app.
- An offer configured with the wrong rate doubles cash back on one category for nine hours, creating about 400,000 rewards that are still pending within the {{return_days}}-day window.
- After a cache was added in front of the balance, 0.3% of members see an available balance that differs from their history and statement.

**Evaluation Criteria.** Rewards as lots with rule versions and states, and every change as an entry referencing a purchase, refund, redemption, expiry or correction, so balance, history and statement are projections of one record; integer minor units with one rounding rule (including partial refunds); late refunds handled by state (reduce pending, claw back available with this exercise's offset rule); expiry after {{expiry_months}} months in the member's time zone and enforced on read; redemption soonest-expiring first with a conditional, idempotent spend that cannot use a reward twice; daily liability computed from the same entries and reconciled with members' balances and with purchases and refunds; corrections as dated, visible entries under a new rule version; caches that cannot serve a balance the record contradicts at redemption; aggregates only outside a member's own view; adapts to each incident with diagnosis, recovery and prevention.
