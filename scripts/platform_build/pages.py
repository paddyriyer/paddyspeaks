"""Render platform pages from content/pages/*.html into <path>/index.html.

Why a renderer at all: the new utility pages (corrections, the four legal
pages, changelog, subscribe, atlas) share chrome — masthead, the Read / Learn /
Prepare / Find / Build navigation, the legal footer row, canonical/OG/JSON-LD.
Hand-copying that chrome into eight files is how the rest of the site ended up
with ~250 footer variants. Each source file holds only its body plus a
front-matter comment; the output is plain static HTML, committed, and CI
checks it is current.

This never touches index.html or any page that is not listed in content/pages/.

Source format (first line):
    <!--page {"path": "corrections/", "title": "...", "description": "...",
              "label": "Corrections", "heading": "Corrections &amp; <em>Editorial</em> History",
              "journey": null, "updated": "2026-09-24", "scripts": [], "analytics": true} -->

Body tokens:
    {{stat:key}} / {{stat:key:comma}}   registry value as a data-ps-stat span
    {{corrections}}                     rendered list from data/corrections.json
    {{changelog}}                       rendered list from data/changelog.json
    {{journeys}}                        the five journeys from the catalog
"""
from __future__ import annotations

import html
import json
import re

from . import registry
from .common import ROOT, SITE, read_json, write_if_changed

SRC_DIR = ROOT / "content" / "pages"
FRONT_RE = re.compile(r"^<!--page\s+(\{.*?\})\s*-->\s*", re.S)

# The platform navigation (P1.1). Labels changed; every URL is one that already
# existed, so nothing an outside link points at moves.
NAV = [
    ("read", "Read", "/#archive"),
    ("learn", "Learn", "/#sacred-texts"),
    ("prepare", "Prepare", "/interview.app/"),
    ("find", "Find", "/jobs/"),
    ("build", "Build", "/#data-lab"),
    ("atlas", "Atlas", "/atlas/"),
    ("about", "About", "/about.html"),
]

LEGAL_LINKS = [
    ("/about.html", "About"),
    ("/contact/", "Contact"),
    ("/subscribe/", "Follow"),
    ("/changelog/", "Changelog"),
    ("/corrections/", "Corrections"),
    ("/privacy-policy/", "Privacy"),
    ("/terms/", "Terms"),
    ("/disclaimer/", "Disclaimer"),
    ("/copyright/", "Copyright"),
]

KIND_LABEL = {
    "factual": "Factual", "translation": "Translation", "technical": "Technical",
    "data": "Data", "statistics": "Statistics", "attribution": "Attribution",
    "citation": "Citation",
}
CHANGE_LABEL = {
    "article": "Article", "sacred": "Sacred texts", "interview": "Interview Studio",
    "jobs": "JobSignal", "demo": "Demo", "privacy": "Privacy", "security": "Security",
    "platform": "Platform", "accessibility": "Accessibility", "correction": "Correction",
}


def esc(s: str) -> str:
    return html.escape(s, quote=True)


def fmt_date(d: str) -> str:
    import datetime
    t = datetime.date.fromisoformat(d[:10])
    return f"{t.day} {t.strftime('%B %Y')}"


def nav_html(active: str | None) -> str:
    items = []
    for key, label, href in NAV:
        cls = ' class="active" aria-current="page"' if key == active else ""
        items.append(f'    <a href="{href}"{cls}>{label}</a>')
    items.append(
        '    <a href="/atlas/" class="nav-search-btn" aria-label="Search PaddySpeaks" title="Search">'
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/>'
        '<line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></a>'
    )
    return '<nav class="nav-bar" aria-label="Primary">\n' + "\n".join(items) + "\n</nav>"


def footer_html() -> str:
    links = "\n".join(f'        <a href="{h}">{t}</a>' for h, t in LEGAL_LINKS)
    return f"""<footer class="site-footer">
    <div class="footer-ornament" aria-hidden="true">&#10087;</div>
    <nav class="ps-footer-legal" aria-label="Site information" data-ps-legal>
{links}
    </nav>
    <p class="footer-copy">&copy; 2026 PaddySpeaks &middot; Paddy Iyer</p>
</footer>"""


def render_corrections() -> str:
    items = read_json("data/corrections.json").get("corrections", [])
    if not items:
        return '<p class="ps-state">No corrections have been recorded yet.</p>'
    out = []
    for c in items:
        also = ""
        if c.get("also"):
            also = '<p class="ps-panel-note">Also affected: ' + ", ".join(
                f'<a href="{esc(u)}">{esc(u)}</a>' for u in c["also"]) + "</p>"
        status = ' <span class="ps-badge" data-status="open">Work continues</span>' if c.get("status") == "open" else ""
        out.append(f"""<article class="ps-entry" id="{esc(c['id'])}">
  <div class="ps-entry-meta"><time datetime="{esc(c['date'])}">{fmt_date(c['date'])}</time> <span class="ps-badge" data-type="page">{esc(KIND_LABEL.get(c['kind'], c['kind']))}</span>{status}</div>
  <h3><a href="{esc(c['url'])}">{esc(c['title'])}</a></h3>
  <p>{esc(c['summary'])}</p>
  {also}
</article>""")
    return "\n".join(out)


def render_changelog() -> str:
    p = ROOT / "data" / "changelog.json"
    if not p.exists():
        return '<p class="ps-state">No entries yet.</p>'
    items = read_json("data/changelog.json").get("entries", [])
    out = []
    for e in items:
        link = f'<a href="{esc(e["url"])}">{esc(e["title"])}</a>' if e.get("url") else esc(e["title"])
        tags = " ".join(f'<span class="ps-badge" data-type="{esc(t)}">{esc(CHANGE_LABEL.get(t, t))}</span>' for t in e.get("areas", []))
        out.append(f"""<article class="ps-entry" id="{esc(e['id'])}">
  <div class="ps-entry-meta"><time datetime="{esc(e['date'])}">{fmt_date(e['date'])}</time> {tags}</div>
  <h3>{link}</h3>
  <p>{esc(e['summary'])}</p>
</article>""")
    return "\n".join(out)


def render_journeys() -> str:
    cat = read_json(registry.CATALOG)
    lis = "\n".join(
        f'  <li><a href="{esc(j["href"])}"><strong>{esc(j["label"])}</strong></a> — {esc(j["blurb"])}</li>'
        for j in cat["journeys"])
    return f"<ul>\n{lis}\n</ul>"


def render_concepts() -> str:
    p = ROOT / "data" / "graph" / "concepts.json"
    if not p.exists():
        return ""
    cs = json.loads(p.read_text(encoding="utf-8"))["concepts"]
    lis = "\n".join(f'  <li><a href="/atlas/?c={esc(c["id"].split(":", 1)[1])}">{esc(c["label"])}</a></li>' for c in cs)
    return f'<ul class="ps-atlas-concepts">\n{lis}\n</ul>'


def expand(body: str, stats: dict) -> str:
    def stat(m):
        key, style = m.group(1), m.group(2)
        v = stats[key]
        text = f"{v:,}" if style == "comma" else str(v)
        fmt = f' data-ps-format="{style}"' if style else ""
        return f'<span data-ps-stat="{key}"{fmt}>{text}</span>'
    body = re.sub(r"\{\{stat:([a-z0-9_.]+)(?::([a-z]+))?\}\}", stat, body)
    body = body.replace("{{corrections}}", render_corrections())
    body = body.replace("{{changelog}}", render_changelog())
    body = body.replace("{{journeys}}", render_journeys())
    body = body.replace("{{concepts}}", render_concepts())
    return body


def render(src_name: str, stats: dict) -> tuple[str, str]:
    raw = (SRC_DIR / src_name).read_text(encoding="utf-8")
    m = FRONT_RE.match(raw)
    if not m:
        raise ValueError(f"content/pages/{src_name}: missing <!--page {{...}} --> front matter")
    fm = json.loads(m.group(1))
    if "data-ps-stat=" in raw:
        raise ValueError("use {{stat:key}} in page sources, not a literal data-ps-stat span (it would fight the stamper)")
    body = expand(raw[m.end():], stats)
    path = fm["path"].strip("/") + "/"
    url = f"{SITE}/{path}"
    title = fm["title"]
    desc = fm["description"]
    crumbs = [{"@type": "ListItem", "position": 1, "name": "PaddySpeaks", "item": SITE + "/"},
              {"@type": "ListItem", "position": 2, "name": fm.get("label", title), "item": url}]
    ld = [
        {"@context": "https://schema.org", "@type": fm.get("schemaType", "WebPage"), "name": title,
         "description": desc, "url": url, "inLanguage": "en",
         "isPartOf": {"@type": "WebSite", "name": "PaddySpeaks", "url": SITE + "/"},
         **({"dateModified": fm["updated"]} if fm.get("updated") else {})},
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": crumbs},
    ]
    ld_html = "\n".join(
        '<script type="application/ld+json">' + json.dumps(x, ensure_ascii=False) + "</script>" for x in ld)
    robots = fm.get("robots", "index, follow")
    extra_head = "\n".join(fm.get("head", []))
    scripts = "\n".join(f'<script defer src="{esc(s)}"></script>' for s in fm.get("scripts", []))
    analytics = ""
    if fm.get("analytics", True):
        analytics = (f'<script defer src="/lib/ps.js"></script>\n'
                     f'<img src="https://ps.paddyspeaks.com/api/px.gif?p=/{path}" alt="" width="1" height="1" '
                     f'style="position:absolute;opacity:0" loading="eager">')
    heading = fm.get("heading", esc(title))
    lede = f'\n    <p class="ps-lede">{fm["lede"]}</p>' if fm.get("lede") else ""
    updated = (f'\n    <p class="ps-updated">Last updated <time datetime="{fm["updated"]}">{fmt_date(fm["updated"])}</time></p>'
               if fm.get("updated") else "")
    feeds = ('<link rel="alternate" type="application/rss+xml" title="PaddySpeaks — all articles" href="/feed.xml">\n'
             '<link rel="alternate" type="application/rss+xml" title="PaddySpeaks — changelog" href="/changelog.xml">')

    out = f"""<!DOCTYPE html>
<!-- GENERATED from content/pages/{src_name} by scripts/platform_build/build.py pages. Edit the source, not this file. -->
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(title)} | PaddySpeaks</title>
<meta name="description" content="{esc(desc)}">
<meta name="author" content="Paddy Iyer">
<meta name="robots" content="{esc(robots)}">
<link rel="canonical" href="{url}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="{url}">
<meta property="og:site_name" content="PaddySpeaks">
<meta property="og:image" content="{SITE}/images/og-default.png">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(desc)}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
{feeds}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&amp;family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&amp;family=JetBrains+Mono:wght@400;600&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
<link rel="stylesheet" href="/lib/ps-platform.css">
{extra_head}
{ld_html}
</head>
<body>
<a class="ps-skip-link" href="#main-content">Skip to content</a>
<div class="page-frame"></div>

<header class="masthead">
    <p class="ps-masthead-title"><a href="/">Paddy<span>Speaks</span></a></p>
    <p class="masthead-tagline">Read &middot; Learn &middot; Prepare &middot; Find &middot; Build</p>
    <div class="masthead-rule"></div>
</header>

{nav_html(fm.get("journey"))}

<main id="main-content">
  <div class="ps-page-hero">
    <span class="about-label">{esc(fm.get("label", title))}</span>
    <h1>{heading}</h1>
    <div class="masthead-rule"></div>{lede}
  </div>
  <div class="ps-doc">{updated}
{body.strip()}
  </div>
</main>

{footer_html()}

<script defer src="/lib/ps-nav.js"></script>
<script defer src="/lib/ps-platform.js"></script>
{scripts}
{analytics}
</body>
</html>
"""
    return path + "index.html", out


def run(write: bool) -> list[str]:
    if not SRC_DIR.exists():
        return []
    stats = registry.stats(registry.build())
    problems = []
    for src in sorted(p.name for p in SRC_DIR.glob("*.html")):
        try:
            out_path, text = render(src, stats)
        except Exception as e:  # surface as a check failure, not a traceback
            problems.append(f"content/pages/{src}: {e}")
            continue
        if write:
            if write_if_changed(out_path, text):
                print(f"  rendered {out_path}")
        else:
            p = ROOT / out_path
            if not p.exists() or p.read_text(encoding="utf-8") != text:
                problems.append(f"{out_path} is stale — run: python3 scripts/platform_build/build.py pages")
    return problems
