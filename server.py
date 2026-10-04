"""Double Feature: a dependency-free, read-only SQLite API and local web server."""

import argparse
import csv
import importlib.util
import io
import json
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sqlite3
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
DB = ROOT / "imdb_top1000.db"
spec = importlib.util.spec_from_file_location("exporter", ROOT / "05_run_and_export.py")
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)
REPORTS = dict(exporter.export_queries((ROOT / "04_queries.sql").read_text()))


def connect():
    conn = sqlite3.connect(DB.as_uri() + "?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def rows(conn, query, params=()):
    return [dict(row) for row in conn.execute(query, params)]


def catalog(conn):
    movies = rows(conn, "SELECT * FROM movies ORDER BY imdb_rating DESC, movie_id")
    by_id = {m["movie_id"]: m for m in movies}
    for movie in movies:
        movie.update(genres=[], cast=[], poster=None)
    for row in conn.execute("SELECT mg.movie_id,g.genre_name FROM movie_genres mg JOIN genres g USING(genre_id) ORDER BY g.genre_name"):
        by_id[row["movie_id"]]["genres"].append(row["genre_name"])
    for row in conn.execute("SELECT ms.movie_id,s.star_id,s.star_name FROM movie_stars ms JOIN stars s USING(star_id) ORDER BY ms.star_order"):
        by_id[row["movie_id"]]["cast"].append({"id": row["star_id"], "name": row["star_name"]})
    raw = ROOT / "imdb_top_1000.csv"
    if raw.exists():
        # Poster URLs are optional presentation metadata; all metrics come from SQLite.
        with raw.open(encoding="utf-8", newline="") as f:
            posters = {(r["Series_Title"].strip(), r["Director"].strip()): r["Poster_Link"] for r in csv.DictReader(f)}
        for m in movies:
            url = posters.get((m["title"], m["director"]), "")
            if url.startswith("https://m.media-amazon.com/"):
                m["poster_original"] = url
                # Request a display-sized version of the same source image.
                m["poster"] = url.split("._V1_")[0] + "._V1_SX600.jpg" if "._V1_" in url else url
    stats = dict(conn.execute("""SELECT COUNT(*) movies, MIN(released_year) first_year,
        MAX(released_year) last_year, SUM(gross IS NULL) missing_gross,
        SUM(meta_score IS NULL) missing_meta, SUM(certificate IS NULL) missing_certificate
        FROM movies""").fetchone())
    for table in ("genres", "stars", "movie_genres", "movie_stars"):
        stats[table] = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    return {"movies": movies, "stats": stats,
            "directors": rows(conn, "SELECT * FROM vw_director_performance ORDER BY director"),
            "actors": rows(conn, "SELECT s.star_id, v.* FROM stars s JOIN vw_star_performance v ON s.star_name=v.star_name ORDER BY s.star_name")}


def report(conn, name):
    key = name + ".csv"
    if key not in REPORTS or name == "movie_overview_full":
        raise ValueError("Unknown screening")
    result = conn.execute(REPORTS[key])
    return {"columns": [c[0] for c in result.description], "rows": [dict(r) for r in result]}


def compare(conn, kind, identifiers):
    if kind not in ("movie", "director", "actor") or len(identifiers) != 2:
        raise ValueError("Choose two movies, directors, or actors")
    result = []
    for identity in identifiers:
        if kind == "movie":
            films = rows(conn, "SELECT * FROM movies WHERE movie_id=?", (identity,))
            name = films[0]["title"] if films else None
        elif kind == "director":
            films = rows(conn, "SELECT * FROM movies WHERE director=? ORDER BY released_year,movie_id", (identity,))
            name = identity
        else:
            films = rows(conn, "SELECT m.* FROM movies m JOIN movie_stars ms USING(movie_id) WHERE ms.star_id=? ORDER BY m.released_year,m.movie_id", (identity,))
            actor = conn.execute("SELECT star_name FROM stars WHERE star_id=?", (identity,)).fetchone()
            name = actor[0] if actor else None
        if not films:
            raise ValueError("That selection is not in this collection")
        metrics = {"film_count": len(films)}
        for field in ("imdb_rating", "meta_score", "runtime_minutes", "no_of_votes", "gross"):
            values = [f[field] for f in films if f[field] is not None]
            metrics[field] = sum(values) / len(values) if values else None
            metrics[field + "_count"] = len(values)
        result.append({"name": name, "id": identity, "films": films, "metrics": metrics})
    return {"kind": kind, "entities": result}


def report_csv(result):
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(result["columns"])
    writer.writerows([row[key] for key in result["columns"]] for row in result["rows"])
    return output.getvalue().encode("utf-8")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            return super().do_GET()
        conn = None
        try:
            conn = connect()
            query = parse_qs(parsed.query)
            if parsed.path == "/api/catalog":
                data = catalog(conn)
            elif parsed.path == "/api/report":
                name = query.get("name", [""])[0]
                data = report(conn, name)
                if query.get("format") == ["csv"]:
                    body = report_csv(data)
                    self.send_response(HTTPStatus.OK)
                    self.send_header("Content-Type", "text/csv; charset=utf-8")
                    self.send_header("Content-Disposition", f'attachment; filename="{name}.csv"')
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                    return
            elif parsed.path == "/api/compare":
                data = compare(conn, query.get("kind", [""])[0], query.get("id", []))
            else:
                self.send_json({"error": "Unknown endpoint"}, HTTPStatus.NOT_FOUND)
                return
            self.send_json(data)
        except ValueError as error:
            self.send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)
        except sqlite3.Error:
            self.send_json({"error": "The archive is unavailable. Run the database loader and exporter, then retry."}, HTTPStatus.SERVICE_UNAVAILABLE)
        finally:
            if conn is not None:
                conn.close()

    def send_json(self, data, status=HTTPStatus.OK):
        body = json.dumps(data, ensure_ascii=False, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Double Feature is open at http://127.0.0.1:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
