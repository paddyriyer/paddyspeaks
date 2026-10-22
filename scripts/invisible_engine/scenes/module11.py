"""Module 11 scenes (79–84): the CISO operating model.
Run scripts/invisible_engine/build.py to write the SVGs.

Rules for this module (docs/INVISIBLE-ENGINE.md, docs/FROM-TAP-TO-TRACE.md Part X): every
control names who can implement it; no ranking of people, no productivity or surveillance
inference, no numeric risk scores or heatmaps; no legal conclusions; a safety policy never
becomes blanket surveillance of staff, and disabling a tracker can alert whoever placed it.
"""
from .svgkit import Scene
from .art import *

scenes = {}


# ── local helpers (Module 11 only) ──────────────────────────────────
def lines(x, y, rows, size=15.5, color='#334155', weight=400, lh=None):
    """Several left-aligned text lines."""
    lh = lh or round(size * 1.6)
    return ''.join(T(x, y + i * lh, r, size, weight, color) for i, r in enumerate(rows))


def office(x, y, w=150, h=210):
    """An office building with a grid of windows and a door."""
    out = (f'<rect x="{x + 4}" y="{y + 6}" width="{w}" height="{h}" rx="6" fill="#0f172a" opacity="0.12"/>'
           f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="#e2e8f0" stroke="#334155" stroke-width="3"/>'
           f'<rect x="{x - 8}" y="{y - 12}" width="{w + 16}" height="16" rx="4" fill="#334155"/>')
    cols, rows = 3, 4
    ww, wh = (w - 40) / cols, 26
    for r in range(rows):
        for c in range(cols):
            out += f'<rect x="{x + 14 + c * (ww + 6):.0f}" y="{y + 16 + r * 36}" width="{ww - 6:.0f}" height="{wh}" rx="3" fill="#bfdbfe" stroke="#475569" stroke-width="1.5"/>'
    out += f'<rect x="{x + w / 2 - 18:.0f}" y="{y + h - 44}" width="36" height="44" rx="3" fill="#64748b"/>'
    return out


def laptop(x, y, w=150):
    h = w * 0.6
    return (f'<rect x="{x + 10}" y="{y}" width="{w - 20}" height="{h:.0f}" rx="8" fill="#1f2937"/>'
            f'<rect x="{x + 18}" y="{y + 8}" width="{w - 36}" height="{h - 18:.0f}" rx="4" fill="#e0f2fe"/>'
            f'<path d="M{x},{y + h + 14:.0f} L{x + 10},{y + h:.0f} L{x + w - 10},{y + h:.0f} L{x + w},{y + h + 14:.0f} Z" fill="#475569"/>')


def owner(x, y, text, color='slate'):
    """A small 'who implements it' pill; returns (svg, right edge)."""
    c, light, border = STEP[color]
    w = max(44, 26 + len(text) * 8.2)
    return (f'<rect x="{x}" y="{y}" width="{w:.0f}" height="26" rx="13" fill="#ffffff" stroke="{c}" stroke-width="2"/>'
            + T(x + w / 2, y + 18, text, 13.5, 700, c, 'middle')), x + w


def owners(x, y, names, color='slate'):
    out = ''
    for n in names:
        svg, right = owner(x, y, n, color)
        out += svg
        x = right + 8
    return out


def pill(x, y, text, color):
    c, light, border = STEP[color]
    w = 24 + len(text) * 7.9
    return (f'<rect x="{x}" y="{y}" width="{w:.0f}" height="26" rx="13" fill="{light}" stroke="{border}" stroke-width="2"/>'
            + T(x + w / 2, y + 18, text, 13.5, 700, c, 'middle'))


def xmark(x, y, r=13, color='#dc2626'):
    return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="{color}"/>'
            f'<path d="M{x - r * 0.42:.0f},{y - r * 0.42:.0f} L{x + r * 0.42:.0f},{y + r * 0.42:.0f} M{x + r * 0.42:.0f},{y - r * 0.42:.0f} L{x - r * 0.42:.0f},{y + r * 0.42:.0f}" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/>')


def tick(x, y, r=13, color='#16a34a'):
    return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="{color}"/>'
            f'<path d="M{x - r * 0.45:.0f},{y + 1} L{x - r * 0.1:.0f},{y + r * 0.38:.0f} L{x + r * 0.5:.0f},{y - r * 0.38:.0f}" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>')


# ── 79 Enterprise boundary map ──────────────────────────────────────
s = Scene(79, 'Where the company’s authority stops',
          'Five frames. 1, inside a thick company boundary: the office, a company laptop with an asset tag, a '
          'corporate-managed phone and the company’s managed cloud account; the company controls these directly. 2, '
          'outside the boundary, two people: an employee, whose body, home and personal phone are their own, and a '
          'visitor wearing a visitor badge and carrying their own bag. 3, further out, the vendors’ finder networks and '
          'their relays and accounts, run by the vendors, which no company can see inside; and the wireless '
          'environment, radio that reaches everyone and that nobody owns. 4, a privately owned tracker on the '
          'visitor’s bag: not the company’s; it cannot read it or switch it off, only advise and support. 5, four '
          'bands of authority: controls directly (company property, managed devices and accounts); can set by policy '
          '(managed phone settings, procurement terms, visitor rules); can only advise and support (personal phones, '
          'personal accounts, private trackers); cannot reach (vendor networks, except through procurement and legal '
          'requests).',
          sub='Most of a company’s leverage is over its own assets, accounts and processes — not over the networks.')
s.f(1)
s.rect(60, 160, 700, 440, 'bound', rx=18)
s.raw(T(84, 198, 'The company', 21, 800, '#14213d') + T(84, 224, 'controls these directly', 15.5, 600, '#15803d'))
s.raw(office(92, 280, 140, 210))
s.raw(T(162, 528, 'office', 15, 700, '#334155', 'middle'))
s.raw(laptop(262, 360, 150))
s.raw(tag(428, 344, 16))
s.raw(T(337, 498, 'company laptop', 15, 700, '#334155', 'middle') + T(337, 518, '+ asset tag', 14.5, 400, '#475569', 'middle'))
s.raw(phone(452, 300, 86, 170, '#dcfce7'))
s.raw(T(495, 498, 'managed phone', 15, 700, '#334155', 'middle'))
s.raw(cloud(560, 300, 180, None))
s.raw(T(650, 366, 'managed', 15, 700, '#14213d', 'middle') + T(650, 386, 'account', 15, 700, '#14213d', 'middle'))
s.raw(T(650, 434, 'company-owned,', 14.5, 400, '#475569', 'middle') + T(650, 454, 'strong sign-in', 14.5, 400, '#475569', 'middle'))
s.raw(T(84, 572, 'Company property · managed devices · managed accounts', 16, 700, '#166534'))
s.f(2)
s.raw(person(850, 190, 0.9, '#475569', phone_in_hand=True))
s.raw(T(850, 410, 'employee', 16, 800, '#14213d', 'middle'))
s.raw(lines(800, 436, ['body, home and', 'personal phone', 'are their own'], 14.5))
s.raw(person(1045, 190, 0.9, '#0f766e'))
s.raw(id_badge(1012, 248, 44, 'VISITOR', '#b45309'))
s.raw(suitcase(1090, 330, 0.36, '#64748b'))
s.raw(T(1045, 410, 'visitor', 16, 800, '#14213d', 'middle'))
s.raw(lines(1000, 436, ['their own bag,', 'their own phone'], 14.5))
s.f(3)
s.rect(1180, 160, 360, 290, 'bound', rx=18)
s.raw(T(1204, 196, 'Vendor finder networks', 19, 800, '#14213d'))
s.raw(cloud(1220, 226, 280, None))
s.raw(T(1360, 300, 'relays, accounts', 16, 700, '#14213d', 'middle'))
s.raw(lines(1204, 400, ['Run by Apple, Google, Samsung, Life360.', 'No company sees inside.'], 14.5))
s.raw('<rect x="1180" y="470" width="360" height="130" rx="14" fill="#eff6ff" stroke="#93c5fd" stroke-width="2"/>')
s.raw(waves(1206, 530, 3, '#2563eb', 1.0))
s.raw(T(1280, 512, 'The wireless environment', 17, 800, '#14213d'))
s.raw(lines(1280, 540, ['radio reaches everyone;', 'nobody owns the air'], 14.5))
s.raw(T(1206, 588, 'Arcs are illustrative.', 13.5, 400, '#475569', italic=True))
s.f(4)
s.raw(tag(1128, 352, 17))
s.raw('<rect x="1104" y="328" width="48" height="48" rx="8" fill="none" stroke="#b45309" stroke-width="2.5" stroke-dasharray="5 4"/>')
s.raw(callout(800, 500, 360, 100, 'A private tracker', 'Not the company’s. It cannot read it\nor switch it off: advise and support.', 'amber', None, 18, 15))
s.f(5)
bands = [('Controls directly', ['company property,', 'managed devices and accounts'], 'green'),
         ('Can set by policy', ['managed phone settings,', 'procurement terms, visitor rules'], 'blue'),
         ('Can advise and support', ['personal phones and accounts,', 'privately owned trackers'], 'amber'),
         ('Cannot reach', ['vendor networks — only through', 'procurement and legal requests'], 'slate')]
for i, (t, body, col) in enumerate(bands):
    x = 60 + i * 375
    c, light, border = STEP[col]
    s.raw(f'<rect x="{x}" y="636" width="355" height="176" rx="14" fill="{light}" stroke="{border}" stroke-width="2"/>')
    s.raw(badge(x + 34, 676, i + 1, col, 20))
    s.raw(T(x + 64, 683, t, 18, 800, c))
    s.raw(lines(x + 22, 726, body, 15.5))
scenes[79] = s.render('Schematic. Organisations differ; the bands, not the drawing, are the point.')


# ── 80 STRIDE + LINDDUN ──────────────────────────────────────────────
s = Scene(80, 'Two lenses: security threats and privacy threats',
          'Four frames. 1, the STRIDE security lens: spoofing, tampering, repudiation, information disclosure, denial '
          'of service, elevation of privilege. 2, the LINDDUN privacy lens: linking, identifying, non-repudiation, '
          'detecting, data disclosure, unawareness, non-compliance. 3 and 4, a table that applies both lenses to five '
          'attack surfaces, each with an honest evidence label rather than a score: item tags (spoofed broadcasts or '
          'sightings, firmware tampering and radio jamming; linking sightings by time and route, and a hidden tag '
          'identifying a person who is unaware; research and documented); the finder network and relay (invented or '
          'replayed reports, upload metadata; linking across uploads, and data disclosure limited by end-to-end '
          'encryption; research and documented design); accounts (takeover by phishing, stale or coerced shares; the '
          'account identifies the owner, and sharing without consent; documented); NFC and RFID badges (copied '
          'static-ID badges and entry with them; door logs linking movements, and detecting who is in a room; '
          'documented, long-standing); payment terminals (altered terminals and skimmers, relay; a static card '
          'number linking payments and identifying the cardholder; documented and research).',
          sub='Name the threat, the surface and how strong the evidence is. No heatmap: a colour per cell would claim precision nobody has.')
stride = ['Spoofing', 'Tampering', 'Repudiation', 'Information disclosure', 'Denial of service', 'Elevation of privilege']
linddun = ['Linking', 'Identifying', 'Non-repudiation', 'Detecting', 'Data disclosure', 'Unawareness', 'Non-compliance']
s.f(1)
s.raw(panel(60, 158, 720, 172, 'blue', None, 'STRIDE · security', None, 20))
for i, t in enumerate(stride):
    x = 84 + (i % 3) * 228
    y = 214 + (i // 3) * 46
    s.raw(f'<rect x="{x}" y="{y}" width="216" height="34" rx="8" fill="#ffffff" stroke="#93c5fd" stroke-width="2"/>')
    s.raw(T(x + 12, y + 23, t[0], 16, 800, '#1d4ed8') + T(x + 32, y + 23, t, 14.5, 600, '#14213d'))
s.f(2)
s.raw(panel(820, 158, 720, 172, 'purple', None, 'LINDDUN · privacy', None, 20))
for i, t in enumerate(linddun):
    x = 844 + (i % 4) * 172
    y = 214 + (i // 4) * 46
    s.raw(f'<rect x="{x}" y="{y}" width="162" height="34" rx="8" fill="#ffffff" stroke="#c4b5fd" stroke-width="2"/>')
    s.raw(T(x + 12, y + 23, t, 14.5, 600, '#14213d'))
cols = [(60, 'Surface'), (300, 'Security (STRIDE)'), (790, 'Privacy (LINDDUN)'), (1280, 'Evidence')]
rows = [
    (3, 'Item tags', ['Spoofing: fake broadcasts or sightings', 'Tampering: firmware · Denial: radio jamming'],
     ['Linking: sightings tied by time and route', 'Identifying + Unawareness: a hidden tag'], [('research', 'teal'), ('documented', 'blue')]),
    (3, 'Finder network\nand relay', ['Spoofing: invented or replayed reports', 'Information disclosure: upload metadata'],
     ['Linking: metadata across uploads', 'Data disclosure: limited by end-to-end encryption'], [('research', 'teal'), ('documented', 'blue')]),
    (4, 'Accounts', ['Spoofing: account takeover by phishing', 'Elevation: stale or coerced shares'],
     ['Identifying: the account names the owner', 'Non-compliance: sharing without consent'], [('documented', 'blue')]),
    (4, 'NFC and RFID\nbadges', ['Spoofing: copied static-ID badges', 'Elevation: entry with a copied badge'],
     ['Linking: door logs trace movements', 'Detecting: who is in which room'], [('documented', 'blue'), ('long-standing', 'slate')]),
    (4, 'Payment\nterminals', ['Tampering: altered terminals, skimmers', 'Spoofing: relay of a live exchange'],
     ['Linking: a static card number links payments', 'Identifying: card to cardholder'], [('documented', 'blue'), ('research', 'teal')]),
]
s.f(3)
s.raw('<rect x="60" y="350" width="1480" height="44" rx="10" fill="#f1f5f9"/>')
for x, t in cols:
    s.raw(T(x + 20, 379, t, 16, 800, '#14213d'))
for k, (fr, surf, sec, priv, ev) in enumerate(rows):
    s.f(fr)
    y = 400 + k * 84
    s.raw(f'<rect x="60" y="{y}" width="1480" height="78" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>')
    srows = surf.split('\n')
    s.raw(lines(80, y + (32 if len(srows) == 2 else 44), srows, 16.5, '#14213d', 800, 24))
    s.raw(lines(320, y + 32, sec, 14.5, '#1e3a8a', 400, 24))
    s.raw(lines(810, y + 32, priv, 14.5, '#4c1d95', 400, 24))
    px = 1300
    for name, col in ev:
        s.raw(pill(px, y + 26, name, col))
        px += 36 + len(name) * 7.9
scenes[80] = s.render('No scores. Evidence in words: documented, research, long-standing.')


# ── 81 Risk register ─────────────────────────────────────────────────
s = Scene(81, 'A risk register with its reasons showing',
          'Three frames, each adding one worked row of a risk register as a card with eleven fields: threat, actor, '
          'preconditions, impact, likelihood basis, controls, detection, incident owner, residual risk, evidence '
          'confidence and privacy or legal review. 1, a company tag on a laptop registered to a personal account, so a '
          'leaver keeps location access; owner IT asset management; residual risk low once re-registered. 2, an unknown '
          'tracker found in an executive’s bag; owner executive protection with HR and legal; safety-first playbook; '
          'residual risk stated plainly because alerts can miss or be late. 3, a cloned static-ID badge used to open a '
          'door; owner physical security; move to challenge-response credentials; relay remains possible in principle. '
          'Likelihood is given as its basis in words, not as a number.',
          sub='Each field answers a question someone will ask later. Likelihood is a reason, not a number.')
fields = ['Threat', 'Actor', 'Preconditions', 'Impact', 'Likelihood basis', 'Controls', 'Detection',
          'Incident owner', 'Residual risk', 'Evidence confidence', 'Privacy / legal review']
cards = [
    ('Company tag on a laptop', 'teal', [
        'tag on a personal account; leaver keeps access',
        'a departing employee — no malice needed',
        'tags bought ad hoc; no offboarding step',
        'laptop location visible outside the company',
        'common where tags are bought ad hoc',
        'register to a managed account; offboarding',
        'quarterly review of who shares company tags',
        'IT asset management',
        'low once re-registered',
        'vendor-documented: one account per tag',
        'tags locate assets, never people — in policy']),
    ('Unknown tracker, executive’s bag', 'red', [
        'someone learns the executive’s routine',
        'unknown; insider or stranger',
        'access to the bag; alerts need time and a phone',
        'the person’s safety first; company exposure',
        'documented cases elsewhere; no local data',
        'safety-first playbook; travel briefings',
        'the person’s own phone alert; offered checks',
        'executive protection with HR and legal',
        'alerts can miss or be late — said plainly',
        'platform-documented alerts and their limits',
        'person’s consent first; legal before police']),
    ('Cloned static-ID badge', 'blue', [
        'a door opened with a copied card number',
        'anyone briefly near the badge with a reader',
        '125 kHz static-ID cards still in use',
        'unauthorised entry; log names the wrong person',
        'widely documented weakness (Scene 21)',
        'challenge-response credentials; PIN at key doors',
        'review of door events that cannot both be true',
        'physical security',
        'relay still possible in principle',
        'documented, long-standing',
        'door logs are personal data — keep them briefly']),
]
for i, (title, col, vals) in enumerate(cards):
    s.f(i + 1)
    x = 60 + i * 505
    c, light, border = STEP[col]
    s.raw(f'<rect x="{x}" y="158" width="470" height="652" rx="14" fill="#ffffff" stroke="{border}" stroke-width="2.5"/>')
    s.raw(f'<rect x="{x}" y="158" width="470" height="54" rx="14" fill="{light}"/>')
    s.raw(f'<rect x="{x}" y="196" width="470" height="16" fill="{light}"/>')
    s.raw(badge(x + 30, 185, i + 1, col, 17) + T(x + 56, 192, title, 18, 800, c))
    for j, (f, v) in enumerate(zip(fields, vals)):
        y = 240 + j * 52
        s.raw(T(x + 18, y, f, 13.5, 800, c) + T(x + 18, y + 22, v, 14.5, 400, '#1f2937'))
scenes[81] = s.render('Worked examples; re-rate every row for your own organisation.')


# ── 82 Identity governance ───────────────────────────────────────────
s = Scene(82, 'Accounts first: company tags on company accounts',
          'Five frames. 1, two separate worlds: the company’s managed account holds company tags, managed phones and '
          'laptops; the person’s own account holds their own phone and their own tags; the two are never mixed. 2, '
          'minimum necessary sharing: a company tag is shared only with the people whose role needs it, and personal '
          'locations are never shared with the company. 3, strong sign-in: security keys or multi-factor '
          'authentication where available, and limits on who may enrol new devices. 4, trusted-device review and '
          'rotation: review the trusted devices regularly and rotate keys and credentials when people or devices '
          'change. 5, deprovisioning: when someone leaves, remove their shares, move company tags off any account they '
          'control, and revoke their devices; each step names who does it.',
          sub='Zero trust for a finder network starts with which account owns which tag.')
s.f(1)
s.rect(60, 158, 700, 262, 'bound', rx=18)
s.raw(T(84, 194, 'Company’s managed account', 19, 800, '#14213d'))
s.raw(cloud(84, 214, 200, None) + T(184, 278, 'managed', 15, 700, '#14213d', 'middle'))
s.raw(tag(352, 268, 22) + tag(410, 268, 22))
s.raw(T(381, 318, 'company tags', 14.5, 600, '#334155', 'middle'))
s.raw(phone(486, 206, 70, 140, '#dcfce7') + T(521, 370, 'managed', 14, 600, '#334155', 'middle') + T(521, 388, 'phone', 14, 600, '#334155', 'middle'))
s.raw(laptop(596, 252, 136) + T(664, 372, 'laptop', 14, 600, '#334155', 'middle'))
s.raw('<rect x="840" y="158" width="700" height="262" rx="18" fill="#f8fafc" stroke="#94a3b8" stroke-width="2.5"/>')
s.raw(T(864, 194, 'The person’s own account', 19, 800, '#14213d'))
s.raw(cloud(864, 214, 200, None) + T(964, 278, 'personal', 15, 700, '#14213d', 'middle'))
s.raw(phone(1150, 206, 70, 140, '#e0f2fe') + T(1185, 370, 'own phone', 14, 600, '#334155', 'middle'))
s.raw(tag(1300, 268, 22) + T(1300, 318, 'own tag', 14.5, 600, '#334155', 'middle'))
s.raw(T(1420, 262, 'theirs,', 15, 600, '#475569', 'middle') + T(1420, 284, 'not the', 15, 600, '#475569', 'middle') + T(1420, 306, 'company’s', 15, 600, '#475569', 'middle'))
s.raw(f'<rect x="770" y="248" width="60" height="64" rx="8" fill="#fef2f2" stroke="#dc2626" stroke-width="2"/>')
s.raw(T(800, 274, 'never', 13.5, 800, '#b91c1c', 'middle') + T(800, 296, 'mix', 13.5, 800, '#b91c1c', 'middle'))
steps = [
    (2, 'Minimum sharing', ['Share a company tag only', 'with the roles that need it.', 'Personal locations are never', 'shared with the company.'], ['IT', 'team lead'], 'blue'),
    (3, 'Strong sign-in', ['Security keys or multi-factor', 'where available; limits on', 'who may enrol a new', 'device to the account.'], ['IT / identity'], 'purple'),
    (4, 'Review and rotate', ['Review trusted devices', 'every quarter; rotate keys', 'and credentials when people', 'or devices change.'], ['IT / identity'], 'teal'),
    (5, 'Deprovision leavers', ['Remove their shares; move', 'company tags off accounts', 'they control; revoke their', 'devices.'], ['HR', 'IT'], 'amber'),
]
for i, (fr, t, body, who, col) in enumerate(steps):
    s.f(fr)
    x = 60 + i * 375
    c, light, border = STEP[col]
    s.raw(f'<rect x="{x}" y="446" width="355" height="364" rx="14" fill="{light}" stroke="{border}" stroke-width="2"/>')
    s.raw(badge(x + 34, 486, fr, col, 20) + T(x + 64, 493, t, 19, 800, c))
    s.raw(lines(x + 22, 548, body, 16, lh=30))
    s.raw(T(x + 22, 712, 'Who does it', 13.5, 800, '#475569'))
    s.raw(owners(x + 22, 726, who, col))
scenes[82] = s.render('Follows zero-trust principles (NIST SP 800-207); controls depend on what each vendor offers.')


# ── 83 Unwanted-tracker safety policy ────────────────────────────────
s = Scene(83, 'A tracker safety policy that protects people without watching them',
          'Five frames. 1, notices: visitors and employees are told that company tags locate assets, never people, and '
          'how to report a tag that is not theirs; facilities and security with communications. 2, executive travel: '
          'briefings, bag and vehicle checks offered with consent, and alerts left on the phones they carry; travel '
          'security. 3, discreet escalation: a private route to security and HR, no public naming, and safety first '
          'because disabling a tracker can alert whoever placed it. 4, voluntary support and due process: advocate '
          'referral, time and practical help, fair investigation with legal review, and nobody confronts a suspected '
          'stalker on the employee’s behalf. 5, what the policy must not do: no blanket location tracking of staff, no '
          'constant scanning of people, no reading of personal phones in the name of privacy protection; scanning, if '
          'any, is limited to restricted areas after legal and works-council review.',
          sub='The aim is a safe person, not a watched one.')
panels = [
    (1, 'Notices', ['Visitors and staff are told: company', 'tags locate assets, never people.', 'How to report a tag that is not theirs.'], ['facilities', 'security', 'comms'], 'blue'),
    (2, 'Executive travel', ['Briefings before trips. Bag and', 'vehicle checks offered, with consent.', 'Alerts left on the phones they carry.'], ['travel security'], 'teal'),
    (3, 'Discreet escalation', ['A private route to security and HR.', 'No public naming. Safety first:', 'disabling can alert whoever placed it.'], ['security', 'HR'], 'amber'),
    (4, 'Support and due process', ['Advocate referral, time, practical help.', 'Fair investigation with legal review.', 'Nobody confronts on the person’s behalf.'], ['HR', 'legal'], 'green'),
]
for i, (fr, t, body, who, col) in enumerate(panels):
    s.f(fr)
    x = 60 + (i % 2) * 510
    y = 158 + (i // 2) * 330
    c, light, border = STEP[col]
    s.raw(f'<rect x="{x}" y="{y}" width="490" height="310" rx="14" fill="{light}" stroke="{border}" stroke-width="2"/>')
    s.raw(badge(x + 36, y + 40, fr, col, 22) + T(x + 70, y + 48, t, 21, 800, c))
    s.raw(lines(x + 24, y + 108, body, 16.5, lh=32))
    s.raw(T(x + 24, y + 236, 'Who does it', 13.5, 800, '#475569'))
    s.raw(owners(x + 24, y + 250, who, col))
s.f(5)
s.raw('<rect x="1100" y="158" width="440" height="640" rx="14" fill="#fef2f2" stroke="#dc2626" stroke-width="3"/>')
s.raw(T(1124, 200, 'What it must not do', 21, 800, '#991b1b'))
s.raw(eye(1440, 186, 0.9, '#991b1b'))
s.raw('<path d="M1434,170 L1516,204" stroke="#dc2626" stroke-width="5" stroke-linecap="round"/>')
nots = [['Track where staff go,', 'all the time'], ['Scan people constantly', 'for radio signals'], ['Read personal phones', 'or personal accounts'], ['Call any of this', '“privacy protection”']]
for k, rows_ in enumerate(nots):
    y = 260 + k * 92
    s.raw(xmark(1138, y + 4) + lines(1164, y + 10, rows_, 16.5, '#1f2937', 600, 26))
s.raw('<rect x="1120" y="636" width="400" height="144" rx="10" fill="#ffffff" stroke="#fca5a5" stroke-width="2"/>')
s.raw(lines(1138, 670, ['If any scanning: restricted', 'areas only, data minimised, after', 'legal and works-council review.'], 15.5, '#334155', 400, 26))
s.raw(owners(1138, 744, ['legal', 'security'], 'red'))
scenes[83] = s.render('Policy outline, not legal advice. Follow local law and labour rules.')


# ── 84 30/90/180-day roadmap ─────────────────────────────────────────
s = Scene(84, 'The first 180 days: decide, fix, build in',
          'Four frames. 1, days 0 to 30, decide: name owners for tracker policy, company asset tags and safety cases; '
          'write the safety-first playbook with HR and legal; brief staff on reading alerts; check that endpoint '
          'baselines do not switch off Bluetooth detection on managed phones without a reason. 2, days 31 to 90, '
          'inventory and fix: list company tags and re-register any on personal accounts; add a tracker step to '
          'offboarding; assess vendors and the technical estate; run an incident tabletop. 3, days 91 to 180, build in: '
          'procurement criteria, audits of sharing and offboarding, recurring quarterly reviews, and a cryptographic '
          'inventory of long-lived readers and devices. 4, metrics: measure capabilities — share of company tags on '
          'managed accounts, share of leavers with the tracker step closed, time from a report to a safety plan, share '
          'of doors on modern credentials; never measure or rank people, count scans of staff, or set a target for '
          'incidents found.',
          sub='Each step has an owner. Each metric measures a capability, never a person.')
phases = [
    (1, 'Days 0–30 · decide', 'blue', [
        ('Name owners: policy, company tags, safety cases', ['security lead']),
        ('Safety-first playbook, with advocate referral', ['HR', 'legal']),
        ('Teach staff to read tracker alerts', ['security', 'comms']),
        ('Bluetooth detection not switched off on managed phones', ['IT'])]),
    (2, 'Days 31–90 · inventory and fix', 'teal', [
        ('List company tags; re-register to managed accounts', ['IT asset mgmt']),
        ('Tracker and sharing step in offboarding', ['HR', 'IT']),
        ('Assess vendors and the technical estate', ['security', 'procurement']),
        ('Incident tabletop: a tag found on a person', ['security', 'HR', 'legal'])]),
    (3, 'Days 91–180 · build in', 'purple', [
        ('Security and privacy criteria in procurement', ['procurement']),
        ('Audit sharing and offboarding', ['internal audit']),
        ('Quarterly reviews become routine', ['IT', 'security']),
        ('Crypto inventory of long-lived readers (Module 10)', ['security arch.'])]),
]
for i, (fr, t, col, items) in enumerate(phases):
    s.f(fr)
    x = 60 + i * 500
    c, light, border = STEP[col]
    s.raw(f'<rect x="{x}" y="158" width="480" height="452" rx="14" fill="{light}" stroke="{border}" stroke-width="2"/>')
    s.raw(badge(x + 34, 196, fr, col, 20) + T(x + 64, 203, t, 19, 800, c))
    for j, (txt, who) in enumerate(items):
        y = 240 + j * 92
        s.raw(f'<rect x="{x + 16}" y="{y}" width="448" height="80" rx="10" fill="#ffffff" stroke="{border}" stroke-width="1.5"/>')
        s.raw(T(x + 30, y + 30, txt, 14.5, 600, '#14213d'))
        s.raw(owners(x + 30, y + 44, who, col))
    if i < 2:
        s.raw(f'<path d="M{x + 482},384 L{x + 498},384" stroke="#94a3b8" stroke-width="3"/>')
s.f(4)
s.raw(panel(60, 630, 860, 182, 'green', 4, 'Measure capabilities', None, 20))
good = ['Company tags on managed accounts (%)', 'Leavers with the tracker step closed (%)',
        'Time from a report to a safety plan', 'Doors on modern credentials (%)']
for k, g in enumerate(good):
    x = 84 + (k % 2) * 420
    y = 742 + (k // 2) * 44
    s.raw(tick(x + 12, y - 5, 11) + T(x + 32, y, g, 15, 600, '#14213d'))
s.raw('<rect x="940" y="630" width="600" height="182" rx="18" fill="#fef2f2" stroke="#fca5a5" stroke-width="2"/>')
s.raw(T(964, 674, 'Never measure', 20, 800, '#991b1b'))
bad = ['People, ranked or scored', 'How many staff were scanned', 'A target for incidents found']
for k, b in enumerate(bad):
    y = 712 + k * 34
    s.raw(xmark(976, y - 5, 11) + T(996, y, b, 15, 600, '#14213d'))
scenes[84] = s.render('Follows the roadmap in From Tap to Trace, Part X. Owners are typical; organisations differ.')
