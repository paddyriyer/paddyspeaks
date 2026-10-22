DESC = ('An interactive lesson in five reader levels, from a ten-year-old to a CISO: how a contactless card works '
        'without a battery, how a tracker whispers, how keys and accounts decide who can read a location, and what '
        'quantum computing changes.')

STORY = [
    ('/invisible-engine/scenes/png/s09.png', 'A tap with no battery', 'A child taps a card at a shop and asks how it works without a battery. The terminal’s invisible magnetic field powers the card for a moment.', '/invisible-engine/m02.html#s09'),
    ('/invisible-engine/scenes/png/s10.png', 'Open the card', 'Inside: a loop of fine wire around the edge and a tiny chip. The loop catches energy; the chip uses it to talk and keep a secret.', '/invisible-engine/m02.html#s10'),
    ('/invisible-engine/scenes/png/s15.png', 'A fresh secret code', 'Each payment, the card makes a new code that only its bank can check. A copied code is useless next time.', '/invisible-engine/m02.html#s15'),
    ('/images/articles/from-tap-to-trace/fig-01-network.png', 'A tracker that whispers', 'A lost suitcase holds a small tag. It cannot see a map. It whispers, and a stranger’s phone that knows where it is passes the message on, sealed.', '/articles/from-tap-to-trace.html#p5'),
    ('/images/articles/from-tap-to-trace/fig-03-account-keys.png', 'Keys, accounts, people', 'Whoever holds the right key can read where the tag has been. That protects the owner — and can expose a person carrying someone else’s tag.', '/articles/from-tap-to-trace.html#p3'),
    ('/images/articles/from-tap-to-trace/fig-14-quantum.png', 'Waves, qubits, tomorrow’s locks', 'Why is the code hard to break? The story reaches waves that cancel, qubits, and the new locks being built for a quantum future.', '/articles/from-tap-to-trace.html#p9'),
]


def body(mods, legend):
    story = ''.join(
        f'<div class="card"><a href="{href}"><img src="{img}" loading="lazy" alt="{t}: open the scene" style="width:100%;height:auto;border-radius:8px;border:1px solid #e2ddd2"></a>'
        f'<span class="n">{i + 1}</span><h3>{t}</h3><p>{d}</p></div>'
        for i, (img, t, d, href) in enumerate(STORY))
    cards = ''
    for n, title, f, phase in mods:
        if f:
            cards += (f'<div class="card"><span class="n">MODULE {n:02d}</span><h3><a class="go" href="/invisible-engine/{f}">{title}</a></h3>'
                      f'<p class="status live">Available</p></div>')
        else:
            cards += (f'<div class="card"><span class="n">MODULE {n:02d}</span><h3>{title}</h3>'
                      f'<p class="status soon">Coming in phase {phase}</p></div>')
    return f'''<main id="main">
<div class="ie-head">
  <p class="ie-kicker">A PaddySpeaks lesson · Phase 1 of 5</p>
  <h1>The Invisible Engine</h1>
  <p class="dek">From a powerless credit card to a whispering tracker, from waves that cancel to quantum computers that challenge cryptographic trust.</p>
  <div class="ie-meta"><span>Five reader levels: A child · B adult · C engineer · D security architect · E CISO</span><span>Modules 1–2 available</span></div>
</div>
<div class="ie-wrap">
  <p class="lede" style="font-family:var(--serif);font-size:20px;max-width:760px">The same invisible world can power a contactless card, help recover a suitcase, expose a person’s whereabouts and force us to rethink encryption. Most explanations fuse four different things into one glowing arrow: <strong>energy</strong>, <strong>signals</strong>, <strong>data</strong> and <strong>promises about who may read the data</strong>. This lesson pulls them apart — first the object, then what moves inside it, then who talks to whom, and only then why the data can be trusted, who can misuse it and what quantum changes.</p>

  <h2 style="margin-top:44px">The whole story, for an eleven-year-old</h2>
  <p>Six pictures. Each one opens the scene that explains it.</p>
  <div class="cards">{story}</div>
  <p class="note">Steps 4–6 become lesson modules in later phases (trackers in Modules 3–5, keys and people in 6–7, quantum in 8–10). Until then they open the matching parts of the essay <a href=\"/articles/from-tap-to-trace.html\">From Tap to Trace</a>.</p>

  <h2 style="margin-top:44px">Choose your path</h2>
  <div class="cards">
    <div class="card"><span class="n">BEGINNER</span><h3>Curious, no background</h3><p>Read level A, then B. Step through each diagram with Next. Skip the engineering notes.</p></div>
    <div class="card"><span class="n">ENGINEER</span><h3>Student or developer</h3><p>Read level C: units, equations, protocol layers, failure modes. Try demo A in Module 2 and check the numbers yourself.</p></div>
    <div class="card"><span class="n">SECURITY</span><h3>Architect or CISO</h3><p>Read levels D and E: trust boundaries, preconditions, owners and residual risk. Each scene ends with an accuracy check and sources.</p></div>
  </div>
  <p>Use the <strong>Read as</strong> switch at the top of each module to show one level, or all five. Your choice is remembered in this browser only.</p>

  {legend}

  <h2 style="margin-top:44px">Twelve modules</h2>
  <div class="cards">{cards}</div>

  <h2 style="margin-top:44px">What this lesson promises</h2>
  <ul style="max-width:760px">
    <li>Energy, signals, data and security promises are never drawn as one arrow.</li>
    <li>Every engineering number is sourced or labelled <em>illustrative</em>. No calibrated watts are invented.</li>
    <li>Threats are explained only as far as a defender needs. Nothing here helps anyone stalk, skim or defeat a protection.</li>
    <li>Historical findings are labelled historical; nothing quantum is described as already broken.</li>
  </ul>
  <p>For the tracker, account and privacy story told as an essay, read <a href="/articles/from-tap-to-trace.html">From Tap to Trace</a>. This lesson goes deeper into the physics and links there instead of repeating it.</p>
</div>
</main>
'''
