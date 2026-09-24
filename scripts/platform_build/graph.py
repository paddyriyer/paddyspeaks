"""PaddySpeaks knowledge graph (P2.1) and "Explore further" data (P2.2).

No graph database: a typed edge list in JSON, built from four sources, each
with its provenance kept on the edge so every suggestion can say WHY:

    curated   data/graph/concepts.json — a person chose these, typed
              (explains, appliesTo, preparesFor, relatedTo, questionTests)
    link      a real hyperlink in a page's content to another indexed page
              ("You Might Also Enjoy" cards are excluded: they were chosen by a
              filename hash, not by meaning — docs/PADDYSPEAKS-PLATFORM-AUDIT.md)
    series    article_metadata.json "series" — consecutive parts
    tags      two articles sharing at least two explicit article:tag values
    structure a Gita chapter belongs to the Gita (chapterOf)

Outputs
    data/graph.json              nodes + edges (the Atlas and the public API read it)
    data/related/<section>.json  per-page "Explore further" lists, one shard per
                                 site section so a page downloads only its own

Deterministic: sorted everywhere, no timestamps.
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from urllib.parse import urljoin

from .common import ROOT, SITE, dump_json, read_json, write_if_changed

CONCEPTS = "data/graph/concepts.json"
SHARDS = ("core", "verses", "names", "questions")
REL_LABEL = {
    "explains": "Explains", "appliesTo": "Applies it", "preparesFor": "Prepares you for",
    "relatedTo": "Related", "questionTests": "Practise it", "references": "Linked",
    "next": "Next in series", "prev": "Previous in series", "sharesTags": "Shares tags",
    "chapterOf": "Part of",
}
# Tags every article carries say nothing about what two essays share.
GENERIC_TAGS = {"paddyspeaks", "paddy iyer", "paddy", "technology", "philosophy", "ai", "article",
                "blog", "essay", "artificial intelligence", "personality development", "linkedin"}
PAGE_TYPES = {"article", "sacred", "music", "topic", "demo", "tool", "page", "concept"}


def load_docs() -> list[dict]:
    docs = []
    for s in SHARDS:
        p = ROOT / "data" / "search" / f"{s}.json"
        if not p.exists():
            continue
        j = json.loads(p.read_text(encoding="utf-8"))
        defs = j.get("defaults", {})
        for d in j["docs"]:
            docs.append({**defs, **d})
    return docs


def norm_url(u: str) -> str:
    u = u.split("#")[0].split("?")[0]
    if u.endswith("/index.html"):
        u = u[: -len("index.html")]
    return u


def page_file(url: str):
    path = url.lstrip("/")
    p = ROOT / (path + "index.html" if (path.endswith("/") or not path) else path)
    return p if p.exists() else None


STRIP = re.compile(
    r'<a\b[^>]*class="related-article-card"[^>]*>.*?</a>'
    r"|<(nav|header|footer|script|style)\b.*?</\1>", re.S | re.I)


def content_links(url: str, text: str) -> list[str]:
    body = text[text.find("<body"):] if "<body" in text else text
    body = STRIP.sub(" ", body)
    base = SITE + url
    out = []
    for h in re.findall(r'href="([^"]+)"', body):
        if h.startswith(("mailto:", "tel:", "javascript:", "#", "data:")):
            continue
        absu = urljoin(base, h)
        if not absu.startswith(SITE + "/"):
            continue
        out.append(norm_url(absu[len(SITE):]))
    return out


def build():
    docs = load_docs()
    by_id = {d["id"]: d for d in docs}
    page_by_url = {}
    for d in sorted(docs, key=lambda d: d["id"]):
        if d["type"] in PAGE_TYPES and "#" not in d["url"] and "?" not in d["url"]:
            page_by_url.setdefault(norm_url(d["url"]), d["id"])

    edges = set()          # (src, rel, dst, via)
    problems = []

    # curated concepts
    concepts = read_json(CONCEPTS)["concepts"]
    for c in concepts:
        for rel, dst in c["edges"]:
            if dst not in by_id:
                problems.append(f"{CONCEPTS}: {c['id']} → '{dst}' is not in the search index")
                continue
            edges.add((c["id"], rel, dst, "curated"))

    # real content links
    for url, src in sorted(page_by_url.items()):
        if src.startswith(("page:", "journey:", "concept:")):
            continue
        f = page_file(url)
        if not f:
            continue
        seen = set()
        for target in content_links(url, f.read_text(encoding="utf-8", errors="replace")):
            dst = page_by_url.get(target)
            if dst and dst != src and dst not in seen and not dst.startswith(("page:", "journey:")):
                seen.add(dst)
                edges.add((src, "references", dst, "link"))

    # series + tags
    meta = read_json("article_metadata.json")
    series = defaultdict(list)
    for m in meta:
        if m.get("series"):
            series[m["series"]].append((m.get("series_part", 0), "article:" + m["slug"][:-5]))
    for parts in series.values():
        parts.sort()
        for (_, a), (_, b) in zip(parts, parts[1:]):
            edges.add((a, "next", b, "series"))
    tags = {}
    for d in docs:
        if d["type"] == "article":
            tags[d["id"]] = {t.lower() for t in d.get("tags", []) if 2 < len(t) < 40} - GENERIC_TAGS
    ids = sorted(tags)
    for i, a in enumerate(ids):
        best = []
        for b in ids:
            if b == a:
                continue
            shared = tags[a] & tags[b]
            if len(shared) >= 2:
                best.append((-len(shared), b, sorted(shared)))
        for _, b, shared in sorted(best)[:3]:
            edges.add((a, "sharesTags", b, "tags:" + ", ".join(shared[:3])))

    # structure
    for d in docs:
        if d["id"].startswith("gita:ch"):
            edges.add((d["id"], "chapterOf", "sacred:bhagavad-gita", "structure"))

    concept_nodes = {c["id"]: {"title": c["label"], "type": "concept", "url": "/atlas/?c=" + c["id"].split(":", 1)[1]}
                     for c in concepts}
    used = {e[0] for e in edges} | {e[2] for e in edges}
    nodes = {}
    for n in sorted(used):
        if n in concept_nodes:
            nodes[n] = concept_nodes[n]
        elif n in by_id:
            d = by_id[n]
            nodes[n] = {"title": d["title"], "type": d["type"], "url": d["url"]}
    graph = {
        "$comment": "GENERATED by scripts/platform_build/build.py graph. Edge = [source, relation, target, provenance]. docs/KNOWLEDGE-GRAPH.md.",
        "nodes": nodes,
        "edges": [list(e) for e in sorted(edges)],
    }
    return graph, concepts, page_by_url, problems


def explain(rel: str, via: str, direction: str, concept_label: str = "") -> str:
    if via == "curated":
        return f"{concept_label}" if concept_label else REL_LABEL.get(rel, rel)
    if via == "link":
        return "Linked from this page" if direction == "out" else "Links to this page"
    if via == "series":
        return "Next in the series" if direction == "out" else "Previous in the series"
    if via.startswith("tags:"):
        return "Shares tags: " + via[5:]
    return REL_LABEL.get(rel, rel)


def related(graph: dict, concepts: list, page_by_url: dict) -> dict[str, dict[str, list]]:
    nodes = graph["nodes"]
    out_e, in_e = defaultdict(list), defaultdict(list)
    for s, r, d, v in graph["edges"]:
        out_e[s].append((r, d, v))
        in_e[d].append((r, s, v))
    clabel = {c["id"]: c["label"] for c in concepts}
    shards: dict[str, dict[str, list]] = defaultdict(dict)
    for url, nid in sorted(page_by_url.items()):
        cand: dict[str, tuple[int, str]] = {}

        def add(target, score, why):
            if target == nid or target not in nodes or target.startswith(("journey:", "page:")):
                return
            if norm_url(nodes[target]["url"]) == url:     # a verse of the page you are on
                return
            if nodes[target]["type"] == "question":
                return
            if target not in cand or cand[target][0] < score:
                cand[target] = (score, why)

        # via shared concepts (a person decided these belong together)
        for r, c, v in in_e.get(nid, []):
            if c.startswith("concept:"):
                add(c, 90, "Connected idea")
                for r2, other, v2 in out_e.get(c, []):
                    add(other, 80, "Also about: " + clabel.get(c, "a related idea"))
        if nid.startswith("concept:"):
            for r2, other, v2 in out_e.get(nid, []):
                add(other, 85, REL_LABEL.get(r2, r2))
        for r, d, v in out_e.get(nid, []):
            if not d.startswith("concept:"):
                add(d, 70 if v == "series" else 60 if v == "link" else 40, explain(r, v, "out"))
        for r, s, v in in_e.get(nid, []):
            if not s.startswith("concept:"):
                add(s, 65 if v == "series" else 50 if v == "link" else 35, explain(r, v, "in"))
        if not cand:
            continue
        ranked, per_type = [], defaultdict(int)
        for k, v in sorted(cand.items(), key=lambda kv: (-kv[1][0], nodes[kv[0]]["title"])):
            t = nodes[k]["type"]
            if per_type[t] >= 3:          # a varied list: at most three of any kind
                continue
            per_type[t] += 1
            ranked.append((k, v))
            if len(ranked) == 8:
                break
        items = [{"id": k, "title": nodes[k]["title"], "type": nodes[k]["type"], "url": nodes[k]["url"], "why": w}
                 for k, (_, w) in ranked]
        seg = url.strip("/").split("/")[0] or "home"
        shard = "articles" if seg == "articles" else "interview" if seg == "interview.app" else "site"
        shards[shard][url] = items
    return shards


def run(write: bool) -> list[str]:
    graph, concepts, page_by_url, problems = build()
    files = {"data/graph.json": dump_json(graph, compact=True)}
    for shard, m in related(graph, concepts, page_by_url).items():
        files[f"data/related/{shard}.json"] = dump_json(m, compact=True)
    for path, text in files.items():
        if write:
            if write_if_changed(path, text):
                print(f"  wrote {path} ({len(text.encode()) // 1024} KB)")
        else:
            p = ROOT / path
            if not p.exists() or p.read_text(encoding="utf-8") != text:
                problems.append(f"{path} is stale — run: python3 scripts/platform_build/build.py graph")
    return problems
