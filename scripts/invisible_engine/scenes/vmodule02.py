"""Module 2 phone-vertical scenes (09–17): the same scenes as module02.py, laid out for a
phone (VScene: 720 wide, body drawn in its own coordinates below the header).
Same title, desc, frames and words as the landscape scene; invisible-engine/tests/check.py
compares them. Change a scene's words in both files."""
import math
from .svgkit import VScene
from .art import *

scenes = {}


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
