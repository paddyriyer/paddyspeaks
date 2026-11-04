#!/usr/bin/env python3
"""The guardrail of the rite editions (/sandhyavandanam/edition/, Validate Content).

  python3 scripts/prayoga/check.py sandhyavandanam            # everything
  python3 scripts/prayoga/check.py sandhyavandanam --partial  # analysis may be missing
  python3 scripts/prayoga/check.py sandhyavandanam --only apo-hi-stha

What it proves (docs/SANDHYAVANDANAM-EDITION.md):

  TEXT       every Vedic unit equals its base witness W1 (the Saṃhitā, Āraṇyaka or
             Brāhmaṇa, cut by import.py) letter for letter, apart from the logged
             corrections; every text of the rite equals its base witness (M, or S
             where M lacks it) apart from the logged corrections; `plain` (the
             standard spelling used for the word division) has the same sounds as
             the Taittirīya spelling of the base.
  COLLATION  every difference of the second witness (W2 for the Vedic units, S for
             the texts of the rite) is listed and classified, and no entry is stale.
  RITE       every item of rite.json exists: a Vedic unit, a text, or a unit of the
             Mahānārāyaṇa edition (whose own checker proves it), and a `from`…`to`
             part occurs in that unit; `only` names real services.
  ANALYSIS   every recited item has a record; every unit's padaccheda rejoins by
             sandhi into the text, and its word table lists exactly those words
             (the Upaniṣad editions' unit checker, scripts/upanishads/check.py);
             every «quotation» given to a commentator occurs in that commentator's
             text on the source anuvāka (witnesses/comm.json); labels and banned
             wording as in the Upaniṣads.
"""
import argparse
import difflib
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'upanishads'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'devi_mahatmyam'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'rudram'))
from textlib import letters, diff, phon, strip_accents  # noqa: E402
from collate import skeleton  # noqa: E402
import importlib.util  # noqa: E402
_spec = importlib.util.spec_from_file_location('upanishads_check', os.path.join(ROOT, 'scripts', 'upanishads', 'check.py'))
U = importlib.util.module_from_spec(_spec)   # the Upaniṣad checker: unit proofs, quotations, banned wording
_spec.loader.exec_module(U)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spelling import plain_ts  # noqa: E402,F401

CLASSES = {'orthographic', 'variant', 'witness-error', 'recension', 'review'}
LABELS = {'direct', 'traditional', 'linguistic', 'historical', 'reflection'}
KINDS = {'formula', 'verse', 'viniyoga', 'nyasa', 'vedic-composite'}
errors = U.errors


def fail(msg):
    errors.append(msg)


def load(p):
    with open(p, encoding='utf-8') as fh:
        return json.load(fh)


def sk(s):
    """The collation skeleton (scripts/rudram/collate.py), t+c assimilated."""
    return re.sub(r't(?=c)', 'c', skeleton(strip_accents(s)))


def sk_loose(s):
    """The skeleton without the Taittirīya doublings (व्ण्ण, बोद्ध्यु, श्ञ, ऱ्):
    what `plain` may change and nothing else."""
    s = sk(s).replace('ऱ्', 'r').replace('śñ', 'śn')
    return re.sub(r'(kh|gh|ch|jh|ṭh|ḍh|th|dh|ph|bh|[kgcjṭḍṇtdnpbmyrlvśṣs])\1+', r'\1', s.replace('ddh', 'dh'))


def sk_diff(a, b):
    x, y = sk(a), sk(b)
    out = []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(a=x, b=y, autojunk=False).get_opcodes():
        if tag != 'equal':
            out.append((x[i1:i2], y[j1:j2], x[max(0, i1 - 6):i2 + 6]))
    return out


def lines_of(text, commas=False):
    """A unit's lines: the text cut at its dandas (and, in the texts of the rite,
    at the commas with which the prayogas mark a pause)."""
    pat = r'\s*[।॥,]+\s*' if commas else r'\s*[।॥]+\s*'
    return [x.strip() for x in re.split(pat, text) if x.strip() and not re.fullmatch(r'[०-९\d\s]+', x.strip())]


class Edition:
    def __init__(self, eid):
        self.id = eid
        self.dir = os.path.join(ROOT, eid, 'edition')
        d = self.dir
        self.T = load(os.path.join(d, 'text.json'))
        self.S = load(os.path.join(d, 'sources.json'))
        self.R = load(os.path.join(d, 'rite.json'))
        self.RT = {x['id']: x for x in load(os.path.join(d, 'rite-texts.json'))['texts']}
        w = os.path.join(d, 'witnesses')
        self.W1 = load(os.path.join(w, 'W1.json'))['units']
        self.W2 = load(os.path.join(w, 'W2.json'))['units']
        opt = lambda f: load(os.path.join(w, f))['texts'] if os.path.exists(os.path.join(w, f)) else {}
        self.M = opt('M.json')
        self.Sw = opt('S.json')
        self.CM = load(os.path.join(w, 'comm.json'))['mantras']
        cp = os.path.join(d, 'corrections.json')
        self.C = load(cp) if os.path.exists(cp) else {'text': [], 'collation': []}
        self.units = {u['id']: (m, u) for m in self.T['mantras'] for u in m['units']}
        self.mantras = {m['id']: m for m in self.T['mantras']}
        self.services = {s['id'] for s in self.R['services']}
        mn = load(os.path.join(ROOT, 'upanishads', 'mahanarayana', 'edition', 'text.json'))
        self.MNU = {}

        def walk(o):
            if isinstance(o, dict):
                if 'lines' in o and 'id' in o:
                    self.MNU[o['id']] = o
                for v in o.values():
                    walk(v)
            elif isinstance(o, list):
                for v in o:
                    walk(v)
        walk(mn)

    def base_of(self, tid):
        t = self.T['texts'][tid]
        return ('S', self.Sw.get(tid)) if t.get('base') == 'S' else ('M', self.M.get(tid))

    def other_of(self, tid):
        wit, _ = self.base_of(tid)
        return ('M', self.M.get(tid)) if wit == 'S' else ('S', self.Sw.get(tid))


def check_text(ed):
    logged = {}
    for c in ed.C.get('text', []):
        for f in ('at', 'base', 'edition', 'why'):
            if f not in c:
                fail(f'corrections.text entry lacks {f}: {c}')
        logged.setdefault(c['at'], []).append(c)
    used = set()
    for uid, (m, u) in ed.units.items():
        w1 = ed.W1.get(uid)
        if not w1:
            fail(f'{uid}: no W1 reading')
            continue
        for a, b, ctx in diff(w1['text'], u['samhita']):
            hit = [c for c in logged.get(uid, []) if letters(c['base']) == a and letters(c['edition']) == b]
            if not hit:
                fail(f'{uid}: text differs from W1 «{a}» → «{b}» (…{ctx}…) and the change is not logged in corrections.json')
            used.update(id(c) for c in hit)
        if u.get('plain') is None:
            fail(f'{uid}: no plain spelling')
        elif sk_loose(u['plain']) != sk_loose(u['samhita']):
            d = sk_diff(u['samhita'], u['plain'])[:3]
            fail(f'{uid}: plain spelling is not the same text as the Saṃhitā: {d}')
    for tid, t in ed.T['texts'].items():
        if tid not in ed.RT:
            fail(f'text {tid}: not in rite-texts.json')
            continue
        wit, base = ed.base_of(tid)
        if base is None:
            fail(f'text {tid}: base witness {wit} has no reading')
            continue
        for a, b, ctx in diff(base, t['text']):
            hit = [c for c in logged.get(tid, []) if letters(c['base']) == a and letters(c['edition']) == b]
            if not hit:
                fail(f'{tid}: text differs from {wit} «{a}» → «{b}» (…{ctx}…) and the change is not logged')
            used.update(id(c) for c in hit)
    for c in ed.C.get('text', []):
        if id(c) not in used:
            fail(f'corrections.text entry at {c.get("at")} («{c.get("base")}» → «{c.get("edition")}») no longer matches the text: stale')


def check_collation(ed):
    entries = {}
    for c in ed.C.get('collation', []):
        if c.get('class') not in CLASSES:
            fail(f'collation entry at {c.get("at")}: class {c.get("class")!r}')
        if not c.get('note'):
            fail(f'collation entry at {c.get("at")}: no note')
        entries.setdefault((c['at'], c['wit']), []).append(c)
    used = set()

    def need(at, wit, a, b, ctx):
        hit = [c for c in entries.get((at, wit), []) if c['base'] == a and c['other'] == b]
        if not hit:
            fail(f'{at}: {wit} reads «{b}» for «{a}» (…{ctx}…), not classified in corrections.json collation')
        used.update(id(c) for c in hit)
    for uid, (m, u) in ed.units.items():
        w2 = ed.W2.get(uid, {}).get('text')
        if w2:
            for a, b, ctx in sk_diff(u['samhita'], w2):
                need(uid, 'W2', a, b, ctx)
    for tid, t in ed.T['texts'].items():
        ow, other = ed.other_of(tid)
        if other:
            for a, b, ctx in diff(t['text'], other):
                need(tid, ow, a, b, ctx)
    for c in ed.C.get('collation', []):
        if id(c) not in used:
            fail(f'collation entry at {c["at"]} ({c["wit"]} «{c["base"]}» → «{c["other"]}») is stale')


def mnu_part(ed, it):
    u = ed.MNU.get(it['mnu'])
    if not u:
        return None
    text = ' '.join(u['lines'])
    if 'from' in it:
        L = letters(text)
        a, b = letters(it['from']), letters(it['to'])
        i = L.find(a)
        j = L.find(b, max(i, 0))
        if i < 0 or j < 0:
            return False
    return text


def check_rite(ed):
    seen_t, seen_v = set(), set()
    if ed.R.get('basis') and ed.R['basis'] not in ed.mantras:
        fail(f'rite.json basis {ed.R["basis"]} is not a mantra')
    for st in ed.R['steps']:
        for f in ('id', 'sa', 'en', 'what', 'items'):
            if not st.get(f):
                fail(f'step {st.get("id")}: lacks {f}')
        for it in st['items']:
            for s in it.get('only', []):
                if s not in ed.services:
                    fail(f'step {st["id"]}: unknown service {s}')
            if 't' in it:
                if it['t'] not in ed.T['texts']:
                    fail(f'step {st["id"]}: text {it["t"]} not in text.json')
                seen_t.add(it['t'])
            elif 'v' in it:
                if it['v'] not in ed.mantras:
                    fail(f'step {st["id"]}: mantra {it["v"]} not in text.json')
                seen_v.add(it['v'])
            elif 'mnu' in it:
                r = mnu_part(ed, it)
                if r is None:
                    fail(f'step {st["id"]}: Mahānārāyaṇa unit {it["mnu"]} does not exist')
                elif r is False:
                    fail(f'step {st["id"]}: «{it["from"]}» … «{it["to"]}» is not in Mahānārāyaṇa {it["mnu"]}')
            else:
                fail(f'step {st["id"]}: item {it} has no t / v / mnu')
    for tid in ed.T['texts']:
        if tid not in seen_t:
            fail(f'text {tid} is in no step of the rite')
    return seen_t, seen_v


def comm_text(ed, mid, who):
    return ' '.join(b['text'] for b in ed.CM.get(mid, {}).get('blocks', []) if b['who'] == who)


def check_record(ed, key, rec, units, sources_of):
    where = key
    if rec.get('id') != key:
        fail(f'{where}: id {rec.get("id")!r}')
    for f in ('title', 'units', 'meaning', 'in_the_rite', 'status'):
        if not rec.get(f):
            fail(f'{where}: lacks {f}')
    rus = rec.get('units', [])
    if len(rus) != len(units):
        fail(f'{where}: {len(rus)} analysed units, the text has {len(units)}')
    for k, (u, e) in enumerate(zip(units, rus), 1):
        U.check_unit(None, key, u, e, f'{where} unit {k}')
    n = len(re.findall(r'\S+', rec.get('meaning', '')))
    if rec.get('meaning') and not 30 <= n <= 220:
        fail(f'{where}: meaning has {n} words (30–220)')
    for c in rec.get('commentary', []):
        if c.get('who') not in sources_of:
            fail(f'{where}: commentary by {c.get("who")!r}, whose text on this passage is not in witnesses/comm.json')
            continue
        if c.get('label') not in LABELS:
            fail(f'{where}: commentary label {c.get("label")!r}')
        pool = phon(comm_text(ed, sources_of[c['who']], c['who']))
        for q in U.QUOTE.findall(c.get('text', '')):
            if re.search(r'[ऀ-ॿ]', q):
                pq = phon(q)
                cands = [pq, pq[:-1] if pq.endswith(('ḥ', 'm', 'ṃ', 'n')) else pq]
                if not any(x and x in pool for x in cands):
                    fail(f'{where}: quotation «{q}» is not in {c["who"]} on this passage')
    for nt in rec.get('notes', []):
        if nt.get('label') not in LABELS:
            fail(f'{where}: note label {nt.get("label")!r}')
    blob = json.dumps(rec, ensure_ascii=False)
    U.banned(blob, where)


def check_analysis(ed, seen_t, seen_v, partial, only):
    adir = os.path.join(ed.dir, 'analysis')
    targets = [(v, 'v') for v in sorted(seen_v)] + [(t, 't') for t in sorted(seen_t)]
    for key, kind in targets:
        if only and key != only:
            continue
        p = os.path.join(adir, f'{key}.json')
        if not os.path.exists(p):
            if not partial:
                fail(f'{key}: no analysis record (analysis/{key}.json)')
            continue
        rec = load(p)
        if kind == 'v':
            m = ed.mantras[key]
            units = [{'id': u['id'], 'lines': lines_of(u['plain'])} for u in m['units']]
            who = {b['who'] for b in ed.CM.get(key, {}).get('blocks', [])}
            sources_of = {w: key for w in who}
        else:
            t = ed.T['texts'][key]
            if ed.RT[key]['kind'] not in KINDS:
                fail(f'{key}: kind {ed.RT[key]["kind"]!r}')
            lines = lines_of(strip_accents(t['text']), commas=True)
            ru = (rec.get('units') or [{}])[0]
            if ru.get('lines'):
                # the record may mark further pauses where the prayoga keeps words
                # unjoined (around a blank, a formula's parts): same letters, a note
                if letters(''.join(ru['lines'])) != letters(''.join(lines)):
                    fail(f'{key}: the lines of the record are not the text')
                if not ru.get('pause_note'):
                    fail(f'{key}: lines given without a pause_note')
                lines = ru['lines']
            units = [{'id': key, 'lines': lines}]
            sources_of = {}
            if key == 'drupadad-iva':
                who = {b['who'] for b in ed.CM.get(key, {}).get('blocks', [])}
                sources_of = {w: key for w in who}
        check_record(ed, key, rec, units, sources_of)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('edition')
    ap.add_argument('--partial', action='store_true')
    ap.add_argument('--only')
    a = ap.parse_args()
    ed = Edition(a.edition)
    check_text(ed)
    check_collation(ed)
    seen_t, seen_v = check_rite(ed)
    check_analysis(ed, seen_t, seen_v, a.partial, a.only)
    if errors:
        for e in errors:
            print('✗', e)
        print(f'\n{len(errors)} problem(s)')
        sys.exit(1)
    print(f'✓ {a.edition}: text, collation, rite, analysis — all proven')


if __name__ == '__main__':
    main()
