# Backup and recovery

P0.7. Every persistent store PaddySpeaks has: what it holds, how it is backed
up, how long copies live, how to restore it, and how to prove a restore works.

The short version: **Git holds almost everything.** Three Cloudflare D1
databases and a handful of secrets are the only state outside it, and the
browser-side state belongs to each visitor.

## Inventory

| Store | Holds | Personal data? | Primary copy | Backup | Frequency | Retention | Owner |
|---|---|---|---|---|---|---|---|
| **Git repository** (`paddyriyer/paddyspeaks`) | All pages, articles, sacred-text data, Interview Studio questions, JobSignal board + history ledger + archive, platform registry, provenance, corrections, changelog, search index, graph | Public content only | GitHub | Mirror to `paddyriyer/paddyspeaks-backup` on every push (`mirror.yml`); every clone | Every push | Unlimited (full history) | Repo owner |
| **D1 `paddyspeaks-forms`** | Testimonials (pending + approved), contact spam log, rate limits | **Yes** (testimonial name and email) | Cloudflare D1 | D1 Time Travel; optional encrypted weekly export (`d1-backup.yml`) | Continuous / weekly | Time Travel window (see below); artifacts 30 days | Repo owner |
| **D1 `paddyspeaks-leaderboard`** | Anonymous scores, nonces, daily aggregates | No (random aliases) | Cloudflare D1 | D1 Time Travel; optional export | Continuous / weekly | Entries 12 months by design | Repo owner |
| **D1 `paddyspeaks-analytics`** | Page views, events, visitors, pixel hits, exclusions | Pseudonymous (visitor UUID, geo, ASN) | Cloudflare D1 | D1 Time Travel; optional export | Continuous / weekly | No expiry yet (backlog) | Repo owner |
| **Worker secrets** | `ADMIN_PASSWORD_HASH`, `LB_SIGNING_KEY`, `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL`, `FORMS_SALT`, `BRAVE_SEARCH_API_KEY`, `GOOGLE_CSE_KEY`, `GOOGLE_CSE_ID` | Credentials | Cloudflare | **None by design.** Regenerate rather than restore. | — | — | Repo owner |
| **GitHub Actions secrets** | `ANTHROPIC_API_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `BACKUP_TOKEN` (+ optional D1 backup secrets) | Credentials | GitHub | None. Regenerate at each provider. | — | — | Repo owner |
| **Google Form / Sheet** (community questions) | Raw question submissions (+ optional name) | Possibly | Google | Google's own; processed rows are recorded in `.github/scripts/processed_submissions.json` (Git) | — | Google's | Repo owner |
| **Generated indexes** (`data/site-registry.json`, `data/search/*`, `data/graph.json`, feeds, `api/v1/*`, rendered pages) | Derived | No | Git | Not needed: rebuilt byte-identically by `python3 scripts/platform_build/build.py all` | — | — | CI |
| **JobSignal data** (`jobs/data/`) | Live board, **history ledger** (`history.json`), yearly **archive** | No | Git | Git + mirror | Every 4h run | Unlimited | Pipeline |
| **Browser storage** (saved jobs, prep progress, Continue history …) | Each visitor's own state | The visitor's | That visitor's browser | The visitor can **export** from `/privacy-policy/#browser`; JobSignal has its own export | On demand | Until cleared | The visitor |

### Two things to know about the Git backups

- `mirror.yml` **force-pushes and propagates deletions**. It protects against
  losing GitHub access or the repository. It does **not** protect against a
  force-push that rewrites `main`, because the rewrite is mirrored too. Branch
  protection on `main` (`docs/REPO-GUARDRAILS.md`) is what prevents that.
- `jobs/data/history.json` and `jobs/data/archive/` carry every job's
  `first_seen_at`. Losing them silently resets every age on the board
  (`docs/JOBSIGNAL.md`). Restore them from Git history, never by re-ingesting.

## D1: point-in-time recovery (Time Travel)

Cloudflare D1 keeps a continuous restore history: 30 days on the Workers
Paid plan, 7 days on Free. **Check the account's plan in the dashboard;
this repo cannot see it.**

```bash
cd analytics/worker
# 1. See where you can go back to
npx wrangler d1 time-travel info paddyspeaks-forms
# 2. Restore to a moment before the incident (UTC)
npx wrangler d1 time-travel restore paddyspeaks-forms --timestamp=2026-09-20T12:00:00Z
```

A restore replaces the whole database. Anything written after the timestamp
is lost, so export the current state first (below).

## D1: full export

```bash
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… scripts/platform_build/export_d1.sh ./d1-backups
```

This writes one `.sql` file per database plus a SHA-256 manifest. The forms
export contains **testimonial names and emails**. Keep it encrypted at rest,
never commit it (`d1-backups/` is gitignored), and delete local copies when
done.

**Scheduled off-platform copy (optional).** `.github/workflows/d1-backup.yml`
runs the export weekly, encrypts it with AES-256 (PBKDF2, 200k iterations)
under `BACKUP_PASSPHRASE`, deletes the plaintext, and keeps the encrypted
artifact for 30 days. It is **off** until you add the secrets and set the
repository variable `D1_BACKUP_ENABLED=true`. Store the passphrase in a
password manager, not in GitHub alone.

Decrypt:
```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in d1-YYYYMMDD.tar.gz.enc -out d1.tar.gz -pass pass:'…' && tar xzf d1.tar.gz
sha256sum -c manifest-*.sha256
```

## D1: restore from an export

```bash
cd analytics/worker
# Into a SCRATCH database first — never straight over production:
npx wrangler d1 create paddyspeaks-forms-restore-test
npx wrangler d1 execute paddyspeaks-forms-restore-test --remote --file=../../d1-backups/paddyspeaks-forms-<stamp>.sql
# Inspect, then either point the binding at it or re-import into production.
```

Rebuilding an empty database from schema alone: `schema.sql` followed by
`migrate-v2.sql` … `migrate-v7-server-hits.sql` (analytics),
`leaderboard-schema.sql`, `forms-schema.sql`.

## Recovery test procedure (run quarterly, and after any schema change)

1. `export_d1.sh ./d1-restore-test`, and check the manifest verifies.
2. Create a scratch D1 database and import `paddyspeaks-forms-<stamp>.sql` into it.
3. Compare the row counts:
   `SELECT status, COUNT(*) FROM testimonials GROUP BY status;` must match production.
4. Run `wrangler d1 time-travel info paddyspeaks-forms` and confirm a
   restore point exists within the last hour.
5. From a fresh clone, run `python3 scripts/platform_build/build.py check` and
   `python3 -m jobsignal.tests.test_pipeline`. This proves Git alone rebuilds
   every generated artefact and that the JobSignal ledger is intact.
6. Delete the scratch database and local exports. Record the date and result
   in the changelog (area `security`).

## Recovery priorities

1. **Git** → site back (redeploy from `main` or the mirror).
2. **Worker secrets** → regenerate (`docs/SECURITY.md#if-a-secret-leaks`); forms, admin and scan work again.
3. **`paddyspeaks-forms`** → testimonials (the only irreplaceable personal-data store).
4. **`paddyspeaks-leaderboard`** → can also start empty; the board hides itself until 5 entries.
5. **`paddyspeaks-analytics`** → history is nice to have; collection resumes on its own.
