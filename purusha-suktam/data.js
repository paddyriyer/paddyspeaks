// Purusha Suktam - Complete Text
// ================================
// Source: Rig Veda 10.90, Taittiriya Aranyaka 3.12, Vajasaneyi Samhita 31
// Rishi: Narayana
// Devata: Purusha (Supreme Being)
// Chandas: Anushtup & Trishtup

const STOTRAM_DATA = {
  title: "Purusha Suktam",
  titleSanskrit: "पुरुषसूक्तम्",
  subtitle: "The Hymn of the Cosmic Being",
  rishi: "Narayana",
  devata: "Purusha",
  source: "Rig Veda 10.90",

  verses: [
    {
      num: 1,
      type: "cosmic",
      devanagari: "ॐ सहस्रशीर्षा पुरुषः सहस्राक्षः सहस्रपात् ।\nस भूमिं विश्वतो वृत्वात्यतिष्ठद्दशाङ्गुलम् ॥",
      transliteration: "ōṁ sahasraśīrṣā puruṣaḥ sahasrākṣaḥ sahasrapāt |\nsa bhūmiṁ viśvatō vṛtvātyatiṣṭhaddaśāṅgulam ||",
      translation: "The Purusha (Supreme Being) has a thousand heads, a thousand eyes, and a thousand feet. He pervades the entire earth and extends beyond it by ten fingers' breadth."
    },
    {
      num: 2,
      type: "cosmic",
      devanagari: "पुरुष एवेदं सर्वं यद्भूतं यच्च भव्यम् ।\nउतामृतत्वस्येशानो यदन्नेनातिरोहति ॥",
      transliteration: "puruṣa ēvēdaṁ sarvaṁ yadbhūtaṁ yacca bhavyam |\nutāmṛtatvasyēśānō yadannēnātirōhati ||",
      translation: "This Purusha alone is all that was, all that is, and all that shall be. He is the lord of immortality, and He transcends all that grows by food."
    },
    {
      num: 3,
      type: "cosmic",
      devanagari: "एतावानस्य महिमातो ज्यायांश्च पूरुषः ।\nपादोऽस्य विश्वा भूतानि त्रिपादस्यामृतं दिवि ॥",
      transliteration: "ētāvānasya mahimātō jyāyāṁśca pūruṣaḥ |\npādō'sya viśvā bhūtāni tripādasyāmṛtaṁ divi ||",
      translation: "Such is His greatness, and the Purusha is even greater than this. All beings are but one-quarter of Him; three-quarters of Him are immortal in heaven."
    },
    {
      num: 4,
      type: "cosmic",
      devanagari: "त्रिपादूर्ध्व उदैत्पुरुषः पादोऽस्येहाभवत्पुनः ।\nततो विष्वङ्व्यक्रामत्साशनानशने अभि ॥",
      transliteration: "tripādūrdhva udaitpuruṣaḥ pādō'syēhābhavatpunaḥ |\ntatō viṣvaṅvyakrāmatsāśanānaśanē abhi ||",
      translation: "Three-quarters of the Purusha ascended above. One-quarter manifested here again and again. From this He spread in all directions — into the sentient and the insentient."
    },
    {
      num: 5,
      type: "cosmic",
      devanagari: "तस्माद्विराळजायत विराजो अधि पूरुषः ।\nस जातो अत्यरिच्यत पश्चाद्भूमिमथो पुरः ॥",
      transliteration: "tasmādvirāḷajāyata virājō adhi pūruṣaḥ |\nsa jātō atyaricyata paścādbhūmimathō puraḥ ||",
      translation: "From Him was born Viraj (the shining cosmos), and from Viraj again the Purusha. As soon as He was born, He exceeded the earth from behind and before."
    },
    {
      num: 6,
      type: "sacrifice",
      devanagari: "यत्पुरुषेण हविषा देवा यज्ञमतन्वत ।\nवसन्तो अस्यासीदाज्यं ग्रीष्म इध्मः शरद्धविः ॥",
      transliteration: "yatpuruṣēṇa haviṣā dēvā yajñamatanvata |\nvasantō asyāsīdājyaṁ grīṣma idhmaḥ śaradddhaviḥ ||",
      translation: "When the Devas performed the sacrifice using the Purusha as the offering, spring was the clarified butter, summer was the fuel, and autumn was the oblation."
    },
    {
      num: 7,
      type: "sacrifice",
      devanagari: "तं यज्ञं बर्हिषि प्रौक्षन्पुरुषं जातमग्रतः ।\nतेन देवा अयजन्त साध्या ऋषयश्च ये ॥",
      transliteration: "taṁ yajñaṁ barhiṣi praukṣanpuruṣaṁ jātamagrataḥ |\ntēna dēvā ayajanta sādhyā ṛṣayaśca yē ||",
      translation: "They consecrated upon the sacred grass the Purusha who was born in the beginning. Through Him the Devas, the Sadhyas, and the Rishis performed the sacrifice."
    },
    {
      num: 8,
      type: "sacrifice",
      devanagari: "तस्माद्यज्ञात्सर्वहुतः सम्भृतं पृषदाज्यम् ।\nपशून्ताँश्चक्रे वायव्यानारण्यान् ग्राम्याश्च ये ॥",
      transliteration: "tasmādyajñātsarvahutaḥ sambhṛtaṁ pṛṣadājyam |\npaśūntām̐ścakrē vāyavyānāraṇyān grāmyāśca yē ||",
      translation: "From that sacrifice in which everything was offered, the curdled butter was gathered. From it He created the animals of the air, the forest, and the village."
    },
    {
      num: 9,
      type: "sacrifice",
      devanagari: "तस्माद्यज्ञात्सर्वहुत ऋचः सामानि जज्ञिरे ।\nछन्दांसि जज्ञिरे तस्माद्यजुस्तस्मादजायत ॥",
      transliteration: "tasmādyajñātsarvahuta ṛcaḥ sāmāni jajñirē |\nchandāṁsi jajñirē tasmādyajustasmādajāyata ||",
      translation: "From that great sacrifice were born the Rig Veda hymns and the Sama Veda chants. The Vedic metres were born from it, and from it the Yajur Veda was born."
    },
    {
      num: 10,
      type: "sacrifice",
      devanagari: "तस्मादश्वा अजायन्त ये के चोभयादतः ।\nगावो ह जज्ञिरे तस्मात्तस्माज्जाता अजावयः ॥",
      transliteration: "tasmādaśvā ajāyanta yē kē cōbhayādataḥ |\ngāvō ha jajñirē tasmāttasmājjātā ajāvayaḥ ||",
      translation: "From that sacrifice were born horses and all those with two rows of teeth. Cattle were born from it, and from it were born goats and sheep."
    },
    {
      num: 11,
      type: "creation",
      devanagari: "यत्पुरुषं व्यदधुः कतिधा व्यकल्पयन् ।\nमुखं किमस्य कौ बाहू का ऊरू पादा उच्येते ॥",
      transliteration: "yatpuruṣaṁ vyadadhuḥ katidhā vyakalpayan |\nmukhaṁ kimasya kau bāhū kā ūrū pādā ucyētē ||",
      translation: "When they divided the Purusha, into how many parts did they arrange Him? What became of His mouth? What of His arms? What are His thighs and feet called?"
    },
    {
      num: 12,
      type: "creation",
      devanagari: "ब्राह्मणोऽस्य मुखमासीद्बाहू राजन्यः कृतः ।\nऊरू तदस्य यद्वैश्यः पद्भ्यां शूद्रो अजायत ॥",
      transliteration: "brāhmaṇō'sya mukhamāsīdbāhū rājanyaḥ kṛtaḥ |\nūrū tadasya yadvaiśyaḥ padbhyāṁ śūdrō ajāyata ||",
      translation: "The Brahmana was His mouth. The Kshatriya was made from His arms. His thighs became the Vaishya. From His feet the Shudra was born."
    },
    {
      num: 13,
      type: "creation",
      devanagari: "चन्द्रमा मनसो जातश्चक्षोः सूर्यो अजायत ।\nमुखादिन्द्रश्चाग्निश्च प्राणाद्वायुरजायत ॥",
      transliteration: "candramā manasō jātaścakṣōḥ sūryō ajāyata |\nmukhādindraścāgniśca prāṇādvāyurajāyata ||",
      translation: "The Moon was born from His mind. The Sun was born from His eyes. From His mouth were born Indra and Agni. From His breath Vayu (the wind) was born."
    },
    {
      num: 14,
      type: "creation",
      devanagari: "नाभ्या आसीदन्तरिक्षं शीर्ष्णो द्यौः समवर्तत ।\nपद्भ्यां भूमिर्दिशः श्रोत्रात्तथा लोकाँ अकल्पयन् ॥",
      transliteration: "nābhyā āsīdantarikṣaṁ śīrṣṇō dyauḥ samavartata |\npadbhyāṁ bhūmirdiśaḥ śrōtrāttathā lōkām̐ akalpayan ||",
      translation: "From His navel arose the sky. From His head the heaven was formed. From His feet came the earth, from His ears the directions. Thus they fashioned the worlds."
    },
    {
      num: 15,
      type: "creation",
      devanagari: "सप्तास्यासन् परिधयस्त्रिः सप्त समिधः कृताः ।\nदेवा यद्यज्ञं तन्वाना अबध्नन्पुरुषं पशुम् ॥",
      transliteration: "saptāsyāsan paridhayastriḥ sapta samidhaḥ kṛtāḥ |\ndēvā yadyajñaṁ tanvānā abadhnanpuruṣaṁ paśum ||",
      translation: "Seven were the enclosing sticks, and thrice seven the fuel sticks made. When the Devas performed the sacrifice, they bound the Purusha as the sacrificial animal."
    },
    {
      num: 16,
      type: "creation",
      devanagari: "यज्ञेन यज्ञमयजन्त देवास्तानि धर्माणि प्रथमान्यासन् ।\nते ह नाकं महिमानः सचन्त यत्र पूर्वे साध्याः सन्ति देवाः ॥",
      transliteration: "yajñēna yajñamayajanta dēvāstāni dharmāṇi prathamānyāsan |\ntē ha nākaṁ mahimānaḥ sacanta yatra pūrvē sādhyāḥ santi dēvāḥ ||",
      translation: "The Devas worshipped the sacrifice by the sacrifice itself. These were the first established rites. Those great ones attained the vault of heaven where the ancient Sadhyas and Devas dwell."
    }
  ]
};
