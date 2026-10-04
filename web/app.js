'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number = value => value == null ? 'Not available' : new Intl.NumberFormat('en-US', {maximumFractionDigits: 2}).format(value);
const money = value => value == null ? 'Not available' : new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(value);
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const tabs = [['home','The lobby'],['story','The story'],['collection','The collection'],['compare','Compare'],['directors','Directors'],['actors','The cast'],['genres','Genres'],['pairs','Collaborations'],['decades','Through time']];
const state = {data:null,page:'home',tray:[],filters:{search:'',genre:'',decade:'',sort:'rating'},pagination:1,compareKind:'movie',choices:['',''],comparison:null,report:null,reportName:'',request:0};
const reportRooms = {
  directors: {number:'04',title:'Behind the <em>camera.</em>',description:'The filmmakers behind the frames. Explore whose films draw the biggest audiences—and the largest reported revenue.', options:[['gross_by_director','Reported revenue'],['votes_by_director','Audience votes']],note:'Directors need 3 films with known gross for revenue rankings, or 3 films for vote rankings. These are films in this collection, not complete careers.'},
  actors: {number:'05',title:'In the <em>spotlight.</em>',description:'Familiar faces. Unexpected patterns. Follow the performers through their films, audiences, and most frequent genres.',options:[['gross_by_star','Reported revenue'],['votes_by_star','Audience votes'],['actor_top_genre','Most frequent genre']],note:'Revenue requires 5 films with known gross; votes require 5 films. Genre frequency requires 3 appearances, with alphabetical tie-breaking. Only the source’s four star fields are represented.'},
  genres: {number:'06',title:'A matter of <em>feeling.</em>',description:'From the tension of a thriller to the sweep of an adventure. See how the collection’s genres compare.',options:[['genre_overview','Genre overview']],note:'A film can belong to several genres. These groups overlap, and the entire collection is already selected for high ratings.'},
  pairs: {number:'07',title:'Better <em>together.</em>',description:'Some connections deserve another scene. Discover the recurring on-screen partnerships in this collection.',options:[['actor_pairs_by_rating','Highest-rated partnerships'],['actor_pairs_by_gross','Highest-grossing partnerships']],note:'Pairs require at least 2 shared films; revenue rankings require 2 with known gross. Shared franchises and small samples can dominate these results.'},
  decades: {number:'08',title:'Across the <em>ages.</em>',description:'A century of changing stories. Travel through the collection, one decade at a time.',options:[['decade_trends','Ratings through the decades']],note:'Each decade includes only films represented in this collection. Unequal sample sizes and selection effects mean this is not a measure of cinema getting better or worse.'}
};

async function api(path) {
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The screening could not load. Please try again.');
  return data;
}

let dataPromise;
function loadData() {
  if (!dataPromise) dataPromise = api('/api/catalog').then(data => {state.data = data; return data;}).catch(error => {dataPromise = null; throw error;});
  return dataPromise;
}

function notify(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => $('#toast').classList.remove('visible'), 3200);
}

function poster(movie, extra = '') {
  return `<button class="poster ${extra}" style="--hue:${(movie.movie_id * 37) % 360}" data-action="details" data-id="${movie.movie_id}" aria-label="View ${escapeHTML(movie.title)}"><span class="poster-wordmark">${escapeHTML(movie.title)}</span>${movie.poster ? `<img src="${escapeHTML(movie.poster)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<span class="poster-index">FRAME ${String(movie.movie_id).padStart(3,'0')}</span><span class="poster-rating"><span>★</span> ${number(movie.imdb_rating)} <small>/ 10</small></span></button>`;
}

// External poster URLs may be unavailable; the typeset title remains underneath.
document.addEventListener('error', event => {
  if (!(event.target instanceof HTMLImageElement)) return;
  const movie = state.data?.movies.find(m => m.poster === event.target.src);
  if (movie?.poster_original && movie.poster_original !== event.target.src) event.target.src = movie.poster_original;
  else event.target.remove();
}, true);

function card(movie) {
  const selected = state.tray.includes(movie.movie_id);
  return `<article class="movie-card">${poster(movie)}<div class="movie-info"><h3 title="${escapeHTML(movie.title)}">${escapeHTML(movie.title)}</h3><p>${movie.released_year ?? 'Year unknown'} <span aria-hidden="true">·</span> ${movie.runtime_minutes ?? '—'} min <span aria-hidden="true">·</span> ${escapeHTML(movie.genres[0] || '')}</p></div><div class="movie-actions"><button data-action="details" data-id="${movie.movie_id}">Explore film ↗</button><button class="${selected ? 'selected' : ''}" data-action="add" data-id="${movie.movie_id}" aria-pressed="${selected}">${selected ? '✓ In comparison' : '+ Compare'}</button></div></article>`;
}

function heading(kicker, title, description, counter = '') {
  return `<div class="page-heading"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p>${description}</p></div>${counter ? `<div class="counter">${counter}</div>` : ''}</div>`;
}

function home() {
  const {stats,movies} = state.data;
  const picks = ['Interstellar','The Grand Budapest Hotel','Pulp Fiction'].map(title => movies.find(m => m.title === title)).filter(Boolean);
  return `<section class="home-hero"><div><p class="eyebrow"><span class="live-dot"></span> WELCOME TO DOUBLE FEATURE</p><h1>The lights dim.<br>The stories <em>begin.</em></h1><p>A thousand films. The people who made them.<br>And the connections you haven’t noticed yet.</p><button class="button" data-action="navigate" data-page="collection">Explore the collection <span>↗</span></button></div><div class="feature-art" aria-label="Films from the collection">${picks.map(m => `<div class="poster-mini"><span>${escapeHTML(m.title)}</span>${m.poster ? `<img src="${escapeHTML(m.poster)}" alt="${escapeHTML(m.title)}" referrerpolicy="no-referrer">` : ''}</div>`).join('')}<div class="feature-stamp">1000 FILMS<br>ONE SHARED<br>OBSESSION.</div></div></section>
  <div class="stats-strip"><div class="stat"><strong>${number(stats.movies)}</strong><span>Stories to explore</span></div><div class="stat"><strong>${stats.genres}</strong><span>Different genres</span></div><div class="stat"><strong>${number(stats.stars)}</strong><span>Credited people</span></div><div class="stat"><strong>${stats.first_year}—${stats.last_year}</strong><span>A century on screen</span></div></div>
  <div class="section-title"><h2>Choose your next scene.</h2><span class="eyebrow muted">FOLLOW YOUR CURIOSITY</span></div><div class="room-grid">${[['01','story','Before the opening scene','How a raw CSV became a connected world of cinema.'],['02','compare','Two films. One frame.','Place movies, directors, or actors side by side.'],['03','directors','Behind the camera','Discover the filmmakers through the numbers.']].map(([n,page,title,desc]) => `<button class="room-card" data-action="navigate" data-page="${page}"><span class="room-number">SCENE ${n}</span><span class="arrow">↗</span><h3>${title}</h3><p>${desc}</p></button>`).join('')}</div>
  <div class="section-title"><h2>A few familiar faces.</h2><button class="text-button" data-action="navigate" data-page="collection">View all films ↗</button></div><div class="movie-grid">${movies.slice(0,4).map(card).join('')}</div><p class="footnote">Drawn from a historical IMDb Top 1000 snapshot. Ratings, votes, and revenue reflect the source dataset—not live updates.</p>`;
}

function story() {
  const s = state.data.stats;
  return `${heading('01 / THE ORIGIN STORY','Before the <em>opening scene.</em>','Every good story has a beginning. Ours started with a spreadsheet.','01<small>BEHIND THE SCENES</small>')}
  <div class="story-intro"><h2>A thousand films.<br>One very crowded file.</h2><p>The original Kaggle dataset put titles, ratings, genres, cast, and box-office figures into a single CSV. It held wonderful stories—but the relationships were buried inside comma-separated genres and four separate star columns.</p></div>
  <section class="story-step"><span class="step-number">01</span><div><h2>The raw material.</h2><p>${number(s.movies)} rows. Films from ${s.first_year} to ${s.last_year}. Names, numbers, and missing pieces. We began by understanding what the source actually contains—and what it cannot tell us.</p><p><a href="https://www.kaggle.com/datasets/harshitshankhdhar/imdb-dataset-of-top-1000-movies-and-tv-shows" target="_blank" rel="noopener noreferrer">Meet the original Kaggle dataset ↗</a></p></div><div class="data-note">Series_Title, Released_Year, Runtime…<br>Genre: <b>Drama, Crime</b><br>Star1, Star2, Star3, Star4<br>Gross: <b>"28,341,469"</b></div></section>
  <section class="story-step"><span class="step-number">02</span><div><h2>A careful restoration.</h2><p>Runtime became minutes. Revenue became a number. Apollo 13’s malformed year became 1995, with its source certificate preserved. Original synopsis punctuation stayed intact.</p><p>Unknown values stayed unknown: ${s.missing_gross} missing revenue figures, ${s.missing_meta} missing Metascores, and ${s.missing_certificate} missing certificates. No invented numbers to fill the silence.</p></div><div class="data-note">"142 min" <b>→ 142</b><br>"28,341,469" <b>→ 28341469</b><br>Apollo 13: "PG" <b>→ 1995</b><br>Missing value <b>→ NULL, never zero</b></div></section>
  <section class="story-step"><span class="step-number">03</span><div><h2>Everything finds its place.</h2><p>Five related tables gave the data a structure. ${s.genres} genres and ${number(s.stars)} distinct credited names now connect to films through relationship tables. Billing order is preserved; repeated names in a movie retain their first slot.</p></div><div class="data-note"><div class="schema-nodes"><span>movies · ${number(s.movies)}</span><span>movie_genres · ${number(s.movie_genres)}</span><span>movie_stars · ${number(s.movie_stars)}</span><span>genres · ${s.genres}</span><span>stars · ${number(s.stars)}</span></div></div></section>
  <section class="story-step"><span class="step-number">04</span><div><h2>Let the connections speak.</h2><p>SQL joins reunite the pieces. Aggregations find patterns. Window functions surface frequent genres. Self-joins reveal recurring co-stars. The analysis screens and downloadable reports use the same SQL queries.</p><p>Foreign keys and numeric constraints protect the database, and a failed import leaves the saved archive intact.</p></div><div class="data-note">CSV <b>→</b> Clean <b>→</b> Normalize<br>SQLite <b>→</b> Query <b>→</b> Discover<br><br><button class="button small" data-action="navigate" data-page="collection">Step into the collection ↗</button></div></section>
  <p class="footnote">A little perspective: this is a curated set of highly rated films, not all cinema. People are identified by source names, only four star fields are available, and revenue is neither profit nor inflation-adjusted. Every comparison lives within those boundaries.</p>`;
}

function collection() {
  const genres = [...new Set(state.data.movies.flatMap(m => m.genres))].sort();
  const decades = [...new Set(state.data.movies.filter(m => m.released_year).map(m => Math.floor(m.released_year / 10) * 10))].sort((a,b) => b-a);
  return `${heading('02 / THE COLLECTION','Find your next <em>obsession.</em>','Browse the films. Follow a familiar name. Or leave room for a happy accident.',`${number(state.data.movies.length)}<small>FILMS IN THE ARCHIVE</small>`)}
  <div class="toolbar"><div class="field search"><label for="movie-search">Title, director, or actor</label><input id="movie-search" type="search" placeholder="A name. A film. A starting point." value="${escapeHTML(state.filters.search)}"></div><div class="field"><label for="genre-filter">Genre</label><select id="genre-filter"><option value="">Every genre</option>${genres.map(g => `<option ${state.filters.genre === g ? 'selected' : ''}>${escapeHTML(g)}</option>`).join('')}</select></div><div class="field"><label for="decade-filter">Decade</label><select id="decade-filter"><option value="">Every era</option>${decades.map(d => `<option value="${d}" ${state.filters.decade === String(d) ? 'selected' : ''}>${d}s</option>`).join('')}</select></div><div class="field"><label for="sort-filter">Sort by</label><select id="sort-filter">${[['rating','Highest rated'],['year','Newest first'],['votes','Most votes'],['runtime','Shortest first']].map(([v,l]) => `<option value="${v}" ${state.filters.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div><button class="button secondary" data-action="reset-filters">Reset</button></div><div id="collection-results"></div>`;
}

function renderCollection() {
  const f = state.filters;
  const search = f.search.trim().toLocaleLowerCase();
  let movies = state.data.movies.filter(m => (!search || [m.title,m.director,...m.cast.map(a => a.name)].some(x => x?.toLocaleLowerCase().includes(search))) && (!f.genre || m.genres.includes(f.genre)) && (!f.decade || Math.floor(m.released_year / 10) * 10 === Number(f.decade)));
  const keys = {rating:'imdb_rating',year:'released_year',votes:'no_of_votes',runtime:'runtime_minutes'};
  movies.sort((a,b) => {
    const x = a[keys[f.sort]], y = b[keys[f.sort]];
    if (x == null) return 1;
    if (y == null) return -1;
    return (f.sort === 'runtime' ? x-y : y-x) || a.movie_id-b.movie_id;
  });
  const count = Math.max(1, Math.ceil(movies.length / 24));
  state.pagination = Math.min(state.pagination, count);
  $('#collection-results').innerHTML = `<div class="collection-meta"><span>${number(movies.length)} films in this screening</span><span>PAGE ${state.pagination} / ${count}</span></div>${movies.length ? `<div class="movie-grid">${movies.slice((state.pagination-1)*24, state.pagination*24).map(card).join('')}</div><div class="pagination"><button class="button secondary small" data-action="prev" ${state.pagination === 1 ? 'disabled' : ''}>← Previous</button><span>${state.pagination} / ${count}</span><button class="button secondary small" data-action="next" ${state.pagination === count ? 'disabled' : ''}>Next →</button></div>` : `<div class="empty"><h2>No films in this scene.</h2><p>Try another name, era, or genre.</p><button class="button secondary" data-action="reset-filters">Reset the filters</button></div>`}`;
}

function screenPlaceholder(title = 'The screen is yours.', subtitle = 'Choose a lens above, then roll the film to reveal the story in the numbers.') {
  return `<div class="screen-placeholder"><span class="screen-label">YOUR NEXT DISCOVERY AWAITS</span><div class="screen-icon" aria-hidden="true">ƒ</div><h2>${title}</h2><p>${subtitle}</p></div>`;
}

function reportPage(page) {
  const room = reportRooms[page];
  if (!room.options.some(([key]) => key === state.reportName)) state.reportName = room.options[0][0];
  return `${heading(`${room.number} / THE ANALYSIS ROOMS`,room.title,room.description,`${room.number}<small>TAKE A CLOSER LOOK</small>`)}<div class="report-controls"><div class="field"><label for="report-select">Choose your lens</label><select id="report-select">${room.options.map(([key,label]) => `<option value="${key}" ${state.reportName === key ? 'selected' : ''}>${label}</option>`).join('')}</select></div><button class="button" data-action="run-report">Roll the film <span aria-hidden="true">▶</span></button></div><div id="report-output" aria-live="polite">${screenPlaceholder()}</div><p class="footnote">${room.note} Gross means source-reported revenue, with unknown values excluded from averages; market coverage is not precisely defined.</p>`;
}

const labels = {director:'Director',star_name:'Actor',film_count:'Films in collection',gross_film_count:'Films with gross',total_gross:'Total reported gross',avg_gross:'Average reported gross',total_votes:'Total votes',avg_votes:'Average votes',genre_name:'Genre',appearances:'Appearances',actor_a:'First actor',actor_b:'Second actor',films_together:'Films together',avg_rating:'Average IMDb rating',movie_count:'Films',decade:'Decade',avg_meta_score:'Average Metascore',meta_score_count:'Films with Metascore'};
function cellValue(key, value) {
  if (value == null) return 'Not available';
  if (key.includes('gross') && key !== 'gross_film_count') return money(value);
  if (key === 'decade') return `${value}s`;
  return typeof value === 'number' ? number(value) : escapeHTML(value);
}

async function runReport() {
  const request = ++state.request;
  const name = state.reportName;
  const button = $('[data-action="run-report"]');
  button.disabled = true;
  $('#report-output').innerHTML = '<div class="loading" role="status">Setting the scene…</div>';
  try {
    const result = await api(`/api/report?name=${encodeURIComponent(name)}`);
    if (request !== state.request) return;
    state.report = {...result,name};
    const valueKey = name.includes('gross') ? 'avg_gross' : name.includes('votes') ? 'avg_votes' : name === 'actor_top_genre' ? 'appearances' : 'avg_rating';
    const top = result.rows.slice(0,name === 'decade_trends' ? 20 : 8);
    const max = Math.max(...top.map(r => r[valueKey] ?? 0),1);
    const labelKey = result.columns[0];
    const title = reportRooms[state.page].options.find(([key]) => key === name)[1];
    const rowLabel = row => name.startsWith('actor_pairs') ? `${row.actor_a} + ${row.actor_b}` : cellValue(labelKey,row[labelKey]);
    $('#report-output').innerHTML = `<section class="reveal"><div class="report-summary"><div><h2>${title}</h2><p>${number(result.rows.length)} results · Queried from the archive</p></div><button class="button secondary small" data-action="download">Download CSV ↓</button></div>${result.rows.length ? `<div class="chart"><p class="eyebrow">${labels[valueKey]} · ${name === 'decade_trends' ? 'ALL DECADES' : 'FIRST 8 RESULTS'}</p>${top.map(row => `<div class="bar-row"><span>${rowLabel(row)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0,(row[valueKey] ?? 0)/max*100)}%"></div></div><span class="bar-value">${cellValue(valueKey,row[valueKey])}</span></div>`).join('')}</div><div class="table-wrap"><table><caption class="sr-only">${title}</caption><thead><tr>${result.columns.map(key => `<th scope="col">${labels[key] || escapeHTML(key)}</th>`).join('')}</tr></thead><tbody>${result.rows.map(row => `<tr>${result.columns.map(key => `<td>${cellValue(key,row[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : screenPlaceholder('No results yet.','There are no films meeting this report’s minimum sample size.')}</section>`;
  } catch(error) {
    if (request === state.request) $('#report-output').innerHTML = `<div class="empty"><h2>The screening was interrupted.</h2><p>${escapeHTML(error.message)}</p><p>Press “Roll the film” to retry.</p></div>`;
  } finally {
    if (request === state.request && button.isConnected) button.disabled = false;
  }
}

function entityOptions() {
  if (state.compareKind === 'movie') return state.data.movies.map(m => ({id:String(m.movie_id),label:`${m.title} (${m.released_year ?? 'year unknown'})`}));
  if (state.compareKind === 'director') return state.data.directors.map(d => ({id:d.director,label:`${d.director} · ${d.film_count} films`}));
  return state.data.actors.map(a => ({id:String(a.star_id),label:`${a.star_name} · ${a.film_count} films`}));
}

function comparePage() {
  const options = entityOptions();
  return `${heading('03 / DOUBLE FEATURE','Two perspectives.<br><em>One frame.</em>','Put your favorites side by side. Find the shared threads, the surprising differences, and the films behind the figures.')}
  <div class="segmented" role="group" aria-label="Comparison type">${[['movie','Movies'],['director','Directors'],['actor','Actors']].map(([key,label]) => `<button data-action="compare-mode" data-kind="${key}" class="${state.compareKind === key ? 'active' : ''}" aria-pressed="${state.compareKind === key}">${label}</button>`).join('')}</div>
  <div class="compare-selectors">${[0,1].map((side) => `${side ? '<button class="swap" data-action="swap" aria-label="Swap comparison sides">⇄</button>' : ''}<div class="field"><label for="choice-${side}">${side ? 'Side B / The counterpoint' : 'Side A / The opening act'}</label><input type="search" id="entity-search-${side}" data-side="${side}" placeholder="Filter ${state.compareKind === 'movie' ? 'movie titles' : 'names'}…" aria-label="Filter choices for side ${side ? 'B' : 'A'}"><select id="choice-${side}" data-side="${side}"><option value="">Choose a ${state.compareKind}…</option>${options.map(o => `<option value="${escapeHTML(o.id)}" ${state.choices[side] === o.id ? 'selected' : ''}>${escapeHTML(o.label)}</option>`).join('')}</select></div>`).join('')}</div>
  <div class="compare-actions"><button class="button" data-action="reveal-comparison">Reveal the comparison <span>↗</span></button><label class="check-label"><input type="checkbox" id="differences">Differences only</label></div><div id="comparison-output" aria-live="polite">${screenPlaceholder('A conversation between two.','Choose two different entries, then reveal what connects—and separates—them.')}</div><p class="footnote">All figures describe this collection. Revenue is not inflation-adjusted; missing values are never zero. IMDb and Metascore use different scales and audiences. More revenue, votes, or runtime does not mean a better film.</p>`;
}

async function revealComparison() {
  if (!state.choices.every(Boolean)) return notify('Choose an entry for each side first.');
  if (state.choices[0] === state.choices[1]) return notify('Choose two different entries to compare.');
  const request = ++state.request;
  const query = new URLSearchParams({kind:state.compareKind});
  state.choices.forEach(id => query.append('id',id));
  $('#comparison-output').innerHTML = '<div class="loading" role="status">Bringing the two stories together…</div>';
  try {
    const data = await api(`/api/compare?${query}`);
    if (request !== state.request) return;
    state.comparison = data;
    renderComparison();
  } catch(error) {
    if (request === state.request) $('#comparison-output').innerHTML = `<div class="empty"><h2>The comparison could not load.</h2><p>${escapeHTML(error.message)}</p></div>`;
  }
}

function renderComparison() {
  if (!state.comparison) return;
  const {kind,entities:[a,b]} = state.comparison;
  const differenceOnly = $('#differences').checked;
  const metrics = [['imdb_rating','IMDb / 10'],['meta_score','Metascore / 100'],['runtime_minutes','Runtime · minutes'],['no_of_votes','Audience votes'],['gross','Reported gross']];
  if (kind !== 'movie') metrics.unshift(['film_count','Films in collection']);
  const commonFilms = a.films.filter(f => b.films.some(other => other.movie_id === f.movie_id));
  let connections = '';
  if (kind === 'movie') {
    const ma = state.data.movies.find(m => m.movie_id === a.films[0].movie_id);
    const mb = state.data.movies.find(m => m.movie_id === b.films[0].movie_id);
    const genres = ma.genres.filter(g => mb.genres.includes(g));
    const cast = ma.cast.filter(person => mb.cast.some(p => p.id === person.id)).map(p => p.name);
    connections = [genres.length ? `Shared genres: ${genres.join(', ')}.` : 'No shared genres.',cast.length ? `Shared credited stars: ${cast.join(', ')}.` : 'No shared stars among the four source credits.',ma.director === mb.director ? `Both directed by ${ma.director}.` : ''].filter(Boolean).join(' ');
    if (a.metrics.runtime_minutes != null && b.metrics.runtime_minutes != null) {
      const gap = a.metrics.runtime_minutes-b.metrics.runtime_minutes;
      connections += gap === 0 ? ' Both have the same runtime.' : ` ${a.name} is ${Math.abs(gap)} minutes ${gap > 0 ? 'longer' : 'shorter'}.`;
    }
  } else connections = commonFilms.length ? `${commonFilms.length} shared films in this collection: ${commonFilms.map(f => f.title).join(', ')}.` : 'These two have no shared films in this collection.';
  const filmList = e => `<div class="film-list">${e.films.map(f => `<button data-action="details" data-id="${f.movie_id}"><span>${escapeHTML(f.title)}</span><span>${f.released_year ?? '—'} · ★ ${number(f.imdb_rating)}</span></button>`).join('')}</div>`;
  $('#comparison-output').innerHTML = `<section class="reveal"><div class="comparison-titles">${[a,b].map((e,i) => `<div class="comparison-title"><p class="eyebrow">${i ? 'B / THE COUNTERPOINT' : 'A / THE OPENING ACT'}</p><h2>${escapeHTML(e.name)}</h2><p>${kind === 'movie' ? `${e.films[0].released_year ?? 'Year unknown'} · ${escapeHTML(e.films[0].director)}` : `${e.films.length} films represented in this collection`}</p></div>`).join('')}</div>${metrics.filter(([key]) => !differenceOnly || a.metrics[key] !== b.metrics[key]).map(([key,label]) => `<div class="metric-row">${[a,b].map((e,i) => `${i ? `<div class="metric-label">${kind !== 'movie' && key !== 'film_count' ? 'Average ' : ''}${label}</div>` : ''}<div class="metric-value">${key === 'gross' ? money(e.metrics[key]) : number(e.metrics[key])}${kind !== 'movie' && key !== 'film_count' ? `<small>Based on ${e.metrics[key+'_count']} of ${e.metrics.film_count} films</small>` : ''}</div>`).join('')}</div>`).join('')}<div class="connection-note"><strong>The connecting thread</strong><br>${escapeHTML(connections)}</div><div class="section-title"><h2>${kind === 'movie' ? 'Explore each film' : 'The films behind the figures'}</h2></div><div class="film-columns">${filmList(a)}${filmList(b)}</div></section>`;
}

function showDetails(id) {
  const m = state.data.movies.find(movie => movie.movie_id === Number(id));
  if (!m) return;
  $('#movie-dialog').innerHTML = `<button class="dialog-close" data-action="close-dialog" aria-label="Close film details">×</button><div class="detail-layout"><div class="detail-poster">${poster(m)}</div><div><p class="eyebrow">FRAME ${String(m.movie_id).padStart(3,'0')} / THE COLLECTION</p><h2>${escapeHTML(m.title)}</h2><p class="detail-meta">${m.released_year ?? 'Year unknown'} · ${m.runtime_minutes ?? '—'} minutes · ${escapeHTML(m.genres.join(' / '))}</p><p class="detail-overview">${escapeHTML(m.overview)}</p><div class="detail-metrics"><div><strong>${number(m.imdb_rating)}</strong><small>IMDb / 10</small></div><div><strong>${number(m.meta_score)}</strong><small>Metascore / 100</small></div></div><p class="detail-credits">Directed by <b>${escapeHTML(m.director)}</b><br>Listed stars: <b>${m.cast.map(p => escapeHTML(p.name)).join(', ')}</b><br>${number(m.no_of_votes)} votes · ${money(m.gross)} reported gross</p><button class="button" data-action="add" data-id="${m.movie_id}">${state.tray.includes(m.movie_id) ? 'Remove from comparison' : 'Add to comparison +'} </button></div></div>`;
  if (!$('#movie-dialog').open) $('#movie-dialog').showModal();
}

function updateTray() {
  const tray = $('#compare-tray');
  tray.hidden = !state.tray.length || $('#app').hidden;
  tray.innerHTML = `<span class="tray-label">YOUR DOUBLE<br>FEATURE</span><div class="tray-items">${[0,1].map(i => {const m = state.data.movies.find(m => m.movie_id === state.tray[i]);return `<div class="tray-slot"><span>${m ? escapeHTML(m.title) : 'Choose a second film'}</span>${m ? `<button data-action="remove" data-id="${m.movie_id}" aria-label="Remove ${escapeHTML(m.title)}">×</button>` : ''}</div>`;}).join('')}</div><button class="button small" data-action="tray-compare" ${state.tray.length !== 2 ? 'disabled' : ''}>Compare the films ↗</button>`;
}

function toggleMovie(id) {
  id = Number(id);
  if (state.tray.includes(id)) state.tray = state.tray.filter(x => x !== id);
  else {
    if (state.tray.length === 2) return notify('Your double feature is full. Remove a film from the tray to replace it.');
    state.tray.push(id);
    notify(state.tray.length === 1 ? 'First film selected. Choose its counterpoint.' : 'Your double feature is ready.');
  }
  updateTray();
  if (state.page === 'collection') renderCollection();
  if (state.page === 'home') $('#main').innerHTML = home();
  if ($('#movie-dialog').open) showDetails(id);
}

async function navigate(page, updateHash = true) {
  if (!tabs.some(([key]) => key === page)) page = 'home';
  const navigationRequest = ++state.request;
  state.page = page;
  state.report = null;
  if (updateHash && location.hash !== `#${page}`) history.pushState(null,'',`#${page}`);
  $('#navigation').innerHTML = tabs.map(([key,label]) => `<button class="nav-link ${key === page ? 'active' : ''}" data-action="navigate" data-page="${key}" ${key === page ? 'aria-current="page"' : ''}>${label}</button>`).join('');
  const main = $('#main');
  if (!state.data) {
    main.innerHTML = '<div class="loading" role="status">Opening the archive…</div>';
    try {await loadData();} catch(error) {main.innerHTML = `<div class="empty"><h2>The archive is temporarily closed.</h2><p>${escapeHTML(error.message)}</p><button class="button" data-action="retry">Try again</button></div>`;return;}
    if (page !== state.page || navigationRequest !== state.request) return;
  }
  main.innerHTML = page === 'home' ? home() : page === 'story' ? story() : page === 'collection' ? collection() : page === 'compare' ? comparePage() : reportPage(page);
  main.classList.remove('page-enter');
  void main.offsetWidth;
  main.classList.add('page-enter');
  if (page === 'collection') renderCollection();
  if (page === 'compare' && state.comparison) renderComparison();
  updateTray();
  window.scrollTo({top:0,behavior:'instant'});
  main.focus({preventScroll:true});
  document.title = `${tabs.find(([key]) => key === page)[1]} — Double Feature`;
}

let entranceRun = 0;

function preparePrologue() {
  loadData().then(() => {
    $('#lobby-preview').innerHTML = `<div class="preview-header"><span>Ⅱ &nbsp; DOUBLE FEATURE</span><span>THE CINEMA IS YOURS.</span></div><div class="preview-navigation">The lobby &nbsp; The story &nbsp; The collection &nbsp; Compare &nbsp; Directors</div><div class="preview-home">${home()}</div>`;
    document.querySelectorAll('[data-film]').forEach(frame => {
      const movie = state.data.movies.find(m => m.title === frame.dataset.film);
      if (!movie?.poster || frame.querySelector('img')) return;
      const image = document.createElement('img');
      image.alt = '';
      image.referrerPolicy = 'no-referrer';
      image.src = movie.poster;
      frame.append(image);
    });
  }).catch(() => {
    $('#lobby-preview').innerHTML = '<div class="preview-header">Ⅱ &nbsp; DOUBLE FEATURE</div><div class="preview-navigation">The lobby &nbsp; The story &nbsp; The collection &nbsp; Compare</div><div class="preview-home"><section class="home-hero"><div><h1>The lights dim.<br>The stories <em>begin.</em></h1><p>A thousand films. The people who made them.</p></div></section></div>';
  });
}

async function openDoors() {
  const trigger = $('#door-trigger');
  if (trigger.disabled) return;
  const run = ++entranceRun;
  trigger.disabled = true;
  $('#quote-room').hidden = false;
  preparePrologue();
  // Establish the closed-door frame before starting both reveals.
  void $('#quote-room').offsetWidth;
  $('#entrance').classList.add('doors-opening');
  if (!reducedMotion()) await new Promise(resolve => setTimeout(resolve,1700));
  if (run !== entranceRun) return;
  trigger.hidden = true;
  $('#quote-room').inert = false;
  $('#cinema-quote').focus({preventScroll:true});
  document.title = 'The prologue — Double Feature';
}

function resetEntrance(updateHistory = true) {
  entranceRun++;
  state.request++;
  $('#app').hidden = true;
  $('#compare-tray').hidden = true;
  $('#entrance').hidden = false;
  $('#entrance').classList.remove('doors-opening','leaving');
  $('#door-trigger').hidden = false;
  $('#door-trigger').disabled = false;
  $('#quote-room').hidden = true;
  $('#quote-room').inert = true;
  $('#quote-room').scrollTop = 0;
  $('#enter').disabled = false;
  document.body.classList.add('entrance-active');
  if (updateHistory) history.pushState(null,'',location.pathname);
  window.scrollTo(0,0);
  $('#door-trigger').focus({preventScroll:true});
  document.title = 'Double Feature — A world within every frame';
}

async function enter(animate = true, page = 'home') {
  const run = ++entranceRun;
  $('#enter').disabled = true;
  if (animate && !reducedMotion()) {
    $('#entrance').classList.add('leaving');
    await new Promise(resolve => setTimeout(resolve,350));
  }
  if (run !== entranceRun) return;
  $('#entrance').hidden = true;
  $('#app').hidden = false;
  document.body.classList.remove('entrance-active');
  await navigate(page);
}

$('#door-trigger').addEventListener('click',openDoors);
$('#enter').addEventListener('click',() => enter(true));

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const {action,id,page,kind} = button.dataset;
  if (action === 'navigate') navigate(page);
  else if (action === 'retry') navigate(state.page);
  else if (action === 'entrance') {
    resetEntrance();
  } else if (action === 'details') showDetails(id);
  else if (action === 'close-dialog') $('#movie-dialog').close();
  else if (action === 'add' || action === 'remove') toggleMovie(id);
  else if (action === 'prev' || action === 'next') {state.pagination += action === 'prev' ? -1 : 1;renderCollection();$('#collection-results').scrollIntoView({behavior:reducedMotion() ? 'instant' : 'smooth',block:'start'});}
  else if (action === 'reset-filters') {state.filters = {search:'',genre:'',decade:'',sort:'rating'};state.pagination = 1;navigate('collection');}
  else if (action === 'run-report') runReport();
  else if (action === 'compare-mode') {state.request++;state.compareKind = kind;state.choices = ['',''];state.comparison = null;navigate('compare');}
  else if (action === 'swap') {state.choices.reverse();if(state.comparison) state.comparison.entities.reverse();navigate('compare');}
  else if (action === 'reveal-comparison') revealComparison();
  else if (action === 'tray-compare') {state.compareKind = 'movie';state.choices = state.tray.map(String);state.comparison = null;navigate('compare').then(revealComparison);}
  else if (action === 'download' && state.report) {
    const link = document.createElement('a');
    link.href = `/api/report?name=${encodeURIComponent(state.report.name)}&format=csv`;
    link.download = `${state.report.name}.csv`;
    document.body.append(link);link.click();link.remove();
  }
});

document.addEventListener('input', event => {
  const target = event.target;
  if (target.id === 'movie-search') {state.filters.search = target.value;state.pagination=1;renderCollection();}
  if (target.id.startsWith('entity-search-')) {
    const side = Number(target.dataset.side);
    const options = entityOptions().filter(o => o.label.toLocaleLowerCase().includes(target.value.toLocaleLowerCase()) || o.id === state.choices[side]);
    $(`#choice-${side}`).innerHTML = `<option value="">Choose a ${state.compareKind}…</option>${options.map(o => `<option value="${escapeHTML(o.id)}" ${state.choices[side] === o.id ? 'selected' : ''}>${escapeHTML(o.label)}</option>`).join('')}`;
  }
});

document.addEventListener('change', event => {
  const {id,value} = event.target;
  if (['genre-filter','decade-filter','sort-filter'].includes(id)) {state.filters[id.split('-')[0]]=value;state.pagination=1;renderCollection();}
  else if (id === 'report-select') {state.request++;state.reportName=value;state.report=null;$('#report-output').innerHTML=screenPlaceholder();$('[data-action="run-report"]').disabled=false;}
  else if (id.startsWith('choice-')) {state.request++;state.choices[Number(event.target.dataset.side)]=value;state.comparison=null;$('#comparison-output').innerHTML=screenPlaceholder('Ready for a new perspective.','Reveal the comparison to see the updated selection.');}
  else if (id === 'differences') renderComparison();
});

$('#movie-dialog').addEventListener('click', event => {if (event.target === $('#movie-dialog')) {const r = event.target.getBoundingClientRect();if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) event.target.close();}});
window.addEventListener('popstate', () => {
  const page = location.hash.slice(1);
  if (!page) resetEntrance(false);
  else if ($('#app').hidden) enter(false,page);
  else navigate(page,false);
});
if (location.hash) enter(false,location.hash.slice(1));
