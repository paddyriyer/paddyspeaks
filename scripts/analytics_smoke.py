#!/usr/bin/env python3
"""
Production smoke check for the analytics Worker (ps.paddyspeaks.com).

Why this exists: on 2026-09-24 a Worker change dropped
Access-Control-Allow-Credentials. Every browser then refused to send page views
— silently: navigator.sendBeacon() still returns true — and nothing noticed
for a day. This asks the live Worker exactly what a browser asks before each
beacon, and applies the browser's rule. It records nothing (a preflight never
reaches the database), and the pixel probe uses a bot user agent, which the
Worker's pixel handler ignores.

    python scripts/analytics_smoke.py          # exit 1 on any failure
"""
from __future__ import annotations

import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("ANALYTICS_BASE", "https://ps.paddyspeaks.com")
ORIGINS = ["https://paddyspeaks.com", "https://www.paddyspeaks.com"]
UA = "PaddySpeaks-smoke-check-bot/1.0 (+https://github.com/paddyriyer/paddyspeaks)"


def request(method: str, path: str, headers: dict[str, str]) -> tuple[int, dict[str, str]]:
    req = urllib.request.Request(BASE + path, method=method, headers={"User-Agent": UA, **headers})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, {k.lower(): v for k, v in r.headers.items()}
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in e.headers.items()}


def check_preflight(path: str, origin: str) -> list[str]:
    """The CORS check Chrome/Firefox/Safari apply to a credentialed JSON beacon."""
    status, h = request("OPTIONS", path, {
        "Origin": origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })
    where = f"OPTIONS {path} from {origin}"
    problems = []
    if not 200 <= status < 300:
        problems.append(f"{where}: status {status}")
    if h.get("access-control-allow-origin") != origin:
        problems.append(f"{where}: Access-Control-Allow-Origin is {h.get('access-control-allow-origin')!r}")
    if h.get("access-control-allow-credentials") != "true":
        problems.append(f"{where}: Access-Control-Allow-Credentials is "
                        f"{h.get('access-control-allow-credentials')!r} (browsers require 'true' for sendBeacon)")
    methods = [m.strip().upper() for m in h.get("access-control-allow-methods", "").split(",")]
    if "POST" not in methods:
        problems.append(f"{where}: POST not in Access-Control-Allow-Methods")
    allowed = [x.strip().lower() for x in h.get("access-control-allow-headers", "").split(",")]
    if "content-type" not in allowed:
        problems.append(f"{where}: content-type not in Access-Control-Allow-Headers")
    return problems


def main() -> int:
    problems: list[str] = []
    for origin in ORIGINS:
        for path in ("/api/v", "/api/e"):
            problems += check_preflight(path, origin)
    status, h = request("GET", "/api/px.gif?p=/__smoke-check", {})
    if status != 200 or not h.get("content-type", "").startswith("image/gif"):
        problems.append(f"GET /api/px.gif: status {status}, content-type {h.get('content-type')!r}")
    if problems:
        print("analytics smoke check FAILED — browsers are not sending page views:")
        for p in problems:
            print("  -", p)
        return 1
    print("analytics smoke check OK — preflights pass for", ", ".join(ORIGINS), "and the pixel responds")
    return 0


if __name__ == "__main__":
    sys.exit(main())
