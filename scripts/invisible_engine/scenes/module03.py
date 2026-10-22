"""Module 3 scenes (18–22): RFID and adjacent physical identity.

Run scripts/invisible_engine/build.py to write the SVGs.
"""
import math
from .svgkit import Scene
from .art import *

scenes = {}


# ── local drawing helpers ────────────────────────────────────────────
def inlay(x, y, w=150, battery=False):
    """A UHF RFID inlay: a printed dipole antenna and a tiny chip on a thin label."""
    h = w * 0.36
    out = (f'<rect x="{x + 3}" y="{y + 4}" width="{w}" height="{h:.0f}" rx="6" fill="#0f172a" opacity="0.10"/>'
           f'<rect x="{x}" y="{y}" width="{w}" height="{h:.0f}" rx="6" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>')
    cy = y + h / 2
    seg = (w * 0.42) / 6
    for side in (-1, 1):
        cx = x + w / 2
        pts = [(cx + side * 10, cy)]
        for i in range(6):
            px = cx + side * (10 + (i + 1) * seg)
            py = cy + (-1) ** i * h * 0.26
            pts.append((px, py))
        out += '<path d="M' + ' L'.join(f'{a:.0f},{b:.0f}' for a, b in pts) + '" fill="none" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/>'
    out += f'<rect x="{x + w / 2 - 9:.0f}" y="{cy - 9:.0f}" width="18" height="18" rx="3" fill="#111827"/>'
    if battery:
        out += (f'<circle cx="{x + w * 0.5:.0f}" cy="{y + h + 26:.0f}" r="22" fill="#e5e7eb" stroke="#6b7280" stroke-width="3"/>'
                f'<text x="{x + w * 0.5:.0f}" y="{y + h + 31:.0f}" text-anchor="middle" style="font-size:12px;font-weight:700;fill:#374151">cell</text>')
    return out


def reader_unit(x, y, w=110, h=150, label='Reader'):
    return (f'<rect x="{x + 4}" y="{y + 6}" width="{w}" height="{h}" rx="14" fill="#0f172a" opacity="0.13"/>'
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="#1f2937"/>'
            f'<rect x="{x + 12}" y="{y + 14}" width="{w - 24}" height="{h * 0.34:.0f}" rx="6" fill="#e0f2fe"/>'
            + contactless(x + w / 2 - 10, y + 14 + h * 0.17, 0.75, '#0c4a6e', 2.4)
            + f'<circle cx="{x + w / 2:.0f}" cy="{y + h - 24}" r="7" fill="#22c55e"/>'
            + T(x + w / 2, y + h + 24, label, 16, 700, '#334155', 'middle'))


def door(x, y, w=180, h=420):
    return (f'<rect x="{x - 10}" y="{y - 10}" width="{w + 20}" height="{h + 10}" rx="4" fill="#cbd5e1"/>'
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="3" fill="#d6b48a" stroke="#92400e" stroke-width="2.5"/>'
            f'<rect x="{x + 22}" y="{y + 26}" width="{w - 44}" height="{h * 0.36:.0f}" rx="3" fill="none" stroke="#a16207" stroke-width="2"/>'
            f'<rect x="{x + 22}" y="{y + h * 0.5:.0f}" width="{w - 44}" height="{h * 0.42:.0f}" rx="3" fill="none" stroke="#a16207" stroke-width="2"/>'
            f'<circle cx="{x + w - 24}" cy="{y + h * 0.48:.0f}" r="9" fill="#64748b"/>')


def check(x, y, ok=True, r=16):
    if ok:
        return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="#16a34a"/>'
                f'<path d="M{x - r * 0.45:.0f},{y} L{x - r * 0.1:.0f},{y + r * 0.35:.0f} L{x + r * 0.5:.0f},{y - r * 0.35:.0f}" fill="none" stroke="#fff" stroke-width="{r * 0.25:.1f}" stroke-linecap="round" stroke-linejoin="round"/>')
    return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="#dc2626"/>'
            f'<path d="M{x - r * 0.38:.0f},{y - r * 0.38:.0f} L{x + r * 0.38:.0f},{y + r * 0.38:.0f} M{x + r * 0.38:.0f},{y - r * 0.38:.0f} L{x - r * 0.38:.0f},{y + r * 0.38:.0f}" stroke="#fff" stroke-width="{r * 0.25:.1f}" stroke-linecap="round"/>')


# ── 18 Passive RFID at the dock door ─────────────────────────────────
s = Scene(18, 'Passive RFID: the warehouse dock door',
          'Five frames. A pallet of boxes, each carrying a thin battery-free UHF RFID tag, passes through a dock-door '
          'portal with a reader and two antennas. The reader’s 860–960 MHz radio wave powers the tags; the reader sends '
          'commands and each tag answers in its own time slot by backscatter, changing how strongly its antenna '
          'reflects. The reader passes the tag numbers, with its own door, antenna and time, to an inventory system: '
          'the tag sends an identifier, not a location. A final panel contrasts HF tags at 13.56 MHz, which couple '
          'magnetically in the near field over centimetres to about a metre, with UHF tags, which use far-field '
          'backscatter over several metres.',
          sub='The tag says only “I am number …”. The system works out where from which reader heard it, and when.')
s.f(1)
# portal
s.raw('<rect x="100" y="210" width="28" height="400" rx="4" fill="#64748b"/><rect x="632" y="210" width="28" height="400" rx="4" fill="#64748b"/>'
      '<rect x="92" y="196" width="576" height="22" rx="5" fill="#475569"/>'
      '<rect x="128" y="400" width="24" height="190" rx="5" fill="#e2e8f0" stroke="#334155" stroke-width="2"/>'
      '<rect x="608" y="400" width="24" height="190" rx="5" fill="#e2e8f0" stroke="#334155" stroke-width="2"/>'
      '<path d="M60,612 L700,612" stroke="#94a3b8" stroke-width="3"/>')
s.raw('<rect x="305" y="150" width="150" height="40" rx="10" fill="#1f2937"/>' + T(380, 177, 'Reader', 17, 800, '#e0f2fe', 'middle'))
s.text(140, 640, 'antenna', 's', 'middle')
s.text(620, 640, 'antenna', 's', 'middle')
# pallet and boxes
s.raw('<rect x="262" y="590" width="270" height="20" rx="3" fill="#b45309"/>')
for bx, by in ((272, 520), (397, 520), (272, 450), (397, 450)):
    s.raw(box_parcel(bx, by, 100))
    s.raw(inlay(bx + 6, by + 10, 46))
s.raw(callout(700, 215, 400, 118, 'A tagged pallet arrives', 'Each box carries a paper-thin UHF tag:\nan antenna and a chip. No battery.', 'slate', 1))
s.f(2)
s.raw(waves(160, 470, 3, '#c2410c', 1.0))
s.raw(waves(600, 470, 3, '#c2410c', 1.0, dir=-1))
s.arrow([(166, 520), (264, 520)], 'energy')
s.arrow([(596, 520), (520, 520)], 'energy')
s.raw(callout(700, 348, 400, 118, 'The wave powers the tags', 'Each tag harvests a tiny amount of\nenergy from the 860–960 MHz signal.', 'orange', 2))
s.f(3)
s.biarrow([(166, 565), (264, 565)], 'signal')
s.biarrow([(520, 565), (596, 565)], 'signal')
s.raw(callout(700, 481, 400, 118, 'Each tag answers in its own slot', 'By backscatter: it switches how strongly\nits antenna reflects. Many tags a second.', 'blue', 3))
s.f(4)
s.arrow([(455, 170), (1160, 170)], 'plain', 'tag numbers + door, antenna, time', at=(808, 162))
s.raw(server(1170, 200, 1.0, 'Inventory system'))
s.raw('<rect x="1312" y="190" width="228" height="186" rx="10" fill="#f0fdf4" stroke="#86efac" stroke-width="2"/>')
s.raw(T(1326, 218, 'Read log', 17, 800, '#166534'))
for i, line in enumerate(['EPC …0457', 'EPC …0458', 'EPC …0459', 'dock door 3 · ant 2', '10:42:07']):
    s.raw(T(1326, 248 + i * 25, line, 15.5, 500, '#14213d', mono=True))
s.raw(callout(1140, 410, 400, 140, 'An ID, not a location', 'The tag sends only its number.\n“Where” is inferred: which reader\nheard it, and when.', 'green', 4))
s.f(5)
s.raw(panel(60, 655, 715, 160, 'blue', None, 'HF · 13.56 MHz · near field'))
s.raw(T(84, 732, 'Magnetic (inductive) coupling and load modulation.', 17, 400, '#334155'))
s.raw(T(84, 758, 'λ ≈ 22 m, so a reader works deep inside λ/2π ≈ 3.5 m.', 17, 400, '#334155'))
s.raw(T(84, 784, 'Reads at centimetres to about a metre (vicinity tags).', 17, 400, '#334155'))
s.coil(700, 740, 90, 70, 3, 9)
s.raw(panel(815, 655, 725, 160, 'orange', None, 'UHF · 860–960 MHz · far field'))
s.raw(T(839, 732, 'Radiative coupling; the tag replies by backscatter.', 17, 400, '#334155'))
s.raw(T(839, 758, 'λ ≈ 33 cm: a tag a metre away is three wavelengths out.', 17, 400, '#334155'))
s.raw(T(839, 784, 'Reads at several metres (typical; varies widely).', 17, 400, '#334155'))
s.raw(inlay(1400, 712, 110))
scenes[18] = s.render('Schematic. Wave arcs are illustrative. Ranges are typical, not guaranteed.')

# ── 19 Passive, battery-assisted and active tags ─────────────────────
s = Scene(19, 'Three kinds of RFID tag',
          'Four frames. A passive tag has no battery: the reader’s signal powers it and it replies by backscatter. A '
          'battery-assisted passive tag adds a small cell that runs its chip and sensors, but still replies by '
          'backscatter, so it can answer a weaker reader signal from further away. An active tag has its own battery '
          'and its own transmitter and sends its own signal, often on a timer, to readers tens of metres or more away. '
          'A range chart compares illustrative typical ranges on a logarithmic scale from one centimetre to one '
          'hundred metres, with the trade-offs: cost, size, battery life.',
          sub='The more of its own energy a tag carries, the further it reaches, and the more it costs.')
cols = [(60, 'blue', 'Passive', 'No battery'), (570, 'teal', 'Battery-assisted passive', 'Battery runs the chip'),
        (1080, 'purple', 'Active', 'Own battery and transmitter')]
for i, (x, c, t, sub) in enumerate(cols):
    s.f(i + 1)
    s.raw(panel(x, 155, 460, 400, c, i + 1, t, sub, tsize=23))
    if i < 2:
        s.raw(reader_unit(x + 30, 280, 90, 130, 'reader'))
        s.raw(inlay(x + 270, 300, 160))
        s.arrow([(x + 130, 318), (x + 262, 318)], 'energy')
        s.arrow([(x + 262, 372), (x + 130, 372)], 'signal')
        if i == 1:
            s.raw(f'<rect x="{x + 322}" y="404" width="56" height="34" rx="6" fill="#ffffff" stroke="#334155" stroke-width="2.5"/>'
                  f'<rect x="{x + 378}" y="413" width="6" height="16" rx="2" fill="#334155"/>'
                  f'<rect x="{x + 327}" y="409" width="34" height="24" rx="3" fill="#4ade80"/>')
            s.raw(T(x + 300, 427, 'cell', 15, 700, '#334155', 'end'))
            s.arrow([(x + 350, 402), (x + 350, 364)], 'energy')
    else:
        s.raw('<rect x="1115" y="300" width="150" height="100" rx="14" fill="#334155"/>'
              '<rect x="1131" y="320" width="54" height="60" rx="6" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>'
              '<rect x="1147" y="314" width="22" height="8" rx="2" fill="#94a3b8"/>'
              '<rect x="1136" y="346" width="44" height="29" rx="4" fill="#4ade80"/>'
              '<rect x="1199" y="330" width="50" height="40" rx="5" fill="#111827"/>')
        s.raw(T(1224, 355, 'TX', 15, 800, '#e5e7eb', 'middle'))
        s.raw(waves(1270, 350, 3, '#1d4ed8', 1.1))
        s.arrow([(1330, 350), (1410, 350)], 'signal')
        s.raw(reader_unit(1420, 280, 90, 130, 'reader'))
    lines = {0: ['Powered by the reader’s signal.', 'Replies by backscatter.', 'Cheapest and smallest; nothing to wear out.'],
             1: ['A cell runs the chip and sensors.', 'Still replies by backscatter.', 'Hears a weaker reader, further away.'],
             2: ['Sends its own signal, often on a timer.', 'Longest range; costs most.', 'Battery sets its life.']}[i]
    for j, ln in enumerate(lines):
        s.raw(T(x + 28, 476 + j * 26, ln, 17, 400, '#334155'))
s.f(4)
s.raw('<rect x="60" y="585" width="1480" height="232" rx="16" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(T(84, 622, 'Typical read range (illustrative, log scale)', 19, 800, '#14213d'))
X0, X1 = 380, 1500
def lx(m):
    return X0 + (math.log10(m) + 2) / 4 * (X1 - X0)
for m, lab in ((0.01, '1 cm'), (0.1, '10 cm'), (1, '1 m'), (10, '10 m'), (100, '100 m')):
    s.raw(f'<path d="M{lx(m):.0f},640 L{lx(m):.0f},780" stroke="#e2e8f0" stroke-width="2"/>')
    s.raw(T(lx(m), 803, lab, 15, 600, '#475569', 'middle'))
bars = [('Passive HF (13.56 MHz)', 0.01, 1, '#2563eb'), ('Passive UHF (860–960 MHz)', 0.1, 10, '#2563eb'),
        ('Battery-assisted passive', 0.5, 30, '#0d9488'), ('Active', 1, 100, '#7c3aed')]
for k, (lab, a, b, c) in enumerate(bars):
    y = 650 + k * 32
    s.raw(T(84, y + 19, lab, 16, 600, '#334155'))
    s.raw(f'<rect x="{lx(a):.0f}" y="{y + 4}" width="{lx(b) - lx(a):.0f}" height="20" rx="10" fill="{c}" opacity="0.85"/>')
scenes[19] = s.render('Ranges are illustrative: reader power, antennas, regulation and surroundings change them.')

# ── 20 Access badge and the back end ─────────────────────────────────
s = Scene(20, 'An office badge: the door asks a server',
          'Five frames. A person taps a staff badge on a reader beside a door. The reader sends the badge’s number '
          'over a wire to a door controller. The controller asks the access-control server, which looks the number up '
          'in a permissions table of people, doors and hours, and answers allow. The controller releases the door '
          'strike and writes an audit-log entry. A warning panel explains that the number is a claim, not proof: a '
          'badge that sends only a fixed number can be copied, and the server cannot tell the copy from the original; '
          'holding a badge is also not proof of who is holding it.',
          sub='The badge carries a number. The decision lives in a server, in a table someone maintains.')
s.f(1)
s.raw(door(440, 200, 170, 410))
s.raw(person(130, 370, 1.0, '#475569'))
s.raw(id_badge(176, 400, 50, 'STAFF'))
s.raw(wall_reader(300, 360, 0.85))
s.arrow([(232, 445), (296, 445)], 'signal')
s.raw(badge(264, 410, 1, 'blue', 16))
s.text(60, 628, 'Tap the badge', 'sb')
s.f(2)
s.raw(chip_box(700, 290, 230, 110, 'Door controller', 'decides with the server', 'slate'))
s.arrow([(347, 356), (347, 172), (815, 172), (815, 284)], 'plain', 'badge number', at=(600, 162))
s.raw(badge(372, 210, 2, 'green', 16))
s.f(3)
s.raw(server(1000, 205, 1.0, 'Access-control server'))
s.arrow([(930, 330), (994, 330)], 'plain')
s.raw('<rect x="1150" y="190" width="390" height="190" rx="10" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>'
      '<rect x="1150" y="190" width="390" height="38" rx="10" fill="#f1f5f9"/>')
for j, (hx, h) in enumerate(((1164, 'Badge'), (1250, 'Person'), (1372, 'Doors'), (1468, 'Hours'))):
    s.raw(T(hx, 216, h, 15.5, 800, '#14213d'))
for r, row in enumerate((('48213', 'A. Rao*', 'Lab, Lobby', '07–19'), ('48214', 'B. Lee*', 'Lobby', '08–18'),
                         ('48215', 'C. Diaz*', 'All', 'any'))):
    for (hx, _), v in zip(((1164, 0), (1250, 0), (1372, 0), (1468, 0)), row):
        s.raw(T(hx, 258 + r * 34, v, 15.5, 400, '#334155', mono=(hx == 1164)))
s.raw(T(1164, 366, '* fictional', 13.5, 400, '#64748b', italic=True))
s.arrow([(1060, 392), (1060, 428), (900, 428), (900, 408)], 'admin')
s.raw(T(1000, 452, 'allow', 17, 700, '#4b5563', 'middle'))
s.raw(badge(1110, 410, 3, 'slate', 16))
s.f(4)
s.arrow([(700, 370), (616, 370)], 'energy', 'unlock', at=(658, 352))
s.raw('<rect x="604" y="340" width="10" height="60" rx="2" fill="#c2410c"/>')
s.raw(badge(658, 400, 4, 'orange', 16))
s.raw('<rect x="700" y="480" width="440" height="120" rx="10" fill="#f0fdf4" stroke="#86efac" stroke-width="2"/>')
s.raw(T(718, 512, 'Audit log', 17, 800, '#166534'))
s.raw(T(718, 542, '10:42:07 · badge 48213 · Lab door · granted', 15.5, 500, '#14213d', mono=True))
s.raw(T(718, 572, '10:42:09 · door opened', 15.5, 500, '#14213d', mono=True))
s.arrow([(815, 400), (815, 474)], 'plain')
s.f(5)
s.rect(60, 655, 1480, 158, 'hz', rx=14)
s.raw(badge(100, 700, 5, 'red', 20))
s.raw(T(132, 708, 'The number is a claim, not proof', 22, 800, '#991b1b'))
s.raw(T(132, 742, 'If a badge sends only a fixed number, a copy sends the same number, and the server cannot tell them apart.', 17, 400, '#334155'))
s.raw(T(132, 768, 'Stronger badges prove they hold a secret key (Scene 21). Either way, a badge shows possession of a card,', 17, 400, '#334155'))
s.raw(T(132, 794, 'not who is holding it: sites that need more add a PIN, a face check or a guard.', 17, 400, '#334155'))
scenes[20] = s.render()

# ── 21 Static ID vs challenge–response ───────────────────────────────
s = Scene(21, 'Weak badge, strong badge',
          'Four frames. A static-ID badge sends the same number every time it is tapped. A copied badge, '
          'marked as a hazard, sends the identical number and the reader accepts it, because it checks only the '
          'number. A secure badge, by contrast, receives a fresh random challenge from the reader and answers with a '
          'response computed from the challenge and a secret key that never leaves its chip; replaying an old response '
          'fails because the next challenge is different. A table compares, at the level of concepts only, the risk '
          'of copying, replay and real-time relay for both badges, and what reduces relay risk.',
          sub='One badge repeats a number. The other proves, each time, that it holds a secret.')
s.f(1)
s.raw(panel(60, 150, 720, 420, 'red', None, 'Static-ID badge'))
s.raw(id_badge(110, 240, 96, 'STAFF', '#64748b'))
s.raw(wall_reader(600, 235, 0.9))
s.arrow([(214, 300), (594, 300)], 'plain', 'ID 48213 (same every time)', at=(404, 290))
s.f(2)
s.rect(92, 408, 140, 146, 'hz', rx=10)
s.raw(id_badge(122, 428, 76, 'COPY', '#94a3b8'))
s.arrow([(206, 486), (520, 486), (520, 400), (594, 400)], 'plain', 'ID 48213: identical', at=(370, 476))
s.raw(check(660, 430, True, 16))
s.raw(T(682, 436, 'accepted', 16, 700, '#166534'))
s.raw(T(250, 540, 'The reader checks only the number.', 17, 700, '#991b1b'))
s.f(3)
s.raw(panel(820, 150, 720, 420, 'purple', None, 'Challenge–response badge'))
s.raw(id_badge(870, 240, 96, 'SECURE', '#7c3aed'))
s.raw(lock(898, 324, 0.8, '#7c3aed'))
s.raw(wall_reader(1360, 235, 0.9))
s.arrow([(1354, 290), (974, 290)], 'plain', 'challenge: a fresh random number', at=(1164, 280))
s.arrow([(974, 360), (1354, 360)], 'crypto', 'response = f(secret key, challenge)', at=(1164, 350))
s.raw(T(860, 470, 'The secret key never leaves the chip.', 17, 700, '#6b21a8'))
s.raw(check(872, 518, False, 14))
s.raw(T(894, 524, 'An old response fails: the next challenge is different.', 17, 400, '#334155'))
s.f(4)
s.raw('<rect x="60" y="595" width="1480" height="220" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>'
      '<rect x="60" y="595" width="1480" height="44" rx="12" fill="#f1f5f9"/>')
cx = (84, 440, 920)
for hx, h in zip(cx, ('Risk (concept only)', 'Static-ID badge', 'Challenge–response badge')):
    s.raw(T(hx, 624, h, 17, 800, '#14213d'))
rows = [('Copying the credential', 'the number can be read and copied', 'key not readable, if well implemented'),
        ('Replaying an old exchange', 'works: same number each time', 'fails: fresh challenge each time'),
        ('Relaying a live exchange', 'possible in principle', 'still possible in principle')]
for r, row in enumerate(rows):
    y = 672 + r * 44
    s.raw(f'<path d="M60,{y - 26} L1540,{y - 26}" stroke="#e2e8f0" stroke-width="1.5"/>')
    s.raw(T(cx[0], y, row[0], 16.5, 700, '#14213d'))
    s.raw(T(cx[1], y, row[1], 16.5, 400, '#991b1b' if r < 2 else '#334155'))
    s.raw(T(cx[2], y, row[2], 16.5, 400, '#166534' if r < 2 else '#334155'))
s.raw(T(84, 800, 'Relay is reduced by tight timing limits (distance bounding) or a second factor such as a PIN.', 15.5, 400, '#475569', italic=True))
scenes[21] = s.render('Conceptual comparison. No attack detail. Badge names are generic.')

# ── 22 Six ways to identify a thing ──────────────────────────────────
s = Scene(22, 'Six ways to identify a thing',
          'Four frames comparing six technologies side by side: a passive RFID tag, an NFC tag or card, a QR code, a '
          'printed serial number, a Bluetooth LE beacon and a GPS tracker. First, what powers each and its typical '
          'range: the reader’s signal or field for RFID and NFC, no power for the printed codes, its own battery for '
          'the beacon and the tracker. Second, what each reveals and to whom. Third, whether it knows its own '
          'location: only the GPS tracker does, by computing it from satellites and reporting it over a cellular '
          'network; everything else is merely detected where a reader, camera, person or phone happens to be.',
          sub='Being detected near a reader is not the same as knowing where you are.')
items = [
    ('Passive RFID tag', 'reader’s signal', 'up to several m', 'an ID, to any\nreader in range', 'the reader’s\noperator', False),
    ('NFC tag or card', 'reader’s field', 'a few cm', 'an ID or data,\non a deliberate tap', 'the phone or\nreader that taps', False),
    ('QR code', 'none: printed', 'camera’s sight', 'its printed text,\nto anyone who looks', 'the scanning app,\nif it reports', False),
    ('Printed serial', 'none: printed', 'eyesight', 'a number, to\nanyone who reads it', 'whoever\nwrites it down', False),
    ('BLE beacon', 'own battery', 'tens of m (typical)', 'an ID broadcast\nto nearby phones', 'the app that hears it,\nand its operator', False),
    ('GPS tracker', 'own battery', 'anywhere with\ncellular coverage', 'its own coordinates,\nto its service', 'the tracker’s\naccount holder', True),
]
W = 236
for i, (name, pw, rg, rev, who, knows) in enumerate(items):
    x = 60 + i * (W + 12)
    s.f(1)
    s.raw(f'<rect x="{x}" y="150" width="{W}" height="545" rx="14" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>')
    cxm = x + W / 2
    if i == 0:
        s.raw(inlay(x + 28, 200, 180))
    elif i == 1:
        s.raw(card(x + 33, 180, 170, number='', label=''))
    elif i == 2:
        s.raw(qr(x + 63, 170, 110))
    elif i == 3:
        s.raw(f'<rect x="{x + 28}" y="195" width="180" height="76" rx="8" fill="#e5e7eb" stroke="#64748b" stroke-width="2.5"/>'
              f'<circle cx="{x + 42}" cy="209" r="4" fill="#64748b"/><circle cx="{x + 194}" cy="209" r="4" fill="#64748b"/>')
        s.raw(T(cxm, 230, 'SN 4F7-2209', 19, 800, '#1f2937', 'middle', mono=True))
        s.raw(T(cxm, 256, 'MODEL X-1', 13, 600, '#475569', 'middle', mono=True))
    elif i == 4:
        s.raw(tag(x + 90, 228, 44))
        s.raw(waves(x + 140, 228, 3, '#1d4ed8', 0.9))
    else:
        s.raw(tracker_box(x + 38, 205, 0.85))
        s.raw(satellite(x + 170, 180, 0.55))
    s.raw(T(cxm, 318, name, 18, 800, '#14213d', 'middle'))
    s.f(2)
    s.raw(T(x + 16, 352, 'POWER', 12.5, 700, '#64748b', mono=True))
    s.raw(T(x + 16, 374, pw, 16, 600, '#c2410c' if 'battery' in pw or 'reader' in pw else '#334155'))
    s.raw(T(x + 16, 404, 'RANGE', 12.5, 700, '#64748b', mono=True))
    s.raw(T(x + 16, 426, rg, 16, 400, '#334155'))
    s.f(3)
    s.raw(T(x + 16, 478, 'REVEALS', 12.5, 700, '#64748b', mono=True))
    s.raw(T(x + 16, 500, rev, 16, 400, '#334155'))
    s.f(4)
    s.raw(T(x + 16, 566, 'KNOWS WHERE IT IS?', 12.5, 700, '#64748b', mono=True))
    s.raw(check(x + 30, 590, knows, 13))
    s.raw(T(x + 52, 596, 'Yes' if knows else 'No', 16, 700, '#166534' if knows else '#991b1b'))
    s.raw(T(x + 16, 632, 'WHO LEARNS WHERE', 12.5, 700, '#64748b', mono=True))
    s.raw(T(x + 16, 654, who, 15.5, 400, '#334155'))
s.f(4)
s.raw('<rect x="60" y="712" width="1480" height="100" rx="14" fill="#eff6ff" stroke="#93c5fd" stroke-width="2"/>')
s.raw(T(84, 752, 'Only the GPS tracker computes its own position. Everything else is detected where a reader,', 18, 700, '#1e3a8a'))
s.raw(T(84, 780, 'camera, person or phone happens to be, and it is that observer who knows “where”.', 18, 700, '#1e3a8a'))
scenes[22] = s.render('Ranges are typical. Generic, fictional devices.')
