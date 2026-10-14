# LinkedIn · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of a professional
network: member profiles and skills, connections, jobs, recruiter search and
messaging, newsletters, learning and company pages. Every workload, number and
schema is hypothetical, and nothing here describes how any company's systems are
built. Member data is personal: designs stay within each member's visibility
settings, never infer protected traits, and show other people only aggregates
unless a member would see the record themselves. Ranking appears only as a
scoring function you are given.

## LNK-L4-01: Job search freshness: new postings searchable in minutes, closures gone, location, remote and salary filters

| | |
|---|---|
| **Template ID** | LNK-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Search indexing / incremental index updates, deletes, filters, freshness measurement |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, data-engineer |

```params
{
  "postings": {"2": ["3 million", "6 million"], "3": ["15 million", "30 million"]},
  "new_daily": {"2": ["150,000", "300,000"], "3": ["800,000", "1.5 million"]},
  "feeds": ["800", "5,000", "20,000"],
  "freshness": ["2 minutes", "5 minutes", "10 minutes"]
}
```

**Business Scenario.** A professional network's job search lets members search open postings by keywords, title, company, location (a city or region, with a distance radius), workplace type (on-site, hybrid or remote), seniority and pay, when the employer states a pay range. About {{postings}} postings are open at any time and about {{new_daily}} new ones are published each day. Postings come from a posting form that employers fill in and from {{feeds}} employer feeds that send either full files of their open jobs or changes since the last file. Employers edit postings, close them when the role is filled, and repost them. Results are ordered by a scoring function you are given, owned by another team; it scores a few thousand candidate postings per query, and you treat it as a black box.

**Problem Statement.** Design the path from a posting being published, edited or closed to what a member sees in search. Cover the source of truth for each posting, normalisation (locations to places with coordinates, pay to a comparable annual range, remote eligibility), duplicates of one job arriving from several sources, the index and how it is updated incrementally and rebuilt in full, how closures and edits reach every copy of the index, how the filters are evaluated, the "posted N days ago" label, and how you measure freshness end to end.

**Constraints.** A new posting must be searchable within {{freshness}} of being published (p95), and a closed posting must leave results within the same time. A member must never be able to submit an application to a closed posting, even from a stale results page. Search p99 under 300 ms including the scoring function. A full rebuild of the index takes several hours, so it cannot be the only way changes arrive. The index is served from several regions.

**Assumptions.** All volumes, timings and counts are hypothetical. The posting service is the transactional source of truth for each posting's content and status and emits a change event on every write. This exercise's rules for remote postings: each one names the countries where the employer can hire, and it is shown only to searches for those countries.

**Clarifications.**
- Q: Does a repost count as a new posting for the "posted" label? | A: Your call; members distrust old jobs presented as new, and employers want reposts to be seen. Say what the label shows and why.
- Q: How should a pay filter treat hourly pay or another currency? | A: Normalise to an annual range in the searcher's currency with a dated exchange rate and a stated hours-per-year assumption; say what the member is shown.
- Q: Do postings with no stated pay appear when a pay filter is set? | A: A product decision you should make explicitly; either way, say how the member can tell.
- Q: What does it mean when a full feed file no longer contains a posting? | A: Usually that the job closed, but feeds sometimes send partial files by mistake.
- Q: How many locations can one posting have? | A: Several office cities, plus remote eligibility in some countries.

**Hints.**
1. Keep the index a projection of the posting store: a change stream keyed by posting id, with a version number on every change, so an older update can never overwrite a newer one.
2. A full rebuild and the incremental stream must converge: build from a snapshot taken at a known stream position, then replay from that position before the new index takes traffic.
3. Closures are the change that hurts most when late. Treat them as first-class: a fast path, tombstones, and a final check against the source of truth at apply time.

**Follow-ups.**
1. Walk one posting from "publish" to its first appearance in results. Where is the time spent, and how do you measure each step for every posting, not just a sample?
2. One employer feed sends a file that is missing 40% of its usual postings. Do you close them? What rule decides?
3. A member searches for remote roles paying at least a stated amount. How is each filter evaluated, and which postings with no stated pay or multiple locations appear?
4. The nightly full rebuild runs while updates keep flowing. How do you swap indexes without losing or reordering an update made during the rebuild?
5. One region's index replica lags 20 minutes behind the others. What do members there see, how do you find out, and what do you do automatically?

**Follow-up rules.**
- when: nightly, rebuild, reindex, full rebuild → ask: A posting is published one minute after the rebuild's snapshot. Walk me through how it reaches the new index before that index takes traffic.
- when: cache, cached, caching → ask: An employer closes a posting at 10:00; a results page cached at 09:58 still lists it. Who sees it, until when, and what happens when they press apply?
- when: geocode, geocoding, radius, coordinates → ask: A posting names three office cities and remote eligibility in two countries. How many index entries is that, and how does a 50 km radius search treat it?
- when: dedup, deduplicate, duplicate → ask: The same job arrives from the employer's own feed and from a staffing agency's feed with a slightly different title. What is your key, and which copy do members see?
- when: kafka, stream, change data capture, cdc → ask: Two updates for one posting reach the indexer out of order. What stops the older one from winning?

**Production Reality Check.**
- One of the {{feeds}} employer feeds sends a partial file. The pipeline closes 120,000 of that employer's postings; members who saved them see "no longer accepting applications" and the employer's hiring team escalates within the hour.
- A large employer bulk-edits 300,000 postings at 09:00. The update stream backs up, indexing lag passes {{freshness}} for three hours, and closures queue behind the edits: members keep finding closed jobs and pressing apply.
- A pipeline change treats every edit as a new posting. Jobs open for months show "posted 1 hour ago", and members report the same roles reappearing as new every day.
- The exchange-rate table used for pay normalisation stops updating for nine days. Pay filters in one currency now exclude postings whose stated ranges overlap the member's filter.

**Evaluation Criteria.** Posting store as the source of truth with a versioned change stream; normalisation of places, pay and remote eligibility as explicit, versioned steps; duplicate detection with a stated key and canonical copy; incremental indexing with ordering by version, tombstones for closures and a fast path for them; rebuilds that converge with the stream before swap; apply-time checks against the source of truth; filter semantics (multiple locations, missing pay) chosen and visible to members; an honest "posted" label for reposts and edits; end-to-end freshness measured per posting and per region; guards on feed files that shrink suddenly; adapts to each incident with diagnosis, recovery and prevention.

## LNK-L4-02: Invitation abuse: invitation limits, mass-invite detection from aggregates, warnings and appeals

| | |
|---|---|
| **Template ID** | LNK-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Trust and safety / rate limits, aggregate abuse signals, enforcement ladders, appeals |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer |

```params
{
  "invites_daily": {"2": ["15 million", "40 million"], "3": ["120 million", "250 million"]},
  "weekly_limit": [100, 150, 250],
  "reviewers": [12, 40, 120],
  "new_accounts": ["50,000", "200,000", "600,000"]
}
```

**Business Scenario.** Members of a professional network send connection invitations, optionally with a short note. A recipient can accept, ignore, or say they do not know the sender, and can report the invitation; a sender can withdraw a pending one. About {{invites_daily}} invitations are sent each day and about {{new_accounts}} accounts are created each day. Some senders abuse invitations: fake accounts that harvest connections to reach members' networks, mass outreach that recipients find unwelcome, and harassment of one member through repeated invitations. Most heavy senders are legitimate: recruiters, people who just met many others at an event, new members building their network. Under this exercise's rule every member has a weekly invitation limit of {{weekly_limit}}, which may be lowered for an account that shows abuse.

**Problem Statement.** Design the invitation limits and the abuse detection behind them. Cover how the limit is enforced on the send path, which aggregate signals describe a sender's behaviour, how they are computed and how fresh they are, how a score or rule set turns them into actions (a warning, a lower limit, a temporary restriction, a review), what the member is told, how appeals work with {{reviewers}} reviewers, how you protect a single recipient from repeated invitations, and how you measure false positives.

**Constraints.** Detection uses counts and outcomes of invitations (sent, accepted, ignored, marked "don't know", reported, withdrawn), account signals such as age and verification, and security signals such as many accounts created from one network; it never reads private messages, and it never uses or infers protected traits. A send decision adds at most 20 ms. Every enforcement action must be explainable to the member in plain terms and reversible on appeal. The weekly limit must hold even when a sender uses several devices at once.

**Assumptions.** All volumes, limits and staffing are hypothetical, and the weekly limit is this exercise's rule (check current product documentation for real limits). The scoring of abuse is yours to design; nothing here describes any company's real detection.

**Clarifications.**
- Q: Is the weekly limit a calendar week or rolling? | A: Your choice; say what the member sees when they reach it and when it resets.
- Q: An ignored invitation never gets an answer. When does it count against the sender? | A: Invitations can stay pending for weeks. Decide how a signal treats pending ones and say why.
- Q: Can a restriction be automatic? | A: Warnings and lower limits can be. A restriction that blocks invitations needs either a high-confidence rule or a review, and always an appeal.
- Q: Are some members expected to send many invitations? | A: Yes; recruiters and event attendees, for example. You may not assume a heavy sender is abusive.
- Q: Can you use the invitation note? | A: Only to match it against a list of known malicious links, under this exercise's policy.

**Hints.**
1. Separate the exact, cheap check on the send path (a per-sender counter) from the slower, richer scoring that runs on aggregates over hours and days.
2. A ratio from few invitations is noise. Smooth outcome rates toward a population prior and weigh them by how many invitations have actually been answered.
3. Abuse that stays under every per-account limit shows up only across accounts. Think about which shared signals group accounts without exposing anyone's data.

**Follow-ups.**
1. Walk through the send path: where is the weekly counter, how is it kept exact across devices, and what happens when its store is unavailable?
2. Which three aggregate signals carry the most weight, and how is each defined (window, denominator, treatment of pending invitations)?
3. A ring of new accounts each sends just under the weekly limit. How do you find it, and what do you do to accounts you are less sure about?
4. How do you measure the false-positive rate of your actions when most restricted members never appeal?
5. One member receives invitations from 30 newly created accounts in a day. What protects them, and how quickly?

**Follow-up rules.**
- when: acceptance rate, accept rate → ask: A new member sends 40 invitations; 3 are accepted after a day and the rest are pending. What is their acceptance rate in your design, and why?
- when: redis, counter, in-memory → ask: The counter shard for some members is lost for two hours. Do those members get unlimited invitations, none, or something else?
- when: machine learning, classifier, model → ask: Where do your training labels come from, and how do you stop the model learning that recruiters are abusive?
- when: ban, block, suspend, restrict → ask: What exactly does the member see, how do they appeal, and how long until a person looks at it?
- when: ip address, device, fingerprint → ask: A whole university shares one network address. How does your cross-account signal avoid flagging every student on it?

**Production Reality Check.**
- After a large careers fair, 8,000 new graduates each send dozens of invitations to people they just met. Recipients are slow to respond, outcome rates look poor, the detector restricts all 8,000 in one day, and the appeals overwhelm the {{reviewers}} reviewers.
- A ring of 30,000 accounts created over two weeks, a small share of the {{new_accounts}} created each day, each sends just under {{weekly_limit}} invitations a week. No per-account limit ever trips, and members' complaints about unknown senders double.
- A shard of the store holding weekly counters fails over to a replica that is two hours behind. For those senders the counter reads low, and some send several times the limit before it catches up.
- A change to the "don't know" button doubles how often recipients press it. Every sender's score drifts upward overnight and warnings rise tenfold, with no change in sender behaviour.

**Evaluation Criteria.** Exact per-sender limits on the send path with a stated failure mode; aggregate signals with defined windows, denominators and handling of pending invitations, smoothed for low counts; cross-account detection with care for shared networks; an enforcement ladder from warning to review with plain explanations and appeals; protection for a targeted recipient; no private-message content and no protected traits; false positives measured through appeals and sampled review; monitoring for shifts caused by product changes rather than behaviour; adapts to each incident with diagnosis, recovery and prevention.

## LNK-L4-03: Newsletter issues and notification delivery: digests, unsubscribes honoured everywhere, delivery and open metrics

| | |
|---|---|
| **Template ID** | LNK-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Messaging infrastructure / fan-out, preferences, deduplication, delivery metrics |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, data-engineer, analytics-engineer |

```params
{
  "largest": {"2": ["1 million", "3 million"], "3": ["15 million", "40 million"]},
  "issues_daily": ["20,000", "120,000", "400,000"],
  "channels": ["in-app notifications and email", "in-app notifications, mobile push and email"],
  "daily_cap": [3, 5, 8]
}
```

**Business Scenario.** Members and company pages on a professional network publish newsletters; other members subscribe. About {{issues_daily}} issues are published a day, and the largest newsletter has {{largest}} subscribers. When an issue is published, subscribers are told through {{channels}}. Members can choose a daily or weekly digest instead of one message per issue, and they can unsubscribe from a newsletter from the issue page, from their settings on any device, or with an unsubscribe link in the email. Authors see delivery and engagement figures for each issue. A member receives at most {{daily_cap}} newsletter notifications a day under this exercise's rule; the rest wait for the next digest.

**Problem Statement.** Design the delivery system and its metrics. Cover the subscription and preference store, fan-out of one issue to every subscriber, digests, the per-member daily cap, quiet hours in the member's time zone, deduplication across channels (a member who already read the issue in the app), retries without duplicates, unsubscribes that take effect on every channel at once, and the delivery and engagement figures authors see: what is measured, what is an estimate, and what is never shown to them.

**Constraints.** An unsubscribe must stop every channel before the next send to that member, whichever channel it came from. An issue edit or correction must not reach a member before the issue it corrects. Email providers throttle senders that send too fast or draw complaints. Authors see aggregates only: they never see which member opened, clicked or unsubscribed. The largest newsletter's issue should reach all its subscribers within two hours of publishing.

**Assumptions.** All volumes, caps and timings are hypothetical, and the daily cap is this exercise's rule. Email open tracking with a remote image is a widely used and widely known to be imprecise technique: some mail clients load images automatically and some block them.

**Clarifications.**
- Q: Does the in-app notification count toward the daily cap? | A: Yes, every notification about a newsletter counts; the issue itself stays readable in the app.
- Q: What is a "delivery" for email? | A: Accepted by the receiving mail server. Whether it reached the inbox is not known.
- Q: Should a member who reads the issue in the app still get the email? | A: Your call; say how you know they read it and how late that knowledge can arrive.
- Q: Can authors see their subscriber list? | A: Not in this exercise; they see counts and aggregates.
- Q: How quickly must an unsubscribe in one channel reach the others? | A: Before the next send to that member on any channel.

**Hints.**
1. Fan-out is a batch per issue, partitioned by subscriber, with every send keyed by (issue, member, channel) so a retry finds the earlier attempt.
2. Read the preference and subscription state at send time, not at fan-out time; a fan-out for a large newsletter takes long enough for members to change their minds.
3. Separate the figures you observe (sends, provider acceptances, bounces, clicks through your own links) from those you estimate (opens), and label them that way for authors.

**Follow-ups.**
1. Walk through one issue of the {{largest}}-subscriber newsletter from publish to the last member: partitions, rate limits, and how you know it finished.
2. A member unsubscribes using the email link while the fan-out for the next issue is half done. Which channels can still reach them, and how do you close that gap?
3. How do digests interact with the daily cap of {{daily_cap}}, quiet hours and a member who switches from per-issue to weekly mid-week?
4. Define "open rate" for authors. What is in the numerator and denominator, and what changes when mail clients load images automatically?
5. How would you show authors an engagement breakdown (for example by subscribers' industry) without letting them single out a member?

**Follow-up rules.**
- when: queue, kafka, fan-out, fanout → ask: The largest newsletter and a thousand small ones publish in the same minute. How do you stop the large fan-out from delaying all the small ones?
- when: retry, retries, at least once → ask: The email provider times out after accepting a message. Your retry sends it again. How does your key stop a duplicate in the member's inbox?
- when: open rate, pixel, opens → ask: Opens jump 25 points overnight for every newsletter. What changed, and what do you tell authors?
- when: preference, preferences, settings → ask: The preference store is read at fan-out time. A member unsubscribes after their send was queued. Do they get the issue?
- when: timezone, time zone, quiet hours → ask: A member travels and their device reports a new time zone; their settings say another. Which one sets quiet hours?

**Production Reality Check.**
- A member unsubscribes with the email link. The unsubscribe updates email preferences only; the next issue still notifies them in the app, and they report the newsletter as spam.
- The {{largest}}-subscriber newsletter publishes an issue and a correction 30 minutes later. The fan-out for the original takes six hours; members late in the fan-out receive the correction first.
- A widely used mail client starts loading images automatically. Reported open rates rise by 25 points overnight for every newsletter, and authors start changing what they write in response.
- A retry bug resends the same issue email three times to 400,000 members. Complaint rates rise, and an email provider throttles all of the network's mail, including password resets.

**Evaluation Criteria.** One subscription and preference store read at send time; fan-out partitioned by subscriber, isolated by newsletter size, with idempotent sends keyed by issue, member and channel; unsubscribe that takes effect across channels before the next send; ordering so corrections follow the issue they correct; digests, caps and quiet hours with stated precedence; cross-channel deduplication with its latency; separate streams and limits for critical mail; metrics that separate observed from estimated, with opens labelled as estimates; aggregate-only author figures with minimum group sizes; adapts to each incident with diagnosis, recovery and prevention.

## LNK-L4-04: Hiring analytics for employers: postings to hires across sources, promoted-job spend, candidate privacy kept

| | |
|---|---|
| **Template ID** | LNK-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Multi-tenant analytics / attribution across sources, late outcomes, spend, aggregate privacy |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "employers": {"2": ["40,000", "120,000"], "3": ["500,000", "1.2 million"]},
  "ats_lag": ["2 weeks", "6 weeks", "3 months"],
  "min_group": [5, 10, 20],
  "sources": [5, 7, 9]
}
```

**Business Scenario.** About {{employers}} employers post jobs on a professional network. Candidates reach a posting through {{sources}} sources: search, saved-search alerts, a promoted placement the employer paid for, the employer's company page, a shared link, an outside job board, and others. Some apply on the network; others are sent to the employer's own careers site. Employers who connect their applicant tracking system send status updates for applicants (screened, interviewed, offered, hired, rejected, withdrawn), typically up to {{ats_lag}} after the application. Promoted postings are charged under this exercise's pricing per click on the posting, against a daily budget. Employers want a dashboard and an export: from postings to views, applications and hires, by source and over time, with what they spent and what it bought, and how they compare with similar employers.

**Problem Statement.** Design the hiring analytics platform. Cover the events and their keys, joining views, applications and tracking-system updates into one applicant journey, how a hire is credited to sources when a candidate came through several, spend and cost per application and per hire, how figures change when outcomes arrive {{ats_lag}} later and how that is shown, peer benchmarks, and the privacy rules: what an employer may see about its own applicants, what it may see only as aggregates of at least {{min_group}} people, and what it may never see.

**Constraints.** Each employer sees only its own data; a benchmark against similar employers may use only aggregates across at least ten employers. Breakdowns of applicants or viewers by attributes such as region, seniority or skills are shown only for groups of at least {{min_group}} people, and never by protected traits. Members who viewed but did not apply are never identified to the employer. Charges for promoted postings must reconcile exactly with invoices. A member who deletes their account must disappear from every breakdown within this exercise's deadline of 30 days.

**Assumptions.** All volumes, prices, lags and thresholds are hypothetical, and the pricing model is this exercise's rule. Tracking-system updates arrive through an integration that maps each system's statuses to the platform's statuses.

**Clarifications.**
- Q: A candidate saw the posting through a promoted placement, then applied a week later from an alert. Which source gets the hire? | A: That is your attribution rule to define. Employers want one number per source, and they want to know how it was computed.
- Q: Are hires only known from the tracking system? | A: Yes. Employers without an integration see applications but no hires.
- Q: Are clicks from automated traffic charged? | A: Clicks later found to be invalid are credited back, sometimes after the invoice.
- Q: Can an employer see its applicants individually? | A: Yes, the ones who applied to it, in its own applicant view. The analytics breakdowns are aggregates.
- Q: How are "similar employers" chosen? | A: By industry, size band and region; you decide the rule and the minimum.

**Hints.**
1. Model the applicant journey as facts keyed by (posting, member) with touches by source, and outcomes as a slowly arriving, restatable status history.
2. Attribution is a rule over touches before the application; write it down, version it, and let the dashboard name it.
3. Minimum group sizes protect one report; two overlapping reports can still be subtracted. Think about every way an employer can slice the same population.

**Follow-ups.**
1. Walk through one hire: which events, with which keys, joined how, and when the hire first appears on the dashboard.
2. A hire is reported {{ats_lag}} after the application, after last quarter's report was exported. Does last quarter's cost per hire change? How do employers see that?
3. Invalid clicks are credited back after an invoice. How do spend, the invoice and cost per application stay consistent?
4. An employer filters a breakdown to one region and then to one region and one seniority. How do you prevent the difference between two allowed reports from revealing a group smaller than {{min_group}}?
5. How do you build the peer benchmark so no single employer's figures can be worked out from it?

**Follow-up rules.**
- when: last touch, last click, first touch → ask: A candidate clicked a promoted placement, then applied from a free alert. Under your rule, what did the promoted spend buy, and is the employer misled?
- when: snapshot, restate, restatement → ask: An employer's finance team exported last quarter's numbers. A month later hires are added. What do they see, and can they reproduce the export?
- when: k-anonymity, minimum, threshold, suppress → ask: Two reports each pass your minimum but differ by three people. What stops an employer subtracting one from the other?
- when: warehouse, star schema, fact table → ask: What is the grain of your main fact table, and how does a tracking-system status change, arriving weeks later, land in it?
- when: delete, deletion, erasure → ask: A member deletes their account. Which tables and aggregates change, and what happens to a benchmark already computed?

**Production Reality Check.**
- After an upgrade of one tracking system, its integration maps "rejected" to "hired". Hires triple for 400 postings across 30 employers, cost per hire on promoted postings falls to a third, and two employers raise their promoted budgets on the strength of it.
- An employer exports applicants by region and by region and seniority on the same day. Subtracting one from the other leaves a group of two people in a small office, below the {{min_group}} minimum, and a hiring manager recognises who they are.
- Invalid-click detection credits back 8% of one month's promoted clicks after invoices were sent. The dashboard's spend now disagrees with the invoices, and cost per application differs between the export and the dashboard.
- An outside job board's referral parameter is dropped by a redirect change; applications from it are recorded as "direct", and that source's share of hires falls to near zero over {{ats_lag}}.

**Evaluation Criteria.** Journey facts keyed by posting and member with source touches; outcomes as a restatable status history with explicit as-of reporting; a written, versioned attribution rule shown to employers; spend reconciled with invoices including later credits; status mapping per tracking system validated against expected distributions; tenant isolation; aggregate breakdowns with minimum group sizes that also hold under differencing (fixed dimensions, suppression of complementary cells, or noise), and benchmarks with minimum employer counts; deletion propagated through aggregates; no identification of viewers and no protected traits; adapts to each incident with diagnosis, recovery and prevention.

## LNK-L4-05: An evolving skills taxonomy: free-text skills mapped to standard skills, splits and merges, comparable trend reports

| | |
|---|---|
| **Template ID** | LNK-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Reference data / versioned taxonomies, entity mapping, crosswalks, consistent time series |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ml-platform-engineer |

```params
{
  "standard_skills": ["30,000", "45,000", "60,000"],
  "variants": {"2": ["2 million", "5 million"], "3": ["15 million", "40 million"]},
  "release": ["monthly", "quarterly"],
  "languages": [8, 20, 35]
}
```

**Business Scenario.** Members of a professional network add skills to their profiles as free text in {{languages}} languages; job postings list required skills; learning courses are tagged with the skills they teach. A taxonomy of about {{standard_skills}} standard skills gives them a common vocabulary, and about {{variants}} distinct free-text strings are mapped to it. The taxonomy is released {{release}}: new skills are added, a broad skill is split into narrower ones, near-duplicates are merged, and some skills are retired. Job matching, course tagging and published trend reports ("fastest-growing skills in a region", "skills most requested in postings") all depend on it.

**Problem Statement.** Design the taxonomy and mapping platform. Cover how the taxonomy and its releases are stored, how free-text strings are mapped to standard skills (and who or what decides), what a split, a merge and a retirement do to existing mappings, how consumers (matching, course tagging, reports) pin or follow releases, and how trend reports stay comparable across releases. Say what a member sees on their own profile when the mapping behind their skill changes.

**Constraints.** A member's profile shows what the member entered; a remapping must never change their profile text or add a skill they did not choose. A member who removes a skill must stop being matched on it within a day. Published trend reports are aggregates over at least 100 members per cell and never broken down by protected traits. A trend over 24 months must not show a jump caused only by a taxonomy release.

**Assumptions.** All counts and cadences are hypothetical. The mapping of free text can combine exact dictionaries, a model you are given, and human curation; how a model scores candidates is not part of this exercise.

**Clarifications.**
- Q: When a skill is split, which child does a member's existing skill map to? | A: Often you cannot tell from the text alone; say what you do when the evidence is not there.
- Q: Do job postings and member profiles use the same release? | A: They should when matched; today some consumers lag a release behind.
- Q: Are trend reports ever restated? | A: Your decision; readers compare this month with last year's report.
- Q: Who curates the taxonomy? | A: A small team of editors approves changes; mappings for the long tail of strings are automatic.
- Q: Can a mapping be wrong? | A: Yes; ambiguous strings and abbreviations are common, and the same string can mean different skills in different languages or occupations.

**Hints.**
1. Give every standard skill a stable id that is never reused, and store releases as data: each release is a set of skills plus explicit change records (added, split into, merged into, retired).
2. A crosswalk between releases (old id → new ids with weights or rules) lets any count be expressed in any release; trend reports pick one release and restate history in it.
3. Keep the member's text, the mapping, and the mapping's release and confidence as separate fields, so a remap never touches what the member wrote.

**Follow-ups.**
1. Walk through a split of one broad skill into three narrower ones: what changes in the taxonomy, in member mappings, in postings and in last year's trend figures?
2. Two consumers are pinned to different releases and a merge happens. How does matching between a posting and a member still work during the transition?
3. How do you decide that a new free-text string deserves its own standard skill rather than a mapping to an existing one, and how fast can that reach reports?
4. How would you show that this month's "fastest-growing skills" report reflects members' behaviour and not your release?
5. A mapping is found to have been wrong for a year. What do you correct, what do you restate, and what do you tell report readers?

**Follow-up rules.**
- when: rename, renamed, update in place, overwrite → ask: You update a skill's row in place when it is merged. What do last year's reports and a consumer pinned to the old release see now?
- when: embedding, model, classifier, similarity → ask: The model maps "PM" to project management for members who meant product management. How do you find that, and who fixes it?
- when: version, release, crosswalk → ask: A skill split into three in the last release. In your crosswalk, how is one member's old skill counted under the new release?
- when: restate, backfill, recompute → ask: Restating 24 months of reports under each release costs how much, and how often? What do you precompute?
- when: trend, growth, fastest-growing → ask: A skill's count rises 40% in a month. Name two causes that are not member behaviour, and how your report rules each out.

**Production Reality Check.**
- A {{release}} release splits a popular skill into three. The next trend report shows the parent skill falling 70% and all three children among the fastest-growing skills in every region.
- A mapping update sends a common abbreviation to the wrong standard skill across {{languages}} languages; for six weeks, about 2 million members are matched to postings for a different occupation and recruiters see them in the wrong searches.
- Course tagging is pinned one release behind job postings. After a merge, recommendations of courses for the merged skill drop to zero for members who list it.
- Members who remove a skill keep receiving job matches for it for nine days, because the matching index reads a nightly snapshot of mappings that is only rebuilt when a release ships.

**Evaluation Criteria.** Stable, never-reused skill ids; releases as data with explicit change records; crosswalks that let counts move between releases; trend reports computed in one stated release with history restated, and release effects separated from behaviour; member text, mapping, release and confidence kept separately so remaps never change profiles; split handling that admits ambiguity (keep the parent, ask, or weight by evidence); consumers pinned to releases with a migration window; mapping quality monitored with curated samples per language; removals propagated to matching within the deadline; aggregate reports with minimum cells and no protected traits; adapts to each incident with diagnosis, recovery and prevention.
