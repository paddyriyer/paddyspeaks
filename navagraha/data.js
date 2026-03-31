// Navagraha Slokas - Complete Data
// Navagraha Suktam (Vedic Tradition) + Navagraha Peedahara Stotram (Brahmanda Purana)

const NAVAGRAHA_DATA = {
  stotras: [
    {
      id: "suktam",
      titleSanskrit: "नवग्रहसूक्तम्",
      titleEnglish: "Navagraha Suktam",
      titleMeaning: "Vedic Hymns to the Nine Celestial Bodies",
      summary: "The Navagraha Suktam is a collection of Vedic mantras from the Rig Veda and Yajur Veda, addressed to the nine grahas (celestial influences). Each graha is propitiated through mantras to its presiding deity (Adhidevata) and sub-deity (Pratydhidevata). These ancient hymns are chanted to invoke blessings, remove obstacles, and harmonize planetary influences in one's life.",
      grahas: [
        {
          graha: 1,
          grahaName: "Surya",
          grahaNameSanskrit: "सूर्यः",
          grahaEnglish: "Sun",
          grahaCssClass: "graha-surya",
          summary: "Surya, the Sun, is the lord of all grahas, the cosmic soul and source of light. His Adhidevata is Agni (Fire) and Pratydhidevata is Rudra (Shiva). These mantras invoke the radiant Savita who traverses the worlds on his golden chariot.",
          slokas: [
            {
              stotra: "suktam",
              graha: 1,
              sloka: 1,
              devanagari: "ॐ आसत्येन रजसा वर्तमानो निवेशयन्नमृतं मर्त्यं च ।\nहिरण्ययेन सविता रथेनादेवो याति भुवना विपश्यन् ॥",
              transliteration: "om āsatyena rajasā vartamāno niveśayann amṛtaṁ martyaṁ ca |\nhiraṇyayena savitā rathenā devo yāti bhuvanā vipaśyan ||",
              words: [
                { word: "ॐ", transliteration: "om", meaning: "the sacred syllable" },
                { word: "आ", transliteration: "ā", meaning: "towards, verily" },
                { word: "सत्येन", transliteration: "satyena", meaning: "with truth" },
                { word: "रजसा", transliteration: "rajasā", meaning: "through the atmosphere / cosmic space" },
                { word: "वर्तमानः", transliteration: "vartamānaḥ", meaning: "moving, revolving" },
                { word: "निवेशयन्", transliteration: "niveśayan", meaning: "setting in place, arranging" },
                { word: "अमृतम्", transliteration: "amṛtam", meaning: "the immortal (gods)" },
                { word: "मर्त्यम्", transliteration: "martyam", meaning: "the mortal (beings)" },
                { word: "च", transliteration: "ca", meaning: "and" },
                { word: "हिरण्ययेन", transliteration: "hiraṇyayena", meaning: "golden" },
                { word: "सविता", transliteration: "savitā", meaning: "the Sun-god (Savitar, the impeller)" },
                { word: "रथेन", transliteration: "rathena", meaning: "with his chariot" },
                { word: "आ", transliteration: "ā", meaning: "verily" },
                { word: "देवः", transliteration: "devaḥ", meaning: "the radiant god" },
                { word: "याति", transliteration: "yāti", meaning: "travels, goes" },
                { word: "भुवना", transliteration: "bhuvanā", meaning: "the worlds" },
                { word: "विपश्यन्", transliteration: "vipaśyan", meaning: "beholding, observing all" }
              ],
              translation: "Moving through the cosmic space with truth, setting in their rightful place both the immortal gods and mortal beings — the radiant god Savitar travels on his golden chariot, beholding all the worlds.",
              significance: "Esoterically, Savitar represents the Atman — the inner Sun of consciousness. His 'golden chariot' is the subtle body (sukshma sharira) through which awareness travels across the planes of existence. 'Setting in place the immortal and the mortal' reveals the soul's role as the bridge between spirit and matter. The word 'satyena' (with truth) indicates that consciousness moves through creation not by force but by the power of Rta — cosmic truth. When you chant this mantra, you are invoking the inner Savitar to awaken self-awareness, to 'see all worlds' — i.e., to become the witness (sakshi) of all experience."
            },
            {
              stotra: "suktam",
              graha: 1,
              sloka: 2,
              devanagari: "अग्निं दूतं वृणीमहे होतारं विश्ववेदसम् ।\nअस्य यज्ञस्य सुक्रतुम् ॥",
              transliteration: "agniṁ dūtaṁ vṛṇīmahe hotāraṁ viśvavedasam |\nasya yajñasya sukratum ||",
              words: [
                { word: "अग्निम्", transliteration: "agnim", meaning: "Agni (the fire-god)" },
                { word: "दूतम्", transliteration: "dūtam", meaning: "as the messenger" },
                { word: "वृणीमहे", transliteration: "vṛṇīmahe", meaning: "we choose, we invoke" },
                { word: "होतारम्", transliteration: "hotāram", meaning: "the invoker (priest of the sacrifice)" },
                { word: "विश्ववेदसम्", transliteration: "viśvavedasam", meaning: "the all-knowing one" },
                { word: "अस्य", transliteration: "asya", meaning: "of this" },
                { word: "यज्ञस्य", transliteration: "yajñasya", meaning: "sacrifice" },
                { word: "सुक्रतुम्", transliteration: "sukratum", meaning: "the one of good deeds / excellent performer" }
              ],
              translation: "We choose Agni as our messenger, the all-knowing invoker-priest, the excellent performer of this sacrifice.",
              significance: "Agni is the Adhidevata (presiding deity) of Surya. In the inner sacrifice (antaryaga), Agni represents the fire of awareness — the faculty that 'digests' experience and transforms it into knowledge. Choosing Agni as the 'messenger' (duta) means using the fire of concentration to carry our spiritual aspirations upward. 'Vishvavedas' (all-knowing) hints that this inner fire, when kindled, reveals the interconnectedness of all knowledge — nothing remains unknown to the awakened consciousness."
            },
            {
              stotra: "suktam",
              graha: 1,
              sloka: 3,
              devanagari: "येषामीशे पशुपतिः पशूनां चतुष्पदामुत च द्विपदाम् ।\nनिष्क्रीतोऽयं यज्ञियं भागमेतु रायस्पोषा यजमानस्य सन्तु ॥",
              transliteration: "yeṣām īśe paśupatiḥ paśūnāṁ catuṣpadām uta ca dvipadām |\nniṣkrīto'yaṁ yajñiyaṁ bhāgam etu rāyaspoṣā yajamānasya santu ||",
              words: [
                { word: "येषाम्", transliteration: "yeṣām", meaning: "of whom (those creatures)" },
                { word: "ईशे", transliteration: "īśe", meaning: "rules, is the lord of" },
                { word: "पशुपतिः", transliteration: "paśupatiḥ", meaning: "Pashupati (Lord of creatures, Rudra/Shiva)" },
                { word: "पशूनाम्", transliteration: "paśūnām", meaning: "of the creatures" },
                { word: "चतुष्पदाम्", transliteration: "catuṣpadām", meaning: "the four-footed (animals)" },
                { word: "उत", transliteration: "uta", meaning: "and also" },
                { word: "च", transliteration: "ca", meaning: "and" },
                { word: "द्विपदाम्", transliteration: "dvipadām", meaning: "the two-footed (humans)" },
                { word: "निष्क्रीतः", transliteration: "niṣkrītaḥ", meaning: "redeemed, freed" },
                { word: "अयम्", transliteration: "ayam", meaning: "this one" },
                { word: "यज्ञियम्", transliteration: "yajñiyam", meaning: "worthy of worship" },
                { word: "भागम्", transliteration: "bhāgam", meaning: "share, portion" },
                { word: "एतु", transliteration: "etu", meaning: "may he obtain" },
                { word: "रायस्पोषाः", transliteration: "rāyaspoṣāḥ", meaning: "abundance of wealth" },
                { word: "यजमानस्य", transliteration: "yajamānasya", meaning: "of the performer of the sacrifice" },
                { word: "सन्तु", transliteration: "santu", meaning: "may there be" }
              ],
              translation: "Pashupati (Rudra) is the lord of all creatures — both the four-footed and the two-footed. May this redeemed one attain his rightful share of the sacrifice. May abundance of wealth be upon the one who performs this worship.",
              significance: "Rudra (Shiva) as Pashupati is the Pratydhidevata of Surya. 'Pashu' means the bound soul, and 'Pati' means lord — so Pashupati is the lord who liberates bound souls. The 'four-footed' and 'two-footed' are not just animals and humans — they represent beings at different levels of consciousness. 'Nishkrita' (redeemed) refers to the soul freed from karmic debt through the solar fire of self-knowledge. This verse encodes the promise: when you align with Surya-tattva (the principle of illumination), even your material life (rayasposhaa = wealth) flourishes, because inner clarity naturally produces outer abundance."
            }
          ]
        },
        {
          graha: 2,
          grahaName: "Chandra",
          grahaNameSanskrit: "चन्द्रः",
          grahaEnglish: "Moon",
          grahaCssClass: "graha-chandra",
          summary: "Chandra (Soma), the Moon, presides over the mind and emotions. His Adhidevata is Apas (Waters) and Pratydhidevata is Gauri (Parvati). These mantras invoke Soma, the lord of nourishment and healing herbs.",
          slokas: [
            {
              stotra: "suktam",
              graha: 2,
              sloka: 1,
              devanagari: "ॐ आप्यायस्व समेतु ते विश्वतस्सोम वृष्णियम् ।\nभवा वाजस्य सङ्गथे ॥",
              transliteration: "om āpyāyasva sam etu te viśvatassoma vṛṣṇiyam |\nbhavā vājasya saṅgathe ||",
              words: [
                { word: "ॐ", transliteration: "om", meaning: "the sacred syllable" },
                { word: "आप्यायस्व", transliteration: "āpyāyasva", meaning: "may you swell, may you be nourished" },
                { word: "सम्", transliteration: "sam", meaning: "together, completely" },
                { word: "एतु", transliteration: "etu", meaning: "may it come" },
                { word: "ते", transliteration: "te", meaning: "to you" },
                { word: "विश्वतः", transliteration: "viśvataḥ", meaning: "from all sides" },
                { word: "सोम", transliteration: "soma", meaning: "O Soma (Moon)" },
                { word: "वृष्णियम्", transliteration: "vṛṣṇiyam", meaning: "virile power, strength" },
                { word: "भवा", transliteration: "bhavā", meaning: "become, be" },
                { word: "वाजस्य", transliteration: "vājasya", meaning: "of nourishment / vital force" },
                { word: "सङ्गथे", transliteration: "saṅgathe", meaning: "in the gathering / at the place of union" }
              ],
              translation: "O Soma, may you be nourished! May virile strength come to you from all sides. Be present at the gathering place of vital nourishment.",
              significance: "Soma is the deity of the Moon and represents Manas (the mind). 'Aapyaayasva' (may you swell) is a prayer for the mind to become full — not with thoughts but with receptivity. The Moon reflects the Sun's light; likewise the mind reflects the light of the Atman. 'Vrishnyam' (virile strength) from all sides means the mind drawing spiritual vitality from every experience. The 'sangatha' (gathering place) of nourishment is the heart-center (hridaya), where all impressions converge. This mantra is chanted to strengthen the mind's capacity to receive and reflect divine light."
            },
            {
              stotra: "suktam",
              graha: 2,
              sloka: 2,
              devanagari: "अप्सुमे सोमो अब्रवीदन्तर्विश्वानि भेषजा ।\nअग्निञ्च विश्वशम्भुवमापश्च विश्वभेषजीः ।",
              transliteration: "apsu me somo abravīd antar viśvāni bheṣajā |\nagniñca viśvaśambhuvam āpaśca viśvabheṣajīḥ |",
              words: [
                { word: "अप्सु", transliteration: "apsu", meaning: "in the waters" },
                { word: "मे", transliteration: "me", meaning: "to me" },
                { word: "सोमः", transliteration: "somaḥ", meaning: "Soma (the Moon)" },
                { word: "अब्रवीत्", transliteration: "abravīt", meaning: "spoke, declared" },
                { word: "अन्तः", transliteration: "antaḥ", meaning: "within" },
                { word: "विश्वानि", transliteration: "viśvāni", meaning: "all" },
                { word: "भेषजा", transliteration: "bheṣajā", meaning: "medicines, remedies" },
                { word: "अग्निम्", transliteration: "agnim", meaning: "Agni (fire)" },
                { word: "च", transliteration: "ca", meaning: "and" },
                { word: "विश्वशम्भुवम्", transliteration: "viśvaśambhuvam", meaning: "beneficial to all" },
                { word: "आपः", transliteration: "āpaḥ", meaning: "the waters" },
                { word: "च", transliteration: "ca", meaning: "and" },
                { word: "विश्वभेषजीः", transliteration: "viśvabheṣajīḥ", meaning: "the universal healers" }
              ],
              translation: "Soma declared to me: 'Within the waters dwell all medicines. Agni is beneficial to all, and the waters are the universal healers.'",
              significance: "The 'waters' (Apas) are the Adhidevata of Chandra. Esoterically, Apas represents not physical water but the flow of prana and consciousness. 'All medicines dwell within the waters' means that the healing power of the universe resides in the flow of awareness itself. When the mind (Soma) is calm like still water, it becomes self-healing. Agni within the waters represents the fire of digestion — both physical and psychological. This verse reveals the Vedic understanding that consciousness (Soma), energy (Agni), and flow (Apas) together constitute the complete healing principle."
            },
            {
              stotra: "suktam",
              graha: 2,
              sloka: 3,
              devanagari: "गौरी मिमाय सलिलानि तक्षत्येकपदी द्विपदी सा चतुष्पदी ।\nअष्टापदी नवपदी बभूवुषी सहस्राक्षरा परमे व्योमन् ॥",
              transliteration: "gaurī mimāya salilāni takṣaty ekapadī dvipadī sā catuṣpadī |\naṣṭāpadī navapadī babhūvuṣī sahasrākṣarā parame vyoman ||",
              words: [
                { word: "गौरी", transliteration: "gaurī", meaning: "the bright one (sacred speech / cosmic cow)" },
                { word: "मिमाय", transliteration: "mimāya", meaning: "has measured, has lowed" },
                { word: "सलिलानि", transliteration: "salilāni", meaning: "the waters" },
                { word: "तक्षति", transliteration: "takṣati", meaning: "fashions, creates" },
                { word: "एकपदी", transliteration: "ekapadī", meaning: "one-footed (one-syllabled)" },
                { word: "द्विपदी", transliteration: "dvipadī", meaning: "two-footed (two-syllabled)" },
                { word: "सा", transliteration: "sā", meaning: "she" },
                { word: "चतुष्पदी", transliteration: "catuṣpadī", meaning: "four-footed (four-syllabled)" },
                { word: "अष्टापदी", transliteration: "aṣṭāpadī", meaning: "eight-footed" },
                { word: "नवपदी", transliteration: "navapadī", meaning: "nine-footed" },
                { word: "बभूवुषी", transliteration: "babhūvuṣī", meaning: "having become" },
                { word: "सहस्राक्षरा", transliteration: "sahasrākṣarā", meaning: "of a thousand syllables" },
                { word: "परमे", transliteration: "parame", meaning: "in the highest" },
                { word: "व्योमन्", transliteration: "vyoman", meaning: "sky, heaven" }
              ],
              translation: "The radiant Gauri (sacred speech) has measured out the waters and fashions creation. She is one-footed, two-footed, four-footed, eight-footed, nine-footed — having become of a thousand syllables in the highest heaven.",
              significance: "Gauri (Parvati) is the Pratydhidevata of Chandra. Here Gauri represents Vak — sacred speech, the creative Word. The progression from one-footed to thousand-syllabled maps the manifestation of consciousness through increasingly complex forms — from the single primordial vibration (Omkara) through the four Vedas (four-footed), the eight prakritis, the nine forms of devotion, to the infinite expressions of the cosmos (sahasrakshara). This verse encodes the entire cosmology in the metaphor of speech: the Moon governs the mind, and the mind creates through the power of Vak. In 'parame vyoman' (the highest heaven), all these forms dissolve back into silence — the ultimate source."
            }
          ]
        },
        {
          graha: 3,
          grahaName: "Mangala",
          grahaNameSanskrit: "मङ्गलः",
          grahaEnglish: "Mars",
          grahaCssClass: "graha-mangala",
          summary: "Mangala (Angaraka), Mars, represents energy, courage and strength. His Adhidevata is Bhumi (Earth) and Pratydhidevata is Kshetrapala (Guardian of the field). These mantras invoke Agni as the head of heaven and the nurturing Earth.",
          slokas: [
            {
              stotra: "suktam",
              graha: 3,
              sloka: 1,
              devanagari: "ॐ अग्निर्मूर्द्धा दिवः ककुत्पतिः पृथिव्या अयम् ।\nअपां रेतांसि जिन्वति ॥",
              transliteration: "om agnir mūrddhā divaḥ kakut patiḥ pṛthivyā ayam |\napāṁ retāṁsi jinvati ||",
              words: [
                { word: "ॐ", transliteration: "om", meaning: "the sacred syllable" },
                { word: "अग्निः", transliteration: "agniḥ", meaning: "Agni (the fire-god)" },
                { word: "मूर्द्धा", transliteration: "mūrddhā", meaning: "the head, the summit" },
                { word: "दिवः", transliteration: "divaḥ", meaning: "of heaven" },
                { word: "ककुत्", transliteration: "kakut", meaning: "the peak" },
                { word: "पतिः", transliteration: "patiḥ", meaning: "the lord" },
                { word: "पृथिव्याः", transliteration: "pṛthivyāḥ", meaning: "of the earth" },
                { word: "अयम्", transliteration: "ayam", meaning: "this one" },
                { word: "अपाम्", transliteration: "apām", meaning: "of the waters" },
                { word: "रेतांसि", transliteration: "retāṁsi", meaning: "the essences, the seeds" },
                { word: "जिन्वति", transliteration: "jinvati", meaning: "enlivens, sets in motion" }
              ],
              translation: "Agni is the head of heaven, the peak of the sky, the lord of this earth. He enlivens the seed-essences of the waters.",
              significance: "Mars represents raw energy (virya), and his Adhidevata Bhumi (Earth) grounds this fiery force. Agni being simultaneously the 'head of heaven' and 'lord of earth' reveals that the Mars-principle operates at every level of existence — from the cosmic fire of stars to the metabolic fire within our bodies. 'Apam retamsi jinvati' (enlivening the seed-essences of waters) is profoundly esoteric: it means that the fire of will-power activates the dormant potential within the pranic currents. This is the principle behind tapas (spiritual austerity) — directed inner fire that transforms latent potential into manifest power."
            },
            {
              stotra: "suktam",
              graha: 3,
              sloka: 2,
              devanagari: "स्योना पृथिवि भवानृक्षरा निवेशनि ।\nयच्छानश्शर्म सप्रथाः ॥",
              transliteration: "syonā pṛthivi bhavā anṛkṣarā niveśani |\nyacchā naś śarma saprathaḥ ||",
              words: [
                { word: "स्योना", transliteration: "syonā", meaning: "pleasant, comfortable" },
                { word: "पृथिवि", transliteration: "pṛthivi", meaning: "O Earth" },
                { word: "भवा", transliteration: "bhavā", meaning: "become, be" },
                { word: "अनृक्षरा", transliteration: "anṛkṣarā", meaning: "free from thorns, without harm" },
                { word: "निवेशनि", transliteration: "niveśani", meaning: "as a dwelling place" },
                { word: "यच्छ", transliteration: "yaccha", meaning: "grant, bestow" },
                { word: "नः", transliteration: "naḥ", meaning: "to us" },
                { word: "शर्म", transliteration: "śarma", meaning: "shelter, happiness" },
                { word: "सप्रथाः", transliteration: "saprathaḥ", meaning: "wide, expansive" }
              ],
              translation: "O Earth, be pleasant and thorn-free as our dwelling place. Grant us wide-reaching shelter and happiness.",
              significance: "Bhumi (Earth) is Mars's Adhidevata. Praying to the Earth to be 'thorn-free' is not merely physical — it asks that our field of action (kshetra) be cleared of obstacles. 'Anrikshara' (without thorns) means a life-path free of karmic obstructions. 'Sharma saprathah' (wide-reaching shelter) represents the expansive state of consciousness where one feels safe and grounded in any situation. This verse teaches that Mars-energy, when properly channeled, doesn't create conflict — it creates space. The warrior's true gift is not aggression but the ability to make the world safe for others."
            },
            {
              stotra: "suktam",
              graha: 3,
              sloka: 3,
              devanagari: "क्षेत्रस्य पतिना वयं हिते नेव जयामसि ।\nगामश्वं पोषयिन्त्वा स नो मृडातीदृशे ॥",
              transliteration: "kṣetrasya patinā vayaṁ hite neva jayāmasi |\ngām aśvaṁ poṣayintvā sa no mṛḍātīdṛśe ||",
              words: [
                { word: "क्षेत्रस्य", transliteration: "kṣetrasya", meaning: "of the field" },
                { word: "पतिना", transliteration: "patinā", meaning: "with the lord (Kshetrapati)" },
                { word: "वयम्", transliteration: "vayam", meaning: "we" },
                { word: "हिते", transliteration: "hite", meaning: "in what is beneficial" },
                { word: "न इव", transliteration: "na iva", meaning: "as if (certainly)" },
                { word: "जयामसि", transliteration: "jayāmasi", meaning: "we conquer, we win" },
                { word: "गाम्", transliteration: "gām", meaning: "cattle" },
                { word: "अश्वम्", transliteration: "aśvam", meaning: "horses" },
                { word: "पोषयिन्त्वा", transliteration: "poṣayintvā", meaning: "nourishing" },
                { word: "सः", transliteration: "saḥ", meaning: "he" },
                { word: "नः", transliteration: "naḥ", meaning: "to us" },
                { word: "मृडाति", transliteration: "mṛḍāti", meaning: "may he be gracious" },
                { word: "ईदृशे", transliteration: "īdṛśe", meaning: "in this manner, for such purpose" }
              ],
              translation: "With the lord of the field (Kshetrapati), we conquer in all that is beneficial. Nourishing our cattle and horses, may he be gracious to us in this way.",
              significance: "Kshetrapala (Guardian of the field) is Mars's Pratydhidevata. In the Gita, Krishna calls the body 'kshetra' (the field) and the soul 'kshetrajna' (knower of the field). This verse invokes the protector of our field of karma — the principle that guards our life's work. 'Jayamasi' (we conquer) through Mars is not violent conquest but dharmic victory — winning in what is 'hita' (beneficial). The cattle (go) represent senses and the horse (ashva) represents prana. Nourishing them means disciplining the senses and vital energy. A well-governed Mars makes one a protector, not a destroyer."
            }
          ]
        },
        {
          graha: 4,
          grahaName: "Budha",
          grahaNameSanskrit: "बुधः",
          grahaEnglish: "Mercury",
          grahaCssClass: "graha-budha",
          summary: "Budha (Mercury) governs intellect, communication and learning. His Adhidevata is Vishnu and Pratydhidevata is Agni. These mantras invoke the awakening fire and the all-pervading Vishnu who measured the three worlds.",
          slokas: [
            {
              stotra: "suktam",
              graha: 4,
              sloka: 1,
              devanagari: "ॐ उद्बुध्यस्वाग्ने प्रतिजागृह्येनमिष्टापूर्ते संसृजेथामयञ्च ।\nपुनः कृण्वंस्त्वा पितरं युवानमन्वातांसीत्वयि तन्तुमेतम् ॥",
              transliteration: "om udbudhyasvāgne pratijāgṛhyenam iṣṭāpūrte saṁsṛjethām ayañca |\npunaḥ kṛṇvaṁs tvā pitaraṁ yuvānam anvātāṁsīt tvayi tantum etam ||",
              words: [
                { word: "ॐ", transliteration: "om", meaning: "the sacred syllable" },
                { word: "उद्बुध्यस्व", transliteration: "udbudhyasva", meaning: "awaken, arise" },
                { word: "अग्ने", transliteration: "agne", meaning: "O Agni (fire)" },
                { word: "प्रतिजागृहि", transliteration: "pratijāgṛhi", meaning: "watch over, be vigilant" },
                { word: "एनम्", transliteration: "enam", meaning: "this one (the worshipper)" },
                { word: "इष्टापूर्ते", transliteration: "iṣṭāpūrte", meaning: "the fruits of sacrifice and good deeds" },
                { word: "संसृजेथाम्", transliteration: "saṁsṛjethām", meaning: "may you both unite / bestow" },
                { word: "अयम्", transliteration: "ayam", meaning: "this" },
                { word: "च", transliteration: "ca", meaning: "and" },
                { word: "पुनः", transliteration: "punaḥ", meaning: "again" },
                { word: "कृण्वन्", transliteration: "kṛṇvan", meaning: "making" },
                { word: "त्वा", transliteration: "tvā", meaning: "you" },
                { word: "पितरम्", transliteration: "pitaram", meaning: "father" },
                { word: "युवानम्", transliteration: "yuvānam", meaning: "youthful" },
                { word: "अन्वातांसीत्", transliteration: "anvātāṁsīt", meaning: "has stretched, has extended" },
                { word: "त्वयि", transliteration: "tvayi", meaning: "in you" },
                { word: "तन्तुम्", transliteration: "tantum", meaning: "the thread (of sacrifice)" },
                { word: "एतम्", transliteration: "etam", meaning: "this" }
              ],
              translation: "O Agni, awaken! Watch over this worshipper. May you bestow upon him the fruits of sacrifice and good deeds. Making your father youthful again, he has stretched this thread of sacrifice in you.",
              significance: "Mercury governs Buddhi (intellect, discernment). 'Udbudhyasva' (awaken!) is the primal call to the discriminative faculty — wake up from the sleep of ignorance. The 'thread' (tantu) stretched in Agni represents the continuity of conscious awareness linking past, present and future — Mercury's domain of connecting knowledge. 'Making the father youthful again' is a stunning esoteric image: through the fire of true understanding, we renew our connection to the source (the father-principle, Brahman), making the ancient wisdom feel perpetually fresh. This is Budha's gift — making the eternal relevant to the present."
            },
            {
              stotra: "suktam",
              graha: 4,
              sloka: 2,
              devanagari: "इदं विष्णुर्विचक्रमे त्रेधा निदधे पदम् ।\nसमूढमस्य पांसुरे ॥",
              transliteration: "idaṁ viṣṇur vicakrame tredhā nidadhe padam |\nsamūḍham asya pāṁsure ||",
              words: [
                { word: "इदम्", transliteration: "idam", meaning: "this (universe)" },
                { word: "विष्णुः", transliteration: "viṣṇuḥ", meaning: "Vishnu (the all-pervading)" },
                { word: "विचक्रमे", transliteration: "vicakrame", meaning: "strode across, measured" },
                { word: "त्रेधा", transliteration: "tredhā", meaning: "in three ways / three steps" },
                { word: "निदधे", transliteration: "nidadhe", meaning: "placed, established" },
                { word: "पदम्", transliteration: "padam", meaning: "his foot / step" },
                { word: "समूढम्", transliteration: "samūḍham", meaning: "firmly established" },
                { word: "अस्य", transliteration: "asya", meaning: "his" },
                { word: "पांसुरे", transliteration: "pāṁsure", meaning: "in the dust / in the earth" }
              ],
              translation: "Vishnu strode across this entire universe. In three steps he established his foot. The whole world is gathered in the dust of his feet.",
              significance: "Vishnu is the Adhidevata of Budha. The famous 'three strides of Vishnu' (trivikrama) represent the three states of consciousness — waking (earth), dreaming (atmosphere), and deep sleep (heaven). Mercury-intellect, when aligned with Vishnu-consciousness, can traverse all three realms. 'Samudham asya pamsure' (gathered in the dust of his feet) means that all knowledge, however vast, is merely a particle of the infinite awareness of Vishnu. This teaches intellectual humility — the highest function of Mercury is to recognize that the intellect is a tool of the divine, not the master."
            },
            {
              stotra: "suktam",
              graha: 4,
              sloka: 3,
              devanagari: "विष्णो रराटमसि विष्णोः पृष्ठमसि विष्णोश्श्नप्त्रेस्थो\nविष्णोस्स्यूरसि विष्णोर्ध्रुवमसि वैष्णवमसि विष्णवे त्वा ॥",
              transliteration: "viṣṇo rarāṭam asi viṣṇoḥ pṛṣṭham asi viṣṇoś śnaptres tho\nviṣṇos syūr asi viṣṇor dhruvam asi vaiṣṇavam asi viṣṇave tvā ||",
              words: [
                { word: "विष्णो", transliteration: "viṣṇo", meaning: "O Vishnu" },
                { word: "रराटम्", transliteration: "rarāṭam", meaning: "the forehead / the front" },
                { word: "असि", transliteration: "asi", meaning: "you are" },
                { word: "विष्णोः", transliteration: "viṣṇoḥ", meaning: "of Vishnu" },
                { word: "पृष्ठम्", transliteration: "pṛṣṭham", meaning: "the back / support" },
                { word: "विष्णोः", transliteration: "viṣṇoḥ", meaning: "of Vishnu" },
                { word: "श्नप्त्रे", transliteration: "śnaptre", meaning: "the two connectors / sinews" },
                { word: "स्थः", transliteration: "sthaḥ", meaning: "you stand / you are" },
                { word: "विष्णोः", transliteration: "viṣṇoḥ", meaning: "of Vishnu" },
                { word: "स्यूः", transliteration: "syūḥ", meaning: "the binding thread" },
                { word: "असि", transliteration: "asi", meaning: "you are" },
                { word: "ध्रुवम्", transliteration: "dhruvam", meaning: "the firm, the immovable" },
                { word: "वैष्णवम्", transliteration: "vaiṣṇavam", meaning: "belonging to Vishnu" },
                { word: "विष्णवे", transliteration: "viṣṇave", meaning: "for Vishnu" },
                { word: "त्वा", transliteration: "tvā", meaning: "you (I dedicate)" }
              ],
              translation: "You are the forehead of Vishnu, the back of Vishnu, the sinews of Vishnu, the binding thread of Vishnu, the firm foundation of Vishnu. All belongs to Vishnu — I dedicate you to Vishnu.",
              significance: "This extraordinary verse maps the entire body of reality onto Vishnu — every part is divine. Esoterically, it means that Mercury's analytical faculty, which naturally divides and categorizes, must ultimately recognize that every fragment it examines is Vishnu (the all-pervading). The forehead (rarata) is the seat of intellect, the back (prishtha) is support, the sinews (snaptre) are connections, the thread (syura) is continuity, and the firm ground (dhruva) is the unchanging foundation. When Mercury (intellect) sees Vishnu (divinity) in every category it creates, analysis becomes worship. 'Vishnave tva' — I dedicate all my knowledge to the All-Pervading."
            }
          ]
        },
        {
          graha: 5,
          grahaName: "Guru",
          grahaNameSanskrit: "गुरुः",
          grahaEnglish: "Jupiter",
          grahaCssClass: "graha-guru",
          summary: "Guru (Brihaspati), Jupiter, is the teacher of the gods and lord of wisdom. His Adhidevata is Indra and Pratydhidevata is Brahma. These mantras invoke Brihaspati's illuminating wisdom and the creative power of Brahman.",
          slokas: [
            {
              stotra: "suktam",
              graha: 5,
              sloka: 1,
              devanagari: "ॐ बृहस्पते अतियदर्यो अर्हाद्द्युमद्विभाति क्रतुमज्जनेषु ।\nयद्दिदयच्चवसर्तप्रजात तदस्मासु द्रविणन्धेहि चित्रम् ॥",
              transliteration: "om bṛhaspate ati yad aryo arhād dyumad vibhāti kratum aj janeṣu |\nyad didayac chavasṛtaprajāta tad asmāsu draviṇan dhehi citram ||",
              words: [
                { word: "ॐ", transliteration: "om", meaning: "the sacred syllable" },
                { word: "बृहस्पते", transliteration: "bṛhaspate", meaning: "O Brihaspati (lord of prayer)" },
                { word: "अति", transliteration: "ati", meaning: "beyond, surpassing" },
                { word: "यत्", transliteration: "yat", meaning: "that which" },
                { word: "अर्यः", transliteration: "aryaḥ", meaning: "the noble one" },
                { word: "अर्हात्", transliteration: "arhāt", meaning: "from the worthy / deserving" },
                { word: "द्युमत्", transliteration: "dyumat", meaning: "brilliantly" },
                { word: "विभाति", transliteration: "vibhāti", meaning: "shines forth" },
                { word: "क्रतुम्", transliteration: "kratum", meaning: "wisdom, sacred action" },
                { word: "अत्", transliteration: "at", meaning: "in" },
                { word: "जनेषु", transliteration: "janeṣu", meaning: "among the people" },
                { word: "यत्", transliteration: "yat", meaning: "that which" },
                { word: "दिदयत्", transliteration: "didayat", meaning: "shines, illumines" },
                { word: "तत्", transliteration: "tat", meaning: "that" },
                { word: "अस्मासु", transliteration: "asmāsu", meaning: "in us" },
                { word: "द्रविणम्", transliteration: "draviṇam", meaning: "wealth, prosperity" },
                { word: "धेहि", transliteration: "dhehi", meaning: "bestow, place" },
                { word: "चित्रम्", transliteration: "citram", meaning: "wonderful, manifold" }
              ],
              translation: "O Brihaspati, that which shines brilliantly beyond the noble ones, illuminating sacred wisdom among the people — bestow upon us that wonderful and manifold wealth.",
              significance: "Brihaspati literally means 'Lord of the Vast' (Brihat + Pati) — the principle that governs expansive consciousness. The 'wealth' (dravinam) sought here is not gold but 'chitram' — the wonderful, the variegated, the multicolored tapestry of wisdom. Jupiter-Guru energy doesn't give you one answer — it gives you the capacity to see truth in its infinite expressions. 'Dyumat vibhati' (shines brilliantly) indicates that true wisdom is self-luminous — it doesn't need external validation. When Jupiter is strong in consciousness, knowledge 'shines among the people' naturally, without effort. The Guru doesn't push wisdom; wisdom radiates from the Guru."
            },
            {
              stotra: "suktam",
              graha: 5,
              sloka: 2,
              devanagari: "इन्द्रमरुत्व इह पाहि सोमं यथा शार्याते अपिबस्सुतस्य ।\nतव प्रणीती तव शूरशर्मन्नाविवासन्ति कवयस्सुयज्ञाः ॥",
              transliteration: "indram arutva iha pāhi somaṁ yathā śāryāte apibas sutasya |\ntava praṇītī tava śūra śarmann āvivāsanti kavayaḥ suyajñāḥ ||",
              words: [
                { word: "इन्द्रम्", transliteration: "indram", meaning: "O Indra" },
                { word: "मरुत्वः", transliteration: "marutvaḥ", meaning: "accompanied by the Maruts (storm-gods)" },
                { word: "इह", transliteration: "iha", meaning: "here" },
                { word: "पाहि", transliteration: "pāhi", meaning: "drink, protect" },
                { word: "सोमम्", transliteration: "somam", meaning: "the Soma juice" },
                { word: "यथा", transliteration: "yathā", meaning: "just as" },
                { word: "शार्याते", transliteration: "śāryāte", meaning: "at the sacrifice of Sharyata" },
                { word: "अपिबः", transliteration: "apibaḥ", meaning: "you drank" },
                { word: "सुतस्य", transliteration: "sutasya", meaning: "of the pressed (Soma)" },
                { word: "तव", transliteration: "tava", meaning: "your" },
                { word: "प्रणीती", transliteration: "praṇītī", meaning: "guidance, leadership" },
                { word: "शूर", transliteration: "śūra", meaning: "O mighty one" },
                { word: "शर्मन्", transliteration: "śarman", meaning: "under your protection" },
                { word: "आविवासन्ति", transliteration: "āvivāsanti", meaning: "seek to win, desire to serve" },
                { word: "कवयः", transliteration: "kavayaḥ", meaning: "the wise seers" },
                { word: "सुयज्ञाः", transliteration: "suyajñāḥ", meaning: "performers of good sacrifice" }
              ],
              translation: "O Indra, accompanied by the Maruts, drink the Soma here, just as you drank at Sharyata's sacrifice. Under your guidance and protection, O mighty one, the wise seers and good sacrificers seek to serve you.",
              significance: "Indra is the Adhidevata of Jupiter. Indra represents the cosmic mind (mahat-tattva) — the first principle of intelligence in creation. The Maruts (storm-gods) are the pranic forces that accompany wisdom. 'Drinking Soma' is not literal intoxication but the absorption of refined consciousness — the Guru drinks deeply of understanding. The reference to Sharyata's sacrifice points to a specific historical moment when Indra accepted worship despite obstacles, teaching that the Guru-principle persists even when challenged. 'Kavayah suyajnah' (wise seers performing good sacrifice) — true students don't just receive knowledge, they offer themselves in the fire of learning."
            },
            {
              stotra: "suktam",
              graha: 5,
              sloka: 3,
              devanagari: "ब्रह्मजज्ञानं प्रथमं पुरस्ताद्विसीमतस्सुरुचो वेन आवः ।\nसबुध्निया उपमा अस्य विष्ठास्सतश्च योनिमसतश्च विवः ॥",
              transliteration: "brahma jajñānaṁ prathamaṁ purastād visīmatas surucho vena āvaḥ |\nsabudhniā upamā asya viṣṭhāḥ sataśca yonim asataśca vivaḥ ||",
              words: [
                { word: "ब्रह्म", transliteration: "brahma", meaning: "the Supreme Reality / creative principle" },
                { word: "जज्ञानम्", transliteration: "jajñānam", meaning: "being born, manifesting" },
                { word: "प्रथमम्", transliteration: "prathamam", meaning: "first, foremost" },
                { word: "पुरस्तात्", transliteration: "purastāt", meaning: "from the front, in the beginning" },
                { word: "विसीमतः", transliteration: "visīmataḥ", meaning: "from the boundaries, from the horizon" },
                { word: "सुरुचः", transliteration: "suruchaḥ", meaning: "of brilliant light" },
                { word: "वेनः", transliteration: "venaḥ", meaning: "the longing one / the loving one" },
                { word: "आवः", transliteration: "āvaḥ", meaning: "came forth, manifested" },
                { word: "सबुध्नियाः", transliteration: "sabudhniyāḥ", meaning: "from the depths" },
                { word: "उपमाः", transliteration: "upamāḥ", meaning: "the highest forms" },
                { word: "अस्य", transliteration: "asya", meaning: "of this" },
                { word: "विष्ठाः", transliteration: "viṣṭhāḥ", meaning: "manifestations, forms" },
                { word: "सतः", transliteration: "sataḥ", meaning: "of the existent" },
                { word: "च", transliteration: "ca", meaning: "and" },
                { word: "योनिम्", transliteration: "yonim", meaning: "the source, the womb" },
                { word: "असतः", transliteration: "asataḥ", meaning: "of the non-existent" },
                { word: "च", transliteration: "ca", meaning: "and" },
                { word: "विवः", transliteration: "vivaḥ", meaning: "he revealed, he entered" }
              ],
              translation: "Brahman, manifesting first in the beginning, came forth from the horizon as brilliant light. From the depths arose the highest forms of this reality — he revealed the source of both the existent and the non-existent.",
              significance: "Brahma is Jupiter's Pratydhidevata. This is one of the most metaphysically profound verses in all of Vedic literature. 'Brahma jajnanam prathamam' — Brahman (the Absolute) manifested first, before all else. From the 'visimata' (boundaries of the known) came 'suruchah' (brilliant light). This describes the moment of cosmic dawn — not just the Big Bang but the first flash of self-awareness in the Infinite. 'Satah cha yonim asatah cha vivah' — he revealed the source of both being and non-being. Jupiter-consciousness, at its highest, knows both existence and the void from which existence springs. This is para-vidya — the supreme knowledge that the Guru-principle ultimately transmits."
            }
          ]
        },
        {
          graha: 6,
          grahaName: "Shukra",
          grahaNameSanskrit: "शुक्रः",
          grahaEnglish: "Venus",
          grahaCssClass: "graha-shukra",
          summary: "Shukra (Venus) governs love, beauty, arts and material comforts. His Adhidevata is Indrani (Sachi Devi) and Pratydhidevata is Indra. These mantras invoke the brilliant light of Shukra and the power of Indrani.",
          slokas: [
            {
              stotra: "suktam",
              graha: 6,
              sloka: 1,
              devanagari: "ॐ प्रवश्शुक्राय भानवे भरध्वम् ।\nहव्यं मतिं चाग्नये सुपूतम् ॥",
              transliteration: "om pravaś śukrāya bhānave bharadhvam |\nhavyaṁ matiṁ cāgnaye supūtam ||",
              words: [
                { word: "ॐ", transliteration: "om", meaning: "the sacred syllable" },
                { word: "प्र", transliteration: "pra", meaning: "forth, forward" },
                { word: "वः", transliteration: "vaḥ", meaning: "your (offerings)" },
                { word: "शुक्राय", transliteration: "śukrāya", meaning: "to the brilliant one (Shukra)" },
                { word: "भानवे", transliteration: "bhānave", meaning: "to the radiant one" },
                { word: "भरध्वम्", transliteration: "bharadhvam", meaning: "bring forth, offer" },
                { word: "हव्यम्", transliteration: "havyam", meaning: "the oblation" },
                { word: "मतिम्", transliteration: "matim", meaning: "devotion, thought" },
                { word: "च", transliteration: "ca", meaning: "and" },
                { word: "अग्नये", transliteration: "agnaye", meaning: "to Agni (fire)" },
                { word: "सुपूतम्", transliteration: "supūtam", meaning: "well-purified" }
              ],
              translation: "Bring forth your offerings to the brilliant and radiant Shukra. Offer the well-purified oblation and devotion to Agni.",
              significance: "Shukra means 'the bright, the pure' — Venus is the planet of refinement. 'Suputam' (well-purified) is key: Venus-energy demands that our offerings to life — our art, love, devotion — be purified, not raw or crude. The 'havya' (oblation) is our creative expression, and 'mati' (thought/devotion) is the inner attitude behind it. This verse teaches that beauty is not indulgence — it is purified offering. When Venus is properly understood, aesthetics become a form of yajna (sacrifice). Every act of creating beauty is an offering to the divine fire."
            },
            {
              stotra: "suktam",
              graha: 6,
              sloka: 2,
              devanagari: "यो दैव्यानि मानुषा जनूंषि ।\nअन्तर्विश्वानि विद्मना जिगाति ॥",
              transliteration: "yo daivyāni mānuṣā janūṁṣi |\nantar viśvāni vidmanā jigāti ||",
              words: [
                { word: "यः", transliteration: "yaḥ", meaning: "he who" },
                { word: "दैव्यानि", transliteration: "daivyāni", meaning: "the divine (births)" },
                { word: "मानुषा", transliteration: "mānuṣā", meaning: "the human" },
                { word: "जनूंषि", transliteration: "janūṁṣi", meaning: "births, generations" },
                { word: "अन्तः", transliteration: "antaḥ", meaning: "within, between" },
                { word: "विश्वानि", transliteration: "viśvāni", meaning: "all (worlds)" },
                { word: "विद्मना", transliteration: "vidmanā", meaning: "with wisdom, with knowledge" },
                { word: "जिगाति", transliteration: "jigāti", meaning: "pervades, moves through" }
              ],
              translation: "He who pervades with wisdom all the divine and human births, moving through all the worlds with knowledge.",
              significance: "This verse reveals Venus's deeper nature — not merely sensual pleasure but 'vidmana' (wisdom) that pervades both divine and human realms. Shukra was the guru of the Asuras (demons), meaning Venus-wisdom can illuminate even the darkest aspects of existence. 'Antar vishvani jigati' — moving within all worlds — shows that the Venus-principle is not escapist beauty but an intelligence that penetrates everywhere, finding the sacred even in the profane. This is why Shukracharya possessed Sanjeevani Vidya (the knowledge of resurrection) — Venus-consciousness can revive what seems dead."
            },
            {
              stotra: "suktam",
              graha: 6,
              sloka: 3,
              devanagari: "इन्द्राणीमासु नारिषु सुपत्नीमहमश्रवम् ।\nन ह्यस्या अपरञ्चन जरसा मरते पतिः ॥",
              transliteration: "indrāṇīm āsu nāriṣu supatnīm aham aśravam |\nna hy asyā aparañcana jarasā marate patiḥ ||",
              words: [
                { word: "इन्द्राणीम्", transliteration: "indrāṇīm", meaning: "Indrani (consort of Indra)" },
                { word: "आसु", transliteration: "āsu", meaning: "among these" },
                { word: "नारिषु", transliteration: "nāriṣu", meaning: "women" },
                { word: "सुपत्नीम्", transliteration: "supatnīm", meaning: "the most fortunate wife" },
                { word: "अहम्", transliteration: "aham", meaning: "I" },
                { word: "अश्रवम्", transliteration: "aśravam", meaning: "have heard" },
                { word: "न", transliteration: "na", meaning: "not" },
                { word: "हि", transliteration: "hi", meaning: "indeed" },
                { word: "अस्याः", transliteration: "asyāḥ", meaning: "her" },
                { word: "अपरम्", transliteration: "aparam", meaning: "later, in future" },
                { word: "चन", transliteration: "cana", meaning: "ever" },
                { word: "जरसा", transliteration: "jarasā", meaning: "by old age" },
                { word: "मरते", transliteration: "marate", meaning: "dies" },
                { word: "पतिः", transliteration: "patiḥ", meaning: "husband (lord)" }
              ],
              translation: "I have heard that Indrani is the most fortunate wife among all women. Indeed, her husband (Indra) shall never die of old age.",
              significance: "Indrani (Sachi Devi) is the Adhidevata of Shukra. She represents Shakti — the feminine creative power inseparable from consciousness. Being the 'most fortunate wife' (supatni) means that when the creative feminine is honored, the masculine principle (Indra/consciousness) becomes immortal — 'jarasa marate patih' (her husband never dies of old age). This is the secret of Venus: when we honor beauty, love, and devotion (Shakti), our consciousness remains eternally youthful. Neglect the feminine and consciousness withers; honor it, and it becomes deathless."
            },
            {
              stotra: "suktam",
              graha: 6,
              sloka: 4,
              devanagari: "इन्द्रं वो विश्वतस्परि हवामहे जनेभ्यः ।\nअस्माकमस्तु केवलः ॥",
              transliteration: "indraṁ vo viśvatas pari havāmahe janebhyaḥ |\nasmākam astu kevalaḥ ||",
              words: [
                { word: "इन्द्रम्", transliteration: "indram", meaning: "Indra" },
                { word: "वः", transliteration: "vaḥ", meaning: "for you" },
                { word: "विश्वतः", transliteration: "viśvataḥ", meaning: "from all sides" },
                { word: "परि", transliteration: "pari", meaning: "all around" },
                { word: "हवामहे", transliteration: "havāmahe", meaning: "we invoke" },
                { word: "जनेभ्यः", transliteration: "janebhyaḥ", meaning: "from among the people" },
                { word: "अस्माकम्", transliteration: "asmākam", meaning: "ours" },
                { word: "अस्तु", transliteration: "astu", meaning: "may he be" },
                { word: "केवलः", transliteration: "kevalaḥ", meaning: "exclusively, solely" }
              ],
              translation: "We invoke Indra from all sides, from among all the peoples. May he be ours exclusively.",
              significance: "Indra as Pratydhidevata of Shukra represents sovereign will united with beauty. 'Kevala' (exclusively) is a loaded word in Vedanta — it means 'the absolute, the alone.' The prayer is not selfish exclusivity but a request for undivided attention from the divine — the kind of total absorption that characterizes both deep love and deep meditation. Venus, at its highest, is not about possessing beauty but about being so fully present to beauty that subject and object dissolve — and only 'kevala' (the Alone, the Absolute) remains."
            }
          ]
        },
        {
          graha: 7,
          grahaName: "Shani",
          grahaNameSanskrit: "शनिः",
          grahaEnglish: "Saturn",
          grahaCssClass: "graha-shani",
          summary: "Shani (Saturn) governs discipline, karma and justice. His Adhidevata is Prajapati (Brahma) and Pratydhidevata is Yama (lord of death). These mantras invoke the divine waters for nourishment and Prajapati as the lord of all creation.",
          slokas: [
            {
              stotra: "suktam",
              graha: 7,
              sloka: 1,
              devanagari: "ॐ शन्नो देवीरभिष्टय आपो भवन्तु पीतये ।\nशंयोरभिस्रवन्तु नः ॥",
              transliteration: "om śanno devīr abhiṣṭaya āpo bhavantu pītaye |\nśaṁ yor abhisravantu naḥ ||",
              words: [
                { word: "ॐ", transliteration: "om", meaning: "the sacred syllable" },
                { word: "शम्", transliteration: "śam", meaning: "auspiciousness, bliss" },
                { word: "नः", transliteration: "naḥ", meaning: "for us" },
                { word: "देवीः", transliteration: "devīḥ", meaning: "the divine (waters)" },
                { word: "अभिष्टये", transliteration: "abhiṣṭaye", meaning: "for our welfare, for blessing" },
                { word: "आपः", transliteration: "āpaḥ", meaning: "waters" },
                { word: "भवन्तु", transliteration: "bhavantu", meaning: "may they be" },
                { word: "पीतये", transliteration: "pītaye", meaning: "for drinking" },
                { word: "शम्", transliteration: "śam", meaning: "happiness, auspiciousness" },
                { word: "योः", transliteration: "yoḥ", meaning: "both (health and happiness)" },
                { word: "अभिस्रवन्तु", transliteration: "abhisravantu", meaning: "may they flow towards" },
                { word: "नः", transliteration: "naḥ", meaning: "us" }
              ],
              translation: "May the divine waters be auspicious for our welfare. May they be blissful for our drinking. May they flow towards us bringing happiness and health.",
              significance: "Saturn governs time, discipline, and karma. The prayer for auspicious waters is deceptively simple — it asks that the flow of time itself be benevolent. 'Sham' (auspiciousness) appears twice, encoding Saturn's hidden gift: Shani doesn't just punish — he can bestow deep peace (shanti) to those who accept discipline. The waters flowing for 'pitaye' (drinking) represent karma flowing in a way we can absorb and learn from, rather than being overwhelmed. This mantra transforms Saturn from a feared taskmaster into a source of purifying, nourishing flow — if you approach time and karma with humility."
            },
            {
              stotra: "suktam",
              graha: 7,
              sloka: 2,
              devanagari: "प्रजापते न त्वदेतान्यन्यो विश्वा जातानि परिता बभूव ।\nयत्कामास्ते जुहुमस्तन्नो अस्तु वयं स्याम पतयो रयीणाम् ॥",
              transliteration: "prajāpate na tvad etāny anyo viśvā jātāni paritā babhūva |\nyat kāmāste juhumas tanno astu vayaṁ syāma patayo rayīṇām ||",
              words: [
                { word: "प्रजापते", transliteration: "prajāpate", meaning: "O Prajapati (lord of creatures)" },
                { word: "न", transliteration: "na", meaning: "not" },
                { word: "त्वत्", transliteration: "tvat", meaning: "other than you" },
                { word: "एतानि", transliteration: "etāni", meaning: "these" },
                { word: "अन्यः", transliteration: "anyaḥ", meaning: "another" },
                { word: "विश्वा", transliteration: "viśvā", meaning: "all" },
                { word: "जातानि", transliteration: "jātāni", meaning: "created beings" },
                { word: "परिता", transliteration: "paritā", meaning: "encompassed" },
                { word: "बभूव", transliteration: "babhūva", meaning: "has become / has contained" },
                { word: "यत्कामाः", transliteration: "yatkāmāḥ", meaning: "with whatever desires" },
                { word: "ते", transliteration: "te", meaning: "to you" },
                { word: "जुहुमः", transliteration: "juhumaḥ", meaning: "we offer oblations" },
                { word: "तत्", transliteration: "tat", meaning: "that" },
                { word: "नः", transliteration: "naḥ", meaning: "for us" },
                { word: "अस्तु", transliteration: "astu", meaning: "may it be" },
                { word: "वयम्", transliteration: "vayam", meaning: "we" },
                { word: "स्याम", transliteration: "syāma", meaning: "may we become" },
                { word: "पतयः", transliteration: "patayaḥ", meaning: "lords, masters" },
                { word: "रयीणाम्", transliteration: "rayīṇām", meaning: "of riches" }
              ],
              translation: "O Prajapati, none other than you has encompassed all these created beings. With whatever desires we offer oblations to you, may those be fulfilled. May we become lords of riches.",
              significance: "Prajapati (Brahma, the Creator) is Saturn's Adhidevata — a profound pairing. Saturn restricts, yet his presiding deity is the Creator. This paradox reveals Saturn's deepest truth: limitation is the precondition of creation. A potter must limit clay to create a pot. 'Na tvad etani anyah' — no one else has encompassed all creation — means that the principle of structured limitation (Saturn) is what gives form to the formless. 'Patayo rayeenam' (lords of riches) — mastering Saturn's lessons of discipline, patience, and acceptance makes one truly wealthy, because real wealth is the ability to create within constraints."
            },
            {
              stotra: "suktam",
              graha: 7,
              sloka: 3,
              devanagari: "इमं यमप्रस्तरमाहि सीदाङ्गिरोभिः पितृभिस्संविदानः ।\nआत्वा मन्त्राः कविशस्ता वहन्त्वेना राजन्हविषा मादयस्व ॥",
              transliteration: "imaṁ yama prastaramāhi sīdā aṅgirobhiḥ pitṛbhis saṁvidānaḥ |\nātvā mantrāḥ kaviśastā vahantu enā rājan haviṣā mādayasva ||",
              words: [
                { word: "इमम्", transliteration: "imam", meaning: "this" },
                { word: "यम", transliteration: "yama", meaning: "O Yama (lord of death)" },
                { word: "प्रस्तरम्", transliteration: "prastaram", meaning: "the sacred seat (of kusha grass)" },
                { word: "आ", transliteration: "ā", meaning: "verily" },
                { word: "हि", transliteration: "hi", meaning: "indeed" },
                { word: "सीद", transliteration: "sīda", meaning: "be seated" },
                { word: "अङ्गिरोभिः", transliteration: "aṅgirobhiḥ", meaning: "with the Angirasa sages" },
                { word: "पितृभिः", transliteration: "pitṛbhiḥ", meaning: "with the ancestors" },
                { word: "संविदानः", transliteration: "saṁvidānaḥ", meaning: "in harmony, being united" },
                { word: "आ", transliteration: "ā", meaning: "verily" },
                { word: "त्वा", transliteration: "tvā", meaning: "you" },
                { word: "मन्त्राः", transliteration: "mantrāḥ", meaning: "the sacred hymns" },
                { word: "कविशस्ताः", transliteration: "kaviśastāḥ", meaning: "praised by the wise seers" },
                { word: "वहन्तु", transliteration: "vahantu", meaning: "may they carry / bring" },
                { word: "एना", transliteration: "enā", meaning: "with this" },
                { word: "राजन्", transliteration: "rājan", meaning: "O King" },
                { word: "हविषा", transliteration: "haviṣā", meaning: "with the oblation" },
                { word: "मादयस्व", transliteration: "mādayasva", meaning: "be delighted, rejoice" }
              ],
              translation: "O Yama, be seated on this sacred seat, in harmony with the Angirasa sages and the ancestors. May the sacred hymns praised by the wise seers bring you here. O King, rejoice with this oblation.",
              significance: "Yama (lord of death) is Saturn's Pratydhidevata. Inviting Yama to 'be seated' (sida) on the sacred grass is extraordinary — death is not rejected but honored as a guest. 'Samvidanah' (in harmony) with the ancestors (pitris) means that Saturn-consciousness connects us to our ancestral lineage and the accumulated karma of generations. The 'mantras praised by seers' (kavishasta) that 'carry' Yama represent how sacred knowledge transforms our relationship with mortality — instead of fearing death, we offer it hospitality. 'Madayasva' (rejoice) — when even death rejoices at our offering, what remains to fear? This is Saturn's ultimate liberation."
            }
          ]
        },
        {
          graha: 8,
          grahaName: "Rahu",
          grahaNameSanskrit: "राहुः",
          grahaEnglish: "Rahu (North Node)",
          grahaCssClass: "graha-rahu",
          summary: "Rahu, the north lunar node, represents illusion, ambition and material desire. His Adhidevata is Nirriti (goddess of misfortune) and Pratydhidevata is Durga. These mantras invoke Indra's mysterious power and seek release from bondage.",
          slokas: [
            {
              stotra: "suktam",
              graha: 8,
              sloka: 1,
              devanagari: "ॐ कया नश्चित्र आभुवदूती सदावृधस्सखा ।\nकया शचिष्ठया वृता ॥",
              transliteration: "om kayā naś citra ābhuvad ūtī sadāvṛdhas sakhā |\nkayā śaciṣṭhayā vṛtā ||",
              words: [
                { word: "ॐ", transliteration: "om", meaning: "the sacred syllable" },
                { word: "कया", transliteration: "kayā", meaning: "with what, by what means" },
                { word: "नः", transliteration: "naḥ", meaning: "to us" },
                { word: "चित्रः", transliteration: "citraḥ", meaning: "the wonderful one" },
                { word: "आभुवत्", transliteration: "ābhuvat", meaning: "may he come, may he manifest" },
                { word: "ऊती", transliteration: "ūtī", meaning: "with protection, with help" },
                { word: "सदावृधः", transliteration: "sadāvṛdhaḥ", meaning: "ever-growing, ever-prospering" },
                { word: "सखा", transliteration: "sakhā", meaning: "friend, companion" },
                { word: "कया", transliteration: "kayā", meaning: "with what" },
                { word: "शचिष्ठया", transliteration: "śaciṣṭhayā", meaning: "with the most powerful help" },
                { word: "वृता", transliteration: "vṛtā", meaning: "chosen, surrounded" }
              ],
              translation: "With what protection may the wonderful, ever-prospering friend come to us? With what most powerful help is he accompanied?",
              significance: "Rahu is the planet of mystery, obsession, and worldly ambition. The mantra opens with 'kaya' (by what means?) — a question, not a statement. This is Rahu's nature: uncertainty, seeking, grasping for what we cannot quite define. The 'chitra' (wonderful, strange) friend who is 'sadavridhah' (ever-growing) represents Rahu's insatiable hunger — desire that perpetually expands. Yet the verse doesn't condemn this seeking; it asks how to channel it properly. 'Shachishthaya' (most powerful help) suggests that Rahu's tremendous energy can be redirected from material obsession to spiritual seeking. The same force that drives worldly ambition can, when purified, become the most powerful spiritual aspiration."
            },
            {
              stotra: "suktam",
              graha: 8,
              sloka: 2,
              devanagari: "आऽयङ्गौः पृश्निरक्रमीदसनन्मातरं पुनः ।\nपितरञ्च प्रयन्त्सुवः ॥",
              transliteration: "āyaṅ gauḥ pṛśnir akramīd asanan mātaraṁ punaḥ |\npitarañca prayant suvaḥ ||",
              words: [
                { word: "आ", transliteration: "ā", meaning: "verily, here" },
                { word: "अयम्", transliteration: "ayam", meaning: "this" },
                { word: "गौः", transliteration: "gauḥ", meaning: "the ray of light / the cow (symbol of dawn)" },
                { word: "पृश्निः", transliteration: "pṛśniḥ", meaning: "the dappled one (the cloud/sky)" },
                { word: "अक्रमीत्", transliteration: "akramīt", meaning: "has come, has advanced" },
                { word: "असनत्", transliteration: "asanat", meaning: "reaching, attaining" },
                { word: "मातरम्", transliteration: "mātaram", meaning: "the mother (earth)" },
                { word: "पुनः", transliteration: "punaḥ", meaning: "again" },
                { word: "पितरम्", transliteration: "pitaram", meaning: "the father (heaven)" },
                { word: "च", transliteration: "ca", meaning: "and" },
                { word: "प्रयन्", transliteration: "prayan", meaning: "going towards" },
                { word: "सुवः", transliteration: "suvaḥ", meaning: "the sun / heaven" }
              ],
              translation: "This dappled ray of light has come forth, reaching the mother (earth) again and going towards the father (heaven/sun).",
              significance: "The 'dappled cow' (gauh prishnih) represents mixed light — partly illuminated, partly shadowed — which is Rahu's exact nature as the shadow planet that creates eclipses. 'Reaching the mother (earth) and going towards the father (sun)' maps the soul's journey between material embodiment and spiritual aspiration — Rahu's eternal oscillation. The verse reveals that Rahu is not evil but transitional — a force that moves between darkness and light, between mother-matter and father-spirit. Eclipses are not destruction but temporary passages. Rahu teaches that every shadow is cast by a greater light trying to emerge."
            },
            {
              stotra: "suktam",
              graha: 8,
              sloka: 3,
              devanagari: "यत्ते देवी निरृतिराबबन्ध दाम ग्रीवास्वविचर्त्यम् ।\nइदन्ते तद्विष्याम्यायुषो न मध्यादथाजीवः पितुमद्धि प्रमुक्तः ॥",
              transliteration: "yat te devī nirṛtir ābabandha dāma grīvāsv avicartryam |\nidan te tad viṣyāmy āyuṣo na madhyād athā jīvaḥ pitumaddhi pramuktaḥ ||",
              words: [
                { word: "यत्", transliteration: "yat", meaning: "that which" },
                { word: "ते", transliteration: "te", meaning: "your" },
                { word: "देवी", transliteration: "devī", meaning: "the goddess" },
                { word: "निरृतिः", transliteration: "nirṛtiḥ", meaning: "Nirriti (goddess of misfortune/destruction)" },
                { word: "आबबन्ध", transliteration: "ābabandha", meaning: "has bound, has tied" },
                { word: "दाम", transliteration: "dāma", meaning: "the cord, the bond" },
                { word: "ग्रीवासु", transliteration: "grīvāsu", meaning: "around the neck" },
                { word: "अविचर्त्यम्", transliteration: "avicartyam", meaning: "inescapable, that cannot be loosened" },
                { word: "इदम्", transliteration: "idam", meaning: "this" },
                { word: "ते", transliteration: "te", meaning: "your" },
                { word: "तत्", transliteration: "tat", meaning: "that" },
                { word: "विष्यामि", transliteration: "viṣyāmi", meaning: "I untie, I loosen" },
                { word: "आयुषः", transliteration: "āyuṣaḥ", meaning: "of life" },
                { word: "न", transliteration: "na", meaning: "not" },
                { word: "मध्यात्", transliteration: "madhyāt", meaning: "from the middle (i.e., not prematurely)" },
                { word: "अथ", transliteration: "atha", meaning: "then" },
                { word: "जीवः", transliteration: "jīvaḥ", meaning: "alive, living" },
                { word: "पितुमत्", transliteration: "pitumat", meaning: "nourishing food" },
                { word: "अद्धि", transliteration: "addhi", meaning: "eat, enjoy" },
                { word: "प्रमुक्तः", transliteration: "pramuktaḥ", meaning: "freed, released" }
              ],
              translation: "That inescapable cord which the goddess Nirriti has bound around your neck — I untie it for you, not from the middle of your life (not prematurely). Then, freed and alive, enjoy nourishing food.",
              significance: "Nirriti (goddess of misfortune and dissolution) is Rahu's Adhidevata, and Durga is his Pratydhidevata. The 'inescapable cord around the neck' is the most powerful image of karmic bondage — Rahu's grip of obsessive desire that strangles our freedom. 'Vishyami' (I untie) — the mantra itself becomes the act of liberation. 'Ayusho na madhyat' (not from the middle of life) means this liberation doesn't require death or renunciation — it happens while you're alive, in full vitality. 'Pitumaddhi pramuktah' (freed, eat nourishing food) — after Rahu's grip is loosened, you can enjoy the world again, but now as a free being. This is Rahu's ultimate teaching: desire is not the enemy — bondage to desire is. Freed from the cord, you feast on life itself."
            }
          ]
        },
        {
          graha: 9,
          grahaName: "Ketu",
          grahaNameSanskrit: "केतुः",
          grahaEnglish: "Ketu (South Node)",
          grahaCssClass: "graha-ketu",
          summary: "Ketu, the south lunar node, represents spiritual liberation, detachment and past karma. His Adhidevata is Brahma and Pratydhidevata is Chitragupta. These mantras invoke the banner of divine light and the purifying power of Soma.",
          slokas: [
            {
              stotra: "suktam",
              graha: 9,
              sloka: 1,
              devanagari: "ॐ केतुङ्कृण्वन्नकेतवे पेशो मर्या अपेशसे ।\nसमुषद्भिरजायथाः ॥",
              transliteration: "om ketuṅ kṛṇvann aketave peśo maryā apeśase |\nsamuṣadbhir ajāyathāḥ ||",
              words: [
                { word: "ॐ", transliteration: "om", meaning: "the sacred syllable" },
                { word: "केतुम्", transliteration: "ketum", meaning: "the banner, the bright sign" },
                { word: "कृण्वन्", transliteration: "kṛṇvan", meaning: "creating, making" },
                { word: "अकेतवे", transliteration: "aketave", meaning: "for the formless, for the unseen" },
                { word: "पेशः", transliteration: "peśaḥ", meaning: "form, beauty" },
                { word: "मर्या", transliteration: "maryā", meaning: "O mortal one" },
                { word: "अपेशसे", transliteration: "apeśase", meaning: "for the formless one" },
                { word: "सम्", transliteration: "sam", meaning: "together" },
                { word: "उषद्भिः", transliteration: "uṣadbhiḥ", meaning: "with the dawns" },
                { word: "अजायथाः", transliteration: "ajāyathāḥ", meaning: "you were born" }
              ],
              translation: "Creating a banner of light for the formless, giving form to the formless — O mortal one, you were born together with the dawns.",
              significance: "Ketu means 'banner' or 'flag' — and this verse is his defining mantra. 'Ketum krinvan aketave' — creating a sign for the signless, a form for the formless — is the paradox of spiritual realization. Ketu represents moksha (liberation), which is the formless becoming known. 'Pesho marya apeshase' — giving beauty to the formless — means that liberation is not colorless void but the most radiant beauty of all. 'Samushadbhih ajayathah' (born with the dawns) — Ketu-consciousness is born anew each moment of awakening. Unlike Rahu who clings to the past, Ketu is perpetually fresh, perpetually at dawn. This is why Ketu gives spiritual insight — it creates a visible banner pointing toward the invisible Absolute."
            },
            {
              stotra: "suktam",
              graha: 9,
              sloka: 2,
              devanagari: "ब्रह्मा देवानां पदवीः कवीनामृषिर्विप्राणां महिषो मृगाणाम् ।\nश्येनोगृध्राणां स्वधितिर्वनानां सोमः पवित्रमत्येति रेभन् ॥",
              transliteration: "brahmā devānāṁ padavīḥ kavīnām ṛṣir viprāṇāṁ mahiṣo mṛgāṇām |\nśyeno gṛdhrāṇāṁ svadhitir vanānāṁ somaḥ pavitram atyeti rebhan ||",
              words: [
                { word: "ब्रह्मा", transliteration: "brahmā", meaning: "Brahma (the Supreme)" },
                { word: "देवानाम्", transliteration: "devānām", meaning: "among the gods" },
                { word: "पदवीः", transliteration: "padavīḥ", meaning: "the leader, the guide" },
                { word: "कवीनाम्", transliteration: "kavīnām", meaning: "among the poets/seers" },
                { word: "ऋषिः", transliteration: "ṛṣiḥ", meaning: "the sage" },
                { word: "विप्राणाम्", transliteration: "viprāṇām", meaning: "among the learned" },
                { word: "महिषः", transliteration: "mahiṣaḥ", meaning: "the bull, the mighty one" },
                { word: "मृगाणाम्", transliteration: "mṛgāṇām", meaning: "among the animals" },
                { word: "श्येनः", transliteration: "śyenaḥ", meaning: "the eagle, the hawk" },
                { word: "गृध्राणाम्", transliteration: "gṛdhrāṇām", meaning: "among the vultures/birds of prey" },
                { word: "स्वधितिः", transliteration: "svadhitiḥ", meaning: "the axe" },
                { word: "वनानाम्", transliteration: "vanānām", meaning: "among the forests/trees" },
                { word: "सोमः", transliteration: "somaḥ", meaning: "Soma" },
                { word: "पवित्रम्", transliteration: "pavitram", meaning: "the purifier" },
                { word: "अत्येति", transliteration: "atyeti", meaning: "passes through, transcends" },
                { word: "रेभन्", transliteration: "rebhan", meaning: "resounding, singing" }
              ],
              translation: "Brahma among the gods, the guide among seers, the sage among the learned, the mighty bull among animals, the eagle among birds, the axe among forests — Soma, the purifier, passes through all, resounding.",
              significance: "Brahma is Ketu's Adhidevata. This verse lists Soma's supremacy in every category of existence — he is the best among each class. Esoterically, this reveals that the Ketu-principle (liberation) is not separate from the world but is the pinnacle of every domain. The 'axe among forests' (svadhitir vananam) is especially telling — Ketu, like an axe, cuts through the dense forest of illusion. 'Pavitram atyeti rebhan' — the purifier passes through everything, singing. Ketu-consciousness moves through all of life's experiences, purifying each one, and its 'song' (rebhan) is the unstruck sound (anahata nada) of spiritual realization that pervades all creation once the veil of ignorance is cut."
            },
            {
              stotra: "suktam",
              graha: 9,
              sloka: 3,
              devanagari: "सचित्र चित्रं चितयन्तमस्मे चित्रक्षत्र चित्रतमं वयोधाम् ।\nचन्द्रं रयिं पुरुवीरं बृहन्तं चन्द्रचन्द्राभिर्गृणते युवस्व ॥",
              transliteration: "sacitra citraṁ citayantam asme citrakṣatra citratmaṁ vayodhām |\ncandraṁ rayiṁ puruvīram bṛhantaṁ candracadrābhir gṛṇate yuvasva ||",
              words: [
                { word: "सचित्र", transliteration: "sacitra", meaning: "O possessor of brilliance" },
                { word: "चित्रम्", transliteration: "citram", meaning: "the wonderful, the brilliant" },
                { word: "चितयन्तम्", transliteration: "citayantam", meaning: "the one who illumines, who perceives" },
                { word: "अस्मे", transliteration: "asme", meaning: "for us" },
                { word: "चित्रक्षत्र", transliteration: "citrakṣatra", meaning: "O brilliant ruler" },
                { word: "चित्रतमम्", transliteration: "citratamam", meaning: "the most brilliant" },
                { word: "वयोधाम्", transliteration: "vayodhām", meaning: "the giver of vigor / sustainer of life" },
                { word: "चन्द्रम्", transliteration: "candram", meaning: "shining, delightful" },
                { word: "रयिम्", transliteration: "rayim", meaning: "wealth" },
                { word: "पुरुवीरम्", transliteration: "puruvīram", meaning: "rich in heroes / many brave sons" },
                { word: "बृहन्तम्", transliteration: "bṛhantam", meaning: "vast, great" },
                { word: "चन्द्रचन्द्राभिः", transliteration: "candracandrābhiḥ", meaning: "with shining praises" },
                { word: "गृणते", transliteration: "gṛṇate", meaning: "to the one who praises / sings" },
                { word: "युवस्व", transliteration: "yuvasva", meaning: "unite with, bestow upon" }
              ],
              translation: "O brilliant ruler, bestow upon us the most wonderful, illuminating, life-sustaining wealth — shining, vast, rich in heroes. Unite this with the one who sings your shining praises.",
              significance: "Chitragupta is Ketu's Pratydhidevata — the one who records all karmic accounts. 'Chitra' appears five times in this verse — chitra (wonderful), chitayantam (illuminating), chitrakshatra (brilliant ruler), chitratamam (most brilliant), and even implicitly in chandra (shining). This cascading repetition creates a mantra within a mantra — the vibration of 'chitra' dissolves the boundary between seer and seen. 'Vayodham' (sustainer of life-force) tells us Ketu doesn't diminish life but sustains its deepest vitality. 'Grinata yuvasva' (unite with the one who praises) — the final prayer of the entire Navagraha Suktam asks for union. Ketu's ultimate gift is not detachment from life but merger with the luminous source of all life."
            }
          ]
        }
      ]
    },
    {
      id: "peedahara",
      titleSanskrit: "नवग्रह पीडाहर स्तोत्रम्",
      titleEnglish: "Navagraha Peedahara Stotram",
      titleMeaning: "Hymn to Remove the Afflictions of the Nine Planets",
      summary: "The Navagraha Peedahara Stotram is from the Brahmanda Purana. It consists of nine powerful verses, each addressing one of the nine grahas, seeking relief from their afflictions (peeda). Each verse ends with the refrain 'peedaam haratu me' — 'may [the graha] remove my affliction'. This stotram is widely recited for planetary pacification.",
      grahas: [
        {
          graha: 1,
          grahaName: "Surya",
          grahaNameSanskrit: "सूर्यः",
          grahaEnglish: "Sun",
          grahaCssClass: "graha-surya",
          summary: "Surya (Ravi), the Sun, is the foremost of all grahas, the protector of the worlds.",
          slokas: [
            {
              stotra: "peedahara",
              graha: 1,
              sloka: 1,
              devanagari: "ग्रहाणामादिरादित्यो लोकरक्षणकारकः ।\nविषमस्थानसम्भूतां पीडां हरतु मे रविः ॥",
              transliteration: "grahāṇām ādir ādityō lōkarakṣaṇakārakaḥ |\nviṣamasthānasambhūtāṁ pīḍāṁ haratu mē raviḥ ||",
              words: [
                { word: "ग्रहाणाम्", transliteration: "grahāṇām", meaning: "of the grahas (planets)" },
                { word: "आदिः", transliteration: "ādiḥ", meaning: "the first, the foremost" },
                { word: "आदित्यः", transliteration: "ādityaḥ", meaning: "Aditya (the Sun, son of Aditi)" },
                { word: "लोकरक्षणकारकः", transliteration: "lōkarakṣaṇakārakaḥ", meaning: "the protector of the worlds" },
                { word: "विषमस्थानसम्भूताम्", transliteration: "viṣamasthānasambhūtām", meaning: "arising from an unfavorable position" },
                { word: "पीडाम्", transliteration: "pīḍām", meaning: "affliction, suffering" },
                { word: "हरतु", transliteration: "haratu", meaning: "may he remove" },
                { word: "मे", transliteration: "mē", meaning: "my" },
                { word: "रविः", transliteration: "raviḥ", meaning: "Ravi (the Sun)" }
              ],
              translation: "Aditya (the Sun) is the foremost of all grahas and the protector of the worlds. May Ravi remove the affliction arising from his unfavorable position."
            }
          ]
        },
        {
          graha: 2,
          grahaName: "Chandra",
          grahaNameSanskrit: "चन्द्रः",
          grahaEnglish: "Moon",
          grahaCssClass: "graha-chandra",
          summary: "Chandra (Vidhu), the Moon, lord of Rohini, whose body is made of nectar.",
          slokas: [
            {
              stotra: "peedahara",
              graha: 2,
              sloka: 1,
              devanagari: "रोहिणीशः सुधामूर्तिः सुधागात्रः सुधाशनः ।\nविषमस्थानसम्भूतां पीडां हरतु मे विधुः ॥",
              transliteration: "rōhiṇīśaḥ sudhāmūrtiḥ sudhāgātraḥ sudhāśanaḥ |\nviṣamasthānasambhūtāṁ pīḍāṁ haratu mē vidhuḥ ||",
              words: [
                { word: "रोहिणीशः", transliteration: "rōhiṇīśaḥ", meaning: "the lord of Rohini (Moon's favorite star)" },
                { word: "सुधामूर्तिः", transliteration: "sudhāmūrtiḥ", meaning: "whose form is of nectar" },
                { word: "सुधागात्रः", transliteration: "sudhāgātraḥ", meaning: "whose body is of nectar" },
                { word: "सुधाशनः", transliteration: "sudhāśanaḥ", meaning: "who feeds on nectar" },
                { word: "विषमस्थानसम्भूताम्", transliteration: "viṣamasthānasambhūtām", meaning: "arising from an unfavorable position" },
                { word: "पीडाम्", transliteration: "pīḍām", meaning: "affliction" },
                { word: "हरतु", transliteration: "haratu", meaning: "may he remove" },
                { word: "मे", transliteration: "mē", meaning: "my" },
                { word: "विधुः", transliteration: "vidhuḥ", meaning: "Vidhu (the Moon)" }
              ],
              translation: "The lord of Rohini, whose form, body and food are all nectar — may Vidhu (the Moon) remove the affliction arising from his unfavorable position."
            }
          ]
        },
        {
          graha: 3,
          grahaName: "Mangala",
          grahaNameSanskrit: "मङ्गलः",
          grahaEnglish: "Mars",
          grahaCssClass: "graha-mangala",
          summary: "Mangala (Kuja), Mars, the son of Earth, of great brilliance, creator and destroyer of rains.",
          slokas: [
            {
              stotra: "peedahara",
              graha: 3,
              sloka: 1,
              devanagari: "भूमिपुत्रो महातेजा जगतां भयकृत् सदा ।\nवृष्टिकृद्वृष्टिहर्ता च पीडां हरतु मे कुजः ॥",
              transliteration: "bhūmiputrō mahātējā jagatāṁ bhayakṛt sadā |\nvṛṣṭikṛd vṛṣṭihartā ca pīḍāṁ haratu mē kujaḥ ||",
              words: [
                { word: "भूमिपुत्रः", transliteration: "bhūmiputraḥ", meaning: "son of the Earth" },
                { word: "महातेजाः", transliteration: "mahātējāḥ", meaning: "of great brilliance" },
                { word: "जगताम्", transliteration: "jagatām", meaning: "of the worlds" },
                { word: "भयकृत्", transliteration: "bhayakṛt", meaning: "the creator of fear" },
                { word: "सदा", transliteration: "sadā", meaning: "always" },
                { word: "वृष्टिकृत्", transliteration: "vṛṣṭikṛt", meaning: "the creator of rain" },
                { word: "वृष्टिहर्ता", transliteration: "vṛṣṭihartā", meaning: "the remover of rain (drought)" },
                { word: "च", transliteration: "ca", meaning: "and" },
                { word: "पीडाम्", transliteration: "pīḍām", meaning: "affliction" },
                { word: "हरतु", transliteration: "haratu", meaning: "may he remove" },
                { word: "मे", transliteration: "mē", meaning: "my" },
                { word: "कुजः", transliteration: "kujaḥ", meaning: "Kuja (Mars, born of the Earth)" }
              ],
              translation: "The son of Earth, of great brilliance, who always creates fear in the worlds, who brings and takes away the rains — may Kuja (Mars) remove my affliction."
            }
          ]
        },
        {
          graha: 4,
          grahaName: "Budha",
          grahaNameSanskrit: "बुधः",
          grahaEnglish: "Mercury",
          grahaCssClass: "graha-budha",
          summary: "Budha (Mercury), son of Chandra, of great radiance, dear to Surya, the learned one.",
          slokas: [
            {
              stotra: "peedahara",
              graha: 4,
              sloka: 1,
              devanagari: "उत्पातरूपो जगतां चन्द्रपुत्रो महाद्युतिः ।\nसूर्यप्रियकरो विद्वान् पीडां हरतु मे बुधः ॥",
              transliteration: "utpātarūpō jagatāṁ candraputrō mahādyutiḥ |\nsūryapriyakarō vidvān pīḍāṁ haratu mē budhaḥ ||",
              words: [
                { word: "उत्पातरूपः", transliteration: "utpātarūpaḥ", meaning: "whose form portends great events" },
                { word: "जगताम्", transliteration: "jagatām", meaning: "of the worlds" },
                { word: "चन्द्रपुत्रः", transliteration: "candraputraḥ", meaning: "son of Chandra (the Moon)" },
                { word: "महाद्युतिः", transliteration: "mahādyutiḥ", meaning: "of great radiance" },
                { word: "सूर्यप्रियकरः", transliteration: "sūryapriyakaraḥ", meaning: "one who does what is dear to the Sun" },
                { word: "विद्वान्", transliteration: "vidvān", meaning: "the learned, the wise one" },
                { word: "पीडाम्", transliteration: "pīḍām", meaning: "affliction" },
                { word: "हरतु", transliteration: "haratu", meaning: "may he remove" },
                { word: "मे", transliteration: "mē", meaning: "my" },
                { word: "बुधः", transliteration: "budhaḥ", meaning: "Budha (Mercury)" }
              ],
              translation: "He whose form portends great events in the worlds, the son of Chandra, of great radiance, dear to Surya, the wise one — may Budha (Mercury) remove my affliction."
            }
          ]
        },
        {
          graha: 5,
          grahaName: "Guru",
          grahaNameSanskrit: "गुरुः",
          grahaEnglish: "Jupiter",
          grahaCssClass: "graha-guru",
          summary: "Guru (Brihaspati), Jupiter, the minister of the gods, always devoted to the welfare of all.",
          slokas: [
            {
              stotra: "peedahara",
              graha: 5,
              sloka: 1,
              devanagari: "देवमन्त्री विशालाक्षः सदा लोकहिते रतः ।\nअनेकशिष्यसम्पूर्णः पीडां हरतु मे गुरुः ॥",
              transliteration: "dēvamantrī viśālākṣaḥ sadā lōkahitē rataḥ |\nanēkaśiṣyasampūrṇaḥ pīḍāṁ haratu mē guruḥ ||",
              words: [
                { word: "देवमन्त्री", transliteration: "dēvamantrī", meaning: "the minister of the gods" },
                { word: "विशालाक्षः", transliteration: "viśālākṣaḥ", meaning: "large-eyed, broad-visioned" },
                { word: "सदा", transliteration: "sadā", meaning: "always" },
                { word: "लोकहिते", transliteration: "lōkahitē", meaning: "in the welfare of the world" },
                { word: "रतः", transliteration: "rataḥ", meaning: "devoted, engaged" },
                { word: "अनेकशिष्यसम्पूर्णः", transliteration: "anēkaśiṣyasampūrṇaḥ", meaning: "surrounded by many disciples" },
                { word: "पीडाम्", transliteration: "pīḍām", meaning: "affliction" },
                { word: "हरतु", transliteration: "haratu", meaning: "may he remove" },
                { word: "मे", transliteration: "mē", meaning: "my" },
                { word: "गुरुः", transliteration: "guruḥ", meaning: "Guru (Jupiter, the teacher)" }
              ],
              translation: "The minister of the gods, broad-visioned, always devoted to the welfare of the world, surrounded by many disciples — may Guru (Jupiter) remove my affliction."
            }
          ]
        },
        {
          graha: 6,
          grahaName: "Shukra",
          grahaNameSanskrit: "शुक्रः",
          grahaEnglish: "Venus",
          grahaCssClass: "graha-shukra",
          summary: "Shukra (Bhrigu), Venus, the minister of the Daityas, the great-minded one, lord of the star-planets.",
          slokas: [
            {
              stotra: "peedahara",
              graha: 6,
              sloka: 1,
              devanagari: "दैत्यमन्त्री गुरुस्तेषां प्राणदश्च महामतिः ।\nप्रभुस्ताराग्रहाणां च पीडां हरतु मे भृगुः ॥",
              transliteration: "daityamantrī gurusteṣāṁ prāṇadaśca mahāmatiḥ |\nprabhustārāgrahāṇāṁ ca pīḍāṁ haratu mē bhṛguḥ ||",
              words: [
                { word: "दैत्यमन्त्री", transliteration: "daityamantrī", meaning: "the minister of the Daityas (demons)" },
                { word: "गुरुः", transliteration: "guruḥ", meaning: "the teacher" },
                { word: "तेषाम्", transliteration: "teṣām", meaning: "of them" },
                { word: "प्राणदः", transliteration: "prāṇadaḥ", meaning: "the giver of life" },
                { word: "च", transliteration: "ca", meaning: "and" },
                { word: "महामतिः", transliteration: "mahāmatiḥ", meaning: "the great-minded one" },
                { word: "प्रभुः", transliteration: "prabhuḥ", meaning: "the lord, the master" },
                { word: "ताराग्रहाणाम्", transliteration: "tārāgrahāṇām", meaning: "of the star-planets" },
                { word: "च", transliteration: "ca", meaning: "and" },
                { word: "पीडाम्", transliteration: "pīḍām", meaning: "affliction" },
                { word: "हरतु", transliteration: "haratu", meaning: "may he remove" },
                { word: "मे", transliteration: "mē", meaning: "my" },
                { word: "भृगुः", transliteration: "bhṛguḥ", meaning: "Bhrigu (Venus, of the Bhrigu lineage)" }
              ],
              translation: "The minister and teacher of the Daityas, the giver of life, the great-minded one, the lord of the star-planets — may Bhrigu (Venus) remove my affliction."
            }
          ]
        },
        {
          graha: 7,
          grahaName: "Shani",
          grahaNameSanskrit: "शनिः",
          grahaEnglish: "Saturn",
          grahaCssClass: "graha-shani",
          summary: "Shani (Saturn), son of Surya, of long body, large-eyed, dear to Shiva, of slow movement and serene soul.",
          slokas: [
            {
              stotra: "peedahara",
              graha: 7,
              sloka: 1,
              devanagari: "सूर्यपुत्रो दीर्घदेहो विशालाक्षः शिवप्रियः ।\nमन्दचारः प्रसन्नात्मा पीडां हरतु मे शनिः ॥",
              transliteration: "sūryaputrō dīrghadēhō viśālākṣaḥ śivapriyaḥ |\nmandacāraḥ prasannātmā pīḍāṁ haratu mē śaniḥ ||",
              words: [
                { word: "सूर्यपुत्रः", transliteration: "sūryaputraḥ", meaning: "son of Surya (the Sun)" },
                { word: "दीर्घदेहः", transliteration: "dīrghadēhaḥ", meaning: "of long/tall body" },
                { word: "विशालाक्षः", transliteration: "viśālākṣaḥ", meaning: "large-eyed" },
                { word: "शिवप्रियः", transliteration: "śivapriyaḥ", meaning: "dear to Lord Shiva" },
                { word: "मन्दचारः", transliteration: "mandacāraḥ", meaning: "of slow movement" },
                { word: "प्रसन्नात्मा", transliteration: "prasannātmā", meaning: "of serene soul" },
                { word: "पीडाम्", transliteration: "pīḍām", meaning: "affliction" },
                { word: "हरतु", transliteration: "haratu", meaning: "may he remove" },
                { word: "मे", transliteration: "mē", meaning: "my" },
                { word: "शनिः", transliteration: "śaniḥ", meaning: "Shani (Saturn)" }
              ],
              translation: "The son of Surya, of tall body, large-eyed, dear to Shiva, of slow movement and serene soul — may Shani (Saturn) remove my affliction."
            }
          ]
        },
        {
          graha: 8,
          grahaName: "Rahu",
          grahaNameSanskrit: "राहुः",
          grahaEnglish: "Rahu (North Node)",
          grahaCssClass: "graha-rahu",
          summary: "Rahu (Tamas), of many forms and colors, appearing in hundreds and thousands of forms.",
          slokas: [
            {
              stotra: "peedahara",
              graha: 8,
              sloka: 1,
              devanagari: "अनेकरूपवर्णैश्च शतशोऽथ सहस्रशः ।\nउत्पातरूपो जगतां पीडां हरतु मे तमः ॥",
              transliteration: "anēkarūpavarṇaiśca śataśō'tha sahasraśaḥ |\nutpātarūpō jagatāṁ pīḍāṁ haratu mē tamaḥ ||",
              words: [
                { word: "अनेकरूपवर्णैः", transliteration: "anēkarūpavarṇaiḥ", meaning: "with many forms and colors" },
                { word: "च", transliteration: "ca", meaning: "and" },
                { word: "शतशः", transliteration: "śataśaḥ", meaning: "in hundreds" },
                { word: "अथ", transliteration: "atha", meaning: "and then" },
                { word: "सहस्रशः", transliteration: "sahasraśaḥ", meaning: "in thousands" },
                { word: "उत्पातरूपः", transliteration: "utpātarūpaḥ", meaning: "whose form portends great events" },
                { word: "जगताम्", transliteration: "jagatām", meaning: "of the worlds" },
                { word: "पीडाम्", transliteration: "pīḍām", meaning: "affliction" },
                { word: "हरतु", transliteration: "haratu", meaning: "may he remove" },
                { word: "मे", transliteration: "mē", meaning: "my" },
                { word: "तमः", transliteration: "tamaḥ", meaning: "Tamas (Rahu, the dark one)" }
              ],
              translation: "He of many forms and colors, appearing in hundreds and thousands, whose form portends great events in the worlds — may Tamas (Rahu) remove my affliction."
            }
          ]
        },
        {
          graha: 9,
          grahaName: "Ketu",
          grahaNameSanskrit: "केतुः",
          grahaEnglish: "Ketu (South Node)",
          grahaCssClass: "graha-ketu",
          summary: "Ketu (Shikhi), of great head and mouth, long-tusked, mighty, with hair standing upward.",
          slokas: [
            {
              stotra: "peedahara",
              graha: 9,
              sloka: 1,
              devanagari: "महाशिरा महावक्त्रो दीर्घदंष्ट्रो महाबलः ।\nअतनुश्चोर्ध्वकेशश्च पीडां हरतु मे शिखी ॥",
              transliteration: "mahāśirā mahāvaktrō dīrghadaṁṣṭrō mahābalaḥ |\natanuścōrdhvakēśaśca pīḍāṁ haratu mē śikhī ||",
              words: [
                { word: "महाशिराः", transliteration: "mahāśirāḥ", meaning: "of great head" },
                { word: "महावक्त्रः", transliteration: "mahāvaktraḥ", meaning: "of great mouth/face" },
                { word: "दीर्घदंष्ट्रः", transliteration: "dīrghadaṁṣṭraḥ", meaning: "of long tusks/fangs" },
                { word: "महाबलः", transliteration: "mahābalaḥ", meaning: "of great strength" },
                { word: "अतनुः", transliteration: "atanuḥ", meaning: "not slender, massive / bodiless" },
                { word: "च", transliteration: "ca", meaning: "and" },
                { word: "ऊर्ध्वकेशः", transliteration: "ūrdhvakēśaḥ", meaning: "with hair standing upward (like flames)" },
                { word: "च", transliteration: "ca", meaning: "and" },
                { word: "पीडाम्", transliteration: "pīḍām", meaning: "affliction" },
                { word: "हरतु", transliteration: "haratu", meaning: "may he remove" },
                { word: "मे", transliteration: "mē", meaning: "my" },
                { word: "शिखी", transliteration: "śikhī", meaning: "Shikhi (Ketu, the flame-crested one)" }
              ],
              translation: "Of great head, great mouth, long tusks, great strength, massive form and upward-standing hair — may Shikhi (Ketu) remove my affliction."
            }
          ]
        }
      ]
    }
  ]
};
