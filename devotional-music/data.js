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
    bhava: "Often used for awe and the otherworldly",
    note: "A ragam of strange, almost unearthly colour — the sharp fourth (prati madhyama) against the lowest second and third. " +
      "Tradition surrounds it with caution: a guru is said not to teach it directly to a student, which is best read as a warning " +
      "about its difficulty rather than a superstition. It does not console. It makes the hair stand up."
  },
  "Atana": {
    telugu: "అఠాణా", melakarta: "Janya of Dheerasankarabharanam (29th)", type: "Vakra, audava-vakra",
    arohana: "S R₂ M₁ P N₃ Ṡ", avarohana: "Ṡ N₂ D₂ P M₁ R₂ G₃ R₂ S",
    bhava: "Often carries veera — valour, resolve",
    note: "The heroic ragam of the Carnatic repertoire, full of brisk gamakas and a characteristically " +
      "unstable nishada. Its use for a song about holding a name on the tongue is the whole point: steadiness is a form of courage."
  },
  "Ananda Bhairavi": {
    telugu: "ఆనందభైరవి", melakarta: "Janya of Natabhairavi (20th)", type: "Vakra sampurna",
    arohana: "S G₂ R₂ G₂ M₁ P D₂ P Ṡ", avarohana: "Ṡ N₂ D₂ P M₁ G₂ R₂ S",
    bhava: "Often used for karuna and shanta — compassion, tenderness",
    note: "Borrows the D₂ that its parent scale does not have, which is where its warmth comes from. " +
      "It is widely associated with a soothing, almost therapeutic quality and is often used for lullabies. " +
      "Ramadasu's most famous reproach is set in the gentlest ragam he could have chosen."
  },
  "Saveri": {
    telugu: "సావేరి", melakarta: "Janya of Mayamalavagowla (15th)", type: "Audava-sampurna",
    arohana: "S R₁ M₁ P D₁ Ṡ", avarohana: "Ṡ N₃ D₁ P M₁ G₃ R₁ S",
    bhava: "Often used for karuna — pleading",
    note: "A five-note ascent and a full descent, with the flat second and sixth doing the emotional work. " +
      "The classic ragam of asking."
  },
  "Khamas": {
    telugu: "ఖమాస్", melakarta: "Janya of Harikambhoji (28th)", type: "Vakra audava-sampurna",
    arohana: "S M₁ G₃ M₁ P D₂ N₂ Ṡ", avarohana: "Ṡ N₂ D₂ P M₁ G₃ R₂ S",
    bhava: "Often used for lightness and coaxing",
    note: "An evening ragam that skips the second on the way up and leans on the madhyama. Its home is " +
      "the padam and the javali — the repertoire of persuasion. Exactly right for a street hawker's cry."
  },
  "Dhanyasi": {
    telugu: "ధన్యాసి", melakarta: "Janya of Natabhairavi (20th)", type: "Audava-sampurna",
    arohana: "S G₂ M₁ P N₂ Ṡ", avarohana: "Ṡ N₂ D₁ P M₁ G₂ R₁ S",
    bhava: "Often bhakti with a plaintive edge",
    note: "Pentatonic going up, complete coming down — the shape gives it a rising simplicity and a " +
      "descending ache. A workhorse ragam of Telugu devotional song."
  },
  "Kanada": {
    telugu: "కానడ", melakarta: "Janya of Kharaharapriya (22nd)", type: "Vakra",
    arohana: "S R₂ G₂ M₁ D₂ N₂ Ṡ", avarohana: "Ṡ N₂ D₂ M₁ P G₂ M₁ R₂ S",
    bhava: "Often gambhira — gravity, weight",
    note: "A crooked, deliberately winding ragam whose phrases refuse to travel in a straight line. " +
      "Serious without being sorrowful."
  },
  "Saurashtram": {
    telugu: "సౌరాష్ట్రం", melakarta: "Janya of Mayamalavagowla (15th)", type: "Vakra sampurna",
    arohana: "S R₁ G₃ M₁ P M₁ D₂ N₃ Ṡ", avarohana: "Ṡ N₃ D₂ N₃ P M₁ G₃ R₁ S",
    bhava: "Strongly associated with mangala — auspiciousness",
    note: "The ragam of benediction; the traditional mangalam that closes a concert is set in it. " +
      "A song arguing that nothing is lacking could hardly be anywhere else."
  },
  "Nadanamakriya": {
    telugu: "నాదనామక్రియ", melakarta: "Janya of Mayamalavagowla (15th)", type: "Descending-oriented",
    arohana: "(from the upper octave) Ṡ N₃ D₁ P M₁ G₃ R₁ S", avarohana: "Sung as a descent; phrases characteristically begin high and fall",
    bhava: "Often deep karuna — pathos",
    note: "Unusual among ragams in that it is conceived as a falling shape, traditionally begun from the " +
      "upper note. Close to folk devotional idiom and hugely effective in bhajan. It is the sound of a " +
      "voice giving way."
  },
  "Bhairavi": {
    telugu: "భైరవి", melakarta: "Janya of Natabhairavi (20th)", type: "Sampurna (asymmetric dhaivata)",
    arohana: "S R₂ G₂ M₁ P D₂ N₂ Ṡ", avarohana: "Ṡ N₂ D₁ P M₁ G₂ R₂ S",
    bhava: "Affords breadth; often used for grave devotion",
    note: "Its signature is the two dhaivatas: the higher one going up, the lower one coming down. " +
      "A ragam with room in it."
  },
  "Keeravani": {
    telugu: "కీరవాణి", melakarta: "21st melakarta", type: "Sampurna",
    arohana: "S R₂ G₂ M₁ P D₁ N₃ Ṡ", avarohana: "Ṡ N₃ D₁ P M₁ G₂ R₂ S",
    bhava: "Often longing, pathos",
    note: "The flat sixth against the sharp seventh gives Keeravani its characteristic catch. " +
      "Nearly identical in scale to the Western harmonic minor."
  },
  "Yadukula Kambhoji": {
    telugu: "యదుకుల కాంభోజి", melakarta: "Janya of Harikambhoji (28th)", type: "Audava-sampurna",
    arohana: "S R₂ M₁ P D₂ Ṡ", avarohana: "Ṡ N₂ D₂ P M₁ G₃ R₂ S",
    bhava: "Often tenderness shading into grief",
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
        evidence: "TEXTUAL",
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
        evidence: "TRADITIONAL",
        text: "<em>Dikku nīvani nammiti</em> — \"I trusted that you are my direction.\" <em>Dikku</em> in Telugu carries both " +
          "senses at once: a compass direction, and a refuge. Classical sharanagati counts six limbs, and this is the " +
          "sharpest of them — <strong>ananya-gatitva</strong>, the state of having no other recourse. It is not a boast " +
          "of exclusive devotion. It is a confession of exhausted options, which the tradition holds to be the same thing."
      },
      {
        head: "Chikkulu — the knot, not the punishment",
        evidence: "INTERPRETIVE",
        text: "He does not ask to be released, forgiven, or vindicated. He asks not to be left in <em>chikkulu</em> — " +
          "tangles, knots, snarls. The image is of thread, not of chains. What the bound soul needs is not a key " +
          "but a patient hand, and the yogic literature calls the same thing <em>granthi-bheda</em>, the untying of the knot."
      },
      {
        head: "Why the last word is Sita's",
        evidence: "TRADITIONAL",
        text: "Three verses of address to Rama close by turning to <em>chakkani Jānaki</em> — lovely Janaki. This is " +
          "<strong>purushakara</strong>, the doctrine of mediation: the Mother is approached because she does not judge " +
          "the case, only pleads it. Sri Vaishnava theology makes this structural — the jiva reaches Narayana through " +
          "Lakshmi — and Ramadasu makes it dramatic. He has spent the song arguing with the judge. In the last line he " +
          "stops arguing and goes to the one who will simply ask."
      },
      {
        head: "Tataka first",
        evidence: "INTERPRETIVE",
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
        evidence: "INTERPRETIVE",
        text: "The metaphor is usually translated as \"your words have become as precious as gold,\" which is " +
          "half the sentence. Gold in Telugu idiom is also what is <em>locked away</em>. Ramadasu — jailed for " +
          "spending gold on a temple — accuses God of doing to speech what the treasury does to bullion: " +
          "keeping it in a vault. The man punished for giving gold away is complaining that God won't."
      },
      {
        head: "Ninda-stuti: the reproach as the highest praise",
        evidence: "TRADITIONAL",
        text: "Devotional Sanskrit and Telugu have a recognised genre — <strong>ninda-stuti</strong>, praise by " +
          "abuse — and a recognised mood, <em>pranaya-kalaha</em>, the lovers' quarrel. Only an intimate has " +
          "standing to accuse. When Ramadasu asks why God won't speak, the accusation presupposes a relationship " +
          "in which silence is a betrayal rather than a fact of nature. The complaint is the theology."
      },
      {
        head: "The squirrel argument",
        evidence: "TEXTUAL",
        text: "The squirrel of charanam 2 is from the Setu-building episode: a creature that carried grains of " +
          "sand to the causeway while vanaras carried boulders, and whose effort Rama honoured. Ramadasu is not " +
          "telling a sweet story. He is making an argument from precedent — <em>you have already established that " +
          "you weigh sincerity and not magnitude; I am invoking your own ruling.</em>"
      },
      {
        head: "Holding God to His own title",
        evidence: "TEXTUAL",
        text: "The final charanam reaches for <em>birudu</em> — a formal title of honour, the kind a king has " +
          "proclaimed before him. <em>Sharanagata-trana</em>, protector of the surrendered, is one of Rama's. " +
          "Ramadasu's closing move is legal rather than emotional: he does not ask for a favour, he asks the " +
          "Lord to be consistent with his own titulature. The devotee cannot compel God, but he can point out " +
          "what God has publicly promised to be."
      },
      {
        head: "The gentlest ragam for the harshest text",
        evidence: "INTERPRETIVE",
        text: "A song of accusation set in Ananda Bhairavi — a ragam widely associated with lullabies and " +
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
        evidence: "TEXTUAL",
        text: "<em>Idigō</em> — here it is, near. <em>Adigō</em> — there it is, far. Telugu has separate " +
          "demonstratives for the thing in your hand and the thing on the horizon, and the pallavi uses both in " +
          "one breath: the hill is <em>here</em>, the river is <em>there</em>. The whole kriti is deixis. " +
          "There is no petition anywhere in it. After so much asking elsewhere, this is a song that mostly just shows."
      },
      {
        head: "The itemised prison sentence, sung as praise",
        evidence: "INTERPRETIVE",
        text: "The <em>svarṇa prākāra</em> — the golden rampart — and the <em>gopura dvāramulu</em> are not generic " +
          "temple furniture. They are specific construction line-items, and elsewhere in his corpus " +
          "(<a href=\"#kriti-ikshvaku-kula-tilaka\">Ikshvaku Kula Tilaka</a>) Ramadasu prices them to the varaha. " +
          "The same masonry appears in one song as a legal defence and in this one as pure delight, with no trace " +
          "of grievance. Read the two together and you have the man's entire character."
      },
      {
        head: "Why Varali, of all ragams",
        evidence: "INTERPRETIVE",
        text: "Varali is among the least comfortable ragams in the repertoire — angular, prati-madhyama, and surrounded " +
          "by cautionary lore. It is a strange choice for a tourist's-eye view of a temple, unless the point is that " +
          "what he is pointing at is not, finally, a building. Varali makes the gopuram look like an apparition."
      },
      {
        head: "Dhaga dhaga",
        evidence: "TEXTUAL",
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
        evidence: "TEXTUAL",
        text: "<em>Sthira</em> means fixed, steady, established. Not <em>on</em> the tongue but <em>firm</em> upon it. " +
          "Japa has a recognised progression — spoken, then whispered, then mental, then <em>ajapa</em>, the " +
          "repetition that continues without a repeater. <em>Sthiramai</em> names the hinge: the point at which " +
          "the devotee stops doing the japa and the japa keeps going."
      },
      {
        head: "Nama-siddhanta",
        evidence: "TRADITIONAL",
        text: "The southern bhakti schools hold that the Name is <em>nama-brahman</em> — not a label attached to a " +
          "deity but the deity in audible form, and therefore not less powerful than the deity's presence. This is " +
          "why the tradition of Ramadasu, Tyagaraja and the Nama Siddhanta acharyas can claim that chanting is " +
          "sufficient — not a preliminary to something better. The pallavi's <em>nāmamē</em>, with its emphatic " +
          "<em>-ē</em>, is that doctrine in one syllable: the name <em>alone</em>."
      },
      {
        head: "Valour for a song about a syllable",
        evidence: "INTERPRETIVE",
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
        evidence: "TEXTUAL",
        text: "The whole kriti hangs on one flat Telugu word: <em>chālu</em>, enough, that's sufficient, stop there. " +
          "It is not a mystical word. It is what you say to someone still pouring. Against the vast apparatus of " +
          "ritual available to a 17th-century Telugu brahmin — vratas, kshetras, deities for every affliction — " +
          "Ramadasu's position is a shrug: this is enough."
      },
      {
        head: "Ananya-bhakti, stated as common sense",
        evidence: "TRADITIONAL",
        text: "The technical doctrine is <em>devatantara-parigraha-nishedha</em> — the prohibition on hedging your " +
          "devotion across deities. In the theological literature it is argued at length. Here it is a rhetorical " +
          "question put to a neighbour: why are you looking around?"
      },
      {
        head: "Where the song actually lands",
        evidence: "TEXTUAL",
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
        evidence: "TRADITIONAL",
        text: "The ailments named — <em>kama</em> (lust), <em>krodha</em> (anger), <em>mada</em> (arrogance), " +
          "<em>matsarya</em> (envy), <em>lobha</em> (greed) — are not a random list of vices. They are the " +
          "<strong>arishadvarga</strong>, the six inner enemies of classical Indian ethics. Ramadasu has taken " +
          "a formal taxonomy and put it on a medicine label."
      },
      {
        head: "Konare — the paradox in the verb",
        evidence: "TEXTUAL",
        text: "<em>Konarē</em> is the imperative of buying, the cry of a hawker working a street. And then the " +
          "charanam says the thing cannot be bought for crores. The song sells what is not for sale. " +
          "The doctrine underneath is <em>akraya</em> — grace is not purchasable — but Ramadasu does not state " +
          "it as doctrine. He stages a marketplace and lets the customer discover that his money is no good here. " +
          "The only currency accepted is dhyana."
      },
      {
        head: "Rama as a wandering physician",
        evidence: "INTERPRETIVE",
        text: "<em>Jogi</em> is the Telugu form of <em>yogi</em>, but in street usage it means the itinerant " +
          "mendicant — and itinerant mendicants sold remedies. To cast Rama, prince of Ayodhya, as a travelling " +
          "quack with a satchel is an act of deliberate deflation, and a very old one: the Buddha is the " +
          "great physician, Krishna is the cowherd. Bhakti routinely dresses God in a working man's clothes " +
          "because a king can be petitioned but a hawker can be haggled with."
      },
      {
        head: "Khamas and the art of persuasion",
        evidence: "INTERPRETIVE",
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
        evidence: "TRADITIONAL",
        text: "The root is <em>tṛ</em>, to cross. A <em>taraka</em> is a ferry, and the <em>Advaya Taraka " +
          "Upanishad</em> gives the etymology in doctrinal form: it is called Taraka because it carries one " +
          "across the fear of the womb, of birth, of old age, of death. The Rama-taraka mantra — " +
          "<em>Sri Rama Rama Rameti</em> — is the specific referent, and the Tarakabrahma tradition holds it " +
          "equal in fruit to the thousand names."
      },
      {
        head: "The grammar of finding",
        evidence: "TEXTUAL",
        text: "<em>Kōrina dorikenu</em> — \"having sought, it was found.\" Then immediately: " +
          "<em>dhanyuḍanaitini</em>, \"I have become blessed.\" Not <em>I will be</em> blessed, not <em>I hope " +
          "to be</em>. The past tense is the theological content. In a corpus full of unanswered petitions, " +
          "this is among the few here in the perfect tense, and what completes it is not a rescue or a vision — " +
          "it is having been given the words."
      },
      {
        head: "Orana",
        evidence: "TEXTUAL",
        text: "The pallavi ends by addressing not God but a person — <em>ōrana</em>, a familiar, slightly rough " +
          "Telugu vocative, roughly \"hey, you.\" Every other kriti here is aimed upward. This one turns sideways " +
          "and tells a neighbour. That turn is the entire social mechanism of Nama Sankeerthanam: the discovery " +
          "is not complete until it is passed along."
      },
      {
        head: "Dhanyasi's two halves",
        evidence: "INTERPRETIVE",
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
        evidence: "TRADITIONAL",
        text: "Rama's title <em>patita-pavana</em> — purifier of the fallen — is the hinge of this kriti's logic. " +
          "A redeemer of the fallen needs fallen people; the unworthy are not an embarrassment to the title but " +
          "its precondition. So the devotee presses his own unworthiness forward as his credential. " +
          "The Alvars do the same thing, and Kulasekhara does it most nakedly. It is not humility as decoration. " +
          "It is a claim."
      },
      {
        head: "Karpanya",
        evidence: "TRADITIONAL",
        text: "The formal name for this is <strong>karpanya</strong> — the sense of one's own helplessness — " +
          "counted among the limbs of sharanagati. The doctrine insists it is not self-abasement, because " +
          "self-abasement is still a performance of self. Karpanya is the abandonment of the case for oneself. " +
          "'Do not think me low' is not a denial of lowness; it is a request that lowness be irrelevant."
      },
      {
        head: "Why the doubled Hari",
        evidence: "INTERPRETIVE",
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
        evidence: "TEXTUAL",
        text: "This is not a song saying <em>God will help us</em>. It is a song saying <em>look at what he has " +
          "already done</em> — and then producing ten pieces of evidence in sequence. The avatara-krama is being " +
          "used as case law. Each verse is a precedent; the refrain is the ruling drawn from it. It is the same " +
          "forensic instinct that shows up in <a href=\"#kriti-paluke-bangaramayena\">Paluke Bangaramayena</a>'s " +
          "squirrel and in <a href=\"#kriti-ikshvaku-kula-tilaka\">Ikshvaku Kula Tilaka</a>'s ledger. " +
          "Ramadasu, in the end, was a revenue officer, and he argues like one."
      },
      {
        head: "Okkadu — the one",
        evidence: "TEXTUAL",
        text: "<em>Rāmuṇḍokkaḍuṇḍu</em> — \"Rama, one, exists.\" The numeral is doing theology. Against the " +
          "crowded pantheon the singer sets a count of one, and against every conceivable lack he sets a single " +
          "presence. It is the arithmetic answer to <a href=\"#kriti-sri-ramula-divyanama\">Sri Ramula Divya " +
          "Nama</a>'s question about searching among many gods."
      },
      {
        head: "Saurashtram, the benediction ragam",
        evidence: "INTERPRETIVE",
        text: "Saurashtram is where the traditional <em>mangalam</em> lives — the auspicious closing piece of a " +
          "concert. Setting a song of reassurance in the ragam of benediction means the music makes the claim " +
          "before the words do. By the time the first avatara is named, the listener has already been told that " +
          "everything is going to be all right."
      }
    ],

    sahitya: "Note the pronoun: <em>manaku</em>, to <strong>us</strong>, not to me. Unusually for this set of songs, " +
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
    tala: "Khanda Chapu",
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
        evidence: "TEXTUAL",
        text: "<em>Kaṇṭinēḍu</em> — \"today I saw.\" After a corpus of vocatives and imperatives — show mercy, " +
          "protect me, speak to me — the ninth gem arrives in the completed past. Nothing is being asked for. " +
          "The Navaratna set is sequenced so that it ends here, and that sequence is itself an argument: " +
          "the asking resolves into a seeing."
      },
      {
        head: "Ma ramula — our Rama",
        evidence: "TEXTUAL",
        text: "Not <em>Sri Rama</em>, not <em>Raghupati</em>. <em>Mā rāmula</em> — <strong>our</strong> Rama, " +
          "with the possessive that Telugu families use for the <em>kula-daivam</em>, the household deity. " +
          "The god of the Ramayana is vast; the god of this line belongs to a specific family in a specific " +
          "district and has been theirs for generations. Bhakti's characteristic move is not to make the small " +
          "large but to make the large small enough to hold."
      },
      {
        head: "Why joy sounds like grief",
        evidence: "INTERPRETIVE",
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
        evidence: "TEXTUAL",
        text: "This is an unusual move in the surviving Telugu devotional repertoire. Ramadasu names sums. Ten thousand varahas for the " +
          "prakara; itemised gifts for Rama's brothers and for Sita. Sung from prison, where he was held for " +
          "precisely this expenditure, the ledger is doing double duty — it is his legal defence before the " +
          "Nawab and his claim before God, in the same words. The tradition has a name for this nerve: " +
          "<em>bhakti-dhārṣṭya</em>, devotional audacity. It is permitted because it presumes intimacy: " +
          "you present a bill only to family."
      },
      {
        head: "Ika naina — 'even now'",
        evidence: "TEXTUAL",
        text: "Two small words carry the twelve years. <em>Ika naina balukavu</em> — will you not speak <em>even " +
          "now</em>? The phrase implies everything that has already been tried and everything that has already " +
          "been endured. It is the same silence <a href=\"#kriti-paluke-bangaramayena\">Paluke Bangaramayena</a> " +
          "calls gold, and here it is simply timed."
      },
      {
        head: "Rakshakulevarinka — the closing of every other door",
        evidence: "TRADITIONAL",
        text: "\"Who else is there to protect me?\" Formally this is <strong>ananya-gatitva</strong>, the state " +
          "of having no other recourse, and it recurs across the corpus (see " +
          "<a href=\"#kriti-rama-daya-judave\">Rama Daya Judave</a>'s <em>dikku nīvani nammiti</em>). " +
          "The doctrinal claim is severe: surrender only becomes real when the alternatives are gone, which is " +
          "why the tradition treats calamity as an opportunity rather than an obstacle."
      },
      {
        head: "Do not treat me as a stranger",
        evidence: "INTERPRETIVE",
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
        evidence: "INTERPRETIVE",
        text: "<em>Ē tīruga</em> — in what manner, by what route, in what shape. The grammar assumes the mercy " +
          "and questions only its form. This is the precise theological position of <em>goptritva-varana</em> — " +
          "electing God as one's protector — after which the manner of protection is explicitly no longer the " +
          "devotee's business. The kriti sounds like anxiety and is structured like trust."
      },
      {
        head: "Bhava-sagara-tarana",
        evidence: "TRADITIONAL",
        text: "\"Can I swim across?\" — the <em>bhava-sagara</em>, the ocean of becoming, is the standard image " +
          "for samsara, and the standard answer is that no one swims it. One is ferried. Read against " +
          "<a href=\"#kriti-taraka-mantramu\">Taraka Mantramu</a> — where <em>taraka</em> means precisely " +
          "'that which ferries across' — the two kritis form a question and its answer. " +
          "One asks how the ocean can be crossed. The other says: not by swimming. By a syllable."
      },
      {
        head: "Nadanamakriya's falling line",
        evidence: "INTERPRETIVE",
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

/* ── Second-pass enrichment ───────────────────────────────────── */
// Merged onto KRITIS by id at the bottom of this file. Kept separate so the
// original scholarly entries stay legible and diffable.
//
// LISTENING LINKS — read this before editing.
//   YouTube is unreachable from the authoring environment, so no link below
//   has been checked for liveness. Each entry therefore carries a `verify`:
//     "index-corroborated" — the video id came from a search index whose
//        recorded title matches this composition (and, where stated, the
//        performer). Not confirmed live, not watched.
//     "search" — no corroborated recording found; the link is a YouTube
//        SEARCH url, which is correct by construction and cannot rot.
//   To promote a search link: set kind:"watch" and put the id in `id`.
//   Never add a watch link on a title match alone — confirm the recording.
//
// CUE PROVENANCE — every listening cue names where the observation comes from:
//     "text"        — in the sahityam itself; true of any performance.
//     "tradition"   — common performance practice, not the composer's mark.
//     "rendition"   — depends on the specific recording named.

function ytSearch(q) {
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
}
function ytWatch(id) {
  return 'https://www.youtube.com/watch?v=' + id;
}

const ENRICH = {

  /* ─────────── Rama Daya Judave ─────────── */
  "rama-daya-judave": {
    beforePlay: "Do not listen to this as a polished Carnatic composition first. Listen to it as a man " +
      "who has exhausted every argument — the ledger, the precedent, the crore of written names — and is " +
      "left holding one word: <em>daya</em>. Everything before that word is preparation. Everything after " +
      "it is consequence.",
    keyWord: {
      word: "Daya", telugu: "దయ", translit: "daya",
      literal: "Compassion, mercy, pity.",
      colloquial: "In everyday Telugu, the softening of someone who has power over you — a landlord, " +
        "an officer, a parent. It presumes a gap in standing.",
      spiritual: "The tenderness of the greater toward the smaller, which the devotee cannot earn and " +
        "can only be shown. Distinct from <em>karuna</em> (compassion as a state) and " +
        "<em>anugraha</em> (grace as an act): <em>daya</em> is compassion as a <em>relation</em>.",
      why: "He does not ask for release, restitution or vindication — all of which he had standing to " +
        "ask for. He asks to be looked at. And because <em>daya</em> is a word that only works between " +
        "two people, asking for it in that word is already an admission of rank."
    },
    cues: [
      { mark: "The first <span lang='te'>రామ</span>", provenance: "tradition",
        text: "Listen to whether the singer attacks the note or lets the name emerge. The composition " +
          "opens on the name itself, so a performer's choice here is an interpretive decision made before " +
          "the sentence has even begun." },
      { mark: "<span lang='te'>దయ జూడవే</span> — where the phrase bends", provenance: "tradition",
        text: "Listen for whether the voice wavers or hesitates as <em>daya</em> passes. In most Carnatic " +
          "renditions the oscillated gandhara does this work. Treat it as emotional language rather than " +
          "ornament: the word means compassion, the unsteady pitch means <em>I am not sure you will give it</em>." },
      { mark: "The seam: <span lang='te'>సీతా</span> &rarr; <span lang='te'>రామ</span>", provenance: "text",
        text: "When the pallavi ends and loops back, listen to the join rather than the phrases either " +
          "side of it. Last word plus first word makes <strong>Sita-Rama</strong>. This is in the text, so " +
          "it is true of every performance — but you have to be listening for it to hear it." },
      { mark: "The unfinished word <span lang='te'>జగదభి</span>", provenance: "text",
        text: "The anupallavi ends on a fragment that is not a word until the refrain supplies " +
          "<em>rama</em> and completes <strong>jagadabhirama</strong>. Listen for the small suspension. " +
          "Some singers let it hang; the text asks for it either way." },
      { mark: "The return to the pallavi, after each charanam", provenance: "text",
        text: "The words do not change. What changes is what stands behind them. After charanam 2 the " +
          "same plea arrives carrying a crore of written names; after charanam 3 it arrives having already " +
          "given up and turned to Sita. Listen to the third return as a different sentence made of " +
          "identical syllables." }
    ],
    modern: "<em>Dikku nivani nammiti</em> — \"I trusted that you are my only direction.\" The line is easy " +
      "to admire and uncomfortable to apply. Most of us arrange our lives so that this sentence is never " +
      "true: there is always another option, another contact, another plan. Ramadasu is not recommending " +
      "that we dismantle those. He is describing what is left when they have been dismantled for us — and " +
      "reporting, from inside that, that it was not empty. The question the song leaves is quieter than a " +
      "moral: when every exit has closed, what do you turn toward, and had you given it any attention " +
      "before you needed it?",
    listening: [
      { performer: "Search — Bhajana and concert renditions", tradition: "Version A · Bhairavi",
        raga: "Bhairavi", tala: "Adi", kind: "search", verify: "search",
        q: "Rama daya judave Bhadrachala Ramadasu Bhairavi",
        why: "The setting filed in the Sangeetasudha collection; the broadest and gravest of the three." },
      { performer: "Search — Dhanyasi renditions", tradition: "Version B · Dhanyasi",
        raga: "Dhanyasi", tala: "Adi", kind: "search", verify: "search",
        q: "Rama dayajudave Ramadasu Dhanyasi keerthana",
        why: "The setting in most circulating lyric editions — simpler ascent, more ache on the descent." }
    ]
  },

  /* ─────────── Paluke Bangaramayena ─────────── */
  "paluke-bangaramayena": {
    beforePlay: "It begins almost lightly — a pretty tune, a gentle raga, a turn of phrase that sounds " +
      "like a compliment. Stay with it. <em>Your speech has turned to gold</em> is not praise; it is an " +
      "accusation about silence, and the music never raises its voice to tell you so.",
    keyWord: {
      word: "Paluke", telugu: "పలుకే", translit: "palukē",
      literal: "Speech, word, utterance — with the emphatic <em>-ē</em>: <em>the speech itself</em>.",
      colloquial: "Not oratory. The ordinary act of answering when somebody calls you. A household word.",
      spiritual: "Divine response — the moment the silence of God breaks into address. Its absence is " +
        "the standard condition of the devotee, and the tradition treats that absence as pedagogy rather " +
        "than abandonment.",
      why: "He does not say God's <em>grace</em> has become gold, or His <em>darshan</em>. He picks the " +
        "smallest possible thing — a reply — and prices it like bullion. The smallness is the complaint: " +
        "he is not asking for a miracle, only for an answer, and cannot get even that."
    },
    cues: [
      { mark: "The opening phrase's lightness", provenance: "tradition",
        text: "Ananda Bhairavi is warm, and most renditions let the pallavi sound almost affectionate. " +
          "Notice the gap between how the line sounds and what it says. The music is not contradicting " +
          "the words; it is showing you that the reproach is made from inside love." },
      { mark: "<span lang='te'>పిలిచిన పలుకవేమి</span> — \"why won't you answer when I call?\"", provenance: "text",
        text: "The plainest sentence in the kriti, and the one everything else orbits. Listen for whether " +
          "the singer lets it sit rather than decorating it." },
      { mark: "<span lang='te'>చక్కని తండ్రి</span> — \"beautiful father\"", provenance: "text",
        text: "Twice he calls God by a domestic endearment while accusing him. Listen for the tonal shift " +
          "on <em>tandri</em>. Every hard line in this song is aimed at someone being addressed as family." },
      { mark: "The squirrel verse", provenance: "text",
        text: "<em>Udata bhaktiki</em> — the squirrel that carried sand to the Setu. He is not telling a " +
          "sweet story; he is citing a precedent. Listen to it as an argument, not an illustration." },
      { mark: "The final charanam's turn", provenance: "text",
        text: "<em>Sharanagata-trana birudankuduvu kava</em> — \"are you not titled protector of the " +
          "surrendered?\" The register shifts from complaint to something almost legal: he stops pleading " +
          "and starts holding God to His own advertised office." }
    ],
    modern: "This is the song for anyone who has prayed and heard nothing back. Its refusal to resolve is " +
      "the point — it does not end with the silence explained, or broken, or reframed as secretly a gift. " +
      "It ends with the devotee still there, still talking. Perhaps that is the only honest thing to say " +
      "about unanswered prayer: not that the silence means something, but that people have gone on " +
      "addressing it for four hundred years, and made this out of the waiting.",
    listening: [
      { performer: "Carnatic vocal rendition", tradition: "Carnatic",
        raga: "Ananda Bhairavi", tala: "Adi", kind: "watch", id: "HBcSvNDUWJM", verify: "index-corroborated",
        why: "Listen for how the pallavi is shaped — whether the accusation is allowed to sound tender." },
      { performer: "Dr. M. Balamuralikrishna", tradition: "Concert · the settings most listeners know",
        raga: "Ananda Bhairavi", tala: "Adi", kind: "watch", id: "T85AgXmTifo", verify: "index-corroborated",
        why: "A collection rather than a single track; listen for the sahitya clarity that made these settings standard." }
    ]
  },

  /* ─────────── Adigo Bhadradri ─────────── */
  "adigo-bhadradri": {
    beforePlay: "This is the one song here that asks for nothing. A man who was jailed for the money that " +
      "built a temple stands and points at it — <em>look, all of you</em> — with no trace of grievance in " +
      "the whole text. Varali makes the pointing sound less like a tour and more like a vision.",
    keyWord: {
      word: "Idigo / Adigo", telugu: "ఇదిగో / అదిగో", translit: "idigō / adigō",
      literal: "\"Here it is\" / \"there it is.\"",
      colloquial: "Two everyday demonstratives Telugu keeps separate: the thing within reach, and the " +
        "thing on the horizon. You would use both pointing out a house to a visitor.",
      spiritual: "Darshana as an act performed for others — not <em>I have seen</em> but <em>look</em>. " +
        "The devotee becomes the one who directs another's gaze.",
      why: "In a corpus built almost entirely of first-person petition, this song's key word is not a " +
        "request at all. It is a gesture. The grammar changes from <em>give me</em> to <em>look</em>, " +
        "and the whole emotional weather changes with it."
    },
    cues: [
      { mark: "The strangeness of Varali on a temple description", provenance: "text",
        text: "The words are almost a guidebook — walls, gates, tower, chakra. The ragam is angular and " +
          "otherworldly. Listen for the gap: it is what turns masonry into apparition." },
      { mark: "<span lang='te'>ధగ ధగ</span> — \"dhaga dhaga\"", provenance: "text",
        text: "The flashing of the golden chakra rendered as raw onomatopoeia rather than simile. Listen " +
          "for the moment the classical register drops out and a Telugu villager just says: look at it flash." },
      { mark: "The two demonstratives in one breath", provenance: "text",
        text: "<em>Idigo</em> (here) and <em>adigo</em> (there) land in the same line — the hill near, the " +
          "river far. Listen for how the singer places them; the whole pallavi is an act of pointing." },
      { mark: "No petition anywhere", provenance: "text",
        text: "Listen for what never arrives. There is no <em>brovave</em>, no <em>daya</em>, no plea. " +
          "Having heard the other eight Navaratnas, the absence becomes conspicuous." }
    ],
    listening: [
      { performer: "Navaratna series, with lyrics", tradition: "Navaratna series",
        raga: "Varali", tala: "Adi", kind: "watch", id: "RkWhH5PBV5g", verify: "index-corroborated",
        why: "Opens the Navaratna set, with the text on screen — the easiest entry point to the nine." }
    ]
  },

  /* ─────────── Sri Rama Namame ─────────── */
  "sri-rama-namame": {
    beforePlay: "A song about keeping one syllable steady on the tongue, set in the ragam of warriors. " +
      "That pairing is the argument: constancy is not a passive virtue. Listen to it as somebody stating " +
      "the one thing he has managed to hold on to.",
    keyWord: {
      word: "Sthiramai", telugu: "స్థిరమై", translit: "sthiramai",
      literal: "Having become fixed, steady, firmly established.",
      colloquial: "What you say of something that has finally stopped moving — a price, a decision, a " +
        "man's character.",
      spiritual: "The hinge in the progression of japa: spoken, whispered, mental, then " +
        "<em>ajapa</em> — the repetition that continues without a repeater. <em>Sthiramai</em> names the " +
        "point where the devotee stops doing the japa and the japa keeps going.",
      why: "Not <em>on</em> the tongue but <em>firm</em> upon it. The claim is not that he chants often; " +
        "it is that the chanting has become a property of him rather than an activity he performs."
    },
    cues: [
      { mark: "Atana's briskness against a contemplative text", provenance: "text",
        text: "Listen for the friction. The ragam is martial and quick-moving; the subject is a name held " +
          "steady. The setting argues that steadiness takes nerve." },
      { mark: "The unstable nishada", provenance: "tradition",
        text: "Atana's characteristic wavering seventh is part of its grammar. Listen for how it keeps the " +
          "line from ever quite settling — under a text about being settled." },
      { mark: "<span lang='te'>నామమే</span> — the emphatic", provenance: "text",
        text: "The <em>-ē</em> means <em>the name alone</em>, and it carries the whole doctrine of " +
          "nama-siddhanta. Listen for the stress the singer puts on it." }
    ],
    listening: [
      { performer: "Nedunuri Krishnamurthy & Malladi Brothers", tradition: "The Navaratna project · guru and students",
        raga: "Atana", tala: "Adi", kind: "watch", id: "0HMHlarLZwo", verify: "index-corroborated",
        why: "The most authoritative pairing available for this repertoire — listen for sahitya governing the music rather than the reverse." },
      { performer: "Navaratna series, with lyrics", tradition: "Navaratna series",
        raga: "Atana", tala: "Adi", kind: "watch", id: "Or1cbP54gI4", verify: "index-corroborated",
        why: "A lyrics-on-screen rendition; useful for following the Telugu while you listen." }
    ]
  },

  /* ─────────── Sri Ramula Divyanama ─────────── */
  "sri-ramula-divyanama": {
    beforePlay: "The most doctrinally ambitious claim in the collection, delivered as a shrug. He tells " +
      "you the Name is enough, asks why you are still shopping around — and then cashes the whole thing " +
      "out as: do no harm, feed the hungry.",
    keyWord: {
      word: "Chalu", telugu: "చాలు", translit: "chālu",
      literal: "Enough. It suffices. That will do.",
      colloquial: "Flat and ordinary — what you say to someone still pouring, or to a child still " +
        "explaining. There is nothing elevated about the word at all.",
      spiritual: "The sufficiency of nama-smarana: not a stage on the way to something better, but a " +
        "terminus. The technical form of the claim is that no supplementary means is required.",
      why: "Against the enormous ritual apparatus available to a 17th-century Telugu brahmin — vratas, " +
        "kshetras, a deity for every affliction — he sets one flat domestic word. The plainness is the point."
    },
    cues: [
      { mark: "Saveri's pleading contour under a confident text", provenance: "tradition",
        text: "The words say <em>enough, stop looking</em>; Saveri is the ragam of asking. Listen for the " +
          "tension between a settled statement and a supplicating melody." },
      { mark: "The rhetorical question", provenance: "text",
        text: "<em>Why do you search here and there among other gods?</em> Listen for whether the singer " +
          "delivers it as doctrine or as a neighbour's mild exasperation. The text supports the second." },
      { mark: "Where the song lands", provenance: "text",
        text: "Wait for the charanams to arrive at conduct — do no harm, feed those who are hungry. A song " +
          "about the sufficiency of the Name ends in table manners. Listen for that drop." }
    ],
    listening: [
      { performer: "Search — Navaratna 4 renditions", tradition: "Navaratna series",
        raga: "Saveri", tala: "Adi", kind: "search", verify: "search",
        q: "Sri Ramula Divyanama Smarana Ramadasu Navaratnam Saveri",
        why: "Look for the Navaratna-series upload with lyrics, or a Nedunuri-lineage concert rendition." }
    ]
  },

  /* ─────────── Ramajogi Mandu ─────────── */
  "ramajogi-mandu": {
    beforePlay: "A street hawker's cry for a medicine that cannot be bought. It is the wittiest thing " +
      "Ramadasu wrote and quietly the most demanding — by the end you discover your money is no good " +
      "here, and the only accepted currency is attention.",
    keyWord: {
      word: "Konare", telugu: "కొనరే", translit: "konarē",
      literal: "\"Won't you buy?\" — the plural imperative of buying.",
      colloquial: "A vendor's call, worked down a street. Utterly commercial, faintly wheedling.",
      spiritual: "The paradox of grace offered freely and yet not purchasable — <em>akraya</em>, that " +
        "which has no price. The verb creates a marketplace precisely so the marketplace can fail.",
      why: "He could have said <em>take this</em> or <em>receive this</em>. He chose the language of a " +
        "transaction, then spent the charanams explaining that crores cannot complete it. The word sets " +
        "up its own refutation."
    },
    cues: [
      { mark: "The hawker's rhythm", provenance: "tradition",
        text: "Listen for the lilt — this is the repertoire of the padam and javali, music that knows how " +
          "to coax. It should sound like someone selling you something." },
      { mark: "The ailments listed", provenance: "text",
        text: "Lust, anger, arrogance, envy, greed — not a random list of vices but the " +
          "<em>arishadvarga</em>, a formal taxonomy. Listen to it as a medicine label." },
      { mark: "The price", provenance: "text",
        text: "Wait for the line saying crores cannot buy it. The joke turns there: the pitch has been " +
          "for something that was never on sale." },
      { mark: "Which ragam you are hearing", provenance: "rendition",
        text: "Sources split between Khamas and Nadanamakriya for this kriti, and the two make very " +
          "different songs — a wheedling sales pitch, or a hawker's cry in the ragam of pathos. Identify " +
          "which one your recording is using before deciding what the song means." }
    ],
    listening: [
      { performer: "Search — Navaratna 5 renditions", tradition: "Navaratna series",
        raga: "Khamas (some renditions Nadanamakriya)", tala: "Adi", kind: "search", verify: "search",
        q: "Ramajogi Mandu Konare Ramadasu Navaratnam keerthana",
        why: "Worth finding two renditions in the competing ragams and hearing how differently the joke lands." }
    ]
  },

  /* ─────────── Taraka Mantramu ─────────── */
  "taraka-mantramu": {
    beforePlay: "After so much asking elsewhere, here is a man who has found what he was looking for — " +
      "and turns not upward but sideways, to tell a friend. What he found was not a rescue. It was a set " +
      "of syllables.",
    keyWord: {
      word: "Dorikenu", telugu: "దొరికెను", translit: "dorikenu",
      literal: "It was found; it was obtained.",
      colloquial: "What you say about a thing you had misplaced and have now come across — a key, a " +
        "receipt. Faintly accidental: things <em>get found</em> more than one finds them.",
      spiritual: "The completed acquisition of the Taraka mantra. Note the passive shading — the " +
        "grammar does not quite credit the seeker, which fits a tradition holding that the Name is given " +
        "rather than achieved.",
      why: "The whole collection is written in petition and the present tense of need. This one word is " +
        "in the perfect: the search is over, and the song's joy is entirely a matter of its verb."
    },
    cues: [
      { mark: "<span lang='te'>ఓరన</span> — \"orana\"", provenance: "text",
        text: "The pallavi ends by addressing not God but a person — a familiar, slightly rough Telugu " +
          "vocative, roughly \"hey, you.\" Listen for the turn outward. It is the social mechanism of " +
          "sankeerthanam in a single word." },
      { mark: "Dhanyasi's two halves", provenance: "text",
        text: "Five notes going up, seven coming down. Listen for how bare the ascent is and how much " +
          "more room the descent has — a joy arrived at through long deprivation, given a shape to match." },
      { mark: "<span lang='te'>ధన్యుడనైతిని</span> — \"I have become blessed\"", provenance: "text",
        text: "Past tense, not future or hopeful. Listen for the settledness in it." }
    ],
    listening: [
      { performer: "Navaratna series", tradition: "Navaratna series",
        raga: "Dhanyasi", tala: "Adi", kind: "watch", id: "62wzkD8q704", verify: "index-corroborated",
        why: "Listen for the settled, unhurried quality — this is the one song here with nothing left to ask for." }
    ]
  },

  /* ─────────── Hari Hari Rama ─────────── */
  "hari-hari-rama": {
    beforePlay: "A short song built on an uncomfortable argument: that the singer's own unworthiness is " +
      "his qualification. Kanada gives it weight rather than sweetness, which is right — this is not " +
      "self-pity, it is a claim being pressed.",
    keyWord: {
      word: "Hari Hari", telugu: "హరి హరి", translit: "hari hari",
      literal: "The name of Vishnu, doubled.",
      colloquial: "In Telugu and Marathi devotional speech the doubled name works as invocation and as " +
        "sigh at once — what someone says while gathering themselves to speak, or on hearing bad news.",
      spiritual: "Nama uttered before any petition is made, so that the request rests on the Name rather " +
        "than on the merit of the one requesting.",
      why: "The song opens with the only thing its singer claims to possess. Everything after it is an " +
        "argument he expects to lose on the merits."
    },
    cues: [
      { mark: "The doubled name at the opening", provenance: "text",
        text: "Listen for whether it lands as invocation or as sigh. The text supports both, and " +
          "different singers choose differently." },
      { mark: "Kanada's crooked phrases", provenance: "tradition",
        text: "This is a vakra ragam — its lines refuse to travel straight. Listen for the winding, and " +
          "for how it keeps the song serious without tipping into sorrow." },
      { mark: "The turn to Rama's titles", provenance: "text",
        text: "Destroyer of the ten-headed one, delight of Shiva, redeemer of the fallen. Listen for the " +
          "last of these — it is the one the devotee actually needs, and the one his own condition qualifies him for." }
    ],
    listening: [
      { performer: "Search — Navaratna 7 renditions", tradition: "Navaratna series",
        raga: "Kanada", tala: "Adi", kind: "search", verify: "search",
        q: "Hari Hari Rama Ramadasu Navaratnam keerthana Kanada",
        why: "Note that some collections file a closely related text as <em>hari hara rama</em> in Kannada ragam; check which you have." }
    ]
  },

  /* ─────────── Takkuvemi Manaku ─────────── */
  "takkuvemi-manaku": {
    beforePlay: "The one song here that is not addressed to God at all. Ramadasu turns to the people " +
      "around him and asks a question he then answers ten times over, walking through the avataras like " +
      "a man laying evidence on a table. Saurashtram tells you the verdict before the first witness speaks.",
    keyWord: {
      word: "Manaku", telugu: "మనకు", translit: "manaku",
      literal: "To us — and specifically the <em>inclusive</em> we, the one that takes in the person " +
        "you are speaking to.",
      colloquial: "Telugu distinguishes the we-that-includes-you from the we-that-excludes-you. This is " +
        "the first. It gathers the listener in rather than reporting to them.",
      spiritual: "The congregational turn: devotion stated as a shared condition rather than a private " +
        "transaction. This grammatical choice is what makes a song a sankeerthanam.",
      why: "Everywhere else he says <em>nanu</em> — me, protect me, look at me. Here one pronoun changes " +
        "and the song stops being a prayer and becomes an argument made to a room."
    },
    cues: [
      { mark: "The pronoun", provenance: "text",
        text: "Listen for <em>manaku</em> — <em>us</em>. Having heard the other songs' relentless first " +
          "person singular, the shift is audible even without Telugu." },
      { mark: "Saurashtram's auspiciousness", provenance: "tradition",
        text: "This is where the traditional concert-closing <em>mangalam</em> lives. Listen for how the " +
          "ragam settles the question before the words have argued it." },
      { mark: "The avatara roll-call", provenance: "text",
        text: "Matsya, Kurma, Varaha, Vamana and on. Each verse a deed, each answered by the same refrain. " +
          "Listen to it as case law rather than mythology — precedent, then ruling, ten times." },
      { mark: "The refrain's repetition", provenance: "text",
        text: "<em>What do we lack?</em> comes back unchanged after every avatara. Listen for how the " +
          "same question grows more rhetorical each time the evidence is added to." }
    ],
    modern: "\"What do we lack?\" is a harder question now than it was in a Golconda cell, because the " +
      "honest answer is: materially, very little. The song was written by a man with nothing, to reassure " +
      "people with almost nothing. Sung by people with a great deal, it changes into something more " +
      "searching — a question about why abundance has not produced the confidence it promised, and why " +
      "fear scales so comfortably with possession.",
    listening: [
      { performer: "Navaratna series, with lyrics", tradition: "Navaratna series",
        raga: "Saurashtram", tala: "Adi", kind: "watch", id: "qi1Eg0PsR9I", verify: "index-corroborated",
        why: "Listen for the group-singable architecture — this is a song built for a room, not a soloist." }
    ]
  },

  /* ─────────── Kantinedu Ma Ramula ─────────── */
  "kantinedu-ma-ramula": {
    beforePlay: "The Navaratna set closes here, on a completed seeing — and in the ragam of weeping. " +
      "That is not a contradiction. Listen to it knowing that the tears of longing and the tears of " +
      "arrival have always sounded the same.",
    keyWord: {
      word: "Kantinedu", telugu: "కంటినేడు", translit: "kaṇṭinēḍu",
      literal: "<em>Kanti</em> — I saw; <em>nedu</em> — today. \"Today I have seen.\"",
      colloquial: "Plain reportage, the way you would tell someone you ran into a relative in the market.",
      spiritual: "Darshana as a completed event rather than a hoped-for one. In a repertoire of vocatives " +
        "and imperatives, a simple perfective verb.",
      why: "Eight songs of asking, and the ninth opens in the past tense with nothing requested. Whether " +
        "or not the ordering was designed, the set as we receive it resolves petition into sight."
    },
    cues: [
      { mark: "The past tense at the opening", provenance: "text",
        text: "Nothing is being asked for. Listen for the absence of petition — after the other eight, it " +
          "is the loudest thing in the song." },
      { mark: "<span lang='te'>మా రాముల</span> — \"our Rama\"", provenance: "text",
        text: "Not Sri Rama, not Raghupati. The possessive Telugu families use for the household deity. " +
          "Listen for how small and particular the address is." },
      { mark: "Nadanamakriya's falling shape", provenance: "tradition",
        text: "The ragam is conceived as a descent, phrases beginning high and giving way. Listen for joy " +
          "delivered in the contours of lament." },
      { mark: "Khanda chapu, not Adi", provenance: "tradition",
        text: "The Nedunuri notation gives this kriti a five-beat cycle where the rest of the set is in " +
          "eight. Listen for the shorter, slightly off-balance gait — the set does not close in the metre it travelled in." }
    ],
    listening: [
      { performer: "Navaratna series, with lyrics", tradition: "Navaratna series",
        raga: "Nadanamakriya", tala: "Khanda Chapu", kind: "watch", id: "inyd9Jc3lkA", verify: "index-corroborated",
        why: "Closes the nine; listen for the shift into khanda chapu and how differently the set ends." }
    ]
  },

  /* ─────────── Ikshvaku Kula Tilaka ─────────── */
  "ikshvaku-kula-tilaka": {
    beforePlay: "A devotional song that is also an itemised expense claim. Ramadasu prices the temple to " +
      "the coin and presents the bill to the deity it was built for. Sung from the prison he was put in " +
      "for that spending, it is simultaneously his defence and his prayer.",
    keyWord: {
      word: "Ika naina", telugu: "ఇక నైన", translit: "ika naina",
      literal: "\"Even now\" — <em>ika</em>, henceforth/still; <em>naina</em>, even.",
      colloquial: "The phrase of someone who has been waiting a long time and is not being answered. " +
        "It carries everything already tried without naming any of it.",
      spiritual: "The devotee's sense of time inside unanswered prayer — the point at which duration " +
        "itself becomes part of the petition.",
      why: "Two small words hold the twelve years. He does not describe the imprisonment anywhere in the " +
        "song; he simply times the silence, and the timing does the work that description would have."
    },
    cues: [
      { mark: "The sums", provenance: "text",
        text: "Ten thousand varahas for the rampart; gifts itemised for Bharata, Shatrughna, Lakshmana, " +
          "Sita. Listen for the accountancy. It is startling in a devotional text and entirely deliberate." },
      { mark: "\"Do not treat me as a stranger\"", provenance: "text",
        text: "The plea is for recognition, not mercy. For a man whose crime was treating temple funds as " +
          "family funds, listen to how exact that request is." },
      { mark: "Misra chapu's seven beats", provenance: "tradition",
        text: "Where most of this repertoire sits in an even eight, this is commonly set in a limping " +
          "seven. Listen for the asymmetry under a text that is trying to sound reasonable." },
      { mark: "<span lang='te'>రక్షకులెవరింక</span>", provenance: "text",
        text: "\"Who else is there to protect me?\" Listen for where the ledger stops and the surrender " +
          "begins — they are in the same sentence." }
    ],
    modern: "Anyone who has done the right thing by the wrong procedure knows this song. He is not " +
      "claiming innocence — the money was the state's and he spent it — but insisting the account be read " +
      "with its purpose visible. The uncomfortable part is that he is presenting the invoice to God rather " +
      "than to the court, which suggests he had already stopped expecting the court to look at it.",
    listening: [
      { performer: "Search — concert and bhajana renditions", tradition: "Carnatic",
        raga: "Yadukula Kambhoji (commonly)", tala: "Misra Chapu", kind: "search", verify: "search",
        q: "Ikshvaku Kula Tilaka Ramadasu keerthana",
        why: "Listen for whether the singer lets the itemised sums sound matter-of-fact or aggrieved; both readings are current." }
    ]
  },

  /* ─────────── Ee Teeruga Nanu ─────────── */
  "ee-teeruga-nanu": {
    beforePlay: "The question is not whether mercy will come. It is what shape it will arrive in — which " +
      "means the song sounds like anxiety and is built like trust. For many Telugu listeners this is the " +
      "sound of Nadanamakriya itself, carried to them by a film they saw once and never forgot.",
    keyWord: {
      word: "Teeruga", telugu: "తీరుగ", translit: "tīruga",
      literal: "In the manner of; by the way or fashion of. From <em>tīru</em>, manner, mode, way.",
      colloquial: "How something is done rather than whether — the word you use asking after method.",
      spiritual: "Grace's mode rather than its fact. Once the devotee has elected the Lord as protector, " +
        "the manner of protection is explicitly no longer the devotee's business.",
      why: "The whole theological position sits in a grammatical choice. He does not ask <em>will you</em> " +
        "show mercy. He asks <em>in what manner</em> — and the interrogative concedes everything except " +
        "the certainty."
    },
    cues: [
      { mark: "The falling opening", provenance: "tradition",
        text: "Nadanamakriya is conceived as a descent, traditionally begun from above. For a text that " +
          "opens on a question and sinks toward the image of drowning, listen for how the melodic shape " +
          "<em>is</em> the sahityam." },
      { mark: "<span lang='te'>ఇనవంశోత్తమ</span> — the courtly epithet", provenance: "text",
        text: "\"Best of the solar dynasty,\" placed immediately after a line of raw uncertainty. Listen " +
          "for the formality arriving exactly where the composure fails." },
      { mark: "The image of the ocean", provenance: "text",
        text: "<em>Can I swim across?</em> The standard answer in the tradition is that nobody swims it — " +
          "one is ferried. Listen to the question knowing it has an answer elsewhere in this collection." }
    ],
    modern: "Most anxiety is not about whether help will come but about what form it will take, and " +
      "whether we will recognise it as help when it does. Ramadasu's question is the same one, asked " +
      "without the modern assumption that we are owed an explanation in advance. The song does not resolve " +
      "it. It simply keeps asking in a voice that has already decided to stay.",
    listening: [
      { performer: "Search — Carnatic and film renditions", tradition: "Carnatic · and the 1980 film Sankarabharanam",
        raga: "Nadanamakriya", tala: "Adi", kind: "search", verify: "search",
        q: "Ye Teeruga Nanu Daya Juchedavo Ramadasu Nadanamakriya",
        why: "Worth hearing a classical rendition and the film version together — the same ragam doing very different cultural work." }
    ]
  }
};

// Merge enrichment onto the kriti records.
KRITIS.forEach(function (k) {
  var e = ENRICH[k.id];
  if (!e) return;
  Object.keys(e).forEach(function (key) { k[key] = e[key]; });
  // Resolve listening urls
  (k.listening || []).forEach(function (l) {
    l.url = l.kind === 'watch' ? ytWatch(l.id) : ytSearch(l.q);
  });
});

/* ── Ragam detail (second pass) ───────────────────────────────── */
// Scales alone do not explain a ragam. What follows is the grammar: the phrases
// that identify it, the notes it rests on, how its gamakas behave, and what
// separates it from the scale-neighbour it is most often confused with.
//
// These follow common modern practice. Bani (school) variants exist for most
// janya ragams — treat these as the usual account, not the only one. Rasa is
// contextual: nothing here says a ragam "means" an emotion.

const RAGA_DETAIL = {
  "Bhairavi": {
    prayogas: ["S G₂ R₂ G₂ M₁ P", "M₁ P D₂ N₂ Ṡ", "Ṡ N₂ D₁ P", "G₂ M₁ P G₂ R₂ S"],
    jiva: "Gandhara (G₂) and dhaivata carry the ragam; madhyama (M₁) is a common resting place.",
    gamaka: "The gandhara is rarely sung plain — a broad kampita (oscillation) is its normal condition, " +
      "and the long-held madhyama is its other fingerprint.",
    distinguish: "Against its parent Natabhairavi, the giveaway is the ascending D₂ — foreign to the " +
      "parent scale, and what makes Bhairavi bhashanga. Against Mukhari, which shares much of the same " +
      "material, the separation is phrase-by-phrase rather than note-by-note.",
    withText: "A wide tessitura and a habitable lower register let a singer dwell on an opening word " +
      "and still climb for the martial epithets — useful for a text that changes register between verses."
  },
  "Atana": {
    prayogas: ["S R₂ M₁ P N₃ Ṡ", "Ṡ N₂ D₂ P M₁ R₂ S", "P M₁ R₂ G₃ R₂ S"],
    jiva: "Rishabha (R₂), panchama and nishada.",
    gamaka: "Brisk and wide-swinging; the nishada is characteristically unstable, and the gandhara " +
      "appears only as a fleeting vakra touch in descent rather than as a note to rest on.",
    distinguish: "Against Dheerasankarabharanam, its parent, Atana's gandhara never stands still — it " +
      "is approached and left within a phrase, which is why the scale on paper misleads.",
    withText: "The quick, gamaka-heavy motion sits oddly under a text about steadiness, and that friction " +
      "is arguably the setting's whole argument."
  },
  "Ananda Bhairavi": {
    prayogas: ["S G₂ R₂ G₂ M₁ P", "P D₂ P Ṡ", "Ṡ N₂ D₂ P M₁ G₂ R₂ S"],
    jiva: "Gandhara (G₂), madhyama and panchama.",
    gamaka: "A slow, rounded oscillation on the gandhara gives the ragam its warmth; the phrases tend " +
      "to curve back on themselves rather than travel.",
    distinguish: "It borrows D₂ (and, in some phrases, N₃) from outside its parent Natabhairavi — those " +
      "borrowed notes are where the sweetness comes from.",
    withText: "Its unhurried, consoling motion can make a reproach arrive sounding like tenderness, " +
      "which is one reading of why the accusation in this kriti never feels like anger."
  },
  "Saveri": {
    prayogas: ["S R₁ M₁ P D₁ Ṡ", "Ṡ N₃ D₁ P M₁ G₃ R₁ S", "P D₁ Ṡ", "M₁ G₃ R₁ S"],
    jiva: "Rishabha (R₁), madhyama and dhaivata (D₁).",
    gamaka: "The flat second and sixth are heavily oscillated; the ragam leans on them rather than " +
      "passing through.",
    distinguish: "Against Mayamalavagowla, its parent, Saveri drops gandhara and nishada on the way up — " +
      "the five-note ascent is what gives it its plaintive lean.",
    withText: "A supplicating melodic contour under a text asserting sufficiency produces a useful " +
      "tension: the words say <em>enough</em>, the line keeps asking."
  },
  "Khamas": {
    prayogas: ["S M₁ G₃ M₁ P D₂ N₂ Ṡ", "Ṡ N₂ D₂ P M₁ G₃ R₂ S", "M₁ G₃ M₁ P D₂ N₂ Ṡ"],
    jiva: "Madhyama, gandhara and the kaisiki nishada (N₂).",
    gamaka: "The N₂ is the colour note and is usually approached with a slide; phrases lean on M₁ rather " +
      "than resolving quickly to Sa.",
    distinguish: "Against Harikambhoji, its parent, Khamas skips rishabha in ascent and enters through " +
      "the madhyama — that opening leap is the identifying gesture.",
    withText: "Its home is the padam and javali repertoire, music built to coax — which suits a text " +
      "shaped as a sales pitch, if the Khamas attribution is the one your rendition follows."
  },
  "Dhanyasi": {
    prayogas: ["S G₂ M₁ P N₂ Ṡ", "Ṡ N₂ D₁ P M₁ G₂ R₁ S", "M₁ G₂ R₁ S"],
    jiva: "Gandhara (G₂), madhyama and nishada (N₂).",
    gamaka: "The gandhara carries an oscillation; the descent's R₁ is a slow, weighted note rather than " +
      "a passing one.",
    distinguish: "Do not confuse it with <strong>Suddha Dhanyasi</strong>, which is pentatonic in both " +
      "directions and is a janya of Kharaharapriya. Dhanyasi's full descent — including R₁ and D₁ — is " +
      "exactly what Suddha Dhanyasi lacks.",
    withText: "Five notes up and seven down gives a bare ascent and a descent with room to ache — a " +
      "shape that suits a text about something found after long looking."
  },
  "Kanada": {
    prayogas: ["S R₂ G₂ M₁ D₂ N₂ Ṡ", "Ṡ N₂ D₂ M₁ P G₂ M₁ R₂ S", "G₂ M₁ R₂ S", "M₁ P G₂ M₁"],
    jiva: "Gandhara (G₂) and madhyama.",
    gamaka: "The gandhara is characteristically approached from the madhyama above rather than from " +
      "below; the phrases are deliberately crooked and resist straight motion.",
    distinguish: "Against Kharaharapriya, its parent, Kanada omits panchama in ascent and its descent is " +
      "markedly vakra — the winding is the ragam, not an ornament on it.",
    withText: "Its gravity keeps a plea of unworthiness serious rather than self-pitying."
  },
  "Saurashtram": {
    prayogas: ["S R₁ G₃ M₁ P M₁ D₂ N₃ Ṡ", "Ṡ N₃ D₂ N₃ P M₁ G₃ R₁ S", "N₃ D₂ N₃ P"],
    jiva: "Rishabha (R₁), gandhara and nishada (N₃).",
    gamaka: "The N₃–D₂–N₃ turn in descent is the signature gesture; the ragam has a settled, declarative " +
      "motion rather than a searching one.",
    distinguish: "Against Mayamalavagowla, it takes the higher dhaivata D₂ as an anya swara — that one " +
      "note is most of the difference in character.",
    withText: "It is the ragam of the traditional concert-closing mangalam, so a reassurance set in it " +
      "arrives already sounding settled — the music reaches the verdict before the argument does."
  },
  "Nadanamakriya": {
    prayogas: ["Ṡ N₃ D₁ P M₁ G₃ R₁ S", "P M₁ G₃ R₁ S", "G₃ R₁ S"],
    jiva: "Gandhara (G₃) and rishabha (R₁), both usually reached from above.",
    gamaka: "Phrases characteristically begin high and give way; the descent is the ragam's natural " +
      "direction rather than its return journey.",
    distinguish: "It shares its notes with Mayamalavagowla but is treated quite differently — conceived " +
      "as a falling shape, traditionally begun from the upper Sa, and kept within a narrower range. The " +
      "scale is a poor guide here; the contour is the identity.",
    withText: "A melodic line that sinks under a text about drowning, or about a completed seeing, " +
      "means the shape and the sahityam are doing the same work."
  },
  "Varali": {
    prayogas: ["S G₁ R₁ G₁ M₂ P", "M₂ P D₁ N₃ Ṡ", "Ṡ N₃ D₁ P M₂ G₁ R₁ S"],
    jiva: "Gandhara (G₁) and the prati madhyama (M₂).",
    gamaka: "The suddha gandhara is rare in the repertoire and highly distinctive; the vakra opening " +
      "phrase (S G₁ R₁ G₁ M₂) is how the ragam announces itself.",
    distinguish: "Against Kamavardhani (Panthuvarali), which shares the sharp fourth, Varali's gandhara " +
      "is the lowest one — that single note accounts for its very different colour.",
    withText: "Its angularity can make plain descriptive text sound like something glimpsed rather than " +
      "something seen — one reason a straightforward temple description does not sound straightforward."
  },
  "Keeravani": {
    prayogas: ["S R₂ G₂ M₁ P D₁ N₃ Ṡ", "Ṡ N₃ D₁ P M₁ G₂ R₂ S", "P D₁ N₃ Ṡ"],
    jiva: "Gandhara (G₂), dhaivata (D₁) and nishada (N₃).",
    gamaka: "The catch in the ragam comes from the interval between the flat sixth and the sharp " +
      "seventh; that step is usually taken deliberately rather than glossed over.",
    distinguish: "Against Natabhairavi it differs by one note — the kakali nishada N₃ where Natabhairavi " +
      "has N₂ — and that note changes the whole affect.",
    withText: "Of the three ragams this kriti is sung in, Keeravani keeps the longing nearest the surface."
  },
  "Yadukula Kambhoji": {
    prayogas: ["S R₂ M₁ P D₂ Ṡ", "Ṡ N₂ D₂ P M₁ G₃ R₂ S", "P D₂ Ṡ", "G₃ R₂ S"],
    jiva: "Rishabha (R₂), madhyama and dhaivata.",
    gamaka: "Restrained by convention — the ragam is usually kept in a lower tessitura and not opened " +
      "out, which is part of its character.",
    distinguish: "Against Kambhoji it drops gandhara in ascent and stays lower; the two are close on " +
      "paper and quite distinct in practice.",
    withText: "Its habitual restraint suits a text of complaint that is trying not to sound like one."
  }
};

Object.keys(RAGA_DETAIL).forEach(function (name) {
  if (RAGAS[name]) {
    Object.keys(RAGA_DETAIL[name]).forEach(function (k) {
      RAGAS[name][k] = RAGA_DETAIL[name][k];
    });
  }
});

/* ── Collection-level essays (second pass) ────────────────────── */

const COLLECTION = {

  /* ---- Ramadasu is not praying politely ---- */
  voice: {
    title: "Ramadasu Is Not Praying Politely",
    lede: "Read the collection in one sitting and a single thing stands out: not what he asks for, but " +
      "the standing he assumes while asking.",
    intro: "Devotional poetry is often addressed upward, in the careful vocabulary of a subject before a " +
      "sovereign. Ramadasu knows that vocabulary — <em>king among kings, worshipped by the kings of " +
      "kings</em> — and uses it, and then leaves it behind. What follows is a progression you can trace " +
      "across the songs. It is not a chronology; several of these registers appear inside a single kriti.",
    stages: [
      { n: 1, name: "Asking", telugu: "ప్రార్థన",
        text: "The plain petition. <em>Rama daya judave</em> — look at me with compassion. Nothing " +
          "unusual yet; this is where most devotional poetry lives.",
        song: "Rama Daya Judave", songId: "rama-daya-judave" },
      { n: 2, name: "Pleading", telugu: "వేడుకోలు",
        text: "The asking acquires duration. <em>Sare sareku vediti</em> — again and again I have begged. " +
          "The past tense starts doing work the words do not state.",
        song: "Rama Daya Judave", songId: "rama-daya-judave" },
      { n: 3, name: "Complaining", telugu: "నింద",
        text: "<em>Paluke bangaramayena</em> — has your speech turned to gold? The silence is named as a " +
          "fault. The tradition calls this <em>ninda-stuti</em> and treats it as a genre, not a lapse.",
        song: "Paluke Bangaramayena", songId: "paluke-bangaramayena" },
      { n: 4, name: "Arguing", telugu: "వాదన",
        text: "<em>Pantamu seya nenentati vadanu</em> — who am I to hold out in a contest of wills " +
          "against you? He concedes the argument while making it, which is itself a move in the argument.",
        song: "Paluke Bangaramayena", songId: "paluke-bangaramayena" },
      { n: 5, name: "Presenting evidence", telugu: "సాక్ష్యం",
        text: "The ledger. Ten thousand varahas for the rampart; gifts itemised for Rama's brothers and " +
          "for Sita; elsewhere, a crore of written names. He submits an account.",
        song: "Ikshvaku Kula Tilaka", songId: "ikshvaku-kula-tilaka" },
      { n: 6, name: "Invoking the promises", telugu: "బిరుదు",
        text: "<em>Sharanagata-trana birudankuduvu kava</em> — are you not <em>titled</em> protector of " +
          "the surrendered? He stops asking for a favour and asks God to be consistent with His own " +
          "advertised office. The squirrel of the Setu is cited the same way: as precedent.",
        song: "Paluke Bangaramayena", songId: "paluke-bangaramayena" },
      { n: 7, name: "Going through Sita", telugu: "పురుషకారం",
        text: "The case will not be won on merit, so he turns to the one who does not weigh it. " +
          "<em>Chakkaga brovave chakkani Janaki.</em> In Sri Vaishnava theology this is structural: the " +
          "soul reaches the Lord through the Mother.",
        song: "Rama Daya Judave", songId: "rama-daya-judave" },
      { n: 8, name: "Surrendering", telugu: "శరణాగతి",
        text: "<em>Dikku nivani nammiti</em> — you are my only direction. <em>Rakshakulevarinka</em> — who " +
          "else is there? Not a boast of exclusive devotion but a confession of exhausted options, which " +
          "the tradition holds to be the same thing when it is honest.",
        song: "Ikshvaku Kula Tilaka", songId: "ikshvaku-kula-tilaka" },
      { n: 9, name: "Seeing", telugu: "దర్శనం",
        text: "<em>Kantinedu ma ramula</em> — today I have seen our Rama. Nothing is requested. The " +
          "asking has not been answered so much as outlived.",
        song: "Kantinedu Ma Ramula", songId: "kantinedu-ma-ramula" }
    ],
    close: "It would be easy to read the middle of that list as irreverence. It is worth being precise " +
      "about why it is not. A stranger has no expectation and therefore cannot be disappointed; only " +
      "someone who believes he belongs can be aggrieved by silence. The complaint presupposes the " +
      "relationship it appears to strain. This is what the tradition means by <em>bhakti-dharshtya</em> — " +
      "devotional audacity — and why the same poet can spend three verses arguing and close, without any " +
      "change of key, on a domestic endearment. He was never outside the family. He was arguing within it."
  },

  /* ---- The Navaratna arc ---- */
  arc: {
    title: "The Nine, Read as One Journey",
    lede: "An interpretive reading — offered as a way of hearing the set, not as a claim about how it was assembled.",
    caveat: "<strong>What is established:</strong> the nine keertanas, and their order as published in the " +
      "notation volume prepared under the guidance of Sangita Kalanidhi Nedunuri Krishnamurthy, which is " +
      "the sequence in which they are sung as a group at Ramadasu Jayanti observances. " +
      "<strong>What is not established:</strong> that Ramadasu composed them as a cycle, or intended any " +
      "emotional progression between them. They were gathered as his nine best-loved songs, not written " +
      "as a suite. The arc below is what emerges when you listen to them in the received order — a " +
      "PaddySpeaks reading, and nothing stronger.",
    steps: [
      { n: 1, song: "Idigo Bhadradri", songId: "adigo-bhadradri", raga: "Varali",
        stage: "Darshana", telugu: "దర్శనం", gloss: "Look — there it is",
        text: "The set opens by pointing at something, not asking for it." },
      { n: 2, song: "Sri Rama Namame", songId: "sri-rama-namame", raga: "Atana",
        stage: "The Name", telugu: "నామం", gloss: "One syllable, held",
        text: "From the seen object to the sounded name — and the claim that holding it is enough." },
      { n: 3, song: "Paluke Bangaramayena", songId: "paluke-bangaramayena", raga: "Ananda Bhairavi",
        stage: "The question", telugu: "ప్రశ్న", gloss: "Why won't you answer?",
        text: "The first crack. The Name is being chanted and nothing is coming back." },
      { n: 4, song: "Sri Ramula Divyanama", songId: "sri-ramula-divyanama", raga: "Saveri",
        stage: "Sufficiency", telugu: "చాలు", gloss: "It is enough",
        text: "The answer to the question is not a reply but a reassertion: stop looking elsewhere." },
      { n: 5, song: "Ramajogi Mandu", songId: "ramajogi-mandu", raga: "Khamas",
        stage: "Medicine", telugu: "మందు", gloss: "For what ails you",
        text: "Sufficiency turns practical. The Name is prescribed, against named afflictions." },
      { n: 6, song: "Taraka Mantramu", songId: "taraka-mantramu", raga: "Dhanyasi",
        stage: "Discovery", telugu: "దొరికెను", gloss: "I sought, and found",
        text: "The prescription is filled. The one perfect tense in the set." },
      { n: 7, song: "Hari Hari Rama", songId: "hari-hari-rama", raga: "Kanada",
        stage: "Helplessness", telugu: "కార్పణ్యం", gloss: "Do not think me low",
        text: "And immediately the ground gives way again — having found it, he doubts he deserves it." },
      { n: 8, song: "Takkuvemi Manaku", songId: "takkuvemi-manaku", raga: "Saurashtram",
        stage: "Confidence", telugu: "ధైర్యం", gloss: "What do we lack?",
        text: "The recovery, and the only song in the nine addressed to other people rather than to God." },
      { n: 9, song: "Kantinedu Ma Ramula", songId: "kantinedu-ma-ramula", raga: "Nadanamakriya",
        stage: "Darshana fulfilled", telugu: "కంటినేడు", gloss: "Today I have seen",
        text: "The set closes where it opened — on seeing. But the first was a finger pointing outward, " +
          "and this one is in the past tense and the first person." }
    ],
    close: "Whether or not anyone designed it, the received order does something worth noticing: it " +
      "begins and ends on sight. The first song points at a temple and says <em>look</em>. The last says " +
      "<em>I have seen</em>. Everything between is the distance between those two sentences — the Name " +
      "taken up, doubted, prescribed, found, doubted again, and finally not needed as an argument. " +
      "It also ends in a different metre from the one it travelled in, which is either an accident of " +
      "compilation or the most elegant thing about the set."
  },

  /* ---- Concert hall vs bhajan hall ---- */
  halls: {
    title: "Concert Hall and Bhajan Hall",
    lede: "The same composition, in two rooms, doing two different things. Neither is the degraded version " +
      "of the other.",
    rows: [
      { aspect: "The direction of the singing", concert: "Performer &rarr; audience.",
        bhajan: "Everyone &rarr; Rama." },
      { aspect: "What the ragam is for", concert: "Exploration. Alapana before the piece; the ragam's " +
          "grammar laid out at length.", bhajan: "A vessel. Held steady so attention can go elsewhere." },
      { aspect: "Elaboration", concert: "Sangatis — successive variations opening the same line further. " +
          "Niraval, kalpana svaras, manodharma.", bhajan: "Minimal. The line is sung as it is, and sung " +
          "again. Variation would work against what repetition is building." },
      { aspect: "Architecture", concert: "Pallavi &rarr; anupallavi &rarr; charanams, shaped as one arc " +
          "with a planned climax.", bhajan: "Cyclical. The refrain returns after every unit, for as long " +
          "as the singing lasts." },
      { aspect: "What is being cultivated", concert: "Aesthetic appreciation; bhava conveyed and received.",
        bhajan: "Absorption. Nama-smarana — the singer altered by the repetition." },
      { aspect: "Where the boundary is", concert: "Between performer and listener. The separation is the form.",
        bhajan: "Dissolving. There is no audience, only participants at different volumes." }
    ],
    close: "In the concert hall we listen to someone sing Rama.<br>In Nama Sankeerthanam, eventually the " +
      "room itself begins saying Rama.",
    note: "Both rooms have kept this repertoire alive, and they have kept different things about it. The " +
      "concert tradition preserved the music's architecture and gave us the settings most people now know. " +
      "The bhajana tradition preserved the songs themselves, nightly, for three centuries, without notation " +
      "and without needing any."
  },

  /* ---- Why these songs survived ---- */
  survival: {
    title: "Why These Songs Survived",
    lede: "Four hundred years is a long time for a song to stay singable. It is worth asking what these " +
      "particular ones have.",
    reasons: [
      { head: "Refrains a room can catch on one hearing",
        text: "<em>Paluke bangaramayena. Takkuvemi manaku. Rama daya judave.</em> Short, front-loaded, " +
          "and built to be answered. You can join a bhajana already in progress and be singing within a cycle." },
      { head: "The first person",
        text: "Almost everything here is <em>I</em> — I trusted, I bowed, I wrote, I begged. Not " +
          "descriptions of devotion but sentences in it." },
      { head: "Two registers in one song",
        text: "Sanskrit compounds for the theology, plain Telugu for the desperation — often within four " +
          "lines. The learned listener and the unlettered one are both addressed, and neither is patronised." },
      { head: "The Name carried inside the sound",
        text: "Alliteration on <em>ra</em>, the doubled <em>hari hari</em>, the antadi seams that " +
          "manufacture <em>Sita-Rama</em> at the join. Even a listener following none of the sense is " +
          "hearing the Name continuously." },
      { head: "Complaint as well as praise",
        text: "The songs make room for the experience of not being answered. A repertoire that only " +
          "celebrated would have less use on a bad night." },
      { head: "Architecture built for groups",
        text: "Refrain, verse, refrain — with the sense engineered so the refrain must return. These are " +
          "not solo art-songs that a congregation borrowed; they are congregational from the joinery up." },
      { head: "Musical adaptability",
        text: "Because Ramadasu left words and not notation, every generation could set them again. What " +
          "looks like a gap in the record is arguably the reason the songs never became period pieces." },
      { head: "Vulnerability that does not resolve",
        text: "He does not tidy the endings. The silence in <em>Paluke Bangaramayena</em> is never " +
          "explained, and the song is four centuries old and still sung." }
    ],
    close: "Underneath all of it is one structural fact. Ramadasu did not mainly write songs that people " +
      "could perform. He wrote <strong>first-person sentences that generations of strangers could " +
      "temporarily make their own</strong> — and then, in the last verse of each, stepped aside and named " +
      "himself in the third person, so that the <em>I</em> was left standing empty for whoever came next."
  },

  /* ---- The coda ---- */
  coda: {
    lines: [
      "After all the ragams, talams, manuscripts, disagreements, meanings and interpretations, " +
        "Ramadasu eventually leaves us with something embarrassingly simple:",
      "Rama.",
      "Perhaps that is why these songs survived.",
      "The scholarship helps us understand the words.",
      "The music helps us feel them.",
      "Nama Sankeerthanam asks us to do one thing more:",
      "Sing them until the distinction between singer, song and Name begins to disappear."
    ],
    final: "Sri Rama Jaya Rama Jaya Jaya Rama.",
    finalTe: "శ్రీ రామ జయ రామ జయ జయ రామ"
  },

  /* ---- The reader's journey ---- */
  journey: [
    { step: "Read the words", te: "సాహిత్యం" },
    { step: "Understand the meaning", te: "అర్థం" },
    { step: "Discover the inner meaning", te: "అంతరార్థం" },
    { step: "Hear the ragam", te: "రాగం" },
    { step: "Listen to the keertana", te: "కీర్తన" },
    { step: "Return to the words differently", te: "మళ్ళీ" }
  ]
};

/* ── Kapi (added with Song 02) ────────────────────────────────── */

RAGAS["Kapi"] = {
  telugu: "కాపి", melakarta: "Janya of Kharaharapriya (22nd)", type: "Audava-sampurna, bhashanga",
  arohana: "S R₂ M₁ P N₂ Ṡ", avarohana: "Ṡ N₂ D₂ N₂ P M₁ G₂ R₂ S",
  bhava: "Often used for tenderness, yearning and devotional warmth",
  note: "One of the most-loved ragams in the devotional and lighter-classical repertoire. It is " +
    "<em>bhashanga</em> — it admits notes from outside its parent scale, chiefly antara gandhara (G₃) and " +
    "kakali nishada (N₃), and those borrowed touches are exactly where its characteristic ache lives. " +
    "<strong>Carnatic Kapi is not Hindustani Kafi.</strong> The names are cognate and the ragams are not: " +
    "Hindustani Kafi corresponds far more closely to Kharaharapriya itself, while Carnatic Kapi is a " +
    "distinct janya with its own phrases and its own borrowed colours.",
  prayogas: ["S R₂ M₁ P", "P N₂ Ṡ", "Ṡ N₂ D₂ N₂ P", "M₁ G₂ R₂ S", "P M₁ G₂ R₂ S"],
  jiva: "Gandhara (G₂), nishada (N₂) and rishabha (R₂); the madhyama is a frequent resting place.",
  gamaka: "The sadharana gandhara carries a slow oscillation, and the anya swaras — the raised gandhara " +
    "and nishada — are touched in passing rather than settled on. That glancing quality is the ragam's " +
    "signature: it brightens for an instant and then falls back.",
  distinguish: "Against its parent Kharaharapriya, Kapi drops gandhara and dhaivata in ascent and adds " +
    "the borrowed G₃/N₃ in descent. Against Hindustani Kafi — a genuinely different ragam despite the " +
    "shared name — the borrowed notes and the vakra descent are what set it apart.",
  withText: "Its ability to lean warm and then catch suits a text that repeats one word until the word " +
    "changes temperature: the same syllable can be brightened by an anya touch on one repetition and left " +
    "plain on the next, which is precisely what a bhava intensifier needs."
};

/* ── Song 02: Caranamule Nammiti ──────────────────────────────── */

KRITIS.push({
  id: "caranamule-nammiti",
  title: "Caranamule Nammiti",
  telugu: "చరణములే నమ్మితి",
  translit: "caraṇamulē nammiti",
  gloss: "\"Your feet — those alone I have trusted\"",
  raga: "Kapi",
  ragaConfidence: "established",
  ragaNote: "Kapi, Adi talam — consistent across the sources consulted, including karnatik.com and " +
    "several lyrics editions that name the ragam in their own titles.",
  tala: "Adi",
  navaratna: null,
  featured: true,
  article: { href: "caranamule-nammiti/", label: "Read the full article" },
  bhava: "Sharanagati — surrender arrived at by repetition",
  summary: "Six verses, and in each one a single word is said three times. The dictionary meaning never " +
    "changes. Everything else does.",

  pallavi: {
    telugu: "చరణములే నమ్మితి\nనీ దివ్య చరణములే నమ్మితి",
    translit: "caraṇamulē nammiti\nnī divya caraṇamulē nammiti",
    meaning: "Your feet — those alone I have trusted. In your divine feet alone I have placed my trust.",
    note: "<strong>The hinge of the whole composition.</strong> Every one of the six charanams ends on the " +
      "bare words <em>nī divya</em> — \"your divine…\" — which is not a finished phrase. It completes only " +
      "when the singer returns to the pallavi and supplies <em>caraṇamulē nammiti</em>. Six times, the " +
      "verse hands off mid-thought and the refrain finishes the sentence."
  },
  anupallavi: null,
  anupallaviNote: "The composition is a pallavi with six charanams; the sources consulted show no anupallavi.",
  charanams: [
    { num: 1,
      telugu: "వారిధి గట్టిన వర భద్రాచల\nవరదా వరదా వరదా నీ దివ్య",
      translit: "vāridhi gaṭṭina vara bhadrāchala\nvaradā varadā varadā nī divya",
      meaning: "O boon-giver of blessed Bhadrachalam, you who bound the ocean — Varada, Varada, Varada… your divine…",
      note: "<em>Vāridhi</em>, the ocean; <em>gaṭṭina</em>, bound or built across — the Setu. The verse " +
        "opens on the largest thing Rama ever did and closes on a single word said three times." },
    { num: 2,
      telugu: "ఆది పురుష నన్నరమర సేయకుమయ్యా\nఅయ్యా అయ్యా నీ దివ్య",
      translit: "ādi puruṣa nannaramara sēyakumayyā\nayyā ayyā nī divya",
      meaning: "O primordial being, do not hold back from me — my Lord, my Lord… your divine…",
      note: "<strong>Textual variant.</strong> Some Telugu sources read <em>ādi puruṣa</em> (primordial " +
        "being); others preserve or add <em>ādiśēṣa</em>. Translations also differ on " +
        "<em>aramara</em> (అరమర) — reserve, reticence, holding something back: some render the line " +
        "\"do not keep any reserve from me,\" others \"do not hold my devotion at arm's length.\" " +
        "Both readings come from the same word. Sources differ; neither has been normalised away here." },
    { num: 3,
      telugu: "వనమున రాతిని వనితగ జేసిన\nచరణము చరణము చరణము నీ దివ్య",
      translit: "vanamuna rātini vanitaga jēsina\ncaraṇamu caraṇamu caraṇamu nī divya",
      meaning: "The foot that in the forest made a stone into a woman — that foot, that foot, that foot… your divine…",
      note: "The Ahalya episode: Rama's coming to the hermitage restores her from stone to living form. " +
        "The verse names the deed and then simply points, three times, at the instrument of it." },
    { num: 4,
      telugu: "పాదారవిందమే ఆధారమని నేను\nపట్టితి పట్టితి పట్టితి నీ దివ్య",
      translit: "pādāravindamē ādhāramani nēnu\npaṭṭiti paṭṭiti paṭṭiti nī divya",
      meaning: "Holding your lotus feet alone to be my support, I have grasped them — I have held on, held on, held on… your divine…",
      note: "<em>Pādāravinda</em>, lotus-feet; <em>ādhāra</em>, support or foundation; <em>paṭṭiti</em>, " +
        "I seized, I caught hold. The only charanam whose repeated word is a verb the devotee performs " +
        "rather than a name he calls." },
    { num: 5,
      telugu: "వెయ్యారు విధముల కుయ్యాలించి రావయ్యా\nఅయ్యా అయ్యా నీ దివ్య",
      translit: "veyyāru vidhamula kuyyāliṁci rāvayyā\nayyā ayyā nī divya",
      meaning: "Hear my cry, uttered a thousand ways, and come — my Lord, my Lord… your divine…",
      note: "<em>Veyyāru</em> is literally <em>veyyi</em> (a thousand) plus <em>āru</em> (six) — a thousand " +
        "and six — but it is idiomatic Telugu for \"countless, in every conceivable way,\" and is not " +
        "meant to be counted. <em>Kuyyi</em> is a cry or wail; <em>ālinci</em>, having heard." },
    { num: 6,
      telugu: "బాగుగ నన్నేలు భద్రాచల రామదాసుడ\nదాసుడ దాసుడ నీ దివ్య",
      translit: "bāguga nannēlu bhadrāchala rāmadāsuḍa\ndāsuḍa dāsuḍa nī divya",
      meaning: "Rule over me graciously, O Lord of Bhadrachalam — [I am your] servant, servant, servant… your divine…",
      note: "<strong>The mudra, and what happens to it.</strong> <em>Nannu ēlu</em> — rule me, govern me, " +
        "take me into your keeping. The signature <em>Bhadrāchala Rāmadāsuḍa</em> arrives, and then the " +
        "last three syllables of his own name detach and repeat on their own: <em>dāsuḍa, dāsuḍa</em>. " +
        "See the esoteric reading below." }
  ],

  esoteric: [
    { head: "Every verse ends mid-sentence",
      evidence: "TEXTUAL",
      text: "All six charanams close on <em>nī divya</em> — \"your divine…\" — and stop. It is not a " +
        "phrase; it is a dangling adjective waiting for its noun. The noun only arrives when the singer " +
        "returns to the pallavi: <em>caraṇamulē nammiti</em>. So the structure guarantees the refrain " +
        "cannot be skipped and the song cannot be sung once. The same <em>antādi</em> joinery runs through " +
        "<a href=\"#kriti-rama-daya-judave\">Rama Daya Judave</a>, where the seams manufacture " +
        "<em>Sita-Rama</em> and <em>jagadabhirama</em>. Here it does something simpler and more relentless: " +
        "six times the verse reaches for the feet and cannot name them without going back to the beginning." },
    { head: "The repeated word is cut loose from its own grammar",
      evidence: "TEXTUAL",
      text: "This is the sharpest thing in the composition, and it is visible in the transliteration. In " +
        "charanam 2 the line ends <em>sēyakum-<strong>ayyā</strong></em> — where <em>ayyā</em> is the " +
        "ordinary vocative tail of a Telugu verb — and then <em>ayyā, ayyā</em> continue on their own. " +
        "Charanam 5 does it again: <em>rāv-<strong>ayyā</strong></em>, then <em>ayyā, ayyā</em>. " +
        "Charanam 6 does it to his own name: <em>rāma<strong>dāsuḍa</strong></em>, then " +
        "<em>dāsuḍa, dāsuḍa</em>. The repeated word is not appended to the line — it is <em>extracted</em> " +
        "from it. A syllable that was doing grammatical work breaks free of the sentence and becomes pure " +
        "address. That is what the repetitions are: language shedding its structure." },
    { head: "The signature dissolves into the word",
      evidence: "TEXTUAL",
      text: "Follow charanam 6 slowly. The <em>mudra</em> — the composer's signature, the thing that marks " +
        "the song as his — is <em>Bhadrāchala Rāmadāsuḍa</em>. And the word that then repeats is the tail " +
        "of that signature: <em>dāsuḍa</em>, servant. Ramadasu does not sign the song and then say " +
        "something. His name comes apart, and what is left standing when the <em>Bhadrāchala</em> and the " +
        "<em>Rāma</em> have fallen away is the word <em>servant</em>, said twice more into the silence. " +
        "The identity of the poet is consumed by the last word of his own name." },
    { head: "Rama's history offered back to him as argument",
      evidence: "TRADITIONAL",
      text: "Charanam 1 names the binding of the ocean; charanam 3 names Ahalya restored. Neither is " +
        "narrated for its own sake. The devotional logic is precedent: <em>those feet crossed an ocean; " +
        "those feet raised a stone into a woman — and I am asking them to do considerably less for me.</em> " +
        "Ramadasu argues this way constantly. The squirrel of <a href=\"#kriti-paluke-bangaramayena\">Paluke " +
        "Bangaramayena</a> is cited as a ruling, the avataras of <a href=\"#kriti-takkuvemi-manaku\">Takkuvemi " +
        "Manaku</a> as ten pieces of evidence. Here the case law is compressed into two verses." },
    { head: "Caraṇa and śaraṇa — a resonance, not an etymology",
      evidence: "TRADITIONAL",
      text: "The song turns on <em>caraṇa</em>, foot, and everything it says about those feet is the " +
        "language of <em>śaraṇa</em>, refuge. It is worth being precise: these are two distinct Sanskrit " +
        "words with distinct roots, and the tradition does not claim otherwise. What it does is let them " +
        "lean on each other — in devotional usage the Lord's <em>caraṇa</em> is where one takes " +
        "<em>śaraṇa</em>, and <em>śaraṇāgati</em> is quite literally described as falling at the feet. " +
        "The resonance is real; the etymology is not. Ramadasu is working the first, not asserting the second." },
    { head: "Why the intensification cannot be a code",
      evidence: "INTERPRETIVE",
      text: "It is tempting to look for a hidden system in the triples — three for the three gunas, or the " +
        "three levels of speech, or some tantric count. Nothing in the text supports that, and reaching for " +
        "it would cheapen what is actually happening. The repetitions are <strong>bhava intensifiers</strong>. " +
        "The lexical meaning of <em>ayyā</em> is identical on all three soundings; what changes is the " +
        "distance between the one calling and the one called. This is the same mechanism as " +
        "<em>nama-japa</em> — where the Name is not decoded but dwelt in — and it is why a bhajana hall " +
        "can sing one line for twenty minutes without anyone thinking it has been repeated." }
  ],

  sahitya: "Notice the direction of travel across the six verses. Charanam 1 describes Rama in the third " +
    "person — <em>he who bound the ocean</em>. Charanam 2 turns to address him directly. Charanam 3 points " +
    "at his feet. Charanam 4 takes hold of them. Charanam 5 is a cry with almost no content left in it. " +
    "Charanam 6 is no longer about Rama at all — it is the devotee stating what he is. The song begins as " +
    "description and ends as identity, and the repeated words are the rungs.",

  /* ── second-pass layer ── */
  beforePlay: "Read the words once and you will think you understand the song. You will not, quite. " +
    "Six verses, and each one ends by saying a single word three times — <em>varadā, varadā, varadā</em>. " +
    "On the page that looks like emphasis. Sung, it is a man getting closer with each repetition, until " +
    "by the last verse he has stopped describing God and is only saying what he himself is.",

  keyWord: {
    word: "Nammiti", telugu: "నమ్మితి", translit: "nammiti",
    literal: "I trusted; I believed. Past tense, first person.",
    colloquial: "In everyday Telugu, <em>nammu</em> is what you do with a person, not a proposition — " +
      "you trust someone with money, with a child, with a secret. It carries risk.",
    spiritual: "Closer to <em>I have entrusted myself to you</em> than to <em>I believe that you exist</em>. " +
      "The devotional force is dependence, not assent — and the past tense makes it a thing already done " +
      "rather than a resolution being formed.",
    why: "The pallavi could have said <em>I worship</em>, or <em>I praise</em>, or <em>I take refuge</em>. " +
      "It says <em>I trusted</em> — the ordinary word for handing something valuable to someone and " +
      "walking away. And it says it in the completed past, twice, before the song has argued anything."
  },

  cues: [
    { mark: "The first <span lang='te'>వరదా</span>, and then the second", provenance: "tradition",
      text: "Listen to whether the singer keeps the three soundings identical or lets them change. Most " +
        "do not repeat them flat — the second usually opens a little, the third leans. Nothing in the text " +
        "instructs this; it is what performers do with a word that has been handed to them three times." },
    { mark: "The seam at <span lang='te'>నీ దివ్య</span>", provenance: "text",
      text: "Every charanam ends on an unfinished phrase — \"your divine…\" — and the refrain completes it. " +
        "Listen for the small lean into the return. It is in the text, so every performance has it, but " +
        "you have to know it is there to hear the verse handing off." },
    { mark: "<span lang='te'>అయ్యా</span> breaking off from the verb", provenance: "text",
      text: "In charanams 2 and 5 the first <em>ayyā</em> is the tail of a word — <em>sēyakum-ayyā</em>, " +
        "<em>rāv-ayyā</em> — and the next two stand alone. Listen for the moment the syllable stops being " +
        "grammar and becomes a call." },
    { mark: "<span lang='te'>పట్టితి</span> — the grip", provenance: "tradition",
      text: "The one repeated word that is an action rather than an address. Many singers tighten here — " +
        "shorter phrases, less ornament — which turns the triple into something closer to a grip than a " +
        "cry. Worth comparing across renditions; the text does not require it." },
    { mark: "The last <span lang='te'>దాసుడ</span>", provenance: "text",
      text: "His own signature comes apart and leaves the word <em>servant</em> standing alone. Listen for " +
        "where the singer places the weight — on <em>Rāmadāsuḍa</em>, the name, or on the bare " +
        "<em>dāsuḍa</em> that follows it. That choice is the whole reading of the song." }
  ],

  modern: "The song is built out of a suspicion most people know: that being heard requires saying it " +
    "again. We rephrase, escalate, try a different channel, wonder whether the failure is in the asking. " +
    "Ramadasu does all of that — <em>veyyāru vidhamula</em>, a thousand ways — and arrives somewhere " +
    "unexpected. The repetitions do not get louder or more clever. They get shorter, until only one word " +
    "is left. Whatever else that is, it is not the behaviour of someone trying harder to be persuasive. " +
    "It looks more like what happens when persuasion stops mattering and only the address remains.",

  listening: [
    { performer: "Dr. M. Balamuralikrishna", tradition: "Concert",
      raga: "Kapi", tala: "Adi", kind: "watch", id: "T1Kk2qwo8Go", verify: "index-corroborated",
      why: "Listen for how little he does to the repetitions — the restraint is the interpretation." },
    { performer: "Rendition with English and Telugu lyrics", tradition: "Ragam Kapi, with text on screen",
      raga: "Kapi", tala: "Adi", kind: "watch", id: "32dRhSXeoFo", verify: "index-corroborated",
      why: "The easiest way to watch the triples arrive while you hear them — useful on a first listen." },
    { performer: "Kaapi &middot; Adi &middot; classical rendition", tradition: "Carnatic",
      raga: "Kapi", tala: "Adi", kind: "watch", id: "HRb8vO3Oea0", verify: "index-corroborated",
      why: "Names its ragam and talam in the title; a straightforward reading to compare the others against." },
    { performer: "Sri Ramadasu (2006) — film version", tradition: "Popular / film",
      raga: "Kapi-based film setting", tala: "Adi", kind: "watch", id: "D0JIP3byR1k", verify: "index-corroborated",
      why: "How most Telugu listeners first met this song; hear what a film arrangement does to a bhava intensifier." }
  ],

  sources: [
    { label: "Karnatik.com — charaNamulE nammiti (Kapi, Adi)", url: "https://www.karnatik.com/c2465.shtml" },
    { label: "Bhadrachalaramadasu.com — Charanamule nammiti", url: "https://bhadrachalaramadasu.com/50-charanamule-nammiti/" },
    { label: "Rasikas.org — translation discussion for charaNamuLe nammiti", url: "https://www.rasikas.org/forums/viewtopic.php?t=22420" },
    { label: "Templesinindia — Charanamule Nammiti lyrics", url: "https://templesinindiainfo.com/charanamu-le-nammiti-lyrics-in-english-ramadasu-keerthana/" },
    { label: "Slokam.in — Charanamule Nammithi (Telugu and English)", url: "https://slokam.in/charanamule-nammithi-in-english/" }
  ]
});

// Resolve listening urls for the pushed kriti (the earlier merge pass has already run).
KRITIS.filter(function (k) { return k.id === 'caranamule-nammiti'; })
  .forEach(function (k) {
    k.listening.forEach(function (l) {
      l.url = l.kind === 'watch' ? ytWatch(l.id) : ytSearch(l.q);
    });
  });
