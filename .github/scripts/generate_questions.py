"""
PaddySpeaks question generator.
Runs in GitHub Actions on daily / weekly / monthly cadence.
Uses Claude Haiku (cheapest model) to keep costs near zero.
"""

import anthropic, json, os, re, sys
from datetime import date, datetime

MODE = os.environ.get("RUN_MODE", "daily")
TODAY = str(date.today())
DATA_DIR = "interview.app/evaluate/data"

# How many questions to add per topic per run
COUNTS = {
    "daily":   {"python": 1, "sql": 1, "design": 0},
    "weekly":  {"python": 3, "sql": 4, "design": 3},
    "monthly": {"python": 5, "sql": 5, "design": 5},
}

TOPIC_HINTS = {
    "python": [
        "itertools", "functools", "asyncio", "type hints", "dataclasses",
        "pathlib", "context managers", "descriptors", "metaclasses",
        "memory management", "GIL", "multiprocessing", "walrus operator",
        "structural pattern matching", "pandas performance", "polars"
    ],
    "sql": [
        "window functions", "CTEs", "lateral joins", "FILTER clause",
        "DISTINCT ON", "NULLIF / COALESCE", "date arithmetic",
        "recursive CTEs", "MERGE / UPSERT", "query planning",
        "Snowflake-specific", "BigQuery-specific", "partitioning",
        "materialized views", "transaction isolation"
    ],
    "design": [
        "data contracts", "schema evolution", "Iceberg table format",
        "Delta Lake", "streaming vs batch", "CDC patterns",
        "idempotency", "exactly-once semantics", "data mesh",
        "data observability", "dbt best practices", "Airflow patterns",
        "cost optimization", "data vault", "reverse ETL"
    ],
}

ID_PREFIXES = {"python": "py", "sql": "sql", "design": "ds"}

SYSTEM = """You are an expert data engineering interviewer writing multiple-choice quiz questions.
Generate realistic, specific questions that a senior data engineer would encounter in interviews at
companies like Google, Meta, Amazon, Databricks, Stripe, and Snowflake.
Each question must have exactly 4 options, one correct answer (0-indexed), and a clear explanation.
Vary difficulty. Avoid questions already too basic or too theoretical.
Return ONLY valid JSON — no prose, no markdown fences."""

def load_json(topic):
    with open(f"{DATA_DIR}/{topic}.json") as f:
        return json.load(f)

def save_json(topic, data):
    with open(f"{DATA_DIR}/{topic}.json", "w") as f:
        json.dump(data, f, indent=2)

def next_id(questions, prefix):
    nums = []
    for q in questions:
        m = re.search(rf"{prefix}-new-(\d+)", q["id"])
        if m:
            nums.append(int(m.group(1)))
    start = max(nums, default=0) + 1
    return f"{prefix}-new-{start:03d}"

def existing_prompts(questions, n=100):
    """Return last N question prompts to avoid duplicates."""
    return [q["prompt"][:80] for q in questions[-n:]]

def generate(client, topic, n, questions):
    if n == 0:
        return []

    import random
    hints = random.sample(TOPIC_HINTS[topic], min(3, len(TOPIC_HINTS[topic])))
    existing = existing_prompts(questions)
    prefix = ID_PREFIXES[topic]

    prompt = f"""Generate {n} new interview question(s) for the topic: {topic.upper()}.
Focus on these sub-topics (pick any): {', '.join(hints)}.
Do NOT repeat questions similar to these already existing ones:
{chr(10).join(f'- {p}' for p in existing[:20])}

Return a JSON array of {n} question object(s). Each object must have exactly these fields:
{{
  "id": "{prefix}-new-XXX",
  "type": "single",
  "topic": "<specific sub-topic>",
  "difficulty": "easy" | "medium" | "hard",
  "added_date": "{TODAY}",
  "prompt": "<the question text>",
  "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
  "answer": <0-3 index of correct option>,
  "explanation": "<why the answer is correct, 1-3 sentences>"
}}

Make IDs sequential from {next_id(questions, prefix)}.
"""

    resp = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
        system=SYSTEM,
    )

    raw = resp.content[0].text.strip()
    # strip markdown fences if model adds them
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    new_qs = json.loads(raw)
    if isinstance(new_qs, dict):
        new_qs = [new_qs]

    # Ensure IDs are unique and have added_date
    for i, q in enumerate(new_qs):
        q["added_date"] = TODAY
        if not q.get("id") or q["id"] in {x["id"] for x in questions}:
            q["id"] = f"{prefix}-new-{len(questions) + i + 1:03d}"

    return new_qs

def monthly_archive(questions):
    """Flag questions with low ratings as archived (future: use real vote data)."""
    # Placeholder — once voting is wired up, this reads vote counts.
    # For now, just log that monthly review ran.
    print(f"  Monthly review: {len(questions)} questions checked (voting not yet wired up)")
    return questions

def main():
    client = anthropic.Anthropic()
    counts = COUNTS[MODE]
    total_added = 0

    print(f"Mode: {MODE} | Date: {TODAY}")

    for topic, n in counts.items():
        if n == 0:
            continue

        data = load_json(topic)
        questions = data["questions"]

        if MODE == "monthly":
            questions = monthly_archive(questions)

        print(f"  Generating {n} {topic} question(s)…")
        try:
            new_qs = generate(client, topic, n, questions)
        except Exception as e:
            print(f"  ERROR generating {topic}: {e}", file=sys.stderr)
            continue

        questions.extend(new_qs)
        data["questions"] = questions
        save_json(topic, data)

        total_added += len(new_qs)
        for q in new_qs:
            print(f"    + [{q['difficulty']}] {q['topic']}: {q['prompt'][:60]}…")

    print(f"Done. {total_added} question(s) added.")

if __name__ == "__main__":
    main()
