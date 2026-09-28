# Every Arrow Is a Decision — field kit

From *Every Arrow Is a Decision: A Visual Field Guide to Privacy Engineering*, edition 2.0 (revised 28 September 2026), by Paddy Iyer.
https://paddyspeaks.com/articles/every-arrow-is-a-decision.html

> A privacy policy is a promise written in human language. Privacy engineering is the machinery that makes it remain true after the data starts moving.

## The six questions, for every piece of personal data

1. Why do we have it?
2. Where did it come from?
3. Where does it go?
4. Who can see, join or infer from it?
5. When will it disappear?
6. Can we prove the first five?

If you cannot answer, the uncertainty is the finding.

## The review on one page

| # | Question | Red flag | Evidence to ask for |
|---|---|---|---|
| 1. VALUE | What customer outcome needs data? | “We might need it later.” | The customer outcome in one sentence, and the metric that shows it |
| 2. DATA | Exactly what enters the system? | Free text, full URLs, raw payloads. | A field list with tiers — by what each field reveals |
| 3. IDENTITY | Can it be linked to a person? | A durable ID shared across features. | The identifier used and its scope; the joins it is allowed |
| 4. FLOW | Where does it travel? | Unlisted SDKs, logs, exports. | A flow diagram in which every arrow has a purpose, retention and owner |
| 5. ACCESS | Who can see or join it? | Warehouse-wide read by default. | Access groups for each store; how access is granted and expires |
| 6. TIME | How long does raw data remain? | No TTL, or “until deleted.” | The TTL per field, and the job that enforces it |
| 7. MISUSE | What secondary use is possible? | Security data readable by ads. | The uses that are ruled out, and the control that rules them out |
| 8. REDUCE | What can we remove or enforce? | Controls that live only in a doc. | The conditions, each linked to a control and its evidence |

Tier data by what it reveals, not by column type: T0 public · T1 internal · T2 personal · T3 sensitive · T4 special.

## Every decision record names

Owner · Reviewer · Approver · Expiry (a date or a trigger) · Evidence (what shows, on a schedule, that each condition holds).

## Checklist

### Before launch

- [ ] Every field tiered by what it reveals; T3+ justified in writing.
- [ ] Identifiers scoped to the purpose; cross-purpose joins listed and approved.
- [ ] Every arrow has a purpose, retention, owner and control.
- [ ] Purpose checked at read; consent read at use, not cached from collection.
- [ ] Retention enforced by a job; raw → derived → aggregate chosen.
- [ ] Deletion, access, correction and objection wired to every store, vendor and AI store.
- [ ] Vendors: fields allow-listed, contract terms mapped to checks, transfer basis recorded.
- [ ] AI: training data, prompts, memory, embeddings and tools inventoried; human approval for irreversible actions.
- [ ] Worst-day estimate written; sensitive contexts (children, health, location, biometrics, employees, people at risk) called out.
- [ ] A decision record with owner, reviewer, approver, expiry and evidence.

### On every change

- [ ] New T3+ field, consumer, purpose, join, destination, region, subprocessor or model feature? Reopen the review.
- [ ] Contract updated and the gate green — or a time-boxed, logged exception.
- [ ] Deletion and rights registries updated for any new store.

### Every week

- [ ] Privacy SLOs reviewed by their owners; unknowns treated as findings.
- [ ] Canary identities checked: opted-out and deleted canaries absent everywhere.
- [ ] Assumption tests run; failures routed to owners.

### When it breaks

- [ ] Stop processing at the source; preserve evidence in place.
- [ ] Scope people and systems by lineage; brief counsel and the accountable executive early.
- [ ] Remediate every copy; verify; add the guard; write the record.

## In the Privacy Command Center

- One person, no name → [One Person](https://paddyspeaks.com/privacy-command-center/#/explore/person) — Every fact and inference about Dana, with its join path
- Two harmless tables → [Identities](https://paddyspeaks.com/privacy-command-center/#/explore/identities) — Identifiers, their scope, and the joins between them
- Eight questions → [Privacy reviews](https://paddyspeaks.com/privacy-command-center/#/privacy/reviews) — The eight answers per feature, and launch blockers
- Every arrow → [Lineage & flows](https://paddyspeaks.com/privacy-command-center/#/explore/flows) — Every flow as a privacy object, including unreviewed ones
- Purpose at use → [Purpose](https://paddyspeaks.com/privacy-command-center/#/privacy/purpose) — Purpose findings and mismatched reads
- Harm, not just breach → [Threat models](https://paddyspeaks.com/privacy-command-center/#/privacy/threats) — LINDDUN across the riskiest flows
- The burn button → [Tracking](https://paddyspeaks.com/privacy-command-center/#/privacy/tracking) — SDKs and pixels, and whether they ask
- The enforcement ladder → [Controls & evidence](https://paddyspeaks.com/privacy-command-center/#/assurance/controls) — Each control’s rung and health
- Consent is state → [Consent](https://paddyspeaks.com/privacy-command-center/#/privacy/consent) — Propagation latency per consumer
- Rights as workflows → [Individual rights](https://paddyspeaks.com/privacy-command-center/#/privacy/rights) — Requests, deadlines and slow systems
- Retention → [Retention](https://paddyspeaks.com/privacy-command-center/#/privacy/retention) — Declared versus observed age per dataset
- Forget me → [Deletion](https://paddyspeaks.com/privacy-command-center/#/privacy/deletion) — Deletion verification across every system
- Vendors → [Vendor register](https://paddyspeaks.com/privacy-command-center/#/governance/vendors) — Vendors, subprocessors, transfers and attestations
- AI, ML and agents → [AI & agents](https://paddyspeaks.com/privacy-command-center/#/privacy/ai) — The model and agent inventory
- Signing in → [Access & insider](https://paddyspeaks.com/privacy-command-center/#/assurance/access) — Unusual access and break-glass use
- Your worst day → [Worst Day](https://paddyspeaks.com/privacy-command-center/#/privacy/worstday) — Blast-radius simulation per dataset
- PETs and budgets → [PETs & DP](https://paddyspeaks.com/privacy-command-center/#/privacy/pets) — Control alternatives and the ε ledger
- Change breaks reviews → [Drift](https://paddyspeaks.com/privacy-command-center/#/assurance/drift) — Privacy-impacting changes and the reviews they reopen
- Privacy observability → [Observability](https://paddyspeaks.com/privacy-command-center/#/observability) — Privacy SLOs, control health and evidence freshness
- Incident response → [Incidents](https://paddyspeaks.com/privacy-command-center/#/assurance/incidents) — Incidents, broken assumptions and guards

Northstar and Dana are fictional; Northstar's data is synthetic. Nothing here is legal advice.
