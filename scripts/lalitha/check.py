#!/usr/bin/env python3
"""Guardrail for the Śrī Lalitā Sahasranāma study edition.

    python3 scripts/lalitha/check.py              # text + every analysis batch
    python3 scripts/lalitha/check.py --batch 07   # one batch (used while writing it)

Stdlib only. It fails (exit 1) when:
  * the name sequence is not exactly 1..1000, or a name is missing/duplicated;
  * a name is not found, in order, in the śloka text (cross-śloka displacement);
  * a half-śloka does not scan as 16 syllables (anuṣṭubh) — a missing or extra
    akṣara shows up here;
  * any IAST is not exactly the transliteration of its Devanagari;
  * a recorded correction is not what the text now says;
  * an analysis entry is malformed, disagrees with text.json, or a component's
    IAST does not match its Devanagari.
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from translit import dev2iast, plain  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
ED = ROOT / 'lalitha-sahasranama' / 'edition'
VOWELS = set('aāiīuūṛṝḷḹeo')

errors, warnings = [], []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def syllables(iast):
    t = iast.replace('ai', 'e').replace('au', 'o')
    return sum(1 for ch in t if ch in VOWELS)


def squash(dev):
    return re.sub(r"[\s\-'ऽ।॥]", '', dev)


def check_text(t):
    names = t['names']
    if [n['num'] for n in names] != list(range(1, 1001)):
        err('names are not exactly 1..1000 in order')
    seen = set()
    for n in names:
        if n['dev'] in seen and n['num'] not in (998,):
            warn(f"name {n['num']} {n['dev']} repeats an earlier name")
        seen.add(n['dev'])
        if plain(n['iast']) != dev2iast(n['dev']):
            err(f"name {n['num']}: IAST {n['iast']!r} is not the transliteration of {n['dev']} ({dev2iast(n['dev'])})")
        if re.search(r'[^ऀ-ॿ]', n['dev']):
            err(f"name {n['num']}: stray character in Devanagari {n['dev']!r}")

    verses = t['verses']
    if [v['num'] for v in verses] != list(range(1, 184)):
        err('ślokas are not exactly 1..183')
    listed = []
    for v in verses:
        for h, half in enumerate(v['halves']):
            if re.search(r'[^\u0900-\u097F ]', half['dev']):
                err(f"śloka {v['num']}.{h + 1}: stray character in Devanagari {half['dev']!r}")
            if dev2iast(half['dev']) != half['iast']:
                err(f"śloka {v['num']}.{h + 1}: IAST is not the transliteration of the Devanagari")
            n = syllables(half['iast'])
            if n != 16:
                err(f"śloka {v['num']}.{h + 1}: {n} syllables, anuṣṭubh half needs 16")
            listed += half['names']
        if [x for h in v['halves'] for x in h['names']] != v['names']:
            err(f"śloka {v['num']}: half-line name lists disagree with the śloka's list")
    if listed != list(range(1, 1001)):
        err('the ślokas do not list names 1..1000 exactly once, in order')

    # every name must be found, in order, inside the half-line that claims it
    by_num = {n['num']: n for n in names}
    for v in verses:
        for h, half in enumerate(v['halves']):
            line = squash(half['dev'])
            pos = 0
            for k in half['names']:
                d = squash(by_num[k]['dev'])
                if len(d) <= 2:  # ī (712) fuses with sādhu into sādhvī
                    continue
                core = d[1:-3] if len(d) > 5 else d[1:-1] or d
                j = line.find(core, max(0, pos - 2))
                if j < 0:
                    err(f"śloka {v['num']}.{h + 1}: name {k} {by_num[k]['dev']} is not in the half-line {half['dev']}")
                else:
                    pos = j + len(core)
    for blk in t['nyasa'] + [l for d in t['dhyana'] for l in d['lines']] + t['closing']:
        if dev2iast(blk['dev']) != re.sub(r'-', '', blk['iast']).replace("'", "'"):
            err(f"IAST/Devanagari mismatch in {blk['iast'][:40]!r}")


def check_preliminaries(t):
    """nyāsa and dhyāna reading aids: they must spell the text exactly."""
    path = ED / 'preliminaries.json'
    if not path.exists():
        err('preliminaries.json is missing')
        return
    p = json.loads(path.read_text())
    sq = lambda s: re.sub(r'[\s-]', '', s)
    pairs = [(f'nyāsa {i + 1}', a['iast'], b) for i, (a, b) in enumerate(zip(t['nyasa'], p['nyasa']))]
    for d, pd in zip(t['dhyana'], p['dhyana']):
        pairs += [(f"dhyāna {d['num']}.{j + 1}", a['iast'], b) for j, (a, b) in enumerate(zip(d['lines'], pd['lines']))]
    for where, text, b in pairs:
        for k in ('read', 'learn'):
            if sq(b[k]) != sq(text):
                err(f'{where}: the {k} line does not spell the text')
    for unit in p['nyasa'] + p['dhyana']:
        if not unit.get('translation') or not unit.get('words'):
            err('a nyāsa/dhyāna unit lacks its translation or word table')
        for w in unit.get('words', []):
            if not w.get('iast') or not w.get('meaning'):
                err(f'word entry {w} lacks iast or meaning')


def check_corrections(t):
    path = ED / 'corrections.json'
    if not path.exists():
        return
    log = json.loads(path.read_text())
    by_num = {n['num']: n for n in t['names']}
    for c in log.get('names', []):
        k = c['name']
        if by_num[k]['dev'] != c['corrected_dev']:
            err(f"correction for name {k} says {c['corrected_dev']} but the text has {by_num[k]['dev']}")


REQUIRED = ('num', 'dev', 'iast', 'sandhi', 'samasa', 'components', 'meaning', 'significance')


def check_batch(path, t):
    data = json.loads(path.read_text())
    by_num = {n['num']: n for n in t['names']}
    b = data.get('batch')
    vs = t['verses'][(b - 1) * 10:(b - 1) * 10 + 10]
    want = [k for v in vs for k in v['names']]
    got = [e.get('num') for e in data.get('names', [])]
    if got != want:
        missing = sorted(set(want) - set(got))
        extra = sorted(set(got) - set(want))
        err(f"{path.name}: names {got[:1]}..{got[-1:]} do not match ślokas {vs[0]['num']}-{vs[-1]['num']} "
            f"(missing {missing[:8]}, extra {extra[:8]})")
    for e in data.get('names', []):
        k = e.get('num')
        tag = f"{path.name} name {k}"
        for f in REQUIRED:
            if f not in e:
                err(f"{tag}: missing field {f}")
        if k not in by_num:
            continue
        src = by_num[k]
        if e.get('dev') != src['dev']:
            err(f"{tag}: Devanagari {e.get('dev')} differs from text.json {src['dev']}")
        if plain(e.get('iast', '')) != dev2iast(src['dev']):
            err(f"{tag}: IAST {e.get('iast')} is not the transliteration of {src['dev']}")
        comps = e.get('components') or []
        if not comps:
            err(f"{tag}: no components")
        for c in comps:
            for f in ('dev', 'iast', 'meaning'):
                if not c.get(f):
                    err(f"{tag}: component {c} lacks {f}")
            if c.get('dev') and c.get('iast') and plain(c['iast']) != dev2iast(c['dev']):
                err(f"{tag}: component {c['dev']} ≠ {c['iast']} (would be {dev2iast(c['dev'])})")
        for s in e.get('sandhi') or []:
            for f in ('surface', 'split', 'rule'):
                if not s.get(f):
                    err(f"{tag}: sandhi entry lacks {f}")
        sm = e.get('samasa')
        if sm is not None:
            for f in ('type', 'vigraha', 'explanation'):
                if not sm.get(f):
                    err(f"{tag}: samāsa lacks {f}")
        m = e.get('meaning', '')
        if not m.startswith('She ') and not m.startswith('Who '):
            warn(f"{tag}: meaning does not start 'She …': {m[:50]}")
        if len(e.get('significance', '')) < 20:
            warn(f"{tag}: significance is very short")
    return data


def main(argv):
    t = json.loads((ED / 'text.json').read_text())
    check_text(t)
    check_corrections(t)
    check_preliminaries(t)
    only = None
    if '--batch' in argv:
        only = argv[argv.index('--batch') + 1].zfill(2)
    files = sorted((ED / 'analysis').glob('[0-9][0-9].json'))
    if only:
        files = [f for f in files if f.stem == only]
        if not files:
            err(f'no analysis file {only}.json')
    for f in files:
        try:
            check_batch(f, t)
        except (ValueError, KeyError, TypeError) as ex:
            err(f'{f.name}: unreadable ({ex})')
    if not only and files and len(files) != 19:
        warn(f'{len(files)} of 19 analysis batches present')
    for w in warnings[:60]:
        print('warning:', w)
    if len(warnings) > 60:
        print(f'… {len(warnings) - 60} more warnings')
    for e in errors:
        print('ERROR:', e)
    if errors:
        print(f'{len(errors)} error(s).')
        return 1
    print(f'Lalitā edition OK — 1000 names, 183 ślokas, {len(files)} analysis batch(es).')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
