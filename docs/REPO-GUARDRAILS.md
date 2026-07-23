# Repo Guardrails

How this repository is protected, and the few settings that must be toggled in
the GitHub UI (they can't live in a file).

`main` is production: every push to it auto-deploys to Cloudflare. So the goal is
to stop a bad change from reaching `main`, and to stop `main` itself from being
rewritten or deleted by accident.

## Enforced in the repo (already committed)

| Guardrail | File | What it does |
|-----------|------|--------------|
| Content validation CI | `.github/workflows/validate-content.yml` + `.github/scripts/validate_content.py` | On every PR into `main`: checks `article_metadata.json` (valid, no duplicate slugs, every slug has a real file), that all JSON parses, and that **articles changed in the PR** have well-formed inline SVGs, a `<title>`, and a `<!doctype>`. Legacy articles are checked as warnings only, so the build is green today but every new/edited article is held to the strict bar. |
| Review routing | `.github/CODEOWNERS` | Auto-requests a review from the repo owner on every PR. |
| PR template | `.github/pull_request_template.md` | Reminds you to update metadata + `index.html` and to never run index generators. |
| Secret / junk ignores | `.gitignore` | Prevents committing `.env`, keys, `.pem`, `.wrangler/`, `node_modules/`, `.DS_Store`, etc. |

Run the validator locally any time:

```bash
python .github/scripts/validate_content.py           # whole repo (SVG/title issues = warnings)
python .github/scripts/validate_content.py --changed articles/my-new-post.html   # strict on that file
```

## Turn on in GitHub Settings (one-time, ~2 minutes)

These are account/repo settings, not files — do them once in the UI.

### 1. Protect the `main` branch

**Settings → Branches → Add branch ruleset** (or **Add rule**), target `main`, enable:

- ✅ **Restrict deletions** — nobody can delete `main`.
- ✅ **Block force pushes** — history on `main` can't be rewritten.
- ✅ **Require status checks to pass** → add the check named **`validate`** (from the *Validate Content* workflow). This blocks merging a PR whose content validation is red.
- *(optional)* **Require a pull request before merging** — forces changes through a PR instead of direct pushes. Convenient for a team; mildly slower solo.
- *(optional)* **Require approvals: 1** — only useful once someone other than you can approve; skip for a solo repo.

Leave **"Do not allow bypassing"** unchecked if you want to keep the ability to push a hotfix directly as the owner.

### 2. Turn on native secret scanning

**Settings → Code security and analysis** → enable **Secret scanning** and **Push protection** (free on public repos). Push protection blocks a commit that contains a recognized token before it ever lands.

## If a secret ever gets committed

`.gitignore` prevents the common cases, but if a real credential lands in a
commit: **rotate it immediately** (the git history keeps it even after deletion),
then remove it from history. For the leaderboard signing key specifically, rotate
it in the Cloudflare dashboard (see `docs/SESSION-HANDOFF.md`).
