#!/usr/bin/env python3
"""
Fetch SQL practice problems from vishnu-t-r/sql_solved_questions and
emit them as a question-bank JSON the rest of the pipeline can consume.

The repo is T-SQL (SQL Server) heavy — most solutions use features
that won't run in the in-browser SQLite (CROSS APPLY, STRING_SPLIT,
DATEDIFF(day, …), DECLARE, etc.). The playground already shows a
"This solution uses Snowflake/PostgreSQL/T-SQL features…" banner for
those, so importing them as-is is fine for the question-bank UI;
they're a study reference even when they can't be Run live.

Usage:
  python3 interview/scripts/fetch_community_solved.py
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen, Request

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "interview" / "data" / "community_solved_questions.json"
SRC = "vishnu-t-r/sql_solved_questions"
RAW = f"https://raw.githubusercontent.com/{SRC}/main/"

# Curated list of files known to exist (visible in the repo's tree page).
# Listing them explicitly avoids enumerating 1..191 with many 404s.
FILES = [
    "09_crypto_market_alogorithm_report.sql",
    "10_employees_under_a_given_manager_recursion.sql",
    "11_hierarchy_of_managers_for_a_given_employee_recursion.sql",
    "12_parent_age_when_the_child_was_born_recursion.sql",
    "13_records_of_brands_whose_amount_increase_from_one_year_to_another.sql",
    "14_record_of_brand_whose_amount_increase_every_year_only_increasing_solution_1.sql",
    "15_record_of_brand_whose_amount_increase_every_year_only_increasing_solution_2.sql",
    "16_find_the_average_distance_between_the_locations_solution_1.sql",
    "17_find_the_average_distance_between_the_locations_solution_2.sql",
    "18_find_unique_distance_between_source_and_destination-manage_reverse_pair.sql",
    "100_Counting Instances in Text (stratascratch).sql",
    "101_Most Popular Client_Id Among Users Using Video and Voice Calls (stratascratch).sql",
    "102_City With Most Amenities (stratascratch).sql",
    "103_Cookbook Recipes_display page title like a book (stratascratch).sql",
    "104_Top 5 States With 5 Star Businesses (stratascratch).sql",
    "105_Marketing Campaign Success_Advanced (stratascratch).sql",
    "106_Find the total number of downloads for paying and non-paying users by date (stratascratch).sql",
    "107_number of shipments per month (stratascratch).sql",
    "108_Find the number of times each word appears in drafts_cross apply (stratascratch).sql",
    "109_Identify returning active users (Finding User Purchases-stratascratch).sql",
    "110_Customer order details (stratascratch).sql",
    "111_Apple Product Counts (stratascratch - distinct used along with when).sql",
    "112_Email activity rank (stratascratch).sql",
    "113_Flags per video (stratascratch).sql",
    "114_coding challenge (hackerrank).sql",
    "115_top competitors (hackerrank).sql",
    "116_Project planning (hackerrank).sql",
    "117_Monthly percentage revenue difference (amazon-stratascratch).sql",
    "118_Calculate Users By Average Session Time (stratascratch).sql",
    "119_Calculate Users By Average Session Time (stratascratch)-solution 2.sql",
    "120_5 queries on global companies table (stratascratch).sql",
    "121_New Products_new cars launched in current year (stratascratch).sql",
    "122_Find the percentage of shippable orders (stratascratch).sql",
    "123_Find max customer_id who placed single order.sql",
    "124_Symmetric pairs (hackerrank).sql",
    "125_Election result_who got the most votes and won the election.sql",
    "126_Max transaction amount and ratio_using three methods(window function, cte, subquery).sql",
    "127_Min_max from group and sequence (using row_number function).sql",
    "128_sales amount is greater than or equal to previous year sales (multple year in table).sql",
    "129_comma separated list of mail ids.sql",
    "130_write a query to digitize a result table (2 methods).sql",
    "131_Write a query to get the Running Total of Quantity for each ProductCode.sql",
    "132_write a query to print all the letters of english alphabet.sql",
    "133_query to print all the prime numbers between 1 and 10.sql",
    "134_derive the net balance based on the credit or debit of the amount.sql",
    "135_Write SQL to turn the columns English, Maths, and Science into rows.sql",
    "136_find the trade for the same stock that happened in a range of 10 sec and price difference more than 10 percent.sql",
    "137_derive start_date and end_date column when there is continuous amount in bank balance column.sql",
    "138_find employees who have atleast 3 consecutive salary increase.sql",
    "139_determine the number of consecutive occupied seat IDs and the total count of these seats.sql",
    "140_find total number of rows for all joins (with null values in the table).sql",
    "141_find the missing ids from the input table.sql",
    "142_ display the Source_Phone_Nbr and a flag based on the fisrt and last call.sql",
    "143_display the sequence number from the given range of numbers.sql",
    "144_compare source and target table.sql",
    "145_find the number which is appearing consecutively three or more time.sql",
    "146_find the items which was bought consecutively three or more time.sql",
    "147_write a query to get the output in the given format.sql",
    "148_quote status based on multiple order status (2 methods).sql",
    "149_school seat arrangement by teacher.sql",
    "150_print movie theatre like seating number.sql",
    "152_Aggregate sum of sales country wise and display on maximum in each continents.sql",
    "153_obtain the desired result (using cross join and left join).sql",
    "154_calculate total club reward points (2 methods - string split and cross apply).sql",
    "155_find the app or mode and the count for highest amount of transactions in each location.sql",
    "156_ecommerce frequent customers visiting the app for purchase again and again.sql",
    "157_ecommerce frequent customers visiting the app for purchase again and again (using inner join).sql",
    "158_write a query to print the result for each student (pivot-case statement).sql",
    "159_write a query to calculate the percentage of results using the best of the five rule (unpivot-row_number).sql",
    "160_user purchase platform (mobile-desktop-both) spend per day analysis.sql",
    "161_Find customers who placed more than one distinct product (solved using 2 methods).sql",
    "162_conversion rate from visitors to customers.sql",
    "163_find avg order value given customer placed more than 5 orders.sql",
    "164_days between shipped and delivered order date.sql",
    "165_analyze the frequency of rides during peak hours and non-peak hours.sql",
    "166_top 3 customers who spent the most in their first month of making an order.sql",
    "167_analyzing product sales growth (scenario based interview question).sql",
    "168_calculate the moving average of a stock price.sql",
    "169_query to Find Consecutive Days with Increasing Stock Prices.sql",
    "170_produces a comma separated list of passengers in the lift.sql",
    "171_obatin the output in the required format.sql",
    "172_find 20 percent products that contribute to 80 percent sales.sql",
    "173_customers who have placed more than one order and the total amount spent by them(2 methods).sql",
    "174_identify patients who may elevated average heart rate and low physical activity.sql",
    "175_find the most expensive ('Exp_Product') and the least expensive ('Che_Product') product using first_value and last_value.sql",
    "176-find customers who made more than 3 transactions within any 1-hour window.sql",
    "178_find the top 2 products that generate the most revenue per unique user.sql",
    "179_Find Customers with Consecutive Purchases.sql",
    "180_find all pairs of cities where the distance between them is mutual.sql",
    "181_find all flights where at least two passengers have confirmed reservations in adjacent seats.sql",
    "182_find the highest SaleAmount for each ProductID using correlated sub query.sql",
    "183_Find the delivery drivers who have delivered all types of packages available in the system.sql",
    "184_calculate the balance for each account on a daily basis.sql",
    "185_generate a report where you transform the data in the given format (string agg, like clause).sql",
    "186_calculate the average subscription duration, subscription gap and the average amount paid per subscription for each customer.sql",
    "187_most streamed songs overall, regardless of the subscription type.sql",
    "188_review rating for products.sql",
    "189_average review rating and top performing products.sql",
    "190_find the longest sequence of consecutive days a customer placed orders.sql",
    "191_identify customers who have viewed the same product for more than 3 consecutive days.sql",
]


def fetch(filename):
    # `safe=''` so apostrophes/parens in filenames are also percent-encoded —
    # raw.githubusercontent rejects unencoded `'` in some paths.
    url = RAW + quote(filename, safe="")
    req = Request(url, headers={"User-Agent": "paddyspeaks-bot"})
    with urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8", errors="replace")


def derive_title(filename):
    """09_crypto_market_alogorithm_report.sql → Crypto Market Alogorithm Report"""
    stem = filename
    if stem.endswith(".sql"):
        stem = stem[:-4]
    stem = re.sub(r"^[\d\-_]+", "", stem)
    stem = stem.strip().strip("_- ")
    # Drop trailing "(stratascratch)" / "(hackerrank)" platform tag
    stem = re.sub(r"\s*\([^)]+\)\s*$", "", stem)
    # Drop "- solution 2" / "_solution_2" / "Solution 2" decorations
    stem = re.sub(r"[\s\-_]+solution[\s_]*\d+\s*$", "", stem, flags=re.IGNORECASE)
    parts = re.split(r"[_\s]+", stem)
    title = " ".join(w.capitalize() if not w.isupper() else w for w in parts if w)
    return title or stem


def derive_subtopic(text, filename):
    f = filename.lower()
    t = text.lower()
    if "recursion" in f or "recursive" in t:
        return "Recursion / CTEs"
    if "row_number" in t or "rank()" in t or "dense_rank" in t or "lag(" in t or "lead(" in t:
        return "Window functions"
    if "pivot" in f or "pivot" in t or "unpivot" in t:
        return "Pivot / Unpivot"
    if "cross apply" in t or "string_split" in t:
        return "String / array split"
    if "datediff" in t or "consecutive" in f or "running total" in f:
        return "Date / sequence"
    if "join" in f or " join " in t:
        return "Joins"
    if "group by" in t and ("having" in t or "count(" in t):
        return "Aggregation"
    return None


def derive_difficulty(text, subtopic):
    code = text
    if subtopic in ("Recursion / CTEs", "Pivot / Unpivot"):
        return "Hard"
    if "with " in code.lower() and code.lower().count("with ") >= 2:
        return "Hard"
    if "row_number" in code.lower() or "lag(" in code.lower() or "lead(" in code.lower():
        return "Hard"
    if "join" in code.lower() and "group by" in code.lower():
        return "Medium"
    if "case when" in code.lower() or "having " in code.lower():
        return "Medium"
    return "Easy"


# Match a question block: /* ... */ with at least 30 chars and not a CREATE
# TABLE / INSERT block. The schema block is also captured separately.
QBLOCK_RE = re.compile(r"/\*\s*([\s\S]*?)\*/", re.M)
# Match `CREATE TABLE name` and capture the open paren — body is extracted
# with a manual paren-balanced scan because column types like
# `varchar(255)` introduce nested parens that a non-greedy regex can't
# handle correctly.
TABLE_HEAD_RE = re.compile(
    r"create\s+table\s+(\w+)\s*\(",
    re.IGNORECASE,
)


def _matched_body(text, start):
    """Return the substring inside parens starting at index `start` (the
    position of the opening `(`)."""
    depth = 0
    for i in range(start, len(text)):
        c = text[i]
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return text[start + 1: i]
    return None
USE_RE = re.compile(r"^\s*use\s+\w+\s*;?\s*", re.IGNORECASE | re.M)


def looks_like_sql(blob):
    """Heuristic: does this comment block contain real SQL keywords?"""
    if not blob:
        return False
    up = blob.upper()
    sql_kws = ("SELECT ", "INSERT INTO", "CREATE TABLE", "UPDATE ", "DELETE FROM",
               "WITH ", "FROM ", "JOIN ", "WHERE ", "GROUP BY")
    hits = sum(1 for kw in sql_kws if kw in up)
    return hits >= 2


def extract_leading_dashes(text):
    """Pick up leading '--' comment lines as the question text. Skip the
    purely-decorative ones ('--solution 2 different approach', '--table ->
    brand_amount', etc.) and keep only the first contiguous block of
    explanatory lines."""
    lines = []
    for raw in text.splitlines():
        stripped = raw.strip()
        if not stripped:
            if lines:
                break  # blank line ends the leading comment block
            continue
        if stripped.startswith("--"):
            content = stripped.lstrip("- ").strip()
            if content:
                lines.append(content)
        else:
            break
    # Drop housekeeping crumbs that aren't part of the question
    cleaned = []
    for ln in lines:
        low = ln.lower()
        if low.startswith(("solution_", "solution ", "table ->", "method ", "approach")):
            continue
        if low in ("begin", "end"):
            continue
        cleaned.append(ln)
    return "\n".join(cleaned).strip()


def strip_decorative(sol):
    """Remove begin/end wrappers, USE statements, and leading commented-out
    debug SELECTs so the solution shows real working code."""
    sol = re.sub(r"^\s*begin\b\s*", "", sol, flags=re.IGNORECASE)
    sol = re.sub(r"\bend\s*;?\s*$", "", sol, flags=re.IGNORECASE)
    return sol.strip()


def parse_file(filename, text):
    text = USE_RE.sub("", text)

    qblocks = QBLOCK_RE.findall(text)
    sql_only = QBLOCK_RE.sub("", text)

    # ─── schema from any CREATE TABLE inside comments ───
    tables = []
    for blk in qblocks:
        for m in TABLE_HEAD_RE.finditer(blk):
            name = m.group(1)
            body = _matched_body(blk, m.end() - 1)
            if body is None:
                continue
            # Split top-level commas only (skip nested parens like varchar(255)).
            parts, depth, cur = [], 0, ""
            for ch in body:
                if ch == "(":
                    depth += 1; cur += ch
                elif ch == ")":
                    depth -= 1; cur += ch
                elif ch == "," and depth == 0:
                    parts.append(cur); cur = ""
                else:
                    cur += ch
            if cur.strip():
                parts.append(cur)
            col_names = []
            for line in parts:
                line = re.sub(r"--[^\n]*", "", line).strip()
                if not line or line.lower().startswith(("foreign key", "primary key", "constraint")):
                    continue
                tok = re.match(r"([A-Za-z_][A-Za-z0-9_]*)", line)
                if tok:
                    col_names.append(tok.group(1))
            if col_names:
                tables.append((name, col_names))
    schema = ", ".join(f"{n}({', '.join(cs)})" for n, cs in tables) if tables else None

    # ─── question text ───
    # 1. Leading `-- ...` block describes the problem in plain English.
    question_text = extract_leading_dashes(text)
    # 2. Otherwise, the first /* ... */ that doesn't contain SQL/DDL.
    if not question_text:
        for blk in qblocks:
            low = blk.lower()
            if "create table" in low or "insert into" in low or looks_like_sql(blk):
                continue
            if len(blk.strip()) >= 30:
                question_text = blk.strip()
                break

    # ─── solution: keep all SQL outside /* */ blocks ───
    solution = strip_decorative(sql_only)

    return question_text, schema, solution


def main():
    out = []
    failed = []
    for i, fn in enumerate(FILES, 1):
        try:
            text = fetch(fn)
        except Exception as e:
            failed.append((fn, str(e)))
            continue
        try:
            qtext, schema, sol = parse_file(fn, text)
            if not sol:
                failed.append((fn, "no solution body"))
                continue
            title = derive_title(fn)
            subtopic = derive_subtopic(text, fn)
            difficulty = derive_difficulty(sol, subtopic)
            qid = f"community_solved-{i:04d}"
            entry = {
                "id": qid,
                "batch": "community_solved",
                "num": i,
                "title": title,
                "slug": re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-"),
                "company": "Community",
                "type": "SQL / " + (subtopic or "Solved"),
                "subtopic": subtopic,
                "difficulty": difficulty,
                "language": "sql",
                "schema": schema,
                "solution": sol,
                "source": {
                    "name": SRC,
                    "url": f"https://github.com/{SRC}/blob/main/{quote(fn)}",
                },
            }
            if qtext:
                entry["question"] = qtext
            out.append(entry)
        except Exception as e:
            failed.append((fn, f"parse failed: {e}"))
        # be polite to the CDN
        if i % 25 == 0:
            time.sleep(0.5)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"Fetched & parsed {len(out)} questions → {OUT.relative_to(ROOT)}")
    if failed:
        print(f"\n{len(failed)} failures:")
        for fn, msg in failed[:20]:
            print(f"  {fn}: {msg}")


if __name__ == "__main__":
    main()
