"""Module 10 phone-vertical scenes (73–78): the same scenes as module10.py, laid out for a
phone (VScene: 720 wide, body drawn in its own coordinates below the header).
Same title, desc, frames and words as the landscape scene; invisible-engine/tests/check.py
compares them. Change a scene's words in both files. Sizes and table rows are imported
from module10.py, never retyped.
"""
import math

from .svgkit import VScene, wrap
from .art import *
from .module10 import SIZES, ADV_DATA, ATT_MTU_MAX, STATUS, INV, STEPS77, algs, rows78, key, frame_of, cols77

scenes = {}

INK, BODY = '#14213d', '#334155'


def V(num, title, desc, sub, note, bh):
    s = VScene(num, title, desc, sub=sub, note=note)
    s.bh = bh          # no arrow legend rows in most of these scenes: size the body directly
    return s


def vlines(x, y, rows, size=21, color=BODY, weight=400, lh=28, anchor='start'):
    return ''.join(T(x, y + i * lh, r, size, weight, color, anchor) for i, r in enumerate(rows))


def vcall(x, y, title, body, color, n, w=640, chars=54, tsize=26, extra=0):
    """A callout whose body is wrapped here; returns (svg, height)."""
    rows = wrap(body, chars)
    h = 94 + 27 * (len(rows) - 1) + extra
    return callout(x, y, w, h, title, '\n'.join(rows), color, n, tsize, 21), h


def vchip(x, y, status, w=150):
    fill, stroke, ink, dashed = STATUS[status]
    dash = ' stroke-dasharray="6 4"' if dashed else ''
    return (f'<rect x="{x}" y="{y}" width="{w}" height="32" rx="16" fill="{fill}" stroke="{stroke}" stroke-width="2"{dash}/>'
            + T(x + w / 2, y + 23, status, 20, 800, ink, 'middle', mono=True))


def vmcu(x, y, label='tracker chip'):
    """module10.mcu at phone type size: 364 x 170, the same words."""
    out = f'<rect x="{x}" y="{y}" width="364" height="170" rx="10" fill="#1f2937"/>'
    for i in range(9):  # pins
        px = x + 22 + i * 38
        out += (f'<rect x="{px}" y="{y - 12}" width="12" height="12" fill="#9ca3af"/>'
                f'<rect x="{px}" y="{y + 170}" width="12" height="12" fill="#9ca3af"/>')
    blocks = [('boot ROM', 'fixed at the factory', '#fca5a5'), ('flash', 'firmware + keys', '#fcd34d'), ('RAM', 'tens of KB', '#93c5fd')]
    for i, (t, sub, col) in enumerate(blocks):
        bx = x + 14 + i * 114
        out += f'<rect x="{bx}" y="{y + 18}" width="108" height="94" rx="6" fill="{col}"/>'
        out += T(bx + 54, y + 56, t, 20, 800, '#111827', 'middle')
        out += T(bx + 54, y + 88, sub.split(' ')[0], 20, 500, '#111827', 'middle')
    out += T(x + 182, y + 150, label, 21, 700, '#e5e7eb', 'middle')
    return out


# ── 73 Cryptographic inventory ─────────────────────────────────────
s = V(73, 'Inventory first: which cryptography does each part use?',
      'Four frames. A table of eight places cryptography works across cards, trackers and accounts, each with its job, the '
      'algorithm as publicly documented, and an evidence status. 1, the payment card chip: transaction cryptograms use '
      'symmetric keys (TDES or AES, chosen by the issuer), verified from the EMV specifications; offline card authentication uses '
      'RSA certificates and EMV also specifies elliptic curves, unverified for any given card. 2, an access badge (AES-128 on '
      'current secure credentials, unverified for a particular fleet), Bluetooth LE Secure Connections pairing (ECDH on P-256, '
      'verified from the Core Specification) and tracker firmware signing (not published: unknown). 3, Find My location '
      'reports (ECDH on P-224 then AES-GCM, verified from Apple’s documentation), the cloud connection (TLS 1.3 with elliptic-curve '
      'key exchange, hybrid with ML-KEM rolling out, unverified per service) and sharing and backups (unverified). 4, the rows '
      'that rely on public-key cryptography are marked: those are the ones Shor’s algorithm would affect at scale.',
      'You cannot plan a migration for algorithms you have not listed — or cannot see.',
      'Status reflects public documentation, not any one fleet. Check your own vendors.', 1124)
# the column headers, as a key laid out like each row card below
s.raw('<rect x="40" y="0" width="640" height="100" rx="10" fill="#eef2ff"/>')
s.raw(T(56, 30, 'Where', 20, 800, INK) + T(664, 30, 'Evidence', 20, 800, INK, 'end')
      + T(56, 58, 'Job', 20, 800, INK) + T(664, 58, 'Public-key?', 20, 800, INK, 'end')
      + T(56, 86, 'Algorithm, as documented', 20, 800, INK))
RY, RH = 112, 104
for fr, rows in [(1, (0, 1)), (2, (2, 3, 4)), (3, (5, 6, 7))]:
    s.f(fr)
    for r in rows:
        thing, job, alg, st, pk = INV[r]
        y = RY + r * RH
        s.raw(f'<rect x="40" y="{y}" width="640" height="{RH - 6}" rx="10" fill="{"#ffffff" if r % 2 else "#f8fafc"}" stroke="#e2e8f0" stroke-width="1.5"/>')
        s.raw(T(56, y + 30, thing, 21, 800, INK))
        s.raw(vchip(514, y + 9, st))
        s.raw(T(56, y + 58, job, 21, 400, BODY))
        s.raw(T(56, y + 86, alg, 21, 500, INK))
s.f(4)
for r, (_, _, _, _, pk) in enumerate(INV):
    y = RY + r * RH
    if pk is None:  # algorithm not published: exposure cannot be stated
        s.raw(f'<rect x="414" y="{y + 39}" width="250" height="30" rx="8" fill="#ffffff" stroke="#9ca3af" stroke-width="2" stroke-dasharray="5 4"/>'
              + T(539, y + 60, 'unknown: not published', 20, 700, '#374151', 'middle'))
    elif pk:
        s.raw(f'<rect x="444" y="{y + 39}" width="220" height="30" rx="8" fill="#f5f3ff" stroke="#a78bfa" stroke-width="2"/>'
              + T(554, y + 60, 'yes: Shor-exposed', 20, 800, '#6d28d9', 'middle'))
    else:
        s.raw(T(664, y + 60, 'no: symmetric', 20, 600, '#475569', 'end'))
foot = ('VERIFIED = in the vendor’s or standard’s own documentation.  UNVERIFIED = documented for some products or versions, '
        'not confirmed for yours.  UNKNOWN = not published.  “Shor-exposed” means: only on a large fault-tolerant quantum '
        'computer, which is not publicly known to exist.')
s.raw(vlines(40, RY + 8 * RH + 22, wrap(foot, 50), 21, BODY, 500, 27))
scenes[73] = s.render()

# ── 74 NIST algorithms ─────────────────────────────────────────────
s = V(74, 'The new standard locks: three NIST algorithms',
      'Five frames. 1, ML-KEM, FIPS 203: a key-encapsulation mechanism for agreeing a shared secret, built on module lattices. '
      '2, ML-DSA, FIPS 204: a digital signature scheme, also lattice-based. 3, SLH-DSA, FIPS 205: a stateless hash-based '
      'signature scheme whose security rests only on hash functions; larger and slower, a conservative alternative. All three were '
      'published by NIST on 13 August 2024. 4, in progress, to be checked against NIST’s current pages: FN-DSA (Falcon, draft FIPS '
      '206) and HQC, selected in March 2025 as a backup key-encapsulation mechanism. 5, all of these run on ordinary classical '
      'chips — phones, servers, smart cards — not on quantum computers; they are designed to resist known quantum attacks.',
      'Published August 2024. Classical algorithms, designed to resist known quantum attacks.',
      'NIST FIPS 203, 204 and 205 (13 August 2024). Draft and candidate status: verify.', 1226)
CH = 196
for i, (n, name, fips, job, body, col) in enumerate(algs):
    s.f(n)
    y = i * (CH + 12)
    c, light, border = STEP[col]
    s.raw(f'<rect x="40" y="{y}" width="640" height="{CH}" rx="18" fill="{light}" stroke="{border}" stroke-width="2"/>')
    s.raw(badge(78, y + 40, n, col, 24))
    s.raw(T(114, y + 52, name, 32, 800, INK))
    s.raw(f'<rect x="506" y="{y + 18}" width="150" height="40" rx="20" fill="#ffffff" stroke="{c}" stroke-width="2"/>' + T(581, y + 46, fips, 20, 800, c, 'middle', mono=True))
    s.raw(T(62, y + 94, job, 24, 800, c))
    s.raw(T(656, y + 94, 'Published 13 August 2024', 21, 600, '#475569', 'end'))
    s.raw(vlines(62, y + 128, wrap(body.replace('\n', ' '), 40), 21, BODY, 400, 27))
    s.raw(lock(590, y + 108, 1.3, c) if n == 1 else key(566, y + 146, 1.4, c))
y4 = 3 * (CH + 12) + 2
s.f(4)
svg, h4 = vcall(40, y4, 'In progress — check NIST’s current pages', 'FN-DSA (Falcon): draft FIPS 206, a compact lattice signature. '
                'HQC: selected March 2025 as a backup key-encapsulation mechanism built on different mathematics (codes).', 'amber', 4, tsize=23, chars=56)
s.raw(svg)
y5 = y4 + h4 + 12
s.f(5)
svg, h5 = vcall(40, y5, 'They run on ordinary chips', 'Post-quantum cryptography is classical software and hardware: phones, servers, '
                'smart cards. It is designed to resist known quantum attacks — not run on quantum computers.', 'green', 5, chars=56)
s.raw(svg)
yd = y5 + h5 + 30
s.raw(T(40, yd, 'the same everyday devices →', 21, 600, '#166534'))
s.raw(phone(60, yd + 30, 70, 140, '#e0f2fe') + server(160, yd + 40, 0.8) + vmcu(316, yd + 16, 'card chip'))
scenes[74] = s.render()

# ── 75 Migration boundaries ────────────────────────────────────────
s = V(75, 'Why trackers cannot simply switch: bytes, chips and batteries',
      'Five frames. 1, object sizes from the standards on a logarithmic scale: an X25519 public key is 32 bytes, a compressed '
      'P-256 key 33, an ECDSA P-256 signature 64; an ML-KEM-768 ciphertext is 1,088 bytes and its encapsulation key 1,184, an '
      'ML-DSA-65 public key 1,952 and signature 3,309, and an SLH-DSA-SHA2-128s signature 7,856. 2, a legacy Bluetooth '
      'advertisement carries at most 31 bytes of data, so one ML-KEM-768 key would need 39 of them; even the largest ATT packet '
      'size of 517 bytes needs 3 packets. 3, inside a tracker: a boot ROM fixed at the factory, flash for firmware and keys, '
      'RAM of tens of kilobytes, and a coin cell — every extra byte sent costs energy. 4, beyond the device: new account '
      'devices, key synchronisation and the backend that looks reports up must all change together. 5, these are design '
      'constraints, not vulnerabilities: they decide how and when a migration can happen.',
      'Post-quantum keys and signatures are tens to hundreds of times larger.',
      'Sizes from FIPS 203/204/205, RFC 7748 and SEC 1; Bluetooth limits from the Core Specification.', 1176)
s.f(1)
s.raw(T(40, 22, 'Size in bytes (logarithmic scale)', 22, 800, INK))
LW, RW = 640, 36
lmax = math.log10(10000)
for i, (name, b, kind, std) in enumerate(SIZES):
    y = 36 + i * RW
    w = math.log10(b) / lmax * LW
    col = '#7c3aed' if kind == 'pq' else '#64748b'
    s.raw(T(40, y + 20, name, 20, 600, BODY))
    s.raw(T(680, y + 20, f'{b:,} B · {std}', 20, 600, BODY, 'end'))
    s.raw(f'<rect x="40" y="{y + 25}" width="{w:.0f}" height="9" rx="4" fill="{col}"/>')
ay = 36 + len(SIZES) * RW + 2
s.raw(f'<path d="M40,{ay} L680,{ay}" stroke="#cbd5e1" stroke-width="2"/>')
for tick in (10, 100, 1000, 10000):
    tx = 40 + math.log10(tick) / lmax * LW
    s.raw(f'<path d="M{tx:.0f},{ay} L{tx:.0f},{ay + 8}" stroke="#64748b" stroke-width="2"/>'
          + T(tx, ay + 30, f'{tick:,}', 20, 500, '#475569', 'end' if tick == 10000 else 'middle'))
s.raw(T(40, ay + 58, 'grey: classical · purple: post-quantum', 20, 500, '#475569'))
kem = dict((n, b) for n, b, _, _ in SIZES)['ML-KEM-768 encapsulation key']
n_adv = math.ceil(kem / ADV_DATA)
n_att = math.ceil(kem / ATT_MTU_MAX)
y2 = ay + 74
s.f(2)
svg, h2 = vcall(40, y2, 'Bytes on air', f'A legacy advertisement carries at most {ADV_DATA} bytes of data. One ML-KEM-768 key '
                f'({kem:,} B) would need {n_adv} of them. Even the largest ATT packet ({ATT_MTU_MAX} B) needs {n_att}.', 'blue', 2, chars=56, extra=26)
s.raw(svg)
for k in range(n_adv):
    s.raw(f'<rect x="{56 + k * 15.6:.1f}" y="{y2 + 140}" width="12" height="14" rx="2" fill="#93c5fd"/>')
y3 = y2 + h2 + 12
s.f(3)
P3 = 318
s.raw(f'<rect x="40" y="{y3}" width="640" height="{P3}" rx="14" fill="#fff7ed" stroke="#fdba74" stroke-width="2"/>')
s.raw(badge(66, y3 + 32, 3, 'orange', 18) + T(94, y3 + 41, 'Inside the device', 24, 800, '#c2410c'))
s.raw(vmcu(56, y3 + 72))
s.raw(coin_cell(556, y3 + 156, 64))
s.raw(vlines(56, y3 + 280, wrap('Boot ROM: fixed at the factory; may not verify new signature types. Every byte sent costs battery.', 54), 21, BODY, 400, 27))
y4 = y3 + P3 + 12
s.f(4)
svg, h4 = vcall(40, y4, 'Beyond the device', 'New account devices, key synchronisation and the backend that files and finds reports '
                'must all accept the new formats — at the same time as old devices still in use.', 'purple', 4, chars=56)
s.raw(svg)
s.f(5)
svg, h5 = vcall(40, y4 + h4 + 12, 'Constraints, not vulnerabilities', 'They decide how and when a migration can happen.', 'green', 5)
s.raw(svg)
scenes[75] = s.render()

# ── 76 Hybrid crypto ───────────────────────────────────────────────
s = V(76, 'Hybrid key exchange: two locks on one door',
      'Five frames. 1, today a client and a server agree a key with classical elliptic-curve Diffie–Hellman (X25519). 2, a '
      'hybrid adds a post-quantum key encapsulation (ML-KEM-768) alongside it in the same handshake. 3, a combiner feeds '
      'both shared secrets, with the handshake transcript, into one key-derivation function, so the session key stays secret '
      'if either part holds. 4, downgrade prevention: an attacker in the middle who strips the post-quantum part is caught, '
      'because both sides check a hash of everything that was offered. 5, rollout states: classical only, then hybrid, then '
      'post-quantum only once confidence allows. Reviewed designs such as TLS’s X25519MLKEM768, not an improvised protocol.',
      'The session stays secret if either lock holds. Use reviewed designs, never a home-made one.',
      'Conceptual. The combiner shown is the pattern, not a protocol specification.', 920)
s.raw(phone(40, 16, 100, 200, '#e0f2fe') + T(90, 250, 'client', 21, 700, BODY, 'middle'))
s.raw(server(560, 36, 1.0) + T(620, 250, 'server', 21, 700, BODY, 'middle'))
s.f(1)
s.biarrow([(152, 80), (548, 80)], 'crypto', 'X25519 (classical)', at=(350, 64))
s.raw(T(350, 116, 'shared secret 1', 21, 700, '#6d28d9', 'middle'))
s.f(2)
s.biarrow([(152, 178), (548, 178)], 'crypto', 'ML-KEM-768 (post-quantum)', at=(350, 162))
s.raw(T(350, 214, 'shared secret 2', 21, 700, '#6d28d9', 'middle'))
s.f(3)
s.raw('<rect x="40" y="282" width="640" height="150" rx="14" fill="#f5f3ff" stroke="#7c3aed" stroke-width="3"/>')
s.raw(badge(70, 316, 3, 'purple', 18) + T(100, 324, 'Combiner', 24, 800, '#6d28d9'))
s.raw(T(360, 372, 'KDF(secret 1 ‖ secret 2 ‖ transcript)', 20, 700, INK, 'middle', mono=True))
s.raw(T(360, 410, '→ one session key: secret if either part holds', 21, 500, BODY, 'middle'))
s.f(4)
s.rect(40, 452, 640, 196, 'hz', rx=14)
s.raw(badge(70, 486, 4, 'red', 18) + T(100, 494, 'Downgrade prevention', 24, 800, '#b91c1c'))
s.raw(vlines(62, 536, wrap('An attacker in the middle removes the post-quantum offer, hoping both sides fall back to classical only. '
                           'Both sides hash the whole transcript of what was offered; the mismatch ends the handshake.', 52), 21, BODY, 400, 27))
s.f(5)
s.raw('<rect x="40" y="668" width="640" height="240" rx="14" fill="#f0fdf4" stroke="#86efac" stroke-width="2"/>')
s.raw(badge(70, 702, 5, 'green', 18) + T(100, 710, 'Rollout states', 24, 800, '#166534'))
bx = 60
for i, ((t, c), bw) in enumerate(zip([('classical only', '#94a3b8'), ('hybrid', '#7c3aed'), ('post-quantum only', '#16a34a')], (170, 110, 210))):
    s.raw(f'<rect x="{bx}" y="732" width="{bw}" height="54" rx="10" fill="#ffffff" stroke="{c}" stroke-width="3"/>' + T(bx + bw / 2, 766, t, 20, 800, INK, 'middle'))
    if i < 2:
        s.raw(f'<path d="M{bx + bw + 5},759 L{bx + bw + 25},759" stroke="#334155" stroke-width="3"/><path d="M{bx + bw + 24},751 L{bx + bw + 32},759 L{bx + bw + 24},767 Z" fill="#334155"/>')
    bx += bw + 36
s.raw(vlines(62, 820, wrap('Move on only when the newer state is measured and trusted. Use reviewed designs '
                           '(e.g. TLS X25519MLKEM768), not a home-made one.', 52), 21, BODY, 400, 27))
scenes[76] = s.render()

# ── 77 Crypto-agile lifecycle ──────────────────────────────────────
s = V(77, 'Crypto agility: a lifecycle, not a switch',
      'Five frames. A seven-step cycle: 1 and 2, inventory what cryptography runs where, by version, then prioritise by data '
      'shelf life and exposure; 3 and 4, engage vendors for roadmaps and firmware paths, and measure sizes, speed, battery and '
      'interoperability in a lab; 5 and 6, stage the rollout (hybrid first, small groups first) and keep the ability to roll back '
      'and retire old keys; 7, verify continuously and re-inventory as standards move, which returns to step 1. Last frame: why '
      'some devices cannot simply “switch on” new cryptography — no firmware update path, fixed silicon, and a coin-cell battery; '
      'their path is replacement at end of life.',
      'You cannot “switch on quantum encryption” for every tag. You plan, measure and replace.',
      'Process view. Steps run in parallel across product lines in practice.', 1000)
BW, BH = 300, 104
L, R = 40, 380
pos = [(L, 0), (L, 134), (L, 268), (L, 402), (R, 402), (R, 268), (R, 134)]   # a ring: down the left, up the right


def vstep(x, y, n, title, body, color):
    c, light, border = STEP[color]
    return (f'<rect x="{x}" y="{y}" width="{BW}" height="{BH}" rx="12" fill="{light}" stroke="{border}" stroke-width="2"/>'
            + badge(x + 26, y + 30, n, color, 17) + T(x + 52, y + 37, title, 22, 800, INK)
            + vlines(x + 16, y + 68, body.split('\n'), 21, BODY, 400, 27))


for i, ((x, y), (t, b)) in enumerate(zip(pos, STEPS77)):
    s.f(frame_of[i])
    s.raw(vstep(x, y, i + 1, t, b, cols77[i]))
    if i < 6:
        nx, ny = pos[i + 1]
        if nx != x:   # across the bottom of the ring
            yy = y + BH // 2
            s.raw(f'<path d="M{x + BW + 4},{yy} L{nx - 12},{yy}" stroke="#334155" stroke-width="3"/><path d="M{nx - 12},{yy - 8} L{nx - 4},{yy} L{nx - 12},{yy + 8} Z" fill="#334155"/>')
        elif ny > y:  # down the left
            xx = x + BW // 2
            s.raw(f'<path d="M{xx},{y + BH + 4} L{xx},{ny - 12}" stroke="#334155" stroke-width="3"/><path d="M{xx - 8},{ny - 12} L{xx},{ny - 4} L{xx + 8},{ny - 12} Z" fill="#334155"/>')
        else:         # up the right
            xx = x + BW // 2
            s.raw(f'<path d="M{xx},{y - 4} L{xx},{ny + BH + 12}" stroke="#334155" stroke-width="3"/><path d="M{xx - 8},{ny + BH + 12} L{xx},{ny + BH + 4} L{xx + 8},{ny + BH + 12} Z" fill="#334155"/>')
s.f(4)
s.raw(f'<path d="M{R + BW // 2},130 L{R + BW // 2},52 L{L + BW + 12},52" fill="none" stroke="#334155" stroke-width="3" stroke-dasharray="8 6"/>'
      f'<path d="M{L + BW + 12},44 L{L + BW + 2},52 L{L + BW + 12},60 Z" fill="#334155"/>')
s.raw(T(R + 20, 30, 'back to step 1', 21, 600, '#475569'))
s.f(5)
py = 530
items = [('No update path', 'some devices never receive\nnew firmware'), ('Fixed silicon', 'boot ROM and crypto engine\nare set at the factory'), ('A coin cell', 'bigger messages cost\nbattery life')]
iy = py + 112
parts = []
for t, b in items:
    rows = wrap(b.replace('\n', ' '), 40)
    parts.append(T(180, iy, t, 22, 800, INK) + vlines(180, iy + 29, rows, 21, BODY, 400, 27))
    iy += 29 + 27 * len(rows) + 16
fin = wrap('For these, the path is replacement at end of life, planned now.', 50)
PH = iy - py + 27 * len(fin) + 14
s.raw(f'<rect x="40" y="{py}" width="640" height="{PH}" rx="14" fill="#fef2f2" stroke="#fca5a5" stroke-width="2"/>')
s.raw(badge(68, py + 36, '!', 'red', 19) + T(96, py + 44, 'Why some devices cannot simply “switch on”\nnew cryptography', 22, 800, '#b91c1c'))
s.raw(tag(106, py + 190, 48))
s.raw(''.join(parts))
s.raw(vlines(62, iy + 6, fin, 21, '#166534', 700, 27))
s.bh = py + PH + 6
scenes[77] = s.render()

# ── 78 Three clocks ────────────────────────────────────────────────
s = V(78, 'Three clocks: shelf life, migration time, and the unknown',
      'Five frames. 1, clock x: how long the data must stay secret (its shelf life). 2, clock y: how long migrating the systems '
      'that protect it will take. 3, clock z: how long until a cryptographically relevant quantum computer exists — drawn as an '
      'unknown band with no date, because published estimates disagree and none is a fact. 4, the rule (Mosca, 2015): if x + y is '
      'larger than z, data encrypted today is at risk; since z is unknown, the useful question is whether x + y is long. 5, '
      'prioritise by sensitivity and exposure: a card’s transaction cryptogram matters for minutes; a tracker’s location history '
      'for weeks, and patterns of life for longer; account backups and signed firmware (whose concern is authenticity) for years.',
      'No Q-day dates here. Ask how long data must stay secret, and how long change will take.',
      'Concept (Mosca’s inequality). Shelf lives are typical examples, not measurements.', 1140)


def vclock(cx, cy, r, color, hand_deg=60, uncertain=False):
    out = f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#ffffff" stroke="{color}" stroke-width="5"' + (' stroke-dasharray="10 7"' if uncertain else '') + '/>'
    for k in range(12):
        a = math.radians(k * 30)
        out += f'<path d="M{cx + (r - 10) * math.sin(a):.1f},{cy - (r - 10) * math.cos(a):.1f} L{cx + (r - 3) * math.sin(a):.1f},{cy - (r - 3) * math.cos(a):.1f}" stroke="{color}" stroke-width="2"/>'
    if uncertain:
        out += T(cx, cy + 14, '?', r * 0.75, 800, color, 'middle')
    else:
        a = math.radians(hand_deg)
        out += f'<path d="M{cx},{cy} L{cx + r * 0.62 * math.sin(a):.1f},{cy - r * 0.62 * math.cos(a):.1f}" stroke="#14213d" stroke-width="5" stroke-linecap="round"/>'
        out += f'<path d="M{cx},{cy} L{cx},{cy - r * 0.78:.1f}" stroke="#14213d" stroke-width="3" stroke-linecap="round"/>'
        out += f'<circle cx="{cx}" cy="{cy}" r="6" fill="#14213d"/>'
    return out


clocks = [(1, '#2563eb', 'x: shelf life', 120, False, 'How long must this data stay secret?'),
          (2, '#ea580c', 'y: migration time', 220, False, 'How long will changing every system take?'),
          (3, '#6b7280', 'z: unknown', 0, True, 'Until a quantum computer that matters for cryptography exists. Estimates disagree: no date.')]
for i, (fr, col, label, hand, unc, q) in enumerate(clocks):
    s.f(fr)
    y = i * 140
    s.raw(vclock(102, y + 64, 58, col, hand, unc))
    s.raw(T(196, y + 34, label, 24, 800, col))
    s.raw(vlines(196, y + 68, wrap(q, 49), 21, BODY, 400, 27))
s.f(4)
s.raw('<rect x="40" y="424" width="640" height="186" rx="16" fill="#f5f3ff" stroke="#a78bfa" stroke-width="2"/>')
s.raw(badge(70, 458, 4, 'purple', 18) + T(100, 466, 'The rule', 24, 800, '#6d28d9'))
s.raw(T(660, 472, 'x + y  >  z', 34, 800, INK, 'end', mono=True))
s.raw(vlines(62, 512, ['→ data encrypted today is at risk.', 'z is unknown, so ask instead:', 'is x + y long? Then start now.', '(Mosca, 2015)'], 21, BODY, 400, 27))
s.f(5)
s.raw(badge(58, 650, 5, 'teal', 18) + T(86, 658, 'Prioritise by', 24, 800, '#0f766e'))
s.raw(vlines(40, 692, wrap('sensitivity and exposure, not by a guessed date. Signed firmware is about authenticity: '
                           'a forged signature would matter only after z arrives.', 54), 21, BODY, 400, 27))
ty = 790
for r, row in enumerate(rows78):
    y = ty + r * 70
    s.raw(f'<rect x="40" y="{y}" width="640" height="64" rx="10" fill="{"#eef2ff" if r == 0 else ("#ffffff" if r % 2 else "#f8fafc")}" stroke="#e2e8f0"/>')
    pcol = INK if r == 0 else {'high': '#b91c1c', 'medium': '#b45309'}.get(row[3], '#166534')
    s.raw(T(56, y + 27, row[0], 21, 800 if r == 0 else 700, INK) + T(664, y + 27, row[3], 21, 800, pcol, 'end')
          + T(56, y + 54, row[1], 21, 800 if r == 0 else 400, INK if r == 0 else BODY)
          + T(664, y + 54, row[2], 21, 800 if r == 0 else 500, INK if r == 0 else BODY, 'end'))
scenes[78] = s.render()
