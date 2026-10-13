"""Devanagari <-> IAST for the Śrī Rudram edition (stdlib only).

The Taittirīya text carries Vedic signs the classical editions do not: the
svara marks (U+0951 svarita, U+0952 anudātta), jihvāmūlīya ᳵ and upadhmānīya ᳶ
(visarga before k/kh and p/ph), and the anunāsika ँ written after a vowel
(हिँसीः) or on a semivowel (सव्ँवृध्वने). IAST never carries accents: the svara
layer exists only in the Devanagari, exactly as the witness prints it.

  ᳵ → ẖ    ᳶ → ḫ    vowel + ँ → m̐    consonant + ् + ँ → consonant + ̐ (v̐ y̐ l̐)

`dev2iast` is deterministic; `iast2dev` inverts it on the edition's own text
(accents and ZWNJ aside), and the checker proves the round trip for every
string the pages show, so an IAST line can never differ from its Devanagari.
"""
import re

CONS = {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ṅ',
    'च': 'c', 'छ': 'ch', 'ज': 'j', 'झ': 'jh', 'ञ': 'ñ',
    'ट': 'ṭ', 'ठ': 'ṭh', 'ड': 'ḍ', 'ढ': 'ḍh', 'ण': 'ṇ',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'ळ': 'ḻ', 'व': 'v',
    'श': 'ś', 'ष': 'ṣ', 'स': 's', 'ह': 'h',
}
VOWELS = {
    'अ': 'a', 'आ': 'ā', 'इ': 'i', 'ई': 'ī', 'उ': 'u', 'ऊ': 'ū',
    'ऋ': 'ṛ', 'ॠ': 'ṝ', 'ऌ': 'ḷ', 'ॡ': 'ḹ', 'ए': 'e', 'ऐ': 'ai',
    'ओ': 'o', 'औ': 'au',
}
SIGNS = {
    'ा': 'ā', 'ि': 'i', 'ी': 'ī', 'ु': 'u', 'ू': 'ū', 'ृ': 'ṛ',
    'ॄ': 'ṝ', 'ॢ': 'ḷ', 'ॣ': 'ḹ', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
}
OTHER = {
    'ं': 'ṃ', 'ः': 'ḥ', 'ᳵ': 'ẖ', 'ᳶ': 'ḫ', 'ऽ': "'", 'ॐ': 'oṃ',
    '।': '|', '॥': '||',
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
}
VIRAMA = '्'
CANDRA = 'ँ'
ACCENTS = '॒॑'
SILENT = '‌‍'
CANDRA_ON_CONS = '̐'          # combining candrabindu: v̐ y̐ l̐


def strip_accents(text):
    return re.sub('[' + ACCENTS + SILENT + ']', '', text)


def dev2iast(text):
    text = strip_accents(text)
    out = []
    i, n = 0, len(text)
    while i < n:
        ch = text[i]
        if ch in CONS:
            out.append(CONS[ch])
            nxt = text[i + 1] if i + 1 < n else ''
            if nxt == VIRAMA:
                i += 2
                if i < n and text[i] == CANDRA:      # व्ँ — nasalised semivowel
                    out.append(CANDRA_ON_CONS)
                    i += 1
                continue
            if nxt in SIGNS:
                out.append(SIGNS[nxt])
                i += 2
                continue
            out.append('a')
            if nxt in ('इ', 'उ'):
                out.append('·')      # a + i / a + u in hiatus, never ai / au
            i += 1
            continue
        if ch in VOWELS:
            out.append(VOWELS[ch])
        elif ch == CANDRA:
            out.append('m̐')
        elif ch in OTHER:
            out.append(OTHER[ch])
        else:
            out.append(ch)
        i += 1
    return ''.join(out)


# ---- the inverse, used only to prove the round trip ----------------------

_V = sorted(VOWELS.items(), key=lambda kv: -len(kv[1]))
_S = {v: k for k, v in SIGNS.items()}
_C = sorted(((v, k) for k, v in CONS.items()), key=lambda kv: -len(kv[0]))
_O = {'ṃ': 'ं', 'ḥ': 'ः', 'ẖ': 'ᳵ', 'ḫ': 'ᳶ', "'": 'ऽ', '|': '।'}


def iast2dev(s):
    out = []
    i, n = 0, len(s)
    prev_cons = False
    while i < n:
        if s.startswith('oṃ', i) and (i == 0 or not s[i - 1].isalpha()) and not prev_cons:
            out.append('ॐ'); i += 2; continue
        if s.startswith('||', i):
            out.append('॥'); i += 2; prev_cons = False; continue
        if s.startswith('m̐', i):
            if prev_cons:
                out.append(VIRAMA)
            out.append(CANDRA); i += 2; prev_cons = False; continue
        if s[i] == '·':
            i += 1; continue
        for lat, dev in _C:
            if s.startswith(lat, i):
                if prev_cons:
                    out.append(VIRAMA)
                out.append(dev)
                i += len(lat)
                prev_cons = True
                if i < n and s[i] == CANDRA_ON_CONS:
                    out.append(VIRAMA + CANDRA); i += 1; prev_cons = False
                break
        else:
            for dev, lat in _V:
                if s.startswith(lat, i):
                    if prev_cons and lat in ('ṛ', 'ṝ') and out[-1] == 'र':
                        out.append(VIRAMA + dev)       # र्ऋ, as the Taittirīya text spells it
                    elif prev_cons:
                        if lat != 'a':
                            out.append(_S[lat])
                    else:
                        out.append(dev)
                    i += len(lat)
                    prev_cons = False
                    break
            else:
                ch = s[i]
                if prev_cons:
                    out.append(VIRAMA)
                    prev_cons = False
                out.append(_O.get(ch, ch))
                i += 1
    if prev_cons:
        out.append(VIRAMA)
    return ''.join(out)


def roundtrip_ok(dev):
    """True when IAST → Devanagari restores the (accent-free) Devanagari."""
    plain = strip_accents(dev)
    return iast2dev(dev2iast(plain)) == plain
