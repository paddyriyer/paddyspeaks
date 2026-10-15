# xAI · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of a model API
platform with real-time data: server-side tools for web search and search over
public posts that return citations, real-time ingestion of public posts for
retrieval, per-model rate limits that scale with a team's spend tier, and usage
analytics for teams. They are not questions from any company's interviews, and
they describe no company's or partner's internal systems or data. Every trace,
token, volume, rule, price and schema is hypothetical and this exercise's rule
(check current docs). Words are synthetic integer tokens; public posts are public
posts with a given schema; authors and users appear only in aggregate, except a
team's own usage shown to that team. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## XAI-L2-01: Tool-call loops — the repeating cycle a server-side tool trace ends in, and how far back it reaches

| | |
|---|---|
| **Template ID** | XAI-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Strings / Z-function of the reversed trace, periods of every suffix in one pass |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ai-infra-engineer, ml-platform-engineer |
| **Generator** | XAI-L2-01.mjs |

**Business Scenario.** When a model answers with server-side tools, it chooses each next call itself: search the web, search public posts, open a result, search again. Sometimes it gets stuck and repeats the same few calls until a call budget stops it. The platform's trace analytics flags responses whose tool trace ends in such a loop and shows each team, for its own usage, which cycle repeated and from which call the loop began, so the wasted calls can be counted. Long-running agent sessions produce traces of tens of thousands of calls.

**Problem Statement.** Implement `find_loops(traces, r, max_cycle)`. Each trace lists the calls of one response in the order they ran; each call is an integer id (the tool and its normalised arguments, interned earlier so that equal calls share an id). For a trace of `n` calls and a cycle length `p`, the **reach** of `p` is the number of calls at the end of the trace that repeat with period `p`: the largest `L ≤ n` such that `trace[i] == trace[i + p]` for every `i` with `n − L ≤ i < n − p`. The reach is always at least `p`.
1. A cycle length `p` (from 1 to `n // r`) is a **loop** when its reach is at least `r · p`: at least `r` full copies of the last `p` calls end the trace. {{cap_rule}}
2. Among the loops of a trace, report the one with the **longest reach**; ties go to the **shorter** cycle.
3. Report it as `(p, start, copies)`: `start = n − reach` is the index of the first call of the looping stretch, and `copies = reach // p` is the number of full copies in it. Return `None` for a trace with no loop.
Return one result per trace, in order. In this instance `r` is `{{r}}` in every check.

**Constraints.** Four traces of 60 000 calls in the timing check, each ending in one short loop that covers the last 60 to 70 percent of the trace, with a few stumbles early in the loop. Measuring every cycle length's reach call by call is O(n) per length and O(n²) per trace, and so is skipping the lengths that fail early, because every multiple of the loop's length is also a loop that reaches back to the start of the stretch. Something close to O(n) per trace is expected.

**Assumptions.** Traces, call ids, `r` and the cap are hypothetical; this definition of a loop is this exercise's rule, so check current docs for how any real tool reports or limits repeated calls. Equal ids mean equal calls; deciding that two calls are "the same" happened before this function. `r ≥ 2`.

**Clarifications.**
- Q: Why not report the shortest cycle that repeats `r` times? | A: Because a trace like search, open, open, search, open, open, search, open, open ends in "open, open": a one-call cycle that repeats twice. The loop that wasted the calls is three calls long and covers the whole trace. The longest reach is the loop to report.
- Q: Does the looping stretch have to begin at the start of a cycle? | A: No. It can begin part way through one; `start` is its first call, and `copies` counts only full copies.
- Q: A cycle and its double reach equally far. Which do I report? | A: The shorter one.
- Q: The model looped for a while and then made one different call. | A: That loop is over. A trace is judged only by the calls that end it: unless some cycle repeats at least `r` times up to and including the last call, return `None`.
- Q: What about an empty trace, or one shorter than `r`? | A: No cycle length qualifies, so `None`.

**Hints.**
1. Read the trace backwards. "The calls at the end that repeat with period `p`" becomes "how long the reversed trace agrees with itself shifted by `p`".
2. For the reversed trace `s`, let `z[p]` be the length of the longest common prefix of `s` and `s[p:]`. Then the reach of `p` is `p + z[p]`, capped at `n`.
3. The Z-function computes `z` for every shift in O(n), reusing the rightmost window `[left, right)` already known to match the start of `s`. Then one pass over `p` picks the loop.

**Follow-ups.**
1. Prove that a multiple of a loop's cycle length reaches exactly as far as the loop itself. Does skipping multiples make the call-by-call approach fast enough on every trace?
2. The trace now streams in. Flag the loop at the call that completes the `r`-th copy. What changes, and what would you keep per response?
3. The model rephrases its query slightly on every lap, so the calls are not exactly equal. How would you decide that two calls are the same, and where in the pipeline should that rule live?
4. Across all responses in a day, the console should show each team its wasted calls by tool. What would you store per response, and what would you never store?

**Follow-up rules.**
- when: z-function, z array, z algorithm → ask: What does `z[p]` mean for the reversed trace, and why is the reach of `p` equal to `p + z[p]`?
- when: kmp, prefix function, failure function → ask: The prefix function gives the borders of each prefix. How would you get the reach of every cycle length from it, and is it still one pass?
- when: early exit, break, for each length, for p in range → ask: Your check stops early when a length cannot reach `r` copies. How many calls does it walk for a length that can, on a 40 000-call loop of 3 calls, and how many such lengths are there?
- when: shortest, smallest period, first match → ask: Take search, open, open repeated three times with `r = 2`. Which cycle does your code report, and is that the loop?
- when: hash, rolling hash → ask: How do you compare two blocks of calls with hashes, and how do you make sure a collision never reports a loop that is not there?

**Evaluation Criteria.** The reach defined from the end of the trace and computed correctly, including stretches that begin part way through a cycle; loops only with at least `r` full copies; the longest reach chosen with ties to the shorter cycle, not the shortest repeating cycle; `None` for traces with no loop, empty traces and traces shorter than `r`; at Very Hard, the cap applied to the cycle length, not to the reach; an O(n) method (Z-function or an equivalent) with a clear explanation of why per-length scanning is quadratic on long loops; sensible answers on streaming detection, fuzzy equality of calls and what to store.

## XAI-L2-02: Verbatim overlap with a cited source — the longest run of words a response shares with what it cites

| | |
|---|---|
| **Template ID** | XAI-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Strings / binary search on the length + rolling hash with verification (or a suffix automaton) |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ai-infra-engineer, ml-platform-engineer |
| **Generator** | XAI-L2-02.mjs |

**Business Scenario.** A response that cites a web page or a public post may quote it. Teams using the search tools want to know how much of a response repeats a cited source word for word, so that quotes can be shown as quotes and answers that copy long passages instead of summarising them can be found. Before this step, the citation pipeline has turned both texts into integer word ids; this exercise uses synthetic tokens, and no text is involved. For each citation it reports the longest run of consecutive words the response shares with the source, and where that run is in each.

**Problem Statement.** Implement `verbatim_overlap(response, sources)`. `response` is a list of integer word ids; `sources` lists the sources the response cites, in citation order, each a list of word ids. For each source, return `(length, i, j)`: the largest `length` such that `response[i:i + length] == source[j:j + length]` for some `i` and `j`, and among runs of that length the smallest `i`, then the smallest `j`. Return `(0, -1, -1)` for a source that shares no word with the response, including an empty source. {{level_rule}} Return one tuple per source, in order.

**Constraints.** A 10 000-word response and 36 000 words of sources in the timing check. The longest-common-substring table has 360 million cells: too slow in Python even when it keeps only two rows, and slow even when each diagonal is compared in C. Something close to O((n + m) log n) is expected. The answer must be exact: a hash may find candidates, but a hash collision must never change the result.

**Assumptions.** Responses, sources and word ids are hypothetical; tokenisation happened earlier and equal ids are equal words. This overlap measure is this exercise's rule; check current docs for how any real product reports quotes or citations. Nothing here stores or inspects the text of a response or a source.

**Clarifications.**
- Q: Can the run overlap itself, for a word repeated many times? | A: Yes. Positions in the response and in the source are independent: a response `[7, 7, 7, 7]` and a source `[7, 7, 7]` give `(3, 0, 0)`.
- Q: Two runs have the same length. Which one do I report? | A: The one starting earliest in the response; if it occurs several times in the source, the earliest place in the source.
- Q: May I compare hashes instead of words? | A: To find candidates, yes. The reported run must be verified word by word, and a collision must not change the answer.
- Q: Are sentence boundaries or punctuation special? | A: Not in this exercise. A run is any sequence of consecutive word ids.
- Q: Does a run of one word count? | A: Yes, `(1, i, j)`.

**Hints.**
1. If the response shares a run of length `L` with a source, it shares a run of every shorter length. So the length can be binary searched.
2. For one length `L`, hash every window of `L` words in the source with a rolling hash and keep the first position per hash. Then slide over the response from the left and look each window up.
3. Verify each hit by comparing the words. If a verification ever fails, decide that length by an exact method, so a collision can only cost time, never correctness. Scanning the response from the left and keeping the first source position gives the tie rule for free.
4. Another linear route: a suffix automaton of the source, with the response walked through it, keeping the earliest end positions.

**Follow-ups.**
1. Report every run of at least `k` words, not only the longest, so the page can mark each quote. What changes in your method, and in its cost?
2. One popular source is cited by thousands of responses a day. What would you precompute for that source, and how long would you keep it?
3. The response quotes with small changes: one word replaced every few words. What measure would you use instead of an exact run, and what does it cost?
4. Compare binary search with hashing, a suffix automaton and a suffix array on memory, worst case and ease of getting the tie rule right.

**Follow-up rules.**
- when: dp, dynamic programming, two rows, table → ask: How many cells does your table have for a 10 000-word response and 36 000 words of sources, and how long does that take in Python?
- when: rolling hash, rabin-karp, polynomial hash → ask: Two different windows can share a hash. Where does your code catch a collision, and what does it do then?
- when: binary search → ask: Why is "a shared run of length `L` exists" monotone in `L`, and how do you keep the earliest `i` and `j` at the final length?
- when: suffix automaton, suffix array, suffix tree → ask: Your structure gives the length. How do you recover the earliest `i` and `j` as well?
- when: tuple(, tuples, slices → ask: Keeping every window as a tuple costs how much memory at a length of 500 words, and how many times does the binary search do it?

**Evaluation Criteria.** The longest shared run found exactly, with the tie rule (earliest in the response, then in the source) and `(0, -1, -1)` for no shared word or an empty source; runs that overlap themselves handled; at Very Hard, one answer per cited source in order; a method close to O((n + m) log n) (binary search with a verified rolling hash) or O(n + m) (suffix automaton), with a clear account of why the quadratic table is too slow; hash collisions that can never change the answer; sensible answers on reporting every quote, per-source precomputation and fuzzy quoting.

## XAI-L2-03: Debug the citation report for server-side tool calls

| | |
|---|---|
| **Template ID** | XAI-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Reporting code / URL canonicalisation before deduplication, subdomain folding, web and post citations apart, denominators, UTC days |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | XAI-L2-03.mjs |

**Business Scenario.** Each day, teams that use the server-side search tools see a citation report for their own responses: how many responses ran, how many cited anything, how many distinct web pages and public posts they cited, and which sites. Teams have reported problems. A page cited once with a tracking parameter and once without counts as two citations. Every site under a two-label suffix such as `.co.uk` appears as one site called `co.uk`. Web citations are higher than the web pages in the responses, by exactly the number of post citations. The share of responses with a citation looks too high, and days on which no response cited anything are missing. A response at 22:00 in California on the 5th appears on the 5th, though it is already the 6th in UTC. The report code below is the suspect.

**Problem Statement.** Fix `citation_report(responses, suffixes)` so that it meets this specification. {{replay_rule}}
1. **Input.** Each response is a dict `{"id", "ts", "citations"}`. `ts` is an ISO 8601 time with a UTC offset, such as `2026-10-05T22:00:00-07:00`. Each citation is `{"kind", "ref"}`: a `"web"` citation's `ref` is a URL, and a `"post"` citation's `ref` is a public post's id.
2. **Day.** A response belongs to the UTC date of its `ts`, as `"YYYY-MM-DD"`.
3. **Canonical URL** (this exercise's rule). The host is lowercased and a leading `www.` removed; the scheme is ignored, so `http` and `https` give the same page; the path keeps its case, with trailing slashes removed; the fragment is dropped; query parameters whose name starts with `utm_` are removed and the others kept in their order. The canonical form is the host, then the path, then `?` and the remaining parameters if any remain. Hosts carry no port or user info.
4. **Site.** A web citation's site is the last two labels of its canonical host, or the last three when the last two labels, joined by a dot, are listed in `suffixes` (such as `"co.uk"`).
5. **Deduplication.** Within one response, web citations count once per canonical URL and post citations once per post id. A post citation is never a web citation and has no site.
6. **Output.** `{day: {"responses", "cited", "web", "posts", "domains"}}`: every response that day, cited or not; the responses with at least one citation of either kind; distinct web citations summed over the responses; distinct post citations summed over the responses; and, per site, the number of responses that day citing it at least once. A day appears when it has at least one response.

**Constraints.** Keep the function's name, arguments and output format. 50 000 responses in the timing check, processed in linear time.

**Assumptions.** Responses, URLs (all on generic example domains), post ids and the suffix list are hypothetical; the canonical form and the site rule are this exercise's rules, so check current docs for how any real tool returns or groups citations. The report shows a team only its own responses. Nothing here inspects the text of a response, a page or a post.

**Clarifications.**
- Q: Are `http://example.com/a` and `https://www.example.com/a/` the same page? | A: Yes, under this exercise's rule.
- Q: Are `/A` and `/a` the same page? | A: No. Paths keep their case.
- Q: A response cites the same post twice. | A: It counts once in that response. Another response citing it counts once more.
- Q: Does a response with only post citations count as cited? | A: Yes. "Cited" means at least one citation of either kind.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. Write the same page five ways, with `www.`, a tracking parameter, a fragment and a trailing slash, and follow them through the loop. Where does deduplication happen, and on what?
2. Call `_domain("news.example.co.uk", ["co.uk"])` by hand.
3. Count the places where `d["web"]` goes up.
4. Which responses ever reach the counters?
5. What does `ts[:10]` give for `2026-10-05T22:00:00-07:00`?

**Follow-ups.**
1. The suffix list here has two entries. A real public suffix list has thousands of rules, with wildcards and exceptions. How would you obtain and version it, and what happens to old reports when it changes?
2. A site redirects `/a` to `/b`. Should both count as one citation? Where would that knowledge come from, and what would it cost?
3. The report for a past day must be reproducible a month later. What would you store with each day's numbers?
4. A team in UTC+9 wants the report in its own days. What changes, and what stays in UTC?

**Follow-up rules.**
- when: canonical, canonicalise, normalise, normalize → ask: In which order do you canonicalise and deduplicate, and what does the other order count for a page cited with a tracking parameter?
- when: public suffix, psl, etld, co.uk → ask: What does your fold give for `example.co.uk` itself, with three labels, and for `shop.example.com.au`?
- when: utc, astimezone, offset, timezone → ask: Which date does your code give for 22:00 at −07:00 on the 5th, and why is that the 6th?
- when: denominator, share, rate, percentage → ask: Which responses are in your denominator, and where does a day with no citations at all appear?
- when: post, posts → ask: Can a post citation ever have a site? What would your fix do if a post id looked like a URL?

**Evaluation Criteria.** Finds and explains every bug with its user-facing symptom; URLs canonicalised before deduplication, with the path's case kept and only `utm_` parameters removed; the site fold that checks the last two labels against the suffix list; post citations counted apart and never given a site; responses without citations kept in the denominator and their days kept; days computed by converting to UTC; minimal fixes with a regression check per bug.

## XAI-L2-04: Public-post ingestion pipeline — creates, edits and deletions in, a searchable index out, and the lag measured stage by stage

| | |
|---|---|
| **Template ID** | XAI-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Streaming ingestion / per-key ordering, deletions that overtake creates, versioned enrichment, replay, stage-by-stage lag |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, ai-infra-engineer, ml-platform-engineer |

```params
{
  "posts_per_second": {"2": ["5,000 events a second on average and 40,000 at peaks"], "3": ["20,000 events a second on average and 150,000 at peaks", "50,000 events a second on average and 300,000 at peaks"]},
  "searchable_target": ["15 seconds", "60 seconds", "3 minutes"],
  "delete_target": ["30 seconds", "2 minutes"],
  "replay_days": [3, 14]
}
```

**Business Scenario.** A model API offers a server-side tool that searches recent public posts, so that a response can find and cite them. Posts arrive as a stream of events with a given schema: a create (post id, an opaque author key, creation time, text as synthetic tokens, optional reply, quote and repost references), later edits that replace the text, and deletions. The stream carries about {{posts_per_second}}. Before a post can be found it passes several stages: schema validation, a language label from a classifier you are given (with its version), tokenisation and an embedding from a model you are given (with its version), and the index write. In this exercise's rules (check current docs), a post should be searchable within {{searchable_target}} of its creation, and a deleted post must leave search within {{delete_target}} of the deletion event, wherever it is in the pipeline.

**Problem Statement.** Design the ingestion pipeline. Cover how events are partitioned and ordered (per post), what happens when a deletion or an edit arrives before the create it refers to, how duplicates from at-least-once delivery are absorbed, how each stage records its work, how edits replace earlier versions in the index, how a deletion reaches every stage, cache and index replica in time and is never undone by a delayed create or edit, how you re-run the last {{replay_days}} days when the classifier or embedding version changes, and how you measure the lag from creation to searchable, stage by stage, so that a slow stage can be found within minutes.

**Constraints.** Events arrive at least once and can be out of order across posts and, rarely, within a post. A deletion is final: no later stage may make that post searchable again. The searchable and deletion targets above are measured per post, and the report must show their 50th and 95th percentiles per hour, per stage and per language label. A replay must not change the lag numbers of the hours it re-processes, and must not resurrect deleted posts. Peaks are several times the average.

**Assumptions.** Volumes and targets are hypothetical. The schema, the language classifier and the embedding model are given; nothing here is about moderating content, and text is synthetic tokens. Authors appear only as opaque keys and only in aggregate. Ranking of search results is a scoring function you are given and is out of scope.

**Clarifications.**
- Q: Can a deletion really arrive before its create? | A: Yes, rarely, when the create was delayed upstream. The post must never become searchable.
- Q: Is an edit a new post? | A: No. It is a new version of the same post id; the index keeps only the latest version, and lag is measured for each version from the edit time.
- Q: Where does "searchable" begin? | A: When a query against the serving index can return the post, not when the index write was acknowledged by one replica.
- Q: May we drop events at peaks? | A: Never deletions. You may say how creates degrade (delayed, not lost) and what the report shows meanwhile.
- Q: Do we keep the text after indexing? | A: Only what the index needs, for as long as the post is searchable and not deleted; say how the copies in the pipeline are bounded.

**Hints.**
1. Partition by post id so that every event of a post goes through the same ordered lane; give each event a sequence or version per post.
2. Keep a small per-post state (latest version, deleted flag) that every stage consults; a deletion writes a tombstone that outlives the post's retention so a late create can be recognised and dropped.
3. Stamp each event with the time it entered and left every stage; compute percentiles from those stamps with event-time windows, and keep replays in a separate lane with their own stamps.

**Follow-ups.**
1. The classifier version changes. Walk through the {{replay_days}}-day replay: what is re-run, what stays searchable meanwhile, and how do the two versions coexist?
2. One stage is slow for an hour. Show the report that tells you which stage, and what the searchable lag looks like for posts created in that hour.
3. Deletions spike to ten times their usual rate. How do you keep the deletion target without starving creates?
4. A downstream team wants every version of every post for research. What would you say, and what would you offer instead?

**Follow-up rules.**
- when: kafka, partition, partitioned, topic → ask: You partition by post id. What happens to a very active post, and to ordering when the partition count changes?
- when: tombstone, tombstones, deleted flag → ask: How long does a tombstone live, and what happens if a delayed create arrives after it has expired?
- when: exactly once, idempotent, dedupe, deduplicate → ask: Which key makes a duplicate edit harmless at the index write, and what if two edits carry the same version?
- when: watermark, event time, percentile, p95 → ask: How do you compute an hourly p95 of searchable lag when some posts of that hour are still in the pipeline?
- when: cache, replica, replicas → ask: A deletion reached the index but a cached result still holds the post. How does your design meet the deletion target there?

**Evaluation Criteria.** Per-post ordering with versions; deletions that overtake creates handled with durable tombstones; idempotent stages under at-least-once delivery; edits replacing earlier versions; deletions propagated to every stage, cache and replica within the target and never undone; replays on a separate lane that preserve lag numbers and deletions; lag stamped per stage and reported as percentiles per hour, stage and language; bounded copies of text; sensible handling of peaks without dropping deletions.

## XAI-L2-05: Server-side tool call logging — every search a response ran, its results and citations, latency per tool, failures, and calls billed by rule

| | |
|---|---|
| **Template ID** | XAI-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Event logging / per-call records, call ids across retries, latency histograms per tool, billing derived from logs and reconciled |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer, ai-infra-engineer |

```params
{
  "responses_per_day": {"2": ["15 million", "40 million"], "3": ["150 million", "400 million"]},
  "max_calls": [5, 10, 20],
  "billing_rule": ["each tool call that completed is billed once, and failed calls are not billed", "each tool call that returned at least one result is billed once, and failed or empty calls are not billed"],
  "log_retention_days": [30, 90]
}
```

**Business Scenario.** A response that uses server-side tools may run up to {{max_calls}} tool calls: web searches, searches over public posts, opening a result. About {{responses_per_day}} such responses run a day, across several regions. Teams want to see, for their own usage, each search their responses ran, the results and citations that came back, how long each tool took and which calls failed. Billing needs the number of billable calls per team and day under this exercise's rule (check current docs): {{billing_rule}}. Inside the platform, a call can be retried after a timeout, and a streaming response can be cancelled while a call is still running.

**Problem Statement.** Design the logging of server-side tool calls and the tables built from it. Cover the call record and its identifiers (response, call sequence, attempts), what is logged about the query, results and citations, how retries and cancellations are represented, how latency is recorded per tool and per stage of a call and reported as percentiles, how failures are classified, how billable calls are derived and reconciled with the usage the invoice shows, retention for {{log_retention_days}} days, and what a team can see versus what only aggregate reporting sees.

**Constraints.** Every call is logged exactly once in the billing tables, however many internal attempts it took and however many times a log line is delivered. Billing must be reproducible for any past day. Latency is reported per tool as percentiles per hour, never as an average alone. Queries can contain a user's words, so the log must minimise and protect them; results and citations are logged as references, not page or post contents. Logs from all regions must reconcile with the per-team usage totals daily.

**Assumptions.** Volumes, the call budget, the billing rule and retention are hypothetical and this exercise's rules; check current docs for how tool calls are actually billed. Tools, their stages and their failure kinds are generic. Teams appear only as their own usage to themselves and in aggregate otherwise.

**Clarifications.**
- Q: A web search timed out and was retried internally, and the retry succeeded. How many billable calls? | A: One. The attempts are logged, but the call the model asked for is billed once by the rule.
- Q: The response was cancelled while a call was running. | A: Log the call as cancelled with what is known; whether it is billable follows from the rule (it did not complete).
- Q: May we log the full query text? | A: Decide and justify. The requirement is to support a team's own view and aggregate reporting with the least data; say what you keep, for how long, and who can read it.
- Q: Are results the same as citations? | A: No. Results are what the tool returned to the model; citations are the results the response cited. Log both, as references.
- Q: Can billing come from a separate meter? | A: It can, but it must reconcile with the logs every day, and differences must be explainable per call.

**Hints.**
1. Give each call an id derived from the response id and the call's sequence number, and each attempt an attempt number under it; billing keys on the call id.
2. Write latency as stage durations on the attempt (queue, search, fetch) and the total on the call; percentiles come from histograms per tool and hour, which merge across regions.
3. Derive billable calls from final call states with the stated rule, deduplicated on the call id, and reconcile daily with the usage totals per team.

**Follow-ups.**
1. Billable calls for one team doubled overnight while its responses did not. List the logging and pipeline causes you would check before believing it.
2. The billing rule changes next quarter. How do you apply the new rule from a date without changing past invoices, and how do you show both?
3. A team asks why one response was slow. What can you show from the logs, and what can you not show?
4. At {{responses_per_day}} responses a day, where does the cost of these logs go, and what would you sample, aggregate or drop first without touching billing?

**Follow-up rules.**
- when: retry, retries, attempt, attempts → ask: Where does the attempt number live, and which key keeps a retried call from being billed twice?
- when: average, mean, avg → ask: The average latency did not move but users complain. Which number would have shown the problem, and how do you compute it across regions?
- when: sample, sampling, sampled → ask: Which of your tables can be sampled and which can never be, given that billing comes from them?
- when: query text, raw query, full text → ask: Who can read that field, how long is it kept, and could a hash or a team-only view answer the same question?
- when: invoice, reconcile, reconciliation → ask: Your daily totals differ from the usage meter by 0.3 percent. How do you find the calls that explain it?

**Evaluation Criteria.** A call record keyed by response and sequence with attempts beneath it; retries, timeouts and cancellations represented explicitly; results and citations logged as references; latency as stage durations with percentile reporting from mergeable histograms per tool and hour; failure classes; billable calls derived from final states by the stated rule, deduplicated on the call id, reproducible and reconciled daily with usage; query data minimised with stated access and retention; team views limited to the team's own usage.
