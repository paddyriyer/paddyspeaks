#!/usr/bin/env python3
"""The guardrail of the Upaniṣads study editions (Validate Content).

  python3 scripts/upanishads/check.py                 # everything, every edition
  python3 scripts/upanishads/check.py --mantra 4      # one mantra's analysis
  python3 scripts/upanishads/check.py --partial       # allow analysis files to be missing

What it proves (docs/UPANISHADS-EDITION.md §Rules):

  TEXT        every edition has its mantras numbered 1..N without a gap;
              letters(text) equals letters(base witness) apart from the logged
              corrections; every logged correction is in the text and its old
              reading in the base witness.
  COLLATION   every letter difference of every witness from the text is listed
              and classified in corrections.json, and no entry is stale.
  PADACCHEDA  the separated words rejoin by external sandhi into the text
              (scripts/devi_mahatmyam/sandhi.py); an unjoined vowel hiatus must
              be declared in sandhi_exceptions, and an unneeded one fails; the
              word table lists exactly the padaccheda; sandhi examples occur in
              the mantra; compounds and analysed words are words of it; every
              anvaya word is a padaccheda word or [supplied].
  SECTIONS    every mantra has all fourteen sections, the beginner explanation
              is 90–170 words, the three reflections exist, the metre's name
              agrees with the counted syllables or the note explains them.
  AUTHORITY   every Devanagari quotation in « » attributed to a commentator
              occurs in that commentator's text on that mantra; a school
              position marked basis "commentary" quotes its commentary; every
              parallel cites a passage present in witnesses/parallels.json and
              quotes a phrase that occurs in it; every concept is in the glossary.
  LABELS      every commentary block carries one of the five labels; studies
              and the introduction label every section; banned vocabulary
              (accusations, medical claims, modern esoterica) is absent.
"""
import argparse
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'upanishads'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'devi_mahatmyam'))
from textlib import letters, diff, phon  # noqa: E402
from sandhi import rejoin  # noqa: E402
from translit import dev2iast  # noqa: E402

COLL = os.path.join(ROOT, 'upanishads')
LABELS = {'direct', 'traditional', 'comparative', 'linguistic', 'reflection'}
BASES = {'commentary', 'doctrine', 'inference'}
SCHOOLS = ('advaita', 'visistadvaita', 'dvaita')
PAR_KINDS = {'direct-parallel', 'doctrinal', 'thematic'}
METRES = {'anuṣṭubh': [16, 16], 'triṣṭubh': [22, 22]}
BANNED = [
    r'\bvibration', r'\bcosmic energy', r'\bchakra', r'\bquantum', r'\benergy field',
    r'medically proven', r'scientifically proven', r'clinically', r'\bcures?\b', r'\bheals?\b',
    r'\btherapy\b', r'\bmanifest(ing)? (your|abundance)', r'law of attraction',
]
DEVA = re.compile(r'[ऀ-ॿ][ऀ-ॿ᳐-᳿\s\-‘’\'ऽ।॥]*[ऀ-ॿ]|[ऀ-ॿ]')
QUOTE = re.compile(r'«([^»]+)»')
errors = []


def fail(msg):
    errors.append(msg)


def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def words_of(n_text):
    return set(letters(w) for w in re.split(r'\s+', n_text) if w)


class Edition:
    def __init__(self, eid):
        self.id = eid
        self.dir = os.path.join(COLL, eid, 'edition')
        self.text = load(os.path.join(self.dir, 'text.json'))
        self.corr = load(os.path.join(self.dir, 'corrections.json'))
        W = os.path.join(self.dir, 'witnesses')
        self.wfiles = {f: load(os.path.join(W, f)) for f in sorted(os.listdir(W)) if f.endswith('.json')}
        self.base = self.wfiles[next(f for f in self.wfiles if f.startswith(self.text['base'] + '-'))]
        self.cfg = load(os.path.join(self.dir, 'edition.json'))
        self.parallels = self.wfiles['parallels.json']['passages']

    def mantra(self, n):
        return next(m for m in self.text['mantras'] if m['n'] == n)

    def mtext(self, n):
        return ' '.join(self.mantra(n)['lines'])

    def witness_readings(self):
        """{witness id: {mantra n (str): text}}, using each witness's mapping."""
        out = {}
        for wid, spec in self.cfg['witnesses'].items():
            data = self.wfiles[spec['file']]['mantras']
            m = {}
            for n in range(1, self.text['count'] + 1):
                keys = spec.get('map', {}).get(str(n), [str(n)])
                if keys is None:
                    continue
                parts = [' '.join(data[k]) for k in keys if k in data]
                if parts:
                    m[str(n)] = ' '.join(parts)
            out[wid] = m
        return out

    def readings_of(self, n):
        out = []
        for wid, spec in self.cfg['witnesses'].items():
            w = self.wfiles[spec['file']]
            keys = spec.get('map', {}).get(str(n), [str(n)]) or []
            out += [' '.join(w['mantras'][k]) for k in keys if k in w['mantras']]
            out += [w.get('pada', {}).get(k, '') for k in keys]
        return out

    def commentary(self, who, n):
        """The commentator's text on mantra n (plus the passages the
        edition.json grouping assigns to it)."""
        if who == 'text':  # the mantra, its witnesses and the pada-pāṭha
            return ' '.join([self.mtext(n)] + self.readings_of(n)) if isinstance(n, int) else ''
        if who == 'parallel':
            return ''
        spec = self.cfg['commentaries'][who]
        data = self.wfiles[spec['file']]
        keys = spec.get('map', {}).get(str(n), [str(n)])
        out = []
        for k in keys:
            if k in ('opening', 'closing', 'intro'):
                out.append(data.get(k, ''))
                continue
            v = data['mantras'].get(k)
            if isinstance(v, dict):
                out.append(v.get('intro', '') + ' ' + v.get('bhashya', ''))
            elif v:
                out.append(v)
        return ' '.join(out)


# ------------------------------------------------------------------ TEXT
def check_text(ed):
    ms = ed.text['mantras']
    if [m['n'] for m in ms] != list(range(1, ed.text['count'] + 1)):
        fail(f'{ed.id}: mantras are not numbered 1..{ed.text["count"]}')
    seen = {}
    for m in ms:
        lt = letters(' '.join(m['lines']))
        if lt in seen:
            fail(f'{ed.id} {m["n"]}: the same text as mantra {seen[lt]} (duplicated?)')
        seen[lt] = m['n']
        if not re.search(r'॥\s*[०-९]+\s*॥$', m['lines'][-1]):
            fail(f'{ed.id} {m["n"]}: the last line must end with ॥ N ॥')
        else:
            num = re.search(r'॥\s*([०-९]+)\s*॥$', m['lines'][-1]).group(1)
            if int(''.join(str('०१२३४५६७८९'.index(c)) for c in num)) != m['n']:
                fail(f'{ed.id} {m["n"]}: printed number {num} does not match')
        g = ' '.join(ed.base['mantras'][str(m['n'])])
        d = diff(g, ' '.join(m['lines']))
        if d:
            fail(f'{ed.id} {m["n"]}: text differs from the base witness {ed.text["base"]} in letters: {d}')
    for c in ed.corr['corrections']:
        g = ' '.join(ed.base['mantras'][str(c['at'])])
        if c['from'] not in g:
            fail(f'{ed.id}: correction at {c["at"]}: {c["from"]!r} is not in the base witness')
        if c['to'] not in ed.mtext(c['at']):
            fail(f'{ed.id}: correction at {c["at"]}: {c["to"]!r} is not in the text')
        if not c.get('reason'):
            fail(f'{ed.id}: correction at {c["at"]} has no reason')


# ------------------------------------------------------------- COLLATION
def check_collation(ed):
    W = ed.witness_readings()
    listed = {}
    for v in ed.corr['variants']:
        listed.setdefault((v['at'], v['witness']), []).append(v)
        if v['class'] not in ('orthographic', 'variant', 'recension', 'witness-error', 'review'):
            fail(f'{ed.id}: variant at {v["at"]}/{v["witness"]}: unknown class {v["class"]!r}')
        if not v.get('note'):
            fail(f'{ed.id}: variant at {v["at"]}/{v["witness"]}: no note')
    for wid, readings in W.items():
        for n in range(1, ed.text['count'] + 1):
            r = readings.get(str(n))
            if r is None:
                if str(n) not in ed.cfg['witnesses'][wid].get('absent', []):
                    fail(f'{ed.id}: witness {wid} has no mantra {n} and does not declare it absent')
                continue
            found = [(a, b) for a, b, _ in diff(ed.mtext(n), r)]
            want = [(v['base'], v['reading_letters']) for v in listed.get((n, wid), [])]
            if found != want:
                fail(f'{ed.id} {n}: witness {wid}: differences {found} but corrections.json lists {want}')


# ------------------------------------------------------------ ANALYSIS
REQUIRED = ['n', 'title', 'padaccheda', 'words', 'sandhi', 'samasa', 'morphology', 'anvaya',
            'syntax', 'ambiguities', 'metre', 'translation', 'beginner', 'analogy', 'key_concepts',
            'commentary', 'schools', 'parallels', 'contemporary', 'reflect', 'references', 'status']


def syllables(line):
    s = dev2iast(re.sub(r'[॥।०-९]', '', line))
    return len(re.findall(r'ai|au|ā|ī|ū|ṝ|ḹ|a|i|u|ṛ|ḷ|e|o', s))


def contains(quote, text):
    """Does text contain the quotation (sound-level; a final visarga or m may
    have changed by sandhi in the source)?"""
    pq, pt = phon(quote), phon(text)
    cands = {pq}
    if pq.endswith(('ḥ', 'm', 'ṃ', 'n')):
        cands.add(pq[:-1])
    return any(c and c in pt for c in cands)


def quotes_ok(ed, n, text, sources, where):
    """Every «Devanagari» quote in text occurs in one of the sources, or in the
    mantra or its witnesses (a quoted gloss may drop its final visarga)."""
    pool = [phon(ed.mtext(n))] + [phon(r) for r in ed.readings_of(n)]
    for s in sources:
        who, _, at = s.partition(':')
        if who == 'parallel':
            pool.append(phon(ed.parallels.get(at, {}).get('text', '')))
            continue
        nums = [n] if not at else expand(at)
        for k in nums:
            pool.append(phon(ed.commentary(who, k)))
    for q in QUOTE.findall(text):
        if not re.search(r'[\u0900-\u097f]', q):
            continue
        pq = phon(q)
        cands = [pq, pq[:-1] if pq.endswith(('ḥ', 'm', 'ṃ', 'n')) else pq]
        if not any(c in p for c in cands for p in pool):
            fail(f'{where}: quotation «{q}» is not in {", ".join(sources) or "the mantra"}')


def expand(at):
    out = []
    for part in at.split(','):
        if part in ('opening', 'closing', 'intro'):
            out.append(part)
        elif '-' in part:
            a, b = part.split('-')
            out.extend(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return out


SUTRAS = None
PCITE = re.compile(r'P\.\s*(\d+\.\d+\.\d+)(\s*\(([^)]*)\))?')


def panini(text, where):
    """Every Pāṇini citation is 'P. a.b.c (the sūtra)', and the sūtra exists and reads so."""
    global SUTRAS
    if SUTRAS is None:
        SUTRAS = load(os.path.join(COLL, 'data', 'sutras.json'))['sutras']
    for m in PCITE.finditer(text):
        num, quoted = m.group(1), m.group(3)
        if num not in SUTRAS:
            fail(f'{where}: P. {num} is not a sūtra of the Aṣṭādhyāyī')
        elif not quoted or letters(quoted) != letters(SUTRAS[num]):
            fail(f'{where}: P. {num} must be quoted as ({SUTRAS[num]}), found ({quoted})')


def banned(text, where):
    panini(text, where)
    for b in BANNED:
        if re.search(b, text, re.I):
            fail(f'{where}: banned wording /{b}/')


def check_analysis(ed, n, glossary):
    p = os.path.join(ed.dir, 'analysis', f'{n:02d}.json')
    if not os.path.exists(p):
        return False
    e = load(p)
    where = f'{ed.id} {n}'
    for k in REQUIRED:
        if k not in e:
            fail(f'{where}: missing section {k!r}')
    if e.get('n') != n:
        fail(f'{where}: n is {e.get("n")}')
    pada = e.get('padaccheda', [])
    m = ed.mantra(n)
    if len(pada) != len(m['lines']):
        fail(f'{where}: padaccheda has {len(pada)} lines, the mantra {len(m["lines"])}')
    target = dev2iast(re.sub(r'\s*॥\s*[०-९]+\s*॥\s*$', '', ' '.join(m['lines'])).replace('ॐ', 'ओम्'))
    ok, info = rejoin([[dev2iast(w) for w in line] for line in pada], target)
    flat = [w for line in pada for w in line]
    if not ok:
        k = info
        fail(f'{where}: padaccheda does not rejoin into the text (stuck at word {k + 1}: {flat[max(0, k - 2):k + 2]})')
    else:
        declared = e.get('sandhi_exceptions', [])
        if len(info) != len(declared):
            spots = ', '.join(f'{flat[j - 1]}·{flat[j]}' for j in info)
            fail(f'{where}: {len(info)} unjoined vowel hiatus ({spots}) but {len(declared)} declared in sandhi_exceptions')
        for x in declared:
            if not x.get('note') or not x.get('kind'):
                fail(f'{where}: sandhi exception without kind/note')
    ws = [w.get('w') for w in e.get('words', [])]
    if ws != flat:
        fail(f'{where}: the word table does not list exactly the padaccheda words in order')
    for w in e.get('words', []):
        for k in ('w', 'base', 'gram', 'meaning', 'role'):
            if not w.get(k):
                fail(f'{where}: word {w.get("w")!r} lacks {k!r}')
    mt = letters(ed.mtext(n))
    for s in e.get('sandhi', []):
        if phon(s.get('joined', '')) not in phon(ed.mtext(n)):
            fail(f"{where}: sandhi example {s.get('joined')!r} is not in the mantra")
        for k in ('split', 'type', 'rule'):
            if not s.get(k):
                fail(f"{where}: sandhi {s.get('joined')!r} lacks {k}")
    fl = set(flat)
    for s in e.get('samasa', []):
        if s.get('word') not in fl:
            fail(f"{where}: compound {s.get('word')!r} is not a padaccheda word")
        for k in ('members', 'type', 'vigraha', 'meaning'):
            if not s.get(k):
                fail(f"{where}: compound {s.get('word')!r} lacks {k}")
    for s in e.get('morphology', []):
        if s.get('word') not in fl:
            fail(f"{where}: morphology note on {s.get('word')!r}, not a padaccheda word")
    anv = re.sub(r'\[[^\]]*\]', ' ', e.get('anvaya', ''))
    for tok in re.findall(r'[ऀ-ॿ]+', anv):
        if tok not in fl and tok not in ('।', '॥'):
            fail(f'{where}: anvaya word {tok!r} is neither a padaccheda word nor [supplied]')
    # metre
    met = e.get('metre', {})
    counts = [syllables(l) for l in m['lines']]
    want = METRES.get(met.get('name'))
    if want and counts != want and not re.search(r'\d', met.get('note', '')):
        fail(f'{where}: metre {met.get("name")} but {counts} syllables and the note does not explain them')
    if not met.get('name') or not met.get('note'):
        fail(f'{where}: metre needs a name and a note')
    # beginner
    bw = len(re.findall(r"[A-Za-zĀ-ſḀ-ỿ’'-]+", e.get('beginner', '')))
    if not 90 <= bw <= 170:
        fail(f'{where}: beginner explanation is {bw} words (90–170)')
    if re.search(r'[ऀ-ॿ]', e.get('beginner', '')):
        fail(f'{where}: the beginner explanation must not use Devanagari')
    if not e.get('analogy'):
        fail(f'{where}: no analogy')
    tr = e.get('translation', {})
    if not tr.get('literal') or not tr.get('readable'):
        fail(f'{where}: translation needs literal and readable')
    for c in e.get('key_concepts', []):
        if c not in glossary:
            fail(f'{where}: key concept {c!r} is not in the glossary')
    # commentary
    for i, c in enumerate(e.get('commentary', [])):
        if c.get('label') not in LABELS:
            fail(f'{where}: commentary block {i + 1} has label {c.get("label")!r}')
        if not c.get('q') or not c.get('text'):
            fail(f'{where}: commentary block {i + 1} needs q and text')
        quotes_ok(ed, n, c.get('text', ''), c.get('sources', []), f'{where} commentary {i + 1}')
    sch = e.get('schools', {})
    for s in SCHOOLS:
        x = sch.get(s)
        if x is None:
            continue
        if x.get('basis') not in BASES:
            fail(f'{where}: school {s}: basis must be one of {sorted(BASES)}')
        src = x.get('sources', [])
        if x.get('basis') == 'commentary':
            if not src:
                fail(f'{where}: school {s}: basis commentary but no sources')
            if not QUOTE.search(x.get('text', '')):
                fail(f'{where}: school {s}: basis commentary but no quotation from it')
        quotes_ok(ed, n, x.get('text', ''), src, f'{where} school {s}')
    if not any(sch.get(s) for s in SCHOOLS):
        fail(f'{where}: no school position at all')
    for i, pr in enumerate(e.get('parallels', [])):
        ref = pr.get('ref')
        if pr.get('kind') not in PAR_KINDS:
            fail(f'{where}: parallel {ref}: kind must be one of {sorted(PAR_KINDS)}')
        if ref not in ed.parallels:
            fail(f'{where}: parallel {ref} is not in witnesses/parallels.json (add it to parallel-refs.json and re-import)')
            continue
        if not pr.get('quote') or not contains(pr['quote'], ed.parallels[ref]['text']):
            fail(f'{where}: parallel {ref}: quote {pr.get("quote")!r} does not occur in the passage')
        if not pr.get('note'):
            fail(f'{where}: parallel {ref}: no note')
    ct = e.get('contemporary', {})
    if not ct.get('theme') or not ct.get('text'):
        fail(f'{where}: contemporary relevance needs theme and text')
    rf = e.get('reflect', {})
    for k in ('beginner', 'deeper', 'practice'):
        if not rf.get(k):
            fail(f'{where}: reflect.{k} missing')
    if e.get('status') not in ('draft', 'machine-verified', 'reviewed'):
        fail(f'{where}: status must be draft, machine-verified or reviewed')
    for f in e.get('flags', []):
        if f.get('kind') not in ('uncertain', 'variant', 'interpretation', 'review') or not f.get('note'):
            fail(f'{where}: bad flag {f}')
    # every quotation anywhere in the record must be found in some commentary on this mantra
    declared = set(ed.cfg['commentaries'])

    def walk(x):
        if isinstance(x, dict):
            for k, v in x.items():
                if k == 'sources' and isinstance(v, list):
                    declared.update(v)
                else:
                    walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)
    walk(e)
    quotes_ok(ed, n, json.dumps(e, ensure_ascii=False), sorted(declared), f'{where} (any field)')
    banned(json.dumps(e, ensure_ascii=False), where)
    return True


# --------------------------------------------- glossary, studies, guide
def check_glossary(path, ed):
    g = load(path)
    ids = {}
    for t in g['terms']:
        for k in ('id', 'sa', 'en', 'short', 'long'):
            if not t.get(k):
                fail(f'glossary {t.get("id")}: lacks {k}')
        if t.get('id') in ids:
            fail(f'glossary: duplicate id {t["id"]}')
        ids[t.get('id')] = t
    for t in g['terms']:
        for s in t.get('see', []):
            if s not in ids:
                fail(f'glossary {t["id"]}: see-also {s!r} is not a term')
        banned(json.dumps(t, ensure_ascii=False), f'glossary {t["id"]}')
        if ed is None:
            continue
        srcs = t.get('sources') or [f'{c}:1-{ed.text["count"]}' for c in ed.cfg['commentaries']] + [f'text:1-{ed.text["count"]}']
        quotes_ok(ed, 1, json.dumps(t, ensure_ascii=False), srcs, f'glossary {t["id"]}')
        for occ in t.get(ed.id, []):
            ap = os.path.join(ed.dir, 'analysis', f'{occ["n"]:02d}.json')
            if not os.path.exists(ap):
                continue
            words = [w for line in load(ap)['padaccheda'] for w in line]
            if occ['form'] not in words:
                fail(f'glossary {t["id"]}: {occ["form"]!r} is not a word of {ed.id} {occ["n"]}')
    return ids


ESSAY_LABELS = LABELS | {'historical'}


def check_principal(path, ed):
    d = load(path)
    if len(d['upanishads']) != 10:
        fail('principal.json: there must be ten principal Upaniṣads')
    for u in d['upanishads']:
        for k in ('id', 'sa', 'en', 'veda', 'location', 'structure', 'subject', 'famous', 'level'):
            if not u.get(k):
                fail(f'principal {u.get("id")}: lacks {k}')
        if u.get('level') not in d['levels']:
            fail(f'principal {u["id"]}: unknown level')
        for f in u['famous']:
            ref = f['ref']
            if ref.startswith('Isha '):
                txt = ed.mtext(int(ref.split()[1]))
            else:
                txt = ed.parallels.get(ref, {}).get('text', '')
            if not txt or not contains(f['quote'], txt):
                fail(f'principal {u["id"]}: {ref} does not contain {f["quote"]!r}')


def check_essay(path, ed):
    d = load(path)
    where = os.path.relpath(path, ROOT)
    if not d.get('title') or not d.get('sections'):
        fail(f'{where}: needs title and sections')
    for i, s in enumerate(d.get('sections', [])):
        if s.get('label') not in ESSAY_LABELS:
            fail(f'{where}: section {i + 1} ({s.get("heading")!r}) has label {s.get("label")!r}')
        if not s.get('paras'):
            fail(f'{where}: section {i + 1} has no paragraphs')
        txt = ' '.join(s.get('paras', []))
        if ed is not None:
            quotes_ok(ed, s.get('mantra', 1), txt, s.get('sources', []), f'{where} §{i + 1}')
        for pr in s.get('parallels', []):
            if pr['ref'] not in ed.parallels or not contains(pr['quote'], ed.parallels[pr['ref']]['text']):
                fail(f'{where} §{i + 1}: parallel {pr["ref"]} / {pr.get("quote")!r} not verified')
    banned(json.dumps(d, ensure_ascii=False), where)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--mantra', type=int)
    ap.add_argument('--partial', action='store_true')
    a = ap.parse_args()
    coll = load(os.path.join(COLL, 'data', 'collection.json'))
    glossary = check_glossary(os.path.join(COLL, 'data', 'glossary.json'), None)
    for x in coll['editions']:
        if x.get('status') != 'available':
            continue
        ed = Edition(x['id'])
        check_text(ed)
        check_collation(ed)
        check_glossary(os.path.join(COLL, 'data', 'glossary.json'), ed)
        nums = [a.mantra] if a.mantra else range(1, ed.text['count'] + 1)
        missing = [n for n in nums if not check_analysis(ed, n, glossary)]
        if missing and not a.partial:
            fail(f'{ed.id}: no analysis for mantras {missing}')
        lp = os.path.join(COLL, x['id'], 'edition', 'landing.json')
        if os.path.exists(lp):
            check_essay(lp, ed)
        elif not a.partial:
            fail(f'{ed.id}: no landing.json')
        sd = os.path.join(COLL, x['id'], 'edition', 'studies')
        if os.path.isdir(sd):
            for f in sorted(os.listdir(sd)):
                check_essay(os.path.join(sd, f), ed)
        if not a.partial and len(os.listdir(sd) if os.path.isdir(sd) else []) < 6:
            fail(f'{ed.id}: fewer than six studies')
    first_ed = Edition(next(x['id'] for x in coll['editions'] if x.get('status') == 'available'))
    check_principal(os.path.join(COLL, 'data', 'principal.json'), first_ed)
    cd = os.path.join(COLL, 'data', 'guide')
    if os.path.isdir(cd):
        first = Edition(next(x['id'] for x in coll['editions'] if x.get('status') == 'available'))
        for f in sorted(os.listdir(cd)):
            check_essay(os.path.join(cd, f), first)
    if errors:
        for e in errors[:200]:
            print('✗', e)
        print(f'\n{len(errors)} problem(s)')
        sys.exit(1)
    print('✓ Upaniṣads: text, collation, padaccheda, sections, quotations, parallels, labels — all proven')


if __name__ == '__main__':
    main()
