# How to add a new analytics event

The event layer is name-based: adding an event needs **no schema migration**.

## 1. Emit it from the page
Anywhere on a page that already loads `lib/ps.js`:

```js
// name from the registry; props are enums/ids/numbers/booleans ONLY — never
// free text, answers, or the raw search string (privacy).
window.psTrack('answer_submitted', { track: 'sql', topic: 'joins', question_id: 'sql-042', correct: true });
```

`psTrack` is a no-op when Do Not Track / GPC is on, so you can call it freely.

## 2. Register it
Add the name + its properties to `docs/analytics/EVENT-TAXONOMY.md` under the
right group. If it defines a goal or funnel step, also note it in
`docs/analytics/METRIC-DICTIONARY.md`.

## 3. (If it needs a formula) add the metric
Pure math goes in `analytics/lib/metrics.js` with a worked-example test in
`analytics/tests/run.mjs`. Rate metrics must carry their denominator so the
dashboard can show sample size and suppress tiny-sample conclusions.

## 4. Consume it on the dashboard
Add the aggregation to the Worker (`/api/stats` reads `events`) and render it in
the relevant tab of `analytics/index.html`. Add a tooltip that states the
formula (pull the wording from the metric dictionary).

## Rules
- **Never** put personal or free-text data in `properties`.
- New `event_name` / new `properties` key ⇒ keep `schema_version = 1`.
- Bump `schema_version` only when the shared **envelope** changes meaning.
- Deprecate by dual-emitting, migrating the dashboard, then dropping the old
  name — never hard-delete history.
- Validate locally: `node analytics/tests/run.mjs`, then load a page and confirm
  the event appears on `POST /api/e` in the Network panel.
