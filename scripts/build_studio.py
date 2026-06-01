#!/usr/bin/env python3
"""
Build the Data Modeling Studio detail panels from the live data-modeling.html.

Reads the 20 `.scenario` blocks out of interview.app/design/data-modeling.html,
routes each scenario's "Section N —" sub-sections into the studio's tabbed study
view (Prompt / Data model / SQL / Trade-offs / Pitfalls / Worked example / Drill),
and splices the result into data-modeling.studio.html — preserving the studio's
hand-built shell (CSS, hero, cards, JS).

Idempotent: re-run any time the source scenarios change. Does NOT touch the live
data-modeling.html.
"""
import re, pathlib, html as _html

HERE   = pathlib.Path(__file__).resolve().parent.parent
SRC    = HERE / "interview.app/design/data-modeling.html"
STUDIO = HERE / "interview.app/design/data-modeling.studio.html"

# Scenario order + domain fallback (matches the JS SCENARIOS metadata)
ORDER = [
    ("sc-uber-trip","Uber / Lyft · ride-sharing"),
    ("sc-uber-surge","Uber · surge pricing"),
    ("sc-doordash","DoorDash / Uber Eats · 3-sided marketplace"),
    ("sc-google-ads","Google · search ads · auction"),
    ("sc-meta-ads","Meta · ads attribution & identity"),
    ("sc-netflix-ads","Netflix · CTV ads"),
    ("sc-amazon","Amazon · orders, returns & inventory"),
    ("sc-meta-feed","Meta / Instagram · feed engagement"),
    ("sc-spotify","Spotify · listening history & royalties"),
    ("sc-stripe","Stripe · payments & double-entry ledger"),
    ("sc-airbnb","Airbnb · bookings, calendar & reviews"),
    ("sc-saas","SaaS · subscription billing & metering"),
    ("sc-spotify-royalty","Spotify · streaming royalty pool"),
    ("sc-tiktok-fyp","TikTok · recommendation feedback loop"),
    ("sc-stripe-ledger","Stripe · double-entry ledger & idempotency"),
    ("sc-salesforce-hierarchy","Salesforce · account hierarchy & multi-tenant"),
    ("sc-netflix-streaming","Netflix · streaming + series + LAD"),
    ("sc-ma-integration","M&A integration · golden records"),
    ("sc-fraud-detection","Fraud · identity graph & decision replay"),
    ("sc-growth-accounting","Growth accounting · DAU/WAU/MAU & LTV"),
]

TABS = [("prompt","Prompt"),("model","Data model"),("sql","SQL"),
        ("tradeoffs","Trade-offs"),("pitfalls","Pitfalls"),("example","Worked example")]

def inner_div(s, start):
    """Return inner HTML of the <div ...> that begins at index `start` (balanced)."""
    i = s.index('>', start) + 1
    depth = 1
    for m in re.finditer(r'<(/?)div\b', s[i:]):
        depth += 1 if m.group(1) == '' else -1
        if depth == 0:
            return s[i:i + m.start()]
    return s[i:]

def strip_tags(h):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', h)).strip()

def route(heading):
    h = heading.lower()
    if "scenario " in h or "why this is hard" in h or "design tension" in h or "section 1" in h or "overview" in h:
        return "prompt"
    if "sql" in h or "section 7" in h:
        return "sql"
    if "worked example" in h or "sample data" in h or "section 6" in h or "section 10" in h or "dataset" in h:
        return "example"
    if any(k in h for k in ["data model","logical","dimensional","graphical","section 2","section 3",
                            "section 4","section 5","stakeholder","grain","partition","geospatial",
                            "indexing","shard","key"]):
        return "model"
    if any(k in h for k in ["why this works","section 8","trade","consistency","ownership","boundar",
                            "evolution","state-machine","articulat","senior","contract"]):
        return "tradeoffs"
    if any(k in h for k in ["trap","failure","pitfall","disqualif","reconcil","edge","skew",
                            "staleness","amplification","drift","fraud","late"]):
        return "pitfalls"
    return "model"

def first_block(body, cls):
    m = re.search(r'<div class="%s">(.*?)</div>' % cls, body, re.S)
    return m.group(1).strip() if m else None

def build_panel(sid, domain, block):
    # title from "Scenario N — Title"
    mt = re.search(r'<h4 class="sub-head">\s*Scenario\s*\d+\s*[—-]\s*(.*?)</h4>', block, re.S)
    title = strip_tags(mt.group(1)) if mt else sid
    dt = first_block(block, "domain-tag")
    if dt: domain = strip_tags(dt)

    # split into sections on top-level sub-head headings
    parts = re.split(r'(<h4 class="sub-head">.*?</h4>)', block, flags=re.S)
    buckets = {k: [] for k, _ in TABS}
    # parts[0] is pre-heading (domain-tag) -> ignore
    pre, rest = parts[0], parts[1:]
    for i in range(0, len(rest) - 1, 2):
        heading_html, content = rest[i], rest[i + 1]
        htext = strip_tags(heading_html)
        tab = route(htext)
        if re.match(r'(?i)scenario\s*\d+\s*[—-]', htext):
            buckets["prompt"].append(content.strip())          # title section: keep the prompt body only
        else:
            buckets[tab].append('<h3>%s</h3>\n%s' % (_html.escape(htext), content.strip()))

    # auto-drill: prompt challenge + senior framing answer
    prompt_txt = first_block(block, "prompt")
    senior = first_block(block, "senior-signal")
    drill = ""
    if prompt_txt and senior:
        drill = ('<div class="drill"><p class="drill__q">Drill · answer this in 90 seconds:</p>'
                 '<p style="font-family:var(--font-read);margin:0 0 10px">%s</p>'
                 '<button class="reveal" type="button" data-reveal>Reveal a senior-level framing</button>'
                 '<div class="drill__a" hidden>%s</div></div>' % (prompt_txt.strip(), senior.strip()))

    # assemble tabs that have content
    active = [(k, lbl) for k, lbl in TABS if buckets[k]]
    if drill:
        active.append(("drill", "Drill"))
    if not active:
        active = [("model", "Data model")]

    aria = _html.escape(title) + " study view"
    tabbtns, panels = [], []
    for n, (k, lbl) in enumerate(active):
        sel = "true" if n == 0 else "false"
        ti = "" if n == 0 else ' tabindex="-1"'
        tabbtns.append('<button class="tab" role="tab" id="t-%s-%s" aria-controls="p-%s-%s" '
                       'aria-selected="%s"%s>%s</button>' % (sid, k, sid, k, sel, ti, lbl))
        hidden = "" if n == 0 else " hidden"
        content = drill if k == "drill" else "\n".join(buckets[k])
        panels.append('<div class="tabpanel" role="tabpanel" id="p-%s-%s" aria-labelledby="t-%s-%s" '
                      'tabindex="0"%s>\n%s\n</div>' % (sid, k, sid, k, hidden, content))

    return (
        '<article class="detail" id="detail-%s" aria-labelledby="h-%s">\n'
        '  <div class="detail__nav"><div class="detail__head">'
        '<button class="btn" type="button" data-back>← All scenarios</button>'
        '<h2 id="h-%s">%s</h2><span class="card__domain">%s</span></div>'
        '<div class="detail__actions">'
        '<button class="btn btn--primary" type="button" data-study="%s" aria-pressed="false">Mark studied</button>'
        '<a class="btn" href="data-modeling.html#%s">Full write-up ↗</a></div></div>\n'
        '  <div class="tablist" role="tablist" aria-label="%s">%s</div>\n%s\n</article>'
    ) % (sid, sid, sid, _html.escape(title), _html.escape(domain), sid, sid, aria,
         "".join(tabbtns), "\n".join(panels))

def main():
    src = SRC.read_text(encoding="utf-8")
    studio = STUDIO.read_text(encoding="utf-8")

    # extract scenario inner-HTML by id
    scen = {}
    for m in re.finditer(r'<div class="scenario" id="(sc-[^"]+)">', src):
        scen[m.group(1)] = inner_div(src, m.start())

    panels = []
    for sid, domain in ORDER:
        if sid in scen:
            panels.append(build_panel(sid, domain, scen[sid]))
        else:
            print("  WARN missing scenario:", sid)
    panels_html = "  <!-- ===================== SCENARIO DETAILS (generated) ===================== -->\n" + \
                  "\n\n".join(panels) + "\n"

    # splice into studio: replace from the SCENARIO DETAILS marker to </main>
    a = studio.index("<!-- ===================== SCENARIO DETAILS")
    b = studio.index("</main>", a)
    studio = studio[:a] + panels_html + studio[b:]

    # wire all 20
    studio = re.sub(r'var WIRED = \{[^}]*\};',
                    'var WIRED = {' + ",".join('"%s":1' % s for s, _ in ORDER) + '};', studio, count=1)

    # imported-content styles (only once)
    if "IMPORTED CONTENT" not in studio:
        css = """
/* ===== imported scenario content (from data-modeling.html) ===== */
.tabpanel .sub-head{font-family:var(--font-ui);font-size:15px;font-weight:700;color:var(--text);margin:22px 0 8px}
.tabpanel .sub-head:first-child,.tabpanel h3:first-child{margin-top:0}
.tabpanel .domain-tag{display:inline-block;font-family:var(--font-mono);font-size:11px;color:var(--accent);background:var(--accent-weak);border:1px solid var(--warn-bd);padding:3px 10px;border-radius:999px;margin-bottom:10px}
.tabpanel .prompt{background:var(--prompt-bg);border:1px solid var(--prompt-bd);border-left:4px solid #64748b;border-radius:var(--radius-sm);padding:14px 16px;margin:0 0 16px;font-family:var(--font-ui);font-size:14.5px;color:var(--text)}
.tabpanel .senior-signal{background:var(--note-bg);border:1px solid var(--note-bd);border-left:4px solid var(--note-fg);border-radius:var(--radius-sm);padding:14px 16px;margin:16px 0;font-family:var(--font-ui);font-size:14px}
.tabpanel .trap-box{background:var(--trap-bg);border:1px solid var(--trap-bd);border-left:4px solid var(--trap-fg);border-radius:var(--radius-sm);padding:14px 16px;margin:16px 0;font-family:var(--font-ui);font-size:14px}
.tabpanel .callout{background:var(--warn-bg);border:1px solid var(--warn-bd);border-left:4px solid var(--accent);border-radius:var(--radius-sm);padding:14px 16px;margin:16px 0;font-family:var(--font-ui);font-size:14px}
.tabpanel .articulation-script{background:var(--surface-2);border:1px dashed var(--border-strong);border-radius:var(--radius-sm);padding:14px 16px;margin:16px 0;font-family:var(--font-read);font-style:italic}
.tabpanel .cross-link{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;background:var(--accent-weak);border:1px solid var(--warn-bd);border-radius:var(--radius-sm);padding:12px 14px;margin:16px 0;font-size:13.5px}
.tabpanel .versus-grid,.tabpanel .feature-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:0 0 16px}
.tabpanel svg{max-width:100%;height:auto}
/* IMPORTED CONTENT marker */
"""
        studio = studio.replace("</style>", css + "</style>", 1)

    STUDIO.write_text(studio, encoding="utf-8")
    print("  built %d panels -> %s (%d KB)" % (len(panels), STUDIO.name, len(studio) // 1024))

if __name__ == "__main__":
    main()
