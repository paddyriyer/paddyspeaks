"""Shared helpers for the platform build (stdlib only).

Every generator in this package is deterministic: the same repository state
produces byte-identical output. That is what lets `build.py check` fail CI on
drift instead of on noise.
"""
from __future__ import annotations

import html
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITE = "https://paddyspeaks.com"

# HTML that is never a public page: fragments, tooling, admin, vendor code.
EXCLUDED_HTML_PREFIXES = (
    "interview/data/enrichments/",
    "interview.app/partials/",
    "interview.app/vendor/",
    "scripts/",
    "tools/",
    "privacy-agent/",
    "node_modules/",
)


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def read_json(path: str | Path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def dump_json(obj, compact: bool = False) -> str:
    if compact:
        return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, indent=2) + "\n"


def write_if_changed(path: str | Path, text: str) -> bool:
    """Write text to path only when it differs. Returns True if written."""
    p = ROOT / path
    if p.exists() and p.read_text(encoding="utf-8") == text:
        return False
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")
    return True


def tracked_files(pattern: str = "*.html") -> list[str]:
    """Git-tracked files matching a pattern (falls back to a filesystem walk)."""
    try:
        out = subprocess.run(
            ["git", "ls-files", "-z", "--", pattern],
            cwd=ROOT, capture_output=True, check=True,
        ).stdout.decode("utf-8")
        files = [f for f in out.split("\0") if f]
    except Exception:
        files = [rel(p) for p in ROOT.rglob(pattern)]
    return sorted(files)


def public_html_files() -> list[str]:
    return [f for f in tracked_files("*.html") if not f.startswith(EXCLUDED_HTML_PREFIXES)]


def strip_tags(s: str) -> str:
    s = re.sub(r"<(script|style)\b.*?</\1>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def url_for(path: str) -> str:
    """Site-relative URL for a repo path ('bhagavad-gita/' stays a directory URL)."""
    return "/" + path.lstrip("/")
