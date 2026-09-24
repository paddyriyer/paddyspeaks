# Homepage UI Audit — before the evolution pass

_Audited 2026-09-24 against `main` at `0d135d2`. Phase 1 of the homepage UI
evolution brief. Nothing in this document was changed before it was written.
What was then changed, phase by phase, is in the "Change record" at the end._

The brief in one line: make PaddySpeaks read as **a serious publication, a
personal library and a working laboratory, by one person, in one visual
system**, without replacing its personality. Evolve, don't redesign.

## How this was measured

- Local static server, headless Chromium (Playwright 1.56), Google Fonts served
  from a local copy so the real typefaces render. Third-party requests blocked.
- Desktop 1440×900, phone 390×844 (touch, 4× CPU throttle for the metrics run).
- Screenshots: every viewport-height slice of the page, both widths.
- Contrast: a script walks every visible text node and computes the WCAG ratio
  against the nearest solid background (it skips text over gradients/images, so
  it *under*-counts); axe-core via the repo's own `scripts/a11y/axe-check.mjs`.

### Baseline numbers

| Metric | Desktop | Phone |
|---|---|---|
| Page height | 11,574 px (12.9 screens) | 19,862 px (23.5 screens) |
| LCP (element) | 1,184 ms (masthead `h1`) | 540 ms (`h1`) |
| CLS | 0.018 | 0 |
| Filter click → next paint (INP proxy) | 14 ms | 17 ms |
| DOM elements | 3,379 | 3,379 |
| Elements with inline `style=""` | 623 | 623 |
| `<img>` elements | 136 (1 eager) | 136 |
| Image bytes after load | **2,932 KB** | 2,112 KB |
| JS bytes (all first-party) | 72 KB | 72 KB |
| CSS bytes | 171 KB | 171 KB |
| HTML | 302 KB | 302 KB |
| Text nodes under 12px | 320 | 322 |
| Text nodes under 10px | 118 | 124 |
| axe (serious/critical) | clean | `target-size` ×13 |

Everything that matters is already fast (first-party JS only, one eager image,
LCP is text). The costs are **weight and length**: 2.9 MB of images on desktop,
most of it from a 38-card scrolling sidebar, and a page that is 23 phone
screens long.

## What the page is today (top to bottom)

1. **Top bar** — "Est. 2026 · Spirituality · Philosophy · Technology · ▶ YouTube
   (red filled button) · LinkedIn".
2. **Masthead** — ornament, 96px "Paddy*Speaks*", tagline, rule. ~370px tall.
3. **Nav** — Read · Learn · **Prepare** · **Find** (both as filled blue pills) ·
   Build · Atlas · About · search icon.
4. **Five journeys** — "What did you come here to do?" and five equal columns:
   mono label, serif verb, one-sentence description, 3–6 mono sub-links.
5. **Continue** — built from this browser's own history; hidden when empty.
6. **Featured** — a dark HTML-drawn hero ("1.78B", the headline, a mono
   process line, three coloured tag chips) above a body that repeats the
   headline and a 6-line excerpt. Beside it, a **fixed-height scroll box with
   38 article cards** (every card: thumbnail, tag, title, 2-line excerpt, date).
7. **Pull quote** — Gita 2.47.
8. **Deep Dives band** — full-bleed dark navy; 3 visual-essay cards with
   blurred animated "orbs" and a scroll-reveal fade. Two of the three are also
   in the sidebar above.
9. **Sacred Texts** — Mandala / Timeline / Cards toggle, mandala default.
10. **Devotional Music** — one wide card.
11. **Interview Studio** — a dark gradient "featured app" card.
12. **Data Lab** — five large two-column demo cards (cover tile + prose).
13. **Health & Wellness** — 14 small cards in 5 sub-categories.
14. **All Writings** — filter pills, then a 3-column grid of image cards,
    9 at a time, "Show More" for the other 141.
15. **Testimonials** (honest empty state), **Subscribe**, footer.

## Evaluation

Each finding carries a classification: **KEEP** (right as is), **REFINE**
(right idea, wrong execution), **REDESIGN** (the idea needs a new form),
**REMOVE**.

### 1. Hierarchy

- The first screen answers *who* (a large, beautiful wordmark) but not *what*.
  The tagline "Where Spirituality, Philosophy & Technology converge" describes
  a mood, not a collection; nothing says there are tools, jobs or demos here
  until the five columns, which start at y≈600. — **REFINE**: compact masthead,
  replace the tagline with one plain sentence that names what is here, and add
  Paddy's name to it.
- Masthead + ornament + rule consume ~370px before anything can be chosen.
  — **REFINE**: roughly halve it; keep the wordmark, the italic *Speaks*, the
  ornament and the rule.
- "What did you come here to do?" is a good question but at 30px italic
  display it competes with the wordmark for the top of the hierarchy.
  — **REFINE**: demote to an eyebrow/label-level heading.
- The featured essay is the most valuable asset on the page and sits below the
  fold on both widths. — **KEEP** its position after the journeys (the brief
  orders identity → journeys → featured), but tighten everything above it so
  it starts earlier.

### 2. Information density

- Five journey columns: dense and useful, but every column is a paragraph plus
  a cloud of 3–6 mono links, so the eye has 25 near-identical targets.
  — **REDESIGN** as an editorial directory: numbered, verb-led, one stat, one
  short line, two or three links.
- The 38-card sidebar scroll box is the page's worst density problem: a
  scrollable region inside a scrollable page, ~350px wide, showing ~3.5 cards
  at a time, with excerpts truncated mid-word ("machine-…"). It is also where
  most image bytes come from. — **REMOVE** the scroll box; **REDESIGN** as a
  "Latest" list of five.
- All Writings shows 9 large image cards (each ~390px tall) per "Show More".
  To reach an essay from 2023 a reader must click 10+ times. — **REDESIGN** as
  an editorial archive: three visual stories, then a dense dated list.
- Data Lab: five cards at ~420px each for five links (~1,300px of page).
  — **REDESIGN** as a numbered project index.
- Health & Wellness: 14 cards across 5 sub-heads, most with emoji icons
  (⌚ 📊 🤖 🧠). — **REFINE** into a compact textual collection inside READ.

### 3. Typography

- The type system (Playfair Display, Source Serif 4, JetBrains Mono) is the
  site's identity. — **KEEP** all three.
- Section headers (`.section-header h3`) are 15px letter-spaced small caps in
  Playfair with a hairline. They are elegant but too quiet to act as chapter
  breaks — "SACRED TEXTS" reads at the same weight as a card eyebrow.
  — **REDESIGN** as numbered chapter heads.
- The featured hero uses Fraunces, Cormorant Garamond and DM Mono, **none of
  which are loaded** — it silently falls back to Playfair/JetBrains. — **REMOVE**
  the phantom families.
- No defined scale: ad-hoc inline sizes from 8px to 78px (623 inline `style`
  attributes). — **REFINE**: one named scale (display, h1, h2, deck, eyebrow,
  meta, body) as tokens.
- 118 text nodes on desktop are under 10px: 9px tags on demo covers, 8–9px
  mono lines in the hero, 10px mono stats in Interview Studio. — **REFINE**:
  floor at 11px for mono labels, 12px for anything that carries meaning.

### 4. Card consistency

- One card anatomy is reused for unlike things: Data Lab demos and Devotional
  Music are `.sacred-text-card`s; the sidebar card, deck card, dd-card and
  health card are four different image-over-text cards for the same thing (an
  essay). — **REDESIGN**: shared tokens, content-specific primitives (article,
  sacred text, product, demo, tool).
- Nested borders: page frame (two borders) → content → card border → cover
  border → chip border. — **REFINE**: editorial content flat; one border.

### 5. Image treatment

- The custom artwork is excellent and under-used: the sidebar shows it at
  120×150 with `object-fit: cover`, which crops the embedded typography ("e
  Interview Ro", "Posting / e Job"). — **REFINE**: never crop cover art that
  carries text; show it larger or not at all.
- The featured hero draws the headline *inside* the artwork and again in the
  body underneath, plus a category and "10 min read" chip in the artwork and
  again in the meta. — **REDESIGN**: artwork keeps the "1.78B" figure (the
  image); the body carries headline, deck, date, time once.
- Deck images use `object-fit: contain` on a fixed box, so wide share cards
  float in letterbox bars of mismatched colour. — **REFINE**: use each cover's
  native ratio in the few places images appear.

### 6. Contrast

- Body and primary labels pass (ink `#1a2332` on `#eef3f9` ≈ 14:1; muted
  `#3a4556` ≈ 9:1). — **KEEP**.
- Failures cluster in decoration that carries information: the Deep Dives band
  (mono meta at ~35% white on navy, cards dimmed until scrolled into view), the
  hero's 8–9px lines at 75% opacity, Interview Studio's `#8892a8` 10px labels
  on blue, and the phone filter pills (measured 1.2:1 at 10px — the active pill
  text on a pale fill). — **REFINE**: all information-bearing text ≥ 4.5:1.

### 7. Whitespace

- Gaps are uniform rather than hierarchical: ~80–120px between almost every
  module, so a small section (Devotional Music, one card) gets the same air as
  a major one. The Data Lab grid leaves a half-empty last row. Result: 12.9
  desktop screens. — **REFINE**: two spacing steps — tight within a chapter,
  generous between chapters. Target: spacious, not empty.

### 8. Section transitions

- Transitions are either nothing (a hairline header) or a jolt (the full-bleed
  dark Deep Dives band between two light sections). — **REDESIGN**: numbered
  chapter breaks that mirror the five journeys (01 READ … 05 BUILD), each with
  one short line of copy.
- Pull quote (Gita 2.47) — **KEEP**; it becomes the threshold into LEARN.

### 9. Scanning behaviour

- F-pattern scanning is defeated by centring: masthead, journey heading, pull
  quote, section leads and mandala are centred, while cards are left-aligned.
  — **REFINE**: left-align structural text inside the content column; keep the
  masthead and the mandala centred (they are ceremonial).
- Dates are the most useful scanning key for a publication and are only ever in
  11px mono at the bottom of a card. — **REFINE**: dates lead the archive rows.

### 10. Navigation

- Prepare and Find are filled pills; Read, Learn, Build, Atlas and About are
  plain text. This reads as "two of these are the product", breaks the
  five-equal-journeys model, and makes an *active* state impossible to show
  (the pill already looks active). — **REFINE**: all five equal; active state
  is an underline; `aria-current` on the section in view.
- Search is a 16px icon after About. The brief makes search strategic.
  — **REFINE**: "Search" gets a label and more weight than About; About moves
  to the quiet end of the row.
- No sticky header: after the masthead scrolls away there is no way back to the
  journeys except scrolling. — **REFINE**: the nav row itself sticks (compact,
  no masthead), no mega-menu.
- Mobile hamburger (`lib/ps-nav.js`) is well built (real button, Escape,
  aria-expanded, search kept outside the menu). — **KEEP**.

### 11. Responsive behaviour

- Phone: the top bar wraps to three lines (EST./2026, a three-line subject
  list, a red YouTube block). — **REFINE**: one line; drop the subject list on
  phones.
- Phone: the five journeys stack as five full paragraphs (≈900px) before the
  featured essay. — **REDESIGN**: compact rows, each fully visible.
- Phone: no horizontal overflow (measured 0px). — **KEEP**.
- Phone: 13 `target-size` failures (the mono sub-links, ~18px tall). — **REFINE**.

### 12. Accessibility

- Skip link, landmarks, `aria-pressed` on toggles, real buttons for filters,
  reduced-motion handling in `style.css`. — **KEEP**.
- Mandala detail panel appears on hover/click; the nodes are links whose
  first click is intercepted to show the panel, so a keyboard user's Enter
  does not follow the link it announces. — **REFINE** (documented; behaviour
  is intentional and changing the mandala is out of scope — see Phase 8).
- The Deep Dives scroll reveal leaves content at low opacity until
  intersected; with reduced motion it still waits for the observer.
  — **REMOVE** the reveal.
- Card links wrap entire cards including headings and paragraphs (no nested
  links, but very long accessible names: the whole excerpt is read as the link
  text). — **REFINE**: in the new modules the link is the title; the row is
  clickable through a stretched pseudo-element.

### 13. Visual repetition

- The same essays appear up to three times in one scroll: "The New Language of
  Data" is in the sidebar, the Deep Dives band and the archive; "The Gita They
  Never Fully Taught You" likewise. — **REMOVE** the repetition: each item
  appears once above the archive.
- Five demo cards share an identical composition (initials tile + four
  coloured chips + three paragraphs + "Explore the Demo →"). — see Data Lab.

### 14. Calls to action

- "Explore the Demo →" ×5, "Enter the Bhajan Hall →", "Open the Studio →",
  "Show More" — the most important product CTA (Open the Studio) is a pale
  button on a dark gradient, the same weight as a text link. JobSignal, one of
  the five journeys, has **no section and no CTA at all** below the fold.
  — **REDESIGN**: products get a product module with one primary CTA each;
  JobSignal gets one, with live numbers from `/jobs/data/stats.json`.
- The red filled YouTube button in the top bar is the loudest CTA on the page
  and points off-site. — **REFINE** to a plain link.

### 15. Content discoverability

- 150 writings, but only 9 are reachable without clicking "Show More"; there is
  no way to see titles at a glance. — see All Writings.
- Search exists (`lib/ps-search.js`, ⌘K) but is an unlabeled icon, and nothing
  on the page suggests what you can search *for*. — **REDESIGN**: one labelled
  catalogue-style entry with four example queries.
- Privacy Console is counted as a demo (`demos.total` = 6) but only five demos
  are listed in Data Lab. — **REFINE**: list it, as a tool.

## Decisions (summary table)

| Area | Decision |
|---|---|
| Serif/mono type system, paper background, ink/blue palette, thin borders, page frame | KEEP |
| Wordmark, ornament, rule | KEEP, smaller |
| Tagline | REFINE → plain statement with author |
| Top bar | REFINE (quiet links, one line on phone) |
| Nav pills on Prepare/Find | REMOVE (equal journeys) |
| Nav active state, sticky compact nav, labelled search | REFINE |
| Five journeys block | REDESIGN → numbered directory |
| "Not sure? Search everything" line | REDESIGN → catalogue search entry with examples |
| Featured hero duplicated headline/chips, phantom fonts | REDESIGN |
| 38-card scrolling sidebar | REMOVE → Latest list of five |
| Continue module | KEEP (already honest; hidden when empty), restyle |
| Pull quote | KEEP (threshold into LEARN) |
| Deep Dives dark band, orbs, reveal | REMOVE band/orbs/reveal; REFINE the three visual essays into READ |
| Section headers | REDESIGN → numbered chapters |
| Sacred Texts mandala/timeline/cards | KEEP; REFINE labels, contrast, transition |
| Devotional Music card | REFINE (flat, inside LEARN) |
| Interview Studio dark card | REDESIGN → product module |
| JobSignal (absent) | ADD product module |
| Data Lab cards | REDESIGN → numbered project index (+ Privacy Console as a tool) |
| Health & Wellness cards | REFINE → compact collection in READ |
| All Writings grid | REDESIGN → 3 visual stories + dated list |
| Testimonials, Subscribe, footer | KEEP (spacing only) |

## Constraints discovered during the audit

- `index.html` is hand-crafted and edited by hand; no script may regenerate it.
- `scripts/platform_build/registry.py` reads the deck with
  `<a href="…" class="deck-card…" data-category="…">` and CI fails if the deck
  and `article_metadata.json` disagree. **Every deck card must survive** in
  that exact shape; the archive redesign is CSS plus a few lines of the
  existing filter script.
- Filter counts must stay `data-ps-stat` spans (`build.py check` enforces it).
  New numbers added by this pass must also be stamps, or read at runtime from a
  derived file (`/jobs/data/stats.json`) — never typed.
- `style.css` is shared by ~190 pages. The homepage changes live in a new
  homepage-only stylesheet so no other page moves.
- The paper colour today is a cool blue-white (`#eef3f9`), although the brief
  describes it as warm. Changing it site-wide is out of scope for a homepage
  pass; the homepage moves one step warmer (see tokens) and the decision to
  carry that to the rest of the site is left to the owner.

## Change record

One commit per phase, each screenshotted at 1440 and 390 before the next began.

| Phase | What changed |
|---|---|
| 1 | This audit. |
| 2 | `lib/ps-home.css` (homepage only, scoped to `body.ps-home`): type scale, two spacing steps, journey accents (all ≥ 5:1 on the paper), 12-column grid, chapter / eyebrow / meta / deck / CTA primitives, a stretched-link pattern instead of card-wide anchors. Paper one step warmer on the homepage only. |
| 3 | Masthead at about half the height, with a plain statement and Paddy's name. Nav: five equal journeys, a hairline, then Atlas · **Search** (labelled) · About (quiet, last). The row sticks after the masthead; the chapter in view gets `aria-current`. Five journeys → numbered directory. Catalogue search entry with four example queries (`data-ps-search-q` in `ps-search.js`). |
| 4 | Feature (7 cols): cover art carries the figure, the body carries the words once. Latest (5 cols): five numbered stories, one with its illustration. The 38-card scrolling sidebar is gone. |
| 5 | PREPARE and FIND chapters with product modules. JobSignal numbers are read from `/jobs/data/stats.json` at runtime and hidden (never zero) if unavailable. |
| 6 | BUILD chapter: Data Lab as a six-row project index (adds CareerOS, so the page lists all six demos the registry counts) plus Privacy Console as a tool with its data behaviour stated. |
| 7 | READ chapter: visual essays (flat, motif covers, no orbs or reveal); the 150 deck cards render as a dated list (markup untouched); health & wellness as a reading list. |
| 8 | LEARN chapter on a parchment band, with Gita 2.47 as its threshold. Views unchanged; clearer tabs and labels; phones open on Cards, compacted to a two-column index. Devotional music as a sacred-text entry. |
| 9 | Phone pass: full-width menu rows, slimmer sticky bar, no overflow at 320 / 390 / 900. |
| 10 | Accessibility and performance (below). Tiny text raised; inline cover styles neutralised in the archive. |

### Before → after

Same harness as the baseline.

| Metric | Desktop before | Desktop after | Phone before | Phone after |
|---|---|---|---|---|
| Page height | 11,574 px | **10,155 px** | 19,862 px | **13,185 px** |
| LCP | 1,184 ms | 1,108–1,168 ms | 540 ms | 360 ms |
| CLS | 0.018 | 0.007 | 0 | 0.037 (Cards view swap on load; < 0.1) |
| Filter click → paint | 14 ms | 10–12 ms | 17 ms | 18 ms |
| DOM elements | 3,379 | 2,929 | 3,379 | 2,929 |
| Inline `style=""` | 623 | 325 | 623 | 326 |
| Image bytes after load | 2,932 KB | **113 KB** | 2,112 KB | **113 KB** |
| JS bytes | 72 KB | 76 KB (+ `ps-home.js`, 3.6 KB) | 72 KB | 76 KB |
| CSS bytes | 171 KB | 219 KB (+ `ps-home.css`, 10 KB gzipped) | 171 KB | 219 KB |
| HTML (gzipped) | 55 KB | 45 KB | | |
| Text under 10px | 118 | **0** | 124 | 1 |
| axe serious/critical | clean | clean | `target-size` ×13 | **clean** |

The CSS is the one number that went up: the homepage layer is additive so
that no shared rule changes. Everything the visitor waits for went down.

### Notes and follow-ups

- **Example searches.** The brief suggested "desire"; the shipped index ranks
  a SQL question ("Obtain the Desired Result") first for it, so the entry
  uses "karma", which returns Karma Yoga and Gita chapter 3. The other three
  examples ("Kafka skew", "Bhagavad Gita 2.47", "Meta data engineer") return
  sensible first results.
- **Paper colour — now site-wide (2026-09-24, owner's call).** `style.css`
  `:root` carries the warm paper (`#f7f5f0`), cream (`#efebe2`) and matching
  borders (`#d5cfc2` / `#e4dfd4`); `lib/ps-home.css` no longer overrides them
  and `lib/ps-platform.css` fallbacks match. Ink, blues and the type are
  unchanged, and every shared text colour gains a little contrast (e.g.
  `--color-light-muted` 5.30 → 5.42:1). The axe ratchet reports the same
  counts on every page as before. Pages that define their own palette
  (most self-contained articles, the sacred-text apps, JobSignal) are
  unaffected by design.
- **Mandala keyboard behaviour** is unchanged: the first Enter on a node shows
  its detail panel, the second follows the link. Phones now default to Cards,
  which are plain links.
- **Telugu script cue** on the devotional entry relies on the reader's system
  Telugu font (present on current Android, iOS, macOS and Windows); it is
  `aria-hidden` and decorative.
- Old homepage-only rules in `style.css` (`.featured-sidebar-*`, `.dd-*`,
  `.health-card*`, `.interview-hero-card`) are now unused by `index.html` but
  were left in place: removing shared CSS is a separate, reviewable change.
