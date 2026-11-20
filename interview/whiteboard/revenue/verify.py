"""Run every SQL block on the Revenue Problem page against PostgreSQL, with
synthetic data, and check the claims the page makes. Writes the result tables
the page quotes to results/*.txt.

    PGHOST=... PGPORT=... PGUSER=postgres python3 verify.py   (needs psql)

The data is synthetic (py/seed.py, py/study.py): no real company or study.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SQL = HERE / "sql"
RESULTS = HERE / "results"
DB = "revenue_problem"


def psql(sql: str, db: str = DB, *, aligned: bool = False) -> str:
    args = ["psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", db]
    args += ["-P", "footer=off"] if aligned else ["-At", "-F", "|"]
    r = subprocess.run(args, input=sql, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"psql failed:\n{r.stderr}\n--- sql ---\n{sql[:1500]}")
    return r.stdout


def run(name: str, *, aligned: bool = False) -> str:
    return psql((SQL / name).read_text(), aligned=aligned)


def save(name: str) -> str:
    txt = run(name, aligned=True)
    (RESULTS / (Path(name).stem + ".txt")).write_text(txt)
    print(f"\n== {name}\n{txt}")
    return txt


def main() -> None:
    RESULTS.mkdir(exist_ok=True)
    psql(f"DROP DATABASE IF EXISTS {DB}; CREATE DATABASE {DB};", db="postgres")
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run([sys.executable, str(HERE / "py" / "seed.py"), tmp], check=True)
        subprocess.run([sys.executable, str(HERE / "py" / "study.py"), tmp], check=True)
        run("10_schema.sql")
        run("11_catalog.sql")
        run("50_study.sql")
        for table in ["orders", "refunds", "study_response"]:
            psql(f"\\copy {table} FROM '{tmp}/{table}.csv' CSV")

    for f in ["20_product_today.sql", "21_finance_today.sql", "30_bridge.sql", "31_bug.sql",
              "32_time_zone.sql", "33_average.sql", "40_badge.sql", "51_study_analysis.sql"]:
        save(f)

    # --- the claims the page makes -----------------------------------------
    assert run("20_product_today.sql").strip() == "$4,600,000.00"
    assert run("21_finance_today.sql").strip() == "$4,200,000.00"
    bridge = [line.split("|") for line in run("30_bridge.sql").strip().splitlines()]
    amounts = {int(r[0]): r[2] for r in bridge}
    assert amounts == {1: "4600000.00", 2: "-230000.00", 3: "-15000.00", 4: "-180000.00",
                       5: "120000.00", 6: "-95000.00", 7: "4200000.00", 8: "0.00"}, amounts
    bug = run("31_bug.sql").strip().split("|")
    assert float(bug[2]) > 0 and bug[3] == "12", bug
    tz = dict(line.split("|") for line in run("32_time_zone.sql").strip().splitlines())
    assert tz["America/New_York"] == "4200000.00" and tz["UTC"] != tz["America/New_York"], tz
    avg = run("33_average.sql").strip().split("|")
    assert avg[0] == "32" and avg[2] == "0", avg
    badge = run("40_badge.sql")
    assert "2 of 3 checks passed" in badge and "3 of 3 checks passed" in badge
    print("\nALL CHECKS PASSED")


if __name__ == "__main__":
    main()
