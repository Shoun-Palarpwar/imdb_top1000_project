"""Regression checks for the web app's read-only data contract."""
import sqlite3
import csv
import io
import unittest

import server


class WebApiTests(unittest.TestCase):
    def setUp(self):
        self.conn = server.connect()
        self.addCleanup(self.conn.close)

    def test_catalog_preserves_counts_and_relationships(self):
        data = server.catalog(self.conn)
        self.assertEqual(len(data["movies"]), 1000)
        self.assertEqual(data["stats"]["missing_gross"], 169)
        self.assertEqual(sum(len(m["cast"]) for m in data["movies"]), 3996)
        self.assertEqual(sum(len(m["genres"]) for m in data["movies"]), 2541)
        self.assertTrue(all(m["poster"] is None or m["poster"].startswith("https://m.media-amazon.com/") for m in data["movies"]))

    def test_all_nine_reports_run(self):
        for name in server.REPORTS:
            if name == "movie_overview_full.csv":
                continue
            result = server.report(self.conn, name.removesuffix(".csv"))
            self.assertTrue(result["rows"], name)
            self.assertEqual(list(result["rows"][0]), result["columns"])

    def test_director_comparison_uses_available_gross_only(self):
        result = server.compare(self.conn, "director", ["Christopher Nolan", "Steven Spielberg"])
        for entity in result["entities"]:
            gross = [m["gross"] for m in entity["films"] if m["gross"] is not None]
            self.assertEqual(entity["metrics"]["gross_count"], len(gross))
            self.assertAlmostEqual(entity["metrics"]["gross"], sum(gross)/len(gross))

    def test_unknown_gross_is_not_zero(self):
        missing = self.conn.execute("SELECT movie_id FROM movies WHERE gross IS NULL LIMIT 1").fetchone()[0]
        result = server.compare(self.conn, "movie", [str(missing), "1"])
        self.assertIsNone(result["entities"][0]["metrics"]["gross"])
        self.assertEqual(result["entities"][0]["metrics"]["gross_count"], 0)

    def test_actor_comparison_and_input_validation(self):
        data = server.compare(self.conn, "actor", ["1", "2"])
        self.assertEqual(len(data["entities"]), 2)
        for kind, identities in [("unknown", ["1", "2"]), ("movie", ["1"]),
                                  ("movie", ["-1", "2"]), ("director", ["' OR 1=1 --", "Other"])]:
            with self.assertRaises(ValueError):
                server.compare(self.conn, kind, identities)
        with self.assertRaises(ValueError):
            server.report(self.conn, "../../movies")

    def test_connection_cannot_modify_database(self):
        with self.assertRaises(sqlite3.OperationalError):
            self.conn.execute("UPDATE movies SET title='Changed' WHERE movie_id=1")

    def test_download_csv_matches_report(self):
        report = server.report(self.conn, "genre_overview")
        downloaded = list(csv.reader(io.StringIO(server.report_csv(report).decode("utf-8"))))
        self.assertEqual(downloaded[0], report["columns"])
        self.assertEqual(len(downloaded), 22)
        self.assertEqual(downloaded[1], [str(report["rows"][0][key]) for key in report["columns"]])


if __name__ == "__main__":
    unittest.main()
