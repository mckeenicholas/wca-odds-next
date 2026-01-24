import time
import io
import os
import shutil
import sys
import zipfile

import polars as pl
import psycopg2
import requests

WCA_RESULTS_ENDPOINT = "https://www.worldcubeassociation.org/export/results/v2/tsv"
TARGET_DIR = "./wca_data"
RESULTS_FILES = [
    "WCA_export_competitions.tsv",
    "WCA_export_results.tsv",
    "WCA_export_result_attempts.tsv",
    "WCA_export_persons.tsv",
]
DB_PARAMS = {
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "database": os.getenv("POSTGRES_DB"),
    "user": os.getenv("POSTGRES_USER"),
    "password": os.getenv("POSTGRES_PASSWORD"),
    "port": os.getenv("POSTGRES_PORT", "5432"),
}


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
    print(f"Downloading data from {WCA_RESULTS_ENDPOINT}...")
    if not os.path.exists(TARGET_DIR):
        os.makedirs(TARGET_DIR)

    response = requests.get(WCA_RESULTS_ENDPOINT, stream=True)
    if response.status_code == 200:
        with zipfile.ZipFile(io.BytesIO(response.content)) as z:
            print(f"Extracting needed files to {TARGET_DIR}...")
            for filename in RESULTS_FILES:
                matching_files = [n for n in z.namelist() if n.endswith(filename)]
                if matching_files:
                    z.extract(matching_files[0], TARGET_DIR)
                else:
                    raise Exception(f"Required file {filename} not found")
        print("Download and extraction complete.")
    else:
        raise Exception(f"Failed to download. Status: {response.status_code}")


def main(skip=True):
    conn = None
    retries = 5
    while retries > 0:
        try:
            conn = psycopg2.connect(**DB_PARAMS)
            break
        except psycopg2.OperationalError:
            retries -= 1
            print(f"Database not ready... retrying in 5s ({retries} attempts left)")
            time.sleep(5)

    if not conn:
        print("Could not connect to database. Exiting.")
        return

    try:
        with conn:
            with conn.cursor() as cursor:
                if skip and table_exists(cursor, "results"):
                    print("Table 'results' already exists, exiting")
                    return

        download_and_extract()

        with psycopg2.connect(**DB_PARAMS) as conn:
            conn.autocommit = False
            with conn.cursor() as cursor:
                # Set up staging tables for atomic table swap
                print("Initializing staging tables...")
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
                print("Loading persons data...")
                persons_df = pl.read_csv(
                    f"{TARGET_DIR}/WCA_export_persons.tsv",
                    separator="\t",
                    encoding="utf8-lossy",
                    quote_char=None,
                    null_values=["NULL"],
                ).select([pl.col("wca_id").alias("person_id"), pl.col("name")])

                print(f"Streaming {len(persons_df)} persons to persons_new...")
                copy_to_db(cursor, persons_df, "persons_new")

                print("Deduplicating persons in database...")
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

                print("Executing query and collecting results...")
                final_df = final_lf.collect(engine="streaming")

                print(f"Streaming {len(final_df)} rows to results_new...")
                copy_to_db(cursor, final_df, "results_new")

                # Build indexes
                print("Building indexes on staging tables...")
                cursor.execute("""
                    CREATE INDEX idx_results_person_new 
                    ON results_new(person_id, event_id, competition_date DESC);
                """)

                # Swap tables atomically
                print("Performing table swap...")
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
                    print("SWAP SUCCESSFUL. Live DB updated.")
                except Exception as e:
                    conn.rollback()
                    raise e

        print("Pipeline complete.")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        if os.path.exists(TARGET_DIR):
            print("Removing temp dir")
            shutil.rmtree(TARGET_DIR)


if __name__ == "__main__":
    skip_if_loaded = sys.argv[1].lower() == "-s" if len(sys.argv) > 1 else False

    main(skip_if_loaded)
