"""Module 12 phone-vertical scenes (85–89): the same scenes as module12.py, laid out for a
phone (VScene: 720 wide, body drawn in its own coordinates below the header).
Same title, desc, frames and words as the landscape scene; invisible-engine/tests/check.py
compares them. Change a scene's words in both files."""
from .svgkit import VScene
from .art import *
from .module12 import AMPS, COLS86, ROWS86, COLS87, ROWS87, ST87, STAGES, GUARD, SAFE, fmt

scenes = {}


# ── phone-scale helpers (text at 20 px or more) ─────────────────────
def vnote(x, y, text, size=20, color='#334155', weight=400, anchor='start'):
    return T(x, y, text, size, weight, color, anchor)


def vterminal(x, y, s):
    """The landscape terminal, with its screen words set at a phone-readable size."""
    return terminal(x, y, s, screen='') + T(x + 130 * s, y + 150 * s, 'Tap to pay', 20, 800, '#0c4a6e', 'middle')


def vcard(x, y, w, number='•••• 1234'):
    out = card(x, y, w, label=None, number=None)
    out += T(x + w * 0.94, y + w * 0.63 * 0.22, 'BANK', 20, 800, '#e0e7ff', 'end')
    if number:
        out += T(x + w * 0.08, y + w * 0.63 * 0.86, number, 20, 600, '#ffffff', mono=True)
    return out


def vzone(x, y, w, h, title, sub):
    """A layer panel; the mono heading and its subtitle share one line."""
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>'
            + T(x + 16, y + 32, title, 20, 700, '#1d4ed8', mono=True)
            + T(x + 26 + len(title) * 12.1, y + 32, sub, 20, 400, '#475569'))


def vchip(x, y, text):
    w = len(text) * 12.1 + 22
    return (f'<rect x="{x}" y="{y}" width="{w:.0f}" height="32" rx="16" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5"/>'
            + T(x + w / 2, y + 22, text, 20, 600, '#475569', 'middle', mono=True))


# ── 85 Master map ───────────────────────────────────────────────────
s = VScene(85, 'The whole engine on one map',
           'Five frames build one map in three zones by distance: touch (centimetres), radio (metres) and the internet '
           '(anywhere), over two bands for cryptography and governance. 1, in the touch zone a payment terminal powers a '
           'card through its field and the two exchange commands and replies. 2, in the radio zone a small tag broadcasts a '
           'rotating key, a passer-by’s phone overhears it and sends a sealed report over the internet to a relay, which '
           'stores it without being able to read it; the owner’s phone fetches and opens it. 3, the owner standing nearby '
           'measures distance and direction to the tag with ultra-wideband, and a finder who touches the tag with an NFC '
           'phone sees a web page, not a location; NFC never reaches the relay. 4, the account service links the tag to one '
           'owner and decides who may fetch reports or share; these are permissions, not data. 5, two bands under the map: '
           'cryptography and its move to post-quantum algorithms, and privacy and governance.',
           sub='Each technology in its own layer. Nothing touches the cloud by NFC; nothing finds a tag by satellite.',
           h=1600)
# zones stacked by distance: touch, radio, internet
ZT, ZR, ZI = 0, 298, 598
s.raw(vzone(40, ZT, 640, 292, 'TOUCH · centimetres', 'NFC: power and data by near field'))
s.raw(vzone(40, ZR, 640, 292, 'RADIO · metres', 'Bluetooth LE and ultra-wideband'))
s.raw(vzone(40, ZI, 640, 296, 'INTERNET · anywhere', 'reports, accounts and relays'))
# 1 touch: terminal powers card
s.f(1)
s.raw(vterminal(52, ZT + 44, 0.56))
s.raw(vcard(248, ZT + 56, 186))
s.arrow([(202, ZT + 92), (242, ZT + 92)], 'energy')
s.biarrow([(202, ZT + 136), (242, ZT + 136)], 'signal')
s.raw(vnote(232, ZT + 206, 'field powers the chip;', 20, '#9a3412', 600))
s.raw(vnote(232, ZT + 230, 'commands ⇄ replies', 20, '#1d4ed8', 600))
s.raw(vchip(232, ZT + 248, 'Module 2 · Scenes 09–17'))
# 2 radio + internet: the finding network
s.f(2)
s.raw(tag(100, ZR + 130, 30))
s.raw(vnote(56, ZR + 194, 'tag: no GPS, no SIM', 20, '#475569', 600))
s.raw(phone(580, ZR + 46, 60, 114, '#e0f2fe'))
s.raw(vnote(640, ZR + 186, 'a passer-by’s phone', 20, '#475569', 600, 'end'))
s.arrow([(134, ZR + 118), (572, ZR + 96)], 'signal', 'rotating key', at=(340, ZR + 88))
s.raw(cloud(434, ZI + 56, 190, None))
s.raw(T(529, ZI + 138, 'Relay', 21, 700, '#14213d', 'middle'))
s.rect(420, ZI + 46, 218, 124, 'bound', rx=14)
s.raw(vnote(638, ZI + 196, 'stores, cannot read', 20, '#14213d', 700, 'end'))
s.arrow([(644, ZR + 110), (666, ZR + 110), (666, ZI + 108), (646, ZI + 108)], 'crypto', 'sealed report', at=(592, ZR + 262))
s.raw(phone(270, ZI + 112, 64, 122, '#f5f3ff'))
s.raw(lock(283, ZI + 148, 0.8, '#7c3aed'))
s.raw(vnote(160, ZI + 270, 'owner, far away', 20, '#475569', 600))
s.arrow([(456, ZI + 172), (342, ZI + 196)], 'crypto', 'fetched, opened', at=(510, ZI + 230))
s.raw(vchip(56, ZR + 256, 'Modules 4–5 · Scenes 23–41'))
# 3 nearby UWB + NFC Lost Mode
s.f(3)
s.raw(phone(380, ZR + 150, 52, 96, '#ecfdf5'))
s.raw(vnote(444, ZR + 230, 'owner, nearby', 20, '#475569', 600))
s.biarrow([(134, ZR + 140), (372, ZR + 196)], 'signal', 'UWB: distance + direction', at=(222, ZR + 238))
s.raw(phone(462, ZT + 56, 40, 76, '#ffffff'))
s.raw(tag(530, ZT + 96, 20))
s.raw(vnote(462, ZT + 164, 'NFC tap: a web page,', 20, '#334155', 600))
s.raw(vnote(462, ZT + 188, 'not a location;', 20, '#334155', 600))
s.raw(vnote(462, ZT + 212, 'never reaches the', 20, '#b91c1c', 700))
s.raw(vnote(462, ZT + 236, 'relay', 20, '#b91c1c', 700))
# 4 accounts: permissions, not data
s.f(4)
s.raw(server(64, ZI + 52, 0.6, None))
s.raw(T(100, ZI + 166, 'Account', 21, 700, '#334155', 'middle'))
s.arrow([(144, ZI + 94), (412, ZI + 94)], 'admin', 'who may fetch', at=(278, ZI + 80))
s.arrow([(100, ZI + 176), (100, ZI + 200), (262, ZI + 200)], 'admin', 'sharing', at=(100, ZI + 236))
s.raw(vchip(343, ZI + 252, 'Modules 5–6 · Scenes 31–49'))
# 5 bands
s.f(5)
B1, B2 = 902, 1018
s.raw(f'<rect x="40" y="{B1}" width="640" height="108" rx="14" fill="#f5f3ff" stroke="#c4b5fd" stroke-width="2"/>')
s.raw(lock(56, B1 + 10, 0.62, '#7c3aed'))
s.raw(T(100, B1 + 36, 'Cryptography', 24, 800, '#5b21b6'))
s.raw(vchip(470, B1 + 12, 'Modules 6, 8–10'))
s.raw(T(56, B1 + 72, 'Card cryptograms, rotating keys, sealed reports, signed\nfirmware — and the move to post-quantum algorithms.', 20, 400, '#334155'))
s.raw(f'<rect x="40" y="{B2}" width="640" height="108" rx="14" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(shield(58, B2 + 10, 0.5, '#334155'))
s.raw(T(100, B2 + 36, 'Privacy and governance', 24, 800, '#14213d'))
s.raw(vchip(456, B2 + 12, 'Modules 7 and 11'))
s.raw(T(56, B2 + 72, 'Consent, alerts for the person a tag travels with, account\nhygiene, policy and who is accountable.', 20, 400, '#334155'))
scenes[85] = s.render(None)


# ── 86 Three journeys ───────────────────────────────────────────────
def vpanel(x, y, w, h, color, n, title, sub):
    c, light, border = STEP[color]
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="18" fill="{light}" stroke="{border}" stroke-width="2"/>'
            + badge(x + 38, y + 40, n, color, 22)
            + T(x + 72, y + 48, title, 24, 800, '#14213d')
            + T(x + 72, y + 78, sub, 20, 600, c))


def vrows(x, y, w, rows, color):
    """The four fact rows of a column, each wrapped at spaces; returns (svg, bottom)."""
    from .svgkit import wrap
    out = ''
    for i, line in enumerate(rows):
        ls = wrap(line, 27)
        h = 14 + 24 * len(ls)
        out += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="#ffffff" stroke="{STEP[color][2]}" stroke-width="1.5"/>'
        out += T(x + 12, y + 26, '\n'.join(ls), 20, 600 if i == 0 else 400, '#14213d').replace('dy="26"', 'dy="24"')
        y += h + 6
    return out, y


s = VScene(86, 'Three journeys, three different kinds of “wave”',
           'Four frames compare three journeys. 1, energy harvested: a reader’s alternating magnetic field '
           'induces a current in a card’s coil a few centimetres away; physical energy moves. 2, a signal overheard: a tag '
           'radiates a short radio packet that any phone in range can receive without pairing; physical radio waves carry '
           'bits over metres. 3, amplitudes interfering: in H then Z then H, computed amplitudes go from 1 and 0, to 0.707 and '
           '0.707, to 0.707 and −0.707, to 0 and 1; nothing ripples, the arithmetic of complex amplitudes adds and cancels. '
           '4, a banner: induction, radio emission and quantum amplitude arithmetic share a vocabulary, not a mechanism.',
           sub='Same word, three mechanisms: what is physical, and what is mathematics.', h=1700)
PY = {'orange': 0, 'blue': 386, 'purple': 772}
PH = {'orange': 374, 'blue': 374, 'purple': 396}
for fr, (_, col, title, mech) in enumerate(COLS86, start=1):
    s.f(fr)
    y = PY[col]
    s.raw(vpanel(40, y, 640, PH[col], col, fr, title, mech))
    c = STEP[col][0]
    rows, _ = vrows(56, y + 96, 320, ROWS86[col], col)
    s.raw(rows)
    if col == 'orange':
        s.raw(vterminal(388, y + 22, 0.5))
        for r in (14, 28, 42):
            s.raw(f'<path d="M518,{y + 188 - r} A{r},{r} 0 0 1 518,{y + 188 + r}" class="field"/>')
        s.arrow([(524, y + 188), (548, y + 188)], 'energy')
        s.raw(vcard(552, y + 152, 116, number=None))
        s.raw(vnote(392, y + 270, 'field arcs: illustrative', 20, '#475569'))
    elif col == 'blue':
        s.raw(tag(436, y + 200, 34))
        s.raw(waves(474, y + 200, 3, '#2563eb', 1.0))
        s.raw(phone(590, y + 130, 70, 134, '#e0f2fe'))
        s.arrow([(530, y + 200), (582, y + 200)], 'signal')
        s.raw(vnote(400, y + 300, 'radio arcs: illustrative', 20, '#475569'))
    else:
        labels = ['start', 'after H', 'after Z', 'after H']
        zero, k_ = 500, 64
        for k, amps in enumerate(AMPS):
            by = y + 74 + k * 70
            s.raw(T(400, by, labels[k], 20, 700, '#334155'))
            s.raw(f'<path d="M{zero},{by + 6} V{by + 56}" stroke="#94a3b8" stroke-width="1.5"/>')
            for j, a in enumerate(amps):
                ry = by + 8 + j * 24
                x0 = zero if a >= 0 else zero + a * k_
                s.raw(f'<rect x="{x0:.1f}" y="{ry}" width="{max(1.5, abs(a) * k_):.1f}" height="18" rx="3" fill="{c if a >= 0 else "#be185d"}"/>')
                s.raw(T(424, ry + 16, f'|{j}⟩', 20, 400, '#475569', 'middle'))
                s.raw(T(664, ry + 16, fmt(a), 20, 700, '#334155', 'end'))
        s.raw(vnote(400, y + 360, 'computed amplitudes;', 20, '#475569'))
        s.raw(vnote(400, y + 384, 'P = amplitude²', 20, '#475569'))
s.f(4)
s.raw('<rect x="40" y="1180" width="640" height="74" rx="12" fill="#14213d"/>')
s.raw(T(360, 1210, 'Induction, radio emission and quantum amplitudes\nshare the word “wave” — not a mechanism.', 20, 700, '#ffffff', 'middle'))
scenes[86] = s.render(None)


# ── 87 What is observable ───────────────────────────────────────────
# The 8 x 6 table becomes eight observer cards; the six columns are keyed by numbered
# discs (the white digits repeat; every word appears exactly as often as in the table).
s = VScene(87, 'What is observable, by whom',
           'Four frames fill one table: eight observers against six things that could be observed. 1, a tap and a radio '
           'listener: a card reader sees the card number of a plastic card; an NFC phone touching a tag sees only what the '
           'owner chose to show; a radio listener sees only the rotating identifier. 2, a passer-by’s phone sees the identifier, '
           'its own location and the report it seals; the relay sees a lookup hash, the sealed report and metadata, never the '
           'location. 3, the owner decrypts the location; someone who planted a tag sees exactly what an owner sees — the '
           'location of the person carrying it. 4, an organisation’s admin: unknown, it depends on what is enrolled and '
           'shared; an outside attacker without the account sees only what a radio listener sees, unless they take over the '
           'account. Unknown is marked as a finding, not left blank.',
           sub='Same tag, eight observers. Unknown is a finding, not a blank.', h=1664)
s.raw('<rect x="40" y="0" width="640" height="122" rx="10" fill="#f1f5f9"/>')
s.raw(T(56, 34, 'Observer', 22, 800, '#14213d'))
for i, c in enumerate(COLS87):
    kx, ky = 186 + (i % 2) * 250, 34 + (i // 2) * 34
    s.raw(badge(kx, ky - 7, i + 1, 'slate', 13))
    s.raw(T(kx + 20, ky, c, 20, 800, '#14213d'))
for r, (fr, who, cells, hz) in enumerate(ROWS87):
    s.f(fr)
    y = 132 + r * 104
    if hz:
        s.rect(40, y, 640, 100, 'hz', rx=8)
    else:
        s.raw(f'<rect x="40" y="{y}" width="640" height="100" rx="8" fill="{"#ffffff" if r % 2 else "#fbfaf7"}" stroke="#e5e7eb" stroke-width="1"/>')
    s.raw(T(56, y + 30, who, 22, 700, '#14213d'))
    for i, (k, txt) in enumerate(cells):
        col, mark = ST87[k]
        cx, cy = 56 + (i % 3) * 210, y + 60 + (i // 3) * 30
        s.raw(badge(cx + 12, cy - 7, i + 1, 'slate', 12))
        s.raw(T(cx + 30, cy, mark + txt, 20, 700 if k == 'yes' else 400, col))
s.f(4)
from .svgkit import wrap as _wrap
NOTES87 = [
    ('* unless they take over the owner’s account (Scene 48) — then they see what the owner sees.', 600, '#991b1b'),
    ('● yes ○ no ≈ metadata or partial ? unknown: depends on what an organisation enrols and shares — not involved', 400, '#475569'),
    ('Tracker rows follow Apple’s documented Find My design and agree with Scene 46 and demo D. A plastic card sends its number; '
     'a phone wallet sends a device token instead (Scene 16).', 400, '#475569'),
]
y = 1004
for text, wt, col in NOTES87:
    ls = _wrap(text, 56)
    s.raw(T(40, y, '\n'.join(ls), 20, wt, col))
    y += 26 * len(ls) + 12
scenes[87] = s.render(None)


# ── 88 What quantum does not fix ────────────────────────────────────
from .module12 import PROB


def wrapped(text, n):
    return '\n'.join(_wrap(text.replace('\n', ' '), n))


s = VScene(88, 'What post-quantum cryptography does not fix',
           'Five frames. 1, a passer-by’s phone sends a sealed report to the relay through a pipe protected by post-quantum '
           'key exchange and signatures: this protects the content against a future quantum computer. 2, consent: a tag hidden '
           'in someone else’s bag still reports the carrier’s location to the account holder. 3, coercion: someone pressured '
           'into sharing their location is still located. 4, phishing and account takeover, and stale shares or careless admin '
           'access: whoever gets into the account sees what the owner sees. 5, what helps instead: alerts to the person a tag '
           'travels with, sharing reviews, strong sign-in, policy and support; and a safety note that disabling a tracker can '
           'alert whoever placed it.',
           sub='Stronger locks protect the message. They cannot decide who should be allowed to read it.',
           note='Agrees with demo K: encryption decides who else can read, never who agreed.', h=1700)
s.f(1)
s.raw(phone(56, 8, 70, 134, '#e0f2fe'))
s.raw(vnote(40, 170, 'passer-by’s phone', 20, '#475569', 600))
s.raw(cloud(470, 14, 190, None))
s.raw(T(565, 96, 'Relay', 21, 700, '#14213d', 'middle'))
s.arrow([(134, 72), (464, 68)], 'crypto', 'sealed report, post-quantum', at=(300, 40))
s.raw(lock(276, 86, 0.9, '#7c3aed'))
s.raw(callout(40, 188, 640, 162, 'What it fixes', wrapped(
    'Key exchange and signatures that a future large, fault-tolerant quantum\ncomputer could otherwise attack '
    '(ML-KEM, ML-DSA, SLH-DSA; Modules 9–10).\nNothing here is broken today.', 56), 'purple', 1, 26, 20))
for i, (fr, _, title, body) in enumerate(PROB):
    s.f(fr)
    x, y = 40 + (i % 2) * 326, 362 + (i // 2) * 236
    s.rect(x, y, 314, 226, 'hz', rx=14)
    s.raw(badge(x + 30, y + 34, i + 2, 'red', 18))
    s.raw(T(x + 58, y + 42, title, 22, 800, '#991b1b'))
    s.raw(T(x + 16, y + 80, wrapped(body, 26), 20, 400, '#334155'))
    s.raw(T(x + 16, y + 186, 'unchanged by post-quantum\ncrypto', 20, 700, '#b91c1c'))
s.f(5)
s.raw(callout(40, 846, 640, 192, 'What helps instead', wrapped(
    'Alerts on the carrier’s own phone and a sound from separated tags · sharing reviews such as Safety Check · '
    'passkeys or security keys\nand two-factor sign-in · least-privilege admin access · a written policy · '
    'people and support services (Modules 7 and 11).', 56), 'green', 6, 26, 20))
s.raw('<rect x="40" y="1050" width="640" height="140" rx="12" fill="#fef2f2" stroke="#fca5a5" stroke-width="2"/>')
s.raw(T(58, 1082, wrapped('Safety first. If a tracker may be following you, disabling it can alert whoever placed it.', 50), 21, 800, '#7f1d1d'))
s.raw(T(58, 1144, wrapped('Use the platform’s safety guide, someone you trust or a support service to decide when and whether.', 56), 20, 400, '#7f1d1d'))
scenes[88] = s.render()


# ── 89 System lifecycle ─────────────────────────────────────────────
s = VScene(89, 'The life of a tag: a guardrail and a safety check at every stage',
           'Four frames. 1, seven stages in order: issue and provision, register, discover, locate, share, revoke, '
           'retire. 2, a security guardrail for each stage: keys made in secure hardware and signed firmware; one account '
           'with two-factor sign-in; rotating identifiers and no pairing to overhear; end-to-end encrypted reports opened only '
           'on the owner’s devices; explicit, limited invitations; stopping sharing and removing devices; removing the tag '
           'from the account before it changes hands. 3, a human-safety checkpoint for each: alerts on by design; a tag '
           'linked to someone else cannot be quietly added; separated tags become detectable; people carrying an unknown tag '
           'can be alerted and can read its serial number; review who can see you; plan before changing sharing, because it '
           'can alert an abuser; treat a second-hand tag still linked to someone as a warning sign. 4, a closing note that '
           'disabling a tracker can alert whoever placed it.',
           sub='Seven stages. At each one, something protects the data and something protects the person.', h=1698)
# the seven stages run top to bottom; each row holds the stage, its guardrail and its safety check
for i, (name, sub) in enumerate(STAGES):
    y = i * 138
    s.f(1)
    s.raw(f'<rect x="40" y="{y}" width="150" height="124" rx="14" fill="#eff6ff" stroke="#93c5fd" stroke-width="2"/>')
    s.raw(badge(64, y + 30, i + 1, 'blue', 16))
    s.raw(T(86, y + 38, name, 22, 800, '#14213d'))
    s.raw(T(54, y + 72, wrapped(sub, 11), 20, 400, '#475569').replace('dy="26"', 'dy="24"'))
    if i < len(STAGES) - 1:
        s.raw(f'<path d="M115,{y + 127} l0,8 m-6,-5 l6,6 l6,-6" fill="none" stroke="#64748b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>')
    s.f(2)
    s.raw(f'<rect x="198" y="{y}" width="238" height="124" rx="14" fill="#f5f3ff" stroke="#c4b5fd" stroke-width="2"/>')
    s.raw(lock(210, y + 10, 0.45, '#7c3aed'))
    s.raw(T(242, y + 34, 'Guardrail', 20, 800, '#5b21b6'))
    s.raw(T(212, y + 62, GUARD[i], 20, 400, '#334155').replace('dy="26"', 'dy="24"'))
    s.f(3)
    s.raw(f'<rect x="444" y="{y}" width="236" height="124" rx="14" fill="#f0fdf4" stroke="#86efac" stroke-width="2"/>')
    s.raw(shield(456, y + 10, 0.36, '#16a34a'))
    s.raw(T(486, y + 34, 'Safety check', 20, 800, '#166534'))
    s.raw(T(458, y + 62, SAFE[i], 20, 400, '#334155').replace('dy="26"', 'dy="24"'))
s.f(4)
s.raw('<rect x="40" y="978" width="640" height="224" rx="12" fill="#fef2f2" stroke="#fca5a5" stroke-width="2"/>')
s.raw(T(58, 1012, wrapped('Safety first. Disabling a tracker can alert whoever placed it, and so can changing who it is shared with.', 48), 21, 800, '#7f1d1d').replace('dy="27"', 'dy="28"'))
s.raw(T(58, 1110, wrapped('Decide with someone you trust, a support service or the platform’s safety guide. Steps here follow '
                          'Apple’s documented design; other ecosystems differ in detail (Scene 47).', 55), 20, 400, '#7f1d1d'))
scenes[89] = s.render(None)
