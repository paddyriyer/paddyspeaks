#!/usr/bin/env python3
"""Śrī Rudram study edition — the guardrail (stdlib only).

The text is proven, not trusted. In the brief's numbering:

  1 Completeness   text.json is W1 (the base witness) with exactly the logged
                   corrections, unit for unit; the letter-by-letter collation
                   with W2 yields exactly the differences classified in
                   corrections.json — a new one, or a vanished one, fails.
  2 Reconstruction every anuvāka's padaccheda rejoins by external sandhi
                   (sandhi.py) into its Saṃhitā; undeclared exceptions fail.
  3 Word coverage  every unit's word table lists exactly its padaccheda, in
                   order, each word with a base, a grammatical note and a meaning.
  4 Transliteration every Devanagari string the pages show survives the
                   IAST round trip (the IAST itself is generated, never typed).
  5 Boundaries     22 anuvākas in order; units numbered 1..N; the ṛk counts of
                   Namakam 1, 10, 11 and the yajus counts Sāyaṇa states for
                   Namakam 2–9; the numbers of Chamakam 11 (odd 1–33, then the
                   multiples of four to 48).
  6 Translation    a literal and a readable translation for every unit.
  7 Separation     translations and word meanings are free of the vocabulary of
                   modern esoterica; the traditional note cites Sāyaṇa and every
                   Sanskrit word it quotes occurs in Sāyaṇa's bhāṣya on that
                   anuvāka (or in the mantra); reflections are a separate field.
  (8 Rendering is scripts/rudram/render_test.mjs, run against the built pages.)

  python3 scripts/rudram/check.py                 # text + every analysis present
  python3 scripts/rudram/check.py --anuvaka N3    # one anuvāka (a batch in progress)
  python3 scripts/rudram/check.py --file <json>   # an analysis file not yet in place
  python3 scripts/rudram/check.py --file <json> --partial   # the first k units only
  python3 scripts/rudram/check.py --complete      # also fail if an analysis is missing
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from sandhi import proves, target_of  # noqa: E402
from translit import dev2iast, roundtrip_ok, strip_accents  # noqa: E402
import collate  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ED = os.path.join(ROOT, 'rudramchamakam', 'edition')
ORDER = [f'N{i}' for i in range(1, 12)] + [f'C{i}' for i in range(1, 12)]
SAYANA_YAJUS = {'N2': 13, 'N3': 17, 'N4': 17, 'N5': 15, 'N6': 15, 'N7': 16, 'N8': 17, 'N9': 19}
RK_UNITS = {'N1': 15, 'N10': 12, 'N11': 11}
C11_NUMBERS = ['एका', 'तिस्रः', 'पञ्च', 'सप्त', 'नव', 'एकादश', 'त्रयोदश', 'पञ्चदश', 'सप्तदश',
               'नवदश', 'एकविंशतिः', 'त्रयोविंशतिः', 'पञ्चविंशतिः', 'सप्तविंशतिः', 'नवविंशतिः',
               'एकत्रिंशत्', 'त्रयस्त्रिंशत्',
               'चतस्रः', 'अष्टौ', 'द्वादश', 'षोडश', 'विंशतिः', 'चतुर्विंशतिः', 'अष्टाविंशतिः',
               'द्वात्रिंशत्', 'षट्त्रिंशत्', 'चत्वारिंशत्', 'चतुश्चत्वारिंशत्', 'अष्टाचत्वारिंशत्']
SAMASA = ('tatpuruṣa', 'karmadhāraya', 'bahuvrīhi', 'dvandva', 'dvigu', 'avyayībhāva',
          'upapada', 'prādi', 'nañ', 'aluk')
EXC_KINDS = {'pragṛhya', 'vedic-lengthening', 'prakṛtibhāva', 'recitational-doubling',
             'vedic-sandhi', 'pause'}
BANNED = re.compile(r'\b(energ(y|ies|etic)|chakras?|cosmic|vibrations?|vibrational|kundalini|quantum|'
                    r'frequenc(y|ies)|subconscious|aura|manifesting|universe within)\b', re.I)
DEV_WORD = re.compile(r'^[ऀ-ॿᳵᳶ]+$')
DEV_RUN = re.compile(r'[ऀ-ॣ०-ॿᳵᳶ॒॑]+(?:[ ‌][ऀ-ॣ०-ॿᳵᳶ॒॑]+)*')

problems = []
notes = []


def fail(msg):
    problems.append(msg)


def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def squash(s):
    """Accent-, space- and punctuation-free Devanagari, for 'occurs in' tests."""
    s = strip_accents(s)
    s = re.sub(r'\[\d+\]', '', s)
    return re.sub(r'[\s।॥ऽ\-–—,.;:()"“”‘’\'«»?!*]', '', s)


# ---------------------------------------------------------------- the text
def check_text(T, W1, C):
    ids = [a['id'] for a in T['anuvakas']]
    if ids != ORDER:
        fail(f'text.json: anuvākas out of order or missing: {ids}')
    corr = {}
    for c in C['corrections']:
        corr.setdefault(c['at'], []).append(c)
    for a in T['anuvakas']:
        units = a['units']
        if [u['n'] for u in units] != list(range(1, len(units) + 1)):
            fail(f"{a['id']}: units not numbered 1..{len(units)}")
        # the witness, with exactly the logged corrections
        witness_units = []
        for u in units:
            s = u['samhita']
            for c in corr.get(f"{a['id']}.{u['n']}", []):
                if c['to'] not in s:
                    fail(f"{a['id']}.{u['n']}: correction {c['id']} is not in the text")
                s = s.replace(c['to'], c['from'])
            witness_units.append(s)
        joined = re.sub(r'\s+', ' ', ' '.join(witness_units)).strip()
        if joined != re.sub(r'\s+', ' ', W1[a['id']]).strip():
            fail(f"{a['id']}: text.json differs from W1 beyond the logged corrections")
        # boundaries
        if a['id'] in SAYANA_YAJUS and len(units) != SAYANA_YAJUS[a['id']]:
            fail(f"{a['id']}: {len(units)} yajus, Sāyaṇa counts {SAYANA_YAJUS[a['id']]}")
        if a['id'] in RK_UNITS and len(units) != RK_UNITS[a['id']]:
            fail(f"{a['id']}: {len(units)} units, expected {RK_UNITS[a['id']]}")
        if not units[-1]['samhita'].rstrip().rstrip(']').rstrip('0123456789').rstrip('[ ').endswith('॥'):
            fail(f"{a['id']}: the last unit does not close the anuvāka (॥)")
        for u in units:
            if not roundtrip_ok(re.sub(r'\[\d+\]', '', u['samhita'])):
                fail(f"{a['id']}.{u['n']}: Saṃhitā does not survive the IAST round trip")


def check_collation(C):
    live = collate.collate()
    keys = {(v['at'], v['w1'], v['w2']) for v in C['variants']}
    seen = set()
    for d in live:
        k = (d['at'], d['w1'], d['w2'])
        seen.add(k)
        if k not in keys:
            fail(f"collation: unclassified difference at {d['at']}: W1 «{d['w1']}» W2 «{d['w2']}» "
                 f"(…{d['context_w1']}… | …{d['context_w2']}…) — classify it in corrections.json")
    for k in keys - seen:
        fail(f'collation: corrections.json classifies a difference the witnesses no longer show: {k}')
    for v in C['variants']:
        if v.get('class') not in ('orthographic', 'W2 error', 'W1 corrected', 'variant'):
            fail(f"corrections.json: variant at {v['at']} has no valid class")
        if not v.get('note'):
            fail(f"corrections.json: variant at {v['at']} has no evidence note")
    sv, _ = collate.collate_svara()
    notes.append(f'svara: {len(sv)} syllables where W1 and W2 mark the accent differently '
                 f'(flagged on {len({x["at"] for x in sv})} units)')
    return live


# ---------------------------------------------------------------- analysis
def check_analysis(T, key, A, S):
    a = next(x for x in T['anuvakas'] if x['id'] == key)
    if A.get('id') != key:
        fail(f'{key}: analysis id is {A.get("id")!r}')
    for f in ('title', 'summary'):
        if not A.get(f):
            fail(f'{key}: analysis has no {f}')
    if A.get('title') and not (A['title'].get('sa') and A['title'].get('en')):
        fail(f'{key}: title needs sa and en')
    units = A.get('units', [])
    partial = '--partial' in sys.argv
    want = [u['n'] for u in a['units']]
    if partial:
        want = want[:len(units)]
    if [u.get('n') for u in units] != want:
        fail(f'{key}: analysis units {[u.get("n") for u in units]} ≠ text units 1..{len(a["units"])}')
        return
    say = squash(' '.join(b['text'] for b in S.get(key, [])))
    all_words, exceptions, samhita = [], {}, []
    tunits = a['units'][:len(units)]
    for tu, u in zip(tunits, units):
        uid = f"{key}.{u['n']}"
        pc = u.get('padaccheda') or []
        if not pc:
            fail(f'{uid}: no padaccheda')
            continue
        for w in pc:
            if not DEV_WORD.match(w) or re.search('[॒॑ऽ]', w):
                fail(f'{uid}: padaccheda entry {w!r} is not one unaccented Devanagari word')
            elif not roundtrip_ok(w):
                fail(f'{uid}: {w} does not survive the IAST round trip')
        words = u.get('words') or []
        if [x.get('w') for x in words] != pc:
            fail(f'{uid}: word table ≠ padaccheda '
                 f'({len(words)} entries for {len(pc)} words; first difference at '
                 f'{next((i for i, (p, q) in enumerate(zip(pc, [x.get("w") for x in words])) if p != q), min(len(pc), len(words)))})')
        for x in words:
            for f in ('base', 'gram', 'meaning'):
                if not (x.get(f) or '').strip():
                    fail(f"{uid}: word {x.get('w')} has no {f}")
            if BANNED.search(x.get('meaning', '') + ' ' + x.get('context', '')):
                fail(f"{uid}: word {x.get('w')}: esoteric vocabulary in a word meaning")
            if x.get('base') and re.search('[ऀ-ॿ]', x['base']) and not roundtrip_ok(x['base'].replace('√', '')):
                fail(f"{uid}: base {x['base']} does not survive the IAST round trip")
        sam_sq = squash(tu['samhita'])
        for s in u.get('sandhi', []):
            j = squash(s.get('joined', ''))
            if not j or j not in sam_sq:
                fail(f"{uid}: sandhi example «{s.get('joined')}» does not occur in the unit")
            for p in s.get('split', []):
                if p not in pc:
                    fail(f"{uid}: sandhi split form «{p}» is not a word of the padaccheda")
            if not s.get('type') or not s.get('rule'):
                fail(f"{uid}: sandhi «{s.get('joined')}» needs a type and a rule")
        for m in u.get('samasa', []):
            if m.get('word') not in pc:
                fail(f"{uid}: compound «{m.get('word')}» is not a word of the padaccheda")
            if not m.get('members') or not m.get('vigraha') or not m.get('meaning'):
                fail(f"{uid}: compound «{m.get('word')}» needs members, vigraha and meaning")
            if not any(t in (m.get('type') or '') for t in SAMASA):
                fail(f"{uid}: compound «{m.get('word')}» has no recognised samāsa type ({m.get('type')!r})")
        for g in u.get('vyakarana', []):
            if g.get('word') not in pc:
                fail(f"{uid}: grammar note on «{g.get('word')}», not a word of the padaccheda")
            if not g.get('note'):
                fail(f"{uid}: empty grammar note on «{g.get('word')}»")
        tr = u.get('translation') or {}
        for f in ('literal', 'readable'):
            if not (tr.get(f) or '').strip():
                fail(f'{uid}: no {f} translation')
            elif BANNED.search(tr[f]):
                fail(f'{uid}: esoteric vocabulary in the {f} translation')
        trad = u.get('traditional') or ''
        if 'Sāyaṇa' not in trad:
            fail(f'{uid}: the traditional note must cite Sāyaṇa (or say that he passes over the unit)')
        for run in DEV_RUN.findall(trad):
            q = squash(run)
            q = q[:-1] if q.endswith(('ः', 'म्')) and len(q) > 2 else q   # a gloss cited in its pausal form
            if q and q not in say and q not in sam_sq and q not in squash(' '.join(pc)):
                fail(f'{uid}: «{run}» is quoted in the traditional note but is not in Sāyaṇa on {key}')
        if BANNED.search(trad):
            fail(f'{uid}: esoteric vocabulary in the traditional note (keep it for the reflection)')
        for e in u.get('sandhi_exceptions', []):
            if e.get('kind') not in EXC_KINDS:
                fail(f"{uid}: sandhi exception kind {e.get('kind')!r} not one of {sorted(EXC_KINDS)}")
            if not e.get('note'):
                fail(f'{uid}: sandhi exception without a note')
            exceptions[len(all_words) + int(e['after'])] = e
        for fl in u.get('flags', []):
            if fl.get('kind') not in ('uncertain', 'variant', 'svara', 'interpretation'):
                fail(f"{uid}: unknown flag kind {fl.get('kind')!r}")
        all_words += pc
        samhita.append(tu['samhita'])
    if problems:
        return
    ok, best = proves(all_words, ' '.join(samhita), exceptions, open_end=partial and len(units) < len(a['units']))
    if not ok:
        tgt = target_of(' '.join(samhita))
        k = len(best)
        # locate the unit where the rejoining stops matching
        acc, where = 0, a['units'][-1]['n']
        for tu in tunits:
            acc += len(target_of(tu['samhita']))
            if acc >= k:
                where = tu['n']
                break
        fail(f'{key}.{where}: the padaccheda does not rejoin into the Saṃhitā — it agrees up to '
             f'«…{best[-30:]}» and the text continues «{tgt[k - 2:k + 30]}…»')
    else:
        for k in list(exceptions):
            rest = {j: e for j, e in exceptions.items() if j != k}
            if proves(all_words, ' '.join(samhita), rest, open_end=partial and len(units) < len(a['units']))[0]:
                fail(f'{key}: the sandhi exception after word {k} («{all_words[k]}») is not needed — '
                     'the rules already join it; remove it')
    if key == 'C11' and not (partial and len(units) < len(a['units'])):
        nums = [w.replace('ँ', 'ं') for w in all_words if w.replace('ँ', 'ं') in C11_NUMBERS]
        if nums != C11_NUMBERS:
            fail(f'C11: the numbers are not the odd series 1–33 and the multiples of four to 48: {nums}')


def main():
    args = sys.argv[1:]
    T = load(os.path.join(ED, 'text.json'))
    W1 = load(os.path.join(ED, 'witnesses', 'W1-panchati.json'))['anuvakas']
    C = load(os.path.join(ED, 'corrections.json'))
    S = load(os.path.join(ED, 'witnesses', 'sayana.json'))['anuvakas']
    check_text(T, W1, C)
    check_collation(C)
    only = None
    files = {}
    if '--anuvaka' in args:
        only = args[args.index('--anuvaka') + 1]
    if '--file' in args:
        p = args[args.index('--file') + 1]
        A = load(p)
        files[A['id']] = A
        only = A['id']
    adir = os.path.join(ED, 'analysis')
    present = []
    for key in ORDER:
        if only and key != only:
            continue
        if key in files:
            A = files[key]
        else:
            p = os.path.join(adir, f'{key[0]}{int(key[1:]):02d}.json')
            if not os.path.exists(p):
                if '--complete' in args:
                    fail(f'{key}: analysis missing ({os.path.relpath(p, ROOT)})')
                continue
            A = load(p)
        present.append(key)
        check_analysis(T, key, A, S)
    for n in notes:
        print('note:', n)
    if problems:
        for p in problems:
            print('FAIL', p)
        print(f'{len(problems)} problem(s)')
        sys.exit(1)
    nunits = sum(len(a['units']) for a in T['anuvakas'])
    print(f'ok: 22 anuvākas, {nunits} units, text = W1 + {len(C["corrections"])} logged corrections, '
          f'{len(C["variants"])} classified W2 differences; analysis proven for {len(present)} anuvāka(s)'
          + (f' ({", ".join(present)})' if present and len(present) < 22 else ''))


if __name__ == '__main__':
    main()
