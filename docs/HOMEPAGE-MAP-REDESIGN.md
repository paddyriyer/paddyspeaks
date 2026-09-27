# Homepage as a map — the librarian, not the library

_2026-09-26. Follows `docs/HOMEPAGE-UI-AUDIT.md` (the 2026-09-24 evolution
pass, which kept the IA and restyled it). This pass changes the IA itself._

**North star:** PaddySpeaks has grown from a blog into a library. The homepage
now needs to become the librarian. Guide people; do not throw the books at them.

**The reader feedback that drove it:** "The home page feels overwhelming for new
visitors because there is so much content… The Find and Prepare sections are
perfect examples of what works. They give a brief intro on the homepage and
link out to their dedicated pages. If we organise all the other sections the
same way, the homepage will act as a clean map for the entire website."

## 1. Why Find and Prepare work (the benchmark)

Both are one product module each: a name, one headline, two sentences, one
primary action, and a destination page (`/interview.app/`, `/jobs/`) that holds
all the depth. Every other chapter of the old homepage *was* its destination:
READ held the full 151-row archive, LEARN held the whole 23-text mandala,
BUILD held all seven demos. Those three chapters are where the weight was.

## 2. Audit of the homepage before this pass

Measured with the harness in §9 (headless Chromium, 1440×900 and 390×844).

| Metric | Desktop | Phone |
|---|---|---|
| Page height | 10,429 px (11.6 screens) | 13,129 px (15.5 screens) |
| Links inside `<main>` | 300 | 300 |
| DOM elements | 2,955 | 2,955 |
| `<img>` elements | 124 | 124 |

| # | Section (top → bottom) | Destination page today | Classification |
|---|---|---|---|
| 1 | Top bar (Est. 2026 · subjects · YouTube · LinkedIn) | — | **Keep** (shared chrome) |
| 2 | Masthead: wordmark + one statement | — | **Keep → becomes the hero** |
| 3 | Nav: Read · Learn · Prepare · Find · Build · Atlas · Search · Mentoring · About | three of five point at homepage anchors | **Simplify** (see §5) |
| 4 | "What did you come here to do?" five-row directory, 4–5 sub-links each | — | **Compress** into five doorways, one action each |
| 5 | Catalogue search with four example queries | `/atlas/` + search dialog | **Keep** — header field, hero *Find something*, the *Find* doorway and the closing "Not sure where to start?" |
| 6 | Feature + Latest five | `/articles/` (stale) | **Compress** → Worth Reading: 1 feature + 3 |
| 7 | Continue (this browser's history; hidden when empty) | — | **Keep** (returning readers only) |
| 8 | 01 READ · Visual essays (3) | none | **Move** to `/articles/` |
| 9 | 01 READ · All writings: 5 filters + 151 rows | none — the homepage *was* the archive | **Move** to `/articles/` |
| 10 | 01 READ · Health & wellness (16 links) | none | **Move** to `/articles/#health` |
| 11 | 02 LEARN · Gita 2.47 threshold + mandala / timeline / cards (23 texts) | none | **Move** to `/sacred/`; homepage keeps a gateway with three texts |
| 12 | 02 LEARN · Devotional music | `/devotional-music/` | **Move** to `/sacred/#devotional-music`; one quiet link in the gateway |
| 13 | 03 PREPARE · Interview Studio product module + mentoring line | `/interview.app/`, `/mentoring/` | **Compress** (benchmark: keep its shape, drop the four-part list) |
| 14 | 04 FIND · JobSignal product module with live counts | `/jobs/` | **Move** to `/jobs/` (already its home); linked from the Prepare gateway, `/explore/` Tools, search and the footer |
| 15 | 05 BUILD · Data Lab index (7 demos) + Privacy Console | none | **Move** to `/lab/`; homepage keeps a gateway with three examples |
| 16 | Testimonials (honest empty-state invitation) | `/testimonials/` | **Move** (footer link stays) |
| 17 | Subscribe ("Stay in the conversation", four links) | `/subscribe/` | **Merge** into the About band as one link (footer "Follow" stays) |
| 18 | Footer | — | **Keep** |

Nothing a first-time visitor needs *before choosing where to go* was lost in
the moves: every moved block is one click away, on a page named for it.

## 3. New information architecture

The owner supplied the target design mid-pass (a full-page mockup with exact
colours and navigation); this section records what was built to it.

```
/                    the map (this page)
├── /articles/       READ    — every essay, filters, visual essays, health collection   (same URL; the stale 2026-04 page is replaced)
├── /sacred/         SACRED  — mandala · timeline · cards, devotional music             (NEW)
├── /interview.app/  PREPARE — Interview Studio (+ /mentoring/, /jobs/ from its gateway) (unchanged)
├── /explore/        EXPLORE — seven Data Lab demos, tools (JobSignal, Privacy Console, Atlas), interactive essays (NEW)
└── Find = search    the dialog (lib/ps-search.js); /atlas/ is its no-JS fallback
```

Homepage order (each section answers: what is this, why care, where next):

1. **Hero** — kicker "Ideas · Technology · Careers · Timeless wisdom", the
   wordmark as `h1`, one sentence naming what is here and who made it, two
   actions: *Explore PaddySpeaks* (navy, jumps to the doorways) and *Find
   something* (outlined, opens search). Paddy's painting of a sunrise over a lake sits on the
   right fades into the page; it is decorative (`alt=""`).
2. **Where would you like to go? — Five ways in · One library** — five tinted
   cards: Read (blue), Sacred (terracotta), Prepare (teal), Find (sand) and
   Explore (lavender). Icon, title, one sentence, one action. Nothing else.
3. **Worth Reading — A few ideas to get you started** — one feature card with
   its artwork, three titles with small thumbnails, *View all N writings →*.
4. **Continue** — returning readers only (hidden when this browser has no history).
5. **Gateways, two by two** — *Preparing for your next move?* (teal; also
   links JobSignal and mentoring) · *Timeless Wisdom* (sand; the Sacred
   Library, the Gita, devotional music) · *Technology Is Changing. Thinking
   Still Matters.* (blue) · *Some Problems Are Older Than Software* (warm).
   Each: headline, two sentences, one pill action, one illustration.
6. **Experiments** — three small cards (Privacy Console, Data Lab, AI Command
   Center), *Explore Experiments →*.
7. **Behind PaddySpeaks** + **Not sure where to start?** — three sentences
   and *About Paddy →*; beside it a search field and *Or surprise me →* (a
   random essay, fetched only on click; without JS it opens the archive).

Every destination is named in the first screen and a half; nothing below that
point introduces a destination the doorways did not already name.

## 4. Wireframes

### Desktop (1440) — as built

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ PaddySpeaks        Read  Prepare  Sacred  Explore  About    ( ⌕ Search…   / )│ ← one sticky row
├──────────────────────────────────────────────────────────────────────────────┤
│ IDEAS · TECHNOLOGY · CAREERS · TIMELESS WISDOM          ░░ mountains ░░ sun  │
│ PaddySpeaks                                             ░ lake ░░░ tree      │ h1
│ A connected library of essays, sacred texts…            ░░░░░░ figure on rock│
│ (Explore PaddySpeaks →)  ( ⌕ Find something )                                │
├──────────────────────────────────────────────────────────────────────────────┤
│ Where would you like to go?                                                  │
│ Five ways in · One library                                                   │
│ ┌ Read ──┐ ┌ Sacred ┐ ┌ Prepare ┐ ┌ Find ──┐ ┌ Explore ┐   tinted, icon,     │
│ │ 1 line │ │ 1 line │ │ 1 line  │ │ 1 line │ │ 1 line  │   one action each   │
│ └ → ─────┘ └ → ─────┘ └ → ──────┘ └ → ─────┘ └ → ──────┘                     │
├──────────────────────────────────────────────────────────────────────────────┤
│ Worth Reading                                        View all 151 writings → │
│ ┌ feature: eyebrow / title / deck / date ─┬ art ┐  [▢] Every Arrow…          │
│ │                                         │     │  [▢] The Job Posting…      │
│ └─────────────────────────────────────────┴─────┘  [▢] Can You Afford…       │
│ ┌ Preparing for your next move? ── desk ┐ ┌ Timeless Wisdom ─────── temple ┐ │
│ └ (Explore Interview Prep →) jobs·mentor┘ └ (Enter the Sacred Library →)   ┘ │
│ ┌ Technology Is Changing… ───── blocks ┐ ┌ Some Problems Are Older… ─ tree ┐ │
│ ┌ Experiments  (Explore Experiments →) │ [Privacy Console][Data Lab][AI CC] ┐│
│ [▢] Behind PaddySpeaks (About Paddy →)   ┌ Not sure where to start? ───────┐ │
│                                          │ ( ⌕ Search PaddySpeaks… ) surprise│ │
├──────────────────────────────────────────────────────────────────────────────┤
│ PaddySpeaks   Read Prepare Sacred Explore About                   ▶  in     │
│ JOBSIGNAL · MENTORING · ATLAS · RESUME · … · legal row · © line              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Phone (390) — as built

```
┌──────────────────────────────┐
│ PaddySpeaks              (⌕) │ ← sticky; search one tap away
│ Read Prepare Sacred Explore About │  the five links stay visible — no menu
├──────────────────────────────┤
│ ░░ landscape band ░░░░░░░░░░ │
│ IDEAS · TECHNOLOGY · …       │
│ PaddySpeaks                  │
│ A connected library of …     │
│ (  Explore PaddySpeaks →  )  │ full width, 48px
│ (  ⌕ Find something       )  │
├──────────────────────────────┤ ← hero ends at ~585px of 844
│ Where would you like to go?  │
│ [icon] Read    one line    → │ one row per doorway, whole row tappable
│ [icon] Sacred  one line    → │
│ [icon] Prepare one line    → │
│ [icon] Find    one line    → │
│ [icon] Explore one line    → │
├──────────────────────────────┤
│ Worth Reading / feature art  │
│ title, deck, three titles    │
│ four gateway panels (text    │
│   only — art hidden on phone)│
│ experiments as three rows    │
│ about · search · surprise    │
└──────────────────────────────┘
```

## 5. Navigation

Before: Read · Learn · Prepare · Find · Build | Atlas · Search · Mentoring · About
(nine items; Read, Learn and Build pointed at homepage anchors; top bar and
masthead above it on every page).

After (the owner's design): **wordmark · Read · Prepare · Sacred · Explore ·
Mentoring · About · search field** (Mentoring restored 2026-09-27 — see below) — one sticky row on every page that uses the shared
header (homepage, About, all `pages.py` pages, the résumés). The top bar and
the masthead are gone from those pages; the homepage hero carries the large
wordmark, and YouTube / LinkedIn moved to the footer as icons.

- Journey ids are unchanged (`learn` = Sacred, `build` = Explore), so the
  accents, `data-journey` hooks and the search index keep working.
- **JobSignal and the Atlas** left the top row. They are one click away: the
  Prepare gateway links jobs; `/explore/` lists JobSignal and the Atlas as
  tools; search opens everything; the footer lists both.
- **Mentoring — a mistake, corrected (2026-09-27).** The first cut of this
  redesign followed the mockup's five-item nav and moved Mentoring out of the
  header, and reduced the homepage's "Sometimes 30 minutes…" line to a small
  "Free mentoring" link. Paddy had added Mentoring to the header on
  2026-09-24; the redesign should have asked before demoting it, and said so
  plainly rather than in a closing note. Restored: Mentoring is back in the
  header (between Explore and About) and the footer's section row, and the
  homepage carries Paddy's sentence with *Book a Mentoring Conversation →* as
  a full-width strip between the Prepare/Wisdom row and the Technology/
  Philosophy row. CLAUDE.md now says never to remove or demote an item the
  owner asked for without asking.
- Phones: two rows — wordmark + search icon, then the six links, which fit
  one row from 360 px up (the size eases down to 0.86 rem). Below 360 px they
  wrap, and the header stops being sticky there so it does not take 144 px of
  a small screen. The Menu button `lib/ps-nav.js` injects is hidden; nothing
  hides behind a control.

## 6. Components

**Reused as is:** the shared header, top bar and footer (`lib/ps-chrome.css`,
`lib/ps-nav.js`); tokens and primitives (`ps-wrap`, `ps-grid`, `ps-eyebrow`,
`ps-meta`, `ps-deck`, `ps-cta`, `ps-link`, `ps-stretch` / `ps-stretch-link`);
the search dialog (`lib/ps-search.js`, `data-ps-search-open`, `data-ps-search-q`);
Continue (`lib/ps-continue.js`); live JobSignal numbers (`lib/ps-home.js`,
`data-ps-live*`); registry stamps (`data-ps-stat`).

**Moved, unchanged in markup except for root-relative URLs and one heading
level, to the destination pages** (styles now in `lib/ps-library.css`, scoped
to `body.ps-library`): the deck cards and filter (`lib/ps-articles.js`),
visual-essay covers, the health collection, the mandala / timeline / cards
views (`lib/ps-sacred.js`), the devotional-music entry, the Data Lab index and
the Privacy Console tool card.

**New on the homepage** (`lib/ps-home.css`, `images/home/`): hero with an
painting (WebP at 720 / 1200 / 1916 px, served by `srcset`; 35–164 KB), five doorway cards with line icons, Worth Reading (the
feature's image and three 144px thumbnails, all WebP, all lazy), four gateway panels and three experiment cards with small SVG
illustrations (1–2 KB each), the about card, the closing search +
*Surprise me*.

**Removed from the homepage only** (the content and its URLs all remain):
the five-row directory and its 22 sub-links, the Latest five, the three
chapters' full contents, the Interview Studio four-part list, the JobSignal
four-part list, testimonials, the subscribe block, three JSON-LD blocks that
described homepage sections (the sacred collection moves to `/sacred/`), the
testimonials script (`lib/ps-forms.js` is no longer loaded here), ~560 lines
of inline sacred/deck/deep-dive script.

## 7. URLs that must not break

About 140 pages link to `/#archive`, `/#sacred-texts` or `/#data-lab`, and older
articles to `index.html#philosophy` / `#technology` / `#ai` / `#personality`.
All of them keep working:

- A tiny inline script in the homepage `<head>` sends a known legacy hash to its
  new home with `location.replace` before anything renders (so Back is not
  broken): `#archive` → `/articles/`, `#philosophy|#technology|#ai|#personality`
  → `/articles/#<filter>`, `#deep-dives` → `/articles/#visual-essays`,
  `#health` → `/articles/#health`, `#sacred-texts` / `#learn` → `/sacred/`,
  `#devotional-music` → `/sacred/#devotional-music`, `#data-lab` / `#build`
  → `/lab/`.
- Without JavaScript the same ids still exist on the homepage — on the gateway
  for that area — so the link lands on a section that names the destination.
- `/articles/` was an unmaintained 2026-04 listing (121 links, old nav); it is
  replaced, at the same URL, by the maintained archive.
- Verified in a browser: `/#archive` → `/articles/`; `/#technology` →
  `/articles/#technology` with the Technology filter on; `/#sacred-texts` →
  `/sacred/`; `/#data-lab` → `/explore/`; `/#devotional-music` →
  `/sacred/#devotional-music`; `/#health` → `/articles/#health`.

## 8. Things that must keep working (and how each was checked)

| Thing | How it is protected |
|---|---|
| **Analytics** (`lib/ps.js` + the no-JS pixel) | Homepage keeps both tags byte-for-byte. The three new pages get both from `pages.py` (`analytics: true` default, pixel `p=/articles/` etc.). `lib/ps.js`, the Worker, headers and hosting are **not touched** — this PR is content/markup only (INCIDENTS.md rule 2). No new `data-cta` instrumentation was added, so no new events are collected. Note: a visitor arriving on a legacy hash is counted by the JS as a view of the destination page; the pixel on `/` may still fire before the redirect, exactly as it did when they landed on `/` before. |
| Registry counts / filter counts | `registry.py` reads the deck from `content/pages/articles.html`; `checks.py` checks the rendered `/articles/` filter buttons carry `data-ps-stat`. `build.py check` passes. |
| Search | `lib/ps-search.js` untouched; every search entry uses the existing `data-ps-search-open` hooks; the index is rebuilt by `build.py all`. |
| Continue, live JobSignal numbers | Same element ids and data attributes; `lib/ps-home.js` behaviour 3 unchanged. |
| Storage keys | No new browser-storage keys. |
| Accessibility | axe strict list now includes `/`, `/articles/`, `/sacred/`, `/lab/`. |

## 9. Before → after

Same harness throughout (`python3 -m http.server`, Playwright 1.56, headless
Chromium, analytics requests blocked; every page scrolled once so lazy images
load before measuring).

| Metric | Desktop before | Desktop after | Phone before | Phone after |
|---|---|---|---|---|
| Page height | 10,429 px (11.6 screens) | **3,154 px (3.5)** | 13,129 px (15.5 screens) | **4,959 px (5.9)** |
| Links inside `<main>` | 300 | **27** | 300 | **27** |
| DOM elements | 2,955 | **332** | 2,955 | **332** |
| `<img>` elements | 124 | 14 | 124 | 14 |
| Image bytes after scrolling | 194 KB | 45 KB | 194 KB | 36 KB |
| JS bytes | 75 KB | 61 KB | 75 KB | 61 KB |
| HTML | 302 KB | **~26 KB** | | |
| Hero on a phone | — | ends at ~585 px of 844 | | |
| axe serious/critical (strict) | ratchet only | **clean, now strict** | | **clean, now strict** |

The destination pages: `/articles/` 2,845 px desktop (151 rows, 15 shown at a
time as before), `/sacred/` 2,436 px, `/explore/` 2,512 px; all axe-clean and
strict at 1280 and 390, no horizontal overflow at 320 / 768 / 1024.

## 10. The ten-second test

A first-time visitor, on the first screen and a half:

1. *What is PaddySpeaks?* — the hero sentence: "a connected library of essays,
   sacred texts, career tools and working technology experiments — written and
   built by Paddy Iyer".
2. *What can I find here?* — the kicker and the five doorway cards.
3. *Which section should I enter?* — each card is one sentence and one action.
4. *How do I search?* — the search field in the header, *Find something* in
   the hero, the *Find* card, and the closing search.
5. *Articles?* — **Read** (nav, card, *View all writings*).
6. *Interview preparation?* — **Prepare** (nav, card, gateway).
7. *Sacred texts?* — **Sacred** (nav, card, Timeless Wisdom).

### Featured story

Since 2026-09-27 the feature is *Every Arrow Is a Decision*. Its image is panel
4 ("Deleted? Not really.") of the ten-panel overview Paddy supplied for the
essay, cropped with the panel number removed (`images/home/feature-every-arrow.webp`,
272×490). It is shown whole (`object-fit: contain`), never cropped, because it
is a UI story whose rows carry the point. Panel 5 repeats the headline and
panel 1 carries a real company's logo, so neither was used. To change the
feature later: swap the `<article class="ps-feature">` text and image, and
keep the list below it at three.

## 11. Follow-ups

- **Measure it.** `lib/ps.js` already reports `cta_click` for any link with
  `data-cta`. Adding `data-cta` to the five doorways would show which door
  first-time visitors choose — but it collects a new event, so per
  `docs/INCIDENTS.md` rule 2 it belongs in its own small PR, not this one.
- About 140 older pages still link `/#archive`, `/#sacred-texts` and
  `/#data-lab`. They work (forwarded), but a mechanical pass updating them to
  `/articles/`, `/sacred/`, `/explore/` would save a hop.
- Old homepage-only rules in `style.css` (`.featured-sidebar-*`, `.dd-*`,
  `.health-card*`, `.interview-hero-card`) and the `.masthead` / `.top-bar`
  rules in `lib/ps-chrome.css` are no longer used by the shared header. Removing
  shared CSS is a separate, reviewable change.
- The hero is Paddy's painting (2026-09-27). The gateway and experiment
  illustrations are still hand-drawn SVGs (1–2 KB each); if final artwork is
  commissioned, swap the files in `images/home/` — the markup does not change.
- "Three decades" in *Behind PaddySpeaks* follows Paddy's own mentoring page
  ("more than three decades"); `docs/ABOUT-PAGE-AUDIT.md` still lists the
  career length as awaiting confirmation.
