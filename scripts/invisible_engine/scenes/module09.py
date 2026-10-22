"""Module 9 scenes (65–72): quantum computation, hardware and algorithms.
Run scripts/invisible_engine/build.py to write the SVGs.

Accuracy rules for this module (docs/INVISIBLE-ENGINE.md): every amplitude, probability,
table value and curve below is COMPUTED here, never typed; nothing is described as
already broken by a quantum computer; vendor hardware claims and resource estimates are
labelled and dated.
"""
import cmath
import math
import random
from fractions import Fraction

from .svgkit import Scene
from .art import *

scenes = {}

SQ2 = 1 / math.sqrt(2)


# ── tiny statevector simulator (for the numbers drawn below) ───────
def apply1(state, gate, q, n):
    """Apply a 2x2 gate to qubit q (0 = leftmost) of an n-qubit state."""
    out = [0j] * len(state)
    bit = n - 1 - q
    for i, a in enumerate(state):
        if a == 0:
            continue
        b = (i >> bit) & 1
        for nb in (0, 1):
            g = gate[nb][b]
            if g != 0:
                j = (i & ~(1 << bit)) | (nb << bit)
                out[j] += g * a
    return out


def cnot(state, c, t, n):
    out = list(state)
    cb, tb = n - 1 - c, n - 1 - t
    for i in range(len(state)):
        if (i >> cb) & 1:
            j = i ^ (1 << tb)
            out[j] = state[i]
    return out


H = [[SQ2, SQ2], [SQ2, -SQ2]]
X = [[0, 1], [1, 0]]
Z = [[1, 0], [0, -1]]


def fmt(v, digits=3):
    """Format a real amplitude/probability for display, e.g. 0.707, −0.5, 1."""
    v = 0.0 if abs(v) < 1e-12 else v
    s = f'{v:.{digits}f}'.rstrip('0').rstrip('.')
    return s.replace('-', '−') if s not in ('-0', '') else '0'


# ── local drawing helpers (Module 9 only) ──────────────────────────
def lines(x, y, rows, size=15.5, color='#334155', weight=400, lh=None, anchor='start'):
    lh = lh or round(size * 1.6)
    return ''.join(T(x, y + i * lh, r, size, weight, color, anchor) for i, r in enumerate(rows))


def amp_bars(x, y, w, h, labels, amps, title=None, signed=True, color_pos='#2563eb', color_neg='#dc2626', unit=1.0):
    """Bars for amplitudes (signed, baseline in the middle) or probabilities (from the bottom).
    (x, y) is the top-left of the plot area; values are scaled so |unit| fills half (signed) or all of h."""
    out = ''
    if title:
        out += T(x, y - 14, title, 16, 800, '#14213d')
    n = len(amps)
    slot = w / n
    bw = min(60, slot * 0.55)
    base = y + h / 2 if signed else y + h
    span = h / 2 if signed else h
    out += f'<path d="M{x},{base:.0f} L{x + w},{base:.0f}" stroke="#334155" stroke-width="2"/>'
    if signed:
        out += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="none" stroke="#e2e8f0" stroke-width="1.5"/>'
    for i, (lab, a) in enumerate(zip(labels, amps)):
        cx = x + slot * (i + 0.5)
        v = a.real if isinstance(a, complex) else a
        bh = abs(v) / unit * span
        col = color_pos if v >= 0 else color_neg
        top = base - bh if v >= 0 else base
        if bh > 0.5:
            out += f'<rect x="{cx - bw / 2:.0f}" y="{top:.1f}" width="{bw:.0f}" height="{bh:.1f}" rx="4" fill="{col}"/>'
        ty = top - 8 if v >= 0 else base + bh + 20
        out += T(cx, ty, fmt(v), 15, 700, col if abs(v) > 1e-12 else '#64748b', 'middle')
        out += T(cx, y + h + (24 if not signed else 24), lab, 15, 600, '#334155', 'middle', mono=True)
    return out


def gate_box(x, y, label, color='#1d4ed8', w=56):
    return (f'<rect x="{x - w / 2:.0f}" y="{y - 26}" width="{w}" height="52" rx="8" fill="#ffffff" stroke="{color}" stroke-width="3"/>'
            + T(x, y + 8, label, 22, 800, color, 'middle'))


def wire(x1, x2, y, label=None):
    out = f'<path d="M{x1},{y} L{x2},{y}" stroke="#334155" stroke-width="2.5"/>'
    if label:
        out += T(x1 - 12, y + 7, label, 18, 700, '#14213d', 'end', mono=True)
    return out


def cnot_sym(x, yc, yt):
    return (f'<path d="M{x},{yc} L{x},{yt + 20}" stroke="#334155" stroke-width="3"/>'
            f'<circle cx="{x}" cy="{yc}" r="9" fill="#334155"/>'
            f'<circle cx="{x}" cy="{yt}" r="20" fill="#ffffff" stroke="#334155" stroke-width="3"/>'
            f'<path d="M{x - 20},{yt} L{x + 20},{yt} M{x},{yt - 20} L{x},{yt + 20}" stroke="#334155" stroke-width="3"/>')


def meter(x, y):
    """A measurement box on a wire, centred at (x, y)."""
    return (f'<rect x="{x - 30}" y="{y - 26}" width="60" height="52" rx="8" fill="#f8fafc" stroke="#334155" stroke-width="3"/>'
            f'<path d="M{x - 18},{y + 12} A20,20 0 0 1 {x + 18},{y + 12}" fill="none" stroke="#334155" stroke-width="2.5"/>'
            f'<path d="M{x},{y + 12} L{x + 12},{y - 12}" stroke="#334155" stroke-width="2.5"/>')


def classical_wire(x1, x2, y):
    return (f'<path d="M{x1},{y - 3} L{x2},{y - 3} M{x1},{y + 3} L{x2},{y + 3}" stroke="#64748b" stroke-width="2"/>')


def table(x, y, colw, rows, rowh=34, head_fill='#eef2ff', size=15, mono_cols=()):
    """rows[0] is the header. colw: list of column widths."""
    out = ''
    W = sum(colw)
    for r, row in enumerate(rows):
        yy = y + r * rowh
        fill = head_fill if r == 0 else ('#ffffff' if r % 2 else '#f8fafc')
        out += f'<rect x="{x}" y="{yy}" width="{W}" height="{rowh}" fill="{fill}" stroke="#e2e8f0" stroke-width="1"/>'
        cx = x
        for c, (cell, cw) in enumerate(zip(row, colw)):
            out += T(cx + cw / 2, yy + rowh / 2 + size * 0.36, str(cell), size, 800 if r == 0 else 500,
                     '#14213d', 'middle', mono=(c in mono_cols and r > 0))
            cx += cw
    return out


def drawer(x, y, w, h, label, marked=False):
    col = '#b45309' if marked else '#64748b'
    out = (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="#fdf6e3" stroke="{col}" stroke-width="3"/>'
           f'<rect x="{x + w / 2 - 22:.0f}" y="{y + h / 2 - 6:.0f}" width="44" height="12" rx="6" fill="{col}"/>')
    out += T(x + w / 2, y + h + 26, label, 16, 700, '#334155', 'middle', mono=True)
    if marked:
        out += f'<path d="M{x + w - 26},{y + 10} l9,9 l16,-18" fill="none" stroke="#b45309" stroke-width="4" stroke-linecap="round"/>'
    return out


def fridge(x, y, s=1.0):
    """A dilution-refrigerator 'chandelier': stacked gold plates, colder towards the bottom."""
    temps = ['room temperature', '~50 K', '~4 K', '~1 K', '~100 mK', '~10–20 mK']
    out = ''
    for i, t in enumerate(temps):
        yy = y + i * 78 * s
        w = (330 - i * 26) * s
        cx = x + 170 * s
        out += f'<rect x="{cx - w / 2:.0f}" y="{yy:.0f}" width="{w:.0f}" height="{16 * s:.0f}" rx="5" fill="#d4a017" stroke="#92400e" stroke-width="2"/>'
        out += T(cx + w / 2 + 14, yy + 14 * s, t, 14.5, 600, '#334155')
        if i < len(temps) - 1:
            for dx in (-0.32, 0, 0.32):
                rx = cx + dx * w * 0.9
                out += f'<path d="M{rx:.0f},{yy + 16 * s:.0f} L{rx:.0f},{yy + 78 * s:.0f}" stroke="#b7791f" stroke-width="{4 * s:.1f}"/>'
    # chip at the bottom
    cy = y + 5 * 78 * s + 30 * s
    out += f'<rect x="{x + 140 * s:.0f}" y="{cy:.0f}" width="{60 * s:.0f}" height="{30 * s:.0f}" rx="4" fill="#334155"/>'
    return out


def jj_chip(x, y, s=1.0):
    """A superconducting qubit chip: an aluminium loop interrupted by a Josephson junction."""
    out = f'<rect x="{x}" y="{y}" width="{300 * s:.0f}" height="{220 * s:.0f}" rx="12" fill="#e2e8f0" stroke="#475569" stroke-width="3"/>'
    out += f'<rect x="{x + 70 * s:.0f}" y="{y + 50 * s:.0f}" width="{160 * s:.0f}" height="{120 * s:.0f}" rx="18" fill="none" stroke="#94a3b8" stroke-width="{12 * s:.0f}"/>'
    # junction: a gap in the loop, bridged by a thin barrier
    jx, jy = x + 150 * s, y + 50 * s
    out += f'<rect x="{jx - 10 * s:.0f}" y="{jy - 8 * s:.0f}" width="{20 * s:.0f}" height="{16 * s:.0f}" fill="#e2e8f0"/>'
    out += f'<rect x="{jx - 3 * s:.0f}" y="{jy - 8 * s:.0f}" width="{6 * s:.0f}" height="{16 * s:.0f}" fill="#7c3aed"/>'
    return out


def ion_trap(x, y, n=5):
    out = (f'<rect x="{x}" y="{y}" width="560" height="34" rx="6" fill="#94a3b8"/>'
           f'<rect x="{x}" y="{y + 156}" width="560" height="34" rx="6" fill="#94a3b8"/>')
    for i in range(n):
        cx = x + 120 + i * 80
        out += f'<circle cx="{cx}" cy="{y + 95}" r="15" fill="#0ea5e9" stroke="#075985" stroke-width="2"/>'
    return out


def note_illus(s, x, y, text='Illustrative drawing'):
    s.text(x, y, text, 'note')


# ── 65 Entanglement ─────────────────────────────────────────────────
st = [1 + 0j, 0j, 0j, 0j]                      # |00>
after_h = apply1(st, H, 0, 2)
bell = cnot(after_h, 0, 1, 2)
P_bell = [abs(a) ** 2 for a in bell]
labs2 = ['00', '01', '10', '11']
rng = random.Random(65)
shots = []
for _ in range(10):
    r = rng.random()
    acc = 0
    for k, p in enumerate(P_bell):
        acc += p
        if r < acc:
            shots.append(labs2[k])
            break
same = sum(1 for b in shots if b[0] == b[1])
alice0 = sum(1 for b in shots if b[0] == '0')

s = Scene(65, 'Entanglement: two qubits, one shared story',
          'Five frames. 1, a circuit: two qubits start in 0; a Hadamard gate acts on the first; then a CNOT gate uses the first as '
          f'control and the second as target. 2, after the Hadamard the amplitudes for 00, 01, 10 and 11 are {", ".join(fmt(a.real) for a in after_h)}. '
          f'3, after the CNOT they are {", ".join(fmt(a.real) for a in bell)}: the Bell state (|00⟩+|11⟩)/√2, with probability '
          f'{fmt(P_bell[0])} for 00 and {fmt(P_bell[3])} for 11. 4, ten simulated runs of preparing and measuring it: the two '
          f'qubits agree in all {same} runs, while each qubit alone looks random. 5, no faster-than-light messages: one side’s '
          'results look 50/50 whatever the other side does; the correlation appears only when the two lists are compared over an '
          'ordinary channel.',
          sub='Measure one and you know the other — but neither side can send a message this way.')
s.f(1)
s.raw(wire(150, 760, 215, '|0⟩') + wire(150, 760, 295, '|0⟩'))
s.raw(gate_box(260, 215, 'H'))
s.raw(cnot_sym(420, 215, 295))
s.raw(T(260, 176, 'Hadamard on q0', 15, 600, '#1d4ed8', 'middle'))
s.raw(T(420, 176, 'CNOT: q0 controls q1', 15, 600, '#334155', 'middle'))
s.raw(lines(530, 210, ['Left to right: start, then gates.', 'Wires carry qubits, not current.'], 15))
s.raw(callout(80, 335, 680, 92, 'The recipe', 'H puts the first qubit in an even mix; CNOT flips the second only where the first is 1.', 'blue', 1, 19, 15.5))
s.f(2)
s.raw(amp_bars(80, 500, 200, 130, labs2, after_h, 'After H', True))
s.raw(T(180, 690, '(|00⟩ + |10⟩)/√2', 15, 700, '#334155', 'middle'))
s.raw(T(180, 712, 'not yet linked', 14, 400, '#475569', 'middle'))
s.f(3)
s.raw(amp_bars(320, 500, 200, 130, labs2, bell, 'After CNOT', True))
s.raw(amp_bars(560, 500, 200, 130, labs2, P_bell, 'Probabilities', False, '#16a34a'))
s.raw(T(540, 712, '(|00⟩ + |11⟩)/√2 — the Bell state', 16, 800, '#14213d', 'middle'))
s.raw(T(540, 740, 'probability = amplitude²', 14.5, 400, '#475569', 'middle'))
s.f(4)
s.raw('<rect x="880" y="430" width="660" height="300" rx="14" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(badge(910, 466, 4, 'slate', 18) + T(940, 473, 'Ten simulated runs (prepare, then measure both)', 16, 800, '#14213d'))
for i, b in enumerate(shots):
    cx = 920 + (i % 5) * 122
    cy = 510 + (i // 5) * 74
    s.raw(f'<rect x="{cx}" y="{cy}" width="104" height="50" rx="8" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>'
          + T(cx + 52, cy + 33, b, 22, 800, '#1d4ed8', 'middle', mono=True))
s.raw(T(910, 690, f'The two qubits agree in {same} of {len(shots)} runs.', 15.5, 700, '#334155'))
s.raw(T(910, 714, f'q0 alone: {alice0} zeros, {len(shots) - alice0} ones — it looks random.', 15.5, 400, '#334155'))
s.f(5)
s.raw(callout(880, 160, 660, 170, 'No faster-than-light messages',
              'Whatever the far side does, the near side’s own results stay\n50/50: P(q0 = 0) = ' + fmt(P_bell[0] + P_bell[1]) + '. The agreement only shows up\n'
              'when both lists are brought together over an ordinary\nchannel, at ordinary speed (the no-signalling theorem).',
              'purple', 5, 20, 16))
scenes[65] = s.render('Amplitudes computed with a two-qubit statevector simulation.')


# ── 66 Grover with four drawers ─────────────────────────────────────
Ng = 4
marked = 2
g0 = [1 / math.sqrt(Ng)] * Ng
g1 = [(-a if i == marked else a) for i, a in enumerate(g0)]
mean1 = sum(g1) / Ng
g2 = [2 * mean1 - a for a in g1]
P2 = [a * a for a in g2]
labs = ['00', '01', '10', '11']


def grover_success(N, k):
    th = math.asin(1 / math.sqrt(N))
    return math.sin((2 * k + 1) * th) ** 2


rows66 = [['N items', 'Grover iterations ≈ (π/4)√N', 'P(success)', 'Classical, on average']]
for N in (4, 64, 1024, 1_048_576):
    k = max(1, math.floor(math.pi / 4 * math.sqrt(N)))
    rows66.append([f'{N:,}', f'{k:,}', fmt(grover_success(N, k), 3), f'{N // 2:,} looks'])

s = Scene(66, 'Grover with four drawers: making the right answer loud',
          f'Five frames. 1, four drawers, one of which (drawer {labs[marked]}) holds the prize; a quantum register starts with equal '
          f'amplitudes of {fmt(g0[0])} on each, so every drawer has probability {fmt(g0[0] ** 2)}. 2, the oracle flips the sign of the '
          f'marked amplitude to {fmt(g1[marked])}; probabilities are unchanged. 3, the mean amplitude is now {fmt(mean1)}, and each '
          f'amplitude is reflected about it. 4, after that inversion the marked drawer’s amplitude is {fmt(g2[marked])} and the '
          f'others {fmt(g2[0])}, so measuring finds the prize with probability {fmt(P2[marked])}. 5, scaling: about (π/4)√N '
          'oracle queries for N items; four items is a teaching case where one round is exact; the table compares iterations '
          'and success probability for larger N with the classical average of N/2 looks.',
          sub='Not reading every drawer at once: interference turns one quiet answer into a loud one.')


def stage(i, n, color, title, amps, probs=None, extra=None):
    x = 70 + i * 370
    out = f'<rect x="{x}" y="360" width="350" height="450" rx="14" fill="{STEP[color][1]}" stroke="{STEP[color][2]}" stroke-width="2"/>'
    out += badge(x + 30, 392, n, color, 18) + T(x + 58, 399, title, 18, 800, STEP[color][0])
    out += amp_bars(x + 20, 440, 310, 130, labs, amps, 'Amplitudes', True)
    if probs is not None:
        out += amp_bars(x + 20, 650, 310, 90, labs, probs, 'Probabilities', False, '#16a34a')
    if extra:
        out += extra
    return out


s.f(1)
for i in range(Ng):
    s.raw(drawer(90 + i * 150, 175, 110, 70, labs[i], i == marked))
s.raw(T(90, 300, f'One drawer ({labs[marked]}) holds the prize. The register starts even.', 16, 600, '#334155'))
s.raw(stage(0, 1, 'blue', 'Start: all equal', g0, [a * a for a in g0]))
s.f(2)
s.raw(stage(1, 2, 'red', 'Oracle flips the sign', g1, [a * a for a in g1]))
s.f(3)
ym = 440 + 65 - mean1 * 65
calc = ''.join(T(70 + 2 * 370 + 30, 668 + k * 28, f'{labs[k]}:  2×{fmt(mean1)} − ({fmt(g1[k])}) = {fmt(g2[k])}', 15.5, 600, '#4c1d95', mono=True) for k in range(Ng))
s.raw(stage(2, 3, 'purple', f'Mean = {fmt(mean1)}; reflect', g1, None,
            f'<path d="M{70 + 2 * 370 + 20},{ym:.1f} L{70 + 2 * 370 + 330},{ym:.1f}" stroke="#7c3aed" stroke-width="3" stroke-dasharray="9 6"/>'
            + T(70 + 2 * 370 + 30, 640, 'each a → 2×mean − a', 15, 700, '#6d28d9') + calc))
s.f(4)
s.raw(stage(3, 4, 'green', f'Prize found: P = {fmt(P2[marked])}', g2, P2))
s.f(5)
s.raw(table(760, 165, [120, 240, 120, 200], rows66, rowh=34, size=14))
scenes[66] = s.render('Amplitudes and the table computed exactly. Four items is a teaching case.')


# ── 67 Shor, intuitively ────────────────────────────────────────────
Nn, a = 15, 7
assert math.gcd(a, Nn) == 1
fx = [pow(a, x, Nn) for x in range(12)]
r = next(x for x in range(1, 20) if pow(a, x, Nn) == 1)
half = pow(a, r // 2)
f1, f2 = math.gcd(half - 1, Nn), math.gcd(half + 1, Nn)
# QFT over a Q = 16 register after the function value 1 has been observed: x in {0, r, 2r, ...}
Q = 16
xs = [x for x in range(Q) if pow(a, x, Nn) == 1]
amp_y = []
for y in range(Q):
    tot = sum(cmath.exp(2j * math.pi * x * y / Q) for x in xs) / math.sqrt(len(xs) * Q)
    amp_y.append(abs(tot) ** 2)
peaks = [y for y in range(Q) if amp_y[y] > 1e-9]


def cf_period(y):
    if y == 0:
        return None
    return Fraction(y, Q).limit_denominator(Nn).denominator


outcomes = []
for y in peaks:
    rr = cf_period(y)
    ok = rr is not None and rr % 2 == 0 and pow(a, rr, Nn) == 1 and pow(a, rr // 2, Nn) != Nn - 1
    outcomes.append((y, rr, ok))

s = Scene(67, 'Shor, intuitively: find the rhythm, then the factors',
          f'Five frames. 1, the task: factor N = {Nn} using a = {a}. 2, a table of {a}^x mod {Nn} for x from 0 to 11: '
          f'{", ".join(map(str, fx))} — the values repeat with period r = {r}. 3, a 4-qubit register measured after the quantum '
          f'Fourier transform gives only the outcomes {", ".join(map(str, peaks))}, each with probability '
          f'{fmt(amp_y[peaks[0]])}: the transform concentrates information about the period. 4, classical post-processing: '
          f'y/16 approximates k/r; continued fractions recover r from some outcomes and fail on others, so the run is repeated; with '
          f'r = {r}, gcd({a}^{r // 2} − 1, {Nn}) = {f1} and gcd({a}^{r // 2} + 1, {Nn}) = {f2}. 5, honesty: success is '
          'probabilistic, the hard part needs a large fault-tolerant machine for real key sizes, and the algorithm does not try all '
          'factors.',
          sub='The quantum part finds a period. Ordinary arithmetic does the rest.')
s.f(1)
s.raw(panel(60, 160, 380, 250, 'slate', 1, 'The task', f'Factor N = {Nn}', 24))
s.raw(lines(84, 300, [f'Pick a = {a} (no factor shared with {Nn}).', 'Look at the powers of a, mod N.', 'Their repeat length r is the clue.'], 15.5))
s.f(2)
s.raw(badge(490, 178, 2, 'blue', 18) + T(518, 185, 'Powers of 7, mod 15', 17, 800, '#14213d'))
s.raw(table(480, 205, [110] + [65] * 6, [['x'] + [str(x) for x in range(6)], [f'{a}ˣ mod {Nn}'] + [str(v) for v in fx[:6]]], rowh=38, size=16))
s.raw(table(480, 295, [110] + [65] * 6, [['x'] + [str(x) for x in range(6, 12)], [f'{a}ˣ mod {Nn}'] + [str(v) for v in fx[6:]]], rowh=38, size=16))
for x, v in enumerate(fx):
    bx = 1060 + x * 38
    bh = v / 15 * 150
    s.raw(f'<rect x="{bx}" y="{390 - bh:.0f}" width="28" height="{bh:.0f}" rx="3" fill="{"#7c3aed" if v == 1 else "#93c5fd"}"/>')
    s.raw(T(bx + 14, 410, str(x), 13, 600, '#475569', 'middle'))
s.raw(T(1060, 200, f'The pattern repeats every r = {r}', 16, 800, '#7c3aed'))
s.raw(T(1060, 222, 'purple bars: value 1 (where it restarts)', 14, 400, '#475569'))
s.f(3)
s.raw(badge(90, 466, 3, 'purple', 18))
s.raw(amp_bars(70, 500, 580, 200, [str(y) for y in range(Q)], amp_y, None, False, '#7c3aed', unit=0.3))
s.raw(T(118, 473, 'After the quantum Fourier transform: P(y)', 16, 800, '#14213d'))
s.raw(T(360, 770, f'Only y = {", ".join(map(str, peaks))}: multiples of 16 / r', 15.5, 700, '#5b21b6', 'middle'))
s.f(4)
rows67 = [['y', 'y / 16', 'guess r', 'useful?']]
for y, rr, ok in outcomes:
    rows67.append([str(y), str(Fraction(y, Q)) if y else '0', str(rr) if rr else '—', 'yes' if ok else 'no: repeat'])
s.raw(badge(710, 466, 4, 'slate', 18) + T(738, 473, 'Ordinary arithmetic', 16, 800, '#14213d'))
s.raw(table(700, 495, [80, 100, 110, 160], rows67, rowh=34, size=15))
SUP = str.maketrans('0123456789', '⁰¹²³⁴⁵⁶⁷⁸⁹')
s.raw(lines(700, 700, [f'With r = {r}:  {a}{str(r // 2).translate(SUP)} = {half}',
                       f'gcd({half} − 1, {Nn}) = {f1};  gcd({half} + 1, {Nn}) = {f2}',
                       f'{Nn} = {f1} × {f2}'], 16, '#14213d', 700, 30))
s.f(5)
s.raw(callout(1200, 450, 340, 270, 'What it is not',
              'It does not try every\nfactor at once.\nInterference concentrates\nthe answer; one measurement\ngives one sample; useless\nsamples mean another run.\n\n'
              'Real RSA keys need a large\nfault-tolerant machine. None\nis publicly known to exist.',
              'amber', 5, 19, 15.5))
scenes[67] = s.render(f'Every value computed: {a}^x mod {Nn}, an exact 16-point Fourier transform, continued fractions, gcd.')


# ── 68 Gates and circuits ───────────────────────────────────────────
HH = [[sum(H[i][k] * H[k][j] for k in range(2)) for j in range(2)] for i in range(2)]


def mat(x, y, m, w=150, title=None):
    out = ''
    if title:
        out += T(x + w / 2, y - 12, title, 16, 800, '#14213d', 'middle')
    out += (f'<path d="M{x + 10},{y} L{x},{y} L{x},{y + 80} L{x + 10},{y + 80}" fill="none" stroke="#334155" stroke-width="2.5"/>'
            f'<path d="M{x + w - 10},{y} L{x + w},{y} L{x + w},{y + 80} L{x + w - 10},{y + 80}" fill="none" stroke="#334155" stroke-width="2.5"/>')
    for i in range(2):
        for j in range(2):
            out += T(x + w * (0.3 + 0.4 * j), y + 30 + i * 36, m[i][j], 17, 600, '#14213d', 'middle')
    return out


s = Scene(68, 'Gates and circuits: reversible steps, then one irreversible look',
          'Five frames. 1, a gallery of gates: X swaps 0 and 1; Z flips the sign of the 1 part; H makes an even mix; CNOT flips a '
          'target qubit when the control is 1; a controlled-phase gate adds a phase when both are 1 — each with its matrix. 2, ideal '
          'gates are unitary, so they can be undone: H followed by H gives the identity, computed here as '
          f'[[{fmt(HH[0][0])}, {fmt(HH[0][1])}], [{fmt(HH[1][0])}, {fmt(HH[1][1])}]]. 3, a two-qubit circuit: H on the first qubit, '
          'a CNOT, then a Z, drawn on wires read left to right. 4, measurement is separate: it turns each qubit into one classical '
          'bit (double lines) and cannot be undone. 5, try it: demo H in Module 8 is a small statevector simulator.',
          sub='Every ideal gate can be run backwards. Measuring cannot.')
s.f(1)
s.raw(mat(80, 200, [['0', '1'], ['1', '0']], 150, 'X (bit flip)'))
s.raw(mat(290, 200, [['1', '0'], ['0', '−1']], 150, 'Z (phase flip)'))
s.raw(mat(500, 200, [['1/√2', '1/√2'], ['1/√2', '−1/√2']], 170, 'H (Hadamard)'))
s.raw(T(860, 188, 'CNOT', 16, 800, '#14213d', 'middle') + cnot_sym(860, 225, 290))
s.raw(lines(910, 240, ['flips the target', 'when the control is 1'], 15))
s.raw(T(1260, 188, 'Controlled phase', 16, 800, '#14213d', 'middle'))
s.raw(f'<path d="M1260,225 L1260,290" stroke="#334155" stroke-width="3"/><circle cx="1260" cy="225" r="9" fill="#334155"/><circle cx="1260" cy="290" r="9" fill="#334155"/>')
s.raw('<text x="1290" y="240" style="font-size:15px;font-weight:400;fill:#334155">adds phase e<tspan dy="-6" style="font-size:11px">iφ</tspan></text>'
      + T(1290, 264, 'when both are 1', 15, 400, '#334155'))
s.raw(callout(80, 330, 680, 90, 'A gate is a rule for amplitudes', 'Each one is a small matrix acting on the state.', 'blue', 1, 19, 16))
s.f(2)
s.raw(mat(900, 360, [['1/√2', '1/√2'], ['1/√2', '−1/√2']], 170) + T(1085, 410, '×', 26, 800, '#334155', 'middle'))
s.raw(mat(1100, 360, [['1/√2', '1/√2'], ['1/√2', '−1/√2']], 170) + T(1290, 410, '=', 26, 800, '#334155', 'middle'))
s.raw(mat(1310, 360, [[fmt(HH[0][0]), fmt(HH[0][1])], [fmt(HH[1][0]), fmt(HH[1][1])]], 150))
s.raw(T(1220, 480, 'H then H undoes itself: the identity (computed)', 15.5, 700, '#166534', 'middle'))
s.f(3)
s.raw(wire(150, 900, 600, '|0⟩') + wire(150, 900, 700, '|0⟩'))
s.raw(gate_box(260, 600, 'H') + cnot_sym(420, 600, 700) + gate_box(580, 600, 'Z', '#7c3aed'))
s.raw(T(500, 780, 'Read left to right: H, then CNOT, then Z', 15.5, 600, '#334155', 'middle'))
s.f(4)
s.raw(meter(760, 600) + meter(760, 700))
s.raw(f'<rect x="790" y="560" width="120" height="180" fill="#ffffff"/>')
s.raw(classical_wire(790, 980, 600) + classical_wire(790, 980, 700))
s.raw(T(1000, 607, 'bit', 16, 700, '#475569') + T(1000, 707, 'bit', 16, 700, '#475569'))
s.raw(callout(1080, 560, 460, 160, 'Measurement is separate', 'It gives one classical bit per qubit\n(double lines) and destroys the\nsuperposition. It cannot be undone.', 'amber', 4, 19, 16))
s.f(5)
s.raw(callout(80, 436, 680, 100, 'Try it yourself', 'Demo H in Module 8 runs these gates on a small simulator\nand shows every amplitude after every step.', 'green', 5, 19, 16))
scenes[68] = s.render('Ideal gates. Real gates are imperfect (Scene 70).')


# ── 69 Physical hardware ────────────────────────────────────────────
s = Scene(69, 'What a quantum computer physically is',
          'Five frames. 1, a dilution refrigerator drawn as its gold “chandelier” of stacked plates, from room temperature down to '
          'about 10–20 millikelvin at the bottom, where the chip sits. 2, a superconducting qubit: an aluminium loop interrupted by '
          'a Josephson junction, controlled by microwave pulses of a few gigahertz and read out through a resonator. 3, trapped '
          'ions: a row of charged atoms held by electric fields in a vacuum, controlled and read with lasers. 4, other approaches: '
          'neutral atoms held in beams of laser light, and photons in optical chips. 5, what is not inside: no water, no visible '
          'waves, no tiny whirlpools — “waves” in this lesson are mathematics about amplitudes.',
          sub='Cold metal circuits, or atoms held by light — not ripples in a tank.')
s.f(1)
s.raw(fridge(60, 175, 0.95))
s.raw(T(220, 812, 'Dilution refrigerator (schematic)', 15, 700, '#334155', 'middle'))
s.f(2)
s.raw(jj_chip(560, 190, 1.0))
s.raw(T(722, 226, 'Josephson junction', 13.5, 700, '#6d28d9'))
s.raw('<path d="M560,330 q20,-30 40,0 t40,0 t40,0" fill="none" stroke="#c2410c" stroke-width="3"/>')
s.raw(T(560, 436, 'microwave pulses (a few GHz) steer the qubit', 15, 600, '#9a3412'))
s.raw(callout(910, 250, 630, 160, 'Superconducting circuits', 'Aluminium loops lose all resistance when very cold.\nThe junction makes the energy levels uneven, so the\nlowest two act as 0 and 1. A resonator reads it out.', 'purple', 2, 19, 16))
s.f(3)
s.raw(ion_trap(560, 470))
for i in range(5):
    cx = 680 + i * 80
    s.raw(f'<path d="M{cx - 30},{512} L{cx},{565}" stroke="#ef4444" stroke-width="2.5" opacity="0.85"/>')
s.raw(T(840, 690, 'electrodes hold a row of ions; lasers set and read each one', 15, 600, '#334155', 'middle'))
s.raw(callout(1150, 440, 390, 190, 'Trapped ions', 'Charged atoms in a vacuum,\nheld by electric fields. Two\natomic energy levels are 0 and 1;\nlasers control and read them.', 'teal', 3, 19, 16))
s.f(4)
s.raw(callout(560, 720, 980, 96, 'Other approaches', 'Neutral atoms held in tightly focused laser beams (“tweezers”); photons travelling through optical chips.', 'slate', 4, 19, 16))
s.f(5)
s.raw(callout(910, 160, 630, 80, 'Not inside: water, waves or whirlpools', '“Waves” in this lesson are amplitudes — mathematics.', 'red', 5, 18, 15.5))
scenes[69] = s.render('Schematic, not to scale. Temperatures are typical stages, not one machine’s specification.')


# ── 70 Noise and error ──────────────────────────────────────────────
T1 = 100.0   # illustrative, microseconds
T2 = 70.0
ts = [i * 5 for i in range(0, 61)]
p1 = [math.exp(-t / T1) for t in ts]
coh = [math.exp(-t / T2) for t in ts]
eps_rows = [['error per gate', '10 gates', '100 gates', '1,000 gates']]
for eps in (0.01, 0.001):
    eps_rows.append([f'{eps:g}'] + [('<1 %' if (1 - eps) ** d < 0.01 else f'{(1 - eps) ** d * 100:.0f} %') for d in (10, 100, 1000)])
dist = 7
phys = 2 * dist * dist - 1


def curve(x, y, w, h, xs, ys, color):
    pts = ' '.join(f'{x + xi / xs[-1] * w:.1f},{y + h - yi * h:.1f}' for xi, yi in zip(xs, ys))
    return f'<polyline points="{pts}" fill="none" stroke="{color}" stroke-width="3.5"/>'


s = Scene(70, 'Noise: why qubits forget, and what error correction costs',
          f'Five frames. 1, relaxation: a qubit prepared in 1 decays towards 0; with an illustrative T1 of {T1:g} microseconds the '
          f'chance it is still 1 falls to {fmt(math.exp(-1))} after one T1. 2, dephasing: the relative phase that interference needs '
          f'blurs out on a timescale T2 (illustrative {T2:g} microseconds). 3, errors add up: with an error of 1 in 100 per gate, '
          f'a 100-gate circuit succeeds about {(0.99 ** 100) * 100:.0f} percent of the time; with 1 in 1,000, about '
          f'{(0.999 ** 100) * 100:.0f} percent; readout can also be wrong. 4, error correction combines many physical qubits into one '
          f'logical qubit; a distance-{dist} surface code uses about {phys} physical qubits per logical qubit in a common layout. '
          '5, the goal is fault tolerance: logical errors that fall as the code grows; Google reported this “below threshold” '
          'behaviour in 2024, a research result still far from the scale cryptography would need.',
          sub='Every qubit leaks. Error correction trades many noisy qubits for one reliable one.')
s.f(1)
s.raw(f'<rect x="80" y="180" width="440" height="230" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>')
s.raw(curve(80, 180, 440, 230, ts, p1, '#c2410c'))
s.raw(T(80, 172, f'P(still 1) vs time — illustrative T1 = {T1:g} µs', 15.5, 800, '#14213d'))
s.raw(T(84, 430, '0', 14, 600, '#475569') + T(300, 430, str(ts[-1] // 2), 14, 600, '#475569', 'middle') + T(520, 430, str(ts[-1]), 14, 600, '#475569', 'end') + T(520, 450, 'time (µs) →', 14, 600, '#475569', 'end'))
s.raw(callout(80, 460, 440, 110, 'T1: relaxation', 'Energy leaks to the surroundings;\na 1 slowly becomes a 0.', 'orange', 1, 19, 16))
s.f(2)
s.raw(f'<rect x="580" y="180" width="440" height="230" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>')
s.raw(curve(580, 180, 440, 230, ts, coh, '#7c3aed'))
s.raw(T(580, 172, f'Phase coherence vs time — illustrative T2 = {T2:g} µs', 15.5, 800, '#14213d'))
s.raw(callout(580, 460, 440, 110, 'T2: dephasing', 'The relative phase blurs, so\ninterference stops working.', 'purple', 2, 19, 16))
s.f(3)
s.raw(table(1080, 190, [130, 110, 110, 110], eps_rows, rowh=40, size=15))
s.raw(lines(1080, 340, ['Chance a circuit runs with no error,', 'if errors are independent (computed).', 'Readout adds its own errors.'], 15))
s.raw(callout(1080, 460, 460, 110, 'Errors add up', 'Deeper circuits fail more often,\neven with good gates.', 'red', 3, 19, 16))
s.f(4)
for i in range(13):
    for j in range(8):
        on = (i + j) % 2 == 0
        s.raw(f'<circle cx="{110 + i * 30}" cy="{640 + j * 22}" r="8" fill="{"#93c5fd" if on else "#cbd5e1"}"/>')
s.raw(f'<rect x="96" y="626" width="378" height="178" rx="12" fill="none" stroke="#14213d" stroke-width="3"/>')
s.raw(T(500, 650, f'Distance-{dist} surface code: about {phys} physical', 16, 800, '#14213d'))
s.raw(T(500, 676, 'qubits make ONE logical qubit (2d² − 1, computed)', 16, 800, '#14213d'))
s.raw(T(500, 706, 'Overheads for useful algorithms run to many', 15, 400, '#334155'))
s.raw(T(500, 728, 'thousands of physical qubits per logical one.', 15, 400, '#334155'))
s.f(5)
s.raw(callout(1000, 620, 540, 190, 'Fault tolerance', 'The goal: logical errors that fall as the code\ngrows. Google reported “below threshold”\nbehaviour in 2024 (research result). Scale for\ncryptography is still far beyond it.', 'green', 5, 19, 16))
scenes[70] = s.render('T1, T2 and error rates illustrative; the curves and percentages computed from them.')


# ── 71 Where quantum wins and doesn't ───────────────────────────────
rows71 = [['Problem', 'Known quantum help', 'How much'],
          ['Factoring, discrete logs', 'Shor (needs fault tolerance)', 'exponential'],
          ['Unstructured search', 'Grover', 'quadratic (√N)'],
          ['Simulating molecules, materials', 'Quantum simulation', 'problem-dependent'],
          ['NP-complete puzzles in general', 'none known to make them easy', 'no proof of big gains'],
          ['Email, video, spreadsheets', 'none', 'none']]
Ns = [10 ** k for k in range(1, 13)]
s = Scene(71, 'Where quantum helps, and where it does not',
          'Four frames. 1, a table of problems: factoring and discrete logarithms (Shor, exponential, but only on a fault-tolerant '
          'machine); unstructured search (Grover, quadratic); simulating molecules and materials (problem-dependent); NP-complete '
          'problems in general (no known way to make them easy); everyday computing (no help). 2, a chart of steps against problem '
          'size on logarithmic axes, comparing N with √N: a quadratic speedup grows, but slowly. 3, hybrid computing: an ordinary '
          'computer prepares and checks, a quantum processor runs one short subroutine, results return. 4, honest feasibility: error '
          'correction, data loading and slow quantum clock rates can cancel a speedup.',
          sub='A specialised tool for certain problem shapes, not a faster everything-computer.')
s.f(1)
s.raw(table(70, 170, [300, 300, 210], rows71, rowh=46, size=15.5))
s.raw(callout(70, 470, 810, 90, 'The pattern', 'Advantages come from structure that interference can exploit.', 'blue', 1, 19, 16))
s.f(2)
x0, y0, w, h = 960, 180, 560, 280
s.raw(f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>')
lx = [math.log10(n) for n in Ns]
s.raw(f'<polyline points="{" ".join(f"{x0 + (l - 1) / 11 * w:.1f},{y0 + h - (l / 12) * h:.1f}" for l in lx)}" fill="none" stroke="#64748b" stroke-width="3.5"/>')
s.raw(f'<polyline points="{" ".join(f"{x0 + (l - 1) / 11 * w:.1f},{y0 + h - (l / 2 / 12) * h:.1f}" for l in lx)}" fill="none" stroke="#7c3aed" stroke-width="3.5"/>')
s.raw(f'<path d="M{x0 + 20},{y0 + 26} L{x0 + 56},{y0 + 26}" stroke="#64748b" stroke-width="3.5"/>' + T(x0 + 66, y0 + 31, 'N steps (look one by one)', 15, 700, '#475569'))
s.raw(f'<path d="M{x0 + 20},{y0 + 54} L{x0 + 56},{y0 + 54}" stroke="#7c3aed" stroke-width="3.5"/>' + T(x0 + 66, y0 + 59, '√N steps (Grover)', 15, 700, '#6d28d9'))
s.raw(badge(x0 + 14, y0 - 22, 2, 'purple', 15) + T(x0 + 38, y0 - 16, 'Steps vs problem size N (log scales, computed)', 15.5, 800, '#14213d'))
s.raw(T(x0, y0 + h + 24, 'N = 10', 14, 600, '#475569') + T(x0 + w, y0 + h + 24, 'N = 10¹²', 14, 600, '#475569', 'end'))
s.f(3)
s.raw(server(120, 610, 0.9, 'ordinary computer'))
s.raw(jj_chip(560, 610, 0.62))
s.raw(T(653, 770, 'quantum processor', 15, 700, '#334155', 'middle'))
s.raw('<path d="M250,650 C380,600 450,600 535,636" fill="none" stroke="#334155" stroke-width="3"/><path d="M528,624 L548,642 L522,648 Z" fill="#334155"/>'
      '<path d="M545,720 C450,760 380,760 262,724" fill="none" stroke="#334155" stroke-width="3"/><path d="M270,712 L250,722 L270,736 Z" fill="#334155"/>')
s.raw(T(400, 600, 'prepare a short circuit', 14.5, 600, '#334155', 'middle') + T(400, 790, 'results back, checked', 14.5, 600, '#334155', 'middle') + badge(96, 600, 3, 'slate', 15))
s.f(4)
s.raw(callout(960, 560, 580, 210, 'Honest feasibility', 'Error-correction overhead, loading data into\nqubits and slow gate rates can erase a speedup.\nA quadratic gain needs very large problems to\npay off. Claims of advantage are checked one\nproblem at a time.', 'amber', 4, 19, 16))
scenes[71] = s.render('Advantage classes as established in the literature; the chart is computed, not measured.')


# ── 72 Quantum and security ─────────────────────────────────────────
sym_rows = [['Primitive', 'Classical generic attack', 'Idealised Grover', 'Usual response']]
for name, bits in (('AES-128 key', 128), ('AES-256 key', 256)):
    sym_rows.append([name, f'2^{bits}', f'2^{bits // 2}', 'use 256-bit for long-lived data' if bits == 128 else 'wide margin'])
sym_rows.append(['SHA-256 preimage', '2^256', '2^128', 'margin remains'])
s = Scene(72, 'Quantum and security: which locks, and when',
          'Five frames. 1, public-key cryptography (RSA and elliptic curves, as used for key exchange and signatures): Shor’s '
          'algorithm would break it on a large fault-tolerant quantum computer, which is not publicly known to exist. 2, symmetric '
          'keys and hashes: an idealised Grover search halves the exponent — AES-128 from 2^128 to 2^64 steps, AES-256 to 2^128, '
          'SHA-256 preimages to 2^128 — and it parallelises poorly, so the usual response is longer keys, not new ciphers. '
          '3, published resource estimates for breaking RSA-2048 have fallen: about 20 million noisy qubits in 2019, under a million '
          'in 2025, each under stated assumptions. 4, harvest now, decrypt later matters only when long-lived secret data is '
          'encrypted with quantum-vulnerable keys and someone captures and keeps it. 5, NIST published post-quantum standards in '
          'August 2024 — ML-KEM, ML-DSA and SLH-DSA (FIPS 203, 204, 205) — which run on ordinary chips; Module 10 covers migration.',
          sub='Some locks would fail, some only weaken, and the replacements already exist.')
s.f(1)
s.raw(callout(70, 165, 720, 175, 'Public keys: RSA and elliptic curves', 'Key exchange and signatures rest on factoring or\ndiscrete logs. Shor would solve them — IF a large,\nfault-tolerant quantum computer exists. None is\npublicly known to exist today.', 'purple', 1, 20, 16))
s.raw(lock(700, 190, 1.0, '#7c3aed'))
s.f(2)
s.raw(badge(846, 180, 2, 'blue', 18) + T(874, 187, 'Symmetric keys and hashes', 19, 800, '#14213d'))
s.raw(table(830, 210, [160, 180, 150, 220], sym_rows, rowh=36, size=14))
s.raw(lines(830, 378, ['Grover gives a square-root speedup in an idealised count, and', 'splitting it across k machines saves only √k. Hashes: collision', 'search gains little in practice.'], 15))
s.f(3)
s.raw(f'<rect x="70" y="380" width="720" height="210" rx="14" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(badge(100, 412, 3, 'teal', 18) + T(130, 420, 'Published estimates for RSA-2048 (research)', 19, 800, '#14213d'))
est = [(2019, 20_000_000, 'Gidney & Ekerå: ~20 million noisy qubits, ~8 hours'), (2025, 1_000_000, 'Gidney: under 1 million noisy qubits, under a week')]
for i, (yr, q, label) in enumerate(est):
    bw = math.log10(q) / math.log10(2e7) * 420
    yy = 450 + i * 60
    s.raw(f'<rect x="170" y="{yy}" width="{bw:.0f}" height="30" rx="6" fill="#5eead4"/>' + T(110, yy + 22, str(yr), 16, 800, '#0f766e'))
    s.raw(T(180, yy + 52, label, 14, 400, '#334155'))
s.raw(T(110, 578, 'Bar length: log scale. Estimates change with new methods and hardware.', 13.5, 400, '#475569', italic=True))
s.f(4)
s.raw(callout(830, 470, 710, 150, 'Harvest now, decrypt later', 'Matters only when all three hold: the data must stay\nsecret for years; it is protected by quantum-vulnerable\nkey exchange; and someone captures and keeps it.', 'amber', 4, 19, 16))
s.f(5)
s.raw(callout(70, 640, 1470, 150, 'Replacements exist, on ordinary chips', 'NIST, August 2024: ML-KEM (FIPS 203) for key establishment; ML-DSA (FIPS 204) and SLH-DSA (FIPS 205) for signatures.\nPost-quantum cryptography is classical cryptography designed to resist known quantum attacks.\nWhat migrating cards, trackers and accounts involves is Module 10.', 'green', 5, 20, 16))
scenes[72] = s.render('Nothing here is broken today. Grover figures idealised; estimates dated.')
