/**
 * Under Review Skating — Protocol Sheet View
 * Element-by-element breakdown for one result.
 */
async function renderProtocol({ result_id }) {
  const app = document.getElementById('app');

  const [result, elements] = await Promise.all([
    SheetsDB.getResult(result_id),
    SheetsDB.getElements(result_id),
  ]);

  if (!result) {
    app.innerHTML = `
      <div class="error-state">
        <div class="error-icon">✦</div>
        <h2 class="error-title">Protocol not found</h2>
        <p class="error-msg">No result with id <code>${result_id}</code>.</p>
        <a href="#/" class="btn">Go home</a>
      </div>`;
    return;
  }

  const [skater, competition] = await Promise.all([
    SheetsDB.getSkater(result.skater_id),
    SheetsDB.getCompetition(result.competition_id),
  ]);

  /* Landing rates for all Ultra-C elements in this protocol */
  const ucCodes    = [...new Set(elements.filter(e => e.is_ultra_c).map(e => e.element_code))];
  const landingRates = {};
  await Promise.all(ucCodes.map(async code => {
    landingRates[code] = await SheetsDB.getElementLandingRate(result.skater_id, code, competition?.season);
  }));

  /* Summary scores */
  const calcTES = elements.reduce((s, e) => s + e.panel_score, 0);
  const tes = result.technical_score || calcTES;
  const pcs = result.component_score || 0;
  const ded = result.deductions       || 0;
  const tot = result.total_score      || (tes + pcs - ded);

  function placeClass(p) { if(p===1)return 'gold'; if(p===2)return 'silver'; if(p===3)return 'bronze'; return ''; }
  function ordinal(n) { const s=['th','st','nd','rd']; const v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); }

  const flag = Nav.getFlagEmoji(skater?.country_code);

  app.innerHTML = `
    <div class="page-enter">
      <div class="container-narrow">

        <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-lg);flex-wrap:wrap">
          ${competition?`<a href="#/competition/${competition.id}" class="btn">← ${competition.name}</a>`:''}
          ${skater?`<a href="#/skater/${skater.id}" class="btn">← ${skater.name}</a>`:''}
        </div>

        <!-- TITLE -->
        <div style="margin-bottom:var(--space-lg)">
          <p style="font-size:.72rem;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px">
            ${Sparkles.html('sparkle-sm')} Protocol Sheet
          </p>
          ${skater?`<h1 class="profile-name" style="font-size:clamp(1.8rem,5vw,3rem)">${flag} ${skater.name}</h1>`:''}
          <p style="color:var(--text-secondary);margin-top:6px;font-size:.9rem">
            ${result.segment||''}${competition?' · '+competition.name:''}${result.placement?' · '+ordinal(result.placement)+' place':''}
          </p>
        </div>

        <!-- SUMMARY BAR -->
        <div class="protocol-summary">
          <div class="score-block">
            <span class="score-label">Technical Score</span>
            <span class="score-value">${tes.toFixed(2)}</span>
          </div>
          <div class="score-block">
            <span class="score-label">Component Score</span>
            <span class="score-value">${pcs.toFixed(2)}</span>
          </div>
          ${ded>0?`
          <div class="score-block">
            <span class="score-label">Deductions</span>
            <span class="score-value" style="color:hsl(0,80%,70%)">-${ded.toFixed(2)}</span>
          </div>`:''}
          <div class="score-block">
            <span class="score-label">Segment Total</span>
            <span class="score-value lg">${tot.toFixed(2)}</span>
          </div>
          ${result.placement?`
          <div class="score-block">
            <span class="score-label">Placement</span>
            <span class="score-value lg ${placeClass(result.placement)}">${result.placement}</span>
          </div>`:''}
        </div>

        ${elements.some(e=>e.is_second_half)?`
          <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:var(--space-md);font-size:.8rem;color:var(--text-secondary)">
            <span class="second-half-tag">Bonus</span>
            <span>Elements in the second half earn a 10% base value bonus</span>
          </div>`:''}

        <!-- ELEMENT CARDS -->
        ${elements.length ? `
        <div class="protocol-list">
          ${elements.map(elem => renderElemCard(elem, landingRates)).join('')}
        </div>` : '<p class="no-data">No element data recorded for this result.</p>'}

        <!-- GOE CHART -->
        ${elements.length ? `
        <section style="margin-top:var(--space-2xl)">
          <div class="section-header">
            <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} Summary</p>
            <h2 class="section-title">Grade of Execution</h2>
          </div>
          <div class="card">
            <div class="chart-wrap" id="goe-chart"></div>
          </div>
        </section>` : ''}

      </div>
    </div>`;

  if (elements.length) {
    const chartEl = document.getElementById('goe-chart');
    if (chartEl) {
      Charts.drawBarChart(chartEl,
        elements.map(e => ({
          label:    e.element_code,
          value:    e.goe,
          decimals: 2,
          color:    e.goe >= 0 ? 'rgba(80,255,150,0.78)' : 'rgba(255,80,80,0.78)',
        })),
        { labelWidth: 90, maxValue: 5 }
      );
    }
  }
}

function renderElemCard(elem, landingRates) {
  const isUC  = elem.is_ultra_c;
  const isSH  = elem.is_second_half;
  const goe   = elem.goe;
  const rates = isUC ? landingRates[elem.element_code] : null;

  const execLabels = (elem.execution || '').split(',').map(s => s.trim()).filter(Boolean)
    .map(label => label === 'Landed' ? 'Clean' : label);
  const goeSign  = goe > 0 ? '+' : '';
  const goeClass = goe > 0 ? 'goe-pos' : goe < 0 ? 'goe-neg' : 'goe-zero';
  const pve      = elem.planned_vs_executed;
  const showPVE  = pve && pve !== 'Planned' && pve !== '';

  const careerRate = rates ? Math.round(rates.career.landed / (rates.career.total || 1) * 100) : 0;
  const seasonRate = rates ? Math.round(rates.season.landed / (rates.season.total || 1) * 100) : 0;

  const classes = [
    'element-card',
    isSH ? 'second-half' : '',
    isUC ? 'ultra-c-element ultra-c-glow' : '',
  ].filter(Boolean).join(' ');

  return `
    <div class="${classes}">
      <div class="elem-num">${elem.order_number}</div>

      <div class="elem-body">
        <div style="display:flex;align-items:baseline;gap:var(--space-sm);flex-wrap:wrap">
          <span class="elem-code">${elem.element_code}</span>
          ${isUC ? `<span class="ultra-c-badge"><span class="ultra-c-text">Ultra-C</span></span>` : ''}
          ${isSH ? `<span class="second-half-tag">Bonus</span>` : ''}
        </div>

        ${elem.element_name ? `<p class="elem-name">${elem.element_name}</p>` : ''}

        <div class="elem-tags">
          ${execLabels.map(label => {
            const key = label.replace(/\s+/g, '');
            const known = ['Clean','Fall','StepOut','Downgraded','UnclearEdge','IncorrectEdge','RotationalFall','Quarter','Underrotated','Invalid','MissedRequirement'];
            const cls = known.includes(key) ? `exec-${key}` : 'exec-default';
            return `<span class="exec-badge ${cls}">${label}</span>`;
          }).join('')}
          ${showPVE ? `<span class="pve-badge ${pve==='Downgraded'?'pve-downgraded':pve==='Fall'?'pve-fall':'pve-executed'}">${pve==='Downgraded'?'▼ Downgraded':pve==='Fall'?'✕ Fall':'✓ Executed'}</span>` : ''}
        </div>

        ${isUC && rates ? `
          <div style="display:flex;gap:var(--space-lg);margin-top:6px;flex-wrap:wrap">
            <div class="uc-landing">
              <span class="uc-landing-label">Career ${elem.element_code}</span>
              <span style="font-weight:600">${careerRate}%</span>
              <span style="color:var(--text-muted);font-size:.7rem">(${rates.career.landed}/${rates.career.total})</span>
              <div class="landing-bar"><div class="landing-fill" style="width:${careerRate}%"></div></div>
            </div>
            ${rates.season.total > 0 ? `
            <div class="uc-landing">
              <span class="uc-landing-label">This season</span>
              <span style="font-weight:600">${seasonRate}%</span>
              <span style="color:var(--text-muted);font-size:.7rem">(${rates.season.landed}/${rates.season.total})</span>
              <div class="landing-bar"><div class="landing-fill" style="width:${seasonRate}%"></div></div>
            </div>` : ''}
          </div>` : ''}
      </div>

      <div class="elem-scores">
        <span class="elem-base">BV ${elem.base_value.toFixed(2)}</span>
        <span class="elem-goe ${goeClass}">${goeSign}${goe.toFixed(2)}</span>
        <span class="elem-panel">${elem.panel_score.toFixed(2)}</span>
      </div>
    </div>`;
}
