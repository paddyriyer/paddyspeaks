#!/usr/bin/env python3
"""Import the Taittirīya Upaniṣad witnesses, commentaries and parallel passages.

Re-runnable and auditable, like import_witnesses.py (the Īśā): it reads public
corpora checked out locally and writes `upanishads/taittiriya/edition/witnesses/`.
`text.json` is hand-maintained; check.py proves it against the base witness.

  python3 scripts/upanishads/import_taittiriya.py --yajuh <vishvAsa/vedAH_yajuH> --raw <sanskrit/raw_etexts>

Witnesses (docs/UPANISHADS-EDITION.md §Taittirīya):

  AS  Advaita Sharada (Śṛṅgeri), the mūla of Śaṅkara's Taittirīyopaniṣad-bhāṣya,
      mirrored in sanskrit/raw_etexts. BASE TEXT. Its numbered paragraphs (॥ N ॥)
      are the units; an anuvāka with no number is one unit.
  S   The Sāyaṇa-pāṭha of Taittirīya Āraṇyaka 7–9 with svara (vishvAsa), whose
      fifty-word divisions (॥ ०। ७। anuvāka। running ॥) match AS's units.
  Mv  The mūla printed with Madhva's bhāṣya (dvaitavedanta.in, via vishvAsa).

Commentaries: Śaṅkara (Advaita Sharada bhāṣya); Madhva; and, from the critical
edition "Taittirīyopaniṣat with six commentaries" (Melkote, via archive.org and
vishvAsa), Kūranārāyaṇa, Raṅgarāmānuja, Bhāradvāja-Rāmānuja, Rāmānanda and
Gopālānanda (the last a modern commentator).
"""
import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
import import_witnesses as IW  # noqa: E402
from textlib import phon  # noqa: E402

ROOT = IW.ROOT
ED = os.path.join(ROOT, 'upanishads', 'taittiriya', 'edition')
WIT = os.path.join(ED, 'witnesses')
TA = 'taittirIyam/sArasvata-vibhAgaH/AraNyakam/'
DEV = IW.DEV
dnum, clean_line, read = IW.dnum, IW.clean_line, IW.read


def write(name, obj):
    os.makedirs(WIT, exist_ok=True)
    with open(os.path.join(WIT, name), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('wrote', os.path.relpath(os.path.join(WIT, name), ROOT))


def is_valli(h):
    return 'वल्ली' in h


# ------------------------------------------------------------------ AS (base)
def advaita_sharada(raw):
    rel = 'vedAntam/advaitam/advaita-shAradA/mUla/Taitiriya.md'
    v = a = 0
    anu = {}
    for ln in read(os.path.join(raw, rel)).split('\n'):
        if ln.startswith('#'):
            h = ln.lstrip('#').strip()
            if is_valli(h):
                v += 1
                a = 0
            elif 'नुवाक' in h:
                a += 1
                anu[f'{v}.{a}'] = []
            continue
        if v and a and ln.strip() and not re.match(r'^इति .*भाष्यम्', ln.strip()):
            anu[f'{v}.{a}'].append(ln.strip())
    units, mantras = {}, {}
    for key, lines in anu.items():
        body = clean_line(' '.join(lines))
        # Śaṅkara's colophons, printed into the mūla file, are not text
        body = re.sub(r'इत(?:ि\s*|्य)[^॥।]*?(?:नुवाकभाष्यम्|भाष्यं? सम्पूर्णम्|सम्पूर्णम्|ोऽनुवाकः)\s*॥', '', body).strip()
        parts = re.split(r'॥\s*([०-९]+)\s*॥', body)
        segs = []
        for i in range(0, len(parts) - 1, 2):
            if parts[i].strip():
                segs.append(clean_line(parts[i]) + ' ॥')
        tail = parts[-1].strip()
        if tail:
            segs.append(clean_line(tail))
        for k, s in enumerate(segs, 1):
            units[f'{key}.{k}'] = [s]
        mantras[key] = segs
    return rel, mantras, units


# ------------------------------------------------- S: Sāyaṇa-pāṭha (svara)
def sayana_patha(yajuh):
    base = TA + 'sAyaNa-pAThaH/2_upaniShadaH/'
    files = {1: '07_taittirIyopaniShat.md', 2: '08_Ananda-vallI_brahmavid_Apnoti.md', 3: '09_bhRgu-vallI.md'}
    mantras, units, shanti = {}, {}, {}
    for v, fn in files.items():
        t = read(os.path.join(yajuh, base + fn)).split('+++', 2)[-1]
        t = re.sub(r'॥\s*\n\s*\n\s*(०।)', r'॥ \1', t)   # a division mark keyed as its own paragraph
        paras = re.split(r'\n\s*\n', t)
        for p in paras:
            p = clean_line(p)
            m = re.match(r'^([०-९]+)\s+(.*)$', p)
            if not m:
                continue
            if m.group(1) == '०':
                if v > 1 and f'{v}' not in shanti:
                    shanti[str(v)] = [m.group(2)]
                continue
            mk = re.search(r'॥\s*०।\s*[०-९]+।\s*([०-९]+)।\s*([०-९]+)॥', m.group(2))
            if not mk:
                continue
            a = dnum(mk.group(1))
            text = m.group(2)[:mk.start()].strip() + ' ॥'
            key = f'{v}.{a}'
            mantras.setdefault(key, []).append(text)
            units[f'{key}.{len(mantras[key])}'] = [text]
    return base, mantras, units, shanti


# ---------------------------------------------------------- Madhva (Mv)
def madhva(yajuh, as_mantras):
    """Madhva's mūla lines are the '## ' headings of the dvaitavedanta text, with
    his bhāṣya after each; the anuvāka a line belongs to is the one whose text
    shares most of its 8-letter shingles (titles that repeat a line are dropped)."""
    base = TA + 'sarva-prastutiH/05_taittirIyopaniShat/madhvaH/sarva-prastutiH/01_mUlam/'
    files = {1: '01_shixAvallI.md', 2: '02_brahmavallI.md', 3: '03_bhuguvallI.md'}
    targets = {k: phon(' '.join(v)) for k, v in as_mantras.items()}
    sh = lambda s: {s[i:i + 8] for i in range(max(0, len(s) - 7))}
    tsh = {k: sh(v) for k, v in targets.items()}
    mula, comm, got = {}, {}, {}
    SHANTI = phon('सह नाववतु सह नौ भुनक्तु सह वीर्यं करवावहै तेजस्वि नावधीतमस्तु मा विद्विषावहै')
    for v, fn in files.items():
        t = read(os.path.join(yajuh, base + fn))
        order = [k for k in tsh if k.startswith(f'{v}.')]
        ci = 0      # lines follow the text: never assign to an earlier anuvāka
        cur = None
        span = []   # anuvākas of the mūla passage awaiting its comment
        for block in re.split(r'\n(?=## )', t):
            if not block.startswith('## '):
                continue
            first, _, rest = block.partition('\n')
            line = first[3:].strip().strip('*').strip()
            pl = phon(re.sub(r'॥\s*[०-९]+\s*॥', '', line))
            if pl and (pl in SHANTI or SHANTI[:30] in pl):
                continue          # the śānti, kept apart in the edition
            s_ = sh(pl)
            hit = None
            if len(s_) >= 3:
                cands = order[ci:]
                scores = {k: len(s_ & tsh[k]) for k in cands}
                top = max(scores.values())
                if top >= 0.6 * len(s_):
                    hit = next(k for k in cands if scores[k] >= 0.9 * top)
            if hit:
                ci = order.index(hit)
                if pl not in got.get(hit, ''):
                    mula.setdefault(hit, []).append(clean_line(line))
                    got[hit] = got.get(hit, '') + pl
                cur = hit
                if hit not in span:
                    span.append(hit)
            # Madhva comments after a passage of several mūla lines, and his passages
            # straddle the edition's anuvākas: the comment belongs to every anuvāka
            # the passage since his previous comment covers.
            note = clean_line(rest)
            if note and (span or cur):
                for k in (span or [cur]):
                    comm[k] = (comm.get(k, '') + ' ' + note).strip()
                span = []
    # the dvaitavedanta text prints an anuvāka's first words as a title before the
    # full line: drop a line that the next line begins with
    for k, ls in mula.items():
        mula[k] = [x for i, x in enumerate(ls) if not (i + 1 < len(ls) and phon(ls[i + 1]).startswith(phon(x)))]
    return base, mula, comm


# --------------------------------------------------------- Śaṅkara bhāṣya
def shankara(raw):
    rel = 'vedAntam/advaitam/advaita-shAradA/bhAShya/taittirIya.md'
    v = a = 0
    out, intro = {}, []
    for ln in read(os.path.join(raw, rel)).split('\n'):
        if ln.startswith('#'):
            h = ln.lstrip('#').strip()
            if is_valli(h):
                v += 1
                a = 0
            elif 'नुवाक' in h and v:
                a += 1
            continue
        if not ln.strip():
            continue
        if v and a:
            out.setdefault(f'{v}.{a}', []).append(ln.strip())
        else:
            intro.append(ln.strip())
    return rel, {k: clean_line(' '.join(x)) for k, x in out.items()}, clean_line(' '.join(intro))


# ---------------------------------------- the six-commentary edition (Śrīvaiṣṇava)
ATTRIB = [('कूरनारायण', 'kuranarayana'), ('रङ्गरामानुज', 'rangaramanuja'), ('कौशिकगोविन्दराज', 'govindaraja'),
          ('भारद्वाजरामानुज', 'bharadvaja'), ('रामानन्द', 'ramananda'), ('गोपालानन्द', 'gopalananda')]
AUTHORS = {'कूर-नारायणः': 'kuranarayana', 'रङ्गरामानुजः': 'rangaramanuja', 'रङ्ग-रामानुजः': 'rangaramanuja',
           'भारद्वाज-रामानुजः': 'bharadvaja', 'रामानन्दः': 'ramananda', 'गोपालानन्दः': 'gopalananda'}


# The edition prints the other commentaries as running notes inside each section,
# marked by sigla; the colophons name them: आ.भा. = Rāmānanda's Ānandabhāṣya
# («इति भगवद्रामानन्दाचार्यविरचितं तैत्तिरीयोपनिषद्भाष्यं»), तै. भा. = Kauśika
# Govindarāja («इति कौशिकगोविन्दराजस्य कृतौ … तैत्तिरीयोपनिषद्व्याख्याने»),
# प्र. = Raṅgarāmānuja's Prakāśikā («श्रीमद्रङ्गरामानुजमुनिविरचिततैत्तिरीयोपनिषत्प्रकाशिका»).
SIGLA = re.compile(r'(आ\.\s*भा\.|तै\.\s*भा\.|(?<![ऀ-ॿ])प्र\.)')
SIGLUM = {'आ': 'ramananda', 'तै': 'govindaraja', 'प्र': 'rangaramanuja'}
BOUNDARY = re.compile(r'(?:।।|॥|·|तैत्तिरीयोपनिषत्|वल्ली|^)[\s\-–·0-9।]*$')
COLOPHON = re.compile(r'इति\s*[^।॥|]{0,30}?(कूरनारायणभाष्यम्|आनन्दभाष्यम्|प्रकाशिका|प्रतिपदार्थदीपिका|सुबोधिनी|तैत्तिरीयभाष्यम्)')
COLO_WHO = {'कूरनारायणभाष्यम्': 'kuranarayana', 'आनन्दभाष्यम्': 'ramananda', 'प्रकाशिका': 'rangaramanuja',
            'प्रतिपदार्थदीपिका': 'bharadvaja', 'सुबोधिनी': 'gopalananda', 'तैत्तिरीयभाष्यम्': 'govindaraja'}


def route(who, text):
    """Split one section's text into (commentator, passage): a siglum starts its
    commentator's passage (प्र. only at a boundary, so a citation like 'ब्र.वै. प्र.'
    is not taken for one); a colophon naming a commentator ends that commentator's
    passage, and the text before it is his."""
    segs, cur, pos = [], who, 0
    for m in SIGLA.finditer(text):
        sig = m.group(1)
        if sig.startswith('प्र') and not BOUNDARY.search(text[max(0, m.start() - 40):m.start()]):
            continue
        segs.append((cur, text[pos:m.start()]))
        cur, pos = SIGLUM[sig[:2] if sig.startswith('तै') else sig[:1] if sig.startswith('आ') else 'प्र'], m.end()
    segs.append((cur, text[pos:]))
    out = []
    for a, t in segs:
        p = 0
        for m in COLOPHON.finditer(t):
            c = COLO_WHO[m.group(1)]
            out.append((c, t[p:m.end()]))
            p = m.end()
        out.append((a, t[p:]))
    clean = lambda x: re.sub(r'^[\s\-–,·0-9।॥]+', '', x).strip()
    return [(a, clean(t)) for a, t in out if clean(t)]


def six_commentaries(yajuh):
    base = TA + 'sarva-prastutiH/05_taittirIyopaniShat/rAmAnujIyA/6-TikAH/2_TIkAH/'
    dirs = {1: '1_shixAvallI', 2: '2_AnandavallI', 3: '3_bhRguvallI'}
    out = {k: {} for k in set(AUTHORS.values()) | {'govindaraja'}}
    for v, d in dirs.items():
        for fn in sorted(os.listdir(os.path.join(yajuh, base + d))):
            m = re.match(r'^0*(\d+)\.md$', fn)
            if not m:
                continue
            key = f'{v}.{int(m.group(1))}'
            t = read(os.path.join(yajuh, base + d + '/' + fn))
            for sec in re.split(r'\n## ', t)[1:]:
                head_, _, body = sec.partition('\n')
                who = next((AUTHORS[k] for k in AUTHORS if head_.strip().startswith(k)), None)
                if not who:
                    continue
                # a section may run on into another commentary, which the edition
                # introduces with its own attribution: [श्रीकूरनारायणमुनिविरचितम्]
                body = clean_line(body.replace('\\', ''))
                parts = re.split(r'(\[\s*(?:श्री\s*)?[^\]]{0,40}?विरचित[^\]]*\])', body)
                cur = who
                for part in parts:
                    m = re.match(r'\[\s*(?:श्री\s*)?([^\]]*?)विरचित', part)
                    if m:
                        nm = re.sub(r'[\s-]', '', m.group(1))
                        cur = next((w for n, w in ATTRIB if n in nm), cur)
                        continue
                    if not part.strip():
                        continue
                    for who2, txt in route(cur, part):
                        out[who2][key] = (out[who2].get(key, '') + ' ' + txt).strip()
    return base, out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--yajuh', required=True)
    ap.add_argument('--raw', required=True)
    a = ap.parse_args()
    Y = {'repo': 'https://github.com/vishvAsa/vedAH_yajuH', 'branch': 'content', 'commit': IW.head(a.yajuh)}
    R = {'repo': 'https://github.com/sanskrit/raw_etexts', 'branch': 'master', 'commit': IW.head(a.raw)}

    rel, asm, asu = advaita_sharada(a.raw)
    write('AS-advaita-sharada.json', {'id': 'AS', **R, 'path': rel,
        'label': 'Advaita Sharada (Śṛṅgeri Śāradā Pīṭham), the mūla of Śaṅkara’s Taittirīyopaniṣad-bhāṣya, mirrored in sanskrit/raw_etexts',
        'note': 'Base text. Keyed by vallī.anuvāka; `units` keyed by vallī.anuvāka.paragraph (the numbered paragraphs ॥ N ॥ of the source).',
        'mantras': asm, 'units': asu})
    rel, sm, su, sh = sayana_patha(a.yajuh)
    write('S-sayana-patha.json', {'id': 'S', **Y, 'path': rel,
        'label': 'Taittirīya Āraṇyaka 7–9 in the Sāyaṇa-pāṭha, with svara, vishvAsa/vedAH_yajuH',
        'note': 'The accented witness. Its fifty-word divisions are the units; the anukramaṇī after each anuvāka (an index phrase, not text) is not imported.',
        'mantras': sm, 'units': su, 'shanti': sh})
    rel, mvm, mvc = madhva(a.yajuh, asm)
    write('Mv-madhva.json', {'id': 'Mv', **Y, 'path': rel,
        'label': 'The mūla of Madhva’s Taittirīyopaniṣad-bhāṣya (dvaitavedanta.in), vishvAsa/vedAH_yajuH',
        'note': 'Assigned to anuvākas by matching each mūla line to the base text.', 'mantras': mvm})
    write('madhva.json', {'id': 'Madhva', **Y, 'path': rel,
        'label': 'Madhva (Ānandatīrtha), Taittirīyopaniṣad-bhāṣya, dvaitavedanta.in text in vishvAsa/vedAH_yajuH',
        'note': 'By anuvāka; Madhva cites Purāṇic and other authorities by name.', 'mantras': mvc})
    rel, shb, shi = shankara(a.raw)
    write('shankara.json', {'id': 'Shankara', **R, 'path': rel,
        'label': 'Śaṅkara, Taittirīyopaniṣad-bhāṣya, Advaita Sharada (Śṛṅgeri) text, mirrored in sanskrit/raw_etexts',
        'url': 'https://advaitasharada.sringeri.net/', 'note': 'By anuvāka; the opening before the first anuvāka is `opening`.',
        'opening': shi, 'mantras': {k: {'bhashya': v, 'intro': ''} for k, v in shb.items()}})
    rel, six = six_commentaries(a.yajuh)
    names = {'kuranarayana': 'Kūranārāyaṇa', 'rangaramanuja': 'Raṅgarāmānuja', 'bharadvaja': 'Bhāradvāja-Rāmānuja (Pratipadārthadīpikā)',
             'ramananda': 'Rāmānanda', 'gopalananda': 'Gopālānanda (modern)', 'govindaraja': 'Kauśika Govindarāja (Mitākṣarā)'}
    for who, data in six.items():
        write(f'{who}.json', {'id': who, **Y, 'path': rel,
            'label': f'{names[who]}, commentary on the Taittirīyopaniṣad, in “Taittirīyopaniṣat with six commentaries” (Melkote; archive.org item 178-taittiriyopanisad-with-six-commentaries), via vishvAsa/vedAH_yajuH',
            'note': 'By anuvāka, as the edition prints it (OCR-derived text). Viśiṣṭādvaita. The edition runs the other commentaries on as notes marked by sigla (आ.भा. Rāmānanda, तै. भा. Govindarāja, प्र. Raṅgarāmānuja); the importer files each passage under its commentator, and text before a colophon under the commentator it names.', 'mantras': data})

    refs = []
    for f in sorted(os.listdir(ED)):
        if f.startswith('parallel-refs') and f.endswith('.json'):
            refs += [r for r in json.load(open(os.path.join(ED, f), encoding='utf-8'))['refs'] if r not in refs]
    write('parallels.json', {'note': 'Passages cited by the analysis, cut from their sources by import_witnesses.parallels(). The checker requires every phrase an analysis quotes from a parallel to occur here.',
                             **R, 'passages': IW.parallels(a.raw, refs)})


if __name__ == '__main__':
    main()
