"""Flag seedRows tables where a column carries no information —
either all-NULL, all-empty-string, or all-identical values. Catches
the 'I added a column to the canonical schema but didn't bother
populating it' anti-pattern.
"""
import json, sys
from collections import defaultdict

def audit():
    with open('interview/data/question_schemas.json') as f:
        schemas = json.load(f)
    issues = []
    for qid, spec in schemas.items():
        for t in spec:
            rows = t.get('rows')
            if not rows: continue
            for c in t['columns']:
                vals = [r.get(c) for r in rows]
                non_null = [v for v in vals if v is not None and v != '']
                if len(non_null) == 0:
                    issues.append((qid, t['table'], c, f"ALL {len(rows)} rows have NULL/empty"))
                elif len(set(non_null)) == 1 and len(non_null) > 2:
                    issues.append((qid, t['table'], c, f"ALL non-null values are identical ({non_null[0]!r})"))
    return issues

if __name__ == '__main__':
    issues = audit()
    if not issues:
        print('=== Seed-rows quality audit ===')
        print('0 instances — every seedRows column carries information.')
        sys.exit(0)
    print(f'=== Seed-rows quality audit · {len(issues)} issue(s) ===')
    for qid, table, col, msg in issues:
        print(f"  {qid} · {table}.{col}: {msg}")
