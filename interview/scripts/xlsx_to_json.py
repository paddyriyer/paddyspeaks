#!/usr/bin/env python3
"""
Read interview/excel/Interview_Questions_Combined.xlsx and emit unified JSON
for the question-bank web app.

Outputs (under interview/data/):
  - questions.json     — flat array of all questions across all batches
  - companies.json     — distinct companies (sorted, with counts)
  - topics.json        — distinct types/subtopics (with counts)
  - difficulties.json  — distinct difficulties (with counts)
  - languages.json     — distinct languages (with counts)
  - manifest.json      — top-level summary

Run from repo root:
  python3 interview/scripts/xlsx_to_json.py
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[2]
XLSX = ROOT / "interview" / "excel" / "Interview_Questions_Combined.xlsx"
OUT = ROOT / "interview" / "data"


def _slug(s: str) -> str:
    out = []
    for ch in (s or "").lower():
        if ch.isalnum():
            out.append(ch)
        elif out and out[-1] != "-":
            out.append("-")
    return "".join(out).strip("-")


def _rows(ws):
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return [], []
    header = [str(h).strip() if h is not None else "" for h in rows[0]]
    return header, rows[1:]


def _index(headers, name):
    for i, h in enumerate(headers):
        if h.lower() == name.lower():
            return i
    return -1


def load_batch(wb, index_sheet, solutions_sheet, batch_id, language, default_type=None):
    """Merge an Index_* sheet with its Solutions_* sheet by question number."""
    ihdr, irows = _rows(wb[index_sheet])
    shdr, srows = _rows(wb[solutions_sheet])

    sol_map = {}
    s_num = _index(shdr, "#")
    s_sol = _index(shdr, "Solution")
    if s_sol == -1:
        s_sol = _index(shdr, "SQL Solution")
    s_schema = _index(shdr, "Inferred Schema")
    s_diff = _index(shdr, "Difficulty")
    s_tech = _index(shdr, "Tech")
    s_sub = _index(shdr, "Subtopic")

    for r in srows:
        if not r or r[s_num] is None:
            continue
        sol_map[int(r[s_num])] = {
            "solution": r[s_sol] if s_sol != -1 else None,
            "schema": r[s_schema] if s_schema != -1 else None,
            "difficulty": r[s_diff] if s_diff != -1 else None,
            "tech": r[s_tech] if s_tech != -1 else None,
            "subtopic": r[s_sub] if s_sub != -1 else None,
        }

    i_num = _index(ihdr, "#")
    i_q = _index(ihdr, "Question")
    i_co = _index(ihdr, "Company")
    i_type = _index(ihdr, "Type")
    i_tech = _index(ihdr, "Tech")
    i_sub = _index(ihdr, "Subtopic")
    i_diff = _index(ihdr, "Difficulty")

    out = []
    for r in irows:
        if not r or r[i_num] is None:
            continue
        n = int(r[i_num])
        sol = sol_map.get(n, {})

        question_type = None
        if i_type != -1 and r[i_type]:
            question_type = r[i_type]
        elif i_tech != -1 and r[i_tech]:
            question_type = r[i_tech]
        elif sol.get("tech"):
            question_type = sol["tech"]
        else:
            question_type = default_type

        subtopic = (r[i_sub] if i_sub != -1 else None) or sol.get("subtopic")
        difficulty = (r[i_diff] if i_diff != -1 else None) or sol.get("difficulty")
        company = r[i_co] if i_co != -1 else None
        title = r[i_q] if i_q != -1 else None

        # Per-batch language can be overridden by Tech/Type where present
        lang = language
        qt = (question_type or "").lower()
        # Substring matches first so 'Programming / Python+1' or 'PySpark Streaming' map cleanly
        if "python" in qt or qt.startswith("programming") or "pyspark" in qt or qt == "spark":
            lang = "python"
        elif qt.startswith("sql") or "snowflake" in qt or qt in ("mysql", "postgres", "postgresql"):
            lang = "sql"
        elif qt in ("linux", "shell", "bash", "docker", "git"):
            lang = "shell"

        qid = f"{batch_id}-{n:04d}"
        out.append(
            {
                "id": qid,
                "batch": batch_id,
                "num": n,
                "title": title,
                "slug": _slug(title or qid),
                "company": company,
                "type": question_type,
                "subtopic": subtopic,
                "difficulty": difficulty,
                "language": lang,
                "schema": sol.get("schema"),
                "solution": sol.get("solution"),
            }
        )
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    wb = openpyxl.load_workbook(XLSX, data_only=True)

    questions = []
    questions += load_batch(wb, "Index_305", "Solutions_305", "co_sql_305", "sql", default_type="SQL")
    questions += load_batch(wb, "Index_167", "Solutions_167", "mixed_167", "sql")
    questions += load_batch(wb, "Index_Git12", "Solutions_Git12", "git_12", "shell", default_type="Git")
    questions += load_batch(wb, "Index_SF51", "Solutions_SF51", "snowflake_51", "sql", default_type="Snowflake SQL")
    questions += load_batch(wb, "Index_PY175", "Solutions_PY175", "python_175", "python", default_type="Python")

    # Merge any community-contributed questions stored as plain JSON.
    for extra_name in ("community_questions.json", "community_solved_questions.json"):
        extra_path = OUT / extra_name
        if not extra_path.exists():
            continue
        try:
            extras = json.loads(extra_path.read_text())
            if isinstance(extras, list):
                questions += extras
                print(f"Merged {len(extras)} question(s) from {extra_name}")
        except Exception as e:
            print(f"WARN: couldn't merge {extra_name}: {e}")

    # Apply manual overrides for source-data issues we've spotted via audit
    overrides_path = OUT / "solution_overrides.json"
    if overrides_path.exists():
        overrides = json.loads(overrides_path.read_text())
        applied = 0
        for q in questions:
            patch = overrides.get(q["id"])
            if isinstance(patch, dict):
                for key in ("solution", "schema", "type", "language", "title"):
                    if key in patch:
                        q[key] = patch[key]
                applied += 1
        if applied:
            print(f"Applied {applied} solution override(s) from {overrides_path.name}")

    # Annotate runtime so the playground can show an upfront banner for
    # solutions that need a non-bundled library or a non-SQLite dialect.
    import re as _re
    PYSPARK_RE = _re.compile(
        r"^\s*(?:import\s+pyspark|from\s+pyspark)"
        r"|\bSparkSession\b|\bspark\.(?:read|sql|createDataFrame)\b"
        # Bare-DataFrame-method patterns (questions tagged 'Spark' / 'PySpark'
        # often skip the import boilerplate and reference an in-scope `df`).
        r"|\.repartition\s*\(|\.coalesce\s*\([^)]*\)\s*$|\.partitionBy\s*\("
        r"|\.withColumnRenamed\s*\(|\.broadcast\s*\("
        r"|\bF\.(?:col|lit|when|coalesce|sum|avg|count)\s*\(",
        _re.M,
    )
    NEEDS_PANDAS_RE = _re.compile(
        # Single-line or multi-name imports — `import sqlite3, pandas as pd` too.
        r"(?:^|\W)(?:import|from)\s+[^\n#]*\b(?:pandas|numpy|pyarrow)\b",
        _re.M,
    )
    THIRDPARTY_RE = _re.compile(
        r"(?:^|\W)(?:import|from)\s+[^\n#]*\b(?:fastavro|sortedcontainers|bs4|beautifulsoup4|requests|pyarrow)\b",
        _re.M,
    )
    SQL_NONLITE_RE = _re.compile(
        r"\b(?:QUALIFY|ILIKE|IFF\(|MATCH_RECOGNIZE|MERGE\s+INTO|GROUPING\s+SETS"
        r"|CUBE\(|ROLLUP\(|TO_CHAR\(|TO_DATE\(|SPLIT_PART\(|LISTAGG\("
        r"|STRING_AGG\(|ARRAY_AGG\(|OBJECT_AGG\(|REGEXP_MATCHES\(|REGEXP_LIKE\("
        r"|REGEXP_SUBSTR\(|REGEXP_REPLACE\(|GENERATE_SERIES\(|DATE_TRUNC\("
        r"|DATE_PART\(|DATE_FORMAT\(|FROM_UNIXTIME\(|UNIX_TIMESTAMP\("
        r"|UNNEST\(|FLATTEN\(|STDDEV\(|VARIANCE\(|PERCENTILE_(?:CONT|DISC)\("
        r"|MEDIAN\(|SHA2\(|MD5\(|CONCAT_WS\(|STRING_TO_ARRAY\(|TRY_CAST\("
        r"|NVL\(|EXTRACT\(|LEFT\(|RIGHT\(|LEAST\(|GREATEST\("
        r"|CURRENT_DATE\s*\(|CURRENT_TIMESTAMP\s*\(|GETDATE\(|SYSDATE\(|NOW\("
        r"|DAYOFWEEK\(|DAYOFMONTH\(|WEEKOFYEAR\(|ANY\("
        r")|::\s*[A-Za-z]|INTERVAL\s+'[^']+'|DATE\s+'\d{4}-\d{2}-\d{2}'"
        # PG/Snowflake `OFFSET n LIMIT m` order (SQLite needs LIMIT first)
        r"|\bOFFSET\s+\d+\s+LIMIT\b",
        _re.IGNORECASE,
    )
    for q in questions:
        sol = q.get("solution") or ""
        typ = (q.get("type") or "").lower()
        rt = None
        if q["language"] == "python":
            if "spark" in typ or PYSPARK_RE.search(sol):
                rt = "pyspark"
            elif THIRDPARTY_RE.search(sol):
                rt = "third-party"
            elif NEEDS_PANDAS_RE.search(sol):
                rt = "pandas"
        elif q["language"] == "sql":
            m = SQL_NONLITE_RE.search(sol)
            if m:
                rt = "non-sqlite"
                q["dialect_token"] = m.group(0).strip()
        q["runtime"] = rt

    # Facets
    companies = Counter(q["company"] for q in questions if q["company"])
    types = Counter(q["type"] for q in questions if q["type"])
    subtopics = Counter(q["subtopic"] for q in questions if q["subtopic"])
    difficulties = Counter(q["difficulty"] for q in questions if q["difficulty"])
    languages = Counter(q["language"] for q in questions if q["language"])

    def to_facet(counter):
        return [{"name": k, "count": v} for k, v in sorted(counter.items(), key=lambda kv: (-kv[1], kv[0]))]

    (OUT / "questions.json").write_text(json.dumps(questions, ensure_ascii=False, indent=2))
    (OUT / "companies.json").write_text(json.dumps(to_facet(companies), ensure_ascii=False, indent=2))
    (OUT / "topics.json").write_text(
        json.dumps(
            {"types": to_facet(types), "subtopics": to_facet(subtopics)},
            ensure_ascii=False,
            indent=2,
        )
    )
    (OUT / "difficulties.json").write_text(json.dumps(to_facet(difficulties), ensure_ascii=False, indent=2))
    (OUT / "languages.json").write_text(json.dumps(to_facet(languages), ensure_ascii=False, indent=2))

    manifest = {
        "source": str(XLSX.relative_to(ROOT)),
        "batches": [
            {"id": "co_sql_305", "label": "Company SQL (305)", "count": sum(1 for q in questions if q["batch"] == "co_sql_305")},
            {"id": "mixed_167", "label": "Mixed Tech (167)", "count": sum(1 for q in questions if q["batch"] == "mixed_167")},
            {"id": "git_12", "label": "Git (12)", "count": sum(1 for q in questions if q["batch"] == "git_12")},
            {"id": "snowflake_51", "label": "Snowflake SQL (51)", "count": sum(1 for q in questions if q["batch"] == "snowflake_51")},
            {"id": "python_175", "label": "Python (175)", "count": sum(1 for q in questions if q["batch"] == "python_175")},
            {"id": "community_5", "label": "Community Contributed", "count": sum(1 for q in questions if q["batch"] == "community_5")},
            {"id": "community_solved", "label": "Solved SQL Workbook", "count": sum(1 for q in questions if q["batch"] == "community_solved")},
        ],
        "total": len(questions),
        "companies": len(companies),
        "languages": dict(languages),
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))

    print(f"Wrote {len(questions)} questions to {OUT.relative_to(ROOT)}/")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
