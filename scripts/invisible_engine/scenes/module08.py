"""Module 8 scenes (56–64): quantum, from switches to interference.
Run scripts/invisible_engine/build.py to write the SVGs.

Every curve and bar is computed here, never typed: a plotted sum is the point-by-point
sum of its inputs, amplitude bars are signed, probability bars are |amplitude|².
Blue curves are classical waves (an analogy); purple bars and arrows are quantum
amplitudes (the mathematics). Nothing in this module claims a qubit "tries all answers
at once" or that interference is ripples inside a chip.
"""
import math
import random
from .svgkit import Scene
from .art import *

scenes = {}

WAVE = '#1d4ed8'      # classical waves (signal blue)
WAVE2 = '#60a5fa'     # second classical wave
AMP = '#7c3aed'       # quantum amplitude (purple)
AMPN = '#be185d'      # negative amplitude
PROB = '#0d9488'      # probability
INK = '#14213d'
MUTED = '#475569'
R2 = 1 / math.sqrt(2)


# ── local helpers (Module 8 only) ───────────────────────────────────
def lines(x, y, rows, size=15.5, color='#334155', weight=400, lh=None):
    lh = lh or round(size * 1.6)
    return ''.join(T(x, y + i * lh, r, size, weight, color) for i, r in enumerate(rows))


def Tp(*a, **k):
    """Text whose repeated spaces are kept (aligned formulas)."""
    return T(*a, **k).replace('<text ', '<text xml:space="preserve" ', 1).replace('style="', 'style="white-space:pre;', 1)


def matrix(x, y, rows, prefix=None, color=AMP, size=22, colw=58, rowh=36):
    """A 2x2 (or n x m) matrix with drawn brackets; (x, y) is the baseline of the first row."""
    out = ''
    if prefix:
        out += T(x, y + rowh / 2, prefix, size, 700, color, mono=True)
        x += len(prefix) * size * 0.62 + 10
    top, bot = y - size, y + (len(rows) - 1) * rowh + 10
    w = len(rows[0]) * colw + 10
    out += (f'<path d="M{x + 10},{top} L{x},{top} L{x},{bot} L{x + 10},{bot}" fill="none" stroke="{color}" stroke-width="2.5"/>'
            f'<path d="M{x + w - 10},{top} L{x + w},{top} L{x + w},{bot} L{x + w - 10},{bot}" fill="none" stroke="{color}" stroke-width="2.5"/>')
    for r, row in enumerate(rows):
        for c, v in enumerate(row):
            out += T(x + 10 + colw * c + colw / 2, y + r * rowh, v, size, 700, color, 'middle', mono=True)
    return out


def pill(x, y, text, color=AMP, fill='#f5f3ff'):
    w = len(text) * 9.4 + 30
    return (f'<rect x="{x:.0f}" y="{y}" width="{w:.0f}" height="30" rx="15" fill="{fill}" stroke="{color}" stroke-width="2"/>'
            + T(x + w / 2, y + 20, text, 14, 700, color, 'middle', mono=True))


def curve(x0, ymid, w, f, scale, color, width=3, dash=None, n=240):
    """Plot y = f(t) for t in [0, 1] across width w; f returns a value in wave units."""
    pts = ' L'.join(f'{x0 + w * i / n:.1f},{ymid - scale * f(i / n):.1f}' for i in range(n + 1))
    d = f' stroke-dasharray="{dash}"' if dash else ''
    return f'<path d="M{pts}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linejoin="round"{d}/>'


def axis(x0, ymid, w, top, bottom, color='#94a3b8'):
    return (f'<path d="M{x0},{ymid} L{x0 + w},{ymid}" stroke="{color}" stroke-width="1.5"/>'
            f'<path d="M{x0},{top} L{x0},{bottom}" stroke="{color}" stroke-width="1.5"/>')


def bars(x, zero, vals, labels, scale, kind='amp', w=54, gap=30, fmt='{:+.3f}'):
    """Signed amplitude bars (kind='amp') or non-negative probability bars (kind='prob')."""
    out = f'<path d="M{x - 14},{zero} L{x + len(vals) * (w + gap) - gap + 14},{zero}" stroke="#334155" stroke-width="2"/>'
    for i, v in enumerate(vals):
        bx = x + i * (w + gap)
        h = abs(v) * scale
        col = PROB if kind == 'prob' else (AMP if v >= 0 else AMPN)
        if h > 0.5:
            yy = zero - h if v >= 0 else zero
            out += f'<rect x="{bx}" y="{yy:.1f}" width="{w}" height="{h:.1f}" rx="4" fill="{col}"/>'
        txt = '0' if abs(v) < 1e-9 else (f'{v:.2f}' if kind == 'prob' else fmt.format(v)).replace('-', '−')
        ty = zero - h - 9 if v >= 0 else zero + h + 20
        out += T(bx + w / 2, ty, txt, 14.5, 700, col if h > 0.5 else MUTED, 'middle')
    return out


def bar_labels(x, y, labels, w=54, gap=30, color=MUTED):
    return ''.join(T(x + i * (w + gap) + w / 2, y, l, 15, 600, color, 'middle') for i, l in enumerate(labels))


def gate(x, y, label, color=AMP, w=90, h=70):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="#ffffff" stroke="{color}" stroke-width="3"/>'
            + T(x + w / 2, y + h / 2 + 12, label, 32, 800, color, 'middle'))


def wire(x1, x2, y, color='#334155'):
    return f'<path d="M{x1},{y} L{x2},{y}" stroke="{color}" stroke-width="3"/>'


def meter(x, y, w=90, h=70):
    cx, cy = x + w / 2, y + h - 16
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="#f8fafc" stroke="#334155" stroke-width="3"/>'
            f'<path d="M{cx - 28},{cy} A28,28 0 0 1 {cx + 28},{cy}" fill="none" stroke="#334155" stroke-width="3"/>'
            f'<path d="M{cx},{cy} L{cx + 18},{cy - 24}" stroke="#334155" stroke-width="3" stroke-linecap="round"/>')


def phasor(cx, cy, r, ang_deg, color=AMP, length=1.0, label=None, faint=False):
    a = math.radians(ang_deg)
    x2, y2 = cx + r * length * math.cos(a), cy - r * length * math.sin(a)
    op = ' opacity="0.35"' if faint else ''
    hx, hy = math.cos(a), -math.sin(a)
    px, py = -hy, hx
    head = (f'<path d="M{x2:.1f},{y2:.1f} L{x2 - 14 * hx + 7 * px:.1f},{y2 - 14 * hy + 7 * py:.1f} '
            f'L{x2 - 14 * hx - 7 * px:.1f},{y2 - 14 * hy - 7 * py:.1f} Z" fill="{color}"{op}/>')
    out = f'<path d="M{cx},{cy} L{x2:.1f},{y2:.1f}" stroke="{color}" stroke-width="4"{op}/>' + head
    if label:
        lx, ly = cx + (r * length + 26) * math.cos(a), cy - (r * length + 26) * math.sin(a)
        out += T(lx, ly + 6, label, 17, 700, color, 'middle')
    return out


def circle_axes(cx, cy, r, labels=True):
    out = (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 6"/>'
           f'<path d="M{cx - r - 30},{cy} L{cx + r + 30},{cy} M{cx},{cy + r + 30} L{cx},{cy - r - 30}" stroke="#94a3b8" stroke-width="1.5"/>')
    if labels:
        out += T(cx + r + 50, cy + 5, 'Re', 15, 700, MUTED) + T(cx + 16, cy - r - 46, 'Im', 15, 700, MUTED)
    return out


# ── 56 A bit ────────────────────────────────────────────────────────
s = Scene(56, 'A bit is a switch that is either on or off',
          'Four frames. 1, a transistor used as a switch: a high voltage is read as 1 and a low voltage as 0, drawn as '
          'a lit and an unlit lamp. 2, a three-bit register and the eight strings it could hold, 000 to 111. 3, the '
          'register actually holds one of them, 101, and reading it does not change it. 4, bits can be read as often as '
          'you like and copied exactly; n bits have 2 to the n possible strings but hold one at a time, unlike the '
          'qubits that start in Scene 60.',
          sub='Definite, readable, copyable. Everything in a classical computer is built from this.')
s.f(1)
s.raw(panel(60, 160, 460, 460, 'slate', 1, 'A switch makes a bit', 'a transistor, on or off'))
s.raw(bulb(150, 330, on=True))
s.raw(T(230, 318, 'high voltage', 19, 700, INK) + T(230, 352, 'read as 1', 19, 400, MUTED))
s.raw(T(470, 350, '1', 54, 800, '#b45309', 'end', mono=True))
s.raw(bulb(150, 490, on=False))
s.raw(T(230, 478, 'low voltage', 19, 700, INK) + T(230, 512, 'read as 0', 19, 400, MUTED))
s.raw(T(470, 510, '0', 54, 800, '#64748b', 'end', mono=True))
s.raw(T(84, 600, 'Voltages are ranges, not exact values (illustrative).', 14.5, 400, MUTED, italic=True))
s.f(2)
s.raw(panel(560, 160, 480, 460, 'blue', 2, 'Three bits, eight strings'))
for i, lab in enumerate(['bit 2', 'bit 1', 'bit 0']):
    x = 640 + i * 110
    s.raw(f'<rect x="{x}" y="240" width="90" height="90" rx="10" fill="#ffffff" stroke="#334155" stroke-width="3"/>')
    s.raw(T(x + 45, 352, lab, 14, 600, MUTED, 'middle'))
for i, b in enumerate(['000', '001', '010', '011', '100', '101', '110', '111']):
    col, row = i // 4, i % 4
    s.raw(T(680 + col * 210, 410 + row * 46, b, 26, 700, INK, mono=True))
s.f(3)
for i, v in enumerate('101'):
    s.raw(T(685 + i * 110, 300, v, 44, 800, '#1d4ed8', 'middle', mono=True))
s.raw('<rect x="868" y="433" width="84" height="40" rx="8" fill="none" stroke="#1d4ed8" stroke-width="3"/>')
s.raw(callout(1080, 160, 460, 200, 'One value at a time', 'The register holds exactly one of the\neight strings: here 101. Reading it\ndoes not change it.', 'green', 3))
s.f(4)
s.raw(callout(1080, 390, 460, 230, 'Read and copy freely', 'You can read a bit as often as you like\nand copy it exactly. A qubit cannot be\ncopied, and measuring it can change it\n(Scenes 60–61).', 'purple', 4))
s.raw('<rect x="60" y="650" width="1480" height="150" rx="14" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(T(90, 700, 'n bits → 2ⁿ possible strings, but only one at a time', 22, 800, INK))
s.raw(T(90, 744, '3 bits → 8', 19, 600, '#1d4ed8', mono=True) + T(330, 744, '10 bits → 1,024', 19, 600, '#1d4ed8', mono=True)
      + T(640, 744, '64 bits → 18,446,744,073,709,551,616', 19, 600, '#1d4ed8', mono=True))
s.raw(T(90, 780, 'More bits mean more possible values to choose from, never several values held at once.', 16, 400, MUTED))
scenes[56] = s.render('Schematic. Lamps stand for transistor states.')


# ── 57 Classical waves ──────────────────────────────────────────────
s = Scene(57, 'Waves that add and waves that cancel',
          'Four frames, labelled as a water-wave analogy. 1, two stones dropped in a pond send out rings; solid rings are '
          'crests and dashed rings troughs; one marked point is where two crests meet, another where a crest meets a trough. '
          '2, where crest meets crest, heights add: plus one plus plus one makes plus two, plotted as two equal waves and '
          'their doubled sum. 3, where crest meets trough, plus one plus minus one makes zero: the two waves cancel and the sum '
          'is flat. 4, a note that this is an analogy: water heights add here, while in quantum mechanics it is amplitudes, '
          'numbers that are not heights of anything, that add (Scene 59).',
          sub='Heights add point by point. This is the picture to borrow from, carefully.')
s.f(1)
s.raw(pill(1250, 116, 'WATER-WAVE ANALOGY', WAVE, '#eff6ff'))
s.raw('<rect x="60" y="160" width="640" height="440" rx="18" fill="#eff6ff" stroke="#93c5fd" stroke-width="2"/>')
s.raw(T(84, 196, 'A pond seen from above', 20, 800, INK))
S1, S2 = (280, 390), (480, 390)
for k in range(1, 5):
    for (sx, sy) in (S1, S2):
        s.raw(f'<circle cx="{sx}" cy="{sy}" r="{40 * k}" fill="none" stroke="{WAVE}" stroke-width="2.2"/>')
        s.raw(f'<circle cx="{sx}" cy="{sy}" r="{40 * k - 20}" fill="none" stroke="{WAVE2}" stroke-width="1.6" stroke-dasharray="5 6"/>')
for (sx, sy) in (S1, S2):
    s.raw(f'<circle cx="{sx}" cy="{sy}" r="9" fill="#334155"/>')


def meet(r1, r2):
    d = S2[0] - S1[0]
    a = (r1 * r1 - r2 * r2 + d * d) / (2 * d)
    h = math.sqrt(max(r1 * r1 - a * a, 0))
    return S1[0] + a, S1[1] - h


cc = meet(160, 160)
ct = meet(160, 140)
s.raw(f'<circle cx="{cc[0]:.0f}" cy="{cc[1]:.0f}" r="11" fill="#16a34a" stroke="#ffffff" stroke-width="3"/>')
s.raw(f'<circle cx="{ct[0]:.0f}" cy="{ct[1]:.0f}" r="11" fill="#dc2626" stroke="#ffffff" stroke-width="3"/>')
s.raw(T(84, 560, '● crest meets crest', 16, 700, '#15803d') + T(300, 560, '● crest meets trough', 16, 700, '#b91c1c'))
s.raw(T(84, 586, 'Solid ring: crest. Dashed ring: trough. Illustrative.', 14, 400, MUTED, italic=True))
s.f(2)
s.raw('<rect x="740" y="160" width="800" height="270" rx="18" fill="#ffffff" stroke="#86efac" stroke-width="2"/>')
s.raw(badge(776, 196, 2, 'green', 20) + T(806, 204, 'Crest meets crest: +1 + (+1) = +2', 20, 800, '#15803d'))
s.raw(axis(780, 325, 520, 230, 420))
s.raw(curve(780, 325, 520, lambda t: math.sin(2 * math.pi * 2 * t), 42, WAVE, 3))
s.raw(curve(780, 325, 520, lambda t: math.sin(2 * math.pi * 2 * t), 42, WAVE2, 3, '8 6'))
s.raw(curve(780, 325, 520, lambda t: 2 * math.sin(2 * math.pi * 2 * t), 42, INK, 4))
s.raw(lines(1330, 280, ['wave A', 'wave B', 'sum'], 15.5, MUTED, 700, 30))
s.raw(f'<path d="M1300,276 L1322,276" stroke="{WAVE}" stroke-width="3"/><path d="M1300,306 L1322,306" stroke="{WAVE2}" stroke-width="3" stroke-dasharray="6 4"/><path d="M1300,336 L1322,336" stroke="{INK}" stroke-width="4"/>')
s.raw(T(1330, 392, 'heights add:', 15, 400, MUTED) + T(1330, 414, 'twice as tall', 15, 700, INK))
s.f(3)
s.raw('<rect x="740" y="450" width="800" height="270" rx="18" fill="#ffffff" stroke="#fca5a5" stroke-width="2"/>')
s.raw(badge(776, 486, 3, 'red', 20) + T(806, 494, 'Crest meets trough: +1 + (−1) = 0', 20, 800, '#b91c1c'))
s.raw(axis(780, 615, 520, 520, 710))
s.raw(curve(780, 615, 520, lambda t: math.sin(2 * math.pi * 2 * t), 42, WAVE, 3))
s.raw(curve(780, 615, 520, lambda t: -math.sin(2 * math.pi * 2 * t), 42, WAVE2, 3, '8 6'))
s.raw(curve(780, 615, 520, lambda t: math.sin(2 * math.pi * 2 * t) - math.sin(2 * math.pi * 2 * t), 42, INK, 4))
s.raw(lines(1330, 570, ['wave A', 'wave B', 'sum'], 15.5, MUTED, 700, 30))
s.raw(f'<path d="M1300,566 L1322,566" stroke="{WAVE}" stroke-width="3"/><path d="M1300,596 L1322,596" stroke="{WAVE2}" stroke-width="3" stroke-dasharray="6 4"/><path d="M1300,626 L1322,626" stroke="{INK}" stroke-width="4"/>')
s.raw(T(1330, 682, 'they cancel:', 15, 400, MUTED) + T(1330, 704, 'flat at every point', 15, 700, INK))
s.f(4)
s.raw('<rect x="60" y="640" width="640" height="170" rx="14" fill="#f5f3ff" stroke="#c4b5fd" stroke-width="2"/>')
s.raw(badge(94, 676, 4, 'purple', 20) + T(124, 684, 'An analogy, not the thing itself', 19, 800, AMP))
s.raw(lines(84, 720, ['Here, heights of water add. In quantum mechanics,',
                      'amplitudes add: numbers, not the height of anything.',
                      'Next: quantum amplitude mathematics (Scene 59).'], 15.5, '#334155', 400, 26))
scenes[57] = s.render('Blue: classical waves (analogy). Curves computed, not drawn by hand.')


# ── 58 Frequency, wavelength, phase ─────────────────────────────────
s = Scene(58, 'Frequency, wavelength and phase',
          'Five frames about classical waves. 1, one wave with its wavelength (crest to crest), its amplitude (height) and '
          'what frequency and phase mean. 2 to 5, two equal waves added with the second shifted by a phase of 0, 90, 180 '
          'and 270 degrees; each panel plots both inputs and their computed sum, whose amplitude is 2.00, 1.41, 0.00 and '
          '1.41 times one wave’s, and whose intensity, proportional to amplitude squared, is 4.00, 2.00, 0.00 and 2.00. '
          'A note says that amplitude is height while energy goes with amplitude squared.',
          sub='Shift one wave against the other and the sum grows, shrinks or vanishes.')
s.f(1)
s.raw(pill(1250, 116, 'CLASSICAL WAVES', WAVE, '#eff6ff'))
s.raw('<rect x="60" y="160" width="1480" height="200" rx="18" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(badge(96, 196, 1, 'blue', 20) + T(126, 204, 'One wave', 20, 800, INK))
s.raw(axis(120, 285, 860, 225, 345))
s.raw(curve(120, 285, 860, lambda t: math.sin(2 * math.pi * 2.5 * t), 52, WAVE, 3.5))
# wavelength bracket between crests at t = 0.1 and 0.5 (crests of sin at 2.5 cycles: t = (0.25 + k)/2.5)
xa, xb = 120 + 860 * 0.1, 120 + 860 * 0.5
s.raw(f'<path d="M{xa:.0f},222 L{xa:.0f},214 L{xb:.0f},214 L{xb:.0f},222" fill="none" stroke="#334155" stroke-width="2"/>')
s.raw(T((xa + xb) / 2, 206, 'wavelength λ (crest to crest)', 15, 700, INK, 'middle'))
xc = 120 + 860 * 0.9
s.raw(f'<path d="M{xc:.0f},285 L{xc:.0f},237" stroke="#b45309" stroke-width="2.5"/><path d="M{xc - 6:.0f},244 L{xc:.0f},233 L{xc + 6:.0f},244 Z" fill="#b45309"/>')
s.raw(T(xc - 12, 268, 'amplitude A', 15, 700, '#b45309', 'end'))
s.raw(lines(1060, 236, ['Frequency f: cycles per second.', 'Wavelength λ = speed ÷ frequency.', 'Phase φ: where in its cycle a wave is,', '0° to 360°.'], 16, '#334155', 400, 28))
for i, ph in enumerate((0, 90, 180, 270)):
    s.f(2 + i)
    x = 60 + i * 375
    amp = 2 * abs(math.cos(math.radians(ph) / 2))
    s.raw(f'<rect x="{x}" y="390" width="355" height="330" rx="16" fill="#ffffff" stroke="#93c5fd" stroke-width="2"/>')
    s.raw(T(x + 20, 424, f'second wave shifted by φ = {ph}°', 17, 800, INK))
    s.raw(axis(x + 20, 560, 315, 450, 670))
    f1 = lambda t: math.sin(2 * math.pi * 1.5 * t)
    f2 = (lambda p: (lambda t: math.sin(2 * math.pi * 1.5 * t + math.radians(p))))(ph)
    s.raw(curve(x + 20, 560, 315, f1, 34, WAVE, 2.5))
    s.raw(curve(x + 20, 560, 315, f2, 34, WAVE2, 2.5, '7 5'))
    s.raw(curve(x + 20, 560, 315, (lambda a, b: (lambda t: a(t) + b(t)))(f1, f2), 34, INK, 3.5))
    s.raw(T(x + 20, 692, f'sum amplitude {amp:.2f} A', 15.5, 700, INK))
    s.raw(T(x + 20, 712, f'intensity ∝ amplitude² = {amp * amp:.2f}', 14.5, 400, MUTED))
s.f(5)
s.raw(T(60, 760, 'Blue: wave A.  Light blue dashed: wave B.  Dark: their sum, computed point by point.', 15.5, 600, '#334155'))
s.raw(T(60, 792, 'Amplitude is height; the energy a wave carries goes as amplitude². In a real pond, energy missing at quiet spots shows up at loud ones.', 15.5, 400, MUTED))
scenes[58] = s.render('Classical waves. Sum amplitude = 2A·|cos(φ/2)|.')


# ── 59 Complex amplitudes ───────────────────────────────────────────
s = Scene(59, 'Complex amplitudes: arrows with a length and an angle',
          'Four frames, labelled quantum amplitude mathematics. 1, the complex plane with real and imaginary axes and a '
          'unit circle; an arrow at angle phi is e to the i phi, equal to cos phi plus i sin phi. 2, the arrow at 0, 90, 180 '
          'and 270 degrees is 1, i, minus 1 and minus i. 3, measuring in the 0 or 1 basis gives probabilities equal to the '
          'squared length of each amplitude, so the angle alone is not something you read. 4, global phase: turning both '
          'parts of a state by the same angle changes nothing any experiment can detect; relative phase: turning one part '
          'against the other changes what interference does next (Scene 63).',
          sub='Amplitudes behave like arrows: they can point any way, and they add like arrows.')
s.f(1)
s.raw(pill(1150, 116, 'QUANTUM AMPLITUDE MATHEMATICS'))
s.raw('<rect x="60" y="160" width="640" height="650" rx="18" fill="#faf5ff" stroke="#d8b4fe" stroke-width="2"/>')
cx, cy, r = 380, 470, 210
s.raw(circle_axes(cx, cy, r))
s.raw(f'<path d="M{cx + 60},{cy} A60,60 0 0 0 {cx + 60 * math.cos(math.radians(50)):.1f},{cy - 60 * math.sin(math.radians(50)):.1f}" fill="none" stroke="#b45309" stroke-width="2.5"/>')
s.raw(T(cx + 72, cy - 22, 'φ', 20, 800, '#b45309'))
s.raw(phasor(cx, cy, r, 50, AMP, 1.0))
s.raw(T(84, 200, 'e^(iφ) = cos φ + i·sin φ', 20, 800, AMP, mono=True))
s.raw(T(84, 228, 'length 1, angle φ', 15.5, 400, MUTED))
s.f(2)
for ang, lab in ((0, '1'), (90, 'i'), (180, '−1'), (270, '−i')):
    s.raw(phasor(cx, cy, r, ang, '#64748b', 1.0, lab, faint=True))
s.raw(T(84, 786, 'Turning the arrow by 180° gives −1: same length, opposite direction.', 15, 400, MUTED))
s.f(3)
s.raw(callout(740, 160, 800, 160, 'Phase is not something you read off', 'Measuring a qubit as 0 or 1 gives probabilities equal to the squared\nlength of each amplitude: |amplitude|². The length sets them;\nthe angle alone does not show up in that measurement.', 'purple', 3))
s.f(4)
s.raw(panel(740, 380, 800, 430, 'slate', 4, 'Global phase and relative phase'))
for col, (title, note, turn) in enumerate((('Global: both parts turn together', 'No experiment can tell these apart.', (60, 60)),
                                           ('Relative: one part turns against the other', 'This changes what interference does next.', (0, 180)))):
    bx = 770 + col * 390
    s.raw(T(bx, 476, title, 15.5, 800, INK))
    for row, (angs, lab) in enumerate((((0, 0), 'before'), (turn, 'after'))):
        yy = 560 + row * 130
        s.raw(T(bx, yy + 5, lab, 14, 600, MUTED))
        for k, part in enumerate(('|0⟩ part', '|1⟩ part')):
            ccx = bx + 120 + k * 130
            s.raw(f'<circle cx="{ccx}" cy="{yy}" r="46" fill="#ffffff" stroke="#e9d5ff" stroke-width="2"/>')
            s.raw(phasor(ccx, yy, 46, angs[k], AMP, 0.75))
            if row == 0:
                s.raw(T(ccx, yy - 56, part, 13.5, 600, MUTED, 'middle'))
    s.raw(T(bx, 790, note, 15, 700, AMP if col else '#334155'))
scenes[59] = s.render('Purple: quantum amplitudes (mathematics, not something you can see).')


# ── 60 Qubit and Born rule ──────────────────────────────────────────
s = Scene(60, 'A qubit, and the rule that turns amplitudes into odds',
          'Four frames. 1, a qubit state alpha times ket 0 plus beta times ket 1, with alpha squared plus beta squared equal '
          'to 1; for alpha 0.866 and beta 0.5 the signed amplitude bars and the probability bars, 0.75 and 0.25. 2, a second '
          'state with amplitudes plus 0.707 and minus 0.707: the minus sign shows in the amplitude bar but the probabilities '
          'are 0.50 and 0.50. 3, a hundred identically prepared copies of the first state each measured once: every result is '
          'a definite 0 or 1, and 75 of the hundred read 0. 4, a fair coin and the plus state both give 50:50 when measured '
          'directly, but after a Hadamard gate the plus state always reads 0 while the coin is still 50:50, so classical '
          'randomness is not the same as superposition.',
          sub='Two amplitudes describe a qubit; their squares are the odds of reading 0 or 1.')
s.f(1)
s.raw(panel(60, 160, 700, 390, 'purple', 1, 'A qubit, prepared'))
s.raw(Tp(90, 254, '|ψ⟩ = α|0⟩ + β|1⟩     |α|² + |β|² = 1', 19, 700, AMP, mono=True))
a1, b1 = math.sqrt(3) / 2, 0.5
s.raw(bars(110, 410, [a1, b1], None, 100))
s.raw(bar_labels(110, 528, ['α', 'β']))
s.raw(bars(420, 410, [a1 * a1, b1 * b1], None, 100, 'prob'))
s.raw(bar_labels(420, 528, ['P(0)', 'P(1)']))
s.raw(T(330, 410, '→', 30, 700, MUTED, 'middle') + T(330, 440, 'square', 13, 600, MUTED, 'middle'))
s.raw(T(600, 330, 'amplitudes', 15, 700, AMP) + T(600, 354, 'can be signed', 14, 400, MUTED))
s.raw(T(600, 400, 'probabilities', 15, 700, PROB) + T(600, 424, 'never negative', 14, 400, MUTED))
s.f(2)
s.raw(panel(800, 160, 740, 390, 'slate', 2, 'Same odds, different state'))
s.raw(Tp(830, 254, 'α = +0.707   β = −0.707', 19, 700, AMP, mono=True))
s.raw(bars(850, 380, [R2, -R2], None, 100))
s.raw(bar_labels(850, 528, ['α', 'β']))
s.raw(bars(1160, 380, [0.5, 0.5], None, 100, 'prob'))
s.raw(bar_labels(1160, 528, ['P(0)', 'P(1)']))
s.raw(T(1370, 330, 'the minus sign', 15, 700, AMPN) + T(1370, 354, 'does not show in', 14, 400, MUTED) + T(1370, 376, 'these odds, but it', 14, 400, MUTED) + T(1370, 398, 'changes interference', 14, 400, MUTED) + T(1370, 420, '(Scene 63)', 14, 400, MUTED))
s.f(3)
s.raw('<rect x="60" y="580" width="700" height="230" rx="16" fill="#ffffff" stroke="#5eead4" stroke-width="2"/>')
s.raw(badge(94, 614, 3, 'teal', 20) + T(124, 622, '100 copies of state 1, each measured once', 18, 800, INK))
rng = random.Random(60)
ones = set(rng.sample(range(100), 25))
for i in range(100):
    x, y = 96 + (i % 25) * 26, 662 + (i // 25) * 30
    if i in ones:
        s.raw(f'<circle cx="{x}" cy="{y}" r="10" fill="{AMP}"/>')
    else:
        s.raw(f'<circle cx="{x}" cy="{y}" r="9" fill="#ffffff" stroke="{PROB}" stroke-width="2.5"/>')
s.raw(f'<circle cx="104" cy="790" r="8" fill="#ffffff" stroke="{PROB}" stroke-width="2.5"/>' + T(118, 795, 'read 0: 75', 15, 600, '#334155')
      + f'<circle cx="230" cy="790" r="8" fill="{AMP}"/>' + T(244, 795, 'read 1: 25', 15, 600, '#334155')
      + T(360, 795, 'each result is one definite bit', 15, 600, '#334155'))
s.f(4)
s.raw('<rect x="800" y="580" width="740" height="230" rx="16" fill="#fffbeb" stroke="#fcd34d" stroke-width="2"/>')
s.raw(badge(834, 614, 4, 'amber', 20) + T(864, 622, 'A coin is not a superposition', 18, 800, INK))
s.raw(f'<circle cx="880" cy="700" r="38" fill="#fde68a" stroke="#b45309" stroke-width="3"/>' + T(880, 709, '¢', 28, 800, '#b45309', 'middle'))
s.raw(lines(940, 670, ['Measured directly, a fair coin and |+⟩ both give 50 : 50.',
                       'Apply H first: |+⟩ reads 0 every time; the coin stays 50 : 50.',
                       'Randomness from not knowing is not the same as',
                       'amplitudes that can interfere.'], 15, '#334155', 400, 26))
scenes[60] = s.render('Purple: amplitudes (minus shown in pink). Teal: probabilities = |amplitude|².')


# ── 61 Hadamard ─────────────────────────────────────────────────────
s = Scene(61, 'The Hadamard gate: even odds, not half a particle',
          'Five frames. 1, the state ket 0, amplitudes 1 and 0, goes through an H gate and comes out with amplitudes plus '
          '0.707 and plus 0.707, probabilities 0.50 and 0.50. 2, ket 1 goes through H and comes out with plus 0.707 and minus '
          '0.707, also 0.50 and 0.50. 3, the H matrix, one over root two times one, one, one, minus one. 4, a note that a '
          'measurement always finds a whole particle, 0 or 1; the half is a probability. 5, applying H twice returns ket 0, '
          'because the two contributions to 1 cancel: a first taste of interference.',
          sub='H turns a definite 0 into equal odds of 0 and 1, and does the same to a 1 with a sign flip.')
for row, (start, out) in enumerate((((1, 0), (R2, R2)), ((0, 1), (R2, -R2)))):
    s.f(1 + row)
    y0 = 160 + row * 270
    zero = y0 + 150
    s.raw(f'<rect x="60" y="{y0}" width="980" height="250" rx="16" fill="#ffffff" stroke="#e9d5ff" stroke-width="2"/>')
    s.raw(badge(94, y0 + 34, 1 + row, 'purple', 20) + T(124, y0 + 42, f'start in |{row}⟩', 18, 800, INK))
    s.raw(bars(110, zero, list(start), None, 70))
    s.raw(bar_labels(110, y0 + 238, ['|0⟩', '|1⟩']))
    s.raw(wire(270, 420, zero - 20) + gate(420, zero - 55, 'H') + wire(510, 580, zero - 20))
    s.raw(bars(600, zero, list(out), None, 70))
    s.raw(bar_labels(600, y0 + 238, ['|0⟩', '|1⟩']))
    s.raw(T(800, zero - 20, '→', 26, 700, MUTED, 'middle'))
    s.raw(bars(850, zero, [o * o for o in out], None, 70, 'prob'))
    s.raw(bar_labels(850, y0 + 238, ['P(0)', 'P(1)']))
s.f(3)
s.raw(panel(1080, 160, 460, 250, 'slate', 3, 'The rule, as a matrix'))
s.raw(matrix(1110, 292, [['1', '1'], ['1', '−1']], 'H = 1/√2 ·'))
s.raw(T(1110, 372, 'Ideal gates are reversible (unitary).', 15, 400, MUTED))
s.f(4)
s.raw(callout(1080, 430, 460, 250, 'Not half a particle', 'Every measurement finds a whole\nthing: a 0 or a 1, a whole photon or\nelectron. “Half” is a probability.\nNothing is split in two.', 'amber', 4))
s.f(5)
s.raw('<rect x="60" y="710" width="1480" height="100" rx="14" fill="#f5f3ff" stroke="#c4b5fd" stroke-width="2"/>')
s.raw(badge(94, 744, 5, 'purple', 20) + T(124, 752, 'H twice gives back |0⟩', 18, 800, AMP))
s.raw(Tp(124, 786, 'to 0:  0.707·0.707 + 0.707·0.707 = 1     to 1:  0.707·0.707 + 0.707·(−0.707) = 0     the paths to 1 cancel', 15.5, 600, '#334155', mono=True))
scenes[61] = s.render('Ideal gates. Amplitudes to three places.')


# ── 62 Z gate ───────────────────────────────────────────────────────
s = Scene(62, 'The Z gate changes a phase you cannot see directly',
          'Five frames. 1, the plus state: amplitudes plus 0.707 and plus 0.707, probabilities 0.50 and 0.50. 2, the Z gate, '
          'matrix one, zero, zero, minus one: it flips the sign of the ket 1 part. 3, the result is the minus state, '
          'amplitudes plus 0.707 and minus 0.707, with exactly the same probabilities, 0.50 and 0.50. 4, as arrows, the ket 1 '
          'part turns by 180 degrees while the ket 0 part stays: a relative phase. 5, a note that measuring now cannot tell '
          'plus from minus, but the next H gate can (Scene 63).',
          sub='Same odds before and after. What changed is the relative phase.')
s.f(1)
s.raw(panel(60, 160, 440, 420, 'purple', 1, 'Before: |+⟩'))
s.raw(bars(100, 380, [R2, R2], None, 100))
s.raw(bar_labels(100, 540, ['|0⟩', '|1⟩']))
s.raw(bars(300, 380, [0.5, 0.5], None, 100, 'prob'))
s.raw(bar_labels(300, 540, ['P(0)', 'P(1)']))
s.f(2)
s.raw(wire(500, 560, 340) + gate(560, 305, 'Z') + wire(650, 700, 340))
s.raw(matrix(540, 436, [['1', '0'], ['0', '−1']], 'Z =', size=18, colw=40, rowh=30))
s.raw(T(605, 500, 'flips the sign', 14.5, 600, MUTED, 'middle') + T(605, 520, 'of the |1⟩ part', 14.5, 600, MUTED, 'middle'))
s.f(3)
s.raw(panel(710, 160, 440, 420, 'purple', 3, 'After: |−⟩'))
s.raw(bars(750, 380, [R2, -R2], None, 100))
s.raw(bar_labels(750, 540, ['|0⟩', '|1⟩']))
s.raw(bars(950, 380, [0.5, 0.5], None, 100, 'prob'))
s.raw(bar_labels(950, 540, ['P(0)', 'P(1)']))
s.f(4)
s.raw(panel(1190, 160, 350, 420, 'slate', 4, 'As arrows'))
for row, (lab, a1_, a2_) in enumerate((('|+⟩', 0, 0), ('|−⟩', 0, 180))):
    yy = 300 + row * 150
    s.raw(T(1214, yy + 6, lab, 18, 800, AMP, mono=True))
    for k, ang in enumerate((a1_, a2_)):
        ccx = 1330 + k * 120
        s.raw(f'<circle cx="{ccx}" cy="{yy}" r="46" fill="#ffffff" stroke="#e9d5ff" stroke-width="2"/>')
        s.raw(phasor(ccx, yy, 46, ang, AMP, 0.75))
        if row == 0:
            s.raw(T(ccx, yy - 56, '|0⟩ part' if k == 0 else '|1⟩ part', 13, 600, MUTED, 'middle'))
s.raw(T(1214, 540, '|1⟩ part turned by 180°', 14.5, 700, AMP))
s.f(5)
s.raw('<rect x="60" y="610" width="1480" height="190" rx="16" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(badge(96, 648, 5, 'slate', 20) + T(126, 656, 'Invisible now, decisive next', 20, 800, INK))
s.raw(lines(126, 694, ['Measured right now, |+⟩ and |−⟩ give the same 50 : 50: no single reading can tell them apart.',
                       'The difference is a relative phase of 180°. One more H turns |+⟩ into 0 every time and |−⟩ into 1 every time (Scene 63).',
                       'A phase you cannot read directly still decides the outcome of the next step.'], 16, '#334155', 400, 30))
scenes[62] = s.render('Ideal gates. Purple: amplitudes. Teal: probabilities.')


# ── 63 Interference in H–Z–H ────────────────────────────────────────
s = Scene(63, 'Interference: H, then Z, then H always gives 1',
          'Five frames. 1, a circuit: ket 0, an H gate, a Z gate, another H gate, then a measurement. 2, the amplitudes after '
          'each step: ket 0 is 1 and 0; after H, plus 0.707 and plus 0.707; after Z, plus 0.707 and minus 0.707; after the last '
          'H, 0 and 1. 3, the last H path by path: to output 0, plus 0.5 from the ket 0 part and minus 0.5 from the ket 1 part '
          'cancel to 0; to output 1, plus 0.5 and plus 0.5 add to 1. 4, for a general phase phi between the parts, the final '
          'probabilities are cos squared of phi over 2 for 0 and sin squared of phi over 2 for 1, plotted from 0 to 360 '
          'degrees with values 1, 0.5, 0, 0.5 and 1 for P of 0 at 0, 90, 180, 270 and 360 degrees. 5, phi equal to 180 degrees '
          'is the Z gate, so this circuit reads 1 every time.',
          sub='Paths to the wrong answer cancel; paths to the right one add. That is all interference means here.')
s.f(1)
s.raw(T(80, 222, '|0⟩', 24, 800, INK, mono=True))
s.raw(wire(130, 1420, 214))
for x, g in ((400, 'H'), (760, 'Z'), (1120, 'H')):
    s.raw(gate(x, 179, g))
s.raw(meter(1420, 179))
states = [((1, 0), '|0⟩', 250), ((R2, R2), '|+⟩', 600), ((R2, -R2), '|−⟩', 960), ((0, 1), '|1⟩', 1300)]
s.f(2)
for vals, lab, cx in states:
    s.raw(bars(cx - 50, 360, list(vals), None, 70, w=44, gap=12))
    s.raw(bar_labels(cx - 50, 470, ['|0⟩', '|1⟩'], w=44, gap=12))
    s.raw(T(cx, 498, lab, 20, 800, AMP, 'middle', mono=True))
s.f(3)
s.raw('<rect x="60" y="520" width="700" height="290" rx="16" fill="#ffffff" stroke="#e9d5ff" stroke-width="2"/>')
s.raw(badge(94, 552, 3, 'purple', 20) + T(124, 560, 'The last H, path by path', 18, 800, INK))
L0, L1, O0, O1 = (180, 630), (180, 750), (560, 630), (560, 750)
s.raw(T(90, 636, '+0.707', 16, 700, AMP, mono=True) + T(90, 756, '−0.707', 16, 700, AMPN, mono=True))
s.raw(T(150, 610, '|0⟩ part', 13.5, 600, MUTED, 'end') + T(150, 730, '|1⟩ part', 13.5, 600, MUTED, 'end'))
for (p, q, col, lab, lx, ly) in ((L0, O0, '#16a34a', '+0.5', 370, 618), (L1, O0, '#dc2626', '−0.5', 290, 742),
                                (L0, O1, '#16a34a', '+0.5', 290, 652), (L1, O1, '#16a34a', '+0.5', 370, 770)):
    s.raw(f'<path d="M{p[0] + 14},{p[1]} L{q[0] - 14},{q[1]}" stroke="{col}" stroke-width="3.5"/>')
    s.raw(f'<rect x="{lx - 26}" y="{ly - 17}" width="52" height="24" rx="6" fill="#ffffff"/>' + T(lx, ly, lab, 15, 800, col, 'middle', mono=True))
for (pt, c) in ((L0, AMP), (L1, AMPN), (O0, INK), (O1, INK)):
    s.raw(f'<circle cx="{pt[0]}" cy="{pt[1]}" r="12" fill="{c}"/>')
s.raw(T(586, 636, 'output 0: 0', 16, 800, '#b91c1c') + T(586, 656, 'cancel', 13.5, 600, MUTED))
s.raw(T(586, 756, 'output 1: 1', 16, 800, '#15803d') + T(586, 776, 'add', 13.5, 600, MUTED))
s.f(4)
s.raw('<rect x="800" y="520" width="740" height="290" rx="16" fill="#ffffff" stroke="#5eead4" stroke-width="2"/>')
s.raw(badge(834, 552, 4, 'teal', 20) + T(864, 560, 'Any phase φ:  P(0) = cos²(φ/2),  P(1) = sin²(φ/2)', 16.5, 800, INK))
gx, gy, gw, gh = 870, 760, 480, 160
s.raw(axis(gx, gy, gw, gy - gh - 10, gy))
s.raw(curve(gx, gy, gw, lambda t: math.cos(math.pi * t) ** 2, gh, PROB, 3.5))
s.raw(curve(gx, gy, gw, lambda t: math.sin(math.pi * t) ** 2, gh, AMP, 3, '8 6'))
for k, deg in enumerate((0, 90, 180, 270, 360)):
    px = gx + gw * deg / 360
    p0 = math.cos(math.radians(deg) / 2) ** 2
    s.raw(f'<circle cx="{px:.0f}" cy="{gy - gh * p0:.1f}" r="6" fill="{PROB}"/>')
    s.raw(T(px, gy + 22, f'{deg}°', 13, 600, MUTED, 'middle'))
    s.raw(T(px, gy - gh * p0 - 12 if p0 > 0.1 else gy - gh * p0 - 12, f'{p0:.2f}', 13, 700, PROB, 'middle'))
s.raw(f'<path d="M{gx + gw + 30},{gy - 40} L{gx + gw + 54},{gy - 40}" stroke="{PROB}" stroke-width="3.5"/>' + T(gx + gw + 62, gy - 35, 'P(0)', 14, 700, PROB)
      + f'<path d="M{gx + gw + 30},{gy - 14} L{gx + gw + 54},{gy - 14}" stroke="{AMP}" stroke-width="3" stroke-dasharray="6 4"/>' + T(gx + gw + 62, gy - 9, 'P(1)', 14, 700, AMP))
s.raw(T(gx - 10, gy - gh + 4, '1', 13, 600, MUTED, 'end') + T(gx - 10, gy + 4, '0', 13, 600, MUTED, 'end'))
s.f(5)
px180 = gx + gw * 0.5
s.raw(f'<circle cx="{px180:.0f}" cy="{gy - gh}" r="9" fill="none" stroke="#b45309" stroke-width="3"/>')
s.raw(lines(gx + gw + 30, gy - gh + 10, ['φ = 180°', 'is the Z gate:', 'P(1) = 1'], 14.5, '#b45309', 800, 22))
scenes[63] = s.render('Ideal gates. Values computed: 0.707 = 1/√2.')


# ── 64 Double slit ──────────────────────────────────────────────────
def fringe(u):
    """Two-slit intensity at screen position u in [-1, 1]: cos² fringes under a single-slit envelope."""
    env = 1.0 if abs(u) < 1e-9 else (math.sin(2.2 * u) / (2.2 * u)) ** 2
    return math.cos(9.0 * u) ** 2 * env


def humps(u):
    """No which-path interference: the sum of two single-slit patterns."""
    g = lambda c: math.exp(-((u - c) / 0.32) ** 2)
    return 0.5 * (g(-0.22) + g(0.22))


s = Scene(64, 'The double slit: stripes made of single dots',
          'Five frames. 1, a source sends particles, electrons, photons or even large molecules, towards a barrier with two '
          'slits; the screen behind shows a striped intensity pattern. 2, the particles arrive one at a time and each lands as '
          'a single dot; the stripes appear only after many dots. 3, when a detector records which slit each particle passed '
          'through, the stripes vanish and only a smooth, stripe-free spread remains. 4, the environment can carry away the same which-slit '
          'information, stray light, heat and gas molecules, so the stripes wash out: decoherence, the reason qubits are '
          'cooled and isolated. 5, a note that the stripes are in the probabilities of where whole particles land, not ripples '
          'of a substance, and that circuit interference (Scene 63) is amplitudes adding in a calculation the hardware carries out.',
          sub='Interference is real in nature. What it is not: tiny particles behaving as ripples.')
s.f(1)
s.raw('<rect x="60" y="160" width="1080" height="360" rx="18" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>')
s.raw('<rect x="90" y="290" width="150" height="90" rx="12" fill="#334155"/>')
s.raw(T(165, 332, 'source', 17, 800, '#ffffff', 'middle') + T(165, 356, 'one at a time', 13, 400, '#e2e8f0', 'middle'))
s.raw('<path d="M250,335 L486,335" stroke="#64748b" stroke-width="5"/><path d="M484,323 L506,335 L484,347 Z" fill="#64748b"/>')
s.raw(T(375, 312, 'electrons, photons,', 14, 600, MUTED, 'middle') + T(375, 368, 'even C₆₀ molecules', 14, 600, MUTED, 'middle'))
s.raw('<rect x="520" y="190" width="22" height="115" fill="#475569"/><rect x="520" y="320" width="22" height="30" fill="#475569"/><rect x="520" y="365" width="22" height="125" fill="#475569"/>')
s.raw(T(531, 510, 'two slits', 14, 700, INK, 'middle'))
s.raw('<rect x="860" y="190" width="16" height="300" fill="#cbd5e1" stroke="#64748b" stroke-width="1.5"/>')
s.raw(T(868, 510, 'screen', 14, 700, INK, 'middle'))
pts = ' L'.join(f'{880 + 220 * fringe((y - 340) / 150):.1f},{y}' for y in range(190, 491))
s.raw(f'<path d="M880,190 L{pts} L880,490" fill="#bfdbfe" stroke="{WAVE}" stroke-width="2"/>')
s.raw(T(1010, 474, 'how often a particle', 13.5, 600, MUTED, 'middle') + T(1010, 492, 'lands at each height', 13.5, 600, MUTED, 'middle'))
s.f(2)
s.raw('<rect x="1180" y="160" width="360" height="360" rx="18" fill="#0f172a"/>')
s.raw(T(1360, 192, 'dots arrive one by one', 15, 700, '#e2e8f0', 'middle'))
rng = random.Random(64)
n = 0
while n < 320:
    u = rng.uniform(-1, 1)
    if rng.random() < fringe(u):
        y = 345 + 125 * u
        x = rng.uniform(1210, 1510)
        s.raw(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2.6" fill="#fde68a"/>')
        n += 1
s.raw(T(1360, 506, 'stripes only in the statistics', 13.5, 600, '#cbd5e1', 'middle'))
s.f(3)
s.raw(callout(60, 550, 470, 260, 'Ask which slit: stripes vanish', '', 'red', 3))
s.raw(eye(90, 650, 0.7, '#b91c1c'))
s.raw(T(160, 656, 'a detector at the slits', 14.5, 600, '#334155'))
pts = ' L'.join(f'{400 + 120 * humps((y - 700) / 90):.1f},{y}' for y in range(615, 786))
s.raw(f'<rect x="386" y="615" width="12" height="170" fill="#cbd5e1"/><path d="M400,615 L{pts} L400,785" fill="#fecaca" stroke="#dc2626" stroke-width="2"/>')
s.raw(T(90, 720, 'Knowing the path', 14.5, 400, '#334155') + T(90, 742, 'removes the stripes:', 14.5, 400, '#334155') + T(90, 764, 'a smooth spread.', 14.5, 700, '#b91c1c'))
s.f(4)
s.raw(callout(560, 550, 470, 260, 'The environment asks too', 'Stray light, heat and gas molecules\ncan carry away which-path information.\nThe stripes wash out: decoherence.\nThat is why qubits are cooled and\nisolated (Module 9).', 'amber', 4))
s.f(5)
s.raw(callout(1060, 550, 480, 260, 'Not tiny ripples', 'The stripes are in the probabilities\nof where whole particles land.\nIn a qubit circuit, interference is\namplitudes adding in the calculation\nthe hardware carries out (Scene 63).', 'purple', 5))
scenes[64] = s.render('Pattern computed (cos² fringes, single-slit envelope). Not to scale.')
