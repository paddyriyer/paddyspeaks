#!/usr/bin/env python3
"""
Parse the `schema` field of each SQL question into a structured spec the SQL
playground can use to generate per-question sample tables.

The parser is forgiving — it handles:
  - canonical:   orders(order_id, customer_id, order_total)
  - aliased:     orders(o), customers(c), products(p) via order_items(order_id, product_id)
  - same-shape:  sales_2024, sales_2025 (same shape)
  - bare list:   customers, orders, products via order_items

When the schema text is too loose, the parser falls back to scanning the SQL
solution for FROM/JOIN tables and ``alias.column`` references.

Output: interview/data/question_schemas.json
  { "<qid>": [ { "table": "orders", "columns": ["order_id", ...] }, ... ] }
"""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
QUESTIONS = ROOT / "interview" / "data" / "questions.json"
OUT = ROOT / "interview" / "data" / "question_schemas.json"
COVERAGE = ROOT / "interview" / "data" / "table_coverage.json"

TABLE_DECL_RE = re.compile(r"([A-Za-z_][A-Za-z0-9_]*)\s*\(([^()]*)\)")
SQL_TABLE_RE = re.compile(
    r"(?:FROM|JOIN|UPDATE|INTO)\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+(?:AS\s+)?([A-Za-z_][A-Za-z0-9_]*))?",
    re.IGNORECASE,
)
ALIAS_COL_RE = re.compile(r"\b([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\b")
CTE_RE = re.compile(
    r"(?:WITH\s+(?:RECURSIVE\s+)?|,\s*)([A-Za-z_][A-Za-z0-9_]*)\s+AS\s*\(",
    re.IGNORECASE,
)
SAME_SHAPE_RE = re.compile(r"\(same shape\)", re.IGNORECASE)
VIA_RE = re.compile(r"\bvia\s+", re.IGNORECASE)

SQL_KEYWORDS = {
    "select", "from", "where", "group", "order", "by", "having", "limit",
    "offset", "join", "inner", "left", "right", "outer", "full", "cross",
    "natural", "on", "using", "and", "or", "not", "as", "union", "intersect",
    "except", "all", "distinct", "case", "when", "then", "else", "end",
    "with", "recursive", "into", "update", "insert", "values", "set",
    "delete", "exists", "in", "is", "null", "true", "false", "asc", "desc",
    "between", "like", "ilike", "any", "some", "fetch", "first", "next",
    "rows", "row", "window", "qualify", "filter", "within",
}


def is_real_column(token: str, *, allow_short: bool = False) -> bool:
    """
    A column candidate. Inside a structured schema like ``daily_sales(d,
    region, amount)`` we accept short identifiers because the surrounding
    parens make it clear they're columns, not table aliases. Outside that
    context (e.g. when probing schema-text fragments) we still filter
    1–2-letter tokens as likely aliases.
    """
    t = token.strip()
    if not t:
        return False
    # Strip a trailing SQL type annotation like 'amount NUMERIC' or
    # 'price DECIMAL(10,2)'.
    if " " in t:
        t = t.split()[0]
    if not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", t):
        return False
    if not allow_short and len(t) <= 2 and "_" not in t:
        return False
    return True


def is_table_token(t: str) -> bool:
    if not t or not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", t):
        return False
    if t.lower() in SQL_KEYWORDS:
        return False
    if len(t) <= 1:
        return False
    return True


def parse_structured(schema: str):
    """Return list of {table, columns} from canonical name(cols) syntax."""
    out = []
    seen = set()
    for m in TABLE_DECL_RE.finditer(schema or ""):
        table = m.group(1)
        if not is_table_token(table):
            continue
        raw = [c.strip() for c in m.group(2).split(",")]
        cols = []
        for c in raw:
            # Inside a structured schema we trust short column names —
            # `daily_sales(d, region, amount)` should keep `d` as a column.
            if is_real_column(c, allow_short=True):
                # Drop any trailing type annotation like ' NUMERIC' or
                # ' DECIMAL(10,2)' that the source workbook sometimes adds.
                name = c.split()[0]
                if name not in cols:
                    cols.append(name)
        if (table, tuple(cols)) in seen:
            continue
        seen.add((table, tuple(cols)))
        out.append({"table": table, "columns": cols})
    return out


def parse_bare_table_names(schema: str, already: set):
    """
    From schema text like ``customers, orders, products via order_items`` or
    ``sales_2024, sales_2025 (same shape)`` extract table names that aren't
    already captured as structured tables.
    """
    if not schema:
        return []
    # Strip everything inside parens (we already handled those)
    bare = re.sub(r"\([^)]*\)", "", schema)
    bare = bare.replace(" via ", ", ").replace(" VIA ", ", ")
    candidates = re.split(r"[,\s]+", bare)
    out = []
    for c in candidates:
        c = c.strip().strip(".")
        if not c or c.lower() in {"and", "via", "or", "with", "the", "a", "an", "for", "of"}:
            continue
        if not is_table_token(c):
            continue
        if c in already or c in [t["table"] for t in out]:
            continue
        out.append({"table": c, "columns": []})
    return out


SQL_FUNCS = {
    "sum", "avg", "min", "max", "count", "extract", "year", "month", "day",
    "hour", "minute", "second", "date", "time", "timestamp", "interval",
    "cast", "coalesce", "ifnull", "nullif", "length", "lower", "upper",
    "trim", "round", "floor", "ceil", "abs", "concat", "substr", "substring",
    "replace", "lag", "lead", "row_number", "rank", "dense_rank", "ntile",
    "over", "partition", "median", "stddev", "variance", "string_agg",
    "array_agg", "regexp_replace", "to_date", "to_char", "yr", "mo", "hr",
    "today", "current_date", "current_timestamp", "now", "dayofweek",
    "dayofmonth", "dayofyear", "weekofyear", "datediff", "date_trunc",
    "date_add", "date_sub", "date_format", "from_unixtime", "unix_timestamp",
    "percentile_cont", "percentile_disc", "approx_count_distinct", "listagg",
    "json_extract", "json_value", "tablesample", "explode", "lateral",
    "true", "false",
}

ALIAS_AS_RE = re.compile(r"\bAS\s+([A-Za-z_][A-Za-z0-9_]*)", re.IGNORECASE)


def extract_bare_columns(sql: str, alias_cols: dict) -> set:
    """
    Scan the SQL for bare identifiers that are likely column names but weren't
    captured via alias.col. Filters out keywords, function names, output
    aliases (AS x), numbers, and string literals.
    """
    if not sql:
        return set()
    cleaned = re.sub(r"'[^']*'", "", sql)
    cleaned = re.sub(r'"[^"]*"', "", cleaned)
    cleaned = re.sub(r"--.*", "", cleaned)

    # Total occurrences of each token (case-insensitive). A name introduced
    # by ``AS x`` is treated as a pure output alias only when it doesn't
    # appear elsewhere — otherwise it's also a column reference, e.g.
    # ``COALESCE(bonus, 0) AS bonus``.
    occ = {}
    for m in re.finditer(r"\b([A-Za-z_][A-Za-z0-9_]*)\b", cleaned):
        occ[m.group(1).lower()] = occ.get(m.group(1).lower(), 0) + 1

    output_aliases = set()
    for m in ALIAS_AS_RE.finditer(cleaned):
        a = m.group(1).lower()
        if occ.get(a, 0) <= 1:
            output_aliases.add(a)
    captured_cols = {c.lower() for cs in alias_cols.values() for c in cs}

    candidates = set()
    for m in re.finditer(r"\b([A-Za-z_][A-Za-z0-9_]*)\b", cleaned):
        tok = m.group(1)
        low = tok.lower()
        if low in SQL_KEYWORDS:
            continue
        if low in output_aliases:
            continue
        if len(tok) <= 1:
            continue
        # SQL function names get filtered ONLY when used as a function call
        # (i.e., immediately followed by `(`). `year` next to `(` is a
        # function; `year` standalone is a column.
        if low in SQL_FUNCS:
            after = cleaned[m.end():m.end() + 8].lstrip()
            if after.startswith("("):
                continue
        # All-caps tokens longer than 2 chars are almost always SQL
        # keywords/functions we haven't enumerated, not column names.
        if tok.isupper() and len(tok) > 2 and "_" not in tok[1:]:
            continue
        # Same with all-caps + underscores e.g. CONCAT_WS, REGEXP_MATCHES
        if tok.isupper() and "_" in tok and len(tok) > 3:
            continue
        candidates.add(tok)
    return candidates


def parse_sql_solution(sql: str):
    """
    From the SQL solution, extract:
      (a) table names referenced via FROM/JOIN minus CTEs
      (b) alias.column references grouped by table
      (c) the set of likely bare-column identifiers (when no alias was used)
    """
    if not sql:
        return [], {}, set()

    cte_names = {m.group(1).lower() for m in CTE_RE.finditer(sql)}

    table_refs = []
    alias_to_table: dict[str, str] = {}
    for m in SQL_TABLE_RE.finditer(sql):
        t, a = m.group(1), m.group(2)
        if not is_table_token(t):
            continue
        if t.lower() in cte_names:
            continue
        if t not in table_refs:
            table_refs.append(t)
        alias_to_table.setdefault(t.lower(), t)
        if a and a.lower() not in SQL_KEYWORDS and a.lower() not in cte_names:
            alias_to_table[a.lower()] = t

    cols_by_table: dict[str, set] = {}
    for m in ALIAS_COL_RE.finditer(sql):
        a, c = m.group(1).lower(), m.group(2)
        if a in alias_to_table:
            t = alias_to_table[a]
            cols_by_table.setdefault(t, set()).add(c)

    # Filter out alias names + table names from bare candidates.
    bare = extract_bare_columns(sql, cols_by_table)
    not_cols = {t.lower() for t in table_refs} | set(alias_to_table.keys())
    bare = {b for b in bare if b.lower() not in not_cols}

    return table_refs, cols_by_table, bare


def merge_specs(structured, bare, sql_tables, sql_cols, bare_cols=None):
    """
    Merge sources, preserving structured order. Structured columns are kept;
    bare/sql tables get their columns from sql_cols (alias.col references).
    Tables marked '(same shape)' inherit from the first canonical neighbour.
    """
    by_table: dict[str, dict] = {}
    order: list[str] = []

    def add(table, cols=None):
        if table not in by_table:
            by_table[table] = {"table": table, "columns": list(cols or [])}
            order.append(table)
        else:
            existing = by_table[table]["columns"]
            for c in cols or []:
                if c not in existing:
                    existing.append(c)

    for s in structured:
        add(s["table"], s["columns"])
    for s in bare:
        add(s["table"], s["columns"])
    for t in sql_tables:
        cols = sorted(sql_cols.get(t, []))
        add(t, cols)

    # Augment columns from solution for tables already present
    for t, cols in sql_cols.items():
        if t in by_table:
            for c in sorted(cols):
                if c not in by_table[t]["columns"]:
                    by_table[t]["columns"].append(c)

    # Same-shape: any table with no columns inherits from the first sibling
    # that DOES have columns (best-effort).
    canonical_cols = next(
        (by_table[t]["columns"] for t in order if by_table[t]["columns"]), []
    )
    if canonical_cols:
        for t in order:
            if not by_table[t]["columns"]:
                by_table[t]["columns"] = list(canonical_cols)

    # If we have bare columns extracted from the SQL but no alias coverage
    # (e.g. `SELECT SUM(amount) FROM sales_2024 UNION ALL ... FROM sales_2025`),
    # broadcast those columns to tables that share the shape.
    if bare_cols:
        for t in order:
            cols = by_table[t]["columns"]
            for b in sorted(bare_cols):
                if b not in cols:
                    cols.append(b)

    return [by_table[t] for t in order]


def parse_question(q: dict):
    schema = q.get("schema") or ""
    sol = q.get("solution") or ""
    structured = parse_structured(schema)
    already = {s["table"] for s in structured}
    bare_tables = parse_bare_table_names(schema, already)
    sql_tables, sql_cols, bare_cols = parse_sql_solution(sol)

    # Decide whether to broadcast bare columns:
    # - structured tables already have explicit columns, leave them alone
    # - but for bare tables (e.g. `sales_2024, sales_2025 (same shape)`),
    #   single-table questions, or tables only known via the SQL solution,
    #   broadcasting catches columns the schema text omitted (`order_date`,
    #   `amount`, `bonus`, `year`, `ts`, …) so the synthetic table actually
    #   has every column the reference solution touches.
    broadcast = None
    distinct_tables = len({s["table"] for s in structured} | {s["table"] for s in bare_tables} | set(sql_tables))
    if not structured and (bare_tables or sql_tables):
        broadcast = bare_cols
    elif structured and bare_tables:
        broadcast = bare_cols
    elif distinct_tables == 1 and bare_cols:
        # Single-table query: any bare identifier almost certainly belongs
        # to that one table.
        broadcast = bare_cols

    spec = merge_specs(structured, bare_tables, sql_tables, sql_cols, broadcast)
    # Drop tables with empty columns AND no SQL evidence (likely junk parse)
    spec = [
        s for s in spec
        if s["columns"] or s["table"] in sql_tables or s["table"] in already
    ]
    for s in spec:
        if not s["columns"]:
            s["columns"] = ["id", "name", "value"]
    return spec


def main():
    questions = json.loads(QUESTIONS.read_text())
    out = {}
    table_freq = Counter()
    for q in questions:
        if q.get("language") != "sql":
            continue
        spec = parse_question(q)
        if not spec:
            continue
        out[q["id"]] = spec
        for s in spec:
            table_freq[s["table"]] += 1

    union_cols: dict[str, set] = {}
    for spec in out.values():
        for s in spec:
            union_cols.setdefault(s["table"], set()).update(s["columns"])
    coverage = sorted(
        [
            {"table": t, "questions": table_freq[t], "columns": sorted(union_cols[t])}
            for t in union_cols
        ],
        key=lambda r: -r["questions"],
    )

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    COVERAGE.write_text(json.dumps(coverage, ensure_ascii=False, indent=2))

    print(f"Wrote {len(out)} question→schema entries to {OUT.relative_to(ROOT)}")
    print(f"Wrote {len(coverage)} table coverage rows to {COVERAGE.relative_to(ROOT)}")
    print("\nTop 15 tables across questions:")
    for row in coverage[:15]:
        print(f"  {row['table']:24s} {row['questions']:4d} qs · cols: {row['columns'][:8]}")


if __name__ == "__main__":
    main()
