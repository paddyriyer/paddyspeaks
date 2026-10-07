"""Entry point.

    python3 -m interviewintel.pipeline.run all        # decisions → discover → enrich → publish
    python3 -m interviewintel.pipeline.run publish    # decisions → enrich → publish (no searching)
    python3 -m interviewintel.pipeline.run plan       # print this run's searches and exit

Environment (all optional; each missing piece skips its stage, never fakes it):
  INTEL_SEARCH_PROVIDER   exa | tavily | brave | google | fixture   (default: exa)
  <provider key>          see providers.py
  ANTHROPIC_API_KEY       the classifier, extractor, tie-breaker and enrichment
  INTEL_MODEL             default claude-opus-5-5
  INTEL_TODAY             YYYY-MM-DD, for reproducible runs and tests

Exit status: 0 on success, including "nothing new". 1 when decisions could
not be applied cleanly or every search failed, so the workflow does not
commit a half-run.
"""
from __future__ import annotations

import datetime as _dt
import json
import os
import sys

from . import config, discover, enrich, http, llm, providers, publish, queries, review, store


def _today() -> _dt.date:
    v = os.environ.get("INTEL_TODAY")
    return _dt.date.fromisoformat(v) if v else _dt.datetime.now(_dt.UTC).date()


def _model():
    try:
        return llm.get()
    except llm.Unavailable as e:
        print(f"model: not configured ({e}); model stages skipped")
        return None


def main(argv: list[str]) -> int:
    mode = (argv[1] if len(argv) > 1 else "all").lower()
    today = _today()
    if mode == "plan":
        for q in queries.plan(today):
            print(q.as_operator_string())
        return 0
    if mode not in ("all", "publish"):
        print(__doc__)
        return 2

    ledger = store.load_ledger()
    seen = store.load_seen()
    health = {"run_date": today.isoformat(), "mode": mode}
    status = 0

    done, errors = review.apply_pending_files(ledger)
    health["decision_files_applied"] = done
    if errors:
        health["decision_errors"] = errors
        print("decision errors:\n  " + "\n  ".join(errors))
        status = 1

    model = _model()
    health["model"] = getattr(model, "model", None)

    if mode == "all":
        name = os.environ.get("INTEL_SEARCH_PROVIDER", "exa")
        try:
            provider = providers.get(name, http.Client(budget=config.MAX_QUERIES + 4), today)
        except providers.NotConfigured as e:
            provider = None
            health["provider"] = f"{name}: not configured ({e})"
            print(f"search: not configured ({e}); discovery skipped")
        if provider is not None:
            bank = store.read_json(config.BANK, [])
            result = discover.run(provider, model, ledger, seen, bank if isinstance(bank, list) else [], today)
            health["provider"] = name
            health["discovery"] = result["stats"]
            health["errors"] = result["errors"][:50]
            print(json.dumps(result["stats"], sort_keys=True))
            if result["stats"].get("queries", 0) == 0 and result["errors"]:
                print("every search failed; not publishing this run")
                status = 1

    health["auto_published"] = review.auto_publish(ledger, when=today.isoformat())
    e = enrich.run(model, ledger, today.isoformat())
    health["enrichment"] = {"written": e["enriched"], "rejected": e["rejected"]}
    health.setdefault("errors", []).extend(e["errors"][:20])

    store.write_json(config.LEDGER, ledger)
    store.write_json(config.SEEN, seen)
    store.write_json(config.HEALTH, health)
    out = publish.build(ledger, today, {k: health.get(k) for k in ("run_date", "provider", "model", "discovery")})
    print(json.dumps(out, sort_keys=True))
    return status


if __name__ == "__main__":
    sys.exit(main(sys.argv))
