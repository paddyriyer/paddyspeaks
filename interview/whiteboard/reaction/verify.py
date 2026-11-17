"""Run every SQL block on the Reaction Problem page against PostgreSQL, with
synthetic data, and check the invariants the page claims. Writes the result
tables the page quotes to results/*.txt.

    PGHOST=... PGPORT=... python3 verify.py      (needs psql and a superuser)

Nothing here is a benchmark. The data is synthetic (py/seed.py).
"""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SQL = HERE / "sql"
RESULTS = HERE / "results"
DB = "reaction_problem"


def psql(sql: str, db: str = DB, *, aligned: bool = False, check: bool = True) -> str:
    args = ["psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", db]
    args += ["-P", "footer=off"] if aligned else ["-At", "-F", "|"]
    r = subprocess.run(args, input=sql, capture_output=True, text=True)
    if check and r.returncode != 0:
        sys.exit(f"psql failed:\n{r.stderr}\n--- sql ---\n{sql[:2000]}")
    return r.stdout if r.returncode == 0 else "ERROR: " + r.stderr.strip()


def run_file(name: str, *, aligned: bool = False) -> str:
    return psql((SQL / name).read_text(), aligned=aligned)


def main() -> None:
    RESULTS.mkdir(exist_ok=True)
    psql(f"DROP DATABASE IF EXISTS {DB}; CREATE DATABASE {DB};", db="postgres")
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run([sys.executable, str(HERE / "py" / "seed.py"), tmp], check=True)
        for f in ["10_dims.sql", "11_facts.sql", "12_serving.sql", "20_ingest.sql"]:
            run_file(f)
        for table in ["dim_match", "dim_delivery", "dim_account", "render_receipt"]:
            psql(f"\\copy {table} FROM '{tmp}/{table}.csv' CSV")
        # ingest every payload through the idempotent function, retries included
        payloads = Path(tmp, "batches.jsonl").read_text().splitlines()
        stage = Path(tmp, "stage.csv")
        stage.write_text("".join('"' + p.replace('"', '""') + '"\n' for p in payloads))
        out = psql(
            "CREATE TABLE stage(seq SERIAL, p JSONB);"
            f"\\copy stage(p) FROM '{stage}' CSV\n"
            "SELECT count(*) FILTER (WHERE ok), count(*) FILTER (WHERE NOT ok) "
            "FROM (SELECT ingest_batch(p) AS ok FROM stage ORDER BY seq) s;"
            "DROP TABLE stage;")
        inserted, dupes = map(int, out.strip().split("|"))
    print(f"ingest: {len(payloads)} payloads -> {inserted} stored, {dupes} retries ignored")
    (RESULTS / "20_ingest.txt").write_text(
        f" payloads received | stored | retries ignored\n"
        f"-------------------+--------+----------------\n"
        f" {len(payloads):>17,} | {inserted:>6,} | {dupes:>15,}\n")
    assert inserted + dupes == len(payloads) and dupes > 0
    # a second pass changes nothing: ingest is idempotent
    before = psql("SELECT count(*) FROM reaction_tap;").strip()
    psql("SELECT ingest_batch(jsonb_build_object('session_id', session_id, 'batch_seq', batch_seq,"
         " 'account_id', account_id, 'device_fp', device_fp, 'asn', asn, 'region', region,"
         " 'match_id', match_id, 'media_sec', media_sec, 'client_sent_at', client_sent_at,"
         " 'edge_received_at', edge_received_at, 'admission', admission, 'taps', '{\"fire\": 3}'::jsonb))"
         " FROM reaction_batch LIMIT 500;")
    assert psql("SELECT count(*) FROM reaction_tap;").strip() == before, "re-ingest changed taps"

    for f in ["30_voice.sql", "31_mood_as_of.sql", "32_publish.sql", "33_mood_settled.sql",
              "50_integrity.sql", "52_counted_voice.sql"]:
        run_file(f)

    results = {}
    for f in ["32_publish_view", "40_ball_reactions.sql", "41_who_sees_the_crowd.sql",
              "51_mood_clean.sql", "60_slo.sql", "61_funnel.sql", "62_skew.sql"]:
        if f == "32_publish_view":
            txt = psql("SELECT revision, to_char(published_at, 'HH24:MI:SS') AS published, voices, shares "
                       "FROM mood_snapshot ORDER BY revision;", aligned=True)
        else:
            txt = run_file(f, aligned=True)
        results[f] = txt
        (RESULTS / (Path(f).stem + ".txt")).write_text(txt)
        print(f"\n== {f}\n{txt}")

    # --- invariants the page states ---------------------------------------
    one_voice = psql("SELECT count(*) FROM (SELECT session_id, media_sec, count(*) FROM reaction_voice "
                     "GROUP BY 1,2 HAVING count(*) > 1) x;").strip()
    assert one_voice == "0", "more than one voice per person per second"
    revs = [int(x) for x in psql("SELECT voices FROM mood_snapshot ORDER BY revision;").split()]
    assert revs == sorted(revs), "a later revision had fewer voices"
    excluded_bots = psql("SELECT count(*) FILTER (WHERE excluded), count(*) FROM session_integrity "
                         "WHERE asn = 64512;").strip().split("|")
    excluded_humans = psql("SELECT count(*) FROM session_integrity WHERE asn <> 64512 AND excluded;").strip()
    print(f"\nintegrity: scripted sessions excluded {excluded_bots[0]}/{excluded_bots[1]}; "
          f"genuine sessions excluded {excluded_humans}")
    assert excluded_bots[0] == excluded_bots[1] and excluded_humans == "0"
    spoilers = psql("SELECT count(*) FROM render_receipt "
                    "WHERE player_media_ms < (snapshot_media_sec + 1) * 1000;").strip()
    assert spoilers == "1", "the seeded spoiler should be the only one"

    # --- the money path ---------------------------------------------------
    for f in ["70_ledger.sql", "71_charge.sql", "73_ledger_scenario.sql"]:
        run_file(f)
    recon = run_file("72_recon.sql", aligned=True)
    (RESULTS / "72_recon.txt").write_text(recon)
    print(f"\n== 72_recon.sql\n{recon}")
    rows = psql((SQL / "72_recon.sql").read_text()).strip().splitlines()
    totals = rows[0].split("|")
    assert totals[1] == totals[2], "totals should agree"
    assert len(rows) == 3, "exactly two row breaks"
    calls = ["SELECT charge('k-1003', 1003, 3, 900);   -- same key, different amount",
             "SELECT charge('k-big', 1004, 2, 999999); -- more than the wallet holds",
             "BEGIN; INSERT INTO ledger_entry (txn_id, account, amount_minor)\n"
             "       VALUES (1, 'merchant', 1); COMMIT;  -- a one-sided entry"]
    replay_err, funds_err, unbalanced = (psql(c, check=False) for c in calls)
    assert "reused with a different request" in replay_err
    assert "insufficient funds" in funds_err
    assert "does not balance" in unbalanced
    left = psql("SELECT count(*) FROM payment_intent WHERE idempotency_key = 'k-big';").strip()
    assert left == "0", "a refused charge must leave no intent behind"
    def first_error(e: str) -> str:
        return next(l for l in e.splitlines() if "ERROR:" in l).replace("ERROR: ERROR:", "ERROR:")
    (RESULTS / "71_errors.txt").write_text("\n\n".join(
        f"{c}\n{first_error(e)}" for c, e in zip(calls, [replay_err, funds_err, unbalanced])) + "\n")
    balances = psql("SELECT customer_id, balance_minor FROM wallet ORDER BY 1;", aligned=True)
    (RESULTS / "71_wallets.txt").write_text(balances)
    print("\nledger checks passed\n" + balances)
    print("ALL CHECKS PASSED")


if __name__ == "__main__":
    main()
