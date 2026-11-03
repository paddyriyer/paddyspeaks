"""Shared text functions for the Upaniṣad editions (check.py, derive.py, the import).

`letters(s)` is the comparison form used to collate witnesses: what is left when
everything that is not a reading has been removed — svara marks, spacing,
avagraha, dandas and numbers, the pluti figure, and the spelling of nasals
(ँ / ं / a class nasal before its own class are one letter here). Two witnesses
whose `letters` agree have the same reading; every place where they do not is
listed by `diff` and must be classified in corrections.json.
"""
import difflib
import re
import unicodedata

ACCENTS = '॒॑॓॔᳐᳑᳒᳓᳔᳕᳖᳗᳘᳙᳜᳝᳞᳟᳚᳛᳠꣠꣡꣢꣣꣤꣥꣦꣧꣨꣩꣪꣫꣬꣭꣮꣯꣰꣱'
VIRAMA = '्'
CLASS_NASAL = {
    'ङ': 'कखगघ', 'ञ': 'चछजझ', 'ण': 'टठडढ', 'न': 'तथदध', 'म': 'पफबभ',
}


SIGN = {'अ': '', 'आ': 'ा', 'इ': 'ि', 'ई': 'ी', 'उ': 'ु', 'ऊ': 'ू', 'ऋ': 'ृ', 'ॠ': 'ॄ',
        'ऌ': 'ॢ', 'ए': 'े', 'ऐ': 'ै', 'ओ': 'ो', 'औ': 'ौ'}


def fuse(s):
    """A consonant + virama + an independent vowel is one syllable: क् + अ → क."""
    return re.sub(VIRAMA + '([' + ''.join(SIGN) + '])', lambda m: SIGN[m.group(1)], s)


def strip_accents(s):
    return ''.join(c for c in s if c not in ACCENTS)


def letters(s):
    s = unicodedata.normalize('NFC', s)
    s = strip_accents(s).replace('‌', '').replace('‍', '')
    s = re.sub(r'[०-९0-9]', '', s)          # numbers and the pluti figure ३
    s = s.replace('ओं', 'ओम्').replace('ॐ', 'ओम्')
    s = re.sub(r'[\s।॥ऽ\'’‘\-—*_()|.,;:?!\\]', '', s)
    s = fuse(s)
    s = s.replace('ँ', 'ं').replace('ꣳ', 'ं')  # candrabindu, the Vedic anusvāra sign = anusvāra
    for nas, cls in CLASS_NASAL.items():     # class nasal before its class = anusvāra
        s = re.sub(nas + VIRAMA + '([' + cls + '])', r'ं\1', s)
    return s


def join_gretil(line):
    """GRETIL spaces words even inside sandhi (यस् तु, यो ऽसाव् असौ). Close a space
    after a virama or before an avagraha; every other space is a word boundary."""
    s = re.sub(VIRAMA + r' +', VIRAMA, line)
    s = re.sub(r' +ऽ', 'ऽ', s)
    return fuse(s)


def diff(base, other):
    """Letter-level differences between two `letters` strings, as
    [(base_fragment, other_fragment, context)] with a few letters of context."""
    a, b = letters(base), letters(other)
    out = []
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            continue
        ctx = a[max(0, i1 - 6):i2 + 6]
        out.append((a[i1:i2], b[j1:j2], ctx))
    return out


def phon(s):
    """Sound-level comparison form for quotations: IAST letters only, svara and
    punctuation gone, so that a quotation matches whatever stood before it in
    the source (वास्यम् आच्छादनीयम् contains आच्छादनीयम्)."""
    import os
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'devi_mahatmyam'))
    from translit import dev2iast
    s = unicodedata.normalize('NFC', strip_accents(s)).replace('\u200c', '').replace('\u200d', '')
    s = s.replace('ॐ', 'ओम्').replace('ओं', 'ओम्')
    s = re.sub(r'[०-९0-9]', '', s)
    s = dev2iast(s).lower().replace('m̐', 'ṃ')
    s = re.sub(r"[^a-zāīūṛṝḷḹṅñṭḍṇśṣṃḥ]", '', s)
    s = re.sub(r'[ṅñṇnm](?=[kgcjṭḍtdpbyrlvśṣsh])', 'ṃ', s)
    return s
