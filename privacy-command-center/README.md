# Privacy Command Center

A privacy operating system for a fictional company, **Northstar**. It is built to
answer one question better than any privacy inventory:

> **Where are we breaking a promise to a person, what decision is required now,
> and can we prove the fix?**

Everything is synthetic. Northstar, its people, systems, vendors and incidents
are invented. Regulation mappings are orientation, not legal advice.

## The product model: one chain

Every record belongs to a single chain, and every page exposes it:

```
Promise → Product/feature → Purpose → Person/identity → Data → System → Data flow
        → Vendor/model → Jurisdiction → Control → Evidence → Finding → Decision → Owner
```

You can start anywhere — a promise, a person's identifier, a system, a vendor, a
product, a risk or a consent consumer — and follow the whole chain
(`#/chain?from=<id>`). An empty link is a gap, and gaps are findings.

Three ideas carry the product:

1. **Promises, not inventories.** `data-ops.js` lists what Northstar promised
   people and where. A promise's state is *derived*, never typed:
   - **broken** when an open high-severity finding or incident contradicts it;
   - **at risk** with any other open finding or a failing control;
   - **unproven** when its controls are untested or their evidence is stale;
   - **kept** only with fresh, passing evidence.
2. **Decisions, not dashboards.** Each broken promise needs a decision. A
   decision has options with pros, cons and trade-offs, a recommendation, dissent
   and uncertainty, an owner, an approver, a due date and SLA, and the test that
   will prove the fix.
3. **Proof, not assertion.** Every control has a last test, a result, evidence,
   freshness, exceptions and a next test. Every number opens the records behind
   it. Every search answer cites its records.

## Files

| File | Holds |
|---|---|
| `data.js` | What Northstar **has**: business units, teams, products, features, systems, datasets, identifiers and joins, vendors and subprocessors, flows, models, controls, findings, risks, incidents, drift, consent consumers, deletion targets, rights requests, reviews, trackers, PETs, regulations, maturity, access events, regions. |
| `data-ops.js` | What Northstar **owes** and how it **proves** it: `promises`, `decisions`, `controlTests`, `indicators` (target, owner, coverage, eight weeks of history), `perspectives`, and `person` (Dana, the fictional person every module refers to). |
| `data-operate.js`, `data-ai.js` | Module records: consent pipeline, deletion traces and rights reach; AI agents and AI-data lineage. |
| `app.js` | Entity registry, knowledge graph, metrics (each with its rule), router, drawer, trail. |
| `model.js` | The operating model: `P.chain`, `P.promiseState`, `P.explainRisk`, `P.decision`, `P.indicator`, `P.priorities`, role vocabulary, and the shared renderers (chain strip, freshness, citations). |
| `views-home.js` | Home (four questions), Promises, Chain explorer, Help. |
| `views-decide.js` | Decision memos, investigation report, trail → memo, print. |
| `views-operate.js` | Observability, consent, deletion, retention, individual rights. |
| `views-investigate.js` | Lineage and purpose, vendors and geography, AI and agents, Worst Day, risk radar. |
| `views-prove.js` | One Person, controls and evidence, privacy reviews. |
| `views-explore.js`, `views-privacy.js`, `views-assurance.js` | The remaining original views (organization, graph, identities, tracking, PETs, threats, audits, incidents, drift, regulations, maturity, reports). |
| `intel.js` | Search (`/` or Ctrl/⌘ K), the analyst, the guided tour. Every answer cites its records. |
| `personas.js` | The fifteen roles and the role picker. |
| `pcc*.css` | Styles. `pcc-print.css` is the print and PDF layout. |
| `tests/` | Behaviour tests in headless Chromium (`tests/run.mjs`). |

## Roles

The same records serve every role. A role's *perspective* decides three things:
- which decisions it can make;
- the words used;
- which evidence is shown first.

It never hides the truth.

| Perspective | Roles | Acts by | Sees first |
|---|---|---|---|
| Leadership | CPO, CISO, CTO, Executive/Board | **Decide** — approve trade-offs, fund, accept or refuse residual risk | people affected, consequence, options, cost |
| Managers & owners | Engineering Manager, Product Manager, Data Governance | **Assign / Schedule** — owners, sprints, launch holds | open issues, due dates, blockers |
| Oversight | Privacy Counsel, Compliance, Internal Audit | **Challenge** — attest, dispute evidence, require re-test | control tests, evidence freshness, legal basis |
| Builders | Privacy, Data, Software, Security, AI/ML engineers | **Fix** — ship the change and the test that proves it | the failing test, systems, flows |

## Extending the synthetic dataset

1. **Add the record** to the right collection in `data.js`, `data-ops.js` or — for
   Northstar Home and the household — `data-life.js`, and
   reference other records by id. The registry, graph edges, chain, search and
   passports pick it up automatically.
2. **Add a promise** to `NS.promises`: text, where it was made, audience,
   features, purposes, datasets, controls, findings, risk, decision and owner. Its
   state is computed; do not store one.
3. **Add a decision** to `NS.decisions`: at least two options, each with pros,
   cons and a trade-off. Also give it a recommendation, dissent or uncertainty,
   owner, approver and the `test` that proves the fix (tied to a control).
4. **Add a control test** to `controlTests` for every new control. A control
   without one shows as *never tested*.
5. **Add indicator history** to `NS.indicators[id]` when you add a metric: seven
   past weekly values, target, direction, owner and coverage. The current value is
   always computed.
6. Keep it fictional, and never type a number into a view.

Run the tests after any change:

```
A11Y_DEPS=/path/with/playwright node privacy-command-center/tests/run.mjs
```

`A11Y_DEPS` is a folder where `playwright` is installed (CI installs it for the
accessibility workflow). Set `PW_CHROMIUM` to a Chromium binary if Playwright's
own is not installed.
