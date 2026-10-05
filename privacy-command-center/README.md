# Privacy Command Center (v1)

**One privacy graph. Many lenses. Progressive disclosure.**

The Command Center answers, for a fictional company called Northstar:

- what the system knows, and how it knows it;
- how the person proved who they are;
- what left the device, and who received it;
- what was joined, what was inferred, and what can act;
- which control was supposed to stop it, and whether we can prove it still works.

Everything is synthetic. Surfaces are conceptual, the Events layer's Apple-like, Google-like and Microsoft-like views only borrow familiar product categories as labels, ("web / browser", "wallet / payments") and describe no company's implementation.

The earlier full explorer is kept, unchanged, at `v10/` as **Northstar Privacy Explorer (v10)**, with `noindex`. Old `#/…` links to `/privacy-command-center/` are forwarded there by the first script in `index.html`.

## The screen

A sentence of five selectors, then one workspace:

> I am a **[persona]** looking at **[surface]** when someone **[journey]**, asking **[question]**, concerned with **[concerns]**.
> *about* **[subject]** *through the* **[Privacy | Security | Both]** *lens*

The workspace has three sections:

- **Graph:** the view of the privacy graph this combination resolves to, with the governing principle shown above it.
- **Findings:** three to five findings, each classified as FACT, INFERENCE, UNKNOWN or CONTROL FAILURE, and each citing graph records.
- **Decision:** risk, why it matters, mitigation and evidence needed. Executives get issue, options, recommendation and residual risk instead.

Global navigation is nine views of the same graph: **Command Center · Products · Everyday arrows · Every layer · Future · AI / agents · Reviews · Evidence · Ask privacy** (see *One privacy model* below). Inside the Command Center, consent, deletion, passkeys, AI and the rest are still selector values, not pages. Saved views (under *Views*) are selector presets. **Focus mode** hides everything except the selectors and the workspace, and offers three walkthrough presets.

## Selectors

| Selector | Values | What it changes |
|---|---|---|
| Persona | Reviewer, Builder, Auditor, Executive | Emphasis only: finding wording, the order of the decision fields, and the executive format. The data never changes. |
| Surface | All, Identity & authentication, Web / browser, Mail / communication, Wallet / payments, Digital identity, Cloud / data, Analytics, AI / agents, Third parties | Which findings apply, what each view emphasizes, and the default journey |
| Journey | Sign in, Browse, Read mail, Pay, Prove age, Share identity, Use AI, Live on one account, Open a report, Delete account, Revoke consent | The path through the graph that the path, boundary, observer and identifier views walk |
| Question | 26 questions in two groups: *What is true today* (19, from *What do we know?* to *What is our worst day?*) and *What must still be possible in the future?* (7) | Which view is drawn |
| Concern | 24, multi-select, including recoverability, legal hold / preservation and key lifecycle | Filters findings; picks the control chain for *Did the control really work?* |
| Subject | one person, credential, feature, dataset, tenant, vendor, AI agent, product | Refines some views (one dataset → the join; one tenant → the tenant chain) |
| Lens | All four, Security, Privacy, QA, Data governance | The essay's four questions, word for word. Same data, a different question: the lens changes the arrow's questions, the findings (QA = control failures, unknowns and findings citing a control; governance = retention, deletion, vendors, recoverability, preservation, key lifecycle, or citing a key or hold; the rule is shown) and the decision's order, never the graph. *All four* shows where they converge and keeps one finding of each kind. `l=both` in an old link means all four |

**The surface decides what the other selectors offer.** `G.relevance` in `graph.js` lists, for each surface, the journeys, questions, concerns and subjects that belong to it: wallet / payments offers *pay*, *live on one account* and *share identity*, never *read mail*. *All surfaces* offers everything. Changing the surface drops a selection that no longer belongs, and a link that names one falls back to the surface's default. The tests fail if a surface offers a question or concern that no finding on that surface answers.

`resolve()` in `app.js` is the whole mapping from selectors to a view, in about sixty lines. Read it first.

## Views

| View | Question(s) | Scenario |
|---|---|---|
| Identity graph | What do we know? | Cross-device linkability: connect the dots into a profile, split into collected / derived / inferred |
| Journey path | Where did the data go? · How did they learn it? | Every arrow is a decision: five questions per hop, with the boundary derived from zones |
| Observers | Who knows it? | The visible page versus the invisible observers; the email that reads you |
| Password → passkey | How did the user prove identity? | The trust model changes; recovery, sync and sign-in metadata remain |
| Identifiers | What identifier links this activity? | Stable versus scoped identifiers, and those that appear across journeys |
| Boundary lanes | Did it leave the device? · Why? | On device / private compute / service / third party |
| AI routing | the same, for AI | Where intelligence runs is a privacy decision |
| Selective disclosure | Can we prove this without revealing that? | Age proof; relay addresses; derived fraud signals with a signal-utility table |
| Join | Should these datasets be joined? | Two legitimate tables, one new exposure |
| Agent | What can this system infer? | Authorized data + authorized data ≠ unlimited authorized inference |
| Agent privileges | What can this agent do? | Tool scope, actions, approvals, guardrails |
| Consent timeline | Did consent propagate? | Local control PASS, system control FAIL |
| Deletion | Can we delete it? | Every copy, with evidence |
| Retention | How long does it live? | Required / declared / observed |
| Control chain | Did the control really work? | Intended / actual / evidence per hop. Chains cover tenant isolation (including *filtering ≠ isolation* and the report that is almost entirely correct yet still wrong), consent, deletion, access, sign-in, linkability, mail, payments, disclosure, routing, agents and logging |
| Changes | What changed? | Since the last review, filtered by surface and concern |
| One account, one life | What if the account is stolen? | Browser, mail and wallet on one account add up to one life. Four attackers (a scammer, an extension, infostealer malware, a SIM swap), what each reaches, why a one-time code does not stop it, and what the control leaves |
| Worst day | What is our worst day? | A band, never a score, and the safeguards that move it |
| Five-year archive | Can this data be recovered? | 2026 → 2029 → 2031: the dependency chain (archive, K-2026, PK-2026, SCHEMA-v14, NORMALIZATION-v3, token mapping, lineage) as recorded today, if everything is kept, or if the historical keys are destroyed; what must still be possible (recover, match, produce, preserve, verify, delete, make unrecoverable) |
| Transformations | What is required to recover it? · Can we still match this person? | Encrypted (dataset → key → owner → key store → recovery path), hashed (no decrypt, but a known value can be transformed and compared), keyed pseudonym (repeatable only with the historical key and rule), tokenized (the vault and its mapping) |
| Key destroyed | What happens if the key is destroyed? | What each key protects, whether an active hold covers it, and any plaintext copies |
| Legal hold | What is under legal hold? | Normal versus preserved lifecycle; what the hold preserves besides bytes; the future-usability questions |
| Delete vs preserve | Can we prove the hold worked? | A deletion request meets an active hold (suspended in scope, logged), and a released hold (deletion resumed, verification) |
| Control chain | Can we prove the data became unrecoverable? | Key destruction: KMS event, key state, decrypt attempt, key-material copies, plaintext copies |

## Across time: recoverability, preservation and key lifecycle

The graph follows data across systems; this lens follows it across time. It is not a separate product: seven questions in the question selector, three concerns, and these records in `graph.js`, which exist so a privacy engineer can see dependencies, not to manage keys:

- `G.keys`: key_id, type, owner, store, created, rotated, destroyed, status.
- `G.transforms`: for each sensitive dataset or identifier, the transformation (plain, encrypted, tokenized, hashed, keyed pseudonym, aggregated, crypto-shredded), algorithm class, version, normalization rule, key, recoverability (fully, with key, through the token vault, matchable but not reversible, irreversible, unknown), and where it is, why, who can access it, when it should become unrecoverable, any hold, and the proof.
- `G.tokenMap`, `G.holds` (LH-901 active, LH-877 released), `G.archive` (the five-year scenario), `G.preserve` (delete vs preserve) and `G.chains` (key destruction, legal hold, hold release).

Transformation and recoverability stay off the main graph. They appear when the question asks across time, in the deletion view, in the identity views when the concern is identity, recoverability, legal hold, key lifecycle or deletion, and on **Evidence → Datasets over time**. The one-way functions on screen are illustrative, so the matching demonstrations compute real results; the records name the algorithm class a system would use. Legal hold is an engineering workflow here, not legal advice.

## One privacy model, two experiences

The essay *Every Arrow Is a Decision* explains the arrows; this lets you follow them. What both agree on is written once, in **`/articles/every-arrow/shared.js`** (`EA_SHARED`): the canonical entities and relations, the evidence labels (Documented · Setting · Limit · Test · Unknown), the shared phrases, the essay's twenty-eight review questions word for word, the TLS visibility table, the "Try this" line per product, the essay sections' deep links, the concepts this links back to in the essay, and twenty questions both must answer. Vendor claims stay in `/articles/every-arrow/compare.js` (`EA_CMP`), which this page now loads too: nothing here restates a claim.

The views live in **`modes.js`** (`window.PCC_MODES(api)`, called once by `app.js`):

| View | Route | What it does |
|---|---|---|
| Products | `#products?pr=&co=&fa=1` | The essay's eight products from `EA_CMP`: company, lens, every claim with its label and source. The arrow to watch is highlighted; *Follow this arrow* opens the SYNTHETIC pattern behind it (what moves, identifier, observer, purpose, copies, retention, control, evidence, failure boundary) and a link to the synthetic version |
| Everyday arrows | `#everyday?e=&et=&eco=&dv=&connect=1` | The events layer (moved here from the Command Center; old `#cc?e=…` links follow it), *Connect to location history* on “Ask AI about the flight”, and *Many ecosystems*: devices plus mail, payments and AI from other providers, and the seven join points |
| Every layer | `#layers?hop=` | Seventeen hops, person to archive; six questions per hop with their lens; the guarantee and where it stops; the TLS, HTTP, DNS and log panels |
| Future | `#future?tf=&goal=` | Eight transformations × eight goals, recoverability class and what each depends on; then the existing transformation, archive, key and hold views on Northstar data, and the preservation lifecycle with *Can we open / interpret / match / prove / delete it?* |
| AI / agents | `#ai?am=&rk=` | The agent runtime (user → model → retrieval → tools → join → inference → action → memory), six risks, ten controls starting from Northstar's guardrail records; a risk is covered only by the control it needs. Plus the existing inference, privileges and routing views |
| Reviews | `#reviews?rv=lens|qa|gov|changes|features` | The four-lens review (the essay's 28 questions; Yes / No / Unknown / Not applicable / Needs evidence → findings, decisions, evidence needed, follow-up tests); QA templates with status from Northstar controls and the essay's tests, all NOT RUN; governance: every copy of one person and a register with ten overlays; *What changed?* before/after for each change and the thirteen triggers; the original feature reviews |
| Evidence | `#evidence?ev=claims&ek=` | Adds the evidence labels and every documented claim, filterable by kind and lens |

**Documented and synthetic never mix.** Vendor content wears a solid blue *Documented vendor information* band; Northstar and conceptual architecture wear a hatched *Synthetic — no company implementation is implied* band. A Test is a recommendation and is never shown as run.

**Deep links from the essay** use `?view=`: `?view=product&product=browser`, `?view=layers&hop=tls`, `?view=journey&event=bought-coffee`, `?view=future&mode=hashing`, `?view=review&lens=qa`, `?view=ai&mode=agent`, `?view=ecosystems`, `?view=evidence`. `M.fromView` turns them into the routes above.

**Read the explanation.** Findings carry *why it matters · mitigation · evidence needed · related arrow · related review question · essay context* (per concern, `CN` in `modes.js`), and views link to the essay paragraph that explains them (`X.concepts`).

`tests/sync.test.mjs` opens every shared question, phrase and essay link here and checks it answers; `articles/every-arrow/tests/edition4.mjs` checks the essay side.

## Sensors & wearables: the data subject may not be the user

Ambient computing starts arrows nobody clicked. **`sensors.js`** (`window.PCC_SENSORS`, created by `modes.js`) adds the **Sensors & wearables** view (`#sensors?sm=…`) and two things elsewhere. Everything in it is SYNTHETIC: device kinds carry a "-like" label ("Echo-like speaker"), and nothing describes how a real product works. Vendor claims appear only where `compare.js` cites them (Products → *Ambient & wearable*, Ask privacy), under the Documented band.

| Scenario | `sm=` | What it shows |
|---|---|---|
| What the device saw | `cafe` (flagship) | Smart glasses in a café, asked "What does this menu say?": what the owner intended, what was required, what the sensors observed, what is incidental; a sensor filter (`sf`); four designs (`alt` A–D: whole frame, crop, on-device text, all on device) and what each does to every observation; the trade-offs (utility, latency, accuracy, exposure, cost — words, not scores); sensor → observation → derived → inferred; minimisation for sensors |
| The room | `room` | The dinner table (device owner ≠ data subject), the voice assistant hop by hop with seven questions (`hop2`), and the false activation test (always NOT RUN) |
| Did not forget | `forget` | Delete the raw audio; switch on which derivatives "delete" reaches |
| Bystander gap | `gap` | Phone camera vs camera glasses, and awareness per flow (`aw`): owner awareness, bystander awareness, indicator, setting, consent or authorisation, purpose — Clear · Partial · Unclear · Not applicable · Unknown. No legal conclusions |
| Under attack | `attack` | Twelve adversary paths for a speaker, a doorbell or glasses (`dev`): what each reaches and the control that narrows it |
| One home | `home` | Nine devices from seven ecosystems and the twelve join points between them |

**Sensed is not collected.** Every observation wears one state: Ephemeral on device · Transmitted · Stored · Derived only · Persisted · Unknown.

**Whose data?** (`ds`: Everyone · Me · Household · Contacts · Bystanders · Children · Employees) highlights, with an outline and a label (never by dimming), the flows about that group: in the Sensors scenarios, in the **Ambient morning** tab of Everyday arrows (`et=amb`, `by=1` shows bystanders: a partner, a child, a guest, the delivery driver, a passer-by, a pedestrian, the barista, coworkers), and on the events graph (records about contacts, the household or bystanders, `SUBJ_NODES`).

Also: a **Sensor** hop at the start of Every layer; four QA templates (false activation, indicator matches capture, delete the source and check the derivative, settings after an update — no Northstar control records them, so they read NOT RUN); fifteen Ask privacy questions; and `?view=sensors&mode=cafe|room|forget|gap|attack|home` and `?view=journey&mode=ambient&bystanders=1` from the essay. `tests/sync.test.mjs` checks the twenty ambient sync questions and the scenarios' promises.

## Events layer

Above the selector sentence sits the **Events** layer: ordinary things a person does, and what each one sets in motion, as one chain:

> EVENT → IDENTIFIER → SYSTEM → DERIVED DATA → INFERENCE

It lives in `events.js` (data and logic) and the `EVENTS LAYER` section of `app.js` (drawing). Focus mode hides it; the workspace below is unchanged.

- **Families and colour.** 31 kinds of event (the 26 everyday ones, plus phone unlocked, email read, ad shown, phone linked to computer and devices on the home Wi-Fi) in ten families: identity (blue), communication (purple), location (green), payments (gold), device (teal), cloud & files (sky blue), AI (violet), search/ads/analytics (orange), security (red), your controls & deletion (grey). Colour marks dots, bars and lines only; text always wears the ink tokens.
- **Four tabs.** *A morning* (the 8:02–9:30 timeline), *Use cases* (fourteen scenarios), *All events* (every kind, grouped by family), *What changed?* (six review events, unreviewed ones in red).
- **The graph.** Clicking an event highlights everything it touched, drawn in its family colour. Node styles: collected solid, derived striped, inferred dotted, shared outside outlined with ↗, deleted or expired faded and struck through (always with a text label too). A connection belongs to the events whose chains name it (`evs` in `E.compose`), so a shared ID never makes one event the source of another's data.
- **The inspector** answers the seven questions for the event or the whole set (*What do we know? How do we know it? Why do we need it? Who receives it? How long do we keep it? What can be inferred when it is combined? Can we separate it again?*), each labelled FACT, INFERENCE, RECOMMENDATION or UNKNOWN, and lists every connection as a button.
- **Why is this connected?** Click a line in the graph, or a listed connection: purpose, needed (Required / Useful / Optional), identifier used, retention, who can use it, and whether the contexts can be separated. Then *Keep connection · Scope it · Shorten retention · Separate contexts*. `E.evaluate` recomputes what survives each decision: scoping a service's ID breaks joins across services, but not what one service can see alone; shortening a history breaks inferences that need it (`hist`); separating removes everything that depended on it. Decisions last for the visit and are never stored.
- **Ecosystems.** *All · Apple-like · Google-like · Microsoft-like* relabel the same pattern with familiar product categories (`L` on each system) and show the one identity in front of the services. The structure is identical in every view (a test checks it), so it is never a comparison. Every connection, identifier, retention period and inference is illustrative and describes no company's products; the page says so whenever an ecosystem is chosen.
- **Mixed devices.** People mix platforms: an iPhone-like phone, a Windows-like laptop, an Android-like tablet, a Mac-like work computer, a Linux laptop with no platform account. The fifth ecosystem option, *Mixed devices*, and the *Devices across platforms* use case add a **Your devices** picker (phone, laptop, tablet; `dv` in the URL, e.g. `ios.win.androidtab`). `E.devAccounts` works out which platform account each device signs in to and which devices each account sees; `E.devCase` builds the use case from the mix. The point it shows: mixing platforms does not stop the linking, it moves it from one platform account to what runs everywhere (the browser account, your email address, the apps, the phone link, the home Wi-Fi). Watches, TVs, cars, speakers, consoles, work laptops and shared tablets are listed as other devices that join the same way. **The device mix is the only thing that changes the graph's shape, and only in that use case**; ecosystems, *Mixed devices* included, only relabel.
- **Use cases** add panels: what only appears when events are combined (every AND-join in `needs`), what the assistant receives for one answer (with *Leave out* per source), four different reasons (run, measure, personalize, advertise), after “Delete the account” (deleted vs kept by law, for security, in a backup, or out of reach), a permission months later (months computed from the dates), what is inside a photo file, and whose activity it is (UNKNOWN).
- **URL state.** `et` (tab), `e` (selection), `eco` (ecosystem). *Review in the workspace* sets the selectors from the event's `cc` preset; a test checks every preset survives the surface rules.

### Extending the events layer

1. **A node:** add it to `E.nodes` with its kind and the answers “Why is this connected?” needs (`why`, `need`, `use`, `ret` as `[label, days]`, `enough`, `short`, `who`, `sep`, `onDel`). An inference that joins things lists them in `needs`, and only appears in a set that names it in `inf`.
2. **A kind of event:** add a `T(...)` to `E.types` with its chain of `from>to` node ids (`ev` is the event) and a `cc` preset.
3. **A use case:** add a `C(...)` to `E.cases`; an event can override (`chain`) or extend (`add`) its type's chain.
4. **A change:** add to `E.changes` with the edges it adds and the edge it is about.

Keep the language plain: “These two services can recognize the same person”, not the jargon; a test scans every answer for it.

## Extending the graph

Everything is in `graph.js`, and every record cites node ids.

1. **Nodes and edges.** Add to `G.nodes` (`[type, name, note]`) and relate them in `G.edges`.
2. **A journey.** Add to `G.journeys`, and to `G.relevance` for each surface it belongs to. Each hop has:
   - a zone: device, private, service or third;
   - what moved, what the receiver can observe, and the identifier and its scope;
   - why, and whether that is needed;
   - a state and a security control, plus an optional control id.

   The journey then appears in the journey selector and in the path, boundary, observer and identifier views automatically.
3. **A finding.** Add to `G.findings` with:
   - a class;
   - the questions (`v`), surfaces (`s`) and concerns (`c`) it answers;
   - the lens (`l`) and the records it cites.

   Add a persona line (`p`) when the four roles should read it differently. Every question × surface combination must still have 3–5 findings; the tests check this.
4. **A control.** Add to `G.controls` with its invariant, where it is enforced, its last test, result and method. It appears on the Evidence page, and in any control chain that lists it in `CTL_LIST` in `app.js`.
5. **Numbers.** Never type one into a view. Counts and percentages are computed from these records.

Keep it fictional. Never add a real company as a Northstar system, vendor or partner.

## Tests

```
PW_CHROMIUM=/path/to/chromium A11Y_DEPS=/path/with/playwright node privacy-command-center/tests/run.mjs
```

The suite checks:
- the first screen;
- every question on every surface and journey;
- persona wording;
- local versus system failure;
- tenant isolation;
- the five questions on every arrow;
- the 2026 surfaces (passkeys, selective disclosure, AI routing, mail, agents);
- lenses;
- Ask privacy (including honest UNKNOWN);
- saved views;
- forwarding legacy links;
- focus mode, the keyboard and phone width (every view at 390px, with nothing cut off or hidden in a sideways scroll: wide drawings have tall phone layouts, tables stack);
- the absence of hiring language and of any privacy score;
- the events layer (`tests/events.test.mjs`): every everyday event and family, highlighting recomputed from each event's own chain, the five node styles, “Why is this connected?” and what each decision breaks, plain language in every answer, ecosystems that relabel without changing the shape, the use-case panels, valid review presets, keyboard access, phone width, and axe on the layer in nine states (needs `axe-core` beside Playwright in `A11Y_DEPS`, as CI installs).

v10 keeps its own suite at `v10/tests/run.mjs`.
