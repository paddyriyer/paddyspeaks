"""Claude, behind a four-method interface the rest of the pipeline depends on.

    classify(doc) -> dict          brief §2
    extract(doc)  -> list[dict]    brief §3–4
    same(a, b)    -> bool          brief §7 (only for borderline pairs)
    enrich(q)     -> dict          brief §5

`Claude` is the production implementation (the official `anthropic` SDK,
structured outputs, server-side refusal fallback). Tests substitute a fake
with the same four methods, so no test touches the network.

Model: INTEL_MODEL, default claude-opus-5-5. Effort is set per call: the
high-volume classifier runs at low effort, extraction and enrichment at medium.
"""
from __future__ import annotations

import json
import os

from . import prompts

DEFAULT_MODEL = "claude-opus-5-5"


class Unavailable(RuntimeError):
    """No API key: the model stages are skipped, never faked."""


class Refused(RuntimeError):
    pass


class Claude:
    def __init__(self, model: str | None = None):
        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise Unavailable("ANTHROPIC_API_KEY is not set")
        import anthropic  # imported here so the pipeline and its tests stay stdlib-only

        self._anthropic = anthropic
        self.client = anthropic.Anthropic(max_retries=4)
        self.model = model or os.environ.get("INTEL_MODEL") or DEFAULT_MODEL
        self.calls = 0

    def _ask(self, system: str, user: str, schema: dict, effort: str, max_tokens: int) -> dict:
        self.calls += 1
        resp = self.client.beta.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
            output_config={"effort": effort, "format": {"type": "json_schema", "schema": schema}},
            betas=["server-side-fallback-2026-07-01"],
            extra_body={"fallbacks": "default"},
        )
        if resp.stop_reason == "refusal":
            raise Refused(getattr(resp.stop_details, "category", None) or "refused")
        if resp.stop_reason == "max_tokens":
            raise Refused("output truncated at max_tokens")
        text = next((b.text for b in resp.content if b.type == "text"), "")
        return json.loads(text)

    def classify(self, doc: dict) -> dict:
        user = prompts.source_block(doc["url"], doc["title"], doc["published"], doc["text"])
        return self._ask(prompts.CLASSIFY_SYSTEM, user, prompts.CLASSIFY_SCHEMA, "low", 2000)

    def extract(self, doc: dict) -> list[dict]:
        user = prompts.source_block(doc["url"], doc["title"], doc["published"], doc["text"])
        return self._ask(prompts.EXTRACT_SYSTEM, user, prompts.EXTRACT_SCHEMA, "medium", 16000)["questions"]

    def same(self, a: str, b: str) -> bool:
        user = f"Question 1:\n{a}\n\nQuestion 2:\n{b}"
        return bool(self._ask(prompts.SAME_SYSTEM, user, prompts.SAME_SCHEMA, "low", 1000)["same"])

    def enrich(self, q: dict) -> dict:
        user = (f"Practice question ({q['category']}, {q.get('difficulty') or 'unrated'}):\n"
                f"{q['question']}")
        return self._ask(prompts.ENRICH_SYSTEM, user, prompts.ENRICH_SCHEMA, "medium", 16000)


def get():
    return Claude()
