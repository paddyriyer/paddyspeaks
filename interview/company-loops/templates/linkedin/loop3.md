# LinkedIn · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of a professional
network: member profiles and skills, connections, jobs and applications, recruiter
search and messaging, company pages and learning. Every workload, number, schema,
policy and incident is hypothetical, and member data is treated as personal data
throughout. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## LNK-L3-01: Member profile history — what a profile said on a date, with edits and deletions honoured

| | |
|---|---|
| **Template ID** | LNK-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / bitemporal profile entries, valid time versus recorded time, erasure in versioned stores |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "members": {"1": ["40 million"], "2": ["300 million"], "3": ["1 billion"]},
  "daily_edits": ["3 million", "10 million", "25 million"],
  "erase_days": [7, 30],
  "history_days": [365, 730]
}
```

**Business Scenario.** A professional network holds about {{members}} member profiles. A profile has a headline, a location, positions (title, a linked company page or free-text company name, start and end month, description), education entries and skills. Members make about {{daily_edits}} edits a day: they add a position that started years ago, correct a start month, change a title, delete an entry, hide a section, or close their account. Several readers need the profile at a point in time: the member's own "edit history" page, job-application records that keep the profile as it was submitted, a matching model that is trained elsewhere and needs features as of each application date (a scoring function you are given; this design only supplies point-in-time inputs), and aggregate reports such as "members listing a skill, by region and month". In this exercise's policy (check current docs for any real product), prior versions of an edited entry are kept for {{history_days}} days; a deleted entry, or every entry of a closed account, is removed from every store, including derived tables, within {{erase_days}} days.

**Problem Statement.** Design the data model for profile history. Cover: the member and each kind of profile entry, with stable entry ids that survive edits; how versions are stored so that two different questions can both be answered — "what did this profile say at time T" (recorded time) and "where did this member work in month M, as we know it now" (valid time); section visibility and how readers respect it; what an application stores so the employer sees exactly what was submitted; how point-in-time features are produced without leaking later edits; and how a deletion or account closure removes every version within {{erase_days}} days from the versioned store, snapshots, derived tables and caches. Define the tables and grains for "members listing skill S by region and month" and say which published numbers change after a deletion.

**Constraints.** An edit never overwrites: prior versions are kept for {{history_days}} days. Readers other than the member see only sections visible to them under the member's settings at the time of reading. Erasure within {{erase_days}} days is complete, including derived copies. Aggregate reports publish a cell only when it covers at least a minimum number of members. No protected trait (age, gender, ethnicity, health, religion, disability) is inferred from profile content, for any reader.

**Assumptions.** Member counts, edit rates and both retention periods are hypothetical, and the policy is this exercise's own. Positions carry month precision; edits carry a server timestamp. An application is a separate product record that the member chose to send; what it keeps is part of that record, under its own retention rule.

**Clarifications.**
- Q: Can a member add a position that started before they joined the network? | A: Yes. Valid time (when the job was held) is often years before recorded time (when the entry was written).
- Q: What does deleting an entry mean for its history? | A: Every version of that entry disappears from every store within {{erase_days}} days, including its past versions in the edit history. Hiding a section is different: the data stays, readers stop seeing it.
- Q: Does an application keep the profile the member sent? | A: Yes, as part of the application record, and the employer sees that copy. It follows the application's retention, not the profile's.
- Q: Do aggregate reports already published need to be recomputed after a deletion? | A: In this exercise, published cells that met the minimum-member threshold stay as published; every later computation excludes the deleted data.
- Q: Can two edits of the same entry arrive out of order? | A: Yes. Mobile clients retry, so an older edit can arrive after a newer one.

**Hints.**
1. Give every entry its own id and store versions of it, not versions of the whole profile.
2. Each version needs two time ranges: when it was true (start and end month) and when the system held it (recorded_from, recorded_to).
3. Erasure is easiest when every derived store is keyed so that "all rows of this entry or member" can be found and removed, or made unreadable, in one step.

**Follow-ups.**
1. Show the version rows for one position: added today with a start month three years ago, title corrected next week, then deleted. What does each reader see before and after the deletion?
2. The matching model needs features "as of each application date". Write the shape of the point-in-time join, and say which time range it filters on.
3. Your history lives in immutable columnar files. How do you erase one member's entries within {{erase_days}} days without rewriting the whole table every day?
4. "Members listing skill S by region and month": define the grain and say what happens to next month's number and to last month's published number when 2% of those members delete the skill.
5. At {{daily_edits}} edits a day, compare entry versions with a daily full-profile snapshot on storage, on point-in-time reads and on erasure cost.

**Follow-up rules.**
- when: snapshot, daily snapshot, full profile → ask: At {{members}} profiles, how many copies of an unchanged headline does a daily snapshot keep in {{history_days}} days, and how many files must you rewrite to erase one member?
- when: scd2, type 2, valid_from, effective date → ask: Is valid_from the start month of the job or the moment the member typed it? A member adds a 2019 position today: what does "profile as of last month" return?
- when: soft delete, is_deleted, deleted flag → ask: The flag is set, but who can still read the row, in which copies, and on which day is it actually gone?
- when: json, document, blob → ask: How do you answer "members who added skill S in month M" without parsing every version of every profile?
- when: last write wins, updated_at, latest timestamp → ask: An older edit arrives after a newer one because the phone retried. Which timestamp orders the versions, and what does the member's edit history show?

**Production Reality Check.**
- A member closed their account, and {{erase_days}} days later their former headline still appears in a point-in-time training extract: the extract was materialised from a monthly snapshot the erasure job did not know about.
- A bulk import from a résumé upload wrote every position with the upload month as its start month; "positions started this month" jumped tenfold and a hiring-trends chart went out before anyone noticed.
- Retried edits from a mobile client arrived out of order, and ordering versions by arrival time made an old title current again for thousands of members, some of whom had applied to jobs with the wrong title shown.

**Evaluation Criteria.** Entry-level versions with stable ids; valid time and recorded time kept separate and used correctly in the two example questions; visibility applied at read time; application copies kept as part of the application record; point-in-time features filtered on recorded time; an erasure path that reaches snapshots, derived tables and caches within {{erase_days}} days (per-member keys, delete vectors or crypto-shredding); aggregate grain, minimum-member threshold and restatement policy stated; no inferred protected traits; each incident contained, corrected and guarded.

## LNK-L3-02: Job postings and applications — reposts, closures, status changes and what the applicant is shown

| | |
|---|---|
| **Template ID** | LNK-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / posting identity across reposts, application status history, employer stages mapped to applicant-visible states |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "daily_postings": {"1": ["150 thousand"], "2": ["800 thousand"], "3": ["3 million"]},
  "daily_applications": ["4 million", "12 million"],
  "auto_close_days": [30, 60, 90],
  "ats_share": ["30%", "55%"]
}
```

**Business Scenario.** Employers publish about {{daily_postings}} job postings a day on a professional network, some typed in directly and about {{ats_share}} sent from employers' applicant tracking systems through a feed. A posting can be edited (title, location, workplace type, salary range), closed by the poster, closed automatically after {{auto_close_days}} days, reopened, or reposted as a new posting for the same opening. Members submit about {{daily_applications}} applications a day: either on the platform, where the application and its later status are recorded, or on the employer's own site, where the platform only knows that the member clicked through. Employers move on-platform applicants through their own pipeline stages, which differ by employer. The applicant sees a short list of statuses — submitted, viewed by the employer, no longer accepting applications, not selected — and in this exercise's rule an applicant is shown "not selected" only when the employer chose to send that status.

**Problem Statement.** Design the data model. Cover: postings and their versions (what the posting said when each member applied); an opening identity that links reposts of the same role, and how it is assigned when the employer provides a requisition id and when it does not; closures and reopenings; applications and their status history; the mapping from each employer's stages to the applicant-visible statuses, and a record of what the applicant was actually shown and when; off-site click-throughs kept separate from applications. Define facts for "applications per posting and day", "time from application to first employer view", "share of applicants who received any status after submission" and "openings reposted more than twice in 90 days".

**Constraints.** Status history is append-only. An applicant never sees an employer's internal stage name, notes or ranking. Salary ranges are shown as the posting stated them at the time of applying. Off-site click-throughs are never counted as applications. A closed posting accepts no new applications, and its existing applications keep their history.

**Assumptions.** Volumes, shares and the auto-close period are hypothetical. Employer pipeline stages are configured per employer and can change. The visible statuses and the "not selected" rule are this exercise's; check current docs for any real product.

**Clarifications.**
- Q: Is a repost the same posting? | A: No, it gets a new posting id. Whether it is the same opening is what your model must decide, from a requisition id if the employer sends one or from evidence such as company, title, location and timing.
- Q: What happens to applications when a posting closes? | A: They keep their status history; the applicant is shown "no longer accepting applications" for the posting, and their own application status continues if the employer keeps working on it.
- Q: Can the salary range change after people have applied? | A: Yes. Each application must point to the posting version it was submitted against.
- Q: For off-site applies, do we know if the member applied? | A: No. We know they clicked through. Nothing more is inferred.
- Q: Can an employer move an applicant backwards in their pipeline? | A: Yes, and stages can be renamed or removed by the employer at any time.

**Hints.**
1. Separate three identities: the opening (the role the employer is filling), the posting (one publication of it), and the posting version (what it said between two edits).
2. Keep employer stages and applicant-visible statuses as two histories joined by a mapping that is itself versioned.
3. Record what was shown to the applicant as its own event, not as something recomputed from the current mapping.

**Follow-ups.**
1. Show the rows for one opening: posted, salary range edited after 40 applications, auto-closed after {{auto_close_days}} days, reposted with a new id, then filled. What does each applicant see?
2. Without a requisition id, how do you decide two postings are the same opening, and how do you measure how often that decision is wrong?
3. An employer renames a stage and maps it to a different visible status. What happens to applicants already in that stage, and to last month's "received any status" metric?
4. "Time from application to first employer view" for applications that were never viewed: what do you report, and when is a month's number final?
5. At {{daily_applications}} applications a day, which tables are append-only facts, which are accumulating snapshots, and how is "what was shown" reproducible a year later?

**Follow-up rules.**
- when: posting_id, one row per posting, job_id → ask: The same role is closed after {{auto_close_days}} days and reposted with a new id. How does your model count it — two jobs, or one opening posted twice — and which number do job seekers care about?
- when: status column, current_status, update the status → ask: An applicant went from viewed to interviewing and back to viewed. With one status column, what was the applicant shown last Tuesday?
- when: redirect, offsite, external apply, click through → ask: How do you keep off-site clicks out of "applications", and what may you claim about whether those members applied?
- when: salary, salary range → ask: The range was raised after 40 people applied. Which range does each application record show, and what does the employer report compare?
- when: stage, pipeline stage, stage mapping → ask: Two employers both have a stage called "Screen" meaning different things. How do your reports compare them, and what does the applicant see?

**Production Reality Check.**
- An employer's tracking system was migrated and re-sent every open posting with new ids; overnight about {{ats_share}} of that day's postings looked new, and applications attached to the old ids looked orphaned to applicants.
- A stage mapping for one large employer sent "not selected" to thousands of applicants whose applications had only been auto-sorted, not reviewed; support tickets arrived within an hour.
- Postings auto-closed after {{auto_close_days}} days were counted as "filled" in a hiring report because closure reason was not recorded, so time-to-fill fell sharply for employers who simply never closed postings themselves.

**Evaluation Criteria.** Opening, posting and posting version as distinct identities with a stated repost rule and its error measurement; applications tied to the version applied against; append-only status history; employer stages and visible statuses as separate, versioned mappings; what the applicant was shown recorded as its own event; off-site clicks never counted as applications; closure reasons recorded; facts at stated grains with a finality rule; each incident contained, corrected and guarded.

## LNK-L3-03: Company pages and affiliation — acquisitions, rebrands and page merges

| | |
|---|---|
| **Template ID** | LNK-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / entity identity over time, merge maps, as-was versus as-is reporting, aggregate privacy floors |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "pages": {"1": ["2 million"], "2": ["20 million"], "3": ["70 million"]},
  "merges_per_month": ["300", "4,000"],
  "insights_floor": [10, 20, 50]
}
```

**Business Scenario.** A professional network hosts about {{pages}} company pages. Members link each position on their profile to a page, or type a company name that matches no page. Pages change: a company rebrands (new name, logo and handle on the same page), acquires another company (the acquired page is kept as an affiliated page, or retired into the acquirer's), or duplicate pages created by different people are merged after the owner verifies them — about {{merges_per_month}} merges a month, a few of them later found to be mistakes and undone. Page administrators see aggregate insights: followers over time, employee counts by function and location, and headcount growth. In this exercise's rule, no insight cell is shown for fewer than {{insights_floor}} members, and no insight ever names or lists individual employees.

**Problem Statement.** Design the data model. Cover: organisation and page identity over time (names, handles, rebrands); the merge map, including chains of merges and an unmerge; affiliation between pages (subsidiary, acquired) with effective dates; how a member's position stays linked to the right page through rebrands, merges and acquisitions without editing the member's profile history; free-text companies that are linked to a page later. Define headcount and employee-by-function facts and say whether a page's growth chart shows organisations "as they were" or "as they are now" after a merge or acquisition. Explain how the {{insights_floor}}-member floor is enforced so that a merge, an unmerge or a week-over-week difference cannot reveal a group smaller than the floor.

**Constraints.** A page id, once issued, always resolves: to itself or, after a merge, to the surviving page. An unmerge must restore both pages' followers and position links as they were. Members' positions keep the page they chose; resolution happens at read time. Insight cells below {{insights_floor}} members are suppressed. Insights are aggregates only, about members who list a current or past position at the page.

**Assumptions.** Page counts, merge rates and the floor are hypothetical, and the merge, affiliation and floor rules are this exercise's own. Function and location come from what members list on their profile; nothing is inferred about a member beyond what they listed.

**Clarifications.**
- Q: After a merge, what happens to the retired page id? | A: It resolves to the surviving page. Old links, followers and position links follow it.
- Q: Does an acquisition merge the pages? | A: Not necessarily. The acquirer chooses: keep the acquired page as an affiliate, or retire it into the acquirer's page later.
- Q: Should a member who left the acquired company before the acquisition count as the acquirer's alumni? | A: Your choice; define it and say what each choice does to the acquirer's insights.
- Q: Can a merge be undone? | A: Yes, and the two pages must come back with their own followers and links.
- Q: Can a page administrator see who the employees are? | A: Not through insights. Insights are aggregate counts only.

**Hints.**
1. Store the merge map as rows with effective times (from page, into page, merged_at, unmerged_at), and resolve a page id by following it, not by rewriting positions.
2. Keep "the organisation" and "the page" apart if one organisation can have several pages over time.
3. The privacy floor must hold for every published cell and for any difference between published cells.

**Follow-ups.**
1. Page A was merged into B, then B into C, then A was found to be a different company and unmerged. Show the merge-map rows and how a position linked to A resolves at each step.
2. Company C acquires D. Draw C's headcount growth chart for the year before and after, "as was" and "as is". Which does an administrator see, and how is the change labelled?
3. A function with 52 members at a page drops to 48 after an unmerge. With a floor of {{insights_floor}}, what may be shown, and how do you stop someone subtracting two published numbers to learn about a small group?
4. Free-text company names: how do you link "Acme Inc." typed by thousands of members to a page later, and what does that do to past headcount numbers?
5. With about {{merges_per_month}} merges a month, how do you resolve page ids in a warehouse join over billions of positions without following chains row by row?

**Follow-up rules.**
- when: update the page_id, rewrite positions, overwrite company → ask: You rewrote positions from A to B at merge time. The merge is undone a week later: which positions go back to A, and how do you know?
- when: merged_into, merge map, redirect → ask: A into B, B into C, and later C into A by mistake. How does your resolution avoid a cycle, and what does a position on A resolve to?
- when: headcount, employee count → ask: Which members count: current position only, or anyone with a position at any time? And what does an acquisition do to the line on the chart?
- when: threshold, floor, suppress → ask: Both last week's and this week's cells are above the floor, but their difference is 3. What does a page administrator learn from the two, and how do you prevent it?
- when: fuzzy match, string similarity, name matching → ask: Two different companies share a name in different countries. What evidence besides the name do you use, and who confirms a link before it changes counts?

**Production Reality Check.**
- A duplicate page was merged into the main page and the "employees by function" table, compared week over week, revealed a function group of fewer than {{insights_floor}} people by difference, even though every published cell met the floor.
- A rebrand was entered as a new page instead of a rename. Members' positions split across both pages, and the company's headcount chart showed a 40% drop in one month.
- A bad merge joined two unrelated companies with the same name. It was undone two weeks later, but followers who had followed the merged page during those weeks could not be assigned back to either page.

**Evaluation Criteria.** Organisation, page and merge map with effective times; resolution at read time with chains, cycles and unmerges handled; positions never rewritten; affiliation and acquisition modelled with dates; a stated as-was versus as-is choice for growth charts; free-text linking with evidence and review; the floor enforced on cells and on differences (stable rounding, minimum change, or noise, with the trade-off stated); efficient resolution at warehouse scale (a materialised closure table); each incident contained, corrected and guarded.

## LNK-L3-04: Recruiter projects — saved candidates, pipeline stages, messages and seat transfers

| | |
|---|---|
| **Template ID** | LNK-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / customer-owned work, seat assignment history, stage events with versioned stage definitions, retention |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "seats": {"1": ["5 thousand"], "2": ["60 thousand"], "3": ["300 thousand"]},
  "custom_stages": [5, 8, 12],
  "retention_days": [90, 180],
  "transfer_lag_days": [3, 14]
}
```

**Business Scenario.** Companies buy a recruiting product with a number of seats, about {{seats}} seats across all customers here. A seat is assigned to a recruiter. Recruiters create projects (usually one per opening), save member profiles found in search to a project, move candidates through the customer's own pipeline of {{custom_stages}} stages, add notes, and message candidates; the candidate sees the message thread in their own inbox and can reply, decline or ignore it. When a recruiter leaves, the customer's administrator reassigns the seat or transfers that recruiter's projects, notes and threads to a colleague, typically {{transfer_lag_days}} days later. When a contract ends, this exercise's rule keeps the customer's projects, notes and pipeline data for {{retention_days}} days and then deletes them. A candidate can close their account at any time.

**Problem Statement.** Design the data model. Cover: customer, contract, seat, recruiter and the history of who held each seat; projects and who owns them over time; a candidate's membership of a project and their stage history; stage definitions per customer that are renamed, reordered and retired, and how reports stay comparable; notes; message threads shared between a recruiter and a candidate, including what happens to an open thread when the seat changes hands; and what is deleted when the contract ends or the candidate closes their account. Define facts for "candidates reaching each stage per project", "time in stage", "replies to first messages per seat" and "hires per recruiter", and say who gets credit for work done before a transfer.

**Constraints.** Projects, notes and pipeline data belong to the customer, not to the individual recruiter. Stage history is append-only. The candidate sees only the message thread, never notes, stages or other projects. A candidate's profile is shown as the candidate currently shows it, never a saved copy. Contract-end deletion runs {{retention_days}} days after the end date and covers derived tables.

**Assumptions.** Seat counts, stage counts, lags and retention are hypothetical; the ownership, transfer and retention rules are this exercise's own. A candidate can be saved to several projects of the same customer, and to projects of different customers who never see each other's data.

**Clarifications.**
- Q: Who owns a project when its recruiter leaves? | A: The customer. Until the administrator transfers it, it stays with the vacated seat and can be read by administrators.
- Q: Does the candidate see the new recruiter after a transfer? | A: In this exercise the thread moves to the new seat holder, and the candidate sees the new name on future messages; earlier messages keep the sender who wrote them.
- Q: Can stages change in the middle of a hiring cycle? | A: Yes: renamed, reordered, split or retired. Candidates in a retired stage are moved by the administrator.
- Q: Can two customers see that both saved the same candidate? | A: Never. Each customer's projects are separate.
- Q: What happens when a candidate closes their account? | A: Their profile disappears from every project. Whether the customer's notes about them stay until contract-end deletion is a policy question; say what you would do and why.

**Hints.**
1. Make the seat, not the person, the owner key of work, and keep a seat-assignment history so every action can be attributed to whoever held the seat at the time.
2. Keep a canonical stage set per customer (or a global one) and map each customer's stage versions to it; record stage changes as events with the stage version in force.
3. Keep references to member profiles, never copies, and give every customer-owned row a contract key so deletion can find it.

**Follow-ups.**
1. Show the rows for one candidate: saved to a project, messaged, replied, moved through three stages, the recruiter leaves, the seat is transferred {{transfer_lag_days}} days later, the new recruiter marks the hire. Who gets credit for what?
2. The customer renames and reorders its {{custom_stages}} stages mid-quarter. How do "candidates reaching each stage" and "time in stage" stay comparable across the change?
3. Replies arrive in an open thread during the {{transfer_lag_days}} days before the transfer. Who sees them, and how is "replies per seat" attributed?
4. The contract ends. List what is deleted after {{retention_days}} days, what is never deleted early, and what aggregate figures survive.
5. Three recruiters at the same customer saved the same candidate to three projects. How do you show "already contacted by a colleague" without letting a different customer learn anything?

**Follow-up rules.**
- when: recruiter_id, owner_id, created_by → ask: The recruiter who owns those projects leaves today. With the recruiter as owner, who can open the projects tomorrow, and who is credited with last month's hires?
- when: current_stage, stage column, update the stage → ask: How long did this candidate spend in each stage, and what was the pipeline on the first of last month?
- when: copy the profile, snapshot of the profile, store the profile → ask: The candidate hid a position yesterday. What does your saved copy show the recruiter, and how is it erased if they close their account?
- when: stage_name, stage name → ask: The customer renamed "Phone screen" to "Recruiter call" and split it in two. How does a report spanning both versions read?
- when: delete, purge, hard delete → ask: Which tables, files and caches does contract-end deletion touch, and how do you prove a customer's data is gone after {{retention_days}} days?

**Production Reality Check.**
- After a batch of seat transfers, the "hires per recruiter" report credited every hire of the departed recruiters to the new seat holders, because attribution read the seat's current holder instead of the holder at the time of each stage change.
- A customer reordered its {{custom_stages}} stages so that "Offer" now sorted before "Onsite"; the stage-conversion chart reversed overnight and an administrator escalated a "broken pipeline".
- A contract ended, and {{retention_days}} days later the deletion job removed projects and notes but missed a per-customer export table that fed a scheduled report; the report kept arriving with former candidates' names.

**Evaluation Criteria.** Customer, contract, seat and seat-assignment history with work owned by the customer; attribution by the seat holder at event time; append-only stage events with versioned stage definitions mapped to a canonical set; profile references, never copies; threads modelled with per-message senders and a transfer rule; contract keys on every customer row and a deletion path that covers derived tables; candidate account closure handled; strict separation between customers; each incident contained, corrected and guarded.

## LNK-L3-05: Profile viewers per week — named and private viewers on the member's own page

| | |
|---|---|
| **Template ID** | LNK-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / setting in force at event time, distinct viewers per local week, precedence between modes, closed accounts |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer |
| **Generator** | LNK-L3-05.mjs |

**Business Scenario.** A professional network shows each member who looked at their profile. In this exercise a viewer browses in one of two modes: in `named` mode they are shown with their name, and in `private` mode they appear only as an anonymous private viewer. A member can switch mode at any time; every switch is a row in `visibility_settings`, and the mode in force at the moment of a view is what applies to that view. The weekly summary on a member's own "who viewed your profile" page shows how many distinct people viewed them each week, and how many of those were named and how many private. Only the member sees these numbers. A member who closes their account has their activity removed, so their views disappear from everyone's summaries. The sample has {{members}} members and {{views}} views.

**Problem Statement.** Write one PostgreSQL query that returns `member_id, week_start, viewers, named_viewers, private_viewers`: one row per (viewed member, week) with at least one counted viewer, for the weeks whose start is between `{{week_from}}` and `{{week_to}}` inclusive, ordered by `member_id, week_start`. A week runs from Monday 00:00 to the end of Sunday in the viewed member's own time zone (`members.time_zone`), and `week_start` is the date of that local Monday. {{zone_rule}} A view is counted unless the viewer is the viewed member, or the viewer's account is closed (`closed_at` is not null, whenever it was closed). A view's mode is the viewer's setting in force at `viewed_at`: the row with the latest `effective_at` at or before `viewed_at`; with no such row the viewer is in the default mode, `named`. Each viewer counts once per (member, week): as named if at least one of their counted views that week was named, otherwise as private. `viewers` is the number of distinct counted viewers, so it equals `named_viewers + private_viewers`.

**Constraints.** One SQL statement (CTEs allowed). The setting boundary is inclusive: a switch at exactly `viewed_at` governs that view. Weeks with no counted viewer produce no row. The sample has {{views}} views; production has billions of views a week and members in every time zone.

**Assumptions.** Hypothetical schema, members, settings and views. The two modes and their counting rule are this exercise's; check current docs for any real product. The report is the member's own page; nothing here is shown to anyone else, and no viewer attribute other than the mode is used.

**Clarifications.**
- Q: A viewer looked in private mode on Monday and in named mode on Friday. How do they count? | A: Once, as a named viewer. The member was already shown their name that week.
- Q: Which time zone decides the week, the viewer's or the member's? | A: The viewed member's: it is their page.
- Q: A viewer switched to private at exactly the second of a view. Which mode applies? | A: Private. The latest setting at or before `viewed_at` is in force.
- Q: A viewer closed their account after the week ended. Do their old views still count? | A: No. A closed account's views are removed from every week.
- Q: A viewer who has never changed their setting? | A: They are in the default mode, `named`.

**Hints.**
1. First attach the mode in force to every view: a correlated subquery (or LATERAL) with `ORDER BY effective_at DESC LIMIT 1`, wrapped in `COALESCE(…, 'named')`.
2. Then collapse to one row per (member, week, viewer) with `bool_or(mode = 'named')` before counting.
3. Convert before truncating: `date_trunc('week', viewed_at AT TIME ZONE time_zone)::date`.

**Follow-ups.**
1. At billions of views a week, what would you precompute, and how does a viewer's account closure change numbers you already stored?
2. A member changes their own time zone. Do past weeks re-bucket, and what does the member expect to see?
3. A member has exactly one private viewer this week and knows only one person was likely to look. Is the private count itself a disclosure, and what would you change?
4. After a release, the summary used each viewer's current setting for past views. Who could be harmed, and how fast must it be rolled back?

**Follow-up rules.**
- when: join visibility_settings, left join visibility_settings → ask: A viewer switched mode four times. How many rows does one of their views produce in your join, and how do you keep only the setting in force at viewed_at?
- when: max(effective_at), latest setting, current setting → ask: Is that the latest setting overall, or the latest at or before the view? A viewer browsed privately last month and switched to named today: what does your query show for last month?
- when: count(*), count(view_id) → ask: A viewer looked three times in one week. What does your count say, and what should it say?
- when: date_trunc → ask: In which time zone is the timestamp when you truncate it? A view at 02:00 UTC on a Monday of a member in Los Angeles: which week is it?
- when: inner join → ask: Which views disappear when a viewer has no setting yet, and should they?

**Production Reality Check.**
- After a release, past views were labelled with each viewer's current setting. Viewers who had browsed privately and later switched to named suddenly appeared by name on other members' pages for weeks they had chosen to be private.
- A viewer closed their account, but precomputed weekly summaries still counted them until a full rebuild a week later; the member saw a named viewer whose profile link no longer opened.
- Weeks were bucketed in UTC, so members far east of UTC saw Monday-morning views in the previous week and their "this week" number started low every Monday.

**Evaluation Criteria.** The setting in force at viewed_at chosen exactly (inclusive boundary) with the named default; self-views and closed accounts excluded; one row per (member, week, viewer) before counting; the named-wins rule applied so the two columns add up to viewers; weeks taken in the viewed member's zone and the window applied to local week starts, including the last week; deterministic ordering; can discuss precomputation with closures, time-zone changes and small-count disclosure.
