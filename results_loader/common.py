import io
import logging
import math
import os
import sys
import time
import zipfile
from datetime import date, timedelta

import polars as pl
import psycopg2
import requests
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

# --- Constants ---
WCA_RESULTS_ENDPOINT = "https://www.worldcubeassociation.org/export/results/v2/tsv"
TARGET_DIR = "./wca_data"
RESULTS_FILES = [
    "WCA_export_competitions.tsv",
    "WCA_export_results.tsv",
    "WCA_export_result_attempts.tsv",
    "WCA_export_persons.tsv",
    "WCA_export_countries.tsv",
]

EWMA_HALF_LIFE_DAYS = 90
EWMA_LOOKBACK_DAYS = 365
MIN_SOLVES_FOR_RANKING = 10
EWMA_DECAY_RATE = math.log(2) / EWMA_HALF_LIFE_DAYS

ALL_EVENTS = [
    "222",
    "333",
    "333bf",
    "333fm",
    "333oh",
    "444",
    "444bf",
    "555",
    "555bf",
    "666",
    "777",
    "clock",
    "minx",
    "pyram",
    "skewb",
    "sq1",
]

MULTI_COUNTRY_IDS = {
    "XA",
    "XE",
    "XF",
    "XM",
    "XN",
    "XO",
    "XS",
    "XW",
}

# --- DB Connection ---


def get_db_params():
    required = ["POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"]
    missing = [v for v in required if not os.getenv(v)]
    if missing:
        logger.error(f"Missing required environment variables: {', '.join(missing)}")
        sys.exit(1)
    return {
        "host": os.getenv("POSTGRES_HOST", "localhost"),
        "database": os.getenv("POSTGRES_DB"),
        "user": os.getenv("POSTGRES_USER"),
        "password": os.getenv("POSTGRES_PASSWORD"),
        "port": os.getenv("POSTGRES_PORT", "5432"),
    }


def connect_with_retry(db_params, retries=5, delay=5):
    for attempt in range(retries):
        try:
            conn = psycopg2.connect(**db_params)
            logger.info("Database connection successful.")
            return conn
        except psycopg2.OperationalError:
            remaining = retries - attempt - 1
            logger.warning(
                f"Database not ready. Retrying in {delay}s ({remaining} left)"
            )
            time.sleep(delay)
    logger.error("Could not connect to database.")
    sys.exit(1)


# --- DB Utilities ---


def table_exists(cursor, table_name):
    cursor.execute(
        """
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = %s
        )
        """,
        (table_name,),
    )
    return cursor.fetchone()[0]


def copy_to_db(cursor, df, table_name):
    buffer = io.BytesIO()
    df.write_csv(buffer, include_header=False, null_value="")
    buffer.seek(0)
    columns = ",".join([f'"{c}"' for c in df.columns])
    sql = f"COPY {table_name} ({columns}) FROM STDIN WITH (FORMAT CSV, HEADER FALSE, NULL '')"
    cursor.copy_expert(sql, buffer)


# --- WCA Data Download ---


def download_and_extract():
    logger.info(f"Downloading data from {WCA_RESULTS_ENDPOINT}...")
    os.makedirs(TARGET_DIR, exist_ok=True)
    response = requests.get(WCA_RESULTS_ENDPOINT, stream=True)
    if response.status_code != 200:
        raise RuntimeError(
            f"Failed to download WCA data. Status: {response.status_code}"
        )

    with zipfile.ZipFile(io.BytesIO(response.content)) as z:
        logger.info(f"Extracting needed files to {TARGET_DIR}...")
        for filename in RESULTS_FILES:
            matches = [n for n in z.namelist() if n.endswith(filename)]
            if not matches:
                raise RuntimeError(f"Required file {filename} not found in archive")
            z.extract(matches[0], TARGET_DIR)
    logger.info("Download and extraction complete.")


def load_results_to_db(cursor):
    """Load persons + results from extracted TSVs into results/persons tables,
    swapping atomically via _new staging tables."""
    logger.info("Initializing staging tables...")
    cursor.execute(
        "DROP TABLE IF EXISTS results_new CASCADE;"
        "DROP TABLE IF EXISTS persons_new CASCADE;"
        "DROP TABLE IF EXISTS countries_new CASCADE;"
    )
    cursor.execute(
        "CREATE TABLE results_new ("
        "  person_id VARCHAR(10), event_id VARCHAR(50),"
        "  competition_date DATE, value INTEGER"
        ");"
    )
    cursor.execute(
        "CREATE TABLE countries_new ("
        "  id VARCHAR(50) PRIMARY KEY,"
        "  iso2 CHAR(2),"
        "  name VARCHAR(100),"
        "  continent_id VARCHAR(20)"
        ");"
    )
    cursor.execute(
        "CREATE TABLE persons_new ("
        "  person_id VARCHAR(10),"
        "  name VARCHAR(255),"
        "  country_id VARCHAR(50) REFERENCES countries_new(id)"
        ");"
    )

    countries_df = (
        pl.read_csv(
            f"{TARGET_DIR}/WCA_export_countries.tsv",
            separator="\t",
            encoding="utf8-lossy",
            quote_char=None,
        )
        .select(["id", "iso2", "name", "continent_id"])
        .filter(~pl.col("id").is_in(MULTI_COUNTRY_IDS))
    )
    copy_to_db(cursor, countries_df, "countries_new")

    persons_df = (
        pl.read_csv(
            f"{TARGET_DIR}/WCA_export_persons.tsv",
            separator="\t",
            encoding="utf8-lossy",
            quote_char=None,
        )
        .filter(pl.col("sub_id").eq(1))
        .select(
            [pl.col("wca_id").alias("person_id"), pl.col("name"), pl.col("country_id")]
        )
    )
    
    copy_to_db(cursor, persons_df, "persons_new")

    cursor.execute(
        "DELETE FROM persons_new a USING persons_new b"
        " WHERE a.ctid < b.ctid AND a.person_id = b.person_id;"
    )
    cursor.execute("ALTER TABLE persons_new ADD PRIMARY KEY (person_id);")

    comp_lf = pl.scan_csv(
        f"{TARGET_DIR}/WCA_export_competitions.tsv",
        separator="\t",
        encoding="utf8-lossy",
        quote_char=None,
    ).select(
        [
            pl.col("id").alias("competition_id"),
            pl.date(pl.col("year"), pl.col("month"), pl.col("day")).alias(
                "competition_date"
            ),
        ]
    )
    res_lf = pl.scan_csv(
        f"{TARGET_DIR}/WCA_export_results.tsv",
        separator="\t",
        encoding="utf8-lossy",
        quote_char=None,
    ).select(["id", "person_id", "event_id", "competition_id"])
    att_lf = pl.scan_csv(
        f"{TARGET_DIR}/WCA_export_result_attempts.tsv",
        separator="\t",
        encoding="utf8-lossy",
        quote_char=None,
    ).select(["result_id", "value"])

    final_df = (
        att_lf.join(res_lf, left_on="result_id", right_on="id")
        .join(comp_lf, on="competition_id")
        .select(["person_id", "event_id", "competition_date", "value"])
        .collect(engine="streaming")
    )
    copy_to_db(cursor, final_df, "results_new")

    logger.info("Building indexes and swapping tables...")
    cursor.execute(
        "CREATE INDEX idx_results_person_new"
        " ON results_new(person_id, event_id, competition_date DESC);"
    )
    cursor.execute(
        "DROP TABLE IF EXISTS results CASCADE;"
        "DROP TABLE IF EXISTS persons CASCADE;"
        "DROP TABLE IF EXISTS countries CASCADE;"
    )
    cursor.execute(
        "ALTER TABLE results_new RENAME TO results;"
        "ALTER TABLE persons_new RENAME TO persons;"
        "ALTER TABLE countries_new RENAME TO countries;"
    )
    cursor.execute("ALTER INDEX idx_results_person_new RENAME TO idx_results_person;")


# --- Snapshot Schema ---


def create_ranking_snapshots_table(cursor):
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ranking_snapshots (
            snapshot_date  DATE        NOT NULL,
            person_id      VARCHAR(10) NOT NULL,
            event_id       VARCHAR(50) NOT NULL,
            value          REAL        NOT NULL,
            rank           INTEGER     NOT NULL,
            PRIMARY KEY (snapshot_date, event_id, rank)
        );
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_snapshots_person
        ON ranking_snapshots(person_id, event_id, snapshot_date DESC);
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_results_event_date
        ON results(event_id, competition_date DESC)
        INCLUDE (person_id, value);
    """)


# --- Snapshot Computation ---


def compute_snapshot_for_date(cursor, snapshot_date):
    lookback_date = snapshot_date - timedelta(days=EWMA_LOOKBACK_DAYS)
    cursor.execute(
        "DELETE FROM ranking_snapshots WHERE snapshot_date = %s", (snapshot_date,)
    )

    cursor.execute(
        """
        SELECT person_id, event_id, competition_date, value
        FROM results
        WHERE value > 0
          AND competition_date BETWEEN %s AND %s
          AND event_id = ANY(%s)
        """,
        (lookback_date, snapshot_date, list(ALL_EVENTS)),
    )
    rows = cursor.fetchall()
    if not rows:
        logger.warning(f"No results found for snapshot {snapshot_date}, skipping.")
        return

    df = pl.DataFrame(
        rows,
        orient="row",
        schema={
            "person_id": pl.String,
            "event_id": pl.String,
            "competition_date": pl.Date,
            "value": pl.Int32,
        },
    )

    df = df.with_columns(
        (
            (pl.lit(snapshot_date).cast(pl.Date) - pl.col("competition_date"))
            .dt.total_days()
            .cast(pl.Float64)
            .mul(-EWMA_DECAY_RATE)
            .exp()
        ).alias("weight")
    ).with_columns(
        (pl.col("value").cast(pl.Float64) * pl.col("weight")).alias("weighted_value")
    )

    ewma_df = (
        df.group_by(["person_id", "event_id"])
        .agg(
            (pl.col("weighted_value").sum() / pl.col("weight").sum()).alias("ewma"),
            pl.len().alias("n_solves"),
        )
        .filter(pl.col("n_solves") >= MIN_SOLVES_FOR_RANKING)
    )

    ewma_df = ewma_df.with_columns(
        pl.col("ewma")
        .rank(method="ordinal")
        .over("event_id")
        .cast(pl.Int32)
        .alias("rank")
    )

    per_event_df = ewma_df.with_columns(
        pl.lit(snapshot_date).alias("snapshot_date")
    ).select(
        [
            pl.col("snapshot_date"),
            pl.col("person_id"),
            pl.col("event_id"),
            pl.when(pl.col("event_id") == "333fm")
            .then(pl.col("ewma") * 100)
            .otherwise(pl.col("ewma"))
            .cast(pl.Float32)
            .alias("value"),
            pl.col("rank"),
        ]
    )
    copy_to_db(cursor, per_event_df, "ranking_snapshots")

    _compute_global_rankings(cursor, snapshot_date, ewma_df)


def _compute_global_rankings(cursor, snapshot_date, ewma_df):
    all_persons = ewma_df.select("person_id").unique()
    all_events_df = pl.DataFrame({"event_id": ALL_EVENTS})

    cross = all_persons.join(all_events_df, how="cross").join(
        ewma_df.select(["person_id", "event_id", "rank", "ewma"]),
        on=["person_id", "event_id"],
        how="left",
    )

    max_ranks = ewma_df.group_by("event_id").agg(
        (pl.col("rank").max() + 1).alias("penalty")
    )
    cross = cross.join(max_ranks, on="event_id", how="left").with_columns(
        pl.when(pl.col("rank").is_null())
        .then(pl.col("penalty"))
        .otherwise(pl.col("rank"))
        .alias("rank_filled")
    )

    # "all": sum of ranks
    all_df = (
        cross.group_by("person_id")
        .agg(pl.col("rank_filled").sum().cast(pl.Float64).alias("value"))
        .sort("value")
        .with_row_index("rank", offset=1)
        .with_columns(
            pl.lit(snapshot_date).alias("snapshot_date"),
            pl.lit("all").alias("event_id"),
            pl.col("rank").cast(pl.Int32),
        )
        .select(["snapshot_date", "person_id", "event_id", "value", "rank"])
    )
    copy_to_db(cursor, all_df, "ranking_snapshots")

    # Kinch
    wr_df = ewma_df.filter(pl.col("rank") == 1).select(
        ["event_id", pl.col("ewma").alias("wr_ewma")]
    )
    kinch_base = (
        cross.filter(pl.col("ewma").is_not_null())
        .join(wr_df, on="event_id", how="left")
        .filter(pl.col("wr_ewma").is_not_null())
        .with_columns((100.0 * pl.col("wr_ewma") / pl.col("ewma")).alias("kinch_score"))
    )

    n_events = len(ALL_EVENTS)
    for metric_key, agg_expr in [
        ("kinch", pl.col("kinch_score").mean()),
        ("kinch_strict", pl.col("kinch_score").sum() / n_events),
    ]:
        metric_df = (
            kinch_base.group_by("person_id")
            .agg(agg_expr.alias("value"))
            .sort("value", descending=True)
            .with_row_index("rank", offset=1)
            .with_columns(
                pl.lit(snapshot_date).alias("snapshot_date"),
                pl.lit(metric_key).alias("event_id"),
                pl.col("rank").cast(pl.Int32),
            )
            .select(["snapshot_date", "person_id", "event_id", "value", "rank"])
        )
        copy_to_db(cursor, metric_df, "ranking_snapshots")


# --- Date Helpers ---


def first_of_month(d):
    return date(d.year, d.month, 1)


def subtract_month(d):
    if d.month == 1:
        return date(d.year - 1, 12, 1)
    return date(d.year, d.month - 1, 1)
