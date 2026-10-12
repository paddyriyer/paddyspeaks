#!/usr/bin/env python3
"""Assemble a chapter's analysis from its batches.

  python3 scripts/devi_mahatmyam/merge_parts.py 3

reads devi-mahatmyam/edition/analysis/parts/03-*.json (entry batches, any number,
any names) and parts/03-frame.json (intro, conclusion, report), orders the
entries by the text, refuses duplicates, and writes analysis/03.json. Then run
`check.py --chapter 3`. The parts directory is a workspace: once a chapter is
merged and proven its parts are deleted (`--clean`), so analysis/CC.json is the
one source.
"""
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ED = os.path.join(ROOT, 'devi-mahatmyam', 'edition')


def main(argv):
    ch = int(argv[0])
    T = json.load(open(os.path.join(ED, 'text.json'), encoding='utf-8'))
    c = T['chapters'][ch - 1]
    order = [f"{ch}.{m['n']}" + (f"-{m['to']}" if 'to' in m else '') for m in c['mantras']]
    parts = sorted(glob.glob(os.path.join(ED, 'analysis', 'parts', f'{ch:02d}-*.json')))
    frame_path = os.path.join(ED, 'analysis', 'parts', f'{ch:02d}-frame.json')
    out_path = os.path.join(ED, 'analysis', f'{ch:02d}.json')
    existing = json.load(open(out_path, encoding='utf-8')) if os.path.exists(out_path) else {}
    entries = {e['id']: e for e in existing.get('mantras', [])}
    seen_now = set()
    for p in parts:
        if p == frame_path:
            continue
        A = json.load(open(p, encoding='utf-8'))
        for e in A['mantras']:
            if e['id'] in seen_now:
                sys.exit(f"{e['id']} appears in two batches ({os.path.basename(p)})")
            seen_now.add(e['id'])
            entries[e['id']] = e
    unknown = [i for i in entries if i not in order]
    if unknown:
        sys.exit(f'ids not in the text: {unknown}')
    frame = json.load(open(frame_path, encoding='utf-8')) if os.path.exists(frame_path) else {}
    doc = {'chapter': ch}
    for k in ('intro', 'conclusion', 'report'):
        doc[k] = frame.get(k, existing.get(k, {}))
    doc['mantras'] = [entries[i] for i in order if i in entries]
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'analysis/{ch:02d}.json: {len(doc["mantras"])}/{len(order)} entries'
          + ('' if frame else ' (no frame yet)'))
    if '--clean' in argv:
        for p in parts:
            os.remove(p)


if __name__ == '__main__':
    main(sys.argv[1:])
