# Apple · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of a company that
makes phones, watches and computers and runs an app store, subscriptions, cloud
sync and a music service. Every workload, number and schema is hypothetical.
Privacy techniques such as on-device processing and local differential privacy
are described as general techniques; nothing here describes how any company
implements them, what it collects, or what any device records.

## APL-L4-01: Local differential privacy telemetry with per-day contribution limits

| | |
|---|---|
| **Template ID** | APL-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Privacy-preserving aggregation / local differential privacy, privacy budgets, release rules |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer, software-engineer |

```params
{
  "devices": {"2": ["50 million", "150 million"], "3": ["400 million", "900 million"]},
  "epsilon": [1, 2, 4],
  "reports_per_day": [1, 2, 3],
  "domain_size": ["2,000", "50,000", "1 million"]
}
```

**Business Scenario.** A device maker wants to learn which of {{domain_size}} possible values are most common across its devices each day (for example, which built-in features or settings were used) without learning any one device's value. About {{devices}} devices whose owners opted in to sharing usage statistics take part. The technique chosen is local differential privacy: each device randomises its own answer before it leaves the device, so any single report is deniable, and the server can only estimate population totals. In this exercise each report is randomised with a privacy parameter ε = {{epsilon}}, and a device may send at most {{reports_per_day}} reports per day across all use cases.

**Problem Statement.** Design the system end to end: what runs on the device (choosing what to report, randomising it, enforcing the per-day limit, queuing and uploading), the ingestion path, how the server turns noisy reports into estimates, and the rules for what may be released to product teams and in what form. Say how a new use case is approved and given part of the daily limit, and how you would show, after the fact, that no device exceeded it.

**Constraints.** No report may carry a device identifier, account identifier or anything that links two reports from the same device. The per-day limit must hold even if the device is offline for a week, its clock is changed, or an upload is retried. Daily estimates are published by 09:00 UTC for the previous UTC day. Raw reports are kept for at most 30 days; estimates may be kept longer.

**Assumptions.** All volumes, parameters and the use case are hypothetical, and the design describes a general technique, not how any company implements it. Devices are online at least once a day on most days. A report is a few hundred bytes.

**Clarifications.**
- Q: Which randomisation mechanism must I use? | A: Your choice; say how its estimate is debiased and how its error grows with the size of the value domain.
- Q: Can the server know which country or device model a report came from? | A: Only if the device includes it, and every attribute you add makes reports easier to link. Decide and justify.
- Q: Is the limit per use case or per device? | A: Per device per day, across every use case. Use cases share it.
- Q: Who consumes the estimates? | A: Product teams, through dashboards and tables. They will ask for finer slices than you want to give.
- Q: Can a device skip a day? | A: Yes. Skipping is always allowed; exceeding the limit never is.

**Hints.**
1. Write down the estimator first: given n reports and your mechanism's probabilities, how do you turn an observed count into an unbiased estimate, and what is its standard error?
2. The device is the only place the limit can be enforced, because the server cannot link reports. Think about what the device must remember and what it must never regenerate.
3. A large value domain makes plain randomised response useless; consider hashing into a sketch so the error depends on the sketch width rather than on {{domain_size}}.

**Follow-ups.**
1. Walk through one report from the moment the value is chosen to the moment it contributes to a published estimate. What is stored where, and for how long?
2. What is the smallest true count your system can distinguish from zero at your chosen ε and n, and how does that shape what you release?
3. An upload fails three times. What does the device send on the fourth attempt, and why does that matter for privacy?
4. A product team wants yesterday's top values per device model and per locale. What do you give them, and what do you refuse?
5. How do you discover frequently used values that are not in the dictionary of {{domain_size}} known values, without breaking the daily limit?

**Follow-up rules.**
- when: device id, user id, identifier, deduplicate → ask: Which field lets you deduplicate retries, and what stops that same field from linking two reports from one device?
- when: randomized response, randomised response, flip, coin → ask: With {{domain_size}} possible values, what is the probability a device reports its true value at ε = {{epsilon}}, and what does that do to your estimate's error?
- when: sketch, hash, count-mean, hadamard → ask: Two popular values collide in the same hash cells. How does that show up in the estimates, and how do you reduce it?
- when: threshold, minimum count, suppress → ask: How do you choose the threshold from n and ε, and what do you show a product team for a value below it?
- when: retry, resend, queue → ask: Does a retried upload carry the same randomised value or a new one? Show me what an observer could learn from each choice.

**Production Reality Check.**
- A client release regenerates a fresh randomised report on every upload retry instead of resending the stored one. On flaky networks some devices send the same day's value five times with independent noise, which is far beyond {{reports_per_day}} reports per day.
- A product team's dashboard slices yesterday's estimates by device model and locale. One combination has about 3,000 reporting devices; the published table shows negative counts and a "top value" that is not plausible.
- The load balancer in front of the ingestion endpoint, run by another team, has been writing the source network address of every report to its access logs for six weeks.

**Evaluation Criteria.** On-device randomisation with a named mechanism, an explicit debiasing estimator and its error; a large-domain strategy (hashing into a sketch); the per-day limit enforced on the device with a persisted ledger that survives clock changes and offline periods, and randomised values stored and resent rather than regenerated; ingestion that strips network and transport metadata and keeps no linkable identifier; release rules (minimum population, error-based thresholds, confidence intervals, coarse slices only) and a governance process for new use cases sharing the budget; ways to verify the limit held; adapts to each incident with containment, purge and prevention.

## APL-L4-02: Royalty-ready play counts with late offline plays and restatements

| | |
|---|---|
| **Template ID** | APL-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Usage reporting / qualifying plays, late data, monthly statements, bitemporal restatement |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "plays_per_day": {"2": ["300 million", "800 million"], "3": ["2 billion", "4 billion"]},
  "territories": [60, 110, 160],
  "qualify_seconds": [30, 60],
  "offline_days": [30, 45],
  "close_days": [10, 15]
}
```

**Business Scenario.** A music streaming service records about {{plays_per_day}} plays a day across {{territories}} territories. Rights holders are paid from monthly usage statements: for each territory and recording, the number of qualifying plays in the calendar month. In this exercise's rules a play qualifies when at least {{qualify_seconds}} seconds of it were heard, the listener's subscription was valid at the time, and the play is attributed to the territory of the listener's account storefront at the time of the play. Listeners download music and play it offline; offline plays are logged on the device and accepted if they reach the service within {{offline_days}} days. Statements for a month are due {{close_days}} days after it ends.

**Problem Statement.** Design the pipeline from the play event on a device to the monthly statements: event capture and upload, deduplication, the qualifying-play rule, territory attribution, the monthly aggregation per territory and recording, and what happens to plays that arrive, or are found to be invalid, after a statement has been sent. Be precise about what a statement is (a frozen, versioned artefact) and how later changes reach rights holders.

**Constraints.** A statement, once sent, is never edited; later changes appear as adjustment lines on a later statement that name the period they correct. Every number on a statement must be traceable to the plays behind it. Devices retry uploads, so the same play can arrive several times. A listener's storefront can change mid-month.

**Assumptions.** All volumes, rules and deadlines are hypothetical and belong to this exercise; check current docs for any real service's rules. Each recording has a stable identifier and the catalogue maps it to rights holders per territory. The device clock is usually right but not always.

**Clarifications.**
- Q: Does a seek or pause end a play? | A: In this exercise a play is one playback of one track; seeks and pauses inside it do not start a new play. Repeating the track does.
- Q: Which date does a play belong to? | A: The month of the play in UTC, by the time the device says it started, validated against when it reached you.
- Q: What if the subscription lapsed while the device was offline? | A: Plays after the lapse do not qualify, even if they arrive later.
- Q: Do rights holders see individual plays? | A: No. They see counts per territory and recording; they can ask for an audit of how a number was produced.
- Q: Can a play be removed after it was reported? | A: Yes, for example when listening is later found to be automated. That is an adjustment.

**Hints.**
1. Keep two times on every play: when it happened and when you learned of it. A statement is a query "as known at" its close time.
2. Give each play an identifier made on the device when playback starts; retries reuse it.
3. Adjustments are a difference between what is known now about a past month and what was reported for it. Compute them, do not type them.

**Follow-ups.**
1. Walk through one offline play that reaches you 20 days after month end. Where does it land, and how does it appear to the rights holder?
2. How do you prove that a statement's total for one recording and territory equals the qualifying plays behind it, months later?
3. A listener changes storefront on the 14th. Which territory gets their plays, and what data do you need to decide?
4. Fraud review removes three months of plays from a set of accounts. Walk through the adjustment lines that result.
5. Monthly volume is growing 40% a year. Which part of your pipeline stops scaling first, and what do you change?

**Follow-up rules.**
- when: overwrite, update in place, upsert → ask: A statement for last month was built from the rows you just overwrote. How do you reproduce exactly what was sent?
- when: event time, play time, device time → ask: A device's clock is two months behind. Its plays arrive today stamped in an old month. What do you do with them?
- when: kafka, stream, streaming → ask: Statements are monthly. What does streaming buy you here, and what still has to be batch?
- when: dedup, deduplicate, idempotent, idempotency → ask: An app version sends each offline play twice on reconnect with two different play ids. Does your deduplication catch it? How would you find out?
- when: snapshot, freeze, frozen, version → ask: How long do you keep each frozen statement's inputs, and what does that cost at {{plays_per_day}} plays a day?

**Production Reality Check.**
- An app version sends each offline play twice when it reconnects, once from its play log and once from a retry path, with two different play ids. It has been live for three weeks, across a month boundary, and last month's statements are already out.
- Two days before statements are due ({{close_days}} days after month end), a rights holder's own figures show 12% more plays than yours for one album in one territory.
- Fraud review flags 40,000 accounts whose plays over the last three months came from automated listening. All three months have been reported.

**Evaluation Criteria.** Device-generated play ids with idempotent ingestion; event time and arrival time on every play, with clock validation; qualifying rules applied with the subscription and storefront that were valid at play time (effective-dated dimensions); statements as frozen, versioned, as-of queries; adjustments computed as differences between current knowledge and what was reported, never edits; traceability from statement line to plays; partitioning and incremental aggregation that scale with volume; a reconciliation process with rights holders by reason; adapts to each incident with diagnosis, correction through adjustments and prevention.

## APL-L4-03: Service analytics for end-to-end encrypted sync

| | |
|---|---|
| **Template ID** | APL-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Privacy by design / end-to-end encryption, metadata minimisation, client-side telemetry |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, data-engineer |

```params
{
  "accounts": {"2": ["80 million", "200 million"], "3": ["500 million", "900 million"]},
  "devices_per_account": [2, 3, 5],
  "data_kind": ["notes and their attachments", "documents and folders", "browser bookmarks and open tabs"],
  "log_days": [7, 30]
}
```

**Business Scenario.** A cloud sync service keeps users' {{data_kind}} in step across their devices: {{accounts}} accounts with about {{devices_per_account}} devices each. For accounts that turn on end-to-end encryption, records are encrypted on the device with keys the service never holds; the server stores and forwards ciphertext. The service team still has to run the service: know whether sync is fast and reliable, plan storage, find the client release that broke something, and answer product questions. Service logs are kept for {{log_days}} days.

**Problem Statement.** Design the analytics and observability for this service. Say what the server can observe without the keys (and what it should not keep even though it can), what clients may report about themselves and under what consent, how the metrics the team needs are computed (sync latency, conflict and failure rates, storage growth, active devices), how a broken client release is detected when the server cannot read what it stored, and which product questions the design refuses to answer, with what you offer instead.

**Constraints.** No content, record names, file names or anything derived from them may reach the server in readable form. Metadata the server must have (record sizes, timestamps, device and account identifiers) is minimised and kept no longer than needed. Client telemetry is opt-in and contains no content. Support staff must never be able to see a user's data.

**Assumptions.** All volumes, retention periods and the data kind are hypothetical; the design describes general techniques, not how any company builds its service. Clients run a recent release within about two weeks of it shipping.

**Clarifications.**
- Q: Does the server see record sizes? | A: It stores ciphertext, so it knows its length unless you pad. Decide whether that matters.
- Q: Can clients send crash and error reports? | A: Only from users who opted in to sharing diagnostics, and only with the fields you specify.
- Q: Do we keep old versions of records? | A: For a short time, as ciphertext, so a bad write can be rolled back by the user's own devices.
- Q: Can the server deduplicate identical attachments across users? | A: Only if it can tell they are identical. Think about what that reveals.

**Hints.**
1. List what the server sees on every request (who, when, how big, which device, which client version, the outcome) and separate what you need from what you merely could keep.
2. The only component that knows whether a record decrypted correctly is another client. Failure signals have to come from there.
3. For a product question about content, the answer is either "we do not ask it" or "the device computes an aggregate and reports it under a privacy mechanism".

**Follow-ups.**
1. Define "sync latency" precisely using only what the server and an opted-in client can observe.
2. A client release writes records that other devices cannot decrypt. How do you find out within an hour, and how do users get their data back?
3. Which metadata would you pad, coarsen or drop, and what does each choice cost in storage or debuggability?
4. Product wants to know how many users use a new formatting feature inside their {{data_kind}}. What do you build, or what do you say?
5. A regulator asks what the service knows about one account. What can you list, and from where?

**Follow-up rules.**
- when: log, logging, logs → ask: Which fields of a sync request end up in your logs, and what stops a client from putting a record name in one of them?
- when: telemetry, diagnostics, client report → ask: Only opted-in clients report. How do you know the opted-in population is representative of the release you are judging?
- when: dedup, deduplicate, convergent → ask: If identical attachments produce identical ciphertext, what can the server learn about two accounts?
- when: support team, support staff, troubleshoot, debug → ask: A user says half their {{data_kind}} vanished from one device. What can support see, and what do they ask the user to do?
- when: differential privacy, aggregate, on-device → ask: Which question would you answer that way, with what minimum population, and who decides the parameters?

**Production Reality Check.**
- A client release starts uploading records that the user's other devices cannot decrypt. The server sees ordinary writes and a normal error rate; support tickets say {{data_kind}} are "missing" on second devices.
- A debug field added to sync requests has carried record names in plain text for five days, and the service has been writing it to logs kept for {{log_days}} days.
- Storage grows 30% faster than forecast for a month. Nobody can read the content, so nobody can say what is growing.

**Evaluation Criteria.** A clear inventory of server-observable metadata with a minimisation plan (allowlisted log fields, coarsened timestamps, padding where exact sizes would reveal content, short retention); service metrics computed from request metadata; opt-in client telemetry with fixed, content-free schemas for decrypt failures, conflicts and latency per client version; staged client rollout and recoverable ciphertext versions; refusal of content questions or on-device aggregation under a privacy mechanism with thresholds; awareness that convergent encryption and metadata reveal information; support flows that never expose data; adapts to each incident with containment, purge and prevention.

## APL-L4-04: Equalised storefront pricing and what a customer paid when

| | |
|---|---|
| **Template ID** | APL-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Effective-dated pricing / currencies, taxes, scheduled changes, auditability |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, data-engineer |

```params
{
  "storefronts": {"2": [60, 100], "3": [150, 175]},
  "currencies": [30, 45],
  "products": ["2 million", "8 million", "20 million"],
  "purchases_per_second": {"2": ["2,000", "5,000"], "3": ["15,000", "40,000"]}
}
```

**Business Scenario.** An app marketplace sells {{products}} paid apps, in-app purchases and subscriptions in {{storefronts}} storefronts and {{currencies}} currencies. In this exercise's rules (check current docs for any real store), a developer picks a price point in one base storefront and the system generates equalised prices for every other storefront from exchange rates and local taxes; the developer may override any storefront, schedule a price change to start on a future date, and, for subscriptions, existing subscribers keep their price until a change is applied to them. Exchange rates and tax rates change, and equalised prices are regenerated when they do. Purchases peak at {{purchases_per_second}} per second.

**Problem Statement.** Design the pricing system: the model for price points, base prices, generated and overridden prices, and schedules; how regenerated prices flow out when rates or taxes change; the read path that gives a product page and checkout the price in force; and the record that answers, years later, exactly what a customer paid, in which currency, with which tax, and why that was the price.

**Constraints.** The product page and checkout must agree: a customer is never charged a price other than the one shown. Checkout price lookup p99 under 30 ms. A scheduled change takes effect at a precise instant that you must define. Developers' proceeds reports must be reproducible for any past period. Price history is kept for at least seven years.

**Assumptions.** All counts, rates, rules and latency targets are hypothetical and belong to this exercise. Exchange rates come from an outside provider once a day. Tax rules per storefront are maintained by a separate team that publishes changes with an effective date.

**Clarifications.**
- Q: When does a scheduled change start: UTC midnight or each storefront's local midnight? | A: You decide and say how a developer and a customer would understand it.
- Q: Do currencies all have two decimal places? | A: No. Some have none, a few have three.
- Q: Are prices shown tax-inclusive? | A: In most storefronts in this exercise, yes; in a few, tax is added at checkout.
- Q: Can a customer see one price on the page and pay another? | A: Only if the price changed between the two; say what you do in that window.
- Q: How often do rates move enough to matter? | A: Usually a few storefronts a month; occasionally a currency moves sharply in a day.

**Hints.**
1. Model prices as effective-dated rows with both a valid-from instant and the time the row was recorded; "the price on a date" and "what we believed on a date" are different questions.
2. Store money in minor units with the currency's own exponent, and test the zero-decimal currencies.
3. Give the checkout a price quote with an identifier and an expiry, and charge the quote, not a fresh lookup.

**Follow-ups.**
1. A developer schedules a price increase for the first of next month. Walk through what is stored, when each storefront switches, and what a customer mid-checkout at that instant pays.
2. An exchange-rate update would move prices in 40 storefronts. What checks run before any new price goes live?
3. How do you answer "what did this customer pay for this subscription in March three years ago, and why that price"?
4. A tax rate rises in one storefront from a date next week. What changes: prices, proceeds, or both, and who chooses?
5. How do you serve checkout lookups at {{purchases_per_second}} purchases per second while price regeneration rewrites millions of rows?

**Follow-up rules.**
- when: float, double, decimal → ask: Show me how a price in a zero-decimal currency is stored and converted, and where a factor of 100 could slip in.
- when: cache, cdn, redis → ask: A scheduled change goes live at midnight while product pages still serve the cached old price. What does a customer who buys at 00:01 pay?
- when: utc, local time, time zone, timezone → ask: For a storefront eight hours ahead of UTC, at what local time does your change take effect, and is that what the developer expected?
- when: overwrite, update in place → ask: An auditor asks for the price in force last June in one storefront. Where does that answer come from once rows have been updated?
- when: quote, price lock, lock the price → ask: How long is the quote valid, and what happens when a scheduled change lands inside it?

**Production Reality Check.**
- A scheduled price increase for a popular subscription takes effect at 00:00 UTC on the first of the month. In storefronts ahead of UTC the old price stayed on sale until the morning of the 1st local time, and the developer asks why; in storefronts behind UTC customers were charged the new price on what was still their 31st, and they complain.
- A regeneration after an exchange-rate update produced prices one hundred times too low in one zero-decimal currency. Purchases ran at the wrong price for three hours before anyone noticed.
- One storefront announces a tax rate change effective in nine days. Prices for {{products}} products there must be regenerated or developers' proceeds will fall, and last quarter's reports must still show the old rate.

**Evaluation Criteria.** A bitemporal, effective-dated model for base prices, generated prices, overrides and schedules; money in minor units with per-currency exponents; a defined effective instant per storefront that developers and customers can understand; regeneration as a staged, reviewed batch with guardrails on the size of change and a publish switch; a fast read path (precomputed price per product and storefront, versioned) with price quotes so the page and checkout agree; immutable purchase records that carry price, currency, tax, price row version and quote id; reproducible proceeds; adapts to each incident with containment, a customer-fair remedy and prevention.

## APL-L4-05: Daily health totals from overlapping watch and phone samples, shared only with consent

| | |
|---|---|
| **Template ID** | APL-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Sensitive data / interval merging across sources, local-day totals, consent-scoped sharing |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, data-engineer |

```params
{
  "users": {"2": ["20 million", "60 million"], "3": ["150 million", "300 million"]},
  "sources": [2, 3, 4],
  "metric": ["steps", "active energy burned", "distance walked or run"],
  "share_types": [5, 12, 30]
}
```

**Business Scenario.** A health data feature collects {{metric}} and other measures for {{users}} users from about {{sources}} sources each: a watch, a phone, and connected apps or devices the user allowed to write data. In this exercise each source writes samples of the form (start, end, value, unit, source), and sources overlap: a user carrying a phone while wearing a watch has two sources measuring the same minutes. Users see daily totals per measure. They can share any of {{share_types}} data types with a family member or an app, and stop sharing at any time.

**Problem Statement.** Design how samples are stored and synced across a user's devices, how overlapping samples from several sources become one daily total without double counting, how a "day" is defined for a user who travels, and how sharing works: what a grant contains, what a recipient can read, what happens to history and to copies when a grant is revoked. Say where each computation runs (on the device or on a server) and why.

**Constraints.** Health data is among the most sensitive data a person has: it is never used for any purpose the user has not turned on, and it is encrypted in transit and at rest. A total shown on two of the user's devices must agree after they sync. A user can delete any sample or source, and deleted data must disappear from totals and from what recipients see. Samples can arrive days late from a device that was off.

**Assumptions.** All volumes and counts are hypothetical. This exercise's merge rule: the user orders their sources by priority, and for any interval the highest-priority source that has data for it is used. Nothing here describes what any real device measures or how any company's health features work.

**Clarifications.**
- Q: A watch sample covers 10:00–10:10 and a phone sample 10:05–10:20. How do I split them? | A: Assume a sample's value is spread evenly over its interval, and say what that assumption costs.
- Q: Which time zone defines a day? | A: The user's local time where the sample was recorded; you need to keep that offset with the sample.
- Q: Does a recipient see raw samples or daily totals? | A: The grant says, per data type.
- Q: When access is revoked, must the recipient's existing copy disappear? | A: Say what you can guarantee and what you cannot, and how you would tell the user.
- Q: Can a new source be added mid-day? | A: Yes, and it may write samples for the past.

**Hints.**
1. Merging by priority is an interval sweep: cut the day into pieces at every sample boundary and take, for each piece, the highest-priority source that covers it.
2. Totals are derived data. Store samples as the truth and make totals recomputable for any day touched by a late sample, an edit or a priority change.
3. A grant is a row with a recipient, data types, a start of visibility and a revocation time; enforce it where data is read, and think about keys if the server cannot read the data.

**Follow-ups.**
1. Walk through merging one hour with a watch, a phone and a connected app all reporting {{metric}}, including a partial overlap.
2. A user flies across eight time zones. Which day does each sample belong to, and what does the user see for the travel days?
3. The user reorders source priority. What is recomputed, where, and how fast do totals on all devices agree?
4. Where would you compute totals: on each device, on a server, or both? What does each choice mean for privacy and consistency?
5. A user grants a family member access to {{metric}} from today, then revokes it a month later. What can the family member still see, and what did you promise the user?

**Follow-up rules.**
- when: sum, add up, total everything → ask: The watch and phone both reported 10:00 to 10:30. What does a plain sum show, and what should it show?
- when: utc, timestamp, time zone, timezone → ask: A sample runs from 23:50 to 00:20 local time on a day the user crossed a time zone. Which day gets which part?
- when: server, cloud, backend → ask: Which of your server components can read health values, and why does that one need to?
- when: revoke, revocation, delete → ask: The recipient's device was offline when access was revoked. What happens when it comes back online?
- when: dedup, deduplicate, duplicate → ask: A connected app copies the watch's own samples into the store under its own name. How does your merge treat those copies?

**Production Reality Check.**
- A newly connected app writes {{metric}} samples copied from the watch's data under its own source name. For two days, totals for its users are about double.
- Users who flew across eight time zones see two days with odd totals: one about 30% too high, the next nearly empty.
- A user stops sharing {{metric}} with a family member; three days later the family member's phone, which had been offline, still shows the user's last week of data.

**Evaluation Criteria.** Samples as the encrypted source of truth with sync and late arrival; an interval-sweep merge by user-ordered source priority with even-spread proration and recomputation of affected days; local days from the offset stored with each sample, splitting samples that cross midnight; a reasoned choice of on-device versus server computation that minimises who can read values; grants with explicit scope, history visibility and revocation, enforced at read and at sync, with honest limits on recipient copies; deletion that propagates to totals and recipients; new sources added at the lowest priority by default; adapts to each incident with diagnosis, correction and prevention.
