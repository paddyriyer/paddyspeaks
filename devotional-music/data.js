// Devotional Music — Nama Sankeerthanam
// =====================================
// Volume I: The Keertanas of Bhadrachala Ramadasu (c. 1620–1688)
//
// EDITORIAL RULES FOR THIS FILE — keep them if you edit it:
//   1. Every ragam carries a `ragaConfidence` field. Ramadasu left LYRICS, not
//      notation. The tunes sung today are later settings. Where sources
//      disagree, say so in `ragaNote` — never silently pick one.
//   2. Lyrics are given only as far as they could be corroborated. Where only
//      the pallavi/anupallavi is verified, `charanams` says so rather than
//      inventing verses. Partial and honest beats complete and wrong.
//   3. `esoteric` entries must be defensible from the text itself or from named
//      doctrine (nama-siddhanta, sharanagati, ninda-stuti). No invented mysticism.
//   4. Compositions by OTHER vaggeyakaras that are popularly misattributed to
//      Ramadasu belong in MISATTRIBUTED, never in KRITIS.

/* ── The composer ─────────────────────────────────────────────── */

const COMPOSER = {
  name: "Bhadrachala Ramadasu",
  birthName: "Kancherla Gopanna",
  telugu: "భద్రాచల రామదాసు",
  dates: "c. 1620 – 1688 CE",
  birthplace: "Nelakondapalli, Golconda Sultanate (present-day Khammam district, Telangana)",
  mudra: "Ramadasa / Bhadrachala Ramadasa",
  language: "Telugu",
  deity: "Sri Sita Ramachandra of Bhadrachalam",

  nameNote: "The name is often written <em>Bhadrajalam</em> or <em>Bhadrachalam</em> Ramadasu. " +
    "<strong>Bhadrachalam</strong> is the town; <strong>Bhadrachala</strong> or <strong>Bhadragiri</strong> " +
    "(bhadra = auspicious, achala/giri = hill) is the sacred hill itself — and it is the hill, not the town, " +
    "that his title takes. Both his own signature and scholarly usage read <strong>Bhadrachala Ramadasu</strong>.",

  lede: "A revenue officer who spent the state's money on a temple, went to prison for twelve years, " +
    "and came out having written some of the most-sung devotional verse in the Telugu language.",

  story: [
    {
      heading: "The tahsildar",
      text: "Kancherla Gopanna was tahsildar of the Palvancha paragana under Abul Hasan Tana Shah, " +
        "the last Qutb Shahi ruler of Golconda. He was, by every account, a competent administrator and " +
        "an increasingly impossible one — because the revenue he collected kept turning into masonry."
    },
    {
      heading: "The temple",
      text: "He rebuilt the Sri Seetha Ramachandra Swamy temple at Bhadrachalam on the banks of the " +
        "Godavari — the gopuram, the prakara walls, the mandapas, the golden sudarshana chakra. " +
        "The money was the state's. This is not a detail the tradition hides; Ramadasu himself itemises " +
        "the spending, line by line, in his own songs."
    },
    {
      heading: "The prison",
      text: "He was arrested for misappropriation and held in the Golconda fort. Tradition puts the " +
        "imprisonment at twelve years. The keertanas that come from this period are the rawest things " +
        "in the corpus — the reproaches, the accounting, the silence of a God who will not answer."
    },
    {
      heading: "The release",
      text: "Tradition holds that Rama and Lakshmana appeared before Tana Shah as two young men and paid " +
        "the outstanding sum in gold mohurs bearing Rama's stamp, and Gopanna was freed. " +
        "What the historical record shows is simply that he was released and that the temple stands."
    },
    {
      heading: "The inheritance",
      text: "He is counted among the Telugu vaggeyakaras — composer-poets — with Annamacharya, Kshetrayya " +
        "and Tyagaraja. Tyagaraja, born a century later, names Ramadasu with reverence in his own " +
        "compositions, and the two share a subject: not the philosophy of Rama, but the person of Rama, " +
        "addressed directly and sometimes angrily."
    }
  ],

  works: [
    { title: "Ramadasu Keertanalu", note: "Devotional songs in pallavi–anupallavi–charanam form. Corpus figures vary widely by collection; several hundred are attributed, of which a much smaller number are in living performance." },
    { title: "Dasarathi Satakamu", note: "A satakam — a century of Telugu verse — to Dasharathi (the son of Dasharatha). Traditionally counted at ~108 poems." },
    { title: "Navaratna Keertanalu", note: "The 'nine gems' — the nine most widely sung keertanas, rendered as a group set at Ramadasu Jayanti observances and published with notation under the guidance of Nedunuri Krishnamurthy." }
  ],

  caveat: "Ramadasu composed in Telugu and left no notation. The ragams and talams below come from " +
    "later performance tradition — principally 19th and 20th century musicians, and Mangalampalli " +
    "Balamuralikrishna's influential 1950s settings, which is why so many of these songs sound the way " +
    "they do on record today. Where the sources disagree, this page says so."
};

/* ── Ragam reference ──────────────────────────────────────────── */
// Arohana/avarohana follow common modern practice. Several janya ragams have
// school-specific (bani) variants — treat these as the usual form, not the only one.

const RAGAS = {
  "Varali": {
    telugu: "వరాళి", melakarta: "39th melakarta (Jhalavarali)", type: "Sampurna, vakra",
    arohana: "S G₁ R₁ G₁ M₂ P D₁ N₃ Ṡ", avarohana: "Ṡ N₃ D₁ P M₂ G₁ R₁ S",
    bhava: "Awe, otherworldliness, the numinous",
    note: "A ragam of strange, almost unearthly colour — the sharp fourth (prati madhyama) against the lowest second and third. " +
      "Tradition surrounds it with caution: a guru is said not to teach it directly to a student, which is best read as a warning " +
      "about its difficulty rather than a superstition. It does not console. It makes the hair stand up."
  },
  "Atana": {
    telugu: "అఠాణా", melakarta: "Janya of Dheerasankarabharanam (29th)", type: "Vakra, audava-vakra",
    arohana: "S R₂ M₁ P N₃ Ṡ", avarohana: "Ṡ N₂ D₂ P M₁ R₂ G₃ R₂ S",
    bhava: "Veera — valour, resolve",
    note: "The heroic ragam of the Carnatic repertoire, full of brisk gamakas and a characteristically " +
      "unstable nishada. Its use for a song about holding a name on the tongue is the whole point: steadiness is a form of courage."
  },
  "Ananda Bhairavi": {
    telugu: "ఆనందభైరవి", melakarta: "Janya of Natabhairavi (20th)", type: "Vakra sampurna",
    arohana: "S G₂ R₂ G₂ M₁ P D₂ P Ṡ", avarohana: "Ṡ N₂ D₂ P M₁ G₂ R₂ S",
    bhava: "Karuna and shanta — compassion, tenderness",
    note: "Borrows the D₂ that its parent scale does not have, which is where its warmth comes from. " +
      "The tradition credits it with a soothing, almost therapeutic quality and uses it for lullabies. " +
      "Ramadasu's most famous reproach is set in the gentlest ragam he could have chosen."
  },
  "Saveri": {
    telugu: "సావేరి", melakarta: "Janya of Mayamalavagowla (15th)", type: "Audava-sampurna",
    arohana: "S R₁ M₁ P D₁ Ṡ", avarohana: "Ṡ N₃ D₁ P M₁ G₃ R₁ S",
    bhava: "Karuna — pleading, supplication",
    note: "A five-note ascent and a full descent, with the flat second and sixth doing the emotional work. " +
      "The classic ragam of asking."
  },
  "Khamas": {
    telugu: "ఖమాస్", melakarta: "Janya of Harikambhoji (28th)", type: "Vakra audava-sampurna",
    arohana: "S M₁ G₃ M₁ P D₂ N₂ Ṡ", avarohana: "Ṡ N₂ D₂ P M₁ G₃ R₂ S",
    bhava: "Lightness, intimacy, coaxing",
    note: "An evening ragam that skips the second on the way up and leans on the madhyama. Its home is " +
      "the padam and the javali — the repertoire of persuasion. Exactly right for a street hawker's cry."
  },
  "Dhanyasi": {
    telugu: "ధన్యాసి", melakarta: "Janya of Natabhairavi (20th)", type: "Audava-sampurna",
    arohana: "S G₂ M₁ P N₂ Ṡ", avarohana: "Ṡ N₂ D₁ P M₁ G₂ R₁ S",
    bhava: "Bhakti with a plaintive edge",
    note: "Pentatonic going up, complete coming down — the shape gives it a rising simplicity and a " +
      "descending ache. A workhorse ragam of Telugu devotional song."
  },
  "Kanada": {
    telugu: "కానడ", melakarta: "Janya of Kharaharapriya (22nd)", type: "Vakra",
    arohana: "S R₂ G₂ M₁ D₂ N₂ Ṡ", avarohana: "Ṡ N₂ D₂ M₁ P G₂ M₁ R₂ S",
    bhava: "Gambhira — gravity, weight",
    note: "A crooked, deliberately winding ragam whose phrases refuse to travel in a straight line. " +
      "Serious without being sorrowful."
  },
  "Saurashtram": {
    telugu: "సౌరాష్ట్రం", melakarta: "Janya of Mayamalavagowla (15th)", type: "Vakra sampurna",
    arohana: "S R₁ G₃ M₁ P M₁ D₂ N₃ Ṡ", avarohana: "Ṡ N₃ D₂ N₃ P M₁ G₃ R₁ S",
    bhava: "Mangala — auspiciousness, assurance",
    note: "The ragam of benediction; the traditional mangalam that closes a concert is set in it. " +
      "A song arguing that nothing is lacking could hardly be anywhere else."
  },
  "Nadanamakriya": {
    telugu: "నాదనామక్రియ", melakarta: "Janya of Mayamalavagowla (15th)", type: "Descending-oriented",
    arohana: "(from the upper octave) Ṡ N₃ D₁ P M₁ G₃ R₁ S", avarohana: "Sung as a descent; phrases characteristically begin high and fall",
    bhava: "Deep karuna — pathos",
    note: "Unusual among ragams in that it is conceived as a falling shape, traditionally begun from the " +
      "upper note. Close to folk devotional idiom and hugely effective in bhajan. It is the sound of a " +
      "voice giving way."
  },
  "Bhairavi": {
    telugu: "భైరవి", melakarta: "Janya of Natabhairavi (20th)", type: "Sampurna (asymmetric dhaivata)",
    arohana: "S R₂ G₂ M₁ P D₂ N₂ Ṡ", avarohana: "Ṡ N₂ D₁ P M₁ G₂ R₂ S",
    bhava: "Devotion at scale — vastness",
    note: "Its signature is the two dhaivatas: the higher one going up, the lower one coming down. " +
      "A ragam with room in it."
  },
  "Keeravani": {
    telugu: "కీరవాణి", melakarta: "21st melakarta", type: "Sampurna",
    arohana: "S R₂ G₂ M₁ P D₁ N₃ Ṡ", avarohana: "Ṡ N₃ D₁ P M₁ G₂ R₂ S",
    bhava: "Longing, pathos",
    note: "The flat sixth against the sharp seventh gives Keeravani its characteristic catch. " +
      "Nearly identical in scale to the Western harmonic minor."
  },
  "Yadukula Kambhoji": {
    telugu: "యదుకుల కాంభోజి", melakarta: "Janya of Harikambhoji (28th)", type: "Audava-sampurna",
    arohana: "S R₂ M₁ P D₂ Ṡ", avarohana: "Ṡ N₂ D₂ P M₁ G₃ R₂ S",
    bhava: "Tenderness shading into grief",
    note: "Drops the third on the ascent, which is what makes it sound like restraint. " +
      "Often chosen for texts of complaint that are trying not to sound like complaints."
  }
};

/* ── The keertanas ────────────────────────────────────────────── */

const KRITIS = [
  {
    id: "rama-daya-judave",
    title: "Rama Daya Judave",
    telugu: "రామ దయ జూడవే",
    translit: "rāma daya jūḍavē",
    gloss: "\"Rama, show me your mercy\"",
    raga: "Bhairavi",
    ragaConfidence: "varies",
    ragaNote: "Genuinely unsettled. The Sangeetasudha collection files it under <strong>Bhairavi</strong>; " +
      "widely circulated lyric editions give <strong>Dhanyasi</strong>; some performance sources give " +
      "<strong>Keeravani</strong>. All three are sung. Talam is Adi in every source consulted. " +
      "This is the clearest illustration on the page of why ragam attribution for Ramadasu is a matter of lineage, not of fact.",
    tala: "Adi",
    navaratna: null,
    featured: true,
    article: { href: "rama-dayajudave/", label: "Read the full article" },
    bhava: "Sharanagati — surrender with nowhere else to go",
    summary: "A prayer built as a chain, in which the devotee offers the only currency he has left: " +
      "a crore of written names, and the intercession of the Mother.",

    pallavi: {
      telugu: "రామ దయ జూడవే భద్రాచల ధామా\nనను బ్రోవవే సీతా",
      translit: "rāma daya jūḍavē bhadrāchala dhāmā\nnanu brōvavē sītā",
      meaning: "Rama, look upon me with compassion — O Lord whose abode is Bhadrachala. Protect me, O Sita's own.",
      note: "<strong>On the text.</strong> Some printed and transliterated editions segment this line as <em>bhadrāchala rāmā</em> ('O Rama of Bhadrachala'). <em>Bhadrāchala dhāmā</em> — 'O Lord whose abode is Bhadrachala' — is the better-attested reading, and the one the bhajana tradition sings. Either way the sense is the same address, and either way the line ends on <em>sītā</em>."
    },
    anupallavi: {
      telugu: "రామా దయ జూచి రక్షించి మం మేలు\nరామా రణరంగ భీమా జగదభి",
      translit: "rāmā daya jūchi rakṣhiṁchi maṁ mēlu\nrāmā raṇaraṅga bhīmā jagadabhi",
      meaning: "Rama, look on me with mercy, protect me, do me good. Rama, terrible as Bhima on the field of battle, delight of the worlds."
    },
    charanams: [
      {
        num: 1,
        telugu: "రాజీవ దళ లోచనా భక్త\nపరాధీన భవ మోచన\nరాజ రాజ కుల రాజ రాజార్చిత\nరాజిత వైభవ రాజాల లామ",
        translit: "rājīva daḷa lōchanā bhakta\nparādhīna bhava mōchana\nrāja rāja kula rāja rājārchita\nrājita vaibhava rājāla lāma",
        meaning: "You whose eyes are lotus petals; you who are bound to your devotees and who cut the bond of birth; " +
          "king among kings, worshipped by kings of kings, of shining splendour, crest-jewel among rulers.",
        note: "Four lines; three of them open on <em>rā</em>, and the third sounds it four times over " +
          "(<em>rāja rāja kula rāja rājārchita</em>). The alliteration is not decoration — it is the name " +
          "being sounded underneath the sense of every word."
      },
      {
        num: 2,
        telugu: "తాటక సంహరణ మేటి\nకోటి రాక్షస హరణా\nనీ తుతో శ్రీ రామకోటి వ్రాసితి నీకు\nసాటిలేరని సారె సారెకు వేడితి",
        translit: "tāṭaka saṁharaṇa mēṭi\nkōṭi rākṣhasa haraṇā\nnī tutō śrī rāmakōṭi vrāsiti nīku\nsāṭilērani sāre sāreku vēḍiti",
        meaning: "Slayer of Tataka, destroyer of a crore of demons — with your own help I have written " +
          "<em>Sri Rama</em> a crore of times for you, and again and again I have begged of you, saying there is none your equal.",
        note: "<strong>Rama-koti</strong> — writing the name ten million times — is a real and still-practised sadhana. " +
          "The offering is deliberately worthless as property and priceless as labour: a man in prison with " +
          "nothing to give brings ink."
      },
      {
        num: 3,
        telugu: "దిక్కు నీవని నమ్మితి నీ పాదముల\nమక్కువ కని మ్రొక్కితి\nచిక్కుల పెట్టకు శ్రీ రామదాసుని\nచక్కగ బ్రోవవే చక్కని జానకి",
        translit: "dikku nīvani nammiti nī pādamula\nmakkuva kani mrokkiti\nchikkula peṭṭaku śrī rāmadāsuni\nchakkaga brōvavē chakkani jānaki",
        meaning: "I have trusted that you are my only direction; seeing love in your feet, I have bowed to them. " +
          "Do not leave me in tangles — protect Sri Ramadasa well, O lovely Janaki.",
        note: "The signature verse. Note where it lands: not on Rama, but on <strong>Janaki</strong>."
      }
    ],

    esoteric: [
      {
        head: "The chain: sītā-rāma, jagadabhi-rāma",
        text: "Read the joins. The pallavi ends on <em>sītā</em> — and the singer returns to <em>rāma daya jūḍavē</em>, " +
          "so the seam of the loop reads <strong>sītā-rāma</strong>. The anupallavi ends on the bare prefix " +
          "<em>jagadabhi</em>, which is not a word at all until the next <em>rāma</em> completes it: " +
          "<strong>jagadabhirāma</strong>, delight of the worlds. The song is stitched with the divine name at " +
          "every seam, so that the act of repeating it manufactures compounds no single line contains. " +
          "This is the <em>antādi</em> device — end-becomes-beginning — that Tamil devotion builds whole works on, " +
          "as in the <a href=\"../abhirami-andhadhi/\">Abhirami Andhadhi</a>. Here it is used in miniature, and it means " +
          "the kriti cannot be sung once. It has to be circled."
      },
      {
        head: "Ananya-gatitva — having nowhere else to go",
        text: "<em>Dikku nīvani nammiti</em> — \"I trusted that you are my direction.\" <em>Dikku</em> in Telugu carries both " +
          "senses at once: a compass direction, and a refuge. Classical sharanagati counts six limbs, and this is the " +
          "sharpest of them — <strong>ananya-gatitva</strong>, the state of having no other recourse. It is not a boast " +
          "of exclusive devotion. It is a confession of exhausted options, which the tradition holds to be the same thing."
      },
      {
        head: "Chikkulu — the knot, not the punishment",
        text: "He does not ask to be released, forgiven, or vindicated. He asks not to be left in <em>chikkulu</em> — " +
          "tangles, knots, snarls. The image is of thread, not of chains. What the bound soul needs is not a key " +
          "but a patient hand, and the yogic literature calls the same thing <em>granthi-bheda</em>, the untying of the knot."
      },
      {
        head: "Why the last word is Sita's",
        text: "Three verses of address to Rama close by turning to <em>chakkani Jānaki</em> — lovely Janaki. This is " +
          "<strong>purushakara</strong>, the doctrine of mediation: the Mother is approached because she does not judge " +
          "the case, only pleads it. Sri Vaishnava theology makes this structural — the jiva reaches Narayana through " +
          "Lakshmi — and Ramadasu makes it dramatic. He has spent the song arguing with the judge. In the last line he " +
          "stops arguing and goes to the one who will simply ask."
      },
      {
        head: "Tataka first",
        text: "Of all Rama's victories he opens with <em>tāṭaka saṁharaṇa</em> — a demoness killed by a boy on the road, " +
          "before Sita, before the bow, before Ravana. The commentarial reading is that Tataka is the first coarse " +
          "obstruction on any path, and that grace begins its work at the crudest layer, not the subtlest."
      }
    ],

    sahitya: "The sahityam is Telugu with a heavy Sanskrit overlay in the first charanam (<em>rājīva daḷa lōchanā</em>, " +
      "<em>bhava mōchana</em>) and pure colloquial Telugu in the third (<em>chikkula peṭṭaku</em>, <em>chakkaga</em>). " +
      "The drop in register is the drop in composure: he starts in the language of court poetry and ends in the language " +
      "of a man talking to his mother.",

    sources: [
      { label: "Sangeetasudha — ramA daya jooDavE (bhairavi, Adi)", url: "http://www.sangeetasudha.org/ramadasu/vol1/Ramadasu73.html" },
      { label: "Octaves Online — rāmā dayajūḍavē lyrics", url: "https://www.octavesonline.com/post/rama-dayajudave-lyrics" },
      { label: "Templesinindia — Rama Daya Judave with meaning", url: "https://templesinindiainfo.com/rama-daya-judave-in-english-and-meaning-ramadasu-keerthana/" },
      { label: "Rasikas.org — discussion of the meaning", url: "https://www.rasikas.org/forums/viewtopic.php?t=17642" }
    ]
  },

  {
    id: "paluke-bangaramayena",
    title: "Paluke Bangaramayena",
    telugu: "పలుకే బంగారమాయెనా",
    translit: "palukē baṅgāramāyenā",
    gloss: "\"Has your speech turned to gold?\"",
    raga: "Ananda Bhairavi",
    ragaConfidence: "established",
    ragaNote: "Ananda Bhairavi, Adi talam — consistent across sources. The setting in general circulation is " +
      "Balamuralikrishna's, from the 1950s.",
    tala: "Adi",
    navaratna: 3,
    featured: true,
    bhava: "Ninda-stuti — praise in the shape of a reproach",
    summary: "The most famous song in the corpus, and a complaint: God has gone silent, and the devotee " +
      "has decided to say so.",

    pallavi: {
      telugu: "పలుకే బంగారమాయెనా కోదండపాణి",
      translit: "palukē baṅgāramāyenā kōdaṇḍapāṇi",
      meaning: "Has your speech turned to gold, O wielder of the Kodanda bow?"
    },
    anupallavi: null,
    anupallaviNote: "Circulating editions treat this kriti as a pallavi with five charanams; the line usually " +
      "printed as anupallavi is charanam 1 in other editions.",
    charanams: [
      {
        num: 1,
        telugu: "పలుకే బంగారమాయె పిలిచిన పలుకవేమి\nకలలో నీ నామస్మరణ మరవను చక్కని తండ్రి",
        translit: "palukē baṅgāramāye pilachina palukavēmi\nkalalō nī nāmasmaraṇa maravanu chakkani taṇḍri",
        meaning: "Your speech has turned to gold. Why will you not answer when I call? " +
          "Even in my dreams I do not forget the remembrance of your name, my beautiful father."
      },
      {
        num: 2,
        telugu: "ఇరువుగనీ సుఖలోన పొరలిన ఉడుత భక్తికి\nకరుణించి బ్రోచితివని నెరనమ్మితి నిన్నే తండ్రి",
        translit: "iruvuganī sukhalōna poralina uḍuta bhaktiki\nkaruṇiṁchi brōchitivani neranammiti ninnē taṇḍri",
        meaning: "You showed mercy and protected even the squirrel, for the devotion of a creature rolling " +
          "in the sand — believing that, I have trusted you utterly, father."
      },
      {
        num: 4,
        telugu: "ఎంత వేడిన గాని తుంతైన దయ రాదు\nపంతము సేయ నేనెంతటి వాడను తండ్రి",
        translit: "enta vēḍina gāni tuntaina daya rādu\npantamu sēya nēnentaṭi vāḍanu taṇḍri",
        meaning: "However much I plead, not a particle of mercy comes. And who am I, father, to hold out in a contest of wills against you?"
      },
      {
        num: 5,
        telugu: "శరణాగతత్రాణ బిరుదాంకుడవు కావా\nకరుణించు భద్రాచల వర రామదాస పోష",
        translit: "śaraṇāgatatrāṇa birudāṅkuḍavu kāvā\nkaruṇiṁchu bhadrāchala vara rāmadāsa pōṣha",
        meaning: "Are you not the one who bears the title 'protector of those who have surrendered'? " +
          "Show mercy, O Bhadrachala's boon-giver, sustainer of Ramadasa."
      }
    ],
    charanamsNote: "Charanam 3 (on his own standing in the world) is omitted here because the circulating " +
      "transliterations differ materially and none could be corroborated. The full text is in the sources below.",

    esoteric: [
      {
        head: "Gold is not only precious — it is hoarded",
        text: "The metaphor is usually translated as \"your words have become as precious as gold,\" which is " +
          "half the sentence. Gold in Telugu idiom is also what is <em>locked away</em>. Ramadasu — jailed for " +
          "spending gold on a temple — accuses God of doing to speech what the treasury does to bullion: " +
          "keeping it in a vault. The man punished for giving gold away is complaining that God won't."
      },
      {
        head: "Ninda-stuti: the reproach as the highest praise",
        text: "Devotional Sanskrit and Telugu have a recognised genre — <strong>ninda-stuti</strong>, praise by " +
          "abuse — and a recognised mood, <em>pranaya-kalaha</em>, the lovers' quarrel. Only an intimate has " +
          "standing to accuse. When Ramadasu asks why God won't speak, the accusation presupposes a relationship " +
          "in which silence is a betrayal rather than a fact of nature. The complaint is the theology."
      },
      {
        head: "The squirrel argument",
        text: "The squirrel of charanam 2 is from the Setu-building episode: a creature that carried grains of " +
          "sand to the causeway while vanaras carried boulders, and whose effort Rama honoured. Ramadasu is not " +
          "telling a sweet story. He is making an argument from precedent — <em>you have already established that " +
          "you weigh sincerity and not magnitude; I am invoking your own ruling.</em>"
      },
      {
        head: "Holding God to His own title",
        text: "The final charanam reaches for <em>birudu</em> — a formal title of honour, the kind a king has " +
          "proclaimed before him. <em>Sharanagata-trana</em>, protector of the surrendered, is one of Rama's. " +
          "Ramadasu's closing move is legal rather than emotional: he does not ask for a favour, he asks the " +
          "Lord to be consistent with his own titulature. The devotee cannot compel God, but he can point out " +
          "what God has publicly promised to be."
      },
      {
        head: "The gentlest ragam for the harshest text",
        text: "A song of accusation set in Ananda Bhairavi — the ragam the tradition reserves for lullabies and " +
          "credits with a healing quality. The music refuses to be angry with the words. The effect in performance " +
          "is that the reproach arrives sounding like tenderness, which is the truth about it."
      }
    ],

    sahitya: "Note the address: <em>chakkani taṇḍri</em>, beautiful father, twice. Not Lord, not king — father. " +
      "Every hard line in the kriti is aimed at someone he is calling by a domestic name.",

    sources: [
      { label: "Wikipedia — Paluke Bangaaramaayena", url: "https://en.wikipedia.org/wiki/Paluke_Bangaaramaayena" },
      { label: "Chivukulas — lyrics and meaning", url: "https://www.chivukulas.com/2019/07/lyrics-and-meaning-of-ramadasu-keertana-paluke-bangaramayena.html" },
      { label: "Vaidika Vignanam — Paluke Bangaaramaayena", url: "https://vignanam.org/english/ramadasu-keerthanas-paluke-bangaaramaayena.html" },
      { label: "Bhadrachalaramadasu.com — Navaratna 3", url: "https://bhadrachalaramadasu.com/68-paluke-bangaramayena/" }
    ]
  },

  {
    id: "adigo-bhadradri",
    title: "Idigo Bhadradri",
    altTitle: "Adigo Bhadradri",
    telugu: "ఇదిగో భద్రాద్రి",
    translit: "idigō bhadrādri",
    gloss: "\"Here is Bhadradri — look!\"",
    raga: "Varali",
    ragaConfidence: "established",
    ragaNote: "Varali is consistent across sources for this kriti. It opens the Navaratna set.",
    tala: "Adi",
    navaratna: 1,
    featured: true,
    bhava: "Darshana — the act of showing",
    summary: "A song that does nothing but point at a building. The building is the one he went to prison for.",

    pallavi: {
      telugu: "ఇదిగో భద్రాద్రి గౌతమి అదిగో చూడండి",
      translit: "idigō bhadrādri gautami adigō chūḍaṇḍi",
      meaning: "Here is Bhadradri; there is the Gautami — look, all of you."
    },
    anupallavi: null,
    charanams: [
      {
        num: 1,
        telugu: "ముదముతో సీత ముదిత లక్ష్మణుడు\nకదసి కొలువగా కలడదే రఘుపతి",
        translit: "mudamutō sīta mudita lakṣhmaṇuḍu\nkadasi koluvagā kaladadē raghupati",
        meaning: "With Sita in joy and Lakshmana gladdened, standing close in attendance — there indeed is Raghupati."
      },
      {
        num: 2,
        telugu: "చారు స్వర్ణ ప్రాకార గోపుర ద్వారములతో\nసుందరమై యుండెడి",
        translit: "chāru svarṇa prākāra gōpura dvāramulatō\nsundaramai yuṇḍeḍi",
        meaning: "With its lovely golden rampart walls, its tower and its gateways, it stands beautiful."
      },
      {
        num: 3,
        telugu: "అనుపమానమై అతిసుందరమై\nతనరు చక్రమది ధగ ధగ మెరిసెడి",
        translit: "anupamānamai atisundaramai\ntanaru chakramadi dhaga dhaga meriseḍi",
        meaning: "Beyond compare and exceedingly beautiful, that chakra shines out flashing — dhaga, dhaga."
      }
    ],

    esoteric: [
      {
        head: "The grammar of pointing",
        text: "<em>Idigō</em> — here it is, near. <em>Adigō</em> — there it is, far. Telugu has separate " +
          "demonstratives for the thing in your hand and the thing on the horizon, and the pallavi uses both in " +
          "one breath: the hill is <em>here</em>, the river is <em>there</em>. The whole kriti is deixis. " +
          "There is no petition anywhere in it. After a corpus of asking, this is the one song that only shows."
      },
      {
        head: "The itemised prison sentence, sung as praise",
        text: "The <em>svarṇa prākāra</em> — the golden rampart — and the <em>gopura dvāramulu</em> are not generic " +
          "temple furniture. They are specific construction line-items, and elsewhere in his corpus " +
          "(<a href=\"#kriti-ikshvaku-kula-tilaka\">Ikshvaku Kula Tilaka</a>) Ramadasu prices them to the varaha. " +
          "The same masonry appears in one song as a legal defence and in this one as pure delight, with no trace " +
          "of grievance. Read the two together and you have the man's entire character."
      },
      {
        head: "Why Varali, of all ragams",
        text: "Varali is the least comfortable ragam in the repertoire — angular, prati-madhyama, tradition-bound " +
          "with warnings. It is a strange choice for a tourist's-eye view of a temple, unless the point is that " +
          "what he is pointing at is not, finally, a building. Varali makes the gopuram look like an apparition."
      },
      {
        head: "Dhaga dhaga",
        text: "<em>Dhaga dhaga meriseḍi</em> — the flashing of the golden chakra rendered as raw onomatopoeia. " +
          "Sanskritic devotional poetry would reach for a simile. Ramadasu reaches for a noise. It is the moment " +
          "the classical register drops out of the song and a Telugu villager says: look at it <em>flash</em>."
      }
    ],

    sahitya: "The Gautami is the Godavari — specifically the branch that flows past Bhadrachalam, named for " +
      "the sage Gautama. Naming the river by its sacred name rather than its map name places the temple in " +
      "puranic geography rather than Qutb Shahi administrative geography. A small, deliberate act of relocation.",

    sources: [
      { label: "Chivukulas — Idigo Bhadradri with meaning", url: "https://www.chivukulas.com/2019/07/lyrics-of-ramadasu-keerthana-idigo-bhadradri.html" },
      { label: "Vaidika Vignanam — Adigo Bhadradri", url: "https://vignanam.org/english/adigo-bhadradri.html" },
      { label: "Bhaktinidhi — Adigo Bhadradri lyrics", url: "https://bhaktinidhi.com/en/adigo-bhadradri-lyrics-in-english-ramadasu-keerthana/" }
    ]
  },

  {
    id: "sri-rama-namame",
    title: "Sri Rama Namame Jihvaku",
    telugu: "శ్రీరామ నామమే జిహ్వకు",
    translit: "śrīrāma nāmamē jihvaku",
    gloss: "\"Rama's name alone, firm upon the tongue\"",
    raga: "Atana",
    ragaConfidence: "established",
    ragaNote: "Atana. Talam is given as Adi in most editions and as tisra eka in some notated versions.",
    tala: "Adi (tisra eka in some editions)",
    navaratna: 2,
    featured: false,
    bhava: "Veera-bhakti — devotion as resolve",
    summary: "The corpus's clearest statement of nama-siddhanta: the doctrine that the Name is not a " +
      "reference to God but a form of God.",

    pallavi: {
      telugu: "శ్రీరామ నామమే జిహ్వకు స్థిరమై",
      translit: "śrīrāma nāmamē jihvaku sthiramai",
      meaning: "Sri Rama's name alone, standing firm upon my tongue — his compassion alone is the root of whatever good I have."
    },
    anupallavi: null,
    charanams: [],
    charanamsNote: "The charanams — on the name destroying grievous sin, poverty and misery, and on devotion " +
      "to Narayana as the source of prosperity — are given in the sources below. Circulating transliterations " +
      "differ enough that no verse text is reproduced here.",

    esoteric: [
      {
        head: "Sthiramai — the word the whole kriti turns on",
        text: "<em>Sthira</em> means fixed, steady, established. Not <em>on</em> the tongue but <em>firm</em> upon it. " +
          "Japa has a recognised progression — spoken, then whispered, then mental, then <em>ajapa</em>, the " +
          "repetition that continues without a repeater. <em>Sthiramai</em> names the hinge: the point at which " +
          "the devotee stops doing the japa and the japa keeps going."
      },
      {
        head: "Nama-siddhanta",
        text: "The southern bhakti schools hold that the Name is <em>nama-brahman</em> — not a label attached to a " +
          "deity but the deity in audible form, and therefore not less powerful than the deity's presence. This is " +
          "why the tradition of Ramadasu, Tyagaraja and the Nama Siddhanta acharyas can claim that chanting is " +
          "sufficient — not a preliminary to something better. The pallavi's <em>nāmamē</em>, with its emphatic " +
          "<em>-ē</em>, is that doctrine in one syllable: the name <em>alone</em>."
      },
      {
        head: "Valour for a song about a syllable",
        text: "Atana is the veera ragam — brisk, martial, the sound of resolve. Setting a song about holding a " +
          "name on the tongue in the ragam of warriors makes an argument that the text never states outright: " +
          "that constancy is not a passive virtue. Keeping one syllable steady for a lifetime is the heroism " +
          "available to someone with no army."
      }
    ],

    sahitya: "Beware of a near-namesake: <em>Sri Rama nee namamu jihvaku</em>, a keertana of Kaivara Amara " +
      "Narayana, circulates under confusingly similar titles. The Ramadasu Navaratna is <em>Srirama nāmamē " +
      "jihvaku sthiramai</em>.",

    sources: [
      { label: "Sangeetasudha — SrirAma nAmamE", url: "http://www.sangeetasudha.org/ramadasu/vol1/Ramadasu25.html" },
      { label: "Navaratna Keertanas (English) — bhadrachalaramadasu.com", url: "http://bhadrachalaramadasu.com/wp-content/uploads/2016/12/navaratna-keertanas-eng-150820071709-lva1-app6891.pdf" }
    ]
  },

  {
    id: "sri-ramula-divyanama",
    title: "Sri Ramula Divya Nama Smarana",
    telugu: "శ్రీరాముల దివ్యనామ స్మరణ",
    translit: "śrīrāmula divyanāma smaraṇa",
    gloss: "\"Remembrance of Rama's divine name — that is enough\"",
    raga: "Saveri",
    ragaConfidence: "established",
    ragaNote: "Saveri. The fourth of the Navaratna set.",
    tala: "Adi",
    navaratna: 4,
    featured: false,
    bhava: "Sufficiency — the closing of options",
    summary: "An argument against spiritual shopping, ending in an ethics so plain it is almost an anticlimax.",

    pallavi: {
      telugu: "శ్రీరాముల దివ్యనామ స్మరణ చాలు",
      translit: "śrīrāmula divyanāma smaraṇa chālu",
      meaning: "The remembrance of Sri Rama's divine name is enough. Why do you go searching here and there among other gods?"
    },
    anupallavi: null,
    charanams: [],
    charanamsNote: "The charanams turn from doctrine to conduct — do no harm to others; feed those who are " +
      "hungry — presented as the substance of devotion rather than as its by-product. Full text in the sources below.",

    esoteric: [
      {
        head: "Chalu — 'enough'",
        text: "The whole kriti hangs on one flat Telugu word: <em>chālu</em>, enough, that's sufficient, stop there. " +
          "It is not a mystical word. It is what you say to someone still pouring. Against the vast apparatus of " +
          "ritual available to a 17th-century Telugu brahmin — vratas, kshetras, deities for every affliction — " +
          "Ramadasu's position is a shrug: this is enough."
      },
      {
        head: "Ananya-bhakti, stated as common sense",
        text: "The technical doctrine is <em>devatantara-parigraha-nishedha</em> — the prohibition on hedging your " +
          "devotion across deities. In the theological literature it is argued at length. Here it is a rhetorical " +
          "question put to a neighbour: why are you looking around?"
      },
      {
        head: "Where the song actually lands",
        text: "It would be easy to expect a kriti on the sufficiency of the Name to end in ecstasy. It ends in " +
          "two instructions: don't hurt anyone, and feed the hungry. The most doctrinally ambitious claim in the " +
          "corpus is cashed out as table manners. That collapse — from nama-siddhanta straight into conduct, " +
          "with nothing in between — is the characteristic move of the Nama Sankeerthanam tradition, and the " +
          "reason it stayed a people's practice rather than a scholar's one."
      }
    ],

    sahitya: null,

    sources: [
      { label: "Bhadrachalaramadasu.com — Navaratna 4", url: "https://bhadrachalaramadasu.com/4-sree-ramula-divyanama/" },
      { label: "Templesinindia — Sri Ramula Divya Nama lyrics", url: "https://templesinindiainfo.com/sri-ramula-divya-nama-lyrics-in-telugu-ramadasu-keerthana/" }
    ]
  },

  {
    id: "ramajogi-mandu",
    title: "Ramajogi Mandu Konare",
    telugu: "రామజోగి మందు కొనరే",
    translit: "rāmajōgi mandu konarē",
    gloss: "\"Buy the Rama-ascetic's medicine!\"",
    raga: "Khamas",
    ragaConfidence: "varies",
    ragaNote: "The Navaratna publication gives <strong>Khamas</strong>; the Sangeetasudha collection files it " +
      "under <strong>Nadanamakriya</strong>; karnatik.com gives Kamas. Adi talam throughout.",
    tala: "Adi",
    navaratna: 5,
    featured: true,
    bhava: "Playfulness carrying a hard doctrine",
    summary: "A street hawker's cry for a medicine that cannot be bought — the corpus's wittiest song and " +
      "its most exacting one.",

    pallavi: {
      telugu: "రామజోగి మందు కొనరే",
      translit: "rāmajōgi mandu konarē",
      meaning: "Buy the Rama-ascetic's medicine, won't you!"
    },
    anupallavi: null,
    charanams: [],
    charanamsNote: "The charanams work the metaphor out: taken wholeheartedly, this medicine uproots lust and " +
      "anger; it dispels arrogance, envy and greed instantly; it clears sins piled up like jet-black mountains; " +
      "it is the one medicine of its kind in this world; it cannot be had for crores of rupees — only the ardent " +
      "devotee obtains it, by meditating on Rama. Full text in the sources below.",

    esoteric: [
      {
        head: "The medicine is for the arishadvarga",
        text: "The ailments named — <em>kama</em> (lust), <em>krodha</em> (anger), <em>mada</em> (arrogance), " +
          "<em>matsarya</em> (envy), <em>lobha</em> (greed) — are not a random list of vices. They are the " +
          "<strong>arishadvarga</strong>, the six inner enemies of classical Indian ethics. Ramadasu has taken " +
          "a formal taxonomy and put it on a medicine label."
      },
      {
        head: "Konare — the paradox in the verb",
        text: "<em>Konarē</em> is the imperative of buying, the cry of a hawker working a street. And then the " +
          "charanam says the thing cannot be bought for crores. The song sells what is not for sale. " +
          "The doctrine underneath is <em>akraya</em> — grace is not purchasable — but Ramadasu does not state " +
          "it as doctrine. He stages a marketplace and lets the customer discover that his money is no good here. " +
          "The only currency accepted is dhyana."
      },
      {
        head: "Rama as a wandering physician",
        text: "<em>Jogi</em> is the Telugu form of <em>yogi</em>, but in street usage it means the itinerant " +
          "mendicant — and itinerant mendicants sold remedies. To cast Rama, prince of Ayodhya, as a travelling " +
          "quack with a satchel is an act of deliberate deflation, and a very old one: the Buddha is the " +
          "great physician, Krishna is the cowherd. Bhakti routinely dresses God in a working man's clothes " +
          "because a king can be petitioned but a hawker can be haggled with."
      },
      {
        head: "Khamas and the art of persuasion",
        text: "Khamas is the ragam of the padam and the javali — the repertoire of coaxing, flirtation, " +
          "persuasion. If the attribution is right, the choice is exact: a sales pitch needs the ragam that " +
          "knows how to wheedle. Note that the competing attribution, Nadanamakriya, would make it a very " +
          "different song — a hawker's cry in the ragam of pathos. Both are sung. Both are defensible."
      }
    ],

    sahitya: null,

    sources: [
      { label: "Sangeetasudha — rAma jOgi mandu (nAdanAma kriya, Adi)", url: "http://www.sangeetasudha.org/ramadasu/g27.html" },
      { label: "Templesinindia — Rama Jogi Mandu Konare with meaning", url: "https://templesinindiainfo.com/rama-jogi-mandu-konare-lyrics-in-english-and-meaning/" },
      { label: "Karnatik.com — rAmajOgi mandu", url: "https://www.karnatik.com/c2501.shtml" },
      { label: "Bhadrachalaramadasu.com — Navaratna 5", url: "http://bhadrachalaramadasu.com/82-ramajogi-mandu/" }
    ]
  },

  {
    id: "taraka-mantramu",
    title: "Taraka Mantramu Korina Dorikenu",
    telugu: "తారక మంత్రము కోరిన దొరికెను",
    translit: "tāraka mantramu kōrina dorikenu",
    gloss: "\"I sought the Taraka mantra, and I found it\"",
    raga: "Dhanyasi",
    ragaConfidence: "established",
    ragaNote: "Dhanyasi, Adi talam.",
    tala: "Adi",
    navaratna: 6,
    featured: false,
    bhava: "Ananda — the joy of a completed search",
    summary: "The one unambiguously happy song in the set: a man who has found what he was looking for, " +
      "and it turned out to be a syllable.",

    pallavi: {
      telugu: "తారక మంత్రము కోరిన దొరికెను\nధన్యుడనైతి నోరన",
      translit: "tāraka mantramu kōrina dorikenu\ndhanyuḍanaitini ōrana",
      meaning: "I sought the Taraka mantra and I found it — I have become blessed, my friend."
    },
    anupallavi: null,
    charanams: [],
    charanamsNote: "The charanams celebrate the mantra as the remedy that dispels accumulated sin, breaks the " +
      "round of birth and death, and grants liberation. Full text in the sources below.",

    esoteric: [
      {
        head: "Taraka — that which ferries you across",
        text: "The root is <em>tṛ</em>, to cross. A <em>taraka</em> is a ferry, and the <em>Advaya Taraka " +
          "Upanishad</em> gives the etymology in doctrinal form: it is called Taraka because it carries one " +
          "across the fear of the womb, of birth, of old age, of death. The Rama-taraka mantra — " +
          "<em>Sri Rama Rama Rameti</em> — is the specific referent, and the Tarakabrahma tradition holds it " +
          "equal in fruit to the thousand names."
      },
      {
        head: "The grammar of finding",
        text: "<em>Kōrina dorikenu</em> — \"having sought, it was found.\" Then immediately: " +
          "<em>dhanyuḍanaitini</em>, \"I have become blessed.\" Not <em>I will be</em> blessed, not <em>I hope " +
          "to be</em>. The past tense is the theological content. In a corpus full of unanswered petitions, " +
          "this is the one kriti in the perfect tense, and what completes it is not a rescue or a vision — " +
          "it is having been given the words."
      },
      {
        head: "Orana",
        text: "The pallavi ends by addressing not God but a person — <em>ōrana</em>, a familiar, slightly rough " +
          "Telugu vocative, roughly \"hey, you.\" Every other kriti here is aimed upward. This one turns sideways " +
          "and tells a neighbour. That turn is the entire social mechanism of Nama Sankeerthanam: the discovery " +
          "is not complete until it is passed along."
      },
      {
        head: "Dhanyasi's two halves",
        text: "Dhanyasi climbs on five notes and comes down on seven. The ascent is bare and quick; the descent " +
          "has the extra steps that let it ache. A song about joy arrived at through long deprivation gets a " +
          "ragam shaped exactly that way."
      }
    ],

    sahitya: null,

    sources: [
      { label: "Vaidika Vignanam — Taraka Mantramu", url: "https://vignanam.org/english/taraka-mantramu.html" },
      { label: "Bhaktinidhi — Taraka Mantramu lyrics", url: "https://bhaktinidhi.com/en/taraka-mantramu-korina-dorikenu-lyrics-in-english-ramadasu-keerthana/" },
      { label: "Octaves Online — tāraka mantramu lyrics", url: "https://www.octavesonline.com/post/taraka-mantramu-lyrics" }
    ]
  },

  {
    id: "hari-hari-rama",
    title: "Hari Hari Rama",
    telugu: "హరి హరి రామ",
    translit: "hari hari rāma",
    gloss: "\"Hari, Hari, Rama — do not think me low\"",
    raga: "Kanada",
    ragaConfidence: "varies",
    ragaNote: "The Navaratna publication gives <strong>Kanada</strong>; Sangeetasudha files a closely related " +
      "text as <em>hari hara rāma</em> in <strong>Kannada</strong> ragam, Adi. Titles and ragam names are close " +
      "enough here that editions are easily conflated.",
    tala: "Adi",
    navaratna: 7,
    featured: false,
    bhava: "Karpanya — the plea of the unworthy",
    summary: "The devotee's argument that his own wretchedness is his qualification.",

    pallavi: {
      telugu: "హరి హరి రామ",
      translit: "hari hari rāma",
      meaning: "Hari, Hari, Rama — do not look down on me, for I chant your sacred name always."
    },
    anupallavi: null,
    charanams: [],
    charanamsNote: "The charanams praise Rama as Dasharatha's beloved son, destroyer of the ten-headed Ravana, " +
      "delight of Shiva and eradicator of sin; they invoke his reputation for redeeming the fallen, name " +
      "Bhadragiri as his abode, and ask for protection. Full text in the sources below.",

    esoteric: [
      {
        head: "Patita-pavana requires the fallen",
        text: "Rama's title <em>patita-pavana</em> — purifier of the fallen — is the hinge of this kriti's logic. " +
          "A redeemer of the fallen needs fallen people; the unworthy are not an embarrassment to the title but " +
          "its precondition. So the devotee presses his own unworthiness forward as his credential. " +
          "The Alvars do the same thing, and Kulasekhara does it most nakedly. It is not humility as decoration. " +
          "It is a claim."
      },
      {
        head: "Karpanya",
        text: "The formal name for this is <strong>karpanya</strong> — the sense of one's own helplessness — " +
          "counted among the limbs of sharanagati. The doctrine insists it is not self-abasement, because " +
          "self-abasement is still a performance of self. Karpanya is the abandonment of the case for oneself. " +
          "'Do not think me low' is not a denial of lowness; it is a request that lowness be irrelevant."
      },
      {
        head: "Why the doubled Hari",
        text: "<em>Hari hari</em> — the name repeated before the sentence begins. In Telugu and Marathi bhajan " +
          "usage the doubled name functions as both invocation and sigh; it is the sound of someone gathering " +
          "themselves to speak. The kriti opens with the name because it opens with the only thing the singer " +
          "claims to possess."
      }
    ],

    sahitya: null,

    sources: [
      { label: "Bhadrachalaramadasu.com — Navaratna 7", url: "https://bhadrachalaramadasu.com/7-hari-hari-rama/" },
      { label: "Sangeetasudha — hari hara rAma (kannaDa, Adi)", url: "http://www.sangeetasudha.org/ramadasu/vol1/Ramadasu21.html" }
    ]
  },

  {
    id: "takkuvemi-manaku",
    title: "Takkuvemi Manaku",
    telugu: "తక్కువేమి మనకు",
    translit: "takkuvēmi manaku",
    gloss: "\"What do we lack?\"",
    raga: "Saurashtram",
    ragaConfidence: "established",
    ragaNote: "Saurashtram, Adi talam. The eighth of the Navaratna set.",
    tala: "Adi",
    navaratna: 8,
    featured: true,
    bhava: "Dhairya — confidence, reassurance",
    summary: "A rhetorical question answered ten times over, by walking through the avataras one by one.",

    pallavi: {
      telugu: "తక్కువేమి మనకు రాముండొక్కడుండు వరకు",
      translit: "takkuvēmi manaku rāmuṇḍokkaḍuṇḍu varaku",
      meaning: "What do we lack, so long as the one Rama is there? What do we lack, when the bearer of the discus stands near us?"
    },
    anupallavi: null,
    charanams: [
      {
        num: 1,
        telugu: null,
        translit: "matsyāvatāramuna … sōmakuni …",
        meaning: "In the Matsya avatara he destroyed the deceitful Somaka — when he is on our side, what do we lack?",
        note: "The charanams proceed through the avataras — Matsya, Kurma, Varaha, Vamana, Parashurama, Rama, " +
          "Balarama, Krishna, Kalki — each with its deed, each answered by the same refrain. Circulating " +
          "transliterations vary; the full text is in the sources below."
      }
    ],

    esoteric: [
      {
        head: "An argument from the record, not from faith",
        text: "This is not a song saying <em>God will help us</em>. It is a song saying <em>look at what he has " +
          "already done</em> — and then producing ten pieces of evidence in sequence. The avatara-krama is being " +
          "used as case law. Each verse is a precedent; the refrain is the ruling drawn from it. It is the same " +
          "forensic instinct that shows up in <a href=\"#kriti-paluke-bangaramayena\">Paluke Bangaramayena</a>'s " +
          "squirrel and in <a href=\"#kriti-ikshvaku-kula-tilaka\">Ikshvaku Kula Tilaka</a>'s ledger. " +
          "Ramadasu, in the end, was a revenue officer, and he argues like one."
      },
      {
        head: "Okkadu — the one",
        text: "<em>Rāmuṇḍokkaḍuṇḍu</em> — \"Rama, one, exists.\" The numeral is doing theology. Against the " +
          "crowded pantheon the singer sets a count of one, and against every conceivable lack he sets a single " +
          "presence. It is the arithmetic answer to <a href=\"#kriti-sri-ramula-divyanama\">Sri Ramula Divya " +
          "Nama</a>'s question about searching among many gods."
      },
      {
        head: "Saurashtram, the benediction ragam",
        text: "Saurashtram is where the traditional <em>mangalam</em> lives — the auspicious closing piece of a " +
          "concert. Setting a song of reassurance in the ragam of benediction means the music makes the claim " +
          "before the words do. By the time the first avatara is named, the listener has already been told that " +
          "everything is going to be all right."
      }
    ],

    sahitya: "Note the pronoun: <em>manaku</em>, to <strong>us</strong>, not to me. Alone in this set of songs, " +
      "this one is not a private address to God. It is a man turning to the people around him. That is what makes " +
      "it a sankeerthanam rather than a prayer, and it is why it survives as a group piece.",

    sources: [
      { label: "Templesinindia — Takkuvemi Manaku with meaning", url: "https://templesinindiainfo.com/takkuvemi-manaku-lyrics-in-english-and-meaning-ramadasu-keerthana/" },
      { label: "Bhadrachalaramadasu.com — Navaratna 8", url: "https://bhadrachalaramadasu.com/8-takkuvami-manaku/" },
      { label: "Karnatik.com — takkuvEmi manaku", url: "https://www.karnatik.com/c16023.shtml" }
    ]
  },

  {
    id: "kantinedu-ma-ramula",
    title: "Kantinedu Ma Ramula",
    telugu: "కంటినేడు మా రాముల",
    translit: "kaṇṭinēḍu mā rāmula",
    gloss: "\"Today I saw our Rama\"",
    raga: "Nadanamakriya",
    ragaConfidence: "established",
    ragaNote: "Nadanamakriya. The ninth and closing kriti of the Navaratna set.",
    tala: "Adi",
    navaratna: 9,
    featured: false,
    bhava: "Darshana-ananda — the joy of having seen",
    summary: "The set closes on a completed seeing — in the ragam of weeping.",

    pallavi: {
      telugu: "కంటినేడు మా రాముల కనుగొంటి నేను",
      translit: "kaṇṭinēḍu mā rāmula kanugoṇṭi nēnu",
      meaning: "Today I have seen our Rama; I have found the Lord who protects the hosts of his devotees — " +
        "our family deity, who graced Bhadragiri."
    },
    anupallavi: null,
    charanams: [],
    charanamsNote: "The charanams describe the beauty of Rama's form and his protecting grace over those who " +
      "seek him. Full text in the sources below.",

    esoteric: [
      {
        head: "The past tense as the whole point",
        text: "<em>Kaṇṭinēḍu</em> — \"today I saw.\" After a corpus of vocatives and imperatives — show mercy, " +
          "protect me, speak to me — the ninth gem arrives in the completed past. Nothing is being asked for. " +
          "The Navaratna set is sequenced so that it ends here, and that sequence is itself an argument: " +
          "the asking resolves into a seeing."
      },
      {
        head: "Ma ramula — our Rama",
        text: "Not <em>Sri Rama</em>, not <em>Raghupati</em>. <em>Mā rāmula</em> — <strong>our</strong> Rama, " +
          "with the possessive that Telugu families use for the <em>kula-daivam</em>, the household deity. " +
          "The god of the Ramayana is vast; the god of this line belongs to a specific family in a specific " +
          "district and has been theirs for generations. Bhakti's characteristic move is not to make the small " +
          "large but to make the large small enough to hold."
      },
      {
        head: "Why joy sounds like grief",
        text: "Nadanamakriya is the ragam of deep pathos — falling phrases, begun from above, close to folk " +
          "lament. Setting the moment of fulfilled darshana in it is not a contradiction. The tradition is " +
          "clear-eyed about this: the tears of longing and the tears of arrival are the same tears, and " +
          "<em>ananda-bashpa</em>, the tear of joy, is counted among the marks of devotion. " +
          "The ragam does not change when the news does."
      }
    ],

    sahitya: null,

    sources: [
      { label: "Sangeetasudha — kanTi nEDu", url: "http://www.sangeetasudha.org/ramadasu/vol1/Ramadasu12.html" },
      { label: "Templesinindia — Kanti Nedu Ma Ramula lyrics", url: "https://templesinindiainfo.com/kanti-nedu-ma-ramula-lyrics-in-english-ramadasu-keerthana/" },
      { label: "Bhadrachalaramadasu.com — Navaratna 9", url: "https://bhadrachalaramadasu.com/9-kantinedu-maa-ramula-ragam/" }
    ]
  },

  {
    id: "ikshvaku-kula-tilaka",
    title: "Ikshvaku Kula Tilaka",
    telugu: "ఇక్ష్వాకు కుల తిలక",
    translit: "ikṣhvāku kula tilaka",
    gloss: "\"Ornament of the Ikshvaku line — will you not speak even now?\"",
    raga: "Yadukula Kambhoji",
    ragaConfidence: "varies",
    ragaNote: "Commonly given as <strong>Yadukula Kambhoji, misra chapu</strong>; other renderings circulate. " +
      "The Sanskrit-heavy text is set differently by different schools.",
    tala: "Misra Chapu",
    navaratna: null,
    featured: true,
    bhava: "The ledger — audacity, from inside a prison",
    summary: "The most extraordinary document in the corpus: a devotional song that is also an itemised " +
      "expense claim, submitted to God.",

    pallavi: {
      telugu: "ఇక్ష్వాకు కుల తిలక ఇక నైన బలుకవు\nరామచంద్ర నన్ను రక్షింపకున్నను\nరక్షకులెవరింక రామచంద్ర",
      translit: "ikṣhvāku kula tilaka ika naina balukavu\nrāmachandra nannu rakṣhimpakunnanu\nrakṣhakulevariṅka rāmachandra",
      meaning: "Ornament of the Ikshvaku line — will you not speak even now? Ramachandra, if you will not " +
        "protect me, who else is there to protect me, Ramachandra?"
    },
    anupallavi: null,
    charanams: [
      {
        num: 1,
        telugu: null,
        translit: "padivēla varāhālosaṅgi … prākāramu … kaṭṭinchi …",
        meaning: "Spending ten thousand varahas I had the rampart walls built around your temple; I had the " +
          "pavilions raised in the towers. Do not treat me as a stranger, Ramachandra — protect me.",
        note: "Subsequent charanams continue the accounting: the ornaments and costly gifts made to Bharata, " +
          "Shatrughna, Lakshmana and Mother Sita, each with its cost. Circulating transliterations vary; " +
          "full text in the sources below."
      }
    ],

    esoteric: [
      {
        head: "An invoice as an act of worship",
        text: "No other major devotional composer does this. Ramadasu names sums. Ten thousand varahas for the " +
          "prakara; itemised gifts for Rama's brothers and for Sita. Sung from prison, where he was held for " +
          "precisely this expenditure, the ledger is doing double duty — it is his legal defence before the " +
          "Nawab and his claim before God, in the same words. The tradition has a name for this nerve: " +
          "<em>bhakti-dhārṣṭya</em>, devotional audacity. It is permitted because it presumes intimacy: " +
          "you present a bill only to family."
      },
      {
        head: "Ika naina — 'even now'",
        text: "Two small words carry the twelve years. <em>Ika naina balukavu</em> — will you not speak <em>even " +
          "now</em>? The phrase implies everything that has already been tried and everything that has already " +
          "been endured. It is the same silence <a href=\"#kriti-paluke-bangaramayena\">Paluke Bangaramayena</a> " +
          "calls gold, and here it is simply timed."
      },
      {
        head: "Rakshakulevarinka — the closing of every other door",
        text: "\"Who else is there to protect me?\" Formally this is <strong>ananya-gatitva</strong>, the state " +
          "of having no other recourse, and it recurs across the corpus (see " +
          "<a href=\"#kriti-rama-daya-judave\">Rama Daya Judave</a>'s <em>dikku nīvani nammiti</em>). " +
          "The doctrinal claim is severe: surrender only becomes real when the alternatives are gone, which is " +
          "why the tradition treats calamity as an opportunity rather than an obstacle."
      },
      {
        head: "Do not treat me as a stranger",
        text: "The plea is not for mercy but for <em>recognition</em> — don't handle me as an outsider. " +
          "For a man whose crime was treating temple funds as family funds, the line is exact. He is asking the " +
          "deity to confirm the very relationship the state has just declared to be embezzlement."
      }
    ],

    sahitya: "The <em>varaha</em> was the gold coin of the Deccan, and the sums are plausible for the " +
      "construction described. This is one of the few places in Telugu devotional literature where the " +
      "sahityam doubles as an archival record of temple building.",

    sources: [
      { label: "Vaidika Vignanam — Ikshvaku Kula Tilaka", url: "https://vignanam.org/english/ramadasu-keerthanas-ikshvaku-kula-tilaka.html" },
      { label: "Templesinindia — Ikshvaku Kula Tilaka with meaning", url: "https://templesinindiainfo.com/ikshvaku-kula-tilaka-lyrics-in-english-and-meaning-ramadasu-keerthana/" },
      { label: "Rasikas.org — ikshvAku kula tilaka discussion", url: "https://rasikas.org/forums/viewtopic.php?t=16523" }
    ]
  },

  {
    id: "ee-teeruga-nanu",
    title: "Ee Teeruga Nanu Daya Juchedavo",
    telugu: "ఏ తీరుగ నను దయ చూచెదవో",
    translit: "ē tīruga nanu daya chūchedavō",
    gloss: "\"In what manner will you show me mercy?\"",
    raga: "Nadanamakriya",
    ragaConfidence: "established",
    ragaNote: "Nadanamakriya. Carried to a mass audience by the 1980 Telugu film <em>Sankarabharanam</em>.",
    tala: "Adi",
    navaratna: null,
    featured: true,
    bhava: "Certainty inside uncertainty",
    summary: "The question is not whether mercy will come. It is what shape it will arrive in.",

    pallavi: {
      telugu: "ఏ తీరుగ నను దయ చూచెదవో\nఇనవంశోత్తమ రామా",
      translit: "ē tīruga nanu daya chūchedavō\ninavaṁśōttama rāmā",
      meaning: "In what manner will you show me your mercy, O Rama, best of the solar line? " +
        "Is it possible for me to swim across this ocean of worldly sorrow?"
    },
    anupallavi: null,
    charanams: [],
    charanamsNote: "The charanams elaborate the surrender and the plea for grace to cross the bhava-sagara. " +
      "Full text in the sources below.",

    esoteric: [
      {
        head: "The interrogative that is not a doubt",
        text: "<em>Ē tīruga</em> — in what manner, by what route, in what shape. The grammar assumes the mercy " +
          "and questions only its form. This is the precise theological position of <em>goptritva-varana</em> — " +
          "electing God as one's protector — after which the manner of protection is explicitly no longer the " +
          "devotee's business. The kriti sounds like anxiety and is structured like trust."
      },
      {
        head: "Bhava-sagara-tarana",
        text: "\"Can I swim across?\" — the <em>bhava-sagara</em>, the ocean of becoming, is the standard image " +
          "for samsara, and the standard answer is that no one swims it. One is ferried. Read against " +
          "<a href=\"#kriti-taraka-mantramu\">Taraka Mantramu</a> — where <em>taraka</em> means precisely " +
          "'that which ferries across' — the two kritis form a question and its answer. " +
          "One asks how the ocean can be crossed. The other says: not by swimming. By a syllable."
      },
      {
        head: "Nadanamakriya's falling line",
        text: "The ragam begins high and descends — phrase after phrase starting above and giving way. " +
          "For a text that opens on a question and sinks into the image of drowning, the melodic shape " +
          "<em>is</em> the sahityam. This is the most-heard example of Nadanamakriya in Telugu popular memory, " +
          "and the reason the ragam reads as heartbreak to listeners who could not name it."
      }
    ],

    sahitya: "<em>Inavaṁśōttama</em> — best of the solar dynasty — is a formal, almost courtly epithet, placed " +
      "immediately after a line of raw uncertainty. Ramadasu does this repeatedly: the higher the anxiety, " +
      "the more elaborate the honorific. It is the reflex of a man who worked in an administration.",

    sources: [
      { label: "Shlokam.org — Ye Teeruga Nanu", url: "https://shlokam.org/shloka/ye-teeruga-nanu.htm" },
      { label: "Rasikas.org — meaning of E tIruga", url: "https://www.rasikas.org/forums/viewtopic.php?t=7495" },
      { label: "Slokam.in — E Teeruga Nanu Daya", url: "https://slokam.in/e-teeruga-nanu-daya-in-english/" }
    ]
  }
];

/* ── Commonly misattributed ───────────────────────────────────── */
// Songs that circulate on Ramadasu playlists, CD sleeves and bhajan sheets but
// belong to other composers. Getting these wrong is the single most common error
// in popular Ramadasu collections.

const MISATTRIBUTED = [
  {
    title: "Ksheerabdhi Kanyakaku",
    telugu: "క్షీరాబ్ధి కన్యకకు",
    actualComposer: "Tallapaka Annamacharya (15th c.)",
    raga: "Kurinji, khanda chapu (as commonly sung)",
    note: "A neerajanam — a harati song to Lakshmi, daughter of the milk-ocean — sung at Tulasi puja and at " +
      "the offering of the lamp. Annamacharya's, not Ramadasu's, and addressed to the Goddess rather than to Rama."
  },
  {
    title: "Nanu Palimpa",
    telugu: "నను పాలింప",
    actualComposer: "Tyagaraja (1767–1847)",
    raga: "Mohanam, Adi (2 kalai)",
    note: "\"Did you come walking, to protect me?\" — a Tyagaraja kriti, and one of the best-known pieces in " +
      "Mohanam. Its Rama-bhakti and Telugu idiom make the confusion natural, but the mudra is Tyagaraja's."
  },
  {
    title: "Anta Ramamayam",
    telugu: "అంతా రామమయం",
    actualComposer: "Attribution disputed",
    raga: "Commonly Madhyamavati",
    note: "\"All this world is filled with Rama\" is popularly sung as Ramadasu's and is also attributed " +
      "elsewhere. Treat the attribution as unsettled rather than established."
  }
];

/* ── The tradition: Nama Sankeerthanam ───────────────────────── */

const TRADITION = {
  intro: "Ramadasu's keertanas do not sit in a concert repertoire first. They sit in a <strong>bhajan " +
    "paddhati</strong> — an ordered sequence of group singing, done standing, in a hall or a courtyard, " +
    "with cymbals and a drone and no soloist in the modern sense. Understanding that setting explains the " +
    "songs' shape: short pallavis built to be answered, refrains that survive a hundred repetitions, " +
    "and a first-person voice that a room of two hundred people can inhabit at once.",

  points: [
    {
      head: "Sankeerthanam, not kriti",
      text: "The Carnatic <em>kriti</em> is a composed art object with a fixed architecture, presented by a " +
        "performer to an audience. A <em>sankeerthanam</em> is something a congregation does together. " +
        "Many of Ramadasu's songs work as either, which is why they appear both in the sabha and in the " +
        "bhajan hall — but the sankeerthanam use is the older one, and the songs are built for it."
    },
    {
      head: "The Bhagavata Sampradaya lineage",
      text: "The southern sampradaya bhajan tradition traces itself through Bhagavannama Bodhendra Saraswati " +
        "and Sridhara Ayyaval in the 17th century and Marudanallur Sadguru Swamigal in the 19th, who fixed the " +
        "order of the paddhati that is still followed. Its repertoire is deliberately multilingual — Marathi " +
        "abhangs, Tamil kirtanais, Sanskrit stotras, Hindi bhajans and Telugu keertanas sung in one sitting — " +
        "and Ramadasu is one of its Telugu pillars."
    },
    {
      head: "Where Ramadasu falls in the sequence",
      text: "In the paddhati his keertanas are used in the <em>guru dhyanam</em> and Rama-bhajan segments, and " +
        "his namavalis in the divya-nama sankeerthanam that follows. The Navaratna set is sung as a group at " +
        "Ramadasu Jayanti observances — the reason those nine, of hundreds, are the ones everyone knows."
    },
    {
      head: "Why the tunes are not his",
      text: "Ramadasu wrote sahityam. Notation for Telugu devotional song is a much later development, and the " +
        "melodies now attached to these texts were fixed by 19th and 20th century musicians — most " +
        "consequentially by Mangalampalli Balamuralikrishna, whose 1950s settings are what most listeners " +
        "actually mean when they say they know a Ramadasu song. Two Telugu films, <em>Bhakta Ramadasu</em> " +
        "(1964) and <em>Sri Ramadasu</em> (2006), fixed some of these tunes further in popular memory. " +
        "This is why ragam attributions in the sources genuinely conflict — they are records of different " +
        "lineages, not competing claims about a lost original."
    },
    {
      head: "The Rama-koti",
      text: "<em>Rama-koti</em> — writing <em>Sri Rama</em> ten million times, usually in dedicated notebooks " +
        "deposited at a temple — is a live practice, and Bhadrachalam is one of its principal destinations. " +
        "Ramadasu names it in <a href=\"#kriti-rama-daya-judave\">Rama Daya Judave</a>. It is worth knowing " +
        "that the line is not a metaphor."
      }
  ],

  glossary: [
    { term: "Pallavi", telugu: "పల్లవి", def: "The opening and returning section — the refrain. In bhajan use, the line the room sings back." },
    { term: "Anupallavi", telugu: "అనుపల్లవి", def: "The second section, usually pitched higher, that develops the pallavi's idea and returns to it." },
    { term: "Charanam", telugu: "చరణం", def: "The 'foot' — the verse. Multiple charanams share one melodic frame; this is where the argument gets made and where the composer's signature appears." },
    { term: "Sahityam", telugu: "సాహిత్యం", def: "The text itself — the words as distinct from the tune. Ramadasu's contribution is sahityam; the ragams came later." },
    { term: "Mudra", telugu: "ముద్ర", def: "The composer's signature, woven into the last charanam. Ramadasu's is 'Ramadasa' or 'Bhadrachala Ramadasa'." },
    { term: "Ragam", telugu: "రాగం", def: "The melodic framework — a scale plus a grammar of characteristic phrases, ornaments and emphases that give it a recognisable personality." },
    { term: "Talam", telugu: "తాళం", def: "The rhythmic cycle. Adi talam is 8 beats; misra chapu is 7." },
    { term: "Bhava", telugu: "భావం", def: "The emotional colour a ragam or a text carries." },
    { term: "Sharanagati", telugu: "శరణాగతి", def: "Surrender; in the formal doctrine, a discipline with six limbs, of which having-no-other-recourse is the sharpest." },
    { term: "Ninda-stuti", telugu: "నిందాస్తుతి", def: "Praise in the form of reproach — a recognised devotional genre, not a lapse of reverence." },
    { term: "Nama-siddhanta", telugu: "నామసిద్ధాంతం", def: "The doctrine that the divine Name is itself divine — not a pointer to God but a form of God, and therefore sufficient." },
    { term: "Vaggeyakara", telugu: "వాగ్గేయకార", def: "One who makes both the words (vak) and the music (geya) — the composer-poet. Telugu counts Annamacharya, Kshetrayya, Ramadasu and Tyagaraja among them." }
  ]
};
