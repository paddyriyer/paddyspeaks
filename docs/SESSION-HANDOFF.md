# Session Handoff — where we left off

_Last updated: 2026-09-05 (Can You Really Afford the Bay Area?). This file is the running memory between Claude Code
sessions (the web container clones fresh each time). CLAUDE.md points here._

## TL;DR of current state

- **NEW (2026-09-05): `articles/can-you-really-afford-the-bay-area.html` is published** —
  a ~13.5k-word data-driven visual investigation in twelve parts: whether an
  ordinary professional family could build *and protect* a middle-class life in
  Santa Clara County in each decade from 1960 to 2026. Category `personality`,
  42 min, dated 2026-09-05. Homepage sidebar + deck card added by hand; filter
  counts bumped to **All (147)** and **Personality Development (3)**; sitemap
  entry added.
  - **All arithmetic is reproducible and was computed, not estimated by eye.**
    The anchor is a modelled representative 4-bedroom house (county median
    single-family sale price × ~1.10), 20% down, 30-year fixed, every decade.
    Headline results: price-to-income 2.6 in 1960 → 13.1 in 2026; total annual
    housing cost 28% of median income in 1960 → **104%** in 2026; the down
    payment goes from 5 months of median income to 2 years 8 months.
  - **The strongest finding, and the one to preserve if the piece is ever
    edited:** the rate needed on today's $1.84M loan to reproduce 1980's
    burden (53% of median income) is **3.03%** — i.e. almost exactly the 2020
    rate. The 2020–21 window made a $1.8M loan *behave* like a 1980 mortgage;
    remove it and principal is the binding constraint. Corollary line:
    "You can refinance a rate. You cannot refinance a principal."
  - **Data-integrity scheme is load-bearing.** Every figure carries one of four
    tags — FACT / ESTIMATE / MODELLING ASSUMPTION / SCENARIO — explained in a
    legend near the top. The 1960 and 1970 county rows are explicitly the
    softest (±15%) and say so. **Do not quietly upgrade an estimate to a fact.**
  - **One deliberate modelling choice worth keeping:** maintenance is modelled
    as a *physical* cost (~$4.30/sq ft/yr in 2026 dollars, CPI-deflated and
    scaled to house size), **not** as 1% of purchase price. Roofs do not get
    more expensive because land does; the 1%-of-price rule over-reserves badly
    in the Bay Area because you are reserving against dirt.
  - **Central concept introduced: YEARS OF FINANCIAL FREEDOM** — accessible
    assets (cash + taxable, excluding retirement and home equity) divided by
    essential annual burn. The Part XI pair have net worth within 3% of each
    other ($3.2M vs $3.3M) and freedom of **1.4 years vs 10.5 years**. If the
    article is ever excerpted, this is the idea to lead with.
  - **Ten illustrations, all hand-authored inline SVG** in the article itself
    (no build step, unlike The Interview Room). Editorial newspaper style:
    hatched money stacks, stick figures, no photorealism. All are XML-valid —
    `validate_content.py` is strict on changed files, so keep them well-formed.
  - **Share card and homepage poster are generated**, not hand-drawn:
    `images/articles/can-you-really-afford-the-bay-area/source/make_cards.py`
    authors both as SVG and renders `share-card.png` (1200×630) and
    `poster.webp` (800×860). Re-run after `pip install cairosvg pillow`; the
    container only has Liberation/DejaVu fonts, which is why the script names
    those explicitly rather than Newsreader. Do not hand-edit the outputs.
  - **Research caveat for future sessions:** `WebFetch` was blocked for every
    domain by the egress proxy in this session, so primary sources could not be
    opened directly — figures were confirmed via `WebSearch` result summaries
    and are cited to the primary source they originate from. Anything in the
    Sources section is worth spot-checking against the live source before it is
    quoted elsewhere.

- **NEW (2026-09-04): `articles/the-interview-room.html` is published** — a
  ~19k-word fictional screenplay in fifteen acts: a staff-level escalation
  interview at the fictional **Northstar Data Platforms** between hiring
  manager **Alex Morgan** and candidate **Jordan Lee**. Category `technology`,
  55 min, dated 2026-09-04.
  - **Everything in it is fictional and is labelled as such** in three places:
    the notice block near the top, the closing disclaimer, and the JSON-LD
    (`"genre": "Fiction"`). No real company, product vendor or person is named
    or implied — that constraint was explicit and must be preserved if the
    article is ever edited. Open-source project names (Spark, Kafka, Airflow)
    are fine; commercial vendors are not.
  - **Fifteen illustrations are generated, not hand-written HTML.** The source
    of truth is `images/articles/the-interview-room/source/make_plates.py`,
    which authors each plate as SVG and renders a 2x PNG (kept in `source/`)
    plus the `plate-*.webp` the page loads, plus `share-card.png` and
    `poster.webp`. Re-run it after `pip install pillow cairosvg`; do not edit
    the webp files by hand.
  - Article CSS is a self-contained screenplay system: `.slug`, `.dir`, `.cue`
    (with `.cue--a` / `.cue--j` for the two characters), `.beat` for rapid-fire
    exchanges, `.term` for log/plan blocks, `pre.ascii` for diagrams, and the
    `.panel--test` / `.panel--weak` pair that closes most scenes.
  - Homepage: sidebar card + deck card added by hand (per CLAUDE.md, `index.html`
    is never regenerated). Filter counts bumped to **All (146)** and
    **Technology (77)**; sitemap entry added.

- **NEW (2026-09-03): Song 02 of the Devotional Music series is published.**
  `devotional-music/caranamule-nammiti/` — *Caraṇamulē Nammiti*, rāga Kāpi,
  Ādi. The collection is now **13 keertanas and 13 ragams** (counts appear in
  the hub header tags, the "All 13" filter button, the section intro, the
  JSON-LD description, and the homepage card — update all of them together).
  - **The article's thesis:** repetition as *bhāva intensifier*, not esoteric
    code. Six verses, each ending in one word said three times (varadā, ayyā,
    caraṇamu, paṭṭiti, ayyā, dāsuḍa). Key line: "The dictionary has not
    changed. The heart has."
  - **Three genuine textual findings, all TEXTUAL-labelled and worth keeping:**
    1. Every caraṇam ends on the bare `nī divya` — an adjective with no noun —
       which completes only on the return to the pallavi. Same antādi joinery
       as Rama Dayajudave.
    2. In caraṇams 2, 5 and 6 the repeated word is **extracted from the
       preceding word**: sēyakum-*ayyā* → ayyā ayyā; rāv-*ayyā* → ayyā ayyā;
       rāmadāsu*ḍa* → dāsuḍa dāsuḍa. A suffix breaks free of its grammar and
       becomes pure address.
    3. The **mudra dissolves**: the signature is Bhadrāchala Rāmadāsuḍa, and
       the word that repeats is the tail of his own name. Place-name and god's
       name fall away; the common noun *servant* is what is left.
  - **Textual variant preserved, not normalised:** caraṇam 2 reads *ādi puruṣa*
    in some sources and *ādiśēṣa* in others; translations of *aramara* (అరమర —
    reserve, holding back) also split on direction. Both flagged in data.js and
    in the article.
  - **`veyyāru`** is literally 1006 (veyyi + āru) but idiomatic for "countless".
    Do not over-literalise it.
  - **Kāpi added** to RAGAS + RAGA_DETAIL with the important warning that
    **Carnatic Kāpi is not Hindustani Kāfi** (Kāfi maps closer to
    Kharaharapriya itself).

- **Listening links for Song 02 are the best-corroborated so far** — four
  `kind:"watch"` entries whose indexed titles name the composition, including
  a Balamuralikrishna rendition (`T1Kk2qwo8Go`) and two that state Kāpi/Ādi in
  the title. Still **not liveness-verified** — YouTube remains blocked by the
  egress proxy. Same two-tier model and same open caveat on the page.

- **New article CSS components** (in `article.css`, reusable for later songs):
  `.triple-strip`, `.rendering`, `.seq`, `.dissolve`, `.ladder`, `.remnant`,
  `.arch`. The dissolve block is the strike-through of the mudra; the remnant
  block is the bare-words display.

- **NEW (2026-09-03, second pass): the Devotional Music section gained an
  EXPERIENCE layer.** The reference material was kept; what was added turns it
  into somewhere you can also hear the music. Three layers now: sahityam (what
  he said) / sangitam (how the music carries it) / anubhavam (what you may
  experience).
  - **Per song (all 12):** `beforePlay` (a 2–4 sentence emotional preparation),
    `keyWord` (the one word that holds the song — literal / colloquial /
    spiritual / why), `cues` (3–5 listening cues, 45 total), `listening`
    (recordings), and `modern` on 5 of them (a restrained contemporary
    reflection — deliberately NOT self-help).
  - **New hub views:** `#listen` (Paddy's Listening Room — reader-journey strip
    + a 6-column index table) and `#voice` (Ramadasu Is Not Praying Politely —
    a 9-stage progression from asking to seeing, plus the Navaratna arc).
    The Tradition view gained Concert Hall vs Bhajan Hall and Why These Songs
    Survived. A quiet coda closes the page, after all scholarship.
  - **Deep links now support `#<view>` as well as `#kriti-<id>`** (see
    `applyHash` in app.js). The article links to `../#listen`.
  - **EVIDENCE LABELS — the important new discipline.** Every esoteric reading
    carries `evidence`: TEXTUAL (supported by the sahityam) / TRADITIONAL
    (established commentarial tradition) / INTERPRETIVE (a PaddySpeaks
    contemplative reading). 44 in data.js, 16 more in the article. Every
    listening cue carries `provenance`: text / tradition / rendition, so a later
    performance practice is never presented as Ramadasu's own mark. **Keep
    labelling new entries — this is what protects the interpretations'
    credibility.**
  - **Absolute claims were audited and softened** ("no other composer…",
    "the tradition reserves…", "the only…", "alone in this set…"). Ragam
    `bhava` fields were reworded from "X means sadness" shapes to "often used
    for…". Do not reintroduce rasa-as-property phrasing.
  - **Ragam sections deepened:** each of the 12 now has `prayogas`, `jiva`,
    `gamaka`, `distinguish` (the scale-neighbour it is confused with) and
    `withText`. Note the Dhanyasi vs Suddha Dhanyasi warning.
  - **Corrections made this pass:** Kantinedu Ma Ramula is **Khanda Chapu**,
    not Adi (per the Nedunuri notation volume). The Navaratna ORDER was
    verified against that volume and matches: Adigo → Sri Rama Namame → Paluke
    → Divyanama → Ramajogi → Taraka → Hari Hari Rama → Takkuvemi → Kantinedu.
    The emotional arc built on it is presented as **interpretive**, with an
    explicit caveat that Ramadasu is not known to have composed them as a cycle.

- **⚠️ LISTENING LINKS — UNFINISHED, NEEDS A HUMAN PASS.**
  YouTube is **blocked by the container's egress proxy** (WebFetch, curl, and
  even the oEmbed endpoint all rejected), so **no recording was played or
  checked for liveness**. The link model is deliberately two-tier:
  - `kind:"watch"` (8 entries) — video id came from a search index whose
    recorded title matches the composition, and in one case the performer
    (Nedunuri + Malladi, Atana, `0HMHlarLZwo`). **Corroborated, not verified.**
  - `kind:"search"` (7 entries) — a YouTube *search* URL. Correct by
    construction, cannot rot, cannot point at the wrong thing.
  - **To promote a search link to a real one:** set `kind:"watch"` and add
    `id:"<videoId>"`. The renderer does the rest. See the header comment in the
    ENRICH block of `data.js`.
  - The page states this limitation openly in `LISTEN_CAVEAT`. **Do not quietly
    publish unverified watch links** — it would contradict the page's own
    editorial rule.
  - Still needing a corroborated recording: Sri Ramula Divyanama, Ramajogi
    Mandu, Hari Hari Rama, Rama Dayajudave, Ikshvaku Kula Tilaka, Ee Teeruga Nanu.

- **Still open from the first pass:** the Telugu script for charanams 2 and 3 of
  Rama Dayajudave was set from transliterated sources, not a printed Telugu
  edition. Worth a rasika's check.

- **NEW (2026-09-03): a Devotional Music section, built as a SERIES.**
  Lives at `devotional-music/` and is wired into `index.html` (nav-bar link +
  a hand-written section card) and `sitemap.xml`. PR #797 (draft).
  - **The shape is hub + one article per song**, not one big page. The hub
    (`devotional-music/index.html` + `data.js` + `app.js` + `style.css`) holds
    12 Ramadasu keertanas including all 9 Navaratnas, with Telugu text,
    transliteration, meanings, ragam/talam and esoteric commentary. Five views:
    Keertanas, Ragams (12, with arohana/avarohana), The Composer, The Tradition
    (sampradaya bhajan + glossary), Search.
  - **`article.css` is the shared skin for every future song article** — reuse it
    rather than writing a new stylesheet per song.
  - **Song 01 is live:** `devotional-music/rama-dayajudave/` — an 18-part
    long-form article (glance card, composer, text in four layers, sahitya deep
    dive, three-level esoteric reading, daya, ragam + tala, version comparison,
    kriti-vs-nama, nama mahima, listening cues, mudra, research note, listening
    room, related songs, reflection, sources).
  - **EDITORIAL RULES — keep them if you add songs.** They are written into the
    header comment of `data.js` too.
    1. Ramadasu left *sahityam*, not notation. Every ragam carries a
       `ragaConfidence` of `established` or `varies`; where sources disagree,
       show the disagreement (Rama Dayajudave is sung in Bhairavi, Dhanyasi AND
       Keeravani). Never silently pick one.
    2. Reproduce lyrics only as far as they can be corroborated. Say where the
       text stops; never invent a charanam, ragam, tala or anecdote.
    3. Songs by other composers that get misattributed to Ramadasu go in
       `MISATTRIBUTED`, never in `KRITIS`. Already caught: **Ksheerabdhi
       Kanyakaku** (Annamacharya) and **Nanu Palimpa** (Tyagaraja).
    4. Pallavi of Rama Dayajudave follows the better-attested
       `bhadrachala dhama` reading; the `bhadrachala rama` variant is noted.
    5. Devotional legend (the mohurs) is told as tradition, not as history.
  - **Design brief:** ivory/sandalwood, deep maroon, muted temple gold,
    restrained saffron; line-drawn SVG motifs only (gopuram, tambura, jalra,
    lamp). No deity imagery, no neon, no giant Om. A full-page ruled
    "manuscript" texture was tried and **removed** — it banded across body text.
    Don't reintroduce it.
  - **Next songs** would naturally be Paluke Bangaramayena, Ee Teeruga Nanu, or
    Ikshvaku Kula Tilaka; the goal discussed was 15–20 Ramadasu articles, not
    just the famous concert pieces. Each new article should also get a
    `sitemap.xml` entry and an `article` field on its kriti in `data.js` (that
    field is what renders the "Read the full article" CTA on the hub card).
  - **Open question for a rasika:** the Telugu script for charanams 2 and 3 of
    Rama Dayajudave was set from transliterated sources, not a printed Telugu
    edition. Worth a check.

- **NEW (2026-08-27, revision pass): the Spark track was hardened after review.**
  Eight fixes, all verification and readability — deliberately no new topics.
  - **Added `#refs`, a References & version notes appendix.** Maps each question
    to the Apache Spark doc page that answers it, plus a version-caveat table
    (AQE default-on from 3.2, `REBALANCE` from 3.3, ANSI default in 4.0, Storage
    Partition Join's per-release support, structured logging, serializer, Arrow).
    **The doc URLs could not be verified from the container — `spark.apache.org`
    is blocked by the egress proxy.** Only long-stable canonical paths were used;
    click through once before promoting the page anywhere.
  - **Removed absolutes the page could not defend.** "Every problem lives at
    exactly one level" now says every incident has a *primary* layer, with an
    explicit cascade example (skew → spill → disk → GC → heartbeat → executor
    loss → FetchFailed). "Spill is the only honest memory metric" now reads as
    *most actionable*, alongside Peak Execution Memory. Partition-pruning advice
    now says function-wrapping and type coercion *can prevent or weaken* pruning
    and tells the reader to check `PartitionFilters` rather than assume.
  - **Fixed an AQE inconsistency in four places.** "AQE cannot split what was
    never divided" contradicted the page's own skew-splitting material; all four
    now say coalescing merges, skew handling can split an *eligible* partition,
    and neither rescues a uniformly under-partitioned stage.
  - **Corrected two counts.** The TOC now holds exactly 30 numbered parts with
    artifacts and references as separate coda links. The drill count was wrong in
    both directions at different times — the real figure is **39 (21 inline + 18
    dedicated)** and the strip now says so.
  - **Breathing room + print styles.** Interview boxes, config tables, the matrix,
    case files and runbook cells all got larger type and more padding; a
    `@media print` block keeps cases and drills from splitting across pages.

- **NEW (2026-08-27): Interview Studio gained a Spark track** —
  `interview.app/spark/index.html`, a ~480 KB self-contained deep-dive: "The Spark
  Pipeline Debugging & Performance Engineering Handbook". It sits in the **Learn**
  hub alongside Performance / Dashboarding / AI Engineering, and is a full Studio
  page (`studio.css` + `.netflix-prep` skin + track-local Spark-orange styles).
  - **30 parts** — triage, UI + log forensics, memory, GC, skew, shuffle, joins,
    driver, CPU, files, partitioning, storage-partition joins, caching, sizing,
    stragglers, network, disk, SQL anti-patterns, data-quality look-alikes,
    regressions, cost, the scientific method, a 34-row troubleshooting matrix,
    20 case files, 33 interview drills, a config reference, observability and
    prevention — closing with three one-page artefacts (decision tree, UI cheat
    sheet, production runbook).
  - **31 original inline SVG diagrams**, all token-driven (`.dg-*` classes) so
    dark mode works without a second palette. Every one validated as well-formed
    XML by `.github/scripts/validate_content.py`'s SVG check.
  - **Editorial rules baked into the page — keep them if you edit it.** Every
    environment-specific claim carries a label: `Apache Spark default`,
    `Platform-dependent`, `Workload-dependent heuristic`, `Version-dependent`.
    Vendor defaults (Databricks / EMR / Glue / Dataproc / Synapse) are never
    presented as Apache defaults, and the page repeatedly tells the reader to
    verify in the Environment tab rather than trust a quoted default. Where a
    value has moved across the 3.x line (AQE skew thresholds, memoryOverhead
    factor, serializer) it is deliberately NOT stated as a number.
  - **Wiring:** added to `interview.app/partials/nav.html` (Learn hub, desktop +
    mobile) then propagated with `python3 interview.app/build_nav.py` — 34 pages
    updated, do not hand-edit the nav in individual pages. Pillar card
    `hp-feat-card-19` added to `interview.app/index.html`. `sitemap.xml` entry
    added. A `next-card` cross-link added to `interview.app/performance/`.
  - **Layout note:** wide artefacts (`.matrix-scroll`, `.fig.wide`, `.sheet`)
    break out of the 980 px reading column above 1080 px via negative margins,
    and every plain table becomes its own scroll container below 860 px. Verified
    zero horizontal page overflow at 390 / 1400 px in light and dark.

- **NEW (2026-08-21, latest): article "The Subject Nobody Taught" shipped** —
  `articles/the-subject-nobody-taught.html`, category `personality`, self-contained
  (inline CSS/SVG/JS). A visual essay on financial literacy as a missing school
  subject.
  - **The supplied artwork is used WHOLE. Never crop, trim, or re-frame it.** An
    earlier pass cut the images into plates and icons and was reverted at the
    author's request. Every `plate-*.webp` is a straight, aspect-preserving
    conversion of its file in `source/`; only `plate-flywheel.webp` is resampled
    (1535 -> 1200 px wide) and nothing is cropped. If you add artwork, convert the
    whole file.
  - **The artwork is the diagram on wide screens; the HTML is the reading layer on
    narrow ones.** A single `@media(min-width:861px)` rule hides `.lifecycle`,
    `.missing-strip`, `.principles`, `.loop-list` and `.narrow-only`, so desktop
    shows the images alone and phones get real markup at a legible size. Alt text
    carries the full content either way. Do not delete the HTML versions — they are
    what makes the page work at 375px and for screen readers.
  - **Images 6 (compounding) and 7 (start early) are deliberately NOT in the page.**
    Their figures are wrong in the pixels: image 6 has garbled bar labels and a
    duplicated "Contributed $120,000"; image 7's $650,000 does not follow from
    $500/month at 8%. Their two sections use inline-SVG charts built from figures
    computed in-repo instead. **Drop the images in as plates the moment fixed
    versions arrive** — that is exactly what happened with image 9, which was
    re-supplied at 1535x1024 with TEACH restored and "INEEP" fixed, and is now the
    flywheel graphic.
  - **The financial figures are load-bearing and were verified.** $500/month at 8%
    nominal compounded monthly: 10y $91,473 · 20y $294,510 · 30y $745,180 · 40y
    $1,745,504. Contributions are $6,000/yr. The early-vs-late pair is Priya (25->65,
    $240,000 in) vs Raj (35->65, $180,000 in) — $60,000 more contributed, $1,000,324
    more at the end. If you touch a number, re-derive the SVG path data with it; the
    polyline points and the prose must not drift apart.
  - Chart labels live in **HTML positioned over the SVG**, not inside it, so they stay
    legible at 375px. The SVGs carry geometry only and use `preserveAspectRatio="none"`
    with an explicit `height:clamp(215px,30vw,360px)`.
  - Everything renders with **JavaScript off** — reveals only hide once `has-js` is on
    the root, counters carry their final values as literal text, and the chart wipe is
    `display:none` without JS and under `prefers-reduced-motion`.

- **NEW (2026-08-17, latest): community submissions were being silently dropped
  on unknown topic labels — fixed in `.github/scripts/ingest_submissions.py`.**
  The Google Form lets people type their own topic. `TOPIC_MAP` only knew
  python/sql/design variants, so rows labelled "Data Modelling" and
  "Dashboarding" hit `SKIP — unknown topic`, were marked processed, and were
  gone for good (the state file is the only dedupe). Two real submissions
  (Freddie Mac data-modeling process, Virtusa non-prod dashboard test data)
  were lost that way and have now been written by hand into
  `interview.app/evaluate/data/design.json` as `ds-new-059` / `ds-new-060`,
  `type: open`, `source: community`.
  - The map now covers modelling/dashboarding/BI/ETL/etc., and anything still
    unrecognised is routed by the wording of the question (`ROUTING`) with a
    `design` fallback. **Nothing is dropped for an unknown topic any more** — a
    mis-filed question is visible and fixable, a dropped one is not.
  - `source: "community"` is what lights up the ◆ Community badge in the quiz
    engine and floats the question on `/interview.app/whats-new/`. Anything
    added by hand from the sheet must carry it.
  - **Skill Check counts were 2 years stale** (`791` in the title/meta/schema
    vs `1656` actual, "4-section" vs six sections) because nothing refreshed
    them. `interview/scripts/update_counts.py` now derives Skill Check pool
    sizes from `interview.app/evaluate/data/*.json` too, and both question
    workflows (`weekly-questions.yml`, `ingest-submissions.yml`) run it before
    committing. Also fixed: the prerender lede said "…Snowflake and 107 other
    companies" when 107 is the total including the 8 it just named.

- **NEW (2026-08-12, latest): article "Consequences Don't Transfer" shipped.**
  Supplied as one flat infographic PNG plus a self-contained HTML draft with all
  16 images inlined as sloppy base64 crops (label chips duplicated, neighbouring
  panels bleeding in, captions clipped). Both files had junk names and are gone.
  - Artwork now lives in `images/articles/consequences-dont-transfer/` — 22
    re-trimmed WebP files on exact panel boundaries, plus the untouched
    `source-infographic.png` and a 1200x630 `share-card.png`.
  - The hero elephant and the five "why advice fails" icons have their cream
    paper knocked out (border-connected flood fill), so they float on the page.
    Do not re-flatten them onto a white box.
  - Case strips are a **justified flex row**: `--ar` on each `.ps-shot` is the
    frame's true aspect ratio, which gives all three a shared height with zero
    cropping. If you add a frame, set its `--ar` or the row will go ragged.
  - Page went 2.0 MB -> ~91 KB of HTML. Never re-inline the images as base64.
  - Re-crop script kept out of the repo; boundaries are documented by the
    filenames themselves.

- **NEW (2026-08-10, latest): hosted removal is PLANNED BUT GATED — read
  `docs/HOSTED-REMOVAL.md` before writing a line of it.** The natural next ask
  is "let users press go and we do the removals for them". Do not start that.
  **The blocker is legal, not technical.** Submitting a privacy request on
  someone else's behalf makes us an *authorized agent*, which the CCPA defines
  as a natural person or **a business entity registered with the California
  Secretary of State** — a personal blog cannot do it. Three consequences:
  a registered entity is required first; each user must give **signed
  permission** a broker may demand to see; and the broker may **bypass us and
  verify the consumer directly**, so any design must pull the user back into
  the loop rather than promise press-go-and-forget.
  - Infrastructure is the cheap part (~$150–300/month at low volume). The
    expensive parts are legal setup, insurance, and the permanent maintenance
    load of broker forms changing underneath us.
  - Two facts that should inform the decision before any code: California's
    **DROP does broker deletion free and with legal force**, so a paid
    submission service competes with the state; and form-submission is a
    commodity several companies already sell. The differentiator is the
    explanation layer already built here, not the submitting.
  - Recommended path if it goes ahead: **email-first** (a written request is
    legally valid, fully automatable, no browser, no CAPTCHA, leaves a paper
    trail), browser automation added later only for form-only sites.
  - **No decision has been made.** Awaiting a human call on the path and on
    the legal step. Nothing in the build order is safe to start before that.

- **NEW (2026-08-10, latest): the Privacy Console is LIVE at
  `paddyspeaks.com/privacy/`**, alongside the `privacy-agent/` CLI. Design
  notes: **`docs/PRIVACY-AGENT.md`**; user docs:
  **`privacy-agent/README.md`**. Read those before touching it.
  - **One engine, two front ends.** `privacy-agent/src/core/` is pure ES
    modules with zero Node dependencies, so `privacy/app.js` imports the *same*
    files the CLI does, straight from `../privacy-agent/src/core/`. That is the
    whole reason the browser scoring cannot drift from the CLI scoring — do not
    add a Node import (`fs`, `path`, `crypto`) to anything under `core/`, or
    the web app breaks instantly and silently.
  - Pure logic in `core/`: identity normalization, identity graph, match
    confidence, risk, dedupe, state machine, redaction, jurisdiction,
    removability, query generation, attack surface, `explain.js` (the four
    questions on every exposure card), `optout.js` (ranks a page's own links
    to find the removal route) and `resume.js` (below). Tests:
    **`node privacy-agent/tests/run.mjs` — 219 pass**, dependency-free.
    The Worker side is covered by **`node analytics/tests/run.mjs` — 172 pass**.
  - **`core/resume.js` — the handback is the main path, not the failure path.**
    Every removal route eventually stops and asks the user for something, and
    the strongest verification sits on exactly the sites worth removing from
    (see `docs/HOSTED-REMOVAL.md`). The console renders a "waiting on you"
    panel above the board from `resumeQueue`, ordered by risk.
    - **The instruction is rebuilt against the current clock, never stored.**
      This is the whole point of the module. The agent's blocked notes were
      written at the moment of blocking and several describe a live browser
      ("the form is open, we will enter the code"); that is true for minutes.
      `resumeFor(exposure, now)` returns "enter the code in the open window"
      while the window plausibly exists and "request a fresh code, that one has
      expired" once it does not. Freshness per block kind is in `FRESHNESS_MS`.
    - Staleness reads the blocking transition out of `history`, not
      `updatedAt` — otherwise an unrelated re-score makes an hour-old code look
      fresh. Unknown age is treated as stale on purpose: sending someone to a
      window we cannot see is the worse bet.
    - `now` is a parameter, never `Date.now()` inside the logic. That is what
      makes staleness testable; keep it that way.

  - **Invariants with tests named for them — do not "fix" these:** a name match
    alone can never confirm; absence is not evidence; `submitted` ≠ `removed`
    (the state machine forbids the shortcut); no hardcoded broker list; no
    guessed opt-out URLs (an invented `/opt-out` is a confident 404, which is
    worse than "not found"); sensitive fields (SSN/ID/licence/passport) never
    auto-fill; payment is never made; workflow templates carry no PII.
  - **The Worker DOES serve the console now** — this reverses an earlier note
    in this file that said never to wire it up. `analytics/worker/scan.js`
    provides `/api/scan` (search proxy), `/api/scan/read` (fetch one page,
    return text + links) and `/api/scan/status`. It exists because a browser
    page cannot fetch third-party sites: CORS forbids it.
    - **The identity-dossier rule is unchanged and still absolute.** The Worker
      logs nothing, stores nothing (it touches no D1 binding), and caches
      nothing (`no-store` on every response). Queries and URLs pass through and
      are discarded. No identity data is persisted server-side, ever.
    - Both transmissions are disclosed on the page itself, in the assurance
      box, in plain words — the search terms for *Scan for me*, and the listing
      URL for *Find the opt-out*. If you change what leaves the browser, change
      that copy in the same commit. A tool that quietly starts sending a home
      address while still promising "nothing leaves your browser" is doing
      exactly what the brokers do.
    - `/api/scan/read` is a fetch proxy, so `isFetchable()` is a security
      control, not a convenience check: allowlisted schemes plus a denylist of
      loopback/private/link-local/cloud-metadata hosts. Tested in
      `analytics/tests/run.mjs`. Do not relax it.
  - **`API_BASE` is `https://ps.paddyspeaks.com`, not `paddyspeaks.com/api/*`.**
    paddyspeaks.com is GitHub Pages, so a relative `/api/scan` resolves to a
    static 404 — which is exactly how the first live scan came back "0 found"
    with a row of green ticks. Same convention as `lib/ps-forms.js`.
  - Search keys are **Worker Secrets**: `BRAVE_SEARCH_API_KEY` (preferred — no
    daily cap) or `GOOGLE_CSE_KEY` + `GOOGLE_CSE_ID` (100/day). With no key the
    console says so and falls back to the paste flow; it never scrapes result
    pages. See the warning in `wrangler.toml` — a plaintext var is wiped on the
    next Git-integrated deploy.
  - **The website never submits anything, and cannot.** A page may not fill in
    or submit a form on another origin — same-origin policy, the rule that stops
    any open tab posting from your bank. So the console stops at the submit
    button by law of the platform, not by choice, and the removal engine is the
    CLI. `privacy-agent import <export.json>` carries a console session into the
    vault (`core/handoff.js`), then `run --mission` files the requests. The
    bridge deliberately refuses to inherit a `pending_removal` or
    `successfully_removed` status from the browser: the agent must witness a
    submission itself, since those two states are exactly what this project
    will not take on trust. Rejected records never cross.
  - The CLI additionally drives real Chromium and submits forms, which a static
    page cannot. Verified end-to-end against a local fixture broker with a real
    opt-out form: real submission, case number + processing window parsed,
    encrypted evidence screenshots, and the SSN field correctly blocking
    submission. `npm install` needed in `privacy-agent/` (only dep is
    `playwright`).
  - Still open, raised with the user and unanswered: hero dashboard preview
    populated from the real profile, an exposure-over-time chart (needs
    per-scan history nothing records yet), an aggregate stats bar (**must use
    the user's real numbers — never seed figures**), and a possible rename.
- **2026-08-08: Polish Sprint Wednesday — PS-05, PS-07, PS-08**
  on branch `claude/weekly-action-plan-kjgt5b`. Two new shared modules under
  `interview.app/js/`:
  - **`pg-states.js`** — the engine boot skeleton (PS-05) and the empty-state
    renderer (PS-08) for both playgrounds. Boot progress is **by completed
    milestone, not a percentage**: neither sql.js/PGlite nor Pyodide reports
    byte progress, so a percentage would be invented. Three steps —
    download, open, seed. The skeleton never paints over results already on
    screen, and SQL retires it inside `activateEngine()` (after CSV seeding),
    which is the first moment the pane can actually take a query.
  - **`pg-shortcuts.js`** — PS-07. A page declares `window.PG_SHORTCUTS`; each
    entry names a **button id**, and the shortcut clicks that real button, so
    the keyboard and the toolbar can never disagree. `?` opens the cheatsheet,
    and a `? shortcuts` affordance is injected into `.pg-editor-toolbar`.
    Bare-letter shortcuts are suppressed while typing (`isTyping()` checks for
    INPUT/TEXTAREA/SELECT/contentEditable); modifier combos still fire inside
    the editor. **Note the toolbar class is `.pg-editor-toolbar`, not
    `.pg-toolbar`** — that cost a round.
  - PS-08 also fixed a genuinely blank state: filtering the company or topic
    picker in `evaluate/index.html` to zero matches rendered **nothing at
    all** (`.cp-empty` was styled but never used). It now names the term and
    notes that existing selections stay active while hidden by the filter.
  - Remaining sprint: **Thu PS-02** (CodeMirror 6, vendored locally under
    `vendor/`, NO runtime CDN, keep textarea as the no-JS fallback), **Fri
    PS-03/PS-13/PS-12/PS-14/PS-10 + QA**.
- **2026-08-06: CareerOS shipped** — `/careeros/`, an independent design
  prototype of an "AI-native professional network" (PR #756, branch
  `claude/careeros-prototype-design-eti35a`). 46 files, ~11.3k lines, vanilla
  ES modules with no build step: `js/store.js` + `js/dom.js` + per-view and
  per-component modules, persona-driven dashboards with user-rearrangeable
  panels, explainability drawer, recruiter trust metrics, philosophy page.
  **It already exists — check before building anything CareerOS-shaped.**
- **2026-07-28: Polish Sprint Mon + Tue merged** — PR #743 (PS-01 theme
  unification, PS-09 single focus ring, PS-11 blue purge) and PR #744 (PS-04
  value-first Skill Check, PS-06 toolbar hierarchy).
- **2026-07-28: Skill Check empty-pool dead end fixed** (PR #745). A saved
  refinement of Hard + Code empties three of the six sections outright —
  **2026 Hot Topics, AI Engineering and Communication have no code-format
  questions at all** (52 / 152 / 119 questions, every one `single` or
  `multi`). Section cards with a filtered pool of 0 now drop their `href`
  entirely, and the quiz dead end offers "Clear the filter & start
  <section>", which removes the offending localStorage key. **The content gap
  itself is still open** — authoring code questions for those three sections
  is a content decision nobody has taken.
- **2026-07-28: Testimonials + Contact moved into the Studio nav** (PR #746).
  They now live in a fifth `Connect` hub in `interview.app/partials/nav.html`
  (run `python3 interview.app/build_nav.py` after editing it — 33 pages), and
  were removed from the main-site top nav on `index.html`, `about.html` and
  `resume.html`. **Footers on all three still carry both links**, as does
  About's "Send a message" CTA — nothing became unreachable.

- **NEW (2026-07-25, latest): Contact + Testimonials shipped** on branch
  `claude/paddyspeaks-contact-testimonials-4zne28`. Full write-up:
  **`docs/CONTACT-AND-TESTIMONIALS.md`** (read that first for anything here).
  - New pages: `/contact/`, `/testimonials/` (public list + share form), and
    `/testimonials/admin.html` (owner moderation console — noindex, robots-blocked,
    reuses the analytics `ADMIN_PASSWORD_HASH`).
  - Backend follows the leaderboard pattern: new route modules
    `analytics/worker/{contact,testimonials}.js` + `forms-util.js`, mounted in
    `worker.js`, on a **third D1 db `paddyspeaks-forms`** (binding `FORMS`).
    Separate because it HOLDS PII (the leaderboard db is separate because it
    must hold none).
  - Validation is a single pure module `analytics/lib/forms.js`, imported by the
    Worker and mirrored in `lib/ps-forms.js`. Tests: **138 pass** (was 57).
  - Email = **Resend** (one `fetch()`, no SDK — nothing was configured before).
  - Homepage gained a testimonial strip before the subscribe CTA; footers on
    index/about/resume gained Contact + Testimonials; Interview Studio home has a
    contextual invite at the very end (never inside a practice flow).
  - **Provisioned (2026-07-25).** D1 `paddyspeaks-forms` created
    (`d43111c5-5834-4791-b18d-b892643787c6`), schema applied, `FORMS` binding
    enabled in `wrangler.toml`, Resend domain verified (Sending on, **Receiving
    deliberately off** — it would add root MX records and could hijack existing
    mail to `@paddyspeaks.com`). Remaining: the four Worker Secrets/Vars
    (`RESEND_API_KEY` / `CONTACT_TO_EMAIL` / `CONTACT_FROM_EMAIL` / `FORMS_SALT`)
    and an end-to-end smoke test. Routes return `503 not_configured` whenever
    `env.FORMS` is missing, so they always degrade safely.
  - Gotcha for future edits: a non-UUID `database_id` fails `wrangler deploy` for
    the WHOLE Worker (analytics + leaderboard too) — that is what broke CI on PR
    #736 and why the binding shipped commented out first.
  - **No testimonials are seeded.** Both the homepage and `/testimonials/` show an
    honest "be one of the first" invitation until real ones are approved — same
    principle as the leaderboard's no-seeding rule.
- **NEW (2026-07-24): Analytics redesign — Phase 3 (complete) + Phase 4
  (Journeys & Retention)** on the same branch, restarted from main after #734
  merged. Wired `psTrack()` into simulator/flashcards/study-plan and added
  `question_started`/`answer_submitted`/`explanation_viewed` to the track engine;
  fixed a latent bug (track results are `"wrong"`, code checked `"incorrect"`).
  Added Worker **`GET /api/journeys`** (weekly retention cohorts with null
  incomplete windows + path analysis: landings/exits/transitions/cross-domain)
  and an **anomaly-detection** insight rule (≥2σ daily move). New Journeys tab
  panels in `analytics/index.html`. Tests **57 pass**; dashboard re-verified via
  headless smoke test (all 6 tabs). **All four phases of the redesign are now
  implemented.** Remaining backlog is optional: A/B bucket field, configurable
  alerts UI, deeper per-question skip/abandon analytics once those UI
  affordances exist.
- **NEW (2026-07-24, earlier): Analytics redesign — Phase 2 (decision dashboard)
  + Phase 3 start (Studio events)** on the same branch, restarted from main
  after #733 merged. Added the **6-tab dashboard** (Overview/Acquisition/Content/
  Interview Studio/Journeys/Data Quality) in `analytics/index.html` — existing
  panels preserved and tab-assigned in JS, new decision panels on top;
  **`analytics/lib/insights.js`** deterministic insight engine (pure, tested,
  never fires below sample floor); Worker **`GET /api/insights`** computing
  engaged sessions/medians/correct new-returning/source+content classes/Studio
  funnels/data-quality via the pure libs. Wired **`psTrack()`** into the quiz
  engine (`interview.app/evaluate/js/quiz-engine.js`) and track engine
  (`interview.app/js/track.js`). Tests now **55 pass** (`node
  analytics/tests/run.mjs`); dashboard verified via headless-Chromium smoke test.
  **Still TODO (Phase 3 rest + Phase 4):** wire simulator/flashcards/study-plan/
  study-day events; `question_started`/`hint_requested`/`explanation_viewed`;
  cohort tables + journey/path analysis + Day1/7/30 retention UI; anomaly
  detection. See `docs/analytics/PLAN.md`.
- **Analytics redesign — Phase 1 (Trust & foundations) on
  branch `claude/paddyspeaks-analytics-audit-refpf4`.** Additive + backward-
  compatible; historical `page_views` preserved. Full write-up in
  `docs/analytics/` (AUDIT, PLAN, EVENT-TAXONOMY, METRIC-DICTIONARY,
  DATA-QUALITY-QUERIES, DECISION-GUIDE). Key changes: tracker upgraded to v4
  (`lib/ps.js` — DNT/GPC respect, active engagement time, reliable pagehide
  beacon, scroll milestones, `window.psTrack()` event API); new versioned
  `events`/`visitors` tables + DQ columns (`analytics/worker/migrate-v6-events.sql`);
  Worker gains `POST /api/e` ingest + fixes the exit-UPDATE bug that was silently
  losing time/scroll on D1 (audit finding B). Pure logic in `analytics/lib/*`
  with 44 tests (`node analytics/tests/run.mjs`). **Deploy order:** merge PR
  (auto-deploys Worker + ships tracker), THEN paste migrate-v6 into the D1
  Console. `/api/e` no-ops safely until the migration is applied. Dead
  `analytics/tracker.js` removed. Phases 2–4 (6-tab dashboard, Studio event
  instrumentation, cohorts/journeys) are specified in `docs/analytics/PLAN.md`,
  NOT yet built — do them next, in order.
- **NEW (2026-07-23): Two learning tracks shipped — Communication and AI
  Engineering.** Both are branch `claude/interview-studio-learning-tracks-w17fey`.
  - Content is authored in re-runnable builders: `scripts/build_communication.py`
    (119 exercises, 13 modules — incl. a "Global Workplace Language" module
    decoding corporate jargon, sports metaphors and regional English) and
    `scripts/build_ai.py` (152 questions, 20
    modules). They emit `interview.app/evaluate/data/{communication,ai}.json`
    (same schema as the Skill Check) and `interview/data/questions-ai.json` (the
    Question Bank subset). `build_ai.py` also keeps `interview/data/languages.json`
    + `topics.json` in sync so **AI is a first-class Question Bank category**
    (language chip `ai`, 20 AI type facets).
  - Both tracks appear in **Skill Check** (`evaluate/` — new sections `ai`,
    `communication`), **Flashcards** (same data files), and the **Learn nav hub**
    (`partials/nav.html` → run `build_nav.py`).
  - New interactive **track pages**: `interview.app/communication/` and an added
    "Practise" section on `interview.app/ai-engineering/`, both powered by the
    shared **`js/track.js` + `css/track.css`** engine (module progress, filters
    by topic/level/role/type, bookmarks, mixed/daily practice, continue-where-
    left-off, interview-readiness score — all localStorage, `ps-track-<section>`).
  - Tests: `node interview.app/tests/track-tests.mjs` (dependency-free, 2000+
    checks). To edit content, change the builder and re-run it — never hand-edit
    the generated JSON.
- **Anonymous Community Leaderboard is LIVE** end-to-end (submit, alias, rank,
  delete all working). Backend = Cloudflare Worker + a **separate D1 database**.
- Public board is **hidden by k-anonymity until 5 real scores** exist
  (`suppressBelow: 5`). Until then the page shows a labelled **sample preview**.
- **LinkedIn launch blurb is intentionally parked** until real scores are
  flowing — the user wants organic entries first, no seeding. Write it then.

## Leaderboard — provisioning facts (already done)

- D1 database: **`paddyspeaks-leaderboard`**, id `d49bd1fd-0460-4339-b46d-94f00981a4ad`
  (bound as `LB` in `analytics/worker/wrangler.toml`).
- Schema applied from `analytics/worker/leaderboard-schema.sql`
  (comment-free copy for the D1 dashboard Console:
  `analytics/worker/leaderboard-schema.console.sql`).
- Secret **`LB_SIGNING_KEY`** is set in the Cloudflare dashboard (Worker → Settings
  → Variables and Secrets, type Secret). **Not stored in the repo.** To rotate,
  set a new random value in the same place.
- Deploys are **Git-integrated**: pushing to `main` auto-deploys the Worker
  (the "Workers Builds: paddyspeaks" check + the cloudflare bot on PRs).
- The Worker returns `503 "not configured"` unless BOTH the `LB` binding and
  `LB_SIGNING_KEY` are present — so the board degrades safely.

## Leaderboard — how it works (key files)

- `analytics/worker/leaderboard.js` — routes on `/api/lb/*`. Config in `CFG`:
  `tokenTtlMs 3h`, `minDurationS 10`, `suppressBelow 5`, `retentionMonths 12`,
  `diffMult`, `firstAttemptMult`. Aliases via `makeAlias()` (ADJ×NOUN×#NNN, CSPRNG).
  HMAC single-use attempt tokens; server measures duration; integrity states
  (valid/suspicious/under_review); k-anon suppression; per-entry deletion-token hash.
- `analytics/worker/worker.js` — mounts `routeLeaderboard()`; CORS allows
  `GET, POST, DELETE, OPTIONS` (DELETE was added to fix entry deletion).
- `interview.app/js/lb-client.js` — browser client. Deletion tokens live ONLY in
  `localStorage` (`ps-lb-entries`); sent nowhere except to delete your own entry.
- `interview.app/leaderboard/index.html` + `leaderboard.js` — the board page
  (tabs, states, sample preview, "your entries" + delete, "how your alias works").
- `interview.app/evaluate/js/quiz-engine.js` — issues the attempt token at quiz
  start; renders the consent-gated opt-in on the results screen. Guarded: no card
  appears if the backend is dormant. Only SQL/Python sections map to a category.
- `analytics/worker/LEADERBOARD_DEPLOY.md` — full deploy + rollback checklist.

## Open / deferred items (nothing blocking)

- **▶ IN PROGRESS — Interview Studio "Polish Sprint" (execute, do not re-plan).**
  Running on branch **`claude/weekly-action-plan-kjgt5b`** (the session was
  pinned to that branch, not the `claude/interview-studio-polish-zhfaet` the
  plan named; same work, different branch name). Polish only, **no feature
  creep**.
  - **Mon 2026-07-27 — PS-01, PS-09, PS-11 all DONE and committed.** Notes that
    matter for the rest of the week:
    - PS-01 was bigger than "add a stylesheet": the 21 pages consumed **zero**
      `--color-*` tokens, so loading `studio.css` alone would have changed
      nothing in light mode and put a dark background under light-mode tints in
      dark mode. The real fix was **505 hex→token substitutions** (slate ramp →
      ink/muted/light-muted/border/cream/paper, blue accents → gold family).
    - All 21 pages are pinned **`<html data-theme="light">`**. They carry ~100
      bespoke status tints (green "done" cards, red warnings, amber highlights)
      with no dark variant. `style.css` ships no dark rules, so they were
      already light-only in practice — the pin just stops `studio.css`'s
      `prefers-color-scheme` rules from half-applying. **Follow-up (not
      scheduled):** convert those tints to the dark-aware `note/trap/warn`
      tokens, then drop the pin.
    - White card backgrounds were left as `#fff` on purpose — white-on-warm-
      paper is the Studio convention (`studio.css --surface #fff` on
      `--bg #faf8f4`).
    - PS-09 canonical ring, **match this exactly** if you add a focus rule:
      `outline: 3px solid var(--color-gold-dark); outline-offset: 2px;`.
      Greppable invariant — nothing else should match `outline:.*px solid`.
    - PS-11 found two sources of blue beyond the two the ticket named: the
      **nav template's whole light-mode block** (its dark block was already
      warm) and **`css/track.css`'s `--tk-*` palette** (raw slate + teal, which
      is why the Communication / AI Engineering track pages read blue inside an
      otherwise warm page). Both now derive from `--color-*`.
    - Left blue on purpose (categorical colour-coding, not chrome):
      `.chip-vedic/devotional/hymn/ritual`, `.rmc-1..6`, and the SVG diagrams in
      `design/data-modeling.html`.
    - The 29 `design/the-*-problem.html` deep-dives are **not** part of the
      theme fracture — they are a deliberate separate system (`whiteboard.css`,
      Cormorant Garamond / Newsreader / DM Mono). Leave them alone.
  - **Tue 2026-07-28 — PS-04, PS-06 DONE and committed.**
    - PS-04: the six section cards now sit directly under the hero; both config
      panels live in one `<details class="eval-config">` closed by default. Its
      summary shows a live state line (`#ecfg-state`, updated inside the
      existing `refresh()`), which matters because filters persist in
      localStorage — a returning visitor sees a saved refinement without
      opening the panel. Hero lede cut to two sentences; everything it shed was
      already in the "How it works" list.
    - **Gotcha:** `evaluate/index.html` has a bare `<body>` (no `studio-skin`),
      so it gets **no global link colour** — a plain `<a>` renders browser-blue.
      Style any new link explicitly. Same trap on the other bespoke pages.
    - PS-06: both playground toolbars lead with the primary Run; secondary and
      destructive actions moved behind a "⋯ More" menu driven by the new shared
      **`interview.app/js/pg-overflow.js`** (nav dropdown pattern: aria-expanded,
      click-outside, Escape restores focus). Buttons kept their ids, so the
      bindings in `sql.js`/`python.js` were untouched — do the same if you move
      any more.
    - PS-11 finished off in `playground.css` (navy `#243042` schema block → the
      warm `--code-bg`/`--code-fg`, plus two slate values). That file was
      outside Monday's "shared chrome" scope.
    - Pre-existing, NOT ours: `interview/data/enrichments/co_sql_305-0108.html`
      404s on the SQL playground. Reproduces on a clean tree.
  - **Wed 2026-08-08 — PS-05, PS-07, PS-08 DONE.** See the top of this file
    for the detail. Remaining: Thu PS-02, Fri PS-03/PS-13/PS-12/PS-14/PS-10
    + QA.
  Full ranked plan + before/after mockups (artifact):
  https://claude.ai/code/artifact/0a2933e5-e69a-4dfb-a3be-7c1efef534af
  Audit was grounded in real renders (Playwright screenshots) + code. Headline
  findings: (1) **theme fracture** — ~20 nav pages (leaderboard, simulator,
  stories, flashcards, mock, behavioral, career, companies, elevator-pitch,
  incidents, interviewer, mistakes, red-flags, resume, study-plan, submit,
  whats-new, ai-engineering, my-prep …) DON'T load `studio.css`, so they render
  on the legacy cool-blue palette; flagship pages (home, evaluate, sql/python)
  do. (2) playground editors are bare `<textarea>` (no syntax/line numbers).
  (3) loading = text-only `setStatus()`; empty states = one italic line;
  toolbars = 8–11 equal-weight buttons; Skill Check buries Start below config.
  Execution order (Mon→Fri): 
    - Mon: PS-01 unify theme (add studio.css + `body.studio-skin` + Inter to the
      ~20 pages), PS-09 single focus ring (app.css teal `#0e7490` vs studio gold),
      PS-11 purge blue leftovers (`rgba(26,79,138,.08)` card shadow, `#93c5fd`/
      `#1e40af` tag hovers).
    - Tue: PS-04 value-first Skill Check (start-first, collapse company/pool config),
      PS-06 toolbar hierarchy (one primary Run + overflow for Clear/Reset).
    - Wed: PS-05 skeleton/progress loading, PS-08 intentful empty states,
      PS-07 shortcuts + `?` cheatsheet.
    - Thu: PS-02 CodeMirror 6 (vendor locally under `vendor/`, NO runtime CDN;
      keep textarea as no-JS fallback; sql+python+quiz).
    - Fri: PS-03 first-run onboarding, PS-13 mobile pass, PS-12 motion tokens,
      PS-14 prefetch, PS-10 home hero single-CTA. QA + draft PR.
  Guardrails: never regenerate index.html (hand-edit PS-10); nav stays templated;
  quiz/playground stay `data-theme="light"`; ship as draft PR, one commit per ticket.
  Screenshot script used: `interview.app` via `python3 -m http.server` +
  Playwright at `/opt/node22/lib/node_modules/playwright` (chromium at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`).
- **LinkedIn blurb** — write once real scores are coming in (drafts existed in
  chat; drop the "coming soon" framing).
- Optional product tweaks the user declined for now (leaving organic):
  - Lower `suppressBelow` to 3 for launch, then raise later.
  - Guard the opt-in so a 0% / near-empty attempt can't be published.
- Hardening backlog (all additive): IP-hash rate limiting with a daily-rotating
  salt (privacy review first), suspicious-entry quarantine/admin view,
  percentiles/badges, retention cron jobs, owner analytics dashboard.

## Gotchas / house rules (don't relearn these)

- **NEVER regenerate `index.html`** or run any index-generation script — the
  homepage is hand-crafted (see CLAUDE.md).
- **Nav is templated**: edit `interview.app/partials/nav.html`, then run
  `python3 interview.app/build_nav.py`. Do not hand-edit nav inside pages.
- **Playground/quiz pages are light-only** (`data-theme="light"` hardcoded) — a
  fix for an iPad auto-dark bug. Keep them light; WCAG-AA contrast.
- **D1 dashboard Console flattens newlines** — paste the comment-free
  `.console.sql`, not the commented schema.
- After a PR merges, **restart this branch from latest `main`** for the next
  change (branch: `claude/paddyspeaks-expert-review-0c0gcf`).

## What shipped this session (high level)

Rebrand to "Interview Studio"; nav overhaul (26 flat links → 4 dropdown hubs via
templating); homepage redesign + Community Challenge Board promo; de-essayed
design pages; dark-mode playground fix; mobile playground overflow fix; heuristic
Hint system; JSON load-error fix; SEO long-tail retitle of 27 design pages +
sitemap; and the full anonymous leaderboard (backend + frontend + go-live).
