// Aditya Hridayam - Complete Text
// =================================
// Source: Valmiki Ramayana, Yuddha Kanda, Sarga 107
// Taught by: Sage Agastya to Lord Rama
// Deity: Lord Surya (Aditya)
// Occasion: Before the final battle with Ravana

const STOTRAM_DATA = {
  title: "Aditya Hridayam",
  titleSanskrit: "आदित्यहृदयम्",
  subtitle: "The Heart of the Sun God",
  composer: "Sage Agastya (from Valmiki Ramayana)",
  deity: "Lord Surya (Aditya)",
  source: "Yuddha Kanda, Sarga 107",

  verses: [
    {
      num: 1,
      type: "intro",
      devanagari: "ततो युद्धपरिश्रान्तं समरे चिन्तया स्थितम् ।\nरावणं चाग्रतो दृष्ट्वा युद्धाय समुपस्थितम् ॥",
      transliteration: "tatō yuddhaparishrāntaṁ samarē cintayā sthitam |\nrāvaṇaṁ cāgratō dṛṣṭvā yuddhāya samupasthitam ||",
      translation: "Then, seeing Rama standing exhausted and worried on the battlefield, with Ravana arrayed before him ready for combat,"
    },
    {
      num: 2,
      type: "intro",
      devanagari: "दैवतैश्च समागम्य द्रष्टुमभ्यागतो रणम् ।\nउपागम्याब्रवीद्राममगस्त्यो भगवान् ऋषिः ॥",
      transliteration: "daivataiśca samāgamya draṣṭumabhyāgatō raṇam |\nupāgamyābravīdrāmamagastyō bhagavān ṛṣiḥ ||",
      translation: "Sage Agastya, the blessed seer, who had come along with the Devas to witness the battle, approached Rama and spoke thus:"
    },
    {
      num: 3,
      type: "intro",
      devanagari: "राम राम महाबाहो शृणु गुह्यं सनातनम् ।\nयेन सर्वानरीन् वत्स समरे विजयिष्यसि ॥",
      transliteration: "rāma rāma mahābāhō śṛṇu guhyaṁ sanātanam |\nyēna sarvānarīn vatsa samarē vijayiṣyasi ||",
      translation: "O Rama, mighty-armed Rama! Listen to this eternal secret, my child, by which you shall conquer all your enemies in battle."
    },
    {
      num: 4,
      type: "praise",
      devanagari: "आदित्यहृदयं पुण्यं सर्वशत्रुविनाशनम् ।\nजयावहं जपेन्नित्यमक्षय्यं परमं शिवम् ॥",
      transliteration: "ādityahṛdayaṁ puṇyaṁ sarvaśatruvināśanam |\njayāvahaṁ japēnnityamakṣayyaṁ paramaṁ śivam ||",
      translation: "This is the holy Aditya Hridayam, the destroyer of all enemies, the bestower of victory. Chant it always — it is imperishable, supremely auspicious."
    },
    {
      num: 5,
      type: "praise",
      devanagari: "सर्वमङ्गलमाङ्गल्यं सर्वपापप्रणाशनम् ।\nचिन्ताशोकप्रशमनमायुर्वर्धनमुत्तमम् ॥",
      transliteration: "sarvamaṅgalamāṅgalyaṁ sarvapāpapraṇāśanam |\ncintāśōkapraśamanamāyurvardhanamuttamam ||",
      translation: "It is the most auspicious of all auspicious things, the destroyer of all sins, the remover of all worries and sorrows, and the supreme bestower of long life."
    },
    {
      num: 6,
      type: "praise",
      devanagari: "रश्मिमन्तं समुद्यन्तं देवासुरनमस्कृतम् ।\nपूजयस्व विवस्वन्तं भास्करं भुवनेश्वरम् ॥",
      transliteration: "raśmimantaṁ samudyantaṁ dēvāsuranamaskṛtam |\npūjayasva vivasvantaṁ bhāskaraṁ bhuvanēśvaram ||",
      translation: "Worship the radiant Sun who is rising, who is revered by both Devas and Asuras — Vivasvat, the maker of light, the lord of all worlds."
    },
    {
      num: 7,
      type: "praise",
      devanagari: "सर्वदेवात्मको ह्येष तेजस्वी रश्मिभावनः ।\nएष देवासुरगणान् लोकान् पाति गभस्तिभिः ॥",
      transliteration: "sarvadēvātmakō hyēṣa tējasvī raśmibhāvanaḥ |\nēṣa dēvāsuragaṇān lōkān pāti gabhastibhiḥ ||",
      translation: "He is the embodiment of all the Devas, full of splendour, the source of all rays. He protects all the worlds of Devas and Asuras with his radiance."
    },
    {
      num: 8,
      type: "praise",
      devanagari: "एष ब्रह्मा च विष्णुश्च शिवः स्कन्दः प्रजापतिः ।\nमहेन्द्रो धनदः कालो यमः सोमो ह्यपां पतिः ॥",
      transliteration: "ēṣa brahmā ca viṣṇuśca śivaḥ skandaḥ prajāpatiḥ |\nmahēndrō dhanadaḥ kālō yamaḥ sōmō hyapāṁ patiḥ ||",
      translation: "He is Brahma, Vishnu, Shiva, Skanda, Prajapati, Mahendra, Kubera, Kala (Time), Yama, Soma, and Varuna (the lord of waters)."
    },
    {
      num: 9,
      type: "praise",
      devanagari: "पितरो वसवः साध्या ह्यश्विनौ मरुतो मनुः ।\nवायुर्वह्निः प्रजाप्राण ऋतुकर्ता प्रभाकरः ॥",
      transliteration: "pitarō vasavaḥ sādhyā hyaśvinau marutō manuḥ |\nvāyurvahniḥ prajāprāṇa ṛtukartā prabhākaraḥ ||",
      translation: "He is the Pitris, the Vasus, the Sadhyas, the twin Ashvins, the Maruts, Manu, Vayu, Agni, the life-breath of all beings, the maker of seasons, and the source of light."
    },
    {
      num: 10,
      type: "praise",
      devanagari: "आदित्यः सविता सूर्यः खगः पूषा गभस्तिमान् ।\nसुवर्णसदृशो भानुर्हिरण्यरेता दिवाकरः ॥",
      transliteration: "ādityaḥ savitā sūryaḥ khagaḥ pūṣā gabhastimān |\nsuvarṇasadṛśō bhānurhiraṇyarētā divākaraḥ ||",
      translation: "He is Aditya, Savita, Surya, Khaga, Pusha, Gabhastiman, Suvarnasadrisha (golden-hued), Bhanu, Hiranyareta (of golden seed), and Divakara (maker of the day)."
    },
    {
      num: 11,
      type: "praise",
      devanagari: "हरिदश्वः सहस्रार्चिः सप्तसप्तिर्मरीचिमान् ।\nतिमिरोन्मथनः शम्भुस्त्वष्टा मार्ताण्ड अंशुमान् ॥",
      transliteration: "haridaśvaḥ sahasrārciḥ saptasaptirmarīcimān |\ntimirōnmathanaḥ śambhustvāṣṭā mārtāṇḍa aṁśumān ||",
      translation: "He whose horses are green, who has a thousand rays, who has seven horses, who is full of radiance, the dispeller of darkness, the source of happiness, Tvashta, Martanda, and Amshuman."
    },
    {
      num: 12,
      type: "praise",
      devanagari: "हिरण्यगर्भः शिशिरस्तपनो भास्करो रविः ।\nअग्निगर्भोऽदितेः पुत्रः शङ्खः शिशिरनाशनः ॥",
      transliteration: "hiraṇyagarbhaḥ śiśirastapanō bhāskarō raviḥ |\nagnigarbhō'ditēḥ putraḥ śaṅkhaḥ śiśiranāśanaḥ ||",
      translation: "He is Hiranyagarbha (the golden womb), Shishira (cool), Tapana (scorching), Bhaskara (light-maker), Ravi, Agnigarbha (fire-wombed), son of Aditi, Shankha, and the destroyer of cold and darkness."
    },
    {
      num: 13,
      type: "praise",
      devanagari: "व्योमनाथस्तमोभेदी ऋग्यजुःसामपारगः ।\nघनवृष्टिरपां मित्रो विन्ध्यवीथीप्लवङ्गमः ॥",
      transliteration: "vyōmanāthastamōbhēdī ṛgyajuḥsāmapāragaḥ |\nghanavṛṣṭirapāṁ mitrō vindhyavīthīplavaṅgamaḥ ||",
      translation: "He is the lord of the sky, the destroyer of darkness, the master of the Rig, Yajur, and Sama Vedas, the cause of heavy rain, the friend of the waters, and he who traverses the Vindhya path swiftly."
    },
    {
      num: 14,
      type: "praise",
      devanagari: "आतपी मण्डली मृत्युः पिङ्गलः सर्वतापनः ।\nकविर्विश्वो महातेजाः रक्तः सर्वभवोद्भवः ॥",
      transliteration: "ātapī maṇḍalī mṛtyuḥ piṅgalaḥ sarvatāpanaḥ |\nkavirviśvō mahātējāḥ raktaḥ sarvabhavōdbhavaḥ ||",
      translation: "He radiates heat, is orb-shaped, is death (to enemies), tawny-coloured, heats everything, is the all-seeing poet, the universal one, of great splendour, the red one, and the source of all existence."
    },
    {
      num: 15,
      type: "praise",
      devanagari: "नक्षत्रग्रहताराणामधिपो विश्वभावनः ।\nतेजसामपि तेजस्वी द्वादशात्मन् नमोऽस्तु ते ॥",
      transliteration: "nakṣatragrahatārāṇāmadhipō viśvabhāvanaḥ |\ntējasāmapi tējasvī dvādaśātman namō'stu tē ||",
      translation: "He is the lord of all stars, planets, and constellations, the nourisher of the universe, the most radiant among the radiant. O thou of twelve forms — salutations to thee!"
    },
    {
      num: 16,
      type: "prayer",
      devanagari: "नमः पूर्वाय गिरये पश्चिमायाद्रये नमः ।\nज्योतिर्गणानां पतये दिनाधिपतये नमः ॥",
      transliteration: "namaḥ pūrvāya girayē paścimāyādrayē namaḥ |\njyōtirgaṇānāṁ patayē dinādhipatayē namaḥ ||",
      translation: "Salutations to the eastern mountain (of sunrise) and salutations to the western mountain (of sunset). Salutations to the lord of all luminaries, salutations to the lord of the day."
    },
    {
      num: 17,
      type: "prayer",
      devanagari: "जयाय जयभद्राय हर्यश्वाय नमो नमः ।\nनमो नमः सहस्रांशो आदित्याय नमो नमः ॥",
      transliteration: "jayāya jayabhadrāya haryaśvāya namō namaḥ |\nnamō namaḥ sahasrāṁśō ādityāya namō namaḥ ||",
      translation: "Salutations to the one who brings victory, to the one who bestows auspicious victory, to the one with green horses. Repeated salutations to the thousand-rayed one, to Aditya!"
    },
    {
      num: 18,
      type: "prayer",
      devanagari: "नम उग्राय वीराय सारङ्गाय नमो नमः ।\nनमः पद्मप्रबोधाय मार्ताण्डाय नमो नमः ॥",
      transliteration: "nama ugrāya vīrāya sāraṅgāya namō namaḥ |\nnamaḥ padmaprabōdhāya mārtāṇḍāya namō namaḥ ||",
      translation: "Salutations to the fierce one, the valiant one, the swift one. Salutations to the one who causes lotuses to bloom, to Martanda!"
    },
    {
      num: 19,
      type: "prayer",
      devanagari: "ब्रह्मेशानाच्युतेशाय सूर्यायादित्यवर्चसे ।\nभास्वते सर्वभक्षाय रौद्राय वपुषे नमः ॥",
      transliteration: "brahmēśānācyutēśāya sūryāyādityavarcase |\nbhāsvatē sarvabhakṣāya raudrāya vapuṣē namaḥ ||",
      translation: "Salutations to the lord of Brahma, Ishana, and Achyuta; to Surya of Aditya's radiance; to the resplendent one, the all-devouring one, to the one of terrifying form."
    },
    {
      num: 20,
      type: "prayer",
      devanagari: "तमोघ्नाय हिमघ्नाय शत्रुघ्नायामितात्मने ।\nकृतघ्नघ्नाय देवाय ज्योतिषां पतये नमः ॥",
      transliteration: "tamōghnāya himaghnāya śatrughnāyāmitātmanē |\nkṛtaghnaghāya dēvāya jyōtiṣāṁ patayē namaḥ ||",
      translation: "Salutations to the destroyer of darkness, the destroyer of cold, the destroyer of enemies, the one of immeasurable form, the destroyer of the ungrateful, the lord of all luminous bodies."
    },
    {
      num: 21,
      type: "prayer",
      devanagari: "तप्तचामीकराभाय वह्नये विश्वकर्मणे ।\nनमस्तमोऽभिनिघ्नाय रुचये लोकसाक्षिणे ॥",
      transliteration: "taptacāmīkarābhāya vahnayē viśvakarmaṇē |\nnamastamō'bhinighnāya rucayē lōkasākṣiṇē ||",
      translation: "Salutations to the one who shines like molten gold, to fire, to the architect of the universe, to the one who annihilates darkness, to the effulgent one, the witness of all the worlds."
    },
    {
      num: 22,
      type: "prayer",
      devanagari: "नाशयत्येष वै भूतं तदेव सृजति प्रभुः ।\nपायत्येष तपत्येष वर्षत्येष गभस्तिभिः ॥",
      transliteration: "nāśayatyēṣa vai bhūtaṁ tadēva sṛjati prabhuḥ |\npāyatyēṣa tapatyēṣa varṣatyēṣa gabhastibhiḥ ||",
      translation: "This lord destroys all beings and creates them again. He nurtures, he heats, and he sends down rain through his rays."
    },
    {
      num: 23,
      type: "prayer",
      devanagari: "एष सुप्तेषु जागर्ति भूतेषु परिनिष्ठितः ।\nएष एवाग्निहोत्रं च फलं चैवाग्निहोत्रिणाम् ॥",
      transliteration: "ēṣa suptēṣu jāgarti bhūtēṣu pariniṣṭhitaḥ |\nēṣa ēvāgnihōtraṁ ca phalaṁ caivāgnihōtriṇām ||",
      translation: "He remains awake when all beings are asleep, being established in all living beings. He is the Agnihotra fire-ritual itself, and he is the fruit obtained by those who perform the Agnihotra."
    },
    {
      num: 24,
      type: "prayer",
      devanagari: "वेदाश्च क्रतवश्चैव क्रतूनां फलमेव च ।\nयानि कृत्यानि लोकेषु सर्व एष रविः प्रभुः ॥",
      transliteration: "vēdāśca kratavaścaiva kratūnāṁ phalamēva ca |\nyāni kṛtyāni lōkēṣu sarva ēṣa raviḥ prabhuḥ ||",
      translation: "He is the Vedas, the sacrifices, and the fruits of all sacrifices. Whatever actions are performed in all the worlds — the lord Ravi (Sun) is the source and master of them all."
    },
    {
      num: 25,
      type: "phala",
      devanagari: "एनमापत्सु कृच्छ्रेषु कान्तारेषु भयेषु च ।\nकीर्तयन् पुरुषः कश्चिन्नावसीदति राघव ॥",
      transliteration: "ēnamāpatsu kṛcchrēṣu kāntārēṣu bhayēṣu ca |\nkīrtayan puruṣaḥ kaścinnāvasīdati rāghava ||",
      translation: "O Raghava! He who chants (this hymn) in times of distress, difficulty, in the wilderness, or in situations of fear — that person shall never be overcome by sorrow."
    },
    {
      num: 26,
      type: "phala",
      devanagari: "पूजयस्वैनमेकाग्रो देवदेवं जगत्पतिम् ।\nएतत् त्रिगुणितं जप्त्वा युद्धेषु विजयिष्यसि ॥",
      transliteration: "pūjayasvainamēkāgrō dēvadēvaṁ jagatpatim |\nētat triguṇitaṁ japtvā yuddhēṣu vijayiṣyasi ||",
      translation: "Worship with single-minded devotion this God of gods, the lord of the universe. By chanting this thrice, you shall achieve victory in battle."
    },
    {
      num: 27,
      type: "phala",
      devanagari: "अस्मिन् क्षणे महाबाहो रावणं त्वं वधिष्यसि ।\nएवमुक्त्वा तदागस्त्यो जगाम च यथागतम् ॥",
      transliteration: "asmin kṣaṇē mahābāhō rāvaṇaṁ tvaṁ vadhiṣyasi |\nēvamuktvā tadāgastyō jagāma ca yathāgatam ||",
      translation: "At this very moment, O mighty-armed one, you shall slay Ravana! Having spoken thus, Sage Agastya departed the way he had come."
    },
    {
      num: 28,
      type: "phala",
      devanagari: "एतच्छ्रुत्वा महातेजाः नष्टशोकोऽभवत्तदा ।\nधारयामास सुप्रीतो राघवः प्रयतात्मवान् ॥",
      transliteration: "ētacchrutvā mahātējāḥ naṣṭaśōkō'bhavattadā |\ndhārayāmāsa suprītō rāghavaḥ prayatātmavān ||",
      translation: "Hearing this, the mighty Raghava was freed of all sorrow. With a purified mind and great delight, he received this teaching into his heart."
    },
    {
      num: 29,
      type: "phala",
      devanagari: "आदित्यं प्रेक्ष्य जप्त्वा तु परं हर्षमवाप्तवान् ।\nत्रिराचम्य शुचिर्भूत्वा धनुरादाय वीर्यवान् ॥",
      transliteration: "ādityaṁ prēkṣya japtvā tu paraṁ harṣamavāptavān |\ntrirācamya śucirbhūtvā dhanurādāya vīryavān ||",
      translation: "Gazing at the Sun and chanting (this hymn), he was filled with supreme joy. Sipping water thrice for purification, the valiant one took up his bow."
    },
    {
      num: 30,
      type: "phala",
      devanagari: "रावणं प्रेक्ष्य हृष्टात्मा युद्धाय समुपागमत् ।\nसर्वयत्नेन महता वधे तस्य धृतोऽभवत् ॥",
      transliteration: "rāvaṇaṁ prēkṣya hṛṣṭātmā yuddhāya samupāgamat |\nsarvayatnēna mahatā vadhē tasya dhṛtō'bhavat ||",
      translation: "Looking at Ravana with a joyful heart, he advanced for battle. With supreme effort and great resolve, he was determined to slay him."
    },
    {
      num: 31,
      type: "phala",
      devanagari: "अथ रविरवदन्निरीक्ष्य रामं मुदितमनाः परमं प्रहृष्यमाणः ।\nनिशिचरपतिसंक्षयं विदित्वा सुरगणमध्यगतो वचस्त्वरेति ॥",
      transliteration: "atha raviravadannirīkṣya rāmaṁ muditamanāḥ paramaṁ prahṛṣyamāṇaḥ |\nniśicarapatisaṁkṣayaṁ viditvā suragaṇamadhyagatō vacastvarēti ||",
      translation: "Then the Sun God, looking at Rama, with a joyful mind and supremely delighted, knowing that the destruction of the lord of the demons was near, spoke from amidst the Devas: 'Make haste!'"
    }
  ]
};
