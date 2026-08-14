-- ============================================================
-- 04_queries.sql
-- Basic queries, joins, and the full "Inspiration" analysis list
-- from the Kaggle IMDb Top 1000 dataset description.
-- Written for SQLite/PostgreSQL. MySQL: swap GROUP_CONCAT for
-- GROUP_CONCAT(... SEPARATOR ', ') (same name, different syntax);
-- Postgres: swap for STRING_AGG(x, ', ').
-- ============================================================

-- --------------------------------------------------------------
-- 1. BASIC QUERIES: SELECT / WHERE / ORDER BY
-- --------------------------------------------------------------

-- 1a. Movies rated 9.0+
SELECT title, released_year, imdb_rating
FROM movies
WHERE imdb_rating >= 9.0
ORDER BY imdb_rating DESC;

-- 1b. Movies released in the 2010s, highest grossing first
SELECT title, released_year, gross
FROM movies
WHERE released_year BETWEEN 2010 AND 2019
  AND gross IS NOT NULL
ORDER BY gross DESC
LIMIT 15;

-- 1c. Longest movies in the list
SELECT title, runtime_minutes, director
FROM movies
ORDER BY runtime_minutes DESC
LIMIT 10;


-- --------------------------------------------------------------
-- 2. JOINS
-- --------------------------------------------------------------

-- 2a. Movies with their genre list (many-to-many join, aggregated)
SELECT m.title, GROUP_CONCAT(g.genre_name, ', ') AS genres
FROM movies m
JOIN movie_genres mg ON m.movie_id = mg.movie_id
JOIN genres g ON mg.genre_id = g.genre_id
GROUP BY m.movie_id, m.title
ORDER BY m.title
LIMIT 15;

-- 2b. Movies with their full cast (Star1..Star4 normalized back out, in order)
SELECT m.title, GROUP_CONCAT(s.star_name, ', ') AS cast
FROM movies m
JOIN movie_stars ms ON m.movie_id = ms.movie_id
JOIN stars s ON ms.star_id = s.star_id
GROUP BY m.movie_id, m.title
ORDER BY m.title
LIMIT 15;


-- --------------------------------------------------------------
-- 3. INSPIRATION ANALYSIS
-- --------------------------------------------------------------

-- 3a. Gross vs Director: total & average gross by director (3+ films, gross known)
SELECT
    m.director,
    COUNT(*)                       AS film_count,
    SUM(m.gross)                   AS total_gross,
    ROUND(AVG(m.gross), 0)         AS avg_gross
FROM movies m
WHERE m.gross IS NOT NULL
GROUP BY m.director
HAVING COUNT(*) >= 3
ORDER BY avg_gross DESC
LIMIT 15;

-- 3b. Gross vs Stars: total & average gross per actor (5+ film appearances)
SELECT
    s.star_name,
    COUNT(*)                AS film_count,
    SUM(m.gross)             AS total_gross,
    ROUND(AVG(m.gross), 0)   AS avg_gross
FROM stars s
JOIN movie_stars ms ON s.star_id = ms.star_id
JOIN movies m ON ms.movie_id = m.movie_id
WHERE m.gross IS NOT NULL
GROUP BY s.star_name
HAVING COUNT(*) >= 5
ORDER BY avg_gross DESC
LIMIT 15;

-- 3c. No_of_Votes vs Director: which directors' films pull the most votes
SELECT
    m.director,
    COUNT(*)                         AS film_count,
    SUM(m.no_of_votes)               AS total_votes,
    ROUND(AVG(m.no_of_votes), 0)     AS avg_votes
FROM movies m
GROUP BY m.director
HAVING COUNT(*) >= 3
ORDER BY avg_votes DESC
LIMIT 15;

-- 3d. No_of_Votes vs Stars
SELECT
    s.star_name,
    COUNT(*)                       AS film_count,
    SUM(m.no_of_votes)             AS total_votes,
    ROUND(AVG(m.no_of_votes), 0)   AS avg_votes
FROM stars s
JOIN movie_stars ms ON s.star_id = ms.star_id
JOIN movies m ON ms.movie_id = m.movie_id
GROUP BY s.star_name
HAVING COUNT(*) >= 5
ORDER BY avg_votes DESC
LIMIT 15;

-- 3e. Which genre does each actor appear in most? (top genre per star, 3+ films)
--     Uses a window function to rank each star's genres by frequency.
SELECT star_name, genre_name, appearances
FROM (
    SELECT
        s.star_name,
        g.genre_name,
        COUNT(*) AS appearances,
        ROW_NUMBER() OVER (
            PARTITION BY s.star_name
            ORDER BY COUNT(*) DESC
        ) AS rn
    FROM stars s
    JOIN movie_stars ms ON s.star_id = ms.star_id
    JOIN movie_genres mg ON ms.movie_id = mg.movie_id
    JOIN genres g ON mg.genre_id = g.genre_id
    GROUP BY s.star_name, g.genre_name
    HAVING COUNT(*) >= 1
) ranked
WHERE rn = 1
ORDER BY appearances DESC
LIMIT 20;

-- 3f. Actor PAIRS with the highest average IMDB rating (appeared together 2+ times)
--     Self-join movie_stars to itself to find co-starring pairs.
SELECT
    s1.star_name AS actor_a,
    s2.star_name AS actor_b,
    COUNT(*)                    AS films_together,
    ROUND(AVG(m.imdb_rating),2) AS avg_rating
FROM movie_stars ms1
JOIN movie_stars ms2 ON ms1.movie_id = ms2.movie_id AND ms1.star_id < ms2.star_id
JOIN stars s1 ON ms1.star_id = s1.star_id
JOIN stars s2 ON ms2.star_id = s2.star_id
JOIN movies m ON ms1.movie_id = m.movie_id
GROUP BY s1.star_name, s2.star_name
HAVING COUNT(*) >= 2
ORDER BY avg_rating DESC, films_together DESC
LIMIT 15;

-- 3g. Actor PAIRS with the highest average / total gross (appeared together 2+ times)
SELECT
    s1.star_name AS actor_a,
    s2.star_name AS actor_b,
    COUNT(*)                  AS films_together,
    SUM(m.gross)               AS total_gross,
    ROUND(AVG(m.gross), 0)     AS avg_gross
FROM movie_stars ms1
JOIN movie_stars ms2 ON ms1.movie_id = ms2.movie_id AND ms1.star_id < ms2.star_id
JOIN stars s1 ON ms1.star_id = s1.star_id
JOIN stars s2 ON ms2.star_id = s2.star_id
JOIN movies m ON ms1.movie_id = m.movie_id
WHERE m.gross IS NOT NULL
GROUP BY s1.star_name, s2.star_name
HAVING COUNT(*) >= 2
ORDER BY avg_gross DESC
LIMIT 15;

-- 3h. Bonus: genre performance overview (count, avg rating, avg gross)
SELECT
    g.genre_name,
    COUNT(DISTINCT m.movie_id)        AS movie_count,
    ROUND(AVG(m.imdb_rating), 2)      AS avg_rating,
    ROUND(AVG(m.gross), 0)            AS avg_gross
FROM genres g
JOIN movie_genres mg ON g.genre_id = mg.genre_id
JOIN movies m ON mg.movie_id = m.movie_id
GROUP BY g.genre_name
ORDER BY avg_rating DESC;

-- 3i. Bonus: rating trend by decade
SELECT
    (released_year / 10) * 10   AS decade,
    COUNT(*)                    AS movie_count,
    ROUND(AVG(imdb_rating), 2)  AS avg_rating,
    ROUND(AVG(meta_score), 1)   AS avg_meta_score
FROM movies
GROUP BY decade
ORDER BY decade;


-- --------------------------------------------------------------
-- 4. VIEWS: reusable, saved insights
-- --------------------------------------------------------------

DROP VIEW IF EXISTS vw_movie_overview;
CREATE VIEW vw_movie_overview AS
SELECT
    m.movie_id, m.title, m.released_year, m.certificate, m.runtime_minutes,
    m.imdb_rating, m.meta_score, m.director, m.no_of_votes, m.gross,
    GROUP_CONCAT(DISTINCT g.genre_name) AS genres
FROM movies m
LEFT JOIN movie_genres mg ON m.movie_id = mg.movie_id
LEFT JOIN genres g ON mg.genre_id = g.genre_id
GROUP BY m.movie_id;

DROP VIEW IF EXISTS vw_director_performance;
CREATE VIEW vw_director_performance AS
SELECT
    director,
    COUNT(*)                      AS film_count,
    ROUND(AVG(imdb_rating), 2)    AS avg_rating,
    ROUND(AVG(no_of_votes), 0)    AS avg_votes,
    ROUND(AVG(gross), 0)          AS avg_gross
FROM movies
GROUP BY director;

DROP VIEW IF EXISTS vw_star_performance;
CREATE VIEW vw_star_performance AS
SELECT
    s.star_name,
    COUNT(*)                            AS film_count,
    ROUND(AVG(m.imdb_rating), 2)        AS avg_rating,
    ROUND(AVG(m.no_of_votes), 0)        AS avg_votes,
    ROUND(AVG(m.gross), 0)              AS avg_gross
FROM stars s
JOIN movie_stars ms ON s.star_id = ms.star_id
JOIN movies m ON ms.movie_id = m.movie_id
GROUP BY s.star_name;

DROP VIEW IF EXISTS vw_actor_pairs;
CREATE VIEW vw_actor_pairs AS
SELECT
    s1.star_name AS actor_a,
    s2.star_name AS actor_b,
    COUNT(*)                     AS films_together,
    ROUND(AVG(m.imdb_rating), 2) AS avg_rating,
    ROUND(AVG(m.gross), 0)       AS avg_gross
FROM movie_stars ms1
JOIN movie_stars ms2 ON ms1.movie_id = ms2.movie_id AND ms1.star_id < ms2.star_id
JOIN stars s1 ON ms1.star_id = s1.star_id
JOIN stars s2 ON ms2.star_id = s2.star_id
JOIN movies m ON ms1.movie_id = m.movie_id
GROUP BY s1.star_name, s2.star_name;

-- Usage examples:
--   SELECT * FROM vw_director_performance WHERE film_count >= 3 ORDER BY avg_rating DESC;
--   SELECT * FROM vw_star_performance WHERE film_count >= 5 ORDER BY avg_gross DESC;
--   SELECT * FROM vw_actor_pairs WHERE films_together >= 2 ORDER BY avg_rating DESC;
