"""COMPREHENSIVE schema audit. For every question that references a
canonical entity table (employees, departments, customers, ...) verify
that ALL canonical columns are present. Report drift; optionally fix."""
import json, sys, re
from collections import defaultdict

# THE LOCKED CANONICAL SHAPE. This is the source of truth.
# Any question that has a table with one of these names MUST have at
# least these columns. Order: PK first, then natural identity columns,
# then domain attributes. Extra columns are allowed; missing columns
# are a bug.
CANONICAL = {
    'employees':    ['emp_id', 'name', 'email', 'hire_date', 'salary', 'dept_id', 'manager_id', 'job_title'],
    'employee':     ['emp_id', 'name', 'email', 'hire_date', 'salary', 'dept_id', 'manager_id', 'job_title'],
    'departments':  ['dept_id', 'department_name', 'location', 'manager_id'],
    'department':   ['dept_id', 'department_name', 'location', 'manager_id'],
    'customers':    ['customer_id', 'name', 'email', 'signup_date', 'country', 'city'],
    'customer':     ['customer_id', 'name', 'email', 'signup_date', 'country', 'city'],
    'users':        ['user_id', 'name', 'email', 'signup_date', 'country'],
    'user':         ['user_id', 'name', 'email', 'signup_date', 'country'],
    'accounts':     ['account_id', 'name', 'plan', 'signup_date', 'country'],
    'products':     ['product_id', 'name', 'category', 'price', 'sku', 'manufacturer'],
    'product':      ['product_id', 'name', 'category', 'price', 'sku', 'manufacturer'],
    'orders':       ['order_id', 'customer_id', 'order_date', 'status', 'amount'],
    'order':        ['order_id', 'customer_id', 'order_date', 'status', 'amount'],
    'cities':       ['city_id', 'cityname', 'country', 'state'],
    'stores':       ['store_id', 'name', 'location', 'city', 'region'],
    'merchants':    ['merchant_id', 'name', 'category', 'city'],
    'restaurants':  ['restaurant_id', 'name', 'cuisine', 'city'],
    'listings':     ['listing_id', 'title', 'city', 'price', 'host_id'],
    'companies':    ['company_id', 'name', 'industry', 'country', 'founded_year'],
    'company':      ['company_id', 'name', 'industry', 'country', 'founded_year'],
    'suppliers':    ['supplier_id', 'name', 'country', 'city'],
    'invoices':     ['invoice_id', 'customer_id', 'invoice_date', 'amount', 'status'],
    'payments':     ['payment_id', 'customer_id', 'payment_date', 'amount', 'method', 'status'],
    'transactions': ['transaction_id', 'customer_id', 'transaction_time', 'amount', 'txn_type', 'status'],
    'projects':     ['project_id', 'name', 'start_date', 'end_date', 'status', 'manager_id'],
    'tasks':        ['task_id', 'project_id', 'name', 'assignee_id', 'status', 'due_date'],
    'subscriptions':['subscription_id', 'customer_id', 'plan', 'start_date', 'end_date', 'status'],
    'items':        ['item_id', 'name', 'category', 'price'],
}

# Synonyms — accept either spelling as satisfying the canonical column.
# Key = canonical column name, Value = accepted aliases.
SYNONYMS = {
    'department_name': ['dept_name'],
    'cityname':        ['city_name'],
    'customer_id':     ['cust_id'],
    'product_id':      ['prod_id'],
}

def synonym_satisfies(canonical_col, present_cols):
    """Return True if canonical_col is in present_cols OR any synonym is."""
    p = {c.lower() for c in present_cols}
    if canonical_col.lower() in p: return True
    for syn in SYNONYMS.get(canonical_col, []):
        if syn.lower() in p: return True
    return False

def audit_and_fix(fix=False):
    with open('interview/data/question_schemas.json') as f:
        schemas = json.load(f)
    with open('interview/data/questions.json') as f:
        qs = json.load(f)

    drift = defaultdict(list)   # (qid, table) -> [missing cols]
    fixed_count = 0
    cols_added_count = 0

    for qid, spec in schemas.items():
        if not spec: continue
        for t in spec:
            tn = t['table'].lower()
            if tn not in CANONICAL: continue
            expected = CANONICAL[tn]
            present = t['columns']
            missing = [c for c in expected if not synonym_satisfies(c, present)]
            if missing:
                drift[(qid, t['table'])] = missing
                if fix:
                    # Append missing canonical columns at the end
                    t['columns'] = list(present) + missing
                    cols_added_count += len(missing)
                    fixed_count += 1

    if fix and fixed_count:
        with open('interview/data/question_schemas.json', 'w') as f:
            json.dump(schemas, f, indent=2, ensure_ascii=False)

    return drift, fixed_count, cols_added_count

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'audit'
    drift, fixed, cols_added = audit_and_fix(fix=(mode == 'fix'))
    if mode == 'audit':
        print(f"=== Canonical-Schema Drift Audit ===\n")
        print(f"Drift instances: {len(drift)}\n")
        by_table = defaultdict(list)
        for (qid, table), missing in drift.items():
            by_table[table].append((qid, missing))
        for table, items in sorted(by_table.items()):
            print(f"  {table}: {len(items)} questions affected")
            shown = set()
            for qid, missing in items[:3]:
                print(f"    {qid}: missing {missing}")
                for c in missing: shown.add(c)
            if len(items) > 3:
                print(f"    ... +{len(items)-3} more")
        print(f"\nTotal canonical questions affected: {len(drift)}")
    else:
        print(f"FIXED: {fixed} schemas updated, {cols_added} columns added")
