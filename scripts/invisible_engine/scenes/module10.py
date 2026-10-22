"""Module 10 scenes (73–78): future cryptography of cards, trackers and accounts.
Run scripts/invisible_engine/build.py to write the SVGs.

Accuracy rules for this module (docs/INVISIBLE-ENGINE.md): sizes come from the standards and
are drawn from the table below, never typed into a picture; every inventory row carries its
evidence status; nothing is described as already broken; post-quantum algorithms are
"designed to resist known quantum attacks", never "quantum-proof"; no Q-day dates.
"""
import math

from .svgkit import Scene
from .art import *

scenes = {}

# Object sizes in bytes, from the standards (FIPS 203/204/205; RFC 7748; SEC 1).
SIZES = [
    ('X25519 public key', 32, 'classical', 'RFC 7748'),
    ('P-256 public key (compressed)', 33, 'classical', 'SEC 1'),
    ('ECDSA P-256 signature (r‖s)', 64, 'classical', 'FIPS 186-5'),
    ('ML-KEM-768 ciphertext', 1088, 'pq', 'FIPS 203'),
    ('ML-KEM-768 encapsulation key', 1184, 'pq', 'FIPS 203'),
    ('ML-DSA-65 public key', 1952, 'pq', 'FIPS 204'),
    ('ML-DSA-65 signature', 3309, 'pq', 'FIPS 204'),
    ('SLH-DSA-SHA2-128s signature', 7856, 'pq', 'FIPS 205'),
]
ADV_DATA = 31          # legacy BLE advertising data, bytes (Core Spec)
ATT_MTU_MAX = 517      # largest ATT MTU, bytes (Core Spec); default 23


# ── local drawing helpers (Module 10 only) ─────────────────────────
def lines(x, y, rows, size=15.5, color='#334155', weight=400, lh=None, anchor='start'):
    lh = lh or round(size * 1.6)
    return ''.join(T(x, y + i * lh, r, size, weight, color, anchor) for i, r in enumerate(rows))


STATUS = {  # evidence chip: fill, stroke, text colour, dashed?
    'VERIFIED': ('#dcfce7', '#16a34a', '#166534', False),
    'UNVERIFIED': ('#fef3c7', '#d97706', '#92400e', False),
    'UNKNOWN': ('#ffffff', '#6b7280', '#374151', True),
}


def chip(x, y, status, w=128):
    fill, stroke, ink, dashed = STATUS[status]
    dash = ' stroke-dasharray="6 4"' if dashed else ''
    return (f'<rect x="{x}" y="{y}" width="{w}" height="26" rx="13" fill="{fill}" stroke="{stroke}" stroke-width="2"{dash}/>'
            + T(x + w / 2, y + 18, status, 13, 800, ink, 'middle', mono=True))


def mcu(x, y, s=1.0, label='tracker chip'):
    """A microcontroller with fixed ROM, flash and RAM blocks, about 260 x 170 at s=1."""
    out = f'<rect x="{x}" y="{y}" width="{260 * s:.0f}" height="{170 * s:.0f}" rx="10" fill="#1f2937"/>'
    for i in range(7):  # pins
        px = x + 22 * s + i * 34 * s
        out += (f'<rect x="{px:.0f}" y="{y - 12 * s:.0f}" width="{12 * s:.0f}" height="{12 * s:.0f}" fill="#9ca3af"/>'
                f'<rect x="{px:.0f}" y="{y + 170 * s:.0f}" width="{12 * s:.0f}" height="{12 * s:.0f}" fill="#9ca3af"/>')
    blocks = [('boot ROM', 'fixed at the factory', '#fca5a5'), ('flash', 'firmware + keys', '#fcd34d'), ('RAM', 'tens of KB', '#93c5fd')]
    for i, (t, sub, col) in enumerate(blocks):
        bx = x + 14 * s + i * 82 * s
        out += f'<rect x="{bx:.0f}" y="{y + 40 * s:.0f}" width="{72 * s:.0f}" height="{80 * s:.0f}" rx="6" fill="{col}"/>'
        out += T(bx + 36 * s, y + 74 * s, t, 13 * s, 800, '#111827', 'middle')
        out += T(bx + 36 * s, y + 96 * s, sub.split(' ')[0], 11 * s, 500, '#111827', 'middle')
    out += T(x + 130 * s, y + 154 * s, label, 14 * s, 700, '#e5e7eb', 'middle')
    return out


def step_box(x, y, w, h, n, title, body, color='slate'):
    c, light, border = STEP[color]
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{light}" stroke="{border}" stroke-width="2"/>'
    out += badge(x + 24, y + 26, n, color, 16)
    out += T(x + 48, y + 32, title, 16.5, 800, '#14213d')
    out += lines(x + 14, y + 60, body.split('\n'), 14, '#334155', lh=20)
    return out


def clock(cx, cy, r, color, label, hand_deg=60, uncertain=False):
    out = f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#ffffff" stroke="{color}" stroke-width="5"' + (' stroke-dasharray="10 7"' if uncertain else '') + '/>'
    for k in range(12):
        a = math.radians(k * 30)
        out += f'<path d="M{cx + (r - 10) * math.sin(a):.1f},{cy - (r - 10) * math.cos(a):.1f} L{cx + (r - 3) * math.sin(a):.1f},{cy - (r - 3) * math.cos(a):.1f}" stroke="{color}" stroke-width="2"/>'
    if uncertain:
        out += T(cx, cy + 10, '?', r * 0.75, 800, color, 'middle')
    else:
        a = math.radians(hand_deg)
        out += f'<path d="M{cx},{cy} L{cx + r * 0.62 * math.sin(a):.1f},{cy - r * 0.62 * math.cos(a):.1f}" stroke="#14213d" stroke-width="5" stroke-linecap="round"/>'
        out += f'<path d="M{cx},{cy} L{cx},{cy - r * 0.78:.1f}" stroke="#14213d" stroke-width="3" stroke-linecap="round"/>'
        out += f'<circle cx="{cx}" cy="{cy}" r="6" fill="#14213d"/>'
    out += T(cx, cy + r + 30, label, 18, 800, color, 'middle')
    return out


def key(x, y, s=1.0, color='#7c3aed'):
    return (f'<circle cx="{x}" cy="{y}" r="{14 * s:.0f}" fill="none" stroke="{color}" stroke-width="{5 * s:.1f}"/>'
            f'<path d="M{x + 14 * s:.0f},{y} L{x + 48 * s:.0f},{y} M{x + 38 * s:.0f},{y} L{x + 38 * s:.0f},{y + 10 * s:.0f} M{x + 46 * s:.0f},{y} L{x + 46 * s:.0f},{y + 8 * s:.0f}" stroke="{color}" stroke-width="{5 * s:.1f}"/>')


# ── 73 Cryptographic inventory ─────────────────────────────────────
INV = [  # (thing, job, algorithm as documented, status, public-key?)
    ('Payment card chip', 'transaction cryptogram', 'symmetric keys (TDES or AES, issuer’s choice)', 'VERIFIED', False),
    ('Payment card chip', 'offline card authentication', 'RSA certificates; EMV also specifies ECC', 'UNVERIFIED', True),
    ('Access badge', 'mutual authentication', 'AES-128 on current secure credentials', 'UNVERIFIED', False),
    ('Bluetooth pairing', 'key agreement (LE Secure Conn.)', 'ECDH on P-256', 'VERIFIED', True),
    ('Tracker firmware', 'signed updates', 'not published', 'UNKNOWN', None),
    ('Find My location report', 'key exchange + encryption', 'ECDH on P-224, then AES-GCM', 'VERIFIED', True),
    ('Cloud connection', 'TLS 1.3 key exchange', 'ECDHE; hybrid with ML-KEM rolling out', 'UNVERIFIED', True),
    ('Sharing and backups', 'account keys, keychain sync', 'design documented; algorithms in part', 'UNVERIFIED', True),
]
s = Scene(73, 'Inventory first: which cryptography does each part use?',
          'Four frames. A table of eight places cryptography works across cards, trackers and accounts, each with its job, the '
          'algorithm as publicly documented, and an evidence status. 1, the payment card chip: transaction cryptograms use '
          'symmetric keys (TDES or AES, chosen by the issuer), verified from the EMV specifications; offline card authentication uses '
          'RSA certificates and EMV also specifies elliptic curves, unverified for any given card. 2, an access badge (AES-128 on '
          'current secure credentials, unverified for a particular fleet), Bluetooth LE Secure Connections pairing (ECDH on P-256, '
          'verified from the Core Specification) and tracker firmware signing (not published: unknown). 3, Find My location '
          'reports (ECDH on P-224 then AES-GCM, verified from Apple’s documentation), the cloud connection (TLS 1.3 with elliptic-curve '
          'key exchange, hybrid with ML-KEM rolling out, unverified per service) and sharing and backups (unverified). 4, the rows '
          'that rely on public-key cryptography are marked: those are the ones Shor’s algorithm would affect at scale.',
          sub='You cannot plan a migration for algorithms you have not listed — or cannot see.')
cols = [250, 280, 470, 170, 220]
X0, Y0, RH = 75, 175, 64
s.raw(f'<rect x="{X0}" y="{Y0}" width="{sum(cols)}" height="46" rx="8" fill="#eef2ff"/>')
hx = X0
for head, w in zip(['Where', 'Job', 'Algorithm, as documented', 'Evidence', 'Public-key?'], cols):
    s.raw(T(hx + 14, Y0 + 30, head, 16, 800, '#14213d'))
    hx += w
groups = [(1, (0, 1)), (2, (2, 3, 4)), (3, (5, 6, 7))]
for fr, rows in groups:
    s.f(fr)
    for r in rows:
        thing, job, alg, st, pk = INV[r]
        y = Y0 + 50 + r * RH
        s.raw(f'<rect x="{X0}" y="{y}" width="{sum(cols)}" height="{RH - 6}" rx="8" fill="{"#ffffff" if r % 2 else "#f8fafc"}" stroke="#e2e8f0" stroke-width="1.5"/>')
        s.raw(T(X0 + 14, y + 36, thing, 16, 800, '#14213d'))
        s.raw(T(X0 + cols[0] + 14, y + 36, job, 15, 400, '#334155'))
        s.raw(T(X0 + cols[0] + cols[1] + 14, y + 36, alg, 15, 500, '#14213d'))
        s.raw(chip(X0 + sum(cols[:3]) + 18, y + 16, st))
s.f(4)
for r, (_, _, _, _, pk) in enumerate(INV):
    y = Y0 + 50 + r * RH
    px = X0 + sum(cols[:4]) + 20
    if pk is None:  # algorithm not published: exposure cannot be stated
        s.raw(f'<rect x="{px}" y="{y + 14}" width="180" height="30" rx="8" fill="#ffffff" stroke="#9ca3af" stroke-width="2" stroke-dasharray="5 4"/>'
              + T(px + 90, y + 34, 'unknown: not published', 14, 700, '#374151', 'middle'))
    elif pk:
        s.raw(f'<rect x="{px}" y="{y + 14}" width="180" height="30" rx="8" fill="#f5f3ff" stroke="#a78bfa" stroke-width="2"/>'
              + T(px + 90, y + 34, 'yes: Shor-exposed', 14, 800, '#6d28d9', 'middle'))
    else:
        s.raw(T(px + 90, y + 34, 'no: symmetric', 14, 600, '#475569', 'middle'))
s.raw(T(75, 760, 'VERIFIED = in the vendor’s or standard’s own documentation.  UNVERIFIED = documented for some products or versions,', 15, 500, '#334155'))
s.raw(T(75, 784, 'not confirmed for yours.  UNKNOWN = not published.  “Shor-exposed” means: only on a large fault-tolerant quantum', 15, 500, '#334155'))
s.raw(T(75, 808, 'computer, which is not publicly known to exist.', 15, 500, '#334155'))
scenes[73] = s.render('Status reflects public documentation, not any one fleet. Check your own vendors.')

# ── 74 NIST algorithms ─────────────────────────────────────────────
s = Scene(74, 'The new standard locks: three NIST algorithms',
          'Five frames. 1, ML-KEM, FIPS 203: a key-encapsulation mechanism for agreeing a shared secret, built on module lattices. '
          '2, ML-DSA, FIPS 204: a digital signature scheme, also lattice-based. 3, SLH-DSA, FIPS 205: a stateless hash-based '
          'signature scheme whose security rests only on hash functions; larger and slower, a conservative alternative. All three were '
          'published by NIST on 13 August 2024. 4, in progress, to be checked against NIST’s current pages: FN-DSA (Falcon, draft FIPS '
          '206) and HQC, selected in March 2025 as a backup key-encapsulation mechanism. 5, all of these run on ordinary classical '
          'chips — phones, servers, smart cards — not on quantum computers; they are designed to resist known quantum attacks.',
          sub='Published August 2024. Classical algorithms, designed to resist known quantum attacks.')
algs = [(1, 'ML-KEM', 'FIPS 203', 'Key establishment', 'Two parties agree a shared secret.\nReplaces ECDH / RSA key transport.\nModule lattices.', 'purple'),
        (2, 'ML-DSA', 'FIPS 204', 'Signatures', 'Proves who signed and that nothing\nchanged. Replaces ECDSA / RSA\nsignatures. Module lattices.', 'blue'),
        (3, 'SLH-DSA', 'FIPS 205', 'Signatures, hash-based', 'Rests only on hash functions.\nLarger and slower: a conservative\nalternative to ML-DSA.', 'teal')]
for i, (n, name, fips, job, body, col) in enumerate(algs):
    s.f(n)
    x = 70 + i * 495
    c, light, border = STEP[col]
    s.raw(f'<rect x="{x}" y="165" width="470" height="330" rx="18" fill="{light}" stroke="{border}" stroke-width="2"/>')
    s.raw(badge(x + 42, 209, n, col, 26))
    s.raw(T(x + 82, 219, name, 34, 800, '#14213d'))
    s.raw(f'<rect x="{x + 300}" y="190" width="140" height="38" rx="19" fill="#ffffff" stroke="{c}" stroke-width="2"/>' + T(x + 370, 216, fips, 17, 800, c, 'middle', mono=True))
    s.raw(T(x + 28, 278, job, 21, 800, c))
    s.raw(lines(x + 28, 318, body.split('\n'), 17, '#334155', lh=28))
    s.raw(lock(x + 380, 400, 1.2, c) if n == 1 else key(x + 360, 430, 1.4, c))
    s.raw(T(x + 28, 470, 'Published 13 August 2024', 15, 600, '#475569'))
s.f(4)
s.raw(callout(70, 520, 700, 150, 'In progress — check NIST’s current pages', 'FN-DSA (Falcon): draft FIPS 206, a compact lattice signature.\nHQC: selected March 2025 as a backup key-encapsulation\nmechanism built on different mathematics (codes).', 'amber', 4, 19, 16))
s.f(5)
s.raw(callout(800, 520, 740, 150, 'They run on ordinary chips', 'Post-quantum cryptography is classical software and\nhardware: phones, servers, smart cards. It is designed to\nresist known quantum attacks — not run on quantum computers.', 'green', 5, 19, 16))
s.raw(phone(1180, 690, 60, 120, '#e0f2fe') + server(1270, 690, 0.8) + mcu(1390, 700, 0.5, 'card chip'))
s.raw(T(870, 760, 'the same everyday devices →', 16, 600, '#166534'))
scenes[74] = s.render('NIST FIPS 203, 204 and 205 (13 August 2024). Draft and candidate status: verify.')

# ── 75 Migration boundaries ────────────────────────────────────────
s = Scene(75, 'Why trackers cannot simply switch: bytes, chips and batteries',
          'Five frames. 1, object sizes from the standards on a logarithmic scale: an X25519 public key is 32 bytes, a compressed '
          'P-256 key 33, an ECDSA P-256 signature 64; an ML-KEM-768 ciphertext is 1,088 bytes and its encapsulation key 1,184, an '
          'ML-DSA-65 public key 1,952 and signature 3,309, and an SLH-DSA-SHA2-128s signature 7,856. 2, a legacy Bluetooth '
          'advertisement carries at most 31 bytes of data, so one ML-KEM-768 key would need 39 of them; even the largest ATT packet '
          'size of 517 bytes needs 3 packets. 3, inside a tracker: a boot ROM fixed at the factory, flash for firmware and keys, '
          'RAM of tens of kilobytes, and a coin cell — every extra byte sent costs energy. 4, beyond the device: new account '
          'devices, key synchronisation and the backend that looks reports up must all change together. 5, these are design '
          'constraints, not vulnerabilities: they decide how and when a migration can happen.',
          sub='Post-quantum keys and signatures are tens to hundreds of times larger.')
s.f(1)
s.raw(T(70, 180, 'Size in bytes (logarithmic scale)', 18, 800, '#14213d'))
LX, LW = 400, 560
lmax = math.log10(10000)
for i, (name, b, kind, std) in enumerate(SIZES):
    y = 196 + i * 35
    w = math.log10(b) / lmax * LW
    col = '#7c3aed' if kind == 'pq' else '#64748b'
    s.raw(T(LX - 12, y + 20, name, 14.5, 600, '#334155', 'end'))
    s.raw(f'<rect x="{LX}" y="{y + 4}" width="{w:.0f}" height="24" rx="5" fill="{col}"/>')
    s.raw(T(LX + w + 10, y + 21, f'{b:,} B · {std}', 13.5, 600, '#334155'))
for tick in (10, 100, 1000, 10000):
    tx = LX + math.log10(tick) / lmax * LW
    s.raw(f'<path d="M{tx:.0f},{196 + len(SIZES) * 35 + 4} L{tx:.0f},{196 + len(SIZES) * 35 + 12}" stroke="#64748b" stroke-width="2"/>'
          + T(tx, 196 + len(SIZES) * 35 + 28, f'{tick:,}', 13, 500, '#475569', 'middle'))
s.raw(T(LX - 330, 196 + len(SIZES) * 35 + 28, 'grey: classical · purple: post-quantum', 14, 500, '#475569'))
kem = dict((n, b) for n, b, _, _ in SIZES)['ML-KEM-768 encapsulation key']
n_adv = math.ceil(kem / ADV_DATA)
n_att = math.ceil(kem / ATT_MTU_MAX)
s.f(2)
s.raw(callout(1080, 165, 460, 250, 'Bytes on air', f'A legacy advertisement carries at\nmost {ADV_DATA} bytes of data. One ML-KEM-768\nkey ({kem:,} B) would need {n_adv} of them.\nEven the largest ATT packet\n({ATT_MTU_MAX} B) needs {n_att}.', 'blue', 2, 20, 16.5))
for k in range(n_adv):
    s.raw(f'<rect x="{1096 + (k % 13) * 33}" y="{350 + (k // 13) * 18}" width="28" height="12" rx="2" fill="#93c5fd"/>')
s.f(3)
s.raw(f'<rect x="70" y="560" width="700" height="250" rx="14" fill="#fff7ed" stroke="#fdba74" stroke-width="2"/>')
s.raw(badge(100, 592, 3, 'orange', 18) + T(130, 600, 'Inside the device', 20, 800, '#c2410c'))
s.raw(mcu(110, 640, 0.75))
s.raw(coin_cell(470, 700, 52))
s.raw(lines(560, 650, ['Boot ROM: fixed at the', 'factory; may not verify', 'new signature types.', 'Every byte sent costs', 'battery.'], 15, '#334155', lh=24))
s.f(4)
s.raw(callout(800, 560, 740, 145, 'Beyond the device', 'New account devices, key synchronisation and the backend\nthat files and finds reports must all accept the new\nformats — at the same time as old devices still in use.', 'purple', 4, 20, 16))
s.f(5)
s.raw(callout(800, 720, 740, 90, 'Constraints, not vulnerabilities', 'They decide how and when a migration can happen.', 'green', 5, 19, 16))
scenes[75] = s.render('Sizes from FIPS 203/204/205, RFC 7748 and SEC 1; Bluetooth limits from the Core Specification.')

# ── 76 Hybrid crypto ───────────────────────────────────────────────
s = Scene(76, 'Hybrid key exchange: two locks on one door',
          'Five frames. 1, today a client and a server agree a key with classical elliptic-curve Diffie–Hellman (X25519). 2, a '
          'hybrid adds a post-quantum key encapsulation (ML-KEM-768) alongside it in the same handshake. 3, a combiner feeds '
          'both shared secrets, with the handshake transcript, into one key-derivation function, so the session key stays secret '
          'if either part holds. 4, downgrade prevention: an attacker in the middle who strips the post-quantum part is caught, '
          'because both sides check a hash of everything that was offered. 5, rollout states: classical only, then hybrid, then '
          'post-quantum only once confidence allows. Reviewed designs such as TLS’s X25519MLKEM768, not an improvised protocol.',
          sub='The session stays secret if either lock holds. Use reviewed designs, never a home-made one.')
s.raw(phone(80, 200, 130, 260, '#e0f2fe') + T(145, 500, 'client', 17, 700, '#334155', 'middle'))
s.raw(server(1380, 230, 1.0, 'server'))
s.f(1)
s.biarrow([(230, 260), (1360, 260)], 'crypto', 'X25519 (classical)', at=(795, 248))
s.raw(T(795, 300, 'shared secret 1', 16, 700, '#6d28d9', 'middle'))
s.f(2)
s.biarrow([(230, 360), (1360, 360)], 'crypto', 'ML-KEM-768 (post-quantum)', at=(795, 348))
s.raw(T(795, 400, 'shared secret 2', 16, 700, '#6d28d9', 'middle'))
s.f(3)
s.raw(f'<rect x="545" y="430" width="500" height="120" rx="14" fill="#f5f3ff" stroke="#7c3aed" stroke-width="3"/>')
s.raw(badge(575, 462, 3, 'purple', 18) + T(605, 470, 'Combiner', 20, 800, '#6d28d9'))
s.raw(T(795, 506, 'KDF(secret 1 ‖ secret 2 ‖ transcript)', 17, 700, '#14213d', 'middle', mono=True))
s.raw(T(795, 534, '→ one session key: secret if either part holds', 15, 500, '#334155', 'middle'))
s.f(4)
s.rect(70, 580, 700, 220, 'hz', rx=14)
s.raw(badge(100, 612, 4, 'red', 18) + T(130, 620, 'Downgrade prevention', 20, 800, '#b91c1c'))
s.raw(lines(100, 660, ['An attacker in the middle removes the post-quantum', 'offer, hoping both sides fall back to classical only.', 'Both sides hash the whole transcript of what was', 'offered; the mismatch ends the handshake.'], 16, '#334155', lh=26))
s.f(5)
s.raw(f'<rect x="800" y="580" width="740" height="220" rx="14" fill="#f0fdf4" stroke="#86efac" stroke-width="2"/>')
s.raw(badge(830, 612, 5, 'green', 18) + T(860, 620, 'Rollout states', 20, 800, '#166534'))
for i, (t, c) in enumerate([('classical only', '#94a3b8'), ('hybrid', '#7c3aed'), ('post-quantum only', '#16a34a')]):
    bx = 830 + i * 235
    s.raw(f'<rect x="{bx}" y="650" width="200" height="54" rx="10" fill="#ffffff" stroke="{c}" stroke-width="3"/>' + T(bx + 100, 684, t, 16, 800, '#14213d', 'middle'))
    if i < 2:
        s.raw(f'<path d="M{bx + 204},677 L{bx + 228},677" stroke="#334155" stroke-width="3"/><path d="M{bx + 228},669 L{bx + 236},677 L{bx + 228},685 Z" fill="#334155"/>')
s.raw(lines(830, 742, ['Move on only when the newer state is measured and trusted.', 'Use reviewed designs (e.g. TLS X25519MLKEM768), not a home-made one.'], 15, '#334155', lh=24))
scenes[76] = s.render('Conceptual. The combiner shown is the pattern, not a protocol specification.')

# ── 77 Crypto-agile lifecycle ──────────────────────────────────────
STEPS77 = [('Inventory', 'what runs where,\nby version (Scene 73)'),
           ('Prioritise', 'by data shelf life\nand exposure (Scene 78)'),
           ('Engage vendors', 'roadmaps, firmware\npaths, test builds'),
           ('Measure in a lab', 'sizes, speed, battery,\ninteroperability'),
           ('Stage the rollout', 'hybrid first;\nsmall groups first'),
           ('Recover and revoke', 'roll back safely;\nretire old keys'),
           ('Verify, again', 'monitor; re-inventory\nas standards move')]
s = Scene(77, 'Crypto agility: a lifecycle, not a switch',
          'Five frames. A seven-step cycle: 1 and 2, inventory what cryptography runs where, by version, then prioritise by data '
          'shelf life and exposure; 3 and 4, engage vendors for roadmaps and firmware paths, and measure sizes, speed, battery and '
          'interoperability in a lab; 5 and 6, stage the rollout (hybrid first, small groups first) and keep the ability to roll back '
          'and retire old keys; 7, verify continuously and re-inventory as standards move, which returns to step 1. Last frame: why '
          'some devices cannot simply “switch on” new cryptography — no firmware update path, fixed silicon, and a coin-cell battery; '
          'their path is replacement at end of life.',
          sub='You cannot “switch on quantum encryption” for every tag. You plan, measure and replace.')
pos = [(70, 165), (430, 165), (790, 165), (1150, 165), (1150, 355), (790, 355), (430, 355)]
frame_of = [1, 1, 2, 2, 3, 3, 4]
cols77 = ['slate', 'blue', 'purple', 'teal', 'green', 'orange', 'amber']
for i, ((x, y), (t, b)) in enumerate(zip(pos, STEPS77)):
    s.f(frame_of[i])
    s.raw(step_box(x, y, 330, 125, i + 1, t, b, cols77[i]))
    if i < 6:
        nx, ny = pos[i + 1]
        if ny == y:
            x1, x2 = (x + 334, nx - 4) if nx > x else (x - 4, nx + 334)
            yy = y + 62
            d = 1 if nx > x else -1
            s.raw(f'<path d="M{x1},{yy} L{x2 - 8 * d},{yy}" stroke="#334155" stroke-width="3"/><path d="M{x2 - 8 * d},{yy - 8} L{x2},{yy} L{x2 - 8 * d},{yy + 8} Z" fill="#334155"/>')
        else:
            xx = x + 165
            s.raw(f'<path d="M{xx},{y + 129} L{xx},{ny - 12}" stroke="#334155" stroke-width="3"/><path d="M{xx - 8},{ny - 12} L{xx},{ny - 4} L{xx + 8},{ny - 12} Z" fill="#334155"/>')
s.f(4)
s.raw(f'<path d="M430,417 L245,417 L245,302" fill="none" stroke="#334155" stroke-width="3" stroke-dasharray="8 6"/><path d="M237,310 L245,298 L253,310 Z" fill="#334155"/>')
s.raw(T(80, 455, 'back to step 1', 15, 600, '#475569'))
s.f(5)
s.raw(f'<rect x="70" y="520" width="1470" height="285" rx="14" fill="#fef2f2" stroke="#fca5a5" stroke-width="2"/>')
s.raw(badge(100, 556, '!', 'red', 18) + T(130, 564, 'Why some devices cannot simply “switch on” new cryptography', 20, 800, '#b91c1c'))
s.raw(tag(170, 680, 56))
for i, (t, b) in enumerate([('No update path', 'some devices never receive\nnew firmware'), ('Fixed silicon', 'boot ROM and crypto engine\nare set at the factory'), ('A coin cell', 'bigger messages cost\nbattery life')]):
    x = 300 + i * 410
    s.raw(T(x, 630, t, 19, 800, '#14213d') + lines(x, 662, b.split('\n'), 16, '#334155', lh=26))
s.raw(T(300, 760, 'For these, the path is replacement at end of life, planned now.', 17, 700, '#166534'))
scenes[77] = s.render('Process view. Steps run in parallel across product lines in practice.')

# ── 78 Three clocks ────────────────────────────────────────────────
s = Scene(78, 'Three clocks: shelf life, migration time, and the unknown',
          'Five frames. 1, clock x: how long the data must stay secret (its shelf life). 2, clock y: how long migrating the systems '
          'that protect it will take. 3, clock z: how long until a cryptographically relevant quantum computer exists — drawn as an '
          'unknown band with no date, because published estimates disagree and none is a fact. 4, the rule (Mosca, 2015): if x + y is '
          'larger than z, data encrypted today is at risk; since z is unknown, the useful question is whether x + y is long. 5, '
          'prioritise by sensitivity and exposure: a card’s transaction cryptogram matters for minutes; a tracker’s location history '
          'for weeks, and patterns of life for longer; account backups and signed firmware (whose concern is authenticity) for years.',
          sub='No Q-day dates here. Ask how long data must stay secret, and how long change will take.')
s.f(1)
s.raw(clock(210, 300, 90, '#2563eb', 'x: shelf life', 120))
s.raw(lines(110, 450, ['How long must this', 'data stay secret?'], 15.5, '#334155', lh=24))
s.f(2)
s.raw(clock(560, 300, 90, '#ea580c', 'y: migration time', 220))
s.raw(lines(460, 450, ['How long will changing', 'every system take?'], 15.5, '#334155', lh=24))
s.f(3)
s.raw(clock(910, 300, 90, '#6b7280', 'z: unknown', uncertain=True))
s.raw(lines(800, 450, ['Until a quantum computer that', 'matters for cryptography exists.', 'Estimates disagree: no date.'], 15.5, '#334155', lh=24))
s.f(4)
s.raw(f'<rect x="1100" y="190" width="440" height="320" rx="16" fill="#f5f3ff" stroke="#a78bfa" stroke-width="2"/>')
s.raw(badge(1130, 222, 4, 'purple', 18) + T(1160, 230, 'The rule', 20, 800, '#6d28d9'))
s.raw(T(1320, 300, 'x + y  >  z', 40, 800, '#14213d', 'middle', mono=True))
s.raw(lines(1130, 350, ['→ data encrypted today is at risk.', 'z is unknown, so ask instead:', 'is x + y long? Then start now.', '(Mosca, 2015)'], 16, '#334155', lh=28))
s.f(5)
rows78 = [['What', 'Must stay protected for', 'x + y', 'Priority'],
          ['Card transaction cryptogram', 'minutes', 'short', 'low'],
          ['Tracker location history', 'weeks; patterns of life longer', 'medium', 'medium'],
          ['Account backups', 'years', 'long', 'high'],
          ['Signed firmware (authenticity)', 'device lifetime', 'long', 'high']]
cw = [400, 400, 200, 200]
for r, row in enumerate(rows78):
    y = 560 + r * 48
    s.raw(f'<rect x="70" y="{y}" width="{sum(cw)}" height="46" fill="{"#eef2ff" if r == 0 else ("#ffffff" if r % 2 else "#f8fafc")}" stroke="#e2e8f0"/>')
    cx = 70
    for c, (cell, w) in enumerate(zip(row, cw)):
        col = '#14213d'
        if r and c == 3:
            col = {'high': '#b91c1c', 'medium': '#b45309'}.get(cell, '#166534')
        s.raw(T(cx + 16, y + 30, cell, 16, 800 if r == 0 or c == 3 else 500, col))
        cx += w
s.raw(badge(1310, 584, 5, 'teal', 18) + T(1336, 592, 'Prioritise by', 18, 800, '#0f766e'))
s.raw(lines(1310, 630, ['sensitivity and exposure,', 'not by a guessed date.', 'Signed firmware is about', 'authenticity: a forged', 'signature would matter', 'only after z arrives.'], 15, '#334155', lh=24))
scenes[78] = s.render('Concept (Mosca’s inequality). Shelf lives are typical examples, not measurements.')
