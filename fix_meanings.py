#!/usr/bin/env python3
"""Fill in all empty meanings in lalitha-sahasranama/words.js"""

import re

# Comprehensive Sanskrit morpheme dictionary
DICT = {
    # Common suffixes/endings
    "maṇḍalā": "circle/sphere",
    "guṇā": "quality/attribute",
    "mudrā": "seal/gesture",
    "vallabhā": "beloved",
    "saṃsthā": "dwelling/situated in",
    "gā": "going/dwelling",
    "sundarī": "beautiful woman",

    # Body/form related
    "pāśāḍhyā": "rich with noose",
    "rūpekṣu": "form of sugarcane",
    "nijāruṇa": "own redness",
    "prabhāpūra": "flood of radiance",
    "campakāśoka": "campaka and ashoka flowers",
    "kalaṅkābha": "resembling a spot/mark",
    "mīnābha": "fish-like",
    "puṣpābha": "flower-like",
    "tārākānti": "star-like luster",
    "klṛpta": "fashioned/arranged",
    "tapanoḍupa": "sun and moon",
    "śilādarśa": "mirror-like stone",
    "vidyāṅkurākāra": "shaped like a sprout of knowledge",
    "dvayojjvalā": "shining pair",
    "majjat": "immersing",
    "kanakāṅgada": "golden armlet",
    "phalānvitā": "bearing fruit/endowed with",
    "valitrayā": "three folds (of the waist)",
    "aruṇāruṇa": "deeply red",
    "mārdavoru": "soft-thighed",
    "dvayānvitā": "having a pair",
    "makuṭākāra": "crown-shaped",
    "tūṇābha": "quiver-like",
    "prapadānvitā": "having toes/forefoot",
    "saroruhā": "lotus",
    "sarvābharaṇa": "all ornaments",
    "kāmeśvarāṅka": "lap of Lord Kameshvara",
    "svādhīna": "self-dependent/sovereign",
    "sumeru": "Mount Meru (divine mountain)",
    "śṛṅga": "peak/summit",
    "nagara": "city",
    "cintāmaṇi": "wish-fulfilling gem",
    "gṛhāntasthā": "dwelling within the house",
    "brahmāsana": "seat of Brahma",
    "padmāṭavī": "lotus forest",

    # Deity/spiritual terms
    "śaktaikya": "unity of Shakti",
    "yoni": "source/origin",
    "koṇa": "angle/corner",
    "khaṇḍeśī": "ruler of the section",
    "cāritrā": "character/conduct",
    "adbhuta": "wonderful/marvelous",
    "vāñchitārtha": "desired object",
    "abhyāsātiśaya": "excellence of practice",
    "jñātā": "known/knower",
    "ṣaḍadhvātīta": "beyond the six paths",
    "avyāja": "sincere/without pretense",
    "ajñāna": "ignorance",
    "dhvānta": "darkness",
    "dīpikā": "lamp/light",
    "ābāla": "from a child",
    "viditā": "known",
    "sarvānullaṅghya": "whose commands none can transgress",
    "śāsanā": "command/rule",
    "jñeya": "knowable",

    # More compound parts
    "śuddha": "pure",
    "nija": "own",
    "mahā": "great",
    "sarva": "all",
    "para": "supreme",
    "ati": "beyond/exceedingly",
    "su": "good/beautiful",
    "sat": "true/being",
    "a": "not/without",

    # Additional missing ones - let me parse the file to find all
}

# Read the current file
with open("lalitha-sahasranama/words.js") as f:
    content = f.read()

# Find all empty meanings
empty_pattern = re.compile(r'\["([^"]+)", ""\]')
empty_words = set()
for m in empty_pattern.finditer(content):
    empty_words.add(m.group(1))

print(f"Found {len(empty_words)} unique words with empty meanings:")
for w in sorted(empty_words):
    print(f'    "{w}": "",')
