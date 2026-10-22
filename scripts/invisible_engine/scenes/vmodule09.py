"""Module 9 phone-vertical scenes (65–72): the same scenes as module09.py, laid out for a
phone (VScene: 720 wide, body drawn in its own coordinates below the header).
Same title, desc, frames and words as the landscape scene; invisible-engine/tests/check.py
compares them. Change a scene's words in both files.

Every quantum number comes from module09.py's own computation (imported below): nothing
here is typed. Title, desc, subtitle and note are read from the landscape SVG, so they
cannot drift.
"""
import math
from xml.dom import minidom

from .svgkit import VScene, wrap
from .art import *
from . import module09 as L
from .module09 import fmt, gate_box, cnot_sym, meter, classical_wire, jj_chip, curve

scenes = {}

INK, BODY = '#14213d', '#334155'


def meta(n):
    """Title, desc, subtitle and render note of landscape scene n, read from its SVG."""
    root = minidom.parseString(L.scenes[n]).documentElement
    out = {'title': root.getElementsByTagName('title')[0].firstChild.data.split(': ', 1)[1],
           'desc': root.getElementsByTagName('desc')[0].firstChild.data, 'sub': None, 'note': None}
    for t in root.getElementsByTagName('text'):
        if 'font-size:20px;fill:#475569' in t.getAttribute('style'):
            out['sub'] = t.firstChild.data
        if t.getAttribute('class') == 'note' and t.getAttribute('text-anchor') == 'end':
            out['note'] = t.firstChild.data
    return out


def vscene(n):
    m = meta(n)
    return VScene(n, m['title'], m['desc'], sub=m['sub'], note=m['note'], h=1736)


def finish(s, bottom):
    """The canvas ends just below the last drawing (the legend follows)."""
    s.bh = bottom + 16
    return s.render()


def wr(text, n):
    return '\n'.join(wrap(text, n))


def vcallout(x, y, w, title, paras, color='blue', n=None, tsize=26, bsize=21, cpl=None):
    """A callout whose body is wrapped here. Returns (svg, height)."""
    c, light, border = STEP[color]
    cpl = cpl or int((w - 36) / 10.8)
    lh = round(bsize * 1.3)
    blocks = [wrap(p, cpl) for p in ([paras] if isinstance(paras, str) else paras)]
    nl = sum(len(b) for b in blocks)
    h = 72 + (nl - 1) * lh + 12 * (len(blocks) - 1) + 28
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{light}" stroke="{border}" stroke-width="2"/>'
    tx = x + 16
    if n is not None:
        out += badge(x + 28, y + 30, n, color, 18)
        tx = x + 56
    out += T(tx, y + 38, title, tsize, 800, c)
    yy = y + 72
    for b in blocks:
        out += T(x + 16, yy, '\n'.join(b), bsize, 400, BODY)
        yy += len(b) * lh + 12
    return out, h


def vbars(x, y, w, h, labels, amps, title=None, signed=True, color_pos='#2563eb', color_neg='#dc2626', unit=1.0, vs=20, ls=20):
    """module09.amp_bars at the phone type scale."""
    out = ''
    if title:
        out += T(x, y - 20, title, 20, 800, INK)
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
        ty = top - 8 if v >= 0 else base + bh + 22
        out += T(cx, ty, fmt(v), vs, 700, col if abs(v) > 1e-12 else '#64748b', 'middle')
        out += T(cx, y + h + 26, lab, ls, 600, BODY, 'middle', mono=True)
    return out


def vtable(x, y, colw, rows, size=20, head_fill='#eef2ff', mono_cols=(), wrapw=None, pad=14):
    """A table whose cells may wrap (wrapw: characters per column). Returns (svg, height)."""
    lh = round(size * 1.3)
    out, yy = '', y
    W = sum(colw)
    for r, row in enumerate(rows):
        cells = [wrap(str(c), wrapw[i]) if wrapw else [str(c)] for i, c in enumerate(row)]
        rh = max(len(c) for c in cells) * lh + pad
        fill = head_fill if r == 0 else ('#ffffff' if r % 2 else '#f8fafc')
        out += f'<rect x="{x}" y="{yy}" width="{W}" height="{rh}" fill="{fill}" stroke="#e2e8f0" stroke-width="1"/>'
        cx = x
        for c, (cell, cw) in enumerate(zip(cells, colw)):
            first = yy + rh / 2 - (len(cell) - 1) * lh / 2 + size * 0.36
            out += T(cx + cw / 2, round(first), '\n'.join(cell), size, 800 if r == 0 else 500, INK, 'middle',
                     mono=(c in mono_cols and r > 0))
            cx += cw
        yy += rh
    return out, yy - y


def vwire(x1, x2, y, label=None):
    out = f'<path d="M{x1},{y} L{x2},{y}" stroke="#334155" stroke-width="2.5"/>'
    if label:
        out += T(x1 - 12, y + 8, label, 22, 700, INK, 'end', mono=True)
    return out


def vmat(x, y, m, w=150, title=None, size=21):
    out = ''
    if title:
        out += T(x + w / 2, y - 14, title, 20, 800, INK, 'middle')
    out += (f'<path d="M{x + 10},{y} L{x},{y} L{x},{y + 90} L{x + 10},{y + 90}" fill="none" stroke="#334155" stroke-width="2.5"/>'
            f'<path d="M{x + w - 10},{y} L{x + w},{y} L{x + w},{y + 90} L{x + w - 10},{y + 90}" fill="none" stroke="#334155" stroke-width="2.5"/>')
    for i in range(2):
        for j in range(2):
            out += T(x + w * (0.3 + 0.4 * j), y + 35 + i * 38, m[i][j], size, 600, INK, 'middle')
    return out


# ── 65 Entanglement ─────────────────────────────────────────────────
s = vscene(65)
s.f(1)
s.raw(vwire(110, 680, 74, '|0⟩') + vwire(110, 680, 154, '|0⟩'))
s.raw(gate_box(200, 74, 'H'))
s.raw(cnot_sym(470, 74, 154))
s.raw(T(200, 26, 'Hadamard on q0', 20, 600, '#1d4ed8', 'middle'))
s.raw(T(470, 26, 'CNOT: q0 controls q1', 20, 600, BODY, 'middle'))
s.raw(T(40, 214, 'Left to right: start, then gates.\nWires carry qubits, not current.', 21, 400, BODY))
svg, h = vcallout(40, 262, 640, 'The recipe', 'H puts the first qubit in an even mix; CNOT flips the second only where the first is 1.', 'blue', 1)
s.raw(svg)
y = 262 + h + 50
s.f(2)
s.raw(vbars(40, y, 200, 110, L.labs2, L.after_h, 'After H', True))
s.raw(T(140, y + 176, '(|00⟩ + |10⟩)/√2', 20, 700, BODY, 'middle'))
s.raw(T(140, y + 202, 'not yet linked', 20, 400, '#475569', 'middle'))
s.f(3)
s.raw(vbars(260, y, 200, 110, L.labs2, L.bell, 'After CNOT', True))
s.raw(vbars(480, y, 200, 110, L.labs2, L.P_bell, 'Probabilities', False, '#16a34a'))
s.raw(T(470, y + 176, '(|00⟩ + |11⟩)/√2 — the Bell state', 20, 800, INK, 'middle'))
s.raw(T(470, y + 202, 'probability = amplitude²', 20, 400, '#475569', 'middle'))
y += 232
s.f(4)
s.raw(f'<rect x="40" y="{y}" width="640" height="262" rx="14" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(badge(68, y + 34, 4, 'slate', 18) + T(96, y + 41, 'Ten simulated runs (prepare, then measure both)', 20, 800, INK))
for i, b in enumerate(L.shots):
    cx = 60 + (i % 5) * 122
    cy = y + 62 + (i // 5) * 66
    s.raw(f'<rect x="{cx}" y="{cy}" width="104" height="50" rx="8" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>'
          + T(cx + 52, cy + 34, b, 24, 800, '#1d4ed8', 'middle', mono=True))
s.raw(T(60, y + 212, f'The two qubits agree in {L.same} of {len(L.shots)} runs.', 21, 700, BODY))
s.raw(T(60, y + 242, f'q0 alone: {L.alice0} zeros, {len(L.shots) - L.alice0} ones — it looks random.', 21, 400, BODY))
y += 276
s.f(5)
svg, h = vcallout(40, y, 640, 'No faster-than-light messages',
                  'Whatever the far side does, the near side’s own results stay 50/50: P(q0 = 0) = '
                  + fmt(L.P_bell[0] + L.P_bell[1]) + '. The agreement only shows up when both lists are brought together '
                  'over an ordinary channel, at ordinary speed (the no-signalling theorem).', 'purple', 5)
s.raw(svg)
scenes[65] = finish(s, y + h)


# ── 66 Grover with four drawers ─────────────────────────────────────
def vdrawer(x, y, w, h, label, marked=False):
    col = '#b45309' if marked else '#64748b'
    out = (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="#fdf6e3" stroke="{col}" stroke-width="3"/>'
           f'<rect x="{x + w / 2 - 22:.0f}" y="{y + h / 2 - 6:.0f}" width="44" height="12" rx="6" fill="{col}"/>')
    out += T(x + w / 2, y + h + 28, label, 21, 700, BODY, 'middle', mono=True)
    if marked:
        out += f'<path d="M{x + w - 26},{y + 10} l9,9 l16,-18" fill="none" stroke="#b45309" stroke-width="4" stroke-linecap="round"/>'
    return out


PW, PH = 312, 364


def vstage(i, n, color, title, amps, probs=None, extra=''):
    px, py = 40 + (i % 2) * (PW + 16), 184 + (i // 2) * (PH + 14)
    out = f'<rect x="{px}" y="{py}" width="{PW}" height="{PH}" rx="14" fill="{STEP[color][1]}" stroke="{STEP[color][2]}" stroke-width="2"/>'
    out += badge(px + 28, py + 30, n, color, 18) + T(px + 54, py + 38, title, 20, 800, STEP[color][0])
    out += vbars(px + 16, py + 96, PW - 32, 90, L.labs, amps, 'Amplitudes', True)
    if probs is not None:
        out += vbars(px + 16, py + 262, PW - 32, 50, L.labs, probs, 'Probabilities', False, '#16a34a')
    return out + extra(px, py) if callable(extra) else out


s = vscene(66)
s.f(1)
for i in range(L.Ng):
    s.raw(vdrawer(80 + i * 150, 0, 110, 62, L.labs[i], i == L.marked))
s.raw(T(40, 136, f'One drawer ({L.labs[L.marked]}) holds the prize.\nThe register starts even.', 21, 600, BODY))
s.raw(vstage(0, 1, 'blue', 'Start: all equal', L.g0, [a * a for a in L.g0]))
s.f(2)
s.raw(vstage(1, 2, 'red', 'Oracle flips the sign', L.g1, [a * a for a in L.g1]))
s.f(3)


def reflect(px, py):
    ym = py + 96 + 45 - L.mean1 * 45
    out = (f'<path d="M{px + 16},{ym:.1f} L{px + PW - 16},{ym:.1f}" stroke="#7c3aed" stroke-width="3" stroke-dasharray="9 6"/>'
           + T(px + 16, py + 248, 'each a → 2×mean − a', 20, 700, '#6d28d9'))
    out += ''.join(T(px + 16, py + 276 + k * 25, f'{L.labs[k]}:  2×{fmt(L.mean1)} − ({fmt(L.g1[k])}) = {fmt(L.g2[k])}',
                     19.5, 600, '#4c1d95', mono=True) for k in range(L.Ng))
    return out


s.raw(vstage(2, 3, 'purple', f'Mean = {fmt(L.mean1)}; reflect', L.g1, None, reflect))
s.f(4)
s.raw(vstage(3, 4, 'green', f'Prize found: P = {fmt(L.P2[L.marked])}', L.g2, L.P2))
s.f(5)
y = 184 + 2 * PH + 14 + 18
svg, h = vtable(40, y, [120, 190, 140, 190], L.rows66, size=20, wrapw=[10, 17, 12, 13], pad=12)
s.raw(svg)
scenes[66] = finish(s, y + h)


# ── 67 Shor, intuitively ────────────────────────────────────────────
s = vscene(67)
s.f(1)
s.raw(f'<rect x="40" y="0" width="640" height="150" rx="18" fill="{STEP["slate"][1]}" stroke="{STEP["slate"][2]}" stroke-width="2"/>')
s.raw(badge(70, 36, 1, 'slate', 20) + T(102, 45, 'The task', 26, 800, INK) + T(240, 45, f'Factor N = {L.Nn}', 21, 600, STEP['slate'][0]))
s.raw(T(64, 84, f'Pick a = {L.a} (no factor shared with {L.Nn}).\nLook at the powers of a, mod N.\nTheir repeat length r is the clue.', 21, 400, BODY))
s.f(2)
s.raw(badge(58, 178, 2, 'blue', 18) + T(86, 185, f'Powers of {L.a}, mod {L.Nn}', 21, 800, INK))
t1, th = vtable(40, 198, [130] + [85] * 6, [['x'] + [str(x) for x in range(6)], [f'{L.a}ˣ mod {L.Nn}'] + [str(v) for v in L.fx[:6]]], size=20, pad=8)
t2, _ = vtable(40, 206 + th, [130] + [85] * 6, [['x'] + [str(x) for x in range(6, 12)], [f'{L.a}ˣ mod {L.Nn}'] + [str(v) for v in L.fx[6:]]], size=20, pad=8)
s.raw(t1 + t2)
yb = 206 + 2 * th + 112
for x, v in enumerate(L.fx):
    bx = 40 + x * 31
    bh = v / 15 * 90
    s.raw(f'<rect x="{bx}" y="{yb - bh:.0f}" width="23" height="{bh:.0f}" rx="3" fill="{"#7c3aed" if v == 1 else "#93c5fd"}"/>')
    s.raw(T(bx + 11.5, yb + 24, str(x), 20, 600, '#475569', 'middle'))
s.raw(T(430, yb - 84, wr(f'The pattern repeats every r = {L.r}', 19), 21, 800, '#7c3aed'))
s.raw(T(430, yb - 22, wr('purple bars: value 1 (where it restarts)', 20), 20, 400, '#475569'))
y = yb + 58
s.f(3)
s.raw(badge(58, y, 3, 'purple', 18))
s.raw(T(86, y + 7, 'After the quantum Fourier transform: P(y)', 21, 800, INK))
s.raw(vbars(40, y + 46, 640, 84, [str(v) for v in range(L.Q)], L.amp_y, None, False, '#7c3aed', unit=0.3))
s.raw(T(360, y + 190, f'Only y = {", ".join(map(str, L.peaks))}: multiples of 16 / r', 21, 700, '#5b21b6', 'middle'))
y += 220
s.f(4)
s.raw(badge(58, y, 4, 'slate', 18) + T(86, y + 7, 'Ordinary arithmetic', 21, 800, INK))
tb, th = vtable(40, y + 24, [56, 84, 100, 130], L.rows67, size=20, pad=8)
s.raw(tb)
SUP = str.maketrans('0123456789', '⁰¹²³⁴⁵⁶⁷⁸⁹')
s.raw(T(430, y + 64, f'With r = {L.r}:  {L.a}{str(L.r // 2).translate(SUP)} = {L.half}\n'
        f'gcd({L.half} − 1, {L.Nn}) = {L.f1};\ngcd({L.half} + 1, {L.Nn}) = {L.f2}\n{L.Nn} = {L.f1} × {L.f2}', 20, 700, INK))
y += 24 + th + 14
s.f(5)
svg, h = vcallout(40, y, 640, 'What it is not',
                  ['It does not try every factor at once. Interference concentrates the answer; one measurement gives one '
                   'sample; useless samples mean another run.',
                   'Real RSA keys need a large fault-tolerant machine. None is publicly known to exist.'], 'amber', 5)
s.raw(svg)
scenes[67] = finish(s, y + h)


# ── 68 Gates and circuits ───────────────────────────────────────────
s = vscene(68)
s.f(1)
s.raw(vmat(40, 34, [['0', '1'], ['1', '0']], 140, 'X (bit flip)'))
s.raw(vmat(225, 34, [['1', '0'], ['0', '−1']], 150, 'Z (phase flip)'))
s.raw(vmat(440, 34, [['1/√2', '1/√2'], ['1/√2', '−1/√2']], 220, 'H (Hadamard)'))
s.raw(T(70, 182, 'CNOT', 20, 800, INK, 'middle') + cnot_sym(70, 214, 280))
s.raw(T(110, 236, 'flips the target\nwhen the control is 1', 21, 400, BODY))
s.raw(T(400, 182, 'Controlled phase', 20, 800, INK))
s.raw('<path d="M410,214 L410,280" stroke="#334155" stroke-width="3"/><circle cx="410" cy="214" r="9" fill="#334155"/><circle cx="410" cy="280" r="9" fill="#334155"/>')
s.raw('<text x="440" y="236" style="font-size:21px;font-weight:400;fill:#334155">adds phase e<tspan dy="-8" style="font-size:20px">iφ</tspan></text>'
      + T(440, 263, 'when both are 1', 21, 400, BODY))
svg, h = vcallout(40, 318, 640, 'A gate is a rule for amplitudes', 'Each one is a small matrix acting on the state.', 'blue', 1)
s.raw(svg)
y = 318 + h + 24
s.f(2)
HH = L.HH
s.raw(vmat(40, y, [['1/√2', '1/√2'], ['1/√2', '−1/√2']], 190) + T(255, y + 55, '×', 30, 800, BODY, 'middle'))
s.raw(vmat(280, y, [['1/√2', '1/√2'], ['1/√2', '−1/√2']], 190) + T(495, y + 55, '=', 30, 800, BODY, 'middle'))
s.raw(vmat(520, y, [[fmt(HH[0][0]), fmt(HH[0][1])], [fmt(HH[1][0]), fmt(HH[1][1])]], 160))
s.raw(T(360, y + 130, 'H then H undoes itself: the identity (computed)', 21, 700, '#166534', 'middle'))
y += 180
s.f(3)
w1, w2 = y + 40, y + 130
s.raw(vwire(100, 600, w1, '|0⟩') + vwire(100, 600, w2, '|0⟩'))
s.raw(gate_box(170, w1, 'H') + cnot_sym(270, w1, w2) + gate_box(370, w1, 'Z', '#7c3aed'))
s.raw(T(360, w2 + 66, 'Read left to right: H, then CNOT, then Z', 21, 600, BODY, 'middle'))
s.f(4)
s.raw(meter(470, w1) + meter(470, w2))
s.raw(f'<rect x="500" y="{w1 - 40}" width="110" height="{w2 - w1 + 80}" fill="#ffffff"/>')
s.raw(classical_wire(500, 600, w1) + classical_wire(500, 600, w2))
s.raw(T(612, w1 + 8, 'bit', 21, 700, '#475569') + T(612, w2 + 8, 'bit', 21, 700, '#475569'))
y = w2 + 96
svg, h = vcallout(40, y, 640, 'Measurement is separate',
                  'It gives one classical bit per qubit (double lines) and destroys the superposition. It cannot be undone.', 'amber', 4)
s.raw(svg)
y += h + 14
s.f(5)
svg, h = vcallout(40, y, 640, 'Try it yourself',
                  'Demo H in Module 8 runs these gates on a small simulator and shows every amplitude after every step.', 'green', 5)
s.raw(svg)
scenes[68] = finish(s, y + h)


# ── 69 Physical hardware ────────────────────────────────────────────
def vfridge(x, y, s=1.0):
    """module09.fridge with phone-sized labels."""
    temps = ['room temperature', '~50 K', '~4 K', '~1 K', '~100 mK', '~10–20 mK']
    out = ''
    for i, t in enumerate(temps):
        yy = y + i * 78 * s
        w = (330 - i * 26) * s
        cx = x + 170 * s
        out += f'<rect x="{cx - w / 2:.0f}" y="{yy:.0f}" width="{w:.0f}" height="{16 * s:.0f}" rx="5" fill="#d4a017" stroke="#92400e" stroke-width="2"/>'
        out += T(cx + w / 2 + 12, yy + 15 * s, t, 20, 600, BODY)
        if i < len(temps) - 1:
            for dx in (-0.32, 0, 0.32):
                rx = cx + dx * w * 0.9
                out += f'<path d="M{rx:.0f},{yy + 16 * s:.0f} L{rx:.0f},{yy + 78 * s:.0f}" stroke="#b7791f" stroke-width="{4 * s:.1f}"/>'
    cy = y + 5 * 78 * s + 30 * s
    out += f'<rect x="{x + 140 * s:.0f}" y="{cy:.0f}" width="{60 * s:.0f}" height="{30 * s:.0f}" rx="4" fill="#334155"/>'
    return out


def vion_trap(x, y, n=5, gap=100):
    out = (f'<rect x="{x}" y="{y}" width="560" height="28" rx="6" fill="#94a3b8"/>'
           f'<rect x="{x}" y="{y + 28 + gap}" width="560" height="28" rx="6" fill="#94a3b8"/>')
    for i in range(n):
        out += f'<circle cx="{x + 120 + i * 80}" cy="{y + 28 + gap / 2:.0f}" r="15" fill="#0ea5e9" stroke="#075985" stroke-width="2"/>'
    return out


s = vscene(69)
s.f(1)
s.raw(vfridge(36, 6, 0.75))
s.raw(T(40, 372, 'Dilution refrigerator (schematic)', 20, 700, BODY))
s.f(2)
s.raw(jj_chip(496, 70, 0.6))
s.raw(T(586, 26, 'Josephson\njunction', 20, 700, '#6d28d9', 'middle'))
s.raw('<path d="M500,236 q15,-22 30,0 t30,0 t30,0 t30,0 t30,0" fill="none" stroke="#c2410c" stroke-width="3"/>')
s.raw(T(496, 280, wr('microwave pulses (a few GHz) steer the qubit', 17), 20, 600, '#9a3412'))
y = 400
svg, h = vcallout(40, y, 640, 'Superconducting circuits',
                  'Aluminium loops lose all resistance when very cold. The junction makes the energy levels uneven, so the '
                  'lowest two act as 0 and 1. A resonator reads it out.', 'purple', 2)
s.raw(svg)
y += h + 24
s.f(3)
s.raw(vion_trap(80, y, gap=70))
for i in range(5):
    cx = 200 + i * 80
    s.raw(f'<path d="M{cx - 30},{y + 32} L{cx},{y + 63}" stroke="#ef4444" stroke-width="2.5" opacity="0.85"/>')
s.raw(T(360, y + 158, 'electrodes hold a row of ions;\nlasers set and read each one', 20, 600, BODY, 'middle'))
y += 200
svg, h = vcallout(40, y, 640, 'Trapped ions',
                  'Charged atoms in a vacuum, held by electric fields. Two atomic energy levels are 0 and 1; lasers control '
                  'and read them.', 'teal', 3)
s.raw(svg)
y += h + 12
s.f(4)
svg, h = vcallout(40, y, 640, 'Other approaches',
                  'Neutral atoms held in tightly focused laser beams (“tweezers”); photons travelling through optical chips.', 'slate', 4)
s.raw(svg)
y += h + 12
s.f(5)
svg, h = vcallout(40, y, 640, 'Not inside: water, waves or whirlpools', '“Waves” in this lesson are amplitudes — mathematics.', 'red', 5, tsize=24)
s.raw(svg)
scenes[69] = finish(s, y + h)


# ── 70 Noise and error ──────────────────────────────────────────────
s = vscene(70)
PWD, PHT = 300, 115
s.f(1)
s.raw(T(40, 20, wr(f'P(still 1) vs time — illustrative T1 = {L.T1:g} µs', 24), 20, 800, INK))
s.raw(f'<rect x="40" y="62" width="{PWD}" height="{PHT}" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>')
s.raw(curve(40, 62, PWD, PHT, L.ts, L.p1, '#c2410c'))
s.raw(T(44, 62 + PHT + 26, '0', 20, 600, '#475569') + T(40 + PWD / 2, 62 + PHT + 26, str(L.ts[-1] // 2), 20, 600, '#475569', 'middle')
      + T(40 + PWD, 62 + PHT + 26, str(L.ts[-1]), 20, 600, '#475569', 'end') + T(40 + PWD, 62 + PHT + 52, 'time (µs) →', 20, 600, '#475569', 'end'))
y = 62 + PHT + 72
svg, h1 = vcallout(40, y, 312, 'T1: relaxation', 'Energy leaks to the surroundings; a 1 slowly becomes a 0.', 'orange', 1)
s.raw(svg)
s.f(2)
s.raw(T(380, 20, wr(f'Phase coherence vs time — illustrative T2 = {L.T2:g} µs', 25), 20, 800, INK))
s.raw(f'<rect x="380" y="62" width="{PWD}" height="{PHT}" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>')
s.raw(curve(380, 62, PWD, PHT, L.ts, L.coh, '#7c3aed'))
svg, h2 = vcallout(368, y, 312, 'T2: dephasing', 'The relative phase blurs, so interference stops working.', 'purple', 2)
s.raw(svg)
y += max(h1, h2) + 16
s.f(3)
tb, th = vtable(40, y, [190, 140, 150, 160], L.eps_rows, size=20, pad=12)
s.raw(tb)
s.raw(T(40, y + th + 32, 'Chance a circuit runs with no error,\nif errors are independent (computed).\nReadout adds its own errors.', 21, 400, BODY))
y += th + 104
svg, h = vcallout(40, y, 640, 'Errors add up', 'Deeper circuits fail more often, even with good gates.', 'red', 3)
s.raw(svg)
y += h + 22
s.f(4)
for i in range(13):
    for j in range(8):
        on = (i + j) % 2 == 0
        s.raw(f'<circle cx="{62 + i * 22}" cy="{y + 18 + j * 16}" r="6.5" fill="{"#93c5fd" if on else "#cbd5e1"}"/>')
s.raw(f'<rect x="46" y="{y + 4}" width="296" height="140" rx="12" fill="none" stroke="#14213d" stroke-width="3"/>')
s.raw(T(362, y + 30, wr(f'Distance-{L.dist} surface code: about {L.phys} physical qubits make ONE logical qubit (2d² − 1, computed)', 24),
        21, 800, INK))
s.raw(T(40, y + 174, 'Overheads for useful algorithms run to many thousands\nof physical qubits per logical one.', 21, 400, BODY))
y += 222
s.f(5)
svg, h = vcallout(40, y, 640, 'Fault tolerance',
                  'The goal: logical errors that fall as the code grows. Google reported “below threshold” behaviour in 2024 '
                  '(research result). Scale for cryptography is still far beyond it.', 'green', 5)
s.raw(svg)
scenes[70] = finish(s, y + h)


# ── 71 Where quantum wins and doesn't ───────────────────────────────
s = vscene(71)
s.f(1)
tb, th = vtable(40, 0, [220, 220, 200], L.rows71, size=20, wrapw=[20, 19, 17], pad=12)
s.raw(tb)
y = th + 14
svg, h = vcallout(40, y, 640, 'The pattern', 'Advantages come from structure that interference can exploit.', 'blue', 1)
s.raw(svg)
y += h + 30
s.f(2)
x0, w, hh = 40, 640, 180
y0 = y + 26
s.raw(badge(58, y, 2, 'purple', 15) + T(82, y + 7, 'Steps vs problem size N (log scales, computed)', 21, 800, INK))
s.raw(f'<rect x="{x0}" y="{y0}" width="{w}" height="{hh}" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>')
lx = [math.log10(n) for n in L.Ns]
s.raw(f'<polyline points="{" ".join(f"{x0 + (l - 1) / 11 * w:.1f},{y0 + hh - (l / 12) * hh:.1f}" for l in lx)}" fill="none" stroke="#64748b" stroke-width="3.5"/>')
s.raw(f'<polyline points="{" ".join(f"{x0 + (l - 1) / 11 * w:.1f},{y0 + hh - (l / 2 / 12) * hh:.1f}" for l in lx)}" fill="none" stroke="#7c3aed" stroke-width="3.5"/>')
s.raw(f'<path d="M{x0 + 20},{y0 + 28} L{x0 + 56},{y0 + 28}" stroke="#64748b" stroke-width="3.5"/>' + T(x0 + 66, y0 + 35, 'N steps (look one by one)', 20, 700, '#475569'))
s.raw(f'<path d="M{x0 + 20},{y0 + 58} L{x0 + 56},{y0 + 58}" stroke="#7c3aed" stroke-width="3.5"/>' + T(x0 + 66, y0 + 65, '√N steps (Grover)', 20, 700, '#6d28d9'))
s.raw(T(x0, y0 + hh + 28, 'N = 10', 20, 600, '#475569') + T(x0 + w, y0 + hh + 28, 'N = 10¹²', 20, 600, '#475569', 'end'))
y = y0 + hh + 66
s.f(3)
s.raw(server(70, y + 36, 0.85) + T(121, y + 212, 'ordinary computer', 20, 700, BODY, 'middle'))
s.raw(jj_chip(470, y + 50, 0.62))
s.raw(T(563, y + 212, 'quantum processor', 20, 700, BODY, 'middle'))
s.raw(f'<path d="M184,{y + 60} C300,{y + 10} 380,{y + 10} 455,{y + 50}" fill="none" stroke="#334155" stroke-width="3"/>'
      f'<path d="M447,{y + 38} L467,{y + 56} L441,{y + 62} Z" fill="#334155"/>'
      f'<path d="M465,{y + 160} C380,{y + 200} 300,{y + 200} 196,{y + 160}" fill="none" stroke="#334155" stroke-width="3"/>'
      f'<path d="M204,{y + 148} L184,{y + 158} L204,{y + 172} Z" fill="#334155"/>')
s.raw(T(320, y + 4, 'prepare a short circuit', 20, 600, BODY, 'middle') + T(340, y + 214, 'results back, checked', 20, 600, BODY, 'middle')
      + badge(52, y + 2, 3, 'slate', 15))
y += 236
s.f(4)
svg, h = vcallout(40, y, 640, 'Honest feasibility',
                  'Error-correction overhead, loading data into qubits and slow gate rates can erase a speedup. A quadratic '
                  'gain needs very large problems to pay off. Claims of advantage are checked one problem at a time.', 'amber', 4)
s.raw(svg)
scenes[71] = finish(s, y + h)


# ── 72 Quantum and security ─────────────────────────────────────────
s = vscene(72)
s.f(1)
svg, h = vcallout(40, 0, 640, 'Public keys: RSA and elliptic curves',
                  'Key exchange and signatures rest on factoring or discrete logs. Shor would solve them — IF a large, '
                  'fault-tolerant quantum computer exists. None is publicly known to exist today.', 'purple', 1, cpl=46)
s.raw(svg)
s.raw(lock(600, 72, 1.3, '#7c3aed'))
y = h + 34
s.f(2)
s.raw(badge(58, y, 2, 'blue', 18) + T(86, y + 7, 'Symmetric keys and hashes', 21, 800, INK))
tb, th = vtable(40, y + 22, [140, 160, 130, 210], L.sym_rows, size=20, wrapw=[11, 14, 10, 18], pad=8)
s.raw(tb)
s.raw(T(40, y + 22 + th + 32, wr('Grover gives a square-root speedup in an idealised count, and splitting it across k machines saves only '
                                 '√k. Hashes: collision search gains little in practice.', 56), 21, 400, BODY))
y += 22 + th + 108
s.f(3)
s.raw(f'<rect x="40" y="{y}" width="640" height="240" rx="14" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(badge(68, y + 32, 3, 'teal', 18) + T(96, y + 40, 'Published estimates for RSA-2048 (research)', 21, 800, INK))
for i, (yr, q, label) in enumerate(L.est):
    bw = math.log10(q) / math.log10(2e7) * 460
    yy = y + 56 + i * 60
    s.raw(f'<rect x="140" y="{yy}" width="{bw:.0f}" height="28" rx="6" fill="#5eead4"/>' + T(60, yy + 22, str(yr), 21, 800, '#0f766e'))
    s.raw(T(60, yy + 50, label, 20, 400, BODY))
s.raw(T(60, y + 196, wr('Bar length: log scale. Estimates change with new methods and hardware.', 56), 20, 400, '#475569', italic=True))
y += 240 + 12
s.f(4)
svg, h = vcallout(40, y, 640, 'Harvest now, decrypt later',
                  'Matters only when all three hold: the data must stay secret for years; it is protected by '
                  'quantum-vulnerable key exchange; and someone captures and keeps it.', 'amber', 4)
s.raw(svg)
y += h + 14
s.f(5)
svg, h = vcallout(40, y, 640, 'Replacements exist, on ordinary chips',
                  'NIST, August 2024: ML-KEM (FIPS 203) for key establishment; ML-DSA (FIPS 204) and SLH-DSA (FIPS 205) for '
                  'signatures. Post-quantum cryptography is classical cryptography designed to resist known quantum attacks. '
                  'What migrating cards, trackers and accounts involves is Module 10.', 'green', 5)
s.raw(svg)
scenes[72] = finish(s, y + h)
