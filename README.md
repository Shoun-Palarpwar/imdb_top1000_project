# IMDb Top 1000 — SQL Analysis Project

Analyzes a 1,000-film snapshot from Harshit Shankhdhar's
[IMDb Movies Dataset on Kaggle](https://www.kaggle.com/datasets/harshitshankhdhar/imdb-dataset-of-top-1000-movies-and-tv-shows).
The source file is `imdb_top_1000.csv`; this is a historical snapshot, not live IMDb data.

## Run locally

### The Double Feature website

```bash
python3 server.py --port 8017
```

Open [Double Feature locally](http://127.0.0.1:8017). The included database is ready
to use. No npm installation, Python packages, or build step is required. Stop the
server with Ctrl+C. To rebuild the data, use the pipeline commands below.

The site includes a cinematic door-opening entrance, a lobby, the dataset's origin
story, searchable film browsing with genre/decade filters and sorting, film detail
dialogs, a two-film comparison tray, and movie/director/actor comparisons. Separate
analysis rooms reveal nine live SQL reports with charts, tables, and CSV downloads.
The interface supports mobile layouts, keyboard controls, and reduced motion.

`server.py` serves `web/` and opens SQLite read-only. The API routes are
`/api/catalog`, `/api/report?name=gross_by_director`, and
`/api/compare?kind=movie&id=1&id=2`. Comparison averages exclude missing values and
include sample counts. Report SQL comes directly from `04_queries.sql`.

Poster links are optional metadata read from the source CSV; they are loaded from
the source image host with a title-card fallback if unavailable. Fonts load from
Google Fonts with local fallbacks. The app remains usable without those services.
This is a local application; public hosting and durable user accounts are not configured.

### Rebuild the data

Requires Python 3.9+; all dependencies are in the Python standard library.
From the project directory, run:

```bash
python3 01_clean_and_normalize.py
python3 03_load_data.py
python3 05_run_and_export.py
python3 -m unittest discover -s tests -v
```

If the raw CSV is absent, download and extract `imdb_top_1000.csv` from the dataset
link above into this directory. You can also skip the first command and use the
included normalized CSVs. The commands regenerate the normalized CSVs, database,
and reports respectively. The loader validates a replacement database before
updating the saved database, so invalid input leaves the existing database intact.

## Pipeline

| Step | File | What it does |
|---|---|---|
| 1 | `01_clean_and_normalize.py` | Cleans the raw CSV and splits it into 5 normalized CSVs |
| 2 | `02_schema.sql` | Tables, relationships, indexes, and value constraints |
| 3 | `03_load_data.py` | Builds `imdb_top1000.db` (SQLite) and loads the cleaned CSVs |
| 4 | `04_queries.sql` | Basic SELECTs, joins, all "Inspiration" analysis queries, and views |
| 5 | `05_run_and_export.py` | Runs the SQL and exports marked queries to `exports/` |

## Data cleaning applied

- **Released_Year**: cast to integer. One row (*Apollo 13*) had `"PG"` in this field in the
  source file (a known quirk of this Kaggle dataset) — corrected to its real release
  year, 1995, preserving the source certificate. Other malformed years raise an
  error; blank years remain unknown.
- **Runtime**: `"142 min"` → integer `142`.
- **Gross**: `"28,341,469"` → integer `28341469`; 169 rows have no gross figure and are
  left `NULL` rather than guessed at.
- **Meta_score**: 157 rows missing → `NULL`.
- **Certificate**: 101 rows missing → `NULL`.
- **Genre**: comma-separated string → normalized `movie_genres` bridge table (21 distinct genres).
- **Star1–Star4**: four flat columns → normalized `stars` + `movie_stars` tables (2,709 distinct
  people, billing order preserved). Repeated names within a movie retain their
  first billing slot; the reason for source duplicates is not established.
- Original overview punctuation is preserved; CSV quoting handles embedded quotes.
- The loader enforces foreign keys and numeric ranges, including ratings, runtime,
  votes, gross, and billing positions.

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

All in `04_queries.sql` section 3, and exported as CSVs. Each `-- export:` marker
identifies the exact query used by the exporter; no separate Python query copies
exist. Reports include every qualifying row, with deterministic ranking ties.
Gross rankings require at least 3 known values for directors, 5 for actors, and
2 for actor pairs. `film_count` / `films_together` include all matching films;
`gross_film_count` records the actual gross sample size.

| Question | Query | Export |
|---|---|---|
| Gross vs. director | 3a | `gross_by_director.csv` |
| Gross vs. stars | 3b | `gross_by_star.csv` |
| Votes vs. director | 3c | `votes_by_director.csv` |
| Votes vs. stars | 3d | `votes_by_star.csv` |
| Most frequent genre per actor (3+ films; ties alphabetical) | 3e | `actor_top_genre.csv` |
| Best actor combos by rating | 3f | `actor_pairs_by_rating.csv` |
| Best actor combos by gross | 3g | `actor_pairs_by_gross.csv` |
| *(bonus)* genre performance | 3h | `genre_overview.csv` |
| *(bonus)* rating trend by decade | 3i | `decade_trends.csv` |

## Headline findings

- **Highest-grossing directors (avg, 3+ films):** Anthony Russo ($551M avg), J.J. Abrams
  ($474M), James Cameron ($350M), David Yates ($326M), Peter Jackson ($319M).
- **Highest-grossing stars (avg, 5+ films):** Robert Downey Jr. ($447M), Chris Evans
  ($390M), Mark Ruffalo ($343M) — the Marvel ensemble dominates this list.
- **Best-rated actor pairs (2+ films together):** The *Lord of the Rings* ensemble —
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

SQLite is the tested runtime. PostgreSQL and MySQL require adapting concatenation,
ordered aggregation, numeric rounding, decade integer division, and CSV loading
(including empty fields as NULL). The Python loader and exporter are SQLite-specific;
the SQL is not advertised as executable unchanged on other databases.

## Interpretation limits

- These are selected, highly rated films, not a representative sample of all cinema
  or complete director/actor careers. Only the four source star fields are available.
- Genre frequency describes appearances, not an actor's personal preferences.
- Gross is the source's reported revenue, not profit, and is not inflation-adjusted.
  The data card does not precisely define its market coverage; avoid labeling it
  worldwide revenue. Missing gross is excluded from averages, not treated as zero.
- Multi-genre films contribute to multiple genre groups; the groups overlap.
  Revenue attributed to multiple actors is not additive across actor reports.
- Small samples, franchise concentration, and tiny rating differences should temper
  comparisons. Votes are snapshot counts, not ticket sales or current popularity.
- IDs follow source row order, and people are identified by name. Stable external
  IDs are needed before supporting refreshed datasets and durable shared links.

See [PRODUCT_IDEAS.md](PRODUCT_IDEAS.md) for the product direction and remaining
feature roadmap. The initial browsing, comparison, and reporting experience is
now implemented; recommendations, watchlists, and the connection explorer remain future work.
