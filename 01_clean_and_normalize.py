"""
01_clean_and_normalize.py
--------------------------
Cleans the raw Kaggle "IMDb Top 1000" CSV and reshapes it into a normalized
set of CSVs matching the star-schema-ish design in 02_schema.sql:

  movies(movie_id, title, released_year, certificate, runtime_minutes,
         imdb_rating, overview, meta_score, director, no_of_votes, gross)
  genres(genre_id, genre_name)
  movie_genres(movie_id, genre_id)
  stars(star_id, star_name)
  movie_stars(movie_id, star_id, star_order)   -- star_order 1-4, preserves Star1..Star4

Cleaning steps applied:
  - Released_Year: cast to int. One known bad row ("PG" for Apollo 13, a
    documented quirk of this Kaggle dataset) is corrected to 1995 using the
    film's real-world release year; the source certificate is preserved.
  - Runtime: "142 min" -> integer minutes (142)
  - Gross: "28,341,469" -> integer 28341469; blank -> NULL (169 missing rows,
    left as NULL rather than guessed)
  - Meta_score / Certificate: blank -> NULL (157 / 101 missing rows)
  - Genre: comma-separated string -> normalized movie_genres rows
  - Star1..Star4: four columns -> normalized movie_stars rows (order kept)
"""

import csv
import os
import re

DIR = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(DIR, "imdb_top_1000.csv")

def clean_runtime(val):
    if not val.strip():
        return None
    m = re.fullmatch(r"(\d+)\s+min", val.strip())
    if not m or int(m.group(1)) <= 0:
        raise ValueError(f"Invalid runtime: {val!r}")
    return int(m.group(1))

def clean_year(title, val):
    val = val.strip()
    if title == "Apollo 13" and val == "PG":
        return 1995
    if not val:
        return None
    if not re.fullmatch(r"\d{4}", val):
        raise ValueError(f"Invalid release year for {title!r}: {val!r}")
    return int(val)

def clean_gross(val):
    val = val.strip()
    if not val:
        return None
    return int(val.replace(",", ""))

def clean_int(val):
    val = val.strip()
    return int(val) if val else None

def main():
    with open(SRC, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        raw_rows = list(reader)

    movies_rows = []
    genre_name_to_id = {}
    genre_rows = []
    movie_genre_rows = []
    star_name_to_id = {}
    star_rows = []
    movie_star_rows = []

    for i, r in enumerate(raw_rows, start=1):
        title = r["Series_Title"].strip()

        # --- known data-quality fix ---
        year_raw = r["Released_Year"].strip()
        cert = r["Certificate"].strip() or None
        year = clean_year(title, year_raw)

        runtime = clean_runtime(r["Runtime"])
        rating = float(r["IMDB_Rating"]) if r["IMDB_Rating"].strip() else None
        meta = clean_int(r["Meta_score"]) if r["Meta_score"].strip() else None
        director = r["Director"].strip()
        votes = clean_int(r["No_of_Votes"])
        gross = clean_gross(r["Gross"])
        overview = r["Overview"].strip()

        movies_rows.append((i, title, year, cert, runtime, rating, overview,
                             meta, director, votes, gross))

        # Genres
        for g in dict.fromkeys(g.strip() for g in r["Genre"].split(",") if g.strip()):
            if g not in genre_name_to_id:
                gid = len(genre_name_to_id) + 1
                genre_name_to_id[g] = gid
                genre_rows.append((gid, g))
            movie_genre_rows.append((i, genre_name_to_id[g]))

        # Stars (Star1..Star4), preserving billing order.
        # A handful of source rows list the same person twice; keep the first slot
        # since (movie_id, star_id) is the primary key.
        seen_star_ids_this_movie = set()
        for order, key in enumerate(["Star1", "Star2", "Star3", "Star4"], start=1):
            name = r[key].strip()
            if not name:
                continue
            if name not in star_name_to_id:
                sid = len(star_name_to_id) + 1
                star_name_to_id[name] = sid
                star_rows.append((sid, name))
            sid = star_name_to_id[name]
            if sid in seen_star_ids_this_movie:
                continue
            seen_star_ids_this_movie.add(sid)
            movie_star_rows.append((i, sid, order))

    def write_csv(path, header, rows):
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(header)
            w.writerows(rows)
        print(f"{path.split('/')[-1]}: {len(rows)} rows")

    write_csv(os.path.join(DIR, "movies.csv"),
              ["movie_id", "title", "released_year", "certificate", "runtime_minutes",
               "imdb_rating", "overview", "meta_score", "director", "no_of_votes", "gross"],
              movies_rows)
    write_csv(os.path.join(DIR, "genres.csv"), ["genre_id", "genre_name"], genre_rows)
    write_csv(os.path.join(DIR, "movie_genres.csv"), ["movie_id", "genre_id"], movie_genre_rows)
    write_csv(os.path.join(DIR, "stars.csv"), ["star_id", "star_name"], star_rows)
    write_csv(os.path.join(DIR, "movie_stars.csv"), ["movie_id", "star_id", "star_order"], movie_star_rows)

    print(f"\nTotal movies: {len(movies_rows)}")
    print(f"Unique genres: {len(genre_rows)}")
    print(f"Unique stars: {len(star_rows)}")
    print(f"Missing gross: {sum(1 for m in movies_rows if m[10] is None)}")
    print(f"Missing meta_score: {sum(1 for m in movies_rows if m[7] is None)}")
    print(f"Missing certificate: {sum(1 for m in movies_rows if m[3] is None)}")

if __name__ == "__main__":
    main()
