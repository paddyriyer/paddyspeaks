"""Render platform pages from content/pages/*.html into <path>/index.html.

Why a renderer at all: the new utility pages (corrections, the four legal
pages, changelog, subscribe, atlas, and the library pages /articles/, /sacred/,
/explore/) share chrome — the one-row header, the footer with its legal row,
canonical/OG/JSON-LD.
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

# The platform navigation. Since 2026-09-26 (docs/HOMEPAGE-MAP-REDESIGN.md) it
# is the owner's single row: wordmark · Read · Prepare · Sacred · Explore ·
# About · a search field. Journey ids ("learn", "build") are unchanged so the
# accents and data-journey hooks keep working; only labels and targets moved,
# and every old target (/#archive, /#sacred-texts, /#data-lab) still resolves.
NAV = [
    ("read", "Read", "/articles/"),
    ("prepare", "Prepare", "/interview.app/"),
    ("learn", "Sacred", "/sacred/"),
    ("build", "Explore", "/explore/"),
    ("about", "About", "/about.html"),
]

LEGAL_LINKS = [
    ("/", "PaddySpeaks home"),
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


SEARCH_ICON = ('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
               'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7.5"/>'
               '<line x1="21" y1="21" x2="16.4" y2="16.4"/></svg>')

YOUTUBE = "https://www.youtube.com/playlist?list=PLosfXEs7rcbvO9-dDQ2u1LnqDTn1BRafk"
LINKEDIN = "https://linkedin.com/in/paddyiyer"
ICON_YOUTUBE = ('<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.8 15.1V8.9L15.2 12z"/></svg>')
ICON_LINKEDIN = ('<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.4 2H3.6A1.6 1.6 0 0 0 2 3.6v16.8A1.6 1.6 0 0 0 3.6 22h16.8a1.6 1.6 0 0 0 1.6-1.6V3.6A1.6 1.6 0 0 0 20.4 2zM8 19H5V9.5h3zM6.5 8.2a1.7 1.7 0 1 1 0-3.5 1.7 1.7 0 0 1 0 3.5zM19 19h-3v-4.6c0-1.1 0-2.5-1.5-2.5S12.8 13 12.8 14.3V19h-3V9.5h2.8v1.3a3.1 3.1 0 0 1 2.8-1.5c3 0 3.6 2 3.6 4.6z"/></svg>')


def nav_html(active: str | None) -> str:
    """The shared header row — the same markup index.html carries by hand
    (lib/ps-chrome.css styles both; lib/ps-nav.js adds the phone menu).
    Search is a link to /atlas/ that lib/ps-search.js upgrades to the search
    dialog, drawn as a field; it stays last so ps-nav.js can move it beside
    the phone menu button."""
    items = []
    for key, label, href in NAV:
        cur = ' aria-current="page"' if key == active else ""
        if key == "about":
            items.append(f'    <a href="{href}" class="ps-nav-about"{cur}>{label}</a>')
        else:
            items.append(f'    <a href="{href}" data-journey="{key}"{cur}>{label}</a>')
    items.append(
        '    <a href="/atlas/" class="nav-search-btn" data-ps-search-open aria-label="Search PaddySpeaks" title="Search (Ctrl+K or /)">'
        + SEARCH_ICON + '<span class="nav-search-label" aria-hidden="true">Search PaddySpeaks&hellip;</span>'
        '<kbd class="nav-search-kbd" aria-hidden="true">/</kbd></a>')
    return ('<div class="ps-navwrap" id="ps-navwrap">\n'
            '<a class="ps-navmark" href="/" aria-label="PaddySpeaks home">Paddy<span>Speaks</span></a>\n'
            '<nav class="nav-bar" aria-label="Primary">\n' + "\n".join(items) + "\n</nav>\n</div>")


def header_html(active: str | None) -> str:
    return nav_html(active)


FOOTER_NAV = [("/articles/", "Read"), ("/interview.app/", "Prepare"), ("/sacred/", "Sacred"),
              ("/explore/", "Explore"), ("/about.html", "About")]
FOOTER_MORE = [("/jobs/", "JobSignal"), ("/mentoring/", "Mentoring"), ("/atlas/", "Atlas"),
               ("/resume.html", "Resume"), ("/visual-resume.html", "Visual résumé"),
               ("/testimonials/", "Testimonials"), ("/contact/", "Contact")]


def footer_html() -> str:
    """The shared footer — index.html carries the same markup by hand."""
    main = "\n".join(f'        <a href="{h}">{t}</a>' for h, t in FOOTER_NAV)
    more = "\n".join(f'        <a href="{h}">{t}</a>' for h, t in FOOTER_MORE)
    links = "\n".join(f'        <a href="{h}">{t}</a>' for h, t in LEGAL_LINKS)
    return f"""<footer class="site-footer ps-footer">
    <div class="ps-footer-row">
        <a class="ps-footer-mark" href="/">Paddy<span>Speaks</span></a>
        <nav class="ps-footer-nav" aria-label="Sections">
{main}
        </nav>
        <p class="ps-footer-social">
            <a href="{YOUTUBE}" target="_blank" rel="noopener" aria-label="PaddySpeaks on YouTube">{ICON_YOUTUBE}</a>
            <a href="{LINKEDIN}" target="_blank" rel="noopener" aria-label="Paddy Iyer on LinkedIn">{ICON_LINKEDIN}</a>
        </p>
    </div>
    <nav class="footer-links" aria-label="More from PaddySpeaks">
{more}
    </nav>
    <nav class="ps-footer-legal" aria-label="Site information" data-ps-legal>
{links}
    </nav>
    <p class="footer-copy">&copy; 2026 PaddySpeaks &middot; Paddy Iyer &middot; Ideas for a more thoughtful world.</p>
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
    # "corrections/" renders corrections/index.html; "about.html" renders that file.
    path = fm["path"].strip("/")
    out_file = path if path.endswith(".html") else path + "/index.html"
    if not path.endswith(".html"):
        path += "/"
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
    ] + fm.get("ld", [])
    ld_html = "\n".join(
        '<script type="application/ld+json">' + json.dumps(x, ensure_ascii=False) + "</script>" for x in ld)
    robots = fm.get("robots", "index, follow")
    extra_head = "\n".join(
        [f'<link rel="stylesheet" href="{esc(c)}">' for c in fm.get("stylesheets", [])] + fm.get("head", []))
    image = fm.get("image", f"{SITE}/images/og-default.png")
    og_type = fm.get("ogType", "website")
    body_class = " ".join(["ps-chrome"] + fm.get("bodyClass", "").split())
    # ps-search.js is always loaded (the header's Search), so a page listing it is not doubled.
    scripts = "\n".join(f'<script defer src="{esc(s)}"></script>'
                        for s in fm.get("scripts", []) if s != "/lib/ps-search.js")
    analytics = ""
    if fm.get("analytics", True):
        analytics = (f'<script defer src="/lib/ps.js"></script>\n'
                     f'<img src="https://ps.paddyspeaks.com/api/px.gif?p=/{path}" alt="" width="1" height="1" '
                     f'style="position:absolute;opacity:0" loading="eager">')
    heading = fm.get("heading", esc(title))
    lede = f'\n    <p class="ps-lede">{fm["lede"]}</p>' if fm.get("lede") else ""
    updated = (f'\n    <p class="ps-updated">Last updated <time datetime="{fm["updated"]}">{fmt_date(fm["updated"])}</time></p>'
               if fm.get("updated") else "")
    if fm.get("layout") == "wide":
        # The page body owns its own hero and layout (the About page).
        main_html = body.strip()
    else:
        main_html = f"""  <div class="ps-page-hero">
    <span class="about-label">{esc(fm.get("label", title))}</span>
    <h1>{heading}</h1>
    <div class="masthead-rule"></div>{lede}
  </div>
  <div class="ps-doc">{updated}
{body.strip()}
  </div>"""
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
<meta property="og:type" content="{esc(og_type)}">
<meta property="og:url" content="{url}">
<meta property="og:site_name" content="PaddySpeaks">
<meta property="og:image" content="{esc(image)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(desc)}">
<meta name="twitter:image" content="{esc(image)}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
{feeds}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&amp;family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&amp;family=JetBrains+Mono:wght@400;600&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
<link rel="stylesheet" href="/lib/ps-platform.css">
<link rel="stylesheet" href="/lib/ps-chrome.css">
{extra_head}
{ld_html}
</head>
<body class="{body_class}">
<a class="ps-skip-link" href="#main-content">Skip to content</a>
<div class="page-frame"></div>

{header_html(fm.get("journey"))}

<main id="main-content">
{main_html}
</main>

{footer_html()}

<script defer src="/lib/ps-nav.js"></script>
<script defer src="/lib/ps-search.js"></script>
<script defer src="/lib/ps-platform.js"></script>
{scripts}
{analytics}
</body>
</html>
"""
    from .assets import fingerprint  # ?v=<hash> on style.css / lib/ps-* links
    return out_file, fingerprint(out)


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
