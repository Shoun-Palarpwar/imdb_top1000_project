"""
05_run_and_export.py
----------------------
Creates views and runs the "Inspiration" analysis queries against
imdb_top1000.db, exporting each result set to /exports as CSV.
"""

import sqlite3
import csv
import os

DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(DIR, "imdb_top1000.db")
EXPORT_DIR = os.path.join(DIR, "exports")
os.makedirs(EXPORT_DIR, exist_ok=True)

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

with open(os.path.join(DIR, "04_queries.sql"), encoding="utf-8") as f:
    full_sql = f.read()
idx = full_sql.index("DROP VIEW IF EXISTS vw_movie_overview")
cur.executescript(full_sql[idx:])
conn.commit()

def export(query, filename):
    cur.execute(query)
    cols = [d[0] for d in cur.description]
    rows = cur.fetchall()
    path = os.path.join(EXPORT_DIR, filename)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(cols)
        w.writerows(rows)
    print(f"Exported {len(rows)} rows -> {filename}")

# Gross vs Director
export("""
    SELECT director, film_count, avg_rating, avg_votes, avg_gross
    FROM vw_director_performance
    WHERE film_count >= 3 AND avg_gross IS NOT NULL
    ORDER BY avg_gross DESC
""", "gross_by_director.csv")

# Gross vs Stars
export("""
    SELECT star_name, film_count, avg_rating, avg_votes, avg_gross
    FROM vw_star_performance
    WHERE film_count >= 5 AND avg_gross IS NOT NULL
    ORDER BY avg_gross DESC
""", "gross_by_star.csv")

# Votes vs Director
export("""
    SELECT director, film_count, avg_rating, avg_votes
    FROM vw_director_performance
    WHERE film_count >= 3
    ORDER BY avg_votes DESC
""", "votes_by_director.csv")

# Votes vs Stars
export("""
    SELECT star_name, film_count, avg_rating, avg_votes
    FROM vw_star_performance
    WHERE film_count >= 5
    ORDER BY avg_votes DESC
""", "votes_by_star.csv")

# Actor's top genre
export("""
    SELECT star_name, genre_name, appearances
    FROM (
        SELECT s.star_name, g.genre_name, COUNT(*) AS appearances,
               ROW_NUMBER() OVER (PARTITION BY s.star_name ORDER BY COUNT(*) DESC) AS rn
        FROM stars s
        JOIN movie_stars ms ON s.star_id = ms.star_id
        JOIN movie_genres mg ON ms.movie_id = mg.movie_id
        JOIN genres g ON mg.genre_id = g.genre_id
        GROUP BY s.star_name, g.genre_name
    ) ranked
    WHERE rn = 1
    ORDER BY appearances DESC
""", "actor_top_genre.csv")

# Actor pairs - by rating
export("""
    SELECT actor_a, actor_b, films_together, avg_rating, avg_gross
    FROM vw_actor_pairs
    WHERE films_together >= 2
    ORDER BY avg_rating DESC, films_together DESC
""", "actor_pairs_by_rating.csv")

# Actor pairs - by gross
export("""
    SELECT actor_a, actor_b, films_together, avg_rating, avg_gross
    FROM vw_actor_pairs
    WHERE films_together >= 2 AND avg_gross IS NOT NULL
    ORDER BY avg_gross DESC
""", "actor_pairs_by_gross.csv")

# Genre overview
export("""
    SELECT g.genre_name,
           COUNT(DISTINCT m.movie_id) AS movie_count,
           ROUND(AVG(m.imdb_rating),2) AS avg_rating,
           ROUND(AVG(m.gross),0) AS avg_gross
    FROM genres g
    JOIN movie_genres mg ON g.genre_id = mg.genre_id
    JOIN movies m ON mg.movie_id = m.movie_id
    GROUP BY g.genre_name
    ORDER BY avg_rating DESC
""", "genre_overview.csv")

# Decade trends
export("""
    SELECT (released_year/10)*10 AS decade, COUNT(*) AS movie_count,
           ROUND(AVG(imdb_rating),2) AS avg_rating,
           ROUND(AVG(meta_score),1) AS avg_meta_score
    FROM movies
    GROUP BY decade
    ORDER BY decade
""", "decade_trends.csv")

# Full movie overview
export("SELECT * FROM vw_movie_overview ORDER BY imdb_rating DESC", "movie_overview_full.csv")

conn.close()
print("\nAll exports complete.")
