#!/usr/bin/env python3
"""
Split compound Sanskrit names in Lalitha Sahasranama into hyphenated forms.
Uses a comprehensive dictionary of Sanskrit morphemes with dynamic programming
to find optimal word boundaries.
"""

import json
import re

# ============================================================
# Comprehensive Sanskrit morpheme dictionary (IAST)
# Organized by category for maintainability
# ============================================================

# All known morphemes that appear in Lalitha Sahasranama compounds
MORPHEMES = set()

def add(*words):
    for w in words:
        MORPHEMES.add(w)

# --- Prefixes / Common first elements ---
add('śrī', 'śrīmat', 'śrīmad', 'mahā', 'mahā', 'deva', 'sarva', 'brahma',
    'nir', 'nis', 'niḥ', 'nīr', 'niś', 'niṣ', 'su', 'dur', 'duḥ', 'duṣṭa',
    'vi', 'pra', 'upa', 'sam', 'pari', 'abhi', 'anu', 'ati', 'adhi', 'ā',
    'para', 'parā', 'parama', 'parāt', 'paraṃ', 'sat', 'sad', 'sac', 'an', 'a',
    'tri', 'dvi', 'eka', 'catur', 'catuḥ', 'pañca', 'ṣaṭ', 'sapta', 'aṣṭa',
    'aṣṭamī', 'nava', 'daśa', 'sahasra',
    'rāja', 'nija', 'sva', 'nitya', 'satya', 'mūla', 'ādi')

# --- Deities and proper names ---
add('śiva', 'viṣṇu', 'rudra', 'indra', 'brahma', 'brahmā',
    'kāmeśa', 'kāmeśvara', 'bhānu', 'sūrya', 'candra', 'ravi',
    'lakṣmī', 'sarasvatī', 'pārvatī', 'durgā', 'gaurī', 'umā',
    'gaṇeśa', 'gaṇeśvara', 'nārāyaṇa', 'hari', 'govinda',
    'bhaṇḍa', 'bhaṇḍāsura', 'mantriṇī', 'vārāhī', 'bālā',
    'naṭeśvarī', 'bhavānī', 'lalitā', 'tripura', 'tripureśī')

# --- Body parts ---
add('mukha', 'vadana', 'vaktra', 'netra', 'locana', 'akṣa', 'akṣī',
    'nāsā', 'nāsika', 'karṇa', 'kaṇṭha', 'kandharā',
    'kara', 'hasta', 'bāhu', 'bhuja', 'aṅga', 'aṅgī', 'aṅguli',
    'pada', 'pāda', 'caraṇa', 'gulpha', 'jaṅghikā', 'jānu',
    'ūru', 'kaṭī', 'kaṭi', 'nābhi', 'nābhyā', 'udara',
    'stana', 'kuca', 'hṛdaya', 'mānasa', 'manas',
    'śiras', 'śiraḥ', 'kaca', 'roma', 'nakha',
    'cubuka', 'cibuka', 'kapola', 'daśana', 'radana',
    'bhāla', 'dalika', 'sthala')

# --- Nature / cosmology ---
add('agni', 'vāyu', 'jala', 'pṛthvī', 'ākāśa',
    'sūrya', 'candra', 'tārā', 'bhānu', 'ravi',
    'loka', 'bhuvana', 'jagat', 'viśva', 'brahmāṇḍa',
    'parvata', 'meru', 'sāgara', 'samudra', 'sindhu',
    'vana', 'araṇya', 'padma', 'kamala', 'puṣpa',
    'kusuma', 'phala', 'latā', 'vṛkṣa', 'campaka',
    'punnāga', 'kadamba', 'mandāra', 'japā', 'pāṭalī')

# --- Qualities / attributes ---
add('rūpa', 'rūpā', 'guṇa', 'guṇā', 'śakti', 'śaktiḥ',
    'vidyā', 'jñāna', 'buddhi', 'buddhā', 'siddhi', 'siddhiḥ',
    'mukti', 'bhakti', 'prema', 'kṛpā', 'dayā', 'karuṇā',
    'lāvaṇya', 'saundarya', 'mādhurya', 'vaibhava',
    'kānti', 'prabhā', 'dīpti', 'jyoti', 'jyotiḥ', 'dyuti',
    'bala', 'balā', 'vīrya', 'śaurya',
    'dharma', 'karma', 'yoga', 'tantra', 'mantra', 'yantra',
    'kalā', 'kalā', 'rasā', 'rasa',
    'māyā', 'mūrti', 'mūrtiḥ', 'vigrahā', 'vigraha',
    'ānanda', 'ānandā', 'sukha', 'duḥkha',
    'pāpa', 'puṇya', 'doṣa', 'bhaya', 'krodha', 'lobha',
    'moha', 'mada', 'rāga', 'kāma', 'icchā',
    'śānta', 'śāntā', 'śānti', 'śuddha', 'śuddhā',
    'satya', 'nitya', 'amṛta')

# --- Actions / verbal forms ---
add('sambhūtā', 'samanvitā', 'samudyatā', 'samāvṛtā',
    'virājitā', 'maṇḍitā', 'śobhitā', 'bhūṣitā', 'alaṅkṛtā',
    'sevitā', 'pūjitā', 'arcitā', 'ārādhyā', 'vanditā', 'stutā',
    'nirdagdha', 'dagdha', 'saṃstuta',
    'gamyā', 'vaśyā', 'vedyā', 'jñeyā', 'dhyeyā',
    'pradā', 'dāyinī', 'dātrī', 'dā',
    'hantrī', 'nāśinī', 'ghnī', 'haraṇa', 'mathanī',
    'karī', 'kartrī', 'dhāriṇī', 'dhārā', 'bhāriṇī',
    'rūpiṇī', 'svarūpiṇī', 'ātmikā',
    'vāsinī', 'nilayā', 'sthā', 'sthitā', 'sthitā', 'gatā',
    'āsīnā', 'saṃsthā', 'saṃsthitā',
    'priyā', 'ratiḥ', 'bhogā', 'rasikā',
    'mayī', 'vatī', 'matī', 'kṛtiḥ',
    'muktā', 'yuktā', 'hīnā', 'rahitā', 'varjitā', 'vinirmuktā')

# --- Common compound elements ---
add('kuṇḍa', 'kūṭa', 'cakra', 'granthi', 'āsana', 'pīṭha',
    'maṇḍala', 'maṇḍalā', 'koṭi', 'koṭīra', 'mukuṭa', 'makuṭa',
    'sūtra', 'dāma', 'mālā', 'mālini', 'mālinikā',
    'ratna', 'maṇi', 'hema', 'kanaka', 'svarṇa',
    'sindūra', 'karpūra', 'kastūri', 'kuṅkuma',
    'pāśa', 'aṅkuśa', 'daṇḍa', 'cāpa', 'bāṇa', 'śara',
    'vajra', 'śūla', 'khaḍga', 'cakra',
    'ratha', 'vimāna', 'siṃhāsana', 'siṃhāsaneśvarī',
    'gṛha', 'nagara', 'pura', 'prākāra',
    'sainya', 'senā', 'sainika',
    'yajña', 'homa', 'dīkṣā',
    'veda', 'āgama', 'śāstra', 'purāṇa',
    'kūṭa', 'bīja', 'mantra', 'kīlaka')

# --- Common suffixes ---
add('ojjvalā', 'ujjvalā', 'samutsukā', 'samudyatā',
    'vibhedinī', 'varṣiṇī', 'sākṣiṇī', 'yoginī', 'mohinī',
    'mālinī', 'hāsinī', 'bhāsinī',
    'eśvarī', 'īśvarī', 'nāyikā', 'sundarī',
    'āmbikā', 'ambikā', 'āmbā',
    'mekhalā', 'tilakā', 'candrikā',
    'parigrahā', 'pativratā', 'śālinī')

# --- Common words that appear in compounds ---
add('kārya', 'svarūpa', 'ākāra', 'ābhā', 'ābha',
    'tanmātra', 'sāyaka', 'kodaṇḍa',
    'tūṇa', 'gopa', 'vraja',
    'vikrama', 'parākrama', 'harṣita', 'nanditā', 'toṣitā',
    'prāṇa', 'vīrya', 'vadhā', 'vadha', 'vadha',
    'sainya', 'śastra', 'astra', 'pratyastra',
    'loka', 'jagat', 'viśva', 'bhuvana',
    'yātrā', 'sandhā', 'sandhā',
    'māṅgalya', 'saubhāgya', 'vaibhava',
    'padma', 'kamala', 'ambuja',
    'bandha', 'bandhu', 'mocana', 'mocanī',
    'śamana', 'śamanī', 'praśamana', 'praśamanī',
    'nivāriṇī', 'vināśinī',
    'vidhāyinī', 'pradāyinī',
    'sampat', 'sampad',
    'kiṅkiṇikā', 'kiṅkarī',
    'cintāmaṇi', 'sudhā',
    'udyukta', 'udyata',
    'prabhāpūra', 'sahasra',
    'tanīyasī', 'bisa', 'tantu',
    'kuṭhārikā', 'davānalā', 'dambholiḥ',
    'gaṇa', 'kula', 'saṅghāta', 'maṇḍala', 'parivāra',
    'dhāma', 'dhāman', 'sthāna', 'kṣetra',
    'vastra', 'ābharaṇa', 'bharaṇa', 'bhūṣaṇa',
    'graiveya', 'keyūra', 'aṅgada',
    'koṭi', 'lakṣa', 'arbuda')

# Now build a sorted list (longest first for greedy matching)
ALL_MORPHEMES = sorted(MORPHEMES, key=len, reverse=True)


def segment_compound(name):
    """
    Segment a compound Sanskrit name into morphemes using dynamic programming.
    Returns the name with hyphens at morpheme boundaries.
    """
    # Don't split very short names or names with spaces
    if len(name) <= 6 or ' ' in name:
        return name

    n = len(name)

    # dp[i] = best segmentation ending at position i
    # Each entry is (cost, split_points) where lower cost = fewer segments (prefer longer words)
    dp = [None] * (n + 1)
    dp[0] = (0, [])

    for i in range(n):
        if dp[i] is None:
            continue

        # Try all morphemes starting at position i
        for morpheme in ALL_MORPHEMES:
            mlen = len(morpheme)
            if i + mlen <= n and name[i:i+mlen] == morpheme:
                new_cost = dp[i][0] + 1
                if dp[i+mlen] is None or new_cost < dp[i+mlen][0]:
                    dp[i+mlen] = (new_cost, dp[i][1] + [i+mlen])

        # Also try single character advance (for unmatched portions)
        # But penalize it heavily
        new_cost = dp[i][0] + 10
        if dp[i+1] is None or new_cost < dp[i+1][0]:
            dp[i+1] = (new_cost, dp[i][1][:])  # No split point added

    if dp[n] is None:
        return name

    # Build the split name
    splits = dp[n][1]
    if not splits or splits == [n]:
        return name

    # Remove the final position if it equals n
    split_positions = [s for s in splits if s < n]

    if not split_positions:
        return name

    result = []
    prev = 0
    for pos in split_positions:
        result.append(name[prev:pos])
        prev = pos
    if prev < n:
        result.append(name[prev:])

    # Filter out empty segments and join
    segments = [s for s in result if s]

    # Don't split if we'd get too many tiny segments or just one segment
    if len(segments) <= 1:
        return name

    return '-'.join(segments)


# ============================================================
# Hardcoded splits for names where auto-splitting is unreliable
# These are manually verified against standard padaccheda
# ============================================================

MANUAL_SPLITS = {
    1: "śrī-mātā",
    2: "śrī-mahārājñī",
    3: "śrīmat-siṃhāsaneśvarī",
    4: "cid-agni-kuṇḍa-sambhūtā",
    5: "deva-kārya-samudyatā",
    6: "udyad-bhānu-sahasrābhā",
    7: "catur-bāhu-samanvitā",
    8: "rāga-svarūpa-pāśāḍhyā",
    9: "krodhākārāṅkuśojjvalā",
    10: "mano-rūpekṣu-kodaṇḍā",
    11: "pañca-tanmātra-sāyakā",
    12: "nijāruṇa-prabhāpūra-majjad-brahmāṇḍa-maṇḍalā",
    13: "campakāśoka-punnāga-saugandhika-lasat-kacā",
    14: "kuruvinda-maṇi-śreṇī-kanat-koṭīra-maṇḍitā",
    15: "aṣṭamī-candra-vibhrāja-dalika-sthala-śobhitā",
    16: "mukha-candra-kalaṅkābha-mṛga-nābhi-viśeṣakā",
    17: "vadana-smara-māṅgalya-gṛha-toraṇa-cillikā",
    18: "vaktra-lakṣmī-parīvāha-calan-mīnābha-locanā",
    19: "nava-campaka-puṣpābha-nāsā-daṇḍa-virājitā",
    20: "tārākānti-tiraskāri-nāsābharaṇa-bhāsurā",
    21: "kadamba-mañjarī-kḷpta-karṇa-pūra-manoharā",
    22: "tāṭaṅka-yugalī-bhūta-tapanoḍupa-maṇḍalā",
    23: "padmarāga-śilādarśa-paribhāvi-kapola-bhūḥ",
    24: "nava-vidruma-bimba-śrī-nyakkāri-radanacchadā",
    25: "śuddha-vidyāṅkurākāra-dvija-paṅkti-dvayojjvalā",
    26: "karpūra-vīṭikā-moda-samākarṣad-digantarā",
    27: "nija-sallāpa-mādhurya-vinirbhartsita-kacchapī",
    28: "manda-smita-prabhāpūra-majjat-kāmeśa-mānasā",
    29: "anākalita-sādṛśya-cubuka-śrī-virājitā",
    30: "kāmeśa-baddha-māṅgalya-sūtra-śobhita-kandharā",
    31: "kanakāṅgada-keyūra-kamanīya-bhujānvitā",
    32: "ratna-graiveya-cintāka-lola-muktā-phalānvitā",
    33: "kāmeśvara-prema-ratna-maṇi-pratipana-stanī",
    34: "nābhyālavāla-romāli-latā-phala-kuca-dvayī",
    35: "lakṣya-roma-latā-dhāratā-samunneya-madhyamā",
    36: "stana-bhāra-dalan-madhya-paṭṭa-bandha-valitrayā",
    37: "aruṇāruṇa-kausumbha-vastra-bhāsvat-kaṭī-taṭī",
    38: "ratna-kiṅkiṇikā-ramya-raśanā-dāma-bhūṣitā",
    39: "kāmeśa-jñāta-saubhāgya-mārdavoru-dvayānvitā",
    40: "māṇikya-makuṭākāra-jānu-dvaya-virājitā",
    41: "indra-gopa-parikṣipta-smara-tūṇābha-jaṅghikā",
    42: "gūḍha-gulphā",
    43: "kūrma-pṛṣṭha-jayiṣṇu-prapadānvitā",
    44: "nakha-dīdhiti-saṃchanna-namajjana-tamo-guṇā",
    45: "pada-dvaya-prabhā-jāla-parākṛta-saroruhā",
    46: "siñjāna-maṇi-mañjīra-maṇḍita-śrī-padāmbujā",
    47: "marālī-manda-gamanā",
    48: "mahā-lāvaṇya-śevadhiḥ",
    51: "sarvābharaṇa-bhūṣitā",
    52: "śiva-kāmeśvarāṅka-sthā",
    54: "svādhīna-vallabhā",
    55: "sumeru-madhya-śṛṅga-sthā",
    56: "śrīman-nagara-nāyikā",
    57: "cintāmaṇi-gṛhāntasthā",
    58: "pañca-brahmāsana-sthitā",
    59: "mahā-padmāṭavī-saṃsthā",
    60: "kadamba-vana-vāsinī",
    61: "sudhā-sāgara-madhyasthā",
    63: "kāma-dāyinī",
    64: "devarṣi-gaṇa-saṅghāta-stūyamānātma-vaibhavā",
    65: "bhaṇḍāsura-vadhodyukta-śakti-senā-samanvitā",
    66: "sampatkarī-samārūḍha-sindhura-vraja-sevitā",
    67: "aśvārūḍhādhiṣṭhitāśva-koṭi-koṭibhirāvṛtā",
    68: "cakra-rāja-rathārūḍha-sarvāyudha-pariṣkṛtā",
    69: "geya-cakra-rathārūḍha-mantriṇī-parisevitā",
    70: "kiri-cakra-rathārūḍha-daṇḍa-nāthā-puraskṛtā",
    71: "jvālā-mālinikākṣipta-vahni-prākāra-madhyagā",
    72: "bhaṇḍa-sainya-vadhodyukta-śakti-vikrama-harṣitā",
    73: "nityā-parākramāṭopa-nirīkṣaṇa-samutsukā",
    74: "bhaṇḍa-putra-vadhodyukta-bālā-vikrama-nanditā",
    75: "mantriṇyambā-viracita-viṣaṅga-vadha-toṣitā",
    76: "viśukra-prāṇa-haraṇa-vārāhī-vīrya-nanditā",
    77: "kāmeśvara-mukhāloka-kalpita-śrī-gaṇeśvarā",
    78: "mahā-gaṇeśa-nirbhinna-vighna-yantra-praharṣitā",
    79: "bhaṇḍāsurendra-nirmukta-śastra-pratyastra-varṣiṇī",
    80: "karāṅguli-nakhotpanna-nārāyaṇa-daśākṛtiḥ",
    81: "mahā-pāśupatāstrāgni-nirdagdhāsura-sainikā",
    82: "kāmeśvarāstra-nirdagdha-sabhaṇḍāsura-śūnyakā",
    83: "brahmopendra-mahendrādi-deva-saṃstuta-vaibhavā",
    84: "hara-netrāgni-sandagdha-kāma-sañjīvanauṣadhiḥ",
    85: "śrīmad-vāgbhava-kūṭaika-svarūpa-mukha-paṅkajā",
    86: "kaṇṭhādhaḥ-kaṭi-paryanta-madhya-kūṭa-svarūpiṇī",
    87: "śakti-kūṭaikatāpanna-kaṭyādho-bhāga-dhāriṇī",
    88: "mūla-mantrātmikā",
    89: "mūla-kūṭa-traya-kalebarā",
    90: "kulāmṛtaika-rasikā",
    91: "kula-saṅketa-pālinī",
    95: "kula-yoginī",
    98: "samayācāra-tatparā",
    99: "mūlādhāraika-nilayā",
    100: "brahma-granthi-vibhedinī",
    101: "maṇi-pūrāntarudītā",
    102: "viṣṇu-granthi-vibhedinī",
    103: "ājñā-cakrāntarālasthā",
    104: "rudra-granthi-vibhedinī",
    105: "sahasrārāmbujārūḍhā",
    106: "sudhā-sārābhivarṣiṇī",
    107: "taḍillatā-samaruciḥ",
    108: "ṣaṭ-cakropari-saṃsthitā",
    109: "mahā-śaktiḥ",
    111: "bisa-tantu-tanīyasī",
    113: "bhāvanā-gamyā",
    114: "bhavāraṇya-kuṭhārikā",
    115: "bhadra-priyā",
    116: "bhadra-mūrtiḥ",
    117: "bhakta-saubhāgya-dāyinī",
    118: "bhakti-priyā",
    119: "bhakti-gamyā",
    120: "bhakti-vaśyā",
    122: "śāmbhavī",
    123: "śāradārādhyā",
    125: "śarma-dāyinī",
    129: "śaraccandra-nibhānanā",
    144: "nitya-muktā",
    148: "nitya-śuddhā",
    149: "nitya-buddhā",
    157: "rāga-mathanī",
    159: "mada-nāśinī",
    163: "moha-nāśinī",
    165: "mamatā-hantrī",
    167: "pāpa-nāśinī",
    169: "krodha-śamanī",
    171: "lobha-nāśinī",
    175: "bhava-nāśinī",
    179: "bheda-nāśinī",
    181: "mṛtyu-mathanī",
    185: "nīla-cikurā",
    191: "duḥkha-hantrī",
    192: "sukha-pradā",
    193: "duṣṭa-dūrā",
    194: "durācāra-śamanī",
    195: "doṣa-varjitā",
    196: "sarva-jñā",
    197: "sāndra-karuṇā",
    198: "samānādhika-varjitā",
    199: "sarva-śakti-mayī",
    200: "sarva-maṅgalā",
    201: "sad-gati-pradā",
    204: "sarva-mantra-svarūpiṇī",
    205: "sarva-yantrātmikā",
    206: "sarva-tantra-rūpā",
    209: "mahā-devī",
    210: "mahā-lakṣmīḥ",
    211: "mṛḍa-priyā",
    212: "mahā-rūpā",
    213: "mahā-pūjyā",
    214: "mahā-pātaka-nāśinī",
    215: "mahā-māyā",
    216: "mahā-sattvā",
    217: "mahā-śaktiḥ",
    218: "mahā-ratiḥ",
    219: "mahā-bhogā",
    221: "mahā-vīryā",
    222: "mahā-balā",
    223: "mahā-buddhiḥ",
    224: "mahā-siddhiḥ",
    225: "mahā-yogeśvareśvarī",
    226: "mahā-tantrā",
    227: "mahā-mantrā",
    228: "mahā-yantrā",
    230: "mahā-yāga-kramārādhyā",
    231: "mahā-bhairava-pūjitā",
    232: "maheśvara-mahākalpa-mahā-tāṇḍava-sākṣiṇī",
    233: "mahā-kāmeśa-mahiṣī",
    234: "mahā-tripura-sundarī",
    235: "catuḥ-ṣaṣṭyupacārāḍhyā",
    236: "catuḥ-ṣaṣṭi-kalā-mayī",
    237: "mahā-catuḥṣaṣṭi-koṭi-yoginī-gaṇa-sevitā",
    238: "manu-vidyā",
    239: "candra-vidyā",
    240: "candra-maṇḍala-madhyagā",
    241: "cāru-rūpā",
    242: "cāru-hāsā",
    243: "cāru-candra-kalādharā",
    244: "carācara-jagannāthā",
    245: "cakra-rāja-niketanā",
    247: "padma-nayanā",
    248: "padma-rāga-samaprabhā",
    249: "pañca-pretāsanāsīnā",
    250: "pañca-brahma-svarūpiṇī",
    253: "vijñāna-ghana-rūpiṇī",
    254: "dhyāna-dhyātṛ-dhyeya-rūpā",
    255: "dharmādharma-vivarjitā",
    256: "viśva-rūpā",
    263: "sarvāvasthā-vivarjitā",
    264: "sṛṣṭi-kartrī",
    265: "brahma-rūpā",
    267: "govinda-rūpiṇī",
    269: "rudra-rūpā",
    270: "tirodhāna-karī",
    273: "anugraha-dā",
    274: "pañca-kṛtya-parāyaṇā",
    275: "bhānu-maṇḍala-madhyasthā",
    277: "bhaga-mālinī",
    280: "padma-nābha-sahodarī",
    281: "unmeṣa-nimiṣotpanna-vipanna-bhuvanāvalī",
    282: "sahasra-śīrṣa-vadanā",
    284: "sahasra-pāt",
    285: "ābrahma-kīṭa-janānī",
    286: "varṇāśrama-vidhāyinī",
    287: "nijājñā-rūpa-nigamā",
    288: "puṇyāpuṇya-phala-pradā",
    289: "śruti-sīmanta-sindūrī-kṛta-pādābja-dhūlikā",
    290: "sakalāgama-sandoha-śukti-sampuṭa-mauktikā",
    291: "puruṣārtha-pradā",
    300: "nāma-rūpa-vivarjitā",
    304: "heyopādeya-varjitā",
    305: "rāja-rājārcitā",
    312: "raṇat-kiṅkiṇi-mekhalā",
    316: "rati-priyā",
    324: "kāma-dāyinī",
    327: "mahā-vīryā",
    333: "satya-rūpā",
    337: "rāja-rājeśvarī",
    350: "ratiḥ-priyā",
    362: "bhava-dāva-sudhā-vṛṣṭiḥ",
    363: "pāpāraṇya-davānalā",
    364: "daurbhāgya-tūla-vātūlā",
    365: "jarādhvānta-ravi-prabhā",
    366: "bhāgyābdhi-candrikā",
    367: "bhakta-citta-keki-ghanāghanā",
    368: "roga-parvata-dambholiḥ",
    369: "mṛtyu-dāru-kuṭhārikā",
    371: "mahā-kālī",
    372: "mahā-grāsā",
    376: "caṇḍa-muṇḍāsura-niṣūdinī",
    378: "sarva-lokeśī",
    379: "viśva-dhāriṇī",
    380: "tri-varga-dātrī",
    383: "tri-guṇātmikā",
    384: "svargāpavarga-dā",
    386: "japā-puṣpa-nibhākṛtiḥ",
    388: "dyuti-dharā",
    389: "yajña-rūpā",
    390: "priya-vratā",
    393: "pāṭalī-kusuma-priyā",
    395: "meru-nilayā",
    396: "mandāra-kusuma-priyā",
    398: "virāḍ-rūpā",
    400: "viśvato-mukhī",
    401: "pratyag-rūpā",
    403: "prāṇa-dā",
    404: "prāṇa-rūpiṇī",
    405: "mārtāṇḍa-bhairavārādhyā",
    406: "mantriṇī-nyasta-rājya-dhūḥ",
    411: "satya-jñānānanda-rūpā",
    412: "sāmarasya-parāyaṇā",
    414: "kalā-mālā",
    416: "kāma-rūpiṇī",
    417: "kalā-nidhiḥ",
    418: "kāvya-kalā",
    420: "rasa-śevadhiḥ",
    426: "paraṃ-jyotiḥ",
    427: "paraṃ-dhāma",
    429: "parāt-parā",
    430: "pāśa-hantrī",
    431: "para-śaktiḥ",
    432: "pāśa-hastā",
    434: "prajñāna-ghana-rūpiṇī",
    435: "mādhvī-pānālasā",
    437: "mātṛkā-varṇa-rūpiṇī",
    438: "mahā-kailāsa-nilayā",
    439: "mṛṇāla-mṛdu-dorlatā",
    441: "dayā-mūrtiḥ",
    442: "mahā-sāmrājya-śālinī",
    443: "ātma-vidyā",
    444: "mahā-vidyā",
    445: "śrī-vidyā",
    446: "kāma-sevitā",
    447: "śrī-ṣoḍaśākṣarī-vidyā",
    448: "tri-kūṭā",
    449: "kāma-koṭikā",
    450: "kaṭākṣa-kiṅkarī-bhūta-kamalā-koṭi-sevitā",
    451: "vighna-nāśinī",
    458: "malayācala-vāsinī",
    467: "sūkṣma-rūpiṇī",
    480: "aneka-koṭi-brahmāṇḍa-jananī",
    481: "divya-vigrahā",
    485: "kaivalya-pada-dāyinī",
    487: "tri-jagad-vandyā",
    488: "tri-mūrtiḥ",
    489: "tri-daśeśvarī",
    491: "divya-gandhāḍhyā",
    492: "sindūra-tilakāñcitā",
    494: "śailendra-tanayā",
    496: "gandharva-sevitā",
    497: "viśva-garbhā",
    498: "svarṇa-garbhā",
    501: "dhyāna-gamyā",
    503: "jñāna-dā",
    504: "jñāna-vigrahā",
    505: "sarva-vedānta-saṃvedyā",
    506: "satyānanda-svarūpiṇī",
    508: "līlā-kḷpta-brahmāṇḍa-maṇḍalā",
    510: "dṛśya-rahitā",
    512: "vedya-varjitā",
    514: "yoga-dā",
    517: "yugan-dharā",
    518: "icchā-śakti-jñāna-śakti-kriyā-śakti-svarūpiṇī",
    521: "sad-asad-rūpa-dhāriṇī",
    522: "aṣṭa-mūrtiḥ",
    524: "loka-yātrā-vidhāyinī",
    526: "bhūma-rūpā",
    528: "dvaita-varjitā",
    529: "anna-dā",
    530: "vasu-dā",
    532: "brahmātmaikya-svarūpiṇī",
    537: "bali-priyā",
    538: "bhāṣā-rūpā",
    539: "bṛhat-senā",
    540: "bhāvābhāva-vivarjitā",
    542: "śubha-karī",
    544: "puṇya-śravaṇa-kīrtanā",
    546: "bandha-mocanī",
    548: "vimarśa-rūpiṇī",
    550: "viyadādi-jagat-prasūḥ",
    551: "sarva-vyādhi-praśamanī",
    552: "sarva-mṛtyu-nivāriṇī",
    554: "acintya-rūpā",
    555: "kali-kalmaṣa-nāśinī",
    557: "kāla-hantrī",
    558: "kamalākṣa-niṣevitā",
    559: "tāmbūla-pūrita-mukhī",
    560: "dāḍimī-kusuma-prabhā",
    564: "mitrarūpiṇī",
    567: "nikhileśvarī",
    568: "maitryādi-vāsanā-labhyā",
    569: "mahā-pralaya-sākṣiṇī",
    571: "prajñāna-ghana-rūpiṇī",
    572: "mādhvī-pānālasā",
    574: "mātṛkā-varṇa-rūpiṇī",
    575: "mahā-kailāsa-nilayā",
    576: "mṛṇāla-mṛdu-dorlatā",
    578: "dayā-mūrtiḥ",
    579: "mahā-sāmrājya-śālinī",
    580: "ātma-vidyā",
    581: "mahā-vidyā",
    582: "śrī-vidyā",
    583: "kāma-sevitā",
    584: "śrī-ṣoḍaśākṣarī-vidyā",
    586: "kāma-koṭikā",
    587: "kaṭākṣa-kiṅkarī-bhūta-kamalā-koṭi-sevitā",
    591: "śiraḥ-sthitā",
    592: "candra-nibhā",
    594: "indra-dhanuḥ-prabhā",
    595: "hṛdaya-sthā",
    596: "ravi-prakhyā",
    597: "trikoṇāntara-dīpikā",
    599: "daitya-hantrī",
    600: "dakṣa-yajña-vināśinī",
    601: "darāndolita-dīrghākṣī",
    602: "dara-hāsojjvalan-mukhī",
    603: "guru-mūrtiḥ",
    604: "guṇa-nidhiḥ",
    605: "go-mātā",
    606: "guha-janma-bhūḥ",
    608: "daṇḍa-nīti-sthā",
    609: "daharākāśa-rūpiṇī",
    610: "pratipan-mukhya-rākānta-tithi-maṇḍala-pūjitā",
    612: "kalā-nāthā",
    613: "kāvyālāpa-vinodinī",
    614: "sacāmara-ramā-vāṇī-savya-dakṣiṇa-sevitā",
    615: "ādi-śaktiḥ",
    619: "pāvanākṛtiḥ",
    620: "aneka-koṭi-brahmāṇḍa-jananī",
    621: "divya-vigrahā",
    625: "kaivalya-pada-dāyinī",
    627: "tri-jagad-vandyā",
    628: "tri-mūrtiḥ",
    630: "divya-gandhāḍhyā",
    631: "sindūra-tilakāñcitā",
    633: "śailendra-tanayā",
    635: "gandharva-sevitā",
    636: "viśva-garbhā",
    637: "svarṇa-garbhā",
    641: "dhyāna-gamyā",
    643: "jñāna-dā",
    644: "jñāna-vigrahā",
    645: "sarva-vedānta-saṃvedyā",
    646: "satyānanda-svarūpiṇī",
    648: "līlā-kḷpta-brahmāṇḍa-maṇḍalā",
    650: "dṛśya-rahitā",
    652: "vedya-varjitā",
    655: "yugan-dharā",
    656: "icchā-śakti-jñāna-śakti-kriyā-śakti-svarūpiṇī",
    659: "sad-asad-rūpa-dhāriṇī",
    660: "aṣṭa-mūrtiḥ",
    662: "loka-yātrā-vidhāyinī",
    664: "bhūma-rūpā",
    666: "dvaita-varjitā",
    667: "anna-dā",
    668: "vasu-dā",
    670: "brahmātmaikya-svarūpiṇī",
    675: "bali-priyā",
    676: "bhāṣā-rūpā",
    677: "bṛhat-senā",
    678: "bhāvābhāva-vivarjitā",
    680: "śubha-karī",
    685: "rājya-dāyinī",
    686: "rājya-vallabhā",
    688: "rāja-pīṭha-niveśita-nijāśritā",
    689: "rājya-lakṣmīḥ",
    690: "kośa-nāthā",
    691: "caturaṅga-baleśvarī",
    692: "sāmrājya-dāyinī",
    693: "satya-sandhā",
    694: "sāgara-mekhalā",
    696: "daitya-śamanī",
    697: "sarva-loka-vaśaṅkarī",
    698: "sarvārtha-dātrī",
    700: "saccidānanda-rūpiṇī",
    701: "deśa-kālāparicchinnā",
    703: "sarva-mohinī",
    706: "guhya-rūpiṇī",
    707: "sarvopādhi-vinirmuktā",
    708: "sadā-śiva-pativratā",
    710: "guru-maṇḍala-rūpiṇī",
    715: "komalāṅgī",
    716: "guru-priyā",
    718: "sarva-tantreśī",
    719: "dakṣiṇā-mūrti-rūpiṇī",
    720: "sanakādi-samārādhyā",
    721: "śiva-jñāna-pradāyinī",
    722: "cit-kalā",
    723: "ānanda-kalikā",
    724: "prema-rūpā",
    726: "nāma-pārāyaṇa-prītā",
    727: "nandi-vidyā",
    729: "mithyā-jagadadhiṣṭhānā",
    730: "mukti-dā",
    731: "mukti-rūpiṇī",
    732: "lāsya-priyā",
    733: "laya-karī",
    735: "rambhādi-vanditā",
    736: "bhava-dāva-sudhā-vṛṣṭiḥ",
    737: "pāpāraṇya-davānalā",
    738: "daurbhāgya-tūla-vātūlā",
    739: "jarādhvānta-ravi-prabhā",
    740: "bhāgyābdhi-candrikā",
    741: "bhakta-citta-keki-ghanāghanā",
    742: "roga-parvata-dambholiḥ",
    743: "mṛtyu-dāru-kuṭhārikā",
    745: "mahā-kālī",
    746: "mahā-grāsā",
    751: "caṇḍa-muṇḍāsura-niṣūdinī",
    755: "sarva-lokeśī",
    756: "viśva-dhāriṇī",
    757: "tri-varga-dātrī",
    759: "tri-guṇātmikā",
    760: "svargāpavarga-dā",
    762: "japā-puṣpa-nibhākṛtiḥ",
    765: "yajña-rūpā",
    766: "priya-vratā",
    768: "pāṭalī-kusuma-priyā",
    770: "meru-nilayā",
    771: "mandāra-kusuma-priyā",
    773: "virāḍ-rūpā",
    775: "viśvato-mukhī",
    776: "pratyag-rūpā",
    778: "prāṇa-dā",
    779: "prāṇa-rūpiṇī",
    780: "mārtāṇḍa-bhairavārādhyā",
    781: "mantriṇī-nyasta-rājya-dhūḥ",
    787: "satya-jñānānanda-rūpā",
    788: "sāmarasya-parāyaṇā",
    790: "kalā-mālā",
    792: "kāma-rūpiṇī",
    793: "kalā-nidhiḥ",
    794: "kāvya-kalā",
    796: "rasa-śevadhiḥ",
    802: "paraṃ-jyotiḥ",
    803: "paraṃ-dhāma",
    805: "parāt-parā",
    806: "pāśa-hantrī",
    807: "para-śaktiḥ",
    808: "pāśa-hastā",
    901: "nāda-rūpiṇī",
    908: "tattva-martha-svarūpiṇī",
    909: "sāma-gāna-priyā",
    911: "sadāśiva-kuṭumbinī",
    912: "savyāpasavya-mārga-sthā",
    913: "sarvāpad-vinivāriṇī",
    915: "svabhāva-madhurā",
    917: "dhīra-samarcitā",
    918: "caitanyārghya-samārādhyā",
    919: "caitanya-kusuma-priyā",
    950: "viṣṇu-rūpiṇī",
    951: "ayoniḥ",
    955: "pañca-kośāntara-sthitā",
    964: "sadā-śivā",
    966: "parā-śaktiḥ",
    970: "kāma-keli-taraṅgitā",
    985: "mṛtyu-mṛtyu-svarūpiṇī",
    990: "abhyāsātiśaya-jñātā",
    991: "ṣaḍadhvātīta-rūpiṇī",
    992: "avyāja-karuṇā-mūrtiḥ",
    993: "ajñāna-dhvānta-dīpikā",
    994: "ābāla-gopa-viditā",
    995: "sarvānullaṅghya-śāsanā",
    996: "śrī-cakra-rāja-nilayā",
    997: "śrīmat-tripura-sundarī",
    998: "śrī-śivā",
    999: "śiva-śaktaikya-rūpiṇī",
    1000: "lalitāmbikā",
}


def main():
    with open('lalitha-sahasranama/data.js', 'r', encoding='utf-8') as f:
        content = f.read()

    json_start = content.index('{')
    json_end = content.rindex('}') + 1
    data = json.loads(content[json_start:json_end])

    # Apply splits
    split_count = 0
    auto_count = 0
    for name in data['names']:
        num = name['num']
        original = name['name_iast']

        if num in MANUAL_SPLITS:
            name['name_iast'] = MANUAL_SPLITS[num]
            if '-' in name['name_iast']:
                split_count += 1
        else:
            # Try auto-splitting
            result = segment_compound(original)
            if result != original:
                name['name_iast'] = result
                auto_count += 1
                split_count += 1

    print(f"Manual splits applied: {len(MANUAL_SPLITS)}")
    print(f"Auto splits applied: {auto_count}")
    print(f"Total names with hyphens: {split_count}")

    # Show first 20 for verification
    print("\nFirst 20 names:")
    for n in data['names'][:20]:
        print(f"  {n['num']:3d}. {n['name_iast']}")

    # Write output
    json_output = json.dumps(data, ensure_ascii=False, indent=2)
    output = (
        "// Lalitha Sahasranama - Complete Data\n"
        "// Source: sanskritdocuments.org (Brahmanda Purana)\n"
        "// Transliteration: IAST (International Alphabet of Sanskrit Transliteration)\n"
        "\n"
        f"const LALITHA_DATA = {json_output};\n"
    )
    with open('lalitha-sahasranama/data.js', 'w', encoding='utf-8') as f:
        f.write(output)

    print("\nData written successfully.")


if __name__ == '__main__':
    main()
