/* Tiny dependency-free charts so the demo works offline in XAMPP */
(function () {
  function setup(c) {
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = +c.getAttribute('height');
    c.width = w * dpr; c.height = h * dpr; c.style.height = h + 'px';
    const g = c.getContext('2d'); g.scale(dpr, dpr); return { g, w, h };
  }
  function line(c, metric, labels) {
    const { g, w, h } = setup(c), pad = { l: 40, r: 14, t: 16, b: 44 };
    g.clearRect(0, 0, w, h); g.font = '12px Figtree, system-ui, sans-serif';
    const all = metric.series.flatMap(s => s.values);
    if (!all.length) { g.fillStyle = '#44577a'; g.fillText('No readings yet', w / 2 - 40, h / 2); return; }
    let min = Math.min(...all), max = Math.max(...all); const span = (max - min) || 1; min -= span * .15; max += span * .15;
    const X = i => pad.l + (labels.length < 2 ? (w - pad.l - pad.r) / 2 : i * (w - pad.l - pad.r) / (labels.length - 1));
    const Y = v => pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b);
    g.strokeStyle = '#d6deec'; g.fillStyle = '#44577a'; g.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const v = min + (max - min) * i / 4, y = Y(v);
      g.beginPath(); g.moveTo(pad.l, y); g.lineTo(w - pad.r, y); g.stroke(); g.fillText(v.toFixed(max - min < 10 ? 1 : 0), 4, y + 4);
    }
    labels.forEach((l, i) => g.fillText(l, X(i) - 12, h - pad.b + 18));
    metric.series.forEach(s => {
      g.strokeStyle = s.color; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath();
      s.values.forEach((v, i) => i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v))); g.stroke();
      g.fillStyle = s.color; s.values.forEach((v, i) => { g.beginPath(); g.arc(X(i), Y(v), 4, 0, 7); g.fill(); });
    });
    let lx = pad.l; g.font = '600 12px Figtree, system-ui, sans-serif';
    metric.series.forEach(s => { g.fillStyle = s.color; g.fillRect(lx, h - 12, 12, 4); g.fillStyle = '#0f2447'; g.fillText(s.name, lx + 17, h - 6); lx += 22 + g.measureText(s.name).width + 14; });
  }
  function bars(c, data) {
    const { g, w, h } = setup(c); const items = [['Stable', data.normal, '#2a8a2f'], ['Review', data.warning, '#c58a00'], ['Urgent', data.critical, '#d9482b']];
    const max = Math.max(1, ...items.map(i => i[1])), bw = (w - 40) / items.length; g.clearRect(0, 0, w, h); g.font = '600 13px Figtree, system-ui, sans-serif';
    items.forEach(([l, v, col], i) => {
      const bh = (h - 50) * v / max, x = 20 + i * bw + 12;
      g.fillStyle = col; g.fillRect(x, h - 30 - bh, bw - 24, bh);
      g.fillStyle = '#0f2447'; g.fillText(v, x + (bw - 24) / 2 - 4, h - 36 - bh); g.fillStyle = '#44577a'; g.fillText(l, x + 4, h - 10);
    });
  }
  function init() {
    document.querySelectorAll('canvas[data-chart]:not([data-ready])').forEach(c => {
      c.dataset.ready = 1;
      const d = JSON.parse(c.dataset.chart); let cur = c.dataset.default || 'bp';
      const draw = () => line(c, d.metrics[cur], d.labels); draw();
      const tabs = document.querySelector('[data-chart-tabs="' + c.id + '"]');
      if (tabs) tabs.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        tabs.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); cur = b.dataset.metric; draw();
      }));
      window.addEventListener('resize', draw);
    });
    document.querySelectorAll('canvas[data-bars]:not([data-ready])').forEach(c => {
      c.dataset.ready = 1;
      const d = JSON.parse(c.dataset.bars); bars(c, d); window.addEventListener('resize', () => bars(c, d));
    });
  }
  window.initCharts = init;
  document.addEventListener('DOMContentLoaded', init);
})();
