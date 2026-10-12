#!/usr/bin/env python3
"""Śrī Devī Māhātmyam study edition — the guardrail (stdlib only).

The text is proven, not trusted:

  text.json       13 chapters; every chapter's mantras numbered 1..N without a gap;
                  its uvāca / half-śloka / śloka / three-part mantra counts equal the
                  counts in the chapter's own Gita Press colophon; 700 in all;
                  every logged correction is in the text and its old reading is not.
  analysis/CC.json for every mantra, in order: the padaccheda must REJOIN by the
                  rules of external sandhi (sandhi.py) into the recited text; the
                  word table must list exactly the padaccheda's words in its order;
                  every vowel hiatus left unjoined must be declared and explained;
                  every sandhi example must occur in the verse, every compound and
                  analysed form in its word list; both translations, the anvaya and
                  a labelled commentary must be present.

  python3 scripts/devi_mahatmyam/check.py              # text + every analysis present
  python3 scripts/devi_mahatmyam/check.py --chapter 3  # one chapter (a batch in progress)
  python3 scripts/devi_mahatmyam/check.py --complete   # also fail if a chapter is missing

IAST is never typed: the build transliterates the Devanagari (translit.py), so
the transliteration always corresponds exactly to the Sanskrit shown.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from sandhi import rejoin, norm  # noqa: E402
from translit import dev2iast  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ED = os.path.join(ROOT, 'devi-mahatmyam', 'edition')
COUNTS_TOTAL = 700
LABELS = {'direct', 'traditional', 'comparative', 'reflection'}
DEV = re.compile(r'^[ऀ-ॿ‌‍]+$')

problems = []


def fail(msg):
    problems.append(msg)


def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def mid(ch, m):
    return f"{ch}.{m['n']}" + (f"-{m['to']}" if 'to' in m else '')


def recited(m):
    """The mantra as recited, in Devanagari: lines joined, a word broken across
    a line with a hyphen made whole again."""
    return re.sub(r'-\s+', '', ' '.join(m['lines']))


def check_text(T, LOG):
    chs = T['chapters']
    if [c['num'] for c in chs] != list(range(1, 14)):
        fail('text.json: chapters must be 1..13 in order')
    total = 0
    for c in chs:
        ch, ms = c['num'], c['mantras']
        expect = 1
        kinds = {'uvaca': 0, 'ardha': 0, 'sloka': 0, 'tripada': 0}
        for m in ms:
            if m['n'] != expect:
                fail(f'{ch}.{m["n"]}: numbering gap — expected {expect}')
            last = m.get('to', m['n'])
            expect = last + 1
            k = m['kind']
            n_lines = len(m['lines'])
            if k == 'uvaca' and (n_lines != 1 or 'to' in m):
                fail(f'{mid(ch, m)}: an uvāca is one line and one mantra')
            elif k == 'ardha' and n_lines != 1:
                fail(f'{mid(ch, m)}: a half-śloka is one line')
            elif k == 'sloka' and n_lines not in (2, 4):
                fail(f'{mid(ch, m)}: a śloka is two lines (four in the long metres)')
            elif k == 'tripada' and (m.get('to', 0) - m['n'] != 2 or n_lines != 2):
                fail(f'{mid(ch, m)}: a three-part mantra spans three numbers in two lines')
            kinds[k] = kinds.get(k, 0) + (3 if k == 'tripada' else 1)
            for line in m['lines']:
                if re.search(r'[A-Za-z*‘’"]', line) or '  ' in line:
                    fail(f'{mid(ch, m)}: stray character in {line!r}')
            if '·' in dev2iast(recited(m)):
                fail(f'{mid(ch, m)}: transliteration ambiguity (a + i/u hiatus inside a word)')
        n = expect - 1
        cc = c['counts']
        for k in kinds:
            if kinds[k] != cc[k]:
                fail(f'chapter {ch}: {k} = {kinds[k]}, colophon says {cc[k]}')
        if n != cc['total']:
            fail(f'chapter {ch}: {n} mantras, colophon says {cc["total"]}')
        total += n
        if total != cc['cumulative']:
            fail(f'chapter {ch}: running total {total}, colophon says {cc["cumulative"]}')
    if total != COUNTS_TOTAL:
        fail(f'text.json: {total} mantras, expected {COUNTS_TOTAL}')
    # corrections
    by_id = {}
    for c in chs:
        for m in c['mantras']:
            for k in range(m['n'], m.get('to', m['n']) + 1):
                by_id[f"{c['num']}.{k}"] = m
    for cor in LOG['corrections']:
        if cor['kind'] in ('typographical', 'orthographic', 'grammatical', 'encoding') and cor['id'] in by_id:
            txt = ' '.join(by_id[cor['id']]['lines'])
            if cor['to'].rstrip('।॥') not in txt:
                fail(f"correction {cor['id']}: corrected reading {cor['to']!r} not in the text")
            if cor['from'].rstrip('।॥') in txt:
                fail(f"correction {cor['id']}: old reading {cor['from']!r} is still in the text")
    for v in LOG['variants']:
        if v['id'] not in by_id:
            fail(f"variant {v['id']}: no such mantra")
    return by_id


def words_of(e):
    return [w for line in e.get('pada', []) for w in line]


def need(e, key, where):
    v = e.get(key)
    if v is None or (isinstance(v, (str, list)) and not v):
        fail(f'{where}: missing {key}')
        return False
    return True


def check_entry(ch, m, e):
    where = f'{mid(ch, m)}'
    pada = e.get('pada')
    if not isinstance(pada, list) or not pada or not all(isinstance(l, list) and l for l in pada):
        fail(f'{where}: pada must be a list of word lists, one per printed line')
        return
    ws = words_of(e)
    for w in ws:
        if not DEV.match(w):
            fail(f'{where}: padaccheda word {w!r} is not plain Devanagari')
    # 1. rejoin the padaccheda into the recited text
    ok, info = rejoin([[dev2iast(w) for w in line] for line in pada], dev2iast(recited(m)))
    if not ok:
        k = info
        near = ' | '.join(ws[max(0, k - 2):k + 2])
        fail(f'{where}: padaccheda does not rejoin into the text (stuck at word {k + 1}: … {near} …)')
    else:
        declared = e.get('sandhi_exceptions', [])
        if len(info) != len(declared):
            spots = ', '.join(f'{ws[k - 1]} | {ws[k]}' for k in info)
            fail(f'{where}: {len(info)} unjoined vowel hiatus ({spots}) but {len(declared)} declared in sandhi_exceptions')
        for x in declared:
            if not x.get('reason'):
                fail(f'{where}: sandhi exception without a reason')
    # 2. word table = padaccheda, in order
    table = e.get('words', [])
    if [t.get('w') for t in table] != ws:
        got = [t.get('w') for t in table]
        i = next((i for i, (a, b) in enumerate(zip(got, ws)) if a != b), min(len(got), len(ws)))
        fail(f'{where}: word table differs from padaccheda at word {i + 1} '
             f'(table {got[i] if i < len(got) else "—"!r}, padaccheda {ws[i] if i < len(ws) else "—"!r})')
    for t in table:
        if not t.get('en') or not t.get('g'):
            fail(f"{where}: word {t.get('w')!r} needs both a meaning (en) and a grammatical identification (g)")
    # 3. sandhi examples occur in the verse; compounds and forms are words of the verse
    text_n = norm(dev2iast(recited(m)))
    for s in e.get('sandhi', []):
        jn = norm(dev2iast(s.get('joined') or ''))
        if jn and jn[-1] in 'ṅñṇnm' and jn[:-1] + 'ṃ' in text_n:
            jn = jn[:-1] + 'ṃ'   # a final nasal the verse writes as anusvāra before the next word
        if not s.get('joined') or jn not in text_n:
            fail(f"{where}: sandhi example {s.get('joined')!r} is not in the verse")
        for k in ('split', 'type', 'rule', 'note'):
            if not s.get(k):
                fail(f"{where}: sandhi {s.get('joined')!r} missing {k}")
    joined_words = ' '.join(ws)
    for s in e.get('samasa', []):
        if not s.get('c') or s['c'] not in joined_words:
            fail(f"{where}: compound {s.get('c')!r} is not a word of the padaccheda")
        for k in ('members', 'vigraha', 'type', 'literal', 'sense'):
            if not s.get(k):
                fail(f"{where}: compound {s.get('c')!r} missing {k}")
    for f in e.get('morph', []):
        if not f.get('form') or f['form'] not in joined_words:
            fail(f"{where}: analysed form {f.get('form')!r} is not a word of the padaccheda")
        if not f.get('note'):
            fail(f"{where}: analysed form {f.get('form')!r} has no note")
    # 4. the rest of the seven sections
    for k in ('anvaya', 'lit', 'tr'):
        need(e, k, where)
    if e.get('anvaya') and not re.search(r'[ऀ-ॿ]', e['anvaya']):
        fail(f'{where}: anvaya must be Sanskrit (Devanagari)')
    comm = e.get('comm', [])
    if not comm:
        fail(f'{where}: no commentary')
    for c in comm:
        if c.get('k') not in LABELS:
            fail(f"{where}: commentary label {c.get('k')!r} must be one of {sorted(LABELS)}")
        if not c.get('t'):
            fail(f'{where}: empty commentary')
    if comm and comm[0].get('k') != 'direct':
        fail(f'{where}: commentary must open with the direct textual meaning')


def check_chapter(T, ch, A):
    c = T['chapters'][ch - 1]
    if A.get('chapter') != ch:
        fail(f'analysis/{ch:02d}.json: chapter field is {A.get("chapter")}')
    entries = A.get('mantras', [])
    ids = [e.get('id') for e in entries]
    want = [mid(ch, m) for m in c['mantras']]
    if ids != want:
        missing = [w for w in want if w not in ids]
        extra = [i for i in ids if i not in want]
        fail(f'chapter {ch}: analysis ids differ from the text — missing {missing[:8]}, unexpected {extra[:8]}'
             + ('' if missing or extra else ' (order)'))
    by = {e.get('id'): e for e in entries}
    for m in c['mantras']:
        e = by.get(mid(ch, m))
        if e:
            check_entry(ch, m, e)
    intro = A.get('intro', {})
    for k in ('summary', 'forms', 'significance', 'grammar', 'teaching'):
        need(intro, k, f'chapter {ch} intro')
    concl = A.get('conclusion', {})
    for k in ('narrative', 'vocabulary', 'constructions', 'insights', 'key_verses'):
        need(concl, k, f'chapter {ch} conclusion')
    for kv in concl.get('key_verses', []):
        if kv.get('id') not in want:
            fail(f"chapter {ch}: key verse {kv.get('id')!r} is not a mantra id")
    rep = A.get('report', {})
    for k in ('sandhi_patterns', 'samasa', 'grammar_notes', 'themes', 'status'):
        need(rep, k, f'chapter {ch} report')
    if rep.get('status') not in ('Complete', 'Complete with Noted Variants', 'Requires Verification'):
        fail(f'chapter {ch}: report status must be Complete / Complete with Noted Variants / Requires Verification')


def check_part(T, path):
    """A batch in progress: only its entries, against the text."""
    A = load(path)
    ch = A.get('chapter')
    c = T['chapters'][ch - 1]
    want = {mid(ch, m): m for m in c['mantras']}
    ids = [e.get('id') for e in A.get('mantras', [])]
    order = [i for i in want if i in ids]
    if ids != order:
        fail(f'{os.path.basename(path)}: ids not in text order or unknown: {[i for i in ids if i not in want][:8]}')
    for e in A.get('mantras', []):
        if e.get('id') in want:
            check_entry(ch, want[e['id']], e)
    return len(ids)


def main(argv):
    only = None
    if '--part' in argv:
        T = load(os.path.join(ED, 'text.json'))
        LOG = load(os.path.join(ED, 'corrections.json'))
        check_text(T, LOG)
        n = check_part(T, argv[argv.index('--part') + 1])
        for p in problems[:200]:
            print('FAIL', p)
        print(f'{len(problems)} problem(s) in {n} entries' if problems else f'ok — {n} entries proven')
        return 1 if problems else 0
    if '--chapter' in argv:
        only = int(argv[argv.index('--chapter') + 1])
    T = load(os.path.join(ED, 'text.json'))
    LOG = load(os.path.join(ED, 'corrections.json'))
    check_text(T, LOG)
    done, pending = [], []
    for ch in range(1, 14):
        if only and ch != only:
            continue
        p = os.path.join(ED, 'analysis', f'{ch:02d}.json')
        if not os.path.exists(p):
            pending.append(ch)
            continue
        check_chapter(T, ch, load(p))
        done.append(ch)
    if '--complete' in argv and pending:
        fail(f'chapters without analysis: {pending}')
    if only and pending:
        fail(f'analysis/{only:02d}.json does not exist')
    if problems:
        for p in problems[:200]:
            print('FAIL', p)
        print(f'{len(problems)} problem(s)')
        return 1
    n = sum(len(T['chapters'][c - 1]['mantras']) for c in done)
    print(f'ok — text: 13 chapters, 700 mantras, counts match every colophon; '
          f'analysis: chapters {done or "none"} ({n} entries) proven'
          + (f'; pending: {pending}' if pending else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
