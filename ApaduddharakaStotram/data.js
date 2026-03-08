// Sri Rama Apaduddharaka Stotram - Two Versions Compared
// ======================================================
// Version 1: From Stotranidhi (the version with "rāmāyāpannivāriṇē" refrain)
// Version 2: From DailySlogams (the version with protection/kavaca verses)
// Sources: stotranidhi.com, dailyslogams.blogspot.com, sanskritdocuments.org

const STOTRAM_DATA = {

  // ===== VERSION 1: Stotranidhi Version =====
  // Each verse ends with the refrain "rāmāyāpannivāriṇē"
  version1: {
    title: "Sri Rama Apaduddharaka Stotram",
    titleSanskrit: "श्रीरामापदुद्धारकस्तोत्रम्",
    subtitle: "Version 1 — With the refrain 'Rāmāyāpannivāriṇē'",
    source: "Source: Stotranidhi / Sanskritdocuments.org",
    sourceUrl: "https://stotranidhi.com/en/shri-ram-apaduddharaka-stotram-in-english/",

    dhyanam: [
      {
        num: 0,
        type: "dhyanam",
        devanagari: "आपदामपहर्तारं दातारं सर्वसम्पदाम् ।\nलोकाभिरामं श्रीरामं भूयो भूयो नमाम्यहम् ॥",
        transliteration: "āpadāmapahartāraṁ dātāraṁ sarvasampadām |\nlōkābhirāmaṁ śrīrāmaṁ bhūyō bhūyō namāmyaham ||",
        translation: "I bow again and again to Sri Rama, who removes all calamities, who bestows all prosperity, and who is the delight of the entire world."
      }
    ],

    verses: [
      {
        num: 1,
        type: "verse",
        devanagari: "नमः कोदण्डहस्ताय सन्धीकृतशराय च ।\nखण्डिताखिलदैत्याय रामायापन्निवारिणे ॥",
        transliteration: "namaḥ kōdaṇḍahastāya sandhīkṛtaśarāya ca |\nkhaṇḍitākhiladaityāya rāmāyāpannivāriṇē ||",
        translation: "Salutations to the one who holds the Kodanda bow, who has arrows fitted to the string, who has destroyed all demons — to Rama, the remover of dangers."
      },
      {
        num: 2,
        type: "verse",
        devanagari: "आपन्नजनरक्षैकदीक्षायामिततेजसे ।\nनमोऽस्तु विष्णवे तुभ्यं रामायापन्निवारिणे ॥",
        transliteration: "āpannajanarakṣaikadīkṣāyāmitatējasē |\nnamō'stu viṣṇavē tubhyaṁ rāmāyāpannivāriṇē ||",
        translation: "Salutations to Vishnu of immeasurable radiance, who is solely dedicated to protecting those in distress — to Rama, the remover of dangers."
      },
      {
        num: 3,
        type: "verse",
        devanagari: "पदाम्भोजरजःस्पर्शपवित्रमुनियोषिते ।\nनमोऽस्तु सीतापतये रामायापन्निवारिणे ॥",
        transliteration: "padāmbhōjarajaḥsparśapavitramuniyōṣitē |\nnamō'stu sītāpatayē rāmāyāpannivāriṇē ||",
        translation: "Salutations to the Lord of Sita, the touch of dust from whose lotus feet purified the sage's wife (Ahalya) — to Rama, the remover of dangers."
      },
      {
        num: 4,
        type: "verse",
        devanagari: "दानवेन्द्रमहामत्तगजपञ्चास्यरूपिणे ।\nनमोऽस्तु रघुनाथाय रामायापन्निवारिणे ॥",
        transliteration: "dānavēndramahāmattagajapañcāsyarūpiṇē |\nnamō'stu raghunāthāya rāmāyāpannivāriṇē ||",
        translation: "Salutations to Raghunatha, who is like a lion to the great intoxicated elephant that is the king of demons — to Rama, the remover of dangers."
      },
      {
        num: 5,
        type: "verse",
        devanagari: "महिजाकुचसंलग्नकुङ्कुमारुणवक्षसे ।\nनमः कल्याणरूपाय रामायापन्निवारिणे ॥",
        transliteration: "mahijākucasaṁlagnakuṅkumāruṇavakṣasē |\nnamaḥ kalyāṇarūpāya rāmāyāpannivāriṇē ||",
        translation: "Salutations to the auspicious-formed one, whose chest is reddened with kumkum from the bosom of the Earth's daughter (Sita) — to Rama, the remover of dangers."
      },
      {
        num: 6,
        type: "verse",
        devanagari: "पद्मसम्भवभूतेशमुनिसंस्तुतकीर्तये ।\nनमो मार्ताण्डवंश्याय रामायापन्निवारिणे ॥",
        transliteration: "padmasambhavabhūtēśamunisaṁstutakīrtayē |\nnamō mārtāṇḍavaṁśyāya rāmāyāpannivāriṇē ||",
        translation: "Salutations to the scion of the Solar dynasty, whose glory is praised by Brahma, Shiva, and the sages — to Rama, the remover of dangers."
      },
      {
        num: 7,
        type: "verse",
        devanagari: "हरत्यार्तिं च लोकानां यो वा मधुनिषूदनः ।\nनमोऽस्तु हरये तुभ्यं रामायापन्निवारिणे ॥",
        transliteration: "haratyārtiṁ ca lōkānāṁ yō vā madhuniṣūdanaḥ |\nnamō'stu harayē tubhyaṁ rāmāyāpannivāriṇē ||",
        translation: "Salutations to Hari, the slayer of Madhu, who removes the suffering of all the worlds — to Rama, the remover of dangers."
      },
      {
        num: 8,
        type: "verse",
        devanagari: "तापकारणसंसारगजसिंहस्वरूपिणे ।\nनमो वेदान्तवेद्याय रामायापन्निवारिणे ॥",
        transliteration: "tāpakāraṇasaṁsāragajasiṁhasvarūpiṇē |\nnamō vēdāntavēdyāya rāmāyāpannivāriṇē ||",
        translation: "Salutations to the one knowable through Vedanta, who is like a lion to the elephant of worldly suffering — to Rama, the remover of dangers."
      },
      {
        num: 9,
        type: "verse",
        devanagari: "रङ्गत्तरङ्गजलधिगर्वहृच्छरधारिणे ।\nनमः प्रतापरूपाय रामायापन्निवारिणे ॥",
        transliteration: "raṅgattaraṅgajaladhigarvahṛccharadhāriṇē |\nnamaḥ pratāparūpāya rāmāyāpannivāriṇē ||",
        translation: "Salutations to the embodiment of valour, who wielded the arrow that humbled the pride of the surging ocean — to Rama, the remover of dangers."
      },
      {
        num: 10,
        type: "verse",
        devanagari: "दारासहितचन्द्रावतंसध्यातस्वमूर्तये ।\nनमः सत्यस्वरूपाय रामायापन्निवारिणे ॥",
        transliteration: "dārāsahitacandrāvataṁsadhyātasvamūrtayē |\nnamaḥ satyasvarūpāya rāmāyāpannivāriṇē ||",
        translation: "Salutations to the embodiment of Truth, whose divine form — adorned with Sita and the crescent moon — is meditated upon — to Rama, the remover of dangers."
      }
    ],

    phalaShruti: [
      {
        num: 1,
        type: "phala",
        devanagari: "इमं स्तवं भगवतः पठेद्यः प्रीतमानसः ।\nप्रभाते वा प्रदोषे वा रामस्य परमात्मनः ॥",
        transliteration: "imaṁ stavaṁ bhagavataḥ paṭhēdyaḥ prītamānasaḥ |\nprabhātē vā pradōṣē vā rāmasya paramātmanaḥ ||",
        translation: "Whoever recites this hymn of the Supreme Lord Rama with a devoted heart, either at dawn or at dusk —"
      },
      {
        num: 2,
        type: "phala",
        devanagari: "स तु तीर्त्वा भवाम्भोधिमापदस्सकलानपि ।\nरामसायुज्यमाप्नोति देवदेवप्रसादतः ॥",
        transliteration: "sa tu tīrtvā bhavāmbhōdhimāpadassakalānapi |\nrāmasāyujyamāpnōti dēvadēvaprasādataḥ ||",
        translation: "— that person crosses the ocean of worldly existence and all calamities, and attains union with Rama by the grace of the God of Gods."
      },
      {
        num: 3,
        type: "phala",
        devanagari: "कारागृहादिबाधासु सम्प्राप्ते बहुसङ्कटे ।\nआपन्निवारकस्तोत्रं पठेद्यस्तु यथाविधिः ॥",
        transliteration: "kārāgṛhādibādhāsu samprāptē bahusaṅkaṭē |\nāpannivārakastōtraṁ paṭhēdyastu yathāvidhiḥ ||",
        translation: "When one is afflicted by the troubles of imprisonment and other great dangers, one should recite this Apaduddharaka Stotram as prescribed —"
      },
      {
        num: 4,
        type: "phala",
        devanagari: "संयोज्यानुष्टुभं मन्त्रमनुश्लोकं स्मरन्विभुम् ।\nसप्ताहात्सर्वबाधाभ्यो मुच्यते नात्र संशयः ॥",
        transliteration: "saṁyōjyānuṣṭubhaṁ mantramanuślōkaṁ smaranvibhum |\nsaptāhātsarvabādhābhyō mucyatē nātra saṁśayaḥ ||",
        translation: "— combining it with the Anushtubh mantra and remembering the Lord verse by verse, one is freed from all afflictions within seven days — there is no doubt about this."
      }
    ]
  },

  // ===== VERSION 2: DailySlogams Version =====
  // Includes protection/kavaca-style verses and Rama-Lakshmana guard verses
  version2: {
    title: "Sri Rama Apaduddharaka Stotram",
    titleSanskrit: "श्रीरामापदुद्धारकस्तोत्रम्",
    subtitle: "Version 2 — With Raksha (Protection) Verses",
    source: "Source: DailySlogams / Traditional recitation",
    sourceUrl: "https://dailyslogams.blogspot.com/2015/02/sri-rama-apaduddharaka-stotram.html",

    dhyanam: [
      {
        num: 0,
        type: "dhyanam",
        devanagari: "आपदामपहर्तारं दातारं सर्वसम्पदाम् ।\nलोकाभिरामं श्रीरामं भूयो भूयो नमाम्यहम् ॥",
        transliteration: "āpadāmapahartāraṁ dātāraṁ sarvasampadām |\nlōkābhirāmaṁ śrīrāmaṁ bhūyō bhūyō namāmyaham ||",
        translation: "I bow again and again to Sri Rama, who removes all calamities, who bestows all prosperity, and who is the delight of the entire world."
      }
    ],

    verses: [
      {
        num: 1,
        type: "verse",
        devanagari: "आर्तानामार्तिहन्तारं भीतानां भीतिनाशनम् ।\nद्विषतां कालदण्डं तं रामचन्द्रं नमाम्यहम् ॥",
        transliteration: "ārtānāmārtihantāraṁ bhītānāṁ bhītināśanam |\ndviṣatāṁ kāladaṇḍaṁ taṁ rāmacandraṁ namāmyaham ||",
        translation: "I salute Ramachandra, who destroys the suffering of the afflicted, who dispels the fear of the frightened, and who is the rod of death (Yama's staff) to enemies."
      },
      {
        num: 2,
        type: "verse",
        devanagari: "नमश्चक्रायुधायैव नमो भक्तजनप्रिय ।\nनमः कोदण्डहस्ताय नमस्ते रघुनन्दन ॥",
        transliteration: "namaścakrāyudhāyaiva namō bhaktajanapriya |\nnamaḥ kōdaṇḍahastāya namastē raghunandana ||",
        translation: "Salutations to the wielder of the divine discus, salutations to the one who is dear to devotees. Salutations to the holder of the Kodanda bow — salutations to you, O scion of Raghu."
      },
      {
        num: 3,
        type: "verse",
        devanagari: "रामाय रामभद्राय रामचन्द्राय वेधसे ।\nरघुनाथाय नाथाय सीतायाः पतये नमः ॥",
        transliteration: "rāmāya rāmabhadrāya rāmacandrāya vēdhasē |\nraghunāthāya nāthāya sītāyāḥ patayē namaḥ ||",
        translation: "Salutations to Rama, to the auspicious Rama (Ramabhadra), to Ramachandra the creator, to the Lord of the Raghus, to the Lord, and to the husband of Sita."
      },
      {
        num: 4,
        type: "verse",
        devanagari: "अग्रतः पृष्ठतश्चैव पार्श्वतश्च महाबलौ ।\nआकर्णपूर्णधन्वानौ रक्षेतां रामलक्ष्मणौ ॥",
        transliteration: "agrataḥ pṛṣṭhataścaiva pārśvataśca mahābalau |\nākarṇapūrṇadhanvānau rakṣētāṁ rāmalakṣmaṇau ||",
        translation: "May the mighty Rama and Lakshmana, with their bows drawn to the ear, protect me from the front, from behind, and from both sides."
      },
      {
        num: 5,
        type: "verse",
        devanagari: "सन्नद्धः कवची खड्गी चापबाणधरो युवा ।\nगच्छन् ममाग्रतो नित्यं रामः पातु सलक्ष्मणः ॥",
        transliteration: "sannadhaḥ kavacī khaḍgī cāpabāṇadharō yuvā |\ngacchan mamāgratō nityaṁ rāmaḥ pātu salakṣmaṇaḥ ||",
        translation: "May the youthful Rama — clad in armour, bearing sword, bow, and arrows — along with Lakshmana, always walk before me and protect me."
      },
      {
        num: 6,
        type: "verse",
        devanagari: "दक्षिणे लक्ष्मणो यस्य वामे च जनकात्मजा ।\nपुरतो मारुतिर्यस्य तं वन्दे रघुनन्दनम् ॥",
        transliteration: "dakṣiṇē lakṣmaṇō yasya vāmē ca janakātmajā |\npuratō mārutiryasya taṁ vandē raghunandanam ||",
        translation: "I bow to the scion of Raghu, who has Lakshmana on his right, the daughter of Janaka (Sita) on his left, and Hanuman (son of Marut) before him."
      },
      {
        num: 7,
        type: "verse",
        devanagari: "लोकाभिरामं रणरङ्गधीरं\nराजीवनेत्रं रघुवंशनाथम् ।\nकारुण्यरूपं करुणाकरं तं\nश्रीरामचन्द्रं शरणं प्रपद्ये ॥",
        transliteration: "lōkābhirāmaṁ raṇaraṅgadhīraṁ\nrājīvanētraṁ raghuvaṁśanātham |\nkāruṇyarūpaṁ karuṇākaraṁ taṁ\nśrīrāmacandraṁ śaraṇaṁ prapadyē ||",
        translation: "I take refuge in Sri Ramachandra — who delights the world, who is steadfast on the battlefield, whose eyes are like lotuses, who is the Lord of the Raghu dynasty, who is the embodiment of compassion and the ocean of mercy."
      },
      {
        num: 8,
        type: "verse",
        devanagari: "मनोजवं मारुततुल्यवेगं\nजितेन्द्रियं बुद्धिमतां वरिष्ठम् ।\nवातात्मजं वानरयूथमुख्यं\nश्रीरामदूतं शरणं प्रपद्ये ॥",
        transliteration: "manōjavaṁ mārutatulyavēgaṁ\njitēndriyaṁ buddhimatāṁ variṣṭham |\nvātātmajaṁ vānarayūthamukhyaṁ\nśrīrāmadūtaṁ śaraṇaṁ prapadyē ||",
        translation: "I take refuge in the messenger of Sri Rama — who is swift as the mind, fast as the wind, who has conquered the senses, who is the foremost among the wise — the son of the Wind God and the chief of the Vanara army."
      },
      {
        num: 9,
        type: "verse",
        devanagari: "कूजन्तं रामरामेति मधुरं मधुराक्षरम् ।\nआरुह्य कविताशाखां वन्दे वाल्मीकिकोकिलम् ॥",
        transliteration: "kūjantaṁ rāmarāmēti madhuraṁ madhurākṣaram |\nāruhya kavitāśākhāṁ vandē vālmīkikōkilam ||",
        translation: "I salute the cuckoo-like Valmiki, who sits upon the branch of poetry and sweetly sings the melodious syllables 'Rama, Rama'."
      },
      {
        num: 10,
        type: "verse",
        devanagari: "आपदामपहर्तारं दातारं सर्वसम्पदाम् ।\nलोकाभिरामं श्रीरामं भूयो भूयो नमाम्यहम् ॥",
        transliteration: "āpadāmapahartāraṁ dātāraṁ sarvasampadām |\nlōkābhirāmaṁ śrīrāmaṁ bhūyō bhūyō namāmyaham ||",
        translation: "I bow again and again to Sri Rama, who removes all calamities, who bestows all prosperity, and who is the delight of the entire world."
      }
    ],

    phalaShruti: [
      {
        num: 1,
        type: "phala",
        devanagari: "कारागृहादिबाधासु सम्प्राप्ते बहुसङ्कटे ।\nआपन्निवारकस्तोत्रं पठेद्यस्तु यथाविधिः ॥",
        transliteration: "kārāgṛhādibādhāsu samprāptē bahusaṅkaṭē |\nāpannivārakastōtraṁ paṭhēdyastu yathāvidhiḥ ||",
        translation: "When afflicted by the troubles of imprisonment and great dangers, one should recite this Apaduddharaka Stotram as prescribed."
      },
      {
        num: 2,
        type: "phala",
        devanagari: "संयोज्यानुष्टुभं मन्त्रमनुश्लोकं स्मरन्विभुम् ।\nसप्ताहात्सर्वबाधाभ्यो मुच्यते नात्र संशयः ॥",
        transliteration: "saṁyōjyānuṣṭubhaṁ mantramanuślōkaṁ smaranvibhum |\nsaptāhātsarvabādhābhyō mucyatē nātra saṁśayaḥ ||",
        translation: "Combining it with the Anushtubh mantra and remembering the Lord verse by verse, one is freed from all afflictions within seven days — there is no doubt about this."
      }
    ]
  }
};
