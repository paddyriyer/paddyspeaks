"""
PaddySpeaks community submission ingester.
Fetches new submissions from Formspree, uses Claude Haiku to format them
into the question schema, and appends them to the appropriate JSON file.
Tracks processed submissions via a state file to avoid duplicates.
"""

import anthropic, json, os, re, sys
from datetime import date
from urllib.request import urlopen, Request
from urllib.error import HTTPError

FORMSPREE_API_KEY = os.environ["FORMSPREE_API_KEY"]
FORMSPREE_FORM_ID = os.environ.get("FORMSPREE_FORM_ID", "mzdnboae")
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

DATA_DIR = "interview.app/evaluate/data"
STATE_FILE = ".github/scripts/processed_submissions.json"
TODAY = str(date.today())

ID_PREFIXES = {"python": "py", "sql": "sql", "design": "ds"}

VALID_TOPICS = {"python", "sql", "design"}

SYSTEM = """You are an expert data engineering interviewer.
A community member submitted a raw interview question they encountered.
Your job is to turn it into a clean, well-structured multiple-choice quiz question.
Return ONLY valid JSON — no prose, no markdown fences."""


def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            return json.load(f)
    return {"processed_ids": []}


def save_state(state):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def fetch_submissions():
    url = f"https://formspree.io/api/0/forms/{FORMSPREE_FORM_ID}/submissions?page_size=100"
    req = Request(url, headers={"Authorization": f"Bearer {FORMSPREE_API_KEY}"})
    with urlopen(req) as resp:
        return json.loads(resp.read())["submissions"]


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


def format_question(client, raw_question, topic, level, company):
    prefix = ID_PREFIXES[topic]

    data = load_json(topic)
    placeholder_id = next_id(data["questions"], prefix)

    company_ctx = f" (asked at {company})" if company and company.strip() else ""
    level_ctx = f" Target difficulty: {level}." if level else ""

    prompt = f"""A community member submitted this raw interview question{company_ctx}:{level_ctx}

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


def main():
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    state = load_state()
    processed = set(state["processed_ids"])

    print("Fetching Formspree submissions…")
    try:
        submissions = fetch_submissions()
    except HTTPError as e:
        print(f"ERROR fetching submissions: {e}", file=sys.stderr)
        sys.exit(1)

    new_submissions = [s for s in submissions if s["_id"] not in processed]
    print(f"  {len(submissions)} total, {len(new_submissions)} new")

    if not new_submissions:
        print("Nothing to process.")
        return

    added_by_topic = {t: 0 for t in VALID_TOPICS}

    for sub in new_submissions:
        sub_id = sub["_id"]
        body = sub.get("data", sub)

        raw_question = body.get("question", "").strip()
        topic = body.get("topic", "").strip().lower()
        level = body.get("level", "").strip()
        company = body.get("company", "").strip()
        submitter = body.get("name", "anonymous").strip()

        if not raw_question:
            print(f"  [{sub_id}] SKIP — empty question")
            processed.add(sub_id)
            continue

        if topic not in VALID_TOPICS:
            print(f"  [{sub_id}] SKIP — unknown topic '{topic}'")
            processed.add(sub_id)
            continue

        print(f"  [{sub_id}] Processing {topic} question from {submitter or 'anon'}…")

        try:
            result = format_question(client, raw_question, topic, level, company)
        except Exception as e:
            print(f"  [{sub_id}] ERROR: {e}", file=sys.stderr)
            continue

        if result.get("skip"):
            print(f"  [{sub_id}] SKIPPED by Claude: {result.get('reason')}")
            processed.add(sub_id)
            continue

        data = load_json(topic)
        questions = data["questions"]

        # Ensure unique ID
        prefix = ID_PREFIXES[topic]
        result["id"] = next_id(questions, prefix)
        result["added_date"] = TODAY
        result["source"] = "community"

        questions.append(result)
        data["questions"] = questions
        save_json(topic, data)

        added_by_topic[topic] += 1
        processed.add(sub_id)
        print(f"  [{sub_id}] ADDED [{result['difficulty']}] {result['topic']}: {result['prompt'][:60]}…")

    state["processed_ids"] = list(processed)
    save_state(state)

    total = sum(added_by_topic.values())
    print(f"\nDone. {total} question(s) added: {added_by_topic}")


if __name__ == "__main__":
    main()
