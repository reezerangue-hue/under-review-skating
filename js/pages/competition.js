/**
 * Under Review Skating — Competition / Event page
 */
async function renderCompetition({ id }) {
  const app = document.getElementById('app');

  const [comp, results, skaters] = await Promise.all([
    SheetsDB.getCompetition(id),
    SheetsDB.getResults(id),
    SheetsDB.getSkaters(),
  ]);

  if (!comp) {
    app.innerHTML = `
      <div class="error-state">
        <div class="error-icon">✦</div>
        <h2 class="error-title">Competition not found</h2>
        <p class="error-msg">No event with id <code>${id}</code>.</p>
        <a href="#/" class="btn">Go home</a>
      </div>`;
    return;
  }

  const skaterMap = Object.fromEntries(skaters.map(s => [s.id, s]));

  const spResults = results.filter(r => r.segment==='Short Program').sort((a,b)=>(a.placement||99)-(b.placement||99));
  const fsResults = results.filter(r => r.segment==='Free Skate').sort((a,b)=>(a.placement||99)-(b.placement||99));

  /* Fetch all elements for this competition */
  const allElements = (await Promise.all(results.map(r => SheetsDB.getElements(r.id)))).flat();

  /* Best moments */
  const maxGOEEl = allElements.reduce((best, e) => e.goe > (best?.goe ?? -99) ? e : best, null);

  const ucBySkater = {};
  allElements.filter(e => e.is_ultra_c).forEach(e => { ucBySkater[e.skater_id] = (ucBySkater[e.skater_id]||0) + 1; });
  const topUCEntry  = Object.entries(ucBySkater).sort((a,b)=>b[1]-a[1])[0];
  const topUCSkater = topUCEntry ? skaterMap[topUCEntry[0]] : null;

  const landingBySkater = {};
  allElements.forEach(e => {
    if (!landingBySkater[e.skater_id]) landingBySkater[e.skater_id] = {total:0,landed:0};
    landingBySkater[e.skater_id].total++;
    if (e.execution==='Landed') landingBySkater[e.skater_id].landed++;
  });
  const consistEntry = Object.entries(landingBySkater).filter(([,v])=>v.total>=2).sort((a,b)=>(b[1].landed/b[1].total)-(a[1].landed/a[1].total))[0];
  const consistSkater = consistEntry ? skaterMap[consistEntry[0]] : null;
  const consistRate   = consistEntry ? Math.round(consistEntry[1].landed/consistEntry[1].total*100) : 0;

  function formatDate(d) {
    if (!d) return '';
    const dt = new Date(d); return isNaN(dt) ? d : dt.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  }
  function levelClass(l) { return 'level-' + (l||'default').replace(/\s+/g,''); }
  function placeClass(p) { if(p===1)return 'gold'; if(p===2)return 'silver'; if(p===3)return 'bronze'; return ''; }

  function resultTable(segResults, label) {
    if (!segResults.length) return `<p class="no-data">No ${label} results recorded.</p>`;
    return `
      <div class="table-wrap">
        <table class="data-table" aria-label="${label} results">
          <thead><tr>
            <th style="width:3rem">#</th>
            <th>Skater</th>
            <th style="text-align:right">TES</th>
            <th style="text-align:right">PCS</th>
            <th style="text-align:right">Ded</th>
            <th style="text-align:right">Score</th>
            <th></th>
          </tr></thead>
          <tbody>
            ${segResults.map(r => {
              const sk = skaterMap[r.skater_id];
              const pc = placeClass(r.placement);
              return `<tr onclick="Router.go('/protocol/${r.id}')" title="View protocol">
                <td class="place-cell ${pc}">${r.placement||'—'}</td>
                <td>
                  <a href="#/skater/${r.skater_id}" onclick="event.stopPropagation()" style="font-weight:500">${sk?sk.name:'Unknown'}</a>
                  ${sk?`<span style="margin-left:6px;font-size:.8rem">${Nav.getFlagEmoji(sk.country_code)}</span>`:''}
                </td>
                <td class="score-cell">${r.technical_score?r.technical_score.toFixed(2):'—'}</td>
                <td class="score-cell">${r.component_score?r.component_score.toFixed(2):'—'}</td>
                <td class="score-cell" style="color:hsl(0,80%,70%)">${r.deductions?'-'+r.deductions.toFixed(2):'0.00'}</td>
                <td class="score-cell total">${r.total_score?r.total_score.toFixed(2):'—'}</td>
                <td style="text-align:right">
                  <a href="#/protocol/${r.id}" onclick="event.stopPropagation()" class="btn" style="padding:3px 10px;font-size:.72rem">Sheet →</a>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  /* Combined SP+FS total per skater for the score distribution chart */
  const combinedTotals = {};
  spResults.filter(r => r.total_score > 0).forEach(r => {
    if (!combinedTotals[r.skater_id]) combinedTotals[r.skater_id] = { sp: null, fs: null };
    combinedTotals[r.skater_id].sp = r.total_score;
  });
  fsResults.filter(r => r.total_score > 0).forEach(r => {
    if (!combinedTotals[r.skater_id]) combinedTotals[r.skater_id] = { sp: null, fs: null };
    combinedTotals[r.skater_id].fs = r.total_score;
  });
  const distData = Object.entries(combinedTotals)
    .map(([sid, { sp, fs }]) => {
      const sk = skaterMap[sid];
      return {
        skater_name: sk?.name || 'Unknown',
        photo_url:   sk?.photo_url || null,
        sp_score:    sp,
        fs_score:    fs,
        total_score: (sp || 0) + (fs || 0),
      };
    })
    .filter(d => d.total_score > 0)
    .sort((a, b) => b.total_score - a.total_score);

  app.innerHTML = `
    <div class="page-enter">
      <div class="container">

        <a href="#/" class="btn" style="margin-bottom:var(--space-lg);display:inline-flex">← Back</a>

        <!-- EVENT HEADER -->
        <section style="margin-bottom:var(--space-2xl)">
          <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-sm);flex-wrap:wrap">
            <span class="level-badge ${levelClass(comp.level)}">${comp.level||'Event'}</span>
            ${comp.season?`<span class="label">Season ${comp.season}</span>`:''}
          </div>
          <h1 class="profile-name">${comp.name}</h1>
          <p style="color:var(--text-secondary);margin-top:6px;font-size:.95rem">
            ${comp.location||''}${comp.location&&comp.date?' · ':''}${formatDate(comp.date)}
          </p>
        </section>

        <!-- BEST MOMENTS -->
        ${maxGOEEl||topUCSkater||consistSkater ? `
        <section style="margin-bottom:var(--space-2xl)">
          <div class="section-header">
            <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} Highlights</p>
            <h2 class="section-title">Best Moments</h2>
          </div>
          <div class="moments-grid">
            ${maxGOEEl?`
              <div class="moment-card">
                <p class="moment-label">Highest GOE</p>
                <p class="moment-value">${maxGOEEl.element_code}</p>
                <p class="moment-sub">+${maxGOEEl.goe.toFixed(2)} GOE</p>
                <p class="moment-sub">${skaterMap[maxGOEEl.skater_id]?.name||''}</p>
              </div>`:''}
            ${topUCSkater?`
              <div class="moment-card">
                <p class="moment-label">Most Ultra-C Attempts</p>
                <p class="moment-value">${topUCSkater.name}</p>
                <p class="moment-sub">${topUCEntry[1]} Ultra-C element${topUCEntry[1]!==1?'s':''}</p>
              </div>`:''}
            ${consistSkater?`
              <div class="moment-card">
                <p class="moment-label">Most Consistent</p>
                <p class="moment-value">${consistSkater.name}</p>
                <p class="moment-sub">${consistRate}% landing rate</p>
              </div>`:''}
            <div class="moment-card">
              <p class="moment-label">Total Skaters</p>
              <p class="moment-value">${new Set(results.map(r=>r.skater_id)).size}</p>
              <p class="moment-sub">competing</p>
            </div>
          </div>
        </section>` : ''}

        <!-- SCORE DISTRIBUTION -->
        ${distData.length >= 3 ? `
        <section style="margin-bottom:var(--space-2xl)">
          <div class="section-header">
            <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} Distribution</p>
            <h2 class="section-title">Score Distribution</h2>
          </div>
          <div class="card"><div class="chart-wrap" id="dist-chart"></div></div>
        </section>` : ''}

        <!-- SHORT PROGRAM -->
        <section style="margin-bottom:var(--space-2xl)">
          <div class="section-header">
            <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} Segment</p>
            <h2 class="section-title">Short Program</h2>
          </div>
          ${resultTable(spResults,'Short Program')}
        </section>

        <!-- FREE SKATE -->
        <section style="margin-bottom:var(--space-2xl)">
          <div class="section-header">
            <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} Segment</p>
            <h2 class="section-title">Free Skate</h2>
          </div>
          ${resultTable(fsResults,'Free Skate')}
        </section>

      </div>
    </div>

    <!-- DOT POPUP -->
    <div id="dot-popup-backdrop" class="dot-popup-backdrop" style="display:none"></div>
    <div id="dot-popup-card" class="dot-popup-card" style="display:none">
      <button id="dot-popup-close" class="dot-popup-close" aria-label="Close">✕</button>
      <div id="dot-popup-img-wrap"></div>
      <p id="dot-popup-name" class="dot-popup-name"></p>
      <div class="dot-popup-scores">
        <div class="dot-popup-score-block">
          <span class="dot-popup-score-label">SP</span>
          <span id="dot-popup-sp" class="dot-popup-score-value"></span>
        </div>
        <div class="dot-popup-score-block">
          <span class="dot-popup-score-label">FS</span>
          <span id="dot-popup-fs" class="dot-popup-score-value"></span>
        </div>
        <div class="dot-popup-score-block">
          <span class="dot-popup-score-label">Total</span>
          <span id="dot-popup-total" class="dot-popup-score-value"></span>
        </div>
      </div>
    </div>`;

  if (distData.length >= 3) {
    const chartEl = document.getElementById('dist-chart');
    if (chartEl) {
      Charts.drawDotChart(chartEl, distData, {
        onDotClick(r) {
          document.getElementById('dot-popup-backdrop').style.display = 'block';
          document.getElementById('dot-popup-card').style.display     = 'flex';
          document.getElementById('dot-popup-img-wrap').innerHTML = r.photo_url
            ? `<img class="dot-popup-photo" src="${r.photo_url}" alt="${r.skater_name}">`
            : `<div class="dot-popup-placeholder">✦</div>`;
          document.getElementById('dot-popup-name').textContent = r.skater_name;
          document.getElementById('dot-popup-sp').textContent   = r.sp_score ? r.sp_score.toFixed(2) : '—';
          document.getElementById('dot-popup-fs').textContent   = r.fs_score ? r.fs_score.toFixed(2) : '—';
          document.getElementById('dot-popup-total').textContent = r.total_score.toFixed(2);
        }
      });
    }
  }

  function closePopup() {
    document.getElementById('dot-popup-backdrop').style.display = 'none';
    document.getElementById('dot-popup-card').style.display     = 'none';
  }
  document.getElementById('dot-popup-backdrop').addEventListener('click', closePopup);
  document.getElementById('dot-popup-close').addEventListener('click', e => { e.stopPropagation(); closePopup(); });
}
