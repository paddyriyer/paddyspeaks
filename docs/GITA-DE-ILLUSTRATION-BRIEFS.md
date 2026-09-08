# Illustration briefs — "The Bhagavad Gita of Data Engineering"

Article: `articles/bhagavad-gita-of-data-engineering.html`

Eleven visuals ship with the article. **Figs. 1-7 and 9-11 are finished
illustrations** (`images/articles/bhagavad-gita-of-data-engineering/fig-NN.webp`);
Fig. 8 is a rendered interface mock in HTML. The placeholder SVGs these briefs
were originally written for are gone.

**Each illustration has its caption baked into the artwork**, which is why the
figures carry no HTML `<figcaption>` — adding one prints the caption twice. The
caption text lives in the image's `alt` attribute instead, so screen readers
still get it. Keep that arrangement if you replace an image.

Source PNGs (~1.9 MB each) were converted to WebP at quality 82 — 19.3 MB down
to 1.7 MB across the set, with the fine print in the artwork still legible at
1:1. The originals remain in git history at commits `d0726af`, `d8f9f4a` and
`7d4ac8a` if a re-export is ever needed.

The briefs below are also embedded as HTML comments above each figure in the
article source, as the spec any replacement art should satisfy.

**House style.** Sophisticated editorial cartoon — New Yorker line-work crossed
with Indian philosophical imagery and a modern data-engineering workplace.
Landscape wherever possible. Never crowded with text. Palette from
`style.css`: saffron `#E8863A`, gold `#D4A843`, ink `#2A1810`, deep maroon
`#5C1A1A`, teal `#0D7377`, cream `#FFF9F0`.

**The one hard rule.** The satire targets engineers, managers, LinkedIn, AI
hype, certifications and cloud bills. It never targets Krishna, Arjuna, the
Sanskrit verses, or Hindu philosophy. Where Krishna appears (Fig. 9) he is drawn
with dignity — luminous, calm, classically rendered. The comedy lives entirely
on the engineer's side of the chariot.

---

## Fig. 1 — Two battlefields
**Section:** The battlefield / opening
**VISUAL:** Split landscape panel. LEFT: Arjuna on his chariot at dusk, bow lowered, facing a distant forest of spears and banners. RIGHT: a data engineer seen from behind at a six-monitor desk — same posture, same slump, same lowered hands.
**HUMOR:** The pose is identical. Only the resolution has improved.
**CAPTION:** "Different battlefield. Same trembling hand."
**DETAILS:** Monitor 6 congratulates Rajas Rao on certification no. 14; a sticky note reading "TODO: fix — 2017"; a mug labelled NULL; the chariot flag and the browser tab bar rhyme.

## Fig. 2 — Museum of technologies that were going to last forever
**Section:** You are not your tools
**VISUAL:** A quiet museum gallery. Four lit plinths behind a velvet rope, each holding a relic: a small Hadoop elephant, a MapReduce book, an Informatica install CD, an Oracle admin manual. A greying engineer stands at the rope, hands behind back, whispering to no one.
**HUMOR:** The reverence of the setting versus the banality of the objects. He isn't mourning the technology — he's mourning his certifications.
**CAPTION:** "I was certified in all of them."
**DETAILS:** Placard reads EST. FOREVER; a sign says PLEASE DO NOT TOUCH THE CLUSTER; a fifth plinth stands empty, labelled RESERVED — 2029; a wall plaque solicits donations to the DBA Hardship Fund.

## Fig. 3 — The three Gunas, in one open-plan office
**Section:** The three Gunas of a tech career
**VISUAL:** Three-panel strip. Left: Tamas Tambi reclined, arms folded, in front of a CRT running a shell script older than the intern. Middle: Rajas Rao mid-panic, hair vertical, 73 browser tabs rendered as a comb of tiny rectangles. Right: Sattva Subramaniam, calm, one notebook, filter coffee, three questions on a small whiteboard.
**HUMOR:** The energy gradient across the panels — and the fact that only the calm one has finished anything.
**CAPTION:** "Three responses. One outage. Guess who gets paged."
**DETAILS:** Wall calendar stuck on 2014; cable tagged DO NOT UNPLUG; a badge wall with 14 rosettes; a clock reading 02:14; "commits: 0"; a davara-tumbler of filter coffee; exactly one browser tab.

## Fig. 4 — You never controlled Tuesday
**Section:** Nishkama Karma
**VISUAL:** An engineer stands proudly holding up a small, beautiful architecture diagram — clean boxes, tidy arrows, genuine craft. Falling out of the sky towards them: five labelled weights reading REORG, ACQUISITION, BUDGET CUT, NEW CTO, AI STRATEGY.
**HUMOR:** The diagram is genuinely excellent, which is the joke. Excellence was never the variable.
**CAPTION:** "You controlled the architecture. You never controlled Tuesday."
**DETAILS:** The diagram is labelled "v1 (final)"; one box says SINGLE SOURCE OF TRUTH; a falling weight is tagged Q4; a bird carries on regardless.

## Fig. 5 — The AI customer intelligence platform
**Section:** Let AI handle the Karma
**VISUAL:** A boardroom. On the big screen, an impressive and entirely meaningless architecture diagram titled AI CUSTOMER INTELLIGENCE PLATFORM. An executive presents with total conviction. One engineer has raised a hand. Everyone else is looking at the engineer with mild alarm.
**HUMOR:** The slide is beautiful and the room has no idea what it means. The hand goes up anyway.
**CAPTION:** "Meeting rescheduled."
**DETAILS:** Slide footer reads "Slide 47 of 3"; a laptop shows CSV_FINAL_FINAL_v7.csv; a whiteboard still says SYNERGY from a previous era; wall clock at 16:58 on a Friday; one chair empty since March.

## Fig. 6 — Do not turn off
**Section:** The architect outlives the builder
**VISUAL:** An enormous, gleaming cloud architecture fills the frame — multi-region, event mesh, lakehouse, feature store, AI gateway. Every cable from all of it funnels downward and terminates in one small beige tower PC sitting on the floor under a desk.
**HUMOR:** Scale. Millions of dollars of modern platform, one power switch, one piece of tape.
**CAPTION:** "Every modern platform rests on one thing nobody will touch."
**DETAILS:** Sticky note DO NOT TURN OFF — Bob, 2009; a JIRA tag DATA-1174 · opened 2019 · priority: low; the plug is taped down and labelled "temporary"; a monthly bill of $83,421.

## Fig. 7 — Same headline, different nervous system
**Section:** Sthitaprajña
**VISUAL:** Two panels, identical headline visible in both. LEFT, 02:14: Engineer A surrounded by windows — résumé, six courses in a cart, a new LinkedIn headline, a 47-part thread, four mugs. RIGHT, 07:30: Engineer B with one filter coffee and one notepad reading "what actually changed?"
**HUMOR:** Same input, wildly different output. Panel B has visibly slept.
**CAPTION:** "Same headline. Different nervous system."
**DETAILS:** Cart total $1,340; "Thread 1/47"; left clock 02:14, right clock 07:30; the right-hand notepad has three lines, the last being "test it Thursday"; an unread badge showing 47.

## Fig. 8 — The post *(rendered as an HTML interface mock, not a drawing — no image file)*
**Section:** A short reading from the LinkedIn Gita
**VISUAL:** A pixel-accurate but slightly-too-earnest social post card. The achievement is enormous, the course was 47 minutes, and the engagement bar is where the joke lands.
**HUMOR:** Everything about it is real except the accomplishment.
**CAPTION:** "Credential is not capability."
**DETAILS:** "47-minute course"; the hashtag stack; "1,204 reactions · 3 comments · 47 reposts · 0 deployments"; the job title contains the word "Transformation".

## Fig. 9 — Data engineering Kurukshetra *(full-width centrepiece)*
**Section:** The data engineering Kurukshetra
**VISUAL:** Two armies drawn up across a dusk battlefield. LEFT, the old world: ETL, stored procedures, Hadoop, manual SQL, batch jobs, dashboards. RIGHT, the new: copilots, agents, generated SQL, semantic layers, autonomous DAGs, AI observability. Between them, a chariot. Arjuna is a data engineer holding a keyboard overhead instead of the Gandiva. Krishna holds the reins, serene.
**HUMOR:** Arjuna's question — the wrong question, asked with total sincerity, at the worst possible moment. Krishna's reply is the entire article in seven words.
**NOTE TO ILLUSTRATOR:** Krishna is drawn with dignity — luminous, calm, classically rendered, peacock feather at the crown. The comedy is entirely on the engineer's side of the chariot.
**CAPTION:** "Two armies. One wrong question."
**DETAILS:** A fallen banner in the dust reading MDM (2016); another reading REAL-TIME (by Thursday); a crow on the standard; a field marker reading SELECT *.

## Fig. 10 — 2:57 a.m.
**Section:** The 3 a.m. production Gita
**VISUAL:** A dark room lit only by a laptop. On screen, an Airflow-style DAG grid, almost entirely red. A phone face-up, glowing with an alert. An engineer, rim-lit, absolutely still. A cat sits on the desk, unbothered, looking directly at the viewer.
**HUMOR:** The cat. The cat has seen this before and has made peace with it.
**CAPTION:** "The pipeline breaks. The question is what breaks next."
**DETAILS:** Clock reads 02:57; a task named the_one_that_always_fails; a mug labelled NULL; a sticky note reading "it worked yesterday"; retry 3 of 3; one green square, mocking.

## Fig. 11 — Pick up your bow
**Section:** After the teaching, Arjuna fought
**VISUAL:** Dawn. A desk by a window, warm low light. An engineer sits down and opens the laptop — calm, unhurried, first light on their shoulders. Leaning against the desk, entirely unremarked: a longbow.
**HUMOR:** Dry and quiet. The bow is not explained. Also, the first message of the day has already arrived and it is about a schema.
**CAPTION:** "Open the IDE. Open the AI assistant too. Then decide."
**DETAILS:** A Slack notification reading "quick one — changed a column type 👍"; an open file named assumptions.md; a filter coffee just poured; a green DAG grid on the second monitor; the DO NOT TURN OFF sticky note still on the wall.
