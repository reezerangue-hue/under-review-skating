/**
 * Under Review Skating — Navigation component
 */
const Nav = (() => {
  let searchDebounce = null;
  let allSkaters     = [];
  let allComps       = [];

  function getFlagEmoji(cc) {
    if (!cc || cc.length !== 2) return '';
    return cc.toUpperCase().split('').map(c =>
      String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0))
    ).join('');
  }

  function render() {
    const nav = document.getElementById('main-nav');
    nav.innerHTML = `
      <div class="nav-inner">
        <a href="#/" class="nav-brand">
          ${Sparkles.html('sparkle-sm')} Under Review ${Sparkles.html('sparkle-sm')}
        </a>
        <nav class="nav-links" aria-label="Primary">
          <a href="#/"        class="nav-link" data-route="home">Home</a>
          <a href="#/events"  class="nav-link" data-route="events">Events</a>
          <a href="#/skaters" class="nav-link" data-route="skaters">Skaters</a>
          <a href="#/stats"   class="nav-link" data-route="stats">Statistics</a>
        </nav>
        <div class="nav-actions">
          <div class="search-wrap">
            <input
              type="search"
              id="nav-search"
              class="search-input"
              placeholder="Search skaters &amp; events…"
              autocomplete="off"
              aria-label="Search"
            >
            <div id="search-dropdown" class="search-dropdown hidden" role="listbox" aria-label="Search results"></div>
          </div>
          <button id="theme-toggle" class="theme-btn" title="Toggle dark / light mode" aria-label="Toggle dark mode">◑</button>
        </div>
      </div>`;

    initTheme();
    initSearch();
    highlightActive();
    window.addEventListener('hashchange', highlightActive);
  }

  function highlightActive() {
    const hash = window.location.hash || '#/';
    document.querySelectorAll('.nav-link').forEach(a => {
      const route  = a.dataset.route;
      const active =
        (route === 'home'   && (hash === '#/' || hash === '#')) ||
        (route === 'events'  && hash.startsWith('#/events')) ||
        (route === 'skaters' && hash.startsWith('#/skaters')) ||
        (route === 'stats'   && hash.startsWith('#/stats'));
      a.classList.toggle('active', active);
    });
  }

  function initTheme() {
    if (localStorage.getItem('urs-theme') === 'dark') document.body.classList.add('dark');
    document.getElementById('theme-toggle').addEventListener('click', () => {
      document.body.classList.toggle('dark');
      localStorage.setItem('urs-theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    });
  }

  function initSearch() {
    const input    = document.getElementById('nav-search');
    const dropdown = document.getElementById('search-dropdown');

    input.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => runSearch(input.value.trim()), 220);
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') { dropdown.classList.add('hidden'); input.blur(); }
    });

    document.addEventListener('click', e => {
      if (!e.target.closest('.search-wrap')) dropdown.classList.add('hidden');
    });

    if (SheetsDB.isConfigured()) {
      SheetsDB.getSkaters().then(s => { allSkaters = s; }).catch(() => {});
      SheetsDB.getCompetitions().then(c => { allComps = c; }).catch(() => {});
    }
  }

  function runSearch(query) {
    const dropdown = document.getElementById('search-dropdown');
    if (!query || query.length < 2) { dropdown.classList.add('hidden'); return; }

    const q = query.toLowerCase();
    const sR = allSkaters.filter(s => s.name.toLowerCase().includes(q)).slice(0, 5);
    const cR = allComps.filter(c   => c.name.toLowerCase().includes(q)).slice(0, 4);

    if (!sR.length && !cR.length) {
      dropdown.innerHTML = `<div class="search-item" style="color:var(--text-muted);cursor:default">No results found</div>`;
      dropdown.classList.remove('hidden');
      return;
    }

    dropdown.innerHTML = [
      ...sR.map(s => `<div class="search-item" tabindex="0" data-href="#/skater/${s.id}"><span class="search-type">Skater</span>${getFlagEmoji(s.country_code)} ${s.name}</div>`),
      ...cR.map(c => `<div class="search-item" tabindex="0" data-href="#/competition/${c.id}"><span class="search-type">Event</span>${c.name}</div>`),
    ].join('');
    dropdown.classList.remove('hidden');

    dropdown.querySelectorAll('.search-item[data-href]').forEach(item => {
      const go = () => {
        Router.go(item.dataset.href);
        dropdown.classList.add('hidden');
        document.getElementById('nav-search').value = '';
      };
      item.addEventListener('click', go);
      item.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    });
  }

  return { render, getFlagEmoji };
})();
