// Soundarya Lahari - Word-by-Word Splits
// Adds word data to SOUNDARYA_LAHARI_DATA
(function () {
  var W = {};

  W[1] = [
    { word: "शिवः", transliteration: "śivaḥ", meaning: "Lord Shiva" },
    { word: "शक्त्या", transliteration: "śaktyā", meaning: "with Shakti (power)" },
    { word: "युक्तः", transliteration: "yuktaḥ", meaning: "united" },
    { word: "यदि", transliteration: "yadi", meaning: "if" },
    { word: "भवति", transliteration: "bhavati", meaning: "becomes" },
    { word: "शक्तः", transliteration: "śaktaḥ", meaning: "capable" },
    { word: "प्रभवितुं", transliteration: "prabhavituṃ", meaning: "to create/manifest" },
    { word: "न चेत्", transliteration: "na cet", meaning: "if not" },
    { word: "एवं", transliteration: "evaṃ", meaning: "thus" },
    { word: "देवः", transliteration: "devaḥ", meaning: "the God" },
    { word: "न खलु", transliteration: "na khalu", meaning: "indeed not" },
    { word: "कुशलः", transliteration: "kuśalaḥ", meaning: "capable" },
    { word: "स्पन्दितुम् अपि", transliteration: "spanditum api", meaning: "even to stir" },
    { word: "अतः", transliteration: "ataḥ", meaning: "therefore" },
    { word: "त्वाम्", transliteration: "tvām", meaning: "You" },
    { word: "आराध्यां", transliteration: "ārādhyāṃ", meaning: "worthy of worship" },
    { word: "हरि-हर-विरिञ्चि-आदिभिः अपि", transliteration: "hari-hara-viriñci-ādibhiḥ api", meaning: "even by Vishnu, Shiva, Brahma and others" },
    { word: "प्रणन्तुं", transliteration: "praṇantuṃ", meaning: "to bow" },
    { word: "स्तोतुं वा", transliteration: "stotuṃ vā", meaning: "or to praise" },
    { word: "कथम्", transliteration: "katham", meaning: "how" },
    { word: "अकृतपुण्यः", transliteration: "akṛtapuṇyaḥ", meaning: "one without merit" },
    { word: "प्रभवति", transliteration: "prabhavati", meaning: "is able" }
  ];

  W[2] = [
    { word: "तनीयांसं", transliteration: "tanīyāṃsaṃ", meaning: "extremely fine" },
    { word: "पांसुं", transliteration: "pāṃsuṃ", meaning: "dust" },
    { word: "तव", transliteration: "tava", meaning: "Your" },
    { word: "चरण-पङ्केरुह-भवं", transliteration: "caraṇa-paṅkeruha-bhavaṃ", meaning: "born from the lotus-feet" },
    { word: "विरिञ्चिः", transliteration: "viriñciḥ", meaning: "Brahma" },
    { word: "सञ्चिन्वन्", transliteration: "sañcinvan", meaning: "collecting" },
    { word: "विरचयति", transliteration: "viracayati", meaning: "creates" },
    { word: "लोकान्", transliteration: "lokān", meaning: "the worlds" },
    { word: "अविकलम्", transliteration: "avikalam", meaning: "perfectly/completely" },
    { word: "वहति", transliteration: "vahati", meaning: "bears" },
    { word: "एनं", transliteration: "enaṃ", meaning: "this (dust)" },
    { word: "शौरिः", transliteration: "śauriḥ", meaning: "Vishnu" },
    { word: "कथम् अपि", transliteration: "katham api", meaning: "with great difficulty" },
    { word: "सहस्रेण शिरसां", transliteration: "sahasreṇa śirasāṃ", meaning: "with thousand heads" },
    { word: "हरः", transliteration: "haraḥ", meaning: "Shiva" },
    { word: "संक्षुद्य", transliteration: "saṃkṣudya", meaning: "crushing" },
    { word: "एनं", transliteration: "enaṃ", meaning: "this (dust)" },
    { word: "भजति", transliteration: "bhajati", meaning: "performs" },
    { word: "भसित-उद्धूलन-विधिम्", transliteration: "bhasita-uddhūlana-vidhim", meaning: "the ritual of smearing sacred ash" }
  ];

  W[3] = [
    { word: "अविद्यानाम्", transliteration: "avidyānām", meaning: "for those in ignorance" },
    { word: "अन्तः-तिमिर", transliteration: "antaḥ-timira", meaning: "inner darkness" },
    { word: "मिहिर-द्वीप-नगरी", transliteration: "mihira-dvīpa-nagarī", meaning: "island-city of the Sun" },
    { word: "जडानां", transliteration: "jaḍānāṃ", meaning: "for the dull-witted" },
    { word: "चैतन्य-स्तबक", transliteration: "caitanya-stabaka", meaning: "bouquet of consciousness" },
    { word: "मकरन्द-स्रुति-झरी", transliteration: "makaranda-sruti-jharī", meaning: "cascade of flowing nectar" },
    { word: "दरिद्राणां", transliteration: "daridrāṇāṃ", meaning: "for the destitute" },
    { word: "चिन्तामणि-गुणनिका", transliteration: "cintāmaṇi-guṇanikā", meaning: "necklace of wish-fulfilling gems" },
    { word: "जन्म-जलधौ", transliteration: "janma-jaladhau", meaning: "in the ocean of birth" },
    { word: "निमग्नानां", transliteration: "nimagnānāṃ", meaning: "for those drowning" },
    { word: "दंष्ट्रा", transliteration: "daṃṣṭrā", meaning: "tusk" },
    { word: "मुर-रिपु-वराहस्य", transliteration: "mura-ripu-varāhasya", meaning: "of Vishnu's Boar incarnation" },
    { word: "भवति", transliteration: "bhavati", meaning: "becomes" }
  ];

  W[4] = [
    { word: "त्वत्-अन्यः", transliteration: "tvat-anyaḥ", meaning: "other than You" },
    { word: "पाणिभ्याम्", transliteration: "pāṇibhyām", meaning: "with (two) hands" },
    { word: "अभय-वरदः", transliteration: "abhaya-varadaḥ", meaning: "showing protection and boon-giving" },
    { word: "दैवत-गणः", transliteration: "daivata-gaṇaḥ", meaning: "the host of gods" },
    { word: "त्वम् एका", transliteration: "tvam ekā", meaning: "You alone" },
    { word: "न एव असि", transliteration: "na eva asi", meaning: "do not" },
    { word: "प्रकटित-वर-अभीति-अभिनया", transliteration: "prakaṭita-vara-abhīti-abhinayā", meaning: "displaying the gestures of boon and fearlessness" },
    { word: "भयात् त्रातुं", transliteration: "bhayāt trātuṃ", meaning: "to protect from fear" },
    { word: "दातुं", transliteration: "dātuṃ", meaning: "to give" },
    { word: "फलम् अपि", transliteration: "phalam api", meaning: "fruit/reward also" },
    { word: "वाञ्छा-समधिकं", transliteration: "vāñchā-samadhikaṃ", meaning: "exceeding desires" },
    { word: "शरण्ये लोकानां", transliteration: "śaraṇye lokānāṃ", meaning: "O refuge of the worlds" },
    { word: "तव", transliteration: "tava", meaning: "Your" },
    { word: "चरणौ एव", transliteration: "caraṇau eva", meaning: "feet alone" },
    { word: "निपुणौ", transliteration: "nipuṇau", meaning: "are supremely capable" }
  ];

  W[5] = [
    { word: "हरिः", transliteration: "hariḥ", meaning: "Vishnu" },
    { word: "त्वाम् आराध्य", transliteration: "tvām ārādhya", meaning: "having worshipped You" },
    { word: "प्रणत-जन-सौभाग्य-जननीं", transliteration: "praṇata-jana-saubhāgya-jananīṃ", meaning: "bestower of fortune on devotees" },
    { word: "पुरा", transliteration: "purā", meaning: "once/long ago" },
    { word: "नारी भूत्वा", transliteration: "nārī bhūtvā", meaning: "having become a woman" },
    { word: "पुर-रिपुम् अपि", transliteration: "pura-ripum api", meaning: "even the enemy of cities (Shiva)" },
    { word: "क्षोभम् अनयत्", transliteration: "kṣobham anayat", meaning: "agitated/disturbed" },
    { word: "स्मरः अपि", transliteration: "smaraḥ api", meaning: "Kamadeva also" },
    { word: "त्वां नत्वा", transliteration: "tvāṃ natvā", meaning: "having bowed to You" },
    { word: "रति-नयन-लेह्येन वपुषा", transliteration: "rati-nayana-lehyena vapuṣā", meaning: "with a form pleasing to Rati's eyes" },
    { word: "मुनीनाम् अपि", transliteration: "munīnām api", meaning: "even of sages" },
    { word: "अन्तः", transliteration: "antaḥ", meaning: "within" },
    { word: "प्रभवति", transliteration: "prabhavati", meaning: "is able" },
    { word: "मोहाय", transliteration: "mohāya", meaning: "to delude" },
    { word: "महताम्", transliteration: "mahatām", meaning: "the great ones" }
  ];

  W[6] = [
    { word: "धनुः पौष्पं", transliteration: "dhanuḥ pauṣpaṃ", meaning: "a bow of flowers" },
    { word: "मौर्वी मधुकरमयी", transliteration: "maurvī madhukaramayī", meaning: "bowstring made of bees" },
    { word: "पञ्च विशिखाः", transliteration: "pañca viśikhāḥ", meaning: "five arrows" },
    { word: "वसन्तः सामन्तः", transliteration: "vasantaḥ sāmantaḥ", meaning: "Spring as his ally" },
    { word: "मलय-मरुत्", transliteration: "malaya-marut", meaning: "the Malaya breeze" },
    { word: "आयोधन-रथः", transliteration: "āyodhana-rathaḥ", meaning: "battle chariot" },
    { word: "तथा अपि", transliteration: "tathā api", meaning: "even so" },
    { word: "एकः", transliteration: "ekaḥ", meaning: "alone" },
    { word: "सर्वं", transliteration: "sarvaṃ", meaning: "everything" },
    { word: "हिमगिरि-सुते", transliteration: "himagiri-sute", meaning: "O daughter of the snow mountain" },
    { word: "काम् अपि कृपां", transliteration: "kām api kṛpāṃ", meaning: "some inexplicable grace" },
    { word: "अपाङ्गात् ते लब्ध्वा", transliteration: "apāṅgāt te labdhvā", meaning: "having obtained from Your sidelong glance" },
    { word: "जगत् इदम्", transliteration: "jagat idam", meaning: "this world" },
    { word: "अनङ्गः", transliteration: "anaṅgaḥ", meaning: "the bodiless one (Kama)" },
    { word: "विजयते", transliteration: "vijayate", meaning: "conquers" }
  ];

  W[7] = [
    { word: "क्वणत्-काञ्ची-दामा", transliteration: "kvaṇat-kāñcī-dāmā", meaning: "wearing a jingling golden girdle" },
    { word: "करि-कलभ-कुम्भ-स्तन-नता", transliteration: "kari-kalabha-kumbha-stana-natā", meaning: "bent by breasts rivaling young elephant's frontal globes" },
    { word: "परिक्षीणा मध्ये", transliteration: "parikṣīṇā madhye", meaning: "slender at the waist" },
    { word: "परिणत-शरत्-चन्द्र-वदना", transliteration: "pariṇata-śarat-candra-vadanā", meaning: "face like the autumn full moon" },
    { word: "धनुः-बाणान्", transliteration: "dhanuḥ-bāṇān", meaning: "bow and arrows" },
    { word: "पाशं", transliteration: "pāśaṃ", meaning: "noose" },
    { word: "सृणिम् अपि", transliteration: "sṛṇim api", meaning: "and goad" },
    { word: "दधाना करतलैः", transliteration: "dadhānā karatalaiḥ", meaning: "holding in Her hands" },
    { word: "पुरस्तात् आस्तां नः", transliteration: "purastāt āstāṃ naḥ", meaning: "may She stand before us" },
    { word: "पुर-मथितुः", transliteration: "pura-mathituḥ", meaning: "of the destroyer of cities (Shiva)" },
    { word: "आहो-पुरुषिका", transliteration: "āho-puruṣikā", meaning: "the pride/beloved" }
  ];

  W[8] = [
    { word: "सुधा-सिन्धोः मध्ये", transliteration: "sudhā-sindhoḥ madhye", meaning: "in the middle of the ocean of nectar" },
    { word: "सुर-विटपि-वाटी-परिवृते", transliteration: "sura-viṭapi-vāṭī-parivṛte", meaning: "surrounded by groves of wish-fulfilling trees" },
    { word: "मणि-द्वीपे", transliteration: "maṇi-dvīpe", meaning: "on the island of gems" },
    { word: "नीप-उपवनवति", transliteration: "nīpa-upavanavati", meaning: "with Kadamba groves" },
    { word: "चिन्तामणि-गृहे", transliteration: "cintāmaṇi-gṛhe", meaning: "in the Chintamani palace" },
    { word: "शिव-आकारे मञ्चे", transliteration: "śiva-ākāre mañce", meaning: "upon a couch in the form of Shiva" },
    { word: "परम-शिव-पर्यङ्क-निलयां", transliteration: "parama-śiva-paryaṅka-nilayāṃ", meaning: "reclining on Paramashiva as the bed" },
    { word: "भजन्ति त्वां", transliteration: "bhajanti tvāṃ", meaning: "worship You" },
    { word: "धन्याः कतिचन", transliteration: "dhanyāḥ katicana", meaning: "a few blessed ones" },
    { word: "चित्-आनन्द-लहरीम्", transliteration: "cit-ānanda-laharīm", meaning: "the wave of consciousness-bliss" }
  ];

  W[9] = [
    { word: "महीं", transliteration: "mahīṃ", meaning: "earth element" },
    { word: "मूलाधारे", transliteration: "mūlādhāre", meaning: "in the Muladhara" },
    { word: "कम् अपि", transliteration: "kam api", meaning: "indescribable" },
    { word: "मणिपूरे", transliteration: "maṇipūre", meaning: "in Manipura" },
    { word: "हुतवहं", transliteration: "hutavahaṃ", meaning: "fire" },
    { word: "स्थितं स्वाधिष्ठाने", transliteration: "sthitaṃ svādhiṣṭhāne", meaning: "situated in Svadhishthana" },
    { word: "हृदि", transliteration: "hṛdi", meaning: "in the heart" },
    { word: "मरुतम्", transliteration: "marutam", meaning: "air element" },
    { word: "आकाशम् उपरि", transliteration: "ākāśam upari", meaning: "ether above" },
    { word: "मनः अपि", transliteration: "manaḥ api", meaning: "mind also" },
    { word: "भ्रू-मध्ये", transliteration: "bhrū-madhye", meaning: "between the eyebrows" },
    { word: "सकलम् अपि भित्त्वा", transliteration: "sakalam api bhittvā", meaning: "piercing through all" },
    { word: "कुल-पथं", transliteration: "kula-pathaṃ", meaning: "the Kula path (Sushumna)" },
    { word: "सहस्रारे पद्मे", transliteration: "sahasrāre padme", meaning: "in the thousand-petalled lotus" },
    { word: "सह रहसि", transliteration: "saha rahasi", meaning: "secretly together" },
    { word: "पत्या", transliteration: "patyā", meaning: "with Your Lord" },
    { word: "विहरसि", transliteration: "viharasi", meaning: "You sport" }
  ];

  W[10] = [
    { word: "सुधा-धारा-सारैः", transliteration: "sudhā-dhārā-sāraiḥ", meaning: "with streams of nectar" },
    { word: "चरण-युगल-अन्तर्-विगलितैः", transliteration: "caraṇa-yugala-antar-vigalitaiḥ", meaning: "flowing from between Your feet" },
    { word: "प्रपञ्चं सिञ्चन्ती", transliteration: "prapañcaṃ siñcantī", meaning: "showering the universe" },
    { word: "पुनर् अपि", transliteration: "punar api", meaning: "again" },
    { word: "रस-आम्नाय-महसः", transliteration: "rasa-āmnāya-mahasaḥ", meaning: "the splendor of the Rasa tradition" },
    { word: "अवाप्य स्वां भूमिं", transliteration: "avāpya svāṃ bhūmiṃ", meaning: "reaching Your own abode" },
    { word: "भुजग-निभम्", transliteration: "bhujaga-nibham", meaning: "like a serpent" },
    { word: "अध्युष्ट-वलयं", transliteration: "adhyuṣṭa-valayaṃ", meaning: "coiled three-and-a-half times" },
    { word: "स्वम् आत्मानं कृत्वा", transliteration: "svam ātmānaṃ kṛtvā", meaning: "making Yourself" },
    { word: "स्वपिषि", transliteration: "svapiṣi", meaning: "You sleep" },
    { word: "कुल-कुण्डे कुहरिणि", transliteration: "kula-kuṇḍe kuhariṇi", meaning: "in the hollow of the Kula-Kunda" }
  ];

  W[11] = [
    { word: "चतुर्भिः", transliteration: "caturbhiḥ", meaning: "with four" },
    { word: "श्रीकण्ठैः", transliteration: "śrīkaṇṭhaiḥ", meaning: "Shiva-triangles" },
    { word: "शिव-युवतिभिः पञ्चभिः अपि", transliteration: "śiva-yuvatibhiḥ pañcabhiḥ api", meaning: "and with five Shakti-triangles" },
    { word: "प्रभिन्नाभिः", transliteration: "prabhinnābhiḥ", meaning: "distinctly formed" },
    { word: "शम्भोः नवभिः अपि", transliteration: "śambhoḥ navabhiḥ api", meaning: "from Shambhu's nine" },
    { word: "मूल-प्रकृतिभिः", transliteration: "mūla-prakṛtibhiḥ", meaning: "root-natures (Mula-Prakritis)" },
    { word: "चतुश्चत्वारिंशत्", transliteration: "catuścatvāriṃśat", meaning: "forty-four" },
    { word: "वसु-दल-कला", transliteration: "vasu-dala-kalā", meaning: "eight-petalled and sixteen-petalled lotuses" },
    { word: "त्रि-वलय", transliteration: "tri-valaya", meaning: "three circles" },
    { word: "त्रि-रेखाभिः सार्धं", transliteration: "tri-rekhābhiḥ sārdhaṃ", meaning: "together with three lines" },
    { word: "तव", transliteration: "tava", meaning: "Your" },
    { word: "शरण-कोणाः", transliteration: "śaraṇa-koṇāḥ", meaning: "abode-angles (Sri Chakra)" },
    { word: "परिणताः", transliteration: "pariṇatāḥ", meaning: "are formed" }
  ];

  W[12] = [
    { word: "त्वदीयं", transliteration: "tvadīyaṃ", meaning: "Your" },
    { word: "सौन्दर्यं", transliteration: "saundaryaṃ", meaning: "beauty" },
    { word: "तुहिन-गिरि-कन्ये", transliteration: "tuhina-giri-kanye", meaning: "O daughter of the snow mountain" },
    { word: "तुलयितुं", transliteration: "tulayituṃ", meaning: "to describe/compare" },
    { word: "कवि-इन्द्राः", transliteration: "kavi-indrāḥ", meaning: "the greatest poets" },
    { word: "कल्पन्ते", transliteration: "kalpante", meaning: "strive" },
    { word: "कथम् अपि", transliteration: "katham api", meaning: "with great difficulty" },
    { word: "विरिञ्चि-प्रभृतयः", transliteration: "viriñci-prabhṛtayaḥ", meaning: "Brahma and others" },
    { word: "यत्-आलोक-औत्सुक्यात्", transliteration: "yat-āloka-autsūkyāt", meaning: "from eagerness to behold which" },
    { word: "अमर-ललनाः", transliteration: "amara-lalanāḥ", meaning: "celestial women" },
    { word: "यान्ति मनसा", transliteration: "yānti manasā", meaning: "mentally attain" },
    { word: "तपोभिः दुष्प्रापाम् अपि", transliteration: "tapobhiḥ duṣprāpām api", meaning: "even difficult through penance" },
    { word: "गिरिश-सायुज्य-पदवीम्", transliteration: "giriśa-sāyujya-padavīm", meaning: "the state of union with Shiva" }
  ];

  W[13] = [
    { word: "नरं", transliteration: "naraṃ", meaning: "a man" },
    { word: "वर्षीयांसं", transliteration: "varṣīyāṃsaṃ", meaning: "old/aged" },
    { word: "नयन-विरसं", transliteration: "nayana-virasaṃ", meaning: "unattractive to the eyes" },
    { word: "नर्मसु जडं", transliteration: "narmasu jaḍaṃ", meaning: "dull in ways of love" },
    { word: "तव अपाङ्ग-आलोके", transliteration: "tava apāṅga-āloke", meaning: "upon whom Your sidelong glance" },
    { word: "पतितम्", transliteration: "patitam", meaning: "falls" },
    { word: "अनुधावन्ति शतशः", transliteration: "anudhāvanti śataśaḥ", meaning: "chase by the hundreds" },
    { word: "गलत्-वेणी-बन्धाः", transliteration: "galat-veṇī-bandhāḥ", meaning: "with loosening braids" },
    { word: "कुच-कलश-विस्रस्त-सिचया", transliteration: "kuca-kalaśa-visrasta-sicayā", meaning: "garments slipping from pitcher-like breasts" },
    { word: "हठात् त्रुट्यत्-काञ्च्यः", transliteration: "haṭhāt truṭyat-kāñcyaḥ", meaning: "girdles snapping forcefully" },
    { word: "विगलित-दुकूलाः", transliteration: "vigalita-dukūlāḥ", meaning: "with loosened garments" },
    { word: "युवतयः", transliteration: "yuvatayaḥ", meaning: "young women" }
  ];

  W[14] = [
    { word: "क्षितौ", transliteration: "kṣitau", meaning: "in earth" },
    { word: "षट्-पञ्चाशत्", transliteration: "ṣaṭ-pañcāśat", meaning: "fifty-six" },
    { word: "द्वि-सम-अधिक-पञ्चाशत्", transliteration: "dvi-sama-adhika-pañcāśat", meaning: "fifty-two" },
    { word: "उदके", transliteration: "udake", meaning: "in water" },
    { word: "हुताशे", transliteration: "hutāśe", meaning: "in fire" },
    { word: "द्वा-षष्टिः", transliteration: "dvā-ṣaṣṭiḥ", meaning: "sixty-two" },
    { word: "चतुर्-अधिक-पञ्चाशत्", transliteration: "catur-adhika-pañcāśat", meaning: "fifty-four" },
    { word: "अनिले", transliteration: "anile", meaning: "in air" },
    { word: "दिवि", transliteration: "divi", meaning: "in ether/sky" },
    { word: "द्विष्-षट्-त्रिंशत्", transliteration: "dviṣ-ṣaṭ-triṃśat", meaning: "seventy-two" },
    { word: "मनसि च", transliteration: "manasi ca", meaning: "and in the mind" },
    { word: "चतुष्-षष्टिः", transliteration: "catuṣ-ṣaṣṭiḥ", meaning: "sixty-four" },
    { word: "इति ये मयूखाः", transliteration: "iti ye mayūkhāḥ", meaning: "thus these rays" },
    { word: "तेषाम् अपि उपरि", transliteration: "teṣām api upari", meaning: "above even these" },
    { word: "तव पाद-अम्बुज-युगम्", transliteration: "tava pāda-ambuja-yugam", meaning: "Your pair of lotus feet" }
  ];

  W[15] = [
    { word: "शरत्-ज्योत्स्ना-शुद्धां", transliteration: "śarat-jyotsnā-śuddhāṃ", meaning: "pure as autumn moonlight" },
    { word: "शशि-युत-जटा-जूट-मकुटां", transliteration: "śaśi-yuta-jaṭā-jūṭa-makuṭāṃ", meaning: "crowned with matted locks and crescent moon" },
    { word: "वर-त्रास-त्राण", transliteration: "vara-trāsa-trāṇa", meaning: "boon-giving and fear-dispelling (mudras)" },
    { word: "स्फटिक-घटिका", transliteration: "sphaṭika-ghaṭikā", meaning: "crystal rosary" },
    { word: "पुस्तक-कराम्", transliteration: "pustaka-karām", meaning: "book in hand" },
    { word: "सकृत् न त्वा नत्वा", transliteration: "sakṛt na tvā natvā", meaning: "without bowing to You even once" },
    { word: "कथम् इव", transliteration: "katham iva", meaning: "how indeed" },
    { word: "सतां", transliteration: "satāṃ", meaning: "of the blessed" },
    { word: "सन्निदधते", transliteration: "sannidadhate", meaning: "are produced" },
    { word: "मधु-क्षीर-द्राक्षा", transliteration: "madhu-kṣīra-drākṣā", meaning: "honey, milk, and grapes" },
    { word: "मधुरिम-धुरीणाः", transliteration: "madhurima-dhurīṇāḥ", meaning: "surpassing in sweetness" },
    { word: "फणितयः", transliteration: "phaṇitayaḥ", meaning: "utterances/speech" }
  ];

  W[16] = [
    { word: "कवि-इन्द्राणां", transliteration: "kavi-indrāṇāṃ", meaning: "of the greatest poets" },
    { word: "चेतः-कमल-वन", transliteration: "cetaḥ-kamala-vana", meaning: "lotus-garden of hearts" },
    { word: "बाल-आतप-रुचिं", transliteration: "bāla-ātapa-ruciṃ", meaning: "radiance of the rising sun" },
    { word: "भजन्ते ये सन्तः", transliteration: "bhajante ye santaḥ", meaning: "those blessed ones who worship" },
    { word: "कतिचित्", transliteration: "katicid", meaning: "some few" },
    { word: "अरुणाम् एव भवतीम्", transliteration: "aruṇām eva bhavatīm", meaning: "You in Your crimson form" },
    { word: "विरिञ्चि-प्रेयस्याः", transliteration: "viriñci-preyasyāḥ", meaning: "of Brahma's beloved (Saraswati)" },
    { word: "तरुण-तर-शृङ्गार-लहरी", transliteration: "taruṇa-tara-śṛṅgāra-laharī", meaning: "waves of youthful romantic sentiment" },
    { word: "गभीराभिः वाग्भिः", transliteration: "gabhīrābhiḥ vāgbhiḥ", meaning: "with profound words" },
    { word: "विदधति", transliteration: "vidadhati", meaning: "they create" },
    { word: "सतां रञ्जनम्", transliteration: "satāṃ rañjanam", meaning: "delight of the wise" },
    { word: "अमी", transliteration: "amī", meaning: "these (poets)" }
  ];

  W[17] = [
    { word: "सवित्रीभिः वाचां", transliteration: "savitrībhiḥ vācāṃ", meaning: "with the mother-goddesses of speech" },
    { word: "शशि-मणि-शिला-भङ्ग-रुचिभिः", transliteration: "śaśi-maṇi-śilā-bhaṅga-rucibhiḥ", meaning: "with lustre like breaking moonstone" },
    { word: "वशिन्य्-आद्याभिः", transliteration: "vaśiny-ādyābhiḥ", meaning: "Vashini and others" },
    { word: "त्वां सह", transliteration: "tvāṃ saha", meaning: "You together with" },
    { word: "जननि", transliteration: "janani", meaning: "O Mother" },
    { word: "सञ्चिन्तयति यः", transliteration: "sañcintayati yaḥ", meaning: "one who meditates" },
    { word: "स कर्ता काव्यानां", transliteration: "sa kartā kāvyānāṃ", meaning: "he becomes a composer of poetry" },
    { word: "भवति महतां", transliteration: "bhavati mahatāṃ", meaning: "becomes among the great" },
    { word: "भङ्गि-रुचिभिः वचोभिः", transliteration: "bhaṅgi-rucibhiḥ vacobhiḥ", meaning: "with beautifully turned words" },
    { word: "वाग्-देवी-वदन-कमल-आमोद-मधुरैः", transliteration: "vāg-devī-vadana-kamala-āmoda-madhuraiḥ", meaning: "sweet as fragrance of Saraswati's lotus-face" }
  ];

  W[18] = [
    { word: "तनु-छायाभिः ते", transliteration: "tanu-chāyābhiḥ te", meaning: "by Your body's radiance" },
    { word: "तरुण-तरणि-श्री-सरणिभिः", transliteration: "taruṇa-taraṇi-śrī-saraṇibhiḥ", meaning: "like the rising sun's splendor" },
    { word: "दिवं सर्वाम् उर्वीम्", transliteration: "divaṃ sarvām urvīm", meaning: "the sky and entire earth" },
    { word: "अरुणिमनि मग्नां", transliteration: "aruṇimani magnāṃ", meaning: "immersed in crimson hue" },
    { word: "स्मरति यः", transliteration: "smarati yaḥ", meaning: "one who meditates" },
    { word: "भवन्ति अस्य", transliteration: "bhavanti asya", meaning: "become his" },
    { word: "त्रस्यत्-वन-हरिण-शालीन-नयनाः", transliteration: "trasyat-vana-hariṇa-śālīna-nayanāḥ", meaning: "with eyes shy as a startled forest deer" },
    { word: "सह उर्वश्या वश्याः", transliteration: "saha urvaśyā vaśyāḥ", meaning: "subservient along with Urvashi" },
    { word: "कति कति न", transliteration: "kati kati na", meaning: "how many countless" },
    { word: "गीर्वाण-गणिकाः", transliteration: "gīrvāṇa-gaṇikāḥ", meaning: "celestial damsels" }
  ];

  W[19] = [
    { word: "मुखं बिन्दुं कृत्वा", transliteration: "mukhaṃ binduṃ kṛtvā", meaning: "making the face as the Bindu point" },
    { word: "कुच-युगम् अधः तस्य", transliteration: "kuca-yugam adhaḥ tasya", meaning: "the two breasts below that" },
    { word: "तत् अधः", transliteration: "tat adhaḥ", meaning: "below that" },
    { word: "हर-अर्धं", transliteration: "hara-ardhaṃ", meaning: "the half of Hara (inverted triangle)" },
    { word: "ध्यायेत् यः", transliteration: "dhyāyet yaḥ", meaning: "one who meditates" },
    { word: "हर-महिषि", transliteration: "hara-mahiṣi", meaning: "O Consort of Shiva" },
    { word: "ते मन्मथ-कलाम्", transliteration: "te manmatha-kalām", meaning: "Your Kama-Kala form" },
    { word: "स सद्यः", transliteration: "sa sadyaḥ", meaning: "he instantly" },
    { word: "संक्षोभं नयति", transliteration: "saṃkṣobhaṃ nayati", meaning: "agitates/enchants" },
    { word: "वनिताः", transliteration: "vanitāḥ", meaning: "women" },
    { word: "इति अतिलघु", transliteration: "iti atilaghu", meaning: "this is a small thing" },
    { word: "त्रिलोकीम् अपि आशु", transliteration: "trilokīm api āśu", meaning: "even the three worlds swiftly" },
    { word: "भ्रमयति", transliteration: "bhramayati", meaning: "captivates/spins" },
    { word: "रवि-इन्दु-स्तन-युगाम्", transliteration: "ravi-indu-stana-yugām", meaning: "with Sun and Moon as breasts" }
  ];

  W[20] = [
    { word: "किरन्तीम् अङ्गेभ्यः", transliteration: "kirantīm aṅgebhyaḥ", meaning: "radiating from all limbs" },
    { word: "किरण-निकुरुम्ब-अमृत-रसं", transliteration: "kiraṇa-nikurumba-amṛta-rasaṃ", meaning: "clusters of nectar-rays" },
    { word: "हृदि त्वाम् आधत्ते", transliteration: "hṛdi tvām ādhatte", meaning: "holds You in the heart" },
    { word: "हिमकर-शिला-मूर्तिम् इव यः", transliteration: "himakara-śilā-mūrtim iva yaḥ", meaning: "like a moonstone idol, one who" },
    { word: "स सर्पाणां दर्पं", transliteration: "sa sarpāṇāṃ darpaṃ", meaning: "he the pride of serpents" },
    { word: "शमयति", transliteration: "śamayati", meaning: "subdues" },
    { word: "शकुन्त-अधिपतिवत्", transliteration: "śakunta-adhipativat", meaning: "like Garuda (king of birds)" },
    { word: "ज्वर-प्लुष्टान्", transliteration: "jvara-pluṣṭān", meaning: "those scorched by fever" },
    { word: "दृष्ट्या सुखयति", transliteration: "dṛṣṭyā sukhayati", meaning: "comforts with his gaze" },
    { word: "सुधा-धार-सिरया", transliteration: "sudhā-dhāra-sirayā", meaning: "with a stream of nectar" }
  ];

  W[21] = [
    { word: "तटित्-लेखा-तन्वीं", transliteration: "taṭit-lekhā-tanvīṃ", meaning: "slender as a streak of lightning" },
    { word: "तपन-शशि-वैश्वानर-मयीं", transliteration: "tapana-śaśi-vaiśvānara-mayīṃ", meaning: "composed of Sun, Moon, and Fire" },
    { word: "निषण्णां", transliteration: "niṣaṇṇāṃ", meaning: "seated" },
    { word: "षण्णाम् अपि उपरि", transliteration: "ṣaṇṇām api upari", meaning: "above the six" },
    { word: "कमलानां", transliteration: "kamalānāṃ", meaning: "lotuses (chakras)" },
    { word: "तव कलाम्", transliteration: "tava kalām", meaning: "Your form/digit" },
    { word: "महा-पद्म-अटव्यां", transliteration: "mahā-padma-aṭavyāṃ", meaning: "in the great lotus-forest (Sahasrara)" },
    { word: "मृदित-मल-मायेन मनसा", transliteration: "mṛdita-mala-māyena manasā", meaning: "with mind purified of Maya's impurity" },
    { word: "महान्तः पश्यन्तः", transliteration: "mahāntaḥ paśyantaḥ", meaning: "the great ones who behold" },
    { word: "दधति", transliteration: "dadhati", meaning: "they experience" },
    { word: "परम-आह्लाद-लहरीम्", transliteration: "parama-āhlāda-laharīm", meaning: "the supreme wave of bliss" }
  ];

  W[22] = [
    { word: "भवानि त्वं", transliteration: "bhavāni tvaṃ", meaning: "O Bhavani, You" },
    { word: "दासे मयि", transliteration: "dāse mayi", meaning: "upon me, Your servant" },
    { word: "वितर दृष्टिं सकरुणां", transliteration: "vitara dṛṣṭiṃ sakaruṇāṃ", meaning: "bestow a compassionate glance" },
    { word: "इति स्तोतुं वाञ्छन्", transliteration: "iti stotuṃ vāñchan", meaning: "intending to pray thus" },
    { word: "कथयति", transliteration: "kathayati", meaning: "utters" },
    { word: "भवानि त्वम् इति यः", transliteration: "bhavāni tvam iti yaḥ", meaning: "'Bhavani, You' — one who" },
    { word: "तदा एव", transliteration: "tadā eva", meaning: "at that very moment" },
    { word: "त्वं तस्मै दिशसि", transliteration: "tvaṃ tasmai diśasi", meaning: "You grant to him" },
    { word: "निज-सायुज्य-पदवीं", transliteration: "nija-sāyujya-padavīṃ", meaning: "Your own state of union" },
    { word: "मुकुन्द-ब्रह्म-इन्द्र", transliteration: "mukunda-brahma-indra", meaning: "Vishnu, Brahma, Indra" },
    { word: "स्फुट-मकुट-नीराजित-पदाम्", transliteration: "sphuṭa-makuṭa-nīrājita-padām", meaning: "whose feet are worshipped with their sparkling crowns" }
  ];

  W[23] = [
    { word: "त्वया हृत्वा", transliteration: "tvayā hṛtvā", meaning: "having taken by You" },
    { word: "वामं वपुः", transliteration: "vāmaṃ vapuḥ", meaning: "the left body/half" },
    { word: "अपरितृप्तेन मनसा", transliteration: "aparitṛptena manasā", meaning: "with unsatisfied mind" },
    { word: "शरीर-अर्धं शम्भोः", transliteration: "śarīra-ardhaṃ śambhoḥ", meaning: "the other half of Shambhu's body" },
    { word: "अपरम् अपि", transliteration: "aparam api", meaning: "the other also" },
    { word: "शङ्के हृतम् अभूत्", transliteration: "śaṅke hṛtam abhūt", meaning: "I suspect was taken" },
    { word: "यत् एतत् त्वत्-रूपं", transliteration: "yat etat tvat-rūpaṃ", meaning: "for this form of Yours" },
    { word: "सकलम् अरुणाभं", transliteration: "sakalam aruṇābhaṃ", meaning: "is entirely crimson" },
    { word: "त्रि-नयनं", transliteration: "tri-nayanaṃ", meaning: "three-eyed" },
    { word: "कुचाभ्याम् आनम्रं", transliteration: "kucābhyām ānamraṃ", meaning: "bent by the weight of breasts" },
    { word: "कुटिल-शशि-चूडाल-मकुटम्", transliteration: "kuṭila-śaśi-cūḍāla-makuṭam", meaning: "crowned with the crescent moon" }
  ];

  W[24] = [
    { word: "जगत् सूते", transliteration: "jagat sūte", meaning: "creates the world" },
    { word: "धाता", transliteration: "dhātā", meaning: "Brahma" },
    { word: "हरिः अवति", transliteration: "hariḥ avati", meaning: "Vishnu sustains" },
    { word: "रुद्रः क्षपयते", transliteration: "rudraḥ kṣapayate", meaning: "Rudra destroys" },
    { word: "तिरस्कुर्वन् एतत्", transliteration: "tiraskurvan etat", meaning: "concealing this" },
    { word: "स्वम् अपि वपुः", transliteration: "svam api vapuḥ", meaning: "even His own form" },
    { word: "ईशः तिरयति", transliteration: "īśaḥ tirayati", meaning: "Ishvara conceals" },
    { word: "सदा-पूर्वः", transliteration: "sadā-pūrvaḥ", meaning: "ever-prior (Sadashiva)" },
    { word: "सर्वं तत् इदम्", transliteration: "sarvaṃ tat idam", meaning: "all this" },
    { word: "अनुगृह्णाति च शिवः", transliteration: "anugṛhṇāti ca śivaḥ", meaning: "Shiva graces" },
    { word: "तव आज्ञाम् आलम्ब्य", transliteration: "tava ājñām ālambya", meaning: "depending on Your command" },
    { word: "क्षण-चलितयोः", transliteration: "kṣaṇa-calitayoḥ", meaning: "momentarily moved" },
    { word: "भ्रू-लतिकयोः", transliteration: "bhrū-latikayoḥ", meaning: "of Your eyebrow-creepers" }
  ];

  W[25] = [
    { word: "त्रयाणां देवानां", transliteration: "trayāṇāṃ devānāṃ", meaning: "of the three gods" },
    { word: "त्रि-गुण-जनितानां", transliteration: "tri-guṇa-janitānāṃ", meaning: "born of the three Gunas" },
    { word: "तव शिवे", transliteration: "tava śive", meaning: "O Shive, Your" },
    { word: "भवेत् पूजा", transliteration: "bhavet pūjā", meaning: "becomes worship" },
    { word: "पूजा तव चरणयोः", transliteration: "pūjā tava caraṇayoḥ", meaning: "worship of Your feet" },
    { word: "या विरचिता", transliteration: "yā viracitā", meaning: "which is performed" },
    { word: "तथा हि", transliteration: "tathā hi", meaning: "for indeed" },
    { word: "त्वत्-पाद-उद्वहन-मणि-पीठस्य", transliteration: "tvat-pāda-udvahana-maṇi-pīṭhasya", meaning: "of the gem-studded footstool bearing Your feet" },
    { word: "निकटे स्थिताः", transliteration: "nikaṭe sthitāḥ", meaning: "standing near" },
    { word: "हि एते शश्वत्", transliteration: "hi ete śaśvat", meaning: "indeed these always" },
    { word: "मुकुलित-कर-उत्तंस-मकुटाः", transliteration: "mukulita-kara-uttaṃsa-makuṭāḥ", meaning: "with folded hands and crowned heads bowed" }
  ];

  W[26] = [
    { word: "विरिञ्चिः", transliteration: "viriñciḥ", meaning: "Brahma" },
    { word: "पञ्चत्वं व्रजति", transliteration: "pañcatvaṃ vrajati", meaning: "meets destruction" },
    { word: "हरिः आप्नोति विरतिं", transliteration: "hariḥ āpnoti viratiṃ", meaning: "Vishnu attains cessation" },
    { word: "विनाशं", transliteration: "vināśaṃ", meaning: "destruction" },
    { word: "कीनाशः भजति", transliteration: "kīnāśaḥ bhajati", meaning: "Yama (Death) meets" },
    { word: "धनदः याति निधनम्", transliteration: "dhanadaḥ yāti nidhanam", meaning: "Kubera meets his end" },
    { word: "वितन्द्री", transliteration: "vitandrī", meaning: "without lethargy" },
    { word: "माहेन्द्री विततिः अपि", transliteration: "māhendrī vitatiḥ api", meaning: "even Indra's vast retinue" },
    { word: "संमीलित-दृशा", transliteration: "saṃmīlita-dṛśā", meaning: "with eyes closed" },
    { word: "महा-संहारे अस्मिन्", transliteration: "mahā-saṃhāre asmin", meaning: "in this great dissolution" },
    { word: "विहरति", transliteration: "viharati", meaning: "sports" },
    { word: "सति", transliteration: "sati", meaning: "O Sati" },
    { word: "त्वत्-पतिः असौ", transliteration: "tvat-patiḥ asau", meaning: "Your Lord alone" }
  ];

  W[27] = [
    { word: "जपः जल्पः", transliteration: "japaḥ jalpaḥ", meaning: "my speech is Japa (chanting)" },
    { word: "शिल्पं सकलम् अपि", transliteration: "śilpaṃ sakalam api", meaning: "all hand-work too" },
    { word: "मुद्रा-विरचना", transliteration: "mudrā-viracanā", meaning: "is Your Mudra (sacred gesture)" },
    { word: "गतिः प्रादक्षिण्य-क्रमणम्", transliteration: "gatiḥ prādakṣiṇya-kramaṇam", meaning: "walking is Your Pradakshina" },
    { word: "अशन-आदि", transliteration: "aśana-ādi", meaning: "eating and such" },
    { word: "आहुति-विधिः", transliteration: "āhuti-vidhiḥ", meaning: "is the Homa offering ritual" },
    { word: "प्रणामः संवेशः", transliteration: "praṇāmaḥ saṃveśaḥ", meaning: "lying down is Your Pranama" },
    { word: "सुखम् अखिलम्", transliteration: "sukham akhilam", meaning: "all enjoyment" },
    { word: "आत्म-अर्पण-दृशा", transliteration: "ātma-arpaṇa-dṛśā", meaning: "with the vision of self-offering" },
    { word: "सपर्या-पर्यायः", transliteration: "saparyā-paryāyaḥ", meaning: "synonymous with worship" },
    { word: "तव भवतु", transliteration: "tava bhavatu", meaning: "may it become Yours" },
    { word: "यत् मे विलसितम्", transliteration: "yat me vilasitam", meaning: "whatever I do" }
  ];

  W[28] = [
    { word: "सुधाम् अपि आस्वाद्य", transliteration: "sudhām api āsvādya", meaning: "even having tasted nectar (Amrita)" },
    { word: "प्रति-भय-जरा-मृत्यु-हरिणीं", transliteration: "prati-bhaya-jarā-mṛtyu-hariṇīṃ", meaning: "which removes the fear of old age and death" },
    { word: "विपद्यन्ते विश्वे", transliteration: "vipadyante viśve", meaning: "perish universally" },
    { word: "विधि-शत-मख-आद्याः", transliteration: "vidhi-śata-makha-ādyāḥ", meaning: "Brahma, Indra, and other" },
    { word: "दिविषदः", transliteration: "diviṣadaḥ", meaning: "gods/celestials" },
    { word: "करालं यत् क्ष्वेलं", transliteration: "karālaṃ yat kṣvelaṃ", meaning: "the terrible poison which" },
    { word: "कबलितवतः", transliteration: "kabalitavataḥ", meaning: "having swallowed" },
    { word: "काल-कलना न", transliteration: "kāla-kalanā na", meaning: "not subject to Time's reckoning" },
    { word: "शम्भोः तत्-मूलं", transliteration: "śambhoḥ tat-mūlaṃ", meaning: "of Shambhu, the root cause" },
    { word: "तव जननि", transliteration: "tava janani", meaning: "O Mother, is Your" },
    { word: "ताटङ्क-महिमा", transliteration: "tāṭaṅka-mahimā", meaning: "glory of the earrings" }
  ];

  W[29] = [
    { word: "किरीटं वैरिञ्चं", transliteration: "kirīṭaṃ vairiñcaṃ", meaning: "Brahma's crown" },
    { word: "परिहर", transliteration: "parihara", meaning: "move aside" },
    { word: "पुरः कैटभ-भिदः", transliteration: "puraḥ kaiṭabha-bhidaḥ", meaning: "before Vishnu's (slayer of Kaitabha)" },
    { word: "कठोरे कोटीरे स्खलसि", transliteration: "kaṭhore koṭīre skhalasi", meaning: "you stumble on the hard diadem" },
    { word: "जहि जम्भारि-मकुटम्", transliteration: "jahi jambhāri-makuṭam", meaning: "push away Indra's crown" },
    { word: "प्रणम्रेषु एतेषु", transliteration: "praṇamreṣu eteṣu", meaning: "when these bow down" },
    { word: "प्रसभम् उपयातस्य", transliteration: "prasabham upayātasya", meaning: "rushing eagerly" },
    { word: "भवनं भवस्य", transliteration: "bhavanaṃ bhavasya", meaning: "to Shiva's abode" },
    { word: "अभ्युत्थाने", transliteration: "abhyutthāne", meaning: "when He rises to greet" },
    { word: "तव परिजन-उक्तिः", transliteration: "tava parijana-uktiḥ", meaning: "the speech of Your attendants" },
    { word: "विजयते", transliteration: "vijayate", meaning: "triumphs gloriously" }
  ];

  W[30] = [
    { word: "स्व-देह-उद्भूताभिः", transliteration: "sva-deha-udbhūtābhiḥ", meaning: "born from Your own body" },
    { word: "घृणिभिः", transliteration: "ghṛṇibhiḥ", meaning: "with rays/powers" },
    { word: "अणिमा-आद्याभिः अभितः", transliteration: "aṇimā-ādyābhiḥ abhitaḥ", meaning: "surrounded by Anima and other Siddhis" },
    { word: "निषेव्ये नित्ये", transliteration: "niṣevye nitye", meaning: "O worshipful, eternal one" },
    { word: "त्वाम् अहम् इति", transliteration: "tvām aham iti", meaning: "'I am You'" },
    { word: "सदा भावयति यः", transliteration: "sadā bhāvayati yaḥ", meaning: "one who constantly meditates" },
    { word: "किम् आश्चर्यं", transliteration: "kim āścaryaṃ", meaning: "what wonder" },
    { word: "तस्य", transliteration: "tasya", meaning: "of that one" },
    { word: "त्रि-नयन-समृद्धिं तृणयतः", transliteration: "tri-nayana-samṛddhiṃ tṛṇayataḥ", meaning: "who regards Shiva's wealth as a blade of grass" },
    { word: "महा-संवर्त-अग्निः", transliteration: "mahā-saṃvarta-agniḥ", meaning: "the great fire of cosmic dissolution" },
    { word: "विरचयति", transliteration: "viracayati", meaning: "performs" },
    { word: "नीराजन-विधिम्", transliteration: "nīrājana-vidhim", meaning: "the Arati ceremony" }
  ];

  W[31] = [
    { word: "चतुष्-षष्ट्या तन्त्रैः", transliteration: "catuṣ-ṣaṣṭyā tantraiḥ", meaning: "through sixty-four Tantras" },
    { word: "सकलम् अति-सन्धाय", transliteration: "sakalam ati-sandhāya", meaning: "confusing the entire" },
    { word: "भुवनं", transliteration: "bhuvanaṃ", meaning: "world" },
    { word: "स्थितः", transliteration: "sthitaḥ", meaning: "having stood/established" },
    { word: "तत्-तत्-सिद्धि-प्रसव-पर-तन्त्रैः", transliteration: "tat-tat-siddhi-prasava-para-tantraiḥ", meaning: "each promising different Siddhis" },
    { word: "पशुपतिः", transliteration: "paśupatiḥ", meaning: "Lord Pashupati (Shiva)" },
    { word: "पुनः त्वत्-निर्बन्धात्", transliteration: "punaḥ tvat-nirbandhāt", meaning: "again at Your insistence" },
    { word: "अखिल-पुरुषार्थ-एक-घटना", transliteration: "akhila-puruṣārtha-eka-ghaṭanā", meaning: "granting all four Purusharthas" },
    { word: "स्वतन्त्रं ते तन्त्रं", transliteration: "svatantraṃ te tantraṃ", meaning: "Your independent Tantra (Sri Vidya)" },
    { word: "क्षिति-तलम् अवातीतरत् इदम्", transliteration: "kṣiti-talam avātītarat idam", meaning: "descended to earth" }
  ];

  W[32] = [
    { word: "शिवः", transliteration: "śivaḥ", meaning: "Ka (Shiva)" },
    { word: "शक्तिः", transliteration: "śaktiḥ", meaning: "E (Shakti)" },
    { word: "कामः", transliteration: "kāmaḥ", meaning: "I (Kama)" },
    { word: "क्षितिः", transliteration: "kṣitiḥ", meaning: "La (Earth)" },
    { word: "अथ रविः", transliteration: "atha raviḥ", meaning: "then Ha (Sun)" },
    { word: "शीत-किरणः", transliteration: "śīta-kiraṇaḥ", meaning: "Sa (Moon)" },
    { word: "स्मरः", transliteration: "smaraḥ", meaning: "Ka (Smara/Kama)" },
    { word: "हंसः", transliteration: "haṃsaḥ", meaning: "Ha (Hamsa)" },
    { word: "शक्रः", transliteration: "śakraḥ", meaning: "La (Indra)" },
    { word: "तत् अनु च", transliteration: "tat anu ca", meaning: "then also" },
    { word: "परा-मार-हरयः", transliteration: "parā-māra-harayaḥ", meaning: "Sa, Ka, La (Para, Mara, Hari)" },
    { word: "अमी हृल्-लेखाभिः तिसृभिः", transliteration: "amī hṛl-lekhābhiḥ tisṛbhiḥ", meaning: "these with three Hrim syllables" },
    { word: "अवसानेषु घटिताः", transliteration: "avasāneṣu ghaṭitāḥ", meaning: "joined at the ends" },
    { word: "भजन्ते वर्णाः ते", transliteration: "bhajante varṇāḥ te", meaning: "these syllables become" },
    { word: "तव जननि नाम-अवयवताम्", transliteration: "tava janani nāma-avayavatām", meaning: "the letters of Your name, O Mother" }
  ];

  W[33] = [
    { word: "स्मरं", transliteration: "smaraṃ", meaning: "Klim (Kama Bija)" },
    { word: "योनिं", transliteration: "yoniṃ", meaning: "Hrim (Yoni/Bhuvaneswari Bija)" },
    { word: "लक्ष्मीं", transliteration: "lakṣmīṃ", meaning: "Shrim (Lakshmi/Sri Bija)" },
    { word: "त्रितयम् इदम् आदौ", transliteration: "tritayam idam ādau", meaning: "this triad at the beginning" },
    { word: "तव मनोः निधाय", transliteration: "tava manoḥ nidhāya", meaning: "placing before Your mantra" },
    { word: "एके नित्ये", transliteration: "eke nitye", meaning: "some, O Eternal One" },
    { word: "निरवधि-महा-भोग-रसिकाः", transliteration: "niravadhi-mahā-bhoga-rasikāḥ", meaning: "connoisseurs of boundless supreme bliss" },
    { word: "भजन्ति त्वां", transliteration: "bhajanti tvāṃ", meaning: "worship You" },
    { word: "चिन्तामणि-गुण-निबद्ध-अक्ष-वलयाः", transliteration: "cintāmaṇi-guṇa-nibaddha-akṣa-valayāḥ", meaning: "wearing a Chintamani gem rosary" },
    { word: "शिव-अग्नौ जुह्वन्तः", transliteration: "śiva-agnau juhvantaḥ", meaning: "offering into the fire of Shiva" },
    { word: "सुरभि-घृत-धारा-आहुति-शतैः", transliteration: "surabhi-ghṛta-dhārā-āhuti-śataiḥ", meaning: "with hundreds of fragrant ghee oblations" }
  ];

  W[34] = [
    { word: "शरीरं त्वं शम्भोः", transliteration: "śarīraṃ tvaṃ śambhoḥ", meaning: "You are Shambhu's body" },
    { word: "शशि-मिहिर-वक्षोरुह-युगं", transliteration: "śaśi-mihira-vakṣoruha-yugaṃ", meaning: "the Moon and Sun are Your breasts" },
    { word: "तव आत्मानं मन्ये", transliteration: "tava ātmānaṃ manye", meaning: "I consider Your soul" },
    { word: "भगवति", transliteration: "bhagavati", meaning: "O Goddess" },
    { word: "नव-आत्मानम् अनघम्", transliteration: "nava-ātmānam anagham", meaning: "the sinless nine-fold self" },
    { word: "अतः शेषः शेषी इति", transliteration: "ataḥ śeṣaḥ śeṣī iti", meaning: "thus part and whole" },
    { word: "अयम् उभय-साधारणतया", transliteration: "ayam ubhaya-sādhāraṇatayā", meaning: "this mutuality of both" },
    { word: "स्थितः सम्बन्धः वां", transliteration: "sthitaḥ sambandhaḥ vāṃ", meaning: "is the relationship between You two" },
    { word: "सम-रस-पर-आनन्द-परयोः", transliteration: "sama-rasa-para-ānanda-parayoḥ", meaning: "who are in equal bliss supreme" }
  ];

  W[35] = [
    { word: "मनः त्वं", transliteration: "manaḥ tvaṃ", meaning: "You are the Mind" },
    { word: "व्योम त्वं", transliteration: "vyoma tvaṃ", meaning: "You are Ether" },
    { word: "मरुत् असि", transliteration: "marut asi", meaning: "You are Air" },
    { word: "मरुत्-सारथिः असि", transliteration: "marut-sārathiḥ asi", meaning: "You are Fire (charioteer of wind)" },
    { word: "त्वम् आपः", transliteration: "tvam āpaḥ", meaning: "You are Water" },
    { word: "त्वं भूमिः", transliteration: "tvaṃ bhūmiḥ", meaning: "You are Earth" },
    { word: "त्वयि परिणतायां", transliteration: "tvayi pariṇatāyāṃ", meaning: "when You have transformed" },
    { word: "न हि परम्", transliteration: "na hi param", meaning: "nothing remains beyond" },
    { word: "त्वम् एव", transliteration: "tvam eva", meaning: "You alone" },
    { word: "स्व-आत्मानं परिणमयितुं", transliteration: "sva-ātmānaṃ pariṇamayituṃ", meaning: "transform Your own Self" },
    { word: "विश्व-वपुषा", transliteration: "viśva-vapuṣā", meaning: "in the form of the universe" },
    { word: "चित्-आनन्द-आकारं", transliteration: "cit-ānanda-ākāraṃ", meaning: "the nature of consciousness-bliss" },
    { word: "शिव-युवती-भावेन", transliteration: "śiva-yuvatī-bhāvena", meaning: "as Shiva's consort" },
    { word: "बिभृषे", transliteration: "bibhṛṣe", meaning: "You maintain/hold" }
  ];

  W[36] = [
    { word: "तव आज्ञा-चक्र-स्थं", transliteration: "tava ājñā-cakra-sthaṃ", meaning: "stationed in Your Ajna Chakra" },
    { word: "तपन-शशि-कोटि-द्युति-धरं", transliteration: "tapana-śaśi-koṭi-dyuti-dharaṃ", meaning: "blazing with millions of suns and moons" },
    { word: "परं शम्भुं वन्दे", transliteration: "paraṃ śambhuṃ vande", meaning: "I salute the Supreme Shambhu" },
    { word: "परिमिलित-पार्श्वं", transliteration: "parimilita-pārśvaṃ", meaning: "embraced at Your side" },
    { word: "पर-चिता", transliteration: "para-citā", meaning: "by You, Supreme Consciousness" },
    { word: "यम् आराध्यन् भक्त्या", transliteration: "yam ārādhyan bhaktyā", meaning: "worshipping whom with devotion" },
    { word: "रवि-शशि-शुचीनाम् अविषये", transliteration: "ravi-śaśi-śucīnām aviṣaye", meaning: "beyond the realm of sun, moon, fire" },
    { word: "निरालोके अलोके", transliteration: "nirāloke aloke", meaning: "in the lightless realm of light" },
    { word: "निवसति हि", transliteration: "nivasati hi", meaning: "one indeed dwells" },
    { word: "भा-लोक-भुवने", transliteration: "bhā-loka-bhuvane", meaning: "in the world of radiance" }
  ];

  W[37] = [
    { word: "विशुद्धौ ते", transliteration: "viśuddhau te", meaning: "in Your Vishuddhi (Chakra)" },
    { word: "शुद्ध-स्फटिक-विशदं", transliteration: "śuddha-sphaṭika-viśadaṃ", meaning: "pure and translucent as crystal" },
    { word: "व्योम-जनकं", transliteration: "vyoma-janakaṃ", meaning: "the source of Ether" },
    { word: "शिवं सेवे", transliteration: "śivaṃ seve", meaning: "I worship Shiva" },
    { word: "देवीम् अपि", transliteration: "devīm api", meaning: "and the Devi" },
    { word: "शिव-समान-व्यवसिताम्", transliteration: "śiva-samāna-vyavasitām", meaning: "who has become identical with Shiva" },
    { word: "ययोः कान्त्या", transliteration: "yayoḥ kāntyā", meaning: "by the lustre of whom" },
    { word: "यान्त्याः", transliteration: "yāntyāḥ", meaning: "flowing" },
    { word: "शशि-किरण-सारूप्य-सरणेः", transliteration: "śaśi-kiraṇa-sārūpya-saraṇeḥ", meaning: "resembling moonbeams" },
    { word: "विधूत-अन्तर्-ध्वान्ता", transliteration: "vidhūta-antar-dhvāntā", meaning: "inner darkness dispelled" },
    { word: "विलसति चकोरी इव", transliteration: "vilasati cakorī iva", meaning: "shines like a Chakori bird" },
    { word: "जगती", transliteration: "jagatī", meaning: "the world" }
  ];

  W[38] = [
    { word: "सम्-उन्मीलत्-संवित्-कमल", transliteration: "sam-unmīlat-saṃvit-kamala", meaning: "the blooming lotus of Consciousness" },
    { word: "मकरन्द-एक-रसिकं", transliteration: "makaranda-eka-rasikaṃ", meaning: "reveling solely in its nectar" },
    { word: "भजे हंस-द्वन्द्वं", transliteration: "bhaje haṃsa-dvandvaṃ", meaning: "I worship the Hamsa pair" },
    { word: "किम् अपि", transliteration: "kim api", meaning: "indescribable" },
    { word: "महतां मानस-चरम्", transliteration: "mahatāṃ mānasa-caram", meaning: "moving in the Manasa lake of the great" },
    { word: "यत् आलापात्", transliteration: "yat ālāpāt", meaning: "from whose conversation" },
    { word: "अष्टा-दश-गुणित-विद्या-परिणतिः", transliteration: "aṣṭā-daśa-guṇita-vidyā-pariṇatiḥ", meaning: "the eighteen Vidyas manifest" },
    { word: "यत् आदत्ते", transliteration: "yat ādatte", meaning: "which extracts" },
    { word: "दोषात् गुणम् अखिलम्", transliteration: "doṣāt guṇam akhilam", meaning: "all virtue from vice" },
    { word: "अद्भ्यः पयः इव", transliteration: "adbhyaḥ payaḥ iva", meaning: "as milk from water" }
  ];

  W[39] = [
    { word: "तव स्वाधिष्ठाने", transliteration: "tava svādhiṣṭhāne", meaning: "in Your Svadhishthana" },
    { word: "हुतवहम् अधिष्ठाय", transliteration: "hutavaham adhiṣṭhāya", meaning: "presiding over the fire" },
    { word: "निरतं", transliteration: "nirataṃ", meaning: "constantly engaged" },
    { word: "तम् ईडे संवर्तं", transliteration: "tam īḍe saṃvartaṃ", meaning: "I praise that Samvarta (fire of dissolution)" },
    { word: "जननि", transliteration: "janani", meaning: "O Mother" },
    { word: "महतीं तां च समयाम्", transliteration: "mahatīṃ tāṃ ca samayām", meaning: "and the great Samaya (Shakti)" },
    { word: "यत् आलोके", transliteration: "yat āloke", meaning: "when His gaze" },
    { word: "लोकान् दहति", transliteration: "lokān dahati", meaning: "burns the worlds" },
    { word: "महति क्रोध-कलिते", transliteration: "mahati krodha-kalite", meaning: "filled with great wrath" },
    { word: "दया-आर्द्रा या दृष्टिः", transliteration: "dayā-ārdrā yā dṛṣṭiḥ", meaning: "Her compassion-moist glance" },
    { word: "शिशिरम् उपचारं रचयति", transliteration: "śiśiram upacāraṃ racayati", meaning: "creates a cooling remedy" }
  ];

  W[40] = [
    { word: "तटित्-त्वन्तं शक्त्या", transliteration: "taṭit-tvantaṃ śaktyā", meaning: "with lightning (Shakti) as companion" },
    { word: "तिमिर-परिपन्थि-स्फुरणया", transliteration: "timira-paripanthi-sphuraṇayā", meaning: "whose flash is the enemy of darkness" },
    { word: "स्फुरत्-नाना-रत्न-आभरण", transliteration: "sphurat-nānā-ratna-ābharaṇa", meaning: "sparkling with various gem ornaments" },
    { word: "परिणद्ध-इन्द्र-धनुषम्", transliteration: "pariṇaddha-indra-dhanuṣam", meaning: "adorned with a rainbow" },
    { word: "तव श्यामं मेघं", transliteration: "tava śyāmaṃ meghaṃ", meaning: "Your dark cloud (Shiva)" },
    { word: "कम् अपि", transliteration: "kam api", meaning: "indescribable" },
    { word: "मणि-पूर-एक-शरणं", transliteration: "maṇi-pūra-eka-śaraṇaṃ", meaning: "dwelling in Manipura alone" },
    { word: "निषेवे", transliteration: "niṣeve", meaning: "I worship" },
    { word: "वर्षन्तं", transliteration: "varṣantaṃ", meaning: "showering rain" },
    { word: "हर-मिहिर-तप्तं", transliteration: "hara-mihira-taptaṃ", meaning: "scorched by the sun-destroyer" },
    { word: "त्रि-भुवनम्", transliteration: "tri-bhuvanam", meaning: "upon the three worlds" }
  ];

  W[41] = [
    { word: "तव आधारे मूले", transliteration: "tava ādhāre mūle", meaning: "in Your Muladhara (root support)" },
    { word: "सह समयया", transliteration: "saha samayayā", meaning: "together with Samaya (Shakti)" },
    { word: "लास्य-परया", transliteration: "lāsya-parayā", meaning: "who performs the graceful Lasya dance" },
    { word: "नव-आत्मानं मन्ये", transliteration: "nava-ātmānaṃ manye", meaning: "I envision the nine-formed one" },
    { word: "नव-रस-महा-ताण्डव-नटम्", transliteration: "nava-rasa-mahā-tāṇḍava-naṭam", meaning: "performing the great Tandava of nine Rasas" },
    { word: "उभाभ्याम् एताभ्याम्", transliteration: "ubhābhyām etābhyām", meaning: "from these two" },
    { word: "उदय-विधिम् उद्दिश्य", transliteration: "udaya-vidhim uddiśya", meaning: "intending creation" },
    { word: "दयया", transliteration: "dayayā", meaning: "with compassion" },
    { word: "सनाथाभ्यां", transliteration: "sanāthābhyāṃ", meaning: "from these two protectors" },
    { word: "जज्ञे", transliteration: "jajñe", meaning: "was born" },
    { word: "जनक-जननी-मत्", transliteration: "janaka-jananī-mat", meaning: "having Father and Mother" },
    { word: "जगत् इदम्", transliteration: "jagat idam", meaning: "this world" }
  ];

  W[42] = [
    { word: "गतैः माणिक्यत्वं", transliteration: "gataiḥ māṇikyatvaṃ", meaning: "having transformed into rubies" },
    { word: "गगन-मणिभिः", transliteration: "gagana-maṇibhiḥ", meaning: "by the sky-gems (stars)" },
    { word: "सान्द्र-घटितं", transliteration: "sāndra-ghaṭitaṃ", meaning: "densely studded" },
    { word: "किरीटं ते हैमं", transliteration: "kirīṭaṃ te haimaṃ", meaning: "Your golden crown" },
    { word: "हिमगिरि-सुते", transliteration: "himagiri-sute", meaning: "O daughter of the snow mountain" },
    { word: "कीर्तयति यः", transliteration: "kīrtayati yaḥ", meaning: "one who sings of" },
    { word: "स नीडेय-छाया-छुरण-शबलं", transliteration: "sa nīḍeya-chāyā-churana-śabalaṃ", meaning: "he (imagines it) dappled by colorful reflections" },
    { word: "चन्द्र-शकलं", transliteration: "candra-śakalaṃ", meaning: "the crescent moon" },
    { word: "धनुः शौनासीरं", transliteration: "dhanuḥ śaunāsīraṃ", meaning: "Indra's rainbow bow" },
    { word: "किम् इति न निबध्नाति", transliteration: "kim iti na nibadhnāti", meaning: "why would he not imagine" },
    { word: "धिषणाम्", transliteration: "dhiṣaṇām", meaning: "the intellect/imagination" }
  ];

  W[43] = [
    { word: "धुनोतु ध्वान्तं नः", transliteration: "dhunotu dhvāntaṃ naḥ", meaning: "may it dispel our darkness" },
    { word: "तुलित-दलित-इन्दीवर-वनं", transliteration: "tulita-dalita-indīvara-vanaṃ", meaning: "rivaling a forest of blossomed blue lotuses" },
    { word: "घन-स्निग्ध-श्लक्ष्णं", transliteration: "ghana-snigdha-ślakṣṇaṃ", meaning: "thick, smooth, glossy" },
    { word: "चिकुर-निकुरुम्बं", transliteration: "cikura-nikurumbaṃ", meaning: "mass of hair" },
    { word: "तव शिवे", transliteration: "tava śive", meaning: "O Shive, Your" },
    { word: "यदीयं सौरभ्यं", transliteration: "yadīyaṃ saurabhyaṃ", meaning: "whose fragrance" },
    { word: "सहजम् उपलब्धुं", transliteration: "sahajam upalabdhuṃ", meaning: "to partake of its natural (scent)" },
    { word: "सुमनसः", transliteration: "sumanasaḥ", meaning: "flowers" },
    { word: "वसन्ति अस्मिन् मन्ये", transliteration: "vasanti asmin manye", meaning: "reside in it I believe" },
    { word: "वल-मथन-वाटी-विटपिनाम्", transliteration: "vala-mathana-vāṭī-viṭapinām", meaning: "of the trees of Indra's garden" }
  ];

  W[44] = [
    { word: "तनोतु क्षेमं नः", transliteration: "tanotu kṣemaṃ naḥ", meaning: "may it bestow welfare upon us" },
    { word: "तव वदन-सौन्दर्य-लहरी", transliteration: "tava vadana-saundarya-laharī", meaning: "the flood of Your facial beauty" },
    { word: "परीवाह-स्रोतः-सरणिः इव", transliteration: "parīvāha-srotaḥ-saraṇiḥ iva", meaning: "like an overflow channel" },
    { word: "सीमन्त-सरणिः", transliteration: "sīmanta-saraṇiḥ", meaning: "the parting of Your hair" },
    { word: "वहन्ती सिन्दूरं", transliteration: "vahantī sindūraṃ", meaning: "bearing vermilion" },
    { word: "प्रबल-कबरी-भार-तिमिर", transliteration: "prabala-kabarī-bhāra-timira", meaning: "the darkness of thick tresses" },
    { word: "द्विषां बृन्दैः", transliteration: "dviṣāṃ bṛndaiḥ", meaning: "by the army of enemies (of darkness)" },
    { word: "बन्दी-कृतम् इव", transliteration: "bandī-kṛtam iva", meaning: "as if captured" },
    { word: "नवीन-अर्क-किरणम्", transliteration: "navīna-arka-kiraṇam", meaning: "a new sunrise" }
  ];

  W[45] = [
    { word: "अरालैः", transliteration: "arālaiḥ", meaning: "with curly" },
    { word: "स्वाभाव्यात्", transliteration: "svābhāvyāt", meaning: "naturally" },
    { word: "अलि-कलभ-सश्रीभिः अलकैः", transliteration: "ali-kalabha-saśrībhiḥ alakaiḥ", meaning: "locks beautiful like young bees" },
    { word: "परीतं ते वक्त्रं", transliteration: "parītaṃ te vaktraṃ", meaning: "Your face surrounded" },
    { word: "परिहसति", transliteration: "parihasati", meaning: "mocks/surpasses" },
    { word: "पङ्केरुह-रुचिम्", transliteration: "paṅkeruha-rucim", meaning: "the beauty of the lotus" },
    { word: "दर-स्मेरे यस्मिन्", transliteration: "dara-smere yasmin", meaning: "in that slightly smiling" },
    { word: "दशन-रुचि-किञ्जल्क-रुचिरे", transliteration: "daśana-ruci-kiñjalka-rucire", meaning: "charming with teeth like lotus filaments" },
    { word: "सुगन्धौ", transliteration: "sugandhau", meaning: "fragrant" },
    { word: "माद्यन्ति", transliteration: "mādyanti", meaning: "revel intoxicated" },
    { word: "स्मर-दहन-चक्षुः-मधुलिहः", transliteration: "smara-dahana-cakṣuḥ-madhulihaḥ", meaning: "the bee-like eyes of Shiva (burner of Kama)" }
  ];

  W[46] = [
    { word: "ललाटं", transliteration: "lalāṭaṃ", meaning: "the forehead" },
    { word: "लावण्य-द्युति-विमलम्", transliteration: "lāvaṇya-dyuti-vimalam", meaning: "radiant with the splendor of beauty" },
    { word: "आभाति तव", transliteration: "ābhāti tava", meaning: "shines, Your" },
    { word: "यत् द्वितीयं", transliteration: "yat dvitīyaṃ", meaning: "which (appears as) a second" },
    { word: "तत् मन्ये", transliteration: "tat manye", meaning: "that I consider" },
    { word: "मकुट-घटितं चन्द्र-शकलम्", transliteration: "makuṭa-ghaṭitaṃ candra-śakalam", meaning: "the crescent moon set in the crown" },
    { word: "विपर्यास-न्यासात्", transliteration: "viparyāsa-nyāsāt", meaning: "by reversing their positions" },
    { word: "उभयम् अपि संभूय", transliteration: "ubhayam api saṃbhūya", meaning: "both combining" },
    { word: "च मिथः", transliteration: "ca mithaḥ", meaning: "together mutually" },
    { word: "सुधा-लेप-स्यूतिः", transliteration: "sudhā-lepa-syūtiḥ", meaning: "joined by nectar" },
    { word: "परिणमति", transliteration: "pariṇamati", meaning: "they form" },
    { word: "राका-हिमकरः", transliteration: "rākā-himakaraḥ", meaning: "the full moon" }
  ];

  W[47] = [
    { word: "भ्रुवौ भुग्ने", transliteration: "bhruvau bhugne", meaning: "the curved eyebrows" },
    { word: "किञ्चित्", transliteration: "kiñcit", meaning: "slightly" },
    { word: "भुवन-भय-भङ्ग-व्यसनिनि", transliteration: "bhuvana-bhaya-bhaṅga-vyasanini", meaning: "engaged in dispelling the world's fears" },
    { word: "त्वदीये नेत्राभ्यां", transliteration: "tvadīye netrābhyāṃ", meaning: "with Your eyes" },
    { word: "मधुकर-रुचिभ्यां", transliteration: "madhukara-rucibhyāṃ", meaning: "dark as bees" },
    { word: "धृत-गुणम्", transliteration: "dhṛta-guṇam", meaning: "holding the bowstring" },
    { word: "धनुः मन्ये", transliteration: "dhanuḥ manye", meaning: "I imagine this to be a bow" },
    { word: "सव्य-इतर-कर-गृहीतं", transliteration: "savya-itara-kara-gṛhītaṃ", meaning: "held in the right hand" },
    { word: "रति-पतेः", transliteration: "rati-pateḥ", meaning: "of Kamadeva (lord of Rati)" },
    { word: "प्रकोष्ठे मुष्टौ च", transliteration: "prakoṣṭhe muṣṭau ca", meaning: "between forearm and fist" },
    { word: "स्थगयति", transliteration: "sthagayati", meaning: "conceals" },
    { word: "निगूढ-अन्तरम् उमे", transliteration: "nigūḍha-antaram ume", meaning: "the hidden space, O Uma" }
  ];

  W[48] = [
    { word: "अहः सूते", transliteration: "ahaḥ sūte", meaning: "creates the day" },
    { word: "सव्यं तव नयनम्", transliteration: "savyaṃ tava nayanam", meaning: "Your right eye" },
    { word: "अर्क-आत्मकतया", transliteration: "arka-ātmakatayā", meaning: "being of the nature of the Sun" },
    { word: "त्रियामां", transliteration: "triyāmāṃ", meaning: "the night" },
    { word: "वामं ते सृजति", transliteration: "vāmaṃ te sṛjati", meaning: "Your left (eye) creates" },
    { word: "रजनी-नायकतया", transliteration: "rajanī-nāyakatayā", meaning: "being of the nature of the Moon" },
    { word: "तृतीया ते दृष्टिः", transliteration: "tṛtīyā te dṛṣṭiḥ", meaning: "Your third eye/glance" },
    { word: "दर-दलित-हेम-अम्बुज-रुचिः", transliteration: "dara-dalita-hema-ambuja-ruciḥ", meaning: "with radiance of a slightly opened golden lotus" },
    { word: "समाधत्ते सन्ध्यां", transliteration: "samādhatte sandhyāṃ", meaning: "creates the twilight" },
    { word: "दिवस-निशयोः अन्तर-चरीम्", transliteration: "divasa-niśayoḥ antara-carīm", meaning: "moving between day and night" }
  ];

  W[49] = [
    { word: "विशाला", transliteration: "viśālā", meaning: "broad (Vishala)" },
    { word: "कल्याणी", transliteration: "kalyāṇī", meaning: "auspicious (Kalyani)" },
    { word: "स्फुट-रुचिः", transliteration: "sphuṭa-ruciḥ", meaning: "brilliant radiance" },
    { word: "अयोध्या कुवलयैः", transliteration: "ayodhyā kuvalayaiḥ", meaning: "invincible (Ayodhya) against lotuses" },
    { word: "कृपा-धारा-धारा", transliteration: "kṛpā-dhārā-dhārā", meaning: "a stream of compassion (Dhara)" },
    { word: "किम् अपि मधुरा", transliteration: "kim api madhurā", meaning: "indescribably sweet (Madhura)" },
    { word: "आभोग-वतिका", transliteration: "ābhoga-vatikā", meaning: "expansive garden" },
    { word: "अवन्ती", transliteration: "avantī", meaning: "protecting (Avanti)" },
    { word: "दृष्टिः ते", transliteration: "dṛṣṭiḥ te", meaning: "Your glance" },
    { word: "बहु-नगर-विस्तार-विजया", transliteration: "bahu-nagara-vistāra-vijayā", meaning: "victorious (Vijaya) across many cities" },
    { word: "ध्रुवं तत्-तत्-नाम-व्यवहरण-योग्या", transliteration: "dhruvaṃ tat-tat-nāma-vyavaharaṇa-yogyā", meaning: "surely deserving of each of those names" },
    { word: "विजयते", transliteration: "vijayate", meaning: "triumphs" }
  ];

  W[50] = [
    { word: "कवीनां संदर्भ-स्तबक", transliteration: "kavīnāṃ saṃdarbha-stabaka", meaning: "flower-clusters of poetic compositions" },
    { word: "मकरन्द-एक-रसिकं", transliteration: "makaranda-eka-rasikaṃ", meaning: "relishing the nectar alone" },
    { word: "कटाक्ष-व्याक्षेप", transliteration: "kaṭākṣa-vyākṣepa", meaning: "sidelong glances cast forth" },
    { word: "भ्रमर-कलभौ", transliteration: "bhramara-kalabhau", meaning: "like young bees" },
    { word: "कर्ण-युगलम्", transliteration: "karṇa-yugalam", meaning: "the pair of ears" },
    { word: "अमुञ्चन्तौ दृष्ट्वा", transliteration: "amuñcantau dṛṣṭvā", meaning: "seeing (the eyes) not leaving" },
    { word: "तव नव-रस-आस्वाद-तरलौ", transliteration: "tava nava-rasa-āsvāda-taralau", meaning: "Your (eyes) restless with tasting nine Rasas" },
    { word: "असूया-संसर्गात्", transliteration: "asūyā-saṃsargāt", meaning: "from association with jealousy" },
    { word: "अलिक-नयनं", transliteration: "alika-nayanaṃ", meaning: "the forehead-eye (third eye)" },
    { word: "किञ्चित् अरुणम्", transliteration: "kiñcit aruṇam", meaning: "slightly reddened" }
  ];

  W[51] = [
    { word: "शिवे शृङ्गार-आर्द्रा", transliteration: "śive śṛṅgāra-ārdrā", meaning: "tender with love toward Shiva" },
    { word: "तत्-इतर-जने कुत्सन-परा", transliteration: "tat-itara-jane kutsana-parā", meaning: "contemptuous toward other men" },
    { word: "स-रोषा गङ्गायां", transliteration: "sa-roṣā gaṅgāyāṃ", meaning: "angry toward Ganga" },
    { word: "गिरिश-चरिते विस्मय-वती", transliteration: "giriśa-carite vismaya-vatī", meaning: "wonderstruck at Shiva's exploits" },
    { word: "हर-अहिभ्यः भीता", transliteration: "hara-ahibhyaḥ bhītā", meaning: "afraid of Shiva's serpents" },
    { word: "सरसि-रुह-सौभाग्य-जननी", transliteration: "sarasi-ruha-saubhāgya-jananī", meaning: "surpassing the lotus's beauty" },
    { word: "सखीषु स्मेरा", transliteration: "sakhīṣu smerā", meaning: "smiling at friends" },
    { word: "ते मयि जननि", transliteration: "te mayi janani", meaning: "toward me, O Mother" },
    { word: "दृष्टिः स-करुणा", transliteration: "dṛṣṭiḥ sa-karuṇā", meaning: "may Your glance be compassionate" }
  ];

  W[52] = [
    { word: "गते कर्ण-अभ्यर्णं", transliteration: "gate karṇa-abhyarṇaṃ", meaning: "extending to the ears" },
    { word: "गरुत इव पक्ष्माणि दधती", transliteration: "garuta iva pakṣmāṇi dadhatī", meaning: "with eyelashes like wings of a bird" },
    { word: "पुरां भेत्तुः", transliteration: "purāṃ bhettuḥ", meaning: "of the destroyer of Tripura (Shiva)" },
    { word: "चित्त-प्रशम-रस-विद्रावण-फले", transliteration: "citta-praśama-rasa-vidrāvaṇa-phale", meaning: "capable of disturbing His meditative calm" },
    { word: "इमे नेत्रे", transliteration: "ime netre", meaning: "these eyes" },
    { word: "गोत्र-अधर-पति-कुल-उत्तंस-कलिके", transliteration: "gotrādhara-pati-kula-uttaṃsa-kalike", meaning: "O bud-ornament of the Mountain King's family" },
    { word: "तव आ-कर्ण-आकृष्ट", transliteration: "tava ā-karṇa-ākṛṣṭa", meaning: "drawn to Your ear" },
    { word: "स्मर-शर-विलासं", transliteration: "smara-śara-vilāsaṃ", meaning: "the sport of Kama's arrows" },
    { word: "कलयतः", transliteration: "kalayataḥ", meaning: "they perform" }
  ];

  W[53] = [
    { word: "विभक्त-त्रैवर्ण्यं", transliteration: "vibhakta-traivarṇyaṃ", meaning: "distinctly three-colored" },
    { word: "व्यतिकरित-लीला-अञ्जनतया", transliteration: "vyatikarita-līlā-añjanatayā", meaning: "beautifully mixed with collyrium" },
    { word: "विभाति", transliteration: "vibhāti", meaning: "shines" },
    { word: "त्वत्-नेत्र-त्रितयम् इदम्", transliteration: "tvat-netra-tritayam idam", meaning: "this triad of Your eyes" },
    { word: "ईशान-दयिते", transliteration: "īśāna-dayite", meaning: "O beloved of Ishana" },
    { word: "पुनः स्रष्टुं देवान्", transliteration: "punaḥ sraṣṭuṃ devān", meaning: "to re-create the gods" },
    { word: "द्रुहिण-हरि-रुद्रान् उपरतान्", transliteration: "druhiṇa-hari-rudrān uparatān", meaning: "Brahma, Vishnu, Rudra after dissolution" },
    { word: "रजः सत्त्वं बिभ्रत्", transliteration: "rajaḥ sattvaṃ bibhrat", meaning: "bearing Rajas and Sattva" },
    { word: "तमः इति", transliteration: "tamaḥ iti", meaning: "and Tamas" },
    { word: "गुणानां त्रयम् इव", transliteration: "guṇānāṃ trayam iva", meaning: "like the three Gunas" }
  ];

  W[54] = [
    { word: "पवित्री-कर्तुं नः", transliteration: "pavitrī-kartuṃ naḥ", meaning: "to purify us" },
    { word: "पशुपति-पर-अधीन-हृदये", transliteration: "paśupati-para-adhīna-hṛdaye", meaning: "O You whose heart is devoted to Pashupati" },
    { word: "दया-मित्रैः नेत्रैः", transliteration: "dayā-mitraiḥ netraiḥ", meaning: "with compassionate friendly eyes" },
    { word: "अरुण-धवल-श्याम-रुचिभिः", transliteration: "aruṇa-dhavala-śyāma-rucibhiḥ", meaning: "with red, white, and dark hues" },
    { word: "नदः शोणः", transliteration: "nadaḥ śoṇaḥ", meaning: "the Shona (red) river" },
    { word: "गङ्गा", transliteration: "gaṅgā", meaning: "Ganga (white)" },
    { word: "तपन-तनया इति", transliteration: "tapana-tanayā iti", meaning: "and Yamuna (dark)" },
    { word: "ध्रुवम् अमुं", transliteration: "dhruvam amuṃ", meaning: "surely this" },
    { word: "त्रयाणां तीर्थानाम्", transliteration: "trayāṇāṃ tīrthānām", meaning: "of three holy rivers" },
    { word: "उपनयसि सम्भेदम् अनघम्", transliteration: "upanayasi sambhedam anagham", meaning: "You bring about the sacred confluence" }
  ];

  W[55] = [
    { word: "निमेष-उन्मेषाभ्यां", transliteration: "nimeṣa-unmeṣābhyāṃ", meaning: "by closing and opening (eyes)" },
    { word: "प्रलयम् उदयं", transliteration: "pralayam udayaṃ", meaning: "dissolution and creation" },
    { word: "याति जगती", transliteration: "yāti jagatī", meaning: "the world undergoes" },
    { word: "तव इति आहुः सन्तः", transliteration: "tava iti āhuḥ santaḥ", meaning: "thus say the wise of Yours" },
    { word: "धरणिधर-राजन्य-तनये", transliteration: "dharaṇidhara-rājanya-tanaye", meaning: "O princess of the Mountain King" },
    { word: "त्वत्-उन्मेषात् जातं", transliteration: "tvat-unmeṣāt jātaṃ", meaning: "born from Your eye-opening" },
    { word: "जगत् इदम् अशेषं", transliteration: "jagat idam aśeṣaṃ", meaning: "this entire world" },
    { word: "प्रलयतः परित्रातुं", transliteration: "pralayataḥ paritrātuṃ", meaning: "to protect from dissolution" },
    { word: "शङ्के", transliteration: "śaṅke", meaning: "I suspect" },
    { word: "परिहृत-निमेषाः", transliteration: "parihṛta-nimeṣāḥ", meaning: "without blinking" },
    { word: "तव दृशः", transliteration: "tava dṛśaḥ", meaning: "are Your eyes" }
  ];

  W[56] = [
    { word: "तव अपर्णे", transliteration: "tava aparṇe", meaning: "O Aparna, Your" },
    { word: "कर्ण-जप-नयन-पैशुन्य-चकिताः", transliteration: "karṇa-japa-nayana-paiśunya-cakitāḥ", meaning: "frightened that eyes might report to ears" },
    { word: "निलीयन्ते तोये", transliteration: "nilīyante toye", meaning: "hide in the water" },
    { word: "नियतम् अनिमेषाः", transliteration: "niyatam animeṣāḥ", meaning: "always unblinking" },
    { word: "शफरिकाः", transliteration: "śapharikāḥ", meaning: "fish" },
    { word: "इयं च श्रीः", transliteration: "iyaṃ ca śrīḥ", meaning: "and Lakshmi" },
    { word: "बद्ध-छद-पुट-कवाटं कुवलयं", transliteration: "baddha-chada-puṭa-kavāṭaṃ kuvalayaṃ", meaning: "the lotus with closed petals" },
    { word: "जहाति प्रत्यूषे", transliteration: "jahāti pratyūṣe", meaning: "leaves at dawn" },
    { word: "निशि च विघटय्य प्रविशति", transliteration: "niśi ca vighaṭayya praviśati", meaning: "and at night pries open and enters" }
  ];

  W[57] = [
    { word: "दृशा द्राघीयस्या", transliteration: "dṛśā drāghīyasyā", meaning: "with Your long glance" },
    { word: "दर-दलित-नील-उत्पल-रुचा", transliteration: "dara-dalita-nīla-utpala-rucā", meaning: "beautiful as a half-blossomed blue lotus" },
    { word: "दवीयांसं दीनं", transliteration: "davīyāṃsaṃ dīnaṃ", meaning: "distant and wretched (me)" },
    { word: "स्नपय कृपया", transliteration: "snapaya kṛpayā", meaning: "bathe in compassion" },
    { word: "माम् अपि शिवे", transliteration: "mām api śive", meaning: "even me, O Shive" },
    { word: "अनेन अयं धन्यः भवति", transliteration: "anena ayaṃ dhanyaḥ bhavati", meaning: "by this, one becomes blessed" },
    { word: "न च ते हानिः इयता", transliteration: "na ca te hāniḥ iyatā", meaning: "and You lose nothing by this" },
    { word: "वने वा हर्म्ये वा", transliteration: "vane vā harmye vā", meaning: "on forest or palace" },
    { word: "सम-कर-निपातः", transliteration: "sama-kara-nipātaḥ", meaning: "falls equally" },
    { word: "हिमकरः", transliteration: "himakaraḥ", meaning: "the moon(light)" }
  ];

  W[58] = [
    { word: "अरालं ते", transliteration: "arālaṃ te", meaning: "curved, Your" },
    { word: "पाली-युगलम्", transliteration: "pālī-yugalam", meaning: "pair of ear-edges" },
    { word: "अगराजन्य-तनये", transliteration: "agarājanya-tanaye", meaning: "O princess of the Mountain King" },
    { word: "न केषाम् आधत्ते", transliteration: "na keṣām ādhatte", meaning: "to whom does it not give" },
    { word: "कुसुम-शर-कोदण्ड-कुतुकम्", transliteration: "kusuma-śara-kodaṇḍa-kutukam", meaning: "the delight of Kama's flower-bow" },
    { word: "तिरश्चीनः यत्र", transliteration: "tiraścīnaḥ yatra", meaning: "where horizontally" },
    { word: "श्रवण-पथम् उल्लङ्घ्य", transliteration: "śravaṇa-patham ullaṅghya", meaning: "crossing the path of the ears" },
    { word: "विलसन्-अपाङ्ग-व्यासङ्गः", transliteration: "vilasan-apāṅga-vyāsaṅgaḥ", meaning: "the play of sidelong glances" },
    { word: "दिशति", transliteration: "diśati", meaning: "suggests/indicates" },
    { word: "शर-सन्धान-धिषणाम्", transliteration: "śara-sandhāna-dhiṣaṇām", meaning: "the skill of fitting arrows" }
  ];

  W[59] = [
    { word: "स्फुरत्-गण्ड-आभोग", transliteration: "sphurat-gaṇḍa-ābhoga", meaning: "lustrous broad cheeks" },
    { word: "प्रतिफलित-ताटङ्क-युगलं", transliteration: "pratiphalita-tāṭaṅka-yugalaṃ", meaning: "reflecting the pair of ear-studs" },
    { word: "चतुः-चक्रं मन्ये", transliteration: "catuḥ-cakraṃ manye", meaning: "I consider as four-wheeled" },
    { word: "तव मुखम् इदं", transliteration: "tava mukham idaṃ", meaning: "this face of Yours" },
    { word: "मन्मथ-रथम्", transliteration: "manmatha-ratham", meaning: "the chariot of Kamadeva" },
    { word: "यम् आरुह्य", transliteration: "yam āruhya", meaning: "mounting which" },
    { word: "द्रुह्यति", transliteration: "druhyati", meaning: "wages war" },
    { word: "अवनि-रथम्", transliteration: "avani-ratham", meaning: "against the earth-chariot" },
    { word: "अर्क-इन्दु-चरणं", transliteration: "arka-indu-caraṇaṃ", meaning: "with Sun and Moon as wheels" },
    { word: "महा-वीरः माराः", transliteration: "mahā-vīraḥ māraḥ", meaning: "the great hero Kama" },
    { word: "प्रमथ-पतये सज्जितवते", transliteration: "pramatha-pataye sajjitavate", meaning: "against Shiva who is prepared (for battle)" }
  ];

  W[60] = [
    { word: "सरस्वत्याः सूक्तीः", transliteration: "sarasvatyāḥ sūktīḥ", meaning: "Saraswati's hymns" },
    { word: "अमृत-लहरी-कौशल-हरीः", transliteration: "amṛta-laharī-kauśala-harīḥ", meaning: "waves of nectar-like skill" },
    { word: "पिबन्त्याः शर्वाणि", transliteration: "pibantyāḥ śarvāṇi", meaning: "as You drink, O Sharvani" },
    { word: "श्रवण-चुलुकाभ्याम् अविरलम्", transliteration: "śravaṇa-culukābhyām aviralam", meaning: "through the cups of Your ears ceaselessly" },
    { word: "चमत्कार-श्लाघा-चलित-शिरसः", transliteration: "camatkāra-ślāghā-calita-śirasaḥ", meaning: "nodding Your head in appreciative wonder" },
    { word: "कुण्डल-गणः", transliteration: "kuṇḍala-gaṇaḥ", meaning: "the cluster of earrings" },
    { word: "झणत्कारैः तारैः", transliteration: "jhaṇatkāraiḥ tāraiḥ", meaning: "with high-pitched tinkling sounds" },
    { word: "प्रतिवचनम् आचष्ट इव ते", transliteration: "prativacanam ācaṣṭa iva te", meaning: "seems to offer a reply for You" }
  ];

  W[61] = [
    { word: "असौ नासा-वंशः", transliteration: "asau nāsā-vaṃśaḥ", meaning: "this nose-bridge" },
    { word: "तुहिन-गिरि-वंश-ध्वज-पटी", transliteration: "tuhiṇa-giri-vaṃśa-dhvaja-paṭī", meaning: "the banner-staff of the Himalaya dynasty" },
    { word: "त्वदीयः नेदीयः", transliteration: "tvadīyaḥ nedīyaḥ", meaning: "Your nearest (nose)" },
    { word: "फलतु फलम् अस्माकम् उचितम्", transliteration: "phalatu phalam asmākam ucitam", meaning: "may it grant us the fruit we deserve" },
    { word: "वहन् अन्तर्-मुक्ताः", transliteration: "vahan antar-muktāḥ", meaning: "carrying pearls within" },
    { word: "शिशिर-कर-निश्वास-गलितं", transliteration: "śiśira-kara-niśvāsa-galitaṃ", meaning: "dropped by cool moon-like breath" },
    { word: "समृद्ध्या यत्-तासां", transliteration: "samṛddhyā yat-tāsāṃ", meaning: "enriched by those (inner pearls)" },
    { word: "बहिः अपि च", transliteration: "bahiḥ api ca", meaning: "on the outside too" },
    { word: "मुक्ता-मणि-धरः", transliteration: "muktā-maṇi-dharaḥ", meaning: "bearing a pearl ornament" }
  ];

  W[62] = [
    { word: "प्रकृत्या रक्तायाः", transliteration: "prakṛtyā raktāyāḥ", meaning: "naturally red" },
    { word: "तव सुदति", transliteration: "tava sudati", meaning: "O Lady of beautiful teeth, Your" },
    { word: "दन्त-छद-रुचेः", transliteration: "danta-chada-ruceḥ", meaning: "lips' radiance (covering teeth)" },
    { word: "प्रवक्ष्ये सादृश्यं", transliteration: "pravakṣye sādṛśyaṃ", meaning: "I shall describe a comparison" },
    { word: "जनयतु फलं", transliteration: "janayatu phalaṃ", meaning: "let it produce a fruit" },
    { word: "विद्रुम-लता", transliteration: "vidruma-latā", meaning: "the coral creeper" },
    { word: "न बिम्बं", transliteration: "na bimbaṃ", meaning: "not even the Bimba fruit" },
    { word: "तत्-बिम्ब-प्रतिफलन-रागात् अरुणितं", transliteration: "tat-bimba-pratiphalana-rāgāt aruṇitaṃ", meaning: "reddened by the reflection of Your lips" },
    { word: "तुलाम् अध्य-आरोढुं", transliteration: "tulām adhya-āroḍhuṃ", meaning: "to mount the scale (for comparison)" },
    { word: "कथम् इव विलज्जेत कलया", transliteration: "katham iva vilajjeta kalayā", meaning: "would it not be ashamed even slightly" }
  ];

  W[63] = [
    { word: "स्मित-ज्योत्स्ना-जालं", transliteration: "smita-jyotsnā-jālaṃ", meaning: "the web of moonlight from Your smile" },
    { word: "तव वदन-चन्द्रस्य", transliteration: "tava vadana-candrasya", meaning: "of Your moon-face" },
    { word: "पिबतां", transliteration: "pibatāṃ", meaning: "for those who drink" },
    { word: "चकोराणाम्", transliteration: "cakorāṇām", meaning: "of the Chakora birds" },
    { word: "आसीत् अतिरसतया", transliteration: "āsīt atirasatayā", meaning: "there arose from excess sweetness" },
    { word: "चञ्चु-जडिमा", transliteration: "cañcu-jaḍimā", meaning: "numbness of the beaks" },
    { word: "अतः ते शीत-अंशोः", transliteration: "ataḥ te śīta-aṃśoḥ", meaning: "therefore of the cool moon" },
    { word: "अमृत-लहरीम्", transliteration: "amṛta-laharīm", meaning: "the waves of nectar" },
    { word: "अम्ल-रुचयः", transliteration: "amla-rucayaḥ", meaning: "with sour taste" },
    { word: "पिबन्ति स्वच्छन्दं", transliteration: "pibanti svacchandaṃ", meaning: "they drink freely" },
    { word: "निशि निशि भृशं", transliteration: "niśi niśi bhṛśaṃ", meaning: "every night intensely" },
    { word: "काञ्जिक-धिया", transliteration: "kāñjika-dhiyā", meaning: "thinking it a palate cleanser" }
  ];

  W[64] = [
    { word: "अविश्रान्तं", transliteration: "aviśrāntaṃ", meaning: "ceaselessly" },
    { word: "पत्युः गुण-गण-कथा-आम्रेडन-जपा", transliteration: "patyuḥ guṇa-gaṇa-kathā-āmreḍana-japā", meaning: "from constant repetition of Lord's glories" },
    { word: "जपा-पुष्प-छाया", transliteration: "japā-puṣpa-chāyā", meaning: "hued like a hibiscus flower" },
    { word: "तव जननि जिह्वा", transliteration: "tava janani jihvā", meaning: "O Mother, Your tongue" },
    { word: "जयति सा", transliteration: "jayati sā", meaning: "triumphs" },
    { word: "यत्-अग्र-आसीनायाः", transliteration: "yat-agra-āsīnāyāḥ", meaning: "of Her who sits at its tip" },
    { word: "स्फटिक-दृषत्-अच्छ-छवि-मयी", transliteration: "sphaṭika-dṛṣat-accha-chavi-mayī", meaning: "crystal-clear in complexion" },
    { word: "सरस्वत्याः मूर्तिः", transliteration: "sarasvatyāḥ mūrtiḥ", meaning: "the form of Saraswati" },
    { word: "परिणमति", transliteration: "pariṇamati", meaning: "is transformed" },
    { word: "माणिक्य-वपुषा", transliteration: "māṇikya-vapuṣā", meaning: "into a ruby-hued form" }
  ];

  W[65] = [
    { word: "रणे जित्वा दैत्यान्", transliteration: "raṇe jitvā daityān", meaning: "having conquered demons in battle" },
    { word: "अपहृत-शिरस्त्रैः कवचिभिः", transliteration: "apahṛta-śirastraiḥ kavacibhiḥ", meaning: "with helmets removed, armored" },
    { word: "निवृत्तैः", transliteration: "nivṛttaiḥ", meaning: "returned (from battle)" },
    { word: "चण्ड-अंश-त्रिपुर-हर-निर्माल्य-विमुखैः", transliteration: "caṇḍa-aṃśa-tripura-hara-nirmālya-vimukhaiḥ", meaning: "who refuse Shiva's Nirmalya (leftovers)" },
    { word: "विशाख-इन्द्र-उपेन्द्रैः", transliteration: "viśākha-indra-upendraḥ", meaning: "Kartikeya, Indra, and Vishnu" },
    { word: "शशि-विशद-कर्पूर-शकलाः", transliteration: "śaśi-viśada-karpūra-śakalāḥ", meaning: "white as moonlight and camphor" },
    { word: "विलीयन्ते मातः", transliteration: "vilīyante mātaḥ", meaning: "dissolve, O Mother" },
    { word: "तव वदन-ताम्बूल-कबलाः", transliteration: "tava vadana-tāmbūla-kabalāḥ", meaning: "the morsels of betel from Your mouth" }
  ];

  W[66] = [
    { word: "विपञ्च्या गायन्ती", transliteration: "vipañcyā gāyantī", meaning: "singing on the Veena" },
    { word: "विविधम् अपदानं पशुपतेः", transliteration: "vividham apadānaṃ paśupateḥ", meaning: "the varied glories of Pashupati" },
    { word: "त्वया आरब्धे वक्तुं", transliteration: "tvayā ārabdhe vaktuṃ", meaning: "when You begin to sing" },
    { word: "चलित-शिरसा साधु-वचने", transliteration: "calita-śirasā sādhu-vacane", meaning: "with head nodding, saying 'Excellent!'" },
    { word: "तदीयैः माधुर्यैः", transliteration: "tadīyaiḥ mādhuryaiḥ", meaning: "by that sweetness (of Yours)" },
    { word: "अपलपित-तन्त्री-कल-रवां", transliteration: "apalapita-tantrī-kala-ravāṃ", meaning: "her Veena's melody made discordant" },
    { word: "निजां वीणां वाणी", transliteration: "nijāṃ vīṇāṃ vāṇī", meaning: "her own Veena, Saraswati" },
    { word: "निचुलयति चोलेन निभृतम्", transliteration: "niculayati colena nibhṛtam", meaning: "quietly hides under her garment" }
  ];

  W[67] = [
    { word: "कर-अग्रेण स्पृष्टं", transliteration: "kara-agreṇa spṛṣṭaṃ", meaning: "touched by the fingertips" },
    { word: "तुहिन-गिरिणा वात्सल्यतया", transliteration: "tuhiṇa-giriṇā vātsalyatayā", meaning: "by Himavan with paternal love" },
    { word: "गिरीशेन उदस्तं", transliteration: "girīśena udastaṃ", meaning: "lifted by Girisha (Shiva)" },
    { word: "मुहुः अधर-पान-आकुलतया", transliteration: "muhuḥ adhara-pāna-ākulatayā", meaning: "repeatedly, eager to drink from Your lips" },
    { word: "कर-ग्राह्यं शम्भोः", transliteration: "kara-grāhyaṃ śambhoḥ", meaning: "grasped by Shambhu's hand" },
    { word: "मुख-मुकुर-वृन्तं", transliteration: "mukha-mukura-vṛntaṃ", meaning: "as the handle of the mirror of Your face" },
    { word: "गिरि-सुते", transliteration: "giri-sute", meaning: "O daughter of the mountain" },
    { word: "कथं-कारं ब्रूमः", transliteration: "kathaṃ-kāraṃ brūmaḥ", meaning: "how can we describe" },
    { word: "तव चिबुकम्", transliteration: "tava cibukam", meaning: "Your chin" },
    { word: "औपम्य-रहितम्", transliteration: "aupamya-rahitam", meaning: "beyond comparison" }
  ];

  W[68] = [
    { word: "भुज-आश्लेषात् नित्यं", transliteration: "bhuja-āśleṣāt nityaṃ", meaning: "from Shiva's constant embrace" },
    { word: "पुर-दमयितुः", transliteration: "pura-damayituḥ", meaning: "of the destroyer of Tripura" },
    { word: "कण्टकवती", transliteration: "kaṇṭakavatī", meaning: "bearing goosebumps" },
    { word: "तव ग्रीवा धत्ते", transliteration: "tava grīvā dhatte", meaning: "Your neck bears" },
    { word: "मुख-कमल-नाल-श्रियम् इयम्", transliteration: "mukha-kamala-nāla-śriyam iyam", meaning: "the beauty of the lotus-stem of Your face" },
    { word: "स्वतः श्वेता", transliteration: "svataḥ śvetā", meaning: "naturally white" },
    { word: "काल-अगुरु-बहुल-जम्बाल-मलिना", transliteration: "kāla-aguru-bahula-jambāla-malinā", meaning: "darkened by aloe paste" },
    { word: "मृणाली-लालित्यं वहति", transliteration: "mṛṇālī-lālityaṃ vahati", meaning: "possesses the grace of a lotus fiber" },
    { word: "यत् अधः हार-लतिका", transliteration: "yat adhaḥ hāra-latikā", meaning: "the pearl necklace below" }
  ];

  W[69] = [
    { word: "गले रेखाः तिस्रः", transliteration: "gale rekhāḥ tisraḥ", meaning: "three lines on the neck" },
    { word: "गति-गमक-गीत-एक-निपुणे", transliteration: "gati-gamaka-gīta-eka-nipuṇe", meaning: "O Lady skilled in Gati, Gamaka, and Gita" },
    { word: "विवाह-व्यानद्ध-प्रगुण-गुण-संख्या-प्रतिभुवः", transliteration: "vivāha-vyānaddha-praguṇa-guṇa-saṃkhyā-pratibhuvaḥ", meaning: "representing the three threads of the marriage cord" },
    { word: "विराजन्ते", transliteration: "virājante", meaning: "they shine" },
    { word: "नाना-विध-मधुर-राग-आकर-भुवां", transliteration: "nānā-vidha-madhura-rāga-ākara-bhuvāṃ", meaning: "sources of various sweet Ragas" },
    { word: "त्रयाणां ग्रामाणां", transliteration: "trayāṇāṃ grāmāṇāṃ", meaning: "of the three musical Gramas" },
    { word: "स्थिति-नियम-सीमानः इव ते", transliteration: "sthiti-niyama-sīmānaḥ iva te", meaning: "as the boundaries and rules, Your" }
  ];

  W[70] = [
    { word: "मृणाली-मृद्वीनां", transliteration: "mṛṇālī-mṛdvīnāṃ", meaning: "soft as lotus stalks" },
    { word: "तव भुज-लतानां चतसृणां", transliteration: "tava bhuja-latānāṃ catasṛṇāṃ", meaning: "of Your four arm-creepers" },
    { word: "चतुर्भिः सौन्दर्यं", transliteration: "caturbhiḥ saundaryaṃ", meaning: "the beauty, with four" },
    { word: "सरसिज-भवः स्तौति वदनैः", transliteration: "sarasija-bhavaḥ stauti vadanaiḥ", meaning: "Brahma praises with his faces" },
    { word: "नखेभ्यः संत्रस्यन्", transliteration: "nakhebhyaḥ saṃtrasyan", meaning: "frightened of the nails" },
    { word: "प्रथम-मथनात्", transliteration: "prathama-mathanāt", meaning: "from the first cutting" },
    { word: "अन्धक-रिपोः", transliteration: "andhaka-ripoḥ", meaning: "by the enemy of Andhaka (Shiva)" },
    { word: "चतुर्णां शीर्षाणां", transliteration: "caturṇāṃ śīrṣāṇāṃ", meaning: "of his four heads" },
    { word: "समम् अभय-हस्त-अर्पण-धिया", transliteration: "samam abhaya-hasta-arpaṇa-dhiyā", meaning: "simultaneously offering fearlessness" }
  ];

  W[71] = [
    { word: "नखानाम् उद्द्योतैः", transliteration: "nakhānām uddyotaiḥ", meaning: "with the radiance of the nails" },
    { word: "नव-नलिन-रागं विहसतां", transliteration: "nava-nalina-rāgaṃ vihasatāṃ", meaning: "mocking the redness of fresh lotuses" },
    { word: "कराणां ते कान्तिं", transliteration: "karāṇāṃ te kāntiṃ", meaning: "the beauty of Your hands" },
    { word: "कथय कथयामः कथम् उमे", transliteration: "kathaya kathayāmaḥ katham ume", meaning: "tell us, how can we describe, O Uma" },
    { word: "कयाचित् वा साम्यं", transliteration: "kayācit vā sāmyaṃ", meaning: "some similarity perhaps" },
    { word: "भजतु कलया", transliteration: "bhajatu kalayā", meaning: "may it claim by a fraction" },
    { word: "हन्त कमलं", transliteration: "hanta kamalaṃ", meaning: "alas, the lotus" },
    { word: "यदि", transliteration: "yadi", meaning: "if" },
    { word: "क्रीडत्-लक्ष्मी-चरण-तल-लाक्षा-रस-चणम्", transliteration: "krīḍat-lakṣmī-caraṇa-tala-lākṣā-rasa-caṇam", meaning: "stained with lac-dye from playful Lakshmi's soles" }
  ];

  W[72] = [
    { word: "समं देवि", transliteration: "samaṃ devi", meaning: "equally, O Devi" },
    { word: "स्कन्द-द्विप-वदन-पीतं", transliteration: "skanda-dvipa-vadana-pītaṃ", meaning: "suckled by Skanda and elephant-faced (Ganesha)" },
    { word: "स्तन-युगं", transliteration: "stana-yugaṃ", meaning: "the pair of breasts" },
    { word: "तव इदं", transliteration: "tava idaṃ", meaning: "this of Yours" },
    { word: "नः खेदं हरतु", transliteration: "naḥ khedaṃ haratu", meaning: "may it remove our sorrow" },
    { word: "सततं प्रस्नुत-मुखम्", transliteration: "satataṃ prasnuta-mukham", meaning: "constantly flowing with milk" },
    { word: "यत् आलोक्य", transliteration: "yat ālokya", meaning: "seeing which" },
    { word: "आशङ्का-कुलित-हृदयः", transliteration: "āśaṅkā-kulita-hṛdayaḥ", meaning: "with heart confused by doubt" },
    { word: "हास-जनकः", transliteration: "hāsa-janakaḥ", meaning: "causing laughter" },
    { word: "स्व-कुम्भौ हेरम्बः", transliteration: "sva-kumbhau herambaḥ", meaning: "his own head-globes, Ganesha" },
    { word: "परिमृशति हस्तेन झडिति", transliteration: "parimṛśati hastena jhaḍiti", meaning: "quickly touches with his hand" }
  ];

  W[73] = [
    { word: "अमू ते वक्षोजौ", transliteration: "amū te vakṣojau", meaning: "these breasts of Yours" },
    { word: "अमृत-रस-माणिक्य-कुतुपौ", transliteration: "amṛta-rasa-māṇikya-kutupau", meaning: "gem-studded vessels of nectar" },
    { word: "न सन्देह-स्पन्दः", transliteration: "na sandeha-spaṇdaḥ", meaning: "no quiver of doubt" },
    { word: "नग-पति-पताके", transliteration: "naga-pati-patāke", meaning: "O banner of the Mountain King" },
    { word: "मनसि नः", transliteration: "manasi naḥ", meaning: "in our minds" },
    { word: "पिबन्तौ तौ यस्मात्", transliteration: "pibantau tau yasmāt", meaning: "for having drunk from them" },
    { word: "अविदित-वधू-सङ्ग-रसिकौ", transliteration: "avidita-vadhū-saṅga-rasikau", meaning: "unaware of the pleasures of married life" },
    { word: "कुमारौ अद्य अपि", transliteration: "kumārau adya api", meaning: "remain youthful even today" },
    { word: "द्विरद-वदन-क्रौञ्च-दलनौ", transliteration: "dvirada-vadana-krauñca-dalanau", meaning: "the elephant-faced (Ganesha) and the Krauncha-destroyer (Skanda)" }
  ];

  W[74] = [
    { word: "वहति अम्ब", transliteration: "vahati amba", meaning: "bears, O Mother" },
    { word: "स्तम्भेरम-दनुज-कुम्भ-प्रकृतिभिः", transliteration: "stambherama-danuja-kumbha-prakṛtibhiḥ", meaning: "rivaling Airavata elephant's frontal globes" },
    { word: "समारब्धां", transliteration: "samārabdhāṃ", meaning: "begun/strung" },
    { word: "मुक्ता-मणिभिः अमलां", transliteration: "muktā-maṇibhiḥ amalāṃ", meaning: "with pure pearls" },
    { word: "हार-लतिकाम्", transliteration: "hāra-latikām", meaning: "the pearl necklace" },
    { word: "कुच-आभोगः", transliteration: "kuca-ābhogaḥ", meaning: "Your bosom" },
    { word: "बिम्ब-अधर-रुचिभिः अन्तः शबलितां", transliteration: "bimba-adhara-rucibhiḥ antaḥ śabalitāṃ", meaning: "intermingled with red reflections from Your lips" },
    { word: "प्रताप-व्यामिश्रां", transliteration: "pratāpa-vyāmiśrāṃ", meaning: "mixed with valor" },
    { word: "पुर-दमयितुः कीर्तिम् इव ते", transliteration: "pura-damayituḥ kīrtim iva te", meaning: "like the fame of the destroyer of Tripura" }
  ];

  W[75] = [
    { word: "तव स्तन्यं मन्ये", transliteration: "tava stanyaṃ manye", meaning: "Your breast-milk I believe" },
    { word: "धरणि-धर-कन्ये", transliteration: "dharaṇi-dhara-kanye", meaning: "O daughter of the Mountain" },
    { word: "हृदयतः", transliteration: "hṛdayataḥ", meaning: "from the heart" },
    { word: "पयः-पारावारः", transliteration: "payaḥ-pārāvāraḥ", meaning: "an ocean of milk" },
    { word: "परिवहति", transliteration: "parivahati", meaning: "flows" },
    { word: "सारस्वतम् इव", transliteration: "sārasvatam iva", meaning: "like the essence of Saraswati" },
    { word: "दया-वत्या दत्तं", transliteration: "dayā-vatyā dattaṃ", meaning: "compassionately given" },
    { word: "द्रविड-शिशुः आस्वाद्य", transliteration: "draviḍa-śiśuḥ āsvādya", meaning: "the Dravida child having tasted" },
    { word: "तव यत्", transliteration: "tava yat", meaning: "that of Yours which" },
    { word: "कवीनां प्रौढानाम्", transliteration: "kavīnāṃ prauḍhānām", meaning: "among accomplished poets" },
    { word: "अजनि कमनीयः कवयिता", transliteration: "ajani kamanīyaḥ kavayitā", meaning: "became a charming poet" }
  ];

  W[76] = [
    { word: "हर-क्रोध-ज्वाला-आवलिभिः", transliteration: "hara-krodha-jvālā-āvalibhiḥ", meaning: "by the flames of Shiva's anger" },
    { word: "अवलीढेन वपुषा", transliteration: "avalīḍhena vapuṣā", meaning: "with body licked (burned)" },
    { word: "गभीरे ते नाभी-सरसि", transliteration: "gabhīre te nābhī-sarasi", meaning: "in the deep lake of Your navel" },
    { word: "कृत-सङ्गः मनसिजः", transliteration: "kṛta-saṅgaḥ manasijaḥ", meaning: "took refuge, Kamadeva" },
    { word: "समुत्तस्थौ तस्मात्", transliteration: "samuttasthau tasmāt", meaning: "arose from there" },
    { word: "अचल-तनये", transliteration: "acala-tanaye", meaning: "O daughter of the mountain" },
    { word: "धूम-लतिका", transliteration: "dhūma-latikā", meaning: "a tendril of smoke" },
    { word: "जनः तां जानीते", transliteration: "janaḥ tāṃ jānīte", meaning: "people know it as" },
    { word: "तव जननि रोम-आवलिः इति", transliteration: "tava janani roma-āvaliḥ iti", meaning: "Your line of hair, O Mother" }
  ];

  W[77] = [
    { word: "यत् एतत्", transliteration: "yat etat", meaning: "that which" },
    { word: "कालिन्दी-तनु-तर-तरङ्ग-आकृति", transliteration: "kālindī-tanu-tara-taraṅga-ākṛti", meaning: "resembling slender waves of the Yamuna" },
    { word: "शिवे", transliteration: "śive", meaning: "O Shive" },
    { word: "कृशे मध्ये", transliteration: "kṛśe madhye", meaning: "on the slender waist" },
    { word: "किञ्चित् जननि", transliteration: "kiñcit janani", meaning: "somewhat, O Mother" },
    { word: "तव यत् भाति सुधियाम्", transliteration: "tava yat bhāti sudhiyām", meaning: "that which appears to the wise" },
    { word: "विमर्दात् अन्योन्यं", transliteration: "vimardāt anyonyaṃ", meaning: "from mutual pressing" },
    { word: "कुच-कलशयोः अन्तर-गतं", transliteration: "kuca-kalaśayoḥ antara-gataṃ", meaning: "between the pitcher-like breasts" },
    { word: "तनू-भूतं व्योम", transliteration: "tanū-bhūtaṃ vyoma", meaning: "compressed ether/space" },
    { word: "प्रविशत् इव नाभिं कुहरिणीम्", transliteration: "praviśat iva nābhiṃ kuhariṇīm", meaning: "as if entering the hollow navel" }
  ];

  W[78] = [
    { word: "स्थिरः गङ्गा-आवर्तः", transliteration: "sthiraḥ gaṅgā-āvartaḥ", meaning: "a steady whirlpool of the Ganga" },
    { word: "स्तन-मुकुल-रोम-आवलि-लता", transliteration: "stana-mukula-roma-āvali-latā", meaning: "the hair-line creeper from breast-buds" },
    { word: "कल-आवालं कुण्डं", transliteration: "kala-āvālaṃ kuṇḍaṃ", meaning: "a pit/basin for the creeper" },
    { word: "कुसुम-शर-तेजः-हुतभुजः", transliteration: "kusuma-śara-tejaḥ-hutabhujaḥ", meaning: "fire-pit of Kamadeva's energy" },
    { word: "रतेः लीला-आगारं", transliteration: "rateḥ līlā-āgāraṃ", meaning: "a pleasure-house of Rati" },
    { word: "किम् अपि", transliteration: "kim api", meaning: "something indescribable" },
    { word: "तव नाभिः गिरि-सुते", transliteration: "tava nābhiḥ giri-sute", meaning: "Your navel, O daughter of the mountain" },
    { word: "बिल-द्वारं सिद्धेः", transliteration: "bila-dvāraṃ siddheḥ", meaning: "a gateway to Siddhi" },
    { word: "गिरिश-नयनानां विजयते", transliteration: "giriśa-nayanānāṃ vijayate", meaning: "for Shiva's eyes, it triumphs" }
  ];

  W[79] = [
    { word: "निसर्ग-क्षीणस्य", transliteration: "nisarga-kṣīṇasya", meaning: "naturally slender" },
    { word: "स्तन-तट-भरेण", transliteration: "stana-taṭa-bhareṇa", meaning: "by the weight of the breasts" },
    { word: "क्लम-जुषः", transliteration: "klama-juṣaḥ", meaning: "fatigued" },
    { word: "नमत्-मूर्तेः", transliteration: "namat-mūrteḥ", meaning: "of the bending form" },
    { word: "नारी-तिलक", transliteration: "nārī-tilaka", meaning: "O Tilaka among women" },
    { word: "शनकैः त्रुट्यत इव", transliteration: "śanakaiḥ truṭyata iva", meaning: "seeming about to break slowly" },
    { word: "चिरं ते मध्यस्य", transliteration: "ciraṃ te madhyasya", meaning: "for long, of Your waist" },
    { word: "त्रुटित-तटिनी-तीर-तरुणा", transliteration: "truṭita-taṭinī-tīra-taruṇā", meaning: "like a young tree on an eroding riverbank" },
    { word: "सम-अवस्था-स्थेम्नः", transliteration: "sama-avasthā-sthemnaḥ", meaning: "of the stability of its condition" },
    { word: "भवतु कुशलं", transliteration: "bhavatu kuśalaṃ", meaning: "may there be well-being" },
    { word: "शैल-तनये", transliteration: "śaila-tanaye", meaning: "O daughter of the mountain" }
  ];

  W[80] = [
    { word: "कुचौ सद्यः-स्विद्यत्-तट-घटित-कूर्पास-भिदुरौ", transliteration: "kucau sadyaḥ-svidyat-taṭa-ghaṭita-kūrpāsa-bhidurau", meaning: "breasts bursting the perspiring bodice" },
    { word: "कषन्तौ दोर्-मूले", transliteration: "kaṣantau dor-mūle", meaning: "chafing at the arms' base" },
    { word: "कनक-कलश-आभौ", transliteration: "kanaka-kalaśa-ābhau", meaning: "resembling golden pots" },
    { word: "कलयता", transliteration: "kalayatā", meaning: "by the one who perceives" },
    { word: "तव त्रातुं भङ्गात्", transliteration: "tava trātuṃ bhaṅgāt", meaning: "to save Your (waist) from breaking" },
    { word: "अलम् इति", transliteration: "alam iti", meaning: "saying 'enough'" },
    { word: "वलग्नं तनु-भुवा", transliteration: "valagnaṃ tanu-bhuvā", meaning: "bound at the waist by Kamadeva" },
    { word: "त्रिधा नद्धं देवि", transliteration: "tridhā naddhaṃ devi", meaning: "tied thrice, O Devi" },
    { word: "त्रि-वलि-लवली-वल्लिभिः इव", transliteration: "tri-vali-lavalī-vallibhiḥ iva", meaning: "with the three folds like creeper-vines" }
  ];

  W[81] = [
    { word: "गुरुत्वं विस्तारं", transliteration: "gurutvaṃ vistāraṃ", meaning: "heaviness and breadth" },
    { word: "क्षिति-धर-पतिः", transliteration: "kṣiti-dhara-patiḥ", meaning: "the Mountain King" },
    { word: "पार्वति निजात्", transliteration: "pārvati nijāt", meaning: "O Parvati, from his own" },
    { word: "नितम्बात् आच्छिद्य", transliteration: "nitambāt ācchidya", meaning: "having stolen from his slopes" },
    { word: "त्वयि हरण-रूपेण निदधे", transliteration: "tvayi haraṇa-rūpeṇa nidadhe", meaning: "bestowed upon You as a gift" },
    { word: "अतः ते विस्तीर्णः", transliteration: "ataḥ te vistīrṇaḥ", meaning: "therefore Your expansive" },
    { word: "गुरुः अयम्", transliteration: "guruḥ ayam", meaning: "heavy this" },
    { word: "अशेषां वसुमतीं", transliteration: "aśeṣāṃ vasumatīṃ", meaning: "the entire Earth" },
    { word: "नितम्ब-प्राग्भारः", transliteration: "nitamba-prāgbhāraḥ", meaning: "the weight of the hips" },
    { word: "स्थगयति", transliteration: "sthagayati", meaning: "conceals/surpasses" },
    { word: "लघुत्वं नयति च", transliteration: "laghutvaṃ nayati ca", meaning: "and makes it seem light" }
  ];

  W[82] = [
    { word: "करि-इन्द्राणां शुण्डान्", transliteration: "kari-indrāṇāṃ śuṇḍān", meaning: "elephant trunks" },
    { word: "कनक-कदली-काण्ड-पटलीम्", transliteration: "kanaka-kadalī-kāṇḍa-paṭalīm", meaning: "and golden plantain stems" },
    { word: "उभाभ्याम् ऊरुभ्याम्", transliteration: "ubhābhyām ūrubhyām", meaning: "with both thighs" },
    { word: "उभयम् अपि निर्जित्य भवती", transliteration: "ubhayam api nirjitya bhavatī", meaning: "surpassing both, You" },
    { word: "सु-वृत्ताभ्यां पत्युः", transliteration: "su-vṛttābhyāṃ patyuḥ", meaning: "well-rounded, before Your Lord" },
    { word: "प्रणति-कठिनाभ्यां", transliteration: "praṇati-kaṭhinābhyāṃ", meaning: "hardened by prostration" },
    { word: "गिरि-सुते", transliteration: "giri-sute", meaning: "O daughter of the mountain" },
    { word: "विधि-ज्ञे जानुभ्यां", transliteration: "vidhi-jñe jānubhyāṃ", meaning: "O knower of rites, with knees" },
    { word: "विबुध-करि-कुम्भ-द्वयम् असि", transliteration: "vibudha-kari-kumbha-dvayam asi", meaning: "You rival Airavata's frontal globes" }
  ];

  W[83] = [
    { word: "पराजेतुं रुद्रं", transliteration: "parājetuṃ rudraṃ", meaning: "to conquer Rudra" },
    { word: "द्वि-गुण-शर-गर्भौ", transliteration: "dvi-guṇa-śara-garbhau", meaning: "carrying double the arrows" },
    { word: "गिरि-सुते", transliteration: "giri-sute", meaning: "O daughter of the mountain" },
    { word: "निषङ्गौ जङ्घे ते", transliteration: "niṣaṅgau jaṅghe te", meaning: "Your calves are two quivers" },
    { word: "विषम-विशिखः बाढम् अकृत", transliteration: "viṣama-viśikhaḥ bāḍham akṛta", meaning: "the odd-arrowed (Kama) has indeed made" },
    { word: "यत्-अग्रे दृश्यन्ते", transliteration: "yat-agre dṛśyante", meaning: "at whose tips are seen" },
    { word: "दश-शर-फलाः", transliteration: "daśa-śara-phalāḥ", meaning: "ten arrowheads" },
    { word: "पाद-युगली-नख-अग्र-छद्मानः", transliteration: "pāda-yugalī-nakha-agra-chadmānaḥ", meaning: "disguised as Your toenails" },
    { word: "सुर-मकुट-शाण-एक-निशिताः", transliteration: "sura-makuṭa-śāṇa-eka-niśitāḥ", meaning: "sharpened on the whetstone of gods' crowns" }
  ];

  W[84] = [
    { word: "श्रुतीनां मूर्धानः", transliteration: "śrutīnāṃ mūrdhānaḥ", meaning: "the Vedas on their heads" },
    { word: "दधति तव यौ शेखरतया", transliteration: "dadhati tava yau śekharatayā", meaning: "bear Your (feet) as a crown" },
    { word: "मम अपि एतौ मातः", transliteration: "mama api etau mātaḥ", meaning: "upon my head also, O Mother" },
    { word: "शिरसि दयया धेहि चरणौ", transliteration: "śirasi dayayā dhehi caraṇau", meaning: "place Your feet with compassion" },
    { word: "ययोः पाद्यं पाथः", transliteration: "yayoḥ pādyaṃ pāthaḥ", meaning: "the water washing those feet" },
    { word: "पशुपति-जटा-जूट-तटिनी", transliteration: "paśupati-jaṭā-jūṭa-taṭinī", meaning: "becomes the Ganga in Shiva's matted locks" },
    { word: "ययोः लाक्षा-लक्ष्मीः", transliteration: "yayoḥ lākṣā-lakṣmīḥ", meaning: "the red lac on those feet" },
    { word: "अरुण-हरि-चूडामणि-रुचिः", transliteration: "aruṇa-hari-cūḍāmaṇi-ruciḥ", meaning: "outshines Vishnu's red crest-jewel" }
  ];

  W[85] = [
    { word: "नमः-वाकं ब्रूमः", transliteration: "namaḥ-vākaṃ brūmaḥ", meaning: "we utter words of salutation" },
    { word: "नयन-रमणीयाय पदयोः", transliteration: "nayana-ramaṇīyāya padayoḥ", meaning: "to the eye-delighting pair of feet" },
    { word: "तव अस्मै द्वन्द्वाय", transliteration: "tava asmai dvandvāya", meaning: "to this pair of Yours" },
    { word: "स्फुट-रुचिर-सालक्तकवते", transliteration: "sphuṭa-rucira-sālaktakavate", meaning: "brilliantly adorned with red lac" },
    { word: "असूयति अत्यन्तं", transliteration: "asūyati atyantaṃ", meaning: "is extremely jealous" },
    { word: "यत् अभिहननाय स्पृहयते", transliteration: "yat abhihananāya spṛhayate", meaning: "desires to be struck by (Your feet)" },
    { word: "पशूनाम् ईशानः", transliteration: "paśūnām īśānaḥ", meaning: "Pashupati (Shiva)" },
    { word: "प्रमद-वन-कङ्केलि-तरवे", transliteration: "pramada-vana-kaṅkeli-tarave", meaning: "of the Ashoka tree in the pleasure garden" }
  ];

  W[86] = [
    { word: "मृषा कृत्वा", transliteration: "mṛṣā kṛtvā", meaning: "deliberately making" },
    { word: "गोत्र-स्खलनम्", transliteration: "gotra-skhalanam", meaning: "a slip of name (mispronouncing)" },
    { word: "अथ वैलक्ष्य-नमितं", transliteration: "atha vailakṣya-namitaṃ", meaning: "then bowing in embarrassment" },
    { word: "ललाटे भर्तारं", transliteration: "lalāṭe bhartāraṃ", meaning: "on the forehead, Your husband" },
    { word: "चरण-कमले ताडयति ते", transliteration: "caraṇa-kamale tāḍayati te", meaning: "You kick with Your lotus foot" },
    { word: "चिरात् अन्तः-शल्यं", transliteration: "cirāt antaḥ-śalyaṃ", meaning: "the long-held inner thorn" },
    { word: "दहन-कृतम् उन्मूलितवता", transliteration: "dahana-kṛtam unmūlitavatā", meaning: "from being burnt, now uprooted" },
    { word: "तुला-कोटि-क्वाणैः", transliteration: "tulā-koṭi-kvāṇaiḥ", meaning: "with jingling anklet sounds" },
    { word: "किलकिलितम्", transliteration: "kilakilitam", meaning: "laughter" },
    { word: "ईशान-रिपुणा", transliteration: "īśāna-ripuṇā", meaning: "by Kamadeva (Shiva's enemy)" }
  ];

  W[87] = [
    { word: "हिमानी-हन्तव्यं", transliteration: "himānī-hantavyaṃ", meaning: "frost is to be destroyed" },
    { word: "हिम-गिरि-निवास-एक-चतुरौ", transliteration: "hima-giri-nivāsa-eka-caturau", meaning: "skilled in dwelling on the snow mountain" },
    { word: "निशायां निद्राणं", transliteration: "niśāyāṃ nidrāṇaṃ", meaning: "sleeping at night (lotuses close)" },
    { word: "निशि चरम-भागे च विशदौ", transliteration: "niśi carama-bhāge ca viśadau", meaning: "shining in the last part of night" },
    { word: "वरं लक्ष्मी-पात्रं", transliteration: "varaṃ lakṣmī-pātraṃ", meaning: "merely the abode of Lakshmi" },
    { word: "श्रियम् अतिसृजन्तौ समयिनां", transliteration: "śriyam atisṛjantau samayināṃ", meaning: "bestowing prosperity exceeding hers upon devotees" },
    { word: "सरोजं त्वत्-पादौ", transliteration: "sarojaṃ tvat-pādau", meaning: "over the lotus, Your feet" },
    { word: "जननि जयतः", transliteration: "janani jayataḥ", meaning: "O Mother, triumph" },
    { word: "चित्रम् इह किम्", transliteration: "citram iha kim", meaning: "what wonder is there" }
  ];

  W[88] = [
    { word: "पदं ते कीर्तीनां", transliteration: "padaṃ te kīrtīnāṃ", meaning: "Your feet, the abode of fame" },
    { word: "प्रपदम् अपदं देवि विपदां", transliteration: "prapadam apadaṃ devi vipadāṃ", meaning: "the forefoot, destroyer of misfortune, O Devi" },
    { word: "कथं नीतं सद्भिः", transliteration: "kathaṃ nītaṃ sadbhiḥ", meaning: "how was it compared by the wise" },
    { word: "कठिन-कमठी-कर्पर-तुलाम्", transliteration: "kaṭhina-kamaṭhī-karpara-tulām", meaning: "to a hard tortoise shell" },
    { word: "कथं वा बाहुभ्याम्", transliteration: "kathaṃ vā bāhubhyām", meaning: "and how with (His) arms" },
    { word: "उपयमन-काले", transliteration: "upayamana-kāle", meaning: "at the time of marriage" },
    { word: "पुर-भिदा", transliteration: "pura-bhidā", meaning: "by Shiva (destroyer of Tripura)" },
    { word: "यत् आदाय न्यस्तं", transliteration: "yat ādāya nyastaṃ", meaning: "was taken and placed" },
    { word: "दृषदि", transliteration: "dṛṣadi", meaning: "on the grinding stone" },
    { word: "दयमानेन मनसा", transliteration: "dayamānena manasā", meaning: "with a compassionate heart" }
  ];

  W[89] = [
    { word: "नखैः नाक-स्त्रीणां", transliteration: "nakhaiḥ nāka-strīṇāṃ", meaning: "by the nails, celestial women's" },
    { word: "कर-कमल-संकोच-शशिभिः", transliteration: "kara-kamala-saṃkoca-śaśibhiḥ", meaning: "whose moon-radiance closes their lotus-hands" },
    { word: "तरूणां दिव्यानां", transliteration: "tarūṇāṃ divyānāṃ", meaning: "of the divine (wish-fulfilling) trees" },
    { word: "हसत इव ते चण्डि चरणौ", transliteration: "hasata iva te caṇḍi caraṇau", meaning: "as if laughing at them, O Chandi, Your feet" },
    { word: "फलानि स्वः-स्थेभ्यः", transliteration: "phalāni svaḥ-sthebhyaḥ", meaning: "giving fruits to heaven-dwellers" },
    { word: "किसलय-कर-अग्रेण ददतां", transliteration: "kisalaya-kara-agreṇa dadatāṃ", meaning: "with tender shoot-like hands" },
    { word: "दरिद्रेभ्यः भद्रां", transliteration: "daridrebhyaḥ bhadrāṃ", meaning: "upon the destitute, auspicious" },
    { word: "श्रियम् अनिशम् अह्नाय ददतौ", transliteration: "śriyam aniśam ahnāya dadatau", meaning: "bestowing wealth perpetually and instantly" }
  ];

  W[90] = [
    { word: "ददाने दीनेभ्यः", transliteration: "dadāne dīnebhyaḥ", meaning: "granting to the destitute" },
    { word: "श्रियम् अनिशम् आशा-अनुसदृशीम्", transliteration: "śriyam aniśam āśā-anusadṛśīm", meaning: "wealth perpetually matching their desires" },
    { word: "अमन्दं", transliteration: "amandaṃ", meaning: "abundantly" },
    { word: "सौन्दर्य-प्रकर-मकरन्दं विकिरति", transliteration: "saundarya-prakara-makarandaṃ vikirati", meaning: "scattering nectar of beauty's essence" },
    { word: "तव अस्मिन् मन्दार-स्तबक-सुभगे", transliteration: "tava asmin mandāra-stabaka-subhage", meaning: "in this beautiful Mandara flower-cluster" },
    { word: "यातु चरणे", transliteration: "yātu caraṇe", meaning: "may (my life) go to Your feet" },
    { word: "निमज्जन्-मज्जीवः", transliteration: "nimajjan-majjīvaḥ", meaning: "drowning, my life-breath" },
    { word: "करण-चरणः", transliteration: "karaṇa-caraṇaḥ", meaning: "with faculties as legs" },
    { word: "षट्-चरणताम्", transliteration: "ṣaṭ-caraṇatām", meaning: "becoming a six-legged (bee)" }
  ];

  W[91] = [
    { word: "पद-न्यास-क्रीडा-परिचयम्", transliteration: "pada-nyāsa-krīḍā-paricayam", meaning: "the art of Your dance steps" },
    { word: "इव आरब्धुम् अनसः", transliteration: "iva ārabdhum anasaḥ", meaning: "as if to learn" },
    { word: "स्खलन्तः ते खेलं", transliteration: "skhalantaḥ te khelaṃ", meaning: "stumbling in play" },
    { word: "भवन-कल-हंसाः न जहति", transliteration: "bhavana-kala-haṃsāḥ na jahati", meaning: "the royal swans do not leave" },
    { word: "अतः तेषां शिक्षां", transliteration: "ataḥ teṣāṃ śikṣāṃ", meaning: "therefore to instruct them" },
    { word: "सुभग-मणि-मञ्जीर-रणित", transliteration: "subhaga-maṇi-mañjīra-raṇita", meaning: "through beautiful gem-anklet tinkling" },
    { word: "छलात् आचक्षाणं", transliteration: "chalāt ācakṣāṇaṃ", meaning: "teaching under the pretext of" },
    { word: "चरण-कमलं", transliteration: "caraṇa-kamalaṃ", meaning: "the lotus foot" },
    { word: "चारु-चरिते", transliteration: "cāru-carite", meaning: "O Lady of graceful gait" }
  ];

  W[92] = [
    { word: "गताः ते मञ्चत्वं", transliteration: "gatāḥ te mañcatvaṃ", meaning: "have become the legs of Your couch" },
    { word: "द्रुहिण-हरि-रुद्र-ईश्वर-भृतः", transliteration: "druhiṇa-hari-rudra-īśvara-bhṛtaḥ", meaning: "Brahma, Vishnu, Rudra, and Ishvara" },
    { word: "शिवः", transliteration: "śivaḥ", meaning: "Sadashiva" },
    { word: "स्वच्छ-छाया-घटित-कपट-प्रच्छद-पटः", transliteration: "svaccha-chāyā-ghaṭita-kapaṭa-pracchada-paṭaḥ", meaning: "the transparent coverlet" },
    { word: "त्वदीयानां भासां", transliteration: "tvadīyānāṃ bhāsāṃ", meaning: "of Your radiance" },
    { word: "प्रतिफलन-राग-अरुणतया", transliteration: "pratiphalana-rāga-aruṇatayā", meaning: "reddened by the reflection" },
    { word: "शरीरी शृङ्गारः", transliteration: "śarīrī śṛṅgāraḥ", meaning: "the embodied Shringara" },
    { word: "रसः इव दृशां दोग्धि कुतुकम्", transliteration: "rasaḥ iva dṛśāṃ dogdhi kutukam", meaning: "like a Rasa, milks delight for the eyes" }
  ];

  W[93] = [
    { word: "अराला केशेषु", transliteration: "arālā keśeṣu", meaning: "curly in the hair" },
    { word: "प्रकृति-सरला मन्द-हसिते", transliteration: "prakṛti-saralā manda-hasite", meaning: "naturally simple in the smile" },
    { word: "शिरीष-आभा चित्ते", transliteration: "śirīṣa-ābhā citte", meaning: "delicate as Shirisha in the heart" },
    { word: "दृषत्-उपल-शोभा कुच-तटे", transliteration: "dṛṣat-upala-śobhā kuca-taṭe", meaning: "firm as stone at the bosom" },
    { word: "भृशं तन्वी मध्ये", transliteration: "bhṛśaṃ tanvī madhye", meaning: "very slender at the waist" },
    { word: "पृथुः उरसिज-आरोह-विषये", transliteration: "pṛthuḥ urasija-āroha-viṣaye", meaning: "expansive at the hips" },
    { word: "जगत् त्रातुं", transliteration: "jagat trātuṃ", meaning: "to protect the world" },
    { word: "शम्भोः जयति", transliteration: "śambhoḥ jayati", meaning: "of Shambhu, there triumphs" },
    { word: "करुणा काचित् अरुणा", transliteration: "karuṇā kācit aruṇā", meaning: "some crimson compassion" }
  ];

  W[94] = [
    { word: "कलङ्कः कस्तूरी", transliteration: "kalaṅkaḥ kastūrī", meaning: "the dark spot is musk" },
    { word: "रजनि-कर-बिम्बं जलमयं", transliteration: "rajani-kara-bimbaṃ jalamayaṃ", meaning: "the moon's orb is watery" },
    { word: "कलाभिः कर्पूरैः", transliteration: "kalābhiḥ karpūraiḥ", meaning: "with its digits and camphor" },
    { word: "मरकत-करण्डं निबिडितम्", transliteration: "marakata-karaṇḍaṃ nibiḍitam", meaning: "an emerald casket packed tight" },
    { word: "अतः त्वत्-भोगेन", transliteration: "ataḥ tvat-bhogena", meaning: "therefore by Your use" },
    { word: "प्रतिदिनम् इदं रिक्त-कुहरं", transliteration: "pratidinam idaṃ rikta-kuharaṃ", meaning: "daily this is emptied hollow" },
    { word: "विधिः भूयः भूयः", transliteration: "vidhiḥ bhūyaḥ bhūyaḥ", meaning: "Brahma again and again" },
    { word: "निबिडयति", transliteration: "nibiḍayati", meaning: "refills" },
    { word: "नूनं तव कृते", transliteration: "nūnaṃ tava kṛte", meaning: "surely for Your sake" }
  ];

  W[95] = [
    { word: "पुर-अरातेः अन्तःपुरम् असि", transliteration: "pura-arāteḥ antaḥpuram asi", meaning: "You are Shiva's inner sanctum" },
    { word: "ततः त्वत्-चरणयोः", transliteration: "tataḥ tvat-caraṇayoḥ", meaning: "hence worship of Your feet" },
    { word: "सपर्या-मर्यादा", transliteration: "saparyā-maryādā", meaning: "the privilege of worship" },
    { word: "तरल-करणानाम् असुलभा", transliteration: "tarala-karaṇānām asulabhā", meaning: "is not easy for those with wavering senses" },
    { word: "तथा हि एते नीताः", transliteration: "tathā hi ete nītāḥ", meaning: "for indeed these have attained" },
    { word: "शतमख-मुखाः", transliteration: "śatamakha-mukhāḥ", meaning: "Indra and other gods" },
    { word: "सिद्धिम् अतुलां", transliteration: "siddhim atulāṃ", meaning: "unparalleled Siddhis" },
    { word: "तव द्वार-उपान्त-स्थितिभिः", transliteration: "tava dvāra-upānta-sthitibhiḥ", meaning: "by standing at Your threshold" },
    { word: "अणिमा-आद्याभिः अमराः", transliteration: "aṇimā-ādyābhiḥ amarāḥ", meaning: "Anima and other (Siddhis as) immortals" }
  ];

  W[96] = [
    { word: "कलत्रं वैधात्रं", transliteration: "kalatraṃ vaidhātraṃ", meaning: "the wife of Brahma (Saraswati)" },
    { word: "कति कति भजन्ते न कवयः", transliteration: "kati kati bhajante na kavayaḥ", meaning: "how many poets attain her (poetic genius)" },
    { word: "श्रियः देव्याः कः वा", transliteration: "śriyaḥ devyāḥ kaḥ vā", meaning: "of the goddess Lakshmi, who indeed" },
    { word: "न भवति पतिः कैः अपि धनैः", transliteration: "na bhavati patiḥ kaiḥ api dhanaiḥ", meaning: "does not become lord with some wealth" },
    { word: "महा-देवं हित्वा", transliteration: "mahā-devaṃ hitvā", meaning: "except for Mahadeva" },
    { word: "तव सति", transliteration: "tava sati", meaning: "O Sati, Your" },
    { word: "सतीनाम् अचरमे", transliteration: "satīnām acarame", meaning: "O foremost among faithful wives" },
    { word: "कुचाभ्याम् आसङ्गः", transliteration: "kucābhyām āsaṅgaḥ", meaning: "the embrace of Your breasts" },
    { word: "कुरवक-तरोः अपि असुलभः", transliteration: "kuravaka-taroḥ api asulabhaḥ", meaning: "is unattainable even for the Kuravaka tree" }
  ];

  W[97] = [
    { word: "गिराम् आहुः देवीं", transliteration: "girām āhuḥ devīṃ", meaning: "they call You the Goddess of Speech" },
    { word: "द्रुहिण-गृहिणीम्", transliteration: "druhiṇa-gṛhiṇīm", meaning: "the wife of Brahma (Saraswati)" },
    { word: "आगम-विदः", transliteration: "āgama-vidaḥ", meaning: "the knowers of Agamas" },
    { word: "हरेः पत्नीं पद्मां", transliteration: "hareḥ patnīṃ padmāṃ", meaning: "Padma (Lakshmi), wife of Vishnu" },
    { word: "हर-सहचरीम् अद्रि-तनयाम्", transliteration: "hara-sahacarīm adri-tanayām", meaning: "Shiva's consort, the Mountain's daughter" },
    { word: "तुरीया का अपि त्वं", transliteration: "turīyā kā api tvaṃ", meaning: "You are the indescribable Fourth (Turiya)" },
    { word: "दुर्-अधिगम-निःसीम-महिमा", transliteration: "dur-adhigama-niḥsīma-mahimā", meaning: "of incomprehensible limitless glory" },
    { word: "महा-माया", transliteration: "mahā-māyā", meaning: "the Great Maya" },
    { word: "विश्वं भ्रमयसि", transliteration: "viśvaṃ bhramayasi", meaning: "You spin the universe" },
    { word: "पर-ब्रह्म-महिषि", transliteration: "para-brahma-mahiṣi", meaning: "O Queen of the Absolute" }
  ];

  W[98] = [
    { word: "कदा काले मातः", transliteration: "kadā kāle mātaḥ", meaning: "when, O Mother" },
    { word: "कथय", transliteration: "kathaya", meaning: "tell me" },
    { word: "कलित-अलक्तक-रसं", transliteration: "kalita-alaktaka-rasaṃ", meaning: "adorned with lac-dye" },
    { word: "पिबेयं विद्यार्थी", transliteration: "pibeyaṃ vidyārthī", meaning: "shall I, a student, drink" },
    { word: "तव चरण-निर्णेजन-जलम्", transliteration: "tava caraṇa-nirṇejana-jalam", meaning: "the water washing Your feet" },
    { word: "प्रकृत्या मूकानाम् अपि", transliteration: "prakṛtyā mūkānām api", meaning: "even of the naturally mute" },
    { word: "कविता-कारणतया", transliteration: "kavitā-kāraṇatayā", meaning: "as a cause of poetic power" },
    { word: "कदा धत्ते", transliteration: "kadā dhatte", meaning: "when does it acquire" },
    { word: "वाणी-मुख-कमल-ताम्बूल-रसताम्", transliteration: "vāṇī-mukha-kamala-tāmbūla-rasatām", meaning: "the betel-flavor from Saraswati's lotus-mouth" }
  ];

  W[99] = [
    { word: "सरस्वत्या लक्ष्म्या", transliteration: "sarasvatyā lakṣmyā", meaning: "with Saraswati and Lakshmi" },
    { word: "विधि-हरि-सपत्नः विहरते", transliteration: "vidhi-hari-sapatnaḥ viharate", meaning: "rivaling Brahma and Vishnu, he sports" },
    { word: "रतेः पातिव्रत्यं", transliteration: "rateḥ pātivratyaṃ", meaning: "Rati's fidelity" },
    { word: "शिथिलयति रम्येण वपुषा", transliteration: "śithilayati ramyeṇa vapuṣā", meaning: "he shakes with his charming form" },
    { word: "चिरं जीवन् एव", transliteration: "ciraṃ jīvan eva", meaning: "living long indeed" },
    { word: "क्षपित-पशु-पाश-व्यतिकरः", transliteration: "kṣapita-paśu-pāśa-vyatikaraḥ", meaning: "with all bondages destroyed" },
    { word: "पर-आनन्द-अभिख्यं", transliteration: "para-ānanda-abhikhyaṃ", meaning: "called Para-Ananda" },
    { word: "रसयति रसं", transliteration: "rasayati rasaṃ", meaning: "experiences the bliss" },
    { word: "त्वत्-भजनवान्", transliteration: "tvat-bhajanavān", meaning: "Your devotee" }
  ];

  W[100] = [
    { word: "प्रदीप-ज्वालाभिः", transliteration: "pradīpa-jvālābhiḥ", meaning: "with lamp flames" },
    { word: "दिवसकर-नीराजन-विधिः", transliteration: "divasa-kara-nīrājana-vidhiḥ", meaning: "performing Arati to the Sun" },
    { word: "सुधा-सूतेः", transliteration: "sudhā-sūteḥ", meaning: "of the nectar-producer (Moon)" },
    { word: "चन्द्र-उपल-जल-लवैः अर्घ्य-रचना", transliteration: "candra-upala-jala-lavaiḥ arghya-racanā", meaning: "offering Arghya with moonstone water" },
    { word: "स्वकीयैः अम्भोभिः", transliteration: "svakīyaiḥ ambhobhiḥ", meaning: "with its own waters" },
    { word: "सलिल-निधि-सौहित्य-करणं", transliteration: "salila-nidhi-sauhitya-karaṇaṃ", meaning: "propitiating the ocean" },
    { word: "त्वदीयाभिः वाग्भिः", transliteration: "tvadīyābhiḥ vāgbhiḥ", meaning: "with Your own words" },
    { word: "तव जननि वाचां", transliteration: "tava janani vācāṃ", meaning: "this to You, O Mother of Speech" },
    { word: "स्तुतिः इयम्", transliteration: "stutiḥ iyam", meaning: "is this hymn" }
  ];

  W[101] = [
    { word: "समानीतः पद्भ्यां", transliteration: "samānītaḥ padbhyāṃ", meaning: "brought near Your feet" },
    { word: "मणि-मुकुरताम् अम्बर-मणिः", transliteration: "maṇi-mukuratām ambara-maṇiḥ", meaning: "the sky-gem transformed into a mirror" },
    { word: "भयात् आस्यात्", transliteration: "bhayāt āsyāt", meaning: "from awe of (Your face)" },
    { word: "अन्तः-स्तिमित-किरण-श्रेणिम् असृणः", transliteration: "antaḥ-stimita-kiraṇa-śreṇim asṛṇaḥ", meaning: "with rays softly subdued within" },
    { word: "दधाति त्वत्-वक्त्र-प्रतिफलनम्", transliteration: "dadhāti tvat-vaktra-pratiphalanam", meaning: "reflects Your countenance" },
    { word: "अश्रान्त-विकचं", transliteration: "aśrānta-vikacaṃ", meaning: "perpetually blooming" },
    { word: "निरातङ्कं चन्द्रात्", transliteration: "nirātaṅkaṃ candrāt", meaning: "fearless of the moon" },
    { word: "निज-हृदय-पङ्केरुहम् इव", transliteration: "nija-hṛdaya-paṅkeruham iva", meaning: "like one's own heart-lotus" }
  ];

  W[102] = [
    { word: "समुद्भूत-स्थूल-स्तन-भरम्", transliteration: "samudbhūta-sthūla-stana-bharam", meaning: "with broad chest (like Your full breasts)" },
    { word: "उरः चारु हसितं", transliteration: "uraḥ cāru hasitaṃ", meaning: "charming smile" },
    { word: "कटाक्षे कन्दर्पः", transliteration: "kaṭākṣe kandarpaḥ", meaning: "in sidelong glances, Kamadeva-like" },
    { word: "कतिचन", transliteration: "katicana", meaning: "some few" },
    { word: "कदम्ब-द्युति-वपुः", transliteration: "kadamba-dyuti-vapuḥ", meaning: "with bodies radiant like Kadamba flowers" },
    { word: "हरस्य त्वत्-भ्रान्तिं", transliteration: "harasya tvat-bhrāntiṃ", meaning: "in Shiva's mind the illusion of You" },
    { word: "मनसि जनयन्ति स्म", transliteration: "manasi janayanti sma", meaning: "they create" },
    { word: "विमलाः भवत्याः ये भक्ताः", transliteration: "vimalāḥ bhavatyāḥ ye bhaktāḥ", meaning: "Your pure devotees who" },
    { word: "परिणतिः अमीषाम् इयम् उमे", transliteration: "pariṇatiḥ amīṣām iyam ume", meaning: "this transformation of theirs, O Uma" }
  ];

  W[103] = [
    { word: "निधे नित्य-स्मेरे", transliteration: "nidhe nitya-smere", meaning: "O treasury of ever-smiling grace" },
    { word: "निरवधि-गुणे", transliteration: "niravadhi-guṇe", meaning: "endowed with limitless virtues" },
    { word: "नीति-निपुणे", transliteration: "nīti-nipuṇe", meaning: "skilled in righteous conduct" },
    { word: "निर्-आघात-ज्ञाने", transliteration: "nir-āghāta-jñāne", meaning: "possessor of unassailable knowledge" },
    { word: "नियम-पर-चित्त-एक-निलये", transliteration: "niyama-para-citta-eka-nilaye", meaning: "dwelling in disciplined hearts alone" },
    { word: "नियत्या निर्मुक्ते", transliteration: "niyatyā nirmukte", meaning: "freed by destiny" },
    { word: "निखिल-निगम-अन्त-स्तुति-पदे", transliteration: "nikhila-nigama-anta-stuti-pade", meaning: "praised at the culmination of all Vedas" },
    { word: "निरातङ्के नित्ये", transliteration: "nirātaṅke nitye", meaning: "O fearless and eternal One" },
    { word: "निगमय मम अपि", transliteration: "nigamaya mama api", meaning: "please accept mine also" },
    { word: "स्तुतिम् इमाम्", transliteration: "stutim imām", meaning: "this hymn" }
  ];

  // Apply words to data
  if (typeof SOUNDARYA_LAHARI_DATA !== 'undefined') {
    SOUNDARYA_LAHARI_DATA.forEach(function (s) {
      if (W[s.num]) s.words = W[s.num];
    });
  }
})();
