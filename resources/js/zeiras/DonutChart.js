// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È DonutChart di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { cx } from './interni/cx';
import { fmtNum } from './interni/fmtNum';

  function DonutChart(p) {
    var data = p.data || [], fmt = p.format || fmtNum;
    var total = data.reduce(function (a, d) { return a + d.value; }, 0) || 1;
    var ho = useState(null), hover = ho[0], setHover = ho[1];
    var R = 70, r = 48, C = 80, a0 = -Math.PI / 2, gap = 0.025;
    function arc(s, e) {
      var p1 = [C + R * Math.cos(s), C + R * Math.sin(s)], p2 = [C + R * Math.cos(e), C + R * Math.sin(e)], p3 = [C + r * Math.cos(e), C + r * Math.sin(e)], p4 = [C + r * Math.cos(s), C + r * Math.sin(s)], lg = e - s > Math.PI ? 1 : 0;
      return 'M' + p1 + 'A' + R + ' ' + R + ' 0 ' + lg + ' 1 ' + p2 + 'L' + p3 + 'A' + r + ' ' + r + ' 0 ' + lg + ' 0 ' + p4 + 'Z';
    }
    var cur = a0;
    var focus = hover != null ? data[hover] : null;
    return h('div', { className: 'zr-donut' },
      h('svg', { width: 160, height: 160, viewBox: '0 0 160 160', role: 'img', 'aria-label': p.ariaLabel || 'Grafico ad anello' },
        data.map(function (d, i) {
          var ang = d.value / total * Math.PI * 2, s = cur + gap / 2, e = cur + ang - gap / 2; cur += ang;
          return h('path', { key: d.label, d: arc(s, Math.max(s + 0.001, e)), className: cx('zr-fill-chart-' + (d.color || (i < 5 ? i + 1 : 'other')), hover != null && hover !== i && 'is-dim'), onMouseEnter: function () { setHover(i); }, onMouseLeave: function () { setHover(null); } });
        }),
        h('text', { x: C, y: C - 2, textAnchor: 'middle', className: 'zr-donut-value' }, focus ? Math.round(focus.value / total * 100) + '%' : (p.centerValue || fmt(total))),
        h('text', { x: C, y: C + 16, textAnchor: 'middle', className: 'zr-axis' }, focus ? focus.label : (p.centerLabel || 'Totale'))),
      h('ul', { className: 'zr-legend is-list' }, data.map(function (d, i) {
        return h('li', { key: d.label, onMouseEnter: function () { setHover(i); }, onMouseLeave: function () { setHover(null); } },
          h('span', { className: 'zr-swatch zr-bg-chart-' + (d.color || (i < 5 ? i + 1 : 'other')) }), h('span', { className: 'zr-legend-name' }, d.label),
          h('strong', null, fmt(d.value)), h('span', { className: 'zr-legend-pct' }, Math.round(d.value / total * 100) + '%'));
      })));
  }

export { DonutChart };
