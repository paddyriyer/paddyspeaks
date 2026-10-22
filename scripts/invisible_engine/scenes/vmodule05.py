"""Module 5 phone-vertical scenes (31–41): the same scenes as module05.py, laid out for a
phone (VScene: 720 wide, body drawn in its own coordinates below the header).
Same title, desc, frames and words as the landscape scene; invisible-engine/tests/check.py
compares them. Change a scene's words in both files."""
from .svgkit import VScene, wrap
from .art import *
from .module05 import cell_tower, wifi_ap, envelope, cross, speaker, map_tile

scenes = {}


# ── local helpers at the phone type scale ───────────────────────────
def sheet(x, y, w, h, title, body, button=None, color='#2563eb'):
    """A bottom sheet drawn on a phone screen."""
    out = (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>'
           + T(x + w / 2, y + 38, title, 23, 800, '#14213d', 'middle')
           + T(x + w / 2, y + 70, body, 20, 400, '#475569', 'middle'))
    if button:
        out += (f'<rect x="{x + 12}" y="{y + h - 52}" width="{w - 24}" height="40" rx="10" fill="{color}"/>'
                + T(x + w / 2, y + h - 25, button, 20, 700, '#ffffff', 'middle'))
    return out


def chip(x, y, label, kind):
    """Evidence chip: documented / inferred / undisclosed."""
    st = {'doc': ('#1e40af', '#eff6ff', '#93c5fd', ''), 'inf': ('#6b21a8', '#faf5ff', '#d8b4fe', ''),
          'und': ('#374151', '#ffffff', '#6b7280', ' stroke-dasharray="6 4"')}[kind]
    w = chip_w(label)
    return (f'<rect x="{x}" y="{y}" width="{w:.0f}" height="34" rx="17" fill="{st[1]}" stroke="{st[2]}" stroke-width="2"{st[3]}/>'
            + T(x + w / 2, y + 24, label, 20, 700, st[0], 'middle', mono=True))


def chip_w(label):
    return len(label) * 12.1 + 22


def bound_raw(x, y, w, h, label=None, rx=16):
    """A thick trust boundary drawn without the legend class; the label sits on the bottom edge."""
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="none" stroke="#14213d" stroke-width="5"/>'
    if label:
        out += (f'<rect x="{x + 14}" y="{y + h - 16}" width="{len(label) * 11.4 + 18:.0f}" height="32" rx="6" fill="#14213d"/>'
                + T(x + 23, y + h + 7, label, 20, 700, '#ffffff'))
    return out


def tag_label(x, y, text='item tracker'):
    return T(x, y, text, 20, 600, '#475569', 'middle')


# ── 31 First-time setup ─────────────────────────────────────────────
s = VScene(31, 'First-time setup: from a new tag to a named item',
           'Five frames. A new item tracker is held next to the owner’s iPhone, which notices it at close range; the iPhone '
           'shows a Connect prompt; after the owner taps Connect and Continue, the item is registered to the owner’s Apple '
           'Account, which needs two-factor authentication; the item now appears in Find My with the name the owner chose; '
           'and a note that these are Apple’s documented user steps, not a public trace of the messages underneath.',
           sub='Apple documents the steps you see. The messages underneath are mostly not public.',
           note='Steps: Apple Support. Schematic.', h=1590)
s.f(1)
s.raw(phone(40, 0, 200, 400, '#f1f5f9'))
s.raw(T(140, 72, 'Find My', 24, 800, '#14213d', 'middle'))
s.raw(tag(340, 112, 44))
s.raw(tag_label(340, 194, 'new item tracker'))
s.raw(waves(296, 112, 2, '#2563eb', 1.0, dir=-1))
s.raw(badge(398, 64, 1, 'blue', 16))
s.raw(callout(40, 420, 640, 116, 'Hold it near the iPhone', 'Pull the battery tab and hold the new tag next to an\nunlocked iPhone. Close range is part of the setup step.', 'blue', 1, 26, 21))
s.f(2)
s.raw(sheet(52, 196, 176, 180, 'AirTag', 'Hold near iPhone', 'Connect'))
s.raw(callout(40, 548, 640, 116, 'The Connect prompt', 'The iPhone offers to add the item. Nothing is\nlinked until the owner agrees.', 'green', 2, 26, 21))
s.f(3)
s.raw(cloud(410, 0, 270, 'Apple Account'))
s.raw(T(466, 352, 'two-factor authentication required', 20, 600, '#475569', 'middle'))
s.arrow([(246, 300), (600, 300), (600, 158)], 'admin', 'Continue: register to my account', at=(462, 272))
s.raw(badge(632, 236, 3, 'slate', 16))
s.raw(callout(40, 676, 640, 143, 'Explicit account linking', 'The owner taps Continue. The item is registered to their\nApple Account. One account at a time: to give the tag\naway, the owner removes it from their account first.', 'slate', 3, 26, 21))
s.f(4)
s.raw('<rect x="52" y="40" width="176" height="348" rx="20" fill="#f8fafc"/>')
s.raw(T(140, 82, 'Items', 24, 800, '#14213d', 'middle'))
s.raw('<rect x="60" y="108" width="160" height="80" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>'
      '<circle cx="88" cy="148" r="16" fill="#e5e7eb" stroke="#94a3b8" stroke-width="2"/>')
s.raw(T(114, 142, 'Keys', 22, 800, '#14213d'))
s.raw(T(114, 170, 'with you', 20, 400, '#475569'))
s.raw(callout(40, 831, 640, 116, 'A named item in Find My', 'The owner chose the name (here “Keys”). The item now\nappears in the Items list on their devices.', 'blue', 4, 26, 21))
s.f(5)
s.raw(panel(40, 959, 640, 140, 'amber', 5, 'User steps, not a packet trace', None, 24))
s.raw(T(64, 1052, 'What travels between tag, phone and Apple during setup\nis mostly undisclosed (Scene 32).', 21, 400, '#334155'))
scenes[31] = s.render()

# ── 32 Registration layers ──────────────────────────────────────────
rows = [
    ('Tag hardware identity', 'A serial number, readable on the tag and by NFC.', [('DOCUMENTED: serial', 'doc'), ('UNDISCLOSED: factory keys', 'und')], 'slate'),
    ('Onboarding transport', 'A short-range radio exchange with the owner’s iPhone.', [('INFERRED: close-range radio', 'inf'), ('UNDISCLOSED: messages', 'und')], 'blue'),
    ('User authorisation', 'Owner taps Connect on a device signed in with two-factor auth.', [('DOCUMENTED', 'doc')], 'green'),
    ('Account registration', 'The item is linked to one Apple Account at a time.', [('DOCUMENTED: behaviour', 'doc'), ('UNDISCLOSED: format', 'und')], 'slate'),
    ('Key provisioning', 'Owner device makes a P-224 key pair and secret for rotating keys.', [('DOCUMENTED: design', 'doc'), ('UNDISCLOSED: exchange', 'und')], 'purple'),
    ('Revocation / transfer', 'Remove Item unlinks it; then another account can add it.', [('DOCUMENTED: behaviour', 'doc'), ('UNDISCLOSED: mechanism', 'und')], 'amber'),
]


def chip_rows(chips, x0=64, x1=666):
    out, cur, x = [], [], x0
    for lab, k in chips:
        if cur and x + chip_w(lab) > x1:
            out.append(cur)
            cur, x = [], x0
        cur.append((x, lab, k))
        x += chip_w(lab) + 12
    return out + [cur]


layout, y = [], 0
for name, what, chips, col in rows:
    wl, cr = wrap(what, 50), chip_rows(chips)
    h = 56 + 28 * len(wl) + 44 * len(cr) + 4
    layout.append((y, h, wl, cr))
    y += h + 12
need = y + 50
s = VScene(32, 'What setup actually establishes, layer by layer',
           'Six frames, one layer each, every layer marked documented, inferred or undisclosed. 1, the tag’s hardware '
           'identity: a serial number is documented, factory key material is not disclosed. 2, the onboarding transport: a '
           'short-range radio exchange with the owner’s iPhone, inferred from the documented hold-it-near step. 3, user '
           'authorisation: the owner taps Connect on a device signed in to an Apple Account with two-factor authentication, '
           'documented. 4, account registration: the item is linked to one Apple Account, documented; the message format is '
           'undisclosed. 5, key provisioning: the owner’s device creates a key pair and secret for rotating identifiers, '
           'documented in Apple Platform Security; the exact exchange is undisclosed. 6, revocation and transfer: Remove Item '
           'unlinks the item, documented; the cryptographic mechanism is undisclosed.',
           sub='Six things get set up. Apple documents some of them; the rest we can only infer, or not see at all.')
s.bh = need
for i, ((name, what, chips, col), (y, h, wl, cr)) in enumerate(zip(rows, layout)):
    s.f(i + 1)
    c, light, border = STEP[col]
    s.raw(f'<rect x="40" y="{y}" width="640" height="{h}" rx="14" fill="{light}" stroke="{border}" stroke-width="2"/>')
    s.raw(badge(70, y + 33, i + 1, col, 18))
    s.raw(T(98, y + 42, name, 24, 800, '#14213d'))
    s.raw(T(98, y + 74, '\n'.join(wl), 21, 400, '#334155'))
    cy = y + 56 + 28 * len(wl) + 2
    for r in cr:
        for x, lab, k in r:
            s.raw(chip(x, cy, lab, k))
        cy += 44
ky = need - 40
s.raw(T(40, ky + 24, 'Key:', 21, 700, '#334155') + chip(98, ky, 'DOCUMENTED', 'doc')
      + chip(98 + chip_w('DOCUMENTED') + 12, ky, 'INFERRED', 'inf')
      + chip(98 + chip_w('DOCUMENTED') + chip_w('INFERRED') + 24, ky, 'UNDISCLOSED', 'und'))
scenes[32] = s.render()

# ── 33 Far-away luggage ─────────────────────────────────────────────
s = VScene(33, 'Far-away luggage: a tag that does not know where it is',
           'Four frames. A suitcase with an item tracker is left on a station platform while its owner is far away; the tag '
           'has no satellite receiver and no cellular connection, shown crossed out; what it does have is a coin cell and a '
           'Bluetooth Low Energy radio that whispers a short advertisement over and over; and a question: who knows where it '
           'is? Someone else’s phone, in the next scene.',
           sub='No map, no satellite, no SIM. Just a coin cell and a short-range whisper.',
           note='Radio arcs illustrative.')
s.bh = 1030
s.f(1)
s.raw('<rect x="40" y="410" width="640" height="34" fill="#cbd5e1"/><rect x="40" y="444" width="640" height="14" fill="#94a3b8"/>'
      '<path d="M40,474 L680,474 M40,498 L680,498" stroke="#64748b" stroke-width="5"/>')
s.raw('<rect x="40" y="150" width="190" height="62" rx="8" fill="#1e3a8a"/>')
s.raw(T(135, 190, 'Platform 3', 24, 800, '#ffffff', 'middle'))
s.raw('<path d="M135,212 L135,410" stroke="#334155" stroke-width="6"/>')
s.raw(suitcase(250, 216, 0.9))
s.raw(tag(436, 260, 30))
s.raw('<path d="M406,260 L385,260" stroke="#334155" stroke-width="3"/>')
s.raw(person(620, 0, 0.72, '#64748b', phone_in_hand=True))
s.raw(T(680, 192, 'the owner, 200 km away', 21, 600, '#334155', 'end'))
s.raw('<path d="M486,226 L650,206" stroke="#94a3b8" stroke-width="3" stroke-dasharray="4 10"/>')
s.raw(callout(40, 530, 640, 116, 'Left behind', 'The suitcase stays on the platform. The owner is\nfar away (illustrative).', 'slate', 1, 26, 21))
s.f(2)
s.raw(satellite(300, 40, 1.0))
s.raw(cross(300, 96, 22))
s.raw(cell_tower(450, 140, 0.85))
s.raw(cross(450, 96, 22))
s.raw(callout(40, 658, 640, 116, 'No GPS, no cellular', 'The tag has no satellite receiver and no SIM or\nmobile modem. It cannot look itself up.', 'red', 2, 26, 21))
s.f(3)
s.raw(waves(468, 260, 3, '#2563eb', 1.1))
s.raw(coin_cell(608, 300, 64))
s.raw(T(608, 396, 'coin cell', 21, 600, '#334155', 'middle'))
s.raw(callout(40, 786, 640, 116, 'What it does have', 'A Bluetooth Low Energy radio that repeats a short\nadvertisement, and a coin cell.', 'blue', 3, 26, 21))
s.f(4)
s.raw(callout(40, 914, 640, 116, 'So who knows where it is?', 'Not the tag. A passing phone that knows where it is\nitself — Scene 34.', 'green', 4, 26, 21))
scenes[33] = s.render()

# ── 34 Finder sees the whisper ───────────────────────────────────────
s = VScene(34, 'A passer-by’s phone overhears the whisper',
           'Four frames. The tag in the suitcase repeats a Bluetooth advertisement carrying a rotating public key; a '
           'passer-by’s participating iPhone, within radio range, receives it one way; there is no pairing, no handshake and '
           'no reply to the tag, shown crossed out; and the finder’s phone handles it in the background as an observation, '
           'not a connection to the owner or to the tag.',
           sub='One-way: the tag talks, a phone listens. Nobody pairs, nobody connects.',
           note='Radio arcs illustrative.')
s.bh = 880
s.f(1)
s.raw(suitcase(40, 60, 0.85))
s.raw(tag(204, 120, 30))
s.raw('<path d="M174,120 L168,120" stroke="#334155" stroke-width="3"/>')
s.raw(waves(236, 120, 3, '#2563eb', 1.1))
s.raw(callout(40, 310, 640, 116, 'The tag repeats an advertisement', 'A short Bluetooth LE broadcast with a rotating public\nkey in it — no name, no owner, no location.', 'blue', 1, 26, 21))
s.f(2)
s.raw(person(610, 10, 1.0, '#475569', phone_in_hand=True))
s.arrow([(300, 120), (560, 120)], 'signal', 'BLE advertisement\n(rotating key)', at=(430, 66))
s.raw(callout(40, 438, 640, 143, 'A participating iPhone hears it', 'Any nearby Apple device in the Find My network that\nis in range may pick it up. Reception is not\nguaranteed.', 'blue', 2, 26, 21))
s.f(3)
s.raw('<path d="M600,200 L230,200" stroke="#94a3b8" stroke-width="4" stroke-dasharray="10 10"/>')
s.raw(cross(415, 200, 24))
s.raw(T(415, 270, 'no pairing · no handshake · no reply', 21, 700, '#475569', 'middle'))
s.raw(callout(40, 593, 640, 116, 'Not a connection', 'The tag never learns who heard it. The finder’s phone\nsees only a random-looking key.', 'slate', 3, 26, 21))
s.f(4)
s.raw(callout(40, 721, 640, 143, 'An observation', 'The finder does nothing and is not asked. The phone\nhandles it in the background; neither the owner nor\nthe tag connects to it.', 'green', 4, 26, 21))
scenes[34] = s.render()

# ── 35 Whose location is used? ───────────────────────────────────────
s = VScene(35, 'Whose location is it? The finder phone’s own',
           'Four frames. The tag’s whisper reaches the finder phone carrying no location; the finder phone works out its own '
           'approximate position from satellites, Wi-Fi access points and cell towers, as it would for a map; the phone '
           'records a sighting: its own estimated position and the time, meaning the tag was somewhere within radio range '
           'of this point; and the tag never asks a satellite anything, shown crossed out.',
           sub='The tag has no position to give. The sighting uses where the finder’s phone thinks it is.',
           note='Schematic.')
s.bh = 950
s.f(1)
s.raw(tag(90, 400, 38))
s.raw(tag_label(90, 470))
s.raw(phone(330, 200, 140, 280, '#f8fafc'))
s.arrow([(132, 400), (322, 400)], 'signal', 'whisper: key,\nno location', at=(227, 350))
s.raw(callout(40, 570, 640, 116, 'The whisper has no position in it', 'Only a rotating key. The tag does not know where\nit is.', 'blue', 1, 26, 21))
s.f(2)
s.raw(satellite(380, 40, 1.0) + satellite(620, 70, 1.0))
s.raw(wifi_ap(560, 300, 1.0))
s.raw(cell_tower(620, 540, 0.9))
s.arrow([(386, 60), (396, 190)], 'signal')
s.arrow([(600, 90), (476, 210)], 'signal')
s.arrow([(552, 320), (480, 336)], 'signal')
s.arrow([(588, 470), (480, 436)], 'signal')
s.raw(callout(40, 698, 640, 116, 'The phone finds itself', 'Satellites (GNSS), Wi-Fi and cell towers, fused as for\nany map app. An estimate, not an exact point.', 'teal', 2, 26, 21))
s.f(3)
s.raw('<circle cx="400" cy="345" r="58" fill="#22c55e" fill-opacity="0.12" stroke="#15803d" stroke-width="2" stroke-dasharray="6 6"/>')
s.raw(pin(400, 340, 0.55, '#15803d'))
s.raw(callout(40, 826, 640, 116, 'A sighting = phone’s place + time', 'Meaning: the tag was somewhere within radio range\nof this point, at this time.', 'green', 3, 26, 21))
s.f(4)
s.raw('<path d="M110,362 L322,42" stroke="#94a3b8" stroke-width="3" stroke-dasharray="8 8"/>')
s.raw(cross(216, 202, 24))
s.raw(T(40, 66, 'the tag never asks\na satellite anything', 21, 700, '#475569'))
scenes[35] = s.render()

# ── 36 Encrypted sighting ───────────────────────────────────────────
s = VScene(36, 'The sighting is sealed before it leaves the finder’s phone',
           'Five frames. The tag advertises its current rotating public key; the finder phone encrypts its own location and '
           'the time to that public key, producing a report it cannot itself read back; the report travels over the internet '
           'to Apple’s Find My relay; the relay stores it under a lookup value, a SHA-256 hash of the public key; and a panel '
           'of what remains visible: Apple says it cannot read the location and does not know the finder, but the lookup '
           'hash, the encrypted report, the upload time and network connection data still exist.',
           sub='Encrypted to the tag’s public key, filed under a hash. Content hidden — not every trace.')
s.bh = 1072
s.f(1)
s.raw(tag(76, 150, 38))
s.raw(tag_label(76, 220))
s.arrow([(118, 150), (254, 150)], 'signal', 'public key Pᵢ', at=(168, 100))
s.raw(phone(262, 0, 160, 300, '#f8fafc'))
s.raw(callout(40, 556, 314, 202, 'Current public key', 'The tag advertises Pᵢ,\nwhich changes over time\n(Scene 28).', 'blue', 1, 24, 21))
s.f(2)
s.raw('<rect x="274" y="70" width="136" height="50" rx="8" fill="#dcfce7" stroke="#15803d" stroke-width="2"/>')
s.raw(T(342, 102, 'place+time', 20, 700, '#166534', 'middle'))
s.arrow([(342, 120), (342, 160)], 'plain')
s.raw(envelope(297, 166, 90))
s.raw(lock(350, 190, 0.45))
s.raw(callout(366, 556, 314, 202, 'Encrypt to Pᵢ', 'The finder seals its own\nlocation and the time with\nthe tag’s public key. Only\nthe matching private key\nopens it.', 'purple', 2, 24, 21))
s.f(3)
s.raw(cloud(480, 60, 200))
s.raw(T(580, 152, 'internet', 21, 700, '#14213d', 'middle'))
s.arrow([(426, 140), (482, 140)], 'crypto')
s.arrow([(572, 186), (572, 316)], 'crypto', 'encrypted report', at=(572, 262))
s.f(4)
s.rect(40, 320, 640, 222, 'bound', rx=18)
s.raw(T(62, 358, 'Find My relay (Apple)', 24, 800, '#14213d'))
s.raw(server(60, 384, 0.7))
s.raw('<rect x="164" y="374" width="500" height="152" rx="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(T(180, 404, 'lookup value', 20, 800, '#334155') + T(418, 404, 'stored report', 20, 800, '#334155'))
for i, h in enumerate(['SHA-256(P₁₇)', 'SHA-256(P₁₈)', 'SHA-256(P₂₁)']):
    y = 440 + i * 34
    s.raw(T(180, y, h, 20, 400, '#334155', mono=True))
    s.raw(f'<rect x="418" y="{y - 21}" width="230" height="28" rx="4" fill="#ede9fe" stroke="#7c3aed" stroke-width="1.5"/>')
    s.raw(T(533, y, '▒▒ ciphertext', 20, 600, '#6d28d9', 'middle'))
s.raw(callout(40, 770, 640, 90, 'Filed under a hash', 'Stored by SHA-256 of the public key.', 'purple', 4, 26, 21))
s.f(5)
s.raw(panel(40, 872, 640, 196, 'slate', 5, 'Hidden content is not zero metadata', None, 24))
s.raw(T(64, 966, 'Apple says it cannot read the location and does not\nknow the finder. Still present: the lookup hash, the\nencrypted report, the upload time and ordinary\nnetwork connection data.', 21, 400, '#334155'))
scenes[36] = s.render()

# ── 37 Owner gets the answer ─────────────────────────────────────────
s = VScene(37, 'How the owner gets the answer',
           'Five frames. The owner opens Find My on a device signed in to their Apple Account; that device regenerates the '
           'public keys its tag would have used and their lookup hashes; it asks the relay for reports filed under those '
           'hashes and downloads the encrypted reports; it decrypts them locally with the matching private keys and shows an '
           'estimated location with a time; and a contrast: sightings arrive as separate, delayed points, not a continuous '
           'live track.',
           sub='The owner’s own device does the decrypting. What it shows is a last-seen point, not a live feed.')
s.bh = 1120
s.f(1)
s.rect(40, 0, 400, 380, 'bound', rx=18)
s.raw(T(60, 36, 'Owner’s device', 24, 800, '#14213d'))
s.raw(phone(60, 56, 170, 300, '#f8fafc'))
s.raw(T(145, 112, 'Find My', 22, 800, '#14213d', 'middle'))
s.raw(cloud(452, 30, 232))
s.raw(T(568, 132, 'Apple Account', 21, 700, '#14213d', 'middle'))
s.arrow([(232, 110), (456, 110)], 'admin', 'signed in,\ntwo-factor', at=(342, 64))
s.raw(callout(40, 640, 640, 116, 'Open Find My', 'On a device signed in to the owner’s\nApple Account.', 'slate', 1, 26, 21))
s.f(2)
s.raw('<rect x="246" y="140" width="184" height="170" rx="10" fill="#f0fdf4" stroke="#15803d" stroke-width="2"/>')
s.raw(T(338, 172, 'regenerate keys', 20, 800, '#166534', 'middle'))
s.raw(T(338, 204, 'P₁₇, P₁₈ … P₂₄', 20, 400, '#334155', 'middle', mono=True))
s.raw(T(338, 248, 'hash each one', 20, 800, '#166534', 'middle'))
s.raw(T(338, 280, 'SHA-256(Pᵢ)', 20, 400, '#334155', 'middle', mono=True))
s.f(3)
s.rect(40, 500, 640, 120, 'bound', rx=18)
s.raw(T(62, 538, 'Find My relay (Apple)', 24, 800, '#14213d'))
s.raw(server(590, 514, 0.6))
s.raw(T(62, 574, 'reports filed', 21, 600, '#334155') + T(62, 601, 'under hashes', 21, 600, '#334155'))
s.arrow([(290, 384), (290, 494)], 'plain', 'request: these\nlookup hashes', at=(168, 432))
s.arrow([(390, 494), (390, 384)], 'crypto', 'matching encrypted\nreports', at=(530, 432))
s.f(4)
s.raw(map_tile(78, 122, 134, 100))
s.raw(pin(145, 200, 0.45, '#2563eb'))
s.raw(T(145, 252, 'near\nPlatform 3', 20, 700, '#14213d', 'middle'))
s.raw(T(145, 306, 'seen 14\nmin ago', 20, 400, '#475569', 'middle'))
s.raw(callout(40, 768, 640, 116, 'Decrypted on the device', 'Only the owner’s devices hold the private keys dᵢ.\nThe result: a place and a time.', 'purple', 4, 26, 21))
s.f(5)
s.raw(panel(40, 896, 640, 222, 'amber', 5, 'A sighting, not live tracking', None, 24))
s.raw('<path d="M64,990 L656,990" stroke="#cbd5e1" stroke-width="3"/>')
for x in (89, 146, 303, 347, 580):
    s.raw(f'<circle cx="{x}" cy="990" r="9" fill="#2563eb"/>')
s.raw(T(656, 1026, 'times illustrative', 20, 400, '#475569', 'end', italic=True))
s.raw(T(64, 1066, 'Points arrive when phones pass by, with delays\nand gaps.', 21, 400, '#334155'))
scenes[37] = s.render()

# ── 38 Five swimlanes ────────────────────────────────────────────────
s = VScene(38, 'The whole exchange in five lanes',
           'A sequence diagram in five frames across five lanes: the tag, the finder phone, the Find My relay at Apple, the '
           'owner’s Apple Account service, and the owner’s device. 1, the tag broadcasts its current public key over '
           'Bluetooth; 2, the finder phone takes its own location; 3, it encrypts location and time to the public key. 4, it '
           'uploads the encrypted report with a SHA-256 lookup hash; 5, the relay stores it. 6, the owner’s device signs in '
           'with two-factor authentication; 7, it receives an authorised session. 8, it regenerates the public keys and '
           'hashes; 9, it requests reports by hash; 10, the relay returns the encrypted reports; 11, the device decrypts '
           'them with its private keys. Final frame: trust boundaries around Apple’s services and around the owner’s device, '
           'where the private keys stay.',
           sub='Numbered messages, left to right. Short form: From Tap to Trace, Figure 06.')
s.bh = 1130
LX = [104, 232, 360, 488, 616]
HEAD = ['Item\ntracker', 'Finder\nphone', 'Find My\nrelay', 'Account\nservice', 'Owner’s\ndevice']
HSUB = ['broadcasts', 'any\npasser-by', 'Apple', 'Apple\nAccount', 'signed in']
Y = lambda k: 196 + (k - 1) * 82


def selfstep(x, y, text, color='#15803d', fill='#f0fdf4'):
    w = len(text) * 11 + 22
    x = min(max(x, 40 + w / 2), 680 - w / 2)
    return (f'<rect x="{x - w / 2:.0f}" y="{y - 21}" width="{w:.0f}" height="32" rx="7" fill="{fill}" stroke="{color}" stroke-width="2"/>'
            + T(x, y + 1, text, 20, 700, color, 'middle'))


s.f(1)
for x, h, sub in zip(LX, HEAD, HSUB):
    s.raw(f'<rect x="{x - 60}" y="0" width="120" height="128" rx="12" fill="#f8fafc" stroke="#64748b" stroke-width="2"/>')
    s.raw(T(x, 28, h, 20, 800, '#14213d', 'middle') + T(x, 80, sub, 20, 400, '#475569', 'middle'))
    s.raw(f'<path d="M{x},128 L{x},1040" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 6"/>')
s.arrow([(LX[0], Y(1)), (LX[1] - 4, Y(1))], 'signal', '1 BLE\nadvert: Pᵢ', at=(168, Y(1) - 38))
s.raw(selfstep(LX[1], Y(2), '2 own location + time'))
s.raw(selfstep(LX[1], Y(3), '3 encrypt to Pᵢ', '#7e22ce', '#faf5ff'))
s.f(2)
s.arrow([(LX[1], Y(4)), (LX[2] - 4, Y(4))], 'crypto', '4 hash +\nciphertext', at=(296, Y(4) - 38))
s.raw(selfstep(LX[2], Y(5), '5 store by hash', '#334155', '#f8fafc'))
s.f(3)
s.arrow([(LX[4], Y(6)), (LX[3] + 4, Y(6))], 'admin', '6 sign in,\n2FA', at=(552, Y(6) - 38))
s.arrow([(LX[3], Y(7)), (LX[4] - 4, Y(7))], 'admin', '7 session', at=(552, Y(7) - 14))
s.f(4)
s.raw(selfstep(LX[4], Y(8), '8 derive Pᵢ, hash'))
s.arrow([(LX[4], Y(9)), (LX[2] + 4, Y(9))], 'plain', '9 request\nby hashes', at=(488, Y(9) - 38))
s.arrow([(LX[2], Y(10)), (LX[4] - 4, Y(10))], 'crypto', '10 encrypted\nreports', at=(488, Y(10) - 38))
s.raw(selfstep(LX[4], Y(11), '11 decrypt with dᵢ', '#7e22ce', '#faf5ff'))
s.f(5)
s.raw(bound_raw(290, -8, 258, 152, 'Apple services', rx=14))
s.raw('<rect x="554" y="-8" width="128" height="196" rx="14" fill="none" stroke="#14213d" stroke-width="5"/>'
      '<rect x="412" y="172" width="268" height="32" rx="6" fill="#14213d"/>')
s.raw(T(421, 195, 'private keys stay here', 20, 700, '#ffffff'))
s.raw(T(40, 1092, 'Thick boxes: trust boundaries. Apple stores and routes;\nonly the owner’s device decrypts.', 21, 600, '#334155'))
scenes[38] = s.render()

# ── 39 Nearby find ───────────────────────────────────────────────────
s = VScene(39, 'Finding it nearby is a different mechanism',
           'Five frames. First, Find My’s map shows a last-seen point built from sightings, a global location. Then, in the '
           'same room, the owner’s iPhone asks the tag to play a sound over Bluetooth; a compatible iPhone with ultra-wideband '
           'exchanges ranging messages with the tag and measures distance from the time of flight; the phone combines that '
           'with its camera, ARKit and motion sensors to point an arrow; and a note that the Bluetooth advertisement itself '
           'carries no direction, and Precision Finding needs an iPhone with ultra-wideband: iPhone 11 or later, not iPhone SE.',
           sub='The map says roughly where. Up close, sound and ultra-wideband say which way and how far.')
s.bh = 1250
s.f(1)
s.raw(panel(40, 0, 640, 282, 'slate', 1, 'Far away: the map', None, 24))
s.raw(phone(64, 70, 120, 200, '#f8fafc'))
s.raw(map_tile(74, 100, 100, 120))
s.raw(pin(124, 192, 0.45))
s.raw(T(216, 160, 'last seen, 2 km', 21, 700, '#14213d'))
s.raw(T(216, 210, 'global location, from sightings', 21, 600, '#475569'))
s.raw('<path d="M40,302 L680,302" stroke="#e2e8f0" stroke-width="3"/>')
s.raw(person(110, 326, 1.15, '#475569', phone_in_hand=True))
s.raw('<rect x="470" y="586" width="200" height="70" rx="20" fill="#cbd5e1"/><rect x="450" y="550" width="240" height="50" rx="20" fill="#94a3b8"/>')
s.raw(tag(570, 532, 26))
s.raw(T(570, 690, 'same room', 21, 600, '#475569', 'middle'))
s.f(2)
s.arrow([(180, 486), (540, 524)], 'signal', 'Bluetooth: play sound', at=(350, 466))
s.raw(speaker(606, 494, 0.7))
s.raw(callout(40, 716, 640, 116, 'Play Sound (Bluetooth)', 'In Bluetooth range, the owner asks the tag to beep.', 'blue', 2, 26, 21))
s.f(3)
s.biarrow([(180, 556), (542, 548)], 'signal', 'UWB ranging exchange', at=(350, 598))
s.raw(callout(40, 844, 640, 143, 'Distance from time of flight', 'Ultra-wideband messages go back and forth; the\nround-trip time gives the distance. A ranging\nexchange, not a location broadcast.', 'blue', 3, 26, 21))
s.f(4)
s.raw('<rect x="290" y="330" width="390" height="104" rx="16" fill="#111827"/>')
s.raw('<path d="M318,382 L362,382 L362,362 L400,390 L362,418 L362,398 L318,398 Z" fill="#22c55e" transform="rotate(-25 358 390)"/>')
s.raw(T(424, 378, '8 m', 32, 800, '#ffffff') + T(424, 414, 'to the right', 21, 600, '#e5e7eb'))
s.raw(T(668, 424, 'illustrative', 20, 400, '#9ca3af', 'end', italic=True))
s.raw(callout(40, 999, 640, 116, 'Direction needs the phone’s sensors', 'UWB with camera, ARKit, accelerometer and\ngyroscope. Illustrative readout.', 'teal', 4, 26, 21))
s.f(5)
s.raw(callout(40, 1127, 640, 116, 'No direction in the whisper', 'The BLE advert carries no bearing. Needs iPhone 11\nor later, not iPhone SE.', 'amber', 5, 26, 21))
scenes[39] = s.render()

# ── 40 NFC Lost Mode ─────────────────────────────────────────────────
s = VScene(40, 'NFC Lost Mode: a tap that shows a note, not a location',
           'Four frames. Someone finds a tag and holds an NFC-capable phone, iPhone or Android, a few centimetres from it; '
           'the phone opens a web page with the item’s serial number; if the owner turned on Lost Mode, the page also shows '
           'the owner’s message and the contact details the owner chose to share; and what NFC cannot do: no distant '
           'tracking, nothing about the finder sent to the owner by the tap itself, and only what the owner chose is shown.',
           sub='Centimetres, on purpose. The owner decides what a finder may read.',
           note='Fictional serial and number.')
s.bh = 1140
s.f(1)
s.raw(person(120, 40, 1.05, '#64748b'))
s.raw(phone(250, 0, 230, 440, '#f8fafc'))
s.raw(tag(584, 230, 44))
s.raw(tag_label(582, 310, 'found item tracker'))
s.biarrow([(486, 230), (534, 230)], 'signal')
s.raw(T(586, 160, 'NFC, a few cm', 20, 700, '#1d4ed8', 'middle'))
s.raw(callout(40, 470, 640, 116, 'Hold an NFC phone to the tag', 'iPhone or an NFC-capable Android phone. No app and\nno account are needed to read it.', 'blue', 1, 26, 21))
s.f(2)
s.raw('<rect x="266" y="44" width="198" height="382" rx="16" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(T(365, 80, 'found.apple.com', 20, 700, '#1d4ed8', 'middle', mono=True))
s.raw(T(365, 122, 'Serial number', 20, 700, '#14213d', 'middle') + T(365, 150, 'H2X••••••9K', 20, 400, '#475569', 'middle', mono=True))
s.raw(callout(40, 598, 640, 116, 'A web page about the item', 'The tap opens a page with the item’s serial number.\nThe finder’s phone shows it; nothing is installed.', 'green', 2, 26, 21))
s.f(3)
s.raw('<rect x="274" y="176" width="182" height="196" rx="10" fill="#fef3c7" stroke="#b45309" stroke-width="1.5"/>')
s.raw(T(365, 208, 'Lost Mode', 20, 800, '#92400e', 'middle'))
s.raw(T(365, 242, '“Reward if', 20, 400, '#334155', 'middle') + T(365, 268, 'found. Call:”', 20, 400, '#334155', 'middle'))
s.raw(T(365, 302, '+44 •••• 0123', 20, 400, '#334155', 'middle', mono=True))
s.raw(T(365, 340, 'owner’s choice', 20, 700, '#92400e', 'middle'))
s.raw(callout(40, 726, 640, 143, 'Only if the owner turned on Lost Mode', 'The owner’s message and the phone number or email the\nowner chose to share. Without Lost Mode, a finder sees\nmuch less (details in level C below).', 'amber', 3, 26, 21))
s.f(4)
s.raw(panel(40, 881, 640, 258, 'slate', 4, 'What NFC does not do', None, 24))
s.raw(cross(76, 982, 18) + T(108, 989, 'No distant tracking: NFC works at centimetres.', 21, 400, '#334155'))
s.raw(cross(76, 1036, 18) + T(108, 1043, 'Not part of the crowd-sourced finding network', 21, 400, '#334155')
      + T(108, 1070, '(that is Bluetooth sightings, Scenes 34–37).', 21, 400, '#334155'))
s.raw(cross(76, 1112, 18) + T(108, 1119, 'No contact details unless the owner chose them.', 21, 400, '#334155'))
scenes[40] = s.render()

# ── 41 Owner lifecycle ───────────────────────────────────────────────
s = VScene(41, 'An owner’s life with the tag: what survives each change',
           'Six frames showing states and transitions. 1, setup moves the tag from unregistered to registered to one Apple '
           'Account. 2, the owner can share it with up to five people and later stop sharing; sharing grants viewing, not '
           'ownership. 3, a lost or replaced iPhone changes nothing about ownership, because items belong to the account; a '
           'newly signed-in device gets access, with key material synced through end-to-end encrypted iCloud Keychain '
           'according to Apple. 4, Remove Item unlinks the tag so another account can add it; if it is out of range, Apple '
           'documents a reset procedure. 5, losing the account itself without a recovery path means losing access to the '
           'item; account recovery restores it. 6, a key distinguishing disclosed behaviour from undisclosed cryptographic '
           'implementation.',
           sub='Ownership lives in the Apple Account, not in a phone. Grey dashed arrows are permissions, not data.')
s.bh = 1126


def state(x, y, w, title, sub, col='slate'):
    c, light, border = STEP[col]
    return (f'<rect x="{x}" y="{y}" width="{w}" height="92" rx="46" fill="{light}" stroke="{c}" stroke-width="3"/>'
            + T(x + w / 2, y + 40, title, 24, 800, '#14213d', 'middle') + T(x + w / 2, y + 70, sub, 20, 400, '#475569', 'middle'))


s.f(1)
s.raw(state(78, 0, 306, 'Unregistered', 'new, removed or reset', 'slate'))
s.raw(state(78, 136, 306, 'Registered', 'linked to one Apple Account', 'blue'))
s.arrow([(300, 94), (300, 132)], 'admin', '1 setup', at=(364, 121))
s.f(2)
s.raw(state(78, 272, 306, 'Shared', 'up to 5 people can view it', 'green'))
s.arrow([(160, 230), (160, 268)], 'admin', '2 share', at=(226, 257))
s.arrow([(300, 270), (300, 232)], 'admin', 'stop sharing', at=(386, 257))
s.f(3)
s.raw(phone(450, 0, 76, 140, '#f8fafc'))
s.raw(cross(488, 70, 20))
s.raw(phone(604, 0, 76, 140, '#f8fafc'))
s.arrow([(532, 70), (596, 70)], 'crypto')
s.raw(T(565, 164, 'keys sync', 20, 700, '#6d28d9', 'middle'))
s.raw(callout(40, 516, 640, 143, 'Phone lost or replaced: ownership unchanged', 'Items belong to the account. A new signed-in device gets\naccess; Apple says Find My key material syncs via\nend-to-end encrypted iCloud Keychain.', 'purple', 3, 23, 21))
s.f(4)
s.arrow([(78, 182), (56, 182), (56, 46), (74, 46)], 'admin', '4 Remove Item', at=(150, 121))
s.raw(callout(40, 667, 640, 116, 'Remove, then transfer', 'Remove Item unlinks the tag; then another account can\nset it up. Out of range? Apple documents a reset.', 'slate', 4, 26, 21))
s.f(5)
s.raw(state(78, 408, 306, 'Account inaccessible', 'no sign-in, no recovery', 'red'))
s.arrow([(388, 210), (470, 210), (470, 454), (392, 454)], 'admin', 'lose access', at=(470, 340))
s.arrow([(388, 480), (610, 480), (610, 184), (392, 184)], 'admin', '5 recovery', at=(610, 410))
s.raw(callout(40, 791, 640, 116, 'Lose the account, lose the item', 'Without recovery (recovery contact, key or Apple’s\nprocess), the owner cannot see the item or its sightings.', 'red', 5, 26, 21))
s.f(6)
s.raw(panel(40, 915, 640, 208, 'amber', 6, 'Disclosed behaviour vs\nundisclosed implementation', None, 24))
s.raw(chip(64, 1018, 'DOCUMENTED', 'doc') + T(64 + chip_w('DOCUMENTED') + 12, 1042, 'every transition shown', 21, 400, '#334155'))
s.raw(chip(64, 1064, 'UNDISCLOSED', 'und') + T(64 + chip_w('UNDISCLOSED') + 12, 1088, 'how keys are re-issued, revoked or\nerased at each step', 21, 400, '#334155'))
scenes[41] = s.render()
