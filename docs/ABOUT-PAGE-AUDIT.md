# About Page Audit — before the rework

_Audited 2026-09-24 against `main` at `64580e9`, before any code changed.
What was then built, and why, is in the "Change record" at the end._

The brief: the About page should answer **who Paddy is, what connects his
work, and why PaddySpeaks exists** — and make distributed systems, AI, the
Bhagavad Gita, careers, privacy and human behaviour stop feeling like six
unrelated subjects. The Resume answers *what Paddy has done*; this page must
not become a second copy of it.

## What was inspected

`about.html`; the redesigned homepage (`index.html`, `lib/ps-home.css`,
`lib/ps-home.js`); the platform-page renderer and its shared nav
(`scripts/platform_build/pages.py`, eight pages under `content/pages/`);
`style.css`, `lib/ps-platform.css`; the registry (`data/site-registry.json`,
`data/platform/catalog.json`); `resume.html`, `visual-resume.html`,
`Paddy_Iyer_Resume_Detailed.html`; the Data Lab, Interview Studio, JobSignal,
sacred-text and Atlas entry points; `article_metadata.json` (for the writing
map and for principles in Paddy's own words).

## Measured baseline

Local static server, headless Chromium, real fonts.

| | Desktop 1440 | Phone 390 |
|---|---|---|
| Page height | 2,751 px (3.1 screens) | 3,594 px (4.3 screens) |
| First line of About content | y ≈ 870 (below the fold) | y ≈ 1,050 |
| Words of body copy | ≈ 330 | ≈ 330 |
| Words per screen | ≈ 105 | ≈ 77 |
| axe (serious/critical) | clean | clean |

The page is not long; it is **sparse**. A third of the first screen is the
journal masthead, and the portrait sits below the fold. Half the words are
one paragraph about Interview Studio.

## What should remain (KEEP)

- **The thesis: "I build systems that think and write words that question."**
  The right line. It stays, promoted from the opening of a paragraph to the
  headline of the page.
- **The three ancient questions** — *What is the right action? What endures?
  What matters?* They are the page's best writing after the thesis.
- **Engineer / Philosopher duality** — the correct structure, too thin in
  execution (a gear emoji, a "॥" glyph, three lines each).
- **"The field of dharma is also the field of action. This blog lives at that
  intersection."** The one quote on the page, and the right one to feature.
- **"give without expecting"** — the reason Interview Studio is free; a real
  principle, not a slogan. It should survive into the projects section.
- **Frankl and Watts** — the only glimpse of what Paddy reads. Public, already
  on the page, and human.
- The type system, paper, ink and blue, thin rules.

## What feels dated

- **An older navigation.** The About page still carries the pre-platform nav —
  *Journal · Philosophy · Technology · AI & Future · Archive · Sacred Texts ·
  Data Lab · About · Resume* — while the homepage and all eight platform pages
  use *Read · Learn · Prepare · Find · Build · Atlas · About*. It is a fork of
  the navigation, which is exactly what the site's platform plan retired.
- **A full journal masthead** (≈ 430px) above a page whose own content then
  starts with a "Back to Journal" link — two headers before a word about Paddy.
- **A red, filled "▶ YouTube" button** in the top bar — the loudest element on
  the page, pointing off-site.
- **The portrait** has gradient speech-bubble icons (brain, chart, briefcase,
  handshake) pasted around the face: a SaaS-illustration aesthetic the rest
  of the site has moved away from, cropped into a blue-ringed circle.
- **Centred, 700px-wide single column** for everything, including the
  duality — reads as a landing page, not an editorial page.
- **Metadata** still says "Vedantic Philosopher" in the title, description and
  JSON-LD — a professional credential the page does not need to claim.

## What undersells Paddy

- The page describes **two** things (engineering and Vedanta) and one product.
  The site now has five journeys and a dozen working things — JobSignal, Data
  Lab, Privacy Console, Atlas, the sacred-text apps, 149 essays. None of them
  but Interview Studio is mentioned.
- **No proof.** No count, no project, no link into the library. "Petabyte-scale
  data architectures" is asserted and never shown.
- **No principles.** A reader learns what Paddy studies, not what he has come
  to believe — although the essays state it plainly and repeatedly.
- **No humanity** beyond two names. The page is a CV summary in prose.

## Facts that do not match the source of truth

The Resume (`resume.html`, `Paddy_Iyer_Resume_Detailed.html`) is the most
detailed and most recently maintained record. The About page disagrees with it:

| About page says | Resume says | Decision |
|---|---|---|
| "For over **fifteen** years" | "**35+** years building … enterprise data platforms", career from **1990** | Use "more than three decades" (the Resume's own phrase: "Three decades of building data systems"). **Paddy to confirm.** |
| "at Meta, VMware, and **now through my own venture, Simultaneous**" | Current role: **Meta, Apr 2024 – Present**. Simultaneous does not appear in any Resume format. | Name no current employer on the About page (the Resume covers it). Simultaneous still appears in several articles. **Paddy to confirm how Simultaneous should be described.** |
| JSON-LD `worksFor: Simultaneous`; `jobTitle: Data Architect & Philosopher` | — | Drop `worksFor`; `jobTitle` to the Resume's "Data Engineering Leader · Strategic Data Architect". |
| "at Meta, VMware" | Meta (2015–2021 as consultant; 2024–), VMware (2022–2024), LinkedIn, HP, CallidusCloud, Model N, Chegg, GREE, Xoriant | Company names appear only in the career arc, in eras, with a link to the Resume for the rest. |

The Resume also says "128 published articles" and "22 data-model deep dives"
where the registry now says 149 and 23. Those are the Resume's to fix; the
About page reads the registry and cannot drift.

## Navigation inconsistencies

1. About uses the retired nav (above). **Fix: the shared nav, not a copy of it.**
2. "Resume" is a nav item on About but nowhere else. It belongs in the page
   (career arc → "Full professional history") and the footer.
3. The homepage nav (sticky, labelled Search, About last) and the platform
   nav generated by `pages.py` (icon-only search linking to /atlas/) are
   themselves two variants. The rework makes them one: `pages.py` emits the
   homepage's header markup, and the header CSS moves out of the
   homepage-only stylesheet into a shared one.

## Duplicated Resume content

The Interview Studio paragraph repeats the Resume's "Beyond the role" block
nearly word for word (and with stale numbers there). Employer names in the
opening sentence duplicate the Resume's headline. **Rule adopted:** the About
page names eras and the kind of work; numbers about *PaddySpeaks* come from
the registry; numbers about *employment* (1,000+ changes, $500K, 89 pipelines)
stay on the Resume and are not repeated.

## Unnecessary whitespace

- Journal masthead ≈ 430px; "Back to Journal" row ≈ 100px; portrait block
  ≈ 330px before the name. The first sentence about Paddy is below the fold on
  a 1440×900 screen.
- 60–90px gaps between every block regardless of weight.
- The duality is two 3-line paragraphs in a 700px column with 50px padding.

**On page length.** The brief targets 60–70% of the current length *while
adding meaningful information*. At 2,751px and ≈ 330 words the current page
is already short; twelve sections cannot fit in 1,900px. The honest target is
density: the first screen answers who and why, and every later screen carries
roughly three times the words-and-proof per screen of today. Length is
reported in the change record, not hidden.

## Opportunities to connect About to the rest of PaddySpeaks

- Registry-driven counts (essays, sacred texts, interview questions, data
  models, demos, companies) — the same `data-ps-stat` stamps the homepage
  uses, so they cannot go stale.
- A project ledger linking Interview Studio, JobSignal, Data Lab, Privacy
  Console and Atlas — each with one proof point that is true today.
- A map of what Paddy writes about, every item a link to a real essay.
- Principles quoted from Paddy's own essays, each linking to its source, so
  the page argues by example.
- "Where next" into the five journeys, the Resume and Contact.

## Voice decisions

- **"The Seeker", not "The Philosopher".** "Philosopher" reads as a credential.
  The site already describes its reader as "the modern seeker and builder"
  (homepage metadata), so *Seeker* is PaddySpeaks' own word and pairs with
  *Engineer* without claiming a title.
- Avoid the brief's banned phrases (passionate, thought leader, at the
  intersection of …). The one exception is the quote, which is Paddy's own
  and says "intersection" once, deliberately.
- Principles are quotations or near-quotations from published essays, never
  invented aphorisms.

## Classification

| Area | Decision |
|---|---|
| Thesis line, three questions, dharma quote, Frankl/Watts, "give without expecting" | KEEP |
| Old nav, "Back to Journal", Resume in nav | REMOVE → shared global header |
| Journal masthead on About | REFINE → the compact shared masthead |
| Portrait with icon overlays in a ring | REDESIGN → cropped, uncircled, modest, WebP |
| Engineer / Philosopher | REDESIGN → 01 The Engineer / 02 The Seeker, with what each side actually covers, and the line that joins them |
| Dharma quote | REFINE → full-width feature, with 2–3 paragraphs on why old questions fit new tools |
| Interview Studio paragraph | REMOVE → one row of a five-project ledger |
| "Why PaddySpeaks" | REFINE → deeper, personal, ≤ 200 words |
| Proof strip, library numbers, project ledger, writing map, career arc, principles, a human line, Where next | ADD |
| "Continue the conversation" LinkedIn / message boxes | REFINE → "Where next" list; LinkedIn and Contact stay in the footer |
| Title, description, JSON-LD | REFINE → match the Resume; no "philosopher" credential; no `worksFor` |

## Change record

### How it is built

- **Source:** `content/pages/about.html`, rendered to `about.html` by
  `python3 scripts/platform_build/build.py pages` (CI fails if the output is
  stale). Edit the source, never `about.html`.
- **Header:** the shared one. `lib/ps-chrome.css` now holds the tokens,
  primitives and header that the homepage and every `pages.py` page use;
  `pages.py` emits the same header markup as `index.html`; the sticky state
  lives in the shared `lib/ps-nav.js`. There is no About-specific nav.
- **Page styles:** `lib/ps-about.css`, scoped to `body.ps-about`, built on the
  shared tokens. No JavaScript of its own.
- **Numbers:** `{{stat:…}}` tokens → `data-ps-stat` stamps from the registry,
  the same source as the homepage.
- **Portrait:** re-cropped from `images/paddy-profile.png` (really a
  1536×1024 JPEG) to a 4:5 head-and-shoulders that excludes the icon
  overlays; `images/about/paddy-portrait-{280,440}.webp` + 440 JPEG fallback.

### Sections

| # | Section | Status |
|---|---|---|
| 1 | Thesis: name, "I build systems that think and write words that question", roles, three-decades paragraph, modest portrait | Rewritten (thesis kept) |
| 2 | 01 The Engineer / 02 The Seeker, each with its question, six subjects and a note; the joining line | Rewritten from Engineer / Philosopher |
| 3 | The dharma quote as the page's one full-width moment, with three paragraphs on judgment | Promoted + new copy |
| 4 | What I actually do: Architect · Build · Write · Study, each a link | New |
| 5 | The library so far: essays, sacred texts, interview questions, companies, data models, working demos (all stamped) | New |
| 6 | Things I've built: Interview Studio, JobSignal, Data Lab, Privacy Console, Atlas — purpose, proof, link | New (absorbs the Interview Studio paragraph) |
| 7 | What I write about: Technology · Work · Life · Wisdom, three real essays each | New |
| 8 | Why PaddySpeaks exists: the other question, four convictions, "give without expecting" | Rewritten (≈ 150 words) |
| 9 | A short career arc: five eras, companies in one line, link to the Resume | New |
| 10 | A few things I have come to believe: five lines from Paddy's own essays, each linked | New |
| 11 | Away from the keyboard | New |
| 12 | Where next: read, study, explore, professional work, send a note | Replaces "Continue the conversation" |

**Removed or consolidated:** the retired nav and "Resume" nav item; "Back to
Journal"; the full journal masthead (now the compact shared one); the gear
and "॥" icons; the standalone Interview Studio paragraph (→ ledger row 01 and
the "give without expecting" line); the LinkedIn / Send-a-message boxes (→
Where next, and LinkedIn/Contact in the footer); `worksFor: Simultaneous` and
the "Philosopher" job title in the metadata.

### Measured after

| | Before | After |
|---|---|---|
| Desktop height | 2,751 px | 4,937 px |
| Phone height | 3,594 px | 7,773 px |
| Words in the page body | 248 | 970 |
| Words per desktop screen | ≈ 81 | ≈ 177 |
| First line about Paddy (desktop) | y ≈ 870, below the fold | y ≈ 400, first screen |
| Image bytes | 232 KB | 14 KB |
| JS | 21 KB | 44 KB (the shared header's search script) |
| CSS | 171 KB | 202 KB (`ps-chrome.css` + `ps-about.css`) |
| LCP desktop / phone | 1,016 / 312 ms | 204 / 356 ms |
| CLS desktop / phone | 0.0001 / 0 | 0.047 (web-font swap) / 0 |
| axe | clean (ratchet) | clean, now on the **strict** list |

The page is longer, not shorter. The brief's 60–70% length target assumed a
long page; this one was short and empty. It now carries four times the words
and all of the proof in 1.8× the desktop height, and the thesis reaches the
first screen.

### Does it tell a coherent story?

Read top to bottom, the page now argues one thing: the same person asks
*what can be built* at work and *whether it should be* in the texts, and
PaddySpeaks is where the two meet in public. Each later section is evidence
for that: habits (4), what grew (5), what was built (6), what is written (7),
why (8), how long (9), what he believes (10). The subjects stop looking
random because each one is filed under a question rather than a résumé
heading. What it still lacks is Paddy's own voice in the new paragraphs —
they are written to match it, and he should read them aloud and change
anything that doesn't sound like him.

### Facts Paddy needs to verify

1. **"For more than three decades"** — taken from the Resume ("35+ years",
   career from 1990). The old page said fifteen.
2. **Simultaneous** — the old page said "now through my own venture,
   Simultaneous"; the Resume lists Meta (Apr 2024 – present) and never
   mentions Simultaneous. The new page names no current employer. Several
   articles still mention Simultaneous; decide how it should be described.
3. **"Student of Vedanta"** in the roles line (from the brief, not the old page).
4. **Away from the keyboard:** Carnatic keertanas and Ramadasu "especially",
   and "the discipline of writing things down", are inferred from what the
   site publishes (the Bhajan Hall series; the writing itself). Frankl and
   Watts are from the old page. The last sentence quotes the Resume.
5. **Principles 01 and 02** add one explanatory sentence to the essay titles
   ("Weigh advice by who pays if it is wrong"; "At some point you have to
   choose") — paraphrases, not quotations.
6. **The four convictions** in "Why PaddySpeaks exists" follow the brief's
   themes; they are new sentences, not quotations.
7. **Career eras** are grouped from the Resume's dates; "2026 — PaddySpeaks"
   uses the site's "Est. 2026" (some essays were first published elsewhere
   from 2020).

### Follow-ups outside this change

- `resume.html` and `visual-resume.html` still carry the retired journal nav,
  and the Resume's "128 articles / 22 data models / 18+ sacred text guides"
  are stale against the registry (149 / 23 / 23).
- Articles keep their own navs; moving them to the shared header is a
  separate, site-wide change.
