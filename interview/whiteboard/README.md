# Systems at the Whiteboard — designs with executed code

Some designs in `interview.app/design/` carry code that was actually run. Their
sources live here, one folder per design, and `build.py` copies the code and the
result tables into the page. **Never edit code or results inside those pages.**

| Folder | Page | Verified by |
|---|---|---|
| `reaction/` | `the-reaction-problem.html` (Nº 41) | `verify.py` (PostgreSQL), `py/test_reaction.py` |
| `revenue/` | `the-revenue-problem.html` (Nº 42) | `verify.py` (PostgreSQL) |

A page marks each slot with the source path, relative to its folder:

```html
<div class="codeblock" tabindex="0" data-src="sql/30_bridge.sql"></div>
<pre class="result" tabindex="0" data-src="results/30_bridge.txt"></pre>
```

```bash
PGHOST=... PGPORT=... PGUSER=postgres python3 interview/whiteboard/<name>/verify.py
python3 interview/whiteboard/build.py <name>      # fill the page
python3 interview/whiteboard/build.py --check     # CI: every page in sync, no empty slot
```

CI (Validate Content) runs the Python unit tests and `build.py --check`. It does
not run PostgreSQL, so after changing any SQL run that design's `verify.py`
before `build.py`. A new design adds its folder to `PAGES` in `build.py`.
