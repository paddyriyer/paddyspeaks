# Google DeepMind · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public domain of an AI research lab
whose science and model work is public: experiment tracking and
reproducibility, evaluation results described generally, a public database of
predicted protein structures with per-residue confidence, watermark detection
reporting with aggregated outcomes, and research compute allocation described
generally. Science products are described only from their public
documentation. Every run, score, budget, count, rule and threshold is
hypothetical and this exercise's rule (check current docs), and nothing here
describes the lab's research results, compute, partners or how its own systems
are built. Protein topics are data and geometry only, with no medical
conclusions; watermark topics are about detection outcomes and reporting only.

## GDM-L4-01: Reproducing any past run — pinned code, data snapshots, seeds and environments, and an honest report of what could not be pinned

| | |
|---|---|
| **Template ID** | GDM-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Reproducibility / recipe capture at launch, content-addressed pinning, re-run comparison, honest reporting |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | ml-platform-engineer, ai-infra-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "runs_per_week": {"2": ["5,000", "20,000"], "3": ["80,000", "200,000"]},
  "teams": [40, 120, 300],
  "tolerance": ["0.1%", "0.5%", "1%"],
  "lookback": ["two years", "three years", "five years"]
}
```

**Business Scenario.** A research lab's {{teams}} research teams launch about {{runs_per_week}} training and evaluation runs a week, from short sweeps to runs that last weeks. A run reads a registered training data snapshot, runs code from a repository commit (often with uncommitted local changes), inside a container image, with a configuration assembled from defaults, files and command-line overrides, several random seeds, and a particular accelerator type and count. Researchers, internal reviewers before a paper is submitted, and the lab's own release reviews regularly ask the same question about a run from up to {{lookback}} ago: if we ran it again, would we get the same result?

**Problem Statement.** Design the reproduction system. Cover what is captured when a run launches (the recipe) and how each input is pinned and retained; what cannot be pinned (an external download, a non-deterministic kernel, a retired accelerator type) and how that is recorded; the re-run service that rebuilds the environment, fetches the snapshot and launches with the same seeds; how a re-run is compared with the original (curves and final metrics, against this exercise's tolerance); the reproduction report and its outcome levels; how much it costs to keep everything reproducible for {{lookback}}; and how a reviewer can trust that the recipe and results were not changed after the fact.

**Constraints.** Capturing the recipe adds at most a few seconds to a launch, and a capture failure never silently produces a run that looks fully pinned. Re-runs never alter the original run's records. Re-runs draw on a limited accelerator budget, so the largest runs cannot simply be repeated in full. Data snapshots are far too large to copy per run. A run counts as reproduced when its final metrics fall within {{tolerance}} (relative) of the original's, by this exercise's rule.

**Assumptions.** Run counts, sizes, budgets and the tolerance are hypothetical. Training data snapshots are already registered as immutable manifests of content-addressed shards (you may rely on that). Every run and metric is synthetic; nothing here describes how any lab tracks its experiments.

**Clarifications.**
- Q: Must a re-run be bitwise identical? | A: No. Bitwise identity is reported when it happens, but some accelerator kernels are non-deterministic; the bar is {{tolerance}} on final metrics, by this exercise's rule.
- Q: Can researchers launch from uncommitted code? | A: Today they can. You decide whether that continues and, if so, what is captured.
- Q: Can a re-run use different hardware? | A: Sometimes the original accelerator type has been retired. The report must say when a re-run used different hardware.
- Q: Are full re-runs of the largest runs affordable? | A: No. You may propose partial reproduction (for example the first stretch of steps, or resuming from a recorded checkpoint), stated plainly as partial.
- Q: Who reads the report? | A: The researcher, internal reviewers, and occasionally outside reviewers of a paper through the researcher.

**Hints.**
1. Treat the recipe as a manifest of content hashes: the code tree (including any uncommitted diff), the image digest, the resolved dependency lockfile, the data snapshot id, the fully resolved configuration, every seed, the hardware topology and the launch command.
2. Pin by reference to immutable, content-addressed storage, and retain whatever a kept recipe references for as long as you promise to keep it.
3. Separate "could not be pinned" (known before any re-run) from "pinned, but the re-run differs" (found by comparing), and report both.

**Follow-ups.**
1. Walk through exactly what is captured when a researcher launches a run with uncommitted changes and three configuration overrides on the command line.
2. A re-run's loss curve tracks the original for 10,000 steps, then drifts, and the final metric lands outside {{tolerance}}. How does the system help decide whether this is non-determinism or a changed input?
3. The original accelerator type has been retired. What does reproduction mean now, and how is it reported?
4. Storage for pinned images, snapshots and checkpoints grows faster than the budget. What do you keep for {{lookback}}, what do you let go, and how does the report reflect it?
5. A paper cites a run. A reviewer asks for evidence that the recorded recipe and results are the ones recorded at the time. What do you show them?

**Follow-up rules.**
- when: docker, container, image → ask: The image was built from a base tagged "latest" and a package index that has since changed. What exactly did you pin, and can you rebuild that image bitwise today?
- when: git, commit, commit hash → ask: The researcher ran with uncommitted local changes. What does the commit hash tell a reviewer, and what else do you capture?
- when: seed, seeds, random → ask: Every seed is pinned and the re-run still differs. Name two sources of variation that seeds do not control, and how you would record them.
- when: deterministic, bitwise, determinism → ask: Forcing deterministic kernels slows training by a third. Do you make it the default, and for which runs?
- when: checkpoint, resume, resumed → ask: You reproduce from a checkpoint halfway through the run. What have you shown, and what have you not shown?

**Production Reality Check.**
- A reviewer asks to reproduce a run from almost {{lookback}} ago. The container image's base layers were deleted by a registry clean-up policy, and 3% of the shards in its data snapshot were garbage-collected because only the manifest was marked as kept.
- Re-runs of one recipe on the same accelerator type give final metrics that differ by up to twice {{tolerance}}. The cause turns out to be the data loader's shuffle depending on the number of loader workers, which the recipe never recorded.
- A configuration library upgrade changed a default value. Runs whose recipe stored only the command-line overrides now resolve to a different configuration when re-run, and nobody notices until a reproduction fails.

**Evaluation Criteria.** A recipe manifest of content hashes captured at launch, including uncommitted diffs, the fully resolved configuration, all seeds and the hardware; pinning by reference to immutable, content-addressed storage, with retention tied to the recipes that must stay reproducible for {{lookback}}; an explicit record of what could not be pinned; a re-run service that never alters the original and compares curves and final metrics against the stated tolerance; outcome levels that distinguish bitwise, within tolerance, partial, different hardware, and not reproduced (with the reason); a tamper-evident record for reviewers; cost of retention and re-runs stated; adapts to each incident with diagnosis, recovery and prevention.

## GDM-L4-02: Serving a public structure database — entry pages, downloads, an API and bulk archives under heavy read load, with old releases still citable

| | |
|---|---|
| **Template ID** | GDM-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Public data serving / versioned immutable objects, CDN caching, release switches, bulk delivery, citation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, data-engineer |

```params
{
  "entries": {"2": ["50 million", "100 million"], "3": ["200 million", "300 million"]},
  "peak_rps": {"2": ["5,000", "10,000"], "3": ["40,000", "80,000"]},
  "archive_tb": [20, 50, 120],
  "past_releases": [3, 6, 10]
}
```

**Business Scenario.** A public database of predicted protein structures holds {{entries}} entries. Each entry is keyed by the accession of a protein in a public sequence catalogue, a fragment number (long proteins are predicted in overlapping fragments) and a model version, and has a structure file in two common formats, a per-residue confidence score for every residue, and a predicted aligned error file. People use it through entry pages on a website, direct file downloads, a REST API and bulk archives per organism and per release ({{archive_tb}} TB per release). Traffic peaks at about {{peak_rps}} requests a second, with sudden spikes when a widely read paper links to entries, and steady load from automated pipelines that download in bulk. A new release appears a few times a year and replaces many entries; the {{past_releases}} previous releases must stay downloadable, and a paper that cites an entry at a version must always resolve to exactly the files it used.

**Problem Statement.** Design the serving system. Cover the storage layout and object naming; how "latest" is served alongside version-pinned addresses; caching at the edge and in front of the origin, and the cache keys; how a release switch keeps every page, file and API response for an entry on one version; the API (lookup by accession, by entry id and version, and batched lookups) and how it is protected from abusive clients without a login; bulk archive delivery (mirrors, a cloud bucket, checksums, resumable downloads); stable identifiers for citation; monitoring of what users actually receive; and the cost of egress.

**Constraints.** A user must never see an entry with files from two different releases (for example a new structure coloured by old confidence values). The latest alias switches for every entry within one hour of a release being declared live. A version-pinned address never changes content, ever. Downloads are public, with no login. Origin capacity is a fraction of peak traffic, so most reads must be served from caches. Egress cost is a stated budget.

**Assumptions.** Entry counts, traffic, archive sizes, the release cadence and the identifier scheme are hypothetical and this exercise's rule (check current docs). Releases are built and checked by a separate pipeline that hands you a complete, immutable set of files with a manifest. The data is predictions only: nothing here draws a medical or clinical conclusion from them.

**Clarifications.**
- Q: Do entry ids carry the version? | A: In this exercise, an entry id is accession, fragment and model version; the website also offers an address without the version that means "latest".
- Q: Are old releases served as fast as the latest? | A: Not necessarily. They must stay correct and downloadable; you decide how much performance they get.
- Q: Who are the bulk users? | A: Research groups and other databases that mirror whole organisms or whole releases, often on a schedule.
- Q: Is there a search box? | A: By accession, protein name and organism; free-text search over annotations is out of scope.
- Q: Can an entry disappear in a release? | A: Yes, when its sequence is withdrawn from the catalogue. Its old versions stay citable; the latest address says it was withdrawn and when.

**Hints.**
1. Make every file immutable and name it by version (or by content hash). "Latest" is then a small, separately cached pointer, and a release switch changes only pointers.
2. Cache the immutable objects for a very long time and the pointers for a short, bounded time; render pages from one resolved version so a page and its files cannot disagree.
3. Bulk users need manifests with checksums and stable archive names more than they need speed; most of them would rather sync a difference than re-download everything.

**Follow-ups.**
1. Walk through a request for an entry's page during the minute a new release goes live. Which version does the user see, and how do you guarantee the page and its files agree?
2. A paper's link goes viral and a few thousand entries receive ten times normal traffic. What absorbs it, and what reaches the origin?
3. A research group mirrors every release. How do you let them fetch only what changed, and verify it?
4. A small number of clients send millions of API calls a day, crowding out everyone else. How do you protect the service without requiring logins?
5. An error is found in one release after it went live. How do you correct it while keeping citations to the original files resolvable and honest?

**Follow-up rules.**
- when: cdn, edge cache, caching → ask: What is the cache key for an entry's confidence file, and what happens to a cached copy when the latest version changes?
- when: ttl, expire, expiry → ask: Your pages and your files have different lifetimes in the cache. Describe the minute in which a user can see a new structure with old confidence values, and how you close it.
- when: rate limit, throttle, throttling, api key → ask: Downloads are public with no login. What do you key the limit on, and what happens to a whole university behind one address?
- when: doi, citation, citable → ask: A paper cites an entry's version from {{past_releases}} releases ago. What does the link resolve to, and what does the page say about newer versions?
- when: rsync, mirror, mirrors, bucket → ask: A mirror's checksum check fails on one archive. How does the mirror know whether the file or the checksum list is wrong?

**Production Reality Check.**
- A widely read article links to a few thousand entries using addresses with tracking query strings. Every variant misses the edge cache, origin load reaches four times its capacity, and entry pages time out while traffic is still below {{peak_rps}} requests a second.
- For forty minutes after a release switch, some users see new structure files on pages that still colour residues by the previous release's confidence values, because the page and the confidence file were cached under different lifetimes.
- One automated client re-downloads the full {{archive_tb}} TB release archive every day, because the archive's last-modified time changed when the files were re-uploaded to a new bucket, and egress for the month passes its budget in eleven days.

**Evaluation Criteria.** Immutable, version-named objects with "latest" as a small pointer; long-lived caching of immutable files and short, bounded caching of pointers, with normalised cache keys; a page, its files and its API response resolved from one version so they never mix; a release switch that changes pointers only and completes within the hour; old releases served correctly at lower cost tiers; bulk delivery through manifests with checksums, stable names and incremental sync; protection from heavy clients keyed on something other than logins, with fair treatment of shared addresses; stable versioned identifiers for citation, including withdrawn entries; monitoring of what users actually receive; egress cost addressed; adapts to each incident with diagnosis, recovery and prevention.

## GDM-L4-03: Watermark detection reporting — outcomes across images, video, audio and text, detector rollouts, and measured disagreement between versions

| | |
|---|---|
| **Template ID** | GDM-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Privacy-preserving reporting / outcome records without content, aggregation thresholds, version rollouts, shadow comparison |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ml-platform-engineer, software-engineer |

```params
{
  "checks_per_day": {"2": ["2 million", "10 million"], "3": ["50 million", "200 million"]},
  "rollout_share": ["5%", "10%", "25%"],
  "min_cell": [20, 50, 100],
  "record_days": [30, 90, 400]
}
```

**Business Scenario.** A research lab's generative tools embed an imperceptible watermark in the images, video, audio and text they produce, and the lab offers a detector: partners and users submit a file, and the detector reports whether all of it, part of it, or none of it appears to carry the watermark, with a confidence level (for video and audio, which time ranges; this exercise's outcome categories, check current docs). About {{checks_per_day}} checks arrive a day through a web tool and partner integrations. New detector versions are rolled out gradually, starting with {{rollout_share}} of traffic. Policy and product teams want weekly aggregate outcomes per content type, channel and confidence level, and the people deciding on a rollout want to know how often the new version disagrees with the old one, and in which direction.

**Problem Statement.** Design the detection reporting system. Cover the outcome record each check produces (and everything it must not contain); how checked content is discarded; how repeated checks of the same file are recognised without keeping the file; the aggregation pipeline and its publication rules (cells below {{min_cell}} checks are never shown, by this exercise's rule); how traffic is assigned to detector versions during a rollout; how disagreement between versions is measured when production content cannot be kept for replay; how a version change and a change in the mix of submitted content are told apart in the reports; and retention of outcome records for {{record_days}} days.

**Constraints.** No checked content is kept, and nothing is stored from which content could be reconstructed. Every published number is an aggregate over at least {{min_cell}} checks, and no breakdown may let a reader isolate a single partner's or user's activity. A check's response time must not grow by more than a small, stated margin because of reporting. Reports must say which detector versions they cover. This system is about measuring and reporting detection outcomes only: it does not cover how watermarks are embedded, and it never covers ways to remove, weaken or evade one.

**Assumptions.** Volumes, rollout shares, thresholds and retention are hypothetical and this exercise's rule (check current docs). The detector itself is a service you call; you do not design it. The lab keeps a separate test set of files it generated itself for testing, under its own policy, which may be replayed through any detector version.

**Clarifications.**
- Q: May we keep a hash of each file to count repeated checks? | A: By this exercise's rule, a keyed hash with a key rotated every {{record_days}} days may be kept with the outcome record; nothing else derived from the content.
- Q: What is in an outcome record? | A: Time, channel, content type, coarse size and duration buckets, detector version, the outcome, the confidence level and, for video and audio, how many segments were flagged. You decide whether anything else is justified.
- Q: Can we replay last week's production traffic through a new version? | A: No; it was never kept. Replays are possible only on the lab's own test set.
- Q: Who reads the aggregates? | A: Internal policy and product teams weekly, and partners see aggregates of their own channel.
- Q: How long does a rollout take? | A: Several weeks, from {{rollout_share}} of traffic to all of it, with a decision at each step.

**Hints.**
1. Write the outcome record at the end of the check, from fields chosen on purpose; drop the content in the same request, and test that no log, trace or error path keeps it.
2. Since production content cannot be replayed, measure disagreement while the content is still in hand: run both versions on a sampled share of live checks and record only the pair of outcomes.
3. Assign versions by a stable hash of something that does not correlate with content type or partner, and compare cohorts with the same mix, or the comparison measures traffic rather than the detector.

**Follow-ups.**
1. Walk through one video check from upload to the weekly report. What exists, where, and for how long?
2. How do you measure how often the new version disagrees with the old one, by content type and confidence level, without keeping any content?
3. The weekly share of "not detected" for audio rises after a rollout step. How do you tell a version regression from a change in what was submitted?
4. A partner asks for a per-day breakdown of their channel by content type and confidence level. Which cells can you show, and how do you stop a reader from subtracting one published total from another to recover a small cell?
5. A rollout reviewer asks for a single number that says the new version is "better". What do you give them instead, and why?

**Follow-up rules.**
- when: store the file, keep the content, sample of files, retain content → ask: The rule says no checked content is kept. How do you debug a surprising outcome without it?
- when: hash, hashes, hashed, fingerprint → ask: Could your hash let someone confirm that a particular file was checked? What key, rotation and retention make that acceptable here?
- when: shadow, both versions, dual run → ask: Running both versions doubles the cost of a check. What share do you sample, and how many disagreements do you need before a difference in one content type means something?
- when: a/b, cohort, rollout, canary → ask: What do you hash on to assign a check to a version, and how do you prove that both cohorts received the same mix of content types and channels?
- when: dashboard, aggregate, aggregates, report → ask: Two published totals differ by one small cell. How does your publication rule prevent that subtraction?

**Production Reality Check.**
- After the new version reaches {{rollout_share}} of traffic, the weekly report shows the share of audio checks with "not detected" up six points in its cohort. Version assignment had been by partner, and the partner placed in the new cohort mostly submits older recordings made before any watermarking existed.
- A partner-level weekly breakdown published a cell of four checks, below the {{min_cell}} threshold, because the threshold was applied before the data was split again by confidence level for a new chart.
- A partner integration's retry bug submits each file up to five times. That partner's channel shows checks up fourfold and its outcome shares shift, because repeated checks of the same file were counted as separate checks in the weekly aggregates.

**Evaluation Criteria.** An outcome record with deliberately chosen fields and no content, written at the end of the check, with content discarded in the same request and all logging paths tested; repeated checks recognised by a keyed, rotated hash within the stated retention; aggregates with a minimum cell size applied at publication time to every published breakdown, and protection against recovering small cells by subtraction; version assignment by a stable hash independent of content type and partner, with mix checks between cohorts; disagreement measured by dual-running a sample of live checks and recording only paired outcomes, plus replays on the lab's own test set; reports that state version coverage and separate mix shift from detector change; no removal or evasion detail anywhere; adapts to each incident with diagnosis, recovery and prevention.

## GDM-L4-04: Research compute allocation — proposals, quarterly allocations by a stated rule, usage against allocation, and mid-quarter reallocation

| | |
|---|---|
| **Template ID** | GDM-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Resource governance / reproducible allocation runs, grants ledger, burn tracking, reallocation with explanations |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-architect, staff-data-engineer, senior-data-engineer, analytics-engineer, ai-infra-engineer, ml-platform-engineer |

```params
{
  "pool": {"2": ["2 million", "5 million"], "3": ["20 million", "60 million"]},
  "proposals": [60, 150, 400],
  "reserve": ["5%", "10%", "15%"],
  "checkpoint_week": [4, 6, 8]
}
```

**Business Scenario.** A research organisation shares a pool of about {{pool}} accelerator-hours a quarter (synthetic) among its projects. Before each quarter, projects submit proposals, {{proposals}} of them: the accelerator-hours they need per month and per accelerator type, the milestones the hours buy, and a justification. A review panel scores the proposals, and allocations follow a published rule: proposals are placed in funding tiers by score, higher tiers receive their request (possibly trimmed), lower tiers share what remains in proportion to their requests, and {{reserve}} of the pool is held back for urgent requests during the quarter. Usage comes from the cluster's accounting as accelerator-hours per project per day. In week {{checkpoint_week}} of the quarter, projects using well below their plan return part of their allocation, which goes first to proposals on the waitlist.

**Problem Statement.** Design the allocation system. Cover proposals and their revisions; the allocation rule as versioned code that runs on a frozen snapshot of its inputs and produces the same result whenever it is re-run; a ledger of grants, trims, returns, transfers and reserve draws; usage against allocation per project, month and accelerator type, and a forecast of each project's burn; the mid-quarter return and reallocation rule; how allocations are handed to the scheduler (as an interface; you do not design the scheduler); explanations a project lead can read ("why did I get this number?"); and the audit trail for the panel.

**Constraints.** You do not design job scheduling, queue ordering or how usage is measured; you consume daily per-project usage totals, which may arrive late or be corrected. The sum of allocations plus the reserve never exceeds the pool for any accelerator type and month. Any allocation must be reproducible from the rule version and the inputs it read. A project must not lose hours at the checkpoint because of missing usage data. Every change to an allocation records who made it and why.

**Assumptions.** Pool sizes, proposal counts, tiers, the reserve and the checkpoint rule are hypothetical and this exercise's rule; nothing here describes how any organisation allocates its compute, or its compute capacity. Accelerator types are not interchangeable unless a proposal says it can use more than one.

**Clarifications.**
- Q: Is the rule fixed? | A: It is published before the quarter and versioned; changing it mid-quarter needs the panel's approval and applies only from the change forward.
- Q: Can a project ask for more mid-quarter? | A: Yes, from the reserve or from returned hours, through a short request that the system routes for approval.
- Q: What counts as "well below plan" at the checkpoint? | A: This exercise's rule: cumulative usage below 60% of the plan to date; the project keeps enough for its remaining plan plus a margin, and returns the rest. You may propose a better rule.
- Q: How late can usage data be? | A: Usually a day; during an accounting outage, up to two weeks. Corrections can change past days.
- Q: Do unused hours carry over to the next quarter? | A: No, by this exercise's rule; that is why the checkpoint exists.

**Hints.**
1. Freeze the inputs (the proposals at their submitted revision, the final scores, the pool per type and month, the rule version) into a snapshot with an id, run the rule as a pure function of it, and store the output with the snapshot id.
2. Treat every later change as an appended ledger entry with a reason (trim, return, reserve draw, transfer), so the current allocation is the initial run plus the entries, and each entry can be explained.
3. Checkpoint decisions should use usage data that is known to be complete through a stated date, not whatever has arrived.

**Follow-ups.**
1. Walk through the allocation run at the start of a quarter, from the proposals to the numbers each project lead sees.
2. A project lead disputes their allocation. What does the explanation show, and can they re-run the rule themselves?
3. At week {{checkpoint_week}}, which projects return hours, how much, and where do the hours go? What if usage data for some projects is incomplete?
4. The reserve of {{reserve}} is under pressure early in the quarter. How does the system decide, and who approves?
5. The panel wants to know whether allocations last year matched the milestones they bought. What data answers that, and what can it never answer?

**Follow-up rules.**
- when: spreadsheet, excel, google sheet → ask: Two panel members edit the allocation spreadsheet the night before publication. How do you know which numbers the published allocation used?
- when: optimiser, optimization, linear program, solver → ask: A project lead asks why the solver gave them 12% less than last quarter. What explanation can a person read?
- when: quota, quotas, priority, scheduler → ask: You hand allocations to the scheduler. What exactly crosses that interface, and what happens if a project uses more than its allocation?
- when: forecast, burn rate, projection → ask: Your burn forecast says a project will use only half its allocation. Do you take hours back before the checkpoint, and what if the forecast is wrong?
- when: carry over, rollover, roll over → ask: The rule says unused hours do not carry over. A project saved its hours for a large run in the last month. How does the checkpoint rule treat it?

**Production Reality Check.**
- The allocation run at the start of the quarter used last quarter's review scores for twelve proposals, because the input snapshot was taken before the panel's final scores were recorded. Allocations were published and two projects have already started large runs.
- At the week {{checkpoint_week}} checkpoint, the return rule took hours from a project whose usage data was two weeks behind because of an outage in the accounting feed; its real usage was on plan, and its next large run is now short of hours.
- The reserve of {{reserve}} of the pool was used up by week three, through urgent requests approved by four different people, none of whom could see the others' approvals.

**Evaluation Criteria.** Proposals with revisions and a frozen input snapshot; the rule as versioned, pure code whose output is reproducible from the snapshot; a ledger of grants and later changes with reasons and approvers; invariants per accelerator type and month that allocations plus reserve never exceed the pool; usage against allocation with completeness dates, so decisions use only complete data; a checkpoint rule that is explicit, protects projects from missing data, and sends returned hours to a stated destination; a reserve with one queue, visible approvals and a draw-down limit; explanations a project lead can read and re-run; a clean interface to the scheduler, distinct from scheduling and usage accounting; adapts to each incident with diagnosis, recovery and prevention.

## GDM-L4-05: An evaluation result store across research teams — versioned suites, rescoring when a scorer changes, and comparisons only between comparable versions

| | |
|---|---|
| **Template ID** | GDM-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Result stores / comparability keys, per-item outputs, rescoring backfills, paired comparisons |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | ml-platform-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ai-infra-engineer |

```params
{
  "checkpoints_per_week": {"2": ["500", "2,000"], "3": ["10,000", "40,000"]},
  "suites": [50, 150, 400],
  "teams": [10, 30, 80],
  "output_days": [90, 180, 365]
}
```

**Business Scenario.** {{teams}} research teams evaluate about {{checkpoints_per_week}} model checkpoints a week against a shared catalogue of {{suites}} benchmark suites. Suites are versioned: items are added, removed when found wrong, or corrected. Scorers are versioned too: answer normalisation for exact-match suites, a sandboxed test harness for code suites, and grader models for open-ended ones. Each team runs its own evaluation harness, but every team writes its results to one shared store, and everyone reads from it: to compare two checkpoints on a suite, to follow a model family over months, and to find which results went stale when a scorer changed. Per-item model outputs are kept for {{output_days}} days so that results can be rescored without generating again. Every checkpoint, suite and score here is synthetic.

**Problem Statement.** Design the result store. Cover what is stored per item and per run (outputs, per-item scores, aggregates), and for how long; the comparability key that decides which results may be compared; the ingestion contract that many teams' harnesses must meet, and how it is enforced; rescoring when a scorer changes, as new result versions rather than edits, with its cost and priority; the comparison API, which refuses or qualifies comparisons across incomparable versions and computes differences on the items both results share, with their uncertainty; lineage from any number on a chart back to the outputs and scorer that produced it; and storage sizing.

**Constraints.** A result is never edited in place; rescoring and corrections create new versions linked to the old. No interface may silently compare results whose suite version, scorer version, prompt template or sampling settings differ. New results are queryable within an hour of a run finishing, including while a rescoring backfill runs. Outputs older than {{output_days}} days are gone, so results that old cannot be rescored. You do not design how evaluations are scheduled or run.

**Assumptions.** Team, checkpoint and suite counts and retention are hypothetical; every result is synthetic, and nothing here describes any lab's evaluations or results. Each suite item has a stable id that survives versions unless the item's content changes.

**Clarifications.**
- Q: What makes two results comparable? | A: That is for you to define. At minimum the item set, the scorer, the prompt template and the sampling settings matter.
- Q: Do teams use the same harness? | A: No. Harnesses differ; some sample several outputs per item and average, others decode once. Your contract must capture that.
- Q: Who decides that a scorer change needs rescoring? | A: The suite's owners, when they publish a new scorer version. You decide how rescoring is scheduled and what readers see meanwhile.
- Q: How big are suites? | A: From a few hundred items to tens of thousands; some outputs are long programs or essays.
- Q: Must old results stay visible after rescoring? | A: Yes, as superseded versions, for anyone who cited them.

**Hints.**
1. Compute a comparability key from the exact item set (a hash of item ids and item versions), the scorer version, the prompt template version and the sampling settings; store it with every result and index by it.
2. Compare two results on the items they share, as paired per-item differences, and report the number of shared items and an interval, not just two averages.
3. Rescoring reads stored outputs and writes a new result version for each affected result; it runs at lower priority than ingestion, and readers can see which results are pending.

**Follow-ups.**
1. Walk through one team's run landing in the store: what arrives, what is validated, and what makes it queryable.
2. A suite's new version removes 40 wrong items. A researcher asks to compare a checkpoint scored on the old version with one scored on the new version. What does the API return?
3. A scorer changes for one of the {{suites}} suites. Which results are rescored, in what order, what do readers see while it runs, and what happens to results whose outputs are older than {{output_days}} days?
4. Two teams report different scores for the same checkpoint on the same suite version. How does the store show why?
5. A chart shows a model family improving steadily over six months. How would a reader know whether any part of the trend comes from changes to suites or scorers rather than the models?

**Follow-up rules.**
- when: average, mean, aggregate → ask: The two results share only 80% of their items. Do you compare the two averages, or something else, and how do you report the uncertainty?
- when: overwrite, update in place, upsert → ask: A paper cited last month's score for this checkpoint. After rescoring, where is that number, and how does the reader see it was superseded?
- when: schema, contract, validation → ask: A team's harness sends sampling settings as free text. What does your contract require, and what happens to a run that fails validation?
- when: backfill, rescore, rescoring, reprocess → ask: The rescoring backfill touches every result for a popular suite. How do you keep new results arriving within the hour while it runs?
- when: leaderboard, ranking, best model → ask: Your leaderboard mixes results from three scorer versions. What does the page show, and what does it refuse to show?

**Production Reality Check.**
- A suite's version 3 removed 40 items found to have wrong reference answers. A shared dashboard compares a checkpoint scored on version 3 with one scored on version 2, and shows a two-point gain that comes entirely from the removed items.
- A scorer fix for answer normalisation triggers rescoring of every result for one popular suite. The backfill competes with ingestion, new results are delayed by a day, and results older than {{output_days}} days stay on the old scorer, so the suite's long-term trend chart silently mixes both scorers.
- Two teams store results for the same checkpoint and suite version under the same key, but one team's harness averages five sampled outputs per item and the other decodes once; their scores differ by three points and both are labelled as the official result.

**Evaluation Criteria.** Per-item outputs and scores kept for the stated period, with aggregates derived from them; a comparability key computed from the item set, scorer, prompt template and sampling settings, stored with every result; an ingestion contract that requires those fields and rejects or quarantines runs that lack them; results immutable, with rescoring and corrections as linked new versions and superseded versions still visible; a rescoring backfill at lower priority than ingestion, with pending status shown and a clear policy for results whose outputs have expired; a comparison API that refuses or qualifies incomparable pairs and computes paired differences on shared items with counts and intervals; lineage from any number to its outputs and scorer; trend views that mark suite and scorer changes; adapts to each incident with diagnosis, recovery and prevention.
