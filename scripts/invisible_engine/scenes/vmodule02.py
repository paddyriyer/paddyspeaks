"""Module 2 phone-vertical scenes (09–17): the same scenes as module02.py, laid out for a
phone (VScene: 720 wide, body drawn in its own coordinates below the header).
Same title, desc, frames and words as the landscape scene; invisible-engine/tests/check.py
compares them. Change a scene's words in both files."""
import math
from .svgkit import VScene
from .art import *
from .module02 import field

scenes = {}


# Phone-scale versions of components whose own text would fall under 19.5 px when drawn
# small: the same drawing, with its words re-set at 20 px.
def vterminal(x, y, s=0.55, screen='Tap to pay'):
    return terminal(x, y, s, screen='') + T(x + 130 * s, y + 150 * s, screen, 20, 800, '#0c4a6e', 'middle')


def vcard(x, y, w=220, number='•••• 1234', label='BANK'):
    h = w * 0.63
    out = card(x, y, w, number='', label='')
    if label:
        out += T(x + w * 0.64, y + h * 0.24, label, 20, 800, '#e0e7ff', 'end')  # clear of the contactless mark
    if number:
        out += T(x + w * 0.08, y + h * 0.86, number, 20, 600, '#ffffff', mono=True)
    return out


def vchip(x, y, w, h, title, body, color='slate'):
    c, light, border = STEP[color]
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{light}" stroke="{c}" stroke-width="2"/>'
            + T(x + 14, y + 31, title, 22, 800, '#14213d') + T(x + 14, y + 60, body, 20, 400, '#475569'))


# ── 09 Tap at checkout ───────────────────────────────────────────────
s = VScene(9, 'Tap at checkout',
           'Four frames. A contactless card with no battery approaches a payment terminal; the terminal’s 13.56 MHz '
           'field reaches the card and powers its chip; terminal and card exchange commands and replies; the screen '
           'shows Approved, a decision that usually comes from the card issuer over the payment network.',
           sub='No battery in the card: the terminal supplies the power, the issuer supplies the decision.',
           note='Schematic. Fictional card.', h=1480)
s.f(1)
s.raw(card(40, 0, 300))
s.raw('<path d="M190,200 L190,214" stroke="#64748b" stroke-width="5" stroke-dasharray="2 10" stroke-linecap="round"/><path d="M176,214 L190,232 L204,214 Z" fill="#64748b"/>')
s.raw(terminal(446, 40, 0.9))
s.raw(callout(40, 455, 640, 116, 'The card arrives', 'No battery inside. The chip is inert\nuntil a reader is near.', 'blue', 1, 26, 21))
s.f(2)
s.raw(card(40, 240, 300))
for r in (40, 62, 84):
    a1, a2 = math.radians(120), math.radians(240)
    s.raw(f'<path d="M{452 + r*math.cos(a1):.0f},{340 + r*math.sin(a1):.0f} A{r},{r} 0 0 1 {452 + r*math.cos(a2):.0f},{340 + r*math.sin(a2):.0f}" class="field"/>')
s.arrow([(436, 384), (346, 384)], 'energy')
s.raw(badge(391, 416, 2, 'orange', 16))
s.raw(callout(40, 583, 640, 116, 'The field powers the chip', 'The terminal’s 13.56 MHz magnetic field induces\npower in the card’s coil.', 'orange', 2, 26, 21))
s.f(3)
s.biarrow([(346, 300), (436, 300)], 'signal')
s.raw(badge(391, 266, 3, 'blue', 16))
s.raw(callout(40, 711, 640, 116, 'Commands ⇄ replies', 'Only while the card sits in the field —\na few centimetres.', 'blue', 3, 26, 21))
s.f(4)
s.raw('<rect x="468" y="63" width="190" height="136" rx="11" fill="#dcfce7" stroke="#0f172a" stroke-width="3"/>'
      '<circle cx="563" cy="108" r="24" fill="#16a34a"/><path d="M551,109 L560,118 L577,99" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>')
s.raw(T(563, 172, 'Approved', 24, 800, '#166534', 'middle'))
s.raw(callout(40, 839, 640, 143, 'Who said yes?', 'Usually the card’s issuer, reached over the\npayment network (Scene 15) — not the card\nor the terminal alone.', 'green', 4, 26, 21))
s.text(40, 1016, 'Field rings are an illustrative visualisation,\nnot literal visible waves.', 'note')
scenes[9] = s.render()


# ── 10 Card cutaway ─────────────────────────────────────────────────
s = VScene(10, 'Inside the card',
           'Four frames. A cutaway of an ID-1 payment card, 85.60 by 53.98 millimetres, showing a few turns of antenna '
           'coil near the edge; the coil’s two ends joining the chip module at its antenna terminals; the chip opened as a '
           'block diagram: rectifier, regulator, clock recovery, demodulator, load modulator, processor, crypto engine and '
           'secure memory; and a note that layouts vary.',
           sub='A coil, a chip, and the circuits that turn a magnetic field into power and answers.',
           note='Schematic, not to scale. Generic block names, not a specific chip.')
s.bh = 1150
s.f(1)
s.raw(card(60, 0, 600, cut=True, number='', label='BANK', coil_turns=4))
s.raw(callout(40, 398, 312, 124, 'Antenna coil', 'A few turns near the\nedge (drawn heavier).', 'orange', 1, 23, 21))
s.raw(leader(140, 398, 108, 320, '#fdba74'))
s.f(2)
s.raw('<path d="M105,100 L150,100 L150,147 L222,147" fill="none" stroke="#b45309" stroke-width="5"/>'
      '<path d="M105,285 L150,285 L150,194 L222,194" fill="none" stroke="#b45309" stroke-width="5"/>'
      '<circle cx="222" cy="147" r="7" fill="#0f172a"/><circle cx="222" cy="194" r="7" fill="#0f172a"/>')
s.raw(callout(368, 398, 312, 124, 'Antenna terminals', 'The coil’s two ends\njoin the module.', 'amber', 2, 23, 21))
s.raw(leader(470, 398, 226, 198, '#fcd34d'))
s.f(3)
s.raw('<path d="M232,216 L356,330 L356,540" fill="none" stroke="#a78bfa" stroke-width="2" stroke-dasharray="6 6"/>'
      '<path d="M308,216 L364,300 L364,540" fill="none" stroke="#a78bfa" stroke-width="2" stroke-dasharray="6 6"/>')
s.rect(40, 540, 640, 604, 'bound', rx=18)
s.raw(badge(82, 582, 3, 'purple', 22))
s.raw(T(116, 591, 'The chip, opened (block diagram)', 24, 800, '#14213d'))
blocks = [('Rectifier', 'AC → DC', 'orange'), ('Regulator', 'steady supply', 'orange'),
          ('Clock recovery', 'timing from 13.56 MHz', 'slate'), ('Demodulator', 'reads the reader', 'green'),
          ('Load modulator', 'answers the reader', 'blue'), ('Processor', 'runs the application', 'slate'),
          ('Crypto engine', 'computes cryptograms', 'purple'), ('Secure memory', 'keys, payment app', 'purple')]
for i, (t, b, c) in enumerate(blocks):
    s.raw(vchip(60 + (i % 2) * 306, 620 + (i // 2) * 94, 294, 80, t, b, c))
s.raw(lock(612, 912, 0.7, '#7c3aed'))
s.raw(T(60, 1028, 'Power (orange) → logic → secrets (purple).', 21, 600, '#334155'))
s.raw(T(60, 1056, 'Keys are meant never to leave the secure memory.', 21, 400, '#334155'))
s.f(4)
s.raw(T(60, 1094, 'Layouts vary: some cards couple the module\nthrough a small coil.', 21, 400, '#475569', italic=True))
scenes[10] = s.render()

# ── 11 Reader makes the field ────────────────────────────────────────
s = VScene(11, 'The reader makes the field',
           'Three frames. A payment terminal, opened: a 13.56 MHz oscillator, a modulator, a power amplifier and a '
           'matching network drive the reader’s antenna coil; an alternating current flows in the coil; and an '
           'illustrative magnetic field reaches a few centimetres, where a card can sit.',
           sub='The terminal supplies all the energy. The card does not transmit a carrier of its own.',
           note='Block diagram; real readers integrate these stages.')
s.bh = 1180
s.f(1)
s.raw(terminal(40, 30, 0.9))
s.raw('<path d="M274,120 L300,40 M274,330 L300,452" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6 6"/>')
s.rect(300, 0, 380, 460, 'bound', rx=18)
s.raw(T(320, 38, 'Inside the reader', 24, 800, '#14213d'))
chain = [('Oscillator', '13.56 MHz, very stable'), ('Modulator', 'adds the commands'), ('Amplifier', 'drives the power'), ('Matching', 'tunes energy into the coil')]
for i, (t, b) in enumerate(chain):
    y = 58 + i * 100
    s.raw(vchip(318, y, 344, 76, t, b, 'orange' if i != 1 else 'blue'))
    if i < 3:
        s.arrow([(490, y + 76), (490, y + 98)], 'energy')
s.f(2)
s.arrow([(490, 460), (490, 546)], 'energy')
s.coil(360, 640, 380, 180, turns=4, gap=11)
s.raw(T(360, 648, 'reader antenna coil', 21, 700, '#92400e', 'middle'))
s.raw(callout(40, 1000, 640, 104, 'Alternating current in the coil', '13.56 million reversals a second.', 'orange', 1, 26, 21))
s.f(3)
field(s, 360, 640, [215, 255], 0.6)
s.raw(card(380, 762, 300))
s.raw(T(530, 980, 'card a few cm away', 21, 600, '#334155', 'middle'))
s.raw(callout(40, 812, 320, 136, 'Field strength', 'ISO/IEC 14443: about\n1.5–7.5 A/m, unmodulated.', 'blue', 2, 26, 21))
s.text(40, 1140, 'Field rings: illustrative visualisation, not literal\nvisible waves.', 'note')
scenes[11] = s.render()

# ── 12 Chip wakes ────────────────────────────────────────────────────
s = VScene(12, 'How the chip wakes up without a battery',
           'Five frames along a power path: the reader’s changing field; the card coil, where an alternating voltage is '
           'induced; a rectifier that makes pulsing direct current; a capacitor and regulator that hold a steady supply; '
           'and the chip running. A final panel lists what changes how much power arrives.',
           sub='Changing field → induced AC → rectified → regulated → the chip runs.')
s.bh = 1196
stages = [('Changing field', 'from the reader', 'blue'), ('Card coil', 'v = −N · dΦ/dt', 'orange'),
          ('Rectifier', 'AC → pulsing DC', 'orange'), ('Capacitor + regulator', 'steady supply rail', 'orange'),
          ('Chip runs', 'clock, logic, crypto', 'purple')]
for i, (t, b, c) in enumerate(stages):
    s.f(i + 1)
    y = i * 160
    s.raw(panel(40, y, 640, 120, c, i + 1, None))
    s.raw(T(122, y + 54, t, 24, 800, '#14213d'))
    s.raw(T(122, y + 92, b, 21, 600 if '=' in b else 400, '#334155', mono='=' in b))
    if i:
        s.arrow([(250, y - 38), (250, y - 4)], 'energy')
    cx = 565
    if i == 0:
        s.raw(f'<ellipse cx="{cx}" cy="{y + 46}" rx="68" ry="40" class="field"/><ellipse cx="{cx}" cy="{y + 46}" rx="45" ry="27" class="field"/><ellipse cx="{cx}" cy="{y + 46}" rx="22" ry="13" class="field"/>')
        s.raw(T(664, y + 110, 'illustrative field drawing', 20, 400, '#475569', 'end', True))
    elif i == 1:
        s.coil(cx, y + 48, 150, 70, turns=3)
        s.raw(f'<path d="M{cx - 75},{y + 108} q15,-30 30,0 t30,0 t30,0 t30,0 t30,0" fill="none" stroke="#ea580c" stroke-width="3"/>')
    elif i == 2:
        s.raw(f'<path d="M{cx - 40},{y + 18} L{cx + 10},{y + 48} L{cx - 40},{y + 78} Z" fill="#fed7aa" stroke="#9a3412" stroke-width="3"/><path d="M{cx + 10},{y + 18} L{cx + 10},{y + 78}" stroke="#9a3412" stroke-width="4"/>')
        s.raw(f'<path d="M{cx - 75},{y + 110} q15,-24 30,0 q15,-24 30,0 q15,-24 30,0 q15,-24 30,0 q15,-24 30,0" fill="none" stroke="#ea580c" stroke-width="3"/><line x1="{cx - 75}" y1="{y + 110}" x2="{cx + 75}" y2="{y + 110}" stroke="#94a3b8" stroke-width="2"/>')
    elif i == 3:
        s.raw(f'<path d="M{cx - 50},{y + 16} L{cx - 50},{y + 76} M{cx - 70},{y + 42} L{cx - 30},{y + 42} M{cx - 70},{y + 52} L{cx - 30},{y + 52}" stroke="#9a3412" stroke-width="4" fill="none"/>'
              f'<rect x="{cx}" y="{y + 18}" width="74" height="56" rx="8" fill="#ffedd5" stroke="#9a3412" stroke-width="3"/>')
        s.raw(T(cx + 37, y + 53, 'REG', 20, 800, '#9a3412', 'middle'))
        s.raw(f'<path d="M{cx - 75},{y + 94} L{cx + 75},{y + 94}" stroke="#ea580c" stroke-width="4"/><line x1="{cx - 75}" y1="{y + 110}" x2="{cx + 75}" y2="{y + 110}" stroke="#94a3b8" stroke-width="2"/>')
    else:
        s.raw(f'<rect x="{cx - 50}" y="{y + 12}" width="100" height="96" rx="12" fill="#ede9fe" stroke="#6d28d9" stroke-width="3"/>')
        for k in range(4):
            s.raw(f'<path d="M{cx - 62},{y + 30 + k * 20} L{cx - 50},{y + 30 + k * 20} M{cx + 50},{y + 30 + k * 20} L{cx + 62},{y + 30 + k * 20}" stroke="#6d28d9" stroke-width="3"/>')
        s.raw(lock(cx - 24, y + 26, 1.0, '#6d28d9'))
s.f(5)
factors = [('Distance', 'coupling falls very\nsteeply as the card\nmoves away'), ('Alignment & size', 'the field must thread\nthe loop; tilt or a\nsmaller coil gets less'),
           ('Tuning', 'metal, other cards or\nvery close placement\ncan detune both sides'), ('Load', 'computing draws more\ncurrent; designs must\nallow for it')]
s.raw(T(40, 806, 'How much power arrives is not fixed', 24, 800, '#14213d'))
for i, (t, b) in enumerate(factors):
    s.raw(callout(40 + (i % 2) * 328, 826 + (i // 2) * 154, 312, 142, t, b, 'amber', None, 24, 21))
s.text(40, 1160, 'No calibrated watts anywhere in this lesson: real values\ndepend on the reader, the card and placement.', 'note')
scenes[12] = s.render()

# ── 13 Downlink and reply ───────────────────────────────────────────
s = VScene(13, 'How the reader talks — and how the card answers without a transmitter',
           'Four frames. The reader sends bits by briefly reducing its field (amplitude-shift keying); the card’s '
           'demodulator turns the dips into bits; the card switches an extra load on and off at an 847.5 kHz subcarrier, '
           'changing how much energy it draws; the reader sees small changes in its coil, which appear as sidebands '
           'either side of the 13.56 MHz carrier.',
           sub='The reader dips its field; the card changes how much energy it absorbs.',
           note='ISO/IEC 14443-2 values as summarised by independent sources.')
s.bh = 1052
s.raw(vterminal(60, 0, 0.55))
s.raw(vcard(440, 0, 220))
s.raw(T(131, 262, 'reader', 21, 700, '#334155', 'middle'))
s.f(1)
s.raw(panel(40, 352, 600, 182, 'blue', 1, 'Reader → card: dips in the field', None, 24))
wave = 'M70,447 ' + ' '.join('q8,-30 16,0 t16,0' if i not in (5, 6, 12) else 'l32,0' for i in range(17))
s.raw(f'<path d="{wave}" fill="none" stroke="#1d4ed8" stroke-width="3"/>')
s.raw(T(66, 490, 'Type A: field paused (100 % ASK), modified Miller ·\nType B: ~10 % ASK, NRZ · base rate 106 kbit/s', 20, 400, '#334155'))
s.arrow([(610, 350), (610, 146)], 'signal')
s.f(2)
s.raw(callout(222, 150, 340, 118, 'Demodulator', 'turns dips into\ncommand bits', 'green', 2, 26, 21))
s.arrow([(392, 270), (392, 306)], 'plain')
s.raw(T(392, 334, 'processor replies', 21, 600, '#166534', 'middle'))
s.f(3)
s.raw(panel(40, 548, 600, 270, 'orange', 3, 'Card → reader: load modulation', None, 24))
s.raw('<rect x="66" y="624" width="220" height="84" rx="10" fill="#ffffff" stroke="#9a3412" stroke-width="2"/><rect x="346" y="624" width="220" height="84" rx="10" fill="#ffffff" stroke="#1d4ed8" stroke-width="2"/><path d="M286,666 L346,666" class="wire"/>')
s.raw(T(176, 658, 'coil + chip', 21, 700, '#14213d', 'middle')); s.raw(T(176, 688, 'draws energy', 20, 400, '#475569', 'middle'))
s.raw(T(456, 658, 'extra load', 21, 700, '#14213d', 'middle')); s.raw(T(456, 688, 'switched on/off', 20, 400, '#475569', 'middle'))
s.raw(T(66, 744, 'Switching at 847.5 kHz (13.56 MHz ÷ 16)', 21, 600, '#9a3412'))
s.raw(T(66, 771, 'changes how much energy the card absorbs.', 21, 400, '#334155'))
s.raw(T(66, 799, 'The card never makes its own carrier wave.', 21, 800, '#14213d'))
s.f(4)
s.raw(panel(40, 834, 600, 216, 'blue', 4, 'Reader sees the change: sidebands', None, 24))
s.raw('<line x1="90" y1="1012" x2="590" y2="1012" stroke="#334155" stroke-width="2"/>'
      '<line x1="340" y1="1012" x2="340" y2="910" stroke="#1d4ed8" stroke-width="9"/>'
      '<line x1="160" y1="1012" x2="160" y2="982" stroke="#1d4ed8" stroke-width="6"/>'
      '<line x1="520" y1="1012" x2="520" y2="982" stroke="#1d4ed8" stroke-width="6"/>')
s.raw(T(356, 926, 'carrier 13.56 MHz', 20, 600, '#1e3a8a'))
s.raw(T(160, 970, '−847.5 kHz', 20, 600, '#1e3a8a', 'middle')); s.raw(T(520, 970, '+847.5 kHz', 20, 600, '#1e3a8a', 'middle'))
s.raw(T(626, 1040, 'heights not to scale', 20, 400, '#475569', 'end', True))
s.arrow([(662, 90), (694, 90), (694, 880), (646, 880)], 'signal')
scenes[13] = s.render()

# ── 14 Standards layers ─────────────────────────────────────────────
s = VScene(14, 'Layers of agreement: from radio to payment',
           'Five frames. A sequence between a terminal and a card, grouped by standards layer: ISO/IEC 14443-2 radio; '
           '14443-3 activation and anticollision; 14443-4 transport; the EMV application exchange; and a note that the '
           'exact sequence depends on card type and payment-network kernel.',
           sub='Each layer trusts the one beneath it. Illustrative, not a packet trace.',
           note='UN = unpredictable number from the terminal.')
s.bh = 1150
s.raw(vterminal(258, 0, 0.55))
s.raw(vcard(480, 40, 200))
s.raw('<line x1="330" y1="240" x2="330" y2="996" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 6"/>'
      '<line x1="580" y1="176" x2="580" y2="996" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 6"/>')
layers = [
    (1, 'blue', '14443-2 ·\nRadio', 'field on, power,\nmodulation', [('field on (13.56 MHz)', 'energy', 1)], 150),
    (2, 'teal', '14443-3 ·\nActivation', 'who is there?\npick one card', [('REQA / WUPA', 'signal', 1), ('ATQA', 'signal', -1), ('ANTICOLLISION / SELECT (UID)', 'signal', 1), ('SAK', 'signal', -1)], 224),
    (3, 'amber', '14443-4 ·\nTransport', 'reliable message\nblocks', [('RATS', 'signal', 1), ('ATS', 'signal', -1)], 150),
    (4, 'purple', 'EMV\napplication', 'choose app;\nterminal data\nincl. amount\nand UN', [('SELECT PPSE → app list', 'plain', 1), ('SELECT AID', 'plain', 1), ('GET PROCESSING OPTIONS', 'plain', 1), ('card data + cryptogram', 'crypto', -1)], 224),
]
y = 250
for fr, col, name, sub, msgs, h in layers:
    s.f(fr)
    for j, (label, kind, d) in enumerate(msgs):
        my = y + 62 + j * 48
        pts = [(336, my), (574, my)] if d > 0 else [(574, my), (336, my)]
        s.arrow(pts, kind)
        s.label(455, my - 20, label, kind)
    s.raw(panel(40, y, 220, h - 10, col, fr, None))
    s.raw(T(118, y + 40, name, 21, 800, '#14213d'))
    s.raw(T(58, y + 100, sub, 21, 400, '#334155'))
    y += h
s.f(5)
s.raw(callout(40, 1006, 640, 140, 'Illustrative, not a packet trace', 'Type B cards use different activation commands. The EMV\nsteps — and where the cryptogram appears — depend on the\npayment network’s contactless kernel.', 'slate', 5, 26, 20))
scenes[14] = s.render()

# ── 15 Dynamic cryptogram ───────────────────────────────────────────
s = VScene(15, 'The cryptogram: a fresh proof for every payment',
           'Five frames. The terminal gives the card the amount, currency, date and an unpredictable number; the card '
           'combines them with its transaction counter and a card-unique secret key into a cryptogram; the cryptogram '
           'travels terminal → acquirer → payment network → issuer; the issuer derives the same key, recomputes and '
           'checks it and answers approve or decline; and why this is not a reusable password.',
           sub='The card proves it holds a key without ever revealing it. The issuer checks.',
           note='Schematic; exact data elements depend on the kernel.')
s.bh = 1130
# parties stacked down the left column; arrows run in the channel to their right
s.rect(40, 0, 282, 150, 'bound', rx=16)
s.raw(vcard(52, 18, 180))
s.raw(T(272, 84, 'Card', 21, 800, '#14213d', 'middle'))
s.rect(40, 200, 282, 255, 'bound', rx=16)
s.raw(vterminal(48, 212, 0.55))
s.raw(T(256, 316, 'Terminal\n(merchant)', 21, 800, '#14213d', 'middle'))
s.rect(40, 485, 282, 130, 'bound', rx=16)
s.raw(bank(56, 502, 0.85, '#475569'))
s.raw(T(244, 532, 'Acquirer\n(merchant’s\nbank)', 21, 800, '#14213d', 'middle'))
s.rect(40, 645, 282, 120, 'bound', rx=16)
s.raw(globe(110, 705, 48))
s.raw(T(240, 698, 'Payment\nnetwork', 21, 800, '#14213d', 'middle'))
s.rect(40, 795, 282, 130, 'bound', rx=16)
s.raw(bank(56, 812, 0.85, '#1e3a8a'))
s.raw(T(240, 842, 'Issuer\n(card’s\nbank)', 21, 800, '#14213d', 'middle'))
s.f(1)
s.arrow([(142, 198), (142, 156)], 'plain')
s.raw(callout(394, 196, 286, 146, 'Terminal data', 'amount · currency ·\ndate · unpredictable\nnumber', 'green', 1, 26, 21))
s.f(2)
s.raw(callout(394, 0, 286, 172, 'Inside the card', 'terminal data\n+ counter (ATC)\n+ secret card key\n→ cryptogram', 'purple', 2, 26, 21))
s.raw(lock(626, 106, 0.8))
s.f(3)
s.arrow([(322, 110), (352, 110), (352, 535), (328, 535)], 'crypto')
s.arrow([(322, 595), (352, 595), (352, 690), (328, 690)], 'crypto')
s.arrow([(322, 735), (352, 735), (352, 845), (328, 845)], 'crypto')
s.label(536, 420, 'cryptogram + transaction\ndata → authorisation\nrequest', 'crypto')
s.f(4)
s.raw(callout(394, 770, 286, 178, 'Issuer checks', 'derives the card key\nrecomputes the\ncryptogram; checks\ncounter, limits, risk', 'purple', 4, 26, 21))
s.arrow([(322, 900), (376, 900), (376, 60), (328, 60)], 'plain')
s.label(536, 620, 'approve / decline (back\nvia network and\nacquirer)', 'plain')
s.f(5)
s.raw(callout(40, 976, 640, 146, 'Not a reusable password', 'A copied cryptogram fails the counter and\nunpredictable-number checks. The merchant never learns\nthe card key. Card and issuer share symmetric keys.', 'slate', 5, 26, 21))
scenes[15] = s.render()

# ── 16 Card vs wallet ───────────────────────────────────────────────
s = VScene(16, 'A plastic card and a phone wallet are different credentials',
           'Four frames in two columns. A plastic contactless card holds the card number and card keys and gives the '
           'terminal the card number with a cryptogram; a phone wallet keeps a device-specific token and keys in a secure '
           'element and releases a per-transaction cryptogram only after the user authenticates; the payment network’s '
           'token service maps the token to the card for the issuer; and what each party still sees.',
           sub='Both use fresh cryptograms. Only the wallet hides the card number from the merchant.')
s.bh = 1124
s.f(1)
s.raw(panel(40, 0, 640, 356, 'blue', 1, 'Plastic contactless card', None, 24))
s.raw(vcard(64, 76, 220))
s.raw(T(310, 104, 'The chip holds', 22, 800, '#14213d'))
s.raw(T(310, 136, '• the card number (PAN)\n• the card’s secret keys', 21, 400, '#334155'))
s.arrow([(150, 222), (150, 272)], 'plain')
s.arrow([(250, 222), (250, 272)], 'crypto')
s.raw(T(132, 256, 'card no.', 20, 600, '#166534', 'end')); s.raw(T(268, 256, 'cryptogram', 20, 600, '#6b21a8'))
s.raw(T(310, 192, 'Terminal receives the card\nnumber and a fresh cryptogram.', 21, 400, '#334155'))
s.raw(T(64, 308, 'Small payments often need no PIN; the limit varies\nby region.', 21, 400, '#334155'))
s.f(2)
s.raw(panel(40, 370, 640, 452, 'green', 2, 'Phone wallet (e.g. Apple Pay)', None, 24))
s.raw(phone(64, 440, 156, 260, '#f8fafc'))
s.raw(vcard(78, 482, 124, number='•••• 4821', label=''))
s.raw('<rect x="92" y="590" width="100" height="56" rx="8" fill="#ede9fe" stroke="#7c3aed" stroke-width="2"/>')
s.raw(T(142, 626, 'SE', 21, 800, '#6d28d9', 'middle'))
s.raw(T(238, 466, 'The secure element holds', 22, 800, '#14213d'))
s.raw(T(238, 498, '• a device token (Apple: “Device\n  Account Number”), not the card\n  number\n• keys for per-transaction\n  cryptograms', 21, 400, '#334155'))
s.raw(T(238, 648, 'Released only after you authenticate', 21, 800, '#166534'))
s.raw(T(238, 676, 'face, finger or passcode', 21, 400, '#334155'))
s.arrow([(142, 708), (142, 744)], 'crypto')
s.raw(T(64, 772, 'Terminal receives the token and a per-transaction\ncryptogram.', 21, 400, '#334155'))
s.raw(T(238, 712, 'Apple Pay: Apple Platform Security.\nOther wallets vary.', 20, 400, '#475569', italic=True))
s.f(3)
s.raw(callout(40, 852, 640, 116, 'Token service (payment network)', 'Maps token → card account for the issuer; can suspend\none device’s token without replacing the card.', 'amber', 3, 26, 21))
s.arrow([(600, 824), (600, 850)], 'admin')
s.f(4)
s.raw(callout(40, 980, 640, 144, 'Who still sees the payment (both)', 'Merchant: amount, time, a card or token number ·\nNetwork routes it · Issuer: the full transaction.\nContactless is not anonymous.', 'slate', 4, 26, 21))
scenes[16] = s.render()

# ── 17 Limits and threats ───────────────────────────────────────────
s = VScene(17, 'What contactless does not promise — and the layers that defend it',
           'Five frames. Who sees transaction data; a relay hazard that stretches a tap across distance, with timing '
           'checks as a defence; a nearby reader reading some card data at centimetres but unable to create future '
           'cryptograms without the card’s key; a separate risk, a sticker that sends a phone to a fake web page; and '
           'layered defences.',
           sub='Explained only as far as a defender needs. No instructions.')
s.bh = 1176
s.f(1)
s.raw(panel(40, 0, 640, 160, 'slate', 1, 'Visible to the payment chain', None, 24))
s.raw(eye(60, 112, 0.8))
s.raw(T(146, 92, 'Merchant, acquirer, network and issuer see amount,\ntime, place, a card or token number. Cryptograms stop\ncopying — they do not make the payment private.', 20, 400, '#334155'))
s.f(2)
s.rect(40, 168, 640, 310, 'hz', rx=18)
s.raw(badge(82, 212, 2, 'red', 26))
s.raw(T(122, 222, 'Relay (hazard, conceptual)', 24, 800, '#14213d'))
s.raw(card(60, 262, 110, number='', label=''))
s.raw('<path d="M176,297 L236,297 L236,400 L246,400" fill="none" stroke="#b91c1c" stroke-width="3" stroke-dasharray="10 8"/>')
s.raw(vterminal(250, 236, 0.55))
s.raw(T(412, 276, 'Two devices forward the\nexchange over distance.', 20, 400, '#334155'))
s.raw(T(412, 352, 'Defences: tight timing\nchecks (relay-resistance\nprotocols), amount limits,\nissuer risk scoring.', 20, 400, '#334155'))
s.f(3)
s.raw(panel(40, 486, 640, 212, 'amber', 3, 'Skimming at centimetres', None, 24))
s.raw(T(60, 578, 'A nearby reader can read some card data. It cannot invent\nfuture cryptograms without the card’s secret key; issuers\ncheck counters and unpredictable numbers. Weak\nunpredictable numbers in some terminals were a past\nresearch finding.', 20, 400, '#334155'))
s.f(4)
s.rect(40, 706, 640, 192, 'hz', rx=18)
s.raw(badge(82, 750, 4, 'red', 26))
s.raw(T(122, 760, 'A different risk: malicious NFC tags', 24, 800, '#14213d'))
s.raw('<rect x="60" y="790" width="80" height="80" rx="12" fill="#fef3c7" stroke="#b45309" stroke-width="3"/>')
s.raw(T(100, 838, 'NFC', 20, 800, '#92400e', 'middle'))
s.raw(T(156, 802, 'A sticker’s NDEF record can send a phone to a fake\npage. It cannot take money from a card; it targets\nthe person tapping. Check the address; never pay or\nsign in from a tapped link.', 20, 400, '#334155'))
s.f(5)
s.raw(panel(40, 906, 640, 268, 'green', 5, 'Layered defences — no single one is enough', None, 22))
s.raw(shield(606, 990, 0.95))
s.raw(T(60, 998, 'Card & wallet: secret keys, counters, phone\nauthentication · Terminal: certified readers,\nunpredictable numbers\nNetwork & issuer: risk scoring, limits, token\nsuspension · Person: report a lost card quickly\nStolen cards and compromised terminals remain real\nrisks; limits cap the damage, they do not remove it.', 20, 400, '#334155'))
scenes[17] = s.render()
