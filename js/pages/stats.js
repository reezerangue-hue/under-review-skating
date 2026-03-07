/**
 * Under Review Skating — Statistics page
 */
async function renderStats() {
  const app = document.getElementById('app');

  const { skaters, competitions, results, elements } = await SheetsDB.getAllData();

  const skaterMap = Object.fromEntries(skaters.map(s => [s.id, s]));
  const compMap   = Object.fromEntries(competitions.map(c => [c.id, c]));

  /* Top combined scores per competition */
  const comboMap = {};
  results.forEach(r => {
    const key = `${r.skater_id}_${r.competition_id}`;
    if (!comboMap[key]) comboMap[key] = { skater_id:r.skater_id, comp_id:r.competition_id, total:0 };
    comboMap[key].total += r.total_score;
  });

  /* Nation medal counts */
  const byComp = {};
  Object.values(comboMap).forEach(e => {
    if (!byComp[e.comp_id]) byComp[e.comp_id] = [];
    byComp[e.comp_id].push(e);
  });
  const nationMedals = {};
  Object.values(byComp).forEach(entries => {
    entries
      .filter(e => e.total > 0 && skaterMap[e.skater_id])
      .sort((a, b) => b.total - a.total)
      .slice(0, 3)
      .forEach((e, idx) => {
        const sk = skaterMap[e.skater_id];
        if (!sk || !sk.country_code) return;
        const cc = sk.country_code.toUpperCase();
        if (!nationMedals[cc]) nationMedals[cc] = { gold:0, silver:0, bronze:0, cc, flag:Nav.getFlagEmoji(cc), country:sk.country||cc };
        if (idx === 0) nationMedals[cc].gold++;
        if (idx === 1) nationMedals[cc].silver++;
        if (idx === 2) nationMedals[cc].bronze++;
      });
  });
  const nationLeaderboard = Object.values(nationMedals)
    .sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze)
    .slice(0, 10);

  const topTotals = Object.values(comboMap)
    .filter(e => skaterMap[e.skater_id])
    .sort((a,b) => b.total - a.total)
    .slice(0,10)
    .map(e => ({ ...e, skater:skaterMap[e.skater_id], comp:compMap[e.comp_id] }));

  /* UC landing rates (min 3 attempts) */
  const ucBySk = {};
  elements.filter(e => e.is_ultra_c).forEach(e => {
    if (!ucBySk[e.skater_id]) ucBySk[e.skater_id] = {total:0,landed:0};
    ucBySk[e.skater_id].total++;
    if (e.execution==='Landed') ucBySk[e.skater_id].landed++;
  });
  const ucLeaderboard = Object.entries(ucBySk)
    .filter(([,v])=>v.total>=3)
    .map(([sid,v])=>({ skater:skaterMap[sid], ...v, rate:v.total?v.landed/v.total:0 }))
    .filter(e=>e.skater)
    .sort((a,b)=>b.rate-a.rate)
    .slice(0,10);

  /* PCS leaders */
  const pcsBySk = {};
  results.filter(r=>r.component_score>0).forEach(r=>{
    if (!pcsBySk[r.skater_id]) pcsBySk[r.skater_id]={sum:0,count:0};
    pcsBySk[r.skater_id].sum+=r.component_score; pcsBySk[r.skater_id].count++;
  });
  const pcsLeaderboard = Object.entries(pcsBySk)
    .map(([sid,v])=>({ skater:skaterMap[sid], avg:v.sum/v.count, count:v.count }))
    .filter(e=>e.skater)
    .sort((a,b)=>b.avg-a.avg)
    .slice(0,10);

  /* Helper: extract individual UC jump codes from a (possibly combined) element code.
     Single elements return their base code; combinations split on '+' and keep only
     the parts that are individually UC (quads or 3A). Modifiers like <, !, e are stripped.
     e.g. '4Lz+3T' → ['4Lz'],  '4Lz+4T' → ['4Lz','4T'],  '4Lz' → ['4Lz'] */
  function extractUCJumps(elementCode) {
    const parts = elementCode.split('+');
    if (parts.length === 1) {
      const m = elementCode.match(/^(\d+[A-Za-z]+)/);
      return m ? [m[1]] : [elementCode];
    }
    return parts
      .map(part => { const m = part.match(/^(\d+[A-Za-z]+)/); return m ? m[1] : null; })
      .filter(j => j && (/^4/.test(j) || j === '3A'));
  }

  /* Ultra-C frequency — bucket by base jump type, not raw combination code */
  const ucFreq = {};
  elements.filter(e=>e.is_ultra_c).forEach(e=>{
    extractUCJumps(e.element_code).forEach(jump => {
      ucFreq[jump] = (ucFreq[jump] || 0) + 1;
    });
  });
  const ucFreqList = Object.entries(ucFreq).sort((a,b)=>b[1]-a[1]).slice(0,15)
    .map(([code,count])=>({ label:code, value:count, decimals:0 }));

  /* Landing rate by element — one bucket per base UC jump type */
  const ucByElem = {};
  elements.filter(e => e.is_ultra_c).forEach(e => {
    extractUCJumps(e.element_code).forEach(jump => {
      if (!ucByElem[jump]) ucByElem[jump] = { name: '', skaters: {} };
      if (!ucByElem[jump].skaters[e.skater_id])
        ucByElem[jump].skaters[e.skater_id] = { total: 0, landed: 0 };
      ucByElem[jump].skaters[e.skater_id].total++;
      if (e.execution === 'Landed') ucByElem[jump].skaters[e.skater_id].landed++;
    });
  });

  const elementBreakdown = Object.entries(ucByElem)
    .map(([code, { name, skaters }]) => {
      const totalAttempts = Object.values(skaters).reduce((s, v) => s + v.total, 0);
      const skaterList = Object.entries(skaters)
        .filter(([, v]) => v.total >= 2)
        .map(([sid, v]) => ({
          skater: skaterMap[sid],
          total:  v.total,
          landed: v.landed,
          rate:   v.total ? v.landed / v.total : 0,
        }))
        .filter(e => e.skater)
        .sort((a, b) => b.rate - a.rate || b.total - a.total)
        .slice(0, 5);
      return { code, name, skaterList, totalAttempts };
    })
    .filter(e => e.skaterList.length > 0)
    .sort((a, b) => b.totalAttempts - a.totalAttempts);

  /* Compute actual PB per skater from results (max combined per competition),
     same pattern as rankings/skater pages so the denominator is consistent */
  const pbFromResults = {};
  Object.values(comboMap).forEach(({ skater_id, total }) => {
    if (total > 0 && (!pbFromResults[skater_id] || total > pbFromResults[skater_id]))
      pbFromResults[skater_id] = total;
  });

  /* Clutch ratings */
  const clutch = skaters
    .map(s => {
      const pb = Math.max(s.personal_best_total || 0, pbFromResults[s.id] || 0);
      if (!pb) return null;
      const sRes = results.filter(r=>r.skater_id===s.id&&r.total_score>0);
      if (!sRes.length) return null;
      const combos = {};
      sRes.forEach(r=>{ if(!combos[r.competition_id])combos[r.competition_id]=0; combos[r.competition_id]+=r.total_score; });
      const vals = Object.values(combos).filter(v=>v>0);
      if (vals.length < 2) return null;
      const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
      return { skater:s, avg, pb, ratio:avg/pb };
    })
    .filter(Boolean)
    .sort((a,b)=>b.ratio-a.ratio)
    .slice(0,10);

  function pct(r) { return (r*100).toFixed(1)+'%'; }
  function pc(i)  { if(i===0)return 'r1'; if(i===1)return 'r2'; if(i===2)return 'r3'; return ''; }
  function shortName(name) {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return name;
    return parts[0][0].toUpperCase() + '. ' + parts.slice(1).join(' ');
  }

  function lbRow(i, name, flag, sub, score) {
    return `<div class="lb-row">
      <span class="lb-rank ${pc(i)}">${i+1}</span>
      <div class="lb-name">${name}</div>
      ${flag?`<span class="lb-country">${flag}</span>`:''}
      ${sub ?`<span class="lb-country">${sub}</span>`:''}
      <span class="lb-score">${score}</span>
    </div>`;
  }

  app.innerHTML = `
    <div class="page-enter">
      <div class="container">

        <section style="padding:var(--space-2xl) 0 var(--space-xl);text-align:center;position:relative">
          <div class="sparkle-field" id="stats-sf"></div>
          <p style="font-size:.72rem;font-weight:700;letter-spacing:.28em;text-transform:uppercase;color:var(--text-muted);margin-bottom:var(--space-sm)">
            ${Sparkles.html('sparkle-sm')} Global ${Sparkles.html('sparkle-sm')}
          </p>
          <h1 class="hero-title" style="font-size:clamp(2.5rem,10vw,6rem)">Statistics</h1>
        </section>

        <div class="grid-2" style="margin-bottom:var(--space-2xl)">

          <!-- TOP COMBINED SCORES -->
          <section>
            <div class="section-header">
              <div>
                <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} All Time</p>
                <h2 class="section-title">Top Combined Scores</h2>
              </div>
            </div>
            <div class="card" style="padding:var(--space-md)">
              ${topTotals.length ? topTotals.map((e,i)=>lbRow(
                i,
                `<a href="#/skater/${e.skater_id}" style="font-weight:500">${e.skater.name}</a>`,
                Nav.getFlagEmoji(e.skater.country_code),
                e.comp?`<span style="font-size:.76rem;opacity:.6">${e.comp.name}</span>`:'',
                e.total.toFixed(2)
              )).join('') : '<p class="no-data">No results yet.</p>'}
            </div>
          </section>

          <!-- PCS LEADERS -->
          <section>
            <div class="section-header">
              <div>
                <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} Component</p>
                <h2 class="section-title">PCS Leaders</h2>
              </div>
            </div>
            <div class="card" style="padding:var(--space-md)">
              ${pcsLeaderboard.length ? pcsLeaderboard.map((e,i)=>lbRow(
                i,
                `<a href="#/skater/${e.skater.id}" style="font-weight:500">${e.skater.name}</a>`,
                Nav.getFlagEmoji(e.skater.country_code),
                `<span style="font-size:.76rem;opacity:.6">${e.count} seg${e.count!==1?'s':''}</span>`,
                e.avg.toFixed(2)
              )).join('') : '<p class="no-data">No data yet.</p>'}
            </div>
          </section>

        </div>

        <!-- NATION LEADERBOARD -->
        ${nationLeaderboard.length ? `
        <section style="margin-bottom:var(--space-2xl)">
          <div class="section-header">
            <div>
              <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} Nations</p>
              <h2 class="section-title">Nation Leaderboard</h2>
            </div>
          </div>
          <div class="card" style="padding:var(--space-md);overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:.9rem">
              <thead>
                <tr style="border-bottom:1px solid var(--border);text-align:left">
                  <th style="padding:var(--space-sm) var(--space-md);font-weight:700;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted)">#</th>
                  <th style="padding:var(--space-sm) var(--space-md);font-weight:700;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted)">Nation</th>
                  <th style="padding:var(--space-sm) var(--space-md);text-align:center;font-size:1.2rem">🥇</th>
                  <th style="padding:var(--space-sm) var(--space-md);text-align:center;font-size:1.2rem">🥈</th>
                  <th style="padding:var(--space-sm) var(--space-md);text-align:center;font-size:1.2rem">🥉</th>
                </tr>
              </thead>
              <tbody>
                ${nationLeaderboard.map((n, i) => `
                <tr style="border-bottom:1px solid var(--border);cursor:pointer" data-nation="${n.country}" onclick="sessionStorage.setItem('skaters_filters',JSON.stringify({q:'',nation:this.dataset.nation,status:''}));Router.go('/skaters')">
                  <td style="padding:var(--space-sm) var(--space-md);color:var(--text-muted)">${i + 1}</td>
                  <td style="padding:var(--space-sm) var(--space-md)">
                    <span style="font-size:1.4rem;vertical-align:middle;margin-right:6px">${n.flag}</span><span style="font-size:.78rem;font-weight:700;letter-spacing:.1em;vertical-align:middle;opacity:.7">${n.cc}</span>
                  </td>
                  <td style="padding:var(--space-sm) var(--space-md);text-align:center;font-weight:700">${n.gold   || '—'}</td>
                  <td style="padding:var(--space-sm) var(--space-md);text-align:center;font-weight:700">${n.silver || '—'}</td>
                  <td style="padding:var(--space-sm) var(--space-md);text-align:center;font-weight:700">${n.bronze || '—'}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </section>` : ''}

        <!-- UC LANDING RATES -->
        ${ucLeaderboard.length ? `
        <section style="margin-bottom:var(--space-2xl)">
          <div class="section-header">
            <div>
              <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} Ultra-C</p>
              <h2 class="section-title">Ultra-C Landing Leaders</h2>
            </div>
          </div>
          <p style="color:var(--text-secondary);font-size:.82rem;margin-bottom:var(--space-md)">Ranked by landing rate · Minimum 3 attempts</p>
          <div class="card" style="padding:var(--space-md)">
            ${ucLeaderboard.map((e,i)=>`
              <div class="lb-row">
                <span class="lb-rank ${pc(i)}">${i+1}</span>
                <div class="lb-name"><a href="#/skater/${e.skater.id}" style="font-weight:500">${e.skater.name}</a></div>
                <span class="lb-country">${Nav.getFlagEmoji(e.skater.country_code)}</span>
                <div style="flex:1;max-width:180px">
                  <div class="landing-bar" style="height:7px"><div class="landing-fill" style="width:${Math.round(e.rate*100)}%"></div></div>
                </div>
                <span class="lb-score" style="font-size:1rem">${pct(e.rate)}</span>
                <span class="lb-country">${e.landed}/${e.total}</span>
              </div>`).join('')}
          </div>
        </section>` : ''}

        <!-- LANDING RATE BY ELEMENT -->
        ${elementBreakdown.length ? `
        <section style="margin-bottom:var(--space-2xl)">
          <div class="section-header">
            <div>
              <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} By Jump</p>
              <h2 class="section-title">Landing Rate by Element</h2>
            </div>
          </div>
          <p style="color:var(--text-secondary);font-size:.82rem;margin-bottom:var(--space-lg)">
            Who lands each Ultra-C jump most consistently · Minimum 2 attempts per skater
          </p>
          <div class="grid-2">
            ${elementBreakdown.map(elem => `
              <div class="card" style="padding:var(--space-lg)">
                <div style="display:flex;align-items:baseline;gap:var(--space-md);margin-bottom:var(--space-md);flex-wrap:wrap">
                  <span style="font-family:var(--font-display);font-style:italic;font-size:2.4rem;font-weight:600;line-height:1">${elem.code}</span>
                  ${elem.name ? `<span style="font-size:.8rem;color:var(--text-secondary)">${elem.name}</span>` : ''}
                  <span style="margin-left:auto;font-size:.68rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted)">${elem.totalAttempts} attempt${elem.totalAttempts !== 1 ? 's' : ''}</span>
                </div>
                ${elem.skaterList.map((e, i) => `
                  <div class="lb-row" style="padding:5px var(--space-sm);gap:var(--space-sm);flex-wrap:nowrap">
                    <span class="lb-rank ${pc(i)}" style="font-size:.82rem;flex-shrink:0">${i + 1}</span>
                    <div style="flex:1;min-width:0;font-size:.82rem;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">
                      <a href="#/skater/${e.skater.id}" style="font-weight:500">${shortName(e.skater.name)}</a>
                    </div>
                    <span style="font-size:.7rem;color:var(--text-muted);flex-shrink:0;white-space:nowrap">${e.landed}/${e.total}</span>
                    <div style="width:50px;flex-shrink:0">
                      <div class="landing-bar" style="height:5px">
                        <div class="landing-fill" style="width:${Math.round(e.rate * 100)}%"></div>
                      </div>
                    </div>
                  </div>`).join('')}
              </div>`).join('')}
          </div>
        </section>` : ''}

        <!-- UC FREQUENCY MAP -->
        ${ucFreqList.length ? `
        <section style="margin-bottom:var(--space-2xl)">
          <div class="section-header">
            <div>
              <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} Frequency</p>
              <h2 class="section-title">Ultra-C Element Map</h2>
            </div>
          </div>
          <p style="color:var(--text-secondary);font-size:.82rem;margin-bottom:var(--space-md)">How often each Ultra-C element is attempted across all competitors</p>
          <div class="card"><div class="chart-wrap" id="uc-chart"></div></div>
        </section>` : ''}

        <!-- CLUTCH RATINGS -->
        ${clutch.length ? `
        <section style="margin-bottom:var(--space-2xl)">
          <div class="section-header">
            <div>
              <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} Ceiling</p>
              <h2 class="section-title">Clutch Ratings</h2>
            </div>
          </div>
          <p style="color:var(--text-secondary);font-size:.82rem;margin-bottom:var(--space-md)">
            Average combined score ÷ personal best = how close skaters skate to their ceiling
          </p>
          <div class="card" style="padding:var(--space-md)">
            ${clutch.map((e,i)=>`
              <div class="lb-row">
                <span class="lb-rank ${pc(i)}">${i+1}</span>
                <div class="lb-name"><a href="#/skater/${e.skater.id}" style="font-weight:500">${e.skater.name}</a></div>
                <span class="lb-country">${Nav.getFlagEmoji(e.skater.country_code)}</span>
                <div style="flex:1;max-width:160px">
                  <div class="landing-bar" style="height:7px">
                    <div class="landing-fill" style="width:${Math.min(e.ratio*100,100).toFixed(1)}%;background:linear-gradient(90deg,#2D4A1E,#8BAF5A)"></div>
                  </div>
                </div>
                <span class="lb-score" style="font-size:1rem">${pct(e.ratio)}</span>
                <span class="lb-country" style="font-size:.74rem;opacity:.6">avg ${e.avg.toFixed(2)} / pb ${e.pb.toFixed(2)}</span>
              </div>`).join('')}
          </div>
        </section>` : ''}

        ${!results.length ? `
          <div class="not-configured" style="margin:var(--space-2xl) auto;text-align:center">
            <h3>✦ No data yet</h3>
            <p>Connect your Google Sheet and add results to see statistics here.</p>
          </div>` : ''}

      </div>
    </div>`;

  if (ucFreqList.length) {
    const el = document.getElementById('uc-chart');
    if (el) Charts.drawBarChart(el, ucFreqList, { labelWidth: 80 });
  }

  Sparkles.scatter(document.getElementById('stats-sf'), 16);
}
