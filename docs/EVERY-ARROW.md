# “Every Arrow Is a Decision” — editions 2 and 3: audit, architecture and how it is built

`/articles/every-arrow-is-a-decision.html` was rebuilt on 2026-09-28 (Claude Code
session, at Paddy's request) from edition 1 (2026-09-26), Paddy's field guide
(`docs/Privacy_Engineering_Visual_Field_Guide.pdf`) and the Privacy Command Center.
**Edition 3 (2026-09-29)** added Chapter 5, “The house is a data system” — see §0.
This file is the audit of edition 1, the architecture of editions 2 and 3, the
fact-check logs, and the rules for editing it. Read it before touching the essay or
`articles/every-arrow/`. The Command Center side is in `docs/PRIVACY-COMMAND-CENTER.md`.

## 0 · Edition 3: the house is a data system (2026-09-29)

**The request (Paddy):** expand the thesis past the application boundary — the home,
vehicle, network, room and household are data systems, and some arrows open doors —
without discarding the strongest edition-2 material; add a Connected Life area to the
Command Center; then (mid-session) a table of engineering solutions, one per problem.

**The enlarged model.** Enterprise privacy draws Person → Data → System → Vendor. The
household adds: Person → Household → Place → Device → Sensor → Account → Network →
Cloud → Integration → Vendor → Inference → Automation → Physical action. Every arrow
answers **fourteen questions** (who initiated it, who it is about, who consented, raw
data, inferable data, local/cloud, joining identity, boundaries crossed, physical
action, who can read or replay, retention, revocation, failure behaviour, evidence).
`null` = nobody at Northstar can answer = a finding.

**One dataset.** The household lives in `privacy-command-center/v10/data-life.js`
(`NS.life`) and reaches the essay through the generated `northstar.js` (`EA_NS.life`):
people and their eight roles (device owner, administrator, data subject, household
member, guest, bystander, installer, vendor operator), places, rooms, devices,
sensors (`sense`), accounts, networks (8 contexts × 8 tracked things), 11 arrows, 6
routines, 23 physical-action paths in 10 capabilities, 10 inferences (the inference
registry), 6 transitions × 6 layers × 3 levels of care, 8 offboarding workflows, and
the 10 **engineering answers** (`L.solutions`, Paddy's table). The same file also adds
Northstar Home to the organisation: a BU, teams, product, 7 features, 10 systems, 7
datasets, 14 flows, two fictional partners (Keystone Monitoring, CodeHand), 7 controls
and tests, 11 findings (PRV-0301…0311), risk R-10, promises PR-DOOR and PR-HOMEDATA,
decisions D-110 and D-111.

**Real platforms.** Dana's household owns devices from real ecosystems (a voice
assistant, a phone maker's home app, a thermostat ecosystem, Matter). In the dataset
they are described by kind, never as Northstar vendors or systems (CLAUDE.md rule).
The essay names them only where it cites their own documentation, and says which
behaviour is configurable. **It never says assistants exchange recordings**: the
structure test fails on that claim, and requires the sentence saying none of the
join paths needs it. Matter multi-admin shares device state and commands, not audio.

| Scene | Figure (`house.js`) | Human moment | Core line |
|---|---|---|---|
| 24 One home. Three clouds. | `model` (the graph grows, 14 answers) · `homegraph` (12 join mechanisms → 6 household facts) | Tuesday, 6 p.m.: three ecosystems, one house | Alexa does not need to whisper to Siri. The identity graph can introduce them. |
| 25 The guest never clicked Accept | `guest` (8 people × 7 rooms on the plan) | Ines, the babysitter, 15:30 | The account owner agreed. Everyone else was just in range. |
| 26 When privacy opens the door | `door` (8 cases through identity → authentication → authorisation → automation → action → record; apply the control) | 20 Oct outage; a deleted code still works | When software controls a door, privacy architecture becomes physical architecture. |
| 27 The routine nobody reviewed | `routine` (actions × 5 controls; compounding risk, simplified model) | 20 Sep 16:52 disarm; 23 Sep “Prenatal appointment” read aloud | A routine is a program with the keys. |
| 28 The network is a witness | `network` (8 networks × DNS / private address / VPN) | 3 Oct, clinic portal on library Wi-Fi | The network may not read every letter, but it can still see the envelope… |
| 29 The house made an inference | `infer` (10 streams → 10 claims, with registry fields) | Ruth's “late mornings” | The house doesn't have to be told. That is why it has to be governed. |
| 30 The old owner still has the keys | `oldkeys` (6 transitions × 3 levels of care × 6 layers) | 14 Oct, Theo's old phone becomes Mira's | A factory reset clears the device. The keys live everywhere else. |

Then **The rest of a connected life** (17-row field guide: cars and rentals, wearables,
TVs, printers, trackers, sync and mirroring, family accounts, USB charging, resale,
tenants, recovery, stalkerware and abuse, monitoring, break-glass, end of support,
agents) and **The engineering answers** (Paddy's table, with the essay scene and
Command Center page for each). The essay now ends on the thesis — a person does not
live inside one application — and the five closing lines ending “Every arrow is still
a decision.” The structure test checks both.

**Fact-check (2026-09-29).** Four research passes checked ~50 claims against primary
sources; the egress proxy blocked the primary domains, so every item was confirmed
through search listings of the primary page (said in the Sources note). Corrections
that shaped the text: Amazon ended the local-processing option on three Echo models
(28 Mar 2025); Alexa's own help does not say voice ID misrecognises, Google's does
(“a voice that sounds like yours…”); Amazon Household is now Amazon Family; the FTC's
public-Wi-Fi advice says connecting is “usually safe”; juice jacking has no confirmed
cases (FCC) but ChoiceJacking (2025) is real and patched; the FTC rental-car advice
dates from 2016; the NYC tenant law bans tracking tenants *outside the building*;
GM/OnStar order finalised January 2026; ECH is RFC 9849 (March 2026); CDT's figures
come from “Hidden Harms” (2022) — the essay cites “Off Task” (2023) instead. Re-check
before a major revision: the Alexa/Gemini help pages (changing with Alexa+ and Gemini
for Home), the FTC Wi-Fi page date, Cyber Trust Mark status (ioXt since April 2026).

**Visual direction.** Plans, chains, receipts and tables — no padlocks, holograms or
stock drama. The requested **warm editorial photography** (real homes, libraries,
cars) was not generated: invented photographs would be illustrations posing as
documentary images. Open for Paddy — a shot list, if he wants to commission or take
them: a kitchen counter with a speaker and a school bag (scene 24); a front door at
15:30 with a key-code pad (25); a lock and a phone on a hall table (26); a garage
entry at dusk (27); a library table with a laptop (28); an older woman's kitchen in
morning light (29); a phone being handed from an adult to a child (30). Each would sit
above its scene's figure, with the plan or chain as the overlay.

**Numbers.** 6 chapters · 30 scenes · 41 figures · full path ~92 min · executive ~12 min ·
PDF 112 pages (all stamped by the build).

## The one idea

> Privacy engineering is not paperwork surrounding a system. It is the machinery
> that makes a promise remain true after the data starts moving.

Everything is organised around one argument (the prologue's thesis box) and one
fictional person, **Dana**, a customer of the fictional company **Northstar**,
followed from sign-up (3 Sep) to deletion (2 Nov).

---

## 1 · Audit of edition 1

### Content
| Finding | Edition 2 |
|---|---|
| 15 "scenes" read as separate mini-articles; numbering broken (two "08", a "02·B", eyebrows 01–14 against "15 scenes"). | Five chapters (See · Decide · Build · Prove · Field kit), 23 numbered scenes, one person throughout. |
| Counts disagreed: meta "Fourteen interactive scenes", hero "15 scenes", homepage "Fifteen", engine comment "six stories" (seven existed). Reading time "29 min" was a guess. | Every count and reading time is computed by the build and stamped everywhere (hero, contents, colophon, JSON-LD, `article_metadata.json`, `/articles/` card, homepage). CI fails on drift. |
| Dana was a customer in the cold open and a finance lead in the sign-in story; the Command Center's person was "A.". | Dana is one customer everywhere: family TV, opt-out, Nova, sign-in, decline, rights, deletion. The Command Center's One Person is Dana. |
| Citations only in a distant list. | Inline source chips beside each claim; the Sources list is generated from the same registry; CI fails on an uncited source or an unknown key. |
| No labels for what was real, modelled or invented (only "Illustrative" in a few notes). | Seven labels: real case, historical example, simplified model, synthetic data, illustrative scenario, anecdote, legal uncertainty. |
| Missing: observability, rights beyond deletion, vendor lifecycle, provenance/change, AI/agents, incident response, governance, trade-offs, sensitive contexts, accuracy. | Scenes 04, 09, 13, 16, 17, 21, 22, 23 and field notes in 08 (sensitive contexts). Trade-off records and ownership in 09. |

### Claims corrected by the fact-check (primary sources; see §3)
- **87% (Sweeney 2000)** kept, with the caveat: an estimate of uniqueness from 1990 census data; Golle (2006) put it near 63% on 2000 data.
- **Kochava**: edition 1 said "a proposed settlement". It is settled: a 2026 stipulated order bars selling sensitive location data without affirmative express consent.
- **BetterHelp**: the $7.8M is consumer refunds, not a penalty; final order 14 Jul 2023.
- **Iraq dossier (2003)**: the Word file carried four *usernames* later matched to officials — not names.
- **Google Docs**: "no per-version delete" is only narrowly true — some Workspace editions let an owner delete a version *with all older ones*.
- **iDVD "Burn"**: one participant's recollection (Mike Evangelist, 2006) — labelled an anecdote.
- **ATT**: France €150M (Mar 2025), Italy €98.6M (Dec 2025), Germany closed with commitments and no fine (Aug 2026) — competition cases; "most people say no" replaced by a dated, method-qualified estimate.
- **"Logs are the #1 place raw data leaks"** — unsourced superlative removed (essay and Command Center).
- **Target pregnancy** — reported; the father anecdote is unverified and now labelled so.
- **DP composition** — basic composition is the loosest accounting; advanced composition and RDP/zCDP added with sources; Census 2020 figure given with its conversion.
- **Passkeys / number matching / crypto-shredding / unlearning** — each now carries its limit (recovery paths and synced-account security; number matching is not phishing-resistant; crypto-erase conditions per NIST SP 800-88r2; no verification guarantee for approximate unlearning).

### Interactions
| Finding | Edition 2 |
|---|---|
| Several figures were decoration (cold-open replay, static tier/LINDDUN grids, lifecycle tabs). | The cold open now teaches a decision (join policy → which inferences survive). Every figure answers five questions in a fixed lesson box: you change / the system / for Dana / the control / the evidence. |
| No reset on most figures; no deep links. | Every figure: Reset, "Copy link to this state" (`?f=<figure>:<state>`), and a written reading in an `aria-live` region. |
| With JavaScript off, most figures were empty containers. | Every figure ships a static state sequence or table, generated from the same data as the interactive version, shown until the figure's own script mounts it (so a failed script also degrades cleanly). |
| Keyboard: tablists partly wired; the retention slider needed dozens of key presses per visible change. | Arrow/Home/End on every choice group; the slider moves in meaningful steps (7, 14, 21, 30, 60, 90, 180, 365, 730 days). |
| Reduced motion handled in places. | Handled in the framework: animations off, "play" and "climb" jump to the end. |

### Print (the reported bug)
Edition 1 printed as **55 pages, 49 with no text at all** (measured with pdf.js):
the scroll-reveal (`.js .rv{opacity:0}`) never fired in print, there was no
print stylesheet, and scenes carried 136px padding and fixed heights. Edition 2
removed scroll-reveal, added a full `@media print` edition and a committed PDF
(see §4). The thinnest page of the current PDF still carries several hundred
characters; the browser test fails on any page under 300.

---

## 2 · Architecture of edition 2

**Prologue — The promise.** Thesis; Dana's sign-up and the 26 systems her deletion must reach; promise → architecture → data → control → evidence → runtime; the three hats; how to read (paths, layers, labels); Dana's autumn as a linked timeline.

| Chapter | Scenes | Corner-case trails |
|---|---|---|
| **1 · See** — what data becomes when identifiers, histories and inferences meet | 01 One person, no name · 02 Two harmless tables · 03 The history hole · 04 When the data is wrong | family TV · version 11 |
| **2 · Decide** — why the data exists, what people expect, which purpose permits the use, which trade-off | 05 Eight questions · 06 Every arrow · 07 Purpose at use · 08 Harm, not just breach (+ six sensitive contexts) · 09 Trade-offs, signed · 10 The burn button | the CSV |
| **3 · Build** — consent, purpose, retention, deletion, isolation, access as mechanisms | 11 Enforcement ladder · 12 Consent is state · 13 Rights as workflows · 14 Retention · 15 Forget me · 16 Vendors · 17 AI, ML and agents · 18 Signing in · 19 Your worst day · 20 PETs and budgets | debug flag · opt-out at 01:58 · forget me, except · Dana's week · one sentence to Nova |
| **4 · Prove** — runtime evidence, control testing, monitoring, audits, incident response | 21 Change breaks reviews · 22 Privacy observability · 23 Incident response | — |
| **5 · Field kit** | six questions · review on one page · checklist (+ Markdown download) · Command Center map · coda | — |

Each chapter opens with situation → system → consequence → control → evidence and
closes with the evidence that would prove it. Each scene has an **In brief**
(the executive path), a body, field notes (cases) and builder notes (schemas,
pseudocode) as collapsible details, a Command Center link and a takeaway.

**Reading paths.** Full (everything) and Executive (thesis, chapter arcs and
evidence, each scene's brief, the six questions; any scene can be opened in
place). `?path=exec` links to it; the choice is remembered as `ea.path.v1`
(registered in `data/platform/state-keys.json`). Reading time = words/230 plus
20 s per interactive figure (full), words/230 (executive).

**Command Center, both ways.** `D.pccMap` (essay) and `P.ESSAY` (app.js) map
20 concepts to pages; each Command Center page shows "Read the explanation in the
essay". The structure test fails if the two maps disagree or a route/anchor is
missing. Northstar numbers in the essay come from the Command Center's
`data.js` through the generated `articles/every-arrow/northstar.js` — never typed.

---

## 3 · Fact-check log (2026-09-28)

Three research passes checked every real-world claim against primary sources
(regulators, courts, standards bodies, original papers, official docs). Where the
sandbox blocked a page, the claim was confirmed from the source's own search
listing; the Sources note says so. The registry with every URL is
`articles/every-arrow/sources.js`. Worth re-checking before any major revision:
the Kochava order's entry date (reported locally as 25 June 2026), the
Italian and German ATT decisions (2025/2026), NIST Privacy Framework 1.1 (still
a draft at the time), EU AI Act high-risk dates (deferred by the 2026 omnibus).

---

## 4 · Files and how to edit

| File | What |
|---|---|
| `articles/every-arrow-is-a-decision.html` | The essay. Prose is edited here. Content between `data-static="…"` and `<!-- /static:… -->`, every `data-ea` span, `timeRequired` and asset `?v=` are **generated** — the build overwrites them. |
| `articles/every-arrow/data.js` | Every figure's data (one source for the interactive and static versions). |
| `articles/every-arrow/model.js` | The arithmetic (pure functions: SLOs, consent percentiles, change detection, incident meters…). |
| `articles/every-arrow/trails.js` | The eight corner-case stories and their engine; loadable in Node, so the build writes each trail's static version from the same `world()`. |
| `articles/every-arrow/house.js` | Chapter 5: teaching data (join mechanisms, door cases, routine model, network view, field guide), pure models, static fallbacks (`EA_HOUSE.statics`, run by the build) and the eight figures. Loads last and calls `EA.ready()`. The household itself is `EA_NS.life`. |
| `articles/every-arrow/figures.js`, `figures2.js` | Figure controllers (chapters 1–2, 3–4). Each registers `EA.fig(id, {get,set,reset,read})`. |
| `articles/every-arrow/core.js` | Framework: reading paths, contents, figure registry, deep links, details, print. |
| `articles/every-arrow/sources.js` | Source registry (build-time only). |
| `articles/every-arrow/essay.css` | Screen styles, then edition-2 components, then `@media print` and `@page` (running header, "Page N of M"). |
| `articles/every-arrow/northstar.js` | **Generated** from `privacy-command-center/v10/data.js`. |
| `articles/every-arrow/field-kit.md` | **Generated** download. |
| `articles/every-arrow/every-arrow-is-a-decision.pdf`, `pdf.json` | **Generated** printable edition and its source hash. |
| `scripts/every_arrow/build.mjs`, `pdf.mjs` | The build (and PDF renderer). |
| `articles/every-arrow/tests/structure.mjs`, `browser.mjs` | The tests. |

**After any edit** to the essay, `articles/every-arrow/*` or Northstar's data:

```
node scripts/every_arrow/build.mjs                  # regenerate fallbacks, counts, northstar.js, field kit
EA_DEPS=/tmp/ea node scripts/every_arrow/build.mjs --pdf   # re-render the PDF (needs playwright)
python3 scripts/platform_build/build.py all         # /articles/, search, feeds (reading time changed?)
node articles/every-arrow/tests/structure.mjs
EA_DEPS=/tmp/ea node articles/every-arrow/tests/browser.mjs
```
`/tmp/ea` = a directory with `npm i playwright@1.56.1 axe-core@4 pdfjs-dist@4`
(Chromium is preinstalled in the Claude Code container).

**Rules**
- Never type a Northstar number in the essay; add it to the build's stamps or render it from `EA_NS`.
- Every real-world claim gets an inline `data-src` chip and a registry entry; label anecdotes and legal uncertainty.
- Every new figure: `.fig-how`, `.fig-live`, a `.fig-static` (a `data-static` renderer in the build), `.fig-foot` with Reset/link/reading, a five-question `.fig-teach`, and a controller registered with `EA.fig`. The structure test enforces all of it.
- Never remove a legacy anchor (`#s01`…`#s13`, `#s02b`, `#sBurn`, `#job`, `#cc-*`): the Command Center and old links use them.
- Don't reintroduce scroll-reveal or anything that hides content until an observer fires — that is what broke printing.

## 5 · Tests and CI
- **Validate Content**: `build.mjs --check` (generated parts current, PDF not older than its source, counts agree) and `tests/structure.mjs` (figure contract, chapters, legacy anchors, dates, Command Center map both ways, shared vocabulary, sourcing caveats, storage keys).
- **Accessibility**: the repo's axe ratchet (essay and Command Center are strict) plus `tests/browser.mjs`: every figure by mouse or keyboard, reset, deep links, JS off and scripts blocked, reduced motion, reading paths, 320–1920 px overflow, axe in full/exec/no-script modes at 1280 and 390, print media, and the PDF (no page under 300 characters, "Page N of M", edition in the header).
- **A reveal never dims text.** Animate position or a frame, never the opacity of something a reader has to read. After #888 merged, the Accessibility job on main failed because axe caught the harm chain's third card (`#hc3`) at opacity .25→1 on a slow runner. The fix: the `.hc` text stays at full contrast and only the border and position move. `browser.mjs` now also runs axe on the harm chain mid-reveal, 60 ms after a switch.

## 6 · Open for Paddy
- The full path is honestly ~64 minutes (edition 1 claimed 29 for less). The executive path is ~9. If that is too long, the cheapest cuts are the Scene 19/20 figures' prose and some field notes.
- The homepage feature line and the `/articles/` card text were rewritten to match; check the wording.
- The share card and deck image still show edition 1's art.
