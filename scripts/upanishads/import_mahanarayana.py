#!/usr/bin/env python3
"""Import the Mahānārāyaṇa Upaniṣad (Taittirīya Āraṇyaka 10): witnesses,
commentaries and parallel passages.

Re-runnable and auditable, like import_taittiriya.py: it reads public corpora
checked out locally and writes `upanishads/mahanarayana/edition/witnesses/`.
`text.json` is generated from the base witness by `--text` (then hand-kept);
check.py proves it against the base witness letter by letter.

  python3 scripts/upanishads/import_mahanarayana.py --yajuh <vishvAsa/vedAH_yajuH> --raw <sanskrit/raw_etexts> [--text]

The Upaniṣad survives in recensions of different length and order
(docs/UPANISHADS-EDITION.md §The Mahānārāyaṇa):

  MD  BASE. The 80-anuvāka recitation text of Taittirīya Āraṇyaka 10, with svara
      (vishvAsa `AraNyakam/mUlam/muralIdharaH.md`, prapāṭhaka 10). Its units are the
      source's own divisions «॥ ०। १०। A। U॥» (A = anuvāka 1–80, U = the running
      unit number 1–101, the usual citation TA 10.A.U). After each anuvāka the
      source prints its anukramaṇī (an index phrase ending «॥ A॥»): that is an
      index, not text, and is kept in the witness file under `anukramani`, not in
      the edition's text (as in the Taittirīya). The `sAyaNa-pAThaH` copy of the
      same text is the same source and is not collated as a second witness.
  T   The Tirupati (Rāṣṭriya Saṃskṛta Vidyāpīṭha) e-text in eBhāratī, headed by
      anuvāka, 80 anuvākas, mostly without svara. It writes out in full several
      passages the base cites only by their opening words (pratīka).
  S   Sāyaṇa's 64-anuvāka text, printed anuvāka by anuvāka with his
      Vedārthaprakāśa (Ānandāśrama 1927, via vishvAsa). A different recension and
      order: collated through the concordance in edition.json (scope 'groups').

Commentaries: the anonymous bhāṣya printed with the 80-anuvāka text in the
Ānandāśrama pariśiṣṭa (keyed by its anuvāka; its author is not known — never
Sāyaṇa); Sāyaṇa's Vedārthaprakāśa (on his 64 anuvākas); Bhaṭṭa Bhāskara's
Jñānayajña (on the Drāviḍa 64 anuvākas), both reached through the concordance.
"""
import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
import import_witnesses as IW  # noqa: E402
from textlib import letters, phon, strip_accents  # noqa: E402

ROOT = IW.ROOT
ED = os.path.join(ROOT, 'upanishads', 'mahanarayana', 'edition')
WIT = os.path.join(ED, 'witnesses')
AR = 'taittirIyam/sArasvata-vibhAgaH/AraNyakam/'
MNU = AR + 'sarva-prastutiH/06_mahA-nArAyaNopaniShat/'
dnum, read = IW.dnum, IW.read
DIG = '०१२३४५६७८९'


def devnum(n):
    return ''.join(DIG[int(d)] for d in str(n))


def write(name, obj):
    os.makedirs(WIT, exist_ok=True)
    with open(os.path.join(WIT, name), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('wrote', os.path.relpath(os.path.join(WIT, name), ROOT))


def ws(s):
    return re.sub(r'\s+', ' ', s).strip()


MARK = re.compile(r'(?:॥\s*)?०।\s*१०।\s*([०-९]+)।\s*([०-९]+)\s*॥')


# ------------------------------------------------------------------ MD (base)
def md_text(yajuh):
    """The base: prapāṭhaka 10 of muralIdharaH.md, cut at its unit marks."""
    rel = AR + 'mUlam/muralIdharaH.md'
    t = read(os.path.join(yajuh, rel))
    t = t[t.index('## आरण्यके दशमः प्रश्नः'):]
    t = t.split('\n', 1)[1]
    paras = [ws(p) for p in re.split(r'\n\s*\n', t) if ws(p)]
    units, anukr, shanti = {}, {}, []
    cur = None          # [U, text so far]
    last_a = None
    for p in paras:
        m = re.match(r'^([०-९]+)\s+(.*)$', p)
        if m and dnum(m.group(1)) == 0:
            shanti.append(m.group(2))
            continue
        if m:
            cur = [dnum(m.group(1)), m.group(2)]
        elif cur is not None:
            cur[1] += ' ' + p
        else:
            # text after a unit mark: the anukramaṇī of the anuvāka just ended
            anukr.setdefault(str(last_a), []).append(p)
            continue
        mk = MARK.search(cur[1])
        if not mk:
            continue
        a, u = dnum(mk.group(1)), dnum(mk.group(2))
        if u != cur[0]:
            raise SystemExit(f'MD: paragraph {cur[0]} closes with unit mark {u}')
        body = ws(cur[1][:mk.start()])
        units[f'10.{a}.{u}'] = body
        rest = ws(cur[1][mk.end():])
        if rest:
            anukr.setdefault(str(a), []).append(rest)
        last_a = a
        cur = None
    return rel, units, anukr, shanti


def by_anuvaka(units):
    out = {}
    for k, v in units.items():
        a = k.rsplit('.', 1)[0]
        out.setdefault(a, []).append(v)
    return out


# ------------------------------------------------------------- T: Tirupati
T_REL = 'mixed/ebhAratI-sampat/upaniShadaH/upaniShadasambaddhapustakAni/mahAnArAyaNopaniShat.md'


def t_lines(raw):
    t = read(os.path.join(raw, T_REL)).split('+++', 2)[-1]
    t = t.replace('{\\\\म्+}', 'ꣳ').replace('{\\म्+}', 'ꣳ')
    out, note = [], False
    for ln in t.split('\n'):
        s = ln.replace('*', '').replace('\\', '').strip()
        if 'पाठभेद' in s:              # the e-text's own note of variant gāyatrīs, «[पाठभेदः …]»
            note = True
            continue
        if note:
            if ']' in s:
                note = False
            continue
        s = s.replace('#', '').strip()
        if not s or re.fullmatch(r'[-\s\]\[]+', s) or s.startswith('[[') or 'Download Text' in s or 'Source:' in s:
            continue
        if re.fullmatch(r'(?:अथ\s*)?\S+ऽ(?:नुवाकः|वानुकः)\s*।?', s):
            continue                    # a heading «अथ प्रथमोऽनुवाकः।» / «तृतीयोऽनुवाकः ।»
        if re.fullmatch(r'(?:परमात्म\s*-\s*हिरण्यगर्भ\s*-\s*सूक्त|दुर्गा सूक्तम् ।|त्रिसुपर्णमन्त्रः [०-९१-३]+|त्रिसुपर्णमन्त्रः \d)', s):
            continue                    # the e-text's titles of the hymns, not text
        out.append(s)
    return out


def align(lines, targets, lead=24, need=0.72):
    """Cut a witness's lines into the edition's records: each record starts at the
    first line, after the previous record's start, whose letters (with the next
    lines') begin like the record (fuzzy: a witness may vary in its first words).
    Returns {key: [lines]} and the keys whose opening was not found."""
    import difflib
    L = [letters(x) for x in lines]
    starts, pos, missing = {}, 0, []
    for k, txt in targets.items():
        want = letters(txt)[:lead]
        hit = None
        for i in range(pos, len(L)):
            cand = ''.join(L[i:i + 4])[:len(want) + 4]
            if cand.startswith(want) or difflib.SequenceMatcher(None, want, cand[:len(want)]).ratio() >= need:
                hit = i
                break
        if hit is None:
            missing.append(k)
            continue
        starts[k] = hit
        pos = hit + 1
    keys = list(starts)
    out = {}
    for j, k in enumerate(keys):
        end = starts[keys[j + 1]] if j + 1 < len(keys) else len(lines)
        if j + 1 == len(keys):          # the closing śānti and colophon are not the last record
            end = next((i for i in range(starts[k] + 1, len(lines)) if STOP.search(lines[i])), end)
        out[k] = lines[starts[k]:end]
    return out, missing


STOP = re.compile(r'^(?:ॐ\s*)?(?:शं नो मित्रः|स\s*ह\s*ना\s*ववतु|इति महानारायण)')


# ------------------------------------- the Ānandāśrama files (Sāyaṇa; pariśiṣṭa)
SVARA = re.compile('[॒॑᳚]')
DEBRIS = [
    re.compile(r'^\[\[\d+\]\]$'),                          # page numbers
    re.compile(r'^_+$'),
    re.compile(r'^\[प्रपा॰.*\]'), re.compile(r'तैत्तिरीयारण्यकम्।$'),   # running heads
    re.compile(r'^परिशिष्टत्वेन संगृहीतः'), re.compile(r'^\[अनु०.*\]'), re.compile(r'सभाष्यो दशमप्रपाठकः'),
    re.compile(r'^\*'), re.compile(r'^[०-९]+\s+\S{1,3}\.'),          # footnotes «* ख. झ. …», «१ घ. ४७।»
    re.compile(r'^\+\+\+|^title ='),
]
COLO = re.compile(r'^इति\s*(?:कृष्णयजुर्वेदीय|श्रीमत्स)')


def debris(s):
    return any(p.search(s) for p in DEBRIS)


def ananda_file(path, interleaved=False):
    """One anuvāka file of the Ānandāśrama print as vishvAsa keys it: its own
    anuvāka number (from the closing colophon «… ऽनुवाकः॥ N॥»), the mūla and the
    commentary. The mūla is printed first and closed by a colophon («इति
    कृष्णयजुर्वेदीय…»); the accented lines before it are the mūla, the unaccented
    one(s) the commentator's introductory sentence; after it everything is
    commentary (its quotations keep their svara). A file that prints mūla and
    commentary in turn (`interleaved`, Sāyaṇa's long first anuvāka) is split
    line by line instead: accented lines are mūla. Page numbers, running heads,
    footnotes, colophons and the opening śānti are print matter and left out."""
    t = read(path)
    nums = re.findall(r'नुवाकः\s*॥\s*([०-९]+)\s*॥', t)
    mula, comm, notes, cont, after = [], [], [], False, False
    for ln in t.split('\n'):
        s = ln.strip()
        if not s or debris(s) or re.match(r'^(?:\(?\s*)?(?:अथ|तत्र)\s.*(?:नुवाकः|प्रपाठकः|उपनिषत्)।?\)?$', s):
            continue
        if COLO.match(s):
            after = True
            cont = not re.search(r'नुवाकः', s)
            continue
        if cont:                     # the colophon runs on to the next lines
            cont = not re.search(r'नुवाकः', s)
            continue
        if not after and re.search(r'नाववतु|विद्विषावहै|शान्तिः शान्तिः|शांतिः', strip_accents(s)):
            continue                 # the śānti printed before the first anuvāka
        if SVARA.search(s) and (interleaved or not after):
            if re.match(r'^इति\s', strip_accents(s)):
                notes.append(s)      # the print's own index line or a passage cited in full after «इति»
                continue
            # the print closes each mantra with «, इति», the mark of a quotation
            s = re.sub(r'\(\s*[^)]{0,12}\?\s*\)', ' ', s)          # the editor's queries «(?)»
            mula.append(re.sub(r',\s*इति\s*(?=[।॥]|$)', ' ', s).strip())
        else:
            comm.append(s)
    return {'n': dnum(nums[-1]) if nums else None, 'mula': ws(' '.join(mula)), 'comm': ws(' '.join(comm)), 'notes': notes}


def ananda_dir(yajuh, rel, interleaved=()):
    out = {}
    d = os.path.join(yajuh, rel)
    for fn in sorted(os.listdir(d)):
        m = re.match(r'^(\d+)\.md$', fn)
        if m:
            out[int(m.group(1))] = ananda_file(os.path.join(d, fn), int(m.group(1)) in interleaved)
    return out


# ---------------------------------------------------- Bhaṭṭa Bhāskara (Drāviḍa)
def bhaskara(yajuh):
    rel = AR + 'bhaTTa-bhAskara-bhAShyam/6.md'
    t = read(os.path.join(yajuh, rel)).split('+++', 2)[-1]
    out = {}
    for sec in re.split(r'\n## ', '\n' + t)[1:]:
        head_, _, body = sec.partition('\n')
        m = re.match(r'\s*([०-९]+)', head_)
        if not m:
            continue
        body = re.sub(r'(?m)^#+\s*[०-९]+\s*$', ' ', body)
        body = re.sub(r'(?m)^\d+', '', body)          # the source's line numbers
        out[str(dnum(m.group(1)))] = ws(body)
    return rel, out


# ------------------------------------------------------------- concordance
def shingles(s, n=8):
    p = phon(s)
    return {p[i:i + n] for i in range(max(0, len(p) - n + 1))}


def concord(ours, theirs, min_hits=8, contained=None):
    """{our anuvāka: [their keys]}: each of their anuvākas goes to the one of ours
    it shares most 8-letter sound shingles with (conservative: an anuvāka of theirs
    that covers two of ours is mapped to one; a record may still cite any of their
    anuvākas by its own number, e.g. «sayana:1»)."""
    osh = {k: shingles(v) for k, v in ours.items()}
    tsh = {k: shingles(v) for k, v in theirs.items()}
    out = {k: [] for k in ours}
    for tk, t in tsh.items():
        hits = {k: len(o & t) for k, o in osh.items()}
        best = max(hits, key=lambda k: hits[k] / max(1, len(osh[k]) ** 0.5))
        for k, h in hits.items():
            if (k == best and h >= min_hits) or (contained and osh[k] and h >= contained * len(osh[k]) and h >= min_hits):
                out[k].append(tk)
    return {k: sorted(set(v), key=int) for k, v in out.items()}


def concord_comm(ours, comm, min_hits=15):
    """For a commentary without its own mūla (Bhāskara): each of its sections goes
    to the anuvāka of ours whose words it quotes most."""
    osh = {k: shingles(v) for k, v in ours.items()}
    out = {}
    for ck, txt in comm.items():
        s = shingles(txt)
        best = max(((len(s & o), k) for k, o in osh.items()), default=(0, None))
        if best[0] >= min_hits:
            out.setdefault(best[1], []).append(ck)
    return out


# ------------------------------------------------------------- collation
ORTHO = {
    ('स्', 'ः'): 'a visarga before a sibilant: the recitation text writes the sibilant doubled (…स्स…), the other the visarga (…ः स…)',
    ('ष्', 'ः'): 'a visarga before ष: the recitation text writes ष्ष, the other ः ष',
    ('श्', 'ः'): 'a visarga before श: the recitation text writes श्श, the other ः श',
    ('ग्', 'ं'): 'the anusvāra before a sibilant, which the Taittirīya recitation writes ग्ं / ग्श् (पशूग्श्च), the other ं',
    ('ग्ग्', 'ं'): 'the anusvāra written ग्ग् in the recitation text, ं in the other',
    ('छ', 'च्ह'): 'छ keyed as च्ह in the e-text (the transliteration scheme’s chh)',
    ('ंछ', 'च्ह'): 'छ keyed as च्ह in the e-text',
    ('ळ', 'ड'): 'the Vedic ळ written ड',
    ('ऱ', 'र'): 'the dotted ऱ of the recitation text written र',
    ('रृ', 'ऋ'): 'the vowel ṛ written रृ in the recitation text',
}


def ortho(a, b):
    if (a, b) in ORTHO:
        return ORTHO[(a, b)]
    if (b, a) in ORTHO:
        return ORTHO[(b, a)]
    return None


def opcodes(base, other):
    import difflib
    a, b = letters(base), letters(other)
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    return a, b, [(i1, i2, j1, j2) for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag != 'equal']


def excerpt(raw, la, j1, j2, pad=6):
    """A readable excerpt of a witness around its letters la[j1:j2]: the shortest
    run of its words whose letters contain the spot with a little context."""
    want = la[max(0, j1 - pad):j2 + pad]
    words = strip_accents(raw).split()
    lw = [letters(w) for w in words]
    for n in range(1, 40):
        for i in range(0, max(1, len(words) - n + 1)):
            if want in ''.join(lw[i:i + n]):
                return ' '.join(words[i:i + n])
    return want


def cut(x, n=60):
    return (x[:n] + '…') if len(x) > n else (x or '—')


def classify(at, wid, base_txt, wit_raw, other_id, other_raw, names):
    W = names[wid][0].upper() + names[wid][1:]
    a, b, ops = opcodes(base_txt, wit_raw)
    lo = letters(other_raw) if other_raw else ''
    out = []
    for i1, i2, j1, j2 in ops:
        fa, fb = a[i1:i2], b[j1:j2]
        rd = excerpt(wit_raw, b, j1, j2)
        o = ortho(fa, fb)
        if fa == '' and fb == 'अ' or fa == '्य' and fb == 'िअ':
            o = 'a vowel in hiatus written apart (…ो अ…, …ि अ…) where the recitation text joins or elides it'
        if o:
            out.append({'at': at, 'witness': wid, 'base': fa, 'reading_letters': fb, 'class': 'orthographic', 'reading': rd,
                        'note': f'Spelling only: {o}.'})
            continue
        bw = a[max(0, i1 - 8):i2 + 8]                       # the base reading with context
        ww = a[max(0, i1 - 8):i1] + fb + a[i2:i2 + 8]       # the witness reading with the base's context
        long_ = len(fa) + len(fb) > 6
        if lo and bw in lo and ww not in lo:
            if long_:
                what = f'adds «{cut(fb)}»' if not fa else f'omits «{cut(fa)}»' if not fb else f'reads «{cut(fb)}» for «{cut(fa)}»'
                out.append({'at': at, 'witness': wid, 'base': fa, 'reading_letters': fb, 'class': 'variant', 'reading': rd,
                            'note': f'{W} {what} (letters as collated); the base and {names[other_id]} agree against it.'})
            else:
                out.append({'at': at, 'witness': wid, 'base': fa, 'reading_letters': fb, 'class': 'witness-error', 'reading': rd,
                            'note': f'{W} alone reads «{cut(fb)}» for «{cut(fa)}»; the base and {names[other_id]} agree.'})
        elif lo and ww in lo and bw not in lo:
            out.append({'at': at, 'witness': wid, 'base': fa, 'reading_letters': fb, 'class': 'review', 'reading': rd,
                        'note': f'{W} and {names[other_id]} agree on «{cut(fb)}» where the base reads «{cut(fa)}»: to be checked against the printed sources before the text is changed.'})
        else:
            out.append({'at': at, 'witness': wid, 'base': fa, 'reading_letters': fb, 'class': 'review', 'reading': rd,
                        'note': f'{W} reads «{cut(fb)}» for «{cut(fa)}»; the other witness does not settle it (letters as collated).'})
    return out


# ------------------------------------------------------------------ text.json
def unit_lines(body, u):
    """A unit set out sentence by sentence (a line ends at a daṇḍa), without svara;
    the last line carries the unit's running number."""
    t = strip_accents(body).replace('ँ', 'ं')
    parts = [p.strip() for p in re.split(r'(?<=।)\s+', t) if p.strip()]
    parts[-1] = re.sub(r'\s*[।॥]+\s*$', '', parts[-1]) + f' ॥ {devnum(u)} ॥'
    return parts


def make_text(units, shanti):
    anus = {}
    for k, body in units.items():
        _, a, u = k.split('.')
        anus.setdefault(int(a), []).append({'n': int(u), 'id': k, 'lines': unit_lines(body, int(u))})
    sh = [strip_accents(x) for x in shanti[:1]]
    sh_lines = [p.strip() for p in re.split(r'(?<=।)\s+', sh[0]) if p.strip()] if sh else []
    return {
        '$comment': 'THE SANSKRIT of the Mahānārāyaṇa Upaniṣad, the 80-anuvāka recitation text of Taittirīya Āraṇyaka 10. Base witness MD. Units are the base’s own divisions «॥ ०। १०। A। U॥»: a unit is cited 10.A.U, U being the running number (1–101) printed at its end. Each unit is set out sentence by sentence (a line ends at a daṇḍa). Generated once by import_mahanarayana.py --text, then hand-kept: check.py proves letters(text) = letters(base) with the logged corrections applied. No svara here: the accented text is shown from MD as keyed. The anukramaṇī the base prints after each anuvāka is an index, not text, and is kept in the witness file.',
        'id': 'mahanarayana',
        'title': {'sa': 'महानारायणोपनिषत्', 'iast': 'Mahānārāyaṇopaniṣat', 'en': 'Mahānārāyaṇa Upaniṣad'},
        'veda': 'Kṛṣṇa Yajurveda',
        'recension': 'Taittirīya; the 80-anuvāka recitation text',
        'location': 'Taittirīya Āraṇyaka 10',
        'base': 'MD',
        'structure': 'prapathaka',
        'count': len(anus),
        'shanti': {'lines': sh_lines, 'note': 'The śānti-pāṭha (saha nāvavatu), which the base prints before the first anuvāka and again after the last; it is set apart here and is not numbered or analysed with the text.', 'source': 'MD, the opening of prapāṭhaka 10'},
        'vallis': [{'n': 10, 'title': {'sa': 'दशमः प्रपाठकः', 'en': 'Prapāṭhaka 10', 'gloss': 'The Mahānārāyaṇa or Yājñikī Upaniṣad'},
                    'location': 'Taittirīya Āraṇyaka 10',
                    'anuvakas': [{'n': a, 'id': f'10.{a}', 'units': us} for a, us in sorted(anus.items())]}],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--yajuh', required=True)
    ap.add_argument('--raw', required=True)
    ap.add_argument('--text', action='store_true', help='(re)generate text.json from the base')
    a = ap.parse_args()
    Y = {'repo': 'https://github.com/vishvAsa/vedAH_yajuH', 'branch': 'content', 'commit': IW.head(a.yajuh)}
    R = {'repo': 'https://github.com/sanskrit/raw_etexts', 'branch': 'master', 'commit': IW.head(a.raw)}

    rel, units, anukr, shanti = md_text(a.yajuh)
    md = by_anuvaka(units)
    if a.text or not os.path.exists(os.path.join(ED, 'text.json')):
        with open(os.path.join(ED, 'text.json'), 'w', encoding='utf-8') as f:
            json.dump(make_text(units, shanti), f, ensure_ascii=False, indent=1)
            f.write('\n')
        print('wrote upanishads/mahanarayana/edition/text.json')
    write('MD-recitation.json', {'id': 'MD', **Y, 'path': rel,
        'label': 'Taittirīya Āraṇyaka 10, the 80-anuvāka recitation text with svara (vishvAsa/vedAH_yajuH, AraNyakam/mUlam/muralIdharaH.md)',
        'note': 'Base text. Keyed by anuvāka (10.A); `units` keyed 10.A.U by the source’s own marks «॥ ०। १०। A। U॥». The anukramaṇī printed after each anuvāka (an index phrase, «… ॥ A॥»; after anuvāka 1 also a verse naming the deities of its gāyatrīs, and after the last the index of the whole prapāṭhaka) is an index, not text: it is kept here under `anukramani` and not in the edition’s text. The copy in AraNyakam/sAyaNa-pAThaH/2_upaniShadaH/10_nArAyaNopaniShat.md is the same source and is not collated separately.',
        'mantras': {k: [strip_accents(x).replace('ँ', 'ं') for x in v] for k, v in md.items()},
        'units': {k: [v] for k, v in units.items()}, 'anukramani': anukr, 'shanti': shanti})

    base = {k: ' '.join(strip_accents(x).replace('ँ', 'ं') for x in v) for k, v in md.items()}
    apd = ananda_dir(a.yajuh, MNU + 'sAyaNa-pATha-yogaH/10_parishiShTam_sa-bhAShyam')
    AP = {f'10.{k}': v['mula'] for k, v in apd.items()}
    # Files 65 and 66 of this folder are pages vishvAsa assembled formula by formula:
    # its edited text («विश्वास-प्रस्तुतिः»), the mūla, and the commentary — some of it in
    # blocks vishvAsa labels «सायण-टीका», some unlabelled between them. The commentary
    # is the pariśiṣṭa's anonymous bhāṣya, not Sāyaṇa's: it closes with the pariśiṣṭa's
    # own colophon («… याज्ञिक्यामुपनिषदि भाष्ये षट्षष्टितमोऽनुवाकः» — Sāyaṇa's read
    # «… सायणाचार्यविरचिते माधवीये वेदार्थप्रकाशे …»), it numbers the anuvākas 65–66,
    # and its wording differs from Sāyaṇa's own comments on these formulas (his 58–60).
    # So all of it is filed under `anon`; the edited text, the mūla and the link stubs
    # («टीकाः [अन्यत्र]») are left out.
    assembled = {}
    pdir = os.path.join(a.yajuh, MNU + 'sAyaNa-pATha-yogaH/10_parishiShTam_sa-bhAShyam')
    for k in apd:
        fp = os.path.join(pdir, f'{k:02d}.md')
        rawp = read(fp) if os.path.exists(fp) else ''
        if '<summary>सायण-टीका' not in rawp:
            continue
        body = rawp.split('+++', 2)[-1]
        body = re.sub(r'<details[^>]*>\s*<summary>(?:विश्वास-प्रस्तुतिः|मूलम्|विस्तारः[^<]*)</summary>.*?</details>', ' ', body, flags=re.S)
        body = re.sub(r'<details[^>]*>\s*<summary>सायण-टीका</summary>(.*?)</details>',
                      lambda m: '' if 'अन्यत्र' in m.group(1) else m.group(1), body, flags=re.S)
        keep = []
        for ln in body.split('\n'):
            t_ = ln.strip()
            if not t_ or t_.startswith('_') or t_.startswith('*') or debris(t_) or re.match(r'^(?:\[\[\d+\]\]|१\s*[क-ह]\.|\[अनु॰|अथ\s.*नुवाकः|परिशिष्टत्वेन)', t_):
                continue
            if re.match(r'^इति कृष्णयजुर्वेदीय', t_) or 'नुवाकः' in t_ and re.search(r'॥\s*[०-९]+\s*॥', t_):
                continue                      # the colophon
            if SVARA.search(t_):
                continue                      # a line of the mūla
            keep.append(re.sub(r'\[\[\d+\]\]', ' ', t_))
        assembled[k] = ws(' '.join(keep))
    write('AP-anandasrama.json', {'id': 'AP', **Y, 'path': MNU + 'sAyaNa-pATha-yogaH/10_parishiShTam_sa-bhAShyam/',
        'label': 'The 80-anuvāka text printed with the anonymous bhāṣya in the pariśiṣṭa of the Ānandāśrama edition of the Taittirīya Āraṇyaka (ASS 36, 1927), with svara, via vishvAsa/vedAH_yajuH',
        'note': 'Keyed by the file’s anuvāka (the colophons of files 7 and 37 print 6 and 67, and file 12 has none; their text is that of anuvākas 7, 37 and 12). The mūla is the accented text before each file’s first colophon. Left out as print matter, not text: page numbers, running heads, footnotes, the editor’s queries «(?)», the «, इति» with which the print closes each mantra, and the lines it prints after «इति» (its anukramaṇī, and passages the base cites by their opening words, set out in full) — kept here under `notes`.',
        'mantras': {k: [v] for k, v in AP.items()},
        'notes': {f'10.{k}': v['notes'] for k, v in apd.items() if v['notes']},
        'colophon_numbers': {f'10.{k}': v['n'] for k, v in apd.items()}})
    write('anon.json', {'id': 'anon', **Y, 'path': MNU + 'sAyaNa-pATha-yogaH/10_parishiShTam_sa-bhAShyam/',
        'label': 'Anonymous bhāṣya on the 80-anuvāka text, printed as a pariśiṣṭa in the Ānandāśrama edition (ASS 36, 1927), via vishvAsa/vedAH_yajuH',
        'note': 'By anuvāka, the commentator’s introductory sentence included. The Ānandāśrama editor says that the author of this bhāṣya is not known and that it largely follows Sāyaṇa; it is cited here as anonymous, never as Sāyaṇa’s. OCR-derived text with print matter removed.',
        'mantras': {f'10.{k}': (assembled[k] if k in assembled else v['comm']) for k, v in apd.items()}})

    tl = t_lines(a.raw)
    tseg, tmiss = align(tl, {k: base[k] for k in base})
    if tmiss:
        raise SystemExit(f'T: no start found for {tmiss}')
    T = {k: [ws(' '.join(v))] for k, v in tseg.items()}
    write('T-tirupati.json', {'id': 'T', **R, 'path': T_REL,
        'label': 'Mahānārāyaṇopaniṣat, e-text of the Rāṣṭriya Saṃskṛta Vidyāpīṭha, Tirupati, in the eBhāratī collection (Ebharati-4294), mirrored in sanskrit/raw_etexts',
        'note': 'Mostly without svara. Its anuvāka headings are incomplete (no heading for anuvāka 2; two headings each read ‘tenth’ and ‘sixty-first’; none for the seventieth), so the importer cuts it where each anuvāka of the base begins. Left out as not text: its headings and hymn titles, the śānti it prints at the beginning and end, its colophon, and its bracketed note of variant gāyatrīs («पाठभेदः»). It writes out in full several passages the base cites by their opening words.',
        'mantras': T})

    sd = ananda_dir(a.yajuh, MNU + 'sAyaNa-pATha-yogaH/sAyaNaH/10', interleaved={1})
    S = {}
    for fn, v in sorted(sd.items()):
        if not v['mula'] and v['comm'].strip() in ('MISSING', ''):
            continue                # a placeholder file, not Sāyaṇa's text
        n = v['n'] or fn
        # a misprinted colophon must not overwrite an anuvāka already read: file 27
        # prints «… सप्तविंशोऽनुवाकः॥ २६॥» (its heading says 27), so it takes 27
        while str(n) in S:
            n += 1
        S[str(n)] = v
    smap = concord(base, {k: v['mula'] for k, v in S.items() if v['mula']})
    write('sayana.json', {'id': 'sayana', **Y, 'path': MNU + 'sAyaNa-pATha-yogaH/sAyaNaH/10/',
        'label': 'Sāyaṇa, Vedārthaprakāśa on Taittirīya Āraṇyaka 10 (Ānandāśrama edition, ASS 36, 1927), via vishvAsa/vedAH_yajuH',
        'note': 'Keyed by Sāyaṇa’s own anuvāka number (from each file’s colophon; the vishvAsa file names drift from it after 36), on his 64-anuvāka text. His anuvākas 2, 11, 12 and 52–57 have no file here. `mula` keeps the text he comments on. Reached from the edition’s anuvākas through the concordance in edition.json, computed from the shared wording of his text and the base.',
        'mantras': {k: v['comm'] for k, v in S.items()},
        'mula': {k: v['mula'] for k, v in S.items()}})
    brel, bh = bhaskara(a.yajuh)
    bmap = concord_comm(base, bh)
    write('bhaskara.json', {'id': 'bhaskara', **Y, 'path': brel,
        'label': 'Bhaṭṭa Bhāskara, Jñānayajña on the Taittirīya Āraṇyaka, prapāṭhaka 10 (the Drāviḍa recension, 64 anuvākas), via vishvAsa/vedAH_yajuH',
        'note': 'Keyed by Bhāskara’s own (Drāviḍa) anuvāka number; his anuvākas 39–42 are not in this file. Reached through the concordance in edition.json, computed from the words of the base he quotes (he gives no continuous mūla).',
        'mantras': bh})

    names = {'T': 'the Tirupati e-text', 'AP': 'the Ānandāśrama pariśiṣṭa text'}
    variants = []
    for k in base:
        variants += classify(k, 'AP', base[k], AP.get(k, ''), 'T', T[k][0], names)
        variants += classify(k, 'T', base[k], T[k][0], 'AP', AP.get(k, ''), names)
    cpath = os.path.join(ED, 'corrections.json')
    old = json.load(open(cpath, encoding='utf-8')) if os.path.exists(cpath) else {'corrections': []}
    with open(cpath, 'w', encoding='utf-8') as f:
        json.dump({'$comment': 'Every difference between text.json and the base witness MD (corrections), and every letter difference of the witnesses AP and T from text.json, classified (generated by import_mahanarayana.py from the agreement of the witnesses; see its classify()). check.py fails on an unlisted difference or a stale entry. Classes: orthographic · variant · recension · witness-error · review.',
                   'corrections': old.get('corrections', []), 'variants': variants}, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('wrote corrections.json:', len(variants), 'variants')

    cfg_p = os.path.join(ED, 'edition.json')
    cfg = json.load(open(cfg_p, encoding='utf-8'))
    cfg['commentaries']['sayana']['map'] = {k: v for k, v in smap.items()}
    cfg['commentaries']['bhaskara']['map'] = {k: bmap.get(k, []) for k in base}
    with open(cfg_p, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('updated edition.json maps')

    refs = []
    for f in sorted(os.listdir(ED)):
        if f.startswith('parallel-refs') and f.endswith('.json'):
            refs += [r for r in json.load(open(os.path.join(ED, f), encoding='utf-8'))['refs'] if r not in refs]
    write('parallels.json', {'note': 'Passages cited by the analysis, cut from their sources by import_witnesses.parallels(). The checker requires every phrase an analysis quotes from a parallel to occur here.',
                             **R, 'passages': IW.parallels(a.raw, refs)})


if __name__ == '__main__':
    main()
