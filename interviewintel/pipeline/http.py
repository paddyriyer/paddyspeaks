"""The only network door the discovery pipeline has, besides the Claude SDK.

The brief forbids scraping LinkedIn, simulating a logged-in user, using
cookies or crawling. This module makes that structural rather than a promise:

* it talks ONLY to the search providers' documented API hosts (ALLOWED_HOSTS);
* it has no cookie jar and sends no browser identity;
* it has no function that fetches an arbitrary page. The pipeline reads only
  what a search provider returns for a query. A source page — LinkedIn or
  anything else — is never requested by us.

tests/test_pipeline.py asserts all three.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from urllib.parse import urlsplit

UA = "PaddySpeaks-InterviewIntel/1.0 (+https://paddyspeaks.com/interview.app/reported/about/)"
TIMEOUT = 30

ALLOWED_HOSTS = {
    "api.exa.ai",
    "api.tavily.com",
    "api.search.brave.com",
    "www.googleapis.com",
}


class BudgetExhausted(RuntimeError):
    pass


class HostNotAllowed(RuntimeError):
    pass


class Client:
    def __init__(self, budget: int = 60, delay_s: float = 0.6):
        self.budget = budget
        self.spent = 0
        self.delay_s = delay_s
        self._last = 0.0

    def _check(self, url: str) -> None:
        host = urlsplit(url).hostname or ""
        if host not in ALLOWED_HOSTS:
            raise HostNotAllowed(f"refusing to contact {host!r}: only search-provider APIs are allowed")
        if self.spent >= self.budget:
            raise BudgetExhausted(f"search budget of {self.budget} requests exhausted")
        self.spent += 1
        gap = self.delay_s - (time.monotonic() - self._last)
        if gap > 0:
            time.sleep(gap)
        self._last = time.monotonic()

    def request_json(self, method: str, url: str, headers: dict | None = None, body: dict | None = None):
        self._check(url)
        data = json.dumps(body).encode("utf-8") if body is not None else None
        h = {"User-Agent": UA, "Accept": "application/json"}
        if data is not None:
            h["Content-Type"] = "application/json"
        h.update(headers or {})
        req = urllib.request.Request(url, data=data, method=method, headers=h)
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return json.loads(r.read().decode("utf-8", errors="replace"))
