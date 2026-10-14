# Adobe · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domains of a creative,
document and marketing software company: creative apps with cloud documents,
generative features that record content credentials, and PDF tools. Every
account, plan, number and schema is hypothetical, and nothing here describes how
any company's systems are actually built. Plan allowances and product rules used
below are this exercise's rules; check current docs for the real ones. Document
contents are never read: only events and metadata appear.

## ADB-L1-01: Generative credits used against a monthly allowance, and when each account ran out

| | |
|---|---|
| **Template ID** | ADB-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / running totals with an explicit frame, first row past a threshold, as-of joins |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | ADB-L1-01.mjs |

**Business Scenario.** A creative suite's generative features (making or editing an image from a text prompt, for example) cost generative credits. In this exercise every plan comes with a monthly credit allowance, a generation that fails is not charged, and an account keeps generating after it has used its allowance (the overage is reported, not blocked). Account owners and the support team want one report: per account and month, the allowance, what was used, and the exact generation at which the account ran out. All plan names, allowances and rules here are this exercise's, not any real plan's; check current docs.

**Problem Statement.** Write one PostgreSQL query that returns `account_id, month, allowance, charged_generations, credits_used, ran_out_gen, ran_out_at`: one row per account and UTC calendar month with at least one charged generation, ordered by `month, account_id`. A generation is **charged** when its `status` is `'succeeded'`; failed generations use no credits. `month` is the first day of the month (a `DATE`). `allowance` is the `monthly_credits` of the account's plan for that month. `charged_generations` and `credits_used` count and sum the charged generations. The account **runs out** at its first charged generation of the month, in `(created_ts, gen_id)` order, after which its running total of charged credits for the month is at least the allowance: `ran_out_gen` is that generation's `gen_id` and `ran_out_at` its `created_ts`, both NULL if the account never reached its allowance that month. {{month_rule}} {{plan_rule}}

**Constraints.** One SQL statement (CTEs allowed). Reaching the allowance exactly counts as running out. The running total restarts each month. The sample has {{accounts}} accounts and {{generations}} generations.

**Assumptions.** Hypothetical plans, allowances, credit costs and accounts. Only generation events and their metadata are used; prompts and images are never part of this report. Real plans can have other rules (rollover, add-on credits, slower generation after the allowance); they are out of scope.

**Clarifications.**
- Q: The running total reaches the allowance exactly at one generation. Is that the one? | A: Yes. At least the allowance is running out.
- Q: Does a failed generation count toward running out? | A: No. It is not charged, so it neither adds credits nor can be the generation at which the account ran out.
- Q: An account had only failed generations in a month. | A: It has no row for that month.
- Q: Two generations of one account have the same `created_ts`. | A: Order them by `gen_id`; each adds its own credits to the running total.
- Q: Which month does a generation at 00:00:30 UTC on the 1st belong to? | A: The new month. Months are UTC calendar months.
- Q: Does an account that never ran out still get a row? | A: Yes, with `ran_out_gen` and `ran_out_at` NULL.

**Hints.**
1. Filter to charged generations first, then `SUM(credits) OVER (PARTITION BY account_id, month ORDER BY created_ts, gen_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)`.
2. The default frame for a window with `ORDER BY` is `RANGE`, which gives tied rows the same running total. Say `ROWS` and order by a unique key.
3. The first row at or past the allowance: `MIN(created_ts) FILTER (WHERE running >= allowance)` gives the time; for the id, aggregate ids in `(created_ts, gen_id)` order and take the first, or use `ROW_NUMBER` over the qualifying rows.
4. For the plan in effect at a month's first instant, a `LATERAL` subquery over `plan_changes` with `ORDER BY … LIMIT 1` is the as-of join.

**Follow-ups.**
1. The support team wants "credits left right now" for one account on every page load. Would you run this query, keep a counter, or both, and how do you keep them consistent?
2. A failed generation is retried by the app and both attempts are logged, one failed and one succeeded. What could double-charge in your report, and what key would you ask the app to log?
3. A generation is charged when it succeeds, but its event can arrive hours later from a mobile device. Your report already said the account ran out at a given generation. What do you publish when the late event lands earlier in the month?
4. Plans can now add credit packs bought mid-month that raise the allowance from the moment of purchase. How does "the moment the account ran out" change, and can an account run out twice in a month?

**Follow-up rules.**
- when: range between, order by created_ts) → ask: Two generations share a second. What running total does your window give each of them, and which one does your query say ran out?
- when: status, succeeded → ask: Where in your query is a failed generation removed, and could it still be the generation at which the account ran out?
- when: accounts.plan, join accounts → ask: An account upgraded on the 20th. Which allowance does your query use for that month, and which does the rule say?
- when: min(gen_id), min gen_id → ask: Are gen_ids in time order? What does MIN(gen_id) return when a later generation has a smaller id?
- when: counter, cache, materialized view → ask: How does that counter stay correct when a generation's success event arrives late or twice?

**Evaluation Criteria.** Failed generations excluded before the running total; a running total per account and UTC month with an explicit `ROWS` frame and a unique tie-break; inclusive comparison with the allowance; the first qualifying generation by `(created_ts, gen_id)`, not the smallest id; NULLs for accounts that never ran out; no row for months with only failed generations; at Very Hard, the as-of plan from `plan_changes` (the change exactly at midnight counts, a mid-month change waits for next month, a new account uses its first plan); deterministic order; can discuss live balances and late events.

## ADB-L1-02: First-week activation of new users, per app and month

| | |
|---|---|
| **Template ID** | ADB-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / cohorts from first events, EXISTS within a half-open window, censored cohorts |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | analytics-engineer, data-engineer, senior-data-engineer, software-engineer |
| **Generator** | ADB-L1-02.mjs |

**Business Scenario.** A creative suite's product team tracks one early signal of value: a new user of an app who saves a cloud document within their first week. (A cloud document is a file stored in the vendor's cloud storage rather than only on the device.) They want the share per app and install month. Users reinstall apps and install them on new devices, which must not make them new again. Only events are used: an install and a save, never the document itself.

**Problem Statement.** Write one PostgreSQL query that returns `app, cohort_month, new_users, measurable_users, activated, activation_rate`, one row per app and cohort month with at least one new user, ordered by `app, cohort_month`. A user is a **new user** of an app at their first install of that app in `installs`; later installs of the same app (reinstalls, other devices) are not new users and start no new window. `cohort_month` is the first day of the UTC month of that first install. A new user is **activated** if they have a save of that app with `location = 'cloud'` at or after their first install and strictly less than 7 days after it. `activated` counts measurable activated users, and `activation_rate = activated / measurable_users`, rounded to 4 decimal places (NULL when `measurable_users` is 0). The report's `as_of` is `{{as_of}}`. {{asof_rule}} {{location_rule}}

**Constraints.** One SQL statement (CTEs allowed). The window is half-open: a save exactly 7 days after the first install is too late, and a save at the install instant counts. A save in a different app counts only for that app. The sample has {{installs}} install rows and {{saves}} saves.

**Assumptions.** Hypothetical apps, users and behaviour. The install log covers every user's full history, so a first install in the data is a real first install. "Saved a cloud document" is this exercise's activation signal, not any product's published metric.

**Clarifications.**
- Q: A user installed in September and reinstalled in October. Are they in the October cohort? | A: No. They are a September new user only; the reinstall changes nothing.
- Q: That user saved to the cloud two days after the reinstall, three weeks after the first install. Activated? | A: No. The window runs from the first install only.
- Q: Is a save exactly 7 days after the first install inside the window? | A: No. The window is `[first install, first install + 7 days)`.
- Q: A user saved twice in the first week. | A: They count once.
- Q: The user installed two apps. | A: They are a new user of each app, each with its own window and its own saves.
- Q: How is the rate rounded? | A: `ROUND(…, 4)` of activated over measurable users, half away from zero.

**Hints.**
1. Start from `MIN(installed_ts)` per `(user_id, app)`: that is the cohort, and it removes reinstalls in one step.
2. Use `EXISTS` (or a semi-join) to the saves in the window, so several saves do not multiply rows.
3. Count with `FILTER`: all new users, measurable ones, and measurable ones who saved. Divide with `NULLIF(…, 0)`.

**Follow-ups.**
1. The install log only starts on a fixed date, so users who installed earlier look new when they reinstall. How would you detect and exclude them, and what would you tell the team about the first months of the report?
2. Week-one activation is a ratio of two small numbers for a small app. How would you show its uncertainty instead of a bare percentage?
3. A user may sign in on a second device before any install is logged there. Which identity do you use for "new user", and what breaks if devices are counted instead of users?
4. The team wants this daily at hundreds of millions of installs. What would you precompute per user and app, and how do you handle saves that arrive late from offline devices?

**Follow-up rules.**
- when: every install, count(*) from installs, count(install_id) → ask: A user reinstalls three times in a month. How many new users does your query count for them, and in which cohort?
- when: between, inclusive → ask: A save lands exactly 7 days after the install. Does your condition include it, and should it?
- when: join saves, left join saves → ask: A user saved four times in their first week. How many times do they appear before your aggregation, and does your count still say one?
- when: as_of, censor, measurable → ask: A user installed yesterday and has not saved yet. Why is putting them in the denominator wrong, and what is wrong with leaving out only the ones who did not save?
- when: location → ask: Why do local saves not count here, and how would you report the users who only ever save locally?

**Evaluation Criteria.** New users from the first install per user and app; reinstalls ignored; the half-open window from the first install; cloud saves in the same app only; a semi-join (no row multiplication); UTC cohort months; at Very Hard, users whose window has not ended by `as_of` in `new_users` only and a NULL rate for a cohort with nobody measurable; correct rounding and order; can discuss truncated history and uncertainty.

## ADB-L1-03: Content credentials coverage of exported images

| | |
|---|---|
| **Template ID** | ADB-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / one state per entity before a join, GROUPING SETS subtotals, HAVING floors |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | analytics-engineer, data-engineer, senior-data-engineer, data-architect |
| **Generator** | ADB-L1-03.mjs |

**Business Scenario.** Creative apps can attach **content credentials** to an exported file: provenance metadata, recorded with the asset, that says who or what made it and how it was edited. They describe a history; they are not a guarantee that a file is authentic. A team wants to know how often exported images actually carry them, per app, month and format, because some export paths drop metadata. Each export is logged, and each attempt to embed or remove the credentials is a separate manifest event. Only those events are used, never the image.

**Problem Statement.** Write one PostgreSQL query that returns `app, month, format, image_exports, with_credentials, coverage`, ordered by `app, month, format`. Count only **image exports**: exports whose normalised format is one of `jpeg`, `png`, `tiff`, `webp` (other formats, such as `pdf` and `mp4`, are left out). `month` is the first day of the UTC month of `exported_ts`. For every app and month there is one row per image format and one row with `format = 'all'` that counts every image export of that app and month. `with_credentials` counts image exports that carry credentials, and `coverage = with_credentials / image_exports`, rounded to 4 decimal places. Keep only rows with at least {{min_exports}} image exports; the floor applies to each row on its own, including the `'all'` row. {{format_rule}} {{event_rule}}

**Constraints.** One SQL statement (CTEs allowed). An export counts once however many manifest events it has. An export with no manifest events does not carry credentials. The sample has {{exports}} exports and {{events}} manifest events.

**Assumptions.** Hypothetical apps, exports and rates. Content credentials appear here only as metadata recorded against an export; this report measures whether that metadata was attached, not whether any file is genuine, and it never opens the files.

**Clarifications.**
- Q: Does the `'all'` row include formats whose own row is below the floor? | A: Yes. It counts every image export of the app and month, then the floor applies to it.
- Q: Is a row with exactly {{min_exports}} image exports kept? | A: Yes. The floor is "at least".
- Q: An export has two `embedded` events (a retry). | A: It is one export with credentials.
- Q: An export has only `failed` events. | A: It does not carry credentials. `failed` events never count.
- Q: How is coverage rounded? | A: `ROUND(…, 4)` of with_credentials over image_exports, half away from zero.

**Hints.**
1. Reduce `manifests` to one row per export before joining (for example `DISTINCT ON (export_id)` over the non-failed events, latest first). A plain join counts an export once per event.
2. Normalise the format once, in a CTE, and filter on the normalised value.
3. `GROUP BY GROUPING SETS ((app, month, fmt), (app, month))` gives the per-format rows and the `'all'` row in one pass; `COALESCE(fmt, 'all')` labels it, and `HAVING` applies the floor to each.

**Follow-ups.**
1. Coverage drops sharply for one export format after an app release. What would you check in the data before reporting it as a regression?
2. A later edit in another app can remove the credentials from a file that had them. Should that change this export's coverage, or is it a different metric? How would you model both?
3. The team asks for coverage by user to find who strips metadata. What would you push back on, and what aggregate would answer the product question instead?
4. At billions of exports a month, manifest events arrive minutes after the export. How would you build this report incrementally so a late event updates only its own app, month and format?

**Follow-up rules.**
- when: join manifests, inner join, left join manifests → ask: An export has three manifest events. How many times is it counted in image_exports by your query?
- when: lower, upper, ilike → ask: Which spellings of jpeg does your query treat as one format, and where does `jpg` go?
- when: union all, rollup, grouping sets → ask: Does your 'all' row count exports from formats below the floor? Which does the rule want?
- when: count(distinct → ask: COUNT(DISTINCT export_id) fixes the total. Does it also fix with_credentials when an export has both an embedded and a failed event?
- when: stripped, latest event, distinct on → ask: An export was embedded, stripped, then embedded again. What state does your query give it, and why?

**Evaluation Criteria.** Manifest events reduced to one state per export before counting; failed events ignored; image formats normalised (case, `jpg` as `jpeg`) and non-images excluded; per-format rows and an `'all'` row over every image export; an inclusive floor applied per row; UTC months; at Very Hard, the latest non-failed event decides (embedded then stripped is not covered); correct rounding and order; can discuss regressions, privacy-respecting aggregates and incremental builds.

## ADB-L1-04: Splitting a large PDF into at most k parts

| | |
|---|---|
| **Template ID** | ADB-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Binary search on the answer / greedy feasibility check, monotone predicates |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer |
| **Generator** | ADB-L1-04.mjs |

**Business Scenario.** A PDF service lets users split a very large document (a scanned archive, a catalogue) into smaller files of consecutive pages, for example to stay under an attachment size limit. The user asks for at most `k` parts; the service should make the largest part as small as possible, and it must say exactly where the parts begin. Only page sizes are used, never page contents.

**Problem Statement.** Implement `split_pdf(page_bytes, k, overhead, chapter_starts)`. `page_bytes[i]` is the size in bytes of page `i + 1`. Split the pages into at most `k` parts of consecutive pages; a part's size is `overhead` plus the bytes of its pages. Return `(largest, starts)`, where `largest` is the smallest possible size of the largest part, and `starts` lists the first page number (1-based) of each part when the document is split from the front with every part taking as many pages as fit within `largest`. {{overhead_rule}} {{chapter_rule}}

**Constraints.** Up to 60 000 pages; every page is at least 1 byte; `1 ≤ k`. Expected: O(n log S), where S is the document's total size. A dynamic programme over every split is O(k·n²) and will not finish.

**Assumptions.** Hypothetical page sizes and overhead. A real split also rewrites shared resources and links between pages; here a part's size is exactly as stated.

**Clarifications.**
- Q: Must I use exactly `k` parts? | A: No. At most `k`. `starts` may have fewer entries.
- Q: There are several splits with the same largest part. Which `starts` do I return? | A: The one from the front where each part takes as many pages as fit within `largest`. It is unique.
- Q: Is a part exactly `largest` bytes allowed? | A: Yes. Fit means at most `largest`.
- Q: `k` is larger than the number of pages. | A: Allowed. The largest single page (plus overhead) then decides `largest`, and small pages still share parts in `starts`.
- Q: Can a single page be split? | A: No. Pages are indivisible.

**Hints.**
1. If parts of size `C` can be achieved with at most `k` parts, so can parts of size `C + 1`. That monotonicity is what you binary-search on.
2. For a given `C`, filling each part greedily from the front uses the fewest parts possible. That is an O(n) check.
3. Bounds: `largest` is at least `overhead + max(page_bytes)` and at most `overhead + sum(page_bytes)`.
4. Once you have `largest`, run the same greedy fill one more time to produce `starts`.

**Follow-ups.**
1. Prove that the greedy check uses the fewest parts for a given size limit.
2. Users want parts that are both small and close to equal in page count. How would you change the objective, and does binary search still apply?
3. The service streams a 2 GB document whose page sizes are known only as it reads. Can you choose the split in one pass, and what do you give up?
4. Splitting runs for thousands of users at once. How would you cap the cost of one request, and what would you precompute when a document is uploaded?

**Follow-up rules.**
- when: dp, dynamic programming, memo → ask: How many states and transitions does your DP have for 60 000 pages and k = 40? What property lets you avoid it?
- when: binary search, bisect → ask: What exactly is monotone in your search, and what are your low and high bounds?
- when: average, sum(page_bytes) / k, total / k → ask: Is total size divided by k a valid answer? Show a document where the best split is far from it.
- when: chapter, forced → ask: How does a chapter that must start a part change your feasibility check, and when do you return None?

**Evaluation Criteria.** Binary search over the part size with an O(n) greedy check; correct bounds (largest page plus overhead); overhead paid by every part; `starts` from the front-greedy split at the optimum, including fewer than `k` parts; at Very Hard, chapter starts as forced breaks (page 1 and unsorted lists handled) and `None` when there are more chapters than parts; O(n log S); can prove the greedy check.

## ADB-L1-05: Cloud document sync plan from three hashes

| | |
|---|---|
| **Template ID** | ADB-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Hash maps / three-way comparison against a common base, last-write-wins journals |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 25 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer |
| **Generator** | ADB-L1-05.mjs |

**Business Scenario.** A desktop app keeps a folder of cloud documents in sync with cloud storage. Each file is identified by its path and a hash of its contents; the client remembers the hash of each file at the last successful sync (the **base**). Before syncing it must decide, for every file, what to do: send the local version up, bring the cloud version down, delete one side, report a conflict for the user to resolve, or nothing. The decision is made from hashes alone; contents are never compared or read.

**Problem Statement.** Implement `sync_plan(local, cloud, base)`. Each argument is a list of `(path, content_hash)`. Return `{path: action}` for every path that appears in any of the three lists. Let `l`, `c` and `b` be the path's local, cloud and base hash (`None` where the path does not exist). Apply the first rule that matches:
1. `l == c`: `'none'` (both sides already agree, including both deleted).
2. `l == b`: only the cloud changed: `'delete_local'` if `c` is `None`, otherwise `'download'`.
3. `c == b`: only this device changed: `'delete_cloud'` if `l` is `None`, otherwise `'upload'`.
4. Otherwise both changed, differently: `'conflict'`.

{{delete_rule}} {{journal_rule}}

**Constraints.** Up to 100 000 paths per list. Expected: O(n) time. Looking each path up by scanning the other lists is O(n²) and too slow.

**Assumptions.** Hypothetical files and hashes. These rules are this exercise's; a real sync engine also handles renames, partial uploads, permissions and retries.

**Clarifications.**
- Q: The same edit was made on both sides. | A: `l == c`, so `'none'`: nothing to transfer.
- Q: A new file exists only on this device. | A: `c` and `b` are both `None`, so rule 3 gives `'upload'`.
- Q: A file was deleted here but edited in the cloud. | A: `'conflict'`: both sides changed, differently.
- Q: Is a path that only appears in `base` included? | A: Yes. Every path in any list is in the result; deleted on both sides gives `'none'`.
- Q: Does the order of the result matter? | A: No. It is a dictionary.

**Hints.**
1. Build one dictionary per list, path to hash. Then each path's three hashes are O(1) lookups.
2. The set of paths to decide is the union of the three dictionaries' keys.
3. Apply the rules in the stated order; `None` for a missing path makes deletions fall out of the same comparisons.

**Follow-ups.**
1. Show that the four rules never lose data in a two-party sync, and name the one case where `'none'` hides that both sides changed.
2. A file was renamed on this device and edited in the cloud. What do these rules do, and how would you detect the rename from hashes?
3. Conflicts are resolved by keeping both versions. How would you name the copy so that two devices resolving the same conflict do not create two copies?
4. A user's library has 2 million files and the client should sync in seconds after waking. What would you send to the server instead of three full lists?

**Follow-up rules.**
- when: for each path, nested loop, .index(, scan → ask: How many comparisons does your lookup do for 100 000 paths, and what structure makes each lookup O(1)?
- when: timestamp, mtime, modified time, newest wins → ask: The rules use hashes and a base, not times. What goes wrong with "newest modification wins" when two devices' clocks disagree?
- when: dict(, dictionary → ask: The same path appears twice in a list. Which entry does your dictionary keep, and is that the one the rules want?
- when: conflict → ask: When both sides deleted a file, is that a conflict? Walk through the rules for it.

**Evaluation Criteria.** Three dictionaries and a union of keys; the four rules applied in order with `None` for missing paths; same edit on both sides is `'none'`; new files and deletions on each side; edit/delete conflicts; at Very Hard, the last journal entry wins and a `None` hash is a deletion; O(n); can discuss renames, clocks and incremental sync.
