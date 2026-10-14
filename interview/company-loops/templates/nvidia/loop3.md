# NVIDIA · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of GPUs,
data-centre systems and networking, and the software that runs on them. The
setting is always a GPU cluster operator or a team running training jobs on
GPUs. Hardware and telemetry are described generally, never as the
specification of a particular product; every workload, slice layout, threshold,
number and schema is hypothetical, and nothing here describes how any company's
own clusters, schedulers or customers work. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## NVD-L3-01: GPU partition layouts over time — slices, the jobs they ran and utilisation per physical GPU

| | |
|---|---|
| **Template ID** | NVD-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / partitioned GPUs, layout history, slice identity, weighted utilisation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, ai-infra-engineer, ml-platform-engineer |

```params
{
  "gpus": {"1": ["2,000"], "2": ["12,000", "30,000"], "3": ["80,000", "200,000"]},
  "slices_per_gpu": [4, 8],
  "reconfigs_per_day": ["300", "2,000", "10,000"],
  "sample_seconds": [1, 10]
}
```

**Business Scenario.** A GPU cluster operator rents out {{gpus}} data-centre GPUs, either whole or partitioned into isolated slices. In this exercise a GPU can be split into at most {{slices_per_gpu}} fixed-size slices, each a multiple of 1/{{slices_per_gpu}} of the GPU, using one of a small catalogue of layouts the operator defines (for example one whole GPU, or a half plus two quarters). A layout can be changed only while the GPU is empty, and the scheduler changes layouts about {{reconfigs_per_day}} times a day to fit the queue. Each slice runs at most one job at a time. A telemetry exporter emits a utilisation sample every {{sample_seconds}} seconds per slice, labelled with the GPU serial number and the slice's position index on that GPU; after a reconfiguration the positions start again from 0. Teams are charged by slice-hours, and capacity planning wants to know how busy each physical GPU really was and how much capacity sat stranded in slices too small for the jobs waiting.

**Problem Statement.** Design the data model. Cover: physical GPUs; the layout catalogue (slice sizes and positions); the history of which layout each GPU had and when; slice instances with an identity that survives reconfiguration; job allocations to slices; and utilisation samples joined to the slice instance and job that produced them. Show how the model answers: "which job ran on GPU G, position P at time T", "utilisation per physical GPU per hour, weighted by slice size, counting idle slices and unpartitioned time", "slice-hours per team per month", and "hours each GPU spent in each layout, and stranded slice capacity per hour".

**Constraints.** A slice instance id is never reused, even when a new layout puts a slice at the same position. Utilisation per physical GPU must account for every slice and for time with no job. Samples can arrive up to 15 minutes late and out of order. Chargeback for a closed month changes only through a documented adjustment. History is kept for 13 months.

**Assumptions.** GPU counts, slice counts, layouts, sample intervals and reconfiguration rates are hypothetical and this exercise's own, not a description of any product's partitioning rules. A slice's utilisation sample is a percentage of that slice's own capacity. Clocks on the nodes are synchronised to within a second.

**Clarifications.**
- Q: Can a job span several slices? | A: No. A job asks for one slice of a given size; multi-GPU jobs use whole GPUs, which are a one-slice layout.
- Q: What does the exporter send during a reconfiguration? | A: Nothing for that GPU until the new layout is up; the gap lasts seconds to minutes.
- Q: How is a whole GPU represented? | A: Your choice, but the same queries must work for whole and partitioned GPUs. A one-slice layout is a common answer.
- Q: Is a slice with no job billed? | A: No. Teams pay for allocated slice-hours only; idle slices are the operator's cost and belong in the utilisation and stranded-capacity numbers.
- Q: What does stranded mean here? | A: Free slice capacity on a GPU at a time when every waiting job asked for a larger slice than any free slice on that GPU. Define it precisely in your answer.

**Hints.**
1. Separate three things that change at different rates: the layout catalogue (rarely), a GPU's layout history (minutes to hours), and allocations of jobs to slices (minutes).
2. The exporter's (serial, position) is a label, not an identity. Resolve it to a slice instance through the layout interval that contains the sample's time.
3. Weight each slice's utilisation by its size and give idle slices and gaps a utilisation of 0, or the per-GPU number describes only the busy part.

**Follow-ups.**
1. Write the query, against your model, for "which job ran on GPU G, position 1 at 14:05". What makes it correct across a reconfiguration at 14:00?
2. A GPU had a half plus two quarters from 10:00 to 10:40, with only the half busy at 100%, then one whole slice idle until 11:00. What is its utilisation for 10:00–11:00, and how does your model get it?
3. Samples arrive up to 15 minutes late, and some arrive after a reconfiguration. How do you attribute a late sample, and when is an hour's number final?
4. At {{gpus}} GPUs with samples every {{sample_seconds}} seconds per slice, what do you keep raw, for how long, and what rollups serve the dashboards and chargeback?
5. Define stranded capacity as a query. Which inputs does it need from the queue, and how would the scheduler team use it to choose layouts?

**Follow-up rules.**
- when: slice_index, slice index, position index, (serial, position) → ask: The layout changed at 14:00 and position 0 now belongs to a different slice and job. Which key does a 14:01 sample carry, and how does your model attribute it?
- when: avg, average utilization, average utilisation, mean → ask: One quarter-slice is at 100% and three quarters are idle. What does your average say about the GPU, and how do you weight it?
- when: scd, type 2, valid_from, effective dated → ask: Your layout history is effective-dated. Is the end of one interval the same instant as the start of the next, and which interval owns a sample at exactly that instant?
- when: update the slice, overwrite, current layout → ask: If the GPU row holds only the current layout, how do you answer which job ran on position 1 last Tuesday?
- when: billing, chargeback, slice-hours → ask: A job ran from 23:50 to 00:20 across a month end that was then closed. How are its slice-hours split, and what happens if a late sample changes them?

**Production Reality Check.**
- After a reconfiguration the exporter reported the new layout's first slice at position 0, the same label as the previous layout's half slice. A model joined on (serial, position) billed an hour of a new team's job to the team whose job ended just before the change.
- The fleet dashboard showed one pool at 90% utilisation while most of its GPUs had one busy small slice and the others idle: it averaged only the slices that sent samples and gave each the same weight.
- With about {{reconfigs_per_day}} layout changes a day, a scheduler release changed layouts on busy GPUs by mistake. Jobs were killed, and the layout history shows a layout change inside a running allocation.

**Evaluation Criteria.** GPU, layout catalogue, layout history and slice instances separated, with slice ids never reused; samples resolved from (serial, position, time) to a slice instance through the layout interval; allocations as intervals on slice instances; size-weighted utilisation with idle slices and gaps as zero; half-open intervals and a stated rule for late samples; chargeback from allocations, not samples, with month-close adjustments; a precise stranded-capacity definition; each incident contained, corrected and guarded.

## NVD-L3-02: Node and GPU inventory — serials in slots, firmware, burn-in and service state as of a date

| | |
|---|---|
| **Template ID** | NVD-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / asset identity versus position, effective-dated components, observed versus planned state |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, ai-infra-engineer, software-engineer |

```params
{
  "nodes": {"1": ["1,500"], "2": ["8,000", "15,000"], "3": ["40,000", "90,000"]},
  "gpus_per_node": [4, 8],
  "firmware_components": [3, 5],
  "rma_per_week": ["40", "250", "800"]
}
```

**Business Scenario.** A GPU cluster operator runs {{nodes}} GPU servers, each with {{gpus_per_node}} GPU slots, network adapters, a baseboard and power supplies. Components move: a GPU that fails is pulled for repair (about {{rma_per_week}} returns a week), a repaired or new GPU goes into whichever slot needs it, and whole nodes move between racks. Each node carries {{firmware_components}} firmware components (for example GPU, baseboard and network adapter firmware) that are updated in rolling waves. A new or repaired node runs a burn-in suite of stress tests before it enters service, and a node in service can be drained for repair or maintenance and later returned. Reliability engineers ask questions such as "which GPU serials were in node N on 3 March", "failure rate by firmware version", "how many nodes passed burn-in on the first attempt" and "how long do drained nodes take to return".

**Problem Statement.** Design the inventory model. Cover: assets with their own identity (GPU, node, adapter, baseboard) and where each was installed over time; firmware versions per component over time, distinguishing what a rollout intended from what the device reported; burn-in runs and their test results, including retests; and the node service lifecycle (received, burn-in, in service, drained, under repair, retired) with reasons. Show the queries for: the components and firmware of a node as of any date; the failure rate per firmware version with a correct denominator; first-attempt burn-in pass rate per month; and drain-to-return time per reason.

**Constraints.** History is never overwritten: any past state must be answerable. An asset's history follows the asset, not the slot it is in. Firmware state for analysis must be what the device reported, not what was planned. Corrections to recorded history (a wrong serial typed during a swap) must be possible without losing what was believed at the time.

**Assumptions.** Node counts, slot counts, component lists and return rates are hypothetical. Every component has a readable serial number. Devices report their firmware versions to an agent on the node every few minutes while the node is up.

**Clarifications.**
- Q: Do GPUs ever move between nodes without going through repair? | A: Yes. Technicians sometimes swap GPUs between nodes to isolate a fault.
- Q: Who records a swap? | A: A technician's work order says which serial was removed and which was installed; the node agent later reports the serials it actually sees. They can disagree.
- Q: What is a retest? | A: A burn-in suite run again on the same node after a fix. Keep every run; the question asks about the first attempt.
- Q: Is "as of" the date the change happened or the date we learned about it? | A: Both matter. Say which question each answers and whether your model can give both.
- Q: Is a firmware rollout instantaneous per node? | A: No. An update can fail and leave the old version, or need a reboot before the new version is active.

**Hints.**
1. Separate the asset (serial) from its position (node and slot), and record installations as intervals that link the two.
2. Keep the reported firmware versions as observations with times, and the rollout's intention as a separate record; derive "running version" intervals from observations.
3. Valid time (when it was true) and recorded time (when the inventory learned it) answer different questions; a correction is a new record, not an edit.

**Follow-ups.**
1. Write the as-of query for "GPU serials and firmware versions in node N on date D". Which intervals are half-open?
2. A work order says GPU A replaced GPU B in slot 3, but the node agent reports serial C. How do you store both, and which does the as-of query return?
3. Define failure rate per GPU firmware version so that a version deployed for two days is not compared unfairly with one deployed for two months.
4. A node failed burn-in twice and passed on the third run after a GPU swap. What are its first-attempt result, its burn-in time, and which GPU does the failure history attach to?
5. At {{nodes}} nodes with firmware observations every few minutes, how do you store reported versions without keeping billions of identical rows?

**Follow-up rules.**
- when: slot, slot_id, (node, slot), position → ask: A GPU was moved from node 7 slot 2 into node 9 slot 5 after repair. Where does its error history live in your model, and does the new GPU in node 7 slot 2 inherit anything?
- when: firmware_version column, current firmware, update the node → ask: The rollout updated the plan, but 3% of devices failed the update silently. What does your column say about them, and how would you know?
- when: scd, type 2, valid_from, effective dated → ask: A technician corrects a serial typed wrongly last week. Do you change the old interval or add a record, and can you still say what the inventory believed last week?
- when: pass rate, passed → ask: Is the denominator nodes or burn-in runs? How do retests and nodes still in burn-in at month end affect it?

**Production Reality Check.**
- A repaired GPU went into a different node. The inventory kept failure history by (node, slot), so the new GPU in the old slot inherited the old one's error history and was drained, while the repaired GPU appeared to have a clean record.
- A firmware rollout to {{nodes}} nodes was recorded from the rollout plan. Some nodes failed the update and kept the old version; a failure analysis by firmware version blamed the new version for failures on nodes that never ran it.
- Burn-in retests overwrote the first result, so the first-attempt pass rate rose from 82% to 97% in one month without any change on the floor.

**Evaluation Criteria.** Assets separate from positions, installations as intervals; firmware as reported observations compressed into intervals, kept apart from rollout intent; burn-in runs and test results as append-only rows with attempt numbers; lifecycle state as intervals with reasons; valid time and recorded time (or an equivalent correction log); correct denominators (component-days exposed per firmware version); as-of queries with half-open intervals; each incident contained, corrected and guarded.

## NVD-L3-03: Software stack provenance per job — reproducing a training performance regression

| | |
|---|---|
| **Template ID** | NVD-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / immutable image digests, host versus container components, run-time observation, stack diffs |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, ai-infra-engineer, ml-platform-engineer, software-engineer |

```params
{
  "jobs_per_day": {"1": ["5,000"], "2": ["40,000"], "3": ["250,000", "600,000"]},
  "images": ["800", "5,000"],
  "regression": ["6%", "15%"],
  "node_pools": [2, 4, 6]
}
```

**Business Scenario.** A team runs about {{jobs_per_day}} training and evaluation jobs a day on a GPU cluster with {{node_pools}} node pools. A job's performance depends on a stack of software: the GPU driver and firmware on the host; the container image (about {{images}} distinct images are in use), which carries a GPU programming toolkit such as CUDA, math and collective-communication libraries and a training framework; host libraries mounted into the container; environment variables and launch flags; and the job's own code and configuration. Job specifications reference images by tag, and tags move. Drivers are upgraded pool by pool. Last week a model's step time became {{regression}} slower than the week before, and nobody can say what changed between the two runs.

**Problem Statement.** Design the provenance model that lets anyone reproduce and explain a run. Cover: images identified immutably, with their component inventory (packages and versions); the host stack per node over time (driver, firmware, mounted libraries); the resolved stack per job run and per node it ran on, as observed at run time; the job's code version, configuration and launch flags; and performance results per run. Show how the model answers: "what exactly ran in job J", "which components differ between run A and run B", "which runs used library version V", and "did the step-time change follow a stack change or something else".

**Constraints.** A run's provenance is recorded once and never changes. Tags are not identities. A multi-node job may run on nodes with different host stacks, and that must be visible. Recording provenance must not add more than a few seconds to job start. Configuration values that are secrets are never stored.

**Assumptions.** Job, image and pool counts and the regression size are hypothetical. Images are built by a pipeline that can emit a component list. A small agent in each job can report loaded library versions and host details at start-up.

**Clarifications.**
- Q: Is the image component list enough? | A: No. A host-mounted library or an environment variable can change what is actually loaded. Say how you capture what ran, not only what was shipped.
- Q: Do we need every package in the image? | A: Store them all once per image digest; jobs reference the digest.
- Q: Are the two runs the same code? | A: The same repository, but possibly different commits and configuration. Your diff should show that too.
- Q: Do runs on different hardware count? | A: Yes. Two pools can have different GPU generations or interconnects; the diff must include hardware.
- Q: What performance data exists? | A: Per-step times and throughput reported by the training loop, plus job start and end.

**Hints.**
1. Identify images by content digest and store the tag only as an observation of what the tag pointed to when the job resolved it.
2. Separate declared provenance (spec, image manifest) from observed provenance (what the agent saw on each node at start-up), and keep both.
3. A diff between two runs is a comparison of two sets of (component, version) pairs; normalise the stack into rows so diffs are queries.

**Follow-ups.**
1. Write the query that lists components whose version differs between run A and run B, including components present in only one.
2. One 64-node job ran on two driver versions because a pool was mid-upgrade. How does your model show it, and how should step-time comparisons treat it?
3. The image tag was moved to a new build between the two runs. What did each run record, and how do you prove which image ran?
4. How would you find every run in the last month that loaded collective-communication library version V, at {{jobs_per_day}} jobs a day?
5. The step-time change did not coincide with any stack change. What else in your model would you check, and what is missing from it?

**Follow-up rules.**
- when: tag, image tag, latest → ask: The tag your job spec names was rebuilt between run A and run B. What does your model record for each run, and can you tell the two images apart?
- when: container image, image only, dockerfile → ask: A library mounted from the host overrides the one in the image. Where does your model see that?
- when: json blob, jsonb, document → ask: You store the stack as one document per run. How do you answer "which runs used library version V" across a month without scanning every document?
- when: per job, job level → ask: A multi-node job ran on nodes with two different driver versions. Does your job-level record show that, or only one of them?

**Production Reality Check.**
- A model's step time became {{regression}} slower. The job spec named the same image tag both weeks, but the tag had been rebuilt with a newer communication library; the run records had only the tag.
- A rolling driver upgrade across {{node_pools}} pools left one large job running on two driver versions; the provenance record took the first node's versions and the regression analysis compared it as if it were uniform.
- A host-mounted library was upgraded on one pool. Images were unchanged, so a provenance model built from image manifests showed identical stacks for a fast run and a slow one.

**Evaluation Criteria.** Images by digest with a component inventory stored once; host stack as effective-dated per node; observed per-node provenance at run time kept apart from declared; normalised (component, version) rows that make diffs and "which runs used V" queries; code commit, configuration and flags captured with secrets excluded; hardware in the diff; performance linked to runs; mixed-stack jobs visible; each incident contained, corrected and guarded.

## NVD-L3-04: Interconnect fabric topology over time — switches, ports, cables and link flaps

| | |
|---|---|
| **Template ID** | NVD-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / physical topology as a versioned graph, link state history, placement and fault queries |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, ai-infra-engineer, software-engineer |

```params
{
  "nodes": {"1": ["512"], "2": ["4,096"], "3": ["16,384", "32,768"]},
  "tiers": [2, 3],
  "nics_per_node": [4, 8],
  "flap_events_per_day": ["2,000", "50,000"]
}
```

**Business Scenario.** A GPU cluster operator connects {{nodes}} GPU nodes with a {{tiers}}-tier switched fabric. Each node has {{nics_per_node}} network adapters, each cabled to a leaf switch port; leaves connect up to the next tier. Physical changes are routine: cables are replaced, ports are re-cabled, a failed switch is replaced by a new one in the same position, and nodes move. Links also flap (go down and come back) and accumulate error counters; on a bad day the fabric reports about {{flap_events_per_day}} link state events. Two groups use the topology: the scheduler wants to place a job's nodes as close together as possible ("under the same leaf" or "within one hop of the same spine"), and the reliability team asks which jobs had nodes behind a link that flapped or a switch that was replaced, at the time it happened.

**Problem Statement.** Design the data model for the fabric as it changes. Cover: devices (nodes, adapters, switches) with physical identity separate from logical position; ports; cables; links as connections between two ports over a time interval; link state changes and error counters; and how the model serves both a current topology snapshot for placement and historical questions. Show how it answers: "which leaf and spine served node N's adapter k on date D", "the nodes under each leaf right now", "jobs with a node behind link L while it flapped", and "links that flapped more than K times in a day, with the cable and switch involved".

**Constraints.** Topology history is never overwritten. A replaced switch keeps its position and name but is a different device. The current snapshot must be readable by the scheduler in milliseconds. Link state events arrive at least once and can be out of order by up to a minute. The model must detect impossible states (one port connected to two cables at once).

**Assumptions.** Node, tier, adapter and event counts are hypothetical, and the topology is this exercise's own, not a description of any product's reference architecture. Switches report link state changes and per-port counters; cabling changes are recorded by technicians and, separately, discovered by a neighbour-discovery protocol that reports which port sees which peer.

**Clarifications.**
- Q: Is a link the same as a cable? | A: No. A cable can be moved to other ports; a link is "this port connected to that port" for an interval, and it is carried by a cable.
- Q: Which is the source of truth for cabling, technicians or discovery? | A: Neither alone. Discovery reports what is physically connected when the link is up; technicians record intent. Say how you reconcile them.
- Q: What is a flap? | A: A down followed by an up on the same link within this exercise's 60 seconds. Longer outages are outages.
- Q: How does the scheduler use the topology? | A: It needs, per node, the leaf of each adapter and the next tier above, refreshed within a minute of a change.
- Q: Do we model the switch's internals? | A: No. Ports and the links between them are enough.

**Hints.**
1. Separate physical identity (switch serial, cable id) from logical position (rack, slot, switch name) and link the two with effective-dated rows.
2. Keep link state as an append-only event table deduplicated by (link, timestamp, state), and derive intervals of up and down from it.
3. Serve the scheduler from a materialised current snapshot derived from the history, not from the history tables directly.

**Follow-ups.**
1. Write the query for "jobs with a node behind link L between its first and last flap on date D", against your model and a job allocation table.
2. A technician swapped two cables and recorded the swap on the wrong ports. Discovery reports something else. What does your model show, and which record wins?
3. A failed spine switch was replaced at 03:00 by a new device with the same name. How do "error counters for spine S this month" and "flaps per device" differ in your model?
4. At {{flap_events_per_day}} link events a day, how do you store raw events, derived intervals and daily summaries, and for how long?
5. How would you compute, for every pair of nodes, whether they share a leaf on any adapter, without materialising all pairs at {{nodes}} nodes?

**Follow-up rules.**
- when: graph database, neo4j, graph db → ask: The scheduler needs a snapshot in milliseconds and reliability needs history for months. Does one graph store serve both, and how do you version edges over time?
- when: adjacency, edges table, edge list → ask: An edge changes when a cable moves. Is your edge row updated or closed and replaced, and how do you answer which leaf served a node last month?
- when: switch_name, switch name, hostname → ask: The replaced spine kept its name. If your keys are names, how do you keep the old device's error history apart from the new one's?
- when: flap, flapping → ask: Your flap count comes from raw events. What happens to it when the feed redelivers a minute of events, or delivers a down after its up?

**Production Reality Check.**
- A technician recorded a cable swap on the wrong ports. For two days the model showed one adapter connected to two leaves, and the scheduler placed jobs it believed were under one leaf across two.
- One flapping port produced about a third of the day's {{flap_events_per_day}} link events. The nightly job that rebuilt the topology snapshot from raw events ran past its window, and the scheduler used a day-old snapshot.
- A spine switch was replaced in place and kept its name. Its error counters restarted from 0, and a dashboard that computed per-switch error deltas by name showed a large negative rate and hid the new switch's errors.

**Evaluation Criteria.** Devices, ports, cables and links as separate entities; physical identity apart from position and names; links as effective-dated port pairs carried by cables; reconciliation of technician records with discovered neighbours and a check for impossible states; link state as deduplicated events with derived intervals and a flap definition; a materialised current snapshot for placement; counter resets handled per device; historical job-to-link questions answered with as-of joins; each incident contained, corrected and guarded.

## NVD-L3-05: Jobs placed on a failing node — between the first fatal error and the drain

| | |
|---|---|
| **Template ID** | NVD-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / event state machines, exposure windows, interval joins, distinct counting, effective-dated membership |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, ai-infra-engineer, ml-platform-engineer |
| **Generator** | NVD-L3-05.mjs |

**Business Scenario.** A GPU cluster operator runs training jobs on clusters {{cluster_list}}. The GPU driver on each node reports Xid-style error events, each with a numeric `xid_code`; this exercise's lookup `xid_codes` says whether a code is `fatal` or a `warning` (the codes and their severities are hypothetical). Health checks are not instant: after a fatal error, a node keeps accepting new jobs until an operator or an automated check drains it. {{lifecycle_rule}} The reliability team wants to know, per cluster, how many jobs the scheduler placed on nodes in that gap, because those jobs started on a GPU that had already failed.

**Problem Statement.** Write one PostgreSQL query that returns `cluster, nodes_affected, jobs_placed, jobs_failed`: one row per cluster with at least one job placed in an exposure window, ordered by `cluster`. An exposure window on a node opens at a fatal error event (an `xid` event whose code has severity `fatal`) that occurs while the node is in service and no window is open, and closes at the node's next `drain` event; if there is no later drain, it is still open. Further fatal errors inside an open window change nothing. {{episode_rule}} A job was placed in a window if one of its allocations on that node has `started_at` at or after the window opens and strictly before it closes. `jobs_placed` counts distinct jobs, `nodes_affected` counts distinct nodes with such a placement, and `jobs_failed` counts distinct placed jobs whose `final_state` is `failed`. Count each placement in the cluster the node was assigned to when the allocation started (`node_assignments`, half-open `[assigned_from, assigned_until)`, NULL meaning still assigned). {{cluster_rule}}

**Constraints.** One SQL statement (CTEs and window functions allowed). The window includes its opening instant and excludes its closing instant. A job already running when the fatal error arrived was not placed in the window. The sample has {{events}} node events and {{allocations}} job allocations; production has billions of error events and millions of jobs a month.

**Assumptions.** Hypothetical schema, clusters, node ids, codes and times. No two events on the same node share a timestamp. A `drain` with no fatal error before it is a maintenance drain and opens nothing. Warning-severity events never open a window.

**Clarifications.**
- Q: Does a job that started exactly at the fatal error count? | A: Yes. The window opens at that instant.
- Q: And one that started exactly at the drain? | A: No. The drain closes the window at that instant.
- Q: A two-node job had both of its nodes in exposure windows. How many jobs is that? | A: One job. Both nodes count in nodes_affected.
- Q: Is a job that was already running at the fatal error placed in the window? | A: No. It was hit by the failure, which is a different question; this one asks what the scheduler placed after the failure.
- Q: Should I use nodes.cluster? | A: It is the node's current cluster. The rule is the assignment at the allocation's start time.

**Hints.**
1. Reduce the events to the ones that matter (fatal errors, drains and, where present, resumes) and walk them per node in time order: a window is the first fatal error after the node last came into service, up to the next drain.
2. A running count of drain and resume events per node splits the timeline into segments; in a segment that began in service, the first fatal error opens the window and the start of the next segment closes it.
3. Join allocations to windows on node and a half-open time range, then attach the cluster with a second half-open range join, and count DISTINCT ids.

**Follow-ups.**
1. Add the median minutes from the first fatal error to the drain per cluster. Which windows are excluded, and why?
2. The scheduler team says a drain takes effect only when the node agent confirms it, up to 2 minutes later. How would you change the window's end, and what data would you need?
3. At billions of error events, how would you keep exposure windows up to date incrementally instead of re-walking every node's history?
4. Turn this into an alert: what would page, on which threshold, and how do you avoid paging on maintenance drains?

**Follow-up rules.**
- when: min(occurred_at), min(, first fatal → ask: A node failed, was drained, returned to service and failed again. What does the minimum fatal time per node give you for the second failure?
- when: count(*), count(job_id) → ask: A two-node job had both nodes in exposure windows, and a requeued job has two attempts. What does your count say for each?
- when: nodes.cluster, join nodes → ask: A node was moved to another cluster during its repair. Which cluster does a job placed on it last week belong to in your query?
- when: inner join, join drains → ask: A node failed and has not been drained yet. Does your join keep its window, and is it the one reliability most needs to see?
- when: ended_at, overlaps → ask: Why does a job that started before the fatal error and ended after it not count here? Which question would it answer?

**Production Reality Check.**
- The automated drain ran only on an hourly health sweep, so nodes stayed in service for up to an hour after a fatal error. This report showed dozens of jobs a day placed on failing nodes, most of which failed within minutes and were requeued, sometimes onto the same node.
- A driver update reclassified one code from warning to fatal in the lookup. The next run of this report rewrote last month's numbers; the team had to decide whether to version the lookup by effective date.
- During a repair wave, several nodes were moved to another cluster while drained. The weekly report attributed their earlier failures to the cluster they had just joined, until it switched to node_assignments.

**Evaluation Criteria.** Only fatal-severity events open windows (via the lookup); windows opened only from in service and closed by the next drain; at Hard and above, several windows per node with resumes, a fatal error while drained ignored, and open windows kept; half-open placement on started_at; distinct jobs and nodes; the cluster as assigned at the allocation's start; deterministic ordering; can discuss confirmation lag, incremental windows and alerting without paging on maintenance.
