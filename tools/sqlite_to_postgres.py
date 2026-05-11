"""Translate SQLite-isms in solution SQL to portable Postgres equivalents.
Categorizes questions into:
  EASY    — translation rules cover everything; safe to flip runtime
  MEDIUM  — has features we don't auto-translate (RECURSIVE, PIVOT, etc.);
            needs agent review
  ALREADY — pure ANSI; just flip runtime: 'non-sqlite' -> 'postgres'
"""
import json, re

# SQLite → Postgres translation rules. ALL must be safe transformations
# (no semantic change).
RULES = [
    # date(col, '+N days') → col + INTERVAL 'N days'
    (re.compile(r"date\s*\(\s*([a-zA-Z_][\w.]*)\s*,\s*'(\+|-)?(\d+)\s+days?'\s*\)", re.I),
     lambda m: f"({m.group(1)} + INTERVAL '{m.group(2) or ''}{m.group(3)} days')"),
    # date(col, '+N months') → col + INTERVAL 'N months'
    (re.compile(r"date\s*\(\s*([a-zA-Z_][\w.]*)\s*,\s*'(\+|-)?(\d+)\s+months?'\s*\)", re.I),
     lambda m: f"({m.group(1)} + INTERVAL '{m.group(2) or ''}{m.group(3)} months')"),
    # date(col, '+N years') → col + INTERVAL 'N years'
    (re.compile(r"date\s*\(\s*([a-zA-Z_][\w.]*)\s*,\s*'(\+|-)?(\d+)\s+years?'\s*\)", re.I),
     lambda m: f"({m.group(1)} + INTERVAL '{m.group(2) or ''}{m.group(3)} years')"),
    # strftime('%Y-%m', col) → to_char(col, 'YYYY-MM')
    (re.compile(r"strftime\s*\(\s*'%Y-%m'\s*,\s*([^)]+)\)", re.I),
     lambda m: f"to_char({m.group(1).strip()}, 'YYYY-MM')"),
    # strftime('%Y', col) → to_char(col, 'YYYY')
    (re.compile(r"strftime\s*\(\s*'%Y'\s*,\s*([^)]+)\)", re.I),
     lambda m: f"to_char({m.group(1).strip()}, 'YYYY')"),
    # strftime('%m', col) → to_char(col, 'MM')
    (re.compile(r"strftime\s*\(\s*'%m'\s*,\s*([^)]+)\)", re.I),
     lambda m: f"to_char({m.group(1).strip()}, 'MM')"),
    # julianday(a) - julianday(b) → EXTRACT(DAY FROM a::timestamp - b::timestamp)
    (re.compile(r"julianday\s*\(([^)]+)\)\s*-\s*julianday\s*\(([^)]+)\)", re.I),
     lambda m: f"EXTRACT(DAY FROM ({m.group(1).strip()})::timestamp - ({m.group(2).strip()})::timestamp)"),
    # IFF → CASE WHEN (only the common 3-arg form)
    (re.compile(r"\bIFF\s*\(([^,]+),\s*([^,]+),\s*([^)]+)\)", re.I),
     lambda m: f"CASE WHEN {m.group(1)} THEN {m.group(2)} ELSE {m.group(3)} END"),
    # DATEDIFF(a, b) → (a::date - b::date)  (MySQL → Postgres)
    (re.compile(r"DATEDIFF\s*\(([^,]+),\s*([^)]+)\)", re.I),
     lambda m: f"(({m.group(1).strip()})::date - ({m.group(2).strip()})::date)"),
    # CURRENT_DATE in SQLite is fine; Postgres also has it. No change needed.
    # LIMIT N OFFSET M is portable.
]

# Features that block auto-translation — needs agent review
BLOCKERS = [
    (r'\brecursive\b', 'WITH RECURSIVE'),
    (r'\bpivot\b', 'PIVOT syntax'),
    (r'\bgroup_concat\b', 'GROUP_CONCAT (MySQL)'),
    (r'\bunnest\b', 'UNNEST (use carefully on Postgres)'),
    (r'\$\$', 'PL/pgSQL or dollar-quoted strings'),
    (r'PREPARE\s+', 'PREPARE stmt'),
    (r'EXECUTE\s+', 'EXECUTE stmt'),
    (r'\bDECLARE\b', 'DECLARE (procedural)'),
    (r'@\w+\s*:=', 'MySQL @var assignment'),
    (r'\bSET\s+@', 'MySQL SET @var'),
    (r'%[ymdhMSEY]', 'strftime format codes (other than already-translated)'),
    (r'\bjson_extract\b|\bjson_each\b', 'SQLite JSON functions'),
]

def translate(sql):
    """Apply rules; return (new_sql, changed_count)."""
    new = sql
    total = 0
    for rx, fn in RULES:
        new, n = rx.subn(fn, new)
        total += n
    return new, total

def blockers_in(sql):
    found = []
    for rx, label in BLOCKERS:
        if re.search(rx, sql, re.I):
            found.append(label)
    return found

def main():
    with open('interview/data/questions.json') as f: qs = json.load(f)
    cats = {'ALREADY_PORTABLE': [], 'EASY_TRANSLATE': [], 'MEDIUM_BLOCKERS': []}
    for q in qs:
        if q.get('runtime') != 'non-sqlite': continue
        sol = q.get('solution', '') or ''
        if not sol.strip(): continue
        new_sol, n_translated = translate(sol)
        blocks = blockers_in(new_sol)
        if blocks:
            cats['MEDIUM_BLOCKERS'].append((q['id'], blocks, n_translated))
        elif n_translated == 0:
            cats['ALREADY_PORTABLE'].append(q['id'])
        else:
            cats['EASY_TRANSLATE'].append((q['id'], n_translated))

    print(f"=== Categorization of 204 non-sqlite questions ===\n")
    print(f"ALREADY_PORTABLE (just flip runtime):  {len(cats['ALREADY_PORTABLE'])}")
    print(f"EASY_TRANSLATE (auto-translate works): {len(cats['EASY_TRANSLATE'])}")
    print(f"MEDIUM_BLOCKERS (needs agent review):  {len(cats['MEDIUM_BLOCKERS'])}")

    print("\nSample EASY_TRANSLATE:")
    for qid, n in cats['EASY_TRANSLATE'][:5]:
        print(f"  {qid} ({n} substitutions)")

    print("\nSample MEDIUM_BLOCKERS (top blockers):")
    for qid, blocks, n in cats['MEDIUM_BLOCKERS'][:8]:
        print(f"  {qid}: {blocks}")

    return cats

if __name__ == '__main__':
    cats = main()

# ─── Additional MySQL → Postgres rules ──────────────────────────────
# Mutates the RULES list at module load. Safe transformations only.
import re as _re

EXTRA_RULES = [
    # IFNULL(a, b) → COALESCE(a, b)
    (_re.compile(r"\bIFNULL\s*\(", _re.I), lambda m: "COALESCE("),
    # ISNULL(a) → (a IS NULL)
    (_re.compile(r"\bISNULL\s*\(\s*([^)]+)\)", _re.I),
     lambda m: f"({m.group(1).strip()} IS NULL)"),
    # MySQL DATE_FORMAT(col, '%Y-%m') → to_char(col, 'YYYY-MM')
    (_re.compile(r"DATE_FORMAT\s*\(\s*([^,]+),\s*'%Y-%m'\s*\)", _re.I),
     lambda m: f"to_char({m.group(1).strip()}, 'YYYY-MM')"),
    (_re.compile(r"DATE_FORMAT\s*\(\s*([^,]+),\s*'%Y-%m-%d'\s*\)", _re.I),
     lambda m: f"to_char({m.group(1).strip()}, 'YYYY-MM-DD')"),
    (_re.compile(r"DATE_FORMAT\s*\(\s*([^,]+),\s*'%Y'\s*\)", _re.I),
     lambda m: f"to_char({m.group(1).strip()}, 'YYYY')"),
    (_re.compile(r"DATE_FORMAT\s*\(\s*([^,]+),\s*'%m'\s*\)", _re.I),
     lambda m: f"to_char({m.group(1).strip()}, 'MM')"),
    # `backtick` identifiers → "double-quoted"
    (_re.compile(r"`([^`]+)`"),
     lambda m: f'"{m.group(1)}"'),
    # SQLite date('now') → CURRENT_DATE
    (_re.compile(r"date\s*\(\s*'now'\s*\)", _re.I),
     lambda m: "CURRENT_DATE"),
    # SQLite date(col, '+N day') (singular) → already handled by the day(s) rule
    # YEAR(col) MySQL → EXTRACT(YEAR FROM col)
    (_re.compile(r"\bYEAR\s*\(\s*([a-zA-Z_][\w.]*)\s*\)", _re.I),
     lambda m: f"EXTRACT(YEAR FROM {m.group(1)})"),
    (_re.compile(r"\bMONTH\s*\(\s*([a-zA-Z_][\w.]*)\s*\)", _re.I),
     lambda m: f"EXTRACT(MONTH FROM {m.group(1)})"),
    (_re.compile(r"\bDAY\s*\(\s*([a-zA-Z_][\w.]*)\s*\)", _re.I),
     lambda m: f"EXTRACT(DAY FROM {m.group(1)})"),
]
RULES.extend(EXTRA_RULES)

# Block list — features that we don't try to translate
EXTRA_BLOCKERS = [
    (r'\bdate_add\b', 'DATE_ADD (MySQL)'),
    (r'\bdate_sub\b', 'DATE_SUB (MySQL)'),
    (r'\btimestampdiff\b', 'TIMESTAMPDIFF (MySQL)'),
]
BLOCKERS.extend(EXTRA_BLOCKERS)
