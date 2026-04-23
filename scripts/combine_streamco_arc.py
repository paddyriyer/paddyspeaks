#!/usr/bin/env python3
"""
Combine the single StreamCo arc source file into a full HTML article
with site chrome, SEO, and the interactive dashboard blocks.

Staged output path: articles/streamco-data-engineering-arc.html
(does not overwrite the live ads article until explicitly swapped).
"""
from __future__ import annotations
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import css_minify
import viz_transform

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "interview" / "streamco" / "arc_source.html"
OUT = ROOT / "articles" / "streamco-data-engineering-arc.html"

MAIN_RE = re.compile(r'<main class="content">(.*?)</main>', re.DOTALL)


def extract_main(html_text: str) -> str:
    m = MAIN_RE.search(html_text)
    if not m:
        raise ValueError("no <main class='content'> block in source")
    return m.group(1)


HEAD = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<meta name="theme-color" content="#1a2332">
<title>Day Four — The Arc of a Senior Ads Data Engineer | PaddySpeaks</title>
<meta name="description" content="One story, seven acts. Day four at a large subscription streaming platform. The CFO is in your Slack. The dashboard says $8.2M, the exec deck says $9.1M. Walk through the interview from incident to lesson.">
<meta name="author" content="Paddy Iyer">
<link rel="canonical" href="https://paddyspeaks.com/articles/streamco-data-engineering-arc.html">

<meta property="og:title" content="Day Four — The Arc of a Senior Ads Data Engineer">
<meta property="og:description" content="One story, seven acts. Day four at a streaming platform. The CFO asks why the revenue number is wrong. Walk through the interview from incident to lesson.">
<meta property="og:type" content="article">
<meta property="og:url" content="https://paddyspeaks.com/articles/streamco-data-engineering-arc.html">
<meta property="og:site_name" content="PaddySpeaks">
<meta property="og:image" content="https://paddyspeaks.com/images/og-default.png">
<meta property="article:author" content="Paddy Iyer">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Day Four — The Arc of a Senior Ads Data Engineer">
<meta name="twitter:description" content="One story, seven acts. Day four at a streaming platform. The CFO asks why the revenue number is wrong.">
<meta name="twitter:image" content="https://paddyspeaks.com/images/og-default.png">

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
/* ═══ The Arc — article-level typography ═══ */
.article-page.arc .article-content { max-width: 920px; padding: 0 32px 80px; }
.article-page.arc .article-hero    { max-width: 920px; }

/* Act headers */
.act { scroll-margin-top: 24px; padding: 56px 0 24px; border-top: 1px solid var(--color-border-light); }
.act:first-of-type { border-top: none; padding-top: 0; }
.act-eyebrow { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--color-gold-dark); margin-bottom: 10px; }
.act-title { font-family: var(--font-display); font-size: clamp(32px, 5vw, 56px); font-weight: 700; color: var(--color-ink); line-height: 1.08; margin: 0 0 20px; }
.act-subtitle { font-family: var(--font-body); font-size: 20px; line-height: 1.7; color: var(--color-muted); font-style: italic; margin-bottom: 28px; }
.act-breath { margin-top: 32px; font-style: italic; color: var(--color-muted); }
.act-note { background: var(--color-cream); border-left: 3px solid var(--color-gold); padding: 20px 24px; margin: 24px 0 0; border-radius: 0 8px 8px 0; }
.act-note p { font-size: 16px; line-height: 1.75; margin-bottom: 14px; }
.act-note p:last-child { margin-bottom: 0; }
.act-reply { background: rgba(42,122,74,.08); border-left: 3px solid var(--color-sage); padding: 14px 18px; margin: 16px 0 24px; border-radius: 0 6px 6px 0; font-family: var(--font-body); font-size: 15px; line-height: 1.6; }

/* Storm (Slack simulation) */
.storm { background: #fff; border: 1px solid var(--color-border); border-radius: 10px; padding: 18px 22px; margin: 24px 0 28px; box-shadow: 0 2px 10px rgba(26,35,50,.05); }
.storm-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-light-muted); margin-bottom: 16px; }
.storm-msg { margin: 10px 0; padding: 10px 14px; border-radius: 6px; border-left: 3px solid; background: var(--color-cream); }
.storm-msg .storm-who { font-family: var(--font-mono); font-size: 11px; font-weight: 600; letter-spacing: 0.08em; margin-bottom: 4px; color: var(--color-ink); }
.storm-msg .storm-body { font-family: var(--font-body); font-size: 15px; line-height: 1.55; color: var(--color-ink); }
.storm-msg.storm-cfo { border-left-color: #c44b2b; }
.storm-msg.storm-cmo { border-left-color: #c8915a; }
.storm-msg.storm-partner { border-left-color: #2a7a4a; }
.storm-msg.storm-dir { border-left-color: #2563a8; background: rgba(37,99,168,.06); }
.storm-you { margin: 14px 0 4px; padding: 10px 14px; border-top: 1px dashed var(--color-border); font-family: var(--font-body); font-size: 15px; color: var(--color-muted); }
.storm-you .storm-who { font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--color-ink); margin-bottom: 4px; }

/* Choice cards (click-to-reveal) */
.choice { background: #fff; border: 1px solid var(--color-border); border-radius: 8px; margin: 10px 0; overflow: hidden; transition: border-color .2s; }
.choice[open] { border-color: var(--color-gold); }
.choice > summary { list-style: none; padding: 14px 18px; cursor: pointer; display: flex; align-items: center; gap: 14px; font-family: var(--font-body); font-size: 16px; color: var(--color-ink); }
.choice > summary::-webkit-details-marker { display: none; }
.choice > summary::after { content: '+'; margin-left: auto; font-family: var(--font-mono); color: var(--color-gold-dark); font-size: 20px; }
.choice[open] > summary::after { content: '−'; }
.choice-letter { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: var(--color-ink); color: var(--color-cream); font-family: var(--font-mono); font-weight: 700; font-size: 13px; border-radius: 50%; flex-shrink: 0; }
.choice-line { flex: 1; line-height: 1.4; }
.choice-body { padding: 0 18px 16px 60px; color: var(--color-muted); font-size: 15px; line-height: 1.7; border-top: 1px solid var(--color-border-light); padding-top: 14px; }
.choice-body p { margin-bottom: 10px; }

/* Sidebars (The Room, The Landmine, Your Turn) */
.sidebar { margin: 28px 0; padding: 20px 24px; border-radius: 10px; border-left: 4px solid; }
.sidebar-label { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; margin-bottom: 8px; }
.sidebar-title { font-family: var(--font-display); font-size: 20px; font-weight: 600; color: var(--color-ink); margin: 0 0 12px; line-height: 1.3; }
.sidebar p, .sidebar li { font-family: var(--font-body); font-size: 15px; line-height: 1.7; color: var(--color-ink); }
.sidebar ol, .sidebar ul { padding-left: 22px; margin: 12px 0; }
.sidebar li { margin-bottom: 8px; }
.sidebar-punch { margin-top: 14px; font-style: italic; color: var(--color-muted); font-size: 15px; }

.sidebar-room { background: rgba(37,99,168,.05); border-left-color: #2563a8; }
.sidebar-room .sidebar-label { color: #1a4f8a; }
.sidebar-landmine { background: rgba(196,75,43,.05); border-left-color: #c44b2b; }
.sidebar-landmine .sidebar-label { color: #9e3a1e; }
.sidebar-turn { background: rgba(200,145,90,.06); border-left-color: #c8915a; }
.sidebar-turn .sidebar-label { color: #a87434; }

/* content-visibility for long-page perf */
.act { content-visibility: auto; contain-intrinsic-size: 0 1400px; }
.act-prologue, .act-1 { content-visibility: visible; }

/* Quick-nav */
.quick-nav { position: fixed; right: 20px; bottom: 20px; z-index: 60; display: flex; flex-direction: column; gap: 8px; }
.qn-btn { width: 44px; height: 44px; border-radius: 50%; background: rgba(26,35,50,.92); color: #fff; border: none; font-size: 18px; cursor: pointer; box-shadow: 0 4px 14px rgba(26,35,50,.25); display: flex; align-items: center; justify-content: center; transition: background .2s, transform .2s; padding: 0; line-height: 1; }
.qn-btn:hover { background: var(--color-gold-dark); transform: translateY(-2px); will-change: transform; }
.qn-btn:active { transform: scale(.95); }

@media (max-width: 820px) {
  .article-page.arc .article-content { padding: 0 16px 60px; }
  .act { padding: 40px 0 16px; }
  .act-title { font-size: clamp(26px, 6vw, 38px); }
  .act-subtitle { font-size: 17px; }
  .storm { padding: 14px 16px; }
  .storm-msg .storm-body { font-size: 14px; }
  .choice > summary { padding: 12px 14px; font-size: 15px; }
  .choice-body { padding: 14px 14px 14px 50px; }
  .sidebar { padding: 16px 18px; }
  .sidebar-title { font-size: 18px; }
  .quick-nav { right: 12px; bottom: 12px; gap: 6px; }
  .qn-btn { width: 40px; height: 40px; font-size: 16px; }
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
  <a href="../index.html#technology">Technology</a>
  <a href="../index.html#ai">AI &amp; Future</a>
  <a href="../index.html#archive">Archive</a>
  <a href="../about.html">About</a>
</nav>

<div class="article-page arc">
<a class="back-to-home" href="../index.html">← All Articles</a>

<div class="article-hero">
  <span class="tag">technology · interview prep · work in progress</span>
  <h1>Day Four</h1>
  <p class="subtitle">The arc of a senior ads data engineer — one story, seven acts, at a subscription streaming platform on a Tuesday morning.</p>
  <div class="article-meta">
    <span>By Paddy</span><span class="dot"></span>
    <span>Draft · building in public</span>
  </div>
</div>

<div class="article-content">
__BODY__
</div>

</div>

<div class="quick-nav" role="navigation" aria-label="Page navigation">
  <button class="qn-btn qn-up" onclick="window.scrollTo({top:0,behavior:'smooth'})" aria-label="Jump to top">↑</button>
  <button class="qn-btn qn-down" onclick="window.scrollTo({top:document.documentElement.scrollHeight,behavior:'smooth'})" aria-label="Jump to bottom">↓</button>
</div>

<footer class="site-footer">
<div class="footer-ornament">❧</div>
<div class="footer-links"><a href="https://linkedin.com/in/paddyiyer" target="_blank" rel="noopener">LinkedIn</a><a href="../about.html">About</a><a href="mailto:paddy@paddyspeaks.com">Contact</a></div>
<p class="footer-copy">© 2026 PaddySpeaks. All rights reserved.</p></footer>

<script type="module">
window.addEventListener('scroll',function(){var b=document.getElementById('readingProgress');if(b)b.style.width=(window.scrollY/(document.documentElement.scrollHeight-window.innerHeight))*100+'%';});
</script>
<script defer src="/lib/ps.js"></script>
</main>
</body>
</html>
'''


def main() -> None:
    src = SRC.read_text(encoding="utf-8")
    body = extract_main(src)
    body = viz_transform.apply(body)
    out = HEAD.replace("__BODY__", body)
    out = css_minify.minify_inline_style_blocks(out)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(out, encoding="utf-8")
    print(f"wrote {OUT} ({len(out):,} bytes)")


if __name__ == "__main__":
    main()
