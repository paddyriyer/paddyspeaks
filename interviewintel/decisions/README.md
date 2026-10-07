# Review decisions

Each `*.json` file here is one batch of review decisions, written by
`/admin/interview-discovery/` (or by hand) and applied by
`interviewintel/pipeline/review.py` on the next run. Files are applied once
and never edited afterwards: the ledger remembers which it has applied, and
`git log` records who committed each one. Format: see `review.py`.
