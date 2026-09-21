"""Polite, budgeted HTTP for the ingestion pipeline.

Everything JobSignal fetches is a public, documented, keyless JSON endpoint
published by an employer's own ATS. This module exists to make that politeness
structural rather than a promise: one shared request budget, a per-host delay,
a descriptive User-Agent carrying a contact URL, and no cookie jar, no auth
header and no redirect chasing beyond what urllib does for plain GETs.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from urllib.parse import urlsplit

UA = ("PaddySpeaks-JobSignal/1.0 (+https://paddyspeaks.com/jobs/methodology/; "
      "contact https://paddyspeaks.com/contact/)")
TIMEOUT = 25
HOST_DELAY_S = 1.0


class BudgetExhausted(RuntimeError):
    """Raised when a run has spent its request allowance."""


class Fetcher:
    def __init__(self, budget: int = 1200, host_delay: float = HOST_DELAY_S):
        self.budget = budget
        self.spent = 0
        self.host_delay = host_delay
        self._last_hit: dict[str, float] = {}

    def _wait(self, url: str) -> None:
        host = urlsplit(url).netloc
        last = self._last_hit.get(host)
        if last is not None:
            gap = self.host_delay - (time.monotonic() - last)
            if gap > 0:
                time.sleep(gap)
        self._last_hit[host] = time.monotonic()

    def _spend(self) -> None:
        if self.spent >= self.budget:
            raise BudgetExhausted(f"request budget of {self.budget} exhausted")
        self.spent += 1

    def get_json(self, url: str, accept: str = "application/json"):
        self._spend()
        self._wait(url)
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return json.loads(r.read().decode("utf-8", errors="replace"))

    def probe(self, url: str) -> tuple[str, str]:
        """Check that an application URL responds. Returns (outcome, detail).

        A GET, not a HEAD: several ATS hosts answer HEAD with 405 while the page
        itself is perfectly healthy, and a 405 recorded as a failure would put a
        false caution signal on a live job.
        """
        self._spend()
        self._wait(url)
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                code = r.getcode()
                return ("http_ok" if 200 <= code < 300 else "http_error", str(code))
        except urllib.error.HTTPError as e:
            return ("http_error", str(e.code))
        except Exception as e:  # noqa: BLE001 - network shape varies; never crash a run
            return ("http_error", type(e).__name__)
