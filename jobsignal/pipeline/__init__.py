"""JobSignal ingestion pipeline — Python 3.12 stdlib only, no dependencies.

Run order (see build.py): adapters -> normalize -> identity -> verify -> store
-> confidence -> index. Every judgement the UI renders is computed here, once,
so the browser only formats what it is handed. See docs/JOBSIGNAL.md.
"""
