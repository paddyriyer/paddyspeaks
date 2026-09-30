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
| Journey | Sign in, Browse, Read mail, Pay, Prove age, Share identity, Use AI, Open a report, Delete account, Revoke consent | The path through the graph that the path, boundary, observer and identifier views walk |
| Question | 18 questions, from *What do we know?* to *What is our worst day?* | Which view is drawn |
| Concern | 20, multi-select | Filters findings; picks the control chain for *Did the control really work?* |
| Subject | one person, credential, feature, dataset, tenant, vendor, AI agent, product | Refines some views (one dataset → the join; one tenant → the tenant chain) |
| Lens | Privacy, Security, Both | Privacy asks *should this exist, move, combine, persist or be inferred*; Security asks *can the wrong actor access it*; Both shows where they converge: passkey, wallet ID, private compute |

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
| Worst day | What is our worst day? | A band, never a score, and the safeguards that move it |

## Extending the graph

Everything is in `graph.js`, and every record cites node ids.

1. **Nodes and edges.** Add to `G.nodes` (`[type, name, note]`) and relate them in `G.edges`.
2. **A journey.** Add to `G.journeys`. Each hop has:
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
- focus mode, the keyboard and phone width;
- the absence of hiring language and of any privacy score.

v10 keeps its own suite at `v10/tests/run.mjs`.
