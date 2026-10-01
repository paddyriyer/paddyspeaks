# Privacy Command Center (v1)

**One privacy graph. Many lenses. Progressive disclosure.**

The Command Center answers, for a fictional company called Northstar:

- what the system knows, and how it knows it;
- how the person proved who they are;
- what left the device, and who received it;
- what was joined, what was inferred, and what can act;
- which control was supposed to stop it, and whether we can prove it still works.

Everything is synthetic. Surfaces are conceptual ("web / browser", "wallet / payments") and describe no company's implementation.

The earlier full explorer is kept, unchanged, at `v10/` as **Northstar Privacy Explorer (v10)**, with `noindex`. Old `#/…` links to `/privacy-command-center/` are forwarded there by the first script in `index.html`.

## The screen

A sentence of five selectors, then one workspace:

> I am a **[persona]** looking at **[surface]** when someone **[journey]**, asking **[question]**, concerned with **[concerns]**.
> *about* **[subject]** *through the* **[Privacy | Security | Both]** *lens*

The workspace has three sections:

- **Graph:** the view of the privacy graph this combination resolves to, with the governing principle shown above it.
- **Findings:** three to five findings, each classified as FACT, INFERENCE, UNKNOWN or CONTROL FAILURE, and each citing graph records.
- **Decision:** risk, why it matters, mitigation and evidence needed. Executives get issue, options, recommendation and residual risk instead.

Global navigation is four items: **Command Center · Reviews · Evidence · Ask privacy**. Consent, deletion, passkeys, AI and the rest are selector values, not pages. Saved views (under *Views*) are selector presets. **Focus mode** hides everything except the selectors and the workspace, and offers three walkthrough presets.

## Selectors

| Selector | Values | What it changes |
|---|---|---|
| Persona | Reviewer, Builder, Auditor, Executive | Emphasis only: finding wording, the order of the decision fields, and the executive format. The data never changes. |
| Surface | All, Identity & authentication, Web / browser, Mail / communication, Wallet / payments, Digital identity, Cloud / data, Analytics, AI / agents, Third parties | Which findings apply, what each view emphasizes, and the default journey |
| Journey | Sign in, Browse, Read mail, Pay, Prove age, Share identity, Use AI, Live on one account, Open a report, Delete account, Revoke consent | The path through the graph that the path, boundary, observer and identifier views walk |
| Question | 26 questions in two groups: *What is true today* (19, from *What do we know?* to *What is our worst day?*) and *What must still be possible in the future?* (7) | Which view is drawn |
| Concern | 24, multi-select, including recoverability, legal hold / preservation and key lifecycle | Filters findings; picks the control chain for *Did the control really work?* |
| Subject | one person, credential, feature, dataset, tenant, vendor, AI agent, product | Refines some views (one dataset → the join; one tenant → the tenant chain) |
| Lens | Privacy, Security, Both | Privacy asks *should this exist, move, combine, persist or be inferred*; Security asks *can the wrong actor access it*; Both shows where they converge: passkey, wallet ID, private compute |

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
- the absence of hiring language and of any privacy score.

v10 keeps its own suite at `v10/tests/run.mjs`.
