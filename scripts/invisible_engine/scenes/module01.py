"""Module 1 scenes (01–08). Run scripts/invisible_engine/build.py to write the SVGs."""
import math
from .svgkit import Scene
from .art import *

scenes = {}


def circuit(s, x, y, closed):
    """battery + switch + bulb loop inside a panel starting at (x, y)."""
    s.raw(battery(x + 40, y + 70, 70, 130, 0.8))
    s.raw(f'<path d="M{x + 75},{y + 58} L{x + 75},{y + 30} L{x + 230},{y + 30}" class="wire"/>'
          f'<path d="M{x + 310},{y + 30} L{x + 520},{y + 30} L{x + 520},{y + 80}" class="wire"/>'
          f'<path d="M{x + 520},{y + 210} L{x + 520},{y + 250} L{x + 75},{y + 250} L{x + 75},{y + 200}" class="wire"/>'
          f'<circle cx="{x + 230}" cy="{y + 30}" r="8" fill="#334155"/><circle cx="{x + 310}" cy="{y + 30}" r="8" fill="#334155"/>')
    if closed:
        s.raw(f'<path d="M{x + 230},{y + 30} L{x + 310},{y + 30}" stroke="#334155" stroke-width="7" stroke-linecap="round"/>')
    else:
        s.raw(f'<path d="M{x + 230},{y + 30} L{x + 300},{y - 15}" stroke="#334155" stroke-width="7" stroke-linecap="round"/>')
    s.raw(bulb(x + 520, y + 140, closed))


# ── 01 Switch and transistor ─────────────────────────────────────────
s = Scene(1, 'From a switch to a transistor',
          'Four frames. A flashlight circuit with the switch open: no current, the bulb is dark, we call it 0. The switch '
          'closed: current carries energy, the bulb lights, we call it 1. A transistor cutaway with the gate below its '
          'threshold voltage: no channel, off. The gate above threshold: a conducting channel forms between source and '
          'drain, on. The 0 and 1 are agreed readings of voltage ranges.',
          sub='A 0 or a 1 is an agreed reading of a physical voltage.')
s.f(1)
s.raw(panel(60, 160, 720, 330, 'slate', 1, 'Switch open', None, 22))
circuit(s, 110, 220, False)
s.raw(T(750, 212, 'No current → dark → 0', 20, 800, '#334155', 'end'))
s.f(2)
s.raw(panel(820, 160, 720, 330, 'amber', 2, 'Switch closed', None, 22))
circuit(s, 870, 220, True)
s.arrow([(960, 236), (1080, 236)], 'energy')
s.raw(T(1510, 212, 'Current → light → 1', 20, 800, '#92400e', 'end'))
for fr, x, on in ((3, 60, False), (4, 820, True)):
    s.f(fr)
    s.raw(panel(x, 510, 720, 300, 'purple' if on else 'slate', fr, 'Transistor: gate above threshold' if on else 'Transistor: gate below threshold', None, 22))
    bx = x + 70
    s.raw(f'<rect x="{bx}" y="640" width="580" height="140" rx="8" fill="#e2e8f0" stroke="#64748b" stroke-width="2"/>'
          f'<rect x="{bx + 20}" y="640" width="140" height="56" rx="6" fill="#bfdbfe" stroke="#1d4ed8" stroke-width="2"/>'
          f'<rect x="{bx + 420}" y="640" width="140" height="56" rx="6" fill="#bfdbfe" stroke="#1d4ed8" stroke-width="2"/>'
          f'<rect x="{bx + 180}" y="624" width="220" height="14" fill="#fef9c3" stroke="#a16207" stroke-width="2"/>'
          f'<rect x="{bx + 180}" y="590" width="220" height="34" rx="4" fill="{"#fcd34d" if on else "#cbd5e1"}" stroke="#334155" stroke-width="2"/>')
    s.raw(T(bx + 290, 613, 'gate (+V)' if on else 'gate', 17, 800, '#14213d', 'middle'))
    s.raw(T(bx + 90, 724, 'source', 16, 600, '#1e3a8a', 'middle')); s.raw(T(bx + 490, 724, 'drain', 16, 600, '#1e3a8a', 'middle'))
    if on:
        s.raw(f'<rect x="{bx + 160}" y="642" width="260" height="16" fill="#60a5fa"/>')
        for k in range(9):
            s.raw(f'<circle cx="{bx + 175 + k * 30}" cy="650" r="4" fill="#1e3a8a"/>')
        s.arrow([(bx + 170, 690), (bx + 410, 690)], 'energy')
        s.raw(T(bx + 290, 762, 'a channel forms: current flows → 1', 17, 700, '#5b21b6', 'middle'))
    else:
        s.raw(T(bx + 290, 762, 'no conducting channel → 0', 17, 700, '#334155', 'middle'))
scenes[1] = s.render('Schematic, not to scale.')

# ── 02 Energy versus data ────────────────────────────────────────────
s = Scene(2, 'Energy and information are different things',
          'Three frames. A battery delivering energy to a bulb, measured in joules with the rate in watts; one phone '
          'sending a message to another, measured in bits with the rate in bits per second; and a payment terminal and '
          'a card exchanging both at once: energy from the terminal, an answer from the card. Powering a chip proves '
          'nothing about whose chip it is.',
          sub='Energy is measured in joules. Information is measured in bits. One wire can carry both.')
s.f(1)
s.raw(panel(60, 160, 1480, 190, 'orange', 1, 'Energy', 'joules (J) · rate: watts (W = J/s)', 22))
s.raw(battery(560, 210, 64, 110, 0.8))
s.arrow([(660, 270), (980, 270)], 'energy')
s.raw(bulb(1060, 262, True))
s.raw(T(1180, 250, '1 watt for 1 second', 17, 600, '#9a3412'))
s.raw(T(1180, 276, 'delivers 1 joule.', 17, 400, '#334155'))
s.f(2)
s.raw(panel(60, 370, 1480, 190, 'green', 2, 'Information', 'bits · rate: bits per second (bit/s)', 22))
s.raw(phone(560, 390, 74, 148, '#ecfdf5'))
s.raw(phone(1030, 390, 74, 148, '#ecfdf5'))
s.arrow([(660, 465), (1010, 465)], 'plain')
for i, b in enumerate('0 1 1 0 1 0 0 1'.split()):
    s.raw(f'<rect x="{690 + i * 38}" y="420" width="30" height="30" rx="5" fill="#ffffff" stroke="#16a34a" stroke-width="2"/>')
    s.raw(T(705 + i * 38, 442, b, 17, 800, '#166534', 'middle', mono=True))
s.raw(T(1130, 450, '106 kbit/s = 106,000', 17, 600, '#166534'))
s.raw(T(1130, 476, 'yes/no choices each second.', 17, 400, '#334155'))
s.f(3)
s.raw(panel(60, 580, 1480, 230, 'blue', 3, 'Both at once', 'contactless payment', 22))
s.raw(terminal(560, 595, 0.48))
s.raw(card(1040, 630, 220))
s.arrow([(700, 670), (1020, 670)], 'energy')
s.arrow([(1020, 740), (700, 740)], 'plain')
s.label(860, 652, 'energy: powers the card', 'energy')
s.label(860, 722, 'information: the card answers', 'plain')
s.raw(T(1290, 690, 'Delivering energy', 17, 800, '#14213d'))
s.raw(T(1290, 716, 'says nothing about', 17, 400, '#334155'))
s.raw(T(1290, 742, 'whose chip it is.', 17, 400, '#334155'))
scenes[2] = s.render()

# ── 03 Fields near and far ───────────────────────────────────────────
s = Scene(3, 'A changing current makes a changing magnetic field',
          'Four frames. An alternating current source drives a coil; an illustrative magnetic field around the coil grows, '
          'shrinks and reverses with the current; the near field, within about one wavelength over two pi, where coupling '
          'dominates and falls very steeply, contrasted with the far field, where a wave travels on; and the sizes: at '
          '13.56 MHz that boundary is about 3.5 metres, at 2.4 GHz about 2 centimetres.',
          sub='Near field: energy shared with nearby coils. Far field: a wave that travels on.')
s.f(1)
s.raw(panel(60, 160, 700, 400, 'orange', 1, 'Coil driven by AC', None, 22))
s.raw('<circle cx="160" cy="370" r="38" fill="#fff7ed" stroke="#c2410c" stroke-width="3"/>'
      '<path d="M138,370 C148,345 160,345 165,370 C170,395 182,395 190,370" fill="none" stroke="#c2410c" stroke-width="3"/>'
      '<path d="M198,370 L300,370" class="wire"/>')
s.raw(T(160, 440, 'AC source', 16, 700, '#9a3412', 'middle'))
s.coil(460, 370, 300, 180, turns=4, gap=11)
s.raw(T(110, 520, 'Current reverses 13.56 million times a second (NFC).', 17, 400, '#334155'))
s.f(2)
s.fieldlines(460, 370, [180, 210], 0.55)
s.raw(T(300, 548, 'Illustrative field visualisation — not literal visible waves.', 15, 400, '#475569', italic=True))
s.f(3)
s.raw(panel(800, 160, 740, 190, 'blue', 2, 'Near field (inside ≈ λ/2π)', None, 22))
s.raw(terminal(830, 244, 0.22))
s.raw(card(915, 268, 90, number='', label=''))
s.raw(T(1040, 262, 'Energy is mostly stored and exchanged with', 17, 400, '#334155'))
s.raw(T(1040, 288, 'nearby coils, and falls very steeply with', 17, 400, '#334155'))
s.raw(T(1040, 314, 'distance. A card on a terminal lives here.', 17, 400, '#334155'))
s.raw(panel(800, 370, 740, 190, 'green', 3, 'Far field (many λ away)', None, 22))
s.raw(tag(860, 480, 26))
s.raw(waves(880, 480, 3, '#16a34a', 0.9))
s.raw(phone(965, 430, 48, 96, '#ecfdf5'))
s.raw(T(1040, 472, 'A wave detaches and travels on, weakening', 17, 400, '#334155'))
s.raw(T(1040, 498, 'more gently. Bluetooth, Wi-Fi and satellite', 17, 400, '#334155'))
s.raw(T(1040, 524, 'receivers use this radiation.', 17, 400, '#334155'))
s.f(4)
s.raw(panel(60, 590, 1480, 220, 'slate', 4, 'Same rule, very different sizes', None, 22))
s.raw(T(110, 690, '13.56 MHz (NFC):   λ = c / f ≈ 22.1 m   →   λ/2π ≈ 3.5 m.   A card 2–4 cm away is deep in the near field.', 17, 600, '#14213d', mono=True))
s.raw(T(110, 724, '2.4 GHz (Bluetooth LE):   λ ≈ 12.5 cm   →   λ/2π ≈ 2 cm.   A phone 10 m away is in the far field.', 17, 600, '#14213d', mono=True))
s.raw(T(110, 770, 'Range depends on power, antennas, coupling, noise and the receiver — not on frequency alone.', 17, 400, '#334155'))
scenes[3] = s.render()

# ── 04 Induction ─────────────────────────────────────────────────────
s = Scene(4, 'Induction: a changing field pushes current around a coil',
          'Four frames. A bar magnet moving into a coil makes a meter needle swing; when the magnet stops the needle '
          'returns to zero, because only change induces voltage; an AC-driven primary coil induces an alternating voltage '
          'in a secondary coil with no wire between them; and three energy sources compared: a battery, near-field '
          'induction and far-field radio harvesting.',
          sub='v = −N · dΦ/dt — voltage appears only while the magnetic flux changes.')


def meter(x, y, angle):
    a = math.radians(angle)
    return (f'<circle cx="{x}" cy="{y}" r="48" fill="#ffffff" stroke="#334155" stroke-width="4"/>'
            f'<path d="M{x - 34},{y + 6} A36,36 0 0 1 {x + 34},{y + 6}" fill="none" stroke="#cbd5e1" stroke-width="3"/>'
            f'<path d="M{x},{y + 14} L{x + 40 * math.sin(a):.0f},{y + 14 - 40 * math.cos(a):.0f}" stroke="#dc2626" stroke-width="4" stroke-linecap="round"/>'
            f'<circle cx="{x}" cy="{y + 14}" r="5" fill="#334155"/>')


def magnet(x, y):
    return (f'<rect x="{x}" y="{y}" width="80" height="54" rx="6" fill="#fecaca" stroke="#991b1b" stroke-width="3"/>'
            f'<rect x="{x + 80}" y="{y}" width="80" height="54" rx="6" fill="#bfdbfe" stroke="#1e3a8a" stroke-width="3"/>'
            f'<text x="{x + 40}" y="{y + 36}" text-anchor="middle" style="font-size:24px;font-weight:800;fill:#991b1b">N</text>'
            f'<text x="{x + 120}" y="{y + 36}" text-anchor="middle" style="font-size:24px;font-weight:800;fill:#1e3a8a">S</text>')


s.f(1)
s.raw(panel(60, 160, 720, 330, 'blue', 1, 'Move the magnet', None, 22))
s.raw(magnet(110, 300))
s.raw('<path d="M110,390 L250,390" stroke="#64748b" stroke-width="5"/><path d="M248,378 L270,390 L248,402 Z" fill="#64748b"/>')
s.raw(T(180, 425, 'moving', 16, 600, '#475569', 'middle'))
s.coil(470, 325, 180, 130, turns=3)
s.raw('<path d="M560,325 L620,325" class="wire"/><path d="M470,390 L470,440 L670,440 L670,375" class="wire"/>')
s.raw(meter(670, 330, 40))
s.raw(T(110, 470, 'The needle swings while the magnet moves.', 17, 600, '#1e3a8a'))
s.f(2)
s.raw(panel(820, 160, 720, 330, 'slate', 2, 'Stop the magnet', None, 22))
s.coil(1230, 325, 180, 130, turns=3)
s.raw(magnet(1060, 298))
s.raw('<path d="M1320,325 L1380,325" class="wire"/><path d="M1230,390 L1230,440 L1430,440 L1430,375" class="wire"/>')
s.raw(meter(1430, 330, 0))
s.raw(T(870, 470, 'A steady field induces nothing. Lenz: the current opposes the change.', 16.5, 600, '#334155'))
s.f(3)
s.raw(panel(60, 510, 1480, 150, 'orange', 3, 'Drive one coil with AC → the other gets an AC voltage', None, 22))
s.coil(520, 610, 220, 70, turns=3)
s.coil(1080, 610, 220, 70, turns=3)
s.arrow([(650, 610), (950, 610)], 'energy')
s.label(800, 592, 'energy via the changing field', 'energy')
s.raw(T(1220, 616, 'a loose, air-cored transformer', 16, 600, '#9a3412'))
s.f(4)
cards = [('Battery', 'energy stored inside;\nworks anywhere, runs down', 'green'),
         ('Near-field induction (NFC)', 'energy from a nearby coil;\nuseful only at centimetres', 'orange'),
         ('Far-field RF harvesting', 'energy scavenged from a radio\nwave; typically far weaker', 'blue')]
for i, (t, b, c) in enumerate(cards):
    x = 60 + i * 500
    s.raw(callout(x, 680, 480, 130, t, b, c, None, 20, 16))
s.raw(battery(470, 715, 34, 64, 0.8))
s.coil(930, 745, 70, 50, turns=3, gap=7)
s.raw('<path d="M1440,800 L1440,722 M1424,800 L1456,800" stroke="#334155" stroke-width="4" fill="none"/><circle cx="1440" cy="718" r="6" fill="#334155"/>')
s.raw(waves(1440, 718, 3, '#2563eb', 0.7, -1))
scenes[4] = s.render('Schematic. The grey arrow shows the magnet moving.')

# ── 05 Antennas ─────────────────────────────────────────────────────
s = Scene(5, 'Three antennas, three jobs',
          'Three frames. A card-sized loop antenna with a few turns that couples magnetically at 13.56 MHz; a small '
          'Bluetooth antenna, a printed trace roughly a quarter wavelength long at 2.4 GHz, that radiates; and an Ultra '
          'Wideband module with several antennas, built for wide bandwidth and angle measurement.',
          sub='A loop that couples, a trace that radiates, an array that times and points.')
s.f(1)
s.raw(panel(60, 160, 470, 650, 'orange', 1, 'Loop / coil', 'NFC · HF RFID', 22))
s.raw(card(95, 270, 400, cut=True, number='', label='', coil_turns=4))
s.raw(T(295, 560, '85.60 × 53.98 mm card (ID-1)', 16, 600, '#9a3412', 'middle'))
s.raw(T(90, 610, 'Job: couple to a reader coil\nthrough the magnetic near field.', 19, 800, '#14213d'))
s.raw(T(90, 690, '• a few turns near the edge\n• tuned near 13.56 MHz\n• more area, more flux\n• not built to radiate far', 16.5, 400, '#334155'))
s.f(2)
s.raw(panel(565, 160, 470, 650, 'blue', 2, 'Small radiator', 'Bluetooth LE · 2.4 GHz', 22))
s.raw('<rect x="625" y="280" width="350" height="230" rx="14" fill="#166534" stroke="#14532d" stroke-width="3"/>'
      '<path d="M690,470 L690,320 L760,320 L760,380 L830,380 L830,320 L930,320" fill="none" stroke="#fcd34d" stroke-width="7" stroke-linejoin="round"/>'
      '<rect x="660" y="450" width="70" height="44" rx="4" fill="#111827"/>'
      '<circle cx="890" cy="455" r="18" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/>')
s.raw(T(800, 545, 'printed trace ≈ λ/4 ≈ 3 cm, often meandered', 16, 600, '#1e3a8a', 'middle'))
s.raw(T(595, 610, 'Job: launch a wave that\nphones metres away can hear.', 19, 800, '#14213d'))
s.raw(T(595, 690, '• size is a fraction of λ\n• efficiency vs size vs bandwidth\n• detuned by hands and bodies\n• pattern is not a neat sphere', 16.5, 400, '#334155'))
s.f(3)
s.raw(panel(1070, 160, 470, 650, 'purple', 3, 'Wideband array', 'UWB · ~6.5 / 8 GHz', 22))
s.raw('<rect x="1130" y="280" width="350" height="230" rx="14" fill="#1e1b4b" stroke="#312e81" stroke-width="3"/>')
for cx, cy in ((1200, 335), (1410, 335), (1305, 455)):
    s.raw(f'<rect x="{cx - 26}" y="{cy - 26}" width="52" height="52" rx="6" fill="#fcd34d" stroke="#a16207" stroke-width="3"/>')
s.raw('<path d="M1226,335 L1384,335 M1200,361 L1290,445 M1410,361 L1320,445" stroke="#a5b4fc" stroke-width="2" stroke-dasharray="5 5"/>')
s.raw(T(1305, 545, 'several antennas → angle of arrival', 16, 600, '#5b21b6', 'middle'))
s.raw(T(1100, 610, 'Job: send and time very short\npulses over ≥ 500 MHz.', 19, 800, '#14213d'))
s.raw(T(1100, 690, '• wide bandwidth = sharp timing\n• phase differences give direction\n• needs a compatible partner', 16.5, 400, '#334155'))
scenes[5] = s.render('Schematic; real antenna geometry varies by product.')

# ── 06 Energy budget ────────────────────────────────────────────────
s = Scene(6, 'An energy budget: sleep, a short burst, sleep again',
          'Four frames. A plot of current against time with a low sleep current and short radio bursts; the duty cycle as '
          'active time over period; the average-current formula; and an illustrative coin-cell lifetime estimate with '
          'its assumptions. All numbers are illustrative, not any product.',
          sub='A tiny average comes from being asleep almost all the time. All values illustrative.')
s.f(1)
s.raw(panel(60, 160, 1060, 460, 'slate', 1, 'Current over time', None, 22))
s.raw('<line x1="130" y1="560" x2="1080" y2="560" stroke="#334155" stroke-width="3"/><line x1="130" y1="560" x2="130" y2="240" stroke="#334155" stroke-width="3"/>')
s.raw(T(120, 256, 'current', 15, 600, '#475569', 'end')); s.raw(T(1080, 592, 'time →', 15, 600, '#475569', 'end'))
s.raw('<path d="M130,540 L330,540 L330,280 L346,280 L346,540 L660,540 L660,280 L676,280 L676,540 L990,540 L990,280 L1006,280 L1006,540 L1080,540" fill="none" stroke="#c2410c" stroke-width="4"/>')
s.raw(T(230, 528, 'sleep (µA)', 15, 600, '#9a3412', 'middle'))
s.raw(T(338, 268, 'radio burst (mA)', 15, 600, '#9a3412', 'middle'))
s.f(2)
s.raw('<path d="M330,578 L330,590 L660,590 L660,578" fill="none" stroke="#14213d" stroke-width="2"/>')
s.raw(callout(1160, 160, 380, 140, 'Duty cycle', 'D = t_on / T\nactive time ÷ period', 'blue', 2, 20, 17))
s.raw(T(495, 610, 'period T', 15, 600, '#14213d', 'middle'))
s.f(3)
s.raw(callout(1160, 320, 380, 160, 'Average current', 'I_avg ≈ D·I_active\n        + (1 − D)·I_sleep\nignores wake overhead, sensors', 'purple', 3, 20, 17))
s.f(4)
s.raw(coin_cell(1260, 600, 70))
s.raw(callout(60, 640, 1060, 170, 'Illustrative only — not a product', '8 mA for 2 ms every 1 s, and 2 µA asleep:  D = 0.002  →  I_avg ≈ 16 µA + 2 µA ≈ 18 µA\n220 mAh ÷ 0.018 mA ≈ 12,000 h ≈ 1.4 years — before temperature, self-discharge,\npulse-capacity limits and everything else the device does.', 'amber', 4, 20, 17))
s.raw(T(1350, 590, '220 mAh', 18, 800, '#334155'))
s.raw(T(1350, 616, 'nominal', 16, 400, '#475569'))
scenes[6] = s.render('Illustrative values, not a measured product.')

# ── 07 Four questions ───────────────────────────────────────────────
s = Scene(7, 'Four different questions: who, near, where, which way',
          'Four frames. Identity: a tag sends an identifier a phone can hear. Proximity: received signal strength jumps '
          'about, a noisy clue. Location: a phone computes its own coordinates from satellite signals; a tag without a '
          'receiver cannot. Distance and direction: two compatible devices exchange timed Ultra Wideband messages.',
          sub='A broadcasting tag is not a satellite navigation receiver.')
s.f(1)
s.raw(panel(60, 160, 720, 310, 'blue', 1, 'Identity: “what is this?”', None, 22))
s.raw(tag(170, 340, 44))
s.raw(waves(190, 340, 3, '#2563eb', 0.9))
s.arrow([(270, 340), (520, 340)], 'signal')
s.label(395, 320, 'an identifier', 'signal')
s.raw(phone(560, 250, 90, 180, '#eff6ff'))
s.raw(T(100, 450, 'Which object, or which rotating code — not where.', 16.5, 400, '#334155'))
s.f(2)
s.raw(panel(820, 160, 720, 310, 'teal', 2, 'Proximity: “is it near?”', None, 22))
for i, h in enumerate([40, 90, 60, 120, 70, 110, 50, 95, 80, 130]):
    s.raw(f'<rect x="{880 + i * 44}" y="{420 - h}" width="30" height="{h}" rx="4" fill="#5eead4"/>')
s.raw(phone(1360, 250, 90, 180, '#f0fdfa'))
s.raw(T(860, 450, 'Signal strength (RSSI) jumps with bodies and walls.', 16.5, 400, '#334155'))
s.f(3)
s.raw(panel(60, 490, 720, 320, 'green', 3, 'Location: “where on Earth?”', None, 22))
for sx, sy in ((150, 600), (330, 575), (510, 595)):
    s.raw(satellite(sx, sy, 0.9))
s.arrow([(160, 625), (580, 690)], 'signal')
s.arrow([(330, 600), (590, 685)], 'signal')
s.arrow([(500, 620), (600, 680)], 'signal')
s.raw(phone(600, 640, 80, 160, '#f0fdf4'))
s.raw(T(100, 760, 'The phone computes its own coordinates.\nA tag without a receiver cannot.', 16.5, 400, '#334155'))
s.f(4)
s.raw(panel(820, 490, 720, 320, 'purple', 4, 'Distance & direction: “how far, which way?”', None, 21))
s.raw(phone(880, 590, 90, 180, '#f5f3ff'))
s.raw(tag(1420, 680, 40))
s.biarrow([(990, 680), (1370, 680)], 'signal')
s.label(1180, 660, 'timed UWB exchange: d = c · t', 'signal')
s.raw(T(1000, 760, 'Two compatible devices, short range —\nnot a map position.', 16.5, 400, '#334155'))
scenes[7] = s.render()

# ── 08 Map ──────────────────────────────────────────────────────────
s = Scene(8, 'The wireless map: what each technology is for',
          'Three frames revealing rows of a comparison table: radio-frequency identification families; near-field '
          'communication, Bluetooth Low Energy and Ultra Wideband; then Wi-Fi and cellular positioning and satellite '
          'navigation. Columns give power source, band, real job, typical range and a privacy note.',
          sub='Only the last two rows answer “where on Earth?” — for the device doing the receiving.')
cols = [(140, 'Technology'), (400, 'Power'), (590, 'Band'), (800, 'Real job'), (1110, 'Range (typical)'), (1310, 'Privacy note')]
s.raw('<rect x="60" y="160" width="1480" height="48" rx="10" fill="#0f172a"/>')
for x, c in cols:
    s.raw(T(x, 192, c, 18, 800, '#ffffff'))
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
y = 214
for i, (fr, col, *cells) in enumerate(rows):
    s.f(fr)
    c, light, border = STEP[col]
    s.raw(f'<rect x="60" y="{y}" width="1480" height="66" rx="10" fill="{light}" stroke="{border}" stroke-width="1.5"/>')
    s.raw(f'<circle cx="100" cy="{y + 33}" r="18" fill="{c}"/>')
    for (x, _), cell in zip(cols, cells):
        s.raw(T(x, y + 40, cell, 18 if x == 140 else 16.5, 800 if x == 140 else 400, '#14213d' if x == 140 else '#334155'))
    y += 71
s.f(3)
s.raw(T(60, 815, 'Ranges are typical working distances, not limits: antennas, power, bodies, walls and rules move them.', 16, 400, '#475569', italic=True))
scenes[8] = s.render()

