# IMDb Top 1000 — SQL Analysis Project

Built from the real Kaggle dataset you uploaded (`imdb_top_1000.csv`, 1000 rows).

## Pipeline

| Step | File | What it does |
|---|---|---|
| 1 | `01_clean_and_normalize.py` | Cleans the raw CSV and splits it into 5 normalized CSVs |
| 2 | `02_schema.sql` | `CREATE TABLE` statements (portable to MySQL/Postgres/SQLite) |
| 3 | `03_load_data.py` | Builds `imdb_top1000.db` (SQLite) and loads the cleaned CSVs |
| 4 | `04_queries.sql` | Basic SELECTs, joins, all "Inspiration" analysis queries, and views |
| 5 | `05_run_and_export.py` | Runs everything, exports each result set to `/exports` |

## Data cleaning applied

- **Released_Year**: cast to integer. One row (*Apollo 13*) had `"PG"` in this field in the
  source file (a known quirk of this Kaggle dataset) — corrected to its real release
  year, 1995, with certificate set to "U".
- **Runtime**: `"142 min"` → integer `142`.
- **Gross**: `"28,341,469"` → integer `28341469`; 169 rows have no gross figure and are
  left `NULL` rather than guessed at.
- **Meta_score**: 157 rows missing → `NULL`.
- **Certificate**: 101 rows missing → `NULL`.
- **Genre**: comma-separated string → normalized `movie_genres` bridge table (21 distinct genres).
- **Star1–Star4**: four flat columns → normalized `stars` + `movie_stars` tables (2,709 distinct
  people, billing order preserved). A few movies credit the same person twice (dual roles,
  or a director who also stars) — only their first billing slot is kept.

## Schema

```
movies(movie_id PK, title, released_year, certificate, runtime_minutes,
       imdb_rating, overview, meta_score, director, no_of_votes, gross)
genres(genre_id PK, genre_name)
movie_genres(movie_id FK, genre_id FK)
stars(star_id PK, star_name)
movie_stars(movie_id FK, star_id FK, star_order)
```

## Every "Inspiration" question, answered

All in `04_queries.sql` section 3, and exported as CSVs:

| Question | Query | Export |
|---|---|---|
| Gross vs. director | 3a | `gross_by_director.csv` |
| Gross vs. stars | 3b | `gross_by_star.csv` |
| Votes vs. director | 3c | `votes_by_director.csv` |
| Votes vs. stars | 3d | `votes_by_star.csv` |
| Which genre each actor prefers | 3e | `actor_top_genre.csv` |
| Best actor combos by rating | 3f | `actor_pairs_by_rating.csv` |
| Best actor combos by gross | 3g | `actor_pairs_by_gross.csv` |
| *(bonus)* genre performance | 3h | `genre_overview.csv` |
| *(bonus)* rating trend by decade | 3i | `decade_trends.csv` |

## Headline findings

- **Highest-grossing directors (avg, 3+ films):** Anthony Russo ($551M avg), J.J. Abrams
  ($474M), James Cameron ($350M), David Yates ($326M), Peter Jackson ($319M).
- **Highest-grossing stars (avg, 5+ films):** Robert Downey Jr. ($447M), Chris Evans
  ($390M), Mark Ruffalo ($343M) — the Marvel ensemble dominates this list.
- **Best-rated actor pairs (2+ films together):** The *Lord of the Rings* trio —
  Elijah Wood, Ian McKellen, Orlando Bloom, Viggo Mortensen — sweep the top spots at 8.8 avg rating.
- **Genre ranking by avg rating:** War (8.01) and Western (8.00) narrowly edge out
  Sci-Fi (7.98); Horror is lowest at 7.89 — though the whole list only spans ~0.1 points
  since this is a *top 1000* dataset, already pre-filtered to well-regarded films.
- **Genre ranking by avg gross:** Adventure ($166M) and Sci-Fi ($148M) lead by a wide margin
  — blockbuster genres, as expected.
- **Decade trend:** see `decade_trends.csv` for the full breakdown of average rating and
  Metascore by decade.

## Reusable views

- `vw_movie_overview` — every movie with genres concatenated
- `vw_director_performance` — avg rating/votes/gross per director
- `vw_star_performance` — avg rating/votes/gross per star
- `vw_actor_pairs` — every co-starring pair with films-together count, avg rating, avg gross

## Running elsewhere

**PostgreSQL:**
```bash
psql -d imdb -f 02_schema.sql
psql -d imdb -c "\copy genres FROM 'genres.csv' CSV HEADER"
psql -d imdb -c "\copy movies FROM 'movies.csv' CSV HEADER"
psql -d imdb -c "\copy movie_genres FROM 'movie_genres.csv' CSV HEADER"
psql -d imdb -c "\copy stars FROM 'stars.csv' CSV HEADER"
psql -d imdb -c "\copy movie_stars FROM 'movie_stars.csv' CSV HEADER"
psql -d imdb -f 04_queries.sql
```
(Swap `GROUP_CONCAT` for `STRING_AGG` — noted inline.)

**MySQL:** run `02_schema.sql`, then `LOAD DATA LOCAL INFILE` each CSV in the same
order (genres → movies → movie_genres → stars → movie_stars), then run `04_queries.sql`.
