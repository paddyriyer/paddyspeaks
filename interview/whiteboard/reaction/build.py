"""Fill the Reaction Problem page's code and result slots from the verified sources.

The page holds empty slots:
    <div class="codeblock" data-src="sql/10_dims.sql"></div>
    <pre class="result" data-src="results/40_ball_reactions.txt"></pre>
This script writes each file's text into its slot, highlighted, so the page
shows exactly the code that verify.py and test_reaction.py executed.

    python3 build.py           # rewrite the page
    python3 build.py --check   # exit 1 if the page is out of date
"""
import html
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PAGE = HERE.parents[2] / "interview.app" / "design" / "the-reaction-problem.html"

SQL_KW = r"""SELECT FROM WHERE GROUP BY ORDER HAVING JOIN LEFT CROSS LATERAL ON USING AS AND OR
NOT NULL IS IN BETWEEN CASE WHEN THEN ELSE END WITH UNION ALL DISTINCT INSERT INTO VALUES
CREATE TABLE VIEW FUNCTION TRIGGER CONSTRAINT INDEX PRIMARY KEY FOREIGN REFERENCES UNIQUE
CHECK DEFAULT RETURNS RETURN RETURNING LANGUAGE STABLE BEGIN DECLARE IF RAISE EXCEPTION FOUND
CONFLICT DO NOTHING UPDATE SET DELETE OVER PARTITION ROWS PRECEDING CURRENT ROW WINDOW FILTER
WITHIN EXISTS INTERVAL DEFERRABLE INITIALLY DEFERRED AFTER EACH EXECUTE FOR TRUE FALSE
NOT ENFORCED INT INTEGER BIGINT SMALLINT TEXT STRING BOOLEAN JSONB UUID NUMERIC DATE
TIMESTAMPTZ BIGSERIAL TABLE LIMIT ROWTYPE DESC ASC COMMIT""".split()
PY_KW = """import from as def class return if elif else for in not and or is None True False
while with async await try except raise lambda yield pass break continue global""".split()

SQL_RE = re.compile(r"(--[^\n]*)|('(?:[^']|'')*')|(\$\$)|\b([A-Za-z_][A-Za-z_0-9]*)\b(?=\s*\()|\b([A-Za-z_]+)\b")
PY_RE = re.compile(r'(#[^\n]*)|([rbfu]?"""[\s\S]*?"""|[rbfu]?"(?:\\.|[^"\\\n])*"|[rbfu]?\'(?:\\.|[^\'\\\n])*\')'
                   r'|(?<=def )([A-Za-z_][A-Za-z_0-9]*)|(?<=class )([A-Za-z_][A-Za-z_0-9]*)|\b([A-Za-z_]+)\b')


def span(cls: str, text: str) -> str:
    return f'<span class="{cls}">{html.escape(text, quote=False)}</span>'


def hl_sql(src: str) -> str:
    out, pos = [], 0
    kws = {k.upper() for k in SQL_KW}
    for m in SQL_RE.finditer(src):
        out.append(html.escape(src[pos:m.start()], quote=False))
        com, s, dollar, fn, word = m.groups()
        if com:
            out.append(span("cl", com))
        elif s:
            out.append(span("cs", s))
        elif dollar:
            out.append(span("ck", dollar))
        elif fn:
            out.append(span("ck", fn) if fn.upper() in kws and fn.isupper() else span("cf", fn))
        else:
            out.append(span("ck", word) if word.isupper() and word in kws else html.escape(word))
        pos = m.end()
    out.append(html.escape(src[pos:], quote=False))
    return "".join(out)


def hl_py(src: str) -> str:
    out, pos = [], 0
    for m in PY_RE.finditer(src):
        out.append(html.escape(src[pos:m.start()], quote=False))
        com, s, fn, cls, word = m.groups()
        if com:
            out.append(span("cl", com))
        elif s:
            out.append(span("cs", s))
        elif fn or cls:
            out.append(span("cf", fn or cls))
        else:
            out.append(span("ck", word) if word in PY_KW else html.escape(word))
        pos = m.end()
    out.append(html.escape(src[pos:], quote=False))
    return "".join(out)


SLOT = re.compile(r'(<(div|pre) class="(codeblock|result)"[^>]*? data-src="([^"]+)"[^>]*>)(.*?)(</\2>)', re.S)


def render(page: str) -> str:
    def fill(m: re.Match) -> str:
        path = HERE / m.group(4)
        text = path.read_text(encoding="utf-8").rstrip("\n")
        if m.group(3) == "result":
            body = html.escape(text, quote=False)
        elif path.suffix == ".py":
            body = hl_py(text)
        else:
            body = hl_sql(text)
        return m.group(1) + body + m.group(6)
    return SLOT.sub(fill, page)


def main() -> int:
    page = PAGE.read_text(encoding="utf-8")
    new = render(page)
    slots = SLOT.findall(new)
    declared = page.count("data-src=")
    empty = [s[3] for s in slots if not s[4].strip()]
    if len(slots) != declared or empty:
        print(f"{len(slots)} of {declared} slots filled; empty: {empty}")
        return 1
    if "--check" in sys.argv:
        if new != page:
            print(f"{PAGE.name} is stale: run python3 {Path(__file__).relative_to(HERE.parents[2])}")
            return 1
        print("page in sync with verified sources")
        return 0
    PAGE.write_text(new, encoding="utf-8")
    print(f"wrote {PAGE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
