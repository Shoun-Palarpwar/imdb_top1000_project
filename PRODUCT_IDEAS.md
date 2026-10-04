# Double Feature — proposed product direction

Turn the dataset into a cinema discovery and comparison experience. The signature
interaction is a persistent two-slot comparison tray: add a movie, director, or
actor anywhere, select another of the same type, then open a full comparison page.
The first local website is now implemented in `web/`, backed by `server.py` and
SQLite. It includes the cinematic entrance, dataset story, film search and details,
a comparison tray, movie/director/actor comparisons, and nine analysis reports.
The specification below also describes future extensions: timeline comparisons,
recommendations, connection exploration, watchlists, and shared links.

## 1. The comparison room (first release)

Use two balanced panels with sticky entity headers and aligned metric rows. On
desktop, show both sides together; on mobile, retain a compact pair of headers
above stacked metric rows so users do not have to remember numbers across tabs.
Provide search, swap, replace, clear, and a “differences only” toggle. Prevent mixed
entity types and explain how to switch modes. Include keyboard navigation,
visible focus, text labels for differences, and reduced-motion support.

| Mode | Compare | Distinctive interaction |
|---|---|---|
| Movie vs movie | IMDb rating, Metascore, runtime, year, votes, reported gross, genres, credited stars | Highlight shared people and genres; click a shared connection to explore |
| Director vs director | Films in this dataset, rating distributions, median and average rating, known-gross counts, genre mix | Synchronized timelines and filters; click any metric to see contributing films |
| Actor vs actor | Listed appearances, rating distribution, genre mix, collaborators, shared films | “Together” section showing films featuring both people |

Show differences in natural units: “24 minutes shorter,” “0.4 higher IMDb rating.”
Keep IMDb and Metascore on separate labeled scales. Display “Not available” for
unknown values, and sample coverage such as “Gross available for 4 of 7 films.”
Avoid a single winner score: higher revenue and longer runtime are not universally
better. Offer shared year/genre filters and show when a filter leaves no data.

Visual direction: charcoal backgrounds, warm ivory typography, amber accents,
large film titles, and subtle reel-like transitions. Treat posters as supporting
imagery. The raw CSV has poster links, but the normalized schema currently drops
them; add that field and provide a typographic fallback for unavailable images.
People portraits require another data source. Maintain readable contrast.

## 2. Discovery features using the existing dataset

1. **Double-feature builder:** Choose a movie and available viewing time. Suggest
   a second film that fits, with “similar mood” (initially labeled genre similarity)
   or “contrast” modes. Explain matches using genres, runtime, director, or cast.
2. **Connection explorer:** Browse movie → actor → movie paths. Show the films
   establishing each connection and label cast coverage as the source's four stars.
3. **Audience and critic gap:** Compare IMDb rating × 10 with Metascore as an
   exploratory difference, showing both original scales and excluding missing scores.
   Explain that these summarize different groups, not equivalent measurements.
4. **Underseen within this collection:** Filter for high ratings and relatively
   fewer votes within a decade or genre. Let users control thresholds; do not imply
   that these films are unknown outside this already highly rated collection.
5. **Director timeline:** Plot represented films by year and rating. Selecting a
   film opens details or adds it to the comparison tray. Call it “films in this
   dataset,” because these are incomplete filmographies.
6. **Personal watchlist:** Save films locally, mark watched, add personal notes,
   and export/import the list. Explain local storage; account sync is a later feature.

## 3. Recommended build order

- **First:** Searchable movie browser, detail page, persistent comparison tray,
  movie comparisons, and director comparisons. Add a read-only application layer
  over SQLite, parameterized filters, and a consistent metrics contract.
- **Next:** Actor comparisons, explainable recommendations, connection explorer,
  director timelines, and local watchlists.
- **Later:** Stable external movie/person IDs, versioned data, shareable comparison
  URLs, richer imagery, full filmographies, and optional account synchronization.
  External enrichment needs a chosen provider and verified usage terms. Streaming
  availability, trailers, budgets, and live ratings are absent from the current data.

The first release succeeds when someone can find two films, compare them in a few
actions, understand missing values, inspect the evidence behind a metric, and
choose what to watch. Preserve active filters and tray selections when navigating
back. Make loading, missing-image, no-match, and empty-filter states intentional.
