"""
PaddySpeaks community submission ingester.
Reads new rows from a public Google Sheet (CSV export — no API key needed),
uses Claude Haiku to format them into the question schema, and appends them
to the appropriate JSON file.
State is tracked in processed_submissions.json to avoid duplicates.
"""

import anthropic, csv, io, json, os, re, sys
from datetime import date
from urllib.request import urlopen
from urllib.error import HTTPError

# Full "Publish to web" CSV URL for the Form Responses sheet. Published URLs
# (/pub?...output=csv) are anonymously readable; the older /export endpoint is
# not, even with "anyone with link" sharing — hence this indirection.
GSHEET_CSV_URL = os.environ.get(
    "GSHEET_CSV_URL",
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQR6l6cmujYC5HRzDwQAoz2OYhjhBber7xVmR5_J6ZMhW14nUpV126DM4Vu2-MEgNZdmgX7aI6iEaAC/pub?gid=399863191&single=true&output=csv",
)
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

DATA_DIR = "interview.app/evaluate/data"
STATE_FILE = ".github/scripts/processed_submissions.json"
TODAY = str(date.today())

ID_PREFIXES = {"python": "py", "sql": "sql", "design": "ds"}

# Map Google Form topic values → internal topic keys
TOPIC_MAP = {
    "python": "python",
    "sql": "sql",
    "design": "design",
    "system design": "design",
    "system design / architecture": "design",
    "data engineering / system design": "design",
}

SYSTEM = """You are an expert data engineering interviewer.
A community member submitted a raw interview question they encountered.
Your job is to turn it into a clean, well-structured multiple-choice quiz question.
Return ONLY valid JSON — no prose, no markdown fences."""


def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            return json.load(f)
    return {"processed_rows": []}


def save_state(state):
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def fetch_sheet_rows():
    with urlopen(GSHEET_CSV_URL) as resp:
        content = resp.read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(content))
    return list(reader)


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
    return max(nums, default=0) + 1


def format_question(client, raw_question, topic, difficulty, company):
    prefix = ID_PREFIXES[topic]
    data = load_json(topic)
    placeholder_id = f"{prefix}-new-{next_id(data['questions'], prefix):03d}"

    company_ctx = f" (asked at {company})" if company and company.strip() else ""
    diff_ctx = f" Target difficulty: {difficulty}." if difficulty and difficulty.strip() else ""

    prompt = f"""A community member submitted this raw interview question{company_ctx}:{diff_ctx}

---
{raw_question}
---

Convert it into a clean multiple-choice quiz question with exactly 4 options, one correct answer, and a clear explanation.

Return a single JSON object with exactly these fields:
{{
  "id": "{placeholder_id}",
  "type": "single",
  "topic": "<specific sub-topic within {topic}>",
  "difficulty": "easy" | "medium" | "hard",
  "added_date": "{TODAY}",
  "prompt": "<the question text, cleaned up>",
  "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
  "answer": <0-3 index of correct option>,
  "explanation": "<why the answer is correct, 1-3 sentences>",
  "source": "community"
}}

If the submission is too vague, off-topic, or not a real interview question, return:
{{"skip": true, "reason": "<why>"}}
"""

    resp = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
        system=SYSTEM,
    )

    raw = resp.content[0].text.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return json.loads(raw)


def row_key(row):
    """Stable dedup key: timestamp + first 80 chars of question."""
    ts = row.get("Timestamp", "")
    q = list(row.values())[1] if len(row) > 1 else ""
    return f"{ts}::{q[:80]}"


def main():
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    state = load_state()
    processed = set(state.get("processed_rows", []))

    print("Fetching Google Sheet rows…")
    try:
        rows = fetch_sheet_rows()
    except Exception as e:
        print(f"ERROR fetching sheet: {e}", file=sys.stderr)
        sys.exit(1)

    new_rows = [r for r in rows if row_key(r) not in processed]
    print(f"  {len(rows)} total rows, {len(new_rows)} new")

    if not new_rows:
        print("Nothing to process.")
        return

    added_by_topic = {t: 0 for t in ID_PREFIXES}

    for row in new_rows:
        key = row_key(row)
        values = list(row.values())

        # Column order from Google Form: Timestamp, Question, Topic, Difficulty, Company, Name
        raw_question = (row.get("Question") or (values[1] if len(values) > 1 else "")).strip()
        topic_raw = (row.get("Topic") or (values[2] if len(values) > 2 else "")).strip().lower()
        difficulty = (row.get("Difficulty") or (values[3] if len(values) > 3 else "")).strip().lower()
        company = (row.get("Company") or (values[4] if len(values) > 4 else "")).strip()

        if not raw_question:
            print(f"  SKIP — empty question")
            processed.add(key)
            continue

        topic = TOPIC_MAP.get(topic_raw)
        if not topic:
            print(f"  SKIP — unknown topic '{topic_raw}'")
            processed.add(key)
            continue

        print(f"  Processing {topic} question: {raw_question[:60]}…")

        try:
            result = format_question(client, raw_question, topic, difficulty, company)
        except Exception as e:
            print(f"  ERROR: {e}", file=sys.stderr)
            continue

        if result.get("skip"):
            print(f"  SKIPPED by Claude: {result.get('reason')}")
            processed.add(key)
            continue

        data = load_json(topic)
        questions = data["questions"]
        prefix = ID_PREFIXES[topic]
        result["id"] = f"{prefix}-new-{next_id(questions, prefix):03d}"
        result["added_date"] = TODAY
        result["source"] = "community"

        questions.append(result)
        data["questions"] = questions
        save_json(topic, data)

        added_by_topic[topic] += 1
        processed.add(key)
        print(f"  ADDED [{result['difficulty']}] {result['topic']}: {result['prompt'][:60]}…")

    state["processed_rows"] = list(processed)
    save_state(state)

    total = sum(added_by_topic.values())
    print(f"\nDone. {total} question(s) added: {added_by_topic}")


if __name__ == "__main__":
    main()
