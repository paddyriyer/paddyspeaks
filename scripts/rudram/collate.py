#!/usr/bin/env python3
"""Collate the base text (W1) with the second witness (W2), letter by letter.

The two transcriptions follow different spelling conventions for the same
Taittirīya text. Before comparing, both are reduced to one phonemic skeleton
(IAST, accents and spacing removed) under these documented equivalences, none
of which changes a word:

  visarga before a sibilant ≡ the doubled sibilant      (नमः स — नमस्स)
  visarga before k/kh/p/ph ≡ jihvāmūlīya / upadhmānīya  (नमः क — नमᳵ क)
  any nasal before a consonant ≡ one nasal               (शिवं ब — शिवम्ब)
  a nasalised semivowel (व्ँव) ≡ anusvāra + semivowel
  ch ≡ cch after a vowel                                 (गिरिशाछा — गिरिशाच्छा)
  ḍh ≡ ḍ in mīḍhuṣ- (the intervocalic ḷh of the Taittirīya, written either way)
  n before n written double or single at a word end      (अदृशन्न् अ — अदृशन्न)

What survives is a real difference of letters. The report lists each with its
place (anuvāka and unit of text.json) for the editor to classify in
corrections.json; check.py then requires that every surviving difference be
classified, and that the classification still matches the witnesses.

  python3 scripts/rudram/collate.py            # print the differences
  python3 scripts/rudram/collate.py --json     # machine-readable (used by check.py)
"""
import difflib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from translit import dev2iast  # noqa: E402

ED = os.path.abspath(os.path.join(HERE, '..', '..', 'rudramchamakam', 'edition'))

CONS = 'kh gh ch jh ṭh ḍh th dh ph bh k g ṅ c j ñ ṭ ḍ ṇ t d n p b m y r l v ś ṣ s h'.split()


def skeleton(dev):
    s = dev2iast(dev)
    s = re.sub(r'\[\d+\]', ' ', s)
    s = s.replace('||', ' ').replace('|', ' ').replace('\\', ' ').replace("'", '')
    s = s.replace('ẖ', 'ḥ').replace('ḫ', 'ḥ')
    s = re.sub(r'\s+', ' ', s).strip()
    # nasalised semivowel: v̐v / y̐y / l̐l (and a lone v̐ before the semivowel) → N + semivowel
    s = re.sub('([vyl])̐ ?', 'N', s)
    s = s.replace('m̐', 'N')
    # word-final m / ṃ / n̐ before a consonant, and class nasals before stops → N
    s = re.sub(r'(ṃ|m|n) ?(?=[nm])', 'N', s)        # akaran namaḥ ≡ akaraṃ namaḥ
    s = re.sub(r'(ṃ|m|ṅ|ñ|ṇ|n) ?(?=(kh|gh|ch|jh|ṭh|ḍh|th|dh|ph|bh|[kgcjṭḍtdpbyvlśṣsh]))', 'N', s)
    s = s.replace('ṃ', 'N')
    s = s.replace(' ', '')
    # visarga before a sibilant ≡ doubled sibilant
    s = re.sub(r'ḥ(?=[śṣs])', lambda m: '~', s)
    s = re.sub(r'([śṣs])(?=\1)', '~', s)
    s = s.replace('~', 'Ḥ')
    s = re.sub(r'as(?=n)', 'o', s)   # W2 writes a line-final namas / -bhyas for -o before namaḥ
    s = s.replace('cch', 'ch')
    s = s.replace('mīḍh', 'mīḍ')
    s = s.replace('nn', 'n')
    return s


def w1_text():
    w = json.load(open(os.path.join(ED, 'witnesses', 'W1-panchati.json'), encoding='utf-8'))
    return w['anuvakas']


def w2_text():
    w = json.load(open(os.path.join(ED, 'witnesses', 'W2-vakya.json'), encoding='utf-8'))
    return w['prapathakas']


def unit_index():
    """skeleton offset → (anuvāka, unit) for the base text, from text.json."""
    t = json.load(open(os.path.join(ED, 'text.json'), encoding='utf-8'))
    spans = {'4.5': [], '4.7': []}
    for a in t['anuvakas']:
        pr = a['ts'].rsplit('.', 1)[0]
        for u in a['units']:
            spans[pr].append((a['id'], u['n'], skeleton(u['samhita']), u['samhita']))
    return spans


def collate():
    w1, w2 = w1_text(), w2_text()
    spans = unit_index()
    diffs = []
    for pr, prefix in (('4.5', 'N'), ('4.7', 'C')):
        units = spans[pr]
        a = skeleton(' '.join(raw for _, _, _, raw in units))
        owner = []
        for aid, un, sk, _ in units:
            owner += [(aid, un)] * len(sk)
        owner += [owner[-1]] * max(0, len(a) - len(owner))
        b_full = skeleton(' '.join(w2[pr]))
        # W2 runs past anuvāka 11 of 4.7: cut it where the base text ends
        end = b_full.find(a[-25:])
        b = b_full[:end + 25] if end >= 0 else b_full
        sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
        for op, i1, i2, j1, j2 in sm.get_opcodes():
            if op == 'equal':
                continue
            where = owner[min(i1, len(owner) - 1)]
            diffs.append({
                'at': f'{where[0]}.{where[1]}',
                'w1': a[i1:i2], 'w2': b[j1:j2],
                'context_w1': a[max(0, i1 - 18):i2 + 18],
                'context_w2': b[max(0, j1 - 18):j2 + 18],
            })
    return diffs


if __name__ == '__main__':
    d = collate()
    if '--json' in sys.argv:
        json.dump(d, sys.stdout, ensure_ascii=False, indent=1)
    else:
        for x in d:
            print(f"{x['at']:8} W1 «{x['w1']}»  W2 «{x['w2']}»   …{x['context_w1']}…  |  …{x['context_w2']}…")
        print(len(d), 'differences')


# ---------------------------------------------------------------- svara
VOWEL_SIGNS = set('ािीुूृॄॢॣेैोौ')
IND_VOWELS = set('अआइईउऊऋॠऌॡएऐओऔ')
CONS_DEV = set('कखगघङचछजझञटठडढणतथदधनपफबभमयरलळवशषसह')


def syllables(dev):
    """[(vowel_letter, accent)] for every syllable; accent '' / '_' (anudātta) / "'" (svarita)."""
    out = []
    i, n = 0, len(dev)
    while i < n:
        ch = dev[i]
        if ch in CONS_DEV:
            nxt = dev[i + 1] if i + 1 < n else ''
            if nxt == '्':
                i += 2
                continue
            if nxt in VOWEL_SIGNS:
                out.append([nxt, ''])
                i += 2
                continue
            out.append(['a', ''])
            i += 1
            continue
        if ch in IND_VOWELS:
            out.append([ch, ''])
        elif ch == '॒' and out:
            out[-1][1] = '_'
        elif ch == '॑' and out:
            out[-1][1] = "'"
        i += 1
    return out


def collate_svara():
    """Accent marks of W1 against W2 wherever the syllables align."""
    w1, w2 = w1_text(), w2_text()
    t = json.load(open(os.path.join(ED, 'text.json'), encoding='utf-8'))
    out = []
    for pr in ('4.5', '4.7'):
        sy1, owner = [], []
        for a in t['anuvakas']:
            if not a['ts'].startswith(pr + '.'):
                continue
            for u in a['units']:
                s = syllables(re.sub(r'\[\d+\]', '', u['samhita']))
                sy1 += s
                owner += [f"{a['id']}.{u['n']}"] * len(s)
        sy2 = syllables(' '.join(w2[pr]))
        A = ''.join('a' if v == 'a' else v for v, _ in sy1)
        B = ''.join(v for v, _ in sy2)
        sm = difflib.SequenceMatcher(None, A, B, autojunk=False)
        for op, i1, i2, j1, j2 in sm.get_opcodes():
            if op != 'equal':
                continue
            for k in range(i2 - i1):
                a1, a2 = sy1[i1 + k][1], sy2[j1 + k][1]
                if a1 != a2:
                    out.append({'at': owner[i1 + k], 'syllable': i1 + k, 'w1': a1, 'w2': a2})
    return out, len(sy1)
