#!/usr/bin/env python3
"""
viz_transform.py — convert ASCII diagrams in combined article HTML into
rich HTML visualizations. Called by the combiners after anchor rewriting.

Handled patterns inside <pre ...>...</pre> blocks:

  1. Funnel bar chart        -- lines like "Label  [█...] 10,000,000 (CTR 1.5%)"
  2. Stage ladder            -- lines like "Label  10,000 (85%)"
  3. Horizontal arrow flow   -- "A ─► B ─► C ─► D"
  4. Vertical arrow funnel   -- "Stage\n  │ (pct)\n  ▼\n  Stage\n..."
  5. Box-drawn card          -- ┌──┐ / │ │ / ├──┤ / └──┘
  6. Bar-chart per bucket    -- "bucket  ██████  N"

Anything that does not match stays unchanged.
"""
from __future__ import annotations

import html as htmllib
import re

PRE_RE = re.compile(r'<pre([^>]*)>\s*<code[^>]*>(.*?)</code>\s*</pre>', re.DOTALL)
PRE_RE_ALT = re.compile(r'<pre([^>]*)>(.*?)</pre>', re.DOTALL)


def _parse_int(s: str) -> int | None:
    s = s.replace(",", "").strip()
    if re.fullmatch(r"\d+", s):
        return int(s)
    return None


def try_funnel_bar_chart(text: str) -> str | None:
    """
    Match blocks like:
        Impressions     [████████████████] 10,000,000
        Clicks          [█████]                  150,000  (CTR 1.5%)
        Page Views      [████]                   135,000  (90%)
    """
    raw = htmllib.unescape(text).strip("\n")
    lines = [l for l in raw.split("\n") if l.strip()]
    if len(lines) < 3:
        return None
    rows = []
    row_re = re.compile(
        r"^\s*(?P<label>.+?)\s+\[(?P<bar>[█▉▊▋▌▍▎▏ ]*)\][^\S\n]*"
        r"(?P<value>[\d,]+)"
        r"(?:[^\S\n]*\((?P<note>[^)]*)\))?\s*$"
    )
    for line in lines:
        m = row_re.match(line)
        if not m:
            return None
        val = _parse_int(m.group("value"))
        if val is None:
            return None
        rows.append((m.group("label").strip(), val, (m.group("note") or "").strip()))
    if not rows:
        return None
    top = max(r[1] for r in rows) or 1
    out = ['<div class="viz viz-funnel">']
    out.append('<div class="viz-label">Funnel</div>')
    out.append('<div class="funnel-rows">')
    for i, (label, val, note) in enumerate(rows):
        pct = 100.0 * val / top
        out.append(
            f'<div class="funnel-row" style="--w:{pct:.3f}">'
            f'<span class="f-label">{htmllib.escape(label)}</span>'
            f'<div class="f-track"><div class="f-bar"></div></div>'
            f'<span class="f-value">{val:,}</span>'
            f'</div>'
        )
        if note:
            out.append(f'<div class="funnel-drop"><span class="drop-pct">{htmllib.escape(note)}</span></div>')
    out.append('</div></div>')
    return "\n".join(out)


def try_stage_ladder(text: str) -> str | None:
    """
    Match blocks of label + number (+ optional pct) lines:
        Installs               10,000
        First-open              8,500 (85%)
        Tutorial complete       5,100 (60% of first-open)
    """
    raw = htmllib.unescape(text).strip("\n")
    lines = [l for l in raw.split("\n") if l.strip()]
    if not (3 <= len(lines) <= 20):
        return None
    if any(ch in raw for ch in "│┌└├─►▼█"):
        return None
    row_re = re.compile(
        r"^\s*(?P<label>.+?)\s{2,}"
        r"\$?(?P<value>[\d,]+(?:\.\d+)?)"
        r"(?:[^\S\n]*\((?P<note>[^)]*)\))?\s*$"
    )
    rows = []
    for line in lines:
        m = row_re.match(line)
        if not m:
            return None
        try:
            val = float(m.group("value").replace(",", ""))
        except ValueError:
            return None
        rows.append((m.group("label").strip(), val, (m.group("note") or "").strip(),
                     "$" in line.split()[0] or any(s in line for s in ["$"])))
    if not rows:
        return None
    top = max(r[1] for r in rows) or 1
    out = ['<div class="viz viz-ladder">']
    out.append('<div class="viz-label">Stage Breakdown</div>')
    out.append('<div class="ladder-rows">')
    for label, val, note, is_money in rows:
        pct = 100.0 * val / top
        num = f"${val:,.0f}" if is_money else f"{val:,.0f}"
        out.append(
            f'<div class="ladder-row" style="--w:{pct:.3f}">'
            f'<span class="l-label">{htmllib.escape(label)}</span>'
            f'<div class="l-track"><div class="l-bar"></div></div>'
            f'<span class="l-value">{num}</span>'
            f'<span class="l-note">{htmllib.escape(note)}</span>'
            f'</div>'
        )
    out.append('</div></div>')
    return "\n".join(out)


def try_horizontal_arrow_flow(text: str) -> str | None:
    """Match one-or-few-line flows: 'A ─► B ─► C' or 'A ──► B ──► C'."""
    raw = htmllib.unescape(text).strip()
    if "─►" not in raw and "──►" not in raw:
        return None
    if any(ch in raw for ch in "│┌└├▼█"):
        return None
    clean = re.sub(r"\s+", " ", raw)
    parts = re.split(r"\s*(?:─+►|──►|─►)\s*", clean)
    parts = [p.strip() for p in parts if p.strip()]
    if len(parts) < 2:
        return None
    out = ['<div class="viz viz-flow">']
    for i, p in enumerate(parts):
        out.append(f'<span class="flow-step">{htmllib.escape(p)}</span>')
        if i < len(parts) - 1:
            out.append('<span class="flow-arrow" aria-hidden="true">→</span>')
    out.append('</div>')
    return "".join(out)


def try_vertical_arrow_funnel(text: str) -> str | None:
    """
    Match:
        Impressions
            │ (CTR)
            ▼
        Clicks
            │ (landing page view rate)
            ▼
        Landing Page Views
        ...
    """
    raw = htmllib.unescape(text).strip("\n")
    if "▼" not in raw:
        return None
    lines = raw.split("\n")
    stages = []
    current_stage = None
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped == "▼":
            continue
        if stripped.startswith("│"):
            m = re.search(r"\(([^)]+)\)", stripped)
            if m and current_stage is not None:
                stages[-1] = (stages[-1][0], m.group(1))
        else:
            stages.append((stripped, None))
            current_stage = stripped
    if len(stages) < 3:
        return None
    out = ['<div class="viz viz-vflow">']
    out.append('<div class="viz-label">Conversion Path</div>')
    out.append('<div class="vflow-rows">')
    for i, (stage, note) in enumerate(stages):
        is_last = i == len(stages) - 1
        out.append(f'<div class="vflow-stage{" is-last" if is_last else ""}">')
        out.append(f'<span class="vflow-dot"></span>')
        out.append(f'<span class="vflow-label">{htmllib.escape(stage)}</span>')
        out.append('</div>')
        if note and not is_last:
            out.append(f'<div class="vflow-edge"><span class="vflow-rate">{htmllib.escape(note)}</span></div>')
        elif not is_last:
            out.append('<div class="vflow-edge"></div>')
    out.append('</div></div>')
    return "\n".join(out)


def try_box_card(text: str) -> str | None:
    """
    Match multi-section box-drawn cards:
        ┌─────────────┐
        │ TITLE ...    │
        ├─────────────┤
        │ SECTION …    │
        │   line       │
        ├─────────────┤
        │ SECTION      │
        │   line       │
        └─────────────┘
    """
    raw = htmllib.unescape(text).strip("\n")
    if "┌" not in raw or "└" not in raw:
        return None
    # Each ├ divides sections; │ starts content lines
    # Strip box borders
    sections = []
    current = []
    for line in raw.split("\n"):
        if line.strip().startswith(("┌", "├", "└")):
            if current:
                sections.append(current)
                current = []
            continue
        # Strip leading/trailing │
        s = line.strip()
        if s.startswith("│"):
            s = s[1:]
        if s.endswith("│"):
            s = s[:-1]
        s = s.rstrip()
        if s.strip():
            current.append(s)
    if current:
        sections.append(current)
    if not sections or len(sections) < 2:
        return None
    # First section = title row(s); rest = body sections
    title_lines = sections[0]
    body_sections = sections[1:]
    out = ['<div class="viz viz-card">']
    out.append('<div class="card-head">')
    for t in title_lines:
        # Bolden labels like "KEY: value"
        out.append(f'<div class="card-head-line">{htmllib.escape(t.strip())}</div>')
    out.append('</div>')
    for sec in body_sections:
        if not sec:
            continue
        first = sec[0].strip()
        rest = sec[1:]
        title_match = re.match(r"^([A-Z][A-Z0-9 ()/-]{2,})$", first)
        out.append('<div class="card-section">')
        if title_match:
            out.append(f'<div class="card-sec-title">{htmllib.escape(first)}</div>')
            body_lines = rest
        else:
            body_lines = sec
        if body_lines:
            out.append('<ul class="card-sec-list">')
            for b in body_lines:
                bt = b.strip()
                if bt:
                    out.append(f'<li>{htmllib.escape(bt)}</li>')
            out.append('</ul>')
        out.append('</div>')
    out.append('</div>')
    return "\n".join(out)


def try_histogram_buckets(text: str) -> str | None:
    """
    Match frequency-bucket histograms:
        0 impressions  ██████████████████████   42%  (X.X M users)
        1 impression   ████████████             24%  ...
    """
    raw = htmllib.unescape(text).strip("\n")
    if "█" not in raw:
        return None
    lines = [l for l in raw.split("\n") if l.strip()]
    if len(lines) < 3:
        return None
    row_re = re.compile(
        r"^\s*(?P<label>[^█\[]+?)\s+(?P<bar>█+)\s+"
        r"(?P<pct>[\d.]+%)?\s*"
        r"(?:\((?P<note>[^)]*)\))?\s*$"
    )
    rows = []
    for line in lines:
        m = row_re.match(line)
        if not m:
            return None
        rows.append((m.group("label").strip(),
                     len(m.group("bar")),
                     (m.group("pct") or "").strip(),
                     (m.group("note") or "").strip()))
    if not rows:
        return None
    top = max(r[1] for r in rows) or 1
    out = ['<div class="viz viz-histogram">']
    out.append('<div class="viz-label">Distribution</div>')
    for label, barlen, pct, note in rows:
        w = 100.0 * barlen / top
        out.append(
            f'<div class="hist-row" style="--w:{w:.3f}">'
            f'<span class="hist-label">{htmllib.escape(label)}</span>'
            f'<div class="hist-track"><div class="hist-bar"></div></div>'
            f'<span class="hist-value">{htmllib.escape(pct)}</span>'
            f'<span class="hist-note">{htmllib.escape(note)}</span>'
            f'</div>'
        )
    out.append('</div>')
    return "\n".join(out)


TRANSFORMS = [
    try_funnel_bar_chart,
    try_histogram_buckets,
    try_vertical_arrow_funnel,
    try_horizontal_arrow_flow,
    try_box_card,
    try_stage_ladder,
]


def transform_pre_block(match: re.Match) -> str:
    """Try each transform in order; return original if none match."""
    whole = match.group(0)
    attrs = match.group(1)
    # Extract the inner code text
    inner_match = re.match(r'\s*<code[^>]*>(.*?)</code>\s*', match.group(2), re.DOTALL)
    inner = inner_match.group(1) if inner_match else match.group(2)
    # Skip SQL / code blocks — transform only plaintext art
    if 'class="sql"' in attrs or 'class="python"' in attrs or 'class="shell"' in attrs:
        return whole
    for fn in TRANSFORMS:
        try:
            result = fn(inner)
        except Exception:
            continue
        if result:
            return result
    return whole


def apply(text: str) -> str:
    return PRE_RE_ALT.sub(transform_pre_block, text)
