// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È Sparkline di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';

  function Sparkline(p) {
    var d = p.data || [], W = p.width || 96, H = p.height || 32;
    var mn = Math.min.apply(null, d), mx = Math.max.apply(null, d), rg = mx - mn || 1;
    var pts = d.map(function (v, i) { return (i * W / (d.length - 1)).toFixed(1) + ',' + (H - 3 - (v - mn) / rg * (H - 6)).toFixed(1); }).join(' ');
    return h('svg', { width: W, height: H, className: 'zr-spark', 'aria-hidden': true }, h('polyline', { points: pts, className: 'zr-line zr-stroke-chart-' + (p.color || 1) }));
  }

export { Sparkline };
