// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È LineChart di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { cx } from './interni/cx';
import { Axes, ChartTooltip, Legend, PAD, niceMax, useWidth } from './interni/niceMax';
import { compact } from './interni/compact';

  function LineChart(p) {
    var wr = useWidth(), ref = wr[0], W = wr[1], H = p.height || 240;
    var tt = useState(null), tip = tt[0], setTip = tt[1];
    var series = p.series || [], labels = p.labels || [];
    var fmt = p.format || compact;
    var max = niceMax(Math.max.apply(null, series.reduce(function (a, s) { return a.concat(s.data); }, [1])));
    var iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
    var xAt = function (i) { return PAD.l + (labels.length > 1 ? iw * i / (labels.length - 1) : iw / 2); };
    var yAt = function (v) { return PAD.t + ih * (1 - v / max); };
    var every = Math.ceil(labels.length / Math.max(2, Math.floor(iw / 64)));
    function move(e) {
      var r = e.currentTarget.getBoundingClientRect(), x = e.clientX - r.left;
      var i = Math.max(0, Math.min(labels.length - 1, Math.round((x - PAD.l) / iw * (labels.length - 1))));
      setTip({ i: i, x: Math.min(xAt(i) + 12, W - 170), y: 8, title: labels[i], rows: series.map(function (s, k) { return { name: s.name, color: s.color || k + 1, value: fmt(s.data[i]) }; }) });
    }
    return h('div', { className: 'zr-chart', ref: ref },
      series.length > 1 ? h(Legend, { items: series }) : null,
      h('div', { className: 'zr-chart-plot' },
        h('svg', { width: W, height: H, role: 'img', 'aria-label': p.ariaLabel || 'Grafico a linee', onMouseMove: move, onMouseLeave: function () { setTip(null); } },
          h(Axes, { iw: iw, ih: ih, max: max, fmt: fmt, labels: labels, xAt: xAt, every: every }),
          tip ? h('line', { x1: xAt(tip.i), x2: xAt(tip.i), y1: PAD.t, y2: PAD.t + ih, className: 'zr-crosshair' }) : null,
          series.map(function (s, k) {
            var c = s.color || k + 1;
            var step = s.step !== undefined ? s.step : p.step; /* a gradino: orizzontale fino al punto dopo, poi il salto */
            var d = s.data.map(function (v, i) { return !i ? 'M' + xAt(i).toFixed(1) + ' ' + yAt(v).toFixed(1) : step ? 'H' + xAt(i).toFixed(1) + ' V' + yAt(v).toFixed(1) : 'L' + xAt(i).toFixed(1) + ' ' + yAt(v).toFixed(1); }).join(' ');
            return h('g', { key: s.name },
              p.area && k === 0 ? h('path', { d: d + ' L' + xAt(s.data.length - 1) + ' ' + (PAD.t + ih) + ' L' + xAt(0) + ' ' + (PAD.t + ih) + 'Z', className: 'zr-area zr-fill-chart-' + c }) : null,
              h('path', { d: d, className: cx('zr-line', 'zr-stroke-chart-' + c, s.dashed && 'is-dashed') }),
              tip ? h('circle', { cx: xAt(tip.i), cy: yAt(s.data[tip.i]), r: 4.5, className: 'zr-dot zr-fill-chart-' + c }) : null);
          })),
        h(ChartTooltip, { data: tip })));
  }

export { LineChart };
