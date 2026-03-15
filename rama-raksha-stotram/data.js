// Sri Rama Raksha Stotram - Complete Text
// =========================================
// Composed by: Sage Budha Kaushika
// Deity: Sri Sita Ramachandra
// Metre: Anushtup (and others)
// Source: Traditional / shlokam.org / sanskritdocuments.org

const STOTRAM_DATA = {
  title: "Sri Rama Raksha Stotram",
  titleSanskrit: "श्रीरामरक्षास्तोत्रम्",
  subtitle: "The Protective Armour of Lord Rama",
  composer: "Sage Budha Kaushika",
  deity: "Sri Sita Ramachandra",
  metre: "Anushtup",

  viniyoga: {
    devanagari: "ॐ अस्य श्रीरामरक्षास्तोत्रमन्त्रस्य\nबुधकौशिक ऋषिः\nश्री सीतारामचन्द्रो देवता\nअनुष्टुप् छन्दः\nसीता शक्तिः\nश्रीमद्धनुमान् कीलकम्\nश्रीरामचन्द्रप्रीत्यर्थे जपे विनियोगः",
    transliteration: "ōṁ asya śrīrāmarakṣāstōtramantrasya\nbudhakaushika ṛṣiḥ\nśrī sītārāmacandrō dēvatā\nanuṣṭup chandaḥ\nsītā śaktiḥ\nśrīmaddhanuмān kīlakam\nśrīrāmacandrаprītyarthē japē viniyōgaḥ",
    translation: "Om. For this mantra of Sri Rama Raksha Stotram: the sage is Budha Kaushika; the deity is Sri Sita Ramachandra; the metre is Anushtup; the power (Shakti) is Sita; the anchor (Kilakam) is Sri Hanuman; it is recited for the pleasure of Sri Ramachandra."
  },

  dhyanam: [
    {
      num: 1,
      type: "dhyanam",
      devanagari: "चरितं रघुनाथस्य शतकोटिप्रविस्तरम् ।\nएकैकमक्षरं पुंसां महापातकनाशनम् ॥",
      transliteration: "caritaṁ raghunāthasya śatakōṭipravistaram |\nēkaikamakṣaraṁ puṁsāṁ mahāpātakanāśanam ||",
      translation: "The story of Raghunatha (Rama) extends over a hundred crore (verses). Each syllable of it destroys the greatest of sins of men."
    },
    {
      num: 2,
      type: "dhyanam",
      devanagari: "ध्यात्वा नीलोत्पलश्यामं रामं राजीवलोचनम् ।\nजानकीलक्ष्मणोपेतं जटामुकुटमण्डितम् ॥",
      transliteration: "dhyātvā nīlōtpalaśyāmaṁ rāmaṁ rājīvalōcanam |\njānakīlakṣmaṇōpētaṁ jaṭāmukuṭamaṇḍitam ||",
      translation: "Meditating upon Rama, who is dark as the blue lotus, whose eyes are like lotuses, who is accompanied by Janaki (Sita) and Lakshmana, and who is adorned with a crown of matted hair."
    },
    {
      num: 3,
      type: "dhyanam",
      devanagari: "सासितूणधनुर्बाणपाणिं नक्तंचरान्तकम् ।\nस्वलीलया जगत्त्रातुमाविर्भूतमजं विभुम् ॥",
      transliteration: "sāsitūṇadhanurbāṇapāṇiṁ naktaṁcarāntakam |\nsvalīlayā jagattrātumāvirbhūtamajaṁ vibhum ||",
      translation: "With sword, quiver, bow, and arrow in hand, the destroyer of those who roam in the night (demons), the unborn and all-pervading Lord who manifested by His own will to protect the world."
    }
  ],

  verses: [
    {
      num: 4,
      type: "verse",
      devanagari: "रामरक्षां पठेत्प्राज्ञः पापघ्नीं सर्वकामदाम् ।\nशिरो मे राघवः पातु भालं दशरथात्मजः ॥",
      transliteration: "rāmarakṣāṁ paṭhētprājñaḥ pāpaghnīṁ sarvakāmadām |\nśirō mē rāghavaḥ pātu bhālaṁ daśarathātmajaḥ ||",
      translation: "The wise one should recite the Rama Raksha, which destroys all sins and fulfils all desires. May Raghava (Rama) protect my head. May the son of Dasharatha protect my forehead."
    },
    {
      num: 5,
      type: "verse",
      devanagari: "कौसल्येयो दृशौ पातु विश्वामित्रप्रियः श्रुती ।\nघ्राणं पातु मखत्राता मुखं सौमित्रिवत्सलः ॥",
      transliteration: "kausalyēyō dṛśau pātu viśvāmitrapriyaḥ śrutī |\nghrāṇaṁ pātu makhatrātā mukhaṁ saumitrivatsalaḥ ||",
      translation: "May the son of Kausalya protect my eyes. May He who is dear to Vishvamitra protect my ears. May the protector of the sacrifice protect my nose. May He who is affectionate to Lakshmana protect my mouth."
    },
    {
      num: 6,
      type: "verse",
      devanagari: "जिह्वां विद्यानिधिः पातु कण्ठं भरतवन्दितः ।\nस्कन्धौ दिव्यायुधः पातु भुजौ भग्नेशकार्मुकः ॥",
      transliteration: "jihvāṁ vidyānidhiḥ pātu kaṇṭhaṁ bharatavandитаḥ |\nskandhau divyāyudhaḥ pātu bhujau bhagnēśakārmukaḥ ||",
      translation: "May the treasure of knowledge protect my tongue. May He who is worshipped by Bharata protect my throat. May the wielder of divine weapons protect my shoulders. May He who broke Shiva's bow protect my arms."
    },
    {
      num: 7,
      type: "verse",
      devanagari: "करौ सीतापतिः पातु हृदयं जामदग्न्यजित् ।\nमध्यं पातु खरध्वंसी नाभिं जाम्बवदाश्रयः ॥",
      transliteration: "karau sītāpatiḥ pātu hṛdayaṁ jāmadagnyajit |\nmadhyaṁ pātu kharadhvaṁsī nābhiṁ jāmbavadāśrayaḥ ||",
      translation: "May the Lord of Sita protect my hands. May the conqueror of Parashurama protect my heart. May the slayer of Khara protect my middle. May the refuge of Jambavan protect my navel."
    },
    {
      num: 8,
      type: "verse",
      devanagari: "सुग्रीवेशः कटी पातु सक्थिनी हनुमत्प्रभुः ।\nऊरू रघूत्तमः पातु रक्षःकुलविनाशकृत् ॥",
      transliteration: "sugrīvēśaḥ kaṭī pātu sakthinī hanumatprabhuḥ |\nūrū raghūttamaḥ pātu rakṣaḥkulavināśakṛt ||",
      translation: "May the Lord of Sugriva protect my waist. May the master of Hanuman protect my thighs. May Raghuttama, the destroyer of the demon race, protect my knees."
    },
    {
      num: 9,
      type: "verse",
      devanagari: "जानुनी सेतुकृत्पातु जङ्घे दशमुखान्तकः ।\nपादौ विभीषणश्रीदः पातु रामोऽखिलं वपुः ॥",
      transliteration: "jānunī sētukṛtpātu jaṅghē daśamukhāntakaḥ |\npādau vibhīṣaṇaśrīdaḥ pātu rāmō'khilaṁ vapuḥ ||",
      translation: "May the builder of the bridge (to Lanka) protect my knees. May the slayer of the ten-headed Ravana protect my calves. May He who bestowed glory upon Vibhishana protect my feet. May Rama protect my entire body."
    }
  ],

  phalaShruti: [
    {
      num: 10,
      type: "phala",
      devanagari: "एतां रामबलोपेतां रक्षां यः सुकृती पठेत् ।\nस चिरायुः सुखी पुत्री विजयी विनयान्वितः ॥",
      transliteration: "ētāṁ rāmabalōpētāṁ rakṣāṁ yaḥ sukṛtī paṭhēt |\nsa cirāyuḥ sukhī putrī vijayī vinayānvitaḥ ||",
      translation: "Whoever, being virtuous, recites this Raksha endowed with the power of Rama, that person will enjoy long life, happiness, progeny, victory, and humility."
    },
    {
      num: 11,
      type: "phala",
      devanagari: "पातालभूतलव्योमचारिणश्छद्ममोहिनः ।\nन द्रष्टुमपि शक्तास्ते रक्षितं रामनामभिः ॥",
      transliteration: "pātālabhūtalavyōmacāriṇaśchadmamōhinaḥ |\nna draṣṭumapi śaktāstē rakṣitaṁ rāmanāmabhiḥ ||",
      translation: "Those who move in the nether world, on earth, or in the sky, those who deceive through disguise — they cannot even see the one who is protected by the names of Rama."
    },
    {
      num: 12,
      type: "phala",
      devanagari: "रामेति रामभद्रेति रामचन्द्रेति वा स्मरन् ।\nनरो न लिप्यते पापैर्भुक्तिं मुक्तिं च विन्दति ॥",
      transliteration: "rāmēti rāmabhadrēti rāmacandrēti vā smaran |\nnarō na lipyatē pāpairbhuktiṁ muktiṁ ca vindati ||",
      translation: "A person who remembers 'Rama', 'Ramabhadra', or 'Ramachandra' is not tainted by sins and attains both worldly enjoyment and liberation."
    },
    {
      num: 13,
      type: "phala",
      devanagari: "जगज्जैत्रैकमन्त्रेण रामनाम्नाभिरक्षितम् ।\nयः कण्ठे धारयेत्तस्य करस्थाः सर्वसिद्धयः ॥",
      transliteration: "jagajjaitraikamantreṇa rāmanāmnābhirakṣitam |\nyaḥ kaṇṭhē dhārayēttasya karasthāḥ sarvasiddhayaḥ ||",
      translation: "He who wears around his neck (this hymn) protected by the name of Rama — the one mantra that conquers the world — all supernatural powers rest in his hands."
    },
    {
      num: 14,
      type: "phala",
      devanagari: "वज्रपञ्जरनामेदं यो रामकवचं स्मरेत् ।\nअव्याहताज्ञः सर्वत्र लभते जयमङ्गलम् ॥",
      transliteration: "vajrapañjaranāmēdaṁ yō rāmakavacaṁ smarēt |\navyāhatājñaḥ sarvatra labhatē jayamaṅgalam ||",
      translation: "He who remembers this armour of Rama, called the Vajra Panjara (diamond cage), his commands are never obstructed, and he attains victory and auspiciousness everywhere."
    },
    {
      num: 15,
      type: "phala",
      devanagari: "आदिष्टवान्यथा स्वप्ने रामरक्षामिमां हरः ।\nतथा लिखितवान्प्रातः प्रबुद्धो बुधकौशिकः ॥",
      transliteration: "ādiṣṭavānyathā svapnē rāmarakṣāmimāṁ haraḥ |\ntathā likhitavānprātaḥ prabuddhō budhakaushikaḥ ||",
      translation: "As Lord Shiva instructed this Rama Raksha in a dream, so did Budha Kaushika write it down upon waking in the morning."
    }
  ],

  additionalVerses: [
    {
      num: 16,
      type: "additional",
      devanagari: "आरामः कल्पवृक्षाणां विरामः सकलापदाम् ।\nअभिरामस्त्रिलोकानां रामः श्रीमान्स नः प्रभुः ॥",
      transliteration: "ārāmaḥ kalpavṛkṣāṇāṁ virāmaḥ sakalāpadām |\nabhirāmastriloकānāṁ rāmaḥ śrīmānsa naḥ prabhuḥ ||",
      translation: "He is the garden of wish-fulfilling trees, the cessation of all calamities, the delight of the three worlds — that glorious Rama is our Lord."
    },
    {
      num: 17,
      type: "additional",
      devanagari: "तरुणौ रूपसम्पन्नौ सुकुमारौ महाबलौ ।\nपुण्डरीकविशालाक्षौ चीरकृष्णाजिनाम्बरौ ॥",
      transliteration: "taruṇau rūpasampannau sukumārau mahābalau |\npuṇḍarīkaviśālākṣau cīrakṛṣṇājināmbarau ||",
      translation: "The two young princes, endowed with beauty, tender yet mighty, with large lotus-like eyes, wearing bark garments and black deerskin."
    },
    {
      num: 18,
      type: "additional",
      devanagari: "फलमूलाशिनौ दान्तौ तापसौ ब्रह्मचारिणौ ।\nपुत्रौ दशरथस्यैतौ भ्रातरौ रामलक्ष्मणौ ॥",
      transliteration: "phalamūlāśinau dāntau tāpasau brahmacāriṇau |\nputrau daśarathasyaitau bhrātarau rāmalakṣmaṇau ||",
      translation: "Living on fruits and roots, self-controlled, ascetics and celibates — these two sons of Dasharatha, the brothers Rama and Lakshmana."
    },
    {
      num: 19,
      type: "additional",
      devanagari: "शरण्यौ सर्वसत्त्वानां श्रेष्ठौ सर्वधनुष्मताम् ।\nरक्षःकुलनिहन्तारौ त्रायेतां नो रघूत्तमौ ॥",
      transliteration: "śaraṇyau sarvasattvānāṁ śrēṣṭhau sarvadhanuṣmatām |\nrakṣaḥkulanihantārau trāyētāṁ nō raghūttamau ||",
      translation: "The refuge of all beings, the greatest among all archers, the destroyers of the demon race — may these best of the Raghus protect us."
    },
    {
      num: 20,
      type: "additional",
      devanagari: "आत्तसज्जधनुषाविषुस्पृशा-\nवक्षयाशुगनिषङ्गसङ्गिनौ ।\nरक्षणाय मम रामलक्ष्मणा-\nवग्रतः पथि सदैव गच्छताम् ॥",
      transliteration: "āttasajjadhanuṣāviṣuspṛśā-\nvakṣayāśuganiṣaṅgasaṅginau |\nrakṣaṇāya mama rāmalakṣmaṇā-\nvagrataḥ pathi sadaiva gacchatām ||",
      translation: "With bows strung and ready, hands touching arrows, with inexhaustible quivers — may Rama and Lakshmana always walk ahead of me on my path for my protection."
    },
    {
      num: 21,
      type: "additional",
      devanagari: "सन्नद्धः कवची खड्गी चापबाणधरो युवा ।\nगच्छन्मनोरथोऽस्माकं रामः पातु सलक्ष्मणः ॥",
      transliteration: "sannadhaḥ kavacī khaḍgī cāpabāṇadharō yuvā |\ngacchanmanōrathō'smākaṁ rāmaḥ pātu salakṣmaṇaḥ ||",
      translation: "Fully armed, wearing armour, bearing sword, bow, and arrows — the youthful Rama, the fulfiller of our desires, along with Lakshmana, may He protect us."
    },
    {
      num: 22,
      type: "additional",
      devanagari: "रामो दाशरथिः शूरो लक्ष्मणानुचरो बली ।\nकाकुत्स्थः पुरुषः पूर्णः कौसल्येयो रघूत्तमः ॥",
      transliteration: "rāmō dāśarathiḥ śūrō lakṣmaṇānucarō balī |\nkākutsthaḥ puruṣaḥ pūrṇaḥ kausalyēyō raghūttamaḥ ||",
      translation: "Rama, the son of Dasharatha, the hero, accompanied by Lakshmana, the mighty one, descendant of Kakutstha, the perfect being, the son of Kausalya, the best of the Raghus."
    },
    {
      num: 23,
      type: "additional",
      devanagari: "वेदान्तवेद्यो यज्ञेशः पुराणपुरुषोत्तमः ।\nजानकीवल्लभः श्रीमानप्रमेयपराक्रमः ॥",
      transliteration: "vēdāntavēdyō yajñēśaḥ purāṇapuruṣōttamaḥ |\njānakīvallabhaḥ śrīmānapramēyaparākramaḥ ||",
      translation: "He who is known through Vedanta, the Lord of sacrifices, the supreme ancient being, the beloved of Janaki (Sita), the glorious one whose valour is immeasurable."
    },
    {
      num: 24,
      type: "additional",
      devanagari: "इत्येतानि जपेन्नित्यं मद्भक्तः श्रद्धयान्वितः ।\nअश्वमेधाधिकं पुण्यं सम्प्राप्नोति न संशयः ॥",
      transliteration: "ityētāni japēnnityaṁ madbhaktaḥ śraddhayānvitaḥ |\naśvamēdhādhikaṁ puṇyaṁ samprāpnōti na saṁśayaḥ ||",
      translation: "He who chants these (names) daily with devotion and faith attains merit greater than that of an Ashvamedha sacrifice — there is no doubt."
    },
    {
      num: 25,
      type: "additional",
      devanagari: "रामं दूर्वादलश्यामं पद्माक्षं पीतवाससम् ।\nस्तुवन्ति नामभिर्दिव्यैर्न ते संसारिणो नरः ॥",
      transliteration: "rāmaṁ dūrvādalaśyāmaṁ padmākṣaṁ pītavāsasam |\nstuvanti nāmabhirdivyairna tē saṁsāriṇō naraḥ ||",
      translation: "Those who praise Rama — who is dark as durva grass, lotus-eyed, clad in yellow garments — with divine names, they are no longer bound to the cycle of worldly existence."
    },
    {
      num: 26,
      type: "additional",
      devanagari: "रामं लक्ष्मणपूर्वजं रघुवरं सीतापतिं सुन्दरं\nकाकुत्स्थं करुणार्णवं गुणनिधिं विप्रप्रियं धार्मिकम् ।\nराजेन्द्रं सत्यसन्धं दशरथतनयं श्यामलं शान्तमूर्तिं\nवन्दे लोकाभिरामं रघुकुलतिलकं राघवं रावणारिम् ॥",
      transliteration: "rāmaṁ lakṣmaṇapūrvajaṁ raghuvaraṁ sītāpatiṁ sundaraṁ\nkākutsthaṁ karuṇārṇavaṁ guṇanidhiṁ viprapriyaṁ dhārmikam |\nrājēndraṁ satyasandhaṁ daśarathatanayaṁ śyāmalaṁ śāntamūrtiṁ\nvandē lōkābhirāmaṁ raghukulatilakaṁ rāghavaṁ rāvaṇārim ||",
      translation: "I bow to Rama — the elder brother of Lakshmana, the best of the Raghus, the Lord of Sita, the beautiful one, descendant of Kakutstha, ocean of compassion, treasure of virtues, dear to the learned, righteous, king of kings, true to his word, son of Dasharatha, dark-complexioned, embodiment of peace — the delight of the world, the jewel of the Raghu dynasty, Raghava, the enemy of Ravana."
    },
    {
      num: 27,
      type: "additional",
      devanagari: "रामाय रामभद्राय रामचन्द्राय वेधसे ।\nरघुनाथाय नाथाय सीतायाः पतये नमः ॥",
      transliteration: "rāmāya rāmabhadrāya rāmacandrāya vēdhasē |\nraghunāthāya nāthāya sītāyāḥ patayē namaḥ ||",
      translation: "Salutations to Rama, to Ramabhadra, to Ramachandra the creator, to the Lord of the Raghus, to the Lord, and to the husband of Sita."
    },
    {
      num: 28,
      type: "additional",
      devanagari: "श्रीराम राम रघुनन्दन राम राम\nश्रीराम राम भरताग्रज राम राम ।\nश्रीराम राम रणकर्कश राम राम\nश्रीराम राम शरणं भव राम राम ॥",
      transliteration: "śrīrāma rāma raghunandana rāma rāma\nśrīrāma rāma bharatāgraja rāma rāma |\nśrīrāma rāma raṇakarkaśa rāma rāma\nśrīrāma rāma śaraṇaṁ bhava rāma rāma ||",
      translation: "Sri Rama, Rama, O joy of Raghu's line, Rama, Rama! Sri Rama, Rama, elder brother of Bharata, Rama, Rama! Sri Rama, Rama, fierce in battle, Rama, Rama! Sri Rama, Rama, be my refuge, Rama, Rama!"
    },
    {
      num: 29,
      type: "additional",
      devanagari: "श्रीरामचन्द्रचरणौ मनसा स्मरामि\nश्रीरामचन्द्रचरणौ वचसा गृणामि ।\nश्रीरामचन्द्रचरणौ शिरसा नमामि\nश्रीरामचन्द्रचरणौ शरणं प्रपद्ये ॥",
      transliteration: "śrīrāmacandracaraṇau manasā smarāmi\nśrīrāmacandracaraṇau vacasā gṛṇāmi |\nśrīrāmacandracaraṇau śirasā namāmi\nśrīrāmacandracaraṇau śaraṇaṁ prapadyē ||",
      translation: "I remember the feet of Sri Ramachandra with my mind. I praise the feet of Sri Ramachandra with my words. I bow to the feet of Sri Ramachandra with my head. I take refuge at the feet of Sri Ramachandra."
    },
    {
      num: 30,
      type: "additional",
      devanagari: "माता रामो मत्पिता रामचन्द्रः\nस्वामी रामो मत्सखा रामचन्द्रः ।\nसर्वस्वं मे रामचन्द्रो दयालुः\nनान्यं जाने नैव जाने न जाने ॥",
      transliteration: "mātā rāmō matpitā rāmacandraḥ\nsvāmī rāmō matsakha rāmacandraḥ |\nsarvasvaṁ mē rāmacandrō dayāluḥ\nnānyaṁ jānē naiva jānē na jānē ||",
      translation: "My mother is Rama, my father is Ramachandra. My master is Rama, my friend is Ramachandra. My everything is the compassionate Ramachandra. I know no other, I know no other, I know no other."
    },
    {
      num: 31,
      type: "additional",
      devanagari: "दक्षिणे लक्ष्मणो यस्य वामे च जनकात्मजा ।\nपुरतो मारुतिर्यस्य तं वन्दे रघुनन्दनम् ॥",
      transliteration: "dakṣiṇē lakṣmaṇō yasya vāmē ca janakātmajā |\npuratō mārutiryasya taṁ vandē raghunandanam ||",
      translation: "I bow to the scion of Raghu, who has Lakshmana on his right, the daughter of Janaka (Sita) on his left, and Maruti (Hanuman) before him."
    },
    {
      num: 32,
      type: "additional",
      devanagari: "लोकाभिरामं रणरङ्गधीरं\nराजीवनेत्रं रघुवंशनाथम् ।\nकारुण्यरूपं करुणाकरं तं\nश्रीरामचन्द्रं शरणं प्रपद्ये ॥",
      transliteration: "lōkābhirāmaṁ raṇaraṅgadhīraṁ\nrājīvanētraṁ raghuvaṁśanātham |\nkāruṇyarūpaṁ karuṇākaraṁ taṁ\nśrīrāmacandraṁ śaraṇaṁ prapadyē ||",
      translation: "I take refuge in Sri Ramachandra — who delights the world, who is steadfast on the battlefield, whose eyes are like lotuses, who is the Lord of the Raghu dynasty, who is the embodiment of compassion and the ocean of mercy."
    },
    {
      num: 33,
      type: "additional",
      devanagari: "मनोजवं मारुततुल्यवेगं\nजितेन्द्रियं बुद्धिमतां वरिष्ठम् ।\nवातात्मजं वानरयूथमुख्यं\nश्रीरामदूतं शरणं प्रपद्ये ॥",
      transliteration: "manōjavaṁ mārutatulyavēgaṁ\njitēndriyaṁ buddhimatāṁ variṣṭham |\nvātātmajaṁ vānarayūthamukhyaṁ\nśrīrāmadūtaṁ śaraṇaṁ prapadyē ||",
      translation: "I take refuge in the messenger of Sri Rama — who is swift as the mind, fast as the wind, who has conquered the senses, the foremost among the wise, the son of the Wind God, and the chief of the Vanara army."
    },
    {
      num: 34,
      type: "additional",
      devanagari: "कूजन्तं रामरामेति मधुरं मधुराक्षरम् ।\nआरुह्य कविताशाखां वन्दे वाल्मीकिकोकिलम् ॥",
      transliteration: "kūjantaṁ rāmarāmēti madhuraṁ madhurākṣaram |\nāruhya kavitāśākhāṁ vandē vālmīkikōkilam ||",
      translation: "I salute the cuckoo-like Valmiki, who sits upon the branch of poetry and sweetly sings the melodious syllables 'Rama, Rama'."
    },
    {
      num: 35,
      type: "additional",
      devanagari: "आपदामपहर्तारं दातारं सर्वसम्पदाम् ।\nलोकाभिरामं श्रीरामं भूयो भूयो नमाम्यहम् ॥",
      transliteration: "āpadāmapahartāraṁ dātāraṁ sarvasampadām |\nlōkābhirāmaṁ śrīrāmaṁ bhūyō bhūyō namāmyaham ||",
      translation: "I bow again and again to Sri Rama, who removes all calamities, who bestows all prosperity, and who is the delight of the entire world."
    },
    {
      num: 36,
      type: "additional",
      devanagari: "भर्जनं भवबीजानामर्जनं सुखसम्पदाम् ।\nतर्जनं यमदूतानां रामरामेति गर्जनम् ॥",
      transliteration: "bharjanaṁ bhavabījānāmarjanaṁ sukhasampadām |\ntarjanaṁ yamadūtānāṁ rāmarāmēti garjanam ||",
      translation: "The roaring of 'Rama, Rama' is the scorching of the seeds of worldly existence, the attainment of happiness and prosperity, and the threatening of Yama's messengers."
    },
    {
      num: 37,
      type: "additional",
      devanagari: "रामो राजमणिः सदा विजयते रामं रमेशं भजे\nरामेणाभिहता निशाचरचमू रामाय तस्मै नमः ।\nरामान्नास्ति परायणं परतरं रामस्य दासोस्म्यहं\nरामे चित्तलयः सदा भवतु मे भो राम मामुद्धर ॥",
      transliteration: "rāmō rājamaṇiḥ sadā vijayatē rāmaṁ ramēśaṁ bhajē\nrāmēṇābhihatā niśācaracamū rāmāya tasmai namaḥ |\nrāmānnāsti parāyaṇaṁ parataraṁ rāmasya dāsōsmyahaṁ\nrāmē cittalayaḥ sadā bhavatu mē bhō rāma māmuddhara ||",
      translation: "Rama, the jewel among kings, is ever victorious. I worship Rama, the Lord of Lakshmi. The army of night-wanderers was destroyed by Rama — salutations to that Rama. There is no refuge higher than Rama. I am the servant of Rama. May my mind always be absorbed in Rama. O Rama, uplift me!"
    },
    {
      num: 38,
      type: "additional",
      devanagari: "श्रीराम राम रामेति रमे रामे मनोरमे ।\nसहस्रनाम तत्तुल्यं रामनाम वरानने ॥",
      transliteration: "śrīrāma rāma rāmēti ramē rāmē manōramē |\nsahasranāma tattulyaṁ rāmanāma varānanē ||",
      translation: "By chanting 'Sri Rama, Rama, Rama,' I delight in Rama who is pleasing to the mind. O beautiful-faced one (Parvati), the name of Rama is equal to the chanting of the thousand names (of Vishnu)."
    }
  ]
};
