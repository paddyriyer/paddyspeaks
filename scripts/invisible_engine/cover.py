"""The Invisible Engine cover (2:1), used on the Read page's lead visual essay.

    python3 scripts/invisible_engine/build.py   # writes invisible-engine/art/cover.svg
    node scripts/invisible_engine/render.mjs cover   # → art/cover.webp via PNG

One picture of the lesson's thesis: a reader powers a card (orange = energy),
a tag whispers to a passing phone (blue = signal), and only a sealed message
travels on (purple = crypto). Arrow colours keep their lesson meanings.
"""
from scenes.art import T, card, terminal, phone, tag, lock, waves


def cover() -> str:
    W, H = 1600, 800
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-labelledby="t d" font-family="Inter, Arial, sans-serif">',
         '<title id="t">The Invisible Engine</title>',
         '<desc id="d">A payment terminal\'s field powers a card held over it; a small round tag whispers to a passing phone; '
         'a sealed, encrypted message travels from the phone to a distant server. Orange means energy, blue means signal, purple means encrypted.</desc>',
         '<defs><radialGradient id="g" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#16294d"/><stop offset="1" stop-color="#0b1529"/></radialGradient>'
         '<marker id="mo" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#fb923c"/></marker>'
         '<marker id="mb" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#60a5fa"/></marker>'
         '<marker id="mp" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#a78bfa"/></marker></defs>',
         f'<rect width="{W}" height="{H}" fill="url(#g)"/>']
    # faint grid: the "engine" underneath
    for x in range(0, W, 80):
        o.append(f'<path d="M{x},0 V{H}" stroke="#ffffff" stroke-opacity="0.035"/>')
    for y in range(0, H, 80):
        o.append(f'<path d="M0,{y} H{W}" stroke="#ffffff" stroke-opacity="0.035"/>')
    o.append(T(140, 104, 'THE INVISIBLE ENGINE', 26, 700, '#93c5fd', mono=True))
    o.append(T(140, 142, 'energy · signal · secrets', 22, 400, '#cbd5e1'))

    # 1. terminal powering a card (orange field arcs)
    o.append(terminal(120, 300, 0.95))
    for i, r in enumerate((70, 115, 160)):
        o.append(f'<path d="M{370},{455 - r} A{r * 0.75:.0f},{r} 0 0 1 {370},{455 + r}" fill="none" stroke="#fb923c" '
                 f'stroke-width="4" stroke-dasharray="10 9" opacity="{0.95 - i * 0.25:.2f}"/>')
    o.append('<g transform="rotate(-12 560 420)">' + card(430, 330, 300) + '</g>')
    o.append('<path d="M380,600 C430,640 500,640 560,590" fill="none" stroke="#fb923c" stroke-width="5" marker-end="url(#mo)"/>')

    # 2. tag whispering to a phone (blue)
    o.append(tag(930, 560, 58))
    o.append(waves(1000, 560, 3, '#60a5fa', 1.3))
    o.append(phone(1110, 300, 150, 300, '#e0f2fe'))
    # a map pin on the phone: the owner's view
    o.append('<path d="M1185,520 C1150,470 1150,430 1185,425 C1220,430 1220,470 1185,520 Z" fill="#2563eb"/>'
             '<circle cx="1185" cy="452" r="11" fill="#ffffff"/>')
    o.append('<ellipse cx="1185" cy="530" rx="34" ry="8" fill="#93c5fd" opacity="0.6"/>')
    o.append('<path d="M1000,640 C1050,690 1120,680 1160,620" fill="none" stroke="#60a5fa" stroke-width="5" marker-end="url(#mb)"/>')

    # 3. sealed message onward (purple)
    o.append('<path d="M1270,420 C1290,360 1330,300 1372,262" fill="none" stroke="#a78bfa" stroke-width="5" '
             'stroke-dasharray="2 0" marker-end="url(#mp)"/>')
    o.append('<rect x="1268" y="318" width="96" height="66" rx="10" fill="#f5f3ff" stroke="#a78bfa" stroke-width="3"/>'
             '<path d="M1268,324 L1316,360 L1364,324" fill="none" stroke="#7c3aed" stroke-width="3"/>')
    o.append(lock(1372, 150, 1.6, '#a78bfa'))

    o.append('</svg>')
    return ''.join(o)
