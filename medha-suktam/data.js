// Medha Suktam - Complete Text
// ================================
// Source: Taittiriya Aranyaka 10 (Mahanarayana Upanishad)
// Rishi: Various Rishis
// Devata: Medha (Divine Intelligence / Saraswati)
// Chandas: Various metres

const STOTRAM_DATA = {
  title: "Medha Suktam",
  titleSanskrit: "मेधासूक्तम्",
  subtitle: "The Hymn of Divine Intelligence",
  rishi: "Various Rishis",
  devata: "Medha (Divine Intelligence)",
  source: "Taittiriya Aranyaka 10 (Mahanarayana Upanishad)",

  verses: [
    {
      num: 1,
      type: "invocation",
      devanagari: "ॐ यश्छन्दसामृषभो विश्वरूपः ।\nछन्दोभ्योऽध्यमृतात्सम्बभूव ।\nस मेन्द्रो मेधया स्पृणोतु ।\nअमृतस्य देव धारणो भूयासम् ।\nशरीरं मे विचर्षणम् ।\nजिह्वा मे मधुमत्तमा ।\nकर्णाभ्यां भूरि विश्रुवम् ।\nब्रह्मणः कोशोऽसि मेधया पिहितः ।\nश्रुतं मे गोपाय ॥",
      transliteration: "ōṁ yaśchandasāmṛṣabhō viśvarūpaḥ |\nchandōbhyō'dhyamṛtātsambabhūva |\nsa mēndrō mēdhayā spṛṇōtu |\namṛtasya dēva dhāraṇō bhūyāsam |\nśarīraṁ mē vicarṣaṇam |\njihvā mē madhumattamā |\nkarṇābhyāṁ bhūri viśruvam |\nbrahmaṇaḥ kōśō'si mēdhayā pihitaḥ |\nśrutaṁ mē gōpāya ||",
      translation: "He who is the bull (foremost) among the Vedic metres, who is of universal form, who arose from the immortal essence beyond the metres — may that Indra nourish me with intelligence. O Lord, may I become the sustainer of immortal wisdom. May my body be vigorous. May my tongue be exceedingly sweet. May I hear abundantly with my ears. You are the sheath of Brahman, covered by intelligence. Protect what I have heard."
    },
    {
      num: 2,
      type: "invocation",
      devanagari: "ॐ मेधां मे वरुणो मेधामग्निः प्रजापतिः ।\nमेधामिन्द्रश्च वायुश्च मेधां धाता ददातु मे ।\nमेधां ते वायुर्गोपायति मेधां ते अग्निर्गोपायति ॥",
      transliteration: "ōṁ mēdhāṁ mē varuṇō mēdhāmagniḥ prajāpatiḥ |\nmēdhāmindraśca vāyuśca mēdhāṁ dhātā dadātu mē |\nmēdhāṁ tē vāyurgōpāyati mēdhāṁ tē agnirgōpāyati ||",
      translation: "May Varuna grant me intelligence, may Agni and Prajapati grant me intelligence. May Indra and Vayu grant me intelligence. May Dhata (the Creator) bestow intelligence upon me. May Vayu protect your intelligence, may Agni protect your intelligence."
    },
    {
      num: 3,
      type: "invocation",
      devanagari: "मेधां मे वरुणो ददातु मेधामग्निः प्रजापतिः ।\nमेधामिन्द्रश्च वायुश्च मेधां धाता ददातु मे ॥",
      transliteration: "mēdhāṁ mē varuṇō dadātu mēdhāmagniḥ prajāpatiḥ |\nmēdhāmindraśca vāyuśca mēdhāṁ dhātā dadātu mē ||",
      translation: "May Varuna bestow intelligence upon me. May Agni and Prajapati grant me intelligence. May Indra and Vayu grant me intelligence. May Dhata (the Creator) bestow intelligence upon me."
    },
    {
      num: 4,
      type: "prayer",
      devanagari: "मेधां सरस्वती देवी विश्वरूपा हिरण्यवर्णा जगतीं बृहत्सर्वम् ।\nतां मे देवीं सरस्वतीमनिर्दिष्टां सरस्वतीं तृप्तां भगवतीं प्रपद्ये ॥",
      transliteration: "mēdhāṁ sarasvatī dēvī viśvarūpā hiraṇyavarṇā jagatīṁ bṛhatsarvam |\ntāṁ mē dēvīṁ sarasvatīmanirdiṣṭāṁ sarasvatīṁ tṛptāṁ bhagavatīṁ prapadyē ||",
      translation: "Intelligence is Goddess Saraswati, of universal form, golden-hued, pervading the vast world. I take refuge in that Goddess Saraswati who is beyond description, who is satisfied, and who is the blessed one."
    },
    {
      num: 5,
      type: "prayer",
      devanagari: "मेधां मह्यमदाद् देवः पदे पदे ददातु मे ।\nश्रद्धां मेधां यशो बलम् ।\nमेधां प्रज्ञां विदां चक्षुर्मनीषां धृतिं स्मृतिम् ॥",
      transliteration: "mēdhāṁ mahyamadād dēvaḥ padē padē dadātu mē |\nśraddhāṁ mēdhāṁ yaśō balam |\nmēdhāṁ prajñāṁ vidāṁ cakṣurmanīṣāṁ dhṛtiṁ smṛtim ||",
      translation: "May the Lord grant me intelligence at every step. May He bestow faith, intelligence, fame, and strength. May He grant me intelligence, wisdom, the eye of knowledge, thought, fortitude, and memory."
    },
    {
      num: 6,
      type: "prayer",
      devanagari: "त्वं नो मेधे प्रथमा गोभिरश्वैः प्रजावतीरीश्वरी स्थूणा विश्वस्य भुवनस्य गोपा ।\nउपैतु मां देवसखा कीर्तिश्च मणिना सह ।\nप्रादुर्भूतोऽस्मि राष्ट्रेऽस्मिन् कीर्तिमृद्धिं ददातु मे ॥",
      transliteration: "tvaṁ nō mēdhē prathamā gōbhiraśvaiḥ prajāvatīrīśvarī sthūṇā viśvasya bhuvanasya gōpā |\nupaiitu māṁ dēvasakhaḥ kīrtiśca maṇinā saha |\nprādurbhūtō'smi rāṣṭrē'smin kīrtimṛddhiṁ dadātu mē ||",
      translation: "O Medha, You are the foremost, endowed with cattle and horses, blessed with progeny, sovereign, the pillar and protector of the entire world. May the friend of the gods come to me along with fame and the divine jewel. I have been born in this nation — may he grant me fame and prosperity."
    },
    {
      num: 7,
      type: "prayer",
      devanagari: "मेधां मनीषामभीवर्तेन मा ह्रासिषम् ।\nअमोघं देवहेडनम् ।\nविश्वस्य दृशतो वयम् ।\nजनस्य दृशतो वयम् ॥",
      transliteration: "mēdhāṁ manīṣāmabhīvartēna mā hrāsiṣam |\namōghaṁ dēvahēḍanam |\nviśvasya dṛśatō vayam |\njanasya dṛśatō vayam ||",
      translation: "May I never lose intelligence and thought. The displeasure of the gods is never in vain. We are visible to the whole universe. We are visible to all people."
    },
    {
      num: 8,
      type: "blessing",
      devanagari: "मेधावी भूयासं सुमेधा भगवान् भूयासम् ।\nप्रतिष्ठा विश्वस्य भुवनस्य मेधे ।\nतया मामिन्द्रो मेधया स्पृणोतु ॥",
      transliteration: "mēdhāvī bhūyāsaṁ sumēdhā bhagavān bhūyāsam |\npratiṣṭhā viśvasya bhuvanasya mēdhē |\ntayā māmindrō mēdhayā spṛṇōtu ||",
      translation: "May I become intelligent! May I become one of excellent intelligence, endowed with divine fortune! O Medha, You are the foundation of the entire world. May Indra nourish me with that intelligence."
    },
    {
      num: 9,
      type: "blessing",
      devanagari: "श्रद्धां मेधां यशः प्रज्ञां विद्यां बुद्धिं श्रियं बलम् ।\nआयुष्यं तेज आरोग्यं देहि मे हव्यवाहन ॥",
      transliteration: "śraddhāṁ mēdhāṁ yaśaḥ prajñāṁ vidyāṁ buddhiṁ śriyaṁ balam |\nāyuṣyaṁ tēja ārōgyaṁ dēhi mē havyavāhana ||",
      translation: "O Carrier of Oblations (Agni), bestow upon me faith, intelligence, fame, wisdom, knowledge, understanding, prosperity, strength, longevity, brilliance, and good health."
    },
    {
      num: 10,
      type: "blessing",
      devanagari: "ॐ हंसः शुचिषद्वसुरन्तरिक्षसद्धोता वेदिषदतिथिर्दुरोणसत् ।\nनृषद्वरसदृतसद्व्योमसदब्जा गोजा ऋतजा अद्रिजा ऋतं बृहत् ॥",
      transliteration: "ōṁ haṁsaḥ śuciṣadvasurantarikṣasaddhōtā vēdiṣadatithirdurōṇasat |\nnṛṣadvarasadṛtasadvyōmasadabjā gōjā ṛtajā adrijā ṛtaṁ bṛhat ||",
      translation: "Om. The Supreme Swan (Paramatma) dwells in purity, in the atmosphere as Vasu, on the altar as the invoker, in the home as the guest. He dwells in mankind, in the noble, in cosmic order, in the sky. He is born of water, of light, of truth, of the mountain — He is the great cosmic Truth."
    },
    {
      num: 11,
      type: "blessing",
      devanagari: "ॐ शान्तिः शान्तिः शान्तिः ॥",
      transliteration: "ōṁ śāntiḥ śāntiḥ śāntiḥ ||",
      translation: "Om. Peace, peace, peace. (May there be peace from the divine, from the natural, and from within oneself.)"
    }
  ]
};
