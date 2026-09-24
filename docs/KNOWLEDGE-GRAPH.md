# Knowledge graph, "Explore further" and the Atlas

P2.1–P2.3. How PaddySpeaks connects its knowledge, and the one rule behind it:
**every connection must be explainable.** No similarity guessing, no filename
hashes, no generated relations. Each edge records where it came from, and each
suggestion shown to a reader says why it is there.

## Data

| File | What | Written by |
|---|---|---|
| `data/graph/concepts.json` | Concept nodes: label, aliases, a short neutral definition, and typed edges to existing ids | a person |
| `data/graph.json` | All nodes and edges: `[source, relation, target, provenance]` | `build.py graph` |
| `data/related/{articles,interview,site}.json` | Per-page "Explore further" lists, sharded by site section | `build.py graph` |

Node ids are the search-index ids (`article:<slug>`, `sacred:<id>`,
`gita:2.47`, `track:<id>`, `design:<page>`, `model:<scenario>`,
`itopic:<topic>`, `company:<slug>`, `demo:<id>`, `tool:<id>`, `concept:<id>`).
The search index, the graph and the Atlas therefore always agree on what
exists.

## Where edges come from

| Provenance | Relation(s) | Source | Why it is defensible |
|---|---|---|---|
| `curated` | explains, appliesTo, preparesFor, relatedTo, questionTests | `concepts.json` | A person decided it. The build fails if a target id does not exist. |
| `link` | references | real hyperlinks in a page's own content | The author linked them. Nav, header, footer and the old hash-picked "You Might Also Enjoy" cards are stripped first. |
| `series` | next | `article_metadata.json` `series` / `series_part` | The author numbered them. |
| `tags:<shared>` | sharesTags | two or more shared explicit `article:tag` values (generic tags like "paddyspeaks" excluded) | The tags are on the page, and the shared tags are shown to the reader. |
| `structure` | chapterOf | Gita chapter → Gita | Textual structure. |

The relation vocabulary from the plan (`prerequisiteFor`, `mentionedIn`,
`verseOf`, `jobRequires`) is reserved. Add edges of those types to
`concepts.json` when there is content that supports them, and add the label to
`REL_LABEL` in `graph.py` and `REL` in `lib/ps-atlas.js`.

### The existing "You Might Also Enjoy" blocks

113 articles carry a "You Might Also Enjoy" block written by
`scripts/add_related_articles.py`, which picks three same-category articles
**by filename hash**. Those are arbitrary, so the graph ignores them. They are
left in place (they are working UI), and "Explore further" is inserted above
them. Replacing them is in the backlog.

## Explore further (`lib/ps-related.js`)

Loaded by `lib/ps-platform.js`, at browser idle, on content pages (those with
`<meta name="ps:continue">`). It fetches one shard, looks up
`location.pathname`, and renders up to 8 items with at most 3 of any one type.
Each item has a type badge and a **why** line: "Also about: Karma yoga",
"Linked from this page", "Next in the series", "Shares tags: b2b, decision
abyss". A page with no connections shows nothing.

Ranking (in `graph.py → related()`): a shared curated concept (80–90) beats a
series edge (65–70), which beats a real link (50–60), which beats shared tags
(35–40). A verse on the page you are reading is never suggested back to you.

## The Atlas (`/atlas/`, `lib/ps-atlas.js`)

The Atlas sits above everything else and replaces nothing. It combines:

1. **Search**: `lib/ps-search.js` in page mode (`[data-ps-search-page]`),
   with `?q=` kept in the URL so an Atlas view is shareable. The homepage's
   `SearchAction` structured data now targets `/atlas/?q=`.
2. **Concept view**: when the query contains a concept's label or alias
   ("karma without attachment" → Karma yoga), or `?c=<id>` is set, a panel
   shows the definition and every connection, grouped by relation.
3. **Intent view**: when the query names a company Interview Studio knows
   ("Meta data engineer"), a panel assembles that company's questions, its
   JobSignal page if it has live roles, a live-role search, and the
   company-research, behavioral (STAR), resume and design tracks.

Everything is deterministic and runs in the browser from committed JSON plus
`/jobs/data/companies.json`. **No model is called.**

### Architecture for later synthesis (not built)

If AI synthesis is ever added ("summarise what PaddySpeaks says about karma
yoga"), it must:

- take as input **only** the Atlas's deterministic result set (the top results
  plus the concept panel's connected items), never the open web;
- **cite** every claim to one of those items by id and link;
- run behind an explicit user action ("Summarise these"), never on page load;
- be labelled as AI-generated, per `/disclaimer/#ai`;
- be cost-bounded: a Worker route with per-IP limits like the scan proxy,
  cached per (query, index version).

That keeps AI an optional reading aid on top of excellent structured search,
not a replacement for it.

## Adding a concept

1. Add it to `data/graph/concepts.json`. Keep the definition short and
   neutral, the aliases to what readers actually type, and the edges to ids
   that already exist (find them in `data/search/core.json` or `verses.json`).
2. Run `python3 scripts/platform_build/build.py search graph pages`. The
   concept becomes a search result, an Atlas entry point and a related item.
3. CI (`build.py check`) fails if a target id is missing or a generated file
   is stale.
