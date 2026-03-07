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
    gallery:      null,
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

  async function fetchTab(tabName, attempt = 0) {
    const res = await fetch(sheetsUrl(tabName));
    if (res.status === 429 && attempt < 3) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10);
      const delay = retryAfter > 0 ? retryAfter * 1000 : Math.pow(2, attempt) * 1500;
      await new Promise(r => setTimeout(r, delay));
      return fetchTab(tabName, attempt + 1);
    }
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
      const [skaters, competitions, results, elements, gallery] = await Promise.all([
        fetchTab(CONFIG.TABS.SKATERS),
        fetchTab(CONFIG.TABS.COMPETITIONS),
        fetchTab(CONFIG.TABS.RESULTS),
        fetchTab(CONFIG.TABS.ELEMENTS),
        fetchTab(CONFIG.TABS.GALLERY),
      ]);
      cache.skaters      = skaters;
      cache.competitions = competitions;
      cache.results      = results;
      cache.elements     = elements;
      cache.gallery      = gallery;
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
      placement:       ['DSQ','WD'].includes(String(r.placement).trim().toUpperCase()) ? String(r.placement).trim().toUpperCase() : num(r.placement),
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

    async getResult(resultId, competitionId = null) {
      await loadAll();
      const r = cache.results.find(r => r.result_id === resultId && (!competitionId || r.competition_id === competitionId));
      return r ? hydrateResult(r) : null;
    },

    /* --- Elements --- */
    async getElements(resultId, competitionId = null) {
      await loadAll();
      return cache.elements
        .filter(e => e.result_id === resultId && (!competitionId || e.competition_id === competitionId))
        .map(hydrateElement)
        .sort((a, b) => a.order_number - b.order_number);
    },

    async getSkaterElements(skaterId) {
      await loadAll();
      return cache.elements.filter(e => e.skater_id === skaterId).map(hydrateElement);
    },

    async getCompetitionElements(competitionId) {
      await loadAll();
      return cache.elements
        .filter(e => e.competition_id === competitionId)
        .map(hydrateElement);
    },

    /* --- Computed stats --- */
    async getSkaterStats(skaterId) {
      await loadAll();
      const results  = cache.results.filter(r => r.skater_id === skaterId).map(hydrateResult);
      const elements = cache.elements.filter(e => e.skater_id === skaterId).map(hydrateElement);

      const ucElems   = elements.filter(e => e.is_ultra_c);
      const ucLanded  = ucElems.filter(e => e.execution === 'Landed');

      const ucCounts = {};
      ucElems.forEach(e => {
        const code = e.element_code.split('+')[0];
        ucCounts[code] = (ucCounts[code] || 0) + 1;
      });
      const topUC = Object.entries(ucCounts).sort((a,b) => b[1]-a[1])[0];

      const highestGOE = elements.reduce((max, e) => e.goe > (max?.goe ?? -99) ? e : max, null);

      const compTotals = Object.values(
        results.filter(r => r.total_score > 0).reduce((acc, r) => {
          acc[r.competition_id] = (acc[r.competition_id] || 0) + r.total_score;
          return acc;
        }, {})
      ).filter(v => v > 0);
      const fsScores    = results.filter(r => r.segment === 'Free Skate' && r.component_score > 0);

      /* Overall podiums: top-3 combined (SP+FS) finish per competition */
      const skaterCompIds = [...new Set(results.map(r => r.competition_id))];
      const allResults    = cache.results.map(hydrateResult);
      let podiumCount = 0;
      skaterCompIds.forEach(compId => {
        const compResults = allResults.filter(r => r.competition_id === compId && r.total_score > 0);
        const combined = {};
        compResults.forEach(r => {
          combined[r.skater_id] = (combined[r.skater_id] || 0) + r.total_score;
        });
        const ranked = Object.entries(combined).sort((a, b) => b[1] - a[1]);
        const pos = ranked.findIndex(([sid]) => sid === skaterId);
        if (pos >= 0 && pos < 3) podiumCount++;
      });
      const numComps = skaterCompIds.length;

      return {
        totalCompetitions: numComps,
        avgTotal:          compTotals.length ? compTotals.reduce((a,b) => a + b, 0) / compTotals.length : 0,
        avgComponent:      fsScores.length ? (fsScores.reduce((s,r) => s + r.component_score, 0) / fsScores.length / 2.67) / 3 : 0,
        podiums:           podiumCount,
        podiumRate:        numComps ? (podiumCount / numComps * 100).toFixed(0) : 'N/A',
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

    /* --- Gallery --- */
    async getSkaterGallery(skaterId) {
      await loadAll();
      const row = (cache.gallery || []).find(g => g.skater_id === skaterId);
      if (!row) return [];
      return [1,2,3,4,5,6,7,8].map(i => row[`gallery${i}`]).filter(Boolean);
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
