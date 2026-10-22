"""Module 3 phone-vertical scenes (18–22): the same scenes as module03.py, laid out for a
phone (VScene: 720 wide, body drawn in its own coordinates below the header).
Same title, desc, frames and words as the landscape scene; invisible-engine/tests/check.py
compares them. Change a scene's words in both files."""
import math
from .svgkit import VScene, wrap
from .art import *
from .module03 import inlay, door, check

scenes = {}


# ── local drawing helpers (phone type scale) ─────────────────────────
def vcallout(x, y, w, title, body, color='blue', n=None, tsize=24, bsize=21, tw=None, bw=None):
    """A callout that wraps its title and body to its width. Returns (svg, height).
    tw / bw: characters per line (estimated from the width when omitted)."""
    c, light, border = STEP[color]
    tx = x + (54 if n is not None else 16)
    tl = wrap(title, tw or int((x + w - 14 - tx) / (tsize * 0.58)))
    bl = [ln for para in body.split('\n') for ln in wrap(para, bw or int((w - 30) / (bsize * 0.52)))]
    tlh, blh = round(tsize * 1.25), round(bsize * 1.3)
    by = y + 36 + tlh * (len(tl) - 1) + bsize + 12
    h = by - y + blh * (len(bl) - 1) + 20
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{light}" stroke="{border}" stroke-width="2"/>'
    if n is not None:
        out += badge(x + 26, y + 30, n, color, 18)
    out += ''.join(T(tx, y + 36 + i * tlh, ln, tsize, 800, c) for i, ln in enumerate(tl))
    out += T(x + 16, by, '\n'.join(bl), bsize, 400, '#334155')
    return out, h


def reader_unit(x, y, w=110, h=150, label='Reader'):
    """module03.reader_unit with its label at the phone type scale."""
    return (f'<rect x="{x + 4}" y="{y + 6}" width="{w}" height="{h}" rx="14" fill="#0f172a" opacity="0.13"/>'
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="#1f2937"/>'
            f'<rect x="{x + 12}" y="{y + 14}" width="{w - 24}" height="{h * 0.34:.0f}" rx="6" fill="#e0f2fe"/>'
            + contactless(x + w / 2 - 10, y + 14 + h * 0.17, 0.75, '#0c4a6e', 2.4)
            + f'<circle cx="{x + w / 2:.0f}" cy="{y + h - 24}" r="7" fill="#22c55e"/>'
            + T(x + w / 2, y + h + 28, label, 21, 700, '#334155', 'middle'))


def vid_badge(x, y, w=110, label='STAFF', color='#0f766e', fs=20):
    """art.id_badge with a label large enough for a phone."""
    h = w * 1.45
    return (f'<rect x="{x + w * 0.38:.0f}" y="{y - 22}" width="{w * 0.24:.0f}" height="30" rx="6" fill="#94a3b8"/>'
            f'<rect x="{x + 4}" y="{y + 6}" width="{w}" height="{h:.0f}" rx="12" fill="#0f172a" opacity="0.12"/>'
            f'<rect x="{x}" y="{y}" width="{w}" height="{h:.0f}" rx="12" fill="#ffffff" stroke="#334155" stroke-width="3"/>'
            f'<rect x="{x}" y="{y}" width="{w}" height="{max(h * 0.2, fs + 14):.0f}" rx="12" fill="{color}"/>'
            f'<rect x="{x}" y="{y + max(h * 0.2, fs + 14) - 12:.0f}" width="{w}" height="12" fill="{color}"/>'
            + T(x + w / 2, y + fs + 4, label, fs, 800, '#ffffff', 'middle')
            + f'<circle cx="{x + w / 2:.0f}" cy="{y + h * 0.45:.0f}" r="{w * 0.17:.0f}" fill="#cbd5e1"/>'
              f'<rect x="{x + w * 0.2:.0f}" y="{y + h * 0.68:.0f}" width="{w * 0.6:.0f}" height="{h * 0.05:.0f}" rx="4" fill="#94a3b8"/>'
              f'<rect x="{x + w * 0.28:.0f}" y="{y + h * 0.78:.0f}" width="{w * 0.44:.0f}" height="{h * 0.04:.0f}" rx="4" fill="#cbd5e1"/>')


# ── 18 Passive RFID at the dock door ─────────────────────────────────
s = VScene(18, 'Passive RFID: the warehouse dock door',
           'Five frames. A pallet of boxes, each carrying a thin battery-free UHF RFID tag, passes through a dock-door '
           'portal with a reader and two antennas. The reader’s 860–960 MHz radio wave powers the tags; the reader sends '
           'commands and each tag answers in its own time slot by backscatter, changing how strongly its antenna '
           'reflects. The reader passes the tag numbers, with its own door, antenna and time, to an inventory system: '
           'the tag sends an identifier, not a location. A final panel contrasts HF tags at 13.56 MHz, which couple '
           'magnetically in the near field over centimetres to about a metre, with UHF tags, which use far-field '
           'backscatter over several metres.',
           sub='The tag says only “I am number …”. The system works out where from which reader heard it, and when.',
           note='Schematic. Wave arcs are illustrative. Ranges are typical, not guaranteed.', h=1668)
RX = 380  # right column of callouts
s.f(1)
s.raw('<rect x="40" y="70" width="20" height="370" rx="4" fill="#64748b"/><rect x="316" y="70" width="20" height="370" rx="4" fill="#64748b"/>'
      '<rect x="34" y="56" width="308" height="20" rx="5" fill="#475569"/>'
      '<rect x="60" y="250" width="16" height="160" rx="5" fill="#e2e8f0" stroke="#334155" stroke-width="2"/>'
      '<rect x="300" y="250" width="16" height="160" rx="5" fill="#e2e8f0" stroke="#334155" stroke-width="2"/>'
      '<path d="M36,442 L350,442" stroke="#94a3b8" stroke-width="3"/>')
s.raw('<rect x="113" y="4" width="150" height="44" rx="10" fill="#1f2937"/>' + T(188, 34, 'Reader', 21, 800, '#e0f2fe', 'middle'))
s.text(76, 472, 'antenna', 's', 'middle')
s.text(300, 472, 'antenna', 's', 'middle')
s.raw('<rect x="112" y="422" width="166" height="18" rx="3" fill="#b45309"/>')
for bx, by in ((118, 372), (194, 372), (118, 316), (194, 316)):
    s.raw(box_parcel(bx, by, 60))
    s.raw(inlay(bx + 4, by + 7, 32))
c, h1 = vcallout(RX, 0, 680 - RX, 'A tagged pallet arrives', 'Each box carries a paper-thin UHF tag: an antenna and a chip. No battery.', 'slate', 1)
s.raw(c)
y = h1 + 12
s.f(2)
s.raw(waves(80, 300, 3, '#c2410c', 0.8))
s.raw(waves(296, 300, 3, '#c2410c', 0.8, dir=-1))
s.arrow([(80, 352), (114, 352)], 'energy')
s.arrow([(296, 352), (268, 352)], 'energy')
c, h2 = vcallout(RX, y, 680 - RX, 'The wave powers the tags', 'Each tag harvests a tiny amount of energy from the 860–960 MHz signal.', 'orange', 2)
s.raw(c)
y += h2 + 12
s.f(3)
s.biarrow([(80, 398), (114, 398)], 'signal')
s.biarrow([(266, 398), (296, 398)], 'signal')
c, h3 = vcallout(RX, y, 680 - RX, 'Each tag answers in its own slot', 'By backscatter: it switches how strongly its antenna reflects. Many tags a second.', 'blue', 3)
s.raw(c)
y += h3 + 12
s.f(4)
s.arrow([(263, 26), (360, 26), (360, 566), (148, 566)], 'plain', 'tag numbers + door,\nantenna, time', at=(240, 518))
s.raw(server(40, 526, 0.8))
s.raw(T(152, 622, 'Inventory system', 21, 700, '#334155'))
s.raw(f'<rect x="40" y="664" width="320" height="166" rx="10" fill="#f0fdf4" stroke="#86efac" stroke-width="2"/>')
s.raw(T(56, 694, 'Read log', 21, 800, '#166534'))
for i, line in enumerate(['EPC …0457', 'EPC …0458', 'EPC …0459', 'dock door 3 · ant 2', '10:42:07']):
    s.raw(T(56, 722 + i * 24, line, 20, 500, '#14213d', mono=True))
c, h4 = vcallout(RX, y, 680 - RX, 'An ID, not a location', 'The tag sends only its number. “Where” is inferred: which reader heard it, and when.', 'green', 4)
s.raw(c)
y = max(y + h4, 830) + 14
s.f(5)
for k, (col, ttl, rows) in enumerate((
        ('blue', 'HF · 13.56 MHz · near field', ['Magnetic (inductive) coupling and load modulation.',
                                               'λ ≈ 22 m, so a reader works deep inside λ/2π ≈ 3.5 m.',
                                               'Reads at centimetres to about a metre (vicinity tags).']),
        ('orange', 'UHF · 860–960 MHz · far field', ['Radiative coupling; the tag replies by backscatter.',
                                                   'λ ≈ 33 cm: a tag a metre away is three wavelengths out.',
                                                   'Reads at several metres (typical; varies widely).']))):
    py = y + k * 144
    s.raw(panel(40, py, 640, 136, col, None, ttl, None, 24))
    s.raw(T(60, py + 72, '\n'.join(rows), 20, 400, '#334155'))
    if k == 0:
        s.coil(632, py + 34, 54, 40, 3, 6)
    else:
        s.raw(inlay(578, py + 18, 86))
scenes[18] = s.render()


# ── 19 Passive, battery-assisted and active tags ─────────────────────
s = VScene(19, 'Three kinds of RFID tag',
           'Four frames. A passive tag has no battery: the reader’s signal powers it and it replies by backscatter. A '
           'battery-assisted passive tag adds a small cell that runs its chip and sensors, but still replies by '
           'backscatter, so it can answer a weaker reader signal from further away. An active tag has its own battery '
           'and its own transmitter and sends its own signal, often on a timer, to readers tens of metres or more away. '
           'A range chart compares illustrative typical ranges on a logarithmic scale from one centimetre to one '
           'hundred metres, with the trade-offs: cost, size, battery life.',
           sub='The more of its own energy a tag carries, the further it reaches, and the more it costs.',
           note='Ranges are illustrative: reader power, antennas, regulation and surroundings change them.', h=1702)
cols = [('blue', 'Passive', 'No battery'), ('teal', 'Battery-assisted passive', 'Battery runs the chip'),
        ('purple', 'Active', 'Own battery and transmitter')]
P = 300
for i, (c, t, sub) in enumerate(cols):
    py = i * (P + 12)
    s.f(i + 1)
    s.raw(panel(40, py, 640, P, c, i + 1, t, None, tsize=24))
    s.raw(T(122, py + 86, sub, 21, 600, STEP[c][0]))
    if i < 2:
        s.raw(reader_unit(60, py + 112, 80, 120, 'reader'))
        s.raw(inlay(226, py + 120, 120))
        s.arrow([(148, py + 136), (220, py + 136)], 'energy')
        s.arrow([(220, py + 182), (148, py + 182)], 'signal')
        if i == 1:
            s.raw(f'<rect x="{262}" y="{py + 214}" width="56" height="34" rx="6" fill="#ffffff" stroke="#334155" stroke-width="2.5"/>'
                  f'<rect x="{318}" y="{py + 223}" width="6" height="16" rx="2" fill="#334155"/>'
                  f'<rect x="{267}" y="{py + 219}" width="34" height="24" rx="3" fill="#4ade80"/>')
            s.raw(T(252, py + 238, 'cell', 21, 700, '#334155', 'end'))
            s.arrow([(290, py + 212), (290, py + 170)], 'energy')
    else:
        s.raw(f'<rect x="60" y="{py + 122}" width="150" height="100" rx="14" fill="#334155"/>'
              f'<rect x="76" y="{py + 142}" width="54" height="60" rx="6" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>'
              f'<rect x="92" y="{py + 136}" width="22" height="8" rx="2" fill="#94a3b8"/>'
              f'<rect x="81" y="{py + 168}" width="44" height="29" rx="4" fill="#4ade80"/>'
              f'<rect x="144" y="{py + 152}" width="50" height="40" rx="5" fill="#111827"/>')
        s.raw(T(169, py + 179, 'TX', 20, 800, '#e5e7eb', 'middle'))
        s.raw(waves(212, py + 172, 3, '#1d4ed8', 0.9))
        s.arrow([(256, py + 172), (294, py + 172)], 'signal')
        s.raw(reader_unit(300, py + 112, 70, 120, 'reader'))
    lines = {0: ['Powered by the reader’s signal.', 'Replies by backscatter.', 'Cheapest and smallest; nothing to wear out.'],
             1: ['A cell runs the chip and sensors.', 'Still replies by backscatter.', 'Hears a weaker reader, further away.'],
             2: ['Sends its own signal, often on a timer.', 'Longest range; costs most.', 'Battery sets its life.']}[i]
    ty = py + 132
    for ln in lines:
        wl = wrap(ln, 24)
        s.raw(T(378, ty, '\n'.join(wl), 21, 400, '#334155'))
        ty += 27 * len(wl) + 10
s.f(4)
cy = 3 * (P + 12)
s.raw(f'<rect x="40" y="{cy}" width="640" height="300" rx="16" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(T(60, cy + 38, 'Typical read range (illustrative, log scale)', 22, 800, '#14213d'))
X0, X1 = 76, 636
def lx(m):
    return X0 + (math.log10(m) + 2) / 4 * (X1 - X0)
for m, lab in ((0.01, '1 cm'), (0.1, '10 cm'), (1, '1 m'), (10, '10 m'), (100, '100 m')):
    s.raw(f'<path d="M{lx(m):.0f},{cy + 56} L{lx(m):.0f},{cy + 262}" stroke="#e2e8f0" stroke-width="2"/>')
    s.raw(T(lx(m), cy + 286, lab, 20, 600, '#475569', 'middle'))
bars = [('Passive HF (13.56 MHz)', 0.01, 1, '#2563eb'), ('Passive UHF (860–960 MHz)', 0.1, 10, '#2563eb'),
        ('Battery-assisted passive', 0.5, 30, '#0d9488'), ('Active', 1, 100, '#7c3aed')]
for k, (lab, a, b, c) in enumerate(bars):
    y = cy + 76 + k * 48
    s.raw(T(lx(a) if k else 60, y, lab, 20, 600, '#334155'))
    s.raw(f'<rect x="{lx(a):.0f}" y="{y + 8}" width="{lx(b) - lx(a):.0f}" height="18" rx="9" fill="{c}" opacity="0.85"/>')
scenes[19] = s.render()

# ── 20 Access badge and the back end ─────────────────────────────────
s = VScene(20, 'An office badge: the door asks a server',
           'Five frames. A person taps a staff badge on a reader beside a door. The reader sends the badge’s number '
           'over a wire to a door controller. The controller asks the access-control server, which looks the number up '
           'in a permissions table of people, doors and hours, and answers allow. The controller releases the door '
           'strike and writes an audit-log entry. A warning panel explains that the number is a claim, not proof: a '
           'badge that sends only a fixed number can be copied, and the server cannot tell the copy from the original; '
           'holding a badge is also not proof of who is holding it.',
           sub='The badge carries a number. The decision lives in a server, in a table someone maintains.', h=1600)
s.f(1)
s.raw(door(50, 24, 150, 330))
s.raw(person(560, 40, 0.9, '#475569'))
s.raw(vid_badge(430, 110, 72, 'STAFF'))
s.raw(wall_reader(250, 100, 0.85))
s.arrow([(424, 175), (352, 175)], 'signal')
s.raw(badge(388, 142, 1, 'blue', 16))
s.text(470, 300, 'Tap the badge', 'sb')
s.f(2)
s.raw('<rect x="40" y="404" width="290" height="110" rx="10" fill="#f8fafc" stroke="#334155" stroke-width="2"/>')
s.raw(T(56, 440, 'Door controller', 22, 800, '#14213d'))
s.raw(T(56, 472, 'decides with the server', 21, 400, '#475569'))
s.arrow([(330, 248), (330, 398)], 'plain', 'badge number', at=(330, 324))
s.raw(badge(362, 366, 2, 'green', 16))
s.f(3)
s.raw(server(398, 404, 0.8))
s.raw(T(506, 440, 'Access-control\nserver', 21, 700, '#334155'))
s.arrow([(330, 454), (392, 454)], 'plain')
s.arrow([(446, 528), (446, 556), (185, 556), (185, 520)], 'admin')
s.raw(T(316, 588, 'allow', 21, 700, '#4b5563', 'middle'))
s.raw(badge(476, 556, 3, 'slate', 16))
ty = 732
s.raw(f'<rect x="40" y="{ty}" width="640" height="170" rx="10" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>'
      f'<rect x="40" y="{ty}" width="640" height="40" rx="10" fill="#f1f5f9"/>')
cols20 = (56, 150, 296, 440)
for hx, h in zip(cols20, ('Badge', 'Person', 'Doors', 'Hours')):
    s.raw(T(hx, ty + 28, h, 20, 800, '#14213d'))
for r, row in enumerate((('48213', 'A. Rao*', 'Lab, Lobby', '07–19'), ('48214', 'B. Lee*', 'Lobby', '08–18'),
                         ('48215', 'C. Diaz*', 'All', 'any'))):
    for hx, v in zip(cols20, row):
        s.raw(T(hx, ty + 68 + r * 30, v, 20, 400, '#334155', mono=(hx == 56)))
s.raw(T(56, ty + 156, '* fictional', 20, 400, '#64748b', italic=True))
s.f(4)
s.arrow([(226, 404), (226, 200), (210, 200)], 'energy', 'unlock', at=(226, 382))
s.raw('<rect x="194" y="170" width="10" height="60" rx="2" fill="#c2410c"/>')
s.raw(badge(166, 376, 4, 'orange', 16))
s.raw('<rect x="40" y="606" width="640" height="112" rx="10" fill="#f0fdf4" stroke="#86efac" stroke-width="2"/>')
s.raw(T(56, 636, 'Audit log', 21, 800, '#166534'))
s.raw(T(56, 668, '10:42:07 · badge 48213 · Lab door · granted', 20, 500, '#14213d', mono=True))
s.raw(T(56, 698, '10:42:09 · door opened', 20, 500, '#14213d', mono=True))
s.arrow([(80, 514), (80, 600)], 'plain')
s.f(5)
hy = 914
body20 = ('If a badge sends only a fixed number, a copy sends the same number, and the server cannot tell them apart. '
          'Stronger badges prove they hold a secret key (Scene 21). Either way, a badge shows possession of a card, '
          'not who is holding it: sites that need more add a PIN, a face check or a guard.')
bl = wrap(body20, 56)
s.rect(40, hy, 640, 70 + 27 * len(bl), 'hz', rx=14)
s.raw(badge(78, hy + 38, 5, 'red', 20))
s.raw(T(110, hy + 46, 'The number is a claim, not proof', 23, 800, '#991b1b'))
s.raw(T(60, hy + 82, '\n'.join(bl), 21, 400, '#334155'))
scenes[20] = s.render()

# ── 21 Static ID vs challenge–response ───────────────────────────────
s = VScene(21, 'Weak badge, strong badge',
           'Four frames. On the left, a static-ID badge sends the same number every time it is tapped. A copied badge, '
           'marked as a hazard, sends the identical number and the reader accepts it, because it checks only the '
           'number. On the right, a secure badge receives a fresh random challenge from the reader and answers with a '
           'response computed from the challenge and a secret key that never leaves its chip; replaying an old response '
           'fails because the next challenge is different. A table compares, at the level of concepts only, the risk '
           'of copying, replay and real-time relay for both badges, and what reduces relay risk.',
           sub='One badge repeats a number. The other proves, each time, that it holds a secret.',
           note='Conceptual comparison. No attack detail. Badge names are generic.', h=1668)
s.f(1)
s.raw(panel(40, 0, 640, 410, 'red', None, 'Static-ID badge'))
s.raw(vid_badge(66, 96, 92, 'STAFF', '#64748b'))
s.raw(wall_reader(566, 70, 0.8))
s.arrow([(164, 140), (560, 140)], 'plain', 'ID 48213 (same every time)', at=(362, 128))
s.f(2)
s.rect(56, 246, 128, 148, 'hz', rx=10)
s.raw(vid_badge(80, 270, 80, 'COPY', '#94a3b8'))
s.arrow([(164, 326), (500, 326), (500, 196), (560, 196)], 'plain', 'ID 48213: identical', at=(330, 314))
s.raw(check(546, 252, True, 16))
s.raw(T(568, 259, 'accepted', 21, 700, '#166534'))
s.raw(T(200, 384, 'The reader checks only the number.', 21, 700, '#991b1b'))
s.f(3)
s.raw(panel(40, 424, 640, 410, 'purple', None, 'Challenge–response badge'))
s.raw(vid_badge(66, 520, 92, 'SECURE', '#7c3aed'))
s.raw(lock(90, 610, 0.8, '#7c3aed'))
s.raw(wall_reader(566, 494, 0.8))
s.arrow([(560, 556), (164, 556)], 'plain', 'challenge: a fresh random number', at=(362, 528))
s.arrow([(164, 656), (560, 656)], 'crypto', 'response = f(secret key,\nchallenge)', at=(362, 628))
s.raw(T(60, 742, 'The secret key never leaves the chip.', 21, 700, '#6b21a8'))
s.raw(check(74, 778, False, 14))
s.raw(T(96, 785, 'An old response fails: the next challenge is\ndifferent.', 21, 400, '#334155'))
s.f(4)
ty = 846
cx21 = (56, 236, 458)
cw21 = (16, 20, 20)
head = ('Risk (concept only)', 'Static-ID badge', 'Challenge–response badge')
rows21 = [('Copying the credential', 'the number can be read and copied', 'key not readable, if well implemented'),
          ('Replaying an old exchange', 'works: same number each time', 'fails: fresh challenge each time'),
          ('Relaying a live exchange', 'possible in principle', 'still possible in principle')]
foot = wrap('Relay is reduced by tight timing limits (distance bounding) or a second factor such as a PIN.', 56)
hl = max(len(wrap(h, w)) for h, w in zip(head, cw21))
rl = [max(len(wrap(v, w)) for v, w in zip(r, cw21)) for r in rows21]
th = 16 + 26 * hl + sum(16 + 26 * n for n in rl) + 20 + 26 * len(foot) + 8
s.raw(f'<rect x="40" y="{ty}" width="640" height="{th}" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>'
      f'<rect x="40" y="{ty}" width="640" height="{20 + 26 * hl}" rx="12" fill="#f1f5f9"/>')
for hx, h, w in zip(cx21, head, cw21):
    s.raw(T(hx, ty + 30, '\n'.join(wrap(h, w)), 20, 800, '#14213d'))
y = ty + 20 + 26 * hl
for r, (row, n) in enumerate(zip(rows21, rl)):
    s.raw(f'<path d="M40,{y} L680,{y}" stroke="#e2e8f0" stroke-width="1.5"/>')
    for k, (hx, v, w) in enumerate(zip(cx21, row, cw21)):
        col = '#14213d' if k == 0 else ('#991b1b' if k == 1 and r < 2 else '#166534' if r < 2 else '#334155')
        s.raw(T(hx, y + 30, '\n'.join(wrap(v, w)), 20, 700 if k == 0 else 400, col))
    y += 16 + 26 * n
s.raw(T(56, y + 34, '\n'.join(foot), 20, 400, '#475569', italic=True))
scenes[21] = s.render()

# ── 22 Six ways to identify a thing ──────────────────────────────────
s = VScene(22, 'Six ways to identify a thing',
           'Four frames comparing six technologies side by side: a passive RFID tag, an NFC tag or card, a QR code, a '
           'printed serial number, a Bluetooth LE beacon and a GPS tracker. First, what powers each and its typical '
           'range: the reader’s signal or field for RFID and NFC, no power for the printed codes, its own battery for '
           'the beacon and the tracker. Second, what each reveals and to whom. Third, whether it knows its own '
           'location: only the GPS tracker does, by computing it from satellites and reporting it over a cellular '
           'network; everything else is merely detected where a reader, camera, person or phone happens to be.',
           sub='Being detected near a reader is not the same as knowing where you are.',
           note='Ranges are typical. Generic, fictional devices.', h=1701)
items = [
    ('Passive RFID tag', 'reader’s signal', 'up to several m', 'an ID, to any\nreader in range', 'the reader’s\noperator', False),
    ('NFC tag or card', 'reader’s field', 'a few cm', 'an ID or data,\non a deliberate tap', 'the phone or\nreader that taps', False),
    ('QR code', 'none: printed', 'camera’s sight', 'its printed text,\nto anyone who looks', 'the scanning app,\nif it reports', False),
    ('Printed serial', 'none: printed', 'eyesight', 'a number, to\nanyone who reads it', 'whoever\nwrites it down', False),
    ('BLE beacon', 'own battery', 'tens of m (typical)', 'an ID broadcast\nto nearby phones', 'the app that hears it,\nand its operator', False),
    ('GPS tracker', 'own battery', 'anywhere with\ncellular coverage', 'its own coordinates,\nto its service', 'the tracker’s\naccount holder', True),
]
LAB = dict(size=20, weight=700, fill='#64748b', mono=True)


def Tl(x, y, rows, size, weight, fill, step=23):
    return ''.join(T(x, y + k * step, r, size, weight, fill) for k, r in enumerate(rows))

y0 = 0
for i, (name, pw, rg, rev, who, knows) in enumerate(items):
    rgl = wrap(rg.replace('\n', ' '), 34)
    revl = wrap(rev.replace('\n', ' '), 34)
    whol = wrap(who.replace('\n', ' '), 42)
    nl = wrap(name, 13)
    lines = 1 + len(rgl) + len(revl) + 1 + 1 + len(whol)
    hh = max(23 * lines + 26, 120 + 24 * len(nl))
    x, cxm = 40, 131
    s.f(1)
    s.raw(f'<rect x="{x}" y="{y0}" width="640" height="{hh}" rx="14" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>')
    iy = y0 + 14
    if i == 0:
        s.raw(inlay(66, iy + 16, 130))
    elif i == 1:
        s.raw(card(71, iy, 120, number='', label=''))
    elif i == 2:
        s.raw(qr(93, iy, 76))
    elif i == 3:
        s.raw(f'<rect x="56" y="{iy + 4}" width="150" height="72" rx="8" fill="#e5e7eb" stroke="#64748b" stroke-width="2.5"/>'
              f'<circle cx="68" cy="{iy + 16}" r="4" fill="#64748b"/><circle cx="194" cy="{iy + 16}" r="4" fill="#64748b"/>')
        s.raw(T(cxm, iy + 38, 'SN 4F7-2209', 20, 800, '#1f2937', 'middle', mono=True))
        s.raw(T(cxm, iy + 64, 'MODEL X-1', 20, 600, '#475569', 'middle', mono=True))
    elif i == 4:
        s.raw(tag(100, iy + 38, 34))
        s.raw(waves(140, iy + 38, 3, '#1d4ed8', 0.8))
    else:
        s.raw(f'<rect x="60" y="{iy + 20}" width="120" height="60" rx="12" fill="#334155"/>'
              f'<rect x="150" y="{iy + 2}" width="10" height="22" rx="4" fill="#334155"/>'
              f'<rect x="70" y="{iy + 30}" width="64" height="30" rx="5" fill="#0ea5e9"/>'
              f'<circle cx="160" cy="{iy + 62}" r="6" fill="#22c55e"/>')
        s.raw(T(102, iy + 52, 'GPS', 20, 800, '#ffffff', 'middle'))
        s.raw(satellite(178, iy + 4, 0.4))
    s.raw(T(cxm, y0 + 120, '\n'.join(nl), 21, 800, '#14213d', 'middle'))
    ly = y0 + 32
    s.f(2)
    s.raw(T(222, ly, 'POWER', **LAB))
    s.raw(T(306, ly, pw, 20, 600, '#c2410c' if 'battery' in pw or 'reader' in pw else '#334155'))
    ly += 23
    s.raw(T(222, ly, 'RANGE', **LAB))
    s.raw(Tl(306, ly, rgl, 20, 400, '#334155'))
    ly += 23 * len(rgl)
    s.f(3)
    s.raw(T(222, ly, 'REVEALS', **LAB))
    s.raw(Tl(318, ly, revl, 20, 400, '#334155'))
    ly += 23 * len(revl)
    s.f(4)
    s.raw(T(222, ly, 'KNOWS WHERE IT IS?', **LAB))
    s.raw(check(464, ly - 7, knows, 12))
    s.raw(T(482, ly, 'Yes' if knows else 'No', 20, 700, '#166534' if knows else '#991b1b'))
    ly += 23
    s.raw(T(222, ly, 'WHO LEARNS WHERE', **LAB))
    s.raw(Tl(222, ly + 23, whol, 20, 400, '#334155'))
    y0 += hh + 6
s.f(4)
sl = wrap('Only the GPS tracker computes its own position. Everything else is detected where a reader, '
          'camera, person or phone happens to be, and it is that observer who knows “where”.', 50)
s.raw(f'<rect x="40" y="{y0 + 4}" width="640" height="{24 + 27 * len(sl)}" rx="14" fill="#eff6ff" stroke="#93c5fd" stroke-width="2"/>')
s.raw(T(60, y0 + 36, '\n'.join(sl), 21, 700, '#1e3a8a'))
scenes[22] = s.render()
