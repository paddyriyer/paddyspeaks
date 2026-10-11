"""Devanagari -> IAST, stdlib only.

Deterministic and small on purpose: the Lalitā edition uses it to prove that
every IAST string is exactly the transliteration of its Devanagari (hyphens
aside). Verified against indic_transliteration on all 1,000 names.
"""

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
    'ं': 'ṃ', 'ः': 'ḥ', 'ँ': 'm̐', 'ऽ': "'", 'ॐ': 'oṃ', '।': '|', '॥': '||',
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
}
VIRAMA = '्'


def dev2iast(text):
    out = []
    i, n = 0, len(text)
    while i < n:
        ch = text[i]
        if ch in CONS:
            out.append(CONS[ch])
            nxt = text[i + 1] if i + 1 < n else ''
            if nxt == VIRAMA:
                i += 2
                continue
            if nxt in SIGNS:
                out.append(SIGNS[nxt])
                i += 2
                continue
            # inherent a; disambiguate a+i / a+u from the diphthongs
            out.append('a')
            if nxt in ('इ', 'उ'):
                out.append('·')  # never produced by the texts we check
            i += 1
            continue
        if ch in VOWELS:
            out.append(VOWELS[ch])
        elif ch in OTHER:
            out.append(OTHER[ch])
        elif ch in ('‌', '‍'):
            pass
        else:
            out.append(ch)
        i += 1
    return ''.join(out)


def plain(iast):
    """IAST with the edition's reading hyphens removed."""
    return iast.replace('-', '')
