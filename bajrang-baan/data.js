// Sri Bajrang Baan - Complete Data
// Source: Traditional text attributed to Goswami Tulsidas (16th century)
// With Hindi (Devanagari) original and English translations

const BAJRANG_BAAN_DATA = {
  introDohas: [
    {
      num: 1,
      type: "doha",
      hindi: "निश्चय प्रेम प्रतीति ते, विनय करैं सनमान ।\nतेहि के कारज सकल शुभ, सिद्ध करैं हनुमान ॥",
      transliteration: "Nishchay prem pratiti te, vinay karein sanmaan |\nTehi ke kaaraj sakal shubh, siddh karein Hanumaan ||",
      english: "Those who pray to Hanuman with unwavering love, faith, and humble devotion — Hanuman fulfils all their auspicious desires and brings success in all their endeavours."
    }
  ],
  chaupais: [
    {
      num: 1,
      type: "chaupai",
      hindi: "जय हनुमंत संत हितकारी ।\nसुनि लीजै प्रभु अरज हमारी ॥\nजन के काज विलंब न कीजै ।\nआतुर दौरि महा सुख दीजै ॥",
      transliteration: "Jai Hanumant sant hitkaari |\nSuni leejai Prabhu araj hamaari ||\nJan ke kaaj vilamb na keejai |\nAatur dauri mahaa sukh deejai ||",
      english: "Glory to Hanuman, the benefactor of saints! O Lord, please listen to our humble prayer. Do not delay in fulfilling the tasks of your devotees — rush to us eagerly and bestow great happiness."
    },
    {
      num: 2,
      type: "chaupai",
      hindi: "जैसे कूदि सिंधु महि पारा ।\nसुरसा बदन पैठि बिस्तारा ॥\nआगे जाय लंकिनी रोका ।\nमारेहु लात गई सुर लोका ॥",
      transliteration: "Jaise koodi sindhu mahi paaraa |\nSurasaa badan paithi bistaaraa ||\nAage jaay Lankini rokaa |\nMaarehu laat gai sur lokaa ||",
      english: "Just as you leaped across the great ocean, entered and expanded within Surasa's mouth (outwitting her), and when Lankini the demoness blocked your path ahead, you struck her with a kick and sent her to the heavenly realms."
    },
    {
      num: 3,
      type: "chaupai",
      hindi: "जाय बिभीषन को सुख दीन्हा ।\nसीता निरखि परम पद लीन्हा ॥\nबाग उजारि सिंधु महँ बोरा ।\nअति आतुर जम कातर तोरा ॥",
      transliteration: "Jaay Vibheeshan ko sukh deenhaa |\nSeetaa nirakhi param pad leenhaa ||\nBaag ujaari sindhu mahan boraa |\nAti aatur jam kaatar toraa ||",
      english: "You went and brought comfort to Vibhishana. Upon seeing Sita, you attained the highest spiritual state. You destroyed the Ashoka garden, drowned demons in the ocean, and in great urgency broke the grip of Death's terror."
    },
    {
      num: 4,
      type: "chaupai",
      hindi: "अक्षय कुमार मारि संहारा ।\nलूम लपेटि लंक को जारा ॥\nलाह समान लंक जरि गई ।\nजय जय धुनि सुरपुर नभ भई ॥",
      transliteration: "Akshay Kumaar maari sanhaaraa |\nLoom lapeti Lank ko jaaraa ||\nLaah samaan Lank jari gai |\nJai jai dhuni surpur nabh bhai ||",
      english: "You slew and destroyed Akshay Kumar (Ravana's son). Wrapping your tail with fire, you set Lanka ablaze. Lanka burned like lac, and the triumphant cries of 'Victory! Victory!' resounded through the heavens and the abode of the gods."
    },
    {
      num: 5,
      type: "chaupai",
      hindi: "अब बिलंब केहि कारन स्वामी ।\nकृपा करहु उर अंतरयामी ॥\nजय जय लखन प्रान के दाता ।\nआतुर ह्वै दुख करहु निपाता ॥",
      transliteration: "Ab bilamb kehi kaaran Swaami |\nKripaa karahu ur Antaryaami ||\nJai jai Lakhan praan ke daataa |\nAatur hvai dukh karahu nipaataa ||",
      english: "Why do you delay now, O Master? Have mercy, O Indweller of all hearts! Victory to you, the saviour of Lakshmana's life! Come urgently and destroy all our suffering."
    },
    {
      num: 6,
      type: "chaupai",
      hindi: "जै हनुमान जयति बल सागर ।\nसुर समूह समरथ भट नागर ॥\nॐ हनु हनु हनु हनुमंत हठीले ।\nबैरिहि मारु बज्र की कीले ॥",
      transliteration: "Jai Hanumaan jayati bal saagar |\nSur samooh samarath bhat naagar ||\nOm Hanu Hanu Hanu Hanumant hathile |\nBairihi maaru bajra ki keele ||",
      english: "Victory to Hanuman, the ocean of strength! You are the mightiest, most skilful warrior among all the gods. Om! O determined and resolute Hanuman! Strike down my enemies with your thunderbolt blows."
    },
    {
      num: 7,
      type: "chaupai",
      hindi: "ॐ ह्नीं ह्नीं ह्नीं हनुमंत कपीसा ।\nॐ हुं हुं हुं हनु अरि उर सीसा ॥\nजय अंजनि कुमार बलवंता ।\nशंकरसुवन वीर हनुमंता ॥",
      transliteration: "Om Hneem Hneem Hneem Hanumant Kapeesaa |\nOm Hun Hun Hun Hanu ari ur seesaa ||\nJai Anjani Kumaar Balvantaa |\nShankarsuvan Veer Hanumantaa ||",
      english: "Om Hneem! O Hanuman, Lord of the Vanaras! Om Hun! Strike the enemies on their chests and heads! Victory to the mighty son of Anjani! O valiant Hanuman, offspring of Lord Shankara!"
    },
    {
      num: 8,
      type: "chaupai",
      hindi: "बदन कराल काल कुल घालक ।\nराम सहाय सदा प्रतिपालक ॥\nभूत प्रेत पिसाच निसाचर ।\nअगिन बेताल काल मारी मर ॥",
      transliteration: "Badan karaal kaal kul ghaalak |\nRaam sahaay sadaa pratipaalak ||\nBhoot pret pisaach nisaachar |\nAgin betaal kaal maari mar ||",
      english: "With a terrifying visage, you are the destroyer of Death's clan — ever the ally and protector of Lord Rama. Ghosts, evil spirits, goblins, night-prowlers, fire-demons, vampires, and the messengers of Death — slay them all!"
    },
    {
      num: 9,
      type: "chaupai",
      hindi: "इन्हें मारु तोहि शपथ राम की ।\nराखु नाथ मरजाद नाम की ॥\nजनक सुता हरि दास कहावौ ।\nताकी शपथ विलंब न लावौ ॥",
      transliteration: "Inhen maaru tohi shapath Raam ki |\nRaakhu Naath marjaad naam ki ||\nJanak Sutaa Hari Daas kahaavau |\nTaaki shapath vilamb na laavau ||",
      english: "Destroy these evil forces — I invoke the oath of Lord Rama! O Master, uphold the dignity of your name! If you call yourself a servant of Hari and the daughter of Janaka (Sita), then by that sacred oath, do not delay!"
    },
    {
      num: 10,
      type: "chaupai",
      hindi: "जै जै जै हनुमंत अगाधा ।\nदुख पावत जन केहि अपराधा ॥\nपूजा जप तप नेम अचारा ।\nनहिं जानत कछु दास तुम्हारा ॥",
      transliteration: "Jai jai jai Hanumant agaadhaa |\nDukh paavat jan kehi aparaadhaa ||\nPoojaa jap tap nem achaaraa |\nNahin jaanat kachhu daas tumhaaraa ||",
      english: "Victory, victory, victory to the unfathomable Hanuman! For what offence does your devotee suffer such pain? Your servant knows nothing of elaborate worship, chanting, austerity, or ritual discipline."
    },
    {
      num: 11,
      type: "chaupai",
      hindi: "बन उपबन मग गिरि गृह माहीं ।\nतुम्हरे बल हम डरत नाहीं ॥\nपाँय परौं कर जोरि मनावौं ।\nयहि अवसर अब केहि गोहरावौं ॥",
      transliteration: "Ban upban mag giri grih maaheen |\nTumhre bal ham darat naaheen ||\nPaany paraun kar jori manaavaun |\nYahi avasar ab kehi goharaavaun ||",
      english: "In forests, groves, on roads, on mountains, or at home — by your strength, we fear nothing. I fall at your feet and beseech you with folded hands. In this hour of need, whom else can I call upon?"
    },
    {
      num: 12,
      type: "chaupai",
      hindi: "उठु उठु चलु तोहि राम दुहाई ।\nपाँय परौं कर जोरि मनाई ॥\nॐ चं चं चं चं चपल चलंता ।\nॐ हनु हनु हनु हनु हनुमंता ॥",
      transliteration: "Uthu uthu chalu tohi Raam duhaai |\nPaany paraun kar jori manaai ||\nOm Chan Chan Chan Chan chapal chalantaa |\nOm Hanu Hanu Hanu Hanu Hanumantaa ||",
      english: "Arise, arise, and come forth — I invoke Lord Rama's name! I fall at your feet and entreat you with folded hands! Om! Rush swiftly, O agile one! Om Hanu Hanu Hanu Hanu Hanumanta!"
    },
    {
      num: 13,
      type: "chaupai",
      hindi: "ॐ हं हं हांक देत कपि चंचल ।\nॐ सं सं सहमि पराने खल दल ॥\nअपने जन को तुरत उबारो ।\nसुमिरत होय आनंद हमारो ॥",
      transliteration: "Om Han Han haank det kapi chanchal |\nOm San San sahami paraane khal dal ||\nApne jan ko turat ubaarau |\nSumirat hoy aanand hamaarau ||",
      english: "Om! The restless monkey-warrior roars thunderously! Om! The armies of evil tremble and flee in terror! Rescue your devotees at once — even the mere remembrance of you fills us with bliss."
    },
    {
      num: 14,
      type: "chaupai",
      hindi: "यह बजरंग बाण जेहि मारै ।\nताहि कहौ फिर कौन उबारै ॥\nशत्रु समूह मिटै सब पीरा ।\nजपत निरंतर बजरंग बीरा ॥",
      transliteration: "Yah Bajrang Baan jehi maarai |\nTaahi kahau phir kaun ubaarai ||\nShatru samooh mitai sab peeraa |\nJapat nirantar Bajrang Beeraa ||",
      english: "Whoever is struck by this arrow of Bajrang (Hanuman) — tell me, who can then save them? All enemies are vanquished and all suffering is destroyed for those who ceaselessly chant the name of the valiant Bajrang."
    }
  ],
  closingDoha: {
    num: 1,
    type: "doha",
    hindi: "पाठ करै बजरंग बाण की ।\nहनुमत रक्षा करैं प्राण की ॥\nयह बजरंग बाण जो जापै ।\nतासों भूत प्रेत सब कांपै ॥",
    transliteration: "Paath karai Bajrang Baan ki |\nHanumat rakshaa karein praan ki ||\nYah Bajrang Baan jo jaapai |\nTaason bhoot pret sab kaanpai ||",
    english: "Whoever recites this Bajrang Baan shall have their very life protected by Hanuman. All ghosts and evil spirits tremble in fear before the one who chants this Bajrang Baan."
  }
};
