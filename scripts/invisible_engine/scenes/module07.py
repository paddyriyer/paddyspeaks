"""Module 7 scenes (50–55): privacy, threat modelling and survivor safety.
Run scripts/invisible_engine/build.py to write the SVGs.

Safety rules for this module (docs/INVISIBLE-ENGINE.md, docs/FROM-TAP-TO-TRACE.md): no
instructions to find, defeat, silence or evade trackers or alerts; no confrontation
advice; every path for a person at risk ends at help, and says that disabling a tracker
can alert whoever placed it.
"""
from .svgkit import Scene
from .art import *

scenes = {}


# ── local helpers (Module 7 only) ───────────────────────────────────
def lines(x, y, rows, size=15.5, color='#334155', weight=400, lh=None):
    """Several left-aligned text lines."""
    lh = lh or round(size * 1.65)
    return ''.join(T(x, y + i * lh, r, size, weight, color) for i, r in enumerate(rows))


def down(x, y1, y2, color='#94a3b8'):
    """A plain flow connector (not a data arrow): a line with a small head."""
    return (f'<path d="M{x},{y1} L{x},{y2 - 8}" stroke="{color}" stroke-width="3"/>'
            f'<path d="M{x - 7},{y2 - 10} L{x},{y2} L{x + 7},{y2 - 10} Z" fill="{color}"/>')


def step_box(x, y, w, h, text, color='slate'):
    c, light, border = STEP[color]
    rows = text.split('\n')
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{light}" stroke="{border}" stroke-width="2"/>'
    top = y + h / 2 - (len(rows) - 1) * 11 + 5
    return out + ''.join(T(x + 16, top + i * 22, r, 15, 600 if i == 0 and color != 'slate' else 400, '#14213d') for i, r in enumerate(rows))


def slider(x, y, w, label, left, right, at=0.5):
    """An illustrative design dial: label, track, knob, and what each end means."""
    return (T(x, y, label, 16, 700, '#14213d')
            + f'<rect x="{x}" y="{y + 22}" width="{w}" height="8" rx="4" fill="#cbd5e1"/>'
            + f'<rect x="{x}" y="{y + 22}" width="{w * at:.0f}" height="8" rx="4" fill="#64748b"/>'
            + f'<circle cx="{x + w * at:.0f}" cy="{y + 26}" r="12" fill="#ffffff" stroke="#334155" stroke-width="3"/>'
            + T(x, y + 60, left, 13.5, 400, '#475569')
            + T(x + w, y + 60, right, 13.5, 400, '#475569', 'end'))


def id_chip(x, y, text, color='#15803d'):
    return (f'<rect x="{x}" y="{y}" width="150" height="40" rx="8" fill="#ffffff" stroke="{color}" stroke-width="2.5"/>'
            + T(x + 75, y + 26, text, 16, 700, color, 'middle', mono=True))


def doc_icon(x, y, w=150, h=190, title='Specification'):
    out = (f'<path d="M{x},{y} L{x + w - 34},{y} L{x + w},{y + 34} L{x + w},{y + h} L{x},{y + h} Z" fill="#ffffff" stroke="#334155" stroke-width="3"/>'
           f'<path d="M{x + w - 34},{y} L{x + w - 34},{y + 34} L{x + w},{y + 34}" fill="none" stroke="#334155" stroke-width="3"/>')
    for i in range(5):
        out += f'<rect x="{x + 18}" y="{y + 70 + i * 20}" width="{w - 36 - (30 if i == 4 else 0)}" height="7" rx="3" fill="#cbd5e1"/>'
    return out + T(x + w / 2, y + 52, title, 16, 800, '#14213d', 'middle')


def alert_sheet(x, y, w, text):
    rows = text.split('\n')
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{30 + 18 * len(rows)}" rx="10" fill="#ffffff" stroke="#f59e0b" stroke-width="2.5"/>'
    out += f'<circle cx="{x + 16}" cy="{y + 18}" r="7" fill="#f59e0b"/>'
    return out + ''.join(T(x + 30, y + 23 + i * 18, r, 12.5, 700 if i == 0 else 400, '#14213d') for i, r in enumerate(rows))


def dot(x, y, kind):
    if kind == '●':
        return f'<circle cx="{x}" cy="{y}" r="12" fill="#16a34a"/>'
    if kind == '○':
        return f'<circle cx="{x}" cy="{y}" r="11" fill="#ffffff" stroke="#16a34a" stroke-width="3"/>'
    return f'<path d="M{x - 9},{y} L{x + 9},{y}" stroke="#cbd5e1" stroke-width="3"/>'


# ── 50 Threat landscape ─────────────────────────────────────────────
s = Scene(50, 'Where the system can fail people',
          'Five frames. 1, the whole system: a person carries a bag with a small tracker; the tag’s radio advertisement '
          'reaches a passer-by’s phone; the phone sends a sealed report to a relay service; the relay passes it to the '
          'owner’s phone, which holds the keys. 2, threats around the tag and the radio: anyone can listen to the radio, '
          'sightings can be correlated across time and place, a tag can be hidden in someone’s things, and firmware or '
          'the supply chain can be tampered with. 3, threats around the reports and the service: spoofed sightings, '
          'altered or replayed reports, the relay itself as a target, and metadata. 4, threats around accounts and '
          'people: account takeover, shared or coerced access, stale shares, and the person carrying a tag they never '
          'chose. 5, four separate questions: confidentiality, integrity, authenticity and consent; encryption answers '
          'the first, and no cipher answers the last.',
          sub='Encryption keeps a report secret. It does not decide who agreed to be located.')
s.f(1)
s.raw(person(150, 175, 0.95, '#64748b'))
s.raw(tag(222, 312, 24))
s.raw(T(150, 420, 'person with a bag', 15, 600, '#475569', 'middle'))
s.arrow([(252, 312), (392, 312)], 'signal', 'advert', at=(322, 280))
s.raw(phone(400, 200, 110, 210, '#f1f5f9'))
s.raw(T(455, 432, 'passer-by’s phone', 15, 600, '#475569', 'middle'))
s.arrow([(520, 312), (652, 312)], 'crypto', 'sealed', at=(586, 280))
s.raw(cloud(662, 220, 250, 'relay service'))
s.arrow([(922, 312), (1052, 312)], 'crypto', 'report', at=(987, 280))
s.raw(phone(1062, 200, 110, 210, '#f1f5f9'))
s.raw(lock(1093, 270, 1.0, '#7c3aed'))
s.raw(T(1117, 432, 'owner’s phone (keys)', 15, 600, '#475569', 'middle'))
s.raw(callout(1220, 180, 320, 200, 'The system', 'A tag whispers. A passer-by’s\nphone seals a report. A relay\nstores it. Only the owner’s\ndevices can open it.', 'blue', 1, 19, 16))
s.f(2)
s.rect(60, 462, 470, 212, 'hz', rx=14)
s.raw(badge(94, 496, 2, 'red', 18) + T(122, 503, 'Around the tag and the radio', 19, 800, '#b91c1c'))
s.raw(lines(84, 540, ['• Radio observation: anyone can listen', '• Correlation across time and place', '• A tag hidden in someone’s things', '• Firmware or supply-chain tampering'], 15.5))
s.raw('<path d="M240,462 L222,340" stroke="#fca5a5" stroke-width="2.5" stroke-dasharray="6 5"/>')
s.f(3)
s.rect(565, 462, 470, 212, 'hz', rx=14)
s.raw(badge(599, 496, 3, 'red', 18) + T(627, 503, 'Around the reports and the service', 19, 800, '#b91c1c'))
s.raw(lines(589, 540, ['• Spoofed sightings: invented reports', '• Report integrity: altered or replayed', '• The relay itself as a target', '• Metadata: when, how often, from where'], 15.5))
s.raw('<path d="M790,462 L790,364" stroke="#fca5a5" stroke-width="2.5" stroke-dasharray="6 5"/>')
s.f(4)
s.rect(1070, 462, 470, 212, 'hz', rx=14)
s.raw(badge(1104, 496, 4, 'red', 18) + T(1132, 503, 'Around accounts and people', 19, 800, '#b91c1c'))
s.raw(lines(1094, 540, ['• Account takeover: every report readable', '• Shared or coerced access', '• Stale shares after a relationship ends', '• The person carrying a tag they never chose'], 15.5))
s.raw('<path d="M1300,462 L1182,360" stroke="#fca5a5" stroke-width="2.5" stroke-dasharray="6 5"/>')
s.f(5)
props = [('Confidentiality', 'Who can read it?', 'Encryption’s job.', 'purple'),
         ('Integrity', 'Was it changed', 'on the way?', 'blue'),
         ('Authenticity', 'Did it really come', 'from a tag and a finder?', 'teal'),
         ('Consent', 'Did the person located', 'agree? No cipher answers this.', 'red')]
for i, (t, a, b, col) in enumerate(props):
    x = 60 + i * 375
    c, light, border = STEP[col]
    s.raw(f'<rect x="{x}" y="{692}" width="355" height="124" rx="12" fill="{light}" stroke="{c if t == "Consent" else border}" stroke-width="{3 if t == "Consent" else 2}"/>')
    s.raw(T(x + 18, 726, t, 20, 800, c) + T(x + 18, 758, a, 15.5, 400, '#334155') + T(x + 18, 782, b, 15.5, 400, '#334155'))
scenes[50] = s.render('Schematic. Threats named, not explained step by step.')

# ── 51 Privacy paradox ──────────────────────────────────────────────
s = Scene(51, 'Two good goals that pull against each other',
          'Five frames. 1, owner privacy: a tag that changes its identifier often shows a passer-by unrelated values at '
          'each place, and only the owner’s key links them. 2, the safety of the person carrying it: a tag that keeps '
          'travelling with someone — home, bus, office — should be noticed, which means recognising the same tag again. '
          '3, a balance between the two goals: unlinkable on one side, detectable on the other. 4, four illustrative '
          'design dials: how often the identifier rotates, how the tag behaves when separated from its owner, whether '
          'it plays a sound when moved, and how long a tag must travel with someone before an alert. 5, a note that this '
          'is a tension tuned by design choices, not an impossibility.',
          sub='Rotation hides a tag from strangers. Protection must still notice a tag that stays with you.')
s.f(1)
s.raw(panel(60, 160, 560, 300, 'purple', 1, 'Owner privacy', 'Strangers should not follow my tag'))
s.raw(id_chip(84, 284, 'K1 · 2C9E') + id_chip(254, 284, 'K2 · A417') + id_chip(424, 284, 'K3 · 51D0'))
s.raw(T(84, 362, 'café', 14, 600, '#475569') + T(254, 362, 'station', 14, 600, '#475569') + T(424, 362, 'office', 14, 600, '#475569'))
s.raw(eye(84, 412, 0.6, '#334155') + T(146, 418, 'a passer-by sees unrelated values', 16, 400, '#334155'))
s.raw(T(84, 446, 'only the owner’s key links them', 15, 700, '#6b21a8'))
s.f(2)
s.raw(panel(980, 160, 560, 300, 'teal', 2, 'The person carrying it', 'A tag that stays with me should be noticed'))
s.raw(person(1040, 262, 0.7, '#64748b'))
s.raw(tag(1080, 360, 14))
s.raw('<path d="M1120,400 C1220,330 1320,440 1500,350" fill="none" stroke="#0d9488" stroke-width="3" stroke-dasharray="7 7"/>')
for (x, y, lab, dy) in ((1180, 372, 'home', -18), (1330, 400, 'bus', 30), (1480, 356, 'office', -18)):
    s.raw(f'<circle cx="{x}" cy="{y}" r="9" fill="#0d9488"/>' + T(x, y + dy, lab, 14, 600, '#0f766e', 'middle'))
s.raw(T(1120, 446, 'the same tag, again and again', 16, 400, '#334155'))
s.f(3)
s.raw('<path d="M800,330 L760,400 L840,400 Z" fill="#334155"/>'
      '<path d="M660,330 L940,330" stroke="#334155" stroke-width="6" stroke-linecap="round"/>'
      '<path d="M680,330 L660,372 M680,330 L700,372 M920,330 L900,372 M920,330 L940,372" stroke="#64748b" stroke-width="2"/>'
      '<path d="M648,372 L712,372 M888,372 L952,372" stroke="#334155" stroke-width="5" stroke-linecap="round"/>')
s.raw(T(680, 400, 'unlinkable', 15, 700, '#6b21a8', 'middle') + T(920, 400, 'detectable', 15, 700, '#0f766e', 'middle'))
s.raw(T(800, 230, 'in tension', 24, 800, '#14213d', 'middle') + T(800, 262, 'tuned, not traded away', 16, 400, '#475569', 'middle'))
s.f(4)
s.raw(f'<rect x="60" y="486" width="1480" height="208" rx="18" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>')
s.raw(badge(102, 530, 4, 'slate', 24) + T(140, 539, 'Design dials (illustrative)', 22, 800, '#14213d'))
dials = [('Identifier rotation period', 'short: hard to follow', 'long: easy to link', 0.3),
         ('When separated from owner', 'near owner: private', 'separated: findable', 0.7),
         ('Sound when moved', 'silent', 'plays a sound', 0.75),
         ('Time together before an alert', 'short: early warning', 'long: fewer false alarms', 0.45)]
for i, (lab, l, r, at) in enumerate(dials):
    s.raw(slider(110 + i * 362, 590, 300, lab, l, r, at))
s.f(5)
s.raw(panel(60, 712, 1480, 104, 'amber', 5, 'A tension, not an impossibility', None, 20))
s.raw(T(140, 796, 'Every dial moves protection between the two goals. Designs give up some unlinkability mainly while a tag is away from its owner.', 16, 400, '#334155'))
scenes[51] = s.render()

# ── 52 Cross-platform alerts ─────────────────────────────────────────
s = Scene(52, 'Alerts across iPhone and Android',
          'Five frames. 1, trackers from different makers follow one industry specification for detecting unwanted '
          'trackers, and phones on both platforms — an iPhone on iOS 17.5 or later and an Android phone on Android 6.0 '
          'or later — can show an alert that an unknown tracker is moving with you; Apple and Google announced this in '
          'May 2024. 2, deployed: built into both platforms and working with trackers whose makers adopt the '
          'specification. 3, the standards track: an IETF working group is turning the work into standards; drafts '
          'change, so check their current status. 4, edge conditions in a red dashed box: a tag often near its owner, '
          'short trips, Bluetooth or location off or old software, trackers that do not follow the specification, and '
          'manual scans that see what is near now rather than what followed you. 5, no timing guarantee: an alert is a '
          'prompt to check, and no alert is not proof of safety.',
          sub='Since May 2024 both platforms alert about compatible trackers. The standard is still being written.')
s.f(1)
for i, lab in enumerate(['tracker A', 'tracker B', 'tracker C']):
    y = 220 + i * 92
    s.raw(tag(130, y, 30) + T(178, y + 6, lab, 15, 600, '#475569'))
    s.raw(f'<path d="M262,{y} L420,{315}" stroke="#94a3b8" stroke-width="2.5"/>')
s.raw(doc_icon(420, 220, 160, 200, 'DULT spec'))
s.raw('<path d="M500,220 L500,162 L975,162 L975,180 M775,162 L775,180" fill="none" stroke="#94a3b8" stroke-width="2.5"/>')
s.raw(phone(705, 180, 140, 270, '#f8fafc') + alert_sheet(718, 230, 114, 'Tracker\nmoving with\nyou'))
s.raw(T(775, 478, 'iPhone · iOS 17.5+', 15, 700, '#334155', 'middle'))
s.raw(phone(905, 180, 140, 270, '#f8fafc') + alert_sheet(918, 230, 114, 'Tracker\nmoving with\nyou'))
s.raw(T(975, 478, 'Android 6.0+', 15, 700, '#334155', 'middle'))
s.raw(callout(1100, 180, 440, 170, 'One specification, two platforms', 'Apple and Google wrote one industry\nspecification. Both platforms alert about\ncompatible trackers (May 2024).', 'blue', 1, 19, 16))
s.raw(T(130, 470, 'Trackers from makers that adopt it', 14, 400, '#475569'))
s.f(2)
s.raw(panel(60, 506, 470, 194, 'green', 2, 'Deployed', None, 21))
s.raw(lines(84, 600, ['Built into iOS 17.5+ and Android 6.0+', 'since May 2024. Works with trackers', 'whose makers adopt the specification.'], 15.5))
s.f(3)
s.raw(panel(555, 506, 470, 194, 'amber', 3, 'Standards track', None, 21))
s.raw(lines(579, 600, ['The IETF DULT working group is turning', 'the work into standards. Drafts change:', 'check current status. A draft is not a promise.'], 15.5))
s.f(4)
s.rect(1050, 380, 490, 320, 'hz', rx=14)
s.raw(badge(1084, 414, 4, 'red', 18) + T(1112, 421, 'When an alert may not come', 19, 800, '#b91c1c'))
s.raw(lines(1074, 458, ['• The tag is often near its owner', '• A short trip: not enough time together', '• Bluetooth or location off; old software', '• A tracker that does not follow the spec', '• A manual scan sees what is near now,', '\u00a0\u00a0\u00a0not what followed you'], 15.5, lh=36))
s.f(5)
s.raw(panel(60, 716, 1480, 100, 'slate', 5, 'No timing guarantee', None, 20))
s.raw(T(140, 798, 'Neither platform promises how soon an alert appears. An alert is a prompt to check; no alert is not proof of safety.', 16, 400, '#334155'))
scenes[52] = s.render('Versions as Apple and Google documented them in May 2024.')

# ── 53 Three people ─────────────────────────────────────────────────
s = Scene(53, 'Three people, three safe paths',
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
          sub='Safety first, then help. None of these paths asks anyone to confront, search or bypass.')
people = [
    ('The traveller', 'an alert on a trip', '#475569', [
        'Alert: an unknown tracker\nis moving with you',
        'Are you safe right now?\nIf not, get somewhere safe first.',
        'Innocent explanation? A companion’s\ntag in a shared bag or car.',
        'Not explained? Record the alert,\nuse its tools, get help before disabling.']),
    ('A family member at risk', 'an older relative, a teenager', '#0f766e', [
        'Worried someone knows\nwhere they go',
        'Tell a trusted person — for a child,\na grown-up they trust',
        'Make a plan with an advocate\nor a support service',
        'Record what is safe to record;\ndecide together whether to disable.']),
    ('An employee or executive', 'at work or travelling', '#1e3a8a', [
        'Alert at work or\nwhile travelling',
        'Tell security or HR as well as\nsomeone you trust',
        'The company can help: safer\nworkplace, travel and parking',
        'Its playbook: safety first, evidence,\nadvice. Never search colleagues’ things.']),
]
for i, (name, who, col, steps) in enumerate(people):
    s.f(i + 1)
    x = 60 + i * 500
    s.raw(person(x + 40, 168, 0.48, col))
    s.raw(T(x + 92, 206, name, 21, 800, '#14213d') + T(x + 92, 234, who, 15.5, 400, '#475569'))
    for j, st in enumerate(steps):
        y = 290 + j * 84
        s.raw(step_box(x, y, 470, 64, st, 'green' if j == 3 else 'slate'))
        if j < 3:
            s.raw(down(x + 235, y + 64, y + 84))
s.f(4)
s.raw(f'<rect x="60" y="636" width="1480" height="80" rx="14" fill="#fef2f2" stroke="#dc2626" stroke-width="3"/>')
s.raw(shield(84, 642, 0.88, '#dc2626'))
s.raw(T(160, 672, 'Consider your safety first.', 20, 800, '#991b1b'))
s.raw(T(160, 700, 'Disabling a tracker can alert the person who placed it. Decide when, and whether, with someone who can help.', 16, 400, '#334155'))
for i, lab in enumerate(['A person you trust', 'Local support services', 'Law enforcement', 'The platform’s safety guide']):
    x = 60 + i * 375
    s.raw(f'<rect x="{x}" y="736" width="355" height="72" rx="36" fill="#f0fdf4" stroke="#16a34a" stroke-width="2.5"/>')
    s.raw(T(x + 178, 779, lab, 17, 700, '#166534', 'middle'))
scenes[53] = s.render('Illustrative people. Not legal advice; local services and laws differ.')

# ── 54 Incident trail ───────────────────────────────────────────────
s = Scene(54, 'What can be kept, and what it can and cannot show',
          'Five frames on a timeline under a banner that is always shown: safety first; if in danger, contact local '
          'emergency services; disabling a tracker can alert the person who placed it. 1, the alert: screenshot it and '
          'any map it shows, and note the date and time. 2, the tag’s identity: if it is found, tapping it with an NFC '
          'phone shows its serial number. 3, your own notes: where and when it appeared, and who has had access to your '
          'bag, car or coat. 4, your accounts, when it is safe: who you share your location or items with, and your '
          'trusted devices, for example with Safety Check on iPhone. 5, the vendor and the police: police can ask the '
          'vendor for the account a tag is paired to, and Apple says it can provide paired-account details to valid '
          'requests; and what the evidence cannot show: a sighting is approximate, an alert can be wrong either way, and '
          'a serial number points to an account, not to the person who placed the tag.',
          sub='Collect only what you can collect safely. Evidence helps others act; it rarely proves who placed a tag.')
s.raw('<rect x="60" y="154" width="1480" height="54" rx="12" fill="#fef2f2" stroke="#dc2626" stroke-width="2.5"/>')
s.raw(T(84, 188, 'Safety first. If you are in danger, contact local emergency services. Disabling a tracker can alert the person who placed it.', 17, 700, '#991b1b'))
s.raw('<path d="M110,262 L1490,262" stroke="#cbd5e1" stroke-width="6" stroke-linecap="round"/>')
cards = [('The alert', ['Screenshot the alert and', 'any map it shows. Note', 'the date and time.'], 'amber'),
         ('The tag’s identity', ['If you find it, an NFC', 'phone tap shows its', 'serial number.'], 'blue'),
         ('Your own notes', ['Where and when it', 'appeared; who had access', 'to your bag, car or coat.'], 'slate'),
         ('Your accounts', ['When safe: who sees your', 'location or items; trusted', 'devices (Safety Check).'], 'purple'),
         ('Vendor and police', ['Police can ask the vendor', 'for the paired account;', 'Apple says it can provide it.'], 'green')]
for i, (t, body, col) in enumerate(cards):
    s.f(i + 1)
    cx = 200 + i * 300
    c, light, border = STEP[col]
    s.raw(badge(cx, 262, i + 1, col, 22))
    s.raw(f'<rect x="{cx - 138}" y="300" width="276" height="160" rx="12" fill="{light}" stroke="{border}" stroke-width="2"/>')
    s.raw(T(cx - 120, 334, t, 18, 800, c) + lines(cx - 120, 368, body, 15))
s.raw(panel(60, 490, 1480, 290, 'amber', None, 'What this evidence cannot show', None, 21))
s.raw(lines(90, 580, ['• A sighting is approximate: it is where a passer-by’s phone was, not where the tag is now.',
                      '• An alert can be wrong both ways: a false alarm, or silence when a tag is there (Scene 52).',
                      '• A serial number points to an account, not to the person who placed the tag.',
                      '• Laws and procedures differ by place. This lesson draws no legal conclusions.'], 17, lh=44))
scenes[54] = s.render('Steps follow Apple’s and Google’s published safety guidance; check the current versions.')

# ── 55 Mitigations ──────────────────────────────────────────────────
s = Scene(55, 'Proportionate protection: who can do what',
          'Five frames build a table of mitigations against five who-columns: a person, a household, an employer, the '
          'vendor and standards bodies. A filled dot means implements, a ring means supports. 1, consent before sharing '
          'a location, and regular reviews of who sees your location or items, are mainly for the person and household. '
          '2, hardening accounts with two-factor authentication, trusted-device reviews and recovery contacts: person '
          'and employer. 3, anti-abuse controls built into the product — alerts, a sound when moved, serial and NFC '
          'information, one account per tag: the vendor, supported by standards. 4, minimising metadata and '
          'standards with responsible disclosure: vendors and standards bodies. 5, a note that proportionate means the '
          'smallest control that addresses the risk, chosen with the person it protects.',
          sub='Each control has an owner. Proportionate means fitting the control to the risk — never watching the person you protect.')
cols = ['Person', 'Household', 'Employer', 'Vendor', 'Standards']
s.raw('<rect x="60" y="156" width="1480" height="52" rx="10" fill="#f1f5f9"/>')
s.raw(T(84, 189, 'Mitigation', 17, 800, '#14213d'))
for i, c in enumerate(cols):
    s.raw(T(784 + i * 168, 189, c, 17, 800, '#14213d', 'middle'))
rows = [
    (1, 'Consent before sharing a location', 'Ask and agree openly; write down how to stop', '●●○○ '),
    (1, 'Review who sees your location or items', 'For example Safety Check on iPhone', '●● ○ '),
    (2, 'Harden accounts', 'Two-factor, trusted devices, recovery contacts', '●○●○ '),
    (3, 'Anti-abuse controls in the product', 'Alerts, sound when moved, serial and NFC info, one account per tag', '   ●○'),
    (4, 'Minimise metadata', 'Keep less, for less time; aggregate where possible', '  ○●○'),
    (4, 'Standards and responsible disclosure', 'Cross-platform alert specifications; report flaws privately first', '○  ●●'),
]
for k, (fr, t, sub, marks) in enumerate(rows):
    s.f(fr)
    y = 214 + k * 84
    s.raw(f'<rect x="60" y="{y}" width="1480" height="78" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>')
    s.raw(T(84, y + 33, t, 18, 800, '#14213d') + T(84, y + 59, sub, 15, 400, '#475569'))
    for i, m in enumerate(marks):
        s.raw(dot(784 + i * 168, y + 39, m))
s.f(5)
s.raw(panel(60, 726, 1480, 90, 'green', 5, 'Proportionate', None, 20))
s.raw(dot(330, 774, '●') + T(350, 780, 'implements', 15, 600, '#334155') + dot(470, 774, '○') + T(490, 780, 'supports', 15, 600, '#334155'))
s.raw(T(610, 780, 'The smallest control that addresses the risk, chosen with the person it protects.', 16, 400, '#334155'))
scenes[55] = s.render('Who-columns are illustrative; organisations differ.')
