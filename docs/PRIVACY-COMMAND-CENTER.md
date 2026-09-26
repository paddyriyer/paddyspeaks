# Privacy Command Center (`/privacy-command-center/`) and “Every Arrow Is a Decision”

Two companion pieces built on 2026-09-26 from Paddy's field guide
(`docs/Privacy_Engineering_Visual_Field_Guide.pdf` / `.pptx`, 116 slides):

- **`/privacy-command-center/`**: an interactive privacy observability,
  engineering and governance platform for a fictional company, Northstar.
  Synthetic data only, labelled in the header and footer of every screen.
- **`/articles/every-arrow-is-a-decision.html`**: the visual essay (15 scenes
  and seven corner-case trails). It is self-contained, and its facts use the
  guide's own wording and sources.

## The one rule

**Never type a number, and never invent an answer.** Every figure on the
dashboard is computed at render time from `privacy-command-center/data.js`, and
every metric carries the rule that produced it (click any tile). The analyst is
*not* a language model: it matches questions to structured queries over the
graph, cites the entities it used, and labels each statement FACT, INFERENCE,
RECOMMENDATION or UNKNOWN. UNKNOWN is shown as a finding (violet, dashed)
everywhere, and never left blank.

## Files

| File | What |
|---|---|
| `data.js` | Northstar: BUs, teams, products, features, systems, datasets (fields with tier and role), identifiers + joins, vendors + subprocessors, **flows** (every arrow is a privacy object), models, controls (enforcement level 0–5 + health), findings (each with a `detector`), explainable risks, incidents, drift, consent consumers, deletion targets, reviews, 8-question answers, trackers, PETs, DP ledger, regulations, maturity, access events, regions/transfers, the hypothetical person, and field-guide extras (handshake patterns, assumption tests, contextual-integrity notes). |
| `app.js` | Core: entity registry, **knowledge graph** (typed edges derived from the collections), org lookups, the six north-star questions per dataset (`P.six`), the risk model (`P.riskCalc`), all metrics (`P.METRICS`), router, drawer, trail, nav. |
| `passports.js` | The Privacy Passport per entity type (dataset is the full one). |
| `views-explore.js` | Overview, Organization, Products, Systems, Data, Knowledge Graph, One Person, Identities, Data Flows, Vendor Egress, Geography. |
| `views-privacy.js` | Risk Radar, Worst Day, Reviews + Workbench, Consent, Purpose, Retention, Forget Me, User Rights, Tracking, AI/ML, PETs & DP, Threat Models. |
| `views-assurance.js` | Enforcement Ladder, Audits, Access & Insider, Incidents, Drift, Evidence, Regulations, Vendor Register, Maturity, and the four reports. |
| `intel.js` | Universal search (`/` or ⌘K), the analyst, and the 10-step guided investigation (HIGH RISK → Checkout → Fraud → flow → join → vendor → purpose → finding → mitigations → enforcement). |

Vanilla JS, no libraries. The only browser storage is the chosen persona
(`pcc.persona.v1`, registered in `data/platform/state-keys.json`; see Personas). Hash routing: `#/section/page?query`.

## Personas (who is looking decides what comes first)

`personas.js` holds 15 roles, each owning ONE question: CPO, CISO / Security VP, CTO,
Executive, Engineering Manager (team-scoped), Product Manager, Data Governance,
Privacy Counsel, Compliance, Internal Auditor, Privacy / Data / Software /
Security / AI-ML Engineer. First visit shows the “Who’s looking?” picker. A
persona home shows the question, a computed one-line answer, up to five things
that need that person, four indicators, and where to start. The full Command
Center sits under “Everything else”. The choice is remembered under
`pcc.persona.v1` (registered in `data/platform/state-keys.json`). `#/overview?as=ciso`
links straight to a role, and `#/overview?all=1` shows the full view.
Persona-only indicators are ordinary metrics marked `hidden` (they stay off the
full tile wall).

Theme: warm paper, matching the site. Paddy asked for no dark backgrounds.

## Models worth knowing before editing

- **Risk:** nine exposure factors (0–5) and three assurance factors (control,
  delete, verify). `assurance = (control + delete + verify) / 15` and
  `residual = exposure × (1 − 0.6 × assurance)`. The
  formula is printed under every breakdown. HIGH ≥ 26, MEDIUM ≥ 16.
- **Six questions** (the north star): WHY / FROM / TO / WHO / WHEN / PROVE per
  personal dataset. `P.six` returns y / n / u with the reason. Unknown counts as
  unanswered.
- **Tier defaults** (guide p. 18): `P.tierControls` checks T2/T3/T4 default
  controls against a dataset. The Data page can switch requirements off
  (`P.tierOff`) to show how an organisation would customise them.
- **Worst Day** follows the guide's breach budget (DAMAGE = collected × kept ×
  identifiable × key holder). The model is labelled illustrative on the page.

## Corner-case trails (the essay)

One engine (the last inline script in the essay) replays seven dated stories. Each
is `T.<id> = { steps, habits, world(step, habits) }`. `world()` derives
everything on screen from the state: the artifact, its trail, who holds it,
the counters. Habit switches change the state, and while any habit is on each
counter also shows its value without the habits, so nothing is scripted twice and
a counter can't disagree with its story. Mount one with
`<div class="tl" data-trail="<id>"></div>`.

| id | Scene | Story |
|---|---|---|
| `v11` | 02·B | Sep 10 export in a doc → Tom restores v11 → a meeting → Mike → design agency |
| `debug` | 03 | A DEBUG flag left on for 11 days; vendor, warehouse, backups, a curious contractor |
| `csv` | 05 | One churn CSV: email, personal drive, public chatbot, then a deletion request |
| `family` | 06 | A private purchase, an inference, household linking, the family TV |
| `optout` | 08 | Opt-out at 01:58 during a job that read consent at 00:00; retries, segments, partner |
| `forget` | 09 | Deletion with partial failures, a premature "deleted" email, a restore that resurrects |
| `auth` | 11 | Dana's week: leaked password, push fatigue, real-time phishing, SIM-swap recovery, 2FA phone reused for ads. Preceded by the sign-in methods × attacks matrix (`.authm`) |

Each corner case sits in `<div class="cc" id="cc-<id>">` (02·B is `#s02b`).
The dashboard's Audits page links its assumption tests to these anchors via
`essay` in `assumptionTests` (`data.js`). People, figures and systems are
invented, and each block says so.

## Audit, 2026-09-26

A full audit of all 39 routes (about 125 issues) moved every remaining typed
figure into `data.js` or computed it. Examples: deletion and consent scopes,
obligation scope, executive memo numbers, Worst Day inputs (`worstDay`), user
rights requests and deadlines (`rightsRequests`, `rightsDeadlines`), and dataset
classes (`datasetClass`). Launch blockers are one computed rule
(`P.reviewBlockers`); `review.blockers` is a getter over it, so the Kanban,
tiles, personas and overview agree. Unknown statuses (for example CCPA access)
are shown as UNKNOWN, never as met.

## Guardrails

- Both pages are in the **strict** axe list (`scripts/a11y/axe-check.mjs`):
  zero violations at 1280 and 390 px.
- `data/platform/catalog.json` lists the demo, so `demos.total` counts it.
- The homepage links the demo from the BUILD directory row and Data Lab row 01.
  The essay is Latest #01 and the first deck card.

## Adding to the demo

Add the entity to the right collection in `data.js` and reference it by id.
Edges, metrics, search results and passports pick it up automatically. A new
flow shows on the flow map only if its endpoints have coordinates in `FP`
(`views-explore.js`). Keep everything fictional. Never use a real company as a
Northstar vendor.
