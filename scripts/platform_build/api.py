"""Static public read-only feeds (P2.4) → api/v1/*.json. docs/PUBLIC-API.md.

Only data that is already public on the site, in a stable shape. Nothing
personal, nothing from D1, nothing from browsers. Each file carries an
"api" envelope with its version and the source it is derived from.
"""
from __future__ import annotations

import html

from . import registry
from .common import ROOT, SITE, dump_json, read_json, write_if_changed

VERSION = "v1"


def envelope(kind: str, source: str, data) -> dict:
    return {"api": {"version": VERSION, "kind": kind, "source": source,
                    "docs": "https://github.com/paddyriyer/paddyspeaks/blob/main/docs/PUBLIC-API.md", "license": "See " + SITE + "/copyright/"},
            "data": data}


def build() -> dict[str, dict]:
    cat = read_json(registry.CATALOG)
    reg = read_json(registry.REGISTRY)
    out = {}
    out["articles"] = envelope("articles", "article_metadata.json", [
        {"slug": m["slug"][:-5], "title": html.unescape(m["title"]), "subtitle": html.unescape(m.get("subtitle") or ""),
         "category": m["category"], "published": m["date"][:10], "readMinutes": m["read_time"],
         "url": f"{SITE}/articles/{m['slug']}",
         "image": (SITE + "/" + m["hero_image"]) if m.get("hero_image") and not m["hero_image"].startswith("http") else (m.get("hero_image") or None),
         **({"series": m["series"], "seriesPart": m.get("series_part")} if m.get("series") else {})}
        for m in sorted(read_json("article_metadata.json"), key=lambda m: (m["date"], m["slug"]), reverse=True)])
    texts = []
    for t in cat["sacred_texts"]:
        pv = read_json(f"data/provenance/{t['id']}.json")
        texts.append({"id": t["id"], "name": t["name"], "language": t["language"], "tradition": t["tradition"],
                      "url": f"{SITE}/{t['path']}", "provenanceStatus": pv["status"],
                      "provenance": f"{SITE}/data/provenance/{t['id']}.json"})
    out["sacred-texts"] = envelope("sacred-texts", "data/platform/catalog.json + data/provenance/", texts)
    out["changelog"] = envelope("changelog", "data/changelog.json", read_json("data/changelog.json")["entries"])
    out["corrections"] = envelope("corrections", "data/corrections.json", read_json("data/corrections.json")["corrections"])
    out["interview-categories"] = envelope("interview-categories", "interview/data/ + data/platform/catalog.json", {
        "tracks": [{"id": x["id"], "name": x["name"], "group": x["group"], "url": f"{SITE}/{x['path']}"} for x in cat["interview_tracks"]],
        "topics": [{"name": x["name"], "questions": x["count"]} for x in read_json("interview/data/topics.json")["types"]],
        "companies": [{"name": x["name"], "questions": x["count"]} for x in read_json("interview/data/companies.json")],
    })
    out["registry"] = envelope("registry", "data/site-registry.json", {k: v for k, v in reg.items() if not k.startswith("$")})
    out["index"] = envelope("index", "scripts/platform_build/api.py", {
        name: f"{SITE}/api/{VERSION}/{name}.json" for name in sorted(k for k in out)} | {
        "jobs-stats (live, JobSignal)": f"{SITE}/jobs/data/stats.json"})
    return out


def run(write: bool) -> list[str]:
    problems = []
    for name, obj in build().items():
        path = f"api/{VERSION}/{name}.json"
        text = dump_json(obj)
        if write:
            if write_if_changed(path, text):
                print(f"  wrote {path}")
        else:
            p = ROOT / path
            if not p.exists() or p.read_text(encoding="utf-8") != text:
                problems.append(f"{path} is stale — run: python3 scripts/platform_build/build.py api")
    return problems
