"""Write (or check) The Invisible Engine scene SVGs from their Python sources.

    python3 scripts/invisible_engine/build.py           # write invisible-engine/scenes/sNN.svg
    python3 scripts/invisible_engine/build.py --check   # fail if any SVG is stale (CI)

Sources: scripts/invisible_engine/scenes/moduleNN.py, and cover.py for the
cover (invisible-engine/art/cover.svg). PNGs are rendered
separately by render.mjs (needs playwright). See docs/INVISIBLE-ENGINE.md.
"""
from __future__ import annotations

import importlib
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "invisible_engine"))
OUT = ROOT / "invisible-engine" / "scenes"
MODULES = ["module01", "module02"]


def collect() -> dict[object, str]:
    out: dict[object, str] = {}
    for m in MODULES:
        mod = importlib.import_module(f"scenes.{m}")
        for n, svg in mod.scenes.items():
            if n in out:
                raise SystemExit(f"scene {n:02d} defined twice")
            out[n] = svg
    from cover import cover
    out["cover"] = cover()
    return out


def main(argv: list[str]) -> int:
    check = "--check" in argv
    stale = []
    for n, svg in collect().items():
        p = ROOT / "invisible-engine" / "art" / "cover.svg" if n == "cover" else OUT / f"s{n:02d}.svg"
        old = p.read_text(encoding="utf-8") if p.exists() else None
        if old == svg:
            continue
        if check:
            stale.append(p.name)
        else:
            OUT.mkdir(parents=True, exist_ok=True)
            p.write_text(svg, encoding="utf-8")
            print(f"  wrote {p.relative_to(ROOT)}")
    if stale:
        print("stale scene SVGs (run python3 scripts/invisible_engine/build.py): " + ", ".join(stale))
        return 1
    if check:
        print("✓ invisible-engine scenes up to date")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
