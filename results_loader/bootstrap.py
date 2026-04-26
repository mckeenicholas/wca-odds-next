"""
Bootstrap: run locally to populate the full results table and all historical
ranking snapshots. Use --export to dump ranking_snapshots to a CSV that can
be imported on the VPS via sync.py --import-snapshots.

Usage:
    python bootstrap.py                          # load data + compute all snapshots
    python bootstrap.py --months 24             # limit history to 24 months
    python bootstrap.py --export snapshots.csv  # also export after computing
"""

import shutil
from argparse import ArgumentParser
from datetime import date, timedelta

import polars as pl

from common import (
    TARGET_DIR,
    compute_snapshot_for_date,
    connect_with_retry,
    create_ranking_snapshots_table,
    download_and_extract,
    first_of_month,
    get_db_params,
    load_results_to_db,
    logger,
    subtract_month,
)


def bootstrap_snapshots(cursor, start_date):
    snapshot_date = first_of_month(date.today())
    end_date = first_of_month(start_date)

    snapshots = []
    while snapshot_date >= end_date:
        snapshots.append(snapshot_date)
        snapshot_date = subtract_month(snapshot_date)
    total = len(snapshots)

    for i, snap in enumerate(snapshots, 1):
        cursor.execute(
            "SELECT 1 FROM ranking_snapshots WHERE snapshot_date = %s LIMIT 1",
            (snap,),
        )
        if cursor.fetchone():
            logger.info(f"[{i}/{total}] Snapshot {snap} already exists, skipping.")
        else:
            logger.info(f"[{i}/{total}] Computing snapshot for {snap}...")
            compute_snapshot_for_date(cursor, snap)
            # Commit each snapshot individually so a crash mid-run is resumable
            cursor.connection.commit()


def delete_snapshots(cursor):
    cursor.execute("TRUNCATE TABLE ranking_snapshots")
    cursor.connection.commit()
    logger.info("Cleared all ranking snapshots.")


def export_snapshots(path):
    logger.info(f"Exporting ranking_snapshots to {path}...")
    db_params = get_db_params()
    conn = connect_with_retry(db_params)
    df = pl.read_database(
        "SELECT * FROM ranking_snapshots ORDER BY snapshot_date, event_id, rank",
        connection=conn,
    )
    df.write_csv(path)
    conn.close()
    logger.info(f"Exported {len(df):,} rows to {path}.")


def main():
    parser = ArgumentParser(description="Bootstrap WCA ranking snapshots locally.")
    parser.add_argument(
        "--months",
        type=int,
        default=240,
        help="How many months of history to compute (default: 240)",
    )
    parser.add_argument(
        "--export",
        metavar="FILE",
        help="After computing, export ranking_snapshots to this CSV path",
    )
    parser.add_argument(
        "--skip-download",
        action="store_true",
        help="Skip WCA download if results table already populated",
    )
    parser.add_argument(
        "--overwrite", action="store_true", help="Clear and re-generate all snapshots"
    )
    args = parser.parse_args()

    db_params = get_db_params()
    conn = connect_with_retry(db_params)

    if args.overwrite:
        with conn.cursor() as cursor:
            delete_snapshots(cursor)

    try:
        if not args.skip_download:
            download_and_extract()
            with conn:
                with conn.cursor() as cursor:
                    load_results_to_db(cursor)
                    create_ranking_snapshots_table(cursor)
        else:
            logger.info("Skipping download; using existing results table.")
            with conn:
                with conn.cursor() as cursor:
                    create_ranking_snapshots_table(cursor)

        start = first_of_month(date.today() - timedelta(days=args.months * 30))
        logger.info(f"Bootstrapping snapshots from {start} to today...")
        with conn.cursor() as cursor:
            bootstrap_snapshots(cursor, start)

    finally:
        if conn:
            conn.close()
        shutil.rmtree(TARGET_DIR, ignore_errors=True)

    if args.export:
        export_snapshots(args.export)


if __name__ == "__main__":
    main()
