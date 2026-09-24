#!/usr/bin/env python3
"""Scan tracked files for committed credentials (P0.6). Stdlib only.

    python3 scripts/platform_build/secret_scan.py            # every tracked file
    python3 scripts/platform_build/secret_scan.py --history  # also every past commit's added lines

Exit 1 on any finding. A false positive is silenced by adding
`secret-scan: allow` on the same line, with a comment saying why. Never
allowlist a real key: rotate it (docs/SECURITY.md#if-a-secret-leaks).

It complements GitHub's own push protection (docs/REPO-GUARDRAILS.md), which
must be switched on in repository settings and cannot live in a file.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

PATTERNS = [
    ("Anthropic API key", re.compile(r"sk-ant-(?:api|admin)\d{2}-[A-Za-z0-9_\-]{20,}")),
    ("OpenAI API key", re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9]{32,}\b")),
    ("AWS access key id", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("GitHub token", re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_\-]{35}\b")),
    ("Resend API key", re.compile(r"\bre_[A-Za-z0-9]{8}_[A-Za-z0-9]{16,}\b")),
    ("Slack token", re.compile(r"\bxox[abprs]-[A-Za-z0-9\-]{10,}\b")),
    ("Stripe secret key", re.compile(r"\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b")),
    ("Cloudflare API token", re.compile(r"(?i)cloudflare[^\n]{0,30}(?:token|key)[\"'\s:=]+[A-Za-z0-9_\-]{40}\b")),
    ("Private key block", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----")),
    ("Generic assigned secret", re.compile(
        r"(?i)\b(?:api[_-]?key|secret|password|passwd|token)\b\s*[:=]\s*[\"']([A-Za-z0-9_\-+/]{24,})[\"']")),
]

# Big generated data and binaries: nothing secret is written there, and
# scanning them costs minutes.
SKIP_PREFIXES = ("jobs/data/", "interview/data/", "interview.app/vendor/", "images/")
SKIP_SUFFIXES = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf", ".xlsx", ".docx", ".zip",
                 ".woff", ".woff2", ".ttf", ".ico", ".mp3", ".mp4", ".wasm", ".whl", ".tar", ".gz")
ALLOW_MARK = "secret-scan: allow"
MAX_BYTES = 3_000_000


def scan_text(path: str, text: str) -> list[str]:
    out = []
    for n, line in enumerate(text.splitlines(), 1):
        if ALLOW_MARK in line:
            continue
        for name, rx in PATTERNS:
            m = rx.search(line)
            if not m:
                continue
            val = m.group(1) if m.groups() else m.group(0)
            # A generic assignment of an obvious placeholder is not a secret.
            if name == "Generic assigned secret" and re.search(r"(?i)example|placeholder|your[_-]|xxxx|dummy|test", val):
                continue
            shown = val[:6] + "…" + val[-2:] if len(val) > 10 else "…"
            out.append(f"{path}:{n}: {name} ({shown})")
    return out


def tracked() -> list[str]:
    out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True).stdout
    return [f for f in out.decode().split("\0") if f]


def scan_tree() -> list[str]:
    findings = []
    for f in tracked():
        if f.startswith(SKIP_PREFIXES) or f.lower().endswith(SKIP_SUFFIXES):
            continue
        p = ROOT / f
        try:
            if p.stat().st_size > MAX_BYTES:
                continue
            text = p.read_text(encoding="utf-8")
        except (UnicodeDecodeError, FileNotFoundError, IsADirectoryError):
            continue
        findings += scan_text(f, text)
    return findings


def scan_history() -> list[str]:
    log = subprocess.run(["git", "log", "-p", "--no-color", "--unified=0", "--format=commit %H"],
                         cwd=ROOT, capture_output=True).stdout.decode("utf-8", "replace")
    findings, commit, path = [], "", ""
    for line in log.splitlines():
        if line.startswith("commit "):
            commit = line[7:15]
        elif line.startswith("+++ b/"):
            path = line[6:]
        elif line.startswith("+") and not line.startswith("+++"):
            if path.startswith(SKIP_PREFIXES):
                continue
            for f in scan_text(f"{commit}:{path}", line[1:]):
                findings.append(f)
    return findings


def main() -> int:
    findings = scan_tree()
    if "--history" in sys.argv:
        findings += scan_history()
    if findings:
        print(f"✗ {len(findings)} possible secret(s):")
        for f in findings:
            print("  " + f)
        print("If one is real: rotate it first, then remove it (docs/SECURITY.md).")
        return 1
    print("✓ no secrets found in tracked files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
