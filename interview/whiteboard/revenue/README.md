# The Revenue Problem — sources

Systems at the Whiteboard Nº 42, `interview.app/design/the-revenue-problem.html`
(the "$400K disappearing act" UX interview). Code and results on the page are
copied in from here by `../build.py`; never edit them in the HTML.

| Path | What |
|---|---|
| `sql/*.sql` | orders and refunds, the metric catalogue, both dashboards as they are, the bridge, a fan-out bug, time-zone sensitivity, the "$4.4M" search, the verification sentence, the study analysis |
| `py/seed.py` | **synthetic** orders: Product's query returns exactly $4,600,000.00 and Finance's $4,200,000.00 for October 2026, and every dollar of the gap comes from a nameable rule |
| `py/study.py` | **synthetic** usability responses, only so the analysis query has rows; the probabilities are chosen, so the "result" is not evidence |
| `results/*.txt` | what the page quotes, written by `verify.py` |

```bash
PGHOST=... PGPORT=... PGUSER=postgres python3 interview/whiteboard/revenue/verify.py
python3 interview/whiteboard/build.py revenue
```

`verify.py` asserts: $4.6M and $4.2M exactly; each bridge step's amount; an
unexplained line of 0.00; the fan-out bug leaves a non-zero residual on 12
double-refunded orders; the UTC month differs from the New York month; none of
the 32 definitions the rules allow equals $4.4M; the verification sentences.
