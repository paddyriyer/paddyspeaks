# Together AI · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of a cloud that
fine-tunes and serves open models. Every situation, customer, model, date and
figure is hypothetical; nothing here describes the company's customers, hardware,
capacity or internal systems, and none of it describes any company's hiring
process or the values it assesses. Answer from your own experience, or say plainly
that you have not faced it and reason it through. Never invent a story.

## TGA-L5-01: A licence change to a popular open model that customers already serve in production

| | |
|---|---|
| **Template ID** | TGA-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Acting under uncertainty / decision rights, impact evidence, customer communication without legal conclusions |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ml-platform-engineer, ai-infra-engineer |

```params
{
  "share": ["8%", "20%", "35%"],
  "tenants": ["150", "900", "3,000"],
  "change": ["new terms that restrict some commercial uses above a stated size", "new terms that add attribution and notice requirements for derived models", "new terms that apply to future versions only, while earlier versions keep their old terms"],
  "days": [10, 30, 60]
}
```

**Business Scenario.** A popular open model family carries {{share}} of serverless traffic on the platform, and {{tenants}} tenants call it, fine-tune it or serve adapters on it. Its publisher announces {{change}}, taking effect in {{days}} days. Customers start asking support what this means for them, account teams want answers to give, and someone in a channel suggests switching every alias to a different model family tonight. You lead the team that owns the model catalogue and the usage data. Legal owns the interpretation of the terms; product owns what the platform offers.

**Problem Statement.** What do you do? Cover what you establish first and who you involve; the facts your team can supply (which tenants use which versions, through which paths: serverless, dedicated endpoints, fine-tunes, adapters) and how you supply them without exposing one tenant to another; what you say, and refuse to say, to customers and account teams before legal has concluded; the technical options you prepare (keeping earlier versions available if the owners decide so, a named alternative, help to migrate fine-tunes) and how you check each one; and how you avoid a rushed change that breaks customers. Then tell me about a real time an outside change you did not control forced a decision about something already in production, or say that you have not and reason it through.

**Constraints.** You draw no legal conclusions and do not let anyone on your team draw them; the meaning of the terms is legal's to state. Customers' own obligations are theirs and their advisers'; the platform does not advise them. Every customer, figure and date is hypothetical.

**Assumptions.** The model, the terms and the timeline are hypothetical, as are the platform's possible responses.

**Clarifications.**
- Q: How long will legal take? | A: They expect a first view within a week; they have asked for usage facts from you today.
- Q: Can we tell customers what we think the terms mean? | A: No. You can tell them what the publisher announced, link to it, say that the platform is reviewing it, and say when you will update them.
- Q: Is switching aliases tonight possible? | A: Technically, yes. Nobody has decided it, and some tenants call the alias in production.
- Q: Do we know which tenants fine-tuned this family? | A: Yes, from job metadata: base model and version per job, never the data.

**Hints.**
1. Separate three questions with three owners: what the terms mean (legal), what the platform offers (product), what each customer does (the customer).
2. Your team's contribution is precise facts fast: an inventory by tenant, version and path, scoped so each audience sees only what it needs.
3. A change made in a hurry to production aliases can do more harm than the thing it reacts to; prepare options, do not execute them.

**Follow-ups.**
1. What does your first message to account teams say, and what does it deliberately not say?
2. Legal asks which tenants are affected. What exactly do you give them, and how do you keep it accurate as usage changes?
3. Someone senior wants the alias switched tonight "to be safe". How do you respond?
4. Legal concludes that earlier versions are unaffected. What changes in the catalogue, in notices and in your data?
5. In your real example, what decision was made, by whom, and what did you contribute to it?

**Follow-up rules.**
- when: interpret, interpretation, we think, my reading → ask: You are not the owner of that interpretation. What happens if a customer acts on what you said and legal later concludes differently?
- when: switch, migrate everyone, tonight, immediately → ask: Some tenants call the alias in production with prompts tuned for this model. Who decided to change their outputs, and how did they learn about it?
- when: email all, notify everyone, announcement → ask: What exactly does the message say before legal has concluded, and what does a customer do with it?
- when: dashboard, inventory, report → ask: Account teams can see that report. How do you make sure each one sees only their own customers?
- when: we decided, the team decided, we agreed → ask: What did you personally decide or recommend, and to whom?

**Evaluation Criteria.** Separates interpretation (legal), platform response (product) and customer obligations (customers) and keeps to their own role; supplies precise usage facts quickly by tenant, version and path, scoped per audience; communicates early what is known (the announcement, the review, the next update date) without legal conclusions; resists a rushed production change and prepares checked options instead; plans for each plausible decision, including keeping earlier versions; follows through with notices and migration support once owners decide; real example with personal contribution and outcome, or honestly hypothetical.

## TGA-L5-02: Helping a customer whose fine-tune fails when you may not look at their data

| | |
|---|---|
| **Template ID** | TGA-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Customer problem solving under constraints / diagnosis from metadata, reproducing with synthetic data, trust |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, software-engineer, ml-platform-engineer, ai-infra-engineer |

```params
{
  "failure": ["the training loss becomes NaN after a few hundred steps", "the fine-tuned model mostly repeats its prompt back", "the job passes validation and then fails with out-of-memory at a particular step", "the fine-tuned model is no better than the base model on the customer's own checks"],
  "deadline_days": [2, 5, 10],
  "attempts": [3, 5, 8]
}
```

**Business Scenario.** A customer has run {{attempts}} fine-tuning jobs on the same base model and each time {{failure}}. They have a launch in {{deadline_days}} days and are frustrated; their message to support says "just look at our data and tell us what is wrong". By this exercise's rule (check current docs), no one at the platform reads a customer's dataset: the only processing of its contents is the validation the customer asked for and the training itself. You lead the team that owns the fine-tuning pipeline, and support has asked you to help.

**Problem Statement.** What do you do? Cover what you can learn without reading the data (job configs, validation results such as counts, lengths and error codes, training metrics, logs that carry no content); how you form and test hypotheses, for example by reproducing the failure with synthetic data of the same shape; what you can offer the customer so they can inspect their own data (tools, extra checks that report counts only, guidance); how you explain the rule to them without hiding behind it; what you do if the cause turns out to be the platform's; and how you handle the deadline. Then tell me about a real time you helped someone fix a problem in data or a system you were not allowed to see, or say that you have not and reason it through.

**Constraints.** You never read the dataset, ask for it to be sent outside the documented process, or make an exception "just this once". Extra checks run only if the customer asks for them and report counts, line numbers and codes, not content. Every figure here is hypothetical.

**Assumptions.** The customer, base model and failure are hypothetical. The pipeline's validation results and training metrics are available to you for this job.

**Clarifications.**
- Q: Can the customer share a few examples with us? | A: Only through the documented process, if one exists, and only by their explicit choice; assume for this scenario that there is none and you cannot create one this week.
- Q: Have other customers seen the same failure? | A: You do not know yet; you can look at aggregate job outcomes for the same base model and configuration.
- Q: Is the support engineer on the customer's side or ours? | A: Both; they want to help and are under pressure to make an exception.
- Q: Can you change the pipeline for this customer? | A: Only changes that would apply to every customer.

**Hints.**
1. Write down what each hypothesis predicts about the metadata you can see (length distributions, token counts, the step of failure, learning rate, method), then check.
2. A synthetic dataset with the same counts, lengths and structure reproduces many failures without any real content.
3. Give the customer a way to find the problem in their own data, with a precise description of what to look for.

**Follow-ups.**
1. Which three hypotheses would you check first for {{failure}}, and what in the metadata would confirm or rule out each?
2. The support engineer suggests opening the dataset "only to look at the first ten lines". What do you say?
3. You reproduce the failure with synthetic data. What do you tell the customer, and what do you ask them to check?
4. The cause turns out to be a platform default that is wrong for long sequences. What changes for this customer and for everyone else?
5. In your real example, how did you work out the problem without seeing what you were not allowed to see?

**Follow-up rules.**
- when: exception, just this once, ten lines, quick look → ask: The rule exists for every customer. What does it mean for the next customer, and for this one, if you make an exception today?
- when: synthetic, same shape, reproduce → ask: Which properties of their data does your synthetic set copy, and which can't it copy without reading their data?
- when: learning rate, batch size, hyperparameter → ask: Which of those did the customer choose, which did the platform default, and how did you tell?
- when: escalate, manager, leadership → ask: What decision do you need from the person you escalate to?
- when: we fixed, the team fixed, we found → ask: What did you personally find or do?

**Evaluation Criteria.** Keeps the rule without hiding behind it and explains it to the customer and to support; diagnoses systematically from metadata with explicit hypotheses and predictions; reproduces with synthetic data of the same shape; equips the customer to inspect their own data precisely; checks whether the cause is the platform's and, if so, fixes it for everyone and says so; manages the deadline with honest options; real example with personal contribution and outcome, or honestly hypothetical.

## TGA-L5-03: Deciding which of many newly released open models to support first

| | |
|---|---|
| **Template ID** | TGA-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Prioritisation under scarce capacity / demand evidence, cost to serve, saying no, revisiting decisions |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ml-platform-engineer, ai-infra-engineer, analytics-engineer |

```params
{
  "releases": [6, 10, 15],
  "capacity": [2, 3, 4],
  "pressure": ["a large customer who says they will leave without one particular model", "a competitor that announced support for three of them the same day", "a researcher on your own team who is excited about a small model nobody has asked for"]
}
```

**Business Scenario.** In one month, {{releases}} new open models are released by different publishers. Your team can onboard about {{capacity}} of them properly in that month (conversion, acceptance checks, performance work, pricing and documentation), and each one added also costs serving capacity and on-call attention. Signals pull in different directions, including {{pressure}}. Product leadership owns the catalogue and asks you for a recommendation with evidence by the end of the week.

**Problem Statement.** How do you decide? Cover the evidence you would gather (demand signals from tenants, expected traffic and cost to serve, effort to onboard, overlap with models already in the catalogue, licence status as recorded by the owners who review it, the publisher's track record of revisions), how you weigh it, how you present the recommendation and its uncertainty, how you treat {{pressure}}, what you tell the people whose model is not chosen, and how and when you revisit the decision. Then tell me about a real time you had to choose a few things to do from many reasonable ones, or say that you have not and reason it through.

**Constraints.** You cannot onboard more than about {{capacity}} properly this month; a rushed onboarding that skips acceptance checks is not an option. Licence questions are reviewed by legal and product owners; you only record their status. Every figure is hypothetical.

**Assumptions.** The models, publishers, customers and figures are hypothetical.

**Clarifications.**
- Q: Do we have demand data? | A: Some: requests for unknown model names in the API, support tickets, waitlist sign-ups and account team notes. All are noisy.
- Q: Can we add a model in a limited preview? | A: Yes, with clear labelling, if product agrees; it still takes onboarding effort.
- Q: How costly is a model nobody uses? | A: It takes serving capacity, testing on every platform change and a later deprecation.
- Q: Is the large customer's claim verified? | A: It came through their account team; you do not know their volume on that model.

**Hints.**
1. Turn noisy signals into a comparable estimate per model, with ranges, and say which signal you trust least.
2. Count the long-term cost of adding a model, not only the onboarding effort.
3. Decide in advance what new evidence would change the choice, and when you will look.

**Follow-ups.**
1. What would your one-page recommendation look like, and what goes in its first three lines?
2. How do you treat {{pressure}} in the decision, without either ignoring it or letting it decide alone?
3. Two models are close on every measure. How do you break the tie?
4. A month later, one model you skipped has become very popular. What do you do, and what do you learn?
5. In your real example, what did you decide not to do, and how did the people who wanted it react?

**Follow-up rules.**
- when: score, scoring, weighted → ask: Who chose the weights, and would the ranking change if a reasonable colleague chose different ones?
- when: customer asked, biggest customer, largest customer → ask: How do you know how much traffic that customer would actually send, and what would you need to see before trusting it?
- when: competitor, competitors → ask: What evidence do you have that tenants choose a platform for that, rather than for something else?
- when: all of them, everything, do more → ask: Your team can do {{capacity}} properly. What gets worse if you try to do more?
- when: we prioritised, the team prioritised, we chose → ask: What did you personally recommend, and what did the decider change?

**Evaluation Criteria.** Gathers comparable evidence with stated uncertainty and the least reliable signal named; counts long-term cost to serve and maintain, not only onboarding; presents a clear recommendation with ranges and the decision owner's role respected; treats pressure on its evidence; communicates no-for-now decisions with reasons and a revisit date; sets triggers to revisit and learns from misses; real example with what was declined and how it landed, or honestly hypothetical.

## TGA-L5-04: Telling customers they are paying for idle capacity, when that lowers revenue

| | |
|---|---|
| **Template ID** | TGA-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Integrity and long-term trust / customer-facing transparency, stakeholder alignment, revenue trade-offs |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer |

```params
{
  "idle_share": ["35%", "50%", "70%"],
  "revenue": ["2%", "5%", "9%"],
  "objection": ["a sales leader worried about the quarter", "a finance partner who says customers chose their own settings", "a product manager who wants to ship it only as an opt-in report"]
}
```

**Business Scenario.** Your team built the data behind dedicated endpoint billing. Analysis shows that across customers about {{idle_share}} of billed replica-minutes had no requests in flight: endpoints kept at a minimum higher than their traffic needed, replicas left running after tests, and scale-down settings that rarely trigger. You propose an idle view in the console with recommendations, and a monthly notice for endpoints idle most of the time. Finance estimates that if customers act on it, revenue from dedicated endpoints falls by about {{revenue}} over the next year. The strongest objection comes from {{objection}}.

**Problem Statement.** What do you do? Cover how you make sure the analysis is right before arguing from it; how you frame the decision for the people who own it, including the long-term case (trust, retention, customers who would otherwise leave quietly) alongside the short-term revenue; how you address {{objection}} on its merits; what you would accept as a compromise and what you would not; how the feature is built so its numbers match the invoice; and how you would measure the result. Then tell me about a real time you argued for something right for customers that cost your organisation something, or say that you have not and reason it through.

**Constraints.** You do not own pricing or the decision to ship; product and the business owners do. Everything you show customers must match the invoice minute for minute. Every figure is hypothetical.

**Assumptions.** The analysis, revenue estimate and stakeholders are hypothetical.

**Clarifications.**
- Q: Are customers being billed wrongly? | A: No. They are billed correctly under the rules for what they ran.
- Q: Have customers complained? | A: A few have, after finding idle endpoints themselves; some of them moved workloads elsewhere.
- Q: Could the analysis overstate idle time? | A: Possibly: an endpoint kept warm for latency may be idle by your measure and still worth it to the customer.
- Q: Who decides? | A: The product owner, with the business owner for dedicated endpoints.

**Hints.**
1. Check the idle measure against cases where idle capacity is deliberate, and say how the view treats them.
2. Put long-term and short-term effects in the same units where you can, and state what you cannot quantify.
3. A good compromise changes how it ships, not whether customers can find the truth about their own bill.

**Follow-ups.**
1. How do you check that {{idle_share}} is right, and what would make you lower it?
2. How do you answer {{objection}} without dismissing it?
3. The decision is to ship only an opt-in report. Do you accept it, and what do you do next?
4. How would you know a year later whether the feature helped or hurt the business?
5. In your real example, what did it cost, who decided, and what happened afterwards?

**Follow-up rules.**
- when: revenue, quarter, quota → ask: Put a number on what happens to retention if customers find the idle cost themselves. How sure are you of it?
- when: opt-in, opt in, optional → ask: Who finds an opt-in report, and are they the customers who most need it?
- when: warm, latency, deliberate → ask: How does your view tell a deliberately warm endpoint from a forgotten one, and what does it recommend for each?
- when: escalate, go around, executive → ask: What do you bring, to whom, and how do you keep working with the people who disagreed?
- when: we argued, the team argued, we convinced → ask: What did you personally say, and to whom?

**Evaluation Criteria.** Verifies the analysis, including deliberate idle capacity, before arguing from it; frames a long-term versus short-term decision honestly with uncertainty, for the people who own it; engages the objection on its merits; distinguishes acceptable compromises (how it ships) from unacceptable ones (customers kept from facts about their own bill); builds numbers that tie to the invoice; defines how success is measured; respects the decision while making disagreement visible through the right channel; real example with cost, decider and outcome, or honestly hypothetical.

## TGA-L5-05: Project deep dive, re-examined for a cloud that fine-tunes and serves open models

| | |
|---|---|
| **Template ID** | TGA-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, metering per tenant, artefact lifecycle and model versions |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer, ai-infra-engineer |

```params
{
  "angle": ["the data model and the keys", "the hardest failure you diagnosed in it", "the decision you would most like to undo"],
  "requirement": ["usage metered per tenant and model version that matches the invoice exactly", "each customer's datasets and checkpoints deleted in every copy, with a receipt", "per-tenant latency that stays honest for tenants with few requests", "every request traceable to the exact model version and adapter that served it"],
  "scale": ["hundreds of open models and thousands of model versions", "tens of thousands of tenants", "billions of inference requests a day"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change for a cloud that fine-tunes and serves open models, at a scale of {{scale}}, with {{requirement}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes at a scale of {{scale}}, with {{requirement}}. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The open-model cloud setting is hypothetical.

**Clarifications.**
- Q: Does it have to be an ML or inference system? | A: No. Any system that moved, stored or computed data others depended on; the re-examination is where we bring it into this domain.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to keys, schemas, failure modes and numbers.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the re-examination, start from one inference request or one uploaded dataset: which ids and timestamps it carries, where copies of it end up, and which of them the new requirement constrains.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. Which parts of your design would not survive a scale of {{scale}}? What breaks first?
4. How would you provide {{requirement}} without a rewrite?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?
- when: model name, latest, alias → ask: A request says only the model's family name. How does your record show the exact version that served it a month later?
- when: delete, deletion, gdpr, retention → ask: Where do copies of one customer's data end up in your system, including caches and backups, and how would you prove they are all gone?
- when: average, p95, p99 → ask: One tenant sent 14 requests yesterday. What latency figure does your system show them, and is it honest?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to keys, schemas and failure modes; decisions explained with alternatives and evidence; honest account of what broke and what changed; a credible re-examination that names the assumptions that would not survive the scale and addresses {{requirement}} incrementally (for example idempotent usage keyed by request id with versioned prices and one rounding step tied to the invoice; an inventory of every copy with per-artefact keys and verified receipts; mergeable sketches with a low-volume floor; immutable model and adapter version ids resolved on every request); own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
