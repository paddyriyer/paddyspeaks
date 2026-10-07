"""Entry point.

    python3 -m interviewintel.pipeline.run all        # decisions → discover → enrich → publish
    python3 -m interviewintel.pipeline.run publish    # decisions → enrich → publish (no searching)
    python3 -m interviewintel.pipeline.run plan       # print this run's sources (and searches) and exit

Environment (all optional; each missing piece skips its stage, never fakes it):
  INTEL_SOURCES           comma list from feeds.SOURCES (default: all free sources)
  ANTHROPIC_API_KEY       the existing key: classifier, extractor, tie-breaker, enrichment
  INTEL_MODEL             default claude-haiku-4-5
  INTEL_SEARCH_PROVIDER   OPTIONAL paid search API (exa | tavily | brave | google);
                          unset = none, which is the default and costs nothing
  INTEL_TODAY             YYYY-MM-DD, for reproducible runs and tests

Exit status: 0 on success, including "nothing new". 1 when decisions could
not be applied cleanly or every source failed, so the workflow does not
commit a half-run.
"""
from __future__ import annotations

import datetime as _dt
import json
import os
import sys

from . import config, discover, enrich, feeds, http, llm, providers, publish, queries, review, store


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
        print("free sources:", os.environ.get("INTEL_SOURCES", ",".join(feeds.DEFAULT)))
        if os.environ.get("INTEL_SEARCH_PROVIDER"):
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
        client = http.Client(budget=config.MAX_HTTP + config.MAX_QUERIES)
        wanted = [x.strip() for x in os.environ.get("INTEL_SOURCES", ",".join(feeds.DEFAULT)).split(",") if x.strip()]
        srcs = [feeds.SOURCES[n](client) for n in wanted if n in feeds.SOURCES]
        paid = os.environ.get("INTEL_SEARCH_PROVIDER", "").strip()
        if paid:
            try:
                srcs.append(providers.SearchEngine(providers.get(paid, client, today), queries.plan(today)))
            except providers.NotConfigured as e:
                print(f"optional search API: not configured ({e}); skipped")
        health["sources"] = [getattr(s, "name", "?") for s in srcs]
        bank = store.read_json(config.BANK, [])
        result = discover.run(srcs, model, ledger, seen, bank if isinstance(bank, list) else [], today)
        health["discovery"] = result["stats"]
        health["errors"] = result["errors"][:50]
        print(json.dumps(result["stats"], sort_keys=True))
        if srcs and not result["stats"].get("sources_ok"):
            print("every source failed; not publishing this run")
            status = 1

    health["auto_published"] = review.auto_publish(ledger, when=today.isoformat())
    e = enrich.run(model, ledger, today.isoformat())
    health["enrichment"] = {"written": e["enriched"], "rejected": e["rejected"]}
    health.setdefault("errors", []).extend(e["errors"][:20])

    if model is not None:
        health["model_usage"] = {"calls": model.calls, "input_tokens": model.tokens_in,
                                 "output_tokens": model.tokens_out}
    store.write_json(config.LEDGER, ledger)
    store.write_json(config.SEEN, seen)
    store.write_json(config.HEALTH, health)
    out = publish.build(ledger, today, {k: health.get(k) for k in ("run_date", "sources", "model", "discovery",
                                                                    "model_usage")})
    print(json.dumps(out, sort_keys=True))
    return status


if __name__ == "__main__":
    sys.exit(main(sys.argv))
