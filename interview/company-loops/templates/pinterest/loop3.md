# Pinterest · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of a visual discovery
platform: pins, boards and sections, saves, idea pins, visual search, shopping and
product pins, creators, ads and conversion measurement, home feed and search. Every
workload, number, schema and incident is hypothetical. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## PIN-L3-01: Pins, saves and boards as data — original pins, saves to boards and sections, and credit to the original creator

| | |
|---|---|
| **Template ID** | PIN-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / save lineage, root-pin credit, board visibility history, deletions |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "daily_saves": {"1": ["40 million"], "2": ["250 million", "500 million"], "3": ["1.2 billion", "2.5 billion"]},
  "secret_share": ["6%", "15%"],
  "group_share": ["2%", "5%"],
  "deletion_days": [14, 30]
}
```

**Business Scenario.** A creator publishes an original pin: an image or video with a title, a description and usually a link to a web page. Pinners save pins to their own boards, optionally into a section of a board, and the saved copy can itself be saved by someone else from that board, so a popular pin spreads through long chains of saves. A saver can edit the description on their copy, move it to another board or section, or delete it. Boards are public or secret (about {{secret_share}} of saves land on secret boards here), and about {{group_share}} of saves go to group boards that several collaborators save to. In this exercise's rule, every save of a copy anywhere in a chain counts as a save of the original pin and is credited to its creator, saves to secret boards are left out of public counts and of creator analytics, and a deleted pin or board must disappear from analytics within {{deletion_days}} days. About {{daily_saves}} saves happen a day.

**Problem Statement.** Design the data model, from the transactional entities to the analytical facts. Cover: pins (original versus saved copy) and how each copy points back to the original it descends from; boards, sections, collaborators and board visibility with its history; saves as events versus the current contents of a board; moves between boards and sections; edits to a copy's description; deletions of a copy, a board, or the original itself. Then define the facts and their grains that answer "saves of a creator's original pins per day", "where saves came from (which surface or board the pinner saved from)", and "the public save count shown on a pin", and write one definition of a "save" that the creator dashboard and the public count can share, with the secret-board rule applied.

**Constraints.** Credit always reaches the original pin and its creator in one step, however long the chain. A save on a secret board never appears in a public count, a public board listing or a creator's analytics, including after the board's visibility changes. Re-saving a copy you already saved to the same board is not a new save. History is kept: a creator's daily saves for a past day change only through deletion (documented) or a stated restatement. Deletions reach analytics within {{deletion_days}} days.

**Assumptions.** Volumes, shares and the deletion window are hypothetical. Every pin has exactly one original, which may be itself. A copy's link and image are those of its original; only the title and description can be edited. Collaborators of a group board can save to it and remove what they saved; the owner can remove anything.

**Clarifications.**
- Q: Does saving a copy credit the pinner whose board it came from? | A: Not in this exercise. The creator of the original is credited; the intermediate saver can see, in aggregate, that pins were saved from their board.
- Q: Does a move between boards count as a new save? | A: No. A move changes where a saved copy lives; the save happened once.
- Q: A board changes from secret to public. Do its earlier saves start counting? | A: That is your decision; state it. The constraint is that a save made while the board was secret never appears anywhere public.
- Q: What happens to copies when the original pin is deleted? | A: In this exercise the copies stay on pinners' boards, but the original's creator analytics stop including them once the deletion has been applied.
- Q: Can one pinner save the same original to several boards? | A: Yes. Each is a save; say whether a "unique savers" measure also exists and how it is computed.

**Hints.**
1. Store the original on every copy (a root pin id) as well as the copy it was saved from (a parent). Credit reads the root; provenance reads the parent.
2. Keep saves as append-only events and board contents as current state derived from them; visibility belongs to the board and needs its own history.
3. Decide which board visibility a save is judged by: the board's visibility at the moment of the save, or now. Write it down before designing the fact.

**Follow-ups.**
1. Draw the rows for: a creator's original A; pinner P saves A to board B1; pinner Q saves P's copy to B2 (secret); Q later moves it to B3 (public). What does each fact show?
2. A chain is a million copies deep for a viral pin. How does your model avoid walking the chain to find the creator, and what guards against a copy whose root is wrong?
3. The original pin is deleted. Which rows change, within {{deletion_days}} days, and how do the creator's past daily totals change?
4. A group board's owner removes a collaborator and everything they saved. What happens to save counts and to the collaborator's own history?
5. Define the public save count precisely (which events add, which subtract, what secret boards do) and show that the creator dashboard can be derived from the same events at about {{daily_saves}} saves a day.

**Follow-up rules.**
- when: parent_pin_id, parent pin, saved_from → ask: To credit the creator you need the original. Do you walk parent links at query time, and what does that cost on a chain of thousands of saves?
- when: save_count, counter, increment → ask: A save is made on a secret board, then the board turns public. Does your counter change, and how do you rebuild it if it drifts?
- when: secret → ask: Which visibility decides whether a save counts: the board's visibility when the save happened, or today's? Show what happens to a save made while the board was secret.
- when: soft delete, deleted_at, is_deleted → ask: The original is deleted. Which tables keep rows, which facts drop them within {{deletion_days}} days, and what can still be seen by whom?
- when: unique savers, distinct savers, count distinct → ask: Unique savers across days do not add up. Which grain stores them, and what does the creator see for a week?

**Production Reality Check.**
- A board with thousands of pins switched from secret to public, and the next morning its owner's earlier secret saves showed up in several creators' weekly save totals: the job joined saves to the board's current visibility.
- A group board's owner removed a collaborator and everything they had saved (group boards take about {{group_share}} of saves here). A backfill that found the original by walking parent links stopped at the deleted copies, and for a day the saves made from them were credited to the removed collaborator instead of the original creators.
- A bulk import re-saved the same pins to the same boards after a client retry, and save counts for affected pins doubled within a day at {{daily_saves}} saves a day.

**Evaluation Criteria.** Root and parent kept on every copy, with credit by root; saves as append-only events and board contents as derived state; board visibility with history and a stated rule for which visibility judges a save; moves and description edits that are not new saves; idempotent saves per pinner, board and original; deletion of a copy, board or original propagated within the window with a documented effect on past totals; facts at stated grains (save events, creator × original × day, public count) built from one save definition; each incident contained, corrected and guarded.

## PIN-L3-02: Idea pins as data — pages, media, tags, edits after publishing and engagement per page

| | |
|---|---|
| **Template ID** | PIN-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / versioned multi-part content, stable page identity, per-page engagement |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "max_pages": [5, 10, 20],
  "daily_published": {"1": ["150,000"], "2": ["1 million", "3 million"], "3": ["8 million", "15 million"]},
  "edited_share": ["8%", "20%", "35%"],
  "video_share": ["40%", "70%"]
}
```

**Business Scenario.** Creators publish idea pins: a pin made of up to {{max_pages}} pages, each page an image or a short video (about {{video_share}} of pages are video here) with optional text overlays. A creator adds topic tags, can tag other creators and products on a page, and can list ingredients or materials on the pin. After publishing, a creator can edit: change text, replace a page's media, add, remove or reorder pages, or change the tags; about {{edited_share}} of idea pins are edited at least once. About {{daily_published}} idea pins are published a day. Creators want, for their own pins, views per page and where viewers stop going forward, saves and outbound clicks per pin, and how each edit changed those numbers.

**Problem Statement.** Design the data model for idea pins and their engagement. Cover: the pin, its versions (what was live when), pages with an identity that survives reordering, media assets and their processing states (a video page is shown only when its media is ready), tags at pin and page level, and how an edit creates a new version without losing what was live before. Then define the engagement events and facts: page views by page and by page position, forward progression from page to page, saves and outbound clicks per pin, all tied to the version that was live when they happened. Say how "the last page reached" is defined for a viewer session and how the creator's report shows a pin whose pages were reordered.

**Constraints.** Every engagement event can be tied to the exact version and page that was shown. Reordering pages must not move a page's history to a different page. Media that failed processing is never shown, and a pin is never published with a page whose media is not ready. A creator sees their own pin's per-page numbers; viewers appear only in aggregate. Edits never rewrite what an earlier version was.

**Assumptions.** Volumes, page counts and shares are hypothetical. A viewer moves forward and back through pages; a page view is logged each time a page is shown for at least a threshold you define. Product tags reference catalogue products by id; topic tags come from a fixed list. Each version is immutable once published.

**Clarifications.**
- Q: If a page's media is replaced, is it the same page? | A: Your call, stated. Many teams keep the page id and record a new media asset in a new version; then per-page history spans both media.
- Q: Does a reorder create a new version? | A: Yes. Any published change creates a new version; drafts are not versions.
- Q: How are page views logged? | A: Clients send a page-view event with the pin id, the page id, the page's position and the version id; events can arrive late and out of order.
- Q: Can a creator delete a page? | A: Yes. The page is absent from new versions; its history stays with earlier versions.
- Q: What does "drop-off" mean? | A: Define it. For example: among sessions that viewed page k, the share that never viewed a later position.

**Hints.**
1. Separate the pin (stable id), its versions (immutable snapshots with a published_at), and pages (stable ids) joined to versions through a version-page table that carries the position.
2. Engagement events carry the version id and page id that the client actually rendered; never infer them later from the "current" version.
3. Report per page id and per position separately: a reorder changes which page sits at position 3, not the history of either page.

**Follow-ups.**
1. Show the rows for a pin with pages P1, P2, P3; the creator moves P3 to the front and replaces P2's video. What does version 2 look like, and what happens to P2's views?
2. A client that cached version 1 keeps sending events for an hour after version 2 is published. How does your model attribute them?
3. Define forward progression per page position for one version, and say what the creator sees when they compare version 1 with version 2.
4. A product tagged on page 4 is removed from the merchant's catalogue. What happens to the tag, to earlier versions, and to outbound clicks already counted?
5. At {{daily_published}} new pins a day with up to {{max_pages}} pages, which per-page event grain do you keep for how long, and what aggregate serves the creator report?

**Follow-up rules.**
- when: pages array, json array, array of pages → ask: Storing pages as an array inside the pin row is simple. How does a page's view history survive when the creator reorders that array?
- when: page_index, page_number, by position → ask: If position is the key for per-page metrics, what happens to page 2's history after page 4 is moved to the front?
- when: current version, latest version, overwrite → ask: An event arrives an hour late for a version that is no longer live. Which page did the viewer see, and how do you know?
- when: dropoff, drop-off, completion rate, completion → ask: A viewer swipes back from page 5 to page 2 and leaves. What is their last page reached, and what does your definition count?
- when: transcode, processing, media status → ask: A video page fails processing after the creator pressed publish. What does the version look like, and what do viewers see?

**Production Reality Check.**
- After a client release, page-view events carried the position but not the page id. For a week, pins whose pages had been reordered (about {{edited_share}} of idea pins are edited) showed one page's views under another page in creators' reports.
- A video processing backlog let a version go live with a page whose media was still processing. Viewers saw a blank page, and forward progression past that page collapsed for pins with {{video_share}} video pages.
- An edit job rewrote earlier versions in place to fix a typo in the tags, and the comparison between versions that creators rely on now shows identical versions.

**Evaluation Criteria.** Pin, immutable versions and stable page ids kept apart, with positions on a version-page table; media assets with processing states and a publish rule that requires ready media; tags at the right level and versioned; engagement events that carry version, page and position; per-page and per-position metrics defined, including forward progression and the last page reached; late events for old versions attributed correctly; creator-only access to per-page numbers; retention and aggregation sized for the volume; each incident contained, corrected and guarded.

## PIN-L3-03: Shopping as data — merchants, catalogues, products and variants, product pins, and price and availability over time

| | |
|---|---|
| **Template ID** | PIN-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / catalogue feeds, variant groups, price and availability history, product pin identity |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "merchants": ["40,000", "250,000"],
  "catalogue_items": {"1": ["150 million"], "2": ["800 million", "1.5 billion"], "3": ["3 billion", "6 billion"]},
  "feed_hours": [2, 6, 24],
  "currencies": [4, 12, 30]
}
```

**Business Scenario.** Merchants upload product catalogues as feeds: one row per item with the merchant's item id, an item group id that ties variants (sizes, colours) together, title, link, image, price, an optional sale price with its start and end, currency, and availability (in stock, out of stock, preorder). Each merchant's feed is fetched again every {{feed_hours}} hours; a new upload can change prices, add or drop items, or re-use an item id for a different product. There are {{merchants}} merchants, {{catalogue_items}} items in total, and prices in {{currencies}} currencies. Each item becomes a product pin that pinners can save; pins show the price and availability, and saved product pins power features such as price-drop notices. Merchants want, in aggregate, impressions, saves and outbound clicks per product and per item group.

**Problem Statement.** Design the data model: merchants and their catalogues, feed uploads and their processing outcome, products and variants (item groups), product pins and how a pin stays tied to the right product, and the history of price, sale price and availability. It must answer "what price and availability did this product pin show at a given time", "which items changed price in the last upload", "how long was this variant out of stock last month", and per-product engagement for the merchant. Say how a dropped item, a re-used item id and a bad upload (prices all zero, or half the catalogue missing) are handled.

**Constraints.** Money is stored as integers in minor units with the currency code; nothing is summed across currencies without an explicit conversion with a dated rate. Price shown on a date must be reconstructable. A bad upload must never wipe out a catalogue: an upload is applied only if it passes validation. A product pin never silently changes to a different product. Merchants see only their own catalogue's metrics; pinners appear only in aggregate.

**Assumptions.** Volumes, refresh cadence and currency counts are hypothetical. A sale price is valid only between its start and end times (this exercise's rule; check current docs for real feed specifications). Item ids are unique within a merchant, not across merchants. Feeds are full snapshots, not deltas.

**Clarifications.**
- Q: Is the price shown the sale price or the regular price? | A: The sale price while it is valid, otherwise the regular price, in this exercise. Store both.
- Q: An item disappears from a feed. Is it deleted? | A: Decide and state the rule. Common: mark it missing, hide its pin after a stated number of consecutive uploads without it, keep its history.
- Q: Can an item move between item groups? | A: Yes, merchants regroup variants. Pins and history stay with the item; the group is an attribute with history.
- Q: How do we detect a re-used item id? | A: You decide the signal, for example a different link and title with a matching id. Say what happens to the old pin.
- Q: Do we keep every upload? | A: You decide retention, but price history must be answerable for at least a year.

**Hints.**
1. Separate what the merchant sent (upload rows, immutable) from the product state you serve (current product rows) and from the history of the attributes that matter over time (price and availability intervals).
2. Most uploads change little. Store history as change intervals per item (valid_from, valid_to) produced by comparing an upload with the current state, not as a full copy per upload.
3. A product pin references a stable internal product key. Map (merchant, item id) to that key, and only re-point the mapping deliberately.

**Follow-ups.**
1. Show the history rows for one variant whose price drops, goes out of stock, gets a sale price for a weekend, then comes back in stock at full price.
2. A merchant's upload arrives with half the items missing. What does validation check, what happens to the catalogue, and what does the merchant see?
3. A merchant re-uses item id 12345 for a different product. How do you detect it, and what happens to the saved pins and engagement of the old product?
4. With feeds every {{feed_hours}} hours across {{catalogue_items}} items, how big is the daily change set, and how do you compute it without a full comparison of everything?
5. A merchant asks for outbound clicks per item group across {{currencies}} currencies and a regrouping last month. Which grouping and which conversion do you use, and how is that labelled?

**Follow-up rules.**
- when: scd type 2, scd2, type 2 → ask: Which attributes trigger a new version: price, availability, title, image? What happens to your row count when a merchant changes a title in every upload?
- when: overwrite, upsert, merge into → ask: A pinner asks why a product pin showed $40 yesterday and $55 today. With prices overwritten, how do you answer?
- when: float, decimal, double precision → ask: How do you store a price in a currency with no minor unit, and in one with three decimals? Where does rounding happen?
- when: delete, deleted, hard delete → ask: An item missing from one upload is back in the next. What happened to its pin and saves in the meantime?
- when: snapshot, full snapshot, daily snapshot → ask: Copying the full catalogue every {{feed_hours}} hours: what does that cost at {{catalogue_items}} items, and how do you answer "price on a date" from it?

**Production Reality Check.**
- A merchant's feed arrived with every price set to 0 after an export bug. The upload passed validation, product pins showed free items for one {{feed_hours}}-hour cycle, and price-drop notices fired for thousands of saved pins.
- A merchant re-used item ids after a site migration. Saved product pins began to show different products, and a pinner who saved a lamp was notified about a price drop on a sofa.
- An exchange-rate table was missing for one day, and a merchant report that summed outbound-click value across {{currencies}} currencies treated the missing rate as 1.

**Evaluation Criteria.** Upload rows kept immutable and separate from served product state and from attribute history; price, sale price and availability as validity intervals with the sale window honoured; integer minor units with currency, and dated conversion only in reports; item groups as attributes with history; a stable product key behind each pin and an explicit rule for dropped and re-used item ids; upload validation that blocks a bad feed and keeps the previous state; merchant-only access to metrics; a change-set estimate for the refresh cadence; each incident contained, corrected and guarded.

## PIN-L3-04: Claimed websites and attribution — creators claiming domains, pins credited by claim, claims lost and re-verified

| | |
|---|---|
| **Template ID** | PIN-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / verification lifecycle, claim intervals, URL normalisation, crediting events by time |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "claimed_domains": {"1": ["300,000"], "2": ["2 million"], "3": ["6 million", "12 million"]},
  "recheck_days": [1, 3, 7],
  "grace_hours": [24, 72],
  "linked_pins": ["800 million", "4 billion"]
}
```

**Business Scenario.** A creator can claim a website they own by proving control of the domain, for example by adding a meta tag to the site or a record to its DNS (this exercise's model of verification; check current docs for the methods offered). Once a claim is verified, pins that link to that site are credited to the creator: the creator's analytics include impressions, saves and outbound clicks on every pin linking to the site, including pins other pinners created from the site's pages, and those pins can show the creator's name. {{claimed_domains}} domains are claimed and about {{linked_pins}} pins link to a claimed domain. Verification is re-checked every {{recheck_days}} days; if a check fails, the claim stays in force for a grace period of {{grace_hours}} hours (this exercise's rule) and is then lost unless a later check passes. A domain can be claimed by only one account at a time, a creator can release a claim, and a domain can later be claimed by someone else.

**Problem Statement.** Design the data model for claims and for crediting. Cover: claim attempts and verification checks (method, result, time), the claim lifecycle (pending, verified, failing within grace, lost, released) kept as history, the intervals during which each account held each domain, how a pin's link is turned into the host that claims are matched against (case, a leading `www.`, redirects, link shorteners, tracking parameters), whether subdomains are covered, and the fact tables that credit each engagement event to the creator whose claim was in force when it happened. Say what happens to creator analytics when a claim is lost, regained, or moves to another account.

**Constraints.** Credit is decided by the claim in force at the time of each event, not at the time the pin was created and not by today's claim. Claim intervals of one domain never overlap. A creator's past numbers never move to another account when the domain changes hands. A creator sees analytics only for pins credited to them; pinners appear only in aggregate. Verification evidence (the check results) is kept for audit.

**Assumptions.** Volumes, the re-check interval and the grace period are hypothetical. Engagement events arrive at least once and can be hours late. A link's host can be read from the pin's URL; following redirects needs a fetch, which is done by a separate crawler that you may assume exists and records the final URL with a time.

**Clarifications.**
- Q: During the grace period, is the claim in force? | A: Yes. It ends when the grace period expires without a passing check, at that instant.
- Q: Does a re-verified claim restore credit for the time it was lost? | A: Not in this exercise. Events while no claim was in force are credited to nobody, and that is shown to the creator as a gap.
- Q: Are subdomains covered? | A: Decide and state the rule. A common choice: a claim covers subdomains unless a more specific claim on a subdomain is in force.
- Q: Can two accounts claim the same domain? | A: Not at the same time. A second account can claim it only after the first claim is released or lost.
- Q: Do pins created before the claim count? | A: Yes, from the moment the claim is in force. Credit is decided per event.

**Hints.**
1. Keep three things apart: verification checks (append-only evidence), the claim's state history, and the derived claim intervals (account, domain, valid_from, valid_to) that crediting reads.
2. Normalise each pin's link to a host once, store the result with the rule version that produced it, and re-derive when the rule changes.
3. Credit events with an as-of join of event time to claim intervals; store the credited account on the event fact so history never moves.

**Follow-ups.**
1. A domain's check fails at 10:00 on day 3; the creator fixes the tag and a re-check they request passes at 09:00 on day 5. With a {{grace_hours}}-hour grace period, was the claim ever lost? The creator then releases it and another account claims it a week later. Show the intervals.
2. A creator's numbers show a dip. How does your model let them see that the dip is a lost claim and not fewer saves?
3. An event arrives eight hours late, after the domain changed hands. Who is credited, and how does your pipeline make sure the late event is not credited by today's claim?
4. The host normalisation rule changes to strip a new tracking redirect. Which pins change hosts, which facts are recomputed, and how is the restatement shown?
5. At {{linked_pins}} linked pins and billions of events a week, how do you do the as-of join cheaply, and where is the credited account stored?

**Follow-up rules.**
- when: pin.creator_id, creator_id on the pin, at creation → ask: The pin was created before the domain was claimed, and the domain later changed hands. Which creator does a save made last week credit under your design?
- when: current claim, latest claim, current owner → ask: The domain moved to another account yesterday. What happens to the previous owner's numbers for last month if you join on the current claim?
- when: grace, grace period → ask: Where is the grace period applied: in the claim state history, in the intervals, or at query time? What does an analyst see if they apply it again?
- when: suffix, ends with, like '% → ask: A host `myexample.example` and a claim on `example.example`. Does your suffix test credit it? Write the condition that does not.
- when: crawler, redirect, short link, shortener → ask: The crawler re-fetches a short link and it now redirects to a different site. Which pin events move, and which stay?

**Production Reality Check.**
- A DNS provider outage made every check of a large hosting provider's sites fail for longer than the {{grace_hours}}-hour grace period. Thousands of claims were about to be lost at once; the team must decide whether to pause loss of claims or let them lapse.
- A daily job credited events by joining pins to the current claim table. When a popular domain changed hands, the previous owner's dashboard lost months of history overnight and the new owner gained it.
- A normalisation change stopped stripping `www.` for one week. Pins linking to `www.` hosts were credited to nobody, and about a fifth of credited outbound clicks disappeared for affected creators; checks run every {{recheck_days}} days did not notice because the claims were fine.

**Evaluation Criteria.** Verification checks, claim state history and derived claim intervals kept apart; the grace period applied once with a precise end; intervals of one domain that never overlap; link-to-host normalisation as a versioned rule, with redirects and shorteners handled through recorded crawler results; a stated subdomain rule with the most specific claim winning; credit by an as-of join on event time, stored on the fact so history never moves; late events credited by their event time; creator-only access; each incident contained, corrected and guarded.

## PIN-L3-05: Creator weekly metrics — impressions, saves and outbound clicks credited by the domain claim in force

| | |
|---|---|
| **Template ID** | PIN-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / as-of interval joins, half-open boundaries, host normalisation, most-specific match |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer |
| **Generator** | PIN-L3-05.mjs |

**Business Scenario.** Creators can claim a website domain so that pins linking to it are credited to them in their analytics (this exercise's rule; check current docs). `domain_claims` holds one row per period during which an account held a domain: it starts at `claimed_at` and ends at `released_at` (NULL while it is still held). A domain can be released and claimed again later, by the same creator after a lapse or by another creator, sometimes at the very same instant. Each pin may link to a web page; {{host_rule}} `pin_events` holds impressions, closeups, saves and outbound clicks on pins. The data covers {{weeks}} weeks starting Monday {{first_monday}}; pins and claims can be older.

**Problem Statement.** Write one PostgreSQL query that returns `creator_id, week_start, impressions, saves, outbound_clicks`: one row per creator and week with at least one credited impression, save or outbound click, ordered by `creator_id, week_start`. An event is credited to the creator whose claim on the pin's host is in force at the event's `occurred_at`: `claimed_at <= occurred_at` and (`released_at` IS NULL or `occurred_at < released_at`). {{match_rule}} Events on pins without a link, or whose host is covered by no claim in force at that moment, are credited to nobody. `week_start` is the date of the Monday that starts the event's week in UTC. Closeup events are not counted, and a creator with only closeups in a week has no row for it.

**Constraints.** One SQL statement (CTEs allowed). Claims of one domain never overlap in time. Count events: each `event_id` is one event. The sample has {{claims}} claims, {{pins}} pins and {{events}} events; production has billions of events a week, so say how the query would scale.

**Assumptions.** Hypothetical schema, creators, domains and events; domains use the reserved `.example` suffix. Timestamps are UTC. A pin's link never changes after it is created.

**Clarifications.**
- Q: A pin was created before its domain was claimed. Do its events count? | A: Its events from `claimed_at` on do. Credit is decided per event, by the event's time, never by when the pin was created.
- Q: The domain moved to another creator in the middle of a week. Who gets that week? | A: Both, each for their own events. An event exactly at the moment of the change belongs to the claim that starts then, not the one that ends.
- Q: Should I credit today's owner of the domain? | A: No. Today's owner gets only the events from their own claim periods.
- Q: Are saves counted per pinner? | A: No. Count events; the table has one row per event.
- Q: Does a week start on Sunday? | A: No. Weeks start on Monday 00:00 UTC.

**Hints.**
1. Join events to pins, then to `domain_claims` on the host and on the time condition with the event's `occurred_at`. Filter the event types before grouping.
2. If more than one claim can match an event, choose one claim per event (DISTINCT ON or ROW_NUMBER over the event id) before aggregating; a join that keeps both counts the event twice.
3. `COUNT(*) FILTER (WHERE event_type = 'save')` gives one count per type in a single pass, and `date_trunc('week', occurred_at)::date` gives the Monday.

**Follow-ups.**
1. Your query joins every event to every claim on its domain before the time filter. At billions of events a week, how do you make the as-of join cheap?
2. Store the credited creator on each event when it is ingested, or compute it at report time like this query? What happens to late events and to a domain that changes hands in each design?
3. A creator asks why their week dropped. Extend the query to report, per creator and week, the hours during which their domain had no claim in force.
4. Claims are re-checked every few days and a lost claim keeps a grace period. Where should the grace period be applied so that this query stays correct?

**Follow-up rules.**
- when: created_at, p.created_at → ask: Which time decides the claim: the pin's created_at or the event's occurred_at? What happens to a pin created a month before the domain was claimed?
- when: max(claimed_at), latest claim, current owner → ask: If each domain's events go to its latest claim, what happens to the previous owner's events from before the transfer?
- when: between, <= released_at, <= c.released_at → ask: An event happens exactly at the instant the domain moves to a new creator. With your boundary, how many creators are credited for it?
- when: left join → ask: Which rows does your outer join keep for events nobody is credited for, and do they reach the output?
- when: like '%, ends with, right( → ask: Does your suffix test credit a host like `myexample.example` to a claim on `example.example`? What stops it?

**Production Reality Check.**
- A domain changed hands on a Wednesday. A version of this report that credited every event to the domain's latest claim moved the previous owner's saves from the first half of that week to the new owner, and across the {{weeks}} weeks shown the previous owner's rows for that domain vanished.
- A client change began writing pin link hosts as typed, with capitals and `www.` prefixes. Outbound clicks for affected creators dropped without any change in traffic until hosts were normalised in the query and at ingestion.

**Evaluation Criteria.** Credit by the event's time with a half-open claim interval (inclusive start, exclusive end); event types filtered before grouping; Monday UTC weeks; no rows for uncredited events or zero counts; host normalisation from the Hard level; at the hardest level, subdomains covered with a dot-anchored suffix test and one claim per event, the most specific; deterministic ordering; can explain how to make the as-of join scale and where the credited creator should be stored.
