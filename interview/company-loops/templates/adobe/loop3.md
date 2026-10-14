# Adobe · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of creative,
document and marketing software: creative apps that save cloud documents and
share libraries, PDF and e-signature services, and generative features that
attach content credentials. Every workload, number, limit and schema is
hypothetical; product rules are this exercise's rules (check current docs), and
nothing here describes how the company's own systems are built.

## ADB-L3-01: Cloud documents as data — versions, named versions, sharing, comments and the document on a date

| | |
|---|---|
| **Template ID** | ADB-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / immutable version lineage, restores, effective-dated access grants, comments anchored to versions |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "documents": {"1": ["40 million"], "2": ["300 million", "600 million"], "3": ["1.5 billion", "3 billion"]},
  "autosave_minutes": [2, 5, 10],
  "unnamed_retention_days": [30, 60, 180],
  "collaborators": ["5", "25", "100"]
}
```

**Business Scenario.** Creative apps on desktop, tablet and phone save design files as cloud documents; about {{documents}} of them exist. While a document is being edited the app autosaves a new version about every {{autosave_minutes}} minutes; a user can also save a version by hand and give any version a name. Under this exercise's rule (check current docs), named versions are kept for as long as the document exists and unnamed versions are deleted after {{unnamed_retention_days}} days. A user can restore an older version, which becomes the newest version without deleting anything after it. The owner can share a document with up to {{collaborators}} people as viewer, commenter or editor, or turn on a link that anyone with it can open; access can be changed or revoked at any time. Collaborators leave comments pinned to a spot on the canvas of a particular version, reply to them and resolve them. Product analytics, support and the owners' own "version history" panel all read from your model, and analytics never reads what is inside a document: only ids, sizes, counts, timestamps and the app that saved it.

**Problem Statement.** Design the data model for cloud documents and their history. Cover: documents, versions (keys, lineage, kind: autosave, manual, restore), names on versions, the pointer to the current version, retention and what a deleted unnamed version leaves behind; sharing grants with roles and link sharing, kept so that "who could open this document on a given date" is answerable; comments and replies anchored to a version, and what happens to them when the version they point at is deleted or the document is restored. Then show how to answer "what did this document look like, and who could edit it, on 1 March", and the analytics facts that answer "versions per active document per day by app", "share of documents shared outside the owner's organisation", and "median time from a comment to its resolution".

**Constraints.** A saved version never changes. A restore never deletes or rewrites newer versions. Access history must be reconstructable for any past instant, for support and for audits. Document contents (layers, text, images, file names chosen by the user) never enter analytics tables; component sizes and counts may. Deleting unnamed versions under the retention rule must never break a comment, a name or a restore.

**Assumptions.** Volumes, intervals, retention and collaborator limits are hypothetical. A document has one owner, who may belong to an organisation account. Version contents are stored elsewhere as files referenced by an id; this question is about the metadata that describes them. Clocks on devices drift, but every version gets a server commit time when it is accepted.

**Clarifications.**
- Q: Do two devices editing at once create branches? | A: Not in this exercise. The service accepts versions one at a time per document; a save based on an older version is still appended, and the app records which version it was based on.
- Q: Does "the document on 1 March" mean the latest version committed by then? | A: Yes: the newest version whose server commit time is at or before that instant, which may be a restore of something older.
- Q: Is a link share a grant to a person? | A: No. It is a grant to anyone with the link, with its own role, and it can be turned off and on again. Model it so that both kinds appear in "who could open it".
- Q: Can a comment be moved to a newer version? | A: The app shows comments from earlier versions on the current one when the spot still exists. You decide how the anchor is stored.
- Q: Does a renamed version keep its old name anywhere? | A: Support wants the history of names, yes.

**Hints.**
1. Treat versions as an append-only lineage: each row points to the version it was based on and, for a restore, the version it restored. "Current" is derived from commit time, never a mutable flag you trust alone.
2. Sharing is a set of effective-dated grants (valid_from, valid_to) per principal and role, including a link principal; "who could open it at time t" is an interval query.
3. Retention deletes the stored contents of an unnamed version; the metadata row can stay as a tombstone so that names, comments and lineage still resolve.

**Follow-ups.**
1. Write the query (in words or SQL) for "the version current at instant t" and "everyone who could edit at t", including a link share that was on at t.
2. A comment was pinned to a version that retention has now deleted. What does the comment's row point to, and what does the history panel show?
3. With autosave every {{autosave_minutes}} minutes, estimate version rows per day across {{documents}} documents if 3% are edited daily for two hours. Which facts do you keep at version grain, and which are daily aggregates?
4. The owner moves the document to another person who is outside their organisation. Which rows change, which stay, and how does "shared outside the organisation" change for past months?
5. An audit asks for every person who could open a document over the past year, including through links shared onward. What can and can't your model prove?

**Follow-up rules.**
- when: is_current, current flag, latest_version column → ask: A restore and an autosave are accepted within the same second from two devices. How does a flag stay right, and how do you answer "current on 1 March" after it has been flipped many times since?
- when: permissions table, update the role, overwrite → ask: An editor was downgraded to viewer last week. Support asks whether that person could edit on the day a layer disappeared. How does your model answer?
- when: delete the version, hard delete, purge → ask: A comment, a version name and a restore all point at a version that retention removes. What exactly is deleted, and what row is left for them to point at?
- when: comment, comments, anchor → ask: The anchored spot no longer exists in the current version. Where does the comment live, and how is "time to resolution" measured for it?
- when: link, public link, anyone with the link → ask: A link was turned off and on again, and someone opened the document in between from an old browser tab. What did your grants record, and what does access history show?

**Production Reality Check.**
- The retention job deleted unnamed versions older than {{unnamed_retention_days}} days by removing their metadata rows. Comments pinned to those versions disappear from the history panel, and restores of a later version fail because its base version is missing.
- An app release autosaves every few seconds instead of every {{autosave_minutes}} minutes for documents left open. Version rows per document jump fifty-fold in a day and the "versions per active document" metric moves with them.
- Sharing changes were applied by updating or deleting grant rows in place. On a document shared with {{collaborators}} people, a removed collaborator's row was deleted, and an audit for the previous quarter shows the document as never shared with that person.

**Evaluation Criteria.** Versions as an immutable, append-only lineage with based-on and restored-from references; current version derived from commit time; names as their own history; retention removing contents while keeping a tombstone row; effective-dated grants for people and links; comments anchored to a version and region with a defined carry-forward rule; the as-of queries for content and access; analytics facts at stated grains with no contents; each incident traced, contained and guarded.

## ADB-L3-02: E-signature agreements as data — participants, signing order, delegation, reminders and audit events

| | |
|---|---|
| **Template ID** | ADB-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / participant sets and order, delegation lineage, append-only audit events, content-free analytics |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "agreements_per_month": {"1": ["2 million"], "2": ["15 million", "30 million"], "3": ["80 million", "150 million"]},
  "max_participants": [5, 20, 50],
  "reminder_days": [1, 3, 7],
  "audit_retention_years": [7, 10]
}
```

**Business Scenario.** Business customers send documents for e-signature: about {{agreements_per_month}} agreements a month. A sender builds an agreement from one or more documents or from a saved template, adds up to {{max_participants}} participants with roles (signer, approver, form filler, or cc who only receives a copy), and sets the order: everyone at once, one after another, or groups that go in order while the members of a group act in any order. A participant can delegate their part to someone else, who can delegate again; a participant can decline, which ends the agreement. Reminders go to whoever is currently expected to act every {{reminder_days}} days until they act. An agreement can be cancelled by the sender or expire on a date. For every agreement the service keeps an audit trail of what happened and when, which customers download as evidence and which is kept for {{audit_retention_years}} years under this exercise's rule. Customers' administrators want reports: time to complete by template and sending team, where agreements stall, how often people delegate, and whether reminders help.

**Problem Statement.** Design the data model. Cover: agreements, their documents (as references only) and the template version they came from; participant sets (groups) with their order and the participants in each, with roles; delegation as a lineage that keeps who was originally asked; reminders; and the agreement's lifecycle (draft, sent, in progress, completed, declined, cancelled, expired). Define the append-only event record that is the source for both the customer's audit trail and analytics, and draw the line between the two: what the audit trail must hold that analytics must not. Then design the analytics facts that answer the four reports above, and show how to reconstruct "which participants an agreement was waiting on at 09:00 last Tuesday".

**Constraints.** Document contents, form-field values and signature images never enter analytics, logs or this event record's analytics copy; events carry ids, types, roles, statuses, timestamps, page counts and sizes. Audit events are append-only and must be shown in their true order, with nothing missing. Analytics identifies participants only by pseudonymous ids. An agreement's state at any past instant must be reconstructable. Customers see only their own agreements.

**Assumptions.** Volumes, limits, reminder intervals and retention are hypothetical; they are this exercise's rules (check current docs). Templates are versioned: editing a template never changes agreements already sent from it. Email addresses are needed to deliver an agreement and are kept by the operational service, not by analytics.

**Clarifications.**
- Q: Does a delegate replace the original participant? | A: The delegate acts in their place, but the record must keep who was originally asked and the chain of delegation.
- Q: Can a group mix roles? | A: Yes, for example two approvers and a signer. The group is complete when every member has acted.
- Q: Who receives a reminder after a delegation? | A: The current holder, never the original participant.
- Q: What does "time to complete" start from? | A: Your choice, stated: sent time is the usual start. Say how you treat agreements that never complete.
- Q: May analytics keep email domains to group participants by company? | A: Only if you can justify it as non-identifying; many customers will object. Propose an alternative.

**Hints.**
1. Separate the plan (participant sets, order, roles, as sent) from what happened (events). The plan is frozen when the agreement is sent; each event refers to a participant slot in the plan.
2. Delegation creates a new holder for the same slot. Store it as an event with from and to, so the original participant and the chain survive.
3. One event stream can feed both the audit trail and analytics if fields are classified at the source: analytics receives an allowlisted projection, never the raw event.

**Follow-ups.**
1. Write the reconstruction of "waiting on" at a past instant for an agreement with groups that go in order. What do you read, and in what order?
2. Define "stall": which step, measured from when, and how do delegations and reminders appear on the report?
3. A template was edited while 40,000 agreements created from it were in flight. Which version does each report attribute them to?
4. A customer's auditor asks for the full trail of one agreement from {{audit_retention_years}} years ago, while analytics only keeps 2 years of events. Which store answers, and how do you prove it is complete and in order?
5. At {{agreements_per_month}} agreements a month and up to {{max_participants}} participants each, which facts do you keep at participant-slot grain, and which at agreement grain?

**Follow-up rules.**
- when: signer1, signer_2, signer columns, wide table → ask: An agreement has twelve participants in four groups, with two delegations. What does your wide row look like, and how do you query "stalled at the third group"?
- when: status column, update the status, overwrite → ask: Which participants was this agreement waiting on last Tuesday at 09:00? Show what your model reads to answer it.
- when: email, email address, name → ask: Your analytics table now holds email addresses. Which report needs them, and how would you serve that report without them?
- when: delegate, delegation, delegated → ask: A delegate delegates again and then the second delegate declines. Who declined, in the customer's report and in the audit trail?
- when: reminder, reminders → ask: How do you measure whether a reminder helped? What is the comparison, and what confounds it?

**Production Reality Check.**
- A new form-field type started copying the filled value into the event payload. For three days, values typed by signers reached the analytics warehouse for agreements across many customers.
- The reminder scheduler ran twice after a failover, so participants received two reminders every {{reminder_days}} days for a week; the "reminders sent per completed agreement" metric doubled and some customers asked whether their signers were spammed.
- Stall reports joined agreements to the current version of their template. After a large customer reordered a template's groups, last quarter's report shows agreements stalling at steps they never had.

**Evaluation Criteria.** The plan (participant sets, order, roles) frozen at send and separate from events; delegation as lineage keeping the original participant; an append-only event record with a classified, allowlisted analytics projection and no contents or field values; lifecycle states derived from events; as-of reconstruction of who an agreement waits on; facts at stated grains (agreement accumulating snapshot, participant-slot facts) with template version pinned; audit retention apart from analytics retention; each incident contained, purged where needed, and guarded.

## ADB-L3-03: Content credentials as data — provenance manifests, actions, ingredients and verification results

| | |
|---|---|
| **Template ID** | ADB-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / provenance manifests as a DAG, hash binding, recorded actions, verification as observations |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer, software-engineer |

```params
{
  "exports_per_day": {"2": ["5 million", "20 million"], "3": ["100 million", "300 million"]},
  "generative_share": ["5%", "20%", "40%"],
  "max_ingredients": [3, 12, 40],
  "verifications_per_day": ["200,000", "2 million"]
}
```

**Business Scenario.** Creative apps can attach content credentials when an image is exported: a signed provenance manifest, following a public open standard, that records which app produced the asset, the actions taken on it (for example crop, resize, colour adjustment, or a generative fill), and the ingredients it was made from (other assets, each of which may carry its own manifest). The manifest is bound to the asset by a hash of its bytes and signed with the issuing app's certificate; it can be embedded in the file, stored in a cloud and looked up later, or both. Creators choose whether to include their identity. About {{exports_per_day}} exports a day carry credentials, about {{generative_share}} of them record a generative step, and a composite can have up to {{max_ingredients}} ingredients. A public inspection tool receives about {{verifications_per_day}} requests a day: someone drops in a file, and the tool reports what credentials it found and whether they validate. Content credentials describe history and who claims to have made an asset; under this exercise's framing they are never a guarantee that the asset depicts something true.

**Problem Statement.** Design the data model for manifests and their analysis. Cover: manifests (id, the asset hash they are bound to, the issuing app and version, signer certificate, signing time, whether creator identity was included), recorded actions as rows with their order and kind (including generative steps, recorded without their prompts), ingredient relations between manifests as a graph, where each manifest is stored (embedded, cloud, both); and verification results as observations: which file was checked, when, against which trust list version, and with which outcome (valid, signature invalid, signer not trusted, asset changed since signing, no credentials found, credentials recovered from the cloud). Then show how to answer "every asset derived, directly or through ingredients, from asset X", "share of exports with a generative step by app and month", and "outcomes of inspections by outcome and week", and say what analytics must never hold.

**Constraints.** A signed manifest never changes; an edit creates a new manifest that lists the previous one as an ingredient. Verification outcomes are reproducible: the same file checked against the same trust list version gives the same outcome. No image content, prompt text or uploaded file is kept for analytics; inspected files are hashed and discarded. Creator identity appears in analytics only as a flag saying it was included, never the identity itself.

**Assumptions.** Volumes, shares and limits are hypothetical. The trust list (which signers are recognised) changes a few times a year. A file can carry no manifest, one manifest, or a chain of them. Hash functions are fixed per manifest version. Rules here are this exercise's rules; check current docs for the open standard's details.

**Clarifications.**
- Q: Does "valid" mean the image is authentic? | A: No. It means the manifest is intact, bound to these bytes, and signed by a signer on the trust list in force. Your report wording must say that.
- Q: Can two manifests share an ingredient? | A: Yes. The same stock photo can be an ingredient of thousands of composites, and an asset can be used twice in one composite.
- Q: What happens when a site strips metadata on upload? | A: The embedded manifest is gone. If a cloud copy exists, the tool may recover it by looking up the asset, which is a different outcome from "found embedded".
- Q: Are prompts recorded? | A: Not in this exercise. A generative action records which feature and model family were used, never the prompt.
- Q: Can a manifest be revoked? | A: A signer's certificate can be removed from the trust list. Earlier results are not rewritten; new checks give a new outcome.

**Hints.**
1. Manifests are nodes and ingredient relations are edges of a directed acyclic graph; because each manifest is bound to a hash of its own bytes and signed, a cycle cannot form.
2. Keep verification as an append-only observation with the trust list version it used. "Current status" of an asset is a derived view, not an updated column.
3. Lineage queries over a deep, wide graph need a closure table or bounded recursion; decide which and how it is maintained as new manifests arrive.

**Follow-ups.**
1. Write the recursive query for "every asset derived from asset X" and say how you bound it when one ingredient is shared by millions of composites.
2. The trust list removes a signer. What happens to yesterday's results, to today's dashboard, and to the share of "valid" inspections by week?
3. An inspected file has no embedded manifest but the cloud has one for the same hash. How do you record that, and how does the weekly outcome mix change?
4. With up to {{max_ingredients}} ingredients per composite and {{exports_per_day}} exports a day, estimate edges per day. Would you maintain a closure table, and at what cost?
5. A creator turns off identity for future exports. What changes in your model for past manifests, and what can analytics still report?

**Follow-up rules.**
- when: is_valid, valid column, verified flag → ask: The trust list changed yesterday. Is your flag the outcome then or now, and how do you reproduce last month's report?
- when: authentic, authenticity, proves → ask: What exactly does a valid result establish, and what would you write on the report so nobody reads more into it?
- when: recursive, recursive cte, closure table → ask: One stock image is an ingredient of 40 million composites. What does your lineage query do from that node, and how do you bound it?
- when: prompt, prompts → ask: Where would a prompt end up in your model, and how do you make sure it never does?
- when: json, jsonb, manifest blob → ask: You stored the manifest as a document. How do you count generative steps by app and month without parsing every blob each time?

**Production Reality Check.**
- A trust list update removed one signer certificate. The "valid" share of inspections fell from 92% to 61% overnight, and a dashboard that recomputed every past result against the new list rewrote three months of history.
- A popular site began stripping embedded metadata on upload. Inspections of files re-downloaded from it report "no credentials found", and a weekly report reads that as exports missing credentials, although about {{generative_share}} of those exports recorded a generative step at export time.
- A template composite reused one stock asset as {{max_ingredients}} ingredients, and creators re-exported it thousands of times a day. The nightly closure-table job ran for nine hours and the lineage view fell a day behind.

**Evaluation Criteria.** Immutable manifests bound by hash and signed, with edits as new manifests that list ingredients; actions as ordered rows, generative steps recorded without prompts; ingredients as a DAG with a lineage strategy (closure table or bounded recursion) and its maintenance cost; storage location as data; verification as append-only observations with the trust list version and precise outcome categories; "valid" never described as authenticity; identity reduced to a flag in analytics; each incident traced, contained and guarded.

## ADB-L3-04: Shared libraries linked into documents — elements, versions, links and update propagation

| | |
|---|---|
| **Template ID** | ADB-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / versioned shared elements, link placements, reverse index, staleness and propagation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "libraries": {"1": ["2 million"], "2": ["20 million", "40 million"], "3": ["150 million", "300 million"]},
  "linked_documents": {"1": ["50"], "2": ["2,000", "10,000"], "3": ["100,000", "400,000"]},
  "library_members": [3, 25, 200],
  "propagation_minutes": [1, 5, 15]
}
```

**Business Scenario.** Designers and brand teams keep shared libraries of colours, character and paragraph styles, logos and graphics: about {{libraries}} libraries, some shared with {{library_members}} members as viewers or editors. An element placed from a library into a document can be linked: when someone edits the element in the library, every document holding a linked placement should show the new version. Under this exercise's rule (check current docs), an open document picks up the change within {{propagation_minutes}} minutes and a closed one picks it up when next opened, and a user can choose to keep the old version in one document by unlinking that placement, which then becomes an embedded copy. A brand's primary colour or logo can be linked into {{linked_documents}} documents. Brand teams ask: "if I change this colour, which documents change, and who owns them?", "how many documents still show the old logo?", and "how long do updates take to arrive?".

**Problem Statement.** Design the data model. Cover: libraries, membership and roles over time; elements and their immutable versions (an edit, a rename, a delete, a restore); placements: which document version holds which element, at which element version, linked or embedded; the reverse index from an element to the documents that link it, and how it stays correct when documents are edited offline; propagation as events (update published, document notified, document applied) so that staleness and latency are measurable; and what happens when an element is deleted or a member loses access to the library. Then define "out of date" precisely and show the facts that answer the three questions above.

**Constraints.** Element versions never change once published. Edits to an element apply to linked placements in version order: a document never moves from a newer element version to an older one. A document keeps rendering even if the element is deleted or the user loses access (the document holds its last applied version). Document contents beyond placement ids and element ids never enter analytics. A brand team sees only documents shared with them, plus counts of the rest.

**Assumptions.** Library counts, member counts, fan-outs and propagation targets are hypothetical. A document can hold many placements of the same element. Document versions are recorded when saved; placements are read from each saved version's metadata. Devices can be offline for days.

**Clarifications.**
- Q: Is an edit that is reverted a new version? | A: Yes. Reverting creates a new version with the old values; version numbers only go up.
- Q: What does a document hold when its owner loses access to the library? | A: The last version it applied, now unable to update. Report it apart from documents that simply have not opened yet.
- Q: Can an element move between libraries? | A: Yes, by copy: the copy is a new element with a record of where it came from.
- Q: Does "out of date" count closed documents? | A: That is your definition to make. Say which documents count, and over what period.
- Q: Who is the owner shown to a brand team? | A: Only owners of documents shared with that team; other documents appear as counts.

**Hints.**
1. Keep the placement at document-version grain: (document, document version, placement id, element id, element version applied, linked or embedded). The latest document version gives the current state; earlier ones give history.
2. The reverse index (element → documents) is derived from placements, keyed by element, and updated when document versions arrive, including late ones from offline devices.
3. Out of date = linked placement whose applied element version is below the element's latest published version; separate "pending" (not opened since the edit), "blocked" (no access) and "kept" (unlinked by choice).

**Follow-ups.**
1. Write the query for "documents still showing the old logo" with its three categories, and say how many rows it reads at {{linked_documents}} linked documents.
2. The colour is edited and reverted within two minutes. Show the events and the applied versions for an open document and for a closed one.
3. Define propagation latency for an open document with a {{propagation_minutes}}-minute target. Which timestamps do you use, and which documents are excluded from the percentile?
4. An element is deleted while linked into thousands of documents. What does each placement row say afterwards, and what does the brand team see?
5. A designer edits offline for three days and links the logo into a new document. When does the reverse index learn about it, and what did "which documents change" answer meanwhile?

**Follow-up rules.**
- when: array of documents, documents array, list of documents → ask: The primary colour is linked into many thousands of documents. What happens to that one row on every save, and how do you answer which ones are out of date?
- when: last write wins, overwrite, latest value → ask: Two updates to the same colour arrive at a document out of order. Which one does it keep, and how does your model prevent going backwards?
- when: version number, element version → ask: Is the version number assigned by the library or by the client that edited it? What happens when two editors save at once?
- when: unlink, embedded, embed → ask: Is an unlinked placement out of date? How does your report tell "kept on purpose" from "never updated"?
- when: access, permission, member → ask: A member leaves the library. What happens to the placements in their documents, and how do they show up in the counts?

**Production Reality Check.**
- A brand colour was edited and reverted within a minute. Documents applied the two updates in different orders, and about a fifth of the {{linked_documents}} linked documents ended on the edited colour that had been reverted.
- A team library was unshared from a departing agency's {{library_members}} members. Their documents can no longer update, and the "out of date" count for the logo climbs every week with documents nobody can fix.
- Propagation latency p95 is reported as 3 minutes against a {{propagation_minutes}}-minute target, but it only measures documents that were open; documents opened days later are missing from the percentile, and brand teams see old logos in shared files.

**Evaluation Criteria.** Immutable element versions with monotonic numbering by the library; placements at document-version grain with linked or embedded state and the applied element version; a reverse index derived from placements and robust to late offline saves; propagation as events with measurable latency and a stated population; a precise out-of-date definition separating pending, blocked and kept; membership over time and behaviour on loss of access or deletion; facts and access scoped to the brand team; each incident traced, contained and guarded.

## ADB-L3-05: Agreements waiting on a signer — the current step, the holder after delegations, and hours waited

| | |
|---|---|
| **Template ID** | ADB-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / as-of state from events, delegation chains (recursive CTE), sequential steps, waits |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer |
| **Generator** | ADB-L3-05.mjs |

**Business Scenario.** An e-signature service's customers want an administrator report of agreements stuck waiting on someone. The extract you are given holds only metadata and events, never document contents: `agreements` (one row per agreement, with `signing_order` 'sequential' or 'parallel', `sent_at` NULL for a draft, optional `expires_at` and `cancelled_at`, and `status` as it was when the extract was taken at {{extracted_at}}), `agreement_participants` (one row per participant named in the agreement, with a `step` number and a `role`), and `agreement_events` (`viewed`, `reminded`, `delegated` with `delegate_to`, `signed`, `declined`). Participants are pseudonymous ids. A sequential agreement goes step by step: a step's signers act only once every signer at lower steps has signed. The extract has {{agreements}} agreements and {{events}} events.

**Problem Statement.** Write one PostgreSQL query that returns, as of `{{as_of}}`, one row per signer that an open sequential agreement is waiting on: `agreement_id, current_step, assigned_to, pending_with, hours_waiting`, ordered by `hours_waiting` descending, then `agreement_id`, then `assigned_to`. An agreement is open at the as-of time when its `signing_order` is 'sequential', it was sent at or before that time, it was not cancelled at or before it, nobody declined at or before it, it has not expired, and at least one of its signers has not signed by then. Each `signer` row is a slot. The participant holding a slot can pass it on with a `delegated` event naming `delegate_to`; a delegate can delegate again, so follow the chain, counting only delegations at or before the as-of time. A slot is signed when its holder has a `signed` event at or before the as-of time. `current_step` is the lowest step with an unsigned signer slot; return a row for every unsigned signer slot at that step, with `assigned_to` the participant named in the slot and `pending_with` its holder at the as-of time. `hours_waiting` is the time from the moment the agreement reached the current step (the latest signature at any lower step, or `sent_at` if no lower step names a signer) to the as-of time, in hours rounded to 2 decimals. Delegating does not restart the wait, and `viewed` and `reminded` events change nothing. {{level_rules}}

**Constraints.** One SQL statement (CTEs allowed). Boundaries are inclusive (a signature, delegation, decline or cancellation at exactly the as-of time has happened), except expiry. Do not use `status`: it describes the agreement at extraction, after the as-of time. In production the event table holds billions of rows across many customers.

**Assumptions.** Hypothetical schema, ids and times, all in UTC. Participant ids are unique within an agreement, delegates included; a holder delegates at most once; a delegate's id never appears in `agreement_participants`. Only a slot's holder signs or declines it. No contents, field values, names or email addresses are in the extract.

**Clarifications.**
- Q: Can I filter on `status = 'in_progress'`? | A: No. It is the status at extraction; an agreement completed or cancelled since the as-of time was still waiting then.
- Q: Does a delegation reset the wait? | A: No. The wait is the agreement's wait at that step, measured from when it reached the step.
- Q: If step 1 is signed exactly at the as-of time, which step is current? | A: The next signer step, with 0 hours waited.
- Q: Who is `pending_with` if a delegation happens after the as-of time? | A: The holder at the as-of time, so the delegation is ignored.
- Q: Should parallel agreements appear? | A: No. Only sequential agreements wait on one step at a time.

**Hints.**
1. Build the state from events filtered to the as-of time first, then decide which agreements are open.
2. A recursive CTE starting at each signer slot and joining `delegated` events on the current holder walks the chain; the last holder is `pending_with`, and a `signed` event by any holder in the chain completes the slot.
3. The current step is a MIN over unsigned slots; the time it was reached is a MAX over the signatures at lower steps, falling back to `sent_at`.

**Follow-ups.**
1. Why can't `step = current_step - 1` find the moment the current step was reached? Give a case from the data.
2. Turn this into a daily snapshot table of waiting slots for the last 90 days. What is its grain, and how is it rebuilt when late events arrive?
3. At billions of events, how would you avoid walking delegation chains from scratch for every report?
4. An administrator wants the same report for agreements with groups whose members act in any order inside each group. What changes in the query?

**Follow-up rules.**
- when: status = 'in_progress', status column, where status → ask: The status column was written when the extract was taken, two weeks after the as-of time. Which agreements does that filter drop, and were they waiting at the as-of time?
- when: recursive, with recursive → ask: What stops your recursion, and what would happen if the data contained a delegation cycle?
- when: step - 1, current_step - 1, lag( → ask: The step before the current one names only cc rows, or the numbering skips. Where does your wait start then?
- when: delegated_at, delegation time → ask: Does handing the slot to someone else change how long the agreement has waited? What would the sender expect to see?
- when: occurred_at < → ask: An event at exactly the as-of time: has it happened? Show the comparison you wrote.

**Production Reality Check.**
- A customer's report, built on the extract's status column, showed no stalled agreements for a week that had dozens; every one of them was completed by the time the extract ran at {{extracted_at}}.
- After a bulk delegation tool reassigned thousands of slots twice in a row, a report that followed only one hop sent reminders to people who no longer held the slot.

**Evaluation Criteria.** State rebuilt from events up to the as-of time, never from the status column; open agreements filtered by sent, cancelled, declined and expiry with exact boundaries; delegation chains followed (recursive CTE) only up to the as-of time; slots signed by any holder in the chain; current step as the lowest unsigned signer step and the wait from the latest lower signature or sent_at; cc rows and parallel agreements excluded; deterministic ordering; can explain snapshots, chain materialisation and grouped orders.
