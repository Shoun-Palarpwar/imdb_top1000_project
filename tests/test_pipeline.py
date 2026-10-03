import csv
import importlib.util
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / f"{name}.py")
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


class CleaningTests(unittest.TestCase):
    def test_year_correction_is_specific(self):
        clean = module("01_clean_and_normalize")
        self.assertEqual(clean.clean_year("Apollo 13", "PG"), 1995)
        self.assertIsNone(clean.clean_year("Unknown", ""))
        self.assertEqual(clean.clean_year("Other", "2001"), 2001)
        for title, year in [("Other", "PG"), ("Apollo 13", "bad")]:
            with self.assertRaises(ValueError):
                clean.clean_year(title, year)

    def test_runtime_does_not_accept_partial_values(self):
        clean = module("01_clean_and_normalize")
        self.assertEqual(clean.clean_runtime("142 min"), 142)
        self.assertIsNone(clean.clean_runtime(""))
        for value in ["142 garbage", "0 min", "-1 min"]:
            with self.assertRaises(ValueError):
                clean.clean_runtime(value)


class QueryTests(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(":memory:")
        self.addCleanup(self.conn.close)
        self.conn.execute("PRAGMA foreign_keys = ON")
        self.conn.executescript((ROOT / "02_schema.sql").read_text())
        self.queries = dict(module("05_run_and_export").export_queries(
            (ROOT / "04_queries.sql").read_text()))

    def test_gross_threshold_counts_known_values(self):
        for movie_id in range(1, 6):
            self.conn.execute(
                "INSERT INTO movies(movie_id,title,director,gross) VALUES(?,?,?,?)",
                (movie_id, f"Film {movie_id}", "Director", 100 if movie_id <= 2 else None))
        self.assertEqual(self.conn.execute(self.queries["gross_by_director.csv"]).fetchall(), [])
        self.conn.execute("UPDATE movies SET gross=400 WHERE movie_id=3")
        row = self.conn.execute(self.queries["gross_by_director.csv"]).fetchone()
        self.assertEqual(row, ("Director", 5, 3, 600, 200.0))
        self.conn.executemany("INSERT INTO stars VALUES(?,?)", [(1, "A"), (2, "B")])
        for movie_id in range(1, 6):
            self.conn.executemany("INSERT INTO movie_stars VALUES(?,?,?)",
                                  [(movie_id, 1, 1), (movie_id, 2, 2)])
        self.assertEqual(self.conn.execute(self.queries["gross_by_star.csv"]).fetchall(), [])
        self.conn.execute("UPDATE movies SET gross=NULL WHERE movie_id IN (2,3)")
        self.assertEqual(self.conn.execute(self.queries["actor_pairs_by_gross.csv"]).fetchall(), [])

    def test_top_genre_minimum_and_ties(self):
        self.conn.executemany("INSERT INTO genres VALUES(?,?)", [(1, "Drama"), (2, "Action")])
        self.conn.executemany("INSERT INTO stars VALUES(?,?)", [(1, "Regular"), (2, "Once")])
        for movie_id in range(1, 4):
            self.conn.execute("INSERT INTO movies(movie_id,title) VALUES(?,?)", (movie_id, "Film"))
            self.conn.execute("INSERT INTO movie_stars VALUES(?,?,?)", (movie_id, 1, 1))
            self.conn.executemany("INSERT INTO movie_genres VALUES(?,?)", [(movie_id, 1), (movie_id, 2)])
        self.conn.execute("INSERT INTO movie_stars VALUES(1,2,2)")
        self.assertEqual(self.conn.execute(self.queries["actor_top_genre.csv"]).fetchall(),
                         [("Regular", "Action", 3)])

    def test_relationships_and_ranges_are_enforced(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute("INSERT INTO movie_genres VALUES(999,999)")
        for column, value in [("imdb_rating", 11), ("meta_score", 101),
                              ("runtime_minutes", 0), ("gross", -1), ("no_of_votes", -1)]:
            with self.assertRaises(sqlite3.IntegrityError):
                self.conn.execute(f"INSERT INTO movies(movie_id,title,{column}) VALUES(1,'Bad',?)", (value,))


class PipelineTests(unittest.TestCase):
    def test_rebuild_exports_and_failed_load_preserves_database(self):
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp)
            for path in ROOT.iterdir():
                if path.suffix in (".py", ".sql", ".csv"):
                    shutil.copy2(path, target / path.name)
            scripts = ["03_load_data.py", "05_run_and_export.py"]
            if (target / "imdb_top_1000.csv").exists():
                scripts.insert(0, "01_clean_and_normalize.py")
            for script in scripts:
                subprocess.run([sys.executable, str(target / script)], check=True, capture_output=True)
            conn = sqlite3.connect(target / "imdb_top1000.db")
            try:
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM movies").fetchone()[0], 1000)
                self.assertEqual(conn.execute("PRAGMA integrity_check").fetchone()[0], "ok")
                self.assertEqual(conn.execute("PRAGMA foreign_key_check").fetchall(), [])
                queries = dict(module("05_run_and_export").export_queries((target / "04_queries.sql").read_text()))
                self.assertEqual(len(queries), 10)
                for filename, sql in queries.items():
                    with (target / "exports" / filename).open(newline="") as f:
                        actual = list(csv.reader(f))
                    result = conn.execute(sql)
                    expected = [[column[0] for column in result.description]]
                    expected += [["" if value is None else str(value) for value in row] for row in result]
                    self.assertEqual(actual, expected, filename)
            finally:
                conn.close()
            before = (target / "imdb_top1000.db").read_bytes()
            with (target / "movie_genres.csv").open("a") as f:
                f.write("999999,1\n")
            result = subprocess.run([sys.executable, str(target / "03_load_data.py")], capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(before, (target / "imdb_top1000.db").read_bytes())


if __name__ == "__main__":
    unittest.main()
