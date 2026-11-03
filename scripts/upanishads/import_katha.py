#!/usr/bin/env python3
"""Import the Kaṭha Upaniṣad witnesses, commentaries and parallel passages.

Re-runnable and auditable, like import_taittiriya.py: it reads public corpora
checked out locally and writes `upanishads/katha/edition/witnesses/`.
`text.json` is hand-maintained; check.py proves it against the base witness.

  python3 scripts/upanishads/import_katha.py --yajuh <vishvAsa/vedAH_yajuH> --raw <sanskrit/raw_etexts>

(the vedAH_yajuH checkout needs `kAThakam/AraNyakam/kaThopaniShat/`).

Records are mantras keyed adhyāya.vallī.mantra ("1.2.23"); vallīs "1.1" … "2.3".

Witnesses (docs/UPANISHADS-EDITION.md § The Kaṭha):

  AS  Advaita Sharada (Śṛṅgeri), the mūla of Śaṅkara's Kaṭhopaniṣad-bhāṣya, in
      sanskrit/raw_etexts. BASE TEXT. ꣳ (the Vedic anusvāra sign) is read as ं.
  G   GRETIL Katha-Upanisad (after Olivelle, The Early Upaniṣads, 1998), in
      sanskrit/raw_etexts; references KaU_vallī.verse with the vallīs numbered 1–6.
  V   The mūla in vishvAsa/vedAH_yajuH (kAThakam/AraNyakam/kaThopaniShat/mUlam.md).
  Mv  The mūla printed with Madhva's bhāṣya (dvaitavedanta.in, via vishvAsa); it
      groups verses differently, so it is collated vallī by vallī.

Commentaries: Śaṅkara (Advaita Sharada bhāṣya), Madhva (dvaitavedanta.in text),
Raṅgarāmānuja's Prakāśikā (the 1948 edition, OCR, via vishvAsa). The modern
commentaries in the same folder (Vaṅgīpura Vāsudeva; the 45th Ahobila yati) are
not used.
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
ED = os.path.join(ROOT, 'upanishads', 'katha', 'edition')
WIT = os.path.join(ED, 'witnesses')
KU = 'kAThakam/AraNyakam/kaThopaniShat/'
DEV = IW.DEV
dnum, clean_line, read = IW.dnum, IW.clean_line, IW.read
ORD = {'प्रथम': 1, 'द्वितीय': 2, 'तृतीय': 3, 'चतुर्थ': 4, 'पञ्चम': 5, 'षष्ठ': 6}
VALLIS = ['1.1', '1.2', '1.3', '2.1', '2.2', '2.3']
MARK = re.compile(r'॥\s*([०-९]+)\s*॥')


def write(name, obj):
    os.makedirs(WIT, exist_ok=True)
    with open(os.path.join(WIT, name), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('wrote', os.path.relpath(os.path.join(WIT, name), ROOT))


def norm(s):
    return clean_line(s.replace('ꣳ', 'ं'))


def ordinal(h):
    return next((n for w, n in ORD.items() if w in h), None)


# ------------------------------------------------------------------ AS (base)
def advaita_sharada(raw):
    """'# प्रथमोऽध्यायः' / '## प्रथमा वल्ली' (the vallīs of the second adhyāya are
    numbered on, चतुर्थी … षष्ठी); verses end ॥ N ॥, a mark sometimes broken across
    lines, so each vallī is joined and split at its marks."""
    rel = 'vedAntam/advaitam/advaita-shAradA/mUla/Kathaka.md'
    out, vallis, cur = {}, [], None
    for ln in read(os.path.join(raw, rel)).split('\n'):
        s = ln.strip()
        if s.startswith('## ') and 'वल्ली' in s:
            cur = []
            vallis.append(cur)
        elif not s.startswith('#') and cur is not None and s:
            cur.append(s)
    for vi, lines in enumerate(vallis):
        text = norm(' '.join(lines))
        pos = 0
        for m in MARK.finditer(text):
            out[f'{VALLIS[vi]}.{dnum(m.group(1))}'] = [clean_line(text[pos:m.end()])]
            pos = m.end()
    return rel, out


# ------------------------------------------------------------------ G: GRETIL
def gretil(raw):
    rel = 'mixed/gretil_devanAgarI/1_sanskr/1_veda/4_upa/katha-upanisad.md'
    out, buf = {}, []
    body = read(os.path.join(raw, rel)).split('## पाठः', 1)[1]
    for ln in body.split('\n'):
        s = ln.strip()
        if not s or s == 'कठोपनिषत्' or re.match(r'॥\s*इति\s', s):
            continue                      # colophons (॥ इति प्रथमा वल्ली ॥) are not text
        m = re.search(r'॥\s*कउ_([०-९]+)।([०-९]+)\s*॥', s)
        buf.append(IW.clean_line(s))
        if m:
            v, n = dnum(m.group(1)), dnum(m.group(2))
            text = re.sub(r'\s*॥\s*कउ_[०-९]+।[०-९]+\s*॥', f' ॥ {IW.DEV[n] if n < 10 else n} ॥', ' '.join(buf))
            out[f'{VALLIS[v - 1]}.{n}'] = [text]
            buf = []
    return rel, out


# ------------------------------------------------------------------ V: vishvAsa mūla
def vishvasa(yajuh):
    rel = KU + 'mUlam.md'
    out, a, v, buf = {}, 0, 0, []
    for ln in read(os.path.join(yajuh, rel)).split('\n'):
        s = ln.strip()
        if s.startswith('### '):
            v = int(s[4:].strip())
            buf = []
            continue
        if s.startswith('## '):
            a = int(s[3:].strip())
            continue
        if not a or not v or not s or s.startswith('॥ अथ') or s.startswith('॥ इति'):
            continue
        buf.append(norm(s))
        m = MARK.search(s)
        if m:
            out[f'{a}.{v}.{dnum(m.group(1))}'] = [' '.join(buf)]
            buf = []
    return rel, out


# ------------------------------------------------------------------ Madhva
def _shingles(s):
    return {s[i:i + 8] for i in range(max(0, len(s) - 7))}


def madhva(yajuh, base):
    """The dvaitavedanta text prints Madhva's mūla as '## ' headings, with his
    bhāṣya after them. Each heading line is assigned to the base mantra that
    shares most of its 8-letter shingles (never earlier than the last); the
    comment after a passage belongs to every mantra the passage covers."""
    root = os.path.join(yajuh, KU + 'madhvaH/sarva-prastutiH/')
    tsh = {k: _shingles(phon(' '.join(v))) for k, v in base.items()}
    order = list(base)
    SHANTI = phon('सह नाववतु सह नौ भुनक्तु सह वीर्यं करवावहै')

    def walk(sub):
        # the vallī files only: 01_mUlam/madhvaH.md repeats the whole text without
        # mūla headings
        out = []
        for d, _, fs in sorted(os.walk(os.path.join(root, sub))):
            if os.path.normpath(d) == os.path.normpath(os.path.join(root, sub)):
                continue
            out += [os.path.join(d, f) for f in sorted(fs) if f.endswith('.md') and not f.startswith('_')]
        return sorted(out)

    def assign(files, keep_comment):
        mula, comm, ci, cur, span = {}, {}, 0, None, []
        for fp in files:
            fcur = None                   # the last mantra matched in this file
            for block in re.split(r'\n(?=## )', read(fp)):
                if not block.startswith('## '):
                    continue
                first, _, rest = block.partition('\n')
                line = norm(first[3:].strip().strip('*'))
                pl = phon(MARK.sub('', line))
                if not pl or pl in SHANTI or SHANTI[:24] in pl:
                    continue
                s_ = _shingles(pl)
                hit = None
                if len(s_) >= 3:
                    cands = order[ci:]
                    scores = {k: len(s_ & tsh[k]) for k in cands[:40]}
                    top = max(scores.values()) if scores else 0
                    if top >= 0.6 * len(s_):
                        hit = next(k for k in cands if scores.get(k, 0) >= 0.9 * top)
                if hit:
                    ci = order.index(hit)
                    cur = fcur = hit
                    if hit not in span:
                        span.append(hit)
                if not keep_comment and (hit or fcur):
                    # a mūla line too different to match (a variant, a short line)
                    # stays in order with the line before it; repeated lines (एतद्वै
                    # तत्) are kept — only a title line is dropped, below
                    mula.setdefault(hit or fcur, []).append(line)
                note = clean_line(rest)
                if keep_comment and note and (span or cur):
                    for k in (span or [cur]):
                        comm[k] = (comm.get(k, '') + ' ' + note).strip()
                    span = []
        return mula, comm

    mula, _ = assign(walk('01_mUlam'), False)
    for k, ls in mula.items():  # a title line that the next line begins with
        mula[k] = [x for i, x in enumerate(ls) if not (i + 1 < len(ls) and phon(ls[i + 1]).startswith(phon(x)))]
    return KU + 'madhvaH/sarva-prastutiH/', mula, own_bhashya(root, tsh, order, SHANTI)


def own_bhashya(root, tsh, order, SHANTI):
    """Madhva's bhāṣya alone (01_mUlam/madhvaH.md: his mūla and his comment, in
    paragraphs). 02_TIkA_TippaNi is NOT used for the commentary: there each passage
    is followed by six later sub-commentators (Vyāsatīrtha, Vāmana Paṇḍitācārya,
    Vādirāja, Vedeśatīrtha, Varadatīrtha, Rāghavendratīrtha). A paragraph that
    matches the base is mūla; the paragraphs after a mūla passage are Madhva's
    comment on every mantra that passage covers — unless the comment closes on a
    range of verse numbers shorter than that passage (॥ १०-१२ ॥ after the
    uncommented chariot verses 1.3.3–11), which names the mantras it is about."""
    text = read(os.path.join(root, '01_mUlam/madhvaH.md')).split('+++', 2)[-1]
    comm, ci, cur, span, commenting, buf = {}, 0, None, [], False, []

    def flush():
        if not buf:
            return
        keys = span or [cur]
        rng = re.search(r'॥\s*([०-९]+)\s*-\s*([०-९]+)\s*॥\s*$', buf[-1])
        # his numbers can run one off ours (he prints 1.1.1–2 as one verse), so a
        # range is trusted only to narrow a longer run of uncommented verses
        if rng and dnum(rng.group(2)) - dnum(rng.group(1)) + 1 < len(keys):
            a, b = dnum(rng.group(1)), dnum(rng.group(2))
            named = [k for k in keys if a <= int(k.rsplit('.', 1)[1]) <= b]
            # a comment follows the verses it discusses: the range must reach the
            # last verse before it (2.3.6–8 is marked ॥ ६-७ ॥, one off, and is not narrowed)
            if named and named[-1] == keys[-1]:
                keys = named
        for k in keys:
            comm[k] = (comm.get(k, '') + ' ' + ' '.join(buf)).strip()
        buf.clear()

    for para in re.split(r'\n\s*\n', text):
        para = norm(para.replace('\n', ' '))
        if not para or para.startswith('#'):
            continue
        pl = phon(MARK.sub('', para))
        if not pl or pl in SHANTI or SHANTI[:24] in pl:
            continue
        if re.match(r'इति \S*ध्याय', para):    # a vallī's or adhyāya's colophon
            continue
        s_ = _shingles(pl)
        hit = None
        if len(s_) >= 3:
            cands = order[ci:ci + 12]
            # the mantras this paragraph prints: most of a mantra's own text is in it
            # (Madhva prints 1.1.1–2 as one verse), or the paragraph is mostly one mantra
            covered = [k for k in cands if len(tsh[k] & s_) >= 0.6 * len(tsh[k])]
            if not covered:
                scores = {k: len(s_ & tsh[k]) for k in cands}
                top = max(scores.values()) if scores else 0
                if top >= 0.6 * len(s_):
                    covered = [next(k for k in cands if scores[k] >= 0.9 * top)]
            if covered:
                hit = covered[-1]
        # a verse Madhva reads differently (1.2.24 नाशान्तमनसो … प्रज्ञानेनैवम्) still
        # closes on its own number: a half-line ending ॥ N ॥ that shares a third of
        # its words with mantra N is mūla, not comment
        mk = re.search(r'॥\s*([०-९]+)\s*॥\s*$', para)
        if not hit and mk and 'इति' not in para and order[ci:ci + 3]:
            k_ = f"{order[ci].rsplit('.', 1)[0]}.{dnum(mk.group(1))}"
            if k_ in order[ci:ci + 3] and len(s_ & tsh[k_]) >= 0.3 * max(len(s_), 1):
                covered, hit = [k_], k_
        if hit:
            flush()
            ci = order.index(covered[0])
            if commenting or (span and span[0].rsplit('.', 1)[0] != hit.rsplit('.', 1)[0]):
                span, commenting = [], False    # a new mūla passage, or a new vallī, begins
            cur = hit
            span += [k for k in covered if k not in span]
            continue
        if span or cur:
            buf.append(para)
            commenting = True
    flush()
    return comm


# ------------------------------------------------------------------ commentaries split at verse marks
def by_marks(text, valli, out, expect_mula=None):
    """Split one vallī's commentary at the verse marks ॥ N ॥ taken in order
    (a mark that is not the next expected number is a citation, not a verse).
    The text after verse N's mark, up to the next verse, comments on N; the
    text before the first verse is the vallī's introduction."""
    n, pos, intro = 1, 0, None
    marks = []
    for m in MARK.finditer(text):
        if dnum(m.group(1)) == n:
            marks.append((n, m.start(), m.end()))
            n += 1
    if not marks:
        return None
    intro = clean_line(text[:marks[0][1]])
    for i, (num, s, e) in enumerate(marks):
        end = marks[i + 1][1] if i + 1 < len(marks) else len(text)
        out[f'{valli}.{num}'] = clean_line(text[e:end])
    return intro


def shankara(raw):
    rel = 'vedAntam/advaitam/advaita-shAradA/bhAShya/Kathaka.md'
    t = read(os.path.join(raw, rel))
    parts = re.split(r'\n## [^\n]*वल्ली[^\n]*\n', t)
    out, intros = {}, {}
    for i, part in enumerate(parts[1:]):
        intro = by_marks(norm(part.replace('\n', ' ')), VALLIS[i], out)
        if intro:
            intros[VALLIS[i]] = intro
    opening = norm(parts[0].split('# प्रथमोऽध्यायः')[-1])
    return rel, out, intros.get('1.1', '') or opening, intros


def rangaramanuja(yajuh):
    out, intros = {}, {}
    for i, v in enumerate(VALLIS, 1):
        rel = KU + f'rangarAmAnujaH/{i:02d}.md'
        t = read(os.path.join(yajuh, rel)).split('+++', 2)[-1]
        intro = by_marks(norm(t.replace('\n', ' ')), v, out)
        if intro:
            intros[v] = intro
    # a few verses carry the vishvAsa page's own <details> blocks (its mūla, set out
    # again): they are not Raṅgarāmānuja's words, so they are dropped with the tags
    for k, c in out.items():
        c = re.sub(r'<details[^>]*>.*?</details>', ' ', c)
        c = re.sub(r'<details[^>]*>.*$', ' ', c)
        out[k] = clean_line(re.sub(r'</?(details|summary)[^>]*>', ' ', c))
    return KU + 'rangarAmAnujaH/', out, intros


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--yajuh', required=True)
    ap.add_argument('--raw', required=True)
    a = ap.parse_args()
    Y = {'repo': 'https://github.com/vishvAsa/vedAH_yajuH', 'branch': 'content', 'commit': IW.head(a.yajuh)}
    R = {'repo': 'https://github.com/sanskrit/raw_etexts', 'branch': 'master', 'commit': IW.head(a.raw)}

    rel, asm = advaita_sharada(a.raw)
    write('AS-advaita-sharada.json', {'id': 'AS', **R, 'path': rel,
        'label': 'Advaita Sharada (Śṛṅgeri Śāradā Pīṭham), the mūla of Śaṅkara’s Kaṭhopaniṣad-bhāṣya, mirrored in sanskrit/raw_etexts',
        'note': 'Base text. Keyed adhyāya.vallī.mantra; ꣳ (the Vedic anusvāra sign) is read as ं.', 'mantras': asm})
    rel, g = gretil(a.raw)
    write('G-gretil.json', {'id': 'G', **R, 'path': rel,
        'label': 'GRETIL Katha-Upanisad (based on Olivelle, The Early Upaniṣads, New York 1998), in sanskrit/raw_etexts',
        'note': 'Its references KaU_vallī.verse number the vallīs 1–6; mapped to adhyāya.vallī. GRETIL marks its files ‘for reference purposes only’.', 'mantras': g})
    rel, vm = vishvasa(a.yajuh)
    write('V-vishvasa.json', {'id': 'V', **Y, 'path': rel,
        'label': 'The mūla of the Kaṭhopaniṣad in vishvAsa/vedAH_yajuH (kAThakam/AraNyakam/kaThopaniShat/mUlam.md)',
        'note': 'Keyed adhyāya.vallī.mantra by its own headings.', 'mantras': vm})
    rel, mvm, mvc = madhva(a.yajuh, asm)
    write('Mv-madhva.json', {'id': 'Mv', **Y, 'path': rel + '01_mUlam/',
        'label': 'The mūla of Madhva’s Kāṭhakopaniṣad-bhāṣya (dvaitavedanta.in), vishvAsa/vedAH_yajuH',
        'note': 'Assigned to mantras by matching each mūla line to the base text; Madhva groups verses differently, so it is collated vallī by vallī.', 'mantras': mvm})
    write('madhva.json', {'id': 'Madhva', **Y, 'path': rel + '01_mUlam/madhvaH.md',
        'label': 'Madhva (Ānandatīrtha), Kāṭhakopaniṣad-bhāṣya, dvaitavedanta.in text in vishvAsa/vedAH_yajuH',
        'note': 'Madhva’s bhāṣya alone (01_mUlam/madhvaH.md), by mantra: he comments after a passage of several mūla verses, so a comment is filed under every mantra its passage covers. He cites Purāṇic and other authorities by name. The six later sub-commentators printed in 02_TIkA_TippaNi (Vyāsatīrtha, Vāmana Paṇḍitācārya, Vādirāja, Vedeśatīrtha, Varadatīrtha, Rāghavendratīrtha) are not imported.', 'mantras': mvc})
    rel, shb, opening, sh_intro = shankara(a.raw)
    write('shankara.json', {'id': 'Shankara', **R, 'path': rel,
        'label': 'Śaṅkara, Kaṭhopaniṣad-bhāṣya, Advaita Sharada (Śṛṅgeri) text, mirrored in sanskrit/raw_etexts',
        'url': 'https://advaitasharada.sringeri.net/', 'note': 'By mantra; his introduction is `opening`, and each later vallī’s opening words are in `valli_intro` and, so that they can be quoted, in the `intro` of that vallī’s first mantra (2.1.1 opens the second adhyāya).',
        'opening': opening, 'valli_intro': sh_intro,
        'mantras': {k: {'bhashya': v, 'intro': sh_intro.get(k[:-2], '') if k.endswith('.1') and k[:-2] != '1.1' else ''} for k, v in shb.items()}})
    rel, rrm, rr_intro = rangaramanuja(a.yajuh)
    write('rangaramanuja.json', {'id': 'rangaramanuja', **Y, 'path': rel,
        'label': 'Raṅgarāmānuja, Kaṭhopaniṣat-prakāśikā (ed. K. C. Varadachari and D. T. Tatacharya, Tirupati 1948; OCR via archive.org), via vishvAsa/vedAH_yajuH',
        'note': 'By mantra (OCR-derived text; the source’s last pages are reported missing). Viśiṣṭādvaita. The vallī openings are in `valli_intro`.',
        'valli_intro': rr_intro, 'mantras': rrm})

    refs = []
    for f in sorted(os.listdir(ED)):
        if f.startswith('parallel-refs') and f.endswith('.json'):
            refs += [r for r in json.load(open(os.path.join(ED, f), encoding='utf-8'))['refs'] if r not in refs]
    write('parallels.json', {'note': 'Passages cited by the analysis, cut from their sources by import_witnesses.parallels(). The checker requires every phrase an analysis quotes from a parallel to occur here.',
                             **R, 'passages': IW.parallels(a.raw, refs)})


if __name__ == '__main__':
    main()
