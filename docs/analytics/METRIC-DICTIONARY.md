# PaddySpeaks Analytics — Metric Dictionary (exact formulas)

Every metric on the redesigned dashboard resolves to a formula here. Thresholds
marked **⚙︎** are configurable (see `analytics/lib/config.js` → `THRESHOLDS`),
not hard-coded. All rates display **with their sample size**; any rate over a
denominator `< 30` **⚙︎** renders with a "small sample" warning and is never
used to auto-generate an insight.

## Grain definitions (the vocabulary)
- **Event** — one row in `events`.
- **Page view** — one `page_view` event.
- **Visitor (person)** — distinct `anonymous_visitor_id`.
- **Session** — activity from one `session_id`; closed after **30 min ⚙︎** of
  inactivity (derived server-side from event gaps, not tab lifetime).
- **Reader** — a visitor who triggers a `page_view` on an article.
- **Engaged session** — a session with **≥ 90 active seconds ⚙︎** OR
  **≥ 75% scroll ⚙︎** on any page OR **≥ 2 page views** OR **≥ 1 goal**.
- **Learning start** — first `question_started`/`quiz_started`/
  `simulator_started` in a session.
- **Learning completion** — `question_completed`/`quiz_completed`(passed)/
  `simulator_completed`.
- **Conversion / goal** — any configured goal completion (below).

## North-star metrics
- **PaddySpeaks — Meaningful reader:** a visitor who, on a content page,
  reaches **≥ 75% scroll ⚙︎** OR **≥ 90 active seconds ⚙︎** OR clicks a related
  link OR completes a CTA. `meaningful_readers = COUNT(DISTINCT visitor_id)`
  meeting that predicate.
- **Interview Studio — Weekly learning completions:**
  `COUNT(DISTINCT visitor_id)` with ≥ 1 learning completion in the ISO week.

## Overview KPIs
| KPI | Formula |
|---|---|
| Meaningful visitors | `DISTINCT visitor_id` satisfying the meaningful-reader predicate |
| Engaged sessions | `COUNT(session)` where session is engaged (def. above) |
| Engagement rate | `engaged_sessions / total_sessions` (= `1 − bounce_rate`) |
| Goal completions | `COUNT(goal events)` (sum over configured goals) |
| Visitor→goal conversion | `DISTINCT visitor_id with ≥1 goal / DISTINCT visitor_id` |
| Returning visitor rate | `returning_visitors / total_visitors` (see below) |
| Median engaged time | `MEDIAN(active_ms over engaged sessions)` |
| Median scroll depth | `MEDIAN(max_scroll over content page views with scroll data)` |
| Interview exercises completed | `COUNT(question_completed) + COUNT(quiz_completed passed) + COUNT(simulator_completed)` |
| 7-day retention | see Retention |
| 30-day retention | see Retention |

## New vs returning (fixes defect A)
Computed at the **session** grain from the visitor's **first-seen** timestamp
(server-maintained `visitors` roll-up), never per page view:
- `first_seen(visitor)` = MIN(`occurred_at`) ever for that visitor.
- A session is **returning** if it starts on a **different calendar day
  (visitor-tz) ⚙︎** after `first_seen`, else **new**.
- `returning_visitors = DISTINCT visitor_id with ≥1 returning session in range`.
- **Invariant asserted in tests:** `returning_visitors ≤ total_visitors` and
  `new + returning (visitors) = total_visitors`. Session-grain counts
  (`new_sessions + returning_sessions = total_sessions`) are reported
  separately and **labeled as sessions**, never as "visitors."

## Bounce & engagement (fixes defect D)
- `bounce_rate = non_engaged_sessions / total_sessions`.
- A one-page session that meets the engaged predicate (e.g. long read) is
  **engaged**, not a bounce → reported as **"engaged single-page session."**

## Central tendency (fixes defect H)
Duration and scroll headline numbers are **medians**; p75 shown on drill-down.
Means are secondary and always paired with the median. Percentiles computed
over rows with a real measurement (`active_ms > 0` / `max_scroll IS NOT NULL`),
and the **coverage %** (share of sessions with a measurement) is shown beside
them (ties to Data Quality).

## Acquisition — source classification (deterministic, ordered)
1. `internal` — referrer domain is a PaddySpeaks property, or visitor is excluded.
2. `email` — `utm_medium IN (email,newsletter)`.
3. `ai_assistant` — referrer domain in {chatgpt.com, chat.openai.com,
   perplexity.ai, gemini.google.com, claude.ai, copilot.microsoft.com} **or**
   `utm_source` in that set.
4. `linkedin` — referrer domain `linkedin.com`/`lnkd.in` or `utm_source=linkedin`.
5. `organic_search` — referrer domain in a search-engine list and no `utm`.
6. `social` — referrer domain in a social list (x/twitter, facebook, reddit, youtube…).
7. `referral` — any other non-empty external referrer.
8. `direct` — empty referrer and no utm.
9. `unknown` — has utm but unclassifiable, or ambiguous.

Per source/campaign we report: visitors, engaged sessions, engagement rate,
median active time, pages/session, goal completions, conversion rate, returning
rate, interview completions. **Value classes:** `high_volume_low_value`
(visitors ≥ p75 **and** engagement rate ≤ median) and `low_volume_high_value`
(visitors ≤ median **and** engagement rate ≥ p75 **and** n ≥ 30 ⚙︎).

## Content classification (2×2 on reach × engagement)
- reach = unique readers; engagement = engagement rate (engaged readers / readers).
- Split each at its **median** across the content set:
  - **Winner** — reach high & engagement high.
  - **Hidden gem** — reach low & engagement high.
  - **Click magnet** — reach high & engagement low.
  - **Needs attention** — reach low & engagement low.
- Read-through rate = `readers reaching 90% scroll / readers`.
- Next-page click rate = `sessions with a subsequent internal page / entrances`.

## Interview Studio funnels
- **Discovery:** landing → `interview_studio_opened` → `track_viewed` →
  `track_selected`. Step rate = `DISTINCT visitor at step n / step n−1`.
- **Learning:** `question_viewed` → `question_started` → `answer_submitted` →
  `question_completed`. Abandonment point = first step with the largest drop.
- **Assessment:** `quiz_started` → `quiz_completed` → passed → repeat session ≤ 7d.
- **Per track:** starts, completion rate (`completions/starts`), correct rate
  (`answer_correct/answer_submitted`), hint rate (`hint_requested/question_started`),
  median time/question, repeat usage (visitors with ≥2 sessions on the track).

## Retention (fixes "don't show incomplete windows as 0")
- Cohort = visitors by first-visit week / source / landing / content group /
  track / device / country.
- `DayN retention = visitors active in [first + N, first + N+1) / cohort size`.
- **A DayN cell is `null` (rendered "—", not 0) until the window has fully
  elapsed** for that cohort (`now ≥ cohort_start + (N+1) days`). Tests assert
  incomplete windows are `null`.

## Data-quality metrics
`duration_coverage = sessions with active_ms>0 / sessions` ·
`scroll_coverage` · `bot_rate = suspected+bot events / all events` ·
`internal_rate` · `duplicate_rate = dropped-by-event_id / received` ·
`unknown_referrer_rate` · `failed_submissions` (5xx) ·
`last_event_at` · `processing_latency = now − last_event_at`.

## Goals (configurable — `THRESHOLDS.goals`)
Default goal set (edit in config, no code change):
1. Meaningful read (north-star predicate).
2. Interview learning completion.
3. Quiz passed.
4. Related/next-page click (site "stickiness" goal).
5. Resume/CTA click (`[data-cta]`).
