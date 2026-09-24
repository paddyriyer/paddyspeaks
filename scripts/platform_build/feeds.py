"""RSS feeds (P1.6) and the changelog feed (P1.7).

    feed.xml                  every essay, newest first
    feeds/<category>.xml      one per article category (technology, philosophy, ai, personality)
    changelog.xml             the curated platform changelog (data/changelog.json)

RSS 2.0 with an atom:self link. Deterministic: lastBuildDate is the newest
item's date, never "now", so an unchanged site produces byte-identical feeds.
"""
from __future__ import annotations

import datetime
import html
from xml.sax.saxutils import escape

from . import registry
from .common import ROOT, SITE, read_json, write_if_changed

CAT_TITLE = {"technology": "Technology", "philosophy": "Philosophy", "ai": "AI & Future",
             "personality": "Personality Development"}


def rfc822(date: str) -> str:
    d = datetime.datetime.fromisoformat(date[:19] if "T" in date else date + "T09:00:00")
    return d.strftime("%a, %d %b %Y %H:%M:%S +0000")


def channel(title: str, link: str, self_href: str, desc: str, items: list[str], newest: str) -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>{escape(title)}</title>
  <link>{escape(link)}</link>
  <atom:link href="{escape(self_href)}" rel="self" type="application/rss+xml"/>
  <description>{escape(desc)}</description>
  <language>en</language>
  <lastBuildDate>{rfc822(newest)}</lastBuildDate>
{"".join(items)}</channel>
</rss>
"""


def article_item(m: dict) -> str:
    url = f"{SITE}/articles/{m['slug']}"
    img = m.get("hero_image") or ""
    enclosure = ""
    if img and not img.startswith("http") and (ROOT / img).exists():
        ext = img.rsplit(".", 1)[-1].lower()
        mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp", "svg": "image/svg+xml"}.get(ext)
        if mime:
            enclosure = f'\n    <enclosure url="{escape(SITE + "/" + img)}" length="{(ROOT / img).stat().st_size}" type="{mime}"/>'
    return f"""  <item>
    <title>{escape(html.unescape(m['title']))}</title>
    <link>{escape(url)}</link>
    <guid isPermaLink="true">{escape(url)}</guid>
    <pubDate>{rfc822(m['date'])}</pubDate>
    <category>{escape(CAT_TITLE.get(m['category'], m['category']))}</category>
    <description>{escape(html.unescape(m.get('subtitle') or ''))}</description>{enclosure}
  </item>
"""


def build() -> dict[str, str]:
    meta = sorted(read_json("article_metadata.json"), key=lambda m: (m["date"], m["slug"]), reverse=True)
    out = {}
    out["feed.xml"] = channel(
        "PaddySpeaks — all essays", SITE + "/", SITE + "/feed.xml",
        "Essays on philosophy, technology, AI and personal growth by Paddy Iyer.",
        [article_item(m) for m in meta], meta[0]["date"])
    for c in read_json(registry.CATALOG)["article_categories"]:
        items = [m for m in meta if m["category"] == c["id"]]
        if not items:
            continue
        out[f"feeds/{c['id']}.xml"] = channel(
            f"PaddySpeaks — {c['label']}", f"{SITE}/#{c['id']}", f"{SITE}/feeds/{c['id']}.xml",
            f"PaddySpeaks essays in {c['label']}.", [article_item(m) for m in items], items[0]["date"])
    log = read_json("data/changelog.json")["entries"]
    citems = []
    for e in log:
        url = SITE + e["url"] if e.get("url") else SITE + "/changelog/"
        guid = f"{SITE}/changelog/#{e['id']}"
        citems.append(f"""  <item>
    <title>{escape(e['title'])}</title>
    <link>{escape(url)}</link>
    <guid isPermaLink="true">{escape(guid)}</guid>
    <pubDate>{rfc822(e['date'])}</pubDate>
{"".join(f"    <category>{escape(a)}</category>{chr(10)}" for a in e.get('areas', []))}    <description>{escape(e['summary'])}</description>
  </item>
""")
    out["changelog.xml"] = channel(
        "PaddySpeaks — changelog", SITE + "/changelog/", SITE + "/changelog.xml",
        "Meaningful changes to PaddySpeaks: new essays of note, sacred texts, Interview Studio, JobSignal, demos, corrections, privacy and platform.",
        citems, log[0]["date"])
    return out


def run(write: bool) -> list[str]:
    problems = []
    for path, text in build().items():
        if write:
            if write_if_changed(path, text):
                print(f"  wrote {path}")
        else:
            p = ROOT / path
            if not p.exists() or p.read_text(encoding="utf-8") != text:
                problems.append(f"{path} is stale — run: python3 scripts/platform_build/build.py feeds")
    log = read_json("data/changelog.json")["entries"]
    dates = [e["date"] for e in log]
    if dates != sorted(dates, reverse=True):
        problems.append("data/changelog.json: entries must be newest first")
    for e in log:
        u = e.get("url", "")
        if u:
            path = u.split("#")[0].split("?")[0].lstrip("/")
            p = ROOT / path
            ok = (p / "index.html").exists() if (path.endswith("/") or not path) else p.exists()
            if not path:
                ok = True
            if not ok:
                problems.append(f"data/changelog.json[{e['id']}]: url {u} does not exist")
    return problems
