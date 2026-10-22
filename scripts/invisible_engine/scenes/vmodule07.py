"""Module 7 phone-vertical scenes (50–55): the same scenes as module07.py, laid out for a
phone (VScene: 720 wide, body drawn in its own coordinates below the header).
Same title, desc, frames and words as the landscape scene; invisible-engine/tests/check.py
compares them. Change a scene's words in both files.

The safety rules of module07.py apply unchanged: no instructions to find, defeat,
silence or evade trackers or alerts; every path for a person at risk ends at help.
"""
from .svgkit import VScene
from .art import *
from .module07 import dot

scenes = {}


# ── local helpers (phone type scale) ────────────────────────────────
def vlines(x, y, rows, size=21, color='#334155', weight=400, lh=27, anchor='start'):
    return ''.join(T(x, y + i * lh, r, size, weight, color, anchor) for i, r in enumerate(rows))


def vpanel(x, y, w, h, color, n, title, sub=None, tsize=24):
    """panel() with a phone-sized subtitle."""
    c, light, border = STEP[color]
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="18" fill="{light}" stroke="{border}" stroke-width="2"/>'
    tx = x + 24
    if n is not None:
        out += badge(x + 42, y + 44, n, color, 26)
        tx = x + 82
    out += T(tx, y + 54 if n is not None else y + 44, title, tsize, 800, '#14213d')
    if sub:
        out += T(tx, y + 86, sub, 21, 600, c)
    return out


def hz_box(s, y, h, n, title, rows):
    s.rect(40, y, 640, h, 'hz', rx=14)
    s.raw(badge(74, y + 34, n, 'red', 18) + T(102, y + 42, title, 23, 800, '#b91c1c'))
    s.raw(vlines(64, y + 80, rows))


def vstep(x, y, w, h, rows, color='slate'):
    c, light, border = STEP[color]
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{light}" stroke="{border}" stroke-width="2"/>'
    top = y + h / 2 - (len(rows) - 1) * 13.5 + 7
    return out + ''.join(T(x + 16, top + i * 27, r, 21, 600 if i == 0 and color != 'slate' else 400, '#14213d') for i, r in enumerate(rows))


def flow(d, color='#94a3b8'):
    """A plain flow connector (not a data arrow) along a polyline, with a small head."""
    (x1, y1), (x2, y2) = d[-2], d[-1]
    path = 'M' + ' L'.join(f'{x},{y}' for x, y in d)
    if x2 == x1:
        sy = 1 if y2 > y1 else -1
        head = f'M{x2 - 7},{y2 - sy * 10} L{x2},{y2} L{x2 + 7},{y2 - sy * 10} Z'
    else:
        sx = 1 if x2 > x1 else -1
        head = f'M{x2 - sx * 10},{y2 - 7} L{x2},{y2} L{x2 - sx * 10},{y2 + 7} Z'
    return f'<path d="{path}" fill="none" stroke="{color}" stroke-width="3"/><path d="{head}" fill="{color}"/>'


def vslider(x, y, w, label, left, right, at=0.5):
    """slider() at phone size: label above the track, the two ends' meanings stacked below it."""
    return (vlines(x, y, label, 21, '#14213d', 700)
            + f'<rect x="{x}" y="{y + 48}" width="{w}" height="8" rx="4" fill="#cbd5e1"/>'
            + f'<rect x="{x}" y="{y + 48}" width="{w * at:.0f}" height="8" rx="4" fill="#64748b"/>'
            + f'<circle cx="{x + w * at:.0f}" cy="{y + 52}" r="12" fill="#ffffff" stroke="#334155" stroke-width="3"/>'
            + T(x, y + 92, left, 20, 400, '#475569')
            + T(x + w, y + 118, right, 20, 400, '#475569', 'end'))


def vid_chip(x, y, text, w=186, color='#15803d'):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="46" rx="8" fill="#ffffff" stroke="{color}" stroke-width="2.5"/>'
            + T(x + w / 2, y + 30, text, 20, 700, color, 'middle', mono=True))


def vdoc(x, y, w, h, title):
    out = (f'<path d="M{x},{y} L{x + w - 30},{y} L{x + w},{y + 30} L{x + w},{y + h} L{x},{y + h} Z" fill="#ffffff" stroke="#334155" stroke-width="3"/>'
           f'<path d="M{x + w - 30},{y} L{x + w - 30},{y + 30} L{x + w},{y + 30}" fill="none" stroke="#334155" stroke-width="3"/>')
    for i in range(5):
        out += f'<rect x="{x + 16}" y="{y + 72 + i * 20}" width="{w - 32 - (26 if i == 4 else 0)}" height="7" rx="3" fill="#cbd5e1"/>'
    return out + T(x + w / 2, y + 52, title, 20, 800, '#14213d', 'middle')


def valert(x, y, w, rows):
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{20 + 26 * len(rows)}" rx="10" fill="#ffffff" stroke="#f59e0b" stroke-width="2.5"/>'
    out += f'<circle cx="{x + 11}" cy="{y + 22}" r="6" fill="#f59e0b"/>'
    return out + ''.join(T(x + 21, y + 29 + i * 26, r, 20, 700 if i == 0 else 400, '#14213d') for i, r in enumerate(rows))


# ── 50 Threat landscape ─────────────────────────────────────────────
s = VScene(50, 'Where the system can fail people',
           'Five frames. 1, the whole system: a person carries a bag with a small tracker; the tag’s radio advertisement '
           'reaches a passer-by’s phone; the phone sends a sealed report to a relay service; the relay passes it to the '
           'owner’s phone, which holds the keys. 2, threats around the tag and the radio: anyone can listen to the radio, '
           'sightings can be correlated across time and place, a tag can be hidden in someone’s things, and firmware or '
           'the supply chain can be tampered with. 3, threats around the reports and the service: spoofed sightings, '
           'altered or replayed reports, the relay itself as a target, and metadata. 4, threats around accounts and '
           'people: account takeover, shared or coerced access, stale shares, and the person carrying a tag they never '
           'chose. 5, four separate questions: confidentiality, integrity, authenticity and consent; encryption answers '
           'the first, and no cipher answers the last.',
           sub='Encryption keeps a report secret. It does not decide who agreed to be located.',
           note='Schematic. Threats named, not explained step by step.', h=1667)
s.f(1)
s.raw(person(80, 40, 0.7, '#64748b'))
s.raw(tag(130, 124, 18))
s.arrow([(152, 124), (222, 124)], 'signal', 'advert', at=(187, 26))
s.raw(phone(230, 54, 70, 140, '#f1f5f9'))
s.arrow([(306, 124), (356, 124)], 'crypto', 'sealed', at=(331, 26))
s.raw(cloud(360, 80, 150))
s.arrow([(516, 124), (564, 124)], 'crypto', 'report', at=(540, 26))
s.raw(phone(570, 54, 70, 140, '#f1f5f9'))
s.raw(lock(584, 96, 0.9, '#7c3aed'))
s.raw(T(40, 226, 'person with a bag', 21, 600, '#475569'))
s.raw(T(435, 226, 'relay service', 21, 700, '#14213d', 'middle'))
s.raw(T(265, 256, 'passer-by’s phone', 21, 600, '#475569', 'middle'))
s.raw(T(680, 256, 'owner’s phone (keys)', 21, 600, '#475569', 'end'))
s.raw(callout(40, 270, 640, 112, 'The system', 'A tag whispers. A passer-by’s phone seals a report.\nA relay stores it. Only the owner’s devices can open it.', 'blue', 1, 26, 21))
s.f(2)
hz_box(s, 394, 174, 2, 'Around the tag and the radio',
       ['• Radio observation: anyone can listen', '• Correlation across time and place', '• A tag hidden in someone’s things', '• Firmware or supply-chain tampering'])
s.f(3)
hz_box(s, 576, 174, 3, 'Around the reports and the service',
       ['• Spoofed sightings: invented reports', '• Report integrity: altered or replayed', '• The relay itself as a target', '• Metadata: when, how often, from where'])
s.f(4)
hz_box(s, 758, 174, 4, 'Around accounts and people',
       ['• Account takeover: every report readable', '• Shared or coerced access', '• Stale shares after a relationship ends', '• The person carrying a tag they never chose'])
s.f(5)
props = [('Confidentiality', ['Who can read it?', 'Encryption’s job.'], 'purple'),
         ('Integrity', ['Was it changed', 'on the way?'], 'blue'),
         ('Authenticity', ['Did it really come', 'from a tag and a finder?'], 'teal'),
         ('Consent', ['Did the person located', 'agree? No cipher', 'answers this.'], 'red')]
for i, (t, rows, col) in enumerate(props):
    x, y = 40 + (i % 2) * 325, 944 + (i // 2) * 112
    h = 106 if i < 2 else 132
    c, light, border = STEP[col]
    s.raw(f'<rect x="{x}" y="{y}" width="315" height="{h}" rx="12" fill="{light}" stroke="{c if t == "Consent" else border}" stroke-width="{3 if t == "Consent" else 2}"/>')
    s.raw(T(x + 18, y + 32, t, 22, 800, c) + vlines(x + 18, y + 62, rows, lh=26))
scenes[50] = s.render()

# ── 51 Privacy paradox ──────────────────────────────────────────────
s = VScene(51, 'Two good goals that pull against each other',
           'Five frames. 1, owner privacy: a tag that changes its identifier often shows a passer-by unrelated values at '
           'each place, and only the owner’s key links them. 2, the safety of the person carrying it: a tag that keeps '
           'travelling with someone — home, bus, office — should be noticed, which means recognising the same tag again. '
           '3, a balance between the two goals: unlinkable on one side, detectable on the other. 4, four illustrative '
           'design dials: how often the identifier rotates, how the tag behaves when separated from its owner, whether '
           'it plays a sound when moved, and how long a tag must travel with someone before an alert. 5, a note that this '
           'is a tension tuned by design choices, not an impossibility.',
           sub='Rotation hides a tag from strangers. Protection must still notice a tag that stays with you.', h=1736)
s.f(1)
s.raw(vpanel(40, 0, 640, 272, 'purple', 1, 'Owner privacy', 'Strangers should not follow my tag'))
s.raw(vid_chip(64, 104, 'K1 · 2C9E') + vid_chip(261, 104, 'K2 · A417') + vid_chip(458, 104, 'K3 · 51D0'))
s.raw(T(64, 180, 'café', 20, 600, '#475569') + T(261, 180, 'station', 20, 600, '#475569') + T(458, 180, 'office', 20, 600, '#475569'))
s.raw(eye(64, 216, 0.6, '#334155') + T(126, 223, 'a passer-by sees unrelated values', 21, 400, '#334155'))
s.raw(T(64, 256, 'only the owner’s key links them', 21, 700, '#6b21a8'))
s.f(2)
s.raw(vpanel(40, 462, 640, 264, 'teal', 2, 'The person carrying it', 'A tag that stays with me should be noticed'))
s.raw(person(96, 572, 0.55, '#64748b'))
s.raw(tag(130, 644, 12))
s.raw('<path d="M154,674 C260,614 380,704 640,624" fill="none" stroke="#0d9488" stroke-width="3" stroke-dasharray="7 7"/>')
for (x, y, lab, dy) in ((250, 648, 'home', -20), (420, 666, 'bus', 34), (610, 632, 'office', -20)):
    s.raw(f'<circle cx="{x}" cy="{y}" r="9" fill="#0d9488"/>' + T(x, y + dy, lab, 20, 600, '#0f766e', 'middle'))
s.raw(T(64, 718, 'the same tag, again and again', 21, 400, '#334155'))
s.f(3)
cx = 360
s.raw(T(cx, 310, 'in tension', 26, 800, '#14213d', 'middle') + T(cx, 340, 'tuned, not traded away', 21, 400, '#475569', 'middle'))
s.raw(f'<path d="M{cx},364 L{cx - 40},424 L{cx + 40},424 Z" fill="#334155"/>'
      f'<path d="M{cx - 150},364 L{cx + 150},364" stroke="#334155" stroke-width="6" stroke-linecap="round"/>'
      f'<path d="M{cx - 130},364 L{cx - 150},402 M{cx - 130},364 L{cx - 110},402 M{cx + 130},364 L{cx + 110},402 M{cx + 130},364 L{cx + 150},402" stroke="#64748b" stroke-width="2"/>'
      f'<path d="M{cx - 162},402 L{cx - 98},402 M{cx + 98},402 L{cx + 162},402" stroke="#334155" stroke-width="5" stroke-linecap="round"/>')
s.raw(T(cx - 130, 440, 'unlinkable', 20, 700, '#6b21a8', 'middle') + T(cx + 130, 440, 'detectable', 20, 700, '#0f766e', 'middle'))
s.f(4)
s.raw('<rect x="40" y="738" width="640" height="392" rx="18" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(badge(82, 782, 4, 'slate', 24) + T(120, 791, 'Design dials (illustrative)', 24, 800, '#14213d'))
dials = [(['Identifier rotation', 'period'], 'short: hard to follow', 'long: easy to link', 0.3),
         (['When separated from', 'owner'], 'near owner: private', 'separated: findable', 0.7),
         (['Sound when moved'], 'silent', 'plays a sound', 0.75),
         (['Time together before', 'an alert'], 'short: early warning', 'long: fewer false alarms', 0.45)]
for i, (lab, l, r, at) in enumerate(dials):
    s.raw(vslider(66 + (i % 2) * 318, 834 + (i // 2) * 164, 280, lab, l, r, at))
s.f(5)
s.raw(vpanel(40, 1140, 640, 152, 'amber', 5, 'A tension, not an impossibility', None, 24))
s.raw(vlines(64, 1228, ['Every dial moves protection between the two goals.',
                        'Designs give up some unlinkability mainly while a',
                        'tag is away from its owner.']))
scenes[51] = s.render()

# ── 52 Cross-platform alerts ─────────────────────────────────────────
s = VScene(52, 'Alerts across iPhone and Android',
           'Five frames. 1, trackers from different makers follow one industry specification for detecting unwanted '
           'trackers, and phones on both platforms — an iPhone on iOS 17.5 or later and an Android phone on Android 6.0 '
           'or later — can show an alert that an unknown tracker is moving with you; Apple and Google announced this in '
           'May 2024. 2, deployed: built into both platforms and working with trackers whose makers adopt the '
           'specification. 3, the standards track: an IETF working group is turning the work into standards; drafts '
           'change, so check their current status. 4, edge conditions in a red dashed box: a tag often near its owner, '
           'short trips, Bluetooth or location off or old software, trackers that do not follow the specification, and '
           'manual scans that see what is near now rather than what followed you. 5, no timing guarantee: an alert is a '
           'prompt to check, and no alert is not proof of safety.',
           sub='Since May 2024 both platforms alert about compatible trackers. The standard is still being written.',
           note='Versions as Apple and Google documented them in May 2024.', h=1702)
s.f(1)
for i, lab in enumerate(['tracker A', 'tracker B', 'tracker C']):
    y = 66 + i * 82
    s.raw(tag(64, y, 22) + T(94, y + 7, lab, 20, 600, '#475569'))
    s.raw(f'<path d="M196,{y} L224,150" stroke="#94a3b8" stroke-width="2.5"/>')
s.raw(vdoc(224, 60, 122, 184, 'DULT spec'))
s.raw('<path d="M285,60 L285,16 L604,16 L604,40 M440,16 L440,40" fill="none" stroke="#94a3b8" stroke-width="2.5"/>')
s.raw(phone(362, 40, 156, 252, '#f8fafc') + valert(366, 92, 147, ['Tracker', 'moving with', 'you']))
s.raw(phone(526, 40, 156, 252, '#f8fafc') + valert(530, 92, 147, ['Tracker', 'moving with', 'you']))
s.raw(vlines(440, 324, ['iPhone ·', 'iOS 17.5+'], 20, '#334155', 700, 26, 'middle'))
s.raw(T(604, 324, 'Android 6.0+', 20, 700, '#334155', 'middle'))
s.raw(vlines(40, 292, ['Trackers from makers that', 'adopt it']))
s.raw(callout(40, 368, 640, 112, 'One specification, two platforms', 'Apple and Google wrote one industry specification. Both\nplatforms alert about compatible trackers (May 2024).', 'blue', 1, 26, 21))
s.f(2)
s.raw(vpanel(40, 494, 312, 236, 'green', 2, 'Deployed', None, 24))
s.raw(vlines(60, 584, ['Built into iOS 17.5+', 'and Android 6.0+ since', 'May 2024. Works with', 'trackers whose makers', 'adopt the specification.']))
s.f(3)
s.raw(vpanel(368, 494, 312, 236, 'amber', 3, 'Standards track', None, 24))
s.raw(vlines(388, 584, ['The IETF DULT working', 'group is turning the work', 'into standards. Drafts', 'change: check current', 'status. A draft is not a', 'promise.'], lh=25))
s.f(4)
s.rect(40, 744, 640, 230, 'hz', rx=14)
s.raw(badge(74, 778, 4, 'red', 18) + T(102, 786, 'When an alert may not come', 23, 800, '#b91c1c'))
s.raw(vlines(64, 822, ['• The tag is often near its owner', '• A short trip: not enough time together', '• Bluetooth or location off; old software',
                       '• A tracker that does not follow the spec', '• A manual scan sees what is near now,'], lh=28))
s.raw(T(84, 822 + 5 * 28, 'not what followed you', 21, 400, '#334155'))
s.f(5)
s.raw(vpanel(40, 986, 640, 176, 'slate', 5, 'No timing guarantee', None, 24))
s.raw(vlines(64, 1092, ['Neither platform promises how soon an alert appears.',
                        'An alert is a prompt to check; no alert is not proof',
                        'of safety.']))
scenes[52] = s.render()

# ── 53 Three people ─────────────────────────────────────────────────
s = VScene(53, 'Three people, three safe paths',
           'Four frames, each a short decision path that ends at help. 1, the traveller: an alert that an unknown tracker '
           'is moving with them; are they safe right now; is there an innocent explanation such as a companion’s tag in '
           'a shared bag or car; if not, record the alert, use its own tools and get help before disabling anything. '
           '2, a vulnerable family member: worried someone knows where they go; tell a trusted person, for a child a '
           'grown-up they trust; make a plan with an advocate or support service; record what is safe to record and '
           'decide together whether and when to disable. 3, an employee or executive: an alert at work or while '
           'travelling; tell security or HR as well as someone they trust; the company can help with a safer workplace, '
           'travel and parking; the company playbook puts safety first and never has anyone search colleagues’ things. '
           '4, a banner: consider your safety first, because disabling a tracker can alert the person who placed it, and '
           'four sources of help: a person you trust, local support services, law enforcement and the platform’s safety '
           'guide.',
           sub='Safety first, then help. None of these paths asks anyone to confront, search or bypass.',
           note='Illustrative people. Not legal advice; local services and laws differ.', h=1736)
people = [
    ('The traveller', 'an alert on a trip', '#475569', [
        ['Alert: an unknown tracker', 'is moving with you'],
        ['Are you safe right now?', 'If not, get somewhere', 'safe first.'],
        ['Innocent explanation?', 'A companion’s tag in a', 'shared bag or car.'],
        ['Not explained? Record the', 'alert, use its tools, get', 'help before disabling.']]),
    ('A family member at risk', 'an older relative, a teenager', '#0f766e', [
        ['Worried someone knows', 'where they go'],
        ['Tell a trusted person —', 'for a child, a grown-up', 'they trust'],
        ['Make a plan with an', 'advocate or a support', 'service'],
        ['Record what is safe to', 'record; decide together', 'whether to disable.']]),
    ('An employee or executive', 'at work or travelling', '#1e3a8a', [
        ['Alert at work or while', 'travelling'],
        ['Tell security or HR as', 'well as someone you trust'],
        ['The company can help:', 'safer workplace, travel', 'and parking'],
        ['Its playbook: safety first,', 'evidence, advice. Never', 'search colleagues’ things.']]),
]
for i, (name, who, col, steps) in enumerate(people):
    s.f(i + 1)
    y0 = i * 314
    s.raw(person(62, y0, 0.3, col))
    s.raw(T(100, y0 + 28, name, 24, 800, '#14213d') + T(100, y0 + 56, who, 21, 400, '#475569'))
    for j, st in enumerate(steps):
        x, y = 40 + (j % 2) * 340, y0 + 78 + (j // 2) * 122
        s.raw(vstep(x, y, 300, 100, st, 'green' if j == 3 else 'slate'))
    r1, r2 = y0 + 78, y0 + 200
    s.raw(flow([(342, r1 + 50), (378, r1 + 50)]))
    s.raw(flow([(530, r1 + 100), (530, r1 + 111), (190, r1 + 111), (190, r2)]))
    s.raw(flow([(342, r2 + 50), (378, r2 + 50)]))
s.f(4)
s.raw('<rect x="40" y="940" width="640" height="150" rx="14" fill="#fef2f2" stroke="#dc2626" stroke-width="3"/>')
s.raw(shield(58, 952, 0.82, '#dc2626'))
s.raw(T(124, 980, 'Consider your safety first.', 24, 800, '#991b1b'))
s.raw(vlines(124, 1016, ['Disabling a tracker can alert the person who',
                         'placed it. Decide when, and whether, with',
                         'someone who can help.']))
for i, lab in enumerate(['A person you trust', 'Local support services', 'Law enforcement', 'The platform’s safety guide']):
    x, y = 40 + (i % 2) * 325, 1102 + (i // 2) * 66
    s.raw(f'<rect x="{x}" y="{y}" width="315" height="56" rx="28" fill="#f0fdf4" stroke="#16a34a" stroke-width="2.5"/>')
    s.raw(T(x + 157, y + 35, lab, 20, 700, '#166534', 'middle'))
scenes[53] = s.render()

# ── 54 Incident trail ───────────────────────────────────────────────
s = VScene(54, 'What can be kept, and what it can and cannot show',
           'Five frames on a timeline under a banner that is always shown: safety first; if in danger, contact local '
           'emergency services; disabling a tracker can alert the person who placed it. 1, the alert: screenshot it and '
           'any map it shows, and note the date and time. 2, the tag’s identity: if it is found, tapping it with an NFC '
           'phone shows its serial number. 3, your own notes: where and when it appeared, and who has had access to your '
           'bag, car or coat. 4, your accounts, when it is safe: who you share your location or items with, and your '
           'trusted devices, for example with Safety Check on iPhone. 5, the vendor and the police: police can ask the '
           'vendor for the account a tag is paired to, and Apple says it can provide paired-account details to valid '
           'requests; and what the evidence cannot show: a sighting is approximate, an alert can be wrong either way, and '
           'a serial number points to an account, not to the person who placed the tag.',
           sub='Collect only what you can collect safely. Evidence helps others act; it rarely proves who placed a tag.',
           note='Steps follow Apple’s and Google’s published safety guidance; check the current versions.', h=1672)
s.raw('<rect x="40" y="0" width="640" height="104" rx="12" fill="#fef2f2" stroke="#dc2626" stroke-width="2.5"/>')
s.raw(vlines(60, 32, ['Safety first. If you are in danger, contact local',
                      'emergency services. Disabling a tracker can alert',
                      'the person who placed it.'], 21, '#991b1b', 700))
s.raw('<path d="M72,182 L72,662" stroke="#cbd5e1" stroke-width="6" stroke-linecap="round"/>')
cards = [('The alert', ['Screenshot the alert and any map it shows. Note', 'the date and time.'], 'amber'),
         ('The tag’s identity', ['If you find it, an NFC phone tap shows', 'its serial number.'], 'blue'),
         ('Your own notes', ['Where and when it appeared; who had access', 'to your bag, car or coat.'], 'slate'),
         ('Your accounts', ['When safe: who sees your location or items;', 'trusted devices (Safety Check).'], 'purple'),
         ('Vendor and police', ['Police can ask the vendor for the paired account;', 'Apple says it can provide it.'], 'green')]
for i, (t, body, col) in enumerate(cards):
    s.f(i + 1)
    y = 132 + i * 120
    c, light, border = STEP[col]
    s.raw(badge(72, y + 50, i + 1, col, 22))
    s.raw(f'<rect x="110" y="{y}" width="570" height="104" rx="12" fill="{light}" stroke="{border}" stroke-width="2"/>')
    s.raw(T(128, y + 34, t, 23, 800, c) + vlines(128, y + 66, body))
s.raw(vpanel(40, 746, 640, 324, 'amber', None, 'What this evidence cannot show', None, 24))
bul = [['• A sighting is approximate: it is where a passer-by’s', 'phone was, not where the tag is now.'],
       ['• An alert can be wrong both ways: a false alarm, or', 'silence when a tag is there (Scene 52).'],
       ['• A serial number points to an account, not to the', 'person who placed the tag.'],
       ['• Laws and procedures differ by place. This lesson', 'draws no legal conclusions.']]
for i, (a, b) in enumerate(bul):
    y = 834 + i * 62
    s.raw(T(60, y, a, 21, 400, '#334155') + T(78, y + 27, b, 21, 400, '#334155'))
scenes[54] = s.render()

# ── 55 Mitigations ──────────────────────────────────────────────────
s = VScene(55, 'Proportionate protection: who can do what',
           'Five frames build a table of mitigations against five who-columns: a person, a household, an employer, the '
           'vendor and standards bodies. A filled dot means implements, a ring means supports. 1, consent before sharing '
           'a location, and regular reviews of who sees your location or items, are mainly for the person and household. '
           '2, hardening accounts with two-factor authentication, trusted-device reviews and recovery contacts: person '
           'and employer. 3, anti-abuse controls built into the product — alerts, a sound when moved, serial and NFC '
           'information, one account per tag: the vendor, supported by standards. 4, minimising metadata and '
           'standards with responsible disclosure: vendors and standards bodies. 5, a note that proportionate means the '
           'smallest control that addresses the risk, chosen with the person it protects.',
           sub='Each control has an owner. Proportionate means fitting the control to the risk — never watching the person you protect.',
           note='Who-columns are illustrative; organisations differ.', h=1590)
cols = ['Person', 'Household', 'Employer', 'Vendor', 'Standards']
CX = [104 + i * 128 for i in range(5)]
s.raw('<rect x="40" y="0" width="640" height="90" rx="10" fill="#f1f5f9"/>')
s.raw(T(56, 34, 'Mitigation', 22, 800, '#14213d'))
for i, c in enumerate(cols):
    s.raw(T(CX[i], 74, c, 20, 800, '#14213d', 'middle'))
rows = [
    (1, 'Consent before sharing a location', ['Ask and agree openly; write down how to stop'], '●●○○ '),
    (1, 'Review who sees your location or items', ['For example Safety Check on iPhone'], '●● ○ '),
    (2, 'Harden accounts', ['Two-factor, trusted devices, recovery contacts'], '●○●○ '),
    (3, 'Anti-abuse controls in the product', ['Alerts, sound when moved, serial and NFC info,', 'one account per tag'], '   ●○'),
    (4, 'Minimise metadata', ['Keep less, for less time; aggregate where possible'], '  ○●○'),
    (4, 'Standards and responsible disclosure', ['Cross-platform alert specifications; report flaws', 'privately first'], '○  ●●'),
]
y = 100
for fr, t, sub, marks in rows:
    s.f(fr)
    h = 90 + 26 * len(sub)
    s.raw(f'<rect x="40" y="{y}" width="640" height="{h}" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>')
    s.raw(T(56, y + 32, t, 22, 800, '#14213d') + vlines(56, y + 60, sub, 21, '#475569', lh=26))
    for i, m in enumerate(marks):
        s.raw(dot(CX[i], y + h - 26, m))
    y += h + 8
s.f(5)
s.raw(vpanel(40, y + 6, 640, 172, 'green', 5, 'Proportionate', None, 24))
s.raw(dot(76, y + 92, '●') + T(96, y + 99, 'implements', 21, 600, '#334155') + dot(246, y + 92, '○') + T(266, y + 99, 'supports', 21, 600, '#334155'))
s.raw(vlines(64, y + 134, ['The smallest control that addresses the risk, chosen', 'with the person it protects.']))
scenes[55] = s.render()
