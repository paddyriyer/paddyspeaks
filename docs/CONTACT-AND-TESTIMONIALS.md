# Contact & Testimonials — how they work, how to run them

Two production features added to PaddySpeaks, built on the architecture that was
already here: a **static site on GitHub Pages** plus the **Cloudflare Worker** at
`ps.paddyspeaks.com`. No framework, no build step, no new runtime dependency.

- **Contact** — `/contact/` → `POST /api/contact` → emails Paddy + acknowledges the visitor.
- **Testimonials** — `/testimonials/` → `POST /api/testimonials` → stored `pending`,
  published only after Paddy approves it in `/testimonials/admin.html`.

---

## 1. Architecture at a glance

```
Browser (static page on GitHub Pages)
   │  fetch() JSON
   ▼
Cloudflare Worker  ps.paddyspeaks.com          analytics/worker/worker.js
   ├── routeContact()        /api/contact       analytics/worker/contact.js
   ├── routeTestimonials()   /api/testimonials  analytics/worker/testimonials.js
   └── shared helpers                           analytics/worker/forms-util.js
          │                        │
          │                        └── Resend HTTPS API  (transactional email)
          ▼
   D1: paddyspeaks-forms  (binding FORMS)       analytics/worker/forms-schema.sql
```

Three deliberate choices, each following an existing precedent in this repo:

1. **A separate D1 database (`paddyspeaks-forms`).** The leaderboard already uses a
   separate DB to guarantee *no PII*; this one is separate for the opposite reason —
   it *holds* PII (names, emails), so it must not mix with the analytics database.
2. **Validation lives in one place.** `analytics/lib/forms.js` is a pure ES module
   with no Worker/DOM dependencies. The Worker imports it server-side; the browser
   rules in `lib/ps-forms.js` mirror it field for field. Unit-tested with plain `node`.
3. **Resend for email.** No email service was configured before this. Resend was
   chosen because it is a single `fetch()` to an HTTPS API — no SDK, no dependency,
   and it works inside a Worker. Swapping it means editing one function
   (`sendEmail()` in `forms-util.js`).

### Privacy posture

| Data | Where it goes |
|---|---|
| Contact name / email / subject / message | **Emailed, then discarded.** Never written to any database. |
| Contact log row | Reason (dropdown value only) + salted one-way hashes. No free text. |
| Testimonial email | Stored (needed to reply/verify) but **never** returned by the public API and never displayed. |
| Visitor IP | **Never stored raw** — only `sha256(FORMS_SALT + ip)`. |
| Analytics events | Counts and outcomes only. No name, email, or message content ever. |

---

## 2. Required environment variables

Set these in the Cloudflare dashboard: **Worker → Settings → Variables and Secrets**.
Nothing here belongs in the repository, and the recipient address is never shipped
to the browser.

| Name | Type | Required | Purpose |
|---|---|---|---|
| `CONTACT_TO_EMAIL` | **Secret** | Yes | Paddy's private inbox. Receives contact messages and testimonial notifications. Never exposed to the frontend. |
| `CONTACT_FROM_EMAIL` | Variable | Yes | Verified Resend sender, e.g. `PaddySpeaks <hello@paddyspeaks.com>`. |
| `RESEND_API_KEY` | **Secret** | Yes | Resend API key (`re_…`). |
| `FORMS_SALT` | **Secret** | Recommended | Salt for one-way IP/content hashes. Falls back to a constant if unset; set it so hashes are not guessable. |
| `ADMIN_PASSWORD_HASH` | **Secret** | Already set | Reused as-is — authorizes the moderation console. Same password as the analytics dashboard. |

Plus one binding in `analytics/worker/wrangler.toml`:

| Binding | Database |
|---|---|
| `FORMS` | `paddyspeaks-forms`, id `d43111c5-5834-4791-b18d-b892643787c6` — **live** |

Note for future changes: a `database_id` that is not a real UUID fails
`wrangler deploy`, and this Worker also serves analytics and the leaderboard — so
a bad binding blocks deploying all of it. That is why the binding was first shipped
commented out and only enabled once the database existed. Both endpoints return
`503 {"error":"not_configured"}` whenever `env.FORMS` is absent, so the routes
always degrade safely.

---

## 3. Deployment — one-time setup

Deploys are already Git-integrated: pushing to `main` auto-deploys the Worker.
The steps below are the parts that cannot be done from the repository.

### Step 1 — Create the D1 database

```bash
wrangler d1 create paddyspeaks-forms
```

Then in `analytics/worker/wrangler.toml`, **uncomment** the `FORMS` block and paste
the returned `database_id` in place of `PASTE_THE_paddyspeaks_forms_DATABASE_ID_HERE`.

### Step 2 — Apply the schema

```bash
wrangler d1 execute paddyspeaks-forms --file=analytics/worker/forms-schema.sql
```

Or, in the **D1 Console** in the dashboard, paste
`analytics/worker/forms-schema.console.sql` — the comment-free single-line copy.
(The Console flattens newlines, which is why that file exists; same gotcha as the
leaderboard schema.)

### Step 3 — Set up Resend

1. Create an account at [resend.com](https://resend.com).
2. **Add and verify the `paddyspeaks.com` domain** (Resend shows the DKIM/SPF DNS
   records to add). Until the domain is verified, Resend will only deliver to your
   own address — this is the step people usually miss.
3. Create an API key with **Sending access**.
4. In the Worker's settings, add:
   - `RESEND_API_KEY` = the key, as a **Secret**
   - `CONTACT_FROM_EMAIL` = `PaddySpeaks <hello@paddyspeaks.com>` (must be on the
     verified domain)
   - `CONTACT_TO_EMAIL` = the destination inbox, as a **Secret**
   - `FORMS_SALT` = 32+ random characters, as a **Secret**

### Step 4 — Deploy

Merge the PR (auto-deploys), or `cd analytics/worker && wrangler deploy`.

### Step 5 — Verify in production

```bash
# Should return {"count":0,"testimonials":[]} once provisioned (503 before that)
curl https://ps.paddyspeaks.com/api/testimonials

# Send a real contact message through the live form
open https://paddyspeaks.com/contact/
```

Then check that both emails arrive: the message to `CONTACT_TO_EMAIL`, and the
acknowledgment to the address you submitted.

---

## 4. Testimonial approval workflow

**Nothing is ever published automatically.** Every submission is written with
`status = 'pending'`, and the public `GET /api/testimonials` filters to
`status = 'approved'` — so the only path to publication runs through Paddy.

```
visitor submits
      │
      ▼
status = 'pending'  ──▶  email to CONTACT_TO_EMAIL ("New testimonial awaiting review")
      │                  email to contributor ("will be reviewed before it appears")
      │
      ▼   Paddy opens /testimonials/admin.html and signs in
      │
      ├─ Approve ─────────▶ status = 'approved'  → appears on /testimonials/
      ├─ Feature ─────────▶ featured = 1         → also appears in the homepage strip
      ├─ Save edit ───────▶ edited_body / display-name override (original kept)
      ├─ Reject ──────────▶ status = 'rejected'  → never public, kept for the record
      ├─ Unpublish ───────▶ back to 'pending'    → removed from public view
      └─ Delete ──────────▶ row removed permanently (confirmation required)
```

### Using the console

Open **`https://paddyspeaks.com/testimonials/admin.html`** and sign in with the
analytics dashboard password. It is `noindex`, `Disallow`ed in `robots.txt`, and
never linked from public navigation.

Tabs: **Pending / Approved / Rejected / All**. Each card shows the private email,
the optional verification link, and — importantly — **exactly how the name will
appear in public** given the contributor's display preference, so you can check the
privacy contract before approving.

**Light edits.** "Light edit / display name override" stores `edited_body`
separately; the original submission is never overwritten. Leave it blank to publish
the text as submitted. This is the mechanism that honors the consent wording
("edit lightly for grammar without changing the meaning").

**Homepage strip.** Approved testimonials are shown newest-first with `featured`
ones promoted, capped at 6. Use **Feature** to pin the ones you want there.

### Display preferences are enforced server-side

`toPublicTestimonial()` shapes every public response. The email is never included,
and role/organization are withheld unless the contributor chose *full name and
professional details*:

| Preference | Public name | Role & organization |
|---|---|---|
| `full` | `Priya Nair` | shown |
| `first_initial` | `Priya N.` | withheld |
| `anonymous` | `Anonymous` | withheld |

This is enforced in the Worker, not in the browser — a crafted request cannot
retrieve more than the contributor allowed.

---

## 5. Spam & abuse protection

Layered, cheapest check first. **No CAPTCHA and no Turnstile** — they were not
needed to cover these vectors, and both would add a third-party script to a site
that currently loads none.

| Layer | Contact | Testimonials |
|---|---|---|
| Honeypot (hidden field, `aria-hidden`, `tabindex="-1"`) | `company` | `company_website` |
| Rate limit (per IP, fixed window, D1-backed) | 5 / hour | 3 / hour |
| Duplicate suppression | identical (ip+subject+message) within 10 min → idempotent success | — |
| Client-side duplicate-click guard | yes | yes |
| Payload size cap | 4000-char message, per-field maxima | 700-char testimonial |
| HTML injection | escaped on output, everywhere | escaped on output, everywhere |
| Cloudflare's own controls | WAF / bot management apply to the Worker automatically | same |

Honeypot hits return a **fake success** so bots get no signal. Rate limiting **fails
open** if D1 is unreachable — an infrastructure hiccup must not block a real person,
and the other layers still apply.

---

## 6. Analytics events

Emitted through the existing `window.psTrack()` (tracker v4, `lib/ps.js`), so they
respect DNT/GPC exactly like every other event. **No name, email, subject, or
message content is ever included** — only the outcome and a coarse failure stage.

| Event | Fires when | Properties |
|---|---|---|
| `contact_form_view` | contact form initialized | — |
| `contact_submit_success` | server confirmed the send | — |
| `contact_submit_error` | submission failed | `stage`: `client_validation` \| `server_validation` \| `rate_limited` \| `not_configured` \| `server_error` \| `network` |
| `testimonial_form_view` | testimonial form initialized | — |
| `testimonial_submit_success` | submission accepted | — |
| `testimonial_submit_error` | submission failed | `stage` (as above) |

Application logs follow the same rule: the Worker never logs message bodies or
addresses, including on delivery failure.

---

## 7. Files

**New**

| File | Purpose |
|---|---|
| `contact/index.html` | `/contact/` page + form |
| `testimonials/index.html` | `/testimonials/` — approved list + share form |
| `testimonials/admin.html` | Owner moderation console (noindex, password-gated) |
| `lib/ps-forms.js` | Shared client logic: validation, states, counters, rendering |
| `analytics/lib/forms.js` | Pure validation/sanitization/display logic (unit-tested) |
| `analytics/worker/contact.js` | `/api/contact` |
| `analytics/worker/testimonials.js` | `/api/testimonials` + `/api/testimonials/admin` |
| `analytics/worker/forms-util.js` | Hashing, rate limiting, Resend, email shell |
| `analytics/worker/forms-schema.sql` | D1 schema (documented) |
| `analytics/worker/forms-schema.console.sql` | Same, flattened for the D1 Console |

**Modified**

| File | Change |
|---|---|
| `analytics/worker/worker.js` | Mounts the two new route modules |
| `analytics/worker/wrangler.toml` | `FORMS` binding + documented env vars |
| `analytics/tests/run.mjs` | +81 assertions for the new logic |
| `style.css` | Appended form/testimonial/console styles (existing tokens only) |
| `index.html` | Testimonial section before the subscribe CTA; footer links |
| `about.html`, `resume.html` | Contact in nav; Contact + Testimonials in footer |
| `interview.app/index.html` | Contextual invitation at the end of the page |
| `sitemap.xml` | `/contact/` and `/testimonials/` |
| `robots.txt` | Disallow the moderation console and `/analytics/` |

---

## 8. Tests

```bash
node analytics/tests/run.mjs      # 138 pass (57 pre-existing + 81 new)
```

The new assertions cover email/URL shapes, HTML-escaping, character bounds at the
exact boundaries (59/60/700/701), closed enum sets, consent enforcement, display-name
derivation, and the privacy contract — including that a serialized public payload
cannot contain an email address.

Browser behavior was verified with Playwright against a stubbed Worker API:
valid and invalid submissions, per-field errors and focus management, duplicate
clicks collapsing to one request, content preservation across network/429/422
failures, honeypot inertness, XSS inertness, display preferences, the empty-state
invitation, mobile/tablet overflow, keyboard navigation, and console cleanliness.

---

## 9. Provisioning status

Done:

1. ~~D1 database `paddyspeaks-forms` created~~ — id `d43111c5-5834-4791-b18d-b892643787c6`
2. ~~Schema applied~~ — `testimonials`, `contact_log`, `rate_limits` all present
3. ~~`FORMS` binding enabled in `wrangler.toml`~~

Remaining (Cloudflare/Resend dashboard only — no code changes):

4. Resend: `paddyspeaks.com` verified (DKIM + SPF records auto-added to Cloudflare DNS).
   Sending enabled; **Receiving deliberately left off** — enabling it would add MX
   records on the root domain and could hijack existing mail to `@paddyspeaks.com`.
5. Worker Secrets/Vars set: `RESEND_API_KEY`, `CONTACT_TO_EMAIL`,
   `CONTACT_FROM_EMAIL`, `FORMS_SALT`.
6. Smoke test: send one message through `/contact/` and confirm BOTH emails arrive
   (owner copy + visitor acknowledgment), then submit a testimonial and approve it
   at `/testimonials/admin.html`.

Env-var changes take effect on the next deploy, not immediately.

**Rotate the Resend API key** once the smoke test passes if the key was ever pasted
into a chat, ticket, or terminal history.
