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
import css_minify

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
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap"></noscript>
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

.part-section { scroll-margin-top: 120px; margin-top: 80px; padding-top: 8px; content-visibility: auto; contain-intrinsic-size: 0 1800px; }
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


/* ═══ ADDITIONAL VISUALIZATIONS ═══ */

/* Hierarchy chain */
.viz-chain .chain-row { display: flex; align-items: stretch; flex-wrap: wrap; gap: 0; padding: 10px 8px 14px; }
.chain-node { flex: 1 1 140px; min-width: 140px; background: linear-gradient(135deg, #1a2332, #2a3a4e); color: #fff; border-radius: 8px; padding: 14px 16px; text-align: center; display: flex; align-items: center; justify-content: center; }
.chain-node-name { font-family: var(--font-display); font-size: 17px; font-weight: 600; }
.chain-rel { flex: 0 0 80px; min-width: 50px; display: flex; align-items: center; justify-content: center; position: relative; gap: 6px; padding: 0 4px; flex-direction: column; }
.chain-rel-line { display: block; height: 2px; width: 100%; background: linear-gradient(90deg, #c8d6e5, #2563a8, #c8d6e5); border-radius: 2px; }
.chain-rel-label { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-gold-dark); background: var(--color-cream); padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.chain-descriptors { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; padding: 8px 12px 16px; }
.chain-descriptor { background: var(--color-cream); border-radius: 6px; padding: 10px 12px; font-family: var(--font-body); font-size: 13px; color: var(--color-muted); line-height: 1.6; }

/* Tradeoff triangle */
.viz-triangle .tri-wrap { position: relative; padding: 8px; max-width: 520px; margin: 0 auto; aspect-ratio: 1.2 / 1; }
.viz-triangle .tri-svg { width: 100%; height: 100%; }
.tri-vertex { position: absolute; max-width: 180px; text-align: center; }
.tri-vertex .tri-axis { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-gold-dark); font-weight: 600; margin-bottom: 4px; }
.tri-vertex .tri-notes { list-style: none; margin: 0; padding: 0; font-family: var(--font-body); font-size: 12px; line-height: 1.55; color: var(--color-muted); }
.tri-vertex .tri-notes li { padding: 1px 0; }
.tri-top { top: 0; left: 50%; transform: translate(-50%, -8px); }
.tri-left { bottom: 6px; left: 0; }
.tri-right { bottom: 6px; right: 0; }

/* Flow with branches */
.viz-flow-branch { padding: 20px 24px; }
.fb-chain { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-bottom: 12px; border-bottom: 1px dashed var(--color-border-light); margin-bottom: 12px; }
.fb-step { padding: 8px 16px; background: linear-gradient(135deg, #1a2332, #2a3a4e); color: #fff; border-radius: 999px; font-family: var(--font-body); font-size: 14px; font-weight: 500; }
.fb-step:last-of-type { background: linear-gradient(135deg, #2563a8, #1a4f8a); }
.fb-arrow { color: var(--color-gold-dark); font-family: var(--font-mono); font-weight: 600; font-size: 16px; }
.fb-branch-from { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-light-muted); margin-bottom: 8px; }
.fb-branches { display: flex; flex-wrap: wrap; gap: 10px; }
.fb-branch { display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: var(--color-cream); border: 1px solid var(--color-border-light); border-left-width: 4px; border-radius: 6px; font-family: var(--font-body); font-size: 13.5px; color: var(--color-ink); flex: 1 1 240px; }
.fb-branch.is-pass { border-left-color: #2a7a4a; }
.fb-branch.is-fail { border-left-color: #c44b2b; background: #fef0ec; }
.fb-branch.is-alt { border-left-color: var(--color-gold); }
.fb-branch-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
.fb-branch.is-pass .fb-branch-dot { background: #2a7a4a; }
.fb-branch.is-fail .fb-branch-dot { background: #c44b2b; }
.fb-branch.is-alt .fb-branch-dot { background: var(--color-gold); }

/* Tree diagram */
.viz-tree { padding: 20px 24px; }
.tree-root, .tree-sub { list-style: none; margin: 0; padding: 0; }
.tree-sub { padding-left: 22px; position: relative; }
.tree-sub::before { content: ''; position: absolute; left: 9px; top: 0; bottom: 8px; border-left: 1px dashed var(--color-border); }
.tree-node { position: relative; padding: 4px 0 4px 22px; font-family: var(--font-mono); font-size: 13px; color: var(--color-ink); line-height: 1.6; }
.tree-sub .tree-node::before { content: ''; position: absolute; left: -13px; top: 14px; width: 20px; border-top: 1px dashed var(--color-border); }
.tree-glyph { position: absolute; left: 4px; top: 50%; transform: translateY(-50%); width: 8px; height: 8px; border-radius: 50%; background: var(--color-gold-dark); }
.tree-sub .tree-glyph { background: var(--color-gold); width: 6px; height: 6px; }
.tree-text { margin-left: 6px; }

/* Schema fallback */
.viz-schema { padding: 20px 24px; }
.schema-root, .schema-sub { list-style: none; margin: 0; padding: 0; }
.schema-sub { padding-left: 22px; position: relative; }
.schema-sub::before { content: ''; position: absolute; left: 9px; top: 0; bottom: 8px; border-left: 1px dashed var(--color-border); }
.schema-node { position: relative; padding: 5px 0 5px 22px; font-family: var(--font-mono); font-size: 13px; color: var(--color-ink); line-height: 1.6; }
.schema-sub .schema-node::before { content: ''; position: absolute; left: -13px; top: 16px; width: 20px; border-top: 1px dashed var(--color-border); }
.schema-glyph { position: absolute; left: 4px; top: 50%; transform: translateY(-50%); width: 8px; height: 8px; border-radius: 2px; background: var(--color-gold-dark); }
.schema-sub .schema-glyph { background: var(--color-gold); width: 5px; height: 5px; border-radius: 50%; }
.schema-text { margin-left: 6px; }

/* Column histogram (vertical bars) */
.viz-column-hist { padding: 20px 24px; }
.viz-column-hist .ch-plot { display: flex; align-items: flex-end; gap: 10px; height: 200px; padding: 10px 0; border-bottom: 1px solid var(--color-border); }
.ch-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.ch-bar { width: 100%; max-width: 60px; background: linear-gradient(180deg, #2563a8, #1a4f8a); border-radius: 4px 4px 0 0; height: calc(var(--h, 0%)); min-height: 2px; position: relative; transition: height .9s cubic-bezier(.2,.8,.2,1); }
.ch-count { position: absolute; top: -22px; left: 50%; transform: translateX(-50%); font-family: var(--font-mono); font-size: 11px; color: var(--color-ink); font-weight: 600; }
.ch-label { font-family: var(--font-mono); font-size: 11px; color: var(--color-light-muted); margin-top: 4px; }

/* ═══ MOBILE POLISH ═══ */
@media (max-width: 820px) {
  /* Article shell */
  .article-page.longform .article-content { padding: 0 16px 60px; max-width: 100%; }
  .article-page.longform .article-hero { padding: 40px 16px 30px; max-width: 100%; }
  .article-hero h1 { font-size: clamp(24px, 6vw, 36px); }
  .article-hero .subtitle { font-size: 16px; }

  /* Section chip nav */
  .section-nav { padding: 8px 12px; margin-bottom: 20px; max-width: 100%; border-radius: 0; }
  .section-nav-inner { gap: 6px; }
  .section-chip { padding: 6px 10px; font-size: 12.5px; }
  .section-chip .chip-num { font-size: 9px; letter-spacing: 0.12em; }

  /* Part titles */
  .part-section { margin-top: 48px; }
  .part-section .part-title { font-size: clamp(22px, 5.5vw, 28px); }

  /* Typography in part sections */
  .part-section h2 { font-size: 20px; margin: 28px 0 10px; }
  .part-section h3 { font-size: 17px; margin: 22px 0 8px; }
  .part-section p, .part-section li { font-size: 15px; line-height: 1.7; }

  /* Tables overflow */
  .part-section table { display: block; overflow-x: auto; max-width: 100%; font-size: 12.5px; -webkit-overflow-scrolling: touch; }
  .part-section pre { font-size: 12px; padding: 14px 16px; border-radius: 4px; }

  /* Generic viz */
  .viz { padding: 14px 14px; margin: 20px -4px; border-radius: 6px; }
  .viz-label { font-size: 9.5px; letter-spacing: 0.18em; }

  /* Funnel viz */
  .funnel-row { grid-template-columns: 90px 1fr 70px; gap: 8px; font-size: 12.5px; }
  .f-label { font-size: 13px; }
  .f-value { font-size: 12px; }
  .f-track { height: 26px; }
  .funnel-drop { grid-template-columns: 90px 1fr 70px; gap: 8px; }
  .drop-pct { font-size: 10px; padding: 2px 8px; }

  /* Horizontal arrow flow */
  .viz-flow { flex-direction: column; align-items: flex-start; padding: 14px 16px; }
  .viz-flow .flow-arrow { transform: rotate(90deg); }

  /* Histogram */
  .hist-row { grid-template-columns: 110px 1fr 56px; font-size: 12px; }
  .hist-row .hist-note { display: none; }
  .hist-label { font-size: 12.5px; }
  .hist-value { font-size: 12px; }

  /* Column histogram */
  .viz-column-hist .ch-plot { height: 160px; gap: 4px; }
  .ch-bar { max-width: 30px; }
  .ch-label { font-size: 10px; }
  .ch-count { font-size: 10px; top: -18px; }

  /* Ladder */
  .ladder-row { grid-template-columns: 100px 1fr 70px; gap: 8px; font-size: 12.5px; }
  .ladder-row .l-note { display: none; }

  /* Box card */
  .viz-card .card-head { padding: 14px 16px; }
  .viz-card .card-head-line:first-child { font-size: 15px; }
  .viz-card .card-head-line { font-size: 12px; }
  .viz-card .card-section { padding: 12px 16px; }

  /* Chain (hierarchy) */
  .viz-chain .chain-row { flex-direction: column; gap: 10px; padding: 10px; }
  .chain-rel { flex-direction: row; width: 100%; height: 36px; }
  .chain-rel-line { transform: rotate(90deg); width: 36px; }
  .chain-node { min-width: 0; width: 100%; }
  .chain-descriptors { grid-template-columns: 1fr; }

  /* Tradeoff triangle */
  .viz-triangle .tri-wrap { max-width: 100%; aspect-ratio: 1 / 1; }
  .tri-vertex { max-width: 140px; }
  .tri-vertex .tri-axis { font-size: 10px; }
  .tri-vertex .tri-notes { font-size: 11px; }

  /* Flow with branches */
  .viz-flow-branch { padding: 14px 16px; }
  .fb-chain { gap: 4px; }
  .fb-step { padding: 6px 12px; font-size: 12.5px; }
  .fb-branches { flex-direction: column; }
  .fb-branch { flex: 1 1 100%; font-size: 12.5px; }

  /* Vertical flow */
  .viz-vflow { padding: 14px 16px; }
  .vflow-stage { padding: 8px 14px; font-size: 13.5px; }
  .vflow-rate { font-size: 10px; left: 22px; padding: 2px 8px; }
  .vflow-edge { height: 22px; margin-left: 20px; }

  /* Tree / schema */
  .viz-tree, .viz-schema { padding: 14px 16px; }
  .tree-node, .schema-node { font-size: 12px; padding: 3px 0 3px 20px; }
  .tree-sub, .schema-sub { padding-left: 18px; }

  /* Dashboards */
  .dash { margin: 24px -4px; border-radius: 6px; }
  .dash-head { padding: 16px 16px 10px; flex-direction: column; gap: 12px; }
  .dash-title { font-size: 17px; }
  .dash-eyebrow { font-size: 9px; }
  .dash-tabs { align-self: stretch; }
  .dash-tab { flex: 1; text-align: center; font-size: 10px; padding: 6px 8px; }
  .dash-footnote { padding: 12px 16px; font-size: 10.5px; }

  /* Funnel dashboard */
  .dash-funnel-body { grid-template-columns: 1fr; gap: 18px; padding: 14px 16px; }
  .dfrow { grid-template-columns: 22px 1fr 64px 50px; gap: 6px; font-size: 12px; padding: 8px; }
  .dfrow-delta { display: none; }
  .dfrow-note { padding-left: 28px; font-size: 11px; }

  /* Install funnel */
  .install-rows { padding: 14px 16px; gap: 10px; }
  .irow-head { gap: 8px; }
  .irow-name { font-size: 14px; }
  .irow-drop { margin-left: 0; flex-basis: 100%; }

  /* Lead gen dashboard */
  .dash-kpis { flex-wrap: wrap; gap: 6px; }
  .kpi { padding: 8px 12px; min-width: 0; flex: 1; }
  .kpi-value { font-size: 18px; }
  .lead-grid { grid-template-columns: 1fr; padding: 14px 16px; gap: 20px; }
  .lstage { width: auto !important; min-width: 0; padding: 12px 14px; }
  .lstage-value { font-size: 22px; }
  .cycle-plot { height: 100px; }

  /* Campaign dashboard */
  .dash-campaign-head { padding: 16px; flex-direction: column; align-items: flex-start; gap: 12px; }
  .perf-score { align-self: center; }
  .dash-kpi-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 14px 16px; }
  .kpic { padding: 10px 12px; }
  .kpic-value { font-size: 20px; }
  .kpic-spark { height: 24px; }
  .dash-signal-grid { grid-template-columns: 1fr; padding: 0 16px 14px; gap: 8px; }
  .signal { padding: 10px 14px; }
  .signal-body { font-size: 12.5px; }

  /* ROAS bars */
  .roas-grid { padding: 14px 16px; }
  .roas-bar { width: 100% !important; height: 40px; padding: 0 12px; font-size: 12px; }
  .roas-bar .roas-label { font-size: 12.5px; }
  .roas-bar .roas-value { font-size: 11px; }

  /* Growth accounting */
  .growth-grid { grid-template-columns: 1fr; padding: 14px 16px; gap: 14px; }
  .growth-chart svg { height: 240px; }
  .growth-insights { grid-template-columns: 1fr; }
  .gl-row { grid-template-columns: 14px 70px 1fr; gap: 8px; padding: 6px 10px; }
  .gl-name { font-size: 12.5px; }
  .gl-desc { font-size: 11.5px; }

  /* Money waterfall */
  .waste-waterfall { padding: 14px 16px; gap: 8px; }
  .wrow { grid-template-columns: 1fr 80px; gap: 6px; }
  .wrow-bar { display: none; }
  .wrow-label { font-size: 12.5px; }
  .wrow-value { font-size: 12px; }
  .wrow-why { font-size: 11px; padding-left: 10px; }
  .wrow-total .wrow-label { font-size: 14px; }
  .waste-recap { grid-template-columns: 1fr; padding: 0 16px 14px; gap: 8px; }
  .recap-card { padding: 12px 14px; }
  .recap-value { font-size: 20px; }

  /* Improvement matrix */
  .improve-matrix-wrap { grid-template-columns: 1fr; padding: 14px 16px; gap: 16px; }
  .matrix-grid { height: 280px; }
  .bubble { border-width: 2px; }
  .b-tip { font-size: 9px; padding: 3px 6px; }
  .improve-total { padding: 10px 16px; flex-direction: column; gap: 4px; align-items: flex-start; }
  .improve-total strong { font-size: 16px; }
  .improve-caveat { font-size: 9px; }
}

@media (max-width: 560px) {
  /* Even tighter for small phones */
  .dash-kpi-grid { grid-template-columns: 1fr 1fr; }
  .funnel-row { grid-template-columns: 80px 1fr 60px; }
  .hist-row { grid-template-columns: 90px 1fr 44px; }
  .ladder-row { grid-template-columns: 90px 1fr 60px; }
  .section-nav { padding: 8px 10px; }
  .section-chip { padding: 5px 9px; font-size: 12px; }
  .chain-node { padding: 10px 12px; }
  .chain-node-name { font-size: 14px; }
  .matrix-grid { height: 240px; }
}

/* Top chrome (top-bar / masthead / nav-bar) mobile fit */
@media (max-width: 640px) {
  .top-bar { padding: 10px 16px; font-size: 9px; flex-wrap: wrap; gap: 6px; }
  .top-bar span:nth-child(2) { display: none; }
  .masthead { padding: 36px 16px 28px; }
  .masthead h1, .masthead h2 { font-size: clamp(36px, 9vw, 54px) !important; }
  .masthead-tagline { font-size: 13px; padding: 0 10px; }
  .nav-bar { gap: 16px; padding: 14px 12px; flex-wrap: wrap; justify-content: flex-start; overflow-x: auto; font-size: 10.5px; white-space: nowrap; }
}


/* ═══ PURE-HTML FUNNEL (replaces SVG funnel) ═══ */
.hf-funnel {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 20px 0;
  background: var(--color-cream);
  border-radius: 8px;
}
.hf-row { display: flex; justify-content: center; align-items: center; width: 100%; }
.hf-bar {
  height: 46px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-family: var(--font-body);
  transition: width 0.9s cubic-bezier(.2,.8,.2,1), transform .15s;
  min-width: 60px;
  cursor: default;
  box-shadow: 0 1px 2px rgba(0,0,0,.08);
}
/* hover scale removed to avoid composite-layer work */
.hf-text { display: flex; gap: 12px; padding: 0 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13.5px; }
.hf-name { font-weight: 500; opacity: 0.95; }
.hf-count { font-family: var(--font-mono); font-size: 12px; opacity: 0.85; }
.hf-g1 { background: linear-gradient(90deg, #2563a8, #1a4f8a); }
.hf-g2 { background: linear-gradient(90deg, #1a4f8a, #0f3d70); }
.hf-g3 { background: linear-gradient(90deg, #0f3d70, #0a2c52); }
.hf-g4 { background: linear-gradient(90deg, #c44b2b, #9e3a1e); }
.hf-g5 { background: linear-gradient(90deg, #2a7a4a, #1a4f30); }
.hf-g6 { background: linear-gradient(90deg, #1a4f30, #0a2c18); }

/* ═══ QUICK NAV BUTTONS (top / bottom) ═══ */
.quick-nav {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.qn-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(26,35,50,0.92);
  color: #fff;
  border: none;
  font-family: var(--font-mono);
  font-size: 18px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(26,35,50,0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background .2s, transform .2s;
  padding: 0;
  line-height: 1;
}
.qn-btn:hover { background: var(--color-gold-dark); transform: translateY(-2px); will-change: transform; }
.qn-btn:active { transform: scale(0.95); }
.qn-label {
  position: absolute;
  right: 54px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(26,35,50,0.92);
  color: #fff;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 4px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity .2s;
}
.qn-btn:hover .qn-label { opacity: 1; }

@media (max-width: 820px) {
  .quick-nav { right: 12px; bottom: 12px; gap: 6px; }
  .qn-btn { width: 40px; height: 40px; font-size: 16px; }
  .qn-label { display: none; }
  .hf-bar { height: 38px; }
  .hf-text { font-size: 12px; gap: 6px; padding: 0 10px; }
  .hf-count { font-size: 11px; }
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
    out = css_minify.minify_inline_style_blocks(out)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(out, encoding="utf-8")
    print(f"wrote {OUT} ({len(out):,} bytes)")


if __name__ == "__main__":
    main()
