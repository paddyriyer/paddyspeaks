#!/usr/bin/env python3
"""
Combine the 9 interview HTML files in interview/html/ into a single
SEO-optimized article: articles/data-engineering-interview-prep.html.

Namespacing strategy:
  - Each source file is assigned a partNN prefix (p00..p08).
  - Every id="X" in that file becomes id="pNN-X" in the combined output.
  - Every href="#X" in that file becomes href="#pNN-X".
  - Every href="<file>.html"   becomes href="#part-NN".
  - Every href="<file>.html#X" becomes href="#pMM-X" (target file's prefix).
"""
from __future__ import annotations

import html
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import viz_transform

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "interview" / "html"
OUT = ROOT / "articles" / "data-engineering-interview-prep.html"

PARTS = [
    ("00", "00-readme.html",                  "Overview",               "overview"),
    ("01", "01-data-modeling.html",           "Data Modeling",          "data-modeling"),
    ("02", "02-batch-processing.html",        "Batch Processing",       "batch-processing"),
    ("03", "03-streaming-processing.html",    "Streaming Processing",   "streaming-processing"),
    ("04", "04-spark-internals.html",         "Spark Internals",        "spark-internals"),
    ("05", "05-sql-deep-dive.html",           "SQL Deep Dive",          "sql-deep-dive"),
    ("06", "06-python-de.html",               "Python for Data Engineering", "python-de"),
    ("07", "07-lakehouse-iceberg.html",       "Lakehouse: Iceberg & Delta", "lakehouse-iceberg"),
    ("08", "08-interview-qa-scenarios.html",  "Interview Q&A — Real Scenarios", "interview-qa"),
    ("09", "09-prep-program.html",            "The Prep Program",               "prep-program"),
]

FILE_TO_PART = {filename: num for (num, filename, _t, _s) in PARTS}


MAIN_RE = re.compile(r'<main class="content">(.*?)</main>', re.DOTALL)


def extract_main(html_text: str) -> str:
    m = MAIN_RE.search(html_text)
    if not m:
        raise ValueError("no <main class='content'> block found")
    return m.group(1)


def rewrite_anchors(body: str, part_num: str) -> str:
    """Namespace anchors; rewrite cross-file links to in-page anchors."""

    def prefix_id(match: re.Match) -> str:
        return f'id="p{part_num}-{match.group(1)}"'

    body = re.sub(r'id="([^"]+)"', prefix_id, body)

    def fix_href(match: re.Match) -> str:
        href = match.group(1)
        # Local-only anchor: #foo -> #pNN-foo
        if href.startswith("#"):
            return f'href="#p{part_num}-{href[1:]}"'
        # Cross-file link with optional anchor: file.html or file.html#foo
        m = re.match(r'^([^#]+\.html)(?:#(.*))?$', href)
        if m:
            filename, anchor = m.group(1), m.group(2)
            target_part = FILE_TO_PART.get(filename)
            if target_part is None:
                return match.group(0)  # leave external links untouched
            if anchor:
                return f'href="#p{target_part}-{anchor}"'
            return f'href="#part-{target_part}"'
        return match.group(0)

    body = re.sub(r'href="([^"]+)"', fix_href, body)
    return body


def strip_local_toc(body: str) -> str:
    """
    Each source file opens with <h2 id='table-of-contents'>...</h2>
    followed by an <ol>. Drop both — we emit a single master TOC up top.
    """
    pattern = re.compile(
        r'<h2 id="[^"]*table-of-contents[^"]*">.*?</h2>\s*<ol>.*?</ol>',
        re.DOTALL | re.IGNORECASE,
    )
    return pattern.sub("", body)


def build_master_toc() -> str:
    """Modern sticky chip-nav of parts only (no 'Contents' / 'Table of Contents')."""
    chips = []
    for num, filename, title, slug in PARTS:
        label = "Overview" if num == "00" else f"Part {num}"
        chips.append(
            f'<a class="section-chip" href="#part-{num}" data-target="part-{num}">'
            f'<span class="chip-num">{label}</span>'
            f'<span class="chip-title">{html.escape(title)}</span>'
            f'</a>'
        )
    return (
        '<nav class="section-nav" aria-label="Jump to section">'
        '<div class="section-nav-inner">'
        + "".join(chips) +
        '</div>'
        '</nav>'
    )


def build_sections() -> str:
    chunks = []
    for num, filename, title, slug in PARTS:
        src = (SRC_DIR / filename).read_text(encoding="utf-8")
        body = extract_main(src)
        body = strip_local_toc(body)
        body = rewrite_anchors(body, num)
        body = viz_transform.apply(body)

        section_id = f"part-{num}"
        eyebrow = "Overview" if num == "00" else f"Part {num}"
        chunks.append(f'<section id="{section_id}" class="part-section" data-part="{num}">')
        chunks.append(
            f'<header class="part-header">'
            f'<div class="part-eyebrow">{eyebrow}</div>'
            f'<h1 class="part-title">{html.escape(title)}</h1>'
            f'</header>'
        )
        chunks.append(body.strip())
        chunks.append('<p class="back-to-top"><a href="#top">↑ Back to top</a></p>')
        chunks.append('</section>')
    return "\n".join(chunks)


HEAD = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<meta name="theme-color" content="#1a2332">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="format-detection" content="telephone=no">
<title>Data Engineering Interview Prep — Senior / L5 Deep Dive | PaddySpeaks</title>
<meta name="description" content="A senior-level data engineering interview prep handbook: data modeling, batch and streaming processing, Spark internals, SQL deep dive, Python for DE, lakehouse (Iceberg &amp; Delta), 40+ real interview Q&amp;A scenarios, plus a 4-week prep roadmap, failure catalog, Staff+ signals, and STAR behavioral frames.">
<meta name="keywords" content="data engineering interview, senior data engineer interview, L5 data engineering, data modeling interview, Spark internals, SQL deep dive, streaming processing, Iceberg, Delta Lake, Kimball, slowly changing dimensions, watermarks, exactly-once, PySpark">
<meta name="author" content="Paddy Iyer">
<link rel="canonical" href="https://paddyspeaks.com/articles/data-engineering-interview-prep.html">

<meta property="og:title" content="Data Engineering Interview Prep — Senior / L5 Deep Dive">
<meta property="og:description" content="Senior-level data engineering handbook: modeling, batch, streaming, Spark internals, SQL, Python, lakehouse, 40+ real scenarios, plus a 4-week prep roadmap and STAR behavioral frames.">
<meta property="og:type" content="article">
<meta property="og:url" content="https://paddyspeaks.com/articles/data-engineering-interview-prep.html">
<meta property="og:site_name" content="PaddySpeaks">
<meta property="og:image" content="https://paddyspeaks.com/images/og-default.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_US">
<meta property="article:author" content="Paddy Iyer">
<meta property="article:published_time" content="2026-04-20">
<meta property="article:section" content="Technology">
<meta property="article:tag" content="Data Engineering">
<meta property="article:tag" content="Interview Prep">
<meta property="article:tag" content="Spark">
<meta property="article:tag" content="SQL">
<meta property="article:tag" content="Iceberg">
<meta property="article:tag" content="Delta Lake">
<meta property="article:tag" content="Streaming">
<meta property="article:tag" content="Data Modeling">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Data Engineering Interview Prep — Senior / L5 Deep Dive">
<meta name="twitter:description" content="Senior-level data engineering handbook: modeling, batch, streaming, Spark internals, SQL, lakehouse, 40+ real scenarios, 4-week roadmap, STAR frames.">
<meta name="twitter:image" content="https://paddyspeaks.com/images/og-default.png">

<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Article","headline":"Data Engineering Interview Prep — Senior / L5 Deep Dive","description":"A production-grade senior data engineering interview handbook covering modeling, batch, streaming, Spark internals, SQL, Python for DE, Iceberg & Delta lakehouse, 40+ real interview scenarios, a 4-week prep roadmap, failure catalog, Staff+ signals, and STAR behavioral frames.","author":{"@type":"Person","name":"Paddy Iyer","url":"https://paddyspeaks.com/about.html"},"publisher":{"@type":"Organization","name":"PaddySpeaks","url":"https://paddyspeaks.com"},"datePublished":"2026-04-20","dateModified":"2026-04-20","mainEntityOfPage":"https://paddyspeaks.com/articles/data-engineering-interview-prep.html","articleSection":"Technology","keywords":"data engineering interview, Spark internals, SQL, streaming, Iceberg, Delta Lake, data modeling, PySpark, exactly-once, watermarks","isAccessibleForFree":true}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"PaddySpeaks","item":"https://paddyspeaks.com/"},{"@type":"ListItem","position":2,"name":"Articles","item":"https://paddyspeaks.com/articles/"},{"@type":"ListItem","position":3,"name":"Data Engineering Interview Prep"}]}
</script>

<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,500;0,8..60,600;1,8..60,300;1,8..60,400&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../style.css">

<style>
.article-page.longform .article-content { max-width: 1040px; padding: 0 40px 80px; }
.article-page.longform .article-hero    { max-width: 1040px; }

.section-nav {
  position: sticky; top: 0; z-index: 50;
  margin: 0 auto 40px;
  max-width: 1040px;
  padding: 14px 24px;
  background: rgba(238,243,249,0.92);
  backdrop-filter: saturate(1.2) blur(10px);
  -webkit-backdrop-filter: saturate(1.2) blur(10px);
  border-bottom: 1px solid var(--color-border-light);
}
.section-nav-inner {
  display: flex; gap: 10px; flex-wrap: nowrap; overflow-x: auto;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 2px;
}
.section-nav-inner::-webkit-scrollbar { height: 4px; }
.section-nav-inner::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 2px; }
.section-chip {
  flex: 0 0 auto;
  display: inline-flex; align-items: baseline; gap: 8px;
  padding: 9px 16px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: #fff;
  color: var(--color-ink);
  text-decoration: none;
  font-family: var(--font-body);
  font-size: 14px;
  line-height: 1;
  transition: all .2s ease;
  white-space: nowrap;
}
.section-chip:hover { border-color: var(--color-gold); color: var(--color-gold-dark); transform: translateY(-1px); }
.section-chip .chip-num { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--color-gold-dark); }
.section-chip.active { background: var(--color-ink); color: var(--color-cream); border-color: var(--color-ink); }
.section-chip.active .chip-num { color: var(--color-gold-light); }

.part-section { scroll-margin-top: 120px; margin-top: 80px; padding-top: 8px; }
.part-section:first-of-type { margin-top: 24px; }
.part-section + .part-section { border-top: 1px solid var(--color-border-light); padding-top: 56px; }
.part-section .part-header { text-align: center; margin: 0 0 32px; }
.part-section .part-eyebrow {
  font-family: var(--font-mono);
  font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--color-gold-dark);
  margin-bottom: 10px; display: block;
}
.part-section .part-title {
  font-family: var(--font-display);
  font-size: clamp(28px, 3.5vw, 42px);
  font-weight: 700; line-height: 1.15;
  color: var(--color-ink); margin: 0;
}

.part-section h1 { display: none; }
.part-section h2 { font-family: var(--font-display); font-size: 26px; font-weight: 600; margin: 40px 0 16px; color: var(--color-ink); line-height: 1.3; }
.part-section h3 { font-family: var(--font-display); font-size: 20px; font-weight: 600; margin: 30px 0 12px; color: var(--color-ink); }
.part-section h4 { font-family: var(--font-mono); font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--color-gold-dark); margin: 22px 0 8px; }
.part-section p { font-size: 17px; line-height: 1.8; margin: 0 0 18px; }
.part-section ul, .part-section ol { padding-left: 26px; margin: 0 0 20px; }
.part-section li { font-size: 17px; line-height: 1.75; margin-bottom: 8px; }
.part-section blockquote { border-left: 2px solid var(--color-gold); padding: 6px 0 6px 24px; margin: 28px 0; font-style: italic; color: var(--color-muted); font-size: 18px; line-height: 1.7; }
.part-section pre { background: #0f1e2e; color: #e8e0d6; padding: 20px 24px; border-radius: 6px; overflow-x: auto; margin: 18px 0 24px; font-family: var(--font-mono); font-size: 13.5px; line-height: 1.65; border: none; }
.part-section pre code { font-family: var(--font-mono); font-size: 13.5px; background: transparent; color: inherit; padding: 0; border: none; white-space: pre; }
.part-section code { font-family: var(--font-mono); font-size: 14px; background: var(--color-cream); color: var(--color-ink); padding: 2px 7px; border: 1px solid var(--color-border-light); border-radius: 3px; }
.part-section table { width: 100%; border-collapse: collapse; margin: 20px 0 28px; font-size: 14.5px; background: #fff; border: 1px solid var(--color-border); border-radius: 4px; overflow: hidden; }
.part-section thead th { background: var(--color-ink); color: var(--color-cream); text-align: left; padding: 10px 14px; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 500; }
.part-section tbody td { padding: 10px 14px; border-top: 1px solid var(--color-border-light); vertical-align: top; }
.part-section tbody tr:nth-child(even) td { background: var(--color-cream); }
.part-section hr { margin: 36px 0; border: none; border-top: 1px solid var(--color-border-light); }
.part-section a { color: var(--color-gold-dark); text-decoration: none; border-bottom: 1px solid var(--color-gold-light); transition: border-color .2s; }
.part-section a:hover { border-bottom-color: var(--color-gold-dark); }
.back-to-top { text-align: right; margin: 30px 0 0; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; }
.back-to-top a { color: var(--color-light-muted); border-bottom: 1px dashed var(--color-border); }
.back-to-top a:hover { color: var(--color-gold-dark); border-bottom-color: var(--color-gold-dark); }

.part-section h2[id$="contents"], .part-section h2[id$="table-of-contents"] { display: none; }

@media (max-width: 700px) {
  .section-nav { padding: 10px 16px; margin-bottom: 28px; }
  .section-chip { padding: 7px 12px; font-size: 13px; }
  .section-chip .chip-num { font-size: 9px; letter-spacing: 0.14em; }
  .part-section .part-title { font-size: 28px; }
  .part-section table { font-size: 13px; }
}

/* ═══ VISUALIZATIONS ═══ */
.viz {
  margin: 32px 0;
  padding: 24px 28px;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(26,35,50,.04);
}
.viz-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--color-gold-dark);
  margin-bottom: 18px;
}

/* Funnel bar chart */
.funnel-rows { display: flex; flex-direction: column; gap: 10px; }
.funnel-row {
  display: grid;
  grid-template-columns: 160px 1fr 140px;
  align-items: center;
  gap: 14px;
}
.f-label { font-family: var(--font-body); font-size: 15px; color: var(--color-ink); font-weight: 500; }
.f-value { font-family: var(--font-mono); font-size: 14px; color: var(--color-ink); font-weight: 600; text-align: right; }
.f-track {
  height: 36px;
  background: var(--color-cream);
  border-radius: 6px;
  overflow: hidden;
  position: relative;
}
.f-bar {
  height: 100%;
  width: calc(var(--w) * 1%);
  background: linear-gradient(90deg, #2563a8 0%, #1a4f8a 65%, #c44b2b 140%);
  border-radius: 6px;
  transition: width 1.2s cubic-bezier(.2,.9,.3,1);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.12);
}
.funnel-drop {
  display: grid;
  grid-template-columns: 160px 1fr 140px;
  gap: 14px;
  margin: -4px 0;
}
.drop-pct {
  grid-column: 2;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-rust);
  background: rgba(196,75,43,.08);
  border: 1px solid rgba(196,75,43,.22);
  padding: 3px 10px;
  border-radius: 999px;
  justify-self: start;
}

/* Stage ladder */
.ladder-rows { display: flex; flex-direction: column; gap: 10px; }
.ladder-row {
  display: grid;
  grid-template-columns: 180px 1fr 120px 160px;
  gap: 12px;
  align-items: center;
}
.l-label { font-family: var(--font-body); font-size: 15px; font-weight: 500; color: var(--color-ink); }
.l-value { font-family: var(--font-mono); font-size: 14px; font-weight: 600; color: var(--color-ink); text-align: right; }
.l-note { font-family: var(--font-mono); font-size: 12px; color: var(--color-light-muted); }
.l-track {
  height: 28px;
  background: var(--color-cream);
  border-radius: 4px;
  overflow: hidden;
}
.l-bar {
  height: 100%;
  width: calc(var(--w) * 1%);
  background: linear-gradient(90deg, #2a7a4a 0%, #1a4f3a 100%);
  border-radius: 4px;
}

/* Horizontal arrow flow */
.viz-flow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 28px 0;
  padding: 20px 24px;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 10px;
}
.flow-step {
  padding: 8px 16px;
  background: var(--color-cream);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 14px;
  color: var(--color-ink);
  white-space: nowrap;
}
.flow-arrow {
  color: var(--color-gold-dark);
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 16px;
}

/* Vertical arrow funnel */
.viz-vflow { padding: 24px 28px; }
.vflow-rows { display: flex; flex-direction: column; }
.vflow-stage {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  background: var(--color-cream);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 15px;
  color: var(--color-ink);
  font-weight: 500;
  align-self: flex-start;
  max-width: 100%;
}
.vflow-stage.is-last {
  background: linear-gradient(90deg, #2563a8, #1a4f8a);
  color: var(--color-cream);
  border-color: transparent;
}
.vflow-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: var(--color-gold-dark);
  flex-shrink: 0;
}
.vflow-stage.is-last .vflow-dot { background: var(--color-gold-light); }
.vflow-edge {
  width: 2px;
  height: 28px;
  background: var(--color-border);
  margin-left: 25px;
  position: relative;
  display: flex;
  align-items: center;
}
.vflow-rate {
  position: absolute;
  left: 28px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-rust);
  background: rgba(196,75,43,.08);
  border: 1px solid rgba(196,75,43,.22);
  padding: 2px 10px;
  border-radius: 999px;
  white-space: nowrap;
}

/* Box card (dashboard-style) */
.viz-card {
  padding: 0;
  overflow: hidden;
}
.viz-card .card-head {
  background: linear-gradient(135deg, #1a2332 0%, #2a3a4e 100%);
  color: var(--color-cream);
  padding: 18px 24px;
}
.viz-card .card-head-line {
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: 0.03em;
  line-height: 1.6;
  color: var(--color-cream);
}
.viz-card .card-head-line:first-child {
  font-family: var(--font-display);
  font-size: 18px;
  letter-spacing: 0;
  font-weight: 600;
  margin-bottom: 4px;
  color: #fff;
}
.viz-card .card-section {
  padding: 16px 24px;
  border-top: 1px solid var(--color-border-light);
}
.viz-card .card-section:first-of-type { border-top: none; }
.viz-card .card-sec-title {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--color-gold-dark);
  margin-bottom: 8px;
}
.viz-card .card-sec-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.viz-card .card-sec-list li {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--color-ink);
  padding: 2px 0;
}

/* Histogram */
.viz-histogram { padding: 24px 28px; }
.hist-row {
  display: grid;
  grid-template-columns: 160px 1fr 80px 160px;
  gap: 12px;
  align-items: center;
  padding: 6px 0;
}
.hist-label { font-family: var(--font-body); font-size: 14px; color: var(--color-ink); }
.hist-value { font-family: var(--font-mono); font-size: 14px; font-weight: 600; color: var(--color-ink); text-align: right; }
.hist-note { font-family: var(--font-mono); font-size: 11px; color: var(--color-light-muted); }
.hist-track { height: 20px; background: var(--color-cream); border-radius: 3px; overflow: hidden; }
.hist-bar {
  height: 100%;
  width: calc(var(--w) * 1%);
  background: linear-gradient(90deg, #2563a8 0%, #a8c8e8 100%);
  border-radius: 3px;
}

@media (max-width: 700px) {
  .funnel-row, .funnel-drop { grid-template-columns: 110px 1fr 90px; gap: 10px; }
  .ladder-row { grid-template-columns: 120px 1fr 80px; }
  .ladder-row .l-note { display: none; }
  .hist-row { grid-template-columns: 110px 1fr 60px; }
  .hist-row .hist-note { display: none; }
  .viz, .viz-flow { padding: 16px 18px; }
}

</style>
</head>
<body id="top">
<main>

<div class="page-frame"></div>
<div class="reading-progress" id="readingProgress"></div>
<div class="top-bar"><span>Est. 2026</span><span>Philosophy · Technology · Wisdom</span><a href="https://linkedin.com/in/paddyiyer" target="_blank" rel="noopener">LinkedIn ↗</a></div>
<header class="masthead"><h2><a href="../index.html">Paddy<span>Speaks</span></a></h2><p class="masthead-tagline">Where ancient wisdom meets the architecture of tomorrow</p>
<div class="masthead-rule"></div>
</header>
<nav class="nav-bar">
  <a href="../index.html">Journal</a>
  <a href="../index.html#philosophy">Philosophy</a>
  <a href="../index.html#technology">Technology</a>
  <a href="../index.html#ai">AI &amp; Future</a>
  <a href="../index.html#archive">Archive</a>
  <a href="../index.html#sacred-texts">Sacred Texts</a>
  <a href="../about.html">About</a>
</nav>

<div class="article-page longform">
<a class="back-to-home" href="../index.html">← All Articles</a>

<div class="article-hero">
  <span class="tag">technology · interview prep</span>
  <h1>Data Engineering Interview Prep</h1>
  <p class="subtitle">A senior / L5 handbook for the rounds that actually decide a DE loop — modeling, batch, streaming, Spark internals, SQL, Python, the lakehouse, 40+ real scenarios, the 4-week roadmap, failure catalog, Staff+ signals, and STAR behavioral frames.</p>
  <div class="article-meta">
    <span>By Paddy</span><span class="dot"></span>
    <span>April 20, 2026</span><span class="dot"></span>
    <span>120 min read</span>
  </div>
</div>

__TOC__

<div class="article-content">
__SECTIONS__
</div>

</div>

<footer class="site-footer">
<div class="footer-ornament">❧</div>
<div class="footer-links"><a href="https://linkedin.com/in/paddyiyer" target="_blank" rel="noopener">LinkedIn</a><a href="../about.html">About</a><a href="mailto:paddy@paddyspeaks.com">Contact</a></div>
<p class="footer-copy">© 2026 PaddySpeaks. All rights reserved.</p></footer>

<script>
window.addEventListener('scroll',function(){var b=document.getElementById('readingProgress');if(b)b.style.width=(window.scrollY/(document.documentElement.scrollHeight-window.innerHeight))*100+'%';});
(function(){
  var chips=[].slice.call(document.querySelectorAll('.section-chip'));
  var sections=chips.map(function(c){return document.getElementById(c.getAttribute('data-target'));}).filter(Boolean);
  if(!sections.length) return;
  var io=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){
        chips.forEach(function(c){c.classList.remove('active');});
        var ch=document.querySelector('.section-chip[data-target="'+e.target.id+'"]');
        if(ch){ch.classList.add('active'); ch.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});}
      }
    });
  },{rootMargin:'-40% 0px -55% 0px', threshold:0});
  sections.forEach(function(s){io.observe(s);});
})();
</script>
<script defer src="/lib/ps.js"></script>
</main>
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
