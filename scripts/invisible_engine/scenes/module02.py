"""Module 2 scenes (09–17). Run scripts/invisible_engine/build.py to write the SVGs."""
import math
from .svgkit import Scene
from .art import *

scenes = {}


def field(s, cx, cy, radii, k=0.6):
    s.fieldlines(cx, cy, radii, k)


# ── 09 Tap at checkout ───────────────────────────────────────────────
s = Scene(9, 'Tap at checkout',
          'Four frames. A contactless card with no battery approaches a payment terminal; the terminal’s 13.56 MHz '
          'field reaches the card and powers its chip; terminal and card exchange commands and replies; the screen '
          'shows Approved, a decision that usually comes from the card issuer over the payment network.',
          sub='No battery in the card: the terminal supplies the power, the issuer supplies the decision.')
s.f(1)
s.raw(card(90, 330, 340))
s.raw(callout(80, 570, 380, 130, 'The card arrives', 'No battery inside. The chip is\ninert until a reader is near.', 'blue', 1))
s.raw('<path d="M470,430 L600,430" stroke="#64748b" stroke-width="5" stroke-dasharray="2 10" stroke-linecap="round"/><path d="M600,416 L626,430 L600,444 Z" fill="#64748b"/>')
s.raw(terminal(1180, 200, 1.0))
s.f(2)
s.raw(card(690, 300, 340))
for r in (60, 95, 130):
    a1, a2 = math.radians(120), math.radians(240)
    s.raw(f'<path d="M{1190 + r*math.cos(a1):.0f},{360 + r*math.sin(a1):.0f} A{r},{r} 0 0 1 {1190 + r*math.cos(a2):.0f},{360 + r*math.sin(a2):.0f}" class="field"/>')
s.arrow([(1170, 440), (1044, 440)], 'energy')
s.raw(callout(640, 560, 430, 130, 'The field powers the chip', 'The terminal’s 13.56 MHz magnetic\nfield induces power in the card’s coil.', 'orange', 2))
s.raw(leader(900, 560, 1100, 446, '#fdba74'))
s.f(3)
s.biarrow([(1044, 360), (1170, 360)], 'signal')
s.raw(callout(640, 150, 430, 120, 'Commands ⇄ replies', 'Only while the card sits in\nthe field — a few centimetres.', 'blue', 3))
s.raw(leader(900, 270, 1100, 354, '#93c5fd'))
s.f(4)
s.raw('<rect x="1204" y="226" width="212" height="150" rx="12" fill="#dcfce7" stroke="#0f172a" stroke-width="3"/>'
      '<circle cx="1310" cy="276" r="26" fill="#16a34a"/><path d="M1297,277 L1307,287 L1325,266" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>')
s.raw(T(1310, 346, 'Approved', 24, 800, '#166534', 'middle'))
s.raw(callout(1120, 650, 420, 150, 'Who said yes?', 'Usually the card’s issuer, reached over\nthe payment network (Scene 15) — not\nthe card or the terminal alone.', 'green', 4))
s.text(80, 790, 'Field rings are an illustrative visualisation, not literal visible waves.', 'note')
scenes[9] = s.render('Schematic. Fictional card.')

# ── 10 Card cutaway ─────────────────────────────────────────────────
s = Scene(10, 'Inside the card',
          'Four frames. A cutaway of an ID-1 payment card, 85.60 by 53.98 millimetres, showing a few turns of antenna '
          'coil near the edge; the coil’s two ends joining the chip module at its antenna terminals; the chip opened as a '
          'block diagram: rectifier, regulator, clock recovery, demodulator, load modulator, processor, crypto engine and '
          'secure memory; and a note that layouts vary.',
          sub='A coil, a chip, and the circuits that turn a magnetic field into power and answers.')
s.f(1)
s.raw(card(70, 200, 780, cut=True, number='', label='BANK', coil_turns=4))
s.raw(callout(70, 712, 400, 100, 'Antenna coil', 'A few turns near the edge (drawn heavier).', 'orange', 1, 19, 15.5))
s.raw(leader(270, 712, 140, 640, '#fdba74'))
s.f(2)
s.raw('<path d="M130,330 L180,330 L180,390 L280,390" fill="none" stroke="#b45309" stroke-width="5"/>'
      '<path d="M130,560 L180,560 L180,452 L280,452" fill="none" stroke="#b45309" stroke-width="5"/>'
      '<circle cx="280" cy="390" r="7" fill="#0f172a"/><circle cx="280" cy="452" r="7" fill="#0f172a"/>')
s.raw(callout(490, 712, 360, 100, 'Antenna terminals', 'The coil’s two ends join the module.', 'amber', 2, 19, 15.5))
s.raw(leader(560, 712, 284, 456, '#fcd34d'))
s.f(3)
s.raw('<path d="M400,340 L900,170" stroke="#a78bfa" stroke-width="2" stroke-dasharray="6 6"/><path d="M400,450 L900,800" stroke="#a78bfa" stroke-width="2" stroke-dasharray="6 6"/>')
s.rect(900, 160, 640, 640, 'bound', rx=18)
s.raw(badge(944, 204, 3, 'purple', 24))
s.raw(T(980, 214, 'The chip, opened (block diagram)', 22, 800, '#14213d'))
blocks = [('Rectifier', 'AC → DC', 'orange'), ('Regulator', 'steady supply', 'orange'),
          ('Clock recovery', 'timing from 13.56 MHz', 'slate'), ('Demodulator', 'reads the reader', 'green'),
          ('Load modulator', 'answers the reader', 'blue'), ('Processor', 'runs the application', 'slate'),
          ('Crypto engine', 'computes cryptograms', 'purple'), ('Secure memory', 'keys, payment app', 'purple')]
for i, (t, b, c) in enumerate(blocks):
    x = 930 + (i % 2) * 300
    y = 250 + (i // 2) * 112
    s.raw(chip_box(x, y, 280, 92, t, b, c))
s.raw(lock(1440, 590, 0.7, '#7c3aed'))
s.raw(T(930, 720, 'Power (orange) → logic → secrets (purple).', 17, 600, '#334155'))
s.raw(T(930, 746, 'Keys are meant never to leave the secure memory.', 17, 400, '#334155'))
s.f(4)
s.raw(T(930, 780, 'Layouts vary: some cards couple the module through a small coil.', 15.5, 400, '#475569', italic=True))
scenes[10] = s.render('Schematic, not to scale. Generic block names, not a specific chip.')

# ── 11 Reader makes the field ────────────────────────────────────────
s = Scene(11, 'The reader makes the field',
          'Three frames. A payment terminal, opened: a 13.56 MHz oscillator, a modulator, a power amplifier and a '
          'matching network drive the reader’s antenna coil; an alternating current flows in the coil; and an '
          'illustrative magnetic field reaches a few centimetres, where a card can sit.',
          sub='The terminal supplies all the energy. The card does not transmit a carrier of its own.')
s.f(1)
s.raw(terminal(70, 190, 1.05))
s.raw('<path d="M346,330 L430,250 M346,520 L430,770" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6 6"/>')
s.rect(430, 170, 520, 620, 'bound', rx=18)
s.raw(T(456, 210, 'Inside the reader', 22, 800, '#14213d'))
chain = [('Oscillator', '13.56 MHz, very stable'), ('Modulator', 'adds the commands'), ('Amplifier', 'drives the power'), ('Matching', 'tunes energy into the coil')]
for i, (t, b) in enumerate(chain):
    y = 240 + i * 132
    s.raw(chip_box(470, y, 440, 92, t, b, 'orange' if i != 1 else 'blue'))
    if i < 3:
        s.arrow([(690, y + 94), (690, y + 128)], 'energy')
s.f(2)
s.arrow([(950, 470), (1050, 470)], 'energy')
s.coil(1250, 470, 340, 220, turns=4, gap=11)
s.raw(T(1250, 478, 'reader antenna coil', 17, 700, '#92400e', 'middle'))
s.raw(callout(1060, 170, 470, 120, 'Alternating current in the coil', '13.56 million reversals a second.', 'orange', 1))
s.f(3)
field(s, 1250, 470, [210, 250], 0.72)
s.raw(card(1150, 680, 200))
s.raw(T(1140, 760, 'card a few cm away', 16, 600, '#334155', 'end'))
s.raw(callout(60, 700, 330, 110, 'Field strength', 'ISO/IEC 14443: about\n1.5–7.5 A/m, unmodulated.', 'blue', 2, 19, 15.5))
s.text(470, 820, 'Field rings: illustrative visualisation, not literal visible waves.', 'note')
scenes[11] = s.render('Block diagram; real readers integrate these stages.')

# ── 12 Chip wakes ────────────────────────────────────────────────────
s = Scene(12, 'How the chip wakes up without a battery',
          'Five frames along a power path: the reader’s changing field; the card coil, where an alternating voltage is '
          'induced; a rectifier that makes pulsing direct current; a capacitor and regulator that hold a steady supply; '
          'and the chip running. A final panel lists what changes how much power arrives.',
          sub='Changing field → induced AC → rectified → regulated → the chip runs.')
stages = [('Changing field', 'from the reader', 'blue'), ('Card coil', 'v = −N · dΦ/dt', 'orange'),
          ('Rectifier', 'AC → pulsing DC', 'orange'), ('Capacitor + regulator', 'steady supply rail', 'orange'),
          ('Chip runs', 'clock, logic, crypto', 'purple')]
for i, (t, b, c) in enumerate(stages):
    s.f(i + 1)
    x = 60 + i * 300
    s.raw(panel(x, 170, 270, 330, c, i + 1, None))
    s.raw(T(x + 82, 222, t if len(t) < 16 else t.replace(' + ', ' +\n'), 21, 800, '#14213d'))
    s.raw(T(x + 24, 470, b, 16.5, 600 if '=' in b else 400, '#334155', mono='=' in b))
    if i:
        s.arrow([(x - 26, 335), (x - 4, 335)], 'energy')
    cx = x + 135
    if i == 0:
        s.raw(f'<ellipse cx="{cx}" cy="350" rx="90" ry="56" class="field"/><ellipse cx="{cx}" cy="350" rx="60" ry="36" class="field"/><ellipse cx="{cx}" cy="350" rx="30" ry="18" class="field"/>')
        s.raw(T(cx, 430, 'illustrative field drawing', 14, 400, '#475569', 'middle', True))
    elif i == 1:
        s.coil(cx, 330, 170, 100, turns=3)
        s.raw(f'<path d="M{cx - 75},{410} q15,-34 30,0 t30,0 t30,0 t30,0 t30,0" fill="none" stroke="#ea580c" stroke-width="3"/>')
    elif i == 2:
        s.raw(f'<path d="M{cx - 40},{290} L{cx + 10},{320} L{cx - 40},{350} Z" fill="#fed7aa" stroke="#9a3412" stroke-width="3"/><path d="M{cx + 10},{290} L{cx + 10},{350}" stroke="#9a3412" stroke-width="4"/>')
        s.raw(f'<path d="M{cx - 75},{410} q15,-40 30,0 q15,-40 30,0 q15,-40 30,0 q15,-40 30,0 q15,-40 30,0" fill="none" stroke="#ea580c" stroke-width="3"/><line x1="{cx - 75}" y1="410" x2="{cx + 75}" y2="410" stroke="#94a3b8" stroke-width="2"/>')
    elif i == 3:
        s.raw(f'<path d="M{cx - 50},{280} L{cx - 50},{350} M{cx - 70},{315} L{cx - 30},{315} M{cx - 70},{325} L{cx - 30},{325}" stroke="#9a3412" stroke-width="4" fill="none"/>'
              f'<rect x="{cx + 0}" y="285" width="70" height="60" rx="8" fill="#ffedd5" stroke="#9a3412" stroke-width="3"/>')
        s.raw(T(cx + 35, 322, 'REG', 16, 800, '#9a3412', 'middle'))
        s.raw(f'<path d="M{cx - 75},{395} L{cx + 75},{395}" stroke="#ea580c" stroke-width="4"/><line x1="{cx - 75}" y1="420" x2="{cx + 75}" y2="420" stroke="#94a3b8" stroke-width="2"/>')
    else:
        s.raw(f'<rect x="{cx - 60}" y="270" width="120" height="120" rx="14" fill="#ede9fe" stroke="#6d28d9" stroke-width="3"/>')
        for k in range(5):
            s.raw(f'<path d="M{cx - 72},{284 + k * 22} L{cx - 60},{284 + k * 22} M{cx + 60},{284 + k * 22} L{cx + 72},{284 + k * 22}" stroke="#6d28d9" stroke-width="3"/>')
        s.raw(lock(cx - 24, 292, 1.0, '#6d28d9'))
s.f(5)
factors = [('Distance', 'coupling falls very steeply as\nthe card moves away'), ('Alignment & size', 'the field must thread the loop;\ntilt or a smaller coil gets less'),
           ('Tuning', 'metal, other cards or very close\nplacement can detune both sides'), ('Load', 'computing draws more current;\ndesigns must allow for it')]
s.raw(T(60, 556, 'How much power arrives is not fixed', 22, 800, '#14213d'))
for i, (t, b) in enumerate(factors):
    s.raw(callout(60 + i * 372, 580, 352, 140, t, b, 'amber', None, 19, 15.5))
s.text(60, 770, 'No calibrated watts anywhere in this lesson: real values depend on the reader, the card and placement.', 'note')
scenes[12] = s.render()

# ── 13 Downlink and reply ───────────────────────────────────────────
s = Scene(13, 'How the reader talks — and how the card answers without a transmitter',
          'Four frames. The reader sends bits by briefly reducing its field (amplitude-shift keying); the card’s '
          'demodulator turns the dips into bits; the card switches an extra load on and off at an 847.5 kHz subcarrier, '
          'changing how much energy it draws; the reader sees small changes in its coil, which appear as sidebands '
          'either side of the 13.56 MHz carrier.',
          sub='The reader dips its field; the card changes how much energy it absorbs.')
s.raw(terminal(60, 210, 0.62))
s.raw(card(1270, 270, 270))
s.raw(T(140, 500, 'reader', 17, 700, '#334155', 'middle'))
s.f(1)
s.raw(panel(260, 160, 980, 190, 'blue', 1, 'Reader → card: dips in the field', None, 22))
wave = 'M300,280 ' + ' '.join('q8,-30 16,0 t16,0' if i not in (8, 9, 18) else 'l32,0' for i in range(26))
s.raw(f'<path d="{wave}" fill="none" stroke="#1d4ed8" stroke-width="3"/>')
s.raw(T(300, 330, 'Type A: field paused (100 % ASK), modified Miller · Type B: ~10 % ASK, NRZ · base rate 106 kbit/s', 16, 400, '#334155'))
s.arrow([(1160, 280), (1250, 340)], 'signal')
s.f(2)
s.raw(callout(1270, 470, 270, 120, 'Demodulator', 'turns dips into\ncommand bits', 'green', 2, 19, 15.5))
s.arrow([(1405, 600), (1405, 650)], 'plain')
s.raw(T(1405, 676, 'processor replies', 16, 600, '#166534', 'middle'))
s.f(3)
s.raw(panel(260, 380, 980, 190, 'orange', 3, 'Card → reader: load modulation', None, 22))
s.raw('<rect x="300" y="460" width="180" height="80" rx="10" fill="#ffffff" stroke="#9a3412" stroke-width="2"/><rect x="560" y="460" width="180" height="80" rx="10" fill="#ffffff" stroke="#1d4ed8" stroke-width="2"/><path d="M480,500 L560,500" class="wire"/>')
s.raw(T(390, 497, 'coil + chip', 17, 700, '#14213d', 'middle')); s.raw(T(390, 522, 'draws energy', 15, 400, '#475569', 'middle'))
s.raw(T(650, 497, 'extra load', 17, 700, '#14213d', 'middle')); s.raw(T(650, 522, 'switched on/off', 15, 400, '#475569', 'middle'))
s.raw(T(770, 480, 'Switching at 847.5 kHz (13.56 MHz ÷ 16)', 17, 600, '#9a3412'))
s.raw(T(770, 506, 'changes how much energy the card absorbs.', 16, 400, '#334155'))
s.raw(T(770, 540, 'The card never makes its own carrier wave.', 16, 800, '#14213d'))
s.f(4)
s.raw(panel(260, 600, 980, 210, 'blue', 4, 'Reader sees the change: sidebands', None, 22))
s.raw('<line x1="420" y1="780" x2="1180" y2="780" stroke="#334155" stroke-width="2"/>'
      '<line x1="800" y1="780" x2="800" y2="664" stroke="#1d4ed8" stroke-width="9"/>'
      '<line x1="620" y1="780" x2="620" y2="746" stroke="#1d4ed8" stroke-width="6"/>'
      '<line x1="980" y1="780" x2="980" y2="746" stroke="#1d4ed8" stroke-width="6"/>')
s.raw(T(820, 680, 'carrier 13.56 MHz', 15, 600, '#1e3a8a'))
s.raw(T(620, 736, '−847.5 kHz', 15, 600, '#1e3a8a', 'middle')); s.raw(T(980, 736, '+847.5 kHz', 15, 600, '#1e3a8a', 'middle'))
s.raw(T(1190, 802, 'heights not to scale', 14, 400, '#475569', 'end', True))
s.arrow([(1270, 560), (1150, 700)], 'signal')
scenes[13] = s.render('ISO/IEC 14443-2 values as summarised by independent sources.')

# ── 14 Standards layers ─────────────────────────────────────────────
s = Scene(14, 'Layers of agreement: from radio to payment',
          'Five frames. A sequence between a terminal and a card, grouped by standards layer: ISO/IEC 14443-2 radio; '
          '14443-3 activation and anticollision; 14443-4 transport; the EMV application exchange; and a note that the '
          'exact sequence depends on card type and payment-network kernel.',
          sub='Each layer trusts the one beneath it. Illustrative, not a packet trace.')
s.raw(terminal(905, 150, 0.36))
s.raw(card(1340, 170, 150))
s.raw('<line x1="952" y1="310" x2="952" y2="800" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 6"/>'
      '<line x1="1415" y1="270" x2="1415" y2="800" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 6"/>')
layers = [
    (1, 'blue', '14443-2 · Radio', 'field on, power, modulation', [('field on (13.56 MHz)', 'energy', 1)]),
    (2, 'teal', '14443-3 · Activation', 'who is there? pick one card', [('REQA / WUPA', 'signal', 1), ('ATQA', 'signal', -1), ('ANTICOLLISION / SELECT (UID)', 'signal', 1), ('SAK', 'signal', -1)]),
    (3, 'amber', '14443-4 · Transport', 'reliable message blocks', [('RATS', 'signal', 1), ('ATS', 'signal', -1)]),
    (4, 'purple', 'EMV application', 'choose app; terminal data\nincl. amount and UN', [('SELECT PPSE → app list', 'plain', 1), ('SELECT AID', 'plain', 1), ('GET PROCESSING OPTIONS', 'plain', 1), ('card data + cryptogram', 'crypto', -1)]),
]
y = 316
for fr, col, name, sub, msgs in layers:
    s.f(fr)
    top = y
    h = max(84, 30 + len(msgs) * 30)
    for j, (label, kind, d) in enumerate(msgs):
        my = top + 36 + j * 30
        pts = [(958, my), (1409, my)] if d > 0 else [(1409, my), (958, my)]
        s.arrow(pts, kind)
        s.text(1183, my - 8, label, 's', 'middle')
    s.raw(panel(60, top, 800, h - 8, col, fr, name, None, 21))
    s.raw(T(560, top + 50, sub, 16, 400, '#334155'))
    y = top + h
s.f(5)
s.raw(callout(60, 160, 800, 140, 'Illustrative, not a packet trace', 'Type B cards use different activation commands. The EMV\nsteps — and where the cryptogram appears — depend on the\npayment network’s contactless kernel.', 'slate', 5, 20, 16))
scenes[14] = s.render('UN = unpredictable number from the terminal.')

# ── 15 Dynamic cryptogram ───────────────────────────────────────────
s = Scene(15, 'The cryptogram: a fresh proof for every payment',
          'Five frames. The terminal gives the card the amount, currency, date and an unpredictable number; the card '
          'combines them with its transaction counter and a card-unique secret key into a cryptogram; the cryptogram '
          'travels terminal → acquirer → payment network → issuer; the issuer derives the same key, recomputes and '
          'checks it and answers approve or decline; and why this is not a reusable password.',
          sub='The card proves it holds a key without ever revealing it. The issuer checks.')
parties = [(60, 'Card'), (370, 'Terminal (merchant)'), (680, 'Acquirer (merchant’s bank)'), (990, 'Payment network'), (1300, 'Issuer (card’s bank)')]
for x, name in parties:
    s.rect(x, 160, 250, 210, 'bound', rx=16)
    s.raw(T(x + 125, 322, name if len(name) < 20 else name.replace(' (', '\n('), 17, 800, '#14213d', 'middle'))
s.raw(card(95, 190, 180))
s.raw(terminal(455, 172, 0.3))
s.raw(bank(745, 190, 1.0, '#475569'))
s.raw(globe(1115, 245, 50))
s.raw(bank(1365, 190, 1.0, '#1e3a8a'))
s.f(1)
s.arrow([(360, 440), (318, 440)], 'plain')
s.raw(callout(360, 400, 320, 110, 'Terminal data', 'amount · currency · date ·\nunpredictable number', 'green', 1, 19, 15.5))
s.f(2)
s.raw(callout(60, 400, 250, 190, 'Inside the card', 'terminal data\n+ counter (ATC)\n+ secret card key\n→ cryptogram', 'purple', 2, 19, 16))
s.raw(lock(250, 520, 0.8))
s.f(3)
s.arrow([(310, 620), (670, 620)], 'crypto')
s.arrow([(690, 620), (980, 620)], 'crypto')
s.arrow([(1000, 620), (1290, 620)], 'crypto')
s.label(800, 598, 'cryptogram + transaction data → authorisation request', 'crypto')
s.f(4)
s.raw(callout(1300, 400, 250, 190, 'Issuer checks', 'derives the card key\nrecomputes the\ncryptogram; checks\ncounter, limits, risk', 'purple', 4, 19, 16))
s.arrow([(1290, 690), (318, 690)], 'plain')
s.label(800, 672, 'approve / decline (back via network and acquirer)', 'plain')
s.f(5)
s.raw(callout(60, 720, 1490, 92, 'Not a reusable password', 'A copied cryptogram fails the counter and unpredictable-number checks. The merchant never learns the card key. Card and issuer share symmetric keys.', 'slate', 5, 19, 16))
scenes[15] = s.render('Schematic; exact data elements depend on the kernel.')

# ── 16 Card vs wallet ───────────────────────────────────────────────
s = Scene(16, 'A plastic card and a phone wallet are different credentials',
          'Four frames in two columns. A plastic contactless card holds the card number and card keys and gives the '
          'terminal the card number with a cryptogram; a phone wallet keeps a device-specific token and keys in a secure '
          'element and releases a per-transaction cryptogram only after the user authenticates; the payment network’s '
          'token service maps the token to the card for the issuer; and what each party still sees.',
          sub='Both use fresh cryptograms. Only the wallet hides the card number from the merchant.')
s.f(1)
s.raw(panel(60, 160, 720, 520, 'blue', 1, 'Plastic contactless card', None, 24))
s.raw(card(100, 240, 300))
s.raw(T(440, 260, 'The chip holds', 18, 800, '#14213d'))
s.raw(T(440, 290, '• the card number (PAN)\n• the card’s secret keys', 17, 400, '#334155'))
s.arrow([(200, 450), (200, 560)], 'plain')
s.arrow([(300, 450), (300, 560)], 'crypto')
s.raw(T(188, 510, 'card no.', 16, 600, '#166534', 'end')); s.raw(T(312, 510, 'cryptogram', 16, 600, '#6b21a8'))
s.raw(T(100, 600, 'Terminal receives the card number and a fresh cryptogram.', 16.5, 400, '#334155'))
s.raw(T(100, 628, 'Small payments often need no PIN; the limit varies by region.', 16.5, 400, '#334155'))
s.f(2)
s.raw(panel(820, 160, 720, 520, 'green', 2, 'Phone wallet (e.g. Apple Pay)', None, 24))
s.raw(phone(860, 240, 160, 320, '#f8fafc'))
s.raw(card(876, 290, 128, number='•••• 4821', label=''))
s.raw('<rect x="890" y="430" width="100" height="56" rx="8" fill="#ede9fe" stroke="#7c3aed" stroke-width="2"/>')
s.raw(T(940, 465, 'SE', 18, 800, '#6d28d9', 'middle'))
s.raw(T(1060, 260, 'The secure element holds', 18, 800, '#14213d'))
s.raw(T(1060, 290, '• a device token (Apple: “Device\n  Account Number”), not the card number\n• keys for per-transaction cryptograms', 17, 400, '#334155'))
s.raw(T(1060, 400, 'Released only after you authenticate', 18, 800, '#166534'))
s.raw(T(1060, 428, 'face, finger or passcode', 17, 400, '#334155'))
s.arrow([(940, 570), (940, 600)], 'crypto')
s.raw(T(860, 630, 'Terminal receives the token and a per-transaction cryptogram.', 16.5, 400, '#334155'))
s.raw(T(860, 656, 'Apple Pay: Apple Platform Security. Other wallets vary.', 15, 400, '#475569', italic=True))
s.f(3)
s.raw(callout(820, 700, 720, 112, 'Token service (payment network)', 'Maps token → card account for the issuer; can suspend one\ndevice’s token without replacing the card.', 'amber', 3, 19, 16))
s.arrow([(1350, 690), (1350, 700)], 'admin')
s.f(4)
s.raw(callout(60, 700, 720, 112, 'Who still sees the payment (both)', 'Merchant: amount, time, a card or token number · Network routes it ·\nIssuer: the full transaction. Contactless is not anonymous.', 'slate', 4, 19, 16))
scenes[16] = s.render()

# ── 17 Limits and threats ───────────────────────────────────────────
s = Scene(17, 'What contactless does not promise — and the layers that defend it',
          'Five frames. Who sees transaction data; a relay hazard that stretches a tap across distance, with timing '
          'checks as a defence; a nearby reader reading some card data at centimetres but unable to create future '
          'cryptograms without the card’s key; a separate risk, a sticker that sends a phone to a fake web page; and '
          'layered defences.',
          sub='Explained only as far as a defender needs. No instructions.')
s.f(1)
s.raw(panel(60, 160, 720, 230, 'slate', 1, 'Visible to the payment chain', None, 22))
s.raw(eye(80, 290, 0.9))
s.raw(T(180, 270, 'Merchant, acquirer, network and issuer see\namount, time, place, a card or token number.\nCryptograms stop copying — they do not make\nthe payment private.', 17, 400, '#334155'))
s.f(2)
s.rect(820, 160, 720, 230, 'hz', rx=18)
s.raw(badge(862, 204, 2, 'red', 26))
s.raw(T(902, 214, 'Relay (hazard, conceptual)', 22, 800, '#14213d'))
s.raw(card(850, 270, 110, number='', label=''))
s.raw('<path d="M970,305 L1200,305" stroke="#b91c1c" stroke-width="3" stroke-dasharray="10 8"/>')
s.raw(terminal(1210, 250, 0.22))
s.raw(T(1290, 280, 'Two devices forward the', 16, 400, '#334155'))
s.raw(T(1290, 302, 'exchange over distance.', 16, 400, '#334155'))
s.raw(T(850, 372, 'Defences: tight timing checks (relay-resistance protocols), amount limits, issuer risk scoring.', 15.5, 400, '#334155'))
s.f(3)
s.raw(panel(60, 410, 720, 230, 'amber', 3, 'Skimming at centimetres', None, 22))
s.raw(T(100, 500, 'A nearby reader can read some card data. It cannot\ninvent future cryptograms without the card’s secret\nkey; issuers check counters and unpredictable\nnumbers. Weak unpredictable numbers in some\nterminals were a past research finding.', 17, 400, '#334155'))
s.f(4)
s.rect(820, 410, 720, 230, 'hz', rx=18)
s.raw(badge(862, 454, 4, 'red', 26))
s.raw(T(902, 464, 'A different risk: malicious NFC tags', 22, 800, '#14213d'))
s.raw('<rect x="860" y="500" width="90" height="90" rx="12" fill="#fef3c7" stroke="#b45309" stroke-width="3"/>')
s.raw(T(905, 553, 'NFC', 18, 800, '#92400e', 'middle'))
s.raw(T(980, 520, 'A sticker’s NDEF record can send a phone to a\nfake page. It cannot take money from a card; it\ntargets the person tapping. Check the address;\nnever pay or sign in from a tapped link.', 16.5, 400, '#334155'))
s.f(5)
s.raw(panel(60, 660, 1480, 150, 'green', 5, 'Layered defences — no single one is enough', None, 22))
s.raw(shield(1450, 690, 0.95))
s.raw(T(100, 748, 'Card & wallet: secret keys, counters, phone authentication · Terminal: certified readers, unpredictable numbers', 16.5, 400, '#334155'))
s.raw(T(100, 774, 'Network & issuer: risk scoring, limits, token suspension · Person: report a lost card quickly', 16.5, 400, '#334155'))
s.raw(T(100, 800, 'Stolen cards and compromised terminals remain real risks; limits cap the damage, they do not remove it.', 16.5, 400, '#334155'))
scenes[17] = s.render()

