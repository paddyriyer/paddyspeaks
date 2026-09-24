#!/usr/bin/env python3
"""PaddySpeaks platform build: one CLI for every generated platform artefact.

    python3 scripts/platform_build/build.py all        # regenerate everything
    python3 scripts/platform_build/build.py check      # CI: fail on any drift (writes nothing)
    python3 scripts/platform_build/build.py registry stamp   # just the counts

Steps (run in this order by `all`):
    registry   data/site-registry.json from content (P0.1)
    stamp      write registry numbers into [data-ps-stat] elements (P0.1)
    pages      render corrections / changelog lists into their pages (P0.3, P1.7)
    search     data/search/*.json universal search index (P1.2)
    graph      data/graph.json knowledge graph (P2.1)
    feeds      feed.xml, feeds/<category>.xml, changelog.xml (P1.6)
    api        api/v1/*.json public read-only feeds (P2.4)

Stdlib only. Deterministic. Never regenerates index.html — the stamp step
rewrites only the digits inside opted-in elements.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from platform_build import checks, registry, stamp  # noqa: E402
from platform_build.common import dump_json, read_json, write_if_changed  # noqa: E402

STEPS = ["registry", "stamp", "pages", "search", "graph", "feeds", "api"]


def step_registry(write: bool) -> list[str]:
    reg = registry.build()
    text = dump_json(reg)
    if write:
        write_if_changed(registry.REGISTRY, text)
        return []
    cur = (registry.ROOT / registry.REGISTRY)
    if not cur.exists() or cur.read_text(encoding="utf-8") != text:
        return [f"{registry.REGISTRY} is stale — run: python3 scripts/platform_build/build.py registry stamp"]
    return []


def step_stamp(write: bool) -> list[str]:
    reg = registry.build()
    changed, errors = stamp.run(registry.stats(reg), write=write)
    if write:
        for f in changed:
            print(f"  stamped {f}")
        return errors
    return errors + [f"{f}: stamped statistic out of date — run: python3 scripts/platform_build/build.py stamp" for f in changed]


# Step name → module, where they differ.
MODULES = {"search": "search_index", "graph": "graph", "feeds": "feeds", "api": "api", "pages": "pages"}


def _optional(name):
    name = MODULES.get(name, name)
    try:
        return __import__(f"platform_build.{name}", fromlist=["run"])
    except ModuleNotFoundError as e:
        if e.name == f"platform_build.{name}":
            return None
        raise


def step_generic(name: str, write: bool) -> list[str]:
    mod = _optional(name)
    if mod is None:
        return []
    return mod.run(write=write)


def main(argv: list[str]) -> int:
    args = argv[1:] or ["all"]
    if args == ["check"]:
        problems: list[str] = []
        problems += step_registry(False)
        problems += step_stamp(False)
        for name in STEPS[2:]:
            problems += step_generic(name, False)
        problems += checks.run_all()
        if problems:
            print(f"✗ platform check failed ({len(problems)} problem(s)):")
            for p in problems:
                print(f"  - {p}")
            return 1
        print("✓ platform check passed")
        return 0

    steps = STEPS if args == ["all"] else args
    unknown = [s for s in steps if s not in STEPS]
    if unknown:
        print(f"unknown step(s): {', '.join(unknown)}; valid: {', '.join(STEPS)}, all, check")
        return 2
    errors: list[str] = []
    for s in steps:
        print(f"▸ {s}")
        if s == "registry":
            errors += step_registry(True)
        elif s == "stamp":
            errors += step_stamp(True)
        else:
            errors += step_generic(s, True)
    if errors:
        for e in errors:
            print(f"  ✗ {e}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
