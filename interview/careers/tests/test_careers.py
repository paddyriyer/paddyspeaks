"""Guardrails for the career taxonomy, the Career Prep content and the jobs board.

    python3 -m interview.careers.tests.test_careers

No network. Wired into Validate Content.
"""
from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

from interview.careers import build as careers_build
from interview.careers.classify import Taxonomy, employment, summarise, workplace

ROOT = Path(__file__).resolve().parents[3]
CAREERS = ROOT / "interview.app" / "careers" / "data" / "careers.json"
JOBS = ROOT / "interview.app" / "jobs" / "data" / "jobs.json"


class Classify(unittest.TestCase):
    tax = Taxonomy.load()

    def role(self, title):
        r = self.tax.classify(title)
        return r and r["role"]

    def test_every_role_title_classifies_to_itself(self):
        for r in self.tax.data["roles"]:
            self.assertEqual(self.role(r["title"]), r["id"], r["title"])

    def test_technical_product_and_program_are_distinct(self):
        self.assertEqual(self.role("Technical Product Manager, Payments API"), "technical_pm")
        self.assertEqual(self.role("Technical Program Manager, Payments"), "tpm")
        self.assertEqual(self.role("Senior Technical Program Manager"), "senior_tpm")
        self.assertEqual(self.role("Technical Program Manager, AI Safety"), "ai_tpm")
        self.assertEqual(self.role("Technical Program Manager, Compute Infrastructure"), "cloud_infra_pm")
        self.assertNotEqual(self.tax.roles["technical_pm"]["track"], self.tax.roles["tpm"]["track"])

    def test_product_titles_are_not_engineering(self):
        self.assertEqual(self.role("Sr. Product Manager, Data Engineering"), "data_pm")
        self.assertEqual(self.role("Product Manager, Machine Learning Platform"), "ai_platform_pm")
        self.assertEqual(self.tax.classify("Senior Data Engineer")["family"], "engineering")

    def test_out_of_scope_titles_are_left_out(self):
        for t in ["Director, Product Design", "Senior Product Designer", "Talent Program Manager",
                  "Account Executive", "Software Engineer", "Recruiter"]:
            self.assertIsNone(self.role(t), t)

    def test_seniority(self):
        s = lambda t: self.tax.classify(t)["seniority"]  # noqa: E731
        self.assertEqual(s("Associate Product Manager"), "associate")
        self.assertEqual(s("Product Manager Intern (2027)"), "entry")
        self.assertEqual(s("Senior Product Manager"), "senior")
        self.assertEqual(s("Staff Product Manager, AI"), "staff_principal")
        self.assertEqual(s("Group Product Manager"), "staff_principal")
        self.assertEqual(s("Director of Product Management"), "director")
        self.assertEqual(self.tax.classify("Product Manager", "director_plus")["seniority"], "director")

    def test_secondary_families(self):
        r = self.tax.classify("Group Product Manager, AI Foundations")
        self.assertEqual(r["family"], "product")
        self.assertIn("ai_product", r["families"])

    def test_workplace_and_employment(self):
        self.assertEqual(workplace("remote"), "remote")
        self.assertEqual(workplace(None, "Remote - India"), "remote")
        self.assertEqual(workplace(None, "London"), "unknown")
        self.assertEqual(employment(None, "Data Engineer gyakornok"), "internship")
        self.assertEqual(employment("full_time"), "full_time")

    def test_summary_is_verbatim_and_names_nobody(self):
        desc = ("Acme is the world's leading widget company, trusted by millions of people.\n\n"
                "As a Product Manager on Payments, you will own checkout and lead a team of eight. "
                "You will report to Jane Doe, our VP of Product.\n\nWe are an equal opportunity employer.")
        out = summarise(desc, "Product Manager, Payments")
        self.assertTrue(out.startswith("As a Product Manager on Payments"))
        self.assertIn(out, desc.replace("\n", " "))
        self.assertNotIn("Jane", out)
        self.assertEqual(summarise("Acme is the world's leading widget company, trusted by millions of people."), "")


class Content(unittest.TestCase):
    def test_build_is_valid_and_current(self):
        careers_build.errors.clear()
        files = careers_build.build()
        self.assertEqual(careers_build.errors, [])
        on_disk = json.loads(CAREERS.read_text(encoding="utf-8"))
        self.assertEqual(on_disk, json.loads(careers_build.dump(files["careers.json"])),
                         "run python3 interview/careers/build.py")

    def test_counts_are_derived(self):
        d = json.loads(CAREERS.read_text(encoding="utf-8"))
        total = 0
        for t in d["tracks"]:
            qs = json.loads((CAREERS.parent / "tracks" / f"{t['id']}.json").read_text(encoding="utf-8"))["questions"]
            self.assertEqual(t["question_count"], len(qs))
            total += len(qs)
        self.assertEqual(d["counts"]["questions"], total)

    def test_pm_and_tpm_curricula_do_not_overlap(self):
        d = json.loads(CAREERS.read_text(encoding="utf-8"))
        tr = {t["id"]: t for t in d["tracks"]}
        for a, b in [("pm_core", "tpm"), ("tech_pm", "tpm")]:
            shared = (set(tr[a]["categories"]) & set(tr[b]["categories"])) - {"behavioral", "stakeholders"}
            self.assertEqual(shared, set(), f"{a} / {b}")
            self.assertNotEqual([r["title"] for r in tr[a]["rounds"]], [r["title"] for r in tr[b]["rounds"]])

    def test_every_question_is_labelled_practice(self):
        for p in (CAREERS.parent / "tracks").glob("*.json"):
            for q in json.loads(p.read_text(encoding="utf-8"))["questions"]:
                self.assertEqual(q["kind"], "practice")
                self.assertNotRegex(q["prompt"] + q["reference"], r"\{\{")

    def test_attribution_guard_catches_a_bad_question(self):
        self.assertTrue(careers_build.ATTRIBUTION.search("This is a real interview question from Google."))
        self.assertTrue(careers_build.ATTRIBUTION.search("Asked at Meta in 2025."))
        self.assertFalse(careers_build.ATTRIBUTION.search("admin time reported by owners"))


class JobsBoard(unittest.TestCase):
    board = json.loads(JOBS.read_text(encoding="utf-8"))
    tax = Taxonomy.load()

    def test_every_job_is_classified_with_known_ids(self):
        sen = {s["id"] for s in self.tax.data["seniority"]}
        for j in self.board["jobs"]:
            self.assertIn(j["role_id"], self.tax.roles, j["role"])
            self.assertEqual(self.tax.roles[j["role_id"]]["family"], j["family"])
            self.assertIn(j["family"], j["families"])
            self.assertIn(j["seniority"], sen)
            self.assertIn(j["workplace"], {"remote", "hybrid", "onsite", "unknown"})

    def test_no_invented_live_listing(self):
        for j in self.board["jobs"]:
            if j.get("sample"):
                self.assertEqual(self.board["mode"], "sample")
                continue
            self.assertIn(j["status"], {"live", "expired"})
            self.assertRegex(j["apply_url"], r"^https://")
            self.assertNotRegex(j["apply_url"], r"google\.com/search|linkedin\.com|indeed\.com|glassdoor|ziprecruiter")
            self.assertIn(j["source"], {"jobsignal", "ats", "adzuna"})

    def test_counts_match_jobs(self):
        live = [j for j in self.board["jobs"] if j.get("status") != "expired"]
        self.assertEqual(self.board["job_count"], len(live))
        self.assertEqual(self.board["company_count"], len({j["company"] for j in live}))

    def test_bank_links_only_for_companies_with_questions(self):
        qs = json.loads((ROOT / "interview/data/questions.json").read_text(encoding="utf-8"))
        tagged = {q["company"] for q in qs if q.get("company")}
        for name, rec in self.board["bank"].items():
            self.assertIn(name, tagged)
            self.assertGreater(rec["total"], 0)

    def test_summaries_name_no_reporting_line(self):
        for j in self.board["jobs"]:
            self.assertFalse(re.search(r"report(s|ing)? to", j.get("summary", ""), re.I), j.get("summary"))


if __name__ == "__main__":
    unittest.main(verbosity=1)
