#!/usr/bin/env python3
"""Import the Īśāvāsya Upaniṣad witnesses, commentaries and parallel passages.

Re-runnable and auditable: it reads public corpora checked out locally and writes
`upanishads/isha/edition/witnesses/*.json`, the edition's record of what each
witness says. `text.json` (the edited text) is NOT written here; it is
hand-maintained and every difference from the base witness is logged in
`corrections.json` (scripts/upanishads/check.py proves both).

  python3 scripts/upanishads/import_witnesses.py \
      --yajuh /path/vishvAsa/vedAH_yajuH   (branch content) \
      --raw   /path/sanskrit/raw_etexts

Witnesses (docs/UPANISHADS-EDITION.md §Sources):

  G   GRETIL, Īśa-Upaniṣad, Kāṇva recension (Sansknet input; the mūla checked
      against Limaye & Vadekar, Eighteen Principal Upaniṣads vol. 1, Poona 1958),
      mirrored in sanskrit/raw_etexts. BASE TEXT.
  AS  Advaita Sharada (Sringeri), the mūla of Śaṅkara's Īśāvāsya-bhāṣya.
  K   Kāṇva Saṃhitā 40, with svara (vishvAsa/vedAH_yajuH).
  M   Mādhyandina Vājasaneyi Saṃhitā 40, with svara and pada-pāṭha
      (vishvAsa/vedAH_yajuH). Another recension: 17 mantras, another order.
  Mv  The mūla in Madhva's Īśāvāsya-bhāṣya (dvaitavedanta.in, via vishvAsa).
  VD  The mūla in Vedānta Deśika's Īśāvāsya-bhāṣya (via vishvAsa).

Commentaries (the authority for every quotation on the pages):
  Śaṅkara (Advaita Sharada units), Madhva, Vedānta Deśika, Mahīdhara (on VS 40).

Parallel passages: the passages that the analysis cites (refs listed in
`upanishads/isha/edition/parallel-refs.json`) are cut from Advaita Sharada's
mūla files (Gītā, Upaniṣads, Brahmasūtra) and GRETIL's Ṛgveda.
"""
import argparse
import json
import os
import re
import subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ED = os.path.join(ROOT, 'upanishads', 'isha', 'edition')
WIT = os.path.join(ED, 'witnesses')

DEV = '०१२३४५६७८९'


def dnum(s):
    return int(''.join(str(DEV.index(c)) if c in DEV else c for c in s.strip()))


def head(path):
    try:
        return subprocess.check_output(['git', '-C', path, 'rev-parse', 'HEAD'], text=True).strip()
    except Exception:
        return None


def read(path):
    return open(path, encoding='utf-8').read()


def clean_line(s):
    return re.sub(r'\s+', ' ', s.replace('‌', '').replace('‍', '')).strip()


def write(name, obj):
    os.makedirs(WIT, exist_ok=True)
    with open(os.path.join(WIT, name), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('wrote', os.path.relpath(os.path.join(WIT, name), ROOT))


# ------------------------------------------------------------------ G: GRETIL
def gretil(raw):
    rel = 'mixed/gretil_devanAgarI/1_sanskr/1_veda/4_upa/isa-upanisad_isopanisad_or_isavasyopanisad.md'
    lines = read(os.path.join(raw, rel)).split('\n')
    out = {}
    for i, ln in enumerate(lines):
        m = re.search(r'॥\s*इसुप्_([०-९]+)\s*॥', ln)
        if not m:
            continue
        n = dnum(m.group(1))
        verse = [re.sub(r'॥\s*इसुप्_[०-९]+\s*॥', '॥', ln)]
        j = i - 1
        while j >= 0 and lines[j].strip() and lines[j].strip() != 'ॐ':
            verse.insert(0, lines[j])
            j -= 1
        out[str(n)] = [clean_line(v) for v in verse]
    return rel, out


# ------------------------------------------------------- AS: Advaita Sharada
def advaita_sharada(raw):
    rel = 'vedAntam/advaitam/advaita-shAradA/mUla/Isha.md'
    t = read(os.path.join(raw, rel))
    out = {}
    for block in re.split(r'\n\s*\n', t):
        m = re.search(r'॥\s*([०-९]+)\s*॥\s*$', block.strip())
        if m:
            out[str(dnum(m.group(1)))] = [clean_line(x) for x in block.strip().split('\n') if x.strip()]
    return rel, out


# ------------------------------------------------- K: Kāṇva Saṃhitā 40 (svara)
def kanva(yajuh):
    rel = 'vAjasaneyam/kANvam/saMhitA/40.md'
    lines = [ln for ln in read(os.path.join(yajuh, rel)).split('\n') if ln.strip() and not ln.startswith(('+++', 'title', '॥इति', '॥ इति'))]
    out, cur = {}, []
    for ln in lines:
        cur.append(ln)
        m = re.search(r'॥\s*([०-९]+)\s*॥', ln)
        if m:
            n = dnum(m.group(1))
            # drop the trailing running numbers the file appends (॥१॥ १, (१) १८ (२०८६))
            last = re.sub(r'(॥\s*[०-९]+\s*॥)(॥)?.*$', r'\1', cur[-1])
            out[str(n)] = [clean_line(x) for x in cur[:-1] + [last]]
            cur = []
    return rel, out


# --------------------------------------- M: Mādhyandina VS 40 (svara, pada)
def madhyandina(yajuh):
    rel = 'vAjasaneyam/mAdhyandinam/saMhitA/sarva-prastutiH/40.md'
    t = read(os.path.join(yajuh, rel))
    out, pada, mahi = {}, {}, {}
    for sec in re.split(r'\n## ', t)[1:]:
        n = dnum(sec.split(' ', 1)[0])
        m = re.search(r'विश्वास-प्रस्तुतिः[^\n]*</summary>\s*(.*?)</details>', sec, re.S)
        out[str(n)] = [clean_line(m.group(1))]
        p = re.search(r'<summary>पदपाठः[^<]*</summary>\s*(.*?)</details>', sec, re.S)
        if p:
            pada[str(n)] = clean_line(p.group(1))
        h = re.search(r'<summary>महीधरः</summary>\s*(.*?)</details>', sec, re.S)
        if h:
            mahi[str(n)] = clean_line(h.group(1))
    return rel, out, pada, mahi


# ------------------------------------------------------- Mv: Madhva's mūla
def madhva(yajuh):
    base = 'vAjasaneyam/mAdhyandinam/IshAvAsyopaniShat/madhvaH/'
    rel = base + 'sarva-prastutiH/01_mUlam.md'
    t = read(os.path.join(yajuh, rel))
    out, comm = {}, {}
    # verse lines are '## ' headings (some wrapped in *…*); the bhāṣya follows
    blocks = re.split(r'\n(?=## )', t)
    cur, n_last = [], None
    pending = []
    for b in blocks:
        if not b.startswith('## '):
            continue
        first, _, rest = b.partition('\n')
        line = first[3:].strip().strip('*').strip()
        pending.append(line)
        m = re.search(r'॥\s*([०-९]+)\s*॥', line)
        if m and re.search(r'[ा-ॏ]', ''.join(pending)):
            n = dnum(m.group(1))
            out[str(n)] = [clean_line(x) for x in pending]
            comm[str(n)] = clean_line(rest)
            pending = []
        elif not m and rest.strip():
            pending = []  # a heading that is not a verse line
    return rel, out, comm


# --------------------------------------------- VD: Vedānta Deśika's mūla
def desika(yajuh):
    rel = 'vAjasaneyam/mAdhyandinam/IshAvAsyopaniShat/shrI-vaiShNavAH/venkaTanAthaH.md'
    t = read(os.path.join(yajuh, rel))
    blocks = re.findall(r'<details( open)?><summary>(.*?)</summary>(.*?)</details>', t, re.S)
    out, comm, intro = {}, {}, ''
    cur = None
    for openf, summ, body in blocks:
        if summ.strip() == 'मूलम्':
            m = re.search(r'॥\s*([०-९]+)', body)
            cur = str(dnum(m.group(1)))
            out[cur] = [clean_line(x) for x in body.strip().split('\n') if x.strip()]
            comm[cur] = ''
        elif cur is None:
            intro += clean_line(body) + ' '
        else:
            comm[cur] = (comm[cur] + ' ' + clean_line(body)).strip()
    return rel, out, comm, intro.strip()


# ----------------------------------------------------- Śaṅkara's bhāṣya
def shankara(yajuh):
    rel = 'vAjasaneyam/mAdhyandinam/IshAvAsyopaniShat/shAnkarAH/sarva-prastutiH.md'
    t = read(os.path.join(yajuh, rel))
    parts = re.split(r'Source: \[TW\]\(https://advaitasharada\.sringeri\.net/split/isha-bhashya/1/AIS/\?u=(IS_[A-Z0-9_]+)\)', t)
    units = {}
    for i in range(1, len(parts), 2):
        m = re.search(r'<details open><summary>मूलम्</summary>(.*?)</details>', parts[i + 1], re.S)
        units[parts[i]] = clean_line(m.group(1))
    out = {'opening': units.get('IS_C01_I01', ''), 'closing': units.get('IS_C01_I02', ''), 'mantras': {}}
    for n in range(1, 19):
        k = f'IS_C01_V{n:02d}'
        intro = units.get(k + '_I01', '')
        bh = ' '.join(units[x] for x in sorted(units) if x.startswith(k + '_B'))
        # the bhāṣya unit opens with the mantra itself; keep it apart
        m = re.match(r'(.*?॥\s*[०-९]+\s*॥)(.*)$', bh)
        out['mantras'][str(n)] = {'intro': intro, 'mantra': clean_line(m.group(1)) if m else '',
                                  'bhashya': clean_line(m.group(2)) if m else bh,
                                  'units': [x for x in sorted(units) if x.startswith(k)]}
    return rel, out


# ------------------------------------------------------- parallel passages
ROMAN = {}


def sections(text):
    """Split an Advaita Sharada mūla file into {(h1, h2): {n: text}} with the
    heading indices counted in order (h1 == 1 is the work's title). A number
    marker may be broken across lines (॥\n१५ ॥)."""
    h1 = h2 = 0
    chunks = {}
    for ln in text.split('\n'):
        if ln.startswith('# '):
            h1 += 1
            h2 = 0
            continue
        if ln.startswith('## '):
            h2 += 1
            continue
        if ln.startswith('#'):
            continue
        chunks.setdefault((h1, h2), []).append(ln)
    res = {}
    for key, lines in chunks.items():
        body = clean_line(' '.join(lines))
        pos = 0
        for m in re.finditer(r'॥\s*([०-९]+)\s*॥', body):
            res.setdefault(key, {})[dnum(m.group(1))] = clean_line(body[pos:m.start()]) + ' ॥'
            pos = m.end()
    return res


TEXTS = {
    # ref prefix: (file, how the numbers map onto the headings, display name)
    'BG': ('Gita.md', 'h1', 'Bhagavad Gītā'),
    'BU': ('Brha.md', 'h1h2', 'Bṛhadāraṇyaka Upaniṣad'),
    'KaU': ('Kathaka.md', 'h1h2', 'Kaṭha Upaniṣad'),
    'MuU': ('Mundaka.md', 'h1h2', 'Muṇḍaka Upaniṣad'),
    'ChU': ('Chandogya.md', 'h1h2', 'Chāndogya Upaniṣad'),
    'KeU': ('Kena_vakya.md', 'h1', 'Kena Upaniṣad'),
    'TU': ('Taitiriya.md', 'h1h2', 'Taittirīya Upaniṣad'),
    'BS': ('BS.md', 'h1h2', 'Brahmasūtra'),
    'AiU': ('Aitareya.md', 'h1h2', 'Aitareya Upaniṣad'),
    'PrU': ('Prashna.md', 'h1', 'Praśna Upaniṣad'),
}


def parallels(raw, refs):
    base = 'vedAntam/advaitam/advaita-shAradA/mUla/'
    cache = {}
    out = {}
    for ref in refs:
        pre, _, num = ref.partition(' ')
        if pre == 'RV':
            out[ref] = rv(raw, num)
            continue
        if pre == 'KaUBh':
            t = read(os.path.join(raw, 'vedAntam/advaitam/advaita-shAradA/bhAShya/Kathaka.md'))
            i = t.index('अथ काठकोपनिषद्वल्लीनां')
            j = t.index('तच्छब्दत्वोपपत्तेः', i) + len('तच्छब्दत्वोपपत्तेः')
            out[ref] = {'work': 'Śaṅkara, Kaṭhopaniṣad-bhāṣya, introduction', 'text': clean_line(t[i:j]),
                        'source': 'vedAntam/advaitam/advaita-shAradA/bhAShya/Kathaka.md'}
            continue
        if pre == 'GBU':
            out[ref] = gbu(raw, num)
            continue
        if pre == 'GMaU':
            rel = 'mixed/gretil_devanAgarI/1_sanskr/1_veda/4_upa/mandukya-upanisad.md'
            tag = 'मन्दुप्_' + ''.join(DEV[int(c)] for c in num) + ' ॥'
            lines = read(os.path.join(raw, rel)).split('\n')
            i = next(k for k, ln in enumerate(lines) if tag in ln)
            j = i
            while j > 0 and lines[j - 1].strip() and '॥' not in lines[j - 1]:
                j -= 1
            txt = ' '.join(x.strip() for x in lines[j:i + 1])
            out[ref] = {'work': 'Māṇḍūkya Upaniṣad (GRETIL)', 'text': clean_line(re.sub(r'॥\s*मन्दुप्_[^॥]*॥', '॥', txt)), 'source': rel}
            continue
        if pre == 'MuktU':
            rel = 'vedaH/misc/upaniShat/sAmAnyA/muktiko_a.md'
            t = read(os.path.join(raw, rel))
            a_, b_ = num.split('-') if '-' in num else (num, num)
            lines = [ln.strip() for ln in t.split('\n') if re.search(r'[।॥]', ln)]
            body = ' '.join(lines)
            i = body.index('माण्डूक्यमेकमेवालं')
            j = body.index('बृहदारण्यकम् तथा ॥ ३०॥') + len('बृहदारण्यकम् तथा ॥ ३०॥')
            out[ref] = {'work': 'Muktikā Upaniṣad', 'text': clean_line(body[i:j]), 'source': rel,
                        'note': 'sanskrit/raw_etexts vedaH/misc/upaniShat (a sanskritdocuments-style text with a Marathi translation; no printed edition recorded). Verses 1.26–30 only.'}
            continue
        if pre == 'BSBh':
            out[ref] = bsbh(raw, num)
            continue
        fn, mode, name = TEXTS[pre]
        if fn not in cache:
            secs = sections(read(os.path.join(raw, base, fn)))
            # drop the title heading (h1 == 1 holds no verses)
            cache[fn] = secs
        secs = cache[fn]
        parts = [int(x) for x in num.split('.')]
        # the first '#' heading in each file is the work's title: shift h1 by one
        if mode == 'h1':
            key = (parts[0] + 1, 0)
            verse = parts[1]
        else:
            key = (parts[0] + 1, parts[1])
            verse = parts[2]
        if pre == 'BS':
            # Brahmasūtra numbers run within each pāda in this file
            pass
        txt = secs.get(key, {}).get(verse)
        if not txt:
            raise SystemExit(f'parallel {ref}: not found in {fn} at {key} #{verse}')
        out[ref] = {'work': name, 'text': txt, 'source': base + fn}
    return out


def bsbh(raw, num):
    """Śaṅkara's bhāṣya on one sūtra: from the sūtra to the next sūtra's number."""
    rel = 'vedAntam/advaitam/advaita-shAradA/bhAShya/BS.md'
    a, p, n = [int(x) for x in num.split('.')]
    t = read(os.path.join(raw, rel))
    h1 = [m.start() for m in re.finditer(r'^# ', t, re.M)][a]  # [0] is the title
    end1 = ([m.start() for m in re.finditer(r'^# ', t, re.M)] + [len(t)])[a + 1]
    sec = t[h1:end1]
    h2 = [m.start() for m in re.finditer(r'^## ', sec, re.M)] + [len(sec)]
    pada = sec[h2[p - 1]:h2[p]]
    dn = lambda k: ''.join(DEV[int(c)] for c in str(k))
    i = pada.find(f'॥ {dn(n)} ॥')
    j = pada.find(f'॥ {dn(n + 1)} ॥', i + 1)
    if i < 0:
        raise SystemExit(f'BSBh {num}: not found')
    # back up to the start of the sūtra line
    k = pada.rfind('\n', 0, i)
    seg = pada[k + 1: (pada.rfind('\n', 0, j) if j > 0 else len(pada))]
    return {'work': 'Śaṅkara, Brahmasūtra-bhāṣya', 'text': clean_line(re.sub(r'#+ [^\n]*', ' ', seg)), 'source': rel}


def gbu(raw, num):
    """GRETIL's Bṛhadāraṇyaka (Kāṇva; mūla checked against Limaye & Vadekar 1958),
    for passages the Advaita Sharada file lacks (the pūrṇam adaḥ verse of 5.1.1)."""
    rel = 'mixed/gretil_devanAgarI/1_sanskr/1_veda/4_upa/brhadaranyaka-upanisad.md'
    a, b, c = num.split('.')
    d = lambda x: ''.join(DEV[int(ch)] for ch in x)
    tag = f'ब्र्हुप्_{d(a)},{d(b)}।{d(c)}'
    lines = read(os.path.join(raw, rel)).split('\n')
    i = next(k for k, ln in enumerate(lines) if tag + ' ' in ln)
    j = i
    while j > 0 and lines[j - 1].strip():
        j -= 1
    txt = ' '.join(x.strip() for x in lines[j:i + 1])
    return {'work': 'Bṛhadāraṇyaka Upaniṣad (GRETIL)', 'text': clean_line(re.sub(r'॥\s*ब्र्हुप्_[^॥]*॥', '॥', txt)), 'source': rel}


def rv(raw, num):
    """GRETIL's Ṛgveda: each half-verse is tagged र्व्_MM।SSS।VV।h{…}."""
    rel = 'mixed/gretil_devanAgarI/1_sanskr/1_veda/1_sam/1_rv/rgveda_1.md'
    m, s, v = num.split('.')
    d = lambda x, w: ''.join(DEV[int(c)] for c in x.zfill(w))
    tag = f'र्व्_{d(m, 2)}।{d(s, 3)}।{d(v, 2)}।'
    lines = [ln for ln in read(os.path.join(raw, rel)).split('\n') if ln.startswith(tag)]
    if not lines:
        raise SystemExit(f'RV {num}: tag {tag} not found')
    txt = ' '.join(re.sub(r'^र्व्_[^ ]*\s*', '', x).strip() for x in lines)
    return {'work': 'Ṛgveda Saṃhitā', 'text': clean_line(txt) + ' ॥', 'source': rel,
            'note': 'GRETIL’s Devanagari renders the Ṛgveda’s namaüktim (hiatus inside the compound) as नमौक्तिं.'}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--yajuh', required=True)
    ap.add_argument('--raw', required=True)
    ap.add_argument('--ashta', help='checkout of github.com/sanskrit/ashtadhyayi (data/sutrANi.tsv)')
    a = ap.parse_args()
    if a.ashta:
        rows = [ln.split('\t') for ln in read(os.path.join(a.ashta, 'data', 'sutrANi.tsv')).split('\n')[1:] if '\t' in ln]
        out = os.path.join(ROOT, 'upanishads', 'data', 'sutras.json')
        with open(out, 'w', encoding='utf-8') as f:
            json.dump({'$comment': 'The sūtras of Pāṇini’s Aṣṭādhyāyī by number, from github.com/sanskrit/ashtadhyayi data/sutrANi.tsv. check.py requires every “P. a.b.c (sūtra)” citation in the Upaniṣad editions to name a sūtra that exists and to quote it as it reads here.',
                       'repo': 'https://github.com/sanskrit/ashtadhyayi', 'commit': head(a.ashta), 'path': 'data/sutrANi.tsv',
                       'sutras': {k.strip(): v.strip() for k, v in rows}}, f, ensure_ascii=False, indent=0)
            f.write('\n')
        print('wrote', os.path.relpath(out, ROOT))
    hy, hr = head(a.yajuh), head(a.raw)
    Y = {'repo': 'https://github.com/vishvAsa/vedAH_yajuH', 'branch': 'content', 'commit': hy}
    R = {'repo': 'https://github.com/sanskrit/raw_etexts', 'branch': 'master', 'commit': hr}

    rel, g = gretil(a.raw)
    write('G-gretil.json', {'id': 'G', **R, 'path': rel,
        'label': 'GRETIL, Īśa-Upaniṣad, Kāṇva recension with the commentary ascribed to Śaṅkara (Sansknet input; GRETIL version 2018-08-02)',
        'note': 'Base text. GRETIL states that the mūla was checked against V. P. Limaye and R. D. Vadekar, Eighteen Principal Upaniṣads, vol. 1 (Poona, 1958). Word boundaries are irregularly spaced (converted from a custom encoding); spacing is not a reading.',
        'mantras': g})
    rel, s = advaita_sharada(a.raw)
    write('AS-advaita-sharada.json', {'id': 'AS', **R, 'path': rel,
        'label': 'Advaita Sharada (Śṛṅgeri Śāradā Pīṭham), the mūla of Śaṅkara’s Īśāvāsyopaniṣad-bhāṣya, mirrored in sanskrit/raw_etexts',
        'note': 'The text as transmitted with Śaṅkara’s bhāṣya. Prints some junctions in hiatus (भूतानि आत्मनि) as a reading aid.',
        'mantras': s})
    rel, k = kanva(a.yajuh)
    write('K-kanva-samhita.json', {'id': 'K', **Y, 'path': rel,
        'label': 'Kāṇva Saṃhitā (Śukla Yajurveda), adhyāya 40, with svara, vishvAsa/vedAH_yajuH',
        'note': 'The Saṃhitā witness and the only Kāṇva source of the svara. Keyed text, not proof-read; its departures are classified in corrections.json.',
        'mantras': k})
    rel, m, pada, mahi = madhyandina(a.yajuh)
    write('M-madhyandina.json', {'id': 'M', **Y, 'path': rel,
        'label': 'Mādhyandina Vājasaneyi Saṃhitā, adhyāya 40, with svara and pada-pāṭha, vishvAsa/vedAH_yajuH',
        'note': 'The other recension: 17 mantras in another order (VS 40.9–11 = Īśa 12–14, 40.12–14 = Īśa 9–11, 40.15 ≈ Īśa 17, 40.16 = Īśa 18, 40.17 ≈ Īśa 15 + the end of 16).',
        'map': {'1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 12, '10': 13, '11': 14,
                '12': 9, '13': 10, '14': 11, '15': 17, '16': 18, '17': 15},
        'mantras': m, 'pada': pada})
    write('mahidhara.json', {'id': 'Mahidhara', **Y, 'path': rel,
        'label': 'Mahīdhara, Vedadīpa on the Mādhyandina Vājasaneyi Saṃhitā 40',
        'note': 'Keyed by the Mādhyandina (VS 40) numbering; see M-madhyandina.json "map".',
        'mantras': mahi})
    rel, mv, mvc = madhva(a.yajuh)
    write('Mv-madhva.json', {'id': 'Mv', **Y, 'path': rel,
        'label': 'The mūla of Madhva’s Īśāvāsyopaniṣad-bhāṣya (dvaitavedanta.in), vishvAsa/vedAH_yajuH',
        'note': 'The text as Madhva’s tradition reads it.', 'mantras': mv})
    write('madhva.json', {'id': 'Madhva', **Y, 'path': rel,
        'label': 'Madhva (Ānandatīrtha), Īśāvāsyopaniṣad-bhāṣya, dvaitavedanta.in text in vishvAsa/vedAH_yajuH',
        'note': 'Madhva’s commentary on each mantra (it quotes Purāṇic and other authorities by name).', 'mantras': mvc})
    rel, vd, vdc, vdi = desika(a.yajuh)
    write('VD-desika.json', {'id': 'VD', **Y, 'path': rel,
        'label': 'The mūla of Vedānta Deśika’s Īśāvāsyopaniṣad-bhāṣya, vishvAsa/vedAH_yajuH',
        'note': 'The text as the Śrīvaiṣṇava tradition reads it.', 'mantras': vd})
    write('desika.json', {'id': 'Desika', **Y, 'path': rel,
        'label': 'Vedānta Deśika (Veṅkaṭanātha), Īśāvāsyopaniṣad-bhāṣya, vishvAsa/vedAH_yajuH',
        'note': 'The Viśiṣṭādvaita commentary on this Upaniṣad (Rāmānuja wrote none on it).',
        'intro': vdi, 'mantras': vdc})
    rel, sh = shankara(a.yajuh)
    write('shankara.json', {'id': 'Shankara', **Y, 'path': rel,
        'label': 'Śaṅkara, Īśāvāsyopaniṣad-bhāṣya, Advaita Sharada (Śṛṅgeri) text, units IS_C01_*, via vishvAsa/vedAH_yajuH',
        'url': 'https://advaitasharada.sringeri.net/split/isha-bhashya/1/AIS/',
        'note': 'Bhāṣya only (Ānandagiri’s ṭīkā, interleaved in the source, is not imported).', **sh})

    refs = []
    for f in sorted(os.listdir(ED)):
        if f.startswith('parallel-refs') and f.endswith('.json'):
            refs += [r for r in json.load(open(os.path.join(ED, f), encoding='utf-8'))['refs'] if r not in refs]
    write('parallels.json', {'note': 'Passages cited by the analysis, cut from Advaita Sharada mūla files (sanskrit/raw_etexts vedAntam/advaitam/advaita-shAradA/mUla/) and GRETIL’s Ṛgveda. The checker requires every phrase an analysis quotes from a parallel to occur here.',
                             **R, 'passages': parallels(a.raw, refs)})


if __name__ == '__main__':
    main()
