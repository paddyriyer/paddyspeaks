# Uber · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of a marketplace
for ride-hailing, food delivery and freight. Every situation is hypothetical,
and none describes any company's hiring process or the values it assesses.
Answer from your own experience, or say plainly that you have not faced it and
reason it through. Never invent a story.

## UBR-L5-01: Two business units, two trips tables: consolidating after a reorganisation

| | |
|---|---|
| **Template ID** | UBR-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Technical consolidation / competing sources of truth, migration across teams |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "consumers": [40, 120, 300],
  "difference": ["one table counts a trip as completed when the driver ends it, the other only when the fare is finalised", "one table records a batched delivery as one trip, the other as one trip per order", "one table keeps cancelled trips that charged a fee, the other drops every cancelled trip"],
  "gap": ["1.5%", "4%", "7%"],
  "months": [3, 6, 9]
}
```

**Business Scenario.** After a reorganisation, the rides and delivery business units now report to one leader, and your team has been asked to own trip data for both. Each unit built its own trips table years ago. They overlap (some products, such as package deliveries made by ride drivers, were recorded by both units), and they disagree: {{difference}}. Weekly completed-trip counts differ by about {{gap}} between the two for the same cities. {{consumers}} dashboards, models and finance reports read one table or the other, and each unit's data team believes its table is the right one. Leadership wants one trips table within {{months}} months.

**Problem Statement.** Tell me how you would lead the consolidation: how you find out who depends on what, how the definitions are decided and by whom, what the target looks like, how consumers migrate without breaking finance or pricing, what happens to the old tables, and how you keep both data teams engaged when one of them will feel it lost. Then tell me about a real time you consolidated competing sources of truth across teams, or say that you have not and reason it through.

**Constraints.** You do not manage either unit's data team. Finance closes the quarter on one of the tables in seven weeks. Neither table can simply be switched off: some consumers have no owner.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Does leadership have a preferred table? | A: No. They want one answer and have asked you to recommend it.
- Q: Is either definition wrong? | A: Both are defensible for their original purpose. They answer different questions.
- Q: Do you know every consumer? | A: Query logs show readers by account, but many are service accounts with no clear owner.
- Q: Can the target keep both definitions? | A: That is your call. Say what it costs.

**Hints.**
1. Separate the grain question (what one row is) from the definition questions (which rows count as completed). One table can carry both definitions as columns or flags.
2. Make the difference measurable: reconcile the two tables row by row for a few cities and classify every difference.
3. Plan the migration around the consumers that matter most (finance, pricing, payments) and the ones nobody owns.

**Follow-ups.**
1. Your reconciliation shows that {{gap}} difference is mostly one cause, but 0.3% is unexplained. Do you start the migration?
2. One unit's data lead says the new table is "their table with extra steps" and their team stops attending. What do you do?
3. Finance wants nothing to change before the quarter closes. How does your plan respect that without slipping {{months}} months?
4. A third of the consumers have no owner. How do you migrate or retire them safely?
5. In your real example, what did you personally decide, and what would you do differently?

**Follow-up rules.**
- when: big bang, cut over, switch off → ask: On the day you switch, one unowned pricing job reads the old table and fails silently. How would you have found it beforehand?
- when: view, compatibility view, shim → ask: How long does the compatibility view live, and what stops it from becoming a third trips table?
- when: definition, metric, completed → ask: Who has the final say on what "completed" means, and how is that decision recorded so it is not reopened every quarter?
- when: escalate, leadership, sponsor → ask: What exactly would you ask leadership to decide, and what would you decide yourself?
- when: we decided, the team decided, we agreed → ask: What did you personally decide or do?

**Evaluation Criteria.** Evidence first (consumers from query logs and lineage, row-level reconciliation with every difference classified); a target that settles grain and carries both definitions explicitly where both are needed, with named owners and a decision record; a migration plan ordered by consumer criticality with parallel running, compatibility views with an end date, and a freeze around finance close; a plan for unowned consumers (identify, notify, brown-out, retire); both teams given real ownership in the result; measures of progress; real example with measurable outcome and personal contribution, or honestly hypothetical.

## UBR-L5-02: Growing a data platform team from 3 to 12 in two quarters without lowering the bar

| | |
|---|---|
| **Template ID** | UBR-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Team building / hiring quality, onboarding, keeping the system running while growing |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer, software-engineer |

```params
{
  "platform": ["the streaming platform that carries trip and location events", "the batch platform that computes driver and courier earnings inputs", "the feature platform that serves pricing and ETA models"],
  "pages": [10, 20, 35],
  "complication": ["half of the new roles are in an office eight time zones away", "the most senior of the three engineers plans to move teams at the end of the first quarter", "the recruiting team can schedule only two interview loops a week for your roles"]
}
```

**Business Scenario.** You lead a team of three engineers who own {{platform}}. The platform's load has tripled in a year, on-call receives about {{pages}} pages a week, and the three engineers spend most of their time keeping it running. You have approval to grow to twelve engineers within two quarters. There is a complication: {{complication}}. Your manager says the platform cannot have a serious outage during the growth.

**Problem Statement.** Tell me how you would do it: what roles you hire for and in what order, how you design a selection process that tests what the job actually needs and is consistent between interviewers, how you protect the three current engineers' time, how new people get productive and safe on call, and how you know at the end of two quarters that the bar held. Then tell me about a real time you grew a team or brought several people on at once, or say that you have not and reason it through.

**Constraints.** The three current engineers must also interview and onboard. You cannot pause on-call. Any process you design is your own team's; you are not changing any company-wide hiring policy.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Can you hire contractors or borrow engineers? | A: You can borrow one engineer from a neighbouring team for one quarter.
- Q: Do the twelve all have to be senior? | A: No. The mix is yours, within the approved budget.
- Q: What is "the bar"? | A: You define it: what someone must be able to do on this team, and how you will check.
- Q: How long does onboarding take today? | A: Nobody has onboarded anyone for two years. There is no written runbook for most alerts.

**Hints.**
1. Write down what the team must be able to do in six months; derive the roles and their order from it, not from a headcount number.
2. A consistent bar needs written criteria per role, structured exercises close to the work, and interviewers who calibrate against each other.
3. Hiring fast with a team that is drowning in pages fails. Reduce operational load early and make onboarding a product.

**Follow-ups.**
1. In the first month you have four strong candidates for the same role and one interviewer slot a day. What do you do?
2. Interviewers disagree sharply on a candidate. How do you decide, and what does that disagreement tell you about your process?
3. How does a new engineer go from day one to taking on-call alone, and how do you know they are ready?
4. Two quarters in, you have hired ten, not nine. How do you check that the people hired late were held to the same standard as the first?
5. In your real example, what went wrong with a hire or with onboarding, and what did you change?

**Follow-up rules.**
- when: referral, referrals, network → ask: Referrals fill your pipeline quickly. What does that do to the range of backgrounds on the team, and does it matter for this platform?
- when: rubric, scorecard, calibration → ask: Show me two criteria from your rubric for this role, and what a weak and a strong answer look like for each.
- when: senior, seniors, staff → ask: If you hire mostly senior engineers, who does the work that seniors do not want, and how long do they stay?
- when: documentation, runbook, onboarding → ask: Who writes those runbooks while the three engineers are on call and interviewing? What do you stop doing to make room?
- when: we decided, the team decided, we agreed → ask: What did you personally decide or do?

**Evaluation Criteria.** Hiring plan derived from what the platform needs (skills, seniority mix, order of roles, including the complication); a selection process with written criteria, work-sample exercises, trained and calibrated interviewers and a decision rule that resists pressure; operational load reduced early so current engineers can hire and onboard; onboarding treated as a product (runbooks, shadowing, graded on-call); measures that show whether quality held (new-hire ramp time, on-call incidents, peer feedback, attrition); protects the existing team; real example with what went wrong and what changed, or honestly hypothetical.

## UBR-L5-03: Product wants real-time earnings in 4 weeks; the honest estimate is 12

| | |
|---|---|
| **Template ID** | UBR-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Estimation and scope negotiation / correctness of money shown to people, delivery under pressure |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, software-engineer, analytics-engineer |

```params
{
  "audience": ["drivers and couriers in the app", "city operations teams", "drivers and couriers in the app and in a weekly email"],
  "sources": [4, 7, 11],
  "reason": ["a launch event already announced for one region", "a competitor's similar feature that product has seen in the press", "complaints that earnings appear a day late"]
}
```

**Business Scenario.** Product wants a real-time earnings view for {{audience}}: trips and deliveries completed today, fares, tips, incentives earned so far, and the running total for the week. Today earnings appear the next day from a nightly batch that pulls from {{sources}} sources (trips, fare adjustments, tips that arrive hours later, incentive programmes, cancellation fees, support adjustments and more). The product manager has promised it in four weeks because of {{reason}}. Your honest estimate, with the correctness the numbers need, is twelve weeks. You are the technical lead.

**Problem Statement.** Tell me how you would handle it: how you make your estimate credible, what you would propose that could ship in four weeks without showing anyone a wrong number about their own pay, how you negotiate with the product manager and their leadership, and what you do if they insist on the full scope in four weeks. Then tell me about a real time your estimate disagreed sharply with a committed date, or say that you have not and reason it through.

**Constraints.** Numbers about a person's pay must reconcile with their pay statement; a real-time number that is later reduced erodes trust far more than a late one. You cannot add people within the four weeks. The nightly batch remains the source for payouts.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: What makes the estimate twelve weeks? | A: That is what you must explain. Assume the hardest parts are tips and adjustments that arrive late, incentive rules computed only in the batch, and reconciliation with payouts.
- Q: Is the four-week date public? | A: It has been mentioned to the region's partners, not announced publicly.
- Q: Does product know the estimate? | A: They heard "about three months" in a hallway and treated it as padding.
- Q: Who has the authority to change the date? | A: The product manager's director.

**Hints.**
1. Break the estimate into parts with their own uncertainty; show what is known work and what is risk.
2. Look for a first slice that is exact by construction (for example, completed trips and their base fare, labelled "so far today, before tips and adjustments") and a path to the rest.
3. Make the trade-off visible to the person who decides: date, scope and correctness. Never quietly trade correctness away.

**Follow-ups.**
1. Walk me through the twelve weeks: what are the parts, which are risky, and what would make it eight?
2. What exactly would ship in four weeks, what would it be labelled, and how do you know it will not show a number that later goes down?
3. The director says ship the full scope in four weeks and fix it later. What do you say?
4. Week three, the first slice works but the tips feed is two hours late on weekends. Do you launch?
5. In your real example, what did you personally do when the estimate and the date disagreed, and how did it turn out?

**Follow-up rules.**
- when: overtime, crunch, weekends, work harder → ask: How many weeks does overtime actually buy you on this work, and what does it cost in month three?
- when: mvp, phase, slice, phased → ask: Show me the first slice's exact contents and the sentence on screen that tells a driver what is and is not included.
- when: estimate, estimation, story points → ask: Your last two estimates on this team were 40% low. Why should product trust this one?
- when: escalate, director, leadership → ask: What do you put in front of the director, and how do you make sure the product manager is not surprised by it?
- when: we decided, the team decided, we agreed → ask: What did you personally decide or do?

**Evaluation Criteria.** An estimate broken into parts with explicit risks and what would change it; a first slice that is correct by construction and labelled honestly, with a path to the full scope; negotiation that respects the product manager's goals and goes to the decider together, with date, scope and correctness trade-offs visible; refusal to show people wrong numbers about their pay, with reasons; a reconciliation plan with payouts; real example with measurable outcome and personal contribution, or honestly hypothetical.

## UBR-L5-04: A service-account key with warehouse access published in a public repository

| | |
|---|---|
| **Template ID** | UBR-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Security incident leadership / credential exposure, scoping access, blameless follow-through |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "hours": [3, 20, 72],
  "scope": ["read access to the trip and location tables", "read and write access to the analytics schemas, including rider contact tables", "read access to every table the data platform's scheduler can reach"],
  "found_by": ["an automated secret scanner", "an external researcher through the disclosure programme", "an engineer on another team who saw it while browsing"]
}
```

**Business Scenario.** A long-lived key for a service account that your team owns was committed to a public code repository by an engineer on your team, inside a configuration file for a side project. It has been public for {{hours}} hours. The account has {{scope}}. It was reported by {{found_by}}. It is 18:40 on a Friday. You are the most senior engineer on the team; the security team has an on-call engineer, and privacy and legal have on-call contacts.

**Problem Statement.** Tell me how you would lead your part of the response in the first hour, the first day and the following weeks. Cover containment, establishing whether the key was used and what was read, working with security, privacy and legal, what happens to the jobs that use that account, how you treat the engineer who committed it, and what you change so a key like this cannot leak or cannot matter if it does. Then tell me about a real security or data-exposure incident you were involved in, or say that you have not and reason it through.

**Constraints.** You do not decide whether people or regulators are notified; privacy and legal do, using your facts. Fourteen scheduled jobs, including the nightly earnings inputs, run as that service account. Access logs on the warehouse are kept for 30 days.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Has anyone used the key? | A: Unknown when you are paged.
- Q: Can the key simply be revoked? | A: Yes, but the fourteen jobs fail until they have a new credential.
- Q: Has the commit been removed? | A: The engineer deleted the file in a new commit ten minutes ago; the key is still in the repository's history and may have been copied.
- Q: Is the engineer still online? | A: Yes, and visibly upset.

**Hints.**
1. Revoke first. A published key is compromised whether or not anyone used it; deleting the commit does not undo the leak.
2. The question privacy and legal need answered is "what was accessed, by whom, from where", from logs, not from guesses.
3. Ask why a single long-lived key could read so much, and why it could be copied into a file at all.

**Follow-ups.**
1. Revoking the key will make the nightly earnings inputs fail tonight. Do you revoke now or after the run? Who decides?
2. The warehouse logs show three queries from an unfamiliar address two hours after the commit. What do you do with that?
3. What do you say to the engineer who committed the key, tonight and next week?
4. The review finds 40 other long-lived keys across the data platform. How do you get rid of them without breaking everything?
5. In your real example, what did you personally do, and what changed afterwards?

**Follow-up rules.**
- when: rotate, rotation, revoke → ask: Fourteen jobs use that account. Walk me through how they get a new credential tonight without anyone pasting it somewhere new.
- when: logs, audit log, access logs → ask: The logs show queries by the service account from its usual job hosts and from one unknown address. How do you tell the jobs' queries apart from an attacker's using the same key?
- when: blame, fire, disciplinary, mistake → ask: What does the rest of the team learn about reporting their own mistakes from how you handle this?
- when: secret scanning, pre-commit, scanner → ask: Scanning catches known key formats. What about a credential that does not look like one, and what makes a leak harmless even when scanning misses it?
- when: we decided, the team decided, we agreed → ask: What did you personally decide or do?

**Evaluation Criteria.** Immediate containment (revoke the key, accept and manage the job failures, issue a scoped replacement through a secret manager) with security involved from the first minutes; evidence-based scoping from access logs (which tables, rows, times, source addresses), preserved for investigation, distinguishing the jobs' normal use from anything else; clear, factual handoff to privacy and legal, who decide on notification; a blameless approach to the engineer that still fixes the conditions; prevention that removes long-lived keys (short-lived credentials, workload identity, least privilege, secret scanning in commits) and limits blast radius; a plan for the other keys; real example with personal contribution, or honestly hypothetical.

## UBR-L5-05: Project deep dive, re-examined for a real-time, city-by-city marketplace

| | |
|---|---|
| **Template ID** | UBR-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, real-time and per-city operation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer |

```params
{
  "angle": ["the data model and how it handled change", "the hardest correctness problem you solved", "the biggest latency or cost decision"],
  "freshness": ["30 seconds", "5 minutes"],
  "city_feature": ["rules that differ by city and change every week", "every city's day and week in its own time zone", "a city that keeps working when its region is cut off"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change to serve a real-time marketplace operating city by city, where its outputs must be at most {{freshness}} old and where it must handle {{city_feature}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes if its outputs had to be at most {{freshness}} old and it had to handle {{city_feature}}. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The marketplace setting is hypothetical.

**Clarifications.**
- Q: Does it have to be a streaming system? | A: No. A batch system is fine; the second half asks what would change.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to schemas, keys, failure modes and numbers.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the real-time question, name the first part of your system that cannot meet {{freshness}} and why.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. Which part of your system cannot produce outputs within {{freshness}}, and what would you change first?
4. How would you add {{city_feature}} without a rewrite?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: kafka, flink, spark, airflow, snowflake, bigquery → ask: Why that over the obvious alternative, and what did it cost you?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?
- when: batch, nightly, daily → ask: Which outputs of that batch would actually be worth having within {{freshness}}, and which would not? How do you decide?
- when: city, cities, region, regions → ask: One city is a hundred times larger than the median. Where does that show up in your design: partitioning, compute or the people who operate it?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to keys, schemas and failure modes; decisions explained with the alternatives and evidence; honest account of what broke and what changed; a credible freshness analysis that names the first part that cannot keep up and an incremental change for it; a concrete path to the city feature; own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
