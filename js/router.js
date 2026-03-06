/**
 * Under Review Skating — Hash-based client-side router
 */
const Router = (() => {
  const routes = [];
  let currentPath  = null;
  let previousPath = null;

  function addRoute(pattern, handler) {
    const paramNames = [];
    const regexStr = pattern.replace(/:([A-Za-z_]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    routes.push({ regex: new RegExp(`^${regexStr}$`), paramNames, handler });
  }

  function getPath() {
    const hash = window.location.hash;
    if (!hash || hash === '#') return '/';
    return hash.replace(/^#/, '');
  }

  async function dispatch() {
    const path = getPath();
    if (path === currentPath) return;
    previousPath = currentPath;
    currentPath  = path;

    for (const route of routes) {
      const match = path.match(route.regex);
      if (match) {
        const params = {};
        route.paramNames.forEach((name, i) => { params[name] = decodeURIComponent(match[i + 1]); });
        showPageLoading();
        try {
          await route.handler(params);
        } catch (err) {
          console.error('Router handler error:', err);
          showPageError(err);
        }
        return;
      }
    }
    show404();
  }

  function showPageLoading() {
    document.getElementById('app').innerHTML = `
      <div class="loading-state">
        <div class="loading-shimmer">
          <div class="loading-sparkle">✦</div>
          <p>Loading&hellip;</p>
        </div>
      </div>`;
  }

  function showPageError(err) {
    const app = document.getElementById('app');
    if (err.message === 'NOT_CONFIGURED') {
      app.innerHTML = `
        <div class="container">
          <div class="not-configured">
            <h3>✦ Setup Required</h3>
            <p>Open <code>js/config.js</code> and replace <code>YOUR_GOOGLE_SHEET_ID_HERE</code>
               and <code>YOUR_GOOGLE_API_KEY_HERE</code> with your real values.</p>
            <p>See <strong>README.md</strong> for step-by-step instructions.</p>
          </div>
        </div>`;
    } else {
      app.innerHTML = `
        <div class="error-state">
          <div class="error-icon">✦</div>
          <h2 class="error-title">Something went wrong</h2>
          <p class="error-msg">${err.message}</p>
          <button class="btn" onclick="window.location.reload()">Reload</button>
        </div>`;
    }
  }

  function show404() {
    document.getElementById('app').innerHTML = `
      <div class="error-state">
        <div class="error-icon" style="font-size:5rem;opacity:.3">✦</div>
        <h2 class="error-title">Page not found</h2>
        <p class="error-msg">The path <code>${getPath()}</code> doesn't exist.</p>
        <a href="#/" class="btn">Go home</a>
      </div>`;
  }

  function backPath()  { return previousPath || '/'; }
  function backLabel() {
    const p = previousPath || '/';
    if (!p || p === '/') return 'Home';
    if (p.startsWith('/skaters'))            return 'Skaters';
    if (p.startsWith('/events'))             return 'Events';
    if (p.startsWith('/stats'))              return 'Statistics';
    if (p.startsWith('/junior-eligibility')) return 'Eligibility';
    if (p.startsWith('/competition/'))       return 'Event';
    if (p.startsWith('/skater/'))            return 'Skater';
    return 'Back';
  }

  return {
    add: addRoute,
    init() {
      window.addEventListener('hashchange', () => { currentPath = null; dispatch(); });
      dispatch();
    },
    go(hash) {
      window.location.hash = hash.startsWith('#') ? hash.slice(1) : hash;
    },
    back:      backPath,
    backLabel: backLabel,
  };
})();
