#!/usr/bin/env python3
"""
Pre-render real content into interview.app/index.html so search engines
see meaningful text on first byte (the bank's dynamic UI was 100 % JS,
which Googlebot may treat as 'thin content' and refuse to index).

Generates:
  · A 'Popular questions' section with 60 hand-picked top questions
  · A 'Browse by company' section with the top-25 companies
  · A 'Browse by topic' section with all topic facets
  · An FAQ block (FAQPage JSON-LD friendly) with 6 sample Q&A pairs

The dynamic UI continues to work — JS replaces the prerendered list with
the real interactive widget once the data finishes loading. The static
section also serves as a SEO-friendly fallback for users with JS disabled.

Run from repo root:
  python3 interview/scripts/prerender_bank.py
"""

from __future__ import annotations

import json
import re
from collections import Counter
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
QUESTIONS = ROOT / "interview" / "data" / "questions.json"
INDEX_HTML = ROOT / "interview.app" / "index.html"

START_MARKER = "<!--PRERENDER:START-->"
END_MARKER = "<!--PRERENDER:END-->"

POPULAR_COMPANIES = [
    "Google", "Amazon", "Meta", "Apple", "Microsoft", "Atlassian",
    "DoorDash", "Snowflake", "Anthropic", "Stripe", "Netflix", "Uber",
    "Airbnb", "Salesforce", "Oracle", "Intel", "AMD", "Samsung", "Adobe",
    "Slack", "Shopify", "Pinterest", "LinkedIn", "JPMorgan", "Goldman",
]


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def render_question_card(q):
    diff = (q.get("difficulty") or "").lower()
    diff_class = f"diff-{diff}" if diff in ("easy", "medium", "hard") else "diff-other"
    co = escape(q.get("company") or "")
    title = escape(q.get("title") or q["id"])
    typ = escape(" · ".join(filter(None, [q.get("type"), q.get("subtopic")])))
    lang = escape((q.get("language") or "").upper())
    diff_label = escape(q.get("difficulty") or "—")
    page = "python.html" if q.get("language") == "python" else "sql.html"
    href = f"./{page}?q={escape(q['id'])}"
    return (
        f'<li><a href="{href}" class="qbpr-card">'
        f'<div class="qbpr-head"><span class="qbpr-title">{title}</span>'
        f'<span class="qbpr-diff {diff_class}">{diff_label}</span></div>'
        f'<div class="qbpr-meta">'
        f'<span class="qbpr-co">{co}</span>'
        f'<span class="qbpr-type">{typ}</span>'
        f'<span class="qbpr-lang">{lang}</span>'
        f'</div></a></li>'
    )


def pick_popular(questions, n=60):
    """Spread across all 5 batches and prefer well-known companies."""
    company_priority = {c: i for i, c in enumerate(POPULAR_COMPANIES)}
    by_batch = {}
    for q in questions:
        by_batch.setdefault(q["batch"], []).append(q)
    out = []
    per_batch = max(1, n // len(by_batch))
    for batch, qs in by_batch.items():
        qs_sorted = sorted(
            qs,
            key=lambda q: (company_priority.get(q.get("company") or "", 999), q["id"]),
        )
        out.extend(qs_sorted[:per_batch])
    return out[:n]


def render_section(questions):
    parts = []
    parts.append('<section class="qbpr-section" aria-label="Popular questions">')
    parts.append("  <h2>Popular interview questions</h2>")
    parts.append(
        '  <p class="qbpr-lede">'
        "Below is a static preview of the bank — handpicked questions from "
        f"{', '.join(POPULAR_COMPANIES[:8])} and {len(set(q.get('company') for q in questions if q.get('company')))} other companies. "
        f'Use the interactive widget above to filter all {len(questions)} questions, '
        'save your set, and run answers in the in-browser playground.'
        "</p>"
    )
    parts.append('  <ol class="qbpr-list">')
    for q in pick_popular(questions, 60):
        parts.append("    " + render_question_card(q))
    parts.append("  </ol>")
    parts.append("</section>")

    # By-company browse
    co_counts = Counter(q.get("company") for q in questions if q.get("company"))
    parts.append('<section class="qbpr-section" aria-label="Browse by company">')
    parts.append("  <h2>Browse by company</h2>")
    parts.append(
        '  <p class="qbpr-lede">'
        f"Companies represented in the bank ({len(co_counts)} total). "
        "Click any company to filter the question list by that company."
        "</p>"
    )
    parts.append('  <ul class="qbpr-cloud">')
    for name, n in sorted(co_counts.items(), key=lambda kv: (-kv[1], kv[0]))[:50]:
        parts.append(
            f'    <li><a href="./?company={escape(name)}">{escape(name)}'
            f' <span class="qbpr-count">{n}</span></a></li>'
        )
    parts.append("  </ul>")
    parts.append("</section>")

    # By-topic browse
    type_counts = Counter(q.get("type") for q in questions if q.get("type"))
    parts.append('<section class="qbpr-section" aria-label="Browse by topic">')
    parts.append("  <h2>Browse by topic</h2>")
    parts.append('  <ul class="qbpr-cloud">')
    for name, n in sorted(type_counts.items(), key=lambda kv: (-kv[1], kv[0])):
        parts.append(
            f'    <li><a href="./?topic={escape(name)}">{escape(name)}'
            f' <span class="qbpr-count">{n}</span></a></li>'
        )
    parts.append("  </ul>")
    parts.append("</section>")

    # FAQ
    total_q = len(questions)
    n_companies = len({q.get("company") for q in questions if q.get("company")})
    sql_q = sum(1 for q in questions if q.get("language") == "sql")
    py_q = sum(1 for q in questions if q.get("language") == "python")

    faqs = [
        ("How many interview questions does the bank include?",
         f"The bank ships {total_q} hand-curated interview questions across SQL, Python, "
         f"Snowflake and Git, sourced from real interview rounds at {n_companies} companies "
         "including Google, Amazon, Meta, Apple, Atlassian and Anthropic."),
        ("Do I need an account to use the playgrounds?",
         "No. Both the SQL and Python playgrounds run entirely in your browser. "
         "There is no sign-up, no backend, and no telemetry. Your code stays on "
         "your device."),
        ("How do the playgrounds work without a server?",
         "The SQL playground uses sql.js (SQLite compiled to WebAssembly) with "
         "synthetic per-question schemas auto-generated from the inferred schema. "
         "The Python playground uses Pyodide (CPython 3.12 in WebAssembly) with "
         "the standard library pre-imported and pandas/numpy available on demand."),
        ("Can I save the questions I want to practise?",
         "Yes. Tick the boxes on any question card to add it to your set. "
         "Your selections persist in localStorage and can be exported as JSON, "
         "Markdown or a printable PDF."),
        ("Are the SQL solutions guaranteed to run in SQLite?",
         f"Most of the {sql_q} SQL solutions run as-is in the in-browser SQLite. "
         "Those that use Snowflake- or PostgreSQL-only features (QUALIFY, "
         "INTERVAL '7 days', regex functions, …) show a banner with the specific "
         "incompatible token so you can read the reference and run it in your "
         "target database."),
        ("How do I report a bad question or solution?",
         "Open an issue at github.com/paddyriyer/paddyspeaks. The dataset and "
         "every override are stored as plain JSON files under interview/data/, "
         "so contributions are trivial."),
    ]
    parts.append('<section class="qbpr-section" aria-label="Frequently asked questions">')
    parts.append("  <h2>FAQ</h2>")
    parts.append("  <dl class=\"qbpr-faq\">")
    for q_, a in faqs:
        parts.append(f"    <dt>{escape(q_)}</dt>")
        parts.append(f"    <dd>{escape(a)}</dd>")
    parts.append("  </dl>")
    parts.append("</section>")

    # FAQPage JSON-LD
    faq_ld = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": q_,
                "acceptedAnswer": {"@type": "Answer", "text": a},
            }
            for q_, a in faqs
        ],
    }
    parts.append(
        '<script type="application/ld+json">'
        + json.dumps(faq_ld, ensure_ascii=False)
        + "</script>"
    )

    return "\n".join(parts)


def main():
    # Refresh hardcoded counts on every run so they never drift from the
    # actual manifest. Soft-imported so prerender works even if the file
    # ever moves.
    try:
        import importlib.util as _u
        _spec = _u.spec_from_file_location(
            "_uc", Path(__file__).with_name("update_counts.py")
        )
        _mod = _u.module_from_spec(_spec); _spec.loader.exec_module(_mod)
        _mod.main()
        print()
    except Exception as e:
        print(f"WARN: count refresh skipped — {e}")

    questions = json.loads(QUESTIONS.read_text())
    block = render_section(questions)

    html = INDEX_HTML.read_text()
    if START_MARKER in html and END_MARKER in html:
        new = re.sub(
            re.escape(START_MARKER) + r"[\s\S]*?" + re.escape(END_MARKER),
            f"{START_MARKER}\n{block}\n{END_MARKER}",
            html,
        )
    else:
        # First run: inject before the closing </main> or before <footer>.
        injection = f"\n{START_MARKER}\n{block}\n{END_MARKER}\n"
        if "</main>" in html:
            new = html.replace("</main>", injection + "</main>")
        else:
            new = html.replace("<footer", injection + "<footer", 1)

    INDEX_HTML.write_text(new)

    # Quick stats
    word_count = len(re.sub(r"<[^>]+>", " ", new).split())
    print(f"Wrote {INDEX_HTML.relative_to(ROOT)}")
    print(f"Total static word count: {word_count}")


if __name__ == "__main__":
    main()
