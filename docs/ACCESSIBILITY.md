# Accessibility

Target: **WCAG 2.2 AA** wherever practical. This is P0.8 of the platform plan:
what was fixed, what is enforced automatically, what is still known to fall
short, and the manual keyboard pass that no tool replaces.

## What changed in this pass

| Area | Before | Now |
|---|---|---|
| **Homepage search** | A `<div>` overlay: no dialog role, no label, focus escaped behind it and was not returned, results not announced, `outline:none` on the input. It searched articles only. | `lib/ps-search.js`: a `role="dialog"` + `aria-modal` + labelled modal. Focus is trapped and returned to the opener. The input is a combobox driving a `listbox` via `aria-activedescendant`. Type filters are toggle buttons (`aria-pressed`). A polite live region announces the result count. Opens with ⌘/Ctrl-K or `/`, closes with Esc. |
| **Focus** | No global focus style; 50 `outline:none` rules outside `interview/`. | `lib/ps-platform.css` gives every link, button, input, `summary` and `[tabindex]` a 2px focus ring through `:focus-visible` at low specificity, on ~280 pages. |
| **Motion** | `prefers-reduced-motion` covered only the nav toggle. | One site-wide rule disables animations, transitions and smooth scrolling when the reader asks for reduced motion (WCAG 2.3.3). |
| **Skip links** | Missing on sacred-text apps, `/privacy/`, `/contact/`, demos. | `lib/ps-platform.js` adds "Skip to content" wherever a page has a `<main>` and no skip link. |
| **Sacred-text search** | 23 inputs labelled only by placeholder; result count not announced. | Each has an `aria-label`, and the count is a `role="status"` live region. |
| **Homepage toggles** | Mandala/Timeline/Cards and the archive filters did not expose their state. | `aria-pressed` on both groups, and `type="button"`. |
| **Target size** | Footer and new pathway links under 24px. | Pathway and legal-footer links are at least 24×24px (WCAG 2.5.8). |
| **Reflow** | The homepage, About and Contact overflowed a 390px screen by 12px (`.footer-links` did not wrap). | Wraps. No horizontal scroll at 390px on any page tested. |
| **Contrast** | New badges were too faint at 10.5px. | Badge text is darkened toward black; all platform pages pass axe contrast. |
| **Trust** | The homepage "Subscribe" email box was not connected to anything. | Replaced with real follow links (RSS, category feeds, changelog). |
| **Language** | `Paddy_Iyer_Resume.html` had no `lang`. | `lang="en"`. |

## What CI enforces

- **`.github/workflows/accessibility.yml`** runs **axe-core** (WCAG 2.0, 2.1 and 2.2, A and AA) in headless Chromium, at 1280px and 390px, on:
  - every platform page (`/corrections/`, the legal pages, `/changelog/`, `/subscribe/`, `/atlas/`). These must have **zero** serious or critical violations and no horizontal overflow;
  - one representative page per journey (homepage, About, Contact, Privacy Console, Bhagavad Gita, Abhirami Andhadhi, Interview Studio, Skill Check, JobSignal, a JobSignal search, an article, a demo). These are **ratcheted** against `scripts/a11y/baseline.json`: they may not get worse (a new rule, or more failing elements), so legacy debt shrinks and never grows.
- Run it locally:
  ```bash
  mkdir -p /tmp/a11y && (cd /tmp/a11y && npm i playwright axe-core && npx playwright install chromium)
  A11Y_DEPS=/tmp/a11y node scripts/a11y/axe-check.mjs
  # after fixing legacy issues, lower the bar for good:
  A11Y_DEPS=/tmp/a11y node scripts/a11y/axe-check.mjs --update-baseline
  ```
- `node lib/tests/search.mjs` (in Validate Content) keeps search results meaningful. An accessible search that returns nothing useful is still a barrier.

## Known remaining issues (baseline, 2026-09-24)

| Page | Issue | Notes |
|---|---|---|
| Homepage mandala (phone) | `target-size` ×13 | 23 nodes on a small circle overlap. The **Cards** and **Timeline** views (same links, full-size targets) are the accessible route. The mandala needs a mobile layout. |
| Bhagavad Gita, Abhirami Andhadhi | `color-contrast` ×55 / ×54 | Saffron-on-parchment verse numbers and tabs. A palette change is a design decision for those pages. |
| Privacy Console | `color-contrast` ×19 | Badge and step-button colours. |
| Interview Studio | `color-contrast` ×13; phone: 4 small tag chips, 1 code block not keyboard-scrollable | |
| Skill Check | `color-contrast` ×9 | Footer link colour on its dark theme. |
| Article *The Job Posting Is Not the Job* | `color-contrast` ×70, 12 scrollable figures not focusable on phone | Caption colour; figure scrollers need `tabindex="0"`. |
| AI Command Center | `color-contrast` ×7–8 | Filter labels. |
| Abhirami Andhadhi | verse rows are `div onclick` | Should become `<button>`s (keyboard users cannot expand a verse). |
| `/jobs/` | skip link, nav and footer are injected by JS | Without JS there is no skip link. |

Each is in `docs/PADDYSPEAKS-PLATFORM-BACKLOG.md`.

## Manual keyboard pass (do it before merging UI changes)

Automated checks catch perhaps a third of real barriers. With the mouse put away:

1. **Homepage.** Tab: the skip link appears first and jumps to the content. Tab through the nav, then the five pathways (each link has a visible ring). Press `/`: search opens, focus is in the box. Type `gita 2.47`, press ↓ and Enter: you land on the verse. Reopen and press Esc: focus returns to where you were. Tab inside search never escapes to the page behind it.
2. **Sacred text.** On `/bhagavad-gita/`, skip link → content; use the chapter buttons and search with the keyboard; the result count is announced. At the foot, *Sources & Verification* opens with Enter or Space.
3. **Interview Studio.** Filter the bank, pick a question, open the SQL playground and run it, all without the mouse.
4. **JobSignal.** Search, open a role, save it, and find it again under *Your saved jobs*.
5. **Legal and corrections pages.** Headings are in order (one `h1`), tables have header cells, and links make sense out of context.
6. **Zoom to 200%, and set the phone width to 390px.** No horizontal scroll, and nothing overlaps.
7. **Reduced motion** (OS setting). The homepage reveals appear instantly and nothing slides.
8. **Screen reader spot check** (VoiceOver or NVDA). Search announces "N results". Filter chips announce pressed/not pressed. The sacred view toggle announces its state.

## Rules for new work

- A new platform page goes in `STRICT` in `scripts/a11y/axe-check.mjs` and must pass clean.
- Build new components from `lib/ps-platform.css` primitives (`.ps-btn`, `.ps-badge`, `.ps-panel`, `.ps-state`). They already meet contrast, focus and target-size requirements.
- Never remove a focus outline without replacing it. Never use a `div` with `onclick` for something a `<button>` or `<a>` can do.
- Anything that moves respects `prefers-reduced-motion`. The global rule covers CSS; JS-driven motion must check `matchMedia('(prefers-reduced-motion: reduce)')`.
