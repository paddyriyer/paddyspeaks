# PaddySpeaks — Claude Code Instructions

## Session continuity — read first

Running state and "where we left off" between sessions lives in
**`docs/SESSION-HANDOFF.md`** — read it at the start of a session to resume.
Current headline: the **anonymous Community Leaderboard is LIVE** (Cloudflare
Worker + separate D1 `paddyspeaks-leaderboard`); the public board reveals at 5
real scores and shows a sample preview until then; the LinkedIn launch blurb is
parked until real scores flow. Update that file when meaningful state changes.

## Contact & Testimonials

Both features are documented in **`docs/CONTACT-AND-TESTIMONIALS.md`** — read it
before touching `/contact/`, `/testimonials/`, or the `FORMS` D1 database.

- Validation lives ONCE, in `analytics/lib/forms.js` (pure, unit-tested). The
  Worker imports it; `lib/ps-forms.js` mirrors it in the browser. Change both
  together or they drift.
- **Never publish a testimonial automatically.** Everything enters `pending`;
  only `approved` rows are public. Moderate at `/testimonials/admin.html`.
- **Never seed or invent testimonials.** Empty state shows an honest invitation.
- Recipient addresses and API keys are environment variables only — never in the
  repo, never in frontend code.

## CRITICAL: Do NOT regenerate index.html

The homepage (`index.html`) is **hand-crafted** with custom sections that no script can reproduce:
- Scrollbar sidebar with featured articles
- Sacred texts section with Mandala, Timeline, and Cards views
- Custom featured hero with visual design
- Hand-tuned deck grid ordering

**NEVER run `generate_index.py`** (now deleted) or any script that overwrites `index.html`.
When adding a new article, manually insert a card into `index.html`:
1. Add a `featured-sidebar-card` entry in the sidebar section
2. Add a `deck-card` entry in the `deck-grid` section
3. Update filter counts if needed

## Adding a New Article

1. Create the HTML file in `articles/` using an existing article as template
2. Add metadata to `article_metadata.json` (newest article first)
3. Manually add cards to `index.html` (sidebar + deck grid)
4. Run NO index generation scripts

## Site Structure

- `articles/` — Blog post HTML files (self-contained)
- `article_metadata.json` — Article metadata (title, date, category, slug, hero_image, read_time)
- `index.html` — Hand-crafted homepage (DO NOT auto-generate)
- `style.css` — Global styles with CSS variables
- `images/articles/<slug>/` — Per-article hero images
- Sacred text apps each have their own directory (e.g., `bhagavad-gita/`, `vishnu-sahasranama/`)

## Article HTML Template

Use existing articles as reference. Key elements:
- Full HTML5 with SEO meta tags (Open Graph, Twitter Card, Schema.org)
- Linked to `../style.css`
- Visual essay elements: `.lesson-card`, `.shloka`, `.callout`, `.manifesto-statement`, `.domain-header`, `.versus-grid`, `.feature-grid`, `.phase-timeline`, `.pull-quote-divider`, `.ornament-divider`, `.manifesto-list`

## Categories

- `philosophy` — Spiritual, sacred texts, Vedanta
- `technology` — Data, software, enterprise
- `ai` — Artificial intelligence
- `personality` — Personality development: leadership, boundaries, self-worth

Adding a category means touching five places: `KNOWN_CATEGORIES` in
`.github/scripts/validate_content.py`, and in `index.html` the nav-bar link, the
deck filter button, the hash allow-list, and `catLabels` in the search engine.
