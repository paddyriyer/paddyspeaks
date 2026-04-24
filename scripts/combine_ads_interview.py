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
import css_minify
import ads_dashboards
import custom_diagrams

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "interview" / "ads engineering"
OUT = ROOT / "articles" / "ads-data-engineering-interview-prep.html"

PARTS = [
    ("X0", "Primer_Ads_101.html",                       "Primer · Ads 101",                     "primer"),
    ("X1", "Five_Rooms.html",                           "Five Rooms · By Company",              "rooms"),
    ("X2", "Question_Bank.html",                        "Question Bank · soft → hard",          "bank"),
    ("IX", "00_Master_Index.html",                      "The Brief · 00:00 · problem drops",    "overview"),
    ("00", "Part0_Introduction_to_Ads_Engineering.html", "Round 0 + 1 · 0–5 min · Drop + Clarify", "incident"),
    ("01", "Part1_Mock_Interview_Scenarios_Practice.html","Round 1 · 5–15 min · Clarify or Fail",  "revenue"),
    ("02", "Part2_Ads_Growth_Behavioral.html",          "Round 2 · 15–30 min · Design",         "architecture"),
    ("03", "Part3_Deep_Dive_SQL.html",                  "Round 3 · 30–40 min · Defend",         "defense"),
    ("04", "Part4_Platform_Specific_Glossary.html",     "Round 5 · 50–55 min · System Breaks",  "break"),
    ("05", "Part5_Visualization_Measurement.html",      "Round 6 · 55–60 min · Recovery",       "recovery"),
    ("06", "Part6_Room_Pressure_Decisions.html",        "Round 7 · final minute · Signal",      "lesson"),
    ("07", "Part7_Coding_Round.html",                   "Round 4 · Appendix · Deep Dive · SQL", "appendix"),
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
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap"></noscript>
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
.part-section { scroll-margin-top: 120px; margin-top: 80px; padding-top: 8px; content-visibility: auto; contain-intrinsic-size: 0 1800px; }
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


/* ═══ THE ARC — narrative components (Acts, Storm, Choice, Sidebars) ═══ */
/* Prompt card (the interviewer's prompt) */
.part-section .prompt-card { background: linear-gradient(135deg, #1a2332 0%, #2a3a4e 100%); color: #fff; border-radius: 12px; padding: 20px 24px; margin: 20px 0 24px; box-shadow: 0 6px 20px rgba(26,35,50,.15); }
.part-section .prompt-label { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--color-gold-light); margin-bottom: 10px; }
.part-section .prompt-body { margin: 0; padding: 0; border: none; font-family: var(--font-display); font-size: 19px; font-weight: 500; line-height: 1.5; color: #fff; }
.part-section .prompt-body p { color: #fff; margin: 0; }
.part-section .prompt-cue { margin: 10px 0 0; font-family: var(--font-mono); font-size: 12px; color: var(--color-gold-light); opacity: .9; font-style: italic; }

/* Gap visual — the incident at a glance */
.part-section .gap-card { background: #fff; border: 1px solid var(--color-border); border-radius: 12px; padding: 24px; margin: 22px 0; box-shadow: 0 2px 10px rgba(26,35,50,.05); }
.part-section .gap-label { text-align: center; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 14px; }
.part-section .gap-compare { display: grid; grid-template-columns: 1fr auto 1fr; gap: 18px; align-items: center; }
.part-section .gap-side { text-align: center; padding: 14px 12px; border-radius: 8px; }
.part-section .gap-side.gap-dash { background: rgba(196,75,43,.08); border: 1px solid rgba(196,75,43,.25); }
.part-section .gap-side.gap-fin  { background: rgba(42,122,74,.08); border: 1px solid rgba(42,122,74,.25); }
.part-section .gap-source { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-light-muted); margin-bottom: 6px; }
.part-section .gap-num { font-family: var(--font-display); font-size: 36px; font-weight: 700; color: var(--color-ink); line-height: 1; }
.part-section .gap-defn { font-family: var(--font-body); font-size: 13px; color: var(--color-muted); margin-top: 4px; font-style: italic; }
.part-section .gap-vs { font-family: var(--font-mono); font-size: 14px; font-weight: 600; color: var(--color-rust); text-align: center; }
.part-section .gap-vs-delta { display: block; font-size: 22px; color: var(--color-rust); font-family: var(--font-display); font-weight: 700; margin-top: 4px; }
.part-section .gap-tag { margin-top: 12px; text-align: center; font-family: var(--font-body); font-style: italic; color: var(--color-muted); font-size: 14px; }

/* Waterfall (per-category gap decomposition) */
.part-section .waterfall { background: #fff; border: 1px solid var(--color-border); border-radius: 10px; padding: 22px 24px; margin: 22px 0; }
.part-section .wf-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 14px; }
.part-section .wf-rows { display: flex; flex-direction: column; gap: 8px; }
.part-section .wf-row { display: grid; grid-template-columns: 190px 1fr 110px; gap: 14px; align-items: center; font-family: var(--font-body); font-size: 14px; }
.part-section .wf-name { color: var(--color-ink); }
.part-section .wf-bar { height: 28px; background: var(--color-cream); border-radius: 4px; position: relative; overflow: hidden; }
.part-section .wf-fill { position: absolute; top: 0; bottom: 0; border-radius: 4px; transition: width .9s cubic-bezier(.2,.8,.2,1); }
.part-section .wf-row.wf-base .wf-fill { background: linear-gradient(90deg, #2563a8, #1a4f8a); }
.part-section .wf-row.wf-add  .wf-fill { background: linear-gradient(90deg, #c8915a, #a87434); }
.part-section .wf-row.wf-total .wf-fill { background: linear-gradient(90deg, #2a7a4a, #1a4f30); }
.part-section .wf-value { font-family: var(--font-mono); font-size: 14px; font-weight: 600; text-align: right; color: var(--color-ink); }
.part-section .wf-row.wf-add .wf-value { color: #a87434; }
.part-section .wf-row.wf-total .wf-value { color: #1a4f30; font-weight: 700; }
.part-section .wf-note { grid-column: 1 / -1; font-family: var(--font-mono); font-size: 11.5px; color: var(--color-light-muted); margin-top: -4px; padding-left: 8px; }
.part-section .wf-foot { margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--color-border); font-family: var(--font-body); font-size: 13.5px; font-style: italic; color: var(--color-muted); }

/* Inline SQL block (not hidden) */
.part-section .inline-sql { background: #0f1e2e; color: #e8e0d6; padding: 16px 20px; border-radius: 8px; overflow-x: auto; margin: 18px 0; font-family: var(--font-mono); font-size: 13px; line-height: 1.65; border-left: 3px solid var(--color-gold); }
.part-section .inline-sql code { background: transparent; color: inherit; padding: 0; border: none; white-space: pre; font-family: var(--font-mono); }
.part-section .inline-sql-cap { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--color-gold-dark); margin: 14px 0 4px; }

@media (max-width: 700px) {
  .part-section .gap-compare { grid-template-columns: 1fr; gap: 10px; }
  .part-section .gap-vs { padding: 6px 0; }
  .part-section .gap-num { font-size: 28px; }
  .part-section .wf-row { grid-template-columns: 130px 1fr 70px; gap: 8px; font-size: 12.5px; }
  .part-section .wf-name { font-size: 13px; }
  .part-section .inline-sql { font-size: 11.5px; padding: 12px 14px; }
}

.part-section .act-eyebrow { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 10px; }
.part-section .act-title { font-family: var(--font-display); font-size: clamp(28px, 4.8vw, 48px); font-weight: 700; color: var(--color-ink); line-height: 1.08; margin: 0 0 18px; }
.part-section .act-subtitle { font-family: var(--font-body); font-size: 19px; line-height: 1.7; color: var(--color-muted); font-style: italic; margin-bottom: 24px; }
.part-section .scene-bridge { background: rgba(200,145,90,.08); border-left: 3px solid var(--color-gold); padding: 12px 16px; margin: 8px 0 18px; border-radius: 0 6px 6px 0; font-family: var(--font-body); font-size: 14.5px; line-height: 1.6; color: var(--color-ink); font-style: italic; }
.part-section .scene-bridge em { font-style: normal; color: var(--color-rust); }

/* Parallel rooms — what the other four interviewers would ask at this act */
.part-section .parallel { background: #fff; border: 1px solid var(--color-border); border-top: 5px solid var(--color-gold); border-radius: 12px; padding: 22px 24px; margin: 32px 0; box-shadow: 0 4px 14px rgba(26,35,50,.05); }
.part-section .parallel-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--color-gold-dark); text-align: center; margin-bottom: 10px; }
.part-section .parallel-intro { font-family: var(--font-body); font-size: 14.5px; line-height: 1.65; color: var(--color-muted); font-style: italic; text-align: center; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px dashed var(--color-border); }
.part-section .parallel-intro em { color: var(--color-ink); font-weight: 600; font-style: normal; }
.part-section .parallel-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.part-section .prow { background: var(--color-cream); border: 1px solid var(--color-border); border-left: 4px solid var(--color-gold); border-radius: 0 8px 8px 0; padding: 14px 16px; }
.part-section .prow-meta   { border-left-color: #4267B2; }
.part-section .prow-google { border-left-color: #4285F4; }
.part-section .prow-amazon { border-left-color: #FF9900; }
.part-section .prow-apple  { border-left-color: #555555; }
.part-section .prow .pco { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 10px; font-weight: 600; }
.part-section .prow-meta   .pco { color: #4267B2; }
.part-section .prow-google .pco { color: #4285F4; }
.part-section .prow-amazon .pco { color: #a66000; }
.part-section .prow-apple  .pco { color: #444; }
.part-section .prow blockquote { margin: 0; padding: 0; border: none; background: none; font-family: var(--font-display); font-size: 15px; line-height: 1.55; color: var(--color-ink); font-style: normal; font-weight: 500; }
.part-section .prow blockquote strong { color: var(--color-rust); }
.part-section .prow blockquote em { color: var(--color-muted); font-style: italic; font-weight: 400; }
.part-section .parallel-foot { margin-top: 18px; padding-top: 14px; border-top: 1px dashed var(--color-border); font-family: var(--font-body); font-size: 14px; line-height: 1.6; color: var(--color-ink); }
.part-section .parallel-foot strong { color: var(--color-rust); }
.part-section .parallel-foot em { color: var(--color-muted); font-style: italic; }
@media (max-width: 800px) {
  .part-section .parallel-grid { grid-template-columns: 1fr; }
}

/* Question Bank — 13 tiers from soft to hard */
.part-section .tier { background: #fff; border: 1px solid var(--color-border); border-left: 5px solid var(--color-gold); border-radius: 10px; padding: 18px 22px; margin: 16px 0; box-shadow: 0 2px 10px rgba(26,35,50,.05); }
.part-section .tier-soft         { border-left-color: #4a9f6a; }
.part-section .tier-vocab        { border-left-color: #6ba8c4; }
.part-section .tier-attribution  { border-left-color: #c8915a; }
.part-section .tier-ctv          { border-left-color: #E50914; }
.part-section .tier-identity     { border-left-color: #c8915a; }
.part-section .tier-mechanism    { border-left-color: #a87434; }
.part-section .tier-scenario     { border-left-color: #c44b2b; }
.part-section .tier-debug        { border-left-color: #c44b2b; background: rgba(196,75,43,.04); }
.part-section .tier-pipeline     { border-left-color: #5a3a8a; }
.part-section .tier-exec         { border-left-color: #1a4f8a; background: rgba(26,79,138,.04); }
.part-section .tier-amazon       { border-left-color: #FF9900; }
.part-section .tier-meta         { border-left-color: #4267B2; }
.part-section .tier-edge         { border-left-color: #5a1f1f; }
.part-section .tier-head { display: grid; grid-template-columns: 56px 1fr; grid-template-rows: auto auto; gap: 4px 14px; padding-bottom: 10px; border-bottom: 1px dashed var(--color-border); margin-bottom: 12px; align-items: baseline; }
.part-section .tier-num { grid-row: 1 / -1; font-family: var(--font-display); font-size: 36px; font-weight: 700; color: var(--color-ink); line-height: 1; background: var(--color-cream); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.part-section .tier-soft        .tier-num { color: #1a4f30; }
.part-section .tier-vocab       .tier-num { color: #1a4f8a; }
.part-section .tier-attribution .tier-num { color: #a87434; }
.part-section .tier-ctv         .tier-num { color: #b10710; }
.part-section .tier-identity    .tier-num { color: #a87434; }
.part-section .tier-mechanism   .tier-num { color: #a87434; }
.part-section .tier-scenario    .tier-num { color: var(--color-rust); }
.part-section .tier-debug       .tier-num { color: var(--color-rust); }
.part-section .tier-pipeline    .tier-num { color: #5a3a8a; }
.part-section .tier-exec        .tier-num { color: #1a4f8a; }
.part-section .tier-amazon      .tier-num { color: #a66000; }
.part-section .tier-meta        .tier-num { color: #4267B2; }
.part-section .tier-edge        .tier-num { color: #5a1f1f; }
.part-section .tier-title { font-family: var(--font-display); font-size: 20px; font-weight: 700; color: var(--color-ink); line-height: 1.2; }
.part-section .tier-meta:not(.tier) { display: contents; }
.part-section .tier .tier-meta { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.06em; color: var(--color-light-muted); }
.part-section .tier-qs { list-style: none; padding: 0; margin: 0 0 12px; }
.part-section .tier-qs li { font-family: var(--font-display); font-size: 16px; line-height: 1.55; color: var(--color-ink); padding: 10px 0 10px 30px; border-top: 1px dashed var(--color-border-light); position: relative; font-weight: 500; }
.part-section .tier-qs li:first-child { border-top: none; padding-top: 4px; }
.part-section .tier-qs li::before { content: "—"; position: absolute; left: 8px; top: 10px; color: var(--color-gold-dark); font-family: var(--font-mono); font-weight: 600; }
.part-section .tier-qs li:first-child::before { top: 4px; }
.part-section .tier-tip { font-family: var(--font-body); font-size: 13.5px; line-height: 1.6; color: var(--color-ink); padding: 10px 14px; background: var(--color-cream); border-radius: 6px; }
.part-section .tier-tip em { color: var(--color-rust); font-style: italic; font-weight: 600; }
.part-section .tier-tip code { font-size: 12px; }

.part-section .bank-close { background: linear-gradient(135deg, #1a2332 0%, #2a3a4e 100%); color: #fff; border-radius: 12px; padding: 24px 26px; margin: 28px 0 12px; }
.part-section .bank-close-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--color-gold-light); margin-bottom: 14px; }
.part-section .bank-close-body p { font-family: var(--font-body); font-size: 15.5px; line-height: 1.7; color: #e8e0d6; margin: 0 0 12px; }
.part-section .bank-close-body strong { color: #fff; }
.part-section .bank-close-body em { color: var(--color-gold-light); font-style: italic; }
.part-section .bank-close-final { font-family: var(--font-mono) !important; font-size: 13.5px !important; color: var(--color-gold-light) !important; padding-top: 12px; border-top: 1px dashed rgba(232,224,214,.3); margin-top: 4px !important; }

@media (max-width: 700px) {
  .part-section .tier-head { grid-template-columns: 44px 1fr; }
  .part-section .tier-num { font-size: 26px; }
  .part-section .tier-title { font-size: 17px; }
  .part-section .tier-qs li { font-size: 14.5px; }
}

/* Warm-up ramp — soft blows before the hard one */
.part-section .warmup { background: #fff; border: 1px solid var(--color-border); border-radius: 12px; padding: 22px 24px; margin: 22px 0; box-shadow: 0 4px 14px rgba(26,35,50,.05); }
.part-section .warmup-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 10px; text-align: center; }
.part-section .warmup-intro { font-family: var(--font-body); font-size: 15px; line-height: 1.7; color: var(--color-ink); margin-bottom: 16px; padding: 12px 16px; background: var(--color-cream); border-left: 3px solid var(--color-gold); border-radius: 0 6px 6px 0; }
.part-section .warmup-intro em { color: var(--color-rust); font-style: italic; font-weight: 600; }
.part-section .warmups { display: flex; flex-direction: column; gap: 10px; }
.part-section .warmup-q { background: #fff; border: 1px solid var(--color-border); border-left: 4px solid var(--color-gold); border-radius: 0 8px 8px 0; padding: 13px 16px; }
.part-section .wq-soft     { border-left-color: #9bc4a3; }
.part-section .wq-vocab    { border-left-color: #c8915a; }
.part-section .wq-basic    { border-left-color: #c44b2b; }
.part-section .wq-scenario { border-left-color: #5a1f1f; }
.part-section .wq-meta { display: flex; align-items: baseline; gap: 12px; margin-bottom: 8px; }
.part-section .wq-num { font-family: var(--font-mono); font-size: 11px; font-weight: 700; letter-spacing: 0.06em; padding: 3px 8px; background: var(--color-cream); border-radius: 4px; color: var(--color-ink); }
.part-section .wq-tier { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--color-light-muted); }
.part-section .wq-soft     .wq-tier { color: #1a4f30; }
.part-section .wq-vocab    .wq-tier { color: #a87434; }
.part-section .wq-basic    .wq-tier { color: var(--color-rust); }
.part-section .wq-scenario .wq-tier { color: #5a1f1f; }
.part-section .wq-ask { font-family: var(--font-display); font-size: 16px; line-height: 1.5; color: var(--color-ink); margin-bottom: 8px; }
.part-section .wq-ask strong { color: var(--color-rust); font-weight: 600; }
.part-section .wq-grade { font-family: var(--font-body); font-size: 14px; line-height: 1.6; color: var(--color-ink); padding-top: 6px; border-top: 1px dashed var(--color-border-light); }
.part-section .wq-grade strong { color: var(--color-gold-dark); }
.part-section .wq-grade em { color: var(--color-rust); font-style: italic; }
.part-section .wq-grade code { font-size: 12.5px; }
.part-section .warmup-foot { margin-top: 16px; padding: 12px 16px; background: linear-gradient(135deg, #2a3a4e 0%, #1a2332 100%); color: #fff; border-radius: 8px; font-family: var(--font-body); font-size: 14.5px; line-height: 1.6; text-align: center; }
.part-section .warmup-foot strong { color: var(--color-gold-light); }

/* Round 0 · The Drop — stark opening card */
.part-section .drop { background: linear-gradient(135deg, #0d1620 0%, #1a2332 100%); color: #fff; border-radius: 14px; padding: 28px 30px; margin: 24px 0; box-shadow: 0 10px 32px rgba(0,0,0,.25); border: 1px solid rgba(229,9,20,.4); }
.part-section .drop-timer { font-family: var(--font-mono); font-size: 11.5px; letter-spacing: 0.22em; text-transform: uppercase; color: #f5a9a9; margin-bottom: 18px; text-align: center; }
.part-section .drop-quote { font-family: var(--font-display); font-size: clamp(22px, 3.4vw, 32px); font-weight: 700; color: #fff; line-height: 1.25; text-align: center; margin: 0 0 10px; padding: 18px 12px; border-top: 1px solid rgba(255,255,255,.18); border-bottom: 1px solid rgba(255,255,255,.18); }
.part-section .drop-silence { text-align: center; font-family: var(--font-body); font-size: 14px; font-style: italic; color: #c8915a; margin: 0 0 18px; letter-spacing: 0.04em; }
.part-section .drop-body p { font-family: var(--font-body); font-size: 15.5px; line-height: 1.7; color: #e8e0d6; margin: 0 0 12px; }
.part-section .drop-body strong { color: #ffb5b5; }
.part-section .drop-score { margin-top: 18px; padding-top: 16px; border-top: 1px dashed rgba(255,255,255,.2); }
.part-section .dscore-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #c8915a; margin-bottom: 12px; text-align: center; }
.part-section .dscore-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.part-section .dscore-item { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12); border-radius: 8px; padding: 14px 16px; }
.part-section .dscore-fail { border-left: 3px solid #e25555; }
.part-section .dscore-pass { border-left: 3px solid #4a9f6a; }
.part-section .dsi-name { font-family: var(--font-display); font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 8px; }
.part-section .dscore-fail .dsi-name { color: #ffb5b5; }
.part-section .dscore-pass .dsi-name { color: #b5e8c5; }
.part-section .dsi-body { font-family: var(--font-body); font-size: 14px; line-height: 1.55; color: #e8e0d6; }
.part-section .dsi-body em { color: #c8915a; font-style: italic; }
.part-section .drop-foot { margin-top: 16px; padding-top: 14px; border-top: 1px dashed rgba(255,255,255,.18); font-family: var(--font-body); font-size: 14px; line-height: 1.6; color: #e8e0d6; text-align: center; }
.part-section .drop-foot strong { color: var(--color-gold-light); }
@media (max-width: 700px) { .part-section .dscore-grid { grid-template-columns: 1fr; } }

/* Candidate Mistake — most-fail-here red callout */
.part-section .mistake-cue { background: rgba(196,75,43,.06); border: 1px solid rgba(196,75,43,.32); border-left: 4px solid var(--color-rust); border-radius: 0 8px 8px 0; padding: 14px 18px; margin: 14px 0 18px; }
.part-section .mcue-tag { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--color-rust); margin-bottom: 6px; font-weight: 600; }
.part-section .mcue-body { font-family: var(--font-body); font-size: 14.5px; line-height: 1.65; color: var(--color-ink); }
.part-section .mcue-body strong { color: var(--color-rust); font-weight: 600; }
.part-section .mcue-body em { color: var(--color-ink); font-style: italic; font-weight: 600; }

/* Decision Fork — branching consequences */
.part-section .fork { background: #fff; border: 1px solid var(--color-border); border-radius: 12px; padding: 20px 22px; margin: 22px 0; box-shadow: 0 4px 14px rgba(26,35,50,.06); }
.part-section .fork-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 8px; text-align: center; }
.part-section .fork-prompt { font-family: var(--font-body); font-size: 15px; line-height: 1.6; color: var(--color-ink); font-style: italic; margin-bottom: 14px; text-align: center; }
.part-section .fork-branches { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.part-section .fork-branch { border: 1px solid var(--color-border); border-radius: 8px; padding: 14px 16px; background: var(--color-cream); }
.part-section .fork-stream { border-left: 4px solid var(--color-rust); }
.part-section .fork-batch  { border-left: 4px solid var(--color-sage); }
.part-section .fb-head { font-family: var(--font-display); font-size: 17px; font-weight: 700; color: var(--color-ink); margin-bottom: 10px; line-height: 1.25; }
.part-section .fork-stream .fb-head { color: var(--color-rust); }
.part-section .fork-batch  .fb-head { color: #1a4f30; }
.part-section .fb-break, .part-section .fb-when { font-family: var(--font-body); font-size: 14px; line-height: 1.6; color: var(--color-ink); margin: 0 0 8px; }
.part-section .fb-break strong { color: var(--color-rust); }
.part-section .fb-when strong  { color: #1a4f30; }
.part-section .fb-when em { color: var(--color-muted); font-style: italic; }
.part-section .fork-foot { margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--color-border); font-family: var(--font-body); font-size: 14px; line-height: 1.6; color: var(--color-ink); }
.part-section .fork-foot strong { color: var(--color-rust); }
@media (max-width: 700px) { .part-section .fork-branches { grid-template-columns: 1fr; } }

/* Skip-cost red band — makes skipping an act feel costly */
.part-section .skip-cost { background: linear-gradient(135deg, rgba(196,75,43,.12) 0%, rgba(196,75,43,.06) 100%); border: 1px solid rgba(196,75,43,.35); border-left: 4px solid var(--color-rust); border-radius: 0 8px 8px 0; padding: 12px 16px; margin: 4px 0 14px; font-family: var(--font-body); font-size: 14.5px; line-height: 1.55; color: var(--color-ink); }
.part-section .skip-cost strong { color: var(--color-rust); font-weight: 600; }

/* Running Incident spine — in The Brief */
.part-section .incident-spine { background: linear-gradient(135deg, #3a1a1a 0%, #5a1f1f 100%); color: #fff; border-radius: 12px; padding: 22px 26px; margin: 28px 0 20px; border-left: 5px solid #e25555; box-shadow: 0 6px 22px rgba(92,30,30,.22); }
.part-section .incident-head { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px dashed rgba(245,169,169,.35); padding-bottom: 10px; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
.part-section .incident-tag { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: #f5a9a9; }
.part-section .incident-clock { font-family: var(--font-mono); font-size: 12px; color: #f5a9a9; letter-spacing: 0.08em; }
.part-section .incident-core { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
.part-section .incident-num { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: #fff; }
.part-section .incident-num strong { color: #ffb5b5; }
.part-section .incident-detail { font-family: var(--font-body); font-size: 14px; color: #f5e4e4; }
.part-section .incident-detail strong { color: #fff; }
.part-section .incident-track { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin: 10px 0; padding: 10px 0; border-top: 1px dashed rgba(245,169,169,.35); border-bottom: 1px dashed rgba(245,169,169,.35); }
.part-section .incident-step { display: flex; flex-direction: column; align-items: center; padding: 6px 4px; background: rgba(0,0,0,.15); border-radius: 6px; text-align: center; }
.part-section .incident-step-live { background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.35); }
.part-section .istep-clock { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.08em; color: #f5a9a9; margin-bottom: 2px; }
.part-section .incident-step-live .istep-clock { color: #fff; font-weight: 600; }
.part-section .istep-what { font-family: var(--font-mono); font-size: 10.5px; color: #f5e4e4; line-height: 1.3; }
.part-section .incident-spine-foot { font-family: var(--font-body); font-size: 14px; line-height: 1.55; color: #f5e4e4; margin-top: 10px; }
.part-section .incident-spine-foot strong { color: #ffb5b5; }
@media (max-width: 700px) {
  .part-section .incident-track { grid-template-columns: repeat(2, 1fr); }
  .part-section .incident-step-live { grid-column: 1 / -1; }
}

/* Freeze Moment — the brutal 30-minute decision card */
.part-section .freeze { background: #fff; border: 2px solid var(--color-rust); border-radius: 12px; margin: 24px 0; overflow: hidden; box-shadow: 0 6px 22px rgba(196,75,43,.15); }
.part-section .freeze-bar { background: var(--color-rust); color: #fff; padding: 10px 18px; font-family: var(--font-mono); font-size: 12px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; text-align: center; }
.part-section .freeze-body { padding: 22px 24px; }
.part-section .freeze-head { font-family: var(--font-display); font-size: 24px; font-weight: 700; color: var(--color-ink); line-height: 1.2; margin: 0 0 14px; }
.part-section .freeze-line { font-family: var(--font-body); font-size: 16px; line-height: 1.65; color: var(--color-ink); margin: 0 0 14px; }
.part-section .freeze-choices { display: flex; flex-direction: column; gap: 8px; margin: 14px 0; }
.part-section .freeze-choice { background: var(--color-cream); border: 1px solid var(--color-border); border-left: 3px solid var(--color-rust); border-radius: 0 6px 6px 0; padding: 10px 14px; display: grid; grid-template-columns: 90px 1fr; gap: 10px; align-items: baseline; font-family: var(--font-body); font-size: 14px; line-height: 1.55; }
.part-section .fchoice-k { font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--color-rust); letter-spacing: 0.06em; }
.part-section .fchoice-v { color: var(--color-ink); }
.part-section .fchoice-cost { grid-column: 2 / -1; margin-top: 4px; font-family: var(--font-mono); font-size: 11.5px; color: var(--color-muted); font-style: italic; }
.part-section .commit-line strong, .part-section .freeze-line strong { color: var(--color-rust); font-weight: 600; }
.part-section .freeze-commit { margin: 12px 0 0 !important; padding: 10px 14px; background: var(--color-rust); color: #fff !important; border-radius: 6px; font-family: var(--font-body); font-size: 14.5px !important; font-weight: 500; text-align: center; }
.part-section .freeze-commit strong { color: #fff !important; text-decoration: underline; }

/* Commit-Now — Act 1 "before A/B/C" gate */
.part-section .commit-now { background: #fff; border: 2px dashed var(--color-rust); border-radius: 12px; margin: 18px 0 24px; overflow: hidden; }
.part-section .commit-bar { background: var(--color-rust); color: #fff; padding: 10px 16px; font-family: var(--font-mono); font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; text-align: center; }
.part-section .commit-body { padding: 20px 24px; }
.part-section .commit-line { font-family: var(--font-body); font-size: 16px; line-height: 1.6; color: var(--color-ink); margin: 0 0 10px; }
.part-section .commit-sub { font-family: var(--font-body); font-size: 14.5px; line-height: 1.55; color: var(--color-muted); font-style: italic; margin: 0 0 14px; }
.part-section .commit-timer { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: var(--color-cream); border-radius: 6px; margin-bottom: 12px; }
.part-section .ctimer-dot { width: 14px; height: 14px; border-radius: 50%; background: var(--color-rust); opacity: 0.35; }
.part-section .ctimer-dot.ctimer-1 { opacity: 1; }
.part-section .ctimer-dot.ctimer-2 { opacity: 0.85; }
.part-section .ctimer-dot.ctimer-3 { opacity: 0.65; }
.part-section .ctimer-dot.ctimer-4 { opacity: 0.45; }
.part-section .ctimer-dot.ctimer-5 { opacity: 0.25; }
.part-section .ctimer-label { font-family: var(--font-mono); font-size: 11.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--color-rust); margin-left: auto; }
.part-section .commit-foot { font-family: var(--font-body); font-size: 14px; line-height: 1.6; color: var(--color-ink); margin: 0; padding-top: 12px; border-top: 1px dashed var(--color-border); }

/* Truth break + loop close — the final beats */
.part-section .truth-break { text-align: center; margin: 48px auto 28px; padding: 38px 28px; border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); max-width: 780px; }
.part-section .truth-line { font-family: var(--font-display); font-size: 22px; color: var(--color-ink); line-height: 1.35; font-weight: 500; margin: 4px 0; }
.part-section .truth-line-big { font-size: 30px; font-weight: 700; color: var(--color-rust); }
@media (max-width: 700px) {
  .part-section .truth-line { font-size: 18px; }
  .part-section .truth-line-big { font-size: 22px; }
}
.part-section .loop-close { margin: 28px 0 16px; text-align: center; padding: 22px; border: 1px dashed var(--color-gold); border-radius: 10px; background: var(--color-cream); }
.part-section .loop-close-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 14px; }
.part-section .loop-close-body p { font-family: var(--font-display); font-size: 20px; line-height: 1.5; color: var(--color-ink); margin: 0 0 10px; }
.part-section .loop-close-body em { color: var(--color-rust); font-style: normal; font-weight: 600; }
.part-section .loop-close-final { font-size: 24px !important; color: var(--color-rust) !important; font-weight: 700; margin-top: 14px !important; padding-top: 14px; border-top: 1px dashed var(--color-border); }
.part-section .act-breath { margin-top: 28px; font-style: italic; color: var(--color-muted); }
.part-section .act-note { background: var(--color-cream); border-left: 3px solid var(--color-gold); padding: 18px 22px; margin: 22px 0; border-radius: 0 8px 8px 0; }
.part-section .act-note p { font-size: 16px; line-height: 1.75; margin-bottom: 12px; }
.part-section .act-note p:last-child { margin-bottom: 0; }
.part-section .act-reply { background: rgba(42,122,74,.08); border-left: 3px solid var(--color-sage); padding: 14px 18px; margin: 16px 0 22px; border-radius: 0 6px 6px 0; font-family: var(--font-body); font-size: 15px; line-height: 1.6; }

/* Storm (Slack simulation) */
.part-section .storm { background: #fff; border: 1px solid var(--color-border); border-radius: 10px; padding: 18px 22px; margin: 22px 0 26px; box-shadow: 0 2px 10px rgba(26,35,50,.05); }
.part-section .storm-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-light-muted); margin-bottom: 14px; }
.part-section .storm-msg { margin: 10px 0; padding: 10px 14px; border-radius: 6px; border-left: 3px solid; background: var(--color-cream); }
.part-section .storm-msg .storm-who { font-family: var(--font-mono); font-size: 11px; font-weight: 600; letter-spacing: 0.08em; margin-bottom: 4px; color: var(--color-ink); }
.part-section .storm-msg .storm-body { font-family: var(--font-body); font-size: 15px; line-height: 1.55; color: var(--color-ink); }
.part-section .storm-msg.storm-cfo { border-left-color: #c44b2b; }
.part-section .storm-msg.storm-cmo { border-left-color: #c8915a; }
.part-section .storm-msg.storm-partner { border-left-color: #2a7a4a; }
.part-section .storm-msg.storm-dir { border-left-color: #2563a8; background: rgba(37,99,168,.06); }
.part-section .storm-you { margin: 12px 0 2px; padding: 10px 14px; border-top: 1px dashed var(--color-border); font-family: var(--font-body); font-size: 15px; color: var(--color-muted); }
.part-section .storm-you .storm-who { font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--color-ink); margin-bottom: 4px; }

/* Choice cards (click-to-reveal) */
.part-section .choice { background: #fff; border: 1px solid var(--color-border); border-radius: 8px; margin: 10px 0; overflow: hidden; transition: border-color .2s; }
.part-section .choice[open] { border-color: var(--color-gold); }
.part-section .choice > summary { list-style: none; padding: 13px 16px; cursor: pointer; display: flex; align-items: center; gap: 14px; font-family: var(--font-body); font-size: 16px; color: var(--color-ink); }
.part-section .choice > summary::-webkit-details-marker { display: none; }
.part-section .choice > summary::after { content: '+'; margin-left: auto; font-family: var(--font-mono); color: var(--color-gold-dark); font-size: 20px; }
.part-section .choice[open] > summary::after { content: '−'; }
.part-section .choice-letter { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: var(--color-ink); color: var(--color-cream); font-family: var(--font-mono); font-weight: 700; font-size: 13px; border-radius: 50%; flex-shrink: 0; }
.part-section .choice-line { flex: 1; line-height: 1.4; }
.part-section .choice-body { padding: 0 16px 14px 58px; color: var(--color-muted); font-size: 15px; line-height: 1.7; border-top: 1px solid var(--color-border-light); padding-top: 12px; }
.part-section .choice-body p { margin-bottom: 10px; }

/* Sidebars */
.part-section .sidebar { margin: 26px 0; padding: 18px 22px; border-radius: 10px; border-left: 4px solid; }
.part-section .sidebar-label { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; margin-bottom: 8px; }
.part-section .sidebar-title { font-family: var(--font-display); font-size: 20px; font-weight: 600; color: var(--color-ink); margin: 0 0 12px; line-height: 1.3; }
.part-section .sidebar p, .part-section .sidebar li { font-family: var(--font-body); font-size: 15px; line-height: 1.7; color: var(--color-ink); }
.part-section .sidebar-punch { margin-top: 12px; font-style: italic; color: var(--color-muted); font-size: 15px; }
.part-section .sidebar-room { background: rgba(37,99,168,.05); border-left-color: #2563a8; }
.part-section .sidebar-room .sidebar-label { color: #1a4f8a; }
.part-section .sidebar-landmine { background: rgba(196,75,43,.05); border-left-color: #c44b2b; }
.part-section .sidebar-landmine .sidebar-label { color: #9e3a1e; }
.part-section .sidebar-turn { background: rgba(200,145,90,.06); border-left-color: #c8915a; }
.part-section .sidebar-turn .sidebar-label { color: #a87434; }

/* Four-revenue definition cards (Act 2) */
.part-section .defs { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 22px 0; }
.part-section .def { background: #fff; border: 1px solid var(--color-border); border-left: 4px solid; border-radius: 8px; padding: 15px 17px; }
.part-section .def-billed { border-left-color: #2563a8; }
.part-section .def-spend { border-left-color: #c8915a; }
.part-section .def-attr { border-left-color: #c44b2b; }
.part-section .def-settled { border-left-color: #2a7a4a; }
.part-section .def-name { font-family: var(--font-display); font-size: 18px; font-weight: 700; color: var(--color-ink); margin-bottom: 4px; }
.part-section .def-who { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; color: var(--color-gold-dark); margin-bottom: 8px; }
.part-section .def-what { font-family: var(--font-body); font-size: 14.5px; line-height: 1.65; color: var(--color-ink); margin-bottom: 8px; }
.part-section .def-when { font-family: var(--font-mono); font-size: 12px; color: var(--color-light-muted); }
@media (max-width: 700px) { .part-section .defs { grid-template-columns: 1fr; } }

/* Act 3 — 5-layer architecture stack */
.part-section .stack { display: flex; flex-direction: column; gap: 12px; margin: 26px 0; }
.part-section .stack-row { display: grid; grid-template-columns: 68px 1fr; gap: 16px; background: #fff; border: 1px solid var(--color-border); border-radius: 10px; padding: 16px 18px; box-shadow: 0 2px 8px rgba(26,35,50,.05); border-left: 5px solid; }
.part-section .stack-ingest   { border-left-color: #2563a8; }
.part-section .stack-conform  { border-left-color: #4a8fbf; }
.part-section .stack-metrics  { border-left-color: #c8915a; }
.part-section .stack-semantic { border-left-color: #c44b2b; }
.part-section .stack-consume  { border-left-color: #2a7a4a; }
.part-section .stack-num { font-family: var(--font-display); font-size: 36px; font-weight: 700; color: var(--color-ink); line-height: 1; display: flex; align-items: center; justify-content: center; background: var(--color-cream); border-radius: 8px; opacity: .55; }
.part-section .stack-body { display: flex; flex-direction: column; gap: 6px; }
.part-section .stack-name { font-family: var(--font-display); font-size: 20px; font-weight: 700; color: var(--color-ink); margin-bottom: 2px; }
.part-section .stack-what, .part-section .stack-because, .part-section .stack-rejected { font-family: var(--font-body); font-size: 14.5px; line-height: 1.6; margin: 0; }
.part-section .stack-because { color: #1a4f30; }
.part-section .stack-rejected { color: var(--color-muted); font-style: italic; }
@media (max-width: 700px) {
  .part-section .stack-row { grid-template-columns: 44px 1fr; gap: 10px; padding: 13px; }
  .part-section .stack-num { font-size: 26px; }
  .part-section .stack-name { font-size: 17px; }
  .part-section .stack-what, .part-section .stack-because, .part-section .stack-rejected { font-size: 13.5px; }
}

/* Act 3 — three contracts */
.part-section .contracts { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin: 22px 0; }
.part-section .contract { background: #fff; border: 1px solid var(--color-border); border-top: 4px solid var(--color-gold); border-radius: 8px; padding: 15px 17px; display: flex; flex-direction: column; gap: 8px; }
.part-section .contract-num { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-gold-dark); }
.part-section .contract-name { font-family: var(--font-display); font-size: 18px; font-weight: 700; color: var(--color-ink); }
.part-section .contract-body { font-family: var(--font-body); font-size: 14.5px; line-height: 1.6; color: var(--color-ink); }
.part-section .contract-fix { margin-top: auto; padding-top: 10px; border-top: 1px dashed var(--color-border); font-family: var(--font-body); font-size: 13.5px; font-style: italic; color: #1a4f30; }
@media (max-width: 900px) { .part-section .contracts { grid-template-columns: 1fr; } }

/* Act 4 — six-volley pushback grid */
.part-section .volley { background: #fff; border: 1px solid var(--color-border); border-radius: 10px; padding: 18px 22px; margin: 22px 0; box-shadow: 0 2px 8px rgba(26,35,50,.05); position: relative; display: grid; grid-template-columns: 68px 1fr; gap: 14px 18px; }
.part-section .volley-clock { font-family: var(--font-mono); font-size: 13px; font-weight: 600; color: var(--color-rust); background: rgba(196,75,43,.08); border-radius: 6px; padding: 6px 8px; text-align: center; align-self: start; }
.part-section .volley-head { grid-column: 2 / -1; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-gold-dark); }
.part-section .volley-raj { grid-column: 2 / -1; background: rgba(26,35,50,.04); border-left: 3px solid var(--color-ink); padding: 10px 14px; border-radius: 0 6px 6px 0; font-family: var(--font-body); font-size: 15px; line-height: 1.55; }
.part-section .volley-think { grid-column: 2 / -1; border: 1px dashed var(--color-border); border-radius: 6px; padding: 10px 14px; font-family: var(--font-body); font-size: 14px; line-height: 1.55; color: var(--color-muted); font-style: italic; }
.part-section .volley-label { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 4px; font-style: normal; }
.part-section .volley-you { grid-column: 2 / -1; background: rgba(42,122,74,.08); border-left: 3px solid var(--color-sage); padding: 10px 14px; border-radius: 0 6px 6px 0; font-family: var(--font-body); font-size: 15px; line-height: 1.6; }
.part-section .volley-score { grid-column: 2 / -1; font-family: var(--font-mono); font-size: 11.5px; letter-spacing: 0.05em; color: var(--color-sage); padding: 4px 0 0; border-top: 1px dashed var(--color-border); }
.part-section .volley-score-win::before { content: "✓ "; color: var(--color-sage); }
.part-section .volley-trap { border-color: rgba(196,75,43,.45); box-shadow: 0 2px 14px rgba(196,75,43,.08); }
.part-section .volley-trap .volley-head::after { content: " · watch your step"; color: var(--color-rust); font-style: italic; }
@media (max-width: 700px) {
  .part-section .volley { grid-template-columns: 52px 1fr; padding: 14px; gap: 10px 12px; }
  .part-section .volley-clock { font-size: 11px; padding: 4px 6px; }
  .part-section .volley-raj, .part-section .volley-you { font-size: 14px; }
}

/* Act 4 — tally scoreboard */
.part-section .tally { background: var(--color-cream); border: 1px solid var(--color-border); border-radius: 10px; padding: 20px 22px; margin: 26px 0; }
.part-section .tally-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 14px; }
.part-section .tally-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.part-section .tally-item { text-align: center; background: #fff; border: 1px solid var(--color-border); border-radius: 8px; padding: 12px 8px; }
.part-section .tally-num { font-family: var(--font-display); font-size: 30px; font-weight: 700; color: var(--color-ink); line-height: 1; }
.part-section .tally-name { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-light-muted); margin-top: 4px; }
.part-section .tally-foot { margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--color-border); font-family: var(--font-body); font-size: 14px; font-style: italic; color: var(--color-muted); line-height: 1.6; }
@media (max-width: 700px) { .part-section .tally-grid { grid-template-columns: repeat(2, 1fr); } }

/* Act 5 — PagerDuty alert card */
.part-section .page-alert { background: linear-gradient(135deg, #3a1a1a 0%, #5a1f1f 100%); color: #fff; border-radius: 10px; padding: 18px 22px; margin: 22px 0; border-left: 5px solid #e25555; font-family: var(--font-mono); box-shadow: 0 6px 20px rgba(92,30,30,.2); }
.part-section .page-label { font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase; color: #f5a9a9; margin-bottom: 10px; }
.part-section .page-from { font-size: 14.5px; line-height: 1.55; color: #fff; font-family: var(--font-mono); word-break: break-word; }
.part-section .page-meta { margin-top: 10px; padding-top: 10px; border-top: 1px dashed rgba(245,169,169,.3); font-size: 11px; color: #f5a9a9; letter-spacing: 0.08em; }

/* Act 5 — 30-min timer */
.part-section .timer { background: #fff; border: 1px solid var(--color-border); border-radius: 10px; padding: 20px 24px 52px; margin: 26px 0; }
.part-section .timer-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 24px; }
.part-section .timer-track { position: relative; height: 6px; background: var(--color-cream); border-radius: 3px; margin: 0 4%; }
.part-section .timer-fill { position: absolute; top: 0; left: 0; bottom: 0; background: linear-gradient(90deg, #2563a8, #c44b2b); border-radius: 3px; width: 83%; }
.part-section .timer-tick { position: absolute; top: -4px; transform: translateX(-50%); width: 14px; height: 14px; background: #fff; border: 2px solid var(--color-ink); border-radius: 50%; z-index: 2; }
.part-section .timer-tick-end { background: var(--color-sage); border-color: var(--color-sage); }
.part-section .timer-clock { position: absolute; top: -24px; left: 50%; transform: translateX(-50%); font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--color-ink); white-space: nowrap; }
.part-section .timer-note { position: absolute; top: 22px; left: 50%; transform: translateX(-50%) rotate(25deg); transform-origin: left top; font-family: var(--font-mono); font-size: 10.5px; color: var(--color-muted); white-space: nowrap; }
@media (max-width: 800px) {
  .part-section .timer { padding: 18px 16px 72px; }
  .part-section .timer-note { transform: translateX(-50%) rotate(35deg); font-size: 9.5px; }
  .part-section .timer-clock { font-size: 10px; }
}

/* Act 5 — four hypothesis cards */
.part-section .hypos { margin: 24px 0; display: flex; flex-direction: column; gap: 10px; }
.part-section .hypo-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 6px; }
.part-section .hypo { background: #fff; border: 1px solid var(--color-border); border-left: 4px solid var(--color-muted); border-radius: 8px; padding: 14px 18px; display: grid; grid-template-columns: 52px 1fr; grid-template-rows: auto auto auto; gap: 4px 14px; }
.part-section .hypo-num { grid-row: 1 / -1; font-family: var(--font-display); font-size: 26px; font-weight: 700; color: var(--color-muted); display: flex; align-items: center; justify-content: center; background: var(--color-cream); border-radius: 6px; }
.part-section .hypo-name { font-family: var(--font-display); font-size: 17px; font-weight: 700; color: var(--color-ink); }
.part-section .hypo-body { font-family: var(--font-body); font-size: 14.5px; line-height: 1.55; color: var(--color-ink); }
.part-section .hypo-check { font-family: var(--font-body); font-size: 13.5px; line-height: 1.55; color: var(--color-muted); font-style: italic; border-top: 1px dashed var(--color-border); padding-top: 8px; margin-top: 4px; }
.part-section .hypo:nth-child(5) { border-left-color: #c44b2b; } /* H3 — the hot one (4th hypo including label) */

/* Act 5 — diff table */
.part-section .diff-card { background: #fff; border: 1px solid var(--color-border); border-radius: 10px; padding: 20px 22px; margin: 22px 0; }
.part-section .diff-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 12px; }
.part-section .diff-table { width: 100%; border-collapse: collapse; font-family: var(--font-body); font-size: 14px; }
.part-section .diff-table th { background: var(--color-ink); color: #fff; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; padding: 10px 12px; text-align: left; font-weight: 500; }
.part-section .diff-table td { padding: 10px 12px; border-top: 1px solid var(--color-border); }
.part-section .diff-table tr.diff-hot { background: rgba(196,75,43,.08); }
.part-section .diff-table tr.diff-hot td { font-weight: 600; color: var(--color-rust); }
.part-section .diff-foot { margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--color-border); font-family: var(--font-body); font-size: 14px; font-style: italic; color: var(--color-muted); line-height: 1.6; }

/* Act 5 — the mistake you almost make */
.part-section .mistake { background: linear-gradient(135deg, #fff8ee 0%, #fef0d4 100%); border: 1px solid #e8c9a0; border-left: 5px solid #c8915a; border-radius: 10px; padding: 18px 22px; margin: 24px 0; }
.part-section .mistake-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: #a87434; margin-bottom: 8px; }
.part-section .mistake-head { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--color-ink); margin-bottom: 10px; }
.part-section .mistake-body { font-family: var(--font-body); font-size: 15px; line-height: 1.6; color: var(--color-ink); margin-bottom: 10px; }
.part-section .mistake-why { font-family: var(--font-body); font-size: 14.5px; line-height: 1.65; color: var(--color-ink); padding-top: 10px; border-top: 1px dashed #c8915a; }

/* Act 7 — side-by-side framings */
.part-section .frames { margin: 24px 0; }
.part-section .frames-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 14px; text-align: center; }
.part-section .frame { background: #fff; border: 1px solid var(--color-border); border-radius: 10px; padding: 18px 20px; }
.part-section .frame + .frame { margin-top: 14px; }
.part-section .frame-head { font-family: var(--font-display); font-size: 17px; font-weight: 700; color: var(--color-ink); margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px dashed var(--color-border); }
.part-section .frame ul { margin: 0 0 10px 20px; padding: 0; }
.part-section .frame li { font-family: var(--font-body); font-size: 14.5px; line-height: 1.55; margin-bottom: 4px; }
.part-section .frame-tag { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; color: var(--color-light-muted); margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--color-border); font-style: italic; }
.part-section .frame-wrong { border-left: 4px solid var(--color-rust); }
.part-section .frame-wrong .frame-head { color: var(--color-rust); }
.part-section .frame-right { border-left: 4px solid var(--color-sage); }
.part-section .frame-right .frame-head { color: var(--color-sage); }
.part-section .frame-right .frame-tag { color: var(--color-sage); font-weight: 600; }
@media (min-width: 800px) {
  .part-section .frames { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .part-section .frames-label { grid-column: 1 / -1; }
  .part-section .frame + .frame { margin-top: 0; }
}

/* Act 7 — seven principles */
.part-section .principles { margin: 26px 0; display: flex; flex-direction: column; gap: 10px; }
.part-section .principles-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 4px; text-align: center; }
.part-section .principle { background: #fff; border: 1px solid var(--color-border); border-left: 4px solid var(--color-gold); border-radius: 8px; padding: 14px 18px; display: grid; grid-template-columns: 52px 1fr; grid-template-rows: auto auto; gap: 4px 14px; }
.part-section .principle-num { grid-row: 1 / -1; font-family: var(--font-display); font-size: 28px; font-weight: 700; color: var(--color-gold-dark); display: flex; align-items: center; justify-content: center; background: var(--color-cream); border-radius: 6px; }
.part-section .principle-name { font-family: var(--font-display); font-size: 18px; font-weight: 700; color: var(--color-ink); }
.part-section .principle-body { font-family: var(--font-body); font-size: 14.5px; line-height: 1.6; color: var(--color-ink); }

/* Act 7 — quiet truth pull quote */
.part-section .quiet-truth { background: linear-gradient(135deg, #1a2332 0%, #2a3a4e 100%); color: #fff; border-radius: 12px; padding: 28px 32px; margin: 32px 0; box-shadow: 0 8px 24px rgba(26,35,50,.2); }
.part-section .quiet-mark { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--color-gold-light); margin-bottom: 18px; }
.part-section .quiet-body { margin: 0; padding: 0; border: none; font-family: var(--font-display); font-size: 19px; font-weight: 400; line-height: 1.55; color: #fff; font-style: normal; background: none; }
.part-section .quiet-body p { color: #fff; margin: 0 0 14px; }
.part-section .quiet-body p:last-child { margin-bottom: 0; }
.part-section .quiet-sig { font-family: var(--font-body); font-size: 14px; font-style: italic; color: var(--color-gold-light); margin-top: 10px; }

/* Appendix — drill cards */
.part-section .drills { display: flex; flex-direction: column; gap: 14px; margin: 22px 0; }
.part-section .drill { background: #fff; border: 1px solid var(--color-border); border-left: 4px solid var(--color-gold); border-radius: 10px; padding: 18px 22px; box-shadow: 0 2px 8px rgba(26,35,50,.04); }
.part-section .drill-head { display: grid; grid-template-columns: 60px 1fr auto; gap: 14px; align-items: baseline; border-bottom: 1px dashed var(--color-border); padding-bottom: 10px; margin-bottom: 12px; }
.part-section .drill-num { font-family: var(--font-display); font-size: 26px; font-weight: 700; color: var(--color-gold-dark); }
.part-section .drill-title { font-family: var(--font-display); font-size: 20px; font-weight: 700; color: var(--color-ink); line-height: 1.2; }
.part-section .drill-meta { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--color-light-muted); white-space: nowrap; }
.part-section .drill-stem p { font-size: 15px; line-height: 1.65; margin: 0 0 8px; }
.part-section .drill-edge { background: var(--color-cream); border-left: 3px solid var(--color-rust); padding: 8px 12px; border-radius: 0 6px 6px 0; font-size: 14px !important; font-style: italic; color: var(--color-ink); }
.part-section .drill-answer { margin-top: 12px; border-top: 1px dashed var(--color-border); padding-top: 10px; }
.part-section .drill-answer > summary { cursor: pointer; font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-gold-dark); padding: 4px 0; list-style: none; }
.part-section .drill-answer > summary::-webkit-details-marker { display: none; }
.part-section .drill-answer > summary::before { content: '▸ '; }
.part-section .drill-answer[open] > summary::before { content: '▾ '; }
.part-section .drill-body { padding-top: 8px; }
.part-section .drill-body pre { background: #0f1e2e; color: #e8e0d6; padding: 14px 16px; border-radius: 6px; overflow-x: auto; margin: 8px 0; font-family: var(--font-mono); font-size: 12.5px; line-height: 1.6; }
.part-section .drill-body pre code { background: transparent; color: inherit; padding: 0; border: none; }
@media (max-width: 700px) {
  .part-section .drill-head { grid-template-columns: 44px 1fr; grid-template-rows: auto auto; }
  .part-section .drill-meta { grid-column: 2 / -1; grid-row: 2 / 3; }
}

/* Appendix — ship list checklist */
.part-section .ship-list { display: flex; flex-direction: column; gap: 8px; margin: 22px 0; background: var(--color-cream); border: 1px solid var(--color-border); border-radius: 10px; padding: 18px 22px; }
.part-section .ship { display: flex; align-items: flex-start; gap: 12px; font-family: var(--font-body); font-size: 15px; line-height: 1.55; cursor: pointer; }
.part-section .ship input[type="checkbox"] { margin-top: 4px; flex-shrink: 0; width: 16px; height: 16px; accent-color: var(--color-sage); }
.part-section .ship input:checked + span { color: var(--color-light-muted); text-decoration: line-through; }
.part-section .appendix-close { margin-top: 28px; font-family: var(--font-body); font-size: 16px; line-height: 1.7; color: var(--color-ink); font-style: italic; }

/* The Brief — immersive interview framing (top of article) */
.part-section .brief-hero { text-align: center; padding: 28px 0 14px; }
.part-section .brief-hero-eyebrow { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.26em; text-transform: uppercase; color: var(--color-rust); margin-bottom: 12px; }
.part-section .brief-hero-title { font-family: var(--font-display); font-size: clamp(36px, 6.4vw, 68px); font-weight: 700; color: var(--color-ink); line-height: 1.02; margin: 0 0 14px; letter-spacing: -0.5px; }
.part-section .brief-hero-line { font-family: var(--font-body); font-size: clamp(17px, 2.2vw, 21px); line-height: 1.55; color: var(--color-muted); font-style: italic; max-width: 680px; margin: 0 auto; }

.part-section .loop-card { background: #fff; border: 1px solid var(--color-border); border-radius: 12px; padding: 22px 24px; margin: 28px 0; box-shadow: 0 4px 16px rgba(26,35,50,.08); }
.part-section .loop-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 16px; text-align: center; }
.part-section .loop-rounds { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px; }
.part-section .loop-round { border: 1px solid var(--color-border); border-radius: 8px; padding: 12px 10px; text-align: center; background: var(--color-cream); opacity: 0.55; transition: all .2s; }
.part-section .loop-round.is-active { opacity: 1; background: linear-gradient(135deg, #1a2332 0%, #2a3a4e 100%); color: #fff; border-color: #1a2332; box-shadow: 0 4px 14px rgba(26,35,50,.22); transform: translateY(-2px); }
.part-section .loop-round.is-active .loop-num { color: var(--color-gold-light); }
.part-section .loop-round.is-active .loop-name { color: #fff; }
.part-section .loop-round.is-active .loop-meta { color: var(--color-gold-light); }
.part-section .loop-num { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--color-muted); line-height: 1; }
.part-section .loop-name { font-family: var(--font-body); font-size: 12.5px; font-weight: 600; color: var(--color-ink); margin: 4px 0 2px; line-height: 1.25; }
.part-section .loop-meta { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.05em; color: var(--color-light-muted); }
.part-section .loop-foot { font-family: var(--font-body); font-size: 15px; line-height: 1.65; color: var(--color-ink); padding-top: 14px; border-top: 1px dashed var(--color-border); }
@media (max-width: 800px) {
  .part-section .loop-rounds { grid-template-columns: repeat(2, 1fr); }
  .part-section .loop-round.is-active { grid-column: 1 / -1; }
}

.part-section .brief-who { background: var(--color-cream); border: 1px solid var(--color-border); border-radius: 10px; padding: 20px 22px; margin: 22px 0; }
.part-section .brief-who-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 14px; }
.part-section .brief-who-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.part-section .brief-who-item { background: #fff; border: 1px solid var(--color-border); border-left: 3px solid var(--color-gold); border-radius: 6px; padding: 12px 14px; }
.part-section .brief-who-k { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 4px; }
.part-section .brief-who-v { font-family: var(--font-body); font-size: 14.5px; line-height: 1.55; color: var(--color-ink); }
@media (max-width: 700px) { .part-section .brief-who-grid { grid-template-columns: 1fr; } }

.part-section .watched { background: linear-gradient(135deg, #3a1a1a 0%, #5a1f1f 100%); color: #fff; border-radius: 12px; padding: 22px 26px; margin: 28px 0; border-left: 5px solid #e25555; box-shadow: 0 6px 20px rgba(92,30,30,.18); }
.part-section .watched-line { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: #fff; line-height: 1.25; margin-bottom: 12px; }
.part-section .watched-body { font-family: var(--font-body); font-size: 15.5px; line-height: 1.65; color: #f5e4e4; }

.part-section .brief-stakes { margin: 22px 0; padding: 18px 22px; background: #fff; border: 1px solid var(--color-border); border-radius: 10px; }
.part-section .brief-stakes-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 10px; }
.part-section .brief-stakes-list { padding-left: 26px; margin: 0; }
.part-section .brief-stakes-list li { font-family: var(--font-body); font-size: 15px; line-height: 1.6; margin-bottom: 6px; color: var(--color-ink); }

.part-section .brief-rules { margin: 22px 0; padding: 18px 22px; background: var(--color-cream); border-left: 4px solid var(--color-gold); border-radius: 0 8px 8px 0; }
.part-section .brief-rules-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 10px; }
.part-section .brief-rules ul { margin: 0 0 0 22px; padding: 0; }
.part-section .brief-rules li { font-family: var(--font-body); font-size: 14.5px; line-height: 1.6; margin-bottom: 6px; color: var(--color-ink); }

/* Five Rooms — per-company interview comparison */
.part-section .rooms-grid { display: flex; flex-direction: column; gap: 20px; margin: 26px 0; }
.part-section .room { background: #fff; border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(26,35,50,.06); position: relative; border-top: 5px solid var(--color-gold); }
.part-section .room-meta    { border-top-color: #4267B2; }
.part-section .room-google  { border-top-color: #4285F4; }
.part-section .room-amazon  { border-top-color: #FF9900; }
.part-section .room-netflix { border-top-color: #E50914; }
.part-section .room-apple   { border-top-color: #555555; }
.part-section .room-home { box-shadow: 0 8px 24px rgba(229,9,20,.18); outline: 2px solid rgba(229,9,20,.3); }
.part-section .room-badge { position: absolute; top: 14px; right: 18px; font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--color-gold-dark); background: var(--color-cream); padding: 4px 10px; border-radius: 12px; }
.part-section .room-home .room-badge { background: rgba(229,9,20,.1); color: #b10710; }
.part-section .room-head { padding: 20px 24px 14px; background: var(--color-cream); border-bottom: 1px solid var(--color-border); }
.part-section .room-co { font-family: var(--font-display); font-size: 28px; font-weight: 700; color: var(--color-ink); margin-bottom: 4px; letter-spacing: -0.3px; }
.part-section .room-who { font-family: var(--font-body); font-size: 14px; color: var(--color-ink); margin-bottom: 6px; }
.part-section .room-who strong { color: var(--color-rust); }
.part-section .room-ctx { font-family: var(--font-mono); font-size: 11px; color: var(--color-muted); letter-spacing: 0.04em; }
.part-section .room-storm { background: rgba(26,35,50,.03); border-left: 3px solid var(--color-ink); padding: 12px 16px; margin: 14px 20px; border-radius: 0 6px 6px 0; }
.part-section .room-storm-label { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-rust); margin-bottom: 6px; }
.part-section .room-storm-msg { font-family: var(--font-body); font-size: 14.5px; line-height: 1.55; color: var(--color-ink); }
.part-section .room-ask { margin: 16px 20px; background: linear-gradient(135deg, #1a2332 0%, #2a3a4e 100%); color: #fff; border-radius: 10px; padding: 14px 18px; }
.part-section .room-ask-label { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-gold-light); margin-bottom: 8px; }
.part-section .room-ask blockquote { margin: 0; padding: 0; border: none; font-family: var(--font-display); font-size: 17px; font-weight: 500; line-height: 1.5; color: #fff; background: none; font-style: normal; }

/* Five Rooms — per-room warm-up ramp (Q1–Q4 before Q5) */
.part-section .room-ramp { margin: 14px 20px; background: #fff; border: 1px solid var(--color-border); border-radius: 8px; padding: 14px 16px; }
.part-section .room-ramp-label { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 10px; text-align: center; }
.part-section .rramp-q { background: var(--color-cream); border: 1px solid var(--color-border); border-left: 3px solid var(--color-gold); border-radius: 0 6px 6px 0; padding: 9px 12px; margin-bottom: 6px; }
.part-section .rramp-q:last-child { margin-bottom: 0; }
.part-section .rramp-soft   { border-left-color: #4a9f6a; }
.part-section .rramp-vocab  { border-left-color: #c8915a; }
.part-section .rramp-mech   { border-left-color: #c44b2b; }
.part-section .rramp-scen   { border-left-color: #5a1f1f; }
.part-section .rramp-tier { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-light-muted); margin-bottom: 4px; }
.part-section .rramp-soft  .rramp-tier { color: #1a4f30; }
.part-section .rramp-vocab .rramp-tier { color: #a87434; }
.part-section .rramp-mech  .rramp-tier { color: var(--color-rust); }
.part-section .rramp-scen  .rramp-tier { color: #5a1f1f; }
.part-section .rramp-text { font-family: var(--font-body); font-size: 13.5px; line-height: 1.55; color: var(--color-ink); }
.part-section .room-specifics { padding: 8px 20px 18px; }
.part-section .room-sp-row { display: grid; grid-template-columns: 190px 1fr; gap: 14px; padding: 8px 0; border-top: 1px dashed var(--color-border-light); }
.part-section .room-sp-row:first-child { border-top: none; }
.part-section .room-sp-k { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--color-gold-dark); padding-top: 2px; }
.part-section .room-sp-v { font-family: var(--font-body); font-size: 14px; line-height: 1.6; color: var(--color-ink); }
.part-section .room-sp-v code { font-size: 12.5px; }
@media (max-width: 700px) {
  .part-section .room-sp-row { grid-template-columns: 1fr; gap: 2px; }
  .part-section .room-co { font-size: 22px; }
  .part-section .room-ask blockquote { font-size: 15px; }
  .part-section .room-badge { position: static; display: inline-block; margin-bottom: 10px; }
  .part-section .room-head { padding-top: 14px; }
}

/* Five Rooms — cross-company pattern card */
.part-section .pattern { background: var(--color-cream); border: 1px solid var(--color-border); border-left: 5px solid var(--color-gold); border-radius: 10px; padding: 22px 24px; margin: 28px 0; }
.part-section .pattern-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 16px; text-align: center; }
.part-section .pattern-grid { display: flex; flex-direction: column; gap: 12px; }
.part-section .pattern-row { background: #fff; border: 1px solid var(--color-border); border-radius: 8px; padding: 14px 18px; display: grid; grid-template-columns: 200px 1fr; gap: 16px; }
.part-section .pattern-k { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--color-rust); line-height: 1.3; }
.part-section .pattern-v { font-family: var(--font-body); font-size: 14.5px; line-height: 1.65; color: var(--color-ink); }
@media (max-width: 700px) { .part-section .pattern-row { grid-template-columns: 1fr; gap: 4px; } }

/* Five Rooms — hand-off card */
.part-section .rooms-handoff { background: linear-gradient(135deg, #1a2332 0%, #2a3a4e 100%); color: #fff; border-radius: 12px; padding: 26px 28px; margin: 32px 0 12px; }
.part-section .rooms-handoff-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.26em; text-transform: uppercase; color: var(--color-gold-light); margin-bottom: 14px; }
.part-section .rooms-handoff-body p { font-family: var(--font-body); font-size: 15.5px; line-height: 1.7; color: #e8e0d6; margin: 0 0 14px; }
.part-section .rooms-handoff-list { list-style: none; padding: 0; margin: 10px 0 18px; }
.part-section .rooms-handoff-list li { font-family: var(--font-body); font-size: 14.5px; line-height: 1.65; color: #e8e0d6; padding: 10px 0 10px 26px; border-top: 1px dashed rgba(232,224,214,.2); position: relative; }
.part-section .rooms-handoff-list li:first-child { border-top: none; }
.part-section .rooms-handoff-list li::before { content: "→"; position: absolute; left: 0; top: 10px; color: var(--color-gold-light); font-family: var(--font-mono); }
.part-section .rooms-handoff-list li strong { color: #fff; }
.part-section .rooms-handoff-foot { margin-top: 10px !important; padding-top: 14px; border-top: 1px dashed rgba(232,224,214,.3); color: var(--color-gold-light) !important; font-family: var(--font-mono) !important; font-size: 13.5px !important; }

/* Five Rooms — comparison table */
.part-section .compare { margin: 32px 0; }
.part-section .compare-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 10px; text-align: center; }
.part-section .compare-intro { font-family: var(--font-body); font-size: 14.5px; line-height: 1.65; color: var(--color-muted); font-style: italic; margin-bottom: 16px; text-align: center; }
.part-section .compare-wrap { overflow-x: auto; border: 1px solid var(--color-border); border-radius: 12px; background: #fff; box-shadow: 0 4px 14px rgba(26,35,50,.06); }
.part-section .compare-tbl { width: 100%; border-collapse: collapse; min-width: 920px; margin: 0; font-size: 13px; }
.part-section .compare-tbl thead th { background: var(--color-ink); color: #fff; font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; padding: 12px 14px; text-align: left; font-weight: 600; position: sticky; top: 0; }
.part-section .compare-tbl thead th:first-child { border-top-left-radius: 10px; }
.part-section .compare-tbl thead th:last-child { border-top-right-radius: 10px; }
.part-section .compare-tbl tbody td { padding: 14px 14px; border-top: 1px solid var(--color-border); vertical-align: top; font-family: var(--font-body); font-size: 13.5px; line-height: 1.55; color: var(--color-ink); }
.part-section .compare-tbl tbody tr { border-left: 4px solid var(--color-gold); }
.part-section .compare-tbl tr.cmp-meta    { border-left-color: #4267B2; }
.part-section .compare-tbl tr.cmp-google  { border-left-color: #4285F4; }
.part-section .compare-tbl tr.cmp-amazon  { border-left-color: #FF9900; }
.part-section .compare-tbl tr.cmp-netflix { border-left-color: #E50914; background: rgba(229,9,20,.03); }
.part-section .compare-tbl tr.cmp-apple   { border-left-color: #555555; }
.part-section .compare-tbl .cmp-co { min-width: 130px; }
.part-section .compare-tbl .cmp-co strong { display: block; font-family: var(--font-display); font-size: 18px; font-weight: 700; color: var(--color-ink); line-height: 1.2; }
.part-section .compare-tbl .cmp-tag { display: block; font-family: var(--font-mono); font-size: 10.5px; color: var(--color-muted); letter-spacing: 0.06em; margin-top: 4px; }
.part-section .cmp-chip { display: inline-block; background: var(--color-cream); border: 1px solid var(--color-border); color: var(--color-ink); font-family: var(--font-mono); font-size: 11px; padding: 3px 8px; border-radius: 11px; margin: 2px 3px 2px 0; line-height: 1.3; }
.part-section .compare-tbl tbody td code { font-size: 12px; }
.part-section .compare-foot { margin-top: 14px; padding: 12px 18px; background: var(--color-cream); border-left: 3px solid var(--color-gold); border-radius: 0 8px 8px 0; font-family: var(--font-body); font-size: 14px; line-height: 1.6; color: var(--color-ink); font-style: italic; }

/* Five Rooms — twist library */
.part-section .twists { margin: 32px 0; }
.part-section .twists-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 10px; text-align: center; }
.part-section .twists-intro { font-family: var(--font-body); font-size: 14.5px; line-height: 1.65; color: var(--color-muted); font-style: italic; margin-bottom: 18px; text-align: center; }
.part-section .twists-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.part-section .twist { background: #fff; border: 1px solid var(--color-border); border-top: 4px solid var(--color-gold); border-radius: 10px; padding: 16px 18px; box-shadow: 0 2px 8px rgba(26,35,50,.04); }
.part-section .twist-meta    { border-top-color: #4267B2; }
.part-section .twist-google  { border-top-color: #4285F4; }
.part-section .twist-amazon  { border-top-color: #FF9900; }
.part-section .twist-netflix { border-top-color: #E50914; }
.part-section .twist-apple   { border-top-color: #555555; }
.part-section .twist-head { display: flex; align-items: baseline; gap: 10px; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px dashed var(--color-border); }
.part-section .twist-co { font-family: var(--font-display); font-size: 20px; font-weight: 700; color: var(--color-ink); }
.part-section .twist-who { font-family: var(--font-mono); font-size: 11px; color: var(--color-muted); letter-spacing: 0.04em; }
.part-section .twist-item { display: grid; grid-template-columns: 36px 1fr; gap: 12px; padding: 8px 0; border-top: 1px dashed var(--color-border-light); }
.part-section .twist-item:first-of-type { border-top: none; padding-top: 2px; }
.part-section .twist-n { font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--color-gold-dark); background: var(--color-cream); border-radius: 4px; padding: 3px 6px; text-align: center; height: 24px; letter-spacing: 0.05em; }
.part-section .twist-body { font-family: var(--font-body); font-size: 13.5px; line-height: 1.6; color: var(--color-ink); }
.part-section .twist-body em { color: var(--color-rust); font-style: italic; }
.part-section .twists-foot { margin-top: 18px; padding: 14px 18px; background: linear-gradient(135deg, #1a2332 0%, #2a3a4e 100%); color: #fff; border-radius: 10px; font-family: var(--font-body); font-size: 14.5px; line-height: 1.7; }
.part-section .twists-foot strong { color: var(--color-gold-light); font-weight: 600; }
@media (max-width: 800px) {
  .part-section .twists-grid { grid-template-columns: 1fr; }
}

/* Five Rooms — tech-stack × companies matrix */
.part-section .stacks { margin: 32px 0; }
.part-section .stacks-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 10px; text-align: center; }
.part-section .stacks-intro { font-family: var(--font-body); font-size: 14.5px; line-height: 1.65; color: var(--color-muted); font-style: italic; margin-bottom: 16px; text-align: center; }
.part-section .stacks-wrap { overflow-x: auto; border: 1px solid var(--color-border); border-radius: 12px; background: #fff; box-shadow: 0 4px 14px rgba(26,35,50,.06); }
.part-section .stacks-tbl { width: 100%; border-collapse: collapse; min-width: 1000px; margin: 0; font-size: 12.5px; }
.part-section .stacks-tbl thead th { background: var(--color-ink); color: #fff; font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; padding: 12px 12px; text-align: left; font-weight: 600; }
.part-section .stacks-tbl thead th:nth-child(3) { background: #4267B2; }
.part-section .stacks-tbl thead th:nth-child(4) { background: #4285F4; }
.part-section .stacks-tbl thead th:nth-child(5) { background: #FF9900; }
.part-section .stacks-tbl thead th:nth-child(6) { background: #E50914; }
.part-section .stacks-tbl thead th:nth-child(7) { background: #555555; }
.part-section .stacks-tbl tbody td { padding: 11px 12px; border-top: 1px solid var(--color-border); vertical-align: top; font-family: var(--font-body); font-size: 12.5px; line-height: 1.55; color: var(--color-ink); }
.part-section .stacks-tbl tbody tr:nth-child(even) td { background: rgba(200,145,90,.03); }
.part-section .stacks-tbl .stk-name { min-width: 130px; }
.part-section .stacks-tbl .stk-name strong { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--color-ink); display: block; }
.part-section .stacks-tbl .stk-sub { display: block; font-family: var(--font-mono); font-size: 10px; color: var(--color-muted); letter-spacing: 0.04em; margin-top: 2px; }
.part-section .stacks-tbl .stk-layer { min-width: 220px; font-family: var(--font-body); font-size: 13px; color: var(--color-ink); border-right: 2px solid var(--color-gold); background: var(--color-cream) !important; }
.part-section .stacks-tbl tbody td strong { color: var(--color-rust); }
.part-section .stacks-foot { margin-top: 14px; padding: 14px 18px; background: var(--color-cream); border-left: 3px solid var(--color-gold); border-radius: 0 8px 8px 0; font-family: var(--font-body); font-size: 14px; line-height: 1.65; color: var(--color-ink); }
.part-section .stacks-foot strong { color: var(--color-rust); font-weight: 600; }
.part-section .stacks-foot em { color: var(--color-ink); font-weight: 600; font-style: normal; }

/* Primer — 7-stage business lifecycle */
.part-section .lifecycle { margin: 36px 0; }
.part-section .lifecycle-label { font-family: var(--font-mono); font-size: 11.5px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 10px; text-align: center; }
.part-section .lifecycle-intro { font-family: var(--font-body); font-size: 15px; line-height: 1.7; color: var(--color-ink); margin-bottom: 20px; padding: 12px 18px; background: var(--color-cream); border-left: 3px solid var(--color-gold); border-radius: 0 8px 8px 0; }
.part-section .lifecycle-intro em { color: var(--color-rust); font-style: italic; }
.part-section .stage-card { background: #fff; border: 1px solid var(--color-border); border-radius: 12px; padding: 20px 22px 18px; margin: 0; box-shadow: 0 4px 14px rgba(26,35,50,.06); border-top: 5px solid var(--color-gold); }
.part-section .stage-1 { border-top-color: #2563a8; }
.part-section .stage-2 { border-top-color: #4a8fbf; }
.part-section .stage-3 { border-top-color: #c8915a; }
.part-section .stage-4 { border-top-color: #c44b2b; }
.part-section .stage-5 { border-top-color: #a87434; }
.part-section .stage-6 { border-top-color: #2a7a4a; }
.part-section .stage-7 { border-top-color: #1a4f30; }
.part-section .stage-top { display: grid; grid-template-columns: 64px 1fr; grid-template-rows: auto auto; gap: 4px 16px; padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px dashed var(--color-border); }
.part-section .stage-num { grid-row: 1 / -1; font-family: var(--font-display); font-size: 40px; font-weight: 700; color: var(--color-ink); line-height: 1; background: var(--color-cream); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.part-section .stage-1 .stage-num { color: #2563a8; }
.part-section .stage-2 .stage-num { color: #4a8fbf; }
.part-section .stage-3 .stage-num { color: #c8915a; }
.part-section .stage-4 .stage-num { color: #c44b2b; }
.part-section .stage-5 .stage-num { color: #a87434; }
.part-section .stage-6 .stage-num { color: #2a7a4a; }
.part-section .stage-7 .stage-num { color: #1a4f30; }
.part-section .stage-title { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--color-ink); line-height: 1.2; }
.part-section .stage-who { font-family: var(--font-mono); font-size: 11.5px; letter-spacing: 0.08em; color: var(--color-muted); }
.part-section .stage-what { font-family: var(--font-body); font-size: 15px; line-height: 1.7; color: var(--color-ink); margin-bottom: 14px; }
.part-section .stage-what em { color: var(--color-rust); font-style: italic; }
.part-section .stage-data, .part-section .stage-tools { margin: 10px 0; }
.part-section .stage-data-label, .part-section .stage-tools-label { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 6px; }
.part-section .stage-data-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.part-section .dchip { background: rgba(26,35,50,.06); border: 1px solid var(--color-border); font-family: var(--font-mono); font-size: 11px; padding: 3px 9px; border-radius: 12px; color: var(--color-ink); letter-spacing: 0.02em; }
.part-section .stage-tools-v { font-family: var(--font-body); font-size: 13.5px; line-height: 1.55; color: var(--color-muted); font-style: italic; }
.part-section .stage-gotcha { margin-top: 12px; padding: 10px 14px; background: rgba(196,75,43,.08); border-left: 3px solid var(--color-rust); border-radius: 0 6px 6px 0; font-family: var(--font-body); font-size: 13.5px; line-height: 1.6; color: var(--color-ink); }
.part-section .stage-gotcha em { color: var(--color-rust); font-style: italic; font-weight: 600; }
.part-section .stage-arrow { text-align: center; font-family: var(--font-mono); font-size: 24px; color: var(--color-gold); margin: 4px 0; font-weight: 600; line-height: 1; }

/* Stage viz — data visualizations inside each stage card */
.part-section .stage-viz { background: var(--color-cream); border: 1px solid var(--color-border); border-radius: 8px; padding: 14px 16px; margin: 12px 0; }
.part-section .viz-title { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 10px; }
.part-section .viz-title-sec { margin-top: 16px; padding-top: 10px; border-top: 1px dashed var(--color-border); }
.part-section .viz-sub { font-family: var(--font-body); font-size: 13px; line-height: 1.55; color: var(--color-muted); font-style: italic; margin-top: 8px; }
.part-section .viz-sub strong { color: var(--color-rust); font-weight: 600; }
.part-section .viz-sub em { color: var(--color-ink); font-weight: 600; font-style: normal; }
.part-section .viz-foot { margin-top: 10px; font-family: var(--font-body); font-size: 13px; color: var(--color-ink); line-height: 1.55; }

/* Stage metric grid — big-number cards */
.part-section .stage-metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 0; }
.part-section .smetric { background: #fff; border: 1px solid var(--color-border); border-radius: 6px; padding: 10px 8px; text-align: center; }
.part-section .sm-val { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--color-ink); line-height: 1; }
.part-section .sm-key { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.04em; color: var(--color-muted); margin-top: 4px; line-height: 1.3; }
@media (max-width: 700px) {
  .part-section .stage-metric-grid { grid-template-columns: repeat(2, 1fr); }
  .part-section .sm-val { font-size: 18px; }
}

/* Stage 1 — stacked bar for objective distribution */
.part-section .stacked-bar { display: flex; height: 42px; border-radius: 6px; overflow: hidden; border: 1px solid var(--color-border); margin: 10px 0 4px; }
.part-section .sb-seg { display: flex; align-items: center; justify-content: center; font-family: var(--font-mono); font-size: 11.5px; color: #fff; padding: 0 4px; }
.part-section .sb-conv  { background: #2a7a4a; }
.part-section .sb-cons  { background: #c8915a; }
.part-section .sb-aware { background: #2563a8; }

/* Stage 2 — latency track */
.part-section .latency-track { display: flex; height: 48px; border-radius: 6px; overflow: hidden; border: 1px solid var(--color-border); background: #fff; }
.part-section .lat-seg { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px 6px; border-right: 1px solid rgba(255,255,255,.5); color: #fff; font-family: var(--font-mono); line-height: 1.2; }
.part-section .lat-1 { background: #2563a8; }
.part-section .lat-2 { background: #4a8fbf; }
.part-section .lat-3 { background: #c8915a; }
.part-section .lat-4 { background: #a87434; }
.part-section .lat-label { font-size: 11px; }
.part-section .lat-ms { font-size: 13px; font-weight: 700; margin-top: 2px; }

/* Stage 3 — auction leaderboard */
.part-section .auction-board { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid var(--color-border); border-radius: 6px; overflow: hidden; font-family: var(--font-mono); font-size: 12px; }
.part-section .auction-board thead th { background: var(--color-ink); color: #fff; padding: 8px 10px; text-align: left; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600; }
.part-section .auction-board tbody td { padding: 8px 10px; border-top: 1px solid var(--color-border); }
.part-section .auction-board tr.auc-win    { background: rgba(42,122,74,.14); }
.part-section .auction-board tr.auc-win td { color: #1a4f30; font-weight: 600; }
.part-section .auction-board tr.auc-second { background: rgba(196,75,43,.06); }

/* Stage 4 — funnel */
.part-section .funnel { background: #fff; border: 1px solid var(--color-border); border-radius: 6px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
.part-section .fn-row { display: grid; grid-template-columns: 1fr 80px 50px; gap: 10px; align-items: center; }
.part-section .fn-bar { background: linear-gradient(90deg, #2563a8, #4a8fbf); border-radius: 4px; padding: 8px 10px; color: #fff; font-family: var(--font-body); font-size: 12.5px; height: 30px; display: flex; align-items: center; }
.part-section .fn-ivt .fn-bar      { background: linear-gradient(90deg, #c44b2b, #e06e4b); }
.part-section .fn-view .fn-bar     { background: linear-gradient(90deg, #c8915a, #e0ad7a); }
.part-section .fn-billable .fn-bar { background: linear-gradient(90deg, #2a7a4a, #4a9f6a); }
.part-section .fn-n   { font-family: var(--font-mono); font-size: 13px; font-weight: 600; color: var(--color-ink); text-align: right; }
.part-section .fn-pct { font-family: var(--font-mono); font-size: 11px; color: var(--color-muted); text-align: right; }

/* Stage 5 — CTR bars + consent track */
.part-section .ctr-bars { display: flex; flex-direction: column; gap: 6px; background: #fff; border: 1px solid var(--color-border); border-radius: 6px; padding: 10px 12px; }
.part-section .ctr-row { display: grid; grid-template-columns: 200px 1fr; gap: 10px; align-items: center; font-family: var(--font-body); font-size: 12.5px; }
.part-section .ctr-bar { background: var(--color-cream); border-radius: 4px; height: 22px; overflow: hidden; }
.part-section .ctr-bar-muted { opacity: 0.5; }
.part-section .ctr-fill { background: linear-gradient(90deg, #1a4f8a, #2563a8); color: #fff; height: 100%; display: flex; align-items: center; padding: 0 8px; font-family: var(--font-mono); font-size: 11px; font-weight: 600; }
.part-section .ctr-fill-na { background: #999; font-style: italic; }
.part-section .consent-track { display: flex; height: 52px; border-radius: 6px; overflow: hidden; border: 1px solid var(--color-border); margin-top: 10px; }
.part-section .cons-seg { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px 6px; color: #fff; font-family: var(--font-mono); line-height: 1.2; border-right: 1px solid rgba(255,255,255,.5); }
.part-section .cons-seg:last-child { border-right: none; }
.part-section .cons-eu  { background: #c44b2b; }
.part-section .cons-row { background: #c8915a; }
.part-section .cons-us  { background: #2563a8; }
.part-section .cons-ios { background: #555555; }
.part-section .cons-seg span { font-size: 11px; }
.part-section .cons-seg .cons-n { font-size: 12px; font-weight: 700; margin-top: 2px; }
@media (max-width: 700px) { .part-section .ctr-row { grid-template-columns: 1fr; gap: 2px; } }

/* Stage 6 — decay chart + attribution models */
.part-section .decay-chart { display: flex; align-items: flex-end; gap: 8px; height: 160px; background: #fff; border: 1px solid var(--color-border); border-radius: 6px; padding: 10px 12px; }
.part-section .decay-bar { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; position: relative; height: 100%; }
.part-section .decay-fill { width: 100%; background: linear-gradient(180deg, #c8915a 0%, #a87434 100%); border-radius: 4px 4px 0 0; transition: height .6s ease; min-height: 4px; }
.part-section .decay-bar-full .decay-fill { background: linear-gradient(180deg, #2a7a4a 0%, #1a4f30 100%); }
.part-section .decay-label { font-family: var(--font-mono); font-size: 10px; color: var(--color-muted); margin-top: 4px; }
.part-section .decay-val { font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--color-ink); position: absolute; bottom: 20px; }
.part-section .decay-bar .decay-val { bottom: auto; top: -18px; }
.part-section .attribution-models { display: flex; flex-direction: column; gap: 6px; background: #fff; border: 1px solid var(--color-border); border-radius: 6px; padding: 10px 12px; }
.part-section .am-row { display: grid; grid-template-columns: 130px 1fr; gap: 10px; align-items: center; font-family: var(--font-body); font-size: 12.5px; }
.part-section .am-name { color: var(--color-ink); font-weight: 600; }
.part-section .am-touches { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; }
.part-section .am-t { background: var(--color-cream); border: 1px solid var(--color-border); border-radius: 4px; padding: 6px 4px; text-align: center; font-family: var(--font-mono); font-size: 11px; color: var(--color-muted); }
.part-section .am-t-0 { opacity: 0.3; }
.part-section .am-t-10 { background: rgba(200,145,90,0.2); color: var(--color-ink); }
.part-section .am-t-12 { background: rgba(200,145,90,0.25); color: var(--color-ink); }
.part-section .am-t-15 { background: rgba(200,145,90,0.3); color: var(--color-ink); }
.part-section .am-t-18 { background: rgba(200,145,90,0.35); color: var(--color-ink); }
.part-section .am-t-22 { background: rgba(200,145,90,0.45); color: var(--color-ink); font-weight: 600; }
.part-section .am-t-25 { background: rgba(200,145,90,0.5); color: var(--color-ink); font-weight: 600; }
.part-section .am-t-48 { background: rgba(42,122,74,0.4); color: #1a4f30; font-weight: 700; }
.part-section .am-t-50 { background: rgba(42,122,74,0.45); color: #1a4f30; font-weight: 700; }
.part-section .am-t-full { background: #2a7a4a; color: #fff; font-weight: 700; }

/* Stage 7 — loop timeline */
.part-section .loop-timeline { display: flex; flex-direction: column; gap: 6px; background: #fff; border: 1px solid var(--color-border); border-radius: 6px; padding: 10px 12px; }
.part-section .lt-row { display: grid; grid-template-columns: 220px 1fr 80px; gap: 10px; align-items: center; font-family: var(--font-body); font-size: 12.5px; }
.part-section .lt-who { color: var(--color-ink); }
.part-section .lt-bar { background: var(--color-cream); border-radius: 4px; height: 14px; overflow: hidden; position: relative; }
.part-section .lt-fill { height: 100%; border-radius: 4px; }
.part-section .lt-fast .lt-fill    { background: linear-gradient(90deg, #2a7a4a, #4a9f6a); }
.part-section .lt-med .lt-fill     { background: linear-gradient(90deg, #c8915a, #e0ad7a); }
.part-section .lt-slow .lt-fill    { background: linear-gradient(90deg, #c44b2b, #e06e4b); }
.part-section .lt-slowest .lt-fill { background: linear-gradient(90deg, #5a1f1f, #c44b2b); }
.part-section .lt-lat { font-family: var(--font-mono); font-size: 11.5px; font-weight: 600; color: var(--color-ink); text-align: right; }
@media (max-width: 700px) {
  .part-section .lt-row { grid-template-columns: 1fr 60px; }
  .part-section .lt-bar { display: none; }
  .part-section .fn-row { grid-template-columns: 1fr 60px 40px; gap: 6px; }
  .part-section .fn-bar { font-size: 11px; padding: 6px 8px; }
  .part-section .auction-board { font-size: 10.5px; }
  .part-section .auction-board tbody td { padding: 6px 6px; }
  .part-section .am-row { grid-template-columns: 90px 1fr; }
}

.part-section .stage-loop { display: grid; grid-template-columns: 72px 1fr; gap: 18px; align-items: center; background: linear-gradient(135deg, #1a2332 0%, #2a3a4e 100%); color: #fff; border-radius: 12px; padding: 20px 24px; margin: 14px 0 0; box-shadow: 0 6px 20px rgba(26,35,50,.18); }
.part-section .stage-loop-arrow { font-family: var(--font-display); font-size: 56px; font-weight: 700; color: var(--color-gold-light); text-align: center; line-height: 1; }
.part-section .stage-loop-head { font-family: var(--font-display); font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 8px; }
.part-section .stage-loop-text { font-family: var(--font-body); font-size: 14.5px; line-height: 1.65; color: #e8e0d6; }
.part-section .stage-loop-text strong { color: var(--color-gold-light); }
.part-section .lifecycle-foot { margin-top: 16px; padding: 12px 18px; border: 1px dashed var(--color-gold); border-radius: 8px; background: var(--color-cream); font-family: var(--font-body); font-size: 14px; line-height: 1.65; color: var(--color-ink); font-style: italic; }
.part-section .lifecycle-foot em { color: var(--color-rust); font-style: italic; font-weight: 600; }
@media (max-width: 700px) {
  .part-section .stage-top { grid-template-columns: 48px 1fr; }
  .part-section .stage-num { font-size: 28px; }
  .part-section .stage-title { font-size: 18px; }
  .part-section .stage-loop { grid-template-columns: 52px 1fr; gap: 12px; padding: 16px; }
  .part-section .stage-loop-arrow { font-size: 40px; }
}

/* Primer — 5-beat money flow */
.part-section .primer-flow { background: #fff; border: 1px solid var(--color-border); border-radius: 12px; padding: 22px 24px; margin: 26px 0; box-shadow: 0 4px 16px rgba(26,35,50,.06); }
.part-section .primer-flow-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 18px; text-align: center; }
.part-section .flow-beat { display: grid; grid-template-columns: 56px 1fr; gap: 16px; padding: 14px 0; border-top: 1px dashed var(--color-border); }
.part-section .flow-beat:first-of-type { border-top: none; padding-top: 4px; }
.part-section .flow-num { font-family: var(--font-display); font-size: 34px; font-weight: 700; color: var(--color-gold-dark); line-height: 1; background: var(--color-cream); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.part-section .flow-name { font-family: var(--font-display); font-size: 19px; font-weight: 700; color: var(--color-ink); margin-bottom: 4px; }
.part-section .flow-what { font-family: var(--font-body); font-size: 15px; line-height: 1.6; color: var(--color-ink); }
.part-section .primer-flow-foot { margin-top: 16px; padding-top: 14px; border-top: 1px dashed var(--color-border); font-family: var(--font-body); font-size: 14.5px; line-height: 1.65; color: var(--color-muted); font-style: italic; }

/* Primer — five giants grid */
.part-section .giants { margin: 32px 0; }
.part-section .giants-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 16px; text-align: center; }
.part-section .giant { background: #fff; border: 1px solid var(--color-border); border-radius: 10px; margin-bottom: 14px; overflow: hidden; box-shadow: 0 2px 10px rgba(26,35,50,.05); border-left: 5px solid var(--color-gold); }
.part-section .giant-meta    { border-left-color: #4267B2; }
.part-section .giant-google  { border-left-color: #4285F4; }
.part-section .giant-amazon  { border-left-color: #FF9900; }
.part-section .giant-netflix { border-left-color: #E50914; }
.part-section .giant-apple   { border-left-color: #555555; }
.part-section .giant-head { display: flex; justify-content: space-between; align-items: baseline; padding: 14px 20px; background: var(--color-cream); border-bottom: 1px solid var(--color-border); flex-wrap: wrap; gap: 8px; }
.part-section .giant-name { font-family: var(--font-display); font-size: 24px; font-weight: 700; color: var(--color-ink); }
.part-section .giant-rev { font-family: var(--font-mono); font-size: 12px; color: var(--color-gold-dark); letter-spacing: 0.08em; }
.part-section .giant-grid { padding: 12px 20px; }
.part-section .giant-row { display: grid; grid-template-columns: 180px 1fr; gap: 14px; padding: 8px 0; border-top: 1px dashed var(--color-border-light); }
.part-section .giant-row:first-child { border-top: none; }
.part-section .giant-k { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--color-gold-dark); padding-top: 2px; }
.part-section .giant-v { font-family: var(--font-body); font-size: 14.5px; line-height: 1.6; color: var(--color-ink); }
.part-section .giants-foot { margin-top: 16px; padding: 14px 18px; background: var(--color-cream); border-left: 3px solid var(--color-gold); border-radius: 0 8px 8px 0; font-family: var(--font-body); font-size: 14.5px; line-height: 1.65; color: var(--color-ink); font-style: italic; }
@media (max-width: 700px) {
  .part-section .giant-row { grid-template-columns: 1fr; gap: 2px; }
  .part-section .giant-name { font-size: 20px; }
}

/* Primer — rot/corruption cards */
.part-section .rot { margin: 32px 0; }
.part-section .rot-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 14px; text-align: center; }
.part-section .rot-intro { font-family: var(--font-body); font-size: 15.5px; line-height: 1.7; color: var(--color-ink); background: var(--color-cream); border-left: 3px solid var(--color-rust); padding: 12px 18px; border-radius: 0 8px 8px 0; margin-bottom: 18px; }
.part-section .rot-card { background: #fff; border: 1px solid var(--color-border); border-left: 5px solid var(--color-rust); border-radius: 10px; padding: 16px 20px; margin-bottom: 12px; display: grid; grid-template-columns: 58px 1fr; grid-template-rows: auto auto auto; column-gap: 16px; row-gap: 4px; }
.part-section .rot-num { grid-row: 1 / -1; font-family: var(--font-display); font-size: 30px; font-weight: 700; color: var(--color-rust); background: rgba(196,75,43,.08); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.part-section .rot-name { font-family: var(--font-display); font-size: 19px; font-weight: 700; color: var(--color-ink); }
.part-section .rot-what { font-family: var(--font-body); font-size: 14.5px; line-height: 1.6; color: var(--color-ink); }
.part-section .rot-where { font-family: var(--font-body); font-size: 13.5px; line-height: 1.6; color: var(--color-muted); font-style: italic; border-top: 1px dashed var(--color-border); padding-top: 6px; margin-top: 4px; }
.part-section .rot-where code { font-style: normal; }
.part-section .rot-foot { margin-top: 18px; padding: 14px 18px; background: linear-gradient(135deg, #3a1a1a 0%, #5a1f1f 100%); color: #fff; border-radius: 10px; font-family: var(--font-body); font-size: 14.5px; line-height: 1.65; }
.part-section .rot-foot em { color: #f5a9a9; font-style: italic; }

/* Primer — $100 money bar */
.part-section .money-shape { background: #fff; border: 1px solid var(--color-border); border-radius: 10px; padding: 20px 22px; margin: 26px 0; }
.part-section .money-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 14px; text-align: center; }
.part-section .money-bar { display: flex; height: 76px; border-radius: 8px; overflow: hidden; border: 1px solid var(--color-border); }
.part-section .money-seg { display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.04em; color: #fff; text-align: center; padding: 4px 2px; line-height: 1.3; }
.part-section .money-seg strong { font-family: var(--font-display); font-size: 17px; font-weight: 700; margin-top: 2px; }
.part-section .money-platform  { background: #1a4f8a; }
.part-section .money-ssp        { background: #2563a8; }
.part-section .money-dsp        { background: #4a8fbf; }
.part-section .money-data       { background: #c8915a; }
.part-section .money-ivt        { background: #c44b2b; }
.part-section .money-publisher  { background: #2a7a4a; }
.part-section .money-foot { margin-top: 14px; font-family: var(--font-body); font-size: 14px; line-height: 1.65; color: var(--color-muted); font-style: italic; }
.part-section .money-foot em { color: var(--color-rust); font-style: italic; }
@media (max-width: 700px) {
  .part-section .money-bar { flex-direction: column; height: auto; }
  .part-section .money-seg { min-height: 44px; width: 100% !important; flex-direction: row; gap: 10px; }
  .part-section .money-seg strong { margin: 0; }
}

/* Primer — glossary grid */
.part-section .glossary { background: var(--color-cream); border: 1px solid var(--color-border); border-radius: 10px; padding: 18px 22px; margin: 26px 0; }
.part-section .glossary-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 14px; text-align: center; }
.part-section .glossary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.part-section .glossary-item { background: #fff; border: 1px solid var(--color-border); border-radius: 6px; padding: 10px 12px; display: grid; grid-template-columns: 78px 1fr; gap: 10px; align-items: baseline; }
.part-section .gl-k { font-family: var(--font-mono); font-size: 12.5px; font-weight: 600; color: var(--color-gold-dark); letter-spacing: 0.04em; }
.part-section .gl-v { font-family: var(--font-body); font-size: 13px; line-height: 1.5; color: var(--color-ink); }
@media (max-width: 700px) { .part-section .glossary-grid { grid-template-columns: 1fr; } }

/* Primer — hand-off to The Brief */
.part-section .primer-handoff { background: linear-gradient(135deg, #1a2332 0%, #2a3a4e 100%); color: #fff; border-radius: 12px; padding: 26px 28px; margin: 32px 0 12px; box-shadow: 0 8px 24px rgba(26,35,50,.22); }
.part-section .handoff-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.26em; text-transform: uppercase; color: var(--color-gold-light); margin-bottom: 10px; }
.part-section .handoff-title { font-family: var(--font-display); font-size: 30px; font-weight: 700; color: #fff; margin: 0 0 14px; }
.part-section .handoff-line { font-family: var(--font-body); font-size: 16px; line-height: 1.65; color: #e8e0d6; margin: 0 0 10px; }
.part-section .handoff-cue { margin-top: 14px; padding-top: 14px; border-top: 1px dashed rgba(232,224,214,.3); font-family: var(--font-mono); font-size: 13px; color: var(--color-gold-light); }

/* Data catalog — column-level schema reference */
.part-section .catalog { display: flex; flex-direction: column; gap: 18px; margin: 20px 0 24px; }
.part-section .catalog-tbl { background: #fff; border: 1px solid var(--color-border); border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(26,35,50,.05); }
.part-section .catalog-head { background: linear-gradient(135deg, #1a2332 0%, #2a3a4e 100%); color: #fff; padding: 14px 18px; }
.part-section .catalog-name { font-family: var(--font-mono); font-size: 15px; font-weight: 600; color: #fff; }
.part-section .catalog-name code { background: transparent; color: var(--color-gold-light); border: none; padding: 0; font-size: 15px; }
.part-section .catalog-grain { font-family: var(--font-mono); font-size: 11px; color: var(--color-gold-light); margin-top: 4px; line-height: 1.5; }
.part-section .catalog-grain code { background: rgba(255,255,255,.08); color: var(--color-gold-light); border: none; padding: 1px 5px; font-size: 10.5px; }
.part-section .catalog-cols { width: 100%; border-collapse: collapse; margin: 0; font-size: 13px; background: #fff; }
.part-section .catalog-cols thead th { background: var(--color-cream); color: var(--color-gold-dark); font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; padding: 10px 12px; text-align: left; font-weight: 600; border-bottom: 1px solid var(--color-border); }
.part-section .catalog-cols tbody td { padding: 11px 12px; border-top: 1px solid var(--color-border-light); vertical-align: top; font-family: var(--font-body); font-size: 13.5px; line-height: 1.55; }
.part-section .catalog-cols tbody td:nth-child(1) { width: 22%; white-space: nowrap; }
.part-section .catalog-cols tbody td:nth-child(1) code { background: rgba(200,145,90,.12); color: var(--color-gold-dark); border-color: rgba(200,145,90,.3); font-weight: 600; }
.part-section .catalog-cols tbody td:nth-child(2) { width: 14%; font-family: var(--font-mono); font-size: 11.5px; color: var(--color-muted); white-space: nowrap; }
.part-section .catalog-cols tbody td:nth-child(3) { width: 48%; }
.part-section .catalog-cols tbody td:nth-child(4) { width: 16%; font-family: var(--font-mono); font-size: 11.5px; color: var(--color-ink); }
.part-section .catalog-cols tbody tr:nth-child(even) td { background: rgba(200,145,90,.03); }
.part-section .catalog-foot { padding: 14px 18px; background: var(--color-cream); border-top: 1px solid var(--color-border); font-family: var(--font-body); font-size: 13.5px; line-height: 1.65; color: var(--color-ink); }
.part-section .catalog-foot code { font-size: 12.5px; }
.part-section .catalog-foot em { color: var(--color-rust); font-style: normal; font-weight: 600; }
@media (max-width: 800px) {
  .part-section .catalog-cols { font-size: 12.5px; }
  .part-section .catalog-cols thead th { padding: 8px 10px; }
  .part-section .catalog-cols tbody td { padding: 9px 10px; font-size: 12.5px; }
  .part-section .catalog-cols tbody td:nth-child(1),
  .part-section .catalog-cols tbody td:nth-child(2),
  .part-section .catalog-cols tbody td:nth-child(3),
  .part-section .catalog-cols tbody td:nth-child(4) { width: auto; }
}

/* Your Turn — inline answer reveal */
.part-section .your-turn-answer { margin-top: 12px; border-top: 1px dashed var(--color-border); padding-top: 10px; }
.part-section .your-turn-answer > summary { cursor: pointer; font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-gold-dark); padding: 4px 0; list-style: none; }
.part-section .your-turn-answer > summary::-webkit-details-marker { display: none; }
.part-section .your-turn-answer > summary::before { content: '▸ '; }
.part-section .your-turn-answer[open] > summary::before { content: '▾ '; }
.part-section .your-turn-body { padding-top: 8px; }
.part-section .your-turn-body pre { background: #0f1e2e; color: #e8e0d6; padding: 14px 16px; border-radius: 6px; overflow-x: auto; margin: 10px 0; font-family: var(--font-mono); font-size: 12.5px; line-height: 1.6; }
.part-section .your-turn-body pre code { background: transparent; color: inherit; padding: 0; border: none; }

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

<div class="quick-nav" role="navigation" aria-label="Page navigation">
  <button class="qn-btn qn-up" onclick="window.scrollTo({top:0,behavior:'smooth'})" aria-label="Jump to top"><span class="qn-label">Top</span>↑</button>
  <button class="qn-btn qn-down" onclick="window.scrollTo({top:document.documentElement.scrollHeight,behavior:'smooth'})" aria-label="Jump to bottom"><span class="qn-label">Bottom</span>↓</button>
</div>

<footer class="site-footer">
<div class="footer-ornament">❧</div>
<div class="footer-links"><a href="https://linkedin.com/in/paddyiyer" target="_blank" rel="noopener">LinkedIn</a><a href="../about.html">About</a><a href="mailto:paddy@paddyspeaks.com">Contact</a></div>
<p class="footer-copy">© 2026 PaddySpeaks. All rights reserved.</p></footer>

<script type="module">
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

// content-visibility:auto on sections causes hash-navigation to land on the
// wrong section: the browser scrolls to the target's CURRENT layout position,
// but as previously-offscreen sections expand mid-scroll, the target moves.
// Fix: intercept anchor clicks + hashchange and re-scroll after two frames
// so the real layout has settled.
(function(){
  // content-visibility:auto on sections gives each offscreen one an 1800px
  // placeholder. When the user clicks a chip for a far-away section, the
  // browser scrolls to the current (placeholder-compressed) position; as
  // the sections in between render during the scroll, they expand, pushing
  // the real target further down. Smooth scroll doesn't follow that drift.
  // Fix: instant scroll + repeated re-corrections over ~800 ms so every
  // layout-shift during/after the jump gets absorbed.
  function correctScroll(el){
    var rect = el.getBoundingClientRect();
    // Offset 8px padding from viewport top; positive value means target is
    // below desired position, negative means above.
    var delta = rect.top - 8;
    if(Math.abs(delta) > 2){
      window.scrollTo({top: window.scrollY + delta, left: 0, behavior: 'auto'});
    }
  }
  function scrollToHash(hash){
    if(!hash || hash === '#') return;
    var id = hash.charAt(0) === '#' ? hash.slice(1) : hash;
    var el = document.getElementById(id);
    if(!el) return;
    // Fire corrections at 0, 60, 180, 400, 800 ms. Each one repositions
    // based on the latest layout; by 800 ms content-visibility has always
    // settled in practice.
    correctScroll(el);
    [60, 180, 400, 800].forEach(function(ms){
      setTimeout(function(){ correctScroll(el); }, ms);
    });
  }
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if(!a) return;
    var href = a.getAttribute('href');
    if(href.length < 2) return;
    e.preventDefault();
    history.pushState(null, '', href);
    scrollToHash(href);
  });
  window.addEventListener('hashchange', function(){ scrollToHash(location.hash); });
  if(location.hash) scrollToHash(location.hash);
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
    out = css_minify.minify_inline_style_blocks(out)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(out, encoding="utf-8")
    print(f"wrote {OUT} ({len(out):,} bytes)")


if __name__ == "__main__":
    main()
