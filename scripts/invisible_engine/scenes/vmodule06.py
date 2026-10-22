"""Module 6 phone-vertical scenes (42–49): the same scenes as module06.py, laid out for a
phone (VScene: 720 wide, body drawn in its own coordinates below the header).
Same title, desc, frames and words as the landscape scene; invisible-engine/tests/check.py
compares them. Change a scene's words in both files."""
from .svgkit import VScene
from .art import *
from .module06 import envelope, tick, key, padlock

scenes = {}


# ── local helpers at the phone type scale ────────────────────────────
def vchip(x, y, label, kind):
    """Evidence chip (module06.chip) at 20 px."""
    st = {'doc': ('#1e40af', '#eff6ff', '#93c5fd', ''), 'und': ('#374151', '#ffffff', '#6b7280', ' stroke-dasharray="6 4"'),
          'ver': ('#9a3412', '#fff7ed', '#fdba74', '')}[kind]
    w = len(label) * 12.2 + 24
    return (f'<rect x="{x}" y="{y}" width="{w:.0f}" height="36" rx="18" fill="{st[1]}" stroke="{st[2]}" stroke-width="2"{st[3]}/>'
            + T(x + w / 2, y + 25, label, 20, 700, st[0], 'middle', mono=True))


def vbound(x, y, w, h, label=None, rx=16):
    """module06.bound_raw at 20 px: a thick boundary outside the legend."""
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="none" stroke="#14213d" stroke-width="5"/>'
    if label:
        out += (f'<rect x="{x + 14}" y="{y + h - 17}" width="{len(label) * 11.4 + 20:.0f}" height="34" rx="6" fill="#14213d"/>'
                + T(x + 24, y + h + 7, label, 20, 700, '#ffffff'))
    return out


def vcard(x, y, w, h, title, lines, color='slate', hazard=False):
    """module06.card_box at 24 / 21 px; hazard=True leaves the outline to s.rect(..., 'hz')."""
    c, light, border = STEP[color]
    out = '' if hazard else f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{light}" stroke="{border}" stroke-width="2"/>'
    out += T(x + 18, y + 38, title, 24, 800, c if not hazard else '#991b1b')
    out += T(x + 18, y + 72, lines, 21, 400, '#334155')
    return out


def co(x, y, w, h, title, body, color, n=None):
    return callout(x, y, w, h, title, body, color, n, 26, 21)


# ── 42 Three ownership domains ───────────────────────────────────────
s = VScene(42, 'Three kinds of “mine”: holding it, owning the account, holding the keys',
           'Four frames building a Venn diagram of three overlapping circles. 1, physical possession: whoever holds the '
           'tracker. 2, the linked cloud account: the account the tracker is registered to. 3, cryptographic authority: whoever '
           'holds the private keys that open location reports. 4, the overlaps: the rightful owner with a trusted device sits '
           'in all three; a finder or thief holds the tag but can read nothing; the owner far away has the account and the keys '
           'but not the tag; and a newly signed-in device has the account but receives the end-to-end keys only once it meets '
           'the trusted-device conditions.',
           sub='Signing in to an account is not the same as holding every secret behind it.',
           note='Conceptual. Overlap labels follow Apple’s documented Find My design.', h=1726)
A, B, Cc, R = (240, 200), (480, 200), (360, 408), 200
s.f(1)
s.raw(f'<circle cx="{A[0]}" cy="{A[1]}" r="{R}" fill="#fff7ed" fill-opacity="0.75" stroke="#ea580c" stroke-width="4"/>')
s.raw(tag(150, 115, 30))
s.raw(T(200, 50, 'POSSESSION', 20, 800, '#9a3412', 'middle', mono=True))
s.raw(co(40, 628, 640, 112, 'Holding it', 'Whoever has the tag in their hand or bag.\nThat alone opens nothing.', 'orange', 1))
s.f(2)
s.raw(f'<circle cx="{B[0]}" cy="{B[1]}" r="{R}" fill="#eff6ff" fill-opacity="0.75" stroke="#2563eb" stroke-width="4"/>')
s.raw(cloud(520, 80, 110))
s.raw(T(520, 50, 'ACCOUNT', 20, 800, '#1e40af', 'middle', mono=True))
s.raw(co(40, 750, 640, 112, 'The linked account', 'The one account the tag is registered to\n(Scene 31). It decides who may ask.', 'blue', 2))
s.f(3)
s.raw(f'<circle cx="{Cc[0]}" cy="{Cc[1]}" r="{R}" fill="#f5f3ff" fill-opacity="0.75" stroke="#7c3aed" stroke-width="4"/>')
s.raw(key(312, 490, 0.9, '#7c3aed'))
s.raw(T(360, 552, 'KEYS', 20, 800, '#6b21a8', 'middle', mono=True))
s.raw(co(40, 872, 640, 139, 'The private keys', 'Whoever holds them can open the sealed location\nreports. They live only on trusted devices\n(Scene 43).', 'purple', 3))
s.f(4)
for i, w in enumerate(('rightful', 'owner,', 'trusted', 'device')):
    s.raw(T(360, 240 + 24 * i, w, 20, 800, '#14213d', 'middle'))
for i, (w, wt) in enumerate((('a finder', 600), ('or thief:', 600), ('holds it,', 400), ('reads nothing', 400))):
    s.raw(T(150, 180 + 24 * i + (6 if i > 1 else 0), w, 20, wt, '#334155', 'middle'))
for i, (w, wt) in enumerate((('new device', 600), ('signed in:', 600), ('keys only', 400), ('once trusted', 400))):
    s.raw(T(570, 180 + 24 * i + (6 if i > 1 else 0), w, 20, wt, '#334155', 'middle'))
for i, (w, wt) in enumerate((('owner far', 600), ('away:', 600), ('sees', 400), ('sightings', 400))):
    s.raw(T(468, 316 + 24 * i, w, 20, wt, '#334155', 'middle'))
s.raw(co(40, 1021, 640, 139, 'The overlaps matter', 'Possession without keys reads nothing. An account\nsign-in on a new device is not, by itself, access to\nend-to-end keys: the device must be trusted first.', 'slate', 4))
scenes[42] = s.render()

# ── 43 Secrets journey ───────────────────────────────────────────────
s = VScene(43, 'The journey of a secret: from birth to revocation',
           'Five frames in two groups. First, the owner-held keys that open location reports: 1, they are generated on '
           'the owner’s device, a key pair plus a secret seed; 2, at setup the tag receives only what it needs to derive '
           'rotating public keys, never the private key; 3, the private keys stay on the owner’s trusted devices and, Apple '
           'says, sync between them through end-to-end encrypted iCloud Keychain; 4, both sides derive a new key pair about '
           'every 15 minutes. 5, recovery and revocation, and the second group: manufacturer and service keys (TLS '
           'certificates, device attestation, firmware signing) do different jobs and cannot open the reports.',
           sub='Two families of keys. Only one of them can read where the tag has been.',
           note='Apple Platform Security guide (Find My). Schematic.', h=1696)
s.raw(T(40, 24, 'OWNER-HELD KEYS — they open location reports', 20, 800, '#6b21a8', mono=True))
steps = [('Generate', 'on the owner’s device: a key pair (d, P) and\na secret seed SK₀', 'purple', 'doc'),
         ('Provision', 'at setup the tag gets P and SK₀ — enough to\nderive public keys only', 'purple', 'doc'),
         ('Store and sync', 'd stays on trusted devices; synced via\nE2E iCloud Keychain', 'purple', 'ver'),
         ('Derive and rotate', 'new Pᵢ (tag) and dᵢ (owner) about every 15 minutes', 'purple', 'doc'),
         ('Recover or revoke', 'account recovery; Remove Item stops future use', 'slate', 'und')]
GAP = 26
y = 38
for i, (t_, b_, col, ev) in enumerate(steps):
    CH = 88 + 27 * b_.count('\n')
    s.f(i + 1)
    c, light, border = STEP[col]
    s.raw(f'<rect x="40" y="{y}" width="640" height="{CH}" rx="16" fill="{light}" stroke="{border}" stroke-width="2"/>')
    s.raw(badge(74, y + 32, i + 1, col, 20))
    s.raw(T(104, y + 40, t_, 24, 800, '#14213d'))
    lab = {'doc': 'DOCUMENTED', 'ver': 'VERIFY', 'und': 'PARTLY UNDISCLOSED'}[ev]
    s.raw(vchip(664 - (len(lab) * 12.2 + 24), y + 13, lab, ev))
    s.raw(T(58, y + 70, b_, 21, 400, '#334155'))
    if i < 4:
        s.arrow([(360, y + CH - 6), (360, y + CH + GAP + 10)], 'crypto')
    y += CH + GAP
s.f(5)
y += 30 - GAP
s.raw(T(40, y, 'MANUFACTURER AND SERVICE KEYS — a different job', 20, 800, '#334155', mono=True))
svc = [('TLS certificates', 'protect phone ↔ server\nconnections in transit'),
       ('Device attestation', 'lets a service check a\ngenuine device (detail\nnot public)'),
       ('Firmware signing', 'proves an update came\nfrom the maker'),
       ('Account\nauthentication', 'passwords, 2FA, passkeys:\ndecide who may ask')]
GH = 128
for i, (t_, b_) in enumerate(svc):
    x, yy = 40 + (i % 2) * 330, y + 16 + (i // 2) * (GH + 10)
    s.raw(f'<rect x="{x}" y="{yy}" width="310" height="{GH}" rx="14" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>')
    s.raw(T(x + 18, yy + 34, t_, 22, 800, '#14213d'))
    s.raw(T(x + 18, yy + 64 + 28 * t_.count('\n'), b_, 21, 400, '#475569'))
y += 16 + 2 * GH + 10 + 8
s.raw(callout(40, y, 640, 84, 'None of these', 'can open a sealed location report.', 'red', None, 26, 21))
y += 92
s.raw(panel(40, y, 640, 140, 'amber', None, 'Why the split matters', None, 24))
s.raw(T(64, y + 78, 'A service can run, check devices and route reports\nwithout ever holding the keys that read them. That is\nwhat “end-to-end” means here.', 21, 400, '#334155'))
scenes[43] = s.render()

# ── 44 Public and private keys ───────────────────────────────────────
s = VScene(44, 'Open padlocks and private keys — and why a signature is not a lock',
           'Five frames. 1, the analogy: the owner hands out open padlocks (public keys) that anyone can snap shut, and keeps '
           'the only key that opens them (the private key). 2, the precise version: a finder encrypts a location to the '
           'public key; only the owner’s private key decrypts it. 3, in practice a fresh one-time key and a symmetric cipher '
           'do the bulk work: ephemeral key agreement, a key-derivation function and authenticated encryption. 4, a '
           'different job: a maker signs a firmware update with its signing key and the device checks it with the matching '
           'public key; the update itself is not hidden. 5, a comparison: encryption decides who can read; a signature proves '
           'who wrote; different keys, different jobs.',
           sub='Encryption controls who can read. A signature proves who wrote. Different keys, different jobs.',
           note='Conceptual. Keys and algorithms simplified; Apple documents ECDH, a KDF and AES-GCM for Find My.', h=1664)
s.f(1)
y0 = 0
s.raw(f'<rect x="40" y="{y0}" width="640" height="306" rx="18" fill="#faf5ff" stroke="#d8b4fe" stroke-width="2"/>')
s.raw(badge(74, y0 + 34, 1, 'purple', 20) + T(104, y0 + 42, 'The analogy', 24, 800, '#14213d'))
for i in range(3):
    s.raw(padlock(78 + i * 76, y0 + 112, 0.8, '#a78bfa', open_=True))
s.raw(T(180, y0 + 176, 'open padlocks: hand out', 21, 700, '#6b21a8', 'middle'))
s.raw(T(180, y0 + 201, 'copies to anyone', 21, 400, '#334155', 'middle'))
s.raw(key(452, y0 + 124, 1.0, '#7c3aed'))
s.raw(T(500, y0 + 176, 'one key: keep it', 21, 700, '#6b21a8', 'middle'))
s.raw(T(60, y0 + 238, 'Anyone can snap a padlock shut. Only the keyholder\nopens it.', 21, 400, '#334155'))
s.raw(T(60, y0 + 292, 'Public key = open padlock. Private key = the only key.', 21, 600, '#14213d'))
s.f(2)
y0 = 316
s.raw(f'<rect x="40" y="{y0}" width="640" height="340" rx="18" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(badge(74, y0 + 34, 2, 'purple', 20) + T(104, y0 + 42, 'The precise version: encrypt to a public key', 22, 800, '#14213d'))
s.raw(phone(58, y0 + 64, 84, 144, '#f0fdf4'))
s.raw(T(100, y0 + 124, 'place', 20, 700, '#166534', 'middle') + T(100, y0 + 148, '+ time', 20, 700, '#166534', 'middle'))
s.raw(T(100, y0 + 234, 'finder', 21, 600, '#475569', 'middle'))
s.raw(envelope(246, y0 + 104, 100))
s.raw(padlock(273, y0 + 130, 0.55, '#7c3aed'))
s.arrow([(150, y0 + 136), (236, y0 + 136)], 'crypto', 'with P', at=(193, y0 + 110))
s.arrow([(356, y0 + 136), (530, y0 + 136)], 'crypto', 'sealed report', at=(443, y0 + 110))
s.raw(phone(540, y0 + 64, 84, 144, '#f5f3ff'))
s.raw(key(554, y0 + 136, 0.5, '#7c3aed'))
s.raw(T(582, y0 + 234, 'owner', 21, 600, '#475569', 'middle'))
s.raw(T(443, y0 + 176, 'only d', 21, 800, '#6b21a8', 'middle'))
s.raw(T(443, y0 + 202, 'opens it', 21, 400, '#334155', 'middle'))
s.f(3)
s.raw(T(60, y0 + 270, 'In practice: one-time key agreement (ECDH) →\nkey derivation → AES-GCM. The public key never\ndecrypts anything.', 21, 400, '#475569'))
s.f(4)
y0 = 666
s.raw(f'<rect x="40" y="{y0}" width="640" height="220" rx="18" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(badge(74, y0 + 34, 4, 'blue', 20) + T(104, y0 + 42, 'A different job: a signed firmware update', 22, 800, '#14213d'))
s.raw(server(56, y0 + 66, 0.6, None))
s.raw(T(92, y0 + 182, 'maker', 21, 600, '#475569', 'middle'))
s.raw(f'<rect x="206" y="{y0 + 62}" width="170" height="104" rx="10" fill="#f0fdf4" stroke="#16a34a" stroke-width="2"/>')
s.raw(T(291, y0 + 94, 'update v2.1', 21, 800, '#166534', 'middle'))
s.raw(T(291, y0 + 120, '(readable)', 20, 400, '#334155', 'middle'))
s.raw(f'<rect x="226" y="{y0 + 130}" width="130" height="28" rx="5" fill="#7c3aed"/>' + T(291, y0 + 151, 'signature', 20, 700, '#ffffff', 'middle'))
s.arrow([(134, y0 + 112), (196, y0 + 112)], 'crypto', 'sign', at=(165, y0 + 86))
s.arrow([(386, y0 + 112), (524, y0 + 112)], 'plain', 'update +\nsignature', at=(455, y0 + 72))
s.raw(tag(574, y0 + 112, 34))
s.raw(tick(616, y0 + 86, 16))
s.raw(T(574, y0 + 176, 'checks with the', 21, 400, '#334155', 'middle'))
s.raw(T(574, y0 + 202, 'maker’s public key', 21, 400, '#334155', 'middle'))
s.f(5)
y0 = 896
s.raw(f'<rect x="40" y="{y0}" width="640" height="208" rx="18" fill="#fffbeb" stroke="#fcd34d" stroke-width="2"/>')
s.raw(badge(74, y0 + 34, 5, 'amber', 20) + T(104, y0 + 42, 'Not the same thing', 24, 800, '#14213d'))
s.raw(T(64, y0 + 84, 'Encryption', 21, 800, '#6b21a8') + T(370, y0 + 84, 'Signature', 21, 800, '#1e40af'))
rows = [('who can read it', 'who wrote it'), ('lock with public,', 'sign with private,'), ('open with private', 'check with public'),
        ('hides the content', 'hides nothing')]
for i, (a_, b_) in enumerate(rows):
    s.raw(T(64, y0 + 112 + i * 26, a_, 21, 400, '#334155') + T(370, y0 + 112 + i * 26, b_, 21, 400, '#334155'))
scenes[44] = s.render()


def vlabel(x, y, text, color, size=21, weight=800):
    """Text set along a vertical column, reading bottom to top."""
    return (f'<text x="{x}" y="{y}" transform="rotate(-90 {x} {y})" text-anchor="middle" '
            f'style="font-size:{size}px;font-weight:{weight};fill:{color}">{text}</text>')


# ── 45 Encryption layers ─────────────────────────────────────────────
# The path runs down the left (tag, passer-by's phone, relay, owner's phone); each layer is a
# column on the right spanning the hops it protects.
s = VScene(45, 'Three layers of protection, three different jobs',
           'Five frames along the path from tag to owner. 1, the path: tag, passer-by’s phone, Apple’s relay, owner’s phone. '
           '2, the radio link: the broadcast is not encrypted, because the identifier is public by design; Bluetooth link '
           'encryption applies only to connections. 3, TLS protects each internet hop in transit and ends at Apple’s servers. '
           '4, end-to-end encryption wraps the location from the finder’s phone to the owner’s phone, through the relay and '
           'while stored there. 5, where data is readable: on the finder’s phone (its own location), as ciphertext with '
           'metadata at rest on the relay, and on the owner’s phone after decryption.',
           sub='The radio, the internet hop and the report itself are protected differently.',
           note='Apple’s documented Find My design. Schematic.', h=1675)
Y = {'tag': 54, 'fin': 240, 'rel': 462, 'own': 692}
s.f(1)
s.raw(tag(110, Y['tag'], 36) + T(164, Y['tag'] + 8, 'item tracker', 21, 600, '#475569'))
s.raw(phone(68, Y['fin'] - 65, 84, 130, '#f8fafc') + T(168, Y['fin'] - 6, 'passer-by’s\nphone', 21, 600, '#475569'))
s.raw(server(68, Y['rel'] - 55, 0.7, None))
s.raw(vbound(40, Y['rel'] - 75, 160, 150, 'Apple relay'))
s.raw(phone(68, Y['own'] - 65, 84, 130, '#f8fafc') + T(168, Y['own'] - 6, 'owner’s\nphone', 21, 600, '#475569'))
s.raw(T(306, 24, 'LAYER', 20, 800, '#64748b', mono=True))
s.f(2)
s.raw(f'<rect x="306" y="40" width="54" height="{Y["fin"] - 40 + 12}" rx="10" fill="#eff6ff"/>')
s.raw(vlabel(322, (Y['tag'] + Y['fin']) / 2, 'Radio broadcast', '#1e40af'))
s.arrow([(110, Y['tag'] + 42), (110, Y['fin'] - 73)], 'signal', 'Bluetooth:\nin the clear', at=(204, 122))
s.raw(f'<path d="M340,{Y["tag"]} L340,{Y["fin"]}" stroke="#1d4ed8" stroke-width="8" stroke-linecap="round"/>')
s.raw(T(380, 112, 'not encrypted: the\nrotating key is public\nby design', 21, 400, '#334155'))
s.f(3)
s.raw(f'<rect x="476" y="{Y["fin"] - 14}" width="54" height="{Y["own"] - Y["fin"] + 28}" rx="10" fill="#f8fafc"/>')
s.raw(vlabel(492, (Y['fin'] + Y['rel'] - 20) / 2, 'TLS (in transit)', '#334155'))
s.raw(f'<path d="M510,{Y["fin"]} L510,{Y["rel"] - 20} M510,{Y["rel"] + 20} L510,{Y["own"]}" stroke="#475569" stroke-width="8" stroke-linecap="round"/>')
s.raw(T(546, Y['rel'] - 4, 'ends at the\nserver', 20, 600, '#475569'))
s.f(4)
s.raw(f'<rect x="386" y="{Y["fin"] - 14}" width="54" height="{Y["own"] - Y["fin"] + 28}" rx="10" fill="#f5f3ff"/>')
s.raw(vlabel(402, (Y['rel'] + Y['own']) / 2, 'End to end', '#6b21a8'))
s.raw(f'<path d="M420,{Y["fin"]} L420,{Y["own"]}" stroke="#7c3aed" stroke-width="8" stroke-linecap="round"/>')
s.arrow([(110, Y['fin'] + 71), (110, Y['rel'] - 81)], 'crypto', 'sealed\nreport', at=(178, Y['fin'] + 104))
s.arrow([(110, Y['rel'] + 81), (110, Y['own'] - 71)], 'crypto', 'sealed\nreport', at=(178, Y['rel'] + 112))
s.raw(padlock(216, Y['rel'] - 20, 0.55, '#7c3aed'))
s.f(5)
s.raw(vcard(40, 780, 640, 114, 'On a device', 'Plaintext only on the finder’s phone (its own location)\nand on the owner’s phone after decrypting.', 'green'))
s.raw(vcard(40, 904, 640, 114, 'In transit', 'TLS around the internet hops; the report inside stays\nend-to-end encrypted.', 'slate'))
s.raw(vcard(40, 1028, 640, 114, 'At rest on the relay', 'Ciphertext, a lookup hash, upload time and connection\nmetadata. Not the location.', 'purple'))
scenes[45] = s.render()

# ── 46 Who can see what ──────────────────────────────────────────────
# Six columns do not fit a phone: the table is split into two stacked halves of three
# columns; the second half identifies each observer by its numbered badge.
s = VScene(46, 'Who can see what: one table, eight observers',
           'Four frames revealing a table for Apple’s documented Find My design. Columns: the radio identifier, the approximate '
           'location, the owner’s identity, the finder’s identity, the sealed report and service metadata. 1, the tag sees only '
           'its own identifier; the passer-by’s phone sees the identifier, its own location, itself, and the report it made; '
           'a nearby radio listener sees only the identifier. 2, the relay operator sees a lookup hash, the sealed report and '
           'metadata, never the location; an internet provider sees only that connections happened. 3, the owner sees the '
           'location after decrypting and knows their own account; a person the owner shares with can see the location. '
           '4, an outside attacker without the account or keys sees only what any radio listener sees, unless they take over '
           'the account (Scene 48).',
           sub='Apple Find My, as documented. Other ecosystems are compared in Scene 47.',
           note='Apple Find My, documented design. Simplified.', h=1672)
COLS = ['Radio\nidentifier', 'Approx.\nlocation', 'Owner\nidentity', 'Finder\nidentity', 'Sealed\nreport', 'Service\nmetadata']
VSTY = {'yes': ('#166534', '● '), 'no': ('#4b5563', '○ '), 'meta': ('#92400e', '≈ '), 'own': ('#166534', '● '), 'und': ('#374151', '? ')}
ROWS = [
    (1, 'The tag', [('yes', 'its own'), ('no', 'no'), ('no', 'no'), ('no', 'no'), ('no', 'no'), ('no', 'no')]),
    (1, 'Passer-by’s\nphone', [('yes', 'hears it'), ('own', 'its own'), ('no', 'no'), ('own', 'itself'), ('own', 'makes it'), ('own', 'its uploads')]),
    (1, 'Nearby radio\nlistener', [('yes', 'hears it'), ('no', 'no'), ('no', 'no'), ('no', 'no'), ('no', 'no'), ('no', 'no')]),
    (2, 'Relay operator\n(Apple)', [('meta', 'hash only'), ('no', 'no'), ('meta', 'who asks'), ('meta', 'connection'), ('yes', 'stores it'), ('yes', 'yes')]),
    (2, 'Internet\nprovider', [('no', 'no'), ('no', 'no'), ('meta', 'connection'), ('meta', 'connection'), ('no', 'TLS'), ('meta', 'traffic')]),
    (3, 'The owner', [('yes', 'derives it'), ('yes', 'decrypts'), ('yes', 'themself'), ('no', 'no'), ('yes', 'fetches'), ('own', 'own account')]),
    (3, 'Person it is\nshared with', [('und', 'undisclosed'), ('yes', 'can view'), ('yes', 'knows owner'), ('no', 'no'), ('und', 'undisclosed'), ('no', 'no')]),
    (4, 'Outside\nattacker', [('yes', 'if nearby'), ('no', 'no*'), ('no', 'no*'), ('no', 'no'), ('no', 'no*'), ('no', 'no')]),
]


def half(y0, cols, xs, rh, names):
    """One half of the table: header row (frame 0) then one row per observer in its frame."""
    s.f(0)
    s.raw(f'<rect x="40" y="{y0}" width="640" height="58" rx="10" fill="#f1f5f9"/>')
    if names:
        s.raw(T(56, y0 + 36, 'Observer', 20, 800, '#14213d'))
    for x, c in zip(xs, cols):
        s.raw(T(x + 6, y0 + 25, COLS[c], 20, 800, '#14213d'))
    for r, (fr, who, cells) in enumerate(ROWS):
        s.f(fr)
        y = y0 + 64 + r * (rh + 4)
        if who.startswith('Outside'):
            s.rect(40, y, 640, rh, 'hz', rx=8)
        else:
            s.raw(f'<rect x="40" y="{y}" width="640" height="{rh}" rx="8" fill="{"#ffffff" if r % 2 else "#fbfaf7"}" stroke="#e5e7eb" stroke-width="1"/>')
        s.raw(badge(58, y + rh / 2, r + 1, 'slate', 13))
        if names:
            s.raw(T(80, y + (rh / 2 + 7 if '\n' not in who else rh / 2 - 5), who, 20, 700, '#14213d'))
        for x, c in zip(xs, cols):
            k, txt = cells[c]
            col, mark = VSTY[k]
            s.raw(T(x + 6, y + rh / 2 + 7, mark + txt, 20, 700 if k in ('yes', 'own') else 400, col))
    return y0 + 64 + 8 * (rh + 4)


y = half(0, [0, 1, 2], [226, 376, 500], 54, True)
y = half(y + 20, [3, 4, 5], [100, 300, 490], 42, False)
s.f(4)
s.raw(T(40, y + 30, '* unless the attacker takes over the owner’s account\n(Scene 48) — then they see what the owner sees.', 21, 600, '#991b1b'))
s.raw(T(40, y + 100, '● yes   ○ no   ≈ metadata only   ? not publicly documented.\nAgrees with Module 5, demo D.', 21, 400, '#475569'))
s.raw(T(40, y + 170, 'Apple says it cannot read locations and reports do not\nidentify the finder; connection metadata still exists.', 21, 400, '#475569'))
scenes[46] = s.render()

# ── 47 Competing ecosystems ──────────────────────────────────────────
# The 4 x 6 grid becomes a key of four numbered networks, then one section per row of the
# grid, each cell on its own line after its network's numbered badge.
s = VScene(47, 'Four networks, similar goals, different designs',
           'Four frames building a comparison of Apple Find My, Google Find Hub, Samsung SmartThings Find and Tile, with no '
           'ranking. 1, the four networks and who relays sightings. 2, encryption and account linking as each company '
           'documents them. 3, precise finding, sharing and alerts for the person a tag travels with. 4, how much each '
           'publishes about its protocol, and a note that cells marked verify could not be confirmed from the company’s own '
           'pages for this lesson.',
           sub='As each company documents it. No scores, no winners. “Verify” = not confirmed from the company’s own page.',
           note='Company documentation as cited on the page. No ranking.', h=1728)
NETS = ['Apple Find My', 'Google Find Hub', 'Samsung SmartThings Find', 'Tile (Life360)']
NCOL = ['blue', 'green', 'purple', 'teal']
VGRID = [
    (1, 'Who relays', ['Nearby Apple devices, in the background', 'Android devices; by default only in busy areas,\naggregated', 'Galaxy devices (“nodes”)', 'Phones running the Tile or Life360 app (verify)']),
    (2, 'Encryption', ['End to end; Apple says it cannot read locations', 'End to end; key unlocked by the phone’s screen lock', 'Encrypted, Knox-protected; private ID changes / 15 min', 'Not compared here: check Tile’s own pages']),
    (2, 'Account link', ['One Apple Account per AirTag', 'Google Account; trackers from partner makers (verify)', 'One account or device at a time', 'Tile account (verify)']),
    (3, 'Precise finding', ['UWB on supported iPhones', 'Depends on the tracker model (verify)', 'UWB on supported Galaxy phones (verify)', 'Depends on the model (verify)']),
    (3, 'Alerts for the carrier', ['iPhone alert; tag sounds; Android via shared spec', 'Android 6.0+ alerts and a manual Scan now', 'Unknown-tag alert is a setting; manual search', 'Scan and Secure: a manual scan (verify)']),
    (4, 'What is published', ['Design in Apple Platform Security; studied by research', 'Design on Google’s security blog', 'Newsroom-level descriptions', 'Less public technical detail (verify)']),
]
s.f(1)
s.raw('<rect x="40" y="0" width="640" height="92" rx="10" fill="#f1f5f9"/>')
for i, n in enumerate(NETS):
    x, yy = (58, 432)[i % 2], 36 + 40 * (i // 2)
    s.raw(badge(x, yy - 7, i + 1, NCOL[i], 14) + T(x + 24, yy, n, 21, 800, '#14213d'))
y = 102
for r, (fr, lab, cells) in enumerate(VGRID):
    s.f(fr)
    n = sum(1 + c.count('\n') for c in cells)
    hh = 40 + 26 * n
    s.raw(f'<rect x="40" y="{y}" width="640" height="{hh}" rx="8" fill="{"#ffffff" if r % 2 else "#fbfaf7"}" stroke="#e5e7eb" stroke-width="1"/>')
    s.raw(T(56, y + 28, lab, 22, 800, '#14213d'))
    yy = y + 56
    for i, c in enumerate(cells):
        ver = 'verify' in c or 'Not compared' in c
        s.raw(badge(66, yy - 7, i + 1, NCOL[i], 12))
        s.raw(T(88, yy, c.replace('\n', ' '), 20, 400, '#9a3412' if ver else '#334155', italic=ver) if '\n' not in c else
              ''.join(T(88, yy + 26 * k, ln, 20, 400, '#9a3412' if ver else '#334155', italic=ver) for k, ln in enumerate(c.split('\n'))))
        yy += 26 * (1 + c.count('\n'))
    y += hh + 4
s.f(4)
s.raw(T(40, y + 26, 'All four aim to find lost things without revealing\nthe finder; the published detail differs a great deal.', 21, 600, '#14213d'))
s.raw(T(40, y + 92, 'Apple and Google share one specification for\nunwanted-tracking alerts (Scene 52). Nothing here\nimplies the networks share data or use the same\nalgorithms.', 21, 400, '#475569'))
scenes[47] = s.render()

# ── 48 Identity lifecycle risks ──────────────────────────────────────
s = VScene(48, 'Where the account is the weak point',
           'Five frames around one account with its trusted devices. Seven risks appear as red dashed cards, each with what it '
           'needs and what it exposes: 1, the account, its trusted devices and shares. 2, a shared or reused password, and an '
           'old trusted device nobody manages. 3, coercive access by someone close, and a share nobody remembers. 4, account '
           'takeover, and abuse of account recovery. 5, shared household permissions, and the defences: review devices and '
           'sharing (for example Apple’s Safety Check), a unique password with two-factor authentication, and a recovery '
           'method you control.',
           sub='Strong encryption protects the reports. It cannot tell who is holding the account.',
           note='Defensive summary; no attack steps.', h=1666)
s.f(1)
s.raw(cloud(225, 0, 270, 'one account'))
for xx in (248, 328, 408):
    s.raw(phone(xx, 168, 64, 116, '#f8fafc'))
s.raw(T(360, 318, 'trusted devices and shares', 21, 600, '#475569', 'middle'))
VRISKS = [
    (2, 'Shared or reused\npassword', 'Needs: the password, and\na way past 2FA. Exposes:\nwhat the owner sees.'),
    (2, 'Forgotten trusted\ndevice', 'Needs: an old phone still\nsigned in. Exposes: the\nowner’s view, for whoever\nholds it.'),
    (3, 'Coercive access', 'Needs: someone with power\nover the owner. Exposes:\nwhatever they are made to\nshow.'),
    (3, 'A share nobody\nremembers', 'Needs: an old share not\nreviewed. Exposes: the\nitem’s location, to that\nperson.'),
    (4, 'Account takeover', 'Needs: credentials plus\na 2FA bypass. Exposes:\nall items, as the owner.'),
    (4, 'Recovery abuse', 'Needs: control of a\nrecovery path. Exposes:\nthe account after reset.'),
]
y = 344
for row in range(3):
    pair = VRISKS[2 * row: 2 * row + 2]
    hs = [34 + 26 * t_.count('\n') + 34 + 27 * b_.count('\n') + 18 for _, t_, b_ in pair]
    for k, (fr, t_, b_) in enumerate(pair):
        s.f(fr)
        x = 40 + 330 * k
        s.rect(x, y, 310, max(hs), 'hz', rx=12)
        s.raw(T(x + 18, y + 34, t_, 22, 800, '#991b1b'))
        s.raw(T(x + 18, y + 68 + 26 * t_.count('\n'), b_, 21, 400, '#334155'))
    y += max(hs) + 12
s.f(5)
s.raw(vcard(40, y + 2, 640, 114, 'Shared household permissions', 'Family or shared accounts can mean several people\nsee one item — by design, until reviewed.', 'amber'))
y += 128
s.raw(panel(40, y, 640, 150, 'green', None, 'Defences', None, 24))
s.raw(T(64, y + 80, 'Review devices and sharing (e.g. Apple Safety\nCheck) · unique password + 2FA · a recovery\nmethod you control', 21, 400, '#14532d'))
scenes[48] = s.render()

# ── 49 Unwanted tracking ─────────────────────────────────────────────
s = VScene(49, 'Same tag, two stories: a lost bag, or a person being followed',
           'Five frames. 1, a lost bag: the owner sees their own bag on a map; this is the purpose of the network. 2, the same '
           'tag hidden in another person’s bag: the person carrying it is located and told nothing; the owner’s map now '
           'shows a person. 3, encryption cannot tell the stories apart: it protects the owner’s view in both. 4, protective '
           'alerts: a phone can warn the person a separated tag travels with, iPhone and Android alike through a shared '
           'specification, and a separated tag plays a sound when moved; alerts take time and need a compatible phone. 5, a '
           'safety note: disabling a tracker can alert the person who placed it; think about safety first and get support.',
           sub='The mechanism that finds keys can also locate a person. Encryption cannot tell which.',
           note='Defensive framing only. No placement or evasion detail.', h=1690)
s.f(1)
y0 = 0
s.raw(f'<rect x="40" y="{y0}" width="640" height="310" rx="18" fill="#f0fdf4" stroke="#86efac" stroke-width="2"/>')
s.raw(badge(74, y0 + 34, 1, 'green', 20) + T(104, y0 + 42, 'A lost bag', 24, 800, '#14213d'))
s.raw(suitcase(84, y0 + 92, 0.6))
s.raw(tag(178, y0 + 150, 20))
s.raw(phone(480, y0 + 60, 110, 180, '#ecfdf5'))
s.raw(pin(535, y0 + 168, 0.6, '#16a34a'))
s.raw(T(535, y0 + 202, 'my bag', 20, 700, '#166534', 'middle'))
s.raw(T(60, y0 + 270, 'The owner finds their own bag. This is the network’s\npurpose.', 21, 400, '#334155'))
s.f(2)
y1 = 320
s.raw(f'<rect x="40" y="{y1}" width="640" height="310" rx="18" fill="#fef2f2" stroke="#fca5a5" stroke-width="2"/>')
s.raw(badge(74, y1 + 34, 2, 'red', 20) + T(104, y1 + 42, 'A tag hidden in someone’s bag', 24, 800, '#14213d'))
s.raw(person(130, y1 + 64, 0.78, '#64748b'))
s.raw(suitcase(172, y1 + 132, 0.42, '#475569'))
s.rect(182, y1 + 150, 44, 42, 'hz', rx=8)
s.raw(tag(204, y1 + 171, 13))
s.raw(phone(474, y1 + 60, 122, 180, '#fef2f2'))
s.raw(pin(535, y1 + 168, 0.6, '#dc2626'))
s.raw(T(535, y1 + 202, 'a person', 20, 700, '#991b1b', 'middle'))
s.raw(T(60, y1 + 280, 'The person carrying it is located and was never asked.', 21, 400, '#334155'))
s.f(3)
s.raw(padlock(614, y0 + 26, 0.6, '#7c3aed') + padlock(614, y1 + 26, 0.6, '#7c3aed'))
y = 640
s.raw(callout(40, y, 640, 138, 'Encryption cannot tell the stories apart', 'It keeps the relay and strangers out — and protects\nan abusive owner’s view exactly as well as a\nrightful owner’s.', 'purple', 3, 24, 21))
s.f(4)
y += 148
s.raw(callout(40, y, 640, 192, 'Protective alerts — and their limits', 'A phone can warn the person a separated tag travels with\n(iPhone and Android, via one shared specification); a\nseparated tag sounds when moved. Alerts take time, need\nseparation from the owner and a compatible phone\n(Scene 52).', 'blue', 4, 24, 21))
s.f(5)
y += 202
s.raw(callout(40, y, 640, 165, 'If you find a tracker: safety first', 'Disabling it can alert the person who placed it, and\nstops their location updates. Think about your safety\nfirst, and consider contacting police or a support\nservice before acting (Module 7).', 'amber', 5, 24, 21))
scenes[49] = s.render()
