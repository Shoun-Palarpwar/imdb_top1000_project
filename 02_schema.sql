-- ============================================================
-- 02_schema.sql
-- Normalized schema for the Kaggle "IMDb Top 1000" dataset.
-- Portable to PostgreSQL/SQLite as-is; MySQL notes inline.
-- ============================================================

DROP TABLE IF EXISTS movie_stars;
DROP TABLE IF EXISTS movie_genres;
DROP TABLE IF EXISTS stars;
DROP TABLE IF EXISTS genres;
DROP TABLE IF EXISTS movies;

CREATE TABLE movies (
    movie_id         INTEGER PRIMARY KEY,   -- MySQL: INT PRIMARY KEY AUTO_INCREMENT
    title             VARCHAR(255) NOT NULL,
    released_year     INTEGER,
    certificate       VARCHAR(10),           -- NULL where not disclosed in source (101 rows)
    runtime_minutes   INTEGER,
    imdb_rating       DECIMAL(3,1),
    overview          TEXT,
    meta_score        INTEGER,               -- NULL where not disclosed (157 rows)
    director          VARCHAR(255),
    no_of_votes       INTEGER,
    gross             BIGINT                 -- NULL where not disclosed (169 rows)
);

CREATE TABLE genres (
    genre_id   INTEGER PRIMARY KEY,          -- MySQL: INT PRIMARY KEY AUTO_INCREMENT
    genre_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE movie_genres (
    movie_id INTEGER NOT NULL,
    genre_id INTEGER NOT NULL,
    PRIMARY KEY (movie_id, genre_id),
    FOREIGN KEY (movie_id) REFERENCES movies(movie_id),
    FOREIGN KEY (genre_id) REFERENCES genres(genre_id)
);

CREATE TABLE stars (
    star_id   INTEGER PRIMARY KEY,           -- MySQL: INT PRIMARY KEY AUTO_INCREMENT
    star_name VARCHAR(255) NOT NULL UNIQUE
);

-- star_order preserves original Star1..Star4 billing position
CREATE TABLE movie_stars (
    movie_id   INTEGER NOT NULL,
    star_id    INTEGER NOT NULL,
    star_order INTEGER NOT NULL,
    PRIMARY KEY (movie_id, star_id),
    FOREIGN KEY (movie_id) REFERENCES movies(movie_id),
    FOREIGN KEY (star_id) REFERENCES stars(star_id)
);

CREATE INDEX idx_movies_year ON movies(released_year);
CREATE INDEX idx_movies_rating ON movies(imdb_rating);
CREATE INDEX idx_movies_gross ON movies(gross);
CREATE INDEX idx_moviegenres_genre ON movie_genres(genre_id);
CREATE INDEX idx_moviestars_star ON movie_stars(star_id);
