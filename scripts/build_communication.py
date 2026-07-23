#!/usr/bin/env python3
"""
Build the Workplace English & Communication track data file.

Curated content lives in this script (the single source of truth); running it
emits interview.app/evaluate/data/communication.json in the same schema the
Skill Check quiz-engine, Flashcards and the Communication track page consume.

Re-runnable and deterministic. Edit the CONTENT list, then:

    python3 scripts/build_communication.py

Question schema (superset of the base quiz schema — extra fields are optional
and ignored by older renderers):

    id, type(single|multi|open), topic(module), difficulty(easy|medium|hard),
    level(Beginner|Intermediate|Advanced), role, format(mc|rewrite|scenario|speaking),
    prompt,
    # single/multi:  options, answer, explanation
    # open:          model_answer, key_points, explanation
    # optional rich fields surfaced in review:
    why_confusing, stronger_alternative, say_it_naturally
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "interview.app" / "evaluate" / "data" / "communication.json"

# Module list (the 12 learning modules) — order defines display order.
MODULES = [
    "Common Grammar and Usage",
    "Interview Communication",
    "Workplace Conversations",
    "Email and Chat Writing",
    "Stand-up and Status Updates",
    "Explaining Technical Concepts",
    "Giving and Receiving Feedback",
    "Conflict Resolution",
    "Incident and Escalation Communication",
    "Cross-Cultural Communication",
    "Executive Communication",
    "Listening, Clarifying, and Confirming Understanding",
]

LEVEL_TO_DIFF = {"Beginner": "easy", "Intermediate": "medium", "Advanced": "hard"}

# ─────────────────────────────────────────────────────────────────────────────
# CONTENT.  Each dict is one exercise. `difficulty` is derived from `level`.
# Keep it practical, dignified, and free of accent/dialect ridicule.
# ─────────────────────────────────────────────────────────────────────────────
C = []  # accumulator


def q(**kw):
    C.append(kw)


# ── Module 1 · Common Grammar and Usage ─────────────────────────────────────
q(topic="Common Grammar and Usage", type="single", level="Beginner", role="Candidate",
  format="mc",
  prompt="A teammate messages you at 9am: which sentence is the clearest professional English?",
  options=[
      "I couldn't finish the report yesterday's night.",
      "I couldn't finish the report last night.",
      "I couldn't finish the report yesterday night time.",
      "I couldn't finished the report last night.",
  ], answer=1,
  explanation="“Last night” is the standard phrase for the previous evening. “Yesterday's night” is a common non-native construction that reads as unusual to a global audience, and option 4 mixes “couldn't” with the past-tense “finished” (after a modal, use the base verb “finish”).",
  why_confusing="“Yesterday's night” forces the reader to pause and re-map it to “last night”; the possessive is not idiomatic.",
  stronger_alternative="“I couldn't finish the report last night — I'll have it to you by 11am.”")

q(topic="Common Grammar and Usage", type="single", level="Beginner", role="Individual Contributor",
  format="mc",
  prompt="Pick the sentence that a hiring manager would read as natural, confident English.",
  options=[
      "I am having five years of experience in data engineering.",
      "I have five years of experience in data engineering.",
      "I am having five years experience in data engineering.",
      "I have since five years experience in data engineering.",
  ], answer=1,
  explanation="Possession of experience is a state, not an ongoing action, so use the simple present “I have”, not the continuous “I am having”. Continuous “having” suggests an activity in progress (as in “having lunch”).",
  why_confusing="“I am having … experience” applies the continuous tense to a stative verb, which sounds off to native and fluent speakers alike.",
  stronger_alternative="“I have five years of experience in data engineering, mostly on streaming pipelines.”")

q(topic="Common Grammar and Usage", type="single", level="Beginner", role="Individual Contributor",
  format="mc",
  prompt="Your manager asks for a follow-up. Which reply is standard business English?",
  options=[
      "Please revert back to me by EOD.",
      "Please revert to me by EOD.",
      "Please reply to me by end of day.",
      "Kindly do the needful and revert.",
  ], answer=2,
  explanation="“Revert” in international business English is widely misused to mean “reply”; to most readers “revert” means “return to a previous state”. “Reply” is unambiguous. “Do the needful” is vague — always name the specific action.",
  why_confusing="“Revert back” is doubly redundant, and “revert” for “reply” confuses readers outside the regions where that usage spread.",
  stronger_alternative="“Please reply by end of day (5pm PT) so I can lock the plan.”")

q(topic="Common Grammar and Usage", type="single", level="Intermediate", role="Individual Contributor",
  format="mc",
  prompt="Which sentence uses the verb correctly?",
  options=[
      "We discussed about the migration plan in standup.",
      "We discussed the migration plan in standup.",
      "We discussed on the migration plan in standup.",
      "We did discuss about the migration plan in standup.",
  ], answer=1,
  explanation="“Discuss” is transitive — it takes a direct object with no preposition. “Discuss the plan”, never “discuss about the plan”. (You *talk about* something, but you *discuss* something.)",
  why_confusing="Adding “about” after “discuss” is a very common carry-over from “talk about”, and it flags the sentence as non-standard.",
  stronger_alternative="“We discussed the migration plan in standup and agreed to cut over on Friday.”")

q(topic="Common Grammar and Usage", type="single", level="Beginner", role="Individual Contributor",
  format="mc",
  prompt="Identify the grammatically correct sentence.",
  options=[
      "I didn't received the invite.",
      "I didn't receive the invite.",
      "I did not received the invite.",
      "I don't received the invite.",
  ], answer=1,
  explanation="After the auxiliary “did/didn't”, the main verb stays in its base form: “didn't receive”, not “didn't received”. The past tense is already carried by “did”.",
  why_confusing="Doubling the past tense (“didn't received”) is a frequent error that a careful reader notices immediately.",
  stronger_alternative="“I didn't receive the calendar invite — could you resend it?”")

q(topic="Common Grammar and Usage", type="single", level="Intermediate", role="Manager",
  format="mc",
  prompt="A status note says a colleague is unavailable. Which phrasing travels best to a global team?",
  options=[
      "He is out of station until Monday.",
      "He is out of town until Monday.",
      "He is on tour until Monday.",
      "He is having leave until Monday.",
  ], answer=1,
  explanation="“Out of station” is understood only in some regions; “out of town” or “out of office (OOO)” is universally clear. Prefer the phrase your whole audience will parse without effort.",
  why_confusing="“Out of station” is opaque to readers unfamiliar with the idiom and can read as a railway term.",
  stronger_alternative="“He's out of office until Monday; I'm covering his reviews in the meantime.”")

q(topic="Common Grammar and Usage", type="multi", level="Intermediate", role="Individual Contributor",
  format="mc",
  prompt="Select every sentence below that is standard, clear professional English. (Choose all that apply.)",
  options=[
      "Kindly do the needful at the earliest.",
      "Please deploy the hotfix and confirm here once it's live.",
      "I have a doubt about the schema.",
      "I have a question about the schema.",
      "Let's prepone the review to 2pm.",
      "Let's move the review earlier, to 2pm.",
  ], answer=[1, 3, 5],
  explanation="Clear options name a specific action and use widely-understood words. “Do the needful at the earliest” is vague on both what and when. “I have a doubt” is regional for “I have a question” (a doubt implies distrust in global English). “Prepone” is not standard outside South Asia — say “move earlier”.",
  why_confusing="“Doubt”, “prepone”, and “do the needful” are all understood locally but read as errors or ambiguity to an international audience.",
  stronger_alternative="Name the action + the deadline: “Please deploy the hotfix and confirm here by 3pm.”")

q(topic="Common Grammar and Usage", type="single", level="Advanced", role="Technical Leader",
  format="mc",
  prompt="Which sentence is both correct and the most precise?",
  options=[
      "The pipeline is running since two hours.",
      "The pipeline is running from two hours.",
      "The pipeline has been running for two hours.",
      "The pipeline runs since two hours.",
  ], answer=2,
  explanation="Duration up to now uses the present perfect continuous with “for”: “has been running for two hours”. “Since” marks a start point (“since 9am”), not a duration; “running since two hours” mixes the two.",
  why_confusing="“Since two hours” conflates a duration (“for two hours”) with a start time (“since 9am”), a very common preposition slip.",
  stronger_alternative="“The pipeline has been running for two hours — about 40 minutes longer than the usual run.”")

q(topic="Common Grammar and Usage", type="open", level="Intermediate", role="Individual Contributor",
  format="rewrite",
  prompt="Rewrite this message in clear, standard professional English:\n\n“Hi, kindly revert back on the below query. I have a doubt regarding yesterday's night deployment, it seems the same is failing. Please do the needful.”",
  model_answer="Hi — could you reply on the question below? I think last night's deployment is failing, and I'd like your help figuring out why. Specifically, the 2am run of the orders pipeline errored on the load step (log link). Can you take a look this morning?",
  key_points=[
      "Replaces “revert back” with “reply”",
      "Replaces “doubt” with “question”",
      "“yesterday's night” → “last night”",
      "Removes vague “do the needful”; names the specific action and what's failing",
      "Adds a concrete artifact (which run, which step, a log link)",
  ],
  explanation="The rewrite swaps regional idioms for globally clear words and, crucially, replaces the vague “do the needful” with a specific, actionable request plus evidence.",
  why_confusing="The original stacks four ambiguities (revert/doubt/yesterday's night/needful) and never says what is actually broken.",
  say_it_naturally="“Quick one — last night's deployment looks like it's failing. Could you take a look this morning? Log's here.”")

# ── Module 2 · Interview Communication ──────────────────────────────────────
q(topic="Interview Communication", type="single", level="Beginner", role="Candidate",
  format="mc",
  prompt="An interviewer asks, “Tell me about yourself.” Which opening is strongest?",
  options=[
      "I was born in 1994 and did my schooling before joining college for engineering…",
      "I'm a data engineer with five years building batch and streaming pipelines; most recently I cut our warehouse costs 30% by re-partitioning our largest tables. I'm here because I want to work on higher-scale streaming.",
      "I am having good experience in many technologies like SQL, Python, Spark, Kafka, Airflow, dbt, and others.",
      "Basically I'm just looking for any good opportunity where I can grow.",
  ], answer=1,
  explanation="A strong answer is a 30–45 second arc: who you are professionally, one concrete proof point with a number, and why you're in this room. It's tailored, specific, and forward-looking — not a chronology and not a tool dump.",
  why_confusing="The chronological and tool-list openings make the interviewer do the work of finding what matters; a vague “any opportunity” signals no direction.",
  stronger_alternative="Lead with role + a quantified win + why-this-team, in three sentences.")

q(topic="Interview Communication", type="single", level="Intermediate", role="Candidate",
  format="scenario",
  prompt="You don't know the answer to a technical question. What's the best response?",
  options=[
      "Stay silent and hope they move on.",
      "Guess confidently and hope it's right.",
      "Say “I'm not certain, but here's how I'd reason about it…” then think aloud and state what you'd verify.",
      "Say “I don't know” and stop.",
  ], answer=2,
  explanation="Interviewers assess reasoning, not just recall. Naming your uncertainty honestly, then reasoning out loud toward a plausible answer and stating how you'd confirm it, shows exactly the judgment they're hiring for. Bluffing and shutting down both score poorly.",
  why_confusing=None,
  stronger_alternative="“I'm not 100% sure of the exact function, but the approach would be a window function partitioned by user — I'd verify the syntax in the docs.”")

q(topic="Interview Communication", type="single", level="Intermediate", role="Candidate",
  format="mc",
  prompt="Which answer to “What's your biggest weakness?” lands best?",
  options=[
      "I'm a perfectionist and I work too hard.",
      "I don't really have one that affects my work.",
      "Early on I under-communicated when tasks slipped. I now send a short status update the moment a date is at risk, and my last two projects had no surprise delays.",
      "I'm bad at coding under pressure, honestly.",
  ], answer=2,
  explanation="The strong answer names a real, non-fatal weakness, then shows the concrete system you built to manage it and evidence it worked. The clichés (“perfectionist”, “no weakness”) read as evasive; a fatal, unmanaged weakness reads as a risk.",
  why_confusing=None,
  stronger_alternative="Real weakness + the mechanism you added + proof it's improving.")

q(topic="Interview Communication", type="open", level="Advanced", role="Candidate",
  format="speaking",
  prompt="Speaking practice (aim for ~60 seconds): Answer “Walk me through a project you're proud of.” Use the shape: context → your specific role → the hard decision → the measurable result. Type or record your answer, then self-rate against the model.",
  model_answer="Context: our nightly revenue pipeline was breaching its SLA two mornings a week, which delayed the finance dashboard. My role: I owned the pipeline end to end. The hard decision: the obvious fix was a bigger warehouse, but I profiled the DAG and found 70% of the runtime was one un-partitioned join. I pushed back on just scaling up and instead re-partitioned the fact table by date and added an incremental model in dbt. Result: run time dropped from 90 to 25 minutes, we've hit the SLA every day for four months, and we avoided a $4k/month warehouse upgrade. What I'd do differently: I'd have added the SLA alert before the incident, not after.",
  key_points=[
      "Clear context that establishes stakes (SLA, finance dependency)",
      "States YOUR specific contribution, not just the team's",
      "Highlights a decision/tradeoff, not just tasks",
      "Quantified result (90→25 min, 4 months, $4k saved)",
      "Delivered in ~60 seconds; ends with a reflection",
  ],
  explanation="Great project answers are structured (context→role→decision→result), foreground a tradeoff you navigated, and land a number. Aim for 60–90 seconds — long enough to show depth, short enough to invite follow-ups.",
  say_it_naturally="Tell it like a story with one clear turning point and one number the interviewer will remember.")

q(topic="Interview Communication", type="single", level="Intermediate", role="Candidate",
  format="scenario",
  prompt="The interviewer challenges your design: “Wouldn't that fall over at 10x traffic?” Best move?",
  options=[
      "Defend your original answer firmly; changing it looks weak.",
      "Immediately abandon your design and agree with them.",
      "Say “Good push — let me pressure-test it,” identify the real bottleneck at 10x, and adjust the design out loud.",
      "Ask them what they would do instead.",
  ], answer=2,
  explanation="A challenge is usually a probe for how you handle new constraints, not a verdict. The best candidates treat it as a signal, locate the actual failure point at the new scale, and revise transparently — showing flexibility and depth without either stubbornness or collapse.",
  why_confusing=None,
  stronger_alternative="“At 10x, the single writer becomes the bottleneck — I'd shard by tenant and add a queue. Let me redraw it.”")

q(topic="Interview Communication", type="single", level="Beginner", role="Candidate",
  format="mc",
  prompt="At the end, the interviewer asks, “Do you have any questions for me?” Which is the strongest choice?",
  options=[
      "No, I think you covered everything.",
      "What does the team consider a successful first 90 days for this role, and where do people usually struggle?",
      "What's the salary and how much vacation do I get?",
      "How soon can I get promoted?",
  ], answer=1,
  explanation="A thoughtful question about success criteria and common failure modes signals seriousness and helps you evaluate the role. “No questions” reads as low interest; leading with comp/promotion before an offer reads as misaligned priorities.",
  why_confusing=None,
  stronger_alternative="Ask about success in the role, team challenges, or how decisions get made.")

q(topic="Interview Communication", type="single", level="Advanced", role="Candidate",
  format="mc",
  prompt="Compare three answers to “Why do you want to leave your current job?” Which is best?",
  options=[
      "My manager is terrible and the company is a mess.",
      "I've learned a lot, but I've outgrown the scope — I want to work on higher-scale systems, which is exactly what this role offers.",
      "Honestly, mostly the money.",
      "I'm bored and need a change.",
  ], answer=1,
  explanation="Frame the move toward what you want, not away from what you hate. Naming the specific growth you're seeking and tying it to this role is credible and positive. Bad-mouthing a current employer makes an interviewer wonder what you'll say about them.",
  why_confusing=None,
  stronger_alternative="“I've grown as much as I can here; I'm looking for larger-scale problems, which this role has.”")

q(topic="Interview Communication", type="open", level="Intermediate", role="Candidate",
  format="rewrite",
  prompt="An interviewer will ask about a gap in your resume. Rewrite this defensive draft into a calm, confident two-sentence answer:\n\n“Um, I had some personal issues and couldn't work, it's kind of a long story and I'd rather not get into it but I promise it won't happen again.”",
  model_answer="I took a planned six-month break in 2023 to care for a family member. I stayed current by completing a data-engineering certification and two open-source contributions, and I'm fully ready to focus now.",
  key_points=[
      "States the gap plainly and briefly, without over-apologizing",
      "Frames it as a deliberate choice, not a failure",
      "Shows what you did to stay sharp",
      "Ends forward-looking and confident; no defensiveness",
  ],
  explanation="Gaps are normal. A short, matter-of-fact statement plus one line on how you stayed engaged closes the topic and moves on. Defensiveness and secrecy invite more probing.",
  say_it_naturally="Say it in two calm sentences and then move the conversation forward yourself.")

# ── Module 3 · Workplace Conversations ──────────────────────────────────────
q(topic="Workplace Conversations", type="single", level="Beginner", role="Individual Contributor",
  format="scenario",
  prompt="You're swamped and a colleague asks you to take on another task today. Which reply protects the relationship AND your commitments?",
  options=[
      "Fine, I'll do it.” (then miss your own deadline)",
      "No, I'm busy.",
      "I can't take it on today without dropping the billing fix, which is due at 5. If this is higher priority, I'll switch — otherwise I can start it tomorrow morning. Which do you prefer?",
      "Why is this always my job?",
  ], answer=2,
  explanation="A clear “yes-if / no-because” makes your constraints and the tradeoff visible and hands the prioritization decision back to the asker. A resentful yes leads to a missed commitment; a flat no or a jab damages trust.",
  why_confusing=None,
  stronger_alternative="Offer the tradeoff explicitly: “I can do X or Y today, not both — which matters more?”")

q(topic="Workplace Conversations", type="single", level="Intermediate", role="Individual Contributor",
  format="scenario",
  prompt="A senior engineer explained something and you didn't fully follow. Best response?",
  options=[
      "Nod and figure it out later on your own.",
      "Say “Got it, thanks!” to avoid looking slow.",
      "Say “Let me make sure I've got it — you're saying we cache at the edge, not the app layer, because of the write pattern? Have I understood that right?”",
      "Ask them to start over from the beginning.",
  ], answer=2,
  explanation="Playing back your understanding in your own words is the fastest, most professional way to close a comprehension gap. It confirms what you got, surfaces exactly where the gap is, and respects the other person's time far more than either faking it or a full restart.",
  why_confusing=None,
  stronger_alternative="“So to confirm: [your paraphrase]. Is that right?” — a reflective check beats a silent nod.")

q(topic="Workplace Conversations", type="single", level="Intermediate", role="Individual Contributor",
  format="mc",
  prompt="Which way of declining a meeting is most professional?",
  options=[
      "I won't come, too many meetings.",
      "I don't think I need to be in this one — could you share the notes? If a decision needs my input I'm happy to weigh in async or join the relevant 10 minutes.",
      "Ignore the invite.",
      "Maybe, we'll see.",
  ], answer=1,
  explanation="Decline with a reason, an alternative, and a door left open. It respects the organizer, keeps you in the loop where it matters, and models good meeting hygiene. Silence or a curt “no” costs goodwill.",
  why_confusing=None,
  stronger_alternative="Offer async input or a partial join instead of a flat decline.")

q(topic="Workplace Conversations", type="open", level="Advanced", role="Manager",
  format="scenario",
  prompt="A direct report keeps interrupting others in meetings. Write what you'd say in a brief 1:1 to address it constructively (3–5 sentences).",
  model_answer="I want to flag something small because you're doing a lot well and I don't want it to hold you back. In the last two design reviews, I noticed you jumped in a couple of times before Priya and Sam finished their point. Your ideas were good — but a few people have started talking less, and I'd rather have their input than lose it. Could you try leaving a two-second beat after someone stops, and maybe explicitly invite the quieter folks in? I'll back you up on it, and let's check in after next week's review.",
  key_points=[
      "Opens with genuine positive framing and intent",
      "Cites specific, recent, observable behavior — not a character label",
      "Explains the impact on others (people talking less)",
      "Gives a concrete, doable behavior change",
      "Offers support and a follow-up checkpoint",
  ],
  explanation="Effective corrective feedback is specific, behavioral, impact-focused, and paired with a clear next step and support. Avoid labels (“you're domineering”) — describe the behavior and its effect.",
  say_it_naturally="Name the behavior, name the impact, ask for one specific change, and offer to help.")

q(topic="Workplace Conversations", type="single", level="Beginner", role="Individual Contributor",
  format="scenario",
  prompt="You made a mistake that broke a colleague's work. What's the best opening line?",
  options=[
      "It's not really my fault, the docs were unclear.",
      "I think my change may have broken your build — I'm on it now and will have a fix or a rollback in 15 minutes. Sorry for the disruption.",
      "Something's broken, not sure what happened.",
      "Did you change something on your end?",
  ], answer=1,
  explanation="Own it plainly, state what you're doing about it and by when, and apologize briefly. Deflecting blame or vaguing it up erodes trust; a crisp ownership-plus-plan statement builds it, even in a mistake.",
  why_confusing=None,
  stronger_alternative="Ownership + action + ETA + short apology, in one message.")

q(topic="Workplace Conversations", type="single", level="Advanced", role="Individual Contributor",
  format="mc",
  prompt="A coworker takes credit for your idea in a meeting. Which response is most effective in the moment?",
  options=[
      "Say nothing and stew about it.",
      "Publicly accuse them of stealing your idea.",
      "Build on it visibly: “Glad this landed — when I proposed it last week I was worried about the migration cost; here's how I'd handle that…”",
      "Send an angry message afterward.",
  ], answer=2,
  explanation="Reclaim ownership without conflict by extending the idea and referencing your earlier proposal matter-of-factly. It re-establishes authorship, adds value, and keeps the room comfortable. A public accusation makes you look worse than the taker; silence cedes the credit.",
  why_confusing=None,
  stronger_alternative="Add the next layer of the idea and calmly anchor it to when you first raised it.")

# ── Module 4 · Email and Chat Writing ───────────────────────────────────────
q(topic="Email and Chat Writing", type="single", level="Beginner", role="Individual Contributor",
  format="mc",
  prompt="Which subject line will get the fastest correct response?",
  options=[
      "Question",
      "Urgent!!! Please read",
      "Need your approval by Thu 3pm: prod DB migration plan",
      "Following up",
  ], answer=2,
  explanation="A good subject line states the action needed, the deadline, and the topic, so the reader can triage in one glance. Vague subjects (“Question”, “Following up”) and non-specific urgency (“Urgent!!!”) get deprioritized or ignored.",
  why_confusing=None,
  stronger_alternative="[Action + deadline + topic]: “Approve by Thu 3pm: prod DB migration plan”.")

q(topic="Email and Chat Writing", type="open", level="Intermediate", role="Individual Contributor",
  format="rewrite",
  prompt="Rewrite this rambling email into a clear one a busy reader can act on in 20 seconds:\n\n“Hi team, I wanted to reach out because I've been thinking about the reporting thing we talked about a while back and there are some issues that I think might be problems, and I was wondering if maybe we could possibly find some time to discuss it at some point if that works for everyone, thanks.”",
  model_answer="Subject: Decision needed: fix double-counted revenue in the weekly report\n\nHi team — the weekly revenue report is double-counting refunds, so last week's number was ~8% too high.\n\nAsk: 15 minutes this week to agree on the fix. I'm free Wed 10–12 and Thu after 2.\n\nProposed fix (for context): net out refunds in the staging model rather than the dashboard. Details in the thread.\n\nThanks,\n—",
  key_points=[
      "Subject states the decision and topic",
      "Leads with the concrete problem and its impact (8% too high)",
      "One clear ask with proposed times",
      "Offers a proposed solution so the meeting can be a decision, not a discovery",
      "Short — scannable in seconds",
  ],
  explanation="Action-first emails put the ask and the stakes up top, propose specific times, and keep context below the fold. The original buries a real problem under hedging (“thing”, “might be problems”, “at some point”).",
  say_it_naturally="Lead with the problem and the ask; put the backstory underneath.")

q(topic="Email and Chat Writing", type="single", level="Intermediate", role="Individual Contributor",
  format="scenario",
  prompt="It's your third unanswered follow-up to another team. Which chat message is best?",
  options=[
      "You still haven't responded. This is really unprofessional.",
      "Hi — following up on the API access request from Monday (link). We're blocked on it for the launch on Friday. Is there someone better placed to help, or a ticket I should file? Happy to hop on a quick call.",
      "??? ",
      "I guess I'll just escalate to your manager then.",
  ], answer=1,
  explanation="A good nudge restates the specific request, states the impact and deadline, and offers to reduce friction (a call, the right person, the right process). Passive-aggression or threats poison a cross-team relationship you'll need again.",
  why_confusing=None,
  stronger_alternative="Restate the ask + impact + deadline, and offer to make it easier to say yes.")

q(topic="Email and Chat Writing", type="single", level="Beginner", role="Individual Contributor",
  format="mc",
  prompt="Which is the better chat opener for a quick question?",
  options=[
      "Hi” … (then nothing, waiting for a reply before asking)",
      "Hi Sam — quick one: does the `orders` service retry on 5xx, or do we need to handle that in the consumer? Non-urgent, whenever you get a sec.",
      "You there?",
      "I have a doubt, please help urgently.",
  ], answer=1,
  explanation="Ask the actual question in the first message with enough context to answer, and signal urgency honestly. The “Hi”-and-wait pattern (nohello) stalls the conversation; “You there?” and vague urgency waste the responder's attention.",
  why_confusing="A lone “Hi” makes the other person wait and context-switch twice before they even know what you need.",
  stronger_alternative="Greeting + the specific question + real urgency level, all in one message.")

q(topic="Email and Chat Writing", type="single", level="Advanced", role="Manager",
  format="mc",
  prompt="You must deliver disappointing news (a slipped launch) by email to stakeholders. Best structure?",
  options=[
      "Bury the slip in paragraph four after lots of context.",
      "Headline the new date and the reason in the first two lines, then give impact, mitigation, and the recovery plan.",
      "Send a cheerful email that doesn't mention the slip clearly.",
      "Wait until someone asks.",
  ], answer=1,
  explanation="For bad news, lead with the headline (what changed, new date, why) so no one has to hunt for it, then follow with impact, what you're doing about it, and the path back. Burying or softening the news erodes trust and invites rumor.",
  why_confusing=None,
  stronger_alternative="BLUF — Bottom Line Up Front: new date + one-line cause, then the plan.")

# ── Module 5 · Stand-up and Status Updates ──────────────────────────────────
q(topic="Stand-up and Status Updates", type="single", level="Beginner", role="Individual Contributor",
  format="mc",
  prompt="Which stand-up update is most useful to the team?",
  options=[
      "It's almost done.",
      "Still working on the pipeline thing.",
      "Orders pipeline: backfill finished, validation passing. Left: wire the alert (½ day). On track for Thursday. No blockers.",
      "Had a busy day, lots of meetings, will continue tomorrow.",
  ], answer=2,
  explanation="A useful update names the work, states concrete progress and what's left with an estimate, gives a date, and flags blockers. “Almost done”, “the pipeline thing”, and activity logs (“lots of meetings”) tell the team nothing they can act on.",
  why_confusing="“Almost done” has no shared meaning — it could be an hour or a week, and it hides risk.",
  stronger_alternative="“80% done: backfill + validation complete, only the alert wiring left (~½ day), still on track for Thu.”")

q(topic="Stand-up and Status Updates", type="open", level="Intermediate", role="Individual Contributor",
  format="rewrite",
  prompt="Remove the ambiguity from this status update and make it decision-useful:\n\n“Making good progress on the reporting migration, should be done soon, just a couple of small things left, might need some help from the platform team maybe.”",
  model_answer="Reporting migration — ~70% done. Done: schema migrated, 9 of 12 dashboards cut over and verified. Remaining: 3 dashboards (the finance ones) plus a permissions change I need from the platform team. Risk: if platform can't grant access by Wed, Thursday's target slips to Friday. Ask: can someone on platform prioritize ticket PLAT-482 today?",
  key_points=[
      "Replaces “good progress” with a percentage and a done/remaining split",
      "Replaces “soon” with a dated target and the risk to it",
      "Turns “might need help maybe” into a specific ask with a ticket number and owner",
      "Makes the dependency and its deadline explicit",
  ],
  explanation="Ambiguous updates hide risk. A decision-useful update quantifies progress, names what's left, states the dependency and the date it endangers, and makes a concrete ask.",
  say_it_naturally="Say the number, the remaining items, the risk, and exactly what you need from whom by when.")

q(topic="Stand-up and Status Updates", type="single", level="Intermediate", role="Individual Contributor",
  format="scenario",
  prompt="You'll miss a deadline you committed to. When and how do you say so?",
  options=[
      "Say nothing and hope you catch up.",
      "Mention it on the due date.",
      "Flag it the moment you know: “Heads up — the auth work is going to slip to Wed (was Mon) because the SSO vendor is blocking us. Here's my plan to recover; do you want me to cut scope instead?”",
      "Wait for your manager to ask.",
  ], answer=2,
  explanation="Escalate slippage the instant you're confident of it, with the new date, the cause, and options (recover vs. cut scope). Early, honest warning lets others adjust; a surprise on the due date is the failure mode managers hate most.",
  why_confusing=None,
  stronger_alternative="Early warning + new date + cause + a choice for the manager to make.")

q(topic="Stand-up and Status Updates", type="single", level="Advanced", role="Technical Leader",
  format="mc",
  prompt="Which weekly status to leadership best supports decisions?",
  options=[
      "A wall of everything every engineer did this week.",
      "Green/Yellow/Red per workstream, with each Yellow/Red naming the risk, the impact, the decision needed, and by when.",
      "“All good!” with no detail.",
      "Only the problems, with no overall status.",
  ], answer=1,
  explanation="Leaders need signal, not a task log. A RAG (Red/Amber/Green) summary where every non-green item names the risk, the impact, and the specific decision required (with a deadline) turns a status update into a decision aid. Detail dumps and content-free “all good” both fail that test.",
  why_confusing=None,
  stronger_alternative="RAG status + for each risk: impact, decision needed, deadline.")

# ── Module 6 · Explaining Technical Concepts ────────────────────────────────
q(topic="Explaining Technical Concepts", type="single", level="Intermediate", role="Individual Contributor",
  format="scenario",
  prompt="A non-technical product manager asks why the report is slow. Best explanation?",
  options=[
      "The query does a full table scan because there's no covering index on the composite key, so cardinality estimates are off.",
      "The report reads the whole dataset every time instead of using a shortcut, like reading a book cover-to-cover to find one fact. I can add that shortcut (an index) — about a day's work — and it should get 10x faster.",
      "It's a database thing, hard to explain.",
      "Because the DBA didn't tune it.",
  ], answer=1,
  explanation="For a non-technical audience, lead with a plain-language cause, use one apt analogy, and land on the impact and the fix in their terms (time, cost, effort). Jargon (“covering index”, “cardinality”) loses them; “it's complicated” or blame gives them nothing to decide with.",
  why_confusing="Jargon forces the listener to either interrupt or silently disengage; neither helps the decision.",
  stronger_alternative="Plain cause + one analogy + the impact and fix in time/cost terms.")

q(topic="Explaining Technical Concepts", type="open", level="Advanced", role="Technical Leader",
  format="rewrite",
  prompt="Explain what an idempotent API is to a non-technical stakeholder in 2–3 sentences, with a real-world analogy and why they should care.",
  model_answer="An idempotent API is one where doing the same operation twice has the same effect as doing it once — like pressing an elevator button again when it's already lit: nothing extra happens. It matters because networks retry automatically, and without idempotency a retried “charge the customer” request could bill someone twice. Building it in means we can safely retry failed requests, which makes the whole system more reliable for customers.",
  key_points=[
      "Defines idempotency in one plain sentence",
      "Uses a concrete everyday analogy (elevator button / re-submitting a form)",
      "Names the business risk it prevents (double charge)",
      "Connects to why the stakeholder should care (reliability, customer trust)",
  ],
  explanation="Explaining to non-technical stakeholders: define plainly, anchor with one analogy, and always close on the business consequence. Skip the HTTP-method detail unless asked.",
  say_it_naturally="“Same request twice = same result, like a lit elevator button — so we can retry safely and never double-charge.”")

q(topic="Explaining Technical Concepts", type="single", level="Beginner", role="Individual Contributor",
  format="mc",
  prompt="When explaining a technical tradeoff to a mixed audience, what should come first?",
  options=[
      "The deepest implementation detail, to establish credibility.",
      "The decision and its impact in plain terms, then detail on demand for those who want it.",
      "A full history of every option you considered.",
      "An apology for the complexity.",
  ], answer=1,
  explanation="Lead with the conclusion and what it means for the audience, then layer detail progressively so technical folks can go deeper and others can stop at the summary. Starting deep loses most of the room before you reach the point.",
  why_confusing=None,
  stronger_alternative="Answer first, then supporting detail — invert the pyramid.")

# ── Module 7 · Giving and Receiving Feedback ────────────────────────────────
q(topic="Giving and Receiving Feedback", type="single", level="Intermediate", role="Manager",
  format="mc",
  prompt="Which piece of feedback is most likely to change behavior?",
  options=[
      "You need to be more of a team player.",
      "In yesterday's review you rewrote Ana's PR without commenting first; she found out from the merge notification. Next time, could you leave review comments so she can respond before changes go in?",
      "Your attitude has been a problem lately.",
      "People have been saying you're hard to work with.",
  ], answer=1,
  explanation="Actionable feedback is specific, behavioral, and recent, ties to observable impact, and requests a concrete change — the SBI pattern (Situation, Behavior, Impact). Vague labels (“team player”, “attitude”) and anonymous hearsay give the person nothing to act on and put them on the defensive.",
  why_confusing="“Be more of a team player” names no behavior, so the recipient can't tell what to start or stop doing.",
  stronger_alternative="Situation + specific behavior + its impact + the change you're asking for.")

q(topic="Giving and Receiving Feedback", type="single", level="Intermediate", role="Individual Contributor",
  format="scenario",
  prompt="You receive harsh, partly-unfair feedback in a review. Best immediate response?",
  options=[
      "Argue each point right away.",
      "Say “Thanks — I want to make sure I understand. Can you give me a specific example of where that showed up?” Listen, take notes, and ask for time to reflect before responding.",
      "Shut down and say nothing.",
      "Apologize for everything to end the conversation.",
  ], answer=1,
  explanation="Receiving feedback well means seeking specifics and understanding before defending. Asking for concrete examples separates the signal from the delivery, and requesting reflection time prevents a defensive reaction you'll regret. You can address inaccuracies later, calmly and with evidence.",
  why_confusing=None,
  stronger_alternative="“Can you give me a specific example?” + “Let me reflect and follow up.”")

q(topic="Giving and Receiving Feedback", type="open", level="Advanced", role="Manager",
  format="rewrite",
  prompt="Rewrite this feedback so it's specific and behavioral instead of a character judgment:\n\n“You're just not senior enough in how you operate. You need to step up and show more ownership.”",
  model_answer="I want you to grow into the senior role, so here's where I'd focus. Twice this month — the caching bug and the failed deploy — the issue sat unowned until I assigned it. A senior engineer would grab an ambiguous problem, post “I've got this,” and drive it to resolution or escalate. Let's pick the next unowned issue that comes up and have you run it end to end; I'll coach you through it. That's the specific behavior that will get you to the next level.",
  key_points=[
      "Removes the character label (“not senior enough”)",
      "Cites two specific, recent situations",
      "Defines what “ownership” concretely looks like (claim it, drive or escalate)",
      "Gives a concrete next action and offers coaching",
  ],
  explanation="“Show more ownership” is unactionable until you define the observable behavior. Anchor abstract expectations (seniority, ownership, communication) to specific moments and specific actions.",
  say_it_naturally="Turn every abstract trait into “here's the moment, here's the behavior I wanted, here's the next rep.”")

# ── Module 8 · Conflict Resolution ──────────────────────────────────────────
q(topic="Conflict Resolution", type="single", level="Intermediate", role="Individual Contributor",
  format="scenario",
  prompt="Two engineers disagree on an approach and it's getting heated in a thread. As a peer, what's the best intervention?",
  options=[
      "Pick a side publicly and end it.",
      "Refocus on shared goals and decision criteria: “We both want fewer prod incidents. Can we list the 3 criteria that matter — risk, effort, reversibility — and score both options against them?”",
      "Tell them to take it offline and drop it.",
      "Stay out of it entirely.",
  ], answer=1,
  explanation="De-escalate by surfacing the shared goal and converting an opinion clash into a criteria-based comparison. It moves the argument from “who's right” to “what best meets our agreed criteria”, which both people can engage with. Picking a side or shutting it down leaves the disagreement live.",
  why_confusing=None,
  stronger_alternative="Name the shared goal, agree on decision criteria, then evaluate options against them.")

q(topic="Conflict Resolution", type="open", level="Advanced", role="Manager",
  format="rewrite",
  prompt="Convert this aggressive message into an assertive, professional one that still holds the line:\n\n“This is the third time your team has broken our build and it's completely unacceptable. You clearly don't test anything before you ship. Fix your process.”",
  model_answer="Hi — our shared build has broken three times this sprint from changes on your side (links: 1, 2, 3), and it's blocking our releases for a few hours each time. I don't think anyone's being careless — it looks like our integration isn't catching these before merge. Could we spend 30 minutes this week to add a pre-merge check on the shared contract, so neither team gets blocked? I'm happy to do the first pass on it.",
  key_points=[
      "Removes attacks on character/competence (“you clearly don't test”)",
      "States the concrete facts and their impact with evidence",
      "Assumes good intent; frames it as a shared systems gap",
      "Proposes a specific fix and offers to contribute",
      "Firm on the problem, generous with the person",
  ],
  explanation="Assertive ≠ aggressive. Assertive states the facts and impact clearly, protects the relationship by not attacking the person, and drives toward a concrete fix. Aggression may feel satisfying but usually escalates and rarely fixes the process.",
  why_confusing="Accusatory framing (“you clearly don't test anything”) triggers defensiveness and buries the legitimate issue.",
  say_it_naturally="Hard on the problem, soft on the people: facts + impact + “can we fix the process together?”")

q(topic="Conflict Resolution", type="single", level="Beginner", role="Individual Contributor",
  format="mc",
  prompt="Which sentence is assertive (not passive, not aggressive)?",
  options=[
      "I guess it's fine if we do it your way, whatever works.",
      "We're doing it my way, end of discussion.",
      "I see the appeal of your approach; I'm concerned about the migration risk, so I'd like us to weigh both before deciding.",
      "Fine. Do what you want.",
  ], answer=2,
  explanation="Assertive language owns your view and your concern while leaving room for the other person and a joint decision. Option 1 and 4 are passive (self-erasing, with a hint of resentment); option 2 is aggressive (steamrolling).",
  why_confusing=None,
  stronger_alternative="Acknowledge their view + state your concern + propose deciding together.")

# ── Module 9 · Incident and Escalation Communication ────────────────────────
q(topic="Incident and Escalation Communication", type="single", level="Intermediate", role="Individual Contributor",
  format="mc",
  prompt="Which first incident update to stakeholders is best during an outage?",
  options=[
      "We're looking into some issues, will update when we know more.",
      "INVESTIGATING — Checkout is failing for ~30% of users since 14:05 UTC. Impact: card payments error out. We're rolling back the 13:50 deploy; next update by 14:35 or sooner.",
      "It's probably the payment vendor's fault, not us.",
      "Everything's under control, no need to worry.",
  ], answer=1,
  explanation="A strong incident update states status, scope/impact, what you're doing, and the time of the next update — even before you have root cause. Vagueness (“some issues”), premature blame, and false reassurance all destroy stakeholder trust during an incident.",
  why_confusing="“Some issues” gives stakeholders nothing to relay to customers and signals you're not on top of it.",
  stronger_alternative="Status + scope/impact + current action + next-update time. Root cause can come later.")

q(topic="Incident and Escalation Communication", type="open", level="Advanced", role="Technical Leader",
  format="rewrite",
  prompt="During an incident, a teammate writes a blame-heavy update. Rewrite it into a blameless, factual one:\n\n“Raj broke prod again by pushing untested code straight to main. Classic. We're all cleaning up his mess now. No ETA because who knows what else he broke.”",
  model_answer="Update — 15:20 UTC: a change merged to main at 14:58 introduced a null-check regression in the orders service; ~12% of order writes are failing. We're rolling back that commit now; rollback ETA ~10 minutes, then we'll verify order writes recover. Follow-up: we'll add a required integration test on this path so it can't merge unguarded. Next update at 15:35.",
  key_points=[
      "Removes the named blame and sarcasm",
      "States facts: what changed, when, the observable impact",
      "States the action and a real ETA",
      "Adds a systemic follow-up (a guard), not a scapegoat",
      "Commits to a next-update time",
  ],
  explanation="Blameless incident comms focus on the change and the system gap, not the person. Blame makes people hide information in the next incident — exactly when you need it most. Fix the process so the mistake can't recur.",
  why_confusing="Naming and shaming turns the channel toxic and discourages the honest disclosure incident response depends on.",
  say_it_naturally="What changed, what broke, what we're doing, when we'll update — and a guard so it can't happen again.")

q(topic="Incident and Escalation Communication", type="single", level="Advanced", role="Individual Contributor",
  format="scenario",
  prompt="You've hit a wall on a Sev-2 for 40 minutes and you're out of ideas. What do you do?",
  options=[
      "Keep trying alone so you don't look incapable.",
      "Escalate clearly: “I've been on the payments Sev-2 for 40 min. Tried X and Y (no luck). I suspect the connection pool but need someone with DB access. Paging @oncall-dba. Impact and timeline in the thread.”",
      "Wait for the next scheduled update.",
      "Quietly hand it off without context.",
  ], answer=1,
  explanation="Escalation is a professional strength, not an admission of failure. A good escalation states what you've tried, your current hypothesis, exactly what help you need, and the impact — so the next responder is productive in seconds. Ego-driven solo persistence lengthens outages.",
  why_confusing=None,
  stronger_alternative="What I tried + current hypothesis + specific help needed + impact — then page.")

q(topic="Incident and Escalation Communication", type="single", level="Intermediate", role="Manager",
  format="mc",
  prompt="When should you escalate a risk to leadership?",
  options=[
      "Only once it has already become a full-blown problem.",
      "As soon as you have a credible, material risk you can't mitigate at your level — with the impact, what you've tried, and the decision or help you need.",
      "Never — escalating makes you look like you can't handle it.",
      "For every minor issue, to cover yourself.",
  ], answer=1,
  explanation="Escalate early on material risks you can't resolve locally, framed as a decision request, not a panic. Waiting until it's a fire removes everyone's options; escalating every trivial thing trains people to ignore you. Calibrate to materiality and your span of control.",
  why_confusing=None,
  stronger_alternative="Escalate credible, unmitigable, material risk — early, with a specific ask.")

# ── Module 10 · Cross-Cultural Communication ────────────────────────────────
q(topic="Cross-Cultural Communication", type="single", level="Intermediate", role="Technical Leader",
  format="scenario",
  prompt="On a globally distributed team, a colleague says “I'll try to get to it” about a critical task. What's the professional move?",
  options=[
      "Assume it's handled and move on.",
      "Confirm gently and specifically: “Thanks — just so I can plan, is this something you can commit to by Thursday, or should I find backup? Either answer is fine.”",
      "Publicly question whether they're reliable.",
      "Do it yourself without telling them.",
  ], answer=1,
  explanation="Across cultures, indirectness and politeness norms vary — “I'll try” may mean “yes” or a soft “no”. Confirm the commitment specifically and make it safe to say no. Assuming, doubting publicly, or silently taking over all create risk or offense.",
  why_confusing="“I'll try” can be a genuine commitment or a face-saving decline depending on cultural norms; don't guess.",
  stronger_alternative="Ask for a specific commitment and explicitly make “no” an acceptable answer.")

q(topic="Cross-Cultural Communication", type="single", level="Intermediate", role="Individual Contributor",
  format="mc",
  prompt="Which practice most improves clarity on a multinational, English-as-a-second-language team?",
  options=[
      "Using lots of idioms and sports metaphors to sound natural.",
      "Favoring plain words, short sentences, and writing key decisions down; avoiding idioms like “ballpark”, “circle back”, or “take a rain check”.",
      "Speaking faster to save time.",
      "Assuming silence means agreement.",
  ], answer=1,
  explanation="Idioms and cultural metaphors are the biggest hidden source of cross-cultural misunderstanding. Plain, literal language, shorter sentences, and written confirmation of decisions serve everyone. Silence often signals confusion or disagreement, not consent.",
  why_confusing="“Circle back”, “ballpark”, and “rain check” are opaque to many fluent non-native speakers and cause silent confusion.",
  stronger_alternative="Say “let's discuss this again Thursday” instead of “let's circle back”.")

q(topic="Cross-Cultural Communication", type="open", level="Advanced", role="Manager",
  format="scenario",
  prompt="Your team spans US, India, and Germany. Meetings keep running past some people's evenings and a few members rarely speak up. Write 3–4 concrete practices you'd introduce (respectful, not stereotyping).",
  model_answer="1) Rotate the meeting time so the same region isn't always inconvenienced, and record every session for those who can't attend live. 2) Publish an agenda 24h ahead and ask for written input on it, so quieter or async members contribute before the call. 3) Run a round-robin on key decisions — explicitly invite each person by name rather than waiting for volunteers. 4) Default important decisions to a written doc with a comment period, so verbal-meeting dominance doesn't decide everything. I'd frame all of this as “making our process work across time zones”, not as anyone's shortcoming.",
  key_points=[
      "Shares the time-zone burden fairly (rotation + recordings)",
      "Enables async participation (pre-agenda, written input)",
      "Actively includes quieter members (round-robin, name invites)",
      "Moves key decisions to writing so no one is disadvantaged by meeting style",
      "Frames it as process improvement, avoids cultural stereotyping",
  ],
  explanation="Inclusive global collaboration is a systems problem: fair scheduling, async-first decisions, and deliberate inclusion mechanisms. Address structure, not personalities, and never attribute behavior to nationality.",
  say_it_naturally="Fix the process (rotation, agendas, round-robin, written decisions) — not the people.")

# ── Module 11 · Executive Communication ─────────────────────────────────────
q(topic="Executive Communication", type="single", level="Advanced", role="Technical Leader",
  format="mc",
  prompt="You have five minutes with a VP about a risky migration. How do you open?",
  options=[
      "Start with the architecture diagram and walk through each component.",
      "Lead with the ask and bottom line: “I need a decision on whether we accept two hours of downtime for the migration. My recommendation is yes — here's why in three points.”",
      "Give the full history of how we got here.",
      "List every risk you can think of without a recommendation.",
  ], answer=1,
  explanation="Executives optimize for decisions. Open with the decision you need and your recommendation, then support it with a few crisp reasons; go deeper only if asked. Leading with architecture or history spends your five minutes before you reach the point, and risks-without-a-recommendation pushes your job onto them.",
  why_confusing=None,
  stronger_alternative="Decision needed + your recommendation + 3 reasons. Detail on request.")

q(topic="Executive Communication", type="open", level="Advanced", role="Technical Leader",
  format="rewrite",
  prompt="Summarize this engineer's update for an executive audience in exactly two sentences:\n\n“So we've been having trouble with the data pipeline, it keeps failing at night because of memory issues in the Spark jobs, we tried tuning the executors and it helped a bit but not fully, and now we're thinking we might need to either rewrite parts of it or move to a bigger cluster which would cost more, and it's affecting the morning dashboards that leadership looks at.”",
  model_answer="The nightly data pipeline is failing intermittently, which delays the morning leadership dashboards about twice a week. We can stabilize it either by re-architecting the heaviest job (≈2 engineer-weeks, no added cost) or by upsizing the cluster (immediate fix, +$3k/month) — I recommend the re-architecture and can start Monday if you approve.",
  key_points=[
      "Two sentences, executive-readable",
      "Leads with business impact (delayed leadership dashboards, frequency)",
      "Presents two clear options with cost/effort tradeoffs",
      "Ends with a recommendation and a next step",
      "Drops the low-level detail (executors, memory tuning)",
  ],
  explanation="Executive summarizing means compressing to impact, options, and a recommendation. Strip implementation detail; surface the decision. Two sentences forces the discipline.",
  say_it_naturally="Impact first, two options with costs, then your recommendation — done.")

q(topic="Executive Communication", type="single", level="Intermediate", role="Manager",
  format="mc",
  prompt="An exec asks a question you can't fully answer in the meeting. Best response?",
  options=[
      "Make up a plausible-sounding number.",
      "“I don't have the exact figure in front of me. My rough estimate is around 20%, but I'll confirm the precise number and send it to you by end of day.”",
      "“I don't know.”",
      "Deflect to a different topic.",
  ], answer=1,
  explanation="Give your best-calibrated estimate, clearly labeled as an estimate, and commit to a firm follow-up with the exact figure. Fabricating erodes trust the moment it's checked; a bare “I don't know” wastes the moment; deflecting reads as evasive.",
  why_confusing=None,
  stronger_alternative="Labeled estimate now + a committed, dated follow-up with the exact number.")

# ── Module 12 · Listening, Clarifying, and Confirming Understanding ──────────
q(topic="Listening, Clarifying, and Confirming Understanding", type="single", level="Beginner", role="Individual Contributor",
  format="scenario",
  prompt="A stakeholder gives you a vague request: “Can you make the dashboard better?” Best first step?",
  options=[
      "Guess what they mean and start building.",
      "Clarify with specifics: “Happy to — when you say better, is it mainly speed, the metrics shown, or how it looks? And who's the main audience?” Then confirm the top priority.",
      "Tell them the dashboard is fine as is.",
      "Ask them to write a full spec before you'll do anything.",
  ], answer=1,
  explanation="Vague requests are cheap to clarify and expensive to guess wrong. A few targeted questions (which dimension, for whom, what's the priority) turn “make it better” into something you can deliver. Guessing risks building the wrong thing; demanding a full spec upfront can feel obstructive.",
  why_confusing="“Better” hides at least three different asks (faster / different data / prettier); building on a guess wastes days.",
  stronger_alternative="Ask which dimension of “better”, for which audience, and what's #1 — then confirm.")

q(topic="Listening, Clarifying, and Confirming Understanding", type="single", level="Intermediate", role="Individual Contributor",
  format="mc",
  prompt="Which is the best confirmation to end a requirements conversation?",
  options=[
      "Ok cool, got it.",
      "So to confirm: I'll add refund-adjusted revenue to the weekly report, split by region, ready for review by next Wednesday. Anything I've missed or got wrong?",
      "I'll do my best.",
      "Sounds good, talk later.",
  ], answer=1,
  explanation="Closing with a specific read-back of scope, breakdown, and deadline — and inviting correction — catches misunderstandings while they're still free to fix. “Got it” and “I'll do my best” leave both sides guessing whether you actually aligned.",
  why_confusing=None,
  stronger_alternative="Read back scope + specifics + deadline, then ask “what did I miss?”")

q(topic="Listening, Clarifying, and Confirming Understanding", type="open", level="Advanced", role="Manager",
  format="scenario",
  prompt="In a design review, two senior engineers are using the word “cache” to mean different things and are talking past each other. As the facilitator, what do you say to restore shared understanding? (2–3 sentences.)",
  model_answer="Let me pause us for a second — I think we're using “cache” two different ways. Sam, it sounds like you mean the CDN edge cache for static responses; Priya, I think you mean the in-process cache for computed results. Can we name them “edge cache” and “result cache” for the rest of this discussion, and confirm we actually agree on both?",
  key_points=[
      "Names the specific miscommunication explicitly",
      "Plays back each person's meaning to check understanding",
      "Proposes distinct shared vocabulary to prevent recurrence",
      "Re-confirms agreement before moving on",
  ],
  explanation="A huge share of technical conflict is vocabulary collision. The facilitator's job is to surface the ambiguity, reflect each meaning back, and establish shared terms — then re-test agreement. This is active listening applied to a group.",
  say_it_naturally="“I think we mean two different things by X — here's each, let's name them separately and re-check we agree.”")

q(topic="Listening, Clarifying, and Confirming Understanding", type="single", level="Intermediate", role="Individual Contributor",
  format="scenario",
  prompt="'What could go wrong?' — A colleague says on a call: “Yeah, yeah, I got it, no problem,” but hasn't repeated anything back. What's the risk and the fix?",
  options=[
      "No risk; verbal agreement is enough. Move on.",
      "Risk: “got it” may mask a gap. Fix: ask them to play it back — “Great — just so we're aligned, can you walk me through how you'll approach it?”",
      "Risk: they're annoyed; stop talking to them.",
      "Send a long email repeating everything instead.",
  ], answer=1,
  explanation="A quick verbal “got it” is weak evidence of shared understanding, especially under time pressure or across a language gap. Asking for a brief play-back (not a quiz, framed as alignment) verifies it cheaply before work goes the wrong way.",
  why_confusing="“Got it, no problem” can be genuine or a polite way to end an uncomfortable moment — it doesn't prove comprehension.",
  stronger_alternative="Invite a short play-back: “Walk me through your approach so we're aligned.”")

# ═════════════════════════════════════════════════════════════════════════════
# BATCH 2 — additional exercises to broaden coverage and depth.
# ═════════════════════════════════════════════════════════════════════════════

# ── Module 1 · Common Grammar and Usage ─────────────────────────────────────
q(topic="Common Grammar and Usage", type="single", level="Beginner", role="Individual Contributor",
  format="mc",
  prompt="Choose the clearest sentence.",
  options=[
      "Please intimate me once the job is done.",
      "Please inform me once the job is done.",
      "Please let me know once the job is done.",
      "Please update me the same once done.",
  ], answer=2,
  explanation="“Let me know” is the most natural, universally understood option. “Intimate” meaning “inform” is regional and archaic to most readers; “update me the same” misuses “the same” as a pronoun.",
  why_confusing="“Intimate” as a verb for “notify” and “the same” as a stand-in noun are both non-standard in global English.",
  stronger_alternative="“Please let me know once the backfill finishes.”")

q(topic="Common Grammar and Usage", type="single", level="Intermediate", role="Individual Contributor",
  format="mc",
  prompt="Which sentence handles the article and number correctly?",
  options=[
      "I will share the informations by tomorrow.",
      "I will share the information by tomorrow.",
      "I will share informations by tomorrow.",
      "I will share an informations by tomorrow.",
  ], answer=1,
  explanation="“Information” is an uncountable noun — it has no plural “informations” and takes no “an”. Use “the information” or “some information”.",
  why_confusing="Treating uncountable nouns (information, feedback, equipment, software) as countable is a frequent slip.",
  stronger_alternative="“I'll share the details by tomorrow.”")

q(topic="Common Grammar and Usage", type="single", level="Beginner", role="Candidate",
  format="mc",
  prompt="Identify and fix the mistake. Which is correct?",
  options=[
      "She is working here since 2019.",
      "She has been working here since 2019.",
      "She works here since 2019.",
      "She is working here from 2019.",
  ], answer=1,
  explanation="An action that started in the past and continues now uses the present perfect continuous: “has been working … since 2019”. The simple present and present continuous can't carry “since + past point”.",
  why_confusing="Pairing “since 2019” with a present-tense verb is a classic tense error.",
  stronger_alternative="“She has been on the platform team since 2019.”")

q(topic="Common Grammar and Usage", type="single", level="Intermediate", role="Individual Contributor",
  format="mc",
  prompt="Which sentence is correct and natural?",
  options=[
      "Can you please explain me the architecture?",
      "Can you please explain the architecture to me?",
      "Can you please explain me about the architecture?",
      "Can you please explain to me the architecture about?",
  ], answer=1,
  explanation="“Explain” takes the pattern “explain something to someone”, not “explain someone something”. So: “explain the architecture to me”.",
  why_confusing="“Explain me” copies the “tell me / show me” pattern, but “explain” doesn't allow it.",
  stronger_alternative="“Could you walk me through the architecture?”")

q(topic="Common Grammar and Usage", type="multi", level="Advanced", role="Technical Leader",
  format="mc",
  prompt="Select every sentence that is correct professional English. (Choose all that apply.)",
  options=[
      "Please find attached the report.",
      "Please find the attached report.",
      "Kindly find attached herewith the report.",
      "I've attached the report.",
      "Attaching herewith the same for your reference.",
  ], answer=[0, 1, 3],
  explanation="“Please find attached the report”, “Please find the attached report”, and the plainest “I've attached the report” are all fine (the last is best for modern email). “Herewith” and “the same for your reference” are dated, over-formal officialese.",
  why_confusing="“Herewith”, “the same”, and “kindly … herewith” stack redundant archaic markers that slow the reader.",
  stronger_alternative="“I've attached the report — key numbers are on page 2.”")

q(topic="Common Grammar and Usage", type="open", level="Intermediate", role="Individual Contributor",
  format="rewrite",
  prompt="Fix every error and awkward phrasing, keeping the meaning:\n\n“Myself Arun, I am working as data engineer since 3 years. I have did many projects and I am knowing Spark also. Kindly revert if any queries.”",
  model_answer="Hi, I'm Arun — I've worked as a data engineer for three years. I've delivered several projects, including a few on Spark. Please reply if you have any questions.",
  key_points=[
      "“Myself Arun” → “I'm Arun”",
      "“since 3 years” → “for three years”",
      "“I have did” → “I've delivered/done”; “I am knowing” → “I know”",
      "“revert if any queries” → “reply if you have any questions”",
      "Reads naturally end to end",
  ],
  explanation="The rewrite fixes the self-introduction idiom, the since/for duration error, two verb-form errors, and the “revert/queries” regionalisms — while keeping Arun's meaning intact.",
  say_it_naturally="“Hi, I'm Arun — data engineer, three years in, mostly Spark work lately.”")

q(topic="Common Grammar and Usage", type="single", level="Beginner", role="Individual Contributor",
  format="mc",
  prompt="Choose the clearest sentence.",
  options=[
      "Revert back once you reach home.",
      "Message me once you get home.",
      "Intimate me after reaching home.",
      "Ping me once you reached home.",
  ], answer=1,
  explanation="“Message me once you get home” is natural and correct. “Revert back” and “intimate” are non-standard, and “once you reached” mismatches tense (use the present “get”).",
  why_confusing=None,
  stronger_alternative="“Message me once you're home and we'll pick this up.”")

# ── Module 2 · Interview Communication ──────────────────────────────────────
q(topic="Interview Communication", type="single", level="Intermediate", role="Candidate",
  format="scenario",
  prompt="You realize halfway through coding that your approach is wrong. What's the best thing to say?",
  options=[
      "Say nothing and quietly hope it works out.",
      "“I've just realized this approach is O(n²) and won't scale — let me switch to a hash-map approach, which is O(n). Here's why.”",
      "Erase everything without explanation and start over silently.",
      "Blame the problem statement for being unclear.",
  ], answer=1,
  explanation="Interviewers value the ability to notice, name, and correct a wrong turn out loud. Explaining why you're switching demonstrates self-monitoring and judgment — often worth more than a flawless first attempt.",
  why_confusing=None,
  stronger_alternative="Name the flaw, name the better approach, and explain the switch as you make it.")

q(topic="Interview Communication", type="single", level="Beginner", role="Candidate",
  format="mc",
  prompt="Which answer to “Why do you want to work here?” is strongest?",
  options=[
      "You're hiring and I need a job.",
      "You pay well and it's close to home.",
      "You're solving real-time personalization at a scale I've only read about, and I've spent two years on the batch version of exactly this problem — I want to make it real-time.",
      "I've heard it's a good company.",
  ], answer=2,
  explanation="Strong “why us” answers connect something specific about the company's work to your own experience and ambition. Generic or self-interested answers (“need a job”, “pays well”) show no research and no fit.",
  why_confusing=None,
  stronger_alternative="Tie a specific thing they do to a specific thing you've done or want to do.")

q(topic="Interview Communication", type="single", level="Advanced", role="Candidate",
  format="scenario",
  prompt="A behavioral question: “Tell me about a time you failed.” Which response is best?",
  options=[
      "I can't think of a real failure.",
      "I once picked NoSQL for a reporting workload; queries got painful as analysts needed joins. I owned the call, led a migration to Postgres, and now I pressure-test access patterns before choosing a store. It cost us a month I could have saved.",
      "My teammate failed and it made me look bad.",
      "I failed because management gave me impossible deadlines.",
  ], answer=1,
  explanation="A strong failure story is a real, owned mistake with a clear lesson and changed behavior. It shows accountability and growth. “No failures”, blaming others, or blaming management all dodge the actual question — self-awareness.",
  why_confusing=None,
  stronger_alternative="Real failure + your ownership + what you changed because of it.")

q(topic="Interview Communication", type="open", level="Intermediate", role="Candidate",
  format="speaking",
  prompt="Speaking practice (~60s): The interviewer asks, “Explain a technical concept you know well to me as if I'm not technical.” Pick any concept and deliver it. Then self-rate on clarity, analogy, and landing the 'why it matters'.",
  model_answer="Sure — let me explain a database index. Imagine a 500-page textbook with no index at the back. To find every mention of “photosynthesis”, you'd flip through all 500 pages. That's what a database does without an index — it reads every row. An index is that alphabetical list at the back: it points straight to the right pages, so lookups take a fraction of a second instead of scanning everything. The tradeoff is that, like a real index, it takes extra space and has to be updated whenever the book changes — so we add indexes to the columns we search often, not to everything. That's why a well-indexed database can answer in milliseconds what would otherwise take minutes.",
  key_points=[
      "Opens with a familiar analogy (textbook index)",
      "Explains the 'without it' pain first (full scan)",
      "Names the tradeoff (space, write cost)",
      "Lands the 'why it matters' (ms vs minutes)",
      "No unexplained jargon; ~60 seconds",
  ],
  explanation="Explaining well to a non-expert = one strong analogy, the pain it solves, the tradeoff, and the payoff. Interviewers use this to test whether you can communicate with product, sales, and executives — not just engineers.",
  say_it_naturally="One analogy, the problem it solves, the catch, and why anyone should care.")

q(topic="Interview Communication", type="single", level="Intermediate", role="Candidate",
  format="mc",
  prompt="Compare three answers to a salary-expectations question early in the process. Which is best?",
  options=[
      "Exactly $147,500, non-negotiable.",
      "Whatever you think is fair.",
      "Based on my research for this role and market, I'm targeting the $140–160k range, and I'm flexible depending on the full package. Can you share the band for this role?",
      "I'd rather not say, let's just see how it goes.",
  ], answer=2,
  explanation="Give a researched range, signal flexibility, and turn the question back to learn their band. An over-precise number boxes you in, “whatever's fair” cedes leverage, and refusing to engage can stall the process.",
  why_confusing=None,
  stronger_alternative="Researched range + flexibility + “what's the band for this role?”")

# ── Module 3 · Workplace Conversations ──────────────────────────────────────
q(topic="Workplace Conversations", type="single", level="Beginner", role="Individual Contributor",
  format="scenario",
  prompt="You disagree with a decision in a meeting but the room is moving on. Best move?",
  options=[
      "Stay quiet now and complain to peers afterward.",
      "“Before we move on — I have a concern about the rollback plan. Can I take 60 seconds?” State it crisply, then support whatever the group decides.",
      "Refuse to continue until they hear you out fully.",
      "Send a long dissenting email after the meeting.",
  ], answer=1,
  explanation="Voice disagreement in the room, briefly and constructively, then commit to the outcome (“disagree and commit”). Silent-then-grumbling erodes trust; hijacking the meeting or a post-hoc email broadcast damages your standing more than the disagreement itself.",
  why_confusing=None,
  stronger_alternative="Raise it concisely in the moment, then get behind the decision.")

q(topic="Workplace Conversations", type="single", level="Intermediate", role="Manager",
  format="scenario",
  prompt="A report says “I'm totally overwhelmed and can't keep up.” What's the best first response?",
  options=[
      "Just prioritize better.",
      "“Thanks for telling me — that's important. Let's look at your list together right now and figure out what to drop, defer, or hand off. What's feeling heaviest?”",
      "Everyone's busy, you'll be fine.",
      "I'll take some things off you.” (then do nothing)",
  ], answer=1,
  explanation="Acknowledge the disclosure, then move immediately to concrete, collaborative triage. Dismissing it (“just prioritize”, “everyone's busy”) tells people not to raise problems; a vague promise you don't keep is worse than none.",
  why_confusing=None,
  stronger_alternative="Validate, then triage the actual list together — drop/defer/delegate.")

q(topic="Workplace Conversations", type="open", level="Intermediate", role="Individual Contributor",
  format="rewrite",
  prompt="Convert this passive, blame-avoidant message into a clear ownership statement:\n\n“The deploy kind of got messed up somehow, I'm not really sure how it happened, mistakes were made I guess, hopefully it's okay now.”",
  model_answer="I caused the failed deploy — I skipped the staging run and a config error went straight to prod. I've rolled it back and prod is healthy again as of 3:10pm. To prevent a repeat, I'm adding a required staging gate to the pipeline; I'll have that in by tomorrow.",
  key_points=[
      "Replaces “mistakes were made” with clear personal ownership",
      "States what actually happened",
      "States current status (rolled back, healthy, timestamp)",
      "Commits to a specific preventive fix",
  ],
  explanation="Passive voice (“mistakes were made”) hides ownership and reads as evasive. A clear ownership statement says what you did, the current state, and how you'll prevent recurrence — which builds trust rather than eroding it.",
  why_confusing="“Somehow”, “I guess”, and “mistakes were made” signal you either don't understand the failure or won't own it.",
  say_it_naturally="“I caused it, here's what happened, it's fixed now, and here's the guard I'm adding.”")

q(topic="Workplace Conversations", type="single", level="Advanced", role="Technical Leader",
  format="scenario",
  prompt="A stakeholder pushes for a shortcut you believe is unsafe. How do you push back well?",
  options=[
      "Just say no, it's a bad idea.",
      "Give in to keep the peace.",
      "“I understand the deadline pressure. Here's my concern: skipping the migration test risks corrupting live orders, which would cost us days. If we must ship, here's a safer middle path that adds only two hours. Which risk do you want to take?”",
      "Escalate over their head immediately.",
  ], answer=2,
  explanation="Acknowledge their goal, make the specific risk and its cost concrete, offer a safer alternative, and frame it as their informed choice. A flat “no” invites a power struggle; caving abandons your professional judgment; going over their head too early burns the relationship.",
  why_confusing=None,
  stronger_alternative="Acknowledge the pressure + concrete risk/cost + a safer option + hand them the decision.")

q(topic="Workplace Conversations", type="single", level="Beginner", role="Individual Contributor",
  format="mc",
  prompt="A teammate helped you a lot this week. Which thank-you is most meaningful and professional?",
  options=[
      "Thanks!",
      "Thanks for your help — walking me through the Kafka consumer setup on Tuesday saved me at least a day, and the tip about consumer groups fixed the lag issue. Really appreciate it.",
      "You're a lifesaver, I owe you my life!!!",
      "Thx",
  ], answer=1,
  explanation="Specific gratitude — naming what they did and the concrete impact — is more sincere and memorable than a generic “thanks”, and it reinforces the exact helpful behavior. Over-the-top praise can feel hollow; “thx” reads as an afterthought.",
  why_confusing=None,
  stronger_alternative="Name the specific help + its impact + genuine thanks.")

# ── Module 4 · Email and Chat Writing ───────────────────────────────────────
q(topic="Email and Chat Writing", type="single", level="Intermediate", role="Individual Contributor",
  format="mc",
  prompt="You're adding people to a thread mid-conversation. What's the professional thing to do?",
  options=[
      "Just add them silently and let them scroll up.",
      "“+Maya, +Jon for visibility. Context: we're deciding whether to delay the launch a week over the payments bug — summary in the first message, open question is at the bottom.”",
      "Start a brand-new thread and lose all the history.",
      "Forward the whole thread with no note.",
  ], answer=1,
  explanation="When looping people in, say who you added, why, and give a one-line summary plus where the open question is — so they can engage without reading 40 messages. Silent adds and context-free forwards make the new people do archaeology.",
  why_confusing=None,
  stronger_alternative="Name who + why + a one-line summary + the specific open question.")

q(topic="Email and Chat Writing", type="open", level="Advanced", role="Manager",
  format="rewrite",
  prompt="Summarize this long message in two sentences for a busy reader:\n\n“Hey, so I looked into the cost spike and it turns out the warehouse costs went up a lot last month, mostly because of the new hourly refresh we added for the marketing dashboard, which is running a really expensive query every hour even overnight when nobody's looking at it, and also the dev environment was left running all weekend a couple of times. I think we could save a lot by making the refresh less frequent and auto-suspending dev, but I wanted to check with you first.”",
  model_answer="Last month's warehouse cost spike came mostly from the marketing dashboard's hourly refresh running an expensive query 24/7, plus the dev environment being left on over some weekends. I can cut most of it by lowering the refresh frequency and auto-suspending dev — okay to proceed?",
  key_points=[
      "Two sentences",
      "Keeps the two root causes (hourly refresh + dev left on)",
      "Keeps the proposed fix and the ask",
      "Drops the filler and hedging",
  ],
  explanation="Summarizing means keeping causes, the proposed action, and the decision — and cutting everything else. Two sentences forces you to distinguish signal from narration.",
  say_it_naturally="Two causes, one fix, one ask — nothing else.")

q(topic="Email and Chat Writing", type="single", level="Beginner", role="Individual Contributor",
  format="mc",
  prompt="Which is the most professional way to write a message when you're frustrated?",
  options=[
      "Send it immediately while the feeling is hot.",
      "Draft it, wait a few minutes, reread it as if you were the recipient, then cut anything that attacks a person rather than the problem.",
      "Add extra exclamation marks so they know you're serious.",
      "CC their manager to apply pressure.",
  ], answer=1,
  explanation="A short cooling-off and a recipient's-eye reread removes the lines you'd regret and keeps the legitimate point. Firing off heated messages, punctuation escalation, and reflexive CC-the-boss all damage relationships and rarely improve the outcome.",
  why_confusing=None,
  stronger_alternative="Draft, pause, reread as the recipient, strip the personal jabs — then send.")

q(topic="Email and Chat Writing", type="single", level="Intermediate", role="Technical Leader",
  format="scenario",
  prompt="You need a decision from a busy director by email. Which format gets the fastest yes/no?",
  options=[
      "A long narrative ending with an implicit ask.",
      "Subject: 'Decision by Fri: approve $3k/mo cluster upsize?' Body: one-line context, the specific ask, two bullet options with costs, and your recommendation.",
      "A vague 'thoughts?' with three attachments.",
      "A meeting request with no agenda.",
  ], answer=1,
  explanation="Executives decide fastest when the ask is in the subject and the body is: context, the decision, the options with costs, and a recommendation. Narratives, 'thoughts?', and agenda-less meetings push the cognitive work onto the reader and slow the decision.",
  why_confusing=None,
  stronger_alternative="Put the decision + deadline in the subject; make the body a one-screen decision brief.")

# ── Module 5 · Stand-up and Status Updates ──────────────────────────────────
q(topic="Stand-up and Status Updates", type="single", level="Beginner", role="Individual Contributor",
  format="mc",
  prompt="Which is the clearest 'blocked' status?",
  options=[
      "Blocked, can't do anything.",
      "Blocked on the staging DB creds — raised ticket OPS-231 yesterday, no response yet. This blocks the whole integration test. Can someone nudge Ops, or is there a workaround?",
      "Waiting on other people as usual.",
      "Still blocked (same as yesterday).",
  ], answer=1,
  explanation="A useful blocker names exactly what you're blocked on, what you've already done about it (the ticket), the impact, and a specific ask. 'Blocked, can't do anything' and 'same as yesterday' give the team no way to help unblock you.",
  why_confusing="'Blocked' with no specifics hides both the cause and what would resolve it.",
  stronger_alternative="What's blocking + what you've tried + impact + the specific unblock you need.")

q(topic="Stand-up and Status Updates", type="single", level="Intermediate", role="Individual Contributor",
  format="mc",
  prompt="Choose the clearest way to express confidence in a delivery date.",
  options=[
      "It'll probably maybe be done around Thursday-ish, we'll see.",
      "I'm ~90% confident on Thursday. The one risk is the third-party API review; if that slips, it moves to Monday. I'll know by Wednesday noon.",
      "Definitely Thursday, 100%, no issues at all.",
      "Soon.",
  ], answer=1,
  explanation="Calibrated confidence — a probability, the specific risk, the fallback date, and when you'll know — lets others plan around you. Vague hedging ('Thursday-ish', 'soon') is unusable, and false certainty ('100%') destroys credibility the moment it slips.",
  why_confusing=None,
  stronger_alternative="Confidence level + the one risk + fallback date + when you'll know for sure.")

q(topic="Stand-up and Status Updates", type="open", level="Advanced", role="Technical Leader",
  format="rewrite",
  prompt="Rewrite this activity-log standup into an outcome-and-risk update:\n\n“Yesterday I had three meetings, reviewed some PRs, looked into the caching bug for a while, answered a bunch of Slack messages, and started reading about the new vector DB.”",
  model_answer="Caching bug: narrowed it to a stale TTL on the session cache — fix in review, should ship today. That's the main risk item because it's causing the intermittent logouts users reported. Vector DB spike: starting the evaluation; I'll have a recommendation by Friday. No blockers.",
  key_points=[
      "Converts activities into outcomes (what moved, not what you touched)",
      "Surfaces the one thing that matters (the caching bug + user impact)",
      "Gives a date for the open evaluation",
      "States blocker status",
  ],
  explanation="Standups are for outcomes and risks, not activity logs. Nobody can act on 'reviewed some PRs'; they can act on 'the caching bug is causing logouts, fix ships today'.",
  say_it_naturally="Lead with what moved and what's at risk — skip the calendar recap.")

# ── Module 6 · Explaining Technical Concepts ────────────────────────────────
q(topic="Explaining Technical Concepts", type="single", level="Intermediate", role="Individual Contributor",
  format="scenario",
  prompt="A junior engineer asks what 'eventual consistency' means. Best explanation?",
  options=[
      "It's when the CAP theorem forces you to trade C for A under partition.",
      "It means after a write, different servers might briefly show old data, but they all catch up within a moment. Like posting a photo and a friend seeing it a few seconds later — not instant everywhere, but consistent soon.",
      "It's just a database being slow.",
      "You wouldn't understand it without distributed-systems background.",
  ], answer=1,
  explanation="For a learner, define it plainly, give a relatable analogy, and imply the tradeoff. Leading with CAP jargon assumes the very knowledge they're asking about; 'just slow' is wrong; and gatekeeping ('you wouldn't understand') is the opposite of teaching.",
  why_confusing=None,
  stronger_alternative="Plain definition + everyday analogy, then layer in CAP if they want more.")

q(topic="Explaining Technical Concepts", type="single", level="Advanced", role="Technical Leader",
  format="mc",
  prompt="You're presenting a system design to a room with engineers, a PM, and a finance lead. How do you structure it?",
  options=[
      "Deep architecture for the whole hour; others can keep up.",
      "Start with the goal and the business impact for everyone, give the PM the user/tradeoff view, then go deep on architecture for the engineers — signposting each shift so people know which part is for them.",
      "Only cover cost, since finance is in the room.",
      "Alternate randomly between depths.",
  ], answer=1,
  explanation="For a mixed audience, layer the talk: a shared framing everyone needs, then clearly signposted sections at the right depth for each group. Signposting ('for the engineers, here's the data flow…') lets people lean in or coast. One-depth-fits-all loses most of the room.",
  why_confusing=None,
  stronger_alternative="Shared framing first, then signposted layers at each audience's depth.")

q(topic="Explaining Technical Concepts", type="open", level="Intermediate", role="Individual Contributor",
  format="rewrite",
  prompt="A non-technical manager asks why a 'simple' change will take two weeks. Rewrite this defensive reply into a clear, credible one:\n\n“It's not simple at all, there's a ton of complexity you don't see, it just takes as long as it takes, trust me.”",
  model_answer="I get why it looks small from the outside. The visible change is one button, but that button touches billing, so we also have to update the pricing logic, migrate existing subscriptions safely, and test the money paths so no one gets double-charged. The UI is a day; the safe billing changes and testing are the other nine. If we need it faster, I can ship the display-only part next week and the billing part the week after — want me to split it?",
  key_points=[
      "Validates the manager's perception instead of dismissing it",
      "Explains where the time actually goes, in plain terms",
      "Ties the effort to a real risk (double-charging)",
      "Offers a phased option to give them control",
  ],
  explanation="'Trust me, it's complex' asks for faith without giving understanding. Show where the time goes in their terms and offer a tradeoff — that earns credibility and keeps the relationship collaborative.",
  why_confusing="Dismissing the question ('you don't see the complexity') sounds evasive and condescending.",
  say_it_naturally="“The button's a day; making the billing side safe is the other nine — here's why, and here's a way to split it.”")

# ── Module 7 · Giving and Receiving Feedback ────────────────────────────────
q(topic="Giving and Receiving Feedback", type="single", level="Beginner", role="Individual Contributor",
  format="scenario",
  prompt="A peer asks you to review their design doc and you spot real problems. How do you open your feedback?",
  options=[
      "This design won't work, there are too many issues.",
      "Thanks for sharing this — the overall direction is solid. I have two concerns I think are worth working through: the failover path and the cost at scale. Want to talk them through?",
      "List every flaw in a blunt bulleted takedown.",
      "Say it looks great to avoid friction, then privately worry.",
  ], answer=1,
  explanation="Open by acknowledging effort and what works, then frame concerns as shared problems to solve, prioritized. A blunt takedown triggers defensiveness; false praise fails your colleague and the project. Honest-and-kind beats both brutal and nice.",
  why_confusing=None,
  stronger_alternative="Acknowledge + name your top 1–2 concerns as things to solve together.")

q(topic="Giving and Receiving Feedback", type="single", level="Advanced", role="Manager",
  format="mc",
  prompt="Which praise is most effective at reinforcing good behavior?",
  options=[
      "Great job, you're awesome!",
      "Nice work this sprint.",
      "The way you wrote that incident postmortem — blameless, with a clear timeline and two concrete preventions — set the standard. Please do the next few; it's exactly how I want us to handle these.",
      "You're the best engineer on the team.",
  ], answer=2,
  explanation="Specific praise names the exact behavior and why it mattered, so it's repeatable and credible. Generic praise ('awesome', 'best engineer') feels nice but teaches nothing and can breed comparison. Reinforce behaviors, not identities.",
  why_confusing=None,
  stronger_alternative="Name the specific behavior + its impact + an invitation to do more of it.")

q(topic="Giving and Receiving Feedback", type="open", level="Intermediate", role="Individual Contributor",
  format="scenario",
  prompt="You disagree with feedback you received and think it's based on a misunderstanding. Write how you'd respond after reflecting (3–4 sentences).",
  model_answer="Thanks again for the feedback on the launch — I've been thinking about it. I want to share some context I don't think came through: the delay was a deliberate call I made with the PM to fix a data bug that would have shipped wrong numbers, and I flagged it in the Friday update. I'm genuinely open to the possibility I should have communicated it more loudly — can we look at that thread together and figure out where the signal got lost? I care about getting this right.",
  key_points=[
      "Non-defensive opener that shows you took it seriously",
      "Supplies missing context calmly, with evidence (the thread)",
      "Stays open to being partly wrong (communication, not the decision)",
      "Invites joint fact-finding rather than declaring the feedback invalid",
  ],
  explanation="Pushing back on feedback works when you assume good intent, bring evidence, concede what you can, and invite a shared look at the facts — not when you flatly reject it. This preserves the relationship and often surfaces the real gap.",
  say_it_naturally="“Here's context you may not have had; I might still own the communication piece — can we look together?”")

# ── Module 8 · Conflict Resolution ──────────────────────────────────────────
q(topic="Conflict Resolution", type="single", level="Intermediate", role="Manager",
  format="scenario",
  prompt="Two of your reports are in a simmering conflict that's slowing the team. What's the best first step?",
  options=[
      "Ignore it and hope it resolves itself.",
      "Meet each privately to understand their perspective and the underlying interests, then bring them together around a shared goal with clear ground rules.",
      "Tell them both to be more professional and move on.",
      "Publicly reprimand whoever you think started it.",
  ], answer=1,
  explanation="Effective conflict resolution starts with understanding each side's interests privately, then a structured joint conversation focused on shared goals. Ignoring lets it fester; a generic 'be professional' addresses nothing; public blame escalates and takes sides.",
  why_confusing=None,
  stronger_alternative="Understand each side's interests, then facilitate toward a shared goal with ground rules.")

q(topic="Conflict Resolution", type="single", level="Advanced", role="Individual Contributor",
  format="mc",
  prompt="Which sentence best separates the position from the underlying interest in a disagreement?",
  options=[
      "You want microservices and I want a monolith, so we're at an impasse.",
      "It sounds like you want independent deploys and clear ownership; I want to avoid operational overhead for our small team. Can we find an option that serves both?",
      "My way is simpler, so we should do that.",
      "Let's just flip a coin.",
  ], answer=1,
  explanation="Getting past a deadlock means naming the interests beneath the positions ('independent deploys' vs 'low ops overhead') and searching for an option that satisfies both. Restating fixed positions, asserting superiority, or randomizing all skip the actual problem-solving.",
  why_confusing=None,
  stronger_alternative="Surface the interests behind each position, then solve for both.")

q(topic="Conflict Resolution", type="open", level="Advanced", role="Technical Leader",
  format="rewrite",
  prompt="Convert this aggressive review comment into an assertive, constructive one:\n\n“This code is a mess. Did you even test it? Nobody writes SQL like this anymore. Rewrite the whole thing.”",
  model_answer="A few things I'd like to work through before this merges. The three subqueries in the WHERE clause will scan the orders table multiple times — on prod volume that'll be slow. I'd suggest a single CTE that computes the aggregates once (rough sketch in the thread). Also, I don't see a test for the null-customer case — could you add one? Happy to pair on the rewrite if that's easier.",
  key_points=[
      "Removes the personal attacks ('a mess', 'did you even test it')",
      "Names specific, concrete technical issues with reasoning",
      "Proposes a specific improvement, not just 'rewrite it'",
      "Offers to help",
      "Assertive about the problems, respectful of the person",
  ],
  explanation="Code review is where assertive-vs-aggressive matters most. Attack the code's specific problems with reasons and suggestions, never the author's competence. The same standards, delivered respectfully, get accepted instead of resented.",
  why_confusing="'Did you even test it?' and 'this is a mess' provoke defensiveness and bury the valid technical points.",
  say_it_naturally="Name the specific issue, why it matters, a concrete fix, and an offer to help.")

# ── Module 9 · Incident and Escalation Communication ────────────────────────
q(topic="Incident and Escalation Communication", type="single", level="Intermediate", role="Individual Contributor",
  format="mc",
  prompt="An incident is resolved. Which closing update is best?",
  options=[
      "Fixed.",
      "RESOLVED 15:42 UTC — checkout is fully recovered. Cause: a config change disabled retries on the payment gateway. Fix: reverted the config; success rate back to 99.9%. Follow-ups: add a config-change alert and a retry-health check (tickets linked). Postmortem Thursday.",
      "All good now, sorry about that everyone!",
      "It was the payment vendor, nothing we could do.",
  ], answer=1,
  explanation="A strong resolution update confirms recovery with a timestamp, states the cause and the fix, lists concrete follow-ups, and schedules the postmortem. 'Fixed' leaves stakeholders unsure it's really over, and deflecting blame skips the learning.",
  why_confusing=None,
  stronger_alternative="Recovery confirmed + cause + fix + follow-ups + postmortem time.")

q(topic="Incident and Escalation Communication", type="single", level="Advanced", role="Manager",
  format="scenario",
  prompt="You're the incident commander. An engineer keeps posting deep technical theories in the main stakeholder channel, confusing execs. What do you do?",
  options=[
      "Let it continue; more information is always better.",
      "Redirect gently: 'Let's keep deep debugging in the #incident-eng channel; I'll post plain-language status here every 15 min. Execs — next update at 15:30.'",
      "Publicly tell the engineer to stop cluttering the channel.",
      "Delete their messages.",
  ], answer=1,
  explanation="Separate the working channel (deep technical) from the stakeholder channel (plain status on a cadence). Redirect the flow without shaming the engineer. Letting everything mix confuses decision-makers; public rebukes hurt morale mid-crisis.",
  why_confusing=None,
  stronger_alternative="Two channels: technical working room + cadenced plain-language stakeholder updates.")

q(topic="Incident and Escalation Communication", type="open", level="Intermediate", role="Individual Contributor",
  format="scenario",
  prompt="Write a clear, calm escalation message to your manager for a situation you can't resolve at your level: the vendor's API has been down for two hours, it's blocking tomorrow's launch, and vendor support isn't responding. (3–5 sentences.)",
  model_answer="Flagging an escalation on tomorrow's launch. The payments vendor's API has been fully down since 13:00, which blocks our final integration test — we can't certify the launch without it. I've opened a Sev-1 ticket with the vendor and pinged our account rep twice with no response in two hours. I need help either getting an exec-level contact at the vendor, or making a call on whether we delay the launch. My recommendation: give the vendor until 5pm, then decide on a 24-hour slip if it's still down.",
  key_points=[
      "States it's an escalation and names the stakes (the launch)",
      "Gives the facts: what's down, since when, the impact",
      "Shows what you've already tried",
      "Makes a specific ask (exec contact OR a delay decision)",
      "Offers a recommendation with a decision deadline",
  ],
  explanation="A good escalation is calm and structured: the stakes, the facts, what you've tried, the specific help needed, and a recommended decision with a deadline. It turns 'I'm stuck' into an easy decision for your manager.",
  say_it_naturally="Stakes, facts, what I tried, what I need, and my recommendation with a deadline.")

# ── Module 10 · Cross-Cultural Communication ────────────────────────────────
q(topic="Cross-Cultural Communication", type="single", level="Beginner", role="Individual Contributor",
  format="mc",
  prompt="In a global chat, you want to propose a meeting time. Which message is clearest?",
  options=[
      "Let's meet at 3.",
      "Can we meet tomorrow at 3pm IST / 10:30am CET / 1:30am PT? If that's bad for anyone (esp. the US), suggest another slot and I'll rework it.",
      "Meet at my usual time.",
      "Sometime tomorrow afternoon works.",
  ], answer=1,
  explanation="Across time zones, always specify the zone (ideally several) and acknowledge who's most inconvenienced. A bare '3' or 'my usual time' assumes a shared clock that a distributed team doesn't have.",
  why_confusing="'3pm' with no time zone is ambiguous and silently disadvantages remote regions.",
  stronger_alternative="Give the time in each region's zone and flag who it burdens.")

q(topic="Cross-Cultural Communication", type="single", level="Advanced", role="Technical Leader",
  format="scenario",
  prompt="A colleague from a more hierarchical culture won't openly disagree with you in meetings, even when you sense they have concerns. How do you draw them out respectfully?",
  options=[
      "Call on them publicly to disagree with you on the spot.",
      "Create low-pressure channels: ask for input in writing before the meeting, talk 1:1, and explicitly invite concerns ('I really want the risks — what worries you about this?').",
      "Assume their silence means agreement.",
      "Tell them they need to be more assertive like everyone else.",
  ], answer=1,
  explanation="Adapt the channel rather than demanding they change their style on the spot. Written pre-input, private conversations, and explicit invitations for dissent make it safe to contribute. Public spotlighting can be mortifying; assuming agreement loses real signal.",
  why_confusing=None,
  stronger_alternative="Offer written and 1:1 channels and explicitly invite concerns; don't spotlight.")

q(topic="Cross-Cultural Communication", type="single", level="Intermediate", role="Manager",
  format="mc",
  prompt="Which written practice best prevents cross-cultural and cross-timezone misunderstandings on decisions?",
  options=[
      "Decide verbally in a call and assume everyone remembers.",
      "Write the decision, the reasoning, and who owns what in a shared doc, and ask people to confirm or comment async by a deadline.",
      "Rely on hallway conversations to spread decisions.",
      "Let whoever was loudest in the meeting summarize it later.",
  ], answer=1,
  explanation="Writing decisions down with reasoning, owners, and an async confirmation window gives everyone — regardless of time zone, language, or meeting style — an equal, durable chance to align and object. Verbal-only decisions favor whoever was in the room and awake.",
  why_confusing=None,
  stronger_alternative="Decision + reasoning + owners in writing, with an async confirm-by date.")

# ── Module 11 · Executive Communication ─────────────────────────────────────
q(topic="Executive Communication", type="single", level="Advanced", role="Technical Leader",
  format="scenario",
  prompt="An exec interrupts your detailed update with 'So what do you actually need from me?' What does this tell you, and how do you respond?",
  options=[
      "They're rude; keep going with your prepared detail.",
      "You buried the ask. Respond: 'One decision: approve the two-hour maintenance window Saturday. Everything else is FYI — happy to go deeper on any part.'",
      "Apologize profusely and end the meeting.",
      "Give them even more detail to be thorough.",
  ], answer=1,
  explanation="The interruption is feedback that you led with detail instead of the decision. Recover immediately by stating the single ask, marking the rest as optional context. Executives think in decisions and asks; give them those first.",
  why_confusing=None,
  stronger_alternative="Snap to the ask: 'One decision needed: X. The rest is FYI.'")

q(topic="Executive Communication", type="open", level="Advanced", role="Manager",
  format="rewrite",
  prompt="An exec asks 'Are we going to hit the Q3 launch?' Rewrite this hedge-filled answer into a crisp, honest executive response:\n\n“Well, it depends on a lot of things, there are some risks, the team is working hard, we've made progress but there's still stuff left, and if a few things go right we might make it but it's hard to say for sure right now.”",
  model_answer="Right now I'd put us at 60% to hit Q3. The single biggest risk is the payments integration, which depends on a vendor we don't control. If that lands by August 15 we make it; if it slips, we're two weeks late. I'll have a firm read by August 10 — and if you can help unblock the vendor relationship, that's the one thing that would move the odds.",
  key_points=[
      "Gives a clear probability instead of hedging",
      "Names the single biggest risk and why",
      "States the concrete condition and the consequence if it fails",
      "Commits to a date for a firm answer",
      "Makes a specific ask for help",
  ],
  explanation="Executives can handle uncertainty — what they can't use is a fog of hedges. Give a calibrated probability, the top risk, the key date, and how they can help. Honest and specific beats vaguely optimistic.",
  why_confusing="A wall of 'it depends' leaves the exec unable to plan or help, and reads as evasive.",
  say_it_naturally="A number, the top risk, the key date, and the one thing you need from them.")

q(topic="Executive Communication", type="single", level="Intermediate", role="Technical Leader",
  format="mc",
  prompt="You want to propose a major investment (a data platform rebuild) to leadership. What framing lands best?",
  options=[
      "Our tech stack is old and I don't like maintaining it.",
      "The current platform causes ~2 failed launches a quarter and 20% of eng time on toil. A rebuild is ~2 quarters and would cut incident time in half and free that 20% — here's the ROI and the phased plan.",
      "Everyone else has migrated to the modern stack already.",
      "It would be really fun and good for the team's skills.",
  ], answer=1,
  explanation="Leadership funds business outcomes, not technical preferences. Frame the investment in impact (failed launches, wasted eng time), cost (time), return (halved incidents, reclaimed capacity), and a phased plan. Preference-, fear-, or fun-based framings don't justify budget.",
  why_confusing=None,
  stronger_alternative="Quantify the current cost, the investment, the return, and phase the plan.")

# ── Module 12 · Listening, Clarifying, and Confirming Understanding ──────────
q(topic="Listening, Clarifying, and Confirming Understanding", type="single", level="Beginner", role="Individual Contributor",
  format="mc",
  prompt="Which response shows active listening in a 1:1?",
  options=[
      "Uh-huh, sure, anyway about my thing…",
      "So what I'm hearing is you're worried the new on-call rotation will burn out the team before the launch — is that the main concern, or is there more?",
      "That's not a real problem.",
      "Let me tell you about when that happened to me…",
  ], answer=1,
  explanation="Active listening means reflecting back the other person's point in your words and checking whether you've got it, before adding your own view. Redirecting to yourself, dismissing, or immediately one-upping all signal you weren't really listening.",
  why_confusing=None,
  stronger_alternative="Reflect their point back and ask if you've understood it fully.")

q(topic="Listening, Clarifying, and Confirming Understanding", type="single", level="Intermediate", role="Individual Contributor",
  format="scenario",
  prompt="A product manager rattles off five requirements quickly. How do you confirm you captured them?",
  options=[
      "Say 'got it' and hope you remembered all five.",
      "'Let me play those back: 1) refund-adjusted revenue, 2) split by region, 3) daily not weekly, 4) exclude test accounts, 5) ready by the 15th. Did I get all five, and which is the top priority if I have to sequence them?'",
      "Ask them to email it instead of listening.",
      "Write it down silently and move on without confirming.",
  ], answer=1,
  explanation="Playing back a list item-by-item catches the one you misheard and surfaces priority for sequencing. 'Got it' after five fast requirements almost guarantees a dropped or garbled item.",
  why_confusing=None,
  stronger_alternative="Read the list back numbered, then ask for the priority order.")

q(topic="Listening, Clarifying, and Confirming Understanding", type="open", level="Intermediate", role="Individual Contributor",
  format="rewrite",
  prompt="You're about to start a week of work off a one-line ticket: 'Improve the ETL reliability.' Write the clarifying message you'd send before writing any code.",
  model_answer="Before I start on 'improve ETL reliability', I want to make sure I aim at the right thing. A few questions: (1) Is this driven by a specific pain — e.g. the nightly job failing, or slow recovery when it does? (2) What does success look like — a target success rate, faster alerts, or fewer manual restarts? (3) Any constraint I should respect (no schema changes, must stay within current cost)? My current assumption is the priority is stopping the silent nightly failures with proper alerting — if that's right I'll start there; if not, point me at the real pain.",
  key_points=[
      "Refuses to guess on a vague ticket before investing a week",
      "Asks about the underlying pain, not just the words",
      "Asks how success will be measured",
      "Asks about constraints",
      "States its own assumption so the reply can just confirm or correct",
  ],
  explanation="Vague tickets are the most expensive thing to guess on. A short clarifying message — especially one that states your assumption so they can just confirm — prevents a week of well-built wrong work.",
  say_it_naturally="Ask what pain, what success looks like, and what constraints — and offer your best guess to react to.")

q(topic="Listening, Clarifying, and Confirming Understanding", type="single", level="Advanced", role="Manager",
  format="mc",
  prompt="'What could go wrong?' — You assign a complex task and the engineer says 'Yep, makes sense, I'll have it Friday' within five seconds. What's the risk and best next move?",
  options=[
      "No risk — fast agreement means they understood.",
      "Risk: too-fast agreement can hide unasked questions. Move: 'Before you go — what's the part you're least sure about, and where do you think it could get tricky?'",
      "Risk: they're overconfident; reassign the task.",
      "Micromanage every step to be safe.",
  ], answer=1,
  explanation="Instant, frictionless agreement on a complex task is a yellow flag — real understanding usually surfaces at least one question or risk. Asking 'what's the trickiest part?' invites the questions they didn't ask and reveals whether the mental model is actually there.",
  why_confusing="Fast 'makes sense' can mean genuine clarity or a reluctance to look unsure — you can't tell without probing.",
  stronger_alternative="Ask what they're least sure about and where it could get tricky.")


# ═════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────
def main():
    seen_topics = {}
    out = []
    for i, item in enumerate(C, start=1):
        item = dict(item)
        item["difficulty"] = LEVEL_TO_DIFF[item["level"]]
        item.setdefault("id", f"comm-{i:03d}")
        # prune None-valued optional fields for a clean file
        item = {k: v for k, v in item.items() if v is not None}
        out.append(item)
        seen_topics[item["topic"]] = seen_topics.get(item["topic"], 0) + 1

    # sanity: every module represented
    missing = [m for m in MODULES if m not in seen_topics]
    if missing:
        raise SystemExit(f"Modules with no questions: {missing}")

    doc = {
        "section": "communication",
        "title": "Workplace English & Communication Skill Check",
        "tagline": "Clear, confident, globally-understood professional English — grammar, interviews, email, standups, feedback, conflict, incidents, and executive comms",
        "duration_minutes": 25,
        "passing_score": 70,
        "quiz_length": 15,
        "modules": MODULES,
        "questions": out,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(out)} communication exercises → {OUT.relative_to(ROOT)}")
    for m in MODULES:
        print(f"  {seen_topics.get(m,0):2d}  {m}")


if __name__ == "__main__":
    main()
