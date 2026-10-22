"""Module 4 phone-vertical scenes (23–30): the same scenes as module04.py, laid out for a
phone (VScene: 720 wide, body drawn in its own coordinates below the header).
Same title, desc, frames and words as the landscape scene; invisible-engine/tests/check.py
compares them. Change a scene's words in both files."""
import math
from .svgkit import VScene, wrap
from .art import *
from .module04 import tower

scenes = {}


# ── local helpers (phone type scale) ────────────────────────────────
def vchip(x, y, w, h, title, body, color='slate', n=28):
    c, light, border = STEP[color]
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{light}" stroke="{c}" stroke-width="2"/>'
            + T(x + 14, y + 32, title, 22, 800, '#14213d')
            + T(x + 14, y + 61, body if '\n' in body else '\n'.join(wrap(body, n)), 21, 400, '#475569'))


def layer(cx, cy, rx, ry, fill, stroke):
    return (f'<ellipse cx="{cx}" cy="{cy + 12}" rx="{rx}" ry="{ry}" fill="{stroke}" opacity="0.35"/>'
            f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{fill}" stroke="{stroke}" stroke-width="3"/>')


def vbeacon(x, y):
    """The wall beacon puck of module04.beacon at s=1, with phone-sized text."""
    return (f'<rect x="{x + 4}" y="{y + 6}" width="110" height="70" rx="20" fill="#0f172a" opacity="0.13"/>'
            f'<rect x="{x}" y="{y}" width="110" height="70" rx="20" fill="#f8fafc" stroke="#64748b" stroke-width="3"/>'
            f'<circle cx="{x + 28}" cy="{y + 35}" r="9" fill="#2563eb"/>'
            + T(x + 70, y + 42, 'BLE', 20, 800, '#334155', 'middle'))


def vtracker_box(x, y):
    """art.tracker_box at s=1, with phone-sized text."""
    return (f'<rect x="{x + 4}" y="{y + 6}" width="160" height="100" rx="16" fill="#0f172a" opacity="0.13"/>'
            f'<rect x="{x}" y="{y}" width="160" height="100" rx="16" fill="#334155"/>'
            f'<rect x="{x + 120}" y="{y - 30}" width="12" height="34" rx="4" fill="#334155"/>'
            f'<rect x="{x + 14}" y="{y + 16}" width="76" height="34" rx="5" fill="#0ea5e9"/>'
            + T(x + 52, y + 40, 'GPS', 20, 800, '#ffffff', 'middle')
            + f'<circle cx="{x + 130}" cy="{y + 70}" r="7" fill="#22c55e"/>')


def para(x, y, text, n, size=21, weight=400, fill='#334155', anchor='start', italic=False, mono=False):
    return T(x, y, '\n'.join(wrap(text, n)), size, weight, fill, anchor, italic, mono)


# ── 23 Tiny tracker cutaway ─────────────────────────────────────────
s = VScene(23, 'Inside a tiny tracker',
           'Five frames. The outside of a small round item tracker of the AirTag class, about three centimetres across, '
           'with no screen, no GPS and no SIM; the tracker opened into three illustrative layers, a top cover with a speaker, '
           'a circuit board and a coin-cell battery under a cover; the power parts, a CR2032-class coin cell and power '
           'management, feeding the rest; the radio parts, a microcontroller with a Bluetooth Low Energy radio, a 2.4 GHz '
           'antenna, an ultra-wideband radio and an NFC interface; and the remaining parts, a speaker and an accelerometer, '
           'with a note that the layout is illustrative, not a teardown.',
           sub='A coin cell, a few radios and a speaker. The layout is illustrative, not a teardown.',
           note='Generic tracker; not a specific product’s board.', h=1700)
s.f(1)
s.raw(tag(120, 76, 64))
s.raw('<path d="M56,164 L184,164" stroke="#334155" stroke-width="2"/><path d="M56,156 L56,172 M184,156 L184,172" stroke="#334155" stroke-width="2"/>')
s.raw(T(120, 198, 'about 3 cm across', 21, 700, '#334155', 'middle'))
s.raw(callout(270, 0, 410, 150, 'The outside', 'A small item tracker\n(AirTag-class). No screen,\nno GPS, no SIM card.', 'blue', 1, 26, 21))
s.f(2)
s.raw('<path d="M140,262 L140,520" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 8"/>')
LAYERS = [(292, '#f1f5f9', '#94a3b8', 'Top cover + speaker', None),
          (392, '#dcfce7', '#16a34a', 'Circuit board', 'radios · microcontroller · antennas'),
          (492, '#e5e7eb', '#6b7280', 'Coin cell + cover', 'user-replaceable')]
for cy, fill, stroke, title, sub in LAYERS:
    s.raw(layer(140, cy, 100, 30, fill, stroke))
    s.raw(T(278, cy + (8 if sub is None else -4), title, 22, 800, '#14213d'))
    if sub:
        s.raw(T(278, cy + 23, sub, 21, 400, '#334155'))
s.text(278, 558, 'Illustrative layout, not a teardown.', 'note')
blocks = [
    (3, 'Coin cell (CR2032)', '3 V lithium, ~225 mAh nominal', 'orange'),
    (3, 'Power management', 'steady supply, sleep modes', 'orange'),
    (4, 'Microcontroller', 'runs the firmware', 'slate'),
    (4, 'Bluetooth LE radio', 'whispers on 2.4 GHz', 'blue'),
    (4, '2.4 GHz antenna', 'tiny, compromised\n(Scene 27)', 'blue'),
    (4, 'UWB radio', 'Apple U1: nearby ranging', 'teal'),
    (4, 'NFC interface', 'tap for Lost Mode info', 'green'),
    (5, 'Speaker', 'plays a sound to be found', 'slate'),
    (5, 'Accelerometer', 'senses motion', 'slate'),
    (5, 'Firmware details', 'not publicly disclosed', 'slate'),
]
for i, (fr, t, b, c) in enumerate(blocks):
    s.f(fr)
    s.raw(vchip(40 + (i % 2) * 325, 578 + (i // 2) * 105, 315, 100, t, b, c))
s.f(3)
s.arrow([(256, 480), (256, 416)], 'energy')
s.raw(T(270, 456, 'power', 21, 700, '#c2410c'))
s.f(4)
s.raw(waves(194, 76, 3, '#1d4ed8', 0.9))
s.raw(T(40, 236, 'radio (illustrative)', 20, 600, '#1d4ed8'))
s.f(5)
s.raw(callout(40, 1108, 640, 162, 'Documented parts, illustrative layout',
              'Apple lists Bluetooth LE, a U1 chip (UWB), NFC, a\nspeaker, an accelerometer and a user-replaceable\n'
              'CR2032. Exact boards, chips and firmware are not\nshown here.', 'slate', 5, 26, 21))
scenes[23] = s.render()


# ── 24 Advertisement pulse timeline ─────────────────────────────────
s = VScene(24, 'The whisper is a pulse, not a stream',
           'Five frames. A chart of the tracker’s supply current against time: a low sleep current of a few microamps; a '
           'brief advertising event in which the radio transmits the same short packet on three channels in a few '
           'milliseconds, at a few milliamps; the events repeating after an advertising interval plus a small random '
           'delay; the average current, a dashed line only just above sleep, set mostly by how often the tracker speaks; '
           'and a worked example of average current and power with illustrative values.',
           sub='Asleep almost all the time; awake for a few milliseconds to speak. Values are illustrative.',
           note='Not to scale. Not a measurement of any product.', h=1580)
X0, X1, YB, YT = 130, 640, 360, 70
s.raw(f'<path d="M{X0},{YT - 20} L{X0},{YB + 10} L{X1 + 10},{YB + 10}" fill="none" stroke="#334155" stroke-width="3"/>'
      f'<path d="M{X1 + 10},{YB + 2} L{X1 + 26},{YB + 10} L{X1 + 10},{YB + 18} Z" fill="#334155"/>'
      f'<path d="M{X0 - 8},{YT - 20} L{X0},{YT - 36} L{X0 + 8},{YT - 20} Z" fill="#334155"/>')
s.raw(T(680, YB + 46, 'time →', 21, 700, '#334155', 'end'))
s.raw(T(X0 - 12, YT - 48, 'supply current', 21, 700, '#334155'))
s.raw(f'<path d="M{X0 - 10},{YB - 70} l20,-8 M{X0 - 10},{YB - 60} l20,-8" stroke="#334155" stroke-width="2"/>')
s.raw(T(X0 - 18, YB - 96, 'axis\nbroken', 20, 400, '#475569', 'end'))
spikes = [245, 452, 632]
s.f(1)
s.raw(f'<path d="M{X0},{YB} L{X1},{YB}" stroke="#16a34a" stroke-width="4"/>')
s.raw(T(X0 + 18, YB - 52, 'sleep:\na few µA', 20, 700, '#166534'))
s.f(2)
s.raw(f'<rect x="{spikes[0] - 10}" y="{YT + 30}" width="20" height="{YB - YT - 30}" fill="#1d4ed8"/>')
s.raw(T(spikes[0] + 20, YT + 46, 'advertising\nevent', 21, 700, '#1e3a8a'))
s.raw(T(spikes[0] + 20, YT + 108, 'a few mA\nfor a few ms', 20, 400, '#334155'))
s.rect(40, 520, 640, 262, 'boxw', rx=14)
s.raw(T(64, 556, 'Zoom: one advertising event', 22, 800, '#14213d'))
for j, ch in enumerate((37, 38, 39)):
    px = 120 + j * 190
    s.raw(f'<rect x="{px}" y="580" width="90" height="110" rx="4" fill="#1d4ed8"/>')
    s.raw(T(px + 45, 718, f'ch {ch}', 21, 700, '#1e3a8a', 'middle'))
s.raw('<path d="M64,690 L656,690" stroke="#16a34a" stroke-width="3"/>')
s.raw(T(64, 758, 'Same packet on three channels; ≈ a few ms total', 20, 400, '#475569'))
s.f(3)
for x in spikes[1:]:
    s.raw(f'<rect x="{x - 10}" y="{YT + 30}" width="20" height="{YB - YT - 30}" fill="#1d4ed8"/>')
s.raw(f'<path d="M{spikes[0]},{YB + 40} L{spikes[1]},{YB + 40}" stroke="#334155" stroke-width="2"/>'
      f'<path d="M{spikes[0]},{YB + 32} l0,16 M{spikes[1]},{YB + 32} l0,16" stroke="#334155" stroke-width="2"/>')
s.raw(T(40, YB + 78, 'interval T (illustrative) + random 0–10 ms', 21, 700, '#334155'))
s.raw(T(40, YB + 108, 'the random delay stops two devices', 20, 400, '#475569'))
s.raw(T(40, YB + 134, 'colliding again and again', 20, 400, '#475569'))
s.f(4)
s.raw(f'<path d="M{X0},{YB - 18} L{X1},{YB - 18}" stroke="#c2410c" stroke-width="3" stroke-dasharray="12 8"/>')
s.raw(T(spikes[0] + 18, YB - 30, 'average current', 20, 800, '#9a3412'))
s.raw(callout(40, 798, 640, 140, 'Average current',
              'I_avg = (I_tx × t_on + I_sleep × (T − t_on)) / T\nSet mostly by how often it speaks (T), not how loudly.\n'
              'Speak twice as often → roughly twice the radio drain.', 'orange', 4, 26, 21))
s.f(5)
s.raw(callout(40, 952, 640, 140, 'Worked example (illustrative values)',
              'I_tx = 6 mA, t_on = 3 ms, T = 2 s, I_sleep = 2 µA\nI_avg ≈ (18 µA·s + 4 µA·s) / 2 s ≈ 11 µA\n'
              'Power ≈ 3 V × 11 µA ≈ 33 µW (radio and sleep only)', 'blue', 5, 26, 21))
scenes[24] = s.render()


# ── 25 Whisper to scanner ───────────────────────────────────────────
s = VScene(25, 'A whisper anyone nearby can hear',
           'Five frames. A small tracker broadcasts the same advertising packet on Bluetooth LE advertising channels 37, '
           '38 and 39, at 2402, 2426 and 2480 MHz, out of forty 2 MHz channels in the 2.4 GHz band; a passer-by’s phone, '
           'scanning, receives one copy while it happens to listen on that channel; no connection, pairing or reply is '
           'needed to receive a broadcast; reception is probabilistic because the tracker’s events and the phone’s scan '
           'windows must overlap, and walls, bodies and other radios interfere; and the phone checks the packet’s '
           'format and only acts on packets its software is built to recognise.',
           sub='Advertising is a broadcast. Hearing it needs no pairing, no connection and no reply.',
           note='Channel positions to scale; timing not to scale.', h=1684)
BX0, BX1 = 40, 680
fx = lambda f: BX0 + (f - 2400) / 83.5 * (BX1 - BX0)
s.raw(f'<rect x="{BX0}" y="40" width="{BX1 - BX0}" height="60" rx="6" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/>')
for k in range(40):
    xx = fx(2402 + 2 * k)
    s.raw(f'<line x1="{xx:.0f}" y1="54" x2="{xx:.0f}" y2="86" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(T(BX0, 26, '2400 MHz', 20, 600, '#475569'))
s.raw(T(BX1, 26, '2483.5 MHz', 20, 600, '#475569', 'end'))
s.raw(T((BX0 + BX1) / 2 - 10, 26, '40 channels × 2 MHz', 21, 700, '#334155', 'middle'))
s.raw(tag(110, 300, 62))
s.raw(T(110, 394, 'small tracker', 21, 700, '#334155', 'middle'))
s.raw(person(624, 190, 0.95, '#475569', phone_in_hand=True))
s.raw(phone(430, 170, 130, 260, '#eff6ff'))
s.raw(T(495, 296, 'scanning', 21, 700, '#1e3a8a', 'middle'))
s.raw(T(495, 322, '(listening)', 20, 400, '#475569', 'middle'))
s.f(1)
for f, ch, anc, tx in ((2402, 37, 'start', 40), (2426, 38, 'middle', None), (2480, 39, 'end', 680)):
    xx = fx(f)
    s.raw(f'<rect x="{xx - 9:.0f}" y="44" width="18" height="52" rx="3" fill="#1d4ed8"/>')
    s.raw(T(tx if tx else xx, 128, f'ch {ch} · {f}', 20, 700, '#1e3a8a', anc))
s.raw(waves(172, 300, 3, '#1d4ed8', 0.9))
s.raw(callout(40, 440, 640, 126, 'One packet, three channels', 'The tracker repeats the same advertising\npacket on 37, 38, 39.', 'blue', 1, 26, 21))
s.f(2)
s.arrow([(236, 300), (424, 300)], 'signal')
s.label(308, 218, 'advertising packet\n(one copy heard)', 'signal')
s.f(3)
s.raw(callout(40, 580, 640, 160, 'No pairing, no connection, no reply',
              'Any receiver in range that is listening on the\nchannel can pick up the broadcast. The tracker\nnever learns who heard.', 'green', 3, 26, 21))
s.f(4)
s.raw(panel(40, 754, 640, 236, 'slate', 4, 'Hearing is a matter of chance', None, 24))
s.raw(T(70, 862, 'tracker speaks', 20, 700, '#1e3a8a'))
s.raw(T(70, 924, 'phone listens', 20, 700, '#334155'))
for k, xx in enumerate(range(270, 680, 95)):
    s.raw(f'<rect x="{xx}" y="842" width="8" height="28" fill="#1d4ed8"/>')
for xx, w in ((258, 34), (448, 34), (638, 34)):
    s.raw(f'<rect x="{xx}" y="904" width="{w}" height="28" rx="4" fill="#cbd5e1"/>')
for xx, ok in ((270, True), (365, False), (460, True), (555, False), (650, True)):
    s.raw(T(xx + 4, 968, '✓' if ok else '✗', 22, 800, '#166534' if ok else '#b91c1c', 'middle'))
s.f(5)
s.raw(callout(40, 1004, 640, 160, 'Decode or ignore',
              'The phone checks the CRC and the data format. It acts\nonly on packets its software is built to recognise\n(Module 5).', 'teal', 5, 26, 21))
s.text(40, 1196, 'Radio arcs are illustrative, not visible waves.', 'note')
scenes[25] = s.render()


# ── 26 Advertising packet anatomy ───────────────────────────────────
s = VScene(26, 'What is in an advertising packet',
           'Five frames. A Bluetooth LE legacy advertising packet on the 1M PHY as a strip of fields: a 1-byte preamble, a '
           '4-byte access address, a 2-byte PDU header, a 6-byte advertiser address, up to 31 bytes of advertising data and '
           'a 3-byte CRC; what each field is for; the advertising data as a list of length-type-value structures, one of '
           'which an ecosystem can use for its own short-lived identifier, shown conceptually; advertising, a one-way '
           'broadcast anyone can hear, contrasted with a connection, where two devices agree to talk and can encrypt after '
           'pairing; and changing addresses for privacy.',
           sub='Educational field layout from the Bluetooth Core Specification. Not a capture of any product.',
           note='Legacy advertising, LE 1M PHY. Field widths not to scale.', h=1664)
fields = [('Preamble', '1 B', 48, 'slate'), ('Access address', '4 B', 60, 'slate'), ('Header', '2 B', 52, 'amber'),
          ('Advertiser address (AdvA)', '6 B', 58, 'teal'), ('Advertising data\n(AdvData)', '≤ 31 B', 80, 'green'), ('CRC', '3 B', 60, 'slate')]
s.f(1)
y = 0
pos = {}
for name, size, h, c in fields:
    col, light, border = STEP[c]
    s.raw(f'<rect x="40" y="{y}" width="360" height="{h}" fill="{light}" stroke="{col}" stroke-width="2.5"/>')
    s.raw(T(56, y + h / 2 + 8 - 13 * name.count('\n'), name, 21, 800, '#14213d'))
    s.raw(T(384, y + h / 2 + 8, size, 21, 600, col, 'end'))
    pos[name] = (y, h)
    y += h
top_, _ = pos['Header']
ad_y, ad_h = pos['Advertising data\n(AdvData)']
s.raw(f'<path d="M412,{top_} L412,{ad_y + ad_h}" stroke="#334155" stroke-width="2"/>'
      f'<path d="M404,{top_} L420,{top_} M404,{ad_y + ad_h} L420,{ad_y + ad_h}" stroke="#334155" stroke-width="2"/>')
s.raw(T(432, pos['Advertiser address (AdvA)'][0] + 40, 'PDU (header +\npayload)', 21, 700, '#334155'))
s.f(2)
expl = [('Preamble', 'bit-timing sync'), ('Access address', '0x8E89BED6\nfor advertising'), ('Header', 'packet type + length'),
        ('CRC', 'catches errors,\nnot attackers')]
for name, txt in expl:
    y0, h = pos[name]
    n = txt.count('\n')
    s.raw(T(432, y0 + h / 2 + 7 - 12 * n, txt, 20, 400, '#334155'))
s.f(3)
s.raw(f'<path d="M40,{ad_y + 18} L24,{ad_y + 18} L24,445 L40,445" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5 6"/>')
ads = [('len', 'type: flags', 'value', 'green', False), ('len', 'type: manufacturer\ndata', 'ecosystem’s short-lived\nidentifier (conceptual)', 'purple', True)]
s.raw(T(40, 402, 'AdvData = a list of [length | type | value] structures', 21, 800, '#14213d'))
yy = 420
for ln, ty, val, c, dashed in ads:
    col, light, border = STEP[c]
    dash = ' stroke-dasharray="8 6"' if dashed else ''
    h = 76 if '\n' in ty else 50
    s.raw(f'<rect x="40" y="{yy}" width="70" height="{h}" fill="#f8fafc" stroke="#64748b" stroke-width="2"/>'
          f'<rect x="110" y="{yy}" width="220" height="{h}" fill="#f8fafc" stroke="#64748b" stroke-width="2"/>'
          f'<rect x="330" y="{yy}" width="350" height="{h}" fill="{light}" stroke="{col}" stroke-width="2.5"{dash}/>')
    off = 7 - 13 * ty.count('\n')
    s.raw(T(75, yy + h / 2 + 7, ln, 20, 700, '#334155', 'middle'))
    s.raw(T(220, yy + h / 2 + off, ty, 20, 700, '#334155', 'middle'))
    s.raw(T(505, yy + h / 2 + off, val, 20, 700, col, 'middle'))
    yy += h + 8
s.raw(T(40, yy + 22, 'Exact tracker bytes are not shown: no verified\ncapture is claimed here.', 20, 400, '#475569', italic=True))
s.f(4)
P = 632
s.raw(panel(40, P, 640, 276, 'blue', 4, 'Advertising vs a connection', None, 24))
s.raw(tag(100, P + 152, 32))
for k, py in enumerate((P + 100, P + 152, P + 204)):
    s.raw(phone(250, py - 22, 26, 44, '#eff6ff'))
    s.arrow([(136, P + 152), (242, py)], 'signal')
s.raw(T(64, P + 256, 'one-way, anyone can hear', 21, 700, '#1e3a8a'))
s.raw(phone(372, P + 78, 46, 86, '#eff6ff'))
s.raw(phone(612, P + 78, 46, 86, '#eff6ff'))
s.biarrow([(426, P + 110), (604, P + 110)], 'signal')
s.raw(lock(502, P + 124, 0.55))
s.raw(T(516, P + 200, 'connection (GATT):\nagreed, two-way,', 20, 700, '#334155', 'middle'))
s.raw(T(516, P + 252, 'encrypted after pairing', 20, 700, '#6b21a8', 'middle'))
s.f(5)
P2 = 922
s.raw(panel(40, P2, 640, 232, 'purple', 5, 'Addresses that change', None, 24))
s.raw(T(64, P2 + 98, 'Bluetooth privacy: a resolvable private address changes\nevery so often (interval set by the stack). Devices\n'
        'bonded with the owner can recognise it; strangers see an\nunrelated value. Ecosystems such as Find My rotate\n'
        'their own identifiers too (Scene 28).', 21, 400, '#334155'))
scenes[26] = s.render()


# ── 27 Why the tiny antenna works ───────────────────────────────────
s = VScene(27, 'Why a tiny antenna is enough — and when it is not',
           'Five frames. A 2.44 GHz wave with a wavelength of about 12.3 centimetres and a quarter wavelength of about 3.1 '
           'centimetres, next to a three-centimetre tracker; the compromises of an antenna that small, lower efficiency, '
           'narrower bandwidth and detuning by nearby objects; a link budget from 0 dBm transmitted, minus about 60 dB of '
           'free-space loss at 10 metres and an illustrative body loss, to a received level above the receiver’s '
           'sensitivity, leaving a margin; a person’s body absorbing the signal while a wall reflects another path; and '
           'range as a probability rather than a fixed number.',
           sub='At 2.4 GHz the wave is about 12 cm long. A quarter of it fits inside a coin-sized tag.',
           note='dB values illustrative except free-space loss (calculated).', h=1698)
s.f(1)
s.raw(panel(40, 0, 640, 244, 'blue', 1, 'Wavelength at 2.44 GHz', None, 24))
WL, WX = 440, 70
pts = ' '.join(f'{WX + i * 2},{128 - 34 * math.sin(2 * math.pi * i * 2 / WL):.1f}' for i in range(WL // 2 + 1))
s.raw(f'<polyline points="{pts}" fill="none" stroke="#1d4ed8" stroke-width="4"/>')
s.raw(f'<path d="M{WX},196 L{WX + WL},196" stroke="#334155" stroke-width="2"/>'
      f'<path d="M{WX},188 L{WX},204 M{WX + WL},188 L{WX + WL},204 M{WX + WL // 4},190 L{WX + WL // 4},202" stroke="#334155" stroke-width="2"/>')
s.raw(T(WX + WL / 2, 228, 'λ = c / f ≈ 12.3 cm', 22, 800, '#14213d', 'middle'))
s.raw(T(WX + WL / 8, 182, 'λ/4 ≈ 3.1 cm', 20, 700, '#1e3a8a', 'middle'))
s.raw(tag(606, 128, 46))
s.raw(T(606, 204, 'tag ≈ 3 cm', 20, 700, '#334155', 'middle'))
s.f(2)
s.raw(callout(40, 254, 640, 180, 'Small antennas compromise',
              'Smaller than ideal → less efficient and narrower in\nfrequency. A hand, a bag or metal nearby detunes\n'
              'it. Designers trade size, battery and range; there\nis no free lunch.', 'amber', 2, 26, 21))
s.f(3)
P = 446
s.raw(panel(40, P, 640, 300, 'slate', 3, 'Link budget (illustrative values)', None, 24))
lvl = lambda dbm: 70 + (dbm + 100) * 5.2   # x position for a dBm value
y0 = P + 84
s.raw(f'<path d="M{lvl(-100):.0f},{P + 246} L{lvl(5):.0f},{P + 246}" stroke="#334155" stroke-width="2"/>')
for v in (-100, -80, -60, -40, -20, 0):
    s.raw(f'<path d="M{lvl(v):.0f},{P + 240} l0,12" stroke="#334155" stroke-width="2"/>')
    s.raw(T(lvl(v), P + 276, f'{v}', 20, 600, '#475569', 'middle'))
s.raw(T(lvl(5) + 6, P + 276, 'dBm', 20, 700, '#475569'))
bars = [('transmit 0 dBm', 0, '#1d4ed8'), ('after 10 m free space (−60 dB)', -60, '#3b82f6'),
        ('after a body in the way (−15 dB)', -75, '#93c5fd')]
for k, (lab, v, col) in enumerate(bars):
    yy = y0 + k * 40
    s.raw(f'<rect x="{lvl(-100):.0f}" y="{yy}" width="{lvl(v) - lvl(-100):.0f}" height="32" rx="4" fill="{col}"/>')
    if v > -20:
        s.raw(T(lvl(v) - 10, yy + 23, lab, 20, 700, '#ffffff', 'end'))
    else:
        s.raw(T(lvl(v) + 10, yy + 23, lab, 20, 700, '#14213d'))
s.raw(f'<path d="M{lvl(-95):.0f},{y0 - 6} L{lvl(-95):.0f},{P + 236}" stroke="#b91c1c" stroke-width="3" stroke-dasharray="8 6"/>')
s.raw(T(lvl(-95) + 10, P + 226, 'receiver sensitivity ≈ −95 dBm → margin ≈ 20 dB', 20, 700, '#b91c1c'))
s.f(4)
B = 758
s.rect(40, B, 640, 240, 'boxw', rx=16)
s.raw(T(60, B + 34, 'Direct path: absorbed by a body (mostly water).', 20, 700, '#334155'))
s.raw(T(60, B + 60, 'A bounce off the floor may still arrive (multipath).', 20, 400, '#475569'))
s.raw(f'<path d="M60,{B + 222} L660,{B + 222}" stroke="#a8a29e" stroke-width="6"/>')
s.raw(T(660, B + 210, 'floor', 20, 700, '#57534e', 'end'))
s.raw(tag(110, B + 150, 26))
s.raw(person(330, B + 76, 0.62, '#64748b'))
s.raw(phone(540, B + 104, 50, 92, '#eff6ff'))
s.arrow([(140, B + 150), (300, B + 150)], 'signal')
s.raw(f'<path d="M362,{B + 150} L530,{B + 150}" stroke="#1d4ed8" stroke-width="2" stroke-dasharray="4 8"/>')
s.arrow([(134, B + 168), (330, B + 212), (532, B + 178)], 'signal')
s.f(5)
s.raw(callout(40, 1010, 640, 126, 'Range is a probability', 'Same tag, same phone: metres one moment,\nnothing the next.', 'teal', 5, 26, 21))
scenes[27] = s.render()


# ── 28 Privacy through identifier changes ───────────────────────────
s = VScene(28, 'Changing names: why a rotating identifier protects privacy',
           'Five frames. A tracker with a fixed identifier passes a café, a station and an office, and anyone with a '
           'scanner can link the three sightings into a path; a tracker whose identifier changes over time shows a '
           'passer-by three unrelated values; only the owner, who holds the key the identifiers come from, can link them; '
           'what rotation does not stop: radio fingerprinting, correlating one moving thing over time, long rotation '
           'intervals and implementation flaws; and a note that Find My identifiers are derived from rotating keys, with '
           'Apple documents a key change about every 15 minutes; behaviour while separated from the owner comes from independent research.',
           sub='A changing name stops casual linking. It does not make a tracker invisible.',
           note='Identifier values are made up.', h=1653)
places = [(150, 'café'), (360, 'station'), (570, 'office')]


def row(s, y, ids, colour, title, sub, h=300):
    s.raw(panel(40, y, 640, h, colour, None, None, None))
    s.raw(T(64, y + 42, title, 24, 800, '#14213d'))
    s.raw(T(64, y + 72, sub, 21, 400, '#334155'))
    for (x, name), idv in zip(places, ids):
        s.raw(store(x - 50, y + 86, 0.72))
        s.raw(T(x + 1, y + 200, name, 21, 700, '#334155', 'middle'))
        s.raw(f'<rect x="{x - 72}" y="{y + 210}" width="144" height="36" rx="6" fill="#ffffff" stroke="#16a34a" stroke-width="2"/>')
        s.raw(T(x, y + 235, idv, 20, 800, '#166534', 'middle', mono=True))


s.f(1)
row(s, 0, ['ID 7F3A', 'ID 7F3A', 'ID 7F3A'], 'red', 'Fixed identifier', 'the same name everywhere')
s.raw('<path d="M222,214 Q255,186 288,214 M432,214 Q465,186 498,214" fill="none" stroke="#b91c1c" stroke-width="3" stroke-dasharray="10 7"/>')
s.raw(eye(64, 272, 0.7, '#b91c1c'))
s.raw(T(132, 280, 'anyone with a scanner', 20, 700, '#b91c1c'))
s.raw(T(372, 280, 'links the path', 20, 700, '#b91c1c'))
s.f(2)
row(s, 314, ['K1 · 2C9E', 'K2 · A417', 'K3 · 51D0'], 'green', 'Rotating identifier', 'a new name every so often', 312)
s.raw(eye(64, 600, 0.7, '#334155'))
s.raw(T(132, 608, 'a passer-by sees', 20, 700, '#334155'))
s.raw(T(304, 608, 'unrelated values', 20, 700, '#334155'))
s.f(3)
s.raw('<path d="M150,561 Q255,600 360,561 M360,561 Q465,600 570,561" fill="none" stroke="#7e22ce" stroke-width="3"/>')
s.raw(lock(64, 636, 0.8))
s.raw(T(118, 680, 'owner’s key links them', 21, 800, '#6b21a8'))
s.f(4)
s.rect(40, 712, 640, 232, 'hz', rx=18)
s.raw(badge(80, 754, 4, 'red', 24))
s.raw(T(118, 764, 'What rotation does not stop', 24, 800, '#14213d'))
s.raw(T(64, 806, '• radio fingerprinting (tiny differences in each\ntransmitter)\n• one moving thing seen again and again along a route\n'
        '• long intervals between changes; implementation\nflaws', 21, 400, '#334155'))
s.f(5)
s.raw(callout(40, 958, 640, 160, 'Find My, as documented',
              'Apple: identifiers come from rotating public keys,\nchanged about every 15 minutes (Find My security\n'
              'guide). Separated-tag behaviour: research.', 'purple', 5, 26, 21))
scenes[28] = s.render()


# ── 29 Battery-life trade-off lab ───────────────────────────────────
s = VScene(29, 'Battery life is a budget',
           'Five frames. A CR2032-class coin cell of about 225 milliamp-hours nominal, with usable capacity lower under '
           'pulses and cold; the radio’s average current from the advertising duty cycle, about 11 microamps with '
           'illustrative values; the whole budget as a stacked bar, adding motion sensing, occasional sound and '
           'ultra-wideband or NFC sessions, and self-discharge, about 14 microamps in total; the estimated life, usable '
           'capacity divided by average current, about a year and a half with these assumptions; and the levers, speaking '
           'less often lasts longer but gives fewer chances to be heard.',
           sub='Every number on this page is an illustrative assumption. Real devices differ.',
           note='Illustrative assumptions throughout.', h=1723)
s.f(1)
s.raw(coin_cell(120, 86, 72))
s.raw(callout(240, 0, 440, 172, 'The battery', 'CR2032-class: 3 V, ~225 mAh\nnominal. Usable is less with\npulses, cold and age.', 'orange', 1, 26, 21))
s.f(2)
P = 186
s.raw(panel(40, P, 640, 262, 'blue', 2, 'Radio: the duty cycle', None, 24))
s.raw(T(64, P + 96, 'speaks 3 ms every 2 s → on 0.15% of the time', 21, 700, '#1e3a8a'))
for k in range(5):
    s.raw(f'<rect x="{80 + k * 120}" y="{P + 116}" width="10" height="56" fill="#1d4ed8"/>')
s.raw(f'<path d="M64,{P + 172} L656,{P + 172}" stroke="#16a34a" stroke-width="3"/>')
s.raw(T(64, P + 212, 'I_avg ≈ 6 mA × 0.0015 + 2 µA ≈ 11 µA', 21, 800, '#14213d', mono=True))
s.raw(T(64, P + 242, 'radio events + sleep (from Scene 24)', 21, 400, '#475569'))
s.f(3)
P = 462
s.raw(panel(40, P, 640, 390, 'slate', 3, 'Whole budget (µA)', None, 24))
budget = [('advertising', 9, '#1d4ed8'), ('sleep, timers', 2, '#16a34a'), ('motion sensing', 1.5, '#0d9488'),
          ('sound, UWB, NFC (averaged)', 1.5, '#b45309'), ('self-discharge', 0.3, '#6b7280')]
yb = P + 368
segs = []
for lab, v, col in budget:
    h = v * 18
    s.raw(f'<rect x="80" y="{yb - h:.0f}" width="100" height="{h:.0f}" fill="{col}" stroke="#ffffff" stroke-width="2"/>')
    segs.append((yb - h / 2 + 7, f'{lab}: {v:g}'))
    yb -= h
ly = yb - 30   # labels from the top down, at least 32 apart, each at its segment where possible
for cy, txt in reversed(segs):
    ly = max(cy, ly + 32)
    s.raw(T(200, ly, txt, 21, 700, '#14213d'))
s.raw(T(80, yb - 18, 'total ≈ 14 µA', 22, 800, '#14213d'))
s.f(4)
P = 866
s.raw(panel(40, P, 640, 180, 'orange', 4, 'Estimated life', None, 24))
s.raw(T(64, P + 96, 'life ≈ usable capacity / I_avg', 21, 800, '#14213d', mono=True))
s.raw(T(64, P + 128, '≈ 180 mAh / 0.014 mA ≈ 12,600 h ≈ 1.4 years', 21, 700, '#9a3412', mono=True))
s.raw(T(64, P + 160, 'Apple states “more than a year” for AirTag (documented).', 20, 400, '#475569', italic=True))
s.f(5)
P = 1060
s.raw(panel(40, P, 640, 232, 'teal', 5, 'The levers trade against each other', None, 24))
s.raw(T(64, P + 98, 'Speak less often → longer life, fewer chances to be\nheard · Speak more quietly → longer life, shorter range', 21, 400, '#334155'))
s.raw(T(64, P + 158, 'More sensing or sound → shorter life · Cold weather →\nless usable capacity. Try the trade-offs in demo C\nbelow.', 21, 400, '#334155'))
scenes[29] = s.render()


# ── 30 Tracker vs beacon vs GPS tracker ─────────────────────────────
s = VScene(30, 'Three “trackers” that work in completely different ways',
           'Four frames in three columns and a comparison. A small item tracker of the AirTag class does not know where it '
           'is: it whispers over Bluetooth, a stranger’s phone nearby adds its own location and sends an encrypted report '
           'to a service the owner can query; a Bluetooth beacon fixed to a wall broadcasts the same identifier so apps on '
           'nearby phones can react, with no network of its own; a GPS tracker computes its own coordinates from satellite '
           'signals and reports them over a cellular network to a service; and a table comparing whether each knows where '
           'it is, how a location reaches anyone, its power and where it works.',
           sub='Same word, three different machines. Only one of them knows where it is.',
           note='Generic devices. Radio arcs illustrative.', h=1699)
cols = [(60, 'blue', 'Item tracker (AirTag-class)'), (560, 'teal', 'BLE beacon'), (1060, 'amber', 'GPS + cellular tracker')]
s.f(1)
P = 0
s.raw(panel(40, P, 640, 250, 'blue', 1, cols[0][2], None, 24))
s.raw(tag(100, P + 114, 32))
s.raw(phone(196, P + 68, 50, 92, '#eff6ff'))
s.arrow([(136, P + 114), (188, P + 114)], 'signal')
s.raw(cloud(320, P + 66, 150))
s.arrow([(256, P + 104), (330, P + 104)], 'crypto')
s.raw(phone(566, P + 68, 50, 92, '#f5f3ff'))
s.arrow([(484, P + 104), (558, P + 104)], 'crypto')
s.raw(T(64, P + 190, 'whisper → a stranger’s phone adds its own location →\nencrypted report → only the owner can read it (Module 5)', 20, 400, '#334155'))
s.raw(T(64, P + 238, 'Knows where it is? No.', 21, 800, '#1e3a8a'))
s.f(2)
P = 260
s.raw(panel(40, P, 640, 250, 'teal', 2, cols[1][2], None, 24))
s.raw(f'<rect x="76" y="{P + 82}" width="20" height="90" fill="#d6d3d1"/>')
s.raw(vbeacon(104, P + 82))
s.raw(waves(216, P + 117, 3, '#1d4ed8', 0.9))
s.raw(phone(400, P + 68, 50, 92, '#f0fdfa'))
s.arrow([(296, P + 117), (392, P + 117)], 'signal')
s.raw(T(64, P + 190, 'fixed ID on a wall → an app on a nearby phone reacts\n(“you are at the exhibit”). No network of its own.', 20, 400, '#334155'))
s.raw(T(64, P + 238, 'Knows where it is? Only where it was fixed.', 21, 800, '#0f766e'))
s.f(3)
P = 520
s.raw(panel(40, P, 640, 320, 'amber', 3, cols[2][2], None, 24))
s.raw(satellite(330, P + 82, 0.7))
s.raw(satellite(330, P + 130, 0.7))
s.raw(vtracker_box(64, P + 96))
s.arrow([(280, P + 84), (236, P + 106)], 'signal')
s.arrow([(280, P + 132), (236, P + 134)], 'signal')
s.raw(tower(500, P + 84, 0.62))
s.arrow([(234, P + 166), (474, P + 166)], 'signal')
s.raw(cloud(548, P + 102, 120))
s.arrow([(514, P + 130), (556, P + 130)], 'crypto')
s.raw(T(64, P + 234, 'computes its own coordinates (GNSS), sends them over\ncellular to a service. Bigger battery; usually a\nsubscription.', 20, 400, '#334155'))
s.raw(T(64, P + 308, 'Knows where it is? Yes.', 21, 800, '#92400e'))
s.f(4)
rows = [('', 'Item tracker', 'BLE beacon', 'GPS tracker'),
        ('Knows its\nlocation', 'no', 'no (fixed\nplace)', 'yes'),
        ('Location\nreaches\nsomeone via', 'strangers’\nphones', 'the nearby\napp', 'its own\ncellular link'),
        ('Power\n(typical)', 'coin cell, a\nyear or more', 'coin cell or\nmains', 'rechargeable,\ndays–weeks')]
yy = 852
for r, cells in enumerate(rows):
    rh = 46 if r == 0 else 30 + 25 * max(c.count('\n') + 1 for c in cells)
    for c, txt in enumerate(cells):
        xx = 40 + (0 if c == 0 else 166 + (c - 1) * 158)
        w = 166 if c == 0 else 158
        fill = '#f1f5f9' if r == 0 or c == 0 else '#ffffff'
        s.raw(f'<rect x="{xx}" y="{yy}" width="{w}" height="{rh}" fill="{fill}" stroke="#cbd5e1" stroke-width="1.5"/>')
        n = txt.count('\n')
        s.raw(T(xx + 10, yy + rh / 2 + 7 - 13 * n, txt, 20, 800 if r == 0 or c == 0 else 400, '#14213d'))
    yy += rh
scenes[30] = s.render()
