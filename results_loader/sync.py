"""
Sync: runs on the VPS on a schedule (e.g. monthly cron). Refreshes the full
results table from WCA and computes only the current month's snapshot.

On first deploy, import the bootstrapped snapshot CSV before running normally:
    python sync.py --import-snapshots snapshots.csv

Subsequent runs:
    python sync.py
"""

import shutil
from argparse import ArgumentParser
from datetime import date

import polars as pl

from common import (
    TARGET_DIR,
    compute_snapshot_for_date,
    connect_with_retry,
    copy_to_db,
    create_ranking_snapshots_table,
    download_and_extract,
    first_of_month,
    get_db_params,
    load_results_to_db,
    logger,
)


def import_snapshots(cursor, path):
    """Bulk-load a CSV exported by bootstrap.py into ranking_snapshots."""
    logger.info(f"Importing ranking_snapshots from {path}...")
    df = pl.read_csv(path, try_parse_dates=True)
    expected = {"snapshot_date", "person_id", "event_id", "value", "rank"}
    if not expected.issubset(set(df.columns)):
        raise ValueError(f"CSV is missing columns. Expected: {expected}")
    copy_to_db(
        cursor,
        df.select(["snapshot_date", "person_id", "event_id", "value", "rank"]),
        "ranking_snapshots",
    )
    logger.info(f"Imported {len(df):,} rows.")


def main():
    parser = ArgumentParser(
        description="Sync WCA results and update current-month snapshot."
    )
    parser.add_argument(
        "--import-snapshots",
        metavar="FILE",
        help="On first deploy: import a bootstrapped ranking_snapshots CSV before syncing",
    )
    args = parser.parse_args()

    db_params = get_db_params()
    conn = connect_with_retry(db_params)

    try:
        download_and_extract()

        with conn:
            with conn.cursor() as cursor:
                load_results_to_db(cursor)
                create_ranking_snapshots_table(cursor)

                if args.import_snapshots:
                    import_snapshots(cursor, args.import_snapshots)

                snapshot_date = first_of_month(date.today())
                logger.info(f"Computing snapshot for {snapshot_date}...")
                compute_snapshot_for_date(cursor, snapshot_date)

    finally:
        if conn:
            conn.close()
        shutil.rmtree(TARGET_DIR, ignore_errors=True)


if __name__ == "__main__":
    main()
