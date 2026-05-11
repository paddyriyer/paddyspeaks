"""Comprehensive question-bank audit. Scores every question across 10
quality dimensions and emits a prioritized worklist.

Dimensions (severity in parens):
  P0 — runtime won't execute the question at all
    1. runtime: non-sqlite (skipped from PGlite)
    2. PGlite ERR (already audited via /tmp/pglite-audit)
    3. Empty solution

  P1 — content is misleading or unrunnable for the user
    4. Multiple solution methods with comments suggesting one
       method is bad (e.g. user sees a `--method 1` that fails)
    5. SQL references columns not in schema (alias.col gap)
    6. Schema has ghost columns (SQL keywords, single letters, etc.)
    7. Schema text doesn't match the structured spec

  P2 — quality / completeness
    8. Empty or stub `question` field
    9. No enrichment HTML
   10. Title is a slug-style placeholder
"""
import json, re, os, glob
from collections import defaultdict

SQL_KEYWORDS = {
    'select','from','where','group','order','by','having','join','left','right','inner','outer','full','cross','on','using',
    'and','or','not','null','true','false','as','in','exists','between','like','ilike','is','distinct','case','when','then','else','end',
    'with','recursive','union','all','intersect','except','limit','offset','asc','desc','nulls','first','last',
    'partition','over','rows','range','preceding','following','current','row','unbounded',
    'cast','coalesce','nullif','sum','count','avg','min','max','round','abs','floor','ceil','greatest','least',
    'lag','lead','rank','dense_rank','row_number','ntile','first_value','last_value','nth_value',
    'extract','date_trunc','date_part','date','time','timestamp','interval','to_char','to_date','to_timestamp',
    'concat','substring','substr','trim','upper','lower','length','char_length','position',
    'string_agg','array_agg','filter','within','grouping','sets','cube','rollup',
    'create','drop','table','if','insert','into','values','update','set','delete','truncate','alter','add','column',
    'primary','key','foreign','references','default','int','integer','bigint','smallint','numeric','decimal',
    'text','varchar','char','boolean','bool','real','double','precision',
    'returning','conflict','do','nothing','excluded',
    'epoch','julianday','strftime','iif','generate_series',
}

# Ghost-column shapes — columns that almost certainly shouldn't exist
GHOST_PATTERNS = [
    r'^[a-z]$',                     # single letters except in specific tables
    r'^[A-Z]+$',                    # ALL_CAPS likely a misread SQL keyword
    r'^_+',                         # leading underscore-only
    r'^[0-9]',                      # starts with digit
]
GHOST_EXACT = {'if', 'as', 'in', 'on', 'or', 'and', 'is', 'by', 'do', 'to'}

def strip_strings(sql):
    s = re.sub(r'--.*$', '', sql, flags=re.M)
    s = re.sub(r'/\*[\s\S]*?\*/', '', s)
    s = re.sub(r"'(?:''|\\'|[^'])*'", "''", s)
    s = re.sub(r'"(?:""|\\"|[^"])*"', '""', s)
    return s

def alias_map(sql, schema_tables):
    cleaned = strip_strings(sql)
    schema_set = {t.lower() for t in schema_tables}
    out = {}
    for m in re.finditer(r'\b(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+(?:AS\s+)?([a-zA-Z_][a-zA-Z0-9_]*))?', cleaned, re.I):
        tbl = m.group(1).lower()
        if tbl in schema_set:
            out[tbl] = tbl
            if m.group(2):
                ali = m.group(2).lower()
                if ali not in SQL_KEYWORDS:
                    out[ali] = tbl
    return out

def cte_names(sql):
    cleaned = strip_strings(sql)
    names = set()
    for m in re.finditer(r'\b(?:WITH|,)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+AS\s*\(', cleaned, re.I):
        names.add(m.group(1).lower())
    return names

def check_question(q, schemas, enrichment_files):
    qid = q['id']
    issues = []
    spec = schemas.get(qid, [])
    sol = q.get('solution', '') or ''
    sol_low = sol.lower()
    question_text = q.get('question', '') or ''
    inline_schema = q.get('schema', '') or ''

    # P0 — runtime
    if q.get('runtime') == 'non-sqlite':
        issues.append(('P0', 'runtime_non_sqlite', 'runtime=non-sqlite; skipped from audit'))
    if not sol.strip():
        issues.append(('P0', 'empty_solution', 'no solution SQL'))

    # P1 — multiple `--method N` blocks suggesting unfinished/draft state
    method_blocks = len(re.findall(r'--\s*method\s+\d', sol_low))
    if method_blocks >= 2:
        # Likely shipped with two competing solutions; user has to guess which is right
        issues.append(('P1', 'multi_method_blocks', f'{method_blocks} commented "--method N" blocks'))

    # P1 — Solution references columns not in schema (alias.col gap)
    if spec and sol.strip():
        cols_per_table = {t['table'].lower(): {c.lower() for c in t['columns']} for t in spec}
        ctes = cte_names(sol)
        aliases = alias_map(sol, [t['table'] for t in spec])
        missing = defaultdict(set)
        cleaned = strip_strings(sol)
        for m in re.finditer(r'\b([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b', cleaned, re.I):
            alias = m.group(1).lower()
            col = m.group(2).lower()
            if col in SQL_KEYWORDS or col.isdigit(): continue
            if alias in ctes: continue
            if alias not in aliases: continue
            target_table = aliases[alias]
            target_cols = cols_per_table.get(target_table, set())
            if col not in target_cols:
                missing[target_table].add(col)
        for tbl, cols in missing.items():
            issues.append(('P1', 'missing_columns_in_schema', f'table {tbl}: SQL refs {sorted(cols)} not in schema'))

    # P1 — ghost columns in schema
    for t in spec:
        for c in t['columns']:
            cl = c.lower()
            if cl in GHOST_EXACT:
                issues.append(('P1', 'ghost_column', f'table {t["table"]}: column "{c}" is a SQL keyword'))
            elif any(re.match(p, cl) for p in GHOST_PATTERNS):
                # Allow 'd' / 'ds' / 'dt' for date alias in calendar/event tables
                if cl in ('d','ds','dt','t') and len(t['columns']) <= 3: continue
                issues.append(('P1', 'ghost_column', f'table {t["table"]}: column "{c}" looks suspicious'))

    # P1 — inline schema text doesn't match structured spec
    if spec and inline_schema:
        expected = ', '.join(f"{t['table']}({', '.join(t['columns'])})" for t in spec)
        if expected != inline_schema:
            issues.append(('P1', 'schema_text_drift', 'inline schema text differs from structured spec'))

    # P2 — empty / stub question
    qt = question_text.strip()
    if not qt:
        issues.append(('P2', 'no_question_text', 'no `question` field'))
    elif len(qt) < 30:
        issues.append(('P2', 'stub_question_text', f'short question ({len(qt)} chars)'))
    elif qt.lower() in ('question?', 'question :-'):
        issues.append(('P2', 'placeholder_question', 'placeholder text'))

    # P2 — no enrichment
    if f"{qid}.html" not in enrichment_files:
        issues.append(('P2', 'no_enrichment', 'no enrichment HTML'))

    # P2 — slug-style title
    title = (q.get('title') or '').strip()
    if not title or title == '(untitled)' or '-' in title and title.islower():
        issues.append(('P2', 'slug_title', f'title looks slug-style: "{title}"'))

    return issues

def main():
    with open('interview/data/questions.json') as f: qs = json.load(f)
    with open('interview/data/question_schemas.json') as f: schemas = json.load(f)
    enrichment_files = set(os.listdir('interview/data/enrichments'))

    by_severity = defaultdict(int)
    by_kind = defaultdict(int)
    issues_by_qid = {}
    for q in qs:
        if q.get('language') != 'sql': continue
        issues = check_question(q, schemas, enrichment_files)
        if issues:
            issues_by_qid[q['id']] = issues
            for sev, kind, _ in issues:
                by_severity[sev] += 1
                by_kind[(sev, kind)] += 1

    print(f"=== Comprehensive Audit · {len(qs)} questions ===\n")
    print(f"Questions with issues: {len(issues_by_qid)}\n")
    print("By severity:")
    for sev in ['P0', 'P1', 'P2']:
        print(f"  {sev}: {by_severity[sev]}")
    print("\nBy kind (top categories):")
    for (sev, kind), cnt in sorted(by_kind.items(), key=lambda x: -x[1])[:20]:
        print(f"  [{sev}] {kind:35s} {cnt}")

    # Sample some P0 and P1 questions
    print("\n=== Sample P0 issues ===")
    p0 = [(qid, iss) for qid, iss in issues_by_qid.items() if any(s == 'P0' for s, _, _ in iss)]
    for qid, iss in p0[:10]:
        for sev, kind, msg in iss:
            if sev == 'P0':
                print(f"  {qid}: {kind} — {msg}")

    print("\n=== Sample P1 ghost-column issues ===")
    p1_ghost = [(qid, iss) for qid, iss in issues_by_qid.items()
                if any(k == 'ghost_column' for _, k, _ in iss)]
    for qid, iss in p1_ghost[:10]:
        for sev, kind, msg in iss:
            if kind == 'ghost_column':
                print(f"  {qid}: {msg}")

    print("\n=== Sample P1 multi-method issues ===")
    p1_mm = [(qid, iss) for qid, iss in issues_by_qid.items()
             if any(k == 'multi_method_blocks' for _, k, _ in iss)]
    for qid, iss in p1_mm[:10]:
        print(f"  {qid}")

    # Persist
    out = []
    for qid, iss in issues_by_qid.items():
        out.append({'id': qid, 'issues': iss})
    with open('/tmp/comprehensive_audit.json', 'w') as f:
        json.dump(out, f, indent=2)
    print(f"\nFull report → /tmp/comprehensive_audit.json")

if __name__ == '__main__':
    main()
