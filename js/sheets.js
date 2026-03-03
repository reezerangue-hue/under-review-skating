/**
 * Under Review Skating — Google Sheets Data Layer
 * Fetches all tab data once, caches in memory, exposes clean async API.
 */
const SheetsDB = (() => {
  const cache = {
    skaters:      null,
    competitions: null,
    results:      null,
    elements:     null,
    loaded:       false,
    loading:      false,
    loadPromise:  null,
  };

  /* ── Helpers ──────────────────────────────────────────── */

  function isConfigured() {
    return (
      CONFIG.SHEET_ID !== 'YOUR_GOOGLE_SHEET_ID_HERE' &&
      CONFIG.API_KEY  !== 'YOUR_GOOGLE_API_KEY_HERE'  &&
      CONFIG.SHEET_ID.length > 10 &&
      CONFIG.API_KEY.length  > 10
    );
  }

  function sheetsUrl(tabName) {
    return (
      `https://sheets.googleapis.com/v4/spreadsheets/` +
      `${encodeURIComponent(CONFIG.SHEET_ID)}/values/` +
      `${encodeURIComponent(tabName)}` +
      `?key=${encodeURIComponent(CONFIG.API_KEY)}`
    );
  }

  /**
   * Parse a raw 2-D values array from the Sheets API into an array of objects.
   * The first row is used as the header (normalised to snake_case).
   */
  function parseSheet(values) {
    if (!values || values.length < 2) return [];
    const headers = values[0].map(h =>
      String(h).trim().toLowerCase().replace(/\s+/g, '_')
    );
    return values.slice(1)
      .filter(row => row.some(cell => cell !== '' && cell !== undefined))
      .map(row => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? String(row[i]).trim() : ''; });
        return obj;
      });
  }

  async function fetchTab(tabName) {
    const res = await fetch(sheetsUrl(tabName));
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Sheets API error for tab "${tabName}" (${res.status}): ${text.slice(0,200)}`);
    }
    const data = await res.json();
    return parseSheet(data.values);
  }

  async function loadAll() {
    if (cache.loaded) return;
    if (cache.loading) return cache.loadPromise;

    cache.loading = true;
    cache.loadPromise = (async () => {
      if (!isConfigured()) {
        throw new Error('NOT_CONFIGURED');
      }
      const [skaters, competitions, results, elements] = await Promise.all([
        fetchTab(CONFIG.TABS.SKATERS),
        fetchTab(CONFIG.TABS.COMPETITIONS),
        fetchTab(CONFIG.TABS.RESULTS),
        fetchTab(CONFIG.TABS.ELEMENTS),
      ]);
      cache.skaters      = skaters;
      cache.competitions = competitions;
      cache.results      = results;
      cache.elements     = elements;
      cache.loaded       = true;
    })();

    try {
      await cache.loadPromise;
    } finally {
      cache.loading = false;
    }
  }

  /* ── Typed accessors ──────────────────────────────────── */

  function num(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function bool(v){ return String(v).toUpperCase() === 'TRUE'; }

  function hydrateSkater(s) {
    return {
      ...s,
      personal_best_short: num(s.personal_best_short),
      personal_best_free:  num(s.personal_best_free),
      personal_best_total: num(s.personal_best_total),
      season_best_short:   num(s.season_best_short),
      season_best_free:    num(s.season_best_free),
      season_best_total:   num(s.season_best_total),
    };
  }

  function hydrateResult(r) {
    return {
      ...r,
      placement:       num(r.placement),
      total_score:     num(r.total_score),
      technical_score: num(r.technical_score),
      component_score: num(r.component_score),
      deductions:      num(r.deductions),
    };
  }

  function hydrateElement(e) {
    return {
      ...e,
      order_number:   num(e.order_number),
      base_value:     num(e.base_value),
      goe:            num(e.goe),
      panel_score:    num(e.panel_score),
      is_ultra_c:     bool(e.is_ultra_c),
      is_second_half: bool(e.is_second_half),
    };
  }

  /* ── Public API ───────────────────────────────────────── */
  return {
    isConfigured,

    async init() { await loadAll(); },

    /* --- Skaters --- */
    async getSkaters() {
      await loadAll();
      return cache.skaters.map(hydrateSkater);
    },

    async getSkater(id) {
      await loadAll();
      const s = cache.skaters.find(s => s.id === id);
      return s ? hydrateSkater(s) : null;
    },

    /* --- Competitions --- */
    async getCompetitions() {
      await loadAll();
      return [...cache.competitions].sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    async getCompetition(id) {
      await loadAll();
      return cache.competitions.find(c => c.id === id) || null;
    },

    /* --- Results --- */
    async getResults(competitionId) {
      await loadAll();
      const list = competitionId
        ? cache.results.filter(r => r.competition_id === competitionId)
        : cache.results;
      return list.map(hydrateResult);
    },

    async getSkaterResults(skaterId) {
      await loadAll();
      return cache.results.filter(r => r.skater_id === skaterId).map(hydrateResult);
    },

    async getResult(resultId) {
      await loadAll();
      const r = cache.results.find(r => r.id === resultId);
      return r ? hydrateResult(r) : null;
    },

    /* --- Elements --- */
    async getElements(resultId) {
      await loadAll();
      return cache.elements
        .filter(e => e.result_id === resultId)
        .map(hydrateElement)
        .sort((a, b) => a.order_number - b.order_number);
    },

    async getSkaterElements(skaterId) {
      await loadAll();
      return cache.elements.filter(e => e.skater_id === skaterId).map(hydrateElement);
    },

    /* --- Computed stats --- */
    async getSkaterStats(skaterId) {
      await loadAll();
      const results  = cache.results.filter(r => r.skater_id === skaterId).map(hydrateResult);
      const elements = cache.elements.filter(e => e.skater_id === skaterId).map(hydrateElement);

      const ucElems   = elements.filter(e => e.is_ultra_c);
      const ucLanded  = ucElems.filter(e => e.execution === 'Landed');

      const ucCounts = {};
      ucElems.forEach(e => { ucCounts[e.element_code] = (ucCounts[e.element_code] || 0) + 1; });
      const topUC = Object.entries(ucCounts).sort((a,b) => b[1]-a[1])[0];

      const highestGOE = elements.reduce((max, e) => e.goe > (max?.goe ?? -99) ? e : max, null);

      const totalScores = results.filter(r => r.total_score > 0);
      const compScores  = results.filter(r => r.component_score > 0);
      const podiums     = results.filter(r => r.placement > 0 && r.placement <= 3);

      return {
        totalCompetitions: new Set(results.map(r => r.competition_id)).size,
        avgTotal:          totalScores.length ? totalScores.reduce((s,r) => s + r.total_score, 0) / totalScores.length : 0,
        avgComponent:      compScores.length  ? compScores.reduce((s,r)  => s + r.component_score, 0) / compScores.length  : 0,
        podiums:           podiums.length,
        podiumRate:        results.length ? (podiums.length / results.length * 100).toFixed(0) : 'N/A',
        ultraCAttempts:    ucElems.length,
        ultraCLandingRate: ucElems.length ? (ucLanded.length / ucElems.length * 100).toFixed(1) : 'N/A',
        topUCElement:      topUC ? topUC[0] : '—',
        topUCAttempts:     topUC ? topUC[1] : 0,
        highestGOEElement: highestGOE ? highestGOE.element_code : '—',
        highestGOEValue:   highestGOE ? highestGOE.goe : 0,
      };
    },

    /* Element-level landing rate for a specific code + skater */
    async getElementLandingRate(skaterId, elementCode, season) {
      await loadAll();
      const elems = cache.elements
        .filter(e => e.skater_id === skaterId && e.element_code === elementCode)
        .map(hydrateElement);

      const career = {
        total:  elems.length,
        landed: elems.filter(e => e.execution === 'Landed').length,
      };

      let seasonElems = elems;
      if (season) {
        const compsInSeason = cache.competitions.filter(c => c.season === season).map(c => c.id);
        seasonElems = elems.filter(e => compsInSeason.includes(e.competition_id));
      }
      const seasonStat = {
        total:  seasonElems.length,
        landed: seasonElems.filter(e => e.execution === 'Landed').length,
      };

      return { career, season: seasonStat };
    },

    /* Get all data (for stats page) */
    async getAllData() {
      await loadAll();
      return {
        skaters:      cache.skaters.map(hydrateSkater),
        competitions: cache.competitions,
        results:      cache.results.map(hydrateResult),
        elements:     cache.elements.map(hydrateElement),
      };
    },
  };
})();
