// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È BarChart di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { cx } from './interni/cx';
import { Axes, ChartTooltip, Legend, PAD, niceMax, useWidth } from './interni/niceMax';
import { compact } from './interni/compact';
import { barPath } from './interni/barPath';

  function BarChart(p) {
    var wr = useWidth(), ref = wr[0], W = wr[1], H = p.height || 240;
    var tt = useState(null), tip = tt[0], setTip = tt[1];
    var series = p.series || [], labels = p.labels || [];
    var fmt = p.format || compact;
    var max = niceMax(Math.max.apply(null, series.reduce(function (a, s) { return a.concat(s.data); }, [1])));
    var iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
    var band = iw / labels.length, gw = Math.min(band * 0.7, series.length * 28), bw = (gw - (series.length - 1) * 2) / series.length;
    var xAt = function (i) { return PAD.l + band * i + band / 2; };
    var every = Math.ceil(labels.length / Math.max(2, Math.floor(iw / 56)));
    return h('div', { className: 'zr-chart', ref: ref },
      series.length > 1 ? h(Legend, { items: series }) : null,
      h('div', { className: 'zr-chart-plot' },
        h('svg', { width: W, height: H, role: 'img', 'aria-label': p.ariaLabel || 'Grafico a barre', onMouseLeave: function () { setTip(null); } },
          h(Axes, { iw: iw, ih: ih, max: max, fmt: fmt, labels: labels, xAt: xAt, every: every }),
          labels.map(function (l, i) {
            var x0 = xAt(i) - gw / 2;
            return h('g', { key: i, className: cx('zr-bar-group', tip && tip.i !== i && 'is-dim'),
              onMouseEnter: function () { setTip({ i: i, x: Math.min(xAt(i) + gw / 2 + 8, W - 170), y: 8, title: l, rows: series.map(function (s, k) { return { name: s.name, color: s.color || k + 1, value: fmt(s.data[i]) }; }) }); } },
              h('rect', { x: xAt(i) - band / 2, y: PAD.t, width: band, height: ih, fill: 'transparent' }),
              series.map(function (s, k) { var v = s.data[i], bh = Math.max(1, ih * v / max); return h('path', { key: k, d: barPath(x0 + k * (bw + 2), PAD.t + ih - bh, bw, bh), className: 'zr-fill-chart-' + (s.color || k + 1) }); }));
          })),
        h(ChartTooltip, { data: tip })));
  }

export { BarChart };
