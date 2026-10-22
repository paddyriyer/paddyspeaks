"""Module 6 scenes (42–49): account ownership, cryptography, privacy and other ecosystems.
Run scripts/invisible_engine/build.py to write the SVGs."""
from .svgkit import Scene
from .art import *

scenes = {}


# ── local helpers (Module 6 only) ───────────────────────────────────
def envelope(x, y, w=120, color='#7c3aed', fill='#f5f3ff'):
    h = w * 0.66
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h:.0f}" rx="8" fill="{fill}" stroke="{color}" stroke-width="3"/>'
            f'<path d="M{x},{y + 6} L{x + w / 2:.0f},{y + h * 0.55:.0f} L{x + w},{y + 6}" fill="none" stroke="{color}" stroke-width="3"/>')


def cross(x, y, r=26, color='#475569'):
    """A circled cross: 'not present / does not happen'."""
    return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="#ffffff" stroke="{color}" stroke-width="4"/>'
            f'<path d="M{x - r * 0.45:.0f},{y - r * 0.45:.0f} L{x + r * 0.45:.0f},{y + r * 0.45:.0f} M{x + r * 0.45:.0f},{y - r * 0.45:.0f} L{x - r * 0.45:.0f},{y + r * 0.45:.0f}" stroke="{color}" stroke-width="5" stroke-linecap="round"/>')


def tick(x, y, r=16, color='#16a34a'):
    return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="{color}"/>'
            f'<path d="M{x - r * 0.45:.0f},{y + r * 0.02:.0f} L{x - r * 0.1:.0f},{y + r * 0.38:.0f} L{x + r * 0.5:.0f},{y - r * 0.35:.0f}" fill="none" stroke="#ffffff" stroke-width="{r * 0.26:.1f}" stroke-linecap="round" stroke-linejoin="round"/>')


def chip(x, y, label, kind):
    """Evidence chip: doc / inf / und / ver."""
    st = {'doc': ('#1e40af', '#eff6ff', '#93c5fd', ''), 'inf': ('#6b21a8', '#faf5ff', '#d8b4fe', ''),
          'und': ('#374151', '#ffffff', '#6b7280', ' stroke-dasharray="6 4"'),
          'ver': ('#9a3412', '#fff7ed', '#fdba74', '')}[kind]
    w = len(label) * 8.4 + 22
    return (f'<rect x="{x}" y="{y}" width="{w:.0f}" height="28" rx="14" fill="{st[1]}" stroke="{st[2]}" stroke-width="2"{st[3]}/>'
            + T(x + w / 2, y + 19, label, 13, 700, st[0], 'middle', mono=True))


def key(x, y, s=1.0, color='#7c3aed'):
    """A key lying horizontally; (x, y) is the centre of the bow, about 110 x 40 at s=1."""
    return (f'<circle cx="{x}" cy="{y}" r="{18 * s:.0f}" fill="none" stroke="{color}" stroke-width="{7 * s:.1f}"/>'
            f'<path d="M{x + 18 * s:.0f},{y} L{x + 92 * s:.0f},{y} M{x + 72 * s:.0f},{y} L{x + 72 * s:.0f},{y + 16 * s:.0f} '
            f'M{x + 86 * s:.0f},{y} L{x + 86 * s:.0f},{y + 12 * s:.0f}" fill="none" stroke="{color}" stroke-width="{7 * s:.1f}" stroke-linecap="round"/>')


def padlock(x, y, s=1.0, color='#7c3aed', open_=False):
    """A padlock; (x, y) is the top-left of the body, 60 x 48 at s=1. open_=True swings the shackle up."""
    w, h = 60 * s, 48 * s
    if open_:
        shackle = (f'<path d="M{x + 12 * s:.0f},{y} L{x + 12 * s:.0f},{y - 30 * s:.0f} a{18 * s:.0f},{18 * s:.0f} 0 0 1 {36 * s:.0f},0 '
                   f'L{x + 48 * s:.0f},{y - 22 * s:.0f}" fill="none" stroke="{color}" stroke-width="{7 * s:.1f}" transform="translate({14 * s:.0f},{-12 * s:.0f})"/>')
    else:
        shackle = (f'<path d="M{x + 12 * s:.0f},{y} L{x + 12 * s:.0f},{y - 16 * s:.0f} a{18 * s:.0f},{18 * s:.0f} 0 0 1 {36 * s:.0f},0 '
                   f'L{x + 48 * s:.0f},{y}" fill="none" stroke="{color}" stroke-width="{7 * s:.1f}"/>')
    return (shackle + f'<rect x="{x}" y="{y}" width="{w:.0f}" height="{h:.0f}" rx="{8 * s:.0f}" fill="{color}"/>'
            f'<circle cx="{x + w / 2:.0f}" cy="{y + h * 0.42:.0f}" r="{6 * s:.0f}" fill="#ffffff"/>'
            f'<rect x="{x + w / 2 - 2.5 * s:.0f}" y="{y + h * 0.45:.0f}" width="{5 * s:.0f}" height="{14 * s:.0f}" fill="#ffffff"/>')


def bound_raw(x, y, w, h, label=None, rx=16):
    """A thick trust boundary drawn without the legend class (used where the legend would overflow)."""
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="none" stroke="#14213d" stroke-width="5"/>'
    if label:
        out += (f'<rect x="{x + 14}" y="{y + h - 13}" width="{len(label) * 8.6 + 16:.0f}" height="26" rx="5" fill="#14213d"/>'
                + T(x + 22, y + h + 6, label, 14.5, 700, '#ffffff'))
    return out


def card_box(x, y, w, h, title, lines, color='slate', hazard=False):
    """A small text card; hazard=True gives the red dashed outline (legend: hazard)."""
    c, light, border = STEP[color]
    if hazard:
        out = ''  # the caller draws the hazard outline with s.rect(..., 'hz') so the legend picks it up
    else:
        out = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{light}" stroke="{border}" stroke-width="2"/>'
    out += T(x + 16, y + 32, title, 18, 800, c if not hazard else '#991b1b')
    out += T(x + 16, y + 58, lines, 14.5, 400, '#334155')
    return out


def tag_label(x, y, text='item tracker'):
    return T(x, y, text, 15, 600, '#475569', 'middle')


# ── 42 Three ownership domains ───────────────────────────────────────
s = Scene(42, 'Three kinds of “mine”: holding it, owning the account, holding the keys',
          'Four frames building a Venn diagram of three overlapping circles. 1, physical possession: whoever holds the '
          'tracker. 2, the linked cloud account: the account the tracker is registered to. 3, cryptographic authority: whoever '
          'holds the private keys that open location reports. 4, the overlaps: the rightful owner with a trusted device sits '
          'in all three; a finder or thief holds the tag but can read nothing; the owner far away has the account and the keys '
          'but not the tag; and a newly signed-in device has the account but receives the end-to-end keys only once it meets '
          'the trusted-device conditions.',
          sub='Signing in to an account is not the same as holding every secret behind it.')
A, B, Cc, R = (590, 390), (890, 390), (740, 610), 205
s.f(1)
s.raw(f'<circle cx="{A[0]}" cy="{A[1]}" r="{R}" fill="#fff7ed" fill-opacity="0.75" stroke="#ea580c" stroke-width="4"/>')
s.raw(tag(470, 330, 34))
s.raw(T(530, 250, 'POSSESSION', 16, 800, '#9a3412', 'middle', mono=True))
s.raw(callout(60, 170, 330, 150, 'Holding it', 'Whoever has the tag in\ntheir hand or bag. That\nalone opens nothing.', 'orange', 1, 19, 16))
s.f(2)
s.raw(f'<circle cx="{B[0]}" cy="{B[1]}" r="{R}" fill="#eff6ff" fill-opacity="0.75" stroke="#2563eb" stroke-width="4"/>')
s.raw(cloud(905, 290, 130))
s.raw(T(960, 250, 'ACCOUNT', 16, 800, '#1e40af', 'middle', mono=True))
s.raw(callout(1180, 170, 360, 150, 'The linked account', 'The one account the tag is\nregistered to (Scene 31).\nIt decides who may ask.', 'blue', 2, 19, 16))
s.f(3)
s.raw(f'<circle cx="{Cc[0]}" cy="{Cc[1]}" r="{R}" fill="#f5f3ff" fill-opacity="0.75" stroke="#7c3aed" stroke-width="4"/>')
s.raw(key(690, 730, 0.9, '#7c3aed'))
s.raw(T(740, 795, 'KEYS', 16, 800, '#6b21a8', 'middle', mono=True))
s.raw(callout(1060, 640, 480, 150, 'The private keys', 'Whoever holds them can open the sealed\nlocation reports. They live only on\ntrusted devices (Scene 43).', 'purple', 3, 19, 16))
s.f(4)
s.raw(T(740, 452, 'rightful owner,', 15, 800, '#14213d', 'middle'))
s.raw(T(740, 472, 'trusted device', 15, 800, '#14213d', 'middle'))
s.raw(T(470, 410, 'a finder or thief:', 14, 600, '#334155', 'middle'))
s.raw(T(470, 430, 'holds it, reads nothing', 14, 400, '#334155', 'middle'))
s.raw(T(985, 410, 'new device signed in:', 14, 600, '#334155', 'middle'))
s.raw(T(985, 430, 'keys only once trusted', 14, 400, '#334155', 'middle'))
s.raw(T(850, 560, 'owner far away:', 14, 600, '#334155', 'middle'))
s.raw(T(850, 580, 'sees sightings', 14, 400, '#334155', 'middle'))
s.raw(callout(60, 560, 400, 230, 'The overlaps matter', 'Possession without keys reads\nnothing. An account sign-in on a\nnew device is not, by itself,\naccess to end-to-end keys: the\ndevice must be trusted first.', 'slate', 4, 19, 16))
scenes[42] = s.render('Conceptual. Overlap labels follow Apple’s documented Find My design.')

# ── 43 Secrets journey ───────────────────────────────────────────────
s = Scene(43, 'The journey of a secret: from birth to revocation',
          'Five frames along two lanes. Top lane, the owner-held keys that open location reports: 1, they are generated on '
          'the owner’s device, a key pair plus a secret seed; 2, at setup the tag receives only what it needs to derive '
          'rotating public keys, never the private key; 3, the private keys stay on the owner’s trusted devices and, Apple '
          'says, sync between them through end-to-end encrypted iCloud Keychain; 4, both sides derive a new key pair about '
          'every 15 minutes. 5, recovery and revocation, and the bottom lane: manufacturer and service keys (TLS '
          'certificates, device attestation, firmware signing) do different jobs and cannot open the reports.',
          sub='Two families of keys. Only one of them can read where the tag has been.')
s.raw(T(60, 182, 'OWNER-HELD KEYS — they open location reports', 16, 800, '#6b21a8', mono=True))
steps = [('Generate', 'on the owner’s device:\na key pair (d, P) and\na secret seed SK₀', 'purple', 'doc'),
         ('Provision', 'at setup the tag gets\nP and SK₀ — enough to\nderive public keys only', 'purple', 'doc'),
         ('Store and sync', 'd stays on trusted\ndevices; synced via\nE2E iCloud Keychain', 'purple', 'ver'),
         ('Derive and rotate', 'new Pᵢ (tag) and dᵢ\n(owner) about every\n15 minutes', 'purple', 'doc'),
         ('Recover or revoke', 'account recovery;\nRemove Item stops\nfuture use', 'slate', 'und')]
for i, (t_, b_, col, ev) in enumerate(steps):
    x = 60 + i * 300
    s.f(i + 1)
    c, light, border = STEP[col]
    s.raw(f'<rect x="{x}" y="200" width="270" height="250" rx="16" fill="{light}" stroke="{border}" stroke-width="2"/>')
    s.raw(badge(x + 34, 236, i + 1, col, 20))
    s.raw(T(x + 64, 244, t_, 19, 800, '#14213d'))
    s.raw(T(x + 18, 290, b_, 15.5, 400, '#334155'))
    s.raw(chip(x + 18, 400, {'doc': 'DOCUMENTED', 'ver': 'VERIFY', 'und': 'PARTLY UNDISCLOSED'}[ev], {'doc': 'doc', 'ver': 'ver', 'und': 'und'}[ev]))
    if i < 4:
        s.arrow([(x + 272, 325), (x + 298, 325)], 'crypto')
s.f(5)
s.raw(T(60, 512, 'MANUFACTURER AND SERVICE KEYS — a different job', 16, 800, '#334155', mono=True))
svc = [('TLS certificates', 'protect phone ↔ server\nconnections in transit'),
       ('Device attestation', 'lets a service check a\ngenuine device (detail\nnot public)'),
       ('Firmware signing', 'proves an update came\nfrom the maker'),
       ('Account authentication', 'passwords, 2FA, passkeys:\ndecide who may ask')]
for i, (t_, b_) in enumerate(svc):
    x = 60 + i * 300
    s.raw(f'<rect x="{x}" y="530" width="270" height="160" rx="14" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>')
    s.raw(T(x + 18, 566, t_, 17, 800, '#14213d'))
    s.raw(T(x + 18, 596, b_, 14.5, 400, '#475569'))
s.raw(callout(1260, 530, 280, 160, 'None of these', 'can open a sealed\nlocation report.', 'red', None, 19, 16))
s.raw(panel(60, 710, 1480, 104, 'amber', None, 'Why the split matters', None, 19))
s.raw(T(84, 786, 'A service can run, check devices and route reports without ever holding the keys that read them. That is what “end-to-end” means here.', 15.5, 400, '#334155'))
scenes[43] = s.render('Apple Platform Security guide (Find My). Schematic.')

# ── 44 Public and private keys ───────────────────────────────────────
s = Scene(44, 'Open padlocks and private keys — and why a signature is not a lock',
          'Five frames. 1, the analogy: the owner hands out open padlocks (public keys) that anyone can snap shut, and keeps '
          'the only key that opens them (the private key). 2, the precise version: a finder encrypts a location to the '
          'public key; only the owner’s private key decrypts it. 3, in practice a fresh one-time key and a symmetric cipher '
          'do the bulk work: ephemeral key agreement, a key-derivation function and authenticated encryption. 4, a '
          'different job: a maker signs a firmware update with its signing key and the device checks it with the matching '
          'public key; the update itself is not hidden. 5, a comparison: encryption decides who can read; a signature proves '
          'who wrote; different keys, different jobs.',
          sub='Encryption controls who can read. A signature proves who wrote. Different keys, different jobs.')
s.f(1)
s.raw(f'<rect x="60" y="160" width="520" height="380" rx="18" fill="#faf5ff" stroke="#d8b4fe" stroke-width="2"/>')
s.raw(badge(100, 200, 1, 'purple', 22) + T(134, 209, 'The analogy', 21, 800, '#14213d'))
for i in range(3):
    s.raw(padlock(100 + i * 80, 300, 0.9, '#a78bfa', open_=True))
s.raw(T(190, 400, 'open padlocks: hand out', 15.5, 700, '#6b21a8', 'middle'))
s.raw(T(190, 422, 'copies to anyone', 15.5, 400, '#334155', 'middle'))
s.raw(key(400, 330, 1.0, '#7c3aed'))
s.raw(T(450, 400, 'one key: keep it', 15.5, 700, '#6b21a8', 'middle'))
s.raw(T(80, 480, 'Anyone can snap a padlock shut. Only the keyholder opens it.', 15.5, 400, '#334155'))
s.raw(T(80, 504, 'Public key = open padlock. Private key = the only key.', 15.5, 600, '#14213d'))
s.f(2)
s.raw(f'<rect x="620" y="160" width="920" height="380" rx="18" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(badge(660, 200, 2, 'purple', 22) + T(694, 209, 'The precise version: encrypt to a public key', 21, 800, '#14213d'))
s.raw(phone(660, 250, 100, 190, '#f0fdf4'))
s.raw(T(710, 462, 'finder', 15, 600, '#475569', 'middle'))
s.raw(T(710, 330, 'place', 14, 700, '#166534', 'middle') + T(710, 348, '+ time', 14, 700, '#166534', 'middle'))
s.raw(envelope(880, 300, 110))
s.raw(padlock(910, 330, 0.6, '#7c3aed'))
s.arrow([(770, 345), (870, 345)], 'crypto', 'with P', at=(820, 318))
s.arrow([(1000, 345), (1290, 345)], 'crypto', 'sealed report', at=(1145, 318))
s.raw(phone(1300, 250, 100, 190, '#f5f3ff'))
s.raw(key(1316, 345, 0.55, '#7c3aed'))
s.raw(T(1350, 462, 'owner', 15, 600, '#475569', 'middle'))
s.raw(T(1420, 300, 'only d', 15, 800, '#6b21a8'))
s.raw(T(1420, 320, 'opens it', 15, 400, '#334155'))
s.f(3)
s.raw(T(660, 506, 'In practice: one-time key agreement (ECDH) → key derivation → AES-GCM. The public key never decrypts anything.', 15, 400, '#475569'))
s.f(4)
s.raw(f'<rect x="60" y="570" width="900" height="244" rx="18" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(badge(100, 610, 4, 'blue', 22) + T(134, 619, 'A different job: a signed firmware update', 21, 800, '#14213d'))
s.raw(server(100, 650, 0.75, None))
s.raw(T(145, 790, 'maker', 15, 600, '#475569', 'middle'))
s.raw(f'<rect x="300" y="660" width="170" height="110" rx="10" fill="#f0fdf4" stroke="#16a34a" stroke-width="2"/>')
s.raw(T(385, 700, 'update v2.1', 16, 800, '#166534', 'middle'))
s.raw(T(385, 724, '(readable)', 14, 400, '#334155', 'middle'))
s.raw(f'<rect x="330" y="740" width="110" height="22" rx="5" fill="#7c3aed"/>' + T(385, 756, 'signature', 13, 700, '#ffffff', 'middle'))
s.arrow([(200, 715), (290, 715)], 'crypto', 'sign', at=(245, 690))
s.arrow([(480, 715), (695, 715)], 'plain', 'update + signature', at=(588, 690))
s.raw(tag(745, 715, 36))
s.raw(tick(795, 690, 16))
s.raw(T(800, 742, 'checks with the', 14, 400, '#334155'))
s.raw(T(800, 760, 'maker’s public key', 14, 400, '#334155'))
s.f(5)
s.raw(f'<rect x="1000" y="570" width="540" height="244" rx="18" fill="#fffbeb" stroke="#fcd34d" stroke-width="2"/>')
s.raw(badge(1040, 610, 5, 'amber', 22) + T(1074, 619, 'Not the same thing', 21, 800, '#14213d'))
s.raw(T(1030, 668, 'Encryption', 16, 800, '#6b21a8') + T(1220, 668, 'Signature', 16, 800, '#1e40af'))
rows = [('who can read it', 'who wrote it'), ('lock with public,', 'sign with private,'), ('open with private', 'check with public'),
        ('hides the content', 'hides nothing')]
for i, (a_, b_) in enumerate(rows):
    s.raw(T(1030, 698 + i * 26, a_, 15, 400, '#334155') + T(1220, 698 + i * 26, b_, 15, 400, '#334155'))
scenes[44] = s.render('Conceptual. Keys and algorithms simplified; Apple documents ECDH, a KDF and AES-GCM for Find My.')

# ── 45 Encryption layers ─────────────────────────────────────────────
s = Scene(45, 'Three layers of protection, three different jobs',
          'Five frames along the path from tag to owner. 1, the path: tag, passer-by’s phone, Apple’s relay, owner’s phone. '
          '2, the radio link: the broadcast is not encrypted, because the identifier is public by design; Bluetooth link '
          'encryption applies only to connections. 3, TLS protects each internet hop in transit and ends at Apple’s servers. '
          '4, end-to-end encryption wraps the location from the finder’s phone to the owner’s phone, through the relay and '
          'while stored there. 5, where data is readable: on the finder’s phone (its own location), as ciphertext with '
          'metadata at rest on the relay, and on the owner’s phone after decryption.',
          sub='The radio, the internet hop and the report itself are protected differently.')
X = {'tag': 170, 'fin': 520, 'rel': 960, 'own': 1390}
s.f(1)
s.raw(tag(X['tag'], 290, 44) + tag_label(X['tag'], 360))
s.raw(phone(X['fin'] - 50, 200, 100, 190, '#f8fafc') + T(X['fin'], 412, 'passer-by’s phone', 15, 600, '#475569', 'middle'))
s.raw(server(X['rel'] - 60, 210, 1.0, None))
s.raw(bound_raw(X['rel'] - 140, 180, 280, 240, 'Apple relay'))
s.raw(phone(X['own'] - 50, 200, 100, 190, '#f8fafc') + T(X['own'], 412, 'owner’s phone', 15, 600, '#475569', 'middle'))
s.raw(T(60, 470, 'LAYER', 14, 800, '#64748b', mono=True))
s.f(2)
s.raw(f'<rect x="60" y="486" width="1480" height="56" rx="10" fill="#eff6ff"/>')
s.raw(T(80, 520, 'Radio broadcast', 16, 800, '#1e40af'))
s.arrow([(X['tag'] + 50, 290), (X['fin'] - 60, 290)], 'signal', 'Bluetooth: in the clear', at=(345, 262))
s.raw(f'<path d="M300,514 L{X["fin"]},514" stroke="#1d4ed8" stroke-width="8" stroke-linecap="round"/>')
s.raw(T(X['fin'] + 30, 520, 'not encrypted: the rotating key is public by design', 15, 400, '#334155'))
s.f(3)
s.raw(f'<rect x="60" y="552" width="1480" height="56" rx="10" fill="#f8fafc"/>')
s.raw(T(80, 586, 'TLS (in transit)', 16, 800, '#334155'))
s.raw(f'<path d="M{X["fin"]},580 L{X["rel"] - 20},580 M{X["rel"] + 20},580 L{X["own"]},580" stroke="#475569" stroke-width="8" stroke-linecap="round"/>')
s.raw(T(X['rel'], 600, 'ends at the server', 13.5, 600, '#475569', 'middle'))
s.f(4)
s.raw(f'<rect x="60" y="618" width="1480" height="56" rx="10" fill="#f5f3ff"/>')
s.raw(T(80, 652, 'End to end', 16, 800, '#6b21a8'))
s.raw(f'<path d="M{X["fin"]},646 L{X["own"]},646" stroke="#7c3aed" stroke-width="8" stroke-linecap="round"/>')
s.arrow([(X['fin'] + 60, 300), (X['rel'] - 150, 300)], 'crypto', 'sealed report', at=(705, 272))
s.arrow([(X['rel'] + 150, 300), (X['own'] - 60, 300)], 'crypto', 'sealed report', at=(1215, 272))
s.raw(padlock(X['rel'] + 70, 340, 0.55, '#7c3aed'))
s.f(5)
s.raw(card_box(60, 694, 470, 120, 'On a device', 'Plaintext only on the finder’s phone (its\nown location) and on the owner’s phone\nafter decrypting.', 'green'))
s.raw(card_box(565, 694, 470, 120, 'In transit', 'TLS around the internet hops; the report\ninside stays end-to-end encrypted.', 'slate'))
s.raw(card_box(1070, 694, 470, 120, 'At rest on the relay', 'Ciphertext, a lookup hash, upload time and\nconnection metadata. Not the location.', 'purple'))
scenes[45] = s.render('Apple’s documented Find My design. Schematic.')

# ── 46 Who can see what ──────────────────────────────────────────────
s = Scene(46, 'Who can see what: one table, eight observers',
          'Four frames revealing a table for Apple’s documented Find My design. Columns: the radio identifier, the approximate '
          'location, the owner’s identity, the finder’s identity, the sealed report and service metadata. 1, the tag sees only '
          'its own identifier; the passer-by’s phone sees the identifier, its own location, itself, and the report it made; '
          'a nearby radio listener sees only the identifier. 2, the relay operator sees a lookup hash, the sealed report and '
          'metadata, never the location; an internet provider sees only that connections happened. 3, the owner sees the '
          'location after decrypting and knows their own account; a person the owner shares with can see the location. '
          '4, an outside attacker without the account or keys sees only what any radio listener sees, unless they take over '
          'the account (Scene 48).',
          sub='Apple Find My, as documented. Other ecosystems are compared in Scene 47.')
COLS = ['Radio identifier', 'Approx. location', 'Owner identity', 'Finder identity', 'Sealed report', 'Service metadata']
CX0, CW, LW = 60, 200, 280
s.raw(f'<rect x="{CX0}" y="160" width="{LW + CW * 6}" height="56" rx="10" fill="#f1f5f9"/>')
s.raw(T(CX0 + 16, 195, 'Observer', 16, 800, '#14213d'))
for i, c in enumerate(COLS):
    s.raw(T(CX0 + LW + CW * i + CW / 2, 195, c, 15, 800, '#14213d', 'middle'))
STYLE = {'yes': ('#166534', '● '), 'no': ('#4b5563', '○ '), 'meta': ('#92400e', '≈ '), 'own': ('#166534', '● '), 'und': ('#374151', '? ')}
ROWS = [
    (1, 'The tag', [('yes', 'its own'), ('no', 'no'), ('no', 'no'), ('no', 'no'), ('no', 'no'), ('no', 'no')]),
    (1, 'Passer-by’s phone', [('yes', 'hears it'), ('own', 'its own'), ('no', 'no'), ('own', 'itself'), ('own', 'makes it'), ('own', 'its uploads')]),
    (1, 'Nearby radio listener', [('yes', 'hears it'), ('no', 'no'), ('no', 'no'), ('no', 'no'), ('no', 'no'), ('no', 'no')]),
    (2, 'Relay operator (Apple)', [('meta', 'hash only'), ('no', 'no'), ('meta', 'who asks'), ('meta', 'connection'), ('yes', 'stores it'), ('yes', 'yes')]),
    (2, 'Internet provider', [('no', 'no'), ('no', 'no'), ('meta', 'connection'), ('meta', 'connection'), ('no', 'TLS'), ('meta', 'traffic')]),
    (3, 'The owner', [('yes', 'derives it'), ('yes', 'decrypts'), ('yes', 'themself'), ('no', 'no'), ('yes', 'fetches'), ('own', 'own account')]),
    (3, 'Person it is shared with', [('und', 'undisclosed'), ('yes', 'can view'), ('yes', 'knows owner'), ('no', 'no'), ('und', 'undisclosed'), ('no', 'no')]),
    (4, 'Outside attacker', [('yes', 'if nearby'), ('no', 'no*'), ('no', 'no*'), ('no', 'no'), ('no', 'no*'), ('no', 'no')]),
]
for r, (fr, who, cells) in enumerate(ROWS):
    s.f(fr)
    y = 222 + r * 62
    fill = '#ffffff' if r % 2 else '#fbfaf7'
    if who == 'Outside attacker':
        s.rect(CX0, y, LW + CW * 6, 56, 'hz', rx=8)
    else:
        s.raw(f'<rect x="{CX0}" y="{y}" width="{LW + CW * 6}" height="56" rx="8" fill="{fill}" stroke="#e5e7eb" stroke-width="1"/>')
    s.raw(T(CX0 + 16, y + 35, who, 16, 700, '#14213d'))
    for i, (k, txt) in enumerate(cells):
        col, mark = STYLE[k]
        s.raw(T(CX0 + LW + CW * i + CW / 2, y + 35, mark + txt, 15, 700 if k in ('yes', 'own') else 400, col, 'middle'))
s.f(4)
s.raw(T(60, 742, '* unless the attacker takes over the owner’s account (Scene 48) — then they see what the owner sees.', 15, 600, '#991b1b'))
s.raw(T(60, 770, '● yes   ○ no   ≈ metadata only   ? not publicly documented.   Agrees with Module 5, demo D.', 15, 400, '#475569'))
s.raw(T(60, 798, 'Apple says it cannot read locations and reports do not identify the finder; connection metadata still exists.', 15, 400, '#475569'))
scenes[46] = s.render('Apple Find My, documented design. Simplified.')

# ── 47 Competing ecosystems ──────────────────────────────────────────
s = Scene(47, 'Four networks, similar goals, different designs',
          'Four frames building a comparison of Apple Find My, Google Find Hub, Samsung SmartThings Find and Tile, with no '
          'ranking. 1, the four networks and who relays sightings. 2, encryption and account linking as each company '
          'documents them. 3, precise finding, sharing and alerts for the person a tag travels with. 4, how much each '
          'publishes about its protocol, and a note that cells marked verify could not be confirmed from the company’s own '
          'pages for this lesson.',
          sub='As each company documents it. No scores, no winners. “Verify” = not confirmed from the company’s own page.')
NETS = ['Apple Find My', 'Google Find Hub', 'Samsung SmartThings Find', 'Tile (Life360)']
GX0, GL, GW = 60, 230, 312
s.f(1)
s.raw(f'<rect x="{GX0}" y="160" width="{GL + GW * 4}" height="60" rx="10" fill="#f1f5f9"/>')
for i, n in enumerate(NETS):
    s.raw(T(GX0 + GL + GW * i + 16, 198, n, 17, 800, '#14213d'))
GRID = [
    (1, 'Who relays', ['Nearby Apple devices,\nin the background', 'Android devices; by default\nonly in busy areas, aggregated', 'Galaxy devices\n(“nodes”)', 'Phones running the Tile\nor Life360 app (verify)']),
    (2, 'Encryption', ['End to end; Apple says\nit cannot read locations', 'End to end; key unlocked by\nthe phone’s screen lock', 'Encrypted, Knox-protected;\nprivate ID changes / 15 min', 'Not compared here:\ncheck Tile’s own pages']),
    (2, 'Account link', ['One Apple Account\nper AirTag', 'Google Account; trackers\nfrom partner makers (verify)', 'One account or device\nat a time', 'Tile account (verify)']),
    (3, 'Precise finding', ['UWB on supported\niPhones', 'Depends on the tracker\nmodel (verify)', 'UWB on supported\nGalaxy phones (verify)', 'Depends on the model\n(verify)']),
    (3, 'Alerts for the\ncarrier', ['iPhone alert; tag sounds;\nAndroid via shared spec', 'Android 6.0+ alerts and\na manual Scan now', 'Unknown-tag alert is a\nsetting; manual search', 'Scan and Secure: a\nmanual scan (verify)']),
    (4, 'What is\npublished', ['Design in Apple Platform\nSecurity; studied by research', 'Design on Google’s\nsecurity blog', 'Newsroom-level\ndescriptions', 'Less public technical\ndetail (verify)']),
]
for r, (fr, lab, cells) in enumerate(GRID):
    s.f(fr)
    y = 226 + r * 82
    s.raw(f'<rect x="{GX0}" y="{y}" width="{GL + GW * 4}" height="76" rx="8" fill="{"#ffffff" if r % 2 else "#fbfaf7"}" stroke="#e5e7eb" stroke-width="1"/>')
    s.raw(T(GX0 + 16, y + 32, lab, 16, 800, '#14213d'))
    for i, c in enumerate(cells):
        ver = 'verify' in c or 'Not compared' in c
        s.raw(T(GX0 + GL + GW * i + 16, y + 30, c, 14.5, 400, '#9a3412' if ver else '#334155', italic=ver))
s.f(4)
s.raw(T(60, 742, 'All four aim to find lost things without revealing the finder; the published detail differs a great deal.', 15.5, 600, '#14213d'))
s.raw(T(60, 770, 'Apple and Google share one specification for unwanted-tracking alerts (Scene 52). Nothing here implies the', 15, 400, '#475569'))
s.raw(T(60, 792, 'networks share data or use the same algorithms.', 15, 400, '#475569'))
scenes[47] = s.render('Company documentation as cited on the page. No ranking.')

# ── 48 Identity lifecycle risks ──────────────────────────────────────
s = Scene(48, 'Where the account is the weak point',
          'Five frames around one account with its trusted devices. Seven risks appear as red dashed cards, each with what it '
          'needs and what it exposes: 1, the account, its trusted devices and shares. 2, a shared or reused password, and an '
          'old trusted device nobody manages. 3, coercive access by someone close, and a share nobody remembers. 4, account '
          'takeover, and abuse of account recovery. 5, shared household permissions, and the defences: review devices and '
          'sharing (for example Apple’s Safety Check), a unique password with two-factor authentication, and a recovery '
          'method you control.',
          sub='Strong encryption protects the reports. It cannot tell who is holding the account.')
s.f(1)
s.raw(cloud(640, 220, 320, 'one account'))
for i, xx in enumerate((620, 760, 900)):
    s.raw(phone(xx, 420, 70, 130, '#f8fafc'))
s.raw(T(800, 580, 'trusted devices and shares', 15, 600, '#475569', 'middle'))
RISKS = [
    (2, 60, 160, 'Shared or reused password', 'Needs: the password, and a way\npast 2FA. Exposes: what the\nowner sees.'),
    (2, 1180, 160, 'Forgotten trusted device', 'Needs: an old phone still signed\nin. Exposes: the owner’s view,\nfor whoever holds it.'),
    (3, 60, 370, 'Coercive access', 'Needs: someone with power over\nthe owner. Exposes: whatever\nthey are made to show.'),
    (3, 1180, 370, 'A share nobody remembers', 'Needs: an old share not\nreviewed. Exposes: the item’s\nlocation, to that person.'),
    (4, 60, 580, 'Account takeover', 'Needs: credentials plus a 2FA\nbypass. Exposes: all items,\nas the owner.'),
    (4, 1180, 580, 'Recovery abuse', 'Needs: control of a recovery\npath. Exposes: the account\nafter reset.'),
]
for fr, x, y, t_, b_ in RISKS:
    s.f(fr)
    s.rect(x, y, 360, 190, 'hz', rx=12)
    s.raw(card_box(x, y, 360, 190, t_, b_, hazard=True))
s.f(5)
s.raw(card_box(460, 610, 680, 90, 'Shared household permissions', 'Family or shared accounts can mean several people\nsee one item — by design, until reviewed.', 'amber'))
s.raw(panel(460, 712, 680, 104, 'green', None, 'Defences', None, 19))
s.raw(T(484, 784, 'Review devices and sharing (e.g. Apple Safety Check) · unique', 15, 400, '#14532d'))
s.raw(T(484, 805, 'password + 2FA · a recovery method you control', 15, 400, '#14532d'))
scenes[48] = s.render('Defensive summary; no attack steps.')

# ── 49 Unwanted tracking ─────────────────────────────────────────────
s = Scene(49, 'Same tag, two stories: a lost bag, or a person being followed',
          'Five frames. 1, a lost bag: the owner sees their own bag on a map; this is the purpose of the network. 2, the same '
          'tag hidden in another person’s bag: the person carrying it is located and told nothing; the owner’s map now '
          'shows a person. 3, encryption cannot tell the stories apart: it protects the owner’s view in both. 4, protective '
          'alerts: a phone can warn the person a separated tag travels with, iPhone and Android alike through a shared '
          'specification, and a separated tag plays a sound when moved; alerts take time and need a compatible phone. 5, a '
          'safety note: disabling a tracker can alert the person who placed it; think about safety first and get support.',
          sub='The mechanism that finds keys can also locate a person. Encryption cannot tell which.')
s.f(1)
s.raw(f'<rect x="60" y="160" width="700" height="370" rx="18" fill="#f0fdf4" stroke="#86efac" stroke-width="2"/>')
s.raw(badge(100, 200, 1, 'green', 22) + T(134, 209, 'A lost bag', 21, 800, '#14213d'))
s.raw(suitcase(120, 290, 0.8))
s.raw(tag(250, 330, 26))
s.raw(phone(520, 240, 120, 230, '#ecfdf5'))
s.raw(pin(580, 380, 0.8, '#16a34a'))
s.raw(T(580, 420, 'my bag', 15, 700, '#166534', 'middle'))
s.raw(T(100, 500, 'The owner finds their own bag. This is the network’s purpose.', 15.5, 400, '#334155'))
s.f(2)
s.raw(f'<rect x="840" y="160" width="700" height="370" rx="18" fill="#fef2f2" stroke="#fca5a5" stroke-width="2"/>')
s.raw(badge(880, 200, 2, 'red', 22) + T(914, 209, 'A tag hidden in someone’s bag', 21, 800, '#14213d'))
s.raw(person(960, 250, 0.95, '#64748b'))
s.raw(suitcase(1010, 330, 0.6, '#475569'))
s.rect(1030, 352, 60, 56, 'hz', rx=10)
s.raw(tag(1060, 380, 18))
s.raw(phone(1330, 240, 120, 230, '#fef2f2'))
s.raw(pin(1390, 380, 0.8, '#dc2626'))
s.raw(T(1390, 420, 'a person', 15, 700, '#991b1b', 'middle'))
s.raw(T(880, 500, 'The person carrying it is located and was never asked.', 15.5, 400, '#334155'))
s.f(3)
s.raw(padlock(400, 560, 0.7, '#7c3aed') + padlock(1180, 560, 0.7, '#7c3aed'))
s.raw(callout(460, 548, 680, 96, 'Encryption cannot tell the stories apart', 'It keeps the relay and strangers out — and protects an abusive\nowner’s view exactly as well as a rightful owner’s.', 'purple', 3, 18, 15.5))
s.f(4)
s.raw(callout(60, 664, 700, 150, 'Protective alerts — and their limits', 'A phone can warn the person a separated tag travels with\n(iPhone and Android, via one shared specification); a separated\ntag sounds when moved. Alerts take time, need separation from\nthe owner and a compatible phone (Scene 52).', 'blue', 4, 18, 15))
s.f(5)
s.raw(callout(840, 664, 700, 150, 'If you find a tracker: safety first', 'Disabling it can alert the person who placed it, and stops\ntheir location updates. Think about your safety first, and\nconsider contacting police or a support service before acting\n(Module 7).', 'amber', 5, 18, 15))
scenes[49] = s.render('Defensive framing only. No placement or evasion detail.')
