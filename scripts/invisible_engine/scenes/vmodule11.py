"""Module 11 phone-vertical scenes (79–84): the same scenes as module11.py, laid out for a
phone (VScene: 720 wide, body drawn in its own coordinates below the header).
Same title, desc, frames and words as the landscape scene; invisible-engine/tests/check.py
compares them. Change a scene's words in both files."""
from xml.sax.saxutils import escape as esc
from .svgkit import VScene
from .art import *
from .module11 import lines, office, laptop, xmark, tick
from . import module11 as L

scenes = {}


def desc(n):
    """The landscape scene's desc (identical by contract)."""
    import re
    from xml.sax.saxutils import unescape
    return unescape(re.search(r'<desc>(.*?)</desc>', L.scenes[n], re.S).group(1))


# ── local helpers (phone type scale) ────────────────────────────────
def owner(x, y, text, color='slate'):
    """A 'who implements it' pill at phone size; returns (svg, right edge)."""
    c, light, border = STEP[color]
    w = 32 + len(text) * 11.0
    return (f'<rect x="{x}" y="{y}" width="{w:.0f}" height="32" rx="16" fill="#ffffff" stroke="{c}" stroke-width="2"/>'
            + T(x + w / 2, y + 22, text, 20, 700, c, 'middle')), x + w


def owners(x, y, names, color='slate'):
    out = ''
    for n in names:
        svg, right = owner(x, y, n, color)
        out += svg
        x = right + 8
    return out


def pill(x, y, text, color):
    """An evidence label pill; returns (svg, width)."""
    c, light, border = STEP[color]
    w = 32 + len(text) * 11.6
    return (f'<rect x="{x}" y="{y}" width="{w:.0f}" height="32" rx="16" fill="{light}" stroke="{border}" stroke-width="2"/>'
            + T(x + w / 2, y + 22, text, 20, 700, c, 'middle')), w


def visitor_badge(cx, y, color='#b45309'):
    """A clip-on badge reading VISITOR, sized so its word stays legible on a phone."""
    return (f'<rect x="{cx - 6}" y="{y - 14}" width="12" height="18" rx="3" fill="#94a3b8"/>'
            f'<rect x="{cx - 56}" y="{y}" width="112" height="34" rx="8" fill="{color}" stroke="#ffffff" stroke-width="2"/>'
            + T(cx, y + 24, 'VISITOR', 20, 800, '#ffffff', 'middle'))


# ── 79 Enterprise boundary map ──────────────────────────────────────
s = VScene(79, 'Where the company’s authority stops', desc(79),
           sub='Most of a company’s leverage is over its own assets, accounts and processes — not over the networks.',
           note='Schematic. Organisations differ; the bands, not the drawing, are the point.', h=1600)
s.f(1)
s.rect(40, 0, 640, 368, 'bound', rx=18)
s.raw(T(64, 40, 'The company', 24, 800, '#14213d') + T(64, 70, 'controls these directly', 21, 600, '#15803d'))
s.raw(T(390, 36, 'Company property ·', 20, 700, '#166534') + T(390, 60, 'managed devices ·', 20, 700, '#166534')
      + T(390, 84, 'managed accounts', 20, 700, '#166534'))
s.raw(office(70, 106, 110, 196))
s.raw(T(125, 328, 'office', 20, 700, '#334155', 'middle'))
s.raw(laptop(198, 200, 140))
s.raw(tag(350, 192, 16))
s.raw(T(268, 328, 'company laptop', 20, 700, '#334155', 'middle') + T(268, 352, '+ asset tag', 20, 400, '#475569', 'middle'))
s.raw(phone(398, 124, 82, 164, '#dcfce7'))
s.raw(T(439, 328, 'managed', 20, 700, '#334155', 'middle') + T(439, 352, 'phone', 20, 700, '#334155', 'middle'))
s.raw(cloud(500, 150, 170, None))
s.raw(T(585, 206, 'managed', 20, 700, '#14213d', 'middle') + T(585, 228, 'account', 20, 700, '#14213d', 'middle'))
s.raw(T(585, 328, 'company-owned,', 20, 400, '#475569', 'middle') + T(585, 352, 'strong sign-in', 20, 400, '#475569', 'middle'))
s.f(2)
s.raw(person(100, 386, 0.62, '#475569', phone_in_hand=True))
s.raw(T(100, 550, 'employee', 21, 800, '#14213d', 'middle'))
s.raw(lines(40, 578, ['body, home and', 'personal phone', 'are their own'], 21, lh=26))
s.raw(person(296, 386, 0.62, '#0f766e'))
s.raw(visitor_badge(296, 426))
s.raw(suitcase(346, 462, 0.38, '#64748b'))
s.raw(T(296, 550, 'visitor', 21, 800, '#14213d', 'middle'))
s.raw(lines(232, 578, ['their own bag,', 'their own phone'], 21, lh=26))
s.f(3)
s.rect(40, 652, 312, 200, 'bound', rx=18)
s.raw(T(60, 688, 'Vendor finder', 22, 800, '#14213d') + T(60, 714, 'networks', 22, 800, '#14213d'))
s.raw(cloud(220, 664, 116, None))
s.raw(T(60, 750, 'relays, accounts', 20, 700, '#14213d'))
s.raw(lines(60, 782, ['Run by Apple, Google,', 'Samsung, Life360.', 'No company sees inside.'], 20, lh=25))
s.raw('<rect x="368" y="652" width="312" height="200" rx="14" fill="#eff6ff" stroke="#93c5fd" stroke-width="2"/>')
s.raw(T(388, 688, 'The wireless', 22, 800, '#14213d') + T(388, 714, 'environment', 22, 800, '#14213d'))
s.raw(waves(604, 700, 3, '#2563eb', 1.0))
s.raw(lines(388, 756, ['radio reaches everyone;', 'nobody owns the air'], 21, lh=27))
s.raw(T(388, 832, 'Arcs are illustrative.', 20, 400, '#475569', italic=True))
s.f(4)
s.raw(tag(375, 514, 15))
s.raw('<rect x="353" y="492" width="44" height="44" rx="8" fill="none" stroke="#b45309" stroke-width="2.5" stroke-dasharray="5 4"/>')
s.raw(callout(436, 384, 244, 186, 'A private tracker', 'Not the company’s.\nIt cannot read it\nor switch it off:\nadvise and support.', 'amber', None, 22, 21))
s.f(5)
bands = [('Controls directly', ['company property,', 'managed devices and', 'accounts'], 'green'),
         ('Can set by policy', ['managed phone settings,', 'procurement terms,', 'visitor rules'], 'blue'),
         ('Can advise and support', ['personal phones and', 'accounts, privately', 'owned trackers'], 'amber'),
         ('Cannot reach', ['vendor networks — only', 'through procurement', 'and legal requests'], 'slate')]
for i, (t, body, col) in enumerate(bands):
    x = 40 + (i % 2) * 328
    y = 866 + (i // 2) * 142
    c, light, border = STEP[col]
    s.raw(f'<rect x="{x}" y="{y}" width="312" height="132" rx="14" fill="{light}" stroke="{border}" stroke-width="2"/>')
    s.raw(badge(x + 24, y + 28, i + 1, col, 15))
    s.raw(T(x + 46, y + 35, t, 20, 800, c))
    s.raw(lines(x + 16, y + 66, body, 20, lh=25))
s.bh = 1150
scenes[79] = s.render()


def tw(text, size, bold=False):
    """Rough text width in px (Inter): enough to decide wrapping; the lint checks the result."""
    return len(text) * size * (0.565 if bold else 0.5)


# ── 80 STRIDE + LINDDUN ──────────────────────────────────────────────
s = VScene(80, 'Two lenses: security threats and privacy threats', desc(80),
           sub='Name the threat, the surface and how strong the evidence is. No heatmap: a colour per cell would claim precision nobody has.',
           note='No scores. Evidence in words: documented, research, long-standing.', h=1600)


def chips(y0, items, border, lead=False):
    """Flowed chips; returns (svg, bottom y)."""
    out, x, y = '', 60, y0
    for t in items:
        w = (42 if lead else 24) + tw(t, 20, True) * 1.0
        if x + w > 664:
            x, y = 60, y + 46
        out += f'<rect x="{x}" y="{y}" width="{w:.0f}" height="36" rx="8" fill="#ffffff" stroke="{border}" stroke-width="2"/>'
        if lead:
            out += T(x + 11, y + 25, t[0], 21, 800, '#1d4ed8') + T(x + 34, y + 25, t, 20, 600, '#14213d')
        else:
            out += T(x + 11, y + 25, t, 20, 600, '#14213d')
        x += w + 8
    return out, y + 36


s.f(1)
svg, b1 = chips(58, L.stride, '#93c5fd', lead=True)
s.raw(panel(40, 0, 640, b1 + 14, 'blue', None, 'STRIDE · security', None, 22) + svg)
s.f(2)
y2 = b1 + 26
svg, b2 = chips(y2 + 58, L.linddun, '#c4b5fd')
s.raw(panel(40, y2, 640, b2 - y2 + 14, 'purple', None, 'LINDDUN · privacy', None, 22) + svg)
s.f(3)
yh = b2 + 26
s.raw(f'<rect x="40" y="{yh}" width="640" height="44" rx="10" fill="#f1f5f9"/>')
hx = 54
for t, c in (('Surface', '#14213d'), ('Security (STRIDE)', '#1e3a8a'), ('Privacy (LINDDUN)', '#4c1d95'), ('Evidence', '#14213d')):
    s.raw(T(hx, yh + 29, t, 19.5, 800, c))
    hx += tw(t, 19.5, True) + 22
y = yh + 52
for fr, surf, sec, priv, ev in L.rows:
    s.f(fr)
    s.raw(f'<rect x="40" y="{y}" width="640" height="136" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>')
    s.raw(T(56, y + 29, surf.replace('\n', ' '), 21, 800, '#14213d'))
    px = 664
    for name, col in reversed(ev):
        w = 32 + len(name) * 11.6
        px -= w
        s.raw(pill(px, y + 8, name, col)[0])
        px -= 8
    s.raw(lines(56, y + 57, sec, 21, '#1e3a8a', 400, 24))
    s.raw(lines(56, y + 105, priv, 21, '#4c1d95', 400, 24))
    y += 141
s.bh = y - 6 + 4
scenes[80] = s.render()


# ── 81 Risk register ─────────────────────────────────────────────────
s = VScene(81, 'A risk register with its reasons showing', desc(81),
           sub='Each field answers a question someone will ask later. Likelihood is a reason, not a number.',
           note='Worked examples; re-rate every row for your own organisation.', h=1600)


def field(x, y, label, value, c, lh=24, maxw=612):
    """'Label value' on one line where it fits, the value wrapping under it otherwise; returns (svg, lines)."""
    lw = tw(label, 20, True) * 0.95 + 8
    words, rows, cur, room = value.split(), [], '', maxw - lw
    for w in words:
        nxt = f'{cur} {w}' if cur else w
        if tw(nxt, 20) * 1.04 > room and cur:
            rows.append(cur)
            cur, room = w, maxw - 16
        else:
            cur = nxt
    rows.append(cur)
    out = (f'<text x="{x}" y="{y}" style="font-size:20px;fill:#1f2937"><tspan style="font-weight:800;fill:{c}">{esc(label)} </tspan>'
           f'<tspan dx="3">{esc(rows[0])}</tspan></text>')
    for i, r in enumerate(rows[1:], 1):
        out += T(x + 16, y + i * lh, r, 20, 400, '#1f2937')
    return out, len(rows)


y = 0
for i, (title, col, vals) in enumerate(L.cards):
    s.f(i + 1)
    c, light, border = STEP[col]
    body, yy = '', y + 76
    for f, v in zip(L.fields, vals):
        svg, n = field(56, yy, f, v, c)
        body += svg
        yy += 24 * n + 1
    h = yy - y - 8
    s.raw(f'<rect x="40" y="{y}" width="640" height="{h}" rx="14" fill="#ffffff" stroke="{border}" stroke-width="2.5"/>')
    s.raw(f'<path d="M40,{y + 48} L40,{y + 14} Q40,{y} 54,{y} L666,{y} Q680,{y} 680,{y + 14} L680,{y + 48} Z" fill="{light}"/>')
    s.raw(badge(66, y + 25, i + 1, col, 16) + T(92, y + 33, title, 22, 800, c))
    s.raw(body)
    y += h + 10
s.bh = y - 6
scenes[81] = s.render()


# ── 82 Identity governance ───────────────────────────────────────────
s = VScene(82, 'Accounts first: company tags on company accounts', desc(82),
           sub='Zero trust for a finder network starts with which account owns which tag.',
           note='Follows zero-trust principles (NIST SP 800-207); controls depend on what each vendor offers.', h=1600)
s.f(1)
s.rect(40, 0, 640, 236, 'bound', rx=18)
s.raw(T(64, 38, 'Company’s managed account', 22, 800, '#14213d'))
s.raw(cloud(60, 66, 170, None) + T(145, 140, 'managed', 20, 700, '#14213d', 'middle'))
s.raw(tag(282, 120, 22) + tag(340, 120, 22))
s.raw(T(311, 178, 'company tags', 20, 600, '#334155', 'middle'))
s.raw(phone(404, 56, 64, 128, '#dcfce7') + T(436, 206, 'managed', 20, 600, '#334155', 'middle') + T(436, 228, 'phone', 20, 600, '#334155', 'middle'))
s.raw(laptop(510, 96, 140) + T(580, 210, 'laptop', 20, 600, '#334155', 'middle'))
s.raw('<rect x="290" y="246" width="140" height="40" rx="8" fill="#fef2f2" stroke="#dc2626" stroke-width="2"/>')
s.raw(T(360, 273, 'never mix', 20, 800, '#b91c1c', 'middle'))
s.raw('<rect x="40" y="296" width="640" height="236" rx="18" fill="#f8fafc" stroke="#94a3b8" stroke-width="2.5"/>')
s.raw(T(64, 334, 'The person’s own account', 22, 800, '#14213d'))
s.raw(cloud(60, 362, 170, None) + T(145, 436, 'personal', 20, 700, '#14213d', 'middle'))
s.raw(phone(270, 352, 64, 128, '#e0f2fe') + T(302, 506, 'own phone', 20, 600, '#334155', 'middle'))
s.raw(tag(420, 416, 22) + T(420, 474, 'own tag', 20, 600, '#334155', 'middle'))
s.raw(lines(530, 398, ['theirs,', 'not the', 'company’s'], 21, '#475569', 600, 28))
steps = [
    (2, 'Minimum sharing', ['Share a company tag only with the roles that need it.', 'Personal locations are never shared with the company.'], ['IT', 'team lead'], 'blue'),
    (3, 'Strong sign-in', ['Security keys or multi-factor where available; limits on', 'who may enrol a new device to the account.'], ['IT / identity'], 'purple'),
    (4, 'Review and rotate', ['Review trusted devices every quarter; rotate keys and', 'credentials when people or devices change.'], ['IT / identity'], 'teal'),
    (5, 'Deprovision leavers', ['Remove their shares; move company tags off accounts', 'they control; revoke their devices.'], ['HR', 'IT'], 'amber'),
]
for i, (fr, t, body, who, col) in enumerate(steps):
    s.f(fr)
    y = 546 + i * 158
    c, light, border = STEP[col]
    s.raw(f'<rect x="40" y="{y}" width="640" height="150" rx="14" fill="{light}" stroke="{border}" stroke-width="2"/>')
    s.raw(badge(68, y + 28, fr, col, 17) + T(96, y + 36, t, 22, 800, c))
    s.raw(lines(58, y + 70, body, 21, lh=27))
    s.raw(T(58, y + 132, 'Who does it', 20, 800, '#475569'))
    s.raw(owners(190, y + 109, who, col))
s.bh = 546 + 4 * 158 - 4
scenes[82] = s.render()


# ── 83 Unwanted-tracker safety policy ────────────────────────────────
s = VScene(83, 'A tracker safety policy that protects people without watching them', desc(83),
           sub='The aim is a safe person, not a watched one.',
           note='Policy outline, not legal advice. Follow local law and labour rules.', h=1600)
for i, (fr, t, body, who, col) in enumerate(L.panels):
    s.f(fr)
    y = i * 186
    c, light, border = STEP[col]
    s.raw(f'<rect x="40" y="{y}" width="640" height="176" rx="14" fill="{light}" stroke="{border}" stroke-width="2"/>')
    s.raw(badge(68, y + 30, fr, col, 18) + T(98, y + 38, t, 23, 800, c))
    s.raw(lines(58, y + 72, body, 21, lh=27))
    s.raw(T(58, y + 158, 'Who does it', 20, 800, '#475569'))
    s.raw(owners(190, y + 135, who, col))
s.f(5)
y = 4 * 186
s.raw(f'<rect x="40" y="{y}" width="640" height="372" rx="14" fill="#fef2f2" stroke="#dc2626" stroke-width="3"/>')
s.raw(T(64, y + 44, 'What it must not do', 24, 800, '#991b1b'))
s.raw(eye(570, y + 32, 0.9, '#991b1b'))
s.raw(f'<path d="M564,{y + 16} L646,{y + 50}" stroke="#dc2626" stroke-width="5" stroke-linecap="round"/>')
for k, rows_ in enumerate(L.nots):
    yy = y + 92 + k * 38
    s.raw(xmark(78, yy - 7) + T(104, yy, ' '.join(rows_), 21, 600, '#1f2937'))
s.raw(f'<rect x="60" y="{y + 242}" width="600" height="114" rx="10" fill="#ffffff" stroke="#fca5a5" stroke-width="2"/>')
s.raw(lines(78, y + 274, ['If any scanning: restricted areas only, data minimised,', 'after legal and works-council review.'], 20, '#334155', 400, 26))
s.raw(owners(78, y + 312, ['legal', 'security'], 'red'))
s.bh = y + 376
scenes[83] = s.render()


# ── 84 30/90/180-day roadmap ─────────────────────────────────────────
s = VScene(84, 'The first 180 days: decide, fix, build in', desc(84),
           sub='Each step has an owner. Each metric measures a capability, never a person.',
           note='Follows the roadmap in From Tap to Trace, Part X. Owners are typical; organisations differ.', h=1600)
y = 0
for i, (fr, t, col, items) in enumerate(L.phases):
    s.f(fr)
    c, light, border = STEP[col]
    top, body, yy = y, '', y + 50
    for txt, who in items:
        pw = sum(32 + len(n) * 11.0 + 8 for n in who)
        one = tw(txt, 21) + 16 + pw <= 616
        body += T(58, yy + 24, txt, 21, 600, '#14213d')
        if one:
            body += owners(664 - pw + 8, yy + 2, who, col)
            yy += 40
        else:
            body += owners(58, yy + 32, who, col)
            yy += 68
    h = yy - top + 6
    s.raw(f'<rect x="40" y="{top}" width="640" height="{h}" rx="14" fill="{light}" stroke="{border}" stroke-width="2"/>')
    s.raw(badge(68, top + 26, fr, col, 17) + T(96, top + 34, t, 22, 800, c))
    s.raw(body)
    if i < 2:
        s.raw(f'<path d="M360,{top + h + 1} L360,{top + h + 11}" stroke="#94a3b8" stroke-width="3"/>')
    y = top + h + 12
s.f(4)
c, light, border = STEP['green']
s.raw(f'<rect x="40" y="{y}" width="640" height="168" rx="18" fill="{light}" stroke="{border}" stroke-width="2"/>')
s.raw(badge(68, y + 28, 4, 'green', 17) + T(96, y + 36, 'Measure capabilities', 22, 800, '#14213d'))
for k, g in enumerate(L.good):
    yy = y + 72 + k * 28
    s.raw(tick(76, yy - 7, 11) + T(98, yy, g, 20, 600, '#14213d'))
y += 178
s.raw(f'<rect x="40" y="{y}" width="640" height="140" rx="18" fill="#fef2f2" stroke="#fca5a5" stroke-width="2"/>')
s.raw(T(64, y + 38, 'Never measure', 23, 800, '#991b1b'))
for k, b in enumerate(L.bad):
    yy = y + 72 + k * 28
    s.raw(xmark(76, yy - 7, 11) + T(98, yy, b, 20, 600, '#14213d'))
s.bh = y + 144
scenes[84] = s.render()
