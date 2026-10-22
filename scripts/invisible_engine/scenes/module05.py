"""Module 5 scenes (31–41): AirTag life cycle, finding network and handshakes.
Run scripts/invisible_engine/build.py to write the SVGs."""
from .svgkit import Scene
from .art import *

scenes = {}


# ── local helpers (Module 5 only) ───────────────────────────────────
def screen_sheet(x, y, w, h, title, body, button=None, color='#2563eb'):
    """A bottom sheet drawn on a phone screen."""
    out = (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>'
           + T(x + w / 2, y + 34, title, 17, 800, '#14213d', 'middle')
           + T(x + w / 2, y + 60, body, 13.5, 400, '#475569', 'middle'))
    if button:
        out += (f'<rect x="{x + 14}" y="{y + h - 48}" width="{w - 28}" height="36" rx="10" fill="{color}"/>'
                + T(x + w / 2, y + h - 24, button, 15, 700, '#ffffff', 'middle'))
    return out


def cell_tower(x, y, s=1.0, color='#475569'):
    """A lattice cell tower; (x, y) is the base centre, about 120 tall at s=1."""
    h = 120 * s
    return (f'<path d="M{x - 26 * s:.0f},{y} L{x},{y - h:.0f} L{x + 26 * s:.0f},{y} M{x - 18 * s:.0f},{y - h * 0.3:.0f} L{x + 18 * s:.0f},{y - h * 0.3:.0f} '
            f'M{x - 10 * s:.0f},{y - h * 0.6:.0f} L{x + 10 * s:.0f},{y - h * 0.6:.0f}" fill="none" stroke="{color}" stroke-width="{4 * s:.1f}" stroke-linejoin="round"/>'
            f'<circle cx="{x}" cy="{y - h:.0f}" r="{6 * s:.0f}" fill="{color}"/>'
            + waves(x + 2 * s, y - h, 2, color, 0.7 * s) + waves(x - 2 * s, y - h, 2, color, 0.7 * s, dir=-1))


def wifi_ap(x, y, s=1.0, color='#475569'):
    """A Wi-Fi access point: a small box with two antennas; (x, y) top-left, 110 x 50."""
    return (f'<rect x="{x}" y="{y}" width="{110 * s:.0f}" height="{40 * s:.0f}" rx="{8 * s:.0f}" fill="#e2e8f0" stroke="{color}" stroke-width="3"/>'
            f'<path d="M{x + 20 * s:.0f},{y} L{x + 12 * s:.0f},{y - 40 * s:.0f} M{x + 90 * s:.0f},{y} L{x + 98 * s:.0f},{y - 40 * s:.0f}" stroke="{color}" stroke-width="{5 * s:.1f}" stroke-linecap="round"/>'
            + ''.join(f'<circle cx="{x + (30 + 16 * i) * s:.0f}" cy="{y + 20 * s:.0f}" r="{4 * s:.0f}" fill="#22c55e"/>' for i in range(3)))


def envelope(x, y, w=120, color='#7c3aed', fill='#f5f3ff'):
    h = w * 0.66
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h:.0f}" rx="8" fill="{fill}" stroke="{color}" stroke-width="3"/>'
            f'<path d="M{x},{y + 6} L{x + w / 2:.0f},{y + h * 0.55:.0f} L{x + w},{y + 6}" fill="none" stroke="{color}" stroke-width="3"/>')


def cross(x, y, r=26, color='#475569'):
    """A circled cross: 'not present / does not happen'."""
    return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="#ffffff" stroke="{color}" stroke-width="4"/>'
            f'<path d="M{x - r * 0.45:.0f},{y - r * 0.45:.0f} L{x + r * 0.45:.0f},{y + r * 0.45:.0f} M{x + r * 0.45:.0f},{y - r * 0.45:.0f} L{x - r * 0.45:.0f},{y + r * 0.45:.0f}" stroke="{color}" stroke-width="5" stroke-linecap="round"/>')


def chip(x, y, label, kind):
    """Evidence chip: documented / inferred / undisclosed."""
    st = {'doc': ('#1e40af', '#eff6ff', '#93c5fd', ''), 'inf': ('#6b21a8', '#faf5ff', '#d8b4fe', ''),
          'und': ('#374151', '#ffffff', '#6b7280', ' stroke-dasharray="6 4"')}[kind]
    w = len(label) * 8.4 + 22
    return (f'<rect x="{x}" y="{y}" width="{w:.0f}" height="28" rx="14" fill="{st[1]}" stroke="{st[2]}" stroke-width="2"{st[3]}/>'
            + T(x + w / 2, y + 19, label, 13, 700, st[0], 'middle', mono=True))


def speaker(x, y, s=1.0, color='#334155'):
    return (f'<path d="M{x},{y - 10 * s:.0f} L{x + 12 * s:.0f},{y - 10 * s:.0f} L{x + 28 * s:.0f},{y - 24 * s:.0f} L{x + 28 * s:.0f},{y + 24 * s:.0f} L{x + 12 * s:.0f},{y + 10 * s:.0f} L{x},{y + 10 * s:.0f} Z" fill="{color}"/>'
            + ''.join(f'<path d="M{x + (38 + 10 * i) * s:.0f},{y - (10 + 7 * i) * s:.0f} q{(8 + 4 * i) * s:.0f},{(10 + 7 * i) * s:.0f} 0,{(20 + 14 * i) * s:.0f}" fill="none" stroke="{color}" stroke-width="{3.5 * s:.1f}" stroke-linecap="round"/>' for i in range(3)))


def map_tile(x, y, w, h):
    """A simple street map rectangle."""
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="#ecfdf5" stroke="#94a3b8" stroke-width="2"/>'
    out += f'<path d="M{x},{y + h * 0.35:.0f} L{x + w},{y + h * 0.55:.0f} M{x + w * 0.3:.0f},{y} L{x + w * 0.45:.0f},{y + h} M{x + w * 0.7:.0f},{y} L{x + w * 0.62:.0f},{y + h}" stroke="#ffffff" stroke-width="9"/>'
    out += f'<path d="M{x},{y + h * 0.35:.0f} L{x + w},{y + h * 0.55:.0f} M{x + w * 0.3:.0f},{y} L{x + w * 0.45:.0f},{y + h} M{x + w * 0.7:.0f},{y} L{x + w * 0.62:.0f},{y + h}" stroke="#cbd5e1" stroke-width="1.5"/>'
    out += f'<rect x="{x + w * 0.05:.0f}" y="{y + h * 0.62:.0f}" width="{w * 0.18:.0f}" height="{h * 0.25:.0f}" rx="4" fill="#bbf7d0"/>'
    return out


def bound_raw(x, y, w, h, label=None, rx=16):
    """A thick trust boundary drawn without the legend class (used where the legend would overflow).
    The label sits on the bottom edge."""
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="none" stroke="#14213d" stroke-width="5"/>'
    if label:
        out += (f'<rect x="{x + 14}" y="{y + h - 13}" width="{len(label) * 8.6 + 16:.0f}" height="26" rx="5" fill="#14213d"/>'
                + T(x + 22, y + h + 6, label, 14.5, 700, '#ffffff'))
    return out


def tag_label(x, y, text='item tracker'):
    return T(x, y, text, 15, 600, '#475569', 'middle')


# ── 31 First-time setup ─────────────────────────────────────────────
s = Scene(31, 'First-time setup: from a new tag to a named item',
          'Five frames. A new item tracker is held next to the owner’s iPhone, which notices it at close range; the iPhone '
          'shows a Connect prompt; after the owner taps Connect and Continue, the item is registered to the owner’s Apple '
          'Account, which needs two-factor authentication; the item now appears in Find My with the name the owner chose; '
          'and a note that these are Apple’s documented user steps, not a public trace of the messages underneath.',
          sub='Apple documents the steps you see. The messages underneath are mostly not public.')
s.f(1)
s.raw(phone(120, 190, 230, 460, '#f1f5f9'))
s.raw(T(235, 270, 'Find My', 20, 800, '#14213d', 'middle'))
s.raw(tag(520, 470, 54))
s.raw(tag_label(520, 556, 'new item tracker'))
s.raw(waves(468, 470, 2, '#2563eb', 1.0, dir=-1))
s.raw(callout(430, 180, 420, 140, 'Hold it near the iPhone', 'Pull the battery tab and hold the new\ntag next to an unlocked iPhone. Close\nrange is part of the setup step.', 'blue', 1, 19, 16))
s.raw(leader(560, 320, 520, 410, '#93c5fd'))
s.f(2)
s.raw(screen_sheet(146, 440, 178, 170, 'AirTag', 'Hold near iPhone', 'Connect'))
s.raw(callout(430, 600, 420, 112, 'The Connect prompt', 'The iPhone offers to add the item.\nNothing is linked until the owner agrees.', 'green', 2, 19, 16))
s.raw(leader(430, 650, 330, 600, '#86efac'))
s.f(3)
s.raw(cloud(1120, 190, 340, 'Apple Account'))
s.raw(T(1290, 410, 'two-factor authentication required', 16, 600, '#475569', 'middle'))
s.arrow([(360, 372), (1150, 372)], 'admin', 'Continue: register to my account', at=(990, 342))
s.raw(callout(920, 450, 620, 140, 'Explicit account linking', 'The owner taps Continue. The item is registered to their\nApple Account. One account at a time: to give the tag away,\nthe owner removes it from their account first.', 'slate', 3, 19, 16))
s.f(4)
s.raw('<rect x="146" y="226" width="178" height="392" rx="22" fill="#f8fafc"/>')
s.raw(T(235, 270, 'Items', 20, 800, '#14213d', 'middle'))
s.raw('<rect x="160" y="300" width="150" height="70" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>'
      '<circle cx="190" cy="335" r="18" fill="#e5e7eb" stroke="#94a3b8" stroke-width="2"/>')
s.raw(T(220, 330, 'Keys', 18, 800, '#14213d'))
s.raw(T(220, 352, 'with you', 13.5, 400, '#475569'))
s.raw(callout(920, 610, 620, 110, 'A named item in Find My', 'The owner chose the name (here “Keys”). The item now\nappears in the Items list on their devices.', 'blue', 4, 19, 16))
s.f(5)
s.raw(panel(60, 730, 840, 90, 'amber', 5, 'User steps, not a packet trace', None, 19))
s.raw(T(140, 805, 'What travels between tag, phone and Apple during setup is mostly undisclosed (Scene 32).', 15.5, 400, '#334155'))
scenes[31] = s.render('Steps: Apple Support. Schematic.')

# ── 32 Registration layers ──────────────────────────────────────────
s = Scene(32, 'What setup actually establishes, layer by layer',
          'Six frames, one layer each, every layer marked documented, inferred or undisclosed. 1, the tag’s hardware '
          'identity: a serial number is documented, factory key material is not disclosed. 2, the onboarding transport: a '
          'short-range radio exchange with the owner’s iPhone, inferred from the documented hold-it-near step. 3, user '
          'authorisation: the owner taps Connect on a device signed in to an Apple Account with two-factor authentication, '
          'documented. 4, account registration: the item is linked to one Apple Account, documented; the message format is '
          'undisclosed. 5, key provisioning: the owner’s device creates a key pair and secret for rotating identifiers, '
          'documented in Apple Platform Security; the exact exchange is undisclosed. 6, revocation and transfer: Remove Item '
          'unlinks the item, documented; the cryptographic mechanism is undisclosed.',
          sub='Six things get set up. Apple documents some of them; the rest we can only infer, or not see at all.')
rows = [
    ('Tag hardware identity', 'A serial number, readable on the tag and by NFC.', [('DOCUMENTED: serial', 'doc'), ('UNDISCLOSED: factory keys', 'und')], 'slate'),
    ('Onboarding transport', 'A short-range radio exchange with the owner’s iPhone.', [('INFERRED: close-range radio', 'inf'), ('UNDISCLOSED: messages', 'und')], 'blue'),
    ('User authorisation', 'Owner taps Connect on a device signed in with two-factor auth.', [('DOCUMENTED', 'doc')], 'green'),
    ('Account registration', 'The item is linked to one Apple Account at a time.', [('DOCUMENTED: behaviour', 'doc'), ('UNDISCLOSED: format', 'und')], 'slate'),
    ('Key provisioning', 'Owner device makes a P-224 key pair and secret for rotating keys.', [('DOCUMENTED: design', 'doc'), ('UNDISCLOSED: exchange', 'und')], 'purple'),
    ('Revocation / transfer', 'Remove Item unlinks it; then another account can add it.', [('DOCUMENTED: behaviour', 'doc'), ('UNDISCLOSED: mechanism', 'und')], 'amber'),
]
for i, (name, what, chips, col) in enumerate(rows):
    s.f(i + 1)
    y = 156 + i * 104
    c, light, border = STEP[col]
    s.raw(f'<rect x="60" y="{y}" width="1480" height="94" rx="14" fill="{light}" stroke="{border}" stroke-width="2"/>')
    s.raw(badge(104, y + 48, i + 1, col, 24))
    s.raw(T(146, y + 42, name, 21, 800, '#14213d'))
    s.raw(T(146, y + 72, what, 16.5, 400, '#334155'))
    cx = 1000
    for lab, k in chips:
        s.raw(chip(cx, y + 34, lab, k))
        cx += len(lab) * 8.4 + 22 + 14
s.raw(T(1020, 810, 'Key:', 15, 700, '#334155', 'end') + chip(1032, 790, 'DOCUMENTED', 'doc') + chip(1172, 790, 'INFERRED', 'inf') + chip(1292, 790, 'UNDISCLOSED', 'und'))
scenes[32] = s.render()

# ── 33 Far-away luggage ─────────────────────────────────────────────
s = Scene(33, 'Far-away luggage: a tag that does not know where it is',
          'Four frames. A suitcase with an item tracker is left on a station platform while its owner is far away; the tag '
          'has no satellite receiver and no cellular connection, shown crossed out; what it does have is a coin cell and a '
          'Bluetooth Low Energy radio that whispers a short advertisement over and over; and a question: who knows where it '
          'is? Someone else’s phone, in the next scene.',
          sub='No map, no satellite, no SIM. Just a coin cell and a short-range whisper.')
s.f(1)
s.raw('<rect x="60" y="560" width="900" height="40" fill="#cbd5e1"/><rect x="60" y="600" width="900" height="16" fill="#94a3b8"/>'
      '<path d="M60,640 L960,640 M60,668 L960,668" stroke="#64748b" stroke-width="5"/>')
s.raw('<rect x="120" y="230" width="190" height="62" rx="8" fill="#1e3a8a"/>')
s.raw(T(215, 270, 'Platform 3', 22, 800, '#ffffff', 'middle'))
s.raw('<path d="M215,292 L215,560" stroke="#334155" stroke-width="6"/>')
s.raw(suitcase(420, 370, 1.0))
s.raw(tag(600, 400, 30))
s.raw('<path d="M570,400 L556,400" stroke="#334155" stroke-width="3"/>')
s.raw(person(1390, 310, 1.0, '#64748b', phone_in_hand=True))
s.raw(T(1390, 566, 'the owner, 200 km away', 17, 600, '#334155', 'middle'))
s.raw('<path d="M1060,450 L1300,450" stroke="#94a3b8" stroke-width="3" stroke-dasharray="4 10"/>')
s.raw(callout(60, 690, 440, 120, 'Left behind', 'The suitcase stays on the platform.\nThe owner is far away (illustrative).', 'slate', 1, 19, 16))
s.f(2)
s.raw(satellite(760, 210, 1.0))
s.raw(cross(760, 270, 22))
s.raw(cell_tower(900, 330, 0.9))
s.raw(cross(900, 270, 22))
s.raw(callout(520, 690, 480, 120, 'No GPS, no cellular', 'The tag has no satellite receiver and no\nSIM or mobile modem. It cannot look itself up.', 'red', 2, 19, 16))
s.f(3)
s.raw(waves(632, 400, 3, '#2563eb', 1.1))
s.raw(coin_cell(1130, 330, 46))
s.raw(T(1130, 404, 'coin cell', 16, 600, '#334155', 'middle'))
s.raw(callout(1030, 160, 470, 120, 'What it does have', 'A Bluetooth Low Energy radio that repeats\na short advertisement, and a coin cell.', 'blue', 3, 19, 16))
s.f(4)
s.raw(callout(1020, 700, 520, 110, 'So who knows where it is?', 'Not the tag. A passing phone that knows\nwhere it is itself — Scene 34.', 'green', 4, 19, 16))
scenes[33] = s.render('Radio arcs illustrative.')

# ── 34 Finder sees the whisper ───────────────────────────────────────
s = Scene(34, 'A passer-by’s phone overhears the whisper',
          'Four frames. The tag in the suitcase repeats a Bluetooth advertisement carrying a rotating public key; a '
          'passer-by’s participating iPhone, within radio range, receives it one way; there is no pairing, no handshake and '
          'no reply to the tag, shown crossed out; and the finder’s phone handles it in the background as an observation, '
          'not a connection to the owner or to the tag.',
          sub='One-way: the tag talks, a phone listens. Nobody pairs, nobody connects.')
s.f(1)
s.raw(suitcase(150, 360, 1.0))
s.raw(tag(330, 390, 30))
s.raw(waves(362, 390, 3, '#2563eb', 1.1))
s.raw(callout(60, 640, 520, 150, 'The tag repeats an advertisement', 'A short Bluetooth LE broadcast with a\nrotating public key in it — no name, no\nowner, no location.', 'blue', 1, 19, 16))
s.f(2)
s.raw(person(940, 220, 1.15, '#475569', phone_in_hand=True))
s.arrow([(430, 390), (895, 390)], 'signal', 'BLE advertisement (rotating key)', at=(690, 350))
s.raw(callout(620, 640, 460, 150, 'A participating iPhone hears it', 'Any nearby Apple device in the Find My\nnetwork that is in range may pick it up.\nReception is not guaranteed.', 'blue', 2, 19, 16))
s.f(3)
s.raw('<path d="M960,470 L440,470" stroke="#94a3b8" stroke-width="4" stroke-dasharray="10 10"/>')
s.raw(cross(700, 470, 24))
s.raw(T(700, 530, 'no pairing · no handshake · no reply', 18, 700, '#475569', 'middle'))
s.raw(callout(1120, 640, 420, 150, 'Not a connection', 'The tag never learns who heard it.\nThe finder’s phone sees only a\nrandom-looking key.', 'slate', 3, 19, 16))
s.f(4)
s.raw(callout(1120, 300, 420, 180, 'An observation', 'The finder does nothing and is not\nasked. The phone handles it in the\nbackground; neither the owner nor\nthe tag connects to it.', 'green', 4, 19, 16))
scenes[34] = s.render('Radio arcs illustrative.')

# ── 35 Whose location is used? ───────────────────────────────────────
s = Scene(35, 'Whose location is it? The finder phone’s own',
          'Four frames. The tag’s whisper reaches the finder phone carrying no location; the finder phone works out its own '
          'approximate position from satellites, Wi-Fi access points and cell towers, as it would for a map; the phone '
          'records a sighting: its own estimated position and the time, meaning the tag was somewhere within radio range '
          'of this point; and the tag never asks a satellite anything, shown crossed out.',
          sub='The tag has no position to give. The sighting uses where the finder’s phone thinks it is.')
s.f(1)
s.raw(tag(170, 520, 40))
s.raw(tag_label(170, 590))
s.raw(phone(700, 360, 150, 300, '#f8fafc'))
s.arrow([(220, 520), (690, 520)], 'signal', 'whisper: key, no location', at=(450, 486))
s.raw(callout(60, 640, 470, 120, 'The whisper has no position in it', 'Only a rotating key. The tag does not\nknow where it is.', 'blue', 1, 19, 16))
s.f(2)
s.raw(satellite(560, 200, 1.0) + satellite(1000, 190, 1.0))
s.raw(wifi_ap(1180, 410, 1.0))
s.raw(cell_tower(1180, 730, 1.0))
s.arrow([(590, 230), (730, 350)], 'signal')
s.arrow([(980, 220), (830, 350)], 'signal')
s.arrow([(1170, 430), (860, 470)], 'signal')
s.arrow([(1150, 650), (860, 580)], 'signal')
s.raw(callout(1060, 160, 480, 140, 'The phone finds itself', 'Satellites (GNSS), Wi-Fi and cell towers,\nfused as for any map app. An estimate,\nnot an exact point.', 'teal', 2, 19, 16))
s.f(3)
s.raw('<circle cx="775" cy="510" r="70" fill="#22c55e" fill-opacity="0.12" stroke="#15803d" stroke-width="2" stroke-dasharray="6 6"/>')
s.raw(pin(775, 500, 0.6, '#15803d'))
s.raw(callout(560, 690, 480, 120, 'A sighting = phone’s place + time', 'Meaning: the tag was somewhere within\nradio range of this point, at this time.', 'green', 3, 19, 16))
s.f(4)
s.raw('<path d="M190,470 L540,225" stroke="#94a3b8" stroke-width="3" stroke-dasharray="8 8"/>')
s.raw(cross(360, 360, 24))
s.raw(T(250, 300, 'the tag never asks\na satellite anything', 16.5, 700, '#475569', 'middle'))
scenes[35] = s.render('Schematic.')

# ── 36 Encrypted sighting ───────────────────────────────────────────
s = Scene(36, 'The sighting is sealed before it leaves the finder’s phone',
          'Five frames. The tag advertises its current rotating public key; the finder phone encrypts its own location and '
          'the time to that public key, producing a report it cannot itself read back; the report travels over the internet '
          'to Apple’s Find My relay; the relay stores it under a lookup value, a SHA-256 hash of the public key; and a panel '
          'of what remains visible: Apple says it cannot read the location and does not know the finder, but the lookup '
          'hash, the encrypted report, the upload time and network connection data still exist.',
          sub='Encrypted to the tag’s public key, filed under a hash. Content hidden — not every trace.')
s.f(1)
s.raw(tag(130, 360, 40))
s.raw(tag_label(130, 430))
s.arrow([(180, 360), (360, 360)], 'signal', 'public key Pᵢ', at=(270, 326))
s.raw(phone(370, 220, 150, 300, '#f8fafc'))
s.raw(callout(60, 560, 440, 110, 'Current public key', 'The tag advertises Pᵢ, which changes\nover time (Scene 28).', 'blue', 1, 19, 16))
s.f(2)
s.raw('<rect x="390" y="300" width="110" height="60" rx="8" fill="#dcfce7" stroke="#15803d" stroke-width="2"/>')
s.raw(T(445, 336, 'place+time', 14, 700, '#166534', 'middle'))
s.arrow([(445, 360), (445, 400)], 'plain')
s.raw(envelope(405, 405, 80))
s.raw(lock(460, 432, 0.45))
s.raw(callout(540, 560, 440, 130, 'Encrypt to Pᵢ', 'The finder seals its own location and\nthe time with the tag’s public key.\nOnly the matching private key opens it.', 'purple', 2, 19, 16))
s.f(3)
s.raw(cloud(620, 230, 200, 'internet'))
s.arrow([(530, 370), (640, 370)], 'crypto')
s.arrow([(820, 330), (975, 330)], 'crypto', 'encrypted report', at=(898, 296))
s.f(4)
s.rect(990, 170, 550, 370, 'bound', rx=18)
s.raw(T(1012, 206, 'Find My relay (Apple)', 20, 800, '#14213d'))
s.raw(server(1020, 240, 0.9))
s.raw('<rect x="1160" y="240" width="360" height="170" rx="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(T(1176, 270, 'lookup value', 15, 800, '#334155') + T(1356, 270, 'stored report', 15, 800, '#334155'))
for i, h in enumerate(['SHA-256(P₁₇)', 'SHA-256(P₁₈)', 'SHA-256(P₂₁)']):
    y = 302 + i * 34
    s.raw(T(1176, y, h, 14.5, 400, '#334155', mono=True))
    s.raw(f'<rect x="1356" y="{y - 16}" width="140" height="22" rx="4" fill="#ede9fe" stroke="#7c3aed" stroke-width="1.5"/>')
    s.raw(T(1426, y, '▒▒ ciphertext', 13, 600, '#6d28d9', 'middle'))
s.raw(callout(1020, 430, 500, 96, 'Filed under a hash', 'Stored by SHA-256 of the public key.', 'purple', 4, 19, 16))
s.f(5)
s.raw(panel(540, 700, 1000, 120, 'slate', 5, 'Hidden content is not zero metadata', None, 19))
s.raw(T(620, 776, 'Apple says it cannot read the location and does not know the finder. Still present: the lookup', 15.5, 400, '#334155'))
s.raw(T(620, 800, 'hash, the encrypted report, the upload time and ordinary network connection data.', 15.5, 400, '#334155'))
scenes[36] = s.render()

# ── 37 Owner gets the answer ─────────────────────────────────────────
s = Scene(37, 'How the owner gets the answer',
          'Five frames. The owner opens Find My on a device signed in to their Apple Account; that device regenerates the '
          'public keys its tag would have used and their lookup hashes; it asks the relay for reports filed under those '
          'hashes and downloads the encrypted reports; it decrypts them locally with the matching private keys and shows an '
          'estimated location with a time; and a contrast: sightings arrive as separate, delayed points, not a continuous '
          'live track.',
          sub='The owner’s own device does the decrypting. What it shows is a last-seen point, not a live feed.')
s.f(1)
s.rect(60, 170, 470, 430, 'bound', rx=18)
s.raw(T(82, 206, 'Owner’s device', 20, 800, '#14213d'))
s.raw(phone(110, 230, 170, 340, '#f8fafc'))
s.raw(T(195, 290, 'Find My', 18, 800, '#14213d', 'middle'))
s.raw(cloud(640, 170, 260, 'Apple Account'))
s.arrow([(290, 260), (650, 260)], 'admin', 'signed in, two-factor', at=(470, 230))
s.raw(callout(560, 500, 370, 110, 'Open Find My', 'On a device signed in to the owner’s\nApple Account.', 'slate', 1, 19, 16))
s.f(2)
s.raw('<rect x="300" y="300" width="210" height="150" rx="10" fill="#f0fdf4" stroke="#15803d" stroke-width="2"/>')
s.raw(T(405, 330, 'regenerate keys', 15.5, 800, '#166534', 'middle'))
s.raw(T(405, 358, 'P₁₇, P₁₈ … P₂₄', 14.5, 400, '#334155', 'middle', mono=True))
s.raw(T(405, 386, 'hash each one', 15.5, 800, '#166534', 'middle'))
s.raw(T(405, 414, 'SHA-256(Pᵢ)', 14.5, 400, '#334155', 'middle', mono=True))
s.f(3)
s.rect(1040, 170, 500, 290, 'bound', rx=18)
s.raw(T(1062, 206, 'Find My relay (Apple)', 20, 800, '#14213d'))
s.raw(server(1080, 236, 0.9))
s.raw(T(1230, 280, 'reports filed', 16, 600, '#334155') + T(1230, 304, 'under hashes', 16, 600, '#334155'))
s.arrow([(520, 400), (1030, 400)], 'plain', 'request: these lookup hashes', at=(780, 370))
s.arrow([(1030, 440), (520, 440)], 'crypto', 'matching encrypted reports', at=(780, 476))
s.f(4)
s.raw(map_tile(128, 330, 134, 150))
s.raw(pin(195, 420, 0.55, '#2563eb'))
s.raw(T(195, 510, 'near Platform 3', 14.5, 700, '#14213d', 'middle'))
s.raw(T(195, 532, 'seen 14 min ago', 13.5, 400, '#475569', 'middle'))
s.raw(callout(960, 500, 580, 110, 'Decrypted on the device', 'Only the owner’s devices hold the private\nkeys dᵢ. The result: a place and a time.', 'purple', 4, 19, 16))
s.f(5)
s.raw(panel(60, 712, 1480, 108, 'amber', 5, 'A sighting, not live tracking', None, 19))
s.raw('<path d="M560,766 L1500,766" stroke="#cbd5e1" stroke-width="3"/>')
for x in (600, 690, 940, 1010, 1380):
    s.raw(f'<circle cx="{x}" cy="766" r="9" fill="#2563eb"/>')
s.raw(T(100, 798, 'Points arrive when phones pass by, with delays and gaps.', 15.5, 400, '#334155'))
s.raw(T(1180, 800, 'times illustrative', 14, 400, '#475569', italic=True))
scenes[37] = s.render()

# ── 38 Five swimlanes ────────────────────────────────────────────────
s = Scene(38, 'The whole exchange in five lanes',
          'A sequence diagram in five frames across five lanes: the tag, the finder phone, the Find My relay at Apple, the '
          'owner’s Apple Account service, and the owner’s device. 1, the tag broadcasts its current public key over '
          'Bluetooth; 2, the finder phone takes its own location; 3, it encrypts location and time to the public key. 4, it '
          'uploads the encrypted report with a SHA-256 lookup hash; 5, the relay stores it. 6, the owner’s device signs in '
          'with two-factor authentication; 7, it receives an authorised session. 8, it regenerates the public keys and '
          'hashes; 9, it requests reports by hash; 10, the relay returns the encrypted reports; 11, the device decrypts '
          'them with its private keys. Final frame: trust boundaries around Apple’s services and around the owner’s device, '
          'where the private keys stay.',
          sub='Numbered messages, left to right. Short form: From Tap to Trace, Figure 06.')
LX = [180, 480, 790, 1080, 1405]
HEAD = ['Item tracker', 'Finder phone', 'Find My relay', 'Account service', 'Owner’s device']
HSUB = ['broadcasts', 'any passer-by', 'Apple', 'Apple Account', 'signed in']
Y = lambda k: 290 + (k - 1) * 45


def selfstep(x, y, text, color='#15803d', fill='#f0fdf4'):
    w = len(text) * 8.2 + 24
    return (f'<rect x="{x - w / 2:.0f}" y="{y - 18}" width="{w:.0f}" height="28" rx="7" fill="{fill}" stroke="{color}" stroke-width="2"/>'
            + T(x, y + 2, text, 14.5, 700, color, 'middle'))


s.f(1)
for x, h, sub in zip(LX, HEAD, HSUB):
    s.raw(f'<rect x="{x - 115}" y="164" width="230" height="66" rx="12" fill="#f8fafc" stroke="#64748b" stroke-width="2"/>')
    s.raw(T(x, 192, h, 18, 800, '#14213d', 'middle') + T(x, 216, sub, 14, 400, '#475569', 'middle'))
    s.raw(f'<path d="M{x},230 L{x},770" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 6"/>')
s.arrow([(LX[0], Y(1)), (LX[1] - 4, Y(1))], 'signal', '1 BLE advert: Pᵢ', at=(330, Y(1) - 8))
s.raw(selfstep(LX[1], Y(2), '2 own location + time'))
s.raw(selfstep(LX[1], Y(3), '3 encrypt to Pᵢ', '#7e22ce', '#faf5ff'))
s.f(2)
s.arrow([(LX[1], Y(4)), (LX[2] - 4, Y(4))], 'crypto', '4 hash + ciphertext', at=(635, Y(4) - 8))
s.raw(selfstep(LX[2], Y(5), '5 store by hash', '#334155', '#f8fafc'))
s.f(3)
s.arrow([(LX[4], Y(6)), (LX[3] + 4, Y(6))], 'admin', '6 sign in, 2FA', at=(1190, Y(6) - 8))
s.arrow([(LX[3], Y(7)), (LX[4] - 4, Y(7))], 'admin', '7 session', at=(1190, Y(7) - 8))
s.f(4)
s.raw(selfstep(LX[4], Y(8), '8 derive Pᵢ, hash'))
s.arrow([(LX[4], Y(9)), (LX[2] + 4, Y(9))], 'plain', '9 request by hashes', at=(935, Y(9) - 8))
s.arrow([(LX[2], Y(10)), (LX[4] - 4, Y(10))], 'crypto', '10 encrypted reports', at=(935, Y(10) - 8))
s.raw(selfstep(LX[4], Y(11), '11 decrypt with dᵢ', '#7e22ce', '#faf5ff'))
s.f(5)
s.raw(bound_raw(664, 154, 542, 86, 'Apple services', rx=14))
s.raw(bound_raw(1280, 154, 250, 640, 'private keys stay here', rx=14))
s.raw(T(60, 810, 'Thick boxes: trust boundaries. Apple stores and routes; only the owner’s device decrypts.', 15.5, 600, '#334155'))
scenes[38] = s.render()

# ── 39 Nearby find ───────────────────────────────────────────────────
s = Scene(39, 'Finding it nearby is a different mechanism',
          'Five frames. Left, Find My’s map shows a last-seen point built from sightings, a global location. Right, in the '
          'same room, the owner’s iPhone asks the tag to play a sound over Bluetooth; a compatible iPhone with ultra-wideband '
          'exchanges ranging messages with the tag and measures distance from the time of flight; the phone combines that '
          'with its camera, ARKit and motion sensors to point an arrow; and a note that the Bluetooth advertisement itself '
          'carries no direction, and Precision Finding needs an iPhone with ultra-wideband: iPhone 11 or later, not iPhone SE.',
          sub='The map says roughly where. Up close, sound and ultra-wideband say which way and how far.')
s.f(1)
s.raw(panel(60, 160, 440, 520, 'slate', 1, 'Far away: the map', None, 21))
s.raw(phone(170, 240, 200, 400, '#f8fafc'))
s.raw(map_tile(186, 290, 168, 250))
s.raw(pin(270, 430, 0.6))
s.raw(T(270, 580, 'last seen, 2 km', 15, 700, '#14213d', 'middle'))
s.raw(T(280, 665, 'global location, from sightings', 15.5, 600, '#475569', 'middle'))
s.raw('<path d="M520,170 L520,810" stroke="#e2e8f0" stroke-width="3"/>')
s.raw(person(720, 360, 1.25, '#475569', phone_in_hand=True))
s.raw('<rect x="1240" y="560" width="250" height="90" rx="20" fill="#cbd5e1"/><rect x="1220" y="520" width="290" height="60" rx="20" fill="#94a3b8"/>')
s.raw(tag(1360, 505, 28))
s.raw(T(1360, 680, 'same room', 16, 600, '#475569', 'middle'))
s.f(2)
s.arrow([(800, 440), (1328, 488)], 'signal', 'Bluetooth: play sound', at=(1060, 430))
s.raw(speaker(1400, 440, 0.8))
s.raw(callout(560, 160, 430, 110, 'Play Sound (Bluetooth)', 'In Bluetooth range, the owner asks\nthe tag to beep.', 'blue', 2, 19, 16))
s.f(3)
s.biarrow([(805, 580), (1334, 528)], 'signal', 'UWB ranging exchange', at=(1060, 616))
s.raw(callout(1010, 160, 530, 130, 'Distance from time of flight', 'Ultra-wideband messages go back and forth;\nthe round-trip time gives the distance.\nA ranging exchange, not a location broadcast.', 'blue', 3, 19, 16))
s.f(4)
s.raw('<rect x="560" y="690" width="460" height="120" rx="16" fill="#111827"/>')
s.raw('<path d="M612,752 L662,752 L662,730 L704,762 L662,794 L662,772 L612,772 Z" fill="#22c55e" transform="rotate(-25 658 762)"/>')
s.raw(T(760, 752, '8 m', 32, 800, '#ffffff') + T(760, 786, 'to the right', 17, 600, '#e5e7eb'))
s.raw(T(1000, 790, 'illustrative', 13.5, 400, '#9ca3af', 'end', italic=True))
s.raw(callout(1060, 690, 480, 120, 'Direction needs the phone’s sensors', 'UWB with camera, ARKit, accelerometer\nand gyroscope. Illustrative readout.', 'teal', 4, 19, 16))
s.f(5)
s.raw(callout(60, 690, 440, 120, 'No direction in the whisper', 'The BLE advert carries no bearing. Needs\niPhone 11 or later, not iPhone SE.', 'amber', 5, 19, 16))
scenes[39] = s.render()

# ── 40 NFC Lost Mode ─────────────────────────────────────────────────
s = Scene(40, 'NFC Lost Mode: a tap that shows a note, not a location',
          'Four frames. Someone finds a tag and holds an NFC-capable phone, iPhone or Android, a few centimetres from it; '
          'the phone opens a web page with the item’s serial number; if the owner turned on Lost Mode, the page also shows '
          'the owner’s message and the contact details the owner chose to share; and what NFC cannot do: no distant '
          'tracking, nothing about the finder sent to the owner by the tap itself, and only what the owner chose is shown.',
          sub='Centimetres, on purpose. The owner decides what a finder may read.')
s.f(1)
s.raw(person(200, 240, 1.2, '#64748b'))
s.raw(phone(420, 300, 150, 290, '#f8fafc'))
s.raw(tag(670, 470, 44))
s.raw(tag_label(670, 545, 'found item tracker'))
s.biarrow([(580, 470), (618, 470)], 'signal')
s.raw(T(680, 410, 'NFC, a few cm', 15.5, 700, '#1d4ed8', 'middle'))
s.raw(callout(60, 650, 560, 120, 'Hold an NFC phone to the tag', 'iPhone or an NFC-capable Android phone.\nNo app and no account are needed to read it.', 'blue', 1, 19, 16))
s.f(2)
s.raw('<rect x="434" y="330" width="122" height="236" rx="14" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(T(495, 360, 'found.apple.com', 11.5, 700, '#1d4ed8', 'middle', mono=True))
s.raw(T(495, 392, 'Serial number', 12.5, 700, '#14213d', 'middle') + T(495, 412, 'H2X••••••9K', 12, 400, '#475569', 'middle', mono=True))
s.raw(callout(820, 170, 720, 120, 'A web page about the item', 'The tap opens a page with the item’s serial number. The finder’s\nphone shows it; nothing is installed.', 'green', 2, 19, 16))
s.f(3)
s.raw('<rect x="440" y="430" width="110" height="122" rx="8" fill="#fef3c7" stroke="#b45309" stroke-width="1.5"/>')
s.raw(T(495, 452, 'Lost Mode', 12.5, 800, '#92400e', 'middle'))
s.raw(T(495, 474, '“Reward if', 11.5, 400, '#334155', 'middle') + T(495, 490, 'found. Call:”', 11.5, 400, '#334155', 'middle'))
s.raw(T(495, 512, '+44 •••• 0123', 11, 400, '#334155', 'middle', mono=True))
s.raw(T(495, 538, 'owner’s choice', 10.5, 700, '#92400e', 'middle'))
s.raw(callout(820, 310, 720, 140, 'Only if the owner turned on Lost Mode', 'The owner’s message and the phone number or email the owner\nchose to share. Without Lost Mode, a finder sees much less\n(details in level C below).', 'amber', 3, 19, 16))
s.f(4)
s.raw(panel(820, 480, 720, 330, 'slate', 4, 'What NFC does not do', None, 21))
s.raw(cross(880, 600, 20) + T(916, 607, 'No distant tracking: NFC works at centimetres.', 17, 400, '#334155'))
s.raw(cross(880, 670, 20) + T(916, 666, 'Not part of the crowd-sourced finding network', 17, 400, '#334155')
      + T(916, 690, '(that is Bluetooth sightings, Scenes 34–37).', 17, 400, '#334155'))
s.raw(cross(880, 750, 20) + T(916, 757, 'No contact details unless the owner chose them.', 17, 400, '#334155'))
scenes[40] = s.render('Fictional serial and number.')

# ── 41 Owner lifecycle ───────────────────────────────────────────────
s = Scene(41, 'An owner’s life with the tag: what survives each change',
          'Six frames showing states and transitions. 1, setup moves the tag from unregistered to registered to one Apple '
          'Account. 2, the owner can share it with up to five people and later stop sharing; sharing grants viewing, not '
          'ownership. 3, a lost or replaced iPhone changes nothing about ownership, because items belong to the account; a '
          'newly signed-in device gets access, with key material synced through end-to-end encrypted iCloud Keychain '
          'according to Apple. 4, Remove Item unlinks the tag so another account can add it; if it is out of range, Apple '
          'documents a reset procedure. 5, losing the account itself without a recovery path means losing access to the '
          'item; account recovery restores it. 6, a key distinguishing disclosed behaviour from undisclosed cryptographic '
          'implementation.',
          sub='Ownership lives in the Apple Account, not in a phone. Grey dashed arrows are permissions, not data.')


def state(x, y, w, title, sub, col='slate'):
    c, light, border = STEP[col]
    return (f'<rect x="{x}" y="{y}" width="{w}" height="86" rx="43" fill="{light}" stroke="{c}" stroke-width="3"/>'
            + T(x + w / 2, y + 38, title, 19, 800, '#14213d', 'middle') + T(x + w / 2, y + 64, sub, 14.5, 400, '#475569', 'middle'))


s.f(1)
s.raw(state(60, 200, 300, 'Unregistered', 'new, removed or reset', 'slate'))
s.raw(state(560, 200, 340, 'Registered', 'linked to one Apple Account', 'blue'))
s.arrow([(360, 243), (550, 243)], 'admin', '1 setup', at=(455, 222))
s.f(2)
s.raw(state(1150, 200, 340, 'Shared', 'up to 5 people can view it', 'green'))
s.arrow([(900, 228), (1140, 228)], 'admin', '2 share', at=(1020, 208))
s.arrow([(1140, 262), (900, 262)], 'admin', 'stop sharing', at=(1020, 300))
s.f(3)
s.raw(phone(620, 380, 90, 170, '#f8fafc'))
s.raw(cross(665, 465, 22))
s.raw(phone(780, 380, 90, 170, '#f8fafc'))
s.arrow([(718, 465), (772, 465)], 'crypto')
s.raw(T(745, 372, 'keys sync', 15, 700, '#6d28d9', 'middle'))
s.raw(callout(890, 360, 650, 140, 'Phone lost or replaced: ownership unchanged', 'Items belong to the account. A new signed-in device gets access;\nApple says Find My key material syncs via end-to-end encrypted\niCloud Keychain.', 'purple', 3, 19, 16))
s.f(4)
s.arrow([(610, 204), (610, 176), (210, 176), (210, 194)], 'admin', '4 Remove Item', at=(410, 176))
s.raw(callout(60, 340, 430, 140, 'Remove, then transfer', 'Remove Item unlinks the tag; then\nanother account can set it up. Out of\nrange? Apple documents a reset.', 'slate', 4, 19, 16))
s.f(5)
s.raw(state(60, 570, 380, 'Account inaccessible', 'no sign-in, no recovery', 'red'))
s.arrow([(600, 282), (600, 330), (520, 330), (520, 595), (448, 595)], 'admin', 'lose access', at=(440, 532))
s.arrow([(440, 640), (570, 640), (570, 355), (650, 355), (650, 294)], 'admin', '5 recovery', at=(570, 690))
s.raw(callout(780, 560, 760, 110, 'Lose the account, lose the item', 'Without recovery (recovery contact, key or Apple’s process), the\nowner cannot see the item or its sightings.', 'red', 5, 19, 16))
s.f(6)
s.raw(panel(60, 700, 1480, 116, 'amber', 6, 'Disclosed behaviour vs undisclosed implementation', None, 19))
s.raw(chip(140, 770, 'DOCUMENTED', 'doc') + T(286, 790, 'every transition shown', 15.5, 400, '#334155'))
s.raw(chip(560, 770, 'UNDISCLOSED', 'und') + T(714, 790, 'how keys are re-issued, revoked or erased at each step', 15.5, 400, '#334155'))
scenes[41] = s.render()
