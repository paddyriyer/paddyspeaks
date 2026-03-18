// Durga Suktam - Complete Text
// ================================
// Source: Mahanarayana Upanishad (Taittiriya Aranyaka 10)
// Rishi: Various
// Devata: Durga (Agni's transformative aspect as the Divine Mother)
// Chandas: Various metres

const STOTRAM_DATA = {
  title: "Durga Suktam",
  titleSanskrit: "दुर्गासूक्तम्",
  subtitle: "The Hymn of the Invincible Goddess",
  rishi: "Various Rishis",
  devata: "Durga (Agni-Durga)",
  source: "Mahanarayana Upanishad (Taittiriya Aranyaka 10)",

  verses: [
    {
      num: 1,
      type: "agni",
      devanagari: "ॐ जातवेदसे सुनवाम सोमम् अरातीयतो निदहाति वेदः ।\nस नः पर्षदति दुर्गाणि विश्वा नावेव सिन्धुं दुरितात्यग्निः ॥",
      transliteration: "ōṁ jātavēdasē sunavāma sōmam arātīyatō nidahāti vēdaḥ |\nsa naḥ parṣadati durgāṇi viśvā nāvēva sindhuṁ duritātyagniḥ ||",
      translation: "We press the Soma juice for Jatavedas (the all-knowing Fire). May He consume the wealth of the hostile. May that Agni carry us across all difficulties, like a boat across the river — beyond all evil."
    },
    {
      num: 2,
      type: "agni",
      devanagari: "तामग्निवर्णां तपसा ज्वलन्तीं वैरोचनीं कर्मफलेषु जुष्टाम् ।\nदुर्गां देवीं शरणमहं प्रपद्ये सुतरसि तरसे नमः ॥",
      transliteration: "tāmagnivarṇāṁ tapasā jvalantīṁ vairōcanīṁ karmaphalēṣu juṣṭām |\ndurgāṁ dēvīṁ śaraṇamahaṁ prapadyē sutarasi tarasē namaḥ ||",
      translation: "I take refuge in that Goddess Durga who is fire-hued, blazing with austerity, resplendent, and worshipped for the fruits of action. O Goddess who helps us cross over, salutations to Your swiftness."
    },
    {
      num: 3,
      type: "agni",
      devanagari: "अग्ने त्वं पारया नव्यो अस्मान् स्वस्तिभिरति दुर्गाणि विश्वा ।\nपूश्च पृथ्वी बहुला न उर्वी भवा तोकाय तनयाय शंयोः ॥",
      transliteration: "agnē tvaṁ pārayā navyō asmān svastibhirati durgāṇi viśvā |\npūśca pṛthvī bahulā na urvī bhavā tōkāya tanayāya śaṁyōḥ ||",
      translation: "O Agni, being ever new, carry us across all difficulties with blessings of well-being. May our city and earth be vast and expansive. Be the source of happiness for our children and their children."
    },
    {
      num: 4,
      type: "protection",
      devanagari: "विश्वानि नो दुर्गहा जातवेदः सिन्धुं न नावा दुरितातिपर्षि ।\nअग्ने अत्रिवन्मनसा गृणानोऽस्माकं बोध्यविता तनूनाम् ॥",
      transliteration: "viśvāni nō durgahā jātavēdaḥ sindhuṁ na nāvā duritātipparṣi |\nagnē atrivanmanasā gṛṇānō'smākaṁ bōdhyavitā tanūnām ||",
      translation: "O Jatavedas, destroyer of all obstacles, carry us beyond all evil like a boat across the ocean. O Agni, being praised with devotion like Atri, be the protector of our bodies."
    },
    {
      num: 5,
      type: "protection",
      devanagari: "पृतनाजितं सहमानमुग्रमग्निं हुवेम परमात्सधस्थात् ।\nस नः पर्षदति दुर्गाणि विश्वा क्षामद्देवो अतिदुरितात्यग्निः ॥",
      transliteration: "pṛtanājitaṁ sahamānamagramagniṁ huvēma paramātsadhasthāt |\nsa naḥ parṣadati durgāṇi viśvā kṣāmaddēvō atidurritātyagniḥ ||",
      translation: "We invoke the fierce Agni, conqueror of armies, mighty, from the highest abode. May that divine Agni carry us across all difficulties and beyond all evil on the earth."
    },
    {
      num: 6,
      type: "protection",
      devanagari: "प्रत्नोषि कमीड्यो अध्वरेषु सनाच्च होता नव्यश्च सत्सि ।\nस्वां चाग्ने तनुवं पिप्रयस्वास्मभ्यं च सौभगमायजस्व ॥",
      transliteration: "pratnōṣi kamīḍyō adhvarēṣu sanācca hōtā navyaśca satsi |\nsvāṁ cāgnē tanūvaṁ piprayasvāsmabhyaṁ ca saubhagamāyajasva ||",
      translation: "O Agni, You are the ancient one worthy of praise in sacrifices. You are both the eternal and the ever-new invoker. Nourish Your own form, and bestow upon us good fortune through sacrifice."
    },
    {
      num: 7,
      type: "durga",
      devanagari: "गोभिर्जुष्टमयुजो निषिक्तं तवेन्द्र विष्णोरनुसंचरेम ।\nनाकस्य पृष्ठमभि संवसानो वैष्णवीं लोक इह मादयन्ताम् ॥",
      transliteration: "gōbhirjuṣṭamayujō niṣiktaṁ tavēndra viṣṇōranusaṁcarēma |\nnākasya pṛṣṭhamabhi saṁvasānō vaiṣṇavīṁ lōka iha mādayantām ||",
      translation: "O Indra, may we follow the path of Vishnu, which is nourished by the radiance of knowledge and bathed in splendour. Dwelling on the summit of heaven, may we rejoice in the realm of Vishnu."
    },
    {
      num: 8,
      type: "durga",
      devanagari: "कात्यायनाय विद्महे कन्यकुमारि धीमहि ।\nतन्नो दुर्गिः प्रचोदयात् ॥",
      transliteration: "kātyāyanāya vidmahē kanyakumāri dhīmahi |\ntannō durgiḥ pracōdayāt ||",
      translation: "We meditate upon Katyayani. We contemplate the Divine Virgin. May that Durga inspire and illuminate us."
    },
    {
      num: 9,
      type: "durga",
      devanagari: "ॐ शान्तिः शान्तिः शान्तिः ॥",
      transliteration: "ōṁ śāntiḥ śāntiḥ śāntiḥ ||",
      translation: "Om. Peace, peace, peace. (May there be peace from the divine, from the natural, and from the self.)"
    }
  ]
};
