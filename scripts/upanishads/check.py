#!/usr/bin/env python3
"""The guardrail of the Upaniṣads study editions (Validate Content).

  python3 scripts/upanishads/check.py                 # everything, every edition
  python3 scripts/upanishads/check.py --mantra 4                  # one Īśā mantra
  python3 scripts/upanishads/check.py --edition taittiriya --mantra 1.11   # one anuvāka
  python3 scripts/upanishads/check.py --partial       # allow analysis files to be missing

Records are keyed by strings: an Īśā mantra "4"; a Taittirīya anuvāka "1.11"
(vallī.anuvāka), whose record holds its numbered units ("1.11.3") in `units`.

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
        if 'vallis' in self.text:
            self.recs = {a['id']: a for v in self.text['vallis'] for a in v['anuvakas']}
            self.shanti_of = {f"{v['n']}.1": v['shanti'] for v in self.text['vallis'] if v.get('shanti')}
        else:
            self.recs = {str(m['n']): {'id': str(m['n']), 'units': [{'id': str(m['n']), 'n': m['n'], 'lines': m['lines']}]}
                         for m in self.text['mantras']}
            self.shanti_of = {}
        self.keys = list(self.recs)

    def units(self, k):
        return self.recs[str(k)]['units']

    def mtext(self, k):
        return ' '.join(l for u in self.units(k) for l in u['lines'])

    def rec_file(self, k):
        k = str(k)
        if '.' in k:
            v, a = k.split('.')
            return os.path.join(self.dir, 'analysis', f'{v}-{int(a):02d}.json')
        return os.path.join(self.dir, 'analysis', f'{int(k):02d}.json')

    def in_scope(self, k):
        sc = self.cfg.get('analysed')
        return sc is None or str(k).split('.')[0] in sc

    def expand(self, at):
        out = []
        for part in at.split(','):
            if part in ('opening', 'closing', 'intro'):
                out.append(part)
            elif '-' in part:
                a, b = part.split('-')
                if a in self.keys and b in self.keys:
                    out.extend(self.keys[self.keys.index(a):self.keys.index(b) + 1])
                else:
                    out.extend(str(i) for i in range(int(a), int(b) + 1))
            else:
                out.append(part)
        return out

    def witness_readings(self):
        """{witness id: {record key: text}}, using each witness's mapping."""
        out = {}
        for wid, spec in self.cfg['witnesses'].items():
            data = self.wfiles[spec['file']]['mantras']
            m = {}
            for k in self.keys:
                keys = spec.get('map', {}).get(k, [k])
                if keys is None:
                    continue
                parts = [' '.join(data[x]) for x in keys if x in data]
                if parts:
                    m[k] = ' '.join(parts)
            out[wid] = m
        return out

    def readings_of(self, k):
        out = []
        for wid, spec in self.cfg['witnesses'].items():
            w = self.wfiles[spec['file']]
            keys = spec.get('map', {}).get(str(k), [str(k)]) or []
            out += [' '.join(w['mantras'][x]) for x in keys if x in w['mantras']]
            out += [w.get('pada', {}).get(x, '') for x in keys]
        return out

    def commentary(self, who, k):
        """The commentator's text on record k (plus the passages the
        edition.json grouping assigns to it)."""
        if who == 'text':  # the record, its witnesses and the pada-pāṭha
            return ' '.join([self.mtext(k)] + self.readings_of(k)) if str(k) in self.recs else ''
        if who == 'parallel':
            return ''
        spec = self.cfg['commentaries'][who]
        data = self.wfiles[spec['file']]
        keys = spec.get('map', {}).get(str(k), [str(k)])
        out = []
        for x in keys:
            if x in ('opening', 'closing', 'intro'):
                out.append(data.get(x, ''))
                continue
            v = data['mantras'].get(x)
            if isinstance(v, dict):
                out.append(v.get('intro', '') + ' ' + v.get('bhashya', ''))
            elif v:
                out.append(v)
        return ' '.join(out)


# ------------------------------------------------------------------ TEXT
def dn(num):
    return int(''.join(str('०१२३४५६७८९'.index(c)) for c in num))


def check_text(ed):
    if 'mantras' in ed.text and [m['n'] for m in ed.text['mantras']] != list(range(1, ed.text['count'] + 1)):
        fail(f'{ed.id}: mantras are not numbered 1..{ed.text["count"]}')
    if len(ed.keys) != ed.text['count']:
        fail(f'{ed.id}: {len(ed.keys)} records but count says {ed.text["count"]}')
    if 'vallis' in ed.text:
        for v in ed.text['vallis']:
            if [a['n'] for a in v['anuvakas']] != list(range(1, len(v['anuvakas']) + 1)):
                fail(f'{ed.id}: vallī {v["n"]}: anuvākas are not numbered 1..N')
    seen = {}
    corr = {}
    for c in ed.corr['corrections']:
        corr.setdefault(str(c['at']), []).append(c)
    for k in ed.keys:
        lt = letters(ed.mtext(k))
        if lt in seen:
            fail(f'{ed.id} {k}: the same text as {seen[lt]} (duplicated?)')
        seen[lt] = k
        for i, u in enumerate(ed.units(k), 1):
            last = u['lines'][-1]
            m = re.search(r'॥\s*([०-९]+)\s*॥$', last)
            want = int(k) if '.' not in k else i
            if not m:
                fail(f'{ed.id} {u["id"]}: the last line must end with ॥ N ॥')
            elif dn(m.group(1)) != want:
                fail(f'{ed.id} {u["id"]}: printed number {m.group(1)} does not match {want}')
        g = ' '.join(ed.base['mantras'][k])
        for c in corr.get(k, []):
            if c['from'] not in g:
                fail(f'{ed.id}: correction at {k}: {c["from"]!r} is not in the base witness')
            g = g.replace(c['from'], c['to'])
            if c['to'] not in ed.mtext(k) and c.get('kind') != 'structure':
                fail(f'{ed.id}: correction at {k}: {c["to"]!r} is not in the text')
            if not c.get('reason'):
                fail(f'{ed.id}: correction at {k} has no reason')
        mine = ed.mtext(k)
        if k in ed.shanti_of:
            mine = ' '.join(ed.shanti_of[k]['lines']) + ' ' + mine
        d = diff(g, mine)
        if d:
            fail(f'{ed.id} {k}: text differs from the base witness {ed.text["base"]} in letters: {d}')


# ------------------------------------------------------------- COLLATION
def check_collation(ed):
    W = ed.witness_readings()
    listed = {}
    for v in ed.corr['variants']:
        listed.setdefault((str(v['at']), v['witness']), []).append(v)
        if v['class'] not in ('orthographic', 'variant', 'recension', 'witness-error', 'review'):
            fail(f'{ed.id}: variant at {v["at"]}/{v["witness"]}: unknown class {v["class"]!r}')
        if not v.get('note'):
            fail(f'{ed.id}: variant at {v["at"]}/{v["witness"]}: no note')
    for wid, readings in W.items():
        if ed.cfg['witnesses'][wid].get('role') == 'base':
            continue  # the base is proven by check_text, its differences are corrections
        if ed.cfg['witnesses'][wid].get('scope') == 'valli':
            # collated vallī by vallī: the witness divides anuvākas differently
            for vk in sorted({k.split('.')[0] for k in ed.keys}, key=int):
                ks = [k for k in ed.keys if k.split('.')[0] == vk]
                mine = ' '.join(ed.mtext(k) for k in ks)
                r = ' '.join(readings.get(k, '') for k in ks)
                found = [(a, b) for a, b, _ in diff(mine, r)]
                want = [(v['base'], v['reading_letters']) for v in listed.get((vk, wid), [])]
                if found != want:
                    fail(f'{ed.id} vallī {vk}: witness {wid}: differences {found} but corrections.json lists {want}')
            continue
        for k in ed.keys:
            r = readings.get(k)
            if r is None:
                if k not in ed.cfg['witnesses'][wid].get('absent', []):
                    fail(f'{ed.id}: witness {wid} has no {k} and does not declare it absent')
                continue
            found = [(a, b) for a, b, _ in diff(ed.mtext(k), r)]
            want = [(v['base'], v['reading_letters']) for v in listed.get((k, wid), [])]
            if found != want:
                fail(f'{ed.id} {k}: witness {wid}: differences {found} but corrections.json lists {want}')


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


def quotes_missing(ed, n, text, sources):
    """The «Devanagari» quotations in text that are in none of the sources."""
    saved = errors[:]
    quotes_ok(ed, n, text, sources, '')
    new = errors[len(saved):]
    del errors[len(saved):]
    return {m.split('quotation «', 1)[1].split('»', 1)[0] for m in new}


def quotes_ok(ed, n, text, sources, where):
    """Every «Devanagari» quote in text occurs in one of the sources, or in the
    mantra or its witnesses (a quoted gloss may drop its final visarga)."""
    pool = [phon(ed.mtext(n))] + [phon(r) for r in ed.readings_of(n)]
    for s in sources:
        who, _, at = s.partition(':')
        if who == 'parallel':
            pool.append(phon(ed.parallels.get(at, {}).get('text', '')))
            continue
        nums = [str(n)] if not at else ed.expand(at)
        for k in nums:
            pool.append(phon(ed.commentary(who, k)))
    for q in QUOTE.findall(text):
        if not re.search(r'[\u0900-\u097f]', q):
            continue
        pq = phon(q)
        cands = [pq, pq[:-1] if pq.endswith(('ḥ', 'm', 'ṃ', 'n')) else pq]
        if not any(c in p for c in cands for p in pool):
            fail(f'{where}: quotation «{q}» is not in {", ".join(sources) or "the mantra"}')


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


UNIT_FIELDS = ['padaccheda', 'words', 'sandhi', 'samasa', 'morphology', 'translation']


def check_unit(ed, k, u, e, where):
    """The text-level sections of one unit: padaccheda, word table, sandhi,
    compounds, morphology, anvaya and metre, proven against the unit's lines."""
    pada = e.get('padaccheda', [])
    if len(pada) != len(u['lines']):
        fail(f'{where}: padaccheda has {len(pada)} lines, the text {len(u["lines"])}')
    target = dev2iast(re.sub(r'\s*॥\s*[०-९]+\s*॥\s*$', '', ' '.join(u['lines'])).replace('ॐ', 'ओम्'))
    ok, info = rejoin([[dev2iast(w) for w in line] for line in pada], target)
    flat = [w for line in pada for w in line]
    if not ok:
        fail(f'{where}: padaccheda does not rejoin into the text (stuck at word {info + 1}: {flat[max(0, info - 2):info + 2]})')
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
        for f in ('w', 'base', 'gram', 'meaning', 'role'):
            if not w.get(f):
                fail(f'{where}: word {w.get("w")!r} lacks {f!r}')
    ut = ' '.join(u['lines'])
    for s in e.get('sandhi', []):
        if phon(s.get('joined', '')) not in phon(ut):
            fail(f"{where}: sandhi example {s.get('joined')!r} is not in the text")
        for f in ('split', 'type', 'rule'):
            if not s.get(f):
                fail(f"{where}: sandhi {s.get('joined')!r} lacks {f}")
    fl = set(flat)
    for s in e.get('samasa', []):
        if s.get('word') not in fl:
            fail(f"{where}: compound {s.get('word')!r} is not a padaccheda word")
        for f in ('members', 'type', 'vigraha', 'meaning'):
            if not s.get(f):
                fail(f"{where}: compound {s.get('word')!r} lacks {f}")
    for s in e.get('morphology', []):
        if s.get('word') not in fl:
            fail(f"{where}: morphology note on {s.get('word')!r}, not a padaccheda word")
    anv = re.sub(r'\[[^\]]*\]', ' ', e.get('anvaya', ''))
    for tok in re.findall(r'[\u0900-\u097f]+', anv):
        if tok not in fl and tok not in ('।', '॥'):
            fail(f'{where}: anvaya word {tok!r} is neither a padaccheda word nor [supplied]')
    tr = e.get('translation', {})
    if not tr.get('literal') or not tr.get('readable'):
        fail(f'{where}: translation needs literal and readable')
    met = e.get('metre')
    if met:
        counts = [syllables(l) for l in u['lines']]
        want = METRES.get(met.get('name'))
        if want and counts != want and not re.search(r'\d', met.get('note', '')):
            fail(f'{where}: metre {met.get("name")} but {counts} syllables and the note does not explain them')
        if not met.get('name') or not met.get('note'):
            fail(f'{where}: metre needs a name and a note')


def check_analysis(ed, n, glossary):
    k = str(n)
    p = ed.rec_file(k)
    if not os.path.exists(p):
        return False
    e = load(p)
    where = f'{ed.id} {k}'
    multi = 'vallis' in ed.text
    req = [f for f in REQUIRED if not (multi and (f in UNIT_FIELDS or f in ('n', 'anvaya', 'sandhi_exceptions')))]
    for f in req:
        if f not in e:
            fail(f'{where}: missing section {f!r}')
    if multi:
        if e.get('id') != k:
            fail(f'{where}: id is {e.get("id")}')
        us = e.get('units', [])
        want = [u['id'] for u in ed.units(k)]
        if [u.get('id') for u in us] != want:
            fail(f'{where}: units are {[u.get("id") for u in us]}, the text has {want}')
        for u, eu in zip(ed.units(k), us):
            for f in UNIT_FIELDS:
                if f not in eu:
                    fail(f'{where} {u["id"]}: missing {f!r}')
            check_unit(ed, k, u, eu, f'{where} {u["id"]}')
        met = e.get('metre', {})
        if not met.get('name') or not met.get('note'):
            fail(f'{where}: metre needs a name and a note')
    else:
        if str(e.get('n')) != k:
            fail(f'{where}: n is {e.get("n")}')
        check_unit(ed, k, ed.units(k)[0], e, where)
        if not e.get('metre'):
            fail(f'{where}: metre needs a name and a note')
    # beginner
    bw = len(re.findall(r"[A-Za-zĀ-ſḀ-ỿ’'-]+", e.get('beginner', '')))
    if not 90 <= bw <= 170:
        fail(f'{where}: beginner explanation is {bw} words (90–170)')
    if re.search(r'[ऀ-ॿ]', e.get('beginner', '')):
        fail(f'{where}: the beginner explanation must not use Devanagari')
    if not e.get('analogy'):
        fail(f'{where}: no analogy')
    for c in e.get('key_concepts', []):
        if c not in glossary:
            fail(f'{where}: key concept {c!r} is not in the glossary')
    # commentary
    for i, c in enumerate(e.get('commentary', [])):
        if c.get('label') not in LABELS:
            fail(f'{where}: commentary block {i + 1} has label {c.get("label")!r}')
        if not c.get('q') or not c.get('text'):
            fail(f'{where}: commentary block {i + 1} needs q and text')
        quotes_ok(ed, k, c.get('text', ''), c.get('sources', []), f'{where} commentary {i + 1}')
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
        quotes_ok(ed, k, x.get('text', ''), src, f'{where} school {s}')
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
    for f in ('beginner', 'deeper', 'practice'):
        if not rf.get(f):
            fail(f'{where}: reflect.{f} missing')
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
    quotes_ok(ed, k, json.dumps(e, ensure_ascii=False), sorted(declared), f'{where} (any field)')
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
        for occ in t.get(ed.id, []):
            ap = ed.rec_file(occ['n'])
            if not os.path.exists(ap):
                continue
            rec = load(ap)
            words = [w for u in rec.get('units', [rec]) for line in u['padaccheda'] for w in line]
            if occ['form'] not in words:
                fail(f'glossary {t["id"]}: {occ["form"]!r} is not a word of {ed.id} {occ["n"]}')
    return ids


def check_glossary_quotes(path, eds):
    """A glossary quotation must be found in the sources of at least one edition."""
    for t in load(path)['terms']:
        left = None
        for ed in eds:
            rng = f'{ed.keys[0]}-{ed.keys[-1]}'
            srcs = [s for s in t.get('sources', []) if not s.startswith('parallel:') or s.split(':', 1)[1] in ed.parallels] \
                + [f'{c}:{rng}' for c in ed.cfg['commentaries']] + [f'text:{rng}']
            miss = quotes_missing(ed, ed.keys[0], json.dumps(t, ensure_ascii=False), srcs)
            left = miss if left is None else left & miss
        for q in sorted(left or []):
            fail(f'glossary {t["id"]}: quotation «{q}» is in no edition’s sources')


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
                txt = ed.mtext(ref.split()[1])
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
            quotes_ok(ed, str(s.get('mantra', ed.keys[0])), txt, s.get('sources', []), f'{where} §{i + 1}')
        for pr in s.get('parallels', []):
            if pr['ref'] not in ed.parallels or not contains(pr['quote'], ed.parallels[pr['ref']]['text']):
                fail(f'{where} §{i + 1}: parallel {pr["ref"]} / {pr.get("quote")!r} not verified')
    banned(json.dumps(d, ensure_ascii=False), where)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--mantra', help='one record: an Īśā mantra (4) or an anuvāka (1.11)')
    ap.add_argument('--edition', help='only this edition')
    ap.add_argument('--partial', action='store_true')
    a = ap.parse_args()
    coll = load(os.path.join(COLL, 'data', 'collection.json'))
    glossary = check_glossary(os.path.join(COLL, 'data', 'glossary.json'), None)
    eds = []
    for x in coll['editions']:
        if x.get('status') != 'available' or (a.edition and x['id'] != a.edition):
            continue
        ed = Edition(x['id'])
        eds.append(ed)
        check_text(ed)
        check_collation(ed)
        check_glossary(os.path.join(COLL, 'data', 'glossary.json'), ed)
        keys = [a.mantra] if a.mantra else ed.keys
        missing = [k for k in keys if not check_analysis(ed, k, glossary) and ed.in_scope(k)]
        if missing and not a.partial:
            fail(f'{ed.id}: no analysis for {missing}')
        lp = os.path.join(COLL, x['id'], 'edition', 'landing.json')
        if os.path.exists(lp):
            check_essay(lp, ed)
        elif not a.partial:
            fail(f'{ed.id}: no landing.json')
        sd = os.path.join(COLL, x['id'], 'edition', 'studies')
        if os.path.isdir(sd):
            for f in sorted(os.listdir(sd)):
                check_essay(os.path.join(sd, f), ed)
        need = ed.cfg.get('min_studies', 6)
        if not a.partial and len(os.listdir(sd) if os.path.isdir(sd) else []) < need:
            fail(f'{ed.id}: fewer than {need} studies')
    all_eds = eds if not a.edition else [Edition(x['id']) for x in coll['editions'] if x.get('status') == 'available']
    check_glossary_quotes(os.path.join(COLL, 'data', 'glossary.json'), all_eds)
    if not a.edition or a.edition == 'isha':
        first = Edition(next(x['id'] for x in coll['editions'] if x.get('status') == 'available'))
        check_principal(os.path.join(COLL, 'data', 'principal.json'), first)
        cd = os.path.join(COLL, 'data', 'guide')
        if os.path.isdir(cd):
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
