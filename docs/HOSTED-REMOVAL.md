# Hosted removal — what it takes to actually do it for people

_Written 2026-08-10, in answer to: "users run the search and expect their personal
information to be removed — what do we need to set that up?"_

The console finds exposures and stops at the submit button, because a web page
may not submit a form on another origin. Moving past that means running the
submissions on our own infrastructure, for other people, holding their identity
details while we do it.

That is buildable. The infrastructure is the cheap part and the easy part. What
follows is ordered by what will actually stop the project, not by what is most
fun to build.

---

## 1. The legal gate — this comes first, before any code

Submitting a privacy request on somebody else's behalf makes us an **authorized
agent**, which is a defined role with hard requirements, not a description.

Under the CCPA an authorized agent is *"a natural person or a business entity
registered with the Secretary of State to conduct business in California."*
Three consequences, none optional:

1. **We must be a registered legal entity.** Not a personal blog. An LLC or
   corporation registered with the California Secretary of State, in good
   standing.
2. **We need signed permission from each user.** A broker may demand evidence
   that the consumer gave the agent signed permission before it will act. A
   checkbox that says "I agree" is not obviously sufficient; this wants a real
   authorization artifact, retained, per user, per request.
3. **The broker may bypass us entirely.** It is entitled to verify the consumer
   directly, or to ask the consumer to confirm they authorized us. So the
   product must be designed for the user to be pulled into the loop at any
   moment — an architecture where the user has walked away and expects magic
   will fail against the brokers that push back hardest.

Alongside that: a privacy policy and terms covering our own processing, a data
processing agreement, breach-notification procedures in every state we serve,
and cyber/E&O insurance. If we charge, payments go through Stripe so we stay in
PCI SAQ-A scope and never touch a card number.

**Budget: $5,000–20,000 one-off for a privacy lawyer** to draft the
authorization instrument, ToS, privacy policy and DPA, plus entity formation and
registered-agent fees, plus **$1,500–5,000/yr insurance**. This is the real
first cheque, and it buys nothing visible.

## 2. What we would be holding, and why that is the whole risk

A hosted service means a database of legal names, home addresses, address
histories, dates of birth, phone numbers, emails and relatives — for every user.

That is precisely the asset data brokers monetise, and precisely what this
project has argued against building. It is not a reason to refuse; it is a
reason the security work is not negotiable:

- Envelope encryption with a per-user data key, wrapped by KMS. Application
  never holds a long-lived master key.
- Field-level encryption for identity columns, so a database dump is not a
  dossier dump.
- Hard tenant isolation on every query, enforced in one place, tested.
- No PII in logs, ever. The redactor in `core/redact.js` already exists for
  exactly this and must sit in front of all logging.
- Retention limits and real deletion — a service that cannot delete a user's
  data on request has no business selling deletion.
- The learned workflow templates must stay PII-free across tenants. This
  invariant is already enforced and tested (`sanitizeTemplate`, `assertNoPii`);
  it becomes existential once one user's data could leak into another's run.

## 3. The architecture

Cloudflare Workers cannot do this — no browser. The submission tier has to live
somewhere that can run Chromium.

| Layer | Choice | Why |
|---|---|---|
| Web/API | Keep the existing Worker for the site; add an API service | Site stays static and fast |
| Submission workers | Playwright on Fargate/Fly, **or** Browserbase | Managed browsers remove a lot of ops |
| Queue + scheduling | Inngest / SQS | One job per user × broker; retries; the 45-day and 90-day re-checks |
| Database | Postgres (Neon/RDS) + KMS | D1 is wrong for this; keep it entirely separate from `FORMS` and the leaderboard, per the house rule |
| Inbound email | Postmark or SES inbound, per-user alias | Brokers confirm by email; `removal/email.js` already parses these |
| Secrets | KMS / Worker Secrets | Never in the repo — existing rule |
| Observability | Sentry + structured logs through the redactor | |

The engine itself already exists and is tested: discovery, match confidence,
removability, form field classification, the state machine that refuses to call
"submitted" *removed*, confirmation parsing, re-check scheduling, evidence
capture. **We are not rebuilding the hard logic — we are giving it somewhere to
run and a queue to pull from.**

### The two things that will actually hurt

**CAPTCHAs and identity checks.** Unavoidable on the sites that matter most.
Two options: notify the user and have them solve it in a handed-back session, or
use a solving service. The second breaks most sites' terms and is a bad look for
a privacy company. Recommendation: human-in-the-loop, designed for from day one
— which means the product promise is "we do the work and ping you a few times",
not "press go and forget".

Government ID must never be automated. That invariant stays.

**Form drift.** Brokers change their forms constantly, and every change silently
breaks a workflow. This is the actual ongoing cost of the business and the
reason incumbents charge ~$100+/year and still employ humans. Mitigation:
generic field classification rather than per-site scripts (already how
`browser/fields.js` works), plus alerting when a workflow's success rate drops.

## 4. What it costs to run

Infrastructure at small scale is genuinely cheap:

| Item | Monthly |
|---|---|
| Browser automation (Browserbase Developer, 100 browser-hours) | $20 |
| Postgres + backups | $25–70 |
| Queue / scheduler | $0–20 |
| Inbound email | $15–50 |
| Search API (Brave) | $5–250 |
| Monitoring | $0–30 |
| **Infra total** | **~$150–300/mo** at low volume |

A full pass for one user is on the order of a few browser-hours, so 100 hours
covers roughly 20 users a month. Compute is not the constraint.

**The costs that matter are legal (§1), insurance, and the engineering time to
keep workflows alive.** Assume 6–10 weeks to a credible first version, and then
a permanent maintenance load that never goes to zero.

## 5. The strategic problem, stated plainly

Two things should inform the decision before a line is written.

**DROP already does this for Californians, free, with the force of law.** Since
1 August 2026 every registered broker must check the state platform every 45
days and delete on a match. A paid service that submits to those same brokers is
competing with the State of California, on price, forever. For a Californian,
our honest advice is already "file with DROP" — and the console now says so.

**The market is crowded and the margins are thin.** DeleteMe, Incogni, Optery,
Kanary and Privacy Bee all do broker removal; at least one has a free tier. The
form-submitting part is the commodity.

What is *not* commodity is the part already built here and not sold anywhere
else: explaining how a site got your data, proving a record is you rather than a
namesake, showing what the combination actually enables, telling you that
removing one of nine copies changes nothing, and being straight that "submitted"
is not "removed".

## 6. Three honest options

**A — Full hosted removal.** Everything above. Highest cost, highest liability,
competes with a free state programme for a large share of the likely audience.
6–10 weeks plus the legal gate.

**B — Hosted, email-first.** The server does discovery and submits every request
that can be sent by email — a written privacy request is legally valid, fully
automatable, needs no browser, no CAPTCHA, and creates a paper trail. Browser
automation is added later only for the form-only sites. Perhaps 70% of the
outcome for perhaps 25% of the build, far less fragile, and the same legal gate
but a much smaller attack surface. **This is the recommended path.**

**C — Guided, nothing hosted.** Lead with DROP, keep the intelligence layer,
never hold anyone's dossier. No legal gate, no liability, no running cost —
and no submissions.

## 7. If we proceed, the order is fixed

1. Talk to a privacy lawyer. Form the entity. Draft the authorization.
2. Build the encrypted multi-tenant store and prove isolation with tests.
3. Email-first submission pipeline end to end for a single user.
4. Confirmation-email parsing and the re-check loop (both already written).
5. Browser submission tier for form-only sites.
6. Only then, open it to anyone but ourselves.

Nothing in steps 2–6 is safe to ship before step 1 is finished.
