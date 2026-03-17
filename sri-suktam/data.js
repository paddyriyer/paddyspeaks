// Sri Suktam - Complete Text
// ================================
// Source: Rig Veda Khilani (Appendix to Rig Veda)
// Rishi: Various (attributed to multiple seers)
// Devata: Sri (Goddess Lakshmi)
// Chandas: Various metres

const STOTRAM_DATA = {
  title: "Sri Suktam",
  titleSanskrit: "श्रीसूक्तम्",
  subtitle: "The Hymn of Divine Prosperity",
  rishi: "Various Rishis",
  devata: "Sri (Lakshmi)",
  source: "Rig Veda Khilani",

  verses: [
    {
      num: 1,
      type: "invocation",
      devanagari: "ॐ हिरण्यवर्णां हरिणीं सुवर्णरजतस्रजाम् ।\nचन्द्रां हिरण्मयीं लक्ष्मीं जातवेदो म आवह ॥",
      transliteration: "ōṁ hiraṇyavarṇāṁ hariṇīṁ suvarṇarajatasrajām |\ncandrāṁ hiraṇmayīṁ lakṣmīṁ jātavēdō ma āvaha ||",
      translation: "O Jatavedas (Fire God), bring to me that Lakshmi who is golden-hued, beautiful as a deer, adorned with gold and silver garlands, radiant like the moon, and resplendent with golden lustre."
    },
    {
      num: 2,
      type: "invocation",
      devanagari: "तां म आवह जातवेदो लक्ष्मीमनपगामिनीम् ।\nयस्यां हिरण्यं विन्देयं गामश्वं पुरुषानहम् ॥",
      transliteration: "tāṁ ma āvaha jātavēdō lakṣmīmanapagāminīm |\nyasyāṁ hiraṇyaṁ vindēyaṁ gāmaśvaṁ puruṣānaham ||",
      translation: "O Jatavedas, bring to me that Lakshmi who never departs, through whom I may obtain gold, cattle, horses, and progeny."
    },
    {
      num: 3,
      type: "invocation",
      devanagari: "अश्वपूर्वां रथमध्यां हस्तिनादप्रबोधिनीम् ।\nश्रियं देवीमुपह्वये श्रीर्मा देवी जुषताम् ॥",
      transliteration: "aśvapūrvāṁ rathamadhyāṁ hastinādaprabōdhinīm |\nśriyaṁ dēvīmupahvayē śrīrmā dēvī juṣatām ||",
      translation: "I invoke that Goddess Sri (Lakshmi) who has horses in front, chariots in the middle, and is heralded by the trumpeting of elephants. May the divine Sri be pleased with me."
    },
    {
      num: 4,
      type: "invocation",
      devanagari: "कां सोस्मितां हिरण्यप्राकारामार्द्रां ज्वलन्तीं तृप्तां तर्पयन्तीम् ।\nपद्मे स्थितां पद्मवर्णां तामिहोपह्वये श्रियम् ॥",
      transliteration: "kāṁ sōsmitāṁ hiraṇyaprākārāmārdrāṁ jvalantīṁ tṛptāṁ tarpayantīm |\npadmē sthitāṁ padmavarṇāṁ tāmihōpahvayē śriyam ||",
      translation: "I invoke here that Sri (Lakshmi) who is smiling, who is surrounded by a golden aura, who is moist with compassion, blazing with splendour, content and bestowing contentment, who is seated on a lotus and is lotus-hued."
    },
    {
      num: 5,
      type: "invocation",
      devanagari: "चन्द्रां प्रभासां यशसा ज्वलन्तीं श्रियं लोके देवजुष्टामुदाराम् ।\nतां पद्मिनीमीं शरणमहं प्रपद्येऽलक्ष्मीर्मे नश्यतां त्वां वृणे ॥",
      transliteration: "candrāṁ prabhāsāṁ yaśasā jvalantīṁ śriyaṁ lōkē dēvajuṣṭāmudārām |\ntāṁ padminīmīṁ śaraṇamahaṁ prapadyē'lakṣmīrmē naśyatāṁ tvāṁ vṛṇē ||",
      translation: "I take refuge in that Sri who is radiant like the moon, luminous, blazing with fame, worshipped by the gods, generous, and seated amidst lotuses. May all misfortune perish — I choose You."
    },
    {
      num: 6,
      type: "glory",
      devanagari: "आदित्यवर्णे तपसोऽधिजातो वनस्पतिस्तव वृक्षोऽथ बिल्वः ।\nतस्य फलानि तपसा नुदन्तु मायान्तरायाश्च बाह्या अलक्ष्मीः ॥",
      transliteration: "ādityavarṇē tapasō'dhijātō vanaspatistava vṛkṣō'tha bilvaḥ |\ntasya phalāni tapasā nudantu māyāntarāyāśca bāhyā alakṣmīḥ ||",
      translation: "O Goddess of solar radiance, born of spiritual austerity, the Bilva tree is Your sacred tree. May its fruits, through the power of penance, drive away the illusion of inner and outer misfortune."
    },
    {
      num: 7,
      type: "glory",
      devanagari: "उपैतु मां देवसखः कीर्तिश्च मणिना सह ।\nप्रादुर्भूतोऽस्मि राष्ट्रेऽस्मिन् कीर्तिमृद्धिं ददातु मे ॥",
      transliteration: "upaiitu māṁ dēvasakhaḥ kīrtiśca maṇinā saha |\nprādurbhūtō'smi rāṣṭrē'smin kīrtimṛddhiṁ dadātu mē ||",
      translation: "May the friend of the gods (Kubera, the lord of wealth) approach me along with fame and the celestial jewel. I have been born in this nation — may he grant me fame and prosperity."
    },
    {
      num: 8,
      type: "glory",
      devanagari: "क्षुत्पिपासामलां ज्येष्ठामलक्ष्मीं नाशयाम्यहम् ।\nअभूतिमसमृद्धिं च सर्वां निर्णुद मे गृहात् ॥",
      transliteration: "kṣutpipāsāmalāṁ jyēṣṭhāmalakṣmīṁ nāśayāmyaham |\nabhūtimasamṛddhiṁ ca sarvāṁ nirṇuda mē gṛhāt ||",
      translation: "I destroy the elder sister Alakshmi (misfortune), who is the embodiment of hunger, thirst, and impurity. Drive away all poverty and lack of prosperity from my home."
    },
    {
      num: 9,
      type: "glory",
      devanagari: "गन्धद्वारां दुराधर्षां नित्यपुष्टां करीषिणीम् ।\nईश्वरीं सर्वभूतानां तामिहोपह्वये श्रियम् ॥",
      transliteration: "gandhadvārāṁ durādharṣāṁ nityapuṣṭāṁ karīṣiṇīm |\nīśvarīṁ sarvabhūtānāṁ tāmihōpahvayē śriyam ||",
      translation: "I invoke here that Sri who is perceivable through fragrance, who is invincible, who is eternally nourished, who bestows abundance, and who is the sovereign of all beings."
    },
    {
      num: 10,
      type: "glory",
      devanagari: "मनसः काममाकूतिं वाचः सत्यमशीमहि ।\nपशूनां रूपमन्नस्य मयि श्रीः श्रयतां यशः ॥",
      transliteration: "manasaḥ kāmamākūtiṁ vācaḥ satyamaśīmahi |\npaśūnāṁ rūpamannasya mayi śrīḥ śrayatāṁ yaśaḥ ||",
      translation: "May I attain the desire and resolve of my mind, the truth of my speech, the beauty of cattle, and the abundance of food. May Sri and glory take refuge in me."
    },
    {
      num: 11,
      type: "blessing",
      devanagari: "कर्दमेन प्रजा भूता मयि सम्भव कर्दम ।\nश्रियं वासय मे कुले मातरं पद्ममालिनीम् ॥",
      transliteration: "kardamēna prajā bhūtā mayi sambhava kardama |\nśriyaṁ vāsaya mē kulē mātaraṁ padmamālinīm ||",
      translation: "O Kardama (son of Lakshmi), through whom progeny was born, manifest in me. Establish in my family Sri, the Mother adorned with lotus garlands."
    },
    {
      num: 12,
      type: "blessing",
      devanagari: "आपः सृजन्तु स्निग्धानि चिक्लीत वस मे गृहे ।\nनि च देवीं मातरं श्रियं वासय मे कुले ॥",
      transliteration: "āpaḥ sṛjantu snigdhāni ciklīta vasa mē gṛhē |\nni ca dēvīṁ mātaraṁ śriyaṁ vāsaya mē kulē ||",
      translation: "May the waters create pleasing things. O Chiklita (son of Lakshmi), dwell in my home. And establish the divine Mother Sri in my family."
    },
    {
      num: 13,
      type: "blessing",
      devanagari: "आर्द्रां पुष्करिणीं पुष्टिं पिङ्गलां पद्ममालिनीम् ।\nचन्द्रां हिरण्मयीं लक्ष्मीं जातवेदो म आवह ॥",
      transliteration: "ārdrāṁ puṣkariṇīṁ puṣṭiṁ piṅgalāṁ padmamālinīm |\ncandrāṁ hiraṇmayīṁ lakṣmīṁ jātavēdō ma āvaha ||",
      translation: "O Jatavedas, bring to me that Lakshmi who is moist with compassion, who abides in lotus ponds, who nourishes, who is golden-hued, adorned with lotus garlands, radiant like the moon, and resplendent with golden lustre."
    },
    {
      num: 14,
      type: "blessing",
      devanagari: "आर्द्रां यः करिणीं यष्टिं सुवर्णां हेममालिनीम् ।\nसूर्यां हिरण्मयीं लक्ष्मीं जातवेदो म आवह ॥",
      transliteration: "ārdrāṁ yaḥ kariṇīṁ yaṣṭiṁ suvarṇāṁ hēmamālinīm |\nsūryāṁ hiraṇmayīṁ lakṣmīṁ jātavēdō ma āvaha ||",
      translation: "O Jatavedas, bring to me that Lakshmi who is compassionate, who is majestic like an elephant, who is commanding, who is golden, adorned with golden garlands, radiant like the sun, and resplendent with golden lustre."
    },
    {
      num: 15,
      type: "blessing",
      devanagari: "तां म आवह जातवेदो लक्ष्मीमनपगामिनीम् ।\nयस्यां हिरण्यं प्रभूतं गावो दास्योऽश्वान् विन्देयं पुरुषानहम् ॥",
      transliteration: "tāṁ ma āvaha jātavēdō lakṣmīmanapagāminīm |\nyasyāṁ hiraṇyaṁ prabhūtaṁ gāvō dāsyō'śvān vindēyaṁ puruṣānaham ||",
      translation: "O Jatavedas, bring to me that Lakshmi who never departs, through whom I may obtain abundant gold, cattle, servants, horses, and progeny."
    },
    {
      num: 16,
      type: "phala",
      devanagari: "यः शुचिः प्रयतो भूत्वा जुहुयादाज्यमन्वहम् ।\nश्रियः पञ्चदशर्चं च श्रीकामः सततं जपेत् ॥",
      transliteration: "yaḥ śuciḥ prayatō bhūtvā juhuyādājyamanvaham |\nśriyaḥ pañcadaśarcaṁ ca śrīkāmaḥ satataṁ japēt ||",
      translation: "One who, being pure and self-controlled, offers ghee daily and constantly recites these fifteen verses of Sri Suktam with a desire for prosperity — shall attain the blessings of Sri."
    },
    {
      num: 17,
      type: "phala",
      devanagari: "पद्मानने पद्म ऊरू पद्माक्षी पद्मसम्भवे ।\nतन्मे भजसि पद्माक्षी येन सौख्यं लभाम्यहम् ॥",
      transliteration: "padmānanē padma ūrū padmākṣī padmasambhavē |\ntanmē bhajasi padmākṣī yēna saukhyaṁ labhāmyaham ||",
      translation: "O Lotus-faced one, with lotus-like thighs, lotus-eyed one, born of the lotus — O Padmakshi, bestow upon me that by which I may attain happiness."
    },
    {
      num: 18,
      type: "phala",
      devanagari: "अश्वदायी गोदायी धनदायी महाधने ।\nधनं मे जुषतां देवी सर्वकामांश्च देहि मे ॥",
      transliteration: "aśvadāyī gōdāyī dhanadāyī mahādhanē |\ndhanaṁ mē juṣatāṁ dēvī sarvakāmāṁśca dēhi mē ||",
      translation: "O giver of horses, giver of cattle, giver of wealth, O greatly wealthy Goddess — may wealth be pleased with me. Grant me all my desires."
    },
    {
      num: 19,
      type: "phala",
      devanagari: "पद्मप्रिये पद्मिनि पद्महस्ते पद्मालये पद्मदलायताक्षि ।\nविश्वप्रिये विष्णुमनोऽनुकूले त्वत्पादपद्मं मयि सन्निधत्स्व ॥",
      transliteration: "padmapriyē padmini padmahastē padmālayē padmadalāyatākṣi |\nviśvapriyē viṣṇumanō'nukūlē tvatpādapadmaṁ mayi sannidhatsva ||",
      translation: "O Lover of lotuses, O Lotus goddess, lotus in hand, dwelling in the lotus, with eyes wide as lotus petals, beloved of the universe, pleasing to the heart of Vishnu — place Your lotus feet upon me."
    }
  ]
};
