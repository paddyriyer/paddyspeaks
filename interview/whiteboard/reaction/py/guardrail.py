"""The deterministic layer between an AI operations agent and production.

The agent proposes; this code decides what may happen without a person.
It is boring on purpose: the same inputs give the same verdict, every
verdict is logged with the evidence it saw, and nothing here calls a model.
"""
import hashlib
import json
from dataclasses import dataclass, field

AUTO_SCALE_LIMIT_PCT = 50        # per decision, either direction
MATCH_EVENT_QUIET_S = 20         # media seconds after a boundary or wicket
INTEGRITY_SIGNALS_REQUIRED = 2   # independent signals, never one


@dataclass(frozen=True)
class Proposal:
    action: str                  # 'scale_fanout' | 'throttle_ingest' | 'degrade' | 'page_human'
    params: dict
    rationale: str               # the agent's words: logged, never trusted


@dataclass(frozen=True)
class Context:
    media_sec: int
    last_match_event: tuple[str, int] | None   # ('six', 125) from the ball-by-ball feed
    integrity_signals: frozenset[str]          # e.g. {'metronomic', 'shared_device'}


@dataclass
class Guardrail:
    audit: list = field(default_factory=list)

    def decide(self, p: Proposal, ctx: Context) -> str:
        verdict, reason = self._rule(p, ctx)
        evidence = {"proposal": p.__dict__, "context": {
            "media_sec": ctx.media_sec, "last_match_event": ctx.last_match_event,
            "integrity_signals": sorted(ctx.integrity_signals)}}
        self.audit.append({
            "verdict": verdict, "reason": reason, "evidence": evidence,
            "evidence_sha256": hashlib.sha256(
                json.dumps(evidence, sort_keys=True).encode()).hexdigest()})
        return verdict

    def _rule(self, p: Proposal, ctx: Context) -> tuple[str, str]:
        if p.action == "page_human":
            return "execute", "asking a person is always allowed"
        if p.action == "scale_fanout":
            pct = p.params.get("pct", 0)
            if abs(pct) <= AUTO_SCALE_LIMIT_PCT:
                return "execute", "within the automatic scaling bound"
            return "needs_human", "scaling beyond the automatic bound"
        if p.action == "throttle_ingest":
            ev = ctx.last_match_event
            if ev and ev[0] in {"four", "six", "wicket"} and ctx.media_sec - ev[1] <= MATCH_EVENT_QUIET_S:
                return "needs_human", f"a {ev[0]} at media {ev[1]} explains a synchronised surge"
            if len(ctx.integrity_signals) < INTEGRITY_SIGNALS_REQUIRED:
                return "needs_human", "fewer than two independent integrity signals"
            return "execute", "two or more integrity signals, no match event"
        if p.action == "degrade":
            level = p.params.get("level", 0)
            if level <= 2:
                return "execute", "levels 1-2 are reversible and pre-approved"
            return "needs_human", "level 3+ turns the feature off for everyone"
        return "reject", f"unknown action {p.action!r}"
