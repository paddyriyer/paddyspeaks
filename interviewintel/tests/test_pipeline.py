#!/usr/bin/env python3
"""Interview Intelligence tests — stdlib unittest, no network, no API keys.

    python3 -m interviewintel.tests.test_pipeline

These assert the rules in docs/INTERVIEW-INTEL.md. If one fails, the site
would be inventing a question, a company attribution or a date, copying
someone's post, exposing a person, or publishing something nobody approved.
"""
from __future__ import annotations

import datetime as _dt
import json
import pathlib
import re
import sys
import tempfile
import types
import unittest
from unittest import mock

from interviewintel.pipeline import (classify_rules, config, confidence, dedupe, discover, enrich, extract,
                                     feeds, http, llm, normalize, providers, publish, review, sources, store)

ROOT = pathlib.Path(__file__).resolve().parents[2]
TODAY = _dt.date(2026, 10, 7)

POST_A = ("Just finished my Amazon data engineer interview loop. In the technical screen I was asked "
          "how I would identify customers who purchased on three consecutive days. Then a second round "
          "on data modeling for a ride-sharing app. Reach me at jane.doe@example.org or +1 415 555 0134.")
POST_MENTION = ("Ten SQL questions I practise every week. Q1: find the second highest salary in an employees "
                "table. I use Google Sheets to track my progress and love it.")
AD = ("We're hiring! Apply now to join our team. Open positions for data engineers, salary range 150k. "
      "Send your CV. #hiring Interview process: 3 rounds.")


def li(slug):
    return f"https://www.linkedin.com/posts/someone_{slug}-activity-7?utm_source=share&utm_medium=member"


class FakeModel:
    model = "fake-model"

    def __init__(self, extractions=None, same=False, cls=None):
        self.extractions = extractions or {}
        self.same_answer = same
        self.cls = cls or {}
        self.calls = {"classify": 0, "extract": 0, "same": 0, "enrich": 0}

    def classify(self, doc):
        self.calls["classify"] += 1
        c = self.cls.get(doc["url"], "A")
        return {"class": c, "reason": "fake", "seo_list": False, "recruiting_ad": False,
                "selling_course": False, "spam": False, "states_specific_questions": True}

    def extract(self, doc):
        self.calls["extract"] += 1
        return self.extractions.get(doc["url"], [])

    def same(self, a, b):
        self.calls["same"] += 1
        return self.same_answer

    def enrich(self, q):
        self.calls["enrich"] += 1
        return {"topic": "SQL gaps and islands", "skills_tested": ["window functions"],
                "why_asked": "Interviewers often ask this because it tests date arithmetic.",
                "hints": ["Subtract a row number from the date."], "approach": "Group by date minus row_number.",
                "sample_solution": {"language": "sql", "code": "SELECT 1;", "explanation": "…"},
                "common_mistakes": ["Counting the same day twice"], "follow_ups": ["N days?"],
                "related_concepts": ["gaps and islands"], "estimated_minutes": 20,
                "similar_questions": [{"question": "Find users active five days in a row.", "what_changes": "N=5"}]}


def proposal(**kw):
    base = {
        "practice_question": "Given a table of customer transactions (customer_id, txn_date), write a SQL query "
                             "that returns customers who made purchases on at least three consecutive calendar days.",
        "title": "SQL — Consecutive Activity", "concept_key": "consecutive purchase days",
        "evidence": "I was asked how I would identify customers who purchased on three consecutive days",
        "asked_in_interview": True, "category": "SQL", "subcategory": "Window Functions",
        "difficulty": "Medium", "technology": ["SQL"],
        "company": "Amazon", "company_evidence": "my Amazon data engineer interview loop",
        "role": "Data Engineer", "role_evidence": "my Amazon data engineer interview loop",
        "interview_stage": "Technical Screen", "stage_evidence": "In the technical screen I was asked",
        "interview_year": None, "notes": "",
    }
    base.update(kw)
    return base


class FixtureSource:
    """A source with the same interface as feeds.py's: collect(today, errors)."""
    name = "fixture"

    def __init__(self, rows):
        self.rows = rows

    def collect(self, today, errors):
        return [providers.SearchResult(r["url"], r.get("title", ""), r["text"], r.get("published"), "fixture",
                                       "fixture", preset_class=r.get("preset_class")) for r in self.rows]


class TestNetworkBoundary(unittest.TestCase):
    def test_refuses_linkedin_and_any_web_page(self):
        c = http.Client(budget=20, delay_s=0)
        for url in ("https://www.linkedin.com/posts/x", "https://linkedin.com/feed", "https://example.org/a",
                    "https://dev.to/someone/my-interview-1abc",          # an article page, not the API
                    "https://medium.com/@x/my-google-interview-123",      # a post page, not a feed
                    "https://docs.google.com/document/d/abc",             # anything but the published sheet
                    "http://hn.algolia.com/api/v1/search"):               # plain http
            with self.assertRaises(http.HostNotAllowed, msg=url):
                c.request_json("GET", url)

    def test_no_code_path_fetches_a_source_page(self):
        """Only http.py may open a connection, and only to API and feed endpoints."""
        for f in (ROOT / "interviewintel").rglob("*.py"):
            text = f.read_text(encoding="utf-8")
            if f.name in ("http.py", "test_pipeline.py"):
                continue
            self.assertNotIn("urlopen", text, f)
            self.assertNotIn("urllib.request", text, f)
            self.assertNotRegex(text, r"\bimport (requests|httpx|selenium|playwright)", f)
        self.assertTrue(all("linkedin" not in h for h in http.ALLOWED_HOSTS))

    def test_no_cookie_or_session_handling(self):
        text = (ROOT / "interviewintel" / "pipeline" / "http.py").read_text(encoding="utf-8")
        code = re.sub(r'"""'+r'.*?'+r'"""', "", text, flags=re.S)
        for banned in ("http.cookiejar", "HTTPCookieProcessor", "Cookie", "li_at", "JSESSIONID"):
            self.assertNotIn(banned, code)


class TestNoExtraCost(unittest.TestCase):
    """The owner's rule: built on existing infrastructure, no new spend."""

    def test_default_sources_are_free(self):
        self.assertEqual(set(feeds.DEFAULT), set(feeds.SOURCES))
        for host in ("hn.algolia.com", "api.stackexchange.com", "dev.to", "medium.com", "docs.google.com"):
            self.assertIn(host, http.FREE_HOSTS)
        self.assertFalse(http.FREE_HOSTS & http.PAID_HOSTS)

    def test_no_paid_search_api_unless_explicitly_configured(self):
        wf = (ROOT / ".github" / "workflows" / "interview-intel.yml").read_text(encoding="utf-8")
        for key in ("EXA_API_KEY", "TAVILY_API_KEY", "BRAVE_SEARCH_API_KEY", "GOOGLE_CSE_KEY", "INTEL_SEARCH_PROVIDER"):
            self.assertNotIn(key, wf)

    def test_default_model_is_the_existing_cheap_one(self):
        self.assertEqual(llm.DEFAULT_MODEL, "claude-haiku-4-5")

    def test_haiku_request_shape(self):
        """Haiku takes structured outputs but no effort and no fallback beta."""
        sent = {}

        class Msgs:
            def create(self, **kw):
                sent.update(kw)
                block = types.SimpleNamespace(type="text", text=json.dumps({"same": True, "reason": "x"}))
                return types.SimpleNamespace(content=[block], stop_reason="end_turn", stop_details=None,
                                             usage=types.SimpleNamespace(input_tokens=10, output_tokens=5))

        fake = types.SimpleNamespace(Anthropic=lambda **kw: types.SimpleNamespace(messages=Msgs(), beta=None))
        with mock.patch.dict(sys.modules, {"anthropic": fake}), \
                mock.patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test", "INTEL_MODEL": ""}):
            m = llm.Claude()
            self.assertTrue(m.same("a", "b"))
        self.assertEqual(sent["model"], "claude-haiku-4-5")
        self.assertEqual(set(sent["output_config"]), {"format"})
        self.assertNotIn("betas", sent)
        self.assertEqual((m.tokens_in, m.tokens_out), (10, 5))

    def test_each_run_is_capped(self):
        self.assertLessEqual(config.MAX_CLASSIFY + config.MAX_EXTRACT + config.MAX_ADJUDICATE + config.MAX_ENRICH, 80)


class TestFeeds(unittest.TestCase):
    """Parsers against the documented response shapes of each free source."""

    def test_hacker_news(self):
        doc = {"hits": [{"objectID": "41", "comment_text": "<p>I was asked in an interview to design a cache &amp; "
                         "explain eviction.</p>", "story_title": "Ask HN: interview stories", "author": "someone",
                         "created_at": "2026-10-01T10:00:00.000Z"}, {"objectID": "42"}]}
        (r,) = feeds.HackerNews.parse(doc, "q")
        self.assertEqual(r.url, "https://news.ycombinator.com/item?id=41")
        self.assertIn("design a cache & explain", r.text)
        self.assertEqual(r.published, "2026-10-01")
        self.assertNotIn("someone", json.dumps(r.__dict__))

    def test_stack_exchange(self):
        doc = {"items": [{"link": "https://stackoverflow.com/questions/1/x", "title": "Interview question: 2nd max",
                          "body": "<p>In my interview I was asked to find the second highest salary.</p>",
                          "creation_date": 1790000000, "owner": {"display_name": "someone"}}]}
        (r,) = feeds.StackExchange.parse(doc, "stackoverflow")
        self.assertEqual(r.url, "https://stackoverflow.com/questions/1/x")
        self.assertNotIn("someone", json.dumps(r.__dict__))

    def test_devto_article(self):
        r = feeds.DevTo.parse_article({"url": "https://dev.to/u/my-interview-1", "title": "My Meta interview",
                                       "body_markdown": "I was asked **two** questions.", "published_at": "2026-09-30T00:00:00Z",
                                       "user": {"name": "someone"}}, "interview")
        self.assertEqual((r.url, r.published), ("https://dev.to/u/my-interview-1", "2026-09-30"))
        self.assertNotIn("someone", json.dumps(r.__dict__))

    def test_medium_rss(self):
        xml = ('<?xml version="1.0"?><rss xmlns:content="http://purl.org/rss/1.0/modules/content/" '
               'xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><item><title>My Amazon loop</title>'
               '<link>https://medium.com/@x/my-amazon-loop-1?source=rss----tag</link><dc:creator>Someone</dc:creator>'
               '<pubDate>Wed, 01 Oct 2026 10:00:00 GMT</pubDate>'
               '<content:encoded><![CDATA[<p>I was asked to design a rate limiter.</p>]]></content:encoded>'
               '</item></channel></rss>')
        (r,) = feeds.Medium.parse(xml, "interview-questions")
        self.assertEqual(r.published, "2026-10-01")
        self.assertEqual(sources.canonical_url(r.url), "https://medium.com/@x/my-amazon-loop-1")
        self.assertNotIn("Someone", json.dumps(r.__dict__))

    def test_community_form_drops_the_name(self):
        csv_text = ("Timestamp,Question,Topic,Difficulty,Company,Name\n"
                    "8/26/2026 1:38:36,Design a data model for a ride-sharing app's trips and payments,"
                    "Data Modeling,Medium,Citi,Jane Doe\n"
                    "8/27/2026 1:00:00,short,SQL,Easy,,\n")
        (r,) = feeds.Community.parse(csv_text)
        self.assertEqual(r.preset_class, "A")
        self.assertEqual(r.published, "2026-08-26")
        self.assertIn("Interviewed at: Citi", r.text)
        self.assertNotIn("Jane", json.dumps(r.__dict__))
        self.assertEqual(sources.source_type(sources.canonical_url(r.url)), "community")


class TestSources(unittest.TestCase):
    def test_canonical_url_drops_tracking(self):
        self.assertEqual(sources.canonical_url(li("abc")), "https://linkedin.com/posts/someone_abc-activity-7")

    def test_blocked_domains(self):
        self.assertTrue(sources.blocked_reason("https://www.glassdoor.com/Interview/x"))
        self.assertTrue(sources.blocked_reason("https://linkedin.com/in/jane"))
        self.assertIsNone(sources.blocked_reason("https://linkedin.com/posts/x"))

    def test_scrub_personal_data(self):
        s = sources.scrub(POST_A + " ping @janedoe")
        self.assertNotIn("jane.doe@example.org", s)
        self.assertNotIn("555 0134", s)
        self.assertNotIn("@janedoe", s)
        self.assertIn("three consecutive days", s)
        self.assertIn("2026", sources.scrub("In 2026 I interviewed"))

    def test_social_titles_never_name_the_author(self):
        self.assertEqual(sources.public_title("https://linkedin.com/posts/x", "Jane Doe on LinkedIn: my loop"),
                         "Public LinkedIn post")


class TestExtract(unittest.TestCase):
    def setUp(self):
        self.src = sources.scrub(POST_A)

    def test_kept_with_evidence(self):
        rec, why = extract.check(proposal(), self.src)
        self.assertEqual(why, "")
        self.assertEqual((rec["company"], rec["role"], rec["interview_stage"]),
                         ("amazon", "data-engineer", "Technical Screen"))

    def test_question_without_evidence_is_never_invented(self):
        rec, why = extract.check(proposal(evidence="They asked me to reverse a linked list"), self.src)
        self.assertIsNone(rec)
        self.assertIn("unsupported", why)

    def test_hallucinated_company_becomes_unknown(self):
        rec, _ = extract.check(proposal(company="Google", company_evidence="my Google interview loop"), self.src)
        self.assertIsNone(rec["company"])
        self.assertTrue(any("Google" in n for n in rec["notes"]))

    def test_a_mention_is_not_attribution(self):
        src = sources.scrub(POST_MENTION)
        p = proposal(practice_question="Given an employees table (id, name, salary), return the second highest "
                                       "distinct salary, or NULL when there is none.",
                     evidence="find the second highest salary in an employees table",
                     concept_key="second highest salary", asked_in_interview=False,
                     company="Google", company_evidence="I use Google Sheets to track my progress",
                     role=None, role_evidence=None, interview_stage=None, stage_evidence=None)
        rec, _ = extract.check(p, src)
        self.assertIsNotNone(rec)
        self.assertIsNone(rec["company"], "a product mention must not become a company attribution")

    def test_unstated_year_and_stage_dropped(self):
        rec, _ = extract.check(proposal(interview_year=2025, interview_stage="Onsite",
                                        stage_evidence="during the onsite"), self.src)
        self.assertIsNone(rec["interview_year"])
        self.assertIsNone(rec["interview_stage"])

    def test_copying_the_post_is_flagged(self):
        copied = "Just finished my Amazon data engineer interview loop. In the technical screen I was asked how"
        rec, _ = extract.check(proposal(practice_question=copied), self.src)
        self.assertIn("too_close_to_source", rec["flags"])

    def test_personal_data_in_question_is_rejected(self):
        rec, why = extract.check(proposal(practice_question="Email jane@x.io and write a query for consecutive days"),
                                 self.src)
        self.assertIsNone(rec)


class TestDedupe(unittest.TestCase):
    def test_second_highest_salary_groups(self):
        a = "Find the second highest salary."
        b = "Write SQL to return the employee with the second-highest salary."
        self.assertGreaterEqual(normalize.similarity(a, b), config.SIM_SAME)

    def test_different_problems_do_not_auto_merge(self):
        self.assertLess(normalize.similarity("Find the second highest salary", "Find the third highest salary"),
                        config.SIM_SAME)
        self.assertLess(normalize.similarity("Design a URL shortener", "Find the second highest salary"),
                        config.SIM_MAYBE)

    def test_borderline_goes_to_model_or_reviewer(self):
        led = store.empty_ledger()
        rec = {"question": "Find the second highest salary", "concept_key": "", "category": "SQL", "title": "t",
               "subcategory": None, "difficulty": None, "technology": []}
        qid = dedupe.attach_new(rec, led, "2026-10-01")
        led["questions"][qid]["status"] = "approved"
        other = dict(rec, question="Find the third highest salary")
        got, possible = dedupe.assign(other, led, dedupe.Adjudicator(None))
        self.assertIsNone(got)
        self.assertEqual(possible[0]["id"], qid)
        got, _ = dedupe.assign(other, led, dedupe.Adjudicator(FakeModel(same=True)))
        self.assertEqual(got, qid)


class TestConfidence(unittest.TestCase):
    def rec(self, **kw):
        base = {"asked_in_interview": True, "company": "amazon", "role": "data-engineer",
                "interview_stage": "Onsite", "interview_year": 2026, "flags": []}
        base.update(kw)
        return base

    def test_bands_match_the_brief(self):
        cls_a = {"class": "A"}
        full, _ = confidence.score(cls_a, self.rec(), "2026-10-01")
        self.assertGreaterEqual(full, 90)
        partial, _ = confidence.score(cls_a, self.rec(company=None, role=None, interview_stage=None,
                                                      interview_year=None), "2026-10-01")
        self.assertTrue(70 <= partial < 90, partial)
        listed, _ = confidence.score({"class": "B"}, self.rec(asked_in_interview=False, company=None, role=None,
                                                              interview_stage=None, interview_year=None), "2026-10-01")
        self.assertTrue(50 <= listed < 70, listed)
        seo, _ = confidence.score({"class": "B", "seo_list": True}, self.rec(asked_in_interview=False, company=None,
                                  role=None, interview_stage=None, interview_year=None), None)
        self.assertLess(seo, 50)

    def test_below_fifty_never_auto_published(self):
        led = store.empty_ledger()
        led["questions"]["q-1"] = {"id": "q-1", "status": "pending"}
        led["reports"]["r-1"] = {"id": "r-1", "question_id": "q-1", "status": "pending", "confidence": 45,
                                 "flags": [], "possible_duplicates": []}
        self.assertEqual(review.auto_publish(led, threshold=10), 0)
        self.assertEqual(review.auto_publish(led, threshold=None), 0)


class TestAutoApproval(unittest.TestCase):
    """Owner's decision (2026-10-07): strong (70–89) and clear (90–100) publish
    automatically; flagged reports, possible duplicates and anything below 50
    still wait for a person."""

    def ledger(self):
        led = store.empty_ledger()
        cases = {"clear": (95, [], []), "strong": (72, [], []), "review": (60, [], []), "low": (40, [], []),
                 "flagged": (88, ["too_close_to_source"], []), "dup": (91, [], [{"id": "q-x"}])}
        for name, (conf, flags, dups) in cases.items():
            led["questions"]["q-" + name] = {"id": "q-" + name, "status": "pending"}
            led["reports"]["r-" + name] = {"id": "r-" + name, "question_id": "q-" + name, "status": "pending",
                                           "confidence": conf, "flags": flags, "possible_duplicates": dups}
        return led

    def test_strong_and_clear_are_approved_by_default(self):
        self.assertEqual(config.AUTO_PUBLISH_MIN_CONFIDENCE, config.BAND_STRONG)
        led = self.ledger()
        self.assertEqual(review.auto_publish(led, when="2026-10-07"), 2)
        status = {k: r["status"] for k, r in led["reports"].items()}
        self.assertEqual(status, {"r-clear": "approved", "r-strong": "approved", "r-review": "pending",
                                  "r-low": "pending", "r-flagged": "pending", "r-dup": "pending"})
        self.assertEqual(led["questions"]["q-clear"]["status"], "approved")
        self.assertTrue(led["reports"]["r-clear"]["decided_by"].startswith("auto"))

    def test_auto_approved_reports_are_listed_and_can_be_unpublished(self):
        led = self.ledger()
        for q in led["questions"].values():
            q.update(title="t", question="q", category="SQL", subcategory=None, difficulty=None, technology=[])
        for r in led["reports"].values():
            r.update(url="https://news.ycombinator.com/item?id=1", discovered="2026-10-07", band="strong",
                     company_name=None, role_name=None, source_type="forum", source_title="t")
        review.auto_publish(led, when="2026-10-07")
        q = publish.queue(led)
        self.assertEqual({a["id"] for a in q["auto_approved"]}, {"r-clear", "r-strong"})
        review.apply(led, {"decisions": [{"report": "r-clear", "action": "reject", "note": "not relevant"}]})
        self.assertEqual(led["reports"]["r-clear"]["status"], "rejected")
        self.assertEqual(led["questions"]["q-clear"]["status"], "rejected")
        # A rejection is final: a later run does not re-approve it.
        review.auto_publish(led, when="2026-10-08")
        self.assertEqual(led["reports"]["r-clear"]["status"], "rejected")


class TestClassifierRules(unittest.TestCase):
    def test_recruiting_ad_rejected_before_any_model_call(self):
        self.assertEqual(classify_rules.prefilter("Hiring", AD), "recruiting advertisement")

    def test_promotional_needs_specific_questions(self):
        self.assertIsNotNone(classify_rules.should_extract({"class": "D", "states_specific_questions": False}))
        self.assertIsNone(classify_rules.should_extract({"class": "D", "states_specific_questions": True}))
        for c in ("C", "F"):
            self.assertIsNotNone(classify_rules.should_extract({"class": c}))
        self.assertIsNotNone(classify_rules.should_extract({"class": "A", "recruiting_ad": True}))


class Sandbox(unittest.TestCase):
    """Runs the pipeline against temporary data and public directories."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        t = pathlib.Path(self.tmp.name)
        self.patches = [mock.patch.object(config, "PUBLIC_DIR", t / "public"),
                        mock.patch.object(config, "ADMIN_QUEUE", t / "admin" / "queue.json"),
                        mock.patch.object(config, "DECISIONS_DIR", t / "decisions")]
        for p in self.patches:
            p.start()
        (t / "decisions").mkdir()
        self.dir = t

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def discover(self, rows, model, ledger=None, seen=None, today=TODAY):
        ledger = ledger or store.empty_ledger()
        seen = seen or {"urls": {}, "fingerprints": {}}
        out = discover.run([FixtureSource(rows)], model, ledger, seen, [], today)
        return ledger, seen, out

    def public(self, name):
        return json.loads((config.PUBLIC_DIR / name).read_text(encoding="utf-8"))


class TestEndToEnd(Sandbox):
    def rows(self):
        return [{"url": li("a"), "title": "Jane Doe on LinkedIn: Amazon loop", "text": POST_A, "published": "2026-10-01"},
                {"url": "https://jobs.example.net/x", "title": "Hiring", "text": AD},
                {"url": li("a-repost"), "title": "Repost", "text": POST_A, "published": "2026-10-02"}]

    def test_discovery_queues_and_never_publishes_unreviewed(self):
        url = sources.canonical_url(li("a"))
        model = FakeModel({url: [proposal()]})
        led, seen, out = self.discover(self.rows(), model)
        self.assertEqual(out["stats"]["reports_queued"], 1)
        self.assertEqual(out["stats"].get("prefilter_rejected"), 1)
        self.assertEqual(out["stats"].get("class_E"), 1, "an identical repost is a duplicate")
        self.assertEqual(model.calls["classify"], 1)
        publish.build(led, TODAY)
        self.assertEqual(self.public("questions.json")["questions"], [])
        q = json.loads(config.ADMIN_QUEUE.read_text())["pending"]
        self.assertEqual(len(q), 1)
        self.assertNotIn("jane.doe", json.dumps(q))
        self.assertNotIn("Jane Doe", json.dumps(q))

        # A second run does not pay to classify the same URL again.
        led, seen, out = self.discover(self.rows(), model, led, seen)
        self.assertEqual(model.calls["classify"], 1)
        self.assertEqual(out["stats"]["already_seen"], 3)

    def test_a_source_whose_every_request_failed_is_not_ok(self):
        class Down:
            name = "down"

            def collect(self, today, errors):
                errors.append("down: URLError")
                return []
        led, seen = store.empty_ledger(), {"urls": {}, "fingerprints": {}}
        out = discover.run([Down()], None, led, seen, [], TODAY)
        self.assertEqual(out["stats"].get("sources_ok", 0), 0)
        self.assertEqual(out["stats"]["sources_failed"], 1)

    def test_community_submissions_skip_the_classifier(self):
        (r,) = feeds.Community.parse("Timestamp,Question,Topic,Difficulty,Company\n"
                                     "8/26/2026 1:38:36,Find customers who bought on three consecutive days,SQL,Medium,Amazon\n")
        url = sources.canonical_url(r.url)
        p = proposal(evidence="Find customers who bought on three consecutive days",
                     company="Amazon", company_evidence="Interviewed at: Amazon",
                     role=None, role_evidence=None, interview_stage=None, stage_evidence=None)
        model = FakeModel({url: [p]})
        led, seen = store.empty_ledger(), {"urls": {}, "fingerprints": {}}
        src = types.SimpleNamespace(name="community", collect=lambda today, errors: [r])
        out = discover.run([src], model, led, seen, [], TODAY)
        self.assertEqual(model.calls["classify"], 0, "the form is already interview questions")
        self.assertEqual(out["stats"]["reports_queued"], 1)
        (rep,) = led["reports"].values()
        self.assertEqual((rep["company"], rep["source_type"]), ("amazon", "community"))
        self.assertEqual(rep["source_title"], "Submitted to PaddySpeaks by a candidate")

    def test_without_a_model_nothing_is_guessed(self):
        led, seen, out = self.discover(self.rows()[:1], None)
        self.assertEqual(led["reports"], {})
        self.assertEqual(seen["urls"], {}, "deferred URLs are retried when a model is available")

    def approve_all(self, led, **extra):
        rid = next(iter(led["reports"]))
        (config.DECISIONS_DIR / "001.json").write_text(json.dumps(
            {"decided_by": "Paddy", "decided_at": "2026-10-07T09:00:00Z",
             "decisions": [{"report": rid, "action": "approve", **extra}]}))
        done, errors = review.apply_pending_files(led)
        self.assertEqual(errors, [])
        return rid

    def test_approval_publishes_with_provenance_and_no_personal_data(self):
        url = sources.canonical_url(li("a"))
        led, _, _ = self.discover(self.rows()[:1], FakeModel({url: [proposal()]}))
        self.approve_all(led)
        enrich.run(FakeModel(), led, TODAY.isoformat())
        publish.build(led, TODAY)
        doc = self.public("questions.json")
        (q,) = doc["questions"]
        self.assertEqual(q["question_type"], "reported")
        self.assertEqual(q["companies_reported"], [{"slug": "amazon", "name": "Amazon"}])
        self.assertEqual(q["sources"][0]["url"], url)
        self.assertEqual(q["sources"][0]["title"], "Public LinkedIn post")
        self.assertEqual(q["prep"]["generated_by"], "PaddySpeaks AI")
        blob = json.dumps(doc)
        for banned in ("evidence", "jane", "555", "Jane Doe"):
            self.assertNotIn(banned, blob)
        # Idempotent: applying again changes nothing.
        done, _ = review.apply_pending_files(led)
        self.assertEqual(done, [])

    def test_editing_a_question_invalidates_its_ai_material(self):
        url = sources.canonical_url(li("a"))
        led, _, _ = self.discover(self.rows()[:1], FakeModel({url: [proposal()]}))
        self.approve_all(led)
        enrich.run(FakeModel(), led, TODAY.isoformat())
        rid = next(iter(led["reports"]))
        review.apply(led, {"decisions": [{"report": rid, "action": "approve",
                                          "edits": {"question": "A different, edited question about streaks."}}]})
        publish.build(led, TODAY)
        self.assertIsNone(self.public("questions.json")["questions"][0]["prep"])

    def test_reject_and_merge(self):
        u1, u2 = sources.canonical_url(li("a")), sources.canonical_url(li("b"))
        rows = [{"url": li("a"), "title": "", "text": POST_A},
                {"url": li("b"), "title": "", "text": POST_A + " Also: rate limiter design."}]
        p2 = proposal(practice_question="Design a rate limiter for a public API that allows 100 requests per "
                                        "minute per customer.", concept_key="rate limiter design",
                      category="System Design", evidence="Also: rate limiter design", company=None,
                      role=None, interview_stage=None, title="System Design — Rate Limiter")
        led, _, _ = self.discover(rows, FakeModel({u1: [proposal()], u2: [p2]}))
        r1 = next(r for r in led["reports"].values() if r["url"] == u1)
        r2 = next(r for r in led["reports"].values() if r["url"] == u2)
        review.apply(led, {"decisions": [{"report": r1["id"], "action": "approve"},
                                         {"report": r2["id"], "action": "merge", "into": r1["question_id"]}]})
        self.assertEqual(led["reports"][r2["id"]]["question_id"], r1["question_id"])
        self.assertEqual(led["questions"][r2["question_id"]]["status"], "approved")
        old_q = next(q for q in led["questions"].values() if q["concept_key"] == "rate limiter design")
        self.assertEqual(old_q["status"], "merged")
        publish.build(led, TODAY)
        (q,) = self.public("questions.json")["questions"]
        self.assertEqual(q["source_count"], 2)
        review.apply(led, {"decisions": [{"question": q["id"], "action": "reject"}]})
        self.assertEqual(led["questions"][q["id"]]["status"], "approved", "only pending reports are rejected")


class TestPublishRules(unittest.TestCase):
    def ledger(self, n, company="amazon", dates=None):
        led = store.empty_ledger()
        for i in range(n):
            cat = config.CATEGORIES[i % 3 + 3]
            qid = f"q-{i}"
            led["questions"][qid] = {"id": qid, "title": f"T{i}", "question": f"Question {i}", "concept_key": "",
                                     "category": cat, "subcategory": None, "difficulty": "Medium",
                                     "technology": [], "status": "approved", "prep": None, "prep_for": None}
            d = (dates or ["2026-10-01"])[i % len(dates or ["x"])]
            led["reports"][f"r-{i}"] = {
                "id": f"r-{i}", "question_id": qid, "status": "approved", "url": f"https://blog.example.net/{i}",
                "source_type": "blog", "source_title": "t", "source_date": d, "discovered": "2026-10-06",
                "last_seen": "2026-10-06", "company": company, "company_name": "Amazon", "role": "data-engineer",
                "role_name": "Data Engineer", "interview_stage": "Onsite", "interview_year": None,
                "asked_in_interview": True, "bank_matches": []}
        return led

    def test_percentages_only_with_enough_reports(self):
        few = publish.intel(publish.approved(self.ledger(5)), TODAY)["companies"]["amazon"]["summary"]["topics"]
        self.assertFalse(few["percent_shown"])
        self.assertTrue(all("percent" not in r for r in few["rows"]))
        many = publish.intel(publish.approved(self.ledger(config.MIN_REPORTS_FOR_PERCENT)), TODAY)
        self.assertTrue(many["companies"]["amazon"]["summary"]["topics"]["percent_shown"])

    def test_featured_companies_always_present_and_labelled(self):
        doc = publish.intel([], TODAY)
        for slug in config.FEATURED_COMPANIES:
            self.assertIn(slug, doc["companies"])
        self.assertIn("not official company interview information", doc["label"])
        self.assertEqual(publish.trends([], TODAY)["label"],
                         "Questions appearing in recently discovered public interview reports.")

    def test_freshness(self):
        self.assertEqual(publish.freshness(["2026-09-30"], TODAY), "RECENT")
        self.assertEqual(publish.freshness(["2024-01-01"], TODAY), "HISTORICAL")
        self.assertEqual(publish.freshness(["2026-01-05", "2026-05-01", "2026-09-30"], TODAY), "RECURRING")

    def test_trend_direction(self):
        led = self.ledger(6, dates=["2026-10-01", "2026-09-01"])
        t = publish.trends(publish.approved(led), TODAY)["windows"]["30"]
        self.assertTrue(all(r["reports"] >= config.TREND_MIN_COUNT for r in t))


class TestEnrichment(unittest.TestCase):
    def test_material_claiming_to_be_the_candidates_is_rejected(self):
        raw = FakeModel().enrich({})
        raw["approach"] = "The candidate said they used a self-join."
        prep, why = enrich.validate(raw)
        self.assertIsNone(prep)
        self.assertIn("claims", why)


class TestFrontEnd(unittest.TestCase):
    JS = [ROOT / "interview.app" / "reported" / "js" / "reported.js",
          ROOT / "admin" / "interview-discovery" / "review.js"]

    def test_never_injects_source_or_ai_text_as_html(self):
        for path in self.JS:
            text = path.read_text(encoding="utf-8")
            text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
            for n, line in enumerate(text.split("\n"), 1):
                if re.search(r"innerHTML|outerHTML|insertAdjacentHTML|document\.write", line.split("//")[0]):
                    self.fail(f"{path}:{n}: {line.strip()}")

    def test_pages_label_the_three_kinds_of_question(self):
        js = self.JS[0].read_text(encoding="utf-8")
        for label in ("Reported in an interview", "PaddySpeaks practice question", "AI-generated similar question",
                      "PaddySpeaks AI-generated preparation material", "Source-derived"):
            self.assertIn(label, js)

    def test_trending_and_intel_pages_carry_their_labels(self):
        base = ROOT / "interview.app" / "reported"
        self.assertIn("Questions appearing in recently discovered public interview reports.",
                      (base / "trending" / "index.html").read_text(encoding="utf-8"))
        self.assertIn("Based on publicly discovered interview reports. This is not official company interview information",
                      (base / "company" / "index.html").read_text(encoding="utf-8"))

    def test_admin_is_not_indexed(self):
        page = (ROOT / "admin" / "interview-discovery" / "index.html").read_text(encoding="utf-8")
        self.assertIn('content="noindex', page)
        self.assertIn("Disallow: /admin/", (ROOT / "robots.txt").read_text())

    def test_no_seeded_questions_are_committed(self):
        """An empty board is honest. An invented one is the thing we are against."""
        doc = json.loads((ROOT / "interview.app" / "reported" / "data" / "questions.json").read_text())
        for q in doc["questions"]:
            self.assertTrue(q["sources"], q["id"])
            for s in q["sources"]:
                self.assertTrue(s["url"].startswith("https://"), q["id"])
                self.assertNotRegex(s["url"], r"example\.(com|org|net)")
        led = store.load_ledger()
        for r in led["reports"].values():
            self.assertNotRegex(r["url"], r"example\.(com|org|net)", "fixture data reached the ledger")


if __name__ == "__main__":
    unittest.main(verbosity=2, argv=[sys.argv[0]] + sys.argv[1:])
