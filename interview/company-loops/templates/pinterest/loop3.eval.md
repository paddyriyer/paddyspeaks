# Pinterest · Loop 3 — evaluator notes (hidden from candidates)

## PIN-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Transactional entities.**
  - `pins (pin_id, root_pin_id, parent_pin_id NULL, owner_id, board_id NULL, section_id NULL, title, description, created_at, deleted_at NULL)`. An original has `root_pin_id = pin_id` and no parent. A copy stores both the root (copied from its parent's root when it is created, so credit is one lookup at any depth) and the parent it was saved from (provenance). Link and image live on the root; a copy carries only its editable text.
  - `pin_text_versions (pin_id, version, title, description, edited_at)` if edits must be auditable; otherwise the copy row holds the current text.
  - `boards (board_id, owner_id, kind personal|group, created_at, deleted_at NULL)`, `sections (section_id, board_id, name, deleted_at NULL)`, `board_collaborators (board_id, pinner_id, role, added_at, removed_at NULL)`.
  - `board_visibility_history (board_id, visibility public|secret, valid_from, valid_to NULL)`: one row per period, never overwritten.
- **Events (append-only, deduplicated).** `save_events (save_id, pinner_id, root_pin_id, new_pin_id, parent_pin_id, board_id, section_id, surface, saved_at, board_visibility_at_save)` with a uniqueness rule on (pinner_id, board_id, root_pin_id) for live copies so a retried or repeated save to the same board is not a new save; `pin_moves (pin_id, from_board, to_board, from_section, to_section, moved_at)`; `pin_deletions (pin_id, deleted_at, reason)`; `board_deletions`.
- **The visibility rule (one acceptable choice).** A save is judged by the board's visibility **at the moment of the save**, stamped on the event. A save made while the board was secret never counts, even after the board turns public; saves made after it turns public count from then on. Moving a copy from a secret board to a public board is not a save, so it does not start counting (state the choice; the alternative "counts from the move" is acceptable if written down and consistent).
- **Definition of a save (shared).** A save event of a live copy (not deleted, board not deleted, original not deleted as of the computation), on a board that was public at the time of the save. The public count of an original = number of such saves of copies with that root; the creator dashboard = the same events grouped by root and day.
- **Facts.**
  - `fct_save` (one row per save event, with root, creator of the root, saver, board visibility at save, surface, day). Deletions are applied by a deletion job that writes a `removed_at` and excludes the row from facts within {{deletion_days}} days.
  - `agg_creator_root_day (creator_id, root_pin_id, day, saves, saves_removed)`: rebuilt per day partition from `fct_save`; past days change only through deletions, recorded as a documented adjustment.
  - `pin_public_save_count (root_pin_id, count, as_of)`: derived from `fct_save` with a periodic exact recount; an incremental counter is allowed as a cache, never as the source.
  - Unique savers, if offered, are computed per stated window (a week, a month) from the events, or approximated with a sketch per day and merged; they never add up across days.
- **Access.** The creator sees aggregates for their own originals; an intermediate saver sees aggregates of saves made from their boards; no one sees who saved to a secret board.

**Competing designs to accept.** Only `parent_pin_id` plus a closure or materialised root column maintained by the save service (equivalent). A graph store for provenance with the root denormalised for analytics. Judging visibility by the current board state with a full recompute on every visibility change, if they show the cost and that secret-era saves still never appear (this usually requires the stamp anyway). A separate `saves` table keyed by (pinner, board, root) with the copy pin created lazily.

**Bottlenecks and failure modes.** Walking parent chains at query time (unbounded depth, broken by deleted intermediates); counters as the source of truth (drift, double counts on retries); joining saves to the board's current visibility (secret saves leaking after a flip); moves counted as saves; deleting rows outright so a creator's past totals change silently; at {{daily_saves}} saves a day, recounting the public count from scratch for every pin.

**Incident guidance.**
- *Secret saves appeared in creator totals after a board flip*: the job joined to current visibility. Contain by recomputing the affected days from events with the visibility stamped at save time (or from `board_visibility_history` as of `saved_at`); purge the leaked numbers from caches and exports; add a check that the count of saves with secret-at-save visibility in any public fact is 0.
- *Credit lost at a deleted intermediate copy*: the backfill walked parent links. Use the root stored on each copy (stamped at creation, never derived by walking), keep deleted copies as tombstones so lineage stays resolvable, recompute the day, and add a check that every save's root is an original (root_pin_id = pin_id on the root row).
- *Retry doubled save counts*: saves were not idempotent. Deduplicate by the uniqueness rule (pinner, board, root) and the client's request id, rebuild the affected counts from events, and add a monitor on saves per (pinner, board, root) > 1.

**Follow-up guidance.** (1) A is the original (its own root); P's copy root A, parent A, board B1 public: counts; Q's copy root A, parent P's copy, board B2 secret: excluded; the move to B3 is a `pin_moves` row and, under the stated rule, still excluded. The creator sees 1 save; P sees 1 save made from their board only if Q's save counts under the rule (it does not). (2) Root stamped at creation in O(1) from the parent; a consistency job verifies root rows are originals. (3) The deletion job marks the original's facts removed within {{deletion_days}} days; past daily totals drop with a documented deletion adjustment; copies remain on boards. (4) The collaborator's saves are deleted copies: they leave counts; the collaborator's own history of what they saved stays visible to them until they delete it, if the product says so. (5) One event stream, two aggregations; at {{daily_saves}} a day the public count is incremental with a periodic recount per root.

**Rubric anchors.** 2: one pins table with a repin counter and no root, visibility as a current flag, deletes as row deletes. 3: root and parent on copies, append-only save events, visibility history with a stated rule, moves not counted, a shared save definition, facts at stated grains. 4: also idempotency on (pinner, board, root), deletion propagation within the window with documented adjustments, intermediate-saver provenance, unique savers handled correctly, and incident guardrails.

**Strong signals.** States which visibility judges a save before drawing tables; separates credit (root) from provenance (parent). **Red flags.** Walking the chain for every report; secret saves "filtered later in the dashboard"; counters treated as truth.

## PIN-L3-02

**Reference architecture (one defensible design).**
- **Content.**
  - `idea_pins (pin_id, creator_id, created_at, deleted_at NULL)`.
  - `pin_versions (pin_id, version_no, published_at, superseded_at NULL, title, ingredients_or_materials JSON, change_summary)`: immutable once published; exactly one live version at a time (superseded_at of the previous = published_at of the next).
  - `pages (page_id, pin_id, created_in_version)`: a stable identity; a page keeps its id when its media or text changes.
  - `version_pages (pin_id, version_no, page_id, position, media_asset_id, overlay_text)`: the page's content and its position in that version. A reorder is a new version with new positions; page history follows page_id.
  - `media_assets (asset_id, kind image|video, status uploaded|processing|ready|failed, duration_ms NULL, created_at, ready_at NULL)`; a version can be published only if every `version_pages.media_asset_id` is `ready` (checked in the publish transaction).
  - `pin_tags (pin_id, version_no, tag_id)` for topic tags; `page_tags (pin_id, version_no, page_id, kind creator|product, target_id)` for creator and product tags.
- **Engagement events.** `idea_page_views (event_id, session_id, pin_id, version_no, page_id, position, viewed_at, visible_ms)`, `idea_pin_actions (event_id, session_id, pin_id, version_no, page_id NULL, action save|outbound_click|product_tag_click, at)`. The client sends what it rendered: version, page id and position. Events are deduplicated by event_id; late events keep their version.
- **Definitions.** Page view: a page shown for at least the stated threshold. Last page reached in a session: the highest position viewed (not the last one viewed in time, which can be lower after swiping back). Forward progression at position k for a version: sessions that viewed position k+1 ÷ sessions that viewed position k. Drop-off at k: 1 − that ratio.
- **Facts.**
  - `fct_page_day (pin_id, version_no, page_id, position, day, views, sessions)`.
  - `fct_version_progression (pin_id, version_no, position, sessions_reaching)` built from per-session max position.
  - `fct_pin_day (pin_id, day, saves, outbound_clicks, product_tag_clicks)`.
  - The creator report shows per-page history by page id (across versions) and per-position progression per version, with the version boundaries marked.
- **Retention.** Raw page views for a few months; per-page and per-version aggregates for the life of the pin. At {{daily_published}} pins a day with up to {{max_pages}} pages, the raw page-view grain is by far the largest table.

**Competing designs to accept.** Pages stored as an ordered array in the version row (JSON) if each element carries a stable page_id and events reference it. Content-addressed versions (hash of the page list). Event-sourced edits (page_added, page_moved, media_replaced) with versions as projections. Treating a media replacement as a new page, if stated and the creator report explains it.

**Bottlenecks and failure modes.** Positions as page identity (history moves on reorder); attributing events to the current version (late events misattributed); versions edited in place; publishing before media is ready; "drop-off" defined on the last page viewed in time; per-session reconstruction at query time over huge raw tables.

**Incident guidance.**
- *Events carried position but not page id after a client release*: views were keyed by position, so reordered pins (about {{edited_share}} are edited) mixed histories. Contain by marking affected days in reports; repair using the version_pages mapping (version + position → page_id) since the version was still sent; add a contract test and an ingestion check that rejects page views without page_id.
- *A version went live with a page still processing*: the publish path did not check media status. Roll the pin back to the previous version (or hide the page), add the ready-check inside the publish transaction, and exclude the affected version's progression from comparisons. With {{video_share}} video pages, the processing queue needs its own backlog alert.
- *Earlier versions rewritten in place*: immutability was not enforced. Restore versions from the change log or backups, make version rows append-only (no UPDATE grant on published versions), and route tag corrections through a new version.

**Follow-up guidance.** (1) Version 2: positions P3=1, P1=2, P2=3; P2 keeps its page_id with a new media asset; P2's view history continues by page id and the report marks the media change. (2) Events carry version 1, so they are attributed to version 1 and its positions; no inference from the live version. (3) Sessions reaching each position per version; comparing versions compares progression curves, labelled with what changed. (4) The tag on earlier versions stays as history; the live version shows it as unavailable or drops it in a new version; counted clicks remain. (5) Raw per-page events for weeks to months, daily per-page aggregates long term; sessions × average pages viewed gives the raw volume.

**Rubric anchors.** 2: pin row with a pages array keyed by position and no versions. 3: immutable versions, stable page ids, version_pages with positions, events with version and page, defined progression. 4: also the media-ready publish rule, late-event attribution, per-page versus per-position reporting, retention sizing, and incident guardrails.

**Strong signals.** Distinguishes page identity from position unprompted; defines the last page reached as the maximum position. **Red flags.** Joining events to the current version; editing published versions; showing individual viewers to creators.

## PIN-L3-03

**Reference architecture (one defensible design).**
- **Merchants and uploads.** `merchants (merchant_id, country, default_currency, created_at)`, `catalogues (catalogue_id, merchant_id, feed_url_ref, schedule)`, `feed_uploads (upload_id, catalogue_id, fetched_at, row_count, status received|validated|applied|rejected, rejection_reason)`, `feed_rows (upload_id, merchant_item_id, item_group_id, title, link, image_url, price_minor, sale_price_minor NULL, sale_start NULL, sale_end NULL, currency, availability)`: immutable, retained for a limited period (raw files in cheap storage).
- **Product identity.** `products (product_key, merchant_id, merchant_item_id, first_seen_upload, status active|missing|retired, identity_fingerprint)`; a unique constraint on (merchant_id, merchant_item_id) among active products. A re-used item id (fingerprint mismatch: different link path and title) retires the old product_key and creates a new one; the old pins stay on the old key and show "no longer available".
- **History.** `product_attr_history (product_key, valid_from, valid_to NULL, item_group_id, title, link, image_url)`, `price_history (product_key, valid_from, valid_to NULL, price_minor, sale_price_minor NULL, sale_start NULL, sale_end NULL, currency)`, `availability_history (product_key, valid_from, valid_to NULL, availability)`. Intervals are produced by diffing a validated upload against current state; unchanged items write nothing. Price shown at time t = sale price if sale_start ≤ t < sale_end, else price, from the interval containing t.
- **Product pins.** `product_pins (pin_id, product_key, created_at)`; never re-pointed silently; a deliberate re-map is logged in `product_pin_remaps`.
- **Validation.** Before applying: row-count drop versus the previous upload beyond a threshold, share of zero or null prices, share of availability flips, currency changes, duplicate item ids. A failed upload is `rejected`, the previous state stays live, and the merchant is notified with the reason.
- **Engagement facts.** `fct_product_engagement_day (merchant_id, product_key, item_group_id_at_event, day, impressions, saves, outbound_clicks)` with the item group stamped at event time; a merchant view by current grouping is a separate, labelled re-aggregation. Money-weighted reports convert with `fx_rates (currency, day, rate)` and fail closed on a missing rate.
- **Sizing.** {{catalogue_items}} items refreshed every {{feed_hours}} hours: even a 1–2% change rate per upload is millions of interval rows a day; full snapshots per upload would be orders of magnitude larger.

**Competing designs to accept.** SCD type 2 on one wide product table (if they limit which attributes create versions). Periodic full snapshots with a compacted change log (if "price on a date" is answered by the log). Feed deltas computed by hashing rows per item and comparing hashes. Storing a per-upload "applied state" pointer and serving from immutable upload data, if the cost is shown.

**Bottlenecks and failure modes.** Overwritten prices (no history); full copies per upload; floats for money; summing across currencies; deleting missing items (pins and saves orphaned, then resurrected with new ids); re-used ids silently re-pointing pins; applying a bad upload; title changes in every upload exploding SCD versions.

**Incident guidance.**
- *All prices 0 after an export bug*: validation lacked a zero-price share check. Contain by restoring the previous state for that catalogue (re-apply the last good upload), suppress price-drop notices generated in that {{feed_hours}}-hour window, and add a check that rejects an upload whose zero-price share or median price change exceeds a threshold.
- *Re-used item ids after a migration*: identity was the merchant item id alone. Detect with a fingerprint (link path, title similarity, image hash); retire old keys, move pins only by explicit merchant mapping, and cancel notices tied to mismatched products; add the fingerprint check to every upload.
- *Missing exchange rate treated as 1*: the report defaulted the rate. Make the conversion fail closed (no number rather than a wrong one), backfill the rate, restate the report with a label, and alert on missing rates for any of the {{currencies}} currencies before reports run.

**Follow-up guidance.** (1) Price interval closes and a new one opens on the drop; availability interval out_of_stock; the weekend sale is stored as sale_price with its window, so no new interval is needed at start and end if the window is in the row; back in stock at full price closes the sale (or it simply ends). (2) Row-count drop check rejects; the previous state stays; the merchant sees a rejected upload with the reason. (3) Fingerprint mismatch → new product key; old pins show unavailable; engagement stays with the old key. (4) Change set ≈ items × change rate per upload × uploads a day; compute by hashing each item's relevant fields and comparing with the stored hash. (5) Use the item group at event time by default, offer the current grouping as a labelled view; convert with the rate of the event day.

**Rubric anchors.** 2: one products table overwritten by each feed, prices as floats, deletes for missing items. 3: immutable uploads, product state, price/availability intervals, minor units with currency, stable product keys for pins. 4: also validation that blocks bad uploads, re-used id detection, sale-window semantics, item-group history in facts, fail-closed currency conversion and a change-set estimate.

**Strong signals.** Asks what "price shown" means during a sale; protects pins from identity changes. **Red flags.** Floats for money; summing currencies; treating a missing item as deleted forever after one upload.

## PIN-L3-04

**Reference architecture (one defensible design).**
- **Evidence.** `verification_checks (check_id, claim_id, method meta_tag|dns_record|file, result pass|fail|error, detail, checked_at)`: append-only, kept for audit. Errors (timeouts, resolver failures) are distinct from fails.
- **Claim state.** `claims (claim_id, account_id, domain, requested_at)`; `claim_state_history (claim_id, state pending|verified|failing|lost|released, valid_from, valid_to NULL, cause_check_id NULL)`. Failing starts at the first failed check; lost starts at failing_start + {{grace_hours}} hours if no passing check came first; a passing check during failing returns to verified.
- **Derived intervals.** `claim_intervals (domain, account_id, claim_id, valid_from, valid_to NULL)`: the periods in state verified or failing, computed once from the state history (the grace period is applied here, and only here). A constraint (an exclusion constraint on tstzrange per domain, or a check in the writer) prevents overlaps.
- **Hosts.** `pin_links (pin_id, url, created_at)`; `link_resolutions (url, final_url, resolved_at, crawler_run)` for redirects and shorteners; `pin_hosts (pin_id, host, rule_version, derived_at)`, where the rule lower-cases, strips one leading `www.`, removes tracking parameters, and uses the resolved URL when the link is a known redirector. A rule change writes new rows with a new version and triggers recomputation of affected facts.
- **Subdomains.** A claim covers the domain and its subdomains (host = domain or host ends with '.' || domain); the most specific claim in force wins.
- **Crediting.** At ingestion (or in an hourly batch), each engagement event is joined to the claim interval covering its host at its event time and the credited account is stored on `fct_pin_engagement (event_id, pin_id, event_type, event_time, host, credited_account_id NULL, credit_rule_version)`. Late events are credited by event time against the interval table, which still holds past intervals. Daily `agg_creator_day (account_id, day, impressions, saves, outbound_clicks)` is built from the fact.
- **Creator view.** Shows claim coverage per day (hours with no claim in force) next to the metrics, so a dip from a lost claim is visible.

**Competing designs to accept.** Computing credit at report time with an as-of join (correct, more expensive; they should say how to keep it cheap — sorted interval lookups per domain, broadcast of the small interval table). Applying the grace period at query time, if it is applied in exactly one place. Storing claims as a type 2 table directly instead of a state history plus intervals.

**Bottlenecks and failure modes.** Credit by pin creation time or by the current claim (history moves with the domain); grace applied twice or not at all; suffix tests without the dot; normalisation drift between ingestion and reports; a resolver outage that turns errors into fails; joining billions of events to claims without partitioning by domain.

**Incident guidance.**
- *DNS outage makes checks fail longer than the {{grace_hours}}-hour grace period*: classify resolver errors as `error`, not `fail`, and do not advance claims to lost on errors; pause loss for the affected provider with a recorded decision; re-check when resolution recovers. Guardrail: an alert when the share of failing claims jumps, and a rule that a mass failure from one provider needs a human decision.
- *Job credited by the current claim*: history moved to the new owner. Restore from the fact's stored credited account (or recompute with the as-of join), notify both creators, and add a test with a mid-period transfer that the previous owner's past numbers do not change.
- *Normalisation stopped stripping `www.`*: affected pins were credited to nobody. Re-derive hosts with the fixed rule for the affected window, recompute facts for those pins, label the restatement, and add a monitor on the share of linked-pin events credited to nobody (claim checks every {{recheck_days}} days cannot see this).

**Follow-up guidance.** (1) With 24 hours of grace: failing from day 3 10:00, lost at day 4 10:00, verified again at day 5 09:00 (a new interval); with 72 hours the pass at day 5 09:00 lands inside the grace period and the claim was never lost. Released a week later ends the interval; the next account's interval starts at its own verification. (2) Coverage hours per day next to metrics. (3) The late event is credited by its event time to the previous owner. (4) Re-derive hosts, recompute the affected facts, show a restatement note. (5) Partition events by host or domain, broadcast the small interval table, or stamp credit at ingestion.

**Rubric anchors.** 2: a claims table with a status column and credit by joining pins to today's claims. 3: evidence, state history and intervals; credit by event time; stated normalisation and subdomain rules. 4: also grace applied once with exact boundaries, errors versus fails, versioned host rules with restatement, credit stored on the fact, coverage shown to creators, and incident guardrails.

**Strong signals.** Separates evidence from state from intervals; tests the suffix rule with a look-alike host. **Red flags.** Credit by pin creator; re-crediting history when a domain changes hands; ignoring redirects entirely.

## PIN-L3-05

**Reference solution** (PostgreSQL)

```sql reference
WITH ev AS (                                   -- countable events on pins with a link, host normalised
  SELECT e.event_id, e.event_type, e.occurred_at,
         regexp_replace(lower(p.link_host), '^www\.', '') AS host
  FROM pin_events e
  JOIN pins p ON p.pin_id = e.pin_id
  WHERE e.event_type IN ('impression', 'save', 'outbound_click')
    AND p.link_host IS NOT NULL
), credited AS (                               -- one claim per event: the most specific in force
  SELECT DISTINCT ON (ev.event_id)
         ev.event_id, ev.event_type, ev.occurred_at, c.creator_id
  FROM ev
  JOIN domain_claims c
    ON (ev.host = c.domain OR right(ev.host, length(c.domain) + 1) = '.' || c.domain)
   AND c.claimed_at <= ev.occurred_at
   AND (c.released_at IS NULL OR ev.occurred_at < c.released_at)
  ORDER BY ev.event_id, length(c.domain) DESC
)
SELECT creator_id,
       date_trunc('week', occurred_at)::date AS week_start,
       COUNT(*) FILTER (WHERE event_type = 'impression')     AS impressions,
       COUNT(*) FILTER (WHERE event_type = 'save')           AS saves,
       COUNT(*) FILTER (WHERE event_type = 'outbound_click') AS outbound_clicks
FROM credited
GROUP BY creator_id, week_start
ORDER BY creator_id, week_start;
```

**Explanation.** Credit is a property of each event, so the join to claims is an as-of join on the event's `occurred_at` with a half-open interval: in force from `claimed_at` inclusive to `released_at` exclusive, which makes a transfer at one instant credit exactly one creator. Filtering the event types before the join removes closeups, so no creator-week row exists with all counts 0, and the inner join drops events nobody is credited for. The host is normalised once (lower case, one leading `www.` removed); at Medium the hosts are already normalised, so it changes nothing there. At Very Hard a host can be covered by a claim on its parent domain and by a claim on the subdomain itself; `DISTINCT ON (event_id) … ORDER BY length(domain) DESC` keeps only the most specific claim, so the event is counted once. The suffix test is anchored on a dot (`right(host, len + 1) = '.' || domain`), so a look-alike host that merely ends with the claimed name is not covered. At Medium and Hard the data contains no subdomain hosts, so the subdomain clause is harmless there and a candidate's exact-match query is equally correct. `date_trunc('week', …)` returns the Monday in the session time zone, which the setup sets to UTC.

**Complexity.** One hash join of events to pins, then a join to claims on the host. The equality part hashes; the suffix part is a nested loop over claims per event in this form, which is fine for a sample and not at scale. In production, derive each event's candidate domains (the host and each parent suffix: `a.b.c.example` → `a.b.c.example`, `b.c.example`, `c.example`) and equi-join on them, or stamp the credited creator at ingestion. The claims table is small enough to broadcast.

**Dialect notes.** `DISTINCT ON` is PostgreSQL; Snowflake and BigQuery use `QUALIFY ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY LENGTH(domain) DESC) = 1`, Spark SQL and MySQL 8 a subquery on that row number. `COUNT(*) FILTER (WHERE …)` becomes `COUNT_IF(…)` in Snowflake and Spark, `COUNTIF(…)` in BigQuery and `SUM(CASE WHEN … THEN 1 ELSE 0 END)` in MySQL. Week starts: `DATE_TRUNC('WEEK', ts)` starts on Monday in Snowflake by default (`WEEK_START` parameter), BigQuery needs `DATE_TRUNC(DATE(ts), WEEK(MONDAY))` because plain `WEEK` starts on Sunday, Spark's `date_trunc('week', ts)` starts on Monday, and MySQL needs `DATE(ts) - INTERVAL WEEKDAY(ts) DAY`. `regexp_replace` exists in all of them; MySQL's `RIGHT` and `LENGTH` behave the same for ASCII hosts (use `CHAR_LENGTH` for non-ASCII). None of these variants is executed here.

**Edge cases built into the data.** An event exactly at a claim's `claimed_at` (credited); a domain transferred to another creator at one instant with an event exactly at that instant (the new owner only); a pin created before its domain was claimed, with events before (nobody) and after (the creator) the claim; a transferred domain's older pin with events on both sides of the transfer; events at Sunday 23:59:59 and Monday 00:00:00 UTC on either side of a week boundary; a creator claimed late in the last week whose events after the claim are all closeups (no row); pins with no link and a pin on a domain nobody claims. Hard adds hosts with capitals and a leading `www.` (forced on credited pins), a claim that lapses and is re-verified by the same creator after a gap (events in the gap credit nobody; an event exactly at the re-verification is credited) and, in some seeds, a claim released for good. Very Hard adds a subdomain claimed by another creator for part of the period (the subdomain's creator wins while both are in force, the parent's before), an unclaimed subdomain (the parent's creator), and a look-alike host such as `the` + the claimed domain (nobody).

**Common mistakes.** Crediting by the claim in force when the pin was created; crediting by the latest claim; an inclusive `released_at` (double credit at a transfer) or an exclusive `claimed_at`; Sunday-start weeks; counting closeups or grouping before filtering the types (zero rows); a LEFT JOIN that keeps uncredited events as NULL-creator rows; (Hard+) comparing raw hosts; (Very Hard) exact matching only, crediting both the parent and the subdomain claims, letting the parent win, or a suffix test without the dot. Each has a diagnostic.

**Follow-up guidance.** (1) Generate candidate suffixes per host and equi-join, partition by domain, broadcast claims; or stamp at ingestion. (2) Stamping at ingestion fixes history and makes reports cheap, but late events must still be credited by event time against interval history, and a host-rule change needs a recomputation; computing at report time is always consistent with the current intervals but costs a join every time. (3) Per creator and week, sum the overlap of the gaps between their claim intervals with the week (`tstzrange` intersection, or `LEAST/GREATEST` arithmetic). (4) Apply the grace period once, when claim intervals are derived, so `released_at` already includes it; this query should not add it again.

**Rubric anchors.** 2: right shape but credits by pin creation or the latest claim, or counts closeups. 3: matches the expected result at the level played. 4: also explains how to scale the as-of join, where to store the credited creator, and how to report coverage gaps.

**Strong signals.** Writes the half-open interval without being asked; asks what happens at the instant of a transfer; anchors the suffix on a dot. **Red flags.** Joining pins to `domain_claims WHERE released_at IS NULL`; `LIKE '%' || domain`; a GROUP BY over all event types with zero-count rows left in.
