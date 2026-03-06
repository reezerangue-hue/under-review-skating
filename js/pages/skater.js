/**
 * Under Review Skating — Skater Profile page
 */
async function renderSkater({ id }) {
  const app = document.getElementById('app');

  const [skater, allResults, allComps, stats, galleryImages, allResultsGlobal] = await Promise.all([
    SheetsDB.getSkater(id),
    SheetsDB.getSkaterResults(id),
    SheetsDB.getCompetitions(),
    SheetsDB.getSkaterStats(id),
    SheetsDB.getSkaterGallery(id),
    SheetsDB.getResults(),
  ]);

  if (!skater) {
    app.innerHTML = `
      <div class="error-state">
        <div class="error-icon">✦</div>
        <h2 class="error-title">Skater not found</h2>
        <p class="error-msg">No skater with id <code>${id}</code>.</p>
        <a href="#/" class="btn">Go home</a>
      </div>`;
    return;
  }

  const compMap = Object.fromEntries(allComps.map(c => [c.id, c]));

  /* ── Compute bests from results, override sheet if higher ──────────── */
  const spResults = allResults.filter(r => r.segment === 'Short Program' && r.total_score > 0);
  const fsResults = allResults.filter(r => r.segment === 'Free Skate'    && r.total_score > 0);

  const computedPbShort = spResults.length ? Math.max(...spResults.map(r => r.total_score)) : 0;
  const computedPbFree  = fsResults.length ? Math.max(...fsResults.map(r => r.total_score)) : 0;

  const totalByComp = {};
  allResults.filter(r => r.total_score > 0).forEach(r => {
    totalByComp[r.competition_id] = (totalByComp[r.competition_id] || 0) + r.total_score;
  });
  const computedPbTotal = Object.values(totalByComp).length ? Math.max(...Object.values(totalByComp)) : 0;

  const currentSeason = (() => {
    const seasons = [...new Set(allComps.filter(c => c.season).map(c => c.season))].sort();
    return seasons[seasons.length - 1] || null;
  })();
  const currentSeasonCompIds = new Set(allComps.filter(c => c.season === currentSeason).map(c => c.id));
  const isActive = allResults.some(r => currentSeasonCompIds.has(r.competition_id) && r.total_score > 0);

  const spSeason = spResults.filter(r => currentSeasonCompIds.has(r.competition_id));
  const fsSeason = fsResults.filter(r => currentSeasonCompIds.has(r.competition_id));

  const computedSbShort = spSeason.length ? Math.max(...spSeason.map(r => r.total_score)) : 0;
  const computedSbFree  = fsSeason.length ? Math.max(...fsSeason.map(r => r.total_score)) : 0;

  const seasonTotalByComp = {};
  allResults.filter(r => r.total_score > 0 && currentSeasonCompIds.has(r.competition_id)).forEach(r => {
    seasonTotalByComp[r.competition_id] = (seasonTotalByComp[r.competition_id] || 0) + r.total_score;
  });
  const computedSbTotal = Object.values(seasonTotalByComp).length ? Math.max(...Object.values(seasonTotalByComp)) : 0;

  const pbShort = Math.max(skater.personal_best_short || 0, computedPbShort);
  const pbFree  = Math.max(skater.personal_best_free  || 0, computedPbFree);
  const pbTotal = Math.max(skater.personal_best_total || 0, computedPbTotal);
  const sbShort = Math.max(skater.season_best_short   || 0, computedSbShort);
  const sbFree  = Math.max(skater.season_best_free    || 0, computedSbFree);
  const sbTotal = Math.max(skater.season_best_total   || 0, computedSbTotal);

  /* Overall placement per competition: rank by combined SP+FS total across all skaters */
  const overallRankByComp = {};
  [...new Set(allResults.map(r => r.competition_id))].forEach(compId => {
    const combined = {};
    allResultsGlobal.filter(r => r.competition_id === compId && r.total_score > 0).forEach(r => {
      combined[r.skater_id] = (combined[r.skater_id] || 0) + r.total_score;
    });
    const ranked = Object.entries(combined).sort((a, b) => b[1] - a[1]);
    const pos = ranked.findIndex(([sid]) => sid === id);
    overallRankByComp[compId] = pos >= 0 ? pos + 1 : null;
  });

  const resultsByComp = {};
  allResults.forEach(r => {
    if (!resultsByComp[r.competition_id]) resultsByComp[r.competition_id] = [];
    resultsByComp[r.competition_id].push(r);
  });

  /* Score progression data (chronological) */
  const progressionData = [...allComps]
    .reverse()
    .map(c => {
      const cr = resultsByComp[c.id];
      if (!cr) return null;
      const sp  = cr.find(r => r.segment === 'Short Program');
      const fs  = cr.find(r => r.segment === 'Free Skate');
      const tot = cr.reduce((s, r) => s + r.total_score, 0);
      const hasNonFinish = cr.some(r => r.placement === 'DSQ' || r.placement === 'WD');
      return {
        label: c.name.split(' ').slice(0,2).join(' '),
        sp:    sp?.total_score ?? (hasNonFinish ? 0 : undefined),
        fs:    fs?.total_score ?? (hasNonFinish ? 0 : undefined),
        total: tot,
      };
    })
    .filter(Boolean);

  const chartSeries = [];
  if (progressionData.some(d => d.total > 0)) {
    chartSeries.push({ label: 'Total', color: '#1C1C1A', data: progressionData.filter(d=>d.total>0).map(d=>({x:d.label,y:d.total})) });
  }
  if (progressionData.some(d => d.sp != null)) {
    chartSeries.push({ label: 'Short Program', color: '#2D4A1E', data: progressionData.filter(d=>d.sp!=null).map(d=>({x:d.label,y:d.sp})) });
  }
  if (progressionData.some(d => d.fs != null)) {
    chartSeries.push({ label: 'Free Skate', color: '#8BAF5A', data: progressionData.filter(d=>d.fs!=null).map(d=>({x:d.label,y:d.fs})) });
  }

  function formatDate(d) {
    if (!d) return '';
    const parts = String(d).split('-');
    const dt = parts.length === 3 ? new Date(+parts[0], +parts[1] - 1, +parts[2]) : new Date(d);
    return isNaN(dt) ? d : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function age(bday) {
    if (!bday) return '';
    const bparts = String(bday).split('-');
    const b = bparts.length === 3 ? new Date(+bparts[0], +bparts[1] - 1, +bparts[2]) : new Date(bday);
    if (isNaN(b)) return '';
    let a = new Date().getFullYear() - b.getFullYear();
    if (new Date() < new Date(new Date().getFullYear(), b.getMonth(), b.getDate())) a--;
    return a;
  }
  function levelClass(l) { return 'level-' + (l||'default').replace(/\s+/g,''); }

  const flag = Nav.getFlagEmoji(skater.country_code);

  app.innerHTML = `
    <div class="page-enter">
      <div class="container">

        <a href="#/" class="btn" style="margin-bottom:var(--space-lg);display:inline-flex">← Back</a>

        <!-- PROFILE HEADER -->
        <div class="profile-header">
          ${skater.photo_url
            ? `<img class="profile-photo" src="${skater.photo_url}" alt="${skater.name}">`
            : `<div class="profile-photo-placeholder" aria-hidden="true">✦</div>`}
          <div>
            <h1 class="profile-name">${skater.name}</h1>
            <p class="profile-country">
              ${flag} ${skater.country||''}${skater.birthday ? ` · Age ${age(skater.birthday)}` : ''}
              <span style="display:inline-block;font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:2px 8px;border-radius:var(--radius-full);background:${isActive ? 'var(--forest)' : 'rgba(28,28,26,.12)'};color:${isActive ? 'var(--white)' : 'var(--text-muted)'};margin-left:var(--space-sm);vertical-align:middle">${isActive ? 'Active' : 'Inactive'}</span>
            </p>
            ${skater.bio ? `<p class="profile-bio">${skater.bio}</p>` : ''}
          </div>
        </div>

        <!-- PERSONAL BESTS -->
        <section style="margin-bottom:var(--space-2xl)">
          <div class="section-header">
            <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} Records</p>
            <h2 class="section-title">Personal Bests</h2>
          </div>
          <div class="pb-grid">
            ${[
              { label:'Short Program PB', val:pbShort },
              { label:'Free Skate PB',    val:pbFree  },
              { label:'Total PB',         val:pbTotal, lg:true },
              { label:'Short Program SB', val:sbShort },
              { label:'Free Skate SB',    val:sbFree  },
              { label:'Total SB',         val:sbTotal },
            ].map(b=>`
              <div class="stat-card">
                <span class="stat-label">${b.label}</span>
                <span class="stat-value${b.lg?' lg':''}">${b.val>0?b.val.toFixed(2):'—'}</span>
              </div>`).join('')}
          </div>
        </section>

        <!-- CAREER STATS -->
        <section style="margin-bottom:var(--space-2xl)">
          <div class="section-header">
            <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} Career</p>
            <h2 class="section-title">Career Statistics</h2>
          </div>
          <div class="grid-4">
            ${[
              { label:'Competitions',     val:stats.totalCompetitions },
              { label:'Podiums',          val:stats.podiums,           sub:stats.podiumRate+'% rate' },
              { label:'Avg Total',        val:stats.avgTotal   ? stats.avgTotal.toFixed(2)   : '—' },
              { label:'Avg Component Mark', val:stats.avgComponent?stats.avgComponent.toFixed(2):'—' },
              { label:'Ultra-C Attempts', val:stats.ultraCAttempts },
              { label:'UC Landing Rate',  val:stats.ultraCLandingRate+'%' },
              { label:'Top Ultra-C',      val:stats.topUCElement, sub:stats.topUCAttempts?stats.topUCAttempts+' attempts':'' },
              { label:'Best GOE Element', val:stats.highestGOEElement, sub:stats.highestGOEValue>0?'+'+stats.highestGOEValue.toFixed(2):'' },
            ].map(s=>`
              <div class="stat-card">
                <span class="stat-label">${s.label}</span>
                <span class="stat-value" style="font-size:1.5rem">${s.val}</span>
                ${s.sub?`<span class="stat-sub">${s.sub}</span>`:''}
              </div>`).join('')}
          </div>
        </section>

        <!-- SCORE PROGRESSION -->
        ${chartSeries.length ? `
        <section style="margin-bottom:var(--space-2xl)">
          <div class="section-header">
            <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} Career</p>
            <h2 class="section-title">Score Progression</h2>
          </div>
          <div class="card">
            <div class="chart-wrap" id="progression-chart"></div>
          </div>
        </section>` : ''}

        <!-- COMPETITION HISTORY -->
        <!-- GALLERY -->
        ${galleryImages.length ? `
        <section style="margin-bottom:var(--space-2xl)">
          <div class="section-header">
            <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} Photos</p>
            <h2 class="section-title">Gallery</h2>
          </div>
          <div class="gallery-carousel" id="skater-gallery">
            <button class="gallery-arrow gallery-arrow-prev" id="gallery-prev" aria-label="Previous">&#8592;</button>
            <div class="gallery-track-wrap">
              <div class="gallery-track" id="gallery-track">
                ${galleryImages.map((url, i) => `
                  <div class="gallery-slide">
                    <img src="${url}" alt="Gallery photo ${i+1}" loading="lazy">
                  </div>`).join('')}
              </div>
            </div>
            <button class="gallery-arrow gallery-arrow-next" id="gallery-next" aria-label="Next">&#8594;</button>
            <div class="gallery-counter" id="gallery-counter">1 / ${galleryImages.length}</div>
          </div>
        </section>` : ''}

        ${Object.keys(resultsByComp).length ? `
        <section style="margin-bottom:var(--space-2xl)">
          <div class="section-header">
            <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} History</p>
            <h2 class="section-title">Competition Results</h2>
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--space-md)">
            ${allComps.filter(c => resultsByComp[c.id]).map(comp => {
              const cr    = resultsByComp[comp.id];
              const sp    = cr.find(r => r.segment==='Short Program');
              const fs    = cr.find(r => r.segment==='Free Skate');
              const entry = cr.some(r => r.segment==='Entry') && !sp && !fs;
              const nonFinish = cr.find(r => r.placement === 'DSQ' || r.placement === 'WD');
              const overallPlacement = overallRankByComp[comp.id] ?? null;
              return `
                <a href="#/competition/${comp.id}" class="comp-card">
                  <div style="display:flex;align-items:center;gap:var(--space-md);flex-wrap:wrap;justify-content:space-between">
                    <div>
                      <p class="comp-card-name" style="font-size:1.25rem">${comp.name}</p>
                      <div class="comp-card-meta">
                        <span class="level-badge ${levelClass(comp.level)}">${comp.level||'Event'}</span>
                        ${comp.location?`<span>${comp.location}</span>`:''}
                        <span>${formatDate(comp.date)}</span>
                        ${nonFinish?`<span class="label" style="color:hsl(0,90%,60%);border-color:hsl(0,90%,60%)">${nonFinish.placement}</span>`:overallPlacement?`<span class="label label-gold">P${overallPlacement}</span>`:''}
                      </div>
                    </div>
                    <div class="score-row" style="gap:var(--space-lg)">
                      ${entry?`<span class="exec-badge exec-default" style="font-size:.7rem;letter-spacing:.12em">Entered</span>`:''}
                      ${sp?`<div class="score-block"><span class="score-label">SP</span><span class="score-value sm">${sp.total_score.toFixed(2)}</span></div>`:''}
                      ${fs?`<div class="score-block"><span class="score-label">FS</span><span class="score-value sm">${fs.total_score.toFixed(2)}</span></div>`:''}
                      ${sp&&fs?`<div class="score-block"><span class="score-label">Total</span><span class="score-value">${(sp.total_score+fs.total_score).toFixed(2)}</span></div>`:''}
                    </div>
                  </div>
                </a>`;
            }).join('')}
          </div>
        </section>` : '<p class="no-data">No competition results yet.</p>'}

      </div>
    </div>`;

  if (chartSeries.length) {
    const chartEl = document.getElementById('progression-chart');
    if (chartEl) Charts.drawLineChart(chartEl, chartSeries);
  }

  if (galleryImages.length) {
    let current = 0;
    const total   = galleryImages.length;
    const maxIdx  = Math.max(0, total - 3);
    const track   = document.getElementById('gallery-track');
    const counter = document.getElementById('gallery-counter');
    const prevBtn = document.getElementById('gallery-prev');
    const nextBtn = document.getElementById('gallery-next');

    function goTo(idx) {
      current = ((idx % (maxIdx + 1)) + (maxIdx + 1)) % (maxIdx + 1);
      track.style.transform = `translateX(calc(-${current} * (33.333% - 8px + 12px)))`;
      counter.textContent = `${current + 1} – ${Math.min(current + 3, total)} / ${total}`;
    }

    goTo(0);
    prevBtn.addEventListener('click', () => goTo(current - 1));
    nextBtn.addEventListener('click', () => goTo(current + 1));
  }
}
