#!/usr/bin/env python3
"""Import the Vedic mantras of a rite edition from their Taittirīya sources.

  python3 scripts/prayoga/import.py sandhyavandanam --src <scratch>/src

Reads <edition>/edition/sources.json (hand-curated loci) and writes, for every
unit, what each witness says:

  witnesses/W1.json   the base text — the Saṃhitā in its pañcāśat divisions
                      (TS) or the muralīdhara Āraṇyaka (TA), svara marked
  witnesses/W2.json   an independent transcription: the vākya-krama Saṃhitā
                      (Weber's orthography) or the gaṇeśvara Āraṇyaka
  witnesses/RV.json   the Ṛgveda parallel (GRETIL, Aufrecht), Śākala recension
  witnesses/comm.json the commentaries on the anuvāka, block by block, as the
                      vishvAsa corpus labels them (Sāyaṇa, Bhaṭṭa Bhāskara, and
                      Sāyaṇa on the Ṛgveda where the corpus includes it)

and, only with --text, a fresh text.json from W1 (after the import text.json is
hand-maintained and every change is logged in corrections.json).

A unit is found by sound, not spelling: both the witness and the incipit /
explicit are reduced to the collation skeleton of scripts/rudram/collate.py
(visarga before a sibilant ≡ the doubled sibilant, nasals before a consonant ≡
one nasal, jihvāmūlīya ≡ visarga …), so the Taittirīya orthography of the
witness and the plain spelling in sources.json meet. Every unit must be found
exactly where sources.json says; the import fails otherwise.
"""
import argparse
import glob
import json
import os
import re
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'rudram'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'upanishads'))
from collate import skeleton  # noqa: E402
from textlib import join_gretil, strip_accents  # noqa: E402
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spelling import plain_ts  # noqa: E402

TSP = 'yajuH/taittirIyam/sArasvata-vibhAgaH/'
DIG = str.maketrans('०१२३४५६७८९', '0123456789')
# GRETIL keys a few verses wrongly; the fix is recorded with the parallel.
GRETIL_FIX = {'5.85.8': ('०५।०८५।००', 'GRETIL keys RV 5.85.8 as र्व्_०५।०८५।००।८१/८२ (verse number 00, line numbers 81/82); taken here as 5.85.8.')}
COMM_TITLES = {
    'सायण-टीका': 'sayana', 'सायण-भाष्यम्': 'sayana-rv', 'भट्टभास्कर-टीका': 'bhaskara',
    'सायणोक्त-विनियोगः': 'sayana-viniyoga', 'भास्करोक्त-विनियोगः': 'bhaskara-viniyoga',
}


def body(path):
    t = open(path, encoding='utf-8').read()
    return t.split('+++', 2)[2] if t.startswith('+++') else t


def git_head(path):
    try:
        return subprocess.check_output(['git', '-C', path, 'rev-parse', 'HEAD'], text=True).strip()
    except Exception:
        return None


MARK = re.compile(r'^(\[\d+\]|\(\d+\)|॥|।|\\|[०-९]+॥?|\d+|०।)$')


def tokens(text):
    """Words of a witness, with its division markers kept as separate tokens."""
    t = re.sub(r'०।\s*([०-९]+)।\s*([०-९]+)।\s*([०-९]+)॥', r' {TA:\1.\2.\3} ', text)
    t = re.sub(r'(\[\d+\]|\(\d+\))', r' \1 ', t)
    t = t.replace('॥', ' ॥ ').replace('।', ' । ')
    return [w for w in re.split(r'\s+', t) if w]


def is_mark(w):
    return bool(MARK.match(w)) or w.startswith('{TA:')


def skel(s):
    """The collation skeleton, with doubled consonants made single on both sides
    (the Taittirīya writes द॒धि॒क्राव्ण्णो, ब्र॑ह्म्म …); used only to locate a unit."""
    s = re.sub(r't(?=c)', 'c', skeleton(strip_accents(re.sub(r'[-–+,;:]', ' ', s))))  # यत् चिद्धि ≡ यच्चिद्धि
    return re.sub(r'(kh|gh|ch|jh|ṭh|ḍh|th|dh|ph|bh|[kgcjṭḍṇtdnpbmyrlvśṣs])\1+', r'\1', s)


def sk(words):
    return skel(' '.join(w for w in words if not is_mark(w)))


def find(toks, inc, exp, start=0, nth=1):
    """(i, j): the first token of the unit and one past its last. The nth place
    where the incipit begins and the explicit follows within reach."""
    # a final visarga / m / stop of the incipit may have changed by sandhi in the witness
    si, se = re.sub(r'(a?[ḥḤ]|[mNtdkgṭḍpb])$', '', skel(inc)), skel(exp)
    se2 = re.sub(r'[ḥḤmN]$', '', se)
    k = len(inc.split()) + 3
    seen = 0
    for i in range(start, len(toks)):
        if is_mark(toks[i]) or not sk(toks[i:i + k]).startswith(si):
            continue
        for j in range(i + 1, min(len(toks), i + 500) + 1):
            s = sk(toks[i:j])
            if s.endswith(se) or s.endswith(se2):
                # the tightest span only: no later start of the incipit before the explicit
                if any(not is_mark(toks[x]) and sk(toks[x:x + k]).startswith(si) for x in range(i + 1, j - 1)):
                    break
                seen += 1
                if seen == nth:
                    while j < len(toks) and toks[j] in ('।', '॥'):
                        j += 1
                    return i, j
                break
    return None


def clean(words):
    """The unit as text: division markers dropped; a word that a marker cut after
    its virama (यत् [45] चिद्धि) is closed up again (यत्चिद्धि) — what sandhi
    then makes of it is a logged correction, not the import's business."""
    out, glue = '', False
    for w in words:
        if is_mark(w) and w not in ('।', '॥'):
            glue = out.endswith('्')
            continue
        out += ('' if glue or not out else ' ') + w
        glue = False
    return re.sub(r'\s*([।॥])', r' \1', out).strip(' ।')


def marks(words):
    return [w for w in words if re.match(r'^(\[\d+\]|\(\d+\)|\{TA:)', w)]


def rv_verse(src, ref):
    m, s, v = (int(x) for x in ref.split('.'))
    p = os.path.join(src, 'raw/mixed/gretil_devanAgarI/1_sanskr/1_veda/1_sam/1_rv', f'rgveda_{m}.md')
    key = '।'.join([f'{m:02d}', f'{s:03d}', f'{v:02d}']).translate(str.maketrans('0123456789', '०१२३४५६७८९'))
    fix = GRETIL_FIX.get(ref)
    if fix:
        key = fix[0]
    lines = []
    for line in open(p, encoding='utf-8'):
        mm = re.match(r'र्व्_([०-९]+।[०-९]+।[०-९]+)।[०-९]+(?:\{[०-९]+\})?\s*(.*)', line.strip())
        if mm and mm.group(1) == key:
            lines.append(join_gretil(mm.group(2).strip()))
    if not lines:
        raise SystemExit(f'RV {ref} not found')
    out = {'text': ' । '.join(lines), 'lines': lines, 'source': f'GRETIL rgveda_{m}.md, RV {ref}'}
    if fix:
        out['note'] = fix[1]
    return out


def window(path, at, n=12):
    """The lines of a commentary file from the one that contains `at` (compared by
    sound) to n lines after it: what quotations from it are checked against."""
    lines = body(path).split('\n')
    key = skel(at)
    for i, l in enumerate(lines):
        if key in skel(l):
            return '\n'.join(lines[i:i + n])
    raise SystemExit(f'no commentary containing {at!r} in {path}')


def ta_comm(path, inc):
    """Bhaṭṭa Bhāskara on the Āraṇyaka is one file per (Drāviḍa) prapāṭhaka — the
    corpus's Sāyaṇa file for TA 4 is empty: keep the lines from the
    comment on the first unit's pratīka to the end of that anuvāka's comments
    (the next twelve lines), which is what quotations are checked against."""
    lines = body(path).split('\n')
    first = skel(inc)[:7]
    for i, l in enumerate(lines):
        if first in skel(re.sub(r'^\d+', '', l)):
            return '\n'.join(lines[max(0, i - 2):i + 12])
    raise SystemExit(f'no commentary on {inc!r} in {path}')


def comm_blocks(path):
    """The labelled commentary blocks of a vishvAsa sarva-prastutiH file."""
    t = body(path)
    out = []
    for m in re.finditer(r'<details[^>]*><summary>(?:<h\d>)?([^<]*?)(?:</h\d>)?</summary>(.*?)</details>', t, re.S):
        who = COMM_TITLES.get(m.group(1).strip())
        if who:
            txt = re.sub(r'<[^>]+>', ' ', m.group(2))
            txt = re.sub(r'\+\+\+\([^)]*\)\+\+\+', ' ', txt)
            txt = re.sub(r'\s+', ' ', txt).strip()
            out.append({'who': who, 'text': txt})
    return out


def tex_plain(t):
    """The stotrasamhita LaTeX as plain text: comments, English stage directions
    ({\\scriptsize …}), section commands and macros dropped; verse macros opened."""
    t = re.sub(r'(?m)^\s*%.*$', '', t)
    t = re.sub(r'\{\\scriptsize[^{}]*\}', ' ', t)
    t = t.replace('\\mbox{}', '')
    t = re.sub(r'\\(sect|dnsub|chapt|centerline)\*?\{[^{}]*\}', ' ॥ ', t)
    t = re.sub(r'\\makebox\[[^\]]*\]\[[^\]]*\]\{([^{}]*)\}', r'\1', t)
    t = re.sub(r'\\(two|four)line[a-z]*shloka\*?', ' ', t)
    t = re.sub(r'\\(textbf|blank|mbox|hfill)\{([^{}]*)\}', r' \2 ', t)
    t = re.sub(r'\\(item|begin\{[a-z]+\}|end\{[a-z]+\}|\\|-|renewcommand)', ' ', t)
    t = re.sub(r'\\[a-zA-Z]+', ' ', t)
    t = t.replace('{', ' ').replace('}', ' ')
    return re.sub(r'\s+', ' ', t)


RITE_M = 'yajuH/taittirIyam/sUtram/ApastambaH/gRhyam/paddhatiH/mailApura-vedAdhyayana-sabhA/sandhyAvandanam.md'
RITE_S = 'ext/svm/Sandhyavandanam.tex'
S_COMMIT = '097c82834d0ddd7ec094c84869f9f4828a252ef8'   # stotrasamhita/vedamantra-book HEAD when fetched (2026-11-04)


def rite(ed, src):
    """Cut every non-Vedic text of the rite from M and S (rite-texts.json)."""
    R = json.load(open(os.path.join(ed, 'rite-texts.json'), encoding='utf-8'))
    mt = tokens(re.sub(r'\s+', ' ', body(os.path.join(src, RITE_M))))
    st = tokens(tex_plain(open(os.path.join(src, RITE_S), encoding='utf-8').read()))
    out = {'M': {}, 'S': {}}
    for x in R['texts']:
        for wit, toks in (('M', mt), ('S', st)):
            spec = x.get(wit)
            if not spec:
                continue
            r = find(toks, spec['inc'], spec['exp'], 0, spec.get('nth', 1))
            if not r:
                raise SystemExit(f"{x['id']}: {wit} {spec['inc']!r} … {spec['exp']!r} not found")
            out[wit][x['id']] = clean(toks[r[0]:r[1]])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('edition')
    ap.add_argument('--src', required=True)
    ap.add_argument('--text', action='store_true', help='also (re)write text.json from W1')
    ap.add_argument('--rite', action='store_true', help='cut the non-Vedic texts of the rite (rite-texts.json)')
    a = ap.parse_args()
    ed = os.path.join(ROOT, a.edition, 'edition')
    if a.rite:
        w = rite(ed, a.src)
        heads = {'yajuH': git_head(os.path.join(a.src, 'yajuH'))}
        os.makedirs(os.path.join(ed, 'witnesses'), exist_ok=True)
        for wit, label, commit in (
                ('M', 'M — the Sandhyāvandana prayoga of the Mylapore Veda Adhyayana Sabhā (publisher A. Subbaraman, Mylapore; English by Sundararajan Subramanian), as transcribed in vishvAsa/vedAH_yajuH, ' + RITE_M.split('/', 1)[1], heads['yajuH']),
                ('S', 'S — Sandhyavandanam.tex of github.com/stotrasamhita/vedamantra-book (mantras/), the Smārta Āpastamba Sandhyāvandanam for the three times', S_COMMIT)):
            with open(os.path.join(ed, 'witnesses', f'{wit}.json'), 'w', encoding='utf-8') as fh:
                json.dump({'label': label, 'commit': commit, 'texts': w[wit]}, fh, ensure_ascii=False, indent=1)
                fh.write('\n')
        print(f"M: {len(w['M'])} texts, S: {len(w['S'])} texts")
        if a.text:
            tp = os.path.join(ed, 'text.json')
            T = json.load(open(tp, encoding='utf-8'))
            if T.get('texts'):
                raise SystemExit('text.json already has the texts of the rite (hand-maintained): not overwritten')
            # S is the base where it has the text (it writes the sandhi joined); M otherwise
            T['texts'] = {}
            for x in json.load(open(os.path.join(ed, 'rite-texts.json'), encoding='utf-8'))['texts']:
                k = x['id']
                T['texts'][k] = {'text': w['S'][k], 'base': 'S'} if k in w['S'] else {'text': w['M'][k], 'base': 'M'}
            with open(tp, 'w', encoding='utf-8') as fh:
                json.dump(T, fh, ensure_ascii=False, indent=1)
                fh.write('\n')
        return
    S = json.load(open(os.path.join(ed, 'sources.json'), encoding='utf-8'))
    src = a.src
    head = {'yajuH': git_head(os.path.join(src, 'yajuH')), 'raw': git_head(os.path.join(src, 'raw'))}
    W1, W2, RV, CM, TXT = {}, {}, {}, {}, []
    cache = {}

    def toks_of(work, file, second=False):
        k = (work, file, second)
        if k not in cache:
            if work == 'TS':
                sub = 'vAkya-kramaH' if second else 'panchAti-kramaH'
                p = os.path.join(src, TSP, 'saMhitA/mUlam', sub, file + '.md')
            elif work == 'TB':
                p = os.path.join(src, TSP, 'brAhmaNam/mUlam', 'muralIdharaH.md' if second else f'drAviDam/{file}.md')
            else:
                p = os.path.join(src, TSP, 'AraNyakam/mUlam', ('gaNeshvara-pAThaH' if second else file) + '.md')
            cache[k] = (p, tokens(re.sub(r'\s+', ' ', body(p))))
        return cache[k]

    for m in S['mantras']:
        w, f = m['src']['work'], m['src']['file']
        p1, t1 = toks_of(w, f)
        p2, t2 = toks_of(w, f, second=True)
        units = []
        pos1 = pos2 = 0
        for n, u in enumerate(m['units'], 1):
            if u.get('file'):        # a unit from another prapāṭhaka of the same work
                p1, t1 = toks_of(w, u['file'])
                p2, t2 = toks_of(w, u['file'], second=True)
                pos1 = pos2 = 0
            uid = f"{m['id']}.{n}"
            r1 = find(t1, u['inc'], u['exp'], pos1)
            if not r1:
                raise SystemExit(f'{uid}: {u["inc"]!r} not in {p1}')
            i, j = r1
            pos1 = j
            W1[uid] = {'text': clean(t1[i:j]), 'marks': marks(t1[max(0, i - 40):j]), 'cite': u['cite'],
                       'source': os.path.relpath(p1, src)}
            # sources.json may give the second witness its own incipit / explicit
            # where it reads differently (the difference is then collated as usual)
            r2 = find(t2, u.get('w2inc', u['inc']), u.get('w2exp', u['exp']), pos2)
            if r2:
                pos2 = r2[1]
                W2[uid] = {'text': clean(t2[r2[0]:r2[1]]), 'source': os.path.relpath(p2, src)}
            else:
                W2[uid] = {'text': None, 'source': os.path.relpath(p2, src), 'note': 'not found by the import'}
            if u.get('rv'):
                RV[uid] = dict(rv_verse(src, u['rv']), ref=f"RV {u['rv']}")
            units.append({'id': uid, 'n': n, 'cite': u['cite'], 'samhita': W1[uid]['text'], 'plain': plain_ts(W1[uid]['text']),
                          **({'rv': f"RV {u['rv']}"} if u.get('rv') else {})})
        if m['src'].get('comm'):
            blocks = []
            for c in m['src']['comm']:
                cp = os.path.join(src, TSP, c['path'] + '.md')
                blocks.append({'who': c['who'], 'text': re.sub(r'\s+', ' ', window(cp, c['at'], c.get('lines', 12)))})
            CM[m['id']] = {'source': ', '.join(c['path'] for c in m['src']['comm']), 'blocks': blocks}
        say = m['src'].get('sayana')
        if say and w == 'TB':
            hits = sorted(glob.glob(os.path.join(src, TSP, 'brAhmaNam/sarva-prastutiH', say + '*.md')))
            if not hits:
                raise SystemExit(f"{m['id']}: no commentary file for {say}")
            CM[m['id']] = {'source': os.path.relpath(hits[0], src), 'blocks': comm_blocks(hits[0])}
        elif say:
            if w == 'TS':
                hits = sorted(glob.glob(os.path.join(src, TSP, 'saMhitA/sarva-prastutiH', say + '*.md')))
            else:
                hits = [os.path.join(src, TSP, 'AraNyakam/bhaTTa-bhAskara-bhAShyam', say + '.md')]
            if not hits:
                raise SystemExit(f"{m['id']}: no commentary file for {say}")
            blocks = comm_blocks(hits[0]) if w == 'TS' else [{'who': 'bhaskara', 'text': re.sub(r'\s+', ' ', ta_comm(hits[0], m['units'][0]['inc']))}]
            CM[m['id']] = {'source': os.path.relpath(hits[0], src), 'blocks': blocks}
        TXT.append({'id': m['id'], 'work': w, 'units': units})
        print(f"{m['id']:14} {len(units)} unit(s)  W2 {'ok' if all(W2[x['id']]['text'] for x in units) else 'MISSING'}  comm {len(CM.get(m['id'], {}).get('blocks', []))} block(s)")

    os.makedirs(os.path.join(ed, 'witnesses'), exist_ok=True)

    def dump(name, obj):
        with open(os.path.join(ed, name), 'w', encoding='utf-8') as fh:
            json.dump(obj, fh, ensure_ascii=False, indent=1)
            fh.write('\n')

    dump('witnesses/W1.json', {'label': 'Base witness: the Taittirīya Saṃhitā in pañcāśat divisions (vishvAsa/vedAH_yajuH, saMhitA/mUlam/panchAti-kramaH; keyed from TITUS and Parankuśācārya) and the Āraṇyaka of muralīdhara (AraNyakam/mUlam/muralIdharaH.md), svara marked', 'commit': head['yajuH'], 'units': W1})
    dump('witnesses/W2.json', {'label': 'Second witness: the vākya-krama Saṃhitā (Weber’s orthography) and the gaṇeśvara Āraṇyaka (same corpus)', 'commit': head['yajuH'], 'units': W2})
    dump('witnesses/RV.json', {'label': 'The Ṛgveda parallels (GRETIL, from Aufrecht 1877; Śākala recension, no svara), github.com/sanskrit/raw_etexts', 'commit': head['raw'], 'units': RV})
    dump('witnesses/comm.json', {'label': 'The commentaries on each source anuvāka, as the vishvAsa corpus labels them', 'commit': head['yajuH'], 'mantras': CM})
    if a.text:
        dump('text.json', {'$comment': 'The Vedic mantras of the rite that are not in the Mahānārāyaṇa: the base witness W1 plus the logged corrections (corrections.json). Hand-maintained after the import.', 'mantras': TXT})


if __name__ == '__main__':
    main()
