#!/usr/bin/env python3
"""
Load all SQL-question sample data into a Postgres database.

For each SQL question in `interview/data/questions.json`, this script:
  1. Parses its schema (table/columns) from `interview/data/question_schemas.json`
  2. Infers a column type and a value generator using the same rules as
     `interview.app/js/sample-gen.js` (so behavior matches the playground)
  3. Emits CREATE SCHEMA + CREATE TABLE + INSERT statements
  4. Optionally executes them against a live Postgres via psycopg

Each question gets its own schema so tables don't collide:
    schema name = "q_<qid_safe>"   e.g.  q_co_sql_305_0091
You can then run any question's solution after `SET search_path TO q_co_sql_305_0091;`.

USAGE
-----
  # Dump everything to a SQL file (default — no DB connection needed)
  python interview/scripts/load_postgres.py --out paddyspeaks.sql

  # Only one question
  python interview/scripts/load_postgres.py --qid co_sql_305-0091 --out one.sql

  # Only Netflix questions
  python interview/scripts/load_postgres.py --company Netflix --out netflix.sql

  # Pipe straight to psql
  python interview/scripts/load_postgres.py --out - | psql "$DATABASE_URL"

  # Or execute directly (requires psycopg / psycopg2)
  python interview/scripts/load_postgres.py --exec --dsn "postgresql://user:pw@host/db"

OPTIONS
-------
  --rows N          rows to generate per table (default 30)
  --seed S          deterministic seed for the data (default: question-id hash)
  --drop            DROP SCHEMA IF EXISTS first (idempotent re-run)
  --out PATH        write SQL to PATH ("-" = stdout)
  --exec            execute against --dsn instead of writing a file
  --dsn URL         Postgres DSN (only for --exec)
  --qid QID         single question (default: all SQL questions)
  --company NAME    filter by company name (case-insensitive)
  --batch BATCH     filter by batch (e.g. co_sql_305)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
QUESTIONS_PATH = ROOT / "interview" / "data" / "questions.json"
SCHEMAS_PATH = ROOT / "interview" / "data" / "question_schemas.json"

# ─── Pools mirroring interview.app/js/sample-gen.js ─────────────────────────
NAME_POOL = ["Aarav", "Anaya", "Ben", "Chloe", "Diego", "Elena", "Faisal", "Grace", "Hiro", "Iris"]
SURNAME_POOL = ["Patel", "Tanaka", "Garcia", "Kim", "Adeyemi", "Schmidt", "Rossi", "Khan", "Brown", "Silva"]
CITY_POOL = ["Bengaluru", "Singapore", "Berlin", "Lagos", "Lima", "Tokyo", "Mumbai", "Chicago", "Madrid", "Cairo"]
COUNTRY_POOL = ["IN", "US", "DE", "BR", "JP", "NG", "GB", "FR", "AU", "SG"]
DEPT_POOL = ["Engineering", "Marketing", "Sales", "Finance", "HR", "Product", "Data", "Ops", "Design"]
CATEGORY_POOL = ["Electronics", "Books", "Apparel", "Home", "Toys", "Sports", "Beauty", "Grocery"]
STATUS_POOL = ["pending", "active", "inactive", "completed", "cancelled", "shipped", "failed", "up", "down"]
PLATFORM_POOL = ["ios", "android", "web", "macos", "windows"]
CHANNEL_POOL = ["organic", "paid", "email", "referral", "social"]
METHOD_POOL = ["card", "cash", "wire", "ach", "wallet"]
REGION_POOL = ["NA", "EMEA", "APAC", "LATAM"]
PAGE_POOL = ["home", "search", "product", "cart", "checkout", "account"]
LEVEL_POOL = ["IC", "Manager", "Senior Manager", "Director", "VP"]
TIER_POOL = ["bronze", "silver", "gold", "platinum"]
PLAN_POOL = ["free", "pro", "team", "enterprise"]
GENDER_POOL = ["F", "M", "X"]
CURRENCY_POOL = ["USD", "EUR", "INR", "JPY", "GBP"]
SECTOR_POOL = ["Tech", "Retail", "Health", "Finance", "Energy"]
JOB_TITLE_POOL = ["Engineer", "Manager", "Analyst", "Designer", "PM", "Director"]
MANUFACTURER_POOL = ["Acme", "Globex", "Initech", "Umbrella", "Wayne"]
ACTION_POOL = ["click", "view", "purchase", "share", "comment"]
EVENT_TYPE_POOL = ["signup", "login", "view", "purchase", "logout"]
TXN_TYPE_POOL = ["debit", "credit", "transfer", "refund"]


# ─── Type inference (matches sample-gen.js order: specific → general) ────────
def infer_type_role(col: str) -> tuple[str, str]:
    c = col.lower()
    # Order matters: more-specific rules first so that, e.g., `watch_time`
    # (count of minutes, INTEGER) is caught before the generic `_time$`
    # datetime rule, and `device_type` is caught before the generic text rule.
    rules = [
        (r"(^|_)id$", "BIGINT", "id"),
        (r"(^|_)is_", "INTEGER", "boolean"),
        (
            r"^(start|end|hire|signup|birth|order|purchase|posted|updated|created|delivered|"
            r"completed|paid|received|effective|expiry|action|metric|due|launched|filed|ds)_(date|on)$|"
            r"_date$|^(ds|date|dob|month|week_start)$",
            "DATE", "date",
        ),
        # Specific count names — must come BEFORE the generic _time$ datetime rule
        # because watch_time / watch_minutes etc. are minute counts, not timestamps.
        (
            r"^(watch_time|watch_minutes|watched_seconds|rebuf_seconds|rebuf_count|"
            r"watch_seconds|duration_sec|delay_minutes|streak_days|streak)$",
            "INTEGER", "count",
        ),
        (r"(_at|_ts)$|^(timestamp|started_at|ended_at|search_ts|play_ts|autoplay_shown_at|posted_at|launched_on|filed_date|signup_date|trial_end_date|first_paid_date|cancel_date|action_date|activity_date|order_date|sale_date)$",
         "TIMESTAMP", "datetime"),
        (
            r"(amount|price|total|revenue|salary|bonus|cost|budget|spend|spent|weight|score|rate|value|"
            r"profit|gmv|gross|net|fee|tax|discount|balance|due_amount|paid_amount|cogs|avg_|target|"
            r"quota|goal|forecast|commission|payout|hours)",
            "NUMERIC(14,2)", "money",
        ),
        (
            r"(qty|quantity|count|views|likes|comments|clicks|impressions|sessions|wau|dau|mau|days|"
            r"seconds|minutes|capacity|tickets_sold|on_hand|new_subs|cancelled_subs|action_count|"
            r"user_continued)",
            "INTEGER", "count",
        ),
        (r"^age$", "INTEGER", "age"),
        (r"^email", "TEXT", "email"),
        (r"^phone", "TEXT", "phone"),
        (r"(^|_)country", "TEXT", "country"),
        (r"(^|_)city", "TEXT", "city"),
        (r"(^|_)region", "TEXT", "region"),
        (r"(^|_)category|^classification$", "TEXT", "category"),
        (r"(^|_)status", "TEXT", "status"),
        # device_type / device must precede the generic text rule.
        (r"(^|_)device(_type)?$", "TEXT", "device"),
        (r"(^|_)platform", "TEXT", "platform"),
        (r"(^|_)channel", "TEXT", "channel"),
        (r"(^|_)method", "TEXT", "method"),
        (r"(^|_)page", "TEXT", "page"),
        (r"(^|_)dept(_name)?$|(^|_)department", "TEXT", "department"),
        (r"^isp$", "TEXT", "isp"),
        (
            r"(first_name|last_name|full_name|customer_name|product_name|emp_name|name|title|description|"
            r"content|gender|currency|sector|level|job_title|manufacturer|tier|plan|action|event_type|"
            r"txn_type|attribute_json|query_text)",
            "TEXT", "text",
        ),
    ]
    for pat, t, role in rules:
        if re.search(pat, c):
            return t, role
    return "TEXT", "text"


# ─── Value generator (deterministic via seeded PRNG) ─────────────────────────
def gen_value(rng: random.Random, col: str, role: str, table: str, i: int, fk_pool: dict | None):
    c = col.lower()
    if role == "id":
        # Foreign-key columns cycle through a small pool so joins find matches.
        if c.endswith("_id") and not (
            c == f"{table.rstrip('s')}_id" or c == f"{table}_id" or c == "id"
        ):
            pool = fk_pool.setdefault(c, [rng.randint(1, 5) for _ in range(5)]) if fk_pool is not None else [1, 2, 3, 4, 5]
            return rng.choice(pool)
        return i
    if role == "boolean":
        return rng.choice([0, 1])
    if role == "date":
        # Match interview.app/js/sample-gen.js — 60-day span produces useful
        # clustering for streak / gap / binge / cohort questions.
        base = date(2026, 1, 1)
        return base + timedelta(days=rng.randint(0, 60))
    if role == "datetime":
        base = datetime(2026, 1, 1, 0, 0, 0)
        return base + timedelta(minutes=rng.randint(0, 60 * 24 * 60))
    if role == "money":
        return round(rng.uniform(10, 5000), 2)
    if role == "count":
        return rng.randint(0, 500)
    if role == "age":
        return rng.randint(18, 75)
    if role == "email":
        return f"{rng.choice(NAME_POOL).lower()}.{i}@example.com"
    if role == "phone":
        return f"+1-555-{rng.randint(1000, 9999)}"
    if role == "country":
        return rng.choice(COUNTRY_POOL)
    if role == "city":
        return rng.choice(CITY_POOL)
    if role == "region":
        return rng.choice(REGION_POOL)
    if role == "category":
        return rng.choice(CATEGORY_POOL)
    if role == "status":
        return rng.choice(STATUS_POOL)
    if role == "platform":
        return rng.choice(PLATFORM_POOL)
    if role == "channel":
        return rng.choice(CHANNEL_POOL)
    if role == "method":
        return rng.choice(METHOD_POOL)
    if role == "page":
        return rng.choice(PAGE_POOL)
    if role == "department":
        return rng.choice(DEPT_POOL)
    if role == "isp":
        return rng.choice(["Comcast", "Verizon", "AT&T", "T-Mobile", "Spectrum", "CenturyLink"])
    if role == "device":
        return rng.choice(["tv", "mobile", "web", "tablet", "game_console"])
    if role == "text":
        if c == "first_name":
            return rng.choice(NAME_POOL)
        if c == "last_name":
            return rng.choice(SURNAME_POOL)
        if c.endswith("_name") or c in ("name", "full_name", "customer_name", "product_name"):
            return f"{rng.choice(NAME_POOL)} {rng.choice(SURNAME_POOL)}"
        if c == "title":
            return f"Item {i}"
        if c == "description" or c == "content":
            return f"Sample {table} content #{i}"
        if c == "gender":
            return rng.choice(GENDER_POOL)
        if c == "currency":
            return rng.choice(CURRENCY_POOL)
        if c == "sector":
            return rng.choice(SECTOR_POOL)
        if c == "level":
            return rng.choice(LEVEL_POOL)
        if c == "job_title":
            return rng.choice(JOB_TITLE_POOL)
        if c == "manufacturer":
            return rng.choice(MANUFACTURER_POOL)
        if c == "tier":
            return rng.choice(TIER_POOL)
        if c == "plan":
            return rng.choice(PLAN_POOL)
        if c == "action":
            return rng.choice(ACTION_POOL)
        if c == "event_type":
            return rng.choice(EVENT_TYPE_POOL)
        if c == "txn_type":
            return rng.choice(TXN_TYPE_POOL)
        if c == "query_text":
            return rng.choice(["stranger things", "comedy", "korean drama", "documentary", "sci-fi", "thriller"])
        if c == "attribute_json":
            return json.dumps(
                {"size": rng.choice(["S", "M", "L"]), "color": rng.choice(["red", "blue", "green"])}
            )
        return f"{c}_{i}"
    return f"{c}_{i}"


# ─── SQL emission ────────────────────────────────────────────────────────────
def quote_ident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def sql_literal(v) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, datetime):
        return f"'{v.isoformat(sep=' ')}'"
    if isinstance(v, date):
        return f"'{v.isoformat()}'"
    s = str(v).replace("'", "''")
    return f"'{s}'"


def emit_table(qid_schema: str, table_spec: dict, rows: int, seed: int) -> list[str]:
    table = table_spec["table"]
    columns = table_spec["columns"]
    if not columns:
        return [f"-- skipped {table}: no columns inferred"]

    rng = random.Random(seed)
    column_meta = [(c, *infer_type_role(c)) for c in columns]
    fk_pool: dict = {}

    out = []
    out.append(f"-- Table: {qid_schema}.{table}")
    out.append(f"DROP TABLE IF EXISTS {quote_ident(qid_schema)}.{quote_ident(table)} CASCADE;")
    col_defs = ",\n  ".join(f"{quote_ident(c)} {t}" for c, t, _ in column_meta)
    out.append(
        f"CREATE TABLE {quote_ident(qid_schema)}.{quote_ident(table)} (\n  {col_defs}\n);"
    )

    insert_cols = ", ".join(quote_ident(c) for c, _, _ in column_meta)
    values = []
    for i in range(1, rows + 1):
        row_vals = [
            sql_literal(gen_value(rng, c, role, table, i, fk_pool))
            for c, _, role in column_meta
        ]
        values.append("(" + ", ".join(row_vals) + ")")
    if values:
        # Chunk INSERTs to keep statements readable
        CHUNK = 25
        for k in range(0, len(values), CHUNK):
            chunk = values[k : k + CHUNK]
            out.append(
                f"INSERT INTO {quote_ident(qid_schema)}.{quote_ident(table)} ({insert_cols}) VALUES\n  "
                + ",\n  ".join(chunk)
                + ";"
            )
    return out


def qid_to_schema(qid: str) -> str:
    return "q_" + re.sub(r"[^a-z0-9_]", "_", qid.lower())


def seed_for_qid(qid: str, override: int | None) -> int:
    if override is not None:
        return override
    return int(hashlib.sha256(qid.encode()).hexdigest()[:8], 16)


def build_sql(questions, schemas, qid_filter, company_filter, batch_filter, rows, seed_override, drop):
    out = []
    out.append("-- =========================================================")
    out.append("-- PaddySpeaks SQL Question Bank — Postgres loader")
    out.append("-- One schema per question; tables match the question's schema.")
    out.append("-- =========================================================")
    out.append("")

    selected = []
    for q in questions:
        if q.get("type") and not str(q.get("type", "")).upper().startswith("SQL"):
            continue
        if qid_filter and q["id"] != qid_filter:
            continue
        if company_filter and (q.get("company") or "").lower() != company_filter.lower():
            continue
        if batch_filter and q.get("batch") != batch_filter:
            continue
        if q["id"] not in schemas:
            continue
        selected.append(q)

    if not selected:
        return "-- No questions matched the filters.\n"

    out.append(f"-- {len(selected)} question(s) selected")
    out.append("")

    for q in selected:
        qid = q["id"]
        schema_name = qid_to_schema(qid)
        spec = schemas[qid]
        seed = seed_for_qid(qid, seed_override)

        out.append("")
        out.append("-- " + "─" * 70)
        out.append(f"-- {qid} | {q.get('company','?')} | {q.get('title','?')}")
        out.append("-- " + "─" * 70)
        if drop:
            out.append(f"DROP SCHEMA IF EXISTS {quote_ident(schema_name)} CASCADE;")
        out.append(f"CREATE SCHEMA IF NOT EXISTS {quote_ident(schema_name)};")
        out.append(f"-- Solution: SET search_path TO {schema_name}; -- then run the question's SQL")
        for tbl in spec:
            out.extend(emit_table(schema_name, tbl, rows, seed))
            seed += 1  # vary per table so multi-table schemas get distinct rows

    out.append("")
    out.append(
        "-- Done. To run a specific question's solution, do:\n"
        "--   SET search_path TO q_co_sql_305_0091;\n"
        "--   <paste the question's solution SQL>"
    )
    return "\n".join(out) + "\n"


# ─── CLI ────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(
        description="Load PaddySpeaks SQL questions into Postgres (or dump SQL)."
    )
    ap.add_argument("--qid")
    ap.add_argument("--company")
    ap.add_argument("--batch")
    ap.add_argument("--rows", type=int, default=30)
    ap.add_argument("--seed", type=int)
    ap.add_argument("--drop", action="store_true")
    ap.add_argument("--out", default="paddyspeaks_postgres.sql",
                    help="output file path; '-' for stdout")
    ap.add_argument("--exec", dest="execute", action="store_true",
                    help="execute against --dsn instead of writing a file")
    ap.add_argument("--dsn", help="postgresql:// DSN for --exec")
    args = ap.parse_args()

    questions = json.loads(QUESTIONS_PATH.read_text())
    schemas = json.loads(SCHEMAS_PATH.read_text())

    sql = build_sql(
        questions, schemas,
        args.qid, args.company, args.batch,
        args.rows, args.seed, args.drop,
    )

    if args.execute:
        if not args.dsn:
            print("--exec requires --dsn", file=sys.stderr)
            sys.exit(2)
        try:
            import psycopg
        except ImportError:
            try:
                import psycopg2 as psycopg  # type: ignore
            except ImportError:
                print("Need 'psycopg' or 'psycopg2' for --exec. pip install psycopg[binary]",
                      file=sys.stderr)
                sys.exit(2)
        with psycopg.connect(args.dsn) as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
            conn.commit()
        print(f"Executed against {args.dsn}", file=sys.stderr)
        return

    if args.out == "-":
        sys.stdout.write(sql)
    else:
        out_path = Path(args.out)
        out_path.write_text(sql)
        size_kb = out_path.stat().st_size // 1024
        print(f"Wrote {out_path} ({size_kb} KB)", file=sys.stderr)


if __name__ == "__main__":
    main()
