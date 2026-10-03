"""Create views and export the marked queries in 04_queries.sql verbatim."""

import csv
from pathlib import Path
import sqlite3

DIR = Path(__file__).resolve().parent


def export_queries(sql):
    """Read each '-- export: filename.csv' and its following SQL statement."""
    filename = None
    statement = ""
    for line in sql.splitlines(keepends=True):
        if line.startswith("-- export: "):
            if filename is not None:
                raise ValueError(f"Unterminated export query: {filename}")
            filename = line.removeprefix("-- export: ").strip()
            if Path(filename).name != filename or not filename.endswith(".csv"):
                raise ValueError(f"Invalid export filename: {filename}")
            statement = ""
        elif filename is not None:
            statement += line
            if sqlite3.complete_statement(statement):
                yield filename, statement
                filename = None
    if filename is not None:
        raise ValueError(f"Unterminated export query: {filename}")


def main():
    db_path = DIR / "imdb_top1000.db"
    if not db_path.is_file():
        raise FileNotFoundError("Run 03_load_data.py before exporting reports.")
    sql = (DIR / "04_queries.sql").read_text(encoding="utf-8")
    queries = list(export_queries(sql))
    export_dir = DIR / "exports"
    export_dir.mkdir(exist_ok=True)
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.executescript(sql)
        for filename, query in queries:
            result = conn.execute(query)
            rows = result.fetchall()
            with (export_dir / filename).open("w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(column[0] for column in result.description)
                writer.writerows(rows)
            print(f"Exported {len(rows)} rows -> {filename}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
