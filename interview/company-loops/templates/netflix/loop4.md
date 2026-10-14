# Netflix · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of a global video
streaming service (plans, profiles, devices, a catalogue that differs by country,
recommendations, and its own content delivery network of cache servers placed in
internet providers' networks). Every workload, number and schema is
hypothetical, and nothing here describes how the company's own systems are built.

## NFX-L4-01: "Continue watching" resume points at global scale

| | |
|---|---|
| **Template ID** | NFX-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Distributed state / per-profile resume points, multi-device conflicts, region failover |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "profiles": {"2": ["200 million", "300 million"], "3": ["500 million", "700 million"]},
  "peak_streams": {"2": ["15 million", "25 million"], "3": ["40 million", "60 million"]},
  "heartbeat": [10, 30, 60],
  "regions": [3, 4]
}
```

**Business Scenario.** A streaming service has about {{profiles}} profiles; one account holds several profiles and plays on TVs, phones, tablets, browsers and game consoles. While a title plays, the player reports its position every {{heartbeat}} seconds and on pause, seek, stop and app close. At peak, {{peak_streams}} streams play at the same time. Each profile's home page has a "Continue watching" row: titles started and not finished, most recent first, each with a progress bar. Pressing play resumes at the saved position on any device, and a member can remove a title from the row. Members can also download titles to a phone and watch them offline. The service runs in {{regions}} cloud regions; any region can serve any member, and when a region fails its traffic moves to the others.

**Problem Statement.** Design the resume-point service and the "Continue watching" row. Cover the write path from players, the store and its keys, how conflicting updates are resolved when two devices on one profile play (or one was offline), what "finished" means for films and for episodes (and how the next episode appears), the read path for the home page and for the play button, the "remove from row" action, replication across regions and failover, and how this data feeds viewing history and recommendations without coupling them to the play button's latency.

**Constraints.** Resume lookup when play is pressed: p99 under 50 ms. A position saved on one device should be visible to another device of the same profile within a few seconds in the same region. A member must never be moved backwards by more than one heartbeat interval because a stale or delayed update won. Offline playback reports its positions when the phone reconnects, possibly days later. Kids profiles' rows never show titles above the profile's maturity setting.

**Assumptions.** All volumes, intervals and latency targets are hypothetical. Each play starts with a request to the service (to obtain the stream), so the server sees the start of every online playback session. Device clocks are usually right but not always.

**Clarifications.**
- Q: If two devices on one profile play the same title at once, which position wins? | A: You decide and justify it; people do occasionally share a profile.
- Q: When is a title finished? | A: When the end credits start, or when 95% has played if no credits marker exists. For a series, the next episode then appears in the row at its beginning.
- Q: Do offline positions count? | A: Yes, when they arrive, but they must not overwrite a newer position made on another device.
- Q: Does "remove from row" delete viewing history? | A: No. It hides the title from the row only; viewing history stays. If the member plays it again, it comes back.
- Q: After a region failure, how much position loss is acceptable? | A: Up to one heartbeat interval. Resuming from an hour ago is not acceptable.

**Hints.**
1. Compute the write rate first: peak streams divided by the heartbeat interval. Then decide what must be written durably at that rate and what can be coalesced.
2. Order updates for one profile and title by something the playback session controls (a session id and a sequence number, with a server-observed session start), not by arrival time at the server.
3. Keep the resume point (tiny, per profile, read on every play) separate from viewing history (append-only, large, used by analytics and recommendations).

**Follow-ups.**
1. What is the peak write rate, and what do you persist per heartbeat versus per playback session?
2. A phone watches episode 3 offline on a flight while the TV at home watches episode 5. The phone reconnects. What does the row show, and why?
3. A region fails at peak. What does a member who switches device and presses play in another region a minute later get, and what did you replicate to make that so?
4. How do you build the row itself (ordering, finished titles, next episodes, removed titles) within the latency target for a profile with ten thousand titles in its history?
5. How would you prove that members are rarely moved backwards? Name the metric and the client data that measures it.

**Follow-up rules.**
- when: last write wins, last-write-wins, lww → ask: Last by which clock? A phone whose clock is ten minutes fast sends an older position. Does it win?
- when: cassandra, dynamodb, key-value, wide-column → ask: What are the partition and clustering keys, and how do you read the row for a profile with ten thousand watched titles?
- when: kafka, stream, queue → ask: The queue backs up for two minutes. The member switches from phone to TV and presses play. What position do they get?
- when: cache, redis → ask: After a failover the cache and the store disagree about a resume point. Which one does the play button trust, and how does it notice the disagreement?
- when: crdt, vector clock, merge → ask: What is your merge rule for a position, and can it ever produce a position that no device actually reached?

**Production Reality Check.**
- A TV app release sends a position of 0 in the first heartbeat of every session, before seeking to the saved point. Within an hour, millions of profiles that watched on that device type see their titles restart from the beginning on their other devices.
- One of the {{regions}} regions fails at peak. Traffic moves to the others within two minutes, but cross-region replication was six minutes behind, so members who switch device right after the failover resume up to six minutes earlier than where they stopped.
- A mobile release syncs a backlog of offline positions all at once: titles finished days ago jump back to the front of "Continue watching" for many profiles, ahead of what they watched last night.

**Evaluation Criteria.** Sizes the write rate and coalesces heartbeats without breaking the one-interval loss bound; keys resume points by profile and title with explicit session and sequence ordering and a stated rule for clocks and offline plays; precise finished and next-episode rules; a precomputed or bounded row read path rather than a scan of history; "remove from row" as a hide marker that a later play overrides; multi-region replication with a stated lag budget and a client-side last-known position as a guard; viewing history as a separate append-only stream; a backwards-jump metric measured from clients; adapts to each incident with diagnosis, recovery and prevention.

## NFX-L4-02: Catalogue search with localised titles and per-country availability

| | |
|---|---|
| **Template ID** | NFX-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Search systems / multilingual indexing, time-windowed availability, near-real-time updates |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "titles": {"2": ["15,000", "30,000"], "3": ["60,000", "100,000"]},
  "languages": [20, 35, 50],
  "qps": {"2": ["40,000", "80,000"], "3": ["200,000", "400,000"]},
  "freshness": ["1 minute", "5 minutes"]
}
```

**Business Scenario.** A streaming service's catalogue differs by country. A title can be available in one country and not another; availability windows open and close on dates and local times set by licences, often at local midnight. The catalogue holds about {{titles}} titles (films and series), each with localised names in up to {{languages}} languages, its original title, cast and crew, genres, and maturity ratings that differ by country. Members search from TV remotes (letter by letter, so prefixes matter), phones and browsers, usually in their profile's language, sometimes in another script, often misspelled. Search peaks at {{qps}} queries per second worldwide. Catalogue editors, the licensing system and the localisation pipeline change titles, names and windows throughout the day.

**Problem Statement.** Design the search and discovery index. Cover the indexed document (titles, localised names, people, genres, per-country windows, maturity), how changes reach the index within {{freshness}}, how queries match (prefix, typo tolerance, transliteration, several languages), how country availability and profile maturity are enforced, the ranking inputs, what a member sees for a title that is not available in their country, and how the index is rebuilt without downtime.

**Constraints.** A title must stop being returned as playable in a country within one minute of its window ending there, whatever the pipeline lag. Kids profiles must never see a title above their maturity level, including in autocomplete suggestions. Search p99 under 100 ms. Search must keep working if any single region fails.

**Assumptions.** All counts, rates and targets are hypothetical. A personalisation service returns a score per profile for a list of up to a few hundred candidate title ids in under 20 ms. Playback separately checks the licence before streaming.

**Clarifications.**
- Q: Are window boundaries exact to the minute? | A: Licences state a date and a local time per country; the business wants removal within a minute of the boundary.
- Q: Should titles unavailable in my country appear at all? | A: Never with a play button. A search for one should show related titles that are available. Titles announced as coming soon may appear with a reminder option.
- Q: Do we search people and genres too? | A: Yes: actors, directors and genres, each leading to titles available in the member's country.
- Q: Which languages does a member search in? | A: Mostly the profile language, but names in the original language and in English are commonly typed too.

**Hints.**
1. Availability is a time window. Store the windows in the index and filter by the current time at query time, rather than relying on an update event arriving exactly at the boundary.
2. Separate matching (which titles are candidates) from ranking (their order), and apply the hard filters (country, window, maturity) before you truncate to the top K.
3. Analysers (tokenisation, diacritics, transliteration) are part of the index schema. Changing one means a rebuild, so plan rebuilds as a second index with an alias switch.

**Follow-ups.**
1. Sketch the indexed document for one title. Where do per-country windows and maturity ratings live, and how large does the document get?
2. A licence ends at 00:00 local time in one country while the indexing pipeline is 20 minutes behind. Walk through what a member there sees at 00:01.
3. A member on a TV types three letters with the remote. How do you return good suggestions in under 100 ms across {{languages}} languages?
4. A new transliteration analyser needs a full rebuild while editors keep changing titles. How do you rebuild and switch without losing their updates?
5. How would you measure search quality per country and language, and catch a regression that affects only one script?

**Follow-up rules.**
- when: elasticsearch, opensearch, solr, lucene → ask: One index for all countries or one per country? What does each cost when one title's windows change in 150 countries at once?
- when: cdc, change data capture, kafka, event → ask: The change stream is 20 minutes behind at a window boundary. Does the title stay searchable past its licence end in your design?
- when: post-filter, filter after → ask: You filter after taking the top K. A kids profile types a common word and the top 50 matches are all mature titles. What does it see?
- when: cache, cached → ask: What is your cache key, and how do you keep a cached result from showing a title whose window has just closed?
- when: per country, index per country, per-country index → ask: How many index copies is that, and how do you apply one title edit to all of them consistently?

**Production Reality Check.**
- A popular series' window ends at local midnight in one country, but the index stores availability as dates in UTC. For several hours members there still find it in search and press play, and playback fails with a licence error.
- The localisation pipeline publishes names in all {{languages}} languages for a new release in one batch; a malformed file sets the name to an empty string in one language, and on launch day the title cannot be found by name in that language.
- After a change that moved the maturity check from the index query into a later processing step, a cache in front of autocomplete serves kids profiles suggestions that include a mature title's name for 30 minutes.

**Evaluation Criteria.** A document model with per-country windows stored as instants converted from local time, and maturity per country; query-time filtering on country, window and maturity before top-K; prefix, typo and transliteration matching with per-language analysers and fallbacks to original and English names; two-stage ranking with personalisation on a bounded candidate set; a change stream with a stated freshness, plus query-time enforcement so lag cannot extend a licence; cache keys that include country, language and maturity and expire at the earliest window end; rebuilds by snapshot plus replay with an alias switch; per-region replicas with no single-region dependency; quality metrics per country and script; adapts to each incident with diagnosis, recovery and prevention.

## NFX-L4-03: Media encoding asset catalogue and re-encode campaigns

| | |
|---|---|
| **Template ID** | NFX-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Metadata platforms / immutable assets, lineage, lifecycle states, campaign tracking |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "assets": {"2": ["20,000", "40,000"], "3": ["80,000", "150,000"]},
  "renditions": [60, 150, 400],
  "petabytes": {"2": [5, 12], "3": [30, 60]},
  "campaign": ["re-encoding the back catalogue with a newer video codec", "re-encoding every HDR title with new encoder settings", "re-encoding the lowest bitrates of every title for mobile networks"]
}
```

**Business Scenario.** Each film or episode arrives as a high-quality source file and is encoded into many renditions: video at several resolutions and bitrates in several codecs, HDR and SDR versions, audio in several codecs and languages, and subtitle files. An asset has about {{renditions}} renditions; the catalogue holds {{assets}} assets and about {{petabytes}} PB of encoded media in object storage. Every video rendition carries quality scores from a perceptual quality metric, computed per shot and for the whole file. Devices receive a manifest listing the renditions they can play. The encoding team runs campaigns, such as {{campaign}}, that create new renditions for many assets over several weeks and retire the old ones.

**Problem Statement.** Design the asset catalogue. Cover the data model for sources, renditions, encoding recipes, quality scores and QC results, with their lineage; the lifecycle of a rendition from requested to deleted; how the set of renditions a manifest may use is chosen and switched; campaign planning and tracking (done, failed, retried, cost, quality gained); safe retirement and deletion of superseded files; and the queries the encoding team and finance need.

**Constraints.** A rendition is never served before it passes QC (automated checks, plus human review for some titles). A re-delivered source (for example with corrected colour) invalidates every rendition made from the previous version. Devices and edge caches may hold a manifest for up to 24 hours, so a file a manifest references must stay downloadable that long. Campaigns must be resumable and must never redo work that already succeeded.

**Assumptions.** All counts, sizes and durations are hypothetical. Media files live in object storage; the catalogue holds metadata, locations, checksums and states, not the media. The quality metric is versioned and is updated from time to time.

**Clarifications.**
- Q: Can a rendition be modified after it is made? | A: Treat files as immutable. A change is a new rendition.
- Q: Who reads the catalogue? | A: The manifest service (on every play, through caches), the encoding pipeline, QC tools, campaign dashboards, and finance for compute and storage cost by title and campaign.
- Q: Are quality scores comparable across metric versions? | A: No. Scores are comparable only within one metric version.
- Q: How are failures in a campaign handled today? | A: With spreadsheets and reruns of whole batches. The team wants something better.

**Hints.**
1. Identify a rendition by its full recipe: source version, codec and profile, resolution, bitrate, encoder version and parameters. Re-encoding creates new records; nothing is updated in place.
2. Separate a rendition's lifecycle state from the asset's live set (the renditions manifests may use), and switch live sets as whole, versioned records.
3. A campaign is a plan (which assets, which recipes) plus a ledger of task outcomes, so progress, retries and cost become queries.

**Follow-ups.**
1. Name the main entities and their keys. How do you know which source version and encoder version produced a given file?
2. Halfway through the campaign, sources for 300 episodes are re-delivered with corrected colour. What happens to renditions in flight and to the live ones?
3. How does the manifest service get the live set at play time without reading the catalogue database on every play?
4. When is it safe to delete the files superseded by the campaign, and how do you prove that nothing still references them?
5. Finance asks what the campaign cost and what it bought. Which queries answer that, and against which quality metric version?

**Follow-up rules.**
- when: update, overwrite, in place → ask: You update a rendition's row in place after re-encoding. A device holds yesterday's manifest pointing at it. What does it download?
- when: s3, object storage, blob, bucket → ask: The upload succeeds but the catalogue write fails, or the reverse. How do the catalogue and the object store stay consistent?
- when: delete, deletion, garbage collection, cleanup → ask: What exact condition allows a file to be deleted, and who can override it?
- when: vmaf, quality score, psnr, quality metric → ask: The quality metric gets a new version halfway through the campaign. How do you compare old and new renditions fairly?
- when: workflow, orchestrator, airflow, queue → ask: The campaign is 60% done when a bug is found in one codec profile of the encoder. How do you find and redo exactly the affected renditions?

**Production Reality Check.**
- During the campaign ({{campaign}}), a scheduling bug adds new renditions to live sets before automated QC has finished; on one device family, 2% of plays of the affected titles show corrupted green frames until the renditions are pulled.
- A cleanup job deletes superseded renditions 12 hours after each asset's live set switched, while manifests cached for up to 24 hours still reference them; plays started from those manifests fail over to other renditions at lower quality, and some fail outright.
- The quality metric is upgraded mid-campaign. The campaign dashboard compares new renditions scored with the new version against old renditions scored with the old one, and reports a quality gain that disappears when both are scored with the same version.

**Evaluation Criteria.** Immutable rendition records identified by full recipe and source version, with checksums and storage locations; QC results and quality scores as separate records keyed by metric version; explicit lifecycle states with publication only from an approved state, enforced where live sets are written; versioned live sets switched atomically per asset and served to manifests through a replicated read path; source re-delivery handled by lineage queries; campaigns as plans plus task ledgers with idempotent, resumable tasks and per-task cost; deletion gated on references, the manifest cache window and a recoverable soft delete; consistency between object store and catalogue; adapts to each incident with diagnosis, recovery and prevention.

## NFX-L4-04: Pre-positioning titles on edge caches overnight, and measuring it

| | |
|---|---|
| **Template ID** | NFX-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Content delivery / demand forecasting, capacity-constrained placement, offload metrics |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer |

```params
{
  "sites": {"2": ["1,500", "4,000"], "3": ["8,000", "15,000"]},
  "cache_tb": [100, 250, 400],
  "fill_hours": [4, 6, 8],
  "catalogue_pb": {"2": [3, 6], "3": [10, 20]}
}
```

**Business Scenario.** A streaming service delivers video from its own content delivery network: cache servers installed inside internet providers' networks and at internet exchange points, grouped into {{sites}} sites. Each site holds about {{cache_tb}} TB, while the encoded catalogue is about {{catalogue_pb}} PB, so a site can hold only a small fraction of it. Rather than filling caches only when a member asks for something, the service fills them ahead of time during each site's quiet hours, a fill window of about {{fill_hours}} hours of local night, choosing which renditions of which titles to place where. A play that misses its site is served from a larger upstream site, which uses provider and transit capacity and can lower the quality the member gets.

**Problem Statement.** Design the system that decides each night what every site should hold, and that measures whether it worked. Cover demand prediction per title, rendition and site (including new releases with no history), the placement decision under storage and fill-bandwidth limits, how the decision reaches the caches and how they fetch, what happens during the day when the prediction was wrong, and the metrics, defined precisely, that show whether placement is good.

**Constraints.** Fill traffic must stay inside each site's window and within a bandwidth budget agreed with the provider. A cache must never evict a file it is currently serving. Fill windows are staggered by time zone, and the decision for each site must be ready before its window opens. Some new releases launch at the same moment in every country, which is mid-afternoon in some time zones.

**Assumptions.** All counts, sizes and windows are hypothetical. Request logs from every site (rendition requested, bytes served, hit or miss) arrive within an hour. Each site's audience uses a known mix of devices, so only some codecs and resolutions are requested there.

**Clarifications.**
- Q: Does a site hold every rendition of a title it holds? | A: No. You choose per rendition; a site whose audience is mostly on phones needs different files from one serving mostly TVs.
- Q: Can a cache still fetch on demand during the day? | A: Yes, a miss can be filled from an upstream site, but that uses daytime capacity the providers want kept small.
- Q: What do we know about a new release before launch? | A: Only pre-launch signals: similar titles' history, trailer views, marketing plans per country. Say how you deal with the uncertainty.
- Q: How often can placement change? | A: Once a night per site is the norm; you may propose more, with its cost.

**Hints.**
1. Demand is heavily skewed: a small share of files serves most bytes. Decide on value per byte stored (predicted bytes served from this site divided by file size), not on title popularity alone.
2. Placement is a capacity-constrained selection per site with two budgets: storage, and the fill bytes available tonight. A file already on the site costs no fill bytes.
3. Measure in bytes: the share of bytes the site served itself (byte offload). A request hit ratio flatters small files.

**Follow-ups.**
1. What are the inputs to tonight's decision for one site, and how do you turn a forecast into a ranked list of files that fits {{cache_tb}} TB?
2. A title launches globally tomorrow with no viewing history. Which sites get which of its renditions, and how sure are you?
3. A site's fill window is cut short by maintenance at the provider. What is filled first, and how was that order decided?
4. How do you evaluate a new placement algorithm against the current one without risking a bad night across the whole network?
5. Leadership asks whether pre-positioning is worth its cost compared with filling on demand. What do you measure, and what is the counterfactual?

**Follow-up rules.**
- when: lru, lfu, eviction → ask: If caches can manage themselves on demand with LRU, what does overnight placement add, and how would you measure the difference?
- when: hit ratio, hit rate → ask: A request hit ratio or a byte hit ratio? A site serves many small audio and subtitle files and few large 4K files. Which number misleads, and how?
- when: forecast, prediction, machine learning → ask: On its second day a surprise hit gets five times the forecast demand. How quickly does placement correct, and through what path?
- when: knapsack, optimisation, optimization, solver → ask: With thousands of sites and millions of files, does your solver finish before the first fill window opens? What do you give up for speed?
- when: a/b, experiment, canary, holdout → ask: Two placement policies run on different sites. How do you make the comparison fair when the sites differ in size and audience?

**Production Reality Check.**
- On its second day a surprise hit draws five times its forecast demand in one region. Many sites there miss on its renditions during the evening peak, and on-demand fills from upstream sites saturate provider links.
- Maintenance at a provider cuts one large site's fill window from {{fill_hours}} hours to 2. The night's fill completes about a third of the planned bytes, and the next evening's offload at that site drops sharply.
- A dashboard reports a 97% hit ratio for a new placement policy. It counts requests; measured in bytes, offload fell, because the policy favours small audio and subtitle files over large video renditions.

**Evaluation Criteria.** Forecasts per title and country distributed to sites by audience and device mix, with priors for new releases and explicit uncertainty; placement per site by value per byte under storage and fill budgets, with stickiness for files already present; prioritised fill lists that degrade gracefully when a window is cut; an intra-day correction path with its own budget; byte-based offload and quality outcomes as the primary metrics, with fill efficiency and forecast error alongside; policy evaluation by offline replay of logs and controlled rollouts with a stated counterfactual; compute that finishes per staggered window; adapts to each incident with diagnosis, recovery and prevention.

## NFX-L4-05: Live-event voting and reactions from millions of viewers

| | |
|---|---|
| **Template ID** | NFX-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Real-time systems / burst ingestion, exactly-once counting, fairness under stream delay |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "viewers": {"2": ["5 million", "15 million"], "3": ["40 million", "70 million"]},
  "window": [30, 60, 120],
  "options": [2, 3, 4],
  "delay": ["up to 30 seconds", "up to 60 seconds"]
}
```

**Business Scenario.** A streaming service broadcasts live events, such as a talent show or a live special. At set moments the host opens a vote: viewers choose one of {{options}} options on their TV, phone or browser within a {{window}}-second window, and the result is revealed on air a few minutes later and shown in the app. Viewers can also send emoji reactions, shown back to everyone as a live reaction meter. Peak audience is {{viewers}} concurrent streams, and viewers watch at different delays behind the live broadcast ({{delay}}), depending on device, network and buffering.

**Problem Statement.** Design vote and reaction collection and counting. Cover how the vote window is presented on the client, ingestion, deduplication (one counted vote per eligible profile per poll), counting with a final result that is reproducible and auditable, the path to the on-air reveal, reactions aggregated in near real time, and protection against scripted or duplicated voting. Say what "fair" means in your design and how you would prove the count afterwards.

**Constraints.** The final count must be ready within two minutes of the window closing and be reproducible from stored records. A vote counts only if it was cast while the vote was open in the stream the viewer was watching. Clients retry failed requests. Reactions may be approximate and lossy; votes may not be lost or double counted.

**Assumptions.** All audience sizes, rates and timings are hypothetical. Every request carries a signed token identifying the account, profile and playback session.

**Clarifications.**
- Q: One vote per what? | A: One vote per profile per poll; profiles on the same account vote separately. Kids profiles are not eligible.
- Q: Can a viewer change their vote? | A: Yes, until their window closes; the last choice counts.
- Q: Viewers are behind live by different amounts. When does the window close for each of them? | A: That is the core fairness question. Propose a rule and defend it.
- Q: Do producers need counts during the window? | A: They want approximate running counts in the control room. The reveal uses only the final count.
- Q: Are reactions ever used for results? | A: No. The meter shows approximate rates only.

**Hints.**
1. Votes and reactions need different guarantees, so give them different paths: a durable, idempotent path for votes and an aggregated, sampled path for reactions.
2. Tie the window to the stream: open and close markers can travel inside the video stream, so each client opens and closes the vote at the same point in what it shows. Add a server-side bound as well.
3. Key each vote by (poll, profile) with a client sequence number, so retries and changed votes resolve to exactly one final choice.

**Follow-ups.**
1. Estimate the peak vote rate. Where does your design hit its first limit?
2. A viewer near the maximum delay votes 20 seconds after the vote closed in the live broadcast. Does it count, and how does your server know?
3. One ingestion region loses its connection to the counting tier during the window. What happens to those votes, and how is the final count still correct?
4. How do you detect and handle scripted voting from a small number of accounts or devices?
5. After the show, someone disputes the result. What can you produce to prove it?

**Follow-up rules.**
- when: kafka, kinesis, pub/sub, partition → ask: How is the vote topic partitioned? What happens to one partition if you key by option and one option takes most of the votes?
- when: redis, counter, incr, increment → ask: A counter node fails mid-window. How do you rebuild the exact count, and can a retried vote be counted twice?
- when: timestamp, server time, clock → ask: Whose clock decides whether a vote was on time: the device's, the server's, or the stream's? What can each one get wrong?
- when: rate limit, captcha, bot → ask: Your bot defence blocks real viewers in a country where many people share mobile IP addresses. How would you find out, and what is the trade-off?
- when: approximate, sampling, hyperloglog → ask: Which numbers in your design may be approximate and which must be exact? Point to the component where one becomes the other.

**Production Reality Check.**
- When the vote opens, clients on one TV platform retry every failed submission immediately with no backoff. The ingestion tier sees six times the expected request rate in the first ten seconds and starts rejecting votes from every platform.
- One ingestion region loses its link to the counting tier for 20 seconds during the {{window}}-second window; the votes it accepted arrive at the counters after the window has closed everywhere else.
- A stream encoder in one region inserts the vote-close marker 25 seconds late, so viewers on that feed can vote 25 seconds longer than everyone else. The leading option's margin is smaller than the number of votes cast in those extra seconds.

**Evaluation Criteria.** Separate durable vote and lossy reaction paths; a peak-rate estimate that drives the design; idempotent votes keyed by poll and profile with last-choice semantics; a window defined by stream position with a server-side bound, and a stated fairness rule; durable acknowledgement before counting, partitioning that avoids hot options, and a final count gated on every region's watermark; approximate running counts clearly labelled; eligibility and anti-automation tied to authenticated, actively playing sessions; an auditable vote log that allows an independent recount; pre-agreed policies for disruptions; adapts to each incident with diagnosis, recovery and prevention.
