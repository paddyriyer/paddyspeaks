// Bhaja Govindam - Complete Data
// Composed by Jagadguru Adi Shankaracharya (8th century CE)
// Also known as Moha Mudgara (The Hammer that Shatters Delusion)
// With Sanskrit, transliteration, English translation, and real-life interpretations

const BHAJA_GOVINDAM_DATA = [
  {
    num: 1,
    sanskrit: "भज गोविन्दं भज गोविन्दं\nगोविन्दं भज मूढमते ।\nसम्प्राप्ते सन्निहिते काले\nनहि नहि रक्षति डुकृञ्करणे ॥ १ ॥",
    transliteration: "bhaja govindaṃ bhaja govindaṃ\ngovindaṃ bhaja mūḍhamate |\nsamprāpte sannihite kāle\nnahi nahi rakṣati ḍukṛñkaraṇe || 1 ||",
    translation: "Worship Govinda, worship Govinda, worship Govinda, O fool! When the appointed time of death arrives, the rules of grammar you have memorized will not save you.",
    realLife: "Shankara opens with a thunderclap. He once saw an old Varanasi pandit cramming Sanskrit grammar rules on his deathbed — still chasing intellectual pride instead of seeking the Divine. This verse is not against learning; it is against mistaking the tool for the treasure. In modern life, we hoard degrees, certifications, and LinkedIn endorsements, believing they define us. But when life delivers its final exam — illness, loss, mortality — no resume can answer it. Shankara says: stop polishing the ladder and start climbing. Knowledge that does not lead to wisdom is decoration, not liberation."
  },
  {
    num: 2,
    sanskrit: "मूढ जहीहि धनागमतृष्णां\nकुरु सद्बुद्धिं मनसि वितृष्णाम् ।\nयल्लभसे निजकर्मोपात्तं\nवित्तं तेन विनोदय चित्तम् ॥ २ ॥",
    transliteration: "mūḍha jahīhi dhanāgamatṛṣṇāṃ\nkuru sadbuddhiṃ manasi vitṛṣṇām |\nyallabhase nijakarmoopāttaṃ\nvittaṃ tena vinodaya cittam || 2 ||",
    translation: "O fool, give up the thirst for accumulating wealth. Create in your mind thoughts free from desire. Be content with what comes through your own rightful actions and efforts.",
    realLife: "Shankara saw merchants in temple towns who prayed for more wealth while ignoring the wealth of being alive. This verse addresses the endless treadmill of wanting more — the next salary hike, the bigger house, the upgraded phone. He is not saying 'be poor.' He is saying 'stop being poor inside while being rich outside.' The person earning modestly but sleeping peacefully is wealthier than the billionaire awake at 3 AM checking stock prices. Earn honestly, spend wisely, and let your contentment come from within — not from your bank balance."
  },
  {
    num: 3,
    sanskrit: "नारीस्तनभरनाभीदेशं\nदृष्ट्वा मा गा मोहावेशम् ।\nएतन्मांसवसादिविकारं\nमनसि विचिन्तय वारं वारम् ॥ ३ ॥",
    transliteration: "nārīstanabharanābhīdeśaṃ\ndṛṣṭvā mā gā mohāveśam |\netanmāṃsavasādivikāraṃ\nmanasi vicintaya vāraṃ vāram || 3 ||",
    translation: "Seeing the physical beauty of a woman, do not fall into delusion. Remember again and again — it is but a modification of flesh, fat, and other tissues.",
    realLife: "This verse is often misread as misogynistic, but Shankara is addressing the universal human tendency to become enslaved by physical attraction — applicable to all genders. He lived in 8th-century India where monks were his primary audience. The deeper teaching: we project permanence onto what is inherently impermanent. Today, we are obsessed with appearance — filters, cosmetic procedures, the cult of the body. Shankara says: appreciate beauty, but do not become its prisoner. When you reduce another person to their body, you diminish both them and yourself. True connection is soul-deep, not skin-deep."
  },
  {
    num: 4,
    sanskrit: "नलिनीदलगतजलमतितरलं\nतद्वज्जीवितमतिशयचपलम् ।\nविद्धि व्याध्यभिमानग्रस्तं\nलोकं शोकहतं च समस्तम् ॥ ४ ॥",
    transliteration: "nalinīdalagatajalamati taralaṃ\ntadvajjīvitamatiśayacapalam |\nviddhi vyādhyabhimānagrastaṃ\nlokaṃ śokahataṃ ca samastam || 4 ||",
    translation: "Life is as uncertain as a drop of water on a lotus petal. Know that the entire world is consumed by disease, ego, and grief.",
    realLife: "Shankara watched pilgrims at Kashi — many came healthy and left as corpses on the cremation ghats. A water drop on a lotus leaf trembles with every breeze and can fall any moment. That is your life. We make 5-year plans, 10-year plans, retirement plans — but forget that life makes no promises past this breath. This is not pessimism; it is the most radical optimism. When you truly understand impermanence, you stop postponing joy, stop hoarding grudges, and start living with fierce presence. Every morning you wake up is a miracle you did not earn."
  },
  {
    num: 5,
    sanskrit: "यावद्वित्तोपार्जनसक्तः\nस्तावन्निजपरिवारो रक्तः ।\nपश्चाज्जीवति जर्जरदेहे\nवार्तां कोऽपि न पृच्छति गेहे ॥ ५ ॥",
    transliteration: "yāvadvittopārjanasaktaḥ\nstāvannijaparivāro raktaḥ |\npaścājjīvati jarjaradehe\nvārtāṃ ko'pi na pṛcchati gehe || 5 ||",
    translation: "As long as you are able to earn money, so long your family shows affection. But when your body becomes decrepit and you can no longer provide, no one at home even asks how you are.",
    realLife: "Shankara had witnessed the harsh truth of transactional relationships long before modern sociology named it. This verse is a mirror held up to every person who sacrifices health, time with children, and inner peace for the sake of 'providing.' The father who missed every school play to work overtime finds himself alone in a nursing home. The mother who gave everything discovers her calls go unanswered. Shankara is not saying family is worthless — he is saying: build bonds of love, not just dependency. If the only thread connecting you to people is money, that thread will snap when the money stops."
  },
  {
    num: 6,
    sanskrit: "यावत्पवनो निवसति देहे\nतावत्पृच्छति कुशलं गेहे ।\nगतवति वायौ देहापाये\nभार्या बिभ्यति तस्मिन्काये ॥ ६ ॥",
    transliteration: "yāvatpavano nivasati dehe\ntāvatpṛcchati kuśalaṃ gehe |\ngatavati vāyau dehāpāye\nbhāryā bibhyati tasminkāye || 6 ||",
    translation: "As long as breath remains in the body, people at home inquire about your welfare. But once the life-breath departs, even the spouse fears that very same body.",
    realLife: "This is perhaps Shankara's most psychologically devastating observation. The same body that was embraced in love becomes an object of fear the moment life leaves it. Families rush to cremate within hours. The person who was 'everything' becomes 'the body.' Shankara uses this stark image not to create morbid fear but to jolt us awake: if even your closest ones relate to your body only when it breathes, then your true identity must be something beyond the body. Invest in discovering that deathless Self — it is the only relationship that never abandons you."
  },
  {
    num: 7,
    sanskrit: "बालस्तावत्क्रीडासक्तः\nतरुणस्तावत्तरुणीसक्तः ।\nवृद्धस्तावच्चिन्तासक्तः\nपरे ब्रह्मणि कोऽपि न सक्तः ॥ ७ ॥",
    transliteration: "bālastāvatkrīḍāsaktaḥ\ntaruṇastāvattaruṇīsaktaḥ |\nvṛddhastāvaccintāsaktaḥ\npare brahmaṇi ko'pi na saktaḥ || 7 ||",
    translation: "The child is absorbed in play, the youth is absorbed in the beloved, the old person is absorbed in worries — but alas, no one is absorbed in the Supreme Brahman.",
    realLife: "Shankara maps the entire human life in four lines and exposes its tragic irony. Childhood: 'I will seek God when I grow up.' Youth: 'I will seek God after I settle down.' Old age: 'I should have sought God — but now I am too worried about my health and children.' Death: game over, seek again next life. Every age has its own perfect excuse. The child says play is more important, the young say love is more important, the old say worry is unavoidable. Shankara says: there is no perfect time. The one who waits for the right moment to seek truth will die waiting. Start now, whatever your age."
  },
  {
    num: 8,
    sanskrit: "का ते कान्ता कस्ते पुत्रः\nसंसारोऽयमतीव विचित्रः ।\nकस्य त्वं कः कुत आयातः\nतत्त्वं चिन्तय तदिह भ्रातः ॥ ८ ॥",
    transliteration: "kā te kāntā kaste putraḥ\nsaṃsāro'yamatīva vicitraḥ |\nkasya tvaṃ kaḥ kuta āyātaḥ\ntattvaṃ cintaya tadiha bhrātaḥ || 8 ||",
    translation: "Who is your wife? Who is your son? This worldly life is exceedingly strange. Whose are you? Who are you? Where have you come from? O brother, reflect on this truth here and now.",
    realLife: "Shankara poses the questions that every human avoids at all costs. We build elaborate identities — 'I am a father, a CEO, a citizen of this country' — but none of these existed before birth and none will survive after death. In a world of social media profiles and personal branding, Shankara asks the only question that matters: who are you when every label is stripped away? This is not nihilism — it is the beginning of authentic self-inquiry. The relationships are real, but they are roles in a play. The actor must eventually ask: who am I behind all these masks?"
  },
  {
    num: 9,
    sanskrit: "सत्सङ्गत्वे निस्सङ्गत्वं\nनिस्सङ्गत्वे निर्मोहत्वम् ।\nनिर्मोहत्वे निश्चलतत्त्वं\nनिश्चलतत्त्वे जीवन्मुक्तिः ॥ ९ ॥",
    transliteration: "satsaṅgatve nissaṅgatvaṃ\nnissaṅgatve nirmohatvam |\nnirmohatve niścalatattvaṃ\nniścalatattve jīvanmuktiḥ || 9 ||",
    translation: "From the company of the wise comes non-attachment. From non-attachment comes freedom from delusion. From freedom from delusion comes steadiness in Truth. From steadiness in Truth comes liberation while still alive.",
    realLife: "This is Shankara's most precise roadmap to freedom — a four-step chain reaction. It begins with something startlingly simple: the people you spend time with. Sit with the wise and you naturally stop clinging. Stop clinging and the fog of delusion lifts. See clearly and your mind becomes still. A still mind recognizes its own infinite nature — and that is liberation, not after death, but right now, in this life. In modern terms: your environment shapes your consciousness. The podcasts you listen to, the friends you keep, the books you read — these are your satsang. Choose them as carefully as you would choose medicine, because that is exactly what they are."
  },
  {
    num: 10,
    sanskrit: "वयसि गते कः कामविकारः\nशुष्के नीरे कः कासारः ।\nक्षीणे वित्ते कः परिवारः\nज्ञाते तत्त्वे कः संसारः ॥ १० ॥",
    transliteration: "vayasi gate kaḥ kāmavikāraḥ\nśuṣke nīre kaḥ kāsāraḥ |\nkṣīṇe vitte kaḥ parivāraḥ\njñāte tattve kaḥ saṃsāraḥ || 10 ||",
    translation: "When youth has passed, where is lust? When water has dried up, where is the lake? When wealth is depleted, where is the family? When Truth is known, where is the cycle of birth and death?",
    realLife: "Four devastating parallels. Shankara uses the logic of disappearance to wake us up. Lust without youth is like searching for a lake in a desert — the very foundation has vanished. Family without wealth often evaporates just as completely. But the fourth line is the key: just as lust needs youth and a lake needs water, suffering needs ignorance. Remove ignorance through self-knowledge, and the entire cycle of suffering (samsara) simply ceases to exist — not because it was destroyed, but because it was never real in the first place, like the water in a mirage."
  },
  {
    num: 11,
    sanskrit: "मा कुरु धनजनयौवनगर्वं\nहरति निमेषात्कालः सर्वम् ।\nमायामयमिदमखिलं हित्वा\nब्रह्मपदं त्वं प्रविश विदित्वा ॥ ११ ॥",
    transliteration: "mā kuru dhanajanayauvanagarvam\nharati nimeṣātkālaḥ sarvam |\nmāyāmayamidamakhilaṃ hitvā\nbrahmapadaṃ tvaṃ praviśa viditvā || 11 ||",
    translation: "Do not take pride in wealth, people, or youth. Time destroys all of these in the blink of an eye. Knowing this entire world to be an illusion born of Maya, enter the state of Brahman.",
    realLife: "Shankara watched kings become beggars and empires turn to dust. Pride in wealth is foolish because markets crash. Pride in followers is foolish because popularity is fickle. Pride in youth is foolish because every mirror eventually becomes your enemy. 'In the blink of an eye' — this is not poetic exaggeration. Ask anyone over sixty and they will tell you: life felt like it lasted fifteen minutes. Shankara's solution is not despair but transcendence. See through the illusion, and what remains is not nothing — it is Brahman, the infinite, unchanging reality that you always were."
  },
  {
    num: 12,
    sanskrit: "दिनयामिन्यौ सायं प्रातः\nशिशिरवसन्तौ पुनरायातः ।\nकालः क्रीडति गच्छत्यायुः\nतदपि न मुञ्चत्याशावायुः ॥ १२ ॥",
    transliteration: "dinayāminyau sāyaṃ prātaḥ\nśiśiravasantau punarāyātaḥ |\nkālaḥ krīḍati gacchatyāyuḥ\ntadapi na muñcatyāśāvāyuḥ || 12 ||",
    translation: "Day and night, evening and morning, winter and spring come and go repeatedly. Time plays, life ebbs away — yet the storm of desire never ceases.",
    realLife: "Shankara observes the most obvious thing that everyone ignores: time is passing. Seasons cycle, days repeat, years blur together — and through it all, our desires remain as fresh and urgent as ever. The 20-year-old wants a job, the 30-year-old wants a promotion, the 40-year-old wants recognition, the 50-year-old wants security, the 60-year-old wants health — the wanting never stops, only its objects change. Time is a river carrying you toward the ocean of death, and you sit in the boat arguing about which shore has better restaurants. Shankara says: notice the river. Notice that you are moving. That awareness itself is the beginning of awakening."
  },
  {
    num: 13,
    sanskrit: "कथितो वैयाकरणस्यैषः ।\nद्वादशमञ्जरिकाभिरशेषः ।\nउपदेशोऽभूद्विद्वद्भिः ।\nश्रीशङ्करभगवच्चरणैरिह ॥ १३ ॥",
    transliteration: "kathito vaiyākaraṇasyaiṣaḥ |\ndvādaśamañjarikābhiraśeṣaḥ |\nupadeśo'bhūdvidvadbhiḥ |\nśrīśaṅkarabhagavaccaraṇairiha || 13 ||",
    translation: "Thus was the grammarian advised through these twelve verse-bouquets. This teaching was given by the revered feet of the blessed Shankara, the learned one.",
    realLife: "This transitional verse tells the backstory. Shankara, walking along the ghats of Varanasi, heard an elderly pandit mechanically cramming Panini's grammar rules (Dukrin Karane — a grammatical formula). Moved by compassion, not contempt, Shankara spontaneously composed these twelve verses. His disciples, inspired by the master's outpouring, then added their own verses. The message is timeless: learning without wisdom is reciting a map without walking the path. This verse reminds us that the greatest teachings often arise not from planned lectures but from spontaneous compassion — Shankara saw suffering and could not remain silent."
  },
  {
    num: 14,
    sanskrit: "कामं क्रोधं लोभं मोहं\nत्यक्त्वाऽऽत्मानं भावय कोऽहम् ।\nआत्मज्ञानविहीना मूढाः\nते पच्यन्ते नरकनिगूढाः ॥ १४ ॥",
    transliteration: "kāmaṃ krodhaṃ lobhaṃ mohaṃ\ntyaktvā''tmānaṃ bhāvaya ko'ham |\nātmajñānavihīnā mūḍhāḥ\nte pacyante narakanigūḍhāḥ || 14 ||",
    translation: "Giving up lust, anger, greed, and delusion, inquire into your own Self — 'Who am I?' Those fools who are devoid of Self-knowledge are cooked in the hidden hell of their own making.",
    realLife: "Shankara names the four inner enemies: desire, anger, greed, and delusion. Notice he does not say 'suppress' them — he says 'give them up' by replacing them with self-inquiry. The question 'Who am I?' is the most powerful tool in Vedanta. When anger arises, ask: who is angry? When greed grips you, ask: who wants more? The 'hidden hell' is not some afterlife punishment — it is the daily torment of living reactively, enslaved by emotions you never examine. The person who road-rages, hate-scrolls, and stress-eats is already in hell. Self-knowledge is the only exit."
  },
  {
    num: 15,
    sanskrit: "गेयं गीतानामसहस्रं\nध्येयं श्रीपतिरूपमजस्रम् ।\nनेयं सज्जनसङ्गे चित्तं\nदेयं दीनजनाय च वित्तम् ॥ १५ ॥",
    transliteration: "geyaṃ gītānāmasahasraṃ\ndhyeyaṃ śrīpatirūpamajasram |\nneyaṃ sajjanasaṅge cittaṃ\ndeyaṃ dīnajanāya ca vittam || 15 ||",
    translation: "Sing the Bhagavad Gita and the Vishnu Sahasranama. Always meditate on the form of the Lord. Lead your mind toward the company of the good. Give your wealth to the poor and needy.",
    realLife: "After the shock therapy of the earlier verses, Shankara now offers a practical daily prescription. Four actions, four pillars: Sing sacred texts (this engages the voice and heart, not just the intellect). Meditate (still the mind daily). Keep good company (your circle shapes your character). Give generously (wealth shared is wealth purified). This is not abstract philosophy — it is a lifestyle design. In modern terms: start your morning with something sacred instead of doom-scrolling. Choose friends who elevate you. And remember that money sitting idle in your account while someone nearby goes hungry is not wealth — it is hoarding."
  },
  {
    num: 16,
    sanskrit: "सुखतः क्रियते रामाभोगः\nपश्चाद्धन्त शरीरे रोगः ।\nयद्यपि लोके मरणं शरणं\nतदपि न मुञ्चति पापाचरणम् ॥ १६ ॥",
    transliteration: "sukhataḥ kriyate rāmābhogaḥ\npaścāddhanta śarīre rogaḥ |\nyadyapi loke maraṇaṃ śaraṇaṃ\ntadapi na muñcati pāpācaraṇam || 16 ||",
    translation: "One indulges freely in sensual pleasures, but disease ravages the body afterward. Even though death is the certain end for everyone in this world, people still do not give up sinful conduct.",
    realLife: "Shankara observed human behavior with the precision of a scientist. We know smoking kills, yet we smoke. We know excess destroys, yet we overindulge. We know death is certain, yet we live as if immortal. This verse is about the strange disconnect between knowledge and action. Modern psychology calls it 'cognitive dissonance.' Shankara saw it twelve centuries ago. The 'sin' here is not religious guilt — it is any action you know harms you or others but you do anyway because the short-term pleasure outweighs the long-term consequence in your mind. The cure is viveka — discrimination between what feels good now and what is actually good."
  },
  {
    num: 17,
    sanskrit: "रथ्याचर्पटविरचितकन्थः\nपुण्यापुण्यविवर्जितपन्थः ।\nयोगी योगनियोजितचित्तो\nरमते बालोन्मत्तवदेव ॥ १७ ॥",
    transliteration: "rathyācarpaṭaviracitakanthaḥ\npuṇyāpuṇyavivarjitapanthaḥ |\nyogī yoganiyojitacitto\nramate bālonmattavadeva || 17 ||",
    translation: "The yogi who wears a garment made of rags picked from the street, who walks the path beyond merit and sin, whose mind is united through yoga — he rejoices like a child or a madman.",
    realLife: "Shankara paints the portrait of a truly free person — and it looks nothing like what society calls 'successful.' This yogi has no designer clothes (rags from the road), no moral scorekeeping (beyond good and bad), and no anxiety (mind absorbed in the Self). The result? The pure, causeless joy of a child at play or the unselfconscious bliss of someone society calls 'mad.' In a world that equates happiness with achievement, Shankara says the happiest person may be the one who has stopped achieving entirely. True freedom is not getting what you want — it is not needing anything at all."
  },
  {
    num: 18,
    sanskrit: "योगरतो वा भोगरतो वा\nसङ्गरतो वा सङ्गविहीनः ।\nयस्य ब्रह्मणि रमते चित्तं\nनन्दति नन्दति नन्दत्येव ॥ १८ ॥",
    transliteration: "yogarato vā bhogarato vā\nsaṅgarato vā saṅgavihīnaḥ |\nyasya brahmaṇi ramate cittaṃ\nnandati nandati nandatyeva || 18 ||",
    translation: "Whether engaged in yoga or in enjoyment, whether in company or in solitude — the one whose mind revels in Brahman, that person alone rejoices, rejoices, truly rejoices!",
    realLife: "The triple repetition of 'nandati' (rejoices) is Shankara's way of saying: this joy is not ordinary — it is infinite, overflowing, uncontainable. And the beauty of this verse is its radical inclusiveness. You do not need to be a monk. You can be in the world or out of it, among people or alone, working or meditating. The external situation does not matter. What matters is where your mind rests. If your mind is anchored in the awareness of Brahman — the infinite consciousness that you truly are — then every moment becomes celebration. This is Shankara's ultimate promise: joy is not a destination. It is your nature."
  },
  {
    num: 19,
    sanskrit: "भगवद्गीता किञ्चिदधीता\nगङ्गाजललवकणिका पीता ।\nसकृदपि येन मुरारिसमर्चा\nक्रियते तस्य यमेन न चर्चा ॥ १९ ॥",
    transliteration: "bhagavadgītā kiñcidadhītā\ngaṅgājalalavalavakaṇikā pītā |\nsakṛdapi yena murārisamarcā\nkriyate tasya yamena na carcā || 19 ||",
    translation: "For one who has studied even a little of the Bhagavad Gita, who has drunk even a drop of the Ganges water, who has worshipped Lord Krishna even once — Death (Yama) has nothing to discuss with that person.",
    realLife: "Shankara says the entry ticket to spiritual life is astonishingly small: 'even a little,' 'even a drop,' 'even once.' This verse demolishes the excuse that spiritual practice requires years of preparation or renunciation. You do not need to read all eighteen chapters — start with one verse. You do not need a pilgrimage to the Ganges — one sincere prayer at home counts. The Divine does not measure your offering by its size but by its sincerity. In modern life, the person who pauses for thirty seconds of genuine gratitude each morning has done more spiritual work than the one who mechanically performs hours of ritual with a wandering mind."
  },
  {
    num: 20,
    sanskrit: "पुनरपि जननं पुनरपि मरणं\nपुनरपि जननीजठरे शयनम् ।\nइह संसारे बहुदुस्तारे\nकृपयाऽपारे पाहि मुरारे ॥ २० ॥",
    transliteration: "punarapi jananaṃ punarapi maraṇaṃ\npunarapi jananījjaṭhare śayanam |\niha saṃsāre bahudustāre\nkṛpayā'pāre pāhi murāre || 20 ||",
    translation: "Again birth, again death, again lying in a mother's womb — this cycle of worldly existence is extremely difficult to cross. O Lord Krishna, through Your infinite compassion, protect me!",
    realLife: "This is Shankara at his most vulnerable — the supreme Advaita philosopher, who taught that the individual self is identical with Brahman, here cries out to the Lord for help. This is not a contradiction; it is the deepest truth. Even the wisest person, when they honestly confront the enormity of existence — the endless repetition of birth, suffering, and death — feels the need for grace. In real life, this verse speaks to anyone caught in cycles: the cycle of addiction, of toxic relationships, of self-destructive patterns. The first step to breaking any cycle is admitting you cannot do it alone and asking for help — from the Divine, from a teacher, from the truth within."
  },
  {
    num: 21,
    sanskrit: "नाहं नाहं न चासौ नासौ\nअसंसारो नैव संसारः ।\nसर्वं खल्विदं ब्रह्म\nचेतन्यं चेतसि चिन्तय ॥ २१ ॥",
    transliteration: "nāhaṃ nāhaṃ na cāsau nāsau\nasaṃsāro naiva saṃsāraḥ |\nsarvaṃ khalvidaṃ brahma\ncetanyaṃ cetasi cintaya || 21 ||",
    translation: "Not I, not I, nor is this other what it seems. There is no worldly bondage, nor is there truly any world. All this is indeed Brahman. Contemplate this consciousness in your own awareness.",
    realLife: "After twenty verses of diagnosis and prescription, Shankara delivers the ultimate medicine: the Mahavakya truth. There is no separate 'you' to be bound, no separate 'world' to bind you, no separate 'God' to free you. Everything — your joy, your pain, the person you love, the stranger you pass — is Brahman, pure consciousness, wearing costumes. This is the pinnacle of Advaita Vedanta. In practical terms, this verse is the end of all blame, all victimhood, all separation. If everything is one consciousness, then harming another is harming yourself, and loving another is loving yourself. This is not philosophy — it is the most radical basis for compassion ever articulated."
  },
  {
    num: 22,
    sanskrit: "गुरुचरणाम्बुज निर्भरभक्तः\nसंसारादचिराद्भव मुक्तः ।\nसेन्द्रियमानसनियमादेवं\nद्रक्ष्यसि निजहृदयस्थं देवम् ॥ २२ ॥",
    transliteration: "gurucaraṇāmbuja nirbharabhaktaḥ\nsaṃsārādacirādbhava muktaḥ |\nsendriyamānasaniyamādevaṃ\ndrakṣyasi nijahṛdayasthaṃ devam || 22 ||",
    translation: "Be devoted wholeheartedly to the lotus feet of the Guru. You will be freed from the cycle of worldly existence very soon. Through the discipline of the senses and mind, you will see the Lord dwelling in your own heart.",
    realLife: "Shankara, himself the greatest Guru in the Advaita tradition, emphasizes that self-realization rarely happens in isolation. A Guru is not a crutch — a Guru is a mirror. When your own mind is too clouded by ego and desire to see clearly, you need someone who has already crossed the river to show you the ford. The 'discipline of senses and mind' is not punishment — it is training, like an athlete training for peak performance. And the reward is extraordinary: you see God not in some distant heaven but in your own heart. The journey that seems to span lifetimes is actually a journey of inches — from the head to the heart."
  },
  {
    num: 23,
    sanskrit: "मूढः कश्चन वैयाकरणो\nडुकृञ्करणाध्ययनधुरिणः ।\nश्रीमच्छङ्करभगवतः शिष्यै\nबोधित आसीच्छोधितकरणः ॥ २३ ॥",
    transliteration: "mūḍhaḥ kaścana vaiyākaraṇo\nḍukṛñkaraṇādhyayanadhurīṇaḥ |\nśrīmacchaṅkarabhagavataḥ śiṣyai\nbodhita āsīcchodhitakaraṇaḥ || 23 ||",
    translation: "Thus a certain foolish grammarian, who was diligently studying grammatical rules, was awakened and purified by the disciples of the blessed Shankaracharya.",
    realLife: "This closing narrative verse tells us the teaching worked — the old pandit was transformed. But notice: it was the disciples who completed the work, not just Shankara. This beautifully shows how wisdom multiplies — one teacher ignites many torches, and those torches light others. The 'foolish grammarian' is not one person; he is every one of us who has spent years mastering the rules of a game that does not matter while ignoring the game that does. The good news embedded here: even the most rigid, mechanical mind can be cracked open by genuine spiritual teaching. It is never too late."
  },
  {
    num: 24,
    sanskrit: "अर्थमनर्थं भावय नित्यं\nनास्ति ततः सुखलेशः सत्यम् ।\nपुत्रादपि धनभाजां भीतिः\nसर्वत्रैषा विहिता रीतिः ॥ २४ ॥",
    transliteration: "arthamanarthaṃ bhāvaya nityaṃ\nnāsti tataḥ sukhaleśaḥ satyam |\nputrādapi dhanabhājāṃ bhītiḥ\nsarvatraiṣā vihitā rītiḥ || 24 ||",
    translation: "Reflect always that wealth is truly calamity — there is not the least bit of happiness from it. The wealthy fear even their own sons. This is the way everywhere.",
    realLife: "Shankara makes a counterintuitive claim: wealth is not just neutral — it actively creates suffering. The rich fear theft, fraud, betrayal, and yes, even their own children fighting over inheritance. Today's headlines prove him right: family feuds over property, siblings who become strangers over a will, children who wait for parents to die so they can inherit. Shankara is not anti-wealth but anti-attachment-to-wealth. The difference between a tool and a trap is whether you hold it or it holds you. Use money; do not let money use you."
  },
  {
    num: 25,
    sanskrit: "प्राणायामं प्रत्याहारं\nनित्यानित्यविवेकविचारम् ।\nजाप्यसमेतसमाधिविधानं\nकुर्ववधानं महदवधानम् ॥ २५ ॥",
    transliteration: "prāṇāyāmaṃ pratyāhāraṃ\nnityānityavivekavicāram |\njāpyasametasamādhividhānaṃ\nkurvavadhānaṃ mahadavadhānam || 25 ||",
    translation: "Practice breath control, sense withdrawal, discrimination between the eternal and the transient, chanting combined with meditation — do these with great care and attention.",
    realLife: "After all the philosophical thunder, Shankara gets supremely practical. Here is your daily toolkit: Pranayama (breathing exercises — the simplest hack to calm the nervous system, validated by modern neuroscience). Pratyahara (sense withdrawal — the ability to unplug, to not react to every notification and stimulus). Viveka (discrimination — asking of every pursuit: is this permanent or temporary?). Japa with Samadhi (repetition of a sacred name leading to meditation). Notice the word 'avadhana' (attention) repeated. Half-hearted practice is no practice. Five minutes of genuine meditation outweighs five hours of distracted sitting."
  },
  {
    num: 26,
    sanskrit: "कुरुते गङ्गासागरगमनं\nव्रतपरिपालनमथवा दानम् ।\nज्ञानविहीनः सर्वमतेन\nमुक्तिं न भजति जन्मशतेन ॥ २६ ॥",
    transliteration: "kurute gaṅgāsāgaragamanaṃ\nvrataparipālanamathavā dānam |\njñānavihīnaḥ sarvamatena\nmuktim na bhajati janmaśatena || 26 ||",
    translation: "One may go on pilgrimages to where the Ganges meets the sea, observe religious vows, or give away in charity — but without Self-knowledge, according to all schools of thought, one does not attain liberation even in a hundred lifetimes.",
    realLife: "This is Shankara's most controversial verse for religious traditionalists. He says flatly: rituals without understanding are useless. You can walk to every temple, fast on every holy day, donate millions — but if you have not asked 'Who am I?', none of it counts toward liberation. This was revolutionary in 8th-century India and remains provocative today. It challenges the entire industry of religious tourism, performative piety, and mechanical ritual. Shankara is not against these practices — they are mentioned positively in other verses — but he insists they are preparation, not the destination. A thousand trips to the Ganges cannot substitute for one moment of genuine self-inquiry."
  },
  {
    num: 27,
    sanskrit: "सुरमन्दिरतरुमूलनिवासः\nशय्या भूतलमजिनं वासः ।\nसर्वपरिग्रहभोगत्यागः\nकस्य सुखं न करोति विरागः ॥ २७ ॥",
    transliteration: "suramandiratarumūlanivāsaḥ\nśayyā bhūtalamajinaṃ vāsaḥ |\nsarvaparigrahabhogatyāgaḥ\nkasya sukhaṃ na karoti virāgaḥ || 27 ||",
    translation: "Dwelling at the base of a temple or a tree, sleeping on the bare earth, wearing a deerskin, renouncing all possessions and pleasures — to whom does such dispassion not bring happiness?",
    realLife: "Shankara describes the ultimate minimalist — someone who needs nothing and therefore lacks nothing. The modern minimalism movement is a pale echo of what Shankara describes. But the key word is 'viraga' (dispassion), not deprivation. A person forced into poverty suffers. A person who voluntarily simplifies rejoices. The difference is internal freedom. You do not need to live under a tree to apply this teaching. But you can ask: how much of what I own actually adds to my happiness, and how much adds to my anxiety? The person with three outfits and no storage problems may be freer than the one with a walk-in closet and decision fatigue."
  },
  {
    num: 28,
    sanskrit: "सुखतः क्रियते रामाभोगः\nपश्चाद्धन्त शरीरे रोगः ।\nयद्यपि लोके मरणं शरणं\nतदपि न मुञ्चति पापाचरणम् ॥ २८ ॥",
    transliteration: "sukhataḥ kriyate rāmābhogaḥ\npaścāddhanta śarīre rogaḥ |\nyadyapi loke maraṇaṃ śaraṇaṃ\ntadapi na muñcati pāpācaraṇam || 28 ||",
    translation: "One freely indulges in pleasures, but alas, disease soon afflicts the body. Though death is the certain refuge of all in this world, still one does not abandon sinful ways.",
    realLife: "This verse echoes verse 16, and the repetition is deliberate — Shankara knows that humans need to hear uncomfortable truths more than once. We are remarkably skilled at forgetting what we do not want to remember. Every generation discovers the same lesson: excess leads to suffering. The weekend of indulgence becomes Monday's regret. The years of overwork become a body that breaks down. And yet, knowing all this, we continue. Why? Because the mind is addicted to the pattern. Breaking any pattern requires conscious effort, repeated effort. Shankara repeats this verse because that is exactly what we need — repetition of wisdom to counter the repetition of folly."
  },
  {
    num: 29,
    sanskrit: "अङ्गं गलितं पलितं मुण्डं\nदशनविहीनं जातं तुण्डम् ।\nवृद्धो याति गृहीत्वा दण्डं\nतदपि न मुञ्चत्याशापिण्डम् ॥ २९ ॥",
    transliteration: "aṅgaṃ galitaṃ palitaṃ muṇḍaṃ\ndaśanavihīnaṃ jātaṃ tuṇḍam |\nvṛddho yāti gṛhītvā daṇḍaṃ\ntadapi na muñcatyāśāpiṇḍam || 29 ||",
    translation: "The body has become decrepit, the head has gone bald and grey, the mouth has become toothless. The old man walks with a stick — yet the bundle of desires does not leave him.",
    realLife: "This is one of Shankara's most vivid and heartbreaking images. Picture an old man — body failing, teeth gone, needing a walking stick — and inside that crumbling frame, desires burn just as fiercely as they did at twenty. He still wants respect, still wants control, still wants more time. The body has received the memo of mortality, but the mind refuses to read it. In modern geriatric wards, you see this daily: elderly patients fighting over television channels, jealous of visitors other patients receive, anxious about money they will never spend. The lesson: desire does not age. If you do not consciously release it, it will cling to you until your last breath — and possibly beyond."
  },
  {
    num: 30,
    sanskrit: "अग्रे वह्निः पृष्ठे भानुः\nरात्रौ चुबुकसमर्पितजानुः ।\nकरतलभिक्षस्तरुतलवासः\nतदपि न मुञ्चत्याशापाशः ॥ ३० ॥",
    transliteration: "agre vahniḥ pṛṣṭhe bhānuḥ\nrātrau cubukasamarpitajānuḥ |\nkaratalabhikṣastarutoalavāsaḥ\ntadapi na muñcatyāśāpāśaḥ || 30 ||",
    translation: "Warming himself before a fire in front, with the sun at his back, sleeping at night with knees drawn to the chin, receiving alms in his hands, living under a tree — even then, the noose of desire does not release him.",
    realLife: "Shankara now shows that even renunciation can be incomplete. Here is a person who has given up everything externally — no home, no possessions, begging for food, sleeping under trees — yet the 'noose of desire' still binds him. This is the most sophisticated teaching in the entire poem: external renunciation without internal transformation is theater. You can shave your head and wear robes and still burn with ambition, jealousy, and craving. Conversely, you can live in a city apartment with a full life and be internally free. Shankara's revolution was always internal, never merely external. The noose is in the mind. Only awareness can cut it."
  },
  {
    num: 31,
    sanskrit: "भज गोविन्दं भज गोविन्दं\nगोविन्दं भज मूढमते ।\nसम्प्राप्ते सन्निहिते काले\nनहि नहि रक्षति डुकृञ्करणे ॥ ३१ ॥",
    transliteration: "bhaja govindaṃ bhaja govindaṃ\ngovindaṃ bhaja mūḍhamate |\nsamprāpte sannihite kāle\nnahi nahi rakṣati ḍukṛñkaraṇe || 31 ||",
    translation: "Worship Govinda, worship Govinda, worship Govinda, O fool! When the appointed time of death arrives, the rules of grammar you have memorized will not save you.",
    realLife: "The poem ends where it began — a perfect circle. This is not repetition for repetition's sake; it is the structure of a mantra. Just as a mala (rosary) returns to its starting bead, Shankara brings us back to the fundamental truth: worship the Divine. After thirty verses of analysis, warning, and wisdom, the conclusion is breathtakingly simple. Not 'understand Govinda' or 'debate about Govinda' or 'write a thesis on Govinda' — but 'bhaja,' worship, surrender, love. All the philosophy, all the discrimination, all the renunciation must culminate in devotion. The mind that has understood everything must finally dissolve into the heart that loves everything. That is liberation."
  }
];
