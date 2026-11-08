// Generato da scripts/componenti.mjs: non si ritocca a mano.
// Sono righe private di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) che servono
// a 3 nomi registrati: stanno qui una volta sola e chi le usa le importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './h';
import { useState } from './useState';
import { useRef } from './useRef';
import { useEffect } from './useEffect';

  /* ---------- Charts ---------- */
  function niceMax(v) { if (v <= 0) return 1; var e = Math.pow(10, Math.floor(Math.log10(v))), n = v / e; var st = [1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10]; for (var i = 0; i < st.length; i++) if (n <= st[i]) return st[i] * e; return 10 * e; }
  function useWidth() {
    var ref = useRef(null), st = useState(560);
    useEffect(function () {
      if (!ref.current || !window.ResizeObserver) return;
      var ro = new ResizeObserver(function (en) { st[1](Math.max(200, Math.floor(en[0].contentRect.width))); });
      ro.observe(ref.current); return function () { ro.disconnect(); };
    }, []);
    return [ref, st[0]];
  }
  function Legend(p) {
    return h('ul', { className: 'zr-legend' }, p.items.map(function (it, i) {
      return h('li', { key: it.name }, h('span', { className: 'zr-swatch zr-bg-chart-' + (it.color || i + 1) }), it.name, it.value != null ? h('strong', null, it.value) : null);
    }));
  }
  function ChartTooltip(p) {
    if (!p.data) return null;
    return h('div', { className: 'zr-tip', style: { left: p.data.x, top: p.data.y } },
      h('div', { className: 'zr-tip-title' }, p.data.title),
      p.data.rows.map(function (r) { return h('div', { key: r.name, className: 'zr-tip-row' }, h('span', { className: 'zr-swatch zr-bg-chart-' + r.color }), h('span', null, r.name), h('strong', null, r.value)); }));
  }
  var PAD = { l: 44, r: 12, t: 12, b: 28 };
  function Axes(p) {
    var ticks = [0, .25, .5, .75, 1];
    return h('g', null,
      ticks.map(function (t) { var y = PAD.t + p.ih * (1 - t); return h('g', { key: t }, h('line', { x1: PAD.l, x2: PAD.l + p.iw, y1: y, y2: y, className: 'zr-grid' }), h('text', { x: PAD.l - 8, y: y + 4, textAnchor: 'end', className: 'zr-axis' }, p.fmt(p.max * t))); }),
      p.labels.map(function (l, i) { return (p.every && i % p.every) ? null : h('text', { key: i, x: p.xAt(i), y: PAD.t + p.ih + 18, textAnchor: 'middle', className: 'zr-axis' }, l); }));
  }

export { Axes, ChartTooltip, Legend, PAD, niceMax, useWidth };
