#!/usr/bin/env python3
"""Generate the inline-SVG charts for articles/can-you-really-afford-the-bay-area.html.

    python scripts/make_bay_area_charts.py            # print all charts
    python scripts/make_bay_area_charts.py --write    # write scratch/bay-area-charts.svg.txt

Every value here is copied from the two model scripts that back the article:
scripts/bay_area_affordability_model.py and scripts/bay_area_household_model.py.
Change a number there, re-run both, then re-run this and re-paste.

Palette is NOT hand-picked. The article's editorial ink colours fail a categorical
chart palette (the blue and green fall under the OKLCH chroma floor and green/red
sit at deltaE 6.6 under deuteranopia), so charts use a validated split instead:

  series (nominal bars) #2E74B5   emphasis #A32B22
  ordinal ramp          #93B6D4 -> #3D7DB5 -> #1B4E7A

Both pass all six checks of the dataviz validator on the #FCFBF7 surface. The
article's original #23527C stays where it belongs: line art and text.
"""
from __future__ import annotations
import sys

# ---------------------------------------------------------------- tokens ----
SURFACE   = "#FCFBF7"
INK       = "#14171C"
INK_2     = "#464C55"
INK_3     = "#787F8A"
GRID      = "#E6E2D7"
RULE      = "#D6D2C6"
SERIES    = "#2E74B5"   # validated
EMPHASIS  = "#A32B22"   # validated against SERIES
RAMP      = ["#93B6D4", "#3D7DB5", "#1B4E7A"]   # validated ordinal, light -> dark
MONO      = "IBM Plex Mono, ui-monospace, monospace"
SANS      = "IBM Plex Sans, -apple-system, sans-serif"

BAR_MAX   = 24     # mark spec: bars never thicker than 24px
R         = 4      # rounded data-end


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def col_bar(x, y, w, h, fill, rounded=True):
    """A column: rounded 4px at the data-end (top), square at the baseline."""
    if h <= 0.5:
        return ""
    r = min(R, w / 2, h)
    if not rounded or h < r * 1.2:
        return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="{fill}"/>'
    return (f'<path d="M{x:.1f} {y + h:.1f} L{x:.1f} {y + r:.1f} '
            f'Q{x:.1f} {y:.1f} {x + r:.1f} {y:.1f} L{x + w - r:.1f} {y:.1f} '
            f'Q{x + w:.1f} {y:.1f} {x + w:.1f} {y + r:.1f} L{x + w:.1f} {y + h:.1f} Z" fill="{fill}"/>')


def row_bar(x, y, w, h, fill):
    """A horizontal bar: rounded at the data-end (right), square at the baseline."""
    if w <= 0.5:
        return ""
    r = min(R, h / 2, w)
    return (f'<path d="M{x:.1f} {y:.1f} L{x + w - r:.1f} {y:.1f} '
            f'Q{x + w:.1f} {y:.1f} {x + w:.1f} {y + r:.1f} L{x + w:.1f} {y + h - r:.1f} '
            f'Q{x + w:.1f} {y + h:.1f} {x + w - r:.1f} {y + h:.1f} L{x:.1f} {y + h:.1f} Z" fill="{fill}"/>')


def frame(vb_w, vb_h, title, desc, cid, body):
    return (f'<svg viewBox="0 0 {vb_w} {vb_h}" role="img" aria-labelledby="{cid}-t {cid}-d" '
            f'preserveAspectRatio="xMidYMid meet" class="chart">\n'
            f'  <title id="{cid}-t">{esc(title)}</title>\n'
            f'  <desc id="{cid}-d">{esc(desc)}</desc>\n'
            f'  <rect width="{vb_w}" height="{vb_h}" fill="{SURFACE}"/>\n'
            f'{body}\n</svg>')


# ============================================================ CHART 1 ========
def chart_price_to_income():
    """Job: change over time, one series, one point is the story -> columns + emphasis."""
    data = [(1960, 2.6), (1970, 2.2), (1980, 4.8), (1990, 5.9),
            (2000, 7.7), (2010, 7.0), (2020, 11.3), (2026, 13.1)]
    W, H = 1000, 430
    L, Rm, T, B = 62, 26, 34, 62
    pw, ph = W - L - Rm, H - T - B
    ymax = 14
    band = pw / len(data)
    bw = min(BAR_MAX, band * 0.42)
    o = []
    for gv in range(0, ymax + 1, 2):
        y = T + ph - gv / ymax * ph
        o.append(f'  <line x1="{L}" y1="{y:.1f}" x2="{L + pw}" y2="{y:.1f}" stroke="{GRID}" stroke-width="1"/>')
        o.append(f'  <text x="{L - 12}" y="{y + 4:.1f}" text-anchor="end" font-family="{MONO}" '
                 f'font-size="11" fill="{INK_3}">{gv}</text>')
    for i, (yr, v) in enumerate(data):
        cx = L + band * i + band / 2
        h = v / ymax * ph
        y = T + ph - h
        emph = yr == 2026
        o.append(f'  <g class="bar" data-label="{yr}" data-value="{v} years of income">')
        o.append('  ' + col_bar(cx - bw / 2, y, bw, h, EMPHASIS if emph else SERIES))
        o.append(f'    <rect x="{cx - band / 2:.1f}" y="{T}" width="{band:.1f}" height="{ph}" fill="transparent"/>')
        o.append('  </g>')
        o.append(f'  <text x="{cx:.1f}" y="{T + ph + 24}" text-anchor="middle" font-family="{MONO}" '
                 f'font-size="12" fill="{EMPHASIS if emph else INK_2}">{yr}</text>')
        # label selectively: the two ends and the low point
        if yr in (1960, 1970, 2026):
            o.append(f'  <text x="{cx:.1f}" y="{y - 10:.1f}" text-anchor="middle" font-family="{SANS}" '
                     f'font-size="13" font-weight="600" fill="{INK}">{v}</text>')
    o.append(f'  <line x1="{L}" y1="{T + ph}" x2="{L + pw}" y2="{T + ph}" stroke="{RULE}" stroke-width="1.4"/>')
    o.append(f'  <text x="{L}" y="20" font-family="{MONO}" font-size="11" letter-spacing="1.6" '
             f'fill="{INK_3}">YEARS OF MEDIAN HOUSEHOLD INCOME TO BUY THE HOUSE</text>')
    o.append(f'  <text x="{W - Rm}" y="{H - 16}" text-anchor="end" font-family="{SANS}" font-size="12" '
             f'fill="{INK_3}">Santa Clara County &#183; representative four-bedroom</text>')
    return frame(W, H, "House price divided by median household income, 1960 to 2026",
                 "A column chart of the price-to-income ratio for the representative four-bedroom house. "
                 "It runs 2.6 in 1960, 2.2 in 1970, 4.8 in 1980, 5.9 in 1990, 7.7 in 2000, 7.0 in 2010, "
                 "11.3 in 2020, and 13.1 in 2026, with the 2026 column highlighted.", "c1", "\n".join(o))


# ============================================================ CHART 2 ========
def chart_burden_composition():
    """Job: part-to-whole over time, segments have a natural order -> ordinal stack."""
    # (year, P&I, property tax, insurance + maintenance) as % of median household income
    data = [(1960, 14.8, 6.4, 7.0), (1970, 16.3, 5.5, 6.6), (1980, 53.4, 6.0, 8.3),
            (1990, 50.5, 7.4, 7.7), (2000, 54.8, 9.7, 7.1), (2010, 34.9, 8.8, 7.9),
            (2020, 46.4, 14.1, 6.8), (2026, 81.5, 16.4, 6.4)]
    W, H = 1000, 470
    L, Rm, T, B = 62, 26, 74, 62
    pw, ph = W - L - Rm, H - T - B
    ymax = 110
    band = pw / len(data)
    bw = min(BAR_MAX, band * 0.42)
    GAP = 2  # surface gap between stacked segments
    o = []
    for gv in range(0, ymax + 1, 20):
        y = T + ph - gv / ymax * ph
        o.append(f'  <line x1="{L}" y1="{y:.1f}" x2="{L + pw}" y2="{y:.1f}" stroke="{GRID}" stroke-width="1"/>')
        o.append(f'  <text x="{L - 12}" y="{y + 4:.1f}" text-anchor="end" font-family="{MONO}" '
                 f'font-size="11" fill="{INK_3}">{gv}&#37;</text>')
    # the 100%-of-income line: the moment housing costs the whole paycheque
    y100 = T + ph - 100 / ymax * ph
    o.append(f'  <line x1="{L}" y1="{y100:.1f}" x2="{L + pw}" y2="{y100:.1f}" stroke="{EMPHASIS}" stroke-width="1.2"/>')
    o.append(f'  <text x="{L + 6}" y="{y100 - 8:.1f}" font-family="{MONO}" font-size="10.5" '
             f'letter-spacing="1.2" fill="{EMPHASIS}">100&#37; OF GROSS INCOME</text>')
    names = ["Mortgage principal &amp; interest", "Property tax", "Insurance &amp; upkeep"]
    for i, (yr, pi, tax, up) in enumerate(data):
        cx = L + band * i + band / 2
        total = pi + tax + up
        base = T + ph
        for seg, val in enumerate((pi, tax, up)):
            h = val / ymax * ph
            base -= h
            o.append(f'  <g class="bar" data-label="{yr} &#183; {names[seg]}" data-value="{val:.1f}&#37; of income">')
            o.append('  ' + col_bar(cx - bw / 2, base, bw, h - GAP if h > GAP * 2 else h,
                                    RAMP[2 - seg], rounded=(seg == 2)))
            o.append('  </g>')
        o.append(f'  <rect x="{cx - band / 2:.1f}" y="{T}" width="{band:.1f}" height="{ph}" fill="transparent"/>')
        o.append(f'  <text x="{cx:.1f}" y="{T + ph + 24}" text-anchor="middle" font-family="{MONO}" '
                 f'font-size="12" fill="{EMPHASIS if yr == 2026 else INK_2}">{yr}</text>')
        if yr in (1960, 2026):
            ty = T + ph - total / ymax * ph - 12
            o.append(f'  <text x="{cx:.1f}" y="{ty:.1f}" text-anchor="middle" font-family="{SANS}" '
                     f'font-size="13" font-weight="600" fill="{INK}">{total:.0f}&#37;</text>')
    o.append(f'  <line x1="{L}" y1="{T + ph}" x2="{L + pw}" y2="{T + ph}" stroke="{RULE}" stroke-width="1.4"/>')
    o.append(f'  <text x="{L}" y="20" font-family="{MONO}" font-size="11" letter-spacing="1.6" '
             f'fill="{INK_3}">TOTAL ANNUAL HOUSING COST, AS A SHARE OF MEDIAN HOUSEHOLD INCOME</text>')
    # legend (>= 2 series, so always present)
    lx = L
    for seg, nm in enumerate(names):
        o.append(f'  <rect x="{lx}" y="34" width="11" height="11" rx="2" fill="{RAMP[2 - seg]}"/>')
        o.append(f'  <text x="{lx + 17}" y="44" font-family="{SANS}" font-size="12.5" fill="{INK_2}">{nm}</text>')
        lx += 26 + len(nm.replace("&amp;", "&")) * 6.9
    return frame(W, H, "What the housing bill is made of, 1960 to 2026",
                 "A stacked column chart showing total annual housing cost as a share of median household "
                 "income, split into mortgage principal and interest, property tax, and insurance plus "
                 "upkeep. The total runs 28 percent in 1960 and 104 percent in 2026, crossing the "
                 "100-percent-of-income line in the final column.", "c2", "\n".join(o))


# ============================================================ CHART 3 ========
def chart_where_money_goes():
    """Job: compare magnitude across nominal categories -> one hue for every bar."""
    data = [("The future (saving)", 80000), ("Children", 35500), ("Housing, non-mortgage", 26850),
            ("Food", 25400), ("Transport", 21600), ("Lifestyle", 20000),
            ("Family &amp; obligation", 18300), ("Healthcare", 17000)]
    W = 1000
    L, Rm, T, B = 210, 96, 52, 46
    rowh, gap = 30, 12
    H = T + len(data) * (rowh + gap) + B
    pw = W - L - Rm
    xmax = 84000
    o = []
    for gv in range(0, xmax + 1, 20000):
        x = L + gv / xmax * pw
        o.append(f'  <line x1="{x:.1f}" y1="{T - 10}" x2="{x:.1f}" y2="{T + len(data) * (rowh + gap) - gap + 6}" '
                 f'stroke="{GRID}" stroke-width="1"/>')
        o.append(f'  <text x="{x:.1f}" y="{T + len(data) * (rowh + gap) + 18}" text-anchor="middle" '
                 f'font-family="{MONO}" font-size="11" fill="{INK_3}">${gv // 1000}k</text>')
    for i, (nm, v) in enumerate(data):
        y = T + i * (rowh + gap)
        bh = min(BAR_MAX, rowh)
        by = y + (rowh - bh) / 2
        w = v / xmax * pw
        o.append(f'  <g class="bar" data-label="{nm}" data-value="${v:,} a year">')
        o.append('  ' + row_bar(L, by, w, bh, SERIES))
        o.append(f'    <rect x="0" y="{y}" width="{W}" height="{rowh}" fill="transparent"/>')
        o.append('  </g>')
        o.append(f'  <text x="{L - 14}" y="{y + rowh / 2 + 4.5:.1f}" text-anchor="end" font-family="{SANS}" '
                 f'font-size="13.5" fill="{INK_2}">{nm}</text>')
        o.append(f'  <text x="{L + w + 10:.1f}" y="{y + rowh / 2 + 4.5:.1f}" font-family="{SANS}" font-size="13" '
                 f'font-weight="600" fill="{INK}">${v:,}</text>')
    o.append(f'  <line x1="{L}" y1="{T - 10}" x2="{L}" y2="{T + len(data) * (rowh + gap) - gap + 6}" '
             f'stroke="{RULE}" stroke-width="1.4"/>')
    o.append(f'  <text x="0" y="20" font-family="{MONO}" font-size="11" letter-spacing="1.6" '
             f'fill="{INK_3}">A TYPICAL YEAR FOR A FAMILY OF FOUR, EXCLUDING MORTGAGE AND PROPERTY TAX</text>')
    o.append(f'  <text x="0" y="38" font-family="{SANS}" font-size="12.5" fill="{INK_3}">'
             f'The largest line is the only one you are allowed to skip.</text>')
    return frame(W, H, "Where a Santa Clara County family's money goes in a typical year",
                 "A horizontal bar chart of eight annual budget categories, excluding mortgage and property "
                 "tax. Saving for the future is the largest at $80,000, ahead of children at $35,500, "
                 "non-mortgage housing at $26,850, food at $25,400, transport at $21,600, lifestyle at "
                 "$20,000, family obligations at $18,300 and healthcare at $17,000.", "c3", "\n".join(o))


# ============================================================ CHART 4 ========
def chart_cash_runway():
    """Job: magnitude against a fixed target -> bars + a threshold rule."""
    data = [("A &#183; $200K, renting", 3.4), ("B &#183; $300K, $1.4M home", 3.7),
            ("C &#183; $400K, $1.8M home", 5.5), ("D &#183; $500K, $2.3M home", 5.6),
            ("E &#183; $700K, $3.0M home", 9.3)]
    W = 1000
    L, Rm, T, B = 228, 86, 66, 54
    rowh, gap = 32, 14
    H = T + len(data) * (rowh + gap) + B
    pw = W - L - Rm
    xmax = 20
    o = []
    for gv in range(0, xmax + 1, 4):
        x = L + gv / xmax * pw
        o.append(f'  <line x1="{x:.1f}" y1="{T - 12}" x2="{x:.1f}" y2="{T + len(data) * (rowh + gap) - gap + 6}" '
                 f'stroke="{GRID}" stroke-width="1"/>')
        o.append(f'  <text x="{x:.1f}" y="{T + len(data) * (rowh + gap) + 18}" text-anchor="middle" '
                 f'font-family="{MONO}" font-size="11" fill="{INK_3}">{gv}</text>')
    xt = L + 18 / xmax * pw
    bottom = T + len(data) * (rowh + gap) - gap + 6
    o.append(f'  <line x1="{xt:.1f}" y1="{T - 26}" x2="{xt:.1f}" y2="{bottom}" stroke="{EMPHASIS}" stroke-width="1.4"/>')
    o.append(f'  <text x="{xt - 8:.1f}" y="{T - 32}" text-anchor="end" font-family="{MONO}" font-size="10.5" '
             f'letter-spacing="1.2" fill="{EMPHASIS}">THE 18-MONTH SHOCK</text>')
    for i, (nm, v) in enumerate(data):
        y = T + i * (rowh + gap)
        bh = min(BAR_MAX, rowh)
        by = y + (rowh - bh) / 2
        w = v / xmax * pw
        o.append(f'  <g class="bar" data-label="{nm}" data-value="{v} months of essentials in cash">')
        o.append('  ' + row_bar(L, by, w, bh, SERIES))
        o.append(f'    <rect x="0" y="{y}" width="{W}" height="{rowh}" fill="transparent"/>')
        o.append('  </g>')
        # the shortfall, drawn as what is missing rather than what is held
        o.append(f'  <line x1="{L + w:.1f}" y1="{by + bh / 2:.1f}" x2="{xt:.1f}" y2="{by + bh / 2:.1f}" '
                 f'stroke="{EMPHASIS}" stroke-width="1" stroke-dasharray="2 4" opacity="0.55"/>')
        o.append(f'  <text x="{L - 14}" y="{y + rowh / 2 + 4.5:.1f}" text-anchor="end" font-family="{SANS}" '
                 f'font-size="13" fill="{INK_2}">{nm}</text>')
        o.append(f'  <text x="{L + w + 10:.1f}" y="{y + rowh / 2 + 4.5:.1f}" font-family="{SANS}" font-size="13" '
                 f'font-weight="600" fill="{INK}">{v}</text>')
    o.append(f'  <line x1="{L}" y1="{T - 12}" x2="{L}" y2="{bottom}" stroke="{RULE}" stroke-width="1.4"/>')
    o.append(f'  <text x="0" y="20" font-family="{MONO}" font-size="11" letter-spacing="1.6" '
             f'fill="{INK_3}">MONTHS OF ESSENTIAL SPENDING COVERED BY CASH</text>')
    o.append(f'  <text x="0" y="38" font-family="{SANS}" font-size="12.5" fill="{INK_3}">'
             f'Every household falls short of the shock, and the gap barely narrows as income rises.</text>')
    o.append(f'  <text x="{W - Rm + 10}" y="{T + len(data) * (rowh + gap) + 18}" font-family="{SANS}" '
             f'font-size="11.5" fill="{INK_3}">months</text>')
    return frame(W, H, "Months of essential spending each household can cover in cash",
                 "A horizontal bar chart of cash runway for five households, from 3.4 months on $200,000 "
                 "to 9.3 months on $700,000, all of them short of the 18-month line marking the length of "
                 "the stress-test shock. A dashed segment shows each household's shortfall.", "c4", "\n".join(o))


# ============================================================ CHART 5 ========
def chart_years_of_freedom():
    """Job: two headline magnitudes, the comparison IS the point -> runway bars."""
    data = [("Household A", "$600K income &#183; $3.0M house &#183; $3.2M net worth", 1.4, EMPHASIS),
            ("Household B", "$300K income &#183; $1.4M house &#183; $3.3M net worth", 10.5, SERIES)]
    W, H = 1000, 384
    L, Rm, T = 168, 104, 96
    rowh, gap = 40, 58
    pw = W - L - Rm
    xmax = 12
    o = []
    # +34 so the tick row clears the sub-label sitting under the last bar
    bottom = T + len(data) * (rowh + gap) - gap + 34
    for gv in range(0, xmax + 1, 2):
        x = L + gv / xmax * pw
        o.append(f'  <line x1="{x:.1f}" y1="{T - 14}" x2="{x:.1f}" y2="{bottom}" stroke="{GRID}" stroke-width="1"/>')
        o.append(f'  <text x="{x:.1f}" y="{bottom + 22}" text-anchor="middle" font-family="{MONO}" '
                 f'font-size="11" fill="{INK_3}">{gv}</text>')
    for i, (nm, sub, v, fill) in enumerate(data):
        y = T + i * (rowh + gap)
        bh = min(BAR_MAX, rowh)
        by = y + (rowh - bh) / 2
        w = v / xmax * pw
        o.append(f'  <g class="bar" data-label="{nm}" data-value="{v} years without a paycheque">')
        o.append('  ' + row_bar(L, by, w, bh, fill))
        o.append(f'    <rect x="0" y="{y - 8}" width="{W}" height="{rowh + 16}" fill="transparent"/>')
        o.append('  </g>')
        o.append(f'  <text x="{L - 16}" y="{y + rowh / 2 + 5:.1f}" text-anchor="end" font-family="{SANS}" '
                 f'font-size="15" font-weight="600" fill="{INK}">{nm}</text>')
        o.append(f'  <text x="{L}" y="{y + rowh + 20:.1f}" font-family="{SANS}" '
                 f'font-size="11.5" fill="{INK_3}">{sub}</text>')
        lab = f'{v} years'
        o.append(f'  <text x="{L + w + 12:.1f}" y="{y + rowh / 2 + 6:.1f}" font-family="{SANS}" font-size="17" '
                 f'font-weight="600" fill="{INK}">{lab}</text>')
    o.append(f'  <line x1="{L}" y1="{T - 14}" x2="{L}" y2="{bottom}" stroke="{RULE}" stroke-width="1.4"/>')
    o.append(f'  <text x="0" y="22" font-family="{MONO}" font-size="11" letter-spacing="1.6" '
             f'fill="{INK_3}">YEARS OF FINANCIAL FREEDOM</text>')
    o.append(f'  <text x="0" y="46" font-family="{SANS}" font-size="14" fill="{INK_2}">'
             f'How long each household can meet its essential costs with no employment income.</text>')
    o.append(f'  <text x="0" y="66" font-family="{SANS}" font-size="13" fill="{INK_3}">'
             f'Their net worth is within 3&#37; of each other. Their freedom differs by 7.6&#215;.</text>')
    o.append(f'  <text x="{W - Rm + 10}" y="{bottom + 22}" font-family="{SANS}" font-size="11.5" '
             f'fill="{INK_3}">years</text>')
    return frame(W, H, "Years of financial freedom for two households of near-identical net worth",
                 "Two horizontal bars on a shared scale of years. Household A, on $600,000 a year with a "
                 "$3 million house, reaches 1.4 years without a paycheque. Household B, on $300,000 with a "
                 "$1.4 million house, reaches 10.5 years. Both have a net worth of about $3.2 million.",
                 "c5", "\n".join(o))


# ============================================================ CHART 6 ========
def chart_down_payment():
    """Job: change over time, one series -> columns, single hue, emphasis on the last."""
    data = [(1960, 0.51), (1970, 0.44), (1980, 0.96), (1990, 1.19),
            (2000, 1.55), (2010, 1.40), (2020, 2.26), (2026, 2.63)]
    W, H = 1000, 330
    L, Rm, T, B = 62, 26, 40, 58
    pw, ph = W - L - Rm, H - T - B
    ymax = 3
    band = pw / len(data)
    bw = min(BAR_MAX, band * 0.42)
    o = []
    for gv in (0, 1, 2, 3):
        y = T + ph - gv / ymax * ph
        o.append(f'  <line x1="{L}" y1="{y:.1f}" x2="{L + pw}" y2="{y:.1f}" stroke="{GRID}" stroke-width="1"/>')
        o.append(f'  <text x="{L - 12}" y="{y + 4:.1f}" text-anchor="end" font-family="{MONO}" '
                 f'font-size="11" fill="{INK_3}">{gv}</text>')
    for i, (yr, v) in enumerate(data):
        cx = L + band * i + band / 2
        h = v / ymax * ph
        y = T + ph - h
        emph = yr == 2026
        o.append(f'  <g class="bar" data-label="{yr}" data-value="{v} years of income for the deposit">')
        o.append('  ' + col_bar(cx - bw / 2, y, bw, h, EMPHASIS if emph else SERIES))
        o.append(f'    <rect x="{cx - band / 2:.1f}" y="{T}" width="{band:.1f}" height="{ph}" fill="transparent"/>')
        o.append('  </g>')
        o.append(f'  <text x="{cx:.1f}" y="{T + ph + 24}" text-anchor="middle" font-family="{MONO}" '
                 f'font-size="12" fill="{EMPHASIS if emph else INK_2}">{yr}</text>')
        if yr in (1970, 2026):
            o.append(f'  <text x="{cx:.1f}" y="{y - 10:.1f}" text-anchor="middle" font-family="{SANS}" '
                     f'font-size="13" font-weight="600" fill="{INK}">{v}</text>')
    o.append(f'  <line x1="{L}" y1="{T + ph}" x2="{L + pw}" y2="{T + ph}" stroke="{RULE}" stroke-width="1.4"/>')
    o.append(f'  <text x="{L}" y="22" font-family="{MONO}" font-size="11" letter-spacing="1.6" '
             f'fill="{INK_3}">YEARS OF MEDIAN INCOME NEEDED FOR THE 20&#37; DEPOSIT</text>')
    return frame(W, H, "The deposit, measured in years of median household income",
                 "A column chart of the 20 percent down payment expressed in years of median household "
                 "income. It falls from 0.51 in 1960 to 0.44 in 1970, then climbs steadily to 2.63 by 2026.",
                 "c6", "\n".join(o))


CHARTS = [("c1", chart_price_to_income), ("c2", chart_burden_composition),
          ("c3", chart_where_money_goes), ("c4", chart_cash_runway),
          ("c5", chart_years_of_freedom), ("c6", chart_down_payment)]

if __name__ == "__main__":
    out = []
    for cid, fn in CHARTS:
        out.append(f"<!-- ==================== {cid} ==================== -->\n{fn()}")
    text = "\n\n".join(out)
    if "--write" in sys.argv:
        import pathlib
        p = pathlib.Path("scratch-bay-area-charts.svg.txt")
        p.write_text(text, encoding="utf-8")
        print(f"wrote {p} ({len(text)} bytes)")
    else:
        print(text)
