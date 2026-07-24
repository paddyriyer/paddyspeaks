# PaddySpeaks Analytics — Event Taxonomy (schema v1)

Privacy-first, anonymous, cookie-free. Every event shares one envelope; event
types differ only by `event_name` and their `properties` JSON. This is the
contract the tracker emits and the Worker validates. **Adding an event = add a
name + property list here, emit it via `psTrack()`, no schema migration.**

## Envelope (every event)

| Field | Type | Source | Notes |
|---|---|---|---|
| `event_id` | uuid | client | Idempotency key; dedupe on ingest |
| `event_name` | string | client | From the registry below |
| `schema_version` | int | client | Currently `1` |
| `anonymous_visitor_id` | uuid | client (`localStorage._ps_vid`) | Not linked to identity; user-clearable |
| `session_id` | uuid | client (`sessionStorage._ps_sid`) | 30-min inactivity window |
| `occurred_at` | ISO-8601 | server (authoritative) | Client `ts` kept as `client_ts` for drift checks |
| `page_path` | string | client | Canonicalized (no trailing slash / `index.html`, lower-cased) |
| `page_title` | string | client | Truncated 200 |
| `content_group` | enum | server-derived | See groups below |
| `referrer_domain` | string | server | eTLD+1 of `document.referrer` |
| `referrer_path` | string | server | Path only, query stripped |
| `utm_source/medium/campaign/term/content` | string | client | From URL, persisted for the session |
| `device_category` | enum | server (UA) | desktop / mobile / tablet |
| `browser`, `operating_system` | string | server (UA) | |
| `locale` | string | client | `navigator.language` |
| `timezone` | string | server (`cf.timezone`) | |
| `country`, `city` | string | server (`request.cf`) | Approximate; no IP stored |
| `viewport` | string | client | `WxH` |
| `properties` | JSON | client | Event-specific (below) |
| `collection_status` | enum | client | `full` / `dnt` (dnt ⇒ not sent) |
| `bot_class` | enum | server | `human` / `suspected` / `bot` (never dropped silently) |
| `internal` | bool | server | Excluded-visitor or internal-referrer |

## Content groups (server-derived, explicit)
`interview_prep` · `data_engineering` · `ai_technology` · `spirituality_sacred_texts`
· `psychology` · `career_workplace` · `other_articles` · `homepage_navigation`

## Event registry

### Core (all pages) — emitted by `lib/ps.js`
| event_name | When | Key properties |
|---|---|---|
| `page_view` | On load | `load_time_ms`, `is_404`, `page_num`, `search_query`, `entry` |
| `scroll_milestone` | Once each at 25/50/75/90% | `depth` (25\|50\|75\|90) |
| `engagement` | On `pagehide`/hidden (beacon) | `active_ms`, `max_scroll`, `interactions`, `engaged` (bool) |
| `outbound_click` | Click to external host | `href_domain` |
| `cta_click` | Click on `[data-cta]` | `cta_id` |
| `related_click` | Click on related-content link | `to_path` |
| `broken_link` | Click resolving to 404 (SPA) | `href` |

### Interview Studio — emitted by studio pages via `psTrack()`
Discovery: `interview_studio_opened` · `track_viewed` · `track_selected`
(`{track}`) · `company_filter_selected` · `difficulty_selected` ·
`search_performed` (`{query_len}`) · `no_search_results` (`{query_len}`).

Learning: `question_viewed` · `question_started` · `answer_submitted`
(`{correct}`) · `answer_correct` · `answer_incorrect` · `code_run` ·
`hint_requested` · `explanation_viewed` · `question_completed` ·
`question_skipped`. Shared props: `{track, topic, difficulty, question_id}`.

Assessment: `quiz_started` · `quiz_completed` (`{score, passed}`) ·
`simulator_started` · `simulator_completed` · `flashcard_reviewed`
(`{rating}`).

Study plan: `study_plan_started` · `study_day_completed` (`{day}`).

Retention/social: `return_session` (`{days_since_first}`) · `resource_shared`
(`{channel}`).

> **Privacy note:** `properties` never contains free-text answers or the raw
> search string — only lengths, ids, enums, booleans. `question_id`/`track`/
> `topic` are content identifiers, not personal data.

### Tracks (fixed enum for `track`)
`sql` · `python` · `snowflake` · `system_data_design` · `communication` ·
`ai_engineering`. Communication exercise types and AI topics travel in
`properties.topic` (see the brief's lists; validated against the track's
`topics.json` where present).

## Versioning rules
1. `schema_version` bumps only on an **envelope** change (new top-level field
   or changed meaning), never for a new `event_name` or new `properties` key.
2. Unknown `event_name` is stored (not rejected) with `bot_class='suspected'`
   if it also fails validation, so we can discover client bugs.
3. Deprecations: keep the old name flowing, add the new one, migrate the
   dashboard, then stop emitting the old — never hard-delete history.

See `docs/analytics/ADDING-EVENTS.md` for the copy-paste recipe.
