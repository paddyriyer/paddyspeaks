"""External sandhi, stdlib only — the Devī Māhātmyam edition's proof of padaccheda.

The padaccheda of every mantra lists its words in their own (pausal) forms. This
module rejoins those words by the rules of external sandhi and the checker
requires that at least one rejoining spells the recited text exactly (spaces,
dandas, avagraha and nasal spelling aside). So a split that cannot be undone by
grammar — a missing word, an invented one, a wrong ending — fails the build.

Work is done in IAST. The rules are the ones the text actually uses:

  vowels     savarṇa-dīrgha, guṇa, vṛddhi, yaṇ, ayādi (with the usual loss of
             y/v and hiatus), pūrvarūpa after -e/-o (avagraha)
  visarga    -aḥ → -o / -a, -āḥ → -ā, other -ḥ → -r (and ḥ+r → lengthening),
             ḥ → ś/ṣ/s before c/ṭ/t (and optionally before ś/ṣ/s), saḥ/eṣaḥ → sa/eṣa
  consonants voicing, t-assimilation (c j ṭ ḍ l n, t+ś → cch, t+h → ddh),
             n-assimilation (ṃś ṃs ṃṣ ñ ṇ ṃl, nn after a short vowel), m → ṃ,
             k/ṭ/p before nasals, ch → cch after a vowel

Anything else is an exception: the analysis must name it (pragṛhya, ārṣa, a
metrical licence) in `sandhi_exceptions`, and the checker reports it.
"""
import re

VOWELS = ['ai', 'au', 'ā', 'ī', 'ū', 'ṝ', 'ḹ', 'a', 'i', 'u', 'ṛ', 'ḷ', 'e', 'o']
CONS = ['kh', 'gh', 'ch', 'jh', 'ṭh', 'ḍh', 'th', 'dh', 'ph', 'bh',
        'k', 'g', 'ṅ', 'c', 'j', 'ñ', 'ṭ', 'ḍ', 'ṇ', 't', 'd', 'n', 'p', 'b', 'm',
        'y', 'r', 'l', 'ḻ', 'v', 'ś', 'ṣ', 's', 'h', 'ṃ', 'ḥ', 'm̐']
TOKENS = sorted(VOWELS + CONS, key=len, reverse=True)
VOICED = set('g gh j jh ḍ ḍh d dh b bh y r l v h ṅ ñ ṇ n m'.split())
NASALS = set('ṅ ñ ṇ n m'.split())
SHORT = set('a i u ṛ ḷ'.split())


def tokens(s):
    out, i = [], 0
    while i < len(s):
        for t in TOKENS:
            if s.startswith(t, i):
                out.append(t)
                i += len(t)
                break
        else:
            out.append(s[i])
            i += 1
    return out


def is_vowel(t):
    return t in VOWELS


GUNA = {('a', 'i'): 'e', ('a', 'ī'): 'e', ('a', 'u'): 'o', ('a', 'ū'): 'o',
        ('a', 'ṛ'): 'ar', ('a', 'e'): 'ai', ('a', 'ai'): 'ai', ('a', 'o'): 'au',
        ('a', 'au'): 'au'}
SAVARNA = {'a': 'a', 'ā': 'a', 'i': 'i', 'ī': 'i', 'u': 'u', 'ū': 'u', 'ṛ': 'ṛ', 'ṝ': 'ṛ'}
LONG = {'a': 'ā', 'i': 'ī', 'u': 'ū', 'ṛ': 'ṝ'}

# words whose visarga stands for r (they become -r before voiced sounds)
R_FINAL = {'punaḥ', 'antaḥ', 'prātaḥ', 'svaḥ', 'ahaḥ', 'mātaḥ', 'pitaḥ', 'bhrātaḥ',
           'dvāḥ', 'gīḥ', 'dhūḥ', 'pūḥ', 'nṛpaḥ_never'}


def vowel_join(x, y):
    """final vowel x + initial vowel y -> list of (left_tail, right_head) spellings"""
    a, b = SAVARNA.get(x), SAVARNA.get(y)
    if a and a == b:
        return [(LONG[a], '')]
    if x in ('a', 'ā'):
        if (('a', y)) in GUNA:
            return [(GUNA[('a', y)] if y not in ('e', 'ai', 'o', 'au') else GUNA[('a', y)], '')]
    if x in ('i', 'ī'):
        return [('y' + y, '')]
    if x in ('u', 'ū'):
        return [('v' + y, '')]
    if x in ('ṛ', 'ṝ'):
        return [('r' + y, '')]
    if x == 'e':
        return [('e', "'")] if y == 'a' else [('a ' + y, ''), ('ay' + y, '')]
    if x == 'o':
        return [('o', "'")] if y == 'a' else [('a ' + y, ''), ('av' + y, '')]
    if x == 'ai':
        return [('ā ' + y, ''), ('āy' + y, '')]
    if x == 'au':
        return [('āv' + y, ''), ('ā ' + y, '')]
    return []


def join_pair(w1, w2):
    """All spellings of w1 followed by w2.

    Returns (left, right, hiatus) triples: `left` is settled text, `right` is the
    surface of w2 as changed (still open to the next junction), `hiatus` marks a
    vowel meeting a vowel with no sandhi (pragṛhya or licence)."""
    t1, t2 = tokens(w1), tokens(w2)
    if not t1 or not t2:
        return [(w1 + ' ', w2, False)]
    x, y = t1[-1], t2[0]
    s, rest2 = ''.join(t1[:-1]), ''.join(t2[1:])
    v = t1[-2] if len(t1) > 1 else ''
    R = lambda left, right, h=False: (left, right, h)
    if is_vowel(x) and is_vowel(y):
        out = []
        for tail, mark in vowel_join(x, y):
            if mark:                      # pūrvarūpa: initial a of w2 elided
                out.append(R(s, tail + "'" + rest2))
            elif ' ' in tail:             # ayādi with y/v dropped: hiatus kept
                out.append(R(s + tail.split(' ')[0] + ' ', w2))
            elif len(tail) > len(y) and tail.endswith(y) and tail[:-len(y)] in ('y', 'v', 'r', 'ay', 'av', 'āy', 'āv'):
                out.append(R(s + tail[:-len(y)], w2))
            else:                         # fusion: the new vowel opens w2
                out.append(R(s, tail + rest2))
        out.append(R(w1 + ' ', w2, True))
        return out
    if is_vowel(x):
        if y == 'ch':
            return [R(w1 + ' ', 'c' + w2), R(w1 + ' ', w2)]
        return [R(w1 + ' ', w2)]
    if x == 'ḥ':
        if w1 in ('saḥ', 'eṣaḥ') and not is_vowel(y):
            return [R(s + ' ', w2)] + ([R(s + ' ', 'c' + w2)] if y == 'ch' else [])
        if w1 in R_FINAL and (is_vowel(y) or y in VOICED):
            return [R(s + 'r' + ('' if is_vowel(y) else ' '), w2)]
        if w1 == 'bhoḥ' and (is_vowel(y) or y in VOICED):
            return [R(s + ' ', w2)]
        if y in ('c', 'ch'):
            return [R(s + 'ś', w2)]
        if y in ('ṭ', 'ṭh'):
            return [R(s + 'ṣ', w2)]
        if y in ('t', 'th'):
            return [R(s + 's', w2)]
        if y in ('ś', 'ṣ', 's'):
            return [R(w1 + ' ', w2), R(s + y, w2)]
        if y in ('k', 'kh', 'p', 'ph'):
            return [R(w1 + ' ', w2)]
        if v == 'a':
            if y == 'a':
                return [R(s[:-1] + 'o', "'" + rest2)]
            if is_vowel(y):
                return [R(s + ' ', w2)]
            if y in VOICED:
                return [R(s[:-1] + 'o ', w2)]
        if v == 'ā':
            if is_vowel(y) or y in VOICED:
                return [R(s + ' ', w2)]
        if v and is_vowel(v):
            if y == 'r':
                return [R(''.join(t1[:-2]) + LONG.get(v, v) + ' ', w2)]
            if is_vowel(y) or y in VOICED:
                return [R(s + 'r' + ('' if is_vowel(y) else ' '), w2)]
        return [R(w1 + ' ', w2)]
    if x == 'm':
        if is_vowel(y):
            return [R(w1, w2)]
        return [R(s + 'ṃ ', w2), R(w1 + ' ', w2)]
    if x in ('t', 'd'):
        if is_vowel(y):
            return [R(s + 'd', w2)]
        if y in ('c', 'ch'):
            return [R(s + 'c', w2)]
        if y in ('j', 'jh'):
            return [R(s + 'j', w2)]
        if y in ('ṭ', 'ṭh'):
            return [R(s + 'ṭ', w2)]
        if y in ('ḍ', 'ḍh'):
            return [R(s + 'ḍ', w2)]
        if y == 'l':
            return [R(s + 'l', w2)]
        if y in ('n', 'm'):
            return [R(s + 'n', w2), R(s + 'd ', w2)]
        if y == 'ś':
            return [R(s + 'c', 'ch' + rest2), R(s + 'c', w2)]
        if y == 'h':
            return [R(s + 'd', 'dh' + rest2), R(s + 'd ', w2)]
        if y in VOICED:
            return [R(s + 'd ', w2)]
        return [R(s + 't', w2), R(s + 't ', w2)]
    if x == 'n':
        if is_vowel(y):
            return ([R(s + 'nn', w2)] if v in SHORT else []) + [R(w1, w2)]
        if y in ('c', 'ch'):
            return [R(s + 'ṃś', w2)]
        if y in ('ṭ', 'ṭh'):
            return [R(s + 'ṃṣ', w2)]
        if y in ('t', 'th'):
            return [R(s + 'ṃs', w2)]
        if y in ('j', 'jh'):
            return [R(s + 'ñ', w2), R(w1 + ' ', w2)]
        if y in ('ḍ', 'ḍh'):
            return [R(s + 'ṇ', w2)]
        if y == 'l':
            return [R(s + 'ṃl', w2), R(s + 'm̐l', w2), R(s + 'l', w2)]
        if y == 'ś':
            return [R(s + 'ñ', 'ch' + rest2), R(s + 'ñ', w2), R(w1 + ' ', w2)]
        return [R(w1 + ' ', w2), R(w1, w2)]
    if x in ('k', 'g'):
        if y in NASALS:
            return [R(s + 'ṅ', w2), R(s + 'g ', w2)]
        if y == 'h':
            return [R(s + 'g', 'gh' + rest2), R(s + 'g ', w2)]
        if is_vowel(y) or y in VOICED:
            return [R(s + 'g', w2), R(s + 'g ', w2)]
        return [R(s + 'k', w2), R(w1 + ' ', w2)]
    if x in ('ṭ', 'ḍ'):
        if y in NASALS:
            return [R(s + 'ṇ', w2), R(s + 'ḍ ', w2)]
        if is_vowel(y) or y in VOICED:
            return [R(s + 'ḍ', w2), R(s + 'ḍ ', w2)]
        return [R(w1, w2), R(w1 + ' ', w2)]
    if x in ('p', 'b'):
        if y in NASALS:
            return [R(s + 'm', w2), R(s + 'b ', w2)]
        if is_vowel(y) or y in VOICED:
            return [R(s + 'b', w2), R(s + 'b ', w2)]
        return [R(w1, w2), R(w1 + ' ', w2)]
    if x == 'ṅ':
        if is_vowel(y) and v in SHORT:
            return [R(s + 'ṅṅ', w2), R(w1, w2)]
        return [R(w1, w2), R(w1 + ' ', w2)]
    return [R(w1, w2), R(w1 + ' ', w2)]


def norm(s):
    """Spelling-neutral comparison form: no spaces, dandas, avagraha or hyphens;
    every nasal before a consonant written as anusvāra."""
    s = s.replace('m̐', 'ṃ').replace('·', '')
    s = re.sub(r"[\s|'’\-0-9]", '', s)
    s = re.sub(r'[ṅñṇnm](?=(?:k|g|c|j|ṭ|ḍ|t|d|p|b|y|r|l|v|ś|ṣ|s|h|n|m))', 'ṃ', s)
    return s


def _prefix(goal, n):
    """Is n a possible start of goal? A nasal at the very end of n may yet
    become anusvāra once the next consonant is known."""
    if goal.startswith(n):
        return True
    return bool(n) and n[-1] in 'ṅñṇnm' and goal.startswith(n[:-1] + 'ṃ')


def rejoin(lines, target):
    """lines: list of word lists (IAST pada forms). target: recited text (IAST).

    Returns (True, hiatus_junctions) when some rejoining spells the target, else
    (False, index of the first word that could not be placed). A line break may
    be pausal or joined. Junction k is the one between word k-1 and word k,
    counting words across the whole mantra from 0."""
    words = []
    for line in lines:
        for wi, w in enumerate(line):
            words.append((w, wi == len(line) - 1))
    if not words:
        return norm(target) == '', []
    goal = norm(target)
    states = [('', words[0][0], ())]
    for k in range(1, len(words)):
        w2, line_end = words[k][0], words[k - 1][1]
        new, seen = [], set()
        for built, last, hi in states:
            options = join_pair(last, w2)
            if line_end:  # a line break is a pause: the unjoined form comes first
                options = [(last + ' ', w2, False)] + options
            for left, right, h in options:
                cand = built + left
                key = (norm(cand), right)
                if key in seen or not _prefix(goal, norm(cand)):
                    continue
                seen.add(key)
                new.append((cand, right, hi + ((k,) if h else ())))
        if not new:
            return False, k
        states = new
    for built, last, hi in states:
        if norm(built + last) == goal:
            return True, list(hi)
    return False, len(words)
