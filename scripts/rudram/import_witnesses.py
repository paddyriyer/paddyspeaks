#!/usr/bin/env python3
"""One-off import: the Taittirīya Saṃhitā witnesses → rudramchamakam/edition/.

Run once (2026-10) against a checkout of github.com/vishvAsa/vedAH_yajuH
(branch `content`). It is kept so the import can be repeated and audited; the
files it writes are the edition's record of what the witnesses say. After the
import `text.json` is hand-maintained and every change to it is logged in
`corrections.json`; do not re-run this over an edited text.json without
`--witnesses-only`.

  python3 scripts/rudram/import_witnesses.py --src /path/to/vedAH_yajuH
  python3 scripts/rudram/import_witnesses.py --src … --witnesses-only

Witnesses (all in the vishvAsa corpus, which records its own sources):

  W1  saMhitA/mUlam/panchAti-kramaH/4/{5,7}.md   the Saṃhitā in its pañcāśat
      (50-word) divisions, South Indian Taittirīya orthography, svara marked —
      keyed from TITUS and Parankuśācārya's edition (mUlam/_index.md). BASE TEXT.
  W2  saMhitA/mUlam/vAkya-kramaH/4/{5,7}.md      the same Saṃhitā sentence by
      sentence in Weber's orthography (visarga kept, anusvāra ं, words spaced at
      sandhi) — an independently keyed transcription. CROSS-CHECK.
  S   saMhitA/sarva-prastutiH/4/{5_…,7}/NN.md    Sāyaṇa's bhāṣya (and his
      viniyoga from the Kalpa) in the order of the mantras. COMMENTARY.

Unit boundaries are not in the witnesses' line breaks; they are set by rule
here and documented in text.json: Sāyaṇa's ṛk division (Namakam 1, 10, 11), one
yajus per namaskāra (Namakam 2–9, checked against the yajus counts Sāyaṇa
states), and the editor's sense-groups for the Chamakam, which Sāyaṇa treats as
one continuous mantra of eleven anuvākas.
"""
import argparse
import json
import os
import re
import subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ED = os.path.join(ROOT, 'rudramchamakam', 'edition')
SAM = 'taittirIyam/sArasvata-vibhAgaH/saMhitA/'
ACC = '॒॑'

# ---------------------------------------------------------------- unit rules
# Namakam 1: Sāyaṇa's fifteen ṛks — the half-line (।) count of each verse.
N1_VERSES = [2, 2, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 2, 2]
# Namakam 10: twelve ṛks of two half-lines each.
N10_VERSES = [2] * 12
# Namakam 11: ṛk 1 and ṛk 10 carry the refrain; ṛks 2–9 receive it by anuṣaṅga
# (Sāyaṇa) and are one half-line each in the Saṃhitā; then the closing yajus.
N11_VERSES = [2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1]
# Sāyaṇa's stated yajus count for each namaskāra anuvāka.
SAYANA_YAJUS = {'N2': 13, 'N3': 17, 'N4': 17, 'N5': 15, 'N6': 15,
                'N7': 16, 'N8': 17, 'N9': 19}
# Chamakam sense-groups: the (accent-free) word that opens each group.
C_GROUPS = {
    'C1': ['अग्नाविष्णू', 'वाजश्च', 'ज्योतिश्च', 'चित्तञ्च', 'दक्षश्च', 'आत्मा'],
    'C2': ['ज्यैष्ठ्यञ्च', 'जेमा', 'सत्यञ्च', 'जातञ्च', 'सुगञ्च'],
    'C3': ['शञ्च', 'भद्रञ्च', 'यन्ता', 'सव्ँविच्च', 'ऋतञ्च', 'सुगञ्च'],
    'C4': ['ऊर्क्च', 'सग्धिश्च', 'रयिश्च', 'पूर्णञ्च', 'व्रीहयश्च', 'गोधूमाश्च'],
    'C5': ['अश्मा', 'हिरण्यञ्च', 'आपश्च', 'ग्राम्याश्च', 'वित्तञ्च', 'कर्म'],
    'C6': ['अग्निश्च', 'पूषा', 'त्वष्टा', 'मरुतश्च', 'द्यौश्च'],
    'C7': ['अँशुश्च', 'ऐन्द्रवायवश्च', 'आग्रयणश्च', 'ऐन्द्राग्नश्च', 'सारस्वतश्च'],
    'C8': ['इध्मश्च', 'ग्रावाणश्च', 'पूतभृच्च', 'पुरोडाशाश्च'],
    'C9': ['अग्निश्च', 'पृथिवी', 'दीक्षा'],
    'C10': ['गर्भाश्च', 'पञ्चाविश्च', 'पष्ठवाच्च', 'आयुर्यज्ञेन'],
    'C11': ['एका', 'नवदश', 'चतस्रश्च', 'द्वात्रिँशच्च', 'वाजश्च'],
}


def git_head(src):
    try:
        return subprocess.check_output(['git', '-C', src, 'rev-parse', 'HEAD'], text=True).strip()
    except Exception:
        return None


def body(path):
    t = open(path, encoding='utf-8').read()
    return t.split('+++', 2)[2] if t.startswith('+++') else t


def plain(s):
    return re.sub('[' + ACC + '‌‍]', '', s)


def w1_anuvakas(path):
    """The prapāṭhaka in anuvākas: each ends with ॥ [N]."""
    t = re.sub(r'\s+', ' ', body(path)).strip()
    out, cur = [], ''
    for part in re.split(r'(॥\s*\[\d+\])', t):
        cur += part
        if part.startswith('॥'):
            out.append(cur.strip())
            cur = ''
    return out


def tokens(text):
    """Words of the Saṃhitā; a pañcāśat marker [N] rides on the word before it."""
    toks = []
    for t in text.split(' '):
        if re.fullmatch(r'\[\d+\]', t) and toks:
            toks[-1] += ' ' + t
        elif t:
            toks.append(t)
    return toks


def split_halflines(text, groups):
    """Split at dandas into half-lines and gather them into verses."""
    pieces = [p.strip() for p in re.findall(r'[^।॥]+(?:[।॥](?:\s*\[\d+\])?)?', text) if p.strip()]
    units, i = [], 0
    for g in groups:
        units.append(' '.join(pieces[i:i + g]))
        i += g
    if i != len(pieces):
        raise SystemExit(f'half-line count {len(pieces)} != {i} for groups {groups}')
    return units


def split_namaskara(text, ubhayato):
    """One yajus per namaskāra. In the ubhayato-namaskāra anuvākas (2–4) a yajus
    ends with its own closing namaḥ, so a new one opens on the second of two
    namaḥ forms in a row; in 5–9 every namaḥ opens a yajus."""
    toks = tokens(text)
    is_nam = [plain(t).startswith('नम') for t in toks]
    units, cur = [], []
    for k, t in enumerate(toks):
        starts = is_nam[k] and k > 0 and (is_nam[k - 1] if ubhayato else True)
        if starts and cur:
            units.append(' '.join(cur))
            cur = []
        cur.append(t)
    units.append(' '.join(cur))
    return units


def split_groups(text, starts):
    toks = tokens(text)
    flat = [plain(t) for t in toks]
    idx, k = [], 0
    for s in starts:
        if ' ' in s:              # the group opens on the word after a lone मे
            first, second = s.split(' ')
            while not (flat[k].startswith(first) and k + 1 < len(flat) and flat[k + 1].startswith(second)):
                k += 1
            k += 1
        else:
            while not flat[k].startswith(s):
                k += 1
        idx.append(k)
        k += 1
    idx.append(len(toks))
    return [' '.join(toks[idx[j]:idx[j + 1]]) for j in range(len(starts))]


def units_for(key, text):
    if key == 'N1':
        return split_halflines(text, N1_VERSES), 'ṛk', "Sāyaṇa's division of the anuvāka into fifteen ṛks."
    if key == 'N10':
        return split_halflines(text, N10_VERSES), 'ṛk', "Sāyaṇa's division into twelve ṛks."
    if key == 'N11':
        return (split_halflines(text, N11_VERSES), 'ṛk',
                "Sāyaṇa's ten ṛks (the refrain of ṛk 1 is supplied to ṛks 2–9 by anuṣaṅga) and the closing yajus.")
    if key in SAYANA_YAJUS:
        n = int(key[1:])
        u = split_namaskara(text, ubhayato=n <= 4)
        return u, 'yajus', f"One yajus per namaskāra; Sāyaṇa counts {SAYANA_YAJUS[key]} in this anuvāka."
    return (split_groups(text, C_GROUPS[key]), 'group',
            "Editorial sense-groups for study. The Saṃhitā is continuous: Sāyaṇa reads the eleven "
            "anuvākas as one mantra, recited without a break.")


def sayana_blocks(path):
    """Sāyaṇa's viniyoga and bhāṣya in the order of the file. Most files keep
    every block inside <details>; anuvāka 8 sets its bhāṣya after the mantra as
    plain paragraphs (unaccented prose), which are taken too."""
    t = body(path)
    out = []
    pos = 0
    for m in re.finditer(r'<details[^>]*>\s*<summary>(.*?)</summary>(.*?)</details>', t, re.S):
        out += loose_prose(t[pos:m.start()])
        pos = m.end()
        s = m.group(1).strip()
        if s in ('सायण-टीका', 'सायणोक्त-विनियोगः'):
            out.append({'kind': 'viniyoga' if 'विनियोग' in s else 'bhashya', 'text': clean_sa(m.group(2))})
    out += loose_prose(t[pos:])
    return out


def loose_prose(chunk):
    """Paragraphs of commentary standing outside <details>: long, Devanagari,
    and without svara marks (a mantra line always carries them)."""
    out = []
    for p in re.split(r'\n\s*\n', chunk):
        p = p.strip()
        if len(p) > 80 and '<' not in p and re.search('[\u0900-\u097F]', p) and not re.search('[' + ACC + ']', p):
            out.append({'kind': 'bhashya', 'text': clean_sa(p)})
    return out


def clean_sa(s):
    s = s.replace('**', '')
    s = re.sub(r'\+\+\+\((.*?)\)\+\+\+', r'(\1)', s)
    s = re.sub(r'[ \t]+\n', '\n', s)
    s = re.sub(r'\n{2,}', '\n', s)
    return s.strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True)
    ap.add_argument('--witnesses-only', action='store_true')
    a = ap.parse_args()
    src = a.src
    head = git_head(src)
    os.makedirs(os.path.join(ED, 'witnesses'), exist_ok=True)

    w1 = {}
    for pr, prefix, n in (('5', 'N', 11), ('7', 'C', 11)):
        an = w1_anuvakas(os.path.join(src, SAM, f'mUlam/panchAti-kramaH/4/{pr}.md'))
        for i in range(n):
            w1[f'{prefix}{i + 1}'] = an[i]
    w2 = {}
    for pr, prefix in (('5', 'N'), ('7', 'C')):
        lines = [re.sub(r'\s+', ' ', l).strip() for l in body(os.path.join(src, SAM, f'mUlam/vAkya-kramaH/4/{pr}.md')).split('\n')]
        w2[f'4.{pr}'] = [l for l in lines if l]
    meta = {
        'corpus': 'https://github.com/vishvAsa/vedAH_yajuH (branch content)',
        'commit': head,
        'imported': '2026-10-13',
    }
    dump('witnesses/W1-panchati.json', {
        **meta, 'witness': 'W1',
        'path': SAM + 'mUlam/panchAti-kramaH/4/{5,7}.md',
        'description': "Taittirīya Saṃhitā 4.5 and 4.7, pañcāśat order, South Indian orthography, svara marked; "
                       "keyed from TITUS and Parankuśācārya's edition (per the corpus's mUlam/_index.md).",
        'anuvakas': w1})
    dump('witnesses/W2-vakya.json', {
        **meta, 'witness': 'W2',
        'path': SAM + 'mUlam/vAkya-kramaH/4/{5,7}.md',
        'description': "Taittirīya Saṃhitā 4.5 and 4.7 sentence by sentence, Weber's orthography (visarga and "
                       "anusvāra written, words spaced at sandhi), svara marked; independently keyed.",
        'prapathakas': w2})

    say = {}
    sp = os.path.join(src, SAM, 'sarva-prastutiH/4')
    files5 = sorted(f for f in os.listdir(os.path.join(sp, '5_rudra-homa-mantrAH')) if re.match(r'\d\d', f))
    files7 = sorted(f for f in os.listdir(os.path.join(sp, '7')) if re.match(r'\d\d', f))
    for i in range(11):
        say[f'N{i + 1}'] = sayana_blocks(os.path.join(sp, '5_rudra-homa-mantrAH', files5[i]))
        say[f'C{i + 1}'] = sayana_blocks(os.path.join(sp, '7', files7[i]))
    dump('witnesses/sayana.json', {
        **meta, 'witness': 'S',
        'path': SAM + 'sarva-prastutiH/4/{5_rudra-homa-mantrAH,7}/NN.md',
        'description': "Sāyaṇa's bhāṣya on TS 4.5 and 4.7.1–11 (with the viniyoga he quotes from the Kalpa), "
                       "in the order of the mantras, as transcribed in the vishvAsa corpus.",
        'anuvakas': say})

    if a.witnesses_only:
        return
    text = {'title': 'Śrī Rudram — Namakam and Chamakam',
            'source': 'Taittirīya Saṃhitā 4.5.1–11 (Namakam) and 4.7.1–11 (Chamakam)',
            'base_witness': 'W1', 'anuvakas': []}
    for key in [f'N{i}' for i in range(1, 12)] + [f'C{i}' for i in range(1, 12)]:
        raw = w1[key]
        units, kind, basis = units_for(key, raw)
        assert ' '.join(units) == ' '.join(tokens(raw)), key
        if key in SAYANA_YAJUS and len(units) != SAYANA_YAJUS[key]:
            print(f'{key}: {len(units)} yajus, Sāyaṇa states {SAYANA_YAJUS[key]}')
        part = 'namakam' if key[0] == 'N' else 'chamakam'
        n = int(key[1:])
        text['anuvakas'].append({
            'id': key, 'part': part, 'n': n,
            'ts': f"4.{5 if part == 'namakam' else 7}.{n}",
            'unit_kind': kind, 'unit_basis': basis,
            'units': [{'n': j + 1, 'samhita': u} for j, u in enumerate(units)],
        })
    apply_corrections(text)
    dump('text.json', text)
    print('units:', {a['id']: len(a['units']) for a in text['anuvakas']})


def apply_corrections(text):
    """Apply corrections.json to the units (each `from` must occur exactly once)."""
    p = os.path.join(ED, 'corrections.json')
    if not os.path.exists(p):
        return
    for c in json.load(open(p, encoding='utf-8'))['corrections']:
        aid, un = c['at'].split('.')
        a = next(x for x in text['anuvakas'] if x['id'] == aid)
        u = a['units'][int(un) - 1]
        if u['samhita'].count(c['from']) != 1:
            raise SystemExit(f"correction {c['id']}: «{c['from']}» not found once in {c['at']}")
        u['samhita'] = u['samhita'].replace(c['from'], c['to'])


def dump(rel, obj):
    p = os.path.join(ED, rel)
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
