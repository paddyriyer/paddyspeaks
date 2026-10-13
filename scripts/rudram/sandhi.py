"""External sandhi for the Taittirīya text — the proof of every padaccheda.

The padaccheda lists a unit's words in their own (pausal) forms. `proves()`
rejoins them by the rules of external sandhi and succeeds only if some
rejoining spells the Saṃhitā of the unit exactly — after the spelling
equivalences of `norm()` (spacing, svara, nasal spelling, jihvāmūlīya /
upadhmānīya). So a missing word, an invented one or a wrong ending fails.

The rules are the ones this text uses (Pāṇini 6.1, 8.2–8.4, and the Vedic
options the Taittirīya Prātiśākhya records):

  vowels     savarṇa-dīrgha, guṇa, vṛddhi, yaṇ; -e/-o before a vowel → -a
             (ayādi with y/v lost) or -ay/-av; -e/-o + a → -e'/-o' (pūrvarūpa)
             or the Vedic non-elision (नमो अस्तु, ते अस्तु); -ai → -ā
  visarga    -aḥ → -o before voiced sounds, -o' before a, -a before other
             vowels; -āḥ → -ā; other -ḥ → -r (before r: lengthening);
             ḥ → ś/ṣ/s before c/ṭ/t; before a sibilant the doubled sibilant
             (नमश्शर्वाय) or ḥ; before k/p jihvāmūlīya / upadhmānīya (ᳵ ᳶ) or ḥ,
             and the Vedic s before p (अन्धसस्पते); saḥ/eṣaḥ → sa/eṣa
  consonants voicing before voiced sounds and vowels; t → c j ḍ l n before
             c j ḍ l n, t+ś → c ch, t+h → d dh; k/ṭ/t/p → nasal before a nasal;
             m → any nasal before a consonant; n → ṃś/ṃs before c/t,
             ñ before j/ś, l̐l before l, nn after a short vowel before a vowel,
             nts before s; -ān/-īn/-ūn → -ām̐ etc. before a vowel, h, y, v, r
             (dīrghād aṭi samānapāde); ch → cch after a vowel
  pause      no sandhi across a danda or a pañcāśat mark [N]

A junction the rules do not produce must be declared in the analysis
(`sandhi_exceptions`: index of the word before it, kind, note) — a pragṛhya
hiatus, a Vedic lengthening (मृडा, रक्षा), a doubled consonant of the
recitation (परि ब्भुज). The checker accepts a declared junction joined as the
text shows it and lists every one on the page.
"""
import re
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from translit import dev2iast  # noqa: E402

VOWELS = ['ai', 'au', 'ā', 'ī', 'ū', 'ṝ', 'ḹ', 'a', 'i', 'u', 'ṛ', 'ḷ', 'e', 'o']
CONS = ['kh', 'gh', 'ch', 'jh', 'ṭh', 'ḍh', 'th', 'dh', 'ph', 'bh',
        'k', 'g', 'ṅ', 'c', 'j', 'ñ', 'ṭ', 'ḍ', 'ṇ', 't', 'd', 'n', 'p', 'b', 'm',
        'y', 'r', 'l', 'ḻ', 'v', 'ś', 'ṣ', 's', 'h', 'ṃ', 'ḥ', 'ẖ', 'ḫ', 'm̐']
TOKENS = sorted(VOWELS + CONS, key=len, reverse=True)
VOICED = set('g gh j jh ḍ ḍh d dh b bh y r l v h ṅ ñ ṇ n m'.split())
NASAL = set('ṅ ñ ṇ n m'.split())
SHORT = set('a i u ṛ ḷ'.split())
LONG = {'a': 'ā', 'i': 'ī', 'u': 'ū', 'ṛ': 'ṝ'}
SAVARNA = {'a': 'a', 'ā': 'a', 'i': 'i', 'ī': 'i', 'u': 'u', 'ū': 'u', 'ṛ': 'ṛ', 'ṝ': 'ṛ'}
VOICE = {'k': 'g', 'c': 'j', 'ṭ': 'ḍ', 't': 'd', 'p': 'b'}
NASAL_OF = {'k': 'ṅ', 'ṭ': 'ṇ', 't': 'n', 'p': 'm', 'g': 'ṅ', 'd': 'n'}
PAUSE = '#'


def toks(s):
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


def isv(t):
    return t in VOWELS


def vowel_options(x, y):
    """final vowel x + initial vowel y → [(left_tail_replacing_x, right_head_replacing_y)]."""
    a, b = SAVARNA.get(x), SAVARNA.get(y)
    out = []
    if a and a == b:
        out.append((LONG[a], ''))
    if x in ('a', 'ā'):
        guna = {'i': 'e', 'ī': 'e', 'u': 'o', 'ū': 'o', 'ṛ': 'ar', 'ṝ': 'ar',
                'e': 'ai', 'ai': 'ai', 'o': 'au', 'au': 'au'}
        if y in guna:
            out.append((guna[y], ''))
    if x in ('i', 'ī') and y not in ('i', 'ī'):
        out.append(('y', y))
    if x in ('u', 'ū') and y not in ('u', 'ū'):
        out.append(('v', y))
    if x in ('ṛ', 'ṝ') and y not in ('ṛ', 'ṝ'):
        out.append(('r', y))
    if x in ('e', 'o'):
        if y == 'a':
            out.append((x, "'"))                 # pūrvarūpa: नमोऽस्तु
            out.append((x + ' ', 'a'))           # Vedic non-elision: नमो अस्तु
        else:
            out.append(('a ', y))                # ते इषवे → त इषवे
            out.append(('ay' if x == 'e' else 'av', y))
    if x == 'ai':
        out.append(('ā ', y))
        out.append(('āy', y))
    if x == 'au':
        out.append(('āv', y))
        out.append(('ā ', y))
    return out


def junction(w1, w2):
    """All spellings of the meeting of w1 and w2: [(left_settled, right_open)].
    `left_settled` is w1 as changed (closed); `right_open` is w2 as changed."""
    t1, t2 = toks(w1), toks(w2)
    x, y = t1[-1], t2[0]
    stem = ''.join(t1[:-1])
    rest = ''.join(t2[1:])
    v = t1[-2] if len(t1) > 1 else ''
    out = []
    plain = (w1 + ' ', w2)

    if isv(x) and isv(y):
        for tail, head in vowel_options(x, y):
            if head == "'":
                out.append((stem + tail, "'" + rest))
            elif tail.endswith(' '):
                out.append((stem + tail, (head or y) + rest if head != '' else rest))
            elif head == '':
                out.append((stem, tail + rest))  # fusion: the new vowel opens w2
            else:
                out.append((stem + tail, head + rest))
        return out
    if isv(x):
        if y == 'ch':
            return [(w1, 'c' + w2), plain]
        return [plain]

    if x == 'ḥ':
        if w1 in ('saḥ', 'eṣaḥ') and not isv(y):
            out.append((stem + ' ', w2))
        if y in ('c', 'ch'):
            out.append((stem + 'ś', w2))
        elif y in ('ṭ', 'ṭh'):
            out.append((stem + 'ṣ', w2))
        elif y in ('t', 'th'):
            out.append((stem + 's', w2))
        elif y in ('ś', 'ṣ', 's'):
            out.append((stem + y, w2))           # नमश्शर्वाय
            out.append((w1 + ' ', w2))
        elif y in ('k', 'kh'):
            out.append((stem + 'ẖ ', w2))
            out.append((w1 + ' ', w2))
        elif y in ('p', 'ph'):
            out.append((stem + 'ḫ ', w2))
            out.append((w1 + ' ', w2))
            out.append((stem + 's', w2))         # Vedic: अन्धसस्पते
        elif v == 'a':
            if y == 'a':
                out.append((stem[:-1] + 'o', "'" + rest))
                out.append((stem[:-1] + 'o ', w2))   # Vedic: नमो अस्तु
            elif isv(y):
                out.append((stem + ' ', w2))
            elif y in VOICED:
                out.append((stem[:-1] + 'o ', w2))
        elif v == 'ā':
            if isv(y) or y in VOICED:
                out.append((stem + ' ', w2))
        elif v and isv(v):
            if y == 'r':
                out.append((''.join(t1[:-2]) + LONG.get(v, v) + ' ', w2))
            elif isv(y):
                out.append((stem + 'r', w2))
            elif y in VOICED:
                out.append((stem + 'r ', w2))
        return out or [plain]

    if x == 'm':
        if isv(y):
            return [(w1, w2), plain]
        return [(stem + 'ṃ ', w2)]               # any nasal; norm() unifies them

    if x == 'n':
        if isv(y) and v in SHORT:
            out.append((w1 + 'n', w2))           # अदृशन्न् अदृशन्
        if v in ('ā', 'ī', 'ū') and (isv(y) or y in ('h', 'y', 'v', 'r')):
            out.append((stem + 'm̐ ', w2))           # बाणवाँ उत
        if y in ('c', 'ch'):
            out.append((stem + 'm̐ś', w2))       # अहीँश्च
            out.append((stem + 'ṃś', w2))
        if y in ('t', 'th'):
            out.append((stem + 'm̐s', w2))
            out.append((stem + 'ṃs', w2))
        if y in ('j', 'jh', 'ś'):
            out.append((stem + 'ñ', w2))
            if y == 'ś':
                out.append((stem + 'ñ', 'ch' + rest))
        if y == 'l':
            out.append((stem + 'm̐l', w2))
        if y == 's':
            out.append((w1 + 't', w2))           # जम्भयन्त्सर्वाः
        if y in ('ḍ', 'ḍh', 'ṭ', 'ṭh'):
            out.append((stem + 'ṇ', w2))
        out.append(plain)
        return out

    if x in ('k', 'ṭ', 't', 'p'):
        if y in NASAL:
            out.append((stem + NASAL_OF[x], w2))
        if x == 't':
            if y in ('c', 'ch'):
                out.append((stem + 'c', w2))
            elif y in ('j', 'jh'):
                out.append((stem + 'j', w2))
            elif y in ('ḍ', 'ḍh'):
                out.append((stem + 'ḍ', w2))
            elif y == 'l':
                out.append((stem + 'l', w2))
            elif y == 'ś':
                out.append((stem + 'c', 'ch' + rest))
                out.append((stem + 'c', w2))
            elif y == 'h':
                out.append((stem + 'd', 'dh' + rest))
        if isv(y) or y in VOICED:
            out.append((stem + VOICE[x] + ('' if isv(y) else ' '), w2))
        if not isv(y):
            out.append(plain)
        return out or [plain]
    return [plain]


def norm(s):
    """The spelling equivalences under which a rejoining must equal the text."""
    s = s.replace('ẖ', 'ḥ').replace('ḫ', 'ḥ')
    s = re.sub(r'\s*\[\d+\]\s*', PAUSE, s)
    s = re.sub(r'\s*\|+\s*', PAUSE, s)
    s = re.sub('#+', PAUSE, s)
    s = re.sub('([vyl])̐ ?', 'N', s)
    s = s.replace('m̐', 'N')
    s = re.sub(r'(ṃ|m|n) ?(?=[nm])', 'N', s)        # कल्पताम्मनः ≡ कल्पतां मनः
    s = re.sub(r'(ṃ|m|ṅ|ñ|ṇ|n) ?(?=(kh|gh|ch|jh|ṭh|ḍh|th|dh|ph|bh|[kgcjṭḍtdpbyvlrśṣsh]))', 'N', s)
    s = s.replace('ṃ', 'N')
    s = s.replace(' ', '').replace('·', '').replace('‌', '')
    s = s.strip(PAUSE)
    return s


def proves(words, samhita_dev, exceptions=None, open_end=False):
    """True (and the rejoined text) when the words rejoin to the Saṃhitā.

    words: the padaccheda in Devanagari; '।' entries mark a pause (danda).
    exceptions: {index_of_word_before_junction: {'left': surface of that word,
    'right': surface of the next}} — the junction is taken as the text spells it."""
    exceptions = exceptions or {}
    target = norm(dev2iast(samhita_dev))
    ws = [dev2iast(w) if w not in ('।', '॥') else PAUSE for w in words]
    # pauses that are only pañcāśat marks in the text: the words still meet
    # with their pausal forms, which the PAUSE option below allows.
    best = ['']

    memo = {}

    def dfs(i, settled, open_word):
        key = (i, settled.replace(' ', ''), open_word)
        if key in memo:
            return memo[key]
        memo[key] = r = _dfs(i, settled, open_word)
        return r

    def _dfs(i, settled, open_word):
        n = norm(settled)[:-2]      # the last letters may still change with the next word
        if not target.startswith(n):
            return False
        if len(n) > len(best[0]):
            best[0] = n
        if i == len(ws) - 1:
            if norm(settled + open_word) == target:
                return True
            if open_end:      # a batch that stops mid-anuvāka: the last word may
                for probe in ('a', 'i', 'u', 'na', 'ta', 'ca', 'sa', 'śa', 'ka', 'pa', 'ra', 'ya', 'va'):
                    for left, _ in junction(open_word, probe):   # take its next-word form
                        if norm(settled + left) == target:
                            return True
            return False
        nxt = ws[i + 1]
        if nxt == PAUSE:
            return dfs(i + 1, settled + open_word + PAUSE, '') if i + 2 <= len(ws) else False
        if open_word == '':
            return dfs(i + 1, settled, nxt)
        opts = []
        k = word_index[i]
        if k in exceptions:
            ex = exceptions[k]
            left = dev2iast(ex['left']) if ex.get('left') else open_word
            right = dev2iast(ex['right']) if ex.get('right') else nxt
            opts.append((left + ' ', right))
            opts.append((left, right))
        else:
            opts = junction(open_word, nxt)
        opts = opts + [(open_word + PAUSE, nxt)]       # a pañcāśat pause
        t_o = toks(open_word)
        if len(t_o) > 1 and t_o[-1] == 'n' and t_o[-2] in SHORT and toks(nxt)[0] in VOWELS:
            opts.append((open_word + 'n' + PAUSE, nxt))   # अस्मिन्न् [21] अनातुरम्: nn kept across the mark
        for left, right in opts:
            if dfs(i + 1, settled + left, right):
                return True
        return False

    # index of the real word at each position (pauses excluded), for exceptions
    word_index, k = [], -1
    for w in ws:
        if w != PAUSE:
            k += 1
        word_index.append(k)
    sys.setrecursionlimit(10000)
    if not ws:
        return False, ''
    ok = dfs(0, '', ws[0]) if ws[0] != PAUSE else False
    return ok, best[0]


def target_of(samhita_dev):
    return norm(dev2iast(samhita_dev))
