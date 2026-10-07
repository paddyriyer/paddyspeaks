"""The only network door the discovery pipeline has, besides the Claude SDK.

The brief forbids scraping LinkedIn, simulating a logged-in user, using
cookies or crawling. This module makes that structural rather than a promise:

* it talks ONLY to the hosts in ALLOWED_HOSTS: free, documented, keyless
  public APIs and feeds (the JobSignal "Tier 1" rule), PaddySpeaks' own
  community form sheet, and — only if someone deliberately configures one —
  a paid search API. LinkedIn is not and never will be on the list;
* it has no cookie jar and sends no browser identity;
* it fetches API and feed endpoints only. A source's web page is never
  requested: every source is read through its documented API or feed.

tests/test_pipeline.py asserts all three.
"""
from __future__ import annotations

import gzip
import json
import time
import urllib.request
from urllib.parse import urlsplit

UA = "PaddySpeaks-InterviewIntel/1.0 (+https://paddyspeaks.com/interview.app/reported/about/)"
TIMEOUT = 30

FREE_HOSTS = {
    "hn.algolia.com",           # Hacker News search API (Algolia), public and keyless
    "api.stackexchange.com",    # Stack Exchange API, keyless quota
    "dev.to",                   # Forem public articles API (/api/…)
    "medium.com",               # public tag RSS feeds (/feed/tag/…)
    "docs.google.com",          # the published CSV of PaddySpeaks' own community form
}
PAID_HOSTS = {                  # optional, off by default; each needs a key someone pays for
    "api.exa.ai",
    "api.tavily.com",
    "api.search.brave.com",
    "www.googleapis.com",
}
ALLOWED_HOSTS = FREE_HOSTS | PAID_HOSTS
ALLOWED_PATHS = {               # on general-purpose hosts, only the API / feed paths
    "dev.to": "/api/",
    "medium.com": "/feed/",
    "docs.google.com": "/spreadsheets/d/e/",
}


class BudgetExhausted(RuntimeError):
    pass


class HostNotAllowed(RuntimeError):
    pass


class Client:
    def __init__(self, budget: int = 120, delay_s: float = 1.0):
        self.budget = budget
        self.spent = 0
        self.delay_s = delay_s
        self._last: dict[str, float] = {}

    def _check(self, url: str) -> None:
        p = urlsplit(url)
        host = p.hostname or ""
        if p.scheme != "https" or host not in ALLOWED_HOSTS:
            raise HostNotAllowed(f"refusing to contact {host!r}: not an allowed API or feed host")
        prefix = ALLOWED_PATHS.get(host)
        if prefix and not p.path.startswith(prefix):
            raise HostNotAllowed(f"refusing {host}{p.path}: only {prefix}… is an API or feed")
        if self.spent >= self.budget:
            raise BudgetExhausted(f"request budget of {self.budget} exhausted")
        self.spent += 1
        gap = self.delay_s - (time.monotonic() - self._last.get(host, 0.0))
        if gap > 0:
            time.sleep(gap)
        self._last[host] = time.monotonic()

    def _open(self, req) -> str:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            raw = r.read()
            if r.headers.get("Content-Encoding") == "gzip" or raw[:2] == b"\x1f\x8b":
                raw = gzip.decompress(raw)     # the Stack Exchange API always gzips
            return raw.decode("utf-8", errors="replace")

    def request_json(self, method: str, url: str, headers: dict | None = None, body: dict | None = None):
        self._check(url)
        data = json.dumps(body).encode("utf-8") if body is not None else None
        h = {"User-Agent": UA, "Accept": "application/json", "Accept-Encoding": "gzip"}
        if data is not None:
            h["Content-Type"] = "application/json"
        h.update(headers or {})
        return json.loads(self._open(urllib.request.Request(url, data=data, method=method, headers=h)))

    def get_text(self, url: str) -> str:
        """For RSS feeds and the community CSV."""
        self._check(url)
        h = {"User-Agent": UA, "Accept": "application/rss+xml, text/csv, text/plain, */*", "Accept-Encoding": "gzip"}
        return self._open(urllib.request.Request(url, headers=h))
