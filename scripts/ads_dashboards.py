#!/usr/bin/env python3
"""
ads_dashboards.py — inject interactive HTML dashboard blocks into Part 5
of the Ads Data Engineering article (the Visualization & Measurement part).

Each dashboard is a self-contained pure-HTML/CSS/JS block. No libraries.

Blocks are injected by replacing specific marker lines in the post-combiner
output. Markers are h3 ids inside ap05-* namespace.
"""
from __future__ import annotations
import re
from pathlib import Path

DASH_DIR = Path(__file__).resolve().parent / "ads_dashboard_blocks"


def load(name: str) -> str:
    p = DASH_DIR / f"{name}.html"
    return p.read_text(encoding="utf-8") if p.exists() else ""


def inject(article_html: str) -> str:
    """Insert each dashboard right after the corresponding h3 heading."""
    mapping = [
        ('id="ap05-the-funnel"',                 'dash_funnel'),
        ('id="ap05-visualization-funnel-bar-chart"', 'dash_funnel'),
        ('id="ap05-install-to-event-funnel"',    'dash_install_funnel'),
        ('id="ap05-key-chart-lead-funnel--cycle-time"', 'dash_lead_funnel'),
        ('id="ap05-the-header"',                 'dash_campaign_dashboard'),
        ('id="ap05-roas-by-attribution-window"', 'dash_roas_windows'),
    ]
    # Also: inject growth accounting + money-left + improvement at end of Part 5
    for anchor, dash_name in mapping:
        block = load(dash_name)
        if not block:
            continue
        # Insert the dashboard after the first <h3 id="...anchor..."> ... </h3>
        pattern = re.compile(r'(<h3[^>]*' + re.escape(anchor) + r'[^>]*>.*?</h3>)', re.DOTALL)
        article_html = pattern.sub(lambda m: m.group(1) + "\n" + block + "\n", article_html, count=1)

    # Append extra "masterpiece" dashboards at the end of Part 5 (just before back-to-top)
    appendix = []
    for name in ("dash_growth_accounting", "dash_money_left", "dash_improvement"):
        b = load(name)
        if b:
            appendix.append(b)
    if appendix:
        end = "\n".join(appendix)
        # Insert right before the back-to-top link of ads-part-05
        part5_end_re = re.compile(
            r'(<section id="ads-part-05".*?)(<p class="back-to-top">)',
            re.DOTALL,
        )
        article_html = part5_end_re.sub(
            lambda m: m.group(1) + "\n" + end + "\n" + m.group(2),
            article_html, count=1
        )

    return article_html
