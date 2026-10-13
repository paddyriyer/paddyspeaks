# Company Interview Loops (`/interview.app/company-loops/`)

Company-specific five-loop interview practice for data engineering, software
engineering, data architecture, analytics engineering and AI infrastructure roles.
Built on 2026-10-13 at Paddy's request (the "Company-Specific Five-Loop Technical
Interview Simulator" master prompt), with three decisions recorded from him:

1. **Real company names, labelled as simulated.** Every question says it is a
   simulated practice scenario set in the company's public product domain, not a
   question from that company's interviews. This narrows the older "never attribute
   questions to companies" rule to its point: never claim provenance.
2. **Engine first, then companies in batches.** The first release ships the full
   engine with OpenAI and Stripe complete; the other companies are listed as
   *planned* and follow about four per PR.
3. **Rules + bring-your-own-key follow-ups.** Deterministic follow-up rules work for
   everyone at no cost; a visitor's own Anthropic key (the one `/interview.app/mock-ai/`
   stores) adds fully adaptive follow-ups. No server-side model, no new spend.

## The five loops

| Loop | Focus | Template mix per company |
|---|---|---|
| 1 | SQL + DSA | 3 `sql` + 2 `python` (all executable) |
| 2 | Advanced DSA + core data engineering | 2 `python` + 1 `debug` (executable) + 2 `design` |
| 3 | Data modeling + low-level design | 4 `design` + 1 `sql` (a query against a given model) |
| 4 | High-level system design | 5 `design`, each with Production Reality Check incidents |
| 5 | Architecture leadership + project deep dive | 5 `leadership` |

At least five templates per loop per company; the build fails with fewer.

## Files

```
interview/company-loops/
├── companies.json          every company (available | planned), overview, domains, sources
├── config.json             roles, seniority, difficulty, modes, languages, dialects, rubrics
├── templates/<company>/loopN.md        candidate-facing templates
├── templates/<company>/loopN.eval.md   evaluator notes + reference solutions
├── build.py                → interview.app/company-loops/data/*.json  (--check in CI)
├── validate.mjs            proves every generator against its reference (Node + PGlite)
└── pyrun.py                runs Python references for validate.mjs
interview.app/company-loops/
├── index.html  app.js  app.css  py-worker.js
├── js/rng.js               seeded RNG + SQL helpers (generators import it)
├── js/compare.js           result comparison (page and CI share it)
├── gen/<company>/<ID>.mjs  generators for executable templates (shipped as-is)
└── data/                   GENERATED
```

## Template format (`loopN.md`)

```
## OAI-L1-01: Title
| | |
|---|---|
| **Template ID** | OAI-L1-01 |          <- <PREFIX>-L<loop>-<two digits>, unique
| **Loop** | 1 |
| **Kind** | sql |                         <- sql | python | debug | design | leadership
| **Topic** | Area / subtopic |
| **Difficulty** | Medium, Hard, Very Hard |   <- the levels this template supports
| **Minutes** | 25 |
| **Roles** | data-engineer, analytics-engineer |   <- ids from config.json; drives selection
| **Generator** | OAI-L1-01.mjs |           <- required for sql, python, debug

```params                                   <- required for design and leadership
{"daily_events": {"2": ["2 billion"], "3": ["30 billion"]}, "regions": [3, 5, 8]}
```                                          (a list, or per-level lists keyed "1","2","3")

**Business Scenario.** … {{placeholders}} …
**Problem Statement.** …
**Constraints.** …
**Assumptions.** …                           <- say which numbers are hypothetical
**Clarifications.**
- Q: question a candidate might ask | A: the interviewer's answer
**Hints.**
1. progressive hint
**Follow-ups.**
1. 2 to 5 numbered, progressively harder
**Follow-up rules.**
- when: keyword, another phrase → ask: a follow-up that reacts to what they wrote
**Production Reality Check.**                <- required in loops 3 and 4 (≥ 2 bullets)
- an incident consistent with the scenario's parameters
**Evaluation Criteria.** …
```

Placeholders come from `params` (design and leadership) or from the generator's
`vars` (executable kinds). The build fails on any placeholder nothing supplies.

## Evaluator format (`loopN.eval.md`)

`## <ID>` per template. Executable kinds carry the reference in a tagged fence:
` ```sql reference ` (PostgreSQL; may use the instance's `{{placeholders}}`) or
` ```python reference ` (defines the `entry` function). Then: explanation,
complexity, dialect notes (other SQL dialects are described, not executed),
edge cases, common mistakes, follow-up guidance, rubric anchors (2 / 3 / 4),
strong signals and red flags. Design templates add a reference architecture,
competing designs to accept, bottlenecks and failure modes, and incident
guidance. Leadership templates describe what a strong evidence-based answer
contains and never supply a model story.

## Executable templates (generators)

A generator is an ES module in `interview.app/company-loops/gen/<company>/`. It
imports only `../../js/rng.js` and never uses `Math.random`, so the same seed
gives the same question everywhere.

**sql**: `export const kind = "sql"; export function generate(r, level)` returns
`{ vars, setup, tables, expected: {columns, rows}, diagnostics: [{message, rows}] }`.
`setup` is PostgreSQL DDL and inserts (start it with `SET TIME ZONE 'UTC';`).
`expected` is computed **in JavaScript** from the same generated data (the
oracle). Diagnostics are known wrong answers computed with one rule broken;
filter out any that equal the expected rows.

**python / debug**: exports `kind, entry, signature, starter, prelude` and
`generate(r, level)` returning `{ vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }`.
`args` is a Python expression for the argument tuple; `expect` a Python literal
computed by a JavaScript `oracle()` (brute force is fine for small inputs). A test
without `expect` (a timing test) is compared with the reference at check time.
For `debug`, `starter` is the buggy code the candidate fixes.

**Proof**: `validate.mjs` runs every generator for many seeds at every level and
fails unless the evaluator's reference returns exactly the oracle's result (SQL
in PGlite, Python through `pyrun.py`), the expected result is non-empty, no
diagnostic equals it, and each reference clears its timing test with room to
spare. The reference and the oracle are written independently, so each checks
the other.

## Rules

- **Simulated, never attributed.** No question claims to come from a company's
  interviews or to reflect its internal systems; `build.py` fails on phrases such
  as "asked at", "real interview question", "confidential". Scenarios use public
  product domains only, and all numbers are hypothetical.
- **Distinct per company.** Companies get different problems, not renamed ones.
- **Sources** in `companies.json` are public product documentation confirmed by web
  search, with the date; `verified_by` says they were not fetched. Publicly reported
  interview topics come only from Interview Intelligence (`/interview.app/reported/`).
- **Never type an expected output.** Generators compute it; CI proves it.
- **Evaluator text never enters `<company>.json`.** The page loads
  `<company>.eval.json` only on reveal or after a mock or assessment (hiding, not
  secrecy: both files are public).
- **Only Python and PostgreSQL run in the browser.** Java, Scala, C++ and the other
  SQL dialects are accepted as written answers and scored by the candidate.
- **Scores are self-scores.** The page never suggests they predict a company's
  hiring decision.

## Adding a company

Write `templates/<id>/loop1–5.md` and `.eval.md` (≥ 5 templates per loop), the
generators, and the sources in `companies.json`. Then set `status` to `available`
and run `python3 interview/company-loops/build.py` and
`node interview/company-loops/validate.mjs --seeds 25`.
