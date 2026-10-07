"""Free sources (brief §1, §16): the default URL-discovery stage. No cost.

Every source here is a public, documented, keyless API or feed — the same
"Tier 1" rule JobSignal follows — or PaddySpeaks' own community form:

  community      the published CSV of the existing /interview.app/submit/ form:
                 questions candidates chose to share with PaddySpeaks
  hn             Hacker News search API (hn.algolia.com): stories and comments
  stackexchange  Stack Exchange API: questions on Stack Overflow and sister sites
  devto          DEV (dev.to) public articles API, by tag
  medium         Medium's public tag RSS feeds

Each source returns `SearchResult`s and nothing else. A new source is a class
here plus one entry in SOURCES; the ledger, the classifier and the pages do
not change. Authors, usernames and profile fields in an API response are
dropped here and never stored (brief §14).

LinkedIn has no free public API or feed, so it is not a source. A LinkedIn
experience reaches PaddySpeaks only if its author submits it through the
community form.
"""
from __future__ import annotations

import csv
import datetime as _dt
import email.utils
import hashlib
import html
import io
import os
import re
import xml.etree.ElementTree as ET
from urllib.parse import quote, urlencode

from .providers import SearchResult

COMMUNITY_CSV = os.environ.get(
    "INTEL_COMMUNITY_CSV",
    # The same published sheet .github/scripts/ingest_submissions.py reads.
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQR6l6cmujYC5HRzDwQAoz2OYhjhBber7xVmR5_J6ZMhW14nUpV126DM4Vu2-MEgNZdmgX7aI6iEaAC/pub?gid=399863191&single=true&output=csv",
)
COMMUNITY_PAGE = "https://paddyspeaks.com/interview.app/submit/"

_TAG = re.compile(r"<[^>]+>")
_BLOCK = re.compile(r"</?(p|br|li|div|h\d|pre|blockquote|tr)\b[^>]*>", re.I)


def text_of(markup: str | None) -> str:
    """HTML or markdown → plain text. Code blocks keep their content."""
    t = _BLOCK.sub("\n", markup or "")
    t = html.unescape(_TAG.sub("", t))
    return re.sub(r"[ \t]+", " ", re.sub(r"\n\s*\n+", "\n", t)).strip()


def _iso(value) -> str | None:
    try:
        if isinstance(value, (int, float)):
            return _dt.datetime.fromtimestamp(value, _dt.UTC).date().isoformat()
        if isinstance(value, str) and value:
            if re.match(r"\d{4}-\d{2}-\d{2}", value):
                return value[:10]
            return email.utils.parsedate_to_datetime(value).date().isoformat()
    except (ValueError, TypeError, OverflowError):
        return None
    return None


def _since(today: _dt.date, days: int) -> int:
    return int(_dt.datetime.combine(today - _dt.timedelta(days=days), _dt.time(), _dt.UTC).timestamp())


class Community:
    """The existing community form. Already first-person interview questions,
    so it needs no classifier call (preset class A)."""
    name = "community"

    def __init__(self, http, url: str = COMMUNITY_CSV):
        self.http, self.url = http, url

    def collect(self, today, errors):
        return self.parse(self.http.get_text(self.url))

    @staticmethod
    def parse(csv_text: str) -> list[SearchResult]:
        out = []
        for row in csv.DictReader(io.StringIO(csv_text)):
            row = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items()}
            q = row.get("question", "")
            if len(q) < 15:
                continue
            ts = row.get("timestamp", "")
            # Identity from the timestamp and the question only: the name column
            # (if any) is never read.
            key = hashlib.sha1(f"{ts}\x1f{q}".encode()).hexdigest()[:16]
            published = None
            m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", ts)
            if m:
                published = f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
            lines = ["Interview question submitted to PaddySpeaks by the candidate who was asked it."]
            if row.get("company"):
                lines.append(f"Interviewed at: {row['company']}")
            if row.get("topic"):
                lines.append(f"Topic: {row['topic']}")
            if row.get("difficulty"):
                lines.append(f"Difficulty: {row['difficulty']}")
            lines.append(f"Question asked in the interview: {q}")
            out.append(SearchResult(f"{COMMUNITY_PAGE}?submission={key}", "Submitted to PaddySpeaks",
                                    "\n".join(lines), published, "community", "community form", preset_class="A"))
        return out


class HackerNews:
    name = "hn"
    QUERIES = ['"asked in an interview"', '"interview question"', '"onsite interview"',
               '"interview loop"', '"technical interview"', '"system design interview"']
    URL = "https://hn.algolia.com/api/v1/search_by_date"

    def __init__(self, http, days: int = 30, per_query: int = 30):
        self.http, self.days, self.per = http, days, per_query

    def collect(self, today, errors):
        out = []
        for q in self.QUERIES:
            params = {"query": q, "tags": "(story,comment)", "hitsPerPage": self.per,
                      "numericFilters": f"created_at_i>{_since(today, self.days)}"}
            try:
                doc = self.http.request_json("GET", self.URL + "?" + urlencode(params))
            except Exception as e:  # noqa: BLE001
                errors.append(f"hn {q}: {type(e).__name__}: {e}"[:300])
                continue
            out += self.parse(doc, q)
        return out

    @staticmethod
    def parse(doc: dict, query: str) -> list[SearchResult]:
        out = []
        for h in doc.get("hits") or []:
            oid = h.get("objectID")
            body = h.get("comment_text") or h.get("story_text") or ""
            if not oid or not body:
                continue
            title = h.get("title") or h.get("story_title") or "Hacker News discussion"
            out.append(SearchResult(f"https://news.ycombinator.com/item?id={oid}", title, text_of(body),
                                    _iso(h.get("created_at")), "hn", query))
        return out


class StackExchange:
    name = "stackexchange"
    SITES = ["stackoverflow", "softwareengineering", "datascience", "stats"]
    QUERY = "interview"
    URL = "https://api.stackexchange.com/2.3/search/advanced"

    def __init__(self, http, days: int = 30, per_site: int = 30):
        self.http, self.days, self.per = http, days, per_site

    def collect(self, today, errors):
        out = []
        for site in self.SITES:
            params = {"order": "desc", "sort": "creation", "q": self.QUERY, "site": site,
                      "pagesize": self.per, "fromdate": _since(today, self.days), "filter": "withbody"}
            try:
                doc = self.http.request_json("GET", self.URL + "?" + urlencode(params))
            except Exception as e:  # noqa: BLE001
                errors.append(f"stackexchange {site}: {type(e).__name__}: {e}"[:300])
                continue
            out += self.parse(doc, site)
            if doc.get("backoff"):
                break                       # the API asks callers to pause; honour it
        return out

    @staticmethod
    def parse(doc: dict, site: str) -> list[SearchResult]:
        return [SearchResult(item["link"], html.unescape(item.get("title") or ""), text_of(item.get("body")),
                             _iso(item.get("creation_date")), "stackexchange", f"{site}: interview")
                for item in doc.get("items") or [] if item.get("link") and item.get("body")]


class DevTo:
    name = "devto"
    TAGS = ["interview", "interviewquestions", "codinginterview", "systemdesign"]
    LIST = "https://dev.to/api/articles"
    TITLE = re.compile(r"interview|asked", re.I)

    def __init__(self, http, per_tag: int = 30, max_articles: int = 12):
        self.http, self.per, self.max = http, per_tag, max_articles

    def collect(self, today, errors):
        picked = {}
        for tag in self.TAGS:
            try:
                rows = self.http.request_json("GET", f"{self.LIST}?{urlencode({'tag': tag, 'per_page': self.per})}")
            except Exception as e:  # noqa: BLE001
                errors.append(f"devto {tag}: {type(e).__name__}: {e}"[:300])
                continue
            for a in rows or []:
                if a.get("id") and self.TITLE.search(a.get("title") or ""):
                    picked.setdefault(a["id"], (a, tag))
        out = []
        for aid, (a, tag) in list(picked.items())[: self.max]:
            try:
                full = self.http.request_json("GET", f"{self.LIST}/{int(aid)}")
            except Exception as e:  # noqa: BLE001
                errors.append(f"devto article {aid}: {type(e).__name__}: {e}"[:300])
                continue
            r = self.parse_article(full, tag)
            if r:
                out.append(r)
        return out

    @staticmethod
    def parse_article(a: dict, tag: str) -> SearchResult | None:
        body = a.get("body_markdown") or text_of(a.get("body_html"))
        if not a.get("url") or not body:
            return None
        return SearchResult(a["url"], a.get("title") or "", text_of(body), _iso(a.get("published_at")),
                            "devto", f"tag:{tag}")


class Medium:
    name = "medium"
    TAGS = ["interview-questions", "interview-experience", "coding-interview",
            "system-design-interview", "data-engineering-interview"]
    NS = {"content": "http://purl.org/rss/1.0/modules/content/"}

    def __init__(self, http):
        self.http = http

    def collect(self, today, errors):
        out = []
        for tag in self.TAGS:
            try:
                out += self.parse(self.http.get_text(f"https://medium.com/feed/tag/{quote(tag)}"), tag)
            except Exception as e:  # noqa: BLE001
                errors.append(f"medium {tag}: {type(e).__name__}: {e}"[:300])
        return out

    @classmethod
    def parse(cls, xml_text: str, tag: str) -> list[SearchResult]:
        out = []
        for item in ET.fromstring(xml_text).iter("item"):
            link = (item.findtext("link") or "").strip()
            body = item.findtext("content:encoded", namespaces=cls.NS) or item.findtext("description") or ""
            if link and body:
                out.append(SearchResult(link, (item.findtext("title") or "").strip(), text_of(body),
                                        _iso(item.findtext("pubDate")), "medium", f"tag:{tag}"))
        return out


SOURCES = {"community": Community, "hn": HackerNews, "stackexchange": StackExchange,
           "devto": DevTo, "medium": Medium}
DEFAULT = ["community", "hn", "stackexchange", "devto", "medium"]
