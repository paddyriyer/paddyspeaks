#!/usr/bin/env python3
"""JobSignal pipeline tests — stdlib unittest, no network, no fixtures on disk.

    python3 -m jobsignal.tests.test_pipeline

The invariants in docs/JOBSIGNAL.md are asserted here. If one of these fails,
the product is lying to a candidate about a date, a duplicate or a status, and
the change should not ship.
"""
from __future__ import annotations

import datetime as _dt
import json
import pathlib
import re
import sys
import tempfile
import unittest

from jobsignal.pipeline import adapters, confidence, identity, normalize, store
from jobsignal.pipeline.build import build_record, compute_stats

ROOT = pathlib.Path(__file__).resolve().parents[2]
NOW = _dt.datetime(2026, 9, 21, 12, 0, tzinfo=_dt.UTC)
ISO = NOW.isoformat().replace("+00:00", "Z")

SRC = {
    "company_slug": "acme", "company_name": "Acme", "company_domain": "acme.com",
    "ats_provider": "greenhouse", "ats_slug": "acme", "industry": "Fintech",
    "company_size": "1k-5k", "is_staffing_firm": False, "enabled": True, "tier": 1,
}


def raw(**kw):
    base = {
        "title": "Senior Data Engineer", "location": "San Francisco, CA",
        "department": "Data", "employment_type": "Full-time",
        "apply_url": "https://boards.greenhouse.io/acme/jobs/4242",
        "requisition_id": "R-4242", "posted_at": "2026-09-19",
        "description_text": "About the role\nBuild pipelines.\n\nRequirements\n• 5 years of Python\n• Strong SQL",
        "requirements": [], "preferred": [],
        "salary_min": None, "salary_max": None, "currency": "",
    }
    base.update(kw)
    return base


class TestNormalize(unittest.TestCase):
    def test_title_normalisation_strips_decoration(self):
        self.assertEqual(normalize.normalize_title("Senior Product Manager (Remote)"),
                         "senior product manager")
        self.assertEqual(normalize.normalize_title("Data Engineer - Remote, US"), "data engineer")
        self.assertEqual(normalize.normalize_title("Engineer II"), "engineer 2")

    def test_remote_status(self):
        self.assertEqual(normalize.remote_status("Remote - US"), "remote")
        self.assertEqual(normalize.remote_status("New York (Hybrid)"), "hybrid")
        self.assertEqual(normalize.remote_status("Austin, TX"), "onsite")
        self.assertEqual(normalize.remote_status(""), "unknown")
        self.assertEqual(normalize.remote_status("", "This role is fully remote."), "remote")

    def test_location_parsing(self):
        p = normalize.parse_location("San Francisco, California")
        self.assertEqual((p["city"], p["region"], p["country"]), ("San Francisco", "CA", "US"))
        p = normalize.parse_location("Remote - London, United Kingdom")
        self.assertEqual((p["city"], p["country"]), ("London", "GB"))

    def test_city_sharing_a_name_with_its_state_is_read_as_the_city(self):
        p = normalize.parse_location("New York, NY")
        self.assertEqual((p["city"], p["region"], p["country"]), ("New York", "NY", "US"))
        p = normalize.parse_location("Washington, DC")
        self.assertEqual(p["city"], "Washington")
        # A lone place name stays the city, even when it is also a state name:
        # dropping it would leave the role unsearchable by the employer's word.
        p = normalize.parse_location("New York")
        self.assertEqual(p["city"], "New York")

    def test_a_multi_location_role_does_not_invent_a_place(self):
        """"San Francisco, CA | New York City, NY" is two cities, not one.

        Reading the string as a single location paired the first city with the
        last region and produced "San Francisco, NY" — a place that does not
        exist — on 9% of the board.
        """
        raw = "San Francisco, CA | New York City, NY"
        first = normalize.parse_location(raw)
        self.assertEqual((first["city"], first["region"]), ("San Francisco", "CA"))
        self.assertEqual(normalize.location_count(raw), 2)
        self.assertEqual(
            [(l["city"], l["region"]) for l in normalize.parse_locations(raw)],
            # "New York City" canonicalises to "New York" — see
            # test_one_city_has_one_spelling.
            [("San Francisco", "CA"), ("New York", "NY")],
        )

    def test_a_remote_option_is_not_a_second_location(self):
        """"or Remote (U.S.)" is a working arrangement, not another office."""
        raw = "San Francisco Bay Area or Remote (U.S.)"
        self.assertEqual(normalize.location_count(raw), 1)
        self.assertEqual(normalize.parse_location(raw)["city"], "San Francisco")
        self.assertEqual(normalize.remote_status(raw), "remote")
        # ...and the same for a trailing "| Remote".
        self.assertEqual(normalize.location_count("Austin, TX | Remote"), 1)
        # A wholly remote role keeps the country scope it stated.
        self.assertEqual(normalize.parse_location("Remote (U.S.)")["country"], "US")

    def test_a_place_named_after_the_remote_word_is_kept(self):
        """"Remote - New York, NY" still names New York."""
        p = normalize.parse_location("Remote - New York, NY")
        self.assertEqual((p["city"], p["region"]), ("New York", "NY"))
        self.assertEqual(normalize.location_count("Remote - New York, NY"), 1)

    def test_one_city_has_one_spelling(self):
        """Employers write Bengaluru and Bangalore for the same office.

        Carried through as two cities, a search for either found two-thirds of
        the roles and silently missed the rest.
        """
        for written in ("Bangalore, India", "Bengaluru, India"):
            self.assertEqual(normalize.parse_location(written)["city"], "Bengaluru")
        for written in ("New York City, NY", "New York, NY"):
            self.assertEqual(normalize.parse_location(written)["city"], "New York")
        self.assertEqual(
            normalize.parse_location("San Francisco Bay Area")["city"], "San Francisco")

    def test_unknown_place_stays_searchable_rather_than_misfiled(self):
        p = normalize.parse_location("Bengaluru")
        self.assertEqual(p["city"], "Bengaluru")
        self.assertEqual(p["region"], "")

    def test_experience_level_from_title(self):
        self.assertEqual(normalize.experience_level("Staff Engineer"), "senior")
        self.assertEqual(normalize.experience_level("Engineering Manager"), "manager")
        self.assertEqual(normalize.experience_level("VP of Data"), "director_plus")
        self.assertEqual(normalize.experience_level("Data Science Intern"), "internship")
        self.assertEqual(normalize.experience_level("Junior Analyst"), "entry")

    def test_product_manager_is_not_a_people_manager(self):
        # The single most common seniority misclassification on job boards.
        self.assertEqual(normalize.experience_level("Product Manager"), "unknown")
        self.assertEqual(normalize.experience_level("Senior Product Manager"), "senior")

    def test_salary_only_from_explicit_employer_text(self):
        lo, hi, cur = normalize.parse_salary("The base salary range for this role is $165,000 - $230,000.")
        self.assertEqual((lo, hi, cur), (165000, 230000, "USD"))
        # A range of numbers with no pay context must not become a salary.
        self.assertEqual(normalize.parse_salary("We process 150,000 - 230,000 events per second.")[0], None)
        # Nor may a bare title imply one.
        self.assertEqual(normalize.parse_salary("Senior Data Engineer, San Francisco")[0], None)

    def test_visa_and_clearance_are_reported_as_mentions_only(self):
        self.assertEqual(normalize.mentions(normalize._VISA, "We will sponsor H-1B visas."), "mentioned")
        self.assertEqual(normalize.mentions(normalize._VISA, "Great team, great coffee."), "not_mentioned")

    def test_requirements_split_by_the_employers_own_headings(self):
        desc = ("About us\nWe do things.\n\nRequirements\n• 5 years Python\n• SQL\n\n"
                "Nice to have\n• dbt\n")
        req, pref = normalize.split_requirements(desc)
        self.assertEqual(req, ["5 years Python", "SQL"])
        self.assertEqual(pref, ["dbt"])

    def test_description_without_headings_yields_no_invented_checklist(self):
        req, pref = normalize.split_requirements("We are looking for someone great. Apply today.")
        self.assertEqual((req, pref), ([], []))

    def test_escaped_html_is_not_turned_into_visible_markup(self):
        """Greenhouse returns HTML that is itself HTML-escaped.

        Regression: tags were stripped before entities were resolved, so the
        stripper found nothing and the final unescape then produced literal
        <div> markup in the job description shown to candidates.
        """
        esc = ('&lt;div class="intro"&gt;&lt;p&gt;Ready to work? At&amp;nbsp;'
               '&lt;a href="https://x.test"&gt;Acme&lt;/a&gt;, we build.&lt;/p&gt;&lt;/div&gt;')
        out = adapters.strip_html(esc)
        self.assertNotIn("<", out)
        self.assertNotIn("&nbsp;", out)
        self.assertNotIn("\u00a0", out)
        self.assertIn("Ready to work?", out)
        self.assertIn("Acme", out)

    def test_prose_quoting_an_angle_bracket_is_not_eaten(self):
        # The unescape-first path must not fire on text that merely mentions
        # "<" and then delete the rest of the sentence as if it were a tag.
        self.assertEqual(adapters.strip_html("Use x &lt; y in your query"),
                         "Use x < y in your query")

    def test_html_is_reduced_to_text_at_ingest(self):
        out = adapters.strip_html("<p>Hello <b>world</b></p><script>alert(1)</script><li>Item</li>")
        self.assertNotIn("<", out)
        self.assertNotIn("alert(1)", out)
        self.assertIn("Item", out)


class TestApplyUrlPolicy(unittest.TestCase):
    def test_employer_and_ats_hosts_allowed(self):
        self.assertTrue(normalize.apply_url_ok("https://acme.com/careers/42", "acme.com"))
        self.assertTrue(normalize.apply_url_ok("https://jobs.acme.com/42", "acme.com"))
        self.assertTrue(normalize.apply_url_ok("https://boards.greenhouse.io/acme/jobs/1", "acme.com"))

    def test_aggregators_rejected(self):
        for bad in ("https://www.linkedin.com/jobs/view/1",
                    "https://www.indeed.com/viewjob?jk=1",
                    "https://www.ziprecruiter.com/c/x/Job/y"):
            self.assertFalse(normalize.apply_url_ok(bad, "acme.com"), bad)

    def test_lookalike_domain_rejected(self):
        self.assertFalse(normalize.apply_url_ok("https://acme.com.evil.test/42", "acme.com"))

    def test_non_https_scheme_rejected(self):
        # A host check alone would let a script URL through to an href.
        for bad in ("javascript://boards.greenhouse.io/%0Aalert(1)",
                    "http://acme.com/careers/42",
                    "data:text/html,<a>",
                    "//acme.com/careers/42"):
            self.assertFalse(normalize.apply_url_ok(bad, "acme.com"), bad)

    def test_record_with_aggregator_apply_url_is_dropped_not_flagged(self):
        rec = build_record(SRC, raw(apply_url="https://www.indeed.com/viewjob?jk=9"), ISO)
        self.assertIsNone(rec)


class TestIdentity(unittest.TestCase):
    def test_requisition_id_wins_over_wording(self):
        a = identity.canonical_key("acme.com", "R-1", "Data Engineer", "NYC")
        b = identity.canonical_key("acme.com", "R-1", "Data Engineer (Remote)", "New York")
        self.assertEqual(a, b)

    def test_different_requisitions_stay_separate(self):
        a = identity.canonical_key("acme.com", "R-1", "Data Engineer", "NYC")
        b = identity.canonical_key("acme.com", "R-2", "Data Engineer", "NYC")
        self.assertNotEqual(a, b)

    def test_lineage_ignores_requisition_so_a_repost_is_recognised(self):
        a = identity.lineage_key("acme.com", "Data Engineer", "New York, New York", "Data")
        b = identity.lineage_key("acme.com", "Data Engineer", "New York, NY, United States", "Data")
        self.assertEqual(a, b)
        # ...and a differently decorated title is still the same role.
        c = identity.lineage_key("acme.com", "Data Engineer (Remote)", "New York, NY", "Data")
        d = identity.lineage_key("acme.com", "Data Engineer", "New York, NY", "Data")
        self.assertEqual(c, d)

    def test_dedupe_keeps_one_result_and_prefers_the_employer(self):
        common = dict(canonical_key="k", description="x" * 50)
        recs = [
            dict(common, source_type="discovery", apply_hops=2, source_url="https://li.test/1"),
            dict(common, source_type="ats_api", apply_hops=0, source_url="https://acme.com/1"),
        ]
        kept, absorbed = identity.dedupe(recs)
        self.assertEqual(len(kept), 1)
        self.assertEqual(kept[0]["source_type"], "ats_api")
        self.assertEqual(absorbed[0]["source_type"], "discovery")
        self.assertEqual(kept[0]["also_seen_at"], ["https://li.test/1"])

    def test_similarity_match_requires_both_title_and_description(self):
        body = " ".join(f"word{i}" for i in range(60))
        rec = {"company_domain": "acme.com", "job_title": "Data Engineer",
               "_tokens": normalize.description_tokens(body)}
        same = [{"company_domain": "acme.com", "job_title": "Data Engineer",
                 "lineage_key": "L1", "_tokens": normalize.description_tokens(body)}]
        self.assertEqual(identity.match_closed_lineage(rec, same), "L1")
        # Same text, different role: shared boilerplate must not merge two roles.
        other = [{"company_domain": "acme.com", "job_title": "Product Designer",
                  "lineage_key": "L2", "_tokens": normalize.description_tokens(body)}]
        self.assertIsNone(identity.match_closed_lineage(rec, other))


class TestAgeLedger(unittest.TestCase):
    """The invariant the product is named for."""

    def test_first_seen_is_never_rewritten(self):
        hist = store.empty_history()
        rec = build_record(SRC, raw(), ISO)
        store.carry_forward(rec, hist, "2026-08-07T00:00:00Z")
        store.remember(hist, rec)
        self.assertEqual(rec["first_seen_at"], "2026-08-07T00:00:00Z")

        again = build_record(SRC, raw(), ISO)
        store.carry_forward(again, hist, ISO)
        self.assertEqual(again["first_seen_at"], "2026-08-07T00:00:00Z")
        self.assertEqual(again["last_seen_at"], ISO)

    def test_employer_blanking_its_own_date_cannot_make_a_role_look_newer(self):
        hist = store.empty_history()
        rec = build_record(SRC, raw(posted_at="2026-05-04"), ISO)
        store.carry_forward(rec, hist, "2026-05-04T00:00:00Z")
        store.remember(hist, rec)
        later = build_record(SRC, raw(posted_at=""), ISO)
        store.carry_forward(later, hist, ISO)
        self.assertEqual(later["posted_at_original"], "2026-05-04")

    def test_repost_adds_a_spell_and_never_resets_age(self):
        hist = store.empty_history()
        first = build_record(SRC, raw(requisition_id="R-1"), ISO)
        store.carry_forward(first, hist, "2026-05-04T00:00:00Z")
        store.attach_lineage(first, hist, "2026-05-04T00:00:00Z")
        self.assertEqual(first["repost_count"], 0)

        store.close_spell(hist, first, "2026-06-13T00:00:00Z")

        # Same role, brand-new requisition number — a textbook repost.
        second = build_record(SRC, raw(requisition_id="R-9"), ISO)
        self.assertEqual(second["lineage_key"], first["lineage_key"])
        self.assertNotEqual(second["id"], first["id"])
        store.carry_forward(second, hist, ISO)
        store.attach_lineage(second, hist, ISO)

        self.assertEqual(second["repost_count"], 1)
        self.assertEqual(second["lineage_first_seen"], "2026-05-04T00:00:00Z")
        self.assertEqual(len(second["lineage_spells"]), 2)

    def test_one_missed_run_does_not_close_a_job(self):
        hist = store.empty_history()
        rec = build_record(SRC, raw(), ISO)
        store.carry_forward(rec, hist, ISO)
        store.remember(hist, rec)
        self.assertLess(store.record_miss(hist, rec["id"]), store.MISS_LIMIT)
        self.assertGreaterEqual(store.record_miss(hist, rec["id"]), store.MISS_LIMIT)

    def test_archive_is_keyed_by_id_so_it_never_accumulates_duplicates(self):
        with tempfile.TemporaryDirectory() as tmp:
            orig_dir, orig_hist = store.ARCHIVE_DIR, store.HISTORY
            store.ARCHIVE_DIR = pathlib.Path(tmp) / "archive"
            store.HISTORY = pathlib.Path(tmp) / "history.json"
            try:
                store.archive_jobs([{"id": "j1", "closed_at": "2026-01-02T00:00:00Z"}])
                store.archive_jobs([{"id": "j1", "closed_at": "2026-03-04T00:00:00Z"}])
                rows = store.load_archive("2026")
                self.assertEqual(len(rows), 1)
                self.assertEqual(rows[0]["closed_at"], "2026-03-04T00:00:00Z")
            finally:
                store.ARCHIVE_DIR, store.HISTORY = orig_dir, orig_hist


class TestConfidence(unittest.TestCase):
    def _job(self, **kw):
        base = {
            "source_type": "ats_api", "ats_provider": "greenhouse",
            "last_verified_at": ISO, "requisition_id": "R-1", "apply_hops": 0,
            "apply_url_host": "acme.com", "posted_at_original": "2026-09-19",
            "first_seen_at": "2026-09-19T00:00:00Z", "repost_count": 0,
            "apply_probe": "http_ok", "salary_min": 100, "salary_max": 200,
        }
        base.update(kw)
        return base

    def test_status_bands(self):
        self.assertEqual(confidence.status_for(self._job(), NOW), "live")
        old = (NOW - _dt.timedelta(hours=30)).isoformat().replace("+00:00", "Z")
        self.assertEqual(confidence.status_for(self._job(last_verified_at=old), NOW), "recent")
        self.assertEqual(confidence.status_for(self._job(last_verified_at=""), NOW), "unverified")
        self.assertEqual(confidence.status_for(self._job(closed_at=ISO), NOW), "closed")

    def test_freshness_uses_the_employers_date_not_the_crawl(self):
        j = self._job(posted_at_original="2026-05-04", first_seen_at="2026-09-21T00:00:00Z")
        self.assertEqual(confidence.freshness_label(j, NOW), "LONG RUNNING")
        self.assertGreater(confidence.age_days(j, NOW), 100)

    def test_freshness_bands(self):
        for posted, label in (("2026-09-21", "JUST POSTED"), ("2026-09-19", "FRESH"),
                              ("2026-09-16", "RECENT"), ("2026-09-01", "ESTABLISHED"),
                              ("2026-08-10", "AGING"), ("2026-01-01", "LONG RUNNING")):
            self.assertEqual(confidence.freshness_label(self._job(posted_at_original=posted), NOW),
                             label, posted)

    def test_a_reposted_role_is_never_labelled_just_posted(self):
        """Brief §4, the rule the product exists for.

        The new requisition genuinely is hours old, so every correct age
        calculation on it says JUST POSTED. The label must report the repost
        instead, and carry the age of the ROLE alongside it.
        """
        j = self._job(posted_at_original="2026-09-21", first_seen_at="2026-09-21T00:00:00Z",
                      repost_count=1, lineage_first_seen="2026-05-04T00:00:00Z")
        self.assertEqual(confidence.freshness_label(j, NOW), "REPOSTED")
        self.assertEqual(confidence.age_days(j, NOW), 0)
        self.assertGreater(confidence.lineage_age_days(j, NOW), 130)

    def test_one_previous_run_caps_confidence_at_medium(self):
        self.assertEqual(confidence.annotate(self._job(repost_count=1), NOW)["confidence_level"],
                         "medium")

    def test_missing_dates_say_unknown_rather_than_guessing(self):
        j = self._job(posted_at_original="", first_seen_at="")
        self.assertEqual(confidence.freshness_label(j, NOW), "AGE UNKNOWN")
        self.assertIsNone(confidence.age_days(j, NOW))

    def test_clean_direct_job_is_high(self):
        j = confidence.annotate(self._job(), NOW)
        self.assertEqual(j["confidence_level"], "high")

    def test_repeatedly_reposted_is_always_flagged(self):
        j = confidence.annotate(self._job(repost_count=3), NOW)
        self.assertEqual(j["confidence_level"], "caution")
        self.assertTrue(any("appeared 4 times" in s["text"] for s in j["confidence_signals"]))

    def test_unverified_is_never_high(self):
        j = confidence.annotate(self._job(last_verified_at=""), NOW)
        self.assertEqual(j["confidence_level"], "caution")
        self.assertEqual(j["status"], "unverified")

    def test_signals_never_accuse_an_employer(self):
        banned = re.compile(r"(?i)\b(ghost|fake|scam|lying|lie|dishonest|bogus|never hiring|not real)\b")
        for kw in ({}, {"repost_count": 4}, {"last_verified_at": ""}, {"apply_probe": "http_error"},
                   {"posted_at_original": "", "first_seen_at": "2026-01-01T00:00:00Z"},
                   {"requisition_id": "", "apply_hops": 3}):
            for sig in confidence.signals(self._job(**kw), NOW):
                self.assertIsNone(banned.search(sig["text"]), sig["text"])

    def test_caution_signals_are_observations_with_evidence(self):
        j = self._job(posted_at_original="", first_seen_at="2026-05-18T00:00:00Z")
        warns = [s["text"] for s in confidence.signals(j, NOW) if s["kind"] == "warn"]
        self.assertIn("Employer did not publish an original posting date", warns)
        self.assertTrue(any(re.search(r"First seen \d+ days ago", w) for w in warns))


class TestBuildRecord(unittest.TestCase):
    def test_full_record_shape(self):
        rec = build_record(SRC, raw(), ISO)
        self.assertEqual(rec["company_domain"], "acme.com")
        self.assertEqual(rec["experience_level"], "senior")
        self.assertEqual(rec["remote_status"], "onsite")
        self.assertEqual(rec["apply_url_host"], "boards.greenhouse.io")
        self.assertEqual(rec["posted_at_original"], "2026-09-19")
        self.assertEqual(rec["source_type"], "ats_api")
        self.assertIn("python", rec["skills"])
        self.assertEqual(rec["id"], identity.job_id(rec["canonical_key"]))

    def test_requirements_record_where_they_came_from(self):
        # Parsed out of the description: the job page must not re-list them.
        parsed = build_record(SRC, raw(), ISO)
        self.assertEqual(parsed["requirements_source"], "description")
        self.assertEqual(parsed["requirements"], ["5 years of Python", "Strong SQL"])
        # Published by the ATS as its own field: safe to render as a list.
        structured = build_record(SRC, raw(requirements=["Ship things"]), ISO)
        self.assertEqual(structured["requirements_source"], "employer_field")
        # Neither: no invented checklist, and nothing claimed about its origin.
        bare = build_record(SRC, raw(description_text="We are hiring."), ISO)
        self.assertEqual(bare["requirements_source"], "")
        self.assertEqual(bare["requirements"], [])

    def test_untitled_or_unapplyable_postings_are_dropped(self):
        self.assertIsNone(build_record(SRC, raw(title=""), ISO))
        self.assertIsNone(build_record(SRC, raw(apply_url=""), ISO))

    def test_stats_are_counted_not_declared(self):
        jobs = [confidence.annotate(build_record(SRC, raw(requisition_id=f"R-{i}"), ISO), NOW)
                for i in range(3)]
        for j in jobs:
            j["first_seen_at"] = ISO
        s = compute_stats(jobs, NOW, ISO)
        self.assertEqual(s["live_jobs"], 3)
        self.assertEqual(s["verified_today"], 3)
        self.assertEqual(s["added_last_24h"], 3)
        self.assertEqual(s["employers"], 1)


def strip_comments(text: str, html: bool = False) -> str:
    """Remove comments so the guards below test CODE, not prose about the code.

    Without this, a file explaining why it never writes innerHTML fails the
    innerHTML check - which teaches the next person to weaken the guard rather
    than to keep the rule.
    """
    out = re.sub(r"/\*.*?\*/", " ", text, flags=re.DOTALL)
    out = re.sub(r"(?m)^\s*//.*$", " ", out)
    out = re.sub(r"(?m)^\s*#.*$", " ", out)
    out = re.sub(r'(?s)"""(.*?)"""', " ", out)
    if html:
        out = re.sub(r"<!--.*?-->", " ", out, flags=re.DOTALL)
    return out


class TestProductRules(unittest.TestCase):
    """Rules that live across files, asserted once so they cannot quietly lapse."""

    SHIPPED = [p for p in (list((ROOT / "jobs").rglob("*.html")) +
                           list((ROOT / "jobs").rglob("*.js")) +
                           list((ROOT / "jobsignal").rglob("*.py")))
               if "/data/" not in str(p)]

    def test_no_easy_apply_anywhere(self):
        for path in self.SHIPPED:
            text = strip_comments(path.read_text(encoding="utf-8", errors="replace"),
                                  html=path.suffix == ".html")
            self.assertNotRegex(text, r"(?i)easy\s+apply", str(path))

    def test_no_tier3_aggregator_is_used_as_a_source(self):
        for path in (ROOT / "jobsignal" / "pipeline").rglob("*.py"):
            text = strip_comments(path.read_text(encoding="utf-8", errors="replace"))
            for host in ("linkedin.com/jobs", "indeed.com/api", "glassdoor.com/api",
                         "ziprecruiter.com/api"):
                self.assertNotIn(host, text, f"{path} reads from {host}")

    def test_source_registry_is_tier_1_and_well_formed(self):
        cfg = json.loads((ROOT / "jobsignal" / "sources.json").read_text(encoding="utf-8"))
        slugs = set()
        for s in cfg["sources"]:
            for key in ("company_slug", "company_name", "company_domain", "ats_provider", "ats_slug"):
                self.assertTrue(s.get(key), f"{s.get('company_name')} missing {key}")
            self.assertEqual(s["tier"], 1, s["company_name"])
            self.assertIn(s["ats_provider"], adapters.ADAPTERS, s["company_name"])
            self.assertNotIn(s["company_slug"], slugs, f"duplicate slug {s['company_slug']}")
            slugs.add(s["company_slug"])
            self.assertNotIn("/", s["company_domain"])

    def test_no_hardcoded_statistics_in_the_front_end(self):
        """Every number the site claims must come from stats.json."""
        for path in (ROOT / "jobs").rglob("*.html"):
            text = path.read_text(encoding="utf-8", errors="replace")
            for m in re.finditer(r'class="stat-value"[^>]*>([^<]+)<', text):
                self.assertNotRegex(m.group(1).strip(), r"^\d", f"{path}: hardcoded stat {m.group(1)!r}")

    def test_front_end_never_injects_source_text_as_html(self):
        for path in (ROOT / "jobs").rglob("*.js"):
            text = strip_comments(path.read_text(encoding="utf-8", errors="replace"))
            for n, line in enumerate(text.split("\n"), 1):
                if "innerHTML" in line:
                    self.fail(f"{path}:{n} touches innerHTML: {line.strip()}")

    def test_no_seeded_jobs_are_committed(self):
        """An empty board is honest. An invented one is the thing we are against."""
        index = ROOT / "jobs" / "data" / "index.json"
        if not index.exists():
            return
        doc = json.loads(index.read_text(encoding="utf-8"))
        for job in doc.get("jobs", []):
            self.assertTrue(job.get("apply_url", "").startswith("http"), job.get("id"))
            self.assertNotIn("example.com", job.get("apply_url", ""))
            self.assertFalse(job.get("sample"), "sample jobs must never be published")


if __name__ == "__main__":
    unittest.main(verbosity=2, argv=[sys.argv[0]] + sys.argv[1:])
