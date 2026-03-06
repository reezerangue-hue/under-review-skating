/**
 * Under Review Skating — Junior Eligibility page
 * Shows skaters in the final year of junior eligibility who have competed
 * in Junior-tagged competitions this season. Auto-advances each season.
 *
 * Season logic (ISU-style June 30 cutoff):
 *   Senior-eligible range: July 1 YYYY-17 → June 30 YYYY-16
 *   e.g. 2025-2026 → born July 1 2008 through June 30 2009
 *   Aging out cutoff: born on or before June 30 YYYY-18
 *   e.g. 2025-2026 → born on or before June 30 2007
 */
async function renderJuniorEligibility() {
  const app = document.getElementById('app');

  const { skaters, competitions, results } = await SheetsDB.getAllData();

  /* ── Determine current season ──────────────────────────────────────────
     Use the latest season string present anywhere in the competitions list.
     Format expected: "YYYY-YYYY"  e.g. "2025-2026"
  */
  const allSeasons = [...new Set(
    competitions.filter(c => c.season).map(c => c.season)
  )].sort();
  const currentSeason = allSeasons[allSeasons.length - 1] || null;

  /* ── Birth-year window ─────────────────────────────────────────────── */
  let birthDateMin = null, birthDateMax = null, agingOutCutoff = null, nextSeason = null;
  if (currentSeason) {
    const seasonStartYear = parseInt(currentSeason.split('-')[0], 10);
    if (!isNaN(seasonStartYear)) {
      birthDateMin    = new Date(seasonStartYear - 17, 6, 1);  // July 1, local time
      birthDateMax    = new Date(seasonStartYear - 16, 5, 30); // June 30, local time
      agingOutCutoff  = new Date(seasonStartYear - 18, 5, 30); // June 30, local time
      nextSeason      = `${seasonStartYear + 1}-${seasonStartYear + 2}`;
    }
  }

  /* ── Junior competitions this season ───────────────────────────────── */
  const juniorComps = competitions.filter(c =>
    c.season === currentSeason &&
    c.level  && c.level.toLowerCase().includes('junior')
  );
  const juniorCompIds = new Set(juniorComps.map(c => c.id));
  const compNameById  = Object.fromEntries(juniorComps.map(c => [c.id, c.name]));

  /* ── Which skaters competed in a junior event this season ──────────── */
  const skaterCompNames = {}; // skaterId → Set of comp names
  results.forEach(r => {
    if (!juniorCompIds.has(r.competition_id)) return;
    if (!skaterCompNames[r.skater_id]) skaterCompNames[r.skater_id] = new Set();
    skaterCompNames[r.skater_id].add(compNameById[r.competition_id]);
  });

  /* ── Filter + enrich skaters ───────────────────────────────────────── */
  function parseDOB(str) {
    if (!str) return null;
    const parts = String(str).split('-');
    const d = parts.length === 3 ? new Date(+parts[0], +parts[1] - 1, +parts[2]) : new Date(str);
    return isNaN(d) ? null : d;
  }

  const eligible = skaters
    .filter(s => {
      if (!skaterCompNames[s.id]) return false;
      const dob = parseDOB(s.birthday);
      if (!dob) return false;
      return dob >= birthDateMin && dob <= birthDateMax;
    })
    .map(s => {
      const dob = parseDOB(s.birthday);

      /* Best combined score across junior comps this season */
      const juniorResults = results.filter(r =>
        juniorCompIds.has(r.competition_id) &&
        r.skater_id === s.id &&
        r.total_score > 0
      );
      const byComp = {};
      juniorResults.forEach(r => {
        byComp[r.competition_id] = (byComp[r.competition_id] || 0) + r.total_score;
      });
      const bestEntry = Object.entries(byComp).sort((a, b) => b[1] - a[1])[0];
      const bestTotal = bestEntry ? bestEntry[1] : 0;
      const topCompName = bestEntry
        ? (compNameById[bestEntry[0]] || '—')
        : ([...skaterCompNames[s.id]][0] || '—');

      return { ...s, dob, topCompName, bestTotal };
    })
    .sort((a, b) => b.bestTotal - a.bestTotal || a.name.localeCompare(b.name));

  /* ── Aging-out skaters (born on or before cutoff, competed junior this season) ── */
  const agingOut = agingOutCutoff
    ? skaters
        .filter(s => {
          if (!skaterCompNames[s.id]) return false;
          const dob = parseDOB(s.birthday);
          if (!dob) return false;
          return dob <= agingOutCutoff;
        })
        .map(s => {
          const dob = parseDOB(s.birthday);
          const juniorResults = results.filter(r =>
            juniorCompIds.has(r.competition_id) &&
            r.skater_id === s.id &&
            r.total_score > 0
          );
          const byComp = {};
          juniorResults.forEach(r => {
            byComp[r.competition_id] = (byComp[r.competition_id] || 0) + r.total_score;
          });
          const bestEntry = Object.entries(byComp).sort((a, b) => b[1] - a[1])[0];
          const bestTotal = bestEntry ? bestEntry[1] : 0;
          const topCompName = bestEntry
            ? (compNameById[bestEntry[0]] || '—')
            : ([...skaterCompNames[s.id]][0] || '—');
          return { ...s, dob, topCompName, bestTotal };
        })
        .sort((a, b) => b.bestTotal - a.bestTotal || a.name.localeCompare(b.name))
    : [];

  /* ── Helpers ───────────────────────────────────────────────────────── */
  function formatDate(d) {
    if (!d) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const birthRangeLabel = (birthDateMin && birthDateMax)
    ? `Born ${formatDate(birthDateMin)} – ${formatDate(birthDateMax)}`
    : '';

  const nextSeasonLabel = nextSeason || 'Next Season';

  /* ── Shared table renderer ─────────────────────────────────────────── */
  function skaterTable(rows, emptyMsg) {
    if (!rows.length) {
      return `<div class="not-configured" style="text-align:center">
        <h3>✦ No skaters found</h3>
        <p>${emptyMsg}</p>
      </div>`;
    }
    return `
      <div class="card" style="padding:var(--space-md);overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.88rem">
          <thead>
            <tr style="border-bottom:1px solid var(--border);text-align:left">
              <th style="padding:var(--space-sm) var(--space-md);font-weight:700;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted)">#</th>
              <th style="padding:var(--space-sm) var(--space-md);font-weight:700;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted)">Skater</th>
              <th style="padding:var(--space-sm) var(--space-md);font-weight:700;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted)">Date of Birth</th>
              <th style="padding:var(--space-sm) var(--space-md);font-weight:700;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted)">Top Junior Event This Season</th>
              <th style="padding:var(--space-sm) var(--space-md);font-weight:700;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);text-align:right">Best Total</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((s, i) => `
            <tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="Router.go('/skater/${s.id}')">
              <td style="padding:var(--space-sm) var(--space-md);color:var(--text-muted)">${i + 1}</td>
              <td style="padding:var(--space-sm) var(--space-md)">
                <a href="#/skater/${s.id}" onclick="event.stopPropagation()" style="font-weight:600">${s.name}</a>
                <span style="margin-left:var(--space-sm)">${Nav.getFlagEmoji(s.country_code)}</span>
                ${s.country ? `<span style="font-size:.76rem;color:var(--text-muted);margin-left:2px">${s.country}</span>` : ''}
              </td>
              <td style="padding:var(--space-sm) var(--space-md);color:var(--text-secondary)">${formatDate(s.dob)}</td>
              <td style="padding:var(--space-sm) var(--space-md);color:var(--text-secondary);font-size:.8rem">${s.topCompName}</td>
              <td style="padding:var(--space-sm) var(--space-md);text-align:right;font-weight:600;font-family:var(--font-mono)">${s.bestTotal > 0 ? s.bestTotal.toFixed(2) : '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  /* ── Render ────────────────────────────────────────────────────────── */
  app.innerHTML = `
    <div class="page-enter">
      <div class="container">

        <section style="padding:var(--space-2xl) 0 var(--space-xl);text-align:center;position:relative">
          <div class="sparkle-field" id="jelig-sf"></div>
          <p style="font-size:.72rem;font-weight:700;letter-spacing:.28em;text-transform:uppercase;color:var(--text-muted);margin-bottom:var(--space-sm)">
            ${Sparkles.html('sparkle-sm')} ${currentSeason || 'Current Season'} ${Sparkles.html('sparkle-sm')}
          </p>
          <h1 class="hero-title" style="font-size:clamp(2rem,8vw,5rem)">Eligibility</h1>
        </section>

        <section style="margin-bottom:var(--space-2xl)">
          <div class="section-header">
            <div>
              <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} Age Out</p>
              <h2 class="section-title">Eligible for Senior ${nextSeasonLabel}</h2>
            </div>
          </div>
          ${birthRangeLabel ? `
          <p style="color:var(--text-secondary);font-size:.84rem;margin-bottom:var(--space-md)">
            ${birthRangeLabel} &middot; Competed in at least one Junior event this season
            ${currentSeason ? `(${currentSeason})` : ''}
          </p>` : ''}

          ${skaterTable(eligible, 'No skaters in the eligible birth year range have competed in a Junior event this season.')}

        </section>

        <!-- AGING OUT TABLE -->
        <section style="margin-bottom:var(--space-2xl)">
          <div class="section-header">
            <div>
              <p class="section-eyebrow">${Sparkles.html('sparkle-sm')} Overaged</p>
              <h2 class="section-title">Aging Out</h2>
            </div>
          </div>
          ${agingOutCutoff ? `
          <p style="color:var(--text-secondary);font-size:.84rem;margin-bottom:var(--space-md)">
            Born on or before ${formatDate(agingOutCutoff)} &middot; Competed in at least one Junior event this season
            ${currentSeason ? `(${currentSeason})` : ''}
          </p>` : ''}

          ${skaterTable(agingOut, 'No overaged skaters have competed in a Junior event this season.')}

        </section>
      </div>
    </div>`;

  Sparkles.scatter(document.getElementById('jelig-sf'), 16);
}
