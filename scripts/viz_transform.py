#!/usr/bin/env python3
"""
viz_transform.py — convert EVERY ASCII/box-drawing diagram in the
combined article HTML into clean HTML visualizations.

Goal: zero raw ASCII art in the rendered article. Specific pattern
detectors run first; a universal fallback handles anything else.
"""
from __future__ import annotations

import html as htmllib
import re

PRE_RE_ALT = re.compile(r'<pre([^>]*)>(.*?)</pre>', re.DOTALL)
ASCII_CHARS = set("│┌└├┤┬┴┼─►▶▼█❧╔╗╚╝║")


def _inner_text(match_inner: str) -> str:
    """Extract raw text from a <code> child if present."""
    inner_match = re.match(r'\s*<code[^>]*>(.*?)</code>\s*', match_inner, re.DOTALL)
    return inner_match.group(1) if inner_match else match_inner


def _has_ascii_art(text: str) -> bool:
    return any(ch in text for ch in ASCII_CHARS)


def _parse_int(s: str) -> int | None:
    s = s.replace(",", "").strip()
    if re.fullmatch(r"\d+", s):
        return int(s)
    return None


# ─────────────────────────────────────────────────────────────────────
#  1. Funnel bar chart
# ─────────────────────────────────────────────────────────────────────
def try_funnel_bar_chart(text: str) -> str | None:
    raw = htmllib.unescape(text).strip("\n")
    lines = [l for l in raw.split("\n") if l.strip()]
    if len(lines) < 3:
        return None
    row_re = re.compile(
        r"^\s*(?P<label>.+?)\s+\[(?P<bar>[█▉▊▋▌▍▎▏ ]*)\][^\S\n]*"
        r"(?P<value>[\d,]+)"
        r"(?:[^\S\n]*\((?P<note>[^)]*)\))?\s*$"
    )
    rows = []
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
    out = ['<div class="viz viz-funnel"><div class="viz-label">Funnel</div><div class="funnel-rows">']
    for label, val, note in rows:
        pct = 100.0 * val / top
        out.append(
            f'<div class="funnel-row" style="--w:{pct:.3f}">'
            f'<span class="f-label">{htmllib.escape(label)}</span>'
            f'<div class="f-track"><div class="f-bar"></div></div>'
            f'<span class="f-value">{val:,}</span></div>'
        )
        if note:
            out.append(f'<div class="funnel-drop"><span class="drop-pct">{htmllib.escape(note)}</span></div>')
    out.append('</div></div>')
    return "\n".join(out)


# ─────────────────────────────────────────────────────────────────────
#  2. Vertical histogram (column bar chart)
#     │ █
#     │ █ █
#     │ █ █ █
#     │─────────
#       1  2  3  4+
# ─────────────────────────────────────────────────────────────────────
def try_vertical_histogram(text: str) -> str | None:
    raw = htmllib.unescape(text).strip("\n")
    if "█" not in raw:
        return None
    lines = raw.split("\n")
    # Identify the title (first non-bar line), the axis baseline (line of ─),
    # and the category row (the last line).
    title = None
    bar_lines = []
    axis_labels = None
    baseline_idx = None
    for i, ln in enumerate(lines):
        if not ln.strip():
            continue
        if "█" in ln:
            bar_lines.append(ln)
        elif re.match(r"^\s*[│|]?[─\-]{3,}", ln):
            baseline_idx = i
        elif baseline_idx is not None and re.search(r"\d", ln):
            axis_labels = ln
        elif title is None and bar_lines == []:
            title = ln.strip()
    if not bar_lines or not axis_labels:
        return None
    # Determine column positions from axis_labels (tokens separated by whitespace)
    cats = re.findall(r"\S+", axis_labels)
    if len(cats) < 2:
        return None
    # Count heights per column: for each column position, count how many bar_lines have █ at that position.
    # Use column indexes derived from the axis line.
    cat_positions = []
    pos = 0
    for cat in cats:
        idx = axis_labels.find(cat, pos)
        if idx == -1:
            return None
        cat_positions.append((cat, idx, idx + len(cat)))
        pos = idx + len(cat)
    # For each column, count bars by scanning each bar_line at the column's position window
    heights = []
    for cat, s, e in cat_positions:
        h = 0
        for bl in bar_lines:
            # Look for █ anywhere in [s-1, e+1] widened window
            window = bl[max(0, s - 1): min(len(bl), e + 1)]
            if "█" in window:
                h += 1
        heights.append((cat, h))
    max_h = max(h for _, h in heights) or 1
    out = ['<div class="viz viz-column-hist">']
    if title:
        out.append(f'<div class="viz-label">{htmllib.escape(title)}</div>')
    else:
        out.append('<div class="viz-label">Distribution</div>')
    out.append('<div class="ch-plot">')
    for cat, h in heights:
        pct = 100.0 * h / max_h
        out.append(
            f'<div class="ch-col">'
            f'<div class="ch-bar" style="--h:{pct:.2f}%"><span class="ch-count">{h}</span></div>'
            f'<div class="ch-label">{htmllib.escape(cat)}</div>'
            f'</div>'
        )
    out.append('</div></div>')
    return "\n".join(out)


# ─────────────────────────────────────────────────────────────────────
#  3. Histogram buckets (horizontal bars)
#     "0 imps    ████████  42%  (X M users)"
# ─────────────────────────────────────────────────────────────────────
def try_histogram_buckets(text: str) -> str | None:
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
        rows.append((m.group("label").strip(), len(m.group("bar")),
                     (m.group("pct") or "").strip(), (m.group("note") or "").strip()))
    if not rows:
        return None
    top = max(r[1] for r in rows) or 1
    out = ['<div class="viz viz-histogram"><div class="viz-label">Distribution</div>']
    for label, barlen, pct, note in rows:
        w = 100.0 * barlen / top
        out.append(
            f'<div class="hist-row" style="--w:{w:.3f}">'
            f'<span class="hist-label">{htmllib.escape(label)}</span>'
            f'<div class="hist-track"><div class="hist-bar"></div></div>'
            f'<span class="hist-value">{htmllib.escape(pct)}</span>'
            f'<span class="hist-note">{htmllib.escape(note)}</span></div>'
        )
    out.append('</div>')
    return "\n".join(out)


# ─────────────────────────────────────────────────────────────────────
#  4. Vertical arrow funnel (conservative — single-column only)
# ─────────────────────────────────────────────────────────────────────
def try_vertical_arrow_funnel(text: str) -> str | None:
    raw = htmllib.unescape(text).strip("\n")
    if "▼" not in raw:
        return None
    if any(x in raw for x in ("─►", "──►", "───►", "──▶")):
        return None
    if any(ch in raw for ch in "┌└├┤┬┴┼"):
        return None
    for ln in raw.split("\n"):
        if ln.count("│") > 1:
            return None
    lines = raw.split("\n")
    stages = []
    for line in lines:
        s = line.strip()
        if not s or s == "▼":
            continue
        if s.startswith("│"):
            m = re.search(r"\(([^)]+)\)", s)
            if m and stages:
                stages[-1] = (stages[-1][0], m.group(1))
            continue
        if s.count("[") > 1:
            return None
        stages.append((s, None))
    if not (3 <= len(stages) <= 12):
        return None
    out = ['<div class="viz viz-vflow"><div class="viz-label">Conversion Path</div><div class="vflow-rows">']
    for i, (stage, note) in enumerate(stages):
        is_last = i == len(stages) - 1
        out.append(f'<div class="vflow-stage{" is-last" if is_last else ""}">'
                   f'<span class="vflow-dot"></span>'
                   f'<span class="vflow-label">{htmllib.escape(stage)}</span></div>')
        if not is_last:
            if note:
                out.append(f'<div class="vflow-edge"><span class="vflow-rate">{htmllib.escape(note)}</span></div>')
            else:
                out.append('<div class="vflow-edge"></div>')
    out.append('</div></div>')
    return "\n".join(out)


# ─────────────────────────────────────────────────────────────────────
#  5. Horizontal arrow flow (single line)
# ─────────────────────────────────────────────────────────────────────
def try_horizontal_arrow_flow(text: str) -> str | None:
    raw = htmllib.unescape(text).strip()
    if not any(t in raw for t in ("─►", "──►", "──▶")):
        return None
    non_blank = [l for l in raw.split("\n") if l.strip()]
    if len(non_blank) != 1:
        return None
    if any(ch in raw for ch in "│┌└├┤┬┴┼▼█"):
        return None
    clean = re.sub(r"\s+", " ", raw)
    parts = re.split(r"\s*(?:─+►|──▶|──►|─►)\s*", clean)
    parts = [p.strip() for p in parts if p.strip()]
    if not (2 <= len(parts) <= 10):
        return None
    for p in parts:
        if len(p) > 80:
            return None
    out = ['<div class="viz viz-flow">']
    for i, p in enumerate(parts):
        out.append(f'<span class="flow-step">{htmllib.escape(p)}</span>')
        if i < len(parts) - 1:
            out.append('<span class="flow-arrow" aria-hidden="true">→</span>')
    out.append('</div>')
    return "".join(out)


# ─────────────────────────────────────────────────────────────────────
#  6. Hierarchy chain (A ── relation ── B ── relation ── C)
#     with optional descriptor lines below each node
# ─────────────────────────────────────────────────────────────────────
def try_hierarchy_chain(text: str) -> str | None:
    raw = htmllib.unescape(text).strip("\n")
    if "──" not in raw or "│" in raw or "┌" in raw:
        return None
    if "─►" in raw or "──►" in raw or "──▶" in raw:
        return None
    lines = raw.split("\n")
    first = next((l for l in lines if l.strip()), "")
    # Must contain at least 2 separators "──"
    if first.count("──") < 2:
        return None
    # Split header by ── sequences; tokens may include parenthetical relations like "1 : N"
    chain = [p.strip() for p in re.split(r"\s*─{2,}\s*", first) if p.strip()]
    if not (3 <= len(chain) <= 9):
        return None
    # Collect descriptor lines (lines that start with indentation under columns)
    descriptors: list[str] = []
    for ln in lines[1:]:
        if ln.strip():
            descriptors.append(ln.strip())
    # Separate primary nodes from relation labels: every odd-index token in `chain`
    # is a relation when it's short and parenthesised-ish; treat alternating.
    # Heuristic: relation tokens contain ':' or start with '(' or are &lt;20 chars of alpha/num.
    nodes: list[str] = []
    relations: list[str] = []
    for i, tok in enumerate(chain):
        if i % 2 == 0:
            nodes.append(tok)
        else:
            relations.append(tok)
    if len(nodes) < 2:
        return None
    out = ['<div class="viz viz-chain"><div class="viz-label">Hierarchy</div><div class="chain-row">']
    for i, node in enumerate(nodes):
        out.append(f'<div class="chain-node"><div class="chain-node-name">{htmllib.escape(node)}</div></div>')
        if i < len(nodes) - 1 and i < len(relations):
            out.append(f'<div class="chain-rel"><span class="chain-rel-line"></span>'
                       f'<span class="chain-rel-label">{htmllib.escape(relations[i])}</span></div>')
        elif i < len(nodes) - 1:
            out.append('<div class="chain-rel"><span class="chain-rel-line"></span></div>')
    out.append('</div>')
    if descriptors:
        out.append('<div class="chain-descriptors">')
        for d in descriptors:
            out.append(f'<div class="chain-descriptor">{htmllib.escape(d)}</div>')
        out.append('</div>')
    out.append('</div>')
    return "\n".join(out)


# ─────────────────────────────────────────────────────────────────────
#  7. Tradeoff triangle (CORRECTNESS / LATENCY / COST)
# ─────────────────────────────────────────────────────────────────────
def try_tradeoff_triangle(text: str) -> str | None:
    raw = htmllib.unescape(text).strip("\n")
    # Require three all-caps axis labels, connected by │ and ─
    axes = re.findall(r"\b([A-Z]{3,})\b", raw)
    axes = [a.strip() for a in axes if len(a.strip()) >= 3]
    # Dedupe while preserving order
    seen = set()
    uniq = []
    for a in axes:
        if a not in seen:
            seen.add(a)
            uniq.append(a)
    axes = uniq
    if len(axes) < 3:
        return None
    if "│" not in raw or "─" not in raw:
        return None
    # Extract bracketed descriptors from parens per axis block
    blocks = re.split(r"\n\s*\n", raw)
    notes_by_axis: dict[str, list[str]] = {}
    for a in axes[:3]:
        for block in blocks:
            if a in block:
                found = re.findall(r"\(([^)]+)\)", block)
                if found:
                    # Single paren with comma-separated can still show as list
                    items: list[str] = []
                    for f in found:
                        items.extend([p.strip() for p in f.split(",") if p.strip()])
                    notes_by_axis[a] = items
                    break
        notes_by_axis.setdefault(a, [])
    top, left, right = axes[0], axes[1], axes[2]
    out = [
        '<div class="viz viz-triangle"><div class="viz-label">Tradeoff Triangle</div>',
        '<div class="tri-wrap">',
        '  <svg class="tri-svg" viewBox="0 0 400 340" preserveAspectRatio="xMidYMid meet" aria-hidden="true">',
        '    <polygon points="200,30 60,300 340,300" fill="none" stroke="#c8d6e5" stroke-width="2"/>',
        '    <circle cx="200" cy="30"  r="7" fill="#2563a8"/>',
        '    <circle cx="60"  cy="300" r="7" fill="#2a7a4a"/>',
        '    <circle cx="340" cy="300" r="7" fill="#c44b2b"/>',
        '  </svg>',
        f'  <div class="tri-vertex tri-top"><div class="tri-axis">{htmllib.escape(top)}</div>',
        f'    <ul class="tri-notes">{"".join(f"<li>{htmllib.escape(n)}</li>" for n in notes_by_axis[top])}</ul></div>',
        f'  <div class="tri-vertex tri-left"><div class="tri-axis">{htmllib.escape(left)}</div>',
        f'    <ul class="tri-notes">{"".join(f"<li>{htmllib.escape(n)}</li>" for n in notes_by_axis[left])}</ul></div>',
        f'  <div class="tri-vertex tri-right"><div class="tri-axis">{htmllib.escape(right)}</div>',
        f'    <ul class="tri-notes">{"".join(f"<li>{htmllib.escape(n)}</li>" for n in notes_by_axis[right])}</ul></div>',
        '</div></div>',
    ]
    return "\n".join(out)


# ─────────────────────────────────────────────────────────────────────
#  8. Tree diagram (├ └ │ file trees & branching flows)
# ─────────────────────────────────────────────────────────────────────
def try_tree_diagram(text: str) -> str | None:
    raw = htmllib.unescape(text).strip("\n")
    if not any(ch in raw for ch in "├└"):
        return None
    lines = raw.split("\n")
    # Compute each line's depth (number of │ prefixes or indent/4)
    items = []
    first_line_handled = False
    for ln in lines:
        if not ln.strip():
            continue
        # Match leading branch prefix like "│   ├── " or "    └── "
        m = re.match(r"^(?P<prefix>[\s│├└─]*)", ln)
        prefix = m.group("prefix") if m else ""
        content = ln[len(prefix):].strip()
        # Depth = count of │ in prefix + (1 if this line starts with ├ or └)
        depth = prefix.count("│")
        if "├" in prefix or "└" in prefix:
            depth += 1
        if not content and prefix.strip() == "│":
            continue
        if not content:
            continue
        items.append((depth, content))
    if len(items) < 2:
        return None
    # Remove rows that are pure connector lines (like "│")
    items = [(d, c) for (d, c) in items if c and not re.fullmatch(r"[│─]+", c)]
    if len(items) < 2:
        return None
    # Normalize depths so first item has depth 0
    min_d = min(d for d, _ in items)
    items = [(d - min_d, c) for (d, c) in items]
    return _emit_nested_list(items, "viz-tree", "Structure", "tree-root", "tree-sub", "tree-node", "tree-glyph", "tree-text")


# ─────────────────────────────────────────────────────────────────────
#  9. Flow with branches:
#     client ─► spine ─► processor
#                          │
#                          ├─ branch 1
#                          └─ branch 2
# ─────────────────────────────────────────────────────────────────────
def try_flow_with_branches(text: str) -> str | None:
    raw = htmllib.unescape(text).strip("\n")
    if not any(t in raw for t in ("─►", "──►", "──▶")):
        return None
    if not any(ch in raw for ch in "├└"):
        return None
    lines = raw.split("\n")
    chain_line = None
    branches = []
    current_branch = None
    for ln in lines:
        s = ln.strip()
        if not s:
            continue
        if chain_line is None and any(t in s for t in ("─►", "──►", "──▶")):
            chain_line = s
            continue
        # Branch row — starts with ├ or └ after optional │
        m = re.search(r"(?:├|└)─?\s*(?P<label>.+?)\s*$", s)
        if m:
            current_branch = m.group("label").strip()
            branches.append(current_branch)
        # Otherwise a continuation line under a branch — skip for now
    if not chain_line:
        return None
    # Extract chain parts
    parts = re.split(r"\s*(?:─+►|──▶|──►|─►)\s*", chain_line)
    parts = [p.strip() for p in parts if p.strip()]
    if len(parts) < 2:
        return None
    last = parts[-1]
    out = ['<div class="viz viz-flow-branch"><div class="viz-label">Pipeline Flow</div>']
    out.append('<div class="fb-chain">')
    for i, p in enumerate(parts):
        out.append(f'<span class="fb-step">{htmllib.escape(p)}</span>')
        if i < len(parts) - 1:
            out.append('<span class="fb-arrow">→</span>')
    out.append('</div>')
    if branches:
        out.append(f'<div class="fb-branch-from">from <strong>{htmllib.escape(last)}</strong></div>')
        out.append('<div class="fb-branches">')
        for b in branches:
            tone = 'is-pass' if any(k in b.lower() for k in ('pass', 'success', 'ok', 'real-time', 'daily')) else 'is-alt'
            if any(k in b.lower() for k in ('fail', 'error', 'page', 'block')):
                tone = 'is-fail'
            out.append(f'<div class="fb-branch {tone}"><span class="fb-branch-dot"></span>{htmllib.escape(b)}</div>')
        out.append('</div>')
    out.append('</div>')
    return "\n".join(out)


# ─────────────────────────────────────────────────────────────────────
#  10. Box card (dashboard-like) — already implemented
# ─────────────────────────────────────────────────────────────────────
def try_box_card(text: str) -> str | None:
    raw = htmllib.unescape(text).strip("\n")
    if "┌" not in raw or "└" not in raw:
        return None
    sections = []
    current = []
    for line in raw.split("\n"):
        s = line.strip()
        if s.startswith(("┌", "├", "└")):
            if current:
                sections.append(current)
                current = []
            continue
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
    title_lines = sections[0]
    body_sections = sections[1:]
    out = ['<div class="viz viz-card"><div class="card-head">']
    for t in title_lines:
        out.append(f'<div class="card-head-line">{htmllib.escape(t.strip())}</div>')
    out.append('</div>')
    for sec in body_sections:
        if not sec:
            continue
        first = sec[0].strip()
        title_match = re.match(r"^([A-Z][A-Z0-9 ()/-]{2,})$", first)
        out.append('<div class="card-section">')
        if title_match:
            out.append(f'<div class="card-sec-title">{htmllib.escape(first)}</div>')
            body_lines = sec[1:]
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


# ─────────────────────────────────────────────────────────────────────
#  11. Stage ladder (labels + numbers)
# ─────────────────────────────────────────────────────────────────────
def try_stage_ladder(text: str) -> str | None:
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
        rows.append((m.group("label").strip(), val, (m.group("note") or "").strip(), "$" in line))
    if not rows:
        return None
    top = max(r[1] for r in rows) or 1
    out = ['<div class="viz viz-ladder"><div class="viz-label">Stage Breakdown</div><div class="ladder-rows">']
    for label, val, note, is_money in rows:
        pct = 100.0 * val / top
        num = f"${val:,.0f}" if is_money else f"{val:,.0f}"
        out.append(
            f'<div class="ladder-row" style="--w:{pct:.3f}">'
            f'<span class="l-label">{htmllib.escape(label)}</span>'
            f'<div class="l-track"><div class="l-bar"></div></div>'
            f'<span class="l-value">{num}</span>'
            f'<span class="l-note">{htmllib.escape(note)}</span></div>'
        )
    out.append('</div></div>')
    return "\n".join(out)


# ─────────────────────────────────────────────────────────────────────
#  Universal fallback: any remaining ASCII becomes a clean "schema"
#  block — strip box-drawing characters; render as an indented list
#  with subtle guide lines via CSS. Never outputs raw ASCII art.
# ─────────────────────────────────────────────────────────────────────
def fallback_generic_ascii(text: str) -> str | None:
    raw = htmllib.unescape(text).strip("\n")
    if not _has_ascii_art(raw):
        return None
    lines = raw.split("\n")
    items = []
    for ln in lines:
        if not ln.strip():
            continue
        # Measure depth by count of │ in prefix OR leading spaces
        m = re.match(r"^(?P<prefix>[\s│├└─┼┬┴┤┌└ ]*)(?P<rest>.*)$", ln)
        prefix = m.group("prefix") if m else ""
        rest = (m.group("rest") if m else ln).strip()
        if not rest and prefix.strip(" │─┌└├┤┬┴┼") == "":
            continue
        # Clean remaining box chars from the content itself
        rest = re.sub(r"[│┌└├┤┬┴┼─►▶▼█╔╗╚╝║]+", " ", rest).strip()
        if not rest:
            continue
        depth = prefix.count("│")
        if "├" in prefix or "└" in prefix:
            depth += 1
        # Also fallback to leading spaces / 4
        if depth == 0:
            lead = len(ln) - len(ln.lstrip())
            depth = lead // 4
        items.append((depth, rest))
    if not items:
        return None
    min_d = min(d for d, _ in items)
    items = [(d - min_d, c) for (d, c) in items]
    return _emit_nested_list(items, "viz-schema", "Diagram", "schema-root", "schema-sub", "schema-node", "schema-glyph", "schema-text")


def _emit_nested_list(items, block_cls, label, root_cls, sub_cls, node_cls, glyph_cls, text_cls) -> str:
    """Emit a clean nested <ul> list from (depth, text) items. Balanced tags guaranteed."""
    out = [f'<div class="viz {block_cls}"><div class="viz-label">{label}</div><ul class="{root_cls}">']
    cur_depth = 0
    has_open_li = False
    sub_stack: list[int] = []  # depths at which we've opened <ul class=sub>

    def emit_li(c: str) -> str:
        return (f'<li class="{node_cls}"><span class="{glyph_cls}"></span>'
                f'<span class="{text_cls}">{htmllib.escape(c)}</span>')

    for (d, c) in items:
        if not has_open_li:
            # First item OR just descended and closed — open fresh at current stack level
            out.append(emit_li(c))
            has_open_li = True
            cur_depth = d
            continue
        if d == cur_depth:
            # Sibling: close current </li>, open new <li>
            out.append('</li>')
            out.append(emit_li(c))
            continue
        if d > cur_depth:
            # Deeper: leave parent <li> open, open <ul sub>
            out.append(f'<ul class="{sub_cls}">')
            sub_stack.append(cur_depth)
            out.append(emit_li(c))
            cur_depth = d
            continue
        # d < cur_depth: ascend
        out.append('</li>')  # close current leaf <li>
        while sub_stack and sub_stack[-1] >= d:
            out.append('</ul></li>')  # close sub-ul and its parent <li>
            cur_depth = sub_stack.pop()
        out.append(emit_li(c))
        cur_depth = d

    if has_open_li:
        out.append('</li>')
    while sub_stack:
        out.append('</ul></li>')
        sub_stack.pop()
    out.append('</ul></div>')
    return "\n".join(out)


# Transform chain: specific patterns first, universal fallback last.
TRANSFORMS = [
    try_funnel_bar_chart,
    try_vertical_histogram,
    try_histogram_buckets,
    try_flow_with_branches,
    try_vertical_arrow_funnel,
    try_hierarchy_chain,
    try_tradeoff_triangle,
    try_horizontal_arrow_flow,
    try_tree_diagram,
    try_box_card,
    try_stage_ladder,
    fallback_generic_ascii,
]


def transform_pre_block(match: re.Match) -> str:
    whole = match.group(0)
    attrs = match.group(1)
    inner_match = re.match(r'\s*<code[^>]*>(.*?)</code>\s*', match.group(2), re.DOTALL)
    inner = inner_match.group(1) if inner_match else match.group(2)
    # Skip code blocks with explicit language class — those are real code
    if any(cls in attrs for cls in ('class="sql"', 'class="python"', 'class="shell"', 'class="bash"',
                                     'class="javascript"', 'class="yaml"', 'class="json"')):
        return whole
    # If the block has no ASCII art at all AND no structure we recognise,
    # leave it as-is (regular plain-text pre)
    plain = htmllib.unescape(inner)
    if not _has_ascii_art(plain) and "█" not in plain:
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
