"""Module 12 scenes (85–89): the holistic architecture — the lesson's finale.
Run scripts/invisible_engine/build.py to write the SVGs.

These scenes gather objects drawn earlier in the lesson (terminal and card, tag, finder
phone, relay, owner phone, account, padlock, amplitude bars) and put each in its own
physical and protocol layer. Rules that matter most here: NFC never links directly to a
faraway cloud event (Lost Mode is a separate, touch-range path); scene 87 agrees with
demo D (invisible-engine/demos/lost.json) and scene 46; scene 88 agrees with demo K;
amplitudes in scene 86 are computed, not typed; nothing is described as already broken
by a quantum computer.
"""
import math

from .svgkit import Scene
from .art import *

scenes = {}

SQ2 = 1 / math.sqrt(2)


def zone(x, y, w, h, title, sub, color='#f8fafc', border='#cbd5e1'):
    """A light layer panel with a mono heading."""
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="{color}" stroke="{border}" stroke-width="2"/>'
            + T(x + 18, y + 30, title, 15, 700, '#1d4ed8', mono=True)
            + T(x + 18, y + 54, sub, 14.5, 400, '#475569'))


def note(x, y, text, size=14.5, color='#334155', weight=400):
    return T(x, y, text, size, weight, color)


def link_chip(x, y, text):
    """A small grey chip naming where a layer is taught ('Module 2 · Scene 15')."""
    w = len(text) * 7.6 + 18
    return (f'<rect x="{x}" y="{y}" width="{w:.0f}" height="24" rx="12" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5"/>'
            + T(x + w / 2, y + 17, text, 12.5, 600, '#475569', 'middle', mono=True))


# ── 85 Master map ───────────────────────────────────────────────────
s = Scene(85, 'The whole engine on one map',
          'Five frames build one map in three zones by distance: touch (centimetres), radio (metres) and the internet '
          '(anywhere), over two bands for cryptography and governance. 1, in the touch zone a payment terminal powers a '
          'card through its field and the two exchange commands and replies. 2, in the radio zone a small tag broadcasts a '
          'rotating key, a passer-by’s phone overhears it and sends a sealed report over the internet to a relay, which '
          'stores it without being able to read it; the owner’s phone fetches and opens it. 3, the owner standing nearby '
          'measures distance and direction to the tag with ultra-wideband, and a finder who touches the tag with an NFC '
          'phone sees a web page, not a location; NFC never reaches the relay. 4, the account service links the tag to one '
          'owner and decides who may fetch reports or share; these are permissions, not data. 5, two bands under the map: '
          'cryptography and its move to post-quantum algorithms, and privacy and governance.',
          sub='Each technology in its own layer. Nothing touches the cloud by NFC; nothing finds a tag by satellite.')
s.raw(zone(60, 160, 400, 420, 'TOUCH · centimetres', 'NFC: power and data by near field'))
s.raw(zone(480, 160, 520, 420, 'RADIO · metres', 'Bluetooth LE and ultra-wideband'))
s.raw(zone(1020, 160, 520, 420, 'INTERNET · anywhere', 'reports, accounts and relays'))
# 1 touch: terminal powers card
s.f(1)
s.raw(terminal(84, 226, 0.45))
s.raw(card(256, 244, 160, number='•••• 1234'))
s.arrow([(206, 282), (250, 282)], 'energy')
s.biarrow([(206, 318), (250, 318)], 'signal')
s.raw(note(256, 370, 'field powers the chip;', 13.5, '#9a3412', 600))
s.raw(note(256, 390, 'commands ⇄ replies', 13.5, '#1d4ed8', 600))
s.raw(link_chip(80, 540, 'Module 2 · Scenes 09–17'))
# 2 radio + internet: the finding network
s.f(2)
s.raw(tag(560, 440, 34))
s.raw(note(500, 516, 'tag: no GPS, no SIM', 13.5, '#475569', 600))
s.raw(phone(720, 230, 84, 160, '#e0f2fe'))
s.raw(note(700, 412, 'a passer-by’s phone', 13.5, '#475569', 600))
s.arrow([(592, 426), (714, 340)], 'signal', 'rotating key', at=(600, 330))
s.raw(cloud(1060, 258, 190, 'Relay'))
s.rect(1046, 246, 218, 134, 'bound', rx=14)
s.raw(note(1052, 400, 'stores, cannot read', 13.5, '#14213d', 700))
s.arrow([(808, 290), (1040, 300)], 'crypto', 'sealed report', at=(920, 268))
s.raw(phone(1310, 390, 84, 160, '#f5f3ff'))
s.raw(lock(1328, 446, 0.95, '#7c3aed'))
s.raw(note(1296, 572 - 10, 'owner, far away', 13.5, '#475569', 600))
s.arrow([(1200, 384), (1304, 470)], 'crypto', 'fetched, opened', at=(1170, 452))
s.raw(link_chip(500, 540, 'Modules 4–5 · Scenes 23–41'))
# 3 nearby UWB + NFC Lost Mode
s.f(3)
s.raw(phone(860, 410, 70, 130, '#ecfdf5'))
s.raw(note(818, 562 - 6, 'owner, nearby', 13.5, '#475569', 600))
s.biarrow([(598, 452), (852, 470)], 'signal', 'UWB: distance + direction', at=(720, 488))
s.raw(phone(92, 432, 48, 90, '#ffffff'))
s.raw(tag(166, 478, 22))
s.raw(note(200, 462, 'NFC tap: a web page,', 13.5, '#334155', 600))
s.raw(note(200, 482, 'not a location;', 13.5, '#334155', 600))
s.raw(note(200, 506, 'never reaches the relay', 13.5, '#b91c1c', 700))
# 4 accounts: permissions, not data
s.f(4)
s.raw(server(1410, 230, 0.75, 'Account'))
s.arrow([(1404, 290), (1272, 290)], 'admin', 'who may fetch', at=(1336, 330))
s.arrow([(1456, 372), (1456, 470), (1400, 470)], 'admin', 'sharing', at=(1468, 520))
s.raw(link_chip(1040, 540, 'Modules 5–6 · Scenes 31–49'))
# 5 bands
s.f(5)
s.raw('<rect x="60" y="600" width="1480" height="96" rx="14" fill="#f5f3ff" stroke="#c4b5fd" stroke-width="2"/>')
s.raw(lock(84, 616, 0.9, '#7c3aed'))
s.raw(T(150, 640, 'Cryptography', 20, 800, '#5b21b6'))
s.raw(T(150, 668, 'Card cryptograms, rotating keys, sealed reports, signed firmware — and the move to post-quantum algorithms.', 15.5, 400, '#334155'))
s.raw(link_chip(1290, 616, 'Modules 6, 8–10'))
s.raw('<rect x="60" y="712" width="1480" height="96" rx="14" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(shield(86, 724, 0.9, '#334155'))
s.raw(T(150, 752, 'Privacy and governance', 20, 800, '#14213d'))
s.raw(T(150, 780, 'Consent, alerts for the person a tag travels with, account hygiene, policy and who is accountable.', 15.5, 400, '#334155'))
s.raw(link_chip(1290, 728, 'Modules 7 and 11'))
scenes[85] = s.render(None)

# ── 86 Three journeys ───────────────────────────────────────────────
def hzh_amplitudes():
    """Amplitudes after each gate of H → Z → H on |0⟩ (computed)."""
    H = [[SQ2, SQ2], [SQ2, -SQ2]]
    Z = [[1, 0], [0, -1]]
    st = [1.0, 0.0]
    out = [list(st)]
    for g in (H, Z, H):
        st = [g[0][0] * st[0] + g[0][1] * st[1], g[1][0] * st[0] + g[1][1] * st[1]]
        out.append([0.0 if abs(v) < 1e-12 else v for v in st])
    return out


def fmt(v):
    s_ = f'{v:.3f}'.rstrip('0').rstrip('.')
    return '0' if s_ in ('-0', '0', '') else s_.replace('-', '−')


AMPS = hzh_amplitudes()

s = Scene(86, 'Three journeys, three different kinds of “wave”',
          'Four frames compare three journeys side by side. 1, energy harvested: a reader’s alternating magnetic field '
          'induces a current in a card’s coil a few centimetres away; physical energy moves. 2, a signal overheard: a tag '
          'radiates a short radio packet that any phone in range can receive without pairing; physical radio waves carry '
          'bits over metres. 3, amplitudes interfering: in H then Z then H, computed amplitudes go from 1 and 0, to 0.707 and '
          '0.707, to 0.707 and −0.707, to 0 and 1; nothing ripples, the arithmetic of complex amplitudes adds and cancels. '
          '4, a banner: induction, radio emission and quantum amplitude arithmetic share a vocabulary, not a mechanism.',
          sub='Same word, three mechanisms: what is physical, and what is mathematics.')
COLS86 = [
    (60, 'orange', 'A · Energy harvested', 'Induction (near field)'),
    (560, 'blue', 'B · Signal overheard', 'Radio emission (far field)'),
    (1060, 'purple', 'C · Amplitudes interfere', 'Arithmetic of amplitudes'),
]
ROWS86 = {
    'orange': ['What moves: energy, through a magnetic field', 'Physical: yes — a real field, real current',
               'Distance: a few centimetres', 'Not: a broadcast, or a battery'],
    'blue': ['What moves: bits, on 2.4 GHz radio waves', 'Physical: yes — real electromagnetic waves',
             'Distance: metres to tens of metres', 'Not: a connection; nobody pairs'],
    'purple': ['What moves: numbers that set probabilities', 'Physical: the qubit is; the “wave” is maths',
               'Distance: inside one processor', 'Not: tiny ripples, or every answer at once'],
}
for fr, (x, col, title, mech) in enumerate(COLS86, start=1):
    s.f(fr)
    s.raw(panel(x, 160, 480, 600, col, fr, title, mech, 22))
    c = STEP[col][0]
    if col == 'orange':
        s.raw(terminal(96, 290, 0.5))
        s.raw(card(336, 340, 170, number=''))
        for r in (26, 50, 74):
            s.raw(f'<path d="M234,{395 - r} A{r},{r} 0 0 1 234,{395 + r}" class="field"/>')
        s.arrow([(270, 395), (330, 395)], 'energy')
        s.raw(note(336, 482, 'field arcs: illustrative', 13, '#475569'))
    elif col == 'blue':
        s.raw(tag(640, 400, 38))
        s.raw(waves(684, 400, 3, '#2563eb', 1.2))
        s.raw(phone(880, 300, 90, 170, '#e0f2fe'))
        s.arrow([(760, 400), (872, 400)], 'signal')
        s.raw(note(620, 470, 'radio arcs: illustrative', 13, '#475569'))
    else:
        labels = ['start', 'after H', 'after Z', 'after H']
        for k, amps in enumerate(AMPS):
            bx = 1090 + k * 112
            s.raw(T(bx + 40, 282, labels[k], 13.5, 700, '#334155', 'middle'))
            s.raw(f'<path d="M{bx},{390} H{bx + 84}" stroke="#94a3b8" stroke-width="1.5"/>')
            for j, a in enumerate(amps):
                hgt = a * 70
                y0 = 390 - hgt if hgt >= 0 else 390
                s.raw(f'<rect x="{bx + 8 + j * 40}" y="{y0:.1f}" width="30" height="{max(1.5, abs(hgt)):.1f}" rx="3" fill="{c if a >= 0 else "#be185d"}"/>')
                s.raw(T(bx + 23 + j * 40, 390 - hgt - 6 if hgt >= 0 else 390 - hgt + 16, fmt(a), 12, 700, '#334155', 'middle'))
                s.raw(T(bx + 23 + j * 40, 486, f'|{j}⟩', 12.5, 400, '#475569', 'middle'))
        s.raw(note(1090, 516, 'computed amplitudes; P = amplitude²', 13, '#475569'))
    for i, line in enumerate(ROWS86[col]):
        y = 560 + i * 46
        s.raw(f'<rect x="{x + 20}" y="{y}" width="440" height="38" rx="8" fill="#ffffff" stroke="{STEP[col][2]}" stroke-width="1.5"/>')
        s.raw(T(x + 34, y + 25, line, 15, 600 if i == 0 else 400, '#14213d'))
s.f(4)
s.raw('<rect x="60" y="772" width="1480" height="48" rx="12" fill="#14213d"/>')
s.raw(T(800, 803, 'Induction, radio emission and quantum amplitudes share the word “wave” — not a mechanism.', 17, 700, '#ffffff', 'middle'))
scenes[86] = s.render(None)

# ── 87 What is observable ───────────────────────────────────────────
s = Scene(87, 'What is observable, by whom',
          'Four frames fill one table: eight observers against six things that could be observed. 1, a tap and a radio '
          'listener: a card reader sees the card number of a plastic card; an NFC phone touching a tag sees only what the '
          'owner chose to show; a radio listener sees only the rotating identifier. 2, a passer-by’s phone sees the identifier, '
          'its own location and the report it seals; the relay sees a lookup hash, the sealed report and metadata, never the '
          'location. 3, the owner decrypts the location; someone who planted a tag sees exactly what an owner sees — the '
          'location of the person carrying it. 4, an organisation’s admin: unknown, it depends on what is enrolled and '
          'shared; an outside attacker without the account sees only what a radio listener sees, unless they take over the '
          'account. Unknown is marked as a finding, not left blank.',
          sub='Same tag, eight observers. Unknown is a finding, not a blank.')
COLS87 = ['Card number', 'Rotating ID', 'Approx. location', 'Who owns it', 'Sealed report', 'Service metadata']
CX0, CW, LW = 60, 200, 280
s.raw(f'<rect x="{CX0}" y="160" width="{LW + CW * 6}" height="52" rx="10" fill="#f1f5f9"/>')
s.raw(T(CX0 + 16, 193, 'Observer', 16, 800, '#14213d'))
for i, c in enumerate(COLS87):
    s.raw(T(CX0 + LW + CW * i + CW / 2, 193, c, 15, 800, '#14213d', 'middle'))
ST87 = {'yes': ('#166534', '● '), 'no': ('#4b5563', '○ '), 'meta': ('#92400e', '≈ '), 'unk': ('#374151', '? '), 'na': ('#94a3b8', '')}
ROWS87 = [
    (1, 'A tap (reader or NFC phone)', [('yes', 'card reader'), ('no', 'no'), ('no', 'no'), ('meta', 'owner’s choice'), ('no', 'no'), ('no', 'no')], False),
    (1, 'Radio listener', [('na', '—'), ('yes', 'hears it'), ('no', 'no'), ('no', 'no'), ('no', 'no'), ('no', 'no')], False),
    (2, 'Passer-by’s phone', [('na', '—'), ('yes', 'hears it'), ('yes', 'its own'), ('no', 'no'), ('yes', 'seals it'), ('yes', 'its uploads')], False),
    (2, 'Relay service', [('na', '—'), ('meta', 'hash only'), ('no', 'no'), ('meta', 'who asks'), ('yes', 'stores it'), ('yes', 'yes')], False),
    (3, 'The owner', [('na', '—'), ('yes', 'derives it'), ('yes', 'decrypts'), ('yes', 'themself'), ('yes', 'fetches'), ('yes', 'own account')], False),
    (3, 'Someone who planted a tag', [('na', '—'), ('yes', 'derives it'), ('yes', 'the carrier’s'), ('yes', 'themself'), ('yes', 'fetches'), ('yes', 'own account')], True),
    (4, 'An organisation’s admin', [('na', '—'), ('unk', 'unknown'), ('unk', 'unknown'), ('unk', 'unknown'), ('no', 'no'), ('unk', 'unknown')], False),
    (4, 'Outside attacker', [('na', '—'), ('yes', 'if nearby'), ('no', 'no*'), ('no', 'no*'), ('no', 'no*'), ('no', 'no')], False),
]
for r, (fr, who, cells, hz) in enumerate(ROWS87):
    s.f(fr)
    y = 218 + r * 60
    if hz:
        s.rect(CX0, y, LW + CW * 6, 54, 'hz', rx=8)
    else:
        s.raw(f'<rect x="{CX0}" y="{y}" width="{LW + CW * 6}" height="54" rx="8" fill="{"#ffffff" if r % 2 else "#fbfaf7"}" stroke="#e5e7eb" stroke-width="1"/>')
    s.raw(T(CX0 + 16, y + 34, who, 15.5, 700, '#14213d'))
    for i, (k, txt) in enumerate(cells):
        col, mark = ST87[k]
        s.raw(T(CX0 + LW + CW * i + CW / 2, y + 34, mark + txt, 15, 700 if k == 'yes' else 400, col, 'middle'))
s.f(4)
s.raw(T(60, 718, '* unless they take over the owner’s account (Scene 48) — then they see what the owner sees.', 15, 600, '#991b1b'))
s.raw(T(60, 746, '● yes   ○ no   ≈ metadata or partial   ? unknown: depends on what an organisation enrols and shares   — not involved', 15, 400, '#475569'))
s.raw(T(60, 774, 'Tracker rows follow Apple’s documented Find My design and agree with Scene 46 and demo D. A plastic card sends its number;', 15, 400, '#475569'))
s.raw(T(60, 796, 'a phone wallet sends a device token instead (Scene 16).', 15, 400, '#475569'))
scenes[87] = s.render(None)

# ── 88 What quantum does not fix ────────────────────────────────────
s = Scene(88, 'What post-quantum cryptography does not fix',
          'Five frames. 1, a passer-by’s phone sends a sealed report to the relay through a pipe protected by post-quantum '
          'key exchange and signatures: this protects the content against a future quantum computer. 2, consent: a tag hidden '
          'in someone else’s bag still reports the carrier’s location to the account holder. 3, coercion: someone pressured '
          'into sharing their location is still located. 4, phishing and account takeover, and stale shares or careless admin '
          'access: whoever gets into the account sees what the owner sees. 5, what helps instead: alerts to the person a tag '
          'travels with, sharing reviews, strong sign-in, policy and support; and a safety note that disabling a tracker can '
          'alert whoever placed it.',
          sub='Stronger locks protect the message. They cannot decide who should be allowed to read it.')
s.f(1)
s.raw(phone(80, 200, 80, 150, '#e0f2fe'))
s.raw(note(64, 372, 'passer-by’s phone', 13.5, '#475569', 600))
s.raw(cloud(520, 196, 170, 'Relay'))
s.arrow([(170, 270), (512, 260)], 'crypto', 'sealed report, post-quantum', at=(340, 234))
s.raw(lock(310, 286, 1.0, '#7c3aed'))
s.raw(callout(720, 180, 820, 150, 'What it fixes', 'Key exchange and signatures that a future large, fault-tolerant quantum\n'
              'computer could otherwise attack (ML-KEM, ML-DSA, SLH-DSA; Modules 9–10).\nNothing here is broken today.', 'purple', 1, 20, 16))
PROB = [
    (2, 60, 'Consent', 'A tag hidden in someone’s bag:\nthe account holder still sees\nthe carrier’s location.'),
    (3, 440, 'Coercion', 'Someone pressured into sharing\nis located just the same.\nThe maths cannot see pressure.'),
    (4, 820, 'Phishing, takeover', 'A fake sign-in page hands over\nthe account; the attacker then\nsees what the owner sees.'),
    (4, 1200, 'Stale access', 'Old shares, forgotten devices,\nan admin who sees too much:\npermission, not encryption.'),
]
for i, (fr, x, title, body) in enumerate(PROB):
    s.f(fr)
    s.rect(x, 380, 340, 200, 'hz', rx=14)
    s.raw(badge(x + 34, 418, i + 2, 'red', 20))
    s.raw(T(x + 66, 426, title, 21, 800, '#991b1b'))
    s.raw(T(x + 24, 468, body, 16, 400, '#334155'))
    s.raw(T(x + 24, 560, 'unchanged by post-quantum crypto', 13.5, 700, '#b91c1c'))
s.f(5)
s.raw(callout(60, 600, 1480, 112, 'What helps instead',
              'Alerts on the carrier’s own phone and a sound from separated tags · sharing reviews such as Safety Check · '
              'passkeys or security keys\nand two-factor sign-in · least-privilege admin access · a written policy · '
              'people and support services (Modules 7 and 11).', 'green', 6, 20, 16))
s.raw('<rect x="60" y="726" width="1480" height="82" rx="12" fill="#fef2f2" stroke="#fca5a5" stroke-width="2"/>')
s.raw(T(84, 760, 'Safety first. If a tracker may be following you, disabling it can alert whoever placed it.', 17, 800, '#7f1d1d'))
s.raw(T(84, 788, 'Use the platform’s safety guide, someone you trust or a support service to decide when and whether.', 15.5, 400, '#7f1d1d'))
scenes[88] = s.render('Agrees with demo K: encryption decides who else can read, never who agreed.')

# ── 89 System lifecycle ─────────────────────────────────────────────
s = Scene(89, 'The life of a tag: a guardrail and a safety check at every stage',
          'Four frames. 1, seven stages from left to right: issue and provision, register, discover, locate, share, revoke, '
          'retire. 2, a security guardrail under each stage: keys made in secure hardware and signed firmware; one account '
          'with two-factor sign-in; rotating identifiers and no pairing to overhear; end-to-end encrypted reports opened only '
          'on the owner’s devices; explicit, limited invitations; stopping sharing and removing devices; removing the tag '
          'from the account before it changes hands. 3, a human-safety checkpoint under each: alerts on by design; a tag '
          'linked to someone else cannot be quietly added; separated tags become detectable; people carrying an unknown tag '
          'can be alerted and can read its serial number; review who can see you; plan before changing sharing, because it '
          'can alert an abuser; treat a second-hand tag still linked to someone as a warning sign. 4, a closing note that '
          'disabling a tracker can alert whoever placed it.',
          sub='Seven stages. At each one, something protects the data and something protects the person.')
STAGES = [
    ('Issue', 'and provision'), ('Register', 'to one account'), ('Discover', 'nearby or crowd'), ('Locate', 'a sealed report'),
    ('Share', 'with chosen people'), ('Revoke', 'access or devices'), ('Retire', 'or hand on'),
]
GUARD = [
    'keys made in secure\nhardware; firmware\nsigned', 'one account;\ntwo-factor\nsign-in', 'rotating IDs;\nno pairing\nto overhear',
    'end-to-end\nencrypted; opened\non owner’s devices', 'explicit invite;\nlimited people\n(Apple: five)', 'stop sharing;\nremove devices;\nrotate passwords',
    'remove from the\naccount before it\nchanges hands',
]
SAFE = [
    'alerts for strangers\nare part of the\ndesign', 'someone else’s tag\ncannot be quietly\nadded', 'separated tags\nbecome detectable:\nalerts, sound',
    'a carrier can be\nalerted; NFC tap\nshows the serial', 'review who can\nsee you (e.g.\nSafety Check)', 'plan first: changes\ncan alert an\nabuser',
    'a used tag still\nlinked to someone\nis a warning sign',
]
W, G0 = 196, 60
for i, (name, sub) in enumerate(STAGES):
    x = G0 + i * (W + 18)
    s.f(1)
    s.raw(f'<rect x="{x}" y="166" width="{W}" height="110" rx="14" fill="#eff6ff" stroke="#93c5fd" stroke-width="2"/>')
    s.raw(badge(x + 28, 196, i + 1, 'blue', 17))
    s.raw(T(x + 54, 204, name, 20, 800, '#14213d'))
    s.raw(T(x + 16, 246, sub, 14.5, 400, '#475569'))
    if i < len(STAGES) - 1:
        s.raw(f'<path d="M{x + W + 3},221 l12,0 m-6,-7 l7,7 l-7,7" fill="none" stroke="#64748b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>')
    s.f(2)
    s.raw(f'<rect x="{x}" y="292" width="{W}" height="196" rx="14" fill="#f5f3ff" stroke="#c4b5fd" stroke-width="2"/>')
    s.raw(lock(x + 14, 304, 0.5, '#7c3aed'))
    s.raw(T(x + 46, 330, 'Guardrail', 15, 800, '#5b21b6'))
    s.raw(T(x + 16, 372, GUARD[i], 14.5, 400, '#334155'))
    s.f(3)
    s.raw(f'<rect x="{x}" y="504" width="{W}" height="196" rx="14" fill="#f0fdf4" stroke="#86efac" stroke-width="2"/>')
    s.raw(shield(x + 14, 514, 0.42, '#16a34a'))
    s.raw(T(x + 46, 542, 'Safety check', 15, 800, '#166534'))
    s.raw(T(x + 16, 584, SAFE[i], 14.5, 400, '#334155'))
s.f(4)
s.raw('<rect x="60" y="716" width="1480" height="96" rx="12" fill="#fef2f2" stroke="#fca5a5" stroke-width="2"/>')
s.raw(T(84, 752, 'Safety first. Disabling a tracker can alert whoever placed it, and so can changing who it is shared with.', 17, 800, '#7f1d1d'))
s.raw(T(84, 782, 'Decide with someone you trust, a support service or the platform’s safety guide. Steps here follow Apple’s documented design;', 15, 400, '#7f1d1d'))
s.raw(T(84, 802, 'other ecosystems differ in detail (Scene 47).', 15, 400, '#7f1d1d'))
scenes[89] = s.render(None)
