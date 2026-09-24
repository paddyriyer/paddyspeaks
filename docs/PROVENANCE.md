# Provenance, verification and corrections

How PaddySpeaks records where content comes from and what has been checked,
and how it logs corrections. Built for P0.2 and P0.3 of the platform plan.

**The one rule:** a record may never claim more than the repository can
show. "Not recorded" is a valid, honest answer. An invented source is not.
`scripts/platform_build/checks.py` enforces this in CI.

## Where things live

| What | File | Rendered by |
|---|---|---|
| Per-work provenance | `data/provenance/<id>.json` (id = catalog id) | `lib/ps-sources.js`: the collapsed *Sources & Verification* panel |
| JSON Schema | `data/provenance/schema.json` | editors / validators |
| Corrections log | `data/corrections.json` | `/corrections/` (build step `pages`) and the panel on the corrected page |

Mount the panel on any page:

```html
<script defer src="/lib/ps-sources.js" data-provenance="bhagavad-gita"></script>
```

Without `data-provenance`, the script shows only the corrections recorded for
that page's URL, and nothing at all when there are none.

## Provenance record

```jsonc
{
  "id": "vishnu-sahasranama",            // = data/platform/catalog.json id
  "type": "sacred-text",                 // sacred-text | article | dataset
  "url": "/vishnu-sahasranama/",
  "title": "Vishnu Sahasranama",
  "work": { "title": "…", "language": "Sanskrit" },
  "attribution": {
    "composer": "…",                     // as the repo states it
    "traditionalLocation": "Mahabharata, Anushasana Parva, chapter 149",
    "note": "why we say so, if not obvious"
  },
  "sources": [
    {
      "role": "text",                    // text | transliteration | translation | commentary | reference | data
      "label": "sanskritdocuments.org",
      "url": "https://sanskritdocuments.org/",   // optional; http(s) or an existing site path
      "kind": "secondary",               // primary | secondary | reference
      "note": "optional detail"
    }
  ],
  "editor": "Paddy Iyer",                // who prepared the page
  "translation": { "by": null, "note": "who translated, or that it is not recorded" },
  "status": "source-noted",              // see below
  "statusNote": "required for source-not-recorded",
  "verification": [
    {
      "method": "what was compared with what",
      "scope": "text-against-source",    // REQUIRED for status 'verified'
      "verifiedOn": "YYYY-MM-DD",        // REQUIRED for status 'verified'
      "tool": "optional script",
      "runs": "optional cadence"
    }
  ],
  "knownIssues": [ { "since": "YYYY-MM-DD", "summary": "…", "tracking": "…" } ],
  "lastReviewed": null,                  // YYYY-MM-DD, never in the future
  "recordedFrom": "vishnu-sahasranama/data.js header comment",
  "recordedText": "the exact words the source file uses",
  "citation": { "scheme": "chapter.verse", "example": "Bhagavad Gita 2.47" }
}
```

### Status values

| Status | Meaning | CI rule |
|---|---|---|
| `source-noted` | The source file names a source. It has not been re-checked against it. | needs at least one `sources[]` entry |
| `source-not-recorded` | The source file does not say where the text came from. | needs a `statusNote` saying so |
| `under-review` | A known problem is being worked through. | put the problem in `knownIssues` |
| `verified` | The **text** was compared with a named source on a date. | needs a `verification[]` entry with `scope: "text-against-source"` and `verifiedOn` |

A consistency check (for example `.github/scripts/validate_abhirami.js`,
which checks that the interpretation layer matches the committed Tamil) is
recorded under `verification` with its real scope. It does **not** make a text
`verified`, because it does not compare the text with its source.

### Citation schemes

`chapter.verse` (Bhagavad Gita), `dashaka.verse` (Narayaneeyam), `verse`
(most stotras), `name` (sahasranamas), `section` (Rudram, rituals). A precise
citation is written as *Work chapter.verse*, e.g. **Bhagavad Gita 2.47**.

### State as of 2026-09-24

The 23 records were written only from what the repository already stated,
mostly the header comment of each `data.js`:

- 13 `source-noted`
- 9 `source-not-recorded`: Rudram, Sandhyavandanam, Narayaneeyam, Amavasya
  Tharpanam, Hanuman Chalisa, Bajrang Baan, Subramanya Bhujangam, Bhaja
  Govindam, Kanda Shashti Kavacham. For the last five, the attribution is
  recorded but no text source is.
- 1 `under-review`: Abhirami Andhadhi, whose inherited English meanings are
  misaligned for many verses.

No record is `verified`. Adding a real source, or doing a real verification
pass, is the next editorial step for each. Both are listed in the backlog.

## Corrections

```jsonc
{
  "id": "2026-09-18-abhirami-translations",   // unique, date-prefixed
  "date": "2026-09-18",
  "url": "/abhirami-andhadhi/",               // the page corrected (must exist)
  "also": ["/other/page/"],                   // optional, must exist
  "title": "Abhirami Andhadhi: English meanings",
  "kind": "translation",   // factual | translation | technical | data | statistics | attribution | citation
  "summary": "What was wrong, what it is now, in plain words.",
  "status": "open"         // optional: work continues
}
```

Newest first. **Log a correction when a change alters meaning**: a fact, a
figure, a translation, an attribution, a citation, or a technical claim. Do not
log typos, layout or refactors. Git keeps those, and they are noise to a
reader. Then run `python3 scripts/platform_build/build.py pages` so
`/corrections/` updates. CI fails if it is stale.
