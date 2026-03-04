/**
 * Under Review Skating — Home / Competition Hub page
 */
async function renderHome() {
  const app = document.getElementById('app');

  const [competitions, skaters, results] = await Promise.all([
    SheetsDB.getCompetitions(),
    SheetsDB.getSkaters(),
    SheetsDB.getResults(),
  ]);

  const recentComp = competitions[0] || null;

  /* Build combined SP+FS totals for the most recent competition */
  const recentResults = (() => {
    if (!recentComp) return [];
    const compResults = results.filter(r => r.competition_id === recentComp.id && r.total_score);
    const bySkater = {};
    compResults.forEach(r => {
      if (!bySkater[r.skater_id]) bySkater[r.skater_id] = { skater_id: r.skater_id, sp: null, fs: null };
      if (r.segment === 'Short Program') bySkater[r.skater_id].sp = r.total_score;
      if (r.segment === 'Free Skate')    bySkater[r.skater_id].fs = r.total_score;
    });
    return Object.values(bySkater)
      .map(e => ({ ...e, combined: (e.sp || 0) + (e.fs || 0) }))
      .filter(e => e.combined > 0)
      .sort((a, b) => b.combined - a.combined)
      .slice(0, 10);
  })();

  const recentComps = competitions.slice(0, 6);

  /* Unique seasons from competitions, newest first */
  const seasons = [...new Set(competitions.filter(c => c.season).map(c => c.season))]
    .sort((a, b) => b.localeCompare(a));

  /* Per-season best combined totals from actual results */
  const compSeasonMap = Object.fromEntries(competitions.map(c => [c.id, c.season]));
  const seasonBestBySkater = {}; // seasonBestBySkater[season][skater_id] = best combined total
  const compCombined = {};
  results.forEach(r => {
    if (!r.total_score) return;
    const key = `${r.competition_id}__${r.skater_id}`;
    if (!compCombined[key]) compCombined[key] = { comp_id: r.competition_id, skater_id: r.skater_id, total: 0 };
    compCombined[key].total += r.total_score;
  });
  Object.values(compCombined).forEach(({ comp_id, skater_id, total }) => {
    const season = compSeasonMap[comp_id];
    if (!season) return;
    if (!seasonBestBySkater[season]) seasonBestBySkater[season] = {};
    if (!seasonBestBySkater[season][skater_id] || total > seasonBestBySkater[season][skater_id])
      seasonBestBySkater[season][skater_id] = total;
  });

  /* Returns top-10 skater cards for a given filter value */
  function getTopSkaters(filter) {
    if (filter === 'all-time') {
      return [...skaters]
        .filter(s => s.personal_best_total > 0)
        .sort((a, b) => b.personal_best_total - a.personal_best_total)
        .slice(0, 10)
        .map(s => ({ skater: s, score: s.personal_best_total, label: 'Personal Best' }));
    }
    if (filter === 'this-season') {
      return [...skaters]
        .filter(s => s.season_best_total > 0)
        .sort((a, b) => b.season_best_total - a.season_best_total)
        .slice(0, 10)
        .map(s => ({ skater: s, score: s.season_best_total, label: 'Season Best' }));
    }
    /* Specific season — from results */
    const bests = seasonBestBySkater[filter] || {};
    return Object.entries(bests)
      .map(([sid, score]) => ({ skater: skaterMap[sid], score }))
      .filter(e => e.skater)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(e => ({ ...e, label: 'Season Best' }));
  }

  function skaterGridHTML(items) {
    if (!items.length) return '<p class="no-data">No data for this filter.</p>';
    return `<div class="grid-5" id="top-skaters-grid">${items.map(({ skater: s, score, label }) => `
      <a href="#/skater/${s.id}" class="skater-card">
        ${s.photo_url
          ? `<img class="skater-photo" src="${s.photo_url}" alt="${s.name}" loading="lazy">`
          : `<div class="skater-photo-placeholder" aria-hidden="true">✦</div>`}
        <div class="skater-card-body">
          <p class="skater-card-name">${s.name}</p>
          <p class="skater-card-country">${Nav.getFlagEmoji(s.country_code)} ${s.country || ''}</p>
          <p class="skater-card-pb-label">${label}</p>
          <p class="skater-card-pb">${score.toFixed(2)}</p>
        </div>
      </a>`).join('')}</div>`;
  }

  const hasSkaterData = skaters.some(s => s.personal_best_total > 0 || s.season_best_total > 0);

  const skaterMap = Object.fromEntries(skaters.map(s => [s.id, s]));

  /* Points-based season standings for the most recent season */
  function placementPoints(pos) {
    const pts = 11 - pos; // 1st=10, 2nd=9 … 10th=1
    return pts > 0 ? pts : 0;
  }

  const mostRecentSeason = competitions.find(c => c.season)?.season || null;
  const seasonComps = mostRecentSeason
    ? competitions.filter(c => c.season === mostRecentSeason)
    : [];

  const skaterPoints = {};
  seasonComps.forEach(comp => {
    const compResults = results.filter(r => r.competition_id === comp.id && r.total_score > 0);
    const combined = {};
    compResults.forEach(r => { combined[r.skater_id] = (combined[r.skater_id] || 0) + r.total_score; });
    Object.entries(combined)
      .sort((a, b) => b[1] - a[1])
      .forEach(([sid], i) => {
        const pts = placementPoints(i + 1);
        if (pts > 0) skaterPoints[sid] = (skaterPoints[sid] || 0) + pts;
      });
  });

  const seasonStandings = Object.entries(skaterPoints)
    .map(([sid, pts]) => ({ skater: skaterMap[sid], pts, sid }))
    .filter(e => e.skater && e.skater.season_best_total > 0)
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 10);

  function levelClass(l) { return 'level-' + (l || 'default').replace(/\s+/g, ''); }
  function placeClass(p) { if (p===1) return 'gold'; if (p===2) return 'silver'; if (p===3) return 'bronze'; return ''; }
  function formatDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    return isNaN(dt) ? d : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  app.innerHTML = `
    <div class="page-enter">
      <!-- HERO -->
      <section class="hero">
        <div class="sparkle-field" id="hero-sf"></div>
        <p class="hero-eyebrow">${Sparkles.html('sparkle-sm')} Live Scores &amp; Statistics ${Sparkles.html('sparkle-sm')}</p>
        <h1 class="hero-title">Under<br>Review</h1>
        <p class="hero-sub">Figure skating scores, protocol sheets, and analytics — all in one place.</p>
        <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap">
          <a href="#/stats" class="btn">Season Statistics</a>
          ${recentComp ? `<a href="#/competition/${recentComp.id}" class="btn">Latest Event</a>` : ''}
        </div>
      </section>

      <div class="container">

        ${recentComp ? `
        <!-- LIVE LEADERBOARD -->
        <section style="margin-bottom:var(--space-2xl)">
          <div class="section-header">
            <div>
              <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} Most Recent</p>
              <h2 class="section-title">${recentComp.name}</h2>
            </div>
            <a href="#/competition/${recentComp.id}" class="section-link">Full results →</a>
          </div>
          <div style="display:flex;gap:var(--space-sm);align-items:center;margin-bottom:var(--space-md);flex-wrap:wrap">
            <span class="level-badge ${levelClass(recentComp.level)}">${recentComp.level || 'Event'}</span>
            <span style="color:var(--text-muted);font-size:.82rem">${recentComp.location ? recentComp.location + ' &middot; ' : ''}${formatDate(recentComp.date)}</span>
          </div>
          ${recentResults.length ? `
          <div class="table-wrap">
            <table class="data-table" aria-label="Recent competition results">
              <thead><tr>
                <th style="width:3rem">#</th>
                <th>Skater</th>
                <th style="text-align:right">SP</th>
                <th style="text-align:right">FS</th>
                <th style="text-align:right">Total</th>
              </tr></thead>
              <tbody>
                ${recentResults.map((r, i) => {
                  const sk = skaterMap[r.skater_id];
                  const pc = placeClass(i + 1);
                  return `<tr onclick="Router.go('/skater/${r.skater_id}')">
                    <td class="place-cell ${pc}">${i + 1}</td>
                    <td><a href="#/skater/${r.skater_id}" onclick="event.stopPropagation()" style="font-weight:500">${sk ? sk.name : 'Unknown'}</a>
                      ${sk ? `<span style="margin-left:6px;font-size:.8rem">${Nav.getFlagEmoji(sk.country_code)}</span>` : ''}
                    </td>
                    <td class="score-cell">${r.sp ? r.sp.toFixed(2) : '—'}</td>
                    <td class="score-cell">${r.fs ? r.fs.toFixed(2) : '—'}</td>
                    <td class="score-cell total">${r.combined.toFixed(2)}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>` : '<p class="no-data">No results recorded yet.</p>'}
        </section>` : ''}

        ${hasSkaterData ? `
        <!-- TOP SKATERS (filterable) -->
        <section style="margin-bottom:var(--space-2xl)">
          <div class="section-header">
            <div>
              <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} Skaters</p>
              <h2 class="section-title">Top Skaters</h2>
            </div>
            <select id="top-skaters-filter" class="filter-select" aria-label="Filter top skaters">
              <option value="this-season">This Season</option>
              <option value="all-time">All Time</option>
              ${seasons.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
          <div id="top-skaters-wrap">
            ${skaterGridHTML(getTopSkaters('this-season'))}
          </div>
        </section>` : ''}

        ${seasonStandings.length ? `
        <!-- SEASON STANDINGS -->
        <section style="margin-bottom:var(--space-2xl)">
          <div class="section-header">
            <div>
              <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} ${mostRecentSeason || 'Season'}</p>
              <h2 class="section-title">Season Standings</h2>
            </div>
            <a href="#/stats" class="section-link">Full stats →</a>
          </div>
          <p style="color:var(--text-muted);font-size:.74rem;margin-bottom:var(--space-md)">
            Points: 1st = 10 pts · 2nd = 9 pts · … · 10th = 1 pt
          </p>
          <div class="card" style="padding:var(--space-md)">
            ${seasonStandings.map((e, i) => `
              <div class="lb-row" onclick="Router.go('/skater/${e.sid}')" style="cursor:pointer">
                <span class="lb-rank ${i<3?'r'+(i+1):''}">${i+1}</span>
                <div class="lb-name"><a href="#/skater/${e.sid}" onclick="event.stopPropagation()">${e.skater.name}</a></div>
                <span class="lb-country">${Nav.getFlagEmoji(e.skater.country_code)} ${e.skater.country||''}</span>
                <span class="lb-score">${e.pts} <span style="font-size:.68rem;opacity:.6;font-weight:500">pts</span></span>
              </div>`).join('')}
          </div>
        </section>` : ''}

        ${recentComps.length ? `
        <!-- RECENT EVENTS -->
        <section style="margin-bottom:var(--space-2xl)">
          <div class="section-header">
            <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} Events</p>
            <h2 class="section-title">Recent Competitions</h2>
          </div>
          <div class="grid-3">
            ${recentComps.map(c => `
              <a href="#/competition/${c.id}" class="comp-card">
                <p class="comp-card-name">${c.name}</p>
                <div class="comp-card-meta">
                  <span class="level-badge ${levelClass(c.level)}">${c.level||'Event'}</span>
                  <span>${c.location||''}</span>
                  <span>${formatDate(c.date)}</span>
                </div>
              </a>`).join('')}
          </div>
        </section>` : ''}

        ${!recentComp && !hasSkaterData ? `
          <div class="not-configured">
            <h3>✦ Welcome to Under Review Skating</h3>
            <p>Connect your Google Sheet to see live leaderboards, skater profiles, and protocol sheets.</p>
            <p>Edit <code>js/config.js</code> with your Sheet ID and API key.</p>
          </div>` : ''}

      </div>
    </div>`;

  Sparkles.scatter(document.getElementById('hero-sf'), 22);

  const filterEl = document.getElementById('top-skaters-filter');
  if (filterEl) {
    filterEl.addEventListener('change', () => {
      document.getElementById('top-skaters-wrap').innerHTML = skaterGridHTML(getTopSkaters(filterEl.value));
    });
  }
}
