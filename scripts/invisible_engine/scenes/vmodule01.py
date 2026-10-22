"""Module 1 phone-vertical scenes (01–08): the same scenes as module01.py, laid out for a
phone (VScene: 720 wide, body drawn in its own coordinates below the header).
Same title, desc, frames and words as the landscape scene; invisible-engine/tests/check.py
compares them. Change a scene's words in both files."""
from .svgkit import VScene, wrap
from .art import *
from .module01 import circuit, meter

scenes = {}


def para(x, y, text, n, size=21, weight=400, fill='#334155', anchor='start', italic=False, mono=False):
    """A paragraph wrapped at n characters (spaces only), one <text> with a tspan per line."""
    return T(x, y, '\n'.join(wrap(text, n)), size, weight, fill, anchor, italic, mono)


def head(x, y, w, h, color, n, title, sub, tsize=26):
    """A step panel with its subtitle at the phone type scale (panel() draws subs at 17 px)."""
    out = panel(x, y, w, h, color, n, title, None, tsize)
    if sub:
        out += T(x + 82, y + 88, sub, 21, 600, STEP[color][0])
    return out


# ── 01 Switch and transistor ─────────────────────────────────────────
s = VScene(1, 'From a switch to a transistor',
           'Four frames. A flashlight circuit with the switch open: no current, the bulb is dark, we call it 0. The switch '
           'closed: current carries energy, the bulb lights, we call it 1. A transistor cutaway with the gate below its '
           'threshold voltage: no channel, off. The gate above threshold: a conducting channel forms between source and '
           'drain, on. The 0 and 1 are agreed readings of voltage ranges.',
           sub='A 0 or a 1 is an agreed reading of a physical voltage.',
           note='Schematic, not to scale.', h=1345)


def small_circuit(px, closed):
    # the landscape circuit at half size (it has no text, so scaling keeps the type scale)
    s.raw(f'<g transform="translate({px + 4},70) scale(0.5)">')
    circuit(s, 0, 30, closed)
    s.raw('</g>')


s.f(1)
s.raw(panel(40, 0, 312, 262, 'slate', 1, 'Switch open', None, 24))
small_circuit(40, False)
s.raw(T(64, 246, 'No current → dark → 0', 21, 800, '#334155'))
s.f(2)
s.raw(panel(368, 0, 312, 262, 'amber', 2, 'Switch closed', None, 24))
small_circuit(368, True)
s.arrow([(413, 93), (473, 93)], 'energy')
s.raw(T(392, 246, 'Current → light → 1', 21, 800, '#92400e'))
for fr, y, on in ((3, 278, False), (4, 578, True)):
    s.f(fr)
    s.raw(panel(40, y, 640, 284, 'purple' if on else 'slate', fr, 'Transistor: gate above threshold' if on else 'Transistor: gate below threshold', None, 26))
    bx = 70
    s.raw(f'<rect x="{bx}" y="{y + 130}" width="580" height="110" rx="8" fill="#e2e8f0" stroke="#64748b" stroke-width="2"/>'
          f'<rect x="{bx + 20}" y="{y + 130}" width="140" height="56" rx="6" fill="#bfdbfe" stroke="#1d4ed8" stroke-width="2"/>'
          f'<rect x="{bx + 420}" y="{y + 130}" width="140" height="56" rx="6" fill="#bfdbfe" stroke="#1d4ed8" stroke-width="2"/>'
          f'<rect x="{bx + 180}" y="{y + 114}" width="220" height="14" fill="#fef9c3" stroke="#a16207" stroke-width="2"/>'
          f'<rect x="{bx + 180}" y="{y + 78}" width="220" height="36" rx="4" fill="{"#fcd34d" if on else "#cbd5e1"}" stroke="#334155" stroke-width="2"/>')
    s.raw(T(bx + 290, y + 104, 'gate (+V)' if on else 'gate', 21, 800, '#14213d', 'middle'))
    s.raw(T(bx + 90, y + 222, 'source', 21, 600, '#1e3a8a', 'middle')); s.raw(T(bx + 490, y + 222, 'drain', 21, 600, '#1e3a8a', 'middle'))
    if on:
        s.raw(f'<rect x="{bx + 160}" y="{y + 132}" width="260" height="16" fill="#60a5fa"/>')
        for k in range(9):
            s.raw(f'<circle cx="{bx + 175 + k * 30}" cy="{y + 140}" r="4" fill="#1e3a8a"/>')
        s.arrow([(bx + 170, y + 182), (bx + 410, y + 182)], 'energy')
        s.raw(T(bx + 290, y + 270, 'a channel forms: current flows → 1', 21, 700, '#5b21b6', 'middle'))
    else:
        s.raw(T(bx + 290, y + 270, 'no conducting channel → 0', 21, 700, '#334155', 'middle'))
scenes[1] = s.render()

# ── 02 Energy versus data ────────────────────────────────────────────
s = VScene(2, 'Energy and information are different things',
           'Three frames. A battery delivering energy to a bulb, measured in joules with the rate in watts; one phone '
           'sending a message to another, measured in bits with the rate in bits per second; and a payment terminal and '
           'a card exchanging both at once: energy from the terminal, an answer from the card. Powering a chip proves '
           'nothing about whose chip it is.',
           sub='Energy is measured in joules. Information is measured in bits. One wire can carry both.', h=1460)
s.f(1)
s.raw(head(40, 0, 640, 272, 'orange', 1, 'Energy', 'joules (J) · rate: watts (W = J/s)'))
s.raw(battery(90, 128, 64, 110, 0.8))
s.arrow([(176, 183), (336, 183)], 'energy')
s.raw(bulb(430, 182, True))
s.raw(T(536, 160, '1 watt for\n1 second', 21, 700, '#9a3412'))
s.raw(T(536, 222, 'delivers\n1 joule.', 21, 400, '#334155'))
s.f(2)
y = 288
s.raw(head(40, y, 640, 316, 'green', 2, 'Information', 'bits · rate: bits per second (bit/s)'))
s.raw(phone(66, y + 110, 74, 148, '#ecfdf5'))
s.raw(phone(580, y + 110, 74, 148, '#ecfdf5'))
s.arrow([(152, y + 214), (568, y + 214)], 'plain')
for i, b in enumerate('0 1 1 0 1 0 0 1'.split()):
    s.raw(f'<rect x="{202 + i * 40}" y="{y + 140}" width="34" height="34" rx="5" fill="#ffffff" stroke="#16a34a" stroke-width="2"/>')
    s.raw(T(219 + i * 40, y + 164, b, 21, 800, '#166534', 'middle', mono=True))
s.raw(T(66, y + 294, '106 kbit/s = 106,000', 21, 700, '#166534'))
s.raw(T(288, y + 294, 'yes/no choices each second.', 21, 400, '#334155'))
s.f(3)
y = 620
s.raw(head(40, y, 640, 400, 'blue', 3, 'Both at once', 'contactless payment'))
s.raw(terminal(70, y + 104, 0.6, screen=''))
s.raw(T(148, y + 196, 'Tap to pay', 20, 800, '#0c4a6e', 'middle'))
s.raw(card(456, y + 164, 210, number='', label=''))
s.raw(T(654, y + 192, 'BANK', 20, 800, '#e0e7ff', 'end'))
s.raw(T(476, y + 280, '•••• 1234', 20, 600, '#ffffff', mono=True))
s.arrow([(242, y + 214), (446, y + 214)], 'energy')
s.arrow([(446, y + 304), (242, y + 304)], 'plain')
s.label(344, y + 164, 'energy:\npowers the card', 'energy')
s.label(344, y + 254, 'information:\nthe card answers', 'plain')
s.raw(T(456, y + 326, 'Delivering energy', 21, 800, '#14213d'))
s.raw(T(456, y + 353, 'says nothing about', 21, 400, '#334155'))
s.raw(T(456, y + 380, 'whose chip it is.', 21, 400, '#334155'))
scenes[2] = s.render()

# ── 03 Fields near and far ───────────────────────────────────────────
s = VScene(3, 'A changing current makes a changing magnetic field',
           'Four frames. An alternating current source drives a coil; an illustrative magnetic field around the coil grows, '
           'shrinks and reverses with the current; the near field, within about one wavelength over two pi, where coupling '
           'dominates and falls very steeply, contrasted with the far field, where a wave travels on; and the sizes: at '
           '13.56 MHz that boundary is about 3.5 metres, at 2.4 GHz about 2 centimetres.',
           sub='Near field: energy shared with nearby coils. Far field: a wave that travels on.', h=1641)
s.f(1)
s.raw(panel(40, 0, 640, 312, 'orange', 1, 'Coil driven by AC', None, 26))
s.raw('<circle cx="100" cy="160" r="38" fill="#fff7ed" stroke="#c2410c" stroke-width="3"/>'
      '<path d="M78,160 C88,135 100,135 105,160 C110,185 122,185 130,160" fill="none" stroke="#c2410c" stroke-width="3"/>'
      '<path d="M138,160 L300,160" class="wire"/>')
s.raw(T(100, 228, 'AC source', 21, 700, '#9a3412', 'middle'))
s.coil(420, 160, 240, 140, turns=4, gap=11)
s.raw(T(64, 270, 'Current reverses 13.56 million times a second (NFC).', 21, 400, '#334155'))
s.f(2)
s.fieldlines(420, 160, [140, 165], 0.55)
s.raw(T(64, 298, 'Illustrative field visualisation — not literal visible waves.', 20, 400, '#475569', italic=True))
s.f(3)
y = 332
s.raw(panel(40, y, 640, 342, 'blue', 2, 'Near field (inside ≈ λ/2π)', None, 26))
s.raw(terminal(62, y + 72, 0.62, screen=''))
s.raw(T(143, y + 170, 'Tap to pay', 20, 800, '#0c4a6e', 'middle'))
s.raw(card(234, y + 196, 104, number='', label=''))
s.raw(para(360, y + 120, 'Energy is mostly stored and exchanged with nearby coils, and falls very steeply with '
                         'distance. A card on a terminal lives here.', 28))
y = 690
s.raw(panel(40, y, 640, 222, 'green', 3, 'Far field (many λ away)', None, 26))
s.raw(tag(96, y + 150, 26))
s.raw(waves(116, y + 150, 3, '#16a34a', 0.9))
s.raw(phone(190, y + 100, 48, 96, '#ecfdf5'))
s.raw(para(274, y + 112, 'A wave detaches and travels on, weakening more gently. Bluetooth, Wi-Fi and satellite '
                         'receivers use this radiation.', 37))
s.f(4)
y = 928
s.raw(panel(40, y, 640, 271, 'slate', 4, 'Same rule, very different sizes', None, 26))
s.raw(T(60, y + 100, '13.56 MHz (NFC):   λ = c / f ≈ 22.1 m   →   λ/2π ≈ 3.5 m.', 19.5, 600, '#14213d', mono=True))
s.raw(T(60, y + 128, 'A card 2–4 cm away is deep in the near field.', 21, 600, '#14213d'))
s.raw(T(60, y + 166, '2.4 GHz (Bluetooth LE):   λ ≈ 12.5 cm   →   λ/2π ≈ 2 cm.', 19.5, 600, '#14213d', mono=True))
s.raw(T(60, y + 194, 'A phone 10 m away is in the far field.', 21, 600, '#14213d'))
s.raw(para(60, y + 232, 'Range depends on power, antennas, coupling, noise and the receiver — not on frequency alone.', 56))
scenes[3] = s.render()

# ── 04 Induction ─────────────────────────────────────────────────────
s = VScene(4, 'Induction: a changing field pushes current around a coil',
           'Four frames. A bar magnet moving into a coil makes a meter needle swing; when the magnet stops the needle '
           'returns to zero, because only change induces voltage; an AC-driven primary coil induces an alternating voltage '
           'in a secondary coil with no wire between them; and three energy sources compared: a battery, near-field '
           'induction and far-field radio harvesting.',
           sub='v = −N · dΦ/dt — voltage appears only while the magnetic flux changes.',
           note='Schematic. The grey arrow shows the magnet moving.', h=1630)


def vmagnet(x, y):
    """The landscape bar magnet stood on end: N above, S below (the end that leads into the coil)."""
    return (f'<rect x="{x}" y="{y}" width="54" height="64" rx="6" fill="#fecaca" stroke="#991b1b" stroke-width="3"/>'
            f'<rect x="{x}" y="{y + 64}" width="54" height="64" rx="6" fill="#bfdbfe" stroke="#1e3a8a" stroke-width="3"/>'
            f'<text x="{x + 27}" y="{y + 41}" text-anchor="middle" style="font-size:24px;font-weight:800;fill:#991b1b">N</text>'
            f'<text x="{x + 27}" y="{y + 105}" text-anchor="middle" style="font-size:24px;font-weight:800;fill:#1e3a8a">S</text>')


def coil_meter(px, angle):
    cx, cy = px + 76, 296
    s.coil(cx, cy, 120, 96, turns=3)
    s.raw(f'<path d="M{cx + 60},{cy} L{px + 178},{cy}" class="wire"/>'
          f'<path d="M{cx},{cy + 48} L{cx},{cy + 76} L{px + 226},{cy + 76} L{px + 226},{cy + 62}" class="wire"/>')
    s.raw(meter(px + 226, cy, angle))


s.f(1)
s.raw(panel(40, 0, 312, 482, 'blue', 1, 'Move the magnet', None, 24))
s.raw(vmagnet(89, 78))
s.raw('<path d="M166,90 L166,184" stroke="#64748b" stroke-width="5"/><path d="M154,182 L166,204 L178,182 Z" fill="#64748b"/>')
s.raw(T(178, 152, 'moving', 21, 600, '#475569'))
coil_meter(40, 40)
s.raw(para(60, 420, 'The needle swings while the magnet moves.', 24, 21, 600, '#1e3a8a'))
s.f(2)
s.raw(panel(368, 0, 312, 482, 'slate', 2, 'Stop the magnet', None, 24))
coil_meter(368, 0)
s.raw(vmagnet(417, 196))
s.raw(para(388, 412, 'A steady field induces nothing. Lenz: the current opposes the change.', 26, 21, 600, '#334155'))
s.f(3)
y = 498
s.raw(panel(40, y, 640, 262, 'orange', 3, 'Drive one coil with AC →\nthe other gets an AC voltage', None, 24))
s.coil(150, y + 180, 180, 70, turns=3)
s.coil(530, y + 180, 180, 70, turns=3)
s.arrow([(252, y + 180), (428, y + 180)], 'energy')
s.label(340, y + 128, 'energy via the\nchanging field', 'energy')
s.raw(T(340, y + 246, 'a loose, air-cored transformer', 21, 600, '#9a3412', 'middle'))
s.f(4)
y = 776
s.raw(callout(40, y, 640, 92, 'Battery', 'energy stored inside; works anywhere, runs down', 'green', None, 26, 21))
s.raw(battery(630, y + 24, 30, 56, 0.8))
y += 104
s.raw(callout(40, y, 640, 92, 'Near-field induction (NFC)', 'energy from a nearby coil; useful only at centimetres', 'orange', None, 26, 21))
s.coil(646, y + 32, 56, 36, turns=3, gap=6)
y += 104
s.raw(callout(40, y, 640, 116, 'Far-field RF harvesting', 'energy scavenged from a radio wave; typically\nfar weaker', 'blue', None, 26, 21))
s.raw(f'<path d="M650,{y + 96} L650,{y + 30} M634,{y + 96} L666,{y + 96}" stroke="#334155" stroke-width="4" fill="none"/><circle cx="650" cy="{y + 26}" r="6" fill="#334155"/>')
s.raw(waves(650, y + 26, 3, '#2563eb', 0.7, -1))
scenes[4] = s.render()

# ── 05 Antennas ─────────────────────────────────────────────────────
s = VScene(5, 'Three antennas, three jobs',
           'Three frames. A card-sized loop antenna with a few turns that couples magnetically at 13.56 MHz; a small '
           'Bluetooth antenna, a printed trace roughly a quarter wavelength long at 2.4 GHz, that radiates; and an Ultra '
           'Wideband module with several antennas, built for wide bandwidth and angle measurement.',
           sub='A loop that couples, a trace that radiates, an array that times and points.',
           note='Schematic; real antenna geometry varies by product.', h=1570)


def job(y, job_text, bullets):
    """The job line and its bullets in the right-hand column; continuation lines are indented."""
    s.raw(para(304, y + 136, job_text, 30, 22, 800, '#14213d'))
    yy = y + 136 + 29 * len(wrap(job_text, 30)) + 12
    for b in bullets:
        for i, ln in enumerate(wrap(b, 35)):
            s.raw(T(304 if i == 0 else 322, yy, ln, 21, 400, '#334155'))
            yy += 27


def caption(y, text, color):
    s.raw(para(174, y, text, 18, 21, 600, color, 'middle'))


s.f(1)
y = 0
s.raw(head(40, y, 640, 340, 'orange', 1, 'Loop / coil', 'NFC · HF RFID'))
s.raw(card(64, y + 120, 220, cut=True, number='', label='', coil_turns=4))
caption(y + 290, '85.60 × 53.98 mm card (ID-1)', '#9a3412')
job(y, 'Job: couple to a reader coil through the magnetic near field.',
    ['• a few turns near the edge', '• tuned near 13.56 MHz', '• more area, more flux', '• not built to radiate far'])
s.f(2)
y = 356
s.raw(head(40, y, 640, 370, 'blue', 2, 'Small radiator', 'Bluetooth LE · 2.4 GHz'))
s.raw(f'<g transform="translate(64,{y + 120}) scale(0.63)">'
      '<rect x="0" y="0" width="350" height="230" rx="14" fill="#166534" stroke="#14532d" stroke-width="3"/>'
      '<path d="M65,190 L65,40 L135,40 L135,100 L205,100 L205,40 L305,40" fill="none" stroke="#fcd34d" stroke-width="7" stroke-linejoin="round"/>'
      '<rect x="35" y="170" width="70" height="44" rx="4" fill="#111827"/>'
      '<circle cx="265" cy="175" r="18" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/></g>')
caption(y + 296, 'printed trace ≈ λ/4 ≈ 3 cm, often meandered', '#1e3a8a')
job(y, 'Job: launch a wave that phones metres away can hear.',
    ['• size is a fraction of λ', '• efficiency vs size vs bandwidth', '• detuned by hands and bodies', '• pattern is not a neat sphere'])
s.f(3)
y = 742
s.raw(head(40, y, 640, 346, 'purple', 3, 'Wideband array', 'UWB · ~6.5 / 8 GHz'))
s.raw(f'<g transform="translate(64,{y + 120}) scale(0.63)">'
      '<rect x="0" y="0" width="350" height="230" rx="14" fill="#1e1b4b" stroke="#312e81" stroke-width="3"/>'
      + ''.join(f'<rect x="{cx - 26}" y="{cy - 26}" width="52" height="52" rx="6" fill="#fcd34d" stroke="#a16207" stroke-width="3"/>'
                for cx, cy in ((70, 55), (280, 55), (175, 175)))
      + '<path d="M96,55 L254,55 M70,81 L160,165 M280,81 L190,165" stroke="#a5b4fc" stroke-width="2" stroke-dasharray="5 5"/></g>')
caption(y + 296, 'several antennas → angle of arrival', '#5b21b6')
job(y, 'Job: send and time very short pulses over ≥ 500 MHz.',
    ['• wide bandwidth = sharp timing', '• phase differences give direction', '• needs a compatible partner'])
scenes[5] = s.render()

# ── 06 Energy budget ────────────────────────────────────────────────
s = VScene(6, 'An energy budget: sleep, a short burst, sleep again',
           'Four frames. A plot of current against time with a low sleep current and short radio bursts; the duty cycle as '
           'active time over period; the average-current formula; and an illustrative coin-cell lifetime estimate with '
           'its assumptions. All numbers are illustrative, not any product.',
           sub='A tiny average comes from being asleep almost all the time. All values illustrative.',
           note='Illustrative values, not a measured product.', h=1590)
s.f(1)
s.raw(panel(40, 0, 640, 372, 'slate', 1, 'Current over time', None, 26))
s.raw('<line x1="152" y1="290" x2="650" y2="290" stroke="#334155" stroke-width="3"/><line x1="152" y1="290" x2="152" y2="96" stroke="#334155" stroke-width="3"/>')
s.raw(T(142, 112, 'current', 21, 600, '#475569', 'end'))
s.raw(T(650, 322, 'time →', 21, 600, '#475569', 'end'))
s.raw('<path d="M152,272 L262,272 L262,128 L274,128 L274,272 L448,272 L448,128 L460,128 L460,272 L634,272 L634,128 L646,128 L646,272 L650,272" fill="none" stroke="#c2410c" stroke-width="4"/>')
s.raw(T(361, 260, 'sleep (µA)', 21, 600, '#9a3412', 'middle'))
s.raw(T(270, 116, 'radio burst (mA)', 21, 600, '#9a3412', 'middle'))
s.f(2)
s.raw('<path d="M262,306 L262,318 L448,318 L448,306" fill="none" stroke="#14213d" stroke-width="2"/>')
s.raw(T(355, 348, 'period T', 21, 600, '#14213d', 'middle'))
s.raw(callout(40, 388, 640, 116, 'Duty cycle', 'D = t_on / T\nactive time ÷ period', 'blue', 2, 26, 21))
s.f(3)
s.raw(callout(40, 520, 640, 143, 'Average current', 'I_avg ≈ D·I_active\n        + (1 − D)·I_sleep\nignores wake overhead, sensors', 'purple', 3, 26, 21))
s.f(4)
s.raw(coin_cell(110, 746, 66))
s.raw(T(196, 740, '220 mAh', 22, 800, '#334155'))
s.raw(T(196, 768, 'nominal', 21, 400, '#475569'))
s.raw(callout(40, 828, 640, 206, 'Illustrative only — not a product',
              '8 mA for 2 ms every 1 s, and 2 µA asleep:\nD = 0.002 → I_avg ≈ 16 µA + 2 µA ≈ 18 µA\n'
              '220 mAh ÷ 0.018 mA ≈ 12,000 h ≈ 1.4 years —\nbefore temperature, self-discharge, pulse-capacity\n'
              'limits and everything else the device does.', 'amber', 4, 26, 21))
scenes[6] = s.render()

# ── 07 Four questions ───────────────────────────────────────────────
s = VScene(7, 'Four different questions: who, near, where, which way',
           'Four frames. Identity: a tag sends an identifier a phone can hear. Proximity: received signal strength jumps '
           'about, a noisy clue. Location: a phone computes its own coordinates from satellite signals; a tag without a '
           'receiver cannot. Distance and direction: two compatible devices exchange timed Ultra Wideband messages.',
           sub='A broadcasting tag is not a satellite navigation receiver.', h=1590)
s.f(1)
y = 0
s.raw(panel(40, y, 640, 248, 'blue', 1, 'Identity: “what is this?”', None, 26))
s.raw(tag(112, y + 146, 40))
s.raw(waves(130, y + 146, 3, '#2563eb', 0.85))
s.arrow([(206, y + 146), (500, y + 146)], 'signal')
s.label(353, y + 124, 'an identifier', 'signal')
s.raw(phone(540, y + 82, 64, 128, '#eff6ff'))
s.raw(T(64, y + 234, 'Which object, or which rotating code — not where.', 21, 400, '#334155'))
s.f(2)
y = 262
s.raw(panel(40, y, 640, 248, 'teal', 2, 'Proximity: “is it near?”', None, 26))
for i, h in enumerate([40, 90, 60, 120, 70, 110, 50, 95, 80, 130]):
    hh = h * 0.95
    s.raw(f'<rect x="{80 + i * 42}" y="{y + 206 - hh:.0f}" width="30" height="{hh:.0f}" rx="4" fill="#5eead4"/>')
s.raw(phone(560, y + 78, 64, 128, '#f0fdfa'))
s.raw(T(64, y + 234, 'Signal strength (RSSI) jumps with bodies and walls.', 21, 400, '#334155'))
s.f(3)
y = 524
s.raw(panel(40, y, 640, 300, 'green', 3, 'Location: “where on Earth?”', None, 26))
for sx, sy in ((120, y + 108), (300, y + 92), (470, y + 108)):
    s.raw(satellite(sx, sy, 0.9))
s.arrow([(130, y + 128), (564, y + 216)], 'signal')
s.arrow([(300, y + 112), (564, y + 200)], 'signal')
s.arrow([(470, y + 128), (564, y + 184)], 'signal')
s.raw(phone(580, y + 150, 64, 128, '#f0fdf4'))
s.raw(T(64, y + 250, 'The phone computes its own coordinates.\nA tag without a receiver cannot.', 21, 400, '#334155'))
s.f(4)
y = 838
s.raw(panel(40, y, 640, 256, 'purple', 4, 'Distance & direction:\n“how far, which way?”', None, 26))
s.raw(phone(70, y + 112, 64, 128, '#f5f3ff'))
s.raw(tag(636, y + 176, 34))
s.biarrow([(150, y + 176), (596, y + 176)], 'signal')
s.label(373, y + 154, 'timed UWB exchange: d = c · t', 'signal')
s.raw(T(156, y + 214, 'Two compatible devices, short range —\nnot a map position.', 21, 400, '#334155'))
scenes[7] = s.render()

# ── 08 Map ──────────────────────────────────────────────────────────
s = VScene(8, 'The wireless map: what each technology is for',
           'Three frames revealing rows of a comparison table: radio-frequency identification families; near-field '
           'communication, Bluetooth Low Energy and Ultra Wideband; then Wi-Fi and cellular positioning and satellite '
           'navigation. Columns give power source, band, real job, typical range and a privacy note.',
           sub='Only the last two rows answer “where on Earth?” — for the device doing the receiving.', h=1520)
# The table's six columns become three lines per row card; the header box shows where each column sits.
A, B = 84, 384
s.raw('<rect x="40" y="0" width="640" height="106" rx="10" fill="#0f172a"/>')
for (x, yy), c in zip(((A, 30), (B, 30), (A, 62), (B, 62), (A, 94), (B, 94)),
                      ('Technology', 'Privacy note', 'Power', 'Band', 'Real job', 'Range (typical)')):
    s.raw(T(x, yy, c, 20, 800, '#ffffff'))
rows = [
    (1, 'amber', 'LF / HF RFID', 'reader field', '125 kHz · 13.56 MHz', 'identify at a reader', 'cm', 'fixed IDs can be read'),
    (1, 'amber', 'UHF RFID', 'reader field', '~860–960 MHz', 'inventory at portals', 'up to metres', 'may outlive the sale'),
    (1, 'amber', 'Active RFID', 'battery', '433 MHz / 2.4 GHz', 'site asset tracking', 'tens of m', 'on-site beacon'),
    (2, 'orange', 'NFC', 'reader field (tags)', '13.56 MHz', 'tap: pay, access, read', 'a few cm', 'readable by tap'),
    (2, 'blue', 'Bluetooth LE', 'battery', '2.4 GHz', 'presence, data, beacons', '~1 to tens of m', 'IDs must rotate'),
    (2, 'purple', 'UWB', 'battery', '~6.5 / 8 GHz', 'distance + direction', 'up to tens of m', 'precise, but local'),
    (3, 'teal', 'Wi-Fi / cell position', 'phone battery', 'Wi-Fi · cellular', 'phone finds itself', 'building to city', 'databases from phones'),
    (3, 'green', 'GNSS (GPS etc.)', 'receiver battery', '~1.2–1.6 GHz', 'receiver finds itself', 'global, outdoors', 'only if reported'),
]
y = 114
for fr, col, tech, power, band, real, rng, priv in rows:
    s.f(fr)
    c, light, border = STEP[col]
    s.raw(f'<rect x="40" y="{y}" width="640" height="104" rx="10" fill="{light}" stroke="{border}" stroke-width="1.5"/>')
    s.raw(f'<circle cx="62" cy="{y + 26}" r="11" fill="{c}"/>')
    s.raw(T(A, y + 34, tech, 22, 800, '#14213d'))
    s.raw(T(B, y + 34, priv, 21, 600, '#334155'))
    s.raw(T(A, y + 64, power, 21, 400, '#334155'))
    s.raw(T(B, y + 64, band, 21, 400, '#334155'))
    s.raw(T(A, y + 92, real, 21, 400, '#334155'))
    s.raw(T(B, y + 92, rng, 21, 400, '#334155'))
    y += 112
s.f(3)
s.raw(para(40, y + 22, 'Ranges are typical working distances, not limits: antennas, power, bodies, walls and rules move them.', 58, 20, 400, '#475569', italic=True))
scenes[8] = s.render()
