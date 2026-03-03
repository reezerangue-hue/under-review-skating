/**
 * Under Review Skating — SVG Chart utilities
 * No external libraries. All charts rendered as inline SVG.
 */
const Charts = (() => {
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs = {}, text) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function svgRoot(w, h, cls = '') {
    return el('svg', { viewBox: `0 0 ${w} ${h}`, xmlns: NS, class: `chart-svg ${cls}`, 'aria-hidden': 'true' });
  }

  /* ── Score Progression Line Chart ───────────────────────
     series: [{ label, color, data: [{x, y}] }]
  ─────────────────────────────────────────────────────── */
  function drawLineChart(container, series, options = {}) {
    container.innerHTML = '';
    if (!series.length || !series[0].data.length) {
      container.innerHTML = '<p class="no-data" style="padding:1rem">No score data yet.</p>';
      return;
    }

    const W   = 620, H = 220;
    const pad = { top: 18, right: 24, bottom: 52, left: 54 };
    const pw  = W - pad.left - pad.right;
    const ph  = H - pad.top  - pad.bottom;

    const allY = series.flatMap(s => s.data.map(d => d.y)).filter(v => v > 0);
    if (!allY.length) { container.innerHTML = '<p class="no-data" style="padding:1rem">No score data yet.</p>'; return; }

    const yMin = Math.floor(Math.min(...allY) * 0.96);
    const yMax = Math.ceil(Math.max(...allY)  * 1.02);
    const xCount = series[0].data.length;

    const xScale = i => pad.left + (xCount === 1 ? pw / 2 : (i / (xCount - 1)) * pw);
    const yScale = v => pad.top  + ph - ((v - yMin) / (yMax - yMin || 1)) * ph;

    const svg = svgRoot(W, H, 'line-chart');

    /* grid */
    for (let i = 0; i <= 4; i++) {
      const yv = yMin + (i / 4) * (yMax - yMin);
      const y  = yScale(yv);
      svg.appendChild(el('line', { x1: pad.left, y1: y, x2: pad.left + pw, y2: y, stroke: 'rgba(255,255,255,0.1)', 'stroke-width': 1 }));
      svg.appendChild(el('text', { x: pad.left - 6, y: y + 4, fill: 'rgba(255,255,255,0.42)', 'font-size': 10, 'text-anchor': 'end', 'font-family': 'Inter,sans-serif' }, yv.toFixed(0)));
    }

    /* x labels */
    series[0].data.forEach((d, i) => {
      svg.appendChild(el('text', {
        x: xScale(i), y: H - 10,
        fill: 'rgba(255,255,255,0.42)', 'font-size': 9, 'text-anchor': 'middle', 'font-family': 'Inter,sans-serif',
      }, String(d.x || '').slice(0, 12)));
    });

    /* series */
    const COLORS = ['rgba(255,255,255,0.85)', 'hsl(200,100%,74%)', 'hsl(300,80%,78%)'];
    series.forEach((s, si) => {
      const color = s.color || COLORS[si % COLORS.length];
      if (!s.data.length) return;

      svg.appendChild(el('polyline', {
        points: s.data.map((d, i) => `${xScale(i)},${yScale(d.y)}`).join(' '),
        fill: 'none', stroke: color, 'stroke-width': 2,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.88,
      }));

      s.data.forEach((d, i) => {
        const cx = xScale(i), cy = yScale(d.y);
        svg.appendChild(el('circle', { cx, cy, r: 7, fill: color, opacity: 0.18 }));
        svg.appendChild(el('circle', { cx, cy, r: 4, fill: color }));
        svg.appendChild(el('text', { x: cx, y: cy - 9, fill: color, 'font-size': 9.5, 'text-anchor': 'middle', 'font-family': 'Inter,sans-serif', 'font-weight': 600 }, d.y.toFixed(2)));
      });
    });

    /* legend */
    series.forEach((s, si) => {
      const color = s.color || COLORS[si % COLORS.length];
      const lx = pad.left + si * 140;
      svg.appendChild(el('rect', { x: lx, y: H - 36, width: 18, height: 3, fill: color, rx: 2 }));
      svg.appendChild(el('text', { x: lx + 24, y: H - 30, fill: 'rgba(255,255,255,0.52)', 'font-size': 9.5, 'font-family': 'Inter,sans-serif' }, s.label || ''));
    });

    container.appendChild(svg);
  }

  /* ── Horizontal Bar Chart ────────────────────────────────
     data: [{ label, value, color?, decimals? }]
  ─────────────────────────────────────────────────────── */
  function drawBarChart(container, data, options = {}) {
    container.innerHTML = '';
    if (!data.length) { container.innerHTML = '<p class="no-data" style="padding:1rem">No data.</p>'; return; }

    const barH   = 22;
    const gap    = 8;
    const labelW = options.labelWidth || 110;
    const scoreW = 56;
    const W      = 560;
    const H      = data.length * (barH + gap) + 20;
    const barW   = W - labelW - scoreW - 16;
    const maxVal = Math.max(...data.map(d => Math.abs(d.value)));

    const svg = svgRoot(W, H, 'bar-chart');

    data.forEach((d, i) => {
      const y     = 10 + i * (barH + gap);
      const pct   = maxVal ? Math.abs(d.value) / maxVal : 0;
      const color = d.color || 'rgba(255,255,255,0.72)';

      svg.appendChild(el('text', {
        x: labelW - 8, y: y + barH / 2 + 4,
        fill: 'rgba(255,255,255,0.58)', 'font-size': 10, 'text-anchor': 'end', 'font-family': 'Inter,sans-serif',
      }, String(d.label).slice(0, 14)));

      svg.appendChild(el('rect', { x: labelW, y, width: barW, height: barH, rx: 4, fill: 'rgba(255,255,255,0.07)' }));

      const fw = Math.max(pct * barW, 3);
      svg.appendChild(el('rect', { x: labelW, y, width: fw, height: barH, rx: 4, fill: color, opacity: 0.84 }));

      const decimals = d.decimals !== undefined ? d.decimals : 2;
      svg.appendChild(el('text', {
        x: labelW + barW + 8, y: y + barH / 2 + 4,
        fill: 'rgba(255,255,255,0.68)', 'font-size': 10.5, 'font-weight': 600, 'font-family': 'Inter,sans-serif',
      }, typeof d.value === 'number' ? d.value.toFixed(decimals) : String(d.value)));
    });

    container.appendChild(svg);
  }

  /* ── Score Distribution Dot Chart ───────────────────────
     results: [{ skater_name, total_score, segment? }]
  ─────────────────────────────────────────────────────── */
  function drawDotChart(container, results, options = {}) {
    container.innerHTML = '';
    const scored = results.filter(r => r.total_score > 0);
    if (!scored.length) { container.innerHTML = '<p class="no-data" style="padding:1rem">No scores yet.</p>'; return; }

    const W   = 600, H = 150;
    const pad = { top: 18, right: 24, bottom: 38, left: 16 };
    const pw  = W - pad.left - pad.right;

    const scores = scored.map(r => r.total_score);
    const minS   = Math.min(...scores) * 0.97;
    const maxS   = Math.max(...scores) * 1.01;
    const xScale = v => pad.left + ((v - minS) / (maxS - minS || 1)) * pw;

    const svg = svgRoot(W, H, 'dot-chart');

    const axisY = H - pad.bottom;
    svg.appendChild(el('line', { x1: pad.left, y1: axisY, x2: pad.left + pw, y2: axisY, stroke: 'rgba(255,255,255,0.22)', 'stroke-width': 1 }));

    for (let i = 0; i <= 5; i++) {
      const v = minS + (i / 5) * (maxS - minS);
      const x = xScale(v);
      svg.appendChild(el('line',  { x1: x, y1: axisY, x2: x, y2: axisY + 4, stroke: 'rgba(255,255,255,0.22)', 'stroke-width': 1 }));
      svg.appendChild(el('text',  { x, y: axisY + 14, fill: 'rgba(255,255,255,0.42)', 'font-size': 9, 'text-anchor': 'middle', 'font-family': 'Inter,sans-serif' }, v.toFixed(0)));
    }

    scored.forEach((r, i) => {
      const x  = xScale(r.total_score);
      const cy = axisY - 20 - (i % 3) * 18;
      svg.appendChild(el('circle', { cx: x, cy, r: 9, fill: 'rgba(255,255,255,0.1)' }));
      svg.appendChild(el('circle', { cx: x, cy, r: 5, fill: 'rgba(255,255,255,0.84)' }));
      svg.appendChild(el('text', { x, y: cy - 10, fill: 'rgba(255,255,255,0.52)', 'font-size': 8.5, 'text-anchor': 'middle', 'font-family': 'Inter,sans-serif' }, (r.skater_name || '').split(' ').pop()));
    });

    container.appendChild(svg);
  }

  return { drawLineChart, drawBarChart, drawDotChart };
})();
