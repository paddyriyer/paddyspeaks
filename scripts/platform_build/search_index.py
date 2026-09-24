"""Build the PaddySpeaks universal search index (P1.2) → data/search/*.json.

One document schema for every kind of content:

    {id, type, title, subtitle, text, tags, category, url, updated, source}

    type ∈ article | sacred | verse | name | music | topic | question |
           company | demo | tool | page | journey

Shards, so a search never downloads more than it needs:

    core.json       everything except the three large sets below (~ loaded on open)
    verses.json     Bhagavad Gita verses, translation and transliteration
    names.json      Vishnu and Lalitha Sahasranama names and meanings
    questions.json  Interview Studio question titles
    manifest.json   counts, shard sizes, generation inputs

Live JobSignal roles are deliberately NOT indexed here: they change every four
hours, so a committed copy would always be stale. The client reads companies
from /jobs/data/companies.json at query time and hands role searches to
JobSignal's own ranker (/jobs/search/?q=).

Deterministic: same repository → byte-identical shards (sorted, no timestamps).
"""
from __future__ import annotations

import html
import json
import re
import subprocess

from . import registry
from .common import ROOT, dump_json, read_json, strip_tags, write_if_changed

OUT = "data/search"
CAT_LABEL = {"technology": "Technology", "philosophy": "Philosophy", "ai": "AI & Future",
             "personality": "Personality Development"}


def _meta(text: str, name: str) -> str:
    m = re.search(r'<meta\s+(?:name|property)="%s"\s+content="([^"]*)"' % re.escape(name), text)
    return html.unescape(m.group(1)).strip() if m else ""


def _title(text: str) -> str:
    m = re.search(r"<title>(.*?)</title>", text, re.S)
    t = html.unescape(m.group(1)).strip() if m else ""
    return re.sub(r"\s*[|—–·]\s*(PaddySpeaks|PaddySpeaks Interview Studio)\b.*$", "", t).strip()


def _page(path: str) -> str:
    p = ROOT / (path + "index.html" if path.endswith("/") else path)
    return p.read_text(encoding="utf-8") if p.exists() else ""


def _clip(s: str, n: int) -> str:
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[: n - 1].rsplit(" ", 1)[0] + "…"


def doc(id_, type_, title, url, subtitle="", text="", tags=(), category="", updated="", source=""):
    d = {"id": id_, "type": type_, "title": title, "url": url}
    if subtitle:
        d["subtitle"] = subtitle
    if text:
        d["text"] = text
    if tags:
        d["tags"] = sorted({t for t in tags if t})
    if category:
        d["category"] = category
    if updated:
        d["updated"] = updated
    if source:
        d["source"] = source
    return d


def articles() -> list[dict]:
    out = []
    for m in read_json("article_metadata.json"):
        path = "articles/" + m["slug"]
        page = _page(path)
        tags = re.findall(r'<meta property="article:tag" content="([^"]+)"', page)
        kw = _meta(page, "keywords")
        heads = " · ".join(strip_tags(h) for h in re.findall(r"<h2[^>]*>(.*?)</h2>", page, re.S)[:10])
        out.append(doc(
            "article:" + m["slug"][:-5], "article", html.unescape(m["title"]), "/" + path,
            subtitle=CAT_LABEL.get(m["category"], m["category"]) + f" · {m['read_time']} min",
            text=_clip(" ".join([m.get("subtitle", ""), heads]), 520),
            tags=[html.unescape(t) for t in tags] + [k.strip() for k in kw.split(",")[:12]],
            category=m["category"], updated=m["date"][:10], source="article_metadata.json"))
    return out


def catalog_docs(cat) -> list[dict]:
    out = []
    for j in cat["journeys"]:
        out.append(doc("journey:" + j["id"], "journey", f"{j['label']} — {j['verb']}", j["href"],
                       subtitle="Start here", text=j["blurb"], source="catalog"))
    for t in cat["sacred_texts"]:
        page = _page(t["path"])
        out.append(doc("sacred:" + t["id"], "sacred", t["name"], "/" + t["path"],
                       subtitle=f"Sacred text · {t['language']}",
                       text=_clip(_meta(page, "description"), 320),
                       tags=[t["tradition"], t["language"]], category="learn", source="catalog"))
    for r in cat["devotional_resources"]:
        page = _page(r["path"])
        out.append(doc("music:" + r["id"], "music", r["name"], "/" + r["path"],
                       subtitle=f"Devotional music · {r['language']}",
                       text=_clip(_meta(page, "description"), 320), category="learn", source="catalog"))
    for sub in sorted((ROOT / "devotional-music").glob("*/index.html")):
        page = sub.read_text(encoding="utf-8")
        slug = sub.parent.name
        out.append(doc("music:" + slug, "music", _title(page), f"/devotional-music/{slug}/",
                       subtitle="Keertana · Bhadrachala Ramadasu",
                       text=_clip(_meta(page, "description"), 300), category="learn", source="devotional-music"))
    for tr in cat["interview_tracks"]:
        page = _page(tr["path"])
        out.append(doc("track:" + tr["id"], "topic", tr["name"], "/" + tr["path"],
                       subtitle="Interview Studio · " + tr["group"].title(),
                       text=_clip(_meta(page, "description"), 300), category="prepare", source="catalog"))
    for d in cat["demos"]:
        page = _page(d["path"])
        out.append(doc("demo:" + d["id"], "demo", d["name"], "/" + d["path"],
                       subtitle=f"Demo · {d['data']} data",
                       text=_clip(_meta(page, "description"), 300), category="build", source="catalog"))
    for d in cat["tools"]:
        page = _page(d["path"]) or _page(d["path"] + "README.md")
        out.append(doc("tool:" + d["id"], "tool", d["name"], "/" + d["path"],
                       subtitle="Tool", text=_clip(_meta(page, "description"), 300), category="build", source="catalog"))
    for d in cat["jobs_products"]:
        page = _page(d["path"])
        out.append(doc("jobs:" + d["id"], "page", d["name"], "/" + d["path"],
                       subtitle="JobSignal", text=_clip(_meta(page, "description"), 240), category="find", source="catalog"))
    for d in cat["pages"]:
        page = _page(d["path"])
        out.append(doc("page:" + d["id"], "page", d["name"], "/" + d["path"],
                       subtitle="PaddySpeaks", text=_clip(_meta(page, "description"), 240), source="catalog"))
    return out


def design_docs() -> list[dict]:
    out = []
    for p in sorted((ROOT / "interview.app/design").glob("the-*-problem.html")):
        page = p.read_text(encoding="utf-8")
        out.append(doc("design:" + p.stem, "topic", _title(page), f"/interview.app/design/{p.name}",
                       subtitle="Interview Studio · Design problem",
                       text=_clip(_meta(page, "description"), 300), category="prepare", source="interview.app/design"))
    for p in sorted((ROOT / "interview.app/design").glob("*.html")):
        if p.name.startswith("the-") or p.name in ("index.html", "data-modeling.html", "data-modeling.studio.html"):
            continue
        page = p.read_text(encoding="utf-8")
        out.append(doc("design:" + p.stem, "topic", _title(page), f"/interview.app/design/{p.name}",
                       subtitle="Interview Studio · Design deep-dive",
                       text=_clip(_meta(page, "description"), 300), category="prepare", source="interview.app/design"))
    dm = (ROOT / "interview.app/design/data-modeling.html").read_text(encoding="utf-8")
    for sid, title in re.findall(r'<h2 id="h-(sc-[a-z0-9-]+)">(.*?)</h2>', dm, re.S):
        out.append(doc("model:" + sid, "topic", html.unescape(strip_tags(title)),
                       f"/interview.app/design/data-modeling.html#{sid}",
                       subtitle="Interview Studio · Data model", category="prepare", source="data-modeling.html"))
    return out


def interview_docs() -> tuple[list[dict], list[dict]]:
    topics = read_json("interview/data/topics.json")
    core = []
    for t in topics["types"]:
        core.append(doc("itopic:" + t["name"], "topic", t["name"], "/interview.app/?topic=" + _q(t["name"]),
                        subtitle=f"Interview topic · {t['count']} questions", category="prepare", source="topics.json"))
    for c in read_json("interview/data/companies.json"):
        core.append(doc("company:" + _slug(c["name"]), "company", c["name"], "/interview.app/?company=" + _q(c["name"]),
                        subtitle=f"Company · {c['count']} interview questions",
                        text=f"Data engineering interview questions asked at {c['name']}: SQL, Python and data modeling, with answers you can run in the browser.",
                        category="prepare", source="companies.json"))
    qs = []
    for q in read_json("interview/data/questions.json"):
        sub = " · ".join(x for x in [q.get("company") or "", q.get("type") or "", (q.get("difficulty") or "")] if x)
        qs.append(doc("q:" + q["id"], "question", q["title"], "/interview.app/?q=" + _q(q["title"]),
                      subtitle=sub, tags=q.get("tags") or [], category="prepare", source="questions.json"))
    return core, qs


def sacred_docs() -> tuple[list[dict], list[dict], list[dict]]:
    raw = json.loads(subprocess.run(["node", str(ROOT / "scripts/platform_build/extract_sacred.mjs")],
                                    capture_output=True, check=True, text=True).stdout)
    chapters = [doc(f"gita:ch{c['chapter']}", "sacred", f"Bhagavad Gita, Chapter {c['chapter']}: {c['title']}",
                    f"/bhagavad-gita/#chapter-{c['chapter']}-sloka-1", subtitle=f"Sacred text · {c['sanskrit']}",
                    text=c["meaning"], category="learn", source="bhagavad-gita/data.js")
                for c in raw["gita"]["chapters"]]
    verses = [doc(f"gita:{v['chapter']}.{v['verse']}", "verse", f"Bhagavad Gita {v['chapter']}.{v['verse']}",
                  f"/bhagavad-gita/#chapter-{v['chapter']}-sloka-{v['verse']}",
                  subtitle="Sacred text · Bhagavad Gita", text=v["translation"],
                  tags=[v["translit"], v["words"]], category="learn", source="bhagavad-gita/data.js")
              for v in raw["gita"]["verses"]]
    names = []
    for key, work, url in (("vishnu", "Vishnu Sahasranama", "/vishnu-sahasranama/"),
                           ("lalitha", "Lalitha Sahasranama", "/lalitha-sahasranama/")):
        for n in raw[key]:
            anchor = f"#name-{n['num']}" if key == "lalitha" else ""
            names.append(doc(f"{key}:{n['num']}", "name", f"{n['iast']} · {n['deva']}", url + anchor,
                             subtitle=f"{work} · name {n['num']}", text=n["meaning"],
                             category="learn", source=f"{url.strip('/')}/data.js"))
    return chapters, verses, names


def _q(s: str) -> str:
    from urllib.parse import quote
    return quote(s, safe="")


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def build() -> dict[str, list[dict]]:
    cat = read_json(registry.CATALOG)
    chapters, verses, names = sacred_docs()
    icore, questions = interview_docs()
    core = articles() + catalog_docs(cat) + design_docs() + icore + chapters
    core.sort(key=lambda d: d["id"])
    return {"core": core, "verses": verses, "names": names, "questions": questions}


def _pack(docs: list[dict]) -> dict:
    """Hoist fields every doc in a shard shares into 'defaults' (the client
    merges them back). Cuts the large shards by a fifth with no information lost."""
    shared = {}
    for k in ("type", "category", "source", "subtitle"):
        vals = {d.get(k) for d in docs}
        if len(vals) == 1 and None not in vals:
            shared[k] = vals.pop()
    slim = [{k: v for k, v in d.items() if k not in shared} for d in docs]
    return {"defaults": shared, "docs": slim} if shared else {"docs": slim}


def run(write: bool) -> list[str]:
    shards = build()
    texts = {name: dump_json(_pack(docs), compact=True) for name, docs in shards.items()}
    manifest = {
        "$comment": "GENERATED by scripts/platform_build/build.py search. Schema: docs/PLATFORM-DATA.md#search.",
        "schema": ["id", "type", "title", "subtitle", "text", "tags", "category", "url", "updated", "source"],
        "shards": {n: {"docs": len(shards[n]), "bytes": len(texts[n].encode("utf-8"))} for n in shards},
        "types": sorted({d["type"] for docs in shards.values() for d in docs}),
        "runtime": {"jobs": "/jobs/data/companies.json (companies) and /jobs/search/?q= (roles), never snapshotted"},
    }
    texts["manifest"] = dump_json(manifest)
    problems = []
    for name, text in texts.items():
        path = f"{OUT}/{name}.json"
        if write:
            if write_if_changed(path, text):
                print(f"  wrote {path} ({len(text.encode('utf-8')) // 1024} KB)")
        else:
            p = ROOT / path
            if not p.exists() or p.read_text(encoding="utf-8") != text:
                problems.append(f"{path} is stale — run: python3 scripts/platform_build/build.py search")
    ids = [d["id"] for docs in shards.values() for d in docs]
    if len(ids) != len(set(ids)):
        dup = sorted({i for i in ids if ids.count(i) > 1})[:5]
        problems.append(f"search index has duplicate ids: {dup}")
    return problems
