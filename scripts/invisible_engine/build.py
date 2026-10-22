"""Write (or check) everything GENERATED for The Invisible Engine.

    python3 scripts/invisible_engine/build.py                 # write scenes, cover and pages
    python3 scripts/invisible_engine/build.py --check         # fail if anything is stale (CI)
    python3 scripts/invisible_engine/build.py module04 m04    # only those scene modules / pages

Sources:
  scenes/moduleNN.py   every scene diagram → invisible-engine/scenes/sNN.svg
  cover.py             the Read page cover → invisible-engine/art/cover.svg
  pages.py + content/  the lesson home and module pages → invisible-engine/*.html
PNGs are rendered separately by render.mjs (needs playwright). See docs/INVISIBLE-ENGINE.md.
"""
from __future__ import annotations

import importlib
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
OUT = ROOT / "invisible-engine" / "scenes"


def modules() -> list[str]:
    return sorted(p.stem for p in (HERE / "scenes").glob("module[0-9][0-9].py"))


def collect(only: list[str]) -> dict[pathlib.Path, str]:
    out: dict[pathlib.Path, str] = {}
    seen: dict[int, str] = {}
    scene_mods = [m for m in modules() if not only or m in only]
    for m in scene_mods:
        mod = importlib.import_module(f"scenes.{m}")
        for n, svg in mod.scenes.items():
            if n in seen:
                raise SystemExit(f"scene {n:02d} defined in both {seen[n]} and {m}")
            seen[n] = m
            out[OUT / f"s{n:02d}.svg"] = svg
    if not only:
        from cover import cover
        out[ROOT / "invisible-engine" / "art" / "cover.svg"] = cover()
    page_only = [a for a in only if a.startswith("m") and not a.startswith("module")]
    if not only or page_only:
        import pages
        out.update(pages.build(page_only or None))
    return out


def main(argv: list[str]) -> int:
    check = "--check" in argv
    only = [a for a in argv if not a.startswith("--")]
    stale = []
    for p, text in collect(only).items():
        old = p.read_text(encoding="utf-8") if p.exists() else None
        if old == text:
            continue
        if check:
            stale.append(str(p.relative_to(ROOT)))
        else:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(text, encoding="utf-8")
            print(f"  wrote {p.relative_to(ROOT)}")
    if stale:
        print("stale (run python3 scripts/invisible_engine/build.py): " + ", ".join(stale))
        return 1
    if check:
        print("✓ invisible-engine scenes, cover and pages up to date")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
