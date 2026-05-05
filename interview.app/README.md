# Interview Question Bank

A static web app that ships **710 real interview questions** from 107 companies
across SQL, Python, Snowflake, and Git, plus in-browser **SQL** and **Python**
playgrounds so you can try every question without leaving the page.

Everything runs client-side. No backend, no telemetry, no install.

## URL

Hosted at **<https://paddyspeaks.com/interview.app/>**.

## What's here

```
interview/                     ← data + scripts
├── excel/Interview_Questions_Combined.xlsx   ← source workbook
├── scripts/
│   ├── xlsx_to_json.py        ← convert workbook → JSON (re-runnable)
│   └── extract_schemas.py     ← parse "inferred schema" → per-question table specs
├── data/
│   ├── questions.json         ← 710 unified question records
│   ├── companies.json         ← facets
│   ├── topics.json
│   ├── difficulties.json
│   ├── languages.json
│   ├── manifest.json
│   ├── question_schemas.json  ← qid → [{table, columns}]
│   └── table_coverage.json    ← all 154 referenced tables
└── sample dataset/            ← real CSVs, auto-loaded into SQLite

interview.app/                 ← the web app served at /interview.app/
├── index.html                 ← question bank (browse / filter / pick)
├── sql.html                   ← SQL playground (sql.js)
├── python.html                ← Python playground (Pyodide)
├── css/{app,playground}.css
└── js/{app,sql,python,sample-gen}.js
```

## Running locally

The app is purely static, but a few JSON / CSV files need to be served over
HTTP (browsers won't fetch them through `file://`).

```bash
# from the repo root
python3 -m http.server 8000
```

Open <http://localhost:8000/interview.app/>.

## Workflow

1. **Browse** — `index.html` lists every question with facet filters
   (company, language, difficulty, batch, topic) and free-text search.
2. **Pick** — tick the boxes; selections persist in `localStorage` and can be
   exported as JSON or Markdown, or printed.
3. **Practise** — click *Open in playground* on any card.
   - **SQL questions** open in `sql.html`. The 15 base CSVs are loaded into a
     fresh SQLite database, *plus* the question's referenced tables are
     synthesised on the fly (deterministic seed) so you can `SELECT` right away.
   - **Python questions** open in `python.html`. Pyodide pre-imports
     `collections`, `heapq`, `itertools`, `functools`, `math`, `re`, `json`,
     `random`. Toggle *+pandas/numpy* if you need them.
4. **Iterate** — `Ctrl/Cmd+Enter` to run; `Reset DB` / `Reset env` to start
   over; `Show solution` to peek; `Load solution` to drop the reference
   answer into the editor.

## Regenerating data

If the source workbook changes:

```bash
python3 interview/scripts/xlsx_to_json.py
python3 interview/scripts/extract_schemas.py
```

Both scripts are idempotent and only touch `interview/data/`.

## How the synthetic data generator works

`js/sample-gen.js` infers a SQLite type from each column name (`_id` →
INTEGER, `*amount/total/price*` → REAL, `_date/_at/_ts` → TEXT date,
`is_*` → INTEGER 0/1, etc.) and produces 12 plausible rows per table.

Foreign keys are resolved by name: a column `customer_id` will reuse IDs
from a `customers` table when both appear in the same question. The
generator is seeded by question id, so the same question always yields
the same rows — your queries are reproducible.

## Tech

- No build step. Plain ES modules, fetched directly by the browser.
- [sql.js](https://github.com/sql-js/sql.js) 1.10.3 — SQLite in WebAssembly (vendored under `vendor/sql.js/`)
- [Pyodide](https://pyodide.org) 0.26.4 — CPython 3.12 in WebAssembly
- The PaddySpeaks design tokens from `style.css` (Playfair / Source Serif /
  JetBrains Mono).

## SEO & discoverability

Each page ships:

- canonical `<link>`
- Open Graph (`og:title`, `og:description`, `og:image`, `og:url`, …)
- Twitter Card (`summary_large_image`)
- `<meta name="robots" content="index, follow, max-image-preview:large">`
- Inherits the site-wide `google-site-verification` token from the homepage
- JSON-LD `WebApplication` schema, the bank also includes a `BreadcrumbList`

The OG/Twitter share image is rendered by
`interview/scripts/make_og_image.py` and saved to
`images/og-interview-bank.png` (1200×630).

The new URLs are listed in `sitemap.xml` and explicitly allowed in
`robots.txt`.

### Submitting to Google Search Console

Site-level verification is already in place via the `google-site-verification`
meta tag on `index.html` (and now repeated on every interview-app page for
belt-and-braces). To make sure the new URLs are crawled quickly:

1. Open <https://search.google.com/search-console> and pick the
   `paddyspeaks.com` property.
2. Sitemaps → submit `https://paddyspeaks.com/sitemap.xml` (already known —
   resubmit so Google re-reads the new entries).
3. URL Inspection → paste `https://paddyspeaks.com/interview.app/` and click
   "Request Indexing". Repeat for `sql.html` and `python.html`.
4. Performance → filter by URL containing `interview.app` to track impressions
   and clicks once Google starts surfacing the pages (typically within a few
   days).

## Privacy

Code, queries, and selected questions stay in your browser. The only network
calls are the initial fetches of the static assets (HTML / CSS / JSON / WASM)
plus, on first run, the WASM bundles for sql.js and Pyodide from the jsDelivr
CDN. After that they're cached.
