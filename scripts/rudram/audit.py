#!/usr/bin/env python3
"""Audit of the previous Śrī Rudram page against the verified text.

The previous page (rudramchamakam/edition/legacy/data.json — its data.js as it
stood at commit 6f031ad) is compared, anuvāka by anuvāka, with the verified
Saṃhitā (text.json) and the proven padaccheda (analysis/), and every defect is
written as one row of the quality-control table the Sources page prints:

  Section · Anuvāka · Source reading · Existing reading · Error type ·
  Correction · Verification source · Status

Nothing here is judged by hand: the comparison is the letter-by-letter
collation of collate.py (both texts reduced to the same phonemic skeleton, so
spelling conventions — anusvāra or class nasal, visarga or doubled sibilant —
are not counted as errors), and the classification is by rule:

  MISSING_WORD                source letters absent from the old page
                              (the Chamakam's च मे refrain is counted per anuvāka)
  EXTRA_WORD                  old letters absent from every witness
  INCORRECT_SEQUENCE          a passage present in both but in another place
  INCORRECT_SANDHI            a difference confined to a junction (visarga,
                              final vowel, nasal, avagraha)
  INCORRECT_GRAMMAR           a wrong letter inside a word (a different form)
  INCORRECT_MANTRA_BOUNDARY   recitation prayers set inside an anuvāka
  INCORRECT_TRANSLITERATION   the old IAST against the old Devanagari: spaces
                              inside words, wrong vowel length, lost letters
  INCORRECT_PADACCHEDA        words of the text with no word-by-word entry
  UNSUPPORTED_INTERPRETATION  the old "esoteric meaning" notes
  INCORRECT_SVARA             the old page carried no svara at all

  python3 scripts/rudram/audit.py            # write rudramchamakam/edition/audit.json
  python3 scripts/rudram/audit.py --check    # fail if audit.json is stale
"""
import difflib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from collate import skeleton  # noqa: E402
from translit import dev2iast, strip_accents  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ED = os.path.join(ROOT, 'rudramchamakam', 'edition')
OUT = os.path.join(ED, 'audit.json')

# The recitation prayers the old page set inside Namakam 1 — not TS 4.5.1.
SUPPLEMENTS = ['ॐ नमो भगवते रुद्राय', 'नमस्ते अस्तु भगवन्']
SANDHI_CHARS = set('ḥoaeNnmṃśsṣ\'Ḥ')


def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def plain_dev(s):
    s = strip_accents(s)
    s = re.sub(r'\s*\[\d+\]', '', s)
    return re.sub(r'\s+', ' ', s).strip()


class Stream:
    """A Devanagari text and its skeleton, with a map from skeleton offsets
    back to the words of the text, so a difference can be quoted as words."""

    def __init__(self, words):
        self.words = words
        self.sk = skeleton(' '.join(words))      # whole text: junctions normalise as in collate.py
        self.owner = []
        for i, w in enumerate(words):
            self.owner += [i] * len(skeleton(w))
        self.owner += [len(words) - 1] * max(0, len(self.sk) - len(self.owner))
        self.owner = self.owner[:len(self.sk)]

    def quote(self, i1, i2):
        if not self.owner:
            return ''
        if i2 <= i1:
            k = self.owner[min(i1, len(self.owner) - 1)]
            return f'(between «{self.words[max(0, k - 1)]}» and «{self.words[k]}»)'
        a = self.owner[min(i1, len(self.owner) - 1)]
        b = self.owner[min(i2 - 1, len(self.owner) - 1)]
        return ' '.join(self.words[a:b + 1])


def old_mantra_text(m):
    return plain_dev(m.get('devanagari', '')).replace('।', ' ').replace('॥', ' ')


def classify_replace(src, old):
    if len(src) <= 3 and len(old) <= 3 and set(src + old) <= SANDHI_CHARS:
        return 'INCORRECT_SANDHI'
    if len(src) <= 4 and len(old) <= 4:
        return 'INCORRECT_GRAMMAR'
    return None


def regions(ops, gap=10):
    """Group the non-equal opcodes of a SequenceMatcher that lie within `gap`
    letters of each other into one region (i1, i2, j1, j2, changed_letters)."""
    out = []
    for op, i1, i2, j1, j2 in ops:
        if op == 'equal':
            continue
        ch = max(i2 - i1, j2 - j1)
        if out and i1 - out[-1][1] <= gap and j1 - out[-1][3] <= gap:
            r = out[-1]
            out[-1] = (r[0], i2, r[2], j2, r[4] + ch)
        else:
            out.append((i1, i2, j1, j2, ch))
    return out


def namakam_rows(rows, part, an, src, a, keep):
    canon = Stream(plain_dev(' '.join(u['samhita'] for u in a['units'])).replace('।', ' ').replace('॥', ' ').split())
    old = Stream(' '.join(old_mantra_text(m) for m in keep).split())
    # where the old page's lines end: a pausal form there is a legitimate way to
    # set out the text, not a sandhi error
    bounds, k = [], 0
    for m in keep:
        k += len(skeleton(old_mantra_text(m).replace(' ', '')))
        bounds.append(k)
    sm = difflib.SequenceMatcher(None, canon.sk, old.sk, autojunk=False)
    missing = 0
    for i1, i2, j1, j2, ch in regions(sm.get_opcodes()):
        s_src, s_old = canon.sk[i1:i2], old.sk[j1:j2]
        q_src, q_old = canon.quote(i1, i2), old.quote(j1, j2)
        if not s_old:
            missing += len(s_src)
            moved = len(s_src) >= 15 and s_src[:15] in old.sk
            rows.append(dict(section=part, anuvaka=an, source=q_src, existing='— (omitted)',
                             type='INCORRECT_SEQUENCE' if moved else 'MISSING_WORD',
                             correction='Restored from the Saṃhitā', verification=src, status='Corrected'))
        elif not s_src:
            long = len(s_old) >= 20
            rows.append(dict(section=part, anuvaka=an, source='— (not in the text)', existing=q_old, type='EXTRA_WORD',
                             correction='Removed' + (f" — not in TS {a['ts']} in any witness" if long else ''),
                             verification=src, status='Corrected'))
        else:
            sim = difflib.SequenceMatcher(None, s_src, s_old, autojunk=False).ratio()
            if set(s_src + s_old) <= SANDHI_CHARS and ch <= 5 and any(abs(b - j2) <= 3 or abs(b - j1) <= 3 for b in bounds):
                continue                # a pausal form at the end of one of the old page's lines
            if ch <= 3 and set(s_src + s_old) <= SANDHI_CHARS:
                t, corr = 'INCORRECT_SANDHI', 'Corrected to the Saṃhitā reading'
            elif ch <= 4 or sim >= 0.6:
                t, corr = 'INCORRECT_GRAMMAR', 'Corrected to the Saṃhitā reading (a wrong letter or form)'
            else:
                missing += len(s_src)
                t = 'MISSING_WORD'
                corr = 'Restored from the Saṃhitā; the text that stood in its place is not in the source'
                if len(s_old) >= 20 and s_old[:20] not in canon.sk:
                    corr += f" (not in TS {a['ts']} in any witness)"
            rows.append(dict(section=part, anuvaka=an, source=q_src, existing=q_old, type=t,
                             correction=corr, verification=src, status='Corrected'))
    return missing


def pausal_skeleton(w):
    s = skeleton(w)
    return re.sub(r'(ḥ|Ḥ|o|N|m)$', '', s)


def chamakam_rows(rows, part, an, src, a, keep, A):
    """Item by item: the proven padaccheda without its च / मे against the
    old page's words (which had dropped them)."""
    if not A:
        rows.append(dict(section=part, anuvaka=an, source='(analysis pending)', existing='', type='TEXTUAL_VARIANT_REQUIRES_REVIEW',
                         correction='', verification='', status='Pending'))
        return 0
    canon = [w for u in A['units'] for w in u['padaccheda'] if w not in ('च', 'मे')]
    old = [w for m in keep for w in old_mantra_text(m).split() if w not in ('च', 'मे', 'म')]
    ck, ok = [pausal_skeleton(w) for w in canon], [pausal_skeleton(w) for w in old]
    sm = difflib.SequenceMatcher(None, ck, ok, autojunk=False)
    missing = 0
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == 'equal':
            continue
        q_src, q_old = ' '.join(canon[i1:i2]), ' '.join(old[j1:j2])
        if op == 'delete':
            missing += i2 - i1
            moved = any(x in ok for x in ck[i1:i2])
            rows.append(dict(section=part, anuvaka=an, source=q_src, existing='— (omitted)',
                             type='INCORRECT_SEQUENCE' if moved else 'MISSING_WORD',
                             correction='Restored from the Saṃhitā', verification=src, status='Corrected'))
        elif op == 'insert':
            rows.append(dict(section=part, anuvaka=an, source='— (not in the text)', existing=q_old, type='EXTRA_WORD',
                             correction='Removed', verification=src, status='Corrected'))
        else:
            sim = difflib.SequenceMatcher(None, ''.join(ck[i1:i2]), ''.join(ok[j1:j2]), autojunk=False).ratio()
            if (i2 - i1) == (j2 - j1) and sim >= 0.6:
                rows.append(dict(section=part, anuvaka=an, source=q_src, existing=q_old, type='INCORRECT_GRAMMAR',
                                 correction='Corrected to the Saṃhitā reading (a wrong letter or form)', verification=src, status='Corrected'))
            else:
                missing += i2 - i1
                rows.append(dict(section=part, anuvaka=an, source=q_src, existing=q_old, type='MISSING_WORD',
                                 correction='Restored from the Saṃhitā; the words that stood in their place are not in the source',
                                 verification=src, status='Corrected'))
    return missing


def audit():
    T = load(os.path.join(ED, 'text.json'))
    L = load(os.path.join(ED, 'legacy', 'data.json'))['data']
    rows = []
    stats = {}
    for sec, a in zip(L['sections'], T['anuvakas']):
        part = 'Namakam' if a['part'] == 'namakam' else 'Chamakam'
        an = f"{part} {a['n']}"
        aid = a['id']
        src = 'W1, W2 (TS ' + a['ts'] + ')' + (', Abhinava Śaṅkara' if part == 'Namakam' else '') + ', Sāyaṇa'
        mantras = sec['mantras']
        # --- boundary: recitation prayers inside the anuvāka
        keep = []
        for m in mantras:
            d = old_mantra_text(m)
            if any(d.startswith(s) for s in SUPPLEMENTS):
                rows.append(dict(section=part, anuvaka=an, source='— (not part of TS 4.5.1)', existing=d[:80] + ('…' if len(d) > 80 else ''),
                                 type='INCORRECT_MANTRA_BOUNDARY',
                                 correction='Moved out of the anuvāka; shown, labelled as a recitation prayer, under “Around the recitation”.',
                                 verification='Absent from TS 4.5.1 in W1 and W2', status='Corrected'))
            else:
                keep.append(m)
        # --- the Sanskrit
        pfile = os.path.join(ED, 'analysis', f"{aid[0]}{int(aid[1:]):02d}.json")
        A = load(pfile) if os.path.exists(pfile) else None
        if part == 'Namakam':
            missing_letters = namakam_rows(rows, part, an, src, a, keep)
        else:
            missing_letters = chamakam_rows(rows, part, an, src, a, keep, A)
        # --- the Chamakam refrain
        if part == 'Chamakam':
            n_me_src = sum(1 for w in plain_dev(' '.join(u['samhita'] for u in a['units'])).split() if re.match(r'^(मे|म)$', w) or w.startswith('मेऽ') or w.endswith('मेऽ'))
            n_me_src = len(re.findall(r'(?<![ऀ-ॿ])मे|म(?= [अआइईउऊऋएऐओऔ])', plain_dev(' '.join(u['samhita'] for u in a['units']))))
            n_me_old = len(re.findall(r'(?<![ऀ-ॿ])मे(?![ऀ-ॿ])', ' '.join(old_mantra_text(m) for m in keep)))
            if n_me_old < n_me_src:
                rows.append(dict(section=part, anuvaka=an, source=f'च मे after every item ({n_me_src}×)',
                                 existing=f'{n_me_old}× — the refrain dropped from the Sanskrit shown', type='MISSING_WORD',
                                 correction='Every च and मे restored in the Saṃhitā, the padaccheda and the word table',
                                 verification=src, status='Corrected'))
        # --- transliteration of the old page against its own Devanagari
        tl_bad, examples = 0, []
        for m in keep:
            dev, iast = old_mantra_text(m), (m.get('text') or '')
            want = dev2iast(dev).replace('ṃ', 'ṁ')
            got = re.sub(r'\s*\|+\s*', ' ', iast).strip()
            wt, gt = want.split(), got.split()
            sm2 = difflib.SequenceMatcher(None, wt, gt, autojunk=False)
            for op, i1, i2, j1, j2 in sm2.get_opcodes():
                if op == 'equal':
                    continue
                w_, g_ = ' '.join(wt[i1:i2]), ' '.join(gt[j1:j2])
                if w_.replace(' ', '') == g_.replace(' ', '') and w_ == g_:
                    continue
                tl_bad += 1
                if len(examples) < 3:
                    examples.append(f'«{g_}» for «{w_}»')
        if tl_bad:
            rows.append(dict(section=part, anuvaka=an, source='IAST generated from the Devanagari',
                             existing=f'{tl_bad} word(s) whose IAST does not match the Devanagari shown beside it, e.g. ' + '; '.join(examples),
                             type='INCORRECT_TRANSLITERATION',
                             correction='IAST is now generated from the verified Devanagari and proven by round trip',
                             verification='scripts/rudram/translit.py', status='Corrected'))
        # --- word-by-word coverage
        n_words_new = sum(len(u['padaccheda']) for u in A['units']) if A else None
        n_words_old = sum(len(m.get('words') or []) for m in keep)
        if n_words_new and n_words_old < n_words_new:
            rows.append(dict(section=part, anuvaka=an, source=f'{n_words_new} words in the proven padaccheda',
                             existing=f'{n_words_old} word-by-word entries (particles and repeated words left out)',
                             type='INCORRECT_PADACCHEDA',
                             correction='One entry for every word, proven to rejoin into the Saṃhitā',
                             verification='scripts/rudram/check.py (sandhi proof)', status='Corrected'))
        # --- interpretation presented as meaning
        eso = [m for m in mantras if (m.get('esotericMeaning') or '').strip()]
        if eso:
            rows.append(dict(section=part, anuvaka=an, source='Sāyaṇa’s bhāṣya',
                             existing=f'{len(eso)} “esoteric meaning” note(s) with no stated source, e.g. «{eso[min(1, len(eso) - 1)]["esotericMeaning"][:110]}…»',
                             type='UNSUPPORTED_INTERPRETATION',
                             correction='Removed. Each unit now has a traditional note that quotes Sāyaṇa verbatim, and an optional reflection labelled as modern',
                             verification='Sāyaṇa (W-S); quotations checked by check.py', status='Corrected'))
        stats[aid] = dict(old_mantras=len(mantras), units=len(a['units']), letters_missing=missing_letters,
                          old_word_entries=n_words_old, words=n_words_new)
    rows.append(dict(section='Both', anuvaka='All', source='Svara as marked in W1 (and compared with W2)',
                     existing='No svara shown', type='INCORRECT_SVARA',
                     correction='The accented Saṃhitā is shown (with a switch to hide the marks); syllables where W1 and W2 disagree are flagged for review',
                     verification='W1, W2', status='Corrected; svara pending scholarly validation'))
    counts = {}
    for r in rows:
        counts[r['type']] = counts.get(r['type'], 0) + 1
    return {'about': 'Generated by scripts/rudram/audit.py — do not edit. The previous page (legacy/data.json) '
                     'against the verified text; printed on the Sources page.',
            'counts': counts, 'stats': stats, 'rows': rows}


def main():
    data = audit()
    text = json.dumps(data, ensure_ascii=False, indent=1) + '\n'
    if '--check' in sys.argv:
        cur = open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
        if cur != text:
            print('audit.json is stale: run python3 scripts/rudram/audit.py')
            sys.exit(1)
        print('audit.json is current')
        return
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f"{len(data['rows'])} rows:", ', '.join(f'{k} {v}' for k, v in sorted(data['counts'].items())))


if __name__ == '__main__':
    main()
