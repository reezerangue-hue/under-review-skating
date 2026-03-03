/**
 * Under Review Skating — Events page
 * All competitions ordered by most recent, each with its top-10 combined results.
 */
async function renderEvents() {
  const app = document.getElementById('app');

  const { skaters, competitions, results } = await SheetsDB.getAllData();

  const skaterMap = Object.fromEntries(skaters.map(s => [s.id, s]));

  /* Build combined score per skater per competition */
  const combined = {};
  results.forEach(r => {
    if (!r.total_score) return;
    const key = `${r.competition_id}__${r.skater_id}`;
    if (!combined[key]) combined[key] = { competition_id: r.competition_id, skater_id: r.skater_id, total: 0 };
    combined[key].total += r.total_score;
  });

  /* Group by competition, sorted by combined total desc, top 10 */
  const byComp = {};
  Object.values(combined).forEach(e => {
    if (!byComp[e.competition_id]) byComp[e.competition_id] = [];
    byComp[e.competition_id].push(e);
  });

  function levelClass(l) { return 'level-' + (l || 'default').replace(/\s+/g, ''); }
  function placeClass(i) { if (i === 0) return 'r1'; if (i === 1) return 'r2'; if (i === 2) return 'r3'; return ''; }
  function formatDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    return isNaN(dt) ? d : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  app.innerHTML = `
    <div class="page-enter">
      <div class="container">

        <section style="padding:var(--space-2xl) 0 var(--space-xl);text-align:center;position:relative">
          <div class="sparkle-field" id="events-sf"></div>
          <p style="font-size:.72rem;font-weight:700;letter-spacing:.28em;text-transform:uppercase;color:var(--text-muted);margin-bottom:var(--space-sm)">
            ${Sparkles.html('sparkle-sm')} All Competitions ${Sparkles.html('sparkle-sm')}
          </p>
          <h1 class="hero-title" style="font-size:clamp(2.5rem,10vw,6rem)">Events</h1>
        </section>

        ${competitions.length ? competitions.map(comp => {
          const rows = (byComp[comp.id] || [])
            .map(e => ({ ...e, skater: skaterMap[e.skater_id] }))
            .filter(e => e.skater)
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);

          return `
          <section style="margin-bottom:var(--space-2xl)">
            <div class="section-header">
              <div>
                <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} ${formatDate(comp.date)}</p>
                <h2 class="section-title">
                  <a href="#/competition/${comp.id}" style="color:inherit;text-decoration:none">${comp.name}</a>
                </h2>
              </div>
              <a href="#/competition/${comp.id}" class="section-link">Full results →</a>
            </div>
            <div style="display:flex;gap:var(--space-sm);align-items:center;margin-bottom:var(--space-md);flex-wrap:wrap">
              <span class="level-badge ${levelClass(comp.level)}">${comp.level || 'Event'}</span>
              ${comp.location ? `<span style="color:var(--text-muted);font-size:.82rem">${comp.location}</span>` : ''}
            </div>
            ${rows.length ? `
            <div class="card" style="padding:var(--space-md)">
              ${rows.map((e, i) => `
                <div class="lb-row" onclick="Router.go('/skater/${e.skater_id}')" style="cursor:pointer">
                  <span class="lb-rank ${placeClass(i)}">${i + 1}</span>
                  <div class="lb-name">
                    <a href="#/skater/${e.skater_id}" onclick="event.stopPropagation()" style="font-weight:500">${e.skater.name}</a>
                  </div>
                  <span class="lb-country">${Nav.getFlagEmoji(e.skater.country_code)}</span>
                  <span class="lb-score">${e.total.toFixed(2)}</span>
                </div>`).join('')}
            </div>` : `<p class="no-data">No results recorded yet.</p>`}
          </section>`;
        }).join('') : `
          <div class="not-configured" style="margin:var(--space-2xl) auto;text-align:center">
            <h3>✦ No events yet</h3>
            <p>Add competitions and results to your Google Sheet to see them here.</p>
          </div>`}

      </div>
    </div>`;

  Sparkles.scatter(document.getElementById('events-sf'), 16);
}
