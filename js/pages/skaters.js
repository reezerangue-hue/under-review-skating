/**
 * Under Review Skating — Skaters directory page
 * All skaters alphabetically with search and nation filter.
 */
async function renderSkaters() {
  const app = document.getElementById('app');

  const { skaters, competitions, results } = await SheetsDB.getAllData();

  /* Determine active skater IDs (scored result in current season) */
  const currentSeason = (() => {
    const seasons = [...new Set(competitions.filter(c => c.season).map(c => c.season))].sort();
    return seasons[seasons.length - 1] || null;
  })();
  const currentSeasonCompIds = new Set(competitions.filter(c => c.season === currentSeason).map(c => c.id));
  const activeIds = new Set([
    ...results.filter(r => currentSeasonCompIds.has(r.competition_id) && r.total_score > 0).map(r => r.skater_id),
    ...skaters.filter(s => s.season_best_short > 0 || s.season_best_free > 0 || s.season_best_total > 0).map(s => s.id),
  ]);

  /* Sorted alphabetically */
  const sorted = [...skaters].sort((a, b) => a.name.localeCompare(b.name));

  /* Unique nations for the filter dropdown, sorted alphabetically */
  const nations = [...new Set(
    skaters.filter(s => s.country).map(s => s.country)
  )].sort((a, b) => a.localeCompare(b));

  app.innerHTML = `
    <div class="page-enter">
      <div class="container">

        <section style="padding:var(--space-2xl) 0 var(--space-xl);text-align:center;position:relative">
          <div class="sparkle-field" id="skaters-sf"></div>
          <p style="font-size:.72rem;font-weight:700;letter-spacing:.28em;text-transform:uppercase;color:var(--text-muted);margin-bottom:var(--space-sm)">
            ${Sparkles.html('sparkle-sm')} Directory ${Sparkles.html('sparkle-sm')}
          </p>
          <h1 class="hero-title" style="font-size:clamp(2.5rem,10vw,6rem)">Skaters</h1>
        </section>

        <!-- FILTER BAR -->
        <div style="display:flex;gap:var(--space-sm);align-items:center;flex-wrap:wrap;margin-bottom:var(--space-xl)">
          <input
            type="search"
            id="skaters-search"
            class="search-input"
            style="width:220px"
            placeholder="Search by name…"
            autocomplete="off"
            aria-label="Search skaters"
          >
          <select id="skaters-nation" class="filter-select" aria-label="Filter by nation">
            <option value="">All Nations</option>
            ${nations.map(n => `<option value="${n}">${n}</option>`).join('')}
          </select>
          <select id="skaters-status" class="filter-select" aria-label="Filter by status">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <span id="skaters-count" style="font-size:.78rem;color:var(--text-muted);margin-left:auto">
            ${sorted.length} skater${sorted.length !== 1 ? 's' : ''}
          </span>
        </div>

        <!-- SKATER GRID -->
        <div id="skaters-grid" class="grid-4" style="margin-bottom:var(--space-2xl)">
          ${sorted.map(s => skaterCard(s)).join('')}
        </div>

        <p id="skaters-empty" class="no-data" style="display:none;text-align:center">No skaters match your filters.</p>

      </div>
    </div>`;

  Sparkles.scatter(document.getElementById('skaters-sf'), 16);

  /* Live filtering */
  const searchEl = document.getElementById('skaters-search');
  const nationEl = document.getElementById('skaters-nation');
  const statusEl = document.getElementById('skaters-status');
  const countEl  = document.getElementById('skaters-count');
  const gridEl   = document.getElementById('skaters-grid');
  const emptyEl  = document.getElementById('skaters-empty');

  function applyFilters() {
    const q       = searchEl.value.trim().toLowerCase();
    const nation  = nationEl.value;
    const status  = statusEl.value;
    const visible = sorted.filter(s =>
      (!q      || s.name.toLowerCase().includes(q)) &&
      (!nation || s.country === nation) &&
      (!status || (status === 'active' ? activeIds.has(s.id) : !activeIds.has(s.id)))
    );

    gridEl.innerHTML  = visible.map(s => skaterCard(s)).join('');
    emptyEl.style.display = visible.length ? 'none' : 'block';
    countEl.textContent   = `${visible.length} skater${visible.length !== 1 ? 's' : ''}`;
  }

  searchEl.addEventListener('input', applyFilters);
  nationEl.addEventListener('change', applyFilters);
  statusEl.addEventListener('change', applyFilters);
}

function skaterCard(s) {
  return `
    <a href="#/skater/${s.id}" class="skater-card">
      ${s.photo_url
        ? `<img class="skater-photo" src="${s.photo_url}" alt="${s.name}" loading="lazy">`
        : `<div class="skater-photo-placeholder" aria-hidden="true">✦</div>`}
      <div class="skater-card-body">
        <p class="skater-card-name">${s.name}</p>
        <p class="skater-card-country">${Nav.getFlagEmoji(s.country_code)} ${s.country || ''}</p>
        ${s.personal_best_total ? `
        <p class="skater-card-pb-label">Personal Best</p>
        <p class="skater-card-pb">${s.personal_best_total.toFixed(2)}</p>` : ''}
      </div>
    </a>`;
}
