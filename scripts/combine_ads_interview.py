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
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import viz_transform
import ads_dashboards
import custom_diagrams

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
    ("06", "Part6_Room_Pressure_Decisions.html",        "The Room · Real Decisions",          "the-room"),
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
    """Build a modern sticky chip-nav of parts only (no sub-lists, no 'Contents' label)."""
    items = []
    for num, filename, title, slug in PARTS:
        items.append((num, slug, title))

    chips = []
    for num, slug, title in items:
        label = "Overview" if num == "IX" else f"Part {num}"
        chips.append(
            f'<a class="section-chip" href="#ads-part-{num}" data-target="ads-part-{num}">'
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
        body = custom_diagrams.apply(body)
        body = viz_transform.apply(body)

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
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,500;0,8..60,600;1,8..60,300;1,8..60,400&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../style.css">

<style>
/* Longform overrides — wider content area for code-heavy article */
.article-page.longform .article-content { max-width: 1040px; padding: 0 40px 80px; }
.article-page.longform .article-hero    { max-width: 1040px; }

/* Sticky modern chip-nav replacing Contents / Table of Contents */
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
.section-chip:hover {
  border-color: var(--color-gold);
  color: var(--color-gold-dark);
  transform: translateY(-1px);
}
.section-chip .chip-num {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-gold-dark);
}
.section-chip.active {
  background: var(--color-ink);
  color: var(--color-cream);
  border-color: var(--color-ink);
}
.section-chip.active .chip-num { color: var(--color-gold-light); }

/* Part sections — clean, site-native dividers */
.part-section { scroll-margin-top: 120px; margin-top: 80px; padding-top: 8px; }
.part-section:first-of-type { margin-top: 24px; }
.part-section + .part-section { border-top: 1px solid var(--color-border-light); padding-top: 56px; }
.part-section .part-header { text-align: center; margin: 0 0 32px; }
.part-section .part-eyebrow {
  font-family: var(--font-mono);
  font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--color-gold-dark);
  margin-bottom: 10px;
  display: block;
}
.part-section .part-title {
  font-family: var(--font-display);
  font-size: clamp(28px, 3.5vw, 42px);
  font-weight: 700;
  line-height: 1.15;
  color: var(--color-ink);
  margin: 0;
}

/* Inline content inside parts — match site article-content defaults */
.part-section h1 { display: none; } /* older template H1 — hidden in favor of part-title */
.part-section h2 {
  font-family: var(--font-display);
  font-size: 26px; font-weight: 600;
  margin: 40px 0 16px;
  color: var(--color-ink);
  line-height: 1.3;
}
.part-section h3 {
  font-family: var(--font-display);
  font-size: 20px; font-weight: 600;
  margin: 30px 0 12px;
  color: var(--color-ink);
}
.part-section h4 {
  font-family: var(--font-mono);
  font-size: 12px; font-weight: 600; letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-gold-dark);
  margin: 22px 0 8px;
}
.part-section p { font-size: 17px; line-height: 1.8; margin: 0 0 18px; }
.part-section ul, .part-section ol { padding-left: 26px; margin: 0 0 20px; }
.part-section li { font-size: 17px; line-height: 1.75; margin-bottom: 8px; }
.part-section blockquote {
  border-left: 2px solid var(--color-gold);
  padding: 6px 0 6px 24px;
  margin: 28px 0;
  font-style: italic;
  color: var(--color-muted);
  font-size: 18px; line-height: 1.7;
}
.part-section pre {
  background: #0f1e2e;
  color: #e8e0d6;
  padding: 20px 24px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 18px 0 24px;
  font-family: var(--font-mono);
  font-size: 13.5px; line-height: 1.65;
  border: none;
}
.part-section pre code {
  font-family: var(--font-mono);
  font-size: 13.5px;
  background: transparent; color: inherit; padding: 0; border: none;
  white-space: pre;
}
.part-section code {
  font-family: var(--font-mono);
  font-size: 14px;
  background: var(--color-cream);
  color: var(--color-ink);
  padding: 2px 7px;
  border: 1px solid var(--color-border-light);
  border-radius: 3px;
}
.part-section table {
  width: 100%; border-collapse: collapse;
  margin: 20px 0 28px; font-size: 14.5px;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 4px; overflow: hidden;
}
.part-section thead th {
  background: var(--color-ink); color: var(--color-cream);
  text-align: left; padding: 10px 14px;
  font-family: var(--font-mono);
  font-size: 11px; letter-spacing: 0.1em;
  text-transform: uppercase; font-weight: 500;
}
.part-section tbody td {
  padding: 10px 14px;
  border-top: 1px solid var(--color-border-light);
  vertical-align: top;
}
.part-section tbody tr:nth-child(even) td { background: var(--color-cream); }
.part-section hr { margin: 36px 0; border: none; border-top: 1px solid var(--color-border-light); }
.part-section a { color: var(--color-gold-dark); text-decoration: none; border-bottom: 1px solid var(--color-gold-light); transition: border-color .2s; }
.part-section a:hover { border-bottom-color: var(--color-gold-dark); }
.back-to-top {
  text-align: right; margin: 30px 0 0;
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
}
.back-to-top a { color: var(--color-light-muted); border-bottom: 1px dashed var(--color-border); }
.back-to-top a:hover { color: var(--color-gold-dark); border-bottom-color: var(--color-gold-dark); }

/* Drop the old inline h2 "Contents" / "Table of Contents" if it leaks from source */
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


/* ═══ INTERACTIVE DASHBOARDS ═══ */
.dash {
  margin: 36px 0;
  padding: 0;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 14px rgba(26,35,50,.06);
}
.dash-head {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 22px 28px 16px;
  border-bottom: 1px solid var(--color-border-light);
  gap: 24px;
  flex-wrap: wrap;
}
.dash-eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--color-gold-dark);
  margin-bottom: 6px;
}
.dash-title {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
  margin: 0;
  color: var(--color-ink);
  line-height: 1.3;
}
.dash-tabs { display: flex; gap: 4px; background: var(--color-cream); padding: 4px; border-radius: 999px; border: 1px solid var(--color-border-light); }
.dash-tab {
  padding: 6px 14px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: transparent;
  border: none;
  border-radius: 999px;
  color: var(--color-light-muted);
  cursor: pointer;
  transition: all .2s;
}
.dash-tab.is-active { background: var(--color-ink); color: var(--color-cream); }
.dash-tab:hover:not(.is-active) { color: var(--color-ink); }
.dash-legend { display: flex; gap: 14px; font-family: var(--font-mono); font-size: 11px; color: var(--color-light-muted); }
.dash-legend .d-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
.dash-footnote {
  padding: 14px 28px;
  background: var(--color-cream);
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--color-light-muted);
  line-height: 1.7;
  border-top: 1px solid var(--color-border-light);
}
.dash-footnote code { background: #fff; }
.fn-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin: 0 4px 0 10px; vertical-align: middle; }
.fn-label { margin-left: 16px; font-style: italic; }

/* Funnel dashboard */
.dash-funnel-body { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; padding: 24px 28px; }
.dash-funnel-chart svg { width: 100%; height: auto; }
.dash-funnel-table { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.dfrow {
  display: grid;
  grid-template-columns: 26px 1fr 90px 50px 70px;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--color-cream);
  border-radius: 6px;
  font-size: 13px;
}
.dfrow-idx { font-family: var(--font-mono); font-size: 10px; color: var(--color-light-muted); letter-spacing: 0.1em; }
.dfrow-name { font-family: var(--font-body); font-weight: 500; color: var(--color-ink); }
.dfrow-count, .dfrow-pct { font-family: var(--font-mono); color: var(--color-ink); text-align: right; }
.dfrow-delta {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  text-align: center;
  white-space: nowrap;
  justify-self: start;
}
.dfrow-delta.up { background: rgba(42,122,74,.12); color: #1a4f30; }
.dfrow-delta.down { background: rgba(196,75,43,.12); color: #9e3a1e; }
.dfrow-delta.neutral { background: var(--color-border-light); color: var(--color-light-muted); }
.dfrow-note { grid-column: 1 / -1; font-family: var(--font-body); font-style: italic; font-size: 12px; color: var(--color-light-muted); padding-left: 34px; }

/* Install funnel */
.install-rows { display: flex; flex-direction: column; gap: 14px; padding: 24px 28px; }
.irow-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 6px; flex-wrap: wrap; }
.irow-name { font-family: var(--font-body); font-size: 15px; font-weight: 500; color: var(--color-ink); }
.irow-count { font-family: var(--font-mono); font-size: 14px; font-weight: 600; color: var(--color-ink); }
.irow-pct { font-family: var(--font-mono); font-size: 11px; color: var(--color-light-muted); letter-spacing: 0.08em; text-transform: uppercase; }
.irow-drop { font-family: var(--font-mono); font-size: 11px; color: var(--color-rust); background: rgba(196,75,43,.1); padding: 2px 8px; border-radius: 999px; margin-left: auto; }
.irow-track { height: 12px; background: var(--color-cream); border-radius: 999px; overflow: hidden; }
.irow-bar { height: 100%; background: linear-gradient(90deg, #2563a8, #1a4f8a); border-radius: 999px; transition: width .8s ease; }
.irow-note { font-family: var(--font-body); font-style: italic; font-size: 12px; color: var(--color-muted); margin-top: 6px; }

/* Lead gen */
.dash-kpis { display: flex; gap: 12px; }
.kpi { background: var(--color-cream); border: 1px solid var(--color-border-light); border-radius: 8px; padding: 10px 16px; min-width: 90px; }
.kpi-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--color-light-muted); margin-bottom: 4px; }
.kpi-value { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--color-ink); line-height: 1; }
.kpi-highlight { background: linear-gradient(135deg, #1a2332, #2a3a4e); border-color: transparent; }
.kpi-highlight .kpi-label { color: rgba(245,240,232,.7); }
.kpi-highlight .kpi-value { color: #fff; }
.lead-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; padding: 24px 28px; }
.lead-funnel { display: flex; flex-direction: column; gap: 12px; }
.lstage {
  padding: 16px 20px;
  border-radius: 8px;
  background: linear-gradient(90deg, #2563a8, #1a4f8a);
  color: #fff;
  width: calc(var(--w) * 1%);
  min-width: 170px;
  transition: width .8s ease;
}
.lstage.is-mid { background: linear-gradient(90deg, #1a4f8a, #0f3d70); }
.lstage.is-small { background: linear-gradient(90deg, #2a7a4a, #1a4f30); min-width: 140px; }
.lstage-name { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; opacity: .75; }
.lstage-value { font-family: var(--font-display); font-size: 28px; font-weight: 700; margin: 4px 0; }
.lstage-rate { font-family: var(--font-mono); font-size: 11px; opacity: .8; }
.lstage-gap { text-align: center; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--color-rust); margin: 2px 0; }
.lstage-gap span { background: rgba(196,75,43,.1); padding: 3px 10px; border-radius: 999px; }
.lead-cycle { background: var(--color-cream); padding: 18px; border-radius: 8px; }
.cycle-title { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 12px; }
.cycle-plot { display: flex; align-items: flex-end; gap: 6px; height: 120px; }
.cycle-bar { flex: 1; background: #2563a8; border-radius: 3px 3px 0 0; height: calc(var(--h) * 1%); transition: height .8s ease; }
.cycle-bar.is-peak { background: #c44b2b; }
.cycle-axis { display: flex; gap: 6px; font-family: var(--font-mono); font-size: 10px; color: var(--color-light-muted); margin-top: 6px; }
.cycle-axis span { flex: 1; text-align: center; }
.cycle-axis span.is-peak { color: var(--color-rust); font-weight: 600; }
.cycle-call { font-family: var(--font-body); font-size: 13px; line-height: 1.55; color: var(--color-ink); margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--color-border-light); }

/* Campaign performance dashboard */
.dash-campaign-head { display: flex; justify-content: space-between; align-items: center; padding: 22px 28px; border-bottom: 1px solid var(--color-border-light); gap: 24px; }
.perf-score { display: flex; flex-direction: column; align-items: center; }
.perf-score svg { width: 80px; height: 80px; }
.perf-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-light-muted); margin-top: 4px; }
.dash-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; padding: 20px 28px; }
.kpic { background: var(--color-cream); border: 1px solid var(--color-border-light); border-radius: 8px; padding: 14px 16px; position: relative; overflow: hidden; }
.kpic-label { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-light-muted); }
.kpic-value { font-family: var(--font-display); font-size: 28px; font-weight: 700; color: var(--color-ink); line-height: 1.1; margin: 4px 0; }
.kpic-trend { font-family: var(--font-mono); font-size: 11px; font-weight: 500; }
.kpic-trend.up { color: #1a4f30; }
.kpic-trend.down { color: #9e3a1e; }
.kpic-trend .tri { margin-right: 3px; }
.kpic-spark { width: 100%; height: 30px; margin-top: 6px; display: block; }
.kpic-highlight { background: linear-gradient(135deg, #1a2332, #2a3a4e); border-color: transparent; }
.kpic-highlight .kpic-label { color: rgba(255,255,255,.7); }
.kpic-highlight .kpic-value { color: #fff; }
.kpic-highlight .kpic-trend.up { color: #7fd1a0; }
.dash-signal-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; padding: 0 28px 22px; }
.signal { padding: 14px 16px; border-radius: 8px; border-left: 3px solid; background: var(--color-cream); }
.signal.good { border-color: #2a7a4a; }
.signal.warn { border-color: #c8915a; background: #fef8ed; }
.signal.bad { border-color: #c44b2b; background: #fef0ec; }
.signal-head { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
.signal.good .signal-head { color: #2a7a4a; }
.signal.warn .signal-head { color: #a87434; }
.signal.bad .signal-head { color: #9e3a1e; }
.signal-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.signal-body { font-family: var(--font-body); font-size: 13.5px; line-height: 1.55; color: var(--color-ink); }

/* ROAS windows */
.roas-grid { padding: 24px 28px; display: flex; flex-direction: column; gap: 10px; }
.roas-bar {
  height: 48px;
  background: linear-gradient(90deg, #2563a8, #1a4f8a);
  border-radius: 4px;
  width: calc(var(--w) * 1%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  color: #fff;
  transition: width 1s ease;
}
.roas-bar .roas-label { font-family: var(--font-body); font-size: 14px; font-weight: 500; }
.roas-bar .roas-value { font-family: var(--font-mono); font-size: 13px; font-weight: 600; }
.roas-bar:nth-child(4) { background: linear-gradient(90deg, #2a7a4a, #1a4f30); }
.roas-bar .roas-value.is-hero { font-size: 14px; }
.roas-note { padding: 14px 28px; background: var(--color-cream); border-top: 1px solid var(--color-border-light); font-family: var(--font-body); font-size: 13.5px; line-height: 1.6; color: var(--color-ink); }

/* Growth accounting */
.growth-grid { padding: 24px 28px; display: grid; grid-template-columns: 1.5fr 1fr; gap: 32px; }
.growth-chart svg { width: 100%; height: 320px; background: var(--color-cream); border-radius: 6px; }
.growth-axis { display: flex; justify-content: space-around; margin-top: 8px; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; color: var(--color-light-muted); text-transform: uppercase; }
.growth-legend { display: flex; flex-direction: column; gap: 8px; }
.gl-row { display: grid; grid-template-columns: 16px 90px 1fr; gap: 10px; align-items: center; padding: 8px 10px; background: var(--color-cream); border-radius: 6px; }
.gl-chip { width: 14px; height: 14px; border-radius: 3px; }
.gl-row.is-new .gl-chip { background: #2a7a4a; }
.gl-row.is-res .gl-chip { background: #a8c8e8; }
.gl-row.is-ret .gl-chip { background: #2563a8; }
.gl-row.is-chu .gl-chip { background: #c44b2b; }
.gl-name { font-family: var(--font-body); font-weight: 600; font-size: 13px; color: var(--color-ink); }
.gl-desc { font-family: var(--font-body); font-size: 12px; color: var(--color-muted); }
.growth-insights { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 8px; }
.gi { background: var(--color-cream); border-radius: 8px; padding: 14px 16px; }
.gi-head { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-light-muted); margin-bottom: 4px; }
.gi-val { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--color-ink); line-height: 1.1; }
.gi-val.is-good { color: #2a7a4a; }
.gi-val.is-bad { color: #9e3a1e; }
.gi-sub { font-family: var(--font-body); font-size: 12px; color: var(--color-muted); margin-top: 2px; }

/* Money left on table — waterfall */
.waste-waterfall { padding: 24px 28px; display: flex; flex-direction: column; gap: 10px; }
.wrow { display: grid; grid-template-columns: 280px 1fr 110px; gap: 14px; align-items: center; }
.wrow-label { font-family: var(--font-body); font-size: 13.5px; color: var(--color-ink); }
.wrow-bar { height: 28px; background: var(--color-cream); border-radius: 3px; overflow: hidden; position: relative; }
.wbar { height: 100%; border-radius: 3px; transition: width .8s ease; }
.wbar.is-total { background: linear-gradient(90deg, #1a2332, #2a3a4e); }
.wbar.is-loss { background: linear-gradient(90deg, #c44b2b, #9e3a1e); }
.wbar.is-kept { background: linear-gradient(90deg, #2a7a4a, #1a4f30); }
.wbar { width: calc(var(--w) * 1%); }
.wrow-value { font-family: var(--font-mono); font-size: 13px; font-weight: 600; text-align: right; color: var(--color-ink); }
.wrow-drop .wrow-value { color: #9e3a1e; }
.wrow-total.is-effective .wrow-value { color: #1a4f30; }
.wrow-why { grid-column: 1 / -1; font-family: var(--font-body); font-size: 12px; color: var(--color-light-muted); padding-left: 14px; border-left: 2px solid var(--color-border-light); margin-left: 4px; margin-top: -2px; }
.wrow-total { padding: 8px 0; border-top: 1px dashed var(--color-border); margin-top: 6px; }
.wrow-total:first-child { border-top: none; margin-top: 0; }
.wrow-total .wrow-label { font-family: var(--font-display); font-weight: 600; font-size: 16px; }
.wrow-total .wrow-value { font-size: 16px; }
.waste-recap { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; padding: 0 28px 24px; }
.recap-card { padding: 16px 18px; border-radius: 8px; }
.recap-card.recap-bad { background: linear-gradient(135deg, #c44b2b, #9e3a1e); color: #fff; }
.recap-card.recap-good { background: linear-gradient(135deg, #2a7a4a, #1a4f30); color: #fff; }
.recap-card.recap-warn { background: linear-gradient(135deg, #c8915a, #a87434); color: #fff; }
.recap-label { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; opacity: .8; margin-bottom: 4px; }
.recap-value { font-family: var(--font-display); font-size: 26px; font-weight: 700; }
.recap-sub { font-family: var(--font-mono); font-size: 11px; opacity: .85; margin-top: 2px; }

/* Improvement priority matrix */
.improve-matrix-wrap { padding: 24px 28px; display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
.improve-matrix { position: relative; padding: 30px 0 30px 30px; background: var(--color-cream); border-radius: 10px; }
.axis-y { position: absolute; top: 8px; bottom: 22px; left: 8px; width: 16px; display: flex; flex-direction: column; justify-content: space-between; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-light-muted); writing-mode: vertical-rl; transform: rotate(180deg); text-align: center; }
.axis-x { position: absolute; bottom: 6px; left: 30px; right: 8px; display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-light-muted); }
.matrix-grid { position: relative; height: 360px; border-left: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); }
.matrix-grid::before, .matrix-grid::after { content: ''; position: absolute; background: var(--color-border); }
.matrix-grid::before { left: 50%; top: 0; bottom: 0; width: 1px; }
.matrix-grid::after { left: 0; right: 0; top: 50%; height: 1px; }
.q { position: absolute; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--color-light-muted); padding: 8px; opacity: .55; }
.q-do-now { top: 0; left: 0; }
.q-schedule { top: 0; right: 0; text-align: right; }
.q-quick { bottom: 0; left: 0; }
.q-defer { bottom: 0; right: 0; text-align: right; }
.bubble { position: absolute; width: calc(var(--s) * 1px); height: calc(var(--s) * 1px); border-radius: 50%; left: var(--x); top: var(--y); transform: translate(-50%, -50%); background: radial-gradient(circle at 30% 30%, #2563a8, #1a4f8a); border: 2px solid #fff; box-shadow: 0 4px 14px rgba(37,99,168,.35); cursor: pointer; transition: transform .2s; display: flex; align-items: center; justify-content: center; }
.bubble:hover, .bubble.is-active { transform: translate(-50%, -50%) scale(1.08); }
.bubble.b1 { background: radial-gradient(circle at 30% 30%, #2a7a4a, #1a4f30); box-shadow: 0 4px 14px rgba(42,122,74,.4); }
.bubble.b2 { background: radial-gradient(circle at 30% 30%, #2a7a4a, #1a4f30); box-shadow: 0 4px 14px rgba(42,122,74,.4); }
.bubble.b3 { background: radial-gradient(circle at 30% 30%, #2563a8, #1a4f8a); }
.bubble.b4 { background: radial-gradient(circle at 30% 30%, #c8915a, #a87434); box-shadow: 0 4px 14px rgba(200,145,90,.4); }
.bubble.b5 { background: radial-gradient(circle at 30% 30%, #c8915a, #a87434); box-shadow: 0 4px 14px rgba(200,145,90,.4); }
.bubble.b6 { background: radial-gradient(circle at 30% 30%, #c44b2b, #9e3a1e); box-shadow: 0 4px 14px rgba(196,75,43,.4); }
.b-tip { position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); background: #1a2332; color: #fff; padding: 4px 10px; border-radius: 4px; font-family: var(--font-mono); font-size: 10px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity .2s; }
.bubble:hover .b-tip, .bubble.is-active .b-tip { opacity: 1; }
.improve-detail { background: #fff; border: 1px solid var(--color-border-light); border-radius: 10px; padding: 18px; }
.id-head { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 8px; }
.id-head strong { color: var(--color-ink); font-weight: 700; }
.id-body { font-family: var(--font-body); font-size: 13.5px; line-height: 1.6; color: var(--color-ink); }
.improve-total { padding: 14px 28px; background: linear-gradient(135deg, #1a2332, #2a3a4e); color: #fff; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
.improve-total strong { font-family: var(--font-display); font-size: 18px; }
.improve-caveat { font-family: var(--font-mono); font-size: 10px; opacity: .7; letter-spacing: 0.1em; text-transform: uppercase; }

@media (max-width: 820px) {
  .dash-head { flex-direction: column; }
  .dash-funnel-body, .lead-grid, .growth-grid, .improve-matrix-wrap { grid-template-columns: 1fr; }
  .dfrow { grid-template-columns: 26px 1fr 70px 40px; }
  .dfrow-delta { display: none; }
  .wrow { grid-template-columns: 1fr 2fr 80px; gap: 10px; }
  .waste-recap, .dash-signal-grid { grid-template-columns: 1fr; }
  .dash-campaign-head { flex-direction: column; align-items: flex-start; }
  .lead-funnel .lstage { width: auto !important; }
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


/* ═══ CUSTOM HAND-CRAFTED DIAGRAMS (pure HTML, no SVG) ═══ */

/* Swimlane (Ads Value Chain) */
.viz-swimlane { padding: 22px 24px; }
.sw-grid {
  display: grid;
  grid-template-columns: 28px 1fr 1fr 1fr;
  gap: 10px;
  align-items: stretch;
}
.sw-head {
  grid-row: 1;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #fff;
  padding: 8px 12px;
  border-radius: 6px;
  text-align: center;
}
.sw-head-adv { background: linear-gradient(135deg, #2563a8, #1a4f8a); }
.sw-head-plat { background: linear-gradient(135deg, #1a2332, #2a3a4e); }
.sw-head-user { background: linear-gradient(135deg, #2a7a4a, #1a4f30); }
.sw-head:first-of-type { grid-column: 2; }
.sw-head:nth-of-type(2) { grid-column: 3; }
.sw-head:nth-of-type(3) { grid-column: 4; }
.sw-num {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-gold-dark);
  background: var(--color-cream);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  justify-self: center;
  border: 1px solid var(--color-border);
}
.sw-box {
  border-radius: 6px;
  padding: 10px 14px;
  font-family: var(--font-body);
  font-size: 13.5px;
  color: var(--color-ink);
  line-height: 1.4;
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  min-height: 38px;
}
.sw-box-adv { background: rgba(37,99,168,.08); border-color: rgba(37,99,168,.25); }
.sw-box-plat { background: rgba(26,35,50,.08); border-color: rgba(26,35,50,.22); }
.sw-box-user { background: rgba(42,122,74,.10); border-color: rgba(42,122,74,.28); }
.sw-spacer {
  background: repeating-linear-gradient(90deg, transparent 0, transparent 8px, var(--color-border-light) 8px, var(--color-border-light) 9px);
  height: 1px;
  align-self: center;
  min-height: 1px;
  border-radius: 0;
}
.sw-legend {
  margin-top: 14px;
  font-family: var(--font-body);
  font-size: 12.5px;
  font-style: italic;
  color: var(--color-muted);
  line-height: 1.55;
}

/* Box chain (Campaign hierarchy) */
.viz-boxchain { padding: 22px 24px; }
.bc-row { display: flex; align-items: stretch; gap: 0; flex-wrap: wrap; }
.bc-box {
  flex: 1 1 160px;
  min-width: 150px;
  background: linear-gradient(135deg, #1a2332, #2a3a4e);
  color: #fff;
  border-radius: 10px;
  padding: 18px 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 4px 10px rgba(26,35,50,.08);
}
.bc-box-title { font-family: var(--font-display); font-size: 20px; font-weight: 700; }
.bc-box-desc { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; opacity: .8; }
.bc-rel {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  gap: 4px;
}
.bc-rel-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-gold-dark);
  background: var(--color-cream);
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
}
.bc-rel-arrow { font-family: var(--font-mono); font-size: 22px; color: var(--color-gold-dark); font-weight: 600; }

/* Stack (Medallion architecture) */
.viz-stack { padding: 22px 24px; }
.st-flow { display: flex; flex-direction: column; align-items: stretch; gap: 0; }
.st-box {
  border-radius: 8px;
  padding: 14px 18px;
  border: 1px solid var(--color-border);
  background: #fff;
}
.st-box-title { font-family: var(--font-display); font-size: 16px; font-weight: 700; color: var(--color-ink); margin-bottom: 4px; }
.st-box-meta { font-family: var(--font-mono); font-size: 11.5px; color: var(--color-muted); line-height: 1.55; }
.st-arrow { font-family: var(--font-mono); font-size: 22px; color: var(--color-gold-dark); text-align: center; padding: 4px 0; font-weight: 700; }
.st-tier-source { background: linear-gradient(135deg, #1a2332, #2a3a4e); color: #fff; border-color: transparent; }
.st-tier-source .st-box-title { color: #fff; }
.st-tier-source .st-box-meta { color: rgba(255,255,255,.75); }
.st-tier-spine { background: rgba(37,99,168,.10); border-color: rgba(37,99,168,.25); }
.st-tier-bronze { background: linear-gradient(135deg, #b7792a, #8c5a1f); color: #fff; border-color: transparent; }
.st-tier-bronze .st-box-title, .st-tier-bronze .st-box-meta { color: #fff; }
.st-tier-bronze .st-box-meta { color: rgba(255,255,255,.85); }
.st-tier-silver { background: linear-gradient(135deg, #5a6b82, #3a4556); color: #fff; border-color: transparent; }
.st-tier-silver .st-box-title, .st-tier-silver .st-box-meta { color: #fff; }
.st-tier-silver .st-box-meta { color: rgba(255,255,255,.85); }
.st-tier-gold { background: linear-gradient(135deg, #c8915a, #a87434); color: #fff; border-color: transparent; }
.st-tier-gold .st-box-title, .st-tier-gold .st-box-meta { color: #fff; }
.st-tier-gold .st-box-meta { color: rgba(255,255,255,.85); }
.st-tier-serving { background: linear-gradient(135deg, #2a7a4a, #1a4f30); color: #fff; border-color: transparent; }
.st-tier-serving .st-box-title { color: #fff; }
.st-consumer-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; margin-top: 10px; }
.st-consumer {
  background: rgba(255,255,255,.15);
  border: 1px solid rgba(255,255,255,.25);
  border-radius: 4px;
  padding: 6px 10px;
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: #fff;
}
.st-branches { display: flex; flex-direction: column; gap: 6px; padding: 6px 0 6px 20px; margin-left: 14px; border-left: 2px dashed var(--color-border); }
.st-branch { display: flex; align-items: center; gap: 8px; }
.st-arrow-side { font-size: 16px; color: var(--color-gold-dark); padding: 0; }
.st-side-box {
  flex: 1;
  background: var(--color-cream);
  border: 1px solid var(--color-border-light);
  border-radius: 6px;
  padding: 10px 14px;
}
.st-side-title { font-family: var(--font-body); font-size: 14px; font-weight: 600; color: var(--color-ink); margin-bottom: 2px; }
.st-side-meta { font-family: var(--font-mono); font-size: 11px; color: var(--color-muted); }

/* Fanout (metric registry) */
.viz-fanout { padding: 22px 24px; }
.fo-head {
  background: linear-gradient(135deg, #1a2332, #2a3a4e);
  color: #fff;
  border-radius: 10px;
  padding: 16px 20px;
  max-width: 640px;
  margin: 0 auto;
}
.fo-head-title {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--color-gold-light);
  margin-bottom: 8px;
}
.fo-head-code {
  background: rgba(0,0,0,.25);
  color: #e8e0d6;
  margin: 0;
  padding: 12px 14px;
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.55;
  white-space: pre;
  overflow-x: auto;
}
.fo-fan {
  text-align: center;
  font-family: var(--font-mono);
  font-size: 22px;
  color: var(--color-gold-dark);
  font-weight: 700;
  padding: 10px 0;
  letter-spacing: 2em;
}
.fo-pipes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin: 0 auto;
  max-width: 720px;
}
.fo-pipe {
  background: #fff;
  border: 1px solid var(--color-border);
  border-top: 4px solid var(--color-gold);
  border-radius: 8px;
  padding: 14px;
  text-align: center;
}
.fo-pipe-batch { border-top-color: #2563a8; }
.fo-pipe-stream { border-top-color: #c44b2b; }
.fo-pipe-adhoc { border-top-color: #2a7a4a; }
.fo-pipe-title { font-family: var(--font-display); font-size: 17px; font-weight: 700; color: var(--color-ink); }
.fo-pipe-tech { font-family: var(--font-mono); font-size: 11px; color: var(--color-muted); letter-spacing: 0.1em; margin-top: 2px; }
.fo-pipe-sep { height: 1px; background: var(--color-border-light); margin: 10px 0; }
.fo-pipe-out { font-family: var(--font-body); font-size: 13px; color: var(--color-ink); font-style: italic; }
.fo-audience {
  text-align: center;
  padding: 14px 22px;
  background: linear-gradient(135deg, #2a7a4a, #1a4f30);
  color: #fff;
  border-radius: 999px;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  max-width: 400px;
  margin: 0 auto;
}

/* Tradeoff triangle (pure HTML, absolute positioning + CSS lines) */
.viz-tritri { padding: 22px 24px; }
.tt-wrap {
  position: relative;
  max-width: 560px;
  margin: 0 auto;
  aspect-ratio: 1.15 / 1;
}
.tt-edges { position: absolute; inset: 0; pointer-events: none; }
.tt-edge { position: absolute; background: var(--color-border); display: block; }
.tt-edge-top-left { top: 18%; left: 22%; width: 2px; height: 58%; transform: rotate(60deg); transform-origin: top left; background: linear-gradient(to bottom, #2563a8, #2a7a4a); }
.tt-edge-top-right { top: 18%; right: 22%; width: 2px; height: 58%; transform: rotate(-60deg); transform-origin: top right; background: linear-gradient(to bottom, #2563a8, #c44b2b); }
.tt-edge-bottom { bottom: 24%; left: 14%; right: 14%; height: 2px; background: linear-gradient(to right, #2a7a4a, #c44b2b); }
.tt-vertex {
  position: absolute;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 12px 14px;
  width: 180px;
  max-width: 45%;
  text-align: center;
  box-shadow: 0 4px 14px rgba(26,35,50,.08);
  z-index: 1;
}
.tt-top { top: 0; left: 50%; transform: translateX(-50%); border-top: 4px solid #2563a8; }
.tt-left { bottom: 0; left: 0; border-top: 4px solid #2a7a4a; }
.tt-right { bottom: 0; right: 0; border-top: 4px solid #c44b2b; }
.tt-axis {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  color: var(--color-ink);
  margin-bottom: 6px;
}
.tt-notes { list-style: none; margin: 0; padding: 0; font-family: var(--font-mono); font-size: 11px; color: var(--color-muted); line-height: 1.55; }
.tt-notes li { padding: 1px 0; }
.tt-caption {
  text-align: center;
  margin-top: 18px;
  font-family: var(--font-body);
  font-size: 14px;
  font-style: italic;
  color: var(--color-muted);
}

/* Mobile — stack everything vertically */
@media (max-width: 820px) {
  .viz-swimlane, .viz-boxchain, .viz-stack, .viz-fanout, .viz-tritri { padding: 14px 14px; }

  /* Swimlane — compact columns */
  .sw-grid { grid-template-columns: 22px 1fr 1fr 1fr; gap: 4px; }
  .sw-head { font-size: 8.5px; padding: 4px 6px; letter-spacing: 0.1em; }
  .sw-num { width: 20px; height: 20px; font-size: 10px; }
  .sw-box { font-size: 11.5px; padding: 6px 8px; min-height: 28px; }

  /* Box chain — stack vertically */
  .bc-row { flex-direction: column; gap: 0; }
  .bc-box { flex: 1 1 100%; min-width: 0; padding: 14px 16px; }
  .bc-box-title { font-size: 17px; }
  .bc-rel { flex-direction: row; width: 100%; padding: 8px 0; gap: 8px; }
  .bc-rel-arrow { transform: rotate(90deg); font-size: 20px; }

  /* Stack (medallion) — shrink boxes */
  .st-box { padding: 10px 14px; }
  .st-box-title { font-size: 14px; }
  .st-box-meta { font-size: 11px; }
  .st-arrow { font-size: 18px; padding: 2px 0; }
  .st-branches { padding: 4px 0 4px 10px; margin-left: 8px; }
  .st-consumer-grid { grid-template-columns: 1fr; gap: 4px; }
  .st-consumer { font-size: 11px; }

  /* Fanout — stack pipes */
  .fo-head { padding: 12px 14px; }
  .fo-head-code { font-size: 11px; padding: 10px; }
  .fo-pipes { grid-template-columns: 1fr; gap: 10px; }
  .fo-pipe { padding: 10px 12px; }
  .fo-pipe-title { font-size: 15px; }
  .fo-fan { font-size: 18px; letter-spacing: 1.6em; padding: 6px 0; }
  .fo-audience { font-size: 14px; padding: 10px 16px; }

  /* Triangle — stack vertices vertically */
  .tt-wrap { aspect-ratio: auto; height: auto; display: flex; flex-direction: column; gap: 16px; max-width: 100%; }
  .tt-edges { display: none; }
  .tt-vertex { position: static; transform: none; width: 100%; max-width: 100%; }
  .tt-caption { font-size: 13px; margin-top: 14px; }
}

@media (max-width: 560px) {
  .sw-grid { grid-template-columns: 1fr; gap: 6px; }
  .sw-head { grid-column: auto !important; }
  .sw-num { display: none; }
  .sw-box { min-height: 0; }
  .sw-spacer { display: none; }
}


/* ═══ SWIMLANE v2 — flex rows (bulletproof) ═══ */
.viz-swimlane { padding: 20px 22px; }
.sw-headers { display: flex; gap: 10px; margin-bottom: 10px; }
.sw-num-col { flex: 0 0 32px; }
.sw-lane-head { flex: 1 1 0; padding: 10px 12px; border-radius: 6px; text-align: center; font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.16em; text-transform: uppercase; color: #fff; }
.sw-lane-adv { background: linear-gradient(135deg, #2563a8, #1a4f8a); }
.sw-lane-plat { background: linear-gradient(135deg, #1a2332, #2a3a4e); }
.sw-lane-user { background: linear-gradient(135deg, #2a7a4a, #1a4f30); }
.sw-row { display: flex; gap: 10px; align-items: stretch; margin-bottom: 8px; }
.sw-num {
  flex: 0 0 32px;
  height: auto;
  min-height: 44px;
  background: var(--color-cream);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--color-gold-dark);
}
.sw-cell { flex: 1 1 0; display: flex; align-items: stretch; }
.sw-cell .sw-box {
  width: 100%;
  border-radius: 6px;
  padding: 10px 14px;
  font-family: var(--font-body);
  font-size: 13.5px;
  color: var(--color-ink);
  display: flex;
  align-items: center;
  min-height: 44px;
  border: 1px solid transparent;
  line-height: 1.4;
}
.sw-cell.sw-adv .sw-box { background: rgba(37,99,168,.08); border-color: rgba(37,99,168,.28); }
.sw-cell.sw-plat .sw-box { background: rgba(26,35,50,.06); border-color: rgba(26,35,50,.22); }
.sw-cell.sw-user .sw-box { background: rgba(42,122,74,.10); border-color: rgba(42,122,74,.30); }
.sw-dash {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-border);
  font-size: 20px;
  min-height: 44px;
}
.sw-legend { margin-top: 14px; font-family: var(--font-body); font-size: 12.5px; font-style: italic; color: var(--color-muted); line-height: 1.55; }

/* ═══ Pipeline architecture (Part 1) ═══ */
.viz-pipeline-arch { padding: 22px 24px; }
.pa-top { display: flex; flex-direction: column; align-items: center; gap: 0; }
.pa-box { border-radius: 8px; padding: 12px 16px; text-align: center; width: 100%; max-width: 420px; }
.pa-box-title { font-family: var(--font-display); font-size: 16px; font-weight: 700; color: var(--color-ink); margin-bottom: 2px; }
.pa-box-meta { font-family: var(--font-mono); font-size: 11px; color: var(--color-muted); line-height: 1.5; }
.pa-arrow { font-family: var(--font-mono); font-size: 20px; color: var(--color-gold-dark); text-align: center; padding: 6px 0; font-weight: 700; }
.pa-arrow-sm { font-size: 16px; padding: 4px 0; font-weight: 500; color: var(--color-muted); }
.pa-box-src { background: #fff; border: 1px solid var(--color-border); }
.pa-box-spine { background: linear-gradient(135deg, #1a2332, #2a3a4e); color: #fff; }
.pa-box-spine .pa-box-title { color: #fff; }
.pa-box-spine .pa-box-meta { color: rgba(255,255,255,.8); }
.pa-fan-arrows { text-align: center; font-family: var(--font-mono); font-size: 18px; color: var(--color-gold-dark); padding: 6px 0; letter-spacing: 1.2em; }
.pa-four { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; align-items: stretch; }
.pa-col { display: flex; flex-direction: column; align-items: stretch; gap: 0; }
.pa-box-bronze { background: linear-gradient(135deg, #b7792a, #8c5a1f); color: #fff; }
.pa-box-silver { background: linear-gradient(135deg, #5a6b82, #3a4556); color: #fff; }
.pa-box-gold { background: linear-gradient(135deg, #c8915a, #a87434); color: #fff; }
.pa-box-stream { background: rgba(196,75,43,.10); border: 1px solid rgba(196,75,43,.30); }
.pa-box-olap { background: rgba(37,99,168,.10); border: 1px solid rgba(37,99,168,.30); }
.pa-box-kv { background: rgba(42,122,74,.10); border: 1px solid rgba(42,122,74,.30); }
.pa-box-bronze .pa-box-title, .pa-box-silver .pa-box-title, .pa-box-gold .pa-box-title { color: #fff; }
.pa-box-bronze .pa-box-meta, .pa-box-silver .pa-box-meta, .pa-box-gold .pa-box-meta { color: rgba(255,255,255,.85); }
.pa-stub { display: none; }
.pa-terminal {
  background: var(--color-cream);
  border: 1px dashed var(--color-border);
  border-radius: 999px;
  padding: 6px 14px;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--color-ink);
}
.pa-fanout-head { text-align: center; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-gold-dark); margin: 16px 0 8px; }
.pa-terminal-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
.pa-term-blue { background: rgba(37,99,168,.10); border-color: rgba(37,99,168,.35); }
.pa-term-green { background: rgba(42,122,74,.10); border-color: rgba(42,122,74,.35); }
.pa-term-rust { background: rgba(196,75,43,.10); border-color: rgba(196,75,43,.35); }

/* ═══ Aggregation tree v2 (Part 1) ═══ */
.viz-tree-v2 { padding: 22px 24px; }
.tv2-root { display: flex; flex-direction: column; gap: 10px; }
.tv2-node { background: #fff; border: 1px solid var(--color-border); border-radius: 8px; padding: 12px 16px; }
.tv2-node-root { background: linear-gradient(135deg, #1a2332, #2a3a4e); color: #fff; border-color: transparent; }
.tv2-node-root .tv2-name { color: #fff; font-weight: 600; }
.tv2-name { font-family: var(--font-display); font-size: 16px; font-weight: 600; color: var(--color-ink); }
.tv2-meta { font-family: var(--font-mono); font-size: 11.5px; color: var(--color-muted); margin-top: 3px; }
.tv2-branches { display: flex; flex-direction: column; gap: 14px; padding-left: 22px; border-left: 2px dashed var(--color-border); margin-left: 14px; }
.tv2-branch { display: flex; flex-direction: column; gap: 6px; }
.tv2-edge { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; color: var(--color-gold-dark); text-transform: uppercase; }
.tv2-node-stream { background: rgba(196,75,43,.08); border-color: rgba(196,75,43,.28); }
.tv2-node-batch { background: rgba(37,99,168,.08); border-color: rgba(37,99,168,.28); }
.tv2-subedge { font-family: var(--font-mono); font-size: 11px; color: var(--color-muted); padding-left: 16px; }
.tv2-leaves { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 6px; padding-left: 16px; }
.tv2-leaf {
  background: var(--color-cream);
  border: 1px solid var(--color-border-light);
  border-left: 3px solid var(--color-gold);
  border-radius: 4px;
  padding: 8px 12px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  color: var(--color-ink);
}
.tv2-leaf-exec { border-left-color: #c44b2b; background: rgba(196,75,43,.06); }

/* ═══ Pacing dual-write (Part 2) ═══ */
.viz-pacing { padding: 22px 24px; }
.pc-stack { display: flex; flex-direction: column; align-items: stretch; gap: 0; max-width: 640px; margin: 0 auto; }
.pc-src { text-align: center; padding: 6px 0; }
.pc-src-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--color-gold-dark); background: var(--color-cream); padding: 4px 12px; border: 1px solid var(--color-border); border-radius: 999px; }
.pc-src-arrow { display: block; margin-top: 6px; font-size: 18px; color: var(--color-gold-dark); }
.pc-box { border-radius: 10px; padding: 14px 18px; border: 1px solid var(--color-border); }
.pc-box-realtime { background: linear-gradient(135deg, #2563a8, #1a4f8a); color: #fff; border-color: transparent; }
.pc-box-batch { background: linear-gradient(135deg, #1a4f30, #0d3520); color: #fff; border-color: transparent; }
.pc-box-title { font-family: var(--font-display); font-size: 17px; font-weight: 700; margin-bottom: 4px; }
.pc-box-meta { font-family: var(--font-mono); font-size: 12.5px; margin-top: 2px; opacity: .9; }
.pc-box-meta.pc-mono { font-weight: 600; }
.pc-box-read { font-family: var(--font-body); font-size: 13px; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.2); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.pc-arrow-in { font-family: var(--font-mono); font-weight: 700; color: var(--color-gold-light); }
.pc-latency { opacity: .75; font-family: var(--font-mono); font-size: 11.5px; margin-left: auto; }
.pc-between { text-align: center; padding: 14px 0; position: relative; }
.pc-between-arrow { display: block; font-family: var(--font-mono); font-size: 24px; color: var(--color-gold-dark); font-weight: 700; }
.pc-between-label { display: inline-block; margin-top: 6px; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--color-gold-dark); background: var(--color-cream); padding: 3px 10px; border-radius: 999px; border: 1px solid var(--color-border); }

/* Mobile */
@media (max-width: 820px) {
  .sw-headers { gap: 4px; }
  .sw-num-col { flex: 0 0 26px; }
  .sw-lane-head { font-size: 9px; padding: 6px 4px; letter-spacing: 0.08em; }
  .sw-row { gap: 4px; margin-bottom: 4px; }
  .sw-num { flex: 0 0 26px; min-height: 34px; font-size: 11px; }
  .sw-cell .sw-box { padding: 6px 8px; font-size: 11.5px; min-height: 34px; }
  .sw-dash { min-height: 34px; font-size: 14px; }

  .viz-pipeline-arch { padding: 14px 14px; }
  .pa-four { grid-template-columns: 1fr; gap: 8px; }
  .pa-col { border-top: 1px dashed var(--color-border); padding-top: 8px; }
  .pa-col:first-child { border-top: none; padding-top: 0; }
  .pa-fan-arrows { display: none; }
  .pa-box { max-width: 100%; padding: 10px 12px; }
  .pa-terminal-grid { grid-template-columns: 1fr 1fr; }

  .viz-tree-v2 { padding: 14px 14px; }
  .tv2-branches { padding-left: 14px; margin-left: 8px; }
  .tv2-leaves { grid-template-columns: 1fr; }

  .viz-pacing { padding: 14px 14px; }
  .pc-box { padding: 12px 14px; }
  .pc-box-title { font-size: 15px; }
  .pc-latency { margin-left: 0; width: 100%; }
}

@media (max-width: 560px) {
  .sw-headers, .sw-row { flex-direction: column; gap: 4px; }
  .sw-num-col, .sw-num { flex: 0 0 auto; min-height: 0; }
  .sw-num::before { content: 'STEP '; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.12em; color: var(--color-light-muted); margin-right: 4px; }
  .sw-cell { width: 100%; }
  .sw-lane-head { text-align: left; }
  .sw-dash { display: none; }
  .sw-cell.sw-adv .sw-box, .sw-cell.sw-plat .sw-box, .sw-cell.sw-user .sw-box { width: 100%; }
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
.hf-bar:hover { transform: scale(1.01); }
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
.qn-btn:hover { background: var(--color-gold-dark); transform: translateY(-2px); }
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
  <h1>Ads Data Engineering Interview Prep</h1>
  <p class="subtitle">A senior / L5 handbook for the rounds that actually decide an ads DE loop — auctions, attribution, identity &amp; consent, ads-specific SQL, platform-level stacks, measurement &amp; visualization, plus ten full mock interview scenarios.</p>
  <div class="article-meta">
    <span>By Paddy</span><span class="dot"></span>
    <span>April 22, 2026</span><span class="dot"></span>
    <span>75 min read</span>
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
// Reading progress bar
window.addEventListener('scroll',function(){var b=document.getElementById('readingProgress');if(b)b.style.width=(window.scrollY/(document.documentElement.scrollHeight-window.innerHeight))*100+'%';});

// Scroll-spy: highlight the active chip
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
    out = ads_dashboards.inject(out)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(out, encoding="utf-8")
    print(f"wrote {OUT} ({len(out):,} bytes)")


if __name__ == "__main__":
    main()
