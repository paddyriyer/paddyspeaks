#!/usr/bin/env python3
"""
Combine the 7 "ads engineering" HTML files into a single SEO-optimized
article: articles/ads-data-engineering-interview-prep.html.

Anchor namespacing mirrors combine_interview.py: per-part prefix
(ap00..ap05 plus apIX for the Master Index), and cross-file links
become in-page anchors.
"""
from __future__ import annotations

import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "interview" / "ads engineering"
OUT = ROOT / "articles" / "ads-data-engineering-interview-prep.html"

PARTS = [
    ("IX", "00_Master_Index.html",                      "Overview",                           "overview"),
    ("00", "Part0_Introduction_to_Ads_Engineering.html", "Introduction to Ads Engineering",   "introduction"),
    ("01", "Part1_Mock_Interview_Scenarios_Practice.html","Mock Interview + 10 Scenarios",    "mock-scenarios"),
    ("02", "Part2_Ads_Growth_Behavioral.html",          "Advanced Ads, Growth & Behavioral",  "growth-behavioral"),
    ("03", "Part3_Deep_Dive_SQL.html",                  "Deep Dive SQL",                      "sql-deep-dive"),
    ("04", "Part4_Platform_Specific_Glossary.html",     "Platform Surfaces & A–Z Glossary",   "platform-glossary"),
    ("05", "Part5_Visualization_Measurement.html",      "Visualization & Measurement",        "viz-measurement"),
]

FILE_TO_PART = {filename: num for (num, filename, _t, _s) in PARTS}

MAIN_RE = re.compile(r'<main class="content">(.*?)</main>', re.DOTALL)


def extract_main(html_text: str) -> str:
    m = MAIN_RE.search(html_text)
    if not m:
        raise ValueError("no <main class='content'> block found")
    return m.group(1)


def rewrite_anchors(body: str, part_num: str) -> str:
    def prefix_id(match: re.Match) -> str:
        return f'id="ap{part_num}-{match.group(1)}"'

    body = re.sub(r'id="([^"]+)"', prefix_id, body)

    def fix_href(match: re.Match) -> str:
        href = match.group(1)
        if href.startswith("#"):
            return f'href="#ap{part_num}-{href[1:]}"'
        m = re.match(r'^([^#]+\.html)(?:#(.*))?$', href)
        if m:
            filename, anchor = m.group(1), m.group(2)
            target_part = FILE_TO_PART.get(filename)
            if target_part is None:
                return match.group(0)
            if anchor:
                return f'href="#ap{target_part}-{anchor}"'
            return f'href="#ads-part-{target_part}"'
        return match.group(0)

    body = re.sub(r'href="([^"]+)"', fix_href, body)
    return body


def strip_local_toc(body: str) -> str:
    pattern = re.compile(
        r'<h2 id="[^"]*table-of-contents[^"]*">.*?</h2>\s*<ol>.*?</ol>',
        re.DOTALL | re.IGNORECASE,
    )
    return pattern.sub("", body)


def build_master_toc() -> str:
    items = []
    for num, filename, title, slug in PARTS:
        src = (SRC_DIR / filename).read_text(encoding="utf-8")
        body = extract_main(src)
        toc_match = re.search(
            r'<h2 id="[^"]*table-of-contents[^"]*">.*?</h2>\s*<ol>(.*?)</ol>',
            body, re.DOTALL | re.IGNORECASE,
        )
        sub_links = []
        if toc_match:
            for link in re.finditer(
                r'<li><a href="#([^"]+)">(.*?)</a></li>',
                toc_match.group(1), re.DOTALL,
            ):
                sub_links.append((f"ap{num}-{link.group(1)}", link.group(2).strip()))
        items.append((num, slug, title, sub_links))

    out = ['<nav class="master-toc" aria-label="Table of contents">',
           '<h2 id="contents">Contents</h2>',
           '<ol class="master-toc-list">']
    for num, slug, title, sub_links in items:
        label = "Overview" if num == "IX" else f"Part {num}"
        out.append(f'<li><a href="#ads-part-{num}"><span class="toc-num">{label}</span> — {title}</a>')
        if sub_links:
            out.append('<ol class="master-toc-sublist">')
            for anchor, text in sub_links:
                out.append(f'<li><a href="#{anchor}">{text}</a></li>')
            out.append('</ol>')
        out.append('</li>')
    out.append('</ol>')
    out.append('</nav>')
    return "\n".join(out)


def build_sections() -> str:
    chunks = []
    for num, filename, title, slug in PARTS:
        src = (SRC_DIR / filename).read_text(encoding="utf-8")
        body = extract_main(src)
        body = strip_local_toc(body)
        body = rewrite_anchors(body, num)

        section_id = f"ads-part-{num}"
        eyebrow = "Overview" if num == "IX" else f"Part {num}"
        chunks.append(f'<section id="{section_id}" class="part-section" data-part="{num}">')
        chunks.append(
            f'<header class="part-header">'
            f'<div class="part-eyebrow">{eyebrow}</div>'
            f'<h1 class="part-title">{html.escape(title)}</h1>'
            f'</header>'
        )
        chunks.append(body.strip())
        chunks.append('<p class="back-to-top"><a href="#contents">↑ Back to contents</a></p>')
        chunks.append('</section>')
    return "\n".join(chunks)


HEAD = '''<!DOCTYPE html>
<html lang="en" class="no-js">
<head>
<script>document.documentElement.className=document.documentElement.className.replace('no-js','js');</script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<meta name="theme-color" content="#0f1e2e">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="format-detection" content="telephone=no">
<title>Ads Data Engineering Interview Prep — Senior / L5 Deep Dive | PaddySpeaks</title>
<meta name="description" content="A senior-level prep handbook for ads data engineering interviews: auction internals, attribution, identity &amp; consent, ads SQL patterns, platform-specific stacks (search, social, DSP, SSP), measurement &amp; visualization, plus 10 mock interview scenarios and the growth + behavioral framework.">
<meta name="keywords" content="ads data engineering interview, ad tech interview prep, attribution, bid request, auction, click fraud, MMP, DSP, SSP, pixel, SKAdNetwork, identity graph, GDPR consent, ads SQL, cohort LTV, conversion funnel, incrementality, multi-touch attribution, platform interview">
<meta name="author" content="Paddy Iyer">
<link rel="canonical" href="https://paddyspeaks.com/articles/ads-data-engineering-interview-prep.html">

<meta property="og:title" content="Ads Data Engineering Interview Prep — Senior / L5 Deep Dive">
<meta property="og:description" content="Senior-level handbook for ads data engineering: auctions, attribution, identity, platform stacks, ads SQL, and 10 mock interview scenarios with full answer skeletons.">
<meta property="og:type" content="article">
<meta property="og:url" content="https://paddyspeaks.com/articles/ads-data-engineering-interview-prep.html">
<meta property="og:site_name" content="PaddySpeaks">
<meta property="og:image" content="https://paddyspeaks.com/images/og-default.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_US">
<meta property="article:author" content="Paddy Iyer">
<meta property="article:published_time" content="2026-04-22">
<meta property="article:section" content="Technology">
<meta property="article:tag" content="Ads Data Engineering">
<meta property="article:tag" content="Interview Prep">
<meta property="article:tag" content="Attribution">
<meta property="article:tag" content="Ad Tech">
<meta property="article:tag" content="DSP">
<meta property="article:tag" content="SSP">
<meta property="article:tag" content="Identity">
<meta property="article:tag" content="Measurement">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Ads Data Engineering Interview Prep — Senior / L5 Deep Dive">
<meta name="twitter:description" content="Senior-level handbook for ads data engineering: auctions, attribution, identity, platform stacks, ads SQL, and 10 full mock interview scenarios.">
<meta name="twitter:image" content="https://paddyspeaks.com/images/og-default.png">

<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Article","headline":"Ads Data Engineering Interview Prep — Senior / L5 Deep Dive","description":"A production-grade senior ads data engineering interview handbook covering auction internals, attribution, identity & consent, ads SQL, platform-specific stacks (search, social, DSP, SSP, MMP), measurement & visualization, 10 mock interview scenarios, and the growth + behavioral framework.","author":{"@type":"Person","name":"Paddy Iyer","url":"https://paddyspeaks.com/about.html"},"publisher":{"@type":"Organization","name":"PaddySpeaks","url":"https://paddyspeaks.com"},"datePublished":"2026-04-22","dateModified":"2026-04-22","mainEntityOfPage":"https://paddyspeaks.com/articles/ads-data-engineering-interview-prep.html","articleSection":"Technology","keywords":"ads data engineering, attribution, DSP, SSP, identity, click fraud, incrementality, MTA, SKAdNetwork, platform interview","isAccessibleForFree":true}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"PaddySpeaks","item":"https://paddyspeaks.com/"},{"@type":"ListItem","position":2,"name":"Articles","item":"https://paddyspeaks.com/articles/"},{"@type":"ListItem","position":3,"name":"Ads Data Engineering Interview Prep"}]}
</script>

<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Newsreader:ital,wght@0,400;1,400&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Newsreader:ital,wght@0,400;1,400&display=swap" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Newsreader:ital,wght@0,400;1,400&display=swap"></noscript>

<style>
:root {
  --netflix-red: #E50914;
  --navy: #1a2f45;
  --navy-deep: #0f1e2e;
  --dark: #1e293b;
  --med: #475569;
  --muted: #64748b;
  --accent: #c8915a;
  --accent-light: #e8c9a0;
  --cream: #faf6f1;
  --bone: #f5efe6;
  --warm-white: #fefcf9;
  --sage: #6b8e6f;
  --rust: #b44040;
  --rule: #e2d9ce;
  --code-bg: #0f1e2e;
  --code-text: #e8e0d6;
  --code-dim: #8b96a8;
  --callout-bg: #fff8ee;
  --callout-border: #c8915a;
}
* { margin:0; padding:0; box-sizing:border-box; }
html { scroll-behavior:smooth; }
body { font-family:'DM Sans',sans-serif; background:#e8e0d6; color:var(--dark); line-height:1.65; color-scheme:light only; }
.shell { max-width:1120px; margin:0 auto; }

header.page-header { background:var(--navy-deep); color:var(--cream); padding:60px 56px 48px; border-bottom:4px solid var(--netflix-red); position:relative; overflow:hidden; }
header.page-header::before { content:""; position:absolute; top:0; right:0; width:360px; height:100%; background:linear-gradient(135deg,transparent 40%,rgba(229,9,20,0.10) 100%); pointer-events:none; }
.eyebrow { font-family:'DM Mono',monospace; font-size:11px; letter-spacing:3px; text-transform:uppercase; color:var(--netflix-red); margin-bottom:14px; font-weight:500; }
header.page-header h1 { font-family:'Cormorant Garamond',serif; font-size:clamp(32px,4.6vw,52px); font-weight:600; line-height:1.08; margin-bottom:14px; color:var(--warm-white); letter-spacing:-0.5px; max-width:880px; }
.subhead { font-family:'Newsreader',serif; font-style:italic; font-size:18px; color:var(--accent-light); max-width:820px; line-height:1.5; }
.meta-strip { display:flex; gap:22px; margin-top:28px; flex-wrap:wrap; font-family:'DM Mono',monospace; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:var(--accent-light); }
.meta-strip span::before { content:"→ "; color:var(--netflix-red); }

nav.breadcrumb { background:var(--navy); color:var(--accent-light); padding:12px 56px; font-family:'DM Mono',monospace; font-size:11px; letter-spacing:2px; text-transform:uppercase; border-bottom:1px solid #000; }
nav.breadcrumb a { color:var(--accent-light); text-decoration:none; border-bottom:1px dashed var(--accent); }
nav.breadcrumb a:hover { color:var(--warm-white); }
nav.breadcrumb .sep { color:var(--netflix-red); margin:0 10px; }

main.content { background:var(--warm-white); padding:48px 56px 64px; }
main.content h1 { font-family:'Cormorant Garamond',serif; font-size:34px; font-weight:600; color:var(--warm-white); margin:0 0 22px; padding:18px 22px; background:var(--navy); border-radius:8px; border-left:6px solid var(--netflix-red); letter-spacing:-0.3px; scroll-margin-top:16px; }
main.content h2 { font-family:'Cormorant Garamond',serif; font-size:28px; font-weight:600; color:var(--navy-deep); margin:48px 0 14px; padding-bottom:6px; border-bottom:1px solid var(--rule); scroll-margin-top:16px; }
main.content h3 { font-family:'DM Sans',sans-serif; font-size:18px; font-weight:600; color:var(--netflix-red); margin:28px 0 10px; letter-spacing:0.2px; }
main.content h4 { font-family:'DM Sans',sans-serif; font-size:15px; font-weight:600; color:var(--navy); margin:20px 0 8px; text-transform:uppercase; letter-spacing:1px; }
main.content p { margin:0 0 14px; font-size:15.5px; }
main.content a { color:var(--navy); text-decoration:none; border-bottom:1px dashed var(--accent); }
main.content a:hover { border-bottom-color:var(--netflix-red); }
main.content strong { color:var(--navy-deep); }
main.content em { color:var(--rust); font-style:italic; }
main.content ul, main.content ol { margin:0 0 16px 28px; }
main.content li { margin-bottom:6px; font-size:15.5px; }
main.content li > ul, main.content li > ol { margin-top:6px; }
main.content hr { margin:48px 0; border:none; border-top:1px solid var(--rule); }
main.content table { width:100%; border-collapse:collapse; margin:16px 0 24px; font-size:14px; background:var(--bone); border-radius:6px; overflow:hidden; }
main.content th { background:var(--navy); color:var(--warm-white); text-align:left; padding:10px 14px; font-family:'DM Mono',monospace; font-size:11.5px; letter-spacing:1px; text-transform:uppercase; font-weight:500; }
main.content td { padding:10px 14px; border-top:1px solid var(--rule); vertical-align:top; }
main.content tbody tr:nth-child(even) td { background:rgba(0,0,0,0.02); }
main.content pre { background:var(--code-bg); color:var(--code-text); padding:18px 22px; border-radius:8px; overflow-x:auto; margin:10px 0 20px; border-left:3px solid var(--netflix-red); line-height:1.55; }
main.content pre code { font-family:'DM Mono',monospace; font-size:13px; color:var(--code-text); background:transparent; padding:0; border:none; white-space:pre; }
main.content code { font-family:'DM Mono',monospace; font-size:13.5px; background:var(--bone); color:var(--navy-deep); padding:1px 6px; border-radius:3px; border:1px solid var(--rule); }
main.content blockquote { background:var(--callout-bg); border-left:4px solid var(--callout-border); padding:14px 20px; margin:16px 0 20px; font-family:'Newsreader',serif; font-style:italic; color:var(--navy-deep); }

nav.master-toc { background:var(--bone); border:1px solid var(--rule); border-radius:10px; padding:28px 32px; margin:0 0 40px; }
nav.master-toc h2 { margin:0 0 18px !important; padding:0 !important; border:none !important; font-size:24px; color:var(--navy-deep); }
.master-toc-list { list-style:none !important; margin:0 !important; padding:0 !important; counter-reset:part; }
.master-toc-list > li { margin-bottom:14px !important; padding-bottom:14px; border-bottom:1px dashed var(--rule); }
.master-toc-list > li:last-child { border-bottom:none; padding-bottom:0; margin-bottom:0 !important; }
.master-toc-list > li > a { display:block; font-family:'Cormorant Garamond',serif; font-size:19px; font-weight:600; color:var(--navy-deep) !important; border:none !important; padding-bottom:4px; }
.master-toc-list > li > a:hover { color:var(--netflix-red) !important; }
.toc-num { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:2px; color:var(--netflix-red); text-transform:uppercase; margin-right:8px; }
.master-toc-sublist { list-style:none !important; margin:6px 0 0 16px !important; padding:0 !important; column-count:2; column-gap:28px; }
@media (max-width:700px) { .master-toc-sublist { column-count:1; } }
.master-toc-sublist li { margin:0 0 4px !important; font-size:13.5px; break-inside:avoid; }
.master-toc-sublist a { color:var(--med) !important; border:none !important; border-bottom:1px dashed transparent !important; }
.master-toc-sublist a:hover { color:var(--navy-deep) !important; border-bottom-color:var(--accent) !important; }

.part-section { scroll-margin-top:16px; }
.part-section + .part-section { margin-top:56px; }
.part-header { margin:0 0 22px; }
.part-eyebrow { font-family:'DM Mono',monospace; font-size:11px; letter-spacing:3px; text-transform:uppercase; color:var(--netflix-red); margin-bottom:8px; }
.part-title { font-family:'Cormorant Garamond',serif !important; font-size:34px !important; margin:0 !important; padding:18px 22px !important; background:var(--navy) !important; color:var(--warm-white) !important; border-radius:8px !important; border-left:6px solid var(--netflix-red) !important; letter-spacing:-0.3px; }
.back-to-top { margin:32px 0 0 !important; text-align:right; font-family:'DM Mono',monospace; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; }
.back-to-top a { color:var(--muted) !important; border-bottom:1px dashed var(--rule) !important; }
.back-to-top a:hover { color:var(--netflix-red) !important; border-bottom-color:var(--netflix-red) !important; }

footer.page-footer { background:var(--navy-deep); color:var(--accent-light); padding:32px 56px; font-family:'DM Mono',monospace; font-size:11px; letter-spacing:2px; text-transform:uppercase; border-top:4px solid var(--netflix-red); display:flex; justify-content:space-between; flex-wrap:wrap; gap:16px; }
footer.page-footer a { color:var(--accent-light); text-decoration:none; border-bottom:1px dashed var(--accent); }
footer.page-footer a:hover { color:var(--warm-white); }

@media (max-width:800px) {
  header.page-header, main.content, footer.page-footer, nav.breadcrumb { padding-left:24px; padding-right:24px; }
  main.content h1, .part-title { font-size:26px !important; }
  main.content h2 { font-size:22px; }
  main.content table { font-size:13px; }
  main.content pre { font-size:12px; }
  nav.master-toc { padding:20px 22px; }
}
@media print {
  body { background:white; }
  header.page-header, footer.page-footer { break-inside:avoid; }
  main.content pre { border:1px solid var(--rule); }
}
</style>
</head>
<body>
<div class="shell">

<header class="page-header">
  <div class="eyebrow">Senior / L5 Ads Data Engineering · Interview Prep</div>
  <h1>Ads Data Engineering Interview Prep — A Senior-Level Deep Dive</h1>
  <p class="subhead">The handbook for the rounds that actually decide an ads DE loop: auctions, attribution, identity &amp; consent, ads-specific SQL, platform-level stacks, measurement &amp; visualization, plus ten full mock interview scenarios and the growth + behavioral framework.</p>
  <div class="meta-strip">
    <span>Senior / L5 Reference</span>
    <span>6 Parts · 10 Mock Scenarios</span>
    <span>April 2026</span>
  </div>
</header>

<nav class="breadcrumb">
  <a href="../index.html">← PaddySpeaks</a>
  <span class="sep">·</span>
  <a href="#contents">Contents</a>
  <span class="sep">·</span>
  <a href="#ads-part-01">Mock Scenarios →</a>
</nav>

<main class="content">
__TOC__
__SECTIONS__
</main>

<nav class="breadcrumb">
  <a href="../index.html">← PaddySpeaks</a>
  <span class="sep">·</span>
  <a href="#contents">↑ Contents</a>
</nav>

<footer class="page-footer">
  <div>Ads Data Engineering Interview Prep · © Paddy Iyer</div>
  <div><a href="../index.html">PaddySpeaks</a> · <a href="../about.html">About</a></div>
</footer>

</div>
</body>
</html>
'''


def main() -> None:
    toc = build_master_toc()
    sections = build_sections()
    out = HEAD.replace("__TOC__", toc).replace("__SECTIONS__", sections)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(out, encoding="utf-8")
    print(f"wrote {OUT} ({len(out):,} bytes)")


if __name__ == "__main__":
    main()
