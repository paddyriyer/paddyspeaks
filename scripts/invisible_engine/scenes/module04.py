"""Module 4 scenes (23–30): Bluetooth LE and the AirTag whisper.

Run scripts/invisible_engine/build.py to write the SVGs. Every number drawn here
is either from the Bluetooth Core Specification or explicitly labelled
illustrative; nothing claims to be an AirTag's real bytes, layout or timing.
"""
import math
from .svgkit import Scene
from .art import *

scenes = {}


# ── local helpers ────────────────────────────────────────────────────
def tower(x, y, s=1.0):
    """A cellular mast, about 70 x 150 at s=1; (x, y) is the top."""
    return (f'<path d="M{x},{y} L{x - 30 * s:.0f},{y + 150 * s:.0f} M{x},{y} L{x + 30 * s:.0f},{y + 150 * s:.0f} '
            f'M{x - 15 * s:.0f},{y + 75 * s:.0f} L{x + 15 * s:.0f},{y + 75 * s:.0f} M{x - 22 * s:.0f},{y + 110 * s:.0f} L{x + 22 * s:.0f},{y + 110 * s:.0f}" '
            f'stroke="#334155" stroke-width="{4 * s:.1f}" fill="none"/>'
            f'<circle cx="{x}" cy="{y}" r="{7 * s:.0f}" fill="#334155"/>')


def beacon(x, y, s=1.0):
    """A wall-mounted BLE beacon puck, 110 x 70 at s=1."""
    return (f'<rect x="{x + 4}" y="{y + 6}" width="{110 * s:.0f}" height="{70 * s:.0f}" rx="{20 * s:.0f}" fill="#0f172a" opacity="0.13"/>'
            f'<rect x="{x}" y="{y}" width="{110 * s:.0f}" height="{70 * s:.0f}" rx="{20 * s:.0f}" fill="#f8fafc" stroke="#64748b" stroke-width="3"/>'
            f'<circle cx="{x + 30 * s:.0f}" cy="{y + 35 * s:.0f}" r="{9 * s:.0f}" fill="#2563eb"/>'
            + T(x + 72 * s, y + 41 * s, 'BLE', 16 * s, 800, '#334155', 'middle'))


def note_illus(s, x, y, text='Radio arcs are illustrative, not visible waves.'):
    s.text(x, y, text, 'note')


def ellipse_layer(cx, cy, rx, ry, fill, stroke, label, sub=None):
    out = (f'<ellipse cx="{cx}" cy="{cy + 14}" rx="{rx}" ry="{ry}" fill="{stroke}" opacity="0.35"/>'
           f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{fill}" stroke="{stroke}" stroke-width="3"/>')
    out += T(cx, cy + (0 if sub else 6), label, 18, 800, '#14213d', 'middle')
    if sub:
        out += T(cx, cy + 24, sub, 15, 400, '#334155', 'middle')
    return out


# ── 23 Tiny tracker cutaway ─────────────────────────────────────────
s = Scene(23, 'Inside a tiny tracker',
          'Five frames. The outside of a small round item tracker of the AirTag class, about three centimetres across, '
          'with no screen, no GPS and no SIM; the tracker opened into three illustrative layers, a top cover with a speaker, '
          'a circuit board and a coin-cell battery under a cover; the power parts, a CR2032-class coin cell and power '
          'management, feeding the rest; the radio parts, a microcontroller with a Bluetooth Low Energy radio, a 2.4 GHz '
          'antenna, an ultra-wideband radio and an NFC interface; and the remaining parts, a speaker and an accelerometer, '
          'with a note that the layout is illustrative, not a teardown.',
          sub='A coin cell, a few radios and a speaker. The layout is illustrative, not a teardown.')
s.f(1)
s.raw(tag(210, 330, 105))
s.raw('<path d="M105,470 L315,470" stroke="#334155" stroke-width="2"/><path d="M105,462 L105,478 M315,462 L315,478" stroke="#334155" stroke-width="2"/>')
s.raw(T(210, 500, 'about 3 cm across', 17, 700, '#334155', 'middle'))
s.raw(callout(60, 560, 330, 170, 'The outside', 'A small item tracker\n(AirTag-class). No screen,\nno GPS, no SIM card.', 'blue', 1, 20, 16.5))
s.f(2)
s.raw('<path d="M610,250 L610,700" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 8"/>')
s.raw(ellipse_layer(610, 280, 175, 62, '#f1f5f9', '#94a3b8', 'Top cover + speaker'))
s.raw(ellipse_layer(610, 470, 175, 62, '#dcfce7', '#16a34a', 'Circuit board', 'radios · microcontroller · antennas'))
s.raw(ellipse_layer(610, 660, 175, 62, '#e5e7eb', '#6b7280', 'Coin cell + cover', 'user-replaceable'))
s.text(440, 780, 'Illustrative layout, not a teardown.', 'note')
blocks = [
    (3, 'Coin cell (CR2032)', '3 V lithium, ~225 mAh nominal', 'orange'),
    (3, 'Power management', 'steady supply, sleep modes', 'orange'),
    (4, 'Microcontroller', 'runs the firmware', 'slate'),
    (4, 'Bluetooth LE radio', 'whispers on 2.4 GHz', 'blue'),
    (4, '2.4 GHz antenna', 'tiny, compromised (Scene 27)', 'blue'),
    (4, 'UWB radio', 'Apple U1: nearby ranging', 'teal'),
    (4, 'NFC interface', 'tap for Lost Mode info', 'green'),
    (5, 'Speaker', 'plays a sound to be found', 'slate'),
    (5, 'Accelerometer', 'senses motion', 'slate'),
    (5, 'Firmware details', 'not publicly disclosed', 'slate'),
]
for i, (fr, t, b, c) in enumerate(blocks):
    s.f(fr)
    x = 920 + (i % 2) * 320
    y = 165 + (i // 2) * 100
    s.raw(chip_box(x, y, 300, 86, t, b, c))
s.f(3)
s.arrow([(700, 604), (700, 538)], 'energy')
s.raw(T(714, 580, 'power', 16, 700, '#c2410c'))
s.f(4)
s.raw(waves(320, 300, 3, '#1d4ed8', 1.1))
s.raw(T(250, 200, 'radio (illustrative)', 15, 600, '#1d4ed8'))
s.f(5)
s.raw(callout(920, 680, 620, 130, 'Documented parts, illustrative layout',
              'Apple lists Bluetooth LE, a U1 chip (UWB), NFC, a speaker, an\naccelerometer and a user-replaceable CR2032. Exact boards,\nchips and firmware are not shown here.', 'slate', 5, 19, 15.5))
scenes[23] = s.render('Generic tracker; not a specific product’s board.')


# ── 24 Advertisement pulse timeline ─────────────────────────────────
s = Scene(24, 'The whisper is a pulse, not a stream',
          'Five frames. A chart of the tracker’s supply current against time: a low sleep current of a few microamps; a '
          'brief advertising event in which the radio transmits the same short packet on three channels in a few '
          'milliseconds, at a few milliamps; the events repeating after an advertising interval plus a small random '
          'delay; the average current, a dashed line only just above sleep, set mostly by how often the tracker speaks; '
          'and a worked example of average current and power with illustrative values.',
          sub='Asleep almost all the time; awake for a few milliseconds to speak. Values are illustrative.')
# axes
X0, X1, YB, YT = 150, 1080, 540, 210
s.raw(f'<path d="M{X0},{YT - 20} L{X0},{YB + 10} L{X1 + 20},{YB + 10}" fill="none" stroke="#334155" stroke-width="3"/>'
      f'<path d="M{X1 + 20},{YB + 2} L{X1 + 36},{YB + 10} L{X1 + 20},{YB + 18} Z" fill="#334155"/>'
      f'<path d="M{X0 - 8},{YT - 20} L{X0},{YT - 36} L{X0 + 8},{YT - 20} Z" fill="#334155"/>')
s.raw(T(X1 + 30, YB + 44, 'time →', 17, 700, '#334155', 'end'))
s.raw(T(X0 - 12, YT - 44, 'supply current', 17, 700, '#334155'))
s.raw(f'<path d="M{X0 - 10},{YB - 70} l20,-8 M{X0 - 10},{YB - 60} l20,-8" stroke="#334155" stroke-width="2"/>')
s.raw(T(X0 - 16, YB - 92, 'axis\nbroken', 13, 400, '#475569', 'end'))
s.f(1)
s.raw(f'<path d="M{X0},{YB} L{X1},{YB}" stroke="#16a34a" stroke-width="4"/>')
s.raw(T(X0 + 14, YB - 44, 'sleep: a few µA', 16, 700, '#166534'))
spikes = [330, 600, 870]
s.f(2)
s.raw(f'<rect x="{spikes[0] - 10}" y="{YT + 30}" width="20" height="{YB - YT - 30}" fill="#1d4ed8"/>')
s.raw(T(spikes[0] + 22, YT + 44, 'advertising event', 16, 700, '#1e3a8a'))
s.raw(T(spikes[0] + 22, YT + 66, 'a few mA for a few ms', 15, 400, '#334155'))
# zoom inset
s.raw('<path d="M340,240 L1120,200" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5 6"/>')
s.rect(1120, 160, 420, 330, 'boxw', rx=14)
s.raw(T(1140, 192, 'Zoom: one advertising event', 17, 800, '#14213d'))
for j, ch in enumerate((37, 38, 39)):
    px = 1170 + j * 120
    s.raw(f'<rect x="{px}" y="250" width="70" height="170" rx="4" fill="#1d4ed8"/>')
    s.raw(T(px + 35, 446, f'ch {ch}', 15, 700, '#1e3a8a', 'middle'))
s.raw('<path d="M1145,420 L1520,420" stroke="#16a34a" stroke-width="3"/>')
s.raw(T(1140, 474, 'Same packet on three channels; ≈ a few ms total', 14.5, 400, '#475569'))
s.f(3)
for x in spikes[1:]:
    s.raw(f'<rect x="{x - 10}" y="{YT + 30}" width="20" height="{YB - YT - 30}" fill="#1d4ed8"/>')
s.raw(f'<path d="M{spikes[0]},{YB + 40} L{spikes[1]},{YB + 40}" stroke="#334155" stroke-width="2"/>'
      f'<path d="M{spikes[0]},{YB + 32} l0,16 M{spikes[1]},{YB + 32} l0,16" stroke="#334155" stroke-width="2"/>')
s.raw(T((spikes[0] + spikes[1]) / 2, YB + 70, 'interval T (illustrative) + random 0–10 ms', 15.5, 700, '#334155', 'middle'))
s.raw(T((spikes[1] + spikes[2]) / 2 + 70, YB + 70, 'the random delay stops two devices', 15, 400, '#475569', 'middle'))
s.raw(T((spikes[1] + spikes[2]) / 2 + 70, YB + 90, 'colliding again and again', 15, 400, '#475569', 'middle'))
s.f(4)
s.raw(f'<path d="M{X0},{YB - 18} L{X1},{YB - 18}" stroke="#c2410c" stroke-width="3" stroke-dasharray="12 8"/>')
s.raw(T(X1 - 6, YB - 28, 'average current', 16, 800, '#9a3412', 'end'))
s.raw(callout(60, 650, 700, 160, 'Average current',
              'I_avg = (I_tx × t_on + I_sleep × (T − t_on)) / T\nSet mostly by how often it speaks (T), not how loudly.\nSpeak twice as often → roughly twice the radio drain.', 'orange', 4, 19, 16))
s.f(5)
s.raw(callout(800, 650, 740, 160, 'Worked example (illustrative values)',
              'I_tx = 6 mA, t_on = 3 ms, T = 2 s, I_sleep = 2 µA\nI_avg ≈ (18 µA·s + 4 µA·s) / 2 s ≈ 11 µA\nPower ≈ 3 V × 11 µA ≈ 33 µW (radio and sleep only)', 'blue', 5, 19, 16))
scenes[24] = s.render('Not to scale. Not a measurement of any product.')


# ── 25 Whisper to scanner ───────────────────────────────────────────
s = Scene(25, 'A whisper anyone nearby can hear',
          'Five frames. A small tracker broadcasts the same advertising packet on Bluetooth LE advertising channels 37, '
          '38 and 39, at 2402, 2426 and 2480 MHz, out of forty 2 MHz channels in the 2.4 GHz band; a passer-by’s phone, '
          'scanning, receives one copy while it happens to listen on that channel; no connection, pairing or reply is '
          'needed to receive a broadcast; reception is probabilistic because the tracker’s events and the phone’s scan '
          'windows must overlap, and walls, bodies and other radios interfere; and the phone checks the packet’s '
          'format and only acts on packets its software is built to recognise.',
          sub='Advertising is a broadcast. Hearing it needs no pairing, no connection and no reply.')
# band strip
BX0, BX1 = 420, 1180
fx = lambda f: BX0 + (f - 2400) / 83.5 * (BX1 - BX0)
s.raw(f'<rect x="{BX0}" y="200" width="{BX1 - BX0}" height="60" rx="6" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/>')
for k in range(40):
    xx = fx(2402 + 2 * k)
    s.raw(f'<line x1="{xx:.0f}" y1="214" x2="{xx:.0f}" y2="246" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(T(BX0, 186, '2400 MHz', 14, 600, '#475569'))
s.raw(T(BX1, 186, '2483.5 MHz', 14, 600, '#475569', 'end'))
s.raw(T((BX0 + BX1) / 2, 186, '40 channels × 2 MHz', 15, 700, '#334155', 'middle'))
s.raw(tag(200, 420, 72))
s.raw(T(200, 530, 'small tracker', 17, 700, '#334155', 'middle'))
s.raw(person(1440, 300, 1.0, '#475569', phone_in_hand=True))
s.raw(phone(1190, 330, 130, 260, '#eff6ff'))
s.raw(T(1255, 450, 'scanning', 16, 700, '#1e3a8a', 'middle'))
s.raw(T(1255, 474, '(listening)', 14, 400, '#475569', 'middle'))
s.f(1)
for f, ch in ((2402, 37), (2426, 38), (2480, 39)):
    xx = fx(f)
    s.raw(f'<rect x="{xx - 9:.0f}" y="204" width="18" height="52" rx="3" fill="#1d4ed8"/>')
    s.raw(T(xx, 286, f'ch {ch} · {f}', 14.5, 700, '#1e3a8a', 'middle'))
s.raw(waves(272, 420, 3, '#1d4ed8', 1.1))
s.raw(callout(60, 600, 400, 140, 'One packet, three channels', 'The tracker repeats the same\nadvertising packet on 37, 38, 39.', 'blue', 1, 19, 16))
s.f(2)
s.arrow([(330, 420), (1180, 420)], 'signal')
s.label(760, 398, 'advertising packet (one copy heard)', 'signal')
s.f(3)
s.raw(callout(520, 470, 560, 120, 'No pairing, no connection, no reply',
              'Any receiver in range that is listening on the channel\ncan pick up the broadcast. The tracker never learns who heard.', 'green', 3, 19, 15.5))
s.f(4)
s.raw(panel(520, 610, 620, 200, 'slate', 4, 'Hearing is a matter of chance', None, 20))
s.raw(T(560, 700, 'tracker speaks', 14, 700, '#1e3a8a'))
s.raw(T(560, 760, 'phone listens', 14, 700, '#334155'))
for k, xx in enumerate(range(700, 1120, 90)):
    s.raw(f'<rect x="{xx}" y="684" width="8" height="24" fill="#1d4ed8"/>')
for xx, w in ((690, 60), (880, 60), (1060, 60)):
    s.raw(f'<rect x="{xx}" y="744" width="{w}" height="24" rx="4" fill="#cbd5e1"/>')
for xx, ok in ((700, True), (790, False), (880, True), (970, False), (1060, True)):
    s.raw(T(xx + 4, 798, '✓' if ok else '✗', 16, 800, '#166534' if ok else '#b91c1c', 'middle'))
s.f(5)
s.raw(callout(1160, 610, 380, 200, 'Decode or ignore',
              'The phone checks the CRC and\nthe data format. It acts only on\npackets its software is built\nto recognise (Module 5).', 'teal', 5, 19, 15.5))
note_illus(s, 60, 790)
scenes[25] = s.render('Channel positions to scale; timing not to scale.')


# ── 26 Advertising packet anatomy ───────────────────────────────────
s = Scene(26, 'What is in an advertising packet',
          'Five frames. A Bluetooth LE legacy advertising packet on the 1M PHY as a strip of fields: a 1-byte preamble, a '
          '4-byte access address, a 2-byte PDU header, a 6-byte advertiser address, up to 31 bytes of advertising data and '
          'a 3-byte CRC; what each field is for; the advertising data as a list of length-type-value structures, one of '
          'which an ecosystem can use for its own short-lived identifier, shown conceptually; advertising, a one-way '
          'broadcast anyone can hear, contrasted with a connection, where two devices agree to talk and can encrypt after '
          'pairing; and changing addresses for privacy.',
          sub='Educational field layout from the Bluetooth Core Specification. Not a capture of any product.')
fields = [('Preamble', '1 B', 90, 'slate'), ('Access address', '4 B', 190, 'slate'), ('Header', '2 B', 130, 'amber'),
          ('Advertiser address (AdvA)', '6 B', 330, 'teal'), ('Advertising data (AdvData)', '≤ 31 B', 470, 'green'), ('CRC', '3 B', 150, 'slate')]
s.f(1)
x = 125
pos = {}
for name, size, w, c in fields:
    col, light, border = STEP[c]
    s.raw(f'<rect x="{x}" y="180" width="{w}" height="80" fill="{light}" stroke="{col}" stroke-width="2.5"/>')
    s.raw(T(x + w / 2, 214, name, 16.5 if w > 140 else 15, 800, '#14213d', 'middle'))
    s.raw(T(x + w / 2, 242, size, 15, 600, col, 'middle'))
    pos[name] = (x, w)
    x += w
s.raw('<path d="M535,286 L1460,286" stroke="#334155" stroke-width="2"/><path d="M535,278 L535,294 M1460,278 L1460,294" stroke="#334155" stroke-width="2"/>')
s.raw(T(997, 312, 'PDU (header + payload)', 15, 700, '#334155', 'middle'))
s.f(2)
expl = [('Preamble', 'bit-timing\nsync'), ('Access address', '0x8E89BED6\nfor advertising'), ('Header', 'packet type\n+ length'),
        ('CRC', 'catches errors,\nnot attackers')]
for name, txt in expl:
    x0, w = pos[name]
    s.raw(T(x0 + w / 2, 346, txt, 14.5, 400, '#334155', 'middle'))
s.f(3)
x0, w = pos['Advertising data (AdvData)']
s.raw(f'<path d="M{x0},{262} L500,426 M{x0 + w},{262} L1100,426" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5 6"/>')
ads = [('len', 'type: flags', 'value', 'green', False), ('len', 'type: manufacturer data', 'ecosystem’s short-lived identifier (conceptual)', 'purple', True)]
s.raw(T(130, 410, 'AdvData = a list of [length | type | value] structures', 17, 800, '#14213d'))
yy = 430
for ln, ty, val, c, dashed in ads:
    col, light, border = STEP[c]
    dash = ' stroke-dasharray="8 6"' if dashed else ''
    s.raw(f'<rect x="130" y="{yy}" width="70" height="44" fill="#f8fafc" stroke="#64748b" stroke-width="2"/>'
          f'<rect x="200" y="{yy}" width="300" height="44" fill="#f8fafc" stroke="#64748b" stroke-width="2"/>'
          f'<rect x="500" y="{yy}" width="600" height="44" fill="{light}" stroke="{col}" stroke-width="2.5"{dash}/>')
    s.raw(T(165, yy + 28, ln, 15, 700, '#334155', 'middle'))
    s.raw(T(350, yy + 28, ty, 15, 700, '#334155', 'middle'))
    s.raw(T(800, yy + 28, val, 15, 700, col, 'middle'))
    yy += 52
s.raw(T(1130, 470, 'Exact tracker bytes are\nnot shown: no verified\ncapture is claimed here.', 15, 400, '#475569', italic=True))
s.f(4)
s.raw(panel(60, 560, 720, 250, 'blue', 4, 'Advertising vs a connection', None, 20))
s.raw(tag(130, 712, 30))
for k, py in enumerate((668, 720, 772)):
    s.raw(phone(330, py - 26, 26, 48, '#eff6ff'))
    s.arrow([(166, 712), (322, py)], 'signal')
s.raw(T(90, 790, 'one-way, anyone can hear', 14.5, 700, '#1e3a8a', 'start'))
s.raw(phone(470, 630, 40, 76, '#eff6ff'))
s.raw(phone(700, 630, 40, 76, '#eff6ff'))
s.biarrow([(518, 668), (692, 668)], 'signal')
s.raw(lock(592, 692, 0.55))
s.raw(T(605, 768, 'connection (GATT): agreed, two-way,', 14.5, 700, '#334155', 'middle'))
s.raw(T(605, 788, 'encrypted after pairing', 14.5, 700, '#6b21a8', 'middle'))
s.f(5)
s.raw(panel(820, 560, 720, 250, 'purple', 5, 'Addresses that change', None, 20))
s.raw(T(860, 650, 'Bluetooth privacy: a resolvable private address\nchanges every so often (interval set by the stack).\nDevices bonded with the owner can recognise it;\nstrangers see an unrelated value. Ecosystems such as\nFind My rotate their own identifiers too (Scene 28).', 16, 400, '#334155'))
scenes[26] = s.render('Legacy advertising, LE 1M PHY. Field widths not to scale.')


# ── 27 Why the tiny antenna works ───────────────────────────────────
s = Scene(27, 'Why a tiny antenna is enough — and when it is not',
          'Five frames. A 2.44 GHz wave with a wavelength of about 12.3 centimetres and a quarter wavelength of about 3.1 '
          'centimetres, next to a three-centimetre tracker; the compromises of an antenna that small, lower efficiency, '
          'narrower bandwidth and detuning by nearby objects; a link budget from 0 dBm transmitted, minus about 60 dB of '
          'free-space loss at 10 metres and an illustrative body loss, to a received level above the receiver’s '
          'sensitivity, leaving a margin; a person’s body absorbing the signal while a wall reflects another path; and '
          'range as a probability rather than a fixed number.',
          sub='At 2.4 GHz the wave is about 12 cm long. A quarter of it fits inside a coin-sized tag.')
s.f(1)
s.raw(panel(60, 160, 720, 270, 'blue', 1, 'Wavelength at 2.44 GHz', None, 20))
pts = ' '.join(f'{100 + i * 2},{300 - 40 * math.sin(2 * math.pi * i * 2 / 492):.1f}' for i in range(247))
s.raw(f'<polyline points="{pts}" fill="none" stroke="#1d4ed8" stroke-width="4"/>')
s.raw('<path d="M100,370 L592,370" stroke="#334155" stroke-width="2"/><path d="M100,362 L100,378 M592,362 L592,378 M223,364 L223,376" stroke="#334155" stroke-width="2"/>')
s.raw(T(346, 400, 'λ = c / f ≈ 12.3 cm', 17, 800, '#14213d', 'middle'))
s.raw(T(161, 356, 'λ/4 ≈ 3.1 cm', 14, 700, '#1e3a8a', 'middle'))
s.raw(tag(690, 300, 50))
s.raw(T(690, 380, 'tag ≈ 3 cm', 15, 700, '#334155', 'middle'))
s.f(2)
s.raw(callout(820, 160, 720, 170, 'Small antennas compromise',
              'Smaller than ideal → less efficient and narrower in frequency.\nA hand, a bag or metal nearby detunes it. Designers trade\nsize, battery and range; there is no free lunch.', 'amber', 2, 19, 16))
s.f(3)
s.raw(panel(60, 450, 820, 360, 'slate', 3, 'Link budget (illustrative values)', None, 20))
y0 = 530
lvl = lambda dbm: 160 + (dbm + 100) * 6.8   # x position for a dBm value
s.raw(f'<path d="M{lvl(-100):.0f},{y0 + 210} L{lvl(5):.0f},{y0 + 210}" stroke="#334155" stroke-width="2"/>')
for v in (-100, -80, -60, -40, -20, 0):
    s.raw(f'<path d="M{lvl(v):.0f},{y0 + 204} l0,12" stroke="#334155" stroke-width="2"/>')
    s.raw(T(lvl(v), y0 + 236, f'{v}', 13.5, 600, '#475569', 'middle'))
s.raw(T(lvl(5) + 6, y0 + 236, 'dBm', 13.5, 700, '#475569'))
bars = [('transmit 0 dBm', 0, '#1d4ed8'), ('after 10 m free space (−60 dB)', -60, '#3b82f6'),
        ('after a body in the way (−15 dB)', -75, '#93c5fd')]
for k, (lab, v, col) in enumerate(bars):
    yy = y0 + k * 44
    s.raw(f'<rect x="{lvl(-100):.0f}" y="{yy}" width="{lvl(v) - lvl(-100):.0f}" height="30" rx="4" fill="{col}"/>')
    if v > -20:
        s.raw(T(lvl(v) - 10, yy + 21, lab, 15, 700, '#ffffff', 'end'))
    else:
        s.raw(T(lvl(v) + 10, yy + 21, lab, 15, 700, '#14213d'))
s.raw(f'<path d="M{lvl(-95):.0f},{y0 - 10} L{lvl(-95):.0f},{y0 + 196}" stroke="#b91c1c" stroke-width="3" stroke-dasharray="8 6"/>')
s.raw(T(lvl(-95) + 8, y0 + 162, 'receiver sensitivity ≈ −95 dBm → margin ≈ 20 dB', 15, 700, '#b91c1c'))
s.f(4)
s.rect(920, 360, 620, 330, 'boxw', rx=16)
s.raw(T(944, 392, 'Direct path: absorbed by a body (mostly water).', 14.5, 700, '#334155'))
s.raw(T(944, 414, 'A bounce off the floor may still arrive (multipath).', 14.5, 400, '#475569'))
s.raw('<path d="M940,672 L1520,672" stroke="#a8a29e" stroke-width="6"/>')
s.raw(T(1520, 662, 'floor', 13.5, 700, '#57534e', 'end'))
s.raw(tag(980, 600, 26))
s.raw(person(1180, 440, 0.9, '#64748b'))
s.raw(phone(1370, 540, 50, 96, '#eff6ff'))
s.arrow([(1010, 600), (1140, 600)], 'signal')
s.raw('<path d="M1222,600 L1360,600" stroke="#1d4ed8" stroke-width="2" stroke-dasharray="4 8"/>')
s.arrow([(1004, 618), (1190, 668), (1362, 628)], 'signal')
s.f(5)
s.raw(callout(920, 710, 620, 100, 'Range is a probability', 'Same tag, same phone: metres one moment, nothing the next.', 'teal', 5, 19, 16))
scenes[27] = s.render('dB values illustrative except free-space loss (calculated).')


# ── 28 Privacy through identifier changes ───────────────────────────
s = Scene(28, 'Changing names: why a rotating identifier protects privacy',
          'Five frames. A tracker with a fixed identifier passes a café, a station and an office, and anyone with a '
          'scanner can link the three sightings into a path; a tracker whose identifier changes over time shows a '
          'passer-by three unrelated values; only the owner, who holds the key the identifiers come from, can link them; '
          'what rotation does not stop: radio fingerprinting, correlating one moving thing over time, long rotation '
          'intervals and implementation flaws; and a note that Find My identifiers are derived from rotating keys, with '
          'exact intervals known from independent research rather than Apple.',
          sub='A changing name stops casual linking. It does not make a tracker invisible.')
places = [(520, 'café'), (860, 'station'), (1200, 'office')]


def row(s, y, ids, colour, title, sub):
    s.raw(panel(60, y, 1480, 200, colour, None, None, None))
    s.raw(T(90, y + 46, title, 20, 800, '#14213d'))
    s.raw(T(90, y + 76, sub, 15.5, 400, '#334155'))
    for (x, name), idv in zip(places, ids):
        s.raw(store(x - 50, y + 40, 0.72))
        s.raw(T(x + 1, y + 150, name, 15, 700, '#334155', 'middle'))
        s.raw(f'<rect x="{x - 66}" y="{y + 160}" width="132" height="30" rx="6" fill="#ffffff" stroke="#16a34a" stroke-width="2"/>')
        s.raw(T(x, y + 181, idv, 15, 800, '#166534', 'middle', mono=True))


s.f(1)
row(s, 160, ['ID 7F3A', 'ID 7F3A', 'ID 7F3A'], 'red', 'Fixed identifier', 'the same name everywhere')
s.raw('<path d="M586,335 Q690,300 794,335 M926,335 Q1030,300 1134,335" fill="none" stroke="#b91c1c" stroke-width="3" stroke-dasharray="10 7"/>')
s.raw(eye(1380, 260, 0.9, '#b91c1c'))
s.raw(T(1416, 310, 'anyone with a scanner', 14, 700, '#b91c1c', 'middle'))
s.raw(T(1416, 330, 'links the path', 14, 700, '#b91c1c', 'middle'))
s.f(2)
row(s, 380, ['K1 · 2C9E', 'K2 · A417', 'K3 · 51D0'], 'green', 'Rotating identifier', 'a new name every so often')
s.raw(eye(1380, 480, 0.9, '#334155'))
s.raw(T(1416, 530, 'a passer-by sees', 14, 700, '#334155', 'middle'))
s.raw(T(1416, 550, 'unrelated values', 14, 700, '#334155', 'middle'))
s.f(3)
s.raw('<path d="M520,572 Q690,610 860,572 M860,572 Q1030,610 1200,572" fill="none" stroke="#7e22ce" stroke-width="3"/>')
s.raw(lock(200, 476, 0.8))
s.raw(T(250, 526, 'owner’s key links them', 15, 800, '#6b21a8'))
s.f(4)
s.rect(60, 610, 900, 200, 'hz', rx=18)
s.raw(badge(102, 654, 4, 'red', 24))
s.raw(T(140, 662, 'What rotation does not stop', 21, 800, '#14213d'))
s.raw(T(100, 702, '• radio fingerprinting (tiny differences in each transmitter)\n• one moving thing seen again and again along a route\n• long intervals between changes; implementation flaws', 16.5, 400, '#334155'))
s.f(5)
s.raw(callout(1000, 610, 540, 200, 'Find My, as documented',
              'Apple: identifiers come from rotating\npublic keys (Platform Security guide).\nExact intervals are known from\nindependent research, not Apple.', 'purple', 5, 19, 15.5))
scenes[28] = s.render('Identifier values are made up.')


# ── 29 Battery-life trade-off lab ───────────────────────────────────
s = Scene(29, 'Battery life is a budget',
          'Five frames. A CR2032-class coin cell of about 225 milliamp-hours nominal, with usable capacity lower under '
          'pulses and cold; the radio’s average current from the advertising duty cycle, about 11 microamps with '
          'illustrative values; the whole budget as a stacked bar, adding motion sensing, occasional sound and '
          'ultra-wideband or NFC sessions, and self-discharge, about 14 microamps in total; the estimated life, usable '
          'capacity divided by average current, about a year and a half with these assumptions; and the levers, speaking '
          'less often lasts longer but gives fewer chances to be heard.',
          sub='Every number on this page is an illustrative assumption. Real devices differ.')
s.f(1)
s.raw(coin_cell(220, 300, 110))
s.raw(callout(60, 440, 330, 200, 'The battery', 'CR2032-class: 3 V,\n~225 mAh nominal.\nUsable is less with\npulses, cold and age.', 'orange', 1, 19, 16))
s.f(2)
s.raw(panel(430, 160, 600, 270, 'blue', 2, 'Radio: the duty cycle', None, 20))
s.raw(T(470, 250, 'speaks 3 ms every 2 s → on 0.15% of the time', 16, 700, '#1e3a8a'))
for k in range(5):
    xx = 480 + k * 110
    s.raw(f'<rect x="{xx}" y="275" width="10" height="60" fill="#1d4ed8"/>')
s.raw('<path d="M470,335 L1000,335" stroke="#16a34a" stroke-width="3"/>')
s.raw(T(470, 380, 'I_avg ≈ 6 mA × 0.0015 + 2 µA ≈ 11 µA', 17, 800, '#14213d', mono=True))
s.raw(T(470, 408, 'radio events + sleep (from Scene 24)', 15, 400, '#475569'))
s.f(3)
s.raw(panel(1070, 160, 470, 480, 'slate', 3, 'Whole budget (µA)', None, 20))
budget = [('advertising', 9, '#1d4ed8'), ('sleep, timers', 2, '#16a34a'), ('motion sensing', 1.5, '#0d9488'),
          ('sound, UWB, NFC (averaged)', 1.5, '#b45309'), ('self-discharge', 0.3, '#6b7280')]
yb = 610
ly = 10_000
for lab, v, col in budget:
    h = v * 20
    s.raw(f'<rect x="1110" y="{yb - h:.0f}" width="90" height="{h:.0f}" fill="{col}" stroke="#ffffff" stroke-width="2"/>')
    ly = min(yb - h / 2 + 6, ly - 24)
    s.raw(T(1216, ly, f'{lab}: {v:g}', 15.5, 700, '#14213d'))
    yb -= h
s.raw(T(1110, yb - 18, 'total ≈ 14 µA', 18, 800, '#14213d'))
s.f(4)
s.raw(panel(430, 450, 600, 190, 'orange', 4, 'Estimated life', None, 20))
s.raw(T(470, 548, 'life ≈ usable capacity / I_avg', 17, 800, '#14213d', mono=True))
s.raw(T(470, 580, '≈ 180 mAh / 0.014 mA ≈ 12,600 h ≈ 1.4 years', 17, 700, '#9a3412', mono=True))
s.raw(T(470, 610, 'Apple states “more than a year” for AirTag (documented).', 14.5, 400, '#475569', italic=True))
s.f(5)
s.raw(panel(60, 660, 1480, 150, 'teal', 5, 'The levers trade against each other', None, 20))
s.raw(T(100, 745, 'Speak less often → longer life, fewer chances to be heard · Speak more quietly → longer life, shorter range', 16.5, 400, '#334155'))
s.raw(T(100, 773, 'More sensing or sound → shorter life · Cold weather → less usable capacity. Try the trade-offs in demo C below.', 16.5, 400, '#334155'))
scenes[29] = s.render('Illustrative assumptions throughout.')


# ── 30 Tracker vs beacon vs GPS tracker ─────────────────────────────
s = Scene(30, 'Three “trackers” that work in completely different ways',
          'Four frames in three columns and a comparison. A small item tracker of the AirTag class does not know where it '
          'is: it whispers over Bluetooth, a stranger’s phone nearby adds its own location and sends an encrypted report '
          'to a service the owner can query; a Bluetooth beacon fixed to a wall broadcasts the same identifier so apps on '
          'nearby phones can react, with no network of its own; a GPS tracker computes its own coordinates from satellite '
          'signals and reports them over a cellular network to a service; and a table comparing whether each knows where '
          'it is, how a location reaches anyone, its power and where it works.',
          sub='Same word, three different machines. Only one of them knows where it is.')
cols = [(60, 'blue', 'Item tracker (AirTag-class)'), (560, 'teal', 'BLE beacon'), (1060, 'amber', 'GPS + cellular tracker')]
s.f(1)
s.raw(panel(60, 160, 480, 400, 'blue', 1, cols[0][2], None, 20))
s.raw(tag(120, 330, 34))
s.raw(phone(210, 270, 64, 124, '#eff6ff'))
s.arrow([(156, 330), (204, 330)], 'signal')
s.raw(cloud(300, 250, 120))
s.arrow([(280, 300), (318, 300)], 'crypto')
s.raw(phone(450, 270, 64, 124, '#f5f3ff'))
s.arrow([(424, 300), (444, 300)], 'crypto')
s.raw(T(120, 430, 'whisper → a stranger’s phone adds its\nown location → encrypted report →\nonly the owner can read it (Module 5)', 15.5, 400, '#334155'))
s.raw(T(120, 530, 'Knows where it is? No.', 16, 800, '#1e3a8a'))
s.f(2)
s.raw(panel(560, 160, 480, 400, 'teal', 2, cols[1][2], None, 20))
s.raw('<rect x="600" y="240" width="20" height="200" fill="#d6d3d1"/>')
s.raw(beacon(630, 280, 0.9))
s.raw(waves(735, 312, 3, '#1d4ed8', 0.9))
s.raw(phone(880, 260, 64, 124, '#f0fdfa'))
s.arrow([(800, 330), (874, 330)], 'signal')
s.raw(T(630, 430, 'fixed ID on a wall → an app on a\nnearby phone reacts (“you are at\nthe exhibit”). No network of its own.', 15.5, 400, '#334155'))
s.raw(T(630, 530, 'Knows where it is? Only where it was fixed.', 15.5, 800, '#0f766e'))
s.f(3)
s.raw(panel(1060, 160, 480, 400, 'amber', 3, cols[2][2], None, 20))
s.raw(satellite(1140, 250, 0.7))
s.raw(satellite(1260, 236, 0.7))
s.raw(tracker_box(1110, 330, 0.7))
s.arrow([(1150, 262), (1170, 316)], 'signal')
s.arrow([(1260, 248), (1210, 316)], 'signal')
s.raw(tower(1340, 300, 0.6))
s.arrow([(1224, 370), (1320, 370)], 'signal')
s.raw(cloud(1390, 300, 120))
s.arrow([(1352, 340), (1400, 340)], 'crypto')
s.raw(T(1100, 460, 'computes its own coordinates (GNSS),\nsends them over cellular to a service.\nBigger battery; usually a subscription.', 15.5, 400, '#334155'))
s.raw(T(1100, 530, 'Knows where it is? Yes.', 16, 800, '#92400e'))
s.f(4)
rows = [('', 'Item tracker', 'BLE beacon', 'GPS tracker'),
        ('Knows its location', 'no', 'no (fixed place)', 'yes'),
        ('Location reaches someone via', 'strangers’ phones', 'the nearby app', 'its own cellular link'),
        ('Power (typical)', 'coin cell, a year or more', 'coin cell or mains', 'rechargeable, days–weeks')]
for r, cells in enumerate(rows):
    yy = 590 + r * 52
    for c, txt in enumerate(cells):
        xx = 60 + (0 if c == 0 else 300 + (c - 1) * 393)
        w = 300 if c == 0 else 393
        fill = '#f1f5f9' if r == 0 or c == 0 else '#ffffff'
        s.raw(f'<rect x="{xx}" y="{yy}" width="{w}" height="52" fill="{fill}" stroke="#cbd5e1" stroke-width="1.5"/>')
        s.raw(T(xx + 14, yy + 33, txt, 16, 800 if r == 0 or c == 0 else 400, '#14213d'))
scenes[30] = s.render('Generic devices. Radio arcs illustrative.')
