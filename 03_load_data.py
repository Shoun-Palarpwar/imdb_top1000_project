"""
03_load_data.py
-----------------
Creates imdb_top1000.db (SQLite) by running 02_schema.sql, then bulk-loads
the normalized CSVs produced by 01_clean_and_normalize.py.

Postgres equivalent:
  psql -d imdb -f 02_schema.sql
  \copy movies FROM 'movies.csv' CSV HEADER
  \copy genres FROM 'genres.csv' CSV HEADER
  \copy movie_genres FROM 'movie_genres.csv' CSV HEADER
  \copy stars FROM 'stars.csv' CSV HEADER
  \copy movie_stars FROM 'movie_stars.csv' CSV HEADER

MySQL equivalent:
  mysql imdb < 02_schema.sql
  LOAD DATA LOCAL INFILE 'movies.csv' INTO TABLE movies
    FIELDS TERMINATED BY ',' ENCLOSED BY '"' LINES TERMINATED BY '\n' IGNORE 1 ROWS;
  (repeat per CSV)
"""

import sqlite3
import csv
import os

DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(DIR, "imdb_top1000.db")

def main():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    with open(os.path.join(DIR, "02_schema.sql"), encoding="utf-8") as f:
        cur.executescript(f.read())

    def to_none(v):
        return None if v == "" else v

    def load_csv(path, table, cols, int_cols=(), float_cols=()):
        with open(path, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = []
            for r in reader:
                row = []
                for c in cols:
                    v = to_none(r[c])
                    if v is not None and c in int_cols:
                        v = int(v)
                    elif v is not None and c in float_cols:
                        v = float(v)
                    row.append(v)
                rows.append(tuple(row))
        placeholders = ",".join(["?"] * len(cols))
        cur.executemany(f"INSERT INTO {table} ({','.join(cols)}) VALUES ({placeholders})", rows)
        print(f"Loaded {len(rows)} rows into {table}")

    load_csv(os.path.join(DIR, "genres.csv"), "genres", ["genre_id", "genre_name"])
    load_csv(os.path.join(DIR, "movies.csv"), "movies",
              ["movie_id", "title", "released_year", "certificate", "runtime_minutes",
               "imdb_rating", "overview", "meta_score", "director", "no_of_votes", "gross"],
              int_cols={"movie_id", "released_year", "runtime_minutes", "meta_score",
                        "no_of_votes", "gross"},
              float_cols={"imdb_rating"})
    load_csv(os.path.join(DIR, "movie_genres.csv"), "movie_genres", ["movie_id", "genre_id"])
    load_csv(os.path.join(DIR, "stars.csv"), "stars", ["star_id", "star_name"])
    load_csv(os.path.join(DIR, "movie_stars.csv"), "movie_stars",
              ["movie_id", "star_id", "star_order"])

    conn.commit()

    for t in ("movies", "genres", "movie_genres", "stars", "movie_stars"):
        cur.execute(f"SELECT COUNT(*) FROM {t}")
        print(t, "row count:", cur.fetchone()[0])

    conn.close()
    print(f"\nSQLite database ready at: {DB_PATH}")

if __name__ == "__main__":
    main()
