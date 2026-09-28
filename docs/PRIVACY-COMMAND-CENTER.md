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

## The operating model (redesign, 2026-09-28)

The Command Center was rebuilt in place to answer one question better than any
inventory: **where are we breaking a promise to a person, what decision is
required now, and can we prove the fix?** `privacy-command-center/README.md` is
the short product guide. This section is the reference.

### The chain

Every record sits on one chain, and every page and passport shows it
(`P.chain(id)`, `P.chainHTML`, `#/chain?from=<id>`):

```
Promise → Product/feature → Purpose → Person/identity → Data → System → Data flow
        → Vendor/model → Jurisdiction → Control → Evidence → Finding → Decision → Owner
```

An empty link is shown as a gap, and a gap is a finding.

### Information architecture

| Group | Routes | Answers |
|---|---|---|
| Home | `overview` (`?as=<role>`, `?all=1`) | The four questions: which promise is at risk, who is affected, which decision is owed (by whom, by when), and what evidence proves the fix. |
| Decide | `promises`, `promises/<id>`, `decisions`, `decisions/<id>` (memo), `decisions/new?t=<trail>`, `privacy/reviews`, `privacy/risks`, `privacy/worstday` | What we promised, what is owed, the options and the call. |
| Investigate | `chain`, `explore/person` (One Person), `explore/graph`, `explore/identities`, `explore/flows` (lineage), `explore/vendors`, `explore/geo`, `explore/org`, `explore/products`, `explore/systems`, `explore/data` | Follow any record to everything it touches. |
| Operate | `observability`, `privacy/consent`, `privacy/deletion`, `privacy/retention`, `privacy/rights`, `privacy/purpose`, `privacy/ai`, `privacy/tracking`, `privacy/pets`, `privacy/threats` | Is the machinery working today? |
| Prove | `assurance/controls`, `assurance/audits`, `assurance/access`, `assurance/incidents`, `assurance/drift`, `governance/regulations`, `governance/vendors`, `governance/maturity` | Tests, evidence, freshness, exceptions. |
| Report | `report/executive` (memo), `report/engineering`, `report/audit`, `report/legal`, `report/investigation?t=<trail>` | Printable, dated, with the synthetic-data disclaimer. |
| Help | `help` | Glossary: every term the product uses. |

A nav item whose view is missing is never rendered, so the menu never has a dead link.

### Data model

`data.js` holds what Northstar **has**. `data-ops.js` holds what it **owes** and
how it **proves** it:

- **`promises`**: the text, where it was made, the audience, and the
  features, purposes, datasets, controls, findings and incidents it relies on,
  plus its risk, decision and owner. State is derived by `P.promiseState`:
  - BROKEN when an open HIGH finding or an incident contradicts it;
  - AT RISK when any finding is open or a control fails;
  - UNPROVEN when a control test is missing or stale;
  - KEPT only when all evidence is fresh and passing.
- **`decisions`**: the question and the human consequence, plus:
  - an owner and an approver;
  - the stage (`owed | decided | verifying | closed`);
  - at least two options, each with privacy, product and cost effects, and with
    pros, cons and a trade-off;
  - the recommendation, dissent and uncertainty;
  - `test`, the check that proves the fix, tied to a control.

  The due date is the earliest due date among its open findings. The SLA
  derives from severity: 14, 30 or 60 days. Recording a decision writes to
  in-memory `P.state.decisionLog` and can be undone. Nothing about it is stored.
- **`controlTests`**: one for every control, with last, result, method,
  evidence, next and exceptions. Freshness, from `P.freshness`, is fresh up to 7
  days, aging up to 30, then stale; a control with no test is *never tested*.
- **`indicators`**: target, direction, owner, coverage `{v, of}` and seven
  weekly values. The current value is always computed from `P.METRICS`.
- **`perspectives`**: the four role groups, what each can decide, the evidence
  it sees first, and its vocabulary.
- **`person`** (Dana): the fictional person that One Person, consent and
  deletion all follow.
- **`NS.personProfile`** (in `views-prove.js`): Dana's facts. Each is tagged by
  origin — collected, observed, derived, inferred or obtained externally — with
  its dataset, fields, join path and the levers that would remove it. It also
  lists the systems an access-request export reads.
- **`NS.reviewDetails`** (in `views-prove.js`): requester, sign-off date and launch
  conditions per review. Reviews are citable records (type `review`). The
  **re-review rule**: 90, 180 or 365 days after sign-off by risk, or at once when a
  drift event touches the feature's scope.
- Module data lives in:
  - `data-operate.js`: the consent pipeline, deletion traces and rights reach;
  - `data-ai.js`: AI agents and AI-data lineage.

**Residual risk is never a bare number.** `P.explainRisk` returns five things:
1. a band;
2. the likely impact, given as a range when confidence is low;
3. the drivers;
4. the safeguards, each with its evidence level;
5. the unknowns and the confidence.

### Role-to-decision matrix

| Perspective | Roles | Verb | Can decide | Sees first | Words: finding · control · decision |
|---|---|---|---|---|---|
| Leadership | CPO, CISO, CTO, Executive | Decide | Accept, refuse or fund a trade-off; set the owner of an orphan decision | people affected, consequence, options, cost | exposure · safeguard · decision |
| Managers & owners | Engineering Manager, Product Manager, Data Governance | Assign | Owners, sprint scope, launch holds, retention schedules | due dates, blockers, their teams' systems | issue · control · decision |
| Oversight | Privacy Counsel, Compliance, Internal Audit | Challenge | Attest, dispute evidence, require a re-test, legal basis | legal basis, control tests, freshness | gap · control · determination |
| Builders | Privacy, Data, Software, Security, AI/ML engineers | Fix | The implementation and the test that proves it | systems, flows, code paths, the failing test | finding · control · decision |

Every role sees the same records. The role changes the ranking
(`P.priorities`), the words (`P.word`), the order of the disclosure sections in
each priority card, and the action verb. It never hides a finding.

### Tests

`node privacy-command-center/tests/run.mjs` runs `tests/*.test.mjs` in headless
Chromium. The Accessibility workflow runs it as "Privacy Command Center
behaviour tests". The suites cover:
- role switching;
- search traceability;
- consent propagation;
- deletion verification;
- risk explanations;
- decision-memo creation;
- AI-data lineage;
- print and PDF (no blank pages, date and disclaimer);
- keyboard use;
- 390px layout.

## Files

| File | What |
|---|---|
| `data.js` | Northstar: BUs, teams, products, features, systems, datasets (fields with tier and role), identifiers + joins, vendors + subprocessors, **flows** (every arrow is a privacy object), models, controls (enforcement level 0–5 + health), findings (each with a `detector`), explainable risks, incidents, drift, consent consumers, deletion targets, reviews, 8-question answers, trackers, PETs, DP ledger, regulations, maturity, access events, regions/transfers, the hypothetical person, and field-guide extras (handshake patterns, assumption tests, contextual-integrity notes). |
| `app.js` | Core: entity registry, **knowledge graph** (typed edges derived from the collections), org lookups, the six north-star questions per dataset (`P.six`), the risk model (`P.riskCalc`), all metrics (`P.METRICS`), router, drawer, trail, nav. |
| `passports.js` | The Privacy Passport per entity type (dataset is the full one). |
| `data-ops.js` | Promises, decisions, control tests, indicators, perspectives, and Dana (see the operating model above). |
| `data-operate.js` | Consent pipeline and Dana's revocation trace, deletion trace (every location, including copies the orchestrator does not know), canaries, legal holds, crypto-shred limits, retention policy, rights reach, observability history. |
| `data-ai.js` | Dataset origins, flow transforms, schema changes, purpose history, AI models and the conversation data they hold, fictional agents, vendor operations, Worst Day scenarios and safeguards. |
| `model.js` | The operating model: chain, promise state, risk explanation, decisions, indicators, priorities, role vocabulary. |
| `views-home.js` | Home (four questions), Promises, Chain explorer, Help. |
| `views-decide.js` | Decision register and memos, investigation report, trail → memo, print. |
| `views-operate.js` | Observability, Consent (revocation replay), Deletion (proof per location), Retention, Individual rights. |
| `views-investigate.js` | Lineage & flows, Purpose, Vendors (both routes), Geography, AI & agents, Worst Day, Risk radar. |
| `views-prove.js` | One Person, Controls & evidence, Privacy reviews and workbench. |
| `views-explore.js` | Organization, Products, Systems, Data, Knowledge Graph, Identities. |
| `views-privacy.js` | Tracking, PETs & DP, Threat Models (plus shared helpers such as `P.miniDFD`, `P.reviewBlockers`). |
| `views-assurance.js` | Audits, Access & Insider, Incidents, Drift, Regulations, Maturity, and the engineering / audit / legal reports. |
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
- **Worst Day** follows the guide's breach budget (collected × kept ×
  identifiable × who holds the key), but shows a band (Contained → Critical),
  never a decimal. Three failures (outsider, insider, vendor) and seven
  safeguards; switching one shows what it buys. Labelled illustrative.

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
Edges, metrics, search results and passports pick it up automatically; the
lineage and egress maps lay themselves out. Records added only to the module
files (`data-operate.js`, `data-ai.js`) appear on their pages but are not yet
registered for search or passports. Keep everything fictional. Never use a real company as a
Northstar vendor.
