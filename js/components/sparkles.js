/**
 * Under Review Skating — Sparkle / ambient decoration utilities
 */
const Sparkles = (() => {
  const GLYPH = '✦';

  function scatter(container, count = 18) {
    if (!container) container = document.querySelector('.hero') || document.getElementById('app');
    if (!container) return;

    container.querySelectorAll('.sparkle-ambient').forEach(el => el.remove());

    const pos = getComputedStyle(container).position;
    if (pos === 'static') container.style.position = 'relative';

    const sizes = [0.55, 0.7, 0.85, 1, 1.2, 1.6, 2];
    const opacs = [0.18, 0.26, 0.34, 0.42, 0.5];
    const durs  = [2.5, 3, 3.5, 4, 4.8];

    for (let i = 0; i < count; i++) {
      const el       = document.createElement('span');
      el.className   = 'sparkle-ambient';
      el.textContent = GLYPH;
      el.setAttribute('aria-hidden', 'true');

      const size  = sizes[i % sizes.length];
      const opac  = opacs[i % opacs.length];
      const dur   = durs[i  % durs.length];
      const delay = (Math.random() * 4).toFixed(2);
      const top   = (Math.random() * 90).toFixed(1);
      const left  = (Math.random() * 96).toFixed(1);

      el.style.cssText = `
        top:${top}%; left:${left}%;
        font-size:${size}rem;
        opacity:${opac};
        animation-duration:${dur}s;
        animation-delay:${delay}s;
      `;
      container.appendChild(el);
    }
  }

  function html(cls = '') {
    return `<span class="sparkle ${cls}" aria-hidden="true">${GLYPH}</span>`;
  }

  return { scatter, html, GLYPH };
})();
