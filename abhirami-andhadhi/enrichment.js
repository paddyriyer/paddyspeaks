// ============================================================
// Abhirami Anthadhi — Interpretation Layer
// ============================================================
//
// data.js holds the VERIFIED Tamil text (sourced from sivaya.org /
// Thirumurai Group) and must never be regenerated or "corrected" from
// memory. This file is a SEPARATE layer that hangs interpretation off
// the verified text. Nothing here overwrites Tamil.
//
// Three levels of claim are kept strictly apart everywhere on the page:
//
//   TEXT        — what Abhirami Bhattar's Tamil actually says.
//   TRADITION   — how later devotional / commentarial practice uses it.
//   READING     — philosophical, psychological, yogic or Sri Vidya
//                 interpretation, always marked as interpretation.
//
// `confidence` on each verse records how firm the interpretation is.
// `sourceNotes` records variants, ambiguous parses and open questions.
//
// STATUS: pilot set. 17 of 102 entries interpreted. The remaining verses
// render from data.js alone until they are worked through with the same
// structure.
// ============================================================

var ABHIRAMI_META = {
  totalVerses: 100,
  enrichedCount: 17,
  // Honest statement of where the life-challenge groupings come from.
  navigatorProvenance:
    'The groupings below are derived from the words of the verses themselves — ' +
    'the images, petitions and vocabulary Abhirami Bhattar actually uses. Printed ' +
    'paaraayana traditions also circulate verse-by-verse purpose lists; where such a ' +
    'list assigns a purpose that the Tamil does not itself carry, it is labelled ' +
    'separately rather than merged in silently.',
  textSource: 'Tamil text: sivaya.org (Thirumurai Group). Transliteration: ISO 15919.',
  translationNote:
    'English renderings on interpreted verses are built up from the word-by-word ' +
    'breakdown shown with each one, so the reasoning is visible and checkable.'
};

// --- Theme vocabulary (drives the filter row) ---------------------------
var ABHIRAMI_THEMES = [
  { key: 'all',          label: 'All' },
  { key: 'knowledge',    label: 'Knowledge' },
  { key: 'mind',         label: 'Mind' },
  { key: 'health',       label: 'Health' },
  { key: 'relationships',label: 'Relationships' },
  { key: 'career',       label: 'Career' },
  { key: 'prosperity',   label: 'Prosperity' },
  { key: 'protection',   label: 'Protection' },
  { key: 'karma',        label: 'Karma' },
  { key: 'devotion',     label: 'Devotion' },
  { key: 'srividya',     label: 'Sri Vidya' },
  { key: 'liberation',   label: 'Liberation' }
];

// --- Life Challenge Navigator ------------------------------------------
// Each challenge lists the interpreted verses whose own words support it.
var ABHIRAMI_CHALLENGES = [
  {
    key: 'mind',
    icon: 'lotus',
    title: 'Mind & Inner Peace',
    blurb: 'Verses whose images are of the unsettled mind — churning, wavering, ashamed, afraid.',
    items: [
      { key: 'worry',      label: 'Worry & anxiety',        verses: [7, 5, 69] },
      { key: 'wavering',   label: 'A wavering mind',        verses: [7, 10, 6] },
      { key: 'distress',   label: 'Emotional distress',     verses: [5, 7, 66] },
      { key: 'clarity',    label: 'Mental clarity',         verses: [1, 10, 6] },
      { key: 'habits',     label: 'Harmful habits & company', verses: [3, 54] },
      { key: 'selfworth',  label: 'Feeling inadequate',     verses: [66, 54] }
    ]
  },
  {
    key: 'knowledge',
    icon: 'sun',
    title: 'Knowledge & Education',
    blurb: 'Light, discernment, the unwritten Veda, and learning as something given rather than seized.',
    items: [
      { key: 'truth',      label: 'True knowledge',         verses: [1, 3, 10] },
      { key: 'study',      label: 'Learning & study',       verses: [69, 1] },
      { key: 'focus',      label: 'Concentration',          verses: [6, 10] },
      { key: 'memory',     label: 'Memory & retention',     verses: [6, 10] }
    ]
  },
  {
    key: 'career',
    icon: 'gem',
    title: 'Career, Leadership & Responsibility',
    blurb: 'Standing, recognition, and the weight of work that must be carried through.',
    items: [
      { key: 'standing',   label: 'Recognition & standing', verses: [4] },
      { key: 'obstacles',  label: 'Overcoming obstacles',   verses: [0, 25] },
      { key: 'responsibility', label: 'Carrying responsibility', verses: [4, 66] },
      { key: 'completion', label: 'Completing what is begun', verses: [0, 25, 6] }
    ]
  },
  {
    key: 'prosperity',
    icon: 'moon',
    title: 'Prosperity & Financial Stability',
    blurb: 'What the verses actually promise about wealth — and what they attach it to.',
    items: [
      { key: 'prosperity', label: 'Prosperity',             verses: [69] },
      { key: 'debt',       label: 'Debt & financial burden', verses: [54] },
      { key: 'livelihood', label: 'Livelihood & resources', verses: [69, 54] },
      { key: 'stability',  label: 'Stability',              verses: [69, 75] }
    ]
  },
  {
    key: 'relationships',
    icon: 'flower',
    title: 'Relationships & Family',
    blurb: 'The Mother as kin: companion, deity, and the one who bore you.',
    items: [
      { key: 'family',     label: 'Family wellbeing',       verses: [2] },
      { key: 'company',    label: 'Good company',           verses: [6, 3] },
      { key: 'harmful',    label: 'Harmful company',        verses: [3, 54] },
      { key: 'alone',      label: 'Refuge when alone',      verses: [2, 66] }
    ]
  },
  {
    key: 'health',
    icon: 'lotusfeet',
    title: 'Health & Strength',
    blurb: 'Traditional devotional association only. Nothing here is a claim about medicine.',
    items: [
      { key: 'illness',    label: 'Relief from illness',    verses: [24] },
      { key: 'strength',   label: 'Strength during difficulty', verses: [24, 5] },
      { key: 'resilience', label: 'Emotional resilience',   verses: [5, 7] }
    ]
  },
  {
    key: 'protection',
    icon: 'pasa',
    title: 'Protection & Adversity',
    blurb: 'Fear, hostility, and circumstances that will not lift.',
    items: [
      { key: 'fear',       label: 'Fear',                   verses: [7, 3, 2] },
      { key: 'continuous', label: 'Difficulty that will not lift', verses: [5, 25] },
      { key: 'hostile',    label: 'Hostile circumstances',  verses: [3, 54] },
      { key: 'influences', label: 'Negative influences',    verses: [3] }
    ]
  },
  {
    key: 'karma',
    icon: 'trident',
    title: 'Karma & Spiritual Growth',
    blurb: 'Past action, attachment, the round of birth, and what surrender actually means.',
    items: [
      { key: 'pastkarma',  label: 'Past karma',             verses: [87, 25] },
      { key: 'attachment', label: 'Worldly attachment',     verses: [75, 87] },
      { key: 'rebirth',    label: 'Rebirth',                verses: [25, 75, 10] },
      { key: 'surrender',  label: 'Surrender',              verses: [66, 2, 10] },
      { key: 'mantra',     label: 'Mantra & discipline',    verses: [6] },
      { key: 'srividya',   label: 'Sri Vidya',              verses: [2, 5, 54] },
      { key: 'moksha',     label: 'Liberation',             verses: [10, 75, 25] }
    ]
  }
];

// --- "Where Should I Begin?" curated entry points ------------------------
var ABHIRAMI_FEATURED = [
  { verse: 7,  label: 'Worry & a churning mind',   line: 'My soul spins like the staff set churning in curd.' },
  { verse: 24, label: 'Illness & affliction',      line: 'To affliction, You are the medicine.' },
  { verse: 54, label: 'Debt & financial hardship', line: 'Never to stand diminished before another, telling them what you lack.' },
  { verse: 69, label: 'Prosperity & learning',     line: 'They grant wealth. They grant learning. They grant a mind that never once knows weariness.' },
  { verse: 66, label: 'Feeling you are not enough',line: 'I know no accomplishment. I am small.' },
  { verse: 1,  label: 'Knowledge & light',         line: 'Abhirami is the very sight of my eyes.' },
  { verse: 2,  label: 'Refuge, family, Sri Vidya', line: 'Our help, the god we worship, the mother who bore us.' },
  { verse: 87, label: 'Past karma',                line: 'It stood out in the open — for my eyes, and for my acts.' },
  { verse: 75, label: 'Liberation',                line: 'They will let fade the earth-birth that never fails to come.' }
];

// ------------------------------------------------------------------
// Per-verse interpretation.
//
//   theme            one-line primary theme, shown on cards and the garland
//   tags             theme keys, drives the filter row
//   english          plain contemporary rendering, built from wordBreakdown
//   words            semantic (not whitespace) split of the Tamil
//   textualBasis     what in the Tamil supports the association below
//   association      { label, basis } — 'text' | 'tradition' | 'none'
//   devotional       what Bhattar is saying to the Mother
//   inner            the human condition the verse describes
//   sriVidya         Sri Vidya / Sakta reading, or null where forcing one
//                    would be invention
//   lesson           one short modern reflection
//   lalitha          [{ num, iast, meaning, why }] — why, not keyword match
//   apply            [{ when, what }] grounded application
//   parayana         traditional recitation note, or the honest default
//   sourceNotes      variants, ambiguous parses, open questions
//   confidence       'high' | 'medium' | 'speculative'
// ------------------------------------------------------------------

var ABHIRAMI_ENRICHMENT = {

  0: {
    theme: 'Invocation · Ganapati · Beginnings',
    tags: ['devotion', 'career'],
    label: 'Kaappu',
    english:
      'You who wear the konrai in Your garland and the champaka wreath — son of Uma, ' +
      'who is the half of the Lord of Thillai. Ganapati, dark as the raincloud: ordain ' +
      'that the Anthadhi of glorious Abhirami, who bore the seven worlds, stand always ' +
      'within my mind.',
    words: [
      { tamil: 'தார் அமர் கொன்றையும்', translit: 'tār amar koṉṟaiyum', meanings: ['the konrai blossom that rests in the garland'], note: 'கொன்றை, the Indian laburnum, is Siva’s flower. அமர் here is "to dwell, to rest in", not "war".' },
      { tamil: 'சண்பக மாலையும்', translit: 'caṇpaka mālaiyum', meanings: ['and the champaka garland'] },
      { tamil: 'சாத்தும்', translit: 'cāttum', meanings: ['who wears', 'that is offered / placed upon'] },
      { tamil: 'தில்லை ஊரர் தம்', translit: 'tillai ūrar tam', meanings: ['of the Lord of Thillai'], note: 'Thillai is Chidambaram.' },
      { tamil: 'பாகத்து உமை', translit: 'pākattu umai', meanings: ['Uma, who is His half'], note: 'பாகம் = a share, a half — the Ardhanarisvara image.' },
      { tamil: 'மைந்தனே', translit: 'maintaṉē', meanings: ['O son'] },
      { tamil: 'உலகு ஏழும் பெற்ற', translit: 'ulaku ēḻum peṟṟa', meanings: ['who bore the seven worlds'], note: 'பெறு = to bear, to give birth to — not merely "to obtain".' },
      { tamil: 'சீர் அபிராமி அந்தாதி', translit: 'cīr apirāmi antāti', meanings: ['the Anthadhi of glorious Abhirami'] },
      { tamil: 'எப்போதும் என் சிந்தையுள்ளே', translit: 'eppōtum eṉ cintaiyuḷḷē', meanings: ['always, within my mind'] },
      { tamil: 'கார் அமர் மேனி', translit: 'kār amar mēṉi', meanings: ['a body in which the raincloud dwells', 'dark-hued form'] },
      { tamil: 'கணபதியே', translit: 'kaṇapatiyē', meanings: ['O Ganapati'] },
      { tamil: 'நிற்க', translit: 'niṟka', meanings: ['may it stand', 'may it abide'] },
      { tamil: 'கட்டுரையே', translit: 'kaṭṭuraiyē', meanings: ['ordain it', 'decree it', 'declare it firmly'], note: 'கட்டுரை = a binding utterance. The poet asks Ganapati not to bless the poem but to fix it in place.' }
    ],
    textualBasis:
      'The kaappu is a request that the work itself hold together and be completed — ' +
      'கட்டுரையே, "decree it", addressed to the remover of obstacles before a single ' +
      'verse to Abhirami is sung.',
    association: {
      label: 'Beginnings · Completing what is undertaken',
      basis: 'text'
    },
    devotional:
      'Bhattar does not begin with Abhirami. He begins by asking Uma’s son to make ' +
      'room for Her — a hundred verses of Her, standing permanently in a mind that ' +
      'will be tested before the poem is done.',
    inner:
      'The request is unusually modest for an invocation. He does not ask for skill, ' +
      'fame or inspiration. He asks that the subject stay in view. Anyone who has ' +
      'begun a long piece of work knows that this, and not talent, is the thing that ' +
      'usually fails.',
    sriVidya:
      'Ganapati stands at the threshold of Sri Vidya practice as he stands at the ' +
      'threshold of a temple: the first worship, the clearing of the way. Placing him ' +
      'before a Sakta hymn is ordinary and expected, not a hidden doctrine.',
    lesson:
      'A beginning is a request for continuity, not for brilliance. The prayer is not ' +
      '"let this be good" but "let me still be here at verse one hundred".',
    lalitha: [
      { num: 1, iast: 'śrī-mātā', meaning: 'She who is the auspicious Mother',
        why: 'The kaappu already names Her as the one who bore the seven worlds — motherhood as cosmology, which is exactly where the Sahasranama opens.' }
    ],
    apply: [
      { when: 'Starting something long', what: 'The useful vow is not about the outcome but about attention: that the thing stays in mind on the days it is dull.' },
      { when: 'Before work that matters', what: 'Clear the ground first. The invocation is a habit of not rushing at the subject.' }
    ],
    parayana: 'The kaappu is recited before the hundred verses in ordinary Abhirami Anthadhi paaraayana.',
    sourceNotes: [],
    confidence: 'high'
  },

  1: {
    theme: 'Light · Recognition · True knowledge',
    tags: ['knowledge', 'devotion', 'mind'],
    english:
      'The rising sun. The tilaka at the crown. The ruby the discerning prize. The ' +
      'pomegranate bud, the opening lotus, the lightning they sing of, kumkuma soft ' +
      'and fragrant and damp — a form ordained out of all of these. Abhirami is the ' +
      'very sight of my eyes.',
    words: [
      { tamil: 'உதிக்கின்ற செங்கதிர்', translit: 'utikkiṉṟa ceṅkatir', meanings: ['the rising red sun', 'the red ray at the moment of rising'], note: 'Not the noon sun. உதிக்கின்ற is present — rising, still rising.' },
      { tamil: 'உச்சித் திலகம்', translit: 'uccit tilakam', meanings: ['the tilaka at the crown of the head'] },
      { tamil: 'உணர்வுடையோர்', translit: 'uṇarvuṭaiyōr', meanings: ['those who possess discernment', 'those who feel / perceive'], note: 'உணர்வு is felt perception, closer to "discernment" than to book-learning.' },
      { tamil: 'மதிக்கின்ற மாணிக்கம்', translit: 'matikkiṉṟa māṇikkam', meanings: ['the ruby that they value'], note: 'மதி as a verb, "to esteem"; the same syllable elsewhere in the poem means "moon" and "intellect".' },
      { tamil: 'மாதுளம் போது', translit: 'mātuḷam pōtu', meanings: ['the pomegranate bud'], note: 'போது = a bud not yet open, the standard comparison for Her complexion.' },
      { tamil: 'மலர்க் கமலை', translit: 'malark kamalai', meanings: ['the blossoming lotus', 'Kamala — Lakshmi of the lotus'], note: 'Genuinely double. Read as flower, it continues the list of red things; read as Kamala, it names a goddess.' },
      { tamil: 'துதிக்கின்ற மின்கொடி', translit: 'tutikkiṉṟa miṉkoṭi', meanings: ['the lightning-creeper that is praised'], note: 'மின்கொடி — "lightning vine", a slender flash. Used throughout Tamil poetry for a woman’s form.' },
      { tamil: 'மென் கடி குங்கும தோயம்', translit: 'meṉ kaṭi kuṅkuma tōyam', meanings: ['soft fragrant kumkuma paste'], note: 'கடி = fragrance; தோயம் = that which is wet, moistened.' },
      { tamil: 'என்ன', translit: 'eṉṉa', meanings: ['as if', 'such as to say'] },
      { tamil: 'விதிக்கின்ற மேனி', translit: 'vitikkiṉṟa mēṉi', meanings: ['the form thus ordained', 'the form so prescribed'] },
      { tamil: 'அபிராமி', translit: 'apirāmi', meanings: ['Abhirami'], note: 'The name means \u201cthe greatly beautiful\u201d. It arrives only in the last line, after seven images have failed to hold Her.' },
      { tamil: 'என்தன் விழித்துணையே', translit: 'eṉtaṉ viḻittuṇaiyē', meanings: ['the companion of my eyes', 'as dear to me as my own sight'], note: 'விழி + துணை. Not "support" in general: the support that seeing itself is.' }
    ],
    textualBasis:
      'The verse is a catalogue of light — sunrise, ruby, lightning — presented to ' +
      '"those who possess discernment" (உணர்வுடையோர்), and closes by making Her the ' +
      'faculty of sight itself rather than an object seen.',
    association: {
      label: 'True knowledge · Clear seeing',
      basis: 'text'
    },
    devotional:
      'Seven images, all of them red, all of them light. Bhattar is not describing ' +
      'Her appearance so much as refusing to settle on one comparison. Each image is ' +
      'abandoned for the next, and the verse ends by moving the whole thing inside ' +
      'the eye.',
    inner:
      'Note who is said to prize the ruby: not the rich, but those with உணர்வு. The ' +
      'verse quietly separates value from price. And the last word relocates ' +
      'everything — She is not what he looks at, She is what he looks with.',
    sriVidya:
      'The red of sunrise is the standard colour of Tripura Sundari, and "the rising ' +
      'sun" is how the Sahasranama itself opens its description of Her radiance. ' +
      'Reading விழித்துணை as the seer rather than the seen is an Advaitic move: the ' +
      'Mother as the light by which anything is known at all.',
    lesson:
      'Understanding something is usually described as getting a better look at it. ' +
      'This verse suggests the opposite direction — that what changes is the seeing, ' +
      'not the object.',
    lalitha: [
      { num: 6, iast: 'udyad-bhānu-sahasrābhā', meaning: 'She who has the radiance of a thousand rising suns',
        why: 'The same choice of image, and the same insistence on the rising sun rather than the risen one. Bhattar’s உதிக்கின்ற செங்கதிர் is this name in Tamil.' },
      { num: 248, iast: 'padma-rāga-samaprabhā', meaning: 'She who has a resplendent red complexion like the ruby',
        why: 'Bhattar’s மாணிக்கம், the ruby the discerning value, is the same comparison.' },
      { num: 993, iast: 'ajñāna-dhvānta-dīpikā', meaning: 'She who is the bright lamp that dispels the darkness of ignorance',
        why: 'Explains why a verse made entirely of light images is read as a verse about knowledge: the light is what removes not-knowing.' },
      { num: 549, iast: 'vidyā', meaning: 'She who is in the form of knowledge',
        why: 'The verse’s final turn — She is the sight, not the thing seen — is this name stated as an image.' }
    ],
    apply: [
      { when: 'Studying', what: 'The verse rewards attention to what you are looking with. Tiredness, resentment and hurry distort a subject more than difficulty does.' },
      { when: 'Judging worth', what: 'உணர்வுடையோர் மதிக்கின்ற — the ruby is valuable because the discerning value it. Worth is a judgement someone makes, and it is worth asking whose judgement you have adopted.' }
    ],
    parayana: 'The verse may be included in one’s regular Abhirami Anthadhi paaraayana or personal devotional practice.',
    sourceNotes: [
      'கமலை can be read as the common noun (lotus) or as the proper noun Kamala. Both readings are current; neither is a correction of the other.'
    ],
    confidence: 'high'
  },

  2: {
    theme: 'Refuge · Kinship · The Sri Vidya weapons',
    tags: ['relationships', 'srividya', 'protection', 'devotion'],
    english:
      'Our help; the god we worship; the mother who bore us. The trunk of the Vedas, ' +
      'their tender shoot, and the root that holds them in place. And resting in Her ' +
      'hands, the cool flower arrows, the sugarcane bow, the noose and the goad — we ' +
      'have come to know that all of this is Tripura Sundari.',
    words: [
      { tamil: 'துணையும்', translit: 'tuṇaiyum', meanings: ['the help', 'the companion', 'the second who makes a pair'] },
      { tamil: 'தொழும் தெய்வமும்', translit: 'toḻum teyvamum', meanings: ['the deity one worships'] },
      { tamil: 'பெற்ற தாயும்', translit: 'peṟṟa tāyum', meanings: ['the mother who bore me'], note: 'Specifically the birth-mother, not a mother-figure.' },
      { tamil: 'சுருதிகளின் பணையும்', translit: 'curutikaḷiṉ paṇaiyum', meanings: ['the trunk / bough of the srutis'] },
      { tamil: 'கொழுந்தும்', translit: 'koḻuntum', meanings: ['the tender shoot', 'the growing tip'] },
      { tamil: 'பதிகொண்ட வேரும்', translit: 'patikoṇṭa vērum', meanings: ['the root that has taken its place', 'the root that holds its ground'] },
      { tamil: 'பனிமலர்ப் பூங்கணையும்', translit: 'paṉimalarp pūṅkaṇaiyum', meanings: ['the cool flower arrows'], note: 'கணை = arrow. The five flower arrows of Tripura Sundari.' },
      { tamil: 'கருப்புச் சிலையும்', translit: 'karuppuc cilaiyum', meanings: ['the sugarcane bow'], note: 'கருப்பு here is கரும்பு, sugarcane — not the colour black.' },
      { tamil: 'பாசாங்குசமும்', translit: 'pācāṅkucamum', meanings: ['the noose and the goad'], note: 'A single compound: paasa + ankusa.' },
      { tamil: 'கையில் அணையும்', translit: 'kaiyil aṇaiyum', meanings: ['that rest in Her hands', 'that come to rest in the hand'], note: 'அணை is to lean against, to embrace — the weapons rest rather than are wielded.' },
      { tamil: 'திரிபுர சுந்தரி ஆவது', translit: 'tiripura cuntari āvatu', meanings: ['is Tripura Sundari'] },
      { tamil: 'அறிந்தனமே', translit: 'aṟintaṉamē', meanings: ['we have come to know'], note: 'First person plural, and past. Not "I believe" — "we found out".' }
    ],
    textualBasis:
      'The verse names the four Sri Vidya emblems explicitly — flower arrows, ' +
      'sugarcane bow, noose, goad — and places them in a list that begins with ' +
      'companion, deity and birth-mother. Refuge and iconography are stated in the ' +
      'same breath.',
    association: {
      label: 'Refuge · Family · Sri Vidya foundations',
      basis: 'text'
    },
    devotional:
      'The list moves outward in rings: what is nearest (help, worship, mother), then ' +
      'what is oldest (the Vedas, root to shoot), then what is most formal (the ' +
      'iconography). All three collapse into one name at the end.',
    inner:
      'Three relationships people usually keep separate — the one who helps you, the ' +
      'one you revere, the one who made you — are asserted to be a single person. ' +
      'Much of the emotional force of the Anthadhi comes from refusing that ' +
      'separation.',
    sriVidya:
      'This is the clearest Sri Vidya verse in the pilot set, and the four emblems ' +
      'carry settled meanings: the noose is attachment, the goad is aversion, the ' +
      'sugarcane bow is the mind, and the five flower arrows are the five subtle ' +
      'elements — the objects of the five senses. Read that way, everything in Her ' +
      'hands is a component of the ordinary human mind, held rather than destroyed. ' +
      'That She holds them loosely (அணையும்) is the point: these are not enemies ' +
      'She is fighting.',
    lesson:
      'The things that pull at you and the things that push you away are not ' +
      'intruders in your life. This image places them in the hands of the one you ' +
      'are praying to.',
    lalitha: [
      { num: 8, iast: 'rāga-svarūpa-pāśāḍhyā', meaning: 'She who is holding the rope of love in Her hand',
        why: 'Bhattar’s பாசம் named directly, and glossed: the noose IS attachment. The Tamil gives the object, the Sanskrit gives its meaning.' },
      { num: 9, iast: 'krodhākārāṅkuśojjvalā', meaning: 'She who shines, bearing the goad of anger',
        why: 'The அங்குசம் of the same compound, glossed as aversion.' },
      { num: 10, iast: 'mano-rūpekṣu-kodaṇḍā', meaning: 'She who holds in Her hand a sugarcane bow that represents the mind',
        why: 'Bhattar’s கருப்புச் சிலை. The Sahasranama supplies what the Tamil leaves implicit — the bow is the mind.' },
      { num: 11, iast: 'pañca-tanmātra-sāyakā', meaning: 'She who holds the five subtle elements as arrows',
        why: 'Bhattar’s பூங்கணை. Four emblems, four consecutive names: this is not keyword matching but the same iconographic set in two languages.' },
      { num: 338, iast: 'veda-jananī', meaning: 'She who is the mother of the vedas',
        why: 'The verse calls Her the trunk, shoot and root of the srutis — the Vedas as a plant She is, rather than a text She gave.' },
      { num: 234, iast: 'mahā-tripura-sundarī', meaning: 'She who is the great tripurasundari',
        why: 'The name the verse resolves into.' }
    ],
    apply: [
      { when: 'Feeling unsupported', what: 'The verse is worth sitting with when the people who should be help, authority and family are not the same people, or are absent.' },
      { when: 'Learning Sri Vidya iconography', what: 'Start here. Four emblems, four meanings, and a Tamil poem that lists them without explaining them — which is why the Sahasranama names are useful alongside.' }
    ],
    parayana: 'The verse may be included in one’s regular Abhirami Anthadhi paaraayana or personal devotional practice.',
    sourceNotes: [],
    confidence: 'high'
  },

  3: {
    theme: 'Discernment · Parting from harmful company',
    tags: ['knowledge', 'protection', 'mind', 'relationships'],
    english:
      'I have come to know the secret that no one knows — and knowing it, I pressed ' +
      'close to Your feet alone, Auspicious One. In dread I parted from those men of ' +
      'dark, deed-bound heart who think nothing of the greatness of those who love ' +
      'You, and who are kin to the hell they fall headlong into.',
    words: [
      { tamil: 'அறிந்தேன்', translit: 'aṟintēṉ', meanings: ['I have known'] },
      { tamil: 'எவரும் அறியா மறையை', translit: 'evarum aṟiyā maṟaiyai', meanings: ['the secret that no one knows', 'the Veda that none has known'], note: 'மறை is both "that which is hidden" and "the Veda". The pun is the verse.' },
      { tamil: 'அறிந்துகொண்டு', translit: 'aṟintukoṇṭu', meanings: ['having taken it in', 'having grasped it for myself'] },
      { tamil: 'செறிந்தேன்', translit: 'ceṟintēṉ', meanings: ['I pressed close', 'I became dense with / packed into'], note: 'செறி is physical closeness — crowding in, not merely approaching.' },
      { tamil: 'உனது திருவடிக்கே', translit: 'uṉatu tiruvaṭikkē', meanings: ['to Your sacred feet alone'], note: 'The -ē is exclusive: to those and nothing else.' },
      { tamil: 'திருவே', translit: 'tiruvē', meanings: ['O Auspicious One', 'O Sri / Lakshmi'] },
      { tamil: 'வெருவி', translit: 'veruvi', meanings: ['having taken fright', 'in dread'], note: 'A strong word. Not distaste — fear.' },
      { tamil: 'பிறிந்தேன்', translit: 'piṟintēṉ', meanings: ['I separated myself', 'I parted'] },
      { tamil: 'நின் அன்பர் பெருமை எண்ணாத', translit: 'niṉ aṉpar perumai eṇṇāta', meanings: ['who do not reckon the greatness of those who love You'] },
      { tamil: 'கரும நெஞ்சால்', translit: 'karuma neñcāl', meanings: ['with a deed-bound heart', 'with a black heart'], note: 'கருமம் = action/karma; கரும் = black. Both readings are live and the poem uses the ambiguity.' },
      { tamil: 'மறிந்தே விழும்', translit: 'maṟintē viḻum', meanings: ['who fall over and tumble down'], note: 'மறி = to turn over. The image is losing footing, not being pushed.' },
      { tamil: 'நரகுக்கு உறவாய மனிதரையே', translit: 'narakukku uṟavāya maṉitaraiyē', meanings: ['men who are kin to hell'], note: 'உறவு = kinship. They are not sent to hell; they are related to it.' }
    ],
    textualBasis:
      'The verse is built on a deliberate move away: அறிந்தேன் … செறிந்தேன் … ' +
      'பிறிந்தேன். Knowing, drawing close, and separating are three beats of one ' +
      'action, and what he separates from is named as company, not as sin.',
    association: {
      label: 'Harmful company · Discernment · Freedom from bondage',
      basis: 'text'
    },
    devotional:
      'The claim is audacious — he says he knows what nobody knows — and then ' +
      'immediately domesticates it: what he does with the secret is hold on tighter ' +
      'to Her feet. The knowledge does not make him a teacher. It makes him a ' +
      'dependent.',
    inner:
      'The verse understands something about habit that self-help language usually ' +
      'misses. He does not resolve to be better. He changes who he is near, and he ' +
      'does it out of fear rather than superiority. The people he leaves are not ' +
      'described as wicked but as unable to reckon worth — they cannot see what is ' +
      'great in someone who loves.',
    sriVidya:
      'மறை as "the hidden" is the ordinary word for an initiatory secret, and the ' +
      'verse’s structure — receive, cling, withdraw from unsuitable company — ' +
      'matches the plain etiquette of any mantra discipline. Reading anything more ' +
      'specific into it would be speculation.',
    lesson:
      'Turning away from a habit is usually turning away from a room, a group, a ' +
      'time of day. The verse is honest that this is done in fear, and that fear is ' +
      'not a disgraceful reason.',
    lalitha: [
      { num: 354, iast: 'paśu-pāśa-vimocinī', meaning: 'She who releases the ignorant from bondage',
        why: 'The verse’s "freedom from bondage" reading rests here: what binds is described as a condition of not-seeing, exactly the கரும நெஞ்சு that cannot reckon greatness.' },
      { num: 546, iast: 'bandha-mocanī', meaning: 'She who gives release from bondage',
        why: 'The release in the verse is enacted socially — he leaves — which is what makes the Sanskrit abstraction concrete.' },
      { num: 402, iast: "vidyā-'vidyā-svarūpiṇī", meaning: 'She who is the form of both knowledge and ignorance',
        why: 'The verse sets a secret that none knows against hearts that cannot reckon. Both states are Hers, which is why the poet claims no credit for having the first.' }
    ],
    apply: [
      { when: 'Breaking a habit', what: 'Change proximity before changing resolve. The verse treats distance as the action, not as the result.' },
      { when: 'Around people who diminish you', what: 'The test the verse uses is specific and useful: can they recognise worth in someone who cares about something? If not, that is information.' }
    ],
    parayana: 'The verse may be included in one’s regular Abhirami Anthadhi paaraayana or personal devotional practice.',
    sourceNotes: [
      'கரும நெஞ்சு is read both as "black-hearted" and as "karma-bound". The translation above keeps both because the poem appears to want both.'
    ],
    confidence: 'high'
  },

  4: {
    theme: 'Standing · Recognition · Daily presence',
    tags: ['career', 'devotion'],
    english:
      'Tender One, at whose red feet humans, gods and undying sages come and bend ' +
      'their heads: may You — and the Pure One who bears on His long matted locks the ' +
      'konrai, the cool moon, the serpent and Bhagirathi — abide in my mind every day ' +
      'of my life.',
    words: [
      { tamil: 'மனிதரும் தேவரும்', translit: 'maṉitarum tēvarum', meanings: ['humans and gods'] },
      { tamil: 'மாயா முனிவரும்', translit: 'māyā muṉivarum', meanings: ['sages who do not perish'], note: 'மாயா = not-dying (மாய், to perish, negated). Not the Sanskrit māyā, illusion.' },
      { tamil: 'வந்து சென்னி குனிதரும்', translit: 'vantu ceṉṉi kuṉitarum', meanings: ['come and bend their heads'] },
      { tamil: 'சேவடிக் கோமளமே', translit: 'cēvaṭik kōmaḷamē', meanings: ['O tender one of the red feet'], note: 'கோமளம் = tender, delicate. The contrast with the crowd of worshippers is deliberate.' },
      { tamil: 'கொன்றை வார் சடைமேல்', translit: 'koṉṟai vār caṭaimēl', meanings: ['on the long matted locks bearing konrai'] },
      { tamil: 'பனிதரும் திங்களும்', translit: 'paṉitarum tiṅkaḷum', meanings: ['the moon that gives coolness'] },
      { tamil: 'பாம்பும்', translit: 'pāmpum', meanings: ['and the serpent'] },
      { tamil: 'பகீரதியும்', translit: 'pakīratiyum', meanings: ['and Bhagirathi — the Ganga'] },
      { tamil: 'படைத்த புனிதரும்', translit: 'paṭaitta puṉitarum', meanings: ['the Pure One who bears them', 'the Pure One who created them'], note: 'படை is both "to create" and "to bear / be furnished with".' },
      { tamil: 'நீயும்', translit: 'nīyum', meanings: ['and You'] },
      { tamil: 'என் புந்தி', translit: 'eṉ punti', meanings: ['my understanding', 'my buddhi'] },
      { tamil: 'எந்நாளும் பொருந்துகவே', translit: 'ennāḷum poruntukavē', meanings: ['may it fit, may it join, all days'], note: 'பொருந்து = to fit together, to be suited. An optative — "may it be so".' }
    ],
    textualBasis:
      'The verse opens on universal recognition — humans, gods and sages bowing — but ' +
      'the petition at the end is not for the poet’s own elevation. He asks only ' +
      'that the two of Them fit into his understanding, every day.',
    association: {
      label: 'Recognition · Higher responsibility',
      basis: 'text'
    },
    devotional:
      'Three tiers of being converge on one pair of feet, and the feet are described ' +
      'as tender. Bhattar keeps doing this: the more universal the claim, the more ' +
      'domestic the adjective.',
    inner:
      'Here is the honest reading, and it cuts against the easy one. The verse is ' +
      'saturated with status — who bows to whom, who wears what on his head — and ' +
      'then asks for none of it. What is wanted is daily company, not promotion.',
    sriVidya:
      'The pairing at the end — You, and the Pure One — is the Siva-Sakti aikyam that ' +
      'the Anthadhi returns to repeatedly. Note that the poet asks for both together ' +
      'to abide in the buddhi. The seat of the request is the intellect, not the ' +
      'heart.',
    lesson:
      'The verse is a corrective for anyone praying about their career. Everything ' +
      'that could be envied is in the first three lines; the thing actually asked for ' +
      'is in the last. Recognition is described, not requested.',
    lalitha: [
      { num: 64, iast: 'devarṣi-gaṇa-saṅghāta-stūyamānātma-vaibhavā', meaning: 'She whose might is the subject of praise by multitudes of gods and sages',
        why: 'The same crowd of worshippers — gods and sages — in the same posture. Bhattar adds humans to the list.' },
      { num: 688, iast: 'rāja-pīṭha-niveśita-nijāśritā', meaning: 'She who establishes on royal thrones those who take refuge in Her',
        why: 'Why later practice associates this verse with position and standing. The connection is to the Sanskrit name, not to anything the Tamil promises — worth keeping distinct.' },
      { num: 687, iast: 'rājatkṛpā', meaning: 'She who has a compassion that captivates everyone',
        why: 'The verse’s "tender feet that everyone bows to" is this: authority experienced as gentleness.' }
    ],
    apply: [
      { when: 'Wanting recognition', what: 'Read the verse’s own order. It lets you look hard at status for three lines and then asks for something else entirely.' },
      { when: 'Carrying a heavy role', what: 'The request is for the thing to fit — பொருந்துக — in the understanding. Roles fail more often from not being thought through than from lack of effort.' }
    ],
    parayana: 'The verse may be included in one’s regular Abhirami Anthadhi paaraayana or personal devotional practice.',
    sourceNotes: [
      'Devotional lists circulating online associate this verse with attaining higher position. The Tamil supports "recognition" as a described scene, not as a promised outcome; the distinction is preserved above.'
    ],
    confidence: 'medium'
  },

  5: {
    theme: 'Manonmani · Poison turned to nectar',
    tags: ['mind', 'health', 'srividya', 'protection'],
    english:
      'Tripura, who fits close within; Manonmani, whose slender creeper waist is ' +
      'wearied by what it carries; Ambika, who turned the poison the matted-haired ' +
      'Lord swallowed into nectar; Sundari, perfected upon the lotus — Antari: Her ' +
      'feet are on my head.',
    words: [
      { tamil: 'பொருந்திய முப்புரை', translit: 'poruntiya muppurai', meanings: ['Tripura who fits / is joined', 'She of the three cities, closely united'], note: 'முப்புரை = She of the three puras. பொருந்திய is the same verb the poet uses in verse 4 for what he wants in his own mind.' },
      { tamil: 'செப்பு உரை செய்யும்', translit: 'ceppu urai ceyyum', meanings: ['that rival the golden casket', 'that speak of / declare the ceppu'], note: 'செப்பு is a rounded casket; the comparison is conventional. உரை செய் can be "to rival" or "to tell of".' },
      { tamil: 'புணர் முலையால்', translit: 'puṇar mulaiyāl', meanings: ['by the paired breasts'] },
      { tamil: 'வருந்திய', translit: 'varuntiya', meanings: ['wearied', 'suffering', 'made to labour'] },
      { tamil: 'வஞ்சி மருங்குல்', translit: 'vañci maruṅkul', meanings: ['a waist like the vanji creeper'], note: 'வஞ்சி is the slender rattan creeper, the standard Tamil comparison for a narrow waist.' },
      { tamil: 'மனோன்மணி', translit: 'maṉōṉmaṇi', meanings: ['Manonmani'], note: 'Literally the one who lifts / elates the mind (manas + unmani). A Saiva-Sakta name of high standing.' },
      { tamil: 'வார் சடையோன் அருந்திய நஞ்சு', translit: 'vār caṭaiyōṉ aruntiya nañcu', meanings: ['the poison the long-matted-haired one drank'], note: 'The halahala of the churning of the ocean.' },
      { tamil: 'அமுதாக்கிய அம்பிகை', translit: 'amutākkiya ampikai', meanings: ['Ambika who made it nectar'], note: 'Not "who neutralised it" — who converted it into அமுதம், the deathless nectar.' },
      { tamil: 'அம்புயமேல் திருந்திய சுந்தரி', translit: 'ampuyamēl tiruntiya cuntari', meanings: ['Sundari perfected upon the lotus'], note: 'திருந்து = to be corrected, refined, brought to rightness.' },
      { tamil: 'அந்தரி', translit: 'antari', meanings: ['Antari — She of the sky / the intervening space', 'the inner one'], note: 'அந்தரம் is both the sky and the interval or interior.' },
      { tamil: 'பாதம் என் சென்னியதே', translit: 'pātam eṉ ceṉṉiyatē', meanings: ['Her feet are upon my head'] }
    ],
    textualBasis:
      'The central image is explicit: அமுதாக்கிய — She made it nectar. The verse also ' +
      'says plainly that She is wearied (வருந்திய) by what She carries. Both are ' +
      'stated, not inferred.',
    association: {
      label: 'Distress · Endurance · Emotional resilience',
      basis: 'text'
    },
    devotional:
      'Four names in four lines, each from a different register — Tripura from Sri ' +
      'Vidya, Manonmani from Saiva Agama, Ambika from Puranic narrative, Antari from ' +
      'the older Sakta stratum — and then, abruptly, a body: Her feet on his head.',
    inner:
      'The poison is the one detail worth staying with. In the story Siva holds it in ' +
      'his throat; here She does something else with it. The verse does not say the ' +
      'poison was removed, or that it was never really poison. It says it was turned ' +
      'into the thing that makes one deathless. That is a different and harder claim ' +
      'than consolation.',
    sriVidya:
      'Manonmani is the state at the upper limit of the mind, where manas gives out; ' +
      'the Sahasranama uses the same name for Siva’s Sakti. Placing Her feet on ' +
      'the head in the same verse is consistent with the sahasrara imagery of ' +
      'Kundalini practice, though the verse itself makes no yogic statement, and it ' +
      'would be an overreach to read one in.',
    lesson:
      'The prayer is not asking anyone to pretend the poison was not poison. It moves ' +
      'the question from "why did I have to swallow this" to "what is it becoming in ' +
      'me".',
    lalitha: [
      { num: 207, iast: 'manonmanī', meaning: "She who is shiva's shakti",
        why: 'The same name, in the same theological position. Bhattar drops it into Tamil without translation because it needed none.' },
      { num: 84, iast: 'hara-netrāgni-sandagdha-kāma-sañjīvanauṣadhiḥ', meaning: 'She who became the life-giving medicine for Kamadeva, burnt to ashes by the fire of Siva’s eye',
        why: 'The identical structural move: what Siva’s power destroys, She converts back into life. Poison into nectar, ashes into a living man.' },
      { num: 326, iast: 'karuṇā-rasa-sāgarā', meaning: 'She who is the ocean of compassion',
        why: 'The ocean that was churned for the poison is the ocean the Sanskrit name makes Her. The two images sit on top of each other.' },
      { num: 234, iast: 'mahā-tripura-sundarī', meaning: 'She who is the great tripurasundari',
        why: 'முப்புரை and சுந்தரி, both in this verse, are the two halves of this name.' }
    ],
    apply: [
      { when: 'In a hard stretch that will not end', what: 'The verse offers endurance rather than rescue, and is honest that the one carrying the weight is wearied by it.' },
      { when: 'Sitting with something bitter', what: 'Use it as a question rather than a comfort: what is this turning into? That is answerable over months, not minutes.' }
    ],
    parayana: 'The verse may be included in one’s regular Abhirami Anthadhi paaraayana or personal devotional practice.',
    sourceNotes: [
      'செப்புரை is printed both as one word and as செப்பு உரை. The reading does not change the sense materially.'
    ],
    confidence: 'high'
  },

  6: {
    theme: 'Mantra · Order · Practice with others',
    tags: ['devotion', 'mind', 'knowledge', 'srividya'],
    english:
      'On my head, Your golden lotus foot. Settled in my mind, Your sacred mantra. ' +
      'Lady of vermilion: joining the devotees who went before me, what I have ' +
      'recited, in order and again in order, has always been the ordered path of Your ' +
      'supreme Agama.',
    words: [
      { tamil: 'சென்னியது', translit: 'ceṉṉiyatu', meanings: ['what is on my head'] },
      { tamil: 'உன் பொன் திருவடித் தாமரை', translit: 'uṉ poṉ tiruvaṭit tāmarai', meanings: ['Your golden lotus foot'] },
      { tamil: 'சிந்தையுள்ளே மன்னியது', translit: 'cintaiyuḷḷē maṉṉiyatu', meanings: ['what has settled / reigned within my mind'], note: 'மன்னு = to be established, to endure, to reign. Not merely "to be present".' },
      { tamil: 'உன் திருமந்திரம்', translit: 'uṉ tirumantiram', meanings: ['Your sacred mantra'] },
      { tamil: 'சிந்துர வண்ணப் பெண்ணே', translit: 'cintura vaṇṇap peṇṇē', meanings: ['O Lady of vermilion hue'] },
      { tamil: 'முன்னிய நின் அடியாருடன் கூடி', translit: 'muṉṉiya niṉ aṭiyāruṭaṉ kūṭi', meanings: ['joining with Your devotees who came before'], note: 'முன்னிய = prior, preceding — the lineage, not a crowd.' },
      { tamil: 'முறைமுறையே', translit: 'muṟaimuṟaiyē', meanings: ['in order, in order', 'stage by stage, in the prescribed sequence'], note: 'The doubling is emphatic: the order itself, kept repeatedly.' },
      { tamil: 'பன்னியது', translit: 'paṉṉiyatu', meanings: ['what I have recited', 'what I have expounded / gone over'] },
      { tamil: 'என்றும்', translit: 'eṉṟum', meanings: ['always'] },
      { tamil: 'உன்தன் பரம ஆகம பத்ததியே', translit: 'uṉtaṉ parama ākama pattatiyē', meanings: ['the paddhati of Your supreme Agama'], note: 'பத்ததி / paddhati is a manual that sets out ritual in its correct sequence. A technical word, chosen deliberately.' }
    ],
    textualBasis:
      'Three things are placed in three positions: the foot on the head, the mantra ' +
      'in the mind, the paddhati on the tongue. The vocabulary — திருமந்திரம், ' +
      'ஆகமம், பத்ததி, முறைமுறையே — is the vocabulary of formal practice, not of ' +
      'general piety.',
    association: {
      label: 'Mantra discipline · Concentration · Steady practice',
      basis: 'text'
    },
    devotional:
      'The verse is a report rather than a request — the only one in this pilot set ' +
      'that asks for nothing. Bhattar is telling Her what his practice has actually ' +
      'consisted of.',
    inner:
      'Two details do the work. First, the practice was done with others, and ' +
      'specifically with those who went before — the discipline is inherited, not ' +
      'invented. Second, முறைமுறையே: the order was kept, and kept again. The verse ' +
      'locates devotion in sequence and repetition rather than in intensity.',
    sriVidya:
      'ஆகமம் and பத்ததி are the ordinary terms for the Sakta ritual manuals, and ' +
      'திருமந்திரம் in a Sakta context most naturally means the received mantra of ' +
      'one’s initiation. The verse assumes a lineage and a fixed procedure. What ' +
      'it does not do — and no honest reading should make it do — is disclose which ' +
      'mantra.',
    lesson:
      'Practice is mostly sequence. What the verse credits is not fervour but having ' +
      'kept the order, with people who kept it before you.',
    lalitha: [
      { num: 204, iast: 'sarva-mantra-svarūpiṇī', meaning: 'She who is the essence of all the mantras',
        why: 'Bhattar says Her mantra has settled in his mind. This name is why that is not a small claim: the mantra is not about Her, it is Her.' },
      { num: 846, iast: 'mantra-sārā', meaning: 'She who is the essence of all mantras',
        why: 'The same point from the other direction, and the reason the verse can move from mantra to Agama to paddhati without changing subject.' },
      { num: 585, iast: 'śrī-vidyā', meaning: 'She who is sacred knowledge',
        why: 'The named discipline the verse’s technical vocabulary belongs to.' },
      { num: 489, iast: 'akṣamālādi-dharā', meaning: 'She who wears garlands of rudraksha beads and other things',
        why: 'The iconography of repetition. A rosary is an instrument for keeping count, which is exactly what முறைமுறையே describes.' }
    ],
    apply: [
      { when: 'Building a practice', what: 'Fix the order and the time before fixing the duration. The verse’s pride is in sequence kept, not in hours logged.' },
      { when: 'Practising alone', what: 'The verse assumes company — those who went before. A lineage, a teacher, or simply other people doing the same thing is treated as part of the method.' },
      { when: 'Before an examination or an interview', what: 'The verse is about rehearsal in order, which is a fair description of preparation. Prayer may settle the mind; the study remains the tapas.' }
    ],
    parayana: 'The verse may be included in one’s regular Abhirami Anthadhi paaraayana or personal devotional practice.',
    sourceNotes: [],
    confidence: 'high'
  },

  7: {
    theme: 'The churning mind · Refuge that does not flag',
    tags: ['mind', 'protection', 'devotion'],
    english:
      'My soul spins like the staff set churning in curd. See to it — think it into ' +
      'being — that it reaches a refuge which does not flag. Sundari of the vermilion ' +
      'face, whose red feet the lotus-dwelling Brahma, the moon-crested Lord and ' +
      'Vishnu bow to and praise without end.',
    words: [
      { tamil: 'ததி உறு மத்திற்', translit: 'tati uṟu mattiṟ', meanings: ['by the churning-staff set in curd'], note: 'ததி = curd; மத்து = the wooden churn. A kitchen image, not a cosmic one — though the churning of the ocean stands behind it.' },
      { tamil: 'சுழலும்', translit: 'cuḻalum', meanings: ['that whirls', 'that spins round and round'], note: 'சுழல் is rotation without progress. The word carries no direction.' },
      { tamil: 'என் ஆவி', translit: 'eṉ āvi', meanings: ['my life-breath', 'my soul'], note: 'ஆவி is the breath-soul, closer to "the life in me" than to a philosophical atman.' },
      { tamil: 'தளர்வு இலது ஓர்', translit: 'taḷarvu ilatu ōr', meanings: ['one that has no flagging', 'that does not slacken or grow faint'] },
      { tamil: 'கதி உறு வண்ணம்', translit: 'kati uṟu vaṇṇam', meanings: ['in such a way that it attains a refuge', 'so as to reach a state / a going'], note: 'கதி is both refuge and destination — where one arrives and where one rests.' },
      { tamil: 'கருது கண்டாய்', translit: 'karutu kaṇṭāy', meanings: ['consider it! see to it!', 'think it — mark You'], note: 'கருது is to think or intend. He asks Her to think it, not to do it: for Her, thinking is doing.' },
      { tamil: 'கமலாலயனும்', translit: 'kamalālayaṉum', meanings: ['Brahma, whose dwelling is the lotus'] },
      { tamil: 'மதி உறு வேணி மகிழ்நனும்', translit: 'mati uṟu vēṇi makiḻnaṉum', meanings: ['the husband whose matted hair holds the moon'], note: 'மகிழ்நன் = husband, literally "the one who delights".' },
      { tamil: 'மாலும்', translit: 'mālum', meanings: ['and Vishnu'] },
      { tamil: 'வணங்கி என்றும் துதி உறு சேவடியாய்', translit: 'vaṇaṅki eṉṟum tuti uṟu cēvaṭiyāy', meanings: ['O You whose red feet they bow to and praise always'] },
      { tamil: 'சிந்துரானன சுந்தரியே', translit: 'cinturāṉaṉa cuntariyē', meanings: ['O Sundari of the vermilion face'] }
    ],
    textualBasis:
      'The verse states the condition and the request in its own words: சுழலும் என் ' +
      'ஆவி — my whirling soul — and தளர்வு இலது ஓர் கதி, a refuge that does not ' +
      'flag. No inference is needed.',
    association: {
      label: 'Worry · Anxiety · A mind that will not settle',
      basis: 'text'
    },
    devotional:
      'He does not ask for the churning to stop. He asks that the thing being churned ' +
      'arrive somewhere. And the verb he uses of Her is கருது — think of it — as ' +
      'though Her attention were itself sufficient.',
    inner:
      'This is the most precise description of anxiety in the pilot set, and its ' +
      'precision is in the image: rotation without travel. Effort is not lacking. ' +
      'The churn is working hard. What is lacking is arrival. The verse also knows ' +
      'that the churn is what makes butter, which is why it does not ask for the ' +
      'motion to end.',
    sriVidya:
      'The churning of the ocean is the obvious background — the same event that ' +
      'produced both the poison of verse 5 and the nectar. Beyond that resonance the ' +
      'verse makes no technical claim, and reading a specific practice into it would ' +
      'be invention.',
    lesson:
      'Anxiety is not usually a failure of effort. The verse asks for a floor to land ' +
      'on rather than for the spinning to stop, which is both more modest and more ' +
      'achievable.',
    lalitha: [
      { num: 160, iast: 'niś-cintā', meaning: 'She who has no anxiety in anything',
        why: 'The exact counter-state to சுழலும் ஆவி. The verse asks to be given what this name says She is.' },
      { num: 447, iast: 'śāntiḥ', meaning: 'She who is tranquility itself',
        why: 'The refuge asked for is not a place but a quality, which is how the Sahasranama treats peace — as Her, not as somewhere She sends you.' },
      { num: 372, iast: 'bhakta-mānasa-haṃsikā', meaning: 'She who is the swan in the minds of Her devotees',
        why: 'Both images put Her inside the devotee’s mind rather than outside it — the swan on the water that is being churned.' },
      { num: 747, iast: 'bhakta-citta-keki-ghanāghanā', meaning: 'She who is the cloud that gladdens the peacocks who are the hearts of Her devotees',
        why: 'The relief in both is something that arrives from outside the mind’s own effort. The peacock does not make the rain.' }
    ],
    apply: [
      { when: 'Anxious and unable to stop', what: 'The verse does not ask for the thoughts to stop, which is usually impossible. It asks for a resting point, which is not.' },
      { when: 'Alongside treatment', what: 'Recitation is prayer and steadiness. Where anxiety is severe or persistent, it is also a medical matter, and the verse does not stand in for care.' },
      { when: 'Late at night', what: 'The image is worth holding precisely because it is domestic. A churn in a kitchen is not a catastrophe, and neither, usually, is the night.' }
    ],
    parayana: 'The verse may be included in one’s regular Abhirami Anthadhi paaraayana or personal devotional practice.',
    sourceNotes: [],
    confidence: 'high'
  },

  10: {
    theme: 'Continuous remembrance · The unwritten Veda',
    tags: ['devotion', 'knowledge', 'liberation', 'mind'],
    english:
      'Standing, sitting, lying down, walking — what I think of is You. What I bow to, ' +
      'always, is Your flower-feet. Rare meaning that is one with the unwritten Veda; ' +
      'Grace itself; Uma, born that day on the Himalaya; undying bliss of liberation.',
    words: [
      { tamil: 'நின்றும், இருந்தும், கிடந்தும், நடந்தும்', translit: 'niṉṟum, iruntum, kiṭantum, naṭantum', meanings: ['standing, sitting, lying, walking'], note: 'The four classical postures of a body across a whole day. The list is exhaustive by design.' },
      { tamil: 'நினைப்பது உன்னை', translit: 'niṉaippatu uṉṉai', meanings: ['what I think of is You'] },
      { tamil: 'என்றும் வணங்குவது', translit: 'eṉṟum vaṇaṅkuvatu', meanings: ['what I always bow to'] },
      { tamil: 'உன் மலர்த் தாள்', translit: 'uṉ malart tāḷ', meanings: ['Your flower-feet'] },
      { tamil: 'எழுதா மறையின்', translit: 'eḻutā maṟaiyiṉ', meanings: ['of the unwritten Veda'], note: 'எழுதா = not written. The Veda as sruti, heard and carried, never inscribed.' },
      { tamil: 'ஒன்றும் அரும் பொருளே', translit: 'oṉṟum arum poruḷē', meanings: ['O rare meaning that is one with it', 'O rare substance that unites'], note: 'பொருள் is both "meaning" and "substance / wealth". In a verse about scripture, "meaning" leads.' },
      { tamil: 'அருளே', translit: 'aruḷē', meanings: ['O Grace itself'], note: 'Not "gracious one" — grace, as a noun, addressed directly.' },
      { tamil: 'உமையே', translit: 'umaiyē', meanings: ['O Uma'] },
      { tamil: 'இமயத்து அன்றும் பிறந்தவளே', translit: 'imayattu aṉṟum piṟantavaḷē', meanings: ['who was born that day on the Himalaya'], note: 'அன்று — that day. A specific occasion, set against the timelessness of the previous line.' },
      { tamil: 'அழியா முத்தி ஆனந்தமே', translit: 'aḻiyā mutti āṉantamē', meanings: ['O undying bliss of liberation'] }
    ],
    textualBasis:
      'The verse names mukti explicitly (முத்தி) and grounds it not in withdrawal ' +
      'but in the four ordinary postures of a day. Liberation and standing, sitting, ' +
      'lying and walking are put in the same sentence.',
    association: {
      label: 'Constant remembrance · Liberation · Concentration',
      basis: 'text'
    },
    devotional:
      'The second half is a chain of vocatives that climbs — meaning, grace, a named ' +
      'woman, undying bliss — and the climb works only because the first half is so ' +
      'ordinary. He earns the abstractions with the postures.',
    inner:
      'The verse’s quiet argument is that continuity beats intensity. Nothing here ' +
      'is heroic. There is no vigil, no fast, no renunciation — only the observation ' +
      'that whatever position the body happens to be in, the mind has gone the same ' +
      'way.',
    sriVidya:
      'Calling Her the rare meaning that is one with the unwritten Veda is an ' +
      'Advaitic identification: not the author of scripture nor its subject, but its ' +
      'sense. Set beside "born that day on the Himalaya", the verse holds the ' +
      'formless and the particular together without resolving the tension — which is ' +
      'the characteristic Sakta position rather than a contradiction to be tidied.',
    lesson:
      'A practice that only exists at the shrine is a practice with a location. This ' +
      'verse describes one that has stopped having a location.',
    lalitha: [
      { num: 625, iast: 'kaivalya-pada-dāyinī', meaning: 'She who bestows liberation',
        why: 'Bhattar’s அழியா முத்தி ஆனந்தம், with the difference that the Tamil addresses Her AS the bliss rather than as its giver.' },
      { num: 338, iast: 'veda-jananī', meaning: 'She who is the mother of the vedas',
        why: 'The Sanskrit makes Her the Veda’s mother; the Tamil makes Her its meaning. Worth noticing that these are different claims.' },
      { num: 992, iast: 'avyāja-karuṇā-mūrtiḥ', meaning: 'She who is pure, motiveless compassion',
        why: 'அருளே — grace addressed as a noun. Both refuse to treat compassion as something She has rather than something She is.' },
      { num: 390, iast: 'nirvāṇa sukha-dāyinī', meaning: 'She who confers the bliss of Liberation',
        why: 'The closing vocative of the verse, name for name.' }
    ],
    apply: [
      { when: 'Trying to be consistent', what: 'The verse measures practice by the four postures of an ordinary day, which is a more useful audit than counting sessions.' },
      { when: 'Distracted', what: 'It does not ask for a cleared mind. It asks what the mind goes to when nothing is asked of it — a question you can answer honestly.' }
    ],
    parayana: 'The verse may be included in one’s regular Abhirami Anthadhi paaraayana or personal devotional practice.',
    sourceNotes: [],
    confidence: 'high'
  },

  24: {
    theme: 'Affliction and its remedy · Refuge',
    tags: ['health', 'devotion', 'protection', 'liberation'],
    flagship: true,
    english:
      'Gem — and the light inside the gem. Ornament set with shining gems — and the ' +
      'beauty the ornament itself borrows. To those who will not come near, You are ' +
      'the affliction; to affliction, You are the medicine. To the deathless ones, ' +
      'You are a great feast. Having once bowed at Your lotus feet, I will bow to no ' +
      'one else.',
    words: [
      { tamil: 'மணியே', translit: 'maṇiyē', meanings: ['O gem', 'O precious stone', 'O bell'], note: 'மணி carries all three senses in Tamil. Here the following line fixes it as the jewel.' },
      { tamil: 'மணியின் ஒளியே', translit: 'maṇiyiṉ oḷiyē', meanings: ['O radiance of the gem'], note: 'Not the gem’s reflection — the light the gem itself gives out. She is the stone and what makes it worth having.' },
      { tamil: 'ஒளிரும்', translit: 'oḷirum', meanings: ['shining', 'that gives light'] },
      { tamil: 'மணி புனைந்த அணியே', translit: 'maṇi puṉainta aṇiyē', meanings: ['O ornament wrought with gems'], note: 'புனை = to fashion, to compose, also to wear. The same verb is used of composing poetry.' },
      { tamil: 'அணியும் அணிக்கு அழகே', translit: 'aṇiyum aṇikku aḻakē', meanings: ['O beauty of the ornament that adorns'], note: 'The third turn of the same screw: the jewel, its light, the ornament, and now the beauty the ornament only borrows.' },
      { tamil: 'அணுகாதவர்க்கு', translit: 'aṇukātavarkku', meanings: ['to those who do not draw near'], note: 'அணுகு = to approach. Note the echo with அணி in the line before — the poem is playing on the sound.' },
      { tamil: 'பிணியே', translit: 'piṇiyē', meanings: ['O affliction', 'O disease', 'O that which binds'], note: 'பிணி is a noun for sickness and a verb meaning to bind or tie. Both senses are alive here.' },
      { tamil: 'பிணிக்கு மருந்தே', translit: 'piṇikku maruntē', meanings: ['O medicine for affliction'] },
      { lemma: true, tamil: 'மருந்து', translit: 'maruntu', meanings: ['medicine, remedy', 'that which removes an affliction', 'in older usage, the nectar of immortality'], note: 'The third sense matters: அமுதம் is called மருந்து in Tamil devotional poetry, which is why the next phrase turns to the deathless ones.' },
      { tamil: 'அமரர்', translit: 'amarar', meanings: ['the immortals', 'the devas'], note: 'Literally "the undying". Placed immediately after "medicine", the joke is deliberate.' },
      { tamil: 'பெருவிருந்தே', translit: 'peruviruntē', meanings: ['O great feast'], note: 'விருந்து is a feast given to a guest — hospitality, not mere food.' },
      { tamil: 'பணியேன்', translit: 'paṇiyēṉ', meanings: ['I will not bow', 'I do not serve'], note: 'First person negative. A vow, not a description.' },
      { tamil: 'ஒருவரை', translit: 'oruvarai', meanings: ['to any one person'] },
      { tamil: 'நின் பத்மபாதம்', translit: 'niṉ patmapātam', meanings: ['Your lotus feet'], note: 'Sanskrit padma-pāda carried into Tamil unchanged.' },
      { tamil: 'பணிந்தபின்னே', translit: 'paṇintapiṉṉē', meanings: ['after having bowed'], note: 'The same verb as பணியேன், used positively. Having bowed once, he will not bow again — the pun is the point of the verse.' }
    ],
    textualBasis:
      'This verse carries its association in its own words. பிணிக்கு மருந்தே — ' +
      '"medicine for affliction" — is stated outright, and பிணி is the ordinary Tamil ' +
      'word for disease. The later devotional association with health is therefore ' +
      'intelligible directly from the text, which is not true of every verse given a ' +
      'purpose in circulating lists.',
    association: {
      label: 'Health · Relief from illness',
      basis: 'text',
      note:
        'Traditional devotional association, supported by the verse’s own words. ' +
        'It is not a claim that recitation treats disease.'
    },
    devotional:
      'The first two lines are a single figure repeated until it turns transparent: ' +
      'gem, then the gem’s light; ornament, then the beauty the ornament only ' +
      'borrows. Each time, Bhattar moves from the object to what the object depends ' +
      'on. By the time he reaches affliction and medicine, the habit is established, ' +
      'and the reader supplies the logic without being told.',
    inner:
      'The hard line is the one people skip: அணுகாதவர்க்குப் பிணியே — to those who ' +
      'do not come near, You are the affliction itself. Bhattar is not saying She ' +
      'punishes the distant. He is saying the distance IS the disease. Which makes ' +
      'the next phrase not a second thought but the same thought: the remedy for ' +
      'being far away is not a substance, it is proximity.',
    sriVidya:
      'மருந்து as both medicine and the deathless nectar is what links this verse to ' +
      'the amrita imagery running through the Anthadhi, and it is why the immortals ' +
      'arrive in the next breath: they are the ones who already ate the medicine. ' +
      'Read within Sri Vidya, She is not the cure applied to a condition but the ' +
      'ground on which condition and sufferer both stand — which is also why the ' +
      'verse ends with an exclusive vow rather than a request for healing.',
    lesson:
      'The prayer is not asking anyone to pretend that pain does not exist. It moves ' +
      'the mind from "why is this happening to me" toward "where is my refuge while ' +
      'I face it". Those are different questions, and only the second one has an ' +
      'answer available today.',
    lalitha: [
      { num: 551, iast: 'sarva-vyādhi-praśamanī', meaning: 'She who removes all diseases and sorrows',
        why: 'The closest name in the Sahasranama to பிணிக்கு மருந்தே, and the reason both texts get read together on this subject. Note that praśamanī is "she who pacifies", not "she who cures" — the Sanskrit is as careful as the Tamil.' },
      { num: 84, iast: 'hara-netrāgni-sandagdha-kāma-sañjīvanauṣadhiḥ', meaning: 'She who became the life-giving medicine for Kamadeva, burnt by the fire of Siva’s eye',
        why: 'The only other place either text calls Her, flatly, a medicine — auṣadhi. The Tamil மருந்து and this name are doing the same work.' },
      { num: 552, iast: 'sarva-mṛtyu-nivāriṇī', meaning: 'She who guards Her devotees from all death',
        why: 'Immediately follows 551 in the Sahasranama, exactly as the immortals follow the medicine in this verse. The sequence of ideas is the same in both.' },
      { num: 811, iast: 'pāśa-hantrī', meaning: 'She who destroys the bonds',
        why: 'Reaches the other sense of பிணி — that which binds. If affliction is a tie, the remedy is a cutting, and this name supplies it.' },
      { num: 669, iast: 'anna-dā', meaning: 'She who is the giver of food to all living things',
        why: 'பெருவிருந்தே, the great feast. Bhattar makes Her the feast; the Sahasranama makes Her the giver of it.' }
    ],
    apply: [
      { when: 'During illness', what: 'Use the verse as prayer, steadiness and surrender alongside appropriate medical care. The tradition that turns to this verse in sickness has never proposed it as a substitute for treatment.' },
      { when: 'Caring for someone ill', what: 'The verse is arguably more useful to the carer than to the patient. Its subject is what to do with fear during a long illness, which is the carer’s problem.' },
      { when: 'When the difficulty will not name itself', what: 'அணுகாதவர்க்குப் பிணியே is worth sitting with when nothing is diagnosably wrong and something is clearly wrong.' }
    ],
    parayana:
      'This is among the verses most often recited by devotees facing illness. ' +
      'Beyond that general association, no specific count, direction, timing or ' +
      'offering is asserted here, because no reliable source has been checked for ' +
      'one. The verse may be included in one’s regular Abhirami Anthadhi ' +
      'paaraayana or personal devotional practice.',
    sourceNotes: [
      'Line 2 appears here as அணியும் அணிக்கழகே (the sandhi form). Some printed editions and web texts separate it as அணியும் அணிக்கு அழகே. Same words, same sense; the sandhi form is retained because it is what the source edition prints.'
    ],
    confidence: 'high'
  },

  25: {
    theme: 'Cutting the round of birth · A rare medicine',
    tags: ['karma', 'liberation', 'devotion', 'career'],
    english:
      'To walk behind Your devotees, to care for them, and so to cut off birth — in ' +
      'some earlier life I must have laboured at austerities to earn this. Mother of ' +
      'the first three; rare medicine for the world, called Abhirami. What a thing ' +
      'this is! From now on I will stand and praise You, and not forget.',
    words: [
      { tamil: 'பின்னே திரிந்து', translit: 'piṉṉē tirintu', meanings: ['wandering behind', 'going about after them'], note: 'திரி is to roam without fixed purpose. He is not following in procession; he is trailing about after them.' },
      { tamil: 'உன் அடியாரைப் பேணி', translit: 'uṉ aṭiyāraip pēṇi', meanings: ['cherishing Your devotees', 'tending them, keeping them'], note: 'பேணு is the verb used for tending a fire or nursing the sick.' },
      { tamil: 'பிறப்பு அறுக்க', translit: 'piṟappu aṟukka', meanings: ['to cut off birth'], note: 'அறு is to sever. The image is a cut, not a fading.' },
      { tamil: 'முன்னே தவங்கள் முயன்று கொண்டேன்', translit: 'muṉṉē tavaṅkaḷ muyaṉṟu koṇṭēṉ', meanings: ['earlier, I strove at austerities and obtained them'], note: 'The -கொண்டேன் implies acquisition for himself. He is inferring a past life from a present gift.' },
      { tamil: 'முதல் மூவருக்கும் அன்னே', translit: 'mutal mūvarukkum aṉṉē', meanings: ['O Mother of the first three'], note: 'Brahma, Vishnu, Rudra.' },
      { tamil: 'உலகுக்கு', translit: 'ulakukku', meanings: ['for the world'] },
      { tamil: 'அபிராமி என்னும் அரு மருந்தே', translit: 'apirāmi eṉṉum aru maruntē', meanings: ['O rare medicine that is called Abhirami'], note: 'The second மருந்து of the pilot set, after verse 24. Here the medicine is not for a disease but for the world.' },
      { tamil: 'என்னே', translit: 'eṉṉē', meanings: ['what is this!', 'how astonishing'] },
      { tamil: 'இனி', translit: 'iṉi', meanings: ['from now on', 'henceforth'] },
      { tamil: 'உன்னை யான் மறவாமல்', translit: 'uṉṉai yāṉ maṟavāmal', meanings: ['without my forgetting You'] },
      { tamil: 'நின்று ஏத்துவனே', translit: 'niṉṟu ēttuvaṉē', meanings: ['I shall stand and praise'], note: 'நின்று carries "standing firm / persisting" as much as physically standing.' }
    ],
    textualBasis:
      'The verse states its subject directly — பிறப்பு அறுக்க, to cut off birth — ' +
      'and reasons backwards from a present grace to past tapas. Obstacle and ' +
      'completion language sits on top of that: the obstacle named is birth itself.',
    association: {
      label: 'Past karma · Obstacles · Perseverance',
      basis: 'text'
    },
    devotional:
      'Bhattar does not thank Her for the gift. He works out, from the fact of having ' +
      'it, that he must once have deserved it — and the reasoning makes him more ' +
      'astonished rather than less. என்னே is the sound of someone who has surprised ' +
      'himself.',
    inner:
      'Notice what he treats as the prize. Not vision, not liberation directly, but ' +
      'permission to trail around after Her devotees and look after them. The route ' +
      'out of the round of birth is described as a social arrangement, and a humble ' +
      'one.',
    sriVidya:
      'Calling Her the medicine of the world rather than of a disease shifts the ' +
      'register from cure to constitution, which is the standard Sakta move: She is ' +
      'not applied to the world, She is what the world is made of. The verse makes no ' +
      'technical Sri Vidya claim beyond that.',
    lesson:
      'Most persistence is retrospective. You keep going because you notice you have ' +
      'already been going, and that turns out to be a better reason than resolve.',
    lalitha: [
      { num: 851, iast: 'janma-mṛtyu-jarā-tapta-jana-viśrānti-dāyinī', meaning: 'She who gives repose to those afflicted by birth, death and old age',
        why: 'பிறப்பு அறுக்க, expanded into its three components. The Sanskrit adds what the Tamil compresses.' },
      { num: 749, iast: 'mṛtyu-dāru-kuṭhārikā', meaning: 'She who is the axe that cuts down the tree of death',
        why: 'The same verb of severing. Bhattar says cut; this name supplies the instrument.' },
      { num: 359, iast: 'tāpasārādhyā', meaning: 'She who is worshipped by ascetics',
        why: 'The tapas the poet infers he must once have performed. The name is why the inference is a reasonable one within the tradition.' },
      { num: 502, iast: 'samasta-bhakta-sukha-dā', meaning: 'She who confers happiness on all Her devotees',
        why: 'The verse’s prize is service to devotees, not to Her directly — this name is the premise that makes that intelligible.' }
    ],
    apply: [
      { when: 'A long task that keeps stalling', what: 'The verse reframes obstacles as one obstacle, repeated. Useful when the list of blockers is long and the pattern behind them is not.' },
      { when: 'Ashamed of your past', what: 'The verse reads a present good fortune as evidence of past effort. That inference is available to most people and is rarely made.' }
    ],
    parayana: 'The verse may be included in one’s regular Abhirami Anthadhi paaraayana or personal devotional practice.',
    sourceNotes: [
      'Circulating purpose lists associate this verse with success free of obstacles. The Tamil supports "cutting off birth" as the obstacle in view; a wider reading is a traditional extension rather than a textual statement.'
    ],
    confidence: 'medium'
  },

  54: {
    theme: 'Dignity in want · Not having to ask',
    tags: ['prosperity', 'protection', 'relationships', 'srividya'],
    flagship: true,
    english:
      'If in your heart you would resolve never to go to another, tell them what you ' +
      'lack, and stand there diminished — then reach the feet of Tripura, who has ' +
      'ordained that one never go, at any time, to base men who have learned nothing. ' +
      'That itself is lasting, daily tapas.',
    words: [
      { tamil: 'இல்லாமை', translit: 'illāmai', meanings: ['not-having', 'want, destitution', 'the state of lacking'], note: 'An abstract noun built on இல்லை, "there is not". Tamil can say poverty as a grammatical state.' },
      { tamil: 'சொல்லி', translit: 'colli', meanings: ['having told', 'having declared'] },
      { tamil: 'ஒருவர் தம்பால் சென்று', translit: 'oruvar tampāl ceṉṟu', meanings: ['going to someone’s side'], note: 'தம்பால் is "to their side" — physical approach, the posture of asking.' },
      { tamil: 'இழிவுபட்டு', translit: 'iḻivupaṭṭu', meanings: ['being made low', 'suffering humiliation'], note: 'இழிவு = lowness, degradation; -பட்டு is the passive. It is done to you.' },
      { tamil: 'நில்லாமை', translit: 'nillāmai', meanings: ['not standing there'], note: 'The second -ஆமை abstract in two lines, deliberately rhyming with இல்லாமை. Not-having and not-standing.' },
      { tamil: 'நெஞ்சில் நினைகுவிரேல்', translit: 'neñcil niṉaikuvirēl', meanings: ['if you would consider it in your heart'], note: 'Conditional, addressed to a plural "you". The verse turns outward here and speaks to the reader.' },
      { tamil: 'நித்தம்', translit: 'nittam', meanings: ['daily', 'constantly'] },
      { tamil: 'நீடு தவம்', translit: 'nīṭu tavam', meanings: ['long-lasting austerity'] },
      { tamil: 'கல்லாமை கற்ற', translit: 'kallāmai kaṟṟa', meanings: ['who have learned unlearnedness'], note: 'The third -ஆமை. A deliberate paradox: they have studied, and what they have mastered is ignorance.' },
      { tamil: 'கயவர் தம்பால்', translit: 'kayavar tampāl', meanings: ['to the side of base men'], note: 'கயவர் — the mean, the ignoble. Repeats தம்பால் from line 1, so the two approaches rhyme.' },
      { tamil: 'ஒரு காலத்திலும்', translit: 'oru kālattilum', meanings: ['at any time at all'] },
      { tamil: 'செல்லாமை வைத்த', translit: 'cellāmai vaitta', meanings: ['who has ordained not-going', 'who has established that one does not go'], note: 'The fourth -ஆமை. Four negative abstracts in four lines: not-having, not-standing, not-learning, not-going.' },
      { tamil: 'திரிபுரை', translit: 'tiripurai', meanings: ['Tripura'] },
      { tamil: 'பாதங்கள் சேர்மின்களே', translit: 'pātaṅkaḷ cērmiṉkaḷē', meanings: ['reach Her feet!', 'join yourselves to Her feet'], note: 'Plural imperative — an instruction to readers, not a petition to Her.' }
    ],
    textualBasis:
      'The verse is about financial hardship in the most concrete way available to a ' +
      'poet: the moment of going to someone and saying that you have nothing. ' +
      'இல்லாமை சொல்லி … இழிவுபட்டு. What it offers is not the removal of the want ' +
      'but the removal of that errand.',
    association: {
      label: 'Debt · Financial hardship · Dignity',
      basis: 'text',
      note:
        'Traditionally recited by devotees facing debt or financial burden. The verse ' +
        'addresses the humiliation of having to ask, not the cancellation of what is ' +
        'owed.'
    },
    devotional:
      'Four -ஆமை abstracts, one per line, chiming down the verse: இல்லாமை, ' +
      'நில்லாமை, கல்லாமை, செல்லாமை. Bhattar builds the whole poem out of negations, ' +
      'and then the only positive verb in it is the last word: சேர்மின்களே, reach ' +
      'Her feet. The form enacts the argument.',
    inner:
      'This is the verse’s real subject and it is easy to miss. The pain named is ' +
      'not hunger, it is இழிவு — being made small in front of someone. Anyone who ' +
      'has been in debt recognises the accuracy of that. The shame of asking usually ' +
      'outlasts the shortage.',
    sriVidya:
      'That the relief is credited to Tripura, and that the alternative to begging is ' +
      'described as நித்தம் நீடு தவம் — daily lasting tapas — puts an ordinary ' +
      'financial predicament inside the vocabulary of practice. The endurance of ' +
      'want, undertaken deliberately, is treated as austerity rather than as ' +
      'misfortune.',
    lesson:
      'Faith should deepen responsibility, not replace it. The verse does not say the ' +
      'debt will vanish. It says something more useful and harder: that your worth is ' +
      'not decided in the room where you have to ask.',
    lalitha: [
      { num: 567, iast: 'bhakta-nidhiḥ', meaning: 'She who is the treasure of the devotees',
        why: 'The precise counter to இல்லாமை. If She is the treasury, the errand in line one is unnecessary — which is the verse’s argument in one word.' },
      { num: 117, iast: 'bhakta-saubhāgya-dāyinī', meaning: 'She who confers prosperity on Her devotees',
        why: 'The name behind the traditional association with financial hardship. Note it says confers on devotees, not cancels debts.' },
      { num: 886, iast: 'dhana-dhānya-vivardhinī', meaning: 'She who increases wealth and harvests',
        why: 'The most directly material name in the Sahasranama, and worth citing precisely because the Tamil verse declines to make that promise.' },
      { num: 997, iast: 'śrīmat-tripura-sundarī', meaning: 'She who is the divine Tripurasundari',
        why: 'திரிபுரை — the name the verse sends you to.' }
    ],
    apply: [
      { when: 'In debt', what: 'Use the verse to cultivate clarity, discipline and freedom from panic while taking practical financial action: listing what is owed, talking to creditors, getting advice. The verse is explicitly about not being diminished, and diminished people avoid their statements.' },
      { when: 'Before asking for help', what: 'Asking is sometimes necessary and is not what the verse forbids — it names going to கயவர், the ignoble, as the thing to be spared. Choosing who to ask is the decision the verse actually addresses.' },
      { when: 'When you have been made to feel small', what: 'நித்தம் நீடு தவம். The verse is willing to call the endurance of that a practice, which is more respect than the experience usually gets.' }
    ],
    parayana:
      'Traditionally recited by devotees facing debt and financial hardship. No ' +
      'specific count, timing or offering is asserted here; none has been verified. ' +
      'The verse may be included in one’s regular Abhirami Anthadhi paaraayana.',
    sourceNotes: [
      'The syntax of lines 2–3 is read in more than one way. Some commentators attach நித்தம் நீடு தவம் to the resolve not to beg (the reading followed above); others attach it to the கயவர், as ascetics whose long penance has taught them nothing. Both are defensible from the Tamil, and the ambiguity is not silently resolved here.'
    ],
    confidence: 'high'
  },

  66: {
    theme: 'Having nothing to offer · The names are the hymn',
    tags: ['devotion', 'mind', 'karma'],
    english:
      'I know no accomplishment. I am small. I have no hold on anything but the red ' +
      'shoot that is Your flower-foot. You sit in majesty beside Him whose bow was the ' +
      'mountain of pure gold. And though the words this karma-bound man has strung ' +
      'together are worthless — Your holy names, inside them, are the hymn.',
    words: [
      { tamil: 'வல்லபம் ஒன்று அறியேன்', translit: 'vallapam oṉṟu aṟiyēṉ', meanings: ['I know not a single capability', 'I have no skill whatever'], note: 'வல்லபம் = capacity, power, competence.' },
      { tamil: 'சிறியேன்', translit: 'ciṟiyēṉ', meanings: ['I, the small one', 'I am insignificant'], note: 'A first-person noun: not "I am small" but "I, the small". Tamil can make humility a name.' },
      { tamil: 'நின் மலரடிச் செம் பல்லவம்', translit: 'niṉ malaraṭic cem pallavam', meanings: ['the red tender shoot of Your flower-foot'], note: 'பல்லவம் = a young leaf or sprout. The foot compared to the softest, newest thing on a tree.' },
      { tamil: 'அல்லது பற்று ஒன்று இலேன்', translit: 'allatu paṟṟu oṉṟu ilēṉ', meanings: ['other than that, I have no hold'], note: 'பற்று is grip, support, and also attachment. All three senses work: it is the only thing he holds and the only thing holding him.' },
      { tamil: 'பசும் பொன் பொருப்பு வில்லவர்', translit: 'pacum poṉ poruppu villavar', meanings: ['He whose bow was the mountain of pure gold'], note: 'Meru made into Siva’s bow at the burning of the three cities. பசும் பொன் = unalloyed gold.' },
      { tamil: 'தம்முடன் வீற்றிருப்பாய்', translit: 'tammuṭaṉ vīṟṟiruppāy', meanings: ['You who sit in state beside Him'], note: 'வீற்றிரு is to be seated in majesty — enthroned, not merely present.' },
      { tamil: 'வினையேன்', translit: 'viṉaiyēṉ', meanings: ['I, laden with karma', 'I, the man of deeds'], note: 'Parallel in form to சிறியேன். Two self-namings, both negative.' },
      { tamil: 'தொடுத்த சொல்', translit: 'toṭutta col', meanings: ['the words I have strung together'], note: 'தொடு is to string, as one strings a garland — the standard image for composing verse, and the reason an Anthadhi is called a garland.' },
      { tamil: 'அவம் ஆயினும்', translit: 'avam āyiṉum', meanings: ['though they be worthless, though they be in vain'] },
      { tamil: 'நின் திருநாமங்கள் தோத்திரமே', translit: 'niṉ tirunāmaṅkaḷ tōttiramē', meanings: ['Your holy names are themselves the hymn'], note: 'தோத்திரம் / stotra. The praise is not what he made of the names; it is the names.' }
    ],
    textualBasis:
      'The verse says outright that the poet has no competence and no possession, and ' +
      'that his composition may be worthless. The resolution is placed in the names ' +
      'rather than in him.',
    association: {
      label: 'Inadequacy · Self-worth · Surrender',
      basis: 'text'
    },
    devotional:
      'He is sixty-six verses into a hundred and he says the words are in vain. That ' +
      'is not false modesty — it is a working theory of how the poem functions. ' +
      'Whatever is good in it was in the names before he arrived.',
    inner:
      'The most useful verse in the pilot set for anyone who feels they are not ' +
      'enough. Its move is not to argue with the feeling. He does not say "I am ' +
      'small, but". He says "I am small" and then changes the subject to what he is ' +
      'holding onto. The grip is the reply, not the self-assessment.',
    sriVidya:
      'That the names themselves constitute the stotra is the ordinary premise of ' +
      'nama-based practice, of which the Lalitha Sahasranama is the great Sakta ' +
      'instance. The efficacy is attributed to the name, not to the reciter’s ' +
      'quality — which is precisely why such practice is open to people with no ' +
      'qualifications.',
    lesson:
      'You do not have to resolve the question of whether you are any good in order ' +
      'to do the work. This verse is evidence that the question can simply be left ' +
      'open.',
    lalitha: [
      { num: 815, iast: 'anitya-tṛptā', meaning: 'She who is satisfied even by our perishable offerings',
        why: 'The most exact parallel in this entire set. Bhattar says his words are worthless; this name says She is satisfied by exactly such things. The two texts answer each other.' },
      { num: 992, iast: 'avyāja-karuṇā-mūrtiḥ', meaning: 'She who is pure, motiveless compassion',
        why: 'Motiveless — avyāja, without pretext. If the compassion needs no reason, the poet’s lack of qualification is not an obstacle.' },
      { num: 502, iast: 'samasta-bhakta-sukha-dā', meaning: 'She who confers happiness on all Her devotees',
        why: 'All — samasta. The verse’s anxiety is about being the exception; the name closes that door.' },
      { num: 204, iast: 'sarva-mantra-svarūpiṇī', meaning: 'She who is the essence of all the mantras',
        why: 'Why the names can be the hymn without the poet’s help: the name is not a label for Her.' }
    ],
    apply: [
      { when: 'Feeling like a fraud', what: 'The verse does not require you to talk yourself out of it. It asks a different question: what are you holding on to while you feel it?' },
      { when: 'Your work seems poor', what: 'Finish it anyway. Bhattar did, for another thirty-four verses.' },
      { when: 'Praying badly', what: 'The verse settles this: the names carry the practice when the practitioner cannot.' }
    ],
    parayana: 'The verse may be included in one’s regular Abhirami Anthadhi paaraayana or personal devotional practice.',
    sourceNotes: [],
    confidence: 'high'
  },

  69: {
    theme: 'What the glance gives · Prosperity and learning',
    tags: ['prosperity', 'knowledge', 'mind', 'relationships'],
    flagship: true,
    english:
      'They give wealth. They give learning. They give a mind that never once knows ' +
      'weariness. They give a form fit for the gods. They give company in whose hearts ' +
      'there is no guile. They give every good thing — and only to those who are called ' +
      'Her lovers: the side-long glances of flower-haired Abhirami, who confers weight ' +
      'and worth.',
    words: [
      { tamil: 'தனம் தரும்', translit: 'taṉam tarum', meanings: ['gives wealth'], note: 'தனம் — wealth, property. The plainest word available; the verse does not soften it.' },
      { tamil: 'கல்வி தரும்', translit: 'kalvi tarum', meanings: ['gives learning'], note: 'கல்வி is education, what is studied — distinct from அறிவு, native intelligence.' },
      { tamil: 'ஒரு நாளும் தளர்வு அறியா மனம் தரும்', translit: 'oru nāḷum taḷarvu aṟiyā maṉam tarum', meanings: ['gives a mind that does not know flagging on any day'], note: 'தளர்வு again — the same word as verse 7’s "refuge that does not flag". Bhattar is consistent in his vocabulary for the mind.' },
      { tamil: 'தெய்வ வடிவும் தரும்', translit: 'teyva vaṭivum tarum', meanings: ['gives a divine form'], note: 'வடிவு is shape or bearing. Traditionally read as beauty, but also as a form fit to be worshipped.' },
      { tamil: 'நெஞ்சில் வஞ்சம் இல்லா இனம் தரும்', translit: 'neñcil vañcam illā iṉam tarum', meanings: ['gives kinsfolk in whose hearts there is no deceit'], note: 'இனம் = kin, one’s own group. Not friends chosen but a people belonged to.' },
      { tamil: 'நல்லன எல்லாம் தரும்', translit: 'nallaṉa ellām tarum', meanings: ['gives all good things'] },
      { tamil: 'அன்பர் என்பவர்க்கே', translit: 'aṉpar eṉpavarkkē', meanings: ['to those alone who are called lovers'], note: 'The -ஏ is exclusive and the whole verse turns on it. Six gifts, one condition.' },
      { tamil: 'கனம் தரும்', translit: 'kaṉam tarum', meanings: ['gives weight', 'gives dignity, gravity, esteem'], note: 'கனம் is literally heaviness and idiomatically honour. The seventh gift, and the one placed next to Her name.' },
      { tamil: 'பூங்குழலாள்', translit: 'pūṅkuḻalāḷ', meanings: ['She of the flower-decked tresses'] },
      { tamil: 'அபிராமி கடைக்கண்களே', translit: 'apirāmi kaṭaikkaṇkaḷē', meanings: ['the side-long glances of Abhirami'], note: 'கடைக்கண் = the corner of the eye; the Tamil equivalent of kaṭākṣa. Grammatically this, and not Abhirami, is the subject of all seven verbs.' }
    ],
    textualBasis:
      'The most explicit statement of material benefit in the pilot set: தனம், ' +
      'கல்வி, மனம், வடிவு, இனம், நல்லன எல்லாம், கனம். All seven are stated. So is ' +
      'the condition attached to them.',
    association: {
      label: 'Prosperity · Learning · Stability',
      basis: 'text'
    },
    devotional:
      'Seven times தரும், a drumbeat, and then the sentence finally reveals its ' +
      'subject in the last two words. It was never Abhirami doing the giving — it was ' +
      'Her glance, and only a glance from the corner of the eye at that.',
    inner:
      'The verse is quoted constantly for its list and almost never for its condition. ' +
      'அன்பர் என்பவர்க்கே — to those alone who are called Her lovers. Read with the ' +
      'condition, it stops being a promise of results and becomes a description of ' +
      'what happens to a person’s life when their affection is settled somewhere. ' +
      'The unwearied mind and the honest company are not payments. They are what love ' +
      'of that kind tends to produce.',
    sriVidya:
      'கடைக்கண் is the Tamil kaṭākṣa, and the katākṣa is a technical term in Sakta ' +
      'devotion: grace as a glance, arriving sideways, unsought and unearned. That ' +
      'the whole verse is grammatically governed by the glance rather than by the ' +
      'Goddess is the doctrine embedded in the syntax.',
    lesson:
      'It reads like a list of results and is actually a description of a ' +
      'disposition. The difference matters: one is a transaction, the other is a life ' +
      'that has been arranged around something.',
    lalitha: [
      { num: 886, iast: 'dhana-dhānya-vivardhinī', meaning: 'She who increases wealth and harvests',
        why: 'தனம் தரும், name for name — and the same directness. Neither text is embarrassed about material good.' },
      { num: 643, iast: 'jñāna-dā', meaning: 'She who gives knowledge of the self',
        why: 'கல்வி தரும், with the Sanskrit specifying which knowledge. The Tamil leaves it open, which is the more generous reading for a student.' },
      { num: 117, iast: 'bhakta-saubhāgya-dāyinī', meaning: 'She who confers prosperity on Her devotees',
        why: 'Carries the same condition as the Tamil: on Her devotees. Both texts attach the gift to a relationship, not to a technique.' },
      { num: 324, iast: 'kalyāṇī', meaning: 'She who bestows auspiciousness',
        why: 'நல்லன எல்லாம் தரும் — all good things — in a single Sanskrit word.' },
      { num: 502, iast: 'samasta-bhakta-sukha-dā', meaning: 'She who confers happiness on all Her devotees',
        why: 'The seven gifts gathered back into one.' }
    ],
    apply: [
      { when: 'Praying about money', what: 'Read the last line first. The verse conditions everything on affection rather than on recitation, which makes it a poor formula and a good examination.' },
      { when: 'Studying', what: 'கல்வி and தளர்வு அறியா மனம் are listed together, and the second is the rarer gift. Stamina, not brilliance, is what most study actually requires.' },
      { when: 'Choosing your circle', what: 'நெஞ்சில் வஞ்சம் இல்லா இனம் — company without guile is listed as a benefit alongside wealth. It is worth asking whether you value it that highly in practice.' }
    ],
    parayana:
      'Widely recited for prosperity. No specific count, timing or offering is ' +
      'asserted here; none has been verified. The verse may be included in one’s ' +
      'regular Abhirami Anthadhi paaraayana.',
    sourceNotes: [],
    confidence: 'high'
  },

  75: {
    theme: 'The Kalpaka shade · No further birth',
    tags: ['liberation', 'karma', 'devotion'],
    english:
      'They will rest in the shade of the Kalpaka tree. Needing no further mother, ' +
      'they will let fade the earth-birth that never fails to come. They will rise ' +
      'past the great mountain and the surging sea — those who have fixed their minds ' +
      'on the sacred form of the flower-haired One, from whose navel the twice-seven ' +
      'worlds blossomed.',
    words: [
      { tamil: 'தங்குவர்', translit: 'taṅkuvar', meanings: ['they will stay', 'they will lodge, abide'] },
      { tamil: 'கற்பகத் தாருவின் நீழலில்', translit: 'kaṟpakat tāruviṉ nīḻalil', meanings: ['in the shade of the Kalpaka tree'], note: 'The wish-granting tree of Indra’s heaven. Note that the promise is its shade, not its fruit.' },
      { tamil: 'தாயர் இன்றி', translit: 'tāyar iṉṟi', meanings: ['without mothers'], note: 'Plural. Not motherless — without any further mothers, because there will be no further births.' },
      { tamil: 'மங்குவர்', translit: 'maṅkuvar', meanings: ['they will cause to fade', 'they will let dwindle'] },
      { tamil: 'மண்ணில் வழுவாப் பிறவியை', translit: 'maṇṇil vaḻuvāp piṟaviyai', meanings: ['the earthly birth that does not slip / fail'], note: 'வழுவா = unfailing. Birth is described as the thing that never misses its appointment.' },
      { tamil: 'மால் வரையும்', translit: 'māl varaiyum', meanings: ['and the great mountain'] },
      { tamil: 'பொங்குவர் ஆழியும்', translit: 'poṅkuvar āḻiyum', meanings: ['they will surge past the sea', 'and the swelling ocean'], note: 'பொங்கு is the swelling of boiling or of surf. Read with the verbs before it, the sense is transcending both.' },
      { tamil: 'ஈரேழ் புவனமும் பூத்த உந்தி', translit: 'īrēḻ puvaṉamum pūtta unti', meanings: ['the navel from which the twice-seven worlds blossomed'], note: 'ஈரேழ் = two sevens, the fourteen worlds. பூத்த is the verb for a plant flowering.' },
      { tamil: 'கொங்கு இவர் பூங்குழலாள்', translit: 'koṅku ivar pūṅkuḻalāḷ', meanings: ['She of the flower-tresses over which fragrance spreads'], note: 'கொங்கு = pollen, fragrance; இவர் = to climb, to spread over.' },
      { tamil: 'திருமேனி குறித்தவரே', translit: 'tirumēṉi kuṟittavarē', meanings: ['those who have marked / fixed upon Her sacred form'], note: 'குறி is to aim at, to mark — the same word used of aiming an arrow. Contemplation as taking aim.' }
    ],
    textualBasis:
      'Liberation is stated in the verse’s own terms — தாயர் இன்றி, without ' +
      'further mothers; வழுவாப் பிறவியை மங்குவர், they will make the unfailing birth ' +
      'fade. The condition is also stated: fixing the mind on Her form.',
    association: {
      label: 'Liberation · Release from rebirth · Stability',
      basis: 'text'
    },
    devotional:
      'The cosmology is casual and enormous — fourteen worlds flowering from a navel ' +
      '— and the promise attached to it is a place to sit down in the shade. Bhattar ' +
      'has a consistent instinct for ending grandeur in something small and physical.',
    inner:
      'வழுவாப் பிறவி is the phrase to keep. Birth is not described as a punishment ' +
      'or a mistake but as a thing that is extremely reliable. The weariness in that ' +
      'is recognisable to anyone who has watched the same pattern come round again in ' +
      'their own life.',
    sriVidya:
      'The navel from which the worlds blossom transfers to the Goddess an image ' +
      'normally used of Vishnu, and does so without argument. This kind of quiet ' +
      'reassignment is how Sakta poetry states its central claim: the source is Her. ' +
      'Nothing more technical should be read into the verse.',
    lesson:
      'What is offered is shade, not fruit — rest from a cycle rather than a better ' +
      'position inside it. That is a smaller promise than it first looks, and a ' +
      'larger one.',
    lalitha: [
      { num: 926, iast: 'anarghya-kaivalya-pada-dāyinī', meaning: 'She who confers the priceless fruit of final liberation',
        why: 'The explicit statement of what this verse describes obliquely through mothers and shade.' },
      { num: 144, iast: 'nitya-muktā', meaning: 'She who is ever free from worldly bonds',
        why: 'The state the verse promises is one She already is. In both texts liberation is participation, not acquisition.' },
      { num: 851, iast: 'janma-mṛtyu-jarā-tapta-jana-viśrānti-dāyinī', meaning: 'She who gives repose to those afflicted by birth, death and old age',
        why: 'விश्रान्ति is repose — literally the rest the Tamil calls நீழல், shade. The two images coincide almost exactly.' },
      { num: 264, iast: 'sṛṣṭi-kartrī', meaning: 'She who is the creator',
        why: 'The navel from which the fourteen worlds flowered. The Tamil gives the image; the Sanskrit gives the office.' }
    ],
    apply: [
      { when: 'Tired of repeating yourself', what: 'The verse names the exhaustion of recurrence rather than of effort, which is the more accurate diagnosis for a lot of midlife weariness.' },
      { when: 'Contemplation', what: 'குறித்தவர் — those who took aim. The verse treats contemplation as a directed act, not a mood.' }
    ],
    parayana: 'The verse may be included in one’s regular Abhirami Anthadhi paaraayana or personal devotional practice.',
    sourceNotes: [
      'Line 2 is read by some commentators as "they will fade away without mothers" and by others as "they will cause the unfailing birth to fade, needing no further mother". The second is followed above as it accounts for the accusative பிறவியை.'
    ],
    confidence: 'medium'
  },

  87: {
    theme: 'Beyond speech and thought · Visible in my acts',
    tags: ['karma', 'srividya', 'knowledge', 'liberation'],
    english:
      'Your sacred form, which speech and thought cannot reach, stood out in the open ' +
      '— before my eyes, and before my acts. O Para-para, who took one half of the ' +
      'Lord that burns Desire with a glance, and rules; who took it so that all the ' +
      'worlds would find fault with His unbreakable vow.',
    words: [
      { tamil: 'மொழிக்கும், நினைவுக்கும் எட்டாத', translit: 'moḻikkum, niṉaivukkum eṭṭāta', meanings: ['unreachable by speech and by thought'], note: 'எட்டு = to reach, as a hand reaches a shelf. The negation is physical, not abstract.' },
      { tamil: 'நின் திருமூர்த்தி', translit: 'niṉ tirumūrtti', meanings: ['Your sacred form'] },
      { tamil: 'என்றன் விழிக்கும் வினைக்கும்', translit: 'eṉṟaṉ viḻikkum viṉaikkum', meanings: ['to my eye and to my act', 'for my sight and for my karma'], note: 'வினை is both deed and karma. The pairing of eye with deed is the hinge of the verse.' },
      { tamil: 'வெளி நின்றதால்', translit: 'veḷi niṉṟatāl', meanings: ['because it stood out in the open'], note: 'வெளி = open ground, the outside, also empty space. What could not be reached simply stood there in plain view.' },
      { tamil: 'விழியால் மதனை அழிக்கும் தலைவர்', translit: 'viḻiyāl mataṉai aḻikkum talaivar', meanings: ['the Lord who destroys Manmatha with a glance'], note: 'மதன் = Kama, Desire. Destroyed by the third eye.' },
      { tamil: 'அழியா விரதத்தை', translit: 'aḻiyā viratattai', meanings: ['His indestructible vow'], note: 'The vow of asceticism. Note அழியா set against அழிக்கும் in the line before: He destroys, His vow is undestroyable.' },
      { tamil: 'அண்டம் எல்லாம் பழிக்கும் படி', translit: 'aṇṭam ellām paḻikkum paṭi', meanings: ['so that all the worlds would reproach it'] },
      { tamil: 'ஒரு பாகம் கொண்டு ஆளும்', translit: 'oru pākam koṇṭu āḷum', meanings: ['who takes one half and rules'], note: 'The Ardhanarisvara again, as in the kaappu — but here it is framed as a conquest.' },
      { tamil: 'பராபரையே', translit: 'parāparaiyē', meanings: ['O Para-para', 'O supreme beyond the supreme'], note: 'The feminine of parāpara. The most abstract name in the pilot set, placed at the end of the most mischievous verse.' }
    ],
    textualBasis:
      'The verse says explicitly that the unreachable form stood open to என்றன் ' +
      'விழிக்கும் வினைக்கும் — to the poet’s sight and to his karma. Action is ' +
      'named as one of the two places where the formless became visible.',
    association: {
      label: 'Past karma · Grace arriving in ordinary life',
      basis: 'text'
    },
    devotional:
      'There is wit here that the solemnity of translation usually loses. Siva burns ' +
      'Desire to ash with a look and keeps an unbreakable vow of celibacy — and She ' +
      'takes half of him, publicly, until the worlds have something to say about it. ' +
      'The verse is affectionate about a scandal.',
    inner:
      'The pairing of eye and deed is the thing. Bhattar does not say the form became ' +
      'visible to his devotion or his understanding. He says it stood out for his ' +
      'sight and for his actions — the two most ordinary faculties a person has. ' +
      'Whatever is beyond speech and thought showed up in what he happened to look at ' +
      'and what he happened to do.',
    sriVidya:
      'Parāparā is the standard Sakta designation for what is beyond both the ' +
      'transcendent and the immanent, and joining it to the Ardhanarisvara image is ' +
      'the Siva-Sakti aikyam stated in its strongest form: not two who are joined, ' +
      'but one who took half and governs. The verse also completes the Kama cycle ' +
      'found in verse 5 — He burns Desire, She is what survives the burning.',
    lesson:
      'People wait for grace to arrive as an experience. This verse looks for it in ' +
      'the two least mystical places available: what you have been looking at, and ' +
      'what you have been doing.',
    lalitha: [
      { num: 84, iast: 'hara-netrāgni-sandagdha-kāma-sañjīvanauṣadhiḥ', meaning: 'She who became the life-giving medicine for Kamadeva, burnt to ashes by the fire of Siva’s eye',
        why: 'The same episode, named with the same emphasis on the eye. Bhattar gives the burning; the Sahasranama gives what She did afterwards.' },
      { num: 52, iast: 'śiva-kāmeśvarāṅka-sthā', meaning: 'She who sits in the lap of Siva, conqueror of desire',
        why: 'The half taken, in the Sanskrit’s more decorous idiom. Reading them together shows how much cheek the Tamil has.' },
      { num: 407, iast: 'śiva-mūrtiḥ', meaning: 'She whose form is Siva Himself',
        why: 'ஒரு பாகம் கொண்டு ஆளும் — one half taken and ruled — stated as identity rather than as division.' },
      { num: 980, iast: 'jñāna-gamyā', meaning: 'She who is to be attained through the yoga of knowledge',
        why: 'Set deliberately against the verse’s opening: unreachable by speech and thought, yet reachable. The tension is the subject.' }
    ],
    apply: [
      { when: 'Looking back at your own choices', what: 'The verse treats past action as a place where something showed itself, rather than only as a ledger. That is a different way to read your own history.' },
      { when: 'Waiting for a sign', what: 'It suggests the sign has already been in the ordinary field of sight and action. Nothing here requires an experience.' }
    ],
    parayana: 'The verse may be included in one’s regular Abhirami Anthadhi paaraayana or personal devotional practice.',
    sourceNotes: [],
    confidence: 'medium'
  },

  101: {
    theme: 'Nool Payan · The fruit of the work',
    tags: ['devotion', 'protection', 'srividya'],
    label: 'Nool Payan',
    english:
      'The Mother; our Abhirami-valli; She who blossomed as all the worlds; She whose ' +
      'colour is the pomegranate flower; She who has guarded the whole earth; She who ' +
      'gathered the goad, the noose and the sugarcane into Her lovely hands — to those ' +
      'who bow to the three-eyed One, no harm comes.',
    words: [
      { tamil: 'ஆத்தாளை', translit: 'āttāḷai', meanings: ['the Mother'], note: 'ஆத்தாள் is a homely, spoken word for mother — the register of a household, not a hymn.' },
      { tamil: 'எங்கள் அபிராமவல்லியை', translit: 'eṅkaḷ apirāmavalliyai', meanings: ['our Abhirami-valli'], note: 'வல்லி = a creeper; the standard suffix for a goddess’s name. And எங்கள் — ours, plural.' },
      { tamil: 'அண்டம் எல்லாம் பூத்தாளை', translit: 'aṇṭam ellām pūttāḷai', meanings: ['She who flowered as all the worlds'], note: 'The same verb பூ as in verse 75. Creation as flowering, consistently.' },
      { tamil: 'மாதுளம் பூ நிறத்தாளை', translit: 'mātuḷam pū niṟattāḷai', meanings: ['She whose colour is the pomegranate flower'], note: 'Verse 1 used the pomegranate bud; the last verse uses the open flower. The garland closes.' },
      { tamil: 'புவி அடங்கக் காத்தாளை', translit: 'puvi aṭaṅkak kāttāḷai', meanings: ['She who has guarded the earth entire'] },
      { tamil: 'அங்குச பாசாங்குசமும் கரும்பும்', translit: 'aṅkuca pācāṅkucamum karumpum', meanings: ['the goad, the noose-and-goad, and the sugarcane'], note: 'The emblems of verse 2 returning at the end, as the Anthadhi form requires.' },
      { tamil: 'அங்கை சேர்த்தாளை', translit: 'aṅkai cērttāḷai', meanings: ['She who gathered them into Her lovely hand'] },
      { tamil: 'முக்கண்ணியை', translit: 'mukkaṇṇiyai', meanings: ['the three-eyed One'], note: 'Feminine. The three eyes are Hers here, not Siva’s.' },
      { tamil: 'தொழுவார்க்கு ஒரு தீங்கு இல்லையே', translit: 'toḻuvārkku oru tīṅku illaiyē', meanings: ['to those who worship, there is not one harm'] }
    ],
    textualBasis:
      'A phala-sruti: a closing statement of what the work yields. It names no ' +
      'specific benefit, only the absence of harm — ஒரு தீங்கு இல்லையே.',
    association: {
      label: 'Closing verse · Protection',
      basis: 'text'
    },
    devotional:
      'Seven accusatives in a row, all of them Her, and then a single short clause ' +
      'about the worshipper. The proportion is the statement.',
    inner:
      'The promise at the end is carefully small. Not that nothing will go wrong — ' +
      'that no harm comes to the one who bows. Those are not the same, and the ' +
      'hundred verses before it have been unusually honest about which one is on ' +
      'offer.',
    sriVidya:
      'The goad, noose and sugarcane return here from verse 2, closing the sequence ' +
      'where it opened. That the three eyes are assigned to Her rather than to Siva ' +
      'is the Sakta claim made in a single grammatical gender.',
    lesson:
      'A hundred verses of asking end without a list. What is claimed at the close is ' +
      'the least that could be claimed, which is one reason to trust the rest.',
    lalitha: [
      { num: 1, iast: 'śrī-mātā', meaning: 'She who is the auspicious Mother',
        why: 'ஆத்தாள் — the household word for mother — reaching the same place the Sahasranama begins.' },
      { num: 266, iast: 'goptrī', meaning: 'She who protects',
        why: 'புவி அடங்கக் காத்தாள். The protection is of the earth entire in both.' },
      { num: 264, iast: 'sṛṣṭi-kartrī', meaning: 'She who is the creator',
        why: 'அண்டம் எல்லாம் பூத்தாள் — she who flowered as all the worlds.' },
      { num: 517, iast: 'aṅkuśādi-praharaṇā', meaning: 'She who holds the goad and other weapons',
        why: 'The emblems named in the closing line.' }
    ],
    apply: [
      { when: 'Finishing a reading', what: 'The nool payan is where a recitation stops. Reading it as a summary rather than as a promise keeps the hundred verses in proportion.' }
    ],
    parayana: 'Recited at the close of the hundred verses.',
    sourceNotes: [
      'This verse is numbered variously in printed editions — as a hundred-and-first verse, as an appended nool payan, or omitted. It is retained here as the source edition prints it.',
      'The source file carries no English rendering for this verse; the translation above is newly supplied from the Tamil and the word breakdown shown with it.'
    ],
    confidence: 'medium'
  }

};

// Expose for module consumers; harmless in the browser.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ABHIRAMI_META: ABHIRAMI_META, ABHIRAMI_THEMES: ABHIRAMI_THEMES,
    ABHIRAMI_CHALLENGES: ABHIRAMI_CHALLENGES, ABHIRAMI_FEATURED: ABHIRAMI_FEATURED,
    ABHIRAMI_ENRICHMENT: ABHIRAMI_ENRICHMENT };
}
