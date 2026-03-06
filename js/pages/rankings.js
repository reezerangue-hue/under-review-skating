/**
 * Under Review Skating — Rankings page
 * Lists every skater ranked by personal best (all time) or season best (this season).
 * Scores are computed live from results — the sheet values are only a floor.
 */
async function renderRankings() {
  const app = document.getElementById('app');

  const { skaters, competitions, results } = await SheetsDB.getAllData();

  /* ── Determine current season ─────────────────────────────── */
  const currentSeason = (() => {
    const seasons = [...new Set(competitions.filter(c => c.season).map(c => c.season))].sort();
    return seasons[seasons.length - 1] || null;
  })();
  const currentSeasonCompIds = new Set(
    competitions.filter(c => c.season === currentSeason).map(c => c.id)
  );

  /* ── Enrich each skater with computed PBs/SBs ────────────── */
  const enriched = skaters.map(s => {
    const sr = results.filter(r => r.skater_id === s.id);

    const spAll = sr.filter(r => r.segment === 'Short Program' && r.total_score > 0);
    const fsAll = sr.filter(r => r.segment === 'Free Skate'    && r.total_score > 0);

    const computedPbShort = spAll.length ? Math.max(...spAll.map(r => r.total_score)) : 0;
    const computedPbFree  = fsAll.length ? Math.max(...fsAll.map(r => r.total_score)) : 0;

    const totalByComp = {};
    sr.filter(r => r.total_score > 0).forEach(r => {
      totalByComp[r.competition_id] = (totalByComp[r.competition_id] || 0) + r.total_score;
    });
    const computedPbTotal = Object.values(totalByComp).length
      ? Math.max(...Object.values(totalByComp)) : 0;

    const spSeason = spAll.filter(r => currentSeasonCompIds.has(r.competition_id));
    const fsSeason = fsAll.filter(r => currentSeasonCompIds.has(r.competition_id));
    const computedSbShort = spSeason.length ? Math.max(...spSeason.map(r => r.total_score)) : 0;
    const computedSbFree  = fsSeason.length ? Math.max(...fsSeason.map(r => r.total_score)) : 0;

    const seasonTotalByComp = {};
    sr.filter(r => r.total_score > 0 && currentSeasonCompIds.has(r.competition_id)).forEach(r => {
      seasonTotalByComp[r.competition_id] = (seasonTotalByComp[r.competition_id] || 0) + r.total_score;
    });
    const computedSbTotal = Object.values(seasonTotalByComp).length
      ? Math.max(...Object.values(seasonTotalByComp)) : 0;

    return {
      ...s,
      pbShort: Math.max(s.personal_best_short || 0, computedPbShort),
      pbFree:  Math.max(s.personal_best_free  || 0, computedPbFree),
      pbTotal: Math.max(s.personal_best_total || 0, computedPbTotal),
      sbShort: Math.max(s.season_best_short   || 0, computedSbShort),
      sbFree:  Math.max(s.season_best_free    || 0, computedSbFree),
      sbTotal: Math.max(s.season_best_total   || 0, computedSbTotal),
    };
  });

  /* ── Filter state ─────────────────────────────────────────── */
  let activePeriod  = 'all-time';  // 'all-time' | 'this-season'
  let activeSegment = 'combined';  // 'combined' | 'short' | 'free'

  const periodLabels  = { 'all-time': 'All Time', 'this-season': currentSeason ? `${currentSeason} Season` : 'This Season' };
  const segmentConfig = [
    { key: 'combined', label: 'Combined',      pbField: 'pbTotal', sbField: 'sbTotal' },
    { key: 'short',    label: 'Short Program', pbField: 'pbShort', sbField: 'sbShort' },
    { key: 'free',     label: 'Free Skate',    pbField: 'pbFree',  sbField: 'sbFree'  },
  ];

  function activeField() {
    const seg = segmentConfig.find(s => s.key === activeSegment);
    return activePeriod === 'all-time' ? seg.pbField : seg.sbField;
  }

  function scoreLabel() {
    const period = activePeriod === 'all-time' ? 'Personal Best' : 'Season Best';
    const seg    = segmentConfig.find(s => s.key === activeSegment);
    return `${seg.label} ${period}`;
  }

  /* ── Render shell ─────────────────────────────────────────── */
  app.innerHTML = `
    <div class="page-enter">
      <div class="container">

        <section style="padding:var(--space-2xl) 0 var(--space-xl);text-align:center;position:relative">
          <div class="sparkle-field" id="rankings-sf"></div>
          <p style="font-size:.72rem;font-weight:700;letter-spacing:.28em;text-transform:uppercase;color:var(--text-muted);margin-bottom:var(--space-sm)">
            ${Sparkles.html('sparkle-sm')} Personal Bests ${Sparkles.html('sparkle-sm')}
          </p>
          <h1 class="hero-title" style="font-size:clamp(2.5rem,10vw,6rem)">Rankings</h1>
        </section>

        <!-- PERIOD TOGGLE -->
        <div style="display:flex;gap:var(--space-sm);justify-content:center;flex-wrap:wrap;margin-bottom:var(--space-md)" role="group" aria-label="Filter by time period">
          <button class="btn"         data-period="all-time"    style="min-width:130px">All Time</button>
          <button class="btn btn-outline" data-period="this-season" style="min-width:130px">${periodLabels['this-season']}</button>
        </div>

        <!-- SEGMENT FILTER -->
        <div style="display:flex;gap:var(--space-sm);justify-content:center;flex-wrap:wrap;margin-bottom:var(--space-xl)" role="group" aria-label="Filter by segment">
          <button class="btn"             data-segment="combined" style="min-width:130px">Combined</button>
          <button class="btn btn-outline" data-segment="short"    style="min-width:130px">Short Program</button>
          <button class="btn btn-outline" data-segment="free"     style="min-width:130px">Free Skate</button>
        </div>

        <!-- RANKINGS TABLE -->
        <div style="overflow-x:auto;margin-bottom:var(--space-2xl)">
          <table id="rankings-table" style="width:100%;border-collapse:collapse;font-size:.88rem">
            <thead>
              <tr style="border-bottom:2px solid var(--glass-border)">
                <th style="padding:var(--space-sm) var(--space-md);text-align:center;width:3rem;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted)">#</th>
                <th style="padding:var(--space-sm) var(--space-md);text-align:left;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted)">Skater</th>
                <th style="padding:var(--space-sm) var(--space-md);text-align:left;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted)">Nation</th>
                <th id="rankings-score-header" style="padding:var(--space-sm) var(--space-md);text-align:right;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted)">Personal Best</th>
              </tr>
            </thead>
            <tbody id="rankings-body"></tbody>
          </table>
          <p id="rankings-empty" class="no-data" style="display:none;text-align:center;padding:var(--space-2xl)">No scores recorded yet.</p>
        </div>

      </div>
    </div>`;

  Sparkles.scatter(document.getElementById('rankings-sf'), 16);

  const bodyEl      = document.getElementById('rankings-body');
  const emptyEl     = document.getElementById('rankings-empty');
  const headerEl    = document.getElementById('rankings-score-header');
  const periodBtns  = app.querySelectorAll('[data-period]');
  const segmentBtns = app.querySelectorAll('[data-segment]');

  function renderRows() {
    const field = activeField();
    const ranked = enriched
      .filter(s => s[field] > 0)
      .sort((a, b) => b[field] - a[field]);

    headerEl.textContent = scoreLabel();

    if (!ranked.length) {
      bodyEl.innerHTML      = '';
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';

    bodyEl.innerHTML = ranked.map((s, i) => {
      const rank = i + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
      const rankDisplay = medal
        ? `<span title="Rank ${rank}">${medal}</span>`
        : `<span style="color:var(--text-muted)">${rank}</span>`;
      const flag   = Nav.getFlagEmoji(s.country_code);
      const rowBg  = rank <= 3 ? 'background:rgba(45,74,30,.04)' : '';

      return `
        <tr style="border-bottom:1px solid var(--glass-border);${rowBg}">
          <td style="padding:var(--space-sm) var(--space-md);text-align:center;font-weight:700">${rankDisplay}</td>
          <td style="padding:var(--space-sm) var(--space-md)">
            <a href="#/skater/${s.id}" style="display:flex;align-items:center;gap:var(--space-sm);font-weight:700;color:var(--forest);text-decoration:none">
              ${s.photo_url
                ? `<img src="${s.photo_url}" alt="" loading="lazy" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0">`
                : `<span style="width:32px;height:32px;border-radius:50%;background:var(--light-sage);display:inline-flex;align-items:center;justify-content:center;font-size:.7rem;flex-shrink:0;color:var(--forest)">✦</span>`}
              ${s.name}
            </a>
          </td>
          <td style="padding:var(--space-sm) var(--space-md);color:var(--text-secondary)">${flag} ${s.country || '—'}</td>
          <td style="padding:var(--space-sm) var(--space-md);text-align:right;font-weight:700;font-size:1rem;font-family:var(--font-display)">${s[field].toFixed(2)}</td>
        </tr>`;
    }).join('');
  }

  function syncButtonStyles(btns, activeKey, dataAttr) {
    btns.forEach(btn => {
      const isActive = btn.dataset[dataAttr] === activeKey;
      btn.classList.toggle('btn-outline', !isActive);
    });
  }

  periodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      activePeriod = btn.dataset.period;
      syncButtonStyles(periodBtns, activePeriod, 'period');
      renderRows();
    });
  });

  segmentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      activeSegment = btn.dataset.segment;
      syncButtonStyles(segmentBtns, activeSegment, 'segment');
      renderRows();
    });
  });

  renderRows();
}
