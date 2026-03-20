#!/usr/bin/env python3
"""Generate words.js with morpheme splits for Lalitha Sahasranama."""
import json, re

# Morpheme dictionary: transliteration -> meaning
DICT = {
    # Common prefixes
    "śrī": "sacred/auspicious", "śrīmat": "glorious/resplendent", "śrīman": "glorious",
    "mahā": "great", "mahaiśvaryā": "great sovereignty", "mahā-": "great",
    "nir": "without", "niṣ": "without", "niḥ": "without", "nīr": "without",
    "niś": "without", "nis": "without", "nityā": "eternal",
    "su": "good/beautiful", "dur": "difficult", "duḥkha": "sorrow",
    "sarva": "all", "para": "supreme", "parā": "supreme",
    "sat": "true/good", "sad": "true/good", "a": "not",
    "pañca": "five", "tri": "three", "catur": "four", "ṣaṭ": "six",
    "sahasra": "thousand", "eka": "one", "dvaya": "two",
    "aṣṭa": "eight", "daśa": "ten",

    # Body/form
    "mātā": "mother", "rūpā": "form", "rūpiṇī": "having the form of",
    "mūrtiḥ": "embodiment", "vigrahā": "form/body", "ākṛtiḥ": "form",
    "ānanā": "face", "mukhī": "faced", "vadanā": "faced",
    "nayanā": "eyed", "locanā": "eyed", "akṣī": "eyed",
    "kacā": "haired", "keśī": "haired",
    "bhujānvitā": "having arms", "dorlatā": "arm-creeper",
    "kapolā": "cheek", "gulphā": "ankle", "jaṅghikā": "calf",
    "padāmbujā": "lotus feet", "madhyamā": "waist/middle",
    "kandharā": "neck", "stanī": "breasted",
    "āṅgī": "bodied", "aṅgī": "bodied", "vigrahā": "form",

    # Divine/cosmic
    "devī": "goddess", "devatā": "deity", "bhagavatī": "divine one",
    "śivā": "Shiva/auspicious", "śiva": "Shiva", "brahma": "Brahma/Absolute",
    "viṣṇu": "Vishnu", "rudra": "Rudra", "indra": "Indra",
    "kāmeśa": "Lord of desire (Shiva)", "kāmeśvara": "Lord of desire",
    "deva": "god/divine", "sura": "god", "gaṇeśa": "Ganesha",
    "nārāyaṇa": "Narayana/Vishnu", "lakṣmī": "Lakshmi",
    "sarasvatī": "Saraswati", "gaurī": "Gauri/Parvati",
    "pārvatī": "Parvati", "durgā": "Durga", "bhavānī": "Bhavani",
    "umā": "Uma", "ambikā": "Mother", "jananī": "mother/creator",
    "īśvarī": "sovereign goddess", "nāyikā": "leader/heroine",
    "rājñī": "queen", "mahārājñī": "great queen/empress",

    # Qualities
    "priyā": "beloved/fond of", "prīta": "pleased", "prītā": "pleased",
    "dāyinī": "bestower", "pradā": "giver/bestower",
    "dātrī": "giver", "karī": "doer/maker", "kartrī": "creator",
    "vāsinī": "dweller", "nilayā": "abode", "sthitā": "situated",
    "sthā": "situated/dwelling", "gatā": "gone to/situated",
    "rūpā": "form", "mayī": "consisting of", "ātmikā": "having the nature of",
    "hantrī": "destroyer", "ghnī": "destroyer",
    "nāśinī": "destroyer", "śamanī": "subduer",
    "bhūṣitā": "adorned", "maṇḍitā": "decorated",
    "śobhitā": "beautified", "virājitā": "shining",
    "bhāsurā": "radiant", "ujjvalā": "brilliant",
    "samanvitā": "endowed with", "anvitā": "endowed with",
    "yuktā": "united/endowed", "paripūritā": "filled with",
    "sevitā": "served/worshipped", "pūjitā": "worshipped",
    "arcitā": "worshipped", "ārādhyā": "to be worshipped",
    "vandyā": "worthy of praise", "stūyamānā": "being praised",
    "nanditā": "delighted", "harṣitā": "joyful",
    "toṣitā": "pleased", "samutsukā": "eager",
    "gamyā": "attainable by", "labhyā": "obtainable by",
    "vaśyā": "controllable by", "vedyā": "knowable",
    "pradāyinī": "bestower", "vivardhinī": "increaser",
    "nivāriṇī": "remover", "praśamanī": "pacifier",

    # Nature/essence
    "śaktiḥ": "power/energy", "śakti": "power/energy",
    "vidyā": "knowledge", "jñāna": "wisdom/knowledge",
    "ānandā": "bliss", "ānanda": "bliss", "sukhā": "happiness",
    "karuṇā": "compassion", "dayā": "mercy/compassion",
    "kāntiḥ": "radiance", "kānti": "radiance", "kāntā": "radiant/beloved",
    "śāntiḥ": "peace", "śāntā": "peaceful",
    "buddhi": "intellect", "buddhiḥ": "intellect",
    "mati": "mind/thought", "matiḥ": "mind/thought",
    "dhṛtiḥ": "steadfastness", "tuṣṭiḥ": "satisfaction",
    "puṣṭiḥ": "nourishment", "sṛṣṭi": "creation",
    "siddhi": "spiritual attainment", "siddhiḥ": "attainment",
    "mukti": "liberation", "bhakti": "devotion",
    "dharma": "righteousness", "karma": "action",
    "mantra": "sacred chant", "tantra": "system/doctrine",
    "yantra": "mystical diagram", "yoga": "union/yoga",
    "māyā": "illusion", "līlā": "divine play",
    "rasa": "essence/taste", "tattva": "truth/principle",
    "guṇa": "quality", "kalā": "art/digit",

    # Cosmos
    "jagat": "universe/world", "loka": "world",
    "brahmāṇḍa": "universe", "bhuvana": "world",
    "viśva": "universe", "viśvā": "universe",
    "cakra": "wheel/disc/center", "maṇḍala": "circle/sphere",
    "padma": "lotus", "kamala": "lotus",
    "sāgara": "ocean", "samudra": "ocean",
    "parvata": "mountain", "meru": "Mt. Meru",
    "vana": "forest", "āraṇya": "forest",
    "kūṭa": "peak/division", "kūṭā": "peak",
    "pīṭha": "seat/center", "āsana": "seat",
    "agni": "fire", "vahni": "fire",
    "candra": "moon", "sūrya": "sun", "bhānu": "sun",
    "jala": "water", "vāyu": "wind",

    # Actions/states
    "sambhūtā": "born from", "uditā": "risen/arisen",
    "samudyatā": "intent on/ready for",
    "ārūḍhā": "mounted/seated on", "āsīnā": "seated",
    "saṃsthitā": "established", "madhyasthā": "situated in the middle",
    "madhyagā": "dwelling in the middle",
    "pradā": "bestowing", "varṣiṇī": "showering",
    "vibhedinī": "piercing/breaking",
    "dhāriṇī": "bearing/supporting", "pālinī": "protector",
    "mocinī": "liberator", "vimocinī": "liberator",

    # Specific morphemes (appearing in names)
    "kuṇḍa": "fire-pit", "kārya": "purpose/work",
    "siṃhāsana": "throne", "siṃhāsaneśvarī": "queen of the throne",
    "bhānu": "sun", "udyad": "rising",
    "bāhu": "arm", "rāga": "passion/love/desire",
    "svarūpa": "true nature", "svarūpiṇī": "having the nature of",
    "pāśa": "noose/bond", "āḍhyā": "rich in/endowed with",
    "krodha": "anger", "ākāra": "form",
    "aṅkuśa": "goad", "manas": "mind", "mano": "mind",
    "ikṣu": "sugarcane", "kodaṇḍā": "bow",
    "tanmātra": "subtle element", "sāyakā": "arrow",
    "nija": "own", "aruṇa": "crimson/red",
    "prabhā": "radiance/light", "pūra": "flood/fullness",
    "majjad": "immersing", "campaka": "champak flower",
    "aśoka": "ashoka flower", "punnāga": "punnaga flower",
    "saugandhika": "fragrant flower", "lasat": "shining",
    "kuruvinda": "ruby", "maṇi": "gem/jewel",
    "śreṇī": "row/line", "kanat": "shining",
    "koṭīra": "crown", "aṣṭamī": "eighth day",
    "vibhrāja": "shining", "dalika": "forehead",
    "sthala": "place/surface", "mukha": "face",
    "kalaṅka": "mark/spot", "ābha": "resembling",
    "mṛga": "deer", "nābhi": "musk/navel",
    "viśeṣakā": "ornamental mark",
    "vadana": "face", "smara": "Cupid/love",
    "māṅgalya": "auspicious", "gṛha": "house",
    "toraṇa": "arch/gateway", "cillikā": "eyebrow",
    "vaktra": "face/mouth", "parīvāha": "overflow/stream",
    "calan": "moving", "mīna": "fish",
    "nava": "new/fresh", "puṣpa": "flower",
    "nāsā": "nose", "daṇḍa": "bridge/staff",
    "tārā": "star", "tiraskāri": "excelling",
    "nāsābharaṇa": "nose-ornament",
    "kadamba": "kadamba flower", "mañjarī": "cluster/blossom",
    "kḷpta": "fashioned", "karṇa": "ear",
    "pūra": "ornament/fullness", "manoharā": "captivating",
    "tāṭaṅka": "earring", "yugalī": "pair",
    "bhūta": "become/being", "tapana": "sun",
    "uḍupa": "moon",
    "padmarāga": "ruby", "śilā": "stone",
    "ādarśa": "mirror", "paribhāvi": "surpassing",
    "kapola": "cheek", "bhūḥ": "surface/earth",
    "vidruma": "coral", "bimba": "bimba fruit",
    "nyakkāri": "excelling", "radanacchadā": "lips (covering of teeth)",
    "śuddha": "pure", "aṅkura": "sprout",
    "dvija": "teeth (twice-born)", "paṅkti": "row",
    "karpūra": "camphor", "vīṭikā": "betel roll",
    "moda": "fragrance", "samākarṣi": "attracting",
    "digantarā": "all directions",
    "sallāpa": "conversation", "mādhurya": "sweetness",
    "vinirbhartsita": "excelling/reproaching", "kacchapī": "veena of Saraswati",
    "manda": "gentle", "smita": "smile",
    "kāmeśa": "Lord Kamesha (Shiva)",
    "mānasā": "mind", "anākalita": "incomparable",
    "sādṛśya": "resemblance", "cibuka": "chin",
    "baddha": "tied", "sūtra": "thread/string",
    "śobhita": "adorned", "kanaka": "gold",
    "aṅgada": "armlet", "keyūra": "upper armlet",
    "kamanīya": "beautiful", "ratna": "gem/jewel",
    "graiveya": "necklace", "cintāka": "pendant",
    "lola": "swaying", "muktā": "pearl",
    "phala": "fruit", "prema": "love",
    "pratipaṇa": "given in exchange",
    "nābhyālavāla": "navel-basin", "romāli": "line of hair",
    "latā": "creeper/vine", "kuca": "breast",
    "dvayī": "pair", "lakṣya": "barely visible",
    "roma": "hair", "dhāratā": "stream",
    "samunneya": "inferred", "stana": "breast",
    "bhāra": "weight/fullness", "dalan": "bending",
    "madhya": "middle/waist", "paṭṭa": "silk",
    "bandha": "band/girdle", "vali": "fold",
    "trayā": "three", "kausumbha": "saffron-dyed",
    "vastra": "garment", "bhāsvat": "shining",
    "kaṭī": "hip", "taṭī": "slope/bank",
    "kiṅkiṇikā": "small bells", "ramya": "beautiful",
    "raśanā": "girdle", "dāma": "garland/chain",
    "jñāta": "known", "saubhāgya": "beauty/fortune",
    "mārdava": "softness", "ūru": "thigh",
    "māṇikya": "ruby", "makuṭa": "crown",
    "jānu": "knee", "gopa": "beetle",
    "parikṣipta": "surrounded", "tūṇa": "quiver",
    "gūḍha": "hidden", "kūrma": "tortoise",
    "pṛṣṭha": "back", "jayiṣṇu": "victorious",
    "prapada": "forefoot/toes", "nakha": "nail",
    "dīdhiti": "radiance", "saṃchanna": "covered",
    "namajjana": "bowing devotees", "tamo": "darkness",
    "pada": "foot", "prabhā": "light/radiance",
    "jāla": "net/web", "parākṛta": "excelling",
    "saroruha": "lotus", "śiñjāna": "tinkling",
    "mañjira": "anklet", "maṇḍita": "adorned",
    "marālī": "swan-like", "gamanā": "gait",
    "lāvaṇya": "beauty/grace", "śevadhiḥ": "treasure",
    "anavadya": "faultless", "ābharaṇa": "ornament",

    # Spiritual/philosophical
    "cit": "consciousness", "cid": "consciousness",
    "ātmā": "self/soul", "ātman": "self",
    "parama": "supreme", "paramā": "supreme",
    "cinmayī": "consciousness-filled",
    "vijñāna": "wisdom/knowledge", "ghana": "dense/solid",
    "dhyāna": "meditation", "dhyātṛ": "meditator",
    "dhyeya": "object of meditation",
    "tattva": "truth/principle", "satya": "truth",
    "ānanda": "bliss", "caitanya": "consciousness",
    "prakṛtiḥ": "primordial nature", "avyaktā": "unmanifest",
    "vyāpinī": "all-pervading",
    "kuṇḍalinī": "coiled energy",
    "gāyatrī": "Gayatri", "sandhyā": "twilight prayer",

    # Common compound elements
    "rāja": "king/royal", "kula": "family/lineage",
    "stotra": "hymn of praise", "nāma": "name",
    "pārāyaṇa": "devoted recitation",
    "tripura": "three cities", "koṭi": "crore/ten million",
    "sahasrābhā": "thousand-rayed radiance",
    "granthi": "knot", "āmbuja": "lotus",
    "saruciḥ": "equal in beauty",
    "upari": "above", "tantu": "thread/fiber",
    "tanīyasī": "extremely slender",
    "bisa": "lotus-stalk",
    "kuṭhārikā": "axe", "bhava": "worldly existence",
}

# Read data.js
with open('lalitha-sahasranama/data.js', 'r', encoding='utf-8') as f:
    content = f.read()
json_start = content.index('{')
json_end = content.rindex('}') + 1
data = json.loads(content[json_start:json_end])

# Build morpheme data from the hyphenated IAST in each name
lines = []
lines.append('// Lalitha Sahasranama - Morpheme Splits for Compound Names')
lines.append('// Adds morpheme breakdown data to LALITHA_DATA names')
lines.append('(function () {')
lines.append('  var M = {};')
lines.append('')

for name in data['names']:
    num = name['num']
    iast = name.get('name_iast', '')
    if not iast or '-' not in iast:
        continue  # Skip single-word names

    parts = iast.split('-')
    # Only add if there are actual splits
    if len(parts) < 2:
        continue

    # Look up meanings for each morpheme
    morphemes = []
    for part in parts:
        meaning = DICT.get(part, '')
        if not meaning:
            # Try lowercase
            meaning = DICT.get(part.lower(), '')
        if not meaning:
            # Try without trailing vowel modifications
            for key in DICT:
                if part.startswith(key) and len(part) - len(key) <= 2:
                    meaning = DICT[key]
                    break
        morphemes.append((part, meaning))

    # Format as JS
    morph_str = ', '.join(
        f'["{m[0]}", "{m[1]}"]' for m in morphemes
    )
    lines.append(f'  M[{num}] = [{morph_str}];')

lines.append('')
lines.append('  // Attach morpheme data to names')
lines.append('  if (typeof LALITHA_DATA !== "undefined") {')
lines.append('    LALITHA_DATA.names.forEach(function (name) {')
lines.append('      if (M[name.num]) {')
lines.append('        name.morphemes = M[name.num].map(function (m) {')
lines.append('          return { transliteration: m[0], meaning: m[1] };')
lines.append('        });')
lines.append('      }')
lines.append('    });')
lines.append('  }')
lines.append('})();')

with open('lalitha-sahasranama/words.js', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

# Count stats
total_with_splits = sum(1 for n in data['names'] if '-' in n.get('name_iast', ''))
print(f"Generated words.js with {total_with_splits} compound name entries")

# Count how many morphemes have meanings vs empty
all_morphemes = set()
missing = set()
for name in data['names']:
    iast = name.get('name_iast', '')
    if '-' in iast:
        for part in iast.split('-'):
            all_morphemes.add(part)
            if part not in DICT:
                found = False
                for key in DICT:
                    if part.startswith(key) and len(part) - len(key) <= 2:
                        found = True
                        break
                if not found:
                    missing.add(part)

print(f"Total unique morphemes: {len(all_morphemes)}")
print(f"Morphemes with meanings: {len(all_morphemes) - len(missing)}")
print(f"Missing meanings: {len(missing)}")
if missing:
    print("Missing morphemes (first 50):")
    for m in sorted(missing)[:50]:
        print(f"  {m}")
