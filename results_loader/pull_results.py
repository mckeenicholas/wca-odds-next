import time
import io
import os
import shutil
import sys
import zipfile
import logging

import polars as pl
import psycopg2
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

WCA_RESULTS_ENDPOINT = "https://www.worldcubeassociation.org/export/results/v2/tsv"
TARGET_DIR = "./wca_data"
RESULTS_FILES = [
    "WCA_export_competitions.tsv",
    "WCA_export_results.tsv",
    "WCA_export_result_attempts.tsv",
    "WCA_export_persons.tsv",
]

required_env_vars = ["POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"]
missing_vars = [var for var in required_env_vars if not os.getenv(var)]
if missing_vars:
    logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
    sys.exit(1)

DB_PARAMS = {
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "database": os.getenv("POSTGRES_DB"),
    "user": os.getenv("POSTGRES_USER"),
    "password": os.getenv("POSTGRES_PASSWORD"),
    "port": os.getenv("POSTGRES_PORT", "5432"),
}

logger.debug(
    f"Database config: host={DB_PARAMS['host']} db={DB_PARAMS['database']} "
    f"user={DB_PARAMS['user']} port={DB_PARAMS['port']}"
)


def table_exists(cursor, table_name):
    cursor.execute(
        """
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = %s
        );
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


def download_and_extract():
    """Downloads the WCA export ZIP and extracts only the needed files."""
    logger.info(f"Downloading data from {WCA_RESULTS_ENDPOINT}...")
    if not os.path.exists(TARGET_DIR):
        os.makedirs(TARGET_DIR)

    response = requests.get(WCA_RESULTS_ENDPOINT, stream=True)
    if response.status_code == 200:
        with zipfile.ZipFile(io.BytesIO(response.content)) as z:
            logger.info(f"Extracting needed files to {TARGET_DIR}...")
            for filename in RESULTS_FILES:
                matching_files = [n for n in z.namelist() if n.endswith(filename)]
                if matching_files:
                    z.extract(matching_files[0], TARGET_DIR)
                else:
                    raise Exception(f"Required file {filename} not found")
        logger.info("Download and extraction complete.")
    else:
        raise Exception(f"Failed to download. Status: {response.status_code}")


def main(skip=True):
    conn = None
    retries = 5
    while retries > 0:
        try:
            logger.info(
                f"Attempting database connection to {DB_PARAMS['host']}:{DB_PARAMS['port']}..."
            )
            conn = psycopg2.connect(**DB_PARAMS)
            logger.info("Database connection successful.")
            break
        except psycopg2.OperationalError as e:
            retries -= 1
            error_msg = str(e)[:80]
            logger.warning(
                f"Database not ready ({error_msg}). Retrying in 5s ({retries} attempts left)"
            )
            time.sleep(5)

    if not conn:
        logger.error("Could not connect to database after all retries. Exiting.")
        return

    try:
        with conn:
            with conn.cursor() as cursor:
                if skip and table_exists(cursor, "results"):
                    logger.info("Table 'results' already exists, skipping data load")
                    return

        download_and_extract()

        with psycopg2.connect(**DB_PARAMS) as conn:
            conn.autocommit = False
            with conn.cursor() as cursor:
                # Set up staging tables for atomic table swap
                logger.info("Initializing staging tables...")
                cursor.execute("DROP TABLE IF EXISTS results_new CASCADE;")
                cursor.execute("DROP TABLE IF EXISTS persons_new CASCADE;")

                cursor.execute("""
                    CREATE TABLE results_new (
                        person_id VARCHAR(10),
                        event_id VARCHAR(50),
                        competition_date DATE,
                        value INTEGER
                    );
                """)

                cursor.execute("""
                    CREATE TABLE persons_new (
                        person_id VARCHAR(10),
                        name VARCHAR(255)
                    );
                """)

                # Load persons data
                logger.info("Loading persons data...")
                persons_df = pl.read_csv(
                    f"{TARGET_DIR}/WCA_export_persons.tsv",
                    separator="\t",
                    encoding="utf8-lossy",
                    quote_char=None,
                    null_values=["NULL"],
                ).select([pl.col("wca_id").alias("person_id"), pl.col("name")])

                logger.info(f"Streaming {len(persons_df)} persons to persons_new...")
                copy_to_db(cursor, persons_df, "persons_new")

                logger.info("Deduplicating persons in database...")
                cursor.execute("""
                    DELETE FROM persons_new a USING persons_new b
                    WHERE a.ctid < b.ctid 
                    AND a.person_id = b.person_id;
                """)

                cursor.execute("""
                    ALTER TABLE persons_new ADD PRIMARY KEY (person_id);
                """)

                # Load results data
                comp_lf = pl.scan_csv(
                    f"{TARGET_DIR}/WCA_export_competitions.tsv",
                    separator="\t",
                    encoding="utf8-lossy",
                    quote_char=None,
                    null_values=["NULL"],
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
                    null_values=["NULL"],
                ).select(
                    [
                        pl.col("id").alias("result_id"),
                        "person_id",
                        "event_id",
                        "competition_id",
                    ]
                )
                att_lf = pl.scan_csv(
                    f"{TARGET_DIR}/WCA_export_result_attempts.tsv",
                    separator="\t",
                    encoding="utf8-lossy",
                    quote_char=None,
                    null_values=["NULL"],
                ).select(["result_id", "value"])

                final_lf = (
                    att_lf.join(res_lf, on="result_id", how="inner")
                    .join(comp_lf, on="competition_id", how="left")
                    .select(["person_id", "event_id", "competition_date", "value"])
                )

                logger.info("Executing query and collecting results...")
                final_df = final_lf.collect(engine="streaming")

                logger.info(f"Streaming {len(final_df)} rows to results_new...")
                copy_to_db(cursor, final_df, "results_new")

                # Build indexes
                logger.info("Building indexes on staging tables...")
                cursor.execute("""
                    CREATE INDEX idx_results_person_new 
                    ON results_new(person_id, event_id, competition_date DESC);
                """)

                # Swap tables atomically
                logger.info("Performing table swap...")
                try:
                    cursor.execute("BEGIN;")
                    cursor.execute("DROP TABLE IF EXISTS results CASCADE;")
                    cursor.execute("DROP TABLE IF EXISTS persons CASCADE;")
                    cursor.execute("ALTER TABLE results_new RENAME TO results;")
                    cursor.execute("ALTER TABLE persons_new RENAME TO persons;")
                    cursor.execute(
                        "ALTER INDEX idx_results_person_new RENAME TO idx_results_person;"
                    )
                    conn.commit()
                    logger.info("SWAP SUCCESSFUL. Live DB updated.")
                except Exception as e:
                    conn.rollback()
                    raise e

        logger.info("Pipeline complete.")

    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
    finally:
        if os.path.exists(TARGET_DIR):
            logger.info("Removing temp dir")
            shutil.rmtree(TARGET_DIR)


if __name__ == "__main__":
    skip_if_loaded = sys.argv[1].lower() == "-s" if len(sys.argv) > 1 else False

    main(skip_if_loaded)
