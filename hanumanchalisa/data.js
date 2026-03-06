// Hanuman Chalisa - Complete Data
// Source: Traditional text by Goswami Tulsidas (16th century)
// With Hindi (Devanagari) original and English translations

const HANUMAN_CHALISA_DATA = {
  introDohas: [
    {
      num: 1,
      type: "doha",
      hindi: "श्रीगुरु चरन सरोज रज निज मनु मुकुरु सुधारि ।\nबरनउँ रघुबर बिमल जसु जो दायकु फल चारि ॥",
      transliteration: "Shri Guru charan saroj raj, nij manu mukuru sudhaari |\nBaranau Raghubar bimal jasu, jo daayaku phal chaari ||",
      english: "After cleansing the mirror of my mind with the dust of my Guru's lotus feet, I describe the pure glory of Lord Rama, the best of the Raghu dynasty, who bestows the four fruits of life — Dharma (righteousness), Artha (wealth), Kama (desire), and Moksha (liberation)."
    },
    {
      num: 2,
      type: "doha",
      hindi: "बुद्धिहीन तनु जानिके सुमिरौं पवन-कुमार ।\nबल बुद्धि बिद्या देहु मोहिं हरहु कलेस बिकार ॥",
      transliteration: "Buddhiheen tanu jaanike, sumirau Pavan-Kumaar |\nBal buddhi bidya dehu mohi, harahu kalesh bikaar ||",
      english: "Knowing myself to be ignorant, I remember the Son of the Wind (Hanuman). Grant me strength, wisdom, and knowledge, and remove all my afflictions and blemishes."
    }
  ],
  chaupais: [
    {
      num: 1,
      type: "chaupai",
      hindi: "जय हनुमान ज्ञान गुन सागर ।\nजय कपीस तिहुँ लोक उजागर ॥",
      transliteration: "Jai Hanumaan gyaan gun saagar |\nJai Kapeesh tihun lok ujaagar ||",
      english: "Victory to Hanuman, the ocean of wisdom and virtue. Victory to the Lord of Monkeys, who is renowned across the three worlds."
    },
    {
      num: 2,
      type: "chaupai",
      hindi: "राम दूत अतुलित बल धामा ।\nअंजनि पुत्र पवनसुत नामा ॥",
      transliteration: "Raam doot atulit bal dhaama |\nAnjani putra Pavansut naama ||",
      english: "You are the messenger of Lord Rama and the abode of incomparable strength. You are known as Anjani's son and the Son of the Wind."
    },
    {
      num: 3,
      type: "chaupai",
      hindi: "महाबीर बिक्रम बजरंगी ।\nकुमति निवार सुमति के संगी ॥",
      transliteration: "Mahaabeer bikram Bajrangi |\nKumati nivaar sumati ke sangi ||",
      english: "O great hero of tremendous valor with a body as strong as a thunderbolt! You dispel evil thoughts and are the companion of those with good intellect."
    },
    {
      num: 4,
      type: "chaupai",
      hindi: "कंचन बरन बिराज सुबेसा ।\nकानन कुंडल कुंचित केसा ॥",
      transliteration: "Kanchan baran biraaj subesaa |\nKaanan kundal kunchit kesaa ||",
      english: "You are golden-complexioned and beautifully adorned. You wear earrings and have curly hair."
    },
    {
      num: 5,
      type: "chaupai",
      hindi: "हाथ बज्र औ ध्वजा बिराजै ।\nकाँधे मूँज जनेऊ साजै ॥",
      transliteration: "Haath bajra au dhvajaa birajai |\nKaandhe moonj janeoo saajai ||",
      english: "In your hands shine the thunderbolt and the banner. On your shoulder adorns the sacred thread of munja grass."
    },
    {
      num: 6,
      type: "chaupai",
      hindi: "शंकर सुवन केसरी नंदन ।\nतेज प्रताप महा जग बंदन ॥",
      transliteration: "Shankar suvan Kesari nandan |\nTej prataap mahaa jag bandan ||",
      english: "You are an incarnation of Lord Shiva and the son of Kesari. Your glory and majesty are revered throughout the world."
    },
    {
      num: 7,
      type: "chaupai",
      hindi: "विद्यावान गुनी अति चातुर ।\nराम काज करिबे को आतुर ॥",
      transliteration: "Vidyaavaan guni ati chaatur |\nRaam kaaj karibe ko aatur ||",
      english: "You are learned, virtuous, and exceedingly clever. You are always eager to carry out the tasks of Lord Rama."
    },
    {
      num: 8,
      type: "chaupai",
      hindi: "प्रभु चरित्र सुनिबे को रसिया ।\nराम लखन सीता मन बसिया ॥",
      transliteration: "Prabhu charitra sunibe ko rasiyaa |\nRaam Lakhan Seetaa man basiyaa ||",
      english: "You delight in listening to the tales of the Lord. Rama, Lakshmana, and Sita dwell forever in your heart."
    },
    {
      num: 9,
      type: "chaupai",
      hindi: "सूक्ष्म रूप धरि सियहिं दिखावा ।\nबिकट रूप धरि लंक जरावा ॥",
      transliteration: "Sookshma roop dhari Siyahin dikhaavaa |\nBikat roop dhari Lanka jaraavaa ||",
      english: "In a tiny form you appeared before Sita. In a fearsome form you burned the city of Lanka."
    },
    {
      num: 10,
      type: "chaupai",
      hindi: "भीम रूप धरि असुर संहारे ।\nरामचंद्र के काज सँवारे ॥",
      transliteration: "Bheem roop dhari asur sanhaare |\nRaamchandra ke kaaj sanvaare ||",
      english: "In a mighty form you destroyed the demons. You accomplished all the tasks of Lord Rama."
    },
    {
      num: 11,
      type: "chaupai",
      hindi: "लाय सजीवन लखन जियाये ।\nश्रीरघुबीर हरषि उर लाये ॥",
      transliteration: "Laay Sajeevan Lakhan jiyaaye |\nShri Raghubeer harashi ur laaye ||",
      english: "You brought the Sanjeevani herb and revived Lakshmana. Lord Rama embraced you with great joy."
    },
    {
      num: 12,
      type: "chaupai",
      hindi: "रघुपति कीन्हीं बहुत बड़ाई ।\nतुम मम प्रिय भरतहि सम भाई ॥",
      transliteration: "Raghupati keenhi bahut badaai |\nTum mam priya Bharatahi sam bhaai ||",
      english: "Lord Rama praised you greatly and said: 'You are as dear to me as my brother Bharata.'"
    },
    {
      num: 13,
      type: "chaupai",
      hindi: "सहस बदन तुम्हरो जस गावैं ।\nअस कहि श्रीपति कंठ लगावैं ॥",
      transliteration: "Sahas badan tumharo jas gaavai |\nAs kahi Shripati kanth lagaavai ||",
      english: "'May the thousand-headed Shesha sing your praises,' said Lord Rama as he embraced you."
    },
    {
      num: 14,
      type: "chaupai",
      hindi: "सनकादिक ब्रह्मादि मुनीसा ।\nनारद सारद सहित अहीसा ॥",
      transliteration: "Sanakaadik Brahmaadi muneesaa |\nNaarad Saarad sahit Aheesaa ||",
      english: "Sanaka and other sages, Brahma and other gods, Narada, Saraswati, and the King of Serpents (Shesha) —"
    },
    {
      num: 15,
      type: "chaupai",
      hindi: "जम कुबेर दिगपाल जहाँ ते ।\nकबि कोबिद कहि सके कहाँ ते ॥",
      transliteration: "Jam Kuber Digpaal jahaan te |\nKabi kobid kahi sake kahaan te ||",
      english: "Yama, Kubera, and the guardians of the directions — even poets and scholars cannot fully describe your glory."
    },
    {
      num: 16,
      type: "chaupai",
      hindi: "तुम उपकार सुग्रीवहिं कीन्हा ।\nराम मिलाय राज पद दीन्हा ॥",
      transliteration: "Tum upkaar Sugreevahin keenhaa |\nRaam milaay raaj pad deenhaa ||",
      english: "You rendered great service to Sugriva. You introduced him to Rama and restored his kingship."
    },
    {
      num: 17,
      type: "chaupai",
      hindi: "तुम्हरो मंत्र बिभीषन माना ।\nलंकेश्वर भए सब जग जाना ॥",
      transliteration: "Tumharo mantra Vibheeshan maanaa |\nLankeshwar bhae sab jag jaanaa ||",
      english: "Vibhishana heeded your counsel and became the Lord of Lanka, as the whole world knows."
    },
    {
      num: 18,
      type: "chaupai",
      hindi: "जुग सहस्र जोजन पर भानू ।\nलील्यो ताहि मधुर फल जानू ॥",
      transliteration: "Jug sahasra jojan par Bhaanu |\nLeelyo taahi madhur phal jaanu ||",
      english: "The sun, which is thousands of yojanas away, you swallowed it thinking it to be a sweet fruit."
    },
    {
      num: 19,
      type: "chaupai",
      hindi: "प्रभु मुद्रिका मेलि मुख माहीं ।\nजलधि लाँघि गये अचरज नाहीं ॥",
      transliteration: "Prabhu mudrikaa meli mukh maaheen |\nJaladhi laanghi gaye acharaj naaheen ||",
      english: "Carrying the Lord's ring in your mouth, you leaped across the ocean — no wonder!"
    },
    {
      num: 20,
      type: "chaupai",
      hindi: "दुर्गम काज जगत के जेते ।\nसुगम अनुग्रह तुम्हरे तेते ॥",
      transliteration: "Durgam kaaj jagat ke jete |\nSugam anugrah tumhre tete ||",
      english: "All the difficult tasks in the world become easy with your grace."
    },
    {
      num: 21,
      type: "chaupai",
      hindi: "राम दुआरे तुम रखवारे ।\nहोत न आज्ञा बिनु पैसारे ॥",
      transliteration: "Raam duaare tum rakhvaare |\nHot na aagyaa binu paisaare ||",
      english: "You are the guardian at the door of Rama's abode. No one can enter without your permission."
    },
    {
      num: 22,
      type: "chaupai",
      hindi: "सब सुख लहैं तुम्हारी सरना ।\nतुम रक्षक काहू को डर ना ॥",
      transliteration: "Sab sukh lahai tumhaari sarnaa |\nTum rakshak kaahoo ko dar na ||",
      english: "All happiness is found in your refuge. With you as protector, there is nothing to fear."
    },
    {
      num: 23,
      type: "chaupai",
      hindi: "आपन तेज सम्हारो आपै ।\nतीनों लोक हाँक तें काँपै ॥",
      transliteration: "Aapan tej samhaaro aapai |\nTeenon lok haank ten kaanpai ||",
      english: "Only you can control your own radiance. The three worlds tremble at your roar."
    },
    {
      num: 24,
      type: "chaupai",
      hindi: "भूत पिसाच निकट नहिं आवै ।\nमहाबीर जब नाम सुनावै ॥",
      transliteration: "Bhoot pisaach nikat nahin aavai |\nMahaabeer jab naam sunaavai ||",
      english: "Evil spirits dare not come near when one chants the name of Mahaveer (Hanuman)."
    },
    {
      num: 25,
      type: "chaupai",
      hindi: "नासै रोग हरै सब पीरा ।\nजपत निरंतर हनुमत बीरा ॥",
      transliteration: "Naasai rog harai sab peeraa |\nJapat nirantar Hanumat beeraa ||",
      english: "Diseases are destroyed and all suffering is removed by constantly chanting the name of brave Hanuman."
    },
    {
      num: 26,
      type: "chaupai",
      hindi: "संकट तें हनुमान छुड़ावै ।\nमन क्रम बचन ध्यान जो लावै ॥",
      transliteration: "Sankat te Hanumaan chhudaavai |\nMan kram bachan dhyaan jo laavai ||",
      english: "Hanuman rescues from all troubles those who meditate upon him in thought, deed, and word."
    },
    {
      num: 27,
      type: "chaupai",
      hindi: "सब पर राम तपस्वी राजा ।\nतिन के काज सकल तुम साजा ॥",
      transliteration: "Sab par Raam tapaswee raajaa |\nTin ke kaaj sakal tum saajaa ||",
      english: "Rama is the supreme ascetic king above all. You carry out all his tasks."
    },
    {
      num: 28,
      type: "chaupai",
      hindi: "और मनोरथ जो कोई लावै ।\nसोइ अमित जीवन फल पावै ॥",
      transliteration: "Aur manorath jo koi laavai |\nSoi amit jeevan phal paavai ||",
      english: "Whoever comes to you with any desire obtains the imperishable fruit of life."
    },
    {
      num: 29,
      type: "chaupai",
      hindi: "चारों जुग परताप तुम्हारा ।\nहै परसिद्ध जगत उजियारा ॥",
      transliteration: "Chaaron jug partaap tumhaaraa |\nHai parsiddh jagat ujiyaaraa ||",
      english: "Your glory pervades all four ages (yugas). Your fame illumines the entire world."
    },
    {
      num: 30,
      type: "chaupai",
      hindi: "साधु संत के तुम रखवारे ।\nअसुर निकंदन राम दुलारे ॥",
      transliteration: "Saadhu sant ke tum rakhvaare |\nAsur nikandan Raam dulaare ||",
      english: "You are the protector of saints and sages, the destroyer of demons, and the beloved of Rama."
    },
    {
      num: 31,
      type: "chaupai",
      hindi: "अष्ट सिद्धि नौ निधि के दाता ।\nअस बर दीन जानकी माता ॥",
      transliteration: "Ashta siddhi nau nidhi ke daataa |\nAs bar deen Jaanaki maataa ||",
      english: "You can grant the eight siddhis (supernatural powers) and nine nidhis (divine treasures) — such is the boon given to you by Mother Janaki (Sita)."
    },
    {
      num: 32,
      type: "chaupai",
      hindi: "राम रसायन तुम्हरे पासा ।\nसदा रहो रघुपति के दासा ॥",
      transliteration: "Raam rasaayan tumhre paasaa |\nSadaa raho Raghupati ke daasaa ||",
      english: "You hold the elixir of devotion to Rama. You remain forever the servant of Raghupati."
    },
    {
      num: 33,
      type: "chaupai",
      hindi: "तुम्हरे भजन राम को पावै ।\nजनम जनम के दुख बिसरावै ॥",
      transliteration: "Tumhre bhajan Raam ko paavai |\nJanam janam ke dukh bisraavai ||",
      english: "Through devotion to you, one attains Rama and the sorrows of countless lifetimes are forgotten."
    },
    {
      num: 34,
      type: "chaupai",
      hindi: "अन्त काल रघुबर पुर जाई ।\nजहाँ जन्म हरि-भक्त कहाई ॥",
      transliteration: "Ant kaal Raghubar pur jaai |\nJahaan janm Hari-Bhakt kahaai ||",
      english: "At the end of life, one goes to the abode of Rama. And wherever one is born, one is known as a devotee of Hari."
    },
    {
      num: 35,
      type: "chaupai",
      hindi: "और देवता चित्त न धरई ।\nहनुमत सेइ सर्ब सुख करई ॥",
      transliteration: "Aur devataa chitt na dharai |\nHanumat sei sarb sukh karai ||",
      english: "Even without worshipping any other deity, one who serves Hanuman attains all happiness."
    },
    {
      num: 36,
      type: "chaupai",
      hindi: "संकट कटै मिटै सब पीरा ।\nजो सुमिरै हनुमत बलबीरा ॥",
      transliteration: "Sankat katai mitai sab peeraa |\nJo sumirai Hanumat Balbeeraa ||",
      english: "All troubles are removed and all suffering ends for those who remember the mighty Hanuman."
    },
    {
      num: 37,
      type: "chaupai",
      hindi: "जय जय जय हनुमान गोसाईं ।\nकृपा करहु गुरुदेव की नाईं ॥",
      transliteration: "Jai jai jai Hanumaan Gosaain |\nKripaa karahu Gurudev ki naain ||",
      english: "Victory, victory, victory to Lord Hanuman! Bestow your grace upon us as our supreme Guru."
    },
    {
      num: 38,
      type: "chaupai",
      hindi: "जो सत बार पाठ कर कोई ।\nछूटहि बंदि महा सुख होई ॥",
      transliteration: "Jo sat baar paath kar koi |\nChhootahi bandi mahaa sukh hoi ||",
      english: "Whoever recites this a hundred times is freed from all bondage and attains supreme bliss."
    },
    {
      num: 39,
      type: "chaupai",
      hindi: "जो यह पढ़ै हनुमान चालीसा ।\nहोय सिद्धि साखी गौरीसा ॥",
      transliteration: "Jo yah padhai Hanumaan Chaaleesaa |\nHoy siddhi saakhi Gaureesaa ||",
      english: "Whoever reads this Hanuman Chalisa attains spiritual perfection — Lord Shiva himself is witness to this."
    },
    {
      num: 40,
      type: "chaupai",
      hindi: "तुलसीदास सदा हरि चेरा ।\nकीजै नाथ हृदय महँ डेरा ॥",
      transliteration: "Tulaseedaas sadaa Hari cheraa |\nKeejai naath hriday mahan deraa ||",
      english: "Tulsidas, forever a servant of Hari, prays: 'O Lord, make my heart your dwelling place.'"
    }
  ],
  closingDoha: {
    num: 1,
    type: "doha",
    hindi: "पवनतनय संकट हरन मंगल मूरति रूप ।\nराम लखन सीता सहित हृदय बसहु सुर भूप ॥",
    transliteration: "Pavantanay sankat haran mangal moorati roop |\nRaam Lakhan Seetaa sahit hriday basahu sur bhoop ||",
    english: "O Son of the Wind, remover of all troubles, embodiment of auspiciousness — along with Rama, Lakshmana, and Sita, please dwell forever in my heart, O King of Gods."
  }
};
