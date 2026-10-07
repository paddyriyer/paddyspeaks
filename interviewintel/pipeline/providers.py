"""Search providers (brief §1, §16): the URL-discovery stage.

Every adapter turns a `Query` into a list of `SearchResult`s and nothing else.
A new provider is a new class here plus one line in PROVIDERS — the ledger,
the classifier and the pages do not change.

What an adapter may keep from a provider's response: the URL, the page title,
the publication date when the provider states one, and the text the provider
returns for that page (snippet, highlights or extracted text). What it must
drop: author names, profile fields, images, anything about a person. The
pipeline collects interview knowledge, not people (brief §14).

Request shapes follow each provider's public API reference. Keys come only
from environment variables (GitHub Actions secrets); none is in the repo.

  Provider        env                                   notes
  exa             EXA_API_KEY                           domain filter + date filter + page text
  tavily          TAVILY_API_KEY                        domain filter + time range + content
  brave           BRAVE_SEARCH_API_KEY                  snippets only; site: operator
  google          GOOGLE_CSE_KEY, GOOGLE_CSE_CX         snippets only; site: operator
  fixture         INTEL_FIXTURE=path.json               offline: replays a saved result set

Bing Web Search is not offered: Microsoft retired the Bing Search APIs in
August 2025. Check Google's Custom Search JSON API terms before relying on it
for a new project.
"""
from __future__ import annotations

import datetime as _dt
import json
import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlencode

from .http import Client
from .queries import Query


@dataclass
class SearchResult:
    url: str
    title: str
    text: str                 # provider-supplied text about the page
    published: str | None     # YYYY-MM-DD when the provider states it
    provider: str
    query: str


class NotConfigured(RuntimeError):
    """The provider's key is not set. Discovery is skipped, not failed."""


def _date(value) -> str | None:
    if not value or not isinstance(value, str):
        return None
    v = value.strip()[:10]
    try:
        _dt.date.fromisoformat(v)
        return v
    except ValueError:
        return None


def _since(days: int, today: _dt.date) -> str:
    return (today - _dt.timedelta(days=days)).isoformat()


class Exa:
    name = "exa"
    URL = "https://api.exa.ai/search"

    def __init__(self, http: Client, today: _dt.date):
        self.key = os.environ.get("EXA_API_KEY", "")
        if not self.key:
            raise NotConfigured("EXA_API_KEY is not set")
        self.http, self.today = http, today

    def search(self, q: Query, n: int) -> list[SearchResult]:
        body = {
            "query": q.text,
            "numResults": n,
            "type": "auto",
            "startPublishedDate": _since(q.recency_days, self.today) + "T00:00:00.000Z",
            "contents": {"text": {"maxCharacters": 6000}, "highlights": {"maxCharacters": 1200}},
        }
        if q.site:
            body["includeDomains"] = [q.site.split("/")[0]]
        doc = self.http.request_json("POST", self.URL, {"x-api-key": self.key}, body)
        out = []
        for r in doc.get("results") or []:
            url = r.get("url") or ""
            if q.site and q.site not in url:
                continue        # includeDomains is the domain; keep the path scope too
            parts = [r.get("text") or ""] + list(r.get("highlights") or [])
            out.append(SearchResult(url, r.get("title") or "", "\n".join(p for p in parts if p),
                                    _date(r.get("publishedDate")), self.name, q.as_operator_string()))
        return out


class Tavily:
    name = "tavily"
    URL = "https://api.tavily.com/search"

    def __init__(self, http: Client, today: _dt.date):
        self.key = os.environ.get("TAVILY_API_KEY", "")
        if not self.key:
            raise NotConfigured("TAVILY_API_KEY is not set")
        self.http, self.today = http, today

    def search(self, q: Query, n: int) -> list[SearchResult]:
        body = {
            "query": q.text,
            "max_results": n,
            "search_depth": "advanced",
            "time_range": "month" if q.recency_days <= 31 else "year",
            "include_raw_content": False,
        }
        if q.site:
            body["include_domains"] = [q.site.split("/")[0]]
        doc = self.http.request_json("POST", self.URL, {"Authorization": f"Bearer {self.key}"}, body)
        out = []
        for r in doc.get("results") or []:
            url = r.get("url") or ""
            if q.site and q.site not in url:
                continue
            out.append(SearchResult(url, r.get("title") or "", r.get("content") or "",
                                    _date(r.get("published_date")), self.name, q.as_operator_string()))
        return out


class Brave:
    name = "brave"
    URL = "https://api.search.brave.com/res/v1/web/search"

    def __init__(self, http: Client, today: _dt.date):
        self.key = os.environ.get("BRAVE_SEARCH_API_KEY", "")
        if not self.key:
            raise NotConfigured("BRAVE_SEARCH_API_KEY is not set")
        self.http, self.today = http, today

    def search(self, q: Query, n: int) -> list[SearchResult]:
        params = {"q": q.as_operator_string(), "count": min(n, 20),
                  "freshness": "pm" if q.recency_days <= 31 else "py", "extra_snippets": "true"}
        doc = self.http.request_json("GET", self.URL + "?" + urlencode(params),
                                     {"X-Subscription-Token": self.key})
        out = []
        for r in ((doc.get("web") or {}).get("results")) or []:
            text = "\n".join([r.get("description") or ""] + list(r.get("extra_snippets") or []))
            out.append(SearchResult(r.get("url") or "", r.get("title") or "", text,
                                    _date(r.get("page_age")), self.name, q.as_operator_string()))
        return out


class Google:
    name = "google"
    URL = "https://www.googleapis.com/customsearch/v1"

    def __init__(self, http: Client, today: _dt.date):
        self.key = os.environ.get("GOOGLE_CSE_KEY", "")
        self.cx = os.environ.get("GOOGLE_CSE_CX", "")
        if not (self.key and self.cx):
            raise NotConfigured("GOOGLE_CSE_KEY / GOOGLE_CSE_CX are not set")
        self.http, self.today = http, today

    def search(self, q: Query, n: int) -> list[SearchResult]:
        months = max(1, round(q.recency_days / 30))
        params = {"key": self.key, "cx": self.cx, "q": q.as_operator_string(),
                  "num": min(n, 10), "dateRestrict": f"m{months}"}
        doc = self.http.request_json("GET", self.URL + "?" + urlencode(params))
        return [SearchResult(r.get("link") or "", r.get("title") or "", r.get("snippet") or "",
                             None, self.name, q.as_operator_string())
                for r in doc.get("items") or []]


class Fixture:
    """Replays a saved result set: {"<query text>": [SearchResult fields], "*": [...]}."""
    name = "fixture"

    def __init__(self, http: Client | None, today: _dt.date, path: str | None = None):
        p = path or os.environ.get("INTEL_FIXTURE", "")
        if not p:
            raise NotConfigured("INTEL_FIXTURE is not set")
        self.doc = json.loads(Path(p).read_text(encoding="utf-8"))

    def search(self, q: Query, n: int) -> list[SearchResult]:
        rows = self.doc.get(q.text, []) + self.doc.get("*", [])
        return [SearchResult(r["url"], r.get("title", ""), r.get("text", ""), r.get("published"),
                             self.name, q.as_operator_string()) for r in rows[:n]]


PROVIDERS = {"exa": Exa, "tavily": Tavily, "brave": Brave, "google": Google, "fixture": Fixture}


def get(name: str, http: Client, today: _dt.date):
    cls = PROVIDERS.get((name or "").lower())
    if cls is None:
        raise NotConfigured(f"unknown search provider {name!r}; choose one of {sorted(PROVIDERS)}")
    return cls(http, today)
