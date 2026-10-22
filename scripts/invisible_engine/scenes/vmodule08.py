"""Module 8 phone-vertical scenes (56–64): the same scenes as module08.py, laid out for a
phone (VScene: 720 wide, body drawn in its own coordinates below the header).
Same title, desc, frames and words as the landscape scene; invisible-engine/tests/check.py
compares them. Change a scene's words in both files.

Every curve and bar is computed with module08's helpers and the same formulas, never typed.
"""
import math
import random
from .svgkit import VScene
from .art import *
from .module08 import (WAVE, WAVE2, AMP, AMPN, PROB, INK, MUTED, R2, Tp, matrix, curve, axis,
                       wire, meter, gate, fringe, humps)

scenes = {}


# ── phone-scale helpers ─────────────────────────────────────────────
def lines(x, y, rows, size=21, color='#334155', weight=400, lh=None, anchor='start'):
    lh = lh or round(size * 1.32)
    return ''.join(T(x, y + i * lh, r, size, weight, color, anchor) for i, r in enumerate(rows))


def vpanel(x, y, w, h, color='blue', n=None, title=None, sub=None, tsize=26):
    c, light, border = STEP[color]
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="18" fill="{light}" stroke="{border}" stroke-width="2"/>'
    tx = x + 24
    if n is not None:
        out += badge(x + 42, y + 44, n, color, 26)
        tx = x + 82
    if title:
        out += T(tx, y + 54 if n is not None else y + 44, title, tsize, 800, '#14213d')
    if sub:
        out += T(tx, y + 86 if n is not None else y + 76, sub, 21, 600, c)
    return out


def box(x, y, w, h, stroke, fill='#ffffff'):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="{fill}" stroke="{stroke}" stroke-width="2"/>'


def pill(x, y, text, color=AMP, fill='#f5f3ff'):
    w = len(text) * 13 + 30
    return (f'<rect x="{x:.0f}" y="{y}" width="{w:.0f}" height="34" rx="17" fill="{fill}" stroke="{color}" stroke-width="2"/>'
            + T(x + w / 2, y + 24, text, 20, 700, color, 'middle', mono=True))


def bars(x, zero, vals, scale, kind='amp', w=50, gap=26, fmt='{:+.3f}', size=20):
    """Signed amplitude bars or probability bars, as module08.bars, at phone size."""
    out = f'<path d="M{x - 12},{zero} L{x + len(vals) * (w + gap) - gap + 12},{zero}" stroke="#334155" stroke-width="2"/>'
    for i, v in enumerate(vals):
        bx = x + i * (w + gap)
        h = abs(v) * scale
        col = PROB if kind == 'prob' else (AMP if v >= 0 else AMPN)
        if h > 0.5:
            yy = zero - h if v >= 0 else zero
            out += f'<rect x="{bx}" y="{yy:.1f}" width="{w}" height="{h:.1f}" rx="4" fill="{col}"/>'
        txt = '0' if abs(v) < 1e-9 else (f'{v:.2f}' if kind == 'prob' else fmt.format(v)).replace('-', '−')
        ty = zero - h - 9 if v >= 0 else zero + h + 24
        out += T(bx + w / 2, ty, txt, size, 700, col if h > 0.5 else MUTED, 'middle')
    return out


def bar_labels(x, y, labels, w=50, gap=26, color=MUTED, size=20):
    return ''.join(T(x + i * (w + gap) + w / 2, y, l, size, 600, color, 'middle') for i, l in enumerate(labels))


def phasor(cx, cy, r, ang_deg, color=AMP, length=1.0, label=None, faint=False, size=22):
    a = math.radians(ang_deg)
    x2, y2 = cx + r * length * math.cos(a), cy - r * length * math.sin(a)
    op = ' opacity="0.35"' if faint else ''
    hx, hy = math.cos(a), -math.sin(a)
    px, py = -hy, hx
    head = (f'<path d="M{x2:.1f},{y2:.1f} L{x2 - 14 * hx + 7 * px:.1f},{y2 - 14 * hy + 7 * py:.1f} '
            f'L{x2 - 14 * hx - 7 * px:.1f},{y2 - 14 * hy - 7 * py:.1f} Z" fill="{color}"{op}/>')
    out = f'<path d="M{cx},{cy} L{x2:.1f},{y2:.1f}" stroke="{color}" stroke-width="4"{op}/>' + head
    if label:
        lx, ly = cx + (r * length + 28) * math.cos(a), cy - (r * length + 28) * math.sin(a)
        out += T(lx, ly + 8, label, size, 700, color, 'middle')
    return out


def scaled(x, y, k, svg):
    """Draw a text-free component at (x, y) scaled by k."""
    return f'<g transform="translate({x},{y}) scale({k})">{svg}</g>'


# ── 56 A bit ────────────────────────────────────────────────────────
s = VScene(56, 'A bit is a switch that is either on or off',
           'Four frames. 1, a transistor used as a switch: a high voltage is read as 1 and a low voltage as 0, drawn as '
           'a lit and an unlit lamp. 2, a three-bit register and the eight strings it could hold, 000 to 111. 3, the '
           'register actually holds one of them, 101, and reading it does not change it. 4, bits can be read as often as '
           'you like and copied exactly; n bits have 2 to the n possible strings but hold one at a time, unlike the '
           'qubits that start in Scene 60.',
           sub='Definite, readable, copyable. Everything in a classical computer is built from this.',
           note='Schematic. Lamps stand for transistor states.', h=1600)
s.f(1)
s.raw(vpanel(40, 0, 640, 300, 'slate', 1, 'A switch makes a bit', 'a transistor, on or off'))
s.raw(scaled(110, 150, 0.52, bulb(0, 0, on=True)))
s.raw(T(180, 146, 'high voltage', 24, 700, INK) + T(180, 174, 'read as 1', 21, 400, MUTED))
s.raw(T(640, 170, '1', 54, 800, '#b45309', 'end', mono=True))
s.raw(scaled(110, 222, 0.52, bulb(0, 0, on=False)))
s.raw(T(180, 222, 'low voltage', 24, 700, INK) + T(180, 250, 'read as 0', 21, 400, MUTED))
s.raw(T(640, 246, '0', 54, 800, '#64748b', 'end', mono=True))
s.raw(T(64, 286, 'Voltages are ranges, not exact values (illustrative).', 20, 400, MUTED, italic=True))
s.f(2)
s.raw(vpanel(40, 314, 640, 262, 'blue', 2, 'Three bits, eight strings'))
for i, lab in enumerate(['bit 2', 'bit 1', 'bit 0']):
    x = 70 + i * 96
    s.raw(f'<rect x="{x}" y="398" width="80" height="80" rx="10" fill="#ffffff" stroke="#334155" stroke-width="3"/>')
    s.raw(T(x + 40, 506, lab, 20, 600, MUTED, 'middle'))
for i, b in enumerate(['000', '001', '010', '011', '100', '101', '110', '111']):
    col, row = i // 4, i % 4
    s.raw(T(410 + col * 130, 420 + row * 42, b, 26, 700, INK, mono=True))
s.f(3)
for i, v in enumerate('101'):
    s.raw(T(110 + i * 96, 454, v, 44, 800, '#1d4ed8', 'middle', mono=True))
s.raw('<rect x="530" y="433" width="68" height="40" rx="8" fill="none" stroke="#1d4ed8" stroke-width="3"/>')
s.raw(callout(40, 590, 640, 116, 'One value at a time', 'The register holds exactly one of the eight\nstrings: here 101. Reading it does not change it.', 'green', 3, 26, 21))
s.f(4)
s.raw(callout(40, 720, 640, 143, 'Read and copy freely', 'You can read a bit as often as you like and copy\nit exactly. A qubit cannot be copied, and\nmeasuring it can change it (Scenes 60–61).', 'purple', 4, 26, 21))
s.raw('<rect x="40" y="877" width="640" height="232" rx="14" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(T(64, 914, 'n bits → 2ⁿ possible strings,', 24, 800, INK) + T(64, 944, 'but only one at a time', 24, 800, INK))
s.raw(T(64, 986, '3 bits → 8', 21, 600, '#1d4ed8', mono=True) + T(260, 986, '10 bits → 1,024', 21, 600, '#1d4ed8', mono=True)
      + T(64, 1018, '64 bits → 18,446,744,073,709,551,616', 21, 600, '#1d4ed8', mono=True))
s.raw(lines(64, 1060, ['More bits mean more possible values to choose from,', 'never several values held at once.'], 21, MUTED, 400, 28))
scenes[56] = s.render()


# ── 57 Classical waves ──────────────────────────────────────────────
s = VScene(57, 'Waves that add and waves that cancel',
           'Four frames, labelled as a water-wave analogy. 1, two stones dropped in a pond send out rings; solid rings are '
           'crests and dashed rings troughs; one marked point is where two crests meet, another where a crest meets a trough. '
           '2, where crest meets crest, heights add: plus one plus plus one makes plus two, plotted as two equal waves and '
           'their doubled sum. 3, where crest meets trough, plus one plus minus one makes zero: the two waves cancel and the sum '
           'is flat. 4, a note that this is an analogy: water heights add here, while in quantum mechanics it is amplitudes, '
           'numbers that are not heights of anything, that add (Scene 59).',
           sub='Heights add point by point. This is the picture to borrow from, carefully.',
           note='Blue: classical waves (analogy). Curves computed, not drawn by hand.', h=1600)
s.f(1)
s.raw(pill(40, 0, 'WATER-WAVE ANALOGY', WAVE, '#eff6ff'))
s.raw('<rect x="40" y="44" width="640" height="416" rx="18" fill="#eff6ff" stroke="#93c5fd" stroke-width="2"/>')
s.raw(T(64, 84, 'A pond seen from above', 24, 800, INK))
K = 34                                   # ring spacing: crests every K, troughs half-way
S1, S2 = (280, 250), (440, 250)
for k in range(1, 5):
    for (sx, sy) in (S1, S2):
        s.raw(f'<circle cx="{sx}" cy="{sy}" r="{K * k}" fill="none" stroke="{WAVE}" stroke-width="2.2"/>')
        s.raw(f'<circle cx="{sx}" cy="{sy}" r="{K * k - K / 2:.0f}" fill="none" stroke="{WAVE2}" stroke-width="1.6" stroke-dasharray="5 6"/>')
for (sx, sy) in (S1, S2):
    s.raw(f'<circle cx="{sx}" cy="{sy}" r="9" fill="#334155"/>')


def meet(r1, r2):
    d = S2[0] - S1[0]
    a = (r1 * r1 - r2 * r2 + d * d) / (2 * d)
    h = math.sqrt(max(r1 * r1 - a * a, 0))
    return S1[0] + a, S1[1] - h


cc = meet(4 * K, 4 * K)
ct = meet(4 * K, 3.5 * K)
s.raw(f'<circle cx="{cc[0]:.0f}" cy="{cc[1]:.0f}" r="11" fill="#16a34a" stroke="#ffffff" stroke-width="3"/>')
s.raw(f'<circle cx="{ct[0]:.0f}" cy="{ct[1]:.0f}" r="11" fill="#dc2626" stroke="#ffffff" stroke-width="3"/>')
s.raw(T(64, 412, '● crest meets crest', 21, 700, '#15803d') + T(330, 412, '● crest meets trough', 21, 700, '#b91c1c'))
s.raw(T(64, 444, 'Solid ring: crest. Dashed ring: trough. Illustrative.', 20, 400, MUTED, italic=True))
for fr, (y0, stroke, col, n, title, sign, side) in enumerate((
        (474, '#86efac', 'green', 2, 'Crest meets crest: +1 + (+1) = +2', 1, ('heights add:', 'twice as tall')),
        (708, '#fca5a5', 'red', 3, 'Crest meets trough: +1 + (−1) = 0', -1, ('they cancel:', 'flat at every point')))):
    s.f(2 + fr)
    ink = STEP[col][0] if col == 'green' else '#b91c1c'
    ink = '#15803d' if col == 'green' else '#b91c1c'
    s.raw(box(40, y0, 640, 222, stroke))
    s.raw(badge(74, y0 + 34, n, col, 20) + T(104, y0 + 42, title, 22, 800, ink))
    zero = y0 + 132
    s.raw(axis(64, zero, 380, y0 + 64, y0 + 200))
    fa = lambda t: math.sin(2 * math.pi * 2 * t)
    fb = (lambda g: (lambda t: g * math.sin(2 * math.pi * 2 * t)))(sign)
    s.raw(curve(64, zero, 380, fa, 30, WAVE, 3))
    s.raw(curve(64, zero, 380, fb, 30, WAVE2, 3, '8 6'))
    s.raw(curve(64, zero, 380, (lambda a, b: (lambda t: a(t) + b(t)))(fa, fb), 30, INK, 4))
    s.raw(lines(508, y0 + 86, ['wave A', 'wave B', 'sum'], 20, MUTED, 700, 28))
    s.raw(f'<path d="M476,{y0 + 80} L498,{y0 + 80}" stroke="{WAVE}" stroke-width="3"/>'
          f'<path d="M476,{y0 + 108} L498,{y0 + 108}" stroke="{WAVE2}" stroke-width="3" stroke-dasharray="6 4"/>'
          f'<path d="M476,{y0 + 136} L498,{y0 + 136}" stroke="{INK}" stroke-width="4"/>')
    s.raw(T(476, y0 + 178, side[0], 20, 400, MUTED) + T(476, y0 + 204, side[1], 20, 700, INK))
s.f(4)
s.raw('<rect x="40" y="942" width="640" height="152" rx="14" fill="#f5f3ff" stroke="#c4b5fd" stroke-width="2"/>')
s.raw(badge(74, 976, 4, 'purple', 20) + T(104, 984, 'An analogy, not the thing itself', 22, 800, AMP))
s.raw(lines(64, 1020, ['Here, heights of water add. In quantum mechanics,',
                       'amplitudes add: numbers, not the height of anything.',
                       'Next: quantum amplitude mathematics (Scene 59).'], 21, '#334155', 400, 26))
scenes[57] = s.render()


# ── 58 Frequency, wavelength, phase ─────────────────────────────────
s = VScene(58, 'Frequency, wavelength and phase',
           'Five frames about classical waves. 1, one wave with its wavelength (crest to crest), its amplitude (height) and '
           'what frequency and phase mean. 2 to 5, two equal waves added with the second shifted by a phase of 0, 90, 180 '
           'and 270 degrees; each panel plots both inputs and their computed sum, whose amplitude is 2.00, 1.41, 0.00 and '
           '1.41 times one wave’s, and whose intensity, proportional to amplitude squared, is 4.00, 2.00, 0.00 and 2.00. '
           'A note says that amplitude is height while energy goes with amplitude squared.',
           sub='Shift one wave against the other and the sum grows, shrinks or vanishes.',
           note='Classical waves. Sum amplitude = 2A·|cos(φ/2)|.', h=1600)
s.f(1)
s.raw(pill(40, 0, 'CLASSICAL WAVES', WAVE, '#eff6ff'))
s.raw('<rect x="40" y="44" width="640" height="300" rx="18" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(badge(76, 80, 1, 'blue', 20) + T(106, 88, 'One wave', 24, 800, INK))
gx, gy, gw = 70, 186, 580
s.raw(axis(gx, gy, gw, 132, 240))
s.raw(curve(gx, gy, gw, lambda t: math.sin(2 * math.pi * 2.5 * t), 46, WAVE, 3.5))
xa, xb = gx + gw * 0.1, gx + gw * 0.5
s.raw(f'<path d="M{xa:.0f},{gy - 52} L{xa:.0f},{gy - 60} L{xb:.0f},{gy - 60} L{xb:.0f},{gy - 52}" fill="none" stroke="#334155" stroke-width="2"/>')
s.raw(T((xa + xb) / 2 + 40, gy - 68, 'wavelength λ (crest to crest)', 20, 700, INK, 'middle'))
xc = gx + gw * 0.9
s.raw(f'<path d="M{xc:.0f},{gy} L{xc:.0f},{gy - 42}" stroke="#b45309" stroke-width="2.5"/><path d="M{xc - 6:.0f},{gy - 35} L{xc:.0f},{gy - 46} L{xc + 6:.0f},{gy - 35} Z" fill="#b45309"/>')
s.raw(T(xc - 10, gy - 66, 'amplitude A', 20, 700, '#b45309', 'middle'))
s.raw(lines(64, 272, ['Frequency f: cycles per second.', 'Wavelength λ = speed ÷ frequency.',
                      'Phase φ: where in its cycle a wave is, 0° to 360°.'], 20, '#334155', 400, 26))
for i, ph in enumerate((0, 90, 180, 270)):
    s.f(2 + i)
    x = 40 + (i % 2) * 330
    y = 358 + (i // 2) * 308
    amp = 2 * abs(math.cos(math.radians(ph) / 2))
    s.raw(f'<rect x="{x}" y="{y}" width="310" height="296" rx="16" fill="#ffffff" stroke="#93c5fd" stroke-width="2"/>')
    s.raw(lines(x + 18, y + 34, ['second wave shifted', f'by φ = {ph}°'], 21, INK, 800, 27))
    s.raw(axis(x + 18, y + 140, 274, y + 82, y + 198))
    f1 = lambda t: math.sin(2 * math.pi * 1.5 * t)
    f2 = (lambda p: (lambda t: math.sin(2 * math.pi * 1.5 * t + math.radians(p))))(ph)
    s.raw(curve(x + 18, y + 140, 274, f1, 28, WAVE, 2.5))
    s.raw(curve(x + 18, y + 140, 274, f2, 28, WAVE2, 2.5, '7 5'))
    s.raw(curve(x + 18, y + 140, 274, (lambda a, b: (lambda t: a(t) + b(t)))(f1, f2), 28, INK, 3.5))
    s.raw(T(x + 18, y + 226, f'sum amplitude {amp:.2f} A', 21, 700, INK))
    s.raw(lines(x + 18, y + 254, ['intensity ∝ amplitude²', f'= {amp * amp:.2f}'], 20, MUTED, 400, 26))
s.f(5)
s.raw(lines(40, 998, ['Blue: wave A.  Light blue dashed: wave B.', 'Dark: their sum, computed point by point.'], 21, '#334155', 600, 28))
s.raw(lines(40, 1058, ['Amplitude is height; the energy a wave carries goes as',
                       'amplitude². In a real pond, energy missing at quiet',
                       'spots shows up at loud ones.'], 21, MUTED, 400, 28))
scenes[58] = s.render()


# ── 59 Complex amplitudes ───────────────────────────────────────────
def circle_axes(cx, cy, r):
    return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 6"/>'
            f'<path d="M{cx - r - 30},{cy} L{cx + r + 30},{cy} M{cx},{cy + r + 26} L{cx},{cy - r - 26}" stroke="#94a3b8" stroke-width="1.5"/>'
            + T(cx + r + 30, cy + 28, 'Re', 20, 700, MUTED, 'end') + T(cx + 14, cy - r - 8, 'Im', 20, 700, MUTED))


s = VScene(59, 'Complex amplitudes: arrows with a length and an angle',
           'Four frames, labelled quantum amplitude mathematics. 1, the complex plane with real and imaginary axes and a '
           'unit circle; an arrow at angle phi is e to the i phi, equal to cos phi plus i sin phi. 2, the arrow at 0, 90, 180 '
           'and 270 degrees is 1, i, minus 1 and minus i. 3, measuring in the 0 or 1 basis gives probabilities equal to the '
           'squared length of each amplitude, so the angle alone is not something you read. 4, global phase: turning both '
           'parts of a state by the same angle changes nothing any experiment can detect; relative phase: turning one part '
           'against the other changes what interference does next (Scene 63).',
           sub='Amplitudes behave like arrows: they can point any way, and they add like arrows.',
           note='Purple: quantum amplitudes (mathematics, not something you can see).', h=1600)
s.f(1)
s.raw(pill(40, 0, 'QUANTUM AMPLITUDE MATHEMATICS'))
s.raw('<rect x="40" y="44" width="640" height="440" rx="18" fill="#faf5ff" stroke="#d8b4fe" stroke-width="2"/>')
cx, cy, r = 340, 262, 125
s.raw(circle_axes(cx, cy, r))
s.raw(f'<path d="M{cx + 50},{cy} A50,50 0 0 0 {cx + 50 * math.cos(math.radians(50)):.1f},{cy - 50 * math.sin(math.radians(50)):.1f}" fill="none" stroke="#b45309" stroke-width="2.5"/>')
s.raw(T(cx + 60, cy - 16, 'φ', 22, 800, '#b45309'))
s.raw(phasor(cx, cy, r, 50, AMP, 1.0))
s.raw(T(64, 86, 'e^(iφ) = cos φ + i·sin φ', 24, 800, AMP, mono=True))
s.raw(T(64, 116, 'length 1, angle φ', 21, 400, MUTED))
s.f(2)
for ang, lab, lx, ly in ((0, '1', cx + r + 14, cy - 12), (90, 'i', cx - 16, cy - r - 8),
                         (180, '−1', cx - r - 14, cy - 12), (270, '−i', cx - 16, cy + r + 22)):
    s.raw(phasor(cx, cy, r, ang, '#64748b', 1.0, faint=True) + T(lx, ly, lab, 22, 700, '#64748b', 'end' if ang in (90, 180, 270) else 'start'))
s.raw(lines(64, 440, ['Turning the arrow by 180° gives −1: same length,', 'opposite direction.'], 21, MUTED, 400, 27))
s.f(3)
s.raw(callout(40, 498, 640, 178, 'Phase is not something you read off',
              'Measuring a qubit as 0 or 1 gives probabilities\nequal to the squared length of each amplitude:\n'
              '|amplitude|². The length sets them; the angle\nalone does not show up in that measurement.', 'purple', 3, 26, 21))
s.f(4)
s.raw(vpanel(40, 690, 640, 352, 'slate', 4, 'Global phase and relative phase'))
for col, (title, note, turn) in enumerate(((('Global: both parts', 'turn together'), ('No experiment can tell', 'these apart.'), (60, 60)),
                                           (('Relative: one part turns', 'against the other'), ('This changes what', 'interference does next.'), (0, 180)))):
    bx = 64 + col * 316
    s.raw(lines(bx, 690 + 92, list(title), 20, INK, 800, 25))
    for row, (angs, lab) in enumerate((((0, 0), 'before'), (turn, 'after'))):
        yy = 690 + 186 + row * 66
        s.raw(T(bx, yy + 7, lab, 20, 600, MUTED))
        for k, part in enumerate(('|0⟩ part', '|1⟩ part')):
            ccx = bx + 126 + k * 100
            s.raw(f'<circle cx="{ccx}" cy="{yy}" r="30" fill="#ffffff" stroke="#e9d5ff" stroke-width="2"/>')
            s.raw(phasor(ccx, yy, 30, angs[k], AMP, 0.75))
            if row == 0:
                s.raw(T(ccx, yy - 40, part, 20, 600, MUTED, 'middle'))
    s.raw(lines(bx, 690 + 302, list(note), 20, AMP if col else '#334155', 700, 25))
scenes[59] = s.render()


# ── 60 Qubit and Born rule ──────────────────────────────────────────
s = VScene(60, 'A qubit, and the rule that turns amplitudes into odds',
           'Four frames. 1, a qubit state alpha times ket 0 plus beta times ket 1, with alpha squared plus beta squared equal '
           'to 1; for alpha 0.866 and beta 0.5 the signed amplitude bars and the probability bars, 0.75 and 0.25. 2, a second '
           'state with amplitudes plus 0.707 and minus 0.707: the minus sign shows in the amplitude bar but the probabilities '
           'are 0.50 and 0.50. 3, a hundred identically prepared copies of the first state each measured once: every result is '
           'a definite 0 or 1, and 75 of the hundred read 0. 4, a fair coin and the plus state both give 50:50 when measured '
           'directly, but after a Hadamard gate the plus state always reads 0 while the coin is still 50:50, so classical '
           'randomness is not the same as superposition.',
           sub='Two amplitudes describe a qubit; their squares are the odds of reading 0 or 1.',
           note='Purple: amplitudes (minus shown in pink). Teal: probabilities = |amplitude|².', h=1600)
s.f(1)
y0 = 0
s.raw(vpanel(40, y0, 640, 258, 'purple', 1, 'A qubit, prepared'))
s.raw(Tp(64, y0 + 94, '|ψ⟩ = α|0⟩ + β|1⟩     |α|² + |β|² = 1', 21, 700, AMP, mono=True))
a1, b1 = math.sqrt(3) / 2, 0.5
zero = y0 + 215
s.raw(bars(76, zero, [a1, b1], 84))
s.raw(bar_labels(76, zero + 30, ['α', 'β']))
s.raw(T(257, zero - 62, '→', 30, 700, MUTED, 'middle') + T(257, zero - 34, 'square', 20, 600, MUTED, 'middle'))
s.raw(bars(304, zero, [a1 * a1, b1 * b1], 84, 'prob'))
s.raw(bar_labels(304, zero + 30, ['P(0)', 'P(1)']))
s.raw(T(476, y0 + 136, 'amplitudes', 21, 700, AMP) + T(476, y0 + 162, 'can be signed', 20, 400, MUTED))
s.raw(T(476, y0 + 200, 'probabilities', 21, 700, PROB) + T(476, y0 + 226, 'never negative', 20, 400, MUTED))
s.f(2)
y0 = 268
s.raw(vpanel(40, y0, 640, 320, 'slate', 2, 'Same odds, different state'))
s.raw(Tp(64, y0 + 94, 'α = +0.707   β = −0.707', 21, 700, AMP, mono=True))
zero = y0 + 205
s.raw(bars(76, zero, [R2, -R2], 72))
s.raw(bar_labels(76, y0 + 308, ['α', 'β']))
s.raw(bars(304, zero, [0.5, 0.5], 72, 'prob'))
s.raw(bar_labels(304, y0 + 308, ['P(0)', 'P(1)']))
s.raw(T(460, y0 + 140, 'the minus sign', 21, 700, AMPN)
      + lines(460, y0 + 166, ['does not show in', 'these odds, but it', 'changes interference', '(Scene 63)'], 20, MUTED, 400, 26))
s.f(3)
y0 = 598
s.raw(box(40, y0, 640, 222, '#5eead4'))
s.raw(badge(74, y0 + 34, 3, 'teal', 20) + T(104, y0 + 42, '100 copies of state 1, each measured once', 21, 800, INK))
rng = random.Random(60)
ones = set(rng.sample(range(100), 25))
for i in range(100):
    x, y = 76 + (i % 25) * 24, y0 + 74 + (i // 25) * 24
    if i in ones:
        s.raw(f'<circle cx="{x}" cy="{y}" r="9.5" fill="{AMP}"/>')
    else:
        s.raw(f'<circle cx="{x}" cy="{y}" r="8.5" fill="#ffffff" stroke="{PROB}" stroke-width="2.5"/>')
s.raw(f'<circle cx="74" cy="{y0 + 175}" r="8" fill="#ffffff" stroke="{PROB}" stroke-width="2.5"/>' + T(90, y0 + 182, 'read 0: 75', 20, 600, '#334155')
      + f'<circle cx="234" cy="{y0 + 175}" r="8" fill="{AMP}"/>' + T(250, y0 + 182, 'read 1: 25', 20, 600, '#334155')
      + T(64, y0 + 210, 'each result is one definite bit', 20, 600, '#334155'))
s.f(4)
y0 = 830
s.raw(box(40, y0, 640, 198, '#fcd34d', '#fffbeb'))
s.raw(badge(74, y0 + 34, 4, 'amber', 20) + T(104, y0 + 42, 'A coin is not a superposition', 21, 800, INK))
s.raw(f'<circle cx="94" cy="{y0 + 118}" r="34" fill="#fde68a" stroke="#b45309" stroke-width="3"/>' + T(94, y0 + 128, '¢', 28, 800, '#b45309', 'middle'))
s.raw(lines(150, y0 + 78, ['Measured directly, a fair coin and |+⟩ both',
                           'give 50 : 50. Apply H first: |+⟩ reads 0 every',
                           'time; the coin stays 50 : 50. Randomness from',
                           'not knowing is not the same as amplitudes that',
                           'can interfere.'], 20, '#334155', 400, 25))
scenes[60] = s.render()


# ── 61 Hadamard ─────────────────────────────────────────────────────
s = VScene(61, 'The Hadamard gate: even odds, not half a particle',
           'Five frames. 1, the state ket 0, amplitudes 1 and 0, goes through an H gate and comes out with amplitudes plus '
           '0.707 and plus 0.707, probabilities 0.50 and 0.50. 2, ket 1 goes through H and comes out with plus 0.707 and minus '
           '0.707, also 0.50 and 0.50. 3, the H matrix, one over root two times one, one, one, minus one. 4, a note that a '
           'measurement always finds a whole particle, 0 or 1; the half is a probability. 5, applying H twice returns ket 0, '
           'because the two contributions to 1 cancel: a first taste of interference.',
           sub='H turns a definite 0 into equal odds of 0 and 1, and does the same to a 1 with a sign flip.',
           note='Ideal gates. Amplitudes to three places.', h=1600)
for row, (start, out) in enumerate((((1, 0), (R2, R2)), ((0, 1), (R2, -R2)))):
    s.f(1 + row)
    y0 = row * 287
    zero = y0 + 165
    s.raw(box(40, y0, 640, 275, '#e9d5ff'))
    s.raw(badge(74, y0 + 34, 1 + row, 'purple', 20) + T(104, y0 + 42, f'start in |{row}⟩', 22, 800, INK))
    s.raw(bars(64, zero, list(start), 70))
    s.raw(bar_labels(64, y0 + 262, ['|0⟩', '|1⟩']))
    s.raw(wire(196, 226, zero - 20) + gate(226, zero - 52, 'H', w=76, h=64) + wire(302, 330, zero - 20))
    s.raw(bars(340, zero, list(out), 70))
    s.raw(bar_labels(340, y0 + 262, ['|0⟩', '|1⟩']))
    s.raw(T(496, zero - 20, '→', 26, 700, MUTED, 'middle'))
    s.raw(bars(522, zero, [o * o for o in out], 70, 'prob'))
    s.raw(bar_labels(522, y0 + 262, ['P(0)', 'P(1)']))
s.f(3)
s.raw(vpanel(40, 574, 640, 196, 'slate', 3, 'The rule, as a matrix'))
s.raw(matrix(64, 574 + 112, [['1', '1'], ['1', '−1']], 'H = 1/√2 ·', size=24, colw=60, rowh=36))
s.raw(T(64, 574 + 180, 'Ideal gates are reversible (unitary).', 21, 400, MUTED))
s.f(4)
s.raw(callout(40, 782, 640, 151, 'Not half a particle', 'Every measurement finds a whole thing: a 0 or a 1,\na whole photon or electron. “Half” is a probability.\nNothing is split in two.', 'amber', 4, 26, 21))
s.f(5)
s.raw('<rect x="40" y="945" width="640" height="160" rx="14" fill="#f5f3ff" stroke="#c4b5fd" stroke-width="2"/>')
s.raw(badge(74, 979, 5, 'purple', 20) + T(104, 987, 'H twice gives back |0⟩', 22, 800, AMP))
s.raw(Tp(64, 1026, 'to 0:  0.707·0.707 + 0.707·0.707 = 1', 20, 600, '#334155', mono=True)
      + Tp(64, 1056, 'to 1:  0.707·0.707 + 0.707·(−0.707) = 0', 20, 600, '#334155', mono=True)
      + Tp(64, 1086, 'the paths to 1 cancel', 20, 600, '#334155', mono=True))
scenes[61] = s.render()


# ── 62 Z gate ───────────────────────────────────────────────────────
s = VScene(62, 'The Z gate changes a phase you cannot see directly',
           'Five frames. 1, the plus state: amplitudes plus 0.707 and plus 0.707, probabilities 0.50 and 0.50. 2, the Z gate, '
           'matrix one, zero, zero, minus one: it flips the sign of the ket 1 part. 3, the result is the minus state, '
           'amplitudes plus 0.707 and minus 0.707, with exactly the same probabilities, 0.50 and 0.50. 4, as arrows, the ket 1 '
           'part turns by 180 degrees while the ket 0 part stays: a relative phase. 5, a note that measuring now cannot tell '
           'plus from minus, but the next H gate can (Scene 63).',
           sub='Same odds before and after. What changed is the relative phase.',
           note='Ideal gates. Purple: amplitudes. Teal: probabilities.', h=1600)
s.f(1)
s.raw(vpanel(40, 0, 640, 212, 'purple', 1, 'Before: |+⟩'))
s.raw(bars(80, 170, [R2, R2], 72))
s.raw(bar_labels(80, 200, ['|0⟩', '|1⟩']))
s.raw(bars(330, 170, [0.5, 0.5], 72, 'prob'))
s.raw(bar_labels(330, 200, ['P(0)', 'P(1)']))
s.f(2)
s.raw(f'<path d="M110,212 L110,236" stroke="#334155" stroke-width="3"/>' + gate(72, 236, 'Z', w=76, h=64)
      + f'<path d="M110,300 L110,536" stroke="#334155" stroke-width="3"/><path d="M98,522 L110,540 L122,522 Z" fill="#334155"/>')
s.raw(matrix(134, 360, [['1', '0'], ['0', '−1']], 'Z =', size=22, colw=44, rowh=34))
s.raw(lines(134, 450, ['flips the sign', 'of the |1⟩ part'], 20, MUTED, 600, 26))
s.f(3)
s.raw(vpanel(40, 548, 640, 262, 'purple', 3, 'After: |−⟩'))
s.raw(bars(80, 548 + 150, [R2, -R2], 72))
s.raw(bar_labels(80, 548 + 252, ['|0⟩', '|1⟩']))
s.raw(bars(330, 548 + 150, [0.5, 0.5], 72, 'prob'))
s.raw(bar_labels(330, 548 + 252, ['P(0)', 'P(1)']))
s.f(4)
s.raw(vpanel(300, 224, 380, 312, 'slate', 4, 'As arrows'))
for row, (lab, a1_, a2_) in enumerate((('|+⟩', 0, 0), ('|−⟩', 0, 180))):
    yy = 224 + 150 + row * 84
    s.raw(T(324, yy + 8, lab, 22, 800, AMP, mono=True))
    for k, ang in enumerate((a1_, a2_)):
        ccx = 450 + k * 120
        s.raw(f'<circle cx="{ccx}" cy="{yy}" r="34" fill="#ffffff" stroke="#e9d5ff" stroke-width="2"/>')
        s.raw(phasor(ccx, yy, 34, ang, AMP, 0.75))
        if row == 0:
            s.raw(T(ccx, yy - 44, '|0⟩ part' if k == 0 else '|1⟩ part', 20, 600, MUTED, 'middle'))
s.raw(T(324, 224 + 292, '|1⟩ part turned by 180°', 20, 700, AMP))
s.f(5)
s.raw('<rect x="40" y="822" width="640" height="232" rx="16" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(badge(76, 858, 5, 'slate', 20) + T(106, 866, 'Invisible now, decisive next', 22, 800, INK))
s.raw(lines(64, 902, ['Measured right now, |+⟩ and |−⟩ give the same',
                      '50 : 50: no single reading can tell them apart.',
                      'The difference is a relative phase of 180°. One more',
                      'H turns |+⟩ into 0 every time and |−⟩ into 1 every',
                      'time (Scene 63). A phase you cannot read directly',
                      'still decides the outcome of the next step.'], 20, '#334155', 400, 25))
scenes[62] = s.render()


# ── 63 Interference in H–Z–H ────────────────────────────────────────
s = VScene(63, 'Interference: H, then Z, then H always gives 1',
           'Five frames. 1, a circuit: ket 0, an H gate, a Z gate, another H gate, then a measurement. 2, the amplitudes after '
           'each step: ket 0 is 1 and 0; after H, plus 0.707 and plus 0.707; after Z, plus 0.707 and minus 0.707; after the last '
           'H, 0 and 1. 3, the last H path by path: to output 0, plus 0.5 from the ket 0 part and minus 0.5 from the ket 1 part '
           'cancel to 0; to output 1, plus 0.5 and plus 0.5 add to 1. 4, for a general phase phi between the parts, the final '
           'probabilities are cos squared of phi over 2 for 0 and sin squared of phi over 2 for 1, plotted from 0 to 360 '
           'degrees with values 1, 0.5, 0, 0.5 and 1 for P of 0 at 0, 90, 180, 270 and 360 degrees. 5, phi equal to 180 degrees '
           'is the Z gate, so this circuit reads 1 every time.',
           sub='Paths to the wrong answer cancel; paths to the right one add. That is all interference means here.',
           note='Ideal gates. Values computed: 0.707 = 1/√2.', h=1540)
s.f(1)
s.raw(T(40, 50, '|0⟩', 24, 800, INK, mono=True))
s.raw(wire(92, 610, 42))
for x, g in ((152, 'H'), (312, 'Z'), (472, 'H')):
    s.raw(gate(x, 10, g, w=76, h=64))
s.raw(meter(604, 10, 76, 64))
states = [((1, 0), '|0⟩', 110), ((R2, R2), '|+⟩', 270), ((R2, -R2), '|−⟩', 430), ((0, 1), '|1⟩', 590)]
s.f(2)
for vals, lab, cx in states:
    s.raw(bars(cx - 56, 200, list(vals), 70, w=36, gap=40))
    s.raw(bar_labels(cx - 56, 310, ['|0⟩', '|1⟩'], w=36, gap=40))
    s.raw(T(cx, 342, lab, 22, 800, AMP, 'middle', mono=True))
s.f(3)
y0 = 366
s.raw(box(40, y0, 640, 288, '#e9d5ff'))
s.raw(badge(74, y0 + 34, 3, 'purple', 20) + T(104, y0 + 42, 'The last H, path by path', 22, 800, INK))
L0, L1, O0, O1 = (164, y0 + 120), (164, y0 + 236), (440, y0 + 120), (440, y0 + 236)
s.raw(T(56, y0 + 127, '+0.707', 20, 700, AMP, mono=True) + T(56, y0 + 243, '−0.707', 20, 700, AMPN, mono=True))
s.raw(T(140, y0 + 92, '|0⟩ part', 20, 600, MUTED, 'end') + T(140, y0 + 208, '|1⟩ part', 20, 600, MUTED, 'end'))
for (p, q, col, lab, lx) in ((L0, O0, '#16a34a', '+0.5', 302), (L1, O0, '#dc2626', '−0.5', 230),
                             (L0, O1, '#16a34a', '+0.5', 374), (L1, O1, '#16a34a', '+0.5', 302)):
    s.raw(f'<path d="M{p[0] + 14},{p[1]} L{q[0] - 14},{q[1]}" stroke="{col}" stroke-width="3.5"/>')
    ly = p[1] + (q[1] - p[1]) * (lx - p[0]) / (q[0] - p[0])
    s.raw(f'<rect x="{lx - 30}" y="{ly - 16:.0f}" width="60" height="28" rx="6" fill="#ffffff"/>' + T(lx, ly + 7, lab, 20, 800, col, 'middle', mono=True))
for (pt, c) in ((L0, AMP), (L1, AMPN), (O0, INK), (O1, INK)):
    s.raw(f'<circle cx="{pt[0]}" cy="{pt[1]}" r="12" fill="{c}"/>')
s.raw(T(466, y0 + 127, 'output 0: 0', 21, 800, '#b91c1c') + T(466, y0 + 153, 'cancel', 20, 600, MUTED))
s.raw(T(466, y0 + 243, 'output 1: 1', 21, 800, '#15803d') + T(466, y0 + 269, 'add', 20, 600, MUTED))
s.f(4)
y0 = 666
s.raw(box(40, y0, 640, 356, '#5eead4'))
s.raw(badge(74, y0 + 34, 4, 'teal', 20) + T(104, y0 + 42, 'Any phase φ:', 21, 800, INK)
      + Tp(64, y0 + 74, 'P(0) = cos²(φ/2),  P(1) = sin²(φ/2)', 21, 800, INK))
gx, gy, gw, gh = 100, y0 + 300, 380, 170
s.raw(axis(gx, gy, gw, gy - gh - 10, gy))
s.raw(curve(gx, gy, gw, lambda t: math.cos(math.pi * t) ** 2, gh, PROB, 3.5))
s.raw(curve(gx, gy, gw, lambda t: math.sin(math.pi * t) ** 2, gh, AMP, 3, '8 6'))
for k, deg in enumerate((0, 90, 180, 270, 360)):
    px = gx + gw * deg / 360
    p0 = math.cos(math.radians(deg) / 2) ** 2
    s.raw(f'<circle cx="{px:.0f}" cy="{gy - gh * p0:.1f}" r="6" fill="{PROB}"/>')
    s.raw(T(px, gy + 26, f'{deg}°', 20, 600, MUTED, 'middle'))
    lx = px + (26 if deg in (90, 270) else 10 if deg == 0 else 0)
    s.raw(T(lx, gy - gh * p0 - 12, f'{p0:.2f}', 20, 700, PROB, 'start' if deg in (0, 90, 270) else 'middle'))
s.raw(f'<path d="M{gx + gw + 30},{gy - 40} L{gx + gw + 54},{gy - 40}" stroke="{PROB}" stroke-width="3.5"/>' + T(gx + gw + 62, gy - 33, 'P(0)', 20, 700, PROB)
      + f'<path d="M{gx + gw + 30},{gy - 10} L{gx + gw + 54},{gy - 10}" stroke="{AMP}" stroke-width="3" stroke-dasharray="6 4"/>' + T(gx + gw + 62, gy - 3, 'P(1)', 20, 700, AMP))
s.raw(T(gx - 10, gy - gh + 7, '1', 20, 600, MUTED, 'end') + T(gx - 10, gy + 7, '0', 20, 600, MUTED, 'end'))
s.f(5)
px180 = gx + gw * 0.5
s.raw(f'<circle cx="{px180:.0f}" cy="{gy - gh}" r="9" fill="none" stroke="#b45309" stroke-width="3"/>')
s.raw(lines(gx + gw + 30, gy - gh + 10, ['φ = 180°', 'is the Z gate:', 'P(1) = 1'], 20, '#b45309', 800, 25))
scenes[63] = s.render()


# ── 64 Double slit ──────────────────────────────────────────────────
s = VScene(64, 'The double slit: stripes made of single dots',
           'Five frames. 1, a source sends particles, electrons, photons or even large molecules, towards a barrier with two '
           'slits; the screen behind shows a striped intensity pattern. 2, the particles arrive one at a time and each lands as '
           'a single dot; the stripes appear only after many dots. 3, when a detector records which slit each particle passed '
           'through, the stripes vanish and only a smooth, stripe-free spread remains. 4, the environment can carry away the same which-slit '
           'information, stray light, heat and gas molecules, so the stripes wash out: decoherence, the reason qubits are '
           'cooled and isolated. 5, a note that the stripes are in the probabilities of where whole particles land, not ripples '
           'of a substance, and that circuit interference (Scene 63) is amplitudes adding in a calculation the hardware carries out.',
           sub='Interference is real in nature. What it is not: tiny particles behaving as ripples.',
           note='Pattern computed (cos² fringes, single-slit envelope). Not to scale.', h=1600)
s.f(1)
s.raw('<rect x="40" y="0" width="640" height="400" rx="18" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(T(64, 40, 'electrons, photons,', 20, 600, MUTED) + T(64, 66, 'even C₆₀ molecules', 20, 600, MUTED))
s.raw('<rect x="60" y="170" width="150" height="90" rx="12" fill="#334155"/>')
s.raw(T(135, 208, 'source', 21, 800, '#ffffff', 'middle') + T(135, 236, 'one at a time', 19.5, 400, '#e2e8f0', 'middle'))
s.raw('<path d="M216,215 L296,215" stroke="#64748b" stroke-width="5"/><path d="M294,203 L316,215 L294,227 Z" fill="#64748b"/>')
CY, HALF = 215, 130                           # screen centre and half-height
s.raw(f'<rect x="330" y="{CY - HALF}" width="20" height="{HALF - 26}" fill="#475569"/>'
      f'<rect x="330" y="{CY - 12}" width="20" height="24" fill="#475569"/>'
      f'<rect x="330" y="{CY + 26}" width="20" height="{HALF - 26}" fill="#475569"/>')
s.raw(T(340, CY + HALF + 36, 'two slits', 20, 700, INK, 'middle'))
s.raw(f'<rect x="480" y="{CY - HALF}" width="16" height="{2 * HALF}" fill="#cbd5e1" stroke="#64748b" stroke-width="1.5"/>')
s.raw(T(488, CY + HALF + 36, 'screen', 20, 700, INK, 'middle'))
pts = ' L'.join(f'{500 + 150 * fringe((y - CY) / HALF):.1f},{y}' for y in range(CY - HALF, CY + HALF + 1))
s.raw(f'<path d="M500,{CY - HALF} L{pts} L500,{CY + HALF}" fill="#bfdbfe" stroke="{WAVE}" stroke-width="2"/>')
s.raw(T(668, 40, 'how often a particle', 20, 600, MUTED, 'end') + T(668, 66, 'lands at each height', 20, 600, MUTED, 'end'))
s.f(2)
y0 = 412
s.raw(f'<rect x="40" y="{y0}" width="310" height="300" rx="18" fill="#0f172a"/>')
s.raw(T(195, y0 + 34, 'dots arrive one by one', 20, 700, '#e2e8f0', 'middle'))
rng = random.Random(64)
n = 0
while n < 320:
    u = rng.uniform(-1, 1)
    if rng.random() < fringe(u):
        y = y0 + 150 + 92 * u
        x = rng.uniform(62, 328)
        s.raw(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2.6" fill="#fde68a"/>')
        n += 1
s.raw(T(195, y0 + 268, 'stripes only in the', 20, 600, '#cbd5e1', 'middle') + T(195, y0 + 292, 'statistics', 20, 600, '#cbd5e1', 'middle'))
s.f(3)
c, light, border = STEP['red']
s.raw(f'<rect x="370" y="{y0}" width="310" height="300" rx="12" fill="{light}" stroke="{border}" stroke-width="2"/>')
s.raw(badge(396, y0 + 30, 3, 'red', 18) + T(424, y0 + 38, 'Ask which slit:', 24, 800, c) + T(424, y0 + 66, 'stripes vanish', 24, 800, c))
s.raw(eye(390, y0 + 104, 0.7, '#b91c1c'))
s.raw(T(390, y0 + 150, 'a detector at the slits', 20, 600, '#334155'))
pts = ' L'.join(f'{604 + 70 * humps((y - (y0 + 226)) / 70):.1f},{y}' for y in range(y0 + 170, y0 + 283))
s.raw(f'<rect x="592" y="{y0 + 170}" width="10" height="113" fill="#cbd5e1"/><path d="M604,{y0 + 170} L{pts} L604,{y0 + 283}" fill="#fecaca" stroke="#dc2626" stroke-width="2"/>')
s.raw(T(390, y0 + 200, 'Knowing the path', 20, 400, '#334155') + T(390, y0 + 226, 'removes the stripes:', 20, 400, '#334155') + T(390, y0 + 252, 'a smooth spread.', 20, 700, '#b91c1c'))
s.f(4)
s.raw(callout(40, 722, 640, 178, 'The environment asks too', 'Stray light, heat and gas molecules can carry away\nwhich-path information. The stripes wash out:\ndecoherence. That is why qubits are cooled and\nisolated (Module 9).', 'amber', 4, 26, 21))
s.f(5)
s.raw(callout(40, 910, 640, 178, 'Not tiny ripples', 'The stripes are in the probabilities of where whole\nparticles land. In a qubit circuit, interference is\namplitudes adding in the calculation the hardware\ncarries out (Scene 63).', 'purple', 5, 26, 21))
scenes[64] = s.render()
